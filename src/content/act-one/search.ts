import type { GameState } from '../../core/state.ts';
import { toLeet } from './encodings.ts';
import { backupEndings, entrance, folderFor, otherExtensions, type Entrance } from './levels.ts';
import { isNeeded, owns } from './progress.ts';
import { firstYear, riddleDomain, salts, unitHash, yearCount } from './riddle.ts';
import { fill, searchText } from './text.ts';
import { rankOfWord, vocabularySize, wordAtRank } from './vocabulary.ts';
import { answerNames, latinWords } from './word-lists.ts';

interface WordlistDefinition {
    readonly id: string;
    readonly fileName: string;
    readonly size: number;
    readonly coverage: number;
}

export type SlowReason = 'userAgent' | 'wildcard' | 'credentials' | 'wordlist';

interface NamedList {
    readonly fileName: string;
    readonly size: number;
}

// What slows a search down, and the card that lifts it. A hidden cause is only known once the level has been found.
interface Need {
    readonly fix: string;
    readonly reason: SlowReason;
    readonly slowdown: number;
    readonly hidden: boolean;
}

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
    readonly needs: readonly Need[];
    readonly boosters: readonly string[];
}

export interface SearchPlan extends Route {
    readonly folder: string | null;
    readonly slowedBy: SlowReason | null;
    readonly speed: number;
    readonly signature: string;
    readonly missing: readonly string[];
    readonly learns: readonly string[];
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
    readonly clusterBomb: boolean;
    readonly cracked: boolean;
    readonly combinator: boolean;
    readonly userAgent: boolean;
    readonly scriptsBlocked: boolean;
    readonly sizeFilter: boolean;
    readonly usernames: boolean;
    readonly passwords: boolean;
    readonly likelyPairs: boolean;
    readonly capitals: boolean;
    readonly reversed: boolean;
    readonly backups: boolean;
    readonly dates: boolean;
    readonly latin: boolean;
    readonly subdomains: boolean;
    readonly met: readonly LearnedCard[];
}

// Cards for what cannot be told from a search that fails: a new folder, or a kind of answer.
const cardsLearnedFromAnswers = [
    'dirb', 'extensionList', 'mutationRules', 'rockyou', 'moreLeaks', 'namesList', 'capitalRule', 'reverseRule', 'backupExtensions', 'dateFormats', 'latinList', 'subdomainScan',
    'combinator',
] as const;
type LearnedCard = (typeof cardsLearnedFromAnswers)[number];

const starterWordlist: WordlistDefinition = { id: 'words', fileName: 'words.txt', size: 1_000, coverage: 300 };
export const starterWordlistName = starterWordlist.fileName;

const purchasableWordlists: readonly WordlistDefinition[] = [
    { id: 'english10k', fileName: 'english-10k.txt', size: 10_000, coverage: 900 },
    { id: 'dictWords', fileName: '/usr/share/dict/words', size: 102_774, coverage: 1_700 },
    { id: 'scrabble', fileName: 'scrabble.txt', size: 279_496, coverage: vocabularySize },
];

const leakLists = [
    { id: 'rockyou', fileName: 'rockyou.txt', size: 14_344_391, share: 0.67, depth: 0.05 },
    { id: 'moreLeaks', fileName: 'leaks.txt', size: 20_000_000, share: 1, depth: 0.03 },
] as const;
const namesList = { fileName: 'names.txt', size: 8_000 } as const;
const usernamesList: NamedList = { fileName: 'usernames.txt', size: 500 };
const passwordsList: NamedList = { fileName: 'passwords.txt', size: 4_000 };
const latinList: NamedList = { fileName: 'latin.txt', size: 400_000 };
const listedMonthDays = 31;
const listedYearDays = 12 * listedMonthDays;

const triedExtensions: readonly string[] = ['htm', ...otherExtensions];
export const bansBeforeScriptsAreBlocked = 3;
const mutationsPerWord = 6;
const pairCoverage = 900;
const likelyPairsDivisor = 3;
const guessingSpread = 2;
const guessedCharacters = 'abcdefghijklmnopqrstuvwxyz';
const firstMeetingSeconds = 60;
const unguessable: SearchPlan = {
    phases: [], hitAt: Number.POSITIVE_INFINITY, bruteForce: false, needs: [], boosters: [], folder: null, slowedBy: null, speed: 0, signature: '', missing: [], learns: [],
};

