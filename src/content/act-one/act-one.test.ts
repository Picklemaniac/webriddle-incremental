import { describe, expect, it } from 'vitest';
import { Game } from '../../core/game.ts';
import { createInitialState } from '../../core/state.ts';
import { parseSave, serializeSave } from '../../persistence/save.ts';
import { actOneContent } from './index.ts';
import { entrance, levelPage, urlOfLevel } from './levels.ts';
import { nordinhoTopicUrl } from './riddle.ts';
import { createCaptcha } from './captchas.ts';
import { effectiveRate, networkCapacity } from './network.ts';
import { planSearch, searchCapabilities } from './search.ts';
import { actOneStrategy } from '../../simulation/act-one-strategy.ts';
import { AutoPlayer } from '../../simulation/auto-player.ts';

function newGame(seed = 1): Game { return new Game(actOneContent, createInitialState(actOneContent, seed)); }
function handSolve(game: Game): boolean {
    const target = entrance(game.state.currentLevel + 1);
    return target.credentials ? game.dispatch({ type: 'submitCredentials', url: target.url, ...target.credentials }) : game.dispatch({ type: 'navigate', url: target.url });
}

describe('Act I', () => {
    it('starts by hand, unlocks automation at five, and counts each solve once', () => {
        const game = newGame();
        expect(game.dispatch({ type: 'automate' })).toBe(false);
        game.advance(3600);
        expect(game.state.currentLevel).toBe(1);
        for (let level = 1; level < 5; level++) handSolve(game);
        game.dispatch({ type: 'navigate', url: urlOfLevel(4) });
        expect(game.state.currentLevel).toBe(5);
        expect(game.state.statistics.handSolves).toBe(4);
        expect(game.dispatch({ type: 'automate' })).toBe(true);
        game.advance(4);
        expect(game.state.currentLevel).toBe(5);
        expect(game.state.search.requestsSpent).toBe(0);
        game.advance(43);
        expect(game.state.currentLevel).toBeGreaterThanOrEqual(6);
    });

    it('uses URL, source, cipher, and hidden-text clues in the opening', () => {
        expect(urlOfLevel(1)).toMatch(/beginning\.htm$/);
        expect(levelPage(1).link).toMatch(/level2\.htm$/);
        expect(levelPage(3).comments).toEqual(['beneath.htm']);
        expect(levelPage(4).hiddenText).toBe('lighthouse');
        expect(levelPage(5).lines.join(' ')).toBe('01101101 01101001 01100100 01101110 01101001 01100111 01101000 01110100');
        expect(levelPage(6).imageName).toBe('present.jpg');
        expect(levelPage(8).lines).toEqual(['zveebe']);
        expect(levelPage(9).lines).toEqual(['ksud']);
        expect(entrance(6).kind).toBe('word');
        for (let level = 1; level <= 9; level++) expect(gamePage(level).html).toContain(`<span class="number">${level}</span>`);
    });

    it('keeps query strings on community sites but canonicalizes riddle addresses', () => {
        const game = newGame();
        game.dispatch({ type: 'navigate', url: `${nordinhoTopicUrl}?t=4211` });
        expect(game.state.browserUrl).toBe(`${nordinhoTopicUrl}?t=4211`);
        expect(game.content.resolvePage(game.state.browserUrl, game.state).statusCode).toBe(200);
        game.dispatch({ type: 'navigate', url: `${urlOfLevel(1).toUpperCase()}?from=nordinho` });
        expect(game.state.browserUrl).toBe(urlOfLevel(1));
    });

    it('generates unique stable URLs and a usable clue on every page through the wall', () => {
        const urls = new Set<string>();
        for (let level = 1; level <= 1400; level++) {
            const url = urlOfLevel(level);
            expect(urls.has(url), `duplicate at ${level}: ${url}`).toBe(false);
            urls.add(url);
            const page = levelPage(level);
            expect(page.imageId).toBeGreaterThanOrEqual(0);
            expect(gamePage(level).html).toContain('<title>');
        }
        expect(entrance(1150)).toEqual(structuredClone(entrance(1150)));
        expect(levelPage(99).comments).toContain('new levels go in /amber/');
    });

    it('keeps all generated levels solvable by hand, including credentials', () => {
        const game = newGame();
        for (let level = 1; level < 1250; level++) {
            handSolve(game);
            expect(game.state.currentLevel).toBe(level + 1);
            expect(game.content.resolvePage(game.state.browserUrl, game.state).statusCode).toBe(200);
        }
        expect(game.state.statistics.handSolves).toBe(1249);
        expect(game.state.flags.automated).not.toBe(true);
    });

    it('requires exact credentials and does not reward wrong passwords', () => {
        const game = newGame();
        const level = Array.from({ length: 400 }, (_, index) => index + 500).find((level) => entrance(level).credentials !== null)!;
        game.state.currentLevel = level - 1;
        const target = entrance(level);
        game.dispatch({ type: 'navigate', url: target.url });
        expect(game.content.resolvePage(target.url, game.state).statusCode).toBe(401);
        expect(game.dispatch({ type: 'submitCredentials', url: target.url, username: 'wrong', password: 'wrong' })).toBe(false);
        handSolve(game);
        expect(game.state.currentLevel).toBe(level);
    });

    it('bans excessive traffic, accepts the actual captcha, and supports waiting it out', () => {
        const game = newGame();
        game.state.currentLevel = 5;
        game.dispatch({ type: 'automate' });
        game.state.purchases.curlBatch = 1;
        game.state.purchases.keepAlive = 1;
        game.invalidateStats();
        game.advance(150);
        expect(game.state.captcha).not.toBeNull();
        expect(effectiveRate(game)).toBe(0);
        game.dispatch({ type: 'answerCaptcha', answer: '' });
        game.dispatch({ type: 'answerCaptcha', answer: 'wrong' });
        expect(game.state.captcha).not.toBeNull();
        const challenge = game.state.captcha!;
        game.dispatch({ type: 'answerCaptcha', answer: challenge.kind === 'text' ? challenge.word : challenge.correctTiles.join(',') });
        expect(game.state.captcha).toBeNull();
        game.state.purchases.throttle = 1;
        game.invalidateStats();
        game.advance(200);
        expect(game.state.captcha).toBeNull();
        expect(effectiveRate(game)).toBeLessThanOrEqual(networkCapacity(game));
        game.state.captcha = createCaptcha(game);
        game.state.network.bannedUntil = game.state.elapsedSeconds + 90;
        game.advance(91);
        expect(game.state.captcha).toBeNull();
    });

    it('resumes saved search progress, random drops, proxies and economy identically', () => {
        const game = newGame(9);
        const robot = new AutoPlayer(actOneStrategy(2));
        robot.playUntil(game, () => game.state.currentLevel >= 100, 3600);
        const restored = new Game(actOneContent, parseSave(serializeSave(game.state, 0), createInitialState(actOneContent, 99)).state);
        game.advance(600);
        restored.catchUp(600);
        expect(restored.state).toEqual(game.state);
    });

    it('uses identical gameplay ticks in a live tab and offline, including a saved fractional tick', () => {
        const live = newGame(2);
        live.state.currentLevel = 650;
        live.state.browserUrl = urlOfLevel(650);
        live.state.flags.automated = true;
        for (const item of actOneContent.purchasables) live.state.purchases[item.id] = 1;
        live.state.jobs = { ticketing: 4, scraping: 2 };
        live.advance(0.1);
        const offline = new Game(actOneContent, parseSave(serializeSave(live.state, 0), createInitialState(actOneContent, 1)).state);
        for (let tick = 0; tick < 72000; tick++) live.advance(0.05);
        offline.catchUp(3600);
        expect(live.state).toEqual(offline.state);
    });

    it('keeps images from visited pages available and shows easter eggs once', () => {
        const game = newGame();
        for (let level = 1; level < 50; level++) handSolve(game);
        const page = levelPage(20);
        const imageUrl = new URL(page.imageName, page.url).href;
        expect(game.content.resolvePage(imageUrl, game.state).statusCode).toBe(200);
        expect(levelPage(404).lines.filter((line) => line.includes('this level could not be found'))).toHaveLength(1);
    });

    it('keeps a useful owned wordlist route when mutation rules are purchased', () => {
        const game = newGame();
        game.state.purchases = { rockyou: 1, fakeUserAgent: 1, dirb: 1, sizeFilter: 1 };
        const before = searchCapabilities(game.state);
        game.state.purchases.mutationRules = 1;
        const after = searchCapabilities(game.state);
        for (let level = 300; level < 700; level++) {
            if (entrance(level).kind === 'leet') expect(planSearch(level, after).hitAt).toBeLessThanOrEqual(planSearch(level, before).hitAt);
        }
    });

    it('does not allocate more workers than the machine has', () => {
        const game = newGame();
        game.state.flags.automated = true;
        game.state.purchases.autoReplyMacros = 1;
        expect(game.dispatch({ type: 'assignJob', jobId: 'ticketing', change: 1 })).toBe(true);
        expect(game.dispatch({ type: 'assignJob', jobId: 'ticketing', change: 1 })).toBe(false);
        expect(game.dispatch({ type: 'assignJob', jobId: 'scraping', change: 1 })).toBe(false);
    });

    it('offers capability upgrades for actual blockers while phrases remain a growing cost', () => {
        const game = newGame();
        expect(planSearch(46, searchCapabilities(game.state)).blockedBy).toBe('userAgent');
        for (const item of actOneContent.purchasables) game.state.purchases[item.id] = 1;
        const capabilities = searchCapabilities(game.state);
        const phrase = Array.from({ length: 100 }, (_, index) => index + 1100).find((level) => entrance(level).kind === 'phrase')!;
        const plan = planSearch(phrase, capabilities);
        expect(plan.blockedBy).toBeNull();
        expect(Number.isFinite(plan.hitAt)).toBe(true);
        expect(plan.hitAt).toBeGreaterThan(1e9);
    });
});

function gamePage(level: number) {
    const game = newGame();
    game.state.currentLevel = level;
    return game.content.resolvePage(urlOfLevel(level), game.state);
}
