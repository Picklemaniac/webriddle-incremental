import type { Game } from './game.ts';

export interface OfflineSummary {
    readonly awaySeconds: number;
    readonly simulatedSeconds: number;
    readonly levelsGained: number;
    readonly resourceGains: Readonly<Record<string, number>>;
}

const maximumOfflineSteps = 10_000;

export function simulateOfflineProgress(game: Game, awaySeconds: number): OfflineSummary {
    const simulatedSeconds = Math.min(awaySeconds, game.content.offlineCapSeconds(game.state));
    const levelBefore = game.state.currentLevel;
    const resourcesBefore = { ...game.state.resources };
    game.advance(simulatedSeconds, Math.max(1, simulatedSeconds / maximumOfflineSteps));
    return {
        awaySeconds,
        simulatedSeconds,
        levelsGained: game.state.currentLevel - levelBefore,
        resourceGains: Object.fromEntries(
            Object.entries(game.state.resources).map(([resourceId, amount]) => [
                resourceId,
                amount - (resourcesBefore[resourceId] ?? 0),
            ]),
        ),
    };
}
