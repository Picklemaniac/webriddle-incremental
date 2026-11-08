import type { Game } from '../core/game.ts';
import { findingFile, findings, type Finding } from '../content/act-one/findings.ts';
import { fill, uiText } from '../content/act-one/text.ts';
import { createButton, createElement, createTitleBar, setText } from './dom.ts';
import { GameDialog } from './dialog.ts';
import type { Panel } from './panel.ts';

const icons = {
    document: '<svg width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges"><path d="M7.5 2.5h13l6 6v21h-19z" fill="#fff" stroke="#000"/><path d="M20.5 2.5v6h6" fill="#c0c0c0" stroke="#000"/><path d="M10 13h13M10 16h13M10 19h13M10 22h9" stroke="#808080"/></svg>',
    folder: '<svg width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges"><path d="M2.5 7.5h10l2 3h15v17h-27z" fill="#ffd94a" stroke="#000"/><path d="M3 12h26" stroke="#b08800"/></svg>',
    archive: '<svg width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges"><path d="M7.5 2.5h17v27h-17z" fill="#fff" stroke="#000"/><path d="M15 3v26" stroke="#808080" stroke-dasharray="2 2"/><path d="M13.5 18.5h5v5h-5z" fill="#c0c0c0" stroke="#000"/></svg>',
} as const;

function iconOf(finding: Finding): string {
    if (finding.path.endsWith('/')) return icons.folder;
    return /\.(zip|tar)$/.test(finding.path) ? icons.archive : icons.document;
}

export class FindingsPanel implements Panel {
    readonly element = createElement('section', { className: 'findings-window', attributes: { 'aria-label': uiText.findingsFolder } });
    private readonly game: Game;
    private readonly info = createElement('span', { className: 'file-info' });
    private readonly count = createElement('span', { className: 'file-count' });
    private readonly files = new Map<Finding, { element: HTMLButtonElement; label: HTMLElement }>();
    private readonly notepad = new GameDialog();
    private selected: Finding | null = null;

    constructor(game: Game) {
        this.game = game;
        const grid = createElement('div', { className: 'file-grid' });
        for (const finding of findings) {
            const icon = createElement('span', { className: 'file-icon', attributes: { 'aria-hidden': 'true' } });
            icon.innerHTML = iconOf(finding);
            const label = createElement('span', { className: 'file-label' });
            const element = createElement('button', { className: `file ${finding.rarity}`, attributes: { type: 'button' } }, [icon, label]);
            element.addEventListener('click', () => this.select(finding));
            element.addEventListener('dblclick', () => this.open(finding));
            element.addEventListener('keydown', (event) => { if (event.key === 'Enter') this.open(finding); });
            this.files.set(finding, { element, label });
            grid.append(element);
        }
        const odds = createButton(uiText.findingsOdds, () => this.showOdds());
        this.element.append(
            createTitleBar([createElement('strong', { text: uiText.findingsFolder })]),
            grid,
            createElement('footer', { className: 'file-status' }, [this.info, this.count, odds]),
        );
    }

    render(): void {
        const { state } = this.game;
        this.element.hidden = !state.flags.findingsRevealed;
        let found = 0;
        for (const [finding, file] of this.files) {
            const copies = state.findings[finding.id] ?? 0;
            if (copies > 0) found++;
            file.element.hidden = copies === 0;
            file.element.classList.toggle('selected', finding === this.selected);
            setText(file.label, copies > 1 ? `${finding.path} ×${copies}` : finding.path);
        }
        setText(this.count, fill(uiText.foundCount, { found, total: findings.length }));
        setText(this.info, this.selected === null ? uiText.openHint : `${this.selected.path} · ${this.selected.description}`);
    }

    private select(finding: Finding): void {
        this.selected = finding;
        this.render();
    }

    private open(finding: Finding): void {
        this.select(finding);
        this.notepad.show(fill(uiText.notepadTitle, { file: finding.path }), [createElement('pre', { className: 'notepad-text', text: findingFile(finding, this.game.state) })], [], true);
    }

    private showOdds(): void {
        const total = findings.reduce((sum, item) => sum + item.weight, 0);
        const rows = findings.map((item) => createElement('p', { className: 'odds-row', text: `${this.game.state.findings[item.id] ? item.path : uiText.unknownFinding} · ${item.rarity} · ${(item.weight / total * 100).toFixed(0)}%` }));
        this.notepad.show(uiText.findingsOddsTitle, [createElement('p', { text: uiText.findingsHelp }), ...rows]);
    }
}
