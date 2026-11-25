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

export type ThemeId = 'hub' | 'kiln' | 'foundry' | 'glarewell' | 'hammerdeep' | 'ashvents' | 'coldmarrow' | 'raid' | 'wrackline' | 'hubBellows' | 'hubHearth' | 'pressworks' | 'hubSlag' | 'hubPress' | 'hubEbb' | 'hoard' | 'smeltery' | 'hubHunger' | 'hubPlate' | 'flue';
export type BedKind = 'hearth' | 'fire' | 'steam' | 'shimmer' | 'forge' | 'frost' | 'vents' | 'slag' | 'surf' | 'press' | 'chew' | 'stride' | 'draft'
  // Halls room themes (visuals, 25 Nov): one quiet bed each, played under the dungeon theme in that room (MusicPlayer.setRoomBed).
  | RoomBedKind;

/** The five Halls room themes' beds, each from the room's one quiet motion (visuals' theme list, 25 Nov 2026). */
export type RoomBedKind = 'ashStore' | 'bellowsHall' | 'slagChannel' | 'coolingYard' | 'kilnShrine'
  // The Drowned Foundry's four (visuals, 25 Nov; its shrine side room keeps kilnShrine).
  | 'boilerRoom' | 'cistern' | 'pumpHall' | 'anchorStore'
  // The Glarewell's four (visuals, 25 Nov).
  | 'lensGallery' | 'starVault' | 'shadeColonnade' | 'mirrorHall'
  // The Coldmarrow's four (visuals, 25 Nov): no warm sound in any of them, since the hero's Hearthcoal is the only warmth.
  | 'deadHearth' | 'rimeHall' | 'snowdriftCave' | 'coldCrypt'
  // The Wrackline's four (visuals, 25 Nov): every room is a quay of open water with rafts.
  | 'harbourQuay' | 'wreckYard' | 'kelpBed' | 'sluiceGate'
  // The Hammerdeep's four (H4a, 25 Nov): cold forge iron, nothing glowing.
  | 'anvilHall' | 'chainGallery' | 'quenchTrough' | 'ingotStore'
  // The Ashvents' four (H4b, 25 Nov): pale ash and rose stone, nothing burns.
  | 'fumaroleField' | 'obsidianGallery' | 'cairnWalk' | 'pumiceDrift'
  // The Pressworks' four (H4c, 25 Nov): olive brass, nothing glows.
  | 'pressFloor' | 'gearRoom' | 'plateStore' | 'oilSump';
