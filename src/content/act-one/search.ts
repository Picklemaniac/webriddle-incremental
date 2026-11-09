import type { GameState } from '../../core/state.ts';
import { toLeet } from './encodings.ts';
import { entrance, folderFor, otherExtensions, userAgentBlockLevel, type Entrance } from './levels.ts';
import { salts, unitHash } from './riddle.ts';
import { fill, searchText } from './text.ts';
import { rankOfWord, vocabularySize, wordAtRank } from './vocabulary.ts';
import { answerNames } from './word-lists.ts';

interface WordlistDefinition {
    readonly id: string;
    readonly fileName: string;
    readonly size: number;
    readonly coverage: number;
}

export type BlockReason = 'unguessable' | 'userAgent' | 'folder' | 'extension' | 'wildcard' | 'credentials';

interface SearchPhase {
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

export interface SearchPlan {
    readonly phases: readonly SearchPhase[];
    readonly hitAt: number;
    readonly blockedBy: BlockReason | null;
    readonly bruteForce: boolean;
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

export function searchCapabilities(state: GameState): SearchCapabilities {
    const owns = (id: string): boolean => (state.purchases[id] ?? 0) > 0;
    return {
        lists: [starterWordlist, ...purchasableWordlists.filter((list) => owns(list.id))],
        sortedByFrequency: owns('sortByFrequency'),
        recursion: owns('dirb') || owns('gobuster') || owns('ffuf'),
        extensions: owns('extensionList'),
        mutations: owns('mutationRules'),
        rockyou: owns('rockyou'),
        moreLeaks: owns('moreLeaks'),
        names: owns('namesList'),
        numberRanges: owns('numberRanges'),
        clusterBomb: owns('clusterBomb'),
        cracked: owns('crackHtpasswd'),
        combinator: owns('combinator'),
        userAgent: owns('fakeUserAgent'),
        sizeFilter: owns('sizeFilter') || owns('ffuf'),
    };
}

export function capabilitySignature(capabilities: SearchCapabilities): string {
    const { lists, ...switches } = capabilities;
    return `${lists.map((list) => list.id).join('+')}|${Object.values(switches).map((value) => (value ? 1 : 0)).join('')}`;
}

export function planSearch(targetLevel: number, capabilities: SearchCapabilities): SearchPlan {
    const target = entrance(targetLevel);
    if (target.kind !== 'fixed' && targetLevel > userAgentBlockLevel && !capabilities.userAgent) {
        return blocked('userAgent');
    }
    if (target.wildcard && !capabilities.sizeFilter) {
        return blocked('wildcard');
    }
    const folderPhases: SearchPhase[] = [];
    let folderOffset = 0;
    if (target.folder !== null && target.folder !== folderFor(targetLevel - 1)) {
        if (!capabilities.recursion) {
            return blocked('folder');
        }
        const folderSearch = wordPlan(rankOfWord(target.folder), target.folder.length, unitHash(targetLevel, salts.door), capabilities, folderVariants);
        folderOffset = folderSearch.hitAt;
        folderPhases.push(...completedPhases(folderSearch).map((phase) => ({ ...phase, label: fill(searchText.folders, { phase: phase.label }) })));
    }
    const main = kindPlan(target, capabilities);
    if (main.blockedBy !== null) {
        return main;
    }
    return { ...main, phases: [...folderPhases, ...main.phases], hitAt: folderOffset + main.hitAt };
}

function kindPlan(target: Entrance, capabilities: SearchCapabilities): SearchPlan {
    const [firstWord = target.answer, secondWord = target.answer, thirdWord = target.answer] = target.words;
    switch (target.kind) {
        case 'fixed':
            return blocked('unguessable');
        case 'word':
            return wordPlan(rankOfWord(firstWord), firstWord.length, target.positionUnit, capabilities);
        case 'extension':
            if (!capabilities.extensions) {
                return blocked('extension');
            }
            return wordPlan(rankOfWord(firstWord), firstWord.length, target.positionUnit, capabilities, extensionVariants);
        case 'leet': {
            const routes: SearchPlan[] = [bruteForcePlan('a-z0-9', target.answer.length, target.positionUnit)];
            if (capabilities.mutations) routes.push(wordPlan(rankOfWord(firstWord), firstWord.length, target.positionUnit, capabilities, mutationVariants));
            const leetCoverage = capabilities.moreLeaks ? rockyouList.withMoreLeaks : rockyouList.leetCoverage;
            if (capabilities.rockyou && target.positionUnit < leetCoverage) {
                routes.push({
                    phases: [{ label: rockyouList.fileName, size: rockyouList.size, candidate: (index) => page(toLeet(listEntry(index, false), (index % 89) / 89)) }],
                    hitAt: Math.max(1, Math.ceil((target.positionUnit / leetCoverage) * rockyouList.size)),
                    blockedBy: null,
                    bruteForce: false,
                });
            }
            return routes.reduce((best, route) => route.hitAt < best.hitAt ? route : best);
        }
        case 'number': {
            const year = Number(target.answer);
            if (capabilities.numberRanges) {
                return { phases: [{ label: searchText.years, size: 1_100, candidate: (index) => page(String(1000 + index)) }], hitAt: year - 999, blockedBy: null, bruteForce: false };
            }
            return { phases: [{ label: searchText.allNumbers, size: 10_000, candidate: (index) => page(String(index).padStart(4, '0')) }], hitAt: year + 1, blockedBy: null, bruteForce: false };
        }
        case 'credentials': {
            if (!capabilities.clusterBomb && !capabilities.cracked) {
                return blocked('credentials');
            }
            const door = wordPlan(rankOfWord(firstWord), firstWord.length, target.positionUnit, capabilities, folderVariants);
            const login = (username: string, password: string): string => `${firstWord}/ ${username}:${password}`;
            if (capabilities.cracked) {
                const cracked: SearchPhase = { label: searchText.cracked, size: 1, candidate: () => login(secondWord, thirdWord) };
                return { ...door, phases: [...completedPhases(door), cracked], hitAt: door.hitAt + 1 };
            }
            const pairs = pairPlan(secondWord, thirdWord, target.positionUnit, capabilities, () => searchText.credentialPairs, login);
            return { phases: [...completedPhases(door), ...pairs.phases], hitAt: door.hitAt + pairs.hitAt, blockedBy: null, bruteForce: false };
        }
        case 'twoWords':
            if (!capabilities.combinator) {
                return bruteForcePlan('a-z', target.answer.length, target.positionUnit);
            }
            return pairPlan(firstWord, secondWord, target.positionUnit, capabilities, (first, second) => fill(searchText.wordPairs, { first, second }), (first, second) => page(`${first}${second}`));
        case 'name': {
            if (!capabilities.names || target.positionUnit >= namesList.coverage) return bruteForcePlan('a-z', target.answer.length, target.positionUnit);
            return {
                phases: [{ label: namesList.fileName, size: namesList.size, candidate: (index) => page(answerNames[index % answerNames.length]!) }],
                hitAt: Math.max(1, Math.ceil((target.positionUnit / namesList.coverage) * namesList.size)),
                blockedBy: null,
                bruteForce: false,
            };
        }
        case 'phrase':
            return bruteForcePlan('a-z', target.answer.length, target.positionUnit);
    }
}

function wordPlan(rank: number, length: number, unit: number, capabilities: SearchCapabilities, variants = pageVariants): SearchPlan {
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
            return { phases, hitAt: offset + Math.max(1, Math.ceil(fraction * phaseSize)), blockedBy: null, bruteForce: false };
        }
        offset += phaseSize;
        previousCoverage = list.coverage;
        previousSize = list.size;
    }
    const bruteForce = bruteForcePlan('a-z', length, unit, (candidate) => variants.format(candidate, 0));
    return { ...bruteForce, phases: [...phases, ...bruteForce.phases], hitAt: offset + bruteForce.hitAt };
}

