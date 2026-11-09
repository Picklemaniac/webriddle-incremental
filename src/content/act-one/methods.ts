import { glyphHeight, glyphPixel, glyphWidth, type Drawing, type DrawingKind } from './drawings.ts';
import { atomicNumberSpelling, characterColors, encode, keyboardShift, toRomanNumerals, vigenere, type Encoding } from './encodings.ts';
import { firstYear, fraction, pickByUnit, ramp, salts, textSeed, unitHash } from './riddle.ts';
import type { Sound } from './sounds.ts';
import { puzzleHints } from './text.ts';
import { vocabularySize, wordAtRank } from './vocabulary.ts';

type AlternateExtension = 'gif' | 'txt' | 'json' | 'css' | 'xml' | 'wav' | 'zip';

export interface Clue {
    readonly method?: string;
    readonly title?: string;
    readonly lines?: readonly string[];
    readonly comment?: string;
    readonly farComment?: string;
    readonly hiddenText?: string;
    readonly belowFold?: readonly string[];
    readonly meta?: string;
    readonly imageName?: string;
    readonly imageTitle?: string;
    readonly imageLink?: boolean;
    readonly imageNote?: string;
    readonly colors?: readonly string[];
    readonly drawing?: Drawing;
    readonly drawingDisplay?: 'hidden' | 'squashed' | 'rollover';
    readonly grid?: readonly string[];
    readonly spans?: readonly { readonly letter: string; readonly order: number }[];
    readonly hotspot?: string;
    readonly zipped?: string;
    readonly renamed?: string;
    readonly emphasis?: readonly (readonly { readonly text: string; readonly bold: boolean }[])[];
    readonly tags?: readonly string[];
    readonly spacers?: readonly number[];
    readonly attribute?: string;
    readonly sound?: Sound;
    readonly stylesheet?: string;
    readonly script?: string;
    readonly alternate?: { readonly extension: AlternateExtension; readonly text: string };
}

interface ClueContext {
    readonly word: string;
    readonly answer: string;
    readonly level: number;
    readonly unit: number;
    readonly withImage: boolean;
    readonly titleFree: boolean;
    readonly pageName?: (level: number) => string | null;
}

type HintKey = keyof typeof puzzleHints;

interface Hint {
    readonly place: 'title' | 'line';
    readonly key: HintKey | ((context: ClueContext) => HintKey);
}

interface Method {
    readonly name: string;
    readonly fromLevel: number;
    readonly encoding?: Encoding;
    readonly htmOnly?: boolean;
    readonly exact?: boolean;
    readonly hint?: Hint;
    readonly clue: (context: ClueContext) => Clue | null;
}

interface Spot {
    readonly fromLevel: number;
    readonly weight: number;
    readonly usesTitle?: boolean;
    readonly fits?: (text: string, context: ClueContext) => boolean;
    readonly place: (text: string, context: ClueContext) => Clue;
}

const lineWidth = 36;
const fillerRanks = 3000;
const keyRanks = 300;
const firstNamedLevel = 4;
const innerLayers: readonly Encoding[] = ['reversed', 'atbash', 'rot13', 'caesar'];
const pictureCiphers: readonly Encoding[] = ['rot13', 'atbash', 'caesar'];
const leetEncodings: readonly Encoding[] = ['reversed', 'rot13', 'atbash', 'base64', 'hex', 'binary', 'ascii', 'octal', 'morse'];
const recentMethodCount = 20;
const newMethodLevels = 120;
const oldMethodLevel = 60;
const hintedLevels = 120;
const laterHintShare = 0.5;
const essentialHints: ReadonlySet<HintKey> = new Set(['keyboardRight', 'keyboardLeft', 'earlierAnswers', 'spectrogram', 'pollux', 'shares']);

