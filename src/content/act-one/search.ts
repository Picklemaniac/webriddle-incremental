import type { GameState } from '../../core/state.ts';
import { toLeet } from './encodings.ts';
import { entrance, folderFor, otherExtensions, userAgentBlockLevel, type Entrance } from './levels.ts';
import { owns } from './progress.ts';
import { firstYear, salts, unitHash, yearCount } from './riddle.ts';
import { fill, searchText } from './text.ts';
import { rankOfWord, vocabularySize, wordAtRank } from './vocabulary.ts';
import { answerNames } from './word-lists.ts';

interface WordlistDefinition {
    readonly id: string;
    readonly fileName: string;
    readonly size: number;
    readonly coverage: number;
}

export type SlowReason = 'userAgent' | 'wildcard' | 'folder' | 'extension' | 'credentials';

export interface SearchPhase {
    readonly label: string;
    readonly size: number;
    readonly candidate: (index: number) => string;
    readonly requestsUntilNext?: number;
}

interface Variants {
    readonly count: number;
    readonly label: (list: string) => string;
    readonly format: (word: string, variant: number) => string;
}

interface Route {
    readonly phases: readonly SearchPhase[];
    readonly hitAt: number;
    readonly bruteForce: boolean;
}

export interface SearchPlan extends Route {
    readonly slowedBy: SlowReason | null;
    readonly speed: number;
    readonly signature: string;
}

export interface SearchCapabilities {
    readonly lists: readonly WordlistDefinition[];
    readonly sortedByFrequency: boolean;
    readonly recursion: boolean;
    readonly extensions: boolean;
    readonly mutations: boolean;
    readonly rockyou: boolean;
    readonly moreLeaks: boolean;
    readonly names: boolean;
    readonly numberRanges: boolean;
    readonly clusterBomb: boolean;
    readonly cracked: boolean;
    readonly combinator: boolean;
    readonly userAgent: boolean;
    readonly sizeFilter: boolean;
}

const starterWordlist: WordlistDefinition = { id: 'words', fileName: 'words.txt', size: 1_000, coverage: 300 };
export const starterWordlistName = starterWordlist.fileName;

const purchasableWordlists: readonly WordlistDefinition[] = [
    { id: 'english10k', fileName: 'english-10k.txt', size: 10_000, coverage: 900 },
    { id: 'dictWords', fileName: '/usr/share/dict/words', size: 102_774, coverage: 1_700 },
    { id: 'scrabble', fileName: 'scrabble.txt', size: 279_496, coverage: vocabularySize },
];

const rockyouList = { fileName: 'rockyou.txt', size: 14_344_391, leetCoverage: 0.6, withMoreLeaks: 0.9 } as const;
const namesList = { fileName: 'names.txt', size: 8_000, coverage: 0.75 } as const;

const triedExtensions: readonly string[] = ['htm', ...otherExtensions];
const mutationsPerWord = 12;
const pairCoverage = 900;
const slowdowns: Readonly<Record<SlowReason, number>> = { userAgent: 10, wildcard: 20, folder: 10, extension: 8, credentials: 20 };
const unguessable: SearchPlan = { phases: [], hitAt: Number.POSITIVE_INFINITY, bruteForce: false, slowedBy: null, speed: 0, signature: '' };
const alphabets = { 'a-z': 'abcdefghijklmnopqrstuvwxyz', 'a-z0-9': 'abcdefghijklmnopqrstuvwxyz0123456789' } as const;

const page = (name: string): string => `${name}.htm`;
const pageVariants: Variants = { count: 1, label: (list) => list, format: page };
const folderVariants: Variants = { count: 1, label: (list) => list, format: (word) => `/${word}/` };
const extensionVariants: Variants = {
    count: triedExtensions.length,
    label: (list) => fill(searchText.extensions, { list, count: triedExtensions.length }),
    format: (word, variant) => `${word}.${triedExtensions[variant]}`,
};
const mutationVariants: Variants = {
    count: mutationsPerWord,
    label: (list) => fill(searchText.mutations, { list, count: mutationsPerWord }),
    format: (word, variant) => page(toLeet(word, variant / mutationsPerWord)),
};

export function currentPhase(plan: Route, requestsSpent: number): { readonly phase: SearchPhase | undefined; readonly spent: number } {
    let spent = requestsSpent;
    let phase = plan.phases[0];
    for (const candidate of plan.phases) {
        phase = candidate;
        const boundary = candidate.requestsUntilNext ?? candidate.size;
        if (spent < boundary) break;
        spent -= boundary;
    }
    return { phase, spent };
}

