import { automationText, fill, setupText } from '../content/act-one/text.ts';
import { createButton, createElement, createProgressBar, createTitleBar } from './dom.ts';

const installSeconds = 2.4;

export class SetupWizard {
    private readonly element = createElement('dialog', { className: 'window-dialog setup-wizard' });
    private readonly page = createElement('div', { className: 'wizard-page' });
    private readonly back = createButton(setupText.back, () => undefined);
    private readonly next = createButton(setupText.next, () => this.advance());
    private readonly cancel = createButton(setupText.cancel, () => this.element.close());
    private step = 0;
    private timers: ReturnType<typeof setTimeout>[] = [];
    private finished: () => void = () => undefined;

    constructor() {
        const name = automationText.program;
        const title = fill(setupText.wizardTitle, { name });
        this.element.setAttribute('aria-label', title);
        this.back.disabled = true;
        this.element.append(
            createTitleBar([createElement('strong', { text: title })]),
            createElement('div', { className: 'wizard-body' }, [createElement('div', { className: 'wizard-banner' }, [createElement('span', { text: name })]), this.page]),
            createElement('div', { className: 'wizard-actions' }, [this.back, this.next, this.cancel]),
        );
        this.element.addEventListener('cancel', (event) => { if (this.step === 1) event.preventDefault(); });
        this.element.addEventListener('close', () => this.clearTimers());
        document.body.append(this.element);
    }

    open(finished: () => void): void {
        this.finished = finished;
        this.show(0);
        this.element.showModal();
        this.next.focus();
    }

    private advance(): void {
        if (this.step < 2) {
            this.show(this.step + 1);
            return;
        }
        this.element.close();
        this.finished();
    }

    private show(step: number): void {
        this.clearTimers();
        this.step = step;
        const name = automationText.program;
        this.next.disabled = step === 1;
        this.cancel.disabled = step !== 0;
        this.next.textContent = step === 2 ? setupText.finish : setupText.next;
        if (step === 0) {
            this.page.replaceChildren(heading(fill(setupText.welcomeHeading, { name })), paragraph(fill(setupText.welcomeBody, { name })),
                paragraph(automationText.description), paragraph(setupText.welcomeNext));
        } else if (step === 1) {
            const status = paragraph('');
            this.page.replaceChildren(heading(fill(setupText.installingHeading, { name })), status, createProgressBar(installSeconds));
            setupText.wizardFiles.forEach((file, index) => this.later(index * installSeconds * 1000 / setupText.wizardFiles.length, () => { status.textContent = fill(setupText.copying, { file }); }));
            this.later(installSeconds * 1000 + 300, () => this.show(2));
        } else {
            this.page.replaceChildren(heading(fill(setupText.finishHeading, { name })), paragraph(fill(setupText.finishBody, { name })));
            this.next.focus();
        }
    }

    private later(milliseconds: number, action: () => void): void {
        this.timers.push(setTimeout(action, milliseconds));
    }

    private clearTimers(): void {
        for (const timer of this.timers) clearTimeout(timer);
        this.timers = [];
    }
}

function heading(text: string): HTMLElement {
    return createElement('h3', { text });
}

function paragraph(text: string): HTMLElement {
    return createElement('p', { text });
}
