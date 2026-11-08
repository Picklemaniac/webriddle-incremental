import type { GameContent } from './content.ts';

export interface GameState {
    elapsedSeconds: number;
    randomState: number;
    currentLevel: number;
    levelProgress: number;
    browserUrl: string;
    resources: Record<string, number>;
    purchases: Record<string, number>;
    reachedMilestones: Record<string, number>;
}

export function createInitialState(content: GameContent, seed: number): GameState {
    return {
        elapsedSeconds: 0,
        randomState: seed,
        currentLevel: 1,
        levelProgress: 0,
        browserUrl: content.startUrl,
        resources: Object.fromEntries(content.resources.map((resource) => [resource.id, 0])),
        purchases: {},
        reachedMilestones: {},
    };
}
