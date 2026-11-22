import { describe, expect, it } from 'vitest';
import { World, REGENT, SUMMONS, REGENT_VARIANTS } from '../sim/world';
import { DUNGEONS, partyBlocker, rollRoute, raidCountsTriple } from '../sim/content/dungeon';
import { botFillBlocker } from '../sim/content/botfill';
import { ACHIEVEMENTS } from '../sim/content/achievements';
import { applySnapshot, snapshot } from '../sim/netsync';
import { decreePass, botInput, BOT_SUMMONS_LEAD } from '../sim/bot';

type Inner = {
  use(i: number): void;
  spawn(kind: string, x: number, y: number): number;
  finishCast(i: number): void;
  regentClock(dt: number): void;
  bossIndex: number;
  bossSpawned: boolean;
  decreeT: number;
  ashT: number;
  officeT: number;
  summonsT: number;
  tierDamage: number;
  rollRegentVariant(): string;
};

/** A Bulwark tank, a Lumen, a Duskblade and an Emberwright in the Flue with only the Regent up. */
function flue(): { w: World; inner: Inner; b: number } {
  const w = new World({ seed: 7, dungeon: 'flue', omens: [], cls: 'bulwark', worldBoss: 'The Furnace Regent',
    party: [{ cls: 'lumen' }, { cls: 'duskblade' }, { cls: 'emberwright' }] });
  const inner = w as unknown as Inner;
  for (const e of w.enemies) e.alive = false;
  const b = inner.spawn('regent', 0, 0);
  inner.bossIndex = b;
  inner.bossSpawned = true;
  inner.decreeT = 999;
  inner.ashT = 999;
  // Spread out, far enough apart that nobody scorches or touches anyone.
  w.heroes.forEach((h, k) => { h.player.x = 60 + k * 200; h.player.y = 0; });
  return { w, inner, b };
}

