import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { botChoose, botInput, hallsOrder } from '../sim/bot';
import { C_ROOM, DOOR_ROOM, HALLS, clearWalk, layoutFrame, genRoll, mainRooms, KILN_SCALE, buildHalls, clampGrates, clampHalls, corridorEnds, genHalls, grateCut, hallsCheck, hallsWay, hallsWalkLine, inside, roomAt, roomGap, roomPath } from '../sim/halls';
import { DUNGEONS, EncounterId } from '../sim/content/dungeon';
import { readFileSync } from 'node:fs';

const idle = { x: 0, y: 0 };
/** A spec coordinate at the template's scale. */
const K = (v: number) => v * KILN_SCALE;
const halls = (seed = 2, more: Partial<ConstructorParameters<typeof World>[0]> = {}) => new World({ seed, tier: 2, halls: true, ...more });
/** H1's hand-made map (?hallsmap=a). */
const tmpl = (seed = 2, more: Partial<ConstructorParameters<typeof World>[0]> = {}) => halls(seed, { hallsTemplate: true, ...more });
const clampGratesOf = (m: Parameters<typeof clampGrates>[0], o: { x: number; y: number }) => clampGrates(m, o, 14);
const ROUTE = ['pack', 'wardens', 'brute', 'acolytes', 'kilnMother'] as EncounterId[];
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
    expect(new World({ seed: 2, tier: 10, halls: true, dungeon: 'coldmarrow' }).halls).toBeNull();
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
      expect(m.mirror).toBe(false);
      // Design, 25 Nov: one pack per room; C has its own room (C_ROOM) between B's and the door guard's.
      expect(m.packs.map((p) => p.room)).toEqual([1, 2, 3, C_ROOM, 4, 5]);
      // The template (?hallsmap=a) is H1's map, mirrored on odd seeds.
      const t = tmpl(seed).halls!;
      expect(t.mirror).toBe((seed & 1) === 1);
      expect(t.rooms[1].x).toBe(0);
      expect(t.rooms[2].x).toBe(t.mirror ? K(850) : K(-850));
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
    const m = buildHalls(2, ROUTE, 'kiln', () => 0, () => false, true);
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
    const m = buildHalls(2, ROUTE, 'kiln', () => 0, () => false, true);
    expect(roomPath(m, 2, 5)).toEqual([2, 1, 3, 5]);
    // From R2 to R5 the first step is the mouth of the corridor back to R1, not a line through the wall.
    const wp = hallsWay(m, m.rooms[2].x, m.rooms[2].y, m.rooms[5].x, m.rooms[5].y);
    expect(Math.hypot(wp.x - m.rooms[1].x, wp.y - m.rooms[1].y)).toBeLessThan(Math.hypot(m.rooms[2].x - m.rooms[1].x, m.rooms[2].y - m.rooms[1].y));
    // In the same room, straight at it.
    expect(hallsWay(m, 0, K(-900), 100, K(-1000))).toEqual({ x: 100, y: K(-1000) });
    // A walker in the R1-R2 corridor heading for R3 goes back toward R1 (the stuck-bot case, seed 4).
    const mid = { x: (m.rooms[1].x + m.rooms[2].x) / 2, y: (m.rooms[1].y + m.rooms[2].y) / 2 };
    const back = hallsWay(m, mid.x, mid.y, m.rooms[3].x, m.rooms[3].y);
    expect(Math.hypot(back.x - m.rooms[1].x, back.y - m.rooms[1].y)).toBeLessThan(Math.hypot(mid.x - m.rooms[1].x, mid.y - m.rooms[1].y));
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
    const w = tmpl(2);
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
    expect(hallsCheck(m).filter((f) => f.includes('door guard'))).toEqual([]);
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
    // A Duskblade, invulnerable: this checks the walk, not whether a seed's fights are won (Burnout still lands through
    // invulnerable, and a slow-killing seed can run into it).
    const w = halls(2, { invulnerable: true, cls: 'duskblade' });
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
      // C stands far enough off the walk from the entrance to the boss door.
      const line = hallsWalkLine(m, m.rooms[0].x, m.rooms[0].y, m.door.x, m.door.y);
      let off = Infinity;
      for (let k = 1; k < line.length; k++) {
        const a = line[k - 1], b = line[k], vx = b.x - a.x, vy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((c.x - a.x) * vx + (c.y - a.y) * vy) / (vx * vx + vy * vy || 1)));
        off = Math.min(off, Math.hypot(c.x - a.x - vx * t, c.y - a.y - vy * t));
      }
      expect(off - HALLS.reach).toBeGreaterThan(40);
      expect(Math.hypot(pack(w, 'B').x - c.x, pack(w, 'B').y - c.y)).toBeGreaterThan(HALLS.pull + HALLS.spread * 1.25);
      expect(roomAt(m, c.x, c.y)).toBe(C_ROOM);
    }
  });
  it('a room\'s lava is harmless crust until its pack wakes, heats over HALLS.lockDelay s (with the grates), and cools once cleared', () => {
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
    // Wake it: heats to 1 over lockDelay, then burns.
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
  it('catches its breath on the map: after 3 s with nothing awake, 1% hp a second and faster Heat, never in a fight', () => {
    const w = halls(2);
    const p = w.player;
    p.hp = p.maxHp * 0.5;
    p.heat = 0;
    // Under the delay: only the class's own regen.
    for (let k = 0; k < Math.round((HALLS.rest.delay - 0.5) * 30); k++) w.step(idle);
    expect(w.hallsResting).toBe(false);
    expect(p.hp).toBeCloseTo(p.maxHp * 0.5, 5);
    const heat0 = p.heat;
    // 2 s of rest: +2% hp, and Heat gains rest.res a second on top of its own 2.
    for (let k = 0; k < 15 + 60; k++) w.step(idle);
    expect(w.hallsResting).toBe(true);
    expect(p.hp / p.maxHp).toBeCloseTo(0.52, 2);
    // 2.5 s of the Emberwright's own 2/s, plus rest.res for the 2 s past the delay.
    expect(p.heat - heat0).toBeCloseTo(2 * 2.5 + HALLS.rest.res * 2, 1);
    // A pack wakes: it stops at once.
    const a = pack(w, 'A');
    put(w, a.x, a.y + HALLS.reach - 10);
    w.step(idle);
    expect(w.hallsResting).toBe(false);
    expect(w.hallsQuietT).toBe(0);
    // Not in an arena delve.
    const arena = new World({ seed: 2, tier: 2 });
    expect(arena.hallsResting).toBe(false);
  });
  it('H2b: a room seals 1 s after its pack wakes, keeps heroes and foes in, and opens once the pack is cleared', () => {
    const w = halls(2, { invulnerable: true });
    const m = w.halls!;
    const a = pack(w, 'A');
    const rm = m.rooms[1];
    put(w, a.x, a.y + HALLS.reach - 10);
    w.step(idle);
    w.step(idle);
    expect(a.state).toBe('awake');
    expect(rm.lock).toBeGreaterThanOrEqual(0);
    expect(rm.lock!).toBeLessThan(HALLS.lockDelay);
    // Still open: a hero can step into the corridor south.
    for (let k = 0; k < Math.round(HALLS.lockDelay * 30) + 2; k++) w.step(idle);
    expect(rm.lock!).toBeGreaterThanOrEqual(HALLS.lockDelay);
    // Sealed: walking south for 3 s stops at the rim.
    run(w, () => false, 3, () => ({ x: 0, y: 1 }));
    expect(Math.hypot(w.player.x - rm.x, w.player.y - rm.y)).toBeLessThanOrEqual(rm.r);
    for (const e of w.enemies) if (e.alive) expect(Math.hypot(e.x - rm.x, e.y - rm.y)).toBeLessThanOrEqual(rm.r + 0.01);
    // Cleared: the grates lift.
    for (const e of w.enemies) if (e.alive) { e.hp = 0; e.alive = false; w.aliveEnemies--; }
    run(w, () => rm.lock === -1, 1, () => idle);
    expect(a.state).toBe('cleared');
    expect(rm.lock).toBe(-1);
    expect(rm.lifted).toBeGreaterThanOrEqual(0);
  });

  it('H2b: a hero in the doorway when the grates drop is pushed in; walking away before then leashes the pack', () => {
    // Doorway: wake A, then stand in the R0-R1 corridor mouth just outside R1's rim.
    const w = tmpl(2, { invulnerable: true });
    const m = w.halls!;
    const a = pack(w, 'A');
    const rm = m.rooms[1];
    put(w, a.x, a.y + HALLS.reach - 10);
    w.step(idle);
    put(w, rm.x, rm.y + rm.r + 30);
    for (let k = 0; k < Math.round(HALLS.lockDelay * 30) + 2; k++) w.step(idle);
    expect(Math.hypot(w.player.x - rm.x, w.player.y - rm.y)).toBeLessThanOrEqual(rm.r);
    expect(a.state).toBe('awake');
    // Leash: wake it, then be well down the corridor when the grates drop.
    const v = tmpl(2, { invulnerable: true });
    const b = pack(v, 'A');
    const r1 = v.halls!.rooms[1];
    put(v, b.x, b.y + HALLS.reach - 10);
    v.step(idle);
    put(v, r1.x, r1.y + r1.r + 200);
    for (let k = 0; k < Math.round(HALLS.lockDelay * 30) + 2; k++) v.step(idle);
    expect(b.state).toBe('asleep');
    expect(v.aliveEnemies).toBe(0);
    expect(r1.lock).toBe(-1);
    expect(v.phase).toBe('cleared');
  });

  it('H2b: no dash or leap carries a hero through a sealed room\'s grates, out or in', () => {
    const moves: [string, string][] = [['emberwright', 'blink'], ['lumen', 'glimmerStep'], ['slagbinder', 'interpose'], ['duskblade', 'sidestep']];
    for (const [cls, fn] of moves) {
      for (const out of [true, false]) {
        const w = halls(2, { invulnerable: true, cls: cls as never });
        const m = w.halls!;
        const a = pack(w, 'A');
        const rm = m.rooms[roomAt(m, a.x, a.y)];
        put(w, a.x, a.y + HALLS.reach - 10);
        for (let k = 0; k < Math.round(HALLS.lockDelay * 30) + 3; k++) w.step(idle);
        expect(rm.lock!).toBeGreaterThanOrEqual(HALLS.lockDelay);
        // A doorway of the room: u points out along its corridor, and t = 0 is where the corridor leaves the floor.
        const c = m.corridors.find((q) => m.rooms[q.a] === rm || m.rooms[q.b] === rm)!;
        const inA = m.rooms[c.a] === rm;
        const px = inA ? c.ax! : c.bx!, py = inA ? c.ay! : c.by!, ox = inA ? c.bx! : c.ax!, oy = inA ? c.by! : c.ay!;
        const len = Math.hypot(ox - px, oy - py), ux = (ox - px) / len, uy = (oy - py) / len;
        let t = 0;
        while (roomGap(rm, px + ux * t, py + uy * t) > 0) t += 1;
        // Just inside the doorway, leaping out; or in the corridor just outside it, leaping in.
        const at = out ? t - 20 : t + 60;
        put(w, px + ux * at, py + uy * at);
        w.player.facing = Math.atan2(out ? uy : -uy, out ? ux : -ux);
        (w as unknown as Record<string, (i: { x: number; y: number }) => void>)[fn]({ x: out ? ux : -ux, y: out ? uy : -uy });
        w.step(idle);
        const g = roomGap(rm, w.player.x, w.player.y);
        if (out) expect(g, `${cls} ${fn} out`).toBeGreaterThanOrEqual(0);
        else expect(g, `${cls} ${fn} in`).toBeLessThan(0);
      }
    }
  });

  it('H2a: heroes and foes move 1.25x faster on a Halls run, resting or not (no travel run); arena runs are unchanged', () => {
    const arena = new World({ seed: 2, tier: 2 });
    const w = halls(2);
    expect(arena.moveScale).toBe(1);
    expect(w.moveScale).toBe(HALLS.moveScale);
    expect(w.moveSpeed / arena.moveSpeed).toBeCloseTo(HALLS.moveScale, 5);
    // Catch breath doesn't change speed: one number on the whole run (design, 25 Nov, "keep it simple").
    for (let k = 0; k < Math.round((HALLS.rest.delay + 0.1) * 30); k++) w.step(idle);
    expect(w.hallsResting).toBe(true);
    expect(w.moveSpeed / arena.moveSpeed).toBeCloseTo(HALLS.moveScale, 5);
    expect('travelRun' in HALLS).toBe(false);
    // A woken foe walking at the hero covers 1.25x the ground its def speed gives.
    const a = pack(w, 'A');
    put(w, a.x, a.y + HALLS.reach - 5);
    w.step(idle);
    expect(w.hallsResting).toBe(false);
    expect(w.moveSpeed / arena.moveSpeed).toBeCloseTo(HALLS.moveScale, 5);
    const e = w.enemies.find((q) => q.alive && q.def.speed > 0 && q.kind !== 'ashbuck' && q.kind !== 'emberSpitter')!;
    if (e) {
      const x0 = e.x, y0 = e.y;
      const far = { x: w.player.x, y: w.player.y };
      e.castId = '';
      w.step(idle);
      const moved = Math.hypot(e.x - x0, e.y - y0);
      expect(moved).toBeGreaterThan(e.def.speed * (1 / 30) * 1.1);
      void far;
    }
  });

  it('H2c: every seed from 1 to 2000 rolls a map that passes design\'s checker, from hashes of the seed alone', () => {
    const shapes = new Set<string>();
    for (let seed = 1; seed <= 2000; seed++) {
      const g = genHalls(seed);
      expect(g.tries, `seed ${seed} fell back to the template`).toBeGreaterThanOrEqual(0);
      expect(hallsCheck({ ...g, packs: g.spots }), `seed ${seed}`).toEqual([]);
      for (const r of g.rooms) shapes.add(`${r.id}:${r.shape}`);
    }
    // Every shape turns up where it may: the four fight shapes for A, E and the side rooms, round or twin for B and C.
    for (const id of ['R2', 'R4', 'R5']) for (const sh of ['round', 'hall', 'cross', 'ring']) expect(shapes).toContain(`${id}:${sh}`);
    // A's room is only ever Round or Ring.
    expect([...shapes].filter((k) => k.startsWith('R1:')).sort()).toEqual(['R1:ring', 'R1:round']);
    expect(shapes).toContain('R3:round');
    expect(shapes).toContain('R3:twin');
    expect(shapes).toContain('R0:hall');
    // Seeded: the same seed builds the same map, and the run's rng is drawn exactly as on the template.
    expect(JSON.stringify(genHalls(77))).toBe(JSON.stringify(genHalls(77)));
    expect(JSON.stringify(genHalls(77).rooms)).not.toBe(JSON.stringify(genHalls(78).rooms));
    const calls = (template: boolean) => {
      let n = 0;
      buildHalls(9, ROUTE, 'kiln', () => { n++; return 0; }, () => { n++; return false; }, template);
      return n;
    };
    expect(calls(false)).toBe(calls(true));
  }, 30000);

  it('H2c: every pack\'s foes stand on its room\'s floor, and every layout piece on the floor of its room', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const w = halls(seed);
      const m = w.halls!;
      for (const p of m.packs) {
        expect(roomAt(m, p.x, p.y)).toBe(p.room);
        for (const f of p.foes) expect(roomGap(m.rooms[p.room], f.x, f.y), `seed ${seed} ${p.role}`).toBeGreaterThan(20);
      }
      for (const s of w.stones) expect(roomAt(m, s.x, s.y, s.r)).toBeGreaterThanOrEqual(0);
      for (const v of m.vents) expect(roomAt(m, v.x, v.y)).toBe(v.room);
      for (const l of w.lava) for (const t of [0, 0.5, 1]) expect(roomAt(m, l.x1 + (l.x2 - l.x1) * t, l.y1 + (l.y2 - l.y1) * t, 30)).toBe(l.room);
    }
  });

  it('H2c: walkers go round a ring\'s hearth island, never through it, and stay out of it', () => {
    let rings = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const m = buildHalls(seed, ROUTE, 'kiln', () => 0, () => false);
      m.rooms.forEach((rm, i) => {
        if (rm.shape !== 'ring') return;
        rings++;
        const [hx, hy, hr] = (rm.holes![0] as { c: [number, number, number] }).c;
        // From the south of the ring to the north of it.
        const line = hallsWalkLine(m, hx, hy + rm.r - 60, hx, hy - rm.r + 60);
        for (let k = 1; k < line.length; k++) {
          for (let t = 0; t <= 1; t += 0.05) {
            const x = line[k - 1].x + (line[k].x - line[k - 1].x) * t, y = line[k - 1].y + (line[k].y - line[k - 1].y) * t;
            expect(Math.hypot(x - hx, y - hy), `seed ${seed} room ${i}`).toBeGreaterThan(hr);
          }
        }
        // Standing on the island: pushed off it.
        const o = { x: hx + 10, y: hy };
        clampHalls(m, o, 14);
        expect(Math.hypot(o.x - hx, o.y - hy)).toBeGreaterThanOrEqual(hr + 13);
      });
    }
    expect(rings).toBeGreaterThan(5);
  });

  it('H2c: bots walk generated maps of every shape to the boss', () => {
    const seen = new Set<string>();
    for (const seed of [1, 9, 12]) {
      const w = halls(seed, { invulnerable: true, cls: 'duskblade' });
      for (const r of w.halls!.rooms) seen.add(r.shape ?? 'round');
      run(w, () => w.bossSpawned, 600);
      expect(w.bossSpawned, `seed ${seed}`).toBe(true);
    }
    for (const sh of ['round', 'hall', 'cross', 'ring', 'twin']) expect(seen).toContain(sh);
  });

  it('H2c: a sealed room of any shape keeps heroes in and out at its wall', () => {
    for (const seed of [1, 2, 3, 8]) {
      const m = buildHalls(seed, ROUTE, 'kiln', () => 0, () => false);
      for (const rm of m.rooms) {
        if (!rm.parts && !rm.holes) continue;
        rm.lock = HALLS.lockDelay;
        // Just inside a doorway: kept inside by its own radius.
        const c = m.corridors.find((q) => m.rooms[q.a] === rm || m.rooms[q.b] === rm)!;
        const inA = m.rooms[c.a] === rm;
        const px = inA ? c.ax! : c.bx!, py = inA ? c.ay! : c.by!, ox = inA ? c.bx! : c.ax!, oy = inA ? c.by! : c.ay!;
        const d = Math.hypot(ox - px, oy - py);
        // Walk out along the corridor to 5 past the wall: the grate keeps the walker 14 inside.
        let t = 0;
        while (roomGap(rm, px + ((ox - px) / d) * t, py + ((oy - py) / d) * t) > -5) t += 1;
        const o = { x: px + ((ox - px) / d) * t, y: py + ((oy - py) / d) * t };
        clampHalls(m, o, 14);
        // (clampGrates is what World runs after clampHalls)
        clampGratesOf(m, o);
        expect(Math.abs(roomGap(rm, o.x, o.y))).toBeGreaterThanOrEqual(13);
        rm.lock = -1;
      }
    }
  });

  it('H2d: every room rolls a theme: the shrine in R2 only, the Slag channel at the door guard, layouts matched, never two alike side by side', () => {
    const fits: Record<string, string[]> = { round: ['ash', 'slag', 'cooling'], hall: ['ash', 'bellows'], cross: ['slag', 'ash'], ring: ['cooling', 'ash'], twin: ['bellows', 'ash'] };
    let matched = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const w = halls(seed);
      const m = w.halls!;
      for (const r of m.rooms) expect(['ash', 'bellows', 'slag', 'cooling', 'shrine']).toContain(r.theme);
      for (const c of m.corridors) expect(m.rooms[c.a].theme, `seed ${seed}`).not.toBe(m.rooms[c.b].theme);
      expect(m.rooms[2].theme).toBe('shrine');
      expect(m.rooms.filter((r) => r.theme === 'shrine').length).toBe(1);
      expect(m.rooms[5].theme).toBe('slag');
      for (const l of w.lava) if (l.room !== 5 && m.rooms[l.room!].theme === 'slag') matched++;
      for (const v of m.vents) if (m.rooms[v.room].theme === 'cooling') matched++;
      // Same seed, same themes.
      expect(halls(seed).halls!.rooms.map((r) => r.theme)).toEqual(m.rooms.map((r) => r.theme));
      void fits;
    }
    expect(matched).toBeGreaterThan(0);
  });
});

