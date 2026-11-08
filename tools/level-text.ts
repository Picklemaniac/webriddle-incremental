import { entrance, levelPage } from '../src/content/act-one/levels.ts';
import { alternateFiles, clueLines, handcraftedText, linkedFiles, methodHints, pageText, riddleHomeText } from '../src/content/act-one/text.ts';
import { table } from './markdown.ts';

interface Sighting {
    readonly level: number;
    readonly place: string;
}

interface Entry {
    readonly key: string;
    readonly text: string;
    readonly where?: string;
}

const lastLevel = 1400;

const puzzleNames: Readonly<Record<string, string>> = {
    reversed: 'Reversed text', a1z26: 'Letter numbers (A = 1)', rot13: 'ROT13', alternate: 'Same name as the picture as .gif, .txt, .json or .css',
    earlierAnswers: 'Letters from the names of earlier levels', xmlFile: 'Same name as the picture as .xml', wavFile: 'Same name as the picture as .wav', zipFile: 'Same name as the picture as .zip',
    atbash: 'Atbash', morse: 'Morse code', nato: 'NATO alphabet', capitals: 'Capital letters in a line of words', semaphorePicture: 'Semaphore picture',
    caesar: 'Caesar shift of 3', shift: 'Caesar shift of another amount', binary: 'Binary', upsideDown: 'Upside-down text', pigpenPicture: 'Pigpen picture',
    phone: 'Phone keypad presses', blinkPicture: 'Blinking light (animated Morse)', braille: 'Braille characters', mirrorPicture: 'Mirrored picture of the text',
    acrostic: 'First letters of words', lastLetters: 'Last letters of words', polybius: 'Polybius square', flagsPicture: 'Signal flags picture', tap: 'Tap code',
    script: 'Password check in a linked .js file', keyboard: 'Keyboard shift', swatches: 'Colour swatches (letter codes as colours)',
    braillePicture: 'Braille picture', hex: 'Hexadecimal', vigenere: 'Vigenère, with the key as the title', ascii: 'ASCII codes', bitsPicture: 'Binary grid picture',
    bacon: 'Baconian cipher', morseSound: 'Morse sound file', dna: 'DNA bases', pixelsPicture: 'Coloured pixels picture', url: 'URL encoding',
    railFence: 'Rail fence', entities: 'HTML entities', octal: 'Octal', elements: 'Atomic numbers spelling element symbols', roman: 'Roman numerals',
    rot47: 'ROT47', base64: 'Base64', darkPicture: 'Nearly black picture', arithmetic: 'Sums of letter codes', codepoints: 'String.fromCharCode',
    adfgvx: 'ADFGVX', pollux: 'Pollux', dvorak: 'Typed on a Dvorak keyboard', flashPicture: 'Picture that flashes the text for a moment', layered: 'Two encodings on top of each other', phoneTones: 'Phone tones sound file', sum: 'A sum',
};

const fileTypes: Readonly<Record<string, string>> = { 'linkedFiles.script': 'js', 'linkedFiles.stylesheet': 'css' };

export function levelTextDocument(): string {
    const sightings = collectSightings();
    let number = 0;
    const numbers = new Map<string, number>();
    const rows = (entries: readonly Entry[]): string[][] => entries.map((entry) => {
        numbers.set(entry.key, ++number);
        return [String(number), entry.text, entry.where ?? describe(sightings.get(entry.key) ?? [])];
    });
    const otherLines = [...entries('clueLines', clueLines), ...entries('pageText', pageText)].map((entry) => (entry.key === 'pageText.wildcardPage'
        ? { ...entry, where: 'Any page that does not exist inside the folders that answer every request' } : entry));
    const textSections = [
        '## Opening levels',
        table(['#', 'Text', 'Where it appears'], rows(entries('handcraftedText', handcraftedText))),
        '## Hints page',
        table(['#', 'Text', 'Where it appears'], rows([
            ...riddleHomeText.hints.map((hint, index) => ({ key: `riddleHomeText.hints.${index}`, text: hint, where: `Hints page, the hint for level ${index + 1}` })),
            { key: 'riddleHomeText.moreHints', text: riddleHomeText.moreHints, where: 'Hints page, under the list' },
        ])),
        '## Puzzle hints',
        'A line or title that points at how the clue is hidden or encoded.',
        table(['#', 'Text', 'Where it appears'], rows(entries('methodHints', methodHints))),
        '## Other lines',
        table(['#', 'Text', 'Where it appears'], rows(otherLines)),
        '## File contents',
        'Placeholders in `{braces}` are filled in for each level.',
        table(['#', 'File', 'Where it appears'], rows([...entries('alternateFiles', alternateFiles), ...entries('linkedFiles', linkedFiles)])),
    ];
    return [
        '# Level text',
        `Every piece of level-specific text, numbered so you can refer to it. The numbers follow the order in [text.ts](../src/content/act-one/text.ts). Generated with \`npm run export-text\` from levels 1 to ${lastLevel}. This file contains puzzle answers and belongs in the ignored \`docs/\` folder.`,
        ...textSections,
        '## Puzzle types',
        'Every way a generated level can encode its answer, in the order they first appear. A hint number refers to the numbered text above.',
        table(['Puzzle', 'First level', 'Levels', 'Hints'], puzzleRows(sightings, numbers)),
        '## Hiding places',
        'Where the encoded clue can end up on a page.',
        table(['Place', 'First level', 'Levels'], placeRows()),
    ].join('\n\n');
}

