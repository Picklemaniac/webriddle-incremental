export interface RandomSource {
    randomState: number;
}

const mulberry32Increment = 0x6d2b79f5;

export function nextRandom(source: RandomSource): number {
    source.randomState = (source.randomState + mulberry32Increment) | 0;
    let value = source.randomState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
}
