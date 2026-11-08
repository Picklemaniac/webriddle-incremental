import type { Game } from '../core/game.ts';
import type { OfflineSummary } from '../core/offline.ts';
import { labels } from '../content/act-one/text.ts';
import { AwaySummary } from './away-summary.ts';
import { BrowserPanel } from './browser-panel.ts';
import { createButton, createElement } from './dom.ts';
import { FindingsPanel } from './findings-panel.ts';
import type { Panel } from './panel.ts';
import { PurchasesPanel } from './purchases-panel.ts';
import { startSound } from './sound.ts';
import { StatusPanel } from './status-panel.ts';
import { TerminalPanel } from './terminal-panel.ts';

export class GameScreen {
    readonly element = createElement('main', { className: 'game-screen' });
    private readonly game: Game;
    private readonly panels: readonly Panel[];
    private readonly awaySummary: AwaySummary;
    private readonly automate: HTMLElement;
    private readonly dashboard: HTMLElement;

    constructor(game: Game) {
        this.game = game;
        const browser = new BrowserPanel(game);
        const terminal = new TerminalPanel(game);
        const status = new StatusPanel(game);
        const purchases = new PurchasesPanel(game);
        const findings = new FindingsPanel(game, (url) => browser.navigate(url));
        this.panels = [browser, terminal, status, purchases, findings];
        this.awaySummary = new AwaySummary(game.content);
        this.automate = createElement('div', { className: 'automate-prompt' }, [createButton(labels.automate, () => game.dispatch({ type: 'automate' }))]);
        const terminalSlot = createElement('div', { className: 'terminal-slot' }, [terminal.element]);
        purchases.element.classList.add('dashboard-upgrades');
        status.machineElement.classList.add('dashboard-machine');
        const support = createElement('div', { className: 'dashboard-support' }, [status.networkElement, findings.element]);
        this.dashboard = createElement('div', { className: 'dashboard' }, [status.element, purchases.element, support, status.machineElement]);
        this.element.append(createElement('div', { className: 'workspace' }, [browser.element, terminalSlot]), this.automate, this.dashboard, this.awaySummary.element);
        startSound(game);
        this.render();
    }

    render(): void {
        const automated = this.game.state.flags.automated === true;
        this.element.classList.toggle('automated', automated);
        this.automate.hidden = automated || this.game.state.currentLevel < 5;
        this.dashboard.hidden = !automated || !this.game.state.flags.insightRevealed;
        for (const panel of this.panels) panel.render();
    }

    showAwaySummary(summary: OfflineSummary): void { this.awaySummary.show(summary); }
}
