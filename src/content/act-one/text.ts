import type { SubjectCategory } from './word-lists.ts';

export const browserName = 'Enigma Web';

export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
    return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => String(values[key] ?? placeholder));
}

export const automationText = {
    program: 'dirbuster',
    description: 'A program that tries page names from a list of words until one exists.',
    run: 'Run',
} as const;

export const notices = {
    moneyRevealed: 'That costs money. You still have a day job.',
    solveByHand: 'dirbuster is stuck. Solve this level yourself and it can learn the trick.',
    learnedByHand: 'You worked out how this level works. dirbuster can now be taught the same trick.',
    learnedFromForum: 'Someone on the riddle forum explained this one. dirbuster can now be taught the trick.',
    wordsRevealed: 'Your wordlists ran dry. Scour the web for words to build bigger ones.',
    bruteForce: 'Nothing left in your wordlists. Falling back to brute force: aaaa, aaab, aaac...',
    scriptsRevealed: 'You can run more than one script now. Not all of them have to dirbust.',
    firstRateLimit: '429 Too Many Requests. The server allows about 15 requests per second per IP. The rest bounces.',
    firstBan: 'Banned. The server stopped answering you. Solve the captcha in the browser, or wait it out.',
    userAgentBlock: '403 Forbidden on every request. The server stopped talking to curl.',
    folderBlock: 'The root is empty. The levels moved into a folder, and your script does not look in folders.',
    extensionBlock: 'No .htm page matches. This level might not be an .htm at all.',
    wildcardBlock: 'Everything in this folder returns 200. Every guess looks like a hit.',
    leetAnswer: 'This answer is not a plain word. Brute force will take a while.',
    credentialsBlock: '401 Unauthorized. This page wants a username and a password.',
    numberAnswer: 'This answer looks like a number. Trying digits.',
    twoWordsAnswer: 'Two words glued together. Your lists only hold one word per line.',
    phraseWall: 'A whole phrase. No wordlist holds these, and brute force would outlive you.',
    firstProxyDeath: 'A proxy died. Replace it in the Network panel.',
    firstFind: 'That was not a level. Files like these are worth keeping: see Findings.',
    firstSearchSolve: 'Already in a search engine\'s index. No guessing needed.',
} as const;

export type NoticeId = keyof typeof notices;

export const handcraftedText = {
    level1: 'Enter the forest',
    level2: 'Look at the URL.',
    level3: 'Look at the source.',
    level3Comment: 'beneath.htm',
    level4: 'yvtugubhfr',
    level5: 'Lights out.',
    level6: '.gif',
    level8: '13 9 18 18 15 18',
    level9: 'ksud',
    easterEgg404: 'this level could not be found. (it is right here.)',
    easterEgg418: 'i am a teapot.',
} as const;

export const clueLines = {
    leet: 'exactly as written.',
    number: 'a year.',
    credentials: 'members only.',
    twoWords: 'together.',
    phrase: 'all of it, without spaces.',
    extension: 'mind the extension.',
} as const;

export const picturePrompts: Readonly<Record<SubjectCategory, string>> = {
    flower: 'name the flower.',
    building: 'name the building.',
    animal: 'name the animal.',
    scene: 'say what you see.',
};

export const pageText = {
    levelTitle: 'Level {level}',
    levelTitleWithClue: 'Level {level}: {clue}',
} as const;

