import { describe, expect, it } from 'vitest';
import { World, IRONLOAD, ONDRELV2 } from '../sim/world';
import { cueFor, slagBurstAt, slagCues, SLAG_WARN_LEAD, THROTTLE, type CueContext } from '../client/audio/cues';
import { recipeLength } from '../client/audio/synth';
import { SOUNDS } from '../client/audio/sounds';

// ONDRELV2's sounds (design 25 Nov, ondrel-v2.md), all reused: the stage stings, the slag landing, the sizzle, the last heat.
type O = {
  ondrelClock(dt: number): void; finishCast(i: number): void; spawn(kind: string, x: number, y: number): number;
  bossIndex: number; bossSpawned: boolean; choirT: number; anvilT: number; anvilTarget: number; ondrelStage: number;
};

function fight(): { w: World; q: O; b: number } {
  const w = new World({ seed: 3, dungeon: 'hammerdeep', tier: 6, omens: [], cls: 'bulwark', party: [{ cls: 'lumen', name: 'b' }], ondrelV2: true });
  const q = w as unknown as O;
  for (const e of w.enemies) e.alive = false;
  w.stones = [];
  const b = q.spawn('ondrel', 0, -200);
  q.bossIndex = b; q.bossSpawned = true; q.ondrelStage = 1;
  q.anvilT = 99; q.choirT = 99;
  w.heroData(0).player.x = 0; w.heroData(0).player.y = 0;
  w.heroData(1).player.x = 400; w.heroData(1).player.y = 0;
  return { w, q, b };
}
function anvilfall(w: World, q: O, b: number, x: number): void {
  q.anvilTarget = 0;
  const p = w.heroData(0).player;
  p.x = x; p.y = 0; p.hp = p.maxHp; p.sunderT = 0;
  w.enemies[b].castId = 'anvilfall';
  q.finishCast(b);
  w.enemies[b].castId = '';
}
const ctx: CueContext = { cls: 'bulwark', acting: 0, boss: 'ondrel', dungeon: 'hammerdeep' };

describe('ONDRELV2 sound: reused cues only', () => {
  it('each stage change plays Ondrel\'s own sting, the last heat a little louder', () => {
    const { w, q, b } = fight();
    w.events.length = 0;
    w.enemies[b].hp = w.enemies[b].maxHp * ONDRELV2.stage2;
    q.ondrelClock(0.01);
    w.enemies[b].hp = w.enemies[b].maxHp * ONDRELV2.stage3;
    q.ondrelClock(0.01);
    const stings = w.events.filter((e) => e.type === 'phase').map((e) => cueFor(e, ctx));
    expect(stings).toEqual([{ id: 'phaseOndrel', vol: 1 }, { id: 'phaseOndrel', vol: 1.15 }]);
  });

  it('a new patch under each stage 2 Anvilfall flares once, even on the same spot; standing in it is the lava sizzle', () => {
    const { w, q, b } = fight();
    const st = { burning: new Map<string, number>(), glowing: new Set<string>() };
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
    q.ondrelClock(0.01);
    expect(slagCues(st, w.slagPatches)).toEqual([]);
    anvilfall(w, q, b, 0);
    expect(slagCues(st, w.slagPatches).map((c) => c.id)).toEqual(['lavaFlare']);
    expect(slagCues(st, w.slagPatches)).toEqual([]);
    anvilfall(w, q, b, 0);
    expect(w.slagPatches).toHaveLength(2);
    expect(slagCues(st, w.slagPatches).map((c) => c.id)).toEqual(['lavaFlare']);
    // Past the cap the oldest cools and the new one still flares.
    for (const x of [150, 300]) { anvilfall(w, q, b, x); slagCues(st, w.slagPatches); }
    anvilfall(w, q, b, -150);
    expect(w.slagPatches).toHaveLength(ONDRELV2.cap);
    expect(slagCues(st, w.slagPatches).map((c) => c.id)).toEqual(['lavaFlare']);
    // GameScene's inLava: the sim's own test, so the sizzle is heard only where the slag burns.
    expect(w.inSlag(0, 0)).toBe(true);
    expect(w.inSlag(0, 400)).toBe(false);
  });

  it('the last heat: one slag-vent warning timed to end as the patches burst, then one splash, never Ironload', () => {
    const { w, q, b } = fight();
    const st = { burning: new Map<string, number>(), glowing: new Set<string>() };
    w.enemies[b].hp = w.enemies[b].maxHp * 0.5;
    q.ondrelClock(0.01);
    for (const x of [0, 200, -200]) anvilfall(w, q, b, x);
    slagCues(st, w.slagPatches);
    w.enemies[b].hp = w.enemies[b].maxHp * ONDRELV2.stage3;
    q.ondrelClock(0.01);
    const warn = slagCues(st, w.slagPatches);
    expect(warn).toHaveLength(1);
    expect(warn[0].id).toBe('slagVentWarn');
    expect(warn[0].after! + SLAG_WARN_LEAD).toBeCloseTo(ONDRELV2.glow, 1);
    expect(recipeLength(SOUNDS.slagVentWarn)).toBeCloseTo(SLAG_WARN_LEAD, 1);
    // An Ironload landing on a hero away from every patch, while they glow, still sounds as Ironload.
    expect(slagBurstAt(st, { type: 'slam', x: 400, y: 0, r: IRONLOAD.radius })).toBe(false);
    let bursts = 0;
    for (let t = 0; t < ONDRELV2.glow + 0.2; t += 0.05) {
      w.events.length = 0;
      q.ondrelClock(0.05);
      for (const ev of w.events) if (ev.type === 'slam') {
        // The burst is as wide as Ironload, so cueFor alone would call it Ironload.
        expect(ev.r).toBe(IRONLOAD.radius);
        expect(cueFor(ev, ctx)?.id).toBe('ironload');
        expect(slagBurstAt(st, ev)).toBe(true);
        bursts++;
      }
      expect(slagCues(st, w.slagPatches)).toEqual([]);
    }
    expect(bursts).toBe(3);
    expect(THROTTLE.slagBurst).toBeGreaterThan(0);
  });
});
