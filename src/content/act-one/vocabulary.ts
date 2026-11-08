import { vocabulary } from './generated/vocabulary.ts';

export const vocabularySize = vocabulary.length;

const ranksByWord = new Map(vocabulary.map((word, index) => [word, index + 1]));

export function wordAtRank(rank: number): string {
    const clampedRank = Math.min(vocabularySize, Math.max(1, Math.round(rank)));
    return vocabulary[clampedRank - 1] ?? 'riddle';
}

export function rankOfWord(word: string): number {
    return ranksByWord.get(word) ?? vocabularySize;
}

export function sampleWord(unit: number): string {
    return wordAtRank(1 + Math.floor(unit * vocabularySize));
}
