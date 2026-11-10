import type { GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import type { GameState } from '../../core/state.ts';
import { createCaptcha } from './captchas.ts';
import { dirbustingScripts, incomePerSecond, incomeWhileEarning, isAway } from './economy.ts';
import { increment, noticeOnce, owns } from './progress.ts';
import { upgrades } from './upgrades.ts';

export type ServerLoad = 'quiet' | 'normal' | 'busy';

export const ownAddress = '203.0.113.24';
const banSeconds = 300;
const heatPerOvershoot = 3;
const coolingPerSecond = 3;
const backOffHeat = 60;
const resumeHeat = 30;
const adaptiveMargin = 0.95;
const newBlockRentedShare = 0.5;
const startingRentShareOfIncome = 0.3;
const proxySeconds = 180;
const highestRateFactor = 2;
const trafficSettleSeconds = 60;
const trafficWaves: readonly { readonly periodSeconds: number; readonly swing: number }[] = [{ periodSeconds: 900, swing: 0.22 }, { periodSeconds: 340, swing: 0.08 }];
const busyBelow = 0.85;
const quietAbove = 1.15;

export function liveProxies(game: Game): number {
    return game.state.network.proxies.filter((proxy) => proxy.diesAtSeconds > game.state.elapsedSeconds).length;
}

export function rentedInUse(game: Game): number {
    return game.state.network.rentedAddresses * game.state.network.rentShare;
}

export function addressCount(game: Game): number {
    return 1 + liveProxies(game) + rentedInUse(game);
}

export function trafficFactor(state: GameState): number {
    const revealedAt = state.statistics.networkRevealedAt;
    const seconds = revealedAt === undefined ? 0 : state.elapsedSeconds - revealedAt - trafficSettleSeconds;
    if (seconds <= 0) return 1;
    return trafficWaves.reduce((factor, wave) => factor - wave.swing * Math.sin(2 * Math.PI * seconds / wave.periodSeconds), 1);
}

export function serverLoad(state: GameState): ServerLoad {
    const factor = trafficFactor(state);
    return factor < busyBelow ? 'busy' : factor > quietAbove ? 'quiet' : 'normal';
}

export function answeredPerAddress(game: Game): number {
    return game.stat('requestsPerAddress') * trafficFactor(game.state);
}

export function highestRatePerAddress(game: Game): number {
    return game.stat('requestsPerAddress') * highestRateFactor;
}

export function ratePerAddress(game: Game): number {
    return game.stat('requestsPerAddress') + game.state.network.rateChange;
}

export function serverTolerance(game: Game): number {
    return addressCount(game) * answeredPerAddress(game);
}

export function rentPerSecond(game: Game): number {
    return game.state.network.rentedAddresses * game.stat('addressRent');
}

export function rentedBlocks(game: Game): readonly { readonly range: string; readonly addresses: number; readonly rented: number }[] {
    const sizes = upgrades.filter((item) => owns(game.state, item.id))
        .flatMap((item) => (item.modifiers?.(1) ?? []).filter((modifier) => modifier.statId === 'rentableAddresses').map((modifier) => modifier.value));
    let unplaced = game.state.network.rentedAddresses;
    return sizes.map((addresses, index) => {
        const rented = Math.min(addresses, unplaced);
        unplaced -= rented;
        return { range: `198.18.${index * 4}.0/${32 - Math.log2(addresses)}`, addresses, rented };
    });
}

export function requestedRate(game: Game): number {
    return dirbustingScripts(game) * game.stat('threadsPerScript') * game.stat('requestsPerThread');
}

export function isBanned(game: Game): boolean {
    return game.state.network.bannedUntil > game.state.elapsedSeconds;
}

export function isAdaptive(game: Game): boolean {
    return owns(game.state, 'adaptiveRate');
}

export function sentRate(game: Game): number {
    if (isBanned(game)) return 0;
    const requested = requestedRate(game);
    const tolerance = serverTolerance(game);
    if (game.state.flags.networkRevealed !== true) return Math.min(requested, tolerance);
    if (isAdaptive(game)) return Math.min(requested, tolerance * adaptiveMargin);
    const limited = Math.min(requested, ratePerAddress(game) * addressCount(game));
    return game.state.flags.backingOff === true ? Math.min(limited, tolerance) : limited;
}

export function answeredRate(game: Game): number {
    const sent = sentRate(game);
    const tolerance = serverTolerance(game);
    return sent <= tolerance ? sent : tolerance * tolerance / sent;
}

export function setRatePerAddress(game: Game, rate: number): boolean {
    if (!Number.isInteger(rate) || rate < 1 || rate > highestRatePerAddress(game) || rate === ratePerAddress(game)) return false;
    game.state.network.rateChange = rate - game.stat('requestsPerAddress');
    return true;
}

export function setRentedAddresses(game: Game, count: number): boolean {
    if (!Number.isInteger(count) || count < 0 || count > game.stat('rentableAddresses') || count === game.state.network.rentedAddresses) return false;
    game.state.network.rentedAddresses = count;
    return true;
}

export function replaceProxy(game: Game, proxyIndex: number): boolean {
    if (!Number.isInteger(proxyIndex) || proxyIndex < 0 || proxyIndex >= game.stat('proxySlots')) return false;
    const existing = game.state.network.proxies[proxyIndex];
    if (existing && existing.diesAtSeconds > game.state.elapsedSeconds) return false;
    game.state.network.proxies[proxyIndex] = {
        address: `192.0.2.${1 + Math.floor(game.random() * 253)}:${8000 + Math.floor(game.random() * 1000)}`,
        latencyMilliseconds: 60 + Math.floor(game.random() * 180),
        diesAtSeconds: game.state.elapsedSeconds + (proxySeconds + game.random() * proxySeconds) * game.stat('proxyLifetime'),
    };
    return true;
}

function rentPartOfNewBlocks(game: Game): void {
    const { network } = game.state;
    const rentable = game.stat('rentableAddresses');
    if (rentable <= network.knownRentable) return;
    const newlyOffered = Math.round((rentable - network.knownRentable) * newBlockRentedShare);
    const affordable = Math.floor(incomeWhileEarning(game, 'money') * startingRentShareOfIncome / game.stat('addressRent'));
    network.rentedAddresses += Math.max(0, Math.min(newlyOffered, affordable - network.rentedAddresses));
    network.knownRentable = rentable;
}

export const rent: GameSystem = {
    update(game, deltaSeconds) {
        const { state } = game;
        rentPartOfNewBlocks(game);
        const due = rentPerSecond(game) * deltaSeconds;
        if (due === 0) {
            state.network.rentShare = 1;
            return;
        }
        const away = isAway(state);
        const paid = Math.min(due, away ? incomePerSecond(game, 'money') * deltaSeconds : state.resources.money ?? 0);
        if (!away) state.resources.money = (state.resources.money ?? 0) - paid;
        state.network.rentShare = paid / due;
        increment(state, 'rentPaid', paid);
    },
};

export const network: GameSystem = {
    update(game, deltaSeconds) {
        const { state } = game;
        for (let index = 0; index < game.stat('proxySlots'); index++) {
            const proxy = state.network.proxies[index];
            if (!proxy || (owns(state, 'proxyChecker') && proxy.diesAtSeconds + 10 <= state.elapsedSeconds)) {
                replaceProxy(game, index);
            } else if (proxy.diesAtSeconds <= state.elapsedSeconds && proxy.diesAtSeconds > state.elapsedSeconds - deltaSeconds) {
                noticeOnce(game, 'firstProxyDeath');
                game.announce({ type: 'proxyDied' });
            }
        }
        if (state.captcha !== null && !isBanned(game)) {
            state.captcha = null;
            state.network.heat = 0;
            state.flags.captchaRejected = false;
            game.announce({ type: 'unbanned', byCaptcha: false });
        }
        if (!state.flags.automated || isBanned(game)) return;
        const tolerance = serverTolerance(game);
        if (state.flags.networkRevealed !== true) {
            if (requestedRate(game) <= tolerance) return;
            state.flags.networkRevealed = true;
            state.statistics.networkRevealedAt = state.elapsedSeconds;
        }
        const overshoot = Math.max(0, sentRate(game) / tolerance - 1);
        if (overshoot > 0) noticeOnce(game, 'firstRateLimit');
        state.network.heat = Math.max(0, state.network.heat + deltaSeconds * (overshoot > 0 ? heatPerOvershoot * overshoot : -coolingPerSecond));
        if (owns(state, 'throttle')) {
            if (state.network.heat >= backOffHeat) state.flags.backingOff = true;
            else if (state.network.heat <= resumeHeat) state.flags.backingOff = false;
        }
        if (state.network.heat >= 100) {
            state.network.heat = 100;
            state.network.bannedUntil = state.elapsedSeconds + banSeconds;
            state.captcha = createCaptcha(game);
            increment(state, 'bans');
            noticeOnce(game, 'firstBan');
            game.announce({ type: 'banned' });
        }
    },
};
