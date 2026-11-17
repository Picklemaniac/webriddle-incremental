// Something the player sees happen or does: a level found, a card appearing, a proxy dying, a ban, a click.
interface Moment {
    readonly at: number;
    readonly level: number;
}

export interface StaringBand {
    readonly fromLevel: number;
    readonly toLevel: number;
    readonly seconds: number;
    readonly staringSeconds: number;
    readonly longestSeconds: number;
    readonly longestAtLevel: number;
}

// A stretch this long with no moment in it counts as staring at the screen.
export const staringStretchSeconds = 30;
export const actOneStaringBands: readonly number[] = [5, 25, 50, 100, 250, 500];

export class StaringMeter {
    private readonly moments: Moment[] = [];

    observe(at: number, level: number): void {
        this.moments.push({ at, level });
    }

    bands(levels: readonly number[]): StaringBand[] {
        return levels.slice(0, -1).map((fromLevel, index) => {
            const toLevel = levels[index + 1]!;
            const band = { fromLevel, toLevel, seconds: 0, staringSeconds: 0, longestSeconds: 0, longestAtLevel: fromLevel };
            for (const [position, moment] of this.moments.slice(0, -1).entries()) {
                if (moment.level < fromLevel || moment.level >= toLevel) continue;
                const stretch = this.moments[position + 1]!.at - moment.at;
                band.seconds += stretch;
                if (stretch < staringStretchSeconds) continue;
                band.staringSeconds += stretch;
                if (stretch > band.longestSeconds) {
                    band.longestSeconds = stretch;
                    band.longestAtLevel = moment.level;
                }
            }
            return band;
        });
    }
}
