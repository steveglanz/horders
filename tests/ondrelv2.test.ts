import { describe, expect, it } from 'vitest';
import { World, ONDREL, ONDRELV2 } from '../sim/world';
import { applySnapshot, snapshot } from '../sim/netsync';
import { botInput } from '../sim/bot';

// ONDRELV2 (design 25 Nov, /mnt/project-files/horders/design/bosses/ondrel-v2.md): Ondrel in three stages.
type O = {
  ondrelClock(dt: number): void; finishCast(i: number): void; spawn(kind: string, x: number, y: number): number; updateOrbs(dt: number, owner?: number): void;
  bossIndex: number; bossSpawned: boolean; choirT: number; anvilT: number; anvilTarget: number; ondrelStage: number;
};
const party = [{ cls: 'lumen' as const, name: 'b' }];

function fight(v2 = true): { w: World; q: O; b: number } {
  const w = new World({ seed: 3, dungeon: 'hammerdeep', tier: 6, omens: [], cls: 'bulwark', party, ondrelV2: v2 });
  const q = w as unknown as O;
  for (const e of w.enemies) e.alive = false;
  w.stones = [];
  const b = q.spawn('ondrel', 0, -200);
  q.bossIndex = b; q.bossSpawned = true;
  q.ondrelStage = w.ondrelV2 ? 1 : 0;
  q.anvilT = 99; q.choirT = 99;
  w.heroData(0).player.x = 0; w.heroData(0).player.y = 0;
  w.heroData(1).player.x = 400; w.heroData(1).player.y = 0;
  return { w, q, b };
}

function anvilfall(w: World, q: O, b: number): void {
  q.anvilTarget = 0;
  const p = w.heroData(0).player;
  p.hp = p.maxHp; p.sunderT = 0; // the tank lives through each one here
  w.enemies[b].castId = 'anvilfall';
  q.finishCast(b);
  w.enemies[b].castId = '';
}

describe('ONDRELV2: the staged Ondrel', () => {
  it('is off unless asked for', () => {
    const { w, q, b } = fight(false);
    expect(w.ondrelV2).toBe(false);
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
    q.ondrelClock(0.1);
    anvilfall(w, q, b);
    expect(q.ondrelStage).toBe(0);
    expect(w.anvils).toHaveLength(0);
  });

  it('stage 1 leaves no anvils; stage 2 starts at 60% and every Anvilfall leaves one on the tank\'s spot', () => {
    const { w, q, b } = fight();
    anvilfall(w, q, b);
    expect(w.anvils).toHaveLength(0);
    w.enemies[b].hp = w.enemies[b].maxHp * ONDRELV2.stage2;
    q.ondrelClock(0.1);
    expect(q.ondrelStage).toBe(2);
    expect(w.events.some((e) => e.type === 'phase' && e.phase === 2)).toBe(true);
    anvilfall(w, q, b);
    expect(w.anvils).toHaveLength(1);
    expect(w.anvils[0].x).toBeCloseTo(0);
    expect(w.anvils[0].y).toBeCloseTo(0);
    expect(w.anvils[0].hot).toBe(ONDRELV2.hot);
    // It's a stone too, so it blocks walking.
    expect(w.stones.filter((c) => c.anvil)).toHaveLength(1);
  });

  it('the hot ring burns 3% max health every 0.5 s for 4 s, then the anvil stays as a block', () => {
    const { w, q, b } = fight();
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
    q.ondrelClock(0.01);
    anvilfall(w, q, b);
    const p = w.heroData(0).player;
    p.x = 60; p.y = 0; // in the ring, outside the block
    p.hp = p.maxHp;
    const far = w.heroData(1).player;
    far.hp = far.maxHp;
    for (let t = 0; t < 1.01; t += 0.05) q.ondrelClock(0.05);
    const lost = p.maxHp - p.hp;
    expect(lost).toBeGreaterThan(0);
    expect(far.hp).toBe(far.maxHp);
    for (let t = 0; t < 4; t += 0.05) q.ondrelClock(0.05);
    expect(w.anvils[0].hot).toBeLessThanOrEqual(0);
    p.hp = p.maxHp;
    for (let t = 0; t < 2; t += 0.05) q.ondrelClock(0.05);
    expect(p.hp).toBe(p.maxHp);
    expect(w.anvils).toHaveLength(1);
  });

  it('keeps at most 4 anvils: a fifth makes the oldest crumble', () => {
    const { w, q, b } = fight();
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
    q.ondrelClock(0.01);
    for (let k = 0; k < 5; k++) {
      w.heroData(0).player.x = -300 + k * 150;
      anvilfall(w, q, b);
    }
    expect(w.anvils).toHaveLength(ONDRELV2.cap);
    expect(w.anvils[0].x).toBeCloseTo(-150);
    expect(w.stones.filter((c) => c.anvil)).toHaveLength(ONDRELV2.cap);
  });

  it('stage 3 at 25%: every anvil glows, bursts and is gone, no more anvils, and his move comes on the enraged timer', () => {
    const { w, q, b } = fight();
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
    q.ondrelClock(0.01);
    w.heroData(0).player.x = -200; anvilfall(w, q, b);
    w.heroData(0).player.x = 200; anvilfall(w, q, b);
    w.enemies[b].hp = w.enemies[b].maxHp * ONDRELV2.stage3;
    q.ondrelClock(0.01);
    expect(q.ondrelStage).toBe(3);
    expect(w.anvils.every((a) => a.glow > 0)).toBe(true);
    const bursts = w.telegraphs.filter((t) => t.alive && t.r === ONDRELV2.burstR);
    expect(bursts).toHaveLength(2);
    for (let t = 0; t < ONDRELV2.glow + 0.1; t += 0.05) q.ondrelClock(0.05);
    expect(w.anvils).toHaveLength(0);
    expect(w.stones.filter((c) => c.anvil)).toHaveLength(0);
    anvilfall(w, q, b);
    expect(w.anvils).toHaveLength(0);
    q.choirT = 0;
    q.ondrelClock(0.01);
    expect(q.choirT).toBeCloseTo(ONDREL.choirEvery / 2, 1);
  });

  it('an anvil stops a hero\'s shot', () => {
    const { w, q, b } = fight();
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
    q.ondrelClock(0.01);
    anvilfall(w, q, b);
    const o = w.orbs[0];
    Object.assign(o, { alive: true, x: -10, y: 0, px: -10, py: 0, vx: 10, vy: 0, life: 2, target: -1, dmg: 10, owner: 0, pierce: 0, lastHit: -1 });
    q.updateOrbs(0.1, 0);
    expect(o.alive).toBe(false);
  });

  it('a bot in a hot ring steps out of it, away from the anvil', () => {
    const { w, q, b } = fight();
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
    q.ondrelClock(0.01);
    anvilfall(w, q, b);
    w.heroData(0).player.x = 50; w.heroData(0).player.y = 0;
    w.use(0);
    const inp = botInput(w, 1);
    expect(inp.x).toBeGreaterThan(0.9);
  });

  it('a co-op guest gets the anvils and the stage', () => {
    const { w, q, b } = fight();
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
    q.ondrelClock(0.01);
    anvilfall(w, q, b);
    const g = new World({ seed: 3, dungeon: 'hammerdeep', tier: 6, omens: [], cls: 'bulwark', party, ondrelV2: true });
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect(g.anvils).toHaveLength(1);
    expect(g.ondrelStage).toBe(2);
    expect(g.stones.filter((c) => c.anvil)).toHaveLength(1);
  });
});
