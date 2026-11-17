import { lineUp, shownTexts, variant, withLine, type AlternateExtension, type Clue, type ClueContext, type HintKey, type Part, type Recent, type Step } from './clues.ts';
import type { DrawingKind } from './drawings.ts';
import { carries, encode, keyboardShift, type Encoding } from './encodings.ts';
import {
    acrostic, baconCase, baconFonts, boldLetters, capitals, checkboxes, diagonal, earlierReferences, everyThird, fakeTags, interleaved, lastLetters, letterChart, letterGrid, scrambled,
} from './readings.ts';
import { fraction, pickByUnit, ramp, salts, textSeed, unitHash } from './riddle.ts';
import type { Sound } from './sounds.ts';
import { placed, placedAt } from './spots.ts';
import { wordAtRank } from './vocabulary.ts';

export type { Clue, Part, Recent, Step } from './clues.ts';

interface Hint {
    readonly place: 'title' | 'line';
    readonly key: HintKey | ((context: ClueContext) => HintKey);
}

interface Method {
    readonly name: string;
    readonly fromLevel: number;
    readonly encoding?: Encoding;
    readonly htmOnly?: boolean;
    // Takes the answer as it is: no cipher goes under it.
    readonly exact?: boolean;
    // Shows the text it is given as it is, so a cipher has to go under it.
    readonly bare?: boolean;
    // Can hold a code or another encoding, and not only letters.
    readonly open?: boolean;
    // How many things there are to undo in the method itself: two for a picture of a code.
    readonly ownSteps?: number;
    // What it can be given. Without this it takes small letters only.
    readonly takes?: (text: string) => boolean;
    readonly hint?: Hint;
    readonly clue: (context: ClueContext) => Clue | null;
}

// What a picture, a sound or a pattern spells out, when that is not the letters themselves.
interface Reads {
    readonly hint?: Hint;
    readonly via?: Encoding;
    // The picture or sound is made from the word itself and works the code out.
    readonly raw?: boolean;
    readonly open?: boolean;
    readonly takes?: (text: string) => boolean;
}

type Family = 'letters' | 'code' | 'bytes';

interface Chain {
    readonly word: string;
    readonly inner: readonly Step[];
}

const keyRanks = 300;
const letterLayers: readonly Encoding[] = ['reversed', 'rot13', 'atbash', 'caesar'];
const codeLayers: readonly Encoding[] = ['morse', 'a1z26', 'nato', 'phone', 'polybius', 'primes', 'tap', 'romanLetters', 'morseBits', 'bacon'];
const byteLayers: readonly Encoding[] = ['binary', 'hex', 'ascii', 'hexEntities', 'url', 'base32', 'entities', 'quotedPrintable', 'octal', 'base64'];
const layersOf: Readonly<Record<Family, readonly Encoding[]>> = { letters: letterLayers, code: codeLayers, bytes: byteLayers };
// The ciphers that go under a method, outermost first. A chain stays fair when each text on the way can be told for what it is: bytes around a code around letters.
const openChains: Readonly<Record<number, readonly (readonly Family[])[]>> = {
    1: [['letters'], ['code'], ['bytes']],
    2: [['code', 'letters'], ['bytes', 'letters'], ['bytes', 'code']],
    3: [['bytes', 'code', 'letters'], ['code', 'letters', 'letters'], ['bytes', 'letters', 'letters'], ['bytes', 'bytes', 'letters'], ['bytes', 'bytes', 'code']],
};
const letterChains: Readonly<Record<number, readonly (readonly Family[])[]>> = { 1: [['letters']], 2: [['letters', 'letters']] };
// Two ciphers that swap letters make one cipher that nobody would look for, and so do two that move them. Under one of these goes at most one of the other kind.
const swapsLetters: ReadonlySet<Encoding> = new Set<Encoding>(['rot13', 'caesar', 'shift', 'atbash', 'keyboard', 'qwertyAlphabet', 'trithemius', 'dvorak', 'colemak', 'vigenere', 'gronsfeld',
    'beaufort', 'autokey', 'keyedAlphabet', 'affine']);
const movesLetters: ReadonlySet<Encoding> = new Set<Encoding>(['reversed', 'upsideDown', 'railFence', 'scytale', 'swappedPairs', 'columnar']);
// The ciphers that look the same whatever they hold, so that a code or another of them can go under one. ROT47 is not one of them: over digits it comes out as plain letters.
const byteCiphers: ReadonlySet<Encoding> = new Set<Encoding>(['binary', 'octal', 'hex', 'ascii', 'ternary', 'roman', 'arithmetic', 'dna', 'url', 'entities', 'hexEntities', 'unicodeEscapes',
    'hexEscapes', 'octalEscapes', 'quotedPrintable', 'codepoints', 'base64', 'base32', 'ascii85', 'uuencode', 'ebcdic', 'utf16', 'xor']);
