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
import { readFileSync } from 'node:fs';
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
    readonly clicks: readonly Moment[];
    readonly levels: readonly Moment[];
}

// A click, or the first time a level was reached.
interface Moment {
    readonly at: number;
    readonly level: number;
}

const seed = Number(readArgument('--seed') ?? '1');
const longestRunSeconds = 10 * 3600;
const slowLevelSeconds = 240;
const marks: readonly number[] = [100, 500, 1000];
// Staring is a stretch of this many seconds or more in which the player clicks nothing: there is nothing to buy, replace, assign or answer.
const stareSeconds = 30;
const stareBands: readonly number[] = [5, 25, 50, 100, 250, 500, 1000];

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
    const clicks: Moment[] = [];
    const levels: Moment[] = [];
    game.subscribe((event) => {
        const { elapsedSeconds } = game.state;
        if (event.type === 'actionApplied' && event.action.type !== 'checkIn') clicks.push({ at: elapsedSeconds, level: game.state.currentLevel });
        if (event.type === 'levelSolved') levels.push({ at: elapsedSeconds, level: event.level });
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
    return { game, reached, bans, purchases, longestPurchaseWait, nothingOnOffer, slowLevels, clicks, levels };
}

function row(cells: readonly (string | number)[], widths: readonly number[]): string {
    return cells.map((cell, index) => String(cell).padEnd(widths[index] ?? 0)).join(' ');
}

function reportPlayers(): Run {
    const widths = [24, 9, 9, 9, 7, 6, 12, 20, 13, 9];
    console.log(row(['player', 'L100', 'L500', 'L1000', 'cards', 'bans', 'longest wait', 'levels over 4 min', 'nothing to buy', 'money left'], widths));
    let attentive: Run | undefined;
    for (const player of players) {
        const run = play(player);
        attentive ??= run;
        const time = (level: number): string => (run.reached[level] === undefined ? `L${run.game.state.currentLevel}` : formatDuration(run.reached[level]));
        const slowest = run.slowLevels.reduce((longest, entry) => Math.max(longest, entry.seconds), 0);
        console.log(row([
            player.name, time(100), time(500), time(1000), run.purchases, run.bans, formatDuration(run.longestPurchaseWait),
            run.slowLevels.length === 0 ? 'none' : `${run.slowLevels.length}, longest ${formatDuration(slowest)}`,
            formatDuration(run.nothingOnOffer), `$${formatNumber(run.game.state.resources.money ?? 0)}`,
        ], widths));
    }
    return attentive!;
}

function reportStaring(name: string, clicks: readonly Moment[], levels: readonly Moment[]): void {
    const widths = [18, 10, 10, 8, 30];
    console.log(`\nStaring (${stareSeconds} seconds or more without a click), ${name}:`);
    console.log(row(['levels', 'time', 'staring', 'share', 'longest stretch'], widths));
    const reachedAt = (level: number): number | undefined => levels.find((moment) => moment.level >= level)?.at;
    const end = levels.at(-1)?.at ?? 0;
    for (const [index, from] of stareBands.slice(0, -1).entries()) {
        const to = stareBands[index + 1]!;
        const start = reachedAt(from);
        if (start === undefined) break;
        const stop = reachedAt(to) ?? end;
        const moments = [start, ...clicks.map((click) => click.at).filter((at) => at > start && at < stop), stop];
        const stretches = moments.slice(1).map((at, position) => ({ from: moments[position]!, seconds: at - moments[position]! })).filter((stretch) => stretch.seconds >= stareSeconds);
        const staring = stretches.reduce((sum, stretch) => sum + stretch.seconds, 0);
        const longest = stretches.reduce<{ from: number; seconds: number } | undefined>((most, stretch) => (most === undefined || stretch.seconds > most.seconds ? stretch : most), undefined);
        const levelAt = (at: number): number => levels.findLast((moment) => moment.at <= at)?.level ?? from;
        console.log(row([
            `${from} to ${to}`, formatDuration(stop - start), formatDuration(staring), `${Math.round(staring / Math.max(1, stop - start) * 100)}%`,
            longest === undefined ? 'none' : `${formatDuration(longest.seconds)} at level ${levelAt(longest.from)}`,
        ], widths));
    }
}

// The same count for a session log of a real play. Moving around in the browser is not counted as a click.
function reportLoggedStaring(file: string): void {
    const entries = readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as { type: string; gameSeconds: number; level: number; action?: { type: string } });
    const clicks = entries.filter((entry) => entry.type === 'actionApplied' && entry.action?.type !== 'navigate').map((entry) => ({ at: entry.gameSeconds, level: entry.level }));
    const levels = entries.filter((entry) => entry.type === 'levelSolved' || entry.type === 'devSetLevel').map((entry) => ({ at: entry.gameSeconds, level: entry.level }));
    reportStaring(file, clicks, levels);
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

const logFile = readArgument('--log');
if (logFile !== undefined) {
    reportLoggedStaring(logFile);
    process.exit();
}
const attentiveRun = reportPlayers();
reportStaring('attentive robot', attentiveRun.clicks, attentiveRun.levels);
reportSlowLevels();
reportBreaks();