function entries(group: string, values: object): Entry[] {
    return Object.entries(values).flatMap(([key, value]) => typeof value === 'string'
        ? [{ key: `${group}.${key}`, text: value }]
        : (value as readonly string[]).map((text, index) => ({ key: `${group}.${key}.${index}`, text })));
}

function collectSightings(): Map<string, Sighting[]> {
    const patterns = [
        ...entries('handcraftedText', handcraftedText), ...entries('methodHints', methodHints), ...entries('clueLines', clueLines),
        ...entries('pageText', pageText), ...entries('alternateFiles', alternateFiles), ...entries('linkedFiles', linkedFiles),
    ].map((entry) => ({
        key: entry.key,
        fileType: entry.key.startsWith('alternateFiles.') ? entry.key.split('.')[1] : fileTypes[entry.key],
        pattern: new RegExp(`^${entry.text.split(/\{\w+\}/).map(escapeRegExp).join('[\\s\\S]*?')}$`),
    }));
    const sightings = new Map<string, Sighting[]>();
    for (let level = 1; level <= lastLevel; level++) {
        const page = levelPage(level);
        const places: { place: string; value: string | null; fileType?: string }[] = [
            { place: 'Title', value: page.title }, ...page.lines.map((value) => ({ place: 'Line under the picture', value })),
            ...page.comments.map((value) => ({ place: 'Comment in the source', value })), { place: 'Comment far down the source', value: page.farComment },
            { place: 'Hidden text', value: page.hiddenText },
            { place: 'Picture tooltip', value: page.imageTitle }, ...page.belowFold.map((value) => ({ place: 'Text far below the picture', value })),
            { place: 'Meta tag in the source', value: page.meta },
            ...page.files.flatMap((file) => {
                const fileType = file.name.split('.').pop()!;
                return 'text' in file.content ? [{ place: `The .${fileType} file`, value: file.content.text, fileType }] : [];
            }),
        ];
        for (const { place, value, fileType } of places) {
            if (value === null) continue;
            for (const pattern of patterns) {
                if (pattern.fileType === fileType && pattern.pattern.test(value)) sightings.set(pattern.key, [...(sightings.get(pattern.key) ?? []), { level, place }]);
            }
        }
    }
    return sightings;
}

function describe(sightings: readonly Sighting[]): string {
    if (sightings.length === 0) return 'Not shown on any level yet';
    const places = [...new Set(sightings.map((sighting) => sighting.place))];
    const levels = sightings.slice(0, 4).map((sighting) => sighting.level).join(', ');
    const rest = sightings.length > 4 ? `, and ${sightings.length - 4} more` : '';
    return `${places.join(', ')}. Level${sightings.length === 1 ? '' : 's'} ${levels}${rest}`;
}

function puzzleRows(sightings: ReadonlyMap<string, readonly Sighting[]>, numbers: ReadonlyMap<string, number>): string[][] {
    const hintsByLevel = new Map<number, number[]>();
    for (const [key, list] of sightings) {
        if (!key.startsWith('methodHints.') || key === 'methodHints.imageNote') continue;
        for (const { level } of list) hintsByLevel.set(level, [...(hintsByLevel.get(level) ?? []), numbers.get(key)!]);
    }
    const puzzles = new Map<string, { first: number; count: number; hints: Map<number, number> }>();
    for (let level = 11; level <= lastLevel; level++) {
        const method = entrance(level + 1).clue.method;
        if (method === undefined) continue;
        const puzzle = puzzles.get(method) ?? { first: level, count: 0, hints: new Map<number, number>() };
        puzzle.count++;
        for (const hint of hintsByLevel.get(level) ?? []) puzzle.hints.set(hint, (puzzle.hints.get(hint) ?? 0) + 1);
        puzzles.set(method, puzzle);
    }
    return [...puzzles].map(([method, puzzle]) => [puzzleNames[method] ?? method, String(puzzle.first), String(puzzle.count),
        [...puzzle.hints.keys()].sort((first, second) => first - second).join(', ')]);
}

function placeRows(): string[][] {
    const hints = new Set<string>(Object.values(methodHints));
    const places = new Map<string, { first: number; count: number }>();
    for (let level = 11; level <= lastLevel; level++) {
        const page = levelPage(level);
        const clue = entrance(level + 1).clue;
        const found = [
            clue.lines?.some((line) => !hints.has(line)) === true && 'Lines under the picture', clue.comment !== undefined && 'Comment in the source',
            clue.farComment !== undefined && 'Comment far down the source',
            clue.title !== undefined && !hints.has(clue.title) && 'Title',
            clue.hiddenText !== undefined && 'Black text on the black page', clue.imageTitle !== undefined && 'Picture tooltip', clue.belowFold !== undefined && 'Far below the picture',
            clue.meta !== undefined && 'Meta tag in the source', clue.stylesheet !== undefined && 'Comment in a linked .css file',
            clue.imageName !== undefined && !/\.\w+\.jpg$/.test(clue.imageName) && 'Name of the picture file', clue.imageNote !== undefined && 'Inside the picture file',
            ...page.files.map((file) => file.linked === 'image' ? 'Extra picture under the photo' : file.linked === 'sound' ? 'Sound file on the page' : file.linked === null ? 'File with the same name as the picture' : false),
        ].filter((place): place is string => typeof place === 'string');
        for (const place of new Set(found)) {
            const entry = places.get(place) ?? { first: level, count: 0 };
            entry.count++;
            places.set(place, entry);
        }
    }
    return [...places].map(([place, { first, count }]) => [place, String(first), String(count)]);
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
