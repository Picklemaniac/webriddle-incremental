import type { Game } from '../core/game.ts';
import { createInitialState, randomSeed } from '../core/state.ts';
import { urlOfLevel } from '../content/act-one/levels.ts';
import { dialogText, fileTypes, fill, menuText, uiText } from '../content/act-one/text.ts';
import { exportSave, importSave } from '../persistence/save.ts';
import { GameDialog } from './dialog.ts';
import { createButton, createElement } from './dom.ts';

interface BrowserControls {
    navigate(url: string): void;
    currentUrl(): string;
}

export class BrowserDialogs {
    private readonly dialog = new GameDialog();
    private readonly game: Game;
    private readonly browser: BrowserControls;

    constructor(game: Game, browser: BrowserControls) {
        this.game = game;
        this.browser = browser;
    }

    showFavorites(): void {
        const favorites = this.game.state.favorites;
        this.dialog.show(menuText.favorites, favorites.length === 0 ? [createElement('p', { text: uiText.none })] : favorites.map((url) => {
            const remove = createButton(menuText.deleteFavorite, () => {
                this.game.dispatch({ type: 'removeFavorite', url });
                this.showFavorites();
            });
            remove.setAttribute('aria-label', fill(uiText.deleteFavorite, { address: url }));
            return createElement('div', { className: 'favorite-row' }, [createButton(url, () => this.open(url), 'dialog-link'), remove]);
        }));
    }

    showHistory(): void {
        const current = this.game.state.currentLevel;
        const levelInput = createElement('input', { attributes: { id: 'history-level', type: 'number', min: '1', max: String(current), autocomplete: 'off' } });
        levelInput.value = String(current);
        const goToLevel = (): void => {
            const level = Math.round(Number(levelInput.value));
            if (level >= 1 && level <= current) this.open(urlOfLevel(level));
        };
        levelInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') goToLevel(); });
        const levels = Array.from({ length: current }, (_, index) => this.levelEntry(current - index));
        const recent = [...this.game.state.history].reverse().map((url) => this.historyEntry(url, [withoutProtocol(url)]));
        this.dialog.show(uiText.history, [
            createElement('h3', { text: uiText.historyLevels }),
            createElement('div', { className: 'history-go' }, [createElement('label', { text: uiText.historyGoTo, attributes: { for: 'history-level' } }), levelInput, createButton(menuText.go, goToLevel)]),
            createElement('div', { className: 'history-list' }, levels),
            createElement('h3', { text: uiText.historyRecent }),
            recent.length === 0 ? createElement('p', { text: uiText.none }) : createElement('div', { className: 'history-list' }, recent),
        ]);
        levelInput.focus();
        levelInput.select();
    }

    showOptions(): void {
        const home = createElement('input', { attributes: { spellcheck: 'false', autocomplete: 'off' } });
        home.value = this.game.state.homePage;
        const clear = createButton(dialogText.clearHistory, () => {
            this.game.dispatch({ type: 'clearHistory' });
            clear.disabled = true;
        });
        clear.disabled = this.game.state.history.length === 0;
        const save = createButton(dialogText.ok, () => {
            this.game.dispatch({ type: 'setHomePage', url: home.value });
            this.dialog.close();
        });
        this.dialog.show(dialogText.optionsTitle, [
            optionsGroup(dialogText.homePageHeading, dialogText.homePageBody, createElement('label', { className: 'login-field' }, [menuText.address, home]),
                optionsButtons(createButton(dialogText.useCurrent, () => { home.value = this.browser.currentUrl(); }), createButton(dialogText.useDefault, () => { home.value = this.game.content.homeUrl; }))),
            optionsGroup(dialogText.historyHeading, dialogText.historyBody, optionsButtons(clear)),
            optionsGroup(dialogText.progressHeading, dialogText.optionsSaving, optionsButtons(createButton(dialogText.startOver, () => this.startOver()))),
        ], { actions: [save], closeLabel: dialogText.cancel });
    }

    showProperties(url: string, title?: string): void {
        const rows: (readonly [string, string])[] = [...(title ? [[dialogText.propertiesName, title] as const] : []), [dialogText.propertiesType, fileType(url)], [dialogText.propertiesAddress, url]];
        this.dialog.show(dialogText.propertiesTitle, [createElement('dl', { className: 'properties' }, rows.flatMap(([label, value]) => [createElement('dt', { text: label }), createElement('dd', { text: value })]))]);
    }

    showAbout(): void {
        this.dialog.show(dialogText.aboutTitle, [createElement('pre', { text: dialogText.aboutBody.join('\n') })]);
    }

    showSave(): void {
        const input = createElement('textarea', { className: 'save-text', attributes: { rows: '7', 'aria-label': uiText.saveString, spellcheck: 'false' } });
        const message = createElement('p', { className: 'dialog-message', attributes: { role: 'status' } });
        const exportButton = createButton(dialogText.exportButton, () => {
            input.value = exportSave(this.game.state);
            input.select();
            message.textContent = uiText.copied;
        });
        const importButton = createButton(dialogText.importButton, () => {
            try {
                const state = importSave(input.value, createInitialState(this.game.content, this.game.state.randomState));
                if (!confirm(dialogText.importConfirm)) return;
                this.game.replaceState(state);
                message.textContent = uiText.imported;
            } catch (error) { message.textContent = error instanceof Error ? error.message : String(error); }
        });
        this.dialog.show(dialogText.exportTitle, [createElement('p', { text: dialogText.exportBody }), input, message], { actions: [exportButton, importButton], wide: true });
    }

    private startOver(): void {
        if (!confirm(dialogText.startOverConfirm)) return;
        this.dialog.close();
        this.game.replaceState(createInitialState(this.game.content, randomSeed()));
    }

    private open(url: string): void {
        this.dialog.close();
        this.browser.navigate(url);
    }

    private levelEntry(level: number): HTMLButtonElement {
        const url = urlOfLevel(level);
        return this.historyEntry(url, [fill(uiText.levelNumber, { level }), new URL(url).pathname]);
    }

    private historyEntry(url: string, columns: readonly string[]): HTMLButtonElement {
        const button = createButton('', () => this.open(url), 'history-entry');
        button.title = url;
        button.append(...columns.map((text, index) => createElement('span', { className: index === columns.length - 1 ? 'history-address' : 'history-level', text })));
        return button;
    }
}

export function withoutProtocol(url: string): string {
    return url.replace(/^https?:\/\//, '');
}

function optionsGroup(heading: string, body: string, ...controls: HTMLElement[]): HTMLElement {
    return createElement('fieldset', { className: 'options-group' }, [createElement('legend', { text: heading }), createElement('p', { text: body }), ...controls]);
}

function optionsButtons(...buttons: HTMLElement[]): HTMLElement {
    return createElement('div', { className: 'options-buttons' }, buttons);
}

function fileType(url: string): string {
    try {
        const path = new URL(url).pathname;
        const extension = path.endsWith('/') ? 'htm' : /\.(\w+)$/.exec(path)?.[1]?.toLowerCase() ?? '';
        return fileTypes[extension] ?? dialogText.unknownFileType;
    } catch { return dialogText.unknownFileType; }
}