const seenWhileSearching = (fix: string, reason: SlowReason, slowdown: number): Need => ({ fix, reason, slowdown, hidden: false });
const missingWordlist = (fix: string): Need => seenWhileSearching(fix, 'wordlist', 20);
// Roughly what DirBuster gets through at a level, for a player who keeps up with the upgrades.
const typicalRequestsPerSecond = (level: number): number => 150 * (level / 100) ** 2.5;

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

const capitalVariants: Variants = {
    count: 2,
    label: (list) => fill(searchText.capitals, { list }),
    format: (word, variant) => page(variant === 0 ? word : word.toUpperCase()),
};
const reversedVariants: Variants = {
    count: 2,
    label: (list) => fill(searchText.reversed, { list }),
    format: (word, variant) => page(variant === 0 ? word : [...word].reverse().join('')),
};
const backupVariants: Variants = {
    count: backupEndings.length + 1,
    label: (list) => fill(searchText.backups, { list, count: backupEndings.length + 1 }),
    format: (word, variant) => (variant === 0 ? page(word) : `${page(word)}.${backupEndings[variant - 1]}`),
};
const subdomainVariants: Variants = { count: 1, label: (list) => fill(searchText.subdomains, { list }), format: (word) => `http://${word}.${riddleDomain}/` };

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
        clusterBomb: owned('clusterBomb'),
        cracked: owned('crackHtpasswd'),
        combinator: owned('combinator'),
        userAgent: owned('fakeUserAgent'),
        scriptsBlocked: (state.statistics.bans ?? 0) >= bansBeforeScriptsAreBlocked,
        sizeFilter: owned('sizeFilter') || owned('ffuf'),
        usernames: owned('usernames'),
        passwords: owned('passwords'),
        likelyPairs: owned('likelyPairs'),
        capitals: owned('capitalRule'),
        reversed: owned('reverseRule'),
        backups: owned('backupExtensions'),
        dates: owned('dateFormats'),
        latin: owned('latinList'),
        subdomains: owned('subdomainScan'),
        met: cardsLearnedFromAnswers.filter((id) => isNeeded(state, id)),
    };
}

export function capabilitySignature(capabilities: SearchCapabilities): string {
    const { lists, met, ...switches } = capabilities;
    return `${lists.map((list) => list.id).join('+')}|${met.join('+')}|${Object.values(switches).map((value) => (value ? 1 : 0)).join('')}`;
}

export function isLightLeet(answer: string): boolean {
    return [...answer].filter((character) => character >= '0' && character <= '9').length === 1;
}

export function planSearch(targetLevel: number, capabilities: SearchCapabilities): SearchPlan {
    const target = entrance(targetLevel);
    if (target.kind === 'fixed') return unguessable;
    const entersFolder = target.kind !== 'subdomain' && target.folder !== null && target.folder !== folderFor(targetLevel - 1);
    const guessesFolder = entersFolder && !capabilities.recursion;
    const walls: Need[] = [];
    if (capabilities.scriptsBlocked && !capabilities.userAgent) walls.push(seenWhileSearching('fakeUserAgent', 'userAgent', 10));
    if (target.wildcard && !guessesFolder && !capabilities.sizeFilter) walls.push(seenWhileSearching('sizeFilter', 'wildcard', 20));
    if (target.kind === 'credentials' && !capabilities.clusterBomb && !capabilities.cracked) walls.push(seenWhileSearching('clusterBomb', 'credentials', 20));
    const located = entersFolder ? insideFolder(target.folder!, targetLevel, kindRoute(target, capabilities), capabilities) : kindRoute(target, capabilities);
    const route = guessesFolder ? unknownKind('dirb', 10, located, target.level, capabilities) : located;
    const needs = [...walls, ...route.needs];
    return {
        ...route,
        needs,
        folder: guessesFolder ? folderFor(targetLevel - 1) : target.folder,
        slowedBy: needs[0]?.reason ?? null,
        speed: needs.reduce((speed, need) => speed / need.slowdown, 1),
        signature: `${route.hitAt}|${route.phases.map((phase) => phase.label).join('|')}`,
        missing: [...new Set(needs.filter((need) => !need.hidden).map((need) => need.fix))],
        learns: needs.filter((need) => need.hidden).map((need) => need.fix),
    };
}

