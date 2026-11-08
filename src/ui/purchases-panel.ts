import type { Game } from '../core/game.ts';
import { canAfford } from '../core/purchasing.ts';
import { offeredUpgrades, upgrades } from '../content/act-one/upgrades.ts';
import { isUpgradeRevealed } from '../content/act-one/progress.ts';
import { labels, terminalText, uiText } from '../content/act-one/text.ts';
import { formatNumber } from '../format.ts';
import { createButton, createElement, setText } from './dom.ts';
import { section } from './status-panel.ts';
import type { Panel } from './panel.ts';

interface UpgradeCard { element: HTMLButtonElement; cost: HTMLElement; costText: string }

export class PurchasesPanel implements Panel {
    readonly element = section(labels.upgradesPanel);
    private readonly game: Game;
    private readonly cards = new Map<string, UpgradeCard>();
    private readonly feedback = createElement('p', { className: 'purchase-feedback', attributes: { role: 'status' } });
    private readonly recentlyInstalled = new Map<string, number>();
    private purchaseLockUntil = 0;
    private feedbackUntil = 0;

    constructor(game: Game) {
        this.game = game;
        const list = createElement('div', { className: 'upgrade-list' });
        for (const item of upgrades) {
            const card = createButton('', () => this.purchase(item.id, item.name));
            card.className = 'upgrade-card';
            card.dataset.upgrade = item.id;
            const cost = Object.entries(item.price).map(([id, amount]) => id === 'money' ? `$${formatNumber(amount)}` : `${formatNumber(amount)} ${id}`).join(' · ');
            const costLabel = createElement('span', { className: 'upgrade-cost', text: cost });
            card.append(createElement('div', { className: 'upgrade-heading' }, [createElement('strong', { text: item.name }), costLabel]), createElement('div', { className: 'upgrade-description', text: item.description }));
            card.title = `${item.name}: ${item.description} (${cost})`;
            card.setAttribute('aria-label', `${item.name}. ${item.description} ${uiText.cost}: ${cost}`);
            this.cards.set(item.id, { element: card, cost: costLabel, costText: cost });
            list.append(card);
        }
        this.element.append(this.feedback, list);
        game.subscribe((event) => {
            if (event.type !== 'stateReplaced') return;
            this.recentlyInstalled.clear();
            this.purchaseLockUntil = 0;
            this.feedbackUntil = 0;
            setText(this.feedback, '');
        });
    }

    render(): void {
        const now = performance.now();
        for (const [id, until] of this.recentlyInstalled) if (now >= until) this.recentlyInstalled.delete(id);
        if (now >= this.feedbackUntil) setText(this.feedback, '');
        const offered = new Set(offeredUpgrades(this.game.state).filter((item) => isUpgradeRevealed(this.game.state, item.id)).map((item) => item.id));
        this.element.hidden = !this.game.state.flags.upgradesRevealed || (offered.size === 0 && this.recentlyInstalled.size === 0);
        for (const item of upgrades) {
            const card = this.cards.get(item.id)!;
            const installed = this.recentlyInstalled.has(item.id);
            const affordable = canAfford(this.game.state, item.price);
            card.element.hidden = !offered.has(item.id) && !installed;
            card.element.disabled = installed || !affordable || now < this.purchaseLockUntil;
            card.element.classList.toggle('unaffordable', !affordable && !installed);
            card.element.classList.toggle('installed', installed);
            setText(card.cost, installed ? terminalText.purchased : card.costText);
        }
    }

    private purchase(id: string, name: string): void {
        const now = performance.now();
        if (now < this.purchaseLockUntil || !this.game.dispatch({ type: 'purchase', purchasableId: id })) return;
        // Keep the clicked card in place and ignore a second click while nearby offers change.
        this.recentlyInstalled.set(id, now + 1400);
        this.purchaseLockUntil = now + 600;
        this.feedbackUntil = now + 5000;
        setText(this.feedback, `${terminalText.purchased}: ${name}.`);
        this.render();
    }
}
