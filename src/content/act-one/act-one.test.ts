import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Game } from '../../core/game.ts';
import { createInitialState } from '../../core/state.ts';
import { parseSave, serializeSave } from '../../persistence/save.ts';
import { actOneContent } from './index.ts';
import { glyphRows } from './drawings.ts';
import { encode } from './encodings.ts';
import { entrance, entranceAction, firstGeneratedLevel, levelPage, urlOfLevel } from './levels.ts';
import { handcraftedAnswerWords, latinWords } from './word-lists.ts';
import { canonicalUrl } from './pages.ts';
import { hallOfFameUrl, hintsUrl, riddleHomeUrl, rulesUrl } from './riddle.ts';
import { createCaptcha } from './captchas.ts';
import { backlogSeconds, incomePerSecond, isAway } from './economy.ts';
import { addressCount, effectiveRate, networkCapacity, rentedBlocks, rentPerSecond, requestedRate } from './network.ts';
import { markNeeded } from './progress.ts';
import { bansBeforeScriptsAreBlocked, isLightLeet, planSearch, searchCapabilities, type SlowReason } from './search.ts';
import { offeredUpgrades, upgrades } from './upgrades.ts';
import { actOneStrategy } from '../../simulation/act-one-strategy.ts';
import { AutoPlayer } from '../../simulation/auto-player.ts';