// Without its card a folder or a kind of answer is found by guessing. Until the player has seen one, it is an easy one that takes about a minute.
function unknownKind(card: LearnedCard, slowdown: number, listed: Route, level: number, capabilities: SearchCapabilities): Route {
    const slowdowns = listed.needs.reduce((total, need) => total * need.slowdown, slowdown);
    const easy = Math.max(1, Math.ceil(firstMeetingSeconds * typicalRequestsPerSecond(level) / slowdowns));
    const hitAt = capabilities.met.includes(card) ? listed.hitAt : easy;
    return guessing({ ...listed, hitAt }, { fix: card, reason: 'wordlist', slowdown, hidden: true });
}

function ruleRoute(card: LearnedCard, slowdown: number, owned: boolean, variants: Variants, target: Entrance, word: string, capabilities: SearchCapabilities): Route {
    const listed = wordRoute(rankOfWord(word), target.positionUnit, capabilities, owned ? variants : pageVariants);
    return owned ? listed : unknownKind(card, slowdown, listed, target.level, capabilities);
}

function insideFolder(folder: string, targetLevel: number, route: Route, capabilities: SearchCapabilities): Route {
    const folderSearch = wordRoute(rankOfWord(folder), unitHash(targetLevel, salts.door), capabilities, folderVariants);
    const folderPhases = completedPhases(folderSearch).map((phase) => ({ ...phase, label: fill(searchText.folders, { phase: phase.label }) }));
    return { ...route, phases: [...folderPhases, ...route.phases], hitAt: folderSearch.hitAt + route.hitAt, needs: [...folderSearch.needs, ...route.needs] };
}

function kindRoute(target: Entrance, capabilities: SearchCapabilities): Route {
    const [firstWord = target.answer, secondWord = target.answer, thirdWord = target.answer] = target.words;
    switch (target.kind) {
        case 'fixed':
            return unguessable;
        case 'word':
            return wordRoute(rankOfWord(firstWord), target.positionUnit, capabilities);
        case 'extension':
            return ruleRoute('extensionList', 8, capabilities.extensions, extensionVariants, target, firstWord, capabilities);
        case 'leet':
            return leetRoute(target, firstWord, capabilities);
        case 'number':
            return found([{ label: searchText.allNumbers, size: 10_000, candidate: (index) => page(String(index).padStart(4, '0')) }], Number(target.answer) + 1);
        case 'credentials': {
            const door = wordRoute(rankOfWord(firstWord), target.positionUnit, capabilities, folderVariants);
            const login = (username: string, password: string): string => `${firstWord}/ ${username}:${password}`;
            if (capabilities.cracked) {
                const cracked: SearchPhase = { label: searchText.cracked, size: 1, candidate: () => login(secondWord, thirdWord) };
                return { ...door, phases: [...completedPhases(door), cracked], hitAt: door.hitAt + 1 };
            }
            const pairs = pairRoute(secondWord, thirdWord, target.positionUnit, capabilities, login, {
                first: capabilities.usernames ? usernamesList : { fileName: searchText.usernames },
                second: capabilities.passwords ? passwordsList : { fileName: searchText.passwords },
            });
            const booster = !capabilities.usernames ? ['usernames'] : !capabilities.passwords ? ['passwords'] : [];
            return { ...pairs, phases: [...completedPhases(door), ...pairs.phases], hitAt: door.hitAt + pairs.hitAt, needs: door.needs, boosters: capabilities.clusterBomb ? booster : [] };
        }
        case 'twoWords': {
            const pairs = pairRoute(firstWord, secondWord, target.positionUnit, capabilities, (first, second) => page(`${first}${second}`));
            if (!capabilities.combinator) return unknownKind('combinator', 20, pairs, target.level, capabilities);
            return capabilities.likelyPairs ? shortened(pairs, likelyPairsDivisor, searchText.likelyPairs) : { ...pairs, boosters: ['likelyPairs'] };
        }
        case 'name': {
            const phase: SearchPhase = { label: namesList.fileName, size: namesList.size, candidate: (index) => page(answerNames[index % answerNames.length]!) };
            const listed = found([phase], position(target.positionUnit, namesList.size));
            return capabilities.names ? listed : unknownKind('namesList', 20, listed, target.level, capabilities);
        }
        case 'capitals':
            return ruleRoute('capitalRule', 10, capabilities.capitals, capitalVariants, target, firstWord, capabilities);
        case 'reversed':
            return ruleRoute('reverseRule', 10, capabilities.reversed, reversedVariants, target, firstWord, capabilities);
        case 'backup':
            return ruleRoute('backupExtensions', 8, capabilities.backups, backupVariants, target, firstWord, capabilities);
        case 'subdomain':
            return ruleRoute('subdomainScan', 10, capabilities.subdomains, subdomainVariants, target, firstWord, capabilities);
        case 'date': {
            const [day, month, year] = [target.answer.slice(0, 2), target.answer.slice(2, 4), target.answer.slice(4)].map(Number) as [number, number, number];
            const phase: SearchPhase = { label: searchText.dates, size: yearCount * listedYearDays, candidate: (index) => page(listedDate(index)) };
            const listed = found([phase], (year - firstYear) * listedYearDays + (month - 1) * listedMonthDays + day);
            return capabilities.dates ? listed : unknownKind('dateFormats', 20, listed, target.level, capabilities);
        }
        case 'latin': {
            const phase: SearchPhase = { label: latinList.fileName, size: latinList.size, candidate: (index) => page(latinWords[index % latinWords.length]!) };
            const listed = found([phase], position(target.positionUnit, latinList.size));
            return capabilities.latin ? listed : unknownKind('latinList', 20, listed, target.level, capabilities);
        }
        case 'phrase':
            return bruteForceRoute(target.answer.length, target.positionUnit);
    }
}

