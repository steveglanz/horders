/**
 * Generative ambient music: each place has a theme (a drone, a slow
 * arpeggio, a texture bed) that plays forever without a loop you can hear.
 * Nothing is recorded; everything is built from oscillators and noise.
 *
 * Themes (all original to Horders):
 *  - hub:       warm hearth, plucked harp-like arpeggio over a soft fire.
 *  - kiln:      Kiln Depths. Low furnace drone, crackling fire, heavy pulse.
 *  - foundry:   Drowned Foundry. Hissing steam swells, water drips, cold minor.
 *  - glarewell: Light and shadow. High bells over a dark drone, shimmer bed.
 *  - hammerdeep: The group dungeon. Bellows breathing, anvil strikes on the beat, a low dorian march.
 *  - pressworks: The second group works. A press cycle in the bed (thud, then steam), struck-plate plucks, a phrygian work song.
 *  - ashvents:   Ysmeret's group dungeon. Two vents breathing in turn, ember plucks, a restless 3-against-2 pulse.
 *  - coldmarrow: Sparse glass bells, wind, a slow heartbeat; the Hearthcoal's crackle is the one warm sound
 *                and thins as the coal dims (see setWarmth).
 *  - wrackline:  A wrecked, sea-dark harbour: a slow aeolian swell, buoy bells, surf breaking on the pilings.
 *  - raid:       Grandmother Slag. A slow, ceremonial 3/4 march: low brass, anvil and bell. Each phase
 *                builds: phase 2 floods in bubbling slag, phase 3 doubles the tempo.
 * A boss fight raises the intensity: a drum pulse and a bass line join in.
 */
import { note } from './synth';

export type ThemeId = 'hub' | 'kiln' | 'foundry' | 'glarewell' | 'hammerdeep' | 'ashvents' | 'coldmarrow' | 'raid' | 'wrackline' | 'hubBellows' | 'hubHearth' | 'pressworks' | 'hubSlag' | 'hubPress' | 'hubEbb' | 'hoard';
export type BedKind = 'hearth' | 'fire' | 'steam' | 'shimmer' | 'forge' | 'frost' | 'vents' | 'slag' | 'surf' | 'press' | 'chew';

export interface Theme {
  /** Root pitch in semitones from A4. */
  root: number;
  /** Scale degrees the melody may use, in semitones above the root. */
  scale: number[];
  /** Chord roots for each two-bar step (semitones above the root). */
  progression: number[];
  bpm: number;
  drone: OscillatorType;
  droneLp: number;
  pluck: 'harp' | 'bell' | 'drip' | 'ember' | 'anvil' | 'glass' | 'brass';
  /** Chance a beat gets a melody note (calm themes leave space). */
  density: number;
  bed: BedKind;
  bedVol: number;
  /** Drone register in semitones from the root (default -12, an octave down). */
  droneAt?: number;
  /** Beats per bar (default 4). The raid marches in 3. */
  meter?: number;
  /** Tempo multiplier by intensity (0 calm, 1 boss, then boss phases 2 and 3). Default [1, 1.25]. */
  phaseTempo?: number[];
  /** A slow lub-dub instead of the drum pulse (the Coldmarrow). */
  heartbeat?: boolean;
  /** Has a Hearthcoal crackle layer whose loudness follows setWarmth. */
  coal?: boolean;
  /** Bed loudness multiplier from boss phase 2 on (the raid's slag floods in). */
  floodBed?: number;
}

