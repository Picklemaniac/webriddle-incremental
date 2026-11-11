import { describe, expect, it } from 'vitest';
import { actOneContent } from '../content/act-one/index.ts';
import { urlOfLevel } from '../content/act-one/levels.ts';
import { automationElapsed, isUpgradeRevealed } from '../content/act-one/progress.ts';
import { planSearch, searchCapabilities } from '../content/act-one/search.ts';
import { Game } from '../core/game.ts';
import { createInitialState } from '../core/state.ts';
import { actOneStrategy } from './act-one-strategy.ts';
import { AutoPlayer } from './auto-player.ts';

function startAutomation(): Game {
    const game = new Game(actOneContent, createInitialState(actOneContent, 1));
    game.state.currentLevel = 5;
    game.state.browserUrl = urlOfLevel(5);
    expect(game.dispatch({ type: 'automate' })).toBe(true);
    return game;
}

describe('Act I onboarding', () => {
    it('lets the script start before requests or other systems appear', () => {
        const game = startAutomation();
        game.advance(5);
        expect(game.state.statistics.requestsSent ?? 0).toBe(0);
        expect(game.state.flags.upgradesRevealed).not.toBe(true);
        expect(game.state.flags.findingsRevealed).not.toBe(true);
        game.advance(0.25);
        expect(game.state.statistics.requestsSent).toBeGreaterThan(0);
    });

    it('shows the first upgrade before the insight it costs, even with banked resources', () => {
        const game = startAutomation();
        game.state.resources.insight = 100000;
        game.state.resources.money = 100000;
        game.state.resources.data = 100000;
        expect(game.dispatch({ type: 'purchase', purchasableId: 'curlBatch' })).toBe(false);
        game.advance(74);
        expect(game.state.flags.upgradesRevealed).not.toBe(true);
        game.advance(2);
        expect(Object.keys(game.state.flags).filter((flag) => flag.startsWith('seen:'))).toEqual(['seen:curlBatch']);
        expect(game.state.flags.insightRevealed).not.toBe(true);
        game.advance(6);
        expect(game.state.flags.insightRevealed).toBe(true);
        expect(game.dispatch({ type: 'purchase', purchasableId: 'curlBatch' })).toBe(true);
        expect(game.dispatch({ type: 'purchase', purchasableId: 'throttle' })).toBe(false);
        game.advance(43);
        expect(game.state.flags.moneyRevealed).not.toBe(true);
        expect(game.state.flags.dataRevealed).not.toBe(true);
        expect(game.state.flags.scriptsRevealed).not.toBe(true);
    });

    it('spaces new systems and upgrades instead of revealing a backlog together', () => {
        const game = startAutomation();
        const robot = new AutoPlayer(actOneStrategy(4));
        const systems = new Set(['insightRevealed', 'moneyRevealed', 'dataRevealed', 'scriptsRevealed', 'networkRevealed', 'findingsRevealed']);
        const firstJobCard = 'seen:otherRiddles';
        const observed = new Set<string>();
        const introductions: { seconds: number; id: string }[] = [];
        for (let second = 0; second < 600; second++) {
            robot.playStep(game, 1);
            const introduced = Object.keys(game.state.flags).filter((flag) => game.state.flags[flag] &&
                (systems.has(flag) || flag.startsWith('seen:')) && flag !== firstJobCard && !observed.has(flag));
            expect(introduced.length).toBeLessThanOrEqual(1);
            for (const id of introduced) {
                introductions.push({ seconds: automationElapsed(game.state), id });
                observed.add(id);
            }
            const unbought = [...observed].filter((flag) => flag.startsWith('seen:') && !game.state.purchases[flag.slice(5)]);
            expect(unbought.length).toBeLessThanOrEqual(3);
        }
        expect(introductions[0]).toEqual({ seconds: 76, id: 'seen:curlBatch' });
        expect(introductions[1]).toEqual({ seconds: 82, id: 'insightRevealed' });
        expect(introductions.some(({ id }) => id === 'moneyRevealed')).toBe(true);
        expect(introductions.some(({ id }) => id === 'scriptsRevealed')).toBe(true);
        expect(game.state.flags[firstJobCard]).toBe(true);
        for (let index = 1; index < introductions.length; index++) {
            const { seconds, id } = introductions[index]!;
            const followsItsFirstPrice = id === 'insightRevealed' || id === 'moneyRevealed' || id === 'dataRevealed';
            expect(seconds - introductions[index - 1]!.seconds).toBeGreaterThanOrEqual(followsItsFirstPrice ? 6 : 30);
        }
    });

    it('shows the Scripts panel with its first job before the server limit starts to matter', () => {
        const game = startAutomation();
        Object.assign(game.state.flags, { 'seen:curlBatch': true, insightRevealed: true, 'seen:ram': true, moneyRevealed: true });
        game.advance(200);
        game.state.purchases.curlBatch = 1;
        game.state.purchases.ram = 1;
        game.invalidateStats();
        game.advance(1);
        expect(game.state.flags.scriptsRevealed).toBe(true);
        expect(isUpgradeRevealed(game.state, 'otherRiddles')).toBe(true);
        expect(game.state.flags.networkRevealed).not.toBe(true);
        let seconds = 0;
        while (game.state.flags.networkRevealed !== true && seconds < 120) {
            game.advance(1);
            seconds++;
        }
        expect(seconds).toBeGreaterThanOrEqual(30);
        expect(seconds).toBeLessThan(120);
        expect(game.state.network.heat).toBeLessThan(5);
    });

    it('introduces data only once DirBuster has found an answer that is not in words.txt', () => {
        const game = startAutomation();
        Object.assign(game.state.flags, { 'seen:curlBatch': true, insightRevealed: true, moneyRevealed: true });
        game.state.purchases.fakeUserAgent = 1;
        game.advance(60);
        expect(isUpgradeRevealed(game.state, 'english10k')).toBe(false);
        const isGuessed = (level: number): boolean => planSearch(level, searchCapabilities(game.state)).learns.includes('english10k');
        const guessedLevel = Array.from({ length: 200 }, (_, index) => index + 30).find(isGuessed)!;
        game.state.currentLevel = guessedLevel - 1;
        let cardSecond: number | undefined;
        let second = 0;
        for (; second < 3600 && game.state.flags.dataRevealed !== true; second++) {
            if (game.state.currentLevel < guessedLevel) expect(isUpgradeRevealed(game.state, 'english10k')).toBe(false);
            game.advance(1);
            if (cardSecond === undefined && isUpgradeRevealed(game.state, 'english10k')) cardSecond = second;
        }
        expect(game.state.currentLevel).toBeGreaterThanOrEqual(guessedLevel);
        expect(game.state.flags.dataRevealed).toBe(true);
        expect(second - cardSecond!).toBeGreaterThanOrEqual(6);
    });
});
