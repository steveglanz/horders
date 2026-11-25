import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { DOOR_ROOM, HALLS, HallsMap } from '../sim/halls';
import { THEMES, themeOf, themeSpots } from '../client/hallsthemes';

/** H1's hand-made map (on a generated map this would need hallsTemplate: true once that option exists). */
const map = (): HallsMap => new World({ seed: 2, tier: 2, halls: true, ...({ hallsTemplate: true } as object) }).halls!;

describe('Halls H2d room themes (client/hallsthemes.ts)', () => {
  it('takes HallsRoom.theme when the generator gives one, and the fallback never puts one theme in two rooms side by side', () => {
    const m = map();
    for (const c of m.corridors) expect(themeOf(m, c.a).id).not.toBe(themeOf(m, c.b).id);
    m.rooms[1] = { ...m.rooms[1], theme: 'shrine' } as (typeof m.rooms)[number];
    expect(themeOf(m, 1).id).toBe('shrine');
    m.rooms[1] = { ...m.rooms[1], theme: 'nonsense' } as (typeof m.rooms)[number];
    expect(Object.keys(THEMES)).toContain(themeOf(m, 1).id);
  });

  it('lights no room green, and none red enough to read as danger (red is bad, green is good)', () => {
    for (const th of Object.values(THEMES)) {
      const n = parseInt(th.light.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
      expect(g > r && g > b).toBe(false);
      expect(g).toBeGreaterThan(r * 0.45);
    }
  });

  it('stands props only along far and side walls, at most 7 a room, none in the boss door alcove', () => {
    const m = map();
    expect(themeSpots(m, DOOR_ROOM, HALLS.corridor / 2, DOOR_ROOM)).toEqual([]);
    for (let i = 0; i < m.rooms.length; i++) {
      const s = themeSpots(m, i, HALLS.corridor / 2, DOOR_ROOM);
      expect(s.length).toBeLessThanOrEqual(7);
      for (const p of s) { expect(p.island).toBe(false); expect(p.ny).toBeLessThan(0.35); }
    }
  });
});
