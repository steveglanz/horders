import { describe, expect, it } from 'vitest';
import { World, VARIETY } from '../sim/world';
import { DUNGEONS, ENCOUNTERS, rollRoute } from '../sim/content/dungeon';
import { FIRST_DELVE } from '../sim/content/firstdelve';

type Inner = {
  spawn(kind: string, x: number, y: number): number;
  runAbilities(i: number, dt: number): void;
  finishCast(i: number): void;
  runStationary(i: number, dt: number): void;
};

/** A Kiln fight with every foe cleared, so a test can place its own. */
function kiln(): { w: World; inner: Inner } {
  const w = new World({ seed: 3, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' });
  const inner = w as unknown as Inner;
  for (const e of w.enemies) e.alive = false;
  w.player.x = 0; w.player.y = 0;
  return { w, inner };
}

const step = (w: World, n: number) => { for (let k = 0; k < n; k++) w.step({ mx: 0, my: 0 } as never); };

describe('V1 variety: the Kiln\'s new foes', () => {
  it('the Kiln draws from 6 openers and 4 named fights, and the first delve keeps its fixed route', () => {
    const d = DUNGEONS.kiln;
    expect(d.openers).toHaveLength(6);
    expect(d.named).toHaveLength(4);
    for (const id of [...d.openers, ...d.named]) expect(ENCOUNTERS[id]).toBeDefined();
    const seen = new Set<string>();
    for (let s = 0; s < 40; s++) { let n = s; seen.add(rollRoute((k) => (n = (n * 7 + 3) % 97) % k, 'kiln').join(',')); }
    expect(seen.size).toBeGreaterThan(20);
    expect(FIRST_DELVE.route).toEqual(['pack', 'wardens', 'brute', 'acolytes', 'kilnMother']);
  });

  it('an Ember Spitter backs off when you close in, and lobs a fire circle where you stand', () => {
    const { w, inner } = kiln();
    const i = inner.spawn('emberSpitter', 100, 0);
    const e = w.enemies[i];
    e.abilityT = 99;
    step(w, 10);
    expect(Math.hypot(e.x, e.y)).toBeGreaterThan(100); // moved away from the hero
    e.abilityT = 0;
    w.player.x = e.x - 200; w.player.y = e.y;
    inner.runAbilities(i, 0.01);
    expect(e.castId).toBe('emberLob');
    const t = w.telegraphs.find((q) => q.alive && q.owner === i)!;
    expect(t.shape).toBe('circle');
    expect(t.r).toBe(VARIETY.lobRadius);
    expect(t.x).toBeCloseTo(w.player.x, 5);
    expect(w.events.some((ev) => ev.type === 'spitLob')).toBe(true);
  });

  it('an Ashbuck shows its lane, then charges straight down it', () => {
    const { w, inner } = kiln();
    const i = inner.spawn('ashbuck', 250, 0);
    const e = w.enemies[i];
    e.abilityT = 0;
    inner.runAbilities(i, 0.01);
    expect(e.castId).toBe('charge');
    const t = w.telegraphs.find((q) => q.alive && q.owner === i)!;
    expect(t.shape).toBe('cone');
    expect(t.angle).toBeCloseTo(Math.PI, 3); // toward the hero at the origin
    inner.finishCast(i);
    expect(w.events.some((ev) => ev.type === 'charge')).toBe(true);
    const x0 = e.x;
    w.player.x = 0; w.player.y = 300; // the hero steps aside: the charge doesn't steer
    step(w, 6);
    expect(x0 - e.x).toBeGreaterThan(100);
    expect(Math.abs(e.y)).toBeLessThan(40);
  });

  it('a Hollow Rift in a dungeon fight keeps at most riftCap Ashlings out', () => {
    const { w, inner } = kiln();
    const r = inner.spawn('rift', 200, 0);
    for (let k = 0; k < 10; k++) { w.enemies[r].abilityT = 0; inner.runStationary(r, 0.01); }
    expect(w.enemies.filter((e) => e.alive && e.kind === 'ashling').length).toBe(VARIETY.riftCap);
  });
});
