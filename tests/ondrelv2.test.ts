import { describe, expect, it } from 'vitest';
import { World, ONDREL, ONDRELV2 } from '../sim/world';
import { applySnapshot, snapshot } from '../sim/netsync';
import { botInput } from '../sim/bot';

// ONDRELV2 (design 25 Nov, /mnt/project-files/horders/design/bosses/ondrel-v2.md): Ondrel in three stages. Stage 2's
// Anvilfalls leave flat burning slag (no block), and stage 3 bursts it.
type O = {
  ondrelClock(dt: number): void; finishCast(i: number): void; spawn(kind: string, x: number, y: number): number;
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

/** Into stage 2 (half health). */
function stage2(w: World, q: O, b: number): void {
  w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
  q.ondrelClock(0.01);
}

describe('ONDRELV2: the staged Ondrel', () => {
  it('is off unless asked for', () => {
    const { w, q, b } = fight(false);
    expect(w.ondrelV2).toBe(false);
    stage2(w, q, b);
    anvilfall(w, q, b);
    expect(q.ondrelStage).toBe(0);
    expect(w.slagPatches).toHaveLength(0);
  });

  it('stage 1 leaves no slag; stage 2 starts at 60% and every Anvilfall leaves a patch on the tank\'s spot, which blocks nothing', () => {
    const { w, q, b } = fight();
    anvilfall(w, q, b);
    expect(w.slagPatches).toHaveLength(0);
    w.enemies[b].hp = w.enemies[b].maxHp * ONDRELV2.stage2;
    q.ondrelClock(0.1);
    expect(q.ondrelStage).toBe(2);
    expect(w.events.some((e) => e.type === 'phase' && e.phase === 2)).toBe(true);
    anvilfall(w, q, b);
    expect(w.slagPatches).toHaveLength(1);
    expect(w.slagPatches[0].x).toBeCloseTo(0);
    expect(w.slagPatches[0].y).toBeCloseTo(0);
    expect(w.stones).toHaveLength(0);
  });

  it('burns 3% max health every 0.5 s while a hero stands in it, and keeps burning until stage 3', () => {
    const { w, q, b } = fight();
    stage2(w, q, b);
    anvilfall(w, q, b);
    const p = w.heroData(0).player;
    p.x = 40; p.y = 0;
    p.hp = p.maxHp;
    const far = w.heroData(1).player;
    far.hp = far.maxHp;
    for (let t = 0; t < 1.01; t += 0.05) q.ondrelClock(0.05);
    expect((p.maxHp - p.hp) / p.maxHp).toBeGreaterThan(ONDRELV2.burn * 1.5);
    expect(far.hp).toBe(far.maxHp);
    // Still burning 20 s on.
    for (let t = 0; t < 20; t += 0.05) q.ondrelClock(0.05);
    p.hp = p.maxHp;
    for (let t = 0; t < 1; t += 0.05) q.ondrelClock(0.05);
    expect(p.hp).toBeLessThan(p.maxHp);
    // Out of it: no burn.
    p.x = 200; p.hp = p.maxHp;
    for (let t = 0; t < 1; t += 0.05) q.ondrelClock(0.05);
    expect(p.hp).toBe(p.maxHp);
  });

  it('keeps at most 4 patches: a fifth makes the oldest cool', () => {
    const { w, q, b } = fight();
    stage2(w, q, b);
    for (let k = 0; k < 5; k++) {
      w.heroData(0).player.x = -300 + k * 150;
      anvilfall(w, q, b);
    }
    expect(w.slagPatches).toHaveLength(ONDRELV2.cap);
    expect(w.slagPatches[0].x).toBeCloseTo(-150);
  });

  it('stage 3 at 25%: every patch glows, bursts and is gone, no more slag, and his move comes on the stage 3 timer', () => {
    const { w, q, b } = fight();
    stage2(w, q, b);
    w.heroData(0).player.x = -200; anvilfall(w, q, b);
    w.heroData(0).player.x = 200; anvilfall(w, q, b);
    w.enemies[b].hp = w.enemies[b].maxHp * ONDRELV2.stage3;
    q.ondrelClock(0.01);
    expect(q.ondrelStage).toBe(3);
    expect(w.slagPatches.every((a) => a.glow > 0)).toBe(true);
    expect(w.telegraphs.filter((t) => t.alive && t.r === ONDRELV2.burstR)).toHaveLength(2);
    for (let t = 0; t < ONDRELV2.glow + 0.1; t += 0.05) q.ondrelClock(0.05);
    expect(w.slagPatches).toHaveLength(0);
    anvilfall(w, q, b);
    expect(w.slagPatches).toHaveLength(0);
    q.choirT = 0;
    q.ondrelClock(0.01);
    expect(q.choirT).toBeCloseTo(ONDREL.choirEvery * ONDRELV2.lastChoir, 1);
  });

  it('a bot in burning slag steps out of it, away from its middle', () => {
    const { w, q, b } = fight();
    stage2(w, q, b);
    anvilfall(w, q, b);
    w.heroData(0).player.x = 30; w.heroData(0).player.y = 0;
    w.use(0);
    expect(botInput(w, 1).x).toBeGreaterThan(0.9);
  });

  it('a co-op guest gets the slag and the stage', () => {
    const { w, q, b } = fight();
    stage2(w, q, b);
    anvilfall(w, q, b);
    const g = new World({ seed: 3, dungeon: 'hammerdeep', tier: 6, omens: [], cls: 'bulwark', party, ondrelV2: true });
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect(g.slagPatches).toHaveLength(1);
    expect(g.ondrelStage).toBe(2);
  });
});
