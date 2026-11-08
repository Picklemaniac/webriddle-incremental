import type { Page } from '../../core/content.ts';
import type { CaptchaChallenge, GameState } from '../../core/state.ts';
import { findingFile, findings } from './findings.ts';
import { imagePath } from './images.ts';
import { entrance, inWildcardFolder, levelPage, urlOfLevel, type LevelPage } from './levels.ts';
import { riddleOrigin } from './riddle.ts';
import { startPage } from './start-pages.ts';
import { alternateFiles, captchaText, errorPages, fill, pageText } from './text.ts';

const scrollbarStyle = "::-webkit-scrollbar { width: 16px; height: 16px; }::-webkit-scrollbar-track { background: repeating-conic-gradient(#c0c0c0 0% 25%, #fff 0% 50%) 0 0 / 2px 2px; }::-webkit-scrollbar-thumb { background: #c0c0c0; box-shadow: inset -1px -1px #000, inset 1px 1px #dfdfdf, inset -2px -2px #808080, inset 2px 2px #fff; }::-webkit-scrollbar-button:vertical:start:decrement, ::-webkit-scrollbar-button:vertical:end:increment, ::-webkit-scrollbar-button:horizontal:start:decrement, ::-webkit-scrollbar-button:horizontal:end:increment { display: block; width: 16px; height: 16px; background-color: #c0c0c0; background-repeat: no-repeat; background-position: center; box-shadow: inset -1px -1px #000, inset 1px 1px #dfdfdf, inset -2px -2px #808080, inset 2px 2px #fff; }::-webkit-scrollbar-button:vertical:start:decrement { background-image: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='7' height='4' shape-rendering='crispEdges'><path d='M3 0h1v1h1v1h1v1h1v1H0V3h1V2h1V1h1z'/></svg>\"); }::-webkit-scrollbar-button:vertical:end:increment { background-image: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='7' height='4' shape-rendering='crispEdges'><path d='M0 0h7v1H6v1H5v1H4v1H3V3H2V2H1V1H0z'/></svg>\"); }::-webkit-scrollbar-button:horizontal:start:decrement { background-image: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='7' shape-rendering='crispEdges'><path d='M3 0h1v7H3V6H2V5H1V4H0V3h1V2h1V1h1z'/></svg>\"); }::-webkit-scrollbar-button:horizontal:end:increment { background-image: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='7' shape-rendering='crispEdges'><path d='M0 0h1v1h1v1h1v1h1v1H3v1H2v1H1v1H0z'/></svg>\"); }::-webkit-scrollbar-button:active { box-shadow: inset 1px 1px #808080; }::-webkit-scrollbar-corner { background: #c0c0c0; }";

const pictureWidth = 440;
const pictureHeight = 294;

const pictureStyle = '.picture{position:relative;display:block;border:2px solid #f2f2f2;box-shadow:0 0 0 1px #000,0 0 8px 1px rgba(255,255,255,.55),0 0 26px 6px rgba(255,255,255,.14)}' +
    '.picture img{display:block;width:100%;height:auto;image-rendering:pixelated}' +
    '.number{position:absolute;left:10px;top:7px;font:bold 28px/1 Verdana,Tahoma,sans-serif;color:#fff;text-shadow:-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000,0 -2px 0 #000,0 2px 0 #000,-2px 0 0 #000,2px 0 0 #000,0 0 12px rgba(255,255,255,.8)}';

const levelStyle = '*{box-sizing:border-box}html,body{height:100%}' +
    'body{margin:0;padding:12px 16px;background:#000;color:#ddd;font:18px "Times New Roman",Times,serif;text-align:center;display:flex;flex-direction:column;justify-content:center}' +
    `.picture{width:min(${pictureWidth + 4}px,100%,calc((100vh - 120px) * 1.5));margin:0 auto}${pictureStyle}` +
    '.swatches{display:flex;justify-content:center;gap:8px;margin-top:16px}.swatches span{width:26px;height:26px;border:1px solid #555}p{margin:16px 0 0;white-space:nowrap}p+p{margin-top:6px}.hidden{color:#000}a{color:#fff}::selection{background:#3459b1;color:#fff}';

