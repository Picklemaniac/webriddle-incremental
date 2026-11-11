import type { Page } from '../../core/content.ts';
import type { CaptchaChallenge, GameState } from '../../core/state.ts';
import { findingFile, findings } from './findings.ts';
import { captchaStyle, defaultReservedHeight, errorStyle, gifStyle, imageStyle, levelStyle, noteStyle, pictureHeight, pictureWidth, scrollbarStyle, soundStyle, textFileStyle } from './page-styles.ts';
import { contentType, doctype, formatSource } from './html-source.ts';
import { imagePath } from './images.ts';
import { drawPicture, type Picture } from './drawings.ts';
import { entrance, inWildcardFolder, levelPage, urlOfLevel, type LevelFile, type LevelPage } from './levels.ts';
import { isRiddleAddress, nextSeed, riddleOrigin, textSeed } from './riddle.ts';
import { soundData, type Sound } from './sounds.ts';
import { startPage } from './start-pages.ts';
import { captchaText, errorPages, fill, pageText } from './text.ts';

const hotspotWidthPercent = 8;
const hotspotHeightPercent = 12;

function escapeHtml(text: string): string {
    return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function documentPage(title: string, body: string, statusCode: number, style: string, source?: string): Page {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${scrollbarStyle}${style}</style></head><body>${body}</body></html>`;
    return { title, html, source: source ?? formatSource(`<html><head><title>${escapeHtml(title)}</title></head><body>${body}</body></html>`), statusCode };
}

function textFilePage(name: string, text: string): Page {
    return documentPage(name, `<pre>${escapeHtml(text)}</pre>`, 200, textFileStyle, text);
}

function imageFilePage(name: string, body: string, style: string, note: string | null = null, zipped: string | null = null): Page {
    return documentPage(name, body, 200, style, binaryText(name, note, zipped));
}

function pictureTag(picture: Picture, address: string, width = picture.width, height = picture.height, className = ''): string {
    return `<img src="${picture.src}" width="${width}" height="${height}" alt="" data-address="${escapeHtml(address)}"${className === '' ? '' : ` class="${className}"`}>`;
}

function soundFilePage(name: string, sound: Sound): Page {
    return documentPage(name, `<audio controls src="${soundData(sound)}"></audio>`, 200, soundStyle, binaryText(name));
}

function binaryText(name: string, note: string | null = null, zipped: string | null = null): string {
    let seed = textSeed(name);
    const noteAtEnd = (seed & 1) === 1;
    let text = name.endsWith('.gif') ? 'GIF89a' : name.endsWith('.wav') ? 'RIFF$ü  WAVEfmt        @   @     data ü ' : `ÿØÿà JFIF  H H  ${note === null || noteAtEnd ? '' : `ÿþ ${note} `}ÿÛ C `;
    for (let index = 0; index < 2400; index++) {
        seed = nextSeed(seed);
        const byte = seed >>> 24;
        text += byte === 10 ? '\n' : byte < 32 || (byte > 126 && byte < 161) || byte === 60 || byte === 62 ? ' ' : String.fromCharCode(byte);
    }
    if (note !== null && noteAtEnd) text += `ÿÙ${note}`;
    if (zipped !== null) text += `ÿÙPK         ${zipped}.htm³Ê  ÷   PK         ${zipped}.htmPK      `;
    return text;
}

function picture(page: LevelPage, withExtras = false): string {
    const title = page.imageTitle === null ? '' : ` title="${escapeHtml(page.imageTitle)}"`;
    const target = page.files.find((file) => file.linked === 'hotspot');
    const spot = withExtras && target !== undefined && page.hotspot !== null
        ? `<a class="spot" href="${target.name}" style="left:${(page.hotspot.x * 100).toFixed(1)}%;top:${(page.hotspot.y * 100).toFixed(1)}%;width:${hotspotWidthPercent}%;height:${hotspotHeightPercent}%"></a>` : '';
    const rollover = page.files.find((file) => file.display === 'rollover');
    const over = withExtras && rollover !== undefined && 'drawing' in rollover.content
        ? `<img class="over" src="${drawPicture(rollover.content.drawing).src}" alt="" data-address="${escapeHtml(rollover.name)}">` : '';
    return `<span class="picture"><img src="${imagePath(page.imageId)}" alt="" data-address="${escapeHtml(page.imageName)}"${title}>${over}<span class="number">${page.level}</span>${spot}</span>`;
}

function lineHtml(line: string, dark: (part: string) => string): string {
    return line.split(/\[\[|\]\]/).map((part, index) => (index % 2 === 1 ? dark(escapeHtml(part)) : escapeHtml(part))).join('');
}

function emphasisHtml(line: readonly { readonly text: string; readonly bold: boolean }[]): string {
    return line.map((segment) => (segment.bold ? `<b>${escapeHtml(segment.text)}</b>` : escapeHtml(segment.text))).join('');
}

function relativeLink(from: string, to: string): string {
    const folder = from.slice(0, from.lastIndexOf('/') + 1);
    if (to.startsWith(folder)) return to.slice(folder.length);
    return new URL(from).origin === new URL(to).origin ? new URL(to).pathname : to;
}

function renderLevel(level: number): Page {
    const page = levelPage(level);
    const link = page.link === null ? page.files.find((file) => file.linked === 'pictureLink')?.name ?? null : relativeLink(page.url, page.link);
    let reserved = defaultReservedHeight + (page.grid.length === 0 ? 0 : page.grid.length * 14 + 16) + (page.spans.length === 0 ? 0 : 40);
    const embedded = page.files.map((file) => {
        if (file.linked === 'image' && 'drawing' in file.content) {
            if (file.display === 'hidden' || file.display === 'rollover') return '';
            const drawing = drawPicture(file.content.drawing);
            if (file.display === 'squashed') {
                reserved += 19;
                return `<p class="drawing">${pictureTag(drawing, file.name, pictureWidth, 3, 'squashed')}</p>`;
            }
            reserved += drawing.height + 16;
            return `<p class="drawing">${pictureTag(drawing, file.name)}</p>`;
        }
        if (file.linked === 'sound' && 'sound' in file.content) {
            reserved += 48;
            return `<p><audio controls src="${soundData(file.content.sound)}"></audio></p>`;
        }
        return '';
    });
    const body = [
        link === null ? picture(page, true) : `<a href="${link}">${picture(page)}</a>`,
        ...page.lines.map((line) => `<p>${lineHtml(line, (part) => `<span class="hidden">${part}</span>`)}</p>`),
        ...embedded,
        page.spans.length === 0 ? '' : `<p>${page.spans.map((span) => `<span class="c${span.order}">${escapeHtml(span.letter)}</span>`).join(' ')}</p>`,
        ...page.emphasis.map((line) => `<p>${emphasisHtml(line)}</p>`),
        page.spacers.length === 0 ? '' : `<p>${page.spacers.map((width) => pictureTag(drawPicture({ kind: 'spacer', text: '' }), 'spacer.gif', width, 1)).join('')}</p>`,
        page.grid.length === 0 ? '' : `<pre class="grid">${escapeHtml(page.grid.join('\n'))}</pre>`,
        page.colors.length === 0 ? '' : `<div class="swatches">${page.colors.map((color) => `<span style="background:${color}"></span>`).join('')}</div>`,
        page.hiddenText === null ? '' : `<p class="hidden">${escapeHtml(page.hiddenText)}</p>`,
        page.belowFold.length === 0 ? '' : `<div class="far">${page.belowFold.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</div>`,
    ].join('');
    const style = reserved === defaultReservedHeight ? levelStyle : `:root{--reserved:${Math.min(reserved, 420)}px}${levelStyle}`;
    return { ...documentPage(page.title, body, 200, style), source: levelSource(page, link) };
}

function levelSource(page: LevelPage, link: string | null): string {
    const title = page.imageTitle === null ? '' : ` title="${escapeHtml(page.imageTitle)}"`;
    const hotspot = page.files.find((file) => file.linked === 'hotspot');
    const rollover = page.files.find((file) => file.display === 'rollover');
    const swap = rollover === undefined ? '' : ` onmouseover="this.src='${rollover.name}'" onmouseout="this.src='${page.imageName}'"`;
    const name = page.attribute === null ? '' : ` name="${escapeHtml(page.attribute)}"`;
    const image = `<img src="${page.imageName}" width="${pictureWidth}" height="${pictureHeight}" border="0"${name}${title}${hotspot === undefined ? '' : ' usemap="#map"'}${swap}>`;
    const area = hotspot === undefined || page.hotspot === null ? [] : [`<map name="map"><area shape="rect" coords="${[page.hotspot.x * pictureWidth, page.hotspot.y * pictureHeight,
        (page.hotspot.x + hotspotWidthPercent / 100) * pictureWidth, (page.hotspot.y + hotspotHeightPercent / 100) * pictureHeight].map(Math.round).join(',')}" href="${hotspot.name}"></map>`];
    const font = (line: string): string => `<p><font face="Times New Roman" size="4">${lineHtml(line, (part) => `<font color="#000000">${part}</font>`)}</font></p>`;
    const linked = (kind: LevelFile['linked'], tag: (file: LevelFile) => string): string[] => page.files.filter((file) => file.linked === kind).map(tag);
    const source = formatSource([
        doctype,
        '<html>',
        '<head>',
        `<title>${escapeHtml(page.title)}</title>`,
        contentType,
        ...(page.meta === null ? [] : [`<meta name="description" content="${escapeHtml(page.meta)}">`]),
        ...linked('stylesheet', (file) => `<link rel="stylesheet" type="text/css" href="${file.name}">`),
        ...linked('script', (file) => `<script type="text/javascript" src="${file.name}"></script>`),
        '</head>',
        '<body bgcolor="#000000" text="#DDDDDD" link="#FFFFFF" vlink="#FFFFFF">',
        ...page.tags.map((tag) => `<${tag}></${tag}>`),
        '<center>',
        link === null ? image : `<a href="${link}">${image}</a>`,
        ...area,
        ...page.lines.map(font),
        ...linked('image', (file) => {
            if (file.display === 'rollover') return '';
            const drawing = 'drawing' in file.content ? drawPicture(file.content.drawing) : null;
            const [width, height] = file.display === 'hidden' ? [0, 0] : file.display === 'squashed' ? [pictureWidth, 3] : [drawing?.width ?? 0, drawing?.height ?? 0];
            return `<p><img src="${file.name}" width="${width}" height="${height}" border="0"></p>`;
        }),
        ...(page.spans.length === 0 ? [] : [`<p><font face="Times New Roman" size="4">${page.spans.map((span) => `<span class="c${span.order}">${escapeHtml(span.letter)}</span>`).join(' ')}</font></p>`]),
        ...(page.grid.length === 0 ? [] : [`<pre>${escapeHtml(page.grid.join('\n'))}</pre>`]),
        ...page.emphasis.map((line) => `<p><font face="Times New Roman" size="4">${emphasisHtml(line)}</font></p>`),
        ...(page.spacers.length === 0 ? [] : [`<p>${page.spacers.map((width) => `<img src="spacer.gif" width="${width}" height="1">`).join('')}</p>`]),
        ...linked('sound', (file) => `<p><embed src="${file.name}" autostart="false" width="300" height="45"></p>`),
        ...(page.colors.length === 0 ? [] : [`<table border="0" cellspacing="6"><tr>${page.colors.map((color) => `<td bgcolor="${color}" width="26" height="26"></td>`).join('')}</tr></table>`]),
        ...(page.hiddenText === null ? [] : [`<p><font color="#000000">${escapeHtml(page.hiddenText)}</font></p>`]),
        '</center>',
        ...(page.belowFold.length === 0 ? [] : ['<br>'.repeat(60), '<center>', ...page.belowFold.map(font), '</center>']),
        ...page.comments.map((comment) => `<!-- ${comment.replaceAll('-->', '--&gt;')} -->`),
        '</body>',
        '</html>',
    ].join(''));
    return page.farComment === null ? source : `${source}${'\n'.repeat(80)}<!-- ${page.farComment.replaceAll('-->', '--&gt;')} -->`;
}

