import type { GameContent } from './content.ts';

interface Proxy {
    address: string;
    latencyMilliseconds: number;
    diesAtSeconds: number;
}

export interface CaptchaChallenge {
    kind: 'images' | 'text';
    stage: 'checkbox' | 'challenge';
    subject: string;
    imageIds: number[];
    correctTiles: number[];
    word: string;
}

interface SearchState {
    level: number;
    requestsSpent: number;
    configuration: string;
}

interface NetworkState {
    heat: number;
    bannedUntil: number;
    proxies: Proxy[];
}

export interface GameState {
    elapsedSeconds: number;
    pendingTickSeconds: number;
    randomState: number;
    currentLevel: number;
    levelProgress: number;
    browserUrl: string;
    resources: Record<string, number>;
    purchases: Record<string, number>;
    reachedMilestones: Record<string, number>;
    flags: Record<string, boolean>;
    statistics: Record<string, number>;
    jobs: Record<string, number>;
    findings: Record<string, number>;
    cooldowns: Record<string, number>;
    search: SearchState;
    network: NetworkState;
    captcha: CaptchaChallenge | null;
    favorites: string[];
    visitedLevels: Record<string, number>;
    settings: { sound: boolean };
}

export function createInitialState(content: GameContent, seed: number): GameState {
    return {
        elapsedSeconds: 0,
        pendingTickSeconds: 0,
        randomState: seed,
        currentLevel: 1,
        levelProgress: 0,
        browserUrl: content.homeUrl,
        resources: Object.fromEntries(content.resources.map((resource) => [resource.id, 0])),
        purchases: {},
        reachedMilestones: {},
        flags: {},
        statistics: {},
        jobs: {},
        findings: {},
        cooldowns: {},
        search: { level: 1, requestsSpent: 0, configuration: '' },
        network: { heat: 0, bannedUntil: 0, proxies: [] },
        captcha: null,
        favorites: [],
        visitedLevels: { [content.startUrl]: 1 },
        settings: { sound: true },
    };
}
