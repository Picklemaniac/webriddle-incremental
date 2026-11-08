import type { SaveMigration } from './save.ts';

export const saveMigrations: readonly SaveMigration[] = [
    {
        fromVersion: 1,
        migrate: (save) => ({ ...save, state: {} }),
    },
];
