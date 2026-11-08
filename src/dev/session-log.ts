export class SessionLog {
    readonly sessionId: string;
    private readonly endpoint: string;
    private pendingLines: string[] = [];
    private paused = false;

    constructor(endpoint: string) {
        this.endpoint = endpoint;
        this.sessionId = localTimestamp(new Date());
    }

    record(type: string, gameSeconds: number, details: Readonly<Record<string, unknown>> = {}): void {
        if (this.paused) {
            return;
        }
        const entry = { realTime: new Date().toISOString(), gameSeconds: Math.round(gameSeconds), type, ...details };
        this.pendingLines.push(JSON.stringify(entry));
    }

    withoutRecording<Result>(work: () => Result): Result {
        this.paused = true;
        try {
            return work();
        } finally {
            this.paused = false;
        }
    }

    flush(): void {
        if (this.pendingLines.length === 0) {
            return;
        }
        const body = JSON.stringify({ sessionId: this.sessionId, lines: this.pendingLines });
        this.pendingLines = [];
        fetch(this.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(
            (error: unknown) => console.warn('The session log could not be written.', error),
        );
    }
}

function localTimestamp(date: Date): string {
    const pad = (value: number): string => String(value).padStart(2, '0');
    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    return `${day}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}