function leetRoute(target: Entrance, word: string, capabilities: SearchCapabilities): Route {
    if (isLightLeet(target.answer)) {
        const rank = rankOfWord(word);
        const mutated = listRoute(rank, target.positionUnit, listsCovering(rank, capabilities.lists), capabilities.sortedByFrequency, mutationVariants);
        const list = missingList(rank, capabilities.lists);
        if (list !== undefined) return guessing(mutated, missingWordlist(list.id));
        return capabilities.mutations ? mutated : unknownKind('mutationRules', 20, mutated, target.level, capabilities);
    }
    const leak = leakLists.find((list) => target.positionUnit < list.share)!;
    const phase: SearchPhase = { label: leak.fileName, size: leak.size, candidate: (index) => page(toLeet(listEntry(index, false), (index % 89) / 89)) };
    const share = (rankOfWord(word) / vocabularySize) * leak.depth + target.positionUnit * leak.depth * 0.1;
    const listed = found([phase], position(share, leak.size));
    return capabilities[leak.id] ? listed : unknownKind(leak.id, 20, listed, target.level, capabilities);
}

function missingList(rank: number, owned: readonly WordlistDefinition[]): WordlistDefinition | undefined {
    if (owned.some((list) => rank <= list.coverage)) return undefined;
    return purchasableWordlists.find((list) => rank <= list.coverage) ?? purchasableWordlists[purchasableWordlists.length - 1]!;
}

function listsCovering(rank: number, owned: readonly WordlistDefinition[]): readonly WordlistDefinition[] {
    const missing = missingList(rank, owned);
    return missing === undefined ? owned : [...owned, missing].sort((first, second) => first.size - second.size);
}

function wordRoute(rank: number, unit: number, capabilities: SearchCapabilities, variants = pageVariants): Route {
    const listed = listRoute(rank, unit, listsCovering(rank, capabilities.lists), capabilities.sortedByFrequency, variants);
    const missing = missingList(rank, capabilities.lists);
    return missing === undefined ? listed : guessing(listed, missingWordlist(missing.id), (candidate) => variants.format(candidate, 0));
}

