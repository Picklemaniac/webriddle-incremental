import { backlogSeconds, isAway } from '../content/act-one/economy.ts';
import type { Game } from '../core/game.ts';
import type { OfflineSummary } from '../core/offline.ts';
import { dialogText, fill, uiText } from '../content/act-one/text.ts';
import { formatDuration, formatNumber } from '../format.ts';
import { formatAmount } from './amounts.ts';
import { GameDialog } from './dialog.ts';
import { createElement } from './dom.ts';

const listFormat = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });

export class AwaySummary {
    private readonly dialog = new GameDialog();
    private readonly game: Game;

    constructor(game: Game) {
        this.game = game;
    }

    show(summary: OfflineSummary): void {
        const capped = summary.awaySeconds > summary.simulatedSeconds + 1;
        const gains = this.game.content.resources.filter((item) => (summary.resourceGains[item.id] ?? 0) > 0).map((item) => formatAmount(item.id, summary.resourceGains[item.id]!));
        if (summary.levelsGained === 0 && gains.length === 0) return;
        const lines = [
            fill(uiText.away, { time: formatDuration(summary.awaySeconds) }),
            ...(capped ? [fill(uiText.awayCapped, { time: formatDuration(summary.simulatedSeconds) })] : []),
            ...(summary.levelsGained > 0 ? [fill(summary.levelsGained === 1 ? uiText.awayLevel : uiText.awayLevels, { levels: formatNumber(summary.levelsGained) })] : []),
            ...(gains.length > 0 ? [fill(uiText.awayEarned, { amounts: listFormat.format(gains) })] : []),
            ...(isAway(this.game.state) ? [fill(uiText.awayJobsWaited, { minutes: backlogSeconds / 60 })] : []),
        ];
        this.dialog.show(uiText.awayTitle, lines.map((text) => createElement('p', { text })), { closeLabel: dialogText.ok });
    }
}
