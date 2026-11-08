export const browserName = 'Enigma Web';

export function fill(template: string, values: Readonly<Record<string, string | number>>): string {
    return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => String(values[key] ?? placeholder));
}

export const automationText = {
    program: 'DirBuster',
    description: 'DirBuster tries page names from a list of words until it finds a page that exists.',
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
    downloadHost: 'ftp.openwall.com',
    hardwareTitle: 'Found New Hardware',
    hardwareStatus: 'Installing the software for your new hardware...',
    connectionTitle: 'Connecting to {name}',
    connectionSteps: ['Dialing...', 'Verifying user name and password...', 'Connected.'],
} as const;

export const notices = {
    firstRateLimit: '429 Too Many Requests. The server only accepts about 15 requests per second from one IP address and rejects the rest. While you send more than that, your Heat rises, and at 100% Heat the server bans you for a while.',
    userAgentBlock: '403 Forbidden on every request. The server now blocks DirBuster, but it still lets your browser in.',
    folderBlock: 'DirBuster finds nothing new. The next levels are inside a folder, and DirBuster does not search inside folders.',
    extensionBlock: 'No .htm page matches. The next level has a different file extension.',
    wildcardBlock: 'This folder returns a page for every name, so every guess looks like a hit.',
    credentialsBlock: '401 Unauthorized. The next level asks for a user name and a password.',
    wordlistExhausted: 'The next answer is not in words.txt. DirBuster is now trying every combination of letters, which will take a very long time.',
    leetAnswer: 'The next answer uses digits in place of some letters, so it is not in any wordlist. Brute force will take a long time.',
    numberAnswer: 'The next answer is a number. DirBuster is trying every number from 0000 to 9999.',
    twoWordsAnswer: 'The next answer is two words written together, and your wordlists only have one word per line.',
    phraseWall: 'The next answer is a whole phrase. No wordlist contains phrases, and brute force would take years.',
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
    welcome: 'Welcome to Enigma Web',
    featuredHeading: 'Featured riddle',
    featuredBlurb: 'A new webriddle!',
    communitiesHeading: 'Communities',
    enigmatics: 'Enigmatics',
    enigmaticsBlurb: 'A list of every known webriddle, with tools and weekly puzzles.',
    nordinho: 'Nordinho',
    nordinhoBlurb: 'An old gaming forum where people ask each other for webriddle hints.',
    toolsHeading: 'Tools',
    tools: { dcode: 'dCode', cyberChef: 'CyberChef', rumkin: 'Rumkin cipher tools' },
    footer: '© 2006 Enigma Web',
} as const;

export const riddleHomeText = {
    description: '{name} is an online riddle with more than 100 levels. Each level is a web page with a puzzle, and solving the puzzle tells you the address of the next level.',
    start: 'Start',
    rulesHeading: 'Rules',
    rules: ['Do not post answers on Nordinho or anywhere else.', 'Do not brute force the levels.', 'Have fun.'],
    hallOfFameHeading: 'Hall of Fame',
    hallOfFameColumns: ['#', 'Name', 'Date'],
    hallOfFame: 'Nobody has finished {name} yet.',
    subpageTitle: '{name} - {page}',
    back: 'Back',
    visitors: 'Visitors since November 2005',
    updated: 'Last updated: 14 March 2006',
} as const;

export const pageText = {
    levelTitle: 'Level {level}',
    levelTitleWithClue: 'Level {level}: {clue}',
    folderComment: 'new levels go in /{folder}/',
    wildcardPage: 'nothing here.',
} as const;

