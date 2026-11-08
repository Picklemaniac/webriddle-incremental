import { defineConfig } from 'vitest/config';
import { devLogEndpoint } from './tools/dev-log-endpoint.ts';

export default defineConfig({
    plugins: [devLogEndpoint('logs')],
    build: {
        target: 'es2023',
    },
    test: {
        include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
    },
});
