import { describe, expect, it } from 'vitest';
import { applyRun, newHero, wearCosmetic } from '../sim/hero';
import { SEASON, SEASONS, SEASON_START_WEEK, TRAILS, trailLabel, runMarks, seasonDef, seasonLevel, seasonOf, seasonRewards, seasonState, seasonWeeks } from '../sim/content/season';
import { DUNGEONS } from '../sim/content/dungeon';
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

  it("a win in the season's own dungeon pays the featured bonus; a loss there does not", () => {
    expect(runMarks(true, 5, 0, false, true)).toBe(SEASON.win + SEASON.featured);
    expect(runMarks(false, 2, 0, false, true)).toBe(SEASON.lossBase + 2 * SEASON.lossPerFight);
    // Every theme names a real dungeon, and no two themes share one.
    for (const d of SEASONS) expect(DUNGEONS[d.dungeon]).toBeDefined();
    expect(new Set(SEASONS.map((d) => d.dungeon)).size).toBe(SEASONS.length);
    const h = newHero();
    h.weekly = { week: W, titled: true, quests: [] };
    h.season = { id: seasonOf(W), marks: 0, firstWinDay: W * 7 + 1 };
    const home = seasonDef(seasonOf(W)).dungeon;
    const a = applyRun(h, 1, run(true, { dungeon: home }), false);
    expect(a.seasonFeatured).toBe(true);
    expect(a.seasonMarks).toBe(SEASON.win + SEASON.featured);
    const b = applyRun(h, 2, run(false, { dungeon: home }), false);
    expect(b.seasonFeatured).toBeUndefined();
    const other = home === 'kiln' ? 'foundry' : 'kiln';
    const c = applyRun(h, 3, run(true, { dungeon: other }), false);
    expect(c.seasonFeatured).toBeUndefined();
    expect(c.seasonMarks).toBe(SEASON.win);
  });

  it('the season trail comes in three stages, keeps its best stage, and can be worn', () => {
    const id = seasonOf(W);
    const rs = seasonRewards(id);
    const levels = rs.map((r) => r.level);
    // No two rewards share a level: 9 rewards, 5 8 10 15 18 20 25 28 30.
    expect(levels).toEqual([5, 8, 10, 15, 18, 20, 25, 28, 30]);
    const trails = rs.filter((r) => r.kind === 'trail');
    expect(trails.map((r) => r.level)).toEqual([8, 18, 28]);
    expect(new Set(SEASONS.map((d) => d.trail.id)).size).toBe(SEASONS.length);
    // Glow ids are unique across every season, so a worn glow from an old season always resolves to itself.
    const glows = SEASONS.flatMap((d) => d.glows.map((g) => g.id));
    expect(new Set(glows).size).toBe(glows.length);
    const t = seasonDef(id).trail;
    expect(TRAILS[t.id]).toBe(t);
    expect(trailLabel(t, 3)).toBe(`${t.name} III`);
    const h = newHero();
    h.weekly = { week: W, titled: true, quests: [] };
    expect(wearCosmetic(h, 'trail', t.id)).toBe(false);
    h.season = { id, marks: SEASON.marksPerLevel * 8 - 10, firstWinDay: W * 7 + 1 };
    const r = applyRun(h, 1, run(true), false);
    expect(r.seasonRewards?.some((x) => x.kind === 'trail' && x.stage === 1)).toBe(true);
    expect(h.trails).toEqual({ [t.id]: 1 });
    h.season!.marks = SEASON.marksPerLevel * 28 - 10;
    applyRun(h, 2, run(true), false);
    expect(h.trails).toEqual({ [t.id]: 3 });
    expect(wearCosmetic(h, 'trail', t.id)).toBe(true);
    expect(h.wear?.trail).toBe(t.id);
    // A save already past level 18 before trails existed gets stage 2 on its next run.
    const old = newHero();
    old.weekly = { week: W, titled: true, quests: [] };
    old.season = { id, marks: SEASON.marksPerLevel * 19, firstWinDay: W * 7 + 1 };
    applyRun(old, 1, run(false), false);
    expect(old.trails).toEqual({ [t.id]: 2 });
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
  it('Seasons 7 and 8 keep every colour at least 22 CIE76 delta E from every older season colour', () => {
    const lab = (hex: string): number[] => {
      const lin = (c: number) => (c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92);
      const [r, g, b] = [1, 3, 5].map((k) => lin(parseInt(hex.slice(k, k + 2), 16) / 255));
      const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
      const x = f((r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047);
      const y = f(r * 0.2126 + g * 0.7152 + b * 0.0722);
      const z = f((r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883);
      return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
    };
    const colours = (k: number) => [...SEASONS[k].glows.map((g) => g.color), SEASONS[k].trail.color];
    expect(SEASONS[6].dungeon).toBe('hoard');
    expect(SEASONS[7].dungeon).toBe('smeltery');
    for (const k of [6, 7]) {
      for (let j = 0; j < k; j++) {
        for (const a of colours(k)) for (const b of colours(j)) {
          const [p, q] = [lab(a), lab(b)];
          expect(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]), `${a} vs ${b}`).toBeGreaterThanOrEqual(22);
        }
      }
    }
  });
});
