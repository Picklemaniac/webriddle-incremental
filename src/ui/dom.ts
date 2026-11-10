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

export function createButton(label: string, onClick: () => void, className?: string): HTMLButtonElement {
    const button = createElement('button', { className, text: label, attributes: { type: 'button' } });
    button.addEventListener('click', onClick);
    return button;
}

export function createSlider(label: string, onChange: (value: number) => void): HTMLInputElement {
    const slider = createElement('input', { className: 'win-slider', attributes: { type: 'range', min: '0', step: '1', 'aria-label': label } });
    slider.addEventListener('input', () => onChange(Number(slider.value)));
    return slider;
}

export function section(title: string): HTMLElement {
    return createElement('section', { className: 'panel' }, [createElement('h2', { text: title })]);
}

export function isTextField(target: EventTarget | null): boolean {
    return (target as Element | null)?.matches?.('input, textarea') === true;
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
