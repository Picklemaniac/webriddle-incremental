import { brailleDots, characterColors, code39Patterns, punchedRows } from './encodings.ts';
import { clockFace, presentPhoto, semaphoreFigure, semaphoreFigures } from './generated/props.ts';
import { nextSeed, textSeed } from './riddle.ts';

export type DrawingKind = 'gift' | 'semaphore' | 'clocks' | 'pigpen' | 'flags' | 'braille' | 'plain' | 'mirror' | 'rotated' | 'dark' | 'transparent' | 'flash' | 'delayed'
    | 'pixels' | 'bits' | 'shares' | 'spacer' | 'tally' | 'tape' | 'dominoes' | 'sevenSegment' | 'barcode' | 'mayan' | 'resistors' | 'punchTape' | 'punchCard' | 'blinker'
    | 'greys' | 'tiny' | 'sideways';

export interface Drawing {
    readonly kind: DrawingKind;
    readonly text: string;
}

export interface Picture {
    readonly src: string;
    readonly width: number;
    readonly height: number;
}

interface Cell {
    readonly character: string;
    readonly x: number;
    readonly y: number;
}

const glyphs: Readonly<Record<string, string>> = {
    a: '0e 11 11 1f 11 11 11', b: '1e 11 11 1e 11 11 1e', c: '0e 11 10 10 10 11 0e', d: '1e 11 11 11 11 11 1e',
    e: '1f 10 10 1e 10 10 1f', f: '1f 10 10 1e 10 10 10', g: '0e 11 10 17 11 11 0f', h: '11 11 11 1f 11 11 11',
    i: '0e 04 04 04 04 04 0e', j: '07 02 02 02 02 12 0c', k: '11 12 14 18 14 12 11', l: '10 10 10 10 10 10 1f',
    m: '11 1b 15 15 11 11 11', n: '11 11 19 15 13 11 11', o: '0e 11 11 11 11 11 0e', p: '1e 11 11 1e 10 10 10',
    q: '0e 11 11 11 15 12 0d', r: '1e 11 11 1e 14 12 11', s: '0f 10 10 0e 01 01 1e', t: '1f 04 04 04 04 04 04',
    u: '11 11 11 11 11 11 0e', v: '11 11 11 11 11 0a 04', w: '11 11 11 15 15 15 0a', x: '11 11 0a 04 0a 11 11',
    y: '11 11 0a 04 04 04 04', z: '1f 01 02 04 08 10 1f', 0: '0e 11 13 15 19 11 0e', 1: '04 0c 04 04 04 04 0e',
    2: '0e 11 01 02 04 08 1f', 3: '1e 01 01 0e 01 01 1e', 4: '02 06 0a 12 1f 02 02', 5: '1f 10 1e 01 01 11 0e',
    6: '0e 10 10 1e 11 11 0e', 7: '1f 01 02 04 08 08 08', 8: '0e 11 11 0e 11 11 0e', 9: '0e 11 11 0f 01 01 0e',
};

export const glyphWidth = 5;
export const glyphHeight = 7;
const glyphAdvance = glyphWidth + 1;
const textMargin = 4;
const textHeight = glyphHeight + textMargin * 2;
const letterScale = 4;

const semaphorePositions = '01 02 03 04 05 06 07 12 13 46 14 15 16 17 23 24 25 26 27 34 35 47 56 57 36 67'.split(' ');

