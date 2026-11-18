import { readFileSync } from 'node:fs';
import { assignedScripts, dirbustingScripts, incomePerSecond, incomeWhileEarning, isResourceRevealed, jobs, scriptSlots } from '../src/content/act-one/economy.ts';
import { actOneContent } from '../src/content/act-one/index.ts';
import { lastActOneLevel } from '../src/content/act-one/levels.ts';
import { effectiveRate, rentPerSecond, requestsPerAddress } from '../src/content/act-one/network.ts';
import { isUpgradeRevealed } from '../src/content/act-one/progress.ts';
import { offeredUpgrades, upgrades, type Upgrade } from '../src/content/act-one/upgrades.ts';
import type { Action } from '../src/core/actions.ts';
import { Game } from '../src/core/game.ts';
import { createInitialState, type GameState } from '../src/core/state.ts';
import { formatDuration, formatNumber } from '../src/format.ts';
import { actOneStrategy, type PlayStyle } from '../src/simulation/act-one-strategy.ts';
import { AutoPlayer } from '../src/simulation/auto-player.ts';
import { actOneStaringBands } from '../src/simulation/staring.ts';
import { formatAmount, formatRate } from '../src/ui/amounts.ts';

// Looks at a play the way a player would: what each currency is for, what the rent takes, and for every card what it cost in earning time and what it changed.

const currencies = ['insight', 'money', 'data'] as const;
const longestRunSeconds = 10 * 3600;
const robotReactionSeconds = 4;
// A purchase is judged by what has changed a little later, when new scripts have a job and new addresses are rented.
const settleSeconds = 10;
export const cheapSeconds = 30;
const roomySeconds = 360;
const slowPaybackSeconds = 600;
const smallChange = 0.01;
// Scripts come and go on the insight and data jobs, so a card's worth in those is taken at what a fifth of the scripts would earn.
const referenceScriptShare = 0.2;
const moneyStats: ReadonlySet<string> = new Set(['workRate', 'ticketBotRate']);
const measuredStats: ReadonlySet<string> = new Set(['threadsPerScript', 'requestsPerThread', 'scriptSlots', 'proxySlots', 'ownAddresses', 'rentableAddresses', 'addressRent', ...moneyStats]);

// What the player has, earns and runs at one moment of a play.
interface Reading {
    readonly seconds: number;
    readonly level: number;
    readonly held: Readonly<Record<string, number>>;
    // Whether the player has met the currency: it is on screen, they hold some, or a card on the list costs it.
    readonly met: Readonly<Record<string, boolean>>;
    readonly income: Readonly<Record<string, number>>;
    // What the player would earn of each currency with the scripts as they are, if it were also their own activity.
    readonly reachableIncome: Readonly<Record<string, number>>;
    // The income a card's worth is measured against: for money the one above, for insight and data that of a set share of the scripts.
    readonly referenceIncome: Readonly<Record<string, number>>;
    readonly rent: number;
    readonly rentOfEveryAddress: number;
    readonly rentPaidSoFar: number;
    readonly requests: number;
    readonly limitWithEveryAddress: number;
    readonly scripts: Readonly<Record<string, number>>;
    readonly listed: readonly Upgrade[];
}

interface Purchase {
    readonly item: Upgrade;
    readonly seconds: number;
    readonly before: Reading;
    readonly shown: Reading | undefined;
}

export interface Play {
    readonly name: string;
    readonly readings: readonly Reading[];
    readonly purchases: readonly Purchase[];
}

interface LogEntry {
    readonly type: string;
    readonly gameSeconds: number;
    readonly level?: number;
    readonly action?: Action;
    readonly purchasableId?: string;
    readonly currentLevel?: number;
    readonly resources?: Record<string, number>;
    readonly purchases?: Record<string, number>;
    readonly jobs?: Record<string, number>;
    readonly network?: GameState['network'];
    readonly statistics?: Record<string, number>;
}

