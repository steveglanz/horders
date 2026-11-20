import { describe, expect, it } from 'vitest';
import { Rng } from '../sim/rng';
import { MYTHIC_FROM_TIER, rollDrop } from '../sim/hero';
import { World, FIRST_CLEAR_EPIC_TIER } from '../sim/world';
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
    for (let k = 0; k < 4000; k++) expect(rollDrop(rng, `x${k}`, 5, 3, 'common', MYTHIC_FROM_TIER - 1).rarity).not.toBe('mythic');
    let mythics = 0;
    for (let k = 0; k < 4000; k++) if (rollDrop(rng, `y${k}`, 5, 3, 'common', MYTHIC_FROM_TIER).rarity === 'mythic') mythics++;
    expect(mythics).toBeGreaterThan(0);
  });

  it('epics are rare from ordinary rolls', () => {
    const rng = new Rng(11);
    let epic = 0;
    for (let k = 0; k < 4000; k++) if (rollDrop(rng, `z${k}`, 5, 1, 'common', 1).rarity === 'epic') epic++;
    expect(epic / 4000).toBeLessThan(0.025);
  });

  it('the boss guarantees an Epic only on a first clear from tier 2', () => {
    const first = win({ seed: 1, tier: FIRST_CLEAR_EPIC_TIER, omens: [], firstClear: true });
    expect(first).not.toBeNull();
    expect(first!.runDrops.some((i) => i.rarity === 'epic' || i.rarity === 'mythic')).toBe(true);
    const t1 = win({ seed: 1, tier: 1, omens: [], firstClear: true });
    expect(t1).not.toBeNull();
    const last = t1!.runDrops[t1!.runDrops.length - 1];
    expect(['rare', 'epic']).toContain(last.rarity);
  }, 120000);
});
