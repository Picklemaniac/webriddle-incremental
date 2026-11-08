import type { GameContent } from '../core/content.ts';
import { createButton, createElement, setText } from '../ui/dom.ts';

export interface DevCommands {
    setTimeScale(timeScale: number): void;
    advance(seconds: number): void;
    skipToMilestone(milestoneId: string): string;
    setResource(resourceId: string, amount: number): void;
    saveSlot(slotName: string): void;
    loadSlot(slotName: string): void;
    slotNames(): string[];
    exportSave(): string;
    importSave(exported: string): void;
    resetGame(): void;
}

const timeScales: readonly number[] = [1, 10, 100, 1000];

const timeAwayOptions: readonly { readonly label: string; readonly seconds: number }[] = [
    { label: '+1m', seconds: 60 },
    { label: '+10m', seconds: 600 },
    { label: '+1h', seconds: 3_600 },
    { label: '+8h', seconds: 28_800 },
    { label: '+24h', seconds: 86_400 },
];

export class DevPanel {
    readonly element: HTMLElement;
    private readonly content: GameContent;
    private readonly commands: DevCommands;
    private readonly status: HTMLElement;
    private readonly slotSelect: HTMLSelectElement;

    constructor(content: GameContent, commands: DevCommands) {
        this.content = content;
        this.commands = commands;
        this.status = createElement('p', { className: 'dev-status' });
        this.slotSelect = createElement('select');
        this.element = createElement('aside', { className: 'dev-panel' }, [
            createElement('h2', { text: 'Dev tools' }),
            this.createSpeedRow(),
            this.createTimeAwayRow(),
            this.createSkipRow(),
            this.createResourceRow(),
            this.createSlotRows(),
            this.createSaveStringRow(),
            createRow('', [createButton('Reset game', () => this.confirmReset())]),
            this.status,
        ]);
        this.element.hidden = true;
    }

    toggle(): void {
        this.element.hidden = !this.element.hidden;
        if (!this.element.hidden) {
            this.refreshSlotNames();
        }
    }

    private createSpeedRow(): HTMLElement {
        const buttons = timeScales.map((timeScale) =>
            createButton(`×${timeScale}`, () =>
                this.run(() => {
                    this.commands.setTimeScale(timeScale);
                    return `Speed set to ×${timeScale}.`;
                }),
            ),
        );
        return createRow('Speed', buttons);
    }

    private createTimeAwayRow(): HTMLElement {
        const buttons = timeAwayOptions.map(({ label, seconds }) =>
            createButton(label, () =>
                this.run(() => {
                    this.commands.advance(seconds);
                    return `Simulated ${label.slice(1)} away.`;
                }),
            ),
        );
        return createRow('Time away', buttons);
    }

    private createSkipRow(): HTMLElement {
        const milestoneSelect = createSelect(this.content.milestones.map((milestone) => [milestone.id, milestone.name]));
        const skipButton = createButton('Skip', () => this.run(() => this.commands.skipToMilestone(milestoneSelect.value)));
        return createRow('Skip to', [milestoneSelect, skipButton]);
    }

    private createResourceRow(): HTMLElement {
        const resourceSelect = createSelect(this.content.resources.map((resource) => [resource.id, resource.name]));
        const amountInput = createElement('input', { attributes: { type: 'number', value: '1000', 'aria-label': 'Amount' } });
        const setButton = createButton('Set', () =>
            this.run(() => {
                this.commands.setResource(resourceSelect.value, Number(amountInput.value));
                return `Set ${resourceSelect.value} to ${amountInput.value}.`;
            }),
        );
        return createRow('Resource', [resourceSelect, amountInput, setButton]);
    }

    private createSlotRows(): HTMLElement {
        const nameInput = createElement('input', { attributes: { placeholder: 'slot name', 'aria-label': 'Slot name' } });
        const saveButton = createButton('Save', () =>
            this.run(() => {
                const slotName = nameInput.value.trim() || 'quick';
                this.commands.saveSlot(slotName);
                this.refreshSlotNames();
                return `Saved to slot "${slotName}".`;
            }),
        );
        const loadButton = createButton('Load', () =>
            this.run(() => {
                this.commands.loadSlot(this.slotSelect.value);
                return `Loaded slot "${this.slotSelect.value}".`;
            }),
        );
        return createElement('div', {}, [
            createRow('Save slot', [nameInput, saveButton]),
            createRow('Load slot', [this.slotSelect, loadButton]),
        ]);
    }

    private createSaveStringRow(): HTMLElement {
        const saveText = createElement('textarea', { attributes: { rows: '3', 'aria-label': 'Save string' } });
        const exportButton = createButton('Export', () =>
            this.run(() => {
                saveText.value = this.commands.exportSave();
                saveText.select();
                return 'Exported. The save string is selected.';
            }),
        );
        const importButton = createButton('Import', () =>
            this.run(() => {
                this.commands.importSave(saveText.value);
                return 'Imported.';
            }),
        );
        return createRow('Save string', [saveText, exportButton, importButton]);
    }

    private confirmReset(): void {
        if (confirm('Reset the game? The autosave is deleted; save slots are kept.')) {
            this.run(() => {
                this.commands.resetGame();
                return 'Game reset.';
            });
        }
    }

    private refreshSlotNames(): void {
        const options = this.commands.slotNames().map((slotName) => createElement('option', { text: slotName, attributes: { value: slotName } }));
        this.slotSelect.replaceChildren(...options);
    }

    private run(command: () => string): void {
        try {
            setText(this.status, command());
        } catch (error) {
            setText(this.status, error instanceof Error ? error.message : String(error));
        }
    }
}

function createRow(label: string, controls: readonly HTMLElement[]): HTMLElement {
    return createElement('div', { className: 'dev-row' }, [createElement('span', { className: 'dev-label', text: label }), ...controls]);
}

function createSelect(options: readonly (readonly [value: string, label: string])[]): HTMLSelectElement {
    return createElement(
        'select',
        {},
        options.map(([value, label]) => createElement('option', { text: label, attributes: { value } })),
    );
}
