import type { PurchasableDefinition, ResourceAmounts } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import type { GameState } from '../../core/state.ts';
import type { Modifier } from '../../core/stats.ts';
import { incomeWhileEarning } from './economy.ts';
import { owns } from './progress.ts';
import { planSearch, searchCapabilities, type SlowReason } from './search.ts';
import { upgradeText, type UpgradeId } from './text.ts';

export interface Upgrade extends PurchasableDefinition {
    readonly effect?: string;
    readonly price: ResourceAmounts;
    readonly level: number;
    readonly requires: readonly string[];
    readonly fixes?: SlowReason;
}

const multiply = (statId: string, value: number): Modifier => ({ statId, operation: 'multiply', value });
const add = (statId: string, value: number): Modifier => ({ statId, operation: 'add', value });
const requiredFindings: Partial<Record<UpgradeId, string>> = { crackHtpasswd: 'htpasswd' };
const kilobytes = 1024;
const megabytes = 1024 ** 2;
const offeredAtShareOfPrice = 0.3;
const offeredWithinSeconds = 900;

function upgrade(id: UpgradeId, price: ResourceAmounts, level: number,
    requires: readonly UpgradeId[] = [], modifiers: readonly Modifier[] = [], fixes?: SlowReason): Upgrade {
    return {
        id, ...upgradeText[id], price, level, requires, fixes, maximumCount: 1,
        cost: () => price,
        modifiers: () => modifiers,
        isAvailable: (state) => state.flags.automated === true && state.currentLevel >= level && requires.every((required) => owns(state, required)) && hasRequiredFinding(state, id),
    };
}

export const capacityUpgrades: ReadonlySet<string> = new Set(['freeProxies', 'proxyPool', 'rentedAddresses', 'addressBlock', 'secondAddressBlock', 'leasedRange',
    'dataCenterRange', 'secondDataCenterRange', 'throttle']);

