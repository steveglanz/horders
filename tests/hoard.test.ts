import { describe, expect, it } from 'vitest';
import { World, COAL, BANK, INHALE, VORHULM_VARIANTS } from '../sim/world';
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
  updatePartyTelegraphs(dt: number): void;
  rollVorhulmVariant(): string;
};

/** A Bulwark and three Emberwrights in the Hoard, Old Vorhulm beside them and no other foes. */
function hoard(): { w: World; inner: Inner; b: number } {
  const w = new World({ seed: 5, dungeon: 'hoard', omens: [], cls: 'bulwark', worldBoss: 'Old Vorhulm',
    party: [{ cls: 'emberwright' }, { cls: 'emberwright' }, { cls: 'emberwright' }] });
  const inner = w as unknown as Inner;
  for (const e of w.enemies) e.alive = false;
  const b = inner.spawn('vorhulm', 0, -200);
  inner.bossIndex = b;
  // Keep the timers out of the way unless a test sets them.
  inner.gorgeT = 999;
  inner.swallowT = 999;
  inner.spillT = 999;
  w.heroes.forEach((h, k) => { h.player.x = -150 + k * 100; h.player.y = 0; });
  return { w, inner, b };
}

describe('raid 2: Old Vorhulm in the Hoard (W2)', () => {
  it('is a four-hero raid with no bot fill, its own achievement, and triple credit while he is live', () => {
    const d = DUNGEONS.hoard;
    expect(d.raid).toBe(true);
    expect(d.style).toBe('group');
    expect(partyBlocker('hoard', 3)).not.toBe('');
    expect(partyBlocker('hoard', 4)).toBe('');
    expect(botFillBlocker('hoard')).not.toBe('');
    expect(raidCountsTriple('hoard', 'Old Vorhulm')).toBe(true);
    expect(raidCountsTriple('hoard', 'Grandmother Slag')).toBe(false);
    let n = 0;
    expect(rollRoute(() => n++ % 2, 'hoard')[3]).toBe('vorhulm');
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

  it('Swallow takes the non-tank who has dealt the most damage, who is safe inside until the Craw breaks and spits them out shielded', () => {
    const { w, inner, b } = hoard();
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
    // The Bulwark has dealt the most, but tanks are never swallowed; distance no longer matters.
    const dealt = [5000, 100, 200, 900];
    dealt.forEach((d, k) => { (k === 0 ? (w as unknown as { damageDealt: number }) : w.heroes[k]).damageDealt = d; });
    w.heroes[1].player.x = 2000;
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
    // The drain alone can't down them: just before the clock runs out they are still in there at 1 hp or more.
    w.heroes[k].player.hp = 5;
    for (let t = 0; t < COAL.swallowTime - 0.3; t += 0.1) inner.coalClock(0.1);
    expect(w.heroes[k].player.hp).toBeGreaterThanOrEqual(1);
    expect(inner.swallowed).toBe(k);
    for (let t = 0; t < 0.8; t += 0.1) inner.coalClock(0.1);
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

describe('Phase 12 W3: Old Vorhulm\'s Banked Coals', () => {
  it('rolls from the seed alone, and both versions show up', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const a = new World({ seed, dungeon: 'hoard', omens: [], cls: 'bulwark' }) as unknown as Inner;
      const b = new World({ seed, dungeon: 'hoard', omens: [], cls: 'bulwark' }) as unknown as Inner;
      expect(a.rollVorhulmVariant()).toBe(b.rollVorhulmVariant());
      seen.add(a.rollVorhulmVariant());
    }
    expect([...seen].sort()).toEqual([...VORHULM_VARIANTS].sort());
  });

  it('in phase 3 lays gold circles instead of embers; a smothered one is safe, an empty one feeds him', () => {
    const { w, inner, b } = hoard();
    w.bossVariant = 'bank';
    const e = w.enemies[b];
    e.hp = e.maxHp * 0.2;
    inner.spillT = 0;
    inner.coalClock(1 / 30);
    expect(w.coalEmbers).toHaveLength(0);
    const coals = w.telegraphs.filter((t) => t.alive && t.kind === 'soak' && t.owner === -4);
    expect(coals).toHaveLength(BANK.count);
    expect(w.events.some((ev) => ev.type === 'castStart' && ev.id === 'bankedCoals')).toBe(true);
    // Hero 0 stands on the first coal; the rest are left empty.
    w.heroes.forEach((h, k) => { h.player.x = k === 0 ? coals[0].x : 500; h.player.y = k === 0 ? coals[0].y : 500 - k * 5; });
    for (const t of coals.slice(1)) if (Math.hypot(t.x - 500, t.y - 500) < 80) { t.x = -500; t.y = -500; }
    const hpHeroes = w.heroes.map((h) => h.player.hp);
    const fed = w.coalFed;
    const hp = e.hp;
    for (const t of coals) t.t = t.dur - 0.001;
    inner.updatePartyTelegraphs(0.01);
    expect(w.coalFed).toBe(fed + BANK.count - 1);
    expect(e.hp).toBeGreaterThan(hp);
    // No blast on the party and no adds.
    expect(w.heroes.map((h) => h.player.hp)).toEqual(hpHeroes);
    expect(w.enemies.filter((x) => x.alive && x.kind === 'ashling')).toHaveLength(0);
  });

  it('Y3 Inhale: in phase 3 he warns, then draws every hero in; anyone at his mouth is bitten; no embers', () => {
    const { w, inner, b } = hoard();
    w.bossVariant = 'inhale';
    const e = w.enemies[b];
    e.hp = e.maxHp * 0.2;
    inner.spillT = 0;
    inner.coalClock(1 / 30);
    expect(w.coalEmbers).toHaveLength(0);
    expect(w.inhaleStage).toBe(1);
    expect(w.events.some((ev) => ev.type === 'castStart' && ev.id === 'inhale')).toBe(true);
    // Hero 0 at his mouth, hero 1 far off.
    const mouth = w.heroData(0).player, far = w.heroData(1).player;
    mouth.x = e.x + e.def.radius + 10; mouth.y = e.y;
    far.x = e.x; far.y = e.y + 400;
    inner.coalClock(INHALE.warn + 0.001);
    expect(w.inhaleStage).toBe(2);
    const d0 = Math.hypot(far.x - e.x, far.y - e.y);
    const hp0 = mouth.hp, hp1 = far.hp;
    inner.spillT = 999;
    for (let k = 0; k < 15; k++) inner.coalClock(1 / 30);
    expect(Math.hypot(far.x - e.x, far.y - e.y)).toBeLessThan(d0);
    expect(mouth.hp).toBeLessThan(hp0);
    expect(far.hp).toBe(hp1);
    inner.coalClock(INHALE.time);
    expect(w.inhaleStage).toBe(0);
  });
});

describe('Phase 16 U1: Old Vorhulm\'s echo', () => {
  const spill = (w: World, inner: Inner) => {
    for (const t of w.telegraphs) t.alive = false;
    w.inhaleStage = 0; inner.spillT = 0; w.events.length = 0;
    inner.coalClock(0.01);
    const c = w.events.find((x) => x.type === 'castStart' && ['inhale', 'bankedCoals', 'emberSpill'].includes((x as { id: string }).id)) as { id: string } | undefined;
    return { id: c?.id, echo: w.events.some((x) => x.type === 'echo') };
  };

  it('in his last phase every other spill is his echo, the first one first', () => {
    const { w, inner, b } = hoard();
    w.bossVariant = 'spill'; w.bossEcho = 'inhale'; w.echoNext = true;
    w.enemies[b].hp = w.enemies[b].maxHp * 0.2;
    expect(spill(w, inner)).toEqual({ id: 'inhale', echo: true });
    expect(spill(w, inner)).toEqual({ id: 'emberSpill', echo: false });
    expect(spill(w, inner)).toEqual({ id: 'inhale', echo: true });
  });

  it('a Banked Coals echo on an Inhale run', () => {
    const { w, inner, b } = hoard();
    w.bossVariant = 'inhale'; w.bossEcho = 'bank'; w.echoNext = true;
    w.enemies[b].hp = w.enemies[b].maxHp * 0.2;
    expect(spill(w, inner)).toEqual({ id: 'bankedCoals', echo: true });
    expect(w.telegraphs.some((t) => t.alive && t.owner === -4)).toBe(true);
    expect(spill(w, inner)).toEqual({ id: 'inhale', echo: false });
  });
});