const highestDorkChance = 0.3;

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
        expect(createHash('sha256').update(JSON.stringify(levels)).digest('hex')).toMatchInlineSnapshot(`"4f95fe25d8d177aa9aed2ed71316dab4d21f81184c65237c80d55e8d1ddfb23f"`);
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

    it('finds every name in names.txt and guesses twenty times slower without it', () => {
        const state = newGame().state;
        for (const id of ['fakeUserAgent', 'dirb', 'sizeFilter', 'english10k']) state.purchases[id] = 1;
        markNeeded(state, 'namesList');
        const levels = Array.from({ length: 990 }, (_, index) => index + 11).filter((level) => entrance(level).kind === 'name');
        expect(levels.length).toBeGreaterThan(5);
        for (const level of levels) {
            const without = planSearch(level, searchCapabilities(state));
            expect(without.learns, `level ${level}`).toEqual(['namesList']);
            expect(without.speed).toBeCloseTo(1 / 20);
            const listed = planSearch(level, searchCapabilities({ ...state, purchases: { ...state.purchases, namesList: 1 } }));
            expect(listed.phases.at(-1)?.label).toBe('names.txt');
            expect(listed.hitAt).toBe(without.hitAt);
            expect(listed.speed).toBe(1);
        }
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
        expect(blocks.map((block) => block.range)).toEqual(['198.18.0.0/27', '198.18.4.0/26', '198.18.8.0/25', '198.18.12.0/24', '198.18.16.0/23', '198.18.20.0/22']);
        expect(blocks.map((block) => block.rented)).toEqual([32, 64, 104, 0, 0, 0]);
        expect(game.stat('rentableAddresses')).toBe(32 + 64 + 128 + 256 + 512 + 1024);
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

    it('charges rent by the second, and leaves a player who rents more than the pay covers broke with only the paid addresses working', () => {
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
        expect(rentPerSecond(game)).toBeGreaterThan(incomePerSecond(game, 'money'));
        const before = game.state.resources.money!;
        game.advance(10);
        expect(game.state.resources.money).toBeCloseTo(before + 10 * (incomePerSecond(game, 'money') - rentPerSecond(game)));
        expect(addressCount(game)).toBe(21);
        game.state.resources.money = 0;
        game.advance(10);
        expect(game.state.resources.money).toBeCloseTo(0);
        expect(game.state.network.rentShare).toBeCloseTo(incomePerSecond(game, 'money') / rentPerSecond(game));
        expect(addressCount(game)).toBeCloseTo(1 + 20 * game.state.network.rentShare);
        expect(game.dispatch({ type: 'setRentedAddresses', count: 2 })).toBe(true);
        game.advance(10);
        expect(game.state.network.rentShare).toBe(1);
        expect(game.state.resources.money).toBeGreaterThan(0);
    });

    it('asks for the next address block once every address is rented and the server limit still holds the scripts back', () => {
        const game = automatedAt(300);
        for (const id of ['rentedAddresses', 'throttle', 'curlBatch', 'threads8', 'keepAlive', 'isdn']) game.state.purchases[id] = 1;
        game.invalidateStats();
        game.state.flags.networkRevealed = true;
        game.state.resources.money = 10_000;
        game.dispatch({ type: 'checkIn' });
        const offered = (): string[] => offeredUpgrades(game).map((item) => item.id);
        game.dispatch({ type: 'setRentedAddresses', count: 32 });
        game.advance(1);
        expect(requestedRate(game) * 2).toBeLessThanOrEqual(networkCapacity(game));
        expect(offered()).not.toContain('addressBlock');
        game.state.purchases.adsl = 1;
        game.invalidateStats();
        game.dispatch({ type: 'setRentedAddresses', count: 31 });
        game.advance(1);
        expect(requestedRate(game) * 2).toBeGreaterThan(networkCapacity(game));
        expect(offered()).not.toContain('addressBlock');
        game.dispatch({ type: 'setRentedAddresses', count: 32 });
        game.advance(1);
        expect(offered()).toContain('addressBlock');
    });

    it('stops paying for jobs after ten minutes without the player, and then pays the rent from what the jobs would earn', () => {
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

    it('finds answers with one digit through Mutation rules and the others only in the leaked lists', () => {
        const state = newGame().state;
        for (const item of upgrades) if (!['mutationRules', 'rockyou', 'moreLeaks'].includes(item.id)) state.purchases[item.id] = 1;
        for (const id of ['mutationRules', 'rockyou', 'moreLeaks']) markNeeded(state, id);
        const fixes = new Set<string>();
        for (let level = 300; level <= 1000; level++) {
            const target = entrance(level);
            if (target.kind !== 'leet') continue;
            const plan = planSearch(level, searchCapabilities(state));
            expect(plan.learns, `level ${level}`).toHaveLength(1);
            expect(plan.speed).toBeCloseTo(1 / 20);
            const fix = plan.learns[0]!;
            if (isLightLeet(target.answer)) expect(fix).toBe('mutationRules');
            else expect(['rockyou', 'moreLeaks']).toContain(fix);
            fixes.add(fix);
            const owned = planSearch(level, searchCapabilities({ ...state, purchases: { ...state.purchases, [fix]: 1 } }));
            expect(owned.speed).toBe(1);
            expect(owned.hitAt).toBe(plan.hitAt);
        }
        expect([...fixes].sort()).toEqual(['moreLeaks', 'mutationRules', 'rockyou']);
    });

    it('shortens logins and two-word answers with the lists made for them', () => {
        const state = newGame().state;
        for (const item of upgrades) if (!['usernames', 'passwords', 'likelyPairs', 'crackHtpasswd'].includes(item.id)) state.purchases[item.id] = 1;
        const cost = (kind: string, owned: readonly string[]): number => {
            const purchases = { ...state.purchases, ...Object.fromEntries(owned.map((id) => [id, 1])) };
            let total = 0;
            for (let level = 500; level <= 1000; level++) if (entrance(level).kind === kind) total += planSearch(level, searchCapabilities({ ...state, purchases })).hitAt;
            return total;
        };
        expect(cost('credentials', ['usernames'])).toBeLessThan(cost('credentials', []) * 0.6);
        expect(cost('credentials', ['usernames', 'passwords'])).toBeLessThan(cost('credentials', ['usernames']) * 0.7);
        expect(cost('twoWords', ['likelyPairs'])).toBeLessThan(cost('twoWords', []) * 0.4);
        const login = firstLevelOfKind('credentials');
        expect(planSearch(login, searchCapabilities(state)).boosters).toEqual(['usernames']);
        expect(planSearch(login, searchCapabilities({ ...state, purchases: { ...state.purchases, usernames: 1 } })).boosters).toEqual(['passwords']);
    });

    it('does not allocate more workers than the machine has', () => {
        const game = newGame();
        game.state.flags.automated = true;
        game.state.purchases.autoReplyMacros = 1;
        expect(game.dispatch({ type: 'assignJob', jobId: 'ticketing', change: 1 })).toBe(true);
        expect(game.dispatch({ type: 'assignJob', jobId: 'ticketing', change: 1 })).toBe(false);
        expect(game.dispatch({ type: 'assignJob', jobId: 'scraping', change: 1 })).toBe(false);
    });

    it.each<[SlowReason, number, string, number]>([
        ['userAgent', 46, 'fakeUserAgent', 1 / 10],
        ['wildcard', 201, 'sizeFilter', 1 / 20],
        ['credentials', firstLevelOfKind('credentials'), 'clusterBomb', 1 / 20],
    ])('slows DirBuster down at the %s wall instead of stopping it, and offers the upgrade that fixes it while it happens', (reason, level, fix, speed) => {
        const game = stockedAt(level - 1, fix);
        game.state.statistics.bans = bansBeforeScriptsAreBlocked;
        const plan = planSearch(level, searchCapabilities(game.state));
        expect(plan.slowedBy).toBe(reason);
        expect(plan.missing).toEqual([fix]);
        expect(plan.learns).toEqual([]);
        expect(plan.speed).toBeCloseTo(speed);
        expect(Number.isFinite(plan.hitAt)).toBe(true);
        expect(offeredUpgrades(game).map((item) => item.id)).not.toContain(fix);
        game.advance(1);
        expect(offeredUpgrades(game).map((item) => item.id)).toContain(fix);
        const slowProgress = game.state.search.requestsSpent;
        game.advance(4 * 3600);
        expect(game.state.currentLevel).toBeGreaterThanOrEqual(level);
        expect(game.state.statistics.handSolves ?? 0).toBe(0);
        const fixed = stockedAt(level - 1);
        fixed.state.statistics.bans = bansBeforeScriptsAreBlocked;
        expect(planSearch(level, searchCapabilities(fixed.state)).speed).toBe(1);
        fixed.advance(1);
        if (fixed.state.currentLevel === level - 1) expect(fixed.state.search.requestsSpent).toBeGreaterThan(slowProgress);
    });

    it('lets scripts through until the server has banned the player three times', () => {
        const game = automatedAt(45);
        game.state.statistics.bans = bansBeforeScriptsAreBlocked - 1;
        expect(planSearch(46, searchCapabilities(game.state)).missing).not.toContain('fakeUserAgent');
        game.state.statistics.bans = bansBeforeScriptsAreBlocked;
        expect(planSearch(46, searchCapabilities(game.state)).slowedBy).toBe('userAgent');
        game.state.purchases.fakeUserAgent = 1;
        expect(planSearch(46, searchCapabilities(game.state)).missing).not.toContain('fakeUserAgent');
    });

    it.each<[string, number, string, number]>([
        ['a new folder', 100, 'dirb', 1 / 10],
        ['another extension', firstLevelOfKind('extension'), 'extensionList', 1 / 8],
        ['a digit in the name', firstLevelWhere((target) => target.kind === 'leet' && isLightLeet(target.answer)), 'mutationRules', 1 / 20],
        ['two words', firstLevelOfKind('twoWords'), 'combinator', 1 / 20],
        ['a first name', firstLevelOfKind('name'), 'namesList', 1 / 20],
        ['capitals', firstLevelOfKind('capitals'), 'capitalRule', 1 / 10],
        ['a word written backwards', firstLevelOfKind('reversed'), 'reverseRule', 1 / 10],
        ['a backup copy', firstLevelOfKind('backup'), 'backupExtensions', 1 / 8],
        ['a date', firstLevelOfKind('date'), 'dateFormats', 1 / 20],
        ['a Latin word', firstLevelOfKind('latin'), 'latinList', 1 / 20],
        ['a subdomain', firstLevelOfKind('subdomain'), 'subdomainScan', 1 / 10],
    ])('cannot tell %s from any other name that is in no wordlist, and offers the upgrade for it once one has been found', (_, level, fix, speed) => {
        const game = stockedAt(level - 1, fix);
        const plan = planSearch(level, searchCapabilities(game.state));
        expect(plan.slowedBy).toBe('wordlist');
        expect(plan.missing).toEqual([]);
        expect(plan.learns).toEqual([fix]);
        expect(plan.speed).toBeCloseTo(speed);
        expect(plan.phases.map((phase) => phase.label)).toEqual(['brute force']);
        expect([0, 25, 26, 12345].map((index) => plan.phases[0]!.candidate(index))).toEqual(['a.htm', 'z.htm', 'aa.htm', 'rfv.htm']);
        expect(plan.folder).toBe(entrance(level - 1).folder);
        let seconds = 0;
        for (; game.state.currentLevel < level && seconds < 300; seconds++) {
            expect(offeredUpgrades(game).map((item) => item.id)).not.toContain(fix);
            game.advance(1);
        }
        expect(game.state.currentLevel).toBeGreaterThanOrEqual(level);
        expect(game.state.statistics.handSolves ?? 0).toBe(0);
        game.advance(1);
        expect(offeredUpgrades(game).map((item) => item.id)).toContain(fix);
    });

    it('prices the first answer of an unknown kind by its level, and later ones by where their word is in the lists', () => {
        const state = newGame().state;
        for (const item of upgrades) if (item.id !== 'capitalRule') state.purchases[item.id] = 1;
        const levels = Array.from({ length: 700 }, (_, index) => index + 300).filter((level) => entrance(level).kind === 'capitals' && !entrance(level).wildcard
            && entrance(level).folder === entrance(level - 1).folder);
        expect(levels.length).toBeGreaterThan(5);
        const firstMeetings = levels.map((level) => planSearch(level, searchCapabilities(state)).hitAt);
        expect(firstMeetings).toEqual([...firstMeetings].sort((first, second) => first - second));
        markNeeded(state, 'capitalRule');
        const later = levels.map((level) => planSearch(level, searchCapabilities(state)).hitAt);
        expect(later).not.toEqual([...later].sort((first, second) => first - second));
    });

    it('guesses a name that is in no owned wordlist instead of stopping, and asks for the list that has it', () => {
        const game = automatedAt(80);
        for (const id of ['curlBatch', 'keepAlive', 'freeProxies', 'throttle']) game.state.purchases[id] = 1;
        game.invalidateStats();
        game.dispatch({ type: 'checkIn' });
        const level = Array.from({ length: 60 }, (_, index) => index + 81).find((candidate) => planSearch(candidate, searchCapabilities(game.state)).missing.includes('english10k'))!;
        game.state.currentLevel = level - 1;
        const plan = planSearch(level, searchCapabilities(game.state));
        expect(plan.bruteForce).toBe(true);
        expect(plan.phases[0]!.label).toContain('brute force');
        expect(plan.hitAt).toBeLessThan(12_000);
        expect(planSearch(level, searchCapabilities({ ...game.state, purchases: { ...game.state.purchases, english10k: 1 } })).hitAt).toBe(plan.hitAt);
        game.advance(2);
        expect(game.state.flags.wordlistExhausted).toBe(true);
        expect(offeredUpgrades(game).map((item) => item.id)).toContain('english10k');
    });

    it('tells a name in capitals apart from the same name in small letters, and nothing else', () => {
        expect(canonicalUrl('http://www.notfinite.net/Bridge.HTM')).toBe('http://www.notfinite.net/bridge.htm');
        expect(canonicalUrl('http://WWW.notfinite.net/Cinder/LIGHT.HTM')).toBe('http://www.notfinite.net/cinder/LIGHT.htm');
        expect(canonicalUrl('http://www.notfinite.net/cinder/14071789.htm')).toBe('http://www.notfinite.net/cinder/14071789.htm');
        const level = firstLevelOfKind('capitals');
        const target = entrance(level);
        expect(target.answer).toBe(target.words[0]!.toUpperCase());
        const game = newGame();
        game.state.currentLevel = level - 1;
        game.dispatch({ type: 'navigate', url: target.url.replace(target.answer, target.answer.toLowerCase()) });
        expect(game.state.currentLevel).toBe(level - 1);
        game.dispatch({ type: 'navigate', url: target.url });
        expect(game.state.currentLevel).toBe(level);
    });

    it('puts some levels on their own subdomain and sends the next level back to the folder', () => {
        const level = firstLevelOfKind('subdomain');
        const target = entrance(level);
        expect(target.url).toBe(`http://${target.answer}.notfinite.net/`);
        const game = newGame();
        game.state.currentLevel = level - 1;
        expect(game.content.resolvePage(target.url, game.state).statusCode).toBe(0);
        game.dispatch({ type: 'navigate', url: target.url });
        expect(game.state.currentLevel).toBe(level);
        const page = levelPage(level);
        expect(game.content.resolvePage(target.url, game.state).statusCode).toBe(200);
        expect(game.content.resolvePage(new URL(page.imageName, page.url).href, game.state).statusCode).toBe(200);
        if (entrance(level + 1).kind !== 'subdomain') expect(page.comments.some((comment) => comment.includes('www.notfinite.net'))).toBe(true);
        expect(game.content.resolvePage('http://nothing-here.notfinite.net/', game.state).statusCode).toBe(0);
        const urls = Array.from({ length: 990 }, (_, index) => entrance(index + 11)).filter((entry) => entry.kind === 'subdomain').map((entry) => entry.url);
        expect(new Set(urls).size).toBe(urls.length);
    });

    it('writes each new kind of answer the way its clue reads back', () => {
        for (let level = 300; level <= 1000; level++) {
            const target = entrance(level);
            if (target.kind === 'reversed') expect([...target.answer].reverse().join(''), `level ${level}`).toBe(target.words[0]);
            if (target.kind === 'backup') expect(target.url.endsWith(`/${target.answer}.${target.extension}`) && /^htm\.(bak|old|orig)$/.test(target.extension), `level ${level}`).toBe(true);
            if (target.kind === 'date') expect(target.answer, `level ${level}`).toMatch(/^(0[1-9]|1[0-9]|2[0-8])(0[1-9]|1[0-2])(1[0-9]{3}|20[0-9]{2})$/);
            if (target.kind === 'latin') expect(latinWords, `level ${level}`).toContain(target.answer);
        }
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

const alsoFixing: Readonly<Record<string, readonly string[]>> = { dirb: ['gobuster', 'ffuf'], sizeFilter: ['ffuf'], clusterBomb: ['crackHtpasswd'] };

// A game with every upgrade, or with every upgrade except one and the others that would do its job.
function stockedAt(level: number, without?: string): Game {
    const game = automatedAt(level);
    for (const item of upgrades) if (item.id !== without && !(alsoFixing[without ?? ''] ?? []).includes(item.id)) game.state.purchases[item.id] = 1;
    game.invalidateStats();
    game.state.activity = 'work';
    game.state.jobs = { ticketing: 14 };
    game.dispatch({ type: 'checkIn' });
    return game;
}

function firstLevelWhere(matches: (target: ReturnType<typeof entrance>) => boolean): number {
    const plain = (level: number): boolean => entrance(level).folder === entrance(level - 1).folder && !entrance(level).wildcard && entrance(level).indexUnit > highestDorkChance;
    return Array.from({ length: 900 }, (_, index) => index + 100).find((level) => matches(entrance(level)) && plain(level))!;
}

function firstLevelOfKind(kind: string): number {
    return firstLevelWhere((target) => target.kind === kind);
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
