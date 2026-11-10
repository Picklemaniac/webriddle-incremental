import './ui/styles.css';
import './ui/browser.css';
import './ui/dashboard.css';
import './ui/onboarding.css';
import { GameLoop } from './app/game-loop.ts';
import { gameContent } from './content/index.ts';
import { Game } from './core/game.ts';
import { createInitialState, randomSeed } from './core/state.ts';
import { autosaveSlotName, SaveSlots } from './persistence/save-slots.ts';
import { GameScreen } from './ui/game-screen.ts';
import { Presence } from './ui/presence.ts';

const autosaveIntervalMilliseconds = 30_000;
const minimumAwaySecondsForSummary = 60;

const saveSlots = new SaveSlots(localStorage, 'webriddle-incremental:');
const { game, awaySeconds } = loadOrCreateGame();
const screen = new GameScreen(game);
const presence = new Presence(game, (summary) => screen.showAwaySummary(summary));
const loop = new GameLoop(game, {
    render: () => {
        presence.update();
        screen.render();
    },
    resumeAfterAbsence: (seconds) => catchUp(seconds),
});

mountScreen();
catchUp(awaySeconds);
presence.noticeInput();
startAutosave();

if (import.meta.env.DEV) {
    const { startDevTools } = await import('./dev/dev-tools.ts');
    startDevTools({ game, loop, saveSlots, screen });
}

loop.start();

function loadOrCreateGame(): { game: Game; awaySeconds: number } {
    const defaults = createInitialState(gameContent, randomSeed());
    try {
        const envelope = saveSlots.read(autosaveSlotName, defaults);
        if (envelope !== undefined) {
            return { game: new Game(gameContent, envelope.state), awaySeconds: (Date.now() - envelope.savedAt) / 1000 };
        }
    } catch (error) {
        console.error('The autosave could not be loaded, so a new game was started. The old save was kept.', error);
        keepUnreadableAutosave();
    }
    return { game: new Game(gameContent, defaults), awaySeconds: 0 };
}

function keepUnreadableAutosave(): void {
    const serialized = saveSlots.readSerialized(autosaveSlotName);
    if (serialized !== undefined) {
        saveSlots.writeSerialized(`unreadable-${Date.now()}`, serialized);
    }
}

function catchUp(seconds: number): void {
    const summary = game.catchUp(seconds);
    if (seconds >= minimumAwaySecondsForSummary) {
        screen.showAwaySummary(summary);
    }
}

function mountScreen(): void {
    const root = document.querySelector('#game');
    if (root === null) {
        throw new Error('The page has no #game element to mount the game in.');
    }
    root.append(screen.element);
}

function startAutosave(): void {
    const autosave = (): void => saveSlots.write(autosaveSlotName, game.state, Date.now());
    setInterval(autosave, autosaveIntervalMilliseconds);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            autosave();
        }
    });
    addEventListener('pagehide', autosave);
}
