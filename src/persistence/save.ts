import type { GameState } from '../core/state.ts';
import { saveMigrations } from './migrations.ts';

export const currentSaveVersion = 5;

const exportPrefix = 'WEBRIDDLE-';
const exportSuffix = '-END';

export interface RawSave {
    readonly version: number;
    readonly savedAt: number;
    readonly state: unknown;
}

export interface SaveEnvelope {
    readonly version: number;
    readonly savedAt: number;
    readonly state: GameState;
}

export interface SaveMigration {
    readonly fromVersion: number;
    migrate(save: RawSave): RawSave;
}

export class SaveError extends Error {
    override readonly name = 'SaveError';
}

export function serializeSave(state: GameState, savedAt: number): string {
    const save: RawSave = { version: currentSaveVersion, savedAt, state };
    return JSON.stringify(save);
}

export function parseSave(serialized: string, defaults: GameState): SaveEnvelope {
    const rawSave = parseRawSave(serialized);
    if (rawSave.version > currentSaveVersion) {
        throw new SaveError(`This save comes from a newer version of the game (save version ${rawSave.version}).`);
    }
    const migratedSave = migrateSave(rawSave, saveMigrations, currentSaveVersion);
    validateState(migratedSave.state);
    return {
        version: currentSaveVersion,
        savedAt: migratedSave.savedAt,
        state: mergeWithDefaults(migratedSave.state, defaults),
    };
}

export function migrateSave(save: RawSave, migrations: readonly SaveMigration[], targetVersion: number): RawSave {
    let migratedSave = save;
    while (migratedSave.version < targetVersion) {
        const fromVersion = migratedSave.version;
        const migration = migrations.find((candidate) => candidate.fromVersion === fromVersion);
        if (migration === undefined) {
            throw new SaveError(`There is no migration from save version ${fromVersion}.`);
        }
        migratedSave = { ...migration.migrate(migratedSave), version: fromVersion + 1 };
    }
    return migratedSave;
}

export function mergeWithDefaults<Value>(saved: unknown, defaults: Value): Value {
    if (defaults === null) {
        return (saved === null || isPlainObject(saved) ? structuredClone(saved) : null) as Value;
    }
    if (Array.isArray(defaults)) {
        return structuredClone(Array.isArray(saved) ? saved : defaults) as Value;
    }
    if (isPlainObject(defaults)) {
        if (!isPlainObject(saved)) {
            return structuredClone(defaults);
        }
        const entries = Object.entries(defaults).map(([key, value]) => [
            key,
            Object.hasOwn(saved, key) ? mergeWithDefaults(saved[key], value) : structuredClone(value),
        ]);
        const additions = Object.entries(saved).filter(([key]) => !Object.hasOwn(defaults, key));
        return Object.fromEntries([...entries, ...structuredClone(additions)]) as Value;
    }
    return structuredClone(typeof saved === typeof defaults ? saved : defaults) as Value;
}

export function encodeExport(serialized: string): string {
    return `${exportPrefix}${bytesToBase64(new TextEncoder().encode(serialized))}${exportSuffix}`;
}

export function decodeExport(exported: string): string {
    const trimmed = exported.trim();
    if (!trimmed.startsWith(exportPrefix) || !trimmed.endsWith(exportSuffix)) {
        throw new SaveError('This is not a complete save. It may have been cut off while copying.');
    }
    const base64 = trimmed.slice(exportPrefix.length, -exportSuffix.length);
    try {
        return new TextDecoder().decode(base64ToBytes(base64));
    } catch {
        throw new SaveError('This save is damaged and cannot be read.');
    }
}

function parseRawSave(serialized: string): RawSave {
    let parsed: unknown;
    try {
        parsed = JSON.parse(serialized);
    } catch {
        throw new SaveError('The save data is not valid JSON.');
    }
    if (
        !isPlainObject(parsed) ||
        !positiveInteger(parsed.version) ||
        !nonnegativeNumber(parsed.savedAt) ||
        !isPlainObject(parsed.state)
    ) {
        throw new SaveError('The save data is missing required fields.');
    }
    return { version: parsed.version, savedAt: parsed.savedAt, state: parsed.state };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

type ValueCheck = (value: unknown) => boolean;

function nonnegativeNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function nonnegativeInteger(value: unknown): value is number {
    return nonnegativeNumber(value) && Number.isSafeInteger(value);
}

function positiveInteger(value: unknown): value is number {
    return nonnegativeInteger(value) && value > 0;
}

function recordOf(check: ValueCheck): ValueCheck {
    return (value) => isPlainObject(value) && Object.values(value).every(check);
}

function arrayOf(check: ValueCheck): ValueCheck {
    return (value) => Array.isArray(value) && value.every(check);
}

function fieldsMatch(value: unknown, checks: Readonly<Record<string, ValueCheck>>, required = false): boolean {
    return isPlainObject(value) && Object.entries(checks).every(([key, check]) =>
        Object.hasOwn(value, key) ? check(value[key]) : !required,
    );
}

function validCaptcha(value: unknown): boolean {
    return value === null || fieldsMatch(value, { word: (word) => typeof word === 'string' && word.trim().length > 0 }, true);
}

function validateState(value: unknown): void {
    const string: ValueCheck = (candidate) => typeof candidate === 'string';
    const boolean: ValueCheck = (candidate) => typeof candidate === 'boolean';
    const checks: Readonly<Record<keyof GameState, ValueCheck>> = {
        elapsedSeconds: nonnegativeNumber,
        pendingTickSeconds: nonnegativeNumber,
        randomState: (candidate) => typeof candidate === 'number' && Number.isInteger(candidate) && candidate >= -(2 ** 31) && candidate < 2 ** 32,
        currentLevel: positiveInteger,
        levelProgress: nonnegativeNumber,
        browserUrl: string,
        resources: recordOf(nonnegativeNumber),
        purchases: recordOf(nonnegativeInteger),
        reachedMilestones: recordOf(nonnegativeNumber),
        flags: recordOf(boolean),
        statistics: recordOf(nonnegativeNumber),
        jobs: recordOf(nonnegativeInteger),
        findings: recordOf(nonnegativeInteger),
        activity: string,
        search: (candidate) => fieldsMatch(candidate, {
            level: positiveInteger,
            requestsSpent: nonnegativeNumber,
            configuration: string,
        }),
        network: (candidate) => fieldsMatch(candidate, {
            heat: nonnegativeNumber,
            bannedUntil: nonnegativeNumber,
            proxies: arrayOf((proxy) => fieldsMatch(proxy, {
                address: string,
                latencyMilliseconds: nonnegativeNumber,
                diesAtSeconds: nonnegativeNumber,
            }, true)),
        }),
        captcha: validCaptcha,
        favorites: arrayOf(string),
        visitedLevels: recordOf(positiveInteger),
    };
    if (!isPlainObject(value)) {
        throw new SaveError('The save data has an invalid game state.');
    }
    for (const [key, check] of Object.entries(checks)) {
        if (Object.hasOwn(value, key) && !check(value[key])) {
            throw new SaveError(`The save data has an invalid ${key} field.`);
        }
    }
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
    return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}
