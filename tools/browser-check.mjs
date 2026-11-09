import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Game } from '../src/core/game.ts';
import { createInitialState } from '../src/core/state.ts';
import { actOneContent } from '../src/content/act-one/index.ts';
import { createCaptcha } from '../src/content/act-one/captchas.ts';
import { entrance, urlOfLevel } from '../src/content/act-one/levels.ts';
import { encodeExport, serializeSave } from '../src/persistence/save.ts';
import { AutoPlayer } from '../src/simulation/auto-player.ts';
import { actOneStrategy } from '../src/simulation/act-one-strategy.ts';
import { upgrades } from '../src/content/act-one/upgrades.ts';
import { handcraftedText } from '../src/content/act-one/text.ts';

const origin = process.env.WEBRIDDLE_TEST_URL ?? 'http://127.0.0.1:5173';
const expectsDevelopmentTools = process.env.WEBRIDDLE_TEST_PRODUCTION !== '1';
const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const outputDirectory = path.resolve('logs/browser-check');
await mkdir(outputDirectory, { recursive: true });
const profileDirectory = await mkdtemp(path.join(tmpdir(), 'webriddle-browser-check-'));
const chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--disable-extensions', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profileDirectory}`, '--remote-debugging-port=0', '--window-size=1440,1000', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let socket;
let commandId = 0;
const pending = new Map();
const problems = [];

