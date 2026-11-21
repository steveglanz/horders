/**
 * Phone vibration for the moments you should feel: taking a big hit, a boss
 * winding up something deadly, Anvilfall picking you. Uses navigator.vibrate,
 * which Android browsers support and iOS Safari does not (there the toggle is
 * hidden and nothing happens).
 *
 * The mapping is pure so it can be tested; `Haptics` does the throttled call.
 */
import type { SimEvent } from '../../sim/world';
import type { CueContext } from './cues';

/** A vibrate pattern: on, off, on... in milliseconds. */
export type Buzz = number[];

export const BUZZ = {
  hurt: [18],
  hurtBig: [45],
  telegraph: [30, 70, 30],
  targeted: [70, 50, 70, 50, 140],
  bossSpawn: [90, 60, 90],
  phase: [50, 40, 110],
  levelUp: [20, 40, 20],
  down: [160],
  interrupt: [25],
} satisfies Record<string, Buzz>;

/** What a simulation event feels like, if anything. Only your own hero's hits buzz. */
export function buzzFor(ev: SimEvent, c: CueContext): Buzz | null {
  const mine = (hero?: number) => hero === undefined || hero === c.acting;
  switch (ev.type) {
    case 'playerHurt':
      if (!mine(ev.hero)) return null;
      return ev.amount >= 20 ? BUZZ.hurtBig : BUZZ.hurt;
    case 'castStart': return BUZZ.telegraph;
    case 'bossSpawn': return BUZZ.bossSpawn;
    case 'phase': return BUZZ.phase;
    case 'levelUp': return mine(ev.hero) ? BUZZ.levelUp : null;
    case 'interrupt': return BUZZ.interrupt;
    case 'burnout': return ev.warn ? BUZZ.telegraph : BUZZ.hurtBig;
    case 'slam':
    case 'glare': return BUZZ.hurtBig;
  }
  return null;
}

/** Shortest gap between two buzzes, so a flurry of hits doesn't become one long drone. */
const GAP_MS = 140;

export class Haptics {
  /** False on devices without vibration (iOS, desktop). */
  readonly supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  enabled = true;
  private last = -1e9;
  /** Higher-priority patterns (longer) may cut in on a short one. */
  private lastLen = 0;

  buzz(p: Buzz | null, now = performance.now()): void {
    if (!p || !this.enabled || !this.supported) return;
    const len = p.reduce((a, b) => a + b, 0);
    if (now - this.last < GAP_MS && len <= this.lastLen) return;
    this.last = now;
    this.lastLen = len;
    try {
      navigator.vibrate(p);
    } catch {
      // Some browsers throw before the first tap; the next buzz will try again.
    }
  }
}
