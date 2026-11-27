import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { DOOR_ROOM, genHalls, genFaults, genRoll, mainRooms, roomAt } from '../sim/halls';
import { DUNGEONS } from '../sim/content/dungeon';
import { RELICS, RELIC, RELIC_IDS } from '../sim/content/relics';
import { applyRun, heroXpToNext, newHero } from '../sim/hero';

const kiln = (seed = 2, more: Partial<ConstructorParameters<typeof World>[0]> = {}) => new World({ seed, tier: 2, halls: true, ...more });
const pack = (w: World, role: string) => w.halls!.packs.find((p) => p.role === role)!;
const put = (w: World, x: number, y: number) => { w.player.x = w.player.px = x; w.player.y = w.player.py = y; };
const run = (w: World, done: () => boolean, max: number) => {
  const end = w.time + max;
  while (w.state !== 'ended' && w.time < end && !done()) {
    if (w.state === 'draft') w.choose(botChoose(w));
    else w.step(botInput(w));
  }
};

describe('1.0 CP2: the 5-room Kiln run with one fork (checkpoint-2-grey-box.md)', () => {
  it('every seed rolls a map that passes the checker: R0, A, B, the fork (hard C, easy F), the door guard E, the door', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const g = genHalls(seed, 'kiln');
      expect(g.tries, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      expect(genFaults(g), `seed ${seed}`).toEqual([]);
      expect(g.rooms.map((r) => r.id)).toEqual(['R0', 'R1', 'R3', 'R6', 'R4', 'R5', 'door']);
      expect(g.spots.map((s) => s.role)).toEqual(['A', 'B', 'C', 'F', 'E']);
      expect(g.spots.filter((s) => s.fork).map((s) => s.fork)).toEqual(['hard', 'easy']);
    }
    // Most first rolls pass too (the generator rerolls the rest from the seed).
    let ok = 0;
    for (let seed = 1; seed <= 100; seed++) if (!genFaults(genRoll(seed, 0, 'kiln')).length) ok++;
    expect(ok).toBeGreaterThan(10);
  });

  it('the packs: A and B trash from the route, C the named foe, F a trash opener not on the route, E the door guard; no side rooms', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const w = kiln(seed);
      expect(w.halls!.packs.map((p) => p.role)).toEqual(['A', 'B', 'C', 'F', 'E']);
      expect(pack(w, 'A').enc).toBe(w.route[0]);
      expect(pack(w, 'B').enc).toBe(w.route[1]);
      expect(pack(w, 'C').enc).toBe(w.route[2]);
      expect(pack(w, 'E').enc).toBe(w.route[3]);
      expect(pack(w, 'E').guard).toBe(true);
      expect(DUNGEONS.kiln.openers).toContain(pack(w, 'F').enc);
      expect(w.route).not.toContain(pack(w, 'F').enc);
      expect(pack(w, 'A').trash && pack(w, 'B').trash && pack(w, 'F').trash).toBe(true);
      expect(pack(w, 'C').trash).toBeFalsy();
      expect(w.halls!.packs.every((p) => p.main && p.roomWake)).toBe(true);
    }
  });

  it('a pack wakes as soon as a hero steps into its room, so no pull can be walked round', () => {
    const w = kiln(3);
    const m = w.halls!;
    const a = pack(w, 'A');
    const rm = m.rooms[a.room];
    // Just inside the room, well outside the old 200 reach.
    put(w, rm.x, rm.y + rm.r - 30);
    expect(roomAt(m, w.player.x, w.player.y)).toBe(a.room);
    w.step({ x: 0, y: 0 });
    expect(a.state).toBe('awake');
  });

  it('taking one door of the fork sends the other pack away; the hard door pays a rare roll, the easy door an extra Spark', () => {
    const picks: Record<string, number> = {};
    for (const fork of ['hard', 'easy'] as const) {
      const w = kiln(4, { invulnerable: true });
      const m = w.halls!;
      const mine = m.packs.find((p) => p.fork === fork)!;
      const other = m.packs.find((p) => p.fork && p.fork !== fork)!;
      for (const r of ['A', 'B']) { pack(w, r).state = 'cleared'; }
      const rm = m.rooms[mine.room];
      const p0 = w.player.pendingLevels;
      put(w, rm.x, rm.y);
      w.step({ x: 0, y: 0 });
      expect(mine.state).toBe('awake');
      expect(other.state).toBe('cleared');
      expect(other.skipped).toBe(true);
      expect(mainRooms(m)).toContain(mine.room);
      let drops = 0, chests = 0;
      let pending = -1;
      const levelBefore = w.player.level;
      // Clear it at once: every foe of the pack falls.
      for (const e of w.enemies) if (e.alive && e.pack === m.packs.indexOf(mine)) e.hp = 1;
      for (let n = 0; n < 1200 && mine.state !== 'cleared'; n++) {
        for (const e of w.enemies) if (e.alive) e.hp = Math.min(e.hp, 1);
        w.step({ x: 0, y: 0 });
        drops += w.events.filter((e) => e.type === 'drop' || e.type === 'loot').length;
        chests += w.events.filter((e) => e.type === 'chest').length;
        pending = w.player.pendingLevels;
      }
      expect(mine.state).toBe('cleared');
      expect(w.player.level).toBeGreaterThan(levelBefore);
      // (A Cinder Brute's elite chest is a free pick of its own.)
      picks[fork] = pending - p0 - (w.player.level - levelBefore) - chests;
      picks[fork + 'Drops'] = drops;
    }
    // Each level is a pick; the easy door adds one more.
    expect(picks.hard).toBe(0);
    expect(picks.easy).toBe(1);
    // The hard door's foes are a named pack (a bag, plus the rare roll); the easy door's are trash (no bag).
    expect(picks.hardDrops).toBeGreaterThanOrEqual(2);
    expect(picks.easyDrops).toBe(0);
  });

  it('bots walk it to the boss down either door, and pick a Relic after the door guard', () => {
    for (const seed of [1, 2]) {
      const w = kiln(seed, { invulnerable: true, cls: 'duskblade' });
      run(w, () => w.bossSpawned, 400);
      expect(w.bossSpawned, `seed ${seed}`).toBe(true);
      expect(w.halls!.seen[DOOR_ROOM]).toBe(true);
      // Odd seeds take the hard door, even ones the easy door.
      const taken = w.halls!.packs.find((p) => p.fork && !p.skipped)!;
      expect(taken.fork).toBe(seed & 1 ? 'hard' : 'easy');
      expect(w.player.relic && RELIC_IDS.includes(w.player.relic)).toBe(true);
    }
  });
});

