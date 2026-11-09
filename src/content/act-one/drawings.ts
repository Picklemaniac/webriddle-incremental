import { brailleDots, characterColors } from './encodings.ts';
import { clockFace, presentPhoto, semaphoreFigure, semaphoreFigures } from './generated/props.ts';

export type DrawingKind = 'gift' | 'semaphore' | 'clocks' | 'pigpen' | 'flags' | 'braille' | 'plain' | 'mirror' | 'rotated' | 'dark' | 'transparent' | 'flash' | 'delayed'
    | 'pixels' | 'bits' | 'shares' | 'spacer';

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

const semaphorePositions = '01 02 03 04 05 06 07 12 13 46 14 15 16 17 23 24 25 26 27 34 35 47 56 57 36 67'.split(' ');

const flagColors = { red: '#d52b1e', blue: '#1d4f91', yellow: '#f6c700', white: '#f7f7f2', black: '#111111' } as const;

const painters: Readonly<Record<DrawingKind, (text: string) => Picture>> = {
    gift, semaphore, clocks, pigpen, flags, braille, plain, mirror, rotated, dark, transparent, flash, delayed, pixels, bits, shares, spacer,
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
    return symbolRow(text, width, height, 6, null, (character) => {
        const figure = semaphoreFigures[character];
        return figure === undefined ? '' : `<image href="${figure}" width="${width}" height="${height}"/>`;
    });
}

function clocks(text: string): Picture {
    return symbolRow(text, 44, 44, 10, null, (character) => {
        const pair = semaphorePositions[character.charCodeAt(0) - 97];
        if (pair === undefined) return '';
        const angle = (position: string): string => String((180 + Number(position) * 45) % 360);
        const face = clockFace.replace('{hour}', angle(pair[0]!)).replace('{minute}', angle(pair[1]!));
        return `<image href="data:image/svg+xml,${encodeURIComponent(face)}" x="2" y="2" width="40" height="40"/>`;
    });
}

function pigpen(text: string): Picture {
    return symbolRow(text, 28, 28, 10, null, (character) => {
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
        return `<g transform="translate(6 6)"><path d="${lines}" stroke="#dddddd" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" fill="none"/>`
            + `${dotted ? `<circle cx="${dot[0]}" cy="${dot[1]}" r="1.8" fill="#dddddd"/>` : ''}</g>`;
    });
}

