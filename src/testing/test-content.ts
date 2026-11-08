import type { GameContent } from '../core/content.ts';

export const testContent: GameContent = {
    startUrl: 'http://riddle.example/',
    resources: [
        { id: 'points', name: 'Points' },
        { id: 'luck', name: 'Luck' },
    ],
    baseStats: { income: 1 },
    purchasables: [
        {
            id: 'booster',
            name: 'Booster',
            maximumCount: 1,
            cost: () => ({ points: 5 }),
            isAvailable: () => true,
            modifiers: () => [{ statId: 'income', operation: 'multiply', value: 2 }],
        },
    ],
    milestones: [{ id: 'tenPoints', name: 'Ten points', isReached: (state) => (state.resources.points ?? 0) >= 10 }],
    systems: [
        {
            update(game, deltaSeconds) {
                game.gainResource('points', game.stat('income') * deltaSeconds);
                game.gainResource('luck', game.random() * deltaSeconds);
            },
        },
    ],
    resolvePage: () => ({ statusCode: 404, html: '' }),
    handleNavigation: () => undefined,
    offlineCapSeconds: () => 3_600,
};
