import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Game } from '../../core/game.ts';
import { createInitialState } from '../../core/state.ts';
import { parseSave, serializeSave } from '../../persistence/save.ts';
import { actOneContent } from './index.ts';
import { glyphRows } from './drawings.ts';
import { encode } from './encodings.ts';
import { entrance, entranceAction, firstGeneratedLevel, levelPage, urlOfLevel } from './levels.ts';
import { handcraftedAnswerWords } from './word-lists.ts';
import { canonicalUrl } from './pages.ts';
import { hallOfFameUrl, hintsUrl, riddleHomeUrl, rulesUrl } from './riddle.ts';
import { createCaptcha } from './captchas.ts';
import { backlogSeconds, incomePerSecond, isAway } from './economy.ts';
import { addressCount, effectiveRate, networkCapacity, rentedBlocks, rentPerSecond, requestedRate } from './network.ts';
import { planSearch, searchCapabilities, type SlowReason } from './search.ts';
import { offeredUpgrades, upgrades } from './upgrades.ts';
import { actOneStrategy } from '../../simulation/act-one-strategy.ts';
import { AutoPlayer } from '../../simulation/auto-player.ts';

function newGame(seed = 1): Game { return new Game(actOneContent, createInitialState(actOneContent, seed)); }
const lastTestedLevel = 1400;

function handSolve(game: Game): boolean {
    return game.dispatch(entranceAction(entrance(game.state.currentLevel + 1)));
}