// Encodings that can be told for what they are without a hint. The clues for answers that are not one plain word use these.
const plainlyRead: ReadonlySet<Encoding> = new Set<Encoding>(['reversed', 'a1z26', 'rot13', 'atbash', 'morse', 'nato', 'shift', 'binary', 'upsideDown', 'phone', 'polybius', 'tap', 'hex', 'ascii',
    'bacon', 'url', 'octal', 'rot47', 'base64', 'ableBaker', 'primes', 'squares', 'spelledNumbers', 'romanLetters', 'ditDah', 'morseBits', 'hexEntities', 'base32', 'quotedPrintable',
    'hexEscapes', 'unicodeEscapes', 'octalEscapes', 'ternary']);
const leetEncodings: readonly Encoding[] = ['reversed', 'rot13', 'atbash', 'base64', 'hex', 'binary', 'ascii', 'octal', 'morse', 'ditDah', 'hexEntities', 'base32', 'quotedPrintable'];
const caseEncodings: readonly Encoding[] = ['reversed', 'base64', 'hex', 'binary', 'ascii', 'octal', 'url', 'entities', 'hexEntities', 'base32', 'quotedPrintable', 'hexEscapes'];
const digitEncodings: readonly Encoding[] = ['reversed', 'base64', 'hex', 'binary', 'ascii', 'octal', 'morse', 'ditDah', 'hexEntities', 'base32', 'quotedPrintable'];
const keyPlaces: readonly string[] = ['imageTitle', 'comment', 'meta'];
const affineSlopes: readonly number[] = [3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25];
const recentMethodCount = 20;
const oldMethodLevel = 30;
const hintedLevels = 120;
const laterHintShare = 0.5;
const longestText = 200;
const chainAttempts = 3;
// A key stands in the title as it is for the first levels of its cipher. Later it can be anywhere. From this level a key in the title is under a cipher of its own,
// and so is a share of the keys that are somewhere else.
const openKeyLevels = 60;
const firstEncodedKeyLevel = 350;
const encodedKeyShare = 0.4;
// Up to this level a clue has three things to undo at the most.
const lastThreeStepLevel = 500;
const essentialHints: ReadonlySet<HintKey> = new Set<HintKey>(['keyboardRight', 'keyboardLeft', 'earlierAnswers', 'spectrogram', 'pollux', 'shares', 'halves', 'everyThird', 'diagonal', 'mayan',
    'whitespace', 'zeroWidth', 'affine', 'keyedAlphabet', 'beaufort', 'autokey', 'columnar', 'nihilist', 'xor']);

const letters = (text: string): boolean => /^[a-z]+$/.test(text);
const pixelLetters = (text: string): boolean => /^[a-z0-9]{2,14}$/.test(text);
const within = (count: number, encoding: Encoding) => (text: string): boolean => text.length <= count && carries(text, encoding);

