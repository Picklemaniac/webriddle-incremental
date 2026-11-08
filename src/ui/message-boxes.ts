import type { Game } from '../core/game.ts';
import { automationText, dialogText, notices, type NoticeId } from '../content/act-one/text.ts';
import { GameDialog } from './dialog.ts';
import { createElement } from './dom.ts';

const messageBoxNotices: ReadonlySet<NoticeId> = new Set<NoticeId>([
    'firstRateLimit', 'userAgentBlock', 'folderBlock', 'extensionBlock', 'wildcardBlock', 'credentialsBlock',
    'leetAnswer', 'numberAnswer', 'twoWordsAnswer', 'phraseWall',
]);

export class MessageBoxes {
    private readonly dialog = new GameDialog();
    private readonly queue: string[] = [];

    constructor(game: Game) {
        game.subscribe((event) => {
            if (event.type !== 'notice' || game.isCatchingUp || !messageBoxNotices.has(event.noticeId as NoticeId)) return;
            this.queue.push(notices[event.noticeId as NoticeId]);
            if (!this.dialog.element.open) this.showNext();
        });
        this.dialog.element.addEventListener('close', () => this.showNext());
    }

    private showNext(): void {
        const text = this.queue.shift();
        if (text === undefined) return;
        const body = createElement('div', { className: 'message-box' }, [
            createElement('span', { className: 'message-icon', text: '!', attributes: { 'aria-hidden': 'true' } }),
            createElement('p', { text }),
        ]);
        this.dialog.show(automationText.program, [body], [], false, dialogText.ok);
    }
}
