import { appendFile, mkdir } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Plugin } from 'vite';

interface LogBatch {
    readonly sessionId: string;
    readonly lines: readonly string[];
}

const sessionIdPattern = /^[\w-]+$/;

export function devLogEndpoint(directory: string): Plugin {
    return {
        name: 'dev-log-endpoint',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use('/__log', (request, response) => {
                void writeLogBatch(request, response, directory);
            });
        },
    };
}

async function writeLogBatch(request: IncomingMessage, response: ServerResponse, directory: string): Promise<void> {
    if (request.method !== 'POST') {
        response.statusCode = 405;
        response.end();
        return;
    }
    try {
        const batch = parseLogBatch(await readBody(request));
        await mkdir(directory, { recursive: true });
        const text = batch.lines.map((line) => `${line}\n`).join('');
        await appendFile(path.join(directory, `${batch.sessionId}.jsonl`), text);
        response.statusCode = 204;
    } catch {
        response.statusCode = 400;
    }
    response.end();
}

function parseLogBatch(body: string): LogBatch {
    const parsed: unknown = JSON.parse(body);
    if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('sessionId' in parsed) ||
        !('lines' in parsed) ||
        typeof parsed.sessionId !== 'string' ||
        !sessionIdPattern.test(parsed.sessionId) ||
        !Array.isArray(parsed.lines) ||
        !parsed.lines.every((line) => typeof line === 'string')
    ) {
        throw new Error('Malformed log batch.');
    }
    return { sessionId: parsed.sessionId, lines: parsed.lines };
}

function readBody(request: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        request.on('data', (chunk: Buffer) => chunks.push(chunk));
        request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        request.on('error', reject);
    });
}
