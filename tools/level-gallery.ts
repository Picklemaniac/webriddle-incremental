import { mkdir, writeFile } from 'node:fs/promises';
import { actOneContent } from '../src/content/act-one/index.ts';
import { entrance, levelPage, urlOfLevel } from '../src/content/act-one/levels.ts';
import { createInitialState } from '../src/core/state.ts';
import { escapeAttribute, escapeHtml } from './shared.ts';

const [first = 1, last = 60] = (process.argv[2] ?? '1-60').split('-').map(Number);
const state = createInitialState(actOneContent, 1);
const cards: string[] = [];
for (let level = first; level <= last; level++) {
    state.currentLevel = level;
    const page = actOneContent.resolvePage(urlOfLevel(level), state);
    const details = levelPage(level);
    const next = entrance(level + 1);
    const notes = [`next: ${next.kind}`, next.url.replace(/^https?:\/\/[^/]+/, ''), ...details.comments.map((comment) => `<!-- ${comment} -->`),
        ...(details.hiddenText === null ? [] : [`hidden: ${details.hiddenText}`]), ...(details.imageName === `${level}.jpg` ? [] : [`image: ${details.imageName}`])];
    cards.push(`<figure><iframe srcdoc="${escapeAttribute(page.html)}" title="Level ${level}"></iframe><figcaption><b>${escapeHtml(page.title ?? '')}</b><br>${notes.map(escapeHtml).join('<br>')}</figcaption></figure>`);
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Levels ${first}–${last}</title><style>
body{margin:16px;background:#0d0d0d;color:#aaa;font:12px Verdana,sans-serif}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
figure{margin:0}iframe{display:block;width:100%;aspect-ratio:460/400;border:1px solid #333;background:#000}
figcaption{padding:6px 2px;line-height:1.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}b{color:#ddd}
</style></head><body><main>${cards.join('')}</main></body></html>`;

await mkdir(new URL('../logs/', import.meta.url), { recursive: true });
await writeFile(new URL('../logs/level-gallery.html', import.meta.url), html, 'utf8');
console.log(`Wrote levels ${first}–${last} to logs/level-gallery.html. With the dev server running, open http://127.0.0.1:5173/logs/level-gallery.html`);