export const ROOM_BEDS: readonly RoomBedKind[] = [
  'ashStore', 'bellowsHall', 'slagChannel', 'coolingYard', 'kilnShrine',
  'boilerRoom', 'cistern', 'pumpHall', 'anchorStore',
  'lensGallery', 'starVault', 'shadeColonnade', 'mirrorHall',
  'deadHearth', 'rimeHall', 'snowdriftCave', 'coldCrypt',
  'harbourQuay', 'wreckYard', 'kelpBed', 'sluiceGate',
  'anvilHall', 'chainGallery', 'quenchTrough', 'ingotStore',
  'fumaroleField', 'obsidianGallery', 'cairnWalk', 'pumiceDrift',
  'pressFloor', 'gearRoom', 'plateStore', 'oilSump',
];
/** A room bed's loudness under the theme (a dungeon theme's own bed runs 0.35-0.4): heard in a quiet room, gone in a fight. */
export const ROOM_BED_VOL = 0.16;
/** Seconds a room bed takes to fade into the next room's as the hero walks through a doorway. */
export const ROOM_BED_FADE = 1.5;

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
  // Season 7, the Long Hunger (the Hoard): the harp in the Hoard's phrygian, its progression and tempo, over a far-off chewing in the deep.
  hubHunger: { root: -4, scale: [0, 1, 3, 5, 7, 8, 10, 12], progression: [0, 1, -2, 1], bpm: 62, drone: 'triangle', droneLp: 650, pluck: 'harp', density: 0.45, bed: 'chew', bedVol: 0.26, droneAt: 0 },
  // Season 8, the Cracked Plate (the Smeltery): the harp in the Smeltery's harmonic minor over the Colossus's slow distant stride.
  hubPlate: { root: -5, scale: [0, 2, 3, 5, 7, 8, 11, 12], progression: [0, -4, -5, -1], bpm: 60, drone: 'triangle', droneLp: 650, pluck: 'harp', density: 0.45, bed: 'stride', bedVol: 0.26, droneAt: 0 },
  kiln: { root: -12, scale: [0, 1, 3, 5, 7, 8, 12, 13], progression: [0, 1, 0, -2], bpm: 84, drone: 'sawtooth', droneLp: 380, pluck: 'ember', density: 0.4, bed: 'fire', bedVol: 0.4 },
  foundry: { root: -7, scale: [0, 2, 3, 7, 10, 12, 15], progression: [0, -4, 3, -2], bpm: 70, drone: 'sawtooth', droneLp: 300, pluck: 'drip', density: 0.35, bed: 'steam', bedVol: 0.35 },
  ashvents: { root: -8, scale: [0, 1, 4, 5, 7, 8, 10, 12], progression: [0, 1, -2, 1], bpm: 96, drone: 'sawtooth', droneLp: 360, pluck: 'ember', density: 0.35, bed: 'vents', bedVol: 0.38 },
  coldmarrow: { root: -3, scale: [0, 2, 3, 7, 8, 12, 14, 15], progression: [0, -4, -2, -5], bpm: 58, drone: 'triangle', droneLp: 600, pluck: 'glass', density: 0.25, bed: 'frost', bedVol: 0.32, heartbeat: true, coal: true, droneAt: -12 },
  raid: { root: -14, scale: [0, 2, 3, 5, 7, 8, 10, 12], progression: [0, -4, -2, -5], bpm: 72, drone: 'sawtooth', droneLp: 750, pluck: 'brass', density: 0.4, bed: 'slag', bedVol: 0.3, meter: 3, phaseTempo: [1, 1.1, 1.2, 2], floodBed: 2.2 },
  // The Wrackline: a wrecked, sea-dark harbour. Slow aeolian swell, buoy bells, surf breaking on the pilings.
  wrackline: { root: -9, scale: [0, 2, 3, 5, 7, 8, 10, 12, 14], progression: [0, -4, -5, -2], bpm: 60, drone: 'sawtooth', droneLp: 600, pluck: 'bell', density: 0.28, bed: 'surf', bedVol: 0.42 },
  // The Pressworks: a working rhythm. The bed is a press cycle (thud, then steam), the plucks ring like struck plate, and the drone is a saw so it holds up on phones.
  pressworks: { root: -11, scale: [0, 1, 3, 5, 7, 8, 10, 12], progression: [0, -2, 1, -4], bpm: 80, drone: 'sawtooth', droneLp: 650, pluck: 'anvil', density: 0.32, bed: 'press', bedVol: 0.5 },
  // The Hoard (raid 2): Old Vorhulm's coal cave. A slow, heavy chewing groove in phrygian: the bed is his jaw
  // grinding coal three times round the loop, the plucks are embers, and the march of the Crucible's raid is gone.
  hoard: { root: -16, scale: [0, 1, 3, 5, 7, 8, 10, 12], progression: [0, 1, -2, 1], bpm: 62, drone: 'sawtooth', droneLp: 650, pluck: 'ember', density: 0.3, bed: 'chew', bedVol: 0.5, phaseTempo: [1, 1.15, 1.25, 1.35], floodBed: 1.5 },
  // Raid 3, the Smeltery (roadmap Y7, docs/design/raid3.md): the Cinder Colossus in person. A slow, grand march in harmonic minor; the bed is
  // the giant's stride (two footfalls round the loop, cinders pattering down after each) and the brass is its herald.
  smeltery: { root: -17, scale: [0, 2, 3, 5, 7, 8, 11, 12], progression: [0, -4, -5, -1], bpm: 56, drone: 'sawtooth', droneLp: 900, pluck: 'brass', density: 0.3, bed: 'stride', bedVol: 0.5, phaseTempo: [1, 1.1, 1.2, 1.3], floodBed: 1.6 },
  // Raid 4, the Flue (docs/design/raid4.md): the Furnace Regent's court, from its shadow sting's world. The brass keeps the
  // shadow's stately call (a fourth, then a fifth up) in mixolydian, a major mode with a flat 7th, regal but smoke-dark, over
  // the chimney's updraft: a deep roar that pulls upward twice round the loop, with a hollow howl across the stack and fire pops.
  flue: { root: -14, scale: [0, 2, 4, 5, 7, 9, 10, 12], progression: [0, 5, -2, 7], bpm: 64, drone: 'sawtooth', droneLp: 900, pluck: 'brass', density: 0.32, bed: 'draft', bedVol: 0.45, phaseTempo: [1, 1.1, 1.2, 1.3], floodBed: 1.5 },
  hammerdeep: { root: -10, scale: [0, 2, 3, 5, 7, 9, 10, 12], progression: [0, -2, -4, -5], bpm: 88, drone: 'sawtooth', droneLp: 420, pluck: 'anvil', density: 0.3, bed: 'forge', bedVol: 0.35 },
  glarewell: { root: -5, scale: [0, 2, 4, 6, 7, 11, 12, 14, 18], progression: [0, 6, 4, -1], bpm: 66, drone: 'triangle', droneLp: 500, pluck: 'bell', density: 0.45, bed: 'shimmer', bedVol: 0.3 },
};