export const upgradeText = {
    curlBatch: { name: 'Parallel requests', description: 'Your script sends several requests at once instead of waiting for each answer.' },
    sortByFrequency: { name: 'Sort by frequency', description: 'Reorders your wordlists from the most common word to the rarest.', effect: 'Answers that are common words are found much sooner.' },
    keepAlive: { name: 'Keep-alive', description: 'Your script reuses one connection instead of opening a new one for every request.' },
    fakeUserAgent: { name: 'Browser user-agent', description: 'Your script tells the server that it is a normal web browser.', effect: 'Gets DirBuster past the 403 Forbidden block.' },
    throttle: { name: 'Throttle', description: 'Your scripts wait instead of sending more requests than the server accepts.', effect: 'You never go over the server limit, so your Heat goes down instead of up.' },
    ram: { name: 'More RAM', description: 'Enough memory to run another script at the same time.' },
    wgetMirror: { name: 'wget --mirror', description: 'A command that downloads entire websites, so a script can collect the words on them.', effect: 'New script job: Scraping. Each script collects {scraperRate} words per second.' },
    autoReplyMacros: { name: 'Auto-reply macros', description: 'Canned replies that let a script close help desk tickets for you.', effect: 'New script job: Closing tickets. Each script earns ${ticketBotRate} per second.' },
    otherRiddles: { name: 'Riddle bookmarks', description: 'A list of other webriddles that a script can work through.', effect: 'New script job: Other riddles. Each script earns {riddleBotRate} insight per second.' },
    isdn: { name: 'ISDN', description: 'A digital phone line that is faster than your 56k modem.' },
    english10k: { name: 'english-10k.txt', description: 'A wordlist with the 10,000 most common English words.', effect: 'DirBuster tries these words when words.txt runs out.' },
    newPc: { name: 'New PC', description: 'A faster computer that can run more scripts at once.' },
    certification: { name: 'Certification', description: 'A help desk certificate that gets you better-paid tickets.' },
    rssFeeds: { name: 'RSS feeds', description: 'Feeds that deliver new articles to you, so you find more words with less effort.' },
    dirb: { name: 'dirb', description: 'A command-line tool made for finding hidden pages and folders. It wastes fewer requests than your script.', effect: 'DirBuster searches inside folders.' },
    freeProxies: { name: 'Free proxy list', description: 'Public proxy servers that let you send requests from other IP addresses. Each one stops working after a few minutes.' },
    threads8: { name: 'Eight threads', description: 'Your script sends twice as many requests at once.' },
    adsl: { name: 'ADSL', description: 'Broadband internet over your phone line.' },
    secondPc: { name: 'Second PC', description: 'Another computer for running scripts.' },
    extensionList: { name: 'Extension list', description: 'A list of other file extensions that web pages use.', effect: 'DirBuster also tries .html, .php, .asp and .txt.' },
    dictWords: { name: '/usr/share/dict/words', description: 'The dictionary file that comes with Unix. It has 102,774 words.', effect: 'DirBuster tries these words when english-10k.txt runs out.' },
    proxyChecker: { name: 'Proxy checker', description: 'A script that tests your proxies and swaps out the ones that stopped working.', effect: 'Dead proxies are replaced automatically after 10 seconds.' },
    sizeFilter: { name: 'Response-size filter', description: 'Ignores responses that have the same size as a page that does not exist.', effect: 'Gets DirBuster through folders that answer every request.' },
    dorking: { name: 'Search engine dorking', description: 'Search queries that list the pages a search engine has already found on the riddle\'s server.' },
    gobuster: { name: 'gobuster', description: 'A faster tool than dirb that wastes even fewer requests.' },
    seniorCertification: { name: 'Senior certification', description: 'A higher help desk certificate for even better-paid tickets.' },
    archives: { name: 'Public archives', description: 'Old newsgroup and mailing list archives that are full of text.' },
    proxyPool: { name: 'Larger proxy pool', description: 'A longer list of free proxy servers.' },
    cable: { name: 'Cable internet', description: 'Internet through the TV cable.' },
    mutationRules: { name: 'Mutation rules', description: 'Rules that make variants of each word with digits for letters, such as l1ght for light.', effect: 'DirBuster also tries every word with digits in place of letters.' },
    rockyou: { name: 'rockyou.txt', description: 'A list of 14,344,391 real passwords. Many of them are words written with digits.', effect: 'DirBuster can find many answers that use digits in place of letters.' },
    server: { name: 'Server', description: 'A rack server under your desk that runs scripts.' },
    scrabble: { name: 'scrabble.txt', description: 'Every word that is allowed in Scrabble, 279,496 in total.', effect: 'DirBuster tries these words when the Unix dictionary runs out.' },
    threads32: { name: 'Thirty-two threads', description: 'Your script sends four times as many requests at once.' },
    numberRanges: { name: 'Number ranges', description: 'A list of the years from 1000 to 2099.', effect: 'Answers that are years are found much sooner.' },
    rentedAddresses: { name: 'Rented IP addresses', description: 'IP addresses that you pay for. Unlike free proxies, they keep working.' },
    ffuf: { name: 'ffuf', description: 'The fastest of these tools. It also ignores repeated responses.', effect: 'Includes the response-size filter.' },
    clusterBomb: { name: 'Cluster bomb', description: 'An attack mode that tries every user name with every password.', effect: 'DirBuster can get past password prompts.' },
    crackHtpasswd: { name: 'Crack .htpasswd', description: 'Cracks the password hashes in the .htpasswd file you found.', effect: 'DirBuster logs in with the cracked passwords.' },
    fiber: { name: 'Fiber', description: 'A fiber-optic internet connection.' },
    addressBlock: { name: 'Address block', description: 'A block of 64 IP addresses that you rent.' },
    combinator: { name: 'Combinator', description: 'Joins pairs of words from your wordlists.', effect: 'DirBuster can find answers made of two words.' },
    indexCache: { name: 'Cached search results', description: 'Old copies of search results that still list pages the server has removed.' },
    leavePcOn: { name: 'Leave the PC on', description: 'Your computer keeps running while you are away.', effect: 'Offline progress: 12 hours → 24 hours' },
} as const satisfies Record<string, { readonly name: string; readonly description: string; readonly effect?: string }>;

