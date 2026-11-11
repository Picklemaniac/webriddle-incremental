import type { GameState } from '../../core/state.ts';
import { toLeet } from './encodings.ts';
import { backupEndings, entrance, folderBefore, isWildcardFolder, otherExtensions, ruleWordRanks, type Entrance } from './levels.ts';
import { isNeeded, owns } from './progress.ts';
import { firstYear, riddleDomain, salts, unitHash, yearCount } from './riddle.ts';
import { fill, searchText } from './text.ts';
import { rankOfWord, vocabularySize, wordAtRank } from './vocabulary.ts';
import { answerNames, latinWords } from './word-lists.ts';

interface Wordlist {
    readonly id: 'words' | 'english10k' | 'dictWords' | 'scrabble';
    readonly fileName: string;
    readonly size: number;
    // The rank of the rarest word of the vocabulary that the list has.
    readonly coverage: number;
}

export type SlowReason = 'userAgent' | 'wildcard' | 'credentials';

// A wall slows every request down while it stands. The card that lifts it is offered at once.
interface Wall {
    readonly fix: string;
    readonly reason: SlowReason;
    readonly slowdown: number;
}

// One pass through a list. DirBuster makes the same passes in the same order on every level, because it cannot know what the next address looks like.
export interface SearchPhase {
    readonly id: string;
    readonly label: string;
    readonly size: number;
    readonly candidate: (index: number) => string;
    // A card that shortens this pass. It is offered when a level takes long while DirBuster is in the pass.
    readonly booster?: string;
    // Set on the names DirBuster guesses once every pass has been made.
    readonly guessing?: true;
}

interface Route {
    readonly phases: readonly SearchPhase[];
    readonly hitAt: number;
}

export interface SearchPlan extends Route {
    // The address DirBuster is searching under.
    readonly base: string;
    // What the hit is: the level, or a folder or a login page on the way to it.
    readonly finds: 'level' | 'folder' | 'login';
    readonly slowedBy: SlowReason | null;
    readonly speed: number;
    readonly signature: string;
    readonly missing: readonly string[];
    readonly learns: readonly string[];
}

export interface SearchCapabilities {
    readonly cards: readonly LearnedCard[];
    readonly met: readonly LearnedCard[];
    readonly sortedByFrequency: boolean;
    readonly likelyPairs: boolean;
    readonly usernames: boolean;
    readonly passwords: boolean;
    readonly clusterBomb: boolean;
    readonly cracked: boolean;
    readonly userAgent: boolean;
    readonly scriptsBlocked: boolean;
    readonly sizeFilter: boolean;
}

// Cards that add passes. A search that fails cannot tell which one is missing: a longer wordlist, a new folder or a kind of answer. So each is offered once an answer that needed it has been found.
const cardsLearnedFromAnswers = [
    'english10k', 'dictWords', 'scrabble', 'dirb', 'extensionList', 'mutationRules', 'rockyou', 'moreLeaks', 'namesList', 'numberRanges', 'capitalRule', 'reverseRule',
    'backupExtensions', 'dateFormats', 'latinList', 'subdomainScan', 'combinator',
] as const;
type LearnedCard = (typeof cardsLearnedFromAnswers)[number];

// Where the search comes to an address: the pass that tries it, the cards that pass takes, and how far into the pass it is.
interface Home {
    readonly pass: string;
    readonly cards: readonly LearnedCard[];
    readonly position: number;
}

// A way to make an address out of a word. Plain pages need no card.
interface Form {
    readonly id: string;
    readonly card?: LearnedCard;
    readonly count: number;
    readonly label: (list: string) => string;
    readonly format: (word: string, variant: number) => string;
}

// A list for one kind of answer. Its pass is named after its card.
interface KindList extends SearchPhase {
    readonly id: LearnedCard;
}

interface NamedList {
    readonly fileName: string;
    readonly size: number;
}

