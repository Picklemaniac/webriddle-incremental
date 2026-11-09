import { entrance, levelPage, type LevelPage } from '../src/content/act-one/levels.ts';
import type { Clue } from '../src/content/act-one/methods.ts';
import { alternateFiles, clueLines, handcraftedText, linkedFiles, pageText, puzzleHints, riddleHomeText } from '../src/content/act-one/text.ts';
import { table } from './markdown.ts';

interface Entry {
    readonly key: string;
    readonly text: string;
}

interface Survey {
    readonly level: number;
    readonly page: LevelPage;
    readonly clue: Clue;
    readonly kind: string;
    readonly texts: ReadonlyMap<string, string>;
}

const lastLevel = 1400;

export const puzzleNames: Readonly<Record<string, string>> = {
    reversed: 'Reversed text', a1z26: 'Letter numbers (A = 1)', rot13: 'ROT13', alternate: 'Same name as the picture as .gif, .txt, .json or .css',
    earlierAnswers: 'Letters from the names of earlier levels', xmlFile: 'Same name as the picture as .xml', wavFile: 'Same name as the picture as .wav', zipFile: 'Same name as the picture as .zip',
    atbash: 'Atbash', morse: 'Morse code', nato: 'NATO alphabet', capitals: 'Capital letters in a line of words', semaphorePicture: 'Semaphore picture',
    caesar: 'Caesar shift of 3', shift: 'Caesar shift of another amount', binary: 'Binary', upsideDown: 'Upside-down text', pigpenPicture: 'Pigpen picture',
    phone: 'Phone keypad presses', braille: 'Braille characters', mirrorPicture: 'Mirrored picture of the text',
    acrostic: 'First letters of words', lastLetters: 'Last letters of words', polybius: 'Polybius square', flagsPicture: 'Signal flags picture', tap: 'Tap code',
    script: 'Password check in a linked .js file', keyboard: 'Keyboard shift', swatches: 'Colour swatches (letter codes as colours)',
    braillePicture: 'Braille picture', hex: 'Hexadecimal', vigenere: 'Vigenère, with the key as the title', ascii: 'ASCII codes', bitsPicture: 'Binary grid picture',
    bacon: 'Baconian cipher', morseSound: 'Morse sound file', dna: 'DNA bases', pixelsPicture: 'Coloured pixels picture', url: 'URL encoding',
    railFence: 'Rail fence', entities: 'HTML entities', octal: 'Octal', elements: 'Atomic numbers spelling element symbols', roman: 'Roman numerals',
    rot47: 'ROT47', base64: 'Base64', darkPicture: 'Nearly black picture', arithmetic: 'Sums of letter codes', codepoints: 'String.fromCharCode',
    scrambled: 'Shuffled letters, put in order by class names in the source', letterGrid: 'Grid of letters where one letter draws the word',
    squashedPicture: 'Picture squashed flat by the page', keyboardGrid: 'Keyboard coordinates', transparentPicture: 'Black text on a transparent picture',
    base36: 'Base 36', renamed: 'Text file that is really a GIF', spectrogram: 'Text drawn in the spectrogram of a sound',
    interleaved: 'Two lines with every other letter', boldLetters: 'Bold letters in a line of words', clocksPicture: 'Clock faces whose hands are semaphore flags',
    fakeTags: 'Initials of made-up tags in the source', spacers: 'Widths of invisible spacer images', rotatedPicture: 'Picture of the text upside down',
    caselessBase64: 'Base64 in lower case, with the capital positions in a comment', utf16: 'Text read in the wrong encoding',
    sharesPicture: 'Two noise pictures that show the text when overlaid', delayedPicture: 'Picture that shows the text after a long wait',
    adfgvx: 'ADFGVX', pollux: 'Pollux', dvorak: 'Typed on a Dvorak keyboard', flashPicture: 'Picture that flashes the text for a moment',
    layered: 'Two encodings on top of each other', phoneTones: 'Phone tones sound file', sum: 'A sum',
};

const openingPuzzles: Readonly<Record<number, string>> = {
    1: 'The picture links to the next level', 2: 'The next page has the next number', 3: 'The answer is in a source comment', 4: 'Black text on the black page',
    5: 'Binary', 6: 'The picture as a .gif file', 7: 'The answer is the picture tooltip', 8: 'ROT13', 9: 'Reversed text', 404: 'Easter egg', 418: 'Easter egg',
};