export const THEMES: Record<ThemeId, Theme> = {
  hub: { root: -7, scale: [0, 2, 4, 7, 9, 12, 14, 16], progression: [0, 5, -3, 7], bpm: 76, drone: 'triangle', droneLp: 700, pluck: 'harp', density: 0.6, bed: 'hearth', bedVol: 0.3, droneAt: 0 },
  // Season 2, the Deep Bellows: the same hearth harp, a step lower and in mixolydian (the flat 7th darkens it), over the forge's breathing bellows.
  hubBellows: { root: -9, scale: [0, 2, 4, 7, 9, 10, 12, 14], progression: [0, -2, 5, 0], bpm: 72, drone: 'triangle', droneLp: 620, pluck: 'harp', density: 0.55, bed: 'forge', bedVol: 0.26, droneAt: 0 },
  // Season 3, the Cold Hearth: the hearth harp gone cold, in dorian over the Coldmarrow's frost wind, with a Hearthcoal crackle as the one warm sound.
  hubHearth: { root: -3, scale: [0, 2, 3, 7, 9, 12, 14, 15], progression: [0, -4, 3, -2], bpm: 66, drone: 'triangle', droneLp: 650, pluck: 'harp', density: 0.5, bed: 'frost', bedVol: 0.28, coal: true, droneAt: 0 },
  // Season 4, the Slag Moon (the Glarewell in season): the harp turns lydian and starlit over the Glarewell's shimmer.
  hubSlag: { root: -5, scale: [0, 2, 4, 6, 7, 11, 12, 14], progression: [0, 2, -1, 4], bpm: 70, drone: 'triangle', droneLp: 650, pluck: 'harp', density: 0.5, bed: 'shimmer', bedVol: 0.26, droneAt: 0 },
  // Season 5, the Falling Press (the Pressworks): the harp keeps time with a distant press cycle.
  hubPress: { root: -11, scale: [0, 2, 3, 5, 7, 9, 10, 12], progression: [0, -2, 3, -4], bpm: 80, drone: 'triangle', droneLp: 650, pluck: 'harp', density: 0.5, bed: 'press', bedVol: 0.3, droneAt: 0 },
  // Season 6, the Low Ebb (the Wrackline): the harp over a slow harbour surf, in aeolian.
  hubEbb: { root: -9, scale: [0, 2, 3, 5, 7, 8, 10, 12], progression: [0, -4, -2, -5], bpm: 64, drone: 'triangle', droneLp: 650, pluck: 'harp', density: 0.45, bed: 'surf', bedVol: 0.3, droneAt: 0 },
  kiln: { root: -12, scale: [0, 1, 3, 5, 7, 8, 12, 13], progression: [0, 1, 0, -2], bpm: 84, drone: 'sawtooth', droneLp: 380, pluck: 'ember', density: 0.4, bed: 'fire', bedVol: 0.4 },
  foundry: { root: -7, scale: [0, 2, 3, 7, 10, 12, 15], progression: [0, -4, 3, -2], bpm: 70, drone: 'sawtooth', droneLp: 300, pluck: 'drip', density: 0.35, bed: 'steam', bedVol: 0.35 },
  ashvents: { root: -8, scale: [0, 1, 4, 5, 7, 8, 10, 12], progression: [0, 1, -2, 1], bpm: 96, drone: 'sawtooth', droneLp: 360, pluck: 'ember', density: 0.35, bed: 'vents', bedVol: 0.38 },
  coldmarrow: { root: -3, scale: [0, 2, 3, 7, 8, 12, 14, 15], progression: [0, -4, -2, -5], bpm: 58, drone: 'triangle', droneLp: 600, pluck: 'glass', density: 0.25, bed: 'frost', bedVol: 0.32, heartbeat: true, coal: true, droneAt: -12 },
  raid: { root: -14, scale: [0, 2, 3, 5, 7, 8, 10, 12], progression: [0, -4, -2, -5], bpm: 72, drone: 'sawtooth', droneLp: 750, pluck: 'brass', density: 0.4, bed: 'slag', bedVol: 0.3, meter: 3, phaseTempo: [1, 1.1, 1.2, 2], floodBed: 2.2 },
  // The Wrackline: a wrecked, sea-dark harbour. Slow aeolian swell, buoy bells, surf breaking on the pilings.
  wrackline: { root: -9, scale: [0, 2, 3, 5, 7, 8, 10, 12, 14], progression: [0, -4, -5, -2], bpm: 60, drone: 'sawtooth', droneLp: 600, pluck: 'bell', density: 0.28, bed: 'surf', bedVol: 0.42 },
  // The Pressworks: a working rhythm. The bed is a press cycle (thud, then steam), the plucks ring like struck plate, and the drone is a saw so it holds up on phones.
  pressworks: { root: -11, scale: [0, 1, 3, 5, 7, 8, 10, 12], progression: [0, -2, 1, -4], bpm: 80, drone: 'sawtooth', droneLp: 650, pluck: 'anvil', density: 0.32, bed: 'press', bedVol: 0.5 },
  // The Hoard (raid 2): Old Coalmouth's coal cave. A slow, heavy chewing groove in phrygian: the bed is his jaw
  // grinding coal three times round the loop, the plucks are embers, and the march of the Crucible's raid is gone.
  hoard: { root: -16, scale: [0, 1, 3, 5, 7, 8, 10, 12], progression: [0, 1, -2, 1], bpm: 62, drone: 'sawtooth', droneLp: 650, pluck: 'ember', density: 0.3, bed: 'chew', bedVol: 0.5, phaseTempo: [1, 1.15, 1.25, 1.35], floodBed: 1.5 },
  hammerdeep: { root: -10, scale: [0, 2, 3, 5, 7, 9, 10, 12], progression: [0, -2, -4, -5], bpm: 88, drone: 'sawtooth', droneLp: 420, pluck: 'anvil', density: 0.3, bed: 'forge', bedVol: 0.35 },
  glarewell: { root: -5, scale: [0, 2, 4, 6, 7, 11, 12, 14, 18], progression: [0, 6, 4, -1], bpm: 66, drone: 'triangle', droneLp: 500, pluck: 'bell', density: 0.45, bed: 'shimmer', bedVol: 0.3 },
};

