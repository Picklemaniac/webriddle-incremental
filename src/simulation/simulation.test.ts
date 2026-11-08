import { describe, expect, it } from 'vitest';
import { sandboxContent } from '../content/sandbox.ts';
import { playerProfiles, type PlayerProfile } from './profiles.ts';
import { simulatePlayer, type SimulationOptions } from './simulation.ts';

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
});
