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
const cheaperAddresses = multiply('addressRent', 0.6);

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
    upgrade('otherRiddles', { insight: 5 }, 5),
    upgrade('wgetMirror', { insight: 20 }, 5),
    upgrade('autoReplyMacros', { insight: 20 }, 5),
    upgrade('typingCourse', { money: 120 }, 5, [], payRise(1.5)),
    upgrade('certification', { money: 260 }, 5, ['typingCourse'], payRise(4 / 3)),
    upgrade('nightShifts', { money: 410 }, 5, ['certification'], payRise(1.5)),
    upgrade('seniorCertification', { money: 1400 }, 5, ['nightShifts'], payRise(4 / 3)),
    upgrade('secondLineSupport', { money: 2300 }, 5, ['seniorCertification'], payRise(1.5)),
    upgrade('teamLead', { money: 4000 }, 5, ['secondLineSupport'], payRise(4 / 3)),
    upgrade('onCallBonus', { money: 12000 }, 5, ['teamLead'], payRise(1.5)),
    upgrade('helpdeskManager', { money: 40000 }, 5, ['onCallBonus'], payRise(4 / 3)),
    upgrade('moreRam', { money: 180 }, 5, ['ram'], [add('scriptSlots', 1)]),
    whenUseful('freeProxies', { money: 80 }, 5, [], [add('proxySlots', 3)]),
    whenUseful('keepAlive', { insight: 30 }, 5, ['curlBatch'], [multiply('requestsPerThread', 2)]),
    whenUseful('proxyUptime', { money: 450 }, 5, ['freeProxies'], [multiply('proxyLifetime', 2)]),
    whenUseful('rssFeeds', { data: 250 * kilobytes }, 20, ['wgetMirror'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    whenUseful('isdn', { money: 2100 }, 5, ['keepAlive'], [multiply('requestsPerThread', 2)]),
    whenNeeded('fakeUserAgent', { insight: 100 }, 20),
    upgrade('newPc', { money: 450 }, 5, ['ram'], [add('scriptSlots', 2)]),
    upgrade('dualCore', { money: 450 }, 5, ['newPc'], [add('scriptSlots', 1)]),
    upgrade('dedicatedServer', { money: 1300 }, 5, ['dualCore'], [add('scriptSlots', 3)]),
    upgrade('headlessLinux', { money: 860 }, 5, ['dedicatedServer'], [add('scriptSlots', 1)]),
    upgrade('xeon', { money: 2400 }, 5, ['headlessLinux'], [add('scriptSlots', 2)]),
    upgrade('dualProcessorBoard', { money: 3800 }, 5, ['xeon'], [add('scriptSlots', 2)]),
    upgrade('quadCore', { money: 4400 }, 5, ['dualProcessorBoard'], [add('scriptSlots', 2)]),
    upgrade('sixtyFourBit', { money: 9500 }, 5, ['quadCore'], [add('scriptSlots', 3)]),
    upgrade('serverRack', { money: 20000 }, 5, ['sixtyFourBit'], [add('scriptSlots', 3)]),
    whenUseful('threads8', { insight: 100 }, 5, ['isdn'], [multiply('threadsPerScript', 2)]),
    whenUseful('proxyPool', { money: 1100 }, 5, ['freeProxies'], [add('proxySlots', 6)]),
    whenUseful('openWifi', { money: 310 }, 5, ['freeProxies'], [add('ownAddresses', 1)]),
    whenUseful('throttle', { insight: 130 }, 5, ['freeProxies']),
    whenNeeded('oxford3000', { data: 250 * kilobytes }, 67),
    whenNeeded('english10k', { data: 300 * kilobytes }, 121),
    whenNeeded('dirb', { insight: 70 }, 100),
    whenUseful('gobuster', { insight: 130 }, 5, ['threads8'], [multiply('threadsPerScript', 2)]),
    whenUseful('adsl', { money: 4200 }, 5, ['gobuster'], [multiply('requestsPerThread', 3)]),
    whenUseful('rentedAddresses', { money: 2800 }, 5, ['proxyPool'], [add('rentableAddresses', 16)]),
    whenUseful('leaveItRunning', { money: 1000 }, 5),
    whenUseful('addressBlock', { money: 2800 }, 5, ['rentedAddresses'], [add('rentableAddresses', 32), cheaperAddresses]),
    whenNeeded('extensionList', { insight: 130 }, 156),
    whenNeeded('twelveDicts', { data: 600 * kilobytes }, 171),
    whenNeeded('dictWords', { data: 1 * megabytes }, 217),
    whenUseful('proxyChecker', { insight: 90 }, 5, ['proxyPool']),
    whenNeeded('sizeFilter', { insight: 150 }, 200),
    whenUseful('secondAddressBlock', { money: 5000 }, 5, ['addressBlock'], [add('rentableAddresses', 64), cheaperAddresses]),
    whenUseful('cable', { money: 9000 }, 5, ['ffuf'], [multiply('requestsPerThread', 3)]),
    whenUseful('thirdAddressBlock', { money: 5300 }, 5, ['secondAddressBlock'], [add('rentableAddresses', 128), cheaperAddresses]),
    whenUseful('archives', { data: 800 * kilobytes }, 5, ['rssFeeds'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    whenNeeded('scrabble', { data: 2.25 * megabytes }, 277),
    whenUseful('riddleForum', { money: 2400 }, 5, ['otherRiddles'], [multiply('riddleRate', 2), multiply('riddleBotRate', 2)]),
    whenNeeded('mutationRules', { insight: 360 }, 300),
    whenNeeded('rockyou', { data: 5.25 * megabytes }, 300),
    whenUseful('webCrawler', { data: 2.25 * megabytes }, 5, ['archives'], [multiply('scourRate', 2), multiply('scraperRate', 2)]),
    whenUseful('leasedRange', { money: 7000 }, 5, ['thirdAddressBlock'], [add('rentableAddresses', 256), cheaperAddresses]),
    whenNeeded('namesList', { data: 2.75 * megabytes }, 324),
    whenUseful('ffuf', { insight: 200 }, 5, ['adsl'], [multiply('threadsPerScript', 2)]),
    whenNeeded('capitalRule', { insight: 400 }, 330),
    whenNeeded('moreLeaks', { data: 7 * megabytes }, 340),
    whenUseful('resellerAccount', { money: 2500 }, 5, ['addressBlock'], [multiply('addressRent', 0.8)]),
    whenNeeded('reverseRule', { insight: 400 }, 380),
    whenNeeded('numberRanges', { insight: 400 }, 400),
    whenUseful('secondLeasedRange', { money: 8500 }, 5, ['leasedRange'], [add('rentableAddresses', 512), cheaperAddresses]),
    whenNeeded('backupExtensions', { insight: 480 }, 450),
    whenNeeded('clusterBomb', { insight: 450 }, 515),
    upgrade('crackHtpasswd', { insight: 300 }, 258, ['clusterBomb']),
    whenNeeded('usernames', { data: 7 * megabytes }, 540),
    whenNeeded('dateFormats', { insight: 450 }, 560),
    whenUseful('fiber', { money: 16000 }, 5, ['customFuzzer'], [multiply('requestsPerThread', 3)]),
    whenNeeded('passwords', { data: 8 * megabytes }, 600),
    whenNeeded('latinList', { data: 9 * megabytes }, 610),
    whenUseful('customFuzzer', { insight: 550 }, 5, ['cable'], [multiply('threadsPerScript', 2)]),
    whenNeeded('subdomainScan', { insight: 500 }, 660),
    whenUseful('forumModerator', { money: 30000 }, 680, ['riddleForum'], [multiply('riddleRate', 2), multiply('riddleBotRate', 2)]),
    whenUseful('dataCenterRange', { money: 11000 }, 5, ['secondLeasedRange'], [add('rentableAddresses', 1024), cheaperAddresses]),
    whenNeeded('combinator', { insight: 550 }, 704),
    whenUseful('volumeDiscount', { money: 6000 }, 5, ['resellerAccount'], [multiply('addressRent', 0.8)]),
    whenUseful('pipelining', { insight: 900 }, 5, ['fiber'], [multiply('requestsPerThread', 2)]),
    whenUseful('secondDataCenterRange', { money: 19000 }, 5, ['dataCenterRange'], [add('rentableAddresses', 2048), cheaperAddresses]),
    whenUseful('regionalAllocation', { money: 22000 }, 5, ['secondDataCenterRange'], [add('rentableAddresses', 4096), cheaperAddresses]),
    whenUseful('secondRegionalAllocation', { money: 26000 }, 5, ['regionalAllocation'], [add('rentableAddresses', 8192), cheaperAddresses]),
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
