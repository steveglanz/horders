import { describe, expect, it } from 'vitest';
import { World, TICK } from '../sim/world';
import { NAMED, NAMED_TITLES, AFFIXES } from '../sim/content/named';

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
    const moved = (k: number) => 200 - Math.abs(w.enemies[k].x);
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

  it('an ordinary foe is not named', () => {
    const { w, inner } = inFight();
    const i = inner.spawn('cinderBrute', 200, 0);
    expect(w.enemies[i].named).toBe(-1);
    expect(w.namedName(i)).toBe('Cinder Brute');
  });
});
