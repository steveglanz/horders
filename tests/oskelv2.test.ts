import { describe, expect, it } from 'vitest';
import { OSKELV2, World } from '../sim/world';
import { applySnapshot, snapshot } from '../sim/netsync';
import { botInput } from '../sim/bot';

// OSKELV2 (design 25 Nov, /mnt/project-files/horders/design/bosses/oskel-v2.md): Oskel in three stages. At 55% the press
// bed runs (it carries everyone and flips at each Downstroke, the downstream rim is a crush line); from 20% it runs faster
// and stops flipping.
type Q = { startEncounter(): void; encounter: number; route: string[]; bossIndex: number; oskelClock(dt: number): void; downT: number; rivetT: number; stampT: number };
const party = [{ cls: 'lumen' as const, name: 'b' }];

function fight(v2 = true): { w: World; q: Q } {
  const w = new World({ seed: 4, dungeon: 'pressworks', tier: 10, omens: [], cls: 'bulwark', party, oskelV2: v2 });
  const q = w as unknown as Q;
  for (const e of w.enemies) e.alive = false;
  q.route[1] = 'oskel';
  q.encounter = 1;
  q.startEncounter();
  const b = w.enemies[q.bossIndex];
  b.x = b.px = 0; b.y = b.py = 0;
  w.heroData(0).player.x = 0; w.heroData(0).player.y = 100;
  w.heroData(1).player.x = 0; w.heroData(1).player.y = -100;
  // Keep his own moves out of the way unless a test wants them.
  q.downT = q.rivetT = q.stampT = 999;
  return { w, q };
}
const boss = (w: World, q: Q) => w.enemies[q.bossIndex];