export const upgrades: readonly Upgrade[] = [
    upgrade('curlBatch', { insight: 5 }, 5, [], [multiply('threadsPerScript', 4)]),
    upgrade('ram', { money: 60 }, 5, [], [add('scriptSlots', 1)]),
    upgrade('otherRiddles', { insight: 20 }, 8),
    upgrade('wgetMirror', { insight: 20 }, 10),
    upgrade('autoReplyMacros', { insight: 20 }, 10),
    upgrade('english10k', { data: 75 * kilobytes }, 10),
    upgrade('certification', { money: 150 }, 12, [], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    upgrade('keepAlive', { insight: 30 }, 15, [], [multiply('requestsPerThread', 2)]),
    upgrade('freeProxies', { money: 200 }, 20, [], [add('proxySlots', 3)]),
    upgrade('rssFeeds', { money: 200 }, 20, ['wgetMirror'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    upgrade('isdn', { money: 200 }, 25, [], [multiply('requestsPerThread', 2)]),
    upgrade('proxyUptime', { money: 150 }, 27, ['freeProxies'], [multiply('proxyLifetime', 2)]),
    upgrade('newPc', { money: 400 }, 30, ['ram'], [add('scriptSlots', 2)]),
    upgrade('fakeUserAgent', { insight: 40 }, 35, [], [], 'userAgent'),
    upgrade('threads8', { insight: 50 }, 40, ['curlBatch'], [multiply('threadsPerScript', 2)]),
    upgrade('proxyPool', { money: 1200 }, 40, ['freeProxies'], [add('proxySlots', 6)]),
    upgrade('sortByFrequency', { insight: 100 }, 50),
    upgrade('secondPc', { money: 800 }, 60, ['newPc'], [add('scriptSlots', 3)]),
    upgrade('throttle', { insight: 80 }, 70, ['freeProxies']),
    upgrade('dirb', { insight: 100 }, 90, [], [multiply('searchEfficiency', 2)], 'folder'),
    upgrade('dictWords', { data: 512 * kilobytes }, 90, ['english10k']),
    upgrade('dorking', { insight: 50 }, 90, [], [add('dorkChance', 0.08)]),
    upgrade('adsl', { money: 600 }, 100, ['isdn'], [multiply('requestsPerThread', 3)]),
    upgrade('rentedAddresses', { money: 600 }, 100, ['proxyPool'], [add('rentableAddresses', 32)]),
    upgrade('leavePcOn', { money: 400 }, 100),
    upgrade('extensionList', { insight: 80 }, 120, [], [], 'extension'),
    upgrade('seniorCertification', { money: 1000 }, 140, ['certification'], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    upgrade('archives', { money: 800 }, 140, ['rssFeeds'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    upgrade('gobuster', { insight: 120, money: 1200 }, 150, ['dirb'], [multiply('searchEfficiency', 1.5)]),
    upgrade('sizeFilter', { insight: 100 }, 170, [], [], 'wildcard'),
    upgrade('proxyChecker', { insight: 80, money: 1000 }, 180, ['proxyPool']),
    upgrade('scrabble', { data: 2 * megabytes }, 220, ['dictWords']),
    upgrade('addressBlock', { money: 1500 }, 250, ['rentedAddresses'], [add('rentableAddresses', 128)]),
    upgrade('cable', { money: 1500 }, 260, ['adsl'], [multiply('requestsPerThread', 3)]),
    upgrade('server', { money: 2500 }, 260, ['secondPc'], [add('scriptSlots', 4)]),
    upgrade('mutationRules', { insight: 120 }, 260),
    upgrade('rockyou', { data: 1.25 * megabytes }, 260),
    upgrade('riddleForum', { money: 2500 }, 300, ['otherRiddles'], [multiply('riddleRate', 2), multiply('riddleBotRate', 2)]),
    upgrade('numberRanges', { insight: 150 }, 350),
    upgrade('teamLead', { money: 5000 }, 350, ['seniorCertification'], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    upgrade('webCrawler', { money: 4000 }, 380, ['archives'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    upgrade('ffuf', { insight: 300, money: 6000 }, 400, ['gobuster'], [multiply('searchEfficiency', 1.5)]),
    upgrade('resellerAccount', { money: 4000 }, 420, ['addressBlock'], [multiply('addressRent', 0.8)]),
    upgrade('clusterBomb', { insight: 200, money: 8000 }, 450, [], [], 'credentials'),
    upgrade('crackHtpasswd', { insight: 80 }, 450, ['clusterBomb']),
    upgrade('secondAddressBlock', { money: 8000 }, 500, ['addressBlock'], [add('rentableAddresses', 256)]),
    upgrade('threads16', { insight: 300, money: 7000 }, 520, ['threads8'], [multiply('threadsPerScript', 2)]),
    upgrade('moreLeaks', { data: 12 * megabytes }, 540, ['rockyou']),
    upgrade('dedicatedServer', { money: 15000 }, 560, ['server'], [add('scriptSlots', 4)]),
    upgrade('namesList', { data: 4 * megabytes }, 580, ['dictWords']),
    upgrade('indexCache', { insight: 500, data: 6 * megabytes }, 600, ['dorking'], [add('dorkChance', 0.08)]),
    upgrade('combinator', { insight: 500, money: 10000 }, 625),
    upgrade('leasedRange', { money: 14000 }, 650, ['secondAddressBlock'], [add('rentableAddresses', 512)]),
    upgrade('helpdeskManager', { money: 20000 }, 665, ['teamLead'], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    upgrade('fiber', { money: 22000 }, 680, ['cable'], [multiply('requestsPerThread', 3)]),
    upgrade('customFuzzer', { insight: 600, money: 24000 }, 700, ['ffuf'], [multiply('searchEfficiency', 1.25)]),
    upgrade('forumModerator', { money: 22000 }, 735, ['riddleForum'], [multiply('riddleRate', 2), multiply('riddleBotRate', 2)]),
    upgrade('volumeDiscount', { money: 24000 }, 770, ['resellerAccount'], [multiply('addressRent', 0.8)]),
    upgrade('dataCenterRange', { money: 28000 }, 805, ['leasedRange'], [add('rentableAddresses', 512)]),
    upgrade('threads32', { insight: 1200, money: 26000 }, 830, ['threads16'], [multiply('threadsPerScript', 2)]),
    upgrade('serverRack', { money: 34000 }, 855, ['dedicatedServer'], [add('scriptSlots', 6)]),
    upgrade('secondDataCenterRange', { money: 30000 }, 880, ['dataCenterRange'], [add('rentableAddresses', 512)]),
    upgrade('distributedFuzzing', { insight: 2400, money: 30000 }, 905, ['customFuzzer'], [multiply('searchEfficiency', 1.25)]),
    upgrade('searchAlerts', { insight: 2000, data: 20 * megabytes }, 930, ['indexCache'], [add('dorkChance', 0.08)]),
    upgrade('gigabit', { money: 42000 }, 960, ['fiber'], [multiply('requestsPerThread', 2)]),
];

export const connectionTiers: readonly UpgradeId[] = ['isdn', 'adsl', 'cable', 'fiber', 'gigabit'];
export const toolTiers: readonly UpgradeId[] = ['dirb', 'gobuster', 'ffuf', 'customFuzzer'];

export function ownedTier(state: GameState, tiers: readonly UpgradeId[]): number {
    return tiers.filter((id) => owns(state, id)).length;
}

export function offeredUpgrades(game: Game): readonly Upgrade[] {
    const { state } = game;
    const slowedBy = state.flags.automated ? planSearch(state.currentLevel + 1, searchCapabilities(state)).slowedBy : null;
    const withinReach = (resource: string, cost: number): boolean =>
        (state.resources[resource] ?? 0) >= cost * offeredAtShareOfPrice || incomeWhileEarning(game, resource) * offeredWithinSeconds >= cost;
    return upgrades.filter((item) => {
        if (owns(state, item.id) || !item.isAvailable(state)) return false;
        return state.flags[`seen:${item.id}`] === true || (item.fixes !== undefined && item.fixes === slowedBy) ||
            Object.entries(item.price).every(([resource, cost]) => withinReach(resource, cost));
    });
}

function hasRequiredFinding(state: GameState, id: UpgradeId): boolean {
    const finding = requiredFindings[id];
    return finding === undefined || (state.findings[finding] ?? 0) > 0;
}
