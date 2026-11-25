import { describe, expect, it } from 'vitest';
import { World, YSMERET, YSMERETV2 } from '../sim/world';
import { applySnapshot, snapshot } from '../sim/netsync';
import { botInput } from '../sim/bot';

// YSMERETV2 (design 25 Nov, /mnt/project-files/horders/design/bosses/ysmeret-v2.md): Ysmeret in two stages. Stage 1's
// Bellow Slam waits while her vents are open; at 50% she splits into two flames that must die close together.
type Q = {
  startEncounter(): void; encounter: number; route: string[]; bossIndex: number; ysmeretClock(dt: number): void;
  killEnemy(i: number): void; twinVentT: number; bellowT: number; scatterT: number; rollLeft: number;
};
const party = [{ cls: 'lumen' as const, name: 'b' }];

function fight(v2 = true): { w: World; q: Q } {
  const w = new World({ seed: 4, dungeon: 'ashvents', tier: 7, omens: [], cls: 'bulwark', party, ysmeretV2: v2 });
  const q = w as unknown as Q;
  for (const e of w.enemies) e.alive = false;
  q.route[1] = 'ysmeret';
  q.encounter = 1;
  q.startEncounter();
  const b = w.enemies[q.bossIndex];
  b.x = b.px = 0; b.y = b.py = 0;
  w.heroData(0).player.x = 0; w.heroData(0).player.y = 120;
  w.heroData(1).player.x = 0; w.heroData(1).player.y = 300;
  return { w, q };
}
const flames = (w: World) => w.enemies.filter((e) => e.alive && e.kind === 'ysmeret');
const ventsOpen = (w: World) => w.telegraphs.some((t) => t.alive && t.kind === 'soak' && t.owner === -2);

