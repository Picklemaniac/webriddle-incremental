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
// The eight pay cards take the pay from 1 to 1.5, 2, 3, 4, 6, 8, 12 and 16 dollars a second.
const payRise = (factor: number): Modifier[] => [multiply('workRate', factor), multiply('ticketBotRate', factor)];
const requiredFindings: Partial<Record<UpgradeId, string>> = { crackHtpasswd: 'htpasswd' };
// The later tools also look for folders, so dirb has nothing to add once one of them is owned.
const supersededBy: Partial<Record<UpgradeId, readonly UpgradeId[]>> = { dirb: ['gobuster', 'ffuf'] };
const kilobytes = 1024;
const megabytes = 1024 ** 2;
// A larger block of addresses costs less per address, and the lower price is for every address.
const cheaperAddresses = multiply('addressRent', 0.75);

type Unlock = 'level' | 'need' | 'levelAndNeed';
type UpgradeFactory = (id: UpgradeId, price: ResourceAmounts, level: number, requires?: readonly UpgradeId[], modifiers?: readonly Modifier[]) => Upgrade;

function unlockedBy(unlock: Unlock): UpgradeFactory {
    return (id, price, level, requires = [], modifiers = []) => ({
        id, ...upgradeText[id], price, level, requires, onNeed: unlock !== 'level', maximumCount: 1,
        cost: () => price,
        modifiers: () => modifiers,
        isAvailable: (state) => state.flags.automated === true && (unlock === 'need' || state.currentLevel >= level) && (unlock === 'level' || isNeeded(state, id))
            && requires.every((required) => owns(state, required)) && hasRequiredFinding(state, id) && !(supersededBy[id] ?? []).some((later) => owns(state, later)),
    });
}

const upgrade = unlockedBy('level');
// A card that appears when the game first runs into what it solves, or once an answer has shown what was missing. Its level is where that is expected to happen.
const whenNeeded = unlockedBy('need');
// A card that appears from its level on, once what it helps with is going on. The triggers are in needs.ts.
const whenUseful = unlockedBy('levelAndNeed');

export const capacityUpgrades: ReadonlySet<string> = new Set(['freeProxies', 'openWifi', 'proxyPool', 'rentedAddresses', 'throttle']);