export const upgradeText = {
    curlBatch: { name: 'Run in parallel', description: 'Four threads in your first script.' },
    sortByFrequency: { name: 'Sort by frequency', description: 'Try common words first in every wordlist.' },
    keepAlive: { name: 'Keep-alive', description: 'Reuse the connection. Twice the requests per thread.' },
    fakeUserAgent: { name: 'A familiar user-agent', description: 'Identify your script as a browser.' },
    throttle: { name: 'Throttle', description: 'Stay inside the rate limit. No wasted requests or new heat.' },
    ram: { name: 'More RAM', description: 'Room for a second script.' },
    wgetMirror: { name: 'wget --mirror', description: 'Assign scripts to scrape words: 12 words per second each.' },
    autoReplyMacros: { name: 'Auto-reply macros', description: 'Assign scripts to close tickets: $1 per second each.' },
    isdn: { name: 'ISDN', description: 'Twice the requests per thread.' },
    english10k: { name: 'english-10k.txt', description: '10,000 entries. Covers more unusual words.' },
    newPc: { name: 'New PC', description: 'Two more script slots.' },
    certification: { name: 'Certification', description: 'Tickets and ticket bots pay three times as much.' },
    rssFeeds: { name: 'RSS feeds', description: 'Three times as many words from scouring and scraping.' },
    dirb: { name: 'dirb', description: 'Find folders. A dedicated tool uses requests more efficiently.' },
    freeProxies: { name: 'Free proxy list', description: 'Three additional IPs. Free proxies need replacing.' },
    threads8: { name: 'Eight threads', description: 'Twice as many threads per script.' },
    adsl: { name: 'ADSL', description: 'Three times the requests per thread.' },
    secondPc: { name: 'Second PC', description: 'Three more script slots.' },
    extensionList: { name: 'Extension list', description: 'Also try .html, .php, .asp and .txt.' },
    dictWords: { name: '/usr/share/dict/words', description: '102,774 entries. A much wider vocabulary.' },
    proxyChecker: { name: 'Proxy checker', description: 'Automatically replace dead proxies after 10 seconds.' },
    sizeFilter: { name: 'Response-size filter', description: 'Ignore identical wildcard responses.' },
    dorking: { name: 'Search engine dorking', description: 'Skip the 8% of generated pages already indexed.' },
    gobuster: { name: 'gobuster', description: 'Twice the useful work from every request.' },
    seniorCertification: { name: 'Senior certification', description: 'Triple ticket income again.' },
    archives: { name: 'Public archives', description: 'Triple word income again.' },
    proxyPool: { name: 'Larger proxy pool', description: 'Six more proxy slots.' },
    cable: { name: 'Cable connection', description: 'Three times the requests per thread.' },
    mutationRules: { name: 'Mutation rules', description: 'Try letter-to-digit substitutions in your wordlists.' },
    rockyou: { name: 'rockyou.txt', description: '14,344,391 entries. An alternative for many leet answers.' },
    server: { name: 'A server under the desk', description: 'Four more script slots.' },
    scrabble: { name: 'scrabble.txt', description: '279,496 entries. Covers the complete single-word vocabulary.' },
    threads32: { name: 'Thirty-two threads', description: 'Four times as many threads per script.' },
    numberRanges: { name: 'Number ranges', description: 'Try years 1000–2099 first.' },
    rentedAddresses: { name: 'Rented IP addresses', description: 'Sixteen reliable IPs. No replacement needed.' },
    ffuf: { name: 'ffuf', description: 'Twice the useful work; includes response-size filtering.' },
    clusterBomb: { name: 'Cluster bomb', description: 'Try username and password pairs.' },
    crackHtpasswd: { name: 'Crack .htpasswd', description: 'Use the credentials from your recovered file.' },
    fiber: { name: 'Fiber', description: 'Three times the requests per thread.' },
    addressBlock: { name: 'An address block', description: 'Sixty-four more reliable IPs.' },
    combinator: { name: 'Combinator', description: 'Try pairs of common words joined together.' },
    indexCache: { name: 'Cached search results', description: 'Another 8% of pages are already indexed.' },
    leavePcOn: { name: 'Leave the PC on', description: 'Increase offline progress from 12 to 24 hours.' },
} as const satisfies Record<string, { readonly name: string; readonly description: string }>;

export type UpgradeId = keyof typeof upgradeText;

