import type { Game } from '../core/game.ts';
import { canAfford } from '../core/purchasing.ts';
import { offeredUpgrades, upgrades, type Upgrade } from '../content/act-one/upgrades.ts';
import { isUpgradeRevealed } from '../content/act-one/progress.ts';
import { fill, labels, statText, uiText } from '../content/act-one/text.ts';
import { formatNumber } from '../format.ts';
import { createButton, createElement, setText } from './dom.ts';
import { section } from './status-panel.ts';
import type { Panel } from './panel.ts';

interface UpgradeCard { element: HTMLButtonElement; effect: HTMLElement }

const statLabels: Readonly<Record<string, { readonly label: string; readonly value: string }>> = statText;
const moneyStats: ReadonlySet<string> = new Set(['ticketValue', 'ticketBotRate']);
const percentStats: ReadonlySet<string> = new Set(['dorkChance']);

export class PurchasesPanel implements Panel {
    readonly element = section(labels.upgradesPanel);
    private readonly game: Game;
    private readonly cards = new Map<string, UpgradeCard>();
    private readonly leaving = new Map<string, number>();
    private readonly empty = createElement('p', { className: 'panel-help', text: uiText.noUpgrades });
    private purchaseLockUntil = 0;

    constructor(game: Game) {
        this.game = game;
        const list = createElement('div', { className: 'upgrade-list' });
        for (const item of upgrades) {
            const card = createButton('', () => this.purchase(item));
            card.className = 'upgrade-card';
            card.dataset.upgrade = item.id;
            const cost = Object.entries(item.price).map(([id, amount]) => id === 'money' ? `$${formatNumber(amount)}` : `${formatNumber(amount)} ${id}`).join(', ');
            const effect = createElement('div', { className: 'upgrade-effect' });
            card.append(createElement('div', { className: 'upgrade-heading' }, [createElement('strong', { text: item.name }), createElement('span', { className: 'upgrade-cost', text: cost })]),
                createElement('div', { className: 'upgrade-description', text: item.description }), effect);
            this.cards.set(item.id, { element: card, effect });
            list.append(card);
        }
        this.element.append(this.empty, list);
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
        this.element.hidden = this.game.state.flags.upgradesRevealed !== true;
        this.empty.hidden = offered.size > 0 || this.leaving.size > 0;
        for (const item of upgrades) {
            const card = this.cards.get(item.id)!;
            const leaving = this.leaving.has(item.id);
            const affordable = canAfford(this.game.state, item.price);
            card.element.hidden = !offered.has(item.id) && !leaving;
            card.element.disabled = leaving || !affordable || now < this.purchaseLockUntil;
            card.element.classList.toggle('unaffordable', !affordable && !leaving);
            card.element.classList.toggle('leaving', leaving);
            if (!card.element.hidden && !leaving) setText(card.effect, this.effectText(item));
        }
    }

    private effectText(item: Upgrade): string {
        const modifiers = item.modifiers?.(1) ?? [];
        const lines = modifiers.flatMap(({ statId }) => {
            const text = statLabels[statId];
            if (text === undefined) return [];
            const value = (amount: number): string => fill(text.value, { value: statNumber(statId, amount) });
            return [fill(uiText.effectLine, { label: text.label, before: value(this.game.stat(statId)), after: value(this.game.statWith(statId, modifiers)) })];
        });
        if (item.effect !== undefined) {
            const statIds = [...item.effect.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!);
            lines.push(fill(item.effect, Object.fromEntries(statIds.map((statId) => [statId, statNumber(statId, this.game.stat(statId))]))));
        }
        return lines.join('\n');
    }

    private purchase(item: Upgrade): void {
        const now = performance.now();
        if (now < this.purchaseLockUntil || !this.game.dispatch({ type: 'purchase', purchasableId: item.id })) return;
        // Keep the bought card's space while it fades so the next card does not slide under the cursor.
        this.leaving.set(item.id, now + 450);
        this.purchaseLockUntil = now + 600;
        this.render();
    }
}

function statNumber(statId: string, value: number): string {
    if (percentStats.has(statId)) return formatNumber(Math.round(value * 100));
    if (Number.isInteger(value)) return formatNumber(value);
    return moneyStats.has(statId) ? value.toFixed(2) : String(Number(value.toFixed(2)));
}