const methods: readonly Method[] = [
    cipher('reversed', 11),
    cipher('a1z26', 12),
    cipher('rot13', 16),
    alternative('alternate', 20, ['gif', 'txt', 'json', 'css']),
    cipher('atbash', 24, inTitle('atbash')),
    cipher('morse', 28),
    cipher('nato', 32),
    { name: 'capitals', fromLevel: 36, hint: inTitle('capitals'), clue: ({ word, answer, level }) => ({ lines: lineUp(capitalized(word, answer, level)) }) },
    { name: 'interleaved', fromLevel: 38, clue: interleaved },
    drawn('semaphore', 40),
    cipher('caesar', 45, inTitle('caesar')),
    cipher('shift', 50, inTitle('shift')),
    cipher('binary', 55),
    cipher('upsideDown', 58),
    drawn('pigpen', 62),
    cipher('phone', 65, inTitle('phone')),
    { name: 'boldLetters', fromLevel: 68, hint: inTitle('boldLetters'), clue: ({ word, answer, level }) => ({ emphasis: emphasized(word, answer, level) }) },
    cipher('braille', 75, inTitle('braille')),
    lettered('mirror', 80),
    { name: 'acrostic', fromLevel: 85, hint: inTitle('acrostic'), clue: ({ word, answer, level }) => ({ lines: lineUp(acrostic(word, answer, level)) }) },
    { name: 'lastLetters', fromLevel: 90, hint: inTitle('lastLetters'), clue: ({ word, answer, level }) => { const words = telestich(word, answer, level); return words === null ? null : { lines: lineUp(words) }; } },
    cipher('polybius', 95, inTitle('polybius')),
    drawn('flags', 100, inTitle('flags')),
    cipher('tap', 105, inTitle('tap')),
    { name: 'script', fromLevel: 110, htmOnly: true, exact: true, clue: ({ word, unit }) => ({ script: passwordCheck(word, unit) }) },
    cipher('keyboard', 115, inTitle(({ unit }) => (keyboardShift(unit) > 0 ? 'keyboardRight' : 'keyboardLeft'))),
    alternative('xmlFile', 120, ['xml']),
    { name: 'swatches', fromLevel: 125, hint: inTitle('colors'), clue: ({ word }) => ({ colors: characterColors(word) }) },
    { name: 'scrambled', fromLevel: 128, hint: inTitle('scrambled'), clue: scrambled },
    drawn('braille', 130, inTitle('braillePicture')),
    drawn('clocks', 135, inTitle('clocks')),
    cipher('hex', 140),
    { name: 'letterGrid', fromLevel: 145, hint: inTitle('letterGrid'), clue: ({ word, level }) => ({ grid: letterGrid(word, level) }) },
    { name: 'vigenere', fromLevel: 150, clue: keyed },
    alternative('wavFile', 152, ['wav']),
    cipher('ascii', 155),
    { name: 'earlierAnswers', fromLevel: 160, hint: onLine('earlierAnswers'), clue: earlierAnswers },
    drawn('bits', 165),
    { name: 'fakeTags', fromLevel: 168, hint: inTitle('fakeTags'), clue: ({ word, answer, level }) => ({ tags: acrostic(word, answer, level).split(' ').filter((tag) => /^[a-z]+$/.test(tag)) }) },
    cipher('bacon', 170, onLine('bacon')),
    { name: 'morseSound', fromLevel: 175, clue: ({ word }) => ({ sound: { kind: 'morse', text: word } }) },
    cipher('dna', 185, inTitle('dna')),
    alternative('zipFile', 188, ['zip']),
    drawn('pixels', 192, inTitle('pixels')),
    cipher('url', 200),
    { name: 'spacers', fromLevel: 205, hint: inTitle('spacers'), clue: ({ word }) => ({ spacers: [...word].map((letter) => letter.charCodeAt(0) - 96) }) },
    cipher('railFence', 210, inTitle('railFence')),
    cipher('entities', 220),
    lettered('rotated', 225),
    { name: 'squashedPicture', fromLevel: 230, exact: true, hint: inTitle('squashed'), clue: ({ word, level }) => ({ drawing: { kind: 'plain', text: pictureCipher(word, level) }, drawingDisplay: 'squashed' }) },
    cipher('keyboardGrid', 235, inTitle('keyboardGrid')),
    cipher('octal', 240),
    { name: 'elements', fromLevel: 250, hint: inTitle('elements'), clue: elements },
    cipher('roman', 260),
    lettered('transparent', 268, inTitle('transparent')),
    cipher('rot47', 270),
    cipher('base64', 280),
    { name: 'caselessBase64', fromLevel: 290, hint: inTitle('caselessBase64'), clue: caselessBase64 },
    lettered('dark', 295, inTitle('dark')),
    cipher('base36', 300, inTitle('base36')),
    cipher('arithmetic', 310),
    cipher('dvorak', 325, inTitle('dvorak')),
    cipher('codepoints', 340),
    { name: 'renamed', fromLevel: 345, exact: true, hint: inTitle('renamed'), clue: ({ word, level }) => ({ renamed: pictureCipher(word, level) }) },
    lettered('flash', 355, inTitle('flash')),
    cipher('adfgvx', 370),
    { name: 'utf16', fromLevel: 380, encoding: 'utf16', hint: inTitle('utf16'), clue: (context) => (context.word.length % 2 === 0 ? placed(encode(context.word, 'utf16'), context) : null) },
    { name: 'spectrogram', fromLevel: 390, hint: onLine('spectrogram'), clue: ({ word }) => ({ sound: { kind: 'spectrogram', text: word } }) },
    cipher('pollux', 410, inTitle('pollux')),
    drawn('shares', 430, onLine('shares')),
    lettered('delayed', 445, inTitle('delayed')),
    { name: 'layered', fromLevel: 460, clue: layered },
];

