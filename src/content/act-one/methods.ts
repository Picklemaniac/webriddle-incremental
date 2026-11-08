import { encode, keyboardShift, toRomanNumerals, type Encoding } from './encodings.ts';
import { pickByUnit, salts, unitHash } from './riddle.ts';
import { methodHints } from './text.ts';
import { vocabularySize, wordAtRank } from './vocabulary.ts';

type AlternateExtension = 'gif' | 'txt' | 'json' | 'css';

export interface Clue {
    readonly title?: string;
    readonly lines?: readonly string[];
    readonly comment?: string;
    readonly hiddenText?: string;
    readonly imageName?: string;
    readonly imageTitle?: string;
    readonly imageLink?: boolean;
    readonly colors?: readonly string[];
    readonly alternate?: { readonly extension: AlternateExtension; readonly text: string };
}

interface Method {
    readonly fromLevel: number;
    readonly usesImage?: boolean;
    readonly clue: (word: string, level: number, unit: number) => Clue;
}

const lineWidth = 36;
const acrosticRanks = 3000;

const methods: readonly Method[] = [
    { fromLevel: 11, clue: (word) => ({ title: word }) },
    { fromLevel: 11, clue: (word) => ({ comment: word }) },
    { fromLevel: 11, clue: (word) => ({ hiddenText: word }) },
    { fromLevel: 11, usesImage: true, clue: (word) => ({ imageName: `${word}.jpg` }) },
    cipher('reversed', 11),
    cipher('a1z26', 14),
    { fromLevel: 18, clue: (word) => ({ imageTitle: word }) },
    cipher('rot13', 20),
    { fromLevel: 24, usesImage: true, clue: (word, _level, unit) => alternate(word, unit) },
    cipher('atbash', 28),
    cipher('morse', 32),
    cipher('nato', 36),
    { fromLevel: 45, clue: (word, _level, unit) => ({ title: methodHints.caesar, ...placed(encode(word, 'caesar'), unit) }) },
    cipher('binary', 55),
    cipher('phone', 65),
    cipher('braille', 75),
    { fromLevel: 85, clue: (word, level) => ({ lines: lineUp(acrostic(word, level)) }) },
    cipher('polybius', 95),
    cipher('tap', 105),
    { fromLevel: 115, clue: (word, _level, unit) => ({ title: keyboardShift(unit) > 0 ? methodHints.keyboardRight : methodHints.keyboardLeft, ...placed(encode(word, 'keyboard', unit), unit) }) },
    { fromLevel: 125, clue: (word) => ({ colors: colors(word) }) },
    cipher('hex', 140),
    cipher('ascii', 155),
    cipher('bacon', 170),
    cipher('dna', 185),
    cipher('url', 200),
    cipher('entities', 220),
    cipher('octal', 240),
    cipher('roman', 260),
    cipher('base64', 280),
    cipher('arithmetic', 310),
    cipher('codepoints', 340),
    cipher('adfgvx', 370),
    { fromLevel: 410, clue: (word, _level, unit) => ({ title: methodHints.pollux, ...placed(encode(word, 'pollux', unit), unit) }) },
    { fromLevel: 460, clue: (word, _level, unit) => layered(word, unit) },
];

const textEncodings: readonly (readonly [Encoding, number])[] = [
    ['plain', 0], ['reversed', 11], ['a1z26', 14], ['rot13', 20], ['atbash', 28], ['morse', 32], ['nato', 36],
    ['binary', 55], ['hex', 140], ['ascii', 155], ['base64', 280],
];

export function wordClue(level: number, word: string, withImage = true): Clue {
    const pool = methods.filter((method) => method.fromLevel <= level && (withImage || method.usesImage !== true));
    const order = shuffledIndices(pool.length, Math.floor(level / pool.length));
    return pool[order[level % pool.length]!]!.clue(word, level, unitHash(level, salts.clue));
}

export function textEncodingFor(level: number, unit: number): Encoding {
    return pickByUnit(textEncodings.filter(([, fromLevel]) => fromLevel <= level).map(([encoding]) => encoding), unit);
}

export function yearClue(year: number, level: number, unit: number): string {
    if (level < 600 || unit < 0.5) return toRomanNumerals(year);
    if (unit < 0.75) return year.toString(2);
    const first = 1000 + Math.floor(fraction(unit * 7) * (year - 1000));
    return `${first} + ${year - first}`;
}

function cipher(encoding: Encoding, fromLevel: number): Method {
    return { fromLevel, clue: (word, _level, unit) => placed(encode(word, encoding, unit), unit) };
}

function placed(text: string, unit: number): Clue {
    return fraction(unit * 7) < 0.65 ? { lines: lineUp(text) } : { comment: text };
}

function alternate(word: string, unit: number): Clue {
    const extension = pickByUnit(['gif', 'txt', 'json', 'css'] as const, unit);
    return { lines: [methodHints[extension]], alternate: { extension, text: word } };
}

function layered(word: string, unit: number): Clue {
    const inner = pickByUnit(['reversed', 'atbash', 'rot13', 'caesar'] as const, unit);
    const outer = pickByUnit(['binary', 'hex', 'morse', 'ascii', 'base64'] as const, fraction(unit * 13));
    return placed(encode(encode(word, inner), outer), unit);
}

function colors(word: string): string[] {
    const codes = [...word].map((character) => character.charCodeAt(0));
    while (codes.length % 3 !== 0) codes.push(0);
    return Array.from({ length: codes.length / 3 }, (_, index) => `#${codes.slice(index * 3, index * 3 + 3).map((code) => code.toString(16).padStart(2, '0')).join('')}`);
}

let wordsByLetter: Map<string, string[]> | undefined;

function acrostic(word: string, level: number): string {
    wordsByLetter ??= groupByFirstLetter();
    return [...word].map((letter, index) => {
        const options = wordsByLetter!.get(letter);
        return options === undefined ? letter.toUpperCase() : pickByUnit(options, unitHash(level, 2000 + index));
    }).join(' ');
}

function groupByFirstLetter(): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (let rank = 1; rank <= Math.min(acrosticRanks, vocabularySize); rank++) {
        const candidate = wordAtRank(rank);
        groups.set(candidate[0]!, [...(groups.get(candidate[0]!) ?? []), candidate]);
    }
    return groups;
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
