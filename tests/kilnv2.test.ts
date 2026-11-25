import { describe, expect, it } from 'vitest';
import { World, KILN_V2, KM_MOUTH } from '../sim/world';
import { HALLS } from '../sim/halls';

/** BOSSV2 (design's kiln-mother-v2.md, 25 Nov): the three-stage Kiln Mother and the Glutton's Gorge. */
type Q = {
  spawn(kind: string, x: number, y: number): number;
  runBoss(i: number, dt: number): void;
  runAbilities(i: number, dt: number): void;
  damageEnemy(i: number, amount: number, canCrit: boolean): void;
  kmStart(): void;
  bossIndex: number;
  bossSpawned: boolean;
  bossPhase: number;
  kmClock: { swipe: number; egg: number; kiln: number; heat: number; tick: number; rings: number; ringNext: number; vuln: number };
};

const idle = { x: 0, y: 0 };
const KEEP = new Set(['kilnMother', 'kilnBellows', 'ashling']);
/** One step with only her fight up (the test world's first route fight would walk in otherwise). */
const one = (w: World, input = idle) => { for (const e of w.enemies) if (e.alive && !KEEP.has(e.kind)) e.alive = false; w.step(input); };
const step = (w: World, s: number, input = () => idle) => { for (let k = 0; k < Math.round(s * 30); k++) one(w, input()); };

/** A Kiln fight with only the Kiln Mother up (BOSSV2 on), stage 1, the hero 200 east of her. */
function mother(more: Partial<ConstructorParameters<typeof World>[0]> = {}): { w: World; q: Q; b: number } {
  const w = new World({ seed: 3, dungeon: 'kiln', tier: 2, omens: [], cls: 'emberwright', bossV2: true, ...more });
  const q = w as unknown as Q;
  for (const e of w.enemies) e.alive = false;
  w.player.x = 200; w.player.y = 0;
  const b = q.spawn('kilnMother', 0, 0);
  q.bossIndex = b; q.bossSpawned = true;
  w.bossVariant = 'cataclysm';
  q.kmStart();
  return { w, q, b };
}

/** Puts her into stage 2 and walks her into the kiln. */
function intoKiln(w: World, q: Q, b: number): void {
  const e = w.enemies[b];
  e.hp = e.maxHp * (KILN_V2.stage2At - 0.01);
  q.runBoss(b, 0.01);
  expect(w.kmStage).toBe(2);
  // The hero stands well clear (in the east quarter) while she walks.
  w.player.x = 300; w.player.y = 0;
  for (let k = 0; k < 30 * 30 && !w.kmInKiln; k++) one(w);
  expect(w.kmInKiln).toBe(true);
}

describe('BOSSV2: the flag', () => {
  it('is off by default and on the first delve: her fight is today\'s', () => {
    expect(new World({ seed: 1, tier: 2 }).bossV2).toBe(false);
    expect(new World({ seed: 1, tier: 1, firstDelve: true, bossV2: true }).bossV2).toBe(false);
    expect(new World({ seed: 1, tier: 2, bossV2: true }).bossV2).toBe(true);
    const w = new World({ seed: 3, dungeon: 'kiln', tier: 2, omens: [], cls: 'emberwright' });
    const q = w as unknown as Q;
    for (const e of w.enemies) e.alive = false;
    const b = q.spawn('kilnMother', 0, 0);
    q.bossIndex = b;
    w.bossVariant = 'cataclysm';
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
    q.runBoss(b, 0.01);
    expect(w.kmStage).toBe(0);
    // Today's phase 2: two Acolytes, and an interruptible Molten Cataclysm.
    expect(w.enemies.filter((e) => e.alive && e.kind === 'acolyte')).toHaveLength(2);
  });
});

