import { describe, expect, it } from 'vitest';
import { World, YSMERETV2 } from '../sim/world';
import { cueFor, flameCues, FLAME_ALONE_LEAD, PRIORITY, type CueContext } from '../client/audio/cues';
import { recipeLength } from '../client/audio/synth';
import { SOUNDS } from '../client/audio/sounds';

// YSMERETV2's sounds (design 25 Nov, ysmeret-v2.md): her split, a lone flame's warning and its flare.
type Q = { startEncounter(): void; encounter: number; route: string[]; bossIndex: number; ysmeretClock(dt: number): void };
function fight(): { w: World; q: Q } {
  const w = new World({ seed: 4, dungeon: 'ashvents', tier: 7, omens: [], cls: 'bulwark', party: [{ cls: 'lumen', name: 'b' }] });
  const q = w as unknown as Q;
  for (const e of w.enemies) e.alive = false;
  q.route[1] = 'ysmeret';
  q.encounter = 1;
  q.startEncounter();
  const b = w.enemies[q.bossIndex];
  b.x = b.px = 0; b.y = b.py = 0;
  w.heroData(0).player.x = 0; w.heroData(0).player.y = 120;
  w.heroData(1).player.x = 0; w.heroData(1).player.y = 300;
  return { w, q };
}
const ctx: CueContext = { cls: 'bulwark', acting: 0, boss: 'ysmeret', dungeon: 'ashvents' };
/** What GameScene sends: one entry per flame slot. */
const flamesOf = (w: World) => ([[w.ysF0, w.ysAway0], [w.ysF1, w.ysAway1]] as const).map(([j, away]) => ({ x: w.enemies[j].x, y: w.enemies[j].y, away }));

describe('YSMERETV2 sound', () => {
  it('the split plays her own phase sting', () => {
    const { w, q } = fight();
    const b = w.enemies[q.bossIndex];
    b.hp = b.maxHp * YSMERETV2.split;
    w.events.length = 0;
    q.ysmeretClock(0.05);
    expect(w.ysStage).toBe(2);
    expect(w.events.filter((e) => e.type === 'phase').map((e) => cueFor(e, ctx)?.id)).toEqual(['phaseYsmeret']);
  });

  it('a flame left alone: one must-hear warning, ending as it flares, and the flare its own whump', () => {
    const { w, q } = fight();
    const b = w.enemies[q.bossIndex];
    b.hp = b.maxHp * YSMERETV2.split;
    q.ysmeretClock(0.05);
    const st = { away: [] as number[] };
    const warnAt: number[] = [], flareAt: number[] = [];
    for (let t = 0; t < 2 * YSMERETV2.flareAfter + 0.3; t += 0.05) {
      // Both heroes stand on flame 0; flame 1 is alone.
      for (const k of [0, 1]) { const p = w.heroData(k).player; p.x = w.enemies[w.ysF0].x; p.y = w.enemies[w.ysF0].y + 60; p.hp = p.maxHp; }
      w.events.length = 0;
      q.ysmeretClock(0.05);
      for (const c of flameCues(st, flamesOf(w))) { expect(c.id).toBe('flameAlone'); warnAt.push(t); }
      for (const e of w.events) if (e.type === 'ysFlare') { expect(cueFor(e, ctx)).toEqual({ id: 'ysFlare' }); flareAt.push(t); }
    }
    // Two flares (the count starts again after each), each with one warning that ends as it goes off.
    expect(flareAt).toHaveLength(2);
    expect(warnAt).toHaveLength(2);
    for (let k = 0; k < 2; k++) expect(warnAt[k] + FLAME_ALONE_LEAD).toBeCloseTo(flareAt[k], 1);
    expect(recipeLength(SOUNDS.flameAlone)).toBeCloseTo(FLAME_ALONE_LEAD, 1);
    expect(PRIORITY.has('flameAlone')).toBe(true);
  });

  it('a covered flame never warns; Bellow Slam keeps its own wind-up', () => {
    const st = { away: [] as number[] };
    expect(flameCues(st, [{ x: 0, y: 0, away: 0 }, { x: 420, y: 0, away: 0.5 }])).toEqual([]);
    expect(flameCues(st, undefined)).toEqual([]);
    expect(cueFor({ type: 'castStart', x: 0, y: 0, id: 'bellowSlam', name: 'Bellow Slam' } as never, ctx)?.id).toBe('bellowWarn');
  });
});
