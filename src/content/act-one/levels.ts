import type { Action } from '../../core/actions.ts';
import type { Drawing } from './drawings.ts';
import { encode, toLeet } from './encodings.ts';
import { imageWithWord, levelImageCount } from './images.ts';
import { encodedClue, leetEncodingFor, textEncodingFor, wordClue, yearClue, type Clue } from './methods.ts';
import { firstYear, pickByUnit, ramp, riddleOrigin, salts, startUrl, unitHash, yearCount } from './riddle.ts';
import type { Sound } from './sounds.ts';
import { alternateFiles, clueLines, fill, handcraftedText, linkedFiles, pageText, riddleName } from './text.ts';
import { rankOfWord, vocabularySize, wordAtRank } from './vocabulary.ts';
import { answerNames, folderNames } from './word-lists.ts';

export type EntranceKind = 'fixed' | 'word' | 'extension' | 'name' | 'leet' | 'number' | 'credentials' | 'twoWords' | 'phrase';
type GeneratedKind = Exclude<EntranceKind, 'fixed'>;

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

type FileContent = { readonly text: string } | { readonly drawing: Drawing } | { readonly sound: Sound } | { readonly page: string } | { readonly bytesOf: string };

export interface LevelFile {
    readonly name: string;
    readonly linked: 'image' | 'sound' | 'stylesheet' | 'script' | 'hotspot' | 'pictureLink' | null;
    readonly display?: 'hidden' | 'squashed' | 'rollover';
    readonly content: FileContent;
}

export interface LevelPage {
    readonly level: number;
    readonly url: string;
    readonly title: string;
    readonly imageId: number;
    readonly imageName: string;
    readonly imageTitle: string | null;
    readonly imageNote: string | null;
    readonly zipped: string | null;
    readonly hotspot: { readonly x: number; readonly y: number } | null;
    readonly colors: readonly string[];
    readonly grid: readonly string[];
    readonly spans: readonly { readonly letter: string; readonly order: number }[];
    readonly emphasis: readonly (readonly { readonly text: string; readonly bold: boolean }[])[];
    readonly tags: readonly string[];
    readonly spacers: readonly number[];
    readonly attribute: string | null;
    readonly link: string | null;
    readonly lines: readonly string[];
    readonly hiddenText: string | null;
    readonly belowFold: readonly string[];
    readonly meta: string | null;
    readonly comments: readonly string[];
    readonly farComment: string | null;
    readonly files: readonly LevelFile[];
}

interface HandcraftedEntrance {
    readonly kind: EntranceKind;
    readonly answer: string;
    readonly clue: Clue;
    readonly positionUnit?: number;
}

export const firstGeneratedLevel = 11;
export const userAgentBlockLevel = 45;
const firstFolderLevel = 100;
const commonWordShare = 0.25;
const commonWordRanks = 300;
const levelsPerFolder = 100;
const untitledShare = 0.3;

const wildcardFolders = new Set(['basalt', 'ember']);
const unlistedNames = answerNames.filter((name) => wordAtRank(rankOfWord(name)) !== name);
const longNameLevel = 600;
const recentLevels = 20;
const alwaysHintedLevels = 60;
const laterLineShare = 0.4;
const firstExtensionLevel = 150;
const firstCredentialsLevel = 500;
export const otherExtensions: readonly string[] = ['html', 'php', 'asp', 'txt'];

