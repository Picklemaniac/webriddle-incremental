import type { Action } from './actions.ts';
import type { OfflineSummary } from './offline.ts';

export type GameEvent =
    | { readonly type: 'actionApplied'; readonly action: Action }
    | { readonly type: 'milestoneReached'; readonly milestoneId: string }
    | { readonly type: 'offlineProgressApplied'; readonly summary: OfflineSummary }
    | { readonly type: 'stateReplaced' };

export type GameEventListener = (event: GameEvent) => void;
