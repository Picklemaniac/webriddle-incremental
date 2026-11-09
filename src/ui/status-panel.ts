import type { Game } from '../core/game.ts';
import { activities, activityRate, assignedScripts, dirbustingScripts, incomePerSecond, isJobUnlocked, isResourceRevealed, scriptSlots, type ActivityId, type JobId } from '../content/act-one/economy.ts';
import { addressCount, effectiveRate, isBanned, isThrottled, liveProxies, networkCapacity, ownAddress, rentedBlocks, requestedRate, requestsPerAddress } from '../content/act-one/network.ts';
import { owns } from '../content/act-one/progress.ts';
import { activityText, connectionNames, fill, labels, toolNames, uiText } from '../content/act-one/text.ts';
import { connectionTiers, ownedTier, toolTiers } from '../content/act-one/upgrades.ts';
import { formatDuration, formatNumber } from '../format.ts';
import { formatRate, formatValue } from './amounts.ts';
import { createButton, createElement, section, setText } from './dom.ts';
import type { Panel } from './panel.ts';

interface ResourceRow { element: HTMLElement; value: HTMLElement; rate: HTMLElement; button: HTMLButtonElement; yield: HTMLElement; activity: ActivityId }
interface WorkerRow { element: HTMLElement; count: HTMLElement; minus: HTMLButtonElement; plus: HTMLButtonElement }
interface StatRow { readonly row: HTMLElement; readonly value: HTMLElement }
interface ProxyRow { element: HTMLElement; address: HTMLElement; lifetime: HTMLElement; replace: HTMLButtonElement }
interface AddressRow { element: HTMLElement; address: HTMLElement; detail: HTMLElement }

export class StatusPanel implements Panel {
    readonly element = createElement('div', { className: 'status-panels' });
    readonly networkElement = section(labels.networkPanel);
    readonly machineElement = createElement('details', { className: 'panel machine-details' }, [createElement('summary', { text: uiText.machineDetails })]);
    private readonly game: Game;
    private readonly you = section(labels.youPanel);
    private readonly resources = new Map<string, ResourceRow>();
    private readonly scripts = section(labels.scriptsPanel);
    private readonly workerRows = new Map<JobId, WorkerRow>();
    private readonly bustingCount = createElement('strong');
    private readonly connection = addStat(this.machineElement, labels.connection);
    private readonly tool = addStat(this.machineElement, labels.tool);
    private readonly slots = addStat(this.machineElement, uiText.slots);
    private readonly threads = addStat(this.machineElement, uiText.threads);
    private readonly efficiency = addStat(this.machineElement, uiText.efficiency);
    private readonly sending = addStat(this.networkElement, labels.sending);
    private readonly allowed = addStat(this.networkElement, labels.rateLimit);
    private readonly ips = addStat(this.networkElement, labels.ips);
    private readonly status = addStat(this.networkElement, labels.heat);
    private readonly heat = createElement('div', { className: 'heat-fill' });
    private readonly throttle = createButton('', () => this.game.dispatch({ type: 'setThrottle', enabled: !isThrottled(this.game) }), 'throttle-switch');
    private readonly throttleRow = createElement('div', { className: 'stat-row' }, [createElement('span', { text: labels.throttle }), this.throttle]);
    private readonly proxySummary = createElement('span', { className: 'proxy-summary' });
    private readonly proxySummaryRow = createElement('div', { className: 'stat-row' }, [createElement('span', { text: uiText.proxies }), this.proxySummary]);
    private readonly proxyList = createElement('div');
    private readonly proxyRows: ProxyRow[] = [];
    private readonly blockList = createElement('div');
    private readonly blockRows: AddressRow[] = [];
    private permanentAddresses: number | undefined;

