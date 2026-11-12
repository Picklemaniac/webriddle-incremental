import type { Game } from '../core/game.ts';
import type { Modifier } from '../core/stats.ts';
import { canAfford } from '../core/purchasing.ts';
import { offeredUpgrades, upgrades, type Upgrade } from '../content/act-one/upgrades.ts';
import { isUpgradeRevealed } from '../content/act-one/progress.ts';
import { fill, labels, statText, uiText } from '../content/act-one/text.ts';
import { formatBytes, formatNumber } from '../format.ts';
import { formatAmount } from './amounts.ts';
import { createButton, createElement, section } from './dom.ts';
import type { Panel } from './panel.ts';
import { setupSeconds } from './setup-windows.ts';

const statLabels: Readonly<Record<string, { readonly label: string; readonly value: string }>> = statText;
const requestStats: ReadonlySet<string> = new Set(['threadsPerScript', 'requestsPerThread']);
const moneyStats: ReadonlySet<string> = new Set(['workRate', 'ticketBotRate', 'addressRent']);
const byteStats: ReadonlySet<string> = new Set(['scourRate', 'scraperRate']);
const percentStats: ReadonlySet<string> = new Set(['dorkChance']);
const tooltipDelayMilliseconds = 350;

export class PurchasesPanel implements Panel {
    readonly element = section(labels.upgradesPanel);
    private readonly game: Game;
    private readonly cards = new Map<string, HTMLButtonElement>();
    private readonly leaving = new Map<string, number>();
    private readonly tooltip = createElement('div', { className: 'win-tooltip', attributes: { role: 'tooltip' } });
    private tooltipTimer: ReturnType<typeof setTimeout> | undefined;
    private purchaseLockUntil = 0;
    private newCardsAfter = 0;

    constructor(game: Game) {
        this.game = game;
        const list = createElement('div', { className: 'upgrade-list' });
        for (const item of upgrades) {
            const card = createButton('', () => this.purchase(item), 'upgrade-card');
            card.dataset.upgrade = item.id;
            const cost = Object.entries(item.price).map(([id, amount]) => formatAmount(id, amount)).join(', ');
            card.append(createElement('div', { className: 'upgrade-heading' }, [createElement('strong', { text: item.name }), createElement('span', { className: 'upgrade-cost', text: cost })]),
                createElement('div', { className: 'upgrade-description', text: item.description }));
            for (const show of ['mouseenter', 'focus']) card.addEventListener(show, () => this.scheduleTooltip(item, card));
            for (const hide of ['mouseleave', 'blur']) card.addEventListener(hide, () => this.hideTooltip());
            this.cards.set(item.id, card);
            list.append(card);
        }
        this.tooltip.hidden = true;
        this.element.append(list);
        document.body.append(this.tooltip);
        game.subscribe((event) => {
            if (event.type === 'actionApplied' && event.action.type === 'purchase' && !game.isCatchingUp) {
                this.newCardsAfter = Math.max(this.newCardsAfter, performance.now() + setupSeconds(event.action.purchasableId) * 1000);
            }
            if (event.type !== 'stateReplaced') return;
            this.leaving.clear();
            this.purchaseLockUntil = 0;
            this.newCardsAfter = 0;
        });
    }

    render(): void {
        const now = performance.now();
        for (const [id, until] of this.leaving) if (now >= until) this.leaving.delete(id);
        const offered = new Set(offeredUpgrades(this.game).filter((item) => isUpgradeRevealed(this.game.state, item.id)).map((item) => item.id));
        this.element.hidden = this.game.state.flags.upgradesRevealed !== true;
        for (const item of upgrades) {
            const card = this.cards.get(item.id)!;
            const leaving = this.leaving.has(item.id);
            const affordable = canAfford(this.game.state, item.price);
            const heldBack = card.hidden && (this.leaving.size > 0 || now < this.newCardsAfter);
            card.hidden = leaving ? false : !offered.has(item.id) || heldBack;
            card.disabled = leaving || !affordable || now < this.purchaseLockUntil;
            card.classList.toggle('unaffordable', !affordable && !leaving);
            card.classList.toggle('leaving', leaving);
        }
    }

    private scheduleTooltip(item: Upgrade, card: HTMLButtonElement): void {
        this.hideTooltip();
        const text = this.effectText(item);
        if (text === '') return;
        this.tooltipTimer = setTimeout(() => {
            if (card.hidden) return;
            this.tooltip.textContent = text;
            this.tooltip.hidden = false;
            const bounds = card.getBoundingClientRect();
            const width = this.tooltip.offsetWidth;
            this.tooltip.style.left = `${Math.max(4, Math.min(bounds.left + 12, window.innerWidth - width - 4))}px`;
            this.tooltip.style.top = `${bounds.bottom + 2}px`;
        }, tooltipDelayMilliseconds);
    }

    private hideTooltip(): void {
        clearTimeout(this.tooltipTimer);
        this.tooltip.hidden = true;
    }

    private effectText(item: Upgrade): string {
        const modifiers = item.modifiers?.(1) ?? [];
        const shownStats = new Set(modifiers.flatMap(({ statId }) => (requestStats.has(statId) ? [...(statId === 'threadsPerScript' ? [statId] : []), 'requestRate'] : [statId])));
        const lines = [...shownStats].flatMap((statId) => {
            const text = statLabels[statId];
            if (text === undefined) return [];
            const value = (extra: readonly Modifier[]): string => fill(text.value, { value: statNumber(statId, this.statValue(statId, extra)) });
            return [fill(uiText.effectLine, { label: text.label, before: value([]), after: value(modifiers) })];
        });
        if (item.effect !== undefined) {
            const statIds = [...item.effect.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!);
            lines.push(fill(item.effect, Object.fromEntries(statIds.map((statId) => [statId, statNumber(statId, this.game.stat(statId))]))));
        }
        return lines.join('\n');
    }

    private statValue(statId: string, extra: readonly Modifier[]): number {
        const stat = (id: string): number => this.game.statWith(id, extra);
        return statId === 'requestRate' ? stat('threadsPerScript') * stat('requestsPerThread') : stat(statId);
    }

    private purchase(item: Upgrade): void {
        const now = performance.now();
        if (now < this.purchaseLockUntil || !this.game.dispatch({ type: 'purchase', purchasableId: item.id })) return;
        this.hideTooltip();
        // Keep the bought card's space while it fades so the next card does not slide under the cursor.
        this.leaving.set(item.id, now + 450);
        this.purchaseLockUntil = now + 600;
        this.render();
    }
}

function statNumber(statId: string, value: number): string {
    if (byteStats.has(statId)) return formatBytes(value);
    if (percentStats.has(statId)) return formatNumber(Math.round(value * 100));
    if (Number.isInteger(value)) return formatNumber(value);
    return moneyStats.has(statId) ? value.toFixed(2) : String(Number(value.toFixed(2)));
}