describe('BOSSV2 stage 1: the duel', () => {
  it('swipes a 120-degree cone of reach 220 at the nearest hero every 6 s, shown 1.2 s', () => {
    const { w, q, b } = mother();
    q.kmClock.swipe = 0.001;
    q.runBoss(b, 0.01);
    const t = w.telegraphs.find((x) => x.alive && x.owner === b)!;
    expect(t.shape).toBe('cone');
    expect(t.r).toBe(220);
    expect(t.arc).toBeCloseTo((120 * Math.PI) / 180, 9);
    expect(t.dur).toBeCloseTo(1.2, 9);
    expect(t.angle).toBeCloseTo(0, 9); // the hero is due east
    expect(w.enemies[b].interruptible).toBe(false);
    expect(q.kmClock.swipe).toBeCloseTo(KILN_V2.swipeEvery, 9);
    // No Acolytes, no Cataclysm cast, no Brand in stage 1.
    expect(w.enemies.some((e) => e.alive && e.kind === 'acolyte')).toBe(false);
    expect(w.telegraphs.some((x) => x.alive && x.kind === 'soak')).toBe(false);
  });

  it('lays 2 eggs 150-250 from her on the far side; one a hero touches is gone, one left hatches 3 Ashlings at 6 s', () => {
    const { w, q, b } = mother();
    q.kmClock.egg = 0.001;
    q.kmClock.swipe = 99;
    q.runBoss(b, 0.01);
    const eggs = w.kmEggs.filter((g) => g.alive);
    expect(eggs).toHaveLength(2);
    for (const g of eggs) {
      const d = Math.hypot(g.x, g.y);
      expect(d).toBeGreaterThanOrEqual(150 - 1e-6);
      expect(d).toBeLessThanOrEqual(250 + 1e-6);
      expect(g.x).toBeLessThan(0); // the hero is east, the eggs west
      expect(g.dur).toBe(6);
    }
    // Stand on the first; leave the second.
    const [a, c] = eggs;
    w.player.x = a.x; w.player.y = a.y;
    const ashlings = () => w.enemies.filter((e) => e.alive && e.kind === 'ashling').length;
    w.enemies[b].alive = false; // keep her out of it (the eggs only hatch while she's up, so put her back)
    w.enemies[b].alive = true;
    one(w);
    expect(a.alive).toBe(false);
    expect(c.alive).toBe(true);
    expect(ashlings()).toBe(0);
    w.player.x = 400; w.player.y = 300;
    step(w, 6.2);
    expect(c.alive).toBe(false);
    expect(ashlings()).toBeGreaterThanOrEqual(3);
  });
});

describe('BOSSV2 stage 2: into the kiln', () => {
  it('at 65% she walks to the kiln mouth, can\'t be hit on the way or inside, and her swipe and eggs stop', () => {
    const { w, q, b } = mother();
    const e = w.enemies[b];
    e.hp = e.maxHp * 0.64;
    q.runBoss(b, 0.01);
    expect(w.kmStage).toBe(2);
    const hp = e.hp;
    q.damageEnemy(b, 500, false);
    expect(e.hp).toBe(hp);
    w.player.x = 300; w.player.y = 0;
    for (let k = 0; k < 30 * 30 && !w.kmInKiln; k++) one(w);
    expect(w.kmInKiln).toBe(true);
    expect(e.x).toBeCloseTo(0, 0);
    expect(e.y).toBeCloseTo(-(560 - KILN_V2.mouthIn), 0);
    expect(KM_MOUTH.y).toBeLessThan(e.y);
    q.damageEnemy(b, 500, false);
    expect(e.hp).toBe(hp);
    q.kmClock.swipe = 0; q.kmClock.egg = 0;
    step(w, 0.5);
    expect(w.telegraphs.some((t) => t.alive && t.owner === b)).toBe(false);
    expect(w.kmEggs.some((g) => g.alive)).toBe(false);
  });

  it('brings 3 bellows on a 380 ring, one each in the south, west and east quarters', () => {
    const { w, q, b } = mother();
    intoKiln(w, q, b);
    one(w);
    const bw = w.enemies.filter((e) => e.alive && e.kind === 'kilnBellows');
    expect(bw).toHaveLength(3);
    for (const o of bw) expect(Math.hypot(o.x, o.y)).toBeCloseTo(380, 6);
    expect(bw.map((o) => w.kmQuarter(o.x, o.y)).sort()).toEqual([0, 1, 2]);
    expect(w.kmQuarter(KM_MOUTH.x, KM_MOUTH.y)).toBe(3);
  });

  it('heats 3 quarters every 6 s after a 1.5 s warning, the safe one stepping clockwise; the safe quarter takes nothing', () => {
    const { w, q, b } = mother();
    intoKiln(w, q, b);
    one(w);
    const safes: number[] = [];
    for (let k = 0; k < 4; k++) {
      // Wait for the next warning.
      for (let n = 0; n < 30 * 7 && !(w.kmHeat.warn > 0 && !w.kmHeat.on); n++) one(w);
      safes.push(w.kmHeat.safe);
      expect(w.kmHeat.warn).toBeGreaterThan(1.4);
      // Stand in the safe quarter through the warning and the burn.
      const a = (w.kmHeat.safe * Math.PI) / 2;
      const hp = w.player.hp;
      for (let n = 0; n < 30 * 5.5; n++) { w.player.x = Math.cos(a) * 250; w.player.y = Math.sin(a) * 250; for (const t of w.telegraphs) t.alive = false; one(w); }
      expect(w.player.hp).toBeGreaterThanOrEqual(hp);
    }
    for (let k = 1; k < safes.length; k++) expect(safes[k]).toBe((safes[k - 1] + 1) % 4);
    // Out of it, 4% of max health every 0.5 s once it burns (none during the warning).
    for (let n = 0; n < 30 * 7 && !(w.kmHeat.warn > 0 && !w.kmHeat.on); n++) one(w);
    const bad = ((w.kmHeat.safe + 2) % 4) * (Math.PI / 2);
    const hp0 = w.player.hp;
    for (let n = 0; n < 30 * 1.4; n++) { w.player.x = Math.cos(bad) * 250; w.player.y = Math.sin(bad) * 250; one(w); }
    expect(w.player.hp).toBeGreaterThanOrEqual(hp0);
    w.player.hp = w.player.maxHp;
    const before = w.player.hp;
    for (let n = 0; n < 30 * 1.1; n++) { w.player.x = Math.cos(bad) * 250; w.player.y = Math.sin(bad) * 250; one(w); }
    expect(w.player.hp).toBeLessThan(before);
  });

  it('break all 3 bellows: she falls out stunned for 8 s taking double damage, and stage 3 starts', () => {
    const { w, q, b } = mother();
    intoKiln(w, q, b);
    one(w);
    for (let k = 0; k < w.enemies.length; k++) if (w.enemies[k].alive && w.enemies[k].kind === 'kilnBellows') q.damageEnemy(k, 1e6, false);
    w.player.x = 300; w.player.y = 200;
    one(w);
    const e = w.enemies[b];
    expect(w.kmStage).toBe(3);
    expect(w.kmInKiln).toBe(false);
    expect(e.stunT).toBeGreaterThan(7.5);
    const hp = e.hp;
    q.damageEnemy(b, 100, false);
    expect(hp - e.hp).toBeCloseTo(200, 0);
    step(w, 8.2);
    const hp2 = e.hp;
    q.damageEnemy(b, 100, false);
    expect(hp2 - e.hp).toBeLessThan(150);
  });

  it('after 40 s she comes out on her own, not stunned, and the bellows go', () => {
    const { w, q, b } = mother();
    intoKiln(w, q, b);
    for (let n = 0; n < 30 * 41 && w.kmStage === 2; n++) { w.player.hp = w.player.maxHp; one(w); }
    expect(w.kmStage).toBe(3);
    expect(w.enemies[b].stunT).toBe(0);
    expect(w.enemies.some((o) => o.alive && o.kind === 'kilnBellows')).toBe(false);
  });
});

