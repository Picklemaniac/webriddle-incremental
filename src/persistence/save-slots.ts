import type { GameState } from '../core/state.ts';
import { parseSave, serializeSave, type SaveEnvelope } from './save.ts';

export const autosaveSlotName = 'autosave';

export type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export class SaveSlots {
    private readonly storage: KeyValueStorage;
    private readonly keyPrefix: string;

    constructor(storage: KeyValueStorage, keyPrefix: string) {
        this.storage = storage;
        this.keyPrefix = keyPrefix;
    }

    write(slotName: string, state: GameState, savedAt: number): void {
        this.writeSerialized(slotName, serializeSave(state, savedAt));
    }

    writeSerialized(slotName: string, serialized: string): void {
        this.storage.setItem(this.key(slotName), serialized);
    }

    read(slotName: string, defaults: GameState): SaveEnvelope | undefined {
        const serialized = this.readSerialized(slotName);
        return serialized === undefined ? undefined : parseSave(serialized, defaults);
    }

    readSerialized(slotName: string): string | undefined {
        return this.storage.getItem(this.key(slotName)) ?? undefined;
    }

    remove(slotName: string): void {
        this.storage.removeItem(this.key(slotName));
    }

    slotNames(): string[] {
        const names: string[] = [];
        for (let index = 0; index < this.storage.length; index++) {
            const key = this.storage.key(index);
            if (key?.startsWith(this.keyPrefix)) {
                names.push(key.slice(this.keyPrefix.length));
            }
        }
        return names.sort();
    }

    private key(slotName: string): string {
        return `${this.keyPrefix}${slotName}`;
    }
}
