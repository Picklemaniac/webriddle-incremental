import { buyBestValue, buyEverythingAffordable, type Strategy } from './strategies.ts';
import { actOneStrategy } from './act-one-strategy.ts';

export interface DailySession {
    readonly startHour: number;
    readonly durationMinutes: number;
}

export interface PlayerProfile {
    readonly name: string;
    readonly dailySessions: readonly DailySession[];
    readonly strategy: Strategy;
    readonly stopAtMilestone?: string;
}

export const playerProfiles: readonly PlayerProfile[] = [
    {
        name: 'away often',
        dailySessions: [
            { startHour: 7.5, durationMinutes: 5 },
            { startHour: 12.5, durationMinutes: 10 },
            { startHour: 18, durationMinutes: 10 },
            { startHour: 22.5, durationMinutes: 5 },
        ],
        strategy: contentStrategy(10, buyEverythingAffordable(60)),
    },
    {
        name: 'active',
        dailySessions: [
            { startHour: 12, durationMinutes: 30 },
            { startHour: 18, durationMinutes: 300 },
        ],
        strategy: contentStrategy(4, buyBestValue(10)),
    },
    {
        name: 'maximiser',
        dailySessions: [{ startHour: 8, durationMinutes: 16 * 60 }],
        strategy: contentStrategy(2, buyBestValue(2)),
    },
];

export const puristProfile: PlayerProfile = {
    name: 'purist', dailySessions: [{ startHour: 18, durationMinutes: 180 }], strategy: actOneStrategy(5, true), stopAtMilestone: 'level1000',
};

export const continuousActiveProfile: PlayerProfile = {
    name: 'continuous active', dailySessions: [{ startHour: 18, durationMinutes: 360 }], strategy: actOneStrategy(4),
};

function contentStrategy(interval: number, fallback: Strategy): Strategy {
    const strategy = actOneStrategy(interval);
    return { decisionIntervalSeconds: interval, act: (game) => game.content.baseStats.scriptSlots === undefined ? fallback.act(game) : strategy.act(game) };
}