function pairPlan(first: string, second: string, unit: number, capabilities: SearchCapabilities, label: (firstList: string, secondList: string) => string,
    format: (first: string, second: string) => string): SearchPlan {
    const pairLists = capabilities.lists.filter((list) => list.coverage <= pairCoverage);
    const listFor = (word: string): WordlistDefinition => pairLists.find((list) => rankOfWord(word) <= list.coverage) ?? pairLists[pairLists.length - 1]!;
    const position = (word: string, list: WordlistDefinition, wordUnit: number): number => {
        const rank = Math.min(list.coverage, rankOfWord(word));
        const fraction = capabilities.sortedByFrequency ? (rank - 1 + wordUnit) / list.coverage : wordUnit;
        return Math.max(1, Math.ceil(fraction * list.size));
    };
    const firstList = listFor(first);
    const secondList = listFor(second);
    const entry = (index: number): string => listEntry(index, capabilities.sortedByFrequency);
    return {
        phases: [{
            label: label(firstList.fileName, secondList.fileName),
            size: firstList.size * secondList.size,
            candidate: (index) => format(entry(Math.floor(index / secondList.size)), entry(index % secondList.size)),
        }],
        hitAt: (position(first, firstList, unit) - 1) * secondList.size + position(second, secondList, (unit * 7.31) % 1),
        blockedBy: null,
        bruteForce: false,
    };
}

function bruteForcePlan(alphabet: keyof typeof alphabets, length: number, unit: number, format = page): SearchPlan {
    const characters = alphabets[alphabet];
    const size = characters.length ** length;
    return {
        phases: [{ label: fill(searchText.bruteForce, { alphabet, length }), size, candidate: (index) => format(bruteForceCandidate(index, characters, length)) }],
        hitAt: Math.max(1, Math.ceil(size * (0.25 + unit * 0.5))),
        blockedBy: null,
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

function blocked(reason: BlockReason): SearchPlan {
    return { phases: [], hitAt: Number.POSITIVE_INFINITY, blockedBy: reason, bruteForce: false };
}

function completedPhases(plan: SearchPlan): SearchPhase[] {
    let remaining = plan.hitAt;
    return plan.phases.map((phase) => {
        const requestsUntilNext = Math.min(remaining, phase.size);
        remaining -= requestsUntilNext;
        return { ...phase, requestsUntilNext };
    });
}
