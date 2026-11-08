import type { Page } from '../../core/content.ts';
import { enigmaticsUrl, homeUrl, nordinhoUrl, riddleHomeUrl, startUrl } from './riddle.ts';
import { fill, riddleHomeText, riddleName, startPageText } from './text.ts';

const visitorCount = '004211';

export function startPage(address: string, style: string): Page | null {
    if (address === homeUrl) return oldPage(startPageText.title, '#0B0B18', '#99CCFF', portalBody(), style);
    if (address === riddleHomeUrl || address === `${riddleHomeUrl}index.htm`) return oldPage(riddleName, '#000000', '#FFFFFF', riddleHomeBody(), `${style}${titleGlow}`);
    if (address === enigmaticsUrl) return oldPage('Enigmatics', '#000000', '#99CCFF', stubBody('Enigmatics', startPageText.enigmaticsBlurb), style);
    if (address === nordinhoUrl) return oldPage('Nordinho', '#000000', '#99CCFF', stubBody('Nordinho', startPageText.nordinhoBlurb), style);
    return null;
}

const titleGlow = 'font[size="7"]{letter-spacing:6px;text-shadow:0 0 14px rgba(255,255,255,.65)}';

function oldPage(title: string, background: string, link: string, body: string, style: string): Page {
    const page = (head: string): string => [
        '<html>',
        '<head>',
        `<title>${title}</title>${head}`,
        '</head>',
        `<body bgcolor="${background}" text="#DDDDDD" link="${link}" vlink="${link}">`,
        body,
        '</body>',
        '</html>',
    ].join('\n');
    return { title, html: page(`\n<style>${style}</style>`), source: page(''), statusCode: 200 };
}

function portalBody(): string {
    return [
        '<table width="100%" cellpadding="14" cellspacing="0"><tr><td bgcolor="#000080">',
        `<font face="Tahoma" size="5" color="#FFFFFF"><b>Enigma Web</b></font><br><font face="Verdana" size="2" color="#C0C0FF">${startPageText.tagline}</font>`,
        '</td></tr></table>',
        '<table width="100%" cellpadding="16" cellspacing="0"><tr valign="top">',
        `<td width="50%"><font face="Verdana" size="2"><b>${startPageText.riddlesHeading}</b>`,
        `<ul><li><a href="${riddleHomeUrl}">${riddleName}</a> - ${startPageText.riddleBlurb}</li></ul></font></td>`,
        `<td width="50%"><font face="Verdana" size="2"><b>${startPageText.communitiesHeading}</b>`,
        `<ul><li><a href="${enigmaticsUrl}">Enigmatics</a> - ${startPageText.enigmaticsBlurb}</li>`,
        `<li><a href="${nordinhoUrl}">Nordinho</a> - ${startPageText.nordinhoBlurb}</li></ul></font></td>`,
        '</tr></table>',
        `<center><font face="Verdana" size="1" color="#8888AA">${startPageText.footer}</font></center>`,
    ].join('\n');
}

function riddleHomeBody(): string {
    return [
        '<center>',
        '<br><br>',
        `<font face="Times New Roman" size="7">${riddleName}</font><br>`,
        `<font face="Times New Roman" size="3"><i>${riddleHomeText.tagline}</i></font>`,
        '<br><br><br>',
        `<font face="Times New Roman" size="5"><a href="${startUrl.slice(riddleHomeUrl.length)}">${riddleHomeText.enter}</a></font>`,
        '<br><br><br>',
        `<font face="Verdana" size="2"><b>${riddleHomeText.rulesHeading}</b><br>${riddleHomeText.rules.join('<br>')}</font>`,
        '<br><br>',
        `<font face="Verdana" size="2"><b>${riddleHomeText.hallOfFameHeading}</b><br>${fill(riddleHomeText.hallOfFame, { name: riddleName })}</font>`,
        '<br><br><br>',
        `<font face="Verdana" size="1" color="#808080">${fill(riddleHomeText.counter, { count: visitorCount })}<br>${riddleHomeText.updated}</font>`,
        '</center>',
    ].join('\n');
}

function stubBody(name: string, blurb: string): string {
    return [
        '<center>',
        '<br><br>',
        `<font face="Verdana" size="4"><b>${name}</b></font><br>`,
        `<font face="Verdana" size="2">${blurb}</font>`,
        '<br><br>',
        `<font face="Verdana" size="2" color="#808080">${startPageText.underConstruction}</font>`,
        `<br><br><font face="Verdana" size="2"><a href="${homeUrl}">&lt; Enigma Web</a></font>`,
        '</center>',
    ].join('\n');
}