try {
    let port;
    for (let attempt = 0; attempt < 80; attempt++) {
        try {
            const portFile = String(await readFile(path.join(profileDirectory, 'DevToolsActivePort'), 'utf8'));
            port = portFile.split('\n')[0];
            break;
        }
        catch { await sleep(100); }
    }
    assert.ok(port, 'Chrome did not start');
    /** @type {{ type: string, webSocketDebuggerUrl: string }[]} */
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const pageTarget = targets.find((target) => target.type === 'page');
    assert.ok(pageTarget, 'Chrome did not expose a page target');
    socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
    socket.addEventListener('message', ({ data }) => {
        const message = JSON.parse(data);
        if (message.id) {
            const waiter = pending.get(message.id);
            if (waiter) {
                clearTimeout(waiter.timeout);
                pending.delete(message.id);
                message.error ? waiter.reject(new Error(JSON.stringify(message.error))) : waiter.resolve(message.result);
            }
        }
        if (message.method === 'Runtime.exceptionThrown') problems.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
        if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') problems.push(message.params.args.map((argument) => argument.value ?? argument.description).join(' '));
        if (message.method === 'Page.javascriptDialogOpening') void send('Page.handleJavaScriptDialog', { accept: true });
    });
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    assert.equal((await fetch(origin)).status, 200);
    await send('Page.navigate', { url: origin });
    await waitFor(`document.querySelector('.browser-viewport')?.contentDocument?.title === 'Welcome to Enigma Web'`);
    assert.equal(await evaluate(`document.querySelector('.follow-current').hidden`), true, 'No return button before entering the riddle');
    await screenshot('start-page');
    await evaluate(`(() => {
        window.open = (url) => { window.openedUrl = url; return null; };
        [...document.querySelector('.browser-viewport').contentDocument.querySelectorAll('a')].findLast((link) => link.textContent === 'Enigmatics').click();
    })()`);
    assert.equal(await evaluate('window.openedUrl'), 'https://enigmatics.org/', 'Community links open the real site in a new window');
    assert.equal(await evaluate(`document.querySelector('.browser-status').textContent.startsWith('Done')`), true, 'Community links leave the browser where it is');
    const clickLink = (text) => evaluate(`[...document.querySelector('.browser-viewport').contentDocument.querySelectorAll('a')].find((link) => link.textContent === ${JSON.stringify(text)}).click()`);
    await clickLink('Notfinite');
    await waitFor(`document.querySelector('.browser-viewport')?.contentDocument?.title === 'Notfinite'`);
    await screenshot('riddle-home');
    await clickLink('Rules');
    await waitFor(`document.querySelector('.browser-viewport')?.contentDocument?.querySelector('.heading')?.textContent === 'Rules'`);
    await screenshot('riddle-rules');
    await clickLink('Back');
    await waitFor(`[...document.querySelector('.browser-viewport').contentDocument.querySelectorAll('a')].some((link) => link.textContent === 'Start')`);
    await clickLink('Start');
    await waitFor(`document.querySelector('.browser-viewport')?.contentDocument?.querySelector('.number')?.textContent === '1' && document.querySelector('.browser-viewport').contentDocument.querySelector('img').naturalWidth > 0`);
    await screenshot('opening');
    await assertPageFits();
    assert.equal(await evaluate(`document.querySelector('.dashboard').hidden`), true);
    await evaluate(`document.querySelector('.browser-viewport').contentDocument.querySelector('a').click()`);
    await waitFor(`document.querySelector('.browser-viewport')?.contentDocument?.querySelector('.number')?.textContent === '2'`);
    await navigate('level3.htm');
    await toolbar('View Source');
    assert.match(await evaluate(`document.querySelector('.source-pane .source-document').textContent`), /beneath/);
    assert.match(await evaluate(`document.querySelector('.source-pane .source-document').textContent`), /beneath.htm/);
    assert.equal(await evaluate(`document.querySelector('dialog[open]')`), null, 'Source must not open a modal');
    assert.equal(await evaluate(`document.querySelector('.browser-viewport').hidden`), true, 'Source should replace the page');
    assert.equal(await evaluate(`document.querySelector('[aria-label="A nudge"]')`), null);
    await screenshot('source-desktop');
    await navigate('beneath.htm');
    assert.equal(await evaluate(`document.querySelector('.source-pane').hidden`), false, 'Source should stay open across navigation');
    await toolbar('View Source');
    await menu('Edit', 'Select All');
    assert.match(await evaluate(`document.querySelector('.browser-viewport').contentWindow.getSelection().toString()`), /lighthouse/, 'Select All reveals the hidden text');
    await evaluate(`document.querySelector('.browser-viewport').contentWindow.getSelection().removeAllRanges()`);
    await navigate('lighthouse.htm');
    assert.equal(await evaluate(`document.querySelector('.automate-offer').hidden`), true, 'Install dirbuster waits a few seconds on level 5');
    await waitFor(`document.querySelector('.automate-offer').hidden === false`);
    await screenshot('automate');
    await toolbar('Back');
    await waitFor(`document.querySelector('.browser-viewport')?.contentDocument?.querySelector('.number')?.textContent === '4'`);
    await toolbar('Forward');
    await waitFor(`document.querySelector('.browser-viewport').contentDocument.title === ${JSON.stringify(handcraftedText.level5Title)}`);
    await toolbar('Back');
    await toolbar('Stop');
    await sleep(650);
    assert.equal(await evaluate(`document.querySelector('.browser-viewport').contentDocument.title`), handcraftedText.level5Title);
    assert.equal(await evaluate(`document.querySelector('.tool-button[aria-label="Forward"]').disabled`), true);
    await toolbar('Home');
    await waitFor(`document.querySelector('.browser-viewport').contentDocument.title === 'Welcome to Enigma Web'`);
    await evaluate(`document.querySelector('.follow-current').click()`);
    await waitFor(`document.querySelector('.browser-viewport').contentDocument.title === ${JSON.stringify(handcraftedText.level5Title)}`);
    await evaluate(`document.querySelector('.browser-viewport').contentDocument.body.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 60, clientY: 60 }))`);
    assert.equal(await evaluate(`document.querySelector('.context-menu').hidden`), false, 'Right-click opens the page menu');
    await screenshot('context-menu');
    await clickText('.context-menu', 'Select All');
    assert.equal(await evaluate(`document.querySelector('.context-menu').hidden`), true);
    assert.match(await evaluate(`document.querySelector('.browser-viewport').contentWindow.getSelection().toString()`), /01101101/);
    await evaluate(`document.querySelector('.browser-viewport').contentWindow.getSelection().removeAllRanges()`);
    await assertPageFits();
    const beforeAutomationX = await evaluate(`document.querySelector('.browser-window').getBoundingClientRect().x`);
    await clickText('.prompt-area', 'Install DirBuster');
    await screenshot('dirbuster-setup');
    await clickText('dialog[open]', 'Next >');
    await sleep(900);
    await screenshot('dirbuster-installing');
    await waitFor(`[...document.querySelectorAll('dialog[open] button')].some((button) => button.textContent === 'Finish')`);
    await clickText('dialog[open]', 'Finish');
    await waitFor(`document.querySelector('.game-screen').classList.contains('automated')`);
    await sleep(150);
    const duringAutomationX = await evaluate(`document.querySelector('.browser-window').getBoundingClientRect().x`);
    await sleep(1100);
    const afterAutomationX = await evaluate(`document.querySelector('.browser-window').getBoundingClientRect().x`);
    assert.ok(duringAutomationX < beforeAutomationX - 1 && duringAutomationX > afterAutomationX + 1, 'Automation layout should interpolate instead of snapping');
    await screenshot('first-script');
    assert.equal(await evaluate(`document.querySelector('.dashboard').hidden`), true, 'Automation should start with the script alone');
    assert.equal(await evaluate(`document.querySelectorAll('.terminal-lines .terminal-line').length`), 0, 'Startup must not dump old events');
    await menu('Favorites', 'Add to Favorites...');
    assert.match(await evaluate(`document.querySelector('dialog[open]').textContent`), /lighthouse.htm/);
    await clickText('dialog[open] .favorite-row', 'Delete');
    assert.doesNotMatch(await evaluate(`document.querySelector('dialog[open]').textContent`), /lighthouse.htm/, 'Deleting a favorite removes it from the list');
    await closeDialog();
    await menu('File', 'Import and Export...');
    await clickText('dialog[open]', 'Export');
    assert.match(await evaluate(`document.querySelector('dialog[open] textarea').value`), /^WEBRIDDLE-.*-END$/);
    await closeDialog();
    await navigate('midnight.htm');
    await toolbar('View Source');
    assert.match(await evaluate(`document.querySelector('.source-pane .source-document').textContent`), /present.jpg/);
    await evaluate(`document.querySelector('.source-document a').click()`);
    await waitFor(`document.querySelector('.browser-viewport').contentDocument.title === 'present.jpg'`);
    await navigate('present.gif');
    await waitFor(`document.querySelector('.browser-viewport').contentDocument.title === 'present.gif'`);
    assert.equal(await evaluate(`document.querySelector('.source-pane').hidden`), false, 'The source pane stays open while browsing');
    await waitFor(`/^GIF89a/.test(document.querySelector('.source-pane .source-document').textContent)`);
    await screenshot('gif-source');
    await toolbar('View Source');
    await navigate('bridge.htm');
    await navigate(`${entrance(8).answer}.htm`);
    assert.match(await evaluate(`document.querySelector('.browser-viewport').contentDocument.body.textContent`), /zveebe/);
    await navigate('mirror.htm');
    assert.match(await evaluate(`document.querySelector('.browser-viewport').contentDocument.body.textContent`), /ksud/);

    const opening = new Game(actOneContent, createInitialState(actOneContent, 1));
    for (let level = 2; level <= 5; level++) opening.dispatch({ type: 'navigate', url: urlOfLevel(level) });
    opening.dispatch({ type: 'automate' });
    opening.advance(60);
    await importGame(opening);
    assert.equal(await evaluate(`document.querySelector('.dashboard').hidden`), true);
    opening.advance(17);
    await importGame(opening);
    assert.equal(await evaluate(`document.querySelector('.dashboard').hidden`), false);
    assert.equal(await evaluate(`[...document.querySelectorAll('.upgrade-card')].filter(card=>!card.hidden).length`), 1);
    assert.equal(await evaluate(`document.querySelector('.resource-action').closest('.resource-row').hidden`), true, 'The price comes before the money');
    await screenshot('first-upgrade');
    opening.advance(6);
    await importGame(opening);
    assert.equal(await evaluate(`document.querySelector('.resource-action').closest('.resource-row').hidden`), false);
    await screenshot('first-money');

    const game = new Game(actOneContent, createInitialState(actOneContent, 7));
    const player = new AutoPlayer(actOneStrategy(4));
    player.playUntil(game, () => game.state.currentLevel >= 220, 18000);
    assert.ok(game.state.currentLevel >= 220);
    await importGame(game);
    await sleep(900);
    await screenshot('working');
    await evaluate(`[...document.querySelectorAll('.upgrade-card')].find((card) => !card.hidden).dispatchEvent(new MouseEvent('mouseenter'))`);
    await waitFor(`!document.querySelector('.win-tooltip').hidden`);
    await screenshot('upgrade-tooltip');
    await evaluate(`[...document.querySelectorAll('.upgrade-card')].find((card) => !card.hidden).dispatchEvent(new MouseEvent('mouseleave'))`);
    await assertLayout(1440);
    await toolbar('View Source');
    const inspectedPage = await evaluate(`document.querySelector('.browser-viewport').contentDocument.title`);
    const inspectedSource = await evaluate(`document.querySelector('.source-document').textContent`);
    await sleep(2500);
    assert.equal(await evaluate(`document.querySelector('.browser-viewport').contentDocument.title`), inspectedPage, 'Automation changed the page during inspection');
    assert.equal(await evaluate(`document.querySelector('.source-document').textContent`), inspectedSource, 'Automation changed source during inspection');
    assert.match(await evaluate(`document.querySelector('.browser-address').value`), /^view-source:http/, 'The address bar shows view-source: while the source is open');
    await screenshot('source-automated');
    await toolbar('View Source');
    await waitFor(`document.querySelector('.follow-current').hidden`);
    assert.match(await evaluate(`document.querySelector('.browser-address').value`), /^http/, 'Closing the source drops view-source: from the address');
    const buttons = await evaluate(`[...document.querySelectorAll('.resource-action')].map(button => button.getBoundingClientRect().width)`);
    assert.ok(buttons.every((width) => width === buttons[0]), 'Resource buttons differ in width');
    assert.equal(await evaluate(`document.querySelector('.proxy-details').open`), false);
    assert.equal(await evaluate(`document.querySelector('.machine-details').open`), false);
    assert.ok(await evaluate(`[...document.querySelectorAll('.resource-action')].some((button) => /\\$/.test(button.textContent))`), 'The day job shows what it pays');
    assert.equal(await evaluate(`document.querySelectorAll('.resource-action[aria-pressed="true"]').length`), 1, 'Exactly one activity is running');
    for (const proxy of game.state.network.proxies.slice(0, 2)) proxy.diesAtSeconds = game.state.elapsedSeconds - 1;
    const unbought = upgrades.find((item) => !game.state.purchases[item.id] && item.isAvailable(game.state));
    assert.ok(unbought, 'Expected an upgrade the robot has not bought yet');
    game.state.flags[`seen:${unbought.id}`] = true;
    for (const resource of ['insight', 'money', 'data']) game.state.resources[resource] = 1_000_000;
    await importGame(game);
    await waitFor(`!/, 0 dead/.test(document.querySelector('.proxy-summary').textContent)`);
    await evaluate(`document.querySelector('.proxy-details').open = true`);
    assert.ok(await evaluate(`document.querySelector('.proxy-details').textContent.includes('203.0.113.24')`), 'The IP list shows your own address');
    if (game.state.purchases.rentedAddresses) assert.ok(await evaluate(`document.querySelector('.proxy-details').textContent.includes('198.18.0.0/28')`), 'The IP list shows rented addresses');
    await evaluate(`document.querySelectorAll('.proxy-row.dead button').forEach((button) => button.click())`);
    await waitFor(`/, 0 dead/.test(document.querySelector('.proxy-summary').textContent)`);
    await evaluate(`document.querySelector('.proxy-details').open = false`);
    await evaluate(`(()=>{const card=[...document.querySelectorAll('.upgrade-card')].find(card=>!card.hidden&&!card.disabled);if(!card)throw new Error('Expected an affordable upgrade');card.click();card.click();})()`);
    assert.equal(await evaluate(`document.querySelectorAll('.upgrade-card.leaving').length`), 1, 'A double click must purchase only one card');
    await sleep(700);
    await screenshot('setup-window', false);
    if (expectsDevelopmentTools) {
        await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:String.fromCharCode(92),bubbles:true}))`);
        assert.equal(await evaluate(`document.querySelector('.dev-panel').hidden`), false);
        await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:String.fromCharCode(92),bubbles:true}))`);
    } else assert.equal(await evaluate(`document.querySelector('.dev-panel')`), null);

    game.state.captcha = createCaptcha(game);
    game.state.network.bannedUntil = game.state.elapsedSeconds + 90;
    await importGame(game);
    await waitFor(`document.querySelector('.browser-viewport').contentDocument.querySelector('[data-captcha-input]') !== null`);
    assert.doesNotMatch(await evaluate(`document.querySelector('.browser-viewport').contentDocument.body.innerHTML`), new RegExp(`>${game.state.captcha.word}<`), 'The captcha word must not appear as plain text');
    await waitFor(`document.querySelector('.browser-viewport').contentDocument.activeElement?.matches('[data-captcha-input]') === true`);
    await screenshot('captcha');
    await assertCaptchaFits();
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    await sleep(300);
    await assertCaptchaFits();
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await evaluate(`(() => { const doc = document.querySelector('.browser-viewport').contentDocument; doc.querySelector('[data-captcha-input]').value = ${JSON.stringify(game.state.captcha.word)}; doc.querySelector('[data-captcha-submit]').click(); })()`);
    await waitFor(`document.querySelector('.browser-viewport').contentDocument.querySelector('[data-captcha-submit]') === null`);
    game.state.captcha = null;
    game.state.network.bannedUntil = 0;

    /** @type {number[]} */
    const credentialCandidates = Array.from({ length: 300 }, (_, index) => 500 + index);
    const credentialsLevel = credentialCandidates.find((level) => entrance(level).credentials !== null);
    assert.ok(credentialsLevel !== undefined, 'No credential level found in the test range');
    game.state.currentLevel = credentialsLevel - 1;
    game.state.browserUrl = urlOfLevel(game.state.currentLevel);
    game.state.jobs = { ticketing: game.stat('scriptSlots') };
    await importGame(game);
    const target = entrance(credentialsLevel);
    await navigate(target.url);
    await waitFor(`document.querySelector('dialog[open] input[type=password]') !== null`);
    await evaluate(`document.querySelector('[aria-label="User Name"]').value=${JSON.stringify(target.credentials.username)};document.querySelector('[aria-label="Password"]').value=${JSON.stringify(target.credentials.password)}`);
    await clickText('dialog[open]', 'OK');
    await waitFor(`!document.querySelector('dialog[open]')`);
    assert.equal(await evaluate(`document.querySelector('.browser-address').value`), target.url);

    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    await sleep(400);
    await assertLayout(390);
    await screenshot('narrow-full');
    await screenshot('narrow', false);
    await toolbar('View Source');
    await assertLayout(390);
    assert.equal(await evaluate(`document.querySelector('dialog[open]')`), null);
    const sourceFits = await evaluate(`(()=>{const p=document.querySelector('.source-pane').getBoundingClientRect();const c=document.querySelector('.browser-content').getBoundingClientRect();return Math.abs(p.top-c.top)<1&&p.bottom<=c.bottom+1&&document.querySelector('.browser-viewport').hidden;})()`);
    assert.ok(sourceFits, 'Narrow source view must replace the page within the same viewport');
    await screenshot('source-narrow');
    await evaluate(`document.querySelector('.dashboard').scrollIntoView()`);
    await screenshot('dashboard-narrow', false);
    assert.deepEqual(problems, [], 'Browser errors');
    console.log('Browser checks passed: opening puzzles, navigation, source, hidden text, automate, favorites, save import/export, mature UI, worker widths, dev visibility, captcha, credentials, and narrow layout.');
    console.log(`Screenshots: ${outputDirectory}`);
} finally {
    if (socket?.readyState === WebSocket.OPEN) {
        try { await send('Browser.close'); } catch {}
        socket.close();
    }
    chrome.kill();
    if (path.dirname(profileDirectory) === path.resolve(tmpdir()) && path.basename(profileDirectory).startsWith('webriddle-browser-check-')) {
        await rm(profileDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
    }
}

function send(method, params = {}) {
    return new Promise((resolve, reject) => {
        const id = ++commandId;
        const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 12000);
        pending.set(id, { resolve, reject, timeout });
        socket.send(JSON.stringify({ id, method, params }));
    });
}

