import type { MilestoneDefinition } from '../core/content.ts';
import { formatDuration, formatNumber } from '../format.ts';
import type { SimulationReport } from './simulation.ts';

export function formatReports(reports: readonly SimulationReport[], milestones: readonly MilestoneDefinition[]): string {
    const perReport = (describe: (report: SimulationReport) => string): string[] => reports.map(describe);
    return formatTable([
        ['', ...perReport((report) => report.profileName)],
        ...milestones.map((milestone) => [milestone.name, ...perReport((report) => describeMilestoneTiming(report, milestone.id))]),
        ['Final level', ...perReport((report) => formatNumber(report.finalLevel))],
        ['Real time', ...perReport((report) => formatDuration(report.realSeconds))],
        ['Active time', ...perReport((report) => formatDuration(report.activeSeconds))],
        ['Longest idle stretch', ...perReport((report) => formatDuration(report.longestIdleStretchSeconds))],
        ['Progress made offline', ...perReport((report) => `${Math.round(report.offlineProgressShare * 100)}%`)],
    ]);
}

function describeMilestoneTiming(report: SimulationReport, milestoneId: string): string {
    const timing = report.milestoneTimings.find((candidate) => candidate.milestoneId === milestoneId);
    if (timing === undefined) {
        return 'not reached';
    }
    return `${formatDuration(timing.realSeconds)} (${formatDuration(timing.activeSeconds)} active)`;
}

function formatTable(rows: readonly (readonly string[])[]): string {
    const columnCount = Math.max(...rows.map((row) => row.length));
    const columnWidths = Array.from({ length: columnCount }, (_, columnIndex) =>
        Math.max(...rows.map((row) => row[columnIndex]?.length ?? 0)),
    );
    return rows
        .map((row) => row.map((cell, columnIndex) => cell.padEnd(columnWidths[columnIndex] ?? 0)).join('   ').trimEnd())
        .join('\n');
}
