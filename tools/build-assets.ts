import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import sharp from 'sharp';
import { folderNames, handcraftedAnswerWords, subjects } from '../src/content/act-one/word-lists.ts';
import { inRows, readArgument } from './shared.ts';

const wordsPerLine = 12;

const require = createRequire(import.meta.url);
const englishWords = new Set<string>(require('an-array-of-english-words'));

const defaultSourceDirectory = "D:/Projects/Regular Projects/02-02-2025 - Pickle's Tricky Riddle/wallpaper-wide-scraper";
const imageOutputDirectory = 'public/levels';
const generatedDirectory = 'src/content/act-one/generated';
const imageWidth = 220;
const imageHeight = 147;
const imageQuality = 72;
const imagesPerSubject = 8;
const minimumImagesPerSubject = 4;
const totalImages = 480;
const handcraftedAnswerRanks = [40, 75, 110, 145, 180, 215, 250];
const firstFolderRank = 220;
const folderRankSpacing = 30;

const ignoredWords = new Set([
    'the', 'and', 'with', 'from', 'for', 'over', 'under', 'into', 'near', 'its', 'your', 'our', 'his', 'her', 'their',
    'del', 'des', 'les', 'van', 'von', 'der', 'den', 'das', 'die', 'los', 'las', 'une', 'por', 'sol',
    'hdr', 'uhd', 'wallpaper', 'wallpapers', 'background', 'backgrounds', 'desktop', 'image', 'images', 'photo',
    'photos', 'photography', 'picture', 'pictures', 'beautiful', 'amazing', 'awesome', 'gorgeous', 'stunning',
    'lovely', 'pretty', 'cute', 'nice', 'cool', 'best', 'free', 'widescreen', 'wide', 'version', 'edition',
    'naked', 'bloody', 'blood', 'kill', 'dead', 'macro', 'not', 'one', 'most', 'here', 'yet', 'will', 'wow',
    'rape', 'dick', 'pussy', 'whitey', 'jesus', 'fistula', 'wast', 'flied', 'dof', 'ios', 'ama', 'aka', 'nam',
    'lat', 'mol', 'mor', 'sur', 'tam', 'para', 'pont', 'sant', 'gama', 'chica', 'delice', 'barrio', 'basta',
    'saxe', 'sonne', 'hiver', 'garni', 'lune', 'rep', 'pix', 'poison', 'poisonous', 'convict', 'armed', 'butcher',
]);

interface Wallpaper {
    readonly slug: string;
    readonly file: string;
    readonly words: readonly string[];
}

interface SelectedImage {
    readonly wallpaper: Wallpaper;
    readonly subject: string | null;
}

const sourceDirectory = readArgument('--source') ?? defaultSourceDirectory;
const wallpapers = await readWallpapers(sourceDirectory);
const vocabulary = buildVocabulary(wallpapers);
const selectedImages = selectImages(wallpapers);

await rm(imageOutputDirectory, { recursive: true, force: true });
await mkdir(imageOutputDirectory, { recursive: true });
for (const [index, image] of selectedImages.entries()) {
    await sharp(path.join(sourceDirectory, 'wallpapers', image.wallpaper.file))
        .resize(imageWidth, imageHeight, { fit: 'cover' })
        .jpeg({ quality: imageQuality, mozjpeg: true })
        .toFile(path.join(imageOutputDirectory, `${index}.jpg`));
}

await mkdir(generatedDirectory, { recursive: true });
await writeFile(path.join(generatedDirectory, 'vocabulary.ts'), vocabularyModule(vocabulary));
await writeFile(path.join(generatedDirectory, 'level-images.ts'), levelImagesModule(selectedImages));

const subjectCounts = new Map<string, number>();
for (const image of selectedImages) {
    if (image.subject !== null) {
        subjectCounts.set(image.subject, (subjectCounts.get(image.subject) ?? 0) + 1);
    }
}
console.log(`${wallpapers.length} labelled wallpapers, ${vocabulary.length} vocabulary words, ${selectedImages.length} images.`);
console.log(`Subjects: ${[...subjectCounts].map(([subject, count]) => `${subject} ${count}`).join(', ')}`);
console.log(`Top words: ${vocabulary.slice(0, 40).join(', ')}`);

