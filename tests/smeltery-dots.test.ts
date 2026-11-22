import { describe, expect, it } from 'vitest';
import { World, COLO, TICK } from '../sim/world';

type Inner = {
  spawn(kind: string, x: number, y: number): number;
  updateEnemies(dt: number): void;
  use(i: number): void;
  bossIndex: number;
};

/** A Bulwark in front of the Colossus (+x) and a Duskblade behind him (-x). */
function smeltery(burnBy: number): number {
  const w = new World({ seed: 5, dungeon: 'smeltery', omens: [], cls: 'bulwark', worldBoss: 'The Cinder Colossus', party: [{ cls: 'duskblade' }] });
  const inner = w as unknown as Inner;
  for (const e of w.enemies) e.alive = false;
  const b = inner.spawn('colossus', 0, 0);
  inner.bossIndex = b;
  w.heroes[0].player.x = 120; w.heroes[0].player.y = 0;
  w.heroes[1].player.x = -150; w.heroes[1].player.y = 0;
  w.colFacing = 0;
  const e = w.enemies[b];
  e.stunT = 5;
  e.burnT = 2;
  e.burnDps = 300;
  e.burnBy = burnBy;
  const hp = e.hp;
  inner.updateEnemies(TICK);
  inner.use(0);
  return hp - e.hp;
}

describe('the Cinder Colossus judges a burn or bleed from the hero who lit it', () => {
  it('a bleed lit from his back ticks at the back rate, though he faces the tank', () => {
    expect(smeltery(0)).toBeCloseTo(300 * TICK * COLO.frontMult, 5);
    expect(smeltery(1)).toBeCloseTo(300 * TICK * COLO.backMult, 5);
  });
});
