import type { Game } from '../core/game.ts';
import type { OfflineSummary } from '../core/offline.ts';
import { AwaySummary } from './away-summary.ts';
import { BrowserPanel } from './browser-panel.ts';
import { createElement } from './dom.ts';
import type { Panel } from './panel.ts';
import { PurchasesPanel } from './purchases-panel.ts';
import { StatusPanel } from './status-panel.ts';

export class GameScreen {
    readonly element: HTMLElement;
    private readonly panels: readonly Panel[];
    private readonly awaySummary: AwaySummary;

    constructor(game: Game) {
        const browserPanel = new BrowserPanel(game);
        const statusPanel = new StatusPanel(game);
        const purchasesPanel = new PurchasesPanel(game);
        this.awaySummary = new AwaySummary(game.content);
        this.panels = [browserPanel, statusPanel, purchasesPanel];
        this.element = createElement('div', { className: 'game-screen' }, [
            browserPanel.element,
            createElement('aside', { className: 'side-panels' }, [statusPanel.element, purchasesPanel.element]),
            this.awaySummary.element,
        ]);
    }

    render(): void {
        for (const panel of this.panels) {
            panel.render();
        }
    }

    showAwaySummary(summary: OfflineSummary): void {
        this.awaySummary.show(summary);
    }
}