// The server ignores capitals, except in a file name that is written entirely in capitals.
export function canonicalUrl(url: string): string {
    try {
        const parsed = new URL(url, `${riddleOrigin}/`);
        const path = decodeURIComponent(parsed.pathname);
        const folderEnd = path.lastIndexOf('/') + 1;
        const [name = '', ...endings] = path.slice(folderEnd).split('.');
        const inCapitals = name === name.toUpperCase() && name !== name.toLowerCase();
        return `${parsed.origin}${path.slice(0, folderEnd).toLowerCase()}${[inCapitals ? name : name.toLowerCase(), ...endings.map((ending) => ending.toLowerCase())].join('.')}`;
    } catch { return url; }
}

export function resolvePage(url: string, state: GameState): Page {
    const address = canonicalUrl(url);
    const banned = state.captcha !== null && state.network.bannedUntil > state.elapsedSeconds;
    if (banned && isRiddleAddress(address)) return captchaPage(state.captcha!, state.flags.captchaRejected === true);
    const start = startPage(address);
    if (start !== null) return start;
    if (!isRiddleAddress(address)) return errorPage('unavailable');
    if (address === `${riddleOrigin}/present.gif`) return imageFilePage('present.gif', pictureTag(drawPicture({ kind: 'gift', text: entrance(7).answer }), 'present.gif'), gifStyle);
    const known = state.visitedLevels[address];
    if (known !== undefined) return renderLevel(known);
    if (address === urlOfLevel(state.currentLevel)) return renderLevel(state.currentLevel);
    const file = levelFilePage(address, state);
    if (file !== null) return file;
    const next = entrance(state.currentLevel + 1);
    if (address === next.url && next.credentials !== null) return { ...errorPage('unauthorized'), loginRealm: next.folder ?? 'riddle' };
    const finding = findings.find((candidate) => address === `${riddleOrigin}/${candidate.path}` && state.findings[candidate.id]);
    if (finding) return textFilePage(finding.path, findingFile(finding, state));
    if (!address.startsWith(`${riddleOrigin}/`)) return errorPage('unavailable');
    if (inWildcardFolder(address)) return documentPage('', `<p>${pageText.wildcardPage}</p>`, 200, levelStyle);
    return errorPage('notFound');
}