const imageStyle = `*{box-sizing:border-box}body{margin:8px;background:#000}img{display:block;width:${pictureWidth}px;image-rendering:pixelated}.picture{width:${pictureWidth + 4}px}${pictureStyle}`;

const textFileStyle = 'body{margin:8px;background:#000;color:#ddd}pre{margin:0;font:13px "Courier New",monospace}';

const drawnTextStyle = 'body{margin:8px;background:#000}.drawn{display:inline-block;padding:28px 36px;background:#101010;color:#f0f0f0;border:2px solid #f2f2f2;font:bold 44px "Courier New",monospace;letter-spacing:4px}';

const captchaStyle = 'body{margin:16px 20px;background:#fff;color:#000;font:16px "Times New Roman",Times,serif}h1{margin:0 0 12px;font-size:28px}p{margin:10px 0}.captcha{display:block;max-width:100%;height:auto;border:1px solid #808080}.error{color:#c00000}input{font:15px "Courier New",monospace}button{font:13px Tahoma,Arial,sans-serif}.link{padding:0;border:0;background:none;color:#0000ee;text-decoration:underline;cursor:pointer;font:16px "Times New Roman",Times,serif}hr{border:0;border-top:1px solid #808080;margin:18px 0 8px}address{font-style:italic;font-size:14px}';

const errorStyle = 'body{background:#111;color:#ccc;margin:36px;font:13px Verdana,sans-serif;line-height:1.8}h2{font-size:20px}hr{border:0;border-top:1px solid #444}';

