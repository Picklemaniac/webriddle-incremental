export type SubjectCategory = 'flower' | 'building' | 'animal' | 'scene';

export interface Subject {
    readonly word: string;
    readonly category: SubjectCategory;
}

export const subjects: readonly Subject[] = [
    { word: 'sunflower', category: 'flower' },
    { word: 'tulip', category: 'flower' },
    { word: 'rose', category: 'flower' },
    { word: 'daisy', category: 'flower' },
    { word: 'poppy', category: 'flower' },
    { word: 'lily', category: 'flower' },
    { word: 'lavender', category: 'flower' },
    { word: 'orchid', category: 'flower' },
    { word: 'lotus', category: 'flower' },
    { word: 'dandelion', category: 'flower' },
    { word: 'magnolia', category: 'flower' },
    { word: 'hibiscus', category: 'flower' },
    { word: 'peony', category: 'flower' },
    { word: 'crocus', category: 'flower' },
    { word: 'iris', category: 'flower' },
    { word: 'lighthouse', category: 'building' },
    { word: 'windmill', category: 'building' },
    { word: 'castle', category: 'building' },
    { word: 'church', category: 'building' },
    { word: 'temple', category: 'building' },
    { word: 'barn', category: 'building' },
    { word: 'cabin', category: 'building' },
    { word: 'cottage', category: 'building' },
    { word: 'pagoda', category: 'building' },
    { word: 'tower', category: 'building' },
    { word: 'swan', category: 'animal' },
    { word: 'horse', category: 'animal' },
    { word: 'deer', category: 'animal' },
    { word: 'owl', category: 'animal' },
    { word: 'eagle', category: 'animal' },
    { word: 'butterfly', category: 'animal' },
    { word: 'fox', category: 'animal' },
    { word: 'waterfall', category: 'scene' },
    { word: 'bridge', category: 'scene' },
    { word: 'pier', category: 'scene' },
    { word: 'boat', category: 'scene' },
    { word: 'volcano', category: 'scene' },
    { word: 'glacier', category: 'scene' },
    { word: 'iceberg', category: 'scene' },
    { word: 'canyon', category: 'scene' },
    { word: 'desert', category: 'scene' },
    { word: 'island', category: 'scene' },
    { word: 'moon', category: 'scene' },
    { word: 'rainbow', category: 'scene' },
    { word: 'aurora', category: 'scene' },
    { word: 'lightning', category: 'scene' },
    { word: 'cave', category: 'scene' },
];

export const folderNames: readonly string[] = [
    'amber', 'basalt', 'cinder', 'delta', 'ember', 'fjord', 'garnet', 'hollow', 'inlet', 'juniper',
    'kelp', 'lagoon', 'marrow', 'nadir', 'onyx', 'prism', 'quarry', 'rift', 'sable', 'tundra',
    'umber', 'vapor', 'willow', 'xenon', 'yarrow', 'zenith',
];

export const handcraftedAnswerWords: readonly string[] = ['beneath', 'lighthouse', 'midnight', 'bridge', 'owl', 'mirror', 'dusk'];