    constructor(game: Game) {
        this.game = game;
        for (const activity of activities) {
            const value = createElement('strong');
            const rate = createElement('span', { className: 'income-rate' });
            const yieldLabel = createElement('span', { className: 'action-yield' });
            const button = createButton('', () => game.dispatch({ type: 'setActivity', activity: activity.id }), 'resource-action');
            button.replaceChildren(createElement('span', { text: activityText[activity.id] }), yieldLabel);
            const name = labels[activity.resource as 'insight' | 'money' | 'data'];
            const row = createElement('div', { className: 'resource-row' }, [createElement('span', { text: name }), value, rate, button]);
            this.you.append(row);
            this.resources.set(activity.resource, { element: row, value, rate, button, yield: yieldLabel, activity: activity.id });
        }
        this.scripts.append(createElement('div', { className: 'stat-row' }, [createElement('span', { text: labels.dirbusting }), this.bustingCount]));
        for (const [id, label] of [['riddles', labels.otherRiddles], ['ticketing', labels.ticketBot], ['scraping', labels.scraping]] as const) {
            const count = createElement('strong');
            const minus = createButton('−', () => game.dispatch({ type: 'assignJob', jobId: id, change: -1 }));
            const plus = createButton('+', () => game.dispatch({ type: 'assignJob', jobId: id, change: 1 }));
            minus.setAttribute('aria-label', fill(uiText.removeWorker, { job: label }));
            plus.setAttribute('aria-label', fill(uiText.addWorker, { job: label }));
            const row = createElement('div', { className: 'worker-row' }, [createElement('span', { text: label }), minus, count, plus]);
            this.scripts.append(row);
            this.workerRows.set(id, { element: row, count, minus, plus });
        }
        const ownRow = addressRow();
        setText(ownRow.address, ownAddress);
        setText(ownRow.detail, uiText.ownAddress);
        const addressList = createElement('details', { className: 'proxy-details' }, [
            createElement('summary', { text: uiText.individualProxies }),
            createElement('div', { className: 'proxy-list' }, [ownRow.element, this.proxyList, this.blockList]),
        ]);
        this.networkElement.append(createElement('div', { className: 'heat-track' }, [this.heat]), this.throttleRow, this.proxySummaryRow, addressList);
        this.element.append(this.you, this.scripts);
        game.subscribe((event) => { if (event.type === 'stateReplaced') this.permanentAddresses = undefined; });
    }

    render(): void {
        this.renderResources();
        this.renderScripts();
        this.renderMachine();
        this.renderNetwork();
        this.renderAddresses();
    }

    private renderResources(): void {
        const game = this.game;
        this.you.hidden = ![...this.resources.keys()].some((id) => isResourceRevealed(game, id));
        for (const [id, row] of this.resources) {
            row.element.hidden = !isResourceRevealed(game, id);
            setText(row.value, formatValue(id, game.state.resources[id] ?? 0));
            const income = incomePerSecond(game, id);
            setText(row.rate, income > 0 ? `+${formatRate(id, income)}` : '');
            row.button.setAttribute('aria-pressed', String(game.state.activity === row.activity));
            setText(row.yield, formatRate(id, activityRate(game, row.activity)));
        }
    }

    private renderScripts(): void {
        const game = this.game;
        this.scripts.hidden = !game.state.flags.scriptsRevealed;
        setText(this.bustingCount, String(dirbustingScripts(game)));
        for (const [jobId, row] of this.workerRows) {
            row.element.hidden = !isJobUnlocked(game, jobId);
            const count = assignedScripts(game, jobId);
            setText(row.count, String(count));
            row.minus.disabled = count === 0;
            row.plus.disabled = dirbustingScripts(game) === 0;
        }
    }

    private renderMachine(): void {
        const game = this.game;
        this.machineElement.hidden = !game.state.flags.machineRevealed;
        setText(this.connection.value, connectionNames[ownedTier(game.state, connectionTiers)]!);
        setText(this.tool.value, toolNames[ownedTier(game.state, toolTiers)]!);
        setText(this.slots.value, String(scriptSlots(game)));
        setText(this.threads.value, String(game.stat('threadsPerScript')));
        setText(this.efficiency.value, `${game.stat('searchEfficiency').toFixed(1)}×`);
    }

