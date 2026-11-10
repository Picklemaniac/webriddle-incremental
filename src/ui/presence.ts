import { isAway } from '../content/act-one/economy.ts';
import type { Game } from '../core/game.ts';
import type { OfflineSummary } from '../core/offline.ts';

interface Snapshot {
    readonly elapsedSeconds: number;
    readonly level: number;
    readonly resources: Readonly<Record<string, number>>;
}

const presentAfterInputMilliseconds = 30_000;
const refreshSeconds = 60;
const inputEvents: readonly string[] = ['pointermove', 'pointerdown', 'keydown', 'wheel'];

export class Presence {
    private readonly game: Game;
    private readonly onReturn: (summary: OfflineSummary) => void;
    private lastInputAt = Number.NEGATIVE_INFINITY;
    private pointerPosition = '';
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
            if (event.type === 'offlineProgressApplied' || event.type === 'stateReplaced') this.seen = this.snapshot();
        });
    }

    noticeInput(): void {
        this.lastInputAt = performance.now();
        if (isAway(this.game.state)) this.checkIn();
    }

    // Game time can run much faster than real time in the dev tools, so presence is refreshed in game time while the player was active a moment ago.
    update(): void {
        const { elapsedSeconds, statistics } = this.game.state;
        const activeJustNow = performance.now() - this.lastInputAt < presentAfterInputMilliseconds;
        if (activeJustNow && elapsedSeconds - (statistics.lastSeenAt ?? 0) >= refreshSeconds) this.checkIn();
    }

    private checkIn(): void {
        if (isAway(this.game.state)) this.onReturn(this.summary());
        this.game.dispatch({ type: 'checkIn' });
        this.seen = this.snapshot();
    }

    private watch(target: Document): void {
        for (const type of inputEvents) target.addEventListener(type, (event) => this.onInput(event), { capture: true, passive: true });
    }

    private onInput(event: Event): void {
        if (event instanceof PointerEvent && event.type === 'pointermove') {
            // Browsers repeat the last pointer position when the page changes under a resting cursor. That is not the player.
            const position = `${event.screenX},${event.screenY}`;
            if (position === this.pointerPosition) return;
            this.pointerPosition = position;
        }
        this.noticeInput();
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
