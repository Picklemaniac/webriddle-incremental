import type { PurchasableDefinition, ResourceAmounts } from '../core/content.ts';
import type { Game } from '../core/game.ts';
import { canAfford, currentCost, isOffered, ownedCount } from '../core/purchasing.ts';
import { formatNumber } from '../format.ts';
import { createButton, createElement, setText } from './dom.ts';
import type { Panel } from './panel.ts';

interface PurchaseRow {
    readonly element: HTMLElement;
    readonly ownedLabel: HTMLElement;
    readonly costLabel: HTMLElement;
    readonly buyButton: HTMLButtonElement;
}

export class PurchasesPanel implements Panel {
    readonly element: HTMLElement;
    private readonly game: Game;
    private readonly list: HTMLElement;
    private readonly rows = new Map<string, PurchaseRow>();
    private shownPurchasableIds = '';

    constructor(game: Game) {
        this.game = game;
        this.list = createElement('div', { className: 'purchase-list' });
        this.element = createElement('section', { className: 'panel' }, [createElement('h2', { text: 'Upgrades' }), this.list]);
    }

    render(): void {
        const offered = this.game.content.purchasables.filter((definition) => isOffered(definition, this.game.state));
        const offeredIds = offered.map((definition) => definition.id).join(',');
        if (offeredIds !== this.shownPurchasableIds) {
            this.shownPurchasableIds = offeredIds;
            this.list.replaceChildren(...offered.map((definition) => this.rowFor(definition).element));
        }
        for (const definition of offered) {
            this.updateRow(this.rowFor(definition), definition);
        }
    }

    private rowFor(definition: PurchasableDefinition): PurchaseRow {
        const existingRow = this.rows.get(definition.id);
        if (existingRow !== undefined) {
            return existingRow;
        }
        const ownedLabel = createElement('span', { className: 'purchase-owned' });
        const costLabel = createElement('span', { className: 'purchase-cost' });
        const buyButton = createButton('Buy', () => {
            this.game.dispatch({ type: 'purchase', purchasableId: definition.id });
        });
        const element = createElement('div', { className: 'purchase-row' }, [
            createElement('span', { className: 'purchase-name', text: definition.name }),
            ownedLabel,
            costLabel,
            buyButton,
        ]);
        const row = { element, ownedLabel, costLabel, buyButton };
        this.rows.set(definition.id, row);
        return row;
    }

    private updateRow(row: PurchaseRow, definition: PurchasableDefinition): void {
        const { state } = this.game;
        const cost = currentCost(definition, state);
        setText(row.ownedLabel, `×${ownedCount(state, definition.id)}`);
        setText(row.costLabel, this.describeCost(cost));
        row.buyButton.disabled = !canAfford(state, cost);
    }

    private describeCost(cost: ResourceAmounts): string {
        return Object.entries(cost)
            .map(([resourceId, amount]) => `${formatNumber(amount)} ${this.resourceName(resourceId)}`)
            .join(', ');
    }

    private resourceName(resourceId: string): string {
        return this.game.content.resources.find((resource) => resource.id === resourceId)?.name ?? resourceId;
    }
}
