// Synthesised sound effects only: no audio files, no network. A tiny WebAudio helper that
// plays a short oscillator blip (optionally sliding in pitch) with a gain envelope. The
// context is created on the first user gesture, so browsers never autoplay sound.
export function createAudio() {
  let context = null;
  let muted = false;
  function ensure() {
    if (context !== null) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }
  function tone(freq, endFreq, seconds, type, volume) {
    if (muted) return;
    const ctx = ensure();
    if (ctx === null || ctx.state === 'suspended') return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + seconds);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + seconds + 0.02);
    } catch {
      // Sound is garnish: a failure here must never break the game.
    }
  }
  return {
    unlock() { const ctx = ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    shoot() { tone(720, 340, 0.07, 'square', 0.045); },
    pop() { tone(300, 90, 0.12, 'triangle', 0.09); },
    ember() { tone(880, 1320, 0.1, 'sine', 0.07); },
    hurt() { tone(180, 70, 0.25, 'sawtooth', 0.1); },
    latch() { tone(520, 420, 0.15, 'sawtooth', 0.06); },
    wave() { tone(392, 587, 0.3, 'triangle', 0.09); },
    bless() { tone(523, 784, 0.22, 'sine', 0.08); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, f, 0.28, 'triangle', 0.09), i * 130)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, f * 0.9, 0.3, 'triangle', 0.08), i * 150)); },
  };
}
