import type { GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import { entrance } from './levels.ts';
import { effectiveRate } from './network.ts';
import { isLearned, lessonFallbackSeconds, lessonFor } from './lessons.ts';
import { automationBootSeconds, automationElapsed, increment, learn, noticeOnce, solveLevel } from './progress.ts';
import { capabilitySignature, planSearch, searchCapabilities, type BlockReason, type SearchPlan } from './search.ts';
import type { NoticeId } from './text.ts';

const blockedNotices: Readonly<Partial<Record<BlockReason, NoticeId>>> = {
    userAgent: 'userAgentBlock', folder: 'folderBlock', extension: 'extensionBlock',
    wildcard: 'wildcardBlock', credentials: 'credentialsBlock',
};
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
        const configuration = capabilitySignature(searchCapabilities(state));
        if (state.search.configuration !== configuration) {
            state.search.configuration = configuration;
            state.search.requestsSpent = 0;
        }
        trackLesson(game, deltaSeconds);
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
            const notice = plan.blockedBy === null ? undefined : blockedNotices[plan.blockedBy];
            if (notice) noticeOnce(game, notice);
            if (plan.blockedBy !== null) break;
            if (plan.bruteForce) noticeOnce(game, 'bruteForce');
            if (target.kind === 'leet') noticeOnce(game, 'leetAnswer');
            if (target.kind === 'number') noticeOnce(game, 'numberAnswer');
            if (target.kind === 'twoWords') noticeOnce(game, 'twoWordsAnswer');
            if (target.kind === 'phrase') noticeOnce(game, 'phraseWall');
            const remaining = Math.max(0, plan.hitAt - state.search.requestsSpent);
            if (budget < remaining) {
                state.search.requestsSpent += budget;
                break;
            }
            budget -= remaining;
            solveLevel(game, 'script');
            state.search.configuration = configuration;
        }
    },
};

function trackLesson(game: Game, deltaSeconds: number): void {
    const { state } = game;
    const lesson = lessonFor(currentSearch(game).blockedBy, state.currentLevel + 1);
    if (lesson === null || isLearned(state, lesson)) return;
    increment(state, `stuck:${lesson}`, deltaSeconds);
    if ((state.statistics[`stuck:${lesson}`] ?? 0) >= lessonFallbackSeconds) learn(game, lesson);
}
