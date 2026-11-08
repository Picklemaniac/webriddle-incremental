export const riddleOrigin = 'http://www.notfinite.net';
export const startUrl = `${riddleOrigin}/beginning.htm`;
export const riddleHomeUrl = `${riddleOrigin}/`;
export const rulesUrl = `${riddleOrigin}/rules.htm`;
export const hintsUrl = `${riddleOrigin}/hints.htm`;
export const hallOfFameUrl = `${riddleOrigin}/halloffame.htm`;
export const homeUrl = 'http://www.enigmaweb.net/';
export const enigmaticsUrl = 'https://enigmatics.org/';
export const nordinhoUrl = 'https://www.nordinho.net/';
export const toolUrls = { dcode: 'https://www.dcode.fr/en', cyberChef: 'https://gchq.github.io/CyberChef/', rumkin: 'https://rumkin.com/tools/cipher/' } as const;

const riddleSeed = 0x2026_1108;

export const salts = {
    kind: 1,
    rank: 2,
    clue: 3,
    extension: 5,
    encoding: 6,
    ending: 7,
    secondWord: 8,
    thirdWord: 9,
    fourthWord: 10,
    index: 11,
    position: 12,
    leet: 13,
    year: 14,
    phraseLength: 15,
    common: 16,
    door: 17,
    username: 18,
    password: 19,
} as const;

export function unitHash(level: number, salt: number): number {
    let value = Math.imul(level ^ riddleSeed, 0x9e3779b1) ^ Math.imul(salt + 0x632be5ab, 0x85ebca6b);
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b);
    value ^= value >>> 16;
    return (value >>> 0) / 4_294_967_296;
}

export function pickByUnit<Item>(items: readonly Item[], unit: number): Item {
    const item = items[Math.min(items.length - 1, Math.floor(unit * items.length))];
    if (item === undefined) {
        throw new Error('Cannot pick from an empty list.');
    }
    return item;
}

export function ramp(level: number, fromLevel: number, toLevel: number, startValue: number, endValue: number): number {
    if (level < fromLevel) {
        return 0;
    }
    const progress = Math.min(1, (level - fromLevel) / (toLevel - fromLevel));
    return startValue + (endValue - startValue) * progress;
}
