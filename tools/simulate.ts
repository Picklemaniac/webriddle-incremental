import { gameContent } from '../src/content/index.ts';
import { formatDuration } from '../src/format.ts';
import { assessActOnePacing } from '../src/simulation/pacing.ts';
import { continuousActiveProfile, handsOffProfile, longBreaksProfile, playerProfiles, puristProfile } from '../src/simulation/profiles.ts';
import { formatReports } from '../src/simulation/report.ts';
import { milestoneTiming, simulatePlayer } from '../src/simulation/simulation.ts';
import { readArgument } from './shared.ts';

const days = positiveInteger('--days', 14);
const seeds = (readArgument('--seeds') ?? readArgument('--seed') ?? '1').split(',').map((value) => {
    const seed = Number(value);
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seeds must be integers between 0 and 4294967295.');
    return seed;
});
const availableProfiles = [...playerProfiles, longBreaksProfile, continuousActiveProfile, handsOffProfile, puristProfile];
const selectedName = readArgument('--profile');
const aliases: Readonly<Record<string, string>> = { continuous: 'continuous active', away: 'away often', breaks: 'long breaks', handsoff: 'hands off' };
const profiles = selectedName === undefined ? availableProfiles : availableProfiles.filter((profile) => profile.name === (aliases[selectedName] ?? selectedName));
if (profiles.length === 0) throw new Error(`Unknown profile. Choose: ${availableProfiles.map((profile) => profile.name).join(', ')}.`);

const startedAt = performance.now();
const allReports = seeds.flatMap((seed) => {
    const reports = profiles.map((profile) => simulatePlayer(profile, gameContent, { days, seed, stepSeconds: 1 }));
    console.log(`Seed ${seed}\n${formatReports(reports, gameContent.milestones)}\n`);
    return reports.map((report) => ({ seed, report }));
});

const continuousRuns = allReports.filter(({ report }) => report.profileName === continuousActiveProfile.name);
if (continuousRuns.length > 0) {
    const reached = continuousRuns.flatMap(({ seed, report }) => {
        const timing = milestoneTiming(report, 'level1000');
        return timing === undefined ? [] : [{ seed, seconds: timing.activeSeconds }];
    }).sort((first, second) => first.seconds - second.seconds);
    if (reached.length > 0) {
        const best = reached[0]!;
        const worst = reached[reached.length - 1]!;
        const median = reached[Math.floor(reached.length / 2)]!;
        console.log(`Continuous active, level 1000: fastest ${formatDuration(best.seconds)} (seed ${best.seed}), median ${formatDuration(median.seconds)}, slowest ${formatDuration(worst.seconds)} (seed ${worst.seed}).`);
    }
    for (const { seed, report } of continuousRuns) {
        const failures = assessActOnePacing(report).filter((check) => !check.passed);
        console.log(`Pacing targets, seed ${seed}: ${failures.length ? failures.map((check) => `${check.name} [${check.actual ?? 'not reached'}]`).join('; ') : 'all passed'}.`);
        if (failures.length && process.argv.includes('--check')) process.exitCode = 1;
    }
} else if (process.argv.includes('--check')) {
    throw new Error('--check requires the continuous active profile (use --profile continuous or omit --profile).');
}

console.log('\nIdle stretch = no robot input. Progress gap = no solve, unlock, finding or meaningful intervention; activity switches do not reset it.');
console.log('Unlocks are distinct upgrade cards observed in the first real hour. Offline milestone times are when they occur, not when the player returns.');
console.log('Robot play is a balancing model, not a human playtest. Manual solving uses estimated delays; the robot knows the solution after that delay.');
console.log(`Simulated up to ${days} days for ${profiles.length} profiles × ${seeds.length} seeds in ${Math.round(performance.now() - startedAt)} ms.`);

function positiveInteger(name: string, fallback: number): number {
    const argument = readArgument(name);
    const value = argument === undefined ? fallback : Number(argument);
    if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
    return value;
}
