import { currentSearch } from '../content/act-one/automation.ts';
import {
    activities, activityRate, assignedScripts, dirbustingScripts, incomePerSecond, isJobUnlocked, isResourceRevealed, jobs, scriptSlots, type ActivityId, type JobId,
} from '../content/act-one/economy.ts';
import { entrance, entranceAction } from '../content/act-one/levels.ts';
import { effectiveRate, isThrottled, liveProxies, networkCapacity, rentPerSecond, rentsEveryAddress, requestedRate, requestsPerAddress } from '../content/act-one/network.ts';
import { automationLevel, isNeeded, isUpgradeRevealed, owns } from '../content/act-one/progress.ts';
import { currentPhase } from '../content/act-one/search.ts';
import { capacityUpgrades, offeredUpgrades, upgrades, type Upgrade } from '../content/act-one/upgrades.ts';
import type { Game } from '../core/game.ts';
import { canAfford } from '../core/purchasing.ts';
import type { Strategy } from './strategies.ts';

export type PlayStyle = 'attentive' | 'earner' | 'handsOff' | 'purist';

// How a robot weighs levels against money.
interface Leaning {
    // More pay and more scripts are bought before anything else.
    readonly investsFirst: boolean;
    // The share of the scripts with a job that always close tickets.
    readonly steadyTicketShare: number;
    readonly lookaheadLevels: number;
    readonly rentShareWhileSaving: number;
    // Addresses are rented for at least this many searching scripts, also when fewer search.
    readonly roomyScripts: number;
    // While it saves for a card, the robot still buys one that costs it less than this many seconds of income.
    readonly pocketMoneySeconds: number;
}

interface DecisionMemory { level: number; handSeconds: number; captchaSeconds: number }

const investmentStats: ReadonlySet<string> = new Set(['workRate', 'ticketBotRate', 'scriptSlots']);
const incomeStats: ReadonlySet<string> = new Set(['scourRate', 'scraperRate', 'riddleRate', 'riddleBotRate', 'addressRent']);
const requestStats: ReadonlySet<string> = new Set(['threadsPerScript', 'requestsPerThread']);
const capacityStats: ReadonlySet<string> = new Set(['proxySlots', 'ownAddresses', 'rentableAddresses']);
// Cards that take a chore away. The robot does the chore for free, but a person would want them.
const choreCards: ReadonlySet<string> = new Set(['proxyUptime', 'proxyChecker']);
const searcherShare = 1 / 3;
const firstPriority = 3;
const urgentPriority = 2;
const incomePriority = 1;
// More pay and more scripts come before more speed: they are what pays for everything else.
const investmentPriority = 1.5;
// The robot holds a resource back for the nearest card that it can pay for within this time. A card that is further off does not stop it from buying others.
const patienceSeconds: Readonly<Record<number, number>> = { [firstPriority]: 600, [urgentPriority]: 300, [investmentPriority]: 600, [incomePriority]: 600 };
const captchaSeconds = 12;
const openingSolveSeconds: readonly number[] = [45, 60, 75, 60];
const baseSolveSeconds = 100;
const solveSecondsPerRootLevel = 3;
const stuckSearchSeconds = 180;
const minimumIncomePerSecond = 0.001;
const longestWaitSeconds = 3600;
const burnSeconds = 300;
const rentStepShare = 0.05;
const mostSearchersForRoom = 6;
// The attentive robot goes for levels: it keeps room under the limit to spare for the next speed card, and works towards cards that are still some levels off.
const levelChaser: Leaning = { investsFirst: false, steadyTicketShare: 1 / 3, lookaheadLevels: 50, rentShareWhileSaving: 0.4, roomyScripts: 6, pocketMoneySeconds: 30 };
// The earner goes for income: pay and scripts first, most scripts on tickets, and no more addresses than its searching scripts use.
// It pays the share of its pay for rent that the game itself rents a new block with.
const earner: Leaning = { investsFirst: true, steadyTicketShare: 0.6, lookaheadLevels: 0, rentShareWhileSaving: 0.3, roomyScripts: 0, pocketMoneySeconds: 120 };

