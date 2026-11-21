import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../sim/content/achievements';
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { BOUNTY, bountyEmbers, bountyFor, dayOf } from '../sim/content/bounty';
import { applyRun, newHero } from '../sim/hero';
import { DUNGEONS } from '../sim/content/dungeon';

function play(w: World, max = 600) {
  while (w.state !== 'ended' && w.time < max) {
    if (w.state === 'draft') w.choose(botChoose(w));
    else w.step(botInput(w));
  }
}

function bountyWorld(day: number, maxTier: number) {
  const b = bountyFor(day, maxTier);
  return { b, w: new World({ seed: b.seed, tier: b.tier, dungeon: b.dungeon, route: [...b.route], omens: [b.twist], bounty: b.day }) };
}

describe('daily bounty', () => {
  it('is the same for everyone on a day and changes day to day', () => {
    const day = dayOf(Date.UTC(2026, 10, 20));
    const a = bountyFor(day, 9), b = bountyFor(day, 9);
    expect(a).toEqual(b);
    const week = Array.from({ length: 7 }, (_, k) => JSON.stringify(bountyFor(day + k, 9)));
    expect(new Set(week).size).toBeGreaterThan(1);
  });

  it('is three fights ending in the dungeon boss, at one tier below the best', () => {
    for (let d = 0; d < 20; d++) {
      const b = bountyFor(20400 + d, 6);
      expect(b.route).toHaveLength(3);
      expect(b.route[2]).toBe(DUNGEONS[b.dungeon].boss);
      expect(b.route[0]).not.toBe(b.route[1]);
      expect(b.tier).toBe(5);
    }
  });

  it('falls back to the Kiln when the day dungeon is locked, keeping seed and twist', () => {
    let day = 20400;
    while (bountyFor(day, 9).dungeon !== 'foundry') day++;
    const low = bountyFor(day, 2), high = bountyFor(day, 9);
    expect(low.dungeon).toBe('kiln');
    expect(low.seed).toBe(high.seed);
    expect(low.twist).toBe(high.twist);
  });

  it('a bounty run has no forks, carries its twist, and is deterministic', () => {
    const { b, w } = bountyWorld(20412, 3);
    const { w: w2 } = bountyWorld(20412, 3);
    let forks = 0;
    while (w.state !== 'ended' && w.time < 120) {
      if (w.phase === 'choose') forks++;
      if (w.state === 'draft') { w.choose(botChoose(w)); w2.choose(botChoose(w2)); }
      else { w.step(botInput(w)); w2.step(botInput(w2)); }
    }
    expect(forks).toBe(0);
    expect(w.omens).toEqual([b.twist]);
    expect(w.hash()).toBe(w2.hash());
  }, 60000);

  it('pays once a day and never moves the tier ladder or Grit', () => {
    const h = newHero();
    h.maxTier = 4;
    h.grit = { key: 'kiln:4', stacks: 2 };
    h.achieved = ACHIEVEMENTS.map((a) => a.id); // only the bounty's embers here
    const base = { victory: true, tier: 3, time: 200, kills: 10, level: 5, damageDealt: 5000, talents: {}, dungeon: 'kiln' as const, bounty: 20412 };
    const e0 = h.embers;
    const r1 = applyRun(h, 1, base, false);
    expect(r1.bountyEmbers).toBe(bountyEmbers(3));
    expect(h.embers - e0).toBe(bountyEmbers(3));
    const r2 = applyRun(h, 2, base, false);
    expect(r2.bountyEmbers).toBe(0);
    applyRun(h, 3, { ...base, victory: false }, false);
    expect(h.maxTier).toBe(4);
    expect(h.grit).toEqual({ key: 'kiln:4', stacks: 2 });
    const r3 = applyRun(h, 4, { ...base, bounty: 20413 }, false);
    expect(r3.bountyEmbers).toBe(bountyEmbers(3));
    expect(BOUNTY.unlockTier).toBe(2);
  });

  it('the autopilot can win a bounty at a reachable tier', () => {
    let wins = 0;
    for (let d = 0; d < 6; d++) {
      const { w } = bountyWorld(20400 + d, 2);
      play(w);
      if (w.victory) wins++;
    }
    expect(wins).toBeGreaterThan(0);
  }, 120000);
});
