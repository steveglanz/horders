import { describe, expect, it } from 'vitest';
import { World, OSKEL, OSKEL_VARIANTS, DIECUT } from '../sim/world';
import { BOUNTY_DUNGEON_IDS, DUNGEONS, SOLO_DUNGEON_IDS, WEEKLY_DUNGEON_IDS, partyBlocker } from '../sim/content/dungeon';
import { botFillBlocker } from '../sim/content/botfill';
import { botInput, downstrokeTaker } from '../sim/bot';

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
  rivetT: number;
  downT: number;
  stampT: number;
  rollOskelVariant(): string;
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
  it('is a group dungeon from tier 10, never a bounty or weekly dungeon, and bots never fill it', () => {
    expect(DUNGEONS.pressworks.style).toBe('group');
    expect(DUNGEONS.pressworks.unlockTier).toBe(10);
    expect(DUNGEONS.pressworks.boss).toBe('oskel');
    expect(partyBlocker('pressworks', 1)).toMatch(/party of 2/);
    expect(SOLO_DUNGEON_IDS).not.toContain('pressworks');
    expect(BOUNTY_DUNGEON_IDS).not.toContain('pressworks');
    expect(WEEKLY_DUNGEON_IDS).not.toContain('pressworks');
    expect(botFillBlocker('pressworks')).toMatch(/real heroes/);
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

describe('Phase 12 W2: the Pressworks and Oskel\'s Die Cut', () => {
  it('draws from 6 openers and 3 named fights, with no Ashbuck fights', () => {
    const d = DUNGEONS.pressworks;
    expect(d.openers).toHaveLength(6);
    expect(d.named).toHaveLength(3);
    for (const id of [...d.openers, ...d.named]) expect(id).not.toMatch(/ashbuck|Charge/i);
  });

  it('rolls from the seed alone, and both versions show up', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const a = new World({ seed, dungeon: 'pressworks', tier: 10, omens: [], cls: 'bulwark' }) as unknown as Inner;
      const b = new World({ seed, dungeon: 'pressworks', tier: 10, omens: [], cls: 'bulwark' }) as unknown as Inner;
      expect(a.rollOskelVariant()).toBe(b.rollOskelVariant());
      seen.add(a.rollOskelVariant());
    }
    expect([...seen].sort()).toEqual([...OSKEL_VARIANTS].sort());
  });

  it('Die Cut takes the Rivets\' place: half the floor through Oskel, away from an open plate, and it hurts', () => {
    const { w, inner, b } = pair();
    w.bossVariant = 'cut';
    inner.downT = 99; inner.stampT = 99; inner.rivetT = 0;
    const e = w.enemies[b];
    // An open plate to Oskel's right: the cut goes left.
    inner.addTelegraph('circle', e.x + 200, e.y, OSKEL.downRadius, 0, 0, 4, OSKEL.downMiss, 'soak', -3);
    place(w, inner, 0, e.x - 150, e.y); // in the cut
    place(w, inner, 1, e.x + 150, e.y); // on the plate's side
    inner.oskelClock(1 / 30);
    const cuts = w.telegraphs.filter((t) => t.alive && t.shape === 'cone' && t.arc === Math.PI);
    expect(cuts).toHaveLength(1);
    expect(Math.cos(cuts[0].angle)).toBeCloseTo(-1, 5);
    // No rivet rings when the cut is up.
    expect(w.telegraphs.filter((t) => t.alive && t.shape === 'circle' && t.kind === 'hit')).toHaveLength(0);
    expect(w.events.some((ev) => ev.type === 'castStart' && ev.id === 'dieCut')).toBe(true);
    cuts[0].t = cuts[0].dur - 0.001;
    const hp0 = w.hero(0).player.hp, hp1 = w.hero(1).player.hp;
    inner.updatePartyTelegraphs(0.02);
    expect(w.hero(0).player.hp).toBeLessThan(hp0);
    expect(w.hero(1).player.hp).toBe(hp1);
    expect(DIECUT.fuse).toBeGreaterThan(OSKEL.rivetFuse);
  });

  it('a bot inside the cut walks back across its edge', () => {
    const { w, inner, b } = pair();
    const e = w.enemies[b];
    inner.addTelegraph('cone', e.x, e.y, 1120, 0, Math.PI, DIECUT.fuse, DIECUT.damage, 'hit', -1);
    place(w, inner, 0, e.x + 120, e.y + 200);
    const ins = botInput(w);
    expect(ins.x).toBeLessThan(0);
  });
});