async function readWallpapers(directory: string): Promise<Wallpaper[]> {
    const csv = await readFile(path.join(directory, 'wallpapers.csv'), 'utf8');
    const availableFiles = new Set(await readdir(path.join(directory, 'wallpapers')));
    const seenSlugs = new Set<string>();
    const result: Wallpaper[] = [];
    for (const line of csv.split(/\r?\n/)) {
        const cells = line.split(',');
        const detailUrl = cells.find((cell) => cell.endsWith('-wallpapers.html'));
        const file = cells.find((cell) => /^\d{6}\.jpg$/.test(cell));
        if (detailUrl === undefined || file === undefined || !availableFiles.has(file)) {
            continue;
        }
        const slug = detailUrl.slice(detailUrl.lastIndexOf('/') + 1, -'-wallpapers.html'.length);
        if (!seenSlugs.has(slug)) {
            seenSlugs.add(slug);
            result.push({ slug, file, words: slug.split(/[_-]+/).map((part) => part.toLowerCase()).filter(isUsableWord) });
        }
    }
    return result.sort((first, second) => first.file.localeCompare(second.file));
}

function isUsableWord(word: string): boolean {
    return /^[a-z]{3,12}$/.test(word) && !ignoredWords.has(word);
}

function subjectOf(word: string): string | null {
    for (const { word: subject } of subjects) {
        const pluralForms = [`${subject}s`, `${subject}es`, subject.endsWith('y') ? `${subject.slice(0, -1)}ies` : null];
        if (word === subject || pluralForms.includes(word)) {
            return subject;
        }
    }
    return null;
}

function buildVocabulary(source: readonly Wallpaper[]): string[] {
    const counts = new Map<string, number>();
    for (const wallpaper of source) {
        for (const word of new Set(wallpaper.words.filter((candidate) => englishWords.has(candidate)))) {
            counts.set(word, (counts.get(word) ?? 0) + 1);
        }
    }
    for (const { word } of subjects) {
        counts.set(word, Math.max(counts.get(word) ?? 0, 1));
    }
    const forcedRanks = new Map<string, number>([
        ...handcraftedAnswerWords.map((word, index): [string, number] => [word, handcraftedAnswerRanks[index] ?? 250]),
        ...folderNames.map((word, index): [string, number] => [word, firstFolderRank + index * folderRankSpacing]),
    ]);
    const ranked = [...counts]
        .filter(([word]) => !forcedRanks.has(word))
        .sort(([firstWord, firstCount], [secondWord, secondCount]) => secondCount - firstCount || firstWord.localeCompare(secondWord))
        .map(([word]) => word);
    for (const [word, rank] of [...forcedRanks].sort(([, first], [, second]) => first - second)) {
        ranked.splice(Math.min(rank, ranked.length), 0, word);
    }
    return ranked;
}

function selectImages(source: readonly Wallpaper[]): SelectedImage[] {
    const bySubject = new Map<string, Wallpaper[]>();
    const unsubjected: Wallpaper[] = [];
    for (const wallpaper of source) {
        const matched = new Set(wallpaper.words.map(subjectOf).filter((subject) => subject !== null));
        const [onlySubject] = matched;
        if (matched.size === 1 && onlySubject !== undefined) {
            bySubject.set(onlySubject, [...(bySubject.get(onlySubject) ?? []), wallpaper]);
        } else if (matched.size === 0) {
            unsubjected.push(wallpaper);
        }
    }
    const selected: SelectedImage[] = [];
    for (const [subject, candidates] of bySubject) {
        if (candidates.length >= minimumImagesPerSubject) {
            selected.push(...spread(candidates, imagesPerSubject).map((wallpaper) => ({ wallpaper, subject })));
        }
    }
    selected.push(...spread(unsubjected, totalImages - selected.length).map((wallpaper) => ({ wallpaper, subject: null })));
    return selected.sort((first, second) => first.wallpaper.file.localeCompare(second.wallpaper.file));
}

function spread<Item>(items: readonly Item[], count: number): Item[] {
    if (items.length <= count) {
        return [...items];
    }
    return Array.from({ length: count }, (_, index) => items[Math.floor((index * items.length) / count)] as Item);
}

function vocabularyModule(words: readonly string[]): string {
    const lines = inRows(words, wordsPerLine).map((row) => `    ${row.map((word) => `'${word}'`).join(', ')},`);
    return [
        '// Generated by tools/build-assets.ts from the wallpaper labels, most frequent first. Do not edit by hand.',
        'export const vocabulary: readonly string[] = [',
        ...lines,
        '];',
        '',
    ].join('\n');
}

function levelImagesModule(images: readonly SelectedImage[]): string {
    const entries = images.map(({ wallpaper, subject }) => {
        const words = wallpaper.words.map((word) => `'${word}'`).join(', ');
        return `    { subject: ${subject === null ? 'null' : `'${subject}'`}, words: [${words}] },`;
    });
    return [
        '// Generated by tools/build-assets.ts. Entry n describes public/levels/n.jpg. Do not edit by hand.',
        'export interface LevelImageData {',
        '    readonly subject: string | null;',
        '    readonly words: readonly string[];',
        '}',
        '',
        'export const levelImages: readonly LevelImageData[] = [',
        ...entries,
        '];',
        '',
    ].join('\n');
}
