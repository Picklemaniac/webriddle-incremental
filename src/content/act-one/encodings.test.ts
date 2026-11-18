import { describe, expect, it } from 'vitest';
import { atomicNumberSpelling, brailleDots, carries, code39Patterns, decode, encode, encodings, punchedRows, type Encoding } from './encodings.ts';
import { vocabularySize, wordAtRank } from './vocabulary.ts';

const keys: Readonly<Partial<Record<Encoding, string>>> = {
    vigenere: 'lemon', beaufort: 'lemon', autokey: 'queenly', keyedAlphabet: 'zebras', columnar: 'zebras', nihilist: 'lemon', gronsfeld: '31415', affine: '5x+8', xor: '42',
};
const units: readonly number[] = [0, 0.37, 0.74, 0.99];
const words = Array.from({ length: 140 }, (_, index) => wordAtRank(1 + index * Math.floor(vocabularySize / 140)));
const samples: readonly string[] = [
    ...words, 'first second', 'lonely farm house', 'l1ght', 'w1ldfl0w3rs', 'sun42', '2006', '1208', '14071789', 'SUNSHINE', 'Hello, World! 42', 'a b', 'quiz jack',
];

describe('encodings', () => {
    it.each([
        ['reversed', 'dusk', 'ksud'],
        ['a1z26', 'mirror', '13 9 18 18 15 18'],
        ['rot13', 'mirror', 'zveebe'],
        ['caesar', 'abc xyz', 'def abc'],
        ['atbash', 'midnight', 'nrwmrtsg'],
        ['keyboard', 'owl', 'pea'],
        ['morse', 'sos', '... --- ...'],
        ['nato', 'owl', 'Oscar Whiskey Lima'],
        ['phone', 'dusk', '3 88 7777 55'],
        ['braille', 'ab cd', '⠁⠃ ⠉⠙'],
        ['tap', 'oc', '••• •••• / • •••'],
        ['bacon', 'ab', 'AAAAA AAAAB'],
        ['polybius', 'az', '11 55'],
        ['polybius6', 'az', '11 52'],
        ['adfgvx', 'az', 'AA VD'],
        ['binary', 'hi', '01101000 01101001'],
        ['octal', 'hi', '150 151'],
        ['hex', 'hi', '68 69'],
        ['ascii', 'hi', '104 105'],
        ['roman', 'hi', 'CIV CV'],
        ['url', 'hi', '%68%69'],
        ['entities', 'hi', '&#104;&#105;'],
        ['base64', 'owl', 'b3ds'],
        ['dna', 'a', 'CGAC'],
        ['codepoints', 'hi', 'String.fromCharCode(104, 105)'],
        ['rot47', 'hi', '9:'],
        ['railFence', 'bridge', 'bgrdei'],
        ['upsideDown', 'dusk', 'ʞsnp'],
        ['dvorak', 'dusk', 'hf;v'],
        ['base36', 'dusk', '646436'],
        ['keyboardGrid', 'dusk', 'B3 A7 B2 B8'],
        ['utf16', 'dusk', '畤歳'],
        ['base32', 'foobar', 'MZXW6YTBOI======'],
        ['ascii85', 'Man ', '<~9jqo^~>'],
        ['uuencode', 'Cat', '#0V%T'],
        ['quotedPrintable', 'hi', '=68=69'],
        ['hexEntities', 'hi', '&#x68;&#x69;'],
        ['unicodeEscapes', 'hi', '\\u0068\\u0069'],
        ['hexEscapes', 'hi', '\\x68\\x69'],
        ['octalEscapes', 'hi', '\\150\\151'],
        ['ebcdic', 'aA0 z', '81 C1 F0 40 A9'],
        ['baudot', 'eat', '00001 00011 10000'],
        ['ternary', 'a', '10121'],
        ['primes', 'abz', '2 3 101'],
        ['squares', 'abz', '1 4 676'],
        ['romanLetters', 'abz', 'I II XXVI'],
        ['spelledNumbers', 'tau', 'twenty, one, twenty-one'],
        ['brailleDots', 'abc', '1 12 14'],
        ['ableBaker', 'ab', 'Able Baker'],
        ['kenny', 'abc', 'mmmmmpmmf'],
        ['qwertyAlphabet', 'abc', 'qwe'],
        ['colemak', 'of', ';e'],
        ['trithemius', 'aaaa', 'abcd'],
        ['swappedPairs', 'bridge', 'rbdieg'],
        ['rot5', '2006', '7551'],
        ['rot18', 'l1ght', 'y6tug'],
        ['morseBits', 'sos', '000 111 000'],
        ['morseSwapped', 'sos', '--- ... ---'],
        ['ditDah', 'an', 'dit-dah dah-dit'],
        ['whitespace', 'a', ' \t\t    \t'],
        ['romanNumeral', '1208', 'MCCVIII'],
        ['binaryNumber', '1208', '10010111000'],
        ['hexNumber', '1208', '4b8'],
        ['romanDate', '14071789', 'XIV . VII . MDCCLXXXIX'],
    ] as const)('encodes with %s', (encoding, text, expected) => {
        expect(encode(text, encoding)).toBe(expected);
        expect(decode(expected, encoding)).toBe(text);
    });

    it.each([
        ['vigenere', 'attackatdawn', 'lemon', 'lxfopvefrnhr'],
        ['autokey', 'attackatdawn', 'queenly', 'qnxepvytwtwp'],
        ['keyedAlphabet', 'flee at once', 'zebras', 'siaa zq lkba'],
        ['columnar', 'wearediscoveredfleeatonce', 'zebras', 'evlnacdtesearofodeecwiree'],
        ['affine', 'affine cipher', '5x+8', 'ihhwvc swfrcp'],
        ['gronsfeld', 'abc', '123', 'bdf'],
        ['beaufort', 'b', 'a', 'z'],
        ['xor', 'a', '42', '4b'],
    ] as const)('encodes with %s and a key', (encoding, text, key, expected) => {
        expect(encode(text, encoding, 0, key)).toBe(expected);
        expect(decode(expected, encoding, 0, key)).toBe(text);
    });

    it.each(encodings)('gives back what %s was given, for every text it carries', (encoding) => {
        const carried = samples.filter((text) => carries(text, encoding));
        expect(carried.length, encoding).toBeGreaterThan(0);
        for (const text of carried) {
            for (const unit of units) {
                const encoded = encode(text, encoding, unit, keys[encoding]);
                expect(decode(encoded, encoding, unit, keys[encoding]), `${encoding} of "${text}" at ${unit}: ${encoded}`).toBe(text);
            }
        }
    });

    it('carries every plain word with the codes that write a token for each letter', () => {
        const letterCodes: readonly Encoding[] = ['a1z26', 'primes', 'squares', 'romanLetters', 'spelledNumbers', 'morse', 'morseBits', 'morseSwapped', 'ditDah', 'nato', 'ableBaker',
            'phone', 'braille', 'brailleDots', 'bacon', 'keyboardGrid', 'kenny', 'baudot', 'polybius6', 'adfgvx', 'binary', 'hex', 'base64', 'base32', 'rot13', 'atbash'];
        for (const encoding of letterCodes) expect(words.filter((word) => !carries(word, encoding)), encoding).toEqual([]);
        expect(words.filter((word) => !carries(word, 'polybius')).every((word) => word.includes('j'))).toBe(true);
        expect(words.filter((word) => !carries(word, 'tap')).every((word) => word.includes('k'))).toBe(true);
    });

    it('does not carry capitals with a cipher that only swaps small letters', () => {
        for (const encoding of ['rot13', 'atbash', 'caesar', 'shift', 'vigenere', 'morse', 'a1z26'] as const) expect(carries('SUNSHINE', encoding), encoding).toBe(false);
        for (const encoding of ['hex', 'binary', 'base64', 'reversed', 'ebcdic'] as const) expect(carries('SUNSHINE', encoding), encoding).toBe(true);
    });

    it('splits character codes into sums that add up', () => {
        const sums = encode('owl', 'arithmetic', 0.37).split('  ');
        expect(sums.map((sum) => String.fromCharCode(sum.split('+').reduce((total, part) => total + Number(part), 0))).join('')).toBe('owl');
    });

    it('shifts by an amount other than the Caesar and ROT13 shifts', () => {
        for (const unit of [0, 0.3, 0.6, 0.99]) {
            const shift = (encode('a', 'shift', unit).charCodeAt(0) - 97 + 26) % 26;
            expect([0, 3, 13]).not.toContain(shift);
            expect(encode('zebra', 'shift', unit)).toBe([...'zebra'].map((letter) => String.fromCharCode(((letter.charCodeAt(0) - 97 + shift) % 26) + 97)).join(''));
        }
    });

    it('spells words with element symbols and reads Braille dots', () => {
        expect(atomicNumberSpelling('bacon')).toBe('56 27 7');
        expect(atomicNumberSpelling('jam')).toBeNull();
        expect(encode('bacon', 'elements')).toBe('56 27 7');
        expect(decode('56 27 7', 'elements')).toBe('bacon');
        expect(carries('jam', 'elements')).toBe(false);
        expect(brailleDots('a')).toBe(1);
        expect(brailleDots('z')).toBe(0b110101);
    });

    it('writes Morse as Pollux digits', () => {
        const morse = encode('sos', 'morse');
        const digits = encode('sos', 'pollux', 0.42);
        const decoded = [...digits].map((digit) => ('147'.includes(digit) ? '.' : '258'.includes(digit) ? '-' : ' ')).join('');
        expect(decoded).toBe(morse);
    });

    it('writes a sum that adds up to the year', () => {
        for (const unit of units) {
            const [first, second] = encode('1208', 'sum', unit).split(' + ').map(Number);
            expect(first! + second!).toBe(1208);
            expect(first).toBeGreaterThanOrEqual(1000);
        }
    });

    it('draws the bars of Code 39 and the holes of a punched card as the real ones', () => {
        expect(code39Patterns('a')).toEqual(['nwnnwnwnn', 'wnnnnwnnw', 'nwnnwnwnn']);
        expect(code39Patterns('07')).toEqual(['nwnnwnwnn', 'nnnwwnwnn', 'nnnwnnwnw', 'nwnnwnwnn']);
        for (const pattern of code39Patterns('riddle 2006')) expect([...pattern].filter((element) => element === 'w')).toHaveLength(3);
        expect(punchedRows('a')).toEqual(['12', '1']);
        expect(punchedRows('r')).toEqual(['11', '9']);
        expect(punchedRows('s')).toEqual(['0', '2']);
        expect(punchedRows('7')).toEqual(['7']);
    });
});