describe('raid 4: the Furnace Regent in the Flue (B1)', () => {
  it('is a four-hero raid with no bot fill, its own achievement, and triple credit while he is live', () => {
    const d = DUNGEONS.flue;
    expect(d.raid).toBe(true);
    expect(d.minParty).toBe(4);
    expect(partyBlocker('flue', 3)).not.toBe('');
    expect(botFillBlocker('flue')).not.toBe('');
    expect(raidCountsTriple('flue', 'The Furnace Regent')).toBe(true);
    expect(raidCountsTriple('flue', 'Old Vorhulm')).toBe(false);
    let n = 0;
    expect(rollRoute(() => n++ % 2, 'flue')[3]).toBe('regent');
    expect(ACHIEVEMENTS.find((a) => a.id === 'boss:flue')?.name).toBe('Sealbreaker');
  });

  it('a Decree never lands on the tank', () => {
    for (let s = 0; s < 20; s++) {
      const { w, inner } = flue();
      inner.decreeT = 0;
      inner.regentClock(0.01);
      expect(w.regentDecree).toHaveLength(1);
      expect(w.regentDecree[0].hero).not.toBe(0);
      expect(w.isTank(w.regentDecree[0].hero)).toBe(false);
    }
  });

  it('a Decree burns its holder and anyone close, but not someone far off', () => {
    const { w, inner } = flue();
    w.regentDecree = [{ hero: 1, t: REGENT.decreeTime, passes: 0, held: REGENT.settle }];
    w.heroes[2].player.x = w.heroes[1].player.x + 50; // 58 away: inside the scorch (70), outside the hand-off (50)
    w.heroes[2].player.y = 30;
    w.heroes[2].player.spentT = 99; // can't take it, so it stays put
    w.heroes[3].player.x = 2000;
    inner.regentClock(0.5);
    expect(w.heroes[1].player.hp).toBeLessThan(w.heroes[1].player.maxHp);
    expect(w.heroes[2].player.hp).toBeLessThan(w.heroes[2].player.maxHp);
    expect(w.heroes[3].player.hp).toBe(w.heroes[3].player.maxHp);
  });

  it('passes by touch only after it settles; the passer is Spent; it fades after the last pass', () => {
    const { w, inner } = flue();
    w.regentDecree = [{ hero: 1, t: REGENT.decreeTime, passes: 0, held: 0 }];
    w.heroes[2].player.x = w.heroes[1].player.x + 10;
    w.heroes[3].player.x = 4000;
    inner.regentClock(0.1);
    expect(w.regentDecree[0].hero).toBe(1); // not settled yet
    inner.regentClock(REGENT.settle);
    expect(w.events).toContainEqual({ type: 'decreePassed', from: 1, hero: 2, done: false });
    expect(w.regentDecree[0].hero).toBe(2);
    expect(w.heroes[1].player.spentT).toBeCloseTo(REGENT.spentTime, 5);
    // Spent: hero 1 can't take it back, so it stays on hero 2 even though they are touching.
    inner.regentClock(REGENT.settle + 0.01);
    expect(w.regentDecree[0].hero).toBe(2);
    // The tank can take one passed by hand, and that is the last pass.
    w.heroes[0].player.x = w.heroes[2].player.x + 10;
    inner.regentClock(0.1);
    expect(w.events).toContainEqual({ type: 'decreePassed', from: 2, hero: 0, done: REGENT.decreePasses === 2 });
    if (REGENT.decreePasses === 2) expect(w.regentDecree).toHaveLength(0);
  });

  it('in Edict a Decree fades after one pass', () => {
    const { w, inner, b } = flue();
    const e = w.enemies[b];
    e.hp = e.maxHp * (REGENT.phase2 - 0.01);
    w.regentDecree = [{ hero: 1, t: REGENT.decreeTime, passes: 0, held: REGENT.settle }];
    w.heroes[2].player.x = w.heroes[1].player.x + 10;
    inner.regentClock(0.01);
    expect(w.bossPhase).toBe(2);
    expect(w.events).toContainEqual({ type: 'decreePassed', from: 1, hero: 2, done: REGENT.edictPasses === 1 });
    expect(w.regentDecree).toHaveLength(REGENT.edictPasses === 1 ? 0 : 1);
  });

  it('bursts on the whole party when its time runs out', () => {
    const { w, inner } = flue();
    w.regentDecree = [{ hero: 2, t: 0.05, passes: 0, held: 0 }];
    inner.regentClock(0.1);
    expect(w.regentDecree).toHaveLength(0);
    expect(w.events).toContainEqual({ type: 'decreeBurst', hero: 2 });
    for (const h of w.heroes) expect(h.player.hp).toBeLessThan(h.player.maxHp * (1 - REGENT.decreeBurst * 0.5));
  });

  it('bursts when its holder falls', () => {
    const { w, inner } = flue();
    w.regentDecree = [{ hero: 3, t: REGENT.decreeTime, passes: 0, held: 0 }];
    w.heroes[3].player.hp = 0;
    inner.regentClock(0.01);
    expect(w.events).toContainEqual({ type: 'decreeBurst', hero: 3 });
    expect(w.heroes[0].player.hp).toBeLessThan(w.heroes[0].player.maxHp);
  });

  it('Edict (phase 2): two Decrees at once, and Ash Fall marks every hero', () => {
    const { w, inner, b } = flue();
    const e = w.enemies[b];
    e.hp = e.maxHp * (REGENT.phase2 - 0.01);
    inner.decreeT = 0;
    inner.ashT = 0;
    inner.regentClock(0.01);
    expect(w.bossPhase).toBe(2);
    expect(w.regentDecree).toHaveLength(2);
    expect(new Set(w.regentDecree.map((d) => d.hero)).size).toBe(2);
    expect(w.telegraphs.filter((t) => t.alive && t.owner === b && t.shape === 'circle')).toHaveLength(4);
    // Ash Fall is scaled by tier once, when it lands, like every telegraph (it used to be scaled twice).
    for (const t of w.telegraphs.filter((t) => t.alive && t.owner === b && t.shape === 'circle')) expect(t.dmg).toBe(REGENT.ashDamage);
  });

  it('Abdication (phase 3): the Decrees lapse and Embers of Office pulses grow', () => {
    const { w, inner, b } = flue();
    const e = w.enemies[b];
    w.regentDecree = [{ hero: 1, t: REGENT.decreeTime, passes: 0, held: 0 }];
    e.hp = e.maxHp * (REGENT.phase3 - 0.01);
    inner.regentClock(0.01);
    expect(w.bossPhase).toBe(3);
    expect(w.regentDecree).toHaveLength(0);
    inner.decreeT = 0;
    inner.officeT = 0;
    const hp0 = w.heroes[0].player.hp;
    inner.regentClock(0.01);
    expect(w.regentDecree).toHaveLength(0); // no new Decrees in phase 3
    expect(w.events).toContainEqual({ type: 'officePulse', n: 1 });
    const first = hp0 - w.heroes[0].player.hp;
    expect(first).toBeGreaterThan(0);
    inner.officeT = 0;
    const hp1 = w.heroes[0].player.hp;
    inner.regentClock(0.01);
    expect(hp1 - w.heroes[0].player.hp).toBeGreaterThan(first);
  });

  it('Last Word starts at the hard enrage and wipes the party', () => {
    const { w, inner, b } = flue();
    w.enemies[b].spawnedAt = w.time - REGENT.hardEnrage;
    inner.regentClock(0.01);
    expect(w.enemies[b].castId).toBe('lastWord');
    inner.finishCast(b);
    expect(w.heroes.every((h) => h.player.hp <= 0)).toBe(true);
  });

  it('bots: the holder walks to an ally who can take it; the tank waits', () => {
    const { w, inner } = flue();
    w.regentDecree = [{ hero: 1, t: REGENT.decreeTime, passes: 0, held: 0 }];
    inner.use(1);
    const m = decreePass(w);
    expect(m).not.toBeNull();
    expect(m!.dx).toBeLessThan(0); // toward the tank, who is the nearest who can take it by hand
    inner.use(0);
    expect(decreePass(w)).toBeNull();
    inner.use(2);
    const meet = decreePass(w);
    expect(meet).not.toBeNull();
    expect(meet!.dx).toBeLessThan(0); // the nearest able non-tank walks to meet the holder
    inner.use(0);
  });

  it('online co-op: a guest sees who holds each Decree', () => {
    const { w } = flue();
    w.regentDecree = [{ hero: 2, t: 3.5, passes: 1, held: 1 }];
    const g = flue().w;
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect(g.regentDecree).toEqual([{ hero: 2, t: 3.5, passes: 1, held: 1 }]);
  });
});

