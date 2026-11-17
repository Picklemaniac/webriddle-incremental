import { lineUp, lineWidth, type Clue, type ClueContext } from './clues.ts';
import { glyphHeight, glyphPixel, glyphWidth } from './drawings.ts';
import { encode } from './encodings.ts';
import { fraction, pickByUnit, salts, unitHash } from './riddle.ts';
import { vocabularySize, wordAtRank } from './vocabulary.ts';

// Clues that hide a word in a pattern: the first letters of words, bold letters, a grid, an order. Each gives what goes on the page; the method that uses it records how it is read.

type Segment = { text: string; bold: boolean };

const fillerRanks = 3000;
const coverRanks = 600;
const firstNamedLevel = 4;
const alphabet = 'abcdefghijklmnopqrstuvwxyz';
// A cover text may run on for less than one more letter of the cipher after its last one.
const spareCoverLetters = 4;

export function capitals({ word, answer, level }: ClueContext): Clue {
    const words = [...word].map((letter, index) => {
        const options = fillerWords('any', letter, answer);
        if (options.length === 0) return letter.toUpperCase();
        const filler = pickByUnit(options, unitHash(level, salts.capitalFiller + index));
        const position = filler.indexOf(letter);
        return `${filler.slice(0, position)}${letter.toUpperCase()}${filler.slice(position + 1)}`;
    });
    return { lines: lineUp(words.join(' ')) };
}

export function boldLetters({ word, answer, level }: ClueContext): Clue {
    const lines: Segment[][] = [[]];
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
    return { emphasis: lines };
}

export function acrostic({ word, answer, level }: ClueContext): Clue {
    return { lines: lineUp(initialWords(word, answer, level).join(' ')) };
}

export function fakeTags({ word, answer, level }: ClueContext): Clue | null {
    const tags = initialWords(word, answer, level);
    return tags.every((tag) => /^[a-z]+$/.test(tag)) ? { tags } : null;
}

export function lastLetters({ word, answer, level }: ClueContext): Clue | null {
    const options = [...word].map((letter) => fillerWords('last', letter, answer));
    if (options.some((choices) => choices.length === 0)) return null;
    return { lines: lineUp(options.map((choices, index) => pickByUnit(choices, unitHash(level, salts.lastLetterFiller + index))).join(' ')) };
}

// The nth letter of the nth line.
export function diagonal({ word, answer, level }: ClueContext): Clue | null {
    const lines = [...word].flatMap((letter, index) => {
        const options = fillerWordsWith(letter, index, answer);
        return options.length === 0 ? [] : [pickByUnit(options, unitHash(level, salts.diagonalFiller + index))];
    });
    return lines.length === word.length ? { lines } : null;
}

export function everyThird({ word, level }: ClueContext): Clue {
    const filler = (index: number): string => alphabet[Math.floor(unitHash(level, salts.thirdFiller + index) * alphabet.length)]!;
    return { lines: lineUp([...word].map((letter, index) => `${filler(index * 2)}${filler(index * 2 + 1)}${letter}`).join('')) };
}

export function interleaved({ word }: ClueContext): Clue {
    const half = (start: number): string => [...word].map((letter, index) => (index % 2 === start ? letter : '.')).join('');
    return { lines: [half(0), half(1)] };
}

export function scrambled({ word, level }: ClueContext): Clue | null {
    const letters = [...word].map((letter, index) => ({ letter, order: index + 1 }));
    for (let attempt = 0; attempt < 8; attempt++) {
        const shuffled = shuffledIndices(letters.length, level * 31 + attempt).map((index) => letters[index]!);
        if (shuffled.map((span) => span.letter).join('') !== word) return { spans: shuffled };
    }
    return null;
}

// A grid of letters in which one letter draws the word.
export function letterGrid({ word, level }: ClueContext): Clue {
    const special = pickByUnit(['o', 'x', 'z', 'q', 'v', 'k'], unitHash(level, salts.gridLetter));
    const filler = [...alphabet].filter((letter) => letter !== special);
    const perBand = 8;
    const columns = Math.min(word.length, perBand) * 6 + 1;
    const rows = Math.ceil(word.length / perBand) * 8 + 1;
    const grid = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => {
        const [x, y] = [(column - 1) % 6, (row - 1) % 8];
        const character = word[Math.floor((row - 1) / 8) * perBand + Math.floor((column - 1) / 6)];
        const lit = row > 0 && column > 0 && x < glyphWidth && y < glyphHeight && character !== undefined && glyphPixel(character, x, y);
        return lit ? special : pickByUnit(filler, unitHash(level * 977 + row, salts.gridFiller + column));
    }).join(''));
    return { grid };
}

// A row for each letter, as wide as the alphabet, with a mark in the column of the letter.
export function letterChart({ word }: ClueContext): Clue {
    return { grid: [...word].map((letter) => { const column = alphabet.indexOf(letter); return `${'.'.repeat(column)}o${'.'.repeat(alphabet.length - 1 - column)}`; }) };
}

