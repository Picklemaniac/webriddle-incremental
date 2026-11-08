import type { Game } from './game.ts';

export interface OfflineSummary {
    readonly awaySeconds: number;
    readonly simulatedSeconds: number;
    readonly levelsGained: number;
    readonly resourceGains: Readonly<Record<string, number>>;
}

export function simulateOfflineProgress(game: Game, awaySeconds: number): OfflineSummary {
    const simulatedSeconds = Number.isFinite(awaySeconds) ? Math.max(0, Math.min(awaySeconds, game.content.offlineCapSeconds(game.state))) : 0;
    const levelBefore = game.state.currentLevel;
    const resourcesBefore = { ...game.state.resources };
    game.advance(simulatedSeconds, 1);
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
