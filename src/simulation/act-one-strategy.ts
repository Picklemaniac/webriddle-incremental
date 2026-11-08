import { currentSearch } from '../content/act-one/automation.ts';
import { activities, activityRate, assignedScripts, dirbustingScripts, isJobUnlocked, isResourceRevealed, scriptSlots, type ActivityId } from '../content/act-one/economy.ts';
import { entrance } from '../content/act-one/levels.ts';
import { effectiveRate, isThrottled, networkCapacity, requestedRate } from '../content/act-one/network.ts';
import { isUpgradeRevealed, owns } from '../content/act-one/progress.ts';
import { capacityUpgrades, offeredUpgrades, upgrades, type Upgrade } from '../content/act-one/upgrades.ts';
import type { Game } from '../core/game.ts';
import { canAfford } from '../core/purchasing.ts';
import type { Strategy } from './strategies.ts';

interface DecisionMemory { level: number; handSeconds: number; captchaSeconds: number }

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
                const offered = offeredUpgrades(state).filter((item) => isUpgradeRevealed(state, item.id)).sort((first, second) => Number(urgent(second)) - Number(urgent(first)));
                for (const item of offered) {
                    if (canAfford(state, item.price)) acted = game.dispatch({ type: 'purchase', purchasableId: item.id }) || acted;
                    else if (urgent(item)) break;
                }
                const needed = (resource: string): number => upgrades.filter((item) => !state.purchases[item.id]).reduce((sum, item) => sum + (item.price[resource] ?? 0), 0);
                const neededMoney = needed('money');
                const neededData = needed('data');
                const neededInsight = needed('insight');
                const activity = chooseActivity(game, offered.find((item) => !canAfford(state, item.price)));
                if (activity !== undefined) acted = game.dispatch({ type: 'setActivity', activity }) || acted;
                const slots = scriptSlots(game);
                const targets = {
                    ticketing: (state.resources.money ?? 0) >= neededMoney ? 0 : Math.max(1, Math.floor(slots * 0.4)),
                    scraping: (state.resources.data ?? 0) >= neededData || slots < 4 ? 0 : Math.max(1, Math.floor(slots * 0.2)),
                    riddles: (state.resources.insight ?? 0) >= neededInsight || slots < 3 ? 0 : Math.max(1, Math.floor(slots * 0.2)),
                };
                const perScript = game.stat('threadsPerScript') * game.stat('requestsPerThread');
                const safeScripts = isThrottled(game) ? slots : Math.max(1, Math.floor(networkCapacity(game) / perScript));
                const unlockedJobs = (['ticketing', 'riddles', 'scraping'] as const).filter((job) => isJobUnlocked(game, job));
                const firstJob = unlockedJobs[0];
                if (firstJob !== undefined) {
                    const assigned = unlockedJobs.reduce((sum, job) => sum + targets[job], 0);
                    targets[firstJob] += Math.max(0, slots - safeScripts - assigned);
                }
                for (const job of ['ticketing', 'scraping', 'riddles'] as const) {
                    if (!isJobUnlocked(game, job)) continue;
                    if (assignedScripts(game, job) > targets[job]) {
                        acted = game.dispatch({ type: 'assignJob', jobId: job, change: -1 }) || acted;
                    }
                    if (assignedScripts(game, job) < targets[job] && dirbustingScripts(game) > 1) {
                        acted = game.dispatch({ type: 'assignJob', jobId: job, change: 1 }) || acted;
                    }
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

function chooseActivity(game: Game, goal: Upgrade | undefined): ActivityId | undefined {
    if (goal === undefined) return undefined;
    const waits = activities.filter((activity) => isResourceRevealed(game, activity.resource)).map((activity) => ({
        id: activity.id,
        seconds: Math.max(0, (goal.price[activity.resource] ?? 0) - (game.state.resources[activity.resource] ?? 0)) / activityRate(game, activity.id),
    }));
    const longest = waits.reduce<{ id: ActivityId; seconds: number } | undefined>((best, wait) => best === undefined || wait.seconds > best.seconds ? wait : best, undefined);
    return longest !== undefined && longest.seconds > 0 ? longest.id : undefined;
}
