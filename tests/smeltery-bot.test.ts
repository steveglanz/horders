import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { colossusFlank, lumenWard, MELT_TANK_FIRST } from '../sim/bot';
import type { ClassId } from '../sim/content/emberwright';

type Inner = { spawn(kind: string, x: number, y: number): number; use(i: number): void; bossIndex: number; bossPhase: number };

/** colossusFlank for a hero 500 px to the Colossus's side (he faces +x, a Bulwark tanks him). */
function flank(cls: ClassId, phase: number): { dx: number; dy: number } | null {
  const w = new World({ seed: 5, dungeon: 'smeltery', omens: [], cls: 'bulwark', worldBoss: 'The Cinder Colossus', party: [{ cls }] });
  const inner = w as unknown as Inner;
  for (const e of w.enemies) e.alive = false;
  inner.bossIndex = inner.spawn('colossus', 0, 0);
  inner.bossPhase = phase;
  w.colFacing = 0;
  w.heroes[0].player.x = 120; w.heroes[0].player.y = 0;
  w.heroes[1].player.x = 0; w.heroes[1].player.y = 500;
  inner.use(1);
  const f = colossusFlank(w);
  inner.use(0);
  return f;
}

describe('the Smeltery bots in Meltdown', () => {
  it('a ranged damage hero keeps its ring once the plate cracks; blades and the Lumen fight as usual', () => {
    for (const cls of ['emberwright', 'slagbinder'] as ClassId[]) {
      const f = flank(cls, 3);
      expect(f).not.toBeNull();
      expect(f!.dy).toBeLessThan(0);
    }
    for (const cls of ['duskblade', 'lumen'] as ClassId[]) expect(flank(cls, 3)).toBeNull();
    for (const cls of ['emberwright', 'duskblade', 'lumen'] as ClassId[]) expect(flank(cls, 1)).not.toBeNull();
  });
});

describe('the Smeltery Lumen in Meltdown', () => {
  /** Who a Lumen wards with the Bulwark tank at `tank` health and a Duskblade at 30%. */
  function ward(phase: number, tank: number): number {
    const w = new World({ seed: 5, dungeon: 'smeltery', omens: [], cls: 'bulwark', worldBoss: 'The Cinder Colossus', party: [{ cls: 'lumen' }, { cls: 'duskblade' }] });
    const inner = w as unknown as Inner;
    for (const e of w.enemies) e.alive = false;
    inner.bossIndex = inner.spawn('colossus', 0, 0);
    inner.bossPhase = phase;
    w.heroes[0].player.hp = w.heroes[0].player.maxHp * tank;
    w.heroes[2].player.hp = w.heroes[2].player.maxHp * 0.3;
    inner.use(1);
    const k = lumenWard(w);
    inner.use(0);
    return k;
  }

  it('goes to a tank under the bar in Meltdown, and to the lowest hero otherwise', () => {
    expect(ward(3, MELT_TANK_FIRST - 0.1)).toBe(0);
    expect(ward(3, MELT_TANK_FIRST + 0.1)).toBe(2);
    expect(ward(1, MELT_TANK_FIRST - 0.1)).toBe(2);
  });
});
