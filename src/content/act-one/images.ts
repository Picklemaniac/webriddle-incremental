import { levelImages } from './generated/level-images.ts';
import { pickByUnit } from './riddle.ts';
import { subjects, type Subject } from './word-lists.ts';

export const levelImageCount = levelImages.length;

const imageIdsBySubject = new Map<string, number[]>();
for (const [imageId, image] of levelImages.entries()) {
    if (image.subject !== null) {
        imageIdsBySubject.set(image.subject, [...(imageIdsBySubject.get(image.subject) ?? []), imageId]);
    }
}

export const pictureSubjects: readonly Subject[] = subjects.filter((subject) => imageIdsBySubject.has(subject.word));

export function imagePath(imageId: number): string {
    return `/levels/${imageId}.jpg`;
}

export function imageForUnit(unit: number): number {
    return Math.floor(unit * levelImageCount) % levelImageCount;
}

export function imageForSubject(subject: string, unit: number): number {
    return pickByUnit(imageIdsBySubject.get(subject) ?? [0], unit);
}

export function imageWithWord(word: string): number {
    const imageId = levelImages.findIndex((image) => image.words.includes(word));
    return imageId === -1 ? 0 : imageId;
}

export function imageIdsWithSubject(subject: string): readonly number[] {
    return imageIdsBySubject.get(subject) ?? [];
}

export function imageShowsSubject(imageId: number, subject: string): boolean {
    const image = levelImages[imageId];
    return image !== undefined && (image.subject === subject || image.words.some((word) => word.startsWith(subject)));
}
