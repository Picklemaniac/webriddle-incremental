import type { SimulationReport } from './simulation.ts';

export interface PacingCheck {
    readonly name: string;
    readonly passed: boolean;
    readonly actual: number | undefined;
    readonly minimum?: number;
    readonly maximum?: number;
}

export function assessActOnePacing(report: SimulationReport): readonly PacingCheck[] {
    const timeOf = (id: string): number | undefined => report.milestoneTimings.find((timing) => timing.milestoneId === id)?.activeSeconds;
    const automation = timeOf('automated');
    const firstUpgrade = timeOf('firstUpgrade');
    const upgradeDelay = automation !== undefined && firstUpgrade !== undefined ? firstUpgrade - automation : undefined;
    const check = (name: string, actual: number | undefined, minimum: number, maximum: number): PacingCheck => ({
        name, actual, minimum, maximum, passed: actual !== undefined && actual >= minimum && actual <= maximum,
    });
    return [
        check('Automation in 3–6 minutes', automation, 180, 360),
        check('First upgrade 90–120 seconds after automation', upgradeDelay, 90, 120),
        check('More than ten named unlocks in the first hour', report.firstHourUnlocks, 11, Number.POSITIVE_INFINITY),
        check('Level 100 in 30–50 active minutes', timeOf('level100'), 1800, 3000),
        check('Level 1000 in 3–4 active hours', timeOf('level1000'), 10800, 14400),
        check('No progress gap longer than four minutes', report.longestProgressGapSeconds, 0, 240),
    ];
}
