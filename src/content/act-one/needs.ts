import type { GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import { limitHoldsBack, networkCapacity } from './network.ts';
import { isNeeded, isUpgradeRevealed, markNeeded, owns } from './progress.ts';
import type { UpgradeId } from './text.ts';
import { offeredUpgrades, upgrades, type Upgrade } from './upgrades.ts';

type Trigger = (game: Game, item: Upgrade) => boolean;

const oneScriptStillFits: Trigger = (game, item) => {
    const modifiers = item.modifiers?.(1) ?? [];
    return game.statWith('threadsPerScript', modifiers) * game.statWith('requestsPerThread', modifiers) <= networkCapacity(game);
};
const aProxyHasDied: Trigger = (game) => game.state.flags['notice:firstProxyDeath'] === true;
const stoppedWhileAway: Trigger = (game) => game.state.flags.offlineCapReached === true;
const waitingFor = (resource: string): Trigger => (game) =>
    offeredUpgrades(game).some((item) => isUpgradeRevealed(game.state, item.id) && (item.price[resource] ?? 0) > (game.state.resources[resource] ?? 0));

// What has to be going on before a card that unlocks with whenUseful is offered.
const triggers: Readonly<Partial<Record<UpgradeId, Trigger>>> = {
    freeProxies: limitHoldsBack,
    proxyPool: limitHoldsBack,
    rentedAddresses: limitHoldsBack,
    proxyUptime: aProxyHasDied,
    keepAlive: oneScriptStillFits,
    isdn: oneScriptStillFits,
    threads8: oneScriptStillFits,
    adsl: oneScriptStillFits,
    cable: oneScriptStillFits,
    fiber: oneScriptStillFits,
    rssFeeds: waitingFor('data'),
    archives: waitingFor('data'),
    webCrawler: waitingFor('data'),
    riddleForum: waitingFor('insight'),
    forumModerator: waitingFor('insight'),
    leavePcOn: stoppedWhileAway,
};

const triggered = upgrades.flatMap((item) => {
    const trigger = triggers[item.id as UpgradeId];
    return trigger === undefined ? [] : [{ item, trigger }];
});

export const needs: GameSystem = {
    update(game) {
        const { state } = game;
        if (state.flags.automated !== true) return;
        for (const { item, trigger } of triggered) {
            if (isNeeded(state, item.id) || owns(state, item.id) || state.currentLevel < item.level) continue;
            if (item.requires.every((required) => owns(state, required)) && trigger(game, item)) markNeeded(state, item.id);
        }
    },
};
