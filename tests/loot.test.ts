import { describe, expect, it } from 'vitest';
import { Rng } from '../sim/rng';
import { MYTHIC_FROM_TIER, newHero, rollDrop, toTree } from '../sim/hero';
import { LOOT, RARITIES, rarityOdds } from '../sim/content/items';
import { World, firstClearRarity } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';

function win(opts: ConstructorParameters<typeof World>[0]): World | null {
  for (let seed = opts.seed; seed < opts.seed + 8; seed++) {
    const w = new World({ ...opts, seed });
    while (w.state !== 'ended' && w.time < 700) {
      if (w.state === 'draft') w.choose(botChoose(w));
      else w.step(botInput(w));
    }
    if (w.victory) return w;
  }
  return null;
}

describe('loot rarity', () => {
  it('no mythics below their tier, even with high luck', () => {
    const rng = new Rng(7);
    for (let k = 0; k < 4000; k++) expect(rollDrop(rng, `x${k}`, 5, 3, 'common', undefined, MYTHIC_FROM_TIER - 1, 'boss').rarity).not.toBe('mythic');
    let mythics = 0;
    for (let k = 0; k < 4000; k++) if (rollDrop(rng, `y${k}`, 5, 3, 'common', undefined, MYTHIC_FROM_TIER, 'boss').rarity === 'mythic') mythics++;
    expect(mythics).toBeGreaterThan(0);
  });

  it('epics are rare from ordinary rolls', () => {
    const rng = new Rng(11);
    let epic = 0;
    for (let k = 0; k < 4000; k++) if (rollDrop(rng, `z${k}`, 5, 1, 'common', undefined, 1).rarity === 'epic') epic++;
    expect(epic / 4000).toBeLessThan(0.025);
  });

  it('a first clear guarantees a rarity by tier: Rare at tier 1, then Epic, Legendary and Mythic', () => {
    expect([1, 3, 4, 9, 10, 14, 15, 40].map(firstClearRarity)).toEqual(['rare', 'rare', 'epic', 'epic', 'legendary', 'legendary', 'mythic', 'mythic']);
    const t1 = win({ seed: 1, tier: 1, omens: [], firstClear: true });
    expect(t1).not.toBeNull();
    const boss = t1!.runDrops[t1!.runDrops.length - 1];
    expect(RARITIES.indexOf(boss.rarity)).toBeGreaterThanOrEqual(RARITIES.indexOf('rare'));
  }, 120000);
});

describe('loot tables (Steve, 26 Nov)', () => {
  const at = (odds: number[], r: (typeof RARITIES)[number]) => odds[RARITIES.indexOf(r)];
  it('tier 1 trash is mostly Common, some Uncommon, about 5% Rare and no Legendary or Mythic', () => {
    const o = rarityOdds('trash', 1);
    expect(at(o, 'common')).toBeGreaterThan(0.7);
    expect(at(o, 'uncommon')).toBeGreaterThan(0.1);
    expect(at(o, 'rare')).toBeLessThan(0.06);
    expect(at(o, 'epic')).toBeLessThan(0.01);
    expect(at(o, 'legendary')).toBe(0);
    expect(at(o, 'mythic')).toBe(0);
  });
  it('Epic and up: each rarity is rarer than the one below it, for every source and tier', () => {
    for (const src of ['trash', 'elite', 'rare', 'boss'] as const) {
      for (const t of [1, 3, 7, 10, 15, 30]) {
        const o = rarityOdds(src, t);
        expect(o.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
        for (let r = 3; r < o.length; r++) if (o[r] > 0) expect(o[r]).toBeLessThan(o[r - 1]);
      }
    }
  });
  it('bosses beat rares, rares beat elites, elites beat trash (Rare or better)', () => {
    const better = (src: 'trash' | 'elite' | 'rare' | 'boss', t: number) => rarityOdds(src, t).slice(2).reduce((a, b) => a + b, 0);
    for (const t of [1, 5, 10]) {
      expect(better('elite', t)).toBeGreaterThan(better('trash', t));
      expect(better('rare', t)).toBeGreaterThan(better('elite', t));
      expect(better('boss', t)).toBeGreaterThan(better('rare', t));
    }
  });
  it('higher tiers lean slowly towards better loot, up to the cap', () => {
    const epicUp = (t: number) => rarityOdds('trash', t).slice(3).reduce((a, b) => a + b, 0);
    expect(epicUp(5)).toBeGreaterThan(epicUp(2));
    expect(epicUp(10)).toBeGreaterThan(epicUp(5));
    expect(epicUp(LOOT.tierCap + 10)).toBeCloseTo(epicUp(LOOT.tierCap), 9);
    expect(at(rarityOdds('boss', LOOT.legendaryFromTier - 1), 'legendary')).toBe(0);
    expect(at(rarityOdds('boss', LOOT.legendaryFromTier), 'legendary')).toBeGreaterThan(0);
  });
  it('rolls follow the table', () => {
    const rng = new Rng(3);
    const n = 20000;
    const got = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<string, number>;
    for (let k = 0; k < n; k++) got[rollDrop(rng, `t${k}`, 5, 1, 'common', undefined, 1, 'trash').rarity]++;
    const o = rarityOdds('trash', 1);
    RARITIES.forEach((r, i) => expect(Math.abs(got[r] / n - o[i])).toBeLessThan(0.01));
  });
  it('old saves: Fine items become Uncommon, in the bags and the roster', () => {
    const h = newHero();
    const fine = { id: 'i1', slot: 'head', rarity: 'fine', ilvl: 4, name: 'Warded Helm', stats: [] } as never;
    h.inventory.push(fine);
    h.roster = { lumen: { level: 2, xp: 0, passives: {}, inventory: [{ ...(fine as object), id: 'i2' } as never], equipped: {}, pity: 0, runs: 0, wins: 0, bestTime: 0, maxTier: 1 } };
    toTree(h);
    expect(h.inventory[h.inventory.length - 1].rarity).toBe('uncommon');
    expect(h.roster.lumen!.inventory[0].rarity).toBe('uncommon');
  });
});
