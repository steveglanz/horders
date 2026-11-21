import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, recipeLength } from '../client/audio/synth';
import { SOUNDS, SoundId } from '../client/audio/sounds';
import { bedSamples, chordAt, HUB_BY_SEASON, hubThemeFor, sectionAt, THEMES } from '../client/audio/music';
import { SEASON_START_WEEK, SEASON, SEASONS, seasonOf } from '../sim/content/season';
import { CAST_SOUNDS, cueFor, DUCK, partyCues, PHASE_STING, phaseSting, pickCue, ebbCue, PRIORITY, setCues, setFlagsOf, THROTTLE, reviveCues, targetCue } from '../client/audio/cues';
import { ENEMIES } from '../sim/content/enemies';
import { buzzFor, BUZZ, Haptics } from '../client/audio/haptics';
import { uiSoundFor, Tappable } from '../client/audio/ui';
import { phoneShare } from '../tools/mixcheck';
import { rewardCues } from '../client/audio/rewards';
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import type { ClassId } from '../sim/content/emberwright';
import type { DungeonId } from '../sim/content/dungeon';

const RATE = 22050;

describe('audio', () => {
  it('renders every sound effect as short, audible, unclipped samples', () => {
    for (const [id, recipe] of Object.entries(SOUNDS)) {
      const len = recipeLength(recipe);
      expect(len, id).toBeGreaterThan(0.02);
      expect(len, id).toBeLessThan(3);
      const s = render(recipe, RATE);
      let peak = 0;
      let finite = true;
      for (const v of s) {
        finite &&= Number.isFinite(v);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(finite, id).toBe(true);
      expect(peak, id).toBeGreaterThan(0.03);
      expect(peak, id).toBeLessThanOrEqual(1);
    }
  });

  it('renders repeatably', () => {
    expect(render(SOUNDS.hit, RATE)).toEqual(render(SOUNDS.hit, RATE));
  });

  it('builds seamless, normalized texture beds for every theme', () => {
    for (const th of Object.values(THEMES)) {
      const s = bedSamples(th.bed, RATE, 2);
      let peak = 0;
      for (const v of s) peak = Math.max(peak, Math.abs(v));
      expect(peak, th.bed).toBeCloseTo(1, 5);
      // Wrapping from the last sample to the first is no bigger a step than the bed's own jitter.
      expect(Math.abs(s[s.length - 1] - s[0]), th.bed).toBeLessThan(0.5);
    }
  });

  it('has a music theme for every dungeon', () => {
    for (const d of ['kiln', 'foundry', 'glarewell'] satisfies DungeonId[]) expect(THEMES[d]).toBeDefined();
  });

  it('gives real runs sounds that exist, for every class and dungeon', () => {
    const heard = new Set<SoundId>();
    const classes: ClassId[] = ['emberwright', 'duskblade', 'bulwark', 'lumen', 'slagbinder'];
    const dungeons: DungeonId[] = ['kiln', 'foundry', 'glarewell'];
    classes.forEach((cls, k) => {
      const w = new World({ seed: 11 + k, cls, dungeon: dungeons[k % dungeons.length], tier: 1 });
      // 75 simulated seconds per class is enough to hear every core sound and keeps this test near 1 s.
      for (let i = 0; i < 30 * 75 && w.state !== 'ended'; i++) {
        if (w.state === 'draft') w.choose(botChoose(w));
        else w.step(botInput(w));
        for (const ev of w.events) {
          const c = cueFor(ev, { cls, acting: w.acting });
          if (!c) continue;
          expect(SOUNDS[c.id], `${ev.type} -> ${c.id}`).toBeDefined();
          heard.add(c.id);
        }
      }
    });
    // The core moments of a run all make a sound.
    for (const id of ['hit', 'levelUp', 'emberWave', 'duskDash', 'bulwarkSlam', 'lumenBurst', 'slagLob', 'slagPlate'] as SoundId[]) expect(heard, id).toContain(id);
    // Four bot runs of up to 150 s each: about 2.4 s locally and 3.7 s on CI on main, so the 5 s default is too tight.
  }, 20000);

  it('keeps every sound audible on a phone speaker (a quarter of its energy above 350 Hz)', () => {
    for (const [id, recipe] of Object.entries(SOUNDS)) expect(phoneShare(render(recipe, 32000), 32000), id).toBeGreaterThan(0.25);
  });

  it('gives the Hammerdeep its theme and Ondrel\'s casts their own sounds', () => {
    expect(THEMES.hammerdeep).toBeDefined();
    for (const s of Object.values(CAST_SOUNDS)) for (const id of [s.start, s.done]) if (id) expect(SOUNDS[id]).toBeDefined();
    const c = { cls: 'bulwark' as const, acting: 0 };
    expect(cueFor({ type: 'castStart', index: 0, id: 'anvilfall', name: 'Anvilfall' }, c)?.id).toBe('anvilWarn');
    expect(cueFor({ type: 'castDone', x: 0, y: 0, id: 'anvilfall', name: 'Anvilfall' }, c)?.id).toBe('anvilfall');
    expect(cueFor({ type: 'castDone', x: 0, y: 0, id: 'choir', name: 'Choir of Iron' }, c)?.id).toBe('choir');
    expect(cueFor({ type: 'castStart', index: 0, id: 'cataclysm', name: 'Molten Cataclysm' }, c)?.id).toBe('castWarn');
    expect(cueFor({ type: 'slagGrip', x: 0, y: 0, stacks: 5 }, c)).toMatchObject({ id: 'slag', vol: 1.05 });
    expect(cueFor({ type: 'cleanse', x: 0, y: 0 }, c)?.id).toBe('cleanse');
  });

  it('gives every boss its own phase-change sting', () => {
    const bosses = Object.values(ENEMIES).filter((e) => e.rank === 'boss').map((e) => e.id);
    expect(bosses.length).toBeGreaterThan(0);
    for (const b of bosses) {
      const id = cueFor({ type: 'phase', phase: 2 }, { cls: 'lumen', acting: 0, boss: b })?.id;
      expect(id, b).toBe(phaseSting(b, 2)); // a brand-new boss falls back to the generic sting
      expect(id === 'phase', b).toBe(!PHASE_STING[b]);
      expect(SOUNDS[id!], b).toBeDefined();
    }
    expect(cueFor({ type: 'phase', phase: 2 }, { cls: 'lumen', acting: 0 })?.id).toBe('phase');
  });

  it('stings once when Anvilfall winds up on you, and again on the next one', () => {
    const t = { on: false };
    expect(targetCue(t, false)).toBeNull();
    expect(targetCue(t, true)?.id).toBe('targeted');
    expect(targetCue(t, true)).toBeNull(); // same wind-up
    expect(targetCue(t, false)).toBeNull();
    expect(targetCue(t, true)?.id).toBe('targeted');
  });

  it('hears co-op heroes go down and get back up', () => {
    const down: boolean[] = [];
    expect(partyCues(down, [100, 80, 60], 0)).toEqual([]); // first look only records
    expect(partyCues(down, [100, 0, 60], 0).map((c) => c.id)).toEqual(['allyDown']);
    expect(partyCues(down, [100, 0, 60], 0)).toEqual([]); // still down: no repeat
    expect(partyCues(down, [0, 0, 60], 0).map((c) => c.id)).toEqual(['selfDown']);
    expect(partyCues(down, [30, 24, 60], 0).map((c) => c.id)).toEqual(['allyUp', 'allyUp']);
    expect(partyCues(down, [30, 24], 0)).toEqual([]); // someone left: start over quietly
    const roles = ['dps', 'tank', 'healer', 'dps'];
    const d2: boolean[] = [];
    partyCues(d2, [9, 9, 9, 9], 0, roles);
    expect(partyCues(d2, [9, 0, 0, 0], 0, roles).map((c) => c.id)).toEqual(['roleDown', 'roleDown', 'allyDown']);
  });

  it('buzzes for your own big hits and boss telegraphs, not for allies', () => {
    const c = { cls: 'bulwark' as const, acting: 0 };
    expect(buzzFor({ type: 'playerHurt', amount: 30, hero: 0 }, c)).toBe(BUZZ.hurtBig);
    expect(buzzFor({ type: 'playerHurt', amount: 5 }, c)).toBe(BUZZ.hurt);
    expect(buzzFor({ type: 'playerHurt', amount: 30, hero: 1 }, c)).toBeNull();
    expect(buzzFor({ type: 'castStart', index: 0, id: 'anvilfall', name: 'Anvilfall' }, c)).toBe(BUZZ.telegraph);
    expect(buzzFor({ type: 'hit', x: 0, y: 0, amount: 9, crit: false }, c)).toBeNull();
    for (const p of Object.values(BUZZ)) expect(p.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(400);
  });

  it('throttles vibration, letting a longer pattern cut in', () => {
    const calls: number[][] = [];
    const g = globalThis as unknown as { navigator?: unknown };
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: { vibrate: (p: number[]) => calls.push(p) }, configurable: true });
    try {
      const h = new Haptics();
      h.buzz(BUZZ.hurt, 1000);
      h.buzz(BUZZ.hurt, 1050); // too soon, not longer: dropped
      h.buzz(BUZZ.targeted, 1060); // longer: cuts in
      h.buzz(BUZZ.hurt, 1300);
      h.enabled = false;
      h.buzz(BUZZ.hurtBig, 2000);
      expect(calls).toEqual([BUZZ.hurt, BUZZ.targeted, BUZZ.hurt]);
    } finally {
      if (saved) Object.defineProperty(globalThis, 'navigator', saved);
      else delete g.navigator;
    }
  });

  it('picks interface sounds by what was tapped', () => {
    // A stand-in element: matches a selector if any of its "tags" appear in it.
    const el = (tags: string[], attrs: Record<string, string> = {}): Tappable => {
      const self: Tappable = {
        closest: (sel) => (sel.split(',').some((q) => tags.some((t) => q.trim() === t)) ? self : null),
        getAttribute: (n) => attrs[n] ?? null,
      };
      return self;
    };
    expect(uiSoundFor(el(['button', '#startBtn']))).toBe('confirm');
    expect(uiSoundFor(el(['button', '#menuBtn']))).toBe('back');
    expect(uiSoundFor(el(['button', '#bagBtn']))).toBe('open');
    expect(uiSoundFor(el(['button', '[data-cls]'], { 'aria-pressed': 'false' }))).toBe('select');
    expect(uiSoundFor(el(['button']))).toBe('click');
    expect(uiSoundFor(el(['[data-sfx]', 'button'], { 'data-sfx': 'select' }))).toBe('select');
    expect(uiSoundFor(el(['[data-sfx]', 'button'], { 'data-sfx': 'none' }))).toBeNull();
    expect(uiSoundFor(el(['div']))).toBeNull();
    for (const id of ['salvage', 'forge', 'temper', 'brew']) expect(uiSoundFor(el(['[data-sfx]', 'button'], { 'data-sfx': id }))).toBe(id);
  });

  it('has themes and cues ready for the Ashvents, the Coldmarrow and the raid', () => {
    for (const t of ['ashvents', 'coldmarrow', 'raid'] as const) expect(THEMES[t], t).toBeDefined();
    expect(THEMES.raid.meter).toBe(3);
    expect(THEMES.coldmarrow.coal).toBe(true);
    for (const id of ['twinVents', 'scatter', 'bellowSlam', 'longNight', 'frostLace', 'ladlePour', 'pour', 'crucibleVents', 'lastEmber']) expect(CAST_SOUNDS[id], id).toBeDefined();
    expect(phaseSting('grandmotherSlag', 2)).toBe('phaseRaid2');
    expect(phaseSting('grandmotherSlag', 3)).toBe('phaseRaid3');
    expect(phaseSting('ysmeret', 2)).toBe('phaseYsmeret');
    expect(phaseSting('nobodyYet', 2)).toBe('phase');
    expect(cueFor({ type: 'burnout', warn: true }, { cls: 'lumen', acting: 0 })?.id).toBe('burnoutWarn');
    expect(cueFor({ type: 'burnout', warn: false }, { cls: 'lumen', acting: 0 })?.id).toBe('burnout');
    expect(cueFor({ type: 'namedSpawn', index: 0, name: 'Grisk the Vengeful', affix: 'Vengeful' }, { cls: 'lumen', acting: 0 })?.id).toBe('namedSpawn');
    expect(cueFor({ type: 'namedKill', x: 0, y: 0, name: 'Grisk the Vengeful' }, { cls: 'lumen', acting: 0 })?.id).toBe('namedKill');
    const alt = { type: 'ability', alt: true, slot: 1, x: 0, y: 0, angle: 0, r: 40 } as const;
    expect(cueFor(alt, { cls: 'emberwright', acting: 0 })?.id).toBe('emberWard');
    expect(cueFor({ ...alt, slot: 0 }, { cls: 'duskblade', acting: 0 })?.id).toBe('hamstring');
    expect(cueFor({ ...alt, slot: 2 }, { cls: 'bulwark', acting: 0 })?.id).toBe('rallyingCry');
    expect(cueFor(alt, { cls: 'lumen', acting: 0 })?.id).toBe('lightwell');
    expect(cueFor(alt, { cls: 'slagbinder', acting: 0 })?.id).toBe('slagPit');
    for (const v of Object.values(PHASE_STING)) for (const id of [v].flat()) expect(SOUNDS[id], id).toBeDefined();
  });

  it('chimes for what a run unlocked, after the end sting, at most three times', () => {
    expect(rewardCues(undefined)).toEqual([]);
    const base = { heroXp: 0, items: [], levelsGained: 0 } as never;
    expect(rewardCues(base)).toEqual([]);
    const ach = { id: 'x', name: 'A', title: 'T', embers: 10 };
    const cues = rewardCues({ ...(base as object), achievements: [ach, ach], title: 'The Bold', weeklyDone: [{}, {}] } as never);
    expect(cues.map((c) => c.id)).toEqual(['achievement', 'achievement', 'unlock']);
    expect(cues[0].at).toBeGreaterThan(1.5);
    expect(cues[1].at).toBeGreaterThan(cues[0].at);
    // An in-season win chimes after a season level and before smaller unlocks.
    expect(rewardCues({ ...(base as object), seasonFrom: 3, seasonTo: 4, seasonFeatured: true, title: 'The Bold' } as never).map((c) => c.id)).toEqual(['seasonUp', 'inSeason', 'unlock']);
    expect(rewardCues({ ...(base as object), seasonFeatured: true } as never).map((c) => c.id)).toEqual(['inSeason']);
  });

  it('keys every boss-cast sound to a cast id the sim really uses', () => {
    const sim = readFileSync(new URL('../sim/world.ts', import.meta.url), 'utf8');
    for (const id of Object.keys(CAST_SOUNDS)) expect(sim.includes(`'${id}'`), id).toBe(true);
  });

  it('hears a boss-fight pick-up start, count up, break off, and the last one spent', () => {
    const st = { t: [] as number[], left: Infinity };
    const ids = (t: number[], left = 1) => reviveCues(st, t, 9, left).map((c) => c.id);
    expect(ids([0, 0])).toEqual([]); // first look only records
    expect(ids([0, 0.03])).toEqual(['reviveStart']);
    expect(ids([0, 0.9])).toEqual([]);
    expect(ids([0, 1.02])).toEqual(['reviveTick']);
    expect(ids([0, 0])).toEqual(['reviveLost']); // stepped off at 1 s of 9
    expect(ids([0, 8.97])).toEqual(['reviveStart']);
    expect(ids([0, 0], 0)).toEqual(['revivesSpent']); // picked up: the pick-up is the 'revive' event, and that was the only one
    expect(ids([0, 0], 0)).toEqual([]);
    expect(ids([0, 0], Infinity)).toEqual([]); // the boss fell: no limit again
  });

  it('gives every boss warning priority over the fight noise', () => {
    for (const id of PRIORITY) expect(SOUNDS[id], id).toBeDefined();
    for (const s of Object.values(CAST_SOUNDS)) if (s.start) expect(PRIORITY.has(s.start), s.start).toBe(true);
    for (const id of ['targeted', 'allyDown', 'selfDown', 'bossSpawn', 'revivesSpent'] as SoundId[]) expect(PRIORITY.has(id), id).toBe(true);
    for (const id of ['hit', 'swing', 'mote', 'crit', 'heal'] as SoundId[]) expect(PRIORITY.has(id), id).toBe(false);
    expect(DUCK.gain).toBeLessThan(1);
  });

  it('plays a season-track level-up after any achievements', () => {
    const r = { heroXp: 0, items: [], levelsGained: 0, seasonFrom: 3, seasonTo: 4, achievements: [{ id: 'x', name: 'A', title: 'T', embers: 1 }] } as never;
    expect(rewardCues(r).map((c) => c.id)).toEqual(['achievement', 'seasonUp']);
  });

  it('varies long sessions: every theme walks a section plan, keeping its chords, and boss fights never break down', () => {
    for (const th of Object.values(THEMES)) {
      const meter = th.meter ?? 4;
      const pass = 2 * th.progression.length * meter; // beats in one pass through the progression
      const names = Array.from({ length: 6 }, (_, k) => sectionAt(k * pass, th, false).name);
      expect(new Set(names).size, th.root + '').toBeGreaterThanOrEqual(3);
      expect(names).toContain('breakdown');
      for (let b = 0; b < pass * 6; b += meter) {
        expect(th.progression).toContain(chordAt(b, th, false));
        expect(sectionAt(b, th, true).name).not.toBe('breakdown');
      }
      // The plan repeats only after six passes.
      expect(sectionAt(6 * pass, th, false)).toEqual(sectionAt(0, th, false));
    }
  });

  it('stings when a capstone is taken (it opens the branch\'s deep cards), and not for other picks', () => {
    expect(pickCue('unbreakable')?.id).toBe('capstone');
    expect(pickCue('bladeStorm')?.id).toBe('capstone');
    expect(pickCue('rivetedPlates')).toBeNull(); // a deep card
    expect(pickCue('stoke')).toBeNull();
    for (const id of ['leeSide', 'frontMend', 'turnedBack', 'closeWarmth', 'wideShell'] as const) expect(pickCue(id)?.id, id).toBe('partyCard');
    expect(pickCue(undefined)).toBeNull();
  });

  it('gives the Wrackline its theme, Hessa\'s casts their sounds, and the Ebb a drag when the pull starts', () => {
    expect(THEMES.wrackline.bed).toBe('surf');
    const c = { cls: 'lumen' as const, acting: 0 };
    expect(cueFor({ type: 'castStart', index: 0, id: 'ebb', name: 'The Ebb' }, c)?.id).toBe('ebbWarn');
    expect(cueFor({ type: 'castStart', index: 0, id: 'sink', name: 'Sink' }, c)?.id).toBe('sinkWarn');
    expect(cueFor({ type: 'castDone', x: 0, y: 0, id: 'sink', name: 'Sink' }, c)?.id).toBe('sink');
    expect(cueFor({ type: 'castStart', index: 0, id: 'haul', name: 'Haul' }, c)?.id).toBe('haulWarn');
    expect(cueFor({ type: 'castStart', index: 0, id: 'shoalCall', name: 'Call the Shoal' }, c)?.id).toBe('shoalCall');
    expect(phaseSting('hessa', 2)).toBe('phaseHessa');
    const st = { on: false };
    expect(ebbCue(st, false)).toBeNull();
    expect(ebbCue(st, true)?.id).toBe('ebbPull');
    expect(ebbCue(st, true)).toBeNull();
    expect(ebbCue(st, false)).toBeNull();
  });
});