function levelFilePage(address: string, state: GameState): Page | null {
    for (const level of [state.currentLevel, ...Object.values(state.visitedLevels)]) {
        const page = levelPage(level);
        const at = (name: string): boolean => address === canonicalUrl(new URL(name, page.url).href);
        if (at(page.imageName)) return imageFilePage(page.imageName, picture(page), imageStyle, page.imageNote, page.zipped);
        const file = page.files.find((candidate) => at(candidate.name));
        if (file !== undefined) return filePage(file);
    }
    return null;
}

function filePage({ name, content }: LevelFile): Page {
    if ('drawing' in content) return imageFilePage(name, pictureTag(drawPicture(content.drawing), name), gifStyle);
    if ('sound' in content) return soundFilePage(name, content.sound);
    if ('bytesOf' in content) return textFilePage(name, binaryText(content.bytesOf));
    if ('page' in content) {
        const source = formatSource(`${doctype}<html><head><title></title>${contentType}</head><body bgcolor="#000000" text="#DDDDDD"><center><p>${escapeHtml(content.page)}</p></center></body></html>`);
        return documentPage('', `<p>${escapeHtml(content.page)}</p>`, 200, noteStyle, source);
    }
    return textFilePage(name, content.text);
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
    return { ...html, source: formatSource(`<html><head><title>${captchaText.title}</title></head><body>${page('<img src="/captcha.php" width="260" height="70" alt="">')}</body></html>`) };
}

function captchaPicture(word: string): string {
    let seed = textSeed(word);
    const random = (): number => {
        seed = nextSeed(seed);
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
