import type { PurchasableDefinition, ResourceAmounts } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import type { GameState } from '../../core/state.ts';
import type { Modifier } from '../../core/stats.ts';
import { incomeWhileEarning } from './economy.ts';
import { isNeeded, owns } from './progress.ts';
import { upgradeText, type UpgradeId } from './text.ts';

export interface Upgrade extends PurchasableDefinition {
    readonly effect?: string;
    readonly price: ResourceAmounts;
    readonly level: number;
    readonly requires: readonly string[];
    readonly onNeed: boolean;
}

const multiply = (statId: string, value: number): Modifier => ({ statId, operation: 'multiply', value });
const add = (statId: string, value: number): Modifier => ({ statId, operation: 'add', value });
const requiredFindings: Partial<Record<UpgradeId, string>> = { crackHtpasswd: 'htpasswd' };
const kilobytes = 1024;
const megabytes = 1024 ** 2;
const offeredAtShareOfPrice = 0.3;
const offeredWithinSeconds = 900;

function upgrade(id: UpgradeId, price: ResourceAmounts, level: number, requires: readonly UpgradeId[] = [], modifiers: readonly Modifier[] = [], onNeed = false): Upgrade {
    return {
        id, ...upgradeText[id], price, level, requires, onNeed, maximumCount: 1,
        cost: () => price,
        modifiers: () => modifiers,
        isAvailable: (state) => state.flags.automated === true && (onNeed ? isNeeded(state, id) : state.currentLevel >= level)
            && requires.every((required) => owns(state, required)) && hasRequiredFinding(state, id),
    };
}

// A card that appears when DirBuster first runs into what it solves. Its level is where that is expected to happen.
function whenNeeded(id: UpgradeId, price: ResourceAmounts, level: number, requires: readonly UpgradeId[] = [], modifiers: readonly Modifier[] = []): Upgrade {
    return upgrade(id, price, level, requires, modifiers, true);
}

export const capacityUpgrades: ReadonlySet<string> = new Set(['freeProxies', 'proxyPool', 'rentedAddresses', 'throttle']);
export const laterAddressBlocks: readonly UpgradeId[] = ['addressBlock', 'secondAddressBlock', 'leasedRange', 'dataCenterRange', 'secondDataCenterRange'];

