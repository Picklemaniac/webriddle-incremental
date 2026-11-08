import type { PurchasableDefinition, ResourceAmounts } from '../core/content.ts';
import type { Game } from '../core/game.ts';
import { canAfford, currentCost, isOffered } from '../core/purchasing.ts';

export interface Strategy {
    readonly decisionIntervalSeconds: number;
    act(game: Game): boolean;
}

export function progressOf(game: Game): number {
    return game.state.currentLevel + game.state.levelProgress;
}

export function buyEverythingAffordable(decisionIntervalSeconds: number): Strategy {
    return {
        decisionIntervalSeconds,
        act: (game) => buyRepeatedly(game, () => cheapestAffordable(game)),
    };
}

export function buyBestValue(decisionIntervalSeconds: number, measurementSeconds = 5): Strategy {
    return {
        decisionIntervalSeconds,
        act: (game) =>
            buyRepeatedly(game, () => {
                const bestPurchase = bestValuePurchase(game, measurementSeconds);
                const affordable = bestPurchase !== undefined && canAfford(game.state, currentCost(bestPurchase, game.state));
                return affordable ? bestPurchase : undefined;
            }),
    };
}

function buyRepeatedly(game: Game, choosePurchase: () => PurchasableDefinition | undefined): boolean {
    let boughtSomething = false;
    for (let choice = choosePurchase(); choice !== undefined; choice = choosePurchase()) {
        if (!game.dispatch({ type: 'purchase', purchasableId: choice.id })) {
            break;
        }
        boughtSomething = true;
    }
    return boughtSomething;
}

function offeredPurchasables(game: Game): PurchasableDefinition[] {
    return game.content.purchasables.filter((definition) => isOffered(definition, game.state));
}

function cheapestAffordable(game: Game): PurchasableDefinition | undefined {
    return offeredPurchasables(game)
        .filter((definition) => canAfford(game.state, currentCost(definition, game.state)))
        .sort((first, second) => totalAmount(currentCost(first, game.state)) - totalAmount(currentCost(second, game.state)))[0];
}

function totalAmount(amounts: ResourceAmounts): number {
    return Object.values(amounts).reduce((sum, amount) => sum + amount, 0);
}

function bestValuePurchase(game: Game, measurementSeconds: number): PurchasableDefinition | undefined {
    const baselineRate = measureProgressRate(game.clone(), measurementSeconds);
    const incomeRates = measureIncomeRates(game.clone(), measurementSeconds);
    let bestPurchase: PurchasableDefinition | undefined;
    let bestValue = 0;
    for (const definition of offeredPurchasables(game)) {
        const cost = currentCost(definition, game.state);
        const rateGain = measureProgressRate(cloneWithPurchase(game, definition.id, cost), measurementSeconds) - baselineRate;
        const value = rateGain / costInSecondsOfIncome(cost, incomeRates);
        if (value > bestValue) {
            bestValue = value;
            bestPurchase = definition;
        }
    }
    return bestPurchase;
}

function measureProgressRate(probe: Game, measurementSeconds: number): number {
    const progressBefore = progressOf(probe);
    probe.advance(measurementSeconds);
    return (progressOf(probe) - progressBefore) / measurementSeconds;
}

function measureIncomeRates(probe: Game, measurementSeconds: number): Record<string, number> {
    const resourcesBefore = { ...probe.state.resources };
    probe.advance(measurementSeconds);
    return Object.fromEntries(
        Object.entries(probe.state.resources).map(([resourceId, amount]) => [
            resourceId,
            (amount - (resourcesBefore[resourceId] ?? 0)) / measurementSeconds,
        ]),
    );
}

function cloneWithPurchase(game: Game, purchasableId: string, cost: ResourceAmounts): Game {
    const probe = game.clone();
    for (const [resourceId, amount] of Object.entries(cost)) {
        probe.gainResource(resourceId, amount);
    }
    probe.dispatch({ type: 'purchase', purchasableId });
    return probe;
}

function costInSecondsOfIncome(cost: ResourceAmounts, incomeRates: Readonly<Record<string, number>>): number {
    let seconds = 0;
    for (const [resourceId, amount] of Object.entries(cost)) {
        const income = incomeRates[resourceId] ?? 0;
        if (amount > 0) {
            seconds = Math.max(seconds, income > 0 ? amount / income : Number.POSITIVE_INFINITY);
        }
    }
    return seconds;
}