const spots: readonly Spot[] = [
    { fromLevel: 0, weight: 5, place: (text) => ({ lines: lineUp(text) }) },
    { fromLevel: 0, weight: 2, place: (text) => ({ comment: text }) },
    { fromLevel: 0, weight: 1, usesTitle: true, fits: short, place: (text) => ({ title: text }) },
    { fromLevel: 0, weight: 1, fits: short, place: (text) => ({ hiddenText: text }) },
    { fromLevel: 0, weight: 1, fits: short, place: (text) => ({ imageTitle: text }) },
    { fromLevel: 60, weight: 1, place: (text) => ({ belowFold: lineUp(text) }) },
    { fromLevel: 100, weight: 1, place: (text) => ({ farComment: text }) },
    { fromLevel: 140, weight: 1, place: (text) => ({ meta: text }) },
    { fromLevel: 140, weight: 1, place: (text, context) => withLine(variant('hotspot', context.level), { hotspot: text }) },
    { fromLevel: 180, weight: 1, place: (text) => ({ stylesheet: text }) },
    { fromLevel: 200, weight: 1, place: (text) => ({ attribute: text }) },
    { fromLevel: 220, weight: 1, fits: (text, context) => context.withImage && /^[a-z0-9._-]{1,40}$/i.test(text), place: (text) => ({ imageName: `${text}.jpg` }) },
    { fromLevel: 260, weight: 1, fits: printable, place: (text, context) => withLine(variant('imageNote', context.level), { imageNote: text }) },
    { fromLevel: 320, weight: 1, fits: printable, place: (text, context) => withLine(variant('zipped', context.level), { zipped: text }) },
];

const textEncodingNames: ReadonlySet<Encoding> = new Set<Encoding>(['reversed', 'a1z26', 'rot13', 'atbash', 'morse', 'nato', 'shift', 'binary', 'upsideDown', 'phone',
    'polybius', 'tap', 'hex', 'ascii', 'bacon', 'url', 'octal', 'rot47', 'base64']);
const textEncodings = methods.flatMap((method) => (method.encoding !== undefined && textEncodingNames.has(method.encoding) ? [[method.encoding, method.fromLevel] as const] : []));

