import { describe, expect, it } from 'vitest';
import { World, FOE_AI, FOE_AI_LUNGERS } from '../sim/world';

type Inner = { spawn(kind: string, x: number, y: number): number };

/** A Kiln fight with every foe cleared, so a test can place its own. */
function kiln(): { w: World; inner: Inner } {
  const w = new World({ seed: 3, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' });
  for (const e of w.enemies) e.alive = false;
  w.player.x = 0; w.player.y = 0;
  return { w, inner: w as unknown as Inner };
}
const idle = { x: 0, y: 0 } as never;

describe('FOE_AI: smarter foes (Steve, 26 Nov)', () => {
  it('a chaser cuts off a running hero instead of following its trail', () => {
    const { w, inner } = kiln();
    const i = inner.spawn('husk', 300, 0);
    const e = w.enemies[i];
    e.abilityT = 99;
    // The hero runs up the screen (+y) past the foe: a plain chase would head straight at x 0, y 0.
    for (let k = 0; k < 3; k++) w.step({ x: 0, y: 1 } as never);
    const y0 = e.y;
    w.step({ x: 0, y: 1 } as never);
    expect(e.y - y0).toBeGreaterThan(0); // it heads to where the hero is going
  });

  it('two foes of a pack come in from different sides', () => {
    const { w, inner } = kiln();
    const sides = new Set<number>();
    for (let k = 0; k < 6; k++) {
      const i = inner.spawn('husk', 280, 0);
      w.enemies[i].abilityT = 99;
    }
    w.step(idle);
    for (const e of w.enemies) if (e.alive) sides.add(Math.sign(e.y - e.py));
    expect(sides.has(1) && sides.has(-1)).toBe(true);
  });

  it('a hound lunges: it stops, shows a red lane, then dashes down it', () => {
    const { w, inner } = kiln();
    expect(FOE_AI_LUNGERS.has('cinderhound')).toBe(true);
    const i = inner.spawn('cinderhound', 150, 0);
    const e = w.enemies[i];
    e.abilityT = 99; e.lungeT = 0;
    w.step(idle);
    expect(e.lungeW).toBeGreaterThan(0);
    const lane = w.telegraphs.find((t) => t.alive && t.owner === i && t.shape === 'cone')!;
    expect(lane).toBeDefined();
    expect(lane.kind).toBe('hit');
    expect(lane.angle).toBeCloseTo(Math.PI, 2);
    const x0 = e.x;
    for (let k = 0; k < Math.ceil(FOE_AI.lungeWind * 30); k++) w.step(idle);
    expect(Math.abs(e.x - x0)).toBeLessThan(10); // it holds still while the lane shows
    const x1 = e.x;
    for (let k = 0; k < 5; k++) w.step(idle);
    expect(x1 - e.x).toBeGreaterThan(60); // then it dashes, far faster than its walk (about 17 px in 5 steps)
  });

  it('a stun breaks a lunge and takes its lane away', () => {
    const { w, inner } = kiln();
    const i = inner.spawn('cinderhound', 150, 0);
    const e = w.enemies[i];
    e.abilityT = 99; e.lungeT = 0;
    w.step(idle);
    expect(e.lungeW).toBeGreaterThan(0);
    e.stunT = 1;
    w.step(idle);
    expect(e.lungeW).toBe(0);
    expect(w.telegraphs.some((t) => t.alive && t.owner === i && t.shape === 'cone')).toBe(false);
  });

  it(`at most ${FOE_AI.lungeCap} foes lunge at once`, () => {
    const { w, inner } = kiln();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const i = inner.spawn('cinderhound', Math.cos(a) * 150, Math.sin(a) * 150);
      w.enemies[i].abilityT = 99; w.enemies[i].lungeT = 0;
    }
    w.step(idle);
    expect(w.enemies.filter((e) => e.alive && e.lungeW > 0).length).toBe(FOE_AI.lungeCap);
  });
});
