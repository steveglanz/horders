import { describe, expect, it } from 'vitest';
import { World, KILN_V2, type SimEvent } from '../sim/world';
import { cueFor, kmHeatCues, KM_HEAT_LEAD, type CueContext } from '../client/audio/cues';
import { recipeLength } from '../client/audio/synth';
import { SOUNDS } from '../client/audio/sounds';

// BOSSV2's three-stage Kiln Mother (design's kiln-mother-v2.md, 25 Nov): sound from existing cues only.
type Q = {
  spawn(kind: string, x: number, y: number): number; runBoss(i: number, dt: number): void;
  damageEnemy(i: number, amount: number, canCrit: boolean): void; kmStart(): void;
  bossIndex: number; bossSpawned: boolean; kmClock: { swipe: number; egg: number };
};
const KEEP = new Set(['kilnMother', 'kilnBellows', 'ashling']);
const ctx: CueContext = { cls: 'emberwright', acting: 0, boss: 'kilnMother', dungeon: 'kiln' };
/** One step with only her fight up; returns that step's cues. */
function one(w: World): string[] {
  for (const e of w.enemies) if (e.alive && !KEEP.has(e.kind)) e.alive = false;
  w.step({ x: 0, y: 0 });
  return (w.events as SimEvent[]).map((ev) => cueFor(ev, ctx)?.id ?? '').filter(Boolean);
}
function mother(): { w: World; q: Q; b: number } {
  const w = new World({ seed: 3, dungeon: 'kiln', tier: 2, omens: [], cls: 'emberwright', bossV2: true });
  const q = w as unknown as Q;
  for (const e of w.enemies) e.alive = false;
  w.player.x = 200; w.player.y = 0;
  const b = q.spawn('kilnMother', 0, 0);
  q.bossIndex = b; q.bossSpawned = true;
  w.bossVariant = 'cataclysm';
  q.kmStart();
  return { w, q, b };
}
function intoKiln(w: World, q: Q, b: number): string[] {
  const e = w.enemies[b];
  e.hp = e.maxHp * (KILN_V2.stage2At - 0.01);
  w.events.length = 0;
  q.runBoss(b, 0.01);
  const heard = (w.events as SimEvent[]).map((ev) => cueFor(ev, ctx)?.id ?? '');
  w.player.x = 300; w.player.y = 0;
  for (let k = 0; k < 30 * 30 && !w.kmInKiln; k++) one(w);
  expect(w.kmInKiln).toBe(true);
  return heard;
}

describe('BOSSV2 Kiln Mother sound: reused cues only', () => {
  it('stage 2 plays her phase sting; an egg hatching spits like a Rift', () => {
    const { w, q, b } = mother();
    q.kmClock.egg = 0.001; q.kmClock.swipe = 99;
    q.runBoss(b, 0.01);
    w.player.x = 400; w.player.y = 300; // touch neither egg
    const heard: string[] = [];
    for (let n = 0; n < 30 * 6.3; n++) heard.push(...one(w));
    expect(heard.filter((id) => id === 'riftSpit')).toHaveLength(2);
    expect(intoKiln(w, q, b)).toContain('phaseKiln');
  });

  it('the heat: the vent warning ends as three quarters burn, then the lava flare, once per step of the heat', () => {
    const { w, q, b } = mother();
    intoKiln(w, q, b);
    const st = { warn: false, on: false };
    const got: { id: string; at: number }[] = [];
    for (let n = 0; n < 30 * 15; n++) {
      w.player.hp = w.player.maxHp;
      one(w);
      for (const c of kmHeatCues(st, w.kmHeat)) got.push({ id: c.id, at: w.time + (c.after ?? 0) });
    }
    const warns = got.filter((c) => c.id === 'kilnVentWarn'), flares = got.filter((c) => c.id === 'lavaFlare');
    // Every 6 s: one warning and one flare per step of the heat (15 s in the kiln: three).
    expect(warns.length).toBe(3);
    expect(flares.length).toBe(warns.length);
    // Each warning, delayed, ends as its quarters start to burn (within a step).
    for (let k = 0; k < warns.length; k++) expect(warns[k].at + KM_HEAT_LEAD).toBeCloseTo(flares[k].at, 1);
    expect(recipeLength(SOUNDS.kilnVentWarn)).toBeCloseTo(KM_HEAT_LEAD, 1);
    // Out of her fight: nothing.
    expect(kmHeatCues({ warn: false, on: false }, undefined)).toEqual([]);
  });

  it('each bellows broken closes like a Rift; all three and she falls out to the "hit it now" surge', () => {
    const { w, q, b } = mother();
    intoKiln(w, q, b);
    one(w);
    w.events.length = 0;
    for (let k = 0; k < w.enemies.length; k++) if (w.enemies[k].alive && w.enemies[k].kind === 'kilnBellows') q.damageEnemy(k, 1e6, false);
    const broke = (w.events as SimEvent[]).map((ev) => cueFor(ev, ctx)?.id);
    expect(broke.filter((id) => id === 'riftClosed')).toHaveLength(3);
    w.player.x = 300; w.player.y = 200;
    expect(one(w)).toContain('surgeReady');
    expect(w.kmStage).toBe(3);
  });

  it('out on her own after 40 s: her phase sting for stage 3, a little louder', () => {
    const { w, q, b } = mother();
    intoKiln(w, q, b);
    let out: string[] = [];
    for (let n = 0; n < 30 * 41 && w.kmStage === 2; n++) { w.player.hp = w.player.maxHp; out = one(w); }
    expect(w.kmStage).toBe(3);
    expect(out).toContain('phaseKiln');
    expect(cueFor({ type: 'castDone', x: 0, y: 0, id: 'kmOut', name: '' }, ctx)).toEqual({ id: 'phaseKiln', vol: 1.15 });
    for (const id of ['riftSpit', 'riftClosed', 'surgeReady', 'phaseKiln', 'kilnVentWarn', 'lavaFlare'] as const) expect(SOUNDS[id]).toBeDefined();
  });
});