export function wordClue(level: number, answer: string, pageName: (level: number) => string | null, withImage = true, recent: readonly string[] = []): Clue {
    const pool = methods.filter((method) => method.fromLevel <= level && (withImage || method.htmOnly !== true));
    const unit = unitHash(level, salts.clue);
    for (const method of methodOrder(pool, level, recent)) {
        const context: ClueContext = { word: layer(answer, level, method), answer, level, unit, withImage, titleFree: method.hint?.place !== 'title', pageName };
        const clue = method.clue(context);
        if (clue !== null && !revealsAnswer(clue, answer)) return { method: method.name, ...withHint(clue, method, context) };
    }
    return { method: 'rot13', ...placed(encode(answer, 'rot13'), { word: answer, answer, level, unit, withImage, titleFree: true }) };
}

export function encodedClue(text: string, encoding: Encoding, level: number, unit: number): Clue {
    const encoded = encode(text, encoding, unit);
    const used = encoded === text ? 'rot13' : encoding;
    return { method: used, ...placed(encode(text, used, unit), { word: text, answer: text, level, unit, withImage: true, titleFree: true }) };
}

export function textEncodingFor(level: number, unit: number, recent: readonly string[] = []): Encoding {
    return leastRecent(textEncodings.filter(([, fromLevel]) => fromLevel <= level).map(([encoding]) => encoding), (encoding) => encoding, recent, unit);
}

export function leetEncodingFor(unit: number, recent: readonly string[] = []): Encoding {
    return leastRecent(leetEncodings, (encoding) => encoding, recent, unit);
}

export function yearClue(year: number, level: number, unit: number, recent: readonly string[] = []): Clue {
    const first = firstYear + Math.floor(fraction(unit * 7) * (year - firstYear));
    const options: readonly (readonly [number, () => Clue])[] = [
        [0, () => ({ method: 'roman', lines: [toRomanNumerals(year)] })],
        [500, () => ({ method: 'phoneTones', sound: { kind: 'tones', text: String(year) } })],
        [450, () => ({ method: 'binary', lines: [year.toString(2)] })],
        [600, () => ({ method: 'sum', lines: [`${first} + ${year - first}`] })],
        [650, () => ({ method: 'morse', lines: lineUp(encode(String(year), 'morse')) })],
        [700, () => ({ method: 'hex', lines: [year.toString(16)] })],
    ];
    return leastRecent(options.filter(([fromLevel]) => fromLevel <= level).map(([, clue]) => clue()), (clue) => clue.method ?? '', recent, unit);
}

function methodOrder(pool: readonly Method[], level: number, recent: readonly string[]): Method[] {
    const excluded = new Set(recent.slice(0, Math.min(recentMethodCount, Math.floor(pool.length * 0.6))));
    const ranked = pool.map((method) => ({ method, key: unitHash(level, salts.method + textSeed(method.name)) ** (1 / methodWeight(method, level)) }));
    ranked.sort((first, second) => Number(excluded.has(first.method.name)) - Number(excluded.has(second.method.name)) || second.key - first.key);
    return ranked.map(({ method }) => method);
}

function methodWeight(method: Method, level: number): number {
    const novelty = 1 + 2 * Math.max(0, 1 - (level - method.fromLevel) / newMethodLevels);
    const age = method.fromLevel < oldMethodLevel ? Math.max(0.3, 1 - Math.max(0, level - 200) / 500) : 1;
    return novelty * age;
}

function leastRecent<Item>(items: readonly Item[], name: (item: Item) => string, recent: readonly string[], unit: number): Item {
    const age = (item: Item): number => { const index = recent.indexOf(name(item)); return index === -1 ? Number.POSITIVE_INFINITY : index; };
    const oldest = Math.max(...items.map(age));
    return pickByUnit(items.filter((item) => age(item) === oldest), unit);
}

function cipher(encoding: Encoding, fromLevel: number, hint?: Hint): Method {
    return { name: encoding, fromLevel, encoding, hint, clue: (context) => placed(encode(context.word, encoding, context.unit), context) };
}

function drawn(kind: DrawingKind, fromLevel: number, hint?: Hint): Method {
    return {
        name: `${kind}Picture`, fromLevel, hint, clue: ({ word, level }) => {
            const display = drawingDisplay(level);
            const clue: Clue = { drawing: { kind, text: word }, drawingDisplay: display };
            return display === 'hidden' ? withLine(variant('hiddenPicture', level), clue) : clue;
        },
    };
}

