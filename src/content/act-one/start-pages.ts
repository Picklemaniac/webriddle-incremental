import type { Page } from '../../core/content.ts';
import { contentType, doctype, formatSource } from './html-source.ts';
import { imagePath, imageWithWord } from './images.ts';
import { pictureStyle, scrollbarStyle } from './page-styles.ts';
import { enigmaticsUrl, hallOfFameUrl, hintsUrl, homeUrl, nordinhoUrl, riddleHomeUrl, rulesUrl, startUrl, toolUrls } from './riddle.ts';
import { browserName, fill, riddleHomeText, riddleName, startPageText } from './text.ts';

interface Site {
    readonly title: string;
    readonly body: (rendered: boolean) => string;
    readonly colors: string;
    readonly style: string;
}

const visitorCount = '004211';
const riddleMenu: readonly (readonly [string, string])[] = [
    [rulesUrl, riddleHomeText.rulesHeading], [hintsUrl, riddleHomeText.hintsHeading], [hallOfFameUrl, riddleHomeText.hallOfFameHeading],
];

const enigmaWebColors = 'bgcolor="#FFFFFF" text="#000000" link="#0033CC" vlink="#663399"';
const enigmaWebStyle = 'body{margin:0}.masthead{padding:12px 14px;background:linear-gradient(90deg,#000080,#1084c8)}.masthead img{display:block}.brand{padding-left:10px}'
    + '.sidebar{padding:16px 14px;line-height:1.6;border-right:1px solid #99b4d1}.content{padding:18px 22px}.content p{margin:12px 0;line-height:1.5}'
    + '.featured{border-collapse:collapse;margin:16px 0}.featured td{border:1px solid #99b4d1;padding:10px 12px}hr{border:0;border-top:1px solid #99b4d1;margin:0 0 10px}'
    + '@media (max-width:560px){.sidebar{display:none}}';

const riddleColors = 'bgcolor="#000000" text="#CCCCCC" link="#FFFFFF" vlink="#FFFFFF"';
const riddleStyle = '.banner{display:inline-block;width:444px;max-width:96%}.banner img{height:140px;object-fit:cover}'
    + '.banner-title{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:46px "Times New Roman",serif;letter-spacing:10px;color:#fff;text-shadow:0 0 16px rgba(255,255,255,.75),0 0 3px #000}'
    + '.text{width:min(444px,96%);margin-top:14px}.text td{line-height:1.5}p{margin:10px 0;line-height:1.5}'
    + '.start a{display:inline-block;padding:4px 20px;border:1px solid #666;text-decoration:none;letter-spacing:4px}.start a:hover{border-color:#fff;box-shadow:0 0 10px rgba(255,255,255,.4)}'
    + '.menu a{text-decoration:none}.menu a:hover{text-decoration:underline}.heading{margin:16px 0 6px;letter-spacing:4px}'
    + '.fame{width:min(444px,96%);border-collapse:collapse}.fame th,.fame td{padding:5px 8px;border:1px solid #333}.fame th{color:#999;font-weight:normal}'
    + 'hr{width:300px;max-width:80%;border:0;border-top:1px solid #333;margin:16px auto}'
    + '.counter{display:inline-block;padding:2px 7px;background:#111;border:1px solid #444;color:#7cfc7c;font:13px "Courier New",monospace;letter-spacing:3px}';

const sites: Readonly<Record<string, Site>> = {
    [homeUrl]: { title: startPageText.title, body: enigmaWebHome, colors: enigmaWebColors, style: enigmaWebStyle },
    [riddleHomeUrl]: { title: riddleName, body: riddleHome, colors: riddleColors, style: riddleStyle },
    [rulesUrl]: riddleSubpage(riddleHomeText.rulesHeading, textBlock(riddleHomeText.rules.map((rule, index) => `${index + 1}. ${rule}`))),
    [hintsUrl]: riddleSubpage(riddleHomeText.hintsHeading, textBlock([
        ...riddleHomeText.hints.map((hint, index) => fill(riddleHomeText.hintLine, { level: index + 1, hint })),
        '',
        riddleHomeText.moreHints,
    ])),
    [hallOfFameUrl]: riddleSubpage(riddleHomeText.hallOfFameHeading, [
        '<table class="fame" cellpadding="5" cellspacing="0" border="1">',
        `<tr>${riddleHomeText.hallOfFameColumns.map((column) => `<th><font face="Verdana" size="1">${column}</font></th>`).join('')}</tr>`,
        `<tr><td colspan="${riddleHomeText.hallOfFameColumns.length}" align="center"><font face="Verdana" size="2">${fill(riddleHomeText.hallOfFame, { name: riddleName })}</font></td></tr>`,
        '</table>',
    ]),
};

