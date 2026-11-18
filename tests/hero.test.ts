import { describe, expect, it } from 'vitest';
import { applyRun, equip, loadoutFor, newHero, PITY_LIMIT, rollLoot, salvage, spendPoint, pointsAvailable } from '../sim/hero';
import { RunSummary } from '../sim/world';

const loss: RunSummary = { victory: false, time: 200, kills: 600, level: 9, damageDealt: 20000, talents: {} };
const win: RunSummary = { victory: true, time: 540, kills: 4000, level: 15, damageDealt: 200000, talents: {} };

describe('hero', () => {
  it('rolls the same loot for the same seed', () => {
    const h = newHero();
    expect(rollLoot(5, win, h, true)).toEqual(rollLoot(5, win, h, true));
  });

  it('guarantees an Epic or better after enough dry runs', () => {
    const h = newHero();
    h.pity = PITY_LIMIT - 1;
    for (let seed = 0; seed < 50; seed++) {
      const { items } = rollLoot(seed, loss, h, false);
      expect(items.some((i) => i.rarity === 'epic' || i.rarity === 'mythic')).toBe(true);
    }
  });

  it('pays out on a loss and levels the hero', () => {
    const h = newHero();
    const r = applyRun(h, 1, loss, false);
    expect(r.items.length).toBeGreaterThanOrEqual(1);
    expect(r.heroXp).toBeGreaterThan(0);
    expect(h.runs).toBe(1);
    expect(Object.keys(h.equipped).length).toBeGreaterThan(0);
  });

  it('will not salvage equipped gear', () => {
    const h = newHero();
    applyRun(h, 2, win, true);
    const eq = h.equipped[h.inventory[0].slot]!;
    expect(salvage(h, eq)).toBe(0);
    const spare = h.inventory.find((i) => h.equipped[i.slot] !== i.id);
    if (spare) expect(salvage(h, spare.id)).toBeGreaterThan(0);
  });

  it('turns gear and points into run bonuses', () => {
    const h = newHero();
    applyRun(h, 3, win, true);
    h.level = 3;
    expect(pointsAvailable(h)).toBe(2);
    expect(spendPoint(h, 'might')).toBe(true);
    const l = loadoutFor(h);
    expect(l.dmgMult).toBeGreaterThan(1);
    for (const it of h.inventory) equip(h, it.id);
    expect(loadoutFor(h).maxHpBonus).toBeGreaterThanOrEqual(0);
  });
});
