import type { Game } from '../core/game.ts';
import type { Page } from '../core/content.ts';
import { createInitialState } from '../core/state.ts';
import { canonicalUrl } from '../content/act-one/pages.ts';
import { urlOfLevel } from '../content/act-one/levels.ts';
import { browserName, dialogText, menuText, uiText } from '../content/act-one/text.ts';
import { decodeExport, encodeExport, parseSave, serializeSave } from '../persistence/save.ts';
import { createButton, createElement, setText } from './dom.ts';
import { GameDialog } from './dialog.ts';
import type { Panel } from './panel.ts';

export class BrowserPanel implements Panel {
    readonly element: HTMLElement;
    private readonly game: Game;
    private readonly address = createElement('input', { className: 'browser-address', attributes: { 'aria-label': menuText.address, spellcheck: 'false', autocomplete: 'off' } });
    private readonly viewport = createElement('iframe', { className: 'browser-viewport', attributes: { sandbox: 'allow-same-origin', title: uiText.pageTitle } });
    private readonly title = createElement('strong');
    private readonly status = createElement('span', { className: 'status-cell' });
    private readonly throbber = createElement('img', { className: 'throbber', attributes: { src: '/branding/enigma-web.png', alt: '', 'aria-hidden': 'true' } });
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
        const windowButtons = createElement('span', { className: 'window-buttons', attributes: { 'aria-hidden': 'true' } },
            ['minimize', 'maximize', 'close'].map((kind) => createElement('span', { className: `window-button ${kind}` })));
        const titleBar = createElement('header', { className: 'title-bar' }, [createElement('img', { className: 'browser-icon', attributes: { src: '/branding/enigma-web.png', alt: '' } }), this.title, windowButtons]);
        const toolbar = createElement('div', { className: 'browser-toolbar' }, [this.back, this.forward, this.stop,
            this.tool('↻', menuText.refresh, () => this.navigate(this.viewedUrl, false)),
            this.tool('⌂', menuText.home, () => this.navigate(game.content.startUrl)),
            createElement('span', { className: 'toolbar-divider' }),
            this.sourceButton,
            createElement('span', { className: 'toolbar-divider' }),
            this.tool('★', menuText.favorites, () => this.showFavorites(), true),
            this.tool('◷', uiText.history, () => this.showHistory(), true),
            this.throbber]);
        this.contextMenu.hidden = true;
        for (const [name, action] of this.contextCommands()) {
            this.contextMenu.append(name === null ? createElement('div', { className: 'menu-separator' }) : createButton(name, () => { this.hideContextMenu(); action(); }));
        }
        const go = createElement('button', { text: menuText.go, attributes: { type: 'submit' } });
        const addressForm = createElement('form', { className: 'address-bar' }, [createElement('label', { text: menuText.address, attributes: { for: 'riddle-address' } }), this.address, go]);
        this.address.id = 'riddle-address';
        this.address.addEventListener('focus', () => this.pinPage());
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
        if (!this.addressEdited && document.activeElement !== this.address && !this.pendingNavigation) this.address.value = browserUrl;
        this.page = this.game.content.resolvePage(browserUrl, this.game.state);
        if (this.sourceOpen) this.renderSource();
        if (this.page.html !== this.renderedHtml) {
            this.renderedHtml = this.page.html;
            this.viewport.srcdoc = this.page.html;
            const title = this.page.title ? `${this.page.title} - ${browserName}` : browserName;
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
        this.follow.hidden = canonicalUrl(browserUrl) === urlOfLevel(this.game.state.currentLevel);
        if (this.dialog.element.open && this.dialog.element.querySelector('input[type="password"]') &&
            (this.loginAddress !== browserUrl || !this.page.loginRealm)) this.dialog.close();
        if (this.page.loginRealm && this.loginAddress !== browserUrl) {
            this.loginAddress = browserUrl;
            this.showLogin(browserUrl, this.page.loginRealm);
        }
    }