// Each wordlist adds the words that the shorter ones do not have.
const wordlists: readonly Wordlist[] = [
    { id: 'words', fileName: 'words.txt', size: 1_000, coverage: 300 },
    { id: 'english10k', fileName: 'english-10k.txt', size: 10_000, coverage: ruleWordRanks },
    { id: 'dictWords', fileName: '/usr/share/dict/words', size: 102_774, coverage: 1_700 },
    { id: 'scrabble', fileName: 'scrabble.txt', size: 279_496, coverage: vocabularySize },
];
const starterWordlist = wordlists[0]!;
export const starterWordlistName = starterWordlist.fileName;

const listedMonthDays = 31;
const listedYearDays = 12 * listedMonthDays;
const mutationsPerWord = 6;
const rockyouShare = 0.67;
const likelyPairsDivisor = 3;
const usernameRanks = 300;
const usernamesList: NamedList = { fileName: 'usernames.txt', size: 500 };
const passwordsList: NamedList = { fileName: 'passwords.txt', size: 4_000 };
const commonUsernames: NamedList = { fileName: searchText.usernames, size: 1_000 };
const commonPasswords: NamedList = { fileName: searchText.passwords, size: 10_000 };
export const bansBeforeScriptsAreBlocked = 3;
const guessedCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';
const shortestGuess = 3;
const longestGuess = 8;
const guessingTimes = 20;
const firstGuessSeconds = 20;
const unguessable: SearchPlan = { phases: [], hitAt: Number.POSITIVE_INFINITY, base: '/', finds: 'level', slowedBy: null, speed: 0, signature: '', missing: [], learns: [] };

// Roughly what DirBuster gets through at a level, for a player who keeps up with the upgrades.
const typicalRequestsPerSecond = (level: number): number => 150 * (level / 100) ** 2.5;

const page = (name: string): string => `${name}.htm`;
const leaked = (index: number): string => page(toLeet(listEntry(index, false), (index % 89) / 89));

const pages: Form = { id: 'pages', count: 1, label: (list) => list, format: page };
// A folder can be a new one for the next levels, next to the folder DirBuster is in, or one inside it that asks for a login.
const folderPlaces = { beside: 0, inside: 1 } as const;
const folders: Form = {
    id: 'folders', card: 'dirb', count: 2,
    label: (list) => fill(searchText.folders, { phase: list }),
    format: (word, variant) => (variant === folderPlaces.beside ? `/${word}/` : `${word}/`),
};
const capitals: Form = { id: 'capitals', card: 'capitalRule', count: 1, label: (list) => fill(searchText.capitals, { list }), format: (word) => page(word.toUpperCase()) };
const reversed: Form = { id: 'reversed', card: 'reverseRule', count: 1, label: (list) => fill(searchText.reversed, { list }), format: (word) => page([...word].reverse().join('')) };
const subdomains: Form = { id: 'subdomains', card: 'subdomainScan', count: 1, label: (list) => fill(searchText.subdomains, { list }), format: (word) => `http://${word}.${riddleDomain}/` };
const backups: Form = {
    id: 'backups', card: 'backupExtensions', count: backupEndings.length,
    label: (list) => fill(searchText.backups, { list, count: backupEndings.length }),
    format: (word, variant) => `${page(word)}.${backupEndings[variant]}`,
};
const extensions: Form = {
    id: 'extensions', card: 'extensionList', count: otherExtensions.length,
    label: (list) => fill(searchText.extensions, { list, count: otherExtensions.length }),
    format: (word, variant) => `${word}.${otherExtensions[variant]}`,
};
const mutations: Form = {
    id: 'mutations', card: 'mutationRules', count: mutationsPerWord,
    label: (list) => fill(searchText.mutations, { list, count: mutationsPerWord }),
    format: (word, variant) => page(toLeet(word, variant / mutationsPerWord)),
};
// A rule only tries what the plain pass has not tried, and only on the wordlists that hold the commonest words.
const rules: readonly Form[] = [folders, capitals, reversed, subdomains, backups, extensions, mutations];

