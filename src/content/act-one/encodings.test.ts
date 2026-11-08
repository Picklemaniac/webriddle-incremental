import { describe, expect, it } from 'vitest';
import { atomicNumberSpelling, brailleDots, encode, vigenere } from './encodings.ts';

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
        ['tap', 'ok', '••• •••• / • •••'],
        ['bacon', 'ab', 'AAAAA AAAAB'],
        ['polybius', 'az', '11 52'],
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
        ['utf16', 'dusk', '\u7564\u6b73'],
    ] as const)('encodes with %s', (encoding, text, expected) => {
        expect(encode(text, encoding)).toBe(expected);
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

    it('applies a Vigenère key and spells words with element symbols', () => {
        expect(vigenere('attackatdawn', 'lemon')).toBe('lxfopvefrnhr');
        expect(atomicNumberSpelling('bacon')).toBe('56 27 7');
        expect(atomicNumberSpelling('jam')).toBeNull();
        expect(brailleDots('a')).toBe(1);
        expect(brailleDots('z')).toBe(0b110101);
    });

    it('writes Morse as Pollux digits', () => {
        const morse = encode('sos', 'morse');
        const digits = encode('sos', 'pollux', 0.42);
        const decoded = [...digits].map((digit) => ('147'.includes(digit) ? '.' : '258'.includes(digit) ? '-' : ' ')).join('');
        expect(decoded).toBe(morse);
    });
});
