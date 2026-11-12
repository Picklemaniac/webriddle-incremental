import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Game } from '../../core/game.ts';
import { createInitialState } from '../../core/state.ts';
import { parseSave, serializeSave } from '../../persistence/save.ts';
import { actOneContent } from './index.ts';
import { glyphRows } from './drawings.ts';
import { encode } from './encodings.ts';
import { entrance, entranceAction, firstGeneratedLevel, levelPage, ruleWordRanks, urlOfLevel } from './levels.ts';
import { handcraftedAnswerWords, latinWords } from './word-lists.ts';
import { canonicalUrl } from './pages.ts';
import { hallOfFameUrl, hintsUrl, riddleHomeUrl, rulesUrl } from './riddle.ts';
import { createCaptcha } from './captchas.ts';
import { backlogSeconds, incomePerSecond, isAway } from './economy.ts';
import { addressCount, effectiveRate, networkCapacity, rentedBlocks, rentPerSecond, requestedRate } from './network.ts';
import { currentSearch } from './automation.ts';
import { markNeeded } from './progress.ts';
import {
    bansBeforeScriptsAreBlocked, currentPhase, isLightLeet, planSearch, requestsKept, searchCapabilities, type SearchCapabilities, type SearchPhase, type SearchPlan, type SlowReason,
} from './search.ts';
import { offeredUpgrades, upgrades } from './upgrades.ts';
import { rankOfWord } from './vocabulary.ts';
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
        expect(createHash('sha256').update(JSON.stringify(levels)).digest('hex')).toMatchInlineSnapshot(`"216cdf5715f2c67f7d0fb00ff912aa67c266c55a7ed558386e6eeecd62269bde"`);
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

    it('makes the same passes in the same order on every level, whatever the answer is', () => {
        for (const owned of [['english10k'], ['english10k', 'dirb', 'extensionList', 'dictWords', 'sortByFrequency'], upgrades.map((item) => item.id)]) {
            const state = newGame().state;
            for (const id of owned) state.purchases[id] = 1;
            const capabilities = searchCapabilities(state);
            const orders = new Set<string>();
            for (const level of generatedLevels(100)) {
                let afterLoginPage = false;
                for (const plan of stagePlans(level, capabilities)) {
                    if (!afterLoginPage) orders.add(passes(plan).map((phase) => phase.label).join(' > '));
                    afterLoginPage = plan.finds === 'login';
                }
            }
            expect([...orders], owned.join(' ')).toHaveLength(1);
        }
    });

    it.each<[string, RegExp]>([
        ['word', /^(words\.txt|english-10k\.txt|\/usr\/share\/dict\/words|scrabble\.txt)$/],
        ['extension', /^(words|english-10k)\.txt × 4 extensions$/],
        ['capitals', /^(words|english-10k)\.txt, also in capitals$/],
        ['reversed', /^(words|english-10k)\.txt, also backwards$/],
        ['backup', /^(words|english-10k)\.txt × 3 endings$/],
        ['subdomain', /^(words|english-10k)\.txt \(subdomains\)$/],
        ['credentials', /^(words|english-10k)\.txt \(folders\)$/],
        ['leet', /^(words|english-10k)\.txt × 6 mutations$|^rockyou-75\.txt$|^leaks\.txt$/],
        ['name', /^names\.txt$/],
        ['number', /^0000-9999$/],
        ['date', /^dates 1000-2099$/],
        ['latin', /^latin\.txt$/],
        ['twoWords', /^words\.txt × (words|english-10k)\.txt, likely pairs first$/],
    ])('comes to every %s answer in the pass that tries such names', (kind, label) => {
        const capabilities = searchCapabilities(stockedAt(10).state);
        const levels = generatedLevels().filter((level) => level <= 1000 && entrance(level).kind === kind);
        expect(levels.length).toBeGreaterThan(10);
        for (const level of levels) {
            const plan = stagePlans(level, capabilities).find((stage) => stage.finds !== 'folder')!;
            expect(hitPhase(plan).label, `level ${level}`).toMatch(label);
            expect(plan.phases.at(-1)!.guessing, `level ${level}`).toBeUndefined();
        }
    });

    it('tries names.txt on every level once the player has it, and before that guesses a name after every pass', () => {
        const state = newGame().state;
        for (const id of ['fakeUserAgent', 'dirb', 'sizeFilter', 'english10k']) state.purchases[id] = 1;
        markNeeded(state, 'namesList');
        const levels = Array.from({ length: 990 }, (_, index) => index + 11).filter((level) => entrance(level).kind === 'name' && entrance(level).folder === entrance(level - 1).folder);
        expect(levels.length).toBeGreaterThan(5);
        for (const level of levels) {
            const without = planSearch(level, searchCapabilities(state));
            expect(without.learns, `level ${level}`).toEqual(['namesList']);
            expect(without.phases.map((phase) => phase.label)).toEqual(['words.txt', 'words.txt (folders)', 'english-10k.txt', 'english-10k.txt (folders)', 'brute force']);
            const listed = planSearch(level, searchCapabilities({ ...state, purchases: { ...state.purchases, namesList: 1 } }));
            expect(listed.phases.map((phase) => phase.label)).toEqual(['words.txt', 'words.txt (folders)', 'names.txt', 'english-10k.txt', 'english-10k.txt (folders)']);
            expect(hitPhase(listed).label).toBe('names.txt');
            expect(without.hitAt - passRequests(without)).toBeGreaterThanOrEqual(20 * (listed.hitAt - 3_000));
            expect(without.speed).toBe(1);
            expect(listed.speed).toBe(1);
        }
    });

    it('searches word pairs in english-10k.txt once a word is too rare for words.txt', () => {
        const state = newGame().state;
        for (const id of ['english10k', 'sortByFrequency', 'combinator', 'fakeUserAgent', 'dirb', 'sizeFilter']) state.purchases[id] = 1;
        const labels = new Set<string>();
        for (let level = 700; level <= 1000; level++) {
            if (entrance(level).kind === 'twoWords') labels.add(hitPhase(stagePlans(level, searchCapabilities(state)).at(-1)!).label);
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
        expect(effectiveRate(game)).toBe(requestedRate(game));
        expect(game.state.network.heat).toBe(0);
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

    it('keeps the search progress when a purchase adds a pass, and starts the pass over when a purchase changes its order', () => {
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

    it('puts the passes of a card bought in the middle of a level last, and gives them their own place from the next level on', () => {
        const state = newGame().state;
        for (const id of ['english10k', 'dirb', 'dictWords']) state.purchases[id] = 1;
        const level = firstLevelWhere((target) => target.kind === 'word' && planSearch(target.level, searchCapabilities(state)).hitAt > 20_000);
        const before = planSearch(level, searchCapabilities(state));
        expect(before.phases.map((phase) => phase.label)).toEqual(['words.txt', 'words.txt (folders)', 'english-10k.txt', 'english-10k.txt (folders)', '/usr/share/dict/words']);
        state.purchases.extensionList = 1;
        const resumed = planSearch(level, searchCapabilities(state), 0, before.signature);
        expect(resumed.phases.map((phase) => phase.label)).toEqual([...before.phases.map((phase) => phase.label), 'words.txt × 4 extensions', 'english-10k.txt × 4 extensions']);
        expect(resumed.hitAt).toBe(before.hitAt);
        expect(requestsKept(before.signature, resumed, 12_345)).toBe(12_345);
        const next = planSearch(level + 1, searchCapabilities(state));
        expect(next.phases.map((phase) => phase.label)).toEqual(
            ['words.txt', 'words.txt (folders)', 'words.txt × 4 extensions', 'english-10k.txt', 'english-10k.txt (folders)', 'english-10k.txt × 4 extensions', '/usr/share/dict/words']);
        expect(requestsKept(before.signature, next, 12_345)).toBe(3_000);
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
            if (target.kind !== 'leet' || target.folder !== entrance(level - 1).folder) continue;
            const plan = planSearch(level, searchCapabilities(state));
            expect(plan.learns, `level ${level}`).toHaveLength(1);
            expect(plan.speed).toBe(1);
            expect(plan.phases.at(-1)!.guessing).toBe(true);
            const fix = plan.learns[0]!;
            if (isLightLeet(target.answer)) expect(fix).toBe('mutationRules');
            else expect(['rockyou', 'moreLeaks']).toContain(fix);
            fixes.add(fix);
            const owned = planSearch(level, searchCapabilities({ ...state, purchases: { ...state.purchases, [fix]: 1 } }));
            expect(owned.speed).toBe(1);
            expect(hitPhase(owned).label).toMatch({ mutationRules: / × 6 mutations$/, rockyou: /^rockyou-75\.txt$/, moreLeaks: /^leaks\.txt$/ }[fix]!);
            expect(owned.hitAt).toBeLessThan(plan.hitAt);
        }
        expect([...fixes].sort()).toEqual(['moreLeaks', 'mutationRules', 'rockyou']);
    });

    it('shortens logins and two-word answers with the lists made for them', () => {
        const state = newGame().state;
        for (const item of upgrades) if (!['usernames', 'passwords', 'likelyPairs', 'crackHtpasswd'].includes(item.id)) state.purchases[item.id] = 1;
        const capabilities = (owned: readonly string[]): SearchCapabilities => searchCapabilities({ ...state, purchases: { ...state.purchases, ...Object.fromEntries(owned.map((id) => [id, 1])) } });
        const cost = (kind: string, owned: readonly string[]): number => {
            let total = 0;
            for (let level = 500; level <= 1000; level++) if (entrance(level).kind === kind) total += stagePlans(level, capabilities(owned)).at(-1)!.hitAt;
            return total;
        };
        expect(cost('credentials', ['usernames'])).toBeLessThan(cost('credentials', []) * 0.6);
        expect(cost('credentials', ['usernames', 'passwords'])).toBeLessThan(cost('credentials', ['usernames']) * 0.7);
        expect(cost('twoWords', ['likelyPairs'])).toBeLessThan(cost('twoWords', []) * 0.75);
        const login = firstLevelOfKind('credentials');
        const loginPass = (owned: readonly string[]): SearchPhase => stagePlans(login, capabilities(owned)).at(-1)!.phases[0]!;
        expect(loginPass([]).label).toBe('usernames × passwords');
        expect(loginPass([]).booster).toBe('usernames');
        expect(loginPass(['usernames']).booster).toBe('passwords');
        expect(loginPass(['usernames', 'passwords']).label).toBe('usernames.txt × passwords.txt');
        expect(loginPass(['usernames', 'passwords']).booster).toBeUndefined();
        const pairPasses = (owned: readonly string[]): SearchPhase[] => planSearch(login, capabilities(owned)).phases.filter((phase) => phase.label.includes(' × words.txt') || phase.label.includes(' × english'));
        expect(pairPasses([]).map((phase) => phase.booster)).toEqual(['likelyPairs', 'likelyPairs']);
        expect(pairPasses(['likelyPairs']).map((phase) => phase.booster)).toEqual([undefined, undefined]);
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
    ])('slows DirBuster down at the %s wall instead of stopping it, and offers the upgrade that fixes it once DirBuster runs into it', (reason, level, fix, speed) => {
        const game = stockedAt(level - 1, fix);
        game.state.statistics.bans = bansBeforeScriptsAreBlocked;
        const plan = stagePlans(level, searchCapabilities(game.state)).at(-1)!;
        expect(plan.slowedBy).toBe(reason);
        expect(plan.missing).toEqual([fix]);
        expect(plan.learns).toEqual([]);
        expect(plan.speed).toBeCloseTo(speed);
        expect(Number.isFinite(plan.hitAt)).toBe(true);
        for (let seconds = 0; currentSearch(game).slowedBy !== reason && seconds < 600; seconds++) {
            expect(offeredUpgrades(game).map((item) => item.id)).not.toContain(fix);
            game.advance(1);
        }
        expect(game.state.currentLevel).toBe(level - 1);
        game.advance(1);
        expect(offeredUpgrades(game).map((item) => item.id)).toContain(fix);
        game.advance(4 * 3600);
        expect(game.state.currentLevel).toBeGreaterThanOrEqual(level);
        expect(game.state.statistics.handSolves ?? 0).toBe(0);
        const fixed = stockedAt(level - 1);
        fixed.state.statistics.bans = bansBeforeScriptsAreBlocked;
        expect(stagePlans(level, searchCapabilities(fixed.state)).map((stage) => stage.speed)).not.toContain(speed);
    });

    it('looks for a new folder from the old one, and only searches inside it once it has been found', () => {
        const state = stockedAt(10, 'sizeFilter').state;
        const [fromAmber, inBasalt] = stagePlans(200, searchCapabilities(state));
        expect(fromAmber!.base).toBe('/amber/');
        expect(fromAmber!.finds).toBe('folder');
        expect(fromAmber!.slowedBy).toBeNull();
        expect(hitPhase(fromAmber!).label).toBe('words.txt (folders)');
        expect(hitPhase(fromAmber!).candidate(0)).toMatch(/^\/[a-z]+\/$/);
        expect(hitPhase(fromAmber!).candidate(1)).toMatch(/^[a-z]+\/$/);
        expect(inBasalt!.base).toBe('/basalt/');
        expect(inBasalt!.finds).toBe('level');
        expect(inBasalt!.slowedBy).toBe('wildcard');
        const [fromBasalt, inCinder] = stagePlans(300, searchCapabilities(state));
        expect([fromBasalt!.base, fromBasalt!.slowedBy]).toEqual(['/basalt/', 'wildcard']);
        expect([inCinder!.base, inCinder!.slowedBy]).toEqual(['/cinder/', null]);
        const game = automatedAt(199);
        for (const id of ['english10k', 'dirb', 'sizeFilter', 'sortByFrequency', 'curlBatch', 'keepAlive', 'throttle']) game.state.purchases[id] = 1;
        game.invalidateStats();
        const bases = new Set<string>();
        for (let ticks = 0; game.state.currentLevel === 199 && ticks < 6000; ticks++) {
            bases.add(currentSearch(game).base);
            game.advance(0.25);
        }
        expect([...bases]).toEqual(['/amber/', '/basalt/']);
        expect(game.state.currentLevel).toBe(200);
        expect(game.state.search.stage).toBe(0);
    });

    it('finds a login page like any other folder, and only tries logins once it has found one', () => {
        const level = firstLevelOfKind('credentials');
        const [door, login] = stagePlans(level, searchCapabilities(stockedAt(level - 1, 'clusterBomb').state));
        expect(door!.finds).toBe('login');
        expect(door!.slowedBy).toBeNull();
        expect(hitPhase(door!).label).toMatch(/ \(folders\)$/);
        expect(login!.finds).toBe('level');
        expect(login!.base).toBe(`${door!.base}${entrance(level).answer}/`);
        expect(login!.slowedBy).toBe('credentials');
        expect(login!.phases.map((phase) => phase.label)).toEqual(['usernames.txt × passwords.txt']);
        expect(login!.phases[0]!.candidate(0)).toMatch(new RegExp(`^${login!.base} [a-z]+:[a-z]+$`));
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

    it.each<[string, number, string]>([
        ['a new folder', 100, 'dirb'],
        ['another extension', firstLevelOfKind('extension'), 'extensionList'],
        ['a digit in the name', firstLevelWhere((target) => target.kind === 'leet' && isLightLeet(target.answer)), 'mutationRules'],
        ['two words', firstLevelOfKind('twoWords'), 'combinator'],
        ['a first name', firstLevelOfKind('name'), 'namesList'],
        ['a number', firstLevelOfKind('number'), 'numberRanges'],
        ['capitals', firstLevelOfKind('capitals'), 'capitalRule'],
        ['a word written backwards', firstLevelOfKind('reversed'), 'reverseRule'],
        ['a backup copy', firstLevelOfKind('backup'), 'backupExtensions'],
        ['a date', firstLevelOfKind('date'), 'dateFormats'],
        ['a Latin word', firstLevelOfKind('latin'), 'latinList'],
        ['a subdomain', firstLevelOfKind('subdomain'), 'subdomainScan'],
    ])('cannot tell %s from any other name: it makes every pass, then guesses, and offers the upgrade once the answer has been found', (_, level, fix) => {
        const game = stockedAt(level - 1, fix);
        game.state.network.rentedAddresses = game.stat('rentableAddresses');
        game.state.resources.money = 1e9;
        const capabilities = searchCapabilities(game.state);
        const plan = planSearch(level, capabilities);
        expect(plan.slowedBy).toBeNull();
        expect(plan.speed).toBe(1);
        expect(plan.missing).toEqual([]);
        expect(plan.learns).toEqual([fix]);
        const plainLevel = firstLevelWhere((target) => target.kind === 'word' && target.level > level);
        expect(passes(plan).map((phase) => phase.label)).toEqual(planSearch(plainLevel, capabilities).phases.map((phase) => phase.label));
        const guesses = plan.phases.at(-1)!;
        expect(guesses.label).toBe('brute force');
        expect(guesses.guessing).toBe(true);
        const guessed = [0, 1, 2, 3, 4, 5, 6, 7].map((index) => guesses.candidate(index));
        for (const name of guessed) expect(name).toMatch(/^[a-z0-9]{3,8}\.htm$/);
        expect(new Set(guessed.map((name) => name.length)).size).toBeGreaterThan(2);
        expect(plan.hitAt).toBeGreaterThan(passRequests(plan));
        expect(currentPhase(plan, passRequests(plan) - 1).phase!.guessing).toBeUndefined();
        expect(currentPhase(plan, passRequests(plan)).phase).toBe(guesses);
        expect(plan.base).toBe(entrance(level - 1).folder === null ? '/' : `/${entrance(level - 1).folder}/`);
        let seconds = 0;
        for (; game.state.currentLevel < level && seconds < 900; seconds++) {
            expect(offeredUpgrades(game).map((item) => item.id)).not.toContain(fix);
            game.advance(1);
        }
        expect(game.state.currentLevel).toBeGreaterThanOrEqual(level);
        expect(game.state.statistics.handSolves ?? 0).toBe(0);
        game.advance(1);
        expect(offeredUpgrades(game).map((item) => item.id)).toContain(fix);
    });

    it('guesses the first answer of an unknown kind for a time that goes by its level, and later ones for a time that goes by where their word is in the lists', () => {
        const state = newGame().state;
        for (const item of upgrades) if (item.id !== 'capitalRule') state.purchases[item.id] = 1;
        const levels = Array.from({ length: 700 }, (_, index) => index + 300).filter((level) => entrance(level).kind === 'capitals' && entrance(level).folder === entrance(level - 1).folder);
        expect(levels.length).toBeGreaterThan(5);
        const guesses = (): number[] => levels.map((level) => {
            const plan = planSearch(level, searchCapabilities(state));
            return plan.hitAt - passRequests(plan);
        });
        const firstMeetings = guesses();
        expect(firstMeetings).toEqual([...firstMeetings].sort((first, second) => first - second));
        markNeeded(state, 'capitalRule');
        const later = guesses();
        expect(later).not.toEqual([...later].sort((first, second) => first - second));
        for (const [index, count] of later.entries()) expect(count).toBeGreaterThanOrEqual(firstMeetings[index]!);
    });

    it('offers a longer wordlist once an answer that is in it has been found by guessing, and not when DirBuster merely runs out', () => {
        const game = automatedAt(80);
        for (const id of ['curlBatch', 'keepAlive', 'freeProxies', 'throttle']) game.state.purchases[id] = 1;
        game.invalidateStats();
        game.dispatch({ type: 'checkIn' });
        const isGuessed = (candidate: number): boolean => planSearch(candidate, searchCapabilities(game.state)).phases.at(-1)?.guessing === true;
        const level = Array.from({ length: 60 }, (_, index) => index + 81).find(isGuessed)!;
        game.state.currentLevel = level - 1;
        const plan = planSearch(level, searchCapabilities(game.state));
        expect(plan.phases.map((phase) => phase.label)).toEqual(['words.txt', 'brute force']);
        expect(plan.learns).toEqual(['english10k']);
        expect(plan.missing).toEqual([]);
        expect(plan.speed).toBe(1);
        const withList = planSearch(level, searchCapabilities({ ...game.state, purchases: { ...game.state.purchases, english10k: 1 } }));
        expect(withList.phases.map((phase) => phase.label)).toEqual(['words.txt', 'english-10k.txt']);
        expect(withList.hitAt).toBeLessThan(12_000);
        let seconds = 0;
        for (; game.state.currentLevel < level && seconds < 1800; seconds++) {
            expect(offeredUpgrades(game).map((item) => item.id)).not.toContain('english10k');
            game.advance(1);
        }
        expect(seconds).toBeGreaterThan(5);
        expect(game.state.currentLevel).toBeGreaterThanOrEqual(level);
        expect(game.state.statistics.handSolves ?? 0).toBe(0);
        game.advance(1);
        expect(offeredUpgrades(game).map((item) => item.id)).toContain('english10k');
        const next = Array.from({ length: 60 }, (_, index) => game.state.currentLevel + 1 + index).find(isGuessed)!;
        const known = planSearch(next, searchCapabilities(game.state));
        const listed = planSearch(next, searchCapabilities({ ...game.state, purchases: { ...game.state.purchases, english10k: 1 } }));
        expect(known.hitAt - 1_000).toBeGreaterThanOrEqual((listed.hitAt - 1_000) * 20);
        expect(requestsKept(known.signature, listed, 999)).toBe(999);
        expect(requestsKept(known.signature, listed, known.hitAt)).toBe(1_000);
        game.state.currentLevel = next - 1;
        game.state.search = { stage: 0, requestsSpent: 1_500, configuration: known.signature };
        game.state.purchases.english10k = 1;
        game.advance(0.25);
        if (game.state.currentLevel === next - 1) expect(game.state.search.requestsSpent).toBeLessThan(1_100);
    });

    it('only gives an answer a rule when its word is in one of the two shortest wordlists', () => {
        const ruled = new Set(['extension', 'capitals', 'reversed', 'backup', 'subdomain', 'leet', 'credentials']);
        for (const level of generatedLevels()) {
            const target = entrance(level);
            if (ruled.has(target.kind)) expect(rankOfWord(target.words[0]!), `level ${level}: ${target.words[0]}`).toBeLessThanOrEqual(ruleWordRanks);
        }
        for (let level = 100; level <= lastTestedLevel; level += 100) expect(rankOfWord(entrance(level).folder!)).toBeLessThanOrEqual(ruleWordRanks);
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
        const plan = stagePlans(phrase, searchCapabilities(game.state)).at(-1)!;
        expect(plan.speed).toBe(1);
        expect(plan.phases.at(-1)!.guessing).toBe(true);
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

// The plans for the finds on the way to a level, in order: the folder when the levels move to a new one, the page, and the login when the page asks for one.
function stagePlans(level: number, capabilities: SearchCapabilities): SearchPlan[] {
    const plans: SearchPlan[] = [];
    do plans.push(planSearch(level, capabilities, plans.length)); while (plans.at(-1)!.finds !== 'level');
    return plans;
}

function passes(plan: SearchPlan): SearchPhase[] {
    return plan.phases.filter((phase) => phase.guessing === undefined);
}

function passRequests(plan: SearchPlan): number {
    return passes(plan).reduce((sum, phase) => sum + phase.size, 0);
}

function hitPhase(plan: SearchPlan): SearchPhase {
    return currentPhase(plan, plan.hitAt - 1).phase!;
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