const namesList: KindList = { id: 'namesList', label: 'names.txt', size: 8_000, candidate: (index) => page(answerNames[index % answerNames.length]!) };
const numberRanges: KindList = { id: 'numberRanges', label: searchText.allNumbers, size: 10_000, candidate: (index) => page(String(index).padStart(4, '0')) };
const rockyou: KindList = { id: 'rockyou', label: 'rockyou-75.txt', size: 59_187, candidate: leaked };
const moreLeaks: KindList = { id: 'moreLeaks', label: 'leaks.txt', size: 250_000, candidate: leaked };
const latinList: KindList = { id: 'latinList', label: 'latin.txt', size: 400_000, candidate: (index) => page(latinWords[index % latinWords.length]!) };
const dateFormats: KindList = { id: 'dateFormats', label: searchText.dates, size: yearCount * listedYearDays, candidate: (index) => page(listedDate(index)) };
const kindLists: readonly KindList[] = [namesList, numberRanges, rockyou, moreLeaks, latinList, dateFormats];

export function currentPhase(plan: Route, requestsSpent: number): { readonly phase: SearchPhase | undefined; readonly spent: number } {
    let spent = requestsSpent;
    let phase = plan.phases[0];
    for (const candidate of plan.phases) {
        phase = candidate;
        if (spent < candidate.size) break;
        spent -= candidate.size;
    }
    return { phase, spent };
}

// When a purchase changes the search in the middle of a level, the passes DirBuster has finished are not made again. The pass it is in carries on, or starts over when its order has changed.
export function requestsKept(previousSignature: string, plan: SearchPlan, requestsSpent: number): number {
    const [previousOrdering, ...previousIds] = previousSignature.split('|');
    let kept = 0;
    for (const [index, phase] of plan.phases.entries()) {
        if (phase.id !== previousIds[index]) break;
        if (kept + phase.size > requestsSpent) return plan.signature.split('|')[0] === previousOrdering ? requestsSpent : kept;
        kept += phase.size;
    }
    return kept;
}

export function searchCapabilities(state: GameState): SearchCapabilities {
    const owned = (id: string): boolean => owns(state, id);
    const searchesFolders = owned('dirb') || owned('gobuster') || owned('ffuf');
    return {
        cards: cardsLearnedFromAnswers.filter((card) => (card === 'dirb' ? searchesFolders : owned(card))),
        met: cardsLearnedFromAnswers.filter((card) => isNeeded(state, card)),
        sortedByFrequency: owned('sortByFrequency'),
        likelyPairs: owned('likelyPairs'),
        usernames: owned('usernames'),
        passwords: owned('passwords'),
        clusterBomb: owned('clusterBomb'),
        cracked: owned('crackHtpasswd'),
        userAgent: owned('fakeUserAgent'),
        scriptsBlocked: (state.statistics.bans ?? 0) >= bansBeforeScriptsAreBlocked,
        sizeFilter: owned('sizeFilter') || owned('ffuf'),
    };
}

export function capabilitySignature(capabilities: SearchCapabilities): string {
    const { cards, met, ...switches } = capabilities;
    return `${cards.join('+')}|${met.join('+')}|${Object.values(switches).map((value) => (value ? 1 : 0)).join('')}`;
}

export function isLightLeet(answer: string): boolean {
    return [...answer].filter((character) => character >= '0' && character <= '9').length === 1;
}

