import type { Game } from './game.ts';
import type { GameState } from './state.ts';
import type { Modifier } from './stats.ts';

export type ResourceAmounts = Readonly<Record<string, number>>;

export interface ResourceDefinition {
    readonly id: string;
    readonly name: string;
}

export interface PurchasableDefinition {
    readonly id: string;
    readonly name: string;
    readonly maximumCount?: number;
    cost(ownedCount: number): ResourceAmounts;
    isAvailable(state: GameState): boolean;
    modifiers?(ownedCount: number): readonly Modifier[];
}

export interface MilestoneDefinition {
    readonly id: string;
    readonly name: string;
    isReached(state: GameState): boolean;
}

export interface GameSystem {
    update(game: Game, deltaSeconds: number): void;
}

export interface Page {
    readonly statusCode: number;
    readonly html: string;
}

export interface GameContent {
    readonly startUrl: string;
    readonly resources: readonly ResourceDefinition[];
    readonly baseStats: Readonly<Record<string, number>>;
    readonly purchasables: readonly PurchasableDefinition[];
    readonly milestones: readonly MilestoneDefinition[];
    readonly systems: readonly GameSystem[];
    resolvePage(url: string, state: GameState): Page;
    handleNavigation(game: Game, url: string): void;
    offlineCapSeconds(state: GameState): number;
}
