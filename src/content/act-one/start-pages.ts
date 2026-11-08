import type { Page } from '../../core/content.ts';
import { imagePath, imageWithWord } from './images.ts';
import { enigmaticsUrl, homeUrl, nordinhoTopicUrl, nordinhoUrl, riddleHomeUrl, startUrl } from './riddle.ts';
import { enigmaticsText, fill, nordinhoText, riddleHomeText, riddleName, startPageText } from './text.ts';

interface Site {
    readonly title: string;
    readonly body: (rendered: boolean) => string;
    readonly colors: string;
    readonly style: string;
}

const visitorCount = '004211';
const topicHref = `${nordinhoTopicUrl}?t=4211`;

const sites: Readonly<Record<string, Site>> = {
    [homeUrl]: {
        title: startPageText.title,
        body: enigmaWebHome,
        colors: 'bgcolor="#FFFFFF" text="#000000" link="#0033CC" vlink="#663399"',
        style: 'body{margin:0}.masthead{padding:12px 14px;background:linear-gradient(90deg,#000080,#1084c8)}.masthead img{vertical-align:middle;margin-right:8px}'
            + '.sidebar{padding:16px 14px;line-height:1.6;border-right:1px solid #99b4d1}.content{padding:18px 22px}.content p{margin:12px 0}'
            + '.featured{border-collapse:collapse;margin:16px 0}.featured td{border:1px solid #99b4d1;padding:10px 12px}hr{border:0;border-top:1px solid #99b4d1;margin:0 0 10px}'
            + '.tagline{white-space:nowrap}@media (max-width:560px){.sidebar,.tagline{display:none}}',
    },
    [riddleHomeUrl]: {
        title: riddleName,
        body: riddleHome,
        colors: 'bgcolor="#000000" text="#CCCCCC" link="#FFFFFF" vlink="#FFFFFF"',
        style: '.banner{display:inline-block;width:444px;max-width:96%}.banner img{height:140px;object-fit:cover}'
            + '.banner-title{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:46px "Times New Roman",serif;letter-spacing:10px;color:#fff;text-shadow:0 0 16px rgba(255,255,255,.75),0 0 3px #000}'
            + '.enter a{display:inline-block;padding:4px 18px;border:1px solid #666;text-decoration:none;letter-spacing:4px}.enter a:hover{border-color:#fff;box-shadow:0 0 10px rgba(255,255,255,.4)}'
            + 'hr{width:300px;border:0;border-top:1px solid #333;margin:14px auto}p{margin:8px 0;line-height:1.45}'
            + '.counter{display:inline-block;margin-top:4px;padding:2px 7px;background:#111;border:1px solid #444;color:#7cfc7c;font:13px "Courier New",monospace;letter-spacing:3px}'
            + '.badges a{display:inline-block;width:88px;height:31px;margin:0 3px;line-height:29px;border:1px solid #777;color:#fff;font:bold 9px Verdana,sans-serif;text-decoration:none;text-transform:uppercase;letter-spacing:1px}'
            + '.badges a:nth-child(1){background:linear-gradient(#1084c8,#000080)}.badges a:nth-child(2){background:linear-gradient(#5a7f97,#006699)}.badges a:nth-child(3){background:linear-gradient(#4b3a7a,#1a1036)}',
    },
    [enigmaticsUrl]: {
        title: 'Enigmatics',
        body: enigmatics,
        colors: 'bgcolor="#0A0A1A" text="#CCCCDD" link="#99CCFF" vlink="#99CCFF"',
        style: '.logo{letter-spacing:8px;text-shadow:0 0 12px rgba(140,140,255,.6)}.list{width:min(420px,100%);border-collapse:collapse;margin-top:6px}.list td{padding:6px 10px;border-bottom:1px solid #22223a}.list tr:first-child td{background:#1c1c3a;color:#fff}',
    },
    [nordinhoUrl]: {
        title: nordinhoText.title,
        body: () => nordinhoBoard(),
        colors: 'bgcolor="#E5E5E5" text="#000000" link="#006699" vlink="#5493B4"',
        style: nordinhoStyle(),
    },
    [nordinhoTopicUrl]: {
        title: `${nordinhoText.title} :: ${nordinhoText.topics[0][0]}`,
        body: () => nordinhoTopic(),
        colors: 'bgcolor="#E5E5E5" text="#000000" link="#006699" vlink="#5493B4"',
        style: nordinhoStyle(),
    },
};

