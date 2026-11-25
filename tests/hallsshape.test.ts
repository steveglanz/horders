import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { HALLS, HallsMap } from '../sim/halls';
import { inCorridor, inRoom, roomLoops, roomPieces } from '../client/hallsshape';

const map = (): HallsMap => new World({ seed: 2, tier: 2, halls: true }).halls!;
const circ = (cx: number, cy: number, r: number, n = 32) => { const o: number[] = []; for (let k = 0; k < n; k++) { const a = (k / n) * 2 * Math.PI; o.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } return o; };

describe('Halls room outlines (client/hallsshape.ts)', () => {
  it('a room without an edge is its circle', () => {
    const m = map(), r = m.rooms[1], l = roomLoops(r);
    expect(l.length).toBe(1);
    for (let k = 0; k < l[0].length; k += 2) expect(Math.hypot(l[0][k] - r.x, l[0][k + 1] - r.y)).toBeCloseTo(r.r, 3);
    expect(inRoom(l, r.x, r.y)).toBe(true);
    expect(inRoom(l, r.x + r.r + 5, r.y)).toBe(false);
  });

  it('takes the sim edge when given, and an island is off the floor', () => {
    const m = map(), r = m.rooms[3];
    const ring = { ...r, edge: [circ(r.x, r.y, 520), circ(r.x, r.y, 160, 16)] };
    const l = roomLoops(ring);
    expect(l.length).toBe(2);
    expect(inRoom(l, r.x, r.y)).toBe(false);
    expect(inRoom(l, r.x + 300, r.y)).toBe(true);
  });

  it('turns every wall normal away from the floor, opens the doorways and keeps islands whole', () => {
    const m = map(), i = 3, r = m.rooms[i], hw = HALLS.corridor / 2;
    // A Hall whose winding runs the other way from the circle's, with a Ring's island in it.
    const hall = [r.x - 260, r.y + 450, r.x + 260, r.y + 450, r.x + 260, r.y - 450, r.x - 260, r.y - 450];
    m.rooms[i] = { ...r, edge: [hall, circ(r.x, r.y + 60, 120, 16)] } as typeof r;
    const loops = roomLoops(m.rooms[i]);
    const ps = roomPieces(m, i, hw);
    expect(ps.some((p) => p.island)).toBe(true);
    for (const p of ps) {
      expect(inRoom(loops, p.x - p.nx * 8, p.y - p.ny * 8)).toBe(true);
      expect(inRoom(loops, p.x + p.nx * 8, p.y + p.ny * 8)).toBe(false);
    }
    // No outer piece stands across a corridor that meets this room; the island's ring is complete (16 sides).
    const doors = m.corridors.map((c, ci) => (c.a === i || c.b === i ? ci : -1)).filter((ci) => ci >= 0);
    expect(doors.length).toBeGreaterThan(0);
    for (const p of ps) if (!p.island) for (const ci of doors) expect(inCorridor(m, ci, hw - 4, p.x + p.nx * 4, p.y + p.ny * 4)).toBe(false);
    expect(ps.filter((p) => p.island).length).toBe(16);
  });
});
