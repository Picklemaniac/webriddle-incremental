import { fill, setupText, type UpgradeId } from '../content/act-one/text.ts';
import type { Upgrade } from '../content/act-one/upgrades.ts';
import { createElement, createProgressBar, createTitleBar } from './dom.ts';

type SetupKind = 'install' | 'download' | 'hardware' | 'connection';

const kinds: Readonly<Partial<Record<UpgradeId, SetupKind>>> = {
    wgetMirror: 'install', autoReplyMacros: 'install', dirb: 'install', gobuster: 'install', ffuf: 'install', proxyChecker: 'install', crackHtpasswd: 'install',
    english10k: 'download', dictWords: 'download', scrabble: 'download', rockyou: 'download', freeProxies: 'download',
    ram: 'hardware', newPc: 'hardware', secondPc: 'hardware', server: 'hardware',
    isdn: 'connection', adsl: 'connection', cable: 'connection', fiber: 'connection',
};

const downloadFiles: Readonly<Partial<Record<UpgradeId, string>>> = {
    english10k: 'english-10k.txt', dictWords: 'words', scrabble: 'scrabble.txt', rockyou: 'rockyou.txt', freeProxies: 'proxies.txt',
};

const durations: Readonly<Record<SetupKind, number>> = { install: 1.6, download: 2, hardware: 1.4, connection: 2.4 };

export class SetupWindows {
    private readonly element = createElement('div', { className: 'setup-windows', attributes: { role: 'status' } });

    constructor() {
        document.body.append(this.element);
    }

    show(upgrade: Upgrade): void {
        const id = upgrade.id as UpgradeId;
        const kind = kinds[id];
        if (kind === undefined) return;
        const seconds = durations[kind];
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
        }[kind].map((line) => createElement('p', { text: line }));
        const window = createElement('section', { className: 'setup-window' }, [
            createTitleBar([createElement('strong', { text: title })]),
            createElement('div', { className: 'setup-body' }, [...lines, createProgressBar(seconds)]),
        ]);
        this.element.append(window);
        if (kind === 'connection') {
            setupText.connectionSteps.forEach((step, index) => setTimeout(() => { lines[0]!.textContent = step; }, index * seconds * 1000 / setupText.connectionSteps.length));
        }
        setTimeout(() => window.remove(), seconds * 1000 + 900);
    }
}
