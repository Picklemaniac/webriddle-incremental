import type { Drawing } from './drawings.ts';
import type { Encoding } from './encodings.ts';
import { pickByUnit, salts, unitHash } from './riddle.ts';
import type { Sound } from './sounds.ts';
import { puzzleHints } from './text.ts';

export type AlternateExtension = 'gif' | 'txt' | 'json' | 'css' | 'xml' | 'wav' | 'zip';

// A cipher on the way to an answer, with what it takes to undo it.
export interface Step {
    readonly cipher: Encoding;
    readonly unit?: number;
    readonly key?: string;
    // Where the key of a keyed cipher is on the page, and what it is hidden under.
    readonly keyAt?: Part;
}

// One piece of the way from a page to its answer. A solver finds the place, reads it when it is a picture, a sound or a pattern in the text, and undoes each cipher, outermost first.
export interface Part {
    readonly place: string;
    readonly reading?: string;
    readonly text: string;
    readonly ciphers: readonly Step[];
}

export interface Clue {
    readonly method?: string;
    // The way to the answer. A clue in two halves has two parts, in the order they are put together.
    readonly parts?: readonly Part[];
    readonly title?: string;
    readonly lines?: readonly string[];
    readonly comment?: string;
    readonly farComment?: string;
    readonly hiddenText?: string;
    readonly belowFold?: readonly string[];
    readonly farRight?: readonly string[];
    readonly meta?: string;
    readonly imageName?: string;
    readonly imageTitle?: string;
    readonly imageLink?: boolean;
    readonly imageNote?: string;
    readonly altText?: string;
    readonly statusText?: string;
    readonly areaCoordinates?: readonly number[];
    readonly colors?: readonly string[];
    readonly drawing?: Drawing;
    readonly drawingDisplay?: 'hidden' | 'squashed' | 'rollover';
    readonly grid?: readonly string[];
    readonly spans?: readonly { readonly letter: string; readonly order: number }[];
    readonly hotspot?: string;
    readonly zipped?: string;
    readonly renamed?: string;
    readonly emphasis?: readonly (readonly { readonly text: string; readonly bold: boolean }[])[];
    readonly tags?: readonly string[];
    readonly spacers?: readonly number[];
    readonly checkboxes?: readonly string[];
    readonly options?: readonly string[];
    readonly marquee?: string;
    readonly attribute?: string;
    readonly anchor?: string;
    readonly hiddenField?: string;
    readonly unseen?: string;
    readonly noscript?: string;
    readonly conditional?: string;
    readonly scriptVariable?: string;
    readonly sound?: Sound;
    readonly stylesheet?: string;
    readonly script?: string;
    readonly alternate?: { readonly extension: AlternateExtension; readonly text: string };
}

export interface ClueContext {
    // What the method has to carry: the answer, under the ciphers in `inner`.
    readonly word: string;
    readonly answer: string;
    readonly inner: readonly Step[];
    readonly level: number;
    readonly unit: number;
    readonly withImage: boolean;
    readonly titleFree: boolean;
    readonly pageName?: (level: number) => string | null;
}

export type HintKey = keyof typeof puzzleHints;

export const lineWidth = 36;

export function variant(key: HintKey, level: number): string {
    return pickByUnit(puzzleHints[key], unitHash(level, salts.hint));
}

export function withLine(line: string, clue: Clue): Clue {
    return { ...clue, lines: [line, ...(clue.lines ?? [])] };
}

export function lineUp(text: string, width = lineWidth): string[] {
    const lines: string[] = [];
    let current = '';
    for (const token of text.split(' ').filter(Boolean).flatMap((part) => part.match(new RegExp(`.{1,${width}}`, 'g')) ?? [part])) {
        if (current !== '' && current.length + 1 + token.length > width) {
            lines.push(current);
            current = token;
        } else {
            current = current === '' ? token : `${current} ${token}`;
        }
    }
    if (current !== '') lines.push(current);
    return lines;
}

// Every text a clue puts on the page, to check that none of them is the answer itself.
export function shownTexts(clue: Clue): string[] {
    const texts = [clue.title, clue.comment, clue.farComment, clue.hiddenText, clue.hotspot, clue.zipped, clue.attribute, clue.spans?.map((span) => span.letter).join(''), clue.meta, clue.imageTitle,
        clue.imageNote, clue.stylesheet, clue.imageName?.replace(/\.jpg$/, ''), clue.altText, clue.statusText, clue.anchor, clue.hiddenField, clue.unseen, clue.noscript, clue.conditional,
        clue.scriptVariable, clue.marquee, clue.options?.join(' '), ...(clue.lines ?? []), clue.lines?.join(''), ...(clue.belowFold ?? []), ...(clue.farRight ?? [])];
    return texts.filter((text) => text !== undefined);
}