// ---------------------------------------------------------------- beds (pure)

/**
 * Long-session variety: a theme plays as a six-part plan, one part per pass through its
 * progression (8 bars, about 20-35 s), so the same 8 bars never just loop:
 *  - main: as written;
 *  - turn: the same chords, starting halfway through (rotated), for a new harmonic road;
 *  - high: the melody climbs an octave;
 *  - breakdown: the melody thins out and the slow pulse rests, a breath before the theme returns.
 * Boss fights (intensity) never break down. The melody itself is still a fresh walk each time.
 */
export type Section = { name: 'main' | 'turn' | 'high' | 'breakdown'; rotate: number; octave: number; density: number; pulse: boolean };
const PLAN: Section[] = [
  { name: 'main', rotate: 0, octave: 0, density: 1, pulse: true },
  { name: 'main', rotate: 0, octave: 0, density: 1, pulse: true },
  { name: 'turn', rotate: 2, octave: 0, density: 1, pulse: true },
  { name: 'high', rotate: 0, octave: 12, density: 0.8, pulse: true },
  { name: 'breakdown', rotate: 0, octave: 0, density: 0.35, pulse: false },
  { name: 'turn', rotate: 2, octave: 12, density: 0.9, pulse: true },
];
/** The section for a beat of a theme. Pure, so tests can walk a whole plan. */
export function sectionAt(beat: number, th: Pick<Theme, 'meter' | 'progression'>, intense: boolean): Section {
  const bar = Math.floor(beat / (th.meter ?? 4));
  const cycle = Math.floor(bar / (2 * th.progression.length));
  const sec = PLAN[cycle % PLAN.length];
  return intense && sec.name === 'breakdown' ? PLAN[0] : sec;
}
/** The chord (semitones from the root) for a beat, following the section plan. */
export function chordAt(beat: number, th: Pick<Theme, 'meter' | 'progression'>, intense: boolean): number {
  const bar = Math.floor(beat / (th.meter ?? 4));
  const { rotate } = sectionAt(beat, th, intense);
  const n = th.progression.length;
  return th.progression[(Math.floor(bar / 2) + rotate) % n];
}

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Renders a texture bed that loops seamlessly (its end crossfades into its
 * start). Pure so it can be tested.
 */
