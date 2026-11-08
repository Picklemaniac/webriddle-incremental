import type { GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import { increment, owns } from './progress.ts';

export type JobId = 'scraping' | 'ticketing';

interface JobDefinition {
    readonly id: JobId;
    readonly unlockedBy: string;
}

const jobs: readonly JobDefinition[] = [
    { id: 'scraping', unlockedBy: 'wgetMirror' },
    { id: 'ticketing', unlockedBy: 'autoReplyMacros' },
];

const manualActionCooldownSeconds = 2;

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

export function cooldownRemaining(game: Game, actionId: 'work' | 'scour'): number {
    return Math.max(0, (game.state.cooldowns[actionId] ?? 0) - game.state.elapsedSeconds);
}

export function work(game: Game): boolean {
    if (game.state.flags.moneyRevealed !== true || cooldownRemaining(game, 'work') > 0) {
        return false;
    }
    game.gainResource('money', game.stat('ticketValue'));
    game.state.cooldowns.work = game.state.elapsedSeconds + manualActionCooldownSeconds;
    increment(game.state, 'tickets');
    return true;
}

export function scour(game: Game): boolean {
    if (game.state.flags.wordsRevealed !== true || cooldownRemaining(game, 'scour') > 0) {
        return false;
    }
    game.gainResource('words', game.stat('scourValue'));
    game.state.cooldowns.scour = game.state.elapsedSeconds + manualActionCooldownSeconds;
    increment(game.state, 'scours');
    return true;
}

export function moneyPerSecond(game: Game): number {
    return assignedScripts(game, 'ticketing') * game.stat('ticketBotRate');
}

export function wordsPerSecond(game: Game): number {
    return assignedScripts(game, 'scraping') * game.stat('scraperRate');
}

export const passiveIncome: GameSystem = {
    update(game, deltaSeconds) {
        game.gainResource('money', moneyPerSecond(game) * deltaSeconds);
        game.gainResource('words', wordsPerSecond(game) * deltaSeconds);
    },
};
