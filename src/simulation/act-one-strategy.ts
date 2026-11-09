import { currentSearch } from '../content/act-one/automation.ts';
import { activities, activityRate, assignedScripts, dirbustingScripts, incomePerSecond, isJobUnlocked, isResourceRevealed, jobs, scriptSlots, type ActivityId, type JobId } from '../content/act-one/economy.ts';
import { entrance } from '../content/act-one/levels.ts';
import { effectiveRate, isThrottled, networkCapacity, requestedRate } from '../content/act-one/network.ts';
import { isUpgradeRevealed, owns } from '../content/act-one/progress.ts';
import { capacityUpgrades, offeredUpgrades, upgrades, type Upgrade } from '../content/act-one/upgrades.ts';
import type { Game } from '../core/game.ts';
import { canAfford } from '../core/purchasing.ts';
import type { Strategy } from './strategies.ts';

interface DecisionMemory { level: number; handSeconds: number; captchaSeconds: number }

const incomeStats: ReadonlySet<string> = new Set(['workRate', 'ticketBotRate', 'scourRate', 'scraperRate', 'riddleRate', 'riddleBotRate', 'scriptSlots']);
const savingSeconds = 900;
const lookaheadLevels = 50;

export function actOneStrategy(decisionIntervalSeconds: number, purist = false): Strategy {
    const memories = new WeakMap<Game, DecisionMemory>();
    return {
        decisionIntervalSeconds,
        act(game) {
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
            const { state } = game;
            if (state.captcha !== null) {
                memory.captchaSeconds += decisionIntervalSeconds;
                if (memory.captchaSeconds < 12) return false;
                memory.captchaSeconds = 0;
                return game.dispatch({ type: 'answerCaptcha', answer: state.captcha.word });
            }
            if (!purist && state.currentLevel >= 5 && !state.flags.automated) return game.dispatch({ type: 'automate' });
            let acted = false;
            if (state.flags.automated) {
                const blocker = currentSearch(game).blockedBy;
                const capped = requestedRate(game) >= networkCapacity(game);
                const urgent = (item: Upgrade): boolean => item.fixes === blocker || (capped && capacityUpgrades.has(item.id));
                const priority = (item: Upgrade): number => (urgent(item) ? 2 : (item.modifiers?.(1) ?? []).some((modifier) => incomeStats.has(modifier.statId)) ? 1 : 0);
                const offered = offeredUpgrades(state).filter((item) => isUpgradeRevealed(state, item.id)).sort((first, second) => priority(second) - priority(first));
                for (const item of offered) {
                    if (canAfford(state, item.price)) acted = game.dispatch({ type: 'purchase', purchasableId: item.id }) || acted;
                    else if (priority(item) > 1 || (priority(item) === 1 && secondsUntilAffordable(game, item) < savingSeconds)) break;
                }
                const activity = chooseActivity(game, offered.find((item) => !canAfford(state, item.price)));
                if (activity !== undefined) acted = game.dispatch({ type: 'setActivity', activity }) || acted;
                const slots = scriptSlots(game);
                const scriptsToFill = networkCapacity(game) / (game.stat('threadsPerScript') * game.stat('requestsPerThread'));
                const searchers = Math.min(Math.ceil(slots / 2), Math.max(1, isThrottled(game) ? Math.ceil(scriptsToFill) : Math.floor(scriptsToFill)));
                const targets = jobTargets(game, slots - searchers);
                for (const job of jobs) {
                    if (!isJobUnlocked(game, job.id)) continue;
                    if (assignedScripts(game, job.id) > targets[job.id]) acted = game.dispatch({ type: 'assignJob', jobId: job.id, change: -1 }) || acted;
                    if (assignedScripts(game, job.id) < targets[job.id] && dirbustingScripts(game) > 1) acted = game.dispatch({ type: 'assignJob', jobId: job.id, change: 1 }) || acted;
                }
                for (const [index, proxy] of state.network.proxies.entries()) {
                    if (proxy.diesAtSeconds <= state.elapsedSeconds) acted = game.dispatch({ type: 'replaceProxy', proxyIndex: index }) || acted;
                }
            }
            const plan = currentSearch(game);
            let spent = state.search.requestsSpent;
            let requestsLeft = 0;
            for (const phase of plan.phases) {
                const boundary = phase.requestsUntilNext ?? phase.size;
                if (spent >= boundary) { spent -= boundary; continue; }
                requestsLeft = Math.max(0, phase.size - spent);
                if (requestsLeft > 0) break;
            }
            const stuck = plan.blockedBy !== null || requestsLeft / Math.max(1, effectiveRate(game) * game.stat('searchEfficiency')) > 180;
            const manualDelay = state.currentLevel < 5 ? [45, 60, 75, 60][state.currentLevel - 1]! : 100 + Math.sqrt(state.currentLevel) * 3;
            if ((purist || !state.flags.automated || stuck) && memory.handSeconds >= manualDelay) {
                const target = entrance(state.currentLevel + 1);
                memory.handSeconds = 0;
                return target.credentials
                    ? game.dispatch({ type: 'submitCredentials', url: target.url, ...target.credentials }) || acted
                    : game.dispatch({ type: 'navigate', url: target.url }) || acted;
            }
            return acted;
        },
    };
}

function jobTargets(game: Game, free: number): Record<JobId, number> {
    const { state } = game;
    const targets: Record<JobId, number> = { scraping: 0, ticketing: 0, riddles: 0 };
    const unlocked = jobs.filter((job) => isJobUnlocked(game, job.id));
    if (unlocked.length === 0 || free <= 0) return targets;
    const goals = upgrades.filter((item) => !owns(state, item.id) && item.level <= state.currentLevel + lookaheadLevels);
    const waits = unlocked.map((job) => Math.max(0, goals.reduce((sum, item) => sum + (item.price[job.resource] ?? 0), 0) - (state.resources[job.resource] ?? 0)) / game.stat(job.rateStat));
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

function secondsUntilAffordable(game: Game, item: Upgrade): number {
    return Math.max(0, ...Object.entries(item.price).map(([resource, amount]) => (amount - (game.state.resources[resource] ?? 0)) / Math.max(0.001, incomePerSecond(game, resource))));
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
