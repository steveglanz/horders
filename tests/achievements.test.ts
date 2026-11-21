import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, ACHIEVEMENT_TUNING, addDeeds } from '../sim/content/achievements';
import { applyRun, achievementView, backfillDeeds, newHero } from '../sim/hero';
import type { RunSummary } from '../sim/world';

const win = (over: Partial<RunSummary> = {}): RunSummary => ({ victory: true, tier: 1, time: 300, kills: 50, level: 5, damageDealt: 1000, talents: {}, dungeon: 'kiln', fightsCleared: 5, ...over });

describe('P6 achievements', () => {
  it('have unique ids and titles, and every title is new', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    expect(new Set(ACHIEVEMENTS.map((a) => a.title)).size).toBe(ACHIEVEMENTS.length);
  });

  it('adds deeds from a run: a win counts the dungeon and the class, interrupts and named foes always count', () => {
    let d = addDeeds({}, win({ interrupts: 7, namedKills: 1 }), 'duskblade');
    d = addDeeds(d, { victory: false, dungeon: 'foundry', interrupts: 3 }, 'lumen');
    expect(d.bosses).toEqual({ kiln: 1 });
    expect(d.classes).toEqual(['duskblade']);
    expect(d.interrupts).toBe(10);
    expect(d.named).toBe(1);
    d = addDeeds(d, win({ bounty: 20000 }), 'lumen');
    expect(d.bounties).toBe(1);
  });

  it('a first Kiln win pays Kiln-Breaker once: its title and embers', () => {
    const h = newHero();
    const embers = h.embers;
    const r = applyRun(h, 1, win(), false);
    expect(r.achievements?.map((a) => a.id)).toEqual(['boss:kiln']);
    expect(h.titles).toContain('Kiln-Breaker');
    expect(h.embers - embers).toBeGreaterThanOrEqual(ACHIEVEMENT_TUNING.small);
    const again = applyRun(h, 2, win(), false);
    expect(again.achievements).toBeUndefined();
    expect(h.deeds?.bosses?.kiln).toBe(2);
  });

  it('interrupts add up across runs to Quencher', () => {
    const h = newHero();
    applyRun(h, 1, { ...win(), victory: false, interrupts: 60 }, false);
    expect(h.achieved ?? []).not.toContain('interrupts:1');
    const r = applyRun(h, 2, { ...win(), victory: false, interrupts: 45 }, false);
    expect(r.achievements?.map((a) => a.id)).toContain('interrupts:1');
  });

  it('a save from before achievements is backfilled from its wins, not double counted', () => {
    const h = newHero();
    h.wins = 3;
    h.runs = 4;
    expect(backfillDeeds(h)).toEqual({ classes: [h.cls ?? 'emberwright'], bosses: { kiln: 1 } });
    const r = applyRun(h, 1, { ...win(), victory: false }, false);
    expect(r.achievements?.map((a) => a.id)).toEqual(['boss:kiln']);
    expect(h.deeds?.bosses?.kiln).toBe(1);
  });

  it('key achievements read the best key of any class', () => {
    const h = newHero();
    h.keyBest = { kiln: 3 };
    h.roster = { lumen: { keyBest: { foundry: 6 } } } as never;
    expect(ACHIEVEMENTS.find((a) => a.id === 'keys:1')!.have(achievementView(h))).toBe(ACHIEVEMENT_TUNING.keys[0]);
  });
});
