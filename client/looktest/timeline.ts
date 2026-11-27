// style: palette-only
/**
 * Look test (1.0 vision v2, Checkpoint 2, visuals queue item 3). Pillars 4 (big in the hand) and 5 (one world, made by hand).
 * One 15-second fight in one Kiln room, scripted, so the low-poly diorama (diorama.ts) and the pixel-art
 * version (pixel.ts) play exactly the same moments and a blind pick compares only the look.
 *
 * World units, seconds. x runs right, z runs toward the camera (down the phone screen). The room floor
 * spans x -2.6..2.6, z -4.5..4.5; the exit door is in the back wall at x 1.6.
 */

export const CLIP_SEC = 15;

export const ROOM = { halfW: 2.6, halfD: 4.5, wallH: 2.2, door: { x: 1.6, w: 1.2 } } as const;

export type HeroState = 'idle' | 'move' | 'roll' | 'swing';
export type FoeState = 'sleep' | 'wake' | 'idle' | 'windup' | 'slam' | 'dead';

export interface HeroPose { x: number; z: number; face: number; state: HeroState; st: number; dur: number; speed: number }
export interface FoePose { x: number; z: number; face: number; state: FoeState; st: number; dur: number; hitT: number; knock: number }
export interface Telegraph { x: number; z: number; r: number; k: number }

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
export const easeOutQuad = (k: number) => 1 - (1 - k) * (1 - k);
export const easeOutBack = (k: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };

/** Hero moves: [start, end, x0, z0, x1, z1, kind]. Between moves the hero stands (idle or swing). */
const MOVES: [number, number, number, number, number, number, 'move' | 'roll'][] = [
  [1.4, 3.2, -0.4, 3.0, 0.0, 0.7, 'move'],
  [4.0, 4.42, 0.0, 0.7, 1.7, 1.0, 'roll'],
  [4.95, 5.6, 1.7, 1.0, 1.15, -1.05, 'move'],
  [7.95, 8.37, 1.15, -1.05, -0.9, -0.45, 'roll'],
  [8.95, 9.3, -0.9, -0.45, -0.55, -1.25, 'move'],
  [11.3, 13.4, -0.55, -1.25, 1.6, -3.55, 'move'],
];
/** Hero swing starts; each hit lands HIT_DELAY later. The last one kills. */
export const SWINGS = [5.65, 6.3, 6.95, 7.6, 9.35, 9.95];
export const HIT_DELAY = 0.2;
export const SWING_SEC = 0.42;
export const KILL_T = SWINGS[SWINGS.length - 1] + HIT_DELAY;

export const FOE_HOME = { x: 0.3, z: -1.9 };
export const WAKE_T = 3.1;
/** Foe slams: wind-up start, strike time, and where the danger zone sits. */
export const SLAMS = [
  { start: 3.35, strike: 4.55, x: 0.05, z: 0.55, r: 1.25 },
  { start: 7.55, strike: 8.6, x: 1.0, z: -0.95, r: 1.25 },
];
export const SLAM_SEC = 0.35;
/** Stand-here ring at the exit once the room is clear. */
export const STAND = { x: 1.6, z: -3.55, on: KILL_T + 0.6 };

export function heroAt(t: number): HeroPose {
  let x = MOVES[0][2], z = MOVES[0][3], face = -Math.PI / 2;
  for (const [a, b, x0, z0, x1, z1, kind] of MOVES) {
    const f = Math.atan2(z1 - z0, x1 - x0);
    if (t < a) break;
    if (t <= b) {
      const k = kind === 'roll' ? easeOutQuad((t - a) / (b - a)) : easeInOut((t - a) / (b - a));
      const speed = Math.hypot(x1 - x0, z1 - z0) / (b - a);
      return { x: x0 + (x1 - x0) * k, z: z0 + (z1 - z0) * k, face: f, state: kind, st: t - a, dur: b - a, speed };
    }
    x = x1; z = z1; face = f;
  }
  const foe = foeAt(t);
  if (foe.state !== 'dead' || t < KILL_T + 0.5) face = Math.atan2(foe.z - z, foe.x - x);
  for (const s of SWINGS) if (t >= s && t < s + SWING_SEC) return { x, z, face, state: 'swing', st: t - s, dur: SWING_SEC, speed: 0 };
  if (t > 13.4) face = -Math.PI / 2;
  return { x, z, face, state: 'idle', st: t, dur: 0, speed: 0 };
}

export function foeAt(t: number): FoePose {
  const hits = SWINGS.map((s) => s + HIT_DELAY).filter((h) => h <= t);
  const hitT = hits.length ? t - hits[hits.length - 1] : 99;
  // Knockback adds up per hit and drifts back home slowly.
  let knock = 0;
  for (const h of hits) knock += 0.25 * Math.exp(-(t - h) / 0.9);
  const { x, z } = FOE_HOME;
  const hero = heroAtNoFoe(t);
  const face = Math.atan2(hero.z - z, hero.x - x);
  const base = { x, z, face, hitT, knock };
  if (t >= KILL_T) return { ...base, state: 'dead', st: t - KILL_T, dur: 0 };
  if (t < WAKE_T) return { ...base, face: Math.PI / 2, state: 'sleep', st: t, dur: WAKE_T };
  if (t < WAKE_T + 0.25) return { ...base, face: Math.PI / 2 + (face - Math.PI / 2) * clamp01((t - WAKE_T) / 0.25), state: 'wake', st: t - WAKE_T, dur: 0.25 };
  for (const s of SLAMS) {
    const f = Math.atan2(s.z - z, s.x - x);
    if (t >= s.start && t < s.strike) return { ...base, face: f, state: 'windup', st: t - s.start, dur: s.strike - s.start };
    if (t >= s.strike && t < s.strike + SLAM_SEC) return { ...base, face: f, state: 'slam', st: t - s.strike, dur: SLAM_SEC };
  }
  return { ...base, state: 'idle', st: t, dur: 0 };
}

/** The hero's position only (no facing toward the foe), used by the foe to face the hero. */
function heroAtNoFoe(t: number) {
  let x = MOVES[0][2], z = MOVES[0][3];
  for (const [a, b, x0, z0, x1, z1] of MOVES) {
    if (t < a) break;
    if (t <= b) { const k = (t - a) / (b - a); return { x: x0 + (x1 - x0) * k, z: z0 + (z1 - z0) * k }; }
    x = x1; z = z1;
  }
  return { x, z };
}

/** The danger zone during a wind-up; k runs 0..1 over the tell (at least MIN_WARNING_SEC). */
export function telegraphAt(t: number): Telegraph | null {
  for (const s of SLAMS) if (t >= s.start && t < s.strike) return { x: s.x, z: s.z, r: s.r, k: (t - s.start) / (s.strike - s.start) };
  return null;
}

/** Camera shake amount 0..1 (slams and the kill). */
export function shakeAt(t: number): number {
  let v = 0;
  for (const s of SLAMS) if (t >= s.strike && t < s.strike + 0.18) v = Math.max(v, 0.6 * (1 - (t - s.strike) / 0.18));
  if (t >= KILL_T && t < KILL_T + 0.25) v = Math.max(v, 1 - (t - KILL_T) / 0.25);
  return v;
}

/** Hit-stop: the game holds for a few frames on the killing blow (feel.ts uses the same idea). */
export const HITSTOP_SEC = 0.07;

/** Deterministic random for shard and ember paths, so both versions and every re-render match. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let r = Math.imul(s ^ (s >>> 15), 1 | s); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