describe('YSMERETV2: the Twofold Flame', () => {
  it('is off unless asked for: no split at 50%', () => {
    const { w, q } = fight(false);
    expect(w.ysStage).toBe(0);
    const b = w.enemies[q.bossIndex];
    b.hp = b.maxHp * 0.4;
    q.ysmeretClock(0.05);
    expect(flames(w)).toHaveLength(1);
  });

  it('stage 1: Bellow Slam waits while her vents are open, then goes off once they close', () => {
    const { w, q } = fight();
    expect(w.ysStage).toBe(1);
    const b = w.enemies[q.bossIndex];
    q.scatterT = 99; q.bellowT = 99; q.twinVentT = 0;
    q.ysmeretClock(0.05); // the vents open
    expect(ventsOpen(w)).toBe(true);
    q.bellowT = 0;
    q.ysmeretClock(0.05);
    expect(b.castId).toBe('');
    for (const t of w.telegraphs) if (t.owner === -2) t.alive = false;
    q.twinVentT = 99; q.rollLeft = 0; // (a Rolling Vents run would open its next one)
    q.ysmeretClock(0.05);
    expect(b.castId).toBe('bellowSlam');
  });

  it('the Bellow change can be measured alone (split 0): Bellow waits, but she never splits', () => {
    const was = YSMERETV2.split;
    YSMERETV2.split = 0;
    try {
      const { w, q } = fight();
      const b = w.enemies[q.bossIndex];
      b.hp = b.maxHp * 0.2;
      q.ysmeretClock(0.05);
      expect(flames(w)).toHaveLength(1);
      expect(w.ysStage).toBe(1);
    } finally { YSMERETV2.split = was; }
  });

  it('at 50% she splits into two flames 300 apart, half her health each, with her vents gone', () => {
    const { w, q } = fight();
    q.twinVentT = 0; q.ysmeretClock(0.05);
    expect(ventsOpen(w)).toBe(true);
    const b = w.enemies[q.bossIndex];
    b.hp = b.maxHp * 0.5;
    const left = b.hp;
    q.ysmeretClock(0.05);
    expect(w.ysStage).toBe(2);
    expect(w.events.some((e) => e.type === 'phase' && e.phase === 2)).toBe(true);
    const f = flames(w);
    expect(f).toHaveLength(2);
    expect(f[0].hp + f[1].hp).toBeCloseTo(left, 3);
    expect(Math.hypot(f[0].x - f[1].x, f[0].y - f[1].y)).toBeCloseTo(YSMERETV2.apart, 0);
    expect(ventsOpen(w)).toBe(false);
    // No vents and no Bellow from here, and the two Scatters come half a timer apart.
    const casts: number[] = [];
    for (let t = 0; t < 30; t += 0.05) {
      for (const e of w.enemies) if (e.alive && e.kind === 'ysmeret' && e.castId === 'bellowSlam') throw new Error('Bellow in stage 2');
      q.ysmeretClock(0.05);
      for (const e of w.enemies) if (e.alive && e.kind === 'ysmeret') { e.abilityT -= 0.05; if (e.castId === 'scatter') { casts.push(t); e.castId = ''; } }
      expect(ventsOpen(w)).toBe(false);
    }
    expect(casts.length).toBeGreaterThanOrEqual(3);
    expect(casts[1] - casts[0]).toBeCloseTo(YSMERET.scatterEvery / 2, 0);
  });

  it('when one flame goes out the other has 10 s, or the first relights at 50% of its health; killing both in time wins', () => {
    const { w, q } = fight();
    const b = w.enemies[q.bossIndex];
    b.hp = b.maxHp * 0.5;
    q.ysmeretClock(0.05);
    let [a] = flames(w);
    const ia = w.enemies.indexOf(a);
    const max = a.maxHp;
    q.killEnemy(ia);
    expect(w.victory).toBe(false);
    expect(flames(w)).toHaveLength(1);
    expect(q.bossIndex).toBe(w.enemies.indexOf(flames(w)[0]));
    for (let t = 0; t < YSMERETV2.window + 0.1; t += 0.05) q.ysmeretClock(0.05);
    expect(flames(w)).toHaveLength(2);
    expect(w.events.some((e) => e.type === 'ysFlame' && e.lit)).toBe(true);
    const relit = flames(w).find((f) => f.hp < f.maxHp)!;
    expect(relit.hp / relit.maxHp).toBeCloseTo(YSMERETV2.relight, 3);
    expect(relit.maxHp).toBeCloseTo(max, 3);
    // Now both inside the window: a win.
    [a] = flames(w);
    q.killEnemy(w.enemies.indexOf(a));
    expect(w.victory).toBe(false);
    for (let t = 0; t < 3; t += 0.05) q.ysmeretClock(0.05);
    q.killEnemy(w.enemies.indexOf(flames(w)[0]));
    expect(w.victory).toBe(true);
  });

  it('bots: the tank walks to the flame with more health, the healer to the one with less', () => {
    const { w, q } = fight();
    const b = w.enemies[q.bossIndex];
    b.hp = b.maxHp * 0.5;
    q.ysmeretClock(0.05);
    const [f0, f1] = flames(w);
    f0.x = -400; f0.y = 0; f1.x = 400; f1.y = 0; f0.castId = ''; f1.castId = '';
    f0.hp = f0.maxHp * 0.3; // f1 has more
    for (const k of [0, 1]) { const p = w.heroData(k).player; p.x = 0; p.y = 0; }
    w.telegraphs.length = 0;
    w.use(0); const tank = botInput(w, 1);
    w.use(1); const heal = botInput(w, 1);
    w.use(0);
    expect(tank.x).toBeGreaterThan(0.3);
    expect(heal.x).toBeLessThan(-0.3);
  });

  it('a co-op guest gets the stage and both flames', () => {
    const { w, q } = fight();
    const b = w.enemies[q.bossIndex];
    b.hp = b.maxHp * 0.5;
    q.ysmeretClock(0.05);
    const g = new World({ seed: 4, dungeon: 'ashvents', tier: 7, omens: [], cls: 'bulwark', party, ysmeretV2: true });
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect(g.ysStage).toBe(2);
    expect(g.enemies.filter((e) => e.alive && e.kind === 'ysmeret')).toHaveLength(2);
  });
});
