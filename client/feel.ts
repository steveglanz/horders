/**
 * The hit-feel kit (1.0 vision v2, Checkpoint 2 item 3; docs/design/vision/vision.md section 3, item 2): how a hit you
 * land, a kill and a blow you take feel, all in this one table. GameScene (the 2D look and the 3D view's overlay),
 * the 3D view (client/hd2d/renderer.ts) and haptics (client/audio/haptics.ts) all read it, so a feel tweak is one edit.
 *
 * Pillar 4 "big in the hand". Everything here is drawn only: the simulation never moves a foe for knockback and never
 * waits for hit-stop beyond the frozen frame, so balance and co-op stay exactly as they are. Hit-stop is solo only
 * (co-op never stalls the shared run). The test scene (tools/feelclips.cjs) records a clip of every size below, so
 * Steve can settle the hit-stop length on his phone; `?feelstop=<ms>` overrides the heavy hit's stop to try values.
 */
import { MASTER } from './style';

/** A hit you land: an ordinary hit, a crit, or a heavy crit (at least HEAVY_X times your average hit this run). */
export type HitSize = 'tap' | 'crit' | 'heavy';
/** A foe falling: trash and elites, a rare or the Cinder Brute, a boss (the boss keeps its own fall, bossDeath). */
export type KillSize = 'kill' | 'bigKill' | 'bossKill';
/** A blow your own hero takes (20 or more is big, as before). */
export type HurtSize = 'hurt' | 'hurtBig';
export type FeelSize = HitSize | KillSize | HurtSize;

export interface Feel {
  /** How long the foe shows its white flash, ms (vision: 60 to 80 ms). 0 = none. */
  flashMs: number;
  /** How far a normal foe's body is pushed back, world units (drawn only), and how long the push and return take, ms. */
  knock: number;
  knockMs: number;
  /** Hit-stop: the frame holds this long, ms (vision: 40 to 90 ms on big hits). Solo only. */
  stopMs: number;
  /** Screen shake strength (GameScene.shake, seconds of decay; 0.1 is a nudge, 0.4 a hard hit). Scaled by the setting. */
  shake: number;
  /** The damage number, or null for none. Small, and never a signal colour (style.ts SIGNAL). */
  num: { size: number; color: string } | null;
  /** Phone vibration pattern (ms on, off, on...), or null. Android only: iOS browsers have no vibration. */
  buzz: number[] | null;
  /** Clay shards the kill leaves on the floor. */
  shards: number;
}

/** A crit this many times your average hit (this run) is a heavy hit and gets the hit-stop. */
export const HEAVY_X = 2;

/** Damage number colours: bone white for an ordinary hit, white-hot ember for a crit. Neither is a SIGNAL colour. */
const NUM_HIT = MASTER.hearth[1];
const NUM_CRIT = MASTER.fire[4];

export const FEEL: Record<FeelSize, Feel> = {
  tap: { flashMs: 70, knock: 4, knockMs: 110, stopMs: 0, shake: 0, num: { size: 11, color: NUM_HIT }, buzz: [8], shards: 0 },
  crit: { flashMs: 80, knock: 7, knockMs: 130, stopMs: 0, shake: 0.06, num: { size: 14, color: NUM_CRIT }, buzz: [12], shards: 0 },
  heavy: { flashMs: 80, knock: 11, knockMs: 150, stopMs: 60, shake: 0.14, num: { size: 17, color: NUM_CRIT }, buzz: [22], shards: 0 },
  kill: { flashMs: 0, knock: 0, knockMs: 0, stopMs: 0, shake: 0, num: null, buzz: null, shards: 6 },
  bigKill: { flashMs: 0, knock: 0, knockMs: 0, stopMs: 80, shake: 0.4, num: null, buzz: [30, 40, 30], shards: 12 },
  bossKill: { flashMs: 0, knock: 0, knockMs: 0, stopMs: 200, shake: 0.7, num: null, buzz: [90, 60, 140], shards: 18 },
  hurt: { flashMs: 0, knock: 0, knockMs: 0, stopMs: 0, shake: 0.08, num: null, buzz: [25], shards: 0 },
  hurtBig: { flashMs: 0, knock: 0, knockMs: 0, stopMs: 0, shake: 0.3, num: null, buzz: [45], shards: 0 },
};

/** The interrupt's own buzz: a short double tap, so it feels unlike any hit. */
export const BUZZ_INTERRUPT = [20, 40, 35];

/** How white the flash is by foe rank, 0 to 1. Rares and bosses brighten instead (GameScene, renderer): hit nonstop, a white boss would hide its tells. */
export const FLASH_MIX: Record<'normal' | 'elite', number> = { normal: 0.8, elite: 0.6 };

/** Only normal foes are pushed: an elite plants its feet, a boss never moves. */
export const KNOCK_RANKS: ReadonlySet<string> = new Set(['normal']);

/** The shortest gap between two heavy-hit stops (ms), so a flurry of crits never stutters the fight. */
export const STOP_GAP_MS = 350;

/** Which size a hit you land is. `avg` is your average hit so far (0 before the first). */
export function hitSize(amount: number, crit: boolean, avg: number): HitSize {
  if (!crit) return 'tap';
  return avg > 0 && amount >= HEAVY_X * avg ? 'heavy' : 'crit';
}

/** Your running average hit, so "heavy" means heavy for your hero at this tier, not a fixed number. */
export class HitScale {
  avg = 0;
  private n = 0;
  /** Reads the size of this hit, then counts it (a crit is judged against the hits before it). */
  size(amount: number, crit: boolean): HitSize {
    const s = hitSize(amount, crit, this.avg);
    this.n = Math.min(this.n + 1, 60);
    this.avg += (amount - this.avg) / this.n;
    return s;
  }
}

/** Which size a kill is, from the foe's rank (the Cinder Brute is a rare in all but name). */
export function killSize(rank: string, kind: string): KillSize {
  if (rank === 'boss') return 'bossKill';
  return rank === 'rare' || kind === 'cinderBrute' ? 'bigKill' : 'kill';
}

/** The knockback curve: out fast (the first quarter), then eased back to where the foe stands. 0 to 1. */
export function knockCurve(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  if (u < 0.25) return u / 0.25;
  const v = (u - 0.25) / 0.75;
  return (1 - v) * (1 - v);
}

/** `?feelstop=<ms>` overrides the heavy hit's stop (the test scene and Steve's phone check), clamped to 0 to 150 ms. */
export function applyFeelParams(search: string): void {
  const v = new URLSearchParams(search).get('feelstop');
  if (v === null || v === '' || !Number.isFinite(+v)) return;
  FEEL.heavy.stopMs = Math.max(0, Math.min(150, Math.round(+v)));
}