export function bedSamples(kind: BedKind, rate: number, seconds = 6, seed = 7): Float32Array {
  const fade = Math.floor(rate * 0.25);
  const n = Math.floor(rate * seconds) + fade;
  const raw = new Float32Array(n);
  const r = rng(seed);
  const white = () => r() * 2 - 1;
  const period = n - fade;
  let brown = 0;
  let lp = 0;
  let hp = 0;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = (i % period) / period; // 0..1 around the loop
    const w = white();
    brown = (brown + w * 0.02) * 0.995;
    switch (kind) {
      case 'hearth':
      case 'fire': {
        // Low roar plus sparse pops that ring briefly.
        lp += (w - lp) * 0.06;
        raw[i] = brown * (kind === 'fire' ? 1.4 : 0.6) + lp * (kind === 'fire' ? 0.4 : 0.3);
        break;
      }
      case 'steam': {
        // Hiss that swells and falls twice around the loop.
        hp = 0.9 * (hp + w - prev);
        prev = w;
        const swell = 0.25 + 0.75 * Math.pow(0.5 - 0.5 * Math.cos(t * Math.PI * 4), 2);
        raw[i] = hp * 0.16 * swell + brown * 0.9;
        break;
      }
      case 'forge': {
        // Bellows: a deep breath in and out, three times around the loop.
        lp += (w - lp) * 0.04;
        const breath = Math.pow(Math.sin(t * Math.PI * 3), 2);
        raw[i] = lp * 0.6 * breath + brown * 1.2;
        break;
      }
      case 'frost': {
        // Cold wind: band-passed noise in long gusts, with a thin whistle on top.
        hp = 0.97 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.12;
        const gust = 0.3 + 0.7 * Math.pow(0.5 - 0.5 * Math.cos(t * Math.PI * 4), 3);
        raw[i] = lp * 0.35 * gust + Math.sin((2 * Math.PI * 1100 * i) / rate) * 0.015 * gust + brown * 0.4;
        break;
      }
      case 'vents': {
        // Two vents breathing in turn: a hot roar that swells on one beat and the other.
        lp += (w - lp) * 0.05;
        const a = Math.pow(Math.max(0, Math.sin(t * Math.PI * 4)), 3);
        const b = Math.pow(Math.max(0, -Math.sin(t * Math.PI * 4)), 3);
        raw[i] = lp * (0.5 * a + 0.35 * b) + brown * 1.2;
        break;
      }
      case 'slag': {
        // A slow molten churn; the glugs are added below.
        lp += (w - lp) * 0.015;
        raw[i] = lp * 0.5 + brown * 1.6;
        break;
      }
      case 'press': {
        // A stamping press working four strokes round the loop: a heavy thud, then a vent of steam.
        hp = 0.92 * (hp + w - prev);
        prev = w;
        const ph = (t * 4) % 1;
        const thud = Math.exp(-ph * 38) * Math.sin(2 * Math.PI * 58 * (i / rate)) * 2.2 + Math.exp(-ph * 60) * w * 0.6;
        const vent = ph > 0.18 ? Math.exp(-(ph - 0.18) * 9) * hp * 0.6 : 0;
        raw[i] = thud + vent + brown * 1.1;
        break;
      }
      case 'surf': {
        // Waves: a low wash that rolls in twice around the loop, with a bright hiss as each one breaks.
        lp += (w - lp) * 0.03;
        hp = 0.9 * (hp + w - prev);
        prev = w;
        const roll = Math.pow(0.5 - 0.5 * Math.cos(t * Math.PI * 4), 2);
        const crest = Math.pow(Math.max(0, Math.sin(t * Math.PI * 4 - 0.6)), 6);
        raw[i] = lp * 0.7 * (0.3 + 0.7 * roll) + hp * 0.12 * crest + brown * 0.8;
        break;
      }
      case 'chew': {
        // A jaw grinding coal three times round the loop: a gritty band of noise that swells with each chew,
        // chopped at 13 Hz like teeth on stone, over a low growl. The coal crunches are added below.
        hp = 0.93 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.35;
        const ph = (t * 3) % 1;
        const jaw = ph < 0.6 ? Math.pow(Math.sin((Math.PI * ph) / 0.6), 2) : 0;
        const grit = Math.sin((2 * Math.PI * 13 * i) / rate) > 0.2 ? 1 : 0.25;
        const growl = Math.sin(2 * Math.PI * 49 * (i / rate)) + 0.5 * Math.sin(2 * Math.PI * 98 * (i / rate));
        raw[i] = lp * 0.5 * jaw * grit + growl * 0.12 * jaw + brown * 1.2;
        break;
      }
      case 'shimmer': {
        // A slow, wide band of airy noise that breathes in and out.
        hp = 0.95 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.3;
        const breathe = 0.5 + 0.5 * Math.sin(t * Math.PI * 6);
        raw[i] = lp * 0.12 * breathe + brown * 0.5;
        break;
      }
    }
  }
  // Pops for fire, drips for steam (short decaying tones placed at random).
  const events = kind === 'chew' ? 54 : kind === 'fire' ? 70 : kind === 'hearth' ? 28 : kind === 'steam' ? 5 : kind === 'forge' ? 40 : kind === 'vents' ? 50 : kind === 'slag' ? 26 : kind === 'frost' ? 6 : 0;
  for (let k = 0; k < events; k++) {
    // Chew: the crunches land while the jaw is closing (the first 60% of each of the three chews).
    const at = kind === 'chew' ? Math.floor((Math.floor(r() * 3) + r() * 0.6) * (period / 3)) % Math.max(1, period - Math.floor(rate * 0.05)) : Math.floor(r() * (period - rate * 0.3));
    // Steam drips; slag glugs (a low bubble that pops upward).
    const drip = kind === 'steam' || kind === 'slag';
    const glug = kind === 'slag';
    // Forge: distant hammer clinks; frost: tiny ice ticks (bright, inharmonic, quiet) instead of fire pops.
    const clink = kind === 'forge' || kind === 'frost';
    const tone = drip || clink;
    const len = Math.floor(rate * (glug ? 0.12 : drip ? 0.18 : clink ? 0.25 : 0.004 + r() * 0.02));
    const amp = (glug ? 0.35 : drip ? 0.25 : kind === 'frost' ? 0.08 : clink ? 0.12 + r() * 0.12 : 0.2 + r() * 0.5) * (kind === 'hearth' ? 0.6 : 1);
    const f0 = glug ? 110 + r() * 160 : drip ? 900 + r() * 900 : kind === 'frost' ? 3200 + r() * 2000 : clink ? 1800 + r() * 1400 : 0;
    let ph = 0;
    let ph2 = 0;
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, tone ? 3 : 2);
      let s: number;
      if (drip) {
        ph += (f0 * (1 + (glug ? 2.5 : 1.2) * (i / len))) / rate;
        s = Math.sin(ph * Math.PI * 2);
      } else if (clink) {
        ph += f0 / rate;
        ph2 += (f0 * 2.76) / rate;
        s = Math.sin(ph * Math.PI * 2) + 0.4 * Math.sin(ph2 * Math.PI * 2);
      } else s = white();
      raw[at + i] += s * env * amp;
    }
  }
  // Crossfade the tail over the head so the loop has no seam.
  const out = raw.slice(0, period);
  for (let i = 0; i < fade; i++) {
    const g = i / fade;
    out[i] = raw[i] * g + raw[period + i] * (1 - g);
  }
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak;
  return out;
}

