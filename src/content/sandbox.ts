import type { GameContent, GameSystem, MilestoneDefinition, Page } from '../core/content.ts';
import type { GameState } from '../core/state.ts';

const riddleOrigin = 'http://riddle.example';
const levelPathPattern = /^\/level(\d+)\.htm$/;
const points = 'points';
const solvingPower = 'solvingPower';

function levelUrl(level: number): string {
    return `${riddleOrigin}/level${level}.htm`;
}

function levelFromUrl(url: string): number | undefined {
    if (!URL.canParse(url)) {
        return undefined;
    }
    const parsedUrl = new URL(url);
    const match = levelPathPattern.exec(parsedUrl.pathname);
    if (parsedUrl.origin !== riddleOrigin || match?.[1] === undefined) {
        return undefined;
    }
    return Number(match[1]);
}

function workForLevel(level: number): number {
    return 10 * 1.08 ** (level - 1);
}

const levelSolving: GameSystem = {
    update(game, deltaSeconds) {
        const state = game.state;
        let work = game.stat(solvingPower) * deltaSeconds;
        game.gainResource(points, work);
        while (work > 0) {
            const levelWork = workForLevel(state.currentLevel);
            const remainingWork = levelWork * (1 - state.levelProgress);
            if (work < remainingWork) {
                state.levelProgress += work / levelWork;
                return;
            }
            work -= remainingWork;
            state.currentLevel += 1;
            state.levelProgress = 0;
        }
    },
};

function levelColor(level: number): string {
    return `#${(level % 0x1_000_000).toString(16).padStart(6, '0')}`;
}

function levelPage(level: number): Page {
    const html = `<!doctype html>
<html lang="en">
<head>
<title>Level ${level}</title>
<style>
body { margin: 0; height: 100vh; display: grid; place-content: center; gap: 16px; text-align: center; font-family: Georgia, serif; color: #fff; text-shadow: 0 0 4px #000; background: ${levelColor(level)}; }
.image { width: 480px; height: 320px; border: 1px solid #fff; }
</style>
</head>
<body>
<div class="image"></div>
<p>level ${level}</p>
<!-- sandbox placeholder -->
</body>
</html>
`;
    return { statusCode: 200, title: `Level ${level}`, html, source: html };
}

const notFoundHtml = `<!doctype html>
<html lang="en">
<head><title>404 Not Found</title></head>
<body>
<h1>Not Found</h1>
<p>The requested URL was not found on this server.</p>
</body>
</html>
`;

const notFoundPage: Page = { statusCode: 404, title: '404 Not Found', html: notFoundHtml, source: notFoundHtml };

function levelMilestone(level: number): MilestoneDefinition {
    return {
        id: `level${level}`,
        name: `Level ${level}`,
        isReached: (state: GameState) => state.currentLevel >= level,
    };
}

export const sandboxContent: GameContent = {
    startUrl: levelUrl(1),
    resources: [{ id: points, name: 'Points' }],
    baseStats: { [solvingPower]: 1 },
    purchasables: [
        {
            id: 'script',
            name: 'Script',
            description: 'One more script.',
            cost: (ownedCount) => ({ [points]: Math.ceil(10 * 1.15 ** ownedCount) }),
            isAvailable: () => true,
            modifiers: (ownedCount) => [{ statId: solvingPower, operation: 'add', value: ownedCount }],
        },
        {
            id: 'fasterScripts',
            name: 'Faster scripts',
            description: 'Doubles solving power.',
            maximumCount: 1,
            cost: () => ({ [points]: 250 }),
            isAvailable: (state) => state.currentLevel >= 10,
            modifiers: () => [{ statId: solvingPower, operation: 'multiply', value: 2 }],
        },
        {
            id: 'parallelScripts',
            name: 'Parallel scripts',
            description: 'Triples solving power.',
            maximumCount: 1,
            cost: () => ({ [points]: 5_000 }),
            isAvailable: (state) => state.currentLevel >= 30,
            modifiers: () => [{ statId: solvingPower, operation: 'multiply', value: 3 }],
        },
    ],
    milestones: [10, 25, 50, 75, 100].map(levelMilestone),
    systems: [levelSolving],
    resolvePage(url, state) {
        const level = levelFromUrl(url);
        return level !== undefined && level <= state.currentLevel ? levelPage(level) : notFoundPage;
    },
    handleNavigation(game, url) {
        if (levelFromUrl(url) === game.state.currentLevel + 1) {
            game.state.currentLevel += 1;
            game.state.levelProgress = 0;
        }
    },
    handleAction: () => false,
    offlineCapSeconds: () => 12 * 3_600,
};
