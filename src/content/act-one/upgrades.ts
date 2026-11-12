import type { PurchasableDefinition, ResourceAmounts } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import type { GameState } from '../../core/state.ts';
import type { Modifier } from '../../core/stats.ts';
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

type Unlock = 'level' | 'need' | 'levelAndNeed';
type UpgradeFactory = (id: UpgradeId, price: ResourceAmounts, level: number, requires?: readonly UpgradeId[], modifiers?: readonly Modifier[]) => Upgrade;

function unlockedBy(unlock: Unlock): UpgradeFactory {
    return (id, price, level, requires = [], modifiers = []) => ({
        id, ...upgradeText[id], price, level, requires, onNeed: unlock !== 'level', maximumCount: 1,
        cost: () => price,
        modifiers: () => modifiers,
        isAvailable: (state) => state.flags.automated === true && (unlock === 'need' || state.currentLevel >= level) && (unlock === 'level' || isNeeded(state, id))
            && requires.every((required) => owns(state, required)) && hasRequiredFinding(state, id),
    });
}

const upgrade = unlockedBy('level');
// A card that appears when the game first runs into what it solves, or once an answer has shown what was missing. Its level is where that is expected to happen.
const whenNeeded = unlockedBy('need');
// A card that appears from its level on, once what it helps with is going on. The triggers are in needs.ts.
const whenUseful = unlockedBy('levelAndNeed');

export const capacityUpgrades: ReadonlySet<string> = new Set(['freeProxies', 'proxyPool', 'rentedAddresses', 'throttle']);
export const laterAddressBlocks: readonly UpgradeId[] = ['addressBlock', 'secondAddressBlock', 'leasedRange', 'dataCenterRange', 'secondDataCenterRange'];