describe('H3a: the Drowned Foundry on the Halls map', () => {
  const FOUNDRY_THEMES = ['boiler', 'cistern', 'pump', 'anchor', 'shrine'];
  const fits: Record<string, string[]> = { round: ['boiler', 'cistern', 'anchor'], hall: ['boiler', 'pump', 'anchor'], twin: ['cistern', 'pump', 'anchor'], cross: ['anchor'], ring: ['anchor'] };

  it('is on for players since skills closed its crawler split (#706, 25 Nov), with or without ?hallsbeta=1', () => {
    expect(halls(3, { dungeon: 'foundry', tier: 4 }).halls).not.toBeNull();
    expect(halls(3, { dungeon: 'foundry', tier: 4, hallsBeta: true }).halls).not.toBeNull();
    expect(new World({ seed: 3, tier: 4, dungeon: 'foundry' }).halls).toBeNull();
    expect(halls(3, { hallsBeta: true }).halls).not.toBeNull();
    expect(halls(3, { dungeon: 'coldmarrow', tier: 10 }).halls).toBeNull();
  });

  it('gets a map: the Foundry\'s own fights as packs, its themes, and Maelra behind the door', () => {
    const { openers, named, hard, boss } = DUNGEONS.foundry;
    const mine = new Set<string>([...openers, ...named, ...hard, 'shrine']);
    for (let seed = 1; seed <= 120; seed++) {
      const w = halls(seed, { dungeon: 'foundry', tier: 4, hallsBeta: true });
      const m = w.halls!;
      expect(m, `seed ${seed}`).toBeTruthy();
      expect(w.route[4]).toBe(boss);
      for (const p of m.packs) expect(mine.has(p.enc), `seed ${seed} ${p.role} ${p.enc}`).toBe(true);
      expect(hallsCheck(m), `seed ${seed}`).toEqual([]);
      // No lava in a drowned foundry (its layouts are stones and vents).
      expect(w.lava.length).toBe(0);
      const R = m.rooms;
      expect(R[2].theme).toBe('shrine');
      expect(R[5].theme).toBe('boiler');
      R.forEach((r, i) => {
        expect(FOUNDRY_THEMES, `seed ${seed} room ${i}`).toContain(r.theme);
        if (i !== 2) expect(r.theme).not.toBe('shrine');
      });
      for (const c of m.corridors) expect(R[c.a].theme, `seed ${seed} ${c.a}-${c.b}`).not.toBe(R[c.b].theme);
      for (const i of [0, 1, 3, 4, C_ROOM]) {
        const t = R[i].theme!;
        // A fitting theme, or the boiler a vents room takes, or a spare once every fitting one is next door.
        const nextDoor = m.corridors.flatMap((c) => (c.a === i ? [R[c.b].theme] : c.b === i ? [R[c.a].theme] : []));
        const fitFree = fits[R[i].shape ?? 'round'].filter((f) => !nextDoor.includes(f as never));
        expect(fitFree.includes(t) || (t === 'boiler' && m.vents.some((v) => v.room === i)) || fitFree.length === 0, `seed ${seed} room ${i} ${R[i].shape} ${t}`).toBe(true);
      }
    }
  });

  it('the Kiln\'s themes are unchanged by the per-dungeon kits', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const R = halls(seed).halls!.rooms;
      expect(R[5].theme).toBe('slag');
      for (const r of R) expect(['ash', 'bellows', 'slag', 'cooling', 'shrine']).toContain(r.theme);
    }
  });

  it('a Sluice Crawler keeps the arena\'s speed on the map, and its Bloom bursts after 2.5 s as in the arena (design, 25 Nov)', () => {
    const w = halls(9, { dungeon: 'foundry', tier: 4, hallsBeta: true, cls: 'bulwark' });
    const q = w as unknown as { spawn(kind: string, x: number, y: number): number };
    for (const e of w.enemies) e.alive = false;
    const m = w.halls!, a = pack(w, 'A');
    // Walk both a crawler and a hound toward a hero across A's room and compare the ground they cover.
    const ci = q.spawn('sluiceCrawler', a.x, a.y), hi = q.spawn('cinderhound', a.x, a.y + 4);
    const c = w.enemies[ci], h = w.enemies[hi];
    w.player.x = a.x + 300; w.player.y = a.y;
    const c0 = c.x, h0 = h.x;
    for (let k = 0; k < 10; k++) { c.abilityT = 99; w.step(idle); }
    expect(m).toBeTruthy();
    expect((c.x - c0) / (10 / 30)).toBeLessThanOrEqual(c.def.speed * 1.02);
    expect((h.x - h0) / (10 / 30)).toBeGreaterThan(h.def.speed * 1.1);
    const first = (w2: World) => {
      let dur = -1;
      run(w2, () => { const t = w2.telegraphs.find((x) => x.alive && x.kind === 'bloom'); if (t) dur = t.dur; return dur > 0; }, 900);
      return dur;
    };
    expect(first(halls(9, { dungeon: 'foundry', tier: 4, hallsBeta: true, cls: 'bulwark' }))).toBeCloseTo(2.5, 6);
  });

  it('bots walk it and go through the door into Maelra\'s arena (seeds the bot wins on the map)', () => {
    for (const seed of [9, 11]) {
      const w = halls(seed, { dungeon: 'foundry', tier: 4, hallsBeta: true, cls: 'bulwark' });
      run(w, () => !w.hallsOn || w.state === 'ended', 600);
      expect(w.hallsOn, `seed ${seed}`).toBe(false);
      expect(w.route[w.encounter]).toBe('maelra');
    }
  });
});

