export const browserName = 'Enigma Web';

export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
    return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => String(values[key] ?? placeholder));
}

export const automationText = {
    program: 'dirbuster',
    description: 'It tries page names from a list of words until one of them exists.',
} as const;

export const setupText = {
    wizardTitle: '{name} Setup',
    welcomeHeading: 'Welcome to the {name} Setup Wizard',
    welcomeBody: 'This will install {name} on your computer.',
    welcomeNext: 'Click Next to continue.',
    installingHeading: 'Installing {name}',
    copying: 'Copying {file}...',
    wizardFiles: ['dirbuster.exe', 'words.txt', 'readme.txt'],
    finishHeading: 'Completing the {name} Setup Wizard',
    finishBody: '{name} has been installed. Click Finish to run it.',
    back: '< Back',
    next: 'Next >',
    finish: 'Finish',
    cancel: 'Cancel',
    installTitle: '{name} Setup',
    installing: 'Installing {name}...',
    downloadTitle: 'File Download',
    downloading: 'Saving {file} from {host}',
    downloadHost: 'ftp.wordlists.example',
    hardwareTitle: 'Found New Hardware',
    hardwareStatus: 'Installing the software for your new hardware...',
    connectionTitle: 'Connecting to {name}',
    connectionSteps: ['Dialing...', 'Verifying user name and password...', 'Connected.'],
} as const;

export const notices = {
    firstRateLimit: '429 Too Many Requests. The server only answers about 15 requests a second from one address. Everything above that bounces.',
    userAgentBlock: '403 Forbidden on every request. The server stopped answering dirbuster, but your browser still gets in.',
    folderBlock: 'Nothing new at the top level. The levels moved into a folder, and dirbuster does not look inside folders.',
    extensionBlock: 'No .htm page matches. This level is not an .htm page.',
    wildcardBlock: 'Every guess in this folder returns a page, so every guess looks like a hit.',
    credentialsBlock: '401 Unauthorized. This page wants a user name and a password.',
    leetAnswer: 'No wordlist has this answer. It is not a plain word, and brute force will take a while.',
    numberAnswer: 'This answer is a number, so dirbuster is counting.',
    twoWordsAnswer: 'This answer is two words glued together, and your lists hold one word per line.',
    phraseWall: 'A whole phrase. No wordlist holds these, and brute force would outlive you.',
    bruteForce: '(!) WARNING: no wordlist matches; falling back to brute force',
    firstBan: '(!) 429: banned; solve the captcha in the browser or wait',
    firstProxyDeath: '(!) a proxy stopped responding',
} as const;

export type NoticeId = keyof typeof notices;

export const handcraftedText = {
    level1: 'step inside.',
    level2: 'look at the address bar.',
    level3: 'get to the source of the problem.',
    level3Comment: 'beneath.htm',
    level4: 'it\'s dark down here.',
    level5Title: 'it blinks.',
    level6: 'i have a GIFT for you.',
    level8Title: 'half moon',
    easterEgg404: 'this level could not be found. (it is right here.)',
    easterEgg418: 'i am a teapot.',
} as const;

export const methodHints = {
    caesar: 'veni, vidi, vici.',
    keyboardRight: 'one step to the right.',
    keyboardLeft: 'one step to the left.',
    pollux: 'one four seven, two five eight, and the rest is silence.',
    gif: 'a GIFT, wrapped the wrong way.',
    txt: 'just TXT me.',
    json: 'ask JSON.',
    css: 'it is all a matter of style.',
} as const;

export const alternateFiles = {
    txt: '{word}',
    json: '{ "next": "{word}.htm" }',
    css: ':root { --next: "{word}"; }',
} as const;

export const clueLines = {
    credentials: 'members only.',
    extension: ['it\'s all in the ending.', 'same name, different ending.'],
} as const;

export const riddleName = 'Notfinite';

