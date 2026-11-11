import { describe, expect, it } from 'vitest';
import { sandboxContent } from '../testing/sandbox.ts';
import { backlogSeconds, incomePerSecond } from '../content/act-one/economy.ts';
import { actOneContent } from '../content/act-one/index.ts';
import { upgrades } from '../content/act-one/upgrades.ts';
import { testContent } from '../testing/test-content.ts';
import { Game } from '../core/game.ts';
import { createInitialState, type GameState } from '../core/state.ts';
import { actOneStrategy } from './act-one-strategy.ts';
import { AutoPlayer } from './auto-player.ts';
import { withHabits } from './habits.ts';
import { continuousActiveProfile, longBreaksProfile, playerProfiles, puristProfile, type PlayerProfile } from './profiles.ts';
import { assessActOnePacing } from './pacing.ts';
import { milestoneTiming, simulatePlayer, type SimulationOptions } from './simulation.ts';

const options: SimulationOptions = { days: 2, seed: 1, stepSeconds: 1 };

function profileNamed(name: string): PlayerProfile {
    const profile = playerProfiles.find((candidate) => candidate.name === name);
    if (profile === undefined) {
        throw new Error(`No player profile named "${name}".`);
    }
    return profile;
}

describe('simulatePlayer', () => {
    it('lets every profile reach the first sandbox milestone', () => {
        for (const profile of playerProfiles) {
            const report = simulatePlayer(profile, sandboxContent, options);
            expect(report.milestoneTimings[0]?.milestoneId).toBe('level10');
        }
    });

    it('is deterministic for a given seed', () => {
        const profile = profileNamed('active');
        expect(simulatePlayer(profile, sandboxContent, options)).toEqual(simulatePlayer(profile, sandboxContent, options));
    });

    it('credits progress made while the player is away to offline progress', () => {
        const report = simulatePlayer(profileNamed('away often'), sandboxContent, options);
        expect(report.offlineProgressShare).toBeGreaterThan(0);
        expect(report.activeSeconds).toBeLessThan(report.realSeconds);
    });

    it('records offline milestone time when reached rather than at the next check-in', () => {
        const profile: PlayerProfile = {
            name: 'two check-ins', dailySessions: [{ startHour: 0, durationMinutes: 1 / 60 }, { startHour: 1, durationMinutes: 1 / 60 }],
            strategy: { decisionIntervalSeconds: 1, act: () => false },
        };
        const content = {
            ...testContent,
            systems: [{ update: (game: Parameters<typeof profile.strategy.act>[0], seconds: number) => { game.state.currentLevel += seconds; } }],
            milestones: [{ id: 'level20', name: 'Level 20', isReached: (state: GameState) => state.currentLevel >= 20 }],
        };
        const report = simulatePlayer(profile, content, { ...options, days: 1 });
        expect(report.milestoneTimings[0]).toEqual({ milestoneId: 'level20', realSeconds: 19, activeSeconds: 1 });
        expect(report.realSeconds).toBe(3600);
    });

    it('does not count activity switches as meaningful progress', () => {
        const profile: PlayerProfile = {
            name: 'clicking', dailySessions: [{ startHour: 0, durationMinutes: 1 }],
            strategy: { decisionIntervalSeconds: 1, act: (game) => game.dispatch({ type: 'setActivity', activity: 'work' }) },
        };
        const content = { ...testContent, systems: [], milestones: [], purchasables: [], handleAction: () => true };
        const report = simulatePlayer(profile, content, { ...options, days: 1 });
        expect(report.routineActions).toBe(60);
        expect(report.longestIdleStretchSeconds).toBe(0);
        expect(report.longestProgressGapSeconds).toBe(60);
    });

    it('merges overlapping sessions and respects the final partial simulation step', () => {
        const profile: PlayerProfile = {
            name: 'overlapping', dailySessions: [{ startHour: 0, durationMinutes: 0.2 }, { startHour: 0, durationMinutes: 0.1 }],
            strategy: { decisionIntervalSeconds: 1, act: () => false },
        };
        const report = simulatePlayer(profile, { ...testContent, milestones: [] }, { ...options, days: 1, stepSeconds: 7 });
        expect(report.realSeconds).toBe(12);
        expect(report.activeSeconds).toBe(12);
    });
});

describe('Act I pacing', () => {
    it('repeats deterministically without reusing the previous robot state', () => {
        expect(simulatePlayer(continuousActiveProfile, actOneContent, options)).toEqual(simulatePlayer(continuousActiveProfile, actOneContent, options));
    });

    it.each([1, 2, 3, 7, 19])('meets the continuous active targets and buys every upgrade with seed %i', (seed) => {
        const report = simulatePlayer(continuousActiveProfile, actOneContent, { days: 1, seed, stepSeconds: 1 });
        expect(assessActOnePacing(report).filter((check) => !check.passed)).toEqual([]);
        expect(report.upgradesPurchased).toBeGreaterThanOrEqual(upgrades.length - 3);
        expect(report.offlineProgressShare).toBe(0);
    });

    it('still finishes in four hours for a player who moves the rent slider once in ten minutes at most', () => {
        const profile = { ...continuousActiveProfile, strategy: withHabits(actOneStrategy(4), { rentEverySeconds: 600 }) };
        const report = simulatePlayer(profile, actOneContent, { days: 1, seed: 1, stepSeconds: 1 });
        expect(milestoneTiming(report, 'level1000')?.activeSeconds).toBeLessThan(4 * 3600);
        expect(report.upgradesPurchased).toBeGreaterThanOrEqual(upgrades.length - 4);
    });

    it('lets DirBuster keep going during long breaks without paying for a backlog of upgrades', () => {
        const report = simulatePlayer(longBreaksProfile, actOneContent, { days: 3, seed: 1, stepSeconds: 1 });
        expect(milestoneTiming(report, 'level1000')?.realSeconds).toBeLessThan(2 * 86400);
        expect(report.offlineProgressShare).toBeGreaterThan(0.2);
        const game = new Game(actOneContent, createInitialState(actOneContent, 1));
        new AutoPlayer(actOneStrategy(4)).playUntil(game, () => game.state.currentLevel >= 400, 3 * 3600);
        const money = game.state.resources.money!;
        const level = game.state.currentLevel;
        const income = incomePerSecond(game, 'money');
        game.advance(2 * 3600);
        expect(game.state.resources.money! - money).toBeLessThanOrEqual(income * backlogSeconds + 1);
        expect(game.state.currentLevel).toBeGreaterThan(level + 20);
    });

    it('keeps the purist moving without automation, purchases or offline gains', () => {
        const report = simulatePlayer(puristProfile, actOneContent, { ...options, days: 2 });
        expect(report.finalLevel).toBeGreaterThan(100);
        expect(report.handSolves).toBe(report.finalLevel - 1);
        expect(report.upgradesPurchased).toBe(0);
        expect(report.routineActions).toBe(0);
        expect(report.offlineProgressShare).toBe(0);
        expect(report.milestoneTimings.some((timing) => timing.milestoneId === 'automated')).toBe(false);
    });

    it('can reach the entire Act I wall by hand without requiring the automation milestone', () => {
        const profile = { ...puristProfile, dailySessions: [{ startHour: 0, durationMinutes: 16 * 60 }] };
        const report = simulatePlayer(profile, actOneContent, { days: 5, seed: 3, stepSeconds: 5 });
        expect(report.finalLevel).toBe(1000);
        expect(report.handSolves).toBe(999);
        expect(report.upgradesPurchased).toBe(0);
        expect(report.offlineProgressShare).toBe(0);
    });
});
