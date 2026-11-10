import { currentSearch } from '../content/act-one/automation.ts';
import {
    activities, activityRate, assignedScripts, dirbustingScripts, incomePerSecond, isJobUnlocked, isResourceRevealed, jobs, scriptSlots, type ActivityId, type JobId,
} from '../content/act-one/economy.ts';
import { entrance, entranceAction } from '../content/act-one/levels.ts';
import {
    answeredPerAddress, answeredRate, highestRatePerAddress, isAdaptive, liveProxies, rentPerSecond, requestedRate, serverTolerance,
} from '../content/act-one/network.ts';
import { automationLevel, isUpgradeRevealed, owns } from '../content/act-one/progress.ts';
import { currentPhase } from '../content/act-one/search.ts';
import { capacityUpgrades, offeredUpgrades, upgrades, type Upgrade } from '../content/act-one/upgrades.ts';
import type { Game } from '../core/game.ts';
import { canAfford } from '../core/purchasing.ts';
import type { Strategy } from './strategies.ts';

export type PlayStyle = 'attentive' | 'handsOff' | 'purist';

interface DecisionMemory { level: number; handSeconds: number; captchaSeconds: number; tuneSeconds: number }

const incomeStats: ReadonlySet<string> = new Set(['workRate', 'ticketBotRate', 'scourRate', 'scraperRate', 'riddleRate', 'riddleBotRate', 'scriptSlots', 'addressRent']);
const requestStats: ReadonlySet<string> = new Set(['threadsPerScript', 'requestsPerThread']);
const searcherShare = 1 / 3;
const urgentPriority = 2;
const incomePriority = 1;
const savingSeconds = 900;
const lookaheadLevels = 50;
const captchaSeconds = 12;
const openingSolveSeconds: readonly number[] = [45, 60, 75, 60];
const baseSolveSeconds = 100;
const solveSecondsPerRootLevel = 3;
const stuckSearchSeconds = 180;
const minimumIncomePerSecond = 0.001;
const longestWaitSeconds = 3600;
const rateTuningSeconds = 40;
const savingRentShare = 0.35;
const burnSeconds = 300;
const rentStepShare = 0.05;

export function actOneStrategy(decisionIntervalSeconds: number, style: PlayStyle = 'attentive'): Strategy {
    const memories = new WeakMap<Game, DecisionMemory>();
    const purist = style === 'purist';
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
                const purchases = buyUpgrades(game);
                acted = purchases.acted;
                const activity = chooseActivity(game, purchases.offered);
                if (activity !== undefined) acted = game.dispatch({ type: 'setActivity', activity }) || acted;
                if (style === 'attentive') acted = chooseRent(game, purchases.offered) || acted;
                acted = assignScripts(game) || acted;
                acted = replaceDeadProxies(game) || acted;
                memory.tuneSeconds += decisionIntervalSeconds;
                if (style === 'attentive' && memory.tuneSeconds >= rateTuningSeconds) {
                    memory.tuneSeconds = 0;
                    acted = tuneRate(game) || acted;
                }
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
        memory = { level: game.state.currentLevel, handSeconds: 0, captchaSeconds: 0, tuneSeconds: rateTuningSeconds };
        memories.set(game, memory);
    }
    if (memory.level !== game.state.currentLevel) {
        memory.level = game.state.currentLevel;
        memory.handSeconds = 0;
    }
    memory.handSeconds += decisionIntervalSeconds;
    return memory;
}

function buyUpgrades(game: Game): { readonly acted: boolean; readonly offered: readonly Upgrade[] } {
    const { state } = game;
    const { slowedBy } = currentSearch(game);
    const capped = requestedRate(game) >= serverTolerance(game);
    const needsMoreScripts = serverTolerance(game) > requestsPerScript(game);
    const priority = (item: Upgrade): number => {
        if ((item.fixes !== undefined && item.fixes === slowedBy) || (capped && capacityUpgrades.has(item.id))) return urgentPriority;
        const stats = (item.modifiers?.(1) ?? []).map((modifier) => modifier.statId);
        return stats.some((statId) => incomeStats.has(statId) || (needsMoreScripts && requestStats.has(statId))) ? incomePriority : 0;
    };
    const offered = offeredUpgrades(game).filter((item) => isUpgradeRevealed(state, item.id)).sort((first, second) => priority(second) - priority(first));
    let acted = false;
    for (const item of offered) {
        if (canAfford(state, item.price)) acted = game.dispatch({ type: 'purchase', purchasableId: item.id }) || acted;
        else if (priority(item) === urgentPriority || (priority(item) === incomePriority && secondsUntilAffordable(game, item) < savingSeconds)) break;
    }
    return { acted, offered };
}

