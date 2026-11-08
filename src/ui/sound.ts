import type { Game } from '../core/game.ts';

export function startSound(game: Game): void {
    let context: AudioContext | undefined;
    let lastSound = 0;
    document.addEventListener('pointerdown', () => {
        context ??= new AudioContext();
        void context.resume();
    });
    game.subscribe((event) => {
        if (!context || context.state !== 'running' || !game.state.settings.sound || game.isCatchingUp) return;
        const frequency = event.type === 'findingDiscovered' ? 880 : event.type === 'banned' ? 140 : event.type === 'levelSolved' ? 520 : 0;
        if (!frequency || context.currentTime - lastSound < 0.2) return;
        lastSound = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.025, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.1);
    });
}
