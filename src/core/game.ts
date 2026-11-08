import type { Action } from './actions.ts';
import type { GameContent } from './content.ts';
import type { GameEvent, GameEventListener } from './events.ts';
import { simulateOfflineProgress, type OfflineSummary } from './offline.ts';
import { canAfford, currentCost, isOffered, ownedCount, spend } from './purchasing.ts';
import { nextRandom } from './random.ts';
import type { GameState } from './state.ts';
import { calculateStats, type Modifier } from './stats.ts';

export class Game {
    readonly content: GameContent;
    private currentState: GameState;
    private cachedStats: Record<string, number> | undefined;
    private readonly listeners = new Set<GameEventListener>();

    constructor(content: GameContent, state: GameState) {
        this.content = content;
        this.currentState = state;
    }

    get state(): GameState {
        return this.currentState;
    }

    stat(statId: string): number {
        this.cachedStats ??= calculateStats(this.content.baseStats, this.collectModifiers());
        return this.cachedStats[statId] ?? 0;
    }

    random(): number {
        return nextRandom(this.currentState);
    }

    gainResource(resourceId: string, amount: number): void {
        this.currentState.resources[resourceId] = (this.currentState.resources[resourceId] ?? 0) + amount;
    }

    dispatch(action: Action): boolean {
        const applied = this.apply(action);
        if (applied) {
            this.emit({ type: 'actionApplied', action });
        }
        return applied;
    }

    advance(seconds: number, maximumStepSeconds = 1): void {
        if (seconds <= 0) {
            return;
        }
        const stepCount = Math.ceil(seconds / maximumStepSeconds);
        const stepSeconds = seconds / stepCount;
        for (let step = 0; step < stepCount; step++) {
            this.tick(stepSeconds);
        }
    }

    catchUp(awaySeconds: number): OfflineSummary {
        const summary = simulateOfflineProgress(this, awaySeconds);
        this.emit({ type: 'offlineProgressApplied', summary });
        return summary;
    }

    replaceState(state: GameState): void {
        this.currentState = state;
        this.invalidateStats();
        this.emit({ type: 'stateReplaced' });
    }

    clone(): Game {
        return new Game(this.content, structuredClone(this.currentState));
    }

    subscribe(listener: GameEventListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    invalidateStats(): void {
        this.cachedStats = undefined;
    }

    private apply(action: Action): boolean {
        switch (action.type) {
            case 'purchase':
                return this.purchase(action.purchasableId);
            case 'navigate':
                this.currentState.browserUrl = action.url;
                this.content.handleNavigation(this, action.url);
                return true;
        }
    }

    private purchase(purchasableId: string): boolean {
        const definition = this.content.purchasables.find((candidate) => candidate.id === purchasableId);
        if (definition === undefined || !isOffered(definition, this.currentState)) {
            return false;
        }
        const cost = currentCost(definition, this.currentState);
        if (!canAfford(this.currentState, cost)) {
            return false;
        }
        spend(this.currentState, cost);
        this.currentState.purchases[purchasableId] = ownedCount(this.currentState, purchasableId) + 1;
        this.invalidateStats();
        return true;
    }

    private tick(deltaSeconds: number): void {
        for (const system of this.content.systems) {
            system.update(this, deltaSeconds);
        }
        this.currentState.elapsedSeconds += deltaSeconds;
        this.checkMilestones();
    }

    private checkMilestones(): void {
        for (const milestone of this.content.milestones) {
            const alreadyReached = this.currentState.reachedMilestones[milestone.id] !== undefined;
            if (!alreadyReached && milestone.isReached(this.currentState)) {
                this.currentState.reachedMilestones[milestone.id] = this.currentState.elapsedSeconds;
                this.emit({ type: 'milestoneReached', milestoneId: milestone.id });
            }
        }
    }

    private collectModifiers(): Modifier[] {
        return this.content.purchasables.flatMap((definition) => {
            const count = ownedCount(this.currentState, definition.id);
            return count > 0 && definition.modifiers !== undefined ? definition.modifiers(count) : [];
        });
    }

    private emit(event: GameEvent): void {
        for (const listener of this.listeners) {
            listener(event);
        }
    }
}
