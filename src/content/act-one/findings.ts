import type { GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import type { GameState } from '../../core/state.ts';
import type { Modifier } from '../../core/stats.ts';
import { effectiveRate } from './network.ts';
import { increment, noticeOnce, solveLevel } from './progress.ts';
import { findingText, type FindingId } from './text.ts';

export interface Finding {
    readonly id: FindingId;
    readonly path: string;
    readonly rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
    readonly weight: number;
    readonly description: string;
    readonly file: string;
    readonly money?: number;
    readonly levels?: number;
    readonly speed?: number;
}

export const findings: readonly Finding[] = [
    { id: 'robots', path: 'robots.txt', rarity: 'common', weight: 22, money: 15, ...findingText.robots },
    { id: 'readme', path: 'readme.txt', rarity: 'common', weight: 20, money: 25, ...findingText.readme },
    { id: 'sitemap', path: 'sitemap.xml', rarity: 'common', weight: 18, levels: 3, ...findingText.sitemap },
    { id: 'dictionary', path: 'words.bak', rarity: 'uncommon', weight: 11, ...findingText.dictionary },
    { id: 'notes', path: 'notes.old', rarity: 'uncommon', weight: 9, money: 60, ...findingText.notes },
    { id: 'cache', path: 'cache/', rarity: 'uncommon', weight: 7, levels: 5, ...findingText.cache },
    { id: 'git', path: '.git/', rarity: 'rare', weight: 4, speed: 0.1, ...findingText.git },
    { id: 'htpasswd', path: '.htpasswd', rarity: 'rare', weight: 3, money: 75, ...findingText.htpasswd },
    { id: 'backup', path: 'backup.zip', rarity: 'rare', weight: 3, levels: 12, ...findingText.backup },
    { id: 'env', path: '.env', rarity: 'legendary', weight: 1, speed: 0.25, ...findingText.env },
    { id: 'walkthrough', path: 'walkthrough.txt', rarity: 'legendary', weight: 1, levels: 25, ...findingText.walkthrough },
    { id: 'source', path: 'source.tar', rarity: 'legendary', weight: 1, money: 250, ...findingText.source },
];

export function findingModifiers(state: GameState): readonly Modifier[] {
    const bonus = findings.reduce((sum, finding) => sum + (finding.speed ?? 0) * Math.min(5, state.findings[finding.id] ?? 0), 0);
    return [{ statId: 'searchEfficiency', operation: 'multiply', value: 1 + bonus }];
}

function discoverFinding(game: Game, finding: Finding): void {
    const { state } = game;
    state.findings[finding.id] = (state.findings[finding.id] ?? 0) + 1;
    state.flags.findingsRevealed = true;
    game.gainResource('money', finding.money ?? 0);
    if (finding.id === 'dictionary') game.gainResource('words', 1000);
    for (let index = 0; index < (finding.levels ?? 0); index++) solveLevel(game, 'windfall');
    game.invalidateStats();
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
