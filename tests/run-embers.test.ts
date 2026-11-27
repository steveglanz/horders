import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../sim/content/achievements';
import { RUN_EMBERS, applyRun, newHero, runEmbers } from '../sim/hero';

/** 1.0 CP3 (vision.md, "What a loss pays": keep your embers). */
describe('embers carried home, kept on a loss', () => {
  const run = (victory: boolean, fightsCleared: number, tier = 1) => ({ victory, fightsCleared, tier, time: 200, kills: 10, level: 3, damageDealt: 3000, talents: {}, dungeon: 'kiln' as const });
  const fresh = () => {
    const h = newHero();
    h.achieved = ACHIEVEMENTS.map((a) => a.id); // only the run's own embers here
    return h;
  };

  it('each cleared fight carries embers; the boss counts as two fights; more a fight at higher tiers', () => {
    const per = (t: number) => Math.round(RUN_EMBERS.perFight + RUN_EMBERS.perTier * t);
    expect(runEmbers(run(true, 4, 1))).toBe(per(1) * (4 + RUN_EMBERS.boss));
    expect(runEmbers(run(false, 2, 1))).toBe(per(1) * 2);
    expect(runEmbers(run(false, 2, 9))).toBeGreaterThan(runEmbers(run(false, 2, 1)));
  });

  it('a loss keeps every ember it carried: the same pay a fight as a win, only the fights it never cleared are missing', () => {
    const h = fresh();
    const before = h.embers;
    const r = applyRun(h, 1, run(false, 3, 2), false);
    expect(r.carriedEmbers).toBe(runEmbers(run(false, 3, 2)));
    expect(r.carriedEmbers).toBeGreaterThan(0);
    expect(h.embers - before).toBe(r.carriedEmbers);
    expect(r.embersGained).toBe(r.carriedEmbers);
    // Three fights into a loss carry what the first three fights of a win carry.
    expect(runEmbers(run(false, 3, 2))).toBe(runEmbers(run(true, 3, 2)) - runEmbers(run(true, 0, 2)));
  });

  it('a run quit before clearing a fight carries nothing, so quitting at once is not a farm', () => {
    const h = fresh();
    const before = h.embers;
    const r = applyRun(h, 1, run(false, 0, 5), false);
    expect(r.carriedEmbers).toBe(0);
    expect(h.embers).toBe(before);
  });
});
