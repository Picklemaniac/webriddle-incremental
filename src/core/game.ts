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
    private catchingUp = false;
    private readonly listeners = new Set<GameEventListener>();

    constructor(content: GameContent, state: GameState) {
        this.content = content;
        this.currentState = state;
    }

    get state(): GameState {
        return this.currentState;
    }

    get isCatchingUp(): boolean {
        return this.catchingUp;
    }

    stat(statId: string): number {
        this.cachedStats ??= calculateStats(this.content.baseStats, this.collectModifiers());
        return this.cachedStats[statId] ?? 0;
    }

    statWith(statId: string, extraModifiers: readonly Modifier[]): number {
        return calculateStats(this.content.baseStats, [...this.collectModifiers(), ...extraModifiers])[statId] ?? 0;
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
            this.announce({ type: 'actionApplied', action });
        }
        return applied;
    }

    advance(seconds: number, maximumStepSeconds = 1): void {
        if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(maximumStepSeconds) || maximumStepSeconds <= 0) {
            return;
        }
        const fixedStep = this.content.tickSeconds;
        if (fixedStep !== undefined) {
            const availableSeconds = this.currentState.pendingTickSeconds + seconds;
            const steps = Math.floor((availableSeconds + 1e-9) / fixedStep);
            this.currentState.pendingTickSeconds = Math.round(Math.max(0, availableSeconds - steps * fixedStep) * 1e9) / 1e9;
            for (let step = 0; step < steps; step++) this.tick(fixedStep);
            return;
        }
        const stepCount = Math.ceil(seconds / maximumStepSeconds);
        const stepSeconds = seconds / stepCount;
        for (let step = 0; step < stepCount; step++) {
            this.tick(stepSeconds);
        }
    }

    catchUp(awaySeconds: number): OfflineSummary {
        this.catchingUp = true;
        try {
            const summary = simulateOfflineProgress(this, awaySeconds);
            this.announce({ type: 'offlineProgressApplied', summary });
            return summary;
        } finally {
            this.catchingUp = false;
        }
    }

    replaceState(state: GameState): void {
        this.currentState = state;
        this.invalidateStats();
        this.announce({ type: 'stateReplaced' });
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

    announce(event: GameEvent): void {
        for (const listener of this.listeners) {
            listener(event);
        }
    }

    private apply(action: Action): boolean {
        switch (action.type) {
            case 'purchase':
                return this.purchase(action.purchasableId);
            case 'navigate':
                this.currentState.browserUrl = action.url;
                this.content.handleNavigation(this, action.url);
                return true;
            default:
                return this.content.handleAction(this, action);
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
                this.announce({ type: 'milestoneReached', milestoneId: milestone.id });
            }
        }
    }

    private collectModifiers(): Modifier[] {
        const purchaseModifiers = this.content.purchasables.flatMap((definition) => {
            const count = ownedCount(this.currentState, definition.id);
            return count > 0 && definition.modifiers !== undefined ? definition.modifiers(count) : [];
        });
        return [...purchaseModifiers, ...(this.content.extraModifiers?.(this.currentState) ?? [])];
    }
}