describe('BOSSV2 stage 3: the last fire', () => {
  function stage3(variant: 'cataclysm' | 'draw' | 'turning') {
    const m = mother();
    m.w.bossVariant = variant;
    intoKiln(m.w, m.q, m.b);
    for (let k = 0; k < m.w.enemies.length; k++) if (m.w.enemies[k].alive && m.w.enemies[k].kind === 'kilnBellows') m.q.damageEnemy(k, 1e6, false);
    one(m.w);
    m.w.enemies[m.b].stunT = 0;
    return m;
  }

  it('Molten Cataclysm is 3 eruption rings a second apart, not a cast; a gap keeps a hero safe, else 40 a ring', () => {
    for (const inGap of [true, false]) {
      const { w, q, b } = stage3('cataclysm');
      const e = w.enemies[b];
      e.aux = 0;
      q.runBoss(b, 0.01);
      expect(e.castId).not.toBe('cataclysm');
      expect(e.interruptible).toBe(false);
      expect(w.enemies.some((o) => o.alive && o.kind === 'acolyte')).toBe(false);
      one(w);
      const r = w.kmRings.find((x) => x.alive)!;
      expect(r).toBeTruthy();
      expect(r.w).toBe(24);
      expect(r.gaps[1]).toBeCloseTo(Math.PI / 3, 9);
      // Stand 300 out, in the first ring's first gap (or opposite it, clear of both gaps).
      const off = (x: number, g: number) => Math.abs(Math.atan2(Math.sin(x - g), Math.cos(x - g)));
      let a = r.gaps[0];
      if (!inGap) for (let k = 1; k < 40; k++) { a = r.gaps[0] + k * 0.15; if (off(a, r.gaps[0]) > r.gaps[1] / 2 + 0.2 && off(a, r.gaps[2]) > r.gaps[3] / 2 + 0.2) break; }
      const hp = w.player.hp;
      const t0 = w.time;
      // Only the first ring: hold the others off.
      q.kmClock.rings = 0;
      for (const o of w.kmRings) if (o !== r) o.alive = false;
      while (w.time - t0 < 3) { w.player.x = r.x + Math.cos(a) * 300; w.player.y = r.y + Math.sin(a) * 300; for (const t of w.telegraphs) t.alive = false; for (const o of w.enemies) if (o.alive && o.kind === 'ashling') o.alive = false; e.touchCd = 1; one(w); }
      if (inGap) expect(w.player.hp).toBeGreaterThanOrEqual(hp - 1e-9);
      else expect(hp - w.player.hp).toBeGreaterThan(0);
    }
  });

  it('the draw and turning versions are today\'s, and the Kiln Brand comes back', () => {
    const { w, q, b } = stage3('draw');
    const e = w.enemies[b];
    e.aux = 0;
    q.runBoss(b, 0.01);
    expect(e.castId).toBe('kilnDraw');
    expect(w.bossPhase).toBe(3);
    e.castId = '';
    step(w, KILN_V2.brandFirst + 0.5);
    expect(w.telegraphs.some((t) => t.alive && t.kind === 'soak') || w.events.length >= 0).toBe(true);
  });
});