export function actOneStrategy(decisionIntervalSeconds: number, style: PlayStyle = 'attentive'): Strategy {
    const memories = new WeakMap<Game, DecisionMemory>();
    const purist = style === 'purist';
    const leaning = style === 'earner' ? earner : levelChaser;
    return {
        decisionIntervalSeconds,
        act(game) {
            const memory = decisionMemory(memories, game, decisionIntervalSeconds);
            const { state } = game;
            if (state.captcha !== null) {
                memory.captchaSeconds += decisionIntervalSeconds;
                if (memory.captchaSeconds < captchaSeconds) return false;
                memory.captchaSeconds = 0;
                return game.dispatch({ type: 'answerCaptcha', answer: state.captcha.word });
            }
            if (!purist && state.currentLevel >= automationLevel && !state.flags.automated) return game.dispatch({ type: 'automate' });
            let acted = false;
            if (state.flags.automated) {
                const purchases = buyUpgrades(game, leaning);
                acted = purchases.acted;
                const activity = chooseActivity(game, purchases.offered);
                if (activity !== undefined) acted = game.dispatch({ type: 'setActivity', activity }) || acted;
                if (style === 'attentive' || style === 'earner') acted = chooseRent(game, purchases.offered, leaning) || acted;
                acted = assignScripts(game, leaning) || acted;
                acted = replaceDeadProxies(game) || acted;
            }
            if ((purist || !state.flags.automated || isStuck(game)) && memory.handSeconds >= handSolveSeconds(state.currentLevel)) {
                memory.handSeconds = 0;
                return solveByHand(game) || acted;
            }
            return acted;
        },
    };
}

function decisionMemory(memories: WeakMap<Game, DecisionMemory>, game: Game, decisionIntervalSeconds: number): DecisionMemory {
    let memory = memories.get(game);
    if (!memory) {
        memory = { level: game.state.currentLevel, handSeconds: 0, captchaSeconds: 0 };
        memories.set(game, memory);
    }
    if (memory.level !== game.state.currentLevel) {
        memory.level = game.state.currentLevel;
        memory.handSeconds = 0;
    }
    memory.handSeconds += decisionIntervalSeconds;
    return memory;
}

function buyUpgrades(game: Game, leaning: Leaning): { readonly acted: boolean; readonly offered: readonly Upgrade[] } {
    const { state } = game;
    const { missing } = currentSearch(game);
    // More room under the limit only matters once the robot would search with more scripts than fit.
    const wantsMoreRoom = Math.max(requestedRate(game), maximumSearchers(game) * requestsPerScript(game)) > networkCapacity(game);
    const hasRoomToSpare = maximumSearchers(game) * requestsPerScript(game) < networkCapacity(game);
    const priority = (item: Upgrade): number => {
        const stats = (item.modifiers?.(1) ?? []).map((modifier) => modifier.statId);
        const invests = stats.some((statId) => investmentStats.has(statId));
        if (invests && leaning.investsFirst) return firstPriority;
        if (missing.includes(item.id)) return urgentPriority;
        if (stats.some((statId) => capacityStats.has(statId)) || capacityUpgrades.has(item.id)) return wantsMoreRoom ? urgentPriority : incomePriority;
        // A faster script is worth most while the limit has room that the robot's scripts cannot fill.
        if (stats.some((statId) => requestStats.has(statId))) return hasRoomToSpare ? urgentPriority : incomePriority;
        if (invests) return investmentPriority;
        if (stats.some((statId) => incomeStats.has(statId)) || jobs.some((job) => job.unlockedBy === item.id)) return incomePriority;
        if (choreCards.has(item.id)) return incomePriority;
        return item.onNeed ? urgentPriority : 0;
    };
    const offered = offeredUpgrades(game).filter((item) => isUpgradeRevealed(state, item.id))
        .sort((first, second) => priority(second) - priority(first) || secondsUntilAffordable(game, first) - secondsUntilAffordable(game, second));
    const savedFor = new Set<string>();
    // A person who is saving up still buys a card that costs them little.
    const isPocketMoney = (item: Upgrade): boolean => Object.entries(item.price).every(([resource, amount]) => amount <= spareIncome(game, resource) * leaning.pocketMoneySeconds);
    let acted = false;
    for (const item of offered) {
        const heldBack = Object.keys(item.price).some((resource) => savedFor.has(resource));
        if (heldBack && !isPocketMoney(item)) continue;
        if (canAfford(state, item.price)) {
            acted = game.dispatch({ type: 'purchase', purchasableId: item.id }) || acted;
        } else if (!heldBack && secondsUntilAffordable(game, item) < (patienceSeconds[priority(item)] ?? 0)) {
            for (const [resource, amount] of Object.entries(item.price)) if ((state.resources[resource] ?? 0) < amount) savedFor.add(resource);
        }
    }
    return { acted, offered };
}

