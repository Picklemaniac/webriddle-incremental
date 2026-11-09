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
const requiredFindings: Partial<Record<UpgradeId, string>> = { crackHtpasswd: 'htpasswd' };
const kilobytes = 1024;
const megabytes = 1024 ** 2;

function upgrade(id: UpgradeId, price: ResourceAmounts, level: number,
    requires: readonly UpgradeId[] = [], modifiers: readonly Modifier[] = [], fixes?: BlockReason): Upgrade {
    return {
        id, ...upgradeText[id], price, level, requires, fixes, maximumCount: 1,
        cost: () => price,
        modifiers: () => modifiers,
        isAvailable: (state) => state.flags.automated === true && state.currentLevel >= level && requires.every((required) => owns(state, required)) && hasRequiredFinding(state, id),
    };
}

export const capacityUpgrades: ReadonlySet<string> = new Set(['freeProxies', 'proxyPool', 'rentedAddresses', 'addressBlock', 'secondAddressBlock', 'leasedRange',
    'dataCenterRange', 'throttle']);

export const upgrades: readonly Upgrade[] = [
    upgrade('curlBatch', { insight: 5 }, 5, [], [multiply('threadsPerScript', 4)]),
    upgrade('ram', { money: 60 }, 5, [], [add('scriptSlots', 1)]),
    upgrade('otherRiddles', { insight: 20 }, 8),
    upgrade('wgetMirror', { insight: 20 }, 10),
    upgrade('autoReplyMacros', { insight: 20 }, 10),
    upgrade('english10k', { data: 75 * kilobytes }, 10),
    upgrade('keepAlive', { insight: 30 }, 15, [], [multiply('requestsPerThread', 2)]),
    upgrade('freeProxies', { money: 200 }, 20, [], [add('proxySlots', 3)]),
    upgrade('certification', { money: 250 }, 20, [], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    upgrade('rssFeeds', { money: 200 }, 20, ['wgetMirror'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    upgrade('isdn', { money: 200 }, 25, [], [multiply('requestsPerThread', 2)]),
    upgrade('newPc', { money: 400 }, 30, ['ram'], [add('scriptSlots', 2)]),
    upgrade('fakeUserAgent', { insight: 40 }, 35, [], [], 'userAgent'),
    upgrade('threads8', { insight: 50 }, 40, ['curlBatch'], [multiply('threadsPerScript', 2)]),
    upgrade('proxyPool', { money: 1200 }, 40, ['freeProxies'], [add('proxySlots', 6)]),
    upgrade('sortByFrequency', { insight: 100 }, 50),
    upgrade('throttle', { insight: 80 }, 70, ['freeProxies']),
    upgrade('secondPc', { money: 800 }, 80, ['newPc'], [add('scriptSlots', 3)]),
    upgrade('dirb', { insight: 80 }, 90, [], [multiply('searchEfficiency', 2)], 'folder'),
    upgrade('dictWords', { data: 512 * kilobytes }, 90, ['english10k']),
    upgrade('dorking', { insight: 50 }, 90, [], [add('dorkChance', 0.08)]),
    upgrade('adsl', { money: 600 }, 100, ['isdn'], [multiply('requestsPerThread', 3)]),
    upgrade('rentedAddresses', { money: 1200 }, 100, ['proxyPool'], [add('extraAddresses', 16)]),
    upgrade('leavePcOn', { money: 400 }, 100),
    upgrade('extensionList', { insight: 80 }, 120, [], [], 'extension'),
    upgrade('seniorCertification', { money: 1000 }, 140, ['certification'], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    upgrade('archives', { money: 800 }, 140, ['rssFeeds'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    upgrade('gobuster', { insight: 120, money: 1200 }, 150, ['dirb'], [multiply('searchEfficiency', 1.5)]),
    upgrade('sizeFilter', { insight: 100 }, 170, [], [], 'wildcard'),
    upgrade('proxyChecker', { insight: 80, money: 1000 }, 180, ['proxyPool']),
    upgrade('scrabble', { data: 2 * megabytes }, 220, ['dictWords']),
    upgrade('addressBlock', { money: 3000 }, 250, ['rentedAddresses'], [add('extraAddresses', 64)]),
    upgrade('cable', { money: 1500 }, 260, ['adsl'], [multiply('requestsPerThread', 3)]),
    upgrade('server', { money: 2500 }, 260, ['secondPc'], [add('scriptSlots', 4)]),
    upgrade('mutationRules', { insight: 120 }, 260),
    upgrade('rockyou', { data: 1.25 * megabytes }, 260),
    upgrade('riddleForum', { money: 2500 }, 300, ['otherRiddles'], [multiply('riddleRate', 2), multiply('riddleBotRate', 2)]),
    upgrade('numberRanges', { insight: 150 }, 350),
    upgrade('teamLead', { money: 5000 }, 350, ['seniorCertification'], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    upgrade('webCrawler', { money: 4000 }, 380, ['archives'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    upgrade('ffuf', { insight: 300, money: 6000 }, 400, ['gobuster'], [multiply('searchEfficiency', 1.5)]),
    upgrade('clusterBomb', { insight: 200, money: 8000 }, 450, [], [], 'credentials'),
    upgrade('crackHtpasswd', { insight: 80 }, 450, ['clusterBomb']),
    upgrade('secondAddressBlock', { money: 20000 }, 500, ['addressBlock'], [add('extraAddresses', 128)]),
    upgrade('threads16', { insight: 300, money: 10000 }, 520, ['threads8'], [multiply('threadsPerScript', 2)]),
    upgrade('dedicatedServer', { money: 22000 }, 560, ['server'], [add('scriptSlots', 4)]),
    upgrade('moreLeaks', { data: 12 * megabytes }, 560, ['rockyou']),
    upgrade('namesList', { data: 4 * megabytes }, 580, ['dictWords']),
    upgrade('indexCache', { insight: 500, data: 6 * megabytes }, 600, ['dorking'], [add('dorkChance', 0.08)]),
    upgrade('leasedRange', { money: 35000 }, 650, ['secondAddressBlock'], [add('extraAddresses', 256)]),
    upgrade('combinator', { insight: 500, money: 15000 }, 650),
    upgrade('helpdeskManager', { money: 30000 }, 650, ['teamLead'], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    upgrade('fiber', { money: 35000 }, 680, ['cable'], [multiply('requestsPerThread', 3)]),
    upgrade('customFuzzer', { insight: 600, money: 40000 }, 700, ['ffuf'], [multiply('searchEfficiency', 1.25)]),
    upgrade('forumModerator', { money: 40000 }, 720, ['riddleForum'], [multiply('riddleRate', 2), multiply('riddleBotRate', 2)]),
    upgrade('dataCenterRange', { money: 70000 }, 800, ['leasedRange'], [add('extraAddresses', 512)]),
    upgrade('threads32', { insight: 1200, money: 40000 }, 830, ['threads16'], [multiply('threadsPerScript', 2)]),
    upgrade('serverRack', { money: 75000 }, 830, ['dedicatedServer'], [add('scriptSlots', 6)]),
    upgrade('distributedFuzzing', { insight: 3000, money: 60000 }, 880, ['customFuzzer'], [multiply('searchEfficiency', 1.25)]),
    upgrade('searchAlerts', { insight: 2500, data: 20 * megabytes }, 900, ['indexCache'], [add('dorkChance', 0.08)]),
    upgrade('gigabit', { money: 100000 }, 920, ['fiber'], [multiply('requestsPerThread', 2)]),
];

export const connectionTiers: readonly UpgradeId[] = ['isdn', 'adsl', 'cable', 'fiber', 'gigabit'];
export const toolTiers: readonly UpgradeId[] = ['dirb', 'gobuster', 'ffuf', 'customFuzzer'];

export function ownedTier(state: GameState, tiers: readonly UpgradeId[]): number {
    return tiers.filter((id) => owns(state, id)).length;
}

export function offeredUpgrades(state: GameState): readonly Upgrade[] {
    const blocker = state.flags.automated ? planSearch(state.currentLevel + 1, searchCapabilities(state)).blockedBy : null;
    return upgrades.filter((item) => {
        if (owns(state, item.id) || !item.isAvailable(state)) return false;
        return state.flags[`seen:${item.id}`] === true || item.fixes === blocker ||
            Object.entries(item.price).every(([resource, cost]) => (state.resources[resource] ?? 0) >= cost * 0.3);
    });
}

function hasRequiredFinding(state: GameState, id: UpgradeId): boolean {
    const finding = requiredFindings[id];
    return finding === undefined || (state.findings[finding] ?? 0) > 0;
}