function lettered(kind: DrawingKind, fromLevel: number, hint?: Hint): Method {
    const picture = drawn(kind, fromLevel, hint);
    return { ...picture, exact: true, clue: (context) => picture.clue({ ...context, word: pictureCipher(context.word, context.level) }) };
}

function pictureCipher(word: string, level: number): string {
    const unit = unitHash(level, salts.layerEncoding);
    return encode(word, pickByUnit(pictureCiphers, unit), unit);
}

function inTitle(key: Hint['key']): Hint {
    return { place: 'title', key };
}

function onLine(key: Hint['key']): Hint {
    return { place: 'line', key };
}

function variant(key: HintKey, level: number): string {
    return pickByUnit(puzzleHints[key], unitHash(level, salts.hint));
}

function withHint(clue: Clue, method: Method, context: ClueContext): Clue {
    const hint = method.hint;
    if (hint === undefined) return clue;
    const key = typeof hint.key === 'function' ? hint.key(context) : hint.key;
    const shown = essentialHints.has(key) || context.level - method.fromLevel < hintedLevels || unitHash(context.level, salts.hintShown) < laterHintShare;
    if (!shown) return clue;
    const text = variant(key, context.level);
    return hint.place === 'title' && clue.title === undefined ? { ...clue, title: text } : withLine(text, clue);
}

function drawingDisplay(level: number): 'hidden' | 'rollover' | undefined {
    const roll = unitHash(level, salts.display);
    const hidden = ramp(level, 400, 900, 0.1, 0.25);
    return roll < hidden ? 'hidden' : roll < hidden + ramp(level, 150, 600, 0.1, 0.2) ? 'rollover' : undefined;
}

function layer(answer: string, level: number, method: Method): string {
    if (method.exact === true || unitHash(level, salts.layer) >= ramp(level, 600, 1000, 0.15, 0.35)) return answer;
    return encode(answer, pickByUnit(innerLayers.filter((inner) => inner !== method.encoding), unitHash(level, salts.layerEncoding)));
}

function placed(text: string, context: ClueContext): Clue {
    const open = spots.filter((spot) => spot.fromLevel <= context.level && (context.titleFree || spot.usesTitle !== true) && (spot.fits?.(text, context) ?? true));
    let roll = fraction(context.unit * 7) * open.reduce((sum, spot) => sum + spot.weight, 0);
    for (const spot of open) {
        roll -= spot.weight;
        if (roll < 0) return spot.place(text, context);
    }
    return open[0]!.place(text, context);
}

function short(text: string): boolean {
    return text.length <= lineWidth;
}

function printable(text: string): boolean {
    return /^[ -~]+$/.test(text);
}

function revealsAnswer(clue: Clue, answer: string): boolean {
    const texts = [clue.title, clue.comment, clue.farComment, clue.hiddenText, clue.hotspot, clue.zipped, clue.attribute, clue.spans?.map((span) => span.letter).join(''), clue.meta, clue.imageTitle, clue.imageNote, clue.stylesheet, clue.imageName?.replace(/\.jpg$/, ''),
        ...(clue.lines ?? []), clue.lines?.join(''), ...(clue.belowFold ?? [])];
    return texts.some((text) => text?.trim().toLowerCase() === answer);
}

function alternative(name: string, fromLevel: number, extensions: readonly AlternateExtension[]): Method {
    return {
        name, fromLevel, htmOnly: true, clue: ({ word, level }) => {
            const extension = pickByUnit(extensions, unitHash(level, salts.extension));
            return { lines: [variant(`${extension}File`, level)], alternate: { extension, text: word } };
        },
    };
}

function layered(context: ClueContext): Clue {
    const inner = pickByUnit(innerLayers, context.unit);
    const outer = pickByUnit(['binary', 'hex', 'morse', 'ascii', 'base64', 'octal', 'a1z26', 'polybius'] as const, fraction(context.unit * 13));
    return placed(encode(encode(context.word, inner), outer), context);
}