function escapeHtml(text: string): string {
    return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function documentPage(title: string, body: string, statusCode: number, style: string, source?: string): Page {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${scrollbarStyle}${style}</style></head><body>${body}</body></html>`;
    return { title, html, source: source ?? html, statusCode };
}

function textFilePage(name: string, text: string): Page {
    return documentPage(name, `<pre>${escapeHtml(text)}</pre>`, 200, textFileStyle, text);
}

function imageFilePage(name: string, body: string, style: string): Page {
    return documentPage(name, body, 200, style, binaryText(name));
}

function binaryText(name: string): string {
    let seed = [...name].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619), 2166136261);
    let text = name.endsWith('.gif') ? 'GIF89a' : 'ÿØÿà JFIF  H H  ÿÛ C ';
    for (let index = 0; index < 2400; index++) {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        const byte = seed >>> 24;
        text += byte === 10 ? '\n' : byte < 32 || (byte > 126 && byte < 161) || byte === 60 || byte === 62 ? ' ' : String.fromCharCode(byte);
    }
    return text;
}

function picture(page: LevelPage): string {
    const title = page.imageTitle === null ? '' : ` title="${escapeHtml(page.imageTitle)}"`;
    return `<span class="picture"><img src="${imagePath(page.imageId)}" alt=""${title}><span class="number">${page.level}</span></span>`;
}

function relativeLink(from: string, to: string): string {
    const folder = from.slice(0, from.lastIndexOf('/') + 1);
    return to.startsWith(folder) ? to.slice(folder.length) : new URL(to).pathname;
}

function renderLevel(level: number): Page {
    const page = levelPage(level);
    const link = page.link === null ? null : relativeLink(page.url, page.link);
    const body = [
        link === null ? picture(page) : `<a href="${link}">${picture(page)}</a>`,
        ...page.lines.map((line) => `<p>${escapeHtml(line)}</p>`),
        page.colors.length === 0 ? '' : `<div class="swatches">${page.colors.map((color) => `<span style="background:${color}"></span>`).join('')}</div>`,
        page.hiddenText === null ? '' : `<p class="hidden">${escapeHtml(page.hiddenText)}</p>`,
    ].join('');
    return { ...documentPage(page.title, body, 200, levelStyle), source: levelSource(page, link) };
}

function levelSource(page: LevelPage, link: string | null): string {
    const title = page.imageTitle === null ? '' : ` title="${escapeHtml(page.imageTitle)}"`;
    const image = `<img src="${page.imageName}" width="${pictureWidth}" height="${pictureHeight}" border="0"${title}>`;
    return [
        '<html>',
        '<head>',
        `<title>${escapeHtml(page.title)}</title>`,
        '</head>',
        '<body bgcolor="#000000" text="#DDDDDD" link="#FFFFFF" vlink="#FFFFFF">',
        '<center>',
        link === null ? image : `<a href="${link}">${image}</a>`,
        ...page.lines.map((line) => `<p><font face="Times New Roman" size="4">${escapeHtml(line)}</font></p>`),
        ...(page.colors.length === 0 ? [] : [`<table border="0" cellspacing="6"><tr>${page.colors.map((color) => `<td bgcolor="${color}" width="26" height="26"></td>`).join('')}</tr></table>`]),
        ...(page.hiddenText === null ? [] : [`<p><font color="#000000">${escapeHtml(page.hiddenText)}</font></p>`]),
        '</center>',
        ...page.comments.map((comment) => `<!-- ${comment.replaceAll('-->', '--&gt;')} -->`),
        '</body>',
        '</html>',
    ].join('\n');
}

export function canonicalUrl(url: string): string {
    try {
        const parsed = new URL(url, `${riddleOrigin}/`);
        return `${parsed.origin}${decodeURIComponent(parsed.pathname).toLowerCase()}`;
    } catch { return url; }
}

export function resolvePage(url: string, state: GameState): Page {
    const address = canonicalUrl(url);
    const banned = state.captcha !== null && state.network.bannedUntil > state.elapsedSeconds;
    if (banned && address.startsWith(`${riddleOrigin}/`)) return captchaPage(state.captcha!, state.flags.captchaRejected === true);
    const start = startPage(address, scrollbarStyle, pictureStyle);
    if (start !== null) return start;
    if (!address.startsWith(`${riddleOrigin}/`)) return errorPage('unavailable');
    if (address === `${riddleOrigin}/present.gif`) return imageFilePage('present.gif', `<div class="drawn">${entrance(7).answer}</div>`, drawnTextStyle);
    const known = state.visitedLevels[address];
    if (known !== undefined) return renderLevel(known);
    if (address === urlOfLevel(state.currentLevel)) return renderLevel(state.currentLevel);
    const alternate = alternatePage(address, state);
    if (alternate !== null) return alternate;
    if (address.endsWith('.jpg')) {
        for (const level of [state.currentLevel, ...Object.values(state.visitedLevels)]) {
            const page = levelPage(level);
            if (address === canonicalUrl(new URL(page.imageName, page.url).href)) return imageFilePage(page.imageName, picture(page), imageStyle);
        }
    }
    const next = entrance(state.currentLevel + 1);
    if (address === next.url && next.credentials !== null) return { ...errorPage('unauthorized'), loginRealm: next.folder ?? 'riddle' };
    const finding = findings.find((candidate) => address === `${riddleOrigin}/${candidate.path}` && state.findings[candidate.id]);
    if (finding) return textFilePage(finding.path, findingFile(finding, state));
    if (inWildcardFolder(address)) return documentPage('', `<p>${pageText.wildcardPage}</p>`, 200, levelStyle);
    return errorPage('notFound');
}

function alternatePage(address: string, state: GameState): Page | null {
    for (const level of [state.currentLevel, ...Object.values(state.visitedLevels)]) {
        const { alternate, imageName, url } = levelPage(level);
        if (alternate === null) continue;
        const name = imageName.replace(/\.jpg$/, `.${alternate.extension}`);
        if (address !== canonicalUrl(new URL(name, url).href)) continue;
        return alternate.extension === 'gif'
            ? imageFilePage(name, `<div class="drawn">${escapeHtml(alternate.text)}</div>`, drawnTextStyle)
            : textFilePage(name, fill(alternateFiles[alternate.extension], { word: alternate.text }));
    }
    return null;
}

function errorPage(kind: 'notFound' | 'unavailable' | 'unauthorized'): Page {
    const text = {
        notFound: { title: errorPages.notFoundTitle, body: errorPages.notFoundBody, tips: errorPages.notFoundTips, code: errorPages.notFoundCode, statusCode: 404 },
        unavailable: { title: errorPages.unavailableTitle, body: errorPages.unavailableBody, tips: errorPages.notFoundTips, code: errorPages.unavailableCode, statusCode: 0 },
        unauthorized: { title: errorPages.unauthorizedTitle, body: errorPages.unauthorizedBody, tips: errorPages.unauthorizedTips, code: errorPages.unauthorizedCode, statusCode: 401 },
    }[kind];
    return documentPage(text.title, `<h2>${text.title}</h2><p>${text.body}</p><hr><p>${errorPages.pleaseTry}</p><ul>${text.tips.map((tip) => `<li>${tip}</li>`).join('')}</ul><small>${text.code}</small>`,
        text.statusCode, errorStyle);
}

function captchaPage(challenge: CaptchaChallenge, rejected: boolean): Page {
    const server = fill(captchaText.server, { host: new URL(riddleOrigin).host });
    const page = (picture: string): string => [
        `<h1>${captchaText.title}</h1>`,
        `<p>${captchaText.explanation}</p>`,
        `<p>${captchaText.typeWord}</p>`,
        picture,
        rejected ? `<p class="error">${captchaText.tryAgain}</p>` : '',
        `<p><input data-captcha-input aria-label="${captchaText.typeWord}" autocomplete="off" spellcheck="false" size="16"> <button data-captcha-submit>${captchaText.submit}</button></p>`,
        `<p><button class="link" data-captcha-refresh>${captchaText.newPicture}</button></p>`,
        `<hr><address>${server}</address>`,
    ].join('\n');
    const html = documentPage(captchaText.title, page(captchaPicture(challenge.word)), 429, captchaStyle);
    return { ...html, source: `<html>\n<head>\n<title>${captchaText.title}</title>\n</head>\n<body>\n${page('<img src="/captcha.php" width="260" height="70" alt="">')}\n</body>\n</html>` };
}

function captchaPicture(word: string): string {
    let seed = [...word].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619), 2166136261) >>> 0;
    const random = (): number => {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        return seed / 4294967296;
    };
    const fonts = ['Georgia', 'Times New Roman', 'Courier New', 'Verdana'];
    const spacing = 30;
    const start = (260 - spacing * (word.length - 1)) / 2;
    const letters = [...word].map((letter, index) => {
        const x = start + index * spacing + (random() - 0.5) * 8;
        const y = 46 + (random() - 0.5) * 14;
        const rotation = (random() - 0.5) * 50;
        return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${fonts[Math.floor(random() * fonts.length)]}" font-size="${Math.round(36 + random() * 8)}" font-weight="bold" text-anchor="middle" transform="rotate(${rotation.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">${escapeHtml(letter)}</text>`;
    });
    const curve = (): string => `<path d="M0 ${(20 + random() * 30).toFixed(0)} C80 ${(random() * 70).toFixed(0)} 180 ${(random() * 70).toFixed(0)} 260 ${(20 + random() * 30).toFixed(0)}" fill="none" stroke="#555" stroke-width="1.5"/>`;
    const specks = Array.from({ length: 40 }, () => `<rect x="${(random() * 260).toFixed(0)}" y="${(random() * 70).toFixed(0)}" width="2" height="2" fill="#555"/>`);
    return [
        '<svg class="captcha" width="260" height="70" viewBox="0 0 260 70" role="img">',
        `<defs><filter id="warp"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="${seed % 1000}"/><feDisplacementMap in="SourceGraphic" scale="6"/></filter></defs>`,
        '<rect width="260" height="70" fill="#e4e4dc"/>',
        `<g filter="url(#warp)" fill="#1c1c1c">${letters.join('')}${curve()}${curve()}</g>`,
        specks.join(''),
        '</svg>',
    ].join('');
}
