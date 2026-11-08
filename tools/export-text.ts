import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as text from '../src/content/act-one/text.ts';
import { findings } from '../src/content/act-one/findings.ts';
import { vocabulary } from '../src/content/act-one/generated/vocabulary.ts';
import { actOneContent } from '../src/content/act-one/index.ts';
import { entrance, levelPage } from '../src/content/act-one/levels.ts';
import { riddleOrigin, startUrl } from '../src/content/act-one/riddle.ts';
import { planSearch, searchCapabilities } from '../src/content/act-one/search.ts';
import { upgrades } from '../src/content/act-one/upgrades.ts';
import { folderNames, subjects } from '../src/content/act-one/word-lists.ts';
import { createInitialState } from '../src/core/state.ts';

type TextEntry = readonly [key: string, value: string];

const outputUrl = new URL('../docs/text-inventory.md', import.meta.url);
const tabledGroups = new Set(['browserName', 'upgradeText', 'findingText']);
const pageColumns = ['Page', 'URL', 'Title', 'Visible text', 'Source comments', 'Hidden text', 'Image name', 'Next URL'];
const sections: string[] = [
    '# Act I text inventory',
    'A read-only view of every player-facing string, generated with `npm run export-text`. Edit wording in [text.ts](../src/content/act-one/text.ts), the one file that holds it, then regenerate. This file contains puzzle answers and belongs in the ignored `docs/` folder.',
    'Placeholders in `{braces}` are filled in at runtime.',
    '## Names and addresses',
    table(['Key', 'Text'], [['browserName', text.browserName], ['riddleOrigin', riddleOrigin], ['startUrl', startUrl]]),
];

let stringCount = 0;
for (const [group, value] of Object.entries(text)) {
    if (tabledGroups.has(group)) continue;
    const entries = flattenText(group, value);
    if (entries.length === 0) continue;
    stringCount += entries.length;
    sections.push(`## ${group}`, table(['Key', 'Text'], entries));
}

const totalWeight = findings.reduce((sum, finding) => sum + finding.weight, 0);
sections.push('## upgradeText', 'Cards in the order the game lists them. Cost and level come from [upgrades.ts](../src/content/act-one/upgrades.ts).',
    table(['ID', 'Name', 'Description', 'Cost', 'From level'], upgrades.map((item) => [
        item.id, item.name, item.description ?? '',
        Object.entries(item.price).map(([resource, amount]) => resource === 'money' ? `$${amount.toLocaleString('en-US')}` : `${amount.toLocaleString('en-US')} ${resource}`).join(' · '),
        String(item.level),
    ])),
    '## findingText', 'Chances are conditional on a finding dropping. Rarity and weight come from [findings.ts](../src/content/act-one/findings.ts).',
    table(['ID', 'File', 'Rarity', 'Chance', 'Description'], findings.map((item) => [
        item.id, item.path, item.rarity, `${(item.weight / totalWeight * 100).toFixed(2)}%`, item.description,
    ])),
    ...findings.flatMap((finding) => [`### File contents: ${finding.path}`, codeBlock(finding.file)]),
    '## Handcrafted opening',
    'Each page holds the clue for the next entrance. The URL, hidden text, comments and image filename are part of the puzzle. Levels are defined in [levels.ts](../src/content/act-one/levels.ts).',
    table(pageColumns, Array.from({ length: 9 }, (_, index) => pageRow(index + 1))),
    '## Generated-page examples',
    'One example of each answer family from the fixed riddle seed, plus a few landmark levels. Not the complete set.',
    table(pageColumns, generatedExamples().map(pageRow)),
    '## Search phase labels',
    'Built from `searchText` with wordlist names, collected from levels 6–1400 with representative upgrades.',
    codeBlock(searchLabels().join('\n')),
    '## Generated word pools',
    'These words can appear in answers, page titles, filenames, hidden clues, captcha prompts and terminal requests. Sources: [word-lists.ts](../src/content/act-one/word-lists.ts) and [generated/vocabulary.ts](../src/content/act-one/generated/vocabulary.ts).',
    '### Folder names', codeBlock(folderNames.join(', ')),
    '### Picture subjects', table(['Subject', 'Category'], subjects.map((subject) => [subject.word, subject.category])),
    `### Vocabulary (${vocabulary.length} entries)`,
    'Generated from wallpaper labels by [build-assets.ts](../tools/build-assets.ts). A short sample:',
    codeBlock(wordLines(vocabulary.slice(0, 36))),
    '## Save import messages',
    'These stay in [save.ts](../src/persistence/save.ts) because the save format is shared by every act.',
    table(['Source location', 'Message or expression'], await saveMessages()),
);

