import { firstYear, fraction } from './riddle.ts';

export type Encoding =
    | 'reversed' | 'rot13' | 'caesar' | 'shift' | 'atbash' | 'keyboard' | 'qwertyAlphabet' | 'dvorak' | 'colemak' | 'trithemius' | 'rot47' | 'rot5' | 'rot18' | 'upsideDown'
    | 'railFence' | 'scytale' | 'swappedPairs'
    | 'a1z26' | 'primes' | 'squares' | 'romanLetters' | 'spelledNumbers' | 'morse' | 'morseBits' | 'morseSwapped' | 'ditDah' | 'pollux' | 'nato' | 'ableBaker' | 'phone'
    | 'braille' | 'brailleDots' | 'tap' | 'bacon' | 'polybius' | 'polybius6' | 'adfgvx' | 'keyboardGrid' | 'kenny' | 'baudot' | 'elements' | 'base36'
    | 'binary' | 'octal' | 'hex' | 'ascii' | 'ternary' | 'roman' | 'arithmetic' | 'dna' | 'ebcdic' | 'url' | 'entities' | 'hexEntities' | 'unicodeEscapes' | 'hexEscapes'
    | 'octalEscapes' | 'quotedPrintable' | 'codepoints' | 'base64' | 'base32' | 'ascii85' | 'uuencode' | 'utf16' | 'whitespace' | 'zeroWidth'
    | 'vigenere' | 'beaufort' | 'gronsfeld' | 'autokey' | 'keyedAlphabet' | 'affine' | 'columnar' | 'nihilist' | 'xor'
    | 'romanNumeral' | 'binaryNumber' | 'hexNumber' | 'sum' | 'romanDate';

interface Cipher {
    readonly encode: (text: string, unit: number, key: string) => string;
    readonly decode: (text: string, unit: number, key: string) => string;
    // Whether the text comes back unchanged after encoding and decoding, and does not stay readable on the way.
    readonly carries: (text: string) => boolean;
}

const alphabet = 'abcdefghijklmnopqrstuvwxyz';
const digits = '0123456789';
const squareGrid = `${alphabet}${digits}`;
const polybiusGrid = alphabet.replace('j', '');
const tapGrid = alphabet.replace('k', '');

const morseAlphabet: Readonly<Record<string, string>> = {
    a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---',
    k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-',
    u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..',
    0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};

const natoAlphabet: readonly string[] = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett', 'Kilo', 'Lima', 'Mike',
    'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'X-ray', 'Yankee', 'Zulu'];
const ableBakerAlphabet: readonly string[] = ['Able', 'Baker', 'Charlie', 'Dog', 'Easy', 'Fox', 'George', 'How', 'Item', 'Jig', 'King', 'Love', 'Mike',
    'Nan', 'Oboe', 'Peter', 'Queen', 'Roger', 'Sugar', 'Tare', 'Uncle', 'Victor', 'William', 'X-ray', 'Yoke', 'Zebra'];
const numberWords: readonly string[] = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
    'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five', 'twenty-six'];
const firstPrimes: readonly number[] = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101];
// The five-bit teleprinter code ITA2, letters only, with the highest bit first.
const baudotCodes: readonly number[] = [0x03, 0x19, 0x0e, 0x09, 0x01, 0x0d, 0x1a, 0x14, 0x06, 0x0b, 0x0f, 0x12, 0x1c, 0x0c, 0x18, 0x16, 0x17, 0x0a, 0x05, 0x10, 0x07, 0x1e, 0x13, 0x1d, 0x15, 0x11];
const baudotSpace = 0x04;

const phoneKeys: readonly string[] = ['abc', 'def', 'ghi', 'jkl', 'mno', 'pqrs', 'tuv', 'wxyz'];
const keyboardRows: readonly string[] = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const brailleAlphabet = '⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚⠅⠇⠍⠝⠕⠏⠟⠗⠎⠞⠥⠧⠺⠭⠽⠵';
const adfgvxLabels = 'ADFGVX';
const dnaBases = 'ACGT';
const upsideDownLetters = 'ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz';
const qwertyOrder = 'qwertyuiopasdfghjklzxcvbnm';
const qwertyKeys = 'qwertyuiopasdfghjkl;zxcvbnm,./';
const dvorakKeys = '\',.pyfgcrlaoeuidhtns;qjkxbmwvz';
const colemakKeys = 'qwfpgjluy;arstdhneiozxcvbkm,./';
const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const letterShifts = Array.from({ length: 25 }, (_, index) => index + 1).filter((shift) => shift !== 3 && shift !== 13);
const railCounts: readonly number[] = [3, 2, 4];
const scytaleWidths: readonly number[] = [3, 4, 5];
const longestUuencodedLine = 45;
const elementSymbols = ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh '
    + 'Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa '
    + 'U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg').split(' ');
