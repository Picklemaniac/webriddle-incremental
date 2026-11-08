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
const sections: string[] = [
    '# Act I text inventory',
    'Generated from the current game with `node tools/export-text.ts`. All draft wording is subject to Picklemaniac’s review. This file contains puzzle answers and belongs in the ignored `docs/` folder.',
    'Use the keys and source paths to identify changes. Regenerating replaces this file, so apply approved edits to the source before exporting again. Costs and odds below are read from the same definitions the game uses.',
    '## Names and addresses',
    table(['Key', 'Text'], [['browserName', text.browserName], ['riddleOrigin', riddleOrigin], ['startUrl', startUrl]]),
    '## Interface, notices, dialogs, and clue wording',
    'Source: [text.ts](../src/content/act-one/text.ts). This includes exported draft strings that may not yet be used by a control.',
];

let stringCount = 0;
for (const [group, value] of Object.entries(text)) {
    if (group === 'browserName') continue;
    const entries = flattenText(group, value);
    if (entries.length === 0) continue;
    stringCount += entries.length;
    sections.push(`### ${group}`, table(['Key', 'Text'], entries));
}

sections.push('## Upgrade cards', 'Source: [upgrades.ts](../src/content/act-one/upgrades.ts).',
    table(['ID', 'Name', 'Description', 'Cost'], upgrades.map((item) => [
        item.id, item.name, item.description ?? '',
        Object.entries(item.price).map(([resource, amount]) => resource === 'money' ? `$${amount.toLocaleString('en-US')}` : `${amount.toLocaleString('en-US')} ${resource}`).join(' · '),
    ])),
    '## Findings', 'Source: [findings.ts](../src/content/act-one/findings.ts). Percentages are conditional on a finding dropping.',
    table(['ID', 'File', 'Rarity', 'Chance', 'Description'], findings.map((item) => [
        item.id, item.path, item.rarity,
        `${(item.weight / findings.reduce((sum, finding) => sum + finding.weight, 0) * 100).toFixed(2)}%`,
        item.description,
    ])));

for (const finding of findings) sections.push(`### File contents: ${finding.path}`, codeBlock(finding.fileContent));

sections.push('## Handcrafted opening',
    'Source: [levels.ts](../src/content/act-one/levels.ts). Each page holds the clue for the next entrance. The URL, hidden text, comments and image filename are part of the puzzle.',
    table(['Page', 'URL', 'Title', 'Visible text', 'Source comment', 'Hidden text', 'Image name', 'Next URL'],
        Array.from({ length: 9 }, (_, index) => pageRow(index + 1))),
    '## Generated-page examples',
    'These examples are generated from the fixed riddle seed. They illustrate each answer family; they are not the complete set of generated pages.',
    table(['Page', 'URL', 'Title', 'Visible text', 'Source comment', 'Hidden text', 'Image name', 'Next URL'], generatedExamples().map(pageRow)),
    '## Search phase labels',
    'Source: [search.ts](../src/content/act-one/search.ts). Collected from levels 6–1400 with representative wordlists and capabilities. Numbers, folder names, and wordlist names are variable parts of these labels.',
    codeBlock(searchLabels().join('\n')),
    '## Generated word pools',
    'Sources: [word-lists.ts](../src/content/act-one/word-lists.ts), [generated/vocabulary.ts](../src/content/act-one/generated/vocabulary.ts). These words can appear in answers, page titles, filenames, hidden clues, captcha prompts and sampled terminal requests.',
    '### Folder names', codeBlock(folderNames.join(', ')),
    '### Picture subjects', table(['Subject', 'Category'], subjects.map((subject) => [subject.word, subject.category])),
    `### Vocabulary (${vocabulary.length} entries)`,
    'The complete ordered vocabulary is in [generated/vocabulary.ts](../src/content/act-one/generated/vocabulary.ts). It is generated from wallpaper labels; change the filtering in [build-assets.ts](../tools/build-assets.ts) before rebuilding it. A short sample follows.',
    codeBlock(wordLines(vocabulary.slice(0, 36))),
    '## Resources and milestone labels',
    'Source: [index.ts](../src/content/act-one/index.ts). Milestone names appear in the developer panel and simulation reports.',
    table(['Key', 'Label'], [...actOneContent.resources.map((resource) => [`resource.${resource.id}`, resource.name]), ...actOneContent.milestones.map((milestone) => [`milestone.${milestone.id}`, milestone.name])]),
    '## Save import messages',
    'Source: [save.ts](../src/persistence/save.ts). Expressions inside `${…}` are substituted at runtime.',
    table(['Source location', 'Message or expression'], await saveMessages()),
    '## Runtime text templates',
    'The following source lines compose displayed text from the definitions above. They are included so punctuation, units, accessibility labels, browser titles and terminal formats remain reviewable. This appendix is a source audit, not additional prose shown in the game.',
    table(['Source location', 'Template or literal'], await runtimeTemplates()),
);

const markdown = `${sections.join('\n\n')}\n`;
if (process.argv.includes('--check')) {
    if (await readFile(outputUrl, 'utf8') !== markdown) throw new Error('Text inventory is out of date. Run node tools/export-text.ts.');
    console.log('Text inventory is up to date.');
} else {
    await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
    await writeFile(outputUrl, markdown, 'utf8');
    console.log(`Exported ${stringCount} central strings, ${upgrades.length} upgrades, ${findings.length} findings, and generated text to docs/text-inventory.md.`);
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
    return [String(level), page.url, page.title, page.lines.join('\n'), page.comment ?? '', page.hiddenText ?? '', page.imageName, entrance(level + 1).url];
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

async function runtimeTemplates(): Promise<TextEntry[]> {
    const paths = ['ui/browser-panel.ts', 'ui/status-panel.ts', 'ui/terminal-panel.ts', 'ui/purchases-panel.ts', 'ui/findings-panel.ts', 'ui/away-summary.ts', 'content/act-one/pages.ts', 'content/act-one/levels.ts'];
    const entries: TextEntry[] = [];
    for (const path of paths) {
        const source = await readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');
        for (const [index, line] of source.split(/\r?\n/).entries()) {
            if (!/[`'"]/.test(line)) continue;
            if (/\b(text:|title:|aria-label|\.title\s*=|document\.title|setText\(|this\.line\(|footer =|const command|\? `\$|: `\$|imageName:|comment:|hiddenText:|documentPage\(|const (checkbox|images|word) =)/.test(line)) {
                entries.push([`src/${path}:${index + 1}`, line.trim()]);
            }
        }
    }
    return entries;
}
