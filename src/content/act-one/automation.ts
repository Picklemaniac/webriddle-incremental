import type { GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import type { GameState } from '../../core/state.ts';
import { entrance } from './levels.ts';
import { effectiveRate } from './network.ts';
import { automationBootSeconds, automationElapsed, increment, markNeeded, noticeOnce, solveLevel } from './progress.ts';
import { capabilitySignature, currentPhase, planSearch, requestsKept, searchCapabilities, type SearchPlan } from './search.ts';

const plans = new Map<string, SearchPlan>();
const dragSeconds = 60;

export function currentSearch(game: Game): SearchPlan {
    const { search } = game.state;
    const fresh = plannedSearch(game, '');
    return search.requestsSpent === 0 || search.configuration === fresh.signature ? fresh : plannedSearch(game, search.configuration);
}

function plannedSearch(game: Game, resumedSignature: string): SearchPlan {
    const { currentLevel, search } = game.state;
    const capabilities = searchCapabilities(game.state);
    const key = `${currentLevel + 1}|${search.stage}|${capabilitySignature(capabilities)}|${resumedSignature}`;
    let plan = plans.get(key);
    if (!plan) {
        if (plans.size > 4096) plans.clear();
        plan = planSearch(currentLevel + 1, capabilities, search.stage, resumedSignature);
        plans.set(key, plan);
    }
    return plan;
}

// A longer wordlist, a new folder or a new kind of answer can only be recognised once an answer that takes one has been found. Its card is offered from then on.
function learnFromFoundLevels(state: GameState): void {
    const learnedThrough = state.statistics.learnedThrough ?? state.currentLevel;
    if (learnedThrough < state.currentLevel) {
        const capabilities = searchCapabilities(state);
        for (let level = learnedThrough + 1; level <= state.currentLevel; level++) {
            for (const id of planSearch(level, capabilities).learns) markNeeded(state, id);
        }
    }
    state.statistics.learnedThrough = state.currentLevel;
}

export const dirbuster: GameSystem = {
    update(game, deltaSeconds) {
        const { state } = game;
        if (!state.flags.automated || automationElapsed(state) < automationBootSeconds) return;
        learnFromFoundLevels(state);
        const rate = effectiveRate(game);
        if (rate === 0) return;
        increment(state, 'requestsSent', rate * deltaSeconds);
        let budget = rate * game.stat('searchEfficiency') * deltaSeconds;
        for (let finds = 0; finds < 100 && budget > 0; finds++) {
            if (entrance(state.currentLevel + 1).indexUnit < game.stat('dorkChance')) {
                solveLevel(game, 'search');
                continue;
            }
            const plan = currentSearch(game);
            if (plan.speed === 0) break;
            for (const id of plan.missing) markNeeded(state, id);
            if (state.search.configuration !== plan.signature) {
                state.search.requestsSpent = requestsKept(state.search.configuration, plan, state.search.requestsSpent);
                state.search.configuration = plan.signature;
            }
            const remaining = Math.max(0, plan.hitAt - state.search.requestsSpent);
            const found = budget * plan.speed >= remaining;
            const reached = found ? plan.hitAt : state.search.requestsSpent + budget * plan.speed;
            const { phase } = currentPhase(plan, reached);
            if (phase?.guessing) noticeOnce(game, 'bruteForce');
            if (phase?.booster !== undefined && state.elapsedSeconds - (state.statistics.lastSolveAt ?? 0) >= dragSeconds) markNeeded(state, phase.booster);
            if (!found) {
                state.search.requestsSpent = reached;
                break;
            }
            budget -= remaining / plan.speed;
            if (plan.finds === 'level') solveLevel(game, 'script');
            else state.search = { stage: state.search.stage + 1, requestsSpent: 0, configuration: state.search.configuration };
        }
    },
};
