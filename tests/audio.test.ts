import { describe, expect, it } from 'vitest';
import { render, recipeLength } from '../client/audio/synth';
import { SOUNDS, SoundId } from '../client/audio/sounds';
import { bedSamples, THEMES } from '../client/audio/music';
import { CAST_SOUNDS, cueFor, partyCues, PHASE_STING, targetCue } from '../client/audio/cues';
import { ENEMIES } from '../sim/content/enemies';
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
    const classes: ClassId[] = ['emberwright', 'duskblade', 'bulwark', 'lumen'];
    const dungeons: DungeonId[] = ['kiln', 'foundry', 'glarewell'];
    classes.forEach((cls, k) => {
      const w = new World({ seed: 11 + k, cls, dungeon: dungeons[k % dungeons.length], tier: 1 });
      for (let i = 0; i < 30 * 150 && w.state !== 'ended'; i++) {
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
    for (const id of ['hit', 'levelUp', 'emberWave', 'duskDash', 'bulwarkSlam', 'lumenBurst'] as SoundId[]) expect(heard, id).toContain(id);
  });

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
      expect(id, b).toBe(PHASE_STING[b] ?? 'phase'); // a brand-new boss falls back to the generic sting
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
});
