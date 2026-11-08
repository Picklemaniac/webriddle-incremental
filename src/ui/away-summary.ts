import type { GameContent } from '../core/content.ts';
import type { OfflineSummary } from '../core/offline.ts';
import { formatDuration, formatNumber } from '../format.ts';
import { createButton, createElement, setText } from './dom.ts';

export class AwaySummary {
    readonly element: HTMLElement;
    private readonly content: GameContent;
    private readonly message: HTMLElement;

    constructor(content: GameContent) {
        this.content = content;
        this.message = createElement('p');
        this.element = createElement('div', { className: 'away-summary' }, [
            this.message,
            createButton('OK', () => {
                this.element.hidden = true;
            }),
        ]);
        this.element.hidden = true;
    }

    show(summary: OfflineSummary): void {
        const gains = [
            `${formatNumber(summary.levelsGained)} levels`,
            ...this.content.resources.map(
                (resource) => `${formatNumber(summary.resourceGains[resource.id] ?? 0)} ${resource.name.toLowerCase()}`,
            ),
        ];
        const cappedNote =
            summary.simulatedSeconds < summary.awaySeconds ? ` (capped at ${formatDuration(summary.simulatedSeconds)})` : '';
        setText(this.message, `Away for ${formatDuration(summary.awaySeconds)}${cappedNote}: +${gains.join(', +')}`);
        this.element.hidden = false;
    }
}