function keyed(context: ClueContext): Clue {
    const start = Math.floor(unitHash(context.level, salts.key) * keyRanks);
    let key = 'riddle';
    for (let offset = 0; offset < keyRanks; offset++) {
        const candidate = wordAtRank(1 + ((start + offset) % keyRanks));
        if (candidate.length >= 4 && candidate.length <= 7 && candidate !== context.answer) {
            key = candidate;
            break;
        }
    }
    return { title: key, ...placed(vigenere(context.word, key), { ...context, titleFree: false }) };
}

function earlierAnswers(context: ClueContext): Clue | null {
    const { word, level, unit, pageName } = context;
    const span = level - firstNamedLevel;
    if (pageName === undefined || span < 1) return null;
    const reference = (letter: string, index: number, initial: boolean): string | null => {
        const start = Math.floor(unitHash(level, salts.earlierAnswer + index) * span);
        for (let offset = 0; offset < span; offset++) {
            const candidate = firstNamedLevel + ((start + offset) % span);
            const name = pageName(candidate);
            const position = (initial ? name?.slice(0, 1) : name)?.indexOf(letter) ?? -1;
            if (position >= 0) return initial ? String(candidate) : `${candidate}:${position + 1}`;
        }
        return null;
    };
    const references = (initial: boolean): string[] | null => {
        const found = [...word].map((letter, index) => reference(letter, index, initial));
        return found.every((item): item is string => item !== null) ? found : null;
    };
    const chosen = (fraction(unit * 5) < 0.5 ? references(true) : null) ?? references(false);
    return chosen === null ? null : placed(chosen.join(' '), context);
}

function scrambled({ word, level }: ClueContext): Clue | null {
    const letters = [...word].map((letter, index) => ({ letter, order: index + 1 }));
    for (let attempt = 0; attempt < 8; attempt++) {
        const shuffled = shuffledIndices(letters.length, level * 31 + attempt).map((index) => letters[index]!);
        if (shuffled.map((span) => span.letter).join('') !== word) return { spans: shuffled };
    }
    return null;
}

function interleaved({ word }: ClueContext): Clue {
    const half = (start: number): string => [...word].map((letter, index) => (index % 2 === start ? letter : '.')).join('');
    return { lines: [half(0), half(1)] };
}

function caselessBase64({ word }: ClueContext): Clue | null {
    const encoded = encode(word, 'base64');
    const capitals = [...encoded].flatMap((character, index) => (/[A-Z]/.test(character) ? [index + 1] : []));
    return capitals.length === 0 ? null : { lines: lineUp(encoded.toLowerCase()), comment: capitals.join(' ') };
}

function emphasized(word: string, answer: string, level: number): { text: string; bold: boolean }[][] {
    const lines: { text: string; bold: boolean }[][] = [[]];
    let length = 0;
    [...word].forEach((letter, index) => {
        const options = fillerWords('any', letter, answer);
        const filler = options.length === 0 ? letter : pickByUnit(options, unitHash(level, salts.boldFiller + index));
        const position = filler.indexOf(letter);
        if (length > 0 && length + filler.length + 1 > lineWidth) {
            lines.push([]);
            length = 0;
        }
        const line = lines[lines.length - 1]!;
        line.push({ text: `${length > 0 ? ' ' : ''}${filler.slice(0, position)}`, bold: false }, { text: letter, bold: true }, { text: filler.slice(position + 1), bold: false });
        length += filler.length + (length > 0 ? 1 : 0);
    });
    return lines;
}

function letterGrid(word: string, level: number): string[] {
    const special = pickByUnit(['o', 'x', 'z', 'q', 'v', 'k'], unitHash(level, salts.gridLetter));
    const filler = [...'abcdefghijklmnopqrstuvwxyz'].filter((letter) => letter !== special);
    const perBand = 8;
    const columns = Math.min(word.length, perBand) * 6 + 1;
    const rows = Math.ceil(word.length / perBand) * 8 + 1;
    return Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => {
        const [x, y] = [(column - 1) % 6, (row - 1) % 8];
        const character = word[Math.floor((row - 1) / 8) * perBand + Math.floor((column - 1) / 6)];
        const lit = row > 0 && column > 0 && x < glyphWidth && y < glyphHeight && character !== undefined && glyphPixel(character, x, y);
        return lit ? special : pickByUnit(filler, unitHash(level * 977 + row, salts.gridFiller + column));
    }).join(''));
}