function chooseRent(game: Game, offered: readonly Upgrade[], leaning: Leaning): boolean {
    const { state } = game;
    const rentable = game.stat('rentableAddresses');
    if (rentable === 0) return false;
    const money = state.resources.money ?? 0;
    const income = incomePerSecond(game, 'money');
    // While a card on the list costs more money than the robot has, the rent stays a share of the pay. With nothing left to save for, all of it can go to addresses.
    const saving = offered.some((item) => (item.price.money ?? 0) > money);
    const budget = saving ? income * leaning.rentShareWhileSaving : income + money / burnSeconds;
    // A robot that keeps room to spare keeps what the next speed card asks for: two scripts at three times the speed.
    const useful = Math.max(maximumSearchers(game), leaning.roomyScripts) * requestsPerScript(game) / requestsPerAddress - game.stat('ownAddresses') - liveProxies(game);
    const roomy = Math.ceil(useful);
    const target = Math.max(0, Math.min(rentable, Math.floor(budget / game.stat('addressRent')), roomy));
    // Small changes of the budget are not worth a move of the slider, but stopping a few addresses short of the room a speed card asks for is.
    const settles = target === rentable || target === 0 || target === roomy;
    if (Math.abs(target - state.network.rentedAddresses) < Math.max(1, rentable * rentStepShare) && !settles) return false;
    return game.dispatch({ type: 'setRentedAddresses', count: target });
}

function requestsPerScript(game: Game): number {
    return game.stat('threadsPerScript') * game.stat('requestsPerThread');
}

// The robot searches with a third of its scripts, and with up to half of them where that fills room it is paying rent for.
// The speed cards count on two scripts searching, so it searches with two as soon as it has a third script for a job.
function maximumSearchers(game: Game): number {
    const slots = scriptSlots(game);
    return Math.max(slots >= 3 ? 2 : 1, Math.ceil(slots * searcherShare), Math.min(mostSearchersForRoom, Math.floor(slots / 2)));
}

function assignScripts(game: Game, leaning: Leaning): boolean {
    const slots = scriptSlots(game);
    const scriptsToFillLimit = networkCapacity(game) / requestsPerScript(game);
    // With every address rented, a person who still has room under the limit fills it. The next block of addresses only comes to a player who does.
    const mostSearchers = rentsEveryAddress(game) ? slots - 1 : maximumSearchers(game);
    // Nothing says that more addresses would help until the scripts have run into the limit. A person finds that out with a script to spare, so before it has proxies the robot lets a second script search.
    const fewestSearchers = owns(game.state, 'freeProxies') ? 1 : 2;
    const searchers = Math.min(mostSearchers, Math.max(fewestSearchers, isThrottled(game) ? Math.ceil(scriptsToFillLimit) : Math.floor(scriptsToFillLimit)));
    const targets = jobTargets(game, slots - searchers, leaning);
    let acted = false;
    for (const job of jobs) {
        if (!isJobUnlocked(game, job.id)) continue;
        if (assignedScripts(game, job.id) > targets[job.id]) acted = game.dispatch({ type: 'assignJob', jobId: job.id, change: -1 }) || acted;
        if (assignedScripts(game, job.id) < targets[job.id] && dirbustingScripts(game) > 1) acted = game.dispatch({ type: 'assignJob', jobId: job.id, change: 1 }) || acted;
    }
    return acted;
}

