import { describe, expect, it } from 'vitest';
import { World, COAL } from '../sim/world';
import { DUNGEONS, partyBlocker, rollRoute, raidCountsTriple } from '../sim/content/dungeon';
import { botFillBlocker } from '../sim/content/botfill';
import { ACHIEVEMENTS } from '../sim/content/achievements';
import { applySnapshot, snapshot } from '../sim/netsync';

type Inner = {
  use(i: number): void;
  spawn(kind: string, x: number, y: number): number;
  finishCast(i: number): void;
  damageEnemy(i: number, amount: number, canCrit: boolean): void;
  hurtPlayer(amount: number): void;
  coalClock(dt: number): void;
  bossIndex: number;
  swallowed: number;
  crawIndex: number;
  gorgeT: number;
  swallowT: number;
  spillT: number;
};

/** A Bulwark and three Emberwrights in the Hoard, Old Coalmouth beside them and no other foes. */
function hoard(): { w: World; inner: Inner; b: number } {
  const w = new World({ seed: 5, dungeon: 'hoard', omens: [], cls: 'bulwark', worldBoss: 'Old Coalmouth',
    party: [{ cls: 'emberwright' }, { cls: 'emberwright' }, { cls: 'emberwright' }] });
  const inner = w as unknown as Inner;
  for (const e of w.enemies) e.alive = false;
  const b = inner.spawn('coalmouth', 0, -200);
  inner.bossIndex = b;
  // Keep the timers out of the way unless a test sets them.
  inner.gorgeT = 999;
  inner.swallowT = 999;
  inner.spillT = 999;
  w.heroes.forEach((h, k) => { h.player.x = -150 + k * 100; h.player.y = 0; });
  return { w, inner, b };
}