const atomicNumbers = new Map(elementSymbols.map((symbol, index) => [symbol.toLowerCase(), index + 1]));

const romanNumerals: readonly (readonly [number, string])[] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

const leetSubstitutions: Readonly<Record<string, string>> = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7' };

const matching = (pattern: RegExp) => (text: string): boolean => pattern.test(text);
const anything = matching(/^[\s\S]{2,}$/);
const printable = matching(/^[ -~]+$/);
const lowerWords = matching(/^[a-z]+( [a-z]+)*$/);
const plainWords = matching(/^[a-z0-9]+( [a-z0-9]+)*$/);
// Letters are swapped and digits and spaces are left alone, so there has to be a letter and no capital.
const lettered = matching(/^(?=.*[a-z])[a-z0-9]+( [a-z0-9]+)*$/);
const numbered = matching(/^(?=.*\d)[a-z0-9]+( [a-z0-9]+)*$/);

const letterIndex = (letter: string): number => letter.charCodeAt(0) - 97;
const letterAt = (index: number): string => alphabet[((index % 26) + 26) % 26]!;
const codeOf = (character: string): number => character.charCodeAt(0);
const fromCodes = (codes: readonly number[]): string => codes.map((code) => String.fromCharCode(code)).join('');
const bitsOf = (text: string): string => [...text].map((character) => codeOf(character).toString(2).padStart(8, '0')).join('');
const fromBits = (bits: string): string => fromCodes((bits.match(/.{8}/g) ?? []).map((byte) => Number.parseInt(byte, 2)));
const chunks = (text: string, size: number): string[] => text.match(new RegExp(`[\\s\\S]{1,${size}}`, 'g')) ?? [];
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const morseCipher = letterCode(squareGrid, (index) => morseAlphabet[squareGrid[index]!]!, ' ', ' / ');