export function searchCapabilities(state: GameState): SearchCapabilities {
    const owned = (id: string): boolean => owns(state, id);
    return {
        lists: [starterWordlist, ...purchasableWordlists.filter((list) => owned(list.id))],
        sortedByFrequency: owned('sortByFrequency'),
        recursion: owned('dirb') || owned('gobuster') || owned('ffuf'),
        extensions: owned('extensionList'),
        mutations: owned('mutationRules'),
        rockyou: owned('rockyou'),
        moreLeaks: owned('moreLeaks'),
        names: owned('namesList'),
        numberRanges: owned('numberRanges'),
        clusterBomb: owned('clusterBomb'),
        cracked: owned('crackHtpasswd'),
        combinator: owned('combinator'),
        userAgent: owned('fakeUserAgent'),
        sizeFilter: owned('sizeFilter') || owned('ffuf'),
    };
}

export function capabilitySignature(capabilities: SearchCapabilities): string {
    const { lists, ...switches } = capabilities;
    return `${lists.map((list) => list.id).join('+')}|${Object.values(switches).map((value) => (value ? 1 : 0)).join('')}`;
}

export function planSearch(targetLevel: number, capabilities: SearchCapabilities): SearchPlan {
    const target = entrance(targetLevel);
    if (target.kind === 'fixed') return unguessable;
    const entersFolder = target.folder !== null && target.folder !== folderFor(targetLevel - 1);
    const reasons: SlowReason[] = [];
    if (targetLevel > userAgentBlockLevel && !capabilities.userAgent) reasons.push('userAgent');
    if (target.wildcard && !capabilities.sizeFilter) reasons.push('wildcard');
    if (entersFolder && !capabilities.recursion) reasons.push('folder');
    if (target.kind === 'extension' && !capabilities.extensions) reasons.push('extension');
    if (target.kind === 'credentials' && !capabilities.clusterBomb && !capabilities.cracked) reasons.push('credentials');
    const route = entersFolder ? insideFolder(target.folder!, targetLevel, kindRoute(target, capabilities), capabilities) : kindRoute(target, capabilities);
    const signature = `${route.hitAt}|${route.phases.map((phase) => phase.label).join('|')}`;
    return { ...route, slowedBy: reasons[0] ?? null, speed: reasons.reduce((speed, reason) => speed / slowdowns[reason], 1), signature };
}

function insideFolder(folder: string, targetLevel: number, route: Route, capabilities: SearchCapabilities): Route {
    const folderSearch = wordRoute(rankOfWord(folder), folder.length, unitHash(targetLevel, salts.door), capabilities, folderVariants);
    const folderPhases = completedPhases(folderSearch).map((phase) => ({ ...phase, label: fill(searchText.folders, { phase: phase.label }) }));
    return { ...route, phases: [...folderPhases, ...route.phases], hitAt: folderSearch.hitAt + route.hitAt };
}

function kindRoute(target: Entrance, capabilities: SearchCapabilities): Route {
    const [firstWord = target.answer, secondWord = target.answer, thirdWord = target.answer] = target.words;
    switch (target.kind) {
        case 'fixed':
            return unguessable;
        case 'word':
            return wordRoute(rankOfWord(firstWord), firstWord.length, target.positionUnit, capabilities);
        case 'extension':
            return wordRoute(rankOfWord(firstWord), firstWord.length, target.positionUnit, capabilities, extensionVariants);
        case 'leet': {
            const routes: Route[] = [bruteForceRoute('a-z0-9', target.answer.length, target.positionUnit)];
            if (capabilities.mutations) routes.push(wordRoute(rankOfWord(firstWord), firstWord.length, target.positionUnit, capabilities, mutationVariants));
            const leetCoverage = capabilities.moreLeaks ? rockyouList.withMoreLeaks : rockyouList.leetCoverage;
            if (capabilities.rockyou && target.positionUnit < leetCoverage) {
                const phase: SearchPhase = { label: rockyouList.fileName, size: rockyouList.size, candidate: (index) => page(toLeet(listEntry(index, false), (index % 89) / 89)) };
                routes.push(found([phase], position(target.positionUnit / leetCoverage, rockyouList.size)));
            }
            return routes.reduce((best, route) => route.hitAt < best.hitAt ? route : best);
        }
        case 'number': {
            const year = Number(target.answer);
            if (capabilities.numberRanges) {
                return found([{ label: searchText.years, size: yearCount, candidate: (index) => page(String(firstYear + index)) }], year - firstYear + 1);
            }
            return found([{ label: searchText.allNumbers, size: 10_000, candidate: (index) => page(String(index).padStart(4, '0')) }], year + 1);
        }
        case 'credentials': {
            const door = wordRoute(rankOfWord(firstWord), firstWord.length, target.positionUnit, capabilities, folderVariants);
            const login = (username: string, password: string): string => `${firstWord}/ ${username}:${password}`;
            if (capabilities.cracked) {
                const cracked: SearchPhase = { label: searchText.cracked, size: 1, candidate: () => login(secondWord, thirdWord) };
                return { ...door, phases: [...completedPhases(door), cracked], hitAt: door.hitAt + 1 };
            }
            const pairs = pairRoute(secondWord, thirdWord, target.positionUnit, capabilities, () => searchText.credentialPairs, login);
            return found([...completedPhases(door), ...pairs.phases], door.hitAt + pairs.hitAt);
        }
        case 'twoWords':
            if (!capabilities.combinator) {
                return bruteForceRoute('a-z', target.answer.length, target.positionUnit);
            }
            return pairRoute(firstWord, secondWord, target.positionUnit, capabilities, (first, second) => fill(searchText.wordPairs, { first, second }), (first, second) => page(`${first}${second}`));
        case 'name': {
            if (!capabilities.names || target.positionUnit >= namesList.coverage) return bruteForceRoute('a-z', target.answer.length, target.positionUnit);
            const phase: SearchPhase = { label: namesList.fileName, size: namesList.size, candidate: (index) => page(answerNames[index % answerNames.length]!) };
            return found([phase], position(target.positionUnit / namesList.coverage, namesList.size));
        }
        case 'phrase':
            return bruteForceRoute('a-z', target.answer.length, target.positionUnit);
    }
}

