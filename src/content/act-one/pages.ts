import type { Page } from '../../core/content.ts';
import type { CaptchaChallenge, GameState } from '../../core/state.ts';
import { findingFile, findings } from './findings.ts';
import { imagePath } from './images.ts';
import { entrance, inWildcardFolder, levelPage, presentImageId, urlOfLevel, type LevelPage } from './levels.ts';
import { riddleOrigin } from './riddle.ts';
import { captchaText, errorPages, pageText } from './text.ts';

const scrollbarStyle = "::-webkit-scrollbar { width: 16px; height: 16px; }::-webkit-scrollbar-track { background: repeating-conic-gradient(#c0c0c0 0% 25%, #fff 0% 50%) 0 0 / 2px 2px; }::-webkit-scrollbar-thumb { background: #c0c0c0; box-shadow: inset -1px -1px #000, inset 1px 1px #dfdfdf, inset -2px -2px #808080, inset 2px 2px #fff; }::-webkit-scrollbar-button:vertical:start:decrement, ::-webkit-scrollbar-button:vertical:end:increment, ::-webkit-scrollbar-button:horizontal:start:decrement, ::-webkit-scrollbar-button:horizontal:end:increment { display: block; width: 16px; height: 16px; background-color: #c0c0c0; background-repeat: no-repeat; background-position: center; box-shadow: inset -1px -1px #000, inset 1px 1px #dfdfdf, inset -2px -2px #808080, inset 2px 2px #fff; }::-webkit-scrollbar-button:vertical:start:decrement { background-image: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='7' height='4' shape-rendering='crispEdges'><path d='M3 0h1v1h1v1h1v1h1v1H0V3h1V2h1V1h1z'/></svg>\"); }::-webkit-scrollbar-button:vertical:end:increment { background-image: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='7' height='4' shape-rendering='crispEdges'><path d='M0 0h7v1H6v1H5v1H4v1H3V3H2V2H1V1H0z'/></svg>\"); }::-webkit-scrollbar-button:horizontal:start:decrement { background-image: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='7' shape-rendering='crispEdges'><path d='M3 0h1v7H3V6H2V5H1V4H0V3h1V2h1V1h1z'/></svg>\"); }::-webkit-scrollbar-button:horizontal:end:increment { background-image: url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='7' shape-rendering='crispEdges'><path d='M0 0h1v1h1v1h1v1h1v1H3v1H2v1H1v1H0z'/></svg>\"); }::-webkit-scrollbar-button:active { box-shadow: inset 1px 1px #808080; }::-webkit-scrollbar-corner { background: #c0c0c0; }";

const pictureWidth = 440;
const pictureHeight = 294;

const pictureStyle = '.picture{position:relative;display:block;border:2px solid #f2f2f2;box-shadow:0 0 0 1px #000,0 0 8px 1px rgba(255,255,255,.55),0 0 26px 6px rgba(255,255,255,.14)}' +
    '.picture img{display:block;width:100%;height:auto;image-rendering:pixelated}' +
    '.number{position:absolute;left:10px;top:7px;font:bold 28px/1 Verdana,Tahoma,sans-serif;color:#fff;text-shadow:-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000,0 -2px 0 #000,0 2px 0 #000,-2px 0 0 #000,2px 0 0 #000,0 0 12px rgba(255,255,255,.8)}';

const levelStyle = '*{box-sizing:border-box}html,body{height:100%}' +
    'body{margin:0;padding:12px 16px;background:#000;color:#ddd;font:18px "Times New Roman",Times,serif;text-align:center;display:flex;flex-direction:column;justify-content:center}' +
    `.picture{width:min(${pictureWidth + 4}px,100%,calc((100vh - 120px) * 1.5));margin:0 auto}${pictureStyle}` +
    'p{margin:16px 0 0;white-space:nowrap}p+p{margin-top:6px}.hidden{color:#000}a{color:#fff}::selection{background:#3459b1;color:#fff}';

const imageStyle = `*{box-sizing:border-box}body{margin:8px;background:#000}img{display:block;width:${pictureWidth}px;image-rendering:pixelated}.picture{width:${pictureWidth + 4}px}${pictureStyle}`;

const textFileStyle = 'body{margin:8px;background:#000;color:#ddd}pre{margin:0;font:13px "Courier New",monospace}';

const errorStyle = 'body{background:#111;color:#ccc;margin:36px;font:13px Verdana,sans-serif;line-height:1.8}h2{font-size:20px}hr{border:0;border-top:1px solid #444}';

