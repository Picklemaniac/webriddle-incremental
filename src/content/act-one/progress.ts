import type { SolveMethod } from '../../core/events.ts';
import type { Game } from '../../core/game.ts';
import type { GameState } from '../../core/state.ts';
import { urlOfLevel } from './levels.ts';
import type { NoticeId } from './text.ts';

export const automationLevel = 5;
export const automationBootSeconds = 5;
const handSolveInsight = 5;

export function automationElapsed(state: GameState): number {
    if (!state.flags.automated) return 0;
    return Math.max(0, state.elapsedSeconds - (state.statistics.automatedAt ?? 0));
}

export function isUpgradeRevealed(state: GameState, purchasableId: string): boolean {
    return state.flags[`seen:${purchasableId}`] === true || owns(state, purchasableId);
}

export function solveLevel(game: Game, method: SolveMethod): void {
    const { state } = game;
    const previousUrl = urlOfLevel(state.currentLevel);
    state.currentLevel += 1;
    state.search = { requestsSpent: 0, configuration: '' };
    state.visitedLevels[urlOfLevel(state.currentLevel)] = state.currentLevel;
    state.statistics.lastSolveAt = state.elapsedSeconds;
    if (state.browserUrl === previousUrl) {
        state.browserUrl = urlOfLevel(state.currentLevel);
    }
    increment(state, `${method}Solves`);
    if (method === 'hand' && state.flags.insightRevealed === true) game.gainResource('insight', handSolveInsight);
    const boostedLevelsLeft = state.statistics.boostedLevels ?? 0;
    if (boostedLevelsLeft > 0) {
        state.statistics.boostedLevels = boostedLevelsLeft - 1;
        if (boostedLevelsLeft === 1) {
            game.invalidateStats();
        }
    }
    game.announce({ type: 'levelSolved', level: state.currentLevel, method });
}

export function noticeOnce(game: Game, noticeId: NoticeId): void {
    const flag = `notice:${noticeId}`;
    if (game.state.flags[flag] !== true) {
        game.state.flags[flag] = true;
        game.announce({ type: 'notice', noticeId });
    }
}

export function increment(state: GameState, statisticId: string, amount = 1): void {
    state.statistics[statisticId] = (state.statistics[statisticId] ?? 0) + amount;
}

export function owns(state: GameState, purchasableId: string): boolean {
    return (state.purchases[purchasableId] ?? 0) > 0;
}
