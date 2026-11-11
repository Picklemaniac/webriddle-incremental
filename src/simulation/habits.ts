import type { Action } from '../core/actions.ts';
import type { Game } from '../core/game.ts';
import type { Strategy } from './strategies.ts';

export interface Habits {
    readonly solvesByHand?: boolean;
    readonly captchaSeconds?: number | null;
    readonly replacesProxies?: boolean;
    readonly assignsScripts?: boolean;
    readonly rentedShare?: number;
    readonly rentEverySeconds?: number;
}

const handSolveActions: ReadonlySet<Action['type']> = new Set(['navigate', 'submitCredentials']);
const robotCaptchaSeconds = 12;

// A player who skips parts of the game: the robot decides, and the habits drop or replace some of its actions.
export function withHabits(strategy: Strategy, habits: Habits): Strategy {
    let robotView: Game | undefined;
    let captchaSince: number | undefined;
    let rentMovedAt = Number.NEGATIVE_INFINITY;
    const allows = (action: Action, game: Game): boolean => {
        if (action.type === 'answerCaptcha') return false;
        if (handSolveActions.has(action.type) && game.state.flags.automated === true && habits.solvesByHand === false) return false;
        if (action.type === 'replaceProxy' && habits.replacesProxies === false) return false;
        if (action.type === 'assignJob' && habits.assignsScripts === false) return false;
        if (action.type === 'setRentedAddresses') {
            if (habits.rentedShare !== undefined || game.state.elapsedSeconds - rentMovedAt < (habits.rentEverySeconds ?? 0)) return false;
            rentMovedAt = game.state.elapsedSeconds;
        }
        return true;
    };
    return {
        decisionIntervalSeconds: strategy.decisionIntervalSeconds,
        act(game) {
            // The robot stops everything while a captcha is up. A person can still buy and assign, so the captcha is answered here and hidden from the robot.
            robotView ??= new Proxy(game, {
                get(target, key) {
                    if (key === 'dispatch') return (action: Action) => allows(action, target) && target.dispatch(action);
                    if (key === 'state') return new Proxy(target.state, { get: (state, field) => (field === 'captcha' ? null : Reflect.get(state, field)) });
                    const value: unknown = Reflect.get(target, key);
                    return typeof value === 'function' ? value.bind(target) : value;
                },
            });
            const { state } = game;
            let acted = false;
            if (state.captcha !== null && habits.captchaSeconds !== null) {
                captchaSince ??= state.elapsedSeconds;
                if (state.elapsedSeconds - captchaSince >= (habits.captchaSeconds ?? robotCaptchaSeconds)) {
                    captchaSince = undefined;
                    acted = game.dispatch({ type: 'answerCaptcha', answer: state.captcha.word });
                }
            }
            acted = strategy.act(robotView) || acted;
            if (habits.rentedShare !== undefined) {
                acted = game.dispatch({ type: 'setRentedAddresses', count: Math.round(game.stat('rentableAddresses') * habits.rentedShare) }) || acted;
            }
            return acted;
        },
    };
}
