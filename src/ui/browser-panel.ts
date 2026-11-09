import type { Game } from '../core/game.ts';
import type { Page } from '../core/content.ts';
import { canonicalUrl } from '../content/act-one/pages.ts';
import { urlOfLevel } from '../content/act-one/levels.ts';
import { browserName, dialogText, menuText, uiText } from '../content/act-one/text.ts';
import { BrowserDialogs, withoutProtocol } from './browser-dialogs.ts';
import { GameDialog } from './dialog.ts';
import { createButton, createElement, createTitleBar, isTextField, setText } from './dom.ts';
import type { Panel } from './panel.ts';

const viewSourcePrefix = 'view-source:';
const historyLimit = 200;
const fastestLoadMilliseconds = 100;
const slowestLoadMilliseconds = 550;
const devPanelKey = '\\';

interface MenuCommand {
    readonly label: string;
    readonly action: (() => void) | undefined;
}

type MenuItem = MenuCommand | null;

interface NavigationOptions {
    readonly record?: boolean;
    readonly historyIndex?: number;
    readonly followCurrentLevel?: boolean;
}

interface Link {
    readonly url: string;
    readonly newWindow: boolean;
}

export class BrowserPanel implements Panel {
    readonly element: HTMLElement;
    private readonly game: Game;
    private readonly address = createElement('input', { className: 'browser-address', attributes: { 'aria-label': menuText.address, spellcheck: 'false', autocomplete: 'off' } });
    private readonly viewport = createElement('iframe', { className: 'browser-viewport', attributes: { sandbox: 'allow-same-origin allow-downloads', title: uiText.pageTitle } });
    private readonly title = createElement('strong');
    private readonly status = createElement('span', { className: 'status-cell' });
    private readonly throbber = createElement('img', { className: 'throbber', attributes: { src: 'branding/enigma-web.png', alt: '', 'aria-hidden': 'true' } });
    private readonly loginDialog = new GameDialog();
    private readonly dialogs: BrowserDialogs;
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
        this.dialogs = new BrowserDialogs(game, { navigate: (url) => this.navigate(url), currentUrl: () => this.viewedUrl });
        this.history = [game.state.browserUrl];
        this.back = this.tool('◀', menuText.back, () => this.moveHistory(-1));
        this.forward = this.tool('▶', menuText.forward, () => this.moveHistory(1), 'navigation-icon');
        this.stop = this.tool('×', menuText.stop, () => this.stopLoading(), 'navigation-icon');
        this.follow = createButton(uiText.follow, () => {
            this.sourceOpen = false;
            this.updateSourceVisibility();
            this.navigate(urlOfLevel(game.state.currentLevel), { followCurrentLevel: true });
        }, 'follow-current');
        this.sourceButton = this.tool('≡', uiText.source, () => this.showSource());
        this.sourceButton.setAttribute('aria-controls', 'page-source');
        const sourceClose = createButton('×', () => this.closeSource());
        sourceClose.setAttribute('aria-label', uiText.closeSource);
        this.sourcePane.append(createElement('div', { className: 'source-heading' }, [createElement('strong', { text: uiText.pageSource }), createElement('span', { text: uiText.sourceShortcut }), sourceClose]), this.sourceDocument);
        this.content.append(this.viewport, this.sourcePane);
        this.updateSourceVisibility();
        const titleBar = createTitleBar([createElement('img', { className: 'browser-icon', attributes: { src: 'branding/enigma-web.png', alt: '' } }), this.title]);
        const toolbar = createElement('div', { className: 'browser-toolbar' }, [this.back, this.forward, this.stop,
            this.tool('↻', menuText.refresh, () => this.refresh(), 'navigation-icon'),
            this.tool('⌂', menuText.home, () => this.goHome(), 'navigation-icon'),
            createElement('span', { className: 'toolbar-divider' }),
            this.sourceButton,
            createElement('span', { className: 'toolbar-divider' }),
            this.tool('★', menuText.favorites, () => this.dialogs.showFavorites(), 'secondary'),
            this.tool('◷', uiText.history, () => this.dialogs.showHistory(), 'secondary'),
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
                this.loginDialog.close();
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
                : `${menuText.statusDone}${this.page.statusCode === 200 ? '' : ` (${this.page.statusCode || menuText.statusDns})`}`);
        }
        this.back.disabled = !this.canGoBack();
        this.forward.disabled = !this.canGoForward();
        this.stop.disabled = !this.pendingNavigation;
        this.follow.hidden = canonicalUrl(browserUrl) === urlOfLevel(this.game.state.currentLevel) || (this.game.state.currentLevel === 1 && this.game.state.flags.entered !== true);
        if (this.loginDialog.element.open && (this.loginAddress !== browserUrl || !this.page.loginRealm)) this.loginDialog.close();
        if (this.page.loginRealm && this.loginAddress !== browserUrl) {
            this.loginAddress = browserUrl;
            this.showLogin(browserUrl, this.page.loginRealm);
        }
    }

    navigate(rawAddress: string, { record = true, historyIndex, followCurrentLevel = false }: NavigationOptions = {}): void {
        const address = this.resolveAddress(rawAddress);
        this.pinPage();
        this.stopLoading();
        this.followOnArrival = followCurrentLevel;
        this.addressEdited = false;
        this.address.value = this.shownAddress(address);
        this.throbber.classList.add('loading');
        setText(this.status, `${menuText.statusOpening}…`);
        const delay = Math.max(fastestLoadMilliseconds, slowestLoadMilliseconds / Math.sqrt(Math.max(1, this.game.stat('requestsPerThread') / 2)));
        this.pendingNavigation = setTimeout(() => this.arrive(address, record, historyIndex), delay);
        this.stop.disabled = false;
    }

    private resolveAddress(rawAddress: string): string {
        let address = rawAddress.trim();
        if (address.toLowerCase().startsWith(viewSourcePrefix)) {
            address = address.slice(viewSourcePrefix.length).trim();
            this.sourceOpen = true;
            this.updateSourceVisibility();
        }
        try {
            if (/^[\w-]+\.[\w-]+\//.test(address) && !address.includes('://')) address = `${new URL(this.game.content.startUrl).protocol}//${address}`;
            return new URL(address, this.viewedUrl).href;
        } catch {
            return address;
        }
    }

    private arrive(address: string, record: boolean, historyIndex: number | undefined): void {
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
    }

    private tool(icon: string, label: string, click: () => void, style?: 'navigation-icon' | 'secondary'): HTMLButtonElement {
        const button = createButton('', click, style === undefined ? 'tool-button' : `tool-button ${style}`);
        button.title = label;
        button.setAttribute('aria-label', label);
        button.append(createElement('span', { className: 'tool-icon', text: icon }), createElement('span', { text: label }));
        return button;
    }

    private pageMenu(target: Element): MenuItem[] {
        const copy = this.copyCommand(this.selectedText());
        const found = linkAt(target);
        const link = found === null ? null : { ...found, url: this.absolute(found.url) };
        const pictureAddress = target.closest('img[data-address]')?.getAttribute('data-address');
        if (pictureAddress) {
            const picture = this.absolute(pictureAddress);
            return [
                ...(link === null ? [] : [{ label: menuText.openLink, action: () => this.openLink(link) }]),
                { label: menuText.showPicture, action: () => this.navigate(picture) },
                null,
                { label: menuText.copyShortcut, action: () => this.copyText(link?.url ?? picture) },
                null,
                { label: menuText.properties, action: () => this.dialogs.showProperties(picture) },
            ];
        }
        if (link !== null) {
            return [
                { label: menuText.open, action: () => this.openLink(link) },
                null,
                copy,
                { label: menuText.copyShortcut, action: () => this.copyText(link.url) },
                null,
                { label: menuText.addFavorite, action: () => this.addFavorite(link.url) },
                { label: menuText.properties, action: () => this.dialogs.showProperties(link.url) },
            ];
        }
        return [
            { label: menuText.back, action: this.canGoBack() ? () => this.moveHistory(-1) : undefined },
            { label: menuText.forward, action: this.canGoForward() ? () => this.moveHistory(1) : undefined },
            null,
            copy,
            { label: menuText.selectAll, action: () => this.selectAll() },
            null,
            { label: uiText.source, action: () => this.showSource() },
            { label: menuText.refresh, action: () => this.refresh() },
            null,
            { label: menuText.addFavorite, action: () => this.addFavorite() },
            { label: menuText.properties, action: () => this.dialogs.showProperties(this.viewedUrl, this.page.title) },
        ];
    }

    private sourceMenu(target: Element): MenuItem[] {
        const href = target.closest('a[href]')?.getAttribute('href');
        const link = href ? this.absolute(href) : null;
        return [
            ...(link === null ? [] : [{ label: menuText.open, action: () => this.navigate(link) }, { label: menuText.copyShortcut, action: () => this.copyText(link) }, null]),
            this.copyCommand(this.selectedText()),
            { label: menuText.selectAll, action: () => this.selectAll() },
            null,
            { label: menuText.closeSource, action: () => this.closeSource() },
        ];
    }

    private copyCommand(text: string): MenuCommand {
        return { label: menuText.copy, action: text === '' ? undefined : () => this.copyText(text) };
    }

    private openContextMenu(items: readonly MenuItem[], x: number, y: number): void {
        this.contextMenu.replaceChildren(...menuElements(items, () => this.hideContextMenu()));
        this.contextMenu.hidden = false;
        const bounds = this.element.getBoundingClientRect();
        this.contextMenu.style.left = `${Math.max(0, Math.min(x - bounds.left, bounds.width - this.contextMenu.offsetWidth - 4))}px`;
        this.contextMenu.style.top = `${Math.max(0, Math.min(y - bounds.top, bounds.height - this.contextMenu.offsetHeight - 4))}px`;
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
        const typing = isTextField(event.target as Element);
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
        if (key === 'i') return () => this.dialogs.showFavorites();
        if (key === 'h') return () => this.dialogs.showHistory();
        return undefined;
    }

    private addFavorite(url = this.viewedUrl): void {
        this.game.dispatch({ type: 'addFavorite', url });
        this.dialogs.showFavorites();
    }

    private createMenus(): HTMLElement {
        const definitions: readonly (readonly [string, () => readonly MenuItem[]])[] = [
            [menuText.file, () => [{ label: menuText.importExport, action: () => this.dialogs.showSave() }]],
            [menuText.edit, () => [this.copyCommand(this.selectedText()), { label: menuText.selectAll, action: () => this.selectAll() }]],
            [menuText.view, () => [{ label: menuText.source, action: () => this.showSource() }, { label: uiText.history, action: () => this.dialogs.showHistory() }, { label: menuText.refresh, action: () => this.refresh() }]],
            [menuText.favorites, () => [
                { label: menuText.addFavorite, action: () => this.addFavorite() },
                { label: menuText.organizeFavorites, action: () => this.dialogs.showFavorites() },
                ...(this.game.state.favorites.length === 0 ? [] : [null, ...this.game.state.favorites.map((url) => ({ label: withoutProtocol(url), action: () => this.navigate(url) }))]),
            ]],
            [menuText.tools, () => [{ label: menuText.internetOptions, action: () => this.dialogs.showOptions() }]],
            [menuText.help, () => [{ label: menuText.about, action: () => this.dialogs.showAbout() }]],
        ];
        const bar = createElement('nav', { className: 'menu-bar' });
        for (const [label, commands] of definitions) {
            const details = createElement('details', { className: 'browser-menu' });
            const popup = createElement('div', { className: 'menu-popup' });
            const populate = (): void => popup.replaceChildren(...menuElements(commands(), () => { details.open = false; }));
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
        if (this.history.length > historyLimit) this.history.shift();
        this.historyIndex = this.history.length - 1;
    }

    private canGoBack(): boolean { return this.historyIndex > 0; }

    private canGoForward(): boolean { return this.historyIndex < this.history.length - 1; }

    private moveHistory(direction: number): void {
        const index = this.historyIndex + direction;
        const url = this.history[index];
        if (url === undefined) return;
        this.navigate(url, { record: false, historyIndex: index });
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
                    const offset = token.indexOf(target, link.index);
                    const anchor = createElement('a', { text: target, attributes: { href: target } });
                    anchor.addEventListener('click', (event) => { event.preventDefault(); this.openLink({ url: target, newWindow: token.includes('target="_blank"') }); });
                    span.replaceChildren(token.slice(0, offset), anchor, token.slice(offset + target.length));
                }
            }
            this.sourceDocument.append(span);
        }
    }

    private activeDocument(): Document | null {
        return this.sourceOpen ? document : this.viewport.contentDocument;
    }

    private selectAll(): void {
        this.pinPage();
        const doc = this.activeDocument();
        const target = this.sourceOpen ? this.sourceDocument : doc?.body;
        if (!doc || !target) return;
        const range = doc.createRange();
        range.selectNodeContents(target);
        const selection = doc.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        (this.sourceOpen ? this.sourceDocument : this.viewport).focus({ preventScroll: true });
    }

    private selectedText(): string {
        return this.activeDocument()?.getSelection()?.toString() ?? '';
    }

    private copyText(text: string): void {
        void navigator.clipboard?.writeText(text).catch(() => undefined);
    }

    private absolute(address: string): string {
        try { return new URL(address, this.viewedUrl).href; } catch { return address; }
    }

    private refresh(): void { this.navigate(this.viewedUrl, { record: false }); }

    private goHome(): void { this.navigate(this.game.state.homePage); }

    private focusAddress(): void {
        this.address.focus();
        this.address.select();
    }

    private showLogin(url: string, realm: string): void {
        this.pinPage();
        const username = createElement('input', { attributes: { autocomplete: 'off', 'aria-label': dialogText.loginUser } });
        const password = createElement('input', { attributes: { type: 'password', autocomplete: 'off', 'aria-label': dialogText.loginPassword } });
        const message = createElement('p', { className: 'dialog-message', attributes: { role: 'status' } });
        const submit = (): void => {
            const accepted = this.game.dispatch({ type: 'submitCredentials', url, username: username.value, password: password.value });
            if (accepted) {
                this.loginDialog.close();
                this.render();
            } else {
                message.textContent = uiText.wrongCredentials;
            }
        };
        for (const field of [username, password]) field.addEventListener('keydown', (event) => { if (event.key === 'Enter') submit(); });
        this.loginDialog.show(dialogText.loginTitle, [
            createElement('p', { text: dialogText.loginPrompt }),
            createElement('p', { text: `${dialogText.loginSite}: ${new URL(url).host}` }),
            createElement('p', { text: `${dialogText.loginRealm}: ${realm}` }),
            createElement('label', { className: 'login-field' }, [dialogText.loginUser, username]),
            createElement('label', { className: 'login-field' }, [dialogText.loginPassword, password]),
            message,
        ], { actions: [createButton(dialogText.ok, submit)] });
        username.focus();
    }

    private openLink({ url, newWindow }: Link): void {
        if (newWindow) window.open(url, '_blank', 'noopener');
        else this.navigate(url);
    }

    private submitCaptcha(doc: Document): void {
        const answer = doc.querySelector<HTMLInputElement>('[data-captcha-input]')?.value.trim() ?? '';
        if (answer !== '') this.game.dispatch({ type: 'answerCaptcha', answer });
    }

    private bindPage(): void {
        const doc = this.viewport.contentDocument;
        this.hoveredLink = null;
        if (!doc) return;
        doc.addEventListener('mouseover', (event) => { this.hoveredLink = linkAt(event.target as Element)?.url ?? null; });
        doc.addEventListener('mouseout', (event) => { if (event.relatedTarget === null) this.hoveredLink = null; });
        doc.addEventListener('contextmenu', (event) => {
            const target = event.target as Element;
            if (isTextField(target)) return;
            event.preventDefault();
            const frame = this.viewport.getBoundingClientRect();
            this.openContextMenu(this.pageMenu(target), frame.left + event.clientX, frame.top + event.clientY);
        });
        doc.addEventListener('click', (event) => {
            this.hideContextMenu();
            const target = event.target as Element;
            const link = linkAt(target);
            if (link) {
                event.preventDefault();
                this.openLink(link);
            }
            if (target.closest('[data-captcha-refresh]')) this.game.dispatch({ type: 'answerCaptcha', answer: '' });
            if (target.closest('[data-captcha-submit]')) this.submitCaptcha(doc);
        });
        doc.addEventListener('keydown', (event) => {
            this.handleShortcut(event);
            const target = event.target as Element;
            if (event.key === 'Enter' && target.matches('[data-captcha-input]')) this.submitCaptcha(doc);
            if (event.key === devPanelKey && !isTextField(target)) document.dispatchEvent(new KeyboardEvent('keydown', { key: devPanelKey, bubbles: true }));
        });
        const captchaInput = doc.querySelector<HTMLInputElement>('[data-captcha-input]');
        if (captchaInput && !isTextField(document.activeElement)) captchaInput.focus();
    }
}

function linkAt(target: Element): Link | null {
    const anchor = target.closest('a[href]');
    return anchor === null ? null : { url: anchor.getAttribute('href')!, newWindow: anchor.getAttribute('target') === '_blank' };
}

function menuElements(items: readonly MenuItem[], close: () => void): HTMLElement[] {
    return items.map((item) => {
        if (item === null) return createElement('div', { className: 'menu-separator' });
        const button = createButton(item.label, () => { close(); item.action?.(); });
        button.disabled = item.action === undefined;
        return button;
    });
}