describe('H3b: the Glarewell on the Halls map', () => {
  const GLARE_THEMES = ['lens', 'orrery', 'colonnade', 'mirror'];
  const glare = (seed: number, more: Partial<ConstructorParameters<typeof World>[0]> = {}) => halls(seed, { dungeon: 'glarewell', tier: 7, hallsBeta: true, ...more });
  /** Wakes pack k first, as a hero walking straight to it would: stands the hero at its middle and steps until it stirs. */
  const wake = (w: World, k: number) => {
    const p = w.halls!.packs[k];
    put(w, p.x, p.y);
    for (let j = 0; j < 30 && p.state === 'asleep'; j++) w.step(idle);
    return p;
  };
  /** The first (seed, pack) whose room is this shape. */
  const find = (shape: string) => {
    for (let seed = 1; seed <= 200; seed++) {
      const m = glare(seed).halls!;
      const k = m.packs.findIndex((p) => p.foes.length && m.rooms[p.room].shape === shape);
      if (k >= 0) return { seed, k };
    }
    throw new Error(shape);
  };

  it('is on for players (design, 25 Nov), and gets its own fights, themes and the Lensmother behind the door', () => {
    expect(halls(3, { dungeon: 'glarewell', tier: 7 }).halls).not.toBeNull();
    const { openers, named, hard, boss } = DUNGEONS.glarewell;
    const mine = new Set<string>([...openers, ...named, ...hard, 'shrine']);
    let cross = 0, ring = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const w = glare(seed);
      const m = w.halls!;
      expect(m, `seed ${seed}`).toBeTruthy();
      expect(w.route[4]).toBe(boss);
      for (const p of m.packs) expect(mine.has(p.enc), `seed ${seed} ${p.role} ${p.enc}`).toBe(true);
      expect(hallsCheck(m), `seed ${seed}`).toEqual([]);
      m.rooms.forEach((r, i) => { if (i !== 2) expect(GLARE_THEMES, `seed ${seed} room ${i}`).toContain(r.theme); });
      cross += m.rooms.filter((r) => r.shape === 'cross').length;
      ring += m.rooms.filter((r) => r.shape === 'ring').length;
    }
    // Cross and Ring are weighted up (design): clearly more of them than in the Kiln's rooms on the same seeds.
    let kiln = 0;
    for (let seed = 1; seed <= 120; seed++) kiln += halls(seed).halls!.rooms.filter((r) => r.shape === 'cross' || r.shape === 'ring').length;
    expect(cross + ring).toBeGreaterThan(kiln * 1.3);
  });

  it('a woken pack\'s room gets the fight\'s pillars round its middle: on its floor, clear of every doorway, the lens at the middle', () => {
    const shapes = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) {
      const n = glare(seed).halls!.packs.length;
      for (let k = 0; k < n; k++) {
        const w = glare(seed);
        const m = w.halls!, p = m.packs[k], rm = m.rooms[p.room], f = layoutFrame(rm);
        if (!p.foes.length) continue;
        wake(w, k);
        expect(p.state, `seed ${seed} pack ${k}`).not.toBe('asleep');
        shapes.add(rm.shape ?? 'round');
        expect(w.lightX).toBeCloseTo(f.x, 6);
        expect(w.lightY).toBeCloseTo(f.y, 6);
        expect(w.pillars.length, `seed ${seed} pack ${k} ${rm.shape}`).toBeGreaterThan(0);
        const doors = m.corridors.flatMap((c) => (c.a === p.room ? [[c.ax!, c.ay!]] : c.b === p.room ? [[c.bx!, c.by!]] : []));
        for (const c of w.pillars) {
          expect(!!c.fixed, `seed ${seed} pack ${k}`).toBe(rm.shape === 'cross');
          if (c.fixed) continue;
          expect(roomGap(rm, c.x, c.y), `seed ${seed} pack ${k}`).toBeGreaterThanOrEqual(c.r + 20);
          for (const [dx, dy] of doors) expect(Math.hypot(dx - c.x, dy - c.y)).toBeGreaterThan(HALLS.corridor / 2 + c.r + 40);
        }
      }
    }
    expect([...shapes].sort()).toEqual(['cross', 'hall', 'ring', 'round', 'twin']);
  });

  it('a Cross room\'s own stone pillars are its cover and a Brand can\'t crack them', () => {
    const { seed, k } = find('cross');
    const w = glare(seed);
    wake(w, k);
    expect(w.pillars.length).toBe(4);
    expect(w.pillars.every((c) => c.fixed)).toBe(true);
    const q = w as unknown as { burstBrandAt(x: number, y: number, party: boolean): void };
    expect(typeof q.burstBrandAt).toBe('function');
    for (const c of w.pillars) q.burstBrandAt(c.x, c.y, false);
    expect(w.pillars.some((c) => c.cracked)).toBe(false);
  });

  it('walls block the Glare: a spot in the next room is in shadow; the same reach on open floor is not', () => {
    const w = glare(4);
    const m = w.halls!, p = wake(w, 0), rm = m.rooms[p.room], f = layoutFrame(rm);
    const other = m.rooms.findIndex((r, i) => i !== p.room && !clearWalk(m, f.x, f.y, r.x, r.y));
    expect(other).toBeGreaterThanOrEqual(0);
    expect(w.shadowed(m.rooms[other].x, m.rooms[other].y)).toBe(true);
    // Somewhere on this room's own floor with nothing in between is lit.
    let lit = false;
    for (let a = 0; a < Math.PI * 2 && !lit; a += 0.2) {
      const x = f.x + Math.cos(a) * 60, y = f.y + Math.sin(a) * 60;
      if (roomGap(rm, x, y) > 0 && !w.shadowed(x, y)) lit = true;
    }
    expect(lit).toBe(true);
  });

  it('a Brand bursts on the map as in the arena (its clock runs in a Halls fight)', () => {
    const w = glare(4);
    wake(w, 0);
    expect(w.phase).toBe('fight');
    w.markT = 0.05;
    let burst = false;
    for (let j = 0; j < 10 && !burst; j++) { w.step(idle); burst = w.events.some((e) => e.type === 'brandBurst'); }
    expect(burst).toBe(true);
  });

  it('an arena Glarewell run is unchanged: the pillars stand on the ring round the middle lens', () => {
    const w = new World({ seed: 4, tier: 7, dungeon: 'glarewell' });
    run(w, () => w.pillars.length > 0, 120);
    expect(w.lightX).toBe(0);
    expect(w.pillars.map((c) => Math.round(Math.hypot(c.x, c.y)))).toEqual([200, 200, 200, 200]);
    expect(w.pillars.some((c) => c.fixed)).toBe(false);
  });

  it('bots walk it and go through the door into the Lensmother\'s arena', () => {
    // All of seeds 1-6 reach her (checked 25 Nov); two of the quicker ones keep CI fast.
    for (const seed of [3, 5]) {
      const w = glare(seed, { cls: 'slagbinder' });
      run(w, () => !w.hallsOn || w.state === 'ended', 900);
      expect(w.hallsOn, `seed ${seed}`).toBe(false);
      expect(w.route[w.encounter]).toBe('lensmother');
    }
  }, 30000);
});