function withLine(line: string, clue: Clue): Clue {
    return { ...clue, lines: [line, ...(clue.lines ?? [])] };
}

function elements(context: ClueContext): Clue | null {
    const spelling = atomicNumberSpelling(context.word);
    return spelling === null ? null : placed(spelling, context);
}

function passwordCheck(word: string, unit: number): string {
    const reversed = encode(word, 'reversed');
    return pickByUnit([
        `String.fromCharCode(${[...word].map((character) => character.charCodeAt(0)).join(', ')})`,
        `unescape("${encode(word, 'url')}")`,
        ...(reversed === word ? [] : [`"${reversed}".split("").reverse().join("")`]),
    ], unit);
}

let fillerGroups: Readonly<Record<'first' | 'last' | 'any', Map<string, string[]>>> | undefined;

function fillerWords(group: 'first' | 'last' | 'any', letter: string, answer: string): string[] {
    fillerGroups ??= groupFillerWords();
    return (fillerGroups[group].get(letter) ?? []).filter((word) => word !== answer);
}

function groupFillerWords(): Record<'first' | 'last' | 'any', Map<string, string[]>> {
    const groups = { first: new Map<string, string[]>(), last: new Map<string, string[]>(), any: new Map<string, string[]>() };
    const add = (group: Map<string, string[]>, letter: string, word: string): void => {
        group.set(letter, [...(group.get(letter) ?? []), word]);
    };
    for (let rank = 1; rank <= Math.min(fillerRanks, vocabularySize); rank++) {
        const word = wordAtRank(rank);
        add(groups.first, word[0]!, word);
        add(groups.last, word.at(-1)!, word);
        for (const letter of new Set(word)) add(groups.any, letter, word);
    }
    return groups;
}

function acrostic(word: string, answer: string, level: number): string {
    return [...word].map((letter, index) => {
        const options = fillerWords('first', letter, answer);
        return options.length === 0 ? letter.toUpperCase() : pickByUnit(options, unitHash(level, salts.firstLetterFiller + index));
    }).join(' ');
}

function telestich(word: string, answer: string, level: number): string | null {
    const options = [...word].map((letter) => fillerWords('last', letter, answer));
    if (options.some((choices) => choices.length === 0)) return null;
    return options.map((choices, index) => pickByUnit(choices, unitHash(level, salts.lastLetterFiller + index))).join(' ');
}

function capitalized(word: string, answer: string, level: number): string {
    return [...word].map((letter, index) => {
        const options = fillerWords('any', letter, answer);
        if (options.length === 0) return letter.toUpperCase();
        const filler = pickByUnit(options, unitHash(level, salts.capitalFiller + index));
        const position = filler.indexOf(letter);
        return `${filler.slice(0, position)}${letter.toUpperCase()}${filler.slice(position + 1)}`;
    }).join(' ');
}

function lineUp(text: string): string[] {
    const lines: string[] = [];
    let current = '';
    for (const token of text.split(' ').filter(Boolean).flatMap((part) => part.match(new RegExp(`.{1,${lineWidth}}`, 'g')) ?? [part])) {
        if (current !== '' && current.length + 1 + token.length > lineWidth) {
            lines.push(current);
            current = token;
        } else {
            current = current === '' ? token : `${current} ${token}`;
        }
    }
    if (current !== '') lines.push(current);
    return lines;
}

function shuffledIndices(count: number, seed: number): number[] {
    const order = Array.from({ length: count }, (_, index) => index);
    for (let index = count - 1; index > 0; index--) {
        const swap = Math.floor(unitHash(seed, salts.shuffle + index) * (index + 1));
        [order[index], order[swap]] = [order[swap]!, order[index]!];
    }
    return order;
}