const cardById = (id: string): Upgrade => upgrades.find((item) => item.id === id)!;
const stats = (item: Upgrade): readonly string[] => (item.modifiers?.(1) ?? []).map((modifier) => modifier.statId);
export const clock = (seconds: number): string => {
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 3600)}:${String(Math.floor(whole % 3600 / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
};
const share = (part: number, whole: number): string => (whole === 0 ? '-' : `${Math.round(part / whole * 100)}%`);
const priceText = (item: Upgrade): string => Object.entries(item.price).map(([resource, amount]) => formatAmount(resource, amount)).join(', ');
const row = (cells: readonly (string | number)[], widths: readonly number[]): string => cells.map((cell, index) => String(cell).padEnd(widths[index] ?? 0)).join(' ').trimEnd();

function read(game: Game, listed: readonly Upgrade[]): Reading {
    const { state } = game;
    const rentable = game.stat('rentableAddresses');
    return {
        seconds: state.elapsedSeconds,
        level: state.currentLevel,
        held: { ...state.resources },
        met: Object.fromEntries(currencies.map((currency) =>
            [currency, isResourceRevealed(game, currency) || (state.resources[currency] ?? 0) > 0 || listed.some((item) => item.price[currency] !== undefined)])),
        income: Object.fromEntries(currencies.map((currency) => [currency, incomePerSecond(game, currency)])),
        reachableIncome: Object.fromEntries(currencies.map((currency) => [currency, incomeWhileEarning(game, currency)])),
        referenceIncome: Object.fromEntries(currencies.map((currency) => [currency, referenceIncome(game, currency)])),
        rent: rentPerSecond(game) * state.network.rentShare,
        rentOfEveryAddress: rentable * game.stat('addressRent'),
        rentPaidSoFar: state.statistics.rentPaid ?? 0,
        requests: effectiveRate(game),
        limitWithEveryAddress: requestsPerAddress * (game.stat('ownAddresses') + game.stat('proxySlots') + rentable),
        scripts: { all: scriptSlots(game), dirbuster: dirbustingScripts(game), ...Object.fromEntries(jobs.map((job) => [job.id, assignedScripts(game, job.id)])) },
        listed,
    };
}

function referenceIncome(game: Game, currency: string): number {
    if (currency === 'money') return incomeWhileEarning(game, currency);
    const job = jobs.find((candidate) => candidate.resource === currency)!;
    return game.stat(job.rateStat) * Math.max(1, referenceScriptShare * scriptSlots(game));
}

export function playRobot(seed: number, style: PlayStyle): Play {
    const game = new Game(actOneContent, createInitialState(actOneContent, seed));
    const robot = new AutoPlayer(actOneStrategy(robotReactionSeconds, style));
    const readings: Reading[] = [];
    const purchases: Purchase[] = [];
    const shown = new Map<string, Reading>();
    const listed = (): Upgrade[] => offeredUpgrades(game).filter((item) => isUpgradeRevealed(game.state, item.id));
    let latest = read(game, []);
    game.subscribe((event) => {
        if (event.type === 'upgradeRevealed') shown.set(event.purchasableId, read(game, listed()));
        if (event.type !== 'actionApplied' || event.action.type !== 'purchase') return;
        purchases.push({ item: cardById(event.action.purchasableId), seconds: game.state.elapsedSeconds, before: latest, shown: shown.get(event.action.purchasableId) });
    });
    while (game.state.currentLevel < lastActOneLevel && game.state.elapsedSeconds < longestRunSeconds) {
        robot.playStep(game, 1);
        if (game.state.flags.automated !== true) continue;
        latest = read(game, listed());
        readings.push(latest);
    }
    return { name: `the ${style} robot, seed ${seed}`, readings, purchases };
}

// A session log holds the player's actions and a snapshot every half minute. The game is not played again: its state is set from the log, so that the figures are those of the real play.
export function replayLogs(files: readonly string[]): Play {
    const game = new Game(actOneContent, createInitialState(actOneContent, 1));
    const { state } = game;
    const readings: Reading[] = [];
    const purchases: Purchase[] = [];
    const shown = new Map<string, Reading>();
    const listed = (): Upgrade[] => upgrades.filter((item) => state.flags[`seen:${item.id}`] === true && (state.purchases[item.id] ?? 0) === 0);
    let latest = read(game, []);
    const apply = (action: Action): void => {
        switch (action.type) {
            case 'automate':
                state.flags.automated = true;
                break;
            case 'setActivity':
                state.activity = action.activity;
                break;
            case 'assignJob':
                state.jobs[action.jobId] = (state.jobs[action.jobId] ?? 0) + Math.sign(action.change);
                break;
            case 'setRentedAddresses':
                state.network.rentedAddresses = action.count;
                break;
            case 'setThrottle':
                state.flags.throttleOff = !action.enabled;
                break;
            case 'purchase': {
                const item = cardById(action.purchasableId);
                purchases.push({ item, seconds: state.elapsedSeconds, before: latest, shown: shown.get(item.id) });
                for (const [resource, amount] of Object.entries(item.price)) state.resources[resource] = (state.resources[resource] ?? 0) - amount;
                state.purchases[item.id] = 1;
                game.invalidateStats();
                break;
            }
            default:
        }
    };
    const entries = files.flatMap((file) => readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as LogEntry));
    for (const entry of entries) {
        state.elapsedSeconds = entry.gameSeconds;
        if (entry.type === 'snapshot') {
            Object.assign(state, { currentLevel: entry.currentLevel, resources: { ...entry.resources }, purchases: { ...entry.purchases }, jobs: { ...entry.jobs }, network: { ...entry.network } });
            Object.assign(state.statistics, entry.statistics);
            game.invalidateStats();
        } else if (entry.type === 'upgradeRevealed' && entry.purchasableId !== undefined) {
            state.flags[`seen:${entry.purchasableId}`] = true;
            shown.set(entry.purchasableId, read(game, listed()));
        } else if ((entry.type === 'levelSolved' || entry.type === 'devSetLevel') && entry.level !== undefined) {
            state.currentLevel = entry.level;
        } else if (entry.type === 'actionApplied' && entry.action !== undefined) {
            apply(entry.action);
        }
        if (state.flags.automated !== true) continue;
        latest = read(game, listed());
        readings.push(latest);
    }
    return { name: `the play in ${files.join(' and ')}`, readings, purchases };
}

// Each reading with the time it stands for: until the next one.
function stretches(play: Play): readonly { readonly reading: Reading; readonly seconds: number }[] {
    return play.readings.slice(0, -1).map((reading, index) => ({ reading, seconds: play.readings[index + 1]!.seconds - reading.seconds }));
}

function waitsFor(reading: Reading, currency: string): boolean {
    return reading.listed.some((item) => (item.price[currency] ?? 0) > (reading.held[currency] ?? 0));
}

type Stretch = ReturnType<typeof stretches>[number];

function secondsWaitedFor(all: readonly Stretch[], currency: string): number {
    return all.filter(({ reading }) => waitsFor(reading, currency)).reduce((sum, { seconds }) => sum + seconds, 0);
}

// Data is not in the game until a wordlist is found to be missing, so its share is taken of the time since then.
function secondsSinceMet(all: readonly Stretch[], currency: string): number {
    return all.filter(({ reading }) => reading.met[currency] === true).reduce((sum, { seconds }) => sum + seconds, 0);
}

export function reportCurrencies(play: Play): void {
    const all = stretches(play);
    const total = all.reduce((sum, { seconds }) => sum + seconds, 0);
    const last = play.readings.at(-1)!;
    const widths = [9, 14, 16, 12, 12, 30];
    console.log('\nWhat each currency was for');
    console.log(row(['', 'earned', 'spent on cards', 'rent', 'left over', 'a card on the list waited for it, of the time since the player met it'], widths));
    for (const currency of currencies) {
        const spent = play.purchases.reduce((sum, purchase) => sum + (purchase.item.price[currency] ?? 0), 0);
        const rent = currency === 'money' ? last.rentPaidSoFar : 0;
        const left = last.held[currency] ?? 0;
        const waited = secondsWaitedFor(all, currency);
        console.log(row([
            currency, formatAmount(currency, left + spent + rent), `${formatAmount(currency, spent)} (${share(spent, left + spent + rent)})`,
            currency === 'money' ? `${formatAmount(currency, rent)} (${share(rent, left + spent + rent)})` : '-', `${formatAmount(currency, left)} (${share(left, left + spent + rent)})`,
            `${share(waited, secondsSinceMet(all, currency))} (${share(waited, total)} of the whole play)`,
        ], widths));
    }
}

export function reportBands(play: Play): void {
    const all = stretches(play);
    const widths = [12, 9, 9, 26, 12, 14, 22, 18];
    console.log('\nBy level');
    console.log(row(['levels', 'time', 'levels', 'scripts on average:', 'rent of the', 'every address', 'a card waited for', 'cards bought for'], widths));
    console.log(row(['', '', 'a minute', 'DirBuster tickets riddles', 'money earned', 'of the income', 'insight money data', 'insight money data'], widths));
    for (const [index, fromLevel] of actOneStaringBands.slice(0, -1).entries()) {
        const toLevel = actOneStaringBands[index + 1]!;
        const band = all.filter(({ reading }) => reading.level >= fromLevel && reading.level < toLevel);
        const seconds = band.reduce((sum, stretch) => sum + stretch.seconds, 0);
        if (seconds === 0) continue;
        const average = (value: (reading: Reading) => number): number => band.reduce((sum, stretch) => sum + value(stretch.reading) * stretch.seconds, 0) / seconds;
        const levels = band.at(-1)!.reading.level - band[0]!.reading.level;
        const renting = band.filter(({ reading }) => reading.rentOfEveryAddress > 0);
        const rentingSeconds = renting.reduce((sum, stretch) => sum + stretch.seconds, 0);
        const fullRentShare = renting.reduce((sum, { reading, seconds: weight }) => sum + reading.rentOfEveryAddress / Math.max(0.01, reading.reachableIncome.money ?? 0) * weight, 0);
        const bought = play.purchases.filter((purchase) => purchase.before.level >= fromLevel && purchase.before.level < toLevel);
        console.log(row([
            `${fromLevel} to ${toLevel}`, formatDuration(seconds), (levels / seconds * 60).toFixed(1),
            `${average((reading) => reading.scripts.dirbuster ?? 0).toFixed(1)} ${average((reading) => reading.scripts.ticketing ?? 0).toFixed(1)} ${average((reading) => reading.scripts.riddles ?? 0).toFixed(1)} ${average((reading) => reading.scripts.scraping ?? 0).toFixed(1)} of ${average((reading) => reading.scripts.all ?? 0).toFixed(1)}`,
            share(average((reading) => reading.rent), average((reading) => reading.income.money ?? 0)),
            rentingSeconds === 0 ? '-' : `${Math.round(fullRentShare / rentingSeconds * 100)}%`,
            currencies.map((currency) => share(band.filter(({ reading }) => waitsFor(reading, currency)).reduce((sum, stretch) => sum + stretch.seconds, 0), seconds)).join(' '),
            currencies.map((currency) => bought.filter((purchase) => (purchase.item.price[currency] ?? 0) > 0).length).join(' '),
        ], widths));
    }
}

function settled(play: Play, index: number): Reading {
    const purchase = play.purchases[index]!;
    const until = Math.min(purchase.seconds + settleSeconds, play.purchases[index + 1]?.seconds ?? Number.POSITIVE_INFINITY);
    const after = play.readings.filter((reading) => reading.seconds > purchase.before.seconds);
    return after.findLast((reading) => reading.seconds <= until) ?? after[0] ?? purchase.before;
}

// How long the player would have to earn for a card, at the income they could have when it appeared.
function earningSeconds(item: Upgrade, reading: Reading, alreadyHeld: boolean): number {
    return Math.max(...Object.entries(item.price).map(([resource, amount]) =>
        Math.max(0, amount - (alreadyHeld ? reading.held[resource] ?? 0 : 0)) / Math.max(1e-9, reading.referenceIncome[resource] ?? 0)));
}

export interface Judged {
    readonly purchase: Purchase;
    readonly worthSeconds: number | undefined;
    readonly saveSeconds: number | undefined;
    readonly changes: readonly string[];
    readonly paybackSeconds: number | undefined;
}

function judge(play: Play, index: number): Judged {
    const purchase = play.purchases[index]!;
    const { item, before, shown } = purchase;
    const after = settled(play, index);
    const changes: string[] = [];
    const changed = (from: number, to: number): boolean => Math.abs(to - from) > smallChange * Math.max(Math.abs(from), Math.abs(to), 1e-9);
    if (changed(before.scripts.all ?? 0, after.scripts.all ?? 0)) changes.push(`scripts ${before.scripts.all} to ${after.scripts.all}`);
    if (changed(before.requests, after.requests)) changes.push(`requests ${formatNumber(before.requests)} to ${formatNumber(after.requests)}/s`);
    if (changed(before.limitWithEveryAddress, after.limitWithEveryAddress)) changes.push(`limit with every address ${formatNumber(before.limitWithEveryAddress)} to ${formatNumber(after.limitWithEveryAddress)}/s`);
    for (const currency of currencies) {
        const [from, to] = [before.income[currency] ?? 0, after.income[currency] ?? 0];
        if (changed(from, to)) changes.push(`${currency} ${formatRate(currency, from)} to ${formatRate(currency, to)}`);
    }
    if (changed(before.rent, after.rent)) changes.push(`rent ${formatRate('money', before.rent)} to ${formatRate('money', after.rent)}`);
    const gain = (after.income.money ?? 0) - after.rent - ((before.income.money ?? 0) - before.rent);
    const moneyPrice = item.price.money ?? 0;
    return {
        purchase,
        worthSeconds: shown === undefined ? undefined : earningSeconds(item, shown, false),
        saveSeconds: shown === undefined ? undefined : earningSeconds(item, shown, true),
        changes,
        paybackSeconds: moneyPrice > 0 && gain > 0 ? moneyPrice / gain : undefined,
    };
}

export function judgeCards(play: Play): readonly Judged[] {
    return play.purchases.map((_, index) => judge(play, index));
}

export function reportCards(judged: readonly Judged[]): void {
    const widths = [8, 6, 26, 22, 9, 9, 9];
    console.log('\nEvery card bought');
    console.log(row(['time', 'level', 'card', 'price', 'worth', 'to save', 'waited', 'what changed in the ten seconds after'], widths));
    for (const { purchase, worthSeconds, saveSeconds, changes, paybackSeconds } of judged) {
        const duration = (seconds: number | undefined): string => (seconds === undefined ? '?' : seconds > 99 * 3600 ? 'never' : formatDuration(seconds));
        console.log(row([
            clock(purchase.seconds), purchase.before.level, purchase.item.name, priceText(purchase.item), duration(worthSeconds), duration(saveSeconds),
            purchase.shown === undefined ? '?' : formatDuration(purchase.seconds - purchase.shown.seconds),
            `${changes.join('; ') || '-'}${paybackSeconds === undefined ? '' : ` (pays back in ${formatDuration(paybackSeconds)})`}`,
        ], widths));
    }
    console.log('  worth: how long the player would earn for the price when the card appeared. to save: the same, less what they already had.');
}

export function reportOddities(play: Play, judged: readonly Judged[]): void {
    const list = (title: string, lines: readonly string[]): void => {
        console.log(`\n${title}: ${lines.length === 0 ? 'none' : lines.length}`);
        for (const line of lines) console.log(`  ${line}`);
    };
    const name = ({ purchase }: Judged): string => `${purchase.item.name} (${priceText(purchase.item)}, level ${purchase.before.level})`;
    list(`Cards that could be paid for the moment they appeared, or within ${cheapSeconds} seconds`,
        judged.filter(({ saveSeconds }) => saveSeconds !== undefined && saveSeconds <= cheapSeconds).map((card) => `${name(card)}: worth ${formatDuration(card.worthSeconds ?? 0)} of earning`));
    list(`Cards that raise the pay or lower the rent and take more than ${slowPaybackSeconds / 60} minutes to pay for themselves`,
        judged.filter(({ purchase, paybackSeconds }) => {
            const changedStats = stats(purchase.item);
            const paysOnly = changedStats.some((statId) => moneyStats.has(statId)) || (changedStats.includes('addressRent') && !changedStats.includes('rentableAddresses'));
            return paysOnly && (paybackSeconds === undefined || paybackSeconds > slowPaybackSeconds);
        }).map((card) => `${name(card)}: ${card.paybackSeconds === undefined ? 'nothing gained' : `pays back in ${formatDuration(card.paybackSeconds)}`}; ${card.changes.join('; ') || 'nothing changed'}`));
    list('Cards with a number of their own after which none of the numbers moved',
        judged.filter(({ purchase, changes }) => changes.length === 0 && stats(purchase.item).some((statId) => measuredStats.has(statId))).map(name));
    list('Cards that appear at a level and for no other reason', upgrades.filter((item) => !item.onNeed && item.level > 5).map((item) => `${item.name} (level ${item.level})`));
    const chainEnd = (title: string, changedStat: string): string => {
        const chain = upgrades.filter((item) => stats(item).includes(changedStat));
        const bought = play.purchases.filter((purchase) => chain.includes(purchase.item));
        const lastBought = bought.at(-1);
        return `${title}: ${bought.length} of ${chain.length} bought${lastBought === undefined ? '' : `, the last one (${lastBought.item.name}) at ${clock(lastBought.seconds)}, level ${lastBought.before.level}`}`;
    };
    const end = play.readings.at(-1)!;
    list(`When the cards ran out (the play ends at ${clock(end.seconds)}, level ${end.level})`, [chainEnd('Pay', 'workRate'), chainEnd('Scripts', 'scriptSlots'), chainEnd('Speed of a script', 'requestsPerThread'), chainEnd('Addresses to rent', 'rentableAddresses')]);
}

// What a play of Act I is held to (docs/plan.md, section 6.2).
export interface Measures {
    // 1. Every card is worth one to six minutes of earning when it appears.
    readonly cheap: readonly Judged[];
    readonly underAMinute: readonly Judged[];
    readonly roomy: readonly Judged[];
    readonly dear: readonly Judged[];
    // 2. The rent of every address is a quarter to a half of the income.
    readonly rentShares: readonly { readonly fromLevel: number; readonly toLevel: number; readonly share: number }[];
    // 3. Each currency has a card waiting for it a good part of the time since the player met it, and little of it is left over.
    readonly use: Readonly<Record<string, { readonly waited: number; readonly leftOver: number }>>;
    // 4. The pay cards and the script cards last until the end.
    readonly lastPayCard: Purchase | undefined;
    readonly lastScriptCard: Purchase | undefined;
    readonly end: { readonly seconds: number; readonly level: number };
}

export function measure(play: Play, judged: readonly Judged[]): Measures {
    const all = stretches(play);
    const last = play.readings.at(-1)!;
    const worth = judged.filter((card) => card.worthSeconds !== undefined);
    const within = (from: number, to: number): Judged[] => worth.filter((card) => card.worthSeconds! >= from && card.worthSeconds! < to);
    const rentShares = actOneStaringBands.slice(0, -1).flatMap((fromLevel, index) => {
        const toLevel = actOneStaringBands[index + 1]!;
        const renting = all.filter(({ reading }) => reading.level >= fromLevel && reading.level < toLevel && reading.rentOfEveryAddress > 0);
        const seconds = renting.reduce((sum, stretch) => sum + stretch.seconds, 0);
        const weighted = renting.reduce((sum, { reading, seconds: weight }) => sum + reading.rentOfEveryAddress / Math.max(0.01, reading.reachableIncome.money ?? 0) * weight, 0);
        return seconds === 0 ? [] : [{ fromLevel, toLevel, share: weighted / seconds }];
    });
    const use = Object.fromEntries(currencies.map((currency) => {
        const spent = play.purchases.reduce((sum, purchase) => sum + (purchase.item.price[currency] ?? 0), 0) + (currency === 'money' ? last.rentPaidSoFar : 0);
        const left = last.held[currency] ?? 0;
        const sinceMet = secondsSinceMet(all, currency);
        return [currency, { waited: sinceMet === 0 ? 0 : secondsWaitedFor(all, currency) / sinceMet, leftOver: left + spent === 0 ? 0 : left / (left + spent) }];
    }));
    const lastOf = (changedStat: string): Purchase | undefined => play.purchases.findLast((purchase) => stats(purchase.item).includes(changedStat));
    return {
        cheap: within(0, cheapSeconds), underAMinute: within(cheapSeconds, 60), roomy: within(60, roomySeconds), dear: within(roomySeconds, Number.POSITIVE_INFINITY),
        rentShares, use, lastPayCard: lastOf('workRate'), lastScriptCard: lastOf('scriptSlots'), end: { seconds: last.seconds, level: last.level },
    };
}