// The way to a level is one or more finds in a row: the folder when the levels move to a new one, then the page, then the login when the page asks for one.
// The stage is how many of those finds DirBuster has made. After a purchase in the middle of a stage, the passes of the search so far keep their order.
export function planSearch(targetLevel: number, capabilities: SearchCapabilities, stage = 0, resumedSignature = ''): SearchPlan {
    const target = entrance(targetLevel);
    if (target.kind === 'fixed') return unguessable;
    const from = folderBefore(targetLevel);
    const folder = target.kind === 'subdomain' ? from : target.folder;
    const pageHome = homeOf(target, capabilities);
    const folderHome = folder === from ? [] : [wordHome(folder ?? '', unitHash(targetLevel, salts.door), folders, capabilities, folderPlaces.beside)];
    const inFolder = stage >= folderHome.length;
    const atLogin = target.kind === 'credentials' && stage > folderHome.length;
    const here = inFolder ? folder : from;
    const base = `${here === null ? '/' : `/${here}/`}${atLogin ? `${target.answer}/` : ''}`;
    const walls: Wall[] = [];
    if (capabilities.scriptsBlocked && !capabilities.userAgent) walls.push({ fix: 'fakeUserAgent', reason: 'userAgent', slowdown: 10 });
    if (!atLogin && isWildcardFolder(here) && !capabilities.sizeFilter) walls.push({ fix: 'sizeFilter', reason: 'wildcard', slowdown: 20 });
    if (atLogin && !capabilities.clusterBomb && !capabilities.cracked) walls.push({ fix: 'clusterBomb', reason: 'credentials', slowdown: 20 });
    const home = inFolder ? pageHome : folderHome[0]!;
    const route = atLogin ? loginRoute(target, base, capabilities) : listedRoute(home, searchOrder(capabilities, resumedSignature), guessesNeeded(home, target, capabilities));
    const ordering = atLogin ? 'login' : `${Number(capabilities.sortedByFrequency)}${Number(capabilities.likelyPairs)}`;
    return {
        ...route,
        base,
        finds: !inFolder ? 'folder' : target.kind === 'credentials' && !atLogin ? 'login' : 'level',
        slowedBy: walls[0]?.reason ?? null,
        speed: walls.reduce((speed, wall) => speed / wall.slowdown, 1),
        signature: [ordering, ...route.phases.filter((phase) => phase.guessing === undefined).map((phase) => phase.id)].join('|'),
        missing: walls.map((wall) => wall.fix),
        learns: [...folderHome, pageHome].flatMap((sought) => missingCards(sought, capabilities)),
    };
}

// Every pass DirBuster makes on a level, shortest first. It depends on what the player owns and never on the answer.
function searchOrder(capabilities: SearchCapabilities, resumedSignature: string): readonly SearchPhase[] {
    const owned = (card: LearnedCard | undefined): boolean => card !== undefined && capabilities.cards.includes(card);
    const passes: SearchPhase[] = [];
    for (const list of wordlists.filter((candidate) => candidate.id === 'words' || owned(candidate.id))) {
        const forms = list.coverage <= ruleWordRanks ? rules.filter((form) => owned(form.card)) : [];
        for (const form of [pages, ...forms]) passes.push(wordlistPass(list, form, capabilities.sortedByFrequency));
        if (owned('combinator') && list.coverage <= ruleWordRanks) passes.push(pairPass(list, capabilities));
    }
    passes.push(...kindLists.filter((list) => owned(list.id)));
    passes.sort((first, second) => first.size - second.size);
    const resumedIds = resumedSignature.split('|').slice(1);
    return [...resumedIds.flatMap((id) => passes.find((pass) => pass.id === id) ?? []), ...passes.filter((pass) => !resumedIds.includes(pass.id))];
}

function listedRoute(home: Home | null, order: readonly SearchPhase[], guesses: number): Route {
    let offset = 0;
    for (const pass of order) {
        if (pass.id === home?.pass) return { phases: order, hitAt: offset + home.position };
        offset += pass.size;
    }
    const guessed: SearchPhase = { id: 'guesses', label: searchText.bruteForce, size: Number.POSITIVE_INFINITY, candidate: (index) => page(guessedName(index)), guessing: true };
    return { phases: [...order, guessed], hitAt: offset + guesses };
}

function missingCards(home: Home | null, capabilities: SearchCapabilities): readonly LearnedCard[] {
    return (home?.cards ?? []).filter((card) => !capabilities.cards.includes(card));
}