describe('OSKELV2: the running press bed', () => {
  it('is off unless asked for: no stage, no belt at 50%', () => {
    const { w, q } = fight(false);
    expect(w.osStage).toBe(0);
    boss(w, q).hp = boss(w, q).maxHp * 0.5;
    const y = w.heroData(0).player.y;
    for (let t = 0; t < 2; t += 0.05) q.oskelClock(0.05);
    expect(w.osStage).toBe(0);
    expect(w.heroData(0).player.y).toBe(y);
  });

  it('stage 2 at 55%: the belt carries heroes, foes and the Downstroke plate, but not Oskel', () => {
    const { w, q } = fight();
    expect(w.osStage).toBe(1);
    boss(w, q).hp = boss(w, q).maxHp * 0.54;
    w.osDir = 0;
    q.oskelClock(0.05);
    expect(w.osStage).toBe(2);
    expect(w.events.some((e) => e.type === 'phase' && e.phase === 2)).toBe(true);
    const h = w.heroData(0).player, x0 = h.x;
    const b = boss(w, q), bx = b.x;
    for (let t = 0; t < 1 - 1e-9; t += 0.05) q.oskelClock(0.05);
    expect(h.x - x0).toBeCloseTo(OSKELV2.belt * 1, 0);
    expect(b.x).toBe(bx);
    // A Downstroke plate rides it too, and its warning starts the flip clock.
    q.downT = 0;
    q.oskelClock(0.05);
    const plate = w.telegraphs.find((t) => t.alive && t.kind === 'soak' && t.owner === -3)!;
    expect(plate).toBeTruthy();
    expect(w.osFlipT).toBeCloseTo(OSKELV2.flipWarn, 5);
    const px = plate.x;
    q.downT = 999;
    for (let t = 0; t < 0.5 - 1e-9; t += 0.05) q.oskelClock(0.05);
    expect(plate.x).toBeGreaterThan(px);
  });

  it('flips its way each Downstroke after the warning, and stage 3 runs at belt3 without flipping', () => {
    const { w, q } = fight();
    boss(w, q).hp = boss(w, q).maxHp * 0.5;
    w.osDir = 0;
    q.oskelClock(0.05);
    q.downT = 0;
    q.oskelClock(0.05);
    q.downT = 999;
    for (let t = 0; t < OSKELV2.flipWarn - 0.1; t += 0.05) q.oskelClock(0.05);
    expect(w.osDir).toBe(0);
    for (let t = 0; t < 0.3; t += 0.05) q.oskelClock(0.05);
    expect(w.osDir).toBeCloseTo(Math.PI, 5);
    boss(w, q).hp = boss(w, q).maxHp * 0.19;
    q.oskelClock(0.05);
    expect(w.osStage).toBe(3);
    expect(w.events.some((e) => e.type === 'phase' && e.phase === 3)).toBe(true);
    const h = w.heroData(0).player;
    h.x = 0; h.y = 100;
    for (let t = 0; t < 1 - 1e-9; t += 0.05) q.oskelClock(0.05);
    expect(h.x).toBeCloseTo(-OSKELV2.belt3, 0);
    // No flip in stage 3, even with a Downstroke.
    q.downT = 0;
    q.oskelClock(0.05);
    expect(w.osFlipT).toBe(-1);
  });

  it('the crush line: a hero on the downstream rim takes 35% and is pushed upstream; a normal foe dies; upstream is safe', () => {
    const { w, q } = fight();
    boss(w, q).hp = boss(w, q).maxHp * 0.5;
    w.osDir = 0;
    q.oskelClock(0.05);
    const h = w.heroData(0).player;
    h.hp = h.maxHp;
    h.x = w.arenaR - 20; h.y = 0;
    q.oskelClock(0.05);
    // 35% of max health before damage reduction (it goes through hurtPlayer, as a second Downstroke's crush does).
    expect(h.hp).toBeLessThan(h.maxHp * 0.85);
    expect(h.hp).toBeGreaterThanOrEqual(h.maxHp * (1 - OSKELV2.crush) - 1e-6);
    expect(h.x).toBeLessThan(w.arenaR - 20 - OSKELV2.push + 10);
    expect(w.osCrushHits).toBe(1);
    // The upstream rim and the sides are safe.
    const l = w.heroData(1).player;
    l.hp = l.maxHp;
    l.x = -(w.arenaR - 20); l.y = 0;
    q.oskelClock(0.05);
    expect(l.hp).toBe(l.maxHp);
    expect(w.onCrushLine(0, w.arenaR - 20, 18)).toBe(false);
    // A normal foe on it is crushed; Oskel never is.
    const i = (w as unknown as { spawn(k: string, x: number, y: number): number }).spawn('ashling', w.arenaR - 30, 0);
    expect(i).toBeGreaterThanOrEqual(0);
    {
      q.oskelClock(0.05);
      expect(w.enemies[i].alive).toBe(false);
    }
    boss(w, q).x = w.arenaR - 50; boss(w, q).y = 0;
    q.oskelClock(0.05);
    expect(boss(w, q).alive).toBe(true);
  });

  it('bots walk against the belt: a hero holding still drifts far less than the belt would carry it', () => {
    const { w, q } = fight();
    boss(w, q).hp = boss(w, q).maxHp * 0.5;
    w.osDir = 0;
    q.oskelClock(0.05);
    const withBelt = botInput(w);
    w.osStage = 1; // same spot, no belt
    const without = botInput(w);
    w.osStage = 2;
    // The input leans upstream (against +x) by the belt's share of a hero's pace.
    expect(withBelt.x).toBeLessThan(without.x - 0.1);
  });

  it('a co-op guest gets the stage and the way the belt runs', () => {
    const { w, q } = fight();
    boss(w, q).hp = boss(w, q).maxHp * 0.5;
    w.osDir = 1.25;
    q.oskelClock(0.05);
    const g = new World({ seed: 4, dungeon: 'pressworks', tier: 10, omens: [], cls: 'bulwark', party, oskelV2: true });
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect(g.osStage).toBe(2);
    expect(g.osDir).toBeCloseTo(1.25, 5);
  });
});
