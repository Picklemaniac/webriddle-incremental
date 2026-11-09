import { mkdir, writeFile } from 'node:fs/promises';
import { drawPicture, type DrawingKind } from '../src/content/act-one/drawings.ts';
import { characterColors } from '../src/content/act-one/encodings.ts';
import { levelPage } from '../src/content/act-one/levels.ts';
import { soundData, type Sound } from '../src/content/act-one/sounds.ts';
import { lastLevel, puzzleNames } from './level-text.ts';
import { escapeHtml } from './shared.ts';

interface Item {
    readonly key: string;
    readonly title: string;
    readonly usedBy: string;
    readonly note?: string;
    readonly body: string;
}

const sampleWord = 'bridge';
const alphabet = 'abcdefghijklmnopqrstuvwxyz';
const alphabetKinds = new Set<DrawingKind>(['semaphore', 'clocks', 'pigpen', 'flags', 'braille']);
const notes: Partial<Record<DrawingKind, string>> = {
    dark: 'Nearly black on purpose. You need to brighten it to read it.',
    transparent: 'Black text on a transparent background, so it disappears on the black page until you select it.',
    flash: 'Animated. The text shows for a moment every three seconds.',
    delayed: 'Animated. Blank for 21 seconds, then the text shows for 3.',
    shares: 'Overlay the two halves (difference blend) to read the text.',
    plain: 'On the page it is squashed to 3 pixels high. Opening the file shows it like this.',
};
const kinds: readonly DrawingKind[] = ['gift', 'semaphore', 'clocks', 'pigpen', 'flags', 'braille', 'plain', 'mirror', 'rotated', 'dark', 'transparent',
    'flash', 'delayed', 'pixels', 'bits', 'shares'];

const firstLevels = new Map<string, number>();
let firstGrid: readonly string[] = [];
for (let level = 1; level <= lastLevel; level++) {
    const page = levelPage(level);
    for (const file of page.files) {
        if ('drawing' in file.content && !firstLevels.has(file.content.drawing.kind)) firstLevels.set(file.content.drawing.kind, level);
        if ('sound' in file.content && !firstLevels.has(file.content.sound.kind)) firstLevels.set(file.content.sound.kind, level);
    }
    if (firstGrid.length === 0 && page.grid.length > 0) {
        firstGrid = page.grid;
        firstLevels.set('grid', level);
    }
    if (page.colors.length > 0 && !firstLevels.has('swatches')) firstLevels.set('swatches', level);
}

const items: Item[] = [
    ...kinds.map((kind) => ({
        key: kind,
        title: `${kind[0]!.toUpperCase()}${kind.slice(1)} picture`,
        usedBy: kind === 'gift' ? `${puzzleNames.alternate}` : kind === 'plain' ? `${puzzleNames.squashedPicture}, ${puzzleNames.renamed}` : puzzleNames[`${kind}Picture`] ?? kind,
        note: notes[kind],
        body: [image(kind, sampleWord), ...(alphabetKinds.has(kind) ? [image(kind, alphabet)] : [])].join(''),
    })),
    sound('Morse sound', puzzleNames.morseSound!, { kind: 'morse', text: sampleWord }),
    sound('Phone tones', puzzleNames.phoneTones!, { kind: 'tones', text: '1066' }),
    sound('Spectrogram sound', puzzleNames.spectrogram!, { kind: 'spectrogram', text: sampleWord }, 'Open it in a program that shows a spectrogram, such as Audacity.'),
    {
        key: 'swatches', title: 'Colour swatches', usedBy: puzzleNames.swatches!, body: `<div class="swatches">${characterColors(sampleWord).map((color) => `<span style="background:${color}"></span>`).join('')}</div>`,
    },
    { key: 'grid', title: 'Letter grid', usedBy: puzzleNames.letterGrid!, note: 'Search the page for the letter that draws the word.', body: `<pre>${escapeHtml(firstGrid.join('\n'))}</pre>` },
];

const firstLevelOf = (item: Item): string => {
    const level = firstLevels.get(item.key);
    return level === undefined ? 'not used yet' : `first on level ${level}`;
};

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Pictures</title><style>
body{margin:24px;background:#000;color:#aaa;font:13px/1.5 Verdana,sans-serif}
h1{margin:0 0 4px;font-size:20px;color:#fff}.intro{margin:0 0 24px;max-width:760px}
section{margin:0 0 28px;padding:0 0 20px;border-bottom:1px solid #222}
h2{margin:0 0 2px;font-size:15px;color:#fff}.meta{margin:0 0 4px}.note{margin:0 0 10px;color:#888}
img{display:block;margin:0 0 12px;max-width:100%;height:auto;image-rendering:pixelated}
audio{display:block;width:320px;color-scheme:dark}
.swatches{display:flex;gap:8px}.swatches span{width:26px;height:26px;border:1px solid #555}
pre{margin:0;font:13px/1.05 "Courier New",monospace;color:#bbb}
</style></head><body>
<h1>Pictures, sounds and other visual clues</h1>
<p class="intro">Every picture a generated level can show, numbered so you can refer to it. Each one shows the word "${sampleWord}", and the symbol alphabets also show a to z. Animated pictures run live. Regenerate this page with <code>npm run pictures</code>.</p>
${items.map((item, index) => `<section><h2>${index + 1}. ${escapeHtml(item.title)}</h2><p class="meta">${escapeHtml(item.usedBy)}, ${firstLevelOf(item)}</p>${item.note === undefined ? '' : `<p class="note">${escapeHtml(item.note)}</p>`}${item.body}</section>`).join('\n')}
</body></html>`;

await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
await writeFile(new URL('../docs/pictures.html', import.meta.url), html, 'utf8');
console.log(`Wrote ${items.length} pictures and sounds to docs/pictures.html. With the dev server running, open http://127.0.0.1:5173/docs/pictures.html`);

function image(kind: DrawingKind, text: string): string {
    const picture = drawPicture({ kind, text });
    return `<img src="${picture.src}" width="${picture.width}" height="${picture.height}" alt="">`;
}

function sound(title: string, usedBy: string, recording: Sound, note?: string): Item {
    return { key: recording.kind, title, usedBy, note, body: `<audio controls src="${soundData(recording)}"></audio>` };
}
