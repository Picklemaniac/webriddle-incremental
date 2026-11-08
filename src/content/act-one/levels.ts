import { encode, toLeet } from './encodings.ts';
import { imageForSubject, imageWithWord, levelImageCount } from './images.ts';
import { textEncodingFor, wordClue, yearClue, type Clue } from './methods.ts';
import { pickByUnit, ramp, riddleOrigin, salts, startUrl, unitHash } from './riddle.ts';
import { clueLines, fill, handcraftedText, pageText } from './text.ts';
import { vocabularySize, wordAtRank } from './vocabulary.ts';
import { folderNames } from './word-lists.ts';

type EntranceKind = 'fixed' | 'word' | 'extension' | 'leet' | 'number' | 'credentials' | 'twoWords' | 'phrase';

interface Credentials {
    readonly username: string;
    readonly password: string;
}

export interface Entrance {
    readonly level: number;
    readonly kind: EntranceKind;
    readonly path: string;
    readonly url: string;
    readonly folder: string | null;
    readonly wildcard: boolean;
    readonly answer: string;
    readonly extension: string;
    readonly words: readonly string[];
    readonly credentials: Credentials | null;
    readonly clue: Clue;
    readonly indexUnit: number;
    readonly positionUnit: number;
}

export interface LevelPage {
    readonly level: number;
    readonly url: string;
    readonly title: string;
    readonly imageId: number;
    readonly imageName: string;
    readonly imageTitle: string | null;
    readonly colors: readonly string[];
    readonly alternate: NonNullable<Clue['alternate']> | null;
    readonly link: string | null;
    readonly lines: readonly string[];
    readonly hiddenText: string | null;
    readonly comments: readonly string[];
}

interface HandcraftedEntrance {
    readonly kind: EntranceKind;
    readonly answer: string;
    readonly clue: Clue;
    readonly positionUnit?: number;
}

const firstGeneratedLevel = 11;
export const userAgentBlockLevel = 45;
const firstFolderLevel = 100;
const commonWordShare = 0.25;
const commonWordRanks = 300;
const levelsPerFolder = 100;

const wildcardFolders = new Set(['basalt', 'ember']);
export const otherExtensions: readonly string[] = ['html', 'php', 'asp', 'txt'];

const handcraftedEntrances: Readonly<Record<number, HandcraftedEntrance>> = {
    2: { kind: 'fixed', answer: 'level2', clue: { imageLink: true, lines: [handcraftedText.level1] } },
    3: { kind: 'fixed', answer: 'level3', clue: { lines: [handcraftedText.level2] } },
    4: { kind: 'word', answer: 'beneath', clue: { lines: [handcraftedText.level3], comment: handcraftedText.level3Comment } },
    5: { kind: 'word', answer: 'lighthouse', clue: { lines: [handcraftedText.level4], hiddenText: 'lighthouse' } },
    6: { kind: 'word', answer: 'midnight', positionUnit: 0.08, clue: { title: handcraftedText.level5Title, lines: binaryLines('midnight') } },
    7: { kind: 'word', answer: 'bridge', clue: { lines: [handcraftedText.level6], imageName: 'present.jpg' } },
    8: { kind: 'word', answer: 'moon', clue: {} },
    9: { kind: 'word', answer: 'mirror', clue: { title: handcraftedText.level8Title, lines: [encode('mirror', 'rot13')] } },
    10: { kind: 'word', answer: 'dusk', clue: { lines: [encode('dusk', 'reversed')] } },
};

const handcraftedPageImageWords: Readonly<Record<number, string>> = {
    1: 'path', 2: 'staircase', 3: 'foggy', 4: 'cave', 5: 'lighthouse', 6: 'bouquet', 7: 'moon', 8: 'crescent', 9: 'mirror',
};

const handcraftedPageImages = new Set(Object.values(handcraftedPageImageWords).map(imageWithWord));
const generatedPageImages = Array.from({ length: levelImageCount }, (_, imageId) => imageId).filter((imageId) => !handcraftedPageImages.has(imageId));

const entranceCache = new Map<number, Entrance>();

export function entrance(level: number): Entrance {
    const cached = entranceCache.get(level);
    if (cached !== undefined) {
        return cached;
    }
    if (entranceCache.size > 4096) {
        entranceCache.clear();
    }
    const created = level < firstGeneratedLevel ? handcraftedEntrance(level) : uniqueGeneratedEntrance(level);
    entranceCache.set(level, created);
    return created;
}