const ciphers: Readonly<Record<Encoding, Cipher>> = {
    reversed: { encode: reverse, decode: reverse, carries: anything },
    rot13: shifted(() => 13),
    caesar: shifted(() => 3),
    shift: shifted((unit) => letterShifts[Math.floor(unit * letterShifts.length)]!),
    atbash: { ...exchanged(alphabet, reverse(alphabet)), carries: lettered },
    keyboard: { encode: (text, unit) => shiftKeys(text, keyboardShift(unit)), decode: (text, unit) => shiftKeys(text, -keyboardShift(unit)), carries: lettered },
    qwertyAlphabet: { ...exchanged(alphabet, qwertyOrder), carries: lettered },
    dvorak: { ...exchanged(dvorakKeys, qwertyKeys), carries: lowerWords },
    colemak: { ...exchanged(colemakKeys, qwertyKeys), carries: lowerWords },
    trithemius: { encode: (text) => progressiveShift(text, 1), decode: (text) => progressiveShift(text, -1), carries: lettered },
    rot47: { encode: rot47, decode: rot47, carries: printable },
    rot5: { encode: rot5, decode: rot5, carries: numbered },
    rot18: { encode: (text) => rot5(shiftLetters(text, 13)), decode: (text) => rot5(shiftLetters(text, 13)), carries: plainWords },
    upsideDown: {
        encode: (text) => exchanged(alphabet, upsideDownLetters).encode(reverse(text)),
        decode: (text) => reverse(exchanged(alphabet, upsideDownLetters).decode(text)),
        carries: lowerWords,
    },
    railFence: { encode: (text, unit) => railFence(text, railCount(unit)), decode: (text, unit) => fromRailFence(text, railCount(unit)), carries: matching(/^[\s\S]{5,}$/) },
    scytale: { encode: (text, unit) => readColumns(text, scytaleWidth(unit)), decode: (text, unit) => fromColumns(text, scytaleWidth(unit)), carries: matching(/^[\s\S]{6,}$/) },
    swappedPairs: { encode: swapPairs, decode: swapPairs, carries: anything },
    a1z26: letterCode(alphabet, (index) => String(index + 1), ' ', ' / '),
    primes: letterCode(alphabet, (index) => String(firstPrimes[index]), ' ', ' / '),
    squares: letterCode(alphabet, (index) => String((index + 1) ** 2), ' ', ' / '),
    romanLetters: letterCode(alphabet, (index) => toRomanNumerals(index + 1), ' ', ' / '),
    spelledNumbers: letterCode(alphabet, (index) => numberWords[index]!, ' ', ' / '),
    morse: morseCipher,
    morseBits: letterCode(squareGrid, (index) => morseAlphabet[squareGrid[index]!]!.replace(/\./g, '0').replace(/-/g, '1'), ' ', ' / '),
    morseSwapped: letterCode(squareGrid, (index) => morseAlphabet[squareGrid[index]!]!.replace(/[.-]/g, (symbol) => (symbol === '.' ? '-' : '.')), ' ', ' / '),
    ditDah: letterCode(squareGrid, (index) => [...morseAlphabet[squareGrid[index]!]!].map((symbol) => (symbol === '.' ? 'dit' : 'dah')).join('-'), ' ', ' / '),
    pollux: {
        encode: (text, unit) => pollux(morseCipher.encode(text, 0, ''), unit),
        decode: (text) => morseCipher.decode([...text].map((digit) => ('147'.includes(digit) ? '.' : '258'.includes(digit) ? '-' : ' ')).join(''), 0, ''),
        carries: matching(/^[a-z0-9]+$/),
    },
    nato: letterCode(alphabet, (index) => natoAlphabet[index]!, ' ', ' / '),
    ableBaker: letterCode(alphabet, (index) => ableBakerAlphabet[index]!, ' ', ' / '),
    phone: letterCode(alphabet, phoneTaps, ' ', ' / '),
    braille: letterCode(alphabet, (index) => brailleAlphabet[index]!, '', ' '),
    brailleDots: letterCode(alphabet, (index) => dotNumbers(brailleDots(alphabet[index]!)), ' ', ' / '),
    tap: letterCode(tapGrid, (index) => `${'•'.repeat(Math.floor(index / 5) + 1)} ${'•'.repeat(index % 5 + 1)}`, ' / ', ' // '),
    bacon: letterCode(alphabet, (index) => index.toString(2).padStart(5, '0').replace(/0/g, 'A').replace(/1/g, 'B'), ' ', ' / '),
    polybius: letterCode(polybiusGrid, (index) => `${Math.floor(index / 5) + 1}${index % 5 + 1}`, ' ', ' / '),
    polybius6: letterCode(squareGrid, (index) => `${Math.floor(index / 6) + 1}${index % 6 + 1}`, ' ', ' / '),
    adfgvx: letterCode(squareGrid, (index) => `${adfgvxLabels[Math.floor(index / 6)]}${adfgvxLabels[index % 6]}`, ' ', ' / '),
    keyboardGrid: letterCode(alphabet, keyboardCoordinates, ' ', ' / '),
    kenny: letterCode(alphabet, (index) => index.toString(3).padStart(3, '0').replace(/[012]/g, (digit) => 'mpf'[Number(digit)]!), '', ' '),
    baudot: {
        encode: (text) => [...text].map((character) => (character === ' ' ? baudotSpace : baudotCodes[letterIndex(character)]!).toString(2).padStart(5, '0')).join(' '),
        decode: (text) => text.split(' ').map((bits) => { const code = Number.parseInt(bits, 2); return code === baudotSpace ? ' ' : alphabet[baudotCodes.indexOf(code)] ?? ''; }).join(''),
        carries: lowerWords,
    },
    elements: {
        encode: (text) => atomicNumberSpelling(text) ?? '',
        decode: (text) => text.split(' ').map((number) => elementSymbols[Number(number) - 1]?.toLowerCase() ?? '').join(''),
        carries: (text) => /^[a-z]+$/.test(text) && atomicNumberSpelling(text) !== null,
    },
    base36: {
        encode: (text) => text.split(' ').map((word) => [...word].reduce((value, character) => value * 36n + BigInt(Number.parseInt(character, 36) || 0), 0n).toString()).join(' '),
        decode: (text) => text.split(' ').map((number) => BigInt(number).toString(36)).join(' '),
        carries: matching(/^[a-z1-9][a-z0-9]*( [a-z1-9][a-z0-9]*)*$/),
    },
    binary: characterCodes(2, 8),
    octal: characterCodes(8, 3),
    hex: characterCodes(16, 2),
    ascii: characterCodes(10, 1),
    ternary: characterCodes(3, 5),
    roman: {
        encode: (text) => [...text].map((character) => toRomanNumerals(codeOf(character))).join(' '),
        decode: (text) => fromCodes(text.split(' ').map(fromRomanNumerals)),
        carries: printable,
    },
    arithmetic: {
        encode: (text, unit) => [...text].map((character, index) => splitSum(codeOf(character), fraction(unit * 997 + index * 0.618))).join('  '),
        decode: (text) => fromCodes(text.split('  ').map((sum) => sum.split('+').reduce((total, part) => total + Number(part), 0))),
        carries: printable,
    },
    dna: {
        encode: (text) => [...text].map((character) => codeOf(character).toString(4).padStart(4, '0').replace(/[0-3]/g, (digit) => dnaBases[Number(digit)]!)).join(' '),
        decode: (text) => fromCodes(text.split(' ').map((bases) => Number.parseInt([...bases].map((base) => dnaBases.indexOf(base)).join(''), 4))),
        carries: printable,
    },
    ebcdic: ebcdic(),
    url: escapes('%', '', 16, 2, true),
    entities: escapes('&#', ';', 10, 1),
    hexEntities: escapes('&#x', ';', 16, 2),
    unicodeEscapes: escapes('\\u', '', 16, 4),
    hexEscapes: escapes('\\x', '', 16, 2),
    octalEscapes: escapes('\\', '', 8, 3),
    quotedPrintable: escapes('=', '', 16, 2, true),
    codepoints: {
        encode: (text) => `String.fromCharCode(${[...text].map(codeOf).join(', ')})`,
        decode: (text) => fromCodes((text.match(/\d+/g) ?? []).map(Number)),
        carries: printable,
    },
    base64: { encode: (text) => btoa(text), decode: (text) => atob(text), carries: printable },
    base32: {
        encode: (text) => {
            const encoded = chunks(bitsOf(text), 5).map((group) => base32Alphabet[Number.parseInt(group.padEnd(5, '0'), 2)]!).join('');
            return encoded.padEnd(Math.ceil(encoded.length / 8) * 8, '=');
        },
        decode: (text) => fromBits([...text.replace(/=+$/, '')].map((character) => base32Alphabet.indexOf(character).toString(2).padStart(5, '0')).join('')),
        carries: printable,
    },
    ascii85: { encode: toAscii85, decode: fromAscii85, carries: printable },
    uuencode: { encode: toUuencode, decode: fromUuencode, carries: (text) => printable(text) && text.length <= longestUuencodedLine },
    utf16: {
        encode: (text) => chunks(text, 2).map((pair) => String.fromCharCode(codeOf(pair) | ((pair.charCodeAt(1) || 0) << 8))).join(''),
        decode: (text) => [...text].map((character) => fromCodes([codeOf(character) & 255, codeOf(character) >> 8])).join(''),
        carries: (text) => printable(text) && text.length % 2 === 0,
    },
    whitespace: bitCode(' ', '\t'),
    zeroWidth: bitCode('​', '‌'),
    vigenere: { encode: (text, _unit, key) => keyShift(text, key, 1), decode: (text, _unit, key) => keyShift(text, key, -1), carries: lettered },
    gronsfeld: { encode: (text, _unit, key) => keyShift(text, key, 1), decode: (text, _unit, key) => keyShift(text, key, -1), carries: lettered },
    beaufort: { encode: (text, _unit, key) => beaufort(text, key), decode: (text, _unit, key) => beaufort(text, key), carries: lettered },
    autokey: {
        encode: (text, _unit, key) => {
            const stream = [...key];
            return text.replace(/[a-z]/g, (letter) => {
                stream.push(letter);
                return letterAt(letterIndex(letter) + letterIndex(stream.shift()!));
            });
        },
        decode: (text, _unit, key) => {
            const stream = [...key];
            return text.replace(/[a-z]/g, (letter) => {
                const plain = letterAt(letterIndex(letter) - letterIndex(stream.shift()!));
                stream.push(plain);
                return plain;
            });
        },
        carries: lettered,
    },
    keyedAlphabet: {
        encode: (text, _unit, key) => exchanged(alphabet, keyedLetters(key)).encode(text),
        decode: (text, _unit, key) => exchanged(alphabet, keyedLetters(key)).decode(text),
        carries: lettered,
    },
    affine: {
        encode: (text, _unit, key) => { const [slope, offset] = affineKey(key); return text.replace(/[a-z]/g, (letter) => letterAt(slope * letterIndex(letter) + offset)); },
        decode: (text, _unit, key) => {
            const [slope, offset] = affineKey(key);
            const inverse = Array.from({ length: 26 }, (_, index) => index).find((candidate) => (slope * candidate) % 26 === 1) ?? 1;
            return text.replace(/[a-z]/g, (letter) => letterAt(inverse * (letterIndex(letter) - offset + 26)));
        },
        carries: lettered,
    },
    columnar: { encode: (text, _unit, key) => toColumnar(text, key), decode: (text, _unit, key) => fromColumnar(text, key), carries: matching(/^[\s\S]{8,}$/) },
    nihilist: {
        encode: (text, _unit, key) => [...text].map((letter, index) => squareNumber(letter) + squareNumber(key[index % key.length]!)).join(' '),
        decode: (text, _unit, key) => text.split(' ').map((number, index) => {
            const value = Number(number) - squareNumber(key[index % key.length]!);
            return polybiusGrid[(Math.floor(value / 10) - 1) * 5 + value % 10 - 1] ?? '';
        }).join(''),
        carries: matching(/^[a-ik-z]+$/),
    },
    xor: {
        encode: (text, _unit, key) => [...text].map((character) => (codeOf(character) ^ Number(key)).toString(16).padStart(2, '0')).join(' '),
        decode: (text, _unit, key) => fromCodes(text.split(' ').map((code) => Number.parseInt(code, 16) ^ Number(key))),
        carries: printable,
    },
    romanNumeral: {
        encode: (text) => toRomanNumerals(Number(text)),
        decode: (text) => String(fromRomanNumerals(text)),
        carries: (text) => /^[1-9]\d{0,3}$/.test(text) && Number(text) < 4000,
    },
    binaryNumber: { encode: (text) => Number(text).toString(2), decode: (text) => String(Number.parseInt(text, 2)), carries: matching(/^[1-9]\d{0,8}$/) },
    hexNumber: { encode: (text) => Number(text).toString(16), decode: (text) => String(Number.parseInt(text, 16)), carries: matching(/^[1-9]\d{0,8}$/) },
    sum: {
        encode: (text, unit) => {
            const first = firstYear + Math.floor(fraction(unit * 7) * (Number(text) - firstYear));
            return `${first} + ${Number(text) - first}`;
        },
        decode: (text) => String(text.split(' + ').reduce((total, part) => total + Number(part), 0)),
        carries: (text) => /^[1-9]\d{3}$/.test(text) && Number(text) >= firstYear,
    },
    romanDate: {
        encode: (text) => [text.slice(0, 2), text.slice(2, 4), text.slice(4)].map((part) => toRomanNumerals(Number(part))).join(' . '),
        decode: (text) => text.split(' . ').map((part, index) => String(fromRomanNumerals(part)).padStart(index === 2 ? 4 : 2, '0')).join(''),
        carries: matching(/^(0[1-9]|[12]\d|3[01])(0[1-9]|1[0-2])[1-3]\d{3}$/),
    },
};

