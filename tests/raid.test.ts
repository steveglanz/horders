import { describe, expect, it } from 'vitest';
import { World, SLAG } from '../sim/world';
import { DUNGEONS, partyBlocker, rollRoute } from '../sim/content/dungeon';

type Inner = {
  use(i: number): void;
  spawn(kind: string, x: number, y: number): number;
  startCast(i: number, id: string, name: string, dur: number, interruptible: boolean): void;
  finishCast(i: number): void;
  damageEnemy(i: number, amount: number, canCrit: boolean): void;
  slagClock(dt: number): void;
  ladleTarget: number;
  bossIndex: number;
  raidStart: number;
  raidVentT: number;
};

/** Four Emberwrights in the Crucible with Grandmother Slag beside them and no other foes. */
function raid(): { w: World; inner: Inner; b: number } {
  const w = new World({ seed: 5, dungeon: 'crucible', omens: [], cls: 'emberwright', worldBoss: 'Grandmother Slag',
    party: [{ cls: 'emberwright' }, { cls: 'emberwright' }, { cls: 'emberwright' }] });
  const inner = w as unknown as Inner;
  for (const e of w.enemies) e.alive = false;
  const b = inner.spawn('grandmotherSlag', 0, -200);
  inner.bossIndex = b;
  inner.raidStart = w.time;
  return { w, inner, b };
}

describe('the raid: Grandmother Slag in the Crucible (C3)', () => {
  it('is a four-hero group raid: two openers and a named fight, then her', () => {
    const d = DUNGEONS.crucible;
    expect(d.style).toBe('group');
    expect(d.raid).toBe(true);
    expect(partyBlocker('crucible', 3)).not.toBe('');
    expect(partyBlocker('crucible', 4)).toBe('');
    let n = 0;
    const route = rollRoute(() => n++ % 2, 'crucible');
    expect(route).toHaveLength(4);
    expect(route[3]).toBe('grandmotherSlag');
    expect(d.named).toContain(route[2]);
  });

  it('changes phase at 66% and 33% of her health', () => {
    const { w, inner, b } = raid();
    const e = w.enemies[b];
    e.hp = e.maxHp * 0.6;
    inner.slagClock(0.01);
    expect(w.bossPhase).toBe(2);
    expect(w.events).toContainEqual({ type: 'phase', phase: 2 });
    e.hp = e.maxHp * 0.3;
    inner.slagClock(0.01);
    expect(w.bossPhase).toBe(3);
  });

  it('Ladle Pour hits its target harder for every Ladle Burn stack left on them, and adds two', () => {
    const { w, inner, b } = raid();
    const hit = (stacks: number) => {
      inner.use(1);
      Object.assign(w.player, { hp: w.player.maxHp, slag: stacks, shieldT: 0, sunderT: 0 });
      inner.use(0);
      inner.ladleTarget = 1;
      inner.startCast(b, 'ladlePour', 'Ladle Pour', SLAG.ladleCast, false);
      inner.finishCast(b);
      const p = w.heroData(1).player;
      return { lost: p.maxHp - p.hp, slag: p.slag };
    };
    const clean = hit(0);
    const burnt = hit(2);
    expect(clean.slag).toBe(SLAG.ladleStacks);
    expect(burnt.lost / clean.lost).toBeCloseTo(1 + 2 * SLAG.ladleStackMult, 1);
  });

  it('Ladle Pour Sears its target: a second pour inside the sear hits harder, and no heal clears it', () => {
    const { w, inner, b } = raid();
    const pour = () => {
      inner.use(1);
      Object.assign(w.player, { hp: w.player.maxHp, slag: 0, shieldT: 0 });
      inner.use(0);
      inner.ladleTarget = 1;
      inner.startCast(b, 'ladlePour', 'Ladle Pour', SLAG.ladleCast, false);
      inner.finishCast(b);
      const p = w.heroData(1).player;
      return p.maxHp - p.hp;
    };
    const fresh = pour();
    expect(w.heroData(1).player.sunderT).toBe(SLAG.searTime);
    const seared = pour();
    expect(seared / fresh).toBeCloseTo(1 + SLAG.searMult, 1);
    // The sear fades with her clock, and outlasts one gap between pours but not two.
    expect(SLAG.searTime).toBeGreaterThan(SLAG.ladleLate);
    expect(SLAG.searTime).toBeLessThan(2 * SLAG.ladleEvery);
    for (let t = 0; t < SLAG.searTime + 0.5; t += 0.5) inner.slagClock(0.5);
    expect(w.heroData(1).player.sunderT ?? 0).toBe(0);
  });

  it('cues a fresh tank to swap once the tank she is on is Seared', () => {
    const w = new World({ seed: 5, dungeon: 'crucible', omens: [], cls: 'bulwark', worldBoss: 'Grandmother Slag',
      party: [{ cls: 'slagbinder', stance: 'anvil' }, { cls: 'lumen' }, { cls: 'emberwright' }] });
    const inner = w as unknown as Inner & { threat: { target: string }[] };
    for (const e of w.enemies) e.alive = false;
    const b = inner.spawn('grandmotherSlag', 0, -200);
    inner.bossIndex = b;
    expect(w.isTank(0) && w.isTank(1) && !w.isTank(2)).toBe(true);
    inner.threat[b] = { amounts: {}, target: w.heroes[1].id, forced: null, forcedT: 0 } as never;
    // Boss on the fresh Anvil: the Bulwark leaves it there.
    expect(w.bossTarget).toBe(1);
    expect(w.swapCue).toBe(false);
    expect(w.tauntCue).toBe(false);
    // Ladle Pour Seared the Anvil: now the Bulwark takes it.
    inner.use(1);
    w.player.sunderT = SLAG.searTime;
    inner.use(0);
    expect(w.swapCue).toBe(true);
    expect(w.tauntCue).toBe(true);
    // A Seared Bulwark doesn't.
    w.player.sunderT = 3;
    expect(w.swapCue).toBe(false);
  });

  it('phase 3 opens two soak vents; Last Ember at the hard enrage wipes the party', () => {
    const { w, inner, b } = raid();
    const e = w.enemies[b];
    e.hp = e.maxHp * 0.2;
    inner.raidVentT = 0;
    inner.slagClock(0.01);
    expect(w.telegraphs.filter((t) => t.alive && t.kind === 'soak')).toHaveLength(2);
    e.castId = '';
    e.spawnedAt = w.time - SLAG.hardEnrage;
    inner.slagClock(0.01);
    expect(e.castId).toBe('lastEmber');
    inner.finishCast(b);
    for (let k = 0; k < w.heroes.length; k++) expect(w.heroData(k).player.hp).toBeLessThanOrEqual(0);
  });

  it('every hit on her counts toward the world boss as shadow damage, with her fight as its time', () => {
    const { w, inner, b } = raid();
    inner.damageEnemy(b, 500, false);
    expect(w.summary().shadowDamage).toBeGreaterThan(0);
    for (let n = 0; n < 30; n++) w.step([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
    expect(w.summary().shadowTime).toBe(1);
  });
});
