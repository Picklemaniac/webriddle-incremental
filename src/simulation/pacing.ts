import { milestoneTiming, type SimulationReport } from './simulation.ts';

export interface PacingCheck {
    readonly name: string;
    readonly passed: boolean;
    readonly actual: number | undefined;
    readonly minimum?: number;
    readonly maximum?: number;
}

// The share of the time between two levels that went by with nothing happening for half a minute or more.
function staringShare(report: SimulationReport, fromLevel: number, toLevel: number): number | undefined {
    const bands = report.staring.filter((band) => band.fromLevel >= fromLevel && band.toLevel <= toLevel);
    const seconds = bands.reduce((sum, band) => sum + band.seconds, 0);
    return seconds === 0 ? undefined : bands.reduce((sum, band) => sum + band.staringSeconds, 0) / seconds;
}

export function assessActOnePacing(report: SimulationReport): readonly PacingCheck[] {
    const timeOf = (id: string): number | undefined => milestoneTiming(report, id)?.activeSeconds;
    const automation = timeOf('automated');
    const firstUpgrade = timeOf('firstUpgrade');
    const upgradeDelay = automation !== undefined && firstUpgrade !== undefined ? firstUpgrade - automation : undefined;
    const check = (name: string, actual: number | undefined, minimum: number, maximum: number): PacingCheck => ({
        name, actual, minimum, maximum, passed: actual !== undefined && actual >= minimum && actual <= maximum,
    });
    return [
        check('Automation in 3–6 minutes', automation, 180, 360),
        check('First upgrade 55–90 seconds after automation', upgradeDelay, 55, 90),
        check('More than ten named unlocks in the first hour', report.firstHourUnlocks, 11, Number.POSITIVE_INFINITY),
        check('Level 100 in 30–50 active minutes', timeOf('level100'), 1800, 3000),
        check('Level 1000 in 3–4 active hours', timeOf('level1000'), 10800, 14400),
        check('No progress gap longer than four minutes', report.longestProgressGapSeconds, 0, 240),
        check('No wait longer than twelve minutes between purchases', report.longestPurchaseGapSeconds, 0, 720),
        check('Under 45% staring before level 25', staringShare(report, 5, 25), 0, 0.45),
        check('Under 25% staring from level 25 to 100', staringShare(report, 25, 100), 0, 0.25),
    ];
}