// ---------------------------------------------------------------- player

/** One playing theme: its own gain so themes can crossfade. */
class ThemePlayer {
  readonly out: GainNode;
  private drones: OscillatorNode[] = [];
  private droneFilter: BiquadFilterNode;
  private bed: AudioBufferSourceNode;
  private bassGain: GainNode;
  private bedGain: GainNode;
  private coalGain: GainNode | null = null;
  private coalSrc: AudioBufferSourceNode | null = null;
  private flooded = false;
  private beat = 0;
  private nextAt: number;
  private r = rng(Date.now() & 0xffff);
  private lastNote = 0;
  intensity = 0;

  constructor(private ctx: AudioContext, dest: AudioNode, readonly id: ThemeId, private theme: Theme, bedBuf: AudioBuffer, coalBuf?: AudioBuffer, warmth = 1) {
    const t = ctx.currentTime;
    this.out = ctx.createGain();
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(1, t + 2);
    this.out.connect(dest);

    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = theme.droneLp;
    this.droneFilter.Q.value = 2;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.09;
    this.droneFilter.connect(droneGain).connect(this.out);
    // Two detuned voices plus a fifth: a slow beating that never sits still.
    for (const [semi, cents] of [[0, -6], [0, 7], [7, 0]] as const) {
      const o = ctx.createOscillator();
      o.type = theme.drone;
      o.frequency.value = note(theme.root + (theme.droneAt ?? -12) + semi);
      o.detune.value = cents;
      o.connect(this.droneFilter);
      o.start(t);
      this.drones.push(o);
    }
    // Slowly opening and closing filter.
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = theme.droneLp * 0.5;
    lfo.connect(lfoGain).connect(this.droneFilter.frequency);
    lfo.start(t);
    this.drones.push(lfo);

    this.bed = ctx.createBufferSource();
    this.bed.buffer = bedBuf;
    this.bed.loop = true;
    const bedGain = ctx.createGain();
    this.bedGain = bedGain;
    bedGain.gain.value = theme.bedVol;
    const bedFilter = ctx.createBiquadFilter();
    bedFilter.type = 'lowpass';
    bedFilter.frequency.value = theme.bed === 'shimmer' ? 9000 : theme.bed === 'steam' ? 6000 : 3500;
    this.bed.connect(bedFilter).connect(bedGain).connect(this.out);
    this.bed.start(t, this.r() * bedBuf.duration);

    if (theme.coal && coalBuf) {
      // The Hearthcoal: a close, warm crackle in front of the cold mix.
      this.coalSrc = ctx.createBufferSource();
      this.coalSrc.buffer = coalBuf;
      this.coalSrc.loop = true;
      this.coalGain = ctx.createGain();
      this.coalGain.gain.value = 0.32 * warmth;
      this.coalSrc.connect(this.coalGain).connect(this.out);
      this.coalSrc.start(t, this.r() * coalBuf.duration);
    }

    this.bassGain = ctx.createGain();
    this.bassGain.gain.value = 0;
    this.bassGain.connect(this.out);
    this.nextAt = t + 0.3;
  }