describe('season hub themes', () => {
  it('season 1 keeps the plain hub and season 2, the Deep Bellows, plays over the forge bellows', () => {
    expect(SEASONS[1].name).toBe('the Deep Bellows');
    expect(hubThemeFor(0, SEASONS.length)).toBe('hub');
    expect(hubThemeFor(1, SEASONS.length)).toBe('hubBellows');
    expect(THEMES.hubBellows.bed).toBe('forge');
    // Season 3, the Cold Hearth: the Coldmarrow's frost and its Hearthcoal crackle.
    expect(SEASONS[2].name).toBe('the Cold Hearth');
    expect(hubThemeFor(2, SEASONS.length)).toBe('hubHearth');
    expect(THEMES.hubHearth.bed).toBe('frost');
    expect(THEMES.hubHearth.coal).toBe(true);
    // Season 2 starts on week 2974 (docs/design/season.md).
    expect(hubThemeFor(seasonOf(SEASON_START_WEEK + SEASON.weeks), SEASONS.length)).toBe('hubBellows');
  });
  it('wraps with the season rotation and falls back to the plain hub', () => {
    expect(HUB_BY_SEASON.length).toBeLessThanOrEqual(SEASONS.length);
    expect(hubThemeFor(SEASONS.length + 1, SEASONS.length)).toBe('hubBellows');
    expect(hubThemeFor(-1, SEASONS.length)).toBe(HUB_BY_SEASON[SEASONS.length - 1] ?? 'hub');
    for (let i = 0; i < SEASONS.length; i++) expect(THEMES[hubThemeFor(i, SEASONS.length)]).toBeDefined();
  });
});