export function urlOfLevel(level: number): string {
    return level <= 1 ? startUrl : entrance(level).url;
}

export function folderFor(level: number): string | null {
    if (level < firstFolderLevel) {
        return null;
    }
    const index = Math.floor(level / levelsPerFolder) - 1;
    return folderNames[index] ?? `zenith${index - folderNames.length + 2}`;
}

export function levelPage(level: number): LevelPage {
    const next = entrance(level + 1);
    const clue = next.clue;
    return {
        level,
        url: urlOfLevel(level),
        title: clue.title ? fill(pageText.levelTitleWithClue, { level, clue: clue.title }) : fill(pageText.levelTitle, { level }),
        imageId: pageImage(level),
        imageName: clue.imageName ?? `${level}.jpg`,
        imageTitle: clue.imageTitle ?? null,
        colors: clue.colors ?? [],
        alternate: clue.alternate ?? null,
        link: clue.imageLink === true ? next.url : null,
        lines: [...(clue.lines ?? []), ...(level === 404 ? [handcraftedText.easterEgg404] : level === 418 ? [handcraftedText.easterEgg418] : [])],
        hiddenText: clue.hiddenText ?? null,
        comments: [clue.comment, next.folder !== null && next.folder !== folderFor(level) ? fill(pageText.folderComment, { folder: next.folder }) : undefined].filter((comment) => comment !== undefined),
    };
}

export function presentImageId(): number {
    return imageForSubject('bridge', 0);
}

function handcraftedEntrance(level: number): Entrance {
    const definition = handcraftedEntrances[level];
    if (definition === undefined) {
        return buildEntrance(level, 'fixed', `level${level}`, 'htm', [], null, {}, null);
    }
    const words = definition.kind === 'fixed' ? [] : [definition.answer];
    const target = buildEntrance(level, definition.kind, definition.answer, 'htm', words, null, definition.clue, null);
    return { ...target, positionUnit: definition.positionUnit ?? target.positionUnit };
}

function uniqueGeneratedEntrance(level: number): Entrance {
    const firstInFolder = Math.max(1, Math.floor(level / levelsPerFolder) * levelsPerFolder);
    const used = new Set<string>();
    for (let previous = firstInFolder; previous < level; previous++) {
        used.add(entrance(previous).path);
    }
    for (let attempt = 0; attempt < 4096; attempt++) {
        const candidate = generatedEntrance(level, attempt);
        if (!used.has(candidate.path)) return candidate;
    }
    throw new Error(`Could not generate a unique entrance for level ${level}.`);
}

function generatedEntrance(level: number, attempt = 0): Entrance {
    const kind = chooseKind(level);
    const unit = (salt: number): number => unitHash(level, salt + attempt * 97);
    const folder = folderFor(level);
    switch (kind) {
        case 'word': {
            const word = unit(salts.common) < commonWordShare ? sampleCommonWord(unit(salts.rank), commonWordRanks, 10) : sampleWord(level, unit(salts.rank));
            return buildEntrance(level, kind, word, 'htm', [word], null, wordClue(level, word), folder);
        }
        case 'extension': {
            const word = sampleWord(level, unit(salts.rank));
            const extension = pickByUnit(otherExtensions, unit(salts.extension));
            const wordHint = wordClue(level, word, false);
            const clue: Clue = {
                ...wordHint,
                imageName: `${wordHint.imageName?.replace(/\.jpg$/, '') ?? level}.${extension}.jpg`,
                lines: [...(wordHint.lines ?? []), pickByUnit(clueLines.extension, unit(salts.ending))],
            };
            return buildEntrance(level, kind, word, extension, [word], null, clue, folder);
        }
        case 'leet': {
            const word = sampleWord(level, unit(salts.rank));
            const answer = toLeet(word, unit(salts.leet));
            const clue: Clue = unit(salts.clue) < 0.5 ? { title: answer } : { comment: answer };
            return buildEntrance(level, kind, answer, 'htm', [word], null, clue, folder);
        }
        case 'number': {
            const year = 1000 + Math.floor(unit(salts.year) * 1100);
            const clue: Clue = { lines: [yearClue(year, level, unit(salts.clue))] };
            return buildEntrance(level, kind, String(year), 'htm', [], null, clue, folder);
        }
        case 'credentials': {
            const door = sampleCommonWord(unit(salts.door), 400, 9);
            const username = sampleCommonWord(unit(salts.username), 300, 9);
            const password = sampleCommonWord(unit(salts.password), 300, 9, username);
            const encoding = textEncodingFor(level, unit(salts.encoding));
            const clue: Clue = { imageLink: true, lines: [clueLines.credentials], comment: encode(`${username} ${password}`, encoding) };
            return buildEntrance(level, kind, door, '', [door, username, password], { username, password }, clue, folder);
        }
        case 'twoWords': {
            const first = sampleCommonWord(unit(salts.rank), 300, 7);
            const second = sampleCommonWord(unit(salts.secondWord), 300, 7, first);
            const clue: Clue = { comment: encode(`${first} ${second}`, textEncodingFor(level, unit(salts.encoding))) };
            return buildEntrance(level, kind, `${first}${second}`, 'htm', [first, second], null, clue, folder);
        }
        case 'phrase': {
            const wordCount = 3 + Math.floor(unit(salts.phraseLength) * 2);
            const phraseSalts = [salts.rank, salts.secondWord, salts.thirdWord, salts.fourthWord];
            const words = phraseSalts.slice(0, wordCount).map((salt) => sampleCommonWord(unit(salt), 600, 7));
            const encoding = textEncodingFor(level, unit(salts.encoding));
            const clue: Clue = { comment: encode(words.join(' '), encoding) };
            return buildEntrance(level, kind, words.join(''), 'htm', words, null, clue, folder);
        }
        case 'fixed':
            return handcraftedEntrance(level);
    }
}

