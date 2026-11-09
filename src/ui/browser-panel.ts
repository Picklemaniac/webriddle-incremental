import type { Game } from '../core/game.ts';
import type { Page } from '../core/content.ts';
import { createInitialState } from '../core/state.ts';
import { canonicalUrl } from '../content/act-one/pages.ts';
import { urlOfLevel } from '../content/act-one/levels.ts';
import { browserName, dialogText, fileTypes, fill, menuText, uiText } from '../content/act-one/text.ts';
import { decodeExport, encodeExport, parseSave, serializeSave } from '../persistence/save.ts';
import { createButton, createElement, createTitleBar, setText } from './dom.ts';
import { GameDialog } from './dialog.ts';
import type { Panel } from './panel.ts';

const viewSourcePrefix = 'view-source:';

interface MenuCommand {
    readonly label: string;
    readonly action: (() => void) | undefined;
}

type MenuItem = MenuCommand | null;

export class BrowserPanel implements Panel {
    readonly element: HTMLElement;
    private readonly game: Game;
    private readonly address = createElement('input', { className: 'browser-address', attributes: { 'aria-label': menuText.address, spellcheck: 'false', autocomplete: 'off' } });
    private readonly viewport = createElement('iframe', { className: 'browser-viewport', attributes: { sandbox: 'allow-same-origin allow-downloads', title: uiText.pageTitle } });
    private readonly title = createElement('strong');
    private readonly status = createElement('span', { className: 'status-cell' });
    private readonly throbber = createElement('img', { className: 'throbber', attributes: { src: 'branding/enigma-web.png', alt: '', 'aria-hidden': 'true' } });
    private readonly dialog = new GameDialog();
    private readonly sourceDocument = createElement('pre', { className: 'source-document', attributes: { tabindex: '0', 'aria-label': uiText.pageSource } });
    private readonly sourcePane = createElement('section', { className: 'source-pane', attributes: { 'aria-label': uiText.pageSource, id: 'page-source' } });
    private readonly content = createElement('div', { className: 'browser-content' });
    private readonly sourceButton: HTMLButtonElement;
    private addressEdited = false;
    private sourceOpen = false;
    private pinnedUrl: string | null = null;
    private sourceText = '';
    private readonly back: HTMLButtonElement;
    private readonly forward: HTMLButtonElement;
    private readonly stop: HTMLButtonElement;
    private readonly follow: HTMLButtonElement;
    private history: string[];
    private historyIndex = 0;
    private lastUrl = '';
    private renderedHtml = '';
    private page: Page = { html: '', statusCode: 200 };
    private pendingNavigation: ReturnType<typeof setTimeout> | undefined;
    private followOnArrival = false;
    private loginAddress = '';
    private hoveredLink: string | null = null;
    private readonly contextMenu = createElement('div', { className: 'menu-popup context-menu', attributes: { role: 'menu' } });