/**
 * Which theme a dungeon plays. Every dungeon with its own entry in THEMES plays it; the Crucible plays
 * the 'raid' theme. Kept here (pure, tested) so a merge can't quietly put a dungeon back on another's music.
 */
export function themeFor(dungeon: string): ThemeId | string {
  return dungeon === 'crucible' ? 'raid' : dungeon;
}

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
      case 'stride': {
        // The Colossus walking: two footfalls round the loop, each a deep thud with a stone crunch on top,
        // under a hot wind. The cinders that rain off each step are added below.
        hp = 0.9 * (hp + w - prev);
        prev = w;
        lp += (w - lp) * 0.02;
        const ph = (t * 2) % 1;
        const fall = Math.exp(-ph * 14) * Math.sin(2 * Math.PI * 41 * (i / rate)) * 1.3 + Math.exp(-ph * 24) * hp * 1.4;
        raw[i] = fall + lp * 0.4 + brown * 1.0;
        break;
      }
      case 'draft': {
        // The Flue's chimney: an updraft roar that swells twice round the loop, a hollow howl in the stack riding on it.
        hp = 0.97 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.08;
        const pull = 0.55 + 0.45 * Math.pow(Math.sin(t * Math.PI * 2), 2);
        const howl = Math.sin(2 * Math.PI * 174 * (i / rate)) + 0.4 * Math.sin(2 * Math.PI * 261 * (i / rate));
        raw[i] = lp * 0.9 * pull + howl * 0.05 * pull + brown * 1.3;
        break;
      }
      case 'ashStore': {
        // Drifting ash: a dry, soft hiss that drifts louder and back once round the loop; the settling grains are added below.
        hp = 0.94 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.45;
        const drift = 0.55 + 0.45 * Math.pow(Math.sin(t * Math.PI), 2);
        raw[i] = lp * 0.14 * drift + brown * 0.15;
        break;
      }
      case 'bellowsHall': {
        // Breathing bellows: two slow, airy breaths round the loop (in, then a longer out), a leather creak at each turn.
        hp = 0.96 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.2;
        const ph = (t * 2) % 1;
        const breath = ph < 0.4 ? Math.sin((Math.PI * ph) / 0.8) : Math.cos((Math.PI * (ph - 0.4)) / 1.2);
        const turn = Math.exp(-Math.abs(ph - 0.4) * 60);
        const creak = Math.sin(2 * Math.PI * 92 * (i / rate)) * (Math.sin(2 * Math.PI * 23 * (i / rate)) > 0 ? 1 : 0.2);
        raw[i] = lp * 0.4 * breath * breath + creak * 0.05 * turn + Math.sin(2 * Math.PI * 370 * (i / rate)) * 0.03 * turn + brown * 0.2;
        break;
      }
      case 'slagChannel': {
        // The channel's glow: a warm hum (low partials beating slowly) that brightens and dims twice round the loop.
        lp += (w - lp) * 0.02;
        const glow = 0.6 + 0.4 * Math.pow(Math.sin(t * Math.PI * 2), 2);
        const s = i / rate;
        const hum = Math.sin(2 * Math.PI * 110 * s) * 0.3 + Math.sin(2 * Math.PI * 165.5 * s) * 0.25 + Math.sin(2 * Math.PI * 441 * s) * 0.3 * glow + Math.sin(2 * Math.PI * 663 * s) * 0.18 * glow;
        raw[i] = hum * 0.5 * glow + lp * 0.3 + brown * 0.25;
        break;
      }
      case 'coolingYard': {
        // Steam wisps: a faint hiss with four short puffs of steam at uneven places round the loop.
        hp = 0.88 * (hp + w - prev);
        prev = w;
        const puff = [0.08, 0.31, 0.47, 0.78].reduce((m, at) => Math.max(m, t >= at && t < at + 0.07 ? Math.sin((Math.PI * (t - at)) / 0.07) : 0), 0);
        raw[i] = hp * (0.025 + 0.14 * puff * puff) + brown * 0.12;
        break;
      }
      case 'kilnShrine': {
        // Candle flicker: a hushed warm breath that wavers like a flame, a faint ringing bowl over it; tiny wick crackles below.
        lp += (w - lp) * 0.1;
        const s = i / rate;
        const flicker = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.9 * s + Math.sin(2 * Math.PI * 0.37 * s) * 2);
        const bowl = Math.sin(2 * Math.PI * 523 * s) * (0.75 + 0.25 * Math.sin(2 * Math.PI * (1 / 3) * s)) + 0.3 * Math.sin(2 * Math.PI * 1307 * s);
        raw[i] = lp * 0.25 * flicker + bowl * 0.05 + brown * 0.15;
        break;
      }
      case 'boilerRoom': {
        // Boiler room: a low simmer in the brass, and one slow steam puff off a boiler, twice round the loop.
        hp = 0.9 * (hp + w - prev);
        prev = w;
        lp += (w - lp) * 0.08;
        const ph = (t * 2) % 1;
        const puff = ph < 0.35 ? Math.pow(Math.sin((Math.PI * ph) / 0.35), 2) : 0;
        const s = i / rate;
        const simmer = Math.sin(2 * Math.PI * 196 * s) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 7 * s)) + 0.5 * Math.sin(2 * Math.PI * 392.5 * s);
        raw[i] = hp * (0.02 + 0.1 * puff) + simmer * 0.04 + lp * 0.15 + brown * 0.15;
        break;
      }
      case 'cistern': {
        // Cistern: still water, a soft lap against stone that swells and settles once round the loop; drips below.
        lp += (w - lp) * 0.3;
        hp = 0.9 * (hp + lp - prev);
        prev = lp;
        const swell = 0.4 + 0.6 * Math.pow(Math.sin(t * Math.PI), 2);
        const lap = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.5 * (i / rate));
        raw[i] = hp * 0.35 * swell * lap + brown * 0.1;
        break;
      }
      case 'pumpHall': {
        // Pump hall: the pumps stroke slowly up and down twice round the loop: a creak as each stroke turns, a muffled push of water.
        hp = 0.92 * (hp + w - prev);
        prev = w;
        lp += (w - lp) * 0.04;
        const ph = (t * 2) % 1;
        const s = i / rate;
        const creakAt = (c: number) => Math.exp(-Math.abs(ph - c) * 30);
        const creak = Math.sin(2 * Math.PI * 240 * s + Math.sin(2 * Math.PI * 31 * s) * 3) * (creakAt(0.1) + 0.7 * creakAt(0.6));
        const push = ph > 0.15 && ph < 0.5 ? Math.sin((Math.PI * (ph - 0.15)) / 0.35) : 0;
        raw[i] = creak * 0.07 + lp * 0.9 * push + brown * 0.25;
        break;
      }
      case 'anchorStore': {
        // Anchor store: the quiet room. A cold, still air with a faint low hum of chain; nothing moves.
        hp = 0.97 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.3;
        const s = i / rate;
        raw[i] = lp * 0.08 + (Math.sin(2 * Math.PI * 233 * s) + 0.6 * Math.sin(2 * Math.PI * 349 * s)) * 0.012 + brown * 0.1;
        break;
      }
      case 'lensGallery': {
        // Lens gallery: pale gold light that swells slowly once round the loop: a warm open fifth that blooms and settles.
        const s = i / rate;
        const bloom = 0.35 + 0.65 * Math.pow(Math.sin(t * Math.PI), 2);
        const pad = Math.sin(2 * Math.PI * 440 * s) + 0.7 * Math.sin(2 * Math.PI * 659.8 * s) + 0.3 * Math.sin(2 * Math.PI * 880.6 * s) * bloom;
        hp = 0.97 * (hp + w - prev);
        prev = w;
        raw[i] = pad * 0.05 * bloom + hp * 0.012 * bloom + brown * 0.1;
        break;
      }
      case 'starVault': {
        // Star vault, the quiet room: brass orreries turning slowly, a soft clockwork tick about once a second over a low violet hum.
        const s = i / rate;
        const tick = (t * 8) % 1;
        const tk = Math.exp(-tick * 160) * Math.sin(2 * Math.PI * 2100 * s) * ((Math.floor(t * 8) % 2) === 0 ? 1 : 0.6);
        const hum = Math.sin(2 * Math.PI * 233 * s) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.25 * s)) + 0.4 * Math.sin(2 * Math.PI * 277.2 * s);
        raw[i] = tk * 0.1 + hum * 0.035 + brown * 0.05;
        break;
      }
      case 'shadeColonnade': {
        // Shade colonnade: cool and still, a faint draught between broken columns with a hollow resonance; nothing moves.
        hp = 0.985 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.05;
        const s = i / rate;
        raw[i] = lp * 0.5 + Math.sin(2 * Math.PI * 196 * s) * 0.012 + Math.sin(2 * Math.PI * 392 * s) * 0.008 + brown * 0.12;
        break;
      }
      case 'mirrorHall': {
        // Mirror hall: the brightest room, a thin glassy shimmer of high partials ringing off the mirrors; still.
        const s = i / rate;
        hp = 0.8 * (hp + w - prev);
        prev = w;
        const glass = Math.sin(2 * Math.PI * 1760 * s) * (0.8 + 0.2 * Math.sin(2 * Math.PI * 0.7 * s)) + 0.6 * Math.sin(2 * Math.PI * 2637 * s) + 0.4 * Math.sin(2 * Math.PI * 3520.5 * s);
        raw[i] = glass * 0.03 + hp * 0.02 + brown * 0.08;
        break;
      }
      case 'deadHearth': {
        // Dead hearth hall: a cold chimney with no fire, a hollow low wind drawing up the dead flue twice round the loop.
        hp = 0.97 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.06;
        const draw = 0.2 + 0.8 * Math.pow(Math.sin(t * Math.PI * 2), 2);
        const s = i / rate;
        const flue = Math.sin(2 * Math.PI * 147 * s) + 0.5 * Math.sin(2 * Math.PI * 294.5 * s) + 0.25 * Math.sin(2 * Math.PI * 441 * s);
        raw[i] = lp * 0.7 * draw + flue * 0.025 * draw + brown * 0.12;
        break;
      }
      case 'rimeHall': {
        // Rime hall: frost and icicles under pale blue light that shimmers slowly: a high, cold shimmer that swells once.
        hp = 0.9 * (hp + w - prev);
        prev = w;
        const s = i / rate;
        const swell = 0.35 + 0.65 * Math.pow(Math.sin(t * Math.PI), 2);
        const ice = Math.sin(2 * Math.PI * 1318.5 * s) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 1.3 * s)) + 0.5 * Math.sin(2 * Math.PI * 1975.5 * s + Math.sin(2 * Math.PI * 0.5 * s));
        raw[i] = ice * 0.03 * swell + hp * 0.02 * swell + brown * 0.06;
        break;
      }
      case 'snowdriftCave': {
        // Snowdrift cave: hushed. A soft, muffled wind behind banked snow, one slow gust round the loop.
        lp += (w - lp) * 0.08;
        hp = 0.94 * (hp + lp - prev);
        prev = lp;
        const gust = 0.5 + 0.5 * Math.pow(Math.sin(t * Math.PI), 3);
        raw[i] = hp * 0.6 * gust + brown * 0.1;
        break;
      }
      case 'coldCrypt': {
        // Cold crypt, the quiet room: still stone air with a faint, dark resonance between the coffins; nothing moves.
        hp = 0.99 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.2;
        const s = i / rate;
        raw[i] = lp * 0.1 + (Math.sin(2 * Math.PI * 174.6 * s) + 0.5 * Math.sin(2 * Math.PI * 261.6 * s) + 0.3 * Math.sin(2 * Math.PI * 523 * s)) * 0.012 + brown * 0.08;
        break;
      }
      case 'harbourQuay': {
        // Harbour quay, the warm room: water lapping gently at the stone, three slow laps round the loop, a low warm lantern hum.
        lp += (w - lp) * 0.05;
        const ph = (t * 3) % 1;
        const lap = ph < 0.3 ? Math.pow(Math.sin((Math.PI * ph) / 0.3), 2) : 0.15 * Math.exp(-(ph - 0.3) * 6);
        const s = i / rate;
        const hum = Math.sin(2 * Math.PI * 220 * s) + 0.5 * Math.sin(2 * Math.PI * 330.4 * s);
        raw[i] = lp * 0.5 * (0.5 + 0.5 * lap) + hum * 0.04 + brown * 0.1;
        break;
      }
      case 'wreckYard': {
        // Wreck yard: grey and creaking. A slow sea swell under old hull timbers that groan twice round the loop.
        lp += (w - lp) * 0.06;
        hp = 0.95 * (hp + lp - prev);
        prev = lp;
        const s = i / rate;
        const swell = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
        const groanAt = (c: number) => Math.exp(-Math.abs(t - c) * 14);
        const groan = (Math.sin(2 * Math.PI * 176 * s + Math.sin(2 * Math.PI * 9 * s) * 4) + 0.6 * Math.sin(2 * Math.PI * 353 * s + Math.sin(2 * Math.PI * 9 * s) * 8)) * (groanAt(0.3) + 0.8 * groanAt(0.75));
        raw[i] = hp * 0.5 * swell + groan * 0.08 + brown * 0.12;
        break;
      }
      case 'kelpBed': {
        // Kelp bed: cool sea light swaying. A soft, airy wash that sways in and out twice round the loop, a cool high tone over it.
        hp = 0.9 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.15;
        const s = i / rate;
        const sway = 0.3 + 0.7 * Math.pow(Math.sin(t * Math.PI * 2), 2);
        const cool = Math.sin(2 * Math.PI * 659.3 * s) + 0.5 * Math.sin(2 * Math.PI * 987.8 * s);
        raw[i] = lp * 0.5 * sway + cool * 0.02 * sway + brown * 0.08;
        break;
      }
      case 'sluiceGate': {
        // Sluice gate, by the boss door: water pouring steadily through iron gates, a low iron ring under it; nothing else moves.
        hp = 0.95 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.25;
        const s = i / rate;
        const iron = Math.sin(2 * Math.PI * 98 * s) + 0.6 * Math.sin(2 * Math.PI * 147.3 * s) + 0.3 * Math.sin(2 * Math.PI * 392.6 * s);
        raw[i] = lp * 0.3 + iron * 0.02 + brown * 0.15;
        break;
      }
      case 'anvilHall': {
        // Anvil hall, the door guard's room: a low warm hum under the lanterns, breathing slowly once round the loop, and
        // the great anvils' faint cold ring.
        const s = i / rate;
        const breath = 0.45 + 0.55 * Math.pow(Math.sin(t * Math.PI), 2);
        const hum = Math.sin(2 * Math.PI * 196 * s) + 0.6 * Math.sin(2 * Math.PI * 293.8 * s);
        const ring = Math.sin(2 * Math.PI * 1244.5 * s) * (0.6 + 0.4 * Math.sin(2 * Math.PI * (1 / 3) * s)) + 0.5 * Math.sin(2 * Math.PI * 1866 * s);
        lp += (w - lp) * 0.06;
        raw[i] = hum * 0.035 * breath + ring * 0.008 + lp * 0.2 * breath + brown * 0.1;
        break;
      }
      case 'chainGallery': {
        // Chain gallery: heavy chains swinging slowly, a soft clink of links as each swing turns, twice round the loop.
        hp = 0.9 * (hp + w - prev);
        prev = w;
        const s = i / rate;
        const ph = (t * 2) % 1;
        const clinkAt = (c: number) => Math.exp(-Math.abs(ph - c) * 90);
        const clink = (Math.sin(2 * Math.PI * 1568 * s) + 0.6 * Math.sin(2 * Math.PI * 2093 * s)) * (clinkAt(0.05) + 0.7 * clinkAt(0.12) + 0.8 * clinkAt(0.55) + 0.5 * clinkAt(0.62));
        const sway = Math.pow(Math.sin(t * Math.PI * 2), 2);
        raw[i] = clink * 0.08 + hp * 0.006 * sway + Math.sin(2 * Math.PI * 220 * s + Math.sin(2 * Math.PI * 0.5 * s)) * 0.02 * sway + brown * 0.06;
        break;
      }
      case 'quenchTrough': {
        // Quench trough: steam lifting off dark water, a soft hiss that rises and settles three times round the loop.
        hp = 0.93 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.4;
        const ph = (t * 3) % 1;
        const lift = ph < 0.6 ? Math.pow(Math.sin((Math.PI * ph) / 0.6), 2) : 0;
        raw[i] = lp * (0.03 + 0.12 * lift) + brown * 0.12;
        break;
      }
      case 'ingotStore': {
        // Ingot store, the quiet room: still air between the stacks, a faint cold resonance of iron; nothing moves.
        hp = 0.98 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.15;
        const s = i / rate;
        raw[i] = lp * 0.04 + (Math.sin(2 * Math.PI * 233 * s) + 0.7 * Math.sin(2 * Math.PI * 311 * s)) * 0.016 + brown * 0.06;
        break;
      }
      case 'fumaroleField': {
        // Fumarole field, the door guard's room: smoke rising off the vents, a soft breathy rush that lifts four times round
        // the loop at uneven places; nothing burns.
        lp += (w - lp) * 0.12;
        hp = 0.9 * (hp + lp - prev);
        prev = lp;
        const lift = [0.04, 0.29, 0.52, 0.76].reduce((m, at) => Math.max(m, t >= at && t < at + 0.16 ? Math.sin((Math.PI * (t - at)) / 0.16) : 0), 0);
        raw[i] = hp * (0.05 + 0.3 * lift * lift) + brown * 0.12;
        break;
      }
      case 'obsidianGallery': {
        // Obsidian gallery, by the boss door: rose light breathing off black glass, a dark glassy chord that swells once.
        const s = i / rate;
        const breath = 0.3 + 0.7 * Math.pow(Math.sin(t * Math.PI), 2);
        const glass = Math.sin(2 * Math.PI * 329.6 * s) + 0.6 * Math.sin(2 * Math.PI * 493.9 * s) + 0.35 * Math.sin(2 * Math.PI * 987.8 * s) * breath;
        raw[i] = glass * 0.04 * breath + brown * 0.08;
        break;
      }
      case 'cairnWalk': {
        // Cairn walk, the quiet room: a thin cold air between stacked stones, and a faint low hum; nothing moves.
        hp = 0.9 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.25;
        raw[i] = lp * 0.12 + brown * 0.05;
        break;
      }
      case 'pumiceDrift': {
        // Pumice drift, the palest room: a soft high airy wash, like fine ash settling, that swells faintly once.
        hp = 0.75 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.5;
        const swell = 0.6 + 0.4 * Math.pow(Math.sin(t * Math.PI), 2);
        raw[i] = lp * 0.12 * swell + brown * 0.04;
        break;
      }
      case 'pressFloor': {
        // Press floor, the door guard's room: a press ram rises on a slow hydraulic hiss and settles with a soft heavy thud.
        hp = 0.92 * (hp + w - prev);
        prev = w;
        const s = i / rate;
        const rise = t < 0.55 ? Math.sin((Math.PI * t) / 1.1) : 0;
        const ds = t - 0.62;
        const thud = ds >= 0 && ds < 0.05 ? Math.exp(-ds * 60) * Math.sin(2 * Math.PI * (70 - ds * 300) * s) : 0;
        const hum = Math.sin(2 * Math.PI * 233 * s + Math.sin(2 * Math.PI * 4 * s) * 0.5) * 0.012;
        raw[i] = hp * 0.06 * rise * rise + thud * 0.5 + hum + brown * 0.12;
        break;
      }
      case 'gearRoom': {
        // Gear room, by the boss door: one great wall gear turning slowly, a low tooth-click about twice a second over a
        // brass hum.
        const s = i / rate;
        const ph = (t * 12) % 1;
        const tooth = Math.exp(-ph * 90) * (Math.sin(2 * Math.PI * 1760 * s) + 0.6 * Math.sin(2 * Math.PI * 2637 * s));
        const hum = Math.sin(2 * Math.PI * 293.7 * s) + 0.5 * Math.sin(2 * Math.PI * 440.5 * s);
        const turn = 0.5 + 0.5 * Math.pow(Math.sin(t * Math.PI * 2), 2);
        raw[i] = tooth * 0.2 * turn + hum * 0.012 + brown * 0.02;
        break;
      }
      case 'plateStore': {
        // Plate store, the quiet room: still air between stacked brass plates, a faint metal resonance; nothing moves.
        hp = 0.985 * (hp + w - prev);
        prev = w;
        lp += (hp - lp) * 0.1;
        const s = i / rate;
        raw[i] = lp * 0.06 + (Math.sin(2 * Math.PI * 277.2 * s) + 0.6 * Math.sin(2 * Math.PI * 415.3 * s) + 0.3 * Math.sin(2 * Math.PI * 830.6 * s)) * 0.012 + brown * 0.08;
        break;
      }
      case 'oilSump': {
        // Oil sump: dark, thick oil in a pit, a low sticky drone that swells faintly, and two slow glugs round the loop.
        lp += (w - lp) * 0.03;
        const s = i / rate;
        const swell = 0.6 + 0.4 * Math.pow(Math.sin(t * Math.PI), 2);
        const glugAt = (c: number) => { const d = t - c; return d >= 0 && d < 0.04 ? Math.sin((Math.PI * d) / 0.04) * Math.sin(2 * Math.PI * (180 + d * 3000) * s) : 0; };
        raw[i] = lp * 0.5 * swell + (glugAt(0.2) + 0.8 * glugAt(0.68)) * 0.12 + Math.sin(2 * Math.PI * 174.6 * s) * 0.015 * swell + brown * 0.15;
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
  const events = kind === 'draft' ? 40 : kind === 'stride' ? 60 : kind === 'chew' ? 54 : kind === 'fire' ? 70 : kind === 'hearth' ? 28 : kind === 'steam' ? 5 : kind === 'forge' ? 40 : kind === 'vents' ? 50 : kind === 'slag' ? 26 : kind === 'frost' ? 6 : 0;
  for (let k = 0; k < events; k++) {
    // Chew: the crunches land while the jaw is closing (the first 60% of each of the three chews).
    // Stride: the cinders fall in the second after each footfall (thickest right after it lands).
    const at = kind === 'stride' ? Math.floor((Math.floor(r() * 2) * 0.5 + 0.02 + Math.pow(r(), 2) * 0.3) * period) % Math.max(1, period - Math.floor(rate * 0.05)) : kind === 'chew' ? Math.floor((Math.floor(r() * 3) + r() * 0.6) * (period / 3)) % Math.max(1, period - Math.floor(rate * 0.05)) : Math.floor(r() * (period - rate * 0.3));
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
  // Halls room beds: ash grains settling, slag bubbles in the channel, wick crackles at the shrine.
  const grains = kind === 'ashStore' ? 26 : kind === 'slagChannel' ? 7 : kind === 'kilnShrine' ? 9 : kind === 'cistern' ? 9 : 0;
  for (let k = 0; k < grains; k++) {
    const at = Math.floor(r() * (period - rate * 0.3));
    // The cistern's drips are bright plinks into still water; the slag channel's bubbles are low.
    const bubble = kind === 'slagChannel' || kind === 'cistern';
    const len = Math.floor(rate * (bubble ? 0.14 : 0.006 + r() * 0.01));
    const amp = bubble ? 0.22 : kind === 'ashStore' ? 0.06 + r() * 0.08 : 0.1 + r() * 0.12;
    const f0 = kind === 'cistern' ? 900 + r() * 700 : 140 + r() * 120;
    let ph = 0;
    for (let i = 0; i < len && at + i < n; i++) {
      const env = Math.pow(1 - i / len, bubble ? 3 : 2);
      ph += (f0 * (1 + 2.5 * (i / len))) / rate;
      raw[at + i] += (bubble ? Math.sin(ph * Math.PI * 2) + 0.5 * Math.sin(ph * Math.PI * 6) : white()) * env * amp;
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

/**
 * The hub's theme for each season (SEASONS order in sim/content/season.ts). A season without a variant keeps the plain hub.
 * Entries past the end of SEASONS wait for their season (Y10 adds Seasons 7 and 8); hubThemeFor wraps before reaching them.
 */
export const HUB_BY_SEASON: (ThemeId | undefined)[] = ['hub', 'hubBellows', 'hubHearth', 'hubSlag', 'hubPress', 'hubEbb', 'hubHunger', 'hubPlate'];

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

  private room: { kind: RoomBedKind; src: AudioBufferSourceNode; gain: GainNode } | null = null;

  /** The Halls room the hero is in: its quiet bed fades in over ROOM_BED_FADE s, the last room's fades out (null: none). */
  setRoomBed(kind: RoomBedKind | null): void {
    if ((this.room?.kind ?? null) === kind) return;
    const t = this.ctx.currentTime;
    if (this.room) {
      const { src, gain } = this.room;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + ROOM_BED_FADE);
      src.stop(t + ROOM_BED_FADE + 0.1);
      setTimeout(() => gain.disconnect(), (ROOM_BED_FADE + 0.5) * 1000);
      this.room = null;
    }
    if (!kind) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.bedBuffer(kind);
    src.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(ROOM_BED_VOL, t + ROOM_BED_FADE);
    src.connect(gain).connect(this.dest);
    // Start each room's loop at a different point, so walking back into a room doesn't restart it audibly.
    src.start(t, Math.random() * (src.buffer.duration - 0.5));
    this.room = { kind, src, gain };
  }

  private halt(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