describe('raid 2: Old Coalmouth in the Hoard (W2)', () => {
  it('is a four-hero raid with no bot fill, its own achievement, and triple credit while he is live', () => {
    const d = DUNGEONS.hoard;
    expect(d.raid).toBe(true);
    expect(d.style).toBe('group');
    expect(partyBlocker('hoard', 3)).not.toBe('');
    expect(partyBlocker('hoard', 4)).toBe('');
    expect(botFillBlocker('hoard')).not.toBe('');
    expect(raidCountsTriple('hoard', 'Old Coalmouth')).toBe(true);
    expect(raidCountsTriple('hoard', 'Grandmother Slag')).toBe(false);
    let n = 0;
    expect(rollRoute(() => n++ % 2, 'hoard')[3]).toBe('coalmouth');
    expect(ACHIEVEMENTS.find((a) => a.id === 'boss:hoard')?.name).toBe('Crawbreaker');
  });

  it('changes phase at 60% and 25% of his health', () => {
    const { w, inner, b } = hoard();
    const e = w.enemies[b];
    e.hp = e.maxHp * 0.59;
    inner.coalClock(0.01);
    expect(w.bossPhase).toBe(2);
    e.hp = e.maxHp * 0.24;
    inner.coalClock(0.01);
    expect(w.bossPhase).toBe(3);
  });

  it('Gorge is an interruptible cast that heals him when it lands', () => {
    const { w, inner, b } = hoard();
    const e = w.enemies[b];
    inner.gorgeT = 0;
    e.hp = e.maxHp * 0.7;
    inner.coalClock(0.01);
    expect(e.castId).toBe('coalGorge');
    expect(e.interruptible).toBe(true);
    inner.finishCast(b);
    expect(e.hp / e.maxHp).toBeCloseTo(0.7 + COAL.gorgeHeal, 3);
  });

  it('Swallow takes the furthest non-tank, who is safe inside until the Craw breaks and spits them out shielded', () => {
    const { w, inner, b } = hoard();
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
    w.heroes[0].player.x = 2000; // the Bulwark is furthest, but tanks are never swallowed
    w.heroes[3].player.x = 300;
    inner.swallowT = 0;
    inner.coalClock(0.01);
    expect(inner.swallowed).toBe(3);
    expect(w.events).toContainEqual({ type: 'swallowed', hero: 3 });
    const craw = inner.crawIndex;
    expect(w.enemies[craw].kind).toBe('craw');
    // Inside, the boss's other attacks can't reach them.
    inner.use(3);
    const hp = w.player.hp;
    inner.hurtPlayer(50);
    expect(w.player.hp).toBe(hp);
    inner.use(0);
    inner.damageEnemy(craw, 1e9, false);
    expect(inner.swallowed).toBe(-1);
    expect(inner.crawIndex).toBe(-1);
    const q = w.heroes[3].player;
    expect(q.hp).toBeGreaterThan(0);
    expect(q.shieldT).toBeGreaterThanOrEqual(COAL.spitShield);
    expect(w.events).toContainEqual({ type: 'spatOut', hero: 3 });
  });

  it('a hero left inside for the whole Swallow is digested, and the Craw goes with them', () => {
    const { w, inner, b } = hoard();
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
    inner.swallowT = 0;
    inner.coalClock(0.01);
    const k = inner.swallowed;
    const craw = inner.crawIndex;
    expect(k).toBeGreaterThan(0);
    for (let t = 0; t < COAL.swallowTime + 0.5; t += 0.1) inner.coalClock(0.1);
    expect(w.heroes[k].player.hp).toBe(0);
    expect(w.enemies[craw].alive).toBe(false);
    expect(w.events).toContainEqual({ type: 'digested', hero: k });
  });

  it('a hero still inside when he falls comes out with the win, so nobody ends the run swallowed', () => {
    const { w, inner, b } = hoard();
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
    inner.swallowT = 0;
    inner.coalClock(0.01);
    const k = inner.swallowed;
    expect(k).toBeGreaterThan(0);
    inner.damageEnemy(b, 1e9, false);
    const idle = w.heroes.map(() => ({ x: 0, y: 0 }));
    for (let n = 0; n < 600 && w.state !== 'ended'; n++) w.step(idle);
    expect(w.state).toBe('ended');
    expect(w.summary().victory).toBe(true);
    expect(w.heroes[k].player.swallowT ?? 0).toBe(0);
    expect(w.heroes[k].player.hp).toBeGreaterThan(0);
    expect(inner.swallowed).toBe(-1);
  });

  it('Ember Feast: an ember a hero grabs is gone; one left too long feeds him, and every one fed makes him hit harder', () => {
    const { w, inner, b } = hoard();
    const e = w.enemies[b];
    e.hp = e.maxHp * 0.2;
    inner.spillT = 0;
    inner.coalClock(0.01);
    expect(w.coalEmbers).toHaveLength(COAL.spillN);
    // A hero stands on the first ember.
    const m = w.coalEmbers[0];
    w.heroes[1].player.x = m.x;
    w.heroes[1].player.y = m.y;
    inner.coalClock(0.01);
    expect(w.coalEmbers.length).toBeLessThan(COAL.spillN);
    // Everyone steps far away and the rest burn out into him.
    w.heroes.forEach((h) => { h.player.x = 5000; h.player.y = 5000; });
    const left = w.coalEmbers.length;
    const hp = e.hp;
    inner.coalClock(COAL.emberLife + 0.1);
    expect(w.coalEmbers).toHaveLength(0);
    expect(w.coalFed).toBe(left);
    expect(e.hp).toBeGreaterThan(hp);
  });

  it('Last Meal starts at the hard enrage', () => {
    const { w, inner, b } = hoard();
    const e = w.enemies[b];
    e.spawnedAt = w.time - COAL.hardEnrage;
    inner.coalClock(0.01);
    expect(e.castId).toBe('lastMeal');
    expect(e.interruptible).toBe(false);
  });

  it('online co-op: a guest sees the spilled embers and who is swallowed', () => {
    const { w, inner, b } = hoard();
    w.enemies[b].hp = w.enemies[b].maxHp * 0.2;
    inner.spillT = 0;
    inner.swallowT = 0;
    inner.coalClock(0.01);
    const g = hoard().w;
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect(g.coalEmbers).toEqual(w.coalEmbers);
    expect((g as unknown as Inner).swallowed).toBe(inner.swallowed);
  });
});
