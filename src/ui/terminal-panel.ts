import type { Game } from '../core/game.ts';
import type { GameEvent } from '../core/events.ts';
import { currentSearch } from '../content/act-one/automation.ts';
import { dirbustingScripts } from '../content/act-one/economy.ts';
import { findingFile, findings } from '../content/act-one/findings.ts';
import { isLearned, lessonFor } from '../content/act-one/lessons.ts';
import { entrance, urlOfLevel } from '../content/act-one/levels.ts';
import { effectiveRate, isBanned, requestedRate } from '../content/act-one/network.ts';
import { automationBootSeconds, automationElapsed, owns } from '../content/act-one/progress.ts';
import { riddleOrigin } from '../content/act-one/riddle.ts';
import type { BlockReason } from '../content/act-one/search.ts';
import { automationText, fill, notices, terminalText, uiText, type NoticeId } from '../content/act-one/text.ts';
import { wordAtRank } from '../content/act-one/vocabulary.ts';
import { formatDuration, formatNumber } from '../format.ts';
import { createElement, createTitleBar, setText } from './dom.ts';
import type { Panel } from './panel.ts';

const warningNotices: ReadonlySet<NoticeId> = new Set<NoticeId>(['bruteForce', 'firstBan', 'firstProxyDeath']);

export class TerminalPanel implements Panel {
    readonly element = createElement('section', { className: 'terminal-window', attributes: { 'aria-label': automationText.program } });
    private readonly command = createElement('div', { className: 'terminal-command' });
    private readonly lines = createElement('div', { className: 'terminal-lines', attributes: { role: 'log', 'aria-live': 'off' } });
    private readonly live = createElement('div', { className: 'terminal-line live', attributes: { 'aria-hidden': 'true' } });
    private readonly rate = createElement('span', { className: 'terminal-rate' });
    private readonly footer = createElement('div', { className: 'terminal-footer' });
    private readonly progress = createElement('div', { className: 'terminal-progress-fill' });
    private readonly game: Game;
    private readonly pendingLines: { text: string; style: string }[] = [];
    private lastLineAt = performance.now();
    private lastSampledRequests = 0;
    private sampleIndex = 0;

    constructor(game: Game) {
        this.game = game;
        this.element.append(createTitleBar([createElement('strong', { text: automationText.program })]),
            createElement('div', { className: 'terminal' }, [this.command, this.lines, this.live]),
            createElement('div', { className: 'terminal-progress' }, [this.progress]),
            createElement('footer', { className: 'terminal-status' }, [this.footer, this.rate]));
        game.subscribe((event) => this.onEvent(event));
    }

