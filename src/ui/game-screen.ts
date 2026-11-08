import type { Game } from '../core/game.ts';
import type { OfflineSummary } from '../core/offline.ts';
import { labels } from '../content/act-one/text.ts';
import { AwaySummary } from './away-summary.ts';
import { BrowserPanel } from './browser-panel.ts';
import { createButton, createElement } from './dom.ts';
import { FindingsPanel } from './findings-panel.ts';
import { MessageBoxes } from './message-boxes.ts';
import type { Panel } from './panel.ts';
import { PurchasesPanel } from './purchases-panel.ts';
import { SetupWindows } from './setup-windows.ts';
import { SetupWizard } from './setup-wizard.ts';
import { startSound } from './sound.ts';
import { StatusPanel } from './status-panel.ts';
import { TerminalPanel } from './terminal-panel.ts';

const automationOfferDelaySeconds = 5;

export class GameScreen {
    readonly element = createElement('main', { className: 'game-screen' });
    private readonly game: Game;
    private readonly panels: readonly Panel[];
    private readonly awaySummary: AwaySummary;
    private readonly automate: HTMLButtonElement;
    private readonly prompt: HTMLElement;
    private readonly messageBoxes: MessageBoxes;
    private readonly setupWindows: SetupWindows;
    private readonly dashboard: HTMLElement;
    private readonly wizard = new SetupWizard();

    constructor(game: Game) {
        this.game = game;
        const browser = new BrowserPanel(game);
        const terminal = new TerminalPanel(game);
        const status = new StatusPanel(game);
        const purchases = new PurchasesPanel(game);
        const findings = new FindingsPanel(game);
        this.panels = [browser, terminal, status, purchases, findings];
        this.messageBoxes = new MessageBoxes(game);
        this.setupWindows = new SetupWindows(game);
        this.awaySummary = new AwaySummary(game.content);
        this.automate = createButton(labels.automate, () => this.wizard.open(() => game.dispatch({ type: 'automate' })));
        this.automate.className = 'automate-offer';
        this.prompt = createElement('div', { className: 'prompt-area' }, [this.automate]);
        const browserColumn = createElement('div', { className: 'browser-column' }, [browser.element, this.prompt]);
        const terminalSlot = createElement('div', { className: 'terminal-slot' }, [terminal.element]);
        purchases.element.classList.add('dashboard-upgrades');
        status.machineElement.classList.add('dashboard-machine');
        const support = createElement('div', { className: 'dashboard-support' }, [status.networkElement, findings.element]);
        this.dashboard = createElement('div', { className: 'dashboard' }, [status.element, purchases.element, support, status.machineElement]);
        this.element.append(createElement('div', { className: 'workspace' }, [browserColumn, terminalSlot]), this.dashboard, this.awaySummary.element);
        startSound(game);
        this.render();
    }

    render(): void {
        const { state } = this.game;
        const automated = state.flags.automated === true;
        const offered = state.currentLevel > 5 || (state.currentLevel === 5 && state.elapsedSeconds - (state.statistics.lastSolveAt ?? 0) >= automationOfferDelaySeconds);
        this.element.classList.toggle('automated', automated);
        this.prompt.hidden = automated;
        this.automate.hidden = !offered;
        this.dashboard.hidden = !automated || state.flags.upgradesRevealed !== true;
        for (const panel of this.panels) panel.render();
    }

    showAwaySummary(summary: OfflineSummary): void { this.awaySummary.show(summary); }
}
