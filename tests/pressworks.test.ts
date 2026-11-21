import { describe, expect, it } from 'vitest';
import { World, OSKEL } from '../sim/world';
import { BOUNTY_DUNGEON_IDS, DUNGEONS, SOLO_DUNGEON_IDS, WEEKLY_DUNGEON_IDS, partyBlocker } from '../sim/content/dungeon';
import { botFillBlocker } from '../sim/content/botfill';
import { downstrokeTaker } from '../sim/bot';

type Inner = {
  use(i: number): void;
  spawn(kind: string, x: number, y: number): number;
  startCast(i: number, id: string, name: string, dur: number, interruptible: boolean): void;
  finishCast(i: number): void;
  addTelegraph(shape: string, x: number, y: number, r: number, a: number, arc: number, dur: number, dmg: number, kind: string, owner: number): void;
  updatePartyTelegraphs(dt: number): void;
  oskelClock(dt: number): void;
  stampTarget: number;
  bossIndex: number;
};

/** A Bulwark + Lumen pair in the Pressworks, with Oskel spawned away from them and no other foes. */
function pair(): { w: World; inner: Inner; b: number } {
  const w = new World({ seed: 5, dungeon: 'pressworks', omens: [], cls: 'bulwark', party: [{ cls: 'lumen' }] });
  const inner = w as unknown as Inner;
  for (const e of w.enemies) e.alive = false;
  const b = inner.spawn('oskel', 0, -300);
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

/** Drop a Downstroke at (x, y) and let it land. Returns the soak event's ok. */
function downstroke(w: World, inner: Inner, x: number, y: number): boolean {
  inner.addTelegraph('circle', x, y, OSKEL.downRadius, 0, 0, 0.01, OSKEL.downMiss, 'soak', -3);
  inner.updatePartyTelegraphs(0.02);
  const ev = w.events.filter((e) => e.type === 'soak').pop() as { ok: boolean } | undefined;
  w.events.length = 0;
  return !!ev?.ok;
}

describe('the Pressworks (third group dungeon)', () => {
  it('is a group dungeon from tier 10, never a bounty or weekly dungeon, and bots may fill it', () => {
    expect(DUNGEONS.pressworks.style).toBe('group');
    expect(DUNGEONS.pressworks.unlockTier).toBe(10);
    expect(DUNGEONS.pressworks.boss).toBe('oskel');
    expect(partyBlocker('pressworks', 1)).toMatch(/party of 2/);
    expect(SOLO_DUNGEON_IDS).not.toContain('pressworks');
    expect(BOUNTY_DUNGEON_IDS).not.toContain('pressworks');
    expect(WEEKLY_DUNGEON_IDS).not.toContain('pressworks');
    expect(botFillBlocker('pressworks')).toBe('');
  });

  it('Downstroke: whoever takes it is Pressed, and a Pressed hero under the next one is crushed and does not count', () => {
    const { w, inner } = pair();
    place(w, inner, 0, 400, 0);
    place(w, inner, 1, 0, 0);
    expect(downstroke(w, inner, 0, 0)).toBe(true);
    const l = w.hero(1).player;
    expect(l.pressedT).toBe(OSKEL.pressed);
    expect(l.hp).toBe(l.maxHp);
    // The same Lumen takes the next one too: it doesn't count, so it's a miss, and the Lumen is crushed.
    l.hp = l.maxHp;
    const t = w.hero(0).player;
    t.hp = t.maxHp;
    expect(downstroke(w, inner, 0, 0)).toBe(false);
    expect(l.maxHp - l.hp).toBeGreaterThanOrEqual(l.maxHp * OSKEL.crush);
    // A miss hurts everyone, the Bulwark far away too.
    expect(t.hp).toBeLessThan(t.maxHp);
  });

  it('taking turns works: the other hero takes the next one', () => {
    const { w, inner } = pair();
    place(w, inner, 0, 400, 0);
    place(w, inner, 1, 0, 0);
    expect(downstroke(w, inner, 0, 0)).toBe(true);
    place(w, inner, 0, 0, 0);
    place(w, inner, 1, 400, 0);
    expect(downstroke(w, inner, 0, 0)).toBe(true);
    expect(w.hero(0).player.pressedT).toBe(OSKEL.pressed);
  });

  it('Pressed wears off, and lasts longer than the gap between Downstrokes', () => {
    expect(OSKEL.pressed).toBeGreaterThan(OSKEL.downEvery);
    const { w, inner } = pair();
    w.hero(1).player.pressedT = 1;
    inner.oskelClock(1.5);
    expect(w.hero(1).player.pressedT).toBe(0);
  });

  it('Stamp lands on the hero it picked at wind-up', () => {
    const { w, inner, b } = pair();
    place(w, inner, 0, 0, 0);
    place(w, inner, 1, 200, 0);
    inner.stampTarget = 1;
    inner.startCast(b, 'stamp', 'Stamp', OSKEL.stampCast, false);
    inner.finishCast(b);
    expect(w.hero(1).player.hp).toBeLessThan(w.hero(1).player.maxHp);
    expect(w.hero(0).player.hp).toBe(w.hero(0).player.maxHp);
  });

  it('bots: the nearest hero who is not Pressed takes it, and the tank stays on Oskel if anyone else can go', () => {
    const { w, inner } = pair();
    place(w, inner, 0, 0, 0); // the Bulwark, right on it
    place(w, inner, 1, 300, 0);
    inner.addTelegraph('circle', 0, 0, OSKEL.downRadius, 0, 0, 4, OSKEL.downMiss, 'soak', -3);
    const t = w.telegraphs.find((q) => q.alive && q.owner === -3)!;
    expect(downstrokeTaker(w, t)).toBe(1);
    w.hero(1).player.pressedT = 5;
    expect(downstrokeTaker(w, t)).toBe(0);
    w.hero(0).player.pressedT = 5;
    expect(downstrokeTaker(w, t)).toBe(-1);
  });
});
