import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { DOOR_ROOM, HALLS, inside } from '../sim/halls';
import { inCorridor, inRoom, roomLoops } from '../client/hallsshape';
import { GRATE_DROP, GRATE_LIFT, GRATE_WARN, grateState, hallsGrates, liftedOf, lockOf } from '../client/hallsgrates';

describe('Halls H2b ember grates (client/hallsgrates.ts)', () => {
  const m = new World({ seed: 2, tier: 2, halls: true }).halls!;
  const grates = hallsGrates(m, HALLS.corridor, DOOR_ROOM);

  it('puts a grate in every doorway but the boss door alcove, standing on the floor and facing into its room', () => {
    // Each corridor has a grate at each end, less the alcove's end.
    const toDoor = m.corridors.filter((c) => c.a === DOOR_ROOM || c.b === DOOR_ROOM).length;
    expect(grates.length).toBe(m.corridors.length * 2 - toDoor);
    for (const g of grates) {
      expect(g.room).not.toBe(DOOR_ROOM);
      expect(inside(m, g.x, g.y)).toBe(true);
      // A step along its inward direction moves toward its room's centre.
      const r = m.rooms[g.room];
      expect(Math.hypot(g.x + g.ux * 50 - r.x, g.y + g.uy * 50 - r.y)).toBeLessThan(Math.hypot(g.x - r.x, g.y - r.y));
    }
  });

  it('reads the sim fields, open when absent', () => {
    const r = { ...m.rooms[1] };
    expect(lockOf(r)).toBe(-1);
    expect(liftedOf(r)).toBe(Infinity);
    expect(lockOf({ ...r, lock: 0.4 } as typeof r)).toBe(0.4);
    expect(lockOf({ ...r, lock: -1 } as typeof r)).toBe(-1);
    expect(liftedOf({ ...r, lifted: 0.2 } as typeof r)).toBe(0.2);
  });

  it('glows for the 1 s warning with the bars up, drops them after it, and sinks them once the room opens', () => {
    expect(grateState(-1, Infinity)).toEqual({ glow: 0, drop: 0 });
    const warn = grateState(GRATE_WARN * 0.5, Infinity);
    expect(warn.drop).toBe(0);
    expect(warn.glow).toBeCloseTo(0.5);
    expect(grateState(GRATE_WARN - 0.01, Infinity).drop).toBe(0);
    expect(grateState(GRATE_WARN + GRATE_DROP, Infinity).drop).toBe(1);
    expect(grateState(30, Infinity).drop).toBe(1);
    const mid = grateState(-1, GRATE_LIFT / 2);
    expect(mid.drop).toBeGreaterThan(0);
    expect(mid.drop).toBeLessThan(1);
    expect(grateState(-1, GRATE_LIFT)).toEqual({ glow: 0, drop: 0 });
  });

  it('stands just outside a shaped room, in the corridor', () => {
    const mm = new World({ seed: 2, tier: 2, halls: true }).halls!, i = 1, r = mm.rooms[i];
    mm.rooms[i] = { ...r, edge: [[r.x - 250, r.y - 430, r.x + 250, r.y - 430, r.x + 250, r.y + 430, r.x - 250, r.y + 430]] } as typeof r;
    const loops = roomLoops(mm.rooms[i]);
    const mine = hallsGrates(mm, HALLS.corridor, DOOR_ROOM).filter((g) => g.room === i);
    expect(mine.length).toBeGreaterThan(0);
    for (const g of mine) {
      expect(inRoom(loops, g.x, g.y)).toBe(false);
      // A slanted doorway: the far side leaves the outline last, so the room starts within half a corridor of the bars.
      expect(inRoom(loops, g.x + g.ux * (g.hw + 12), g.y + g.uy * (g.hw + 12))).toBe(true);
      expect(mm.corridors.some((_, ci) => inCorridor(mm, ci, HALLS.corridor / 2, g.x, g.y))).toBe(true);
    }
  });
});