const methods: readonly Method[] = [
    cipher('reversed', 11),
    read('capitals', 11, 'lines', capitals, { hint: inTitle('capitals') }),
    cipher('a1z26', 12),
    read('boldLetters', 13, 'lines', boldLetters, { hint: inTitle('boldLetters') }),
    alternative('alternate', 14, ['gif', 'txt', 'json', 'css']),
    cipher('rot13', 15),
    read('interleaved', 17, 'lines', interleaved),
    cipher('morse', 19),
    read('acrostic', 21, 'lines', acrostic, { hint: inTitle('acrostic') }),
    drawn('semaphore', 23),
    cipher('atbash', 25, inTitle('atbash')),
    cipher('nato', 27),
    lettered('mirror', 30),
    read('lastLetters', 33, 'lines', lastLetters, { hint: inTitle('lastLetters') }),
    cipher('binary', 36),
    drawn('pigpen', 39),
    cipher('phone', 42, inTitle('phone')),
    cipher('caesar', 45, inTitle('caesar')),
    cipher('upsideDown', 48),
    cipher('braille', 52, inTitle('braille')),
    cipher('shift', 56, inTitle('shift')),
    drawn('tally', 60, { via: 'a1z26', takes: within(12, 'a1z26') }),
    cipher('polybius', 64, inTitle('polybius')),
    cipher('ableBaker', 68),
    drawn('flags', 72, { hint: inTitle('flags') }),
    cipher('primes', 76, inTitle('primes')),
    cipher('tap', 80, inTitle('tap')),
    drawn('tape', 84, { via: 'morse', takes: within(12, 'morse') }),
    cipher('keyboard', 90, inTitle(({ unit }) => (keyboardShift(unit) > 0 ? 'keyboardRight' : 'keyboardLeft'))),
    cipher('spelledNumbers', 95),
    cipher('romanLetters', 100),
    cipher('ditDah', 105),
    { name: 'script', fromLevel: 110, htmOnly: true, exact: true, clue: script },
    read('checkboxes', 115, 'checkboxes', checkboxes, { via: 'binary', open: true, takes: within(12, 'binary'), hint: inTitle('checkboxes') }),
    alternative('xmlFile', 120, ['xml']),
    drawn('dominoes', 122, { via: 'polybius6', takes: within(14, 'polybius6'), hint: inTitle('polybius6') }),
    read('swatches', 125, 'swatches', ({ word }) => ({ colors: characterColorsOf(word) }), { via: 'hex', open: true, takes: within(24, 'hex'), hint: inTitle('colors') }),
    read('scrambled', 128, 'lines', scrambled, { hint: inTitle('scrambled') }),
    drawn('braille', 130, { hint: inTitle('braillePicture') }),
    cipher('qwertyAlphabet', 132, inTitle('qwertyAlphabet')),
    drawn('clocks', 135, { hint: inTitle('clocks') }),
    cipher('morseBits', 138, inTitle('morseBits')),
    cipher('hex', 140),
    read('letterChart', 143, 'grid', letterChart, { hint: inTitle('letterChart'), takes: (text) => letters(text) && text.length <= 14 }),
    read('letterGrid', 145, 'grid', letterGrid, { hint: inTitle('letterGrid') }),
    drawn('sevenSegment', 148, { via: 'hex', open: true, takes: within(18, 'hex') }),
    keyed('vigenere', 150, (context) => keyWord(context)),
    alternative('wavFile', 152, ['wav']),
    cipher('ascii', 155),
    sounded('keypadTones', 'tones', 158, { via: 'phone', takes: within(12, 'phone'), hint: inTitle('phone') }),
    { name: 'earlierAnswers', fromLevel: 160, hint: onLine('earlierAnswers'), clue: earlierAnswers },
    cipher('hexEntities', 162),
    drawn('bits', 165, { via: 'binary', raw: true, open: true, takes: within(14, 'binary') }),
    read('fakeTags', 168, 'tags', fakeTags, { hint: inTitle('fakeTags') }),
    cipher('bacon', 170, onLine('bacon')),
    sounded('knocks', 'knocks', 172, { via: 'tap', takes: within(10, 'tap'), hint: inTitle('tap') }),
    sounded('morseSound', 'morse', 175, { via: 'morse', raw: true, takes: within(14, 'morse') }),
    cipher('swappedPairs', 178, inTitle('swappedPairs')),
    cipher('squares', 182, inTitle('squares')),
    cipher('dna', 185, inTitle('dna')),
    alternative('zipFile', 188, ['zip']),
    read('everyThird', 190, 'lines', everyThird, { hint: inTitle('everyThird') }),
    drawn('pixels', 192, { via: 'hex', raw: true, open: true, takes: within(24, 'hex'), hint: inTitle('pixels') }),
    drawn('barcode', 196, { takes: (text) => /^[a-z0-9]{2,12}$/.test(text) }),
    cipher('url', 200),
    { name: 'split', fromLevel: 202, exact: true, hint: onLine('halves'), clue: split },
    read('spacers', 205, 'spacers', ({ word }) => ({ spacers: [...word].map((letter) => letter.charCodeAt(0) - 96) }), { via: 'a1z26', takes: letters, hint: inTitle('spacers') }),
    keyed('gronsfeld', 208, numberKey),
    cipher('railFence', 210, inTitle('railFence')),
    cipher('base32', 214),
    lettered('tiny', 218, inTitle('tiny')),
    cipher('entities', 220),
    cipher('quotedPrintable', 222),
    lettered('rotated', 225),
    cipher('trithemius', 228, inTitle('trithemius')),
    {
        name: 'squashedPicture', fromLevel: 230, bare: true, takes: pixelLetters, hint: inTitle('squashed'),
        clue: ({ word, inner }) => ({ drawing: { kind: 'plain', text: word }, drawingDisplay: 'squashed', parts: [{ place: 'squashedPicture', reading: 'plainPicture', text: word, ciphers: inner }] }),
    },
    cipher('brailleDots', 232, inTitle('braille')),
    cipher('keyboardGrid', 235, inTitle('keyboardGrid')),
    drawn('mayan', 238, { via: 'a1z26', takes: within(12, 'a1z26'), hint: onLine('mayan') }),
    cipher('octal', 240),
    cipher('polybius6', 244, inTitle('polybius6')),
    cipher('kenny', 248, inTitle('kenny')),
    cipher('elements', 250, inTitle('elements')),
    cipher('hexEscapes', 254),
    cipher('scytale', 258, inTitle('scytale')),
    cipher('roman', 260),
    drawn('blinker', 264, { via: 'morse', takes: within(8, 'morse'), hint: inTitle('blinker') }),
    lettered('transparent', 268, inTitle('transparent')),
    cipher('rot47', 270),
    keyed('affine', 272, affineLine, onLine('affine')),
    lettered('sideways', 276, inTitle('sideways')),
    cipher('base64', 280),
    cipher('ternary', 284, inTitle('ternary')),
    read('baconFonts', 288, 'lines', baconFonts, { via: 'bacon', takes: within(12, 'bacon'), hint: onLine('bacon') }),
    { name: 'caselessBase64', fromLevel: 290, hint: inTitle('caselessBase64'), ownSteps: 2, clue: caselessBase64 },
    drawn('resistors', 293, { via: 'ascii', open: true, takes: within(15, 'ascii'), hint: inTitle('resistors') }),
    lettered('dark', 295, inTitle('dark')),
    keyed('keyedAlphabet', 297, (context) => keyWord(context), onLine('keyedAlphabet')),
    cipher('base36', 300, inTitle('base36')),
    cipher('unicodeEscapes', 305),
    cipher('arithmetic', 310),
    cipher('morseSwapped', 312, inTitle('morseSwapped')),
    drawn('greys', 318, { via: 'hex', open: true, takes: within(20, 'hex'), hint: inTitle('greys') }),
    sounded('bitTones', 'bits', 322, { via: 'binary', open: true, takes: within(10, 'binary'), hint: inTitle('bitTones') }),
    cipher('dvorak', 325, inTitle('dvorak')),
    cipher('octalEscapes', 330),
    cipher('colemak', 335, inTitle('colemak')),
    cipher('codepoints', 340),
    sounded('pulses', 'pulses', 342, { via: 'a1z26', takes: within(10, 'a1z26'), hint: inTitle('pulses') }),
    {
        name: 'renamed', fromLevel: 345, bare: true, takes: pixelLetters, hint: inTitle('renamed'),
        clue: ({ word, inner }) => ({ renamed: word, parts: [{ place: 'renamedFile', reading: 'plainPicture', text: word, ciphers: inner }] }),
    },
    read('diagonal', 348, 'lines', diagonal, { hint: inTitle('diagonal'), takes: (text) => letters(text) && text.length <= 9 }),
    drawn('punchTape', 352, { via: 'baudot', takes: within(20, 'baudot'), hint: inTitle('baudot') }),
    lettered('flash', 355, inTitle('flash')),
    keyed('beaufort', 360, (context) => keyWord(context), onLine('beaufort')),
    read('baconCase', 365, 'lines', baconCase, { via: 'bacon', takes: within(12, 'bacon'), hint: onLine('bacon') }),
    cipher('adfgvx', 370),
    cipher('baudot', 375, inTitle('baudot')),
    cipher('utf16', 380, inTitle('utf16')),
    {
        name: 'whitespace', fromLevel: 385, open: true, takes: within(12, 'whitespace'), hint: onLine('whitespace'),
        clue: ({ word, inner }) => {
            const text = encode(word, 'whitespace');
            return { comment: `[${text}]`, parts: [{ place: 'comment', text, ciphers: [{ cipher: 'whitespace' }, ...inner] }] };
        },
    },
    sounded('spectrogram', 'spectrogram', 390, { hint: onLine('spectrogram'), takes: (text) => /^[a-z0-9]{2,12}$/.test(text) }),
    keyed('columnar', 395, (context) => keyWord(context), onLine('columnar')),
    cipher('ebcdic', 402, inTitle('ebcdic')),
    cipher('pollux', 410, inTitle('pollux')),
    keyed('autokey', 424, shortKeyWord, onLine('autokey')),
    drawn('shares', 430, { hint: onLine('shares'), takes: pixelLetters }),
    lettered('delayed', 445, inTitle('delayed')),
    cipher('ascii85', 540),
    drawn('punchCard', 580, { hint: inTitle('punchCard'), takes: (text) => /^[a-z0-9]{2,20}$/.test(text) }),
    cipher('uuencode', 620, inTitle('uuencode')),
    keyed('nihilist', 680, (context) => keyWord(context, /^[a-ik-z]{4,7}$/), onLine('nihilist')),
    keyed('xor', 740, ({ level }) => String(1 + Math.floor(unitHash(level, salts.key) * 254)), onLine('xor')),
    {
        name: 'zeroWidth', fromLevel: 800, open: true, takes: within(12, 'zeroWidth'), hint: onLine('zeroWidth'),
        clue: ({ word, inner }) => {
            const text = encode(word, 'zeroWidth');
            return { lines: [text], parts: [{ place: 'lines', text, ciphers: [{ cipher: 'zeroWidth' }, ...inner] }] };
        },
    },
];