    constructor(game: Game) {
        this.game = game;
        this.history = [game.state.browserUrl];
        this.back = this.tool('◀', menuText.back, () => this.moveHistory(-1));
        this.forward = this.tool('▶', menuText.forward, () => this.moveHistory(1));
        this.stop = this.tool('×', menuText.stop, () => this.stopLoading());
        this.follow = createButton(uiText.follow, () => {
            this.sourceOpen = false;
            this.updateSourceVisibility();
            this.navigate(urlOfLevel(game.state.currentLevel));
            this.followOnArrival = true;
        });
        this.follow.className = 'follow-current';
        this.sourceButton = this.tool('≡', uiText.source, () => this.showSource());
        this.sourceButton.setAttribute('aria-controls', 'page-source');
        const sourceClose = createButton('×', () => this.closeSource());
        sourceClose.setAttribute('aria-label', uiText.closeSource);
        this.sourcePane.append(createElement('div', { className: 'source-heading' }, [createElement('strong', { text: uiText.pageSource }), createElement('span', { text: uiText.sourceShortcut }), sourceClose]), this.sourceDocument);
        this.content.append(this.viewport, this.sourcePane);
        this.updateSourceVisibility();
        const titleBar = createTitleBar([createElement('img', { className: 'browser-icon', attributes: { src: 'branding/enigma-web.png', alt: '' } }), this.title]);
        const toolbar = createElement('div', { className: 'browser-toolbar' }, [this.back, this.forward, this.stop,
            this.tool('↻', menuText.refresh, () => this.refresh()),
            this.tool('⌂', menuText.home, () => this.goHome()),
            createElement('span', { className: 'toolbar-divider' }),
            this.sourceButton,
            createElement('span', { className: 'toolbar-divider' }),
            this.tool('★', menuText.favorites, () => this.showFavorites(), true),
            this.tool('◷', uiText.history, () => this.showHistory(), true),
            this.throbber]);
        this.contextMenu.hidden = true;
        this.sourceDocument.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            this.openContextMenu(this.sourceMenu(event.target as Element), event.clientX, event.clientY);
        });
        const go = createElement('button', { text: menuText.go, attributes: { type: 'submit' } });
        const addressForm = createElement('form', { className: 'address-bar' }, [createElement('label', { text: menuText.address, attributes: { for: 'riddle-address' } }), this.address, go]);
        this.address.id = 'riddle-address';
        this.address.addEventListener('focus', () => this.pinPage());
        this.address.addEventListener('blur', () => { if (!this.addressEdited && !this.pendingNavigation && !this.sourceOpen) this.pinnedUrl = null; });
        this.address.addEventListener('input', () => { this.addressEdited = true; });
        addressForm.addEventListener('submit', (event) => { event.preventDefault(); this.navigate(this.address.value); this.address.blur(); });
        this.viewport.addEventListener('load', () => this.bindPage());
        this.element = createElement('section', { className: 'browser-window', attributes: { 'aria-label': browserName } }, [titleBar, this.createMenus(), toolbar, addressForm, this.content,
            createElement('footer', { className: 'browser-status' }, [this.status, this.follow, createElement('span', { className: 'status-zone', text: `◉ ${menuText.zone}` })]), this.contextMenu]);
        document.addEventListener('keydown', (event) => this.handleShortcut(event));
        document.addEventListener('click', (event) => { if (!this.contextMenu.contains(event.target as Node)) this.hideContextMenu(); });
        game.subscribe((event) => {
            if (event.type === 'stateReplaced') {
                this.stopLoading();
                this.history = [game.state.browserUrl];
                this.historyIndex = 0;
                this.lastUrl = '';
                this.loginAddress = '';
                this.pinnedUrl = null;
                this.sourceOpen = false;
                this.updateSourceVisibility();
                this.addressEdited = false;
                this.address.value = game.state.browserUrl;
                if (this.dialog.element.querySelector('input[type="password"]')) this.dialog.close();
            }
        });
    }

    render(): void {
        const browserUrl = this.pinnedUrl ?? this.game.state.browserUrl;
        if (browserUrl !== this.lastUrl) {
            if (this.lastUrl && this.history[this.historyIndex] !== browserUrl) this.recordHistory(browserUrl);
            this.lastUrl = browserUrl;
        }
        if (!this.addressEdited && document.activeElement !== this.address && !this.pendingNavigation) this.address.value = this.shownAddress(browserUrl);
        this.page = this.game.content.resolvePage(browserUrl, this.game.state);
        if (this.sourceOpen) this.renderSource();
        if (this.page.html !== this.renderedHtml) {
            this.renderedHtml = this.page.html;
            this.viewport.srcdoc = this.page.html;
            const title = `${this.page.title || browserUrl} - ${browserName}`;
            setText(this.title, title);
            document.title = title;
        }
        if (!this.pendingNavigation) {
            setText(this.status, this.hoveredLink !== null ? `${menuText.statusShortcut} ${this.hoveredLink}`
                : `${menuText.statusDone}${this.page.statusCode === 200 ? '' : ` (${this.page.statusCode || 'DNS'})`}`);
        }
        this.back.disabled = this.historyIndex <= 0;
        this.forward.disabled = this.historyIndex >= this.history.length - 1;
        this.stop.disabled = !this.pendingNavigation;
        this.follow.hidden = canonicalUrl(browserUrl) === urlOfLevel(this.game.state.currentLevel) || (this.game.state.currentLevel === 1 && this.game.state.flags.entered !== true);
        if (this.dialog.element.open && this.dialog.element.querySelector('input[type="password"]') &&
            (this.loginAddress !== browserUrl || !this.page.loginRealm)) this.dialog.close();
        if (this.page.loginRealm && this.loginAddress !== browserUrl) {
            this.loginAddress = browserUrl;
            this.showLogin(browserUrl, this.page.loginRealm);
        }
    }

    navigate(rawAddress: string, record = true, historyIndex?: number): void {
        let address = rawAddress.trim();
        if (address.toLowerCase().startsWith(viewSourcePrefix)) {
            address = address.slice(viewSourcePrefix.length).trim();
            this.sourceOpen = true;
            this.updateSourceVisibility();
        }
        try {
            if (/^[\w-]+\.[\w-]+\//.test(address) && !address.includes('://')) address = `${new URL(this.game.content.startUrl).protocol}//${address}`;
            address = new URL(address, this.viewedUrl).href;
        } catch { /* Invalid addresses are rendered as a failed navigation. */ }
        this.pinPage();
        this.stopLoading();
        this.addressEdited = false;
        this.address.value = this.shownAddress(address);
        this.throbber.classList.add('loading');
        setText(this.status, `${menuText.statusOpening}…`);
        const delay = Math.max(100, 550 / Math.sqrt(Math.max(1, this.game.stat('requestsPerThread') / 2)));
        this.pendingNavigation = setTimeout(() => {
            this.pendingNavigation = undefined;
            this.stop.disabled = true;
            this.throbber.classList.remove('loading');
            this.loginAddress = '';
            this.game.dispatch({ type: 'navigate', url: this.followOnArrival ? urlOfLevel(this.game.state.currentLevel) : address });
            this.followOnArrival = false;
            this.pinnedUrl = this.sourceOpen || this.addressEdited || document.activeElement === this.address ? this.game.state.browserUrl : null;
            if (historyIndex !== undefined) this.historyIndex = historyIndex;
            if (record) this.recordHistory(this.game.state.browserUrl);
            this.lastUrl = this.game.state.browserUrl;
            this.render();
        }, delay);
        this.stop.disabled = false;
    }

    private tool(icon: string, label: string, click: () => void, secondary = false): HTMLButtonElement {
        const button = createButton('', click);
        button.className = 'tool-button';
        if ([menuText.forward, menuText.stop, menuText.refresh, menuText.home].includes(label as typeof menuText.forward)) button.classList.add('navigation-icon');
        button.classList.toggle('secondary', secondary);
        button.title = label;
        button.setAttribute('aria-label', label);
        button.append(createElement('span', { className: 'tool-icon', text: icon }), createElement('span', { text: label }));
        return button;
    }

    private pageMenu(target: Element, doc: Document): MenuItem[] {
        const copy = this.copyCommand(doc.getSelection()?.toString() ?? '');
        const anchor = target.closest('a[href]');
        const link = anchor === null ? null : { url: this.absolute(anchor.getAttribute('href')!), newWindow: anchor.getAttribute('target') === '_blank' };
        const pictureAddress = target.closest('img[data-address]')?.getAttribute('data-address');
        if (pictureAddress) {
            const picture = this.absolute(pictureAddress);
            return [
                ...(link === null ? [] : [{ label: menuText.openLink, action: () => this.openLink(link.url, link.newWindow) }]),
                { label: menuText.showPicture, action: () => this.navigate(picture) },
                null,
                { label: menuText.copyShortcut, action: () => this.copyText(link?.url ?? picture) },
                null,
                { label: menuText.properties, action: () => this.showProperties(picture) },
            ];
        }
        if (link !== null) {
            return [
                { label: menuText.open, action: () => this.openLink(link.url, link.newWindow) },
                null,
                copy,
                { label: menuText.copyShortcut, action: () => this.copyText(link.url) },
                null,
                { label: menuText.addFavorite, action: () => this.addFavorite(link.url) },
                { label: menuText.properties, action: () => this.showProperties(link.url) },
            ];
        }
        return [
            { label: menuText.back, action: this.historyIndex > 0 ? () => this.moveHistory(-1) : undefined },
            { label: menuText.forward, action: this.historyIndex < this.history.length - 1 ? () => this.moveHistory(1) : undefined },
            null,
            copy,
            { label: menuText.selectAll, action: () => this.selectAll() },
            null,
            { label: uiText.source, action: () => this.showSource() },
            { label: menuText.refresh, action: () => this.refresh() },
            null,
            { label: menuText.addFavorite, action: () => this.addFavorite() },
            { label: menuText.properties, action: () => this.showProperties(this.viewedUrl, this.page.title) },
        ];
    }

    private sourceMenu(target: Element): MenuItem[] {
        const href = target.closest('a[href]')?.getAttribute('href');
        const link = href ? this.absolute(href) : null;
        return [
            ...(link === null ? [] : [{ label: menuText.open, action: () => this.navigate(link) }, { label: menuText.copyShortcut, action: () => this.copyText(link) }, null]),
            this.copyCommand(document.getSelection()?.toString() ?? ''),
            { label: menuText.selectAll, action: () => this.selectAll() },
            null,
            { label: menuText.closeSource, action: () => this.closeSource() },
        ];
    }

    private copyCommand(text: string): MenuCommand {
        return { label: menuText.copy, action: text === '' ? undefined : () => this.copyText(text) };
    }

    private openContextMenu(items: readonly MenuItem[], x: number, y: number): void {
        this.contextMenu.replaceChildren(...this.menuElements(items, () => this.hideContextMenu()));
        this.contextMenu.hidden = false;
        const bounds = this.element.getBoundingClientRect();
        this.contextMenu.style.left = `${Math.max(0, Math.min(x - bounds.left, bounds.width - this.contextMenu.offsetWidth - 4))}px`;
        this.contextMenu.style.top = `${Math.max(0, Math.min(y - bounds.top, bounds.height - this.contextMenu.offsetHeight - 4))}px`;
    }

    private menuElements(items: readonly MenuItem[], close: () => void): HTMLElement[] {
        return items.map((item) => {
            if (item === null) return createElement('div', { className: 'menu-separator' });
            const button = createButton(item.label, () => { close(); item.action?.(); });
            button.disabled = item.action === undefined;
            return button;
        });
    }

    private hideContextMenu(): void { this.contextMenu.hidden = true; }

    private handleShortcut(event: KeyboardEvent): void {
        if (event.key === 'Escape') {
            this.hideContextMenu();
            if (this.pendingNavigation) this.stopLoading();
            return;
        }
        if (document.querySelector('dialog[open]') !== null) return;
        const command = this.shortcut(event);
        if (command === undefined) return;
        event.preventDefault();
        command();
    }

    private shortcut(event: KeyboardEvent): (() => void) | undefined {
        const key = event.key.toLowerCase();
        const control = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
        const alt = event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
        const plain = !event.ctrlKey && !event.metaKey && !event.altKey;
        const typing = (event.target as Element).matches?.('input, textarea') === true;
        if (alt && key === 'arrowleft') return () => this.moveHistory(-1);
        if (alt && key === 'arrowright') return () => this.moveHistory(1);
        if (alt && key === 'home') return () => this.goHome();
        if ((alt && key === 'd') || (control && key === 'l') || (plain && !event.shiftKey && key === 'f6')) return () => this.focusAddress();
        if (plain && key === 'backspace' && !typing && this.element.contains(document.activeElement)) return () => this.moveHistory(event.shiftKey ? 1 : -1);
        if ((plain && !event.shiftKey && key === 'f5') || (control && key === 'r')) return () => this.refresh();
        if (!control) return undefined;
        if (key === 'u') return () => this.showSource();
        if (key === 'a' && !typing) return () => this.selectAll();
        if (key === 'd') return () => this.addFavorite();
        if (key === 'i') return () => this.showFavorites();
        if (key === 'h') return () => this.showHistory();
        return undefined;
    }

    private addFavorite(url = this.viewedUrl): void {
        this.game.dispatch({ type: 'addFavorite', url });
        this.showFavorites();
    }

    private createMenus(): HTMLElement {
        const definitions: readonly (readonly [string, () => readonly MenuItem[]])[] = [
            [menuText.file, () => [{ label: menuText.importExport, action: () => this.showSave() }]],
            [menuText.edit, () => [this.copyCommand(this.selectedText()), { label: menuText.selectAll, action: () => this.selectAll() }]],
            [menuText.view, () => [{ label: menuText.source, action: () => this.showSource() }, { label: uiText.history, action: () => this.showHistory() }, { label: menuText.refresh, action: () => this.refresh() }]],
            [menuText.favorites, () => [
                { label: menuText.addFavorite, action: () => this.addFavorite() },
                { label: menuText.organizeFavorites, action: () => this.showFavorites() },
                ...(this.game.state.favorites.length === 0 ? [] : [null, ...this.game.state.favorites.map((url) => ({ label: url.replace(/^https?:\/\//, ''), action: () => this.navigate(url) }))]),
            ]],
            [menuText.tools, () => [{ label: menuText.internetOptions, action: () => this.showOptions() }]],
            [menuText.help, () => [{ label: menuText.about, action: () => this.showAbout() }]],
        ];
        const bar = createElement('nav', { className: 'menu-bar' });
        for (const [label, commands] of definitions) {
            const details = createElement('details', { className: 'browser-menu' });
            const popup = createElement('div', { className: 'menu-popup' });
            const populate = (): void => popup.replaceChildren(...this.menuElements(commands(), () => { details.open = false; }));
            populate();
            details.append(createElement('summary', { text: label }), popup);
            details.addEventListener('toggle', () => {
                if (!details.open) return;
                populate();
                for (const other of bar.querySelectorAll('details')) if (other !== details) other.open = false;
            });
            bar.append(details);
        }
        document.addEventListener('click', (event) => { if (!bar.contains(event.target as Node)) for (const menu of bar.querySelectorAll('details')) menu.open = false; });
        return bar;
    }

    private stopLoading(): void {
        if (this.pendingNavigation) clearTimeout(this.pendingNavigation);
        this.pendingNavigation = undefined;
        this.followOnArrival = false;
        this.stop.disabled = true;
        this.throbber.classList.remove('loading');
        setText(this.status, uiText.stopped);
    }

    private recordHistory(url: string): void {
        if (this.history[this.historyIndex] === url) return;
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(url);
        if (this.history.length > 200) this.history.shift();
        this.historyIndex = this.history.length - 1;
    }

    private moveHistory(direction: number): void {
        const index = this.historyIndex + direction;
        const url = this.history[index];
        if (url === undefined) return;
        this.navigate(url, false, index);
    }

    private showSource(): void {
        if (this.sourceOpen) { this.closeSource(); return; }
        this.pinPage();
        this.sourceOpen = true;
        this.updateSourceVisibility();
        this.render();
        this.sourceDocument.focus({ preventScroll: true });
    }

    private closeSource(): void {
        this.sourceOpen = false;
        if (!this.addressEdited && document.activeElement !== this.address) this.pinnedUrl = null;
        this.updateSourceVisibility();
        this.render();
        if (document.activeElement !== this.address) this.viewport.focus({ preventScroll: true });
    }

    private get viewedUrl(): string { return this.pinnedUrl ?? (this.lastUrl || this.game.state.browserUrl); }

    private shownAddress(url: string): string { return this.sourceOpen ? `${viewSourcePrefix}${url}` : url; }

    private pinPage(): void { this.pinnedUrl ??= this.lastUrl || this.game.state.browserUrl; }

    private updateSourceVisibility(): void {
        this.viewport.hidden = this.sourceOpen;
        this.sourcePane.hidden = !this.sourceOpen;
        this.content.classList.toggle('source-open', this.sourceOpen);
        this.sourceButton.setAttribute('aria-expanded', String(this.sourceOpen));
    }

    private renderSource(): void {
        const source = this.page.source ?? this.page.html;
        if (source === this.sourceText) return;
        this.sourceText = source;
        this.sourceDocument.replaceChildren();
        for (const token of source.split(/(<!--[\s\S]*?-->|<[^>]+>)/g)) {
            const span = createElement('span', { className: token.startsWith('<!--') ? 'source-comment' : token.startsWith('<') ? 'source-tag' : '', text: token });
            if (!token.startsWith('<!--')) {
                const link = /(?:src|href)="([^"]+)"/.exec(token);
                if (link?.[1]) {
                    const target = link[1];
                    const newWindow = token.includes('target="_blank"');
                    const offset = token.indexOf(target, link.index);
                    const anchor = createElement('a', { text: target, attributes: { href: target } });
                    anchor.addEventListener('click', (event) => { event.preventDefault(); this.openLink(target, newWindow); });
                    span.replaceChildren(token.slice(0, offset), anchor, token.slice(offset + target.length));
                }
            }
            this.sourceDocument.append(span);
        }
    }

    private selectAll(): void {
        this.pinPage();
        const doc = this.sourceOpen ? document : this.viewport.contentDocument;
        const target = this.sourceOpen ? this.sourceDocument : doc?.body;
        if (!doc || !target) return;
        const range = doc.createRange();
        range.selectNodeContents(target);
        const selection = doc.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        (this.sourceOpen ? this.sourceDocument : this.viewport).focus({ preventScroll: true });
    }

    private showFavorites(): void {
        const favorites = this.game.state.favorites;
        this.dialog.show(menuText.favorites, favorites.length ? favorites.map((url) => {
            const link = this.dialogLink(url);
            const remove = createButton(menuText.deleteFavorite, () => {
                this.game.dispatch({ type: 'removeFavorite', url });
                this.showFavorites();
            });
            remove.setAttribute('aria-label', fill(uiText.deleteFavorite, { address: url }));
            return createElement('div', { className: 'favorite-row' }, [link, remove]);
        }) : [createElement('p', { text: uiText.none })]);
    }

    private showHistory(): void {
        const current = this.game.state.currentLevel;
        const levelInput = createElement('input', { attributes: { id: 'history-level', type: 'number', min: '1', max: String(current), autocomplete: 'off' } });
        levelInput.value = String(current);
        const goToLevel = (): void => {
            const level = Math.round(Number(levelInput.value));
            if (!(level >= 1 && level <= current)) return;
            this.dialog.close();
            this.navigate(urlOfLevel(level));
        };
        levelInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') goToLevel(); });
        const recent = [...this.game.state.history].reverse();
        this.dialog.show(uiText.history, [
            createElement('h3', { text: uiText.historyLevels }),
            createElement('div', { className: 'history-go' }, [createElement('label', { text: uiText.historyGoTo, attributes: { for: 'history-level' } }), levelInput, createButton(menuText.go, goToLevel)]),
            createElement('div', { className: 'history-list' }, Array.from({ length: current }, (_, index) => this.historyEntry(urlOfLevel(current - index), current - index))),
            createElement('h3', { text: uiText.historyRecent }),
            recent.length === 0 ? createElement('p', { text: uiText.none }) : createElement('div', { className: 'history-list' }, recent.map((url) => this.historyEntry(url))),
        ]);
        levelInput.focus();
        levelInput.select();
    }

    private historyEntry(url: string, level?: number): HTMLButtonElement {
        const button = createButton('', () => { this.dialog.close(); this.navigate(url); });
        button.className = 'history-entry';
        button.title = url;
        const address = level === undefined ? url.replace(/^https?:\/\//, '') : new URL(url).pathname;
        button.append(...(level === undefined ? [] : [createElement('span', { className: 'history-level', text: fill(uiText.levelNumber, { level }) })]),
            createElement('span', { className: 'history-address', text: address }));
        return button;
    }

    private dialogLink(url: string): HTMLButtonElement {
        const button = createButton(url, () => { this.dialog.close(); this.navigate(url); });
        button.className = 'dialog-link';
        return button;
    }

    private showOptions(): void {
        const home = createElement('input', { attributes: { spellcheck: 'false', autocomplete: 'off' } });
        home.value = this.game.state.homePage;
        const clear = createButton(dialogText.clearHistory, () => {
            this.game.dispatch({ type: 'clearHistory' });
            clear.disabled = true;
        });
        clear.disabled = this.game.state.history.length === 0;
        const group = (heading: string, body: string, ...controls: HTMLElement[]): HTMLElement =>
            createElement('fieldset', { className: 'options-group' }, [createElement('legend', { text: heading }), createElement('p', { text: body }), ...controls]);
        const buttons = (...children: HTMLElement[]): HTMLElement => createElement('div', { className: 'options-buttons' }, children);
        this.dialog.show(dialogText.optionsTitle, [
            group(dialogText.homePageHeading, dialogText.homePageBody, createElement('label', { className: 'login-field' }, [menuText.address, home]),
                buttons(createButton(dialogText.useCurrent, () => { home.value = this.viewedUrl; }), createButton(dialogText.useDefault, () => { home.value = this.game.content.homeUrl; }))),
            group(dialogText.historyHeading, dialogText.historyBody, buttons(clear)),
            group(dialogText.progressHeading, dialogText.optionsSaving, buttons(createButton(dialogText.startOver, () => this.startOver()))),
        ], [createButton(dialogText.ok, () => {
            this.game.dispatch({ type: 'setHomePage', url: home.value });
            this.dialog.close();
        })], false, dialogText.cancel);
    }

    private startOver(): void {
        if (!confirm(dialogText.startOverConfirm)) return;
        this.dialog.close();
        this.game.replaceState(createInitialState(this.game.content, Math.floor(Math.random() * 2 ** 32)));
    }

    private showProperties(url: string, title?: string): void {
        const rows: (readonly [string, string])[] = [...(title ? [[dialogText.propertiesName, title] as const] : []), [dialogText.propertiesType, fileType(url)], [dialogText.propertiesAddress, url]];
        this.dialog.show(dialogText.propertiesTitle, [createElement('dl', { className: 'properties' }, rows.flatMap(([label, value]) => [createElement('dt', { text: label }), createElement('dd', { text: value })]))]);
    }

    private showAbout(): void {
        this.dialog.show(dialogText.aboutTitle, [createElement('pre', { text: dialogText.aboutBody.join('\n') })]);
    }

    private copyText(text: string): void {
        void navigator.clipboard?.writeText(text).catch(() => undefined);
    }

    private selectedText(): string {
        const doc = this.sourceOpen ? document : this.viewport.contentDocument;
        return doc?.getSelection()?.toString() ?? '';
    }

    private absolute(address: string): string {
        try { return new URL(address, this.viewedUrl).href; } catch { return address; }
    }

    private refresh(): void { this.navigate(this.viewedUrl, false); }

    private goHome(): void { this.navigate(this.game.state.homePage); }

    private focusAddress(): void {
        this.address.focus();
        this.address.select();
    }

    private showSave(): void {
        const input = createElement('textarea', { className: 'save-text', attributes: { rows: '7', 'aria-label': uiText.saveString, spellcheck: 'false' } });
        const message = createElement('p', { className: 'dialog-message', attributes: { role: 'status' } });
        const exportButton = createButton(dialogText.exportButton, () => {
            input.value = encodeExport(serializeSave(this.game.state, Date.now()));
            input.select();
            message.textContent = uiText.copied;
        });
        const importButton = createButton(dialogText.importButton, () => {
            try {
                const save = parseSave(decodeExport(input.value), createInitialState(this.game.content, this.game.state.randomState));
                if (!confirm(dialogText.importConfirm)) return;
                this.game.replaceState(save.state);
                message.textContent = uiText.imported;
            } catch (error) { message.textContent = error instanceof Error ? error.message : String(error); }
        });
        this.dialog.show(dialogText.exportTitle, [createElement('p', { text: dialogText.exportBody }), input, message], [exportButton, importButton], true);
    }

    private showLogin(url: string, realm: string): void {
        this.pinPage();
        const username = createElement('input', { attributes: { autocomplete: 'off', 'aria-label': dialogText.loginUser } });
        const password = createElement('input', { attributes: { type: 'password', autocomplete: 'off', 'aria-label': dialogText.loginPassword } });
        const message = createElement('p', { className: 'dialog-message', attributes: { role: 'status' } });
        const submit = (): void => {
            const accepted = this.game.dispatch({ type: 'submitCredentials', url, username: username.value, password: password.value });
            if (accepted) { this.dialog.close(); this.render(); } else message.textContent = uiText.wrongCredentials;
        };
        for (const field of [username, password]) field.addEventListener('keydown', (event) => { if (event.key === 'Enter') submit(); });
        this.dialog.show(dialogText.loginTitle, [createElement('p', { text: dialogText.loginPrompt }), createElement('p', { text: `${dialogText.loginSite}: ${new URL(url).host}` }), createElement('p', { text: `${dialogText.loginRealm}: ${realm}` }),
            createElement('label', { className: 'login-field' }, [dialogText.loginUser, username]), createElement('label', { className: 'login-field' }, [dialogText.loginPassword, password]), message], [createButton(dialogText.ok, submit)]);
        username.focus();
    }

    private openLink(address: string, newWindow: boolean): void {
        if (newWindow) window.open(address, '_blank', 'noopener');
        else this.navigate(address);
    }

    private submitCaptcha(doc: Document): void {
        const answer = doc.querySelector<HTMLInputElement>('[data-captcha-input]')?.value.trim() ?? '';
        if (answer !== '') this.game.dispatch({ type: 'answerCaptcha', answer });
    }

    private bindPage(): void {
        const doc = this.viewport.contentDocument;
        this.hoveredLink = null;
        if (!doc) return;
        doc.addEventListener('mouseover', (event) => {
            this.hoveredLink = (event.target as Element).closest('a[href]')?.getAttribute('href') ?? null;
        });
        doc.addEventListener('mouseout', (event) => { if (event.relatedTarget === null) this.hoveredLink = null; });
        doc.addEventListener('contextmenu', (event) => {
            const target = event.target as Element;
            if (target.matches('input, textarea')) return;
            event.preventDefault();
            const frame = this.viewport.getBoundingClientRect();
            this.openContextMenu(this.pageMenu(target, doc), frame.left + event.clientX, frame.top + event.clientY);
        });
        doc.addEventListener('click', (event) => {
            this.hideContextMenu();
            const target = event.target as Element;
            const link = target.closest('a[href]');
            if (link) {
                event.preventDefault();
                this.openLink(link.getAttribute('href')!, link.getAttribute('target') === '_blank');
            }
            if (target.closest('[data-captcha-refresh]')) this.game.dispatch({ type: 'answerCaptcha', answer: '' });
            if (target.closest('[data-captcha-submit]')) this.submitCaptcha(doc);
        });
        doc.addEventListener('keydown', (event) => {
            this.handleShortcut(event);
            if (event.key === 'Enter' && (event.target as Element).matches('[data-captcha-input]')) this.submitCaptcha(doc);
            if (event.key === '\\' && !(event.target as Element).matches('input, textarea')) {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: '\\', bubbles: true }));
            }
        });
        const captchaInput = doc.querySelector<HTMLInputElement>('[data-captcha-input]');
        const typingElsewhere = document.activeElement?.matches('input, textarea') === true;
        if (captchaInput && !typingElsewhere) captchaInput.focus();
    }
}

function fileType(url: string): string {
    try {
        const path = new URL(url).pathname;
        const extension = path.endsWith('/') ? 'htm' : /\.(\w+)$/.exec(path)?.[1]?.toLowerCase() ?? '';
        return fileTypes[extension] ?? dialogText.unknownFileType;
    } catch { return dialogText.unknownFileType; }
}
