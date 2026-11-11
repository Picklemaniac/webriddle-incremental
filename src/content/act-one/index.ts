import type { GameContent, GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import { currentSearch, dirbuster } from './automation.ts';
import { answerCaptcha } from './captchas.ts';
import { assignJob, isResourceRevealed, passiveIncome, setActivity } from './economy.ts';
import { findingDrops, findingModifiers, findingsEnabled } from './findings.ts';
import { entrance } from './levels.ts';
import { needs } from './needs.ts';
import { isBanned, network, networkCapacity, rent, replaceProxy, requestedRate, setRentedAddresses, setThrottle, showsTheLimit } from './network.ts';
import { canonicalUrl, resolvePage } from './pages.ts';
import { automationElapsed, automationLevel, isUpgradeRevealed, owns, solveLevel } from './progress.ts';
import { homeUrl, startUrl } from './riddle.ts';
import { labels } from './text.ts';
import { capacityUpgrades, offeredUpgrades, upgrades, type Upgrade } from './upgrades.ts';

type CurrencyFlag = 'insightRevealed' | 'moneyRevealed' | 'dataRevealed';

const firstRevealDelaySeconds = 45;
const firstOfferSeconds = 75;
const currencyFollowSeconds = 6;
const moneyIntroductionSeconds = 135;
const regularOffersSeconds = 180;
const introductionSeconds = 600;
const earlyOfferLimit = 3;
const laterOfferLimit = 6;
const firstFindingSeconds = 360;
const rememberedPages = 100;
const firstJobUpgrade = 'otherRiddles';

const reveals: GameSystem = {
    update(game) {
        const { state } = game;
        if (!state.flags.automated) return;
        if (!state.flags.scriptsRevealed && game.stat('scriptSlots') >= 2) {
            state.flags.scriptsRevealed = true;
            state.flags.machineRevealed = true;
            revealUpgrade(game, firstJobUpgrade);
            reserveReveal(game);
            return;
        }
        if (state.elapsedSeconds < nextRevealAt(game)) return;
        const seconds = automationElapsed(state);
        if (!isUpgradeRevealed(state, 'curlBatch')) {
            if (seconds >= firstOfferSeconds) revealBeforeCurrency(game, 'curlBatch');
            return;
        }
        if (!state.flags.insightRevealed) {
            state.flags.insightRevealed = true;
        } else if (!state.flags.moneyRevealed && seconds >= moneyIntroductionSeconds && owns(state, 'curlBatch')) {
            if (!revealWithCurrency(game, 'ram', 'moneyRevealed')) return;
        } else if (!state.flags.dataRevealed && state.flags.wordlistExhausted === true) {
            if (!revealWithCurrency(game, 'english10k', 'dataRevealed')) return;
        } else if (!revealNextOffer(game, seconds)) {
            return;
        }
        reserveReveal(game);
    },
};

function revealWithCurrency(game: Game, upgradeId: string, currency: CurrencyFlag): boolean {
    if (!isUpgradeRevealed(game.state, upgradeId)) {
        revealBeforeCurrency(game, upgradeId);
        return false;
    }
    game.state.flags[currency] = true;
    return true;
}

function revealNextOffer(game: Game, seconds: number): boolean {
    const { state } = game;
    if (seconds < regularOffersSeconds) return false;
    const offers = offeredUpgrades(game);
    const shownLimit = seconds < introductionSeconds ? earlyOfferLimit : laterOfferLimit;
    if (offers.filter((item) => isUpgradeRevealed(state, item.id)).length >= shownLimit) return false;
    const candidates = offers.filter((item) => !isUpgradeRevealed(state, item.id) && readyForUpgrade(game, item));
    const { missing } = currentSearch(game);
    const fixesWall = (item: Upgrade): number => Number(missing.includes(item.id));
    const capped = requestedRate(game) > networkCapacity(game);
    candidates.sort((first, second) => fixesWall(second) - fixesWall(first) || Number(second.onNeed) - Number(first.onNeed) ||
        Number(capped && capacityUpgrades.has(second.id)) - Number(capped && capacityUpgrades.has(first.id)) ||
        Number(second.id === 'ram') - Number(first.id === 'ram'));
    const next = candidates[0];
    if (next === undefined) return false;
    revealUpgrade(game, next.id);
    return true;
}

function readyForUpgrade(game: Game, item: Upgrade): boolean {
    const { state } = game;
    if (!Object.keys(item.price).every((resource) => isResourceRevealed(game, resource))) return false;
    if (item.id === 'throttle') return state.flags.networkRevealed === true;
    if (item.id === 'wgetMirror') return state.flags.dataRevealed === true && state.flags.scriptsRevealed === true;
    if (item.id === 'autoReplyMacros' || item.id === 'otherRiddles') return state.flags.scriptsRevealed === true;
    return true;
}

function revealUpgrade(game: Game, id: string): void {
    game.state.flags[`seen:${id}`] = true;
    game.state.flags.upgradesRevealed = true;
}

function revealBeforeCurrency(game: Game, id: string): void {
    revealUpgrade(game, id);
    game.state.statistics.nextRevealAt = game.state.elapsedSeconds + currencyFollowSeconds;
}

function nextRevealAt(game: Game): number {
    return game.state.statistics.nextRevealAt ?? 0;
}

function reserveReveal(game: Game): void {
    const seconds = automationElapsed(game.state);
    game.state.statistics.nextRevealAt = game.state.elapsedSeconds + (seconds < 240 ? 45 : seconds < introductionSeconds ? 30 : 15);
}

const pacedNetwork: GameSystem = {
    update(game, seconds) {
        const revealed = game.state.flags.networkRevealed;
        const scriptsPending = !game.state.flags.scriptsRevealed && game.stat('scriptSlots') >= 2;
        if (!revealed && showsTheLimit(game) && (scriptsPending || game.state.elapsedSeconds < nextRevealAt(game))) return;
        network.update(game, seconds);
        if (!revealed && game.state.flags.networkRevealed) reserveReveal(game);
    },
};

const pacedFindings: GameSystem = {
    update(game, seconds) {
        if (!findingsEnabled) return;
        const revealed = game.state.flags.findingsRevealed;
        if (!revealed) {
            if (automationElapsed(game.state) < firstFindingSeconds) return;
            const due = (game.state.statistics.secondsSinceFind ?? 0) + seconds >= (game.state.statistics.nextFindAfter ?? Infinity);
            if (due && game.state.elapsedSeconds < nextRevealAt(game)) return;
        }
        findingDrops.update(game, seconds);
        if (!revealed && game.state.flags.findingsRevealed) reserveReveal(game);
    },
};

export const actOneContent: GameContent = {
    tickSeconds: 0.25,
    homeUrl,
    startUrl,
    resources: [{ id: 'insight', name: labels.insight }, { id: 'money', name: labels.money }, { id: 'data', name: labels.data }],
    baseStats: { requestsPerThread: 2, threadsPerScript: 1, scriptSlots: 1, riddleRate: 0.3, workRate: 1, scourRate: 1024,
        ticketBotRate: 0.7, riddleBotRate: 0.3, scraperRate: 1024, proxySlots: 0, proxyLifetime: 1, rentableAddresses: 0, addressRent: 0.24, searchEfficiency: 1, dorkChance: 0 },
    purchasables: upgrades.map((item) => ({
        ...item, isAvailable: (state) => isUpgradeRevealed(state, item.id) && item.isAvailable(state),
    })),
    milestones: [
        { id: 'automated', name: 'Automate', isReached: (state) => state.flags.automated === true },
        { id: 'firstUpgrade', name: 'First upgrade', isReached: (state) => Object.keys(state.purchases).length > 0 },
        ...[10, 50, 100, 200, 300, 500, 700, 1000].map((level) => ({ id: `level${level}`, name: `Level ${level}`, isReached: (state: Game['state']) => state.currentLevel >= level })),
    ],
    systems: [passiveIncome, rent, pacedNetwork, pacedFindings, needs, reveals, dirbuster],
    extraModifiers: findingModifiers,
    resolvePage,
    handleNavigation(game, address) {
        const url = canonicalUrl(address);
        game.state.browserUrl = url;
        rememberVisit(game.state, url);
        if (url === startUrl) game.state.flags.entered = true;
        const next = entrance(game.state.currentLevel + 1);
        if (!isBanned(game) && next.url === url && next.credentials === null) solveLevel(game, 'hand');
    },
    handleAction(game, action) {
        switch (action.type) {
            case 'automate':
                if (game.state.currentLevel < automationLevel || game.state.flags.automated) return false;
                game.state.flags.automated = true;
                game.state.statistics.automatedAt = game.state.elapsedSeconds;
                game.state.statistics.nextRevealAt = game.state.elapsedSeconds + firstRevealDelaySeconds;
                return true;
            case 'setActivity': return setActivity(game, action.activity);
            case 'setThrottle': return setThrottle(game, action.enabled);
            case 'setRentedAddresses': return setRentedAddresses(game, action.count);
            case 'assignJob': return assignJob(game, action.jobId, action.change);
            case 'replaceProxy': return replaceProxy(game, action.proxyIndex);
            case 'answerCaptcha': return answerCaptcha(game, action.answer);
            case 'submitCredentials': {
                const next = entrance(game.state.currentLevel + 1);
                if (isBanned(game) || canonicalUrl(action.url) !== next.url || !next.credentials) return false;
                if (action.username.toLowerCase().trim() !== next.credentials.username || action.password.toLowerCase().trim() !== next.credentials.password) return false;
                solveLevel(game, 'hand');
                game.state.browserUrl = next.url;
                rememberVisit(game.state, next.url);
                return true;
            }
            case 'addFavorite':
                if (!game.state.favorites.includes(action.url)) game.state.favorites.push(action.url);
                return true;
            case 'setHomePage':
                game.state.homePage = canonicalUrl(action.url);
                return true;
            case 'clearHistory':
                game.state.history = [];
                return true;
            case 'removeFavorite': {
                const index = game.state.favorites.indexOf(action.url);
                if (index === -1) return false;
                game.state.favorites.splice(index, 1);
                return true;
            }
            default: return false;
        }
    },
    offlineCapSeconds: (state) => (owns(state, 'leavePcOn') ? 24 : 12) * 3600,
};

function rememberVisit(state: Game['state'], url: string): void {
    state.history = [...state.history.filter((visited) => visited !== url), url].slice(-rememberedPages);
}