function escapeHtml(text: string): string {
    return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function documentPage(title: string, body: string, statusCode: number, style: string): Page {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${scrollbarStyle}${style}</style></head><body>${body}</body></html>`;
    return { title, html, source: html, statusCode };
}

function picture(page: LevelPage): string {
    return `<span class="picture"><img src="${imagePath(page.imageId)}" alt=""><span class="number">${page.level}</span></span>`;
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
        page.hiddenText === null ? '' : `<p class="hidden">${escapeHtml(page.hiddenText)}</p>`,
    ].join('');
    return { ...documentPage(page.title, body, 200, levelStyle), source: levelSource(page, link) };
}

function levelSource(page: LevelPage, link: string | null): string {
    const image = `<img src="${page.imageName}" width="${pictureWidth}" height="${pictureHeight}" border="0">`;
    return [
        '<html>',
        '<head>',
        `<title>${escapeHtml(page.title)}</title>`,
        '</head>',
        '<body bgcolor="#000000" text="#DDDDDD" link="#FFFFFF" vlink="#FFFFFF">',
        '<center>',
        link === null ? image : `<a href="${link}">${image}</a>`,
        ...page.lines.map((line) => `<p><font face="Times New Roman" size="4">${escapeHtml(line)}</font></p>`),
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
    if (state.captcha !== null && state.network.bannedUntil > state.elapsedSeconds) return captchaPage(state.captcha, state.flags.captchaRejected === true);
    const address = canonicalUrl(url);
    if (!address.startsWith(`${riddleOrigin}/`)) return errorPage('unavailable');
    if (address === `${riddleOrigin}/present.gif`) return documentPage('present.gif', `<img src="${imagePath(presentImageId())}" alt="">`, 200, imageStyle);
    const known = state.visitedLevels[address];
    if (known !== undefined) return renderLevel(known);
    if (address === urlOfLevel(state.currentLevel)) return renderLevel(state.currentLevel);
    if (address.endsWith('.jpg')) {
        for (const level of [state.currentLevel, ...Object.values(state.visitedLevels)]) {
            const page = levelPage(level);
            if (address === canonicalUrl(new URL(page.imageName, page.url).href)) return documentPage(page.imageName, picture(page), 200, imageStyle);
        }
    }
    const next = entrance(state.currentLevel + 1);
    if (address === next.url && next.credentials !== null) return { ...errorPage('unauthorized'), loginRealm: next.folder ?? 'riddle' };
    const finding = findings.find((candidate) => address === `${riddleOrigin}/${candidate.path}` && state.findings[candidate.id]);
    if (finding) return documentPage(finding.path, `<pre>${escapeHtml(findingFile(finding, state))}</pre>`, 200, textFileStyle);
    if (inWildcardFolder(address)) return documentPage('', `<p>${pageText.wildcardPage}</p>`, 200, levelStyle);
    return errorPage('notFound');
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
    const checkbox = `<button class="checkbox" data-captcha-checkbox>□ &nbsp; ${captchaText.checkbox}</button>`;
    const images = `<p>${captchaText.selectAll} <strong>${escapeHtml(challenge.subject)}</strong></p><div class="grid">${challenge.imageIds.map((id, index) => `<button class="tile" data-captcha-tile="${index}" aria-pressed="false"><img src="${imagePath(id)}" alt="Tile ${index + 1}"></button>`).join('')}</div>`;
    const word = `<p>${captchaText.typeWord}</p><svg width="280" height="80" viewBox="0 0 280 80"><path d="M0 40 Q80 0 280 60" fill="none" stroke="#859cba"/><text x="16" y="54" font-family="Georgia" font-style="italic" font-size="32" letter-spacing="4" fill="#d8d8d8" transform="rotate(-4 140 40)">${escapeHtml(challenge.word)}</text></svg><input data-captcha-input aria-label="${captchaText.typeWord}" autocomplete="off">`;
    return documentPage(captchaText.title, `<h2>${captchaText.title}</h2><p>${captchaText.automated}</p><div class="box">${challenge.stage === 'checkbox' ? checkbox : `${challenge.kind === 'images' ? images : word}<div class="footer"><span>${rejected ? captchaText.tryAgain : ''}</span><button data-captcha-verify>${captchaText.verify}</button></div>`}</div>`, 429,
        'body{margin:8px 12px;background:#111;color:#ddd;font:13px Arial;text-align:center}h2{font-size:18px;margin:0 0 4px}p{margin:0}.box{width:264px;max-width:100%;margin:8px auto;padding:8px;border:1px solid #555;background:#202020;box-sizing:border-box}.box p{margin-bottom:6px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.tile{padding:0;border:0;aspect-ratio:1;min-width:0;background:#333;cursor:pointer}.tile img{width:100%;height:100%;object-fit:cover;display:block}.tile[aria-pressed=true]{outline:4px solid #6d9fef;outline-offset:-4px;transform:scale(.9)}button{padding:6px;background:#3459a1;color:white;border:1px solid #7694cc;cursor:pointer}.checkbox{width:100%;padding:22px 4px;background:#292929;color:#eee;border:0;font-size:17px}.footer{display:flex;justify-content:space-between;align-items:center;margin-top:8px;color:#f2a3a3}svg{max-width:100%}input{box-sizing:border-box;width:100%;padding:8px;background:#111;border:1px solid #666;color:#fff}@media(max-height:400px){.box{width:224px}}');
}
