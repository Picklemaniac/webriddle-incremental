import type { Action } from './actions.ts';
import type { OfflineSummary } from './offline.ts';

export type SolveMethod = 'script' | 'hand' | 'search' | 'windfall';

export type GameEvent =
    | { readonly type: 'actionApplied'; readonly action: Action }
    | { readonly type: 'milestoneReached'; readonly milestoneId: string }
    | { readonly type: 'offlineProgressApplied'; readonly summary: OfflineSummary }
    | { readonly type: 'stateReplaced' }
    | { readonly type: 'levelSolved'; readonly level: number; readonly method: SolveMethod }
    | { readonly type: 'findingDiscovered'; readonly findingId: string; readonly count: number }
    | { readonly type: 'notice'; readonly noticeId: string }
    | { readonly type: 'banned' }
    | { readonly type: 'unbanned'; readonly byCaptcha: boolean }
    | { readonly type: 'proxyDied' }
    | { readonly type: 'captchaFailed' };

export type GameEventListener = (event: GameEvent) => void;
