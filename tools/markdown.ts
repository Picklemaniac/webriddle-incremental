export function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
    return [headers, headers.map(() => '---'), ...rows].map((row) => `| ${row.map(cell).join(' | ')} |`).join('\n');
}

export function codeBlock(value: string): string {
    const longestFence = Math.max(2, ...[...value.matchAll(/`+/g)].map((match) => match[0].length));
    const fence = '`'.repeat(longestFence + 1);
    return `${fence}text\n${value}\n${fence}`;
}

function cell(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '&#124;').replaceAll('`', '&#96;').replaceAll('\r', '').replaceAll('\n', '<br>') || '—';
}
