import { actOneContent } from '../src/content/act-one/index.ts';
import { entrance, lastActOneLevel } from '../src/content/act-one/levels.ts';
import { offeredUpgrades, upgrades } from '../src/content/act-one/upgrades.ts';
import { canAfford } from '../src/core/purchasing.ts';
import { isUpgradeRevealed, owns } from '../src/content/act-one/progress.ts';
import { Game } from '../src/core/game.ts';
import { createInitialState } from '../src/core/state.ts';
import { formatDuration, formatNumber } from '../src/format.ts';
import { actOneStrategy, type PlayStyle } from '../src/simulation/act-one-strategy.ts';
import { AutoPlayer } from '../src/simulation/auto-player.ts';
import { withHabits, type Habits } from '../src/simulation/habits.ts';
import { actOneStaringBands, StaringMeter, staringStretchSeconds } from '../src/simulation/staring.ts';
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
    readonly purchaseTimes: readonly number[];
    readonly nothingOnOffer: number;
    readonly slowLevels: readonly { readonly level: number; readonly seconds: number }[];
    readonly staring: StaringMeter;
    // Seconds per band of levels with no card on the list, and with cards but none the player can pay for.
    readonly emptyList: readonly number[];
    readonly nothingAffordable: readonly number[];
}

const seed = Number(readArgument('--seed') ?? '1');
const longestRunSeconds = 10 * 3600;
const slowLevelSeconds = 240;
const purchaseWindowSeconds = 600;
const longPurchaseGapSeconds = 300;
const marks: readonly number[] = [100, 250, lastActOneLevel];
const seenEvents: ReadonlySet<string> = new Set(['levelSolved', 'upgradeRevealed', 'notice', 'proxyDied', 'banned', 'unbanned']);

const players: readonly Player[] = [
    { name: 'attentive robot', habits: {} },
    { name: 'income first', habits: {}, style: 'earner' },
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
    const purchaseTimes: number[] = [];
    let lastSolveAt = 0;
    let nothingOnOffer = 0;
    const staring = new StaringMeter();
    const emptyList = actOneStaringBands.map(() => 0);
    const nothingAffordable = actOneStaringBands.map(() => 0);
    game.subscribe((event) => {
        const { elapsedSeconds } = game.state;
        if (seenEvents.has(event.type) || (event.type === 'actionApplied' && event.action.type !== 'checkIn')) staring.observe(elapsedSeconds, game.state.currentLevel);
        if (event.type === 'banned') bans++;
        if (event.type === 'actionApplied' && event.action.type === 'purchase') purchaseTimes.push(elapsedSeconds);
        if (event.type === 'levelSolved') {
            if (elapsedSeconds - lastSolveAt >= slowLevelSeconds && event.level > 10) slowLevels.push({ level: event.level, seconds: elapsedSeconds - lastSolveAt });
            lastSolveAt = elapsedSeconds;
        }
    });
    while (game.state.currentLevel < lastActOneLevel && game.state.elapsedSeconds < longestRunSeconds) {
        robot.playStep(game, 1);
        for (const mark of marks) if (reached[mark] === undefined && game.state.currentLevel >= mark) reached[mark] = game.state.elapsedSeconds;
        if (game.state.flags.automated !== true) continue;
        const listed = offeredUpgrades(game).filter((item) => isUpgradeRevealed(game.state, item.id));
        const band = actOneStaringBands.findLastIndex((level) => level <= game.state.currentLevel);
        if (listed.length === 0) {
            emptyList[band]!++;
            if (game.state.flags.upgradesRevealed === true) nothingOnOffer++;
        } else if (!listed.some((item) => canAfford(game.state, item.price))) nothingAffordable[band]!++;
    }
    staring.observe(game.state.elapsedSeconds, game.state.currentLevel);
    return { game, reached, bans, purchaseTimes, nothingOnOffer, slowLevels, staring, emptyList, nothingAffordable };
}

function purchaseGaps(run: Run): number[] {
    return run.purchaseTimes.slice(1).map((time, index) => time - run.purchaseTimes[index]!);
}

function row(cells: readonly (string | number)[], widths: readonly number[]): string {
    return cells.map((cell, index) => String(cell).padEnd(widths[index] ?? 0)).join(' ');
}

