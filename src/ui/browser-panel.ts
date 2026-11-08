import type { Game } from '../core/game.ts';
import { createButton, createElement } from './dom.ts';
import type { Panel } from './panel.ts';

export class BrowserPanel implements Panel {
    readonly element: HTMLElement;
    private readonly game: Game;
    private readonly addressInput: HTMLInputElement;
    private readonly sourceToggle: HTMLButtonElement;
    private readonly viewport: HTMLIFrameElement;
    private readonly sourceView: HTMLPreElement;
    private renderedHtml = '';

    constructor(game: Game) {
        this.game = game;
        this.addressInput = createElement('input', {
            className: 'browser-address',
            attributes: { spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Address' },
        });
        this.sourceToggle = createButton('View source', () => this.toggleSource());
        this.viewport = createElement('iframe', {
            className: 'browser-viewport',
            attributes: { sandbox: 'allow-same-origin', title: 'Page' },
        });
        this.viewport.addEventListener('load', () => this.interceptLinks());
        this.sourceView = createElement('pre', { className: 'browser-source' });
        this.sourceView.hidden = true;

        const toolbar = createElement('form', { className: 'browser-toolbar' }, [this.addressInput, this.sourceToggle]);
        toolbar.addEventListener('submit', (event) => {
            event.preventDefault();
            this.navigate(this.addressInput.value);
            this.addressInput.blur();
        });

        this.element = createElement('section', { className: 'browser' }, [toolbar, this.viewport, this.sourceView]);
    }

    render(): void {
        const { browserUrl } = this.game.state;
        if (document.activeElement !== this.addressInput) {
            this.addressInput.value = browserUrl;
        }
        const page = this.game.content.resolvePage(browserUrl, this.game.state);
        if (page.html !== this.renderedHtml) {
            this.renderedHtml = page.html;
            this.viewport.srcdoc = page.html;
            this.sourceView.textContent = page.html;
        }
    }

    private navigate(address: string): void {
        this.game.dispatch({ type: 'navigate', url: normalizeAddress(address) });
    }

    private toggleSource(): void {
        const showSource = this.sourceView.hidden;
        this.sourceView.hidden = !showSource;
        this.viewport.hidden = showSource;
        this.sourceToggle.textContent = showSource ? 'View page' : 'View source';
    }

    private interceptLinks(): void {
        this.viewport.contentDocument?.addEventListener('click', (event) => {
            const href = findLink(event.target)?.getAttribute('href');
            if (href === null || href === undefined) {
                return;
            }
            event.preventDefault();
            this.navigate(new URL(href, this.game.state.browserUrl).href);
        });
    }
}

function findLink(target: EventTarget | null): Element | null {
    return target !== null && 'closest' in target ? (target as Element).closest('a[href]') : null;
}

function normalizeAddress(address: string): string {
    const trimmedAddress = address.trim();
    for (const candidate of [trimmedAddress, `http://${trimmedAddress}`]) {
        if (URL.canParse(candidate)) {
            return new URL(candidate).href;
        }
    }
    return trimmedAddress;
}