const markdown = `${sections.join('\n\n')}\n`;
if (process.argv.includes('--check')) {
    if (await readFile(outputUrl, 'utf8') !== markdown) throw new Error('Text inventory is out of date. Run npm run export-text.');
    console.log('Text inventory is up to date.');
} else {
    await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
    await writeFile(outputUrl, markdown, 'utf8');
    console.log(`Exported ${stringCount} strings, ${upgrades.length} upgrades, ${findings.length} findings and generated pages to docs/text-inventory.md.`);
}

function flattenText(key: string, value: unknown): TextEntry[] {
    if (typeof value === 'string') return [[key, value]];
    if (value === null || typeof value !== 'object') return [];
    return Object.entries(value).flatMap(([child, entry]) => flattenText(`${key}.${child}`, entry));
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
    return [headers, headers.map(() => '---'), ...rows].map((row) => `| ${row.map(cell).join(' | ')} |`).join('\n');
}

function cell(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '&#124;').replaceAll('`', '&#96;').replaceAll('\r', '').replaceAll('\n', '<br>') || '—';
}

function codeBlock(value: string): string {
    const longestFence = Math.max(2, ...[...value.matchAll(/`+/g)].map((match) => match[0].length));
    const fence = '`'.repeat(longestFence + 1);
    return `${fence}text\n${value}\n${fence}`;
}

function pageRow(level: number): readonly string[] {
    const page = levelPage(level);
    return [String(level), page.url, page.title, page.lines.join('\n'), page.comments.join('\n'), page.hiddenText ?? '', page.imageName, entrance(level + 1).url];
}

function generatedExamples(): number[] {
    const examples = new Map<string, number>();
    for (let level = 10; level < 1400; level++) {
        const kind = entrance(level + 1).kind;
        if (!examples.has(kind)) examples.set(kind, level);
    }
    return [...new Set([...examples.values(), 99, 199, 404, 418])].sort((first, second) => first - second);
}

function searchLabels(): string[] {
    const state = createInitialState(actOneContent, 1);
    for (const upgrade of upgrades) state.purchases[upgrade.id] = 1;
    const complete = searchCapabilities(state);
    const variants = [complete, { ...complete, cracked: false }, { ...complete, mutations: false },
        { ...complete, lists: complete.lists.slice(0, 1), mutations: false, rockyou: false, numberRanges: false, cracked: false, combinator: false }];
    const labels = new Set<string>();
    for (let level = 6; level <= 1400; level++) {
        for (const capabilities of variants) for (const phase of planSearch(level, capabilities).phases) labels.add(phase.label);
    }
    return [...labels].sort();
}

function wordLines(words: readonly string[]): string {
    const lines: string[] = [];
    for (let index = 0; index < words.length; index += 12) lines.push(words.slice(index, index + 12).join(', '));
    return lines.join('\n');
}

async function saveMessages(): Promise<TextEntry[]> {
    const source = await readFile(new URL('../src/persistence/save.ts', import.meta.url), 'utf8');
    return source.split(/\r?\n/).flatMap((line, index) => {
        const match = line.match(/throw new SaveError\((.+)\);/);
        return match ? [[`src/persistence/save.ts:${index + 1}`, match[1]!] as const] : [];
    });
}