// The level at which each method starts, by its name.
export const methodLevels: ReadonlyMap<string, number> = new Map(methods.map((method) => [method.name, method.fromLevel]));

const firstLevels = new Map(methods.flatMap((method) => (method.encoding !== undefined && method.encoding === method.name ? [[method.encoding, method.fromLevel] as const] : [])));
const textEncodings = [...firstLevels].filter(([encoding]) => plainlyRead.has(encoding) && carries('ab cd', encoding));

export function wordClue(level: number, answer: string, pageName: (level: number) => string | null, withImage: boolean, recent: Recent): Clue {
    const pool = methods.filter((method) => method.fromLevel <= level && (withImage || method.htmOnly !== true));
    const unit = unitHash(level, salts.clue);
    const wanted = stepsAt(level);
    for (const method of methodOrder(pool, level, recent)) {
        const fewest = method.bare === true ? 1 : 0;
        // A method is shown on its own the first time, before anything is put under it.
        const debut = isNew(method, level, recent);
        const most = method.exact === true || debut ? fewest : Math.max(wanted - (method.ownSteps ?? 1), fewest);
        for (let layers = most; layers >= fewest; layers--) {
            const chain = chained(answer, level, method, layers);
            if (chain === null) continue;
            const context: ClueContext = { ...chain, answer, level, unit, withImage, titleFree: method.hint?.place !== 'title', pageName, recent, debut };
            const clue = method.clue(context);
            if (clue !== null && !revealsAnswer(clue, answer) && !isTooLong(clue)) return { method: method.name, ...withHint(clue, method, context) };
        }
    }
    return { method: 'rot13', ...placed(encode(answer, 'rot13'), { word: answer, answer, inner: [], level, unit, withImage, titleFree: true }, [{ cipher: 'rot13' }]) };
}

