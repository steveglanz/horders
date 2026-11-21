import { describe, expect, it } from 'vitest';
import { applyRun, collectionOf, newHero, switchClass } from '../sim/hero';
import { BOOK, COLLECTION_REWARDS, COLLECTION_TUNING, entriesOf } from '../sim/content/collections';
import { MYTHICS, WEAPON_FX, Item } from '../sim/content/items';
import { SET_IDS } from '../sim/content/sets';
import type { RunSummary } from '../sim/world';

// A loss with no loot of its own (runDrops given, not a win), so only the items we hand in count.
const loss = (): RunSummary => ({ victory: false, tier: 1, time: 30, kills: 5, level: 2, damageDealt: 100, talents: {}, dungeon: 'kiln', fightsCleared: 0 });
const item = (id: string, over: Partial<Item>): Item => ({ id, slot: 'head', rarity: 'epic', ilvl: 5, name: `Test ${id}`, stats: [{ stat: 'vitality', value: 5 }], ...over });

describe('collections (P4)', () => {
  it('the book lists every set slot, Mythic and weapon effect once', () => {
    expect(BOOK.sets.map((s) => s.id)).toEqual(SET_IDS);
    expect(BOOK.mythics).toHaveLength(Object.keys(MYTHICS).length);
    expect(BOOK.weaponFx).toHaveLength(Object.keys(WEAPON_FX).length);
    expect(new Set(COLLECTION_REWARDS.map((r) => r.id)).size).toBe(COLLECTION_REWARDS.length);
    expect(entriesOf(item('a', { slot: 'weapon', rarity: 'mythic', mythic: 'giantsBane', weaponFx: 'bankedFlame' }))).toEqual(['mythic:giantsBane', 'fx:bankedFlame']);
    expect(entriesOf(item('b', { slot: 'hands', set: 'tidewalker' }))).toEqual(['set:tidewalker:hands']);
    expect(entriesOf(item('c', {}))).toEqual([]);
  });

  it('a run records new finds, and a finished set pays its embers and title once', () => {
    const h = newHero();
    const r1 = applyRun(h, 1, loss(), false, [item('s1', { slot: 'head', set: 'kilnbreaker' }), item('s2', { slot: 'hands', set: 'kilnbreaker' })]);
    expect(r1.collectionNew).toEqual(['set:kilnbreaker:hands', 'set:kilnbreaker:head']);
    expect(r1.collectionRewards).toBeUndefined();
    const embers = h.embers;
    const r2 = applyRun(h, 2, loss(), false, [item('s3', { slot: 'trinket', set: 'kilnbreaker' })]);
    expect(r2.collectionNew).toEqual(['set:kilnbreaker:trinket']);
    expect(r2.collectionRewards?.map((r) => r.id)).toEqual(['set:kilnbreaker']);
    expect(h.embers - embers).toBe(COLLECTION_TUNING.setEmbers);
    expect(h.titles).toContain('the Kilnbreaker');
    // A second copy is not new, and the reward never pays twice.
    const e2 = h.embers;
    const r3 = applyRun(h, 3, loss(), false, [item('s4', { slot: 'trinket', set: 'kilnbreaker' })]);
    expect(r3.collectionNew).toBeUndefined();
    expect(r3.collectionRewards).toBeUndefined();
    expect(h.embers).toBe(e2);
  });

  it('a find stays in the book after it is salvaged, and other classes share the book', () => {
    const h = newHero();
    applyRun(h, 1, loss(), false, [item('m1', { slot: 'ring', rarity: 'mythic', mythic: 'phoenixFeather' })]);
    h.inventory = [];
    expect(collectionOf(h).has('mythic:phoenixFeather')).toBe(true);
    switchClass(h, 'lumen');
    expect(collectionOf(h).has('mythic:phoenixFeather')).toBe(true);
  });

  it('saves from before collections count what any class still holds, and pay on the next run', () => {
    const h = newHero();
    h.inventory.push(...(['head', 'hands', 'trinket'] as const).map((slot, k) => item(`g${k}`, { slot, set: 'glarewarden' })));
    switchClass(h, 'bulwark');
    expect(h.collection).toBeUndefined();
    expect(collectionOf(h).has('set:glarewarden:trinket')).toBe(true);
    const r = applyRun(h, 1, loss(), false, []);
    expect(r.collectionNew).toBeUndefined();
    expect(r.collectionRewards?.map((x) => x.id)).toEqual(['set:glarewarden']);
    expect(h.titles).toContain('the Glarewarden');
  });

  it('half the Mythics pays, and all of them pays again with a title', () => {
    const h = newHero();
    const ids = Object.keys(MYTHICS) as (keyof typeof MYTHICS)[];
    const half = Math.ceil(ids.length / 2);
    const r1 = applyRun(h, 1, loss(), false, ids.slice(0, half).map((m, k) => item(`m${k}`, { slot: 'ring', rarity: 'mythic', mythic: m })));
    expect(r1.collectionRewards?.map((r) => r.id)).toEqual(['mythics:half']);
    const r2 = applyRun(h, 2, loss(), false, ids.slice(half).map((m, k) => item(`n${k}`, { slot: 'ring', rarity: 'mythic', mythic: m })));
    expect(r2.collectionRewards?.map((r) => r.id)).toEqual(['mythics:all']);
    expect(h.titles).toContain('the Mythbound');
  });
});