export const upgrades: readonly Upgrade[] = [
    upgrade('curlBatch', { insight: 5 }, 5, [], [multiply('threadsPerScript', 4)]),
    upgrade('ram', { money: 60 }, 5, [], [add('scriptSlots', 1)]),
    upgrade('otherRiddles', { insight: 20 }, 5),
    upgrade('wgetMirror', { insight: 20 }, 10),
    upgrade('autoReplyMacros', { insight: 20 }, 10),
    upgrade('certification', { money: 150 }, 12, [], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    upgrade('keepAlive', { insight: 30 }, 15, [], [multiply('requestsPerThread', 2)]),
    upgrade('freeProxies', { money: 200 }, 15, [], [add('proxySlots', 3)]),
    upgrade('rssFeeds', { money: 200 }, 20, ['wgetMirror'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    upgrade('isdn', { money: 200 }, 20, [], [multiply('requestsPerThread', 2)]),
    upgrade('proxyUptime', { money: 150 }, 25, ['freeProxies'], [multiply('proxyLifetime', 2)]),
    upgrade('newPc', { money: 400 }, 30, ['ram'], [add('scriptSlots', 2)]),
    upgrade('threads8', { insight: 50 }, 36, ['curlBatch'], [multiply('threadsPerScript', 2)]),
    upgrade('proxyPool', { money: 1200 }, 40, ['freeProxies'], [add('proxySlots', 6)]),
    whenNeeded('fakeUserAgent', { insight: 40 }, 46),
    upgrade('sortByFrequency', { insight: 100 }, 50),
    upgrade('secondPc', { money: 800 }, 60, ['newPc'], [add('scriptSlots', 3)]),
    upgrade('throttle', { insight: 80 }, 70, ['freeProxies']),
    whenNeeded('english10k', { data: 75 * kilobytes }, 81),
    upgrade('dorking', { insight: 50 }, 85, [], [add('dorkChance', 0.08)]),
    whenNeeded('dirb', { insight: 100 }, 100, [], [multiply('searchEfficiency', 2)]),
    upgrade('adsl', { money: 600 }, 100, ['isdn'], [multiply('requestsPerThread', 3)]),
    upgrade('rentedAddresses', { money: 600 }, 100, ['proxyPool'], [add('rentableAddresses', 32)]),
    upgrade('seniorCertification', { money: 1000 }, 140, ['certification'], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    whenNeeded('extensionList', { insight: 80 }, 156),
    whenNeeded('dictWords', { data: 512 * kilobytes }, 160),
    upgrade('proxyChecker', { insight: 80, money: 1000 }, 180, ['proxyPool']),
    whenNeeded('sizeFilter', { insight: 100 }, 200),
    upgrade('gobuster', { insight: 120, money: 1200 }, 205, ['dirb'], [multiply('searchEfficiency', 1.5)]),
    upgrade('cable', { money: 1500 }, 225, ['adsl'], [multiply('requestsPerThread', 3)]),
    upgrade('server', { money: 2500 }, 245, ['secondPc'], [add('scriptSlots', 4)]),
    whenNeeded('addressBlock', { money: 1000 }, 250, ['rentedAddresses'], [add('rentableAddresses', 64)]),
    upgrade('archives', { money: 800 }, 262, ['rssFeeds'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    whenNeeded('scrabble', { data: 2 * megabytes }, 277),
    upgrade('leavePcOn', { money: 2500 }, 280),
    upgrade('riddleForum', { money: 4000 }, 285, ['otherRiddles'], [multiply('riddleRate', 2), multiply('riddleBotRate', 2)]),
    upgrade('teamLead', { money: 6000 }, 295, ['seniorCertification'], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    whenNeeded('mutationRules', { insight: 120 }, 300),
    whenNeeded('rockyou', { data: 1.25 * megabytes }, 300),
    upgrade('webCrawler', { money: 7000 }, 320, ['archives'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    whenNeeded('namesList', { data: megabytes }, 324),
    whenNeeded('capitalRule', { insight: 150 }, 330),
    whenNeeded('moreLeaks', { data: 4 * megabytes }, 340),
    upgrade('ffuf', { insight: 300, money: 9000 }, 350, ['gobuster'], [multiply('searchEfficiency', 1.5)]),
    upgrade('resellerAccount', { money: 8000 }, 370, ['addressBlock'], [multiply('addressRent', 0.8)]),
    whenNeeded('reverseRule', { insight: 180 }, 380),
    upgrade('dedicatedServer', { money: 12000 }, 395, ['server'], [add('scriptSlots', 4)]),
    upgrade('indexCache', { insight: 500, data: 6 * megabytes }, 440, ['dorking'], [add('dorkChance', 0.08)]),
    whenNeeded('secondAddressBlock', { money: 3000 }, 450, ['addressBlock'], [add('rentableAddresses', 128)]),
    whenNeeded('backupExtensions', { insight: 220 }, 450),
    upgrade('helpdeskManager', { money: 22000 }, 490, ['teamLead'], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    whenNeeded('clusterBomb', { insight: 200, money: 3000 }, 515),
    upgrade('crackHtpasswd', { insight: 80 }, 515, ['clusterBomb']),
    whenNeeded('usernames', { data: 3 * megabytes }, 540),
    whenNeeded('dateFormats', { insight: 250 }, 560),
    upgrade('fiber', { money: 22000 }, 570, ['cable'], [multiply('requestsPerThread', 3)]),
    whenNeeded('passwords', { data: 4 * megabytes }, 600),
    whenNeeded('latinList', { data: 3 * megabytes }, 610),
    upgrade('customFuzzer', { insight: 600, money: 24000 }, 610, ['ffuf'], [multiply('searchEfficiency', 1.25)]),
    whenNeeded('leasedRange', { money: 8000 }, 650, ['secondAddressBlock'], [add('rentableAddresses', 256)]),
    whenNeeded('subdomainScan', { insight: 450, money: 6000 }, 660),
    upgrade('forumModerator', { money: 22000 }, 680, ['riddleForum'], [multiply('riddleRate', 2), multiply('riddleBotRate', 2)]),
    whenNeeded('combinator', { insight: 300, money: 5000 }, 704),
    whenNeeded('likelyPairs', { insight: 400 }, 720),
    upgrade('volumeDiscount', { money: 24000 }, 740, ['resellerAccount'], [multiply('addressRent', 0.8)]),
    upgrade('serverRack', { money: 28000 }, 800, ['dedicatedServer'], [add('scriptSlots', 6)]),
    whenNeeded('dataCenterRange', { money: 16000 }, 805, ['leasedRange'], [add('rentableAddresses', 512)]),
    upgrade('distributedFuzzing', { insight: 2400, money: 30000 }, 850, ['customFuzzer'], [multiply('searchEfficiency', 1.25)]),
    whenNeeded('secondDataCenterRange', { money: 30000 }, 880, ['dataCenterRange'], [add('rentableAddresses', 1024)]),
    upgrade('searchAlerts', { insight: 2000, data: 20 * megabytes }, 910, ['indexCache'], [add('dorkChance', 0.08)]),
];

export const connectionTiers: readonly UpgradeId[] = ['isdn', 'adsl', 'cable', 'fiber'];
export const toolTiers: readonly UpgradeId[] = ['dirb', 'gobuster', 'ffuf', 'customFuzzer'];

export function ownedTier(state: GameState, tiers: readonly UpgradeId[]): number {
    return tiers.filter((id) => owns(state, id)).length;
}

export function offeredUpgrades(game: Game): readonly Upgrade[] {
    const { state } = game;
    const withinReach = (resource: string, cost: number): boolean =>
        (state.resources[resource] ?? 0) >= cost * offeredAtShareOfPrice || incomeWhileEarning(game, resource) * offeredWithinSeconds >= cost;
    return upgrades.filter((item) => {
        if (owns(state, item.id) || !item.isAvailable(state)) return false;
        return item.onNeed || state.flags[`seen:${item.id}`] === true || Object.entries(item.price).every(([resource, cost]) => withinReach(resource, cost));
    });
}

function hasRequiredFinding(state: GameState, id: UpgradeId): boolean {
    const finding = requiredFindings[id];
    return finding === undefined || (state.findings[finding] ?? 0) > 0;
}
