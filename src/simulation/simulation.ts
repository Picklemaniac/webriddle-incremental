import type { GameContent } from '../core/content.ts';
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

export interface MilestoneTiming {
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
    readonly offlineProgressShare: number;
    readonly finalLevel: number;
}

interface ScheduledSession {
    readonly startSeconds: number;
    readonly endSeconds: number;
}

export function simulatePlayer(profile: PlayerProfile, content: GameContent, options: SimulationOptions): SimulationReport {
    return new PlayerSimulation(profile, content, options).run();
}

class PlayerSimulation {
    private readonly profile: PlayerProfile;
    private readonly options: SimulationOptions;
    private readonly game: Game;
    private readonly autoPlayer: AutoPlayer;
    private readonly milestoneTimings: MilestoneTiming[] = [];
    private realSeconds = 0;
    private activeSeconds = 0;
    private idleStretchSeconds = 0;
    private longestIdleStretchSeconds = 0;
    private offlineProgress = 0;

    constructor(profile: PlayerProfile, content: GameContent, options: SimulationOptions) {
        this.profile = profile;
        this.options = options;
        this.game = new Game(content, createInitialState(content, options.seed));
        this.autoPlayer = new AutoPlayer(profile.strategy);
        this.game.subscribe((event) => {
            if (event.type === 'milestoneReached') {
                this.milestoneTimings.push({
                    milestoneId: event.milestoneId,
                    realSeconds: this.realSeconds,
                    activeSeconds: this.activeSeconds,
                });
            }
        });
    }

    run(): SimulationReport {
        const sessions = scheduleSessions(this.profile.dailySessions, this.options.days);
        const firstSessionStart = sessions[0]?.startSeconds ?? 0;
        const startingProgress = progressOf(this.game);
        let previousSessionEnd: number | undefined;
        for (const session of sessions) {
            this.realSeconds = session.startSeconds - firstSessionStart;
            if (previousSessionEnd !== undefined) {
                this.spendTimeAway(session.startSeconds - previousSessionEnd);
            }
            this.play(session.endSeconds - session.startSeconds);
            previousSessionEnd = session.endSeconds;
            if (this.hasReachedEveryMilestone()) {
                break;
            }
        }
        const totalProgress = progressOf(this.game) - startingProgress;
        return {
            profileName: this.profile.name,
            milestoneTimings: this.milestoneTimings,
            realSeconds: this.realSeconds,
            activeSeconds: this.activeSeconds,
            longestIdleStretchSeconds: this.longestIdleStretchSeconds,
            offlineProgressShare: totalProgress > 0 ? this.offlineProgress / totalProgress : 0,
            finalLevel: this.game.state.currentLevel,
        };
    }

    private spendTimeAway(awaySeconds: number): void {
        const progressBefore = progressOf(this.game);
        this.game.catchUp(awaySeconds);
        this.offlineProgress += progressOf(this.game) - progressBefore;
    }

    private play(sessionSeconds: number): void {
        const { stepSeconds } = this.options;
        this.idleStretchSeconds = 0;
        for (let playedSeconds = 0; playedSeconds < sessionSeconds; playedSeconds += stepSeconds) {
            if (this.hasReachedEveryMilestone()) {
                return;
            }
            this.realSeconds += stepSeconds;
            this.activeSeconds += stepSeconds;
            this.autoPlayer.playStep(this.game, stepSeconds);
            this.idleStretchSeconds = this.autoPlayer.hadNothingToDo ? this.idleStretchSeconds + stepSeconds : 0;
            this.longestIdleStretchSeconds = Math.max(this.longestIdleStretchSeconds, this.idleStretchSeconds);
        }
    }

    private hasReachedEveryMilestone(): boolean {
        const { milestones } = this.game.content;
        const { reachedMilestones } = this.game.state;
        return milestones.length > 0 && milestones.every((milestone) => reachedMilestones[milestone.id] !== undefined);
    }
}

function scheduleSessions(dailySessions: readonly DailySession[], days: number): ScheduledSession[] {
    const sessions: ScheduledSession[] = [];
    for (let day = 0; day < days; day++) {
        for (const dailySession of dailySessions) {
            const startSeconds = day * 86_400 + dailySession.startHour * 3_600;
            sessions.push({ startSeconds, endSeconds: startSeconds + dailySession.durationMinutes * 60 });
        }
    }
    return sessions.sort((first, second) => first.startSeconds - second.startSeconds);
}
