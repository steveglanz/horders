/**
 * Round-robin variants for the sounds a fight repeats most (hits, swings, kills, motes).
 * Pitch jitter alone makes a fast run of the same hit sound like a machine gun: the
 * timbre never changes. Each variant here nudges a recipe's pitches, sweep, length and
 * filter by a few percent, and renders with its own noise seed, so no two in a row are
 * the same. Variant 0 is the recipe itself. Pure, so it can be tested.
 */
import type { Recipe } from './synth';
import type { SoundId } from './sounds';

/** How many takes each busy sound gets (others play their one recipe). */
export const VARIANTS: Partial<Record<SoundId, number>> = {
  hit: 4, crit: 3, swing: 4, kill: 3, mote: 3, slagLob: 3, heal: 3,
  // The busiest class ability sounds on the screen hero (tools/busycheck.ts, Crucible, t8 heroes, 2 runs of about 450 s):
  // Bulwark's slam 557, Emberwright's wave 451, Lumen's burst 388 plays; next were Duskblade's execute 197 and dash 196.
  bulwarkSlam: 3, emberWave: 3, lumenBurst: 3,
};

// Per-take offsets: [pitch, sweep end, length, filter], each within ±8%.
const NUDGE: [number, number, number, number][] = [
  [0, 0, 0, 0],
  [0.05, -0.04, 0.06, -0.08],
  [-0.04, 0.06, -0.05, 0.07],
  [0.02, 0.08, 0.08, -0.04],
];

/** Take `k` of a recipe (k = 0 is the recipe unchanged). */
export function variantOf(r: Recipe, k: number): Recipe {
  if (k <= 0) return r;
  const [p, s, d, f] = NUDGE[k % NUDGE.length];
  return r.map((v) => ({
    ...v,
    f: v.f * (1 + p),
    ...(v.f2 !== undefined ? { f2: v.f2 * (1 + p + s) } : {}),
    dur: v.dur * (1 + d),
    ...(v.lp !== undefined ? { lp: v.lp * (1 + f) } : {}),
    ...(v.lp2 !== undefined ? { lp2: v.lp2 * (1 + f) } : {}),
  }));
}

/** The next take to play: never the one just played (`last`), from `n` takes. `rnd` is 0..1. */
export function nextTake(n: number, last: number, rnd: number): number {
  if (n <= 1) return 0;
  const k = Math.floor(rnd * (n - 1));
  return k >= last ? k + 1 : k;
}
