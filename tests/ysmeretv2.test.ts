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

function fight(): { w: World; q: Q } {
  const w = new World({ seed: 4, dungeon: 'ashvents', tier: 7, omens: [], cls: 'bulwark', party });
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

  it('stage 1: Bellow Slam also waits on the tick her vents open (QA, 25 Nov)', () => {
    const { w, q } = fight();
    const b = w.enemies[q.bossIndex];
    // Twin Vents opening, and the last of a Rolling Vents set opening (rollLeft goes 1 -> 0), each with Bellow due.
    q.scatterT = 99; q.bellowT = 0; q.twinVentT = 0; q.rollLeft = 0;
    q.ysmeretClock(0.05);
    expect(ventsOpen(w)).toBe(true);
    expect(b.castId).toBe('');
    for (const t of w.telegraphs) if (t.owner === -2) t.alive = false;
    q.bellowT = 0; q.twinVentT = 99; q.rollLeft = 1;
    q.ysmeretClock(0.05);
    expect(ventsOpen(w)).toBe(true);
    expect(q.rollLeft).toBe(0);
    expect(b.castId).toBe('');
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

  it('at 50% she splits into two flames 420 apart that share her health, with her vents gone', () => {
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
    for (const x of f) expect(x.hp).toBeCloseTo(left * YSMERETV2.hpMult, 3);
    expect(Math.hypot(f[0].x - f[1].x, f[0].y - f[1].y)).toBeCloseTo(YSMERETV2.apart, 0);
    expect(ventsOpen(w)).toBe(false);
    // Hitting either one takes it off both.
    f[0].hp -= 100; f[1].hp -= 50;
    q.ysmeretClock(0.05);
    expect(f[0].hp).toBeCloseTo(left * YSMERETV2.hpMult - 150, 3);
    expect(f[1].hp).toBeCloseTo(f[0].hp, 3);
  });

  it('stage 2: no vents, each flame Bellows and Scatters on its own timer (half apart), and each flame stays where it landed', () => {
    const { w, q } = fight();
    const b = w.enemies[q.bossIndex];
    b.hp = b.maxHp * 0.5;
    q.ysmeretClock(0.05);
    const f = flames(w);
    const home = f.map((x) => ({ x: x.x, y: x.y }));
    const casts: number[] = [];
    const bellows: number[] = [];
    const from = new Set<number>();
    for (let t = 0; t < 30; t += 0.05) {
      // Keep a hero on each so nothing flares.
      w.heroData(0).player.x = f[0].x; w.heroData(0).player.y = f[0].y + 60;
      w.heroData(1).player.x = f[1].x; w.heroData(1).player.y = f[1].y + 60;
      f[0].x += 5; f[1].y += 5; // try to walk off
      q.ysmeretClock(0.05);
      for (const [k, e] of f.entries()) { if (e.castId === 'bellowSlam') { bellows.push(t); from.add(k); e.castId = ''; } e.abilityT -= 0.05; if (e.castId === 'scatter') { casts.push(t); e.castId = ''; } }
      expect(ventsOpen(w)).toBe(false);
    }
    f.forEach((e, k) => expect(Math.hypot(e.x - home[k].x, e.y - home[k].y)).toBeLessThanOrEqual(YSMERETV2.leash + 0.01));
    expect(w.events.some((e) => e.type === 'ysFlare')).toBe(false);
    expect(casts.length).toBeGreaterThanOrEqual(3);
    expect(casts[1] - casts[0]).toBeCloseTo(YSMERET.scatterEvery / 2, 0);
    // Only the flame on the tank (hero 0, the Bulwark, stands on flame 0) Bellows, on one timer.
    expect(bellows.length).toBeGreaterThanOrEqual(2);
    expect(bellows[1] - bellows[0]).toBeCloseTo(YSMERETV2.bellowEvery, 0);
    expect([...from]).toEqual([0]);
  });

  it('a flame with no hero near it for 3 s flares and hits every hero', () => {
    const { w, q } = fight();
    const b = w.enemies[q.bossIndex];
    b.hp = b.maxHp * 0.5;
    q.ysmeretClock(0.05);
    const f = flames(w);
    let flares = 0;
    for (let t = 0; t < YSMERETV2.flareAfter + 0.2; t += 0.05) {
      for (const k of [0, 1]) { const p = w.heroData(k).player; p.x = f[0].x; p.y = f[0].y + 60; p.hp = p.maxHp; }
      w.events.length = 0;
      q.ysmeretClock(0.05);
      if (w.events.some((e) => e.type === 'ysFlare')) {
        flares++;
        for (const k of [0, 1]) expect(w.heroData(k).player.hp).toBeLessThan(w.heroData(k).player.maxHp);
      }
    }
    expect(flares).toBe(1);
  });

  it('they go out together: one flame down is the win', () => {
    const { w, q } = fight();
    const b = w.enemies[q.bossIndex];
    b.hp = b.maxHp * 0.5;
    q.ysmeretClock(0.05);
    const [a] = flames(w);
    a.hp = 0;
    q.killEnemy(w.enemies.indexOf(a));
    expect(flames(w)).toHaveLength(0);
    expect(w.victory).toBe(true);
  });

  it('bots: the tank on the flame it held, the healer on the other', () => {
    const { w, q } = fight();
    const b = w.enemies[q.bossIndex];
    b.hp = b.maxHp * 0.5;
    q.ysmeretClock(0.05);
    const f0 = w.enemies[w.ysF0], f1 = w.enemies[w.ysF1];
    f0.x = -400; f0.y = 0; f1.x = 400; f1.y = 0; f0.castId = ''; f1.castId = '';
    for (const k of [0, 1]) { const p = w.heroData(k).player; p.x = 0; p.y = 0; }
    w.telegraphs.length = 0;
    w.use(0); const tank = botInput(w, 1);
    w.use(1); const heal = botInput(w, 1);
    w.use(0);
    expect(tank.x).toBeLessThan(-0.3);
    expect(heal.x).toBeGreaterThan(0.3);
  });

  it('a co-op guest gets the stage and both flames', () => {
    const { w, q } = fight();
    const b = w.enemies[q.bossIndex];
    b.hp = b.maxHp * 0.5;
    q.ysmeretClock(0.05);
    const g = new World({ seed: 4, dungeon: 'ashvents', tier: 7, omens: [], cls: 'bulwark', party });
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect(g.ysStage).toBe(2);
    expect(g.enemies.filter((e) => e.alive && e.kind === 'ysmeret')).toHaveLength(2);
  });
});