const placeHints: Readonly<Record<string, keyof typeof puzzleHints>> = {
    'Inside the picture file': 'imageNote',
    'Zip file stuck to the end of the picture': 'zipped',
    'Page behind an invisible link on the picture': 'hotspot',
    'Picture at zero size, only in the source': 'hiddenPicture',
};

const answerTypes: readonly { readonly name: string; readonly hints: readonly string[]; readonly matches: (survey: Survey) => boolean }[] = [
    { name: 'Another file extension than .htm', hints: ['clueLines.extension.0', 'clueLines.extension.1', 'clueLines.extension.2'], matches: (survey) => survey.kind === 'extension' },
    { name: 'A name that is in no wordlist', hints: [], matches: (survey) => survey.kind === 'name' },
    { name: 'A word with digits for some letters', hints: [], matches: (survey) => survey.kind === 'leet' },
    { name: 'A year', hints: [], matches: (survey) => survey.kind === 'number' },
    { name: 'A user name and password', hints: ['clueLines.credentials.0', 'clueLines.credentials.1', 'clueLines.credentials.2'], matches: (survey) => survey.kind === 'credentials' },
    { name: 'Two words written together', hints: [], matches: (survey) => survey.kind === 'twoWords' },
    { name: 'A whole phrase', hints: [], matches: (survey) => survey.kind === 'phrase' },
    { name: 'The next level is in a new folder', hints: ['pageText.folderComment'], matches: (survey) => survey.texts.has('pageText.folderComment') },
    { name: 'A folder that answers every request', hints: ['pageText.wildcardPage'], matches: (survey) => entrance(survey.level + 1).wildcard },
];

const fileUses: Readonly<Record<string, string>> = {
    'alternateFiles.txt': 'Same name as the picture as .txt', 'alternateFiles.json': 'Same name as the picture as .json',
    'alternateFiles.css': 'Same name as the picture as .css', 'alternateFiles.xml': 'Same name as the picture as .xml',
    'alternateFiles.zip': 'Same name as the picture as .zip, and the zip stuck to the end of the picture',
    'linkedFiles.script': 'Password check in a linked .js file', 'linkedFiles.stylesheet': 'Comment in a linked .css file',
};

