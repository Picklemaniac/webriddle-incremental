import { describe, expect, it } from 'vitest';
import { calculateStats } from './stats.ts';

describe('calculateStats', () => {
    it('applies additions, then multiplications, then powers', () => {
        const stats = calculateStats({ power: 2 }, [
            { statId: 'power', operation: 'power', value: 2 },
            { statId: 'power', operation: 'multiply', value: 3 },
            { statId: 'power', operation: 'add', value: 1 },
        ]);
        expect(stats.power).toBe(81);
    });

    it('starts stats without a base value at zero', () => {
        const stats = calculateStats({}, [{ statId: 'speed', operation: 'add', value: 5 }]);
        expect(stats.speed).toBe(5);
    });
});
