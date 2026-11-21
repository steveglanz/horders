import { describe, expect, it } from 'vitest';
import { render, recipeLength } from '../client/audio/synth';
import { SOUNDS, SoundId } from '../client/audio/sounds';
import { bedSamples, THEMES } from '../client/audio/music';
import { CAST_SOUNDS, cueFor, partyCues, PHASE_STING, phaseSting, targetCue } from '../client/audio/cues';
import { ENEMIES } from '../sim/content/enemies';
import { buzzFor, BUZZ, Haptics } from '../client/audio/haptics';
import { uiSoundFor, Tappable } from '../client/audio/ui';
import { phoneShare } from '../tools/mixcheck';
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
    expect(cueFor({ type: 'castStart', index: 0, name: 'Anvilfall' }, c)?.id).toBe('anvilWarn');
    expect(cueFor({ type: 'castDone', x: 0, y: 0, name: 'Anvilfall' }, c)?.id).toBe('anvilfall');
    expect(cueFor({ type: 'castDone', x: 0, y: 0, name: 'Choir of Iron' }, c)?.id).toBe('choir');
    expect(cueFor({ type: 'castStart', index: 0, name: 'Molten Cataclysm' }, c)?.id).toBe('castWarn');
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
  });

  it('buzzes for your own big hits and boss telegraphs, not for allies', () => {
    const c = { cls: 'bulwark' as const, acting: 0 };
    expect(buzzFor({ type: 'playerHurt', amount: 30, hero: 0 }, c)).toBe(BUZZ.hurtBig);
    expect(buzzFor({ type: 'playerHurt', amount: 5 }, c)).toBe(BUZZ.hurt);
    expect(buzzFor({ type: 'playerHurt', amount: 30, hero: 1 }, c)).toBeNull();
    expect(buzzFor({ type: 'castStart', index: 0, name: 'Anvilfall' }, c)).toBe(BUZZ.telegraph);
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
  });

  it('has themes and cues ready for the Ashvents, the Coldmarrow and the raid', () => {
    for (const t of ['ashvents', 'coldmarrow', 'raid'] as const) expect(THEMES[t], t).toBeDefined();
    expect(THEMES.raid.meter).toBe(3);
    expect(THEMES.coldmarrow.coal).toBe(true);
    for (const name of ['Twin Vents', 'Scatter Embers', 'Bellow Slam', 'Long Night', 'Frost Lace', 'Ladle Pour', 'The Pour', 'Crucible Vents', 'Last Ember']) expect(CAST_SOUNDS[name], name).toBeDefined();
    expect(phaseSting('grandmotherSlag', 2)).toBe('phaseRaid2');
    expect(phaseSting('grandmotherSlag', 3)).toBe('phaseRaid3');
    expect(phaseSting('ysmeret', 2)).toBe('phaseYsmeret');
    expect(phaseSting('nobodyYet', 2)).toBe('phase');
    expect(cueFor({ type: 'burnout', warn: true }, { cls: 'lumen', acting: 0 })?.id).toBe('burnoutWarn');
    expect(cueFor({ type: 'burnout', warn: false }, { cls: 'lumen', acting: 0 })?.id).toBe('burnout');
    expect(cueFor({ type: 'namedSpawn', index: 0, name: 'Grisk the Vengeful', affix: 'Vengeful' }, { cls: 'lumen', acting: 0 })?.id).toBe('namedSpawn');
    expect(cueFor({ type: 'namedKill', x: 0, y: 0, name: 'Grisk the Vengeful' }, { cls: 'lumen', acting: 0 })?.id).toBe('namedKill');
    for (const v of Object.values(PHASE_STING)) for (const id of [v].flat()) expect(SOUNDS[id], id).toBeDefined();
  });
});
