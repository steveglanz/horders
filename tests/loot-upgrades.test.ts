import { describe, expect, it } from 'vitest';
import { equip, itemScore, lootUpgrades, makeItem, newHero } from '../sim/hero';
import { Rng } from '../sim/rng';

/** A hero wearing a mid ring and head piece; the run's loot is pushed to the bag as applyRun does. */
function setup() {
  const h = newHero();
  const rng = new Rng(7);
  h.inventory = [];
  h.equipped = {};
  const ring = makeItem(rng, 'ring', 'ring', 'rare', 20);
  const head = makeItem(rng, 'head', 'head', 'rare', 20);
  h.inventory.push(ring, head);
  h.equipped.ring = ring.id;
  h.equipped.head = head.id;
  return { h, rng };
}

describe("the end screen's Equip upgrade", () => {
  it('offers nothing when no new piece beats what you wear', () => {
    const { h, rng } = setup();
    const weak = makeItem(rng, 'weak', 'ring', 'common', 1);
    h.inventory.push(weak);
    expect(lootUpgrades(h, [weak])).toEqual([]);
  });

  it('offers a better piece with its gear score gain, and an item for an empty slot', () => {
    const { h, rng } = setup();
    const better = makeItem(rng, 'better', 'ring', 'epic', 60);
    const chest = makeItem(rng, 'chest', 'chest', 'common', 1);
    h.inventory.push(better, chest);
    const ups = lootUpgrades(h, [better, chest]);
    expect(ups.map((u) => u.item.id).sort()).toEqual(['better', 'chest']);
    const ring = h.inventory.find((i) => i.id === 'ring')!;
    expect(ups.find((u) => u.item.id === 'better')!.gain).toBeCloseTo(itemScore(better) - itemScore(ring));
  });

  it('picks the best of two new pieces for one slot, and skips one already worn', () => {
    const { h, rng } = setup();
    const a = makeItem(rng, 'a', 'ring', 'rare', 40);
    const b = makeItem(rng, 'b', 'ring', 'epic', 60);
    h.inventory.push(a, b);
    const ups = lootUpgrades(h, [a, b]);
    expect(ups).toHaveLength(1);
    expect(ups[0].item.id).toBe(itemScore(a) > itemScore(b) ? 'a' : 'b');
    equip(h, ups[0].item.id);
    expect(lootUpgrades(h, [a, b])).toEqual([]);
  });

  it('ignores loot no longer in the bag (salvaged before the tap)', () => {
    const { h, rng } = setup();
    const gone = makeItem(rng, 'gone', 'ring', 'epic', 60);
    expect(lootUpgrades(h, [gone])).toEqual([]);
  });
});
