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
 * A boss fight raises the intensity: a drum pulse and a bass line join in.
 */
import { note } from './synth';

export type ThemeId = 'hub' | 'kiln' | 'foundry' | 'glarewell' | 'hammerdeep';
export type BedKind = 'hearth' | 'fire' | 'steam' | 'shimmer' | 'forge';

interface Theme {
  /** Root pitch in semitones from A4. */
  root: number;
  /** Scale degrees the melody may use, in semitones above the root. */
  scale: number[];
  /** Chord roots for each two-bar step (semitones above the root). */
  progression: number[];
  bpm: number;
  drone: OscillatorType;
  droneLp: number;
  pluck: 'harp' | 'bell' | 'drip' | 'ember' | 'anvil';
  /** Chance a beat gets a melody note (calm themes leave space). */
  density: number;
  bed: BedKind;
  bedVol: number;
  /** Drone register in semitones from the root (default -12, an octave down). */
  droneAt?: number;
}

export const THEMES: Record<ThemeId, Theme> = {
  hub: { root: -7, scale: [0, 2, 4, 7, 9, 12, 14, 16], progression: [0, 5, -3, 7], bpm: 76, drone: 'triangle', droneLp: 700, pluck: 'harp', density: 0.6, bed: 'hearth', bedVol: 0.3, droneAt: 0 },
  kiln: { root: -12, scale: [0, 1, 3, 5, 7, 8, 12, 13], progression: [0, 1, 0, -2], bpm: 84, drone: 'sawtooth', droneLp: 380, pluck: 'ember', density: 0.4, bed: 'fire', bedVol: 0.4 },
  foundry: { root: -7, scale: [0, 2, 3, 7, 10, 12, 15], progression: [0, -4, 3, -2], bpm: 70, drone: 'sawtooth', droneLp: 300, pluck: 'drip', density: 0.35, bed: 'steam', bedVol: 0.35 },
  hammerdeep: { root: -10, scale: [0, 2, 3, 5, 7, 9, 10, 12], progression: [0, -2, -4, -5], bpm: 88, drone: 'sawtooth', droneLp: 420, pluck: 'anvil', density: 0.3, bed: 'forge', bedVol: 0.35 },
  glarewell: { root: -5, scale: [0, 2, 4, 6, 7, 11, 12, 14, 18], progression: [0, 6, 4, -1], bpm: 66, drone: 'triangle', droneLp: 500, pluck: 'bell', density: 0.45, bed: 'shimmer', bedVol: 0.3 },
};

