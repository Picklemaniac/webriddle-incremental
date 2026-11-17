import type { GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import { incomeWhileEarning } from './economy.ts';
import { limitHoldsBack, networkCapacity, rentedInUse, rentsEveryAddress } from './network.ts';
import { increment, isNeeded, isUpgradeRevealed, markNeeded, owns } from './progress.ts';
import type { UpgradeId } from './text.ts';
import { offeredUpgrades, upgrades, type Upgrade } from './upgrades.ts';

type Condition = (game: Game, item: Upgrade) => boolean;

// What has to be going on before a card that unlocks with whenUseful is offered.
// A condition that something passing can set off has to hold for a while in total: a sweep of the rent slider, or a proxy that has just died.
interface Trigger {
    readonly holds: Condition;
    readonly forSeconds?: number;
    // A cause that does not have to last, such as a ban.
    readonly atOnceWhen?: Condition;
    // Set when only the rent slider can set the condition off by accident. Before there is a slider, the card comes at once.
    readonly onlyWithRentSlider?: true;
}

const settledSeconds = 60;
const shortOfRoomSeconds = 30;
const withoutABanSeconds = 180;
const proxyDeathsBeforeLongerLives = 6;
const bansBeforeThrottle = 2;
const replacementsBeforeChecker = 20;
const addressesForResellers = 50;
const addressesForVolume = 500;
const longWaitSeconds = 180;

// A faster script is only of use when the limit leaves room to run more than one of them.
const scriptsThatMustFit = 2;
const twoScriptsStillFit: Condition = (game, item) => {
    const modifiers = item.modifiers?.(1) ?? [];
    return scriptsThatMustFit * game.statWith('threadsPerScript', modifiers) * game.statWith('requestsPerThread', modifiers) <= networkCapacity(game);
};
const everyAddressIsInUse: Condition = (game) => rentsEveryAddress(game) && limitHoldsBack(game);
const proxiesKeepDying: Condition = (game) => (game.state.statistics.proxyDeaths ?? 0) >= proxyDeathsBeforeLongerLives;
const stoppedWhileAway: Condition = (game) => game.state.flags.offlineCapReached === true;
const hasBeenBanned: Condition = (game) => (game.state.statistics.bans ?? 0) > 0;
const hasBeenBannedAgain: Condition = (game) => (game.state.statistics.bans ?? 0) >= bansBeforeThrottle;
const hasReplacedManyProxies: Condition = (game) => (game.state.statistics.proxiesReplacedByHand ?? 0) >= replacementsBeforeChecker;
const rentsAtLeast = (addresses: number): Condition => (game) => rentedInUse(game) >= addresses;
// A card on screen costs more than the player has and would earn in the next few minutes.
const shortOf = (resource: string): Condition => (game) => {
    const withinReach = (game.state.resources[resource] ?? 0) + incomeWhileEarning(game, resource) * longWaitSeconds;
    return offeredUpgrades(game).some((item) => isUpgradeRevealed(game.state, item.id) && (item.price[resource] ?? 0) > withinReach);
};

const whenTheLimitHoldsBack: Trigger = { holds: limitHoldsBack, forSeconds: shortOfRoomSeconds };
const whenEveryAddressIsInUse: Trigger = { holds: everyAddressIsInUse, forSeconds: settledSeconds };
const whenTwoScriptsStillFit: Trigger = { holds: twoScriptsStillFit, forSeconds: settledSeconds, onlyWithRentSlider: true };
const whenShortOfData: Trigger = { holds: shortOf('data') };
const whenShortOfInsight: Trigger = { holds: shortOf('insight') };

const triggers: Readonly<Partial<Record<UpgradeId, Trigger>>> = {
    // The first card for the limit answers the first ban. A player who stays clear of bans is not left without it.
    freeProxies: { holds: limitHoldsBack, forSeconds: withoutABanSeconds, atOnceWhen: hasBeenBanned },
    openWifi: whenTheLimitHoldsBack,
    proxyPool: whenTheLimitHoldsBack,
    rentedAddresses: whenTheLimitHoldsBack,
    addressBlock: whenEveryAddressIsInUse,
    secondAddressBlock: whenEveryAddressIsInUse,
    thirdAddressBlock: whenEveryAddressIsInUse,
    leasedRange: whenEveryAddressIsInUse,
    secondLeasedRange: whenEveryAddressIsInUse,
    dataCenterRange: whenEveryAddressIsInUse,
    secondDataCenterRange: whenEveryAddressIsInUse,
    regionalAllocation: whenEveryAddressIsInUse,
    secondRegionalAllocation: whenEveryAddressIsInUse,
    thirdRegionalAllocation: whenEveryAddressIsInUse,
    proxyUptime: { holds: proxiesKeepDying },
    // Relief comes after the chore: the switch that ends Heat after a second ban, and the checker after twenty proxies replaced by hand.
    throttle: { holds: hasBeenBannedAgain },
    proxyChecker: { holds: hasReplacedManyProxies },
    resellerAccount: { holds: rentsAtLeast(addressesForResellers), forSeconds: settledSeconds },
    volumeDiscount: { holds: rentsAtLeast(addressesForVolume), forSeconds: settledSeconds },
    keepAlive: whenTwoScriptsStillFit,
    isdn: whenTwoScriptsStillFit,
    threads8: whenTwoScriptsStillFit,
    adsl: whenTwoScriptsStillFit,
    cable: whenTwoScriptsStillFit,
    fiber: whenTwoScriptsStillFit,
    gobuster: whenTwoScriptsStillFit,
    ffuf: whenTwoScriptsStillFit,
    customFuzzer: whenTwoScriptsStillFit,
    pipelining: whenTwoScriptsStillFit,
    rssFeeds: whenShortOfData,
    archives: whenShortOfData,
    webCrawler: whenShortOfData,
    riddleForum: whenShortOfInsight,
    forumModerator: whenShortOfInsight,
    leaveItRunning: { holds: stoppedWhileAway },
};

const triggered = upgrades.flatMap((item) => {
    const trigger = triggers[item.id as UpgradeId];
    return trigger === undefined ? [] : [{ item, trigger }];
});

export const needs: GameSystem = {
    update(game, deltaSeconds) {
        const { state } = game;
        if (state.flags.automated !== true) return;
        for (const { item, trigger } of triggered) {
            if (isNeeded(state, item.id) || owns(state, item.id) || state.currentLevel < item.level) continue;
            if (!item.requires.every((required) => owns(state, required))) continue;
            if (trigger.atOnceWhen?.(game, item) === true || hasHeld(game, item, trigger, deltaSeconds)) markNeeded(state, item.id);
        }
    },
};

function hasHeld(game: Game, item: Upgrade, trigger: Trigger, deltaSeconds: number): boolean {
    if (!trigger.holds(game, item)) return false;
    if (trigger.forSeconds === undefined || (trigger.onlyWithRentSlider === true && game.stat('rentableAddresses') === 0)) return true;
    const held = `heldSeconds:${item.id}`;
    increment(game.state, held, deltaSeconds);
    return game.state.statistics[held]! >= trigger.forSeconds;
}
