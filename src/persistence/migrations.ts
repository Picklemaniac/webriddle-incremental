import type { SaveMigration } from './save.ts';

const bytesPerWord = 150;

export const saveMigrations: readonly SaveMigration[] = [
    {
        fromVersion: 1,
        migrate: (save) => ({ ...save, state: {} }),
    },
    {
        fromVersion: 2,
        migrate: (save) => ({
            ...save,
            state: JSON.parse(JSON.stringify(save.state)
                .replaceAll('http://riddle.example', 'http://www.notfinite.net')
                .replaceAll('http://home.enigmaweb.example/', 'http://www.enigmaweb.net/')) as unknown,
        }),
    },
    {
        fromVersion: 3,
        migrate: (save) => {
            const state = { ...(save.state as Record<string, unknown>) };
            delete state.cooldowns;
            if (isRecord(state.resources) && typeof state.resources.words === 'number') {
                const { words, ...resources } = state.resources;
                state.resources = { ...resources, data: words * bytesPerWord };
            }
            if (isRecord(state.flags) && 'wordsRevealed' in state.flags) {
                const { wordsRevealed, ...flags } = state.flags;
                state.flags = { ...flags, dataRevealed: wordsRevealed };
            }
            return { ...save, state };
        },
    },
];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
