import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { applyRun, newHero, gritFor } from '../sim/hero';
import { partyHealth, gritMult, GRIT, clampParty } from '../sim/content/scaling';

describe('group and adaptive scaling', () => {
  it('party health grows a little slower than linearly and clamps to 1..4', () => {
    expect([1, 2, 3, 4].map((n) => Number(partyHealth(n).toFixed(3)))).toEqual([1, 1.775, 2.5, 3.175]);
    expect(clampParty(0)).toBe(1);
    expect(clampParty(9)).toBe(4);
  });

  it('enemy health in the sim follows party size', () => {
    const solo = new World({ seed: 1, omens: [] });
    const duo = new World({ seed: 1, omens: [], partySize: 2 });
    const firstHp = (w: World) => { while (!w.enemies.some((e) => e.alive)) w.step({ x: 0, y: 0 }); return w.enemies.find((e) => e.alive)!.maxHp; };
    expect(firstHp(duo) / firstHp(solo)).toBeCloseTo(partyHealth(2));
  });

  it('grit stacks on losses at the same dungeon and tier, caps, and clears on a win', () => {
    const h = newHero();
    const loss = { victory: false, tier: 2, dungeon: 'kiln' as const, time: 60, kills: 3, level: 2, damageDealt: 100, talents: {} };
    for (let k = 0; k < 5; k++) applyRun(h, k + 1, loss, false);
    expect(gritFor(h, 'kiln', 2)).toBe(GRIT.maxStacks);
    expect(gritFor(h, 'kiln', 3)).toBe(0);
    applyRun(h, 9, { ...loss, tier: 3 }, false);
    expect(gritFor(h, 'kiln', 3)).toBe(1);
    expect(gritFor(h, 'kiln', 2)).toBe(0);
    applyRun(h, 10, { ...loss, tier: 3, victory: true }, false);
    expect(gritFor(h, 'kiln', 3)).toBe(0);
  });

  it('grit raises hero health and damage', () => {
    const a = new World({ seed: 1, omens: [] });
    const b = new World({ seed: 1, omens: [], grit: 2 });
    expect(b.player.maxHp / a.player.maxHp).toBeCloseTo(gritMult(2), 1);
    expect(b.dmgMult / a.dmgMult).toBeCloseTo(gritMult(2));
  });
});
