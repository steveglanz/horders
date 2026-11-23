import { describe, expect, it } from 'vitest';
import { World, BALLAST } from '../sim/world';
import { botInput } from '../sim/bot';
import { DUNGEONS, ENCOUNTERS } from '../sim/content/dungeon';

type Inner = {
  spawn(kind: string, x: number, y: number): number;
  runAbilities(i: number, dt: number): void;
  damageEnemy(i: number, amount: number, canCrit: boolean): void;
  route: string[];
};

/** A Foundry run already in its first fight, with every foe cleared so a test can place its own. */
function fight(cls: 'emberwright' | 'bulwark' = 'emberwright'): { w: World; inner: Inner } {
  const w = new World({ seed: 3, dungeon: 'foundry', tier: 4, omens: [], cls });
  const inner = w as unknown as Inner;
  inner.route[0] = 'ballast';
  for (const e of w.enemies) e.alive = false;
  (w as unknown as { phase: string }).phase = 'fight';
  w.player.x = 0; w.player.y = 0;
  return { w, inner };
}
const step = (w: World, n: number) => { for (let k = 0; k < n; k++) w.step({ x: 0, y: 0 }); };
function hit(w: World, inner: Inner, i: number): number {
  const e = w.enemies[i];
  e.hp = e.maxHp = 1e6;
  inner.damageEnemy(i, 100, false);
  return 1e6 - e.hp;
}

describe('Phase 16 U2: the Ballast (the Drowned Foundry)', () => {
  it('is a Foundry opener: one Ballast and two hounds', () => {
    expect(DUNGEONS.foundry.openers).toContain('ballast');
    expect(ENCOUNTERS.ballast.spawns).toEqual([{ kind: 'ballast', n: 1 }, { kind: 'cinderhound', n: 2 }]);
  });

  it('walks while you are out of its reach and takes full damage', () => {
    const { w, inner } = fight();
    const b = inner.spawn('ballast', 400, 0);
    const e = w.enemies[b];
    e.abilityT = 99;
    step(w, 30);
    expect(e.x).toBeLessThan(400);
    expect(e.aux).toBe(0);
    expect(hit(w, inner, b)).toBeCloseTo(100, 3);
  });

  it('drops anchor after plantDelay in your reach: it stops, barely feels hits (a glance), and slams', () => {
    const { w, inner } = fight();
    const b = inner.spawn('ballast', 60, 0);
    const e = w.enemies[b];
    step(w, Math.ceil(BALLAST.plantDelay * 30) + 2);
    expect(e.aux).toBeGreaterThanOrEqual(BALLAST.plantDelay);
    const x0 = e.x;
    w.events.length = 0;
    expect(hit(w, inner, b)).toBeCloseTo(100 * BALLAST.planted, 3);
    expect(w.events.some((ev) => ev.type === 'hit' && (ev as { glance?: true }).glance)).toBe(true);
    step(w, Math.ceil(BALLAST.slamFirst * 30) + 2);
    expect(e.x).toBeCloseTo(x0, 5);
    expect(e.castId).toBe('anchorSlam');
  });

  it('weighs anchor unplant s after you leave its reach, and walks again', () => {
    const { w, inner } = fight();
    const b = inner.spawn('ballast', 60, 0);
    const e = w.enemies[b];
    e.aux = BALLAST.plantDelay;
    e.abilityT = 99;
    w.player.x = -300;
    step(w, Math.ceil(BALLAST.unplant * 30) + 2);
    expect(e.aux).toBe(0);
    const x0 = e.x;
    step(w, 15);
    expect(e.x).toBeLessThan(x0);
  });

  it('a bot steps out of a planted Ballast\'s reach', () => {
    const { w, inner } = fight('bulwark');
    const b = inner.spawn('ballast', 60, 0);
    w.enemies[b].aux = BALLAST.plantDelay;
    w.enemies[b].abilityT = 99;
    expect(botInput(w, 1).x).toBeLessThan(0);
  });
});
