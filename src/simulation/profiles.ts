import { buyBestValue, buyEverythingAffordable, type Strategy } from './strategies.ts';

export interface DailySession {
    readonly startHour: number;
    readonly durationMinutes: number;
}

export interface PlayerProfile {
    readonly name: string;
    readonly dailySessions: readonly DailySession[];
    readonly strategy: Strategy;
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
        strategy: buyEverythingAffordable(60),
    },
    {
        name: 'active',
        dailySessions: [
            { startHour: 12, durationMinutes: 30 },
            { startHour: 18, durationMinutes: 300 },
        ],
        strategy: buyBestValue(10),
    },
    {
        name: 'maximiser',
        dailySessions: [{ startHour: 8, durationMinutes: 16 * 60 }],
        strategy: buyBestValue(2),
    },
];
