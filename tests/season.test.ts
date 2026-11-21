import { describe, expect, it } from 'vitest';
import { applyRun, newHero, wearCosmetic } from '../sim/hero';
import { SEASON, SEASON_START_WEEK, runMarks, seasonLevel, seasonOf, seasonRewards, seasonState, seasonWeeks } from '../sim/content/season';
import type { RunSummary } from '../sim/world';
import { World } from '../sim/world';

const W = SEASON_START_WEEK + 1;
const run = (victory: boolean, over: Partial<RunSummary> = {}): RunSummary => ({
  victory, tier: 1, time: 200, kills: 50, level: 5, damageDealt: 5000, talents: {}, dungeon: 'kiln', fightsCleared: victory ? 5 : 2, week: W, day: W * 7 + 1, ...over,
});

describe('season track (P2)', () => {
  it('seasons are 6 weeks from the start week, and the state resets when one turns', () => {
    expect(seasonOf(SEASON_START_WEEK)).toBe(0);
    expect(seasonOf(SEASON_START_WEEK + SEASON.weeks - 1)).toBe(0);
    expect(seasonOf(SEASON_START_WEEK + SEASON.weeks)).toBe(1);
    expect(seasonWeeks(1)).toEqual([SEASON_START_WEEK + 6, SEASON_START_WEEK + 12]);
    const st = { id: 0, marks: 900 };
    expect(seasonState(st, W)).toBe(st);
    expect(seasonState(st, W + SEASON.weeks)).toEqual({ id: 1, marks: 0 });
  });

  it('marks: a win, a loss by fights cleared, the first win of the day, weekly quests', () => {
    expect(runMarks(true, 5, 0, false)).toBe(SEASON.win);
    expect(runMarks(false, 2, 0, false)).toBe(SEASON.lossBase + 2 * SEASON.lossPerFight);
    expect(runMarks(false, 9, 0, false)).toBe(SEASON.lossBase + 5 * SEASON.lossPerFight);
    expect(runMarks(true, 5, 2, true)).toBe(SEASON.win + SEASON.firstWin + 2 * SEASON.weekly);
  });

  it('the first win of a day pays once, and runs without a week earn nothing', () => {
    const h = newHero();
    // No weekly quests this week, so only the run's own marks count.
    h.weekly = { week: W, titled: true, quests: [] };
    const a = applyRun(h, 1, run(true), false);
    expect(a.seasonFirstWin).toBe(true);
    expect(a.seasonMarks).toBe(SEASON.win + SEASON.firstWin);
    const b = applyRun(h, 2, run(true), false);
    expect(b.seasonFirstWin).toBeUndefined();
    expect(b.seasonMarks).toBe(SEASON.win);
    const c = applyRun(h, 3, run(true, { day: W * 7 + 2 }), false);
    expect(c.seasonFirstWin).toBe(true);
    const marks = h.season!.marks;
    const d = applyRun(h, 4, run(true, { week: undefined }), false);
    expect(d.seasonMarks).toBeUndefined();
    expect(h.season!.marks).toBe(marks);
  });

  it('levelling grants glows and titles, the track caps at 30, and earned looks can be worn', () => {
    const h = newHero();
    h.season = { id: seasonOf(W), marks: SEASON.marksPerLevel * 5 - 10 };
    const r = applyRun(h, 1, run(true), false);
    expect(r.seasonFrom).toBe(4);
    expect(r.seasonTo).toBe(seasonLevel(h.season!.marks));
    const glow = seasonRewards(seasonOf(W)).find((x) => x.level === 5);
    expect(glow?.kind).toBe('glow');
    expect(r.seasonRewards?.[0]).toEqual(glow);
    if (glow?.kind !== 'glow') throw new Error('level 5 is a glow');
    expect(h.glows).toEqual([glow.glow.id]);
    h.season!.marks = SEASON.marksPerLevel * SEASON.levels - 1;
    const r2 = applyRun(h, 2, run(true), false);
    expect(r2.seasonTo).toBe(SEASON.levels);
    expect(h.season!.marks).toBe(SEASON.marksPerLevel * SEASON.levels);
    const title = seasonRewards(seasonOf(W)).find((x) => x.level === 30);
    if (title?.kind !== 'title') throw new Error('level 30 is a title');
    expect(h.titles).toContain(title.title);
    expect(wearCosmetic(h, 'title', title.title)).toBe(true);
    expect(wearCosmetic(h, 'glow', glow.glow.id)).toBe(true);
    expect(h.wear).toEqual({ title: title.title, glow: glow.glow.id });
    expect(wearCosmetic(h, 'title', 'Not Earned')).toBe(false);
    expect(wearCosmetic(h, 'title', undefined)).toBe(true);
    expect(h.wear).toEqual({ glow: glow.glow.id });
  });

  it('the sim carries the day into the run summary', () => {
    const w = new World({ seed: 1, dungeon: 'kiln', omens: [], week: W, day: 123 });
    expect(w.summary().day).toBe(123);
    expect('day' in new World({ seed: 1, dungeon: 'kiln', omens: [] }).summary()).toBe(false);
  });
});
