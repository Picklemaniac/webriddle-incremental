import type { GameState } from '../core/state.ts';
import { saveMigrations } from './migrations.ts';

export const currentSaveVersion = 1;

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
    if (isPlainObject(saved) && isPlainObject(defaults)) {
        const merged: Record<string, unknown> = structuredClone(defaults);
        for (const [key, savedValue] of Object.entries(saved)) {
            merged[key] = key in defaults ? mergeWithDefaults(savedValue, defaults[key]) : savedValue;
        }
        return merged as Value;
    }
    return typeof saved === typeof defaults ? (saved as Value) : structuredClone(defaults);
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
        typeof parsed.version !== 'number' ||
        typeof parsed.savedAt !== 'number' ||
        !isPlainObject(parsed.state)
    ) {
        throw new SaveError('The save data is missing required fields.');
    }
    return { version: parsed.version, savedAt: parsed.savedAt, state: parsed.state };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
