import type { GameSystem } from '../../core/content.ts';
import type { Game } from '../../core/game.ts';
import type { GameState } from '../../core/state.ts';
import type { Modifier } from '../../core/stats.ts';
import { answeredRate } from './network.ts';
import { urlOfLevel } from './levels.ts';
import { increment, solveLevel } from './progress.ts';
import { fill, findingText, type FindingId } from './text.ts';
import { wordAtRank } from './vocabulary.ts';

export interface Finding {
    readonly id: FindingId;
    readonly path: string;
    readonly rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
    readonly weight: number;
    readonly description: string;
    readonly file: string;
    readonly insight?: number;
    readonly levels?: number;
    readonly speed?: number;
}

// Parked: findings are switched off until they come back as an upgrade. Keep the code compiling and tested.
export const findingsEnabled = false;

export const findings: readonly Finding[] = [
    { id: 'robots', path: 'robots.txt', rarity: 'common', weight: 22, insight: 3, ...findingText.robots },
    { id: 'readme', path: 'readme.txt', rarity: 'common', weight: 20, insight: 5, ...findingText.readme },
    { id: 'sitemap', path: 'sitemap.xml', rarity: 'common', weight: 18, levels: 3, ...findingText.sitemap },
    { id: 'dictionary', path: 'words.bak', rarity: 'uncommon', weight: 11, ...findingText.dictionary },
    { id: 'notes', path: 'notes.old', rarity: 'uncommon', weight: 9, insight: 12, ...findingText.notes },
    { id: 'cache', path: 'cache/', rarity: 'uncommon', weight: 7, levels: 5, ...findingText.cache },
    { id: 'git', path: '.git/', rarity: 'rare', weight: 4, speed: 0.1, ...findingText.git },
    { id: 'htpasswd', path: '.htpasswd', rarity: 'rare', weight: 3, insight: 15, ...findingText.htpasswd },
    { id: 'backup', path: 'backup.zip', rarity: 'rare', weight: 3, levels: 12, ...findingText.backup },
    { id: 'env', path: '.env', rarity: 'legendary', weight: 1, speed: 0.25, ...findingText.env },
    { id: 'walkthrough', path: 'walkthrough.txt', rarity: 'legendary', weight: 1, levels: 25, ...findingText.walkthrough },
    { id: 'source', path: 'source.tar', rarity: 'legendary', weight: 1, insight: 50, ...findingText.source },
];

export function findingModifiers(state: GameState): readonly Modifier[] {
    const bonus = findings.reduce((sum, finding) => sum + (finding.speed ?? 0) * Math.min(5, state.findings[finding.id] ?? 0), 0);
    return [{ statId: 'searchEfficiency', operation: 'multiply', value: 1 + bonus }];
}

function discoverFinding(game: Game, finding: Finding): void {
    const { state } = game;
    state.findings[finding.id] = (state.findings[finding.id] ?? 0) + 1;
    state.statistics[`foundAtLevel:${finding.id}`] = state.currentLevel;
    state.flags.findingsRevealed = true;
    game.gainResource('insight', finding.insight ?? 0);
    if (finding.id === 'dictionary') game.gainResource('data', 150 * 1024);
    for (let index = 0; index < (finding.levels ?? 0); index++) solveLevel(game, 'windfall');
    game.invalidateStats();
    game.announce({ type: 'findingDiscovered', findingId: finding.id, count: state.findings[finding.id]! });
}

export const findingDrops: GameSystem = {
    update(game, deltaSeconds) {
        if (!game.state.flags.automated || answeredRate(game) === 0) return;
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

const fileDate = '2006-03-14 02:11';

export function findingFile(finding: Finding, state: GameState): string {
    const texts: Readonly<Record<FindingId, { readonly file: string; readonly entry?: string }>> = findingText;
    const { file, entry = '' } = texts[finding.id];
    const level = state.statistics[`foundAtLevel:${finding.id}`] ?? state.currentLevel;
    const following = Array.from({ length: finding.levels ?? 0 }, (_, index) => level + 1 + index);
    const pageName = (target: number): string => new URL(urlOfLevel(target)).pathname;
    const size = (target: number): string => String(900 + target * 37 % 3100).padStart(9);
    const entries = finding.id === 'dictionary'
        ? Array.from({ length: 12 }, (_, index) => fill(entry, { word: wordAtRank(300 + index * 7) }))
        : following.map((target) => fill(entry, {
            url: urlOfLevel(target), level: target, size: size(target), date: fileDate,
            name: finding.id === 'cache' ? pageName(target).slice(1).padEnd(24) : pageName(target).slice(1),
        }));
    return fill(file, { entries: entries.join('\n') });
}
