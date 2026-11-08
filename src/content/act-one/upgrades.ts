import type { PurchasableDefinition, ResourceAmounts } from '../../core/content.ts';
import type { GameState } from '../../core/state.ts';
import type { Modifier } from '../../core/stats.ts';
import { owns } from './progress.ts';
import { planSearch, searchCapabilities, type BlockReason } from './search.ts';

export interface Upgrade extends PurchasableDefinition {
    readonly price: ResourceAmounts;
    readonly level: number;
    readonly requires: readonly string[];
    readonly fixes?: BlockReason;
}

const multiply = (statId: string, value: number): Modifier => ({ statId, operation: 'multiply', value });
const add = (statId: string, value: number): Modifier => ({ statId, operation: 'add', value });

function upgrade(id: string, name: string, description: string, price: ResourceAmounts, level: number,
    requires: readonly string[] = [], modifiers: readonly Modifier[] = [], fixes?: BlockReason): Upgrade {
    return {
        id, name, description, price, level, requires, fixes, maximumCount: 1,
        cost: () => price,
        modifiers: () => modifiers,
        isAvailable: (state) => state.flags.automated === true && state.currentLevel >= level && requires.every((required) => owns(state, required)),
    };
}

export const upgrades: readonly Upgrade[] = [
    upgrade('curlBatch', 'Run in parallel', 'Four threads in your first script.', { insight: 5 }, 5, [], [multiply('threadsPerScript', 4)]),
    upgrade('sortByFrequency', 'Sort by frequency', 'Try common words first in every wordlist.', { insight: 12 }, 8),
    upgrade('keepAlive', 'Keep-alive', 'Reuse the connection. Twice the requests per thread.', { insight: 20 }, 15, [], [multiply('requestsPerThread', 2)]),
    upgrade('fakeUserAgent', 'A familiar user-agent', 'Identify your script as a browser.', { insight: 8 }, 35, [], [], 'userAgent'),
    upgrade('throttle', 'Throttle', 'Stay inside the rate limit. No wasted requests or new heat.', { insight: 10 }, 5),
    upgrade('ram', 'More RAM', 'Room for a second script.', { money: 60 }, 8, [], [add('scriptSlots', 1)]),
    upgrade('wgetMirror', 'wget --mirror', 'Assign scripts to scrape words: 12 words per second each.', { insight: 15 }, 10),
    upgrade('autoReplyMacros', 'Auto-reply macros', 'Assign scripts to close tickets: $0.80 per second each.', { insight: 15 }, 10),
    upgrade('isdn', 'ISDN', 'Twice the requests per thread.', { money: 100 }, 15, [], [multiply('requestsPerThread', 2)]),
    upgrade('english10k', 'english-10k.txt', '10,000 entries. Covers more unusual words.', { words: 500 }, 15),
    upgrade('newPc', 'New PC', 'Two more script slots.', { money: 240 }, 25, ['ram'], [add('scriptSlots', 2)]),
    upgrade('certification', 'Certification', 'Tickets and ticket bots pay three times as much.', { money: 150 }, 20, [], [multiply('ticketValue', 3), multiply('ticketBotRate', 3)]),
    upgrade('rssFeeds', 'RSS feeds', 'Three times as many words from scouring and scraping.', { money: 120 }, 20, ['wgetMirror'], [multiply('scourValue', 3), multiply('scraperRate', 3)]),
    upgrade('dirb', 'dirb', 'Find folders. A dedicated tool uses requests more efficiently.', { insight: 35 }, 60, [], [multiply('searchEfficiency', 1.5)], 'folder'),
    upgrade('freeProxies', 'Free proxy list', 'Three additional IPs. Free proxies need replacing.', { money: 180 }, 30, ['throttle'], [add('proxySlots', 3)]),
    upgrade('threads8', 'Eight threads', 'Twice as many threads per script.', { insight: 30 }, 35, ['curlBatch'], [multiply('threadsPerScript', 2)]),
    upgrade('adsl', 'ADSL', 'Three times the requests per thread.', { money: 450 }, 60, ['isdn'], [multiply('requestsPerThread', 3)]),
    upgrade('secondPc', 'Second PC', 'Three more script slots.', { money: 700 }, 80, ['newPc'], [add('scriptSlots', 3)]),
    upgrade('extensionList', 'Extension list', 'Also try .html, .php, .asp and .txt.', { insight: 25 }, 120, [], [], 'extension'),
    upgrade('dictWords', '/usr/share/dict/words', '102,774 entries. A much wider vocabulary.', { words: 3500 }, 90, ['english10k']),
    upgrade('proxyChecker', 'Proxy checker', 'Automatically replace dead proxies after 10 seconds.', { insight: 45, money: 250 }, 75, ['freeProxies']),
    upgrade('sizeFilter', 'Response-size filter', 'Ignore identical wildcard responses.', { insight: 25 }, 170, [], [], 'wildcard'),
    upgrade('dorking', 'Search engine dorking', 'Skip the 8% of generated pages already indexed.', { insight: 40 }, 90, [], [add('dorkChance', 0.08)]),
    upgrade('gobuster', 'gobuster', 'Twice the useful work from every request.', { insight: 60, money: 400 }, 150, ['dirb'], [multiply('searchEfficiency', 2)]),
    upgrade('seniorCertification', 'Senior certification', 'Triple ticket income again.', { money: 800 }, 140, ['certification'], [multiply('ticketValue', 3), multiply('ticketBotRate', 3)]),
    upgrade('archives', 'Public archives', 'Triple word income again.', { money: 600 }, 140, ['rssFeeds'], [multiply('scourValue', 3), multiply('scraperRate', 3)]),
    upgrade('proxyPool', 'Larger proxy pool', 'Six more proxy slots.', { money: 700 }, 140, ['freeProxies'], [add('proxySlots', 6)]),
    upgrade('cable', 'Cable connection', 'Three times the requests per thread.', { money: 1400 }, 220, ['adsl'], [multiply('requestsPerThread', 3)]),
    upgrade('mutationRules', 'Mutation rules', 'Try letter-to-digit substitutions in your wordlists.', { insight: 50 }, 260),
    upgrade('rockyou', 'rockyou.txt', '14,344,391 entries. An alternative for many leet answers.', { words: 9000 }, 260),
    upgrade('server', 'A server under the desk', 'Four more script slots.', { money: 2200 }, 260, ['secondPc'], [add('scriptSlots', 4)]),
    upgrade('scrabble', 'scrabble.txt', '279,496 entries. Covers the complete single-word vocabulary.', { words: 14000 }, 220, ['dictWords']),
    upgrade('threads32', 'Thirty-two threads', 'Four times as many threads per script.', { insight: 80 }, 250, ['threads8'], [multiply('threadsPerScript', 4)]),
    upgrade('numberRanges', 'Number ranges', 'Try years 1000–2099 first.', { insight: 30 }, 350),
    upgrade('rentedAddresses', 'Rented IP addresses', 'Sixteen reliable IPs. No replacement needed.', { money: 2000 }, 300, ['proxyPool'], [add('extraAddresses', 16)]),
    upgrade('ffuf', 'ffuf', 'Twice the useful work; includes response-size filtering.', { insight: 120, money: 1800 }, 400, ['gobuster'], [multiply('searchEfficiency', 2)]),
    upgrade('clusterBomb', 'Cluster bomb', 'Try username and password pairs.', { insight: 50 }, 450, [], [], 'credentials'),
    upgrade('crackHtpasswd', 'Crack .htpasswd', 'Use the credentials from your recovered file.', { insight: 80 }, 450, ['clusterBomb']),
    upgrade('fiber', 'Fiber', 'Three times the requests per thread.', { money: 4500 }, 500, ['cable'], [multiply('requestsPerThread', 3)]),
    upgrade('addressBlock', 'An address block', 'Sixty-four more reliable IPs.', { money: 6000 }, 500, ['rentedAddresses'], [add('extraAddresses', 64)]),
    upgrade('combinator', 'Combinator', 'Try pairs of common words joined together.', { insight: 80 }, 650),
    upgrade('indexCache', 'Cached search results', 'Another 8% of pages are already indexed.', { insight: 100, words: 20000 }, 600, ['dorking'], [add('dorkChance', 0.08)]),
    upgrade('leavePcOn', 'Leave the PC on', 'Increase offline progress from 12 to 24 hours.', { money: 500 }, 100),
];

export function offeredUpgrades(state: GameState): readonly Upgrade[] {
    const blocker = state.flags.automated ? planSearch(state.currentLevel + 1, searchCapabilities(state)).blockedBy : null;
    return upgrades.filter((item) => {
        if (owns(state, item.id) || !item.isAvailable(state)) return false;
        if (item.id === 'crackHtpasswd' && !state.findings.htpasswd) return false;
        return state.flags[`seen:${item.id}`] === true || item.fixes === blocker ||
            (item.id === 'throttle' && state.flags.networkRevealed) ||
            Object.entries(item.price).every(([resource, cost]) => (state.resources[resource] ?? 0) >= cost * 0.3);
    });
}
