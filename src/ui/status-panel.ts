import type { Game } from '../core/game.ts';
import { assignedScripts, cooldownRemaining, dirbustingScripts, isJobUnlocked, moneyPerSecond, scriptSlots, wordsPerSecond } from '../content/act-one/economy.ts';
import { effectiveRate, isBanned, liveProxies, networkCapacity, requestedRate } from '../content/act-one/network.ts';
import { owns } from '../content/act-one/progress.ts';
import { connectionNames, labels, toolNames, uiText } from '../content/act-one/text.ts';
import { formatDuration, formatNumber } from '../format.ts';
import { createButton, createElement, setText } from './dom.ts';
import type { Panel } from './panel.ts';

interface ResourceRow { element: HTMLElement; value: HTMLElement; rate: HTMLElement; button: HTMLButtonElement; yield: HTMLElement }
interface WorkerRow { element: HTMLElement; count: HTMLElement; minus: HTMLButtonElement; plus: HTMLButtonElement }

export class StatusPanel implements Panel {
    readonly element = createElement('div', { className: 'status-panels' });
    readonly networkElement = section(labels.networkPanel);
    readonly machineElement = createElement('details', { className: 'panel machine-details' }, [createElement('summary', { text: uiText.machineDetails })]);
    private readonly game: Game;
    private readonly you = section(labels.youPanel);
    private readonly resources = new Map<string, ResourceRow>();
    private readonly scripts = section(labels.scriptsPanel);
    private readonly workerRows = new Map<string, WorkerRow>();
    private readonly bustingCount = createElement('strong');
    private readonly machineValues = new Map<string, HTMLElement>();
    private readonly networkValues = new Map<string, HTMLElement>();
    private readonly proxyRows: { element: HTMLElement; address: HTMLElement; lifetime: HTMLElement; replace: HTMLButtonElement }[] = [];
    private readonly heat = createElement('div', { className: 'heat-fill' });
    private readonly proxySummary = createElement('span', { className: 'proxy-summary' });
    private readonly proxyList = createElement('div', { className: 'proxy-list' });
    private readonly proxies = createElement('div', { className: 'proxy-controls' });
    private readonly replaceDead: HTMLButtonElement;

    constructor(game: Game) {
        this.game = game;
        for (const [id, name, action] of [['money', labels.money, 'work'], ['words', labels.words, 'scour']] as const) {
            const value = createElement('strong');
            const rate = createElement('span', { className: 'income-rate' });
            const yieldLabel = createElement('span', { className: 'action-yield' });
            const button = createButton('', () => game.dispatch({ type: action }));
            button.className = 'resource-action';
            button.replaceChildren(createElement('span', { text: labels[action] }), yieldLabel);
            const row = createElement('div', { className: 'resource-row' }, [createElement('span', { text: name }), value, rate, button]);
            this.you.append(row);
            this.resources.set(id, { element: row, value, rate, button, yield: yieldLabel });
        }
        this.scripts.append(createElement('p', { className: 'panel-help', text: uiText.workersHelp }), createElement('div', { className: 'stat-row' }, [createElement('span', { text: labels.dirbusting }), this.bustingCount]));
        for (const [id, label] of [['ticketing', labels.ticketBot], ['scraping', labels.scraping]] as const) {
            const count = createElement('strong');
            const minus = createButton('−', () => game.dispatch({ type: 'assignJob', jobId: id, change: -1 }));
            const plus = createButton('+', () => game.dispatch({ type: 'assignJob', jobId: id, change: 1 }));
            minus.setAttribute('aria-label', uiText.removeWorker.replace('{job}', label));
            plus.setAttribute('aria-label', uiText.addWorker.replace('{job}', label));
            const row = createElement('div', { className: 'worker-row' }, [createElement('span', { text: label }), minus, count, plus]);
            this.scripts.append(row);
            this.workerRows.set(id, { element: row, count, minus, plus });
        }
        for (const [id, label] of [['connection', labels.connection], ['tool', labels.tool], ['slots', uiText.slots], ['threads', uiText.threads], ['efficiency', uiText.efficiency]]) this.machineValues.set(id!, this.addStat(this.machineElement, label!));
        for (const [id, label] of [['sending', labels.sending], ['allowed', labels.rateLimit], ['ips', labels.ips], ['status', labels.heat]]) this.networkValues.set(id!, this.addStat(this.networkElement, label!));
        this.replaceDead = createButton('', () => {
            game.state.network.proxies.forEach((proxy, index) => {
                if (proxy.diesAtSeconds <= game.state.elapsedSeconds) game.dispatch({ type: 'replaceProxy', proxyIndex: index });
            });
            this.render();
        });
        setText(this.replaceDead, uiText.replaceDeadProxies);
        this.replaceDead.className = 'replace-dead-proxies';
        this.replaceDead.title = uiText.replacement;
        this.proxies.append(
            createElement('div', { className: 'stat-row' }, [createElement('span', { text: uiText.proxies }), this.proxySummary]),
            this.replaceDead,
            createElement('details', { className: 'proxy-details' }, [createElement('summary', { text: uiText.individualProxies }), this.proxyList]),
        );
        this.networkElement.classList.add('network-panel');
        this.networkElement.append(createElement('div', { className: 'heat-track' }, [this.heat]), this.proxies);
        this.element.append(this.you, this.scripts);
    }

