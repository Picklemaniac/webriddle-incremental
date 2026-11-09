import { glyphHeight, glyphPixel, glyphWidth } from './drawings.ts';
import { morseCode } from './encodings.ts';

export interface Sound {
    readonly kind: 'morse' | 'tones' | 'spectrogram';
    readonly text: string;
}

const sampleRate = 8000;
const morseUnitSeconds = 0.1;
const toneRows = [697, 770, 852, 941];
const toneColumns = [1209, 1336, 1477];
const keypad = ['123', '456', '789', '*0#'];

const recorders: Readonly<Record<Sound['kind'], (text: string) => number[]>> = { morse, tones, spectrogram };

const recordings = new Map<string, string>();

export function soundData(sound: Sound): string {
    const key = `${sound.kind}:${sound.text}`;
    let data = recordings.get(key);
    if (data === undefined) {
        if (recordings.size > 16) recordings.clear();
        data = wave(recorders[sound.kind](sound.text));
        recordings.set(key, data);
    }
    return data;
}

function morse(text: string): number[] {
    const samples = silence(0.5);
    for (const word of text.split(' ')) {
        for (const character of word) {
            for (const symbol of morseCode(character) ?? '') samples.push(...tone([650], (symbol === '-' ? 3 : 1) * morseUnitSeconds), ...silence(morseUnitSeconds));
            samples.push(...silence(2 * morseUnitSeconds));
        }
        samples.push(...silence(4 * morseUnitSeconds));
    }
    return samples;
}

function tones(digits: string): number[] {
    const samples = silence(0.4);
    for (const digit of digits) {
        const row = keypad.findIndex((keys) => keys.includes(digit));
        if (row === -1) {
            samples.push(...silence(0.4));
            continue;
        }
        samples.push(...tone([toneRows[row]!, toneColumns[keypad[row]!.indexOf(digit)]!], 0.18), ...silence(0.14));
    }
    samples.push(...silence(0.4));
    return samples;
}

function spectrogram(text: string): number[] {
    const samples = silence(0.4);
    for (const character of text) {
        for (let x = 0; x <= glyphWidth; x++) {
            const frequencies = Array.from({ length: glyphHeight }, (_, y) => y).flatMap((y) => (x < glyphWidth && glyphPixel(character, x, y) ? [3000 - y * 300] : []));
            samples.push(...(frequencies.length === 0 ? silence(0.12) : tone(frequencies, 0.12)));
        }
    }
    samples.push(...silence(0.4));
    return samples;
}

function tone(frequencies: readonly number[], seconds: number): number[] {
    const length = Math.round(seconds * sampleRate);
    const fade = Math.round(0.005 * sampleRate);
    return Array.from({ length }, (_, index) => {
        const envelope = Math.min(1, index / fade, (length - index) / fade);
        const value = frequencies.reduce((sum, frequency) => sum + Math.sin(2 * Math.PI * frequency * index / sampleRate), 0) / frequencies.length;
        return 0.6 * envelope * value;
    });
}

function silence(seconds: number): number[] {
    return new Array<number>(Math.round(seconds * sampleRate)).fill(0);
}

function wave(samples: readonly number[]): string {
    const bytes = new Uint8Array(44 + samples.length);
    const view = new DataView(bytes.buffer);
    const text = (offset: number, value: string): void => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
    text(0, 'RIFF');
    view.setUint32(4, 36 + samples.length, true);
    text(8, 'WAVEfmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    text(36, 'data');
    view.setUint32(40, samples.length, true);
    samples.forEach((sample, index) => { bytes[44 + index] = Math.round(128 + 127 * sample); });
    let binary = '';
    for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    return `data:audio/wav;base64,${btoa(binary)}`;
}
