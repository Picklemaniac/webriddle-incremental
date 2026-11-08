import type { KeyValueStorage } from '../persistence/save-slots.ts';

export class MemoryStorage implements KeyValueStorage {
    private readonly items = new Map<string, string>();

    get length(): number {
        return this.items.size;
    }

    getItem(key: string): string | null {
        return this.items.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.items.set(key, value);
    }

    removeItem(key: string): void {
        this.items.delete(key);
    }

    key(index: number): string | null {
        return [...this.items.keys()][index] ?? null;
    }
}
