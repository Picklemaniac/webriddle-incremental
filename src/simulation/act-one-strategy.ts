import { currentSearch } from '../content/act-one/automation.ts';
import {
    activities, activityRate, assignedScripts, dirbustingScripts, incomePerSecond, isJobUnlocked, isResourceRevealed, jobs, scriptSlots, type ActivityId, type JobId,
} from '../content/act-one/economy.ts';
import { entrance, entranceAction } from '../content/act-one/levels.ts';
import { effectiveRate, isThrottled, networkCapacity, requestedRate } from '../content/act-one/network.ts';
import { automationLevel, isUpgradeRevealed, owns } from '../content/act-one/progress.ts';
import { currentPhase } from '../content/act-one/search.ts';
import { capacityUpgrades, offeredUpgrades, upgrades, type Upgrade } from '../content/act-one/upgrades.ts';
import type { Game } from '../core/game.ts';
import { canAfford } from '../core/purchasing.ts';
import type { Strategy } from './strategies.ts';

interface DecisionMemory { level: number; handSeconds: number; captchaSeconds: number }

const incomeStats: ReadonlySet<string> = new Set(['workRate', 'ticketBotRate', 'scourRate', 'scraperRate', 'riddleRate', 'riddleBotRate', 'scriptSlots']);
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

export function actOneStrategy(decisionIntervalSeconds: number, purist = false): Strategy {
    const memories = new WeakMap<Game, DecisionMemory>();
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
                const activity = chooseActivity(game, purchases.offered.find((item) => !canAfford(state, item.price)));
                if (activity !== undefined) acted = game.dispatch({ type: 'setActivity', activity }) || acted;
                acted = assignScripts(game) || acted;
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

function buyUpgrades(game: Game): { readonly acted: boolean; readonly offered: readonly Upgrade[] } {
    const { state } = game;
    const blocker = currentSearch(game).blockedBy;
    const capped = requestedRate(game) >= networkCapacity(game);
    const priority = (item: Upgrade): number => {
        if (item.fixes === blocker || (capped && capacityUpgrades.has(item.id))) return urgentPriority;
        return (item.modifiers?.(1) ?? []).some((modifier) => incomeStats.has(modifier.statId)) ? incomePriority : 0;
    };
    const offered = offeredUpgrades(state).filter((item) => isUpgradeRevealed(state, item.id)).sort((first, second) => priority(second) - priority(first));
    let acted = false;
    for (const item of offered) {
        if (canAfford(state, item.price)) acted = game.dispatch({ type: 'purchase', purchasableId: item.id }) || acted;
        else if (priority(item) === urgentPriority || (priority(item) === incomePriority && secondsUntilAffordable(game, item) < savingSeconds)) break;
    }
    return { acted, offered };
}

function assignScripts(game: Game): boolean {
    const slots = scriptSlots(game);
    const scriptsToFillLimit = networkCapacity(game) / (game.stat('threadsPerScript') * game.stat('requestsPerThread'));
    const searchers = Math.min(Math.ceil(slots / 2), Math.max(1, isThrottled(game) ? Math.ceil(scriptsToFillLimit) : Math.floor(scriptsToFillLimit)));
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
    const seconds = Object.entries(item.price).map(([resource, amount]) =>
        (amount - (game.state.resources[resource] ?? 0)) / Math.max(minimumIncomePerSecond, incomePerSecond(game, resource)));
    return Math.max(0, ...seconds);
}

function chooseActivity(game: Game, goal: Upgrade | undefined): ActivityId | undefined {
    if (goal === undefined) return undefined;
    const waits = activities.filter((activity) => isResourceRevealed(game, activity.resource)).map((activity) => ({
        id: activity.id,
        seconds: Math.max(0, (goal.price[activity.resource] ?? 0) - (game.state.resources[activity.resource] ?? 0)) / activityRate(game, activity.id),
    }));
    const longest = waits.reduce<{ id: ActivityId; seconds: number } | undefined>((best, wait) => best === undefined || wait.seconds > best.seconds ? wait : best, undefined);
    return longest !== undefined && longest.seconds > 0 ? longest.id : undefined;
}

function isStuck(game: Game): boolean {
    const plan = currentSearch(game);
    if (plan.blockedBy !== null) return true;
    const { phase, spent } = currentPhase(plan, game.state.search.requestsSpent);
    const requestsLeft = phase === undefined ? 0 : phase.size - spent;
    return requestsLeft / Math.max(1, effectiveRate(game) * game.stat('searchEfficiency')) > stuckSearchSeconds;
}

function handSolveSeconds(level: number): number {
    return level <= openingSolveSeconds.length ? openingSolveSeconds[level - 1]! : baseSolveSeconds + Math.sqrt(level) * solveSecondsPerRootLevel;
}

function solveByHand(game: Game): boolean {
    return game.dispatch(entranceAction(entrance(game.state.currentLevel + 1)));
}
