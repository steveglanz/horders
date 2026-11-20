import { describe, expect, it } from 'vitest';
import { World, CHOOSE_TIME } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { rollFork } from '../sim/content/dungeon';
import { Rng } from '../sim/rng';

function toFork(w: World, max = 300) {
  while (w.state !== 'ended' && w.time < max && !(w.phase === 'choose' && w.state === 'running')) {
    if (w.state === 'draft') w.choose(botChoose(w));
    else w.step(botInput(w));
  }
}

/** Steps with a fixed input, resolving drafts, for at most `ticks` ticks. */
function stepFor(w: World, input: () => { x: number; y: number }, until: () => boolean, ticks = 3000) {
  for (let k = 0; k < ticks && !until() && w.state !== 'ended'; k++) {
    if (w.state === 'draft') w.choose(0);
    else w.step(input());
  }
}

describe('forks', () => {
  it('no fork before the first fight or the boss', () => {
    const r = new Rng(1);
    const route = ['pack', 'wardens', 'brute', 'acolytes', 'kilnMother'] as const;
    expect(rollFork([...route], 0, (n) => r.int(n), (p) => r.chance(p))).toBeNull();
    expect(rollFork([...route], 4, (n) => r.int(n), (p) => r.chance(p))).toBeNull();
    const f = rollFork([...route], 1, (n) => r.int(n), (p) => r.chance(p))!;
    expect(f[0]).toEqual({ kind: 'steady', encounter: 'wardens' });
    expect(['named', 'shrine']).toContain(f[1].kind);
    if (f[1].kind === 'named') expect(route).not.toContain(f[1].encounter);
  });

  it('waiting takes the steady path', () => {
    const w = new World({ seed: 4, omens: [] });
    toFork(w);
    expect(w.phase).toBe('choose');
    const planned = w.route[w.encounter];
    stepFor(w, () => ({ x: 0, y: 0 }), () => false, Math.ceil(CHOOSE_TIME * 30) + 2);
    expect(w.phase).not.toBe('choose');
    expect(w.paths).toEqual(['steady']);
    expect(w.route[w.encounter]).toBe(planned);
  });

  it('walking into the other gate swaps the next fight', () => {
    const w = new World({ seed: 4, omens: [] });
    toFork(w);
    const other = w.gates[1];
    stepFor(w, () => ({ x: other.x - w.player.x, y: other.y - w.player.y }), () => w.phase !== 'choose');
    expect(w.paths).toEqual([other.kind]);
    expect(w.route[w.encounter]).toBe(other.encounter);
  });

  it('a delve offers a fork after each of fights 1 to 3', () => {
    const w = new World({ seed: 9, omens: [] });
    while (w.state !== 'ended' && w.time < 800) {
      if (w.state === 'draft') w.choose(botChoose(w));
      else w.step(botInput(w));
    }
    expect(w.paths.length).toBe(w.victory ? 3 : Math.min(3, Math.max(0, w.encounter - 1)));
  });

  it('a shrine heals fully and gives a level but no loot bag', () => {
    const w = new World({ seed: 1, route: ['pack', 'shrine', 'brute', 'acolytes', 'kilnMother'], omens: [] });
    toFork(w);
    // Take the steady gate (the shrine planned in the route).
    const g = w.gates[0];
    stepFor(w, () => ({ x: g.x - w.player.x, y: g.y - w.player.y }), () => w.phase !== 'choose');
    w.player.hp = 20;
    const level = w.player.level;
    const drops = w.drops.filter((d) => d.alive).length;
    stepFor(w, () => ({ x: 0, y: 0 }), () => w.encounter >= 2);
    expect(w.player.hp).toBe(w.player.maxHp);
    expect(w.player.level).toBe(level + 1);
    expect(w.drops.filter((d) => d.alive).length).toBe(drops);
  });
});