describe('H3d: the Wrackline on the Halls map', () => {
  const QUAY_THEMES = ['quay', 'wreck', 'kelp', 'sluice'];
  const wrack = (seed: number, more: Partial<ConstructorParameters<typeof World>[0]> = {}) => halls(seed, { dungeon: 'wrackline', tier: 13, hallsBeta: true, ...more });
  /** Wakes the first pack with foes and returns it. */
  const wake = (w: World) => {
    const k = w.halls!.packs.findIndex((q) => q.foes.length);
    const pk = w.halls!.packs[k];
    put(w, pk.x, pk.y);
    for (let j = 0; j < 30 && pk.state === 'asleep'; j++) w.step(idle);
    return { k, pk };
  };

  it('is off for players until design turns it on; every room is a Round or Twin quay, with its own fights and Hessa behind the door', () => {
    expect(halls(3, { dungeon: 'wrackline', tier: 13 }).halls).toBeNull();
    const { openers, named, hard, boss } = DUNGEONS.wrackline;
    const mine = new Set<string>([...openers, ...named, ...hard, 'shrine']);
    for (let seed = 1; seed <= 120; seed++) {
      const w = wrack(seed);
      const m = w.halls!;
      expect(m, `seed ${seed}`).toBeTruthy();
      expect(w.route[4]).toBe(boss);
      for (const p of m.packs) expect(mine.has(p.enc), `seed ${seed} ${p.role} ${p.enc}`).toBe(true);
      expect(hallsCheck(m), `seed ${seed}`).toEqual([]);
      for (const r of m.rooms) expect(['round', 'twin', undefined], `seed ${seed} ${r.id}`).toContain(r.shape);
      expect(m.rooms[5].theme).toBe('quay');
      m.rooms.forEach((r, i) => { if (i !== 2) expect(QUAY_THEMES, `seed ${seed} room ${i}`).toContain(r.theme); });
      for (const c of m.corridors) expect(m.rooms[c.a].theme, `seed ${seed} ${c.a}-${c.b}`).not.toBe(m.rooms[c.b].theme);
    }
  });

  it('a pack waking puts three rafts round its own room\'s middle, and they drift there clear of every doorway', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const w = wrack(seed);
      const m = w.halls!;
      const { pk } = wake(w);
      expect(pk.state, `seed ${seed}`).toBe('awake');
      expect(w.wrackRoom).toBe(pk.room);
      expect(roomAt(m, w.wrackX, w.wrackY)).toBe(pk.room);
      expect(w.rafts.length).toBe(3);
      const rm = m.rooms[pk.room];
      const doors = m.corridors.flatMap((c) => (c.a === pk.room ? [[c.ax!, c.ay!]] : c.b === pk.room ? [[c.bx!, c.by!]] : []));
      for (let t = 0; t < 40 && pk.state === 'awake'; t++) {
        for (let j = 0; j < 20; j++) w.step(idle);
        for (const r of w.rafts) {
          expect(roomAt(m, r.x, r.y), `seed ${seed}`).toBe(pk.room);
          expect(roomGap(rm, r.x, r.y), `seed ${seed}`).toBeGreaterThanOrEqual(78);
          for (const [dx, dy] of doors) expect(Math.hypot(r.x - dx, r.y - dy), `seed ${seed}`).toBeGreaterThan(78 + 40);
        }
      }
    }
  });

  it('the Ebb drains the woken room only: a hero in the room is pulled and burned, a hero on the dry jetty is not', () => {
    const w = wrack(4);
    const m = w.halls!;
    const { pk } = wake(w);
    const p = w.player;
    const c = m.corridors.find((q) => q.a === pk.room || q.b === pk.room)!;
    // In the room, off the rafts, halfway out from the drain.
    const off = { x: w.wrackX, y: w.wrackY };
    let spot: [number, number] | null = null;
    for (let a = 0; a < 6.28 && !spot; a += 0.2) {
      const x = off.x + Math.cos(a) * 200, y = off.y + Math.sin(a) * 200;
      if (roomAt(m, x, y) === pk.room && !w.onRaft(x, y)) spot = [x, y];
    }
    expect(spot).toBeTruthy();
    const ebb = w as unknown as { ebbT: number; ebbWarnT: number };
    ebb.ebbWarnT = 0; ebb.ebbT = 4;
    put(w, spot![0], spot![1]);
    p.hp = p.maxHp;
    const d0 = Math.hypot(p.x - w.wrackX, p.y - w.wrackY);
    w.step(idle);
    expect(Math.hypot(p.x - w.wrackX, p.y - w.wrackY)).toBeLessThan(d0 - 0.5);
    expect(p.hp).toBeLessThan(p.maxHp);
    // On the jetty: the corridor's middle.
    const jx = (c.ax! + c.bx!) / 2, jy = (c.ay! + c.by!) / 2;
    expect(roomAt(m, jx, jy)).toBe(-1);
    put(w, jx, jy);
    p.hp = p.maxHp * 0.5;
    const hp = p.hp;
    ebb.ebbT = 4;
    w.step(idle);
    expect(Math.hypot(p.x - jx, p.y - jy)).toBeLessThan(0.5);
    expect(p.hp).toBeGreaterThanOrEqual(hp);
  });

  it('while the Ebb pulls, no foe can climb onto an afloat raft on the map (design, 25 Nov); out of the Ebb they can', () => {
    for (const ebbOn of [true, false]) {
      const w = wrack(5);
      wake(w);
      const ebb = w as unknown as { ebbT: number; ebbWarnT: number; tideClockT: number };
      ebb.ebbWarnT = 0; ebb.ebbT = ebbOn ? 4 : 0; ebb.tideClockT = 99;
      const r = w.rafts[0];
      const e = w.enemies.find((q) => q.alive && q.kind !== 'shoalLurker' && q.def.rank !== 'boss')!;
      e.x = r.x + 10; e.y = r.y;
      put(w, r.x + 40, r.y + 40);
      w.step(idle);
      const d = Math.hypot(e.x - r.x, e.y - r.y);
      if (ebbOn) expect(d).toBeGreaterThanOrEqual(78);
      else expect(d).toBeLessThan(78);
    }
  });

  it('QA, 25 Nov: in bot runs no foe (stunned or not) is ever on an afloat raft in the Ebb, and no raft sits on a rift', async () => {
    let ebbTicks = 0, riftTicks = 0;
    // Seeds 2, 3 and 5 have the Rift in the Wrack.
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      await new Promise((r) => setTimeout(r, 0));
      const w = wrack(seed, { cls: seed % 2 ? 'bulwark' : 'emberwright', tier: 2 });
      const end = w.time + 400;
      while (w.state !== 'ended' && w.time < end && w.hallsOn) {
        if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
        w.step(botInput(w));
        if (w.phase !== 'fight') continue;
        for (const r of w.rafts) {
          if (r.sunkT > 0) continue;
          for (const e of w.enemies) {
            if (!e.alive || e.def.rank === 'boss') continue;
            const d = Math.hypot(e.x - r.x, e.y - r.y);
            if (e.def.stationary) riftTicks++;
            if (e.def.stationary) expect(d, `seed ${seed} t ${w.time.toFixed(1)} ${e.kind}`).toBeGreaterThanOrEqual(78 + e.def.radius - 0.5);
            else if (w.ebbT > 0) expect(d, `seed ${seed} t ${w.time.toFixed(1)} ${e.kind} stun ${e.stunT}`).toBeGreaterThanOrEqual(78);
          }
        }
        if (w.ebbT > 0) ebbTicks++;
      }
    }
    expect(ebbTicks).toBeGreaterThan(100);
    expect(riftTicks).toBeGreaterThan(100);
  }, 60000);

  it('bots walk it and go through the door into Hessa\'s arena', async () => {
    let reached = 0;
    for (const seed of [1, 2, 3, 4]) {
      await new Promise((r) => setTimeout(r, 0));
      // Tier 2: an ungeared bot can't live through a tier 13 pack (the grid uses geared heroes).
      const w = wrack(seed, { cls: 'slagbinder', tier: 2 });
      run(w, () => !w.hallsOn || w.state === 'ended', 900);
      if (!w.hallsOn && w.route[w.encounter] === DUNGEONS.wrackline.boss) reached++;
    }
    expect(reached).toBeGreaterThanOrEqual(2);
  }, 60000);
});

