import type { GameContent } from '../core/content.ts';
import type { GameEvent } from '../core/events.ts';
import { Game } from '../core/game.ts';
import { createInitialState } from '../core/state.ts';
import { AutoPlayer } from './auto-player.ts';
import type { DailySession, PlayerProfile } from './profiles.ts';
import { progressOf } from './strategies.ts';

export interface SimulationOptions {
    readonly days: number;
    readonly seed: number;
    readonly stepSeconds: number;
}

interface MilestoneTiming {
    readonly milestoneId: string;
    readonly realSeconds: number;
    readonly activeSeconds: number;
}

export interface SimulationReport {
    readonly profileName: string;
    readonly milestoneTimings: readonly MilestoneTiming[];
    readonly realSeconds: number;
    readonly activeSeconds: number;
    readonly longestIdleStretchSeconds: number;
    readonly longestProgressGapSeconds: number;
    readonly longestPurchaseGapSeconds: number;
    readonly firstHourUnlocks: number;
    readonly upgradesPurchased: number;
    readonly routineActions: number;
    readonly handSolves: number;
    readonly offlineProgressShare: number;
    readonly finalLevel: number;
}

interface ScheduledSession {
    readonly startSeconds: number;
    readonly endSeconds: number;
}

interface AdvanceClock {
    readonly realSeconds: number;
    readonly activeSeconds: number;
    readonly gameSeconds: number;
    readonly offline: boolean;
}

const upkeepActions: ReadonlySet<string> = new Set(['checkIn', 'setRentedAddresses']);

export function milestoneTiming(report: SimulationReport, milestoneId: string): MilestoneTiming | undefined {
    return report.milestoneTimings.find((timing) => timing.milestoneId === milestoneId);
}

export function simulatePlayer(profile: PlayerProfile, content: GameContent, options: SimulationOptions): SimulationReport {
    if (!Number.isInteger(options.days) || options.days < 1 || !Number.isFinite(options.stepSeconds) || options.stepSeconds <= 0) {
        throw new Error('Simulation days must be a positive integer and the step must be positive.');
    }
    return new PlayerSimulation(profile, content, options).run();
}

class PlayerSimulation {
    private readonly profile: PlayerProfile;
    private readonly options: SimulationOptions;
    private readonly game: Game;
    private readonly autoPlayer: AutoPlayer;
    private readonly milestoneTimings: MilestoneTiming[] = [];
    private readonly firstHourUnlockIds = new Set<string>();
    private readonly observedUnlockIds = new Set<string>();
    private realSeconds = 0;
    private activeSeconds = 0;
    private idleStretchSeconds = 0;
    private longestIdleStretchSeconds = 0;
    private progressGapSeconds = 0;
    private longestProgressGapSeconds = 0;
    private offlineProgress = 0;
    private routineActions = 0;
    private meaningfulActivity = false;
    private lastPurchaseActiveSeconds: number | undefined;
    private longestPurchaseGapSeconds = 0;
    private clock: AdvanceClock = { realSeconds: 0, activeSeconds: 0, gameSeconds: 0, offline: false };

    constructor(profile: PlayerProfile, content: GameContent, options: SimulationOptions) {
        this.profile = profile;
        this.options = options;
        this.game = new Game(content, createInitialState(content, options.seed));
        this.autoPlayer = new AutoPlayer(profile.strategy);
        this.game.subscribe((event) => this.observeEvent(event));
    }

    run(): SimulationReport {
        const sessions = scheduleSessions(this.profile.dailySessions, this.options.days);
        const firstSessionStart = sessions[0]?.startSeconds ?? 0;
        const startingProgress = progressOf(this.game);
        let previousSessionEnd: number | undefined;
        for (const session of sessions) {
            if (previousSessionEnd !== undefined) this.spendTimeAway(session.startSeconds - previousSessionEnd);
            this.realSeconds = session.startSeconds - firstSessionStart;
            this.play(session.endSeconds - session.startSeconds);
            previousSessionEnd = session.endSeconds;
            if (this.hasReachedGoal()) break;
        }
        const totalProgress = progressOf(this.game) - startingProgress;
        return {
            profileName: this.profile.name,
            milestoneTimings: this.milestoneTimings,
            realSeconds: this.realSeconds,
            activeSeconds: this.activeSeconds,
            longestIdleStretchSeconds: this.longestIdleStretchSeconds,
            longestProgressGapSeconds: this.longestProgressGapSeconds,
            longestPurchaseGapSeconds: this.longestPurchaseGapSeconds,
            firstHourUnlocks: this.firstHourUnlockIds.size,
            upgradesPurchased: Object.keys(this.game.state.purchases).length,
            routineActions: this.routineActions,
            handSolves: this.game.state.statistics.handSolves ?? 0,
            offlineProgressShare: totalProgress > 0 ? this.offlineProgress / totalProgress : 0,
            finalLevel: this.game.state.currentLevel,
        };
    }

