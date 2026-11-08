import type { Page } from '../../core/content.ts';
import type { CaptchaChallenge, GameState } from '../../core/state.ts';
import { findings } from './findings.ts';
import { imagePath } from './images.ts';
import { entrance, levelPage, presentImageId, urlOfLevel } from './levels.ts';
import { riddleOrigin } from './riddle.ts';
import { captchaText, clueLines, errorPages } from './text.ts';

function escapeHtml(text: string): string {
    return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

const riddleStyle = `*{box-sizing:border-box}html{background:#000}body{margin:0;min-height:100vh;padding:14px 18px;background:#000;color:#fff;font:18px "Times New Roman",serif;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}h1{font:14px Arial,sans-serif;margin:0 0 12px;color:#aaa}img{display:block;width:440px;max-width:100%;max-height:calc(100vh - 140px);object-fit:contain;image-rendering:pixelated;border:0}p{margin:10px 0 0}a{color:#a5bfff;max-width:100%}::selection{background:#3459b1;color:#fff}`;

function documentPage(title: string, body: string, statusCode = 200, style = riddleStyle): Page {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${style}</style></head><body>${body}</body></html>`;
    return { title, html, source: html, statusCode };
}

function renderLevel(level: number): Page {
    const page = levelPage(level);
    const body = (image: string): string => [
        `<h1>Level ${level}</h1>`,
        page.imageLink ? `<a href="${page.imageLink}"><img src="${image}" alt=""></a>` : `<img src="${image}" alt="">`,
        ...page.lines.map((line) => `<p>${page.imageLink ? `<a href="${page.imageLink}">${escapeHtml(line)}</a>` : escapeHtml(line)}</p>`),
        page.hiddenText ? `<p style="color:#000">${escapeHtml(page.hiddenText)}</p>` : '',
        page.doorLink ? `<p><a href="${page.doorLink}">${clueLines.enter}</a></p>` : '',
        page.comment ? `<!-- ${page.comment.replaceAll('-->', '--&gt;')} -->` : '',
    ].filter(Boolean).join('\n');
    const rendered = documentPage(page.title, body(imagePath(page.imageId)));
    const source = `<html lang="en">\n<head>\n<title>${escapeHtml(page.title)}</title>\n</head>\n<body style="background:#000;color:#fff;text-align:center">\n${body(page.imageName)}\n</body>\n</html>`;
    return { ...rendered, source };
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
    if (!address.startsWith(`${riddleOrigin}/`)) return errorPage(true);
    if (address === `${riddleOrigin}/present.gif`) return documentPage('present.gif', `<img src="${imagePath(presentImageId())}" alt="">`);
    const known = state.visitedLevels[address];
    if (known !== undefined) return renderLevel(known);
    if (address === urlOfLevel(state.currentLevel)) return renderLevel(state.currentLevel);
    if (address.endsWith('.jpg')) {
        const levels = [state.currentLevel, ...Object.values(state.visitedLevels)];
        for (const level of levels) {
            const page = levelPage(level);
            if (address === canonicalUrl(new URL(page.imageName, page.url).href)) {
                return documentPage(page.imageName, `<img src="${imagePath(page.imageId)}" alt="">`);
            }
        }
    }
    const next = entrance(state.currentLevel + 1);
    if (address === next.url && next.credentials !== null) {
        return { ...documentPage(errorPages.unauthorizedTitle, `<p>${errorPages.unauthorizedBody}</p>`, 401), loginRealm: next.folder ?? 'riddle' };
    }
    const finding = findings.find((candidate) => address === `${riddleOrigin}/${candidate.path}` && state.findings[candidate.id]);
    if (finding) return documentPage(finding.path, `<pre>${escapeHtml(finding.fileContent)}</pre>`);
    return errorPage(false);
}

function errorPage(unavailable: boolean): Page {
    const title = unavailable ? errorPages.unavailableTitle : errorPages.notFoundTitle;
    return documentPage(title, `<h2>${title}</h2><p>${unavailable ? errorPages.unavailableBody : errorPages.notFoundBody}</p><hr><p>${errorPages.pleaseTry}</p><ul>${errorPages.notFoundTips.map((tip) => `<li>${tip}</li>`).join('')}</ul><small>${unavailable ? errorPages.unavailableCode : errorPages.notFoundCode}</small>`, unavailable ? 0 : 404,
        'body{background:#111;color:#ccc;margin:36px;font:13px Verdana,sans-serif;line-height:1.8}h2{font-size:20px}hr{border:0;border-top:1px solid #444}');
}

function captchaPage(challenge: CaptchaChallenge, rejected: boolean): Page {
    const checkbox = `<button class="checkbox" data-captcha-checkbox>□ &nbsp; ${captchaText.checkbox}</button>`;
    const images = `<p>${captchaText.selectAll} <strong>${escapeHtml(challenge.subject)}</strong></p><div class="grid">${challenge.imageIds.map((id, index) => `<button class="tile" data-captcha-tile="${index}" aria-pressed="false"><img src="${imagePath(id)}" alt="Tile ${index + 1}"></button>`).join('')}</div>`;
    const word = `<p>${captchaText.typeWord}</p><svg width="280" height="80" viewBox="0 0 280 80"><path d="M0 40 Q80 0 280 60" fill="none" stroke="#859cba"/><text x="16" y="54" font-family="Georgia" font-style="italic" font-size="32" letter-spacing="4" fill="#d8d8d8" transform="rotate(-4 140 40)">${escapeHtml(challenge.word)}</text></svg><input data-captcha-input aria-label="${captchaText.typeWord}" autocomplete="off">`;
    return documentPage(captchaText.title, `<h2>${captchaText.title}</h2><p>${captchaText.automated}</p><div class="box">${challenge.stage === 'checkbox' ? checkbox : `${challenge.kind === 'images' ? images : word}<div class="footer"><span>${rejected ? captchaText.tryAgain : ''}</span><button data-captcha-verify>${captchaText.verify}</button></div>`}</div>`, 429,
        'body{margin:8px 12px;background:#111;color:#ddd;font:13px Arial;text-align:center}h2{font-size:18px;margin:0 0 4px}p{margin:0}.box{width:264px;max-width:100%;margin:8px auto;padding:8px;border:1px solid #555;background:#202020;box-sizing:border-box}.box p{margin-bottom:6px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.tile{padding:0;border:0;aspect-ratio:1;min-width:0;background:#333;cursor:pointer}.tile img{width:100%;height:100%;object-fit:cover;display:block}.tile[aria-pressed=true]{outline:4px solid #6d9fef;outline-offset:-4px;transform:scale(.9)}button{padding:6px;background:#3459a1;color:white;border:1px solid #7694cc;cursor:pointer}.checkbox{width:100%;padding:22px 4px;background:#292929;color:#eee;border:0;font-size:17px}.footer{display:flex;justify-content:space-between;align-items:center;margin-top:8px;color:#f2a3a3}svg{max-width:100%}input{box-sizing:border-box;width:100%;padding:8px;background:#111;border:1px solid #666;color:#fff}@media(max-height:400px){.box{width:224px}}');
}