export function startPage(address: string, scrollbarStyle: string, pictureStyle: string): Page | null {
    const site = sites[address === `${riddleHomeUrl}index.htm` ? riddleHomeUrl : address === `${nordinhoUrl}index.php` ? nordinhoUrl : address];
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
    return [
        '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="masthead" bgcolor="#000080">',
        `<img src="${rendered ? '/branding/enigma-web.png' : 'images/logo.gif'}" width="40" height="40" alt=""><font face="Tahoma" size="5" color="#FFFFFF"><b>Enigma Web</b></font>`,
        `&nbsp;&nbsp;<font face="Verdana" size="1" color="#C0D0FF" class="tagline">${startPageText.tagline}</font>`,
        '</td></tr></table>',
        '<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr valign="top">',
        '<td width="150" bgcolor="#D6E4F7" class="sidebar"><font face="Verdana" size="1">',
        `<b>${startPageText.riddlesHeading.toUpperCase()}</b><br><a href="${riddleHomeUrl}">${riddleName}</a><br><br>`,
        `<b>${startPageText.communitiesHeading.toUpperCase()}</b><br><a href="${enigmaticsUrl}">Enigmatics</a><br><a href="${nordinhoUrl}">Nordinho</a>`,
        '</font></td>',
        '<td class="content">',
        `<font face="Verdana" size="4" color="#003399"><b>${startPageText.welcome}</b></font>`,
        `<p><font face="Verdana" size="2">${startPageText.intro}</font></p>`,
        '<table width="100%" cellpadding="0" cellspacing="0" border="0" class="featured"><tr><td bgcolor="#EEF3FB">',
        `<font face="Verdana" size="1" color="#003399"><b>${startPageText.featuredHeading.toUpperCase()}</b></font><br>`,
        `<font face="Verdana" size="2"><a href="${riddleHomeUrl}"><b>${riddleName}</b></a> - ${startPageText.featuredBlurb}</font>`,
        '</td></tr></table>',
        `<p><font face="Verdana" size="1" color="#003399"><b>${startPageText.communitiesHeading.toUpperCase()}</b></font><br>`,
        `<font face="Verdana" size="2"><a href="${enigmaticsUrl}">Enigmatics</a> - ${startPageText.enigmaticsBlurb}<br>`,
        `<a href="${nordinhoUrl}">Nordinho</a> - ${startPageText.nordinhoBlurb}</font></p>`,
        '</td></tr></table>',
        `<hr><center><font face="Verdana" size="1" color="#666666">${startPageText.footer}</font></center>`,
    ].join('\n');
}

function riddleHome(rendered: boolean): string {
    const banner = rendered
        ? `<span class="picture banner"><img src="${imagePath(imageWithWord('night'))}" alt=""><span class="banner-title">${riddleName}</span></span>`
        : `<img src="banner.jpg" width="440" height="150" border="0" alt="${riddleName}">`;
    return [
        '<center>',
        '<br>',
        banner,
        `<p><font face="Times New Roman" size="3"><i>${riddleHomeText.tagline}</i></font></p>`,
        `<p class="enter"><font face="Times New Roman" size="5"><a href="${startUrl.slice(riddleHomeUrl.length)}">${riddleHomeText.enter}</a></font></p>`,
        '<hr>',
        `<p><font face="Verdana" size="1" color="#999999"><b>${riddleHomeText.rulesHeading.toUpperCase()}</b></font><br><font face="Verdana" size="2">${riddleHomeText.rules.join('<br>')}</font></p>`,
        '<hr>',
        `<p><font face="Verdana" size="1" color="#999999"><b>${riddleHomeText.hallOfFameHeading.toUpperCase()}</b></font><br><font face="Verdana" size="2">${fill(riddleHomeText.hallOfFame, { name: riddleName })}</font></p>`,
        '<hr>',
        `<p><font face="Verdana" size="1" color="#808080">${riddleHomeText.counter}</font><br><span class="counter">${visitorCount}</span></p>`,
        `<p class="badges"><a href="${homeUrl}">Enigma Web</a><a href="${nordinhoUrl}">Nordinho</a><a href="${enigmaticsUrl}">Enigmatics</a></p>`,
        `<p><font face="Verdana" size="1" color="#666666">${riddleHomeText.updated}</font></p>`,
        '</center>',
    ].join('\n');
}

