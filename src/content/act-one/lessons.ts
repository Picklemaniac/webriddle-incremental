import type { GameState } from '../../core/state.ts';
import { entrance } from './levels.ts';
import type { BlockReason } from './search.ts';

export type Lesson = 'userAgent' | 'folder' | 'extension' | 'wildcard' | 'credentials' | 'leet' | 'number' | 'twoWords';

export const lessonFallbackSeconds = 300;

export function lessonFor(blockedBy: BlockReason | null, level: number): Lesson | null {
    if (blockedBy !== null) return blockedBy === 'unguessable' ? null : blockedBy;
    const { kind } = entrance(level);
    return kind === 'leet' || kind === 'number' || kind === 'twoWords' ? kind : null;
}

export function isLearned(state: GameState, lesson: Lesson): boolean {
    return state.flags[`learned:${lesson}`] === true;
}
