import type { Drawing, DrawingKind } from './drawings.ts';
import { atomicNumberSpelling, characterColors, encode, keyboardShift, toRomanNumerals, vigenere, type Encoding } from './encodings.ts';
import { pickByUnit, ramp, salts, unitHash } from './riddle.ts';
import type { Sound } from './sounds.ts';
import { methodHints } from './text.ts';
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
    readonly pageName?: (level: number) => string | null;
}

interface Method {
    readonly name: string;
    readonly fromLevel: number;
    readonly encoding?: Encoding;
    readonly htmOnly?: boolean;
    readonly exact?: boolean;
    readonly clue: (context: ClueContext) => Clue | null;
}

interface Spot {
    readonly fromLevel: number;
    readonly weight: number;
    readonly usesTitle?: boolean;
    readonly fits?: (text: string, context: ClueContext) => boolean;
    readonly place: (text: string) => Clue;
}

const lineWidth = 36;
const fillerRanks = 3000;
const keyRanks = 300;
const firstNamedLevel = 4;
const innerLayers: readonly Encoding[] = ['reversed', 'atbash', 'rot13'];

const methods: readonly Method[] = [
    cipher('reversed', 11),
    cipher('a1z26', 12),
    cipher('rot13', 16),
    alternative('alternate', 20, ['gif', 'txt', 'json', 'css']),
    cipher('atbash', 24),
    cipher('morse', 28),
    cipher('nato', 32),
    { name: 'capitals', fromLevel: 36, clue: ({ word, answer, level }) => ({ lines: lineUp(capitalized(word, answer, level)) }) },
    drawn('semaphore', 40),
    hinted('caesar', 45, () => methodHints.caesar),
    cipher('shift', 50),
    cipher('binary', 55),
    cipher('upsideDown', 58),
    drawn('pigpen', 62),
    cipher('phone', 65),
    drawn('blink', 70),
    cipher('braille', 75),
    drawn('mirror', 80),
    { name: 'acrostic', fromLevel: 85, clue: ({ word, answer, level }) => ({ lines: lineUp(acrostic(word, answer, level)) }) },
    { name: 'lastLetters', fromLevel: 90, clue: ({ word, answer, level }) => { const words = telestich(word, answer, level); return words === null ? null : { lines: lineUp(words) }; } },
    cipher('polybius', 95),
    drawn('flags', 100),
    cipher('tap', 105),
    alternative('xmlFile', 120, ['xml']),
    { name: 'script', fromLevel: 110, htmOnly: true, exact: true, clue: ({ word, unit }) => ({ script: passwordCheck(word, unit) }) },
    hinted('keyboard', 115, (unit) => (keyboardShift(unit) > 0 ? methodHints.keyboardRight : methodHints.keyboardLeft)),
    { name: 'swatches', fromLevel: 125, clue: ({ word }) => ({ colors: characterColors(word) }) },
    drawn('braille', 130),
    cipher('hex', 140),
    { name: 'vigenere', fromLevel: 150, clue: keyed },
    { name: 'earlierAnswers', fromLevel: 160, clue: earlierAnswers },
    alternative('wavFile', 152, ['wav']),
    cipher('ascii', 155),
    drawn('bits', 165),
    cipher('bacon', 170),
    { name: 'morseSound', fromLevel: 175, clue: ({ word }) => ({ sound: { kind: 'morse', text: word } }) },
    cipher('dna', 185),
    alternative('zipFile', 188, ['zip']),
    drawn('pixels', 192),
    cipher('url', 200),
    hinted('railFence', 210, () => methodHints.railFence),
    cipher('entities', 220),
    cipher('octal', 240),
    { name: 'elements', fromLevel: 250, clue: elements },
    cipher('roman', 260),
    cipher('rot47', 270),
    cipher('base64', 280),
    drawn('dark', 295),
    cipher('arithmetic', 310),
    cipher('dvorak', 325),
    cipher('codepoints', 340),
    drawn('flash', 355),
    cipher('adfgvx', 370),
    hinted('pollux', 410, () => methodHints.pollux),
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
    { fromLevel: 180, weight: 1, place: (text) => ({ stylesheet: text }) },
    { fromLevel: 220, weight: 1, fits: (text, context) => context.withImage && /^[a-z0-9._-]{1,40}$/i.test(text), place: (text) => ({ imageName: `${text}.jpg` }) },
    { fromLevel: 260, weight: 1, fits: (text) => /^[ -~]+$/.test(text), place: (text) => ({ lines: [methodHints.imageNote], imageNote: text }) },
];