export function startPage(address: string): Page | null {
    const site = sites[address === `${riddleHomeUrl}index.htm` ? riddleHomeUrl : address];
    if (site === undefined) return null;
    const page = (rendered: boolean): string => [
        '<html>',
        '<head>',
        `<title>${site.title}</title>${rendered ? `\n<style>${scrollbarStyle}${pictureStyle}${site.style}</style>` : ''}`,
        '</head>',
        `<body ${site.colors}>`,
        site.body(rendered),
        '</body>',
        '</html>',
    ].join('\n');
    return { title: site.title, html: page(true), source: formatSource(`${doctype}${page(false).replace('</title>', `</title>${contentType}`)}`), statusCode: 200 };
}

function enigmaWebHome(rendered: boolean): string {
    const external = (url: string, name: string): string => `<a href="${url}" target="_blank">${name}</a>`;
    return [
        '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="masthead" bgcolor="#000080">',
        '<table cellpadding="0" cellspacing="0" border="0"><tr>',
        `<td><img src="${rendered ? 'branding/enigma-web.png' : 'images/logo.gif'}" width="40" height="40" alt=""></td>`,
        `<td class="brand"><font face="Tahoma" size="5" color="#FFFFFF"><b>${browserName}</b></font></td>`,
        '</tr></table>',
        '</td></tr></table>',
        '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr valign="top">',
        '<td width="150" bgcolor="#D6E4F7" class="sidebar"><font face="Verdana" size="1">',
        `<b>${startPageText.toolsHeading.toUpperCase()}</b><br>`,
        Object.entries(toolUrls).map(([id, url]) => external(url, startPageText.tools[id as keyof typeof toolUrls])).join('<br>'),
        '</font></td>',
        '<td class="content">',
        `<font face="Verdana" size="4" color="#003399"><b>${startPageText.welcome}</b></font>`,
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" class="featured"><tr><td bgcolor="#EEF3FB">',
        `<font face="Verdana" size="1" color="#003399"><b>${startPageText.featuredHeading.toUpperCase()}</b></font><br>`,
        `<font face="Verdana" size="2"><a href="${riddleHomeUrl}"><b>${riddleName}</b></a> - ${startPageText.featuredBlurb}</font>`,
        '</td></tr></table>',
        `<p><font face="Verdana" size="1" color="#003399"><b>${startPageText.communitiesHeading.toUpperCase()}</b></font><br>`,
        `<font face="Verdana" size="2">${external(enigmaticsUrl, startPageText.enigmatics)} - ${startPageText.enigmaticsBlurb}<br>`,
        `${external(nordinhoUrl, startPageText.nordinho)} - ${startPageText.nordinhoBlurb}</font></p>`,
        '</td></tr></table>',
        `<hr><center><font face="Verdana" size="1" color="#666666">${startPageText.footer}</font></center>`,
    ].join('\n');
}

function riddleHome(rendered: boolean): string {
    return [
        '<center>',
        '<br>',
        riddleBanner(rendered),
        `<p class="start"><font face="Times New Roman" size="5"><a href="${pageName(startUrl)}">${riddleHomeText.start}</a></font></p>`,
        `<p class="menu"><font face="Verdana" size="2">${riddleMenu.map(([url, label]) => `<a href="${pageName(url)}">${label}</a>`).join(' | ')}</font></p>`,
        '<hr>',
        `<p><span class="counter">${visitorCount}</span><br><font face="Verdana" size="1" color="#999999">${riddleHomeText.visitors}</font></p>`,
        `<p><font face="Verdana" size="1" color="#666666">${riddleHomeText.updated}</font></p>`,
        '</center>',
    ].join('\n');
}

function riddleSubpage(heading: string, content: readonly string[]): Site {
    return {
        title: riddleName,
        body: (rendered) => [
            '<center>',
            '<br>',
            riddleBanner(rendered),
            `<p class="heading"><font face="Times New Roman" size="5">${heading}</font></p>`,
            ...content,
            '<hr>',
            `<p class="menu"><font face="Verdana" size="2"><a href="index.htm">${riddleHomeText.back}</a></font></p>`,
            '</center>',
        ].join('\n'),
        colors: riddleColors,
        style: riddleStyle,
    };
}

function textBlock(lines: readonly string[]): readonly string[] {
    return ['<table class="text" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><font face="Verdana" size="2">', lines.join('<br>'), '</font></td></tr></table>'];
}

function riddleBanner(rendered: boolean): string {
    return rendered
        ? `<span class="picture banner"><img src="${imagePath(imageWithWord('night'))}" alt=""><span class="banner-title">${riddleName}</span></span>`
        : `<img src="banner.jpg" width="440" height="140" border="0" alt="${riddleName}">`;
}

function pageName(url: string): string {
    return url.slice(riddleHomeUrl.length);
}