describe('1.0 CP2: Relics replace potions and in-run quests', () => {
  it('there are 4, each with one line', () => {
    expect(RELIC_IDS).toHaveLength(4);
    for (const id of RELIC_IDS) expect(RELICS[id].text.length).toBeGreaterThan(20);
  });

  it('the door guard\'s clear offers 2 of them, after its Spark; never on the first delve', () => {
    const w = kiln(5, { invulnerable: true });
    run(w, () => w.state === 'draft' && !!w.choices[0]?.relic, 400);
    expect(w.choices).toHaveLength(2);
    expect(pack(w, 'E').state).toBe('cleared');
    expect(w.player.pendingLevels).toBe(0);
    expect(new Set(w.choices.map((c) => c.relic)).size).toBe(2);
    const first = new World({ seed: 5, tier: 1, halls: true, firstDelve: true, invulnerable: true });
    let offered = false;
    const end = first.time + 400;
    while (first.state !== 'ended' && first.time < end && !first.bossSpawned) {
      if (first.state === 'draft') { offered ||= !!first.choices[0]?.relic; first.choose(0); } else first.step(botInput(first));
    }
    expect(first.bossSpawned).toBe(true);
    expect(offered).toBe(false);
    expect(first.player.relic).toBeUndefined();
  });

  it('Spare Wick: lower health, and the first fatal blow leaves a quarter', () => {
    const w = kiln(6);
    const inner = w as unknown as { takePick(o: unknown): void; hurtPlayer(a: number, s?: number, u?: boolean): void };
    const max = w.player.maxHp;
    inner.takePick({ id: 'relic', nextRank: 1, relic: 'spareWick' });
    expect(w.player.maxHp).toBeCloseTo(max * RELIC.wickMaxHp, 6);
    inner.hurtPlayer(w.player.maxHp * 5, -1, true);
    expect(w.player.hp).toBeCloseTo(w.player.maxHp * RELIC.wickHp, 6);
    w.player.shieldT = 0;
    inner.hurtPlayer(w.player.maxHp * 5, -1, true);
    expect(w.player.hp).toBeLessThanOrEqual(0);
  });

  it('Loose Lid: the boss boils over 30 s sooner', () => {
    const w = kiln(6);
    const before = w.boilAfter('kilnMother')!;
    (w as unknown as { takePick(o: unknown): void }).takePick({ id: 'relic', nextRank: 1, relic: 'looseLid' });
    expect(w.boilAfter('kilnMother')).toBe(before - RELIC.lidSooner);
  });

  it('Fire Brick: less from a hit standing still, more on the move', () => {
    // One hit on a fresh hero each time, against the same hit without it.
    const hit = (moving: boolean, brick: boolean) => {
      const w = kiln(6);
      const inner = w as unknown as { takePick(o: unknown): void; hurtPlayer(a: number, s?: number, u?: boolean): void };
      if (brick) inner.takePick({ id: 'relic', nextRank: 1, relic: 'fireBrick' });
      w.player.moving = moving;
      const hp = w.player.hp;
      inner.hurtPlayer(50, -1, true);
      return hp - w.player.hp;
    };
    expect(hit(false, true)).toBeCloseTo(hit(false, false) * RELIC.brickStill, 4);
    expect(hit(true, true)).toBeCloseTo(hit(true, false) * RELIC.brickMoving, 4);
  });

  it('no potion or quest is left in a run', () => {
    const w = kiln(2) as unknown as Record<string, unknown>;
    expect(w.potion).toBeUndefined();
    expect(w.quests).toBeUndefined();
  });
});

describe('QA M5: the first win reaches hero level 2', () => {
  it('a short tutorial win that earns under a level still ends at level 2', () => {
    const h = newHero();
    const r = applyRun(h, 1, { victory: true, time: 100, kills: 30, level: 5, tier: 1 } as never, false);
    expect(h.level).toBe(2);
    expect(r.heroXp).toBeGreaterThanOrEqual(heroXpToNext(1));
    // Only the first: a second short win pays what it earns.
    const lvl = h.xp;
    applyRun(h, 2, { victory: true, time: 10, kills: 0, level: 5, tier: 1 } as never, false);
    expect(h.xp - lvl).toBeLessThan(heroXpToNext(2));
  });
});