// How many names DirBuster has to guess when none of its passes has the address. An answer that takes a card the player has not met yet is an easy one.
function guessesNeeded(home: Home | null, target: Entrance, capabilities: SearchCapabilities): number {
    if (home === null) return position(0.25 + target.positionUnit * 0.5, guessedCharacters.length ** target.answer.length);
    const fewest = Math.ceil(firstGuessSeconds * typicalRequestsPerSecond(target.level));
    const firstMeeting = missingCards(home, capabilities).some((card) => !capabilities.met.includes(card));
    return firstMeeting ? fewest : Math.max(fewest, guessingTimes * home.position);
}

function homeOf(target: Entrance, capabilities: SearchCapabilities): Home | null {
    const [word = target.answer, second = word] = target.words;
    const unit = target.positionUnit;
    const inList = (list: KindList, place: number): Home => ({ pass: list.id, cards: [list.id], position: place });
    switch (target.kind) {
        case 'fixed':
        case 'phrase':
            return null;
        case 'word':
            return wordHome(word, unit, pages, capabilities);
        case 'credentials':
            return wordHome(word, unit, folders, capabilities, folderPlaces.inside);
        case 'extension':
            return wordHome(word, unit, extensions, capabilities);
        case 'backup':
            return wordHome(word, unit, backups, capabilities);
        case 'capitals':
            return wordHome(word, unit, capitals, capabilities);
        case 'reversed':
            return wordHome(word, unit, reversed, capabilities);
        case 'subdomain':
            return wordHome(word, unit, subdomains, capabilities);
        case 'leet': {
            if (isLightLeet(target.answer)) return wordHome(word, unit, mutations, capabilities);
            const leak = unit < rockyouShare ? rockyou : moreLeaks;
            return inList(leak, position((rankOfWord(word) - 1 + unit) / vocabularySize, leak.size));
        }
        case 'name':
            return inList(namesList, position(unit, namesList.size));
        case 'latin':
            return inList(latinList, position(unit, latinList.size));
        case 'number':
            return inList(numberRanges, Number(target.answer) + 1);
        case 'date': {
            const [day, month, year] = [target.answer.slice(0, 2), target.answer.slice(2, 4), target.answer.slice(4)].map(Number) as [number, number, number];
            return inList(dateFormats, (year - firstYear) * listedYearDays + (month - 1) * listedMonthDays + day);
        }
        case 'twoWords': {
            const list = listWith(second);
            const pair = (placeIn(starterWordlist, word, unit, capabilities) - 1) * entriesAdded(list) + placeIn(list, second, (unit * 7.31) % 1, capabilities);
            return { pass: pairId(list), cards: ['combinator', ...cardsFor(list)], position: capabilities.likelyPairs ? Math.ceil(pair / likelyPairsDivisor) : pair };
        }
    }
}

function wordHome(word: string, unit: number, form: Form, capabilities: SearchCapabilities, variant = Math.floor(unit * form.count)): Home {
    const list = listWith(word);
    const cards = [...cardsFor(list), ...(form.card === undefined ? [] : [form.card])];
    return { pass: passId(list, form), cards, position: (placeIn(list, word, unit, capabilities) - 1) * form.count + variant + 1 };
}

function cardsFor(list: Wordlist): readonly LearnedCard[] {
    return list.id === 'words' ? [] : [list.id];
}

function listWith(word: string): Wordlist {
    const rank = rankOfWord(word);
    return wordlists.find((list) => rank <= list.coverage) ?? wordlists[wordlists.length - 1]!;
}

function listBefore(list: Wordlist): Wordlist | undefined {
    return wordlists[wordlists.indexOf(list) - 1];
}

function entriesAdded(list: Wordlist): number {
    return list.size - (listBefore(list)?.size ?? 0);
}

// Where a word comes among the entries its wordlist adds, counting from one.
function placeIn(list: Wordlist, word: string, unit: number, capabilities: SearchCapabilities): number {
    const firstRank = listBefore(list)?.coverage ?? 0;
    const share = capabilities.sortedByFrequency ? Math.min(1, (rankOfWord(word) - firstRank - 1 + unit) / (list.coverage - firstRank)) : unit;
    return position(share, entriesAdded(list));
}

function passId(list: Wordlist, form: Form): string {
    return form === pages ? list.id : `${list.id}+${form.id}`;
}

