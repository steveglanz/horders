import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { botChoose, botInput, hallsOrder } from '../sim/bot';
import { DOOR_ROOM, HALLS, KILN_SCALE, buildHalls, clampHalls, hallsWay, inside, roomAt, roomPath } from '../sim/halls';
import { DUNGEONS, EncounterId } from '../sim/content/dungeon';

const idle = { x: 0, y: 0 };
/** A spec coordinate at the template's scale. */
const K = (v: number) => v * KILN_SCALE;
const halls = (seed = 2, more: Partial<ConstructorParameters<typeof World>[0]> = {}) => new World({ seed, tier: 2, halls: true, ...more });
const pack = (w: World, role: string) => w.halls!.packs.find((p) => p.role === role)!;
/** Puts the hero at (x, y) as if they walked there. */
const put = (w: World, x: number, y: number) => { w.player.x = w.player.px = x; w.player.y = w.player.py = y; };
/** Steps (picking draft cards as a bot would) until `done` or `max` seconds pass. */
const run = (w: World, done: () => boolean, max: number, input = () => botInput(w)) => {
  const end = w.time + max;
  while (w.state !== 'ended' && w.time < end && !done()) {
    if (w.state === 'draft') w.choose(botChoose(w));
    else w.step(input());
  }
};

describe('Phase 18 Halls H1: the Kiln map', () => {
  it('is off unless asked for: an arena run is unchanged, and the first delve and bounties never get a map', () => {
    const w = new World({ seed: 2, tier: 2 });
    expect(w.halls).toBeNull();
    expect(w.phase).toBe('intro');
    expect(new World({ seed: 2, tier: 1, halls: true, firstDelve: true }).halls).toBeNull();
    expect(new World({ seed: 2, tier: 2, halls: true, bounty: 3 }).halls).toBeNull();
    expect(new World({ seed: 2, tier: 4, halls: true, dungeon: 'foundry' }).halls).toBeNull();
  });

  it('places today\'s route as packs: A, B the openers, C the named slot, E the hard slot guarding the door', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const w = halls(seed);
      const m = w.halls!;
      expect(w.phase).toBe('cleared');
      expect(pack(w, 'A').enc).toBe(w.route[0]);
      expect(pack(w, 'B').enc).toBe(w.route[1]);
      expect(pack(w, 'C').enc).toBe(w.route[2]);
      expect(pack(w, 'E').enc).toBe(w.route[3]);
      expect(pack(w, 'E').guard).toBe(true);
      expect(w.route[4]).toBe('kilnMother');
      // R2 is a gate as rollFork rolls it (a named fight, or a shrine); D a hard or named fight not already on the map.
      const s = pack(w, 'S');
      expect(s.enc === 'shrine' ? s.gate === 'shrine' : s.gate === 'named').toBe(true);
      const d = pack(w, 'D');
      expect([...DUNGEONS.kiln.hard, ...DUNGEONS.kiln.named]).toContain(d.enc);
      expect(d.bags).toBe(2);
      expect(m.mirror).toBe((seed & 1) === 1);
      expect(m.rooms[1].x).toBe(0);
      expect(m.rooms[2].x).toBe(m.mirror ? K(850) : K(-850));
      // Asleep: nothing is in the world's enemy list until a pack wakes.
      expect(w.aliveEnemies).toBe(0);
      expect(m.packs.every((p) => p.state === 'asleep')).toBe(true);
    }
  });

  it('builds the same map from the same seed', () => {
    const a = halls(7).halls!, b = halls(7).halls!;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('keeps heroes and foes inside the rooms and corridors', () => {
    const m = buildHalls(2, ['pack', 'wardens', 'brute', 'acolytes', 'kilnMother'] as EncounterId[], 'kiln', () => 0, () => false);
    // Between R1 and R3 off the corridor: pulled back in.
    const o = { x: K(300), y: K(-1350) };
    expect(inside(m, o.x, o.y, 14)).toBe(false);
    clampHalls(m, o, 14);
    expect(inside(m, o.x, o.y, 13.9)).toBe(true);
    // Inside already: untouched.
    const q = { x: 10, y: K(-900) };
    clampHalls(m, q, 14);
    expect(q).toEqual({ x: 10, y: K(-900) });
    // The hero can't walk out of R0 at all.
    const w = halls(2);
    run(w, () => false, 4, () => ({ x: 1, y: 0.2 }));
    expect(roomAt(w.halls!, w.player.x, w.player.y)).toBe(0);
  });

  it('walks round walls room to room (foes and bots share the way)', () => {
    const m = buildHalls(2, ['pack', 'wardens', 'brute', 'acolytes', 'kilnMother'] as EncounterId[], 'kiln', () => 0, () => false);
    expect(roomPath(m, 2, 5)).toEqual([2, 1, 3, 5]);
    // From R2 to R5 the first step is the mouth of the corridor back to R1, not a line through the wall.
    const wp = hallsWay(m, m.rooms[2].x, m.rooms[2].y, m.rooms[5].x, m.rooms[5].y);
    expect(Math.hypot(wp.x - m.rooms[1].x, wp.y - m.rooms[1].y)).toBeLessThan(Math.hypot(m.rooms[2].x - m.rooms[1].x, m.rooms[2].y - m.rooms[1].y));
    // In the same room, straight at it.
    expect(hallsWay(m, 0, K(-900), 100, K(-1000))).toEqual({ x: 100, y: K(-1000) });
    // A walker in the R1-R2 corridor heading for R3 goes back to R1 (the stuck-bot case, seed 4).
    const mid = { x: (m.rooms[1].x + m.rooms[2].x) / 2, y: (m.rooms[1].y + m.rooms[2].y) / 2 };
    expect(hallsWay(m, mid.x, mid.y, m.rooms[3].x, m.rooms[3].y)).toEqual({ x: m.rooms[1].x, y: m.rooms[1].y });
  });

  it('wakes a pack when a hero steps into its ring, spawning its foes where they stood', () => {
    const w = halls(2);
    const a = pack(w, 'A');
    put(w, a.x, a.y + HALLS.reach + 30);
    w.step(idle);
    expect(a.state).toBe('asleep');
    put(w, a.x, a.y + HALLS.reach - 10);
    w.step(idle);
    expect(a.state).toBe('awake');
    expect(w.phase).toBe('fight');
    expect(w.encounter).toBe(0);
    const foes = w.enemies.filter((e) => e.alive);
    expect(foes.length).toBe(a.foes.length);
    for (const e of foes) expect(e.pack).toBe(w.halls!.packs.indexOf(a));
    // Nothing else woke.
    expect(w.halls!.packs.filter((p) => p.state !== 'asleep')).toEqual([a]);
  });

  it('clearing a pack is a clear as today: a level and a draft once nothing is awake', () => {
    const w = halls(2);
    const a = pack(w, 'A');
    put(w, a.x, a.y + 150);
    run(w, () => a.state === 'cleared', 120);
    expect(a.state).toBe('cleared');
    expect(w.player.level).toBeGreaterThanOrEqual(2);
    expect(w.hallsMain).toBe(1);
    // The fight is over: back to walking, and the draft opens.
    run(w, () => w.state === 'draft', 2, () => idle);
    expect(w.phase).toBe('cleared');
    expect(w.state).toBe('draft');
  });

  it('keeps the boss door shut until the door guard falls, then moves the party into today\'s Kiln arena', () => {
    const w = halls(2);
    const m = w.halls!;
    // E stands in the doorway: its ring spans the corridor where it leaves R5, so the way to the door goes through it.
    const e = pack(w, 'E');
    const north = m.rooms[5].y - m.rooms[5].r;
    for (const x of [-HALLS.corridor / 2, 0, HALLS.corridor / 2]) expect(Math.hypot(x - e.x, north - e.y)).toBeLessThan(HALLS.reach);
    put(w, m.door.x, m.door.y);
    w.step(idle);
    // At the door with the guard still asleep: nothing happens.
    expect(m.done).toBe(false);
    put(w, e.x, e.y - 150);
    w.step(idle);
    expect(e.state).toBe('awake');
    put(w, m.door.x, m.door.y);
    w.step(idle);
    expect(m.done).toBe(false);
    for (const e of w.enemies) if (e.alive) { e.hp = 0; e.alive = false; w.aliveEnemies--; }
    w.step(idle);
    expect(pack(w, 'E').state).toBe('cleared');
    run(w, () => m.done, 3, () => idle);
    expect(m.done).toBe(true);
    expect(w.hallsOn).toBe(false);
    expect(w.encounter).toBe(w.route.length - 1);
    expect(Math.hypot(w.player.x, w.player.y)).toBeLessThan(400);
    run(w, () => w.bossSpawned, HALLS.fade + 1, () => idle);
    expect(w.bossSpawned).toBe(true);
    expect(w.enemies[w.bossIndex].kind).toBe('kilnMother');
  });

  it('bots walk the main path, skip the side rooms by default, and reach the boss', () => {
    const w = halls(2);
    run(w, () => w.bossSpawned, 600);
    expect(w.bossSpawned).toBe(true);
    for (const r of ['A', 'B', 'C', 'E']) expect(pack(w, r).state).toBe('cleared');
    expect(w.halls!.seen[DOOR_ROOM]).toBe(true);
  });

  it('HALLS_SIDE and HALLS_SKIP change the bots\' order', () => {
    expect(hallsOrder(false, false)).toEqual(['A', 'B', 'C', 'E']);
    expect(hallsOrder(true, false)).toEqual(['A', 'S', 'B', 'C', 'D', 'E']);
    expect(hallsOrder(false, true)).toEqual(['A', 'B', 'E']);
  });

  it('a careful hero can walk past C on the path without waking it', () => {
    for (const seed of [2, 3]) {
      const w = halls(seed);
      const m = w.halls!;
      const c = pack(w, 'C');
      // The main path through R3 runs along its centre line (x = 0); C stands far enough off it.
      expect(Math.abs(c.x) - HALLS.reach).toBeGreaterThan(40);
      expect(Math.hypot(pack(w, 'B').x - c.x, pack(w, 'B').y - c.y)).toBeGreaterThan(HALLS.pull + HALLS.spread * 1.25);
      expect(roomAt(m, c.x, c.y)).toBe(3);
    }
  });
  it('a room\'s lava is harmless crust until its pack wakes, heats over HALLS.lavaHeat s, and cools once cleared', () => {
    // Find a seed whose map rolled a lava channel.
    let w: World | null = null;
    for (let seed = 1; seed <= 200 && !w; seed++) { const v = halls(seed); if (v.lava.length) w = v; }
    expect(w).not.toBeNull();
    const m = w!.halls!;
    const c = w!.lava[0];
    expect(c.heat).toBe(0);
    const pk = m.packs.find((p) => roomAt(m, p.x, p.y) === c.room)!;
    // Standing on the crust with the pack asleep: no burn.
    const mx = (c.x1 + c.x2) / 2, my = (c.y1 + c.y2) / 2;
    const far = Math.hypot(mx - pk.x, my - pk.y) > HALLS.reach;
    put(w!, mx, my);
    const hp = w!.player.hp;
    for (let k = 0; k < 30; k++) { w!.step(idle); w!.player.x = mx; w!.player.y = my; }
    if (far) {
      expect(pk.state).toBe('asleep');
      expect(w!.player.hp).toBe(hp);
      expect(c.heat).toBe(0);
    }
    // Wake it: heats to 1 over lavaHeat, then burns.
    put(w!, pk.x, pk.y + HALLS.reach - 10);
    w!.step(idle);
    expect(pk.state).toBe('awake');
    w!.step(idle);
    expect(c.heat!).toBeGreaterThan(0);
    expect(c.heat!).toBeLessThan(1);
    for (let k = 0; k < 40; k++) w!.step(idle);
    expect(c.heat).toBe(1);
    expect(w!.inLava({ ...w!.player, x: mx, y: my })).toBe(true);
    // Cleared: cools back to crust.
    for (const e of w!.enemies) if (e.alive) { e.hp = 0; e.alive = false; w!.aliveEnemies--; }
    put(w!, m.rooms[0].x, m.rooms[0].y);
    for (let k = 0; k < 60; k++) { if (w!.state === 'draft') w!.choose(botChoose(w!)); else w!.step(idle); }
    expect(pk.state).toBe('cleared');
    expect(c.heat).toBe(0);
    expect(w!.inLava({ ...w!.player, x: mx, y: my })).toBe(false);
  });
});