const textEncodings: readonly (readonly [Encoding, number])[] = [
    ['reversed', 11], ['a1z26', 12], ['rot13', 16], ['atbash', 24], ['morse', 28], ['nato', 32], ['shift', 50], ['binary', 55],
    ['upsideDown', 58], ['phone', 65], ['polybius', 95], ['tap', 105], ['hex', 140], ['ascii', 155], ['bacon', 170], ['url', 200],
    ['octal', 240], ['rot47', 270], ['base64', 280],
];

export function wordClue(level: number, answer: string, pageName: (level: number) => string | null, withImage = true): Clue {
    const pool = methods.filter((method) => method.fromLevel <= level && (withImage || method.htmOnly !== true));
    const order = shuffledIndices(pool.length, Math.floor(level / pool.length));
    const unit = unitHash(level, salts.clue);
    for (let offset = 0; offset < pool.length; offset++) {
        const method = pool[order[(level + offset) % pool.length]!]!;
        const clue = method.clue({ word: layer(answer, level, method), answer, level, unit, withImage, pageName });
        if (clue !== null && !revealsAnswer(clue, answer)) return { method: method.name, ...clue };
    }
    return { method: 'rot13', ...placed(encode(answer, 'rot13'), { word: answer, answer, level, unit, withImage }) };
}

export function encodedClue(text: string, encoding: Encoding, level: number, unit: number): Clue {
    const encoded = encode(text, encoding, unit);
    const used = encoded === text ? 'rot13' : encoding;
    return { method: used, ...placed(encode(text, used, unit), { word: text, answer: text, level, unit, withImage: true }) };
}

export function textEncodingFor(level: number, unit: number): Encoding {
    return pickByUnit(textEncodings.filter(([, fromLevel]) => fromLevel <= level).map(([encoding]) => encoding), unit);
}

export function yearClue(year: number, level: number, unit: number): Clue {
    const first = 1000 + Math.floor(fraction(unit * 7) * (year - 1000));
    const options: readonly (readonly [number, () => Clue])[] = [
        [0, () => ({ method: 'roman', lines: [toRomanNumerals(year)] })],
        [500, () => ({ method: 'phoneTones', sound: { kind: 'tones', text: String(year) } })],
        [600, () => ({ method: 'binary', lines: [year.toString(2)] })],
        [600, () => ({ method: 'sum', lines: [`${first} + ${year - first}`] })],
        [650, () => ({ method: 'morse', lines: lineUp(encode(String(year), 'morse')) })],
        [700, () => ({ method: 'hex', lines: [year.toString(16)] })],
    ];
    return pickByUnit(options.filter(([fromLevel]) => fromLevel <= level), unit)[1]();
}

function cipher(encoding: Encoding, fromLevel: number): Method {
    return { name: encoding, fromLevel, encoding, clue: (context) => placed(encode(context.word, encoding, context.unit), context) };
}

function hinted(encoding: Encoding, fromLevel: number, hint: (unit: number) => string): Method {
    return { name: encoding, fromLevel, encoding, clue: (context) => ({ title: hint(context.unit), ...placed(encode(context.word, encoding, context.unit), context, false) }) };
}

function drawn(kind: DrawingKind, fromLevel: number): Method {
    return { name: `${kind}Picture`, fromLevel, clue: ({ word }) => ({ drawing: { kind, text: word } }) };
}

