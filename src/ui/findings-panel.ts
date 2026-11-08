import type { Game } from '../core/game.ts';
import { findings } from '../content/act-one/findings.ts';
import { riddleOrigin } from '../content/act-one/riddle.ts';
import { labels, uiText } from '../content/act-one/text.ts';
import { createButton, createElement, setText } from './dom.ts';
import { GameDialog } from './dialog.ts';
import { section } from './status-panel.ts';
import type { Panel } from './panel.ts';

export class FindingsPanel implements Panel {
    readonly element = section(labels.findingsPanel);
    private readonly game: Game;
    private readonly count = createElement('span', { className: 'finding-count' });
    private readonly rows = new Map<string, { element: HTMLElement; count: HTMLElement }>();

    constructor(game: Game, navigate: (url: string) => void) {
        this.game = game;
        this.element.querySelector('h2')!.append(this.count);
        for (const finding of findings) {
            const button = createButton(finding.path, () => navigate(`${riddleOrigin}/${finding.path}`));
            button.className = 'finding-link';
            const count = createElement('span', { className: 'muted' });
            const row = createElement('div', { className: `finding-entry ${finding.rarity}` }, [createElement('div', { className: 'finding-row' }, [button, count]), createElement('p', { className: 'finding-effect', text: finding.description })]);
            this.rows.set(finding.id, { element: row, count });
            this.element.append(row);
        }
        const odds = createButton(uiText.findingsOdds, () => {
            const dialog = new GameDialog();
            const total = findings.reduce((sum, item) => sum + item.weight, 0);
            dialog.show(uiText.findingsOddsTitle, [createElement('p', { text: uiText.findingsHelp }), ...findings.map((item) => createElement('p', { className: 'odds-row', text: `${game.state.findings[item.id] ? item.path : uiText.unknownFinding} · ${item.rarity} · ${(item.weight / total * 100).toFixed(0)}%` }))]);
            dialog.element.addEventListener('close', () => dialog.element.remove(), { once: true });
        });
        odds.className = 'text-button';
        this.element.append(odds);
    }

    render(): void {
        this.element.hidden = !this.game.state.flags.findingsRevealed;
        setText(this.count, `${Object.keys(this.game.state.findings).length} / ${findings.length}`);
        for (const [id, row] of this.rows) {
            const count = this.game.state.findings[id] ?? 0;
            row.element.hidden = count === 0;
            setText(row.count, `×${count}`);
        }
    }
}
