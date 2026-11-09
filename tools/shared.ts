export function readArgument(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    if (index === -1) return undefined;
    const value = process.argv[index + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for ${name}.`);
    return value;
}

export function escapeHtml(text: string): string {
    return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function escapeAttribute(text: string): string {
    return escapeHtml(text).replaceAll('"', '&quot;');
}

export function inRows<Item>(items: readonly Item[], perRow: number): Item[][] {
    return Array.from({ length: Math.ceil(items.length / perRow) }, (_, row) => items.slice(row * perRow, (row + 1) * perRow));
}
