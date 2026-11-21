import { describe, expect, it } from 'vitest';
import { World, WRACK } from '../sim/world';
import { DUNGEONS, BOUNTY_DUNGEON_IDS, SOLO_DUNGEON_IDS, WEEKLY_DUNGEON_IDS } from '../sim/content/dungeon';
import { weeklyFor } from '../sim/content/weekly';
import { CLASSES } from '../sim/content/classes';

type Inner = {
  spawn(kind: string, x: number, y: number): number;
  startCast(i: number, id: string, name: string, dur: number, interruptible: boolean): void;
  finishCast(i: number): void;
  wrackClock(dt: number): void;
  keepOffRafts(e: unknown): void;
  bossIndex: number;
  tideClockT: number;
  sinkT: number;
  shoalT: number;
};

/** A hero in a Wrackline fight with one raft at (200, 0) and no foes. */
function wrack(): { w: World; inner: Inner } {
  const w = new World({ seed: 7, dungeon: 'wrackline', omens: [], cls: 'bulwark' });
  const inner = w as unknown as Inner;
  for (const e of w.enemies) e.alive = false;
  w.phase = 'fight';
  w.rafts = [{ a: 0, ring: 200, dir: 1, x: 200, y: 0, sunkT: 0 }];
  inner.tideClockT = 999;
  return { w, inner };
}

describe('the Wrackline (fifth solo dungeon)', () => {
  it('is a solo dungeon from tier 13, kept out of the bounty and the weekly quests', () => {
    expect(DUNGEONS.wrackline.style).toBe('solo');
    expect(DUNGEONS.wrackline.unlockTier).toBe(13);
    expect(SOLO_DUNGEON_IDS).toContain('wrackline');
    expect(BOUNTY_DUNGEON_IDS).not.toContain('wrackline');
    expect(WEEKLY_DUNGEON_IDS).toEqual(['kiln', 'foundry', 'glarewell', 'coldmarrow']);
    // Adding a dungeon must not reshuffle any week's quests: the draw only sees the pinned list.
    for (let wk = 2960; wk < 2980; wk++) for (const q of weeklyFor(wk, 20)) if (q.dungeon) expect(WEEKLY_DUNGEON_IDS).toContain(q.dungeon);
  });

  it('the Ebb warns, then drags a hero off a raft toward the drain and burns them; a hero on a raft holds', () => {
    const { w, inner } = wrack();
    inner.tideClockT = 0.01;
    inner.wrackClock(0.02);
    expect(w.ebbWarnT).toBeGreaterThan(0);
    inner.wrackClock(WRACK.tideWarn);
    expect(w.ebbT).toBeGreaterThan(0);
    // Rafts drift, so put the hero on it again before the pull.
    const r = w.rafts[0];
    Object.assign(w.player, { x: r.x, y: r.y });
    const hp = w.player.hp;
    inner.wrackClock(1);
    expect(w.player.hp).toBe(hp);
    // Off the raft: dragged in by the pull and burned.
    Object.assign(w.player, { x: -300, y: 0 });
    inner.wrackClock(1);
    expect(w.player.x).toBeGreaterThan(-300);
    expect(w.player.x).toBeCloseTo(-300 + WRACK.drag * CLASSES[w.cls].speed, 0);
    expect(w.player.hp).toBeLessThan(hp);
  });

  it('a Shoal Lurker cannot climb onto a raft that is afloat, but can once it sinks', () => {
    const { w, inner } = wrack();
    const i = inner.spawn('shoalLurker', 200, 0);
    const e = w.enemies[i];
    inner.keepOffRafts(e);
    expect(Math.hypot(e.x - 200, e.y)).toBeGreaterThanOrEqual(WRACK.raftR);
    w.rafts[0].sunkT = 5;
    e.x = 200; e.y = 0;
    inner.keepOffRafts(e);
    expect(e.x).toBe(200);
    expect(w.onRaft(200, 0)).toBe(false);
  });

  it("a Barge Hauler's Haul yanks its target toward it, and Hessa's Sink sinks a raft", () => {
    const { w, inner } = wrack();
    Object.assign(w.player, { x: 0, y: 0 });
    const h = inner.spawn('bargeHauler', 400, 0);
    w.enemies[h].aux = 0;
    inner.startCast(h, 'haul', 'Haul', WRACK.haulCast, true);
    inner.finishCast(h);
    expect(w.player.x).toBeCloseTo(WRACK.haul, 0);
    const b = inner.spawn('hessa', 0, 0);
    w.enemies[b].aux = 0;
    inner.startCast(b, 'sink', 'Sink', WRACK.sinkCast, true);
    inner.finishCast(b);
    expect(w.rafts[0].sunkT).toBe(WRACK.sinkTime);
    expect(w.onRaft(w.rafts[0].x, w.rafts[0].y)).toBe(false);
  });

  it('a delve starts every fight with three rafts afloat', () => {
    const w = new World({ seed: 3, dungeon: 'wrackline', omens: [], cls: 'emberwright' });
    let n = 0;
    while (w.phase !== 'fight' && n++ < 30 * 20) w.step({ x: 0, y: 0 });
    expect(w.rafts.length).toBe(3);
    expect(w.rafts.every((r) => r.sunkT === 0)).toBe(true);
  });
});
