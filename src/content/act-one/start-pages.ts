import type { Page } from '../../core/content.ts';
import { imagePath, imageWithWord } from './images.ts';
import { enigmaticsUrl, hallOfFameUrl, homeUrl, nordinhoUrl, riddleHomeUrl, rulesUrl, startUrl } from './riddle.ts';
import { browserName, fill, riddleHomeText, riddleName, startPageText } from './text.ts';

interface Site {
    readonly title: string;
    readonly body: (rendered: boolean) => string;
    readonly colors: string;
    readonly style: string;
}

const visitorCount = '004211';

const enigmaWebColors = 'bgcolor="#FFFFFF" text="#000000" link="#0033CC" vlink="#663399"';
const enigmaWebStyle = 'body{margin:0}.masthead{padding:12px 14px;background:linear-gradient(90deg,#000080,#1084c8)}.masthead img{display:block}.brand{padding-left:10px}'
    + '.sidebar{padding:16px 14px;line-height:1.6;border-right:1px solid #99b4d1}.content{padding:18px 22px}.content p{margin:12px 0}'
    + '.featured{border-collapse:collapse;margin:16px 0}.featured td{border:1px solid #99b4d1;padding:10px 12px}hr{border:0;border-top:1px solid #99b4d1;margin:0 0 10px}'
    + '@media (max-width:560px){.sidebar{display:none}}';

const riddleColors = 'bgcolor="#000000" text="#CCCCCC" link="#FFFFFF" vlink="#FFFFFF"';
const riddleStyle = '.banner{display:inline-block;width:444px;max-width:96%}.banner img{height:140px;object-fit:cover}'
    + '.banner-title{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:46px "Times New Roman",serif;letter-spacing:10px;color:#fff;text-shadow:0 0 16px rgba(255,255,255,.75),0 0 3px #000}'
    + '.enter a{display:inline-block;padding:4px 18px;border:1px solid #666;text-decoration:none;letter-spacing:4px}.enter a:hover{border-color:#fff;box-shadow:0 0 10px rgba(255,255,255,.4)}'
    + '.menu a{text-decoration:none;letter-spacing:1px}.menu a:hover{text-decoration:underline}.heading{letter-spacing:4px}'
    + 'hr{width:300px;border:0;border-top:1px solid #333;margin:14px auto}p{margin:8px 0;line-height:1.45}'
    + '.counter{display:inline-block;margin-top:4px;padding:2px 7px;background:#111;border:1px solid #444;color:#7cfc7c;font:13px "Courier New",monospace;letter-spacing:3px}';

const sites: Readonly<Record<string, Site>> = {
    [homeUrl]: { title: startPageText.title, body: enigmaWebHome, colors: enigmaWebColors, style: enigmaWebStyle },
    [riddleHomeUrl]: { title: riddleName, body: riddleHome, colors: riddleColors, style: riddleStyle },
    [rulesUrl]: riddleSubpage(riddleHomeText.rulesHeading, riddleHomeText.rules.join('<br>')),
    [hallOfFameUrl]: riddleSubpage(riddleHomeText.hallOfFameHeading, fill(riddleHomeText.hallOfFame, { name: riddleName })),
};

export function startPage(address: string, scrollbarStyle: string, pictureStyle: string): Page | null {
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
    return { title: site.title, html: page(true), source: page(false), statusCode: 200 };
}

function enigmaWebHome(rendered: boolean): string {
    const enigmatics = `<a href="${enigmaticsUrl}" target="_blank">${startPageText.enigmatics}</a>`;
    const nordinho = `<a href="${nordinhoUrl}" target="_blank">${startPageText.nordinho}</a>`;
    return [
        '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="masthead" bgcolor="#000080">',
        '<table cellpadding="0" cellspacing="0" border="0"><tr>',
        `<td><img src="${rendered ? '/branding/enigma-web.png' : 'images/logo.gif'}" width="40" height="40" alt=""></td>`,
        `<td class="brand"><font face="Tahoma" size="5" color="#FFFFFF"><b>${browserName}</b></font></td>`,
        '</tr></table>',
        '</td></tr></table>',
        '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr valign="top">',
        '<td width="150" bgcolor="#D6E4F7" class="sidebar"><font face="Verdana" size="1">',
        `<b>${startPageText.riddlesHeading.toUpperCase()}</b><br><a href="${riddleHomeUrl}">${riddleName}</a><br><br>`,
        `<b>${startPageText.communitiesHeading.toUpperCase()}</b><br>${enigmatics}<br>${nordinho}`,
        '</font></td>',
        '<td class="content">',
        `<font face="Verdana" size="4" color="#003399"><b>${startPageText.welcome}</b></font>`,
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" class="featured"><tr><td bgcolor="#EEF3FB">',
        `<font face="Verdana" size="1" color="#003399"><b>${startPageText.featuredHeading.toUpperCase()}</b></font><br>`,
        `<font face="Verdana" size="2"><a href="${riddleHomeUrl}"><b>${riddleName}</b></a> - ${startPageText.featuredBlurb}</font>`,
        '</td></tr></table>',
        `<p><font face="Verdana" size="1" color="#003399"><b>${startPageText.communitiesHeading.toUpperCase()}</b></font><br>`,
        `<font face="Verdana" size="2">${enigmatics} - ${startPageText.enigmaticsBlurb}<br>`,
        `${nordinho} - ${startPageText.nordinhoBlurb}</font></p>`,
        '</td></tr></table>',
        `<hr><center><font face="Verdana" size="1" color="#666666">${startPageText.footer}</font></center>`,
    ].join('\n');
}

function riddleHome(rendered: boolean): string {
    return [
        '<center>',
        '<br>',
        riddleBanner(rendered),
        `<p><font face="Times New Roman" size="3"><i>${riddleHomeText.tagline}</i></font></p>`,
        `<p class="enter"><font face="Times New Roman" size="5"><a href="${pageName(startUrl)}">${riddleHomeText.enter}</a></font></p>`,
        `<p class="menu"><font face="Verdana" size="2"><a href="${pageName(rulesUrl)}">${riddleHomeText.rulesHeading}</a> &middot; <a href="${pageName(hallOfFameUrl)}">${riddleHomeText.hallOfFameHeading}</a></font></p>`,
        '<hr>',
        `<p><font face="Verdana" size="1" color="#808080">${riddleHomeText.counter}</font><br><span class="counter">${visitorCount}</span></p>`,
        `<p><font face="Verdana" size="1" color="#666666">${riddleHomeText.updated}</font></p>`,
        '</center>',
    ].join('\n');
}

function riddleSubpage(heading: string, text: string): Site {
    return {
        title: fill(riddleHomeText.subpageTitle, { name: riddleName, page: heading }),
        body: (rendered) => [
            '<center>',
            '<br>',
            riddleBanner(rendered),
            `<p class="heading"><font face="Times New Roman" size="5">${heading}</font></p>`,
            `<p><font face="Verdana" size="2">${text}</font></p>`,
            '<hr>',
            `<p class="menu"><font face="Verdana" size="2"><a href="index.htm">${riddleHomeText.back}</a></font></p>`,
            '</center>',
        ].join('\n'),
        colors: riddleColors,
        style: riddleStyle,
    };
}

function riddleBanner(rendered: boolean): string {
    return rendered
        ? `<span class="picture banner"><img src="${imagePath(imageWithWord('night'))}" alt=""><span class="banner-title">${riddleName}</span></span>`
        : `<img src="banner.jpg" width="440" height="140" border="0" alt="${riddleName}">`;
}

function pageName(url: string): string {
    return url.slice(riddleHomeUrl.length);
}
