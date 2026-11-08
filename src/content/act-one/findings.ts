import type { GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import type { GameState } from '../../core/state.ts';
import type { Modifier } from '../../core/stats.ts';
import { effectiveRate } from './network.ts';
import { increment, noticeOnce, solveLevel } from './progress.ts';

export interface Finding {
    readonly id: string;
    readonly path: string;
    readonly rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
    readonly weight: number;
    readonly description: string;
    readonly fileContent: string;
    readonly insight?: number;
    readonly levels?: number;
    readonly speed?: number;
}

export const findings: readonly Finding[] = [
    { id: 'robots', path: 'robots.txt', rarity: 'common', weight: 22, description: '+3 insight per find.', insight: 3, fileContent: 'User-agent: *\nDisallow: /answers/' },
    { id: 'readme', path: 'readme.txt', rarity: 'common', weight: 20, description: '+5 insight per find.', insight: 5, fileContent: 'lowercase. no spaces. look at the source.' },
    { id: 'sitemap', path: 'sitemap.xml', rarity: 'common', weight: 18, description: 'Skip 3 levels per find.', levels: 3, fileContent: '<urlset>\n  <!-- A few paths that should not be here. -->\n</urlset>' },
    { id: 'dictionary', path: 'words.bak', rarity: 'uncommon', weight: 11, description: '+1,000 words per find.', fileContent: '# An old wordlist. Still useful.' },
    { id: 'notes', path: 'notes.old', rarity: 'uncommon', weight: 9, description: '+12 insight per find.', insight: 12, fileContent: 'The picture is not always the clue.' },
    { id: 'cache', path: 'cache/', rarity: 'uncommon', weight: 7, description: 'Skip 5 levels per find.', levels: 5, fileContent: 'Index of /cache/\nFive pages, already answered.' },
    { id: 'git', path: '.git/', rarity: 'rare', weight: 4, description: '+10% search efficiency per copy, up to 5 copies.', speed: 0.1, fileContent: 'An old revision of the riddle. Some patterns have not changed.' },
    { id: 'htpasswd', path: '.htpasswd', rarity: 'rare', weight: 3, description: 'Unlocks Crack .htpasswd. Duplicates give +15 insight.', insight: 15, fileContent: '# Recovered credentials. The tools to read them are in Upgrades.' },
    { id: 'backup', path: 'backup.zip', rarity: 'rare', weight: 3, description: 'Skip 12 levels per find.', levels: 12, fileContent: 'backup.zip\n12 readable pages recovered.' },
    { id: 'env', path: '.env', rarity: 'legendary', weight: 1, description: '+25% search efficiency per copy, up to 5 copies.', speed: 0.25, fileContent: 'RIDDLE_MODE=production\nDEBUG=true' },
    { id: 'walkthrough', path: 'walkthrough.txt', rarity: 'legendary', weight: 1, description: 'Skip 25 levels per find.', levels: 25, fileContent: 'Someone has been here before. The next 25 answers are legible.' },
    { id: 'source', path: 'source.tar', rarity: 'legendary', weight: 1, description: '+50 insight per find.', insight: 50, fileContent: 'A fragment of the machinery behind the pages.' },
];

export function findingModifiers(state: GameState): readonly Modifier[] {
    const bonus = findings.reduce((sum, finding) => sum + (finding.speed ?? 0) * Math.min(5, state.findings[finding.id] ?? 0), 0);
    return [{ statId: 'searchEfficiency', operation: 'multiply', value: 1 + bonus }];
}

function discoverFinding(game: Game, finding: Finding): void {
    const { state } = game;
    state.findings[finding.id] = (state.findings[finding.id] ?? 0) + 1;
    state.flags.findingsRevealed = true;
    game.gainResource('insight', finding.insight ?? 0);
    if (finding.id === 'dictionary') game.gainResource('words', 1000);
    for (let index = 0; index < (finding.levels ?? 0); index++) solveLevel(game, 'windfall');
    game.invalidateStats();
    noticeOnce(game, 'firstFind');
    game.announce({ type: 'findingDiscovered', findingId: finding.id, count: state.findings[finding.id]! });
}

export const findingDrops: GameSystem = {
    update(game, deltaSeconds) {
        if (!game.state.flags.automated || effectiveRate(game) === 0) return;
        const { statistics } = game.state;
        if (statistics.nextFindAfter === undefined) statistics.nextFindAfter = nextDelay(game);
        increment(game.state, 'secondsSinceFind', deltaSeconds);
        if ((statistics.secondsSinceFind ?? 0) < statistics.nextFindAfter) return;
        let roll = game.random() * findings.reduce((sum, finding) => sum + finding.weight, 0);
        const finding = findings.find((candidate) => (roll -= candidate.weight) < 0) ?? findings[0]!;
        discoverFinding(game, finding);
        statistics.secondsSinceFind = 0;
        statistics.nextFindAfter = nextDelay(game);
    },
};

function nextDelay(game: Game): number {
    return Math.min(360, 60 - Math.log(1 - game.random()) * 130);
}
