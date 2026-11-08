import { levelImages } from './generated/level-images.ts';

export const levelImageCount = levelImages.length;

export function imagePath(imageId: number): string {
    return `levels/${imageId}.jpg`;
}

export function imageWithWord(word: string): number {
    const imageId = levelImages.findIndex((image) => image.words.includes(word));
    return imageId === -1 ? 0 : imageId;
}
