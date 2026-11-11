import type { GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import type { GameState } from '../../core/state.ts';
import { entrance, type EntranceKind } from './levels.ts';
import { effectiveRate } from './network.ts';
import { automationBootSeconds, automationElapsed, increment, markNeeded, noticeOnce, solveLevel } from './progress.ts';
import { capabilitySignature, planSearch, searchCapabilities, type SearchPlan } from './search.ts';
const wordlistKinds: ReadonlySet<EntranceKind> = new Set<EntranceKind>(['word', 'extension', 'credentials']);
const plans = new Map<string, SearchPlan>();
const dragSeconds = 60;

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

// A new folder or a new kind of answer can only be recognised once one has been found. Its card is offered from then on.
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
        for (let solved = 0; solved < 100 && budget > 0; solved++) {
            const target = entrance(state.currentLevel + 1);
            if (target.indexUnit < game.stat('dorkChance')) {
                solveLevel(game, 'search');
                continue;
            }
            const plan = currentSearch(game);
            if (plan.speed === 0) break;
            for (const id of plan.missing) markNeeded(state, id);
            if (state.elapsedSeconds - (state.statistics.lastSolveAt ?? 0) >= dragSeconds) for (const id of plan.boosters) markNeeded(state, id);
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

