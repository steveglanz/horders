import { describe, expect, it } from 'vitest';
import { World, COLD, SOLO_BOSS } from '../sim/world';
import { DUNGEONS, BOUNTY_DUNGEON_IDS } from '../sim/content/dungeon';

type Inner = {
  spawn(kind: string, x: number, y: number): number;
  startCast(i: number, id: string, name: string, dur: number, interruptible: boolean): void;
  finishCast(i: number): void;
  damageEnemy(i: number, amount: number, canCrit: boolean): void;
  killEnemy(i: number): void;
  coldClock(dt: number): void;
  bossIndex: number;
  nightT: number;
  snuffT: number;
  tideT: number;
};

/** A hero in a Coldmarrow fight with a full coal and no foes. */
function cold(cls: 'emberwright' | 'bulwark' = 'bulwark'): { w: World; inner: Inner } {
  const w = new World({ seed: 7, dungeon: 'coldmarrow', omens: [], cls });
  const inner = w as unknown as Inner;
  for (const e of w.enemies) e.alive = false;
  Object.assign(w.player, { x: 0, y: 0, coal: 1, coalR: COLD.maxR, chill: 0, chillT: 0 });
  return { w, inner };
}

describe('the Coldmarrow (C1)', () => {
  it('is a solo dungeon from tier 10, kept out of the daily bounty', () => {
    expect(DUNGEONS.coldmarrow.style).toBe('solo');
    expect(DUNGEONS.coldmarrow.unlockTier).toBe(10);
    expect(BOUNTY_DUNGEON_IDS).not.toContain('coldmarrow');
  });

  it('the Hearthcoal burns down, its light shrinks, and Chill builds once it is out', () => {
    const { w, inner } = cold();
    inner.coldClock(10);
    expect(w.player.coal).toBeCloseTo(1 - COLD.drain * 10, 5);
    expect(w.player.coalR).toBeLessThan(COLD.maxR);
    w.player.coal = 0;
    for (let k = 0; k < 10; k++) inner.coldClock(COLD.chillEvery);
    expect(w.player.chill).toBe(COLD.frozenAt);
    const fast = w.moveSpeed;
    w.player.chill = 0;
    expect(w.moveSpeed).toBeGreaterThan(fast);
  });

  it('a Snuffer kill gives the light back; other frost-touched kills feed a little', () => {
    const { w, inner } = cold();
    w.player.coal = 0.5;
    inner.killEnemy(inner.spawn('snuffer', 100, 0));
    expect(w.player.coal).toBeCloseTo(0.5 + COLD.snufferFeed, 5);
    inner.killEnemy(inner.spawn('rimehound', 100, 0));
    expect(w.player.coal).toBeCloseTo(0.5 + COLD.snufferFeed + COLD.feed, 5);
  });

  it('a Frost Warden cracks inside the light and shrugs off hits outside it', () => {
    const { w, inner } = cold();
    const near = inner.spawn('frostWarden', 60, 0);
    const far = inner.spawn('frostWarden', 600, 0);
    const hp = w.enemies[near].hp;
    inner.damageEnemy(near, 100, false);
    inner.damageEnemy(far, 100, false);
    expect(hp - w.enemies[near].hp).toBeCloseTo(100 * COLD.wardenWarm, 5);
    expect(hp - w.enemies[far].hp).toBeCloseTo(100 * COLD.wardenCold, 5);
  });

  it('the Long Night takes what a bright coal cannot hold back, and Snuff can be Quenched', () => {
    const hits: number[] = [];
    for (const coal of [1, 0.5, 0]) {
      const { w, inner } = cold('emberwright');
      const b = inner.spawn('nhevra', 0, -300);
      inner.bossIndex = b;
      w.player.coal = coal;
      const hp = w.player.hp;
      inner.startCast(b, 'longNight', 'Long Night', COLD.nightCast, false);
      inner.finishCast(b);
      hits.push(hp - w.player.hp);
    }
    expect(hits[0]).toBe(0);
    expect(hits[1]).toBeGreaterThan(0);
    expect(hits[2]).toBeGreaterThan(hits[1]);
    const { w, inner } = cold();
    const b = inner.spawn('nhevra', 0, -300);
    inner.bossIndex = b;
    Object.assign(inner, { nightT: 99, tideT: 99, snuffT: 0.5 });
    inner.coldClock(1);
    expect(w.enemies[b].castId).toBe('snuff');
    expect(w.enemies[b].interruptible).toBe(true);
  });

  it('Thin Ice: at half health the river cracks either side of Nhevra, and open water hurts and chills', () => {
    const { w, inner } = cold();
    const b = inner.spawn('nhevra', 0, -300);
    inner.bossIndex = b;
    Object.assign(inner, { nightT: 99, tideT: 99, snuffT: 99 });
    const e = w.enemies[b];
    inner.coldClock(0.1);
    expect(w.coldPhase).toBe(1);
    e.hp = e.maxHp * COLD.phase2 - 1;
    inner.coldClock(0.1);
    expect(w.coldPhase).toBe(2);
    expect(w.events.some((ev) => ev.type === 'phase' && ev.phase === 2)).toBe(true);
    expect(w.cracks.some((c) => c.alive)).toBe(false);
    inner.coldClock(COLD.firstCrack);
    const open = w.cracks.filter((c) => c.alive);
    expect(open).toHaveLength(COLD.crackLanes);
    // Nhevra stands midway between the two cracks.
    expect(w.crackDist(open[0], e.x, e.y)).toBeCloseTo(COLD.crackGap / 2, 3);
    // A warning isn't water yet.
    Object.assign(w.player, { x: open[0].x, y: open[0].y, coal: 1, chill: 0 });
    expect(w.inWater(w.player.x, w.player.y)).toBe(false);
    inner.coldClock(COLD.crackWarn);
    expect(w.inWater(w.player.x, w.player.y)).toBe(true);
    expect(w.riverOpen()).toBe(true);
    const hp = w.player.hp;
    const coal = w.player.coal ?? 0;
    inner.coldClock(0.5);
    expect(w.player.hp).toBeLessThan(hp);
    expect(w.player.coal ?? 0).toBeLessThan(coal - COLD.drain * 0.5);
    expect(w.player.chill ?? 0).toBeGreaterThan(0);
    // While the river is open she takes more damage.
    const before = e.hp;
    inner.damageEnemy(b, 100, false);
    expect(before - e.hp).toBeCloseTo(100 * (1 + COLD.thinIceExposed) * (SOLO_BOSS[w.cls] ?? 1), 3);
    // The cracks close again.
    inner.coldClock(COLD.crackOpen);
    expect(w.cracks.some((c) => c.alive)).toBe(false);
    expect(w.riverOpen()).toBe(false);
  });

  it('co-op: the Long Night hits a huddle softer, by each other living hero close by', () => {
    const hit = (spread: number): number[] => {
      const w = new World({ seed: 7, dungeon: 'coldmarrow', omens: [], cls: 'bulwark', party: [{ cls: 'lumen' }, { cls: 'emberwright' }] });
      const inner = w as unknown as Inner;
      for (const e of w.enemies) e.alive = false;
      w.heroes.forEach((_, k) => Object.assign(w.hero(k).player, { x: k * spread, y: 0, coal: 0, coalR: COLD.minR }));
      const b = inner.spawn('nhevra', 0, -400);
      inner.bossIndex = b;
      const before = w.heroes.map((_, k) => w.hero(k).player.hp);
      inner.startCast(b, 'longNight', 'Long Night', COLD.nightCast, false);
      inner.finishCast(b);
      return w.heroes.map((_, k) => before[k] - w.hero(k).player.hp);
    };
    const apart = hit(400);
    const close = hit(40);
    // Apart, each takes the full share of their max health; together, two others close by take 2 × huddleCut off.
    apart.forEach((d, k) => expect(close[k]).toBeCloseTo(d * (1 - 2 * COLD.huddleCut), 3));
  });
});
