import type { Game } from '../../core/game.ts';
import type { CaptchaChallenge } from '../../core/state.ts';
import { imageIdsWithSubject, imageShowsSubject, levelImageCount, pictureSubjects } from './images.ts';
import { increment } from './progress.ts';
import { sampleWord } from './vocabulary.ts';

export function createCaptcha(game: Game): CaptchaChallenge {
    const subject = pictureSubjects[Math.floor(game.random() * pictureSubjects.length)]?.word ?? 'bridge';
    const positive = imageIdsWithSubject(subject);
    const imageIds = Array.from({ length: 9 }, (_, index) => index < 3
        ? positive[Math.floor(game.random() * positive.length)] ?? 0
        : Math.floor(game.random() * levelImageCount));
    for (let index = imageIds.length - 1; index > 0; index--) {
        const other = Math.floor(game.random() * (index + 1));
        [imageIds[index], imageIds[other]] = [imageIds[other]!, imageIds[index]!];
    }
    return {
        kind: game.random() < 0.65 ? 'images' : 'text', stage: 'checkbox', subject, imageIds,
        correctTiles: imageIds.flatMap((id, index) => imageShowsSubject(id, subject) ? [index] : []),
        word: sampleWord(game.random()),
    };
}

export function answerCaptcha(game: Game, answer: string): boolean {
    const challenge = game.state.captcha;
    if (challenge === null) return false;
    if (challenge.stage === 'checkbox') {
        challenge.stage = 'challenge';
        return true;
    }
    const correct = challenge.kind === 'text'
        ? answer.trim().toLowerCase() === challenge.word
        : [...new Set(answer.split(',').filter(Boolean).map(Number))].sort((a, b) => a - b).join(',') === challenge.correctTiles.join(',');
    if (!correct) {
        game.state.flags.captchaRejected = true;
        game.announce({ type: 'captchaFailed' });
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