export function encodedClue(text: string, encoding: Encoding, level: number, unit: number): Clue {
    const hidden = enciphered(text, encoding, level, unit);
    const context: ClueContext = { word: text, answer: text, inner: [], level, unit, withImage: true, titleFree: true, debut: hasJustArrived(encoding, level) };
    return { method: hidden.ciphers[0]!.cipher, ...placed(hidden.text, context, hidden.ciphers) };
}

// The clue for a page behind a login: the user name and the password, in a comment.
export function credentialsClue(username: string, password: string, encoding: Encoding, level: number, unit: number, lines: readonly string[]): Clue {
    const hidden = enciphered(`${username} ${password}`, encoding, level, unit);
    return { method: hidden.ciphers[0]!.cipher, imageLink: true, lines, comment: hidden.text, parts: [{ place: 'comment', text: hidden.text, ciphers: hidden.ciphers }] };
}

export function textEncodingFor(level: number, unit: number, recent: Recent, excluded: readonly Encoding[] = []): Encoding {
    const allowed = textEncodings.filter(([encoding, fromLevel]) => fromLevel <= level && !excluded.includes(encoding)).map(([encoding]) => encoding);
    return leastRecent(allowed, (encoding) => encoding, recent, unit);
}

export function caseEncodingFor(unit: number, recent: Recent): Encoding {
    return leastRecent(caseEncodings, (encoding) => encoding, recent, unit);
}

export function dateClue(day: number, month: number, year: number, level: number, unit: number, recent: Recent): Clue {
    const digits = `${String(day).padStart(2, '0')}${String(month).padStart(2, '0')}${year}`;
    const roman = numberClue('roman', digits, 'romanDate', unit);
    const encoded = digitEncodings.map((encoding) => encodedClue(digits, encoding, level, unit));
    return leastRecent([roman, ...encoded], (clue) => clue.method ?? '', recent, unit);
}

export function leetEncodingFor(unit: number, recent: Recent): Encoding {
    return leastRecent(leetEncodings, (encoding) => encoding, recent, unit);
}

export function yearClue(year: number, level: number, unit: number, recent: Recent): Clue {
    const digits = String(year);
    const options: readonly (readonly [number, () => Clue])[] = [
        [0, () => numberClue('roman', digits, 'romanNumeral', unit)],
        [500, () => ({ method: 'phoneTones', sound: { kind: 'tones', text: digits }, parts: [{ place: 'sound', reading: 'phoneTones', text: digits, ciphers: [] }] })],
        [450, () => numberClue('binary', digits, 'binaryNumber', unit)],
        [600, () => numberClue('sum', digits, 'sum', unit)],
        [650, () => numberClue('morse', digits, 'morse', unit)],
        [700, () => numberClue('hex', digits, 'hexNumber', unit)],
    ];
    return leastRecent(options.filter(([fromLevel]) => fromLevel <= level).map(([, clue]) => clue()), (clue) => clue.method ?? '', recent, unit);
}

// A number written another way, on a line of the page.
function numberClue(method: string, digits: string, cipher: Encoding, unit: number): Clue {
    const text = encode(digits, cipher, unit);
    return { method, lines: lineUp(text), parts: [{ place: 'lines', text, ciphers: [{ cipher, unit }] }] };
}

// A text under a cipher and, where the level asks for it, under more ciphers below that one.
function enciphered(text: string, encoding: Encoding, level: number, unit: number): { readonly text: string; readonly ciphers: readonly Step[] } {
    const method = cipher(encoding, 0);
    for (let layers = hasJustArrived(encoding, level) ? 0 : stepsAt(level) - 1; layers >= 0; layers--) {
        const chain = chained(text, level, method, layers);
        if (chain === null) continue;
        const encoded = encode(chain.word, encoding, unit);
        if (encoded.length <= longestText && encoded.toLowerCase() !== text.toLowerCase()) return { text: encoded, ciphers: [{ cipher: encoding, unit }, ...chain.inner] };
    }
    return { text: encode(text, 'hex'), ciphers: [{ cipher: 'hex' }] };
}

// Whether a cipher has only just become a method of its own. A clue that is given its cipher does not know what the levels before it used, so it goes by the level:
// for that long it shows the cipher as a new method is shown, with nothing under it and in a place that the first levels teach.
function hasJustArrived(encoding: Encoding, level: number): boolean {
    return level - (firstLevels.get(encoding) ?? 0) < recentMethodCount;
}

