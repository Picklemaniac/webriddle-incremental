import type { GameContent } from '../core/content.ts';
import type { OfflineSummary } from '../core/offline.ts';
import { fill, labels, uiText } from '../content/act-one/text.ts';
import { formatDuration, formatNumber } from '../format.ts';
import { createButton, createElement } from './dom.ts';

export class AwaySummary {
    readonly element = createElement('aside', { className: 'away-summary', attributes: { role: 'status' } });
    private readonly message = createElement('div');
    private readonly content: GameContent;

    constructor(content: GameContent) {
        this.content = content;
        this.element.append(this.message, createButton(uiText.dismiss, () => { this.element.hidden = true; }));
        this.element.hidden = true;
    }

    show(summary: OfflineSummary): void {
        const capped = summary.awaySeconds > summary.simulatedSeconds + 1;
        this.message.replaceChildren(createElement('strong', { text: fill(uiText.away, { time: formatDuration(summary.awaySeconds) }) }),
            createElement('p', { text: `${formatNumber(summary.levelsGained)} ${uiText.levelsSolved}${capped ? ` (${labels.awayCapped} ${formatDuration(summary.simulatedSeconds)})` : ''}` }),
            createElement('p', { className: 'muted', text: this.content.resources.filter((item) => (summary.resourceGains[item.id] ?? 0) > 0).map((item) => `+${formatNumber(summary.resourceGains[item.id]!)} ${item.name.toLowerCase()}`).join(', ') }));
        this.element.hidden = false;
    }
}
