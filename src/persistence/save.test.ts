import { describe, expect, it } from 'vitest';
import { Game } from '../core/game.ts';
import { createInitialState } from '../core/state.ts';
import { MemoryStorage } from '../testing/memory-storage.ts';
import { saveMigrations } from './migrations.ts';
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

    it('moves stored addresses from the placeholder domains to Notfinite and Enigma Web', () => {
        const save = { version: 2, savedAt: 0, state: {
            browserUrl: 'http://riddle.example/level2.htm',
            visitedLevels: { 'http://riddle.example/level2.htm': 2 },
            favorites: ['http://home.enigmaweb.example/'],
        } };
        expect(migrateSave(save, saveMigrations, 3).state).toEqual({
            browserUrl: 'http://www.notfinite.net/level2.htm',
            visitedLevels: { 'http://www.notfinite.net/level2.htm': 2 },
            favorites: ['http://www.enigmaweb.net/'],
        });
    });

    it('turns words into bytes of data and drops the old click cooldowns', () => {
        const save = { version: 3, savedAt: 0, state: {
            resources: { insight: 4, words: 1000 },
            flags: { insightRevealed: true, wordsRevealed: true },
            cooldowns: { work: 12 },
        } };
        expect(migrateSave(save, saveMigrations, 4).state).toEqual({
            resources: { insight: 4, data: 150_000 },
            flags: { insightRevealed: true, dataRevealed: true },
        });
    });

    it('keeps only the word of an old image or checkbox captcha', () => {
        const save = { version: 4, savedAt: 0, state: { captcha: { kind: 'images', stage: 'checkbox', subject: 'bridge', imageIds: [1], correctTiles: [0], word: 'apple' } } };
        expect(migrateSave(save, saveMigrations, 5).state).toEqual({ captcha: { word: 'apple' } });
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

    it('fills in missing nested fields while preserving valid saved values', () => {
        const save = JSON.stringify({
            version: currentSaveVersion,
            savedAt: 0,
            state: { currentLevel: 7, search: { requestsSpent: 125 }, network: { heat: 10 } },
        });
        const state = parseSave(save, defaults).state;
        expect(state).toEqual({
            ...defaults,
            currentLevel: 7,
            search: { ...defaults.search, requestsSpent: 125 },
            network: { ...defaults.network, heat: 10 },
        });
        expect(state.pendingTickSeconds).toBe(0);
    });

    it('migrates obsolete sandbox saves before validating the new state', () => {
        const save = JSON.stringify({ version: 1, savedAt: 0, state: { currentLevel: 'obsolete', network: null } });
        expect(parseSave(save, defaults).state).toEqual(defaults);
    });

    it.each([
        ['null network', { network: null }],
        ['object proxies', { network: { proxies: {} } }],
        ['incomplete proxy', { network: { proxies: [{ address: '192.0.2.1:8000' }] } }],
        ['negative proxy lifetime', { network: { proxies: [{ address: '192.0.2.1:8000', latencyMilliseconds: 20, diesAtSeconds: -1 }] } }],
        ['object favorites', { favorites: {} }],
        ['non-string favorite', { favorites: [123] }],
        ['string resource', { resources: { points: '10' } }],
        ['negative resource', { resources: { points: -1 } }],
        ['fractional worker count', { jobs: { ticketing: 0.5 } }],
        ['negative finding count', { findings: { robots: -1 } }],
        ['fractional purchase count', { purchases: { booster: 0.5 } }],
        ['non-boolean flag', { flags: { automated: 'yes' } }],
        ['zero current level', { currentLevel: 0 }],
        ['zero visited level', { visitedLevels: { 'http://riddle.example/': 0 } }],
        ['negative search progress', { search: { requestsSpent: -1 } }],
        ['numeric activity', { activity: 3 }],
        ['string statistic', { statistics: { requestsSent: 'a lot' } }],
        ['negative milestone time', { reachedMilestones: { automated: -1 } }],
        ['negative pending tick', { pendingTickSeconds: -0.1 }],
        ['incomplete captcha', { captcha: { kind: 'text', stage: 'challenge' } }],
    ])('rejects %s before replacing the running game', (_description, state) => {
        const game = new Game(testContent, structuredClone(defaults));
        const before = structuredClone(game.state);
        const save = JSON.stringify({ version: currentSaveVersion, savedAt: 0, state });
        expect(() => game.replaceState(parseSave(save, defaults).state)).toThrow(SaveError);
        expect(game.state).toEqual(before);
    });

    it('rejects overflowing numeric values in JSON', () => {
        const save = '{"version":2,"savedAt":0,"state":{"resources":{"points":1e309}}}';
        expect(() => parseSave(save, defaults)).toThrow(SaveError);
    });

    it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid save version %s', (version) => {
        expect(() => parseSave(JSON.stringify({ version, savedAt: 0, state: {} }), defaults)).toThrow(SaveError);
    });

    it.each([-1, NaN, Infinity])('rejects invalid save timestamp %s', (savedAt) => {
        expect(() => parseSave(JSON.stringify({ version: currentSaveVersion, savedAt, state: {} }), defaults)).toThrow(SaveError);
    });

    it('round-trips a captcha, proxies, favorites, and signed random state', () => {
        const state = structuredClone(defaults);
        state.randomState = -123456;
        state.network = {
            heat: 100,
            bannedUntil: 90,
            proxies: [{ address: '192.0.2.1:8000', latencyMilliseconds: 60, diesAtSeconds: 360 }],
        };
        state.favorites = ['http://riddle.example/level1.htm'];
        state.captcha = { word: 'apple' };
        expect(parseSave(serializeSave(state, 0), defaults).state).toEqual(state);
    });

    it('rejects a captcha without a word', () => {
        for (const invalid of [{}, { word: '' }, { word: 5 }]) {
            const save = JSON.stringify({ version: currentSaveVersion, savedAt: 0, state: { captcha: invalid } });
            expect(() => parseSave(save, defaults)).toThrow(SaveError);
        }
    });

    it('merges objects, arrays, and null without accepting incompatible shapes or sharing references', () => {
        expect(mergeWithDefaults(null, { heat: 0 })).toEqual({ heat: 0 });
        expect(mergeWithDefaults({}, ['favorite'])).toEqual(['favorite']);
        expect(mergeWithDefaults([], { heat: 0 })).toEqual({ heat: 0 });
        expect(mergeWithDefaults([], null)).toBeNull();
        const saved = { favorites: ['first'], captcha: { kind: 'text' } };
        const merged = mergeWithDefaults(saved, { favorites: [] as string[], captcha: null as { kind: string } | null });
        saved.favorites.push('second');
        saved.captcha.kind = 'images';
        expect(merged).toEqual({ favorites: ['first'], captcha: { kind: 'text' } });
    });

    it('preserves unknown own fields without changing the merged object prototype', () => {
        const merged = mergeWithDefaults(JSON.parse('{"__proto__":{"custom":true},"currentLevel":7}'), defaults);
        expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
        expect(Object.hasOwn(merged, '__proto__')).toBe(true);
        expect(merged.currentLevel).toBe(7);
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
