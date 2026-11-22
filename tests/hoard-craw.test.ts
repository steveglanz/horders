import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import type { ClassId } from '../sim/content/emberwright';

type Inner = {
  spawn(kind: string, x: number, y: number): number;
  rebuildHash(): void;
  updateLight(dt: number): void;
  updateSlag(dt: number): void;
  fireVolley(): void;
  bossIndex: number;
  crawIndex: number;
  orbs: { alive: boolean; vx: number; vy: number }[];
};

/** A Hoard party with `cls` first, Old Coalmouth 200 px right of it and his Craw 200 px above it. */
function hoard(cls: ClassId): { w: World; inner: Inner; boss: number; craw: number } {
  const w = new World({ seed: 3, dungeon: 'hoard', tier: 9, omens: [], cls, party: [{ cls: 'bulwark' }] });
  for (const e of w.enemies) e.alive = false;
  const inner = w as unknown as Inner;
  const p = w.player;
  const boss = inner.spawn('coalmouth', p.x + 200, p.y);
  inner.bossIndex = boss;
  const craw = inner.spawn('craw', p.x, p.y - 200);
  inner.crawIndex = craw;
  inner.rebuildHash();
  return { w, inner, boss, craw };
}

describe('the Hoard: ranged attacks hit the Craw first', () => {
  it('exposes the Craw only while it is up', () => {
    const { w, craw } = hoard('lumen');
    expect(w.craw).toBe(craw);
    w.enemies[craw].alive = false;
    expect(w.craw).toBe(-1);
  });

  for (const [cls, fire] of [['lumen', (i: Inner) => i.updateLight(1 / 30)], ['slagbinder', (i: Inner) => i.updateSlag(1 / 30)]] as const) {
    it(`${cls}: its bolt goes to the Craw, not the boss`, () => {
      const { w, inner, boss, craw } = hoard(cls);
      const b0 = w.enemies[boss].hp;
      const c0 = w.enemies[craw].hp;
      for (let k = 0; k < 90; k++) fire(inner);
      expect(w.enemies[craw].hp).toBeLessThan(c0);
      expect(w.enemies[boss].hp).toBe(b0);
    });
  }

  it("emberwright: the first orb flies at the Craw", () => {
    const { w, inner } = hoard('emberwright');
    inner.fireVolley();
    const o = inner.orbs.find((x) => x.alive)!;
    // The Craw is straight up (negative y), the boss to the right.
    expect(o.vy).toBeLessThan(0);
    expect(Math.abs(o.vx)).toBeLessThan(Math.abs(o.vy));
    void w;
  });
});
