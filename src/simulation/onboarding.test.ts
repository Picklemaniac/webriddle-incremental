import { describe, expect, it } from 'vitest';
import { actOneContent } from '../content/act-one/index.ts';
import { urlOfLevel } from '../content/act-one/levels.ts';
import { automationElapsed } from '../content/act-one/progress.ts';
import { Game } from '../core/game.ts';
import { createInitialState } from '../core/state.ts';
import { actOneStrategy } from './act-one-strategy.ts';
import { AutoPlayer } from './auto-player.ts';

function startAutomation(): Game {
    const game = new Game(actOneContent, createInitialState(actOneContent, 1));
    game.state.currentLevel = 5;
    game.state.browserUrl = urlOfLevel(5);
    game.state.resources.insight = 20;
    expect(game.dispatch({ type: 'automate' })).toBe(true);
    return game;
}

describe('Act I onboarding', () => {
    it('lets the script start before requests or other systems appear', () => {
        const game = startAutomation();
        game.advance(5);
        expect(game.state.statistics.requestsSent ?? 0).toBe(0);
        expect(game.state.flags.insightRevealed).not.toBe(true);
        expect(game.state.flags.upgradesRevealed).not.toBe(true);
        expect(game.state.flags.findingsRevealed).not.toBe(true);
        game.advance(0.25);
        expect(game.state.statistics.requestsSent).toBeGreaterThan(0);
    });

    it('introduces insight, one upgrade and money separately even with banked resources', () => {
        const game = startAutomation();
        game.state.resources.money = 100000;
        game.state.resources.words = 100000;
        expect(game.dispatch({ type: 'purchase', purchasableId: 'curlBatch' })).toBe(false);
        game.advance(44);
        expect(game.state.flags.insightRevealed).not.toBe(true);
        game.advance(2);
        expect(game.state.flags.insightRevealed).toBe(true);
        expect(game.state.flags.upgradesRevealed).not.toBe(true);
        game.advance(43);
        expect(game.dispatch({ type: 'purchase', purchasableId: 'curlBatch' })).toBe(false);
        game.advance(2);
        expect(Object.keys(game.state.flags).filter((flag) => flag.startsWith('seen:'))).toEqual(['seen:curlBatch']);
        expect(game.dispatch({ type: 'purchase', purchasableId: 'curlBatch' })).toBe(true);
        expect(game.dispatch({ type: 'purchase', purchasableId: 'throttle' })).toBe(false);
        game.advance(43);
        expect(game.state.flags.moneyRevealed).not.toBe(true);
        game.advance(2);
        expect(game.state.flags.moneyRevealed).toBe(true);
        expect(game.state.flags.wordsRevealed).not.toBe(true);
        expect(game.state.flags.scriptsRevealed).not.toBe(true);
    });

    it('spaces new systems and upgrades instead of revealing a backlog together', () => {
        const game = startAutomation();
        const robot = new AutoPlayer(actOneStrategy(4));
        const systems = new Set(['insightRevealed', 'moneyRevealed', 'wordsRevealed', 'scriptsRevealed', 'networkRevealed', 'findingsRevealed']);
        const observed = new Set<string>();
        const introductions: { seconds: number; id: string }[] = [];
        for (let second = 0; second < 600; second++) {
            robot.playStep(game, 1);
            const introduced = Object.keys(game.state.flags).filter((flag) => game.state.flags[flag] &&
                (systems.has(flag) || flag.startsWith('seen:')) && !observed.has(flag));
            expect(introduced.length).toBeLessThanOrEqual(1);
            for (const id of introduced) {
                introductions.push({ seconds: automationElapsed(game.state), id });
                observed.add(id);
            }
            const unbought = [...observed].filter((flag) => flag.startsWith('seen:') && !game.state.purchases[flag.slice(5)]);
            expect(unbought.length).toBeLessThanOrEqual(3);
        }
        expect(introductions[0]).toEqual({ seconds: 46, id: 'insightRevealed' });
        expect(introductions[1]).toEqual({ seconds: 91, id: 'seen:curlBatch' });
        expect(introductions.some(({ id }) => id === 'networkRevealed')).toBe(true);
        expect(introductions.some(({ id }) => id === 'wordsRevealed')).toBe(true);
        for (let index = 1; index < introductions.length; index++) {
            expect(introductions[index]!.seconds - introductions[index - 1]!.seconds).toBeGreaterThanOrEqual(30);
        }
    });
});
