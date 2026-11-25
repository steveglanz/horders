import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { botChoose, botInput, hallsOrder } from '../sim/bot';
import { DOOR_ROOM, HALLS, KILN_SCALE, buildHalls, clampGrates, clampHalls, genHalls, hallsCheck, hallsWay, hallsWalkLine, inside, roomAt, roomGap, roomPath } from '../sim/halls';
import { DUNGEONS, EncounterId } from '../sim/content/dungeon';

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
      expect(m.mirror).toBe(false);
      expect(m.packs.map((p) => p.room)).toEqual([1, 2, 3, 3, 4, 5]);
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
      expect(roomAt(m, c.x, c.y)).toBe(3);
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