function listRoute(rank: number, unit: number, lists: readonly WordlistDefinition[], sortedByFrequency: boolean, variants: Variants): Route {
    const phases: SearchPhase[] = [];
    let offset = 0;
    let previousCoverage = 0;
    let previousSize = 0;
    for (const list of lists) {
        const phaseSize = (list.size - previousSize) * variants.count;
        const firstEntry = previousSize;
        phases.push({
            label: variants.label(list.fileName),
            size: phaseSize,
            candidate: (index) => variants.format(listEntry(firstEntry + Math.floor(index / variants.count), sortedByFrequency), index % variants.count),
        });
        if (rank <= list.coverage) {
            const share = sortedByFrequency ? Math.min(1, (rank - previousCoverage - 1 + unit) / (list.coverage - previousCoverage)) : unit;
            return found(phases, offset + position(share, phaseSize));
        }
        offset += phaseSize;
        previousCoverage = list.coverage;
        previousSize = list.size;
    }
    return found(phases, offset);
}

function pairRoute(first: string, second: string, unit: number, capabilities: SearchCapabilities, format: (first: string, second: string) => string,
    named: { readonly first?: Partial<NamedList>; readonly second?: Partial<NamedList> } = {}): Route {
    const pairLists = capabilities.lists.filter((list) => list.coverage <= pairCoverage);
    const listFor = (word: string): WordlistDefinition => pairLists.find((list) => rankOfWord(word) <= list.coverage) ?? pairLists[pairLists.length - 1]!;
    const side = (word: string, names: Partial<NamedList> | undefined, wordUnit: number): NamedList & { readonly position: number } => {
        const list = listFor(word);
        const rank = Math.min(list.coverage, rankOfWord(word));
        const share = capabilities.sortedByFrequency ? (rank - 1 + wordUnit) / list.coverage : wordUnit;
        const size = Math.min(list.size, names?.size ?? list.size);
        return { fileName: names?.fileName ?? list.fileName, size, position: position(share, size) };
    };
    const firstSide = side(first, named.first, unit);
    const secondSide = side(second, named.second, (unit * 7.31) % 1);
    const entry = (index: number): string => listEntry(index, capabilities.sortedByFrequency);
    const phase: SearchPhase = {
        label: fill(searchText.wordPairs, { first: firstSide.fileName, second: secondSide.fileName }),
        size: firstSide.size * secondSide.size,
        candidate: (index) => format(entry(Math.floor(index / secondSide.size)), entry(index % secondSide.size)),
    };
    return found([phase], (firstSide.position - 1) * secondSide.size + secondSide.position);
}

function shortened(route: Route, divisor: number, label: string): Route {
    return {
        ...route,
        phases: route.phases.map((phase) => ({ ...phase, label: fill(label, { list: phase.label }), size: Math.max(1, Math.ceil(phase.size / divisor)) })),
        hitAt: Math.max(1, Math.ceil(route.hitAt / divisor)),
    };
}

function guessing(listed: Route, need: Need, format = page): Route {
    return { phases: [guessedNames(listed.hitAt * guessingSpread, format)], hitAt: listed.hitAt, bruteForce: true, needs: [...listed.needs, need], boosters: [] };
}

function bruteForceRoute(length: number, unit: number): Route {
    const size = guessedCharacters.length ** length;
    return { phases: [guessedNames(size, page)], hitAt: position(0.25 + unit * 0.5, size), bruteForce: true, needs: [], boosters: [] };
}

function guessedNames(size: number, format: (name: string) => string): SearchPhase {
    return { label: searchText.bruteForce, size, candidate: (index) => format(guessedName(index)) };
}

function listedDate(index: number): string {
    const year = firstYear + Math.floor(index / listedYearDays);
    const dayOfYear = index % listedYearDays;
    const twoDigits = (value: number): string => String(value).padStart(2, '0');
    return `${twoDigits(dayOfYear % listedMonthDays + 1)}${twoDigits(Math.floor(dayOfYear / listedMonthDays) + 1)}${year}`;
}

function listEntry(position: number, sortedByFrequency: boolean): string {
    return wordAtRank(1 + (sortedByFrequency ? position : position * 7919) % vocabularySize);
}

// Every name in order of length: a to z, then aa to zz, and so on.
function guessedName(index: number): string {
    let remaining = Math.max(0, Math.floor(index)) + 1;
    let name = '';
    while (remaining > 0) {
        remaining--;
        name = guessedCharacters[remaining % guessedCharacters.length] + name;
        remaining = Math.floor(remaining / guessedCharacters.length);
    }
    return name;
}

function found(phases: readonly SearchPhase[], hitAt: number): Route {
    return { phases, hitAt, bruteForce: false, needs: [], boosters: [] };
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
