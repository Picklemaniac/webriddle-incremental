import { describe, expect, it } from 'vitest';
import { nextRandom } from './random.ts';

describe('nextRandom', () => {
    it('repeats the same sequence for the same seed', () => {
        const first = { randomState: 42 };
        const second = { randomState: 42 };
        const firstSequence = Array.from({ length: 5 }, () => nextRandom(first));
        const secondSequence = Array.from({ length: 5 }, () => nextRandom(second));
        expect(firstSequence).toEqual(secondSequence);
    });

    it('stays within zero inclusive and one exclusive', () => {
        const source = { randomState: 7 };
        for (let draw = 0; draw < 1_000; draw++) {
            const value = nextRandom(source);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });
});