export const startPageText = {
    title: 'Welcome to Enigma Web',
    tagline: 'Your start page on the World Wide Web',
    welcome: 'Welcome to Enigma Web',
    intro: 'Everything worth clicking, one click away.',
    riddlesHeading: 'Riddles',
    communitiesHeading: 'Communities',
    featuredHeading: 'Featured riddle',
    featuredBlurb: 'Nobody has finished it. Nobody even knows how long it is.',
    enigmaticsBlurb: 'Puzzles, riddles and enigmas.',
    nordinhoBlurb: 'The forum. Hints, if you ask nicely.',
    footer: '© 2003 Enigma Web. Best viewed at 800 × 600.',
} as const;

export const riddleHomeText = {
    tagline: 'a very-long (100+) webriddle',
    enter: 'enter',
    rulesHeading: 'rules',
    rules: ['no posting answers on Nordinho.', 'no brute forcing.', 'have fun.'],
    hallOfFameHeading: 'hall of fame',
    hallOfFame: 'nobody has finished {name} yet.',
    counter: 'visitors',
    updated: 'last updated 14 march 2003',
} as const;

export const enigmaticsText = {
    tagline: 'puzzles · riddles · enigmas',
    navigation: ['home', 'riddle list', 'forum'],
    listHeading: 'riddle list',
    columns: ['riddle', 'length'],
    riddles: [['Notpron', 'very-long'], ['Polychromasia', '—'], ['ZED', '—'], ['Waste of Time II', '—']],
    notfiniteLength: 'very-long (100+)',
    footer: 'riddlers helping riddlers since 1999',
} as const;

export const nordinhoText = {
    title: 'Nordinho Forums',
    navigation: ['FAQ', 'Search', 'Memberlist', 'Register', 'Log in'],
    board: 'Webriddles',
    columns: ['Topics', 'Replies', 'Author', 'Last post'],
    topics: [
        ['Notfinite: the hint thread (no answers!)', '4211', 'grimoire', 'Today 03:14'],
        ['Has anyone finished Notfinite?', '312', 'lurker42', 'Yesterday 23:50'],
        ['[Notfinite] stuck on level 2 lol', '87', 'newbie', '12 Mar 2003'],
        ['my first riddle, please test', '9', 'jdoe', '02 Mar 2003'],
    ],
    posted: 'Posted: {date}',
    posts: [
        ['grimoire', 'Hints only. Post an answer and you are out.', '02 Feb 2003'],
        ['lurker42', 'how many levels does this thing even have', '19 Feb 2003'],
        ['grimoire', 'Nobody knows. The furthest anyone has got is level 312.', '19 Feb 2003'],
        ['newbie', 'has anyone tried just guessing the addresses?', '12 Mar 2003'],
        ['grimoire', 'Read the rules on the front page.', '12 Mar 2003'],
    ],
} as const;

export const pageText = {
    levelTitle: 'Level {level}',
    levelTitleWithClue: 'Level {level}: {clue}',
    folderComment: 'new levels go in /{folder}/',
    wildcardPage: 'nothing here.',
} as const;

