import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { cueFor, GRATE_LIFT_AFTER, landCueFor, PRIORITY, restCue, type CueContext } from '../client/audio/cues';
import { render, recipeLength } from '../client/audio/synth';
import { HALLS } from '../sim/halls';
import { SOUNDS } from '../client/audio/sounds';

const ctxOf = (w: World): CueContext => ({ cls: w.cls, acting: w.acting, hallsPacks: w.hallsOn ? w.halls!.packs : undefined });

describe('Sound for Halls (Phase 18)', () => {
  it('a pack waking is must-hear; the boss door and Catch breath are ordinary', () => {
    expect(PRIORITY.has('packWake')).toBe(true);
    expect(PRIORITY.has('packWakeExtra')).toBe(true);
    expect(PRIORITY.has('doorSeal')).toBe(false);
    expect(PRIORITY.has('catchBreath')).toBe(false);
    for (const id of ['packWake', 'packWakeExtra', 'doorSeal', 'catchBreath'] as const) expect(SOUNDS[id]).toBeDefined();
  });

  it('a wake with a second pack already awake is "you pulled two"; a shrine wakes silently', () => {
    const c = (packs: { enc: string; state: string }[]): CueContext => ({ cls: 'emberwright', acting: 0, hallsPacks: packs });
    const fight = { enc: 'ashwall', state: 'awake' };
    expect(cueFor({ type: 'hallsWake', pack: 0 }, c([fight]))?.id).toBe('packWake');
    expect(cueFor({ type: 'hallsWake', pack: 1 }, c([fight, { ...fight }]))?.id).toBe('packWakeExtra');
    expect(cueFor({ type: 'hallsWake', pack: 0 }, c([{ enc: 'shrine', state: 'cleared' }]))).toBeNull();
    expect(cueFor({ type: 'hallsDoor' }, c([]))?.id).toBe('doorSeal');
  });

  it('Catch breath plays once as it starts, not while it lasts or as it ends', () => {
    const st = { on: false };
    const done = [{ state: 'cleared' }, { state: 'asleep' }];
    expect(restCue(st, false, done)).toBeNull();
    expect(restCue(st, true, done)?.id).toBe('catchBreath');
    expect(restCue(st, true, done)).toBeNull();
    expect(restCue(st, false, done)).toBeNull();
    expect(restCue(st, true, done)?.id).toBe('catchBreath');
  });

  it('the walk in before the first pack is cleared rests silently (design, 25 Nov)', () => {
    const st = { on: false };
    expect(restCue(st, true, [{ state: 'asleep' }, { state: 'asleep' }])).toBeNull();
    expect(restCue(st, true)).toBeNull();
    // Resting carries on as that first pack is cleared: the rest after it is heard.
    expect(restCue(st, true, [{ state: 'cleared' }, { state: 'asleep' }])?.id).toBe('catchBreath');
  });

  it('a real Halls delve: packs wake, the party catches its breath between them, then the boss door closes', () => {
    const w = new World({ seed: 3, tier: 2, halls: true, cls: 'emberwright', invulnerable: true });
    const st = { on: false };
    const heard: string[] = [];
    while (w.state !== 'ended' && w.time < 600 && !heard.includes('doorSeal')) {
      if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
      w.step(botInput(w));
      const ctx = ctxOf(w);
      for (const ev of w.events) { const cue = cueFor(ev, ctx); if (cue && /^packWake|^doorSeal$/.test(cue.id)) heard.push(cue.id); }
      const r = restCue(st, w.hallsResting, w.halls!.packs);
      if (r) { heard.push(r.id); expect(w.halls!.packs.some((pk) => pk.state === 'cleared')).toBe(true); expect(w.halls!.packs.some((pk) => pk.state === 'awake') || w.aliveEnemies > 0).toBe(false); }
    }
    expect(heard.filter((id) => id.startsWith('packWake')).length).toBeGreaterThanOrEqual(3);
    expect(heard).toContain('catchBreath');
    expect(heard.at(-1)).toBe('doorSeal');
    // A fresh delve opens with a wake, never with Catch breath.
    expect(heard[0]).toMatch(/^packWake/);
  }, 60000);
});

describe('Sound for the Halls room lock (H2b)', () => {
  it('the grates glow, drop and sink with their own sounds; a leash is silent', () => {
    const c: CueContext = { cls: 'emberwright', acting: 0 };
    expect(cueFor({ type: 'hallsGrateWarn', room: 1 }, c)?.id).toBe('grateWarn');
    expect(cueFor({ type: 'hallsGrateDrop', room: 1 }, c)?.id).toBe('grateDrop');
    expect(cueFor({ type: 'hallsLeash', room: 1 }, c)).toBeNull();
    // The lift lands after the clear's level-up chord, which covered it when played at once.
    expect(cueFor({ type: 'hallsGrateLift', room: 1 }, c)).toBeNull();
    expect(landCueFor({ type: 'hallsGrateLift', room: 1 })).toEqual({ id: 'grateLift', after: GRATE_LIFT_AFTER });
    expect(GRATE_LIFT_AFTER).toBeGreaterThan(0.5);
    expect(GRATE_LIFT_AFTER).toBeLessThan(HALLS.lockDelay + 0.5);
    for (const id of ['grateWarn', 'grateDrop', 'grateLift'] as const) {
      expect(SOUNDS[id]).toBeDefined();
      // The wake is the must-hear cue at that moment; the grates are ordinary, and never duck it.
      expect(PRIORITY.has(id)).toBe(false);
    }
  });

  it('the warning swells for the 1 s the doorways glow, so it peaks as the bars drop', () => {
    const s = render(SOUNDS.grateWarn, 22050);
    const rms = (a: number, b: number) => Math.sqrt(s.slice(a * 22050, b * 22050).reduce((x, v) => x + v * v, 0) / ((b - a) * 22050));
    expect(recipeLength(SOUNDS.grateWarn)).toBeCloseTo(HALLS.lockDelay + 0.05, 1);
    expect(rms(0.7, 0.95)).toBeGreaterThan(3 * rms(0.05, 0.3));
  });

  it('a real Halls delve: each room that seals is heard warning, then dropping, then lifting', () => {
    const w = new World({ seed: 3, tier: 2, halls: true, cls: 'emberwright', invulnerable: true });
    const heard: string[] = [];
    while (w.state !== 'ended' && w.time < 600 && w.hallsOn) {
      if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
      w.step(botInput(w));
      const ctx = ctxOf(w);
      for (const ev of w.events) {
        const cue = cueFor(ev, ctx) ?? landCueFor(ev);
        if (cue && cue.id.startsWith('grate')) heard.push(cue.id);
      }
    }
    expect(heard.filter((id) => id === 'grateDrop').length).toBeGreaterThanOrEqual(2);
    // Every drop follows a warning, and every lift a drop.
    let warned = 0, dropped = 0;
    for (const id of heard) {
      if (id === 'grateWarn') warned++;
      if (id === 'grateDrop') { expect(warned).toBeGreaterThan(0); warned--; dropped++; }
      if (id === 'grateLift') { expect(dropped).toBeGreaterThan(0); dropped--; }
    }
    expect(heard).toContain('grateLift');
  }, 60000);
});
