import { describe, expect, it } from 'vitest';
import { World, YSMERET } from '../sim/world';
import { DUNGEONS, SOLO_DUNGEON_IDS, partyBlocker } from '../sim/content/dungeon';
import { soakFor } from '../sim/bot';

type Inner = {
  use(i: number): void;
  spawn(kind: string, x: number, y: number): number;
  startCast(i: number, id: string, name: string, dur: number, interruptible: boolean): void;
  finishCast(i: number): void;
  addTelegraph(shape: string, x: number, y: number, r: number, a: number, arc: number, dur: number, dmg: number, kind: string, owner: number): void;
  ysmeretClock(dt: number): void;
  bellowTarget: number;
  bossIndex: number;
};

/** A Bulwark + Lumen pair in the Ashvents, with Ysmeret spawned beside them and no other foes. */
function pair(): { w: World; inner: Inner; b: number } {
  const w = new World({ seed: 5, dungeon: 'ashvents', omens: [], cls: 'bulwark', party: [{ cls: 'lumen' }] });
  const inner = w as unknown as Inner;
  for (const e of w.enemies) e.alive = false;
  const b = inner.spawn('ysmeret', 0, -200);
  inner.bossIndex = b;
  return { w, inner, b };
}

const place = (w: World, inner: Inner, k: number, x: number, y: number) => {
  inner.use(k);
  w.player.x = x;
  w.player.y = y;
  w.player.hp = w.player.maxHp;
  inner.use(0);
};

describe('the Ashvents (G3)', () => {
  it('is a group dungeon from tier 7, and never the daily bounty', () => {
    expect(DUNGEONS.ashvents.style).toBe('group');
    expect(DUNGEONS.ashvents.unlockTier).toBe(7);
    expect(partyBlocker('ashvents', 1)).toMatch(/party of 2/);
    expect(SOLO_DUNGEON_IDS).not.toContain('ashvents');
  });

  it('Scatter Embers: stacked heroes burn each other, spread heroes only singe themselves', () => {
    for (const [gap, share] of [[20, YSMERET.scatterSelf + YSMERET.scatterOther], [300, YSMERET.scatterSelf]] as const) {
      const { w, inner, b } = pair();
      place(w, inner, 0, 0, 0);
      place(w, inner, 1, gap, 0);
      inner.startCast(b, 'scatter', 'Scatter Embers', YSMERET.scatterCast, false);
      inner.finishCast(b);
      // The Bulwark's armour softens its own share, so check the Lumen exactly and the Bulwark loosely.
      const l = w.hero(1).player;
      expect(l.maxHp - l.hp).toBeCloseTo(l.maxHp * share, 5);
      const t = w.hero(0).player;
      expect(t.hp).toBeLessThan(t.maxHp);
    }
  });

  it('Bellow Slam lands on the hero it picked at wind-up, through a shield', () => {
    const { w, inner, b } = pair();
    inner.use(1);
    w.player.shieldT = 1;
    const hp = w.player.hp;
    inner.use(0);
    inner.bellowTarget = 1;
    inner.startCast(b, 'bellowSlam', 'Bellow Slam', YSMERET.bellowCast, false);
    inner.finishCast(b);
    expect(w.hero(1).player.hp).toBeLessThan(hp);
    expect(w.hero(0).player.hp).toBe(w.hero(0).player.maxHp);
  });

  it('Twin Vents open two gold circles on opposite sides of Ysmeret', () => {
    const { w, inner } = pair();
    inner.ysmeretClock(YSMERET.firstVents + 0.01);
    const vents = w.telegraphs.filter((t) => t.alive && t.kind === 'soak');
    expect(vents).toHaveLength(2);
    const e = w.enemies[inner.bossIndex];
    const [a, c] = vents;
    // Ysmeret sits between them.
    expect(Math.abs((a.x + c.x) / 2 - e.x)).toBeLessThan(40);
    expect(Math.abs((a.y + c.y) / 2 - e.y)).toBeLessThan(40);
    expect(Math.hypot(a.x - c.x, a.y - c.y)).toBeGreaterThan(YSMERET.ventDist);
  });

  it('bots split across two vents instead of all running to the nearest', () => {
    const { w, inner } = pair();
    place(w, inner, 0, -50, 0);
    place(w, inner, 1, -40, 0); // both nearer the left vent
    inner.addTelegraph('circle', -150, 0, 55, 0, 0, 4, 70, 'soak', -2);
    inner.addTelegraph('circle', 150, 0, 55, 0, 0, 4, 70, 'soak', -2);
    const mine = soakFor(w);
    inner.use(1);
    const theirs = soakFor(w);
    inner.use(0);
    expect(mine).not.toBeNull();
    expect(theirs).not.toBeNull();
    expect(mine).not.toBe(theirs);
  });
});
