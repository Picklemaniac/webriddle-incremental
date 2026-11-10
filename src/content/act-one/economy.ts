import type { GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import type { GameState } from '../../core/state.ts';
import { owns } from './progress.ts';

export type JobId = 'scraping' | 'ticketing' | 'riddles';
export type ActivityId = 'riddles' | 'work' | 'scouring';

interface JobDefinition {
    readonly id: JobId;
    readonly unlockedBy: string;
    readonly resource: string;
    readonly rateStat: string;
}

interface ActivityDefinition {
    readonly id: ActivityId;
    readonly resource: string;
    readonly rateStat: string;
}

export const jobs: readonly JobDefinition[] = [
    { id: 'scraping', unlockedBy: 'wgetMirror', resource: 'data', rateStat: 'scraperRate' },
    { id: 'ticketing', unlockedBy: 'autoReplyMacros', resource: 'money', rateStat: 'ticketBotRate' },
    { id: 'riddles', unlockedBy: 'otherRiddles', resource: 'insight', rateStat: 'riddleBotRate' },
];

export const backlogSeconds = 600;

export const activities: readonly ActivityDefinition[] = [
    { id: 'riddles', resource: 'insight', rateStat: 'riddleRate' },
    { id: 'work', resource: 'money', rateStat: 'workRate' },
    { id: 'scouring', resource: 'data', rateStat: 'scourRate' },
];

export function scriptSlots(game: Game): number {
    return game.state.flags.automated === true ? Math.floor(game.stat('scriptSlots')) : 0;
}

export function assignedScripts(game: Game, jobId: JobId): number {
    return game.state.jobs[jobId] ?? 0;
}

export function dirbustingScripts(game: Game): number {
    const others = jobs.reduce((total, job) => total + assignedScripts(game, job.id), 0);
    return Math.max(0, scriptSlots(game) - others);
}

export function isJobUnlocked(game: Game, jobId: JobId): boolean {
    const job = jobs.find((candidate) => candidate.id === jobId);
    return job !== undefined && owns(game.state, job.unlockedBy);
}

export function assignJob(game: Game, jobId: string, change: number): boolean {
    const job = jobs.find((candidate) => candidate.id === jobId);
    if (job === undefined || !isJobUnlocked(game, job.id)) {
        return false;
    }
    const current = assignedScripts(game, job.id);
    const next = current + Math.sign(change);
    if (next < 0 || (change > 0 && dirbustingScripts(game) === 0)) {
        return false;
    }
    game.state.jobs[job.id] = next;
    return true;
}

export function isResourceRevealed(game: Game, resource: string): boolean {
    return game.state.flags[`${resource}Revealed`] === true;
}

export function setActivity(game: Game, activityId: string): boolean {
    const activity = activities.find((candidate) => candidate.id === activityId);
    if (activity === undefined || !isResourceRevealed(game, activity.resource) || game.state.activity === activity.id) {
        return false;
    }
    game.state.activity = activity.id;
    return true;
}

export function activityRate(game: Game, activityId: ActivityId): number {
    const activity = activities.find((candidate) => candidate.id === activityId)!;
    return game.stat(activity.rateStat);
}

export function isAway(state: GameState): boolean {
    return state.elapsedSeconds - (state.statistics.lastSeenAt ?? 0) > backlogSeconds;
}

export function incomePerSecond(game: Game, resource: string): number {
    const activity = activities.find((candidate) => candidate.resource === resource && candidate.id === game.state.activity);
    const job = jobs.find((candidate) => candidate.resource === resource)!;
    return (activity === undefined ? 0 : game.stat(activity.rateStat)) + assignedScripts(game, job.id) * game.stat(job.rateStat);
}

export function incomeWhileEarning(game: Game, resource: string): number {
    const activity = activities.find((candidate) => candidate.resource === resource)!;
    const job = jobs.find((candidate) => candidate.resource === resource)!;
    return game.stat(activity.rateStat) + assignedScripts(game, job.id) * game.stat(job.rateStat);
}

export const passiveIncome: GameSystem = {
    update(game, deltaSeconds) {
        if (isAway(game.state)) return;
        for (const { resource } of activities) game.gainResource(resource, incomePerSecond(game, resource) * deltaSeconds);
    },
};