export const findingText = {
    robots: { description: '+$15 per find.', file: 'User-agent: *\nDisallow: /answers/' },
    readme: { description: '+$25 per find.', file: 'lowercase. no spaces. look at the source.' },
    sitemap: { description: 'Skip 3 levels per find.', file: '<urlset>\n  <!-- A few paths that should not be here. -->\n</urlset>' },
    dictionary: { description: '+1,000 words per find.', file: '# An old wordlist. Still useful.' },
    notes: { description: '+$60 per find.', file: 'The picture is not always the clue.' },
    cache: { description: 'Skip 5 levels per find.', file: 'Index of /cache/\nFive pages, already answered.' },
    git: { description: '+10% search efficiency per copy, up to 5 copies.', file: 'An old revision of the riddle. Some patterns have not changed.' },
    htpasswd: { description: 'Unlocks Crack .htpasswd. Duplicates give +$75.', file: '# Recovered credentials. The tools to read them are in Upgrades.' },
    backup: { description: 'Skip 12 levels per find.', file: 'backup.zip\n12 readable pages recovered.' },
    env: { description: '+25% search efficiency per copy, up to 5 copies.', file: 'RIDDLE_MODE=production\nDEBUG=true' },
    walkthrough: { description: 'Skip 25 levels per find.', file: 'Someone has been here before. The next 25 answers are legible.' },
    source: { description: '+$250 per find.', file: 'A fragment of the machinery behind the pages.' },
} as const satisfies Record<string, { readonly description: string; readonly file: string }>;

export type FindingId = keyof typeof findingText;

export const labels = {
    automate: 'Automate?',
    youPanel: 'You',
    scriptsPanel: 'Scripts',
    networkPanel: 'Network',
    upgradesPanel: 'Upgrades',
    findingsPanel: 'Findings',
    money: 'Money',
    words: 'Words',
    work: 'Close a ticket',
    scour: 'Scour the web',
    dirbusting: 'Dirbusting',
    scraping: 'Scraping',
    ticketBot: 'Ticket bot',
    replace: 'Replace',
    connection: 'Connection',
    tool: 'Tool',
    ips: 'IPs',
    rateLimit: 'Allowed',
    sending: 'Sending',
    heat: 'Heat',
    banned: 'Banned',
    proxyAlive: 'alive',
    proxyDead: 'dead',
    awayCapped: 'capped at',
} as const;

export const uiText = {
    follow: 'Return to current level',
    workersHelp: 'Unassigned scripts keep dirbusting.',
    findingsOdds: 'Drop rates',
    findingsHelp: 'A find about every three minutes of running. Guaranteed within six minutes.',
    findingsOddsTitle: 'Findings · drop rates',
    unknownFinding: '????',
    machineDetails: 'Machine details',
    proxies: 'Proxies',
    individualProxies: 'Individual proxies',
    replaceDeadProxies: 'Replace dead proxies',
    replacement: 'Free replacement',
    threads: 'Threads / script',
    slots: 'Script slots',
    efficiency: 'Search efficiency',
    requests: 'requests/s',
    waiting: 'Waiting for a script',
    paused: 'No scripts assigned to dirbusting',
    exhaust: 'to exhaust',
    none: 'None yet',
    copied: 'Exported. Copy the selected save text.',
    imported: 'Save imported.',
    wrongCredentials: 'The user name or password is incorrect.',
    history: 'History',
    source: 'View Source',
    pageSource: 'Page source',
    closeSource: 'Close source',
    sourceShortcut: 'Ctrl+U',
    pageTitle: 'Riddle page',
    saveString: 'Save string',
    addWorker: 'Add {job} script',
    removeWorker: 'Remove {job} script',
    cost: 'Cost',
    stopped: 'Stopped',
    away: 'While you were away',
    levelsSolved: 'levels solved',
    dismiss: 'Dismiss',
} as const;

