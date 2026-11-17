import { gameContent } from '../src/content/index.ts';
import { formatDuration } from '../src/format.ts';
import { assessActOnePacing } from '../src/simulation/pacing.ts';
import { continuousActiveProfile, earnerProfile, handsOffProfile, longBreaksProfile, playerProfiles, puristProfile } from '../src/simulation/profiles.ts';
import { formatReports } from '../src/simulation/report.ts';
import { milestoneTiming, simulatePlayer } from '../src/simulation/simulation.ts';
import { readArgument } from './shared.ts';

const days = positiveInteger('--days', 14);
const seeds = (readArgument('--seeds') ?? readArgument('--seed') ?? '1').split(',').map((value) => {
    const seed = Number(value);
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seeds must be integers between 0 and 4294967295.');
    return seed;
});
const availableProfiles = [...playerProfiles, longBreaksProfile, continuousActiveProfile, earnerProfile, handsOffProfile, puristProfile];
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

// The pacing targets are for the two robots that play all of Act I in one sitting.
const checkedProfiles = [continuousActiveProfile, earnerProfile].filter((profile) => allReports.some(({ report }) => report.profileName === profile.name));
for (const profile of checkedProfiles) {
    const runs = allReports.filter(({ report }) => report.profileName === profile.name);
    const reached = runs.flatMap(({ seed, report }) => {
        const timing = milestoneTiming(report, 'level500');
        return timing === undefined ? [] : [{ seed, seconds: timing.activeSeconds }];
    }).sort((first, second) => first.seconds - second.seconds);
    if (reached.length > 0) {
        const best = reached[0]!;
        const worst = reached[reached.length - 1]!;
        const median = reached[Math.floor(reached.length / 2)]!;
        console.log(`${profile.name}, level 500: fastest ${formatDuration(best.seconds)} (seed ${best.seed}), median ${formatDuration(median.seconds)}, slowest ${formatDuration(worst.seconds)} (seed ${worst.seed}).`);
    }
    for (const { seed, report } of runs) {
        const failures = assessActOnePacing(report).filter((check) => !check.passed);
        console.log(`Pacing targets, ${profile.name}, seed ${seed}: ${failures.length ? failures.map((check) => `${check.name} [${check.actual ?? 'not reached'}]`).join('; ') : 'all passed'}.`);
        if (failures.length && process.argv.includes('--check')) process.exitCode = 1;
    }
}
if (checkedProfiles.length === 0 && process.argv.includes('--check')) {
    throw new Error('--check requires the continuous active or the earner profile (use --profile continuous, --profile earner or omit --profile).');
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