function layer(answer: string, level: number, method: Method): string {
    if (method.exact === true || unitHash(level, salts.layer) >= ramp(level, 600, 1000, 0.15, 0.35)) return answer;
    return encode(answer, pickByUnit(innerLayers.filter((inner) => inner !== method.encoding), unitHash(level, salts.layerEncoding)));
}

function placed(text: string, context: ClueContext, titleFree = true): Clue {
    const open = spots.filter((spot) => spot.fromLevel <= context.level && (titleFree || spot.usesTitle !== true) && (spot.fits?.(text, context) ?? true));
    let roll = fraction(context.unit * 7) * open.reduce((sum, spot) => sum + spot.weight, 0);
    for (const spot of open) {
        roll -= spot.weight;
        if (roll < 0) return spot.place(text);
    }
    return open[0]!.place(text);
}

function short(text: string): boolean {
    return text.length <= lineWidth;
}

function revealsAnswer(clue: Clue, answer: string): boolean {
    const texts = [clue.title, clue.comment, clue.farComment, clue.hiddenText, clue.meta, clue.imageTitle, clue.imageNote, clue.stylesheet, clue.imageName?.replace(/\.jpg$/, ''),
        ...(clue.lines ?? []), clue.lines?.join(''), ...(clue.belowFold ?? [])];
    return texts.some((text) => text?.trim().toLowerCase() === answer);
}

function alternative(name: string, fromLevel: number, extensions: readonly AlternateExtension[]): Method {
    return {
        name, fromLevel, htmOnly: true, clue: ({ word, level }) => {
            const extension = pickByUnit(extensions, unitHash(level, salts.extension));
            return { lines: [methodHints[extension]], alternate: { extension, text: word } };
        },
    };
}

function layered(context: ClueContext): Clue {
    const inner = pickByUnit(['reversed', 'atbash', 'rot13', 'caesar'] as const, context.unit);
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
    return { title: key, ...placed(vigenere(context.word, key), context, false) };
}

function earlierAnswers(context: ClueContext): Clue | null {
    const { word, level, pageName } = context;
    const span = level - firstNamedLevel;
    if (pageName === undefined || span < 1) return null;
    const pairs: string[] = [];
    for (const [index, letter] of [...word].entries()) {
        const start = Math.floor(unitHash(level, 2300 + index) * span);
        let pair: string | null = null;
        for (let offset = 0; offset < span && pair === null; offset++) {
            const candidate = firstNamedLevel + ((start + offset) % span);
            const position = pageName(candidate)?.indexOf(letter) ?? -1;
            if (position >= 0) pair = `${candidate}:${position + 1}`;
        }
        if (pair === null) return null;
        pairs.push(pair);
    }
    return withLine(methodHints.earlierAnswers, placed(pairs.join(' '), context));
}

function withLine(line: string, clue: Clue): Clue {
    return { ...clue, lines: [line, ...(clue.lines ?? [])] };
}

function elements(context: ClueContext): Clue | null {
    const spelling = atomicNumberSpelling(context.word);
    return spelling === null ? null : { title: methodHints.elements, ...placed(spelling, context, false) };
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
        return options.length === 0 ? letter.toUpperCase() : pickByUnit(options, unitHash(level, 2000 + index));
    }).join(' ');
}

function telestich(word: string, answer: string, level: number): string | null {
    const options = [...word].map((letter) => fillerWords('last', letter, answer));
    if (options.some((choices) => choices.length === 0)) return null;
    return options.map((choices, index) => pickByUnit(choices, unitHash(level, 2200 + index))).join(' ');
}

function capitalized(word: string, answer: string, level: number): string {
    return [...word].map((letter, index) => {
        const options = fillerWords('any', letter, answer);
        if (options.length === 0) return letter.toUpperCase();
        const filler = pickByUnit(options, unitHash(level, 2100 + index));
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
        const swap = Math.floor(unitHash(seed, 1000 + index) * (index + 1));
        [order[index], order[swap]] = [order[swap]!, order[index]!];
    }
    return order;
}

function fraction(value: number): number {
    return value - Math.floor(value);
}
