import { describe, expect, it } from 'vitest';
import { KEYS, keyOmens, keyScale, keyStep, keyTier } from '../sim/content/keys';
import { omensFor } from '../sim/content/omens';
import { applyRun, keyLevelOf, keysOpen, newHero } from '../sim/hero';
import { World, RunSummary } from '../sim/world';

const run = (over: Partial<RunSummary>): RunSummary => ({
  victory: true, tier: 7, time: 300, kills: 80, level: 9, damageDealt: 9000, talents: {}, dungeon: 'kiln', fightsCleared: 5, ...over,
});

describe("Delver's Keys (P3)", () => {
  it('a key adds the week\'s next Omens on top of the tier\'s, one every two levels, up to all five', () => {
    const week = 2900;
    expect(keyOmens(7, week, 1)).toEqual(omensFor(7, week));
    expect(keyOmens(7, week, 2).slice(0, 2)).toEqual(omensFor(7, week));
    expect(keyOmens(7, week, 2)).toHaveLength(3);
    expect(keyOmens(7, week, 20)).toHaveLength(5);
    expect(new Set(keyOmens(7, week, 20)).size).toBe(5);
  });

  it('foes get tougher per level, and a key run plays tougher than the same delve without it', () => {
    expect(keyScale(0)).toEqual({ hp: 1, dmg: 1 });
    expect(keyScale(5).hp).toBeCloseTo(1 + 5 * KEYS.hpPerLevel, 9);
    const plain = new World({ seed: 3, tier: 7, omens: [] });
    const keyed = new World({ seed: 3, tier: 7, omens: [], keyLevel: 5 });
    expect(keyed.tierDamage / plain.tierDamage).toBeCloseTo(keyScale(5).dmg, 9);
    expect(keyed.summary().keyLevel).toBe(5);
    expect(plain.summary().keyLevel).toBeUndefined();
  });

  it('the key moves: +2 fast, +1 inside par, 0 slow, −1 on a loss, never below 1', () => {
    expect(keyStep(true, KEYS.par * KEYS.fast)).toBe(2);
    expect(keyStep(true, KEYS.par)).toBe(1);
    expect(keyStep(true, KEYS.par + 1)).toBe(0);
    expect(keyStep(false, 10)).toBe(-1);
    const h = newHero();
    h.maxTier = 8;
    expect(keysOpen(h)).toBe(true);
    expect(keyTier(h.maxTier)).toBe(7);
    expect(keyLevelOf(h, 'kiln')).toBe(1);
    let r = applyRun(h, 1, run({ keyLevel: 1, time: 200 }), false);
    expect(r.keyTo).toBe(3);
    expect(r.keyEmbers).toBe(KEYS.emberPerLevel);
    r = applyRun(h, 2, run({ keyLevel: 3, victory: false }), false);
    expect(keyLevelOf(h, 'kiln')).toBe(2);
    expect(h.keyBest?.kiln).toBe(1);
    expect(keyLevelOf(h, 'foundry')).toBe(1);
    applyRun(h, 3, run({ keyLevel: 1, victory: false, dungeon: 'foundry' }), false);
    expect(keyLevelOf(h, 'foundry')).toBe(1);
  });

  it('a key run never moves the tier ladder or Grit', () => {
    const h = newHero();
    h.maxTier = 8;
    applyRun(h, 1, run({ keyLevel: 2, tier: 8 }), false);
    expect(h.maxTier).toBe(8);
    applyRun(h, 2, run({ keyLevel: 2, victory: false }), false);
    expect(h.grit).toBeUndefined();
  });
});
