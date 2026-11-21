import { describe, expect, it } from 'vitest';
import { World, WRACK } from '../sim/world';
import { botInput } from '../sim/bot';
import type { ClassId } from '../sim/content/emberwright';

type Inner = { wrackClock(dt: number): void; tideClockT: number };

/** A hero of `cls` in a Wrackline fight with one raft at (200, 0), no foes, and the Ebb pulling. */
function ebb(cls: ClassId): { w: World; inner: Inner } {
  const w = new World({ seed: 7, dungeon: 'wrackline', omens: [], cls });
  const inner = w as unknown as Inner;
  for (const e of w.enemies) e.alive = false;
  w.phase = 'fight';
  w.rafts = [{ a: 0, ring: 200, dir: 1, x: 200, y: 0, sunkT: 0 }];
  inner.tideClockT = 999;
  w.ebbT = WRACK.tideOpen;
  return { w, inner };
}

describe('class tools for the Wrackline', () => {
  it('Anvil Skin anchors the Bulwark: the Ebb burns but cannot drag it', () => {
    const { w, inner } = ebb('bulwark');
    Object.assign(w.player, { x: -300, y: 0 });
    w.player.bastionT = 3;
    const hp = w.player.hp;
    inner.wrackClock(0.5);
    expect(w.player.x).toBe(-300);
    expect(w.player.hp).toBeLessThan(hp);
    w.player.bastionT = 0;
    inner.wrackClock(0.5);
    expect(w.player.x).toBeGreaterThan(-300);
  });

  it('bots hop toward a far raft with their movement ability, and the Bulwark raises Anvil Skin', () => {
    for (const cls of ['emberwright', 'lumen', 'duskblade'] as ClassId[]) {
      const { w } = ebb(cls);
      Object.assign(w.player, { x: -100, y: 0 });
      const input = botInput(w);
      expect(input.cast, cls).toBe(1);
      expect(input.x).toBeGreaterThan(0);
    }
    const { w } = ebb('bulwark');
    Object.assign(w.player, { x: -100, y: 0 });
    w.player.heat = 100;
    expect(botInput(w).cast).toBe(2);
  });

  it('a bot already on a raft does not hop', () => {
    const { w } = ebb('emberwright');
    Object.assign(w.player, { x: 200, y: 0 });
    expect(botInput(w).cast).not.toBe(1);
  });
});

describe('party bots play their verb set', () => {
  /** Two heroes, no foes: the acting Emberwright at the origin, a Bulwark `gap` units straight up. */
  function pair(set: 'deepguard' | 'ventwalker' | null, gap: number): World {
    const w = new World({ seed: 3, omens: [], cls: 'emberwright', party: [{ cls: 'bulwark' }] });
    for (const e of w.enemies) e.alive = false;
    w.use(1);
    Object.assign(w.player, { x: 0, y: gap });
    w.use(0);
    Object.assign(w.player, { x: 0, y: 0 });
    if (set) w.loadout.sets = { [set]: 3 };
    return w;
  }

  it('Deepguard draws a ranged hero toward its ally, Ventwalker pushes it away, and no set does neither', () => {
    expect(Math.abs(botInput(pair(null, 300)).y)).toBeLessThan(0.01);
    expect(botInput(pair('deepguard', 300)).y).toBeGreaterThan(0.5);
    expect(botInput(pair('ventwalker', 100)).y).toBeLessThan(-0.5);
  });
});
