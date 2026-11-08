import type { Game } from '../core/game.ts';

const tickSeconds = 0.05;
const renderIntervalMilliseconds = 1000 / 15;
const absenceThresholdSeconds = 300;

export interface GameLoopCallbacks {
    render(): void;
    resumeAfterAbsence(awaySeconds: number): void;
}

export class GameLoop {
    timeScale = 1;
    private readonly game: Game;
    private readonly callbacks: GameLoopCallbacks;
    private lastUpdateTime = 0;
    private accumulatedSeconds = 0;
    private lastRenderTime = 0;

    constructor(game: Game, callbacks: GameLoopCallbacks) {
        this.game = game;
        this.callbacks = callbacks;
    }

    start(): void {
        this.lastUpdateTime = Date.now();
        setInterval(() => this.update(), tickSeconds * 1000);
        requestAnimationFrame((timestamp) => this.renderFrame(timestamp));
    }

    private update(): void {
        const now = Date.now();
        const realSeconds = Math.max(0, (now - this.lastUpdateTime) / 1000);
        this.lastUpdateTime = now;
        if (realSeconds > absenceThresholdSeconds) {
            this.callbacks.resumeAfterAbsence(realSeconds);
            return;
        }
        this.accumulatedSeconds += realSeconds * this.timeScale;
        const stepCount = Math.floor(this.accumulatedSeconds / tickSeconds);
        if (stepCount > 0) {
            const seconds = stepCount * tickSeconds;
            this.accumulatedSeconds -= seconds;
            this.game.advance(seconds, Math.min(1, tickSeconds * this.timeScale));
        }
    }

    private renderFrame(timestamp: number): void {
        if (timestamp - this.lastRenderTime >= renderIntervalMilliseconds) {
            this.lastRenderTime = timestamp;
            this.callbacks.render();
        }
        requestAnimationFrame((nextTimestamp) => this.renderFrame(nextTimestamp));
    }
}