export type UpgradeId = keyof typeof upgradeText;

export const statText = {
    threadsPerScript: { label: 'Threads per script', value: '{value}' },
    requestsPerThread: { label: 'Requests per thread', value: '{value}/s' },
    scriptSlots: { label: 'Script slots', value: '{value}' },
    ticketValue: { label: 'Pay per ticket', value: '${value}' },
    ticketBotRate: { label: 'Pay per ticket script', value: '${value}/s' },
    scourValue: { label: 'Words per scour', value: '{value}' },
    scraperRate: { label: 'Words per scraping script', value: '{value}/s' },
    riddleBotRate: { label: 'Insight per riddle script', value: '{value}/s' },
    searchEfficiency: { label: 'Search efficiency', value: '{value}×' },
    proxySlots: { label: 'Proxy slots', value: '{value}' },
    extraAddresses: { label: 'Rented IP addresses', value: '{value}' },
    dorkChance: { label: 'Levels already found by search engines', value: '{value}%' },
} as const satisfies Record<string, { readonly label: string; readonly value: string }>;

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
    automate: 'Install DirBuster',
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
    dirbusting: 'Running DirBuster',
    scraping: 'Scraping',
    ticketBot: 'Closing tickets',
    otherRiddles: 'Other riddles',
    replace: 'Replace',
    connection: 'Connection',
    tool: 'Tool',
    ips: 'IP addresses',
    rateLimit: 'Server limit',
    sending: 'Requests sent',
    heat: 'Heat',
    banned: 'Banned for {time}',
    proxyDead: 'dead',
    awayCapped: 'capped at',
} as const;

export const uiText = {
    follow: 'Return to current level',
    workersHelp: 'Scripts without another job run DirBuster.',
    findingsOdds: 'Drop rates',
    findingsHelp: 'A find about every three minutes of running. Guaranteed within six minutes.',
    findingsOddsTitle: 'Findings: drop rates',
    unknownFinding: '????',
    machineDetails: 'Your computer',
    proxies: 'Proxies',
    proxyCount: '{working} working, {dead} dead',
    individualProxies: 'Proxy list',
    replaceDeadProxies: 'Replace dead proxies',
    replacement: 'Replacing a proxy is free.',
    threads: 'Threads per script',
    slots: 'Script slots',
    efficiency: 'Search efficiency',
    requests: 'requests/s',
    waiting: 'Waiting for a script',
    paused: 'No scripts are running DirBuster',
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
    effectLine: '{label}: {before} → {after}',
    stopped: 'Stopped',
    away: 'You were away for {time}.',
    levelsSolved: 'levels solved',
    dismiss: 'Dismiss',
    noUpgrades: 'No upgrades are available right now.',
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
    banned: 'Banned for {time}. Solve the captcha in the browser or wait.',
    progress: '{list}: {tried} of {total} tried, about {time} left',
    found: '+ /{path} (CODE:200|SIZE:{size})',
    hand: 'solved by hand',
    indexed: 'indexed page',
    identicalResponse: '[identical response]',
    testing: '--> Testing:',
    blocks: {
        unguessable: 'This level has to be solved in the browser',
        userAgent: '403 Forbidden: the server blocks DirBuster',
        folder: 'Nothing found: the next level is inside a folder',
        extension: 'No .htm page matches: the next level has another extension',
        wildcard: 'Every name returns a page: DirBuster needs a size filter',
        credentials: '401 Unauthorized: the next level needs a user name and password',
    },
} as const;

export const searchText = {
    folders: '{phase} (folders)',
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
