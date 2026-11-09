import type { GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import { createCaptcha } from './captchas.ts';
import { dirbustingScripts } from './economy.ts';
import { increment, noticeOnce, owns } from './progress.ts';
import { upgrades } from './upgrades.ts';

export const requestsPerAddress = 10;
export const ownAddress = '203.0.113.24';
const banSeconds = 300;
const heatPerExcessRatio = 3;

export function liveProxies(game: Game): number {
    return game.state.network.proxies.filter((proxy) => proxy.diesAtSeconds > game.state.elapsedSeconds).length;
}

export function addressCount(game: Game): number {
    return 1 + liveProxies(game) + game.stat('extraAddresses');
}

export function networkCapacity(game: Game): number {
    return requestsPerAddress * addressCount(game);
}

export function rentedBlocks(game: Game): readonly { readonly range: string; readonly addresses: number }[] {
    const sizes = upgrades.filter((item) => owns(game.state, item.id))
        .flatMap((item) => (item.modifiers?.(1) ?? []).filter((modifier) => modifier.statId === 'extraAddresses').map((modifier) => modifier.value));
    return sizes.map((addresses, index) => ({ range: `198.18.${index * 2}.0/${32 - Math.log2(addresses)}`, addresses }));
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

export function replaceProxy(game: Game, proxyIndex: number): boolean {
    if (!Number.isInteger(proxyIndex) || proxyIndex < 0 || proxyIndex >= game.stat('proxySlots')) return false;
    const existing = game.state.network.proxies[proxyIndex];
    if (existing && existing.diesAtSeconds > game.state.elapsedSeconds) return false;
    game.state.network.proxies[proxyIndex] = {
        address: `192.0.2.${1 + Math.floor(game.random() * 253)}:${8000 + Math.floor(game.random() * 1000)}`,
        latencyMilliseconds: 60 + Math.floor(game.random() * 180),
        diesAtSeconds: game.state.elapsedSeconds + 180 + game.random() * 180,
    };
    return true;
}

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
        state.network.heat = Math.max(0, state.network.heat + deltaSeconds * (overLimit ? heatPerExcessRatio * excess / capacity : -3));
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
