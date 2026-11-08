import type { Game } from '../core/game.ts';
import type { Strategy } from './strategies.ts';

export class AutoPlayer {
    private readonly strategy: Strategy;
    private secondsUntilDecision = 0;
    private lastDecisionActed = false;

    constructor(strategy: Strategy) {
        this.strategy = strategy;
    }

    get hadNothingToDo(): boolean {
        return !this.lastDecisionActed;
    }

    playStep(game: Game, stepSeconds: number): void {
        if (this.secondsUntilDecision <= 0) {
            this.lastDecisionActed = this.strategy.act(game);
            this.secondsUntilDecision = this.strategy.decisionIntervalSeconds;
        }
        game.advance(stepSeconds);
        this.secondsUntilDecision -= stepSeconds;
    }

    playUntil(game: Game, isDone: () => boolean, maximumSeconds: number, stepSeconds = 1): number {
        let playedSeconds = 0;
        while (!isDone() && playedSeconds < maximumSeconds) {
            this.playStep(game, stepSeconds);
            playedSeconds += stepSeconds;
        }
        return playedSeconds;
    }
}
