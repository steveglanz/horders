import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { EASE_IN_FOES, KILNTRASH } from '../sim/halls';

// The ease-in after the opening (design, 27 Nov 2026, "Smooth the jump into delve 2").
const trashFoes = (w: World) => w.halls!.packs.filter((p) => p.trash && p.main).map((p) => p.foes.length);
const kiln = (runsDone: number, extra: Record<string, unknown> = {}) =>
  new World({ seed: 7, dungeon: 'kiln', tier: 1, cls: 'emberwright', halls: true, runsDone, heat: 'ventFloor', bossOmen: 'volatileGround', ...extra });

describe('ease-in: a save\'s 2nd and 3rd delves', () => {
  it('steps the Kiln tier 1 trash packs up over delves 2, 3 and 4', () => {
    expect(EASE_IN_FOES[0]).toBeLessThan(EASE_IN_FOES[1]);
    expect(EASE_IN_FOES[1]).toBeLessThan(KILNTRASH.foes);
    const [d2, d3, d4] = [kiln(1), kiln(2), kiln(3)];
    expect([d2.easeIn, d3.easeIn, d4.easeIn]).toEqual([2, 1, 0]);
    const sum = (w: World) => trashFoes(w).reduce((a, b) => a + b, 0);
    expect(sum(d2)).toBeLessThan(sum(d3));
    expect(sum(d3)).toBeLessThanOrEqual(sum(d4));
    expect(sum(d2)).toBeLessThan(sum(d4));
  });

  it('drops the Court\'s Mood and the world boss\'s Omen on the ease-in only', () => {
    const d2 = kiln(1);
    expect(d2.heat).toBe('');
    expect(d2.omens).toEqual([]);
    const d4 = kiln(3);
    expect(d4.heat).toBe('ventFloor');
  });

  it('is off for the opening itself, other tiers and dungeons, bounties and parties', () => {
    expect(kiln(0).easeIn).toBe(0);
    expect(kiln(0, { firstDelve: true }).easeIn).toBe(0);
    expect(kiln(1, { tier: 2 }).easeIn).toBe(0);
    expect(kiln(1, { dungeon: 'foundry' }).easeIn).toBe(0);
    expect(kiln(1, { bounty: 20000 }).easeIn).toBe(0);
    expect(kiln(1, { party: [{ cls: 'lumen' }] }).easeIn).toBe(0);
  });
});