export const encodings = Object.keys(ciphers) as readonly Encoding[];

export function encode(text: string, encoding: Encoding, unit = 0, key = ''): string {
    return ciphers[encoding].encode(text, unit, key);
}

export function decode(text: string, encoding: Encoding, unit = 0, key = ''): string {
    return ciphers[encoding].decode(text, unit, key);
}

export function carries(text: string, encoding: Encoding): boolean {
    return ciphers[encoding].carries(text);
}

export function keyboardShift(unit: number): number {
    return unit < 0.5 ? 1 : -1;
}

export function atomicNumberSpelling(word: string): string | null {
    const spellings: (number[] | null)[] = [[], ...Array.from({ length: word.length }, () => null)];
    for (let end = 1; end <= word.length; end++) {
        for (const length of [2, 1]) {
            const before = spellings[end - length];
            const number = atomicNumbers.get(word.slice(end - length, end));
            if (before !== null && before !== undefined && number !== undefined) {
                spellings[end] = [...before, number];
                break;
            }
        }
    }
    return spellings[word.length]?.join(' ') ?? null;
}

export function characterColors(text: string): string[] {
    const codes = [...text].map(codeOf);
    while (codes.length % 3 !== 0) codes.push(0);
    return Array.from({ length: codes.length / 3 }, (_, index) => `#${codes.slice(index * 3, index * 3 + 3).map((code) => code.toString(16).padStart(2, '0')).join('')}`);
}