export function levelTextDocument(): string {
    const surveys = surveyLevels();
    const texts = new Map([...textEntries()].map((entry) => [entry.key, entry.text]));
    const numbers = new Map<string, number>();
    const numbered = (key: string, where?: string): string => {
        if (!numbers.has(key)) numbers.set(key, numbers.size + 1);
        return `${numbers.get(key)}. ${texts.get(key)}${where === undefined ? '' : ` (${where.toLowerCase()})`}`;
    };
    const lines = (items: readonly string[]): string => items.join('\n') || '—';

    const openingRows = [
        ...Object.entries(openingPuzzles).map(([level, puzzle]) => {
            const survey = surveys[Number(level) - 1]!;
            const shown = [...survey.texts].filter(([key]) => key.startsWith('handcraftedText.')).map(([key, where]) => numbered(key, where));
            const hint = riddleHomeText.hints[Number(level) - 1];
            return [level, puzzle, lines(shown), hint === undefined ? '—' : numbered(`riddleHomeText.hints.${Number(level) - 1}`)];
        }),
        ['—', 'The hints page, under the list', '—', numbered('riddleHomeText.moreHints')],
    ];

    const methods = new Map<string, Survey[]>();
    for (const survey of surveys) {
        const method = survey.clue.method;
        if (survey.level >= 11 && method !== undefined) methods.set(method, [...(methods.get(method) ?? []), survey]);
    }
    const placeGroups = new Set<string>(Object.values(placeHints));
    const variants = (group: string, where?: string): string[] => (puzzleHints[group as keyof typeof puzzleHints] ?? []).map((_, index) => numbered(`puzzleHints.${group}.${index}`, where));
    const puzzleRows = [...methods].map(([method, list]) => {
        const groups = new Map<string, string>();
        for (const survey of list) {
            for (const [key, where] of survey.texts) {
                const group = key.split('.')[1]!;
                if (key.startsWith('puzzleHints.') && !placeGroups.has(group) && !groups.has(group)) groups.set(group, where);
            }
        }
        return [puzzleNames[method] ?? method, String(list[0]!.level), lines([...groups].flatMap(([group, where]) => variants(group, where))), exampleOf(list[0]!)];
    });

    const places = new Map<string, Survey[]>();
    for (const survey of surveys) {
        if (survey.level < 11) continue;
        for (const place of placesOf(survey)) places.set(place, [...(places.get(place) ?? []), survey]);
    }
    const placeRows = [...places].map(([place, list]) => [place, String(list[0]!.level), String(list.length),
        lines(placeHints[place] === undefined ? [] : variants(placeHints[place]!, 'Line under the picture'))]);

    const answerRows = answerTypes.map(({ name, hints, matches }) => {
        const first = surveys.find((survey) => survey.level >= 11 && matches(survey));
        return [name, first === undefined ? '—' : String(first.level), lines(hints.map((key) => numbered(key))), first === undefined ? '—' : `Level ${first.level}: the next page is ${entrance(first.level + 1).path}`];
    });

    const fileRows = [...textEntries()].filter((entry) => entry.key.startsWith('alternateFiles.') || entry.key.startsWith('linkedFiles.'))
        .map((entry) => [numbered(entry.key), fileUses[entry.key] ?? '—']);

    const unused = [...texts.keys()].filter((key) => !numbers.has(key)).map((key) => [numbered(key), key]);

    return [
        '# Level text',
        `Every piece of level-specific text, numbered so you can refer to it. The numbers run down the page, and a text that comes up twice keeps its first number. Edit wording in [text.ts](../src/content/act-one/text.ts), then run \`npm run export-text\`. Generated from levels 1 to ${lastLevel}. This file contains puzzle answers and belongs in the ignored \`docs/\` folder.`,
        '## Opening levels',
        'The text on each of the first levels, and its hint on the hints page.',
        table(['Level', 'Puzzle', 'Text on the level', 'Hints page'], openingRows),
        '## Puzzle types',
        'Every way a generated level can encode its answer, in the order they first appear, with the hints that go with it. The example is the first level that uses the puzzle.',
        table(['Puzzle', 'First level', 'Hints', 'Example'], puzzleRows),
        '## Hiding places',
        'Where the encoded clue can end up on a page. Most puzzle types can use any of these.',
        table(['Place', 'First level', 'Levels', 'Hint'], placeRows),
        '## Answers and folders',
        'Answers that are not a single word on an .htm page, and the folders the levels move into.',
        table(['Answer', 'First level', 'Hints', 'Example'], answerRows),
        '## File contents',
        'Placeholders in `{braces}` are filled in for each level.',
        table(['Contents', 'Used by'], fileRows),
        ...(unused.length === 0 ? [] : ['## Not used on any level yet', table(['Text', 'Key'], unused)]),
    ].join('\n\n');
}

function textEntries(): Entry[] {
    return [
        ...entries('handcraftedText', handcraftedText), ...entries('puzzleHints', puzzleHints), ...entries('clueLines', clueLines), ...entries('pageText', pageText),
        ...entries('alternateFiles', alternateFiles), ...entries('linkedFiles', linkedFiles),
        ...riddleHomeText.hints.map((text, index) => ({ key: `riddleHomeText.hints.${index}`, text })), { key: 'riddleHomeText.moreHints', text: riddleHomeText.moreHints },
    ];
}

function entries(group: string, values: object): Entry[] {
    return Object.entries(values).flatMap(([key, value]) => typeof value === 'string'
        ? [{ key: `${group}.${key}`, text: value }]
        : (value as readonly string[]).map((text, index) => ({ key: `${group}.${key}.${index}`, text })));
}

function surveyLevels(): Survey[] {
    const fileTypes: Readonly<Record<string, string>> = { 'linkedFiles.script': 'js', 'linkedFiles.stylesheet': 'css' };
    const patterns = textEntries().filter((entry) => !entry.key.startsWith('riddleHomeText.')).map((entry) => ({
        key: entry.key,
        fileType: entry.key.startsWith('alternateFiles.') ? entry.key.split('.')[1] : fileTypes[entry.key],
        pattern: new RegExp(`^${entry.text.split(/\{\w+\}/).map(escapeRegExp).join('[\\s\\S]*?')}$`),
    }));
    return Array.from({ length: lastLevel }, (_, index) => {
        const level = index + 1;
        const page = levelPage(level);
        const next = entrance(level + 1);
        const places: { place: string; value: string | null; fileType?: string }[] = [
            { place: 'Title', value: page.title }, ...page.lines.map((value) => ({ place: 'Line under the picture', value })),
            ...page.comments.map((value) => ({ place: 'Comment in the source', value })), { place: 'Picture tooltip', value: page.imageTitle },
            ...page.files.flatMap((file) => {
                const fileType = file.name.split('.').pop()!;
                return 'text' in file.content ? [{ place: `The .${fileType} file`, value: file.content.text, fileType }] : [];
            }),
        ];
        const texts = new Map<string, string>();
        for (const { place, value, fileType } of places) {
            for (const pattern of patterns) {
                if (value !== null && pattern.fileType === fileType && pattern.pattern.test(value) && !texts.has(pattern.key)) texts.set(pattern.key, place);
            }
        }
        return { level, page, clue: next.clue, kind: next.kind, texts };
    });
}

