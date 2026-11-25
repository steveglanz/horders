/**
 * Phase 18 Halls H2b (design plan /mnt/project-files/horders/design/halls/h2-plan.md): a room seals once a pack in it
 * wakes. Ember grates drop across each of its doorways after a 1.0 s red glow, and lift once the room is cleared.
 * Shared by the 2D view (client/hallsview.ts) and the 3D view (client/hd2d/halls3d.ts), so both put the grates in the
 * same place. Only types and client/hallsshape.ts (itself import-free), so the 3D bundle and the main bundle can both take it.
 *
 * The sim's fields (agreed with engineering, 25 Nov): HallsRoom.lock, seconds since the room began to seal (-1 or
 * absent while open), and HallsRoom.lifted, seconds since it opened again (absent if it never sealed). Read through
 * lockOf and liftedOf so this builds before and after the fields are typed in sim/halls.ts.
 */
import type { HallsMap, HallsRoom } from '../sim/halls';
import { inLoop, roomLoops } from './hallsshape';

/** The red glow before the grates drop (design: 1.0 s). */
export const GRATE_WARN = 1.0;
/** How long the drop takes once the glow ends, and the lift once the room clears (art timings, seconds). */
export const GRATE_DROP = 0.14;
export const GRATE_LIFT = 0.45;

/** Seconds since the room began to seal, or -1 while it is open. */
export function lockOf(r: HallsRoom): number {
  const v = (r as HallsRoom & { lock?: number }).lock;
  return typeof v === 'number' && v >= 0 ? v : -1;
}

/** Seconds since the room opened again, or Infinity if it never sealed. */
export function liftedOf(r: HallsRoom): number {
  const v = (r as HallsRoom & { lifted?: number }).lifted;
  return typeof v === 'number' && v >= 0 ? v : Infinity;
}

/** One doorway of a room: its middle (world units), the way into the room (unit vector) and half its width. */
export interface Grate { room: number; x: number; y: number; ux: number; uy: number; hw: number }

/**
 * Every room's doorways: where each corridor meets the room's rim, a hair inside the corridor so the bars stand in the
 * opening, not in the wall. The boss door's alcove is left out (the boss door is its own gate).
 */
export function hallsGrates(m: HallsMap, corridor: number, doorRoom: number): Grate[] {
  const out: Grate[] = [];
  const hw = corridor / 2;
  m.corridors.forEach((c) => {
    for (const [i, j] of [[c.a, c.b], [c.b, c.a]]) {
      if (i === doorRoom) continue;
      const r = m.rooms[i], o = m.rooms[j];
      const dx = o.x - r.x, dy = o.y - r.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      // The mouth: the farthest point where either corridor side leaves the room's outline (any shape), then 10 units
      // on into the corridor.
      const outer = roomLoops(r)[0];
      let t = 0;
      for (const s of [1, -1]) {
        const sx = r.x - uy * hw * s, sy = r.y + ux * hw * s;
        let d = 0; while (d < L && inLoop(outer, sx + ux * d, sy + uy * d)) d += 2;
        t = Math.max(t, d);
      }
      t += 10;
      out.push({ room: i, x: r.x + ux * t, y: r.y + uy * t, ux: -ux, uy: -uy, hw });
    }
  });
  return out;
}

/**
 * A grate's state from its room's lock and lifted times (lockOf, liftedOf):
 * glow 0..1 (the red warning, and a low ember glow while down) and drop 0..1 (0 = up out of sight, 1 = down).
 */
export function grateState(lock: number, sinceOpen: number): { glow: number; drop: number } {
  if (lock >= 0) {
    if (lock < GRATE_WARN) return { glow: lock / GRATE_WARN, drop: 0 };
    const k = Math.min(1, (lock - GRATE_WARN) / GRATE_DROP);
    return { glow: 1 - 0.55 * k, drop: k * k };
  }
  if (sinceOpen < GRATE_LIFT) { const k = sinceOpen / GRATE_LIFT; return { glow: 0.45 * (1 - k), drop: 1 - k * (2 - k) }; }
  return { glow: 0, drop: 0 };
}
