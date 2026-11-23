import { describe, expect, it } from 'vitest';
import { World, ACOLYTE } from '../sim/world';

/** Stands still (invulnerable) until an acolyte is channelling into a wounded Brute. */
function toKindle(seed = 1): { w: World; a: number } {
  const w = new World({ seed, route: ['acolytes', 'acolytes', 'acolytes', 'acolytes', 'kilnMother'], omens: [], invulnerable: true });
  while (w.time < 30) {
    if (w.state === 'draft') { w.choose(0); continue; }
    const brute = w.enemies.find((e) => e.alive && e.kind === 'cinderBrute');
    if (brute) brute.hp = brute.maxHp * 0.5;
    w.step({ x: 0, y: 0 });
    const a = w.enemies.findIndex((e) => e.alive && e.kind === 'acolyte' && e.aux2 >= 0 && w.enemies[e.aux2].kind === 'cinderBrute');
    if (a >= 0) return { w, a };
  }
  throw new Error('no acolyte');
}

describe('Kiln acolytes channel Kindle', () => {
  it('heals its ward steadily, and is never a Quench target', () => {
    const { w, a } = toKindle();
    const acolyte = w.enemies[a];
    const brute = w.enemies[acolyte.aux2];
    const others = w.enemies.filter((e) => e.alive && e.kind === 'acolyte' && e.aux2 === acolyte.aux2).length;
    brute.hp = brute.maxHp * 0.5;
    const before = brute.hp;
    for (let k = 0; k < 30; k++) w.step({ x: 0, y: 0 });
    expect(brute.hp - before).toBeCloseTo(brute.maxHp * ACOLYTE.heal * others, 0);
    expect(acolyte.castId).toBe('');
    expect(w.interruptTarget()).not.toBe(a);
  });

  it('stays inside the arena wall when its ward stands by the wall', () => {
    const { w, a } = toKindle();
    const acolyte = w.enemies[a];
    const brute = w.enemies[acolyte.aux2];
    for (let k = 0; k < 90; k++) {
      brute.x = w.arenaR - brute.def.radius; brute.y = 0;
      w.step({ x: 0, y: 0 });
      expect(Math.hypot(acolyte.x, acolyte.y)).toBeLessThanOrEqual(w.arenaR - acolyte.def.radius + 1e-6);
    }
  });
});