describe('Halls: nothing touches through a sealed grate (QA, 25 Nov)', () => {
  it('a hero pressed on a sealed grate from outside and a foe pressed on it from inside stay apart by more than their radii', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const m = halls(seed).halls!;
      const c = m.corridors.find((q) => q.a === 0 && q.b === 1)!;
      const rm = m.rooms[1];
      rm.lock = HALLS.lockDelay + 1;
      // The doorway's rim: walk from the corridor's end in room 0 toward room 1's end until room 1's floor starts.
      let x = c.ax!, y = c.ay!;
      for (let t = 0; t <= 1 && roomGap(rm, x, y) < 0; t += 0.001) { x = c.ax! + (c.bx! - c.ax!) * t; y = c.ay! + (c.by! - c.ay!) * t; }
      const ux = (c.bx! - c.ax!), uy = (c.by! - c.ay!), ul = Math.hypot(ux, uy);
      const hero = { x: x + (ux / ul) * 5, y: y + (uy / ul) * 5, px: x - (ux / ul) * 30, py: y - (uy / ul) * 30 };
      const foe = { x: x - (ux / ul) * 5, y: y - (uy / ul) * 5, px: x + (ux / ul) * 30, py: y + (uy / ul) * 30 };
      clampGrates(m, hero, 12);
      clampGrates(m, foe, 15);
      expect(Math.hypot(hero.x - foe.x, hero.y - foe.y), `seed ${seed}`).toBeGreaterThan(12 + 15 + 1);
    }
  });
});

