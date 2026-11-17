import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decode } from './encodings.ts';
import { entrance, firstGeneratedLevel, levelPage, urlOfLevel, type Entrance, type LevelPage } from './levels.ts';
import { methodLevels, type Part, type Step } from './methods.ts';
import { hidingPlaces } from './spots.ts';
import { clueLines, puzzleHints } from './text.ts';

const lastLevel = 1200;
const levels = Array.from({ length: lastLevel - firstGeneratedLevel + 1 }, (_, index) => firstGeneratedLevel + index);
const targets = levels.map((level) => entrance(level));
const methodNames = [...methodLevels.keys()];
const alphabet = 'abcdefghijklmnopqrstuvwxyz';

// What the clue of a level spells out: the answer, or the words that the address is made of.
function spelled(target: Entrance): string {
    if (target.credentials !== null) return `${target.credentials.username} ${target.credentials.password}`;
    return target.kind === 'twoWords' || target.kind === 'phrase' ? target.words.join(' ') : target.answer;
}

function undone(text: string, ciphers: readonly Step[]): string {
    return ciphers.reduce((current, step) => decode(current, step.cipher, step.unit, step.key), text);
}

// How many things there are to undo: the reading of a picture, a sound or a pattern counts as one, and so does each cipher. Two halves count as two.
function stepCount(parts: readonly Part[]): number {
    return parts.length > 1 ? parts.length : (parts[0]!.reading === undefined ? 0 : 1) + parts[0]!.ciphers.length;
}

const squeezed = (text: string): string => text.replace(/\s+/g, '');
const fileText = (page: LevelPage, linked: string): string => page.files.flatMap((file) => (file.linked === linked && 'text' in file.content ? [file.content.text] : [])).join(' ');
const pageOf = (page: LevelPage): string => page.files.flatMap((file) => ('page' in file.content ? [file.content.page] : [])).join(' ');

// The text at each hiding place of a page.
const placeTexts: Readonly<Record<string, (page: LevelPage) => string>> = {
    lines: (page) => page.lines.join(' '),
    comment: (page) => page.comments.join(' '),
    title: (page) => page.title,
    hiddenText: (page) => page.hiddenText ?? '',
    imageTitle: (page) => page.imageTitle ?? '',
    belowFold: (page) => page.belowFold.join(' '),
    altText: (page) => page.altText ?? '',
    farRight: (page) => page.farRight.join(' '),
    farComment: (page) => page.farComment ?? '',
    marquee: (page) => page.marquee ?? '',
    statusBar: (page) => page.statusText ?? '',
    unseen: (page) => page.unseen ?? '',
    meta: (page) => page.meta ?? '',
    hotspot: pageOf,
    hiddenField: (page) => page.hiddenField ?? '',
    options: (page) => page.options.join(' '),
    noscript: (page) => page.noscript ?? '',
    stylesheet: (page) => fileText(page, 'stylesheet'),
    scriptVariable: (page) => page.scriptVariable ?? '',
    attribute: (page) => page.attribute ?? '',
    imageName: (page) => page.imageName.replace(/\.jpg$/, ''),
    anchor: (page) => page.anchor ?? '',
    imageNote: (page) => page.imageNote ?? '',
    imageMap: (page) => page.areaCoordinates.join(' '),
    conditional: (page) => page.conditional ?? '',
    zipped: (page) => page.zipped ?? '',
    script: (page) => fileText(page, 'script'),
};

const boldMarks = (page: LevelPage): string => page.emphasis.flat().flatMap((segment) => [...segment.text.replace(/[^a-z]/gi, '')].map(() => (segment.bold ? 'B' : 'A'))).join('');
// The lines of a page that are part of its puzzle: not a hint, and not the line that says something about the address.
const knownLines: readonly string[] = [...Object.values(puzzleHints).flat(), ...Object.values(clueLines).flat()];
const puzzleLines = (page: LevelPage): string[] => page.lines.filter((line) => !knownLines.includes(line));
const linesText = (page: LevelPage): string => puzzleLines(page).join(' ');