// How many things a clue at this level is meant to have to undo: the method itself, and the ciphers under it.
function stepsAt(level: number): number {
    const roll = unitHash(level, salts.layer);
    const later = level > lastThreeStepLevel;
    const second = later ? ramp(level, lastThreeStepLevel, 1000, 0.75, 0.9) : ramp(level, 60, lastThreeStepLevel, 0.1, 0.75);
    const third = later ? ramp(level, lastThreeStepLevel, 1000, 0.25, 0.5) : ramp(level, 250, lastThreeStepLevel, 0.05, 0.25);
    const fourth = later ? ramp(level, lastThreeStepLevel, 1000, 0.1, 0.4) : 0;
    return 1 + Number(roll < second) + Number(roll < third) + Number(roll < fourth);
}

function chained(answer: string, level: number, method: Method, layers: number): Chain | null {
    if (layers === 0) return takes(method, answer) ? { word: answer, inner: [] } : null;
    const options = (method.open === true ? openChains : letterChains)[layers] ?? [];
    const first = Math.floor(unitHash(level, salts.layerEncoding) * options.length);
    for (let turn = 0; turn < options.length * chainAttempts; turn++) {
        const chain = chainOf(answer, level, method, options[(first + turn) % options.length]!, Math.floor(turn / options.length));
        if (chain !== null) return chain;
    }
    return null;
}

function chainOf(answer: string, level: number, method: Method, families: readonly Family[], attempt: number): Chain | null {
    let word = answer;
    const inner: Step[] = [];
    for (const [index, family] of [...families].reverse().entries()) {
        const candidates = layersOf[family].filter((layer) => layer !== method.encoding && (firstLevels.get(layer) ?? Infinity) <= level && carries(word, layer) && goesUnder(layer, method)
            && inner.every((step) => step.cipher !== layer && (family !== 'letters' || (step.cipher === 'reversed') !== (layer === 'reversed'))));
        if (candidates.length === 0) return null;
        const layer = pickByUnit(candidates, unitHash(level * 7919 + index * 31 + attempt, salts.layerEncoding));
        word = encode(word, layer);
        inner.unshift({ cipher: layer });
    }
    return word !== answer && takes(method, word) ? { word, inner } : null;
}

function goesUnder(layer: Encoding, method: Method): boolean {
    if (method.encoding === undefined || !letterLayers.includes(layer)) return true;
    if (swapsLetters.has(method.encoding)) return layer === 'reversed';
    return !movesLetters.has(method.encoding) || layer !== 'reversed';
}

function takes(method: Method, text: string): boolean {
    return method.takes?.(text) ?? letters(text);
}

function isTooLong(clue: Clue): boolean {
    return clue.parts?.some((part) => part.text.length > longestText) === true;
}

function revealsAnswer(clue: Clue, answer: string): boolean {
    return shownTexts(clue).some((text) => text.trim().toLowerCase() === answer);
}

// A method that has not been used since it arrived goes first, and after those a method that has been used only the once, so that it is seen again before it is forgotten.
// The oldest of them goes before the others, so that each gets its turn. The rest are drawn by their weight, the ones that were used lately last.
function methodOrder(pool: readonly Method[], level: number, recent: Recent): Method[] {
    const excluded = new Set(recent.methods.slice(0, Math.min(recentMethodCount, Math.floor(pool.length * 0.6))));
    const ranked = pool.map((method) => ({
        method,
        turn: isNew(method, level, recent) ? 0 : isDueAgain(method, level, recent) ? 1 : 2,
        key: unitHash(level, salts.method + textSeed(method.name)) ** (1 / methodWeight(method, level, recent)),
    }));
    ranked.sort((first, second) => first.turn - second.turn || (first.turn < 2 ? first.method.fromLevel - second.method.fromLevel : 0)
        || Number(excluded.has(first.method.name)) - Number(excluded.has(second.method.name)) || second.key - first.key);
    return ranked.map(({ method }) => method);
}

// Whether a method has arrived within the levels that `recent` looks back on and has not been used in them.
function isNew(method: Method, level: number, recent: Recent): boolean {
    return level - method.fromLevel < recent.methods.length && !recent.methods.includes(method.name);
}

// Whether a method that arrived within those levels has been used once in them, long enough ago to come again.
function isDueAgain(method: Method, level: number, recent: Recent): boolean {
    const uses = recent.methods.filter((name) => name === method.name).length;
    return level - method.fromLevel < recent.methods.length && uses === 1 && recent.methods.indexOf(method.name) >= recentMethodCount;
}

// A method weighs more the longer it has not been used, so that none is left out for long. The methods of the first levels weigh less later on.
function methodWeight(method: Method, level: number, recent: Recent): number {
    const last = recent.methods.indexOf(method.name);
    const wait = 1 + (last === -1 ? recent.methods.length : last);
    const age = method.fromLevel < oldMethodLevel ? Math.max(0.3, 1 - Math.max(0, level - 200) / 500) : 1;
    return wait * wait * age;
}