describe('Halls: the bot walks round a standing pillar (QA, 25 Nov)', () => {
  it('with a pillar dead ahead on its walk, the bot gets past it instead of pressing into it', () => {
    let tried = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const w = halls(seed, { dungeon: 'glarewell', tier: 7, hallsBeta: true });
      const m = w.halls!;
      const p = w.player;
      for (let j = 0; j < 30; j++) w.step(botInput(w));
      if (w.phase === 'fight') continue;
      const a = m.packs.find((q) => q.role === 'A')!;
      const wp = hallsWay(m, p.x, p.y, a.x, a.y);
      const d = Math.hypot(wp.x - p.x, wp.y - p.y);
      if (d < 200) continue;
      tried++;
      const ux = (wp.x - p.x) / d, uy = (wp.y - p.y) / d;
      w.pillars = [{ x: p.x + ux * 60, y: p.y + uy * 60, r: 26, cracked: false }];
      const start = Math.hypot(a.x - p.x, a.y - p.y);
      for (let j = 0; j < 60 * 4 && (w.phase as string) !== 'fight'; j++) w.step(botInput(w));
      expect(Math.hypot(a.x - p.x, a.y - p.y), `seed ${seed}`).toBeLessThan(start - 150);
    }
    expect(tried).toBeGreaterThanOrEqual(3);
  });
});