const handcraftedEntrances: Readonly<Record<number, HandcraftedEntrance>> = {
    2: { kind: 'fixed', answer: 'level2', clue: { imageLink: true, lines: [handcraftedText.level1] } },
    3: { kind: 'fixed', answer: 'level3', clue: { lines: [handcraftedText.level2] } },
    4: { kind: 'word', answer: 'beneath', clue: { lines: [handcraftedText.level3], comment: handcraftedText.level3Comment } },
    5: { kind: 'word', answer: 'lighthouse', clue: { lines: [handcraftedText.level4], hiddenText: 'lighthouse' } },
    6: { kind: 'word', answer: 'midnight', positionUnit: 0.08, clue: { method: 'binary', title: handcraftedText.level5Title, lines: binaryLines('midnight') } },
    7: { kind: 'word', answer: 'bridge', clue: { lines: [handcraftedText.level6], imageName: 'present.jpg' } },
    8: { kind: 'word', answer: handcraftedText.level7Tooltip, clue: { imageTitle: handcraftedText.level7Tooltip } },
    9: { kind: 'word', answer: 'mirror', clue: { method: 'rot13', title: handcraftedText.level8Title, lines: [encode('mirror', 'rot13')] } },
    10: { kind: 'word', answer: 'dusk', clue: { method: 'reversed', lines: [encode('dusk', 'reversed')] } },
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

export function entranceAction(target: Entrance): Action {
    return target.credentials === null ? { type: 'navigate', url: target.url } : { type: 'submitCredentials', url: target.url, ...target.credentials };
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
    const url = urlOfLevel(level);
    const imageName = clue.imageName ?? `${level}.jpg`;
    return {
        level,
        url,
        title: clue.title ?? defaultTitle(level),
        imageId: pageImage(level),
        imageName,
        imageTitle: clue.imageTitle ?? null,
        imageNote: clue.imageNote ?? null,
        zipped: clue.zipped ?? null,
        hotspot: clue.hotspot === undefined ? null : { x: 0.08 + unitHash(level, salts.hotspot) * 0.74, y: 0.1 + unitHash(level + 7919, salts.hotspot) * 0.66 },
        colors: clue.colors ?? [],
        grid: clue.grid ?? [],
        spans: clue.spans ?? [],
        emphasis: clue.emphasis ?? [],
        tags: clue.tags ?? [],
        spacers: clue.spacers ?? [],
        attribute: clue.attribute ?? null,
        link: clue.imageLink === true ? next.url : null,
        lines: [...(clue.lines ?? []), ...(level === 404 ? [handcraftedText.easterEgg404] : level === 418 ? [handcraftedText.easterEgg418] : [])],
        hiddenText: clue.hiddenText ?? null,
        belowFold: clue.belowFold ?? [],
        meta: clue.meta ?? null,
        comments: [clue.comment, next.folder !== null && next.folder !== folderFor(level) ? fill(pageText.folderComment, { folder: next.folder }) : undefined].filter((comment) => comment !== undefined),
        farComment: clue.farComment ?? null,
        files: levelFiles(level, clue, imageName, url, next.url),
    };
}

function levelFiles(level: number, clue: Clue, imageName: string, url: string, nextUrl: string): LevelFile[] {
    const files: LevelFile[] = [];
    if (clue.drawing !== undefined) files.push({ name: `${level}b.gif`, linked: 'image', display: clue.drawingDisplay, content: { drawing: clue.drawing } });
    if (clue.hotspot !== undefined) files.push({ name: `${level}a.htm`, linked: 'hotspot', content: { page: clue.hotspot } });
    if (clue.zipped !== undefined) {
        const name = imageName.replace(/\.jpg$/, '.zip');
        files.push({ name, linked: null, content: { text: fill(alternateFiles.zip, { name, word: clue.zipped }) } });
    }
    if (clue.spacers !== undefined) files.push({ name: 'spacer.gif', linked: null, content: { drawing: { kind: 'spacer', text: '' } } });
    if (clue.renamed !== undefined) {
        files.push({ name: `${level}.txt`, linked: 'pictureLink', content: { bytesOf: `${level}.gif` } });
        files.push({ name: `${level}.gif`, linked: null, content: { drawing: { kind: 'plain', text: clue.renamed } } });
    }
    if (clue.sound !== undefined) files.push({ name: `${level}.wav`, linked: 'sound', content: { sound: clue.sound } });
    if (clue.stylesheet !== undefined) files.push({ name: `${level}.css`, linked: 'stylesheet', content: { text: fill(linkedFiles.stylesheet, { text: clue.stylesheet }) } });
    if (clue.script !== undefined) {
        const text = fill(linkedFiles.script, { expression: clue.script, address: scriptAddress(url, nextUrl) });
        files.push({ name: `${level}.js`, linked: 'script', content: { text } });
    }
    if (clue.alternate !== undefined) {
        const { extension, text } = clue.alternate;
        const name = imageName.replace(/\.jpg$/, `.${extension}`);
        const content: FileContent = extension === 'gif' ? { drawing: { kind: 'gift', text } }
            : extension === 'wav' ? { sound: { kind: 'morse', text } }
            : { text: fill(alternateFiles[extension], { word: text, name }) };
        files.push({ name, linked: null, content });
    }
    return files;
}

function scriptAddress(from: string, to: string): string {
    const folder = (address: string): string => address.slice(0, address.lastIndexOf('/') + 1);
    return folder(from) === folder(to) ? 'password + ".htm"' : `"${new URL(folder(to)).pathname}" + password + ".htm"`;
}

function defaultTitle(level: number): string {
    return level >= firstGeneratedLevel && unitHash(level, salts.title) < untitledShare ? '' : riddleName;
}

function handcraftedEntrance(level: number): Entrance {
    const definition = handcraftedEntrances[level];
    if (definition === undefined) {
        return buildEntrance(level, { kind: 'fixed', answer: `level${level}`, words: [], clue: {}, folder: null });
    }
    const words = definition.kind === 'fixed' ? [] : [definition.answer];
    const target = buildEntrance(level, { kind: definition.kind, answer: definition.answer, words, clue: definition.clue, folder: null });
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

function generatedEntrance(level: number, attempt: number): Entrance {
    const kind = chooseKind(level);
    const unit = (salt: number): number => unitHash(level, salt + attempt * 97);
    const folder = folderFor(level);
    const recent = recentMethods(level);
    switch (kind) {
        case 'word': {
            const word = unit(salts.common) < commonWordShare ? sampleCommonWord(unit(salts.rank), commonWordRanks, 10) : sampleWord(level, unit(salts.rank));
            return buildEntrance(level, { kind, answer: word, clue: wordClue(level, word, wordPageName, true, recent), folder });
        }
        case 'extension': {
            const word = sampleWord(level, unit(salts.rank));
            const extension = pickByUnit(otherExtensions, unit(salts.extension));
            const wordHint = wordClue(level, word, wordPageName, false, recent);
            const ending = showsLine(level, firstExtensionLevel) ? [pickByUnit(clueLines.extension, unit(salts.ending))] : [];
            const clue: Clue = { ...wordHint, imageName: `${wordHint.imageName?.replace(/\.jpg$/, '') ?? level}.${extension}.jpg`, lines: [...(wordHint.lines ?? []), ...ending] };
            return buildEntrance(level, { kind, answer: word, extension, clue, folder });
        }
        case 'name': {
            const name = pickByUnit(unlistedNames.filter((candidate) => candidate.length <= (level < longNameLevel ? 4 : 5)), unit(salts.rank));
            return buildEntrance(level, { kind, answer: name, clue: wordClue(level, name, wordPageName, true, recent), folder });
        }
        case 'leet': {
            const word = sampleWord(level, unit(salts.rank));
            const answer = toLeet(word, unit(salts.leet));
            const clue = encodedClue(answer, leetEncodingFor(unit(salts.encoding), recent), level, unit(salts.clue));
            return buildEntrance(level, { kind, answer, words: [word], clue, folder });
        }
        case 'number': {
            const year = firstYear + Math.floor(unit(salts.year) * yearCount);
            const clue = yearClue(year, level, unit(salts.clue), recent);
            return buildEntrance(level, { kind, answer: String(year), words: [], clue, folder });
        }
        case 'credentials': {
            const door = sampleCommonWord(unit(salts.door), 400, 9);
            const username = sampleCommonWord(unit(salts.username), 300, 9);
            const password = sampleCommonWord(unit(salts.password), pairRank(level, 600), 9, username);
            const encoding = textEncodingFor(level, unit(salts.encoding), recent);
            const lines = showsLine(level, firstCredentialsLevel) ? [pickByUnit(clueLines.credentials, unit(salts.ending))] : [];
            const clue: Clue = { method: encoding, imageLink: true, lines, comment: encode(`${username} ${password}`, encoding) };
            return buildEntrance(level, { kind, answer: door, extension: '', words: [door, username, password], credentials: { username, password }, clue, folder });
        }
        case 'twoWords': {
            const first = sampleCommonWord(unit(salts.rank), 300, 7);
            const second = sampleCommonWord(unit(salts.secondWord), pairRank(level, 700), 7, first);
            const clue = encodedClue(`${first} ${second}`, textEncodingFor(level, unit(salts.encoding), recent), level, unit(salts.clue));
            return buildEntrance(level, { kind, answer: `${first}${second}`, words: [first, second], clue, folder });
        }
        case 'phrase': {
            const wordCount = 3 + Math.floor(unit(salts.phraseLength) * 2);
            const phraseSalts = [salts.rank, salts.secondWord, salts.thirdWord, salts.fourthWord];
            const words = phraseSalts.slice(0, wordCount).map((salt) => sampleCommonWord(unit(salt), 600, 7));
            const clue = encodedClue(words.join(' '), textEncodingFor(level, unit(salts.encoding), recent), level, unit(salts.clue));
            return buildEntrance(level, { kind, answer: words.join(''), words, clue, folder });
        }
    }
}

interface EntranceParts {
    readonly kind: EntranceKind;
    readonly answer: string;
    readonly clue: Clue;
    readonly folder: string | null;
    readonly extension?: string;
    readonly words?: readonly string[];
    readonly credentials?: Credentials | null;
}

function buildEntrance(level: number, { kind, answer, clue, folder, extension = 'htm', words = [answer], credentials = null }: EntranceParts): Entrance {
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

function recentMethods(level: number): string[] {
    const methods: string[] = [];
    for (let previous = level - 1; previous >= Math.max(2, level - recentLevels); previous--) {
        const method = entrance(previous).clue.method;
        if (method !== undefined) methods.push(method);
    }
    return methods;
}

function showsLine(level: number, firstLevel: number): boolean {
    return level < firstLevel + alwaysHintedLevels || unitHash(level, salts.hintShown) < laterLineShare;
}

function wordPageName(level: number): string | null {
    const named = entrance(level);
    return named.kind === 'word' ? named.answer : null;
}

function chooseKind(level: number): GeneratedKind {
    const weights: readonly (readonly [GeneratedKind, number])[] = [
        ['extension', ramp(level, 150, 400, 0.08, 0.2)],
        ['name', ramp(level, 250, 1000, 0.015, 0.03)],
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

function pairRank(level: number, fromLevel: number): number {
    return Math.max(300, Math.round(ramp(level, fromLevel, 1000, 300, 900)));
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