    private observeEvent(event: GameEvent): void {
        if (event.type === 'milestoneReached') {
            this.milestoneTimings.push({ milestoneId: event.milestoneId, ...this.currentTime() });
            this.meaningfulActivity = true;
        } else if (event.type === 'levelSolved' || event.type === 'findingDiscovered' || event.type === 'notice') {
            this.meaningfulActivity = true;
        } else if (event.type === 'actionApplied') {
            if (event.action.type === 'purchase') this.observePurchase();
            if (event.action.type === 'setActivity') this.routineActions++;
            else if (!upkeepActions.has(event.action.type)) this.meaningfulActivity = true;
        }
    }

    private observePurchase(): void {
        const { activeSeconds } = this.currentTime();
        if (this.lastPurchaseActiveSeconds !== undefined) this.longestPurchaseGapSeconds = Math.max(this.longestPurchaseGapSeconds, activeSeconds - this.lastPurchaseActiveSeconds);
        this.lastPurchaseActiveSeconds = activeSeconds;
    }

    private currentTime(): { realSeconds: number; activeSeconds: number } {
        const elapsed = this.game.state.elapsedSeconds - this.clock.gameSeconds;
        return {
            realSeconds: this.clock.realSeconds + elapsed,
            activeSeconds: this.clock.activeSeconds + (this.clock.offline ? 0 : elapsed),
        };
    }

    private setClock(offline: boolean): void {
        this.clock = { realSeconds: this.realSeconds, activeSeconds: this.activeSeconds, gameSeconds: this.game.state.elapsedSeconds, offline };
    }

    private spendTimeAway(awaySeconds: number): void {
        const progressBefore = progressOf(this.game);
        this.setClock(true);
        this.game.catchUp(awaySeconds);
        this.offlineProgress += progressOf(this.game) - progressBefore;
    }

    private play(sessionSeconds: number): void {
        this.idleStretchSeconds = 0;
        this.progressGapSeconds = 0;
        for (let playedSeconds = 0; playedSeconds < sessionSeconds;) {
            if (this.hasReachedGoal()) return;
            const step = Math.min(this.options.stepSeconds, sessionSeconds - playedSeconds);
            const levelBefore = this.game.state.currentLevel;
            this.meaningfulActivity = false;
            this.setClock(false);
            this.autoPlayer.playStep(this.game, step);
            this.realSeconds += step;
            this.activeSeconds += step;
            playedSeconds += step;
            this.observeUnlocks();
            this.idleStretchSeconds = this.autoPlayer.hadNothingToDo ? this.idleStretchSeconds + step : 0;
            this.longestIdleStretchSeconds = Math.max(this.longestIdleStretchSeconds, this.idleStretchSeconds);
            const progress = this.meaningfulActivity || this.game.state.currentLevel > levelBefore;
            this.progressGapSeconds = progress ? 0 : this.progressGapSeconds + step;
            this.longestProgressGapSeconds = Math.max(this.longestProgressGapSeconds, this.progressGapSeconds);
        }
    }

    private observeUnlocks(): void {
        for (const definition of this.game.content.purchasables) {
            const isRevealed = this.game.state.flags[`seen:${definition.id}`] === true || (this.game.state.purchases[definition.id] ?? 0) > 0;
            if (!isRevealed || this.observedUnlockIds.has(definition.id)) continue;
            this.observedUnlockIds.add(definition.id);
            this.meaningfulActivity = true;
            if (this.realSeconds <= 3600) this.firstHourUnlockIds.add(definition.id);
        }
    }

    private hasReachedGoal(): boolean {
        const { reachedMilestones } = this.game.state;
        if (this.profile.stopAtMilestone !== undefined) return reachedMilestones[this.profile.stopAtMilestone] !== undefined;
        const { milestones } = this.game.content;
        return milestones.length > 0 && milestones.every((milestone) => reachedMilestones[milestone.id] !== undefined);
    }
}

function scheduleSessions(dailySessions: readonly DailySession[], days: number): ScheduledSession[] {
    const sessions: ScheduledSession[] = [];
    const limit = days * 86400;
    for (let day = 0; day < days; day++) {
        for (const session of dailySessions) {
            if (!Number.isFinite(session.startHour) || session.startHour < 0 || session.startHour >= 24 ||
                !Number.isFinite(session.durationMinutes) || session.durationMinutes <= 0) {
                throw new Error('Daily sessions need a start hour within the day and a positive duration.');
            }
            const startSeconds = day * 86400 + session.startHour * 3600;
            sessions.push({ startSeconds, endSeconds: Math.min(limit, startSeconds + session.durationMinutes * 60) });
        }
    }
    const merged: ScheduledSession[] = [];
    for (const session of sessions.sort((first, second) => first.startSeconds - second.startSeconds)) {
        const previous = merged[merged.length - 1];
        if (previous !== undefined && session.startSeconds <= previous.endSeconds) {
            merged[merged.length - 1] = { startSeconds: previous.startSeconds, endSeconds: Math.max(previous.endSeconds, session.endSeconds) };
        } else merged.push(session);
    }
    return merged;
}
