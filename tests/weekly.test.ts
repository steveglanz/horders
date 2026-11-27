import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../sim/content/achievements';
import { weeklyEmbers, weeklyFor, weekState, weeklyStep, weeklyTitle, WEEKLY, WEEKLY_QUESTS } from '../sim/content/weekly';
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
    h.achieved = ACHIEVEMENTS.map((a) => a.id); // only the weekly title here
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
    // Seed 3: with the CP2 Sparks (27 Nov) the seed-2 bot run ends faster and meets no cast it kicks (4 of seeds 1-5 do).
    const w = new World({ seed: 3, omens: [], week: 2900 });
    let seen = 0;
    while (w.state !== 'ended' && w.time < 900) {
      if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
      w.step(botInput(w, 1));
      seen += w.events.filter((e) => e.type === 'interrupt').length;
    }
    expect(seen).toBeGreaterThan(0);
    expect(w.summary().interrupts).toBe(seen);
  }, 30000);
});

describe('the party quest', () => {
  const groupWin = (over: Partial<RunSummary> = {}) => win({ dungeon: 'hammerdeep', tier: 6, realHeroes: 2, ...over });

  it('opens at the Hammerdeep tier, outside the three rolled quests, and leaves the rolls as they were', () => {
    expect(weekState(undefined, 2900, WEEKLY.partyTier - 1).party).toBeUndefined();
    const st = weekState(undefined, 2900, 8);
    expect(st.party?.id).toBe('party');
    expect(st.party?.embers).toBe(Math.round(weeklyEmbers(8) * WEEKLY.partyPay));
    expect(st.quests.map((q) => q.id)).toEqual(weeklyFor(2900, 8).map((q) => q.id));
    expect(st.quests.some((q) => q.id === 'party')).toBe(false);
    // An older save of this week gets it added.
    const old = { week: 2900, quests: weeklyFor(2900, 8), titled: false };
    expect(weekState(old, 2900, 8).party?.id).toBe('party');
  });

  it('counts only group wins with another real hero: bots, solo dungeons and losses don\'t count', () => {
    const q = { id: 'party' as const, goal: 2, progress: 0, embers: 0, done: false };
    const base = { victory: true, dungeon: 'hammerdeep' as const, tier: 6, maxTier: 6, kills: 40, interrupts: 0, namedKills: 0, bounty: false, group: true, realHeroes: 2 };
    expect(weeklyStep(q, base)).toBe(1);
    expect(weeklyStep(q, { ...base, realHeroes: 1 })).toBe(0); // the hero plus bots
    expect(weeklyStep(q, { ...base, realHeroes: undefined })).toBe(0);
    expect(weeklyStep(q, { ...base, group: false })).toBe(0);
    expect(weeklyStep(q, { ...base, victory: false })).toBe(0);
  });

  it('pays once through applyRun, and is not needed for the weekly title', () => {
    const h = newHero();
    h.maxTier = 8;
    h.achieved = ACHIEVEMENTS.map((a) => a.id);
    h.weekly = { week: 2900, titled: false, quests: (['wins', 'kills', 'wall'] as const).map((id) => ({ id, goal: 99, progress: 0, embers: 100, done: false })) };
    applyRun(h, 1, groupWin({ realHeroes: 1 }), false);
    expect(h.weekly.party?.progress).toBe(0);
    applyRun(h, 2, groupWin(), false);
    const r = applyRun(h, 3, groupWin({ dungeon: 'crucible', realHeroes: 4 }), false);
    expect(h.weekly.party?.done).toBe(true);
    expect(r.weeklyDone?.map((q) => q.id)).toEqual(['party']);
    expect(r.weeklyEmbers).toBe(h.weekly.party?.embers);
    expect(r.title).toBeUndefined();
    expect(applyRun(h, 4, groupWin(), false).weeklyDone).toBeUndefined();
  });

  it('the sim reports real heroes: a bot fill counts only the player', () => {
    expect(new World({ seed: 1, omens: [] }).summary().realHeroes).toBeUndefined();
    const fill = new World({ seed: 1, omens: [], dungeon: 'hammerdeep', party: [{ cls: 'lumen' }, { cls: 'duskblade' }], partySize: 3, fillBots: 2 });
    expect(fill.summary().realHeroes).toBe(1);
    const real = new World({ seed: 1, omens: [], dungeon: 'hammerdeep', party: [{ cls: 'lumen' }], partySize: 2 });
    expect(real.summary().realHeroes).toBe(2);
  });
});
