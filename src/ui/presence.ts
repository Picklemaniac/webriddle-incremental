import { isAway } from '../content/act-one/economy.ts';
import type { Game } from '../core/game.ts';
import type { OfflineSummary } from '../core/offline.ts';

interface Snapshot {
    readonly elapsedSeconds: number;
    readonly level: number;
    readonly resources: Readonly<Record<string, number>>;
}

const checkInMilliseconds = 15_000;
const inputEvents: readonly string[] = ['pointermove', 'pointerdown', 'keydown', 'wheel'];

export class Presence {
    private readonly game: Game;
    private readonly onReturn: (summary: OfflineSummary) => void;
    private lastCheckInAt = Number.NEGATIVE_INFINITY;
    private seen: Snapshot;

    constructor(game: Game, onReturn: (summary: OfflineSummary) => void) {
        this.game = game;
        this.onReturn = onReturn;
        this.seen = this.snapshot();
        this.watch(document);
        // Input inside the riddle page never reaches this document, so every page that loads in the browser frame is watched too.
        document.addEventListener('load', (event) => {
            const page = event.target instanceof HTMLIFrameElement ? event.target.contentDocument : null;
            if (page !== null) this.watch(page);
        }, true);
        game.subscribe((event) => {
            if (event.type !== 'offlineProgressApplied' && event.type !== 'stateReplaced') return;
            this.seen = this.snapshot();
            this.lastCheckInAt = Number.NEGATIVE_INFINITY;
        });
    }

    checkIn(): void {
        this.lastCheckInAt = performance.now();
        if (isAway(this.game.state)) this.onReturn(this.summary());
        this.game.dispatch({ type: 'checkIn' });
        this.seen = this.snapshot();
    }

    private watch(target: Document): void {
        for (const type of inputEvents) {
            target.addEventListener(type, () => { if (performance.now() - this.lastCheckInAt >= checkInMilliseconds) this.checkIn(); }, { capture: true, passive: true });
        }
    }

    private snapshot(): Snapshot {
        const { elapsedSeconds, currentLevel, resources } = this.game.state;
        return { elapsedSeconds, level: currentLevel, resources: { ...resources } };
    }

    private summary(): OfflineSummary {
        const { state } = this.game;
        const awaySeconds = state.elapsedSeconds - this.seen.elapsedSeconds;
        return {
            awaySeconds,
            simulatedSeconds: awaySeconds,
            levelsGained: state.currentLevel - this.seen.level,
            resourceGains: Object.fromEntries(Object.entries(state.resources).map(([id, amount]) => [id, amount - (this.seen.resources[id] ?? 0)])),
        };
    }
}
