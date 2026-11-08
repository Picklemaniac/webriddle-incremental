import type { GameState } from '../../core/state.ts';
import { entrance, folderFor, userAgentBlockLevel, type Entrance } from './levels.ts';
import { salts, unitHash } from './riddle.ts';
import { rankOfWord, vocabularySize } from './vocabulary.ts';

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
    readonly requestsUntilNext?: number;
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

const rockyouList = { fileName: 'rockyou.txt', size: 14_344_391, leetCoverage: 0.6 } as const;

const extensionsTried = 5;
const mutationsPerWord = 12;
const commonPairListSize = starterWordlist.size;
const commonPairCoverage = starterWordlist.coverage;

export function searchCapabilities(state: GameState): SearchCapabilities {
    const owns = (id: string): boolean => (state.purchases[id] ?? 0) > 0;
    return {
        lists: [starterWordlist, ...purchasableWordlists.filter((list) => owns(list.id))],
        sortedByFrequency: owns('sortByFrequency'),
        recursion: owns('dirb') || owns('gobuster') || owns('ffuf'),
        extensions: owns('extensionList'),
        mutations: owns('mutationRules'),
        rockyou: owns('rockyou'),
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
        const folderSearch = wordPlan(rankOfWord(target.folder), target.folder.length, unitHash(targetLevel, salts.door), capabilities, 1);
        folderOffset = folderSearch.hitAt;
        folderPhases.push(...completedPhases(folderSearch).map((phase) => ({ ...phase, label: `folders · ${phase.label}` })));
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
            return wordPlan(rankOfWord(firstWord), firstWord.length, target.positionUnit, capabilities, 1);
        case 'extension':
            if (!capabilities.extensions) {
                return blocked('extension');
            }
            return wordPlan(rankOfWord(firstWord), firstWord.length, target.positionUnit, capabilities, extensionsTried, ' × 5 extensions');
        case 'leet': {
            const routes: SearchPlan[] = [bruteForcePlan(36, target.answer.length, target.positionUnit, 'a-z0-9')];
            if (capabilities.mutations) routes.push(wordPlan(rankOfWord(firstWord), firstWord.length, target.positionUnit, capabilities, mutationsPerWord, ' × 12 mutations'));
            if (capabilities.rockyou && target.positionUnit < rockyouList.leetCoverage) {
                routes.push({
                    phases: [{ label: rockyouList.fileName, size: rockyouList.size }],
                    hitAt: Math.max(1, Math.ceil((target.positionUnit / rockyouList.leetCoverage) * rockyouList.size)),
                    blockedBy: null,
                    bruteForce: false,
                });
            }
            return routes.reduce((best, route) => route.hitAt < best.hitAt ? route : best);
        }
        case 'number': {
            const year = Number(target.answer);
            if (capabilities.numberRanges) {
                return { phases: [{ label: 'years 1000-2099', size: 1_100 }], hitAt: year - 999, blockedBy: null, bruteForce: false };
            }
            return { phases: [{ label: '0000-9999', size: 10_000 }], hitAt: year + 1, blockedBy: null, bruteForce: false };
        }
        case 'credentials': {
            if (!capabilities.clusterBomb && !capabilities.cracked) {
                return blocked('credentials');
            }
            const door = wordPlan(rankOfWord(firstWord), firstWord.length, target.positionUnit, capabilities, 1);
            if (capabilities.cracked) {
                return { ...door, phases: [...completedPhases(door), { label: '.htpasswd (cracked)', size: 1 }], hitAt: door.hitAt + 1 };
            }
            const pairs = pairPlan(secondWord, thirdWord, target.positionUnit, capabilities, 'usernames × passwords');
            return { phases: [...completedPhases(door), ...pairs.phases], hitAt: door.hitAt + pairs.hitAt, blockedBy: null, bruteForce: false };
        }
        case 'twoWords':
            if (!capabilities.combinator) {
                return bruteForcePlan(26, target.answer.length, target.positionUnit, 'a-z');
            }
            return pairPlan(firstWord, secondWord, target.positionUnit, capabilities, `${starterWordlist.fileName} × ${starterWordlist.fileName}`);
        case 'phrase':
            return bruteForcePlan(26, target.answer.length, target.positionUnit, 'a-z');
    }
}

function wordPlan(
    rank: number,
    length: number,
    unit: number,
    capabilities: SearchCapabilities,
    multiplier: number,
    labelSuffix = '',
): SearchPlan {
    const phases: SearchPhase[] = [];
    let offset = 0;
    let previousCoverage = 0;
    let previousSize = 0;
    for (const list of capabilities.lists) {
        const phaseSize = (list.size - previousSize) * multiplier;
        phases.push({ label: `${list.fileName}${labelSuffix}`, size: phaseSize });
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
    const bruteForce = bruteForcePlan(26, length, unit, 'a-z');
    return { ...bruteForce, phases: [...phases, ...bruteForce.phases], hitAt: offset + bruteForce.hitAt };
}

function pairPlan(first: string, second: string, unit: number, capabilities: SearchCapabilities, label: string): SearchPlan {
    const position = (word: string, wordUnit: number): number => {
        const rank = Math.min(commonPairCoverage, rankOfWord(word));
        const fraction = capabilities.sortedByFrequency ? (rank - 1 + wordUnit) / commonPairCoverage : wordUnit;
        return Math.max(1, Math.ceil(fraction * commonPairListSize));
    };
    const firstPosition = position(first, unit);
    const secondPosition = position(second, (unit * 7.31) % 1);
    return {
        phases: [{ label, size: commonPairListSize * commonPairListSize }],
        hitAt: (firstPosition - 1) * commonPairListSize + secondPosition,
        blockedBy: null,
        bruteForce: false,
    };
}

function bruteForcePlan(alphabetSize: number, length: number, unit: number, alphabetLabel: string): SearchPlan {
    const size = alphabetSize ** length;
    return {
        phases: [{ label: `brute force, ${alphabetLabel}, ${length} characters`, size }],
        hitAt: Math.max(1, Math.ceil(size * (0.25 + unit * 0.5))),
        blockedBy: null,
        bruteForce: true,
    };
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
