import { gameContent } from '../src/content/index.ts';
import { playerProfiles } from '../src/simulation/profiles.ts';
import { formatReports } from '../src/simulation/report.ts';
import { simulatePlayer } from '../src/simulation/simulation.ts';

const days = readNumberArgument('--days', 14);
const seed = readNumberArgument('--seed', 1);

const startedAt = performance.now();
const reports = playerProfiles.map((profile) => simulatePlayer(profile, gameContent, { days, seed, stepSeconds: 1 }));
const elapsedMilliseconds = Math.round(performance.now() - startedAt);

console.log(formatReports(reports, gameContent.milestones));
console.log(`\nSimulated up to ${days} days for ${reports.length} profiles in ${elapsedMilliseconds} ms (seed ${seed}).`);

function readNumberArgument(name: string, fallback: number): number {
    const index = process.argv.indexOf(name);
    const value = index === -1 ? Number.NaN : Number(process.argv[index + 1]);
    return Number.isNaN(value) ? fallback : value;
}
