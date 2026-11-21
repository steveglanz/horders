import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { botCast, botInput } from '../sim/bot';

type Inner = {
  use(i: number): void;
  spawn(kind: string, x: number, y: number): number;
  startCast(i: number, id: string, name: string, dur: number, interruptible: boolean): void;
  anvilTarget: number;
  bossIndex: number;
};

/** A Bulwark + Lumen + Duskblade party with Ondrel beside the Bulwark, no other foes. */
function party(): { w: World; inner: Inner; b: number } {
  const w = new World({ seed: 4, dungeon: 'hammerdeep', omens: [], cls: 'bulwark', party: [{ cls: 'lumen' }, { cls: 'duskblade' }] });
  for (const e of w.enemies) e.alive = false;
  const inner = w as unknown as Inner;
  const b = inner.spawn('ondrel', w.player.x + 60, w.player.y);
  inner.bossIndex = b;
  return { w, inner, b };
}

describe('group dungeon bots', () => {
  it('the Bulwark raises Anvil Skin on the Anvilfall wind-up aimed at it, and holds it otherwise', () => {
    const { w, inner, b } = party();
    w.player.heat = 100;
    w.player.hp = w.player.maxHp * 0.4;
    // Low on health with no Anvilfall coming: Anvil Skin stays banked in this fight.
    expect(botCast(w)).not.toBe(2);
    inner.anvilTarget = 2;
    inner.startCast(b, 'anvilfall', 'Anvilfall', 2.5, false);
    expect(w.anvilOnMe).toBe(false);
    expect(botCast(w)).not.toBe(2);
    inner.anvilTarget = 0;
    expect(w.anvilOnMe).toBe(true);
    expect(botCast(w)).toBe(2);
  });

  it('a co-op Lumen moves toward a wounded ally out of reach and heals one in reach', () => {
    const { w, inner } = party();
    inner.use(1);
    const p = w.player;
    const tank = w.hero(0).player;
    tank.hp = tank.maxHp * 0.4;
    p.x = tank.x - 400;
    p.y = tank.y;
    const step = botInput(w);
    expect(step.x).toBeGreaterThan(0);
    p.x = tank.x;
    p.y = tank.y - 100;
    p.heat = 100;
    expect(botCast(w)).toBe(0);
    inner.use(0);
  });
});