function flags(text: string): Picture {
    const outline = ' stroke="#333" stroke-width="0.6"';
    return symbolRow(text, 36, 26, 6, null, (character) => {
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
    return symbolRow(text, 16, 22, 12, null, (character) => {
        const dots = brailleDots(character);
        return [[5, 5], [5, 11], [5, 17], [11, 5], [11, 11], [11, 17]].map(([x, y], index) => (dots >> index) & 1
            ? `<circle cx="${x}" cy="${y}" r="2.4" fill="#eeeeee"/>`
            : `<circle cx="${x}" cy="${y}" r="1" fill="#444444"/>`).join('');
    }, 2);
}

function plain(text: string): Picture {
    const width = text.length * 6 + 7;
    return svgPicture(width, 15, `${box(0, 0, width, 15, '#101010')}${pixelText(text, 4, 4, '#e8e8e8')}`, 4, true);
}

function transparent(text: string): Picture {
    return svgPicture(text.length * 6 + 7, 15, pixelText(text, 4, 4, '#000000'), 4, true);
}

function rotated(text: string): Picture {
    const width = text.length * 6 + 7;
    return svgPicture(width, 15, `${box(0, 0, width, 15, '#e8e8e8')}<g transform="rotate(180 ${width / 2} 7.5)">${pixelText(text, 4, 4, '#1a1a1a')}</g>`, 4, true);
}

function mirror(text: string): Picture {
    const width = text.length * 6 + 7;
    return svgPicture(width, 15, `${box(0, 0, width, 15, '#e8e8e8')}<g transform="translate(${width} 0) scale(-1 1)">${pixelText(text, 4, 4, '#1a1a1a')}</g>`, 4, true);
}

function dark(text: string): Picture {
    const width = text.length * 6 + 7;
    return svgPicture(width, 15, `${box(0, 0, width, 15, '#000000')}${pixelText(text, 4, 4, '#050505')}`, 4, true);
}

function flash(text: string): Picture {
    return flashing(text, 3, 0.9);
}

function delayed(text: string): Picture {
    return flashing(text, 24, 0.875);
}

function flashing(text: string, seconds: number, hiddenShare: number): Picture {
    const width = text.length * 6 + 7;
    const animate = `<animate attributeName="opacity" calcMode="discrete" dur="${seconds}s" repeatCount="indefinite" keyTimes="0;${hiddenShare}" values="0;1"/>`;
    return svgPicture(width, 15, `${box(0, 0, width, 15, '#101010')}<g opacity="0">${animate}${pixelText(text, 4, 4, '#e8e8e8')}</g>`, 4, true);
}

function pixels(text: string): Picture {
    const colors = characterColors(text);
    return svgPicture(colors.length * 4 + 1, 5, box(0, 0, colors.length * 4 + 1, 5, '#000000') + colors.map((color, index) => box(index * 4 + 1, 1, 3, 3, color)).join(''), 8, true);
}

function bits(text: string): Picture {
    const codes = [...text].map((character) => character.charCodeAt(0));
    const squares = codes.flatMap((code, row) => Array.from({ length: 8 }, (_, column) => ((code >> (7 - column)) & 1 ? [box(column * 5 + 2, row * 5 + 2, 4, 4, '#f0f0f0')] : [])).flat());
    return svgPicture(43, codes.length * 5 + 3, box(0, 0, 43, codes.length * 5 + 3, '#000000') + squares.join(''), 2, true);
}

function shares(text: string): Picture {
    const width = text.length * 6 + 7;
    const lit = new Set<string>();
    [...text].forEach((character, index) => glyphRows(character).forEach((bits, y) => {
        for (let x = 0; x < 5; x++) if ((bits >> (4 - x)) & 1) lit.add(`${4 + index * 6 + x},${4 + y}`);
    }));
    let seed = [...text].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619), 2166136261) >>> 0;
    const left: string[] = [];
    const right: string[] = [];
    for (let y = 0; y < 15; y++) {
        for (let x = 0; x < width; x++) {
            seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
            const noise = seed >>> 31 === 1;
            if (noise) left.push(`M${x} ${y}h1v1h-1z`);
            if (noise !== lit.has(`${x},${y}`)) right.push(`M${width + 2 + x} ${y}h1v1h-1z`);
        }
    }
    return svgPicture(width * 2 + 2, 15, `${box(0, 0, width * 2 + 2, 15, '#000000')}<path d="${left.join('')}${right.join('')}" fill="#ffffff"/>`, 4, true);
}

function spacer(): Picture {
    return svgPicture(1, 1, '', 1);
}

function symbolRow(text: string, cellWidth: number, cellHeight: number, perRow: number, background: string | null, symbol: (character: string) => string, scale = 1, definitions = ''): Picture {
    const characters = [...text];
    const columns = Math.min(perRow, characters.length);
    const rows = Math.ceil(characters.length / perRow);
    const cells: Cell[] = characters.map((character, index) => ({ character, x: (index % perRow) * cellWidth, y: Math.floor(index / perRow) * cellHeight }));
    const content = cells.filter((cell) => cell.character !== ' ').map((cell) => `<g transform="translate(${cell.x} ${cell.y})">${symbol(cell.character)}</g>`).join('');
    return svgPicture(columns * cellWidth, rows * cellHeight, `${definitions}${background === null ? '' : box(0, 0, columns * cellWidth, rows * cellHeight, background)}${content}`, scale);
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

function pixelText(text: string, left: number, top: number, color: string): string {
    return [...text.toLowerCase()].flatMap((character, index) => {
        const rows = glyphRows(character);
        return rows.flatMap((row, y) => Array.from({ length: 5 }, (_, x) => x)
            .filter((x) => (row >> (4 - x)) & 1)
            .map((x) => box(left + index * 6 + x, top + y, 1, 1, color)));
    }).join('');
}