describe('verb-set proc cues', () => {
  const p = { hp: 100, planted: true, surge: true, kbT: 3, warmth: 5, coverT: 0, bondT: 0 };
  it('reads each flag only with the pieces that grant it, and never on a dead hero', () => {
    expect(setFlagsOf(p, () => 1)).toEqual({ planted: false, surge: false, sharp: false, warmFull: false, covered: false, bonded: false });
    expect(setFlagsOf(p, () => 3)).toEqual({ planted: true, surge: true, sharp: true, warmFull: true, covered: false, bonded: false });
    // Tidewalker's surge and Hearthkeeper's full Warmth are the 3-piece bonuses.
    expect(setFlagsOf(p, () => 2)).toEqual({ planted: true, surge: false, sharp: true, warmFull: false, covered: false, bonded: false });
    expect(setFlagsOf({ ...p, hp: 0 }, () => 3)).toEqual({ planted: false, surge: false, sharp: false, warmFull: false, covered: false, bonded: false });
    expect(setFlagsOf({ ...p, warmth: 4 }, () => 3).warmFull).toBe(false);
  });
  it('sounds a proc as it turns on, once', () => {
    const was = {};
    const off = { planted: false, surge: false, sharp: false, warmFull: false, covered: false, bonded: false };
    expect(setCues(was, off)).toEqual([]);
    expect(setCues(was, { ...off, planted: true }).map((c) => c.id)).toEqual(['planted']);
    expect(setCues(was, { ...off, planted: true })).toEqual([]);
    expect(setCues(was, { planted: true, surge: true, sharp: true, warmFull: true, covered: false, bonded: false }).map((c) => c.id)).toEqual(['surgeReady', 'sharpen', 'warmthFull']);
    expect(setCues(was, off)).toEqual([]);
    expect(setCues(was, { ...off, planted: true }).map((c) => c.id)).toEqual(['planted']);
    expect(THROTTLE.planted).toBeGreaterThan(0);
  });
  it('Kinbound: Covered and Bonded sound as they start, and a dead hero hears neither', () => {
    const q = { hp: 100, coverT: 4, bondT: 4 };
    expect(setFlagsOf(q, () => 0)).toMatchObject({ covered: true, bonded: true });
    expect(setFlagsOf({ ...q, hp: 0 }, () => 3)).toMatchObject({ covered: false, bonded: false });
    const was = {};
    const off = setFlagsOf({ hp: 100 }, () => 0);
    setCues(was, off);
    expect(setCues(was, setFlagsOf(q, () => 0)).map((c) => c.id)).toEqual(['covered', 'bonded']);
    expect(setCues(was, setFlagsOf({ ...q, coverT: 2 }, () => 0))).toEqual([]);
    expect(THROTTLE.covered).toBeGreaterThan(0);
    expect(THROTTLE.bonded).toBeGreaterThan(0);
  });
  it("Glarewarden's dodge has its own sound", () => {
    expect(cueFor({ type: 'dodge', x: 0, y: 0, healed: 5 }, { cls: 'emberwright', acting: 0 })?.id).toBe('dodged');
    for (const id of ['planted', 'surgeReady', 'sharpen', 'dodged', 'warmthFull', 'covered', 'bonded'] as const) expect(SOUNDS[id]).toBeDefined();
  });
});