function placesOf({ page, clue }: Survey): string[] {
    const hints = new Set<string>(Object.values(puzzleHints).flat());
    const found = [
        clue.lines?.some((line) => !hints.has(line)) === true && 'Lines under the picture', clue.comment !== undefined && 'Comment in the source',
        clue.farComment !== undefined && 'Comment far down the source', clue.title !== undefined && !hints.has(clue.title) && 'Title',
        clue.hiddenText !== undefined && 'Black text on the black page', clue.imageTitle !== undefined && 'Picture tooltip', clue.belowFold !== undefined && 'Far below the picture',
        clue.meta !== undefined && 'Meta tag in the source', clue.stylesheet !== undefined && 'Comment in a linked .css file',
        clue.imageName !== undefined && !/\.\w+\.jpg$/.test(clue.imageName) && 'Name of the picture file', clue.imageNote !== undefined && 'Inside the picture file',
        clue.zipped !== undefined && 'Zip file stuck to the end of the picture', clue.attribute !== undefined && 'Unused attribute on the picture in the source',
        ...page.files.map((file) => {
            switch (file.linked) {
                case 'image': return { hidden: 'Picture at zero size, only in the source', rollover: 'Picture shown when pointing at the photo', squashed: 'Extra picture under the photo' }[file.display ?? 'squashed'];
                case 'sound': return 'Sound file on the page';
                case 'hotspot': return 'Page behind an invisible link on the picture';
                case 'pictureLink': return 'File the picture links to';
                case null: return clue.alternate !== undefined && 'File with the same name as the picture';
                default: return false;
            }
        }),
    ];
    return [...new Set(found.filter((place): place is string => typeof place === 'string'))];
}

function exampleOf({ level, clue }: Survey): string {
    const known = new Set(textEntries().map((entry) => entry.text));
    const candidates: [string, string | undefined][] = [
        ['line', clue.lines?.filter((line) => !known.has(line)).join(' ')], ['comment', clue.comment], ['comment far down', clue.farComment],
        ['title', clue.title !== undefined && !known.has(clue.title) ? clue.title : undefined], ['black text', clue.hiddenText], ['tooltip', clue.imageTitle],
        ['far below', clue.belowFold?.join(' ')], ['meta tag', clue.meta], ['.css comment', clue.stylesheet], ['picture name', clue.imageName !== undefined && !/\.\w+\.jpg$/.test(clue.imageName) ? clue.imageName : undefined],
        ['inside the picture', clue.imageNote], ['zip in the picture', clue.zipped], ['behind the invisible link', clue.hotspot], ['attribute', clue.attribute],
        ['letters', clue.spans?.map((span) => span.letter).join(' ')], ['line with bold letters as capitals', clue.emphasis?.map((line) => line.map((segment) => (segment.bold ? segment.text.toUpperCase() : segment.text)).join('')).join(' ')],
        ['tags', clue.tags?.join(' ')], ['spacer widths', clue.spacers?.join(' ')], ['colours', clue.colors?.join(' ')], ['first grid line', clue.grid?.[0]],
        ['picture', clue.drawing === undefined ? undefined : `${clue.drawing.kind} picture of "${clue.drawing.text}"`],
        ['sound', clue.sound === undefined ? undefined : `${clue.sound.kind} of "${clue.sound.text}"`],
        ['file', clue.alternate === undefined ? undefined : `.${clue.alternate.extension} with "${clue.alternate.text}"`],
        ['script', clue.script], ['GIF behind the .txt', clue.renamed],
    ];
    const found = candidates.find(([, text]) => text !== undefined && text !== '');
    if (found === undefined) return '—';
    const text = found[1]!;
    return `Level ${level}, ${found[0]}: ${text.length > 48 ? `${text.slice(0, 45)}...` : text}`;
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
