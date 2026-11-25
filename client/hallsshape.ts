/**
 * Phase 18 Halls H2c/H2d (design plan /mnt/project-files/horders/design/halls/h2-plan.md): rooms are no longer only
 * circles. The generator gives each room a shape (Round, Hall, Cross, Ring, Twin) and its outline as HallsRoom.edge:
 * flat x,y loops in world units, the outer edge first, then any islands (the Ring's hearth). A room without an edge
 * (H1's template) is its bounding circle. Shared by the 2D and 3D looks; no imports beyond types.
 */
import type { HallsCorridor, HallsMap, HallsRoom } from '../sim/halls';

export type Loop = number[];

/** The room's outline loops: HallsRoom.edge when the sim gives one, else its circle (a point about every 70 units, the wall piece length). */
export function roomLoops(r: HallsRoom): Loop[] {
  const e = (r as HallsRoom & { edge?: number[][] }).edge;
  if (Array.isArray(e) && e.length && e[0].length >= 6) return e;
  const n = Math.max(24, Math.ceil((2 * Math.PI * r.r) / 70)), out: number[] = [];
  for (let k = 0; k < n; k++) { const a = (k / n) * 2 * Math.PI - Math.PI; out.push(r.x + Math.cos(a) * r.r, r.y + Math.sin(a) * r.r); }
  return [out];
}

/** Whether (x, y) is inside a loop (even-odd rule). */
export function inLoop(l: Loop, x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = l.length - 2; i < l.length; j = i, i += 2) {
    const xi = l[i], yi = l[i + 1], xj = l[j], yj = l[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) c = !c;
  }
  return c;
}

/** Whether (x, y) is on a room's floor: inside its outer loop and outside its islands. */
export function inRoom(loops: Loop[], x: number, y: number): boolean {
  if (!inLoop(loops[0], x, y)) return false;
  for (let k = 1; k < loops.length; k++) if (inLoop(loops[k], x, y)) return false;
  return true;
}

/**
 * Where a corridor's centre line ends: HallsCorridor ax, ay, bx, by on a generated map (40 inside each room, just past
 * its doorway, so a corridor into a Ring never cuts through the island), else the rooms' centres (H1's template).
 * The same rule as sim/halls.ts corridorEnds, kept here so the 3D bundle needs no sim code.
 */
export function corridorEnds(m: HallsMap, c: HallsCorridor): { x1: number; y1: number; x2: number; y2: number } {
  const e = c as HallsCorridor & { ax?: number; ay?: number; bx?: number; by?: number };
  const a = m.rooms[c.a], b = m.rooms[c.b];
  return { x1: e.ax ?? a.x, y1: e.ay ?? a.y, x2: e.bx ?? b.x, y2: e.by ?? b.y };
}

/** Whether (x, y) is within a corridor's floor (half its width of its centre line). */
export function inCorridor(m: HallsMap, ci: number, hw: number, x: number, y: number): boolean {
  const { x1, y1, x2, y2 } = corridorEnds(m, m.corridors[ci]), vx = x2 - x1, vy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((x - x1) * vx + (y - y1) * vy) / (vx * vx + vy * vy || 1)));
  return (x - x1 - vx * t) ** 2 + (y - y1 - vy * t) ** 2 <= hw * hw;
}

/** One wall piece: centre and length (world units), outward normal (away from the floor), and whether it rings an island. */
export interface EdgePiece { x: number; y: number; len: number; nx: number; ny: number; island: boolean }

/**
 * A room's walls as straight pieces of about `step` world units along its loops, with the normal turned away from the
 * floor whatever way the loop winds. Pieces whose middle lies in a corridor's floor are left out (the doorways).
 */
export function roomPieces(m: HallsMap, i: number, hw: number, step = 70): EdgePiece[] {
  const loops = roomLoops(m.rooms[i]), out: EdgePiece[] = [];
  const doors = m.corridors.map((c, ci) => (c.a === i || c.b === i ? ci : -1)).filter((ci) => ci >= 0);
  loops.forEach((l, li) => {
    for (let k = 0; k < l.length; k += 2) {
      const x0 = l[k], y0 = l[k + 1], x1 = l[(k + 2) % l.length], y1 = l[(k + 3) % l.length];
      const L = Math.hypot(x1 - x0, y1 - y0);
      if (L < 1e-3) continue;
      const n = Math.max(1, Math.round(L / step)), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
      let nx = uy, ny = -ux;
      // Normal away from the floor: a point a little inside along -n must be on this room's floor.
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      if (!inRoom(loops, mx - nx * 6, my - ny * 6)) { nx = -nx; ny = -ny; }
      for (let s = 0; s < n; s++) {
        const t = (s + 0.5) / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        // Doorways open the outer edge only: an island stands whole even where a corridor's line runs under it.
        if (li === 0 && doors.some((ci) => inCorridor(m, ci, hw - 2, x + nx * 4, y + ny * 4))) continue;
        out.push({ x, y, len: L / n, nx, ny, island: li > 0 });
      }
    }
  });
  return out;
}

/** Whether (x, y) is on any room's floor (the loops of every room, built once by the caller). */
export function inAnyRoom(all: Loop[][], x: number, y: number, pad = 0): boolean {
  for (const loops of all) {
    if (inRoom(loops, x, y)) return true;
    if (pad > 0 && (inRoom(loops, x + pad, y) || inRoom(loops, x - pad, y) || inRoom(loops, x, y + pad) || inRoom(loops, x, y - pad))) return true;
  }
  return false;
}
