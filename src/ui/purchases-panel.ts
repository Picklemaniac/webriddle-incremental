import type { Game } from '../core/game.ts';
import { canAfford } from '../core/purchasing.ts';
import { offeredUpgrades, upgrades } from '../content/act-one/upgrades.ts';
import { isUpgradeRevealed } from '../content/act-one/progress.ts';
import { labels, uiText } from '../content/act-one/text.ts';
import { formatNumber } from '../format.ts';
import { createButton, createElement } from './dom.ts';
import { section } from './status-panel.ts';
import type { Panel } from './panel.ts';

interface UpgradeCard { element: HTMLButtonElement }

export class PurchasesPanel implements Panel {
    readonly element = section(labels.upgradesPanel);
    private readonly game: Game;
    private readonly cards = new Map<string, UpgradeCard>();
    private readonly leaving = new Map<string, number>();
    private purchaseLockUntil = 0;

    constructor(game: Game) {
        this.game = game;
        const list = createElement('div', { className: 'upgrade-list' });
        for (const item of upgrades) {
            const card = createButton('', () => this.purchase(item.id));
            card.className = 'upgrade-card';
            card.dataset.upgrade = item.id;
            const cost = Object.entries(item.price).map(([id, amount]) => id === 'money' ? `$${formatNumber(amount)}` : `${formatNumber(amount)} ${id}`).join(' · ');
            const costLabel = createElement('span', { className: 'upgrade-cost', text: cost });
            card.append(createElement('div', { className: 'upgrade-heading' }, [createElement('strong', { text: item.name }), costLabel]), createElement('div', { className: 'upgrade-description', text: item.description }));
            card.title = `${item.name}: ${item.description} (${cost})`;
            card.setAttribute('aria-label', `${item.name}. ${item.description} ${uiText.cost}: ${cost}`);
            this.cards.set(item.id, { element: card });
            list.append(card);
        }
        this.element.append(list);
        game.subscribe((event) => {
            if (event.type !== 'stateReplaced') return;
            this.leaving.clear();
            this.purchaseLockUntil = 0;
        });
    }

    render(): void {
        const now = performance.now();
        for (const [id, until] of this.leaving) if (now >= until) this.leaving.delete(id);
        const offered = new Set(offeredUpgrades(this.game.state).filter((item) => isUpgradeRevealed(this.game.state, item.id)).map((item) => item.id));
        this.element.hidden = !this.game.state.flags.upgradesRevealed || (offered.size === 0 && this.leaving.size === 0);
        for (const item of upgrades) {
            const card = this.cards.get(item.id)!;
            const leaving = this.leaving.has(item.id);
            const affordable = canAfford(this.game.state, item.price);
            card.element.hidden = !offered.has(item.id) && !leaving;
            card.element.disabled = leaving || !affordable || now < this.purchaseLockUntil;
            card.element.classList.toggle('unaffordable', !affordable && !leaving);
            card.element.classList.toggle('leaving', leaving);
        }
    }

    private purchase(id: string): void {
        const now = performance.now();
        if (now < this.purchaseLockUntil || !this.game.dispatch({ type: 'purchase', purchasableId: id })) return;
        // Keep the bought card's space while it fades so the next card does not slide under the cursor.
        this.leaving.set(id, now + 450);
        this.purchaseLockUntil = now + 600;
        this.render();
    }
}
