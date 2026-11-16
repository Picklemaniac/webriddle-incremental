import type { GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import type { GameState } from '../../core/state.ts';
import { dirbustingScripts } from './economy.ts';
import { entrance, firstGeneratedLevel } from './levels.ts';
import { effectiveRate } from './network.ts';
import { automationBootSeconds, automationElapsed, increment, markNeeded, noticeOnce, owns, reachLevel, solveLevel } from './progress.ts';
import { salts, unitHash } from './riddle.ts';
import { capabilitySignature, currentPhase, planSearch, requestsKept, searchCapabilities, type SearchPlan } from './search.ts';

const plans = new Map<string, SearchPlan>();
const dragSeconds = 60;
const searchQuerySeconds = 60;
// A page that a search engine has indexed is this many levels ahead. Nothing past the last level of the act has been indexed.
const fewestLevelsAhead = 2;
const mostLevelsAhead = 4;
const lastIndexedLevel = 1000;
const searchCards: readonly string[] = ['dorking', 'indexCache', 'searchAlerts'];

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

// A page behind a login is not in any search engine.
function canBeIndexed(level: number): boolean {
    return level >= firstGeneratedLevel && level <= lastIndexedLevel && entrance(level).credentials === null;
}

// With a search engine card the script asks for pages of the riddle once a minute. Now and then a page has been indexed that it has not seen: a level further on, and the script goes there.
// A new page is indexed as DirBuster gets on, so the finds keep step with it and do not pile up while it stands still or while the player is away. Each card finds a page as soon as it is bought.
function askSearchEngine(game: Game): void {
    const { state } = game;
    const owned = searchCards.filter((id) => owns(state, id)).length;
    if (owned === 0 || dirbustingScripts(game) === 0) return;
    if (owned > (state.statistics.searchCardsUsed ?? 0)) {
        state.statistics.searchCardsUsed = owned;
        state.statistics.nextSearchQueryAt = state.elapsedSeconds;
        state.flags.pageIndexed = true;
    }
    if (state.elapsedSeconds < (state.statistics.nextSearchQueryAt ?? 0)) return;
    state.statistics.nextSearchQueryAt = state.elapsedSeconds + searchQuerySeconds;
    let found = state.currentLevel;
    if (state.flags.pageIndexed === true) {
        found += fewestLevelsAhead + Math.floor(unitHash(state.currentLevel, salts.levelsAhead) * (mostLevelsAhead - fewestLevelsAhead + 1));
        while (found > state.currentLevel && !canBeIndexed(found)) found--;
    }
    state.flags.pageIndexed = false;
    if (found === state.currentLevel) {
        game.announce({ type: 'searchQuery' });
        return;
    }
    // Only the page that was found says what kind of answer it is. The skipped levels were never seen, but a page in a new folder shows that there are folders.
    learnFromFoundLevels(state);
    state.statistics.learnedThrough = found - 1;
    if (entrance(found).folder !== entrance(state.currentLevel).folder) markNeeded(state, 'dirb');
    reachLevel(game, found, 'search');
}

export const dirbuster: GameSystem = {
    update(game, deltaSeconds) {
        const { state } = game;
        if (!state.flags.automated || automationElapsed(state) < automationBootSeconds) return;
        learnFromFoundLevels(state);
        askSearchEngine(game);
        const rate = effectiveRate(game);
        if (rate === 0) return;
        increment(state, 'requestsSent', rate * deltaSeconds);
        let budget = rate * deltaSeconds;
        for (let finds = 0; finds < 100 && budget > 0; finds++) {
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
            if (plan.finds === 'level') {
                solveLevel(game, 'script');
                if (unitHash(state.currentLevel, salts.indexed) < game.stat('searchFindShare')) state.flags.pageIndexed = true;
            } else state.search = { stage: state.search.stage + 1, requestsSpent: 0, configuration: state.search.configuration };
        }
    },
};
