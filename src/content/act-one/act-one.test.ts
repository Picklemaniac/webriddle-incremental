import { describe, expect, it } from 'vitest';
import { Game } from '../../core/game.ts';
import { createInitialState } from '../../core/state.ts';
import { parseSave, serializeSave } from '../../persistence/save.ts';
import { actOneContent } from './index.ts';
import { glyphRows } from './drawings.ts';
import { encode } from './encodings.ts';
import { entrance, levelPage, urlOfLevel } from './levels.ts';
import { canonicalUrl } from './pages.ts';
import { hallOfFameUrl, hintsUrl, riddleHomeUrl, rulesUrl } from './riddle.ts';
import { createCaptcha } from './captchas.ts';
import { effectiveRate, networkCapacity, rentedBlocks, requestedRate } from './network.ts';
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

    it('generates unique stable URLs and a usable clue on every page through the wall', () => {
        const game = newGame();
        const urls = new Set<string>([`${riddleHomeUrl}index.htm`, rulesUrl, hintsUrl, hallOfFameUrl]);
        for (const url of urls) expect(game.content.resolvePage(url, game.state).statusCode).toBe(200);
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

    it('never shows an answer in plain form and serves every file a page refers to', () => {
        const game = newGame();
        for (let level = 11; level <= 1400; level++) {
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
        for (let level = 11; level <= 1400; level++) {
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
        for (let level = 11; level <= 1400; level++) {
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
        for (let level = 11; level <= 1400; level++) {
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
        for (let level = 11; level <= 1400; level++) {
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
        for (let level = 200; level <= 1400; level++) {
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
        for (let level = 11; level <= 1400; level++) {
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

    it('lists rented addresses as address blocks', () => {
        const game = newGame();
        for (const id of ['rentedAddresses', 'addressBlock', 'secondAddressBlock', 'leasedRange', 'dataCenterRange']) game.state.purchases[id] = 1;
        const blocks = rentedBlocks(game);
        expect(blocks.map((block) => block.range)).toEqual(['198.18.0.0/28', '198.18.2.0/26', '198.18.4.0/25', '198.18.6.0/24', '198.18.8.0/23']);
        expect(blocks.reduce((sum, block) => sum + block.addresses, 0)).toBe(16 + 64 + 128 + 256 + 512);
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
