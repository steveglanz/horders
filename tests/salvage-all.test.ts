import { describe, expect, it } from 'vitest';
import { makeItem, newHero, salvageAll, salvageAllPlan } from '../sim/hero';
import { RARITY } from '../sim/content/items';
import { Rng } from '../sim/rng';

/** A hero wearing a strong ring and head piece, with a bag of spares around them. */
function setup() {
  const h = newHero();
  h.embers = 0;
  const rng = new Rng(3);
  h.inventory = [];
  h.equipped = {};
  const ring = makeItem(rng, 'ring', 'ring', 'rare', 20);
  const head = makeItem(rng, 'head', 'head', 'rare', 20);
  h.inventory.push(ring, head);
  h.equipped.ring = ring.id;
  h.equipped.head = head.id;
  return { h, rng };
}

describe('salvage all', () => {
  it('breaks down weaker spares and pays their embers', () => {
    const { h, rng } = setup();
    h.inventory.push(makeItem(rng, 'r1', 'ring', 'common', 1), makeItem(rng, 'h1', 'head', 'uncommon', 1));
    const plan = salvageAllPlan(h);
    expect(plan.items.map((i) => i.id).sort()).toEqual(['h1', 'r1']);
    expect(plan.embers).toBe(RARITY.common.salvage + RARITY.uncommon.salvage);
    expect(salvageAll(h)).toEqual({ count: 2, embers: plan.embers });
    expect(h.embers).toBe(plan.embers);
    expect(h.inventory.map((i) => i.id).sort()).toEqual(['head', 'ring']);
  });

  it('keeps what you wear, set pieces, Epics, Mythics, class weapons, upgrades and empty-slot items', () => {
    const { h, rng } = setup();
    const set = makeItem(rng, 'set', 'head', 'common', 1); set.set = 'kilnbreaker';
    const epic = makeItem(rng, 'epic', 'ring', 'epic', 1);
    const myth = makeItem(rng, 'myth', 'ring', 'mythic', 1);
    const better = makeItem(rng, 'better', 'ring', 'rare', 60);
    const empty = makeItem(rng, 'empty', 'chest', 'common', 1);
    const fx = makeItem(rng, 'fx', 'ring', 'common', 1); fx.weaponFx = 'piercingCinders';
    h.inventory.push(set, epic, myth, better, empty, fx);
    const plan = salvageAllPlan(h);
    expect(plan.items).toEqual([]);
    expect(plan.kept).toBe(6);
    expect(salvageAll(h)).toEqual({ count: 0, embers: 0 });
    expect(h.inventory.length).toBe(8);
  });
});
