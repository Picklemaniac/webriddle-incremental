import { dialogText } from '../content/act-one/text.ts';
import { createButton, createElement } from './dom.ts';

interface DialogOptions {
    readonly actions?: readonly HTMLElement[];
    readonly wide?: boolean;
    readonly closeLabel?: string;
}

export class GameDialog {
    readonly element = createElement('dialog', { className: 'window-dialog' });
    private readonly heading = createElement('strong');
    private readonly body = createElement('div', { className: 'dialog-body' });
    private readonly footer = createElement('div', { className: 'dialog-actions' });

    constructor() {
        const close = createButton('×', () => this.element.close(), 'window-close');
        close.setAttribute('aria-label', dialogText.close);
        this.element.append(createElement('header', { className: 'title-bar' }, [this.heading, close]), this.body, this.footer);
        this.element.addEventListener('click', (event) => { if (event.target === this.element) this.element.close(); });
        document.body.append(this.element);
    }

    show(title: string, children: readonly Node[], { actions = [], wide = false, closeLabel = dialogText.close }: DialogOptions = {}): void {
        this.heading.textContent = title;
        this.element.setAttribute('aria-label', title);
        this.element.classList.toggle('wide', wide);
        this.body.replaceChildren(...children);
        this.footer.replaceChildren(...actions, createButton(closeLabel, () => this.element.close()));
        if (!this.element.open) this.element.showModal();
    }

    close(): void { this.element.close(); }
}