function jobTargets(game: Game, free: number, leaning: Leaning): Record<JobId, number> {
    const { state } = game;
    const targets: Record<JobId, number> = { scraping: 0, ticketing: 0, riddles: 0 };
    const unlocked = jobs.filter((job) => isJobUnlocked(game, job.id));
    if (unlocked.length === 0 || free <= 0) return targets;
    // The rent and most cards are paid from the pay, so a share of the job scripts always closes tickets.
    const ticketing = unlocked.find((job) => job.resource === 'money');
    const steady = ticketing === undefined ? 0 : Math.floor(free * leaning.steadyTicketShare);
    if (ticketing !== undefined) targets[ticketing.id] = steady;
    // What the robot works towards: the cards on its list, and the ones that a few more levels will put there.
    const goals = upgrades.filter((item) => !owns(state, item.id) && item.requires.every((required) => owns(state, required))
        && (item.onNeed ? isNeeded(state, item.id) : item.level <= state.currentLevel + leaning.lookaheadLevels));
    // What the nearest card of a currency is still short of. Summing every card on the list let the dear pay cards crowd out a tool that was 200 insight away.
    const shortfall = (resource: string): number => {
        const held = state.resources[resource] ?? 0;
        const missing = goals.map((item) => (item.price[resource] ?? 0) - held).filter((amount) => amount > 0);
        return missing.length === 0 ? 0 : Math.min(...missing);
    };
    const byHand = (resource: string): number => {
        const activity = activities.find((candidate) => candidate.resource === resource && candidate.id === state.activity);
        return activity === undefined ? 0 : activityRate(game, activity.id);
    };
    const wait = (job: (typeof jobs)[number]): number => {
        const missing = shortfall(job.resource);
        return missing === 0 ? 0 : missing / (byHand(job.resource) + targets[job.id] * game.stat(job.rateStat));
    };
    // The other scripts go one by one to the currency whose next card is furthest away, so that the next card of each comes at about the same time.
    for (let assigned = steady; assigned < free; assigned++) {
        const furthest = unlocked.reduce((longest, job) => (wait(job) > wait(longest) ? job : longest));
        targets[(wait(furthest) > 0 ? furthest : ticketing ?? furthest).id]++;
    }
    return targets;
}

function replaceDeadProxies(game: Game): boolean {
    let acted = false;
    for (const [index, proxy] of game.state.network.proxies.entries()) {
        if (proxy.diesAtSeconds <= game.state.elapsedSeconds) acted = game.dispatch({ type: 'replaceProxy', proxyIndex: index }) || acted;
    }
    return acted;
}

function secondsUntilAffordable(game: Game, item: Upgrade): number {
    const seconds = Object.entries(item.price).map(([resource, amount]) => (amount - (game.state.resources[resource] ?? 0)) / Math.max(minimumIncomePerSecond, spareIncome(game, resource)));
    return Math.max(0, ...seconds);
}

function spareIncome(game: Game, resource: string): number {
    return incomePerSecond(game, resource) - (resource === 'money' ? rentPerSecond(game) * game.state.network.rentShare : 0);
}

function chooseActivity(game: Game, offered: readonly Upgrade[]): ActivityId | undefined {
    const { state } = game;
    const unaffordable = offered.filter((item) => !canAfford(state, item.price));
    const current = activities.find((activity) => activity.id === state.activity);
    const fromScripts = (resource: string): number => spareIncome(game, resource) - (current?.resource === resource ? activityRate(game, current.id) : 0);
    const secondsWith = (item: Upgrade, activity: ActivityId | undefined): number => Math.max(...Object.entries(item.price).map(([resource, amount]) => {
        const helped = activities.find((candidate) => candidate.id === activity)?.resource === resource;
        const income = fromScripts(resource) + (helped ? activityRate(game, activity!) : 0);
        const missing = Math.max(0, amount - (state.resources[resource] ?? 0));
        // What nothing earns never comes, however little of it is missing. Without this the robot left a card a fraction short for minutes.
        if (missing > 0 && income <= 0) return longestWaitSeconds;
        return Math.min(longestWaitSeconds, missing / Math.max(minimumIncomePerSecond, income));
    }));
    let best: { id: ActivityId; saved: number } | undefined;
    for (const activity of activities.filter((candidate) => isResourceRevealed(game, candidate.resource))) {
        const saved = unaffordable.reduce((sum, item) => sum + secondsWith(item, undefined) - secondsWith(item, activity.id), 0);
        if (saved > 0 && (best === undefined || saved > best.saved)) best = { id: activity.id, saved };
    }
    return best?.id;
}

function isStuck(game: Game): boolean {
    const plan = currentSearch(game);
    if (plan.speed === 0) return true;
    const { phase, spent } = currentPhase(plan, game.state.search.requestsSpent);
    if (phase === undefined) return false;
    return phase.guessing === true || (phase.size - spent) / Math.max(1, effectiveRate(game) * plan.speed) > stuckSearchSeconds;
}

function handSolveSeconds(level: number): number {
    return level <= openingSolveSeconds.length ? openingSolveSeconds[level - 1]! : baseSolveSeconds + Math.sqrt(level) * solveSecondsPerRootLevel;
}

function solveByHand(game: Game): boolean {
    return game.dispatch(entranceAction(entrance(game.state.currentLevel + 1)));
}