function leastRecent<Item>(items: readonly Item[], name: (item: Item) => string, recent: Recent, unit: number): Item {
    const age = (item: Item): number => { const index = recent.methods.indexOf(name(item)); return index === -1 ? Number.POSITIVE_INFINITY : index; };
    const oldest = Math.max(...items.map(age));
    return pickByUnit(items.filter((item) => age(item) === oldest), unit);
}

function cipher(encoding: Encoding, fromLevel: number, hint?: Hint): Method {
    return {
        name: encoding, fromLevel, encoding, hint, open: byteCiphers.has(encoding), takes: (text) => carries(text, encoding),
        clue: (context) => placed(encode(context.word, encoding, context.unit), context, [{ cipher: encoding, unit: context.unit }, ...context.inner]),
    };
}

// A cipher with a key. The key is on the page as well: in the title at first, later anywhere, and later still under a cipher of its own.
function keyed(encoding: Encoding, fromLevel: number, keyFor: (context: ClueContext) => string | null, hint?: Hint): Method {
    return {
        name: encoding, fromLevel, encoding, hint, open: byteCiphers.has(encoding), takes: (text) => carries(text, encoding),
        clue: (context) => {
            const key = keyFor(context);
            const hidden = key === null ? null : hiddenKey(key, fromLevel, context);
            if (key === null || hidden === null) return null;
            const body = placed(encode(context.word, encoding, context.unit, key), { ...context, titleFree: context.titleFree && hidden.part.place !== 'title' },
                [{ cipher: encoding, key, keyAt: hidden.part }, ...context.inner], {}, [hidden.part.place]);
            return { ...hidden.clue, ...body };
        },
    };
}

function hiddenKey(key: string, fromLevel: number, context: ClueContext): { readonly clue: Clue; readonly part: Part } | null {
    const { level } = context;
    const roll = unitHash(level, salts.keyLayer);
    const open = level < fromLevel + openKeyLevels;
    const layers = !open && level >= firstEncodedKeyLevel && letters(key) ? letterLayers.filter((layer) => encode(key, layer) !== key) : [];
    const places = context.titleFree && open ? ['title'] : [...(context.titleFree ? ['title'] : []), ...keyPlaces];
    const first = Math.floor(unitHash(level, salts.keyPlace) * places.length);
    for (let turn = 0; turn < places.length; turn++) {
        const place = places[(first + turn) % places.length]!;
        const layer = layers.length > 0 && (place === 'title' || roll < encodedKeyShare) ? pickByUnit(layers, fraction(roll * 7)) : undefined;
        const shown = layer === undefined ? key : encode(key, layer);
        const clue = placedAt(place, shown, context);
        if (clue !== null) return { clue, part: { place, text: shown, ciphers: layer === undefined ? [] : [{ cipher: layer }] } };
    }
    return null;
}

function keyWord(context: ClueContext, allowed = /^[a-z]{4,7}$/): string {
    const start = Math.floor(unitHash(context.level, salts.key) * keyRanks);
    for (let offset = 0; offset < keyRanks; offset++) {
        const candidate = wordAtRank(1 + ((start + offset) % keyRanks));
        if (allowed.test(candidate) && candidate !== context.answer) return candidate;
    }
    return 'riddle';
}

// A key for a cipher that carries on with the message itself. It is shorter than the message, or the message would never come into it.
function shortKeyWord(context: ClueContext): string | null {
    const key = keyWord(context, /^[a-z]{3,4}$/);
    return key.length < context.word.length ? key : null;
}

function numberKey({ level }: ClueContext): string {
    const length = 4 + Math.floor(unitHash(level, salts.key) * 3);
    return Array.from({ length }, (_, index) => 1 + Math.floor(unitHash(level * 31 + index, salts.key) * 9)).join('');
}

function affineLine({ level }: ClueContext): string {
    return `${pickByUnit(affineSlopes, unitHash(level, salts.key))}x+${1 + Math.floor(unitHash(level * 31, salts.key) * 25)}`;
}

function drawn(kind: DrawingKind, fromLevel: number, { hint, via, raw, open, takes: taken }: Reads = {}): Method {
    const name = `${kind}Picture`;
    return {
        name, fromLevel, hint, open, ownSteps: via === undefined ? 1 : 2, takes: taken,
        clue: ({ word, level, inner, debut }) => {
            const text = via === undefined ? word : encode(word, via);
            // A kind of picture that is new is on the page for all to see.
            const display = debut === true ? undefined : drawingDisplay(level);
            const part: Part = { place: display === undefined ? 'picture' : `${display}Picture`, reading: name, text, ciphers: via === undefined ? inner : [{ cipher: via }, ...inner] };
            const clue: Clue = { drawing: { kind, text: raw === true ? word : text }, drawingDisplay: display, parts: [part] };
            return display === 'hidden' ? withLine(variant('hiddenPicture', level), clue) : clue;
        },
    };
}

