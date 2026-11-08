import type { PurchasableDefinition, ResourceAmounts } from './content.ts';
import type { GameState } from './state.ts';

export function ownedCount(state: GameState, purchasableId: string): number {
    return state.purchases[purchasableId] ?? 0;
}

export function currentCost(definition: PurchasableDefinition, state: GameState): ResourceAmounts {
    return definition.cost(ownedCount(state, definition.id));
}

export function isOffered(definition: PurchasableDefinition, state: GameState): boolean {
    const soldOut = definition.maximumCount !== undefined && ownedCount(state, definition.id) >= definition.maximumCount;
    return !soldOut && definition.isAvailable(state);
}

export function canAfford(state: GameState, cost: ResourceAmounts): boolean {
    return Object.entries(cost).every(([resourceId, amount]) => (state.resources[resourceId] ?? 0) >= amount);
}

export function spend(state: GameState, cost: ResourceAmounts): void {
    for (const [resourceId, amount] of Object.entries(cost)) {
        state.resources[resourceId] = (state.resources[resourceId] ?? 0) - amount;
    }
}