function enigmatics(): string {
    const [home, list, forum] = enigmaticsText.navigation;
    const rows = [[`<a href="${riddleHomeUrl}">${riddleName}</a>`, enigmaticsText.notfiniteLength], ...enigmaticsText.riddles];
    return [
        '<center>',
        '<br>',
        '<font face="Verdana" size="6" color="#FFFFFF" class="logo"><b>ENIGMATICS</b></font><br>',
        `<font face="Verdana" size="2" color="#9999CC">${enigmaticsText.tagline}</font>`,
        '<br><br>',
        `<font face="Verdana" size="2"><a href="${enigmaticsUrl}">${home}</a> | <a href="${enigmaticsUrl}">${list}</a> | <a href="${nordinhoUrl}">${forum}</a></font>`,
        '<br><br>',
        `<font face="Verdana" size="2"><b>${enigmaticsText.listHeading}</b></font>`,
        '<table width="420" cellpadding="0" cellspacing="0" border="0" class="list">',
        `<tr>${enigmaticsText.columns.map((column) => `<td><font face="Verdana" size="2"><b>${column}</b></font></td>`).join('')}</tr>`,
        ...rows.map(([name, length]) => `<tr><td><font face="Verdana" size="2">${name}</font></td><td><font face="Verdana" size="2">${length}</font></td></tr>`),
        '</table>',
        `<br><font face="Verdana" size="1" color="#666688">${enigmaticsText.footer}</font>`,
        '</center>',
    ].join('\n');
}

function nordinhoHeader(): string {
    return [
        '<table width="100%" cellpadding="10" cellspacing="0" border="0" class="forum-header"><tr><td bgcolor="#FFFFFF">',
        `<font face="Verdana" size="5" color="#006699"><b>${nordinhoText.title}</b></font><br>`,
        `<font face="Verdana" size="1">${nordinhoText.navigation.map((item) => `<a href="${nordinhoUrl}">${item}</a>`).join(' &middot; ')}</font>`,
        '</td></tr></table>',
        `<p class="breadcrumb"><font face="Verdana" size="2"><b><a href="${nordinhoUrl}">${nordinhoText.title}</a> &raquo; ${nordinhoText.board}</b></font></p>`,
    ].join('\n');
}

function nordinhoBoard(): string {
    return [
        nordinhoHeader(),
        '<table width="100%" cellpadding="5" cellspacing="1" border="0" bgcolor="#A9B8C2" class="forum">',
        `<tr>${nordinhoText.columns.map((column) => `<th bgcolor="#006699" nowrap><font face="Verdana" size="1" color="#FFA34F"><b>${column}</b></font></th>`).join('')}</tr>`,
        ...nordinhoText.topics.map(([topic, replies, author, lastPost], index) => [
            '<tr>',
            `<td bgcolor="#EFEFEF"><font face="Verdana" size="2">${index === 0 ? `<a href="${topicHref}"><b>${topic}</b></a>` : `<b>${topic}</b>`}</font></td>`,
            `<td bgcolor="#DEE3E7" align="center" nowrap><font face="Verdana" size="1">${replies}</font></td>`,
            `<td bgcolor="#EFEFEF" align="center" nowrap><font face="Verdana" size="1">${author}</font></td>`,
            `<td bgcolor="#DEE3E7" align="center" nowrap><font face="Verdana" size="1">${lastPost}</font></td>`,
            '</tr>',
        ].join('')),
        '</table>',
    ].join('\n');
}

function nordinhoTopic(): string {
    return [
        nordinhoHeader(),
        `<p><font face="Verdana" size="3"><b>${nordinhoText.topics[0][0]}</b></font></p>`,
        '<table width="100%" cellpadding="6" cellspacing="1" border="0" bgcolor="#A9B8C2" class="forum">',
        ...nordinhoText.posts.map(([author, text, date], index) => [
            '<tr valign="top">',
            `<td width="140" bgcolor="${index % 2 === 0 ? '#EFEFEF' : '#DEE3E7'}"><font face="Verdana" size="2"><b>${author}</b></font></td>`,
            `<td bgcolor="${index % 2 === 0 ? '#EFEFEF' : '#DEE3E7'}"><font face="Verdana" size="1" color="#555555">${fill(nordinhoText.posted, { date })}</font><hr size="1" noshade color="#C0C0C0"><font face="Verdana" size="2">${text}</font></td>`,
            '</tr>',
        ].join('')),
        '</table>',
    ].join('\n');
}

function nordinhoStyle(): string {
    return 'body{margin:10px}.forum-header{border:1px solid #a9b8c2;margin-bottom:6px}.forum{margin-bottom:12px}.forum th{padding:6px}.forum td{padding:6px 8px}'
        + '.forum hr{border:0;border-top:1px solid #c0c0c0;margin:4px 0 6px}.breadcrumb{margin:8px 2px}a{text-decoration:none}a:hover{text-decoration:underline}';
}
