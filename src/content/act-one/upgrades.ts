import type { PurchasableDefinition, ResourceAmounts } from '../../core/content.ts';
import type { GameState } from '../../core/state.ts';
import type { Modifier } from '../../core/stats.ts';
import { owns } from './progress.ts';
import { planSearch, searchCapabilities, type BlockReason } from './search.ts';
import { upgradeText, type UpgradeId } from './text.ts';

export interface Upgrade extends PurchasableDefinition {
    readonly price: ResourceAmounts;
    readonly level: number;
    readonly requires: readonly string[];
    readonly fixes?: BlockReason;
}

const multiply = (statId: string, value: number): Modifier => ({ statId, operation: 'multiply', value });
const add = (statId: string, value: number): Modifier => ({ statId, operation: 'add', value });

function upgrade(id: UpgradeId, price: ResourceAmounts, level: number,
    requires: readonly UpgradeId[] = [], modifiers: readonly Modifier[] = [], fixes?: BlockReason): Upgrade {
    return {
        id, ...upgradeText[id], price, level, requires, fixes, maximumCount: 1,
        cost: () => price,
        modifiers: () => modifiers,
        isAvailable: (state) => state.flags.automated === true && state.currentLevel >= level && requires.every((required) => owns(state, required)),
    };
}

export const upgrades: readonly Upgrade[] = [
    upgrade('curlBatch', { insight: 5 }, 5, [], [multiply('threadsPerScript', 4)]),
    upgrade('sortByFrequency', { insight: 12 }, 8),
    upgrade('keepAlive', { insight: 20 }, 15, [], [multiply('requestsPerThread', 2)]),
    upgrade('fakeUserAgent', { insight: 8 }, 35, [], [], 'userAgent'),
    upgrade('throttle', { insight: 10 }, 5),
    upgrade('ram', { money: 60 }, 8, [], [add('scriptSlots', 1)]),
    upgrade('wgetMirror', { insight: 15 }, 10),
    upgrade('autoReplyMacros', { insight: 15 }, 10),
    upgrade('isdn', { money: 100 }, 15, [], [multiply('requestsPerThread', 2)]),
    upgrade('english10k', { words: 500 }, 15),
    upgrade('newPc', { money: 240 }, 25, ['ram'], [add('scriptSlots', 2)]),
    upgrade('certification', { money: 150 }, 20, [], [multiply('ticketValue', 3), multiply('ticketBotRate', 3)]),
    upgrade('rssFeeds', { money: 120 }, 20, ['wgetMirror'], [multiply('scourValue', 3), multiply('scraperRate', 3)]),
    upgrade('dirb', { insight: 35 }, 60, [], [multiply('searchEfficiency', 1.5)], 'folder'),
    upgrade('freeProxies', { money: 180 }, 30, ['throttle'], [add('proxySlots', 3)]),
    upgrade('threads8', { insight: 30 }, 35, ['curlBatch'], [multiply('threadsPerScript', 2)]),
    upgrade('adsl', { money: 450 }, 60, ['isdn'], [multiply('requestsPerThread', 3)]),
    upgrade('secondPc', { money: 700 }, 80, ['newPc'], [add('scriptSlots', 3)]),
    upgrade('extensionList', { insight: 25 }, 120, [], [], 'extension'),
    upgrade('dictWords', { words: 3500 }, 90, ['english10k']),
    upgrade('proxyChecker', { insight: 45, money: 250 }, 75, ['freeProxies']),
    upgrade('sizeFilter', { insight: 25 }, 170, [], [], 'wildcard'),
    upgrade('dorking', { insight: 40 }, 90, [], [add('dorkChance', 0.08)]),
    upgrade('gobuster', { insight: 60, money: 400 }, 150, ['dirb'], [multiply('searchEfficiency', 2)]),
    upgrade('seniorCertification', { money: 800 }, 140, ['certification'], [multiply('ticketValue', 3), multiply('ticketBotRate', 3)]),
    upgrade('archives', { money: 600 }, 140, ['rssFeeds'], [multiply('scourValue', 3), multiply('scraperRate', 3)]),
    upgrade('proxyPool', { money: 700 }, 140, ['freeProxies'], [add('proxySlots', 6)]),
    upgrade('cable', { money: 1400 }, 220, ['adsl'], [multiply('requestsPerThread', 3)]),
    upgrade('mutationRules', { insight: 50 }, 260),
    upgrade('rockyou', { words: 9000 }, 260),
    upgrade('server', { money: 2200 }, 260, ['secondPc'], [add('scriptSlots', 4)]),
    upgrade('scrabble', { words: 14000 }, 220, ['dictWords']),
    upgrade('threads32', { insight: 80 }, 250, ['threads8'], [multiply('threadsPerScript', 4)]),
    upgrade('numberRanges', { insight: 30 }, 350),
    upgrade('rentedAddresses', { money: 2000 }, 300, ['proxyPool'], [add('extraAddresses', 16)]),
    upgrade('ffuf', { insight: 120, money: 1800 }, 400, ['gobuster'], [multiply('searchEfficiency', 2)]),
    upgrade('clusterBomb', { insight: 50 }, 450, [], [], 'credentials'),
    upgrade('crackHtpasswd', { insight: 80 }, 450, ['clusterBomb']),
    upgrade('fiber', { money: 4500 }, 500, ['cable'], [multiply('requestsPerThread', 3)]),
    upgrade('addressBlock', { money: 6000 }, 500, ['rentedAddresses'], [add('extraAddresses', 64)]),
    upgrade('combinator', { insight: 80 }, 650),
    upgrade('indexCache', { insight: 100, words: 20000 }, 600, ['dorking'], [add('dorkChance', 0.08)]),
    upgrade('leavePcOn', { money: 500 }, 100),
];

export function offeredUpgrades(state: GameState): readonly Upgrade[] {
    const blocker = state.flags.automated ? planSearch(state.currentLevel + 1, searchCapabilities(state)).blockedBy : null;
    return upgrades.filter((item) => {
        if (owns(state, item.id) || !item.isAvailable(state)) return false;
        if (item.id === 'crackHtpasswd' && !state.findings.htpasswd) return false;
        return state.flags[`seen:${item.id}`] === true || item.fixes === blocker ||
            (item.id === 'throttle' && state.flags.networkRevealed) ||
            Object.entries(item.price).every(([resource, cost]) => (state.resources[resource] ?? 0) >= cost * 0.3);
    });
}