function wordRoute(rank: number, length: number, unit: number, capabilities: SearchCapabilities, variants = pageVariants): Route {
    const phases: SearchPhase[] = [];
    let offset = 0;
    let previousCoverage = 0;
    let previousSize = 0;
    for (const list of capabilities.lists) {
        const phaseSize = (list.size - previousSize) * variants.count;
        const firstEntry = previousSize;
        phases.push({
            label: variants.label(list.fileName),
            size: phaseSize,
            candidate: (index) => variants.format(listEntry(firstEntry + Math.floor(index / variants.count), capabilities.sortedByFrequency), index % variants.count),
        });
        if (rank <= list.coverage) {
            const fraction = capabilities.sortedByFrequency
                ? Math.min(1, (rank - previousCoverage - 1 + unit) / (list.coverage - previousCoverage))
                : unit;
            return found(phases, offset + position(fraction, phaseSize));
        }
        offset += phaseSize;
        previousCoverage = list.coverage;
        previousSize = list.size;
    }
    const bruteForce = bruteForceRoute('a-z', length, unit, (candidate) => variants.format(candidate, 0));
    return { ...bruteForce, phases: [...phases, ...bruteForce.phases], hitAt: offset + bruteForce.hitAt };
}

function pairRoute(first: string, second: string, unit: number, capabilities: SearchCapabilities, label: (firstList: string, secondList: string) => string,
    format: (first: string, second: string) => string): Route {
    const pairLists = capabilities.lists.filter((list) => list.coverage <= pairCoverage);
    const listFor = (word: string): WordlistDefinition => pairLists.find((list) => rankOfWord(word) <= list.coverage) ?? pairLists[pairLists.length - 1]!;
    const listPosition = (word: string, list: WordlistDefinition, wordUnit: number): number => {
        const rank = Math.min(list.coverage, rankOfWord(word));
        return position(capabilities.sortedByFrequency ? (rank - 1 + wordUnit) / list.coverage : wordUnit, list.size);
    };
    const firstList = listFor(first);
    const secondList = listFor(second);
    const entry = (index: number): string => listEntry(index, capabilities.sortedByFrequency);
    const phase: SearchPhase = {
        label: label(firstList.fileName, secondList.fileName),
        size: firstList.size * secondList.size,
        candidate: (index) => format(entry(Math.floor(index / secondList.size)), entry(index % secondList.size)),
    };
    return found([phase], (listPosition(first, firstList, unit) - 1) * secondList.size + listPosition(second, secondList, (unit * 7.31) % 1));
}

function bruteForceRoute(alphabet: keyof typeof alphabets, length: number, unit: number, format = page): Route {
    const characters = alphabets[alphabet];
    const size = characters.length ** length;
    return {
        phases: [{ label: fill(searchText.bruteForce, { alphabet, length }), size, candidate: (index) => format(bruteForceCandidate(index, characters, length)) }],
        hitAt: position(0.25 + unit * 0.5, size),
        bruteForce: true,
    };
}

function listEntry(position: number, sortedByFrequency: boolean): string {
    return wordAtRank(1 + (sortedByFrequency ? position : position * 7919) % vocabularySize);
}

function bruteForceCandidate(index: number, characters: string, length: number): string {
    let remaining = Math.max(0, Math.floor(index));
    let candidate = '';
    for (let position = 0; position < length; position++) {
        candidate = characters[remaining % characters.length] + candidate;
        remaining = Math.floor(remaining / characters.length);
    }
    return candidate;
}

function found(phases: readonly SearchPhase[], hitAt: number): Route {
    return { phases, hitAt, bruteForce: false };
}

function position(share: number, size: number): number {
    return Math.max(1, Math.ceil(share * size));
}

function completedPhases(plan: Route): SearchPhase[] {
    let remaining = plan.hitAt;
    return plan.phases.map((phase) => {
        const requestsUntilNext = Math.min(remaining, phase.size);
        remaining -= requestsUntilNext;
        return { ...phase, requestsUntilNext };
    });
}
