import { describe, expect, it } from 'vitest';
import { World, FOUNDRY } from '../sim/world';

type Inner = {
  spawn(kind: string, x: number, y: number): number;
  addTelegraph(shape: 'circle', x: number, y: number, r: number, angle: number, arc: number, dur: number, dmg: number, kind: 'bloom', owner: number): void;
};

/** A wounded Sluice Crawler next to a Bulwark, with a bloom about to burst on the Bulwark. */
function bloomOnBulwark(resolve: number): { w: World; healed: number; resolveLeft: number } {
  const w = new World({ seed: 3, cls: 'bulwark', dungeon: 'foundry', omens: [] });
  for (const e of w.enemies) e.alive = false;
  const inner = w as unknown as Inner;
  const p = w.player;
  const i = inner.spawn('sluiceCrawler', p.x + 30, p.y);
  const c = w.enemies[i];
  c.hp = c.maxHp * 0.5;
  c.stunT = 5;
  p.heat = resolve;
  inner.addTelegraph('circle', p.x, p.y, FOUNDRY.bloomRadius, 0, 0, 0.1, FOUNDRY.bloomDamage, 'bloom', -1);
  let healed = 0;
  for (let k = 0; k < 6; k++) {
    w.step({ x: 0, y: 0 });
    for (const ev of w.events) if (ev.type === 'heal' && ev.amount > 50) healed += ev.amount;
  }
  return { w, healed, resolveLeft: p.heat };
}

describe('Bulwark in the Drowned Foundry', () => {
  it('a bloom that bursts on a Bulwark with Resolve heals no one (Smother)', () => {
    const { healed } = bloomOnBulwark(50);
    expect(healed).toBe(0);
  });

  it('without the Resolve to smother it, the bloom feeds the crawler', () => {
    const { healed } = bloomOnBulwark(0);
    expect(healed).toBeGreaterThan(0);
  });
});

describe('Duskblade Open Wounds', () => {
  it('a crawler the Duskblade has cut gets half the bloom heal', () => {
    const heal = (wound: number) => {
      const w = new World({ seed: 3, cls: 'duskblade', dungeon: 'foundry', omens: [] });
      for (const e of w.enemies) e.alive = false;
      const inner = w as unknown as Inner;
      const p = w.player;
      // Far from the hero, so its swings don't land.
      const i = inner.spawn('sluiceCrawler', p.x + 400, p.y);
      const c = w.enemies[i];
      c.hp = c.maxHp * 0.5;
      c.stunT = 5;
      c.woundT = wound;
      inner.addTelegraph('circle', c.x, c.y, FOUNDRY.bloomRadius, 0, 0, 0.05, FOUNDRY.bloomDamage, 'bloom', -1);
      let healed = 0;
      for (let k = 0; k < 3; k++) {
        w.step({ x: 0, y: 0 });
        for (const ev of w.events) if (ev.type === 'heal' && ev.amount > 50) healed += ev.amount;
      }
      return healed / c.maxHp;
    };
    expect(heal(0)).toBeCloseTo(FOUNDRY.bloomHeal, 5);
    expect(heal(3)).toBeCloseTo(FOUNDRY.bloomHeal / 2, 5);
  });
});
