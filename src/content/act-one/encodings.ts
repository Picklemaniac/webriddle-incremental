export type Encoding = 'plain' | 'reversed' | 'a1z26' | 'rot13' | 'morse' | 'binary';

const morseAlphabet: Readonly<Record<string, string>> = {
    a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---',
    k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-',
    u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..',
    0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};

const romanNumerals: readonly (readonly [number, string])[] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

const leetSubstitutions: Readonly<Record<string, string>> = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7' };

export function encode(text: string, encoding: Encoding): string {
    switch (encoding) {
        case 'plain':
            return text;
        case 'reversed':
            return [...text].reverse().join('');
        case 'a1z26':
            return text.split(' ').map((word) => [...word].map(letterNumber).join(' ')).join(' / ');
        case 'rot13':
            return text.replace(/[a-z]/g, (letter) => String.fromCharCode(((letter.charCodeAt(0) - 97 + 13) % 26) + 97));
        case 'morse':
            return text.split(' ').map((word) => [...word].map((character) => morseAlphabet[character] ?? character).join(' ')).join(' / ');
        case 'binary':
            return [...text].map((character) => character.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
    }
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

function letterNumber(letter: string): string {
    const code = letter.charCodeAt(0) - 96;
    return code >= 1 && code <= 26 ? String(code) : letter;
}
