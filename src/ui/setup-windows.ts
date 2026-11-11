import type { Game } from '../core/game.ts';
import { findings } from '../content/act-one/findings.ts';
import { riddleOrigin } from '../content/act-one/riddle.ts';
import { fill, setupText, type UpgradeId } from '../content/act-one/text.ts';
import { upgrades, type Upgrade } from '../content/act-one/upgrades.ts';
import { createElement, createProgressBar, createTitleBar } from './dom.ts';

type SetupKind = 'install' | 'download' | 'hardware' | 'connection';

const kinds: Readonly<Partial<Record<UpgradeId, SetupKind>>> = {
    wgetMirror: 'install', autoReplyMacros: 'install', dirb: 'install', gobuster: 'install', ffuf: 'install', proxyChecker: 'install', crackHtpasswd: 'install',
    english10k: 'download', dictWords: 'download', scrabble: 'download', rockyou: 'download', freeProxies: 'download',
    customFuzzer: 'install', namesList: 'download', moreLeaks: 'download', proxyUptime: 'download', usernames: 'download', passwords: 'download', latinList: 'download',
    ram: 'hardware', newPc: 'hardware', secondPc: 'hardware', server: 'hardware', dedicatedServer: 'hardware', serverRack: 'hardware',
    isdn: 'connection', adsl: 'connection', cable: 'connection', fiber: 'connection',
};

const downloadFiles: Readonly<Partial<Record<UpgradeId, string>>> = {
    english10k: 'english-10k.txt', dictWords: 'words', scrabble: 'scrabble.txt', rockyou: 'rockyou.txt', freeProxies: 'proxies.txt', proxyUptime: 'proxies-checked.txt', namesList: 'names.txt', moreLeaks: 'leaks.txt',
    usernames: 'usernames.txt', passwords: 'passwords.txt', latinList: 'latin.txt',
};

const durations: Readonly<Record<SetupKind, number>> = { install: 1.6, download: 2, hardware: 1.4, connection: 2.4 };
const maximumWindows = 3;

export function setupSeconds(upgradeId: string): number {
    const kind = kinds[upgradeId as UpgradeId];
    return kind === undefined ? 0 : durations[kind];
}

export class SetupWindows {
    private readonly element = createElement('div', { className: 'setup-windows', attributes: { role: 'status' } });

    constructor(game: Game) {
        document.body.append(this.element);
        game.subscribe((event) => {
            if (game.isCatchingUp) return;
            if (event.type === 'actionApplied' && event.action.type === 'purchase') {
                const id = event.action.purchasableId;
                const upgrade = upgrades.find((item) => item.id === id);
                if (upgrade) this.showPurchase(upgrade);
            } else if (event.type === 'findingDiscovered') {
                const finding = findings.find((item) => item.id === event.findingId);
                if (finding) this.open(setupText.downloadTitle, [fill(setupText.downloading, { file: finding.path, host: new URL(riddleOrigin).host })], durations.download);
            }
        });
    }

    private showPurchase(upgrade: Upgrade): void {
        const id = upgrade.id as UpgradeId;
        const kind = kinds[id];
        if (kind === undefined) return;
        const name = upgrade.name;
        const title = {
            install: fill(setupText.installTitle, { name }),
            download: setupText.downloadTitle,
            hardware: setupText.hardwareTitle,
            connection: fill(setupText.connectionTitle, { name }),
        }[kind];
        const lines = {
            install: [fill(setupText.installing, { name })],
            download: [fill(setupText.downloading, { file: downloadFiles[id] ?? name, host: setupText.downloadHost })],
            hardware: [name, setupText.hardwareStatus],
            connection: [setupText.connectionSteps[0]],
        }[kind];
        const status = this.open(title, lines, durations[kind]);
        if (kind === 'connection') {
            setupText.connectionSteps.forEach((step, index) => setTimeout(() => { status.textContent = step; }, index * durations.connection * 1000 / setupText.connectionSteps.length));
        }
    }

    private open(title: string, lines: readonly string[], seconds: number): HTMLElement {
        const paragraphs = lines.map((line) => createElement('p', { text: line }));
        const window = createElement('section', { className: 'setup-window' }, [
            createTitleBar([createElement('strong', { text: title })]),
            createElement('div', { className: 'setup-body' }, [...paragraphs, createProgressBar(seconds)]),
        ]);
        this.element.append(window);
        while (this.element.childElementCount > maximumWindows) this.element.firstElementChild?.remove();
        setTimeout(() => window.remove(), seconds * 1000 + 900);
        return paragraphs[0]!;
    }
}