function tuneRate(game: Game): boolean {
    if (game.state.flags.networkRevealed !== true || isAdaptive(game)) return false;
    const rate = Math.max(1, Math.min(highestRatePerAddress(game), Math.floor(answeredPerAddress(game))));
    return game.dispatch({ type: 'setRatePerAddress', rate });
}

function chooseRent(game: Game, offered: readonly Upgrade[]): boolean {
    const { state } = game;
    const rentable = game.stat('rentableAddresses');
    if (rentable === 0) return false;
    const money = state.resources.money ?? 0;
    const income = incomePerSecond(game, 'money');
    const saving = offered.some((item) => (item.price.money ?? 0) > money);
    const budget = saving ? income * savingRentShare : income + money / burnSeconds;
    const useful = maximumSearchers(game) * requestsPerScript(game) / answeredPerAddress(game) - 1 - liveProxies(game);
    const target = Math.max(0, Math.min(rentable, Math.floor(budget / game.stat('addressRent')), Math.ceil(useful)));
    if (Math.abs(target - state.network.rentedAddresses) < Math.max(1, rentable * rentStepShare) && target !== rentable && target !== 0) return false;
    return game.dispatch({ type: 'setRentedAddresses', count: target });
}

function requestsPerScript(game: Game): number {
    return game.stat('threadsPerScript') * game.stat('requestsPerThread');
}

function maximumSearchers(game: Game): number {
    return Math.max(1, Math.ceil(scriptSlots(game) * searcherShare));
}

function assignScripts(game: Game): boolean {
    const slots = scriptSlots(game);
    const scriptsToFillLimit = serverTolerance(game) / requestsPerScript(game);
    const searchers = Math.min(maximumSearchers(game), Math.max(1, Math.ceil(scriptsToFillLimit)));
    const targets = jobTargets(game, slots - searchers);
    let acted = false;
    for (const job of jobs) {
        if (!isJobUnlocked(game, job.id)) continue;
        if (assignedScripts(game, job.id) > targets[job.id]) acted = game.dispatch({ type: 'assignJob', jobId: job.id, change: -1 }) || acted;
        if (assignedScripts(game, job.id) < targets[job.id] && dirbustingScripts(game) > 1) acted = game.dispatch({ type: 'assignJob', jobId: job.id, change: 1 }) || acted;
    }
    return acted;
}

function jobTargets(game: Game, free: number): Record<JobId, number> {
    const { state } = game;
    const targets: Record<JobId, number> = { scraping: 0, ticketing: 0, riddles: 0 };
    const unlocked = jobs.filter((job) => isJobUnlocked(game, job.id));
    if (unlocked.length === 0 || free <= 0) return targets;
    const goals = upgrades.filter((item) => !owns(state, item.id) && item.level <= state.currentLevel + lookaheadLevels);
    const shortfall = (resource: string): number => Math.max(0, goals.reduce((sum, item) => sum + (item.price[resource] ?? 0), 0) - (state.resources[resource] ?? 0));
    const waits = unlocked.map((job) => shortfall(job.resource) / game.stat(job.rateStat));
    const total = waits.reduce((sum, wait) => sum + wait, 0);
    if (total === 0) {
        targets[(unlocked.find((job) => job.resource === 'money') ?? unlocked[0]!).id] = free;
        return targets;
    }
    const needy = unlocked.filter((_, index) => waits[index]! > 0).slice(0, free);
    for (const job of needy) targets[job.id] = 1;
    const shared = free - needy.length;
    const quotas = waits.map((wait) => (shared * wait) / total);
    unlocked.forEach((job, index) => { targets[job.id] += Math.floor(quotas[index]!); });
    const byRemainder = unlocked.map((job, index) => ({ job, remainder: quotas[index]! % 1 })).sort((first, second) => second.remainder - first.remainder);
    const leftover = free - unlocked.reduce((sum, job) => sum + targets[job.id], 0);
    for (const { job } of byRemainder.slice(0, leftover)) targets[job.id]++;
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
        return Math.min(longestWaitSeconds, Math.max(0, amount - (state.resources[resource] ?? 0)) / Math.max(minimumIncomePerSecond, income));
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
    const requestsLeft = phase === undefined ? 0 : phase.size - spent;
    return requestsLeft / Math.max(1, answeredRate(game) * game.stat('searchEfficiency') * plan.speed) > stuckSearchSeconds;
}

function handSolveSeconds(level: number): number {
    return level <= openingSolveSeconds.length ? openingSolveSeconds[level - 1]! : baseSolveSeconds + Math.sqrt(level) * solveSecondsPerRootLevel;
}

function solveByHand(game: Game): boolean {
    return game.dispatch(entranceAction(entrance(game.state.currentLevel + 1)));
}