function generatedLevels(from = firstGeneratedLevel): number[] {
    return Array.from({ length: lastTestedLevel - from + 1 }, (_, index) => from + index);
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

    it('generates unique stable URLs and a usable clue on every page through the wall', () => {
        const game = newGame();
        const urls = new Set<string>([`${riddleHomeUrl}index.htm`, rulesUrl, hintsUrl, hallOfFameUrl]);
        for (const url of urls) expect(game.content.resolvePage(url, game.state).statusCode).toBe(200);
        for (let level = 1; level <= lastTestedLevel; level++) {
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

    it('never shows an answer in plain form and serves every file a page refers to', () => {
        const game = newGame();
        for (const level of generatedLevels()) {
            const page = levelPage(level);
            const answer = entrance(level + 1).answer;
            const texts = [page.title, ...page.lines, page.lines.join(''), ...page.comments, page.farComment, page.hiddenText, page.imageTitle, page.imageName.replace(/\.jpg$/, ''),
                ...page.belowFold, page.meta, page.imageNote, page.zipped, page.attribute, page.spans.map((span) => span.letter).join(''), ...page.files.map((file) => ('page' in file.content ? file.content.page : null))];
            expect(texts.some((text) => text?.trim().toLowerCase() === answer), `level ${level} shows ${answer}`).toBe(false);
            game.state.currentLevel = level;
            for (const file of page.files) expect(game.content.resolvePage(new URL(file.name, page.url).href, game.state).statusCode, `${level}: ${file.name}`).toBe(200);
        }
    });

    it('makes every password script lead to the next level', () => {
        let checked = 0;
        for (const level of generatedLevels()) {
            const page = levelPage(level);
            const script = page.files.find((file) => file.linked === 'script');
            if (script === undefined || !('text' in script.content)) continue;
            const next = entrance(level + 1);
            const location = { href: '' };
            new Function('prompt', 'location', script.content.text)(() => next.answer, location);
            expect(canonicalUrl(new URL(location.href, page.url).href), `level ${level}`).toBe(next.url);
            checked++;
        }
        expect(checked).toBeGreaterThan(5);
    });

    it('spells answers from letters of earlier page names', () => {
        let checked = 0;
        for (const level of generatedLevels()) {
            const next = entrance(level + 1);
            if (next.clue.method !== 'earlierAnswers') continue;
            const page = levelPage(level);
            const texts = [page.title, ...page.lines, ...page.comments, page.farComment, page.hiddenText, page.imageTitle, ...page.belowFold, page.meta, page.imageNote, page.zipped, page.attribute,
                ...page.files.map((file) => ('text' in file.content ? file.content.text : 'page' in file.content ? file.content.page : ''))].join(' ');
            const references = texts.match(/\d+(?::\d+)?(?: \d+(?::\d+)?){2,}/)![0].split(' ').map((reference) => reference.split(':').map(Number));
            expect(references.every(([earlier]) => earlier! < level), `level ${level}`).toBe(true);
            const spelled = references.map(([earlier, position]) => entrance(earlier!).answer[(position ?? 1) - 1]).join('');
            expect([next.answer, encode(next.answer, 'reversed'), encode(next.answer, 'atbash'), encode(next.answer, 'rot13')], `level ${level}`).toContain(spelled);
            checked++;
        }
        expect(checked).toBeGreaterThan(5);
    });

    it('draws letter grids and orders shuffled letters so they can be read back', () => {
        let grids = 0;
        let spans = 0;
        for (const level of generatedLevels()) {
            const next = entrance(level + 1);
            const page = levelPage(level);
            const readings = layerReadings(next.answer);
            if (page.spans.length > 0) {
                expect(readings, `level ${level}`).toContain([...page.spans].sort((first, second) => first.order - second.order).map((span) => span.letter).join(''));
                spans++;
            }
            if (page.grid.length > 0) {
                expect(readings, `level ${level}`).toContain(readGrid(page.grid));
                grids++;
            }
        }
        expect(grids).toBeGreaterThan(3);
        expect(spans).toBeGreaterThan(3);
    });

    it('reads back spacer widths, fake tags, bold letters, interleaved lines and caseless base64', () => {
        const seen = new Set<string>();
        for (const level of generatedLevels()) {
            const next = entrance(level + 1);
            const page = levelPage(level);
            const method = next.clue.method ?? '';
            const readings = layerReadings(next.answer);
            const capitals = new Set((page.comments[0] ?? '').split(' ').map(Number));
            const reading = {
                spacers: () => page.spacers.map((width) => String.fromCharCode(96 + width)).join(''),
                fakeTags: () => page.tags.map((tag) => tag[0]).join(''),
                boldLetters: () => page.emphasis.flat().filter((segment) => segment.bold).map((segment) => segment.text).join(''),
                interleaved: () => [...page.lines[0]!].map((letter, index) => (letter === '.' ? page.lines[1]![index] : letter)).join(''),
                caselessBase64: () => atob([...page.lines.filter((line) => /^[a-z0-9+/=]+$/.test(line)).join('')].map((character, index) => (capitals.has(index + 1) ? character.toUpperCase() : character)).join('')),
            }[method];
            if (reading === undefined) continue;
            expect(readings, `level ${level} (${method})`).toContain(reading());
            seen.add(method);
        }
        expect([...seen].sort()).toEqual(['boldLetters', 'caselessBase64', 'fakeTags', 'interleaved', 'spacers']);
    });

    it('remembers visited pages and the chosen home page', () => {
        const game = newGame();
        for (const url of [riddleHomeUrl, rulesUrl, riddleHomeUrl]) game.dispatch({ type: 'navigate', url });
        expect(game.state.history.slice(-2)).toEqual([canonicalUrl(rulesUrl), canonicalUrl(riddleHomeUrl)]);
        expect(game.dispatch({ type: 'setHomePage', url: rulesUrl })).toBe(true);
        expect(game.state.homePage).toBe(canonicalUrl(rulesUrl));
        expect(game.dispatch({ type: 'clearHistory' })).toBe(true);
        expect(game.state.history).toEqual([]);
    });

    it('generates the same levels as before; run vitest -u when that changes on purpose', () => {
        const levels = Array.from({ length: lastTestedLevel }, (_, index) => {
            const target = entrance(index + 1);
            return [target.url, target.kind, target.answer, target.clue.method ?? ''];
        });
        expect(createHash('sha256').update(JSON.stringify(levels)).digest('hex')).toMatchInlineSnapshot(`"b244c8894a2f19745fa85b177325cd33f98fa042ebcbba8097a7eb95bb2ad8e3"`);
    });

    it('lists every handcrafted answer for the vocabulary build', () => {
        const answers = Array.from({ length: firstGeneratedLevel - 1 }, (_, index) => entrance(index + 1)).filter((target) => target.kind !== 'fixed').map((target) => target.answer);
        expect([...handcraftedAnswerWords].sort()).toEqual([...new Set(answers)].sort());
    });

    it('adds and removes favorites', () => {
        const game = newGame();
        expect(game.dispatch({ type: 'addFavorite', url: riddleHomeUrl })).toBe(true);
        expect(game.state.favorites).toEqual([riddleHomeUrl]);
        expect(game.dispatch({ type: 'removeFavorite', url: riddleHomeUrl })).toBe(true);
        expect(game.state.favorites).toEqual([]);
        expect(game.dispatch({ type: 'removeFavorite', url: riddleHomeUrl })).toBe(false);
    });

    it('does not repeat a puzzle method within fifteen levels once enough methods are unlocked', () => {
        const lastSeen = new Map<string, number>();
        for (const level of generatedLevels(200)) {
            const target = entrance(level);
            const method = target.clue.method;
            if (!['word', 'extension', 'name'].includes(target.kind) || method === undefined) continue;
            const previous = lastSeen.get(method);
            if (previous !== undefined) expect(level - previous, `${method} at levels ${previous} and ${level}`).toBeGreaterThan(15);
            lastSeen.set(method, level);
        }
    });

    it('draws encoded text instead of the answer in letter pictures', () => {
        const letterPictures = new Set(['plain', 'mirror', 'rotated', 'dark', 'transparent', 'flash', 'delayed']);
        let pictures = 0;
        for (const level of generatedLevels()) {
            const { clue, answer } = entrance(level);
            const text = clue.renamed ?? (clue.drawing !== undefined && letterPictures.has(clue.drawing.kind) ? clue.drawing.text : undefined);
            if (text === undefined) continue;
            expect(text, `level ${level}`).not.toBe(answer);
            expect(layerReadings(answer).some((reading) => encode(reading, 'atbash') === text || encode(reading, 'rot13') === text || reading === text), `level ${level}`).toBe(true);
            pictures++;
        }
        expect(pictures).toBeGreaterThan(20);
    });

    it('keeps unlisted names short until level 600 and finds most of them in names.txt', () => {
        const state = newGame().state;
        for (const id of ['namesList', 'fakeUserAgent', 'dirb', 'sizeFilter']) state.purchases[id] = 1;
        let listed = 0;
        for (let level = 11; level <= 1000; level++) {
            const target = entrance(level);
            if (target.kind !== 'name') continue;
            expect(target.answer.length, `level ${level}`).toBeLessThanOrEqual(level < 600 ? 4 : 5);
            const plan = planSearch(level, searchCapabilities(state));
            if (plan.phases.at(-1)?.label === 'names.txt') listed++;
        }
        expect(listed).toBeGreaterThan(5);
    });

    it('searches word pairs in english-10k.txt once a word is too rare for words.txt', () => {
        const state = newGame().state;
        for (const id of ['english10k', 'sortByFrequency', 'combinator', 'fakeUserAgent', 'dirb', 'sizeFilter']) state.purchases[id] = 1;
        const labels = new Set<string>();
        for (let level = 700; level <= 1000; level++) {
            if (entrance(level).kind === 'twoWords') labels.add(planSearch(level, searchCapabilities(state)).phases.at(-1)!.label);
        }
        expect([...labels].sort()).toEqual(['words.txt × english-10k.txt', 'words.txt × words.txt']);
    });

    it('lists rented addresses as address blocks and fills them in order', () => {
        const game = newGame();
        for (const id of ['rentedAddresses', 'addressBlock', 'secondAddressBlock', 'leasedRange', 'dataCenterRange', 'secondDataCenterRange']) game.state.purchases[id] = 1;
        game.state.network.rentedAddresses = 200;
        const blocks = rentedBlocks(game);
        expect(blocks.map((block) => block.range)).toEqual(['198.18.0.0/27', '198.18.4.0/25', '198.18.8.0/24', '198.18.12.0/23', '198.18.16.0/23', '198.18.20.0/23']);
        expect(blocks.map((block) => block.rented)).toEqual([32, 128, 40, 0, 0, 0]);
        expect(game.stat('rentableAddresses')).toBe(32 + 128 + 256 + 512 + 512 + 512);
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
        game.dispatch({ type: 'answerCaptcha', answer: 'wrong' });
        expect(game.state.captcha).not.toBeNull();
        expect(game.state.flags.captchaRejected).toBe(true);
        game.dispatch({ type: 'answerCaptcha', answer: game.state.captcha!.word.toUpperCase() });
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

    it('lets requests over the limit through at the cost of Heat, with a switchable Throttle', () => {
        const game = newGame();
        game.state.currentLevel = 5;
        game.dispatch({ type: 'automate' });
        game.state.purchases.curlBatch = 1;
        game.state.purchases.keepAlive = 1;
        game.invalidateStats();
        game.advance(10);
        expect(effectiveRate(game)).toBe(networkCapacity(game));
        game.advance(50);
        expect(game.state.flags.networkRevealed).toBe(true);
        expect(effectiveRate(game)).toBe(requestedRate(game));
        expect(effectiveRate(game)).toBeGreaterThan(networkCapacity(game));
        expect(game.state.network.heat).toBeGreaterThan(0);
        expect(game.dispatch({ type: 'setThrottle', enabled: true })).toBe(false);
        game.state.purchases.throttle = 1;
        expect(effectiveRate(game)).toBe(networkCapacity(game));
        expect(game.dispatch({ type: 'setThrottle', enabled: false })).toBe(true);
        expect(effectiveRate(game)).toBe(requestedRate(game));
    });

    it('raises the server limit by ten requests a second for every rented IP address', () => {
        const game = automatedAt(120);
        game.state.purchases.rentedAddresses = 1;
        game.state.purchases.throttle = 1;
        game.state.resources.money = 1000;
        game.invalidateStats();
        game.dispatch({ type: 'checkIn' });
        game.dispatch({ type: 'setRentedAddresses', count: 0 });
        game.advance(0.25);
        game.dispatch({ type: 'setRentedAddresses', count: 0 });
        expect(networkCapacity(game)).toBe(10);
        game.dispatch({ type: 'setRentedAddresses', count: 32 });
        game.advance(0.25);
        expect(networkCapacity(game)).toBe(330);
    });

    it('rents IP addresses by the second and only as many as the player can pay for', () => {
        const game = automatedAt(120);
        game.state.activity = 'work';
        game.state.purchases.rentedAddresses = 1;
        game.state.resources.money = 1000;
        game.dispatch({ type: 'checkIn' });
        game.advance(0.25);
        expect(game.state.network.rentedAddresses).toBe(Math.min(16, Math.floor(incomePerSecond(game, 'money') * 0.3 / game.stat('addressRent'))));
        expect(game.dispatch({ type: 'setRentedAddresses', count: 33 })).toBe(false);
        expect(game.dispatch({ type: 'setRentedAddresses', count: -1 })).toBe(false);
        expect(game.dispatch({ type: 'setRentedAddresses', count: 20 })).toBe(true);
        const before = game.state.resources.money!;
        game.advance(10);
        expect(game.state.resources.money).toBeCloseTo(before + 10 * (incomePerSecond(game, 'money') - rentPerSecond(game)));
        expect(addressCount(game)).toBe(21);
        game.state.resources.money = 0;
        game.advance(10);
        expect(game.state.resources.money).toBeCloseTo(0);
        expect(game.state.network.rentShare).toBeCloseTo(incomePerSecond(game, 'money') / rentPerSecond(game));
        expect(addressCount(game)).toBeCloseTo(1 + 20 * game.state.network.rentShare);
    });

    it('stops paying for jobs after ten minutes without the player, and then pays the rent from income only', () => {
        const game = automatedAt(120);
        game.state.activity = 'work';
        game.dispatch({ type: 'checkIn' });
        game.advance(backlogSeconds);
        const earned = game.state.resources.money!;
        expect(earned).toBeCloseTo(backlogSeconds * incomePerSecond(game, 'money'));
        game.advance(3600);
        expect(isAway(game.state)).toBe(true);
        expect(game.state.resources.money! - earned).toBeLessThan(1);
        game.state.purchases.rentedAddresses = 1;
        game.invalidateStats();
        game.advance(0.25);
        game.state.network.rentedAddresses = 20;
        const saved = game.state.resources.money!;
        game.advance(600);
        expect(game.state.resources.money).toBe(saved);
        expect(game.state.network.rentShare).toBeCloseTo(incomePerSecond(game, 'money') / rentPerSecond(game));
        game.dispatch({ type: 'checkIn' });
        game.advance(60);
        expect(isAway(game.state)).toBe(false);
        expect(game.state.resources.money).toBeLessThan(saved);
        expect(game.state.network.rentShare).toBe(1);
    });

    it('offers an upgrade the player could soon afford, even while the money is being spent', () => {
        const game = automatedAt(350);
        for (const id of ['ram', 'newPc', 'secondPc', 'autoReplyMacros', 'certification', 'seniorCertification']) game.state.purchases[id] = 1;
        game.invalidateStats();
        expect(offeredUpgrades(game).map((item) => item.id)).not.toContain('teamLead');
        game.state.jobs = { ticketing: 5 };
        game.state.activity = 'riddles';
        expect(offeredUpgrades(game).map((item) => item.id)).toContain('teamLead');
    });

    it('keeps the search progress when a purchase does not change the search for this level', () => {
        const game = automatedAt(29);
        game.state.purchases.fakeUserAgent = 1;
        const level = Array.from({ length: 30 }, (_, index) => index + 30).find((candidate) => planSearch(candidate, searchCapabilities(game.state)).hitAt > 300)!;
        game.state.currentLevel = level - 1;
        game.advance(30);
        const spent = game.state.search.requestsSpent;
        expect(spent).toBeGreaterThan(0);
        game.state.purchases.rockyou = 1;
        game.advance(1);
        expect(game.state.search.requestsSpent).toBeGreaterThan(spent);
        game.state.purchases.sortByFrequency = 1;
        game.advance(1);
        expect(game.state.search.requestsSpent).toBeLessThan(spent);
    });

    it('resumes saved search progress, random drops, proxies and economy identically', () => {
        const game = newGame(9);
        const robot = new AutoPlayer(actOneStrategy(2));
        robot.playUntil(game, () => game.state.currentLevel >= 100, 3600);
        const restored = new Game(actOneContent, parseSave(serializeSave(game.state, 0), createInitialState(actOneContent, 99)).state);
        game.advance(600);
        restored.catchUp(600);
        expect(restored.state.statistics.offlineSeconds).toBe(600);
        expect(withoutTimeAway(restored.state)).toEqual(game.state);
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
        expect(offline.state.statistics.offlineSeconds).toBe(3600);
        expect(live.state).toEqual(withoutTimeAway(offline.state));
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

    it.each<[SlowReason, number, readonly string[], number]>([
        ['userAgent', 46, ['fakeUserAgent'], 1 / 10],
        ['folder', 100, ['dirb', 'gobuster', 'ffuf'], 1 / 10],
        ['wildcard', 201, ['sizeFilter', 'ffuf'], 1 / 20],
        ['extension', firstLevelOfKind('extension'), ['extensionList'], 1 / 8],
        ['credentials', firstLevelOfKind('credentials'), ['clusterBomb', 'crackHtpasswd'], 1 / 20],
    ])('slows DirBuster down at the %s wall instead of stopping it, and offers the upgrade that fixes it', (reason, level, fixes, speed) => {
        const game = automatedAt(level - 1);
        for (const item of upgrades) if (!fixes.includes(item.id)) game.state.purchases[item.id] = 1;
        game.invalidateStats();
        game.state.resources.money = 1e9;
        game.state.network.rentedAddresses = game.stat('rentableAddresses');
        game.dispatch({ type: 'checkIn' });
        const plan = planSearch(level, searchCapabilities(game.state));
        expect(plan.slowedBy).toBe(reason);
        expect(plan.speed).toBeCloseTo(speed);
        expect(Number.isFinite(plan.hitAt)).toBe(true);
        expect(offeredUpgrades(game).map((item) => item.id)).toContain(fixes[0]);
        game.advance(1);
        const slowProgress = game.state.search.requestsSpent;
        game.advance(4 * 3600);
        expect(game.state.currentLevel).toBeGreaterThanOrEqual(level);
        expect(game.state.statistics.handSolves ?? 0).toBe(0);
        const fixed = automatedAt(level - 1);
        for (const item of upgrades) fixed.state.purchases[item.id] = 1;
        fixed.invalidateStats();
        fixed.state.resources.money = 1e9;
        fixed.state.network.rentedAddresses = fixed.stat('rentableAddresses');
        fixed.dispatch({ type: 'checkIn' });
        expect(planSearch(level, searchCapabilities(fixed.state)).speed).toBe(1);
        fixed.advance(1);
        if (fixed.state.currentLevel === level - 1) expect(fixed.state.search.requestsSpent).toBeGreaterThan(slowProgress);
    });

    it('keeps phrases a growing cost that DirBuster can still pay', () => {
        const game = newGame();
        for (const item of actOneContent.purchasables) game.state.purchases[item.id] = 1;
        const phrase = Array.from({ length: 100 }, (_, index) => index + 1100).find((level) => entrance(level).kind === 'phrase')!;
        const plan = planSearch(phrase, searchCapabilities(game.state));
        expect(plan.speed).toBe(1);
        expect(Number.isFinite(plan.hitAt)).toBe(true);
        expect(plan.hitAt).toBeGreaterThan(1e9);
    });

    it('varies the puzzles in the first generated levels', () => {
        const methods = Array.from({ length: 20 }, (_, index) => entrance(firstGeneratedLevel + index).clue.method);
        expect(new Set(methods).size).toBeGreaterThanOrEqual(8);
        for (const method of new Set(methods)) expect(methods.filter((used) => used === method).length, method).toBeLessThanOrEqual(3);
        expect(entrance(firstGeneratedLevel).clue.method).not.toBe(entrance(firstGeneratedLevel - 1).clue.method);
    });
});

function automatedAt(level: number): Game {
    const game = newGame();
    game.state.currentLevel = level;
    game.state.browserUrl = urlOfLevel(level);
    game.state.flags.automated = true;
    game.state.elapsedSeconds = 60;
    return game;
}

function firstLevelOfKind(kind: string): number {
    return Array.from({ length: 900 }, (_, index) => index + 100).find((level) => entrance(level).kind === kind && entrance(level).folder === entrance(level - 1).folder && !entrance(level).wildcard)!;
}

function withoutTimeAway(state: Game['state']): Game['state'] {
    const statistics = { ...state.statistics };
    delete statistics.offlineSeconds;
    return { ...state, statistics };
}

function layerReadings(answer: string): string[] {
    const shifts = Array.from({ length: 25 }, (_, index) => answer.replace(/[a-z]/g, (letter) => String.fromCharCode(97 + ((letter.charCodeAt(0) - 97 + index + 1) % 26))));
    return [answer, ...(['reversed', 'atbash', 'rot13'] as const).map((layer) => encode(answer, layer)), ...shifts];
}

function readGrid(grid: readonly string[]): string {
    const counts = new Map<string, number>();
    for (const letter of grid.join('')) counts.set(letter, (counts.get(letter) ?? 0) + 1);
    const special = [...counts].sort((first, second) => second[1] - first[1])[0]![0];
    const alphabet = [...'abcdefghijklmnopqrstuvwxyz'];
    let word = '';
    for (let band = 0; band * 8 + 1 < grid.length; band++) {
        for (let cell = 0; cell * 6 + 1 < grid[0]!.length; cell++) {
            const rows = Array.from({ length: 7 }, (_, y) => [...grid[band * 8 + 1 + y]!.slice(cell * 6 + 1, cell * 6 + 6)].reduce((bits, letter) => bits * 2 + (letter === special ? 1 : 0), 0));
            if (rows.every((row) => row === 0)) continue;
            word += alphabet.find((letter) => glyphRows(letter).every((row, y) => row === rows[y])) ?? '?';
        }
    }
    return word;
}

function gamePage(level: number) {
    const game = newGame();
    game.state.currentLevel = level;
    return game.content.resolvePage(urlOfLevel(level), game.state);
}
