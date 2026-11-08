import type { Game } from '../../core/game.ts';
import type { CaptchaChallenge } from '../../core/state.ts';
import { increment } from './progress.ts';
import { wordAtRank } from './vocabulary.ts';

const captchaWordRanks = 1500;

export function createCaptcha(game: Game): CaptchaChallenge {
    let word = wordAtRank(1 + Math.floor(game.random() * captchaWordRanks));
    while (word.length < 4 || word.length > 7) word = wordAtRank(1 + Math.floor(game.random() * captchaWordRanks));
    return { word };
}

export function answerCaptcha(game: Game, answer: string): boolean {
    const challenge = game.state.captcha;
    if (challenge === null) return false;
    const typed = answer.trim().toLowerCase();
    if (typed !== challenge.word) {
        game.state.captcha = createCaptcha(game);
        game.state.flags.captchaRejected = typed !== '';
        if (typed !== '') game.announce({ type: 'captchaFailed' });
        return true;
    }
    game.state.network.bannedUntil = 0;
    game.state.network.heat = 0;
    game.state.captcha = null;
    game.state.flags.captchaRejected = false;
    increment(game.state, 'captchasSolved');
    game.announce({ type: 'unbanned', byCaptcha: true });
    return true;
}