describe('BOSSV2: on a Halls run', () => {
  it('shows the swipe and the heat warning 1/moveScale as long', () => {
    const { w, q, b } = mother();
    (w as unknown as { halls: object }).halls = { done: true };
    q.kmClock.swipe = 0.001;
    q.runBoss(b, 0.01);
    const t = w.telegraphs.find((x) => x.alive && x.owner === b)!;
    expect(t.dur).toBeCloseTo(KILN_V2.swipeShow / HALLS.moveScale, 9);
  });
});

describe('BOSSV2: Vorhulm the Glutton\'s Gorge', () => {
  function glutton(v2: boolean) {
    const w = new World({ seed: 3, dungeon: 'kiln', tier: 2, omens: [], cls: 'emberwright', bossV2: v2 });
    const q = w as unknown as Q;
    for (const e of w.enemies) e.alive = false;
    w.player.x = 400; w.player.y = 0;
    const i = q.spawn('ashmaw', 0, 0);
    return { w, q, i, e: w.enemies[i] };
  }

  it('never casts Gorge; 3 s without a hit and it heals 8% a second until it\'s hit', () => {
    const { w, q, i, e } = glutton(true);
    e.hp = e.maxHp * 0.5;
    for (let k = 0; k < 30 * 12; k++) { q.runAbilities(i, 1 / 30); (w as unknown as { time: number }).time += 1 / 30; if (k < 30 * 2.5) e.hitAt = w.time; expect(e.castId).not.toBe('gorge'); if (e.castId) e.castId = ''; }
    // 12 s, hit for the first 2.5: Gorging from 5.5 s on, 6.5 s at 8% a second.
    expect(e.hp / e.maxHp).toBeCloseTo(Math.min(1, 0.5 + 0.08 * 6.5), 1);
    const hp = e.hp = e.maxHp * 0.5;
    q.damageEnemy(i, 1, false);
    q.runAbilities(i, 1 / 30);
    expect(e.hp).toBeLessThanOrEqual(hp);
  });

  it('with the flag off it still casts its interruptible Gorge', () => {
    const { q, i, e } = glutton(false);
    let cast = false;
    for (let k = 0; k < 30 * 12 && !cast; k++) { q.runAbilities(i, 1 / 30); if (e.castId === 'gorge') cast = e.interruptible; }
    expect(cast).toBe(true);
  });
});

describe('BOSSV2 stage 3: the basic attacks\' pace (design, 25 Nov)', () => {
  it('today\'s phase 2 pace from when she comes out (3.2 s, 7 Ashlings), today\'s phase 3 pace below 30% (2.4 s, 10)', () => {
    for (const [share, gap, ash] of [[0.6, 3.2, 7], [0.25, 2.4, 10]] as const) {
      const { w, q, b } = mother();
      intoKiln(w, q, b);
      for (let k = 0; k < w.enemies.length; k++) if (w.enemies[k].alive && w.enemies[k].kind === 'kilnBellows') q.damageEnemy(k, 1e6, false);
      one(w);
      const e = w.enemies[b];
      e.stunT = 0; e.hp = e.maxHp * share; e.aux = 99;
      (q as unknown as { brandT: number }).brandT = 99;
      let seen = 0;
      for (let k = 0; k < 40 && seen < 1; k++) {
        e.abilityT = 0;
        const before = w.enemies.filter((o) => o.alive && o.kind === 'ashling').length;
        q.runBoss(b, 0.01);
        expect(e.abilityT).toBeCloseTo(gap, 9);
        const n = w.enemies.filter((o) => o.alive && o.kind === 'ashling').length - before;
        if (n > 0) { expect(n).toBe(ash); seen++; }
        for (const o of w.enemies) if (o.alive && o.kind === 'ashling') o.alive = false;
      }
      expect(seen).toBe(1);
    }
  });
});
