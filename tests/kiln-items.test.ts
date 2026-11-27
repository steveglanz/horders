import { describe, expect, it } from 'vitest';
import { makeItem } from '../sim/hero';
import { Rng } from '../sim/rng';
import { ITEM_LINES, PLACE_ITEMS, RARITIES, RARITY_PREFIX, SLOTS } from '../sim/content/items';
import type { ClassId } from '../sim/content/emberwright';

const CLASSES: ClassId[] = ['emberwright', 'duskblade', 'bulwark', 'lumen', 'slagbinder'];
const kiln = PLACE_ITEMS.kiln!;
const allKiln = [
  ...Object.values(kiln.plain).flat(), ...Object.values(kiln.weapon).flat(),
  ...Object.values(kiln.court), ...Object.values(kiln.courtWeapon),
];

describe('Kiln item names (CP3, docs/design/kiln-items.md)', () => {
  it('Kiln drops use the written names, never the prefix generator', () => {
    const prefixes = new Set(Object.values(RARITY_PREFIX).flat());
    const rng = new Rng(11);
    for (let k = 0; k < 600; k++) {
      const cls = CLASSES[k % 5];
      const it = makeItem(rng, `i${k}`, SLOTS[k % SLOTS.length], RARITIES[k % RARITIES.length], 5, cls, 'kiln');
      expect(allKiln).toContain(it.name);
      expect(prefixes.has(it.name.split(' ')[0])).toBe(false);
    }
  });

  it('Epic and up are the named pieces, each with a line; Common to Rare are plain', () => {
    for (const cls of CLASSES) for (const slot of SLOTS) {
      const epic = makeItem(new Rng(2), 'e', slot, 'epic', 5, cls, 'kiln');
      expect(ITEM_LINES[epic.name]).toBeTruthy();
      const rare = makeItem(new Rng(2), 'r', slot, 'rare', 5, cls, 'kiln');
      expect(ITEM_LINES[rare.name]).toBeUndefined();
      if (slot === 'weapon') expect(kiln.weapon[cls]).toContain(rare.name);
    }
  });

  it("a place's names don't change the item's rolls", () => {
    for (const slot of SLOTS) {
      const a = makeItem(new Rng(9), 'x', slot, 'legendary', 8, 'lumen');
      const b = makeItem(new Rng(9), 'x', slot, 'legendary', 8, 'lumen', 'kiln');
      expect({ ...b, name: a.name }).toEqual(a);
    }
  });

  it('other places keep prefix + slot until their own pass', () => {
    const it = makeItem(new Rng(4), 'f', 'head', 'common', 5, 'bulwark', 'foundry');
    expect(RARITY_PREFIX.common).toContain(it.name.split(' ')[0]);
  });

  it('follows the voice guide: no banned words or fire prefixes, lines of 12 words or fewer', () => {
    const banned = /\b(ancient|eldritch|arcane|void|titan|shadow|doom|abyss|celestial|infernal|primal|mystic|essence|realm|cursed|soul|blood|eternal|ember|cinder|ash|smolder)|heart\b|breaker\b|bane\b|born\b|forged\b|sworn\b/i;
    for (const n of allKiln) expect(n).not.toMatch(banned);
    for (const line of Object.values(ITEM_LINES)) {
      expect(line).not.toMatch(banned);
      expect(line.split(' ').length).toBeLessThanOrEqual(12);
      expect(line).not.toMatch(/[!—…]/);
    }
    expect(new Set(allKiln).size).toBe(allKiln.length);
  });
});