function pairId(second: Wordlist): string {
    return `pairs+${second.id}`;
}

function wordlistPass(list: Wordlist, form: Form, sortedByFrequency: boolean): SearchPhase {
    const firstEntry = listBefore(list)?.size ?? 0;
    return {
        id: passId(list, form),
        label: form.label(list.fileName),
        size: entriesAdded(list) * form.count,
        candidate: (index) => form.format(listEntry(firstEntry + Math.floor(index / form.count), sortedByFrequency), index % form.count),
    };
}

// Every word of words.txt followed by every word that a list adds.
function pairPass(second: Wordlist, capabilities: SearchCapabilities): SearchPhase {
    const firstEntry = listBefore(second)?.size ?? 0;
    const seconds = entriesAdded(second);
    const entry = (index: number): string => listEntry(index, capabilities.sortedByFrequency);
    const label = fill(searchText.wordPairs, { first: starterWordlist.fileName, second: second.fileName });
    return {
        id: pairId(second),
        label: capabilities.likelyPairs ? fill(searchText.likelyPairs, { list: label }) : label,
        size: starterWordlist.size * seconds,
        candidate: (index) => page(`${entry(Math.floor(index / seconds))}${entry(firstEntry + index % seconds)}`),
        ...(capabilities.likelyPairs ? {} : { booster: 'likelyPairs' }),
    };
}

function loginRoute(target: Entrance, base: string, capabilities: SearchCapabilities): Route {
    const [, username = '', password = ''] = target.words;
    const login = (user: string, secret: string): string => `${base} ${user}:${secret}`;
    if (capabilities.cracked) return { phases: [{ id: 'cracked', label: searchText.cracked, size: 1, candidate: () => login(username, password) }], hitAt: 1 };
    const users = capabilities.usernames ? usernamesList : commonUsernames;
    const secrets = capabilities.passwords ? passwordsList : commonPasswords;
    const place = (word: string, ranks: number, unit: number, list: NamedList): number =>
        position(capabilities.sortedByFrequency ? Math.min(1, (rankOfWord(word) - 1 + unit) / ranks) : unit, list.size);
    const entry = (index: number): string => listEntry(index, capabilities.sortedByFrequency);
    const booster = !capabilities.clusterBomb ? undefined : !capabilities.usernames ? 'usernames' : !capabilities.passwords ? 'passwords' : undefined;
    const phase: SearchPhase = {
        id: `${users.fileName}+${secrets.fileName}`,
        label: fill(searchText.wordPairs, { first: users.fileName, second: secrets.fileName }),
        size: users.size * secrets.size,
        candidate: (index) => login(entry(Math.floor(index / secrets.size)), entry(index % secrets.size)),
        ...(booster === undefined ? {} : { booster }),
    };
    const unit = target.positionUnit;
    return { phases: [phase], hitAt: (place(username, usernameRanks, unit, users) - 1) * secrets.size + place(password, ruleWordRanks, (unit * 7.31) % 1, secrets) };
}

function listedDate(index: number): string {
    const year = firstYear + Math.floor(index / listedYearDays);
    const dayOfYear = index % listedYearDays;
    const twoDigits = (value: number): string => String(value).padStart(2, '0');
    return `${twoDigits(dayOfYear % listedMonthDays + 1)}${twoDigits(Math.floor(dayOfYear / listedMonthDays) + 1)}${year}`;
}

function listEntry(place: number, sortedByFrequency: boolean): string {
    return wordAtRank(1 + (sortedByFrequency ? place : place * 7919) % vocabularySize);
}

// Guessing follows no list: a name of any length, in no order.
function guessedName(index: number): string {
    const length = shortestGuess + Math.floor(unitHash(index, 0) * (longestGuess - shortestGuess + 1));
    return Array.from({ length }, (_, at) => guessedCharacters[Math.floor(unitHash(index, at + 1) * guessedCharacters.length)]).join('');
}

function position(share: number, size: number): number {
    return Math.max(1, Math.ceil(share * size));
}
