import type { GameState } from '../core/state.ts';

export const currentSaveVersion = 10;

export const saveErrorText = {
    newerVersion: 'This save comes from a newer version of the game (save version {version}).',
    olderVersion: 'This save comes from an older version of the game (save version {version}) and can no longer be loaded.',
    incomplete: 'This is not a complete save. It may have been cut off while copying.',
    damaged: 'This save is damaged and cannot be read.',
    notJson: 'The save data is not valid JSON.',
    missingFields: 'The save data is missing required fields.',
    invalidState: 'The save data has an invalid game state.',
    invalidField: 'The save data has an invalid {field} field.',
} as const;

const exportPrefix = 'WEBRIDDLE-';
const exportSuffix = '-END';

interface RawSave {
    readonly version: number;
    readonly savedAt: number;
    readonly state: unknown;
}

export interface SaveEnvelope {
    readonly version: number;
    readonly savedAt: number;
    readonly state: GameState;
}

export class SaveError extends Error {
    override readonly name = 'SaveError';
}

type ValueCheck = (value: unknown) => boolean;

const text: ValueCheck = (value) => typeof value === 'string';
const flag: ValueCheck = (value) => typeof value === 'boolean';
const randomSeed: ValueCheck = (value) => typeof value === 'number' && Number.isInteger(value) && value >= -(2 ** 31) && value < 2 ** 32;
const captchaWord: ValueCheck = (value) => typeof value === 'string' && value.trim().length > 0;

const stateChecks: Readonly<Record<keyof GameState, ValueCheck>> = {
    elapsedSeconds: nonnegativeNumber,
    pendingTickSeconds: nonnegativeNumber,
    randomState: randomSeed,
    currentLevel: positiveInteger,
    levelProgress: nonnegativeNumber,
    browserUrl: text,
    resources: recordOf(nonnegativeNumber),
    purchases: recordOf(nonnegativeInteger),
    reachedMilestones: recordOf(nonnegativeNumber),
    flags: recordOf(flag),
    statistics: recordOf(nonnegativeNumber),
    jobs: recordOf(nonnegativeInteger),
    findings: recordOf(nonnegativeInteger),
    activity: text,
    search: (value) => optionalFields(value, { stage: nonnegativeInteger, requestsSpent: nonnegativeNumber, configuration: text }),
    network: (value) => optionalFields(value, {
        heat: nonnegativeNumber,
        bannedUntil: nonnegativeNumber,
        proxies: arrayOf((proxy) => requiredFields(proxy, { address: text, latencyMilliseconds: nonnegativeNumber, diesAtSeconds: nonnegativeNumber })),
        rentedAddresses: nonnegativeInteger,
        knownRentable: nonnegativeInteger,
        rentShare: nonnegativeNumber,
    }),
    captcha: (value) => value === null || requiredFields(value, { word: captchaWord }),
    favorites: arrayOf(text),
    history: arrayOf(text),
    homePage: text,
    visitedLevels: recordOf(positiveInteger),
};

export function serializeSave(state: GameState, savedAt: number): string {
    const save: RawSave = { version: currentSaveVersion, savedAt, state };
    return JSON.stringify(save);
}

export function parseSave(serialized: string, defaults: GameState): SaveEnvelope {
    const rawSave = parseRawSave(serialized);
    if (rawSave.version !== currentSaveVersion) {
        const message = rawSave.version > currentSaveVersion ? saveErrorText.newerVersion : saveErrorText.olderVersion;
        throw new SaveError(message.replace('{version}', String(rawSave.version)));
    }
    validateState(rawSave.state);
    return {
        version: currentSaveVersion,
        savedAt: rawSave.savedAt,
        state: mergeWithDefaults(rawSave.state, defaults),
    };
}

export function exportSave(state: GameState): string {
    return encodeExport(serializeSave(state, Date.now()));
}

export function importSave(exported: string, defaults: GameState): GameState {
    return parseSave(decodeExport(exported), defaults).state;
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
        throw new SaveError(saveErrorText.incomplete);
    }
    const base64 = trimmed.slice(exportPrefix.length, -exportSuffix.length);
    try {
        return new TextDecoder().decode(base64ToBytes(base64));
    } catch {
        throw new SaveError(saveErrorText.damaged);
    }
}

function parseRawSave(serialized: string): RawSave {
    let parsed: unknown;
    try {
        parsed = JSON.parse(serialized);
    } catch {
        throw new SaveError(saveErrorText.notJson);
    }
    if (
        !isPlainObject(parsed) ||
        !positiveInteger(parsed.version) ||
        !nonnegativeNumber(parsed.savedAt) ||
        !isPlainObject(parsed.state)
    ) {
        throw new SaveError(saveErrorText.missingFields);
    }
    return { version: parsed.version, savedAt: parsed.savedAt, state: parsed.state };
}

function validateState(value: unknown): void {
    if (!isPlainObject(value)) {
        throw new SaveError(saveErrorText.invalidState);
    }
    for (const [key, check] of Object.entries(stateChecks)) {
        if (Object.hasOwn(value, key) && !check(value[key])) {
            throw new SaveError(saveErrorText.invalidField.replace('{field}', key));
        }
    }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

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

function optionalFields(value: unknown, checks: Readonly<Record<string, ValueCheck>>): boolean {
    return isPlainObject(value) && Object.entries(checks).every(([key, check]) => !Object.hasOwn(value, key) || check(value[key]));
}

function requiredFields(value: unknown, checks: Readonly<Record<string, ValueCheck>>): boolean {
    return isPlainObject(value) && Object.entries(checks).every(([key, check]) => Object.hasOwn(value, key) && check(value[key]));
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
