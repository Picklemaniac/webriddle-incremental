import type { GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import { entrance, type EntranceKind } from './levels.ts';
import { effectiveRate } from './network.ts';
import { automationBootSeconds, automationElapsed, increment, noticeOnce, solveLevel } from './progress.ts';
import { capabilitySignature, planSearch, searchCapabilities, type SearchPlan } from './search.ts';
const wordlistKinds: ReadonlySet<EntranceKind> = new Set<EntranceKind>(['word', 'extension', 'credentials']);
const plans = new Map<string, SearchPlan>();

export function currentSearch(game: Game): SearchPlan {
    const capabilities = searchCapabilities(game.state);
    const key = `${game.state.currentLevel + 1}|${capabilitySignature(capabilities)}`;
    let plan = plans.get(key);
    if (!plan) {
        if (plans.size > 4096) plans.clear();
        plan = planSearch(game.state.currentLevel + 1, capabilities);
        plans.set(key, plan);
    }
    return plan;
}

export const dirbuster: GameSystem = {
    update(game, deltaSeconds) {
        const { state } = game;
        if (!state.flags.automated || automationElapsed(state) < automationBootSeconds) return;
        const rate = effectiveRate(game);
        if (rate === 0) return;
        increment(state, 'requestsSent', rate * deltaSeconds);
        let budget = rate * game.stat('searchEfficiency') * deltaSeconds;
        for (let solved = 0; solved < 100 && budget > 0; solved++) {
            const target = entrance(state.currentLevel + 1);
            if (target.indexUnit < game.stat('dorkChance')) {
                solveLevel(game, 'search');
                continue;
            }
            const plan = currentSearch(game);
            if (plan.speed === 0) break;
            if (state.search.configuration !== plan.signature) {
                state.search.configuration = plan.signature;
                state.search.requestsSpent = 0;
            }
            if (plan.bruteForce) noticeOnce(game, 'bruteForce');
            if (plan.bruteForce && wordlistKinds.has(target.kind)) state.flags.wordlistExhausted = true;
            const remaining = Math.max(0, plan.hitAt - state.search.requestsSpent);
            if (budget * plan.speed < remaining) {
                state.search.requestsSpent += budget * plan.speed;
                break;
            }
            budget -= remaining / plan.speed;
            solveLevel(game, 'script');
        }
    },
};

