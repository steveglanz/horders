import { describe, expect, it } from 'vitest';
import { weeklyFor, weekState, weeklyStep, weeklyTitle, WEEKLY, WEEKLY_QUESTS } from '../sim/content/weekly';
import { applyRun, newHero } from '../sim/hero';
import type { RunSummary } from '../sim/world';
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';

const win = (over: Partial<RunSummary> = {}): RunSummary => ({
  victory: true, tier: 1, time: 200, kills: 50, level: 5, damageDealt: 5000, talents: {}, dungeon: 'kiln', fightsCleared: 5, week: 2900, ...over,
});

describe('weekly quests (P1)', () => {
  it('three different quests a week, the same for everyone at the same tier, and new ones next week', () => {
    const a = weeklyFor(2900, 8);
    expect(a).toHaveLength(WEEKLY.count);
    expect(new Set(a.map((q) => q.id)).size).toBe(WEEKLY.count);
    expect(weeklyFor(2900, 8)).toEqual(a);
    const weeks = new Set<string>();
    for (let w = 2900; w < 2910; w++) weeks.add(weeklyFor(w, 8).map((q) => q.id).join());
    expect(weeks.size).toBeGreaterThan(3);
  });

  it('a brand-new hero never gets the bounty quest, or a dungeon they cannot enter', () => {
    for (let w = 0; w < 200; w++) {
      for (const q of weeklyFor(w, 1)) {
        expect(q.id).not.toBe('bounties');
        if (q.dungeon) expect(q.dungeon).toBe('kiln');
      }
    }
  });

  it('runs move the quests, a finished quest pays its embers once, and all three give the title', () => {
    const h = newHero();
    h.maxTier = 8;
    // Make this week's quests the three that a plain win always moves.
    h.weekly = { week: 2900, titled: false, quests: (['wins', 'kills', 'wall'] as const).map((id) => ({ id, goal: WEEKLY_QUESTS[id].goal, progress: 0, embers: 100, done: false })) };
    const embers = h.embers;
    let title: string | undefined;
    let paid = 0;
    for (let n = 0; n < 12; n++) {
      const r = applyRun(h, n + 1, win({ tier: 8, kills: 60 }), false);
      paid += r.weeklyEmbers ?? 0;
      title = title ?? r.title;
    }
    expect(h.weekly.quests.every((q) => q.done)).toBe(true);
    expect(paid).toBe(300);
    expect(h.embers).toBeGreaterThanOrEqual(embers + 300);
    expect(title).toBe(weeklyTitle(2900));
    expect(h.titles).toEqual([weeklyTitle(2900)]);
  });

  it('a new week rolls fresh quests; a run with no week leaves them alone', () => {
    const h = newHero();
    applyRun(h, 1, win({ week: 2900 }), false);
    expect(h.weekly?.week).toBe(2900);
    expect(weekState(h.weekly, 2901, h.maxTier).week).toBe(2901);
    const before = JSON.stringify(h.weekly);
    applyRun(h, 2, win({ week: undefined }), false);
    expect(JSON.stringify(h.weekly)).toBe(before);
  });

  it('counts each quest the way its text says', () => {
    const base = { victory: true, dungeon: 'foundry' as const, tier: 5, maxTier: 5, kills: 40, interrupts: 7, namedKills: 1, bounty: false };
    const q = (id: keyof typeof WEEKLY_QUESTS, dungeon?: 'foundry' | 'kiln') => ({ id, goal: 1, progress: 0, embers: 0, done: false, dungeon });
    expect(weeklyStep(q('interrupts'), base)).toBe(7);
    expect(weeklyStep(q('named'), base)).toBe(1);
    expect(weeklyStep(q('dungeon', 'foundry'), base)).toBe(1);
    expect(weeklyStep(q('dungeon', 'kiln'), base)).toBe(0);
    expect(weeklyStep(q('wins'), { ...base, bounty: true })).toBe(0);
    expect(weeklyStep(q('bounties'), { ...base, bounty: true })).toBe(1);
    expect(weeklyStep(q('wall'), { ...base, tier: 4 })).toBe(0);
  });

  it('the sim reports the week, this hero\'s interrupts and named kills', () => {
    const w = new World({ seed: 1, omens: [], week: 2900 });
    const s = w.summary();
    expect(s.week).toBe(2900);
    expect(s.interrupts).toBe(0);
    expect(s.namedKills).toBe(0);
    expect(new World({ seed: 1, omens: [] }).summary().week).toBeUndefined();
  });

  it('a bot delve counts its interrupts', () => {
    const w = new World({ seed: 2, omens: [], week: 2900 });
    let seen = 0;
    while (w.state !== 'ended' && w.time < 900) {
      if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
      w.step(botInput(w, 1));
      seen += w.events.filter((e) => e.type === 'interrupt').length;
    }
    expect(seen).toBeGreaterThan(0);
    expect(w.summary().interrupts).toBe(seen);
  });
});