describe('H3c: the Coldmarrow on the Halls map', () => {
  const COLD_THEMES = ['hearthless', 'rime', 'drift', 'crypt'];
  const cold = (seed: number, more: Partial<ConstructorParameters<typeof World>[0]> = {}) => halls(seed, { dungeon: 'coldmarrow', tier: 10, hallsBeta: true, ...more });

  it('is off for players until design turns it on, and gets its own fights, themes and Nhevra behind the door', () => {
    expect(halls(3, { dungeon: 'coldmarrow', tier: 10 }).halls).toBeNull();
    const { openers, named, hard, boss } = DUNGEONS.coldmarrow;
    const mine = new Set<string>([...openers, ...named, ...hard, 'shrine']);
    for (let seed = 1; seed <= 120; seed++) {
      const w = cold(seed);
      const m = w.halls!;
      expect(m, `seed ${seed}`).toBeTruthy();
      expect(w.route[4]).toBe(boss);
      for (const p of m.packs) expect(mine.has(p.enc), `seed ${seed} ${p.role} ${p.enc}`).toBe(true);
      expect(hallsCheck(m), `seed ${seed}`).toEqual([]);
      expect(m.rooms[5].theme).toBe('hearthless');
      m.rooms.forEach((r, i) => { if (i !== 2) expect(COLD_THEMES, `seed ${seed} room ${i}`).toContain(r.theme); });
      for (const c of m.corridors) expect(m.rooms[c.a].theme, `seed ${seed} ${c.a}-${c.b}`).not.toBe(m.rooms[c.b].theme);
    }
  });

  it('a pack waking starts the fight with a full Hearthcoal and no Chill, as an arena fight does', () => {
    const w = cold(3);
    const p = w.player;
    p.coal = 0.3; p.chill = 0.6;
    const pk = w.halls!.packs.find((q) => q.foes.length)!;
    put(w, pk.x, pk.y);
    for (let j = 0; j < 30 && pk.state === 'asleep'; j++) w.step(idle);
    expect(pk.state).toBe('awake');
    expect(p.coal).toBeGreaterThan(0.95);
    expect(p.chill).toBeLessThan(0.05);
  });

  it('the Dimhorn\'s Dark Call brings its hounds in inside its own room, into its own pack, and wakes no other pack', () => {
    let tried = 0;
    for (let seed = 1; seed <= 200 && tried < 6; seed++) {
      const w = cold(seed);
      const m = w.halls!;
      const k = m.packs.findIndex((q) => q.foes.some((f) => f.kind === 'dimhorn'));
      if (k < 0) continue;
      tried++;
      const pk = m.packs[k];
      put(w, pk.x, pk.y);
      for (let j = 0; j < 30 && pk.state === 'asleep'; j++) w.step(idle);
      const hi = w.enemies.findIndex((e) => e.alive && e.kind === 'dimhorn');
      expect(hi, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      const before = w.enemies.filter((e) => e.alive && e.kind === 'rimehound').length;
      (w as unknown as { hallsDarkCall(e: unknown): void }).hallsDarkCall(w.enemies[hi]);
      const hounds = w.enemies.filter((e) => e.alive && e.kind === 'rimehound').slice(before);
      expect(hounds.length, `seed ${seed}`).toBeGreaterThan(0);
      for (const h of hounds) {
        expect(roomAt(m, h.x, h.y), `seed ${seed}`).toBe(pk.room);
        expect(h.pack).toBe(k);
      }
      const asleep = m.packs.map((q) => q.state);
      for (let j = 0; j < 3; j++) w.step(idle);
      m.packs.forEach((q, j) => { if (j !== k && asleep[j] === 'asleep') expect(q.state, `seed ${seed} pack ${j}`).toBe('asleep'); });
    }
    expect(tried).toBeGreaterThanOrEqual(3);
  });

  it('bots walk it and go through the door into Nhevra\'s arena', async () => {
    let reached = 0;
    for (const seed of [1, 2, 3, 4]) {
      // Yield between seeds: one long synchronous test starves vitest's worker RPC on CI ("Timeout calling onTaskUpdate").
      await new Promise((r) => setTimeout(r, 0));
      const w = cold(seed, { cls: 'slagbinder' });
      run(w, () => !w.hallsOn || w.state === 'ended', 900);
      if (!w.hallsOn && w.route[w.encounter] === 'nhevra') reached++;
    }
    expect(reached).toBeGreaterThanOrEqual(2);
  }, 60000);
});

describe('H3: every dungeon\'s fight clock runs on a Halls map too', () => {
  it('the arena step and hallsClock both run dungeonClocks, and no dungeon clock is called anywhere else (design, 25 Nov)', () => {
    const src = readFileSync(new URL('../sim/world.ts', import.meta.url), 'utf8');
    const body = (name: string) => {
      const at = src.indexOf(`  private ${name}(dt: number): void {`);
      expect(at, name).toBeGreaterThan(0);
      return src.slice(at, src.indexOf('\n  }\n', at));
    };
    expect(body('hallsClock')).toContain('this.dungeonClocks(dt)');
    expect(body('dungeon')).toContain('this.dungeonClocks(dt)');
    const clocks = body('dungeonClocks');
    // Every per-dungeon clock call (this.xClock(dt), this.runGlarewell(dt)) lives in dungeonClocks alone.
    const calls = [...src.matchAll(/this\.(\w+Clock|runGlarewell)\(dt\)/g)].map((m) => m[1]);
    const shared = new Set(['layoutClock', 'arenaEventClock', 'burnoutClock', 'reinforceClock', 'hallsClock', 'lensmotherClock', 'kmClock']);
    for (const c of new Set(calls)) {
      if (shared.has(c)) continue;
      const n = calls.filter((x) => x === c).length;
      expect(clocks, c).toContain(`this.${c}(dt)`);
      expect(n, `${c} is called outside dungeonClocks`).toBe(1);
    }
  });
});

describe('H2b: hero shots stop at sealed grates', () => {
  it('an orb crossing a sealed room\'s rim dies; inside the room, or with the room open, it flies on', () => {
    const w = halls(2);
    const m = w.halls!;
    const a = pack(w, 'A');
    const rm = m.rooms[a.room];
    put(w, a.x, a.y + HALLS.reach - 5);
    for (let k = 0; k < Math.round((HALLS.lockDelay + 0.2) * 30) && (rm.lock ?? -1) < HALLS.lockDelay; k++) w.step(idle);
    expect(rm.lock!).toBeGreaterThanOrEqual(HALLS.lockDelay);
    // Each corridor end at this room: a point just inside the rim and one just outside, on the corridor's line.
    const c = m.corridors.find((k) => k.a === a.room || k.b === a.room)!;
    const e = corridorEnds(m, c);
    // From this room's port (inside its floor) along the corridor, out to the rim.
    const [sx, sy, fx, fy] = c.a === a.room ? [e.x1, e.y1, e.x2, e.y2] : [e.x2, e.y2, e.x1, e.y1];
    const ux = (fx - sx) / Math.hypot(fx - sx, fy - sy), uy = (fy - sy) / Math.hypot(fx - sx, fy - sy);
    expect(roomGap(rm, sx, sy)).toBeGreaterThanOrEqual(0);
    let t = 0;
    while (t < 4000 && roomGap(rm, sx + ux * t, sy + uy * t) >= 0) t += 2;
    const ins = { x: sx + ux * (t - 20), y: sy + uy * (t - 20) }, out = { x: sx + ux * (t + 20), y: sy + uy * (t + 20) };
    expect(grateCut(m, ins.x, ins.y, out.x, out.y)).toBe(true);
    expect(grateCut(m, out.x, out.y, ins.x, ins.y)).toBe(true);
    expect(grateCut(m, sx, sy, ins.x, ins.y)).toBe(false);
    // In the world: an orb fired from just inside, outward at speed, is gone next tick.
    const orb = w.orbs.find((q) => !q.alive)!;
    Object.assign(orb, { alive: true, x: ins.x, y: ins.y, px: ins.x, py: ins.y, vx: ux * 1500, vy: uy * 1500, life: 2, target: -1, dmg: 1, owner: 0, pierce: 0, lastHit: -1 });
    w.step(idle);
    expect(orb.alive).toBe(false);
    // With the room open, the same step is no cut.
    const lock = rm.lock;
    rm.lock = -1;
    expect(grateCut(m, ins.x, ins.y, out.x, out.y)).toBe(false);
    rm.lock = lock;
  });
});

describe('H3 plan: a pack waking runs the same fight setup as an arena fight', () => {
  it('hallsWake and startEncounter share fightSetup, so a dungeon\'s per-fight setup runs when a pack wakes', () => {
    const w = halls(2);
    w.player.haloUsed = true;
    w.player.windUsed = true;
    const a = pack(w, 'A');
    put(w, a.x, a.y + HALLS.reach - 5);
    w.step(idle);
    expect(a.state).toBe('awake');
    expect(w.phase).toBe('fight');
    expect(w.player.haloUsed).toBe(false);
    expect(w.player.windUsed).toBe(false);
    const src = readFileSync('sim/world.ts', 'utf8');
    expect(src).toContain('if (first) this.fightSetup(def);');
    expect(src.match(/this\.fightSetup\(def\)/g)!.length).toBe(2);
  });
});

describe('Halls: one pack per room (design, 25 Nov)', () => {
  it('every generated room holds at most one pack, C in its own main-path room, and the walk stays 3,600-5,600', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const g = genHalls(seed);
      expect(g.tries, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      const rooms = g.spots.map((p) => p.room);
      expect(new Set(rooms).size, `seed ${seed}`).toBe(rooms.length);
      expect(g.spots.find((p) => p.role === 'C')!.room).toBe(C_ROOM);
      expect(g.rooms[C_ROOM].main).toBe(true);
      expect(mainRooms(g)).toEqual([0, 1, 3, C_ROOM, 5, DOOR_ROOM]);
      // C's room is on the walk, between B's and the door guard's: R3 -> R6 -> R5.
      expect(roomPath(g, 3, 5)).toEqual([3, C_ROOM, 5]);
      // C's room rolls its own layout, as fight 3 does in the arena.
      expect(g.layoutRooms).toContainEqual({ room: C_ROOM, slot: 2 });
      const l = hallsWalkLine(g, g.rooms[0].x, g.rooms[0].y, g.door.x, g.door.y);
      let walk = 0;
      for (let k = 1; k < l.length; k++) walk += Math.hypot(l[k].x - l[k - 1].x, l[k].y - l[k - 1].y);
      expect(walk).toBeGreaterThanOrEqual(3600);
      expect(walk).toBeLessThanOrEqual(5600);
    }
  });

  it('the checker refuses two packs in one room', () => {
    const g = genRoll(5, 0);
    const c = g.spots.find((p) => p.role === 'C')!, b = g.spots.find((p) => p.role === 'B')!;
    const faults = hallsCheck({ rooms: g.rooms, corridors: g.corridors, door: g.door, packs: g.spots.map((p) => (p === c ? { ...c, room: b.room } : p)), layoutRooms: g.layoutRooms });
    expect(faults).toContain(`room R3 holds 2 packs`);
  });

  it('a woken B seals only its own room: C sleeps on in the next room', () => {
    for (const seed of [2, 3, 4]) {
      const w = halls(seed);
      const b = pack(w, 'B'), c = pack(w, 'C');
      put(w, b.x, b.y);
      w.step(idle);
      expect(b.state).toBe('awake');
      expect(c.state).toBe('asleep');
      expect(c.room).not.toBe(b.room);
    }
  });
});
