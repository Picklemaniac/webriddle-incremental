import type { PurchasableDefinition, ResourceAmounts } from '../../core/content.ts';
import type { GameState } from '../../core/state.ts';
import type { Modifier } from '../../core/stats.ts';
import { owns } from './progress.ts';
import { planSearch, searchCapabilities, type BlockReason } from './search.ts';
import { upgradeText, type UpgradeId } from './text.ts';

export interface Upgrade extends PurchasableDefinition {
    readonly effect?: string;
    readonly price: ResourceAmounts;
    readonly level: number;
    readonly requires: readonly string[];
    readonly fixes?: BlockReason;
}

const multiply = (statId: string, value: number): Modifier => ({ statId, operation: 'multiply', value });
const add = (statId: string, value: number): Modifier => ({ statId, operation: 'add', value });
const kilobytes = 1024;
const megabytes = 1024 ** 2;

function upgrade(id: UpgradeId, price: ResourceAmounts, level: number,
    requires: readonly UpgradeId[] = [], modifiers: readonly Modifier[] = [], fixes?: BlockReason): Upgrade {
    return {
        id, ...upgradeText[id], price, level, requires, fixes, maximumCount: 1,
        cost: () => price,
        modifiers: () => modifiers,
        isAvailable: (state) => state.flags.automated === true && state.currentLevel >= level && requires.every((required) => owns(state, required)),
    };
}

export const speedUpgrades: ReadonlySet<string> = new Set(['curlBatch', 'keepAlive', 'isdn', 'threads8', 'adsl', 'cable', 'threads32', 'fiber']);
export const capacityUpgrades: ReadonlySet<string> = new Set(['freeProxies', 'proxyPool', 'rentedAddresses', 'addressBlock', 'throttle']);

export const upgrades: readonly Upgrade[] = [
    upgrade('curlBatch', { insight: 5 }, 5, [], [multiply('threadsPerScript', 4)]),
    upgrade('sortByFrequency', { insight: 100 }, 50),
    upgrade('keepAlive', { insight: 30 }, 15, [], [multiply('requestsPerThread', 2)]),
    upgrade('fakeUserAgent', { insight: 40 }, 35, [], [], 'userAgent'),
    upgrade('throttle', { insight: 80 }, 70, ['freeProxies']),
    upgrade('ram', { money: 60 }, 5, [], [add('scriptSlots', 1)]),
    upgrade('wgetMirror', { insight: 20 }, 10),
    upgrade('autoReplyMacros', { insight: 20 }, 10),
    upgrade('otherRiddles', { insight: 20 }, 8),
    upgrade('isdn', { money: 200 }, 25, [], [multiply('requestsPerThread', 2)]),
    upgrade('english10k', { data: 75 * kilobytes }, 10),
    upgrade('newPc', { money: 400 }, 30, ['ram'], [add('scriptSlots', 2)]),
    upgrade('certification', { money: 250 }, 20, [], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    upgrade('rssFeeds', { money: 200 }, 20, ['wgetMirror'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    upgrade('dirb', { insight: 100 }, 90, [], [multiply('searchEfficiency', 2)], 'folder'),
    upgrade('freeProxies', { money: 200 }, 20, [], [add('proxySlots', 3)]),
    upgrade('threads8', { insight: 50 }, 40, ['curlBatch'], [multiply('threadsPerScript', 2)]),
    upgrade('adsl', { money: 1500 }, 100, ['isdn'], [multiply('requestsPerThread', 3)]),
    upgrade('secondPc', { money: 2000 }, 80, ['newPc'], [add('scriptSlots', 3)]),
    upgrade('extensionList', { insight: 120 }, 120, [], [], 'extension'),
    upgrade('dictWords', { data: 512 * kilobytes }, 90, ['english10k']),
    upgrade('proxyChecker', { insight: 150, money: 2500 }, 180, ['proxyPool']),
    upgrade('sizeFilter', { insight: 150 }, 170, [], [], 'wildcard'),
    upgrade('dorking', { insight: 60 }, 90, [], [add('dorkChance', 0.08)]),
    upgrade('gobuster', { insight: 200, money: 3000 }, 150, ['dirb'], [multiply('searchEfficiency', 2.5)]),
    upgrade('seniorCertification', { money: 2500 }, 140, ['certification'], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    upgrade('archives', { money: 2000 }, 140, ['rssFeeds'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    upgrade('proxyPool', { money: 1200 }, 40, ['freeProxies'], [add('proxySlots', 6)]),
    upgrade('cable', { money: 2500 }, 220, ['adsl'], [multiply('requestsPerThread', 3)]),
    upgrade('mutationRules', { insight: 150 }, 260),
    upgrade('rockyou', { data: 1.25 * megabytes }, 260),
    upgrade('server', { money: 4000 }, 260, ['secondPc'], [add('scriptSlots', 4)]),
    upgrade('scrabble', { data: 2 * megabytes }, 220, ['dictWords']),
    upgrade('threads32', { insight: 150 }, 250, ['threads8'], [multiply('threadsPerScript', 4)]),
    upgrade('numberRanges', { insight: 120 }, 350),
    upgrade('rentedAddresses', { money: 3000 }, 100, ['proxyPool'], [add('extraAddresses', 16)]),
    upgrade('ffuf', { insight: 250, money: 4000 }, 400, ['gobuster'], [multiply('searchEfficiency', 2)]),
    upgrade('clusterBomb', { insight: 200 }, 450, [], [], 'credentials'),
    upgrade('crackHtpasswd', { insight: 80 }, 450, ['clusterBomb']),
    upgrade('fiber', { money: 8000 }, 500, ['cable'], [multiply('requestsPerThread', 3)]),
    upgrade('addressBlock', { money: 8000 }, 250, ['rentedAddresses'], [add('extraAddresses', 128)]),
    upgrade('combinator', { insight: 250 }, 650),
    upgrade('indexCache', { insight: 200, data: 3 * megabytes }, 600, ['dorking'], [add('dorkChance', 0.08)]),
    upgrade('leavePcOn', { money: 1000 }, 100),
];

export function offeredUpgrades(state: GameState): readonly Upgrade[] {
    const blocker = state.flags.automated ? planSearch(state.currentLevel + 1, searchCapabilities(state)).blockedBy : null;
    return upgrades.filter((item) => {
        if (owns(state, item.id) || !item.isAvailable(state)) return false;
        if (item.id === 'crackHtpasswd' && !state.findings.htpasswd) return false;
        return state.flags[`seen:${item.id}`] === true || item.fixes === blocker ||
            Object.entries(item.price).every(([resource, cost]) => (state.resources[resource] ?? 0) >= cost * 0.3);
    });
}
