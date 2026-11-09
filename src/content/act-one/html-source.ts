const containers = new Set(['head', 'body', 'center', 'table', 'tr', 'td', 'th', 'ul', 'ol', 'map', 'div', 'form']);
const lineElements = new Set(['title', 'p', 'li', 'h1', 'h2', 'h3', 'script', 'address', 'small']);
const standalone = new Set(['meta', 'link', 'hr', 'area', 'base']);
const inline = new Set(['a', 'font', 'b', 'i', 'u', 'span', 'img', 'br', 'embed', 'input', 'button', 'strong', 'em', 'big', 'label']);

export const doctype = '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">';
export const contentType = '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">';

export function formatSource(html: string): string {
    const output: string[] = [];
    let depth = 0;
    let line: string | null = null;
    const indent = (): string => '\t'.repeat(depth);
    const finish = (): void => {
        if (line !== null) output.push(line.trimEnd());
        line = null;
    };
    const append = (text: string): void => {
        line = line === null ? `${indent()}${text.trimStart()}` : `${line}${text}`;
    };
    for (const token of html.match(/<!--[\s\S]*?-->|<pre[\s\S]*?<\/pre>|<[^>]+>|[^<]+/gi) ?? []) {
        const tag = /^<\/?([a-z][a-z0-9]*)/i.exec(token)?.[1]?.toLowerCase();
        const closing = token.startsWith('</');
        if (token.startsWith('<!') || tag === 'pre') {
            finish();
            output.push(`${indent()}${token}`);
        } else if (tag === undefined) {
            if (token.trim() !== '') append(token.replace(/\s+/g, ' '));
        } else if (tag === 'html') {
            finish();
            output.push(token);
        } else if (containers.has(tag)) {
            finish();
            if (closing) depth = Math.max(0, depth - 1);
            output.push(`${indent()}${token}`);
            if (!closing) depth++;
        } else if (standalone.has(tag)) {
            finish();
            output.push(`${indent()}${token}`);
        } else if (lineElements.has(tag) || !inline.has(tag)) {
            if (!closing) finish();
            append(token);
            if (closing) finish();
        } else {
            append(token);
        }
    }
    finish();
    return output.join('\n');
}
