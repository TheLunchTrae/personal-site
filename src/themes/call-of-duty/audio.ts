import { sound } from './settings';

// Every sound in the theme is synthesized here with Web Audio: no recordings,
// no samples. Nothing plays unless the visitor has turned sound on.

interface Voice {
  context: AudioContext;
  out: GainNode;
  /** Removes the listeners that follow the sound switch and the tab's visibility. */
  release: () => void;
}

const voice: { current: Voice | null } = { current: null };

function quietly(action: Promise<void>): void {
  action.then(
    () => undefined,
    () => undefined,
  );
}

function wake(context: AudioContext): void {
  if (context.state === 'suspended' && !document.hidden && sound.snapshot() === 'on') {
    quietly(context.resume());
  }
}

/**
 * Creates or wakes the audio context. Browsers only start audio from a
 * visitor's gesture, so the Sound button and page clicks call this.
 */
export function unlockSound(): void {
  // With sound off, no audio context is opened at all.
  if (typeof AudioContext === 'undefined' || sound.snapshot() !== 'on') {
    return;
  }
  if (voice.current === null) {
    const context = new AudioContext();
    const out = context.createGain();
    out.gain.value = 0.35;
    out.connect(context.destination);
    // Turning sound off releases the audio device until it is turned on again.
    const unsubscribe = sound.subscribe(() => {
      if (sound.snapshot() === 'off') {
        quietly(context.suspend());
      } else {
        wake(context);
      }
    });
    // Nothing plays in a hidden tab.
    const listening = new AbortController();
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) {
          quietly(context.suspend());
        } else {
          wake(context);
        }
      },
      { signal: listening.signal },
    );
    voice.current = {
      context,
      out,
      release: () => {
        unsubscribe();
        listening.abort();
      },
    };
  }
  wake(voice.current.context);
}

/**
 * Closes the audio context and drops its listeners, for when gameplay
 * unmounts. The next unlockSound() builds a fresh one.
 */
export function releaseSound(): void {
  const current = voice.current;
  if (current === null) {
    return;
  }
  voice.current = null;
  current.release();
  quietly(current.context.close());
}

// A sound asked for while the context is still waiting for a gesture is
// dropped, never queued, so nothing piles up and plays at once later.
function ready(): Voice | null {
  if (sound.snapshot() !== 'on' || voice.current?.context.state !== 'running') {
    return null;
  }
  return voice.current;
}

function envelope(gain: GainNode, at: number, peak: number, attack: number, release: number): void {
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
}

/** A short burst of filtered noise, like a set changing channel. */
export function playStatic(): void {
  const v = ready();
  if (v === null) {
    return;
  }
  const { context, out } = v;
  const length = Math.floor(context.sampleRate * 0.18);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  const band = context.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2400;
  band.Q.value = 0.7;
  const gain = context.createGain();
  envelope(gain, context.currentTime, 0.5, 0.005, 0.17);
  source.connect(band).connect(gain).connect(out);
  source.start();
}

/** A dry click for each site the globe turns past. */
export function playTick(): void {
  const v = ready();
  if (v === null) {
    return;
  }
  const { context, out } = v;
  const osc = context.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 1700;
  const gain = context.createGain();
  envelope(gain, context.currentTime, 0.12, 0.002, 0.04);
  osc.connect(gain).connect(out);
  osc.start();
  osc.stop(context.currentTime + 0.06);
}

/** A low falling thud for committing to a page. */
export function playEnter(): void {
  const v = ready();
  if (v === null) {
    return;
  }
  const { context, out } = v;
  const now = context.currentTime;
  const osc = context.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(38, now + 0.45);
  const gain = context.createGain();
  envelope(gain, now, 0.8, 0.01, 0.5);
  osc.connect(gain).connect(out);
  osc.start();
  osc.stop(now + 0.55);
}

/** A slow, dark minor chord that swells when a new round starts. */
export function playRound(): void {
  const v = ready();
  if (v === null) {
    return;
  }
  const { context, out } = v;
  const now = context.currentTime;
  const low = context.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.setValueAtTime(400, now);
  low.frequency.linearRampToValueAtTime(1400, now + 1.2);
  const gain = context.createGain();
  envelope(gain, now, 0.32, 0.6, 1.8);
  low.connect(gain).connect(out);
  for (const [i, frequency] of [98, 116.5, 146.8, 196.4].entries()) {
    const osc = context.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = frequency;
    osc.detune.value = (i - 1.5) * 6;
    osc.connect(low);
    osc.start(now);
    osc.stop(now + 2.6);
  }
}