export const upgradeText = {
    curlBatch: { name: 'Run in parallel', description: 'Four threads in your first script.' },
    sortByFrequency: { name: 'Sort by frequency', description: 'Try common words first in every wordlist.' },
    keepAlive: { name: 'Keep-alive', description: 'Reuse the connection. Twice the requests per thread.' },
    fakeUserAgent: { name: 'A familiar user-agent', description: 'Identify your script as a browser.' },
    throttle: { name: 'Throttle', description: 'Stay inside the rate limit. No wasted requests or new heat.' },
    ram: { name: 'More RAM', description: 'Room for a second script.' },
    wgetMirror: { name: 'wget --mirror', description: 'Assign scripts to scrape words: 12 words per second each.' },
    autoReplyMacros: { name: 'Auto-reply macros', description: 'Assign scripts to close tickets: $0.80 per second each.' },
    otherRiddles: { name: 'Riddle bookmarks', description: 'Assign scripts to other riddles: 0.25 insight per second each.' },
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
    gobuster: { name: 'gobuster', description: 'Two and a half times the useful work from every request.' },
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
    robots: {
        description: '+3 insight per find.',
        file: 'User-agent: *\nDisallow: /admin/\nDisallow: /answers/\n# answers stay lowercase',
    },
    readme: {
        description: '+5 insight per find.',
        file: 'README\n\nEvery answer is the name of a page.\nAll lowercase, no spaces.\nStuck? Look at the source.',
    },
    sitemap: {
        description: 'Skip 3 levels per find.',
        file: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset>\n{entries}\n</urlset>',
        entry: '  <url><loc>{url}</loc></url>',
    },
    dictionary: {
        description: '+1,000 words per find.',
        file: '{entries}\n...\n(1,000 lines)',
        entry: '{word}',
    },
    notes: {
        description: '+12 insight per find.',
        file: 'notes\n\n- the picture is not always the clue\n- every answer must be in the dictionary\n- TODO: move new levels into folders',
    },
    cache: {
        description: 'Skip 5 levels per find.',
        file: 'Index of /cache/\n\nName                    Last modified       Size\n{entries}',
        entry: '{name}{date}  {size}',
    },
    git: {
        description: '+10% search efficiency per copy, up to 5 copies.',
        file: 'Index of /.git/\n\nHEAD\nconfig\nlogs/\nobjects/\nrefs/\n\nlogs/HEAD:\nadd levels 1-9\nadd generated levels\nanswers: dictionary words only\nmove levels 100+ into folders\nfix: credentials door',
    },
    htpasswd: {
        description: 'Unlocks Crack .htpasswd. Duplicates give +15 insight.',
        file: 'admin:$apr1$Qx4l1oPZ$Hk3hJ6v.9mJdZf5yq0fN0/\nguest:$apr1$7KmLr2Da$WqU1lN2cE0r9dQ3xY8kL2.',
    },
    backup: {
        description: 'Skip 12 levels per find.',
        file: 'Archive:  backup.zip\n  Length      Date    Time    Name\n---------  ---------- -----   ----\n{entries}',
        entry: '{size}  {date}   {name}',
    },
    env: {
        description: '+25% search efficiency per copy, up to 5 copies.',
        file: 'RIDDLE_ROOT=/var/www/riddle\nANSWERS=lowercase\nWORDLIST=/usr/share/dict/words\nDEBUG=true',
    },
    walkthrough: {
        description: 'Skip 25 levels per find.',
        file: 'walkthrough (spoilers!)\n\n{entries}',
        entry: 'level {level}: {url}',
    },
    source: {
        description: '+50 insight per find.',
        file: 'riddle/\nriddle/make-levels.pl\nriddle/words.txt\nriddle/images/\nriddle/levels/\nriddle/README',
    },
} as const satisfies Record<string, { readonly description: string; readonly file: string; readonly entry?: string }>;

export type FindingId = keyof typeof findingText;

export const labels = {
    automate: 'Install dirbuster',
    youPanel: 'You',
    scriptsPanel: 'Scripts',
    networkPanel: 'Network',
    upgradesPanel: 'Upgrades',
    insight: 'Insight',
    money: 'Money',
    words: 'Words',
    solveRiddle: 'Solve another riddle',
    work: 'Close a ticket',
    scour: 'Scour the web',
    dirbusting: 'Dirbusting',
    scraping: 'Scraping',
    ticketBot: 'Ticket bot',
    otherRiddles: 'Other riddles',
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
    noUpgrades: 'Nothing new to install right now.',
    findingsFolder: 'C:\\findings',
    openHint: 'Double-click a file to open it.',
    foundCount: '{found} of {total} found',
    notepadTitle: '{file} - Notepad',
} as const;

export const terminalText = {
    booting: 'Starting script…',
    curlCommand: '$ while read name; do curl -I "{folder}$name.htm"; done < {list}',
    toolCommand: '$ {tool} -u {folder} -w {list} -t {threads}',
    gobusterCommand: '$ gobuster dir -u {folder} -w {list} -t {threads}',
    ban: '429 · banned; captcha or wait',
    found: '+ /{path} (CODE:200|SIZE:{size})',
    hand: 'solved by hand',
    indexed: 'indexed page',
    identicalResponse: '[identical response]',
    testing: '--> Testing:',
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
