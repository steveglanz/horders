import { describe, expect, it } from 'vitest';
import { World, TICK, COLD } from '../sim/world';
import { NAMED, NAMED_TITLES, AFFIXES, AFFIX_TIP } from '../sim/content/named';

type Inner = {
  spawn(kind: string, x: number, y: number): number;
  killEnemy(i: number): void;
  rollNamed(elite: number): void;
  namedAt: number;
  namedAffix: number;
};

/** A hero in its first fight, with that fight's foes cleared. */
function inFight(seed = 5): { w: World; inner: Inner } {
  const w = new World({ seed, omens: [] });
  for (let n = 0; n < 60 / TICK && w.phase !== 'fight'; n++) {
    if (w.state === 'draft') { w.choose(0); continue; }
    w.step({ x: 0, y: 0 });
  }
  for (const e of w.enemies) e.alive = false;
  return { w, inner: w as unknown as Inner };
}

/** Makes the next roll land a named elite with `affix` on a fresh Cinder Brute. */
function named(affix: (typeof AFFIXES)[number]): { w: World; inner: Inner; i: number } {
  const { w, inner } = inFight();
  inner.namedAt = w.encounter;
  inner.namedAffix = AFFIXES.indexOf(affix);
  const i = inner.spawn('cinderBrute', 200, 0);
  w.events.length = 0;
  inner.rollNamed(i);
  return { w, inner, i };
}

describe('named elites (C2)', () => {
  it('about half of all delves hide one, never in the boss fight, the same way every time', () => {
    let hits = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const a = inFight(seed).inner.namedAt;
      expect(inFight(seed).inner.namedAt).toBe(a);
      const { w } = inFight(seed);
      expect(a).toBeLessThan(w.route.length - 1);
      if (a >= 0) hits++;
    }
    expect(hits / 200).toBeGreaterThan(NAMED.chance - 0.1);
    expect(hits / 200).toBeLessThan(NAMED.chance + 0.1);
  });

  it('a named elite is tougher, says its name, and drops Rare or better', () => {
    const { w, inner, i } = named('Swift');
    const e = w.enemies[i];
    expect(e.named).toBeGreaterThanOrEqual(0);
    expect(e.maxHp).toBe(1500 * NAMED.hp);
    const name = w.namedName(i);
    expect(name).toBe(`${NAMED_TITLES[e.named]}, Cinder Brute`);
    expect(w.events).toContainEqual({ type: 'namedSpawn', index: i, name, affix: 'Swift' });
    w.events.length = 0;
    inner.killEnemy(i);
    const drop = w.events.find((ev) => ev.type === 'drop');
    expect(drop && drop.type === 'drop' && ['rare', 'epic'].includes(drop.rarity)).toBe(true);
    expect(w.events.some((ev) => ev.type === 'namedKill' && ev.name === name)).toBe(true);
  });

  it('Swift moves faster than its kind', () => {
    const { w, i } = named('Swift');
    const plain = (w as unknown as Inner).spawn('cinderBrute', -200, 0);
    w.step({ x: 0, y: 0 });
    // Path length, not x alone: FOE_AI sends each foe in from its own side, so the two don't walk the same line.
    const moved = (k: number) => Math.hypot(w.enemies[k].x - w.enemies[k].px, w.enemies[k].y - w.enemies[k].py);
    expect(moved(i) / moved(plain)).toBeCloseTo(NAMED.swift, 1);
  });

  it('Warded comes with a shield', () => {
    const { w, i } = named('Warded');
    expect(w.enemies[i].ward).toBeCloseTo(w.enemies[i].maxHp * NAMED.ward, 5);
  });

  it('Vengeful bursts where it falls', () => {
    const { w, inner, i } = named('Vengeful');
    const before = w.telegraphs.filter((t) => t.alive).length;
    inner.killEnemy(i);
    expect(w.telegraphs.filter((t) => t.alive).length).toBe(before + 1);
  });

  it('Phase 14 X2 Brood: its pack comes out of it when it falls', () => {
    const { w, inner, i } = named('Brood');
    const hounds = () => w.enemies.filter((e) => e.alive && e.kind === 'cinderhound').length;
    const before = hounds();
    inner.killEnemy(i);
    expect(hounds()).toBe(before + NAMED.broodN);
  });

  it('Phase 14 X2 Smoldering: leaves a fire circle where it stands every few seconds', () => {
    const { w, i } = named('Smoldering');
    let made = 0;
    let last = w.telegraphs.filter((t) => t.alive).length;
    for (let n = 0; n < Math.round((NAMED.smolderEvery * 2 + 0.5) / TICK); n++) {
      w.step({ x: 0, y: 0 });
      const now = w.telegraphs.filter((t) => t.alive && t.r === NAMED.smolderR).length;
      if (now > last) made += now - last;
      last = now;
      if (!w.enemies[i].alive) break;
    }
    expect(made).toBeGreaterThanOrEqual(1);
  });

  it('Phase 14 X2: the newer affixes come on about 40% of named foes, the C2 rolls stay put', () => {
    const n = [0, 0, 0, 0, 0];
    for (let seed = 1; seed <= 400; seed++) n[inFight(seed).inner.namedAffix]++;
    expect((n[3] + n[4]) / 400).toBeGreaterThan(NAMED.newAffixChance - 0.1);
    expect((n[3] + n[4]) / 400).toBeLessThan(NAMED.newAffixChance + 0.1);
    for (const k of n) expect(k).toBeGreaterThan(40);
    for (const a of AFFIXES) expect(AFFIX_TIP[a].length).toBeGreaterThan(5);
  });

  it('Phase 14 X4: namedPlan says ahead of time where the named foe is and what affix it has', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const ahead = new World({ seed, omens: [] }).namedPlan();
      const { inner } = inFight(seed);
      if (inner.namedAt < 0) expect(ahead).toBeNull();
      else expect(ahead).toEqual({ at: inner.namedAt, affix: AFFIXES[inner.namedAffix] });
    }
  });

  it('an ordinary foe is not named', () => {
    const { w, inner } = inFight();
    const i = inner.spawn('cinderBrute', 200, 0);
    expect(w.enemies[i].named).toBe(-1);
    expect(w.namedName(i)).toBe('Cinder Brute');
  });
});

describe('Phase 14 X5: a named foe feeds coal in the Coldmarrow', () => {
  it('each tenth of its health taken feeds the hitter COLD.namedFeed', () => {
    const w = new World({ seed: 5, dungeon: 'coldmarrow', tier: 10, omens: [], cls: 'emberwright' });
    const inner = w as unknown as { spawn(kind: string, x: number, y: number): number; damageEnemy(i: number, a: number, c: boolean): void };
    const i = inner.spawn('hoarfrostWeaver', 200, 0);
    const e = w.enemies[i];
    e.named = 0;
    w.player.coal = 0.2;
    inner.damageEnemy(i, e.maxHp * 0.25, false);
    expect(w.player.coal).toBeCloseTo(0.2 + 2 * COLD.namedFeed, 2);
  });
});
