interface ElementOptions {
    readonly className?: string;
    readonly text?: string;
    readonly attributes?: Readonly<Record<string, string>>;
}

export function createElement<TagName extends keyof HTMLElementTagNameMap>(
    tagName: TagName,
    options: ElementOptions = {},
    children: readonly (Node | string)[] = [],
): HTMLElementTagNameMap[TagName] {
    const element = document.createElement(tagName);
    if (options.className !== undefined) {
        element.className = options.className;
    }
    if (options.text !== undefined) {
        element.textContent = options.text;
    }
    for (const [name, value] of Object.entries(options.attributes ?? {})) {
        element.setAttribute(name, value);
    }
    element.append(...children);
    return element;
}

export function createButton(label: string, onClick: () => void): HTMLButtonElement {
    const button = createElement('button', { text: label, attributes: { type: 'button' } });
    button.addEventListener('click', onClick);
    return button;
}

export function setText(element: Element, text: string): void {
    if (element.textContent !== text) {
        element.textContent = text;
    }
}

export function createTitleBar(children: readonly (Node | string)[]): HTMLElement {
    const buttons = createElement('span', { className: 'window-buttons', attributes: { 'aria-hidden': 'true' } },
        ['minimize', 'maximize', 'close'].map((kind) => createElement('span', { className: `window-button ${kind}` })));
    return createElement('header', { className: 'title-bar' }, [...children, buttons]);
}

export function createProgressBar(seconds: number): HTMLElement {
    const fill = createElement('div', { className: 'win-progress-fill' });
    fill.style.setProperty('--duration', `${seconds}s`);
    return createElement('div', { className: 'win-progress' }, [fill]);
}
