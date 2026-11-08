import type { Game } from '../core/game.ts';
import { currentSearch } from '../content/act-one/automation.ts';
import { isLearned, lessonFor } from '../content/act-one/lessons.ts';
import { isBanned } from '../content/act-one/network.ts';
import type { BlockReason } from '../content/act-one/search.ts';
import { notices, terminalText, type NoticeId } from '../content/act-one/text.ts';
import { createElement, setText } from './dom.ts';
import type { Panel } from './panel.ts';

const freshMilliseconds = 10_000;
const visibleMilliseconds = 45_000;

const blockedNotices: Readonly<Record<BlockReason, string>> = {
    unguessable: terminalText.readPage, userAgent: notices.userAgentBlock, folder: notices.folderBlock,
    extension: notices.extensionBlock, wildcard: notices.wildcardBlock, credentials: notices.credentialsBlock,
};

export class NoticeLine implements Panel {
    readonly element = createElement('p', { className: 'notice-line', attributes: { role: 'status' } });
    private readonly game: Game;
    private latest = '';
    private latestAt = Number.NEGATIVE_INFINITY;

    constructor(game: Game) {
        this.game = game;
        game.subscribe((event) => {
            if (event.type === 'stateReplaced') this.latest = '';
            if (game.isCatchingUp) return;
            if (event.type === 'notice') this.show(notices[event.noticeId as NoticeId] ?? '');
            if (event.type === 'unbanned') this.show(terminalText.unbanned);
        });
    }

    render(): void {
        const { state } = this.game;
        const age = performance.now() - this.latestAt;
        let text = age < visibleMilliseconds ? this.latest : '';
        if (state.flags.automated && age >= freshMilliseconds) {
            const blockedBy = currentSearch(this.game).blockedBy;
            const lesson = lessonFor(blockedBy, state.currentLevel + 1);
            if (isBanned(this.game)) text = notices.firstBan;
            else if (blockedBy !== null) text = lesson !== null && !isLearned(state, lesson) ? `${blockedNotices[blockedBy]} ${notices.solveByHand}` : blockedNotices[blockedBy];
        }
        if (text === this.element.textContent) return;
        setText(this.element, text);
        this.element.classList.remove('fresh');
        void this.element.offsetWidth;
        this.element.classList.add('fresh');
    }

    private show(text: string): void {
        this.latest = text;
        this.latestAt = performance.now();
    }
}
