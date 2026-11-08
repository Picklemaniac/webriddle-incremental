const glyphs: Readonly<Record<string, string>> = {
    a: '0e 11 11 1f 11 11 11', b: '1e 11 11 1e 11 11 1e', c: '0e 11 10 10 10 11 0e', d: '1e 11 11 11 11 11 1e',
    e: '1f 10 10 1e 10 10 1f', f: '1f 10 10 1e 10 10 10', g: '0e 11 10 17 11 11 0f', h: '11 11 11 1f 11 11 11',
    i: '0e 04 04 04 04 04 0e', j: '07 02 02 02 02 12 0c', k: '11 12 14 18 14 12 11', l: '10 10 10 10 10 10 1f',
    m: '11 1b 15 15 11 11 11', n: '11 11 19 15 13 11 11', o: '0e 11 11 11 11 11 0e', p: '1e 11 11 1e 10 10 10',
    q: '0e 11 11 11 15 12 0d', r: '1e 11 11 1e 14 12 11', s: '0f 10 10 0e 01 01 1e', t: '1f 04 04 04 04 04 04',
    u: '11 11 11 11 11 11 0e', v: '11 11 11 11 11 0a 04', w: '11 11 11 15 15 15 0a', x: '11 11 0a 04 0a 11 11',
    y: '11 11 0a 04 04 04 04', z: '1f 01 02 04 08 10 1f', 0: '0e 11 13 15 19 11 0e', 1: '04 0c 04 04 04 04 0e',
    2: '0e 11 01 02 04 08 1f', 3: '1e 01 01 0e 01 01 1e', 4: '02 06 0a 12 1f 02 02', 5: '1f 10 1e 01 01 11 0e',
    6: '0e 10 10 1e 11 11 0e', 7: '1f 01 02 04 08 08 08', 8: '0e 11 11 0e 11 11 0e', 9: '0e 11 11 0f 01 01 0e',
};

const scale = 4;

export function giftImage(word: string): string {
    const textWidth = word.length * 6 - 1;
    const tagWidth = textWidth + 8;
    const width = 44 + tagWidth;
    const height = 40;
    const box = (x: number, y: number, boxWidth: number, boxHeight: number, color: string): string =>
        `<rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" fill="${color}"/>`;
    const shapes = [
        box(0, 0, width, height, '#101018'),
        box(4, 18, 28, 20, '#d81b30'), box(2, 12, 32, 6, '#a3101f'),
        box(16, 12, 4, 26, '#ffd23f'), box(4, 26, 28, 3, '#ffd23f'),
        box(11, 6, 5, 2, '#ffd23f'), box(10, 8, 2, 3, '#ffd23f'), box(12, 10, 5, 2, '#ffd23f'),
        box(20, 6, 5, 2, '#ffd23f'), box(24, 8, 2, 3, '#ffd23f'), box(19, 10, 5, 2, '#ffd23f'),
        box(16, 9, 4, 3, '#e0a800'),
        box(34, 14, 6, 1, '#c8c8c8'),
        box(40, 9, tagWidth, 13, '#6b4f1d'), box(41, 10, tagWidth - 2, 11, '#fff3c4'),
        ...pixelText(word, 44, 12, '#1a1a1a'),
    ];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${shapes.join('')}</svg>`;
    return `<img src="data:image/svg+xml,${encodeURIComponent(svg)}" width="${width * scale}" height="${height * scale}" alt="">`;
}

function pixelText(text: string, left: number, top: number, color: string): string[] {
    return [...text.toLowerCase()].flatMap((character, index) => {
        const rows = (glyphs[character] ?? '00 00 00 00 00 00 00').split(' ').map((row) => Number.parseInt(row, 16));
        return rows.flatMap((row, y) => Array.from({ length: 5 }, (_, x) => x)
            .filter((x) => (row >> (4 - x)) & 1)
            .map((x) => `<rect x="${left + index * 6 + x}" y="${top + y}" width="1" height="1" fill="${color}"/>`));
    });
}