// What each pattern on a page reads as, for the patterns that can be read back from the page alone.
const readings: Readonly<Record<string, (page: LevelPage) => string>> = {
    capitals: (page) => linesText(page).replace(/[^A-Z]/g, '').toLowerCase(),
    boldLetters: (page) => page.emphasis.flat().filter((segment) => segment.bold).map((segment) => segment.text).join(''),
    acrostic: (page) => linesText(page).split(' ').map((word) => word[0]!.toLowerCase()).join(''),
    lastLetters: (page) => linesText(page).split(' ').map((word) => word.at(-1)!).join(''),
    diagonal: (page) => puzzleLines(page).map((line, index) => line[index]!).join(''),
    everyThird: (page) => [...squeezed(linesText(page))].filter((_, index) => index % 3 === 2).join(''),
    interleaved: (page) => { const [first, second] = puzzleLines(page); return [...first!].map((letter, index) => (letter === '.' ? second![index] : letter)).join(''); },
    scrambled: (page) => [...page.spans].sort((first, second) => first.order - second.order).map((span) => span.letter).join(''),
    letterChart: (page) => page.grid.map((row) => alphabet[row.indexOf('o')]!).join(''),
    fakeTags: (page) => page.tags.map((tag) => tag[0]!).join(''),
    checkboxes: (page) => page.checkboxes.join(' '),
    spacers: (page) => page.spacers.join(' '),
    swatches: (page) => page.colors.flatMap((color) => color.slice(1).match(/../g) ?? []).filter((code) => code !== '00').join(' '),
    baconFonts: (page) => boldMarks(page),
    baconCase: (page) => [...linesText(page).replace(/[^a-z]/gi, '')].map((letter) => (letter === letter.toUpperCase() ? 'B' : 'A')).join(''),
    caselessBase64: (page) => {
        const capitals = new Set((page.comments[0] ?? '').split(' ').map(Number));
        return [...squeezed(linesText(page))].map((character, index) => (capitals.has(index + 1) ? character.toUpperCase() : character)).join('');
    },
};

