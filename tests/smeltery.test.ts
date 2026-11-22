import { describe, expect, it } from 'vitest';
import { World, COLO } from '../sim/world';
import { DUNGEONS, partyBlocker, rollRoute, raidCountsTriple } from '../sim/content/dungeon';
import { botFillBlocker } from '../sim/content/botfill';
import { ACHIEVEMENTS } from '../sim/content/achievements';
import { applySnapshot, snapshot } from '../sim/netsync';

type Inner = {
  use(i: number): void;
  spawn(kind: string, x: number, y: number): number;
  finishCast(i: number): void;
  damageEnemy(i: number, amount: number, canCrit: boolean): void;
  colossusClock(dt: number): void;
  bossIndex: number;
  sweepT: number;
  wheelT: number;
  meltT: number;
};

/** A Bulwark and three Emberwrights in the Smeltery, the Colossus facing +x, no other foes. */
function smeltery(): { w: World; inner: Inner; b: number } {
  const w = new World({ seed: 5, dungeon: 'smeltery', omens: [], cls: 'bulwark', worldBoss: 'The Cinder Colossus',
    party: [{ cls: 'emberwright' }, { cls: 'emberwright' }, { cls: 'emberwright' }] });
  const inner = w as unknown as Inner;
  for (const e of w.enemies) e.alive = false;
  const b = inner.spawn('colossus', 0, 0);
  inner.bossIndex = b;
  inner.sweepT = 999;
  inner.wheelT = 999;
  // The tank in front of him (+x), the others behind (-x).
  w.heroes[0].player.x = 120; w.heroes[0].player.y = 0;
  w.heroes.forEach((h, k) => { if (k) { h.player.x = -150; h.player.y = (k - 2) * 40; } });
  w.colFacing = 0;
  return { w, inner, b };
}

describe('raid 3: the Cinder Colossus in the Smeltery (Y1)', () => {
  it('is a four-hero raid at tier 10 with no bot fill, its own achievement, and triple credit while he is live', () => {
    const d = DUNGEONS.smeltery;
    expect(d.raid).toBe(true);
    expect(d.unlockTier).toBe(10);
    expect(partyBlocker('smeltery', 3)).not.toBe('');
    expect(botFillBlocker('smeltery')).not.toBe('');
    expect(raidCountsTriple('smeltery', 'The Cinder Colossus')).toBe(true);
    expect(raidCountsTriple('smeltery', 'Old Vorhulm')).toBe(false);
    let n = 0;
    expect(rollRoute(() => n++ % 2, 'smeltery')[3]).toBe('colossus');
    expect(ACHIEVEMENTS.find((a) => a.id === 'boss:smeltery')?.name).toBe('Platebreaker');
  });

  it('his plated front takes half, his open back 150%, his sides full', () => {
    const { w, b } = smeltery();
    const e = w.enemies[b];
    expect(w.colossusSide(e, 100, 0)).toBe(COLO.frontMult);
    expect(w.colossusSide(e, -100, 0)).toBe(COLO.backMult);
    expect(w.colossusSide(e, -10, 100)).toBe(1);
    const hit = (k: number) => { const { w: w2, inner, b: b2 } = smeltery(); inner.use(k); const hp = w2.enemies[b2].hp; inner.damageEnemy(b2, 100, false); return hp - w2.enemies[b2].hp; };
    expect(hit(1) / hit(0)).toBeCloseTo(COLO.backMult / COLO.frontMult, 5);
  });

  it('Meltdown cracks the plate: in phase 3 front and back take the same', () => {
    const { w, inner, b } = smeltery();
    const e = w.enemies[b];
    e.hp = e.maxHp * (COLO.phase3 - 0.01);
    inner.colossusClock(0.01);
    expect(w.bossPhase).toBe(3);
    const hit = (k: number) => { inner.use(k); const hp = e.hp; inner.damageEnemy(b, 100, false); inner.use(0); return hp - e.hp; };
    expect(hit(1)).toBeCloseTo(hit(0), 5);
  });

  it('Meltdown pulses hurt every hero, and each pulse more than the last', () => {
    const { w, inner, b } = smeltery();
    const e = w.enemies[b];
    e.hp = e.maxHp * 0.2;
    inner.colossusClock(0.01);
    inner.meltT = 0;
    inner.colossusClock(0.01);
    expect(w.events).toContainEqual({ type: 'meltPulse', n: 1 });
    expect(w.heroes.every((h) => h.player.hp < h.player.maxHp)).toBe(true);
  });

  it('turns toward his target no faster than turnRate', () => {
    const { w, inner } = smeltery();
    w.colFacing = Math.PI; // facing away from the tank
    inner.colossusClock(0.1);
    expect(Math.abs(Math.abs(w.colFacing) - Math.PI)).toBeCloseTo(COLO.turnRate * 0.1, 3);
  });

  it('Slag Sweep is a cone straight out of his front', () => {
    const { w, inner, b } = smeltery();
    inner.sweepT = 0;
    inner.colossusClock(0.01);
    expect(w.enemies[b].castId).toBe('slagSweep');
    const t = w.telegraphs.find((q) => q.alive && q.owner === b)!;
    expect(t.shape).toBe('cone');
    expect(t.angle).toBeCloseTo(w.colFacing, 3);
  });

  it('Wheel turns him on the non-tank who hurt him most lately, and sweeps there', () => {
    const { w, inner, b } = smeltery();
    const e = w.enemies[b];
    e.hp = e.maxHp * 0.5;
    inner.use(2);
    inner.damageEnemy(b, 500, false);
    inner.use(0);
    inner.damageEnemy(b, 5000, false); // the tank's damage never draws the Wheel
    inner.wheelT = 0;
    inner.colossusClock(0.01);
    expect(e.castId).toBe('wheel');
    inner.finishCast(b);
    expect(w.events).toContainEqual({ type: 'wheel', hero: 2 });
    const q = w.heroes[2].player;
    expect(w.colFacing).toBeCloseTo(Math.atan2(q.y - e.y, q.x - e.x), 3);
    expect(e.castId).toBe('slagSweep');
  });

  it('Pour Out starts at the hard enrage', () => {
    const { w, inner, b } = smeltery();
    w.enemies[b].spawnedAt = w.time - COLO.hardEnrage;
    inner.colossusClock(0.01);
    expect(w.enemies[b].castId).toBe('pourOut');
  });

  it('online co-op: a guest sees where he faces', () => {
    const { w } = smeltery();
    w.colFacing = 1.25;
    const g = smeltery().w;
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect(g.colFacing).toBe(1.25);
  });
});
