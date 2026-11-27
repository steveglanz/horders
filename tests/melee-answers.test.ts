import { describe, expect, it } from 'vitest';
import { World, MAELRA_HITS } from '../sim/world';

/**
 * 1.0 CP4 (vision section 6 item 6): every boss attack has a melee answer. docs/design/melee-answers.md lists each
 * launch boss's attacks and the answer; these tests pin the ones a PR changed.
 */
type Q = {
  spawn(kind: string, x: number, y: number): number;
  runAbilities(i: number, dt: number): void;
  bossIndex: number;
  bossSpawned: boolean;
};

/** A Foundry room with only Maelra up, the hero `dx` east of her. */
function maelra(dx: number): { w: World; q: Q; b: number } {
  const w = new World({ seed: 3, dungeon: 'foundry', tier: 4, omens: [], cls: 'duskblade' });
  const q = w as unknown as Q;
  for (const e of w.enemies) e.alive = false;
  w.player.x = dx; w.player.y = 0;
  const b = q.spawn('maelra', 0, 0);
  q.bossIndex = b; q.bossSpawned = true;
  return { w, q, b };
}
const others = (w: World) => { for (const e of w.enemies) if (e.alive && e.kind !== 'maelra') e.alive = false; };

describe('melee answers: Maelra (the Dowager Bellows)', () => {
  it('never hurts by touch: a melee hero standing against her takes nothing between her red marks', () => {
    const { w, b } = maelra(40);
    const e = w.enemies[b];
    const hp = w.player.hp;
    for (let n = 0; n < 30 * 3; n++) {
      e.abilityT = 99; e.touchCd = 0; e.x = 0; e.y = 0;
      w.player.x = 40; w.player.y = 0;
      for (const t of w.telegraphs) t.alive = false;
      others(w);
      w.step({ x: 0, y: 0 });
    }
    expect(w.player.hp).toBeGreaterThanOrEqual(hp);
  });

  it('her cone is hers (a Bulwark can parry it, and a loss names her), her circle under the hero is not', () => {
    let cone = false, circle = false;
    for (let seed = 0; seed < 40 && !(cone && circle); seed++) {
      const { w, q, b } = maelra(60);
      (w as unknown as { rng: { int(n: number): number } }).rng.int = () => seed % 2;
      w.enemies[b].abilityT = 0;
      q.runAbilities(b, 0.01);
      const t = w.telegraphs.find((x) => x.alive)!;
      if (t.shape === 'cone') { cone = true; expect(t.owner).toBe(b); expect(t.dmg).toBe(MAELRA_HITS.cone); }
      else { circle = true; expect(t.owner).toBe(-1); }
    }
    expect(cone && circle).toBe(true);
  });
});
