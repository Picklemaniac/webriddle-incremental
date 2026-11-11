import type { GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import { createCaptcha } from './captchas.ts';
import { dirbustingScripts, incomePerSecond, isAway } from './economy.ts';
import { increment, markNeeded, noticeOnce, owns } from './progress.ts';
import { laterAddressBlocks, upgrades } from './upgrades.ts';

export const requestsPerAddress = 10;
export const ownAddress = '203.0.113.24';
export const highestRentBudget = 0.75;
export const rentBudgetStep = 0.05;
const banSeconds = 300;
const heatPerExcessRatio = 3;
const coolingPerSecond = 3;
const proxySeconds = 180;

export function liveProxies(game: Game): number {
    return game.state.network.proxies.filter((proxy) => proxy.diesAtSeconds > game.state.elapsedSeconds).length;
}

function affordableAddresses(game: Game): number {
    return Math.floor(game.state.network.rentBudget * incomePerSecond(game, 'money') / game.stat('addressRent'));
}

export function rentedAddresses(game: Game): number {
    return Math.min(game.stat('rentableAddresses'), affordableAddresses(game));
}

export function isRentCapped(game: Game): boolean {
    const rentable = game.stat('rentableAddresses');
    return rentable > 0 && affordableAddresses(game) > rentable;
}

export function addressCount(game: Game): number {
    return 1 + liveProxies(game) + rentedAddresses(game);
}

export function networkCapacity(game: Game): number {
    return requestsPerAddress * addressCount(game);
}

export function rentPerSecond(game: Game): number {
    return rentedAddresses(game) * game.stat('addressRent');
}

export function rentedBlocks(game: Game): readonly { readonly range: string; readonly addresses: number; readonly rented: number }[] {
    const sizes = upgrades.filter((item) => owns(game.state, item.id))
        .flatMap((item) => (item.modifiers?.(1) ?? []).filter((modifier) => modifier.statId === 'rentableAddresses').map((modifier) => modifier.value));
    let unplaced = rentedAddresses(game);
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

export function isThrottled(game: Game): boolean {
    return owns(game.state, 'throttle') && game.state.flags.throttleOff !== true;
}

export function effectiveRate(game: Game): number {
    if (isBanned(game)) return 0;
    const capped = isThrottled(game) || game.state.flags.networkRevealed !== true;
    return capped ? Math.min(requestedRate(game), networkCapacity(game)) : requestedRate(game);
}

export function setThrottle(game: Game, enabled: boolean): boolean {
    if (!owns(game.state, 'throttle') || isThrottled(game) === enabled) return false;
    game.state.flags.throttleOff = !enabled;
    return true;
}

export function setRentBudget(game: Game, share: number): boolean {
    const steps = share / rentBudgetStep;
    if (!Number.isFinite(share) || share < 0 || share > highestRentBudget + 1e-9 || Math.abs(steps - Math.round(steps)) > 1e-9) return false;
    const budget = Math.round(steps) * rentBudgetStep;
    if (Math.abs(budget - game.state.network.rentBudget) < 1e-9) return false;
    game.state.network.rentBudget = budget;
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

export const rent: GameSystem = {
    update(game, deltaSeconds) {
        const { state } = game;
        if (isRentCapped(game)) {
            const nextBlock = laterAddressBlocks.find((id) => !owns(state, id));
            if (nextBlock !== undefined) markNeeded(state, nextBlock);
        }
        const paid = rentPerSecond(game) * deltaSeconds;
        if (paid === 0) return;
        // While the player is away the jobs do not pay out, and what they would earn covers the rent.
        if (!isAway(state)) state.resources.money = (state.resources.money ?? 0) - paid;
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
        const capacity = networkCapacity(game);
        const excess = Math.max(0, requestedRate(game) - capacity);
        if (excess > 0) {
            state.flags.networkRevealed = true;
            noticeOnce(game, 'firstRateLimit');
        }
        const overLimit = excess > 0 && !isThrottled(game);
        state.network.heat = Math.max(0, state.network.heat + deltaSeconds * (overLimit ? heatPerExcessRatio * excess / capacity : -coolingPerSecond));
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
