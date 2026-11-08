import { describe, expect, it } from 'vitest';
import { testContent } from '../testing/test-content.ts';
import type { GameEvent } from './events.ts';
import { Game } from './game.ts';
import { createInitialState } from './state.ts';

function createTestGame(seed = 1): Game {
    return new Game(testContent, createInitialState(testContent, seed));
}

describe('Game', () => {
    it('spends resources and applies modifiers when purchasing', () => {
        const game = createTestGame();
        game.gainResource('points', 5);
        expect(game.dispatch({ type: 'purchase', purchasableId: 'booster' })).toBe(true);
        expect(game.state.resources.points).toBe(0);
        expect(game.stat('income')).toBe(2);
    });

    it('rejects purchases that are unaffordable or sold out', () => {
        const game = createTestGame();
        expect(game.dispatch({ type: 'purchase', purchasableId: 'booster' })).toBe(false);
        game.gainResource('points', 10);
        game.dispatch({ type: 'purchase', purchasableId: 'booster' });
        expect(game.dispatch({ type: 'purchase', purchasableId: 'booster' })).toBe(false);
        expect(game.state.purchases.booster).toBe(1);
    });

    it('announces each milestone once, with the time it was reached', () => {
        const game = createTestGame();
        const events: GameEvent[] = [];
        game.subscribe((event) => events.push(event));
        game.advance(20);
        const milestoneEvents = events.filter((event) => event.type === 'milestoneReached');
        expect(milestoneEvents).toEqual([{ type: 'milestoneReached', milestoneId: 'tenPoints' }]);
        expect(game.state.reachedMilestones.tenPoints).toBe(10);
    });

    it('produces identical states for identical seeds and actions', () => {
        const first = createTestGame(42);
        const second = createTestGame(42);
        for (const game of [first, second]) {
            game.advance(7.5, 0.5);
            game.dispatch({ type: 'purchase', purchasableId: 'booster' });
            game.advance(30);
        }
        expect(first.state).toEqual(second.state);
    });

    it('caps offline progress and reports what was gained', () => {
        const game = createTestGame();
        const events: GameEvent[] = [];
        game.subscribe((event) => events.push(event));
        const summary = game.catchUp(10 * 3_600);
        expect(summary.simulatedSeconds).toBe(3_600);
        expect(summary.resourceGains.points).toBeCloseTo(3_600);
        expect(events).toContainEqual({ type: 'offlineProgressApplied', summary });
    });
});