  /** 0 (out) to 1 (a full coal): the Hearthcoal crackle's loudness. */
  setWarmth(w: number): void {
    this.coalGain?.gain.setTargetAtTime(0.32 * Math.max(0, Math.min(1, w)), this.ctx.currentTime, 0.4);
  }

  private chordRoot(): number {
    return chordAt(this.beat, this.theme, this.intensity > 0);
  }

  /** Schedules every beat that starts before `until`. */
  schedule(until: number): void {
    const ctx = this.ctx;
    if (this.nextAt < ctx.currentTime) this.nextAt = ctx.currentTime + 0.05;
    const th = this.theme;
    const fast = this.intensity > 0;
    const tempo = th.phaseTempo ?? [1, 1.25];
    const spb = 60 / (th.bpm * tempo[Math.min(this.intensity, tempo.length - 1)]);
    const meter = th.meter ?? 4;
    const flood = !!th.floodBed && this.intensity >= 2;
    if (flood !== this.flooded) {
      this.flooded = flood;
      this.bedGain.gain.setTargetAtTime(th.bedVol * (flood ? th.floodBed! : 1), ctx.currentTime, 1.2);
    }
    while (this.nextAt < until) {
      const at = this.nextAt;
      const chord = this.chordRoot();
      const sec = sectionAt(this.beat, th, fast);
      if (this.beat % (meter * 2) === 0) {
        // Move the drone to the new chord.
        this.drones.slice(0, 3).forEach((o, k) => o.frequency.setTargetAtTime(note(th.root + (th.droneAt ?? -12) + chord + (k === 2 ? 7 : 0)), at, 0.8));
      }
      // Melody: an 8th-note pattern when intense, otherwise sparse quarter notes.
      const steps = fast ? 2 : 1;
      for (let s = 0; s < steps; s++) {
        if (this.r() < th.density * sec.density + (fast ? 0.2 : 0)) {
          // Walk the scale in small steps so lines feel sung, not random.
          const move = Math.floor(this.r() * 5) - 2;
          this.lastNote = Math.max(0, Math.min(th.scale.length - 1, this.lastNote + move));
          const semis = th.root + 12 + sec.octave + th.scale[this.lastNote];
          this.pluck(note(semis), at + s * spb * 0.5, 0.5 + this.r() * 0.5);
        }
      }
      if (meter === 3) {
        // A march in three: a heavy downbeat with an anvil-and-bell hit, two lighter steps.
        const down = this.beat % 3 === 0;
        this.drum(at, down ? (fast ? 1 : 0.7) : fast ? 0.5 : 0.3);
        if (down) {
          this.pluck(note(th.root + chord), at, 0.9);
          this.bass(note(th.root - 12 + chord), at, spb * 2.6);
        }
      } else if (!sec.pulse) {
        // Breakdown: the pulse rests for one pass.
      } else if (th.heartbeat && !fast) {
        // The Coldmarrow's slow heartbeat: lub-dub once a bar.
        if (this.beat % meter === 0) {
          this.drum(at, 0.45);
          this.drum(at + 0.22, 0.28);
        }
      } else if (fast) {
        this.drum(at, this.beat % 2 === 0 ? 1 : 0.55);
        if (this.beat % 2 === 0) this.bass(note(th.root - 12 + chord), at, spb * 1.6);
      } else if (th.pluck === 'anvil' && this.beat % 2 === 0) {
        // The Hammerdeep marches: a hammer on every other beat, the anvil rings on the bar.
        this.drum(at, this.beat % 4 === 0 ? 0.6 : 0.35);
        if (this.beat % 4 === 0) this.pluck(note(th.root + 12 + chord), at, 0.8);
      } else if (this.beat % 4 === 0 && (th.pluck === 'ember' || th.pluck === 'drip')) {
        // A slow, distant pulse under the dungeon themes.
        this.drum(at, 0.35);
      }
      this.beat++;
      this.nextAt += spb;
    }
  }

