import { currentSearch } from '../content/act-one/automation.ts';
import { assignedScripts, dirbustingScripts, isJobUnlocked, scriptSlots } from '../content/act-one/economy.ts';
import { entrance } from '../content/act-one/levels.ts';
import { effectiveRate } from '../content/act-one/network.ts';
import { isUpgradeRevealed } from '../content/act-one/progress.ts';
import { offeredUpgrades, upgrades } from '../content/act-one/upgrades.ts';
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
                const answer = state.captcha.kind === 'text' ? state.captcha.word : state.captcha.correctTiles.join(',');
                return game.dispatch({ type: 'answerCaptcha', answer });
            }
            if (!purist && state.currentLevel >= 5 && !state.flags.automated) return game.dispatch({ type: 'automate' });
            let acted = false;
            if (state.flags.automated) {
                const blocker = currentSearch(game).blockedBy;
                const offered = offeredUpgrades(state).filter((item) => isUpgradeRevealed(state, item.id)).sort((first, second) => Number(second.fixes === blocker) - Number(first.fixes === blocker));
                for (const item of offered) {
                    if (canAfford(state, item.price)) acted = game.dispatch({ type: 'purchase', purchasableId: item.id }) || acted;
                }
                const neededMoney = upgrades.filter((item) => !state.purchases[item.id]).reduce((sum, item) => sum + (item.price.money ?? 0), 0);
                const neededWords = upgrades.filter((item) => !state.purchases[item.id]).reduce((sum, item) => sum + (item.price.words ?? 0), 0);
                if ((state.resources.money ?? 0) < neededMoney) acted = game.dispatch({ type: 'work' }) || acted;
                if ((state.resources.words ?? 0) < neededWords) acted = game.dispatch({ type: 'scour' }) || acted;
                const slots = scriptSlots(game);
                const targets = {
                    ticketing: (state.resources.money ?? 0) >= neededMoney ? 0 : Math.max(1, Math.floor(slots * 0.4)),
                    scraping: (state.resources.words ?? 0) >= neededWords || slots < 4 ? 0 : Math.max(1, Math.floor(slots * 0.2)),
                };
                for (const job of ['ticketing', 'scraping'] as const) {
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