// ---------------------------------------------------------------- beds (pure)

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
  const events = kind === 'fire' ? 70 : kind === 'hearth' ? 28 : kind === 'steam' ? 5 : kind === 'forge' ? 40 : 0;
  for (let k = 0; k < events; k++) {
    const at = Math.floor(r() * (period - rate * 0.3));
    const drip = kind === 'steam';
    // Forge: distant hammer clinks (bright, inharmonic, quiet) instead of fire pops.
    const clink = kind === 'forge';
    const tone = drip || clink;
    const len = Math.floor(rate * (drip ? 0.18 : clink ? 0.25 : 0.004 + r() * 0.02));
    const amp = (drip ? 0.25 : clink ? 0.12 + r() * 0.12 : 0.2 + r() * 0.5) * (kind === 'hearth' ? 0.6 : 1);
    const f0 = drip ? 900 + r() * 900 : clink ? 1800 + r() * 1400 : 0;
    let ph = 0;
    let ph2 = 0;
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, tone ? 3 : 2);
      let s: number;
      if (drip) {
        ph += (f0 * (1 + 1.2 * (i / len))) / rate;
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
  private beat = 0;
  private nextAt: number;
  private r = rng(Date.now() & 0xffff);
  private lastNote = 0;
  intensity = 0;

  constructor(private ctx: AudioContext, dest: AudioNode, readonly id: ThemeId, private theme: Theme, bedBuf: AudioBuffer) {
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
    bedGain.gain.value = theme.bedVol;
    const bedFilter = ctx.createBiquadFilter();
    bedFilter.type = 'lowpass';
    bedFilter.frequency.value = theme.bed === 'shimmer' ? 9000 : theme.bed === 'steam' ? 6000 : 3500;
    this.bed.connect(bedFilter).connect(bedGain).connect(this.out);
    this.bed.start(t, this.r() * bedBuf.duration);

    this.bassGain = ctx.createGain();
    this.bassGain.gain.value = 0;
    this.bassGain.connect(this.out);
    this.nextAt = t + 0.3;
  }

  private chordRoot(): number {
    const bar = Math.floor(this.beat / 4);
    return this.theme.progression[Math.floor(bar / 2) % this.theme.progression.length];
  }

  /** Schedules every beat that starts before `until`. */
  schedule(until: number): void {
    const ctx = this.ctx;
    if (this.nextAt < ctx.currentTime) this.nextAt = ctx.currentTime + 0.05;
    const th = this.theme;
    const fast = this.intensity > 0;
    const spb = 60 / (th.bpm * (fast ? 1.25 : 1));
    while (this.nextAt < until) {
      const at = this.nextAt;
      const chord = this.chordRoot();
      if (this.beat % 8 === 0) {
        // Move the drone to the new chord.
        this.drones.slice(0, 3).forEach((o, k) => o.frequency.setTargetAtTime(note(th.root + (th.droneAt ?? -12) + chord + (k === 2 ? 7 : 0)), at, 0.8));
      }
      // Melody: an 8th-note pattern when intense, otherwise sparse quarter notes.
      const steps = fast ? 2 : 1;
      for (let s = 0; s < steps; s++) {
        if (this.r() < th.density + (fast ? 0.2 : 0)) {
          // Walk the scale in small steps so lines feel sung, not random.
          const move = Math.floor(this.r() * 5) - 2;
          this.lastNote = Math.max(0, Math.min(th.scale.length - 1, this.lastNote + move));
          const semis = th.root + 12 + th.scale[this.lastNote];
          this.pluck(note(semis), at + s * spb * 0.5, 0.5 + this.r() * 0.5);
        }
      }
      if (fast) {
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
    const dur = kind === 'bell' ? 2.4 : kind === 'harp' ? 1.6 : kind === 'drip' ? 0.5 : kind === 'anvil' ? 1.4 : 1.2;
    const peak = (kind === 'bell' ? 0.055 : kind === 'drip' ? 0.06 : kind === 'harp' ? 0.11 : 0.07) * vel;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    g.connect(this.out);
    const partials = kind === 'anvil' ? [[1, 1], [2.32, 0.5], [4.25, 0.25], [6.1, 0.12]] : kind === 'bell' ? [[1, 1], [2.76, 0.35], [5.4, 0.12]] : kind === 'harp' ? [[1, 1], [2, 0.4], [3, 0.15]] : [[1, 1]];
    for (const [mult, amp] of partials) {
      const o = ctx.createOscillator();
      o.type = kind === 'ember' ? 'triangle' : 'sine';
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
    setTimeout(() => this.out.disconnect(), (secs + 0.5) * 1000);
  }
}

/** Plays one theme at a time and crossfades between them. */
export class MusicPlayer {
  private current: ThemePlayer | null = null;
  private beds = new Map<BedKind, AudioBuffer>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private ctx: AudioContext, private dest: AudioNode) {}

  get theme(): ThemeId | null {
    return this.current?.id ?? null;
  }

  play(id: ThemeId | null): void {
    if (this.current?.id === id) return;
    this.current?.stop();
    this.current = null;
    if (!id) return this.halt();
    const th = THEMES[id];
    let bed = this.beds.get(th.bed);
    if (!bed) {
      const data = bedSamples(th.bed, this.ctx.sampleRate);
      bed = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
      bed.getChannelData(0).set(data);
      this.beds.set(th.bed, bed);
    }
    this.current = new ThemePlayer(this.ctx, this.dest, id, th, bed);
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