function buildEntrance(
    level: number,
    kind: EntranceKind,
    answer: string,
    extension: string,
    words: readonly string[],
    credentials: Credentials | null,
    clue: Clue,
    folder: string | null,
): Entrance {
    const folderPath = folder === null ? '/' : `/${folder}/`;
    const path = kind === 'credentials' ? `${folderPath}${answer}/` : `${folderPath}${answer}.${extension}`;
    return {
        level,
        kind,
        path,
        url: `${riddleOrigin}${path}`,
        folder,
        wildcard: folder !== null && wildcardFolders.has(folder),
        answer,
        extension,
        words,
        credentials,
        clue,
        indexUnit: level < firstGeneratedLevel ? 1 : unitHash(level, salts.index),
        positionUnit: unitHash(level, salts.position),
    };
}

function chooseKind(level: number): EntranceKind {
    const weights: readonly (readonly [EntranceKind, number])[] = [
        ['extension', ramp(level, 150, 400, 0.08, 0.2)],
        ['leet', ramp(level, 300, 600, 0.06, 0.16)],
        ['number', ramp(level, 400, 700, 0.06, 0.1)],
        ['credentials', ramp(level, 500, 800, 0.05, 0.1)],
        ['twoWords', ramp(level, 700, 1000, 0.1, 0.25)],
        ['phrase', ramp(level, 1000, 1300, 0.15, 0.6)],
    ];
    let roll = unitHash(level, salts.kind);
    for (const [kind, weight] of weights) {
        if (roll < weight) {
            return kind;
        }
        roll -= weight;
    }
    return 'word';
}

function maximumRank(level: number): number {
    return Math.min(vocabularySize, Math.max(200, Math.round(120 * (level / 30) ** 1.25)));
}

function sampleWord(level: number, unit: number): string {
    return wordAtRank(Math.max(1, Math.floor(Math.exp(unit * Math.log(maximumRank(level))))));
}

function sampleCommonWord(unit: number, maximum: number, maximumLength: number, avoid?: string): string {
    const startRank = 1 + Math.floor(unit * maximum);
    for (let offset = 0; offset < maximum; offset++) {
        const word = wordAtRank(((startRank + offset - 1) % maximum) + 1);
        if (word.length <= maximumLength && word !== avoid) {
            return word;
        }
    }
    return wordAtRank(startRank);
}



function binaryLines(word: string): string[] {
    const bytes = encode(word, 'binary').split(' ');
    const half = Math.ceil(bytes.length / 2);
    return [bytes.slice(0, half).join(' '), bytes.slice(half).join(' ')];
}

export function inWildcardFolder(address: string): boolean {
    return wildcardFolders.has(new URL(address).pathname.split('/')[1] ?? '');
}

function pageImage(level: number): number {
    const handcraftedWord = handcraftedPageImageWords[level];
    return handcraftedWord === undefined ? generatedPageImages[(level * 7919) % generatedPageImages.length]! : imageWithWord(handcraftedWord);
}