const flagColors = { red: '#d52b1e', blue: '#1d4f91', yellow: '#f6c700', white: '#f7f7f2', black: '#111111' } as const;
const paper = '#efe6c8';
const ink = '#0b0b0b';
const chalk = '#dddddd';
const bandColors: readonly string[] = ['#000000', '#8b4513', '#d52b1e', '#ff8c00', '#f6c700', '#2e8b57', '#1d4f91', '#8a2be2', '#808080', '#f7f7f2'];
// Which of the seven segments are lit for each hexadecimal digit, in the order top, top right, bottom right, bottom, bottom left, top left, middle.
const litSegments: Readonly<Record<string, string>> = {
    0: '1111110', 1: '0110000', 2: '1101101', 3: '1111001', 4: '0110011', 5: '1011011', 6: '1011111', 7: '1110000', 8: '1111111', 9: '1111011',
    a: '1110111', b: '0011111', c: '1001110', d: '0111101', e: '1001111', f: '1000111',
};
const segmentBoxes: readonly (readonly [number, number, number, number])[] = [[2, 0, 8, 2], [10, 2, 2, 7], [10, 11, 2, 7], [2, 18, 8, 2], [0, 11, 2, 7], [0, 2, 2, 7], [2, 9, 8, 2]];
const punchedCardRows: readonly string[] = ['12', '11', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const fewestCardColumns = 16;
const lampSeconds = 0.25;

const painters: Readonly<Record<DrawingKind, (text: string) => Picture>> = {
    gift, semaphore, clocks, pigpen, flags, braille, plain, mirror, rotated, dark, transparent, flash, delayed, pixels, bits, shares, spacer,
    tally, tape, dominoes, sevenSegment, barcode, mayan, resistors, punchTape, punchCard, blinker, greys, tiny, sideways,
};

const pictures = new Map<string, Picture>();

export function drawPicture(drawing: Drawing): Picture {
    const key = `${drawing.kind}:${drawing.text}`;
    let picture = pictures.get(key);
    if (picture === undefined) {
        if (pictures.size > 64) pictures.clear();
        picture = painters[drawing.kind](drawing.text);
        pictures.set(key, picture);
    }
    return picture;
}

function gift(word: string): Picture {
    const { src, width, height } = presentPhoto;
    const size = Math.min(30, Math.floor(218 / Math.max(1, word.length)));
    const label = `<text x="203" y="104" transform="rotate(-8 203 104)" text-anchor="middle" font-family="Comic Sans MS, Comic Sans, cursive" font-weight="bold" `
        + `font-size="${size}" fill="#ffffff" stroke="#3a0000" stroke-width="0.8" paint-order="stroke">${word}</text>`;
    return svgPicture(width, height, `<image href="${src}" width="${width}" height="${height}"/>${label}`, 1);
}

function semaphore(text: string): Picture {
    const { width, height } = semaphoreFigure;
    return symbolRow(text, width, height, 6, (character) => {
        const figure = semaphoreFigures[character];
        return figure === undefined ? '' : `<image href="${figure}" width="${width}" height="${height}"/>`;
    });
}

function clocks(text: string): Picture {
    return symbolRow(text, 44, 44, 10, (character) => {
        const pair = semaphorePositions[character.charCodeAt(0) - 97];
        if (pair === undefined) return '';
        const angle = (position: string): string => String((180 + Number(position) * 45) % 360);
        const face = clockFace.replace('{hour}', angle(pair[0]!)).replace('{minute}', angle(pair[1]!));
        return `<image href="data:image/svg+xml,${encodeURIComponent(face)}" x="2" y="2" width="40" height="40"/>`;
    });
}

function pigpen(text: string): Picture {
    return symbolRow(text, 28, 28, 10, (character) => {
        const index = character.charCodeAt(0) - 97;
        if (index < 0 || index > 25) return '';
        const dotted = (index >= 9 && index < 18) || index >= 22;
        let lines: string;
        let dot: readonly [number, number];
        if (index < 18) {
            const row = Math.floor((index % 9) / 3);
            const column = index % 3;
            lines = [row > 0 ? 'M0 0H16' : '', row < 2 ? 'M0 16H16' : '', column > 0 ? 'M0 0V16' : '', column < 2 ? 'M16 0V16' : ''].join('');
            dot = [8, 8];
        } else {
            const wedge = (index - 18) % 4;
            lines = ['M1 1L8 14L15 1', 'M1 1L14 8L1 15', 'M15 1L2 8L15 15', 'M1 15L8 2L15 15'][wedge]!;
            dot = ([[8, 6], [6, 8], [10, 8], [8, 10]] as const)[wedge]!;
        }
        return `<g transform="translate(6 6)"><path d="${lines}" stroke="${chalk}" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" fill="none"/>`
            + `${dotted ? `<circle cx="${dot[0]}" cy="${dot[1]}" r="1.8" fill="${chalk}"/>` : ''}</g>`;
    });
}

function flags(text: string): Picture {
    const outline = ' stroke="#333" stroke-width="0.6"';
    return symbolRow(text, 36, 26, 6, (character) => {
        const design = flagDesign(character);
        if (design === '') return '';
        const edge = character === 'a' || character === 'b' ? swallowtail('none', outline) : `<rect width="30" height="20" fill="none"${outline}/>`;
        return `<g transform="translate(3 3)"><g clip-path="url(#flag)">${design}</g>${edge}</g>`;
    }, 2, '<defs><clipPath id="flag"><rect width="30" height="20"/></clipPath></defs>');
}

function flagDesign(letter: string): string {
    const { red, blue, yellow, white, black } = flagColors;
    const field = (color: string): string => box(0, 0, 30, 20, color);
    const stripes = (colors: readonly string[], vertical: boolean): string => colors.map((color, index) => vertical
        ? box(index * 30 / colors.length, 0, 30 / colors.length, 20, color)
        : box(0, index * 20 / colors.length, 30, 20 / colors.length, color)).join('');
    const quarters = (first: string, second: string): string => box(0, 0, 15, 10, first) + box(15, 0, 15, 10, second) + box(0, 10, 15, 10, second) + box(15, 10, 15, 10, first);
    const saltire = (color: string): string => `<path d="M0 0L30 20M30 0L0 20" stroke="${color}" stroke-width="4"/>`;
    const cross = (color: string): string => box(12.5, 0, 5, 20, color) + box(0, 7.5, 30, 5, color);
    const centre = (color: string): string => box(10, 20 / 3, 10, 20 / 3, color);
    const polygon = (points: string, color: string): string => `<polygon points="${points}" fill="${color}"/>`;
    switch (letter) {
        case 'a': return polygon('0,0 15,0 15,20 0,20', white) + polygon('15,0 30,0 22,10 30,20 15,20', blue);
        case 'b': return swallowtail(red);
        case 'c': return stripes([blue, white, red, white, blue], false);
        case 'd': return field(yellow) + box(0, 5, 30, 10, blue);
        case 'e': return stripes([blue, red], false);
        case 'f': return field(white) + polygon('15,0 30,10 15,20 0,10', red);
        case 'g': return stripes([yellow, blue, yellow, blue, yellow, blue], true);
        case 'h': return stripes([white, red], true);
        case 'i': return field(yellow) + `<circle cx="15" cy="10" r="5" fill="${black}"/>`;
        case 'j': return stripes([blue, white, blue], false);
        case 'k': return stripes([yellow, blue], true);
        case 'l': return quarters(yellow, black);
        case 'm': return field(blue) + saltire(white);
        case 'n': return Array.from({ length: 16 }, (_, index) => box((index % 4) * 7.5, Math.floor(index / 4) * 5, 7.5, 5, (index % 4 + Math.floor(index / 4)) % 2 === 0 ? blue : white)).join('');
        case 'o': return polygon('0,0 30,0 30,20', red) + polygon('0,0 0,20 30,20', yellow);
        case 'p': return field(blue) + centre(white);
        case 'q': return field(yellow);
        case 'r': return field(red) + cross(yellow);
        case 's': return field(white) + centre(blue);
        case 't': return stripes([red, white, blue], true);
        case 'u': return quarters(red, white);
        case 'v': return field(white) + saltire(red);
        case 'w': return field(blue) + box(5, 10 / 3, 20, 40 / 3, white) + centre(red);
        case 'x': return field(white) + cross(blue);
        case 'y': return field(red) + Array.from({ length: 5 }, (_, index) => {
            const [from, to] = [index * 0.4, index * 0.4 + 0.2];
            return polygon(`${30 * from},0 ${30 * to},0 0,${20 * to} 0,${20 * from}`, yellow);
        }).join('');
        case 'z': return polygon('0,0 30,0 15,10', yellow) + polygon('0,0 15,10 0,20', black) + polygon('30,0 30,20 15,10', red) + polygon('0,20 30,20 15,10', blue);
        default: return '';
    }
}

function swallowtail(color: string, extra = ''): string {
    return `<polygon points="0,0 30,0 22,10 30,20 0,20" fill="${color}"${extra}/>`;
}

function braille(text: string): Picture {
    return symbolRow(text, 16, 22, 12, (character) => {
        const dots = brailleDots(character);
        return [[5, 5], [5, 11], [5, 17], [11, 5], [11, 11], [11, 17]].map(([x, y], index) => (dots >> index) & 1
            ? `<circle cx="${x}" cy="${y}" r="2.4" fill="#eeeeee"/>`
            : `<circle cx="${x}" cy="${y}" r="1" fill="#444444"/>`).join('');
    }, 2);
}

function plain(text: string): Picture {
    return letterPicture(text, (width) => `${box(0, 0, width, textHeight, '#101010')}${pixelText(text, '#e8e8e8')}`);
}

function tiny(text: string): Picture {
    return letterPicture(text, (width) => `${box(0, 0, width, textHeight, '#101010')}${pixelText(text, '#e8e8e8')}`, 1);
}

function transparent(text: string): Picture {
    return letterPicture(text, () => pixelText(text, '#000000'));
}

function rotated(text: string): Picture {
    return letterPicture(text, (width) => `${box(0, 0, width, textHeight, '#e8e8e8')}<g transform="rotate(180 ${width / 2} ${textHeight / 2})">${pixelText(text, '#1a1a1a')}</g>`);
}

function sideways(text: string): Picture {
    const width = textWidth(text);
    const content = `${box(0, 0, textHeight, width, '#e8e8e8')}<g transform="translate(${textHeight} 0) rotate(90)">${pixelText(text, '#1a1a1a')}</g>`;
    return svgPicture(textHeight, width, content, letterScale, true);
}

function mirror(text: string): Picture {
    return letterPicture(text, (width) => `${box(0, 0, width, textHeight, '#e8e8e8')}<g transform="translate(${width} 0) scale(-1 1)">${pixelText(text, '#1a1a1a')}</g>`);
}

function dark(text: string): Picture {
    return letterPicture(text, (width) => `${box(0, 0, width, textHeight, '#000000')}${pixelText(text, '#050505')}`);
}

function flash(text: string): Picture {
    return flashing(text, 3, 0.9);
}

function delayed(text: string): Picture {
    return flashing(text, 24, 0.875);
}

function flashing(text: string, seconds: number, hiddenShare: number): Picture {
    const animate = `<animate attributeName="opacity" calcMode="discrete" dur="${seconds}s" repeatCount="indefinite" keyTimes="0;${hiddenShare}" values="0;1"/>`;
    return letterPicture(text, (width) => `${box(0, 0, width, textHeight, '#101010')}<g opacity="0">${animate}${pixelText(text, '#e8e8e8')}</g>`);
}

function pixels(text: string): Picture {
    const colors = characterColors(text);
    return svgPicture(colors.length * 4 + 1, 5, box(0, 0, colors.length * 4 + 1, 5, '#000000') + colors.map((color, index) => box(index * 4 + 1, 1, 3, 3, color)).join(''), 8, true);
}

// One square for each character code, as dark or light as the code is high.
function greys(hexCodes: string): Picture {
    const codes = hexCodes.split(' ');
    return svgPicture(codes.length * 4 + 1, 5, box(0, 0, codes.length * 4 + 1, 5, '#000000') + codes.map((code, index) => box(index * 4 + 1, 1, 3, 3, `#${code.repeat(3)}`)).join(''), 8, true);
}

function bits(text: string): Picture {
    const codes = [...text].map((character) => character.charCodeAt(0));
    const squares = codes.flatMap((code, row) => Array.from({ length: 8 }, (_, column) => ((code >> (7 - column)) & 1 ? [box(column * 5 + 2, row * 5 + 2, 4, 4, '#f0f0f0')] : [])).flat());
    return svgPicture(43, codes.length * 5 + 3, box(0, 0, 43, codes.length * 5 + 3, '#000000') + squares.join(''), 2, true);
}

function shares(text: string): Picture {
    const width = textWidth(text);
    const lit = new Set<string>();
    [...text].forEach((character, index) => {
        for (let y = 0; y < glyphHeight; y++) {
            for (let x = 0; x < glyphWidth; x++) if (glyphPixel(character, x, y)) lit.add(`${textMargin + index * glyphAdvance + x},${textMargin + y}`);
        }
    });
    let seed = textSeed(text);
    const left: string[] = [];
    const right: string[] = [];
    for (let y = 0; y < textHeight; y++) {
        for (let x = 0; x < width; x++) {
            seed = nextSeed(seed);
            const noise = seed >>> 31 === 1;
            if (noise) left.push(`M${x} ${y}h1v1h-1z`);
            if (noise !== lit.has(`${x},${y}`)) right.push(`M${width + 2 + x} ${y}h1v1h-1z`);
        }
    }
    return svgPicture(width * 2 + 2, textHeight, `${box(0, 0, width * 2 + 2, textHeight, '#000000')}<path d="${left.join('')}${right.join('')}" fill="#ffffff"/>`, letterScale, true);
}

function spacer(): Picture {
    return svgPicture(1, 1, '', 1);
}

// Letter numbers as tally marks: four strokes and a fifth across them.
function tally(numbers: string): Picture {
    return tokenRow(numbers.split(' '), 124, 22, 2, (token) => {
        const count = Number(token);
        const groups = Array.from({ length: Math.ceil(count / 5) }, (_, group) => {
            const strokes = Math.min(5, count - group * 5);
            const upright = Array.from({ length: Math.min(4, strokes) }, (_, stroke) => `M${group * 20 + 5 + stroke * 3.5} 4V18`).join('');
            return `${upright}${strokes === 5 ? `M${group * 20 + 2} 16L${group * 20 + 18.5} 6` : ''}`;
        });
        return `<path d="${groups.join('')}" stroke="${chalk}" stroke-width="1.4" stroke-linecap="round" fill="none"/>`;
    }, 2);
}

// Morse code as a telegraph prints it on a paper strip.
function tape(morse: string): Picture {
    const letters = morse.split(' ').filter((token) => token !== '/');
    return tokenRow(letters, 66, 14, 3, (token) => {
        let x = 4;
        return [...token].map((symbol) => {
            const width = symbol === '-' ? 9 : 3;
            const mark = box(x, 5, width, 4, '#222222');
            x += width + 3;
            return mark;
        }).join('');
    }, 2, paper);
}

// A domino for each character: the row and the column of a six by six square.
function dominoes(pairs: string): Picture {
    const pips: readonly (readonly (readonly [number, number])[])[] = [
        [], [[10, 10]], [[5, 5], [15, 15]], [[5, 5], [10, 10], [15, 15]], [[5, 5], [15, 5], [5, 15], [15, 15]], [[5, 5], [15, 5], [10, 10], [5, 15], [15, 15]],
        [[5, 5], [5, 10], [5, 15], [15, 5], [15, 10], [15, 15]],
    ];
    const half = (value: string, x: number): string => (pips[Number(value)] ?? []).map(([left, top]) => `<circle cx="${x + left}" cy="${3 + top}" r="1.8" fill="${ink}"/>`).join('');
    return tokenRow(pairs.split(' '), 46, 26, 6, (token) => `<rect x="3" y="3" width="40" height="20" rx="3" fill="#f4f0e6"/><path d="M23 5V21" stroke="${ink}" stroke-width="0.8"/>`
        + `${half(token[0] ?? '0', 3)}${half(token[1] ?? '0', 23)}`, 2);
}

// Hexadecimal codes on the display of a calculator.
function sevenSegment(hexCodes: string): Picture {
    const digit = (character: string, x: number): string => segmentBoxes.map(([left, top, width, height], segment) =>
        box(x + left, 4 + top, width, height, litSegments[character]?.[segment] === '1' ? '#ff3b30' : '#3a0a08')).join('');
    return tokenRow(hexCodes.split(' '), 40, 28, 6, (token) => `${digit(token[0] ?? '0', 6)}${digit(token[1] ?? '0', 22)}`, 2, '#140303');
}

// A barcode in Code 39: narrow and wide bars with narrow and wide spaces between them.
function barcode(text: string): Picture {
    const quiet = 10;
    let x = quiet;
    const bars: string[] = [];
    for (const pattern of code39Patterns(text)) {
        [...pattern].forEach((element, index) => {
            const width = element === 'w' ? 3 : 1;
            if (index % 2 === 0) bars.push(box(x, 4, width, 40, '#000000'));
            x += width;
        });
        x += 1;
    }
    const width = x + quiet - 1;
    return svgPicture(width, 48, `${box(0, 0, width, 48, '#ffffff')}${bars.join('')}`, 2, true);
}

// Letter numbers as the Maya wrote them: a dot is one, a bar is five, and twenty moves up a level.
function mayan(numbers: string): Picture {
    const level = (value: number, bottom: number): string => {
        if (value === 0) return `<ellipse cx="17" cy="${bottom - 6}" rx="9" ry="5" fill="none" stroke="#d9c28f" stroke-width="1.4"/><path d="M10 ${bottom - 6}Q17 ${bottom - 11} 24 ${bottom - 6}" fill="none" stroke="#d9c28f" stroke-width="1"/>`;
        const bars = Math.floor(value / 5);
        const dots = value % 5;
        const barMarks = Array.from({ length: bars }, (_, bar) => `<rect x="5" y="${bottom - 5 - bar * 6}" width="24" height="4" rx="1.5" fill="#d9c28f"/>`).join('');
        const dotMarks = Array.from({ length: dots }, (_, dot) => `<circle cx="${17 - (dots - 1) * 3 + dot * 6}" cy="${bottom - bars * 6 - 4}" r="2.2" fill="#d9c28f"/>`).join('');
        return `${barMarks}${dotMarks}`;
    };
    return tokenRow(numbers.split(' '), 34, 56, 8, (token) => {
        const value = Number(token);
        return value < 20 ? level(value, 52) : `${level(Math.floor(value / 20), 24)}${level(value % 20, 52)}`;
    }, 2);
}

// Character codes as the colour bands of resistors: black is zero, brown is one, and so on to white for nine.
function resistors(codes: string): Picture {
    return tokenRow(codes.split(' '), 60, 24, 5, (token) => {
        const bands = [...token.padStart(3, '0')].map((digit, index) => box(19 + index * 8, 5, 4, 14, bandColors[Number(digit)] ?? bandColors[0]!)).join('');
        return `<path d="M2 12H58" stroke="#999999" stroke-width="1.5"/><rect x="14" y="5" width="32" height="14" rx="4" fill="#d8b98a"/>${bands}`;
    }, 2);
}

// Five-hole teleprinter tape: a column for each character, the lowest bit at the top, and a row of small feed holes after the second row.
function punchTape(codes: string): Picture {
    const columns = codes.split(' ');
    const rows: readonly number[] = [8, 17, 35, 44, 53];
    const holes = columns.flatMap((bitsOfCode, column) => {
        const x = 11 + column * 10;
        const punched = [...bitsOfCode].reverse().flatMap((bit, row) => (bit === '1' ? [`<circle cx="${x}" cy="${rows[row]}" r="3" fill="${ink}"/>`] : []));
        return [...punched, `<circle cx="${x}" cy="26" r="1.4" fill="${ink}"/>`];
    });
    const width = columns.length * 10 + 12;
    return svgPicture(width, 62, `${box(0, 0, width, 62, paper)}${holes.join('')}`, 2);
}

// An 80-column punched card, as wide as the text: a column for each character, with the zone rows at the top.
function punchCard(text: string): Picture {
    const width = Math.max(text.length, fewestCardColumns) * 9 + 22;
    const height = punchedCardRows.length * 8 + 16;
    const rowY = (row: string): number => 9 + punchedCardRows.indexOf(row) * 8;
    const printed = punchedCardRows.slice(2).flatMap((row) => Array.from({ length: Math.max(text.length, fewestCardColumns) }, (_, column) =>
        `<text x="${13.5 + column * 9}" y="${rowY(row) + 5}" font-family="Courier New, monospace" font-size="5" text-anchor="middle" fill="#b9ad8a">${row}</text>`));
    const holes = [...text].flatMap((character, column) => punchedRows(character).map((row) => box(11 + column * 9, rowY(row), 5, 6, ink)));
    const card = `<polygon points="8,0 ${width},0 ${width},${height} 0,${height} 0,8" fill="${paper}"/>`;
    return svgPicture(width, height, `${card}${printed.join('')}${holes.join('')}`, 2);
}

// A lamp that flashes Morse code, over and over.
function blinker(morse: string): Picture {
    const states: { lit: boolean; units: number }[] = [];
    for (const token of morse.split(' ')) {
        if (token === '/') {
            states.push({ lit: false, units: 4 });
            continue;
        }
        for (const symbol of token) states.push({ lit: true, units: symbol === '-' ? 3 : 1 }, { lit: false, units: 1 });
        states.push({ lit: false, units: 2 });
    }
    states.push({ lit: false, units: 6 });
    const total = states.reduce((sum, state) => sum + state.units, 0);
    let elapsed = 0;
    const keyTimes = states.map((state) => {
        const start = elapsed / total;
        elapsed += state.units;
        return Number(start.toFixed(5));
    });
    const animate = `<animate attributeName="opacity" calcMode="discrete" dur="${(total * lampSeconds).toFixed(2)}s" repeatCount="indefinite" keyTimes="${keyTimes.join(';')}" values="${states.map((state) => (state.lit ? 1 : 0)).join(';')}"/>`;
    const lamp = `<rect x="24" y="40" width="16" height="20" fill="#2b2b2b"/><rect x="20" y="34" width="24" height="6" fill="#3d3d3d"/><circle cx="32" cy="24" r="9" fill="#2a2617"/>`
        + `<g opacity="0">${animate}<circle cx="32" cy="24" r="16" fill="#ffe9a3" opacity="0.35"/><circle cx="32" cy="24" r="9" fill="#fff3c4"/></g>`;
    return svgPicture(64, 64, `${box(0, 0, 64, 64, '#05070d')}${lamp}`, 2);
}

function symbolRow(text: string, cellWidth: number, cellHeight: number, perRow: number, symbol: (character: string) => string, scale = 1, definitions = ''): Picture {
    const characters = [...text];
    const columns = Math.min(perRow, characters.length);
    const rows = Math.ceil(characters.length / perRow);
    const cells: Cell[] = characters.map((character, index) => ({ character, x: (index % perRow) * cellWidth, y: Math.floor(index / perRow) * cellHeight }));
    const content = cells.filter((cell) => cell.character !== ' ').map((cell) => `<g transform="translate(${cell.x} ${cell.y})">${symbol(cell.character)}</g>`).join('');
    return svgPicture(columns * cellWidth, rows * cellHeight, `${definitions}${content}`, scale);
}

// A picture with a cell for each token of a text, in rows.
function tokenRow(tokens: readonly string[], cellWidth: number, cellHeight: number, perRow: number, symbol: (token: string) => string, scale = 1, background = ''): Picture {
    const width = Math.min(perRow, tokens.length) * cellWidth;
    const height = Math.ceil(tokens.length / perRow) * cellHeight;
    const content = tokens.map((token, index) => `<g transform="translate(${(index % perRow) * cellWidth} ${Math.floor(index / perRow) * cellHeight})">${symbol(token)}</g>`).join('');
    return svgPicture(width, height, `${background === '' ? '' : box(0, 0, width, height, background)}${content}`, scale);
}

function svgPicture(width: number, height: number, content: string, scale: number, crisp = false): Picture {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"${crisp ? ' shape-rendering="crispEdges"' : ''}>${content}</svg>`;
    return { src: `data:image/svg+xml,${encodeURIComponent(svg)}`, width: width * scale, height: height * scale };
}

function box(x: number, y: number, width: number, height: number, color: string): string {
    const round = (value: number): number => Number(value.toFixed(2));
    return `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" fill="${color}"/>`;
}

export function glyphRows(character: string): number[] {
    return (glyphs[character] ?? '00 00 00 00 00 00 00').split(' ').map((row) => Number.parseInt(row, 16));
}

export function glyphPixel(character: string, x: number, y: number): boolean {
    return (((glyphRows(character)[y] ?? 0) >> (glyphWidth - 1 - x)) & 1) === 1;
}

function textWidth(text: string): number {
    return text.length * glyphAdvance + textMargin * 2 - 1;
}

function letterPicture(text: string, content: (width: number) => string, scale = letterScale): Picture {
    const width = textWidth(text);
    return svgPicture(width, textHeight, content(width), scale, true);
}

function pixelText(text: string, color: string): string {
    return [...text.toLowerCase()].flatMap((character, index) => Array.from({ length: glyphHeight }, (_, y) => y).flatMap((y) =>
        Array.from({ length: glyphWidth }, (_, x) => x)
            .filter((x) => glyphPixel(character, x, y))
            .map((x) => box(textMargin + index * glyphAdvance + x, textMargin + y, 1, 1, color)))).join('');
}