    render(): void {
        const game = this.game;
        this.element.hidden = !game.state.flags.automated;
        if (this.element.hidden) return;
        const seconds = automationElapsed(game.state);
        const booting = seconds < automationBootSeconds;
        this.element.classList.toggle('booting', booting);
        this.command.hidden = booting;
        if (booting) {
            setText(this.rate, '');
            setText(this.footer, terminalText.booting);
            setText(this.live, '');
            this.footer.classList.remove('warning');
            this.progress.style.width = '0%';
            this.lastLineAt = performance.now();
            return;
        }
        const plan = currentSearch(game);
        let spent = game.state.search.requestsSpent;
        let phase = plan.phases[0];
        for (const candidate of plan.phases) {
            phase = candidate;
            const boundary = candidate.requestsUntilNext ?? candidate.size;
            if (spent < boundary) break;
            spent -= boundary;
        }
        const rate = effectiveRate(game);
        setText(this.rate, `${formatNumber(rate)} ${uiText.requests}`);
        const tool = owns(game.state, 'ffuf') ? 'ffuf' : owns(game.state, 'gobuster') ? 'gobuster' : owns(game.state, 'dirb') ? 'dirb' : 'curl';
        const list = phase?.label ?? 'words.txt';
        const folder = new URL(urlOfLevel(game.state.currentLevel)).pathname.replace(/[^/]*$/, '');
        const command = fill(tool === 'curl' ? terminalText.curlCommand : tool === 'gobuster' ? terminalText.gobusterCommand : terminalText.toolCommand,
            { tool, folder: `${riddleOrigin}${folder}`, list, threads: game.stat('threadsPerScript') });
        setText(this.command, command);
        this.command.title = command;
        let footer = uiText.waiting as string;
        if (isBanned(game)) footer = `${terminalText.ban} · ${formatDuration(game.state.network.bannedUntil - game.state.elapsedSeconds)}`;
        else if (dirbustingScripts(game) === 0) footer = uiText.paused;
        else if (plan.blockedBy) footer = blockedFooter(game, plan.blockedBy);
        else if (phase) footer = `${phase.label} · ${formatNumber(spent)} / ${formatNumber(phase.size)} · ${formatDuration((phase.size - spent) / Math.max(0.001, rate * game.stat('searchEfficiency')))} ${uiText.exhaust}`;
        setText(this.footer, footer);
        this.footer.title = footer;
        this.footer.classList.toggle('warning', isBanned(game) || plan.blockedBy !== null);
        this.progress.style.width = `${phase ? Math.min(100, spent / phase.size * 100) : 0}%`;
        const target = entrance(game.state.currentLevel + 1);
        const targetFolder = target.folder === null ? '/' : `/${target.folder}/`;
        const searched = phase !== undefined && plan.blockedBy === null && !isBanned(game) && dirbustingScripts(game) > 0 && rate > 0 ? phase : null;
        const request = (index: number): string => {
            const candidate = searched ? searched.candidate(Math.floor(index)) : `${wordAtRank(1 + this.sampleIndex * 47 % 1200)}.htm`;
            return candidate.startsWith('/') ? candidate : `${searched ? targetFolder : folder}${candidate}`;
        };
        setText(this.live, searched ? `${terminalText.testing} ${request(spent)}` : '');
        const now = performance.now();
        const nextLine = this.pendingLines[0];
        if (nextLine && now - this.lastLineAt >= (seconds < 600 ? 1500 : 700)) {
            this.pendingLines.shift();
            this.line(nextLine.text, nextLine.style);
        } else if (!nextLine && requestedRate(game) > 0 && now - this.lastLineAt >= sampleInterval(rate) &&
            (game.state.statistics.requestsSent ?? 0) > this.lastSampledRequests && !isBanned(game)) {
            this.lastSampledRequests = game.state.statistics.requestsSent ?? 0;
            this.sampleIndex++;
            const code = plan.blockedBy === 'credentials' ? 401 : plan.blockedBy === 'userAgent' ? 403 : plan.blockedBy === 'wildcard' ? 200 : 404;
            this.line(`${String(code)}  ${request(Math.max(0, spent - 1))}${plan.blockedBy === 'wildcard' ? `  ${terminalText.identicalResponse}` : ''}`, code === 404 ? 'miss' : 'warning');
        }
    }

    private onEvent(event: GameEvent): void {
        if (event.type === 'stateReplaced') {
            this.lines.replaceChildren();
            this.pendingLines.length = 0;
            this.sampleIndex = 0;
            this.lastSampledRequests = 0;
            this.lastLineAt = performance.now();
            return;
        }
        if (!this.game.state.flags.automated) return;
        if (this.game.isCatchingUp) return;
        switch (event.type) {
            case 'notice':
                if (warningNotices.has(event.noticeId as NoticeId)) this.queueLine(notices[event.noticeId as NoticeId], 'warning');
                break;
            case 'levelSolved': {
                if (event.method === 'windfall') break;
                const method = event.method === 'hand' ? terminalText.hand : event.method === 'search' ? terminalText.indexed : '200';
                this.queueLine(`${method}  ${new URL(urlOfLevel(event.level)).pathname}`, 'hit');
                break;
            }
            case 'findingDiscovered': {
                const finding = findings.find((item) => item.id === event.findingId);
                if (finding) this.queueLine(fill(terminalText.found, { path: finding.path, size: findingFile(finding, this.game.state).length }), 'finding');
                break;
            }
        }
    }

    private queueLine(text: string, style: string): void {
        const previous = this.pendingLines.at(-1);
        if (style === 'hit' && previous?.style === 'hit') previous.text = text;
        else this.pendingLines.push({ text, style });
        if (this.pendingLines.length > 12) this.pendingLines.shift();
    }

    private line(text: string, style: string): void {
        this.lastLineAt = performance.now();
        const nearBottom = this.lines.scrollHeight - this.lines.scrollTop - this.lines.clientHeight < 40;
        this.lines.append(createElement('div', { className: `terminal-line ${style}`, text, attributes: { title: text } }));
        while (this.lines.childElementCount > 150) this.lines.firstElementChild?.remove();
        if (nearBottom) this.lines.scrollTop = this.lines.scrollHeight;
    }
}

function sampleInterval(requestsPerSecond: number): number {
    return Math.min(3500, Math.max(250, 6000 / Math.sqrt(Math.max(1, requestsPerSecond))));
}

function blockedFooter(game: Game, blockedBy: BlockReason): string {
    const lesson = lessonFor(blockedBy, game.state.currentLevel + 1);
    if (lesson === null) return terminalText.blocks[blockedBy];
    return `${terminalText.blocks[blockedBy]} · ${isLearned(game.state, lesson) ? terminalText.learned : terminalText.byHand}`;
}
