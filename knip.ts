import type { KnipConfig } from 'knip';

export default {
    entry: ['tools/build-assets.ts'],
    project: ['src/**/*.{ts,css}', 'tools/**/*.{ts,mjs}'],
    vitest: {
        config: ['vite.config.ts'],
        entry: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
    },
    compilers: {
        css: (source: string) => [...source.matchAll(/@import\s+(?:url\(\s*)?(['"])([^'"]+)\1/g)]
            .map((match) => `import ${JSON.stringify(match[2])};`).join('\n'),
    },
} satisfies KnipConfig;