    private renderNetwork(): void {
        const game = this.game;
        this.networkElement.hidden = !game.state.flags.networkRevealed;
        const sent = effectiveRate(game);
        const capacity = networkCapacity(game);
        const requested = requestedRate(game);
        const addresses = addressCount(game);
        setText(this.sending.value, `${formatNumber(sent)}/s`);
        setText(this.allowed.value, `${formatNumber(capacity)}/s`);
        setText(this.ips.value, String(addresses));
        setText(this.status.value, isBanned(game) ? fill(labels.banned, { time: formatDuration(game.state.network.bannedUntil - game.state.elapsedSeconds) }) : `${Math.round(game.state.network.heat)}%`);
        this.sending.value.classList.toggle('over-limit', sent > capacity);
        setTitle(this.sending, requested > sent ? fill(uiText.requestedRate, { rate: formatNumber(requested) }) : '');
        setTitle(this.allowed, fill(uiText.limitBreakdown, { ips: formatNumber(addresses), perAddress: requestsPerAddress }));
        setTitle(this.ips, fill(uiText.ipBreakdown, { proxies: liveProxies(game), rented: formatNumber(game.stat('extraAddresses')) }));
        const permanentAddresses = game.stat('extraAddresses') + game.stat('proxySlots');
        if (this.permanentAddresses !== undefined && permanentAddresses > this.permanentAddresses) for (const stat of [this.ips, this.allowed]) flash(stat.value);
        this.permanentAddresses = permanentAddresses;
        this.heat.style.width = `${game.state.network.heat}%`;
        this.throttleRow.hidden = !owns(game.state, 'throttle');
        setText(this.throttle, isThrottled(game) ? uiText.on : uiText.off);
        this.throttle.setAttribute('aria-pressed', String(isThrottled(game)));
    }

    private renderAddresses(): void {
        const game = this.game;
        const { proxies } = game.state.network;
        const aliveCount = liveProxies(game);
        const deadCount = proxies.length - aliveCount;
        this.proxySummaryRow.hidden = proxies.length === 0;
        this.proxySummary.classList.toggle('has-dead-proxies', deadCount > 0);
        setText(this.proxySummary, fill(uiText.proxyCount, { working: aliveCount, dead: deadCount }));
        syncRows(this.proxyRows, this.proxyList, proxies, (index) => {
            const address = createElement('span', { className: 'proxy-address' });
            const lifetime = createElement('span', { className: 'muted' });
            const replace = createButton(labels.replace, () => game.dispatch({ type: 'replaceProxy', proxyIndex: index }));
            replace.title = uiText.replacement;
            return { element: createElement('div', { className: 'proxy-row' }, [address, lifetime, replace]), address, lifetime, replace };
        }, (row, proxy) => {
            const alive = proxy.diesAtSeconds > game.state.elapsedSeconds;
            row.element.classList.toggle('dead', !alive);
            setText(row.address, proxy.address);
            row.address.title = `${proxy.latencyMilliseconds} ms`;
            setText(row.lifetime, alive ? formatDuration(proxy.diesAtSeconds - game.state.elapsedSeconds) : labels.proxyDead);
            row.replace.disabled = alive;
        });
        syncRows(this.blockRows, this.blockList, rentedBlocks(game), addressRow, (row, block) => {
            setText(row.address, block.range);
            setText(row.detail, fill(uiText.blockSize, { count: formatNumber(block.addresses) }));
        });
    }
}

function addStat(parent: HTMLElement, label: string): StatRow {
    const value = createElement('span', { className: 'muted' });
    const row = createElement('div', { className: 'stat-row' }, [createElement('span', { text: label }), value]);
    parent.append(row);
    return { row, value };
}

function setTitle(stat: StatRow, title: string): void {
    if (stat.row.title !== title) stat.row.title = title;
}

function syncRows<Row extends { element: HTMLElement }, Item>(rows: Row[], list: HTMLElement, items: readonly Item[], create: (index: number) => Row, update: (row: Row, item: Item) => void): void {
    items.forEach((item, index) => {
        let row = rows[index];
        if (row === undefined) {
            row = create(index);
            rows.push(row);
            list.append(row.element);
        }
        row.element.hidden = false;
        update(row, item);
    });
    for (const row of rows.slice(items.length)) row.element.hidden = true;
}

function addressRow(): AddressRow {
    const address = createElement('span', { className: 'proxy-address' });
    const detail = createElement('span', { className: 'muted' });
    return { element: createElement('div', { className: 'proxy-row' }, [address, detail]), address, detail };
}

function flash(element: HTMLElement): void {
    element.classList.remove('increased');
    void element.offsetWidth;
    element.classList.add('increased');
}