export const upgrades: readonly Upgrade[] = [
    upgrade('curlBatch', { insight: 5 }, 5, [], [multiply('threadsPerScript', 4)]),
    upgrade('ram', { money: 60 }, 5, [], [add('scriptSlots', 1)]),
    upgrade('otherRiddles', { insight: 20 }, 5),
    upgrade('wgetMirror', { insight: 20 }, 5),
    upgrade('autoReplyMacros', { insight: 20 }, 5),
    upgrade('typingCourse', { money: 120 }, 5, [], payRise(1.5)),
    upgrade('certification', { money: 280 }, 5, ['typingCourse'], payRise(4 / 3)),
    upgrade('nightShifts', { money: 700 }, 30, ['certification'], payRise(1.5)),
    upgrade('moreRam', { money: 150 }, 5, ['ram'], [add('scriptSlots', 1)]),
    whenUseful('freeProxies', { money: 80 }, 5, [], [add('proxySlots', 3)]),
    whenUseful('keepAlive', { insight: 30 }, 5, ['curlBatch'], [multiply('requestsPerThread', 2)]),
    whenUseful('proxyUptime', { money: 150 }, 5, ['freeProxies'], [multiply('proxyLifetime', 2)]),
    whenUseful('rssFeeds', { money: 200 }, 20, ['wgetMirror'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    whenUseful('isdn', { money: 200 }, 5, ['keepAlive'], [multiply('requestsPerThread', 2)]),
    whenNeeded('fakeUserAgent', { insight: 40 }, 20),
    upgrade('newPc', { money: 500 }, 5, ['ram'], [add('scriptSlots', 2)]),
    whenUseful('threads8', { insight: 50 }, 5, ['isdn'], [multiply('threadsPerScript', 2)]),
    whenUseful('proxyPool', { money: 900 }, 5, ['freeProxies'], [add('proxySlots', 6)]),
    whenUseful('openWifi', { money: 250 }, 5, ['freeProxies'], [add('ownAddresses', 1)]),
    upgrade('secondPc', { money: 1100 }, 5, ['newPc'], [add('scriptSlots', 3)]),
    upgrade('throttle', { insight: 130 }, 35, ['freeProxies']),
    whenNeeded('english10k', { data: 75 * kilobytes }, 81),
    upgrade('dorking', { insight: 85 }, 42, [], [add('searchFindShare', 0.08)]),
    whenNeeded('dirb', { insight: 60 }, 100),
    whenUseful('gobuster', { insight: 100, money: 800 }, 5, ['threads8'], [multiply('threadsPerScript', 2)]),
    whenUseful('adsl', { money: 600 }, 5, ['gobuster'], [multiply('requestsPerThread', 3)]),
    whenUseful('rentedAddresses', { money: 400 }, 5, ['proxyPool'], [add('rentableAddresses', 8)]),
    whenUseful('leavePcOn', { money: 1000 }, 100),
    whenUseful('addressBlock', { money: 600 }, 5, ['rentedAddresses'], [add('rentableAddresses', 16), cheaperAddresses]),
    upgrade('seniorCertification', { money: 1700 }, 70, ['nightShifts'], payRise(4 / 3)),
    upgrade('secondLineSupport', { money: 3500 }, 110, ['seniorCertification'], payRise(1.5)),
    whenNeeded('extensionList', { insight: 80 }, 156),
    whenNeeded('dictWords', { data: 512 * kilobytes }, 160),
    upgrade('proxyChecker', { insight: 130, money: 1700 }, 130, ['proxyPool']),
    whenNeeded('sizeFilter', { insight: 100 }, 200),
    whenUseful('secondAddressBlock', { money: 1000 }, 5, ['addressBlock'], [add('rentableAddresses', 32), cheaperAddresses]),
    whenUseful('cable', { money: 1500 }, 5, ['ffuf'], [multiply('requestsPerThread', 3)]),
    upgrade('server', { money: 4200 }, 115, ['secondPc'], [add('scriptSlots', 4)]),
    whenUseful('thirdAddressBlock', { money: 2000 }, 5, ['secondAddressBlock'], [add('rentableAddresses', 64), cheaperAddresses]),
    whenUseful('archives', { money: 800 }, 262, ['rssFeeds'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    whenNeeded('scrabble', { data: 2 * megabytes }, 277),
    whenUseful('riddleForum', { money: 4000 }, 285, ['otherRiddles'], [multiply('riddleRate', 2), multiply('riddleBotRate', 2)]),
    upgrade('teamLead', { money: 7000 }, 148, ['secondLineSupport'], payRise(4 / 3)),
    upgrade('onCallBonus', { money: 15000 }, 190, ['teamLead'], payRise(1.5)),
    whenNeeded('mutationRules', { insight: 120 }, 300),
    whenNeeded('rockyou', { data: 1.25 * megabytes }, 300),
    whenUseful('webCrawler', { money: 7000 }, 320, ['archives'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    whenUseful('leasedRange', { money: 4000 }, 5, ['thirdAddressBlock'], [add('rentableAddresses', 128), cheaperAddresses]),
    whenNeeded('namesList', { data: megabytes }, 324),
    whenUseful('ffuf', { insight: 250, money: 4000 }, 5, ['adsl'], [multiply('threadsPerScript', 2)]),
    whenNeeded('capitalRule', { insight: 150 }, 330),
    whenNeeded('moreLeaks', { data: 4 * megabytes }, 340),
    upgrade('resellerAccount', { money: 13000 }, 175, ['addressBlock'], [multiply('addressRent', 0.8)]),
    upgrade('dedicatedServer', { money: 10000 }, 188, ['server'], [add('scriptSlots', 4)]),
    whenNeeded('reverseRule', { insight: 180 }, 380),
    whenNeeded('numberRanges', { insight: 150 }, 400),
    whenUseful('secondLeasedRange', { money: 8000 }, 5, ['leasedRange'], [add('rentableAddresses', 256), cheaperAddresses]),
    upgrade('indexCache', { insight: 840, data: 10 * megabytes }, 205, ['dorking'], [add('searchFindShare', 0.04)]),
    whenNeeded('backupExtensions', { insight: 220 }, 450),
    upgrade('helpdeskManager', { money: 30000 }, 230, ['onCallBonus'], payRise(4 / 3)),
    whenNeeded('clusterBomb', { insight: 200, money: 3000 }, 515),
    upgrade('crackHtpasswd', { insight: 130 }, 258, ['clusterBomb']),
    whenNeeded('usernames', { data: 3 * megabytes }, 540),
    whenNeeded('dateFormats', { insight: 250 }, 560),
    whenUseful('fiber', { money: 22000 }, 5, ['customFuzzer'], [multiply('requestsPerThread', 3)]),
    whenNeeded('passwords', { data: 4 * megabytes }, 600),
    whenNeeded('latinList', { data: 3 * megabytes }, 610),
    whenUseful('customFuzzer', { insight: 1000, money: 12000 }, 5, ['cable'], [multiply('threadsPerScript', 2)]),
    whenNeeded('subdomainScan', { insight: 450, money: 6000 }, 660),
    whenUseful('forumModerator', { money: 22000 }, 680, ['riddleForum'], [multiply('riddleRate', 2), multiply('riddleBotRate', 2)]),
    whenUseful('dataCenterRange', { money: 16000 }, 5, ['secondLeasedRange'], [add('rentableAddresses', 512), cheaperAddresses]),
    whenNeeded('combinator', { insight: 300, money: 5000 }, 704),
    upgrade('volumeDiscount', { money: 41000 }, 370, ['resellerAccount'], [multiply('addressRent', 0.8)]),
    upgrade('serverRack', { money: 36000 }, 400, ['dedicatedServer'], [add('scriptSlots', 6)]),
    whenUseful('pipelining', { insight: 3000, money: 30000 }, 5, ['fiber'], [multiply('requestsPerThread', 2)]),
    whenUseful('secondDataCenterRange', { money: 30000 }, 5, ['dataCenterRange'], [add('rentableAddresses', 1024), cheaperAddresses]),
    upgrade('searchAlerts', { insight: 3400, data: 34 * megabytes }, 455, ['indexCache'], [add('searchFindShare', 0.04)]),
    whenUseful('regionalAllocation', { money: 50000 }, 5, ['secondDataCenterRange'], [add('rentableAddresses', 2048), cheaperAddresses]),
    whenUseful('secondRegionalAllocation', { money: 75000 }, 5, ['regionalAllocation'], [add('rentableAddresses', 4096), cheaperAddresses]),
    whenUseful('thirdRegionalAllocation', { money: 100000 }, 5, ['secondRegionalAllocation'], [add('rentableAddresses', 8192), cheaperAddresses]),
];

export const connectionTiers: readonly UpgradeId[] = ['isdn', 'adsl', 'cable', 'fiber'];
export const toolTiers: readonly UpgradeId[] = ['dirb', 'gobuster', 'ffuf', 'customFuzzer'];

export function ownedTier(state: GameState, tiers: readonly UpgradeId[]): number {
    return tiers.findLastIndex((id) => owns(state, id)) + 1;
}

export function offeredUpgrades(game: Game): readonly Upgrade[] {
    return upgrades.filter((item) => !owns(game.state, item.id) && item.isAvailable(game.state));
}

function hasRequiredFinding(state: GameState, id: UpgradeId): boolean {
    const finding = requiredFindings[id];
    return finding === undefined || (state.findings[finding] ?? 0) > 0;
}
