/**
 * L6 save migration: saves written by older builds must still load with
 * nothing lost. Each fixture is the shape an earlier build actually wrote
 * (see the HeroProfile history in sim/hero.ts).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadHero, resetHero, saveHero } from '../client/save';
import { applyRun, characterOf, gearScore, loadoutFor, switchClass } from '../sim/hero';
import { RunSummary } from '../sim/world';

const KEY = 'horders.hero.v1';
const win: RunSummary = { victory: true, time: 540, kills: 4000, level: 15, damageDealt: 200000, talents: {} };

let store: Record<string, string>;
let broken = false;
beforeEach(() => {
  store = {};
  broken = false;
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => { if (broken) throw new Error('blocked'); return k in store ? store[k] : null; },
    setItem: (k: string, v: string) => { if (broken) throw new Error('blocked'); store[k] = v; },
    removeItem: (k: string) => { if (broken) throw new Error('blocked'); delete store[k]; },
  };
});
afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });

const sword = { id: 'i1', slot: 'weapon', rarity: 'rare', ilvl: 12, name: 'Old Blade', stats: [{ stat: 'power', value: 6 }] };
const helm = { id: 'i2', slot: 'head', rarity: 'common', ilvl: 8, name: 'Old Cap', stats: [{ stat: 'vitality', value: 10 }] };

/** The first save shape (the prototype): no class, roster or any later field. */
const firstShape = {
  version: 1, level: 7, xp: 140, passives: { might: 2, fortitude: 1 }, embers: 95,
  inventory: [sword, helm], equipped: { weapon: 'i1', head: 'i2' },
  pity: 3, runs: 22, wins: 4, bestTime: 512, nextItemId: 3, maxTier: 2,
};

describe('L6 save migration', () => {
  it('a first-shape save loads with every field kept and plays on as an Emberwright', () => {
    store[KEY] = JSON.stringify(firstShape);
    const h = loadHero();
    expect(h).toMatchObject(firstShape);
    expect(h.cls).toBeUndefined();
    expect(characterOf(h, 'emberwright')?.level).toBe(7);
    const l = loadoutFor(h);
    expect(l.dmgMult).toBeCloseTo(1.06 * 1.06);
    expect(l.maxHpBonus).toBe(18);
    expect(gearScore(h)).toBeGreaterThan(0);
    applyRun(h, 9, win, true);
    expect(h.runs).toBe(23);
    expect(h.inventory.length).toBeGreaterThan(2);
  });

  it('switching class on an old save keeps the first character and the shared purse', () => {
    store[KEY] = JSON.stringify(firstShape);
    const h = loadHero();
    switchClass(h, 'bulwark');
    expect(h.level).toBe(1);
    expect(h.embers).toBe(95);
    switchClass(h, 'emberwright');
    expect(h).toMatchObject({ level: 7, xp: 140, runs: 22, wins: 4, maxTier: 2, equipped: { weapon: 'i1', head: 'i2' } });
  });

  it('a pre-P5 roster save folds each class purse in once, across save and reload', () => {
    store[KEY] = JSON.stringify({
      ...firstShape, cls: 'duskblade', embers: 10,
      roster: {
        emberwright: { level: 7, xp: 0, passives: {}, inventory: [], equipped: {}, pity: 0, runs: 5, wins: 1, bestTime: 0, maxTier: 2, embers: 25 },
        lumen: { level: 3, xp: 0, passives: {}, inventory: [], equipped: {}, pity: 0, runs: 2, wins: 0, bestTime: 0, maxTier: 1, embers: 7 },
      },
    });
    const h = loadHero();
    expect(h.embers).toBe(42);
    expect(saveHero(h)).toBe(true);
    const again = loadHero();
    expect(again.embers).toBe(42);
    expect(again.roster?.lumen?.level).toBe(3);
    expect(again.roster?.emberwright?.runs).toBe(5);
  });

  it('a save missing newer fields gets their defaults, not undefined crashes', () => {
    const { nextItemId: _n, maxTier: _m, ...partial } = firstShape;
    store[KEY] = JSON.stringify(partial);
    const h = loadHero();
    expect(h.nextItemId).toBe(1);
    expect(h.maxTier).toBe(1);
    expect(h.level).toBe(7);
  });

  it('unreadable, foreign or blocked storage gives a fresh hero instead of an error', () => {
    store[KEY] = '{not json';
    expect(loadHero().level).toBe(1);
    store[KEY] = JSON.stringify({ ...firstShape, version: 2 });
    expect(loadHero().level).toBe(1);
    store[KEY] = JSON.stringify({ ...firstShape, inventory: null });
    expect(loadHero().level).toBe(1);
    broken = true;
    expect(loadHero().level).toBe(1);
    expect(saveHero(loadHero())).toBe(false);
    expect(resetHero().level).toBe(1);
  });
});