// A picture of the letters themselves. It shows what it is given, so it is always given a cipher.
function lettered(kind: DrawingKind, fromLevel: number, hint?: Hint): Method {
    return { ...drawn(kind, fromLevel, { hint, takes: pixelLetters }), bare: true };
}

function sounded(name: string, kind: Sound['kind'], fromLevel: number, { hint, via, raw, open, takes: taken }: Reads = {}): Method {
    return {
        name, fromLevel, hint, open, ownSteps: via === undefined ? 1 : 2, takes: taken,
        clue: ({ word, inner }) => {
            const text = via === undefined ? word : encode(word, via);
            return { sound: { kind, text: raw === true ? word : text }, parts: [{ place: 'sound', reading: name, text, ciphers: via === undefined ? inner : [{ cipher: via }, ...inner] }] };
        },
    };
}

// A pattern on the page that spells the word out: first letters, bold letters, a grid, the order of something.
function read(name: string, fromLevel: number, place: string, content: (context: ClueContext) => Clue | null, { hint, via, open, takes: taken }: Reads = {}): Method {
    return {
        name, fromLevel, hint, open, ownSteps: via === undefined ? 1 : 2, takes: taken,
        clue: (context) => {
            const clue = content(context);
            if (clue === null) return null;
            const text = via === undefined ? context.word : encode(context.word, via);
            return { ...clue, parts: [{ place, reading: name, text, ciphers: via === undefined ? context.inner : [{ cipher: via }, ...context.inner] }] };
        },
    };
}

function alternative(name: string, fromLevel: number, extensions: readonly AlternateExtension[]): Method {
    return {
        name, fromLevel, htmOnly: true, clue: ({ word, level, inner }) => {
            const extension = pickByUnit(extensions, unitHash(level, salts.extension));
            return { lines: [variant(`${extension}File`, level)], alternate: { extension, text: word }, parts: [{ place: 'file', reading: `${extension}File`, text: word, ciphers: inner }] };
        },
    };
}

function inTitle(key: Hint['key']): Hint {
    return { place: 'title', key };
}

function onLine(key: Hint['key']): Hint {
    return { place: 'line', key };
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

function characterColorsOf(word: string): string[] {
    const codes = encode(word, 'hex').split(' ');
    while (codes.length % 3 !== 0) codes.push('00');
    return Array.from({ length: codes.length / 3 }, (_, index) => `#${codes.slice(index * 3, index * 3 + 3).join('')}`);
}

// The password check of a linked script. It holds the answer in one of the ways a script can write a string.
function script({ word, unit }: ClueContext): Clue {
    const reversed = encode(word, 'reversed');
    const checks: readonly (readonly [string, Encoding])[] = [
        [encode(word, 'codepoints'), 'codepoints'],
        [`unescape("${encode(word, 'url')}")`, 'url'],
        ...(reversed === word ? [] : [[`"${reversed}".split("").reverse().join("")`, 'reversed'] as const]),
    ];
    const [expression, used] = pickByUnit(checks, unit);
    return { script: expression, parts: [{ place: 'script', text: encode(word, used), ciphers: [{ cipher: used }] }] };
}

// The answer in two halves, each under a cipher of its own: one on the page and one somewhere else.
function split(context: ClueContext): Clue | null {
    const { word, level, unit } = context;
    if (word.length < 4) return null;
    const middle = Math.ceil(word.length / 2);
    const [first, second] = [word.slice(0, middle), word.slice(middle)];
    const known = textEncodings.filter(([encoding, fromLevel]) => fromLevel <= level && carries(first, encoding) && carries(second, encoding)).map(([encoding]) => encoding);
    if (known.length < 2) return null;
    const shown = pickByUnit(known, unitHash(level, salts.half));
    const tucked = pickByUnit(known.filter((encoding) => encoding !== shown), fraction(unitHash(level, salts.half) * 13));
    const front = encode(first, shown, unit);
    const rest = placed(encode(second, tucked, unit), context, [{ cipher: tucked, unit }], {}, ['lines']);
    return { ...rest, lines: [...(rest.lines ?? []), ...lineUp(front)], parts: [{ place: 'lines', text: front, ciphers: [{ cipher: shown, unit }] }, ...(rest.parts ?? [])] };
}

function earlierAnswers(context: ClueContext): Clue | null {
    const references = earlierReferences(context);
    return references === null ? null : placed(references, context, context.inner, { reading: 'earlierAnswers', text: context.word });
}

function caselessBase64({ word, inner }: ClueContext): Clue | null {
    const encoded = encode(word, 'base64');
    const capitalPlaces = [...encoded].flatMap((character, index) => (/[A-Z]/.test(character) ? [index + 1] : []));
    if (capitalPlaces.length === 0) return null;
    return { lines: lineUp(encoded.toLowerCase()), comment: capitalPlaces.join(' '), parts: [{ place: 'lines', reading: 'caselessBase64', text: encoded, ciphers: [{ cipher: 'base64' }, ...inner] }] };
}
