/**
 * A tiny sound synthesizer: every Horders sound effect is a short recipe of
 * layered voices, rendered once into a sample buffer and then replayed. No
 * audio files ship with the game, so the sounds cost a few kilobytes of code.
 *
 * This module is pure (no WebAudio) so tests can render and check every sound.
 * The recipes and the code are original to Horders.
 */

export type Wave = 'sine' | 'tri' | 'saw' | 'square' | 'noise';

/** One layer of a sound. Times are in seconds, frequencies in hertz. */
export interface Voice {
  wave: Wave;
  /** Start pitch. For noise it is ignored (use lp/lp2 to shape it). */
  f: number;
  /** End pitch; the pitch glides exponentially from f to f2 over the voice. */
  f2?: number;
  dur: number;
  /** Starts this long after the sound starts. */
  delay?: number;
  /** Attack time (default 4 ms). */
  a?: number;
  /** Peak loudness, 0 to 1 (default 0.5). */
  vol?: number;
  /** Decay shape: 1 is linear, higher fades faster after the attack (default 2). */
  curve?: number;
  /** One-pole low-pass cutoff at the start and end of the voice. */
  lp?: number;
  lp2?: number;
  /** Removes the low end: a one-pole high-pass cutoff. */
  hp?: number;
  /** Vibrato: [rate in Hz, depth as a fraction of the pitch]. */
  vib?: [number, number];
  /** Tremolo: [rate in Hz, depth 0 to 1]. */
  trem?: [number, number];
}

export type Recipe = Voice[];

const TAU = Math.PI * 2;

/** Small deterministic noise source so renders are repeatable. */
function noiseGen(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

function osc(wave: Wave, phase: number, noise: () => number): number {
  const p = phase - Math.floor(phase);
  switch (wave) {
    case 'sine': return Math.sin(p * TAU);
    case 'tri': return 1 - 4 * Math.abs(p - 0.5);
    case 'saw': return 2 * p - 1;
    case 'square': return p < 0.5 ? 1 : -1;
    case 'noise': return noise();
  }
}

/** Seconds from the start of the sound to the end of its last voice. */
export function recipeLength(r: Recipe): number {
  return r.reduce((m, v) => Math.max(m, (v.delay ?? 0) + v.dur), 0);
}

/** Renders a recipe to mono samples in -1..1 at the given sample rate. */
export function render(r: Recipe, rate: number, seed = 1): Float32Array {
  const total = Math.ceil(recipeLength(r) * rate) + 1;
  const out = new Float32Array(total);
  r.forEach((v, k) => {
    const noise = noiseGen(seed * 7919 + k * 104729);
    const start = Math.floor((v.delay ?? 0) * rate);
    const n = Math.max(1, Math.floor(v.dur * rate));
    const a = Math.max(1, Math.floor((v.a ?? 0.004) * rate));
    const vol = v.vol ?? 0.5;
    const curve = v.curve ?? 2;
    const f2 = v.f2 ?? v.f;
    let phase = 0;
    let low = 0;
    let hpIn = 0;
    let hpOut = 0;
    // Glides are exponential, so step them by a constant ratio per sample.
    let freq = v.f;
    const fStep = Math.pow(f2 / v.f, 1 / n);
    let cut = v.lp ?? 0;
    const cutStep = v.lp ? Math.pow((v.lp2 ?? v.lp) / v.lp, 1 / n) : 1;
    let k1 = 1;
    const k2 = v.hp ? Math.exp((-TAU * v.hp) / rate) : 0;
    // Envelope, vibrato and tremolo change slowly: refresh them every 8 samples
    // (a quarter of a millisecond), which keeps renders cheap on slow phones.
    let env = 0;
    let vibMul = 1;
    let tremMul = 1;
    for (let i = 0; i < n && start + i < total; i++) {
      if ((i & 7) === 0) {
        const sec = i / rate;
        env = (i < a ? i / a : Math.pow(1 - (i - a) / Math.max(1, n - a), curve)) * vol;
        if (v.vib) vibMul = 1 + Math.sin(sec * TAU * v.vib[0]) * v.vib[1];
        if (v.trem) tremMul = 1 - v.trem[1] * (0.5 + 0.5 * Math.sin(sec * TAU * v.trem[0]));
      }
      phase += (freq * vibMul) / rate;
      freq *= fStep;
      let s = osc(v.wave, phase, noise);
      if (v.lp) {
        // The filter coefficient only needs refreshing every few samples.
        if ((i & 15) === 0) k1 = 1 - Math.exp((-TAU * cut) / rate);
        cut *= cutStep;
        low += (s - low) * k1;
        s = low;
      }
      if (v.hp) {
        hpOut = k2 * (hpOut + s - hpIn);
        hpIn = s;
        s = hpOut;
      }
      out[start + i] += s * env * tremMul;
    }
  });
  // Gentle saturation keeps stacked layers from clipping harshly.
  for (let i = 0; i < total; i++) out[i] = softClip(out[i]);
  return out;
}

/** A cheap tanh-like curve: near-linear for quiet samples, never past ±1. */
function softClip(x: number): number {
  if (x >= 3) return 1;
  if (x <= -3) return -1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}

/** Equal-tempered pitch: semitones from A4 (440 Hz). */
export const note = (semis: number) => 440 * Math.pow(2, semis / 12);
