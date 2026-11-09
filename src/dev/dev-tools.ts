import type { GameLoop } from '../app/game-loop.ts';
import type { Game } from '../core/game.ts';
import { createInitialState, randomSeed, type GameState } from '../core/state.ts';
import { formatDuration } from '../format.ts';
import { autosaveSlotName, type SaveSlots } from '../persistence/save-slots.ts';
import { exportSave, importSave } from '../persistence/save.ts';
import { AutoPlayer } from '../simulation/auto-player.ts';
import { actOneStrategy } from '../simulation/act-one-strategy.ts';
import { urlOfLevel } from '../content/act-one/levels.ts';
import { isTextField } from '../ui/dom.ts';
import type { GameScreen } from '../ui/game-screen.ts';
import { DevPanel, type DevCommands } from './dev-panel.ts';
import { SessionLog } from './session-log.ts';

export interface DevToolsContext {
    readonly game: Game;
    readonly loop: GameLoop;
    readonly saveSlots: SaveSlots;
    readonly screen: GameScreen;
}

const logEndpoint = '/__log';
const logFlushIntervalMilliseconds = 5_000;
const snapshotIntervalMilliseconds = 30_000;
const maximumSkipSeconds = 30 * 86_400;

export function startDevTools(context: DevToolsContext): void {
    const { game } = context;
    const log = new SessionLog(logEndpoint);
    game.subscribe(({ type, ...details }) => log.record(type, game.state.elapsedSeconds, { ...details, level: game.state.currentLevel }));
    log.record('sessionStarted', game.state.elapsedSeconds, { level: game.state.currentLevel });
    setInterval(() => recordSnapshot(game, log), snapshotIntervalMilliseconds);
    setInterval(() => log.flush(), logFlushIntervalMilliseconds);
    addEventListener('pagehide', () => log.flush());

    const panel = new DevPanel(game.content, createCommands(context, log));
    document.body.append(panel.element);
    addEventListener('keydown', (event) => {
        if (event.key === '\\' && !isTextField(event.target)) {
            event.preventDefault();
            panel.toggle();
        }
    });
    console.info(`Dev tools ready: press \\ to toggle. Session log: logs/${log.sessionId}.jsonl`);
}

function createCommands({ game, loop, saveSlots, screen }: DevToolsContext, log: SessionLog): DevCommands {
    const record = (type: string, details: Readonly<Record<string, unknown>> = {}): void =>
        log.record(type, game.state.elapsedSeconds, details);
    const defaults = (): GameState => createInitialState(game.content, game.state.randomState);

    return {
        setTimeScale(timeScale) {
            loop.timeScale = timeScale;
            record('devTimeScale', { timeScale });
        },
        advance(seconds) {
            record('devTimeAway', { seconds });
            screen.showAwaySummary(game.catchUp(seconds));
        },
        skipToMilestone(milestoneId) {
            const isReached = (): boolean => game.state.reachedMilestones[milestoneId] !== undefined;
            const autoPlayer = new AutoPlayer(actOneStrategy(4));
            const playedSeconds = log.withoutRecording(() => autoPlayer.playUntil(game, isReached, maximumSkipSeconds));
            record('devSkip', { milestoneId, playedSeconds, reached: isReached(), purchases: game.state.purchases });
            return isReached()
                ? `Reached after ${formatDuration(playedSeconds)} of simulated active play.`
                : `Not reached within ${formatDuration(maximumSkipSeconds)} of simulated play.`;
        },
        setResource(resourceId, amount) {
            if (!Number.isFinite(amount) || amount < 0) throw new Error('Enter a finite, non-negative amount.');
            game.state.resources[resourceId] = amount;
            record('devSetResource', { resourceId, amount });
        },
        setLevel(level) {
            if (!Number.isSafeInteger(level) || level < 1 || level > 100000) throw new Error('Choose a level from 1 to 100000.');
            game.state.currentLevel = level;
            game.state.browserUrl = urlOfLevel(level);
            game.state.visitedLevels[game.state.browserUrl] = level;
            game.state.search = { requestsSpent: 0, configuration: '' };
            game.state.captcha = null;
            game.state.network.bannedUntil = 0;
            game.state.network.heat = 0;
            record('devSetLevel', { level });
        },
        saveSlot(slotName) {
            saveSlots.write(slotName, game.state, Date.now());
            record('devSaveSlot', { slotName });
        },
        loadSlot(slotName) {
            const envelope = saveSlots.read(slotName, defaults());
            if (envelope === undefined) {
                throw new Error(`There is no slot named "${slotName}".`);
            }
            game.replaceState(envelope.state);
            record('devLoadSlot', { slotName });
        },
        slotNames: () => saveSlots.slotNames(),
        exportSave: () => exportSave(game.state),
        importSave(exported) {
            game.replaceState(importSave(exported, defaults()));
            record('devImport');
        },
        resetGame() {
            saveSlots.remove(autosaveSlotName);
            game.replaceState(createInitialState(game.content, randomSeed()));
            record('devReset');
        },
    };
}

function recordSnapshot(game: Game, log: SessionLog): void {
    const { currentLevel, levelProgress, resources, purchases, jobs, network, findings, statistics } = game.state;
    log.record('snapshot', game.state.elapsedSeconds, { currentLevel, levelProgress, resources, purchases, jobs, network, findings, statistics });
}
