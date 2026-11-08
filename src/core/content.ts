import type { Action } from './actions.ts';
import type { Game } from './game.ts';
import type { GameState } from './state.ts';
import type { Modifier } from './stats.ts';

export type ResourceAmounts = Readonly<Record<string, number>>;

interface ResourceDefinition {
    readonly id: string;
    readonly name: string;
}

export interface PurchasableDefinition {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
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
    readonly title?: string;
    readonly html: string;
    readonly source?: string;
    readonly loginRealm?: string;
}

export interface GameContent {
    readonly tickSeconds?: number;
    readonly homeUrl: string;
    readonly startUrl: string;
    readonly resources: readonly ResourceDefinition[];
    readonly baseStats: Readonly<Record<string, number>>;
    readonly purchasables: readonly PurchasableDefinition[];
    readonly milestones: readonly MilestoneDefinition[];
    readonly systems: readonly GameSystem[];
    resolvePage(url: string, state: GameState): Page;
    handleNavigation(game: Game, url: string): void;
    handleAction(game: Game, action: Action): boolean;
    extraModifiers?(state: GameState): readonly Modifier[];
    offlineCapSeconds(state: GameState): number;
}