export function checkboxes({ word }: ClueContext): Clue {
    return { checkboxes: encode(word, 'binary').split(' ') };
}

// Bacon's cipher as he meant it: a text in two typefaces, where five letters of it carry one letter of the message.
export function baconFonts({ word, answer, level }: ClueContext): Clue {
    const marks = baconMarks(word);
    const lines: Segment[][] = [[]];
    let length = 0;
    let position = 0;
    for (const cover of coverWords(marks.length, level, answer)) {
        if (length > 0 && length + cover.length + 1 > lineWidth) {
            lines.push([]);
            length = 0;
        }
        const line = lines[lines.length - 1]!;
        if (length > 0) line.push({ text: ' ', bold: false });
        for (const letter of cover) line.push({ text: letter, bold: marks[position++] === 'B' });
        length += cover.length + (length > 0 ? 1 : 0);
    }
    return { emphasis: lines.map(joinedRuns) };
}

export function baconCase({ word, answer, level }: ClueContext): Clue {
    const marks = baconMarks(word);
    let position = 0;
    const words = coverWords(marks.length, level, answer).map((cover) => [...cover].map((letter) => (marks[position++] === 'B' ? letter.toUpperCase() : letter)).join(''));
    return { lines: lineUp(words.join(' ')) };
}

// The letters of the word, each as the number of an earlier level whose name has it, with its place in that name.
export function earlierReferences({ word, level, unit, pageName }: ClueContext): string | null {
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
    return ((fraction(unit * 5) < 0.5 ? references(true) : null) ?? references(false))?.join(' ') ?? null;
}

function baconMarks(word: string): string {
    return encode(word, 'bacon').replace(/[^AB]/g, '');
}

function initialWords(word: string, answer: string, level: number): string[] {
    return [...word].map((letter, index) => {
        const options = fillerWords('first', letter, answer);
        return options.length === 0 ? letter.toUpperCase() : pickByUnit(options, unitHash(level, salts.firstLetterFiller + index));
    });
}

// Common words with enough letters between them to carry a cipher.
function coverWords(letterCount: number, level: number, avoid: string): string[] {
    const cover: string[] = [];
    let remaining = letterCount;
    for (let index = 0; remaining > 0; index++) {
        const start = Math.floor(unitHash(level, salts.coverFiller + index) * coverRanks);
        let chosen = 'a';
        for (let offset = 0; offset < coverRanks; offset++) {
            const candidate = wordAtRank(1 + ((start + offset) % coverRanks));
            if (candidate.length <= remaining + spareCoverLetters && candidate !== avoid) {
                chosen = candidate;
                break;
            }
        }
        cover.push(chosen);
        remaining -= chosen.length;
    }
    return cover;
}

function joinedRuns(segments: readonly Segment[]): Segment[] {
    const runs: Segment[] = [];
    for (const segment of segments) {
        const last = runs[runs.length - 1];
        if (last !== undefined && last.bold === segment.bold) last.text += segment.text;
        else runs.push({ ...segment });
    }
    return runs;
}

let fillerGroups: Readonly<Record<'first' | 'last' | 'any', Map<string, string[]>>> | undefined;
let fillersByPlace: Map<string, string[]> | undefined;

function fillerWords(group: 'first' | 'last' | 'any', letter: string, answer: string): string[] {
    fillerGroups ??= groupFillerWords();
    return (fillerGroups[group].get(letter) ?? []).filter((word) => word !== answer);
}

function fillerWordsWith(letter: string, position: number, answer: string): string[] {
    if (fillersByPlace === undefined) {
        fillersByPlace = new Map();
        for (const word of fillerVocabulary()) {
            [...word].forEach((character, index) => {
                const key = `${index}${character}`;
                fillersByPlace!.set(key, [...(fillersByPlace!.get(key) ?? []), word]);
            });
        }
    }
    return (fillersByPlace.get(`${position}${letter}`) ?? []).filter((word) => word !== answer);
}

function fillerVocabulary(): string[] {
    return Array.from({ length: Math.min(fillerRanks, vocabularySize) }, (_, index) => wordAtRank(index + 1));
}

function groupFillerWords(): Record<'first' | 'last' | 'any', Map<string, string[]>> {
    const groups = { first: new Map<string, string[]>(), last: new Map<string, string[]>(), any: new Map<string, string[]>() };
    const add = (group: Map<string, string[]>, letter: string, word: string): void => {
        group.set(letter, [...(group.get(letter) ?? []), word]);
    };
    for (const word of fillerVocabulary()) {
        add(groups.first, word[0]!, word);
        add(groups.last, word.at(-1)!, word);
        for (const letter of new Set(word)) add(groups.any, letter, word);
    }
    return groups;
}

function shuffledIndices(count: number, seed: number): number[] {
    const order = Array.from({ length: count }, (_, index) => index);
    for (let index = count - 1; index > 0; index--) {
        const swap = Math.floor(unitHash(seed, salts.shuffle + index) * (index + 1));
        [order[index], order[swap]] = [order[swap]!, order[index]!];
    }
    return order;
}
