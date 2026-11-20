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

describe('world boss rewards', () => {
  it('grants an Epic or better and embers, once per call', async () => {
    const { grantBossReward } = await import('../sim/hero');
    const h = newHero();
    const r = grantBossReward(h, 1, 12000);
    expect(['epic', 'mythic']).toContain(r.item.rarity);
    expect(r.embers).toBe(62);
    expect(h.inventory).toContain(r.item);
    expect(h.nextItemId).toBe(2);
  });

  it('keeps the save with more progress', async () => {
    const { newerHero } = await import('../sim/hero');
    const a = newHero(); const b = newHero();
    b.runs = 3;
    expect(newerHero(a, b)).toBe(b);
    a.runs = 3; a.level = 4;
    expect(newerHero(a, b)).toBe(a);
  });
});

describe('one hero per class', () => {
  it('each class keeps its own level, gear, bags and tier', async () => {
    const { newHero, switchClass, characterOf } = await import('../sim/hero');
    const h = newHero();
    h.cls = 'emberwright';
    Object.assign(h, { level: 7, xp: 50, embers: 30, maxTier: 4, passives: { might: 3 } });
    h.inventory = [{ id: 'i1', slot: 'weapon', rarity: 'epic', ilvl: 5, name: 'Titanheart Focus', stats: [] }];
    h.equipped = { weapon: 'i1' };
    switchClass(h, 'duskblade');
    expect(h.cls).toBe('duskblade');
    expect(h.level).toBe(1);
    expect(h.inventory).toEqual([]);
    expect(h.equipped).toEqual({});
    expect(h.passives).toEqual({});
    expect(h.maxTier).toBe(1);
    expect(h.embers).toBe(0);
    h.level = 2;
    switchClass(h, 'emberwright');
    expect(h.level).toBe(7);
    expect(h.equipped).toEqual({ weapon: 'i1' });
    expect(h.passives).toEqual({ might: 3 });
    expect(h.maxTier).toBe(4);
    expect(characterOf(h, 'duskblade')?.level).toBe(2);
    expect(characterOf(h, 'bulwark')).toBeUndefined();
    expect(h.roster?.emberwright).toBeUndefined(); // the played class lives at the top level only
  });

  it('a save from before rosters keeps its progress on the class it had selected', async () => {
    const { newHero, switchClass, characterOf } = await import('../sim/hero');
    const old = { ...newHero(), cls: 'duskblade' as const, level: 2, runs: 1, wins: 1 };
    expect(characterOf(old, 'duskblade')?.level).toBe(2);
    switchClass(old, 'lumen');
    expect(old.level).toBe(1);
    expect(old.roster?.duskblade?.wins).toBe(1);
  });

  it('item ids stay unique across classes', async () => {
    const { newHero, switchClass } = await import('../sim/hero');
    const h = newHero();
    h.nextItemId = 42;
    switchClass(h, 'bulwark');
    expect(h.nextItemId).toBe(42);
  });

  it('picks the newer save by progress across every class', async () => {
    const { newHero, switchClass, newerHero } = await import('../sim/hero');
    const a = newHero();
    a.runs = 5;
    switchClass(a, 'lumen'); // a's played class now has 0 runs; 5 are in the roster
    const b = { ...newHero(), runs: 3 };
    expect(newerHero(a, b)).toBe(a);
  });

  it('weapons are named for the class that found them', async () => {
    const { makeItem } = await import('../sim/hero');
    const { Rng } = await import('../sim/rng');
    const { WEAPON_NAMES } = await import('../sim/content/items');
    for (const cls of ['emberwright', 'duskblade', 'bulwark', 'lumen'] as const) {
      const it = makeItem(new Rng(3), 'i1', 'weapon', 'rare', 4, cls);
      expect(WEAPON_NAMES[cls].some((n) => it.name.endsWith(n))).toBe(true);
      // Only the name changes: stats are the same roll for every class.
      expect(it.stats).toEqual(makeItem(new Rng(3), 'i1', 'weapon', 'rare', 4).stats);
    }
  });
});
