export type Encoding = 'reversed' | 'a1z26' | 'rot13' | 'caesar' | 'atbash' | 'keyboard' | 'morse' | 'nato' | 'phone' | 'braille'
    | 'tap' | 'bacon' | 'polybius' | 'adfgvx' | 'binary' | 'octal' | 'hex' | 'ascii' | 'roman' | 'arithmetic' | 'url' | 'entities'
    | 'base64' | 'dna' | 'codepoints' | 'pollux';

const morseAlphabet: Readonly<Record<string, string>> = {
    a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---',
    k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-',
    u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..',
    0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};

const natoAlphabet: readonly string[] = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett', 'Kilo', 'Lima', 'Mike',
    'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray', 'Yankee', 'Zulu'];

const phoneKeys: readonly string[] = ['abc', 'def', 'ghi', 'jkl', 'mno', 'pqrs', 'tuv', 'wxyz'];
const keyboardRows: readonly string[] = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const brailleAlphabet = '⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚⠅⠇⠍⠝⠕⠏⠟⠗⠎⠞⠥⠧⠺⠭⠽⠵';
const tapGrid = 'abcdefghijlmnopqrstuvwxyz';
const squareGrid = 'abcdefghijklmnopqrstuvwxyz0123456789';
const adfgvxLabels = 'ADFGVX';
const dnaBases = 'ACGT';

const romanNumerals: readonly (readonly [number, string])[] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

const leetSubstitutions: Readonly<Record<string, string>> = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7' };

export function encode(text: string, encoding: Encoding, unit = 0): string {
    switch (encoding) {
        case 'reversed':
            return [...text].reverse().join('');
        case 'a1z26':
            return mapLetters(text, (index) => String(index + 1), ' ', ' / ');
        case 'rot13':
            return shiftLetters(text, 13);
        case 'caesar':
            return shiftLetters(text, 3);
        case 'atbash':
            return text.replace(/[a-z]/g, (letter) => String.fromCharCode(219 - letter.charCodeAt(0)));
        case 'keyboard':
            return shiftKeys(text, keyboardShift(unit));
        case 'morse':
            return text.split(' ').map((word) => [...word].map((character) => morseAlphabet[character] ?? character).join(' ')).join(' / ');
        case 'nato':
            return mapLetters(text, (index) => natoAlphabet[index]!, ' ', ' / ');
        case 'phone':
            return mapLetters(text, phoneTaps, ' ', ' / ');
        case 'braille':
            return mapLetters(text, (index) => brailleAlphabet[index]!, '', ' ');
        case 'tap':
            return mapLetters(text, tapCode, ' / ', ' // ');
        case 'bacon':
            return mapLetters(text, (index) => index.toString(2).padStart(5, '0').replace(/0/g, 'A').replace(/1/g, 'B'), ' ', ' / ');
        case 'polybius':
            return gridPairs(text, (row, column) => `${row + 1}${column + 1}`);
        case 'adfgvx':
            return gridPairs(text, (row, column) => `${adfgvxLabels[row]}${adfgvxLabels[column]}`);
        case 'binary':
            return characterCodes(text, 2, 8);
        case 'octal':
            return characterCodes(text, 8, 3);
        case 'hex':
            return characterCodes(text, 16, 2);
        case 'ascii':
            return characterCodes(text, 10, 1);
        case 'roman':
            return [...text].map((character) => toRomanNumerals(character.charCodeAt(0))).join(' ');
        case 'arithmetic':
            return [...text].map((character, index) => splitSum(character.charCodeAt(0), fraction(unit * 997 + index * 0.618))).join('  ');
        case 'url':
            return [...text].map((character) => `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`).join('');
        case 'entities':
            return [...text].map((character) => `&#${character.charCodeAt(0)};`).join('');
        case 'base64':
            return btoa(text);
        case 'dna':
            return [...text].map((character) => character.charCodeAt(0).toString(4).padStart(4, '0').replace(/[0-3]/g, (digit) => dnaBases[Number(digit)]!)).join(' ');
        case 'codepoints':
            return `String.fromCharCode(${[...text].map((character) => character.charCodeAt(0)).join(', ')})`;
        case 'pollux':
            return pollux(encode(text, 'morse'), unit);
    }
}

export function keyboardShift(unit: number): number {
    return unit < 0.5 ? 1 : -1;
}

function shiftLetters(text: string, shift: number): string {
    return text.replace(/[a-z]/g, (letter) => String.fromCharCode(((letter.charCodeAt(0) - 97 + shift) % 26) + 97));
}

function shiftKeys(text: string, shift: number): string {
    return [...text].map((character) => {
        const row = keyboardRows.find((keys) => keys.includes(character));
        if (row === undefined) return character;
        return row[(row.indexOf(character) + shift + row.length) % row.length]!;
    }).join('');
}

function characterCodes(text: string, radix: number, width: number): string {
    return [...text].map((character) => character.charCodeAt(0).toString(radix).padStart(width, '0')).join(' ');
}

function mapLetters(text: string, letter: (index: number) => string, letterSeparator: string, wordSeparator: string): string {
    return text.split(' ').map((word) => [...word].map((character) => {
        const index = character.charCodeAt(0) - 97;
        return index >= 0 && index < 26 ? letter(index) : character;
    }).join(letterSeparator)).join(wordSeparator);
}

function gridPairs(text: string, pair: (row: number, column: number) => string): string {
    return text.split(' ').map((word) => [...word].map((character) => {
        const index = squareGrid.indexOf(character);
        return index < 0 ? character : pair(Math.floor(index / 6), index % 6);
    }).join(' ')).join(' / ');
}

function phoneTaps(index: number): string {
    const letter = String.fromCharCode(97 + index);
    const key = phoneKeys.findIndex((letters) => letters.includes(letter));
    return String(key + 2).repeat(phoneKeys[key]!.indexOf(letter) + 1);
}

function tapCode(index: number): string {
    const letter = String.fromCharCode(97 + index);
    const position = tapGrid.indexOf(letter === 'k' ? 'c' : letter);
    return `${'•'.repeat(Math.floor(position / 5) + 1)} ${'•'.repeat(position % 5 + 1)}`;
}

function splitSum(code: number, unit: number): string {
    const first = 10 + Math.floor(unit * (code - 19));
    return `${first}+${code - first}`;
}

function pollux(morse: string, unit: number): string {
    const digits: Readonly<Record<string, string>> = { '.': '147', '-': '258' };
    return [...morse.replaceAll(' / ', ' ')].map((symbol, index) => {
        const choices = digits[symbol] ?? '0369';
        return choices[Math.floor(fraction(unit * 31 + index * 0.618) * choices.length)]!;
    }).join('');
}

function fraction(value: number): number {
    return value - Math.floor(value);
}

export function toRomanNumerals(value: number): string {
    let remaining = value;
    let result = '';
    for (const [amount, symbol] of romanNumerals) {
        while (remaining >= amount) {
            result += symbol;
            remaining -= amount;
        }
    }
    return result;
}

export function toLeet(word: string, unit: number): string {
    const positions = [...word].flatMap((letter, index) => (leetSubstitutions[letter] === undefined ? [] : [index]));
    if (positions.length === 0) {
        return `${word}${Math.floor(unit * 90) + 10}`;
    }
    const substituteCount = 1 + Math.floor(unit * positions.length);
    const chosen = new Set(positions.slice(0, substituteCount));
    return [...word].map((letter, index) => (chosen.has(index) ? (leetSubstitutions[letter] ?? letter) : letter)).join('');
}
