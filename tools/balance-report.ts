import { actOneContent } from '../src/content/act-one/index.ts';
import { entrance } from '../src/content/act-one/levels.ts';
import { offeredUpgrades, upgrades } from '../src/content/act-one/upgrades.ts';
import { isUpgradeRevealed, owns } from '../src/content/act-one/progress.ts';
import { Game } from '../src/core/game.ts';
import { createInitialState } from '../src/core/state.ts';
import { formatDuration, formatNumber } from '../src/format.ts';
import { actOneStrategy, type PlayStyle } from '../src/simulation/act-one-strategy.ts';
import { AutoPlayer } from '../src/simulation/auto-player.ts';
import { withHabits, type Habits } from '../src/simulation/habits.ts';
import { readArgument } from './shared.ts';

interface Player {
    readonly name: string;
    readonly habits: Habits;
    readonly style?: PlayStyle;
    readonly reactionSeconds?: number;
}

interface Run {
    readonly game: Game;
    readonly reached: Readonly<Record<number, number>>;
    readonly bans: number;
    readonly purchases: number;
    readonly longestPurchaseWait: number;
    readonly nothingOnOffer: number;
    readonly slowLevels: readonly { readonly level: number; readonly seconds: number }[];
}

const seed = Number(readArgument('--seed') ?? '1');
const longestRunSeconds = 10 * 3600;
const slowLevelSeconds = 240;
const marks: readonly number[] = [100, 500, 1000];

const players: readonly Player[] = [
    { name: 'attentive robot', habits: {} },
    { name: 'never solves by hand', habits: { solvesByHand: false } },
    { name: 'looks every 30 seconds', habits: {}, reactionSeconds: 30 },
    { name: 'waits out every ban', habits: { captchaSeconds: null } },
    { name: 'never replaces proxies', habits: { replacesProxies: false } },
    { name: 'never assigns scripts', habits: { assignsScripts: false } },
    { name: 'rent every 10 minutes', habits: { rentEverySeconds: 600 } },
    { name: 'rent slider untouched', habits: {}, style: 'handsOff' },
    { name: 'rents every IP', habits: { rentedShare: 1 } },
    { name: 'casual', habits: { solvesByHand: false, captchaSeconds: 25, rentEverySeconds: 600 }, reactionSeconds: 30 },
];

function robotFor(player: Player): AutoPlayer {
    return new AutoPlayer(withHabits(actOneStrategy(player.reactionSeconds ?? 4, player.style), player.habits));
}

function play(player: Player): Run {
    const game = new Game(actOneContent, createInitialState(actOneContent, seed));
    const robot = robotFor(player);
    const reached: Record<number, number> = {};
    const slowLevels: { level: number; seconds: number }[] = [];
    let bans = 0;
    let purchases = 0;
    let lastPurchaseAt: number | undefined;
    let lastSolveAt = 0;
    let longestPurchaseWait = 0;
    let nothingOnOffer = 0;
    game.subscribe((event) => {
        const { elapsedSeconds } = game.state;
        if (event.type === 'banned') bans++;
        if (event.type === 'actionApplied' && event.action.type === 'purchase') {
            purchases++;
            if (lastPurchaseAt !== undefined) longestPurchaseWait = Math.max(longestPurchaseWait, elapsedSeconds - lastPurchaseAt);
            lastPurchaseAt = elapsedSeconds;
        }
        if (event.type === 'levelSolved') {
            if (elapsedSeconds - lastSolveAt >= slowLevelSeconds && event.level > 10) slowLevels.push({ level: event.level, seconds: elapsedSeconds - lastSolveAt });
            lastSolveAt = elapsedSeconds;
        }
    });
    while (game.state.currentLevel < 1000 && game.state.elapsedSeconds < longestRunSeconds) {
        robot.playStep(game, 1);
        for (const mark of marks) if (reached[mark] === undefined && game.state.currentLevel >= mark) reached[mark] = game.state.elapsedSeconds;
        if (game.state.flags.upgradesRevealed === true && !offeredUpgrades(game).some((item) => isUpgradeRevealed(game.state, item.id))) nothingOnOffer++;
    }
    return { game, reached, bans, purchases, longestPurchaseWait, nothingOnOffer, slowLevels };
}

function row(cells: readonly (string | number)[], widths: readonly number[]): string {
    return cells.map((cell, index) => String(cell).padEnd(widths[index] ?? 0)).join(' ');
}

function reportPlayers(): void {
    const widths = [24, 9, 9, 9, 7, 6, 12, 20, 13, 9];
    console.log(row(['player', 'L100', 'L500', 'L1000', 'cards', 'bans', 'longest wait', 'levels over 4 min', 'nothing to buy', 'money left'], widths));
    for (const player of players) {
        const run = play(player);
        const time = (level: number): string => (run.reached[level] === undefined ? `L${run.game.state.currentLevel}` : formatDuration(run.reached[level]));
        const slowest = run.slowLevels.reduce((longest, entry) => Math.max(longest, entry.seconds), 0);
        console.log(row([
            player.name, time(100), time(500), time(1000), run.purchases, run.bans, formatDuration(run.longestPurchaseWait),
            run.slowLevels.length === 0 ? 'none' : `${run.slowLevels.length}, longest ${formatDuration(slowest)}`,
            formatDuration(run.nothingOnOffer), `$${formatNumber(run.game.state.resources.money ?? 0)}`,
        ], widths));
    }
}

function reportSlowLevels(): void {
    const run = play({ name: 'never solves by hand', habits: { solvesByHand: false } });
    console.log(`\nLevels that take over ${slowLevelSeconds / 60} minutes for a player who never solves by hand:`);
    for (const { level, seconds } of run.slowLevels) console.log(`  level ${level}: ${formatDuration(seconds)}, ${entrance(level).kind}`);
    if (run.slowLevels.length === 0) console.log('  none');
}

function reportBreaks(): void {
    const widths = [8, 8, 22, 24, 16];
    console.log('\nComing back after a break:');
    console.log(row(['played', 'away', 'levels while away', 'money while away', 'cards waiting'], widths));
    for (const playMinutes of [20, 75, 150]) {
        for (const awayHours of [2, 8]) {
            const game = new Game(actOneContent, createInitialState(actOneContent, seed));
            robotFor(players[0]!).playUntil(game, () => false, playMinutes * 60);
            const before = { level: game.state.currentLevel, money: game.state.resources.money ?? 0 };
            game.catchUp(awayHours * 3600);
            const waiting = upgrades.filter((item) => !owns(game.state, item.id) && item.isAvailable(game.state)).length;
            console.log(row([
                `${playMinutes} min`, `${awayHours} h`, `${before.level} to ${game.state.currentLevel}`,
                `$${formatNumber(before.money)} to $${formatNumber(game.state.resources.money ?? 0)}`, waiting,
            ], widths));
        }
    }
}

reportPlayers();
reportSlowLevels();
reportBreaks();
