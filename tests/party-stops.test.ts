import { describe, expect, it } from 'vitest';
import { World, STOP_ONLY } from '../sim/world';
import type { ClassId } from '../sim/content/emberwright';

type Inner = {
  spawn(kind: string, x: number, y: number): number;
  startCast(i: number, id: string, name: string, dur: number, interruptible: boolean): boolean;
};

/** A world led by `main` (with `rest` as party) at character level `lvl` for every hero, one `kind` foe 150 px away. */
function foe(main: ClassId, rest: ClassId[], kind: string, lvl?: number): { w: World; inner: Inner; i: number } {
  const w = new World({ seed: 4, dungeon: 'hammerdeep', omens: [], cls: main, unlockLevel: lvl, party: rest.length ? rest.map((cls) => ({ cls, unlockLevel: lvl })) : undefined });
  for (const e of w.enemies) e.alive = false;
  const inner = w as unknown as Inner;
  return { w, inner, i: inner.spawn(kind, w.player.x + 150, w.player.y) };
}

describe('foes adapt to the party: no stop-only casts nobody can stop (Steve, 26 Nov)', () => {
  it('a level 1 hero (no F yet) never sees the Kiln Mother\'s Molten Cataclysm, nor is told to press F', () => {
    const { w, inner, i } = foe('lumen', [], 'kilnMother', 1);
    expect(w.partyStops(w.enemies[i])).toBe(false);
    expect(inner.startCast(i, 'cataclysm', 'Molten Cataclysm', 3, true)).toBe(false);
    expect(w.enemies[i].castId).toBe('');
    // A cast with a floor telegraph to step out of still comes, but F isn't offered.
    expect(inner.startCast(i, 'groundPound', 'Ground Pound', 1.4, true)).toBe(true);
    expect(w.canStop(w.enemies[i])).toBe(false);
  });

  it('once F is unlocked, a solo stun class faces every cast again', () => {
    const { w, inner, i } = foe('lumen', [], 'kilnMother', 4);
    expect(w.partyStops(w.enemies[i])).toBe(true);
    expect(inner.startCast(i, 'cataclysm', 'Molten Cataclysm', 3, true)).toBe(true);
  });

  it('a party with no interrupter: bosses skip them, elites still cast them (stuns break those)', () => {
    const boss = foe('lumen', ['slagbinder'], 'ondrel');
    expect(boss.w.partyStops(boss.w.enemies[boss.i])).toBe(false);
    for (const id of STOP_ONLY) expect(boss.inner.startCast(boss.i, id, id, 2, true)).toBe(false);
    const elite = foe('lumen', ['slagbinder'], 'glassWarden');
    expect(elite.inner.startCast(elite.i, 'mirror', 'Mirror Ward', 2, true)).toBe(true);
  });

  it('with an interrupter in the party nothing changes', () => {
    const { w, inner, i } = foe('lumen', ['slagbinder', 'bulwark'], 'ondrel');
    expect(w.partyStops(w.enemies[i])).toBe(true);
    expect(inner.startCast(i, 'snuff', 'Snuff', 2, true)).toBe(true);
  });

  it('a Bulwark whose F is still locked is no interrupter', () => {
    const { w, i } = foe('bulwark', ['lumen'], 'ondrel', 3);
    expect(w.partyStops(w.enemies[i])).toBe(false);
  });
});