function reportPlayers(): readonly Run[] {
    const widths = [24, 9, 9, 9, 7, 6, 12, 20, 13, 9];
    console.log(row(['player', 'L100', 'L250', 'L500', 'cards', 'bans', 'longest wait', 'levels over 4 min', 'nothing to buy', 'money left'], widths));
    const runs: Run[] = [];
    for (const player of players) {
        const run = play(player);
        runs.push(run);
        const time = (level: number): string => (run.reached[level] === undefined ? `L${run.game.state.currentLevel}` : formatDuration(run.reached[level]));
        const slowest = run.slowLevels.reduce((longest, entry) => Math.max(longest, entry.seconds), 0);
        console.log(row([
            player.name, time(100), time(250), time(lastActOneLevel), run.purchaseTimes.length, run.bans, formatDuration(Math.max(0, ...purchaseGaps(run))),
            run.slowLevels.length === 0 ? 'none' : `${run.slowLevels.length}, longest ${formatDuration(slowest)}`,
            formatDuration(run.nothingOnOffer), `$${formatNumber(run.game.state.resources.money ?? 0)}`,
        ], widths));
    }
    return runs;
}

function reportStaring(name: string, meter: StaringMeter, run?: Run): void {
    const widths = [14, 10, 10, 8, 26, 12, 16];
    console.log(`\nStaring (${staringStretchSeconds} seconds or more in which no level is found, no card appears, nothing breaks and nothing is clicked), ${name}:`);
    console.log(row(['levels', 'time', 'staring', 'share', 'longest stretch', ...(run === undefined ? [] : ['no card', 'none affordable'])], widths));
    for (const [index, band] of meter.bands(actOneStaringBands).entries()) {
        if (band.seconds === 0) continue;
        console.log(row([
            `${band.fromLevel} to ${band.toLevel}`, formatDuration(band.seconds), formatDuration(band.staringSeconds), `${Math.round(band.staringSeconds / band.seconds * 100)}%`,
            band.longestSeconds === 0 ? 'none' : `${formatDuration(band.longestSeconds)} at level ${band.longestAtLevel}`,
            ...(run === undefined ? [] : [formatDuration(run.emptyList[index]!), formatDuration(run.nothingAffordable[index]!)]),
        ], widths));
    }
}

// How often something is bought. This is the measure for a change that turns one card into several smaller ones.
function reportPurchases(name: string, run: Run): void {
    const gaps = purchaseGaps(run).sort((first, second) => first - second);
    const perWindow = Array.from({ length: Math.ceil(run.game.state.elapsedSeconds / purchaseWindowSeconds) }, (_, window) =>
        run.purchaseTimes.filter((time) => Math.floor(time / purchaseWindowSeconds) === window).length);
    console.log(`\nPurchases, ${name}: ${run.purchaseTimes.length} in ${formatDuration(run.game.state.elapsedSeconds)}`);
    console.log(`  per ${purchaseWindowSeconds / 60} minutes: ${perWindow.join(' ')}`);
    console.log(`  more than ${longPurchaseGapSeconds / 60} minutes after the one before: ${gaps.filter((gap) => gap > longPurchaseGapSeconds).length}; half come within ${formatDuration(gaps[Math.floor(gaps.length / 2)] ?? 0)}`);
}

// The same count for the session log of a real play. Logs from before 2026-11-17 do not say when a card appeared.
function reportLoggedStaring(file: string): void {
    const entries = readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as { type: string; gameSeconds: number; level?: number; currentLevel?: number });
    const meter = new StaringMeter();
    for (const entry of entries) {
        if (seenEvents.has(entry.type) || entry.type === 'actionApplied' || entry.type === 'devSetLevel' || entry.type === 'sessionStarted') meter.observe(entry.gameSeconds, entry.level ?? 0);
    }
    const last = entries.at(-1);
    if (last !== undefined) meter.observe(last.gameSeconds, last.level ?? last.currentLevel ?? 0);
    reportStaring(file, meter);
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
const runs = reportPlayers();
for (const name of ['attentive robot', 'income first', 'casual']) {
    const run = runs[players.findIndex((player) => player.name === name)]!;
    reportStaring(name, run.staring, run);
    reportPurchases(name, run);
}
reportSlowLevels();
reportBreaks();
