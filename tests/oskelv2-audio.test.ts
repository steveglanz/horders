import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { OSKELV2, World } from '../sim/world';
import { cueFor, CRUSH_R, flipCue, PRIORITY, type CueContext } from '../client/audio/cues';
import { recipeLength } from '../client/audio/synth';
import { SOUNDS } from '../client/audio/sounds';
import { ROOM_BEDS } from '../client/audio/music';

// OSKELV2's sounds (design 25 Nov, oskel-v2.md): his stage stings, the flip warning, the crush and the running belt.
type Q = { startEncounter(): void; encounter: number; route: string[]; bossIndex: number; oskelClock(dt: number): void; downT: number; rivetT: number; stampT: number };
function fight(): { w: World; q: Q } {
  const w = new World({ seed: 4, dungeon: 'pressworks', tier: 10, omens: [], cls: 'bulwark', party: [{ cls: 'lumen', name: 'b' }], oskelV2: true });
  const q = w as unknown as Q;
  for (const e of w.enemies) e.alive = false;
  q.route[1] = 'oskel';
  q.encounter = 1;
  q.startEncounter();
  const b = w.enemies[q.bossIndex];
  b.x = b.px = 0; b.y = b.py = 0;
  w.heroData(0).player.x = 0; w.heroData(0).player.y = 100;
  w.heroData(1).player.x = 0; w.heroData(1).player.y = -100;
  q.downT = q.rivetT = q.stampT = 999;
  return { w, q };
}
const ctx: CueContext = { cls: 'bulwark', acting: 0, boss: 'oskel', dungeon: 'pressworks' };

describe('OSKELV2 sound', () => {
  it('stages 2 and 3 play his own phase sting, the last a little louder', () => {
    const { w, q } = fight();
    const b = w.enemies[q.bossIndex];
    w.events.length = 0;
    b.hp = b.maxHp * (OSKELV2.stage2 - 0.01);
    q.oskelClock(0.05);
    b.hp = b.maxHp * (OSKELV2.stage3 - 0.01);
    q.oskelClock(0.05);
    expect(w.events.filter((e) => e.type === 'phase').map((e) => cueFor(e, ctx))).toEqual([{ id: 'phaseOskel', vol: 1 }, { id: 'phaseOskel', vol: 1.15 }]);
  });

  it('each flip: one must-hear "the current turns" as its 1.5 s warning goes up, done before the belt turns', () => {
    const { w, q } = fight();
    const b = w.enemies[q.bossIndex];
    b.hp = b.maxHp * 0.5;
    q.oskelClock(0.05);
    const st = { on: false };
    const warns: number[] = [];
    let dir = w.osDir;
    const flips: number[] = [];
    for (let t = 0; t < 20; t += 0.05) {
      // Only oskelClock runs here, so the first plate never lands: clear it before the second Downstroke.
      if (Math.abs(t - 10) < 0.01) for (const p of w.telegraphs) if (p.owner === -3) p.alive = false;
      if (Math.abs(t - 1) < 0.01 || Math.abs(t - 11) < 0.01) q.downT = 0; else q.downT = 999;
      q.oskelClock(0.05);
      if (flipCue(st, w.osStage === 2 && w.osFlipT > 0)) warns.push(t);
      if (w.osDir !== dir) { flips.push(t); dir = w.osDir; }
    }
    expect(warns).toHaveLength(2);
    expect(flips).toHaveLength(2);
    for (let k = 0; k < 2; k++) expect(flips[k] - warns[k]).toBeCloseTo(OSKELV2.flipWarn, 1);
    expect(recipeLength(SOUNDS.tideTurn)).toBeLessThan(OSKELV2.flipWarn);
    expect(PRIORITY.has('tideTurn')).toBe(true);
  });

  it('a crush (the crush line, or a second Downstroke) is one heavy press punch; other slams keep theirs', () => {
    const { w, q } = fight();
    const b = w.enemies[q.bossIndex];
    b.hp = b.maxHp * 0.5;
    w.osDir = 0;
    q.oskelClock(0.05);
    const h = w.heroData(0).player;
    h.hp = h.maxHp; h.x = w.arenaR - 20; h.y = 0;
    w.events.length = 0;
    q.oskelClock(0.05);
    const slams = w.events.filter((e) => e.type === 'slam');
    expect(slams).toHaveLength(1);
    expect(cueFor(slams[0], ctx)).toEqual({ id: 'punchHit', vol: 1.3 });
    // Both crushes push a slam of CRUSH_R, and no other Pressworks slam does (the sim's lines this relies on).
    const src = readFileSync('sim/world.ts', 'utf8');
    expect(src.match(/type: 'slam', x: q\.x, y: q\.y, r: 50 \}/g)).toHaveLength(2);
    expect(CRUSH_R).toBe(50);
    expect(cueFor({ type: 'slam', x: 0, y: 0, r: 60 }, ctx)?.id).not.toBe('punchHit');
  });

  it('the running belt is a quiet room bed', () => {
    expect(ROOM_BEDS).toContain('pressBelt');
    const gs = readFileSync('client/GameScene.ts', 'utf8');
    expect(gs).toContain("w.osStage >= 2 ? 'pressBelt'");
  });
});
