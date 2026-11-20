import { describe, expect, it } from 'vitest';
import { newHero, makeItem } from '../sim/hero';
import { Rng } from '../sim/rng';
import { canTemper, canUpgrade, maxForgeLevel, temperCost, temperItem, upgradeCost, upgradeItem } from '../sim/forge';

function heroWith(rarity: 'common' | 'rare' | 'epic', ilvl = 3, embers = 1000) {
  const h = newHero();
  h.level = 5;
  h.embers = embers;
  const it = makeItem(new Rng(7), 'i1', 'weapon', rarity, ilvl);
  h.inventory.push(it);
  return { h, it };
}

describe('forge', () => {
  it('upgrade raises item level, scales stats and spends embers', () => {
    const { h, it } = heroWith('rare');
    const before = it.stats.map((s) => s.value);
    const cost = upgradeCost(it);
    expect(upgradeItem(h, it.id)).toBe(true);
    expect(it.ilvl).toBe(4);
    expect(h.embers).toBe(1000 - cost);
    it.stats.forEach((s, k) => expect(s.value).toBeGreaterThan(before[k]));
    expect(h.forged).toBe(1);
  });

  it('upgrade stops at the forge cap', () => {
    const { h, it } = heroWith('epic');
    while (upgradeItem(h, it.id));
    expect(it.ilvl).toBe(maxForgeLevel(h));
    expect(canUpgrade(h, it).ok).toBe(false);
  });

  it('refuses without enough embers and changes nothing', () => {
    const { h, it } = heroWith('rare', 3, 2);
    expect(upgradeItem(h, it.id)).toBe(false);
    expect(it.ilvl).toBe(3);
    expect(h.embers).toBe(2);
  });

  it('temper rerolls one bonus stat into a new one, deterministically', () => {
    const a = heroWith('epic');
    const b = heroWith('epic');
    const r1 = temperItem(a.h, a.it.id);
    const r2 = temperItem(b.h, b.it.id);
    expect(r1).not.toBeNull();
    expect(r1).toEqual(r2);
    expect(a.it.stats).toEqual(b.it.stats);
    expect(new Set(a.it.stats.map((s) => s.stat)).size).toBe(a.it.stats.length);
    expect(a.h.embers).toBe(1000 - temperCost(a.it));
  });

  it('commons cannot be tempered', () => {
    const { h, it } = heroWith('common');
    expect(canTemper(h, it).ok).toBe(false);
    expect(temperItem(h, it.id)).toBeNull();
  });
});