describe('puzzle methods', () => {
    it('records for every generated level a way back to the answer that the decoders can follow', () => {
        for (const target of targets) {
            const parts = target.clue.parts;
            expect(parts, `level ${target.level} (${target.clue.method})`).toBeDefined();
            expect(parts!.map((part) => undone(part.text, part.ciphers)).join(''), `level ${target.level} (${target.clue.method})`).toBe(spelled(target));
        }
    });

    it('puts the recorded text where the record says it is', () => {
        const checked = new Set<string>();
        for (const target of targets) {
            const page = levelPage(target.level - 1);
            for (const part of target.clue.parts!) {
                const text = placeTexts[part.place];
                if (text === undefined || part.reading === 'earlierAnswers') continue;
                const shown = part.reading === undefined || part.reading === 'caselessBase64' ? part.text : undefined;
                if (shown === undefined) continue;
                const found = part.reading === 'caselessBase64' ? text(page).toLowerCase() : text(page);
                const sought = part.reading === 'caselessBase64' ? shown.toLowerCase() : shown;
                expect(sought.trim() === '' ? found.includes(`[${sought}]`) : squeezed(found).includes(squeezed(sought)), `level ${target.level}: ${part.place} holds ${sought}`).toBe(true);
                checked.add(part.place);
            }
        }
        expect([...checked].sort()).toEqual([...hidingPlaces, 'script'].sort());
    });

    it('reads every pattern on a page back as what was put in it', () => {
        const seen = new Set<string>();
        for (const target of targets) {
            const page = levelPage(target.level - 1);
            for (const { reading, text } of target.clue.parts!) {
                const read = reading === undefined ? undefined : readings[reading];
                if (reading === undefined || read === undefined) continue;
                const found = read(page);
                // A cover text may run on for a few letters after the last one that counts.
                const marks = text.replace(/[^AB]/g, '');
                if (reading.startsWith('bacon')) expect(found.startsWith(marks) && found.length - marks.length < 5, `level ${target.level} (${reading}): ${found}`).toBe(true);
                else expect(found, `level ${target.level} (${reading})`).toBe(text);
                seen.add(reading);
            }
        }
        expect([...seen].sort()).toEqual(Object.keys(readings).sort());
    });

    it('draws and plays what the record says a picture or a sound holds', () => {
        let pictures = 0;
        let sounds = 0;
        for (const target of targets) {
            const { clue } = target;
            const part = clue.parts![0]!;
            const made = clue.drawing?.text ?? clue.sound?.text;
            if (made === undefined || part.reading === undefined) continue;
            // A picture or a sound is made from the text it spells out, or from the word under the code it spells.
            expect([part.text, undone(part.text, part.ciphers.slice(0, 1))], `level ${target.level} (${part.reading})`).toContain(made);
            if (clue.drawing !== undefined) {
                expect(part.reading, `level ${target.level}`).toBe(`${clue.drawing.kind}Picture`);
                pictures++;
            } else sounds++;
        }
        expect(pictures).toBeGreaterThan(100);
        expect(sounds).toBeGreaterThan(20);
    });

    it('keeps the key of a keyed cipher on the page', () => {
        let keys = 0;
        let hiddenKeys = 0;
        for (const target of targets) {
            const page = levelPage(target.level - 1);
            for (const step of target.clue.parts!.flatMap((part) => part.ciphers)) {
                if (step.keyAt === undefined) continue;
                expect(undone(step.keyAt.text, step.keyAt.ciphers), `level ${target.level}`).toBe(step.key);
                expect(placeTexts[step.keyAt.place]!(page), `level ${target.level}`).toContain(step.keyAt.text);
                keys++;
                if (step.keyAt.ciphers.length > 0) hiddenKeys++;
            }
        }
        expect(keys).toBeGreaterThan(20);
        expect(hiddenKeys).toBeGreaterThan(1);
    });

    it('never puts an answer on a page as it is', () => {
        for (const target of targets) {
            const page = levelPage(target.level - 1);
            const shown = [...Object.values(placeTexts).map((text) => text(page)), ...page.lines, ...page.belowFold, ...page.farRight, ...page.comments, ...page.options,
                page.spans.map((span) => span.letter).join(''), ...page.grid];
            const hidden = [target.answer.toLowerCase(), spelled(target).toLowerCase()];
            expect(shown.filter((text) => hidden.includes(text.trim().toLowerCase())), `level ${target.level} (${target.clue.method})`).toEqual([]);
        }
    });

    it('uses every method and every hiding place at least once', () => {
        const used = new Set(targets.map((target) => target.clue.method));
        expect(methodNames.filter((name) => !used.has(name))).toEqual([]);
        expect(methodNames.length).toBeGreaterThan(120);
        const places = new Set(targets.flatMap((target) => target.clue.parts!.map((part) => part.place)));
        expect(hidingPlaces.filter((place) => !places.has(place))).toEqual([]);
    });

    it('shows a method for the first time within twenty levels of where it starts', () => {
        const first = new Map<string, number>();
        for (const target of targets) if (target.clue.method !== undefined && !first.has(target.clue.method)) first.set(target.clue.method, target.level);
        const late = methodNames.filter((name) => first.get(name)! - methodLevels.get(name)! > 20);
        expect(late, late.map((name) => `${name} ${methodLevels.get(name)} to ${first.get(name)}`).join(', ')).toEqual([]);
    });

    it.each([
        [11, 60, 0, 0.1, 0, 0],
        [60, 150, 0.15, 0.4, 0, 0],
        [150, 250, 0.35, 0.6, 0, 0],
        [250, 350, 0.45, 0.65, 0.04, 0],
        [350, 500, 0.6, 0.8, 0.07, 0],
        [500, 1000, 0.65, 0.85, 0.15, 0.02],
    ])('combines methods in levels %i to %i as often as it is meant to', (from, to, fewest, most, fewestOfThree, fewestOfFour) => {
        const counts = targets.filter((target) => target.level >= from && target.level < to).map((target) => stepCount(target.clue.parts!));
        const share = (steps: number): number => counts.filter((count) => count >= steps).length / counts.length;
        expect(share(2)).toBeGreaterThanOrEqual(fewest);
        expect(share(2)).toBeLessThanOrEqual(most);
        expect(share(3)).toBeGreaterThanOrEqual(fewestOfThree);
        expect(share(4)).toBeGreaterThanOrEqual(fewestOfFour);
        if (to <= 250) expect(share(3)).toBe(0);
        if (to <= 500) expect(share(4)).toBe(0);
    });

    it('splits some answers in two halves that are each under a cipher of their own', () => {
        const halves = targets.filter((target) => target.clue.method === 'split');
        expect(halves.length).toBeGreaterThan(3);
        for (const target of halves) {
            const [first, second] = target.clue.parts!;
            expect(first!.place).toBe('lines');
            expect(second!.place).not.toBe('lines');
            expect(first!.ciphers[0]!.cipher).not.toBe(second!.ciphers[0]!.cipher);
            expect(levelPage(target.level - 1).lines).toContain(puzzleHints.halves[0]);
        }
    });

    it('does not let a method change an address or an answer below level 500', () => {
        const early = Array.from({ length: 499 }, (_, index) => entrance(index + 1)).map((target) => [urlOfLevel(target.level), target.kind, target.answer]);
        expect(createHash('sha256').update(JSON.stringify(early)).digest('hex')).toBe('2c151bd2b354e17ebbafa3dc68a76942216e40dd04b11e751b88e19e2668b043');
    });
});