export function morseCode(character: string): string | undefined {
    return morseAlphabet[character];
}

export function brailleDots(letter: string): number {
    return (brailleAlphabet.codePointAt(letterIndex(letter)) ?? 0x2800) - 0x2800;
}

// The patterns of the barcode Code 39 for a text: nine elements a character, bars and spaces in turn, three of them wide.
export function code39Patterns(text: string): string[] {
    const groups: readonly (readonly [string, number])[] = [['1234567890', 3], ['ABCDEFGHIJ', 5], ['KLMNOPQRST', 7], ['UVWXYZ-. *', 1]];
    const wideBars: readonly (readonly [number, number])[] = [[0, 8], [2, 8], [0, 2], [4, 8], [0, 4], [2, 4], [6, 8], [0, 6], [2, 6], [4, 6]];
    return [...`*${text.toUpperCase()}*`].map((character) => {
        const [characters, wideSpace] = groups.find(([members]) => members.includes(character)) ?? groups[3]!;
        const bars = wideBars[Math.max(0, characters.indexOf(character))]!;
        return Array.from({ length: 9 }, (_, element) => (element === wideSpace || bars.includes(element) ? 'w' : 'n')).join('');
    });
}

// The rows of an 80-column punched card that are punched for a character: 12, 11 and 0 are the zone rows at the top.
export function punchedRows(character: string): readonly string[] {
    if (/\d/.test(character)) return [character];
    const index = letterIndex(character.toLowerCase());
    if (index < 0 || index > 25) return [];
    return index < 9 ? ['12', String(index + 1)] : index < 18 ? ['11', String(index - 8)] : ['0', String(index - 16)];
}

