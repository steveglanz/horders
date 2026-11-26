import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { CLASSES } from '../sim/content/classes';
import type { ClassId } from '../sim/content/emberwright';

type Inner = {
  spawn(kind: string, x: number, y: number): number;
  startCast(i: number, id: string, name: string, dur: number, interruptible: boolean): void;
  quench(): void;
  use(i: number): void;
};

/** A world led by `main` (with `rest` as party), no foes but one casting `kind` 150 px away. */
function caster(main: ClassId, rest: ClassId[], kind: string): { w: World; inner: Inner; i: number } {
  const w = new World({ seed: 4, dungeon: 'hammerdeep', omens: [], cls: main, party: rest.length ? rest.map((cls) => ({ cls })) : undefined });
  for (const e of w.enemies) e.alive = false;
  const inner = w as unknown as Inner;
  const i = inner.spawn(kind, w.player.x + 150, w.player.y);
  inner.startCast(i, 'test', 'Test Cast', 5, true);
  return { w, inner, i };
}

describe('interrupt split (class progression brief)', () => {
  it('only the Bulwark, Duskblade and Emberwright have a true interrupt', () => {
    const kickers = (Object.keys(CLASSES) as ClassId[]).filter((c) => CLASSES[c].kick).sort();
    expect(kickers).toEqual(['bulwark', 'duskblade', 'emberwright']);
  });

  for (const cls of ['lumen', 'slagbinder'] as ClassId[]) {
    it(`${cls}: in a party the stun breaks an elite's cast but a boss shrugs it off`, () => {
      const elite = caster(cls, ['bulwark'], 'cinderBrute');
      expect(elite.w.interruptTarget()).toBe(elite.i);
      elite.inner.quench();
      expect(elite.w.enemies[elite.i].castId).toBe('');

      const boss = caster(cls, ['bulwark'], 'ondrel');
      expect(boss.w.interruptTarget()).toBe(-1);
      boss.inner.quench();
      expect(boss.w.enemies[boss.i].castId).toBe('test');
      // The party's Bulwark can still interrupt it.
      boss.inner.use(1);
      expect(boss.w.interruptTarget()).toBe(boss.i);
      boss.inner.quench();
      expect(boss.w.enemies[boss.i].castId).toBe('');
      boss.inner.use(0);
    });

    it(`${cls}: alone, the stun still breaks a boss's cast (solo bosses stay beatable)`, () => {
      const { w, inner, i } = caster(cls, [], 'ondrel');
      expect(w.interruptTarget()).toBe(i);
      inner.quench();
      expect(w.enemies[i].castId).toBe('');
    });
  }
});