async function evaluate(expression) {
    const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    return response.result?.value;
}

async function waitFor(expression) {
    for (let attempt = 0; attempt < 80; attempt++) {
        try { if (await evaluate(expression)) return; } catch {}
        await sleep(100);
    }
    throw new Error(`Timed out waiting for ${expression}`);
}

async function clickText(scope, text) {
    const found = await evaluate(`(()=>{const button=[...document.querySelectorAll(${JSON.stringify(`${scope} button`)})].find(button=>button.textContent.trim()===${JSON.stringify(text)});if(!button)return false;button.click();return true;})()`);
    assert.ok(found, `Missing button ${text}`);
}

async function menu(name, command) {
    await evaluate(`[...document.querySelectorAll('.browser-menu')].find(menu=>menu.querySelector('summary').textContent===${JSON.stringify(name)}).open=true`);
    await clickText('.browser-menu[open]', command);
}

async function closeDialog() { await clickText('dialog[open]', 'Close'); }

async function toolbar(label) {
    await evaluate(`document.querySelector(${JSON.stringify(`.tool-button[aria-label="${label}"]`)}).click()`);
}

async function navigate(address) {
    await evaluate(`document.querySelector('.browser-address').focus();document.querySelector('.browser-address').select()`);
    await send('Input.insertText', { text: address });
    const point = await evaluate(`(()=>{const r=document.querySelector('.address-bar button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
    await sleep(180);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
    await sleep(750);
}

async function importGame(game) {
    await menu('File', 'Import and Export...');
    const save = encodeExport(serializeSave(game.state, Date.now()));
    await evaluate(`document.querySelector('dialog[open] textarea').value=${JSON.stringify(save)}`);
    await clickText('dialog[open]', 'Import');
    await closeDialog();
    await sleep(400);
}

async function assertLayout(width) {
    const dimensions = await evaluate(`({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth,outside:[...document.querySelectorAll('.browser-window,.terminal-window,.panel,.resource-action')].filter(element=>element.checkVisibility()).map(element=>({className:element.className,left:element.getBoundingClientRect().left,right:element.getBoundingClientRect().right})).filter(rect=>rect.left < 0 || rect.right > document.documentElement.clientWidth + 1)})`);
    assert.ok(dimensions.scroll <= width + 1 && dimensions.body <= width + 1, `Horizontal page overflow at ${width}: ${JSON.stringify(dimensions)}`);
    assert.deepEqual(dimensions.outside, [], `Clipped panels at ${width}`);
}

async function assertCaptchaFits() {
    const dimensions = await evaluate(`(()=>{const frame=document.querySelector('.browser-viewport');return {height:frame.clientHeight,bottom:frame.contentDocument.querySelector('[data-captcha-submit]').getBoundingClientRect().bottom};})()`);
    assert.ok(dimensions.bottom <= dimensions.height, `Captcha button is below the viewport: ${JSON.stringify(dimensions)}`);
}

async function assertPageFits() {
    const size = await evaluate(`(()=>{const doc=document.querySelector('.browser-viewport').contentDocument;return {height:doc.documentElement.clientHeight,scrollHeight:doc.documentElement.scrollHeight,width:doc.documentElement.clientWidth,scrollWidth:doc.documentElement.scrollWidth};})()`);
    assert.ok(size.scrollHeight <= size.height + 1 && size.scrollWidth <= size.width + 1, `Unexpected opening-page overflow: ${JSON.stringify(size)}`);
}

async function screenshot(name, fullPage = true) {
    const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage });
    await writeFile(path.join(outputDirectory, `${name}.png`), Buffer.from(result.data, 'base64'));
}