    navigate(rawAddress: string, record = true, historyIndex?: number): void {
        let address = rawAddress.trim();
        try {
            if (/^[\w-]+\.[\w-]+\//.test(address) && !address.includes('://')) address = `${new URL(this.game.content.startUrl).protocol}//${address}`;
            address = new URL(address, this.viewedUrl).href;
        } catch { /* Invalid addresses are rendered as a failed navigation. */ }
        this.pinPage();
        this.stopLoading();
        this.addressEdited = false;
        this.address.value = address;
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

    private contextCommands(): readonly (readonly [string, () => void] | readonly [null])[] {
        return [
            [menuText.back, () => this.moveHistory(-1)],
            [menuText.forward, () => this.moveHistory(1)],
            [null],
            [menuText.selectAll, () => this.selectAll()],
            [null],
            [menuText.addFavorite, () => this.addFavorite()],
            [uiText.source, () => this.showSource()],
            [menuText.refresh, () => this.navigate(this.viewedUrl, false)],
        ];
    }

    private showContextMenu(x: number, y: number): void {
        const [back, forward] = this.contextMenu.querySelectorAll('button');
        back!.disabled = this.historyIndex <= 0;
        forward!.disabled = this.historyIndex >= this.history.length - 1;
        this.contextMenu.hidden = false;
        const frame = this.viewport.getBoundingClientRect();
        const window = this.element.getBoundingClientRect();
        const left = Math.min(frame.left - window.left + x, window.width - this.contextMenu.offsetWidth - 4);
        const top = Math.min(frame.top - window.top + y, window.height - this.contextMenu.offsetHeight - 4);
        this.contextMenu.style.left = `${Math.max(0, left)}px`;
        this.contextMenu.style.top = `${Math.max(0, top)}px`;
    }

    private hideContextMenu(): void { this.contextMenu.hidden = true; }

    private handleShortcut(event: KeyboardEvent): void {
        const key = event.key.toLowerCase();
        if (key === 'escape') this.hideContextMenu();
        if (!(event.ctrlKey || event.metaKey)) return;
        if (key === 'u') {
            event.preventDefault();
            this.showSource();
        } else if (key === 'a' && !(event.target as Element).matches?.('input, textarea')) {
            event.preventDefault();
            this.selectAll();
        }
    }

    private addFavorite(): void {
        this.game.dispatch({ type: 'addFavorite', url: this.viewedUrl });
        this.showFavorites();
    }

    private createMenus(): HTMLElement {
        const definitions: readonly [string, readonly [string, () => void][]][] = [
            [menuText.file, [[menuText.importExport, () => this.showSave()]]],
            [menuText.edit, [[menuText.selectAll, () => this.selectAll()]]],
            [menuText.view, [[menuText.source, () => this.showSource()], [uiText.history, () => this.showHistory()], [menuText.refresh, () => this.navigate(this.viewedUrl, false)]]],
            [menuText.favorites, [[menuText.addFavorite, () => this.addFavorite()], [menuText.organizeFavorites, () => this.showFavorites()]]],
            [menuText.tools, [[menuText.internetOptions, () => this.showOptions()]]],
            [menuText.help, [[menuText.about, () => this.dialog.show(dialogText.aboutTitle, [createElement('pre', { text: dialogText.aboutBody.join('\n') })])]]],
        ];
        const bar = createElement('nav', { className: 'menu-bar' });
        for (const [label, commands] of definitions) {
            const details = createElement('details', { className: 'browser-menu' });
            const popup = createElement('div', { className: 'menu-popup' });
            for (const [name, action] of commands) popup.append(createButton(name, () => { details.open = false; action(); }));
            details.append(createElement('summary', { text: label }), popup);
            details.addEventListener('toggle', () => {
                if (details.open) for (const other of bar.querySelectorAll('details')) if (other !== details) other.open = false;
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
        this.updateSourceVisibility();
        this.render();
        if (document.activeElement !== this.address) this.viewport.focus({ preventScroll: true });
    }

    private get viewedUrl(): string { return this.pinnedUrl ?? (this.lastUrl || this.game.state.browserUrl); }

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
                    const offset = token.indexOf(target, link.index);
                    const anchor = createElement('a', { text: target, attributes: { href: target } });
                    anchor.addEventListener('click', (event) => { event.preventDefault(); this.navigate(target); });
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
        this.showLinks(menuText.favorites, this.game.state.favorites);
    }

    private showHistory(): void { this.showLinks(uiText.history, [...new Set(this.history)].reverse()); }

    private showLinks(title: string, links: readonly string[]): void {
        this.dialog.show(title, links.length ? links.map((url) => {
            const button = createButton(url, () => { this.dialog.close(); this.navigate(url); });
            button.className = 'dialog-link';
            return button;
        }) : [createElement('p', { text: uiText.none })]);
    }

    private showOptions(): void {
        const sound = createElement('input', { attributes: { type: 'checkbox' } });
        sound.checked = this.game.state.settings.sound;
        sound.addEventListener('change', () => this.game.dispatch({ type: 'setSound', enabled: sound.checked }));
        this.dialog.show(dialogText.optionsTitle, [createElement('label', { className: 'checkbox-label' }, [sound, dialogText.optionsSound]), createElement('p', { text: dialogText.optionsSaving })]);
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
        password.addEventListener('keydown', (event) => { if (event.key === 'Enter') submit(); });
        this.dialog.show(dialogText.loginTitle, [createElement('p', { text: dialogText.loginPrompt }), createElement('p', { text: `${dialogText.loginSite}: ${new URL(url).host}` }), createElement('p', { text: `${dialogText.loginRealm}: ${realm}` }),
            createElement('label', { className: 'login-field' }, [dialogText.loginUser, username]), createElement('label', { className: 'login-field' }, [dialogText.loginPassword, password]), message], [createButton(dialogText.ok, submit)]);
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
            if ((event.target as Element).matches('input, textarea')) return;
            event.preventDefault();
            this.showContextMenu(event.clientX, event.clientY);
        });
        doc.addEventListener('click', (event) => {
            this.hideContextMenu();
            const target = event.target as Element;
            const link = target.closest('a[href]');
            if (link) {
                event.preventDefault();
                this.navigate(link.getAttribute('href')!);
            }
            const tile = target.closest('[data-captcha-tile]');
            if (tile) tile.setAttribute('aria-pressed', String(tile.getAttribute('aria-pressed') !== 'true'));
            if (target.closest('[data-captcha-checkbox]')) this.game.dispatch({ type: 'answerCaptcha', answer: '' });
            if (target.closest('[data-captcha-verify]')) {
                const input = doc.querySelector<HTMLInputElement>('[data-captcha-input]');
                const answer = input?.value ?? [...doc.querySelectorAll('[data-captcha-tile][aria-pressed=true]')].map((item) => item.getAttribute('data-captcha-tile')).join(',');
                this.game.dispatch({ type: 'answerCaptcha', answer });
            }
        });
        doc.addEventListener('keydown', (event) => {
            this.handleShortcut(event);
            if (event.key === '\\' && !(event.target as Element).matches('input, textarea')) {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: '\\', bubbles: true }));
            }
        });
    }
}
