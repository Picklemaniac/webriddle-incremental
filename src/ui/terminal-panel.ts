import type { Game } from '../core/game.ts';
import type { GameEvent } from '../core/events.ts';
import { currentSearch } from '../content/act-one/automation.ts';
import { dirbustingScripts } from '../content/act-one/economy.ts';
import { findingFile, findings } from '../content/act-one/findings.ts';
import { urlOfLevel } from '../content/act-one/levels.ts';
import { effectiveRate, isBanned, requestedRate } from '../content/act-one/network.ts';
import { automationBootSeconds, automationElapsed } from '../content/act-one/progress.ts';
import { riddleOrigin } from '../content/act-one/riddle.ts';
import { currentPhase, starterWordlistName, type SearchPhase, type SearchPlan, type SlowReason } from '../content/act-one/search.ts';
import { automationText, fill, notices, terminalText, toolCommands, uiText, type NoticeId } from '../content/act-one/text.ts';
import { ownedTier, toolTiers } from '../content/act-one/upgrades.ts';
import { wordAtRank } from '../content/act-one/vocabulary.ts';
import { formatDuration, formatNumber } from '../format.ts';
import { createElement, createTitleBar, setText } from './dom.ts';
import type { Panel } from './panel.ts';

const warningNotices: ReadonlySet<NoticeId> = new Set<NoticeId>(['firstRateLimit', 'bruteForce', 'firstBan', 'firstProxyDeath']);
const slowResponses: Readonly<Partial<Record<SlowReason, number>>> = { credentials: 401, userAgent: 403, wildcard: 200 };
const missResponse = 404;
const userAgentPassesEvery = 10;
const commandTemplates = [terminalText.curlCommand, terminalText.toolCommand, terminalText.gobusterCommand, terminalText.toolCommand, terminalText.toolCommand];
const earlyLineMilliseconds = 1500;
const laterLineMilliseconds = 700;
const earlyAutomationSeconds = 600;
const queuedLineLimit = 12;
const shownLineLimit = 150;
const scrolledToBottomPixels = 40;
const idleSampleSpread = 47;
const idleSampleWords = 1200;

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
            this.renderBooting();
            return;
        }
        const plan = currentSearch(game);
        const { phase, spent } = currentPhase(plan, game.state.search.requestsSpent);
        const rate = effectiveRate(game);
        setText(this.rate, `${formatNumber(rate)} ${uiText.requests}`);
        const folder = plan.folder === null ? '/' : `/${plan.folder}/`;
        const command = this.commandText(phase, folder);
        setText(this.command, command);
        this.command.title = command;
        const footer = this.footerText(plan, phase, spent, rate);
        setText(this.footer, footer);
        this.footer.title = footer;
        this.footer.classList.toggle('warning', isBanned(game) || plan.slowedBy !== null);
        this.progress.style.width = `${phase ? Math.min(100, spent / phase.size * 100) : 0}%`;
        const searched = phase !== undefined && plan.speed > 0 && !isBanned(game) && dirbustingScripts(game) > 0 && rate > 0 ? phase : null;
        const request = (index: number): string => this.requestAddress(searched, index, folder);
        setText(this.live, searched ? `${terminalText.testing} ${request(spent)}` : '');
        this.emitLine(plan, rate, seconds, () => request(Math.max(0, spent - 1)));
    }

    private renderBooting(): void {
        setText(this.rate, '');
        setText(this.footer, terminalText.booting);
        setText(this.live, '');
        this.footer.classList.remove('warning');
        this.progress.style.width = '0%';
        this.lastLineAt = performance.now();
    }

    private commandText(phase: SearchPhase | undefined, folder: string): string {
        const tier = ownedTier(this.game.state, toolTiers);
        return fill(commandTemplates[tier]!, { tool: toolCommands[tier]!, folder: `${riddleOrigin}${folder}`, list: phase?.label ?? starterWordlistName, threads: this.game.stat('threadsPerScript') });
    }

    private footerText(plan: SearchPlan, phase: SearchPhase | undefined, spent: number, rate: number): string {
        const game = this.game;
        if (isBanned(game)) return fill(terminalText.banned, { time: formatDuration(game.state.network.bannedUntil - game.state.elapsedSeconds) });
        if (dirbustingScripts(game) === 0) return uiText.paused;
        if (plan.speed === 0) return terminalText.unguessable;
        if (phase === undefined) return uiText.waiting;
        const time = formatDuration((phase.size - spent) / Math.max(0.001, rate * game.stat('searchEfficiency') * plan.speed));
        if (plan.slowedBy !== null) return fill(terminalText.slowProgress, { reason: terminalText.slow[plan.slowedBy], time });
        return fill(terminalText.progress, { list: phase.label, tried: formatNumber(spent), total: formatNumber(phase.size), time });
    }

    private requestAddress(searched: SearchPhase | null, index: number, folder: string): string {
        const candidate = searched ? searched.candidate(Math.floor(index)) : `${wordAtRank(1 + this.sampleIndex * idleSampleSpread % idleSampleWords)}.htm`;
        return candidate.startsWith('/') || candidate.includes('://') ? candidate : `${folder}${candidate}`;
    }

    private emitLine(plan: SearchPlan, rate: number, seconds: number, sampledRequest: () => string): void {
        const game = this.game;
        const now = performance.now();
        const nextLine = this.pendingLines[0];
        if (nextLine && now - this.lastLineAt >= (seconds < earlyAutomationSeconds ? earlyLineMilliseconds : laterLineMilliseconds)) {
            this.pendingLines.shift();
            this.line(nextLine.text, nextLine.style);
            return;
        }
        const requestsSent = game.state.statistics.requestsSent ?? 0;
        if (nextLine || requestedRate(game) === 0 || now - this.lastLineAt < sampleInterval(rate) || requestsSent <= this.lastSampledRequests || isBanned(game)) return;
        this.lastSampledRequests = requestsSent;
        this.sampleIndex++;
        const code = this.responseCode(plan);
        const note = code === slowResponses.wildcard ? `  ${terminalText.identicalResponse}` : '';
        this.line(`${String(code)}  ${sampledRequest()}${note}`, code === missResponse ? 'miss' : 'warning');
    }

    private responseCode(plan: SearchPlan): number {
        if (plan.slowedBy === 'userAgent' && this.sampleIndex % userAgentPassesEvery === 0) return missResponse;
        return (plan.slowedBy === null ? undefined : slowResponses[plan.slowedBy]) ?? missResponse;
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
                const solved = new URL(urlOfLevel(event.level));
                this.queueLine(`${method}  ${solved.origin === riddleOrigin ? solved.pathname : solved.href}`, 'hit');
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
        if (this.pendingLines.length > queuedLineLimit) this.pendingLines.shift();
    }

    private line(text: string, style: string): void {
        this.lastLineAt = performance.now();
        const nearBottom = this.lines.scrollHeight - this.lines.scrollTop - this.lines.clientHeight < scrolledToBottomPixels;
        this.lines.append(createElement('div', { className: `terminal-line ${style}`, text, attributes: { title: text } }));
        while (this.lines.childElementCount > shownLineLimit) this.lines.firstElementChild?.remove();
        if (nearBottom) this.lines.scrollTop = this.lines.scrollHeight;
    }
}

function sampleInterval(requestsPerSecond: number): number {
    return Math.min(3500, Math.max(250, 6000 / Math.sqrt(Math.max(1, requestsPerSecond))));
}
