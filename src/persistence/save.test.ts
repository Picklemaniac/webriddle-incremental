import { describe, expect, it } from 'vitest';
import { createInitialState } from '../core/state.ts';
import { MemoryStorage } from '../testing/memory-storage.ts';
import { testContent } from '../testing/test-content.ts';
import {
    currentSaveVersion,
    decodeExport,
    encodeExport,
    mergeWithDefaults,
    migrateSave,
    parseSave,
    SaveError,
    serializeSave,
    type RawSave,
} from './save.ts';
import { SaveSlots } from './save-slots.ts';

const defaults = createInitialState(testContent, 1);

function appendMigrationStep(step: string): (save: RawSave) => RawSave {
    return (save) => {
        const { steps = [] } = save.state as { steps?: string[] };
        return { ...save, state: { steps: [...steps, step] } };
    };
}

describe('save format', () => {
    it('round-trips a game state', () => {
        const state = { ...defaults, currentLevel: 42, purchases: { booster: 1 } };
        const envelope = parseSave(serializeSave(state, 1_000), defaults);
        expect(envelope.state).toEqual(state);
        expect(envelope.savedAt).toBe(1_000);
    });

    it('round-trips through the export string', () => {
        const serialized = serializeSave({ ...defaults, browserUrl: 'http://riddle.example/ünïcode.htm' }, 1_000);
        expect(decodeExport(encodeExport(serialized))).toBe(serialized);
    });

    it('rejects an export string that was cut off', () => {
        const exported = encodeExport(serializeSave(defaults, 1_000));
        expect(() => decodeExport(exported.slice(0, -10))).toThrow(SaveError);
    });

    it('rejects saves from a newer version', () => {
        const futureSave = JSON.stringify({ version: currentSaveVersion + 1, savedAt: 0, state: defaults });
        expect(() => parseSave(futureSave, defaults)).toThrow(SaveError);
    });

    it('applies migrations in order', () => {
        const migrations = [
            { fromVersion: 2, migrate: appendMigrationStep('two to three') },
            { fromVersion: 1, migrate: appendMigrationStep('one to two') },
        ];
        const migrated = migrateSave({ version: 1, savedAt: 0, state: {} }, migrations, 3);
        expect(migrated).toEqual({ version: 3, savedAt: 0, state: { steps: ['one to two', 'two to three'] } });
    });

    it('fills in fields that older saves lack', () => {
        const merged = mergeWithDefaults({ currentLevel: 7, purchases: { booster: 1 } }, defaults);
        expect(merged.currentLevel).toBe(7);
        expect(merged.purchases).toEqual({ booster: 1 });
        expect(merged.resources).toEqual(defaults.resources);
    });
});

describe('SaveSlots', () => {
    it('lists only its own slots', () => {
        const storage = new MemoryStorage();
        storage.setItem('unrelated', 'value');
        const saveSlots = new SaveSlots(storage, 'game:');
        saveSlots.write('beta', defaults, 0);
        saveSlots.write('alpha', defaults, 0);
        expect(saveSlots.slotNames()).toEqual(['alpha', 'beta']);
    });
});
