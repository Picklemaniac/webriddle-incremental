type ModifierOperation = 'add' | 'multiply' | 'power';

export interface Modifier {
    readonly statId: string;
    readonly operation: ModifierOperation;
    readonly value: number;
}

const operationOrder: readonly ModifierOperation[] = ['add', 'multiply', 'power'];

export function calculateStats(
    baseStats: Readonly<Record<string, number>>,
    modifiers: readonly Modifier[],
): Record<string, number> {
    const stats: Record<string, number> = { ...baseStats };
    const orderedModifiers = [...modifiers].sort(
        (first, second) => operationOrder.indexOf(first.operation) - operationOrder.indexOf(second.operation),
    );
    for (const modifier of orderedModifiers) {
        stats[modifier.statId] = applyModifier(stats[modifier.statId] ?? 0, modifier);
    }
    return stats;
}

function applyModifier(value: number, modifier: Modifier): number {
    switch (modifier.operation) {
        case 'add':
            return value + modifier.value;
        case 'multiply':
            return value * modifier.value;
        case 'power':
            return value ** modifier.value;
    }
}