export const upgrades: readonly Upgrade[] = [
    upgrade('curlBatch', { insight: 5 }, 5, [], [multiply('threadsPerScript', 4)]),
    upgrade('ram', { money: 60 }, 5, [], [add('scriptSlots', 1)]),
    upgrade('otherRiddles', { insight: 20 }, 5),
    upgrade('wgetMirror', { insight: 20 }, 10),
    upgrade('autoReplyMacros', { insight: 20 }, 10),
    upgrade('certification', { money: 210 }, 10, [], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    upgrade('moreRam', { money: 150 }, 12, ['ram'], [add('scriptSlots', 1)]),
    whenUseful('freeProxies', { money: 200 }, 12, [], [add('proxySlots', 3)]),
    whenUseful('keepAlive', { insight: 30 }, 15, [], [multiply('requestsPerThread', 2)]),
    whenUseful('proxyUptime', { money: 150 }, 15, ['freeProxies'], [multiply('proxyLifetime', 2)]),
    whenUseful('rssFeeds', { money: 200 }, 20, ['wgetMirror'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    whenUseful('isdn', { money: 200 }, 20, [], [multiply('requestsPerThread', 2)]),
    whenNeeded('fakeUserAgent', { insight: 40 }, 20),
    upgrade('newPc', { money: 670 }, 15, ['ram'], [add('scriptSlots', 2)]),
    whenUseful('threads8', { insight: 50 }, 36, ['curlBatch'], [multiply('threadsPerScript', 2)]),
    whenUseful('proxyPool', { money: 1200 }, 40, ['freeProxies'], [add('proxySlots', 6)]),
    upgrade('sortByFrequency', { insight: 170 }, 25),
    upgrade('secondPc', { money: 1300 }, 30, ['newPc'], [add('scriptSlots', 3)]),
    upgrade('throttle', { insight: 130 }, 35, ['freeProxies']),
    whenNeeded('english10k', { data: 75 * kilobytes }, 81),
    upgrade('dorking', { insight: 85 }, 42, [], [add('dorkChance', 0.08)]),
    whenNeeded('dirb', { insight: 100 }, 100, [], [multiply('searchEfficiency', 2.5)]),
    whenUseful('adsl', { money: 600 }, 100, ['isdn'], [multiply('requestsPerThread', 3)]),
    whenUseful('rentedAddresses', { money: 600 }, 100, ['proxyPool'], [add('rentableAddresses', 32)]),
    whenUseful('leavePcOn', { money: 1000 }, 100),
    upgrade('seniorCertification', { money: 1700 }, 70, ['certification'], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    whenNeeded('extensionList', { insight: 80 }, 156),
    whenNeeded('dictWords', { data: 512 * kilobytes }, 160),
    upgrade('proxyChecker', { insight: 130, money: 1700 }, 90, ['proxyPool']),
    whenNeeded('sizeFilter', { insight: 100 }, 200),
    upgrade('gobuster', { insight: 200, money: 2000 }, 102, ['dirb'], [multiply('searchEfficiency', 1.4)]),
    whenUseful('cable', { money: 1500 }, 225, ['adsl'], [multiply('requestsPerThread', 3)]),
    upgrade('server', { money: 4200 }, 115, ['secondPc'], [add('scriptSlots', 4)]),
    whenNeeded('addressBlock', { money: 1000 }, 250, ['rentedAddresses'], [add('rentableAddresses', 64)]),
    whenUseful('archives', { money: 800 }, 262, ['rssFeeds'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    whenNeeded('scrabble', { data: 2 * megabytes }, 277),
    whenUseful('riddleForum', { money: 4000 }, 285, ['otherRiddles'], [multiply('riddleRate', 2), multiply('riddleBotRate', 2)]),
    upgrade('teamLead', { money: 7000 }, 148, ['seniorCertification'], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    whenNeeded('mutationRules', { insight: 120 }, 300),
    whenNeeded('rockyou', { data: 1.25 * megabytes }, 300),
    whenUseful('webCrawler', { money: 7000 }, 320, ['archives'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    whenNeeded('namesList', { data: megabytes }, 324),
    upgrade('ffuf', { insight: 500, money: 16000 }, 162, ['gobuster'], [multiply('searchEfficiency', 1.5)]),
    whenNeeded('capitalRule', { insight: 150 }, 330),
    whenNeeded('moreLeaks', { data: 4 * megabytes }, 340),
    upgrade('resellerAccount', { money: 13000 }, 175, ['addressBlock'], [multiply('addressRent', 0.8)]),
    upgrade('dedicatedServer', { money: 20000 }, 188, ['server'], [add('scriptSlots', 4)]),
    whenNeeded('reverseRule', { insight: 180 }, 380),
    whenNeeded('numberRanges', { insight: 150 }, 400),
    upgrade('indexCache', { insight: 840, data: 10 * megabytes }, 205, ['dorking'], [add('dorkChance', 0.08)]),
    whenNeeded('secondAddressBlock', { money: 3000 }, 450, ['addressBlock'], [add('rentableAddresses', 128)]),
    whenNeeded('backupExtensions', { insight: 220 }, 450),
    upgrade('helpdeskManager', { money: 37000 }, 230, ['teamLead'], [multiply('workRate', 2), multiply('ticketBotRate', 2)]),
    whenNeeded('clusterBomb', { insight: 200, money: 3000 }, 515),
    upgrade('crackHtpasswd', { insight: 130 }, 258, ['clusterBomb']),
    whenNeeded('usernames', { data: 3 * megabytes }, 540),
    whenNeeded('dateFormats', { insight: 250 }, 560),
    whenUseful('fiber', { money: 22000 }, 570, ['cable'], [multiply('requestsPerThread', 3)]),
    whenNeeded('passwords', { data: 4 * megabytes }, 600),
    whenNeeded('latinList', { data: 3 * megabytes }, 610),
    upgrade('customFuzzer', { insight: 1000, money: 41000 }, 305, ['ffuf'], [multiply('searchEfficiency', 1.5)]),
    whenNeeded('leasedRange', { money: 8000 }, 650, ['secondAddressBlock'], [add('rentableAddresses', 256)]),
    whenNeeded('subdomainScan', { insight: 450, money: 6000 }, 660),
    whenUseful('forumModerator', { money: 22000 }, 680, ['riddleForum'], [multiply('riddleRate', 2), multiply('riddleBotRate', 2)]),
    whenNeeded('combinator', { insight: 300, money: 5000 }, 704),
    whenNeeded('likelyPairs', { insight: 400 }, 720),
    upgrade('volumeDiscount', { money: 41000 }, 370, ['resellerAccount'], [multiply('addressRent', 0.8)]),
    upgrade('serverRack', { money: 47000 }, 400, ['dedicatedServer'], [add('scriptSlots', 6)]),
    whenNeeded('dataCenterRange', { money: 16000 }, 805, ['leasedRange'], [add('rentableAddresses', 512)]),
    upgrade('distributedFuzzing', { insight: 4100, money: 50000 }, 425, ['customFuzzer'], [multiply('searchEfficiency', 1.5)]),
    whenNeeded('secondDataCenterRange', { money: 30000 }, 880, ['dataCenterRange'], [add('rentableAddresses', 1024)]),
    upgrade('searchAlerts', { insight: 3400, data: 34 * megabytes }, 455, ['indexCache'], [add('dorkChance', 0.08)]),
];

export const connectionTiers: readonly UpgradeId[] = ['isdn', 'adsl', 'cable', 'fiber'];
export const toolTiers: readonly UpgradeId[] = ['dirb', 'gobuster', 'ffuf', 'customFuzzer'];

export function ownedTier(state: GameState, tiers: readonly UpgradeId[]): number {
    return tiers.filter((id) => owns(state, id)).length;
}

export function offeredUpgrades(game: Game): readonly Upgrade[] {
    return upgrades.filter((item) => !owns(game.state, item.id) && item.isAvailable(game.state));
}

function hasRequiredFinding(state: GameState, id: UpgradeId): boolean {
    const finding = requiredFindings[id];
    return finding === undefined || (state.findings[finding] ?? 0) > 0;
}
