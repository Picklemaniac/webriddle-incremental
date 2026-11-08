import type { GameContent, GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import { currentSearch, dirbuster } from './automation.ts';
import { answerCaptcha } from './captchas.ts';
import { assignJob, passiveIncome, scour, work } from './economy.ts';
import { findingDrops, findingModifiers } from './findings.ts';
import { entrance } from './levels.ts';
import { isBanned, network, networkCapacity, replaceProxy, requestedRate } from './network.ts';
import { canonicalUrl, resolvePage } from './pages.ts';
import { automationElapsed, isUpgradeRevealed, noticeOnce, owns, solveLevel } from './progress.ts';
import { startUrl } from './riddle.ts';
import { labels } from './text.ts';
import { offeredUpgrades, upgrades, type Upgrade } from './upgrades.ts';

const reveals: GameSystem = {
    update(game) {
        const { state } = game;
        if (!state.flags.automated) return;
        const seconds = automationElapsed(state);
        if (state.elapsedSeconds < (state.statistics.nextRevealAt ?? 0)) return;
        if (!state.flags.insightRevealed) {
            if (seconds < 45 || (state.resources.insight ?? 0) === 0) return;
            state.flags.insightRevealed = true;
            noticeOnce(game, 'insightRevealed');
        } else if (!isUpgradeRevealed(state, 'curlBatch')) {
            if (seconds < 90) return;
            revealUpgrade(game, 'curlBatch');
        } else if (!state.flags.moneyRevealed) {
            if (seconds < 135 || !owns(state, 'curlBatch')) return;
            reveal(game, 'moneyRevealed');
        } else if (state.flags.networkRevealed && !isUpgradeRevealed(state, 'throttle')) {
            revealUpgrade(game, 'throttle');
        } else if (!state.flags.scriptsRevealed && game.stat('scriptSlots') >= 2) {
            state.flags.scriptsRevealed = true;
            state.flags.machineRevealed = true;
            noticeOnce(game, 'scriptsRevealed');
        } else if (!state.flags.wordsRevealed && seconds >= 240 && state.currentLevel >= 10) {
            reveal(game, 'wordsRevealed');
        } else {
            if (seconds < 180) return;
            const offers = offeredUpgrades(state);
            if (offers.filter((item) => isUpgradeRevealed(state, item.id)).length >= (seconds < 600 ? 3 : 6)) return;
            const candidates = offers.filter((item) => !isUpgradeRevealed(state, item.id) && readyForUpgrade(game, item));
            const blocker = currentSearch(game).blockedBy;
            candidates.sort((first, second) => Number(second.fixes === blocker) - Number(first.fixes === blocker) ||
                Number(second.id === 'ram') - Number(first.id === 'ram'));
            const next = candidates[0];
            if (next === undefined) return;
            revealUpgrade(game, next.id);
        }
        reserveReveal(game);
    },
};

function readyForUpgrade(game: Game, item: Upgrade): boolean {
    const { state } = game;
    if (item.price.money !== undefined && !state.flags.moneyRevealed) return false;
    if (item.price.words !== undefined && !state.flags.wordsRevealed) return false;
    if (item.id === 'throttle') return state.flags.networkRevealed === true;
    if (item.id === 'wgetMirror') return state.flags.wordsRevealed === true && state.flags.scriptsRevealed === true;
    if (item.id === 'autoReplyMacros') return state.flags.scriptsRevealed === true;
    return true;
}

function revealUpgrade(game: Game, id: string): void {
    game.state.flags[`seen:${id}`] = true;
    game.state.flags.upgradesRevealed = true;
}

function reserveReveal(game: Game): void {
    const seconds = automationElapsed(game.state);
    game.state.statistics.nextRevealAt = game.state.elapsedSeconds + (seconds < 240 ? 45 : seconds < 600 ? 30 : 15);
}

const pacedNetwork: GameSystem = {
    update(game, seconds) {
        const revealed = game.state.flags.networkRevealed;
        if (!revealed && requestedRate(game) > networkCapacity(game) && game.state.elapsedSeconds < (game.state.statistics.nextRevealAt ?? 0)) return;
        network.update(game, seconds);
        if (!revealed && game.state.flags.networkRevealed) reserveReveal(game);
    },
};

const pacedFindings: GameSystem = {
    update(game, seconds) {
        const revealed = game.state.flags.findingsRevealed;
        if (!revealed) {
            if (automationElapsed(game.state) < 360) return;
            const due = (game.state.statistics.secondsSinceFind ?? 0) + seconds >= (game.state.statistics.nextFindAfter ?? Infinity);
            if (due && game.state.elapsedSeconds < (game.state.statistics.nextRevealAt ?? 0)) return;
        }
        findingDrops.update(game, seconds);
        if (!revealed && game.state.flags.findingsRevealed) reserveReveal(game);
    },
};

function reveal(game: Game, flag: 'moneyRevealed' | 'wordsRevealed'): void {
    game.state.flags[flag] = true;
    noticeOnce(game, flag);
}

export const actOneContent: GameContent = {
    tickSeconds: 0.25,
    startUrl,
    resources: [{ id: 'money', name: labels.money }, { id: 'words', name: labels.words }, { id: 'insight', name: labels.insight }],
    baseStats: { requestsPerThread: 2, threadsPerScript: 1, scriptSlots: 1, ticketValue: 3, scourValue: 25,
        ticketBotRate: 0.8, scraperRate: 12, proxySlots: 0, extraAddresses: 0, searchEfficiency: 1, dorkChance: 0 },
    purchasables: upgrades.map((item) => ({
        ...item, isAvailable: (state) => isUpgradeRevealed(state, item.id) && item.isAvailable(state) &&
            (item.id !== 'crackHtpasswd' || (state.findings.htpasswd ?? 0) > 0),
    })),
    milestones: [
        { id: 'automated', name: labels.automate, isReached: (state) => state.flags.automated === true },
        { id: 'firstUpgrade', name: 'First upgrade', isReached: (state) => Object.keys(state.purchases).length > 0 },
        ...[10, 50, 100, 200, 300, 500, 700, 1000].map((level) => ({ id: `level${level}`, name: `Level ${level}`, isReached: (state: Game['state']) => state.currentLevel >= level })),
    ],
    systems: [pacedNetwork, pacedFindings, reveals, passiveIncome, dirbuster],
    extraModifiers: findingModifiers,
    resolvePage,
    handleNavigation(game, address) {
        const url = canonicalUrl(address);
        game.state.browserUrl = url;
        const next = entrance(game.state.currentLevel + 1);
        if (!isBanned(game) && next.url === url && next.credentials === null) solveLevel(game, 'hand');
    },
    handleAction(game, action) {
        switch (action.type) {
            case 'automate':
                if (game.state.currentLevel < 5 || game.state.flags.automated) return false;
                game.state.flags.automated = true;
                game.state.statistics.automatedAt = game.state.elapsedSeconds;
                game.state.statistics.automationStartedAt = game.state.elapsedSeconds;
                game.state.statistics.nextRevealAt = game.state.elapsedSeconds + 45;
                return true;
            case 'work': return work(game);
            case 'scour': return scour(game);
            case 'assignJob': return assignJob(game, action.jobId, action.change);
            case 'replaceProxy': return replaceProxy(game, action.proxyIndex);
            case 'answerCaptcha': return answerCaptcha(game, action.answer);
            case 'submitCredentials': {
                const next = entrance(game.state.currentLevel + 1);
                if (isBanned(game) || canonicalUrl(action.url) !== next.url || !next.credentials) return false;
                if (action.username.toLowerCase().trim() !== next.credentials.username || action.password.toLowerCase().trim() !== next.credentials.password) return false;
                solveLevel(game, 'hand');
                game.state.browserUrl = next.url;
                return true;
            }
            case 'addFavorite':
                if (!game.state.favorites.includes(action.url)) game.state.favorites.push(action.url);
                return true;
            case 'setSound':
                game.state.settings.sound = action.enabled;
                return true;
            default: return false;
        }
    },
    offlineCapSeconds: (state) => (owns(state, 'leavePcOn') ? 24 : 12) * 3600,
};
