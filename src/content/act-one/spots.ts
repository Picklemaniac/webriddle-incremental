import { lineUp, lineWidth, variant, withLine, type Clue, type ClueContext, type Part, type Step } from './clues.ts';
import { fraction } from './riddle.ts';

// A place on a page, in its source or in one of its files where encoded text can be put.
interface Spot {
    readonly name: string;
    readonly fromLevel: number;
    readonly weight: number;
    readonly usesTitle?: boolean;
    readonly fits?: (text: string, context: ClueContext) => boolean;
    readonly place: (text: string, context: ClueContext) => Clue;
}

const optionWidth = 24;
const longestAttribute = 160;

const short = (text: string): boolean => text.length <= lineWidth;
const printable = (text: string): boolean => /^[ -~]+$/.test(text);
// Text that can stand between quotes in a script without being escaped.
const quotable = (text: string): boolean => /^[A-Za-z0-9 .,:;/+=_-]{1,120}$/.test(text);
const fileName = (text: string): boolean => /^[a-z0-9._-]{1,40}$/i.test(text);
// Numbers that can stand as the coordinates of an image map and come back as they were: no zero in front.
const smallNumbers = (text: string): boolean => /^(0|[1-9]\d{0,2})( (0|[1-9]\d{0,2})){2,}$/.test(text);

const spots: readonly Spot[] = [
    { name: 'lines', fromLevel: 0, weight: 5, place: (text) => ({ lines: lineUp(text) }) },
    { name: 'comment', fromLevel: 0, weight: 2, place: (text) => ({ comment: text }) },
    { name: 'title', fromLevel: 0, weight: 1, usesTitle: true, fits: short, place: (text) => ({ title: text }) },
    { name: 'hiddenText', fromLevel: 0, weight: 1, fits: short, place: (text) => ({ hiddenText: text }) },
    { name: 'imageTitle', fromLevel: 0, weight: 1, fits: short, place: (text) => ({ imageTitle: text }) },
    { name: 'belowFold', fromLevel: 60, weight: 1, place: (text) => ({ belowFold: lineUp(text) }) },
    { name: 'altText', fromLevel: 70, weight: 1, fits: (text) => short(text) && printable(text), place: (text) => ({ altText: text }) },
    { name: 'farRight', fromLevel: 90, weight: 1, place: (text) => ({ farRight: lineUp(text) }) },
    { name: 'farComment', fromLevel: 100, weight: 1, place: (text) => ({ farComment: text }) },
    { name: 'marquee', fromLevel: 105, weight: 1, fits: (text) => printable(text) && text.length <= longestAttribute, place: (text) => ({ marquee: text }) },
    { name: 'statusBar', fromLevel: 115, weight: 1, fits: quotable, place: (text) => ({ statusText: text }) },
    { name: 'unseen', fromLevel: 130, weight: 1, place: (text) => ({ unseen: text }) },
    { name: 'meta', fromLevel: 140, weight: 1, place: (text) => ({ meta: text }) },
    { name: 'hotspot', fromLevel: 140, weight: 1, place: (text, context) => withLine(variant('hotspot', context.level), { hotspot: text }) },
    { name: 'hiddenField', fromLevel: 150, weight: 1, fits: (text) => printable(text) && text.length <= longestAttribute, place: (text) => ({ hiddenField: text }) },
    { name: 'options', fromLevel: 165, weight: 1, fits: (text) => printable(text) && text.includes(' ') && text.length <= 200, place: (text) => ({ options: lineUp(text, optionWidth) }) },
    { name: 'noscript', fromLevel: 175, weight: 1, place: (text) => ({ noscript: text }) },
    { name: 'stylesheet', fromLevel: 180, weight: 1, fits: (text) => !text.includes('*/'), place: (text) => ({ stylesheet: text }) },
    { name: 'scriptVariable', fromLevel: 190, weight: 1, fits: quotable, place: (text) => ({ scriptVariable: text }) },
    { name: 'attribute', fromLevel: 200, weight: 1, place: (text) => ({ attribute: text }) },
    { name: 'imageName', fromLevel: 220, weight: 1, fits: (text, context) => context.withImage && fileName(text), place: (text) => ({ imageName: `${text}.jpg` }) },
    { name: 'anchor', fromLevel: 240, weight: 1, fits: fileName, place: (text) => ({ anchor: text }) },
    { name: 'imageNote', fromLevel: 260, weight: 1, fits: printable, place: (text, context) => withLine(variant('imageNote', context.level), { imageNote: text }) },
    { name: 'imageMap', fromLevel: 280, weight: 1, fits: smallNumbers, place: (text) => ({ areaCoordinates: text.split(' ').map(Number) }) },
    { name: 'conditional', fromLevel: 300, weight: 1, fits: (text) => !text.includes('-->') && !text.includes(']>'), place: (text) => ({ conditional: text }) },
    { name: 'zipped', fromLevel: 320, weight: 1, fits: printable, place: (text, context) => withLine(variant('zipped', context.level), { zipped: text }) },
];

export const hidingPlaces: readonly string[] = spots.map((spot) => spot.name);

// Puts encoded text in one of the hiding places that are open at this level and can hold it, and records the way back to the answer.
export function placed(text: string, context: ClueContext, ciphers: readonly Step[], read: { readonly reading?: string; readonly text?: string } = {}, taken: readonly string[] = []): Clue {
    const open = spots.filter((spot) => spot.fromLevel <= context.level && !taken.includes(spot.name) && (context.titleFree || spot.usesTitle !== true) && (spot.fits?.(text, context) ?? true));
    let roll = fraction(context.unit * 7) * open.reduce((sum, spot) => sum + spot.weight, 0);
    const spot = open.find((candidate) => {
        roll -= candidate.weight;
        return roll < 0;
    }) ?? open[0]!;
    const part: Part = { place: spot.name, ...(read.reading === undefined ? {} : { reading: read.reading }), text: read.text ?? text, ciphers };
    return { ...spot.place(text, context), parts: [part] };
}

// Puts a text in a named place, for a clue that needs a certain one.
export function placedAt(name: string, text: string, context: ClueContext): Clue | null {
    const spot = spots.find((candidate) => candidate.name === name);
    return spot === undefined || !(spot.fits?.(text, context) ?? true) ? null : spot.place(text, context);
}