function toRomanNumerals(value: number): string {
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

function fromRomanNumerals(text: string): number {
    let remaining = text;
    let value = 0;
    for (const [amount, symbol] of romanNumerals) {
        while (remaining.startsWith(symbol)) {
            value += amount;
            remaining = remaining.slice(symbol.length);
        }
    }
    return value;
}

function reverse(text: string): string {
    return [...text].reverse().join('');
}

// A cipher that writes one letter for another. What is not in its alphabet stays as it is.
function exchanged(from: string, to: string): { readonly encode: (text: string) => string; readonly decode: (text: string) => string } {
    const swap = (text: string, source: string, target: string): string => [...text].map((character) => target[source.indexOf(character)] ?? character).join('');
    return { encode: (text) => swap(text, from, to), decode: (text) => swap(text, to, from) };
}

function shifted(amount: (unit: number) => number): Cipher {
    return { encode: (text, unit) => shiftLetters(text, amount(unit)), decode: (text, unit) => shiftLetters(text, -amount(unit)), carries: lettered };
}

// A code that writes a token for each character of its alphabet, such as Morse code or the number of a letter.
function letterCode(symbols: string, token: (index: number) => string, letterSeparator: string, wordSeparator: string): Cipher {
    const tokens = [...symbols].map((_, index) => token(index));
    const carried = new RegExp(`^[${symbols}]+( [${symbols}]+)*$`);
    return {
        encode: (text) => text.split(' ').map((word) => [...word].map((character) => tokens[symbols.indexOf(character)] ?? character).join(letterSeparator)).join(wordSeparator),
        decode: (text) => text.split(wordSeparator).map((word) => (letterSeparator === '' ? chunks(word, tokens[0]!.length) : word.split(letterSeparator))
            .map((part) => symbols[tokens.indexOf(part)] ?? '').join('')).join(' '),
        carries: matching(carried),
    };
}

function characterCodes(radix: number, width: number): Cipher {
    return {
        encode: (text) => [...text].map((character) => codeOf(character).toString(radix).padStart(width, '0')).join(' '),
        decode: (text) => fromCodes(text.split(' ').map((code) => Number.parseInt(code, radix))),
        carries: printable,
    };
}

// The ways a page or a program writes a character by its number: %68, &#104;, h and so on.
function escapes(prefix: string, suffix: string, radix: number, width: number, capitals = false): Cipher {
    const number = suffix === '' ? `[0-9a-f]{${width}}` : '[0-9a-f]+';
    const pattern = new RegExp(`${escapeRegExp(prefix)}(${number})${escapeRegExp(suffix)}`, 'gi');
    return {
        encode: (text) => [...text].map((character) => {
            const code = codeOf(character).toString(radix).padStart(width, '0');
            return `${prefix}${capitals ? code.toUpperCase() : code}${suffix}`;
        }).join(''),
        decode: (text) => fromCodes([...text.matchAll(pattern)].map((match) => Number.parseInt(match[1]!, radix))),
        carries: printable,
    };
}

function bitCode(zero: string, one: string): Cipher {
    return {
        encode: (text) => [...bitsOf(text)].map((bit) => (bit === '0' ? zero : one)).join(''),
        decode: (text) => fromBits([...text].map((character) => (character === zero ? '0' : '1')).join('')),
        carries: printable,
    };
}

// The codes that IBM mainframes use in place of ASCII, for letters, digits and the space.
function ebcdic(): Cipher {
    const codes = new Map<string, number>([[' ', 0x40]]);
    const run = (characters: string, first: number): void => [...characters].forEach((character, index) => { codes.set(character, first + index); });
    run('abcdefghi', 0x81);
    run('jklmnopqr', 0x91);
    run('stuvwxyz', 0xa2);
    run('ABCDEFGHI', 0xc1);
    run('JKLMNOPQR', 0xd1);
    run('STUVWXYZ', 0xe2);
    run(digits, 0xf0);
    const characters = new Map([...codes].map(([character, code]) => [code, character]));
    return {
        encode: (text) => [...text].map((character) => (codes.get(character) ?? 0x6f).toString(16).toUpperCase()).join(' '),
        decode: (text) => text.split(' ').map((code) => characters.get(Number.parseInt(code, 16)) ?? '').join(''),
        carries: matching(/^[A-Za-z0-9 ]+$/),
    };
}

function shiftLetters(text: string, shift: number): string {
    return text.replace(/[a-z]/g, (letter) => letterAt(letterIndex(letter) + shift));
}

function progressiveShift(text: string, direction: number): string {
    let position = 0;
    return text.replace(/[a-z]/g, (letter) => letterAt(letterIndex(letter) + direction * position++));
}

function shiftKeys(text: string, shift: number): string {
    return [...text].map((character) => {
        const row = keyboardRows.find((keys) => keys.includes(character));
        if (row === undefined) return character;
        return row[(row.indexOf(character) + shift + row.length) % row.length]!;
    }).join('');
}

function rot47(text: string): string {
    return text.replace(/[!-~]/g, (character) => String.fromCharCode(33 + ((codeOf(character) - 33 + 47) % 94)));
}

function rot5(text: string): string {
    return text.replace(/\d/g, (digit) => String((Number(digit) + 5) % 10));
}

function swapPairs(text: string): string {
    return chunks(text, 2).map(reverse).join('');
}

function railCount(unit: number): number {
    return railCounts[Math.floor(unit * railCounts.length)] ?? railCounts[0]!;
}

function railOf(index: number, rails: number): number {
    const cycle = 2 * (rails - 1);
    const position = index % cycle;
    return position < rails ? position : cycle - position;
}

function railFence(text: string, rails: number): string {
    const rows = Array.from({ length: rails }, () => '');
    [...text].forEach((character, index) => { rows[railOf(index, rails)] += character; });
    return rows.join('');
}

function fromRailFence(text: string, rails: number): string {
    const characters = [...text];
    const order = characters.map((_, index) => index).sort((first, second) => railOf(first, rails) - railOf(second, rails) || first - second);
    const plain: string[] = [];
    order.forEach((position, index) => { plain[position] = characters[index]!; });
    return plain.join('');
}

function scytaleWidth(unit: number): number {
    return scytaleWidths[Math.floor(unit * scytaleWidths.length)] ?? scytaleWidths[0]!;
}

// The text written in rows of a width and read column by column, as on a strip wound around a stick.
function readColumns(text: string, width: number, order: readonly number[] = Array.from({ length: width }, (_, index) => index)): string {
    const characters = [...text];
    return order.map((column) => characters.filter((_, index) => index % width === column).join('')).join('');
}

function fromColumns(text: string, width: number, order: readonly number[] = Array.from({ length: width }, (_, index) => index)): string {
    const characters = [...text];
    const plain: string[] = [];
    let taken = 0;
    for (const column of order) {
        for (let position = column; position < characters.length; position += width) plain[position] = characters[taken++]!;
    }
    return plain.join('');
}

// The order in which the columns under a key word are read: by the alphabet, and from the left where letters are the same.
function columnOrder(key: string): number[] {
    return [...key].map((letter, index) => ({ letter, index })).sort((first, second) => (first.letter < second.letter ? -1 : first.letter > second.letter ? 1 : first.index - second.index))
        .map(({ index }) => index);
}

function toColumnar(text: string, key: string): string {
    return readColumns(text, key.length, columnOrder(key));
}

function fromColumnar(text: string, key: string): string {
    return fromColumns(text, key.length, columnOrder(key));
}

function keyShifts(key: string): number[] {
    return [...key].map((character) => (/\d/.test(character) ? Number(character) : letterIndex(character)));
}

function keyShift(text: string, key: string, direction: number): string {
    const shifts = keyShifts(key);
    let position = 0;
    return text.replace(/[a-z]/g, (letter) => letterAt(letterIndex(letter) + direction * shifts[position++ % shifts.length]!));
}

function beaufort(text: string, key: string): string {
    const shifts = keyShifts(key);
    let position = 0;
    return text.replace(/[a-z]/g, (letter) => letterAt(shifts[position++ % shifts.length]! - letterIndex(letter)));
}

function keyedLetters(key: string): string {
    return [...new Set(`${key}${alphabet}`)].join('');
}

// An affine key is written as a line: 5x+8.
function affineKey(key: string): [number, number] {
    const [slope = '1', offset = '0'] = key.split('x+');
    return [Number(slope), Number(offset)];
}

function squareNumber(letter: string): number {
    const index = polybiusGrid.indexOf(letter);
    return (Math.floor(index / 5) + 1) * 10 + index % 5 + 1;
}

function dotNumbers(dots: number): string {
    return Array.from({ length: 6 }, (_, index) => index).filter((index) => (dots >> index) & 1).map((index) => index + 1).join('');
}

function phoneTaps(index: number): string {
    const letter = alphabet[index]!;
    const key = phoneKeys.findIndex((letters) => letters.includes(letter));
    return String(key + 2).repeat(phoneKeys[key]!.indexOf(letter) + 1);
}

function keyboardCoordinates(index: number): string {
    const letter = alphabet[index]!;
    const row = keyboardRows.findIndex((keys) => keys.includes(letter));
    return `${'ABC'[row]}${keyboardRows[row]!.indexOf(letter) + 1}`;
}

function splitSum(code: number, unit: number): string {
    const first = 10 + Math.floor(unit * (code - 19));
    return `${first}+${code - first}`;
}

function pollux(morse: string, unit: number): string {
    const choicesOf: Readonly<Record<string, string>> = { '.': '147', '-': '258' };
    return [...morse.replaceAll(' / ', ' ')].map((symbol, index) => {
        const choices = choicesOf[symbol] ?? '0369';
        return choices[Math.floor(fraction(unit * 31 + index * 0.618) * choices.length)]!;
    }).join('');
}

function toAscii85(text: string): string {
    const codes = [...text].map(codeOf);
    let encoded = '';
    for (let start = 0; start < codes.length; start += 4) {
        const group = codes.slice(start, start + 4);
        let value = 0;
        for (let index = 0; index < 4; index++) value = value * 256 + (group[index] ?? 0);
        let block = '';
        for (let index = 0; index < 5; index++) {
            block = `${String.fromCharCode(33 + value % 85)}${block}`;
            value = Math.floor(value / 85);
        }
        encoded += block.slice(0, group.length + 1);
    }
    return `<~${encoded}~>`;
}

function fromAscii85(text: string): string {
    const characters = [...text.replace(/^<~|~>$/g, '')];
    let decoded = '';
    for (let start = 0; start < characters.length; start += 5) {
        const group = characters.slice(start, start + 5);
        let value = 0;
        for (let index = 0; index < 5; index++) value = value * 85 + codeOf(group[index] ?? 'u') - 33;
        const codes = [Math.floor(value / 16_777_216) % 256, Math.floor(value / 65_536) % 256, Math.floor(value / 256) % 256, value % 256];
        decoded += fromCodes(codes.slice(0, group.length - 1));
    }
    return decoded;
}

// One line of a uuencoded file: the count of characters, then four characters for every three.
function toUuencode(text: string): string {
    const character = (sextet: number): string => (sextet === 0 ? '`' : String.fromCharCode(32 + sextet));
    const codes = [...text].map(codeOf);
    let line = character(codes.length);
    for (let start = 0; start < codes.length; start += 3) {
        const [first = 0, second = 0, third = 0] = codes.slice(start, start + 3);
        line += `${character(first >> 2)}${character(((first & 3) << 4) | (second >> 4))}${character(((second & 15) << 2) | (third >> 6))}${character(third & 63)}`;
    }
    return line;
}

function fromUuencode(line: string): string {
    const sextets = [...line].map((character) => (codeOf(character) - 32) & 63);
    let decoded = '';
    for (let start = 1; start < sextets.length; start += 4) {
        const [first = 0, second = 0, third = 0, fourth = 0] = sextets.slice(start, start + 4);
        decoded += fromCodes([(first << 2) | (second >> 4), ((second & 15) << 4) | (third >> 2), ((third & 3) << 6) | fourth]);
    }
    return decoded.slice(0, sextets[0] ?? 0);
}
