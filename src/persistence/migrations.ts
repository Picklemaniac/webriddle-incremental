import type { SaveMigration } from './save.ts';

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
];