  private pluck(f: number, at: number, vel: number): void {
    const ctx = this.ctx;
    const kind = this.theme.pluck;
    const g = ctx.createGain();
    const dur = kind === 'bell' ? 2.4 : kind === 'glass' ? 2.0 : kind === 'brass' ? 1.1 : kind === 'harp' ? 1.6 : kind === 'drip' ? 0.5 : kind === 'anvil' ? 1.4 : 1.2;
    const peak = (kind === 'bell' ? 0.055 : kind === 'glass' ? 0.05 : kind === 'brass' ? 0.06 : kind === 'drip' ? 0.06 : kind === 'harp' ? 0.11 : 0.07) * vel;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + (kind === 'brass' ? 0.06 : 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    g.connect(this.out);
    const partials = kind === 'glass' ? [[1, 1], [3.01, 0.3], [5.98, 0.1]] : kind === 'brass' ? [[1, 1], [2, 0.6], [3, 0.4], [4, 0.2]] : kind === 'anvil' ? [[1, 1], [2.32, 0.5], [4.25, 0.25], [6.1, 0.12]] : kind === 'bell' ? [[1, 1], [2.76, 0.35], [5.4, 0.12]] : kind === 'harp' ? [[1, 1], [2, 0.4], [3, 0.15]] : [[1, 1]];
    for (const [mult, amp] of partials) {
      const o = ctx.createOscillator();
      o.type = kind === 'ember' || kind === 'brass' ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(f * mult, at);
      if (kind === 'drip') o.frequency.exponentialRampToValueAtTime(f * 1.6, at + 0.12);
      const pg = ctx.createGain();
      pg.gain.value = amp;
      o.connect(pg).connect(g);
      o.start(at);
      o.stop(at + dur + 0.05);
    }
  }

  private drum(at: number, vel: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, at);
    o.frequency.exponentialRampToValueAtTime(38, at + 0.25);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.22 * vel, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.4);
    o.connect(g).connect(this.out);
    o.start(at);
    o.stop(at + 0.45);
    // Phone speakers drop the low thump, so a short knock an octave and more up carries the beat.
    const k = ctx.createOscillator();
    const kg = ctx.createGain();
    k.type = 'triangle';
    k.frequency.setValueAtTime(260, at);
    k.frequency.exponentialRampToValueAtTime(130, at + 0.08);
    kg.gain.setValueAtTime(0.0001, at);
    kg.gain.exponentialRampToValueAtTime(0.09 * vel, at + 0.004);
    kg.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    k.connect(kg).connect(this.out);
    k.start(at);
    k.stop(at + 0.15);
  }

  private bass(f: number, at: number, dur: number): void {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const flt = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = f;
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(900, at);
    flt.frequency.exponentialRampToValueAtTime(320, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.07, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(flt).connect(g).connect(this.out);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  /** Fades out over `secs`, then frees every node. */
  stop(secs = 1.5): void {
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(this.out.gain.value, t);
    this.out.gain.linearRampToValueAtTime(0, t + secs);
    const end = t + secs + 0.1;
    this.drones.forEach((o) => o.stop(end));
    this.bed.stop(end);
    this.coalSrc?.stop(end);
    setTimeout(() => this.out.disconnect(), (secs + 0.5) * 1000);
  }
}

/** The hub's theme for each season (SEASONS order in sim/content/season.ts). A season without a variant keeps the plain hub. */
export const HUB_BY_SEASON: (ThemeId | undefined)[] = ['hub', 'hubBellows', 'hubHearth', 'hubSlag', 'hubPress', 'hubEbb'];

/** The hub theme for a season id (seasonOf); the seasons rotate through SEASONS, so this wraps the same way. */
export function hubThemeFor(seasonId: number, seasons: number): ThemeId {
  const i = ((seasonId % seasons) + seasons) % seasons;
  return HUB_BY_SEASON[i] ?? 'hub';
}

/** Plays one theme at a time and crossfades between them. */
export class MusicPlayer {
  private current: ThemePlayer | null = null;
  private beds = new Map<BedKind, AudioBuffer>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private warmth = 1;

  constructor(private ctx: AudioContext, private dest: AudioNode) {}

  private bedBuffer(kind: BedKind): AudioBuffer {
    let bed = this.beds.get(kind);
    if (!bed) {
      // 24 kHz is plenty for a texture bed and halves the work on slow phones.
      const data = bedSamples(kind, 24000);
      bed = this.ctx.createBuffer(1, data.length, 24000);
      bed.getChannelData(0).set(data);
      this.beds.set(kind, bed);
    }
    return bed;
  }

  /** The Coldmarrow's Hearthcoal: 1 is a full coal, 0 is out. */
  setWarmth(w: number): void {
    // Called every frame in the Coldmarrow: only touch the audio graph when the coal has visibly changed.
    if (Math.abs(w - this.warmth) < 0.02 && (w > 0 || this.warmth === 0)) return;
    this.warmth = w;
    this.current?.setWarmth(w);
  }

  get theme(): ThemeId | null {
    return this.current?.id ?? null;
  }

  play(id: ThemeId | null): void {
    if (this.current?.id === id) return;
    this.current?.stop();
    this.current = null;
    if (!id) return this.halt();
    // A new theme starts with a full coal: the Coldmarrow's last coal must not carry into the hub's.
    this.warmth = 1;
    const th = THEMES[id];
    this.current = new ThemePlayer(this.ctx, this.dest, id, th, this.bedBuffer(th.bed), th.coal ? this.bedBuffer('hearth') : undefined, this.warmth);
    if (!this.timer) this.timer = setInterval(() => this.current?.schedule(this.ctx.currentTime + 0.25), 60);
  }

  setIntensity(level: number): void {
    if (this.current) this.current.intensity = level;
  }

  private halt(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
