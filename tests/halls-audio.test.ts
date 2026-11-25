import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { cueFor, PRIORITY, restCue, type CueContext } from '../client/audio/cues';
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
    expect(restCue(st, false)).toBeNull();
    expect(restCue(st, true)?.id).toBe('catchBreath');
    expect(restCue(st, true)).toBeNull();
    expect(restCue(st, false)).toBeNull();
    expect(restCue(st, true)?.id).toBe('catchBreath');
  });

  it('a real Halls delve: packs wake, the party catches its breath between them, then the boss door closes', () => {
    const w = new World({ seed: 2, tier: 2, halls: true, cls: 'emberwright', invulnerable: true });
    const st = { on: false };
    const heard: string[] = [];
    while (w.state !== 'ended' && w.time < 600 && !heard.includes('doorSeal')) {
      if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
      w.step(botInput(w));
      const ctx = ctxOf(w);
      for (const ev of w.events) { const cue = cueFor(ev, ctx); if (cue && /^packWake|^doorSeal$/.test(cue.id)) heard.push(cue.id); }
      const r = restCue(st, w.hallsResting);
      if (r) { heard.push(r.id); expect(w.halls!.packs.some((pk) => pk.state === 'awake') || w.aliveEnemies > 0).toBe(false); }
    }
    expect(heard.filter((id) => id.startsWith('packWake')).length).toBeGreaterThanOrEqual(3);
    expect(heard).toContain('catchBreath');
    expect(heard.at(-1)).toBe('doorSeal');
  }, 60000);
});