    render(): void {
        const game = this.game;
        this.you.hidden = !game.state.flags.moneyRevealed && !game.state.flags.wordsRevealed;
        for (const [id, row] of this.resources) {
            row.element.hidden = !game.state.flags[`${id}Revealed`];
            setText(row.value, `${id === 'money' ? '$' : ''}${formatNumber(game.state.resources[id] ?? 0)}`);
            const rate = id === 'money' ? moneyPerSecond(game) : wordsPerSecond(game);
            setText(row.rate, rate > 0 ? `+${rate.toFixed(1).replace('.0', '')}/s` : '');
            const remaining = cooldownRemaining(game, id === 'money' ? 'work' : 'scour');
            row.button.disabled = remaining > 0;
            row.button.style.setProperty('--cooldown', `${remaining / 2 * 100}%`);
            setText(row.yield, `+${id === 'money' ? '$' : ''}${formatNumber(game.stat(id === 'money' ? 'ticketValue' : 'scourValue'))}${id === 'words' ? ` ${labels.words.toLowerCase()}` : ''}`);
        }
        this.scripts.hidden = !game.state.flags.scriptsRevealed;
        setText(this.bustingCount, String(dirbustingScripts(game)));
        for (const [id, row] of this.workerRows) {
            const jobId = id as 'ticketing' | 'scraping';
            row.element.hidden = !isJobUnlocked(game, jobId);
            const count = assignedScripts(game, jobId);
            setText(row.count, String(count));
            row.minus.disabled = count === 0;
            row.plus.disabled = dirbustingScripts(game) === 0;
        }
        const connection = owns(game.state, 'fiber') ? 4 : owns(game.state, 'cable') ? 3 : owns(game.state, 'adsl') ? 2 : owns(game.state, 'isdn') ? 1 : 0;
        const tool = toolNames[owns(game.state, 'ffuf') ? 3 : owns(game.state, 'gobuster') ? 2 : owns(game.state, 'dirb') ? 1 : 0]!;
        for (const [id, value] of Object.entries({ connection: connectionNames[connection]!, tool, slots: String(scriptSlots(game)), threads: String(game.stat('threadsPerScript')), efficiency: `${game.stat('searchEfficiency').toFixed(1)}×` })) setText(this.machineValues.get(id)!, value);
        this.machineElement.hidden = !game.state.flags.machineRevealed;
        this.networkElement.hidden = !game.state.flags.networkRevealed;
        for (const [id, value] of Object.entries({ sending: `${formatNumber(owns(game.state, 'throttle') ? effectiveRate(game) : requestedRate(game))}/s`, allowed: `${formatNumber(networkCapacity(game))}/s`, ips: `${1 + liveProxies(game) + game.stat('extraAddresses')}`, status: isBanned(game) ? `${labels.banned} · ${formatDuration(game.state.network.bannedUntil - game.state.elapsedSeconds)}` : `${Math.round(game.state.network.heat)}%` })) setText(this.networkValues.get(id)!, value);
        this.heat.style.width = `${game.state.network.heat}%`;
        const aliveCount = liveProxies(game);
        const deadCount = game.state.network.proxies.length - aliveCount;
        this.proxies.hidden = game.state.network.proxies.length === 0;
        this.replaceDead.hidden = deadCount === 0;
        this.proxySummary.classList.toggle('has-dead-proxies', deadCount > 0);
        setText(this.proxySummary, `${aliveCount} ${labels.proxyAlive} · ${deadCount} ${labels.proxyDead}`);
        game.state.network.proxies.forEach((proxy, index) => {
            let row = this.proxyRows[index];
            if (!row) {
                const address = createElement('span', { className: 'proxy-address' });
                const lifetime = createElement('span', { className: 'muted' });
                const replace = createButton(labels.replace, () => game.dispatch({ type: 'replaceProxy', proxyIndex: index }));
                replace.title = uiText.replacement;
                const element = createElement('div', { className: 'proxy-row' }, [address, lifetime, replace]);
                row = { element, address, lifetime, replace };
                this.proxyRows.push(row);
                this.proxyList.append(element);
            }
            const alive = proxy.diesAtSeconds > game.state.elapsedSeconds;
            row.element.hidden = false;
            row.element.classList.toggle('dead', !alive);
            setText(row.address, proxy.address);
            row.address.title = `${proxy.latencyMilliseconds} ms`;
            setText(row.lifetime, alive ? formatDuration(proxy.diesAtSeconds - game.state.elapsedSeconds) : labels.proxyDead);
            row.replace.disabled = alive;
        });
        for (let index = game.state.network.proxies.length; index < this.proxyRows.length; index++) this.proxyRows[index]!.element.hidden = true;
    }

    private addStat(parent: HTMLElement, label: string): HTMLElement {
        const value = createElement('span', { className: 'muted' });
        parent.append(createElement('div', { className: 'stat-row' }, [createElement('span', { text: label }), value]));
        return value;
    }
}

export function section(title: string): HTMLElement {
    return createElement('section', { className: 'panel' }, [createElement('h2', { text: title })]);
}