describe('Phase 12 W3: the Furnace Regent\'s Summons', () => {
  it('rolls from the seed alone, and both versions show up', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const a = new World({ seed, dungeon: 'flue', omens: [], cls: 'bulwark' }) as unknown as Inner;
      const b = new World({ seed, dungeon: 'flue', omens: [], cls: 'bulwark' }) as unknown as Inner;
      expect(a.rollRegentVariant()).toBe(b.rollRegentVariant());
      seen.add(a.rollRegentVariant());
    }
    expect([...seen].sort()).toEqual([...REGENT_VARIANTS].sort());
  });

  it('in court, Ash Fall comes with a Summons; when it lands only heroes outside the ring are struck', () => {
    const { w, inner, b } = flue();
    w.bossVariant = 'court';
    const e = w.enemies[b];
    e.hp = e.maxHp * (REGENT.phase2 - 0.01);
    inner.ashT = 0;
    inner.regentClock(0.01);
    expect(inner.summonsT).toBeCloseTo(SUMMONS.warn, 5);
    expect(w.telegraphs.filter((t) => t.alive && t.owner === b && t.shape === 'circle')).toHaveLength(4);
    // Hero 0 inside the ring, the rest well outside it. Clear the ash so only the Summons hurts.
    for (const t of w.telegraphs) t.alive = false;
    w.heroes[0].player.x = SUMMONS.radius - 20;
    w.heroes.forEach((h, k) => { if (k) h.player.x = SUMMONS.radius + 150 + k * 10; });
    const before = w.heroes.map((h) => h.player.hp);
    inner.summonsT = 0.01;
    inner.regentClock(0.02);
    expect(inner.summonsT).toBe(0);
    expect(w.heroes[0].player.hp).toBe(before[0]);
    for (let k = 1; k < 4; k++) expect(w.heroes[k].player.hp).toBeLessThan(before[k]);
  });

  it('the other version calls no Summons', () => {
    const { w, inner, b } = flue();
    w.bossVariant = 'ash';
    w.enemies[b].hp = w.enemies[b].maxHp * (REGENT.phase2 - 0.01);
    inner.ashT = 0;
    inner.regentClock(0.01);
    expect(inner.summonsT).toBe(0);
  });

  it('bots: step out of an ash circle first, then walk into the ring', () => {
    const { w, inner, b } = flue();
    w.bossVariant = 'court';
    inner.use(3);
    const p = w.player;
    p.x = 400; p.y = 0;
    inner.summonsT = 2;
    const go = botInput(w, 1);
    expect(go.x).toBeLessThan(0); // toward the Regent at 0,0
    // Standing in a live circle, the bot does not walk in yet.
    (w as unknown as { addTelegraph(...a: unknown[]): void }).addTelegraph('circle', 370, 0, REGENT.ashRadius, 0, 0, REGENT.ashCast, 10, 'hit', b);
    const out = botInput(w, 1);
    expect(out.x).toBeGreaterThan(0); // out of the circle first, away from him
    inner.use(0);
  });

  it('bots: walk in to the throne before the Summons is due, and only in court phase 2', () => {
    const { w, inner } = flue();
    w.bossVariant = 'court';
    w.bossPhase = 2;
    inner.summonsT = 0;
    inner.ashT = BOT_SUMMONS_LEAD - 0.5;
    expect(w.summonsDue()).toBeCloseTo(BOT_SUMMONS_LEAD - 0.5, 5);
    inner.use(3);
    w.player.x = 400; w.player.y = 0;
    const go = botInput(w, 1);
    expect(go.x).toBeLessThan(-0.9); // straight at the Regent at 0,0
    inner.use(0);
    // Phase 1, the Ash version, or a Summons already called: nothing is due.
    w.bossPhase = 1;
    expect(w.summonsDue()).toBe(Infinity);
    w.bossPhase = 2;
    w.bossVariant = 'ash';
    expect(w.summonsDue()).toBe(Infinity);
    w.bossVariant = 'court';
    inner.summonsT = 1;
    expect(w.summonsDue()).toBe(Infinity);
  });

  it('online co-op: a guest sees the Summons coming', () => {
    const { w, inner } = flue();
    inner.summonsT = 1.5;
    const g = flue().w;
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect((g as unknown as Inner).summonsT).toBe(1.5);
  });
});