export const terminalText = {
    title: 'Request log',
    session: 'Resuming the script.',
    booting: 'Starting script…',
    curlCommand: '$ while read name; do curl -I "{folder}$name.htm"; done < {list}',
    toolCommand: '$ {tool} -u {folder} -w {list} -t {threads}',
    gobusterCommand: '$ gobuster dir -u {folder} -w {list} -t {threads}',
    ban: '429 · banned; captcha or wait',
    unbanned: 'Connection restored.',
    wrongCaptcha: 'Captcha rejected. Try again.',
    purchased: 'Installed',
    found: 'FOUND',
    hand: 'solved by hand',
    indexed: 'indexed page',
    identicalResponse: '[identical response]',
    testing: '--> Testing:',
    readPage: 'Read the page to find the next address.',
    blocks: { unguessable: 'Read this page by hand', userAgent: '403 · user-agent rejected', folder: 'No paths found · needs recursion', extension: 'No .htm matches · try other extensions', wildcard: 'Wildcard responses · needs size filtering', credentials: '401 · needs credential pairs' },
} as const;

export const searchText = {
    folders: 'folders · {phase}',
    extensions: '{list} × {count} extensions',
    mutations: '{list} × {count} mutations',
    years: 'years 1000-2099',
    allNumbers: '0000-9999',
    cracked: '.htpasswd (cracked)',
    credentialPairs: 'usernames × passwords',
    wordPairs: '{list} × {list}',
    bruteForce: 'brute force, {alphabet}, {length} characters',
} as const;

export const connectionNames: readonly string[] = ['56k modem', 'ISDN', 'ADSL', 'Cable', 'Fiber'];

export const toolNames: readonly string[] = ['bash loop', 'dirb', 'gobuster', 'ffuf'];

export const errorPages = {
    notFoundTitle: 'The page cannot be found',
    notFoundBody: 'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.',
    notFoundTips: [
        'If you typed the page address in the Address bar, make sure that it is spelled correctly.',
        'Click the Back button to try another link.',
    ],
    notFoundCode: 'HTTP 404 - File not found',
    unavailableTitle: 'The page cannot be displayed',
    unavailableBody: 'The page you are looking for is currently unavailable. The Web site might be experiencing technical difficulties.',
    unavailableCode: 'Cannot find server or DNS Error',
    unauthorizedTitle: 'You are not authorized to view this page',
    unauthorizedBody: 'You do not have permission to view this directory or page using the credentials you supplied.',
    unauthorizedTips: [
        'Click the Refresh button to try again with different credentials.',
    ],
    unauthorizedCode: 'HTTP 401 - Unauthorized',
    pleaseTry: 'Please try the following:',
} as const;

export const captchaText = {
    title: 'Verify that you are human',
    checkbox: 'I\'m not a robot',
    automated: 'Your requests look automated.',
    selectAll: 'Select all images with',
    typeWord: 'Type the word you see',
    verify: 'VERIFY',
    tryAgain: 'Please try again.',
} as const;

export const dialogText = {
    aboutTitle: `About ${browserName}`,
    aboutBody: [browserName, 'Version 1.0'],
    optionsTitle: 'Internet Options',
    optionsSound: 'Play sounds',
    optionsSaving: 'Your progress is saved automatically.',
    exportTitle: 'Import and Export',
    exportBody: 'Export copies your game as text. Import replaces your game with text you paste here.',
    exportButton: 'Export',
    importButton: 'Import',
    importConfirm: 'Replace your current game with this save?',
    loginTitle: 'Enter Network Password',
    loginPrompt: 'Please type your user name and password.',
    loginSite: 'Site',
    loginRealm: 'Realm',
    loginUser: 'User Name',
    loginPassword: 'Password',
    ok: 'OK',
    close: 'Close',
} as const;

export const menuText = {
    file: 'File',
    edit: 'Edit',
    view: 'View',
    favorites: 'Favorites',
    tools: 'Tools',
    help: 'Help',
    importExport: 'Import and Export...',
    selectAll: 'Select All',
    source: 'Source',
    refresh: 'Refresh',
    addFavorite: 'Add to Favorites...',
    organizeFavorites: 'Organize Favorites...',
    internetOptions: 'Internet Options...',
    about: `About ${browserName}`,
    back: 'Back',
    forward: 'Forward',
    stop: 'Stop',
    home: 'Home',
    address: 'Address',
    go: 'Go',
    statusDone: 'Done',
    statusOpening: 'Opening page',
    statusShortcut: 'Shortcut to',
    zone: 'Internet',
} as const;
