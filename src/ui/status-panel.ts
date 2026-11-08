import type { Game } from '../core/game.ts';
import { formatNumber } from '../format.ts';
import { createElement, setText } from './dom.ts';
import type { Panel } from './panel.ts';

export class StatusPanel implements Panel {
    readonly element: HTMLElement;
    private readonly game: Game;
    private readonly levelValue: HTMLElement;
    private readonly progressFill: HTMLElement;
    private readonly resourceValues = new Map<string, HTMLElement>();

    constructor(game: Game) {
        this.game = game;
        this.levelValue = createElement('strong');
        this.progressFill = createElement('div', { className: 'progress-fill' });
        const resourceRows = game.content.resources.map((resource) => {
            const value = createElement('strong');
            this.resourceValues.set(resource.id, value);
            return createElement('div', { className: 'stat-row' }, [createElement('span', { text: resource.name }), value]);
        });
        this.element = createElement('section', { className: 'panel' }, [
            createElement('div', { className: 'stat-row' }, [createElement('span', { text: 'Level' }), this.levelValue]),
            createElement('div', { className: 'progress' }, [this.progressFill]),
            ...resourceRows,
        ]);
    }

    render(): void {
        const { currentLevel, levelProgress, resources } = this.game.state;
        setText(this.levelValue, formatNumber(currentLevel));
        this.progressFill.style.width = `${(levelProgress * 100).toFixed(1)}%`;
        for (const [resourceId, valueElement] of this.resourceValues) {
            setText(valueElement, formatNumber(resources[resourceId] ?? 0));
        }
    }
}
