/**
 * Phase 18 Halls H1 (design spec: /mnt/project-files/horders/design/halls/h1-prototype-spec.md): a WoW-style dungeon
 * map for the Kiln, behind ?halls=1. Rooms joined by corridors, with packs standing asleep in them; walk the map,
 * pick your fights, then go through the boss door into today's Kiln arena.
 *
 * This file is pure: the map template, its geometry (where heroes and foes may stand, and how a foe walks round a
 * wall), and the pack plan rolled from a run's route. World (sim/world.ts) owns the state as it plays.
 */
import { DUNGEONS, DungeonId, ENCOUNTERS, EncounterId, GateKind, rollFork } from './content/dungeon';
import type { EnemyKind } from './content/enemies';

export const HALLS = {
  /** Corridor width (world units). */
  corridor: 160,
  /** A sleeping pack wakes when a hero steps this close to its centre. */
  reach: 200,
  /** ...or when an awake foe comes this close to its centre (pulling two packs at once). */
  pull: 350,
  /** The client shows a sleeping pack's red ring only with a hero this close. */
  showRing: 400,
  /** Walking this close to the boss door, with the door guard cleared, starts the boss fight. */
  door: 80,
  /** The fade from the map into the boss arena (s). */
  fade: 0.8,
  /** The camera leads this far ahead along a corridor. */
  lead: 120,
  /** A room's rolled lava is cooled crust until its pack wakes, then heats to burning over this long (s). */
  lavaHeat: 1,
  /**
   * Bots in a fight keep this far from another sleeping pack's centre: past `pull`, so the foes chasing them don't
   * wake it (that, not the hero stepping in its ring, was most double pulls).
   */
  ringKeep: 400,
  /**
   * "Catch breath" on the map: after `delay` s with nothing awake, heroes recover `hp` of max hp a second and their class
   * resource builds `res` a second faster than its own regen (design, 24 Nov: aims at the arena's arrival state).
   */
  rest: { delay: 3, hp: 0.01, res: 4 },
  /** H2a: heroes and foes move this much faster on a Halls run, its boss fight included (shots and casts don't change). */
  moveScale: 1.25,
  /** H2a: and heroes this much faster again while catching their breath (nothing awake for rest.delay s). */
  travelRun: 1.2,
  /** H2b: a room seals this long after a pack in it wakes (the doorways glow red until then). */
  lockDelay: 1.0,
  /** How far apart a sleeping pack stands round its centre. */
  spread: 64,
};

export type PackRole = 'A' | 'B' | 'C' | 'D' | 'E' | 'S';

/** H2c: the five room shapes the generator picks from (design's h2-plan.md, "Rooms"). */
export type RoomShape = 'round' | 'hall' | 'cross' | 'ring' | 'twin';

/** H2d: the five Kiln room themes (visuals' ids, client/hallsthemes.ts ThemeId). */
export type RoomTheme = 'ash' | 'bellows' | 'slag' | 'cooling' | 'shrine';

/** H2c: a walkable piece of a room's floor: a circle {c: [x, y, r]} or an axis-aligned box {b: [x, y, half w, half h]}. */
export type RoomPart = { c: [number, number, number] } | { b: [number, number, number, number] };

export interface HallsRoom {
  id: string;
  /** The room's bounding circle: its whole floor fits inside it (for a round room, the floor itself). */
  x: number;
  y: number;
  r: number;
  /** On the main path (R0, R1, R3, R5 and the door); R2 and R4 are side rooms. */
  main: boolean;
  /** H2c: the room's shape; undefined is round (the circle x, y, r). */
  shape?: RoomShape;
  /** H2c: the floor as the union of these pieces; undefined is the circle x, y, r. */
  parts?: RoomPart[];
  /** H2c: solid pieces cut out of the floor (the ring's hearth island, the cross's pillars): they block walking. */
  holes?: RoomPart[];
  /**
   * H2c, for the clients: the floor's outline as flat [x0, y0, x1, y1, ...] loops, the outer wall first, then each
   * island. Every generated room has one; template rooms don't (draw the circle).
   */
  edge?: number[][];
  /**
   * H2d: the room's look (floor, walls, props, light, sound bed): Ash store, Bellows hall, Slag channel, Cooling yard,
   * Kiln shrine. Names and art are visuals' (client/hallsthemes.ts); hallsThemes rolls it.
   */
  theme?: RoomTheme;
  /** H2c: walking waypoints on the room's floor (hallsWay); undefined is its centre. */
  nav?: [number, number][];
  /** H2b: seconds since the room began to seal (grates drop at HALLS.lockDelay), or -1 / undefined while open. */
  lock?: number;
  /** H2b: seconds since the room last opened again (undefined if it never sealed), for the client's lift. */
  lifted?: number;
}

export interface HallsCorridor {
  /** Room indices at either end. */
  a: number;
  b: number;
  /**
   * H2c: where the corridor's centre line ends, inside room a (ax, ay) and room b (bx, by), just past each doorway;
   * undefined is the room's centre (the template). Use corridorEnds.
   */
  ax?: number;
  ay?: number;
  bx?: number;
  by?: number;
}

/** Rooms and corridors: all the walking geometry needs. */
export type HallsGeo = { rooms: HallsRoom[]; corridors: HallsCorridor[] };

export interface HallsPack {
  role: PackRole;
  room: number;
  x: number;
  y: number;
  /** Today's encounter this pack is (its spawn list, name and tip). */
  enc: EncounterId;
  /** The route slot it stands for: foe hp depth (1 + 0.12 x slot) and its bag's rarity use it. */
  slot: number;
  /** A main-path pack (A, B, C, E): it counts toward the run's fights cleared. */
  main: boolean;
  /** The door guard: the boss door opens only once it is cleared. */
  guard: boolean;
  /** R2 rolls a gate as rollFork does: 'named' pays as a named fight, 'shrine' heals instead of fighting. */
  gate?: GateKind;
  /** Loot bags each hero gets for clearing it (D pays a second). */
  bags: number;
  state: 'asleep' | 'awake' | 'cleared';
  /** Where each foe stands while asleep (spawned there when the pack wakes). */
  foes: { kind: EnemyKind; x: number; y: number }[];
}

export interface HallsMap {
  rooms: HallsRoom[];
  corridors: HallsCorridor[];
  packs: HallsPack[];
  /** The boss door, at the end of R5's north corridor. */
  door: { x: number; y: number };
  /** Whether this run's map is the template mirrored on x (seed & 1); a generated map is never mirrored. */
  mirror: boolean;
  /** The rooms that roll a layout (pillars, vents, lava) as fights do, and the route slot whose roll they take. */
  layoutRooms: { room: number; slot: number }[];
  /** Rooms a hero has stood in (the corner map shows only these). */
  seen: boolean[];
  /** The party went through the boss door: the map is left behind and today's arena takes over. */
  done: boolean;
  /** Flare vents of the rooms that rolled the vents layout; they flare only while a pack in their room is awake. */
  vents: { room: number; x: number; y: number }[];
}

/**
 * KILN_HALLS_A: the one hand-made template for H1 (spec table "The map"), drawn at the spec's sizes and scaled by
 * KILN_SCALE (positions and room radii; corridors stay HALLS.corridor wide). Room 6 is the boss door's alcove.
 * Design, 24 Nov: x1.3 gives kiting heroes room (Kiln t2 average bot, 120 seeds: Emberwright 33 -> 44, Slagbinder
 * 108 -> 117; the arena is 58 and 118).
 */
export const KILN_SCALE = 1.3;
const K = (v: number): number => v * KILN_SCALE;
export const KILN_HALLS_A = {
  rooms: [
    { id: 'R0', x: 0, y: K(0), r: K(300), main: true },
    { id: 'R1', x: 0, y: K(-900), r: K(380), main: true },
    { id: 'R2', x: K(-850), y: K(-1500), r: K(340), main: false },
    { id: 'R3', x: 0, y: K(-1800), r: K(420), main: true },
    { id: 'R4', x: K(800), y: K(-2500), r: K(360), main: false },
    { id: 'R5', x: 0, y: K(-2800), r: K(380), main: true },
    { id: 'door', x: 0, y: K(-3300), r: K(100), main: true },
  ] as HallsRoom[],
  corridors: [
    { a: 0, b: 1 }, { a: 1, b: 3 }, { a: 1, b: 2 }, { a: 3, b: 4 }, { a: 3, b: 5 }, { a: 5, b: 6 },
  ] as HallsCorridor[],
  /**
   * Pack spots: A in R1; B and C in R3, 520 apart (before scaling) so B's foes stand outside C's pull (350), with C to
   * the west, 260 off the path, so a careful hero walks past its ring (200); D in R4; E in R5's north doorway.
   */
  packs: [
    { role: 'A', room: 1, x: 0, y: K(-900) },
    { role: 'S', room: 2, x: K(-850), y: K(-1500) },
    { role: 'B', room: 3, x: K(60), y: K(-1600) },
    { role: 'C', room: 3, x: K(-260), y: K(-2010) },
    { role: 'D', room: 4, x: K(800), y: K(-2500) },
    { role: 'E', room: 5, x: 0, y: K(-3060) },
  ] as { role: PackRole; room: number; x: number; y: number }[],
  door: { x: 0, y: K(-3300) },
  /** The rooms that roll a layout (pillars, vents, lava) as fights do today, and the route slot whose roll they take. */
  layoutRooms: [{ room: 1, slot: 0 }, { room: 3, slot: 1 }, { room: 5, slot: 3 }],
};

/** Room index of the door alcove. */
export const DOOR_ROOM = 6;

const hash = (seed: number, k: number): number => {
  let h = (Math.imul(seed ^ 0x48616c6c, 0x9e3779b1) + Math.imul(k + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae3d) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

/** Whether `dungeon` has a Halls map yet (H1: the Kiln only). */
export const hallsFor = (dungeon: DungeonId): boolean => dungeon === 'kiln';

/** Where a map's packs stand before they are rolled (template spots, or the generator's). */
type Spot = { role: PackRole; room: number; x: number; y: number };

/**
 * Builds this run's map from today's route ([opener, opener, named, hard, boss]): A and B are the openers, C the named
 * slot, E (the door guard) the hard slot. R2 takes the gate rollFork would offer before fight 2 (a named fight or a
 * shrine), and D a hard or named fight not already on the map. `pick` and `chance` are the run's rng, as for rollFork.
 * H2c: the rooms come from genHalls (hashes of the seed only); `template` keeps H1's hand-made KILN_HALLS_A.
 */
export function buildHalls(seed: number, route: EncounterId[], dungeon: DungeonId, pick: (n: number) => number, chance: (p: number) => boolean, template = false): HallsMap {
  let rooms: HallsRoom[], corridors: HallsCorridor[], spots: Spot[], door: { x: number; y: number }, layoutRooms: { room: number; slot: number }[];
  let mirror = false;
  if (template) {
    const T = KILN_HALLS_A;
    mirror = (seed & 1) === 1;
    const mx = (x: number) => (mirror && x !== 0 ? -x : x);
    rooms = T.rooms.map((r) => ({ ...r, x: mx(r.x) }));
    corridors = T.corridors.map((c) => ({ ...c }));
    spots = T.packs.map((s) => ({ ...s, x: mx(s.x) }));
    door = { x: mx(T.door.x), y: T.door.y };
    layoutRooms = T.layoutRooms.map((l) => ({ ...l }));
  } else {
    ({ rooms, corridors, spots, door, layoutRooms } = genHalls(seed));
  }
  const fork = rollFork(route, 1, pick, chance, dungeon);
  const side = fork ? fork[1] : { kind: 'shrine' as GateKind, encounter: 'shrine' as EncounterId };
  const used = new Set<EncounterId>([...route, side.encounter]);
  const { hard, named } = DUNGEONS[dungeon];
  const pool = [...hard, ...named].filter((e, i, a) => !used.has(e) && a.indexOf(e) === i);
  const dEnc = pool.length ? pool[pick(pool.length)] : route[3];
  const plan: Record<PackRole, { enc: EncounterId; slot: number; main: boolean; bags: number; gate?: GateKind }> = {
    A: { enc: route[0], slot: 0, main: true, bags: 1 },
    B: { enc: route[1], slot: 1, main: true, bags: 1 },
    C: { enc: route[2], slot: 2, main: true, bags: 1 },
    E: { enc: route[3], slot: 3, main: true, bags: 1 },
    S: { enc: side.encounter, slot: 1, main: false, bags: 1, gate: side.kind },
    D: { enc: dEnc, slot: 3, main: false, bags: 2 },
  };
  const packs: HallsPack[] = spots.map((s, k) => {
    const p = plan[s.role];
    const { x, y } = s;
    const kinds: EnemyKind[] = [];
    for (const sp of ENCOUNTERS[p.enc].spawns) for (let j = 0; j < sp.n; j++) kinds.push(sp.kind);
    const turn = ((hash(seed, k) >>> 4) % 360) * (Math.PI / 180);
    const foes = kinds.map((kind, j) => {
      if (kinds.length === 1) return { kind, x, y };
      const a = turn + (j * 2 * Math.PI) / kinds.length;
      const r = HALLS.spread * (j % 2 ? 1.25 : 1);
      return { kind, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
    });
    return { role: s.role, room: s.room, x, y, enc: p.enc, slot: p.slot, main: p.main, guard: s.role === 'E', gate: p.gate, bags: p.bags, state: 'asleep', foes };
  });
  return { rooms, corridors, packs, door, mirror, layoutRooms, seen: rooms.map((_, i) => i === 0), done: false, vents: [] };
}

// ---------------------------------------------------------------- geometry

function segClosest(px: number, py: number, x1: number, y1: number, x2: number, y2: number): { x: number; y: number } {
  const vx = x2 - x1, vy = y2 - y1;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / len2));
  return { x: x1 + vx * t, y: y1 + vy * t };
}

/** Where corridor `c`'s centre line ends: (x1, y1) in room a, (x2, y2) in room b. */
export function corridorEnds(m: HallsGeo, c: HallsCorridor): { x1: number; y1: number; x2: number; y2: number } {
  const a = m.rooms[c.a], b = m.rooms[c.b];
  return { x1: c.ax ?? a.x, y1: c.ay ?? a.y, x2: c.bx ?? b.x, y2: c.by ?? b.y };
}

function partGap(p: RoomPart, x: number, y: number): number {
  if ('c' in p) return p.c[2] - Math.hypot(x - p.c[0], y - p.c[1]);
  const [cx, cy, hx, hy] = p.b;
  const dx = Math.abs(x - cx) - hx, dy = Math.abs(y - cy) - hy;
  return -(Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0));
}

/** How far (x, y) stands inside room `rm`'s floor from its nearest wall or island (negative: outside it, by that much). */
export function roomGap(rm: HallsRoom, x: number, y: number): number {
  let g: number;
  if (!rm.parts) g = rm.r - Math.hypot(x - rm.x, y - rm.y);
  else {
    g = -Infinity;
    for (const p of rm.parts) g = Math.max(g, partGap(p, x, y));
  }
  if (rm.holes) for (const h of rm.holes) g = Math.min(g, -partGap(h, x, y));
  return g;
}

/** The unit direction from (x, y) that leads most directly further into room `rm`'s floor. */
export function roomInward(rm: HallsRoom, x: number, y: number): { x: number; y: number } {
  if (!rm.parts && !rm.holes) {
    const dx = rm.x - x, dy = rm.y - y, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }
  const gx = roomGap(rm, x + 1, y) - roomGap(rm, x - 1, y), gy = roomGap(rm, x, y + 1) - roomGap(rm, x, y - 1);
  const d = Math.hypot(gx, gy);
  if (d < 1e-6) {
    const dx = rm.x - x, dy = rm.y - y, e = Math.hypot(dx, dy) || 1;
    return { x: dx / e, y: dy / e };
  }
  return { x: gx / d, y: gy / d };
}

/** The nearest point at least `pad` inside room `rm`'s floor to (x, y) (exact for a round room; a few steps otherwise). */
export function roomClamp(rm: HallsRoom, x: number, y: number, pad: number): { x: number; y: number } {
  if (!rm.parts && !rm.holes) {
    const dx = x - rm.x, dy = y - rm.y, d = Math.hypot(dx, dy) || 1, max = Math.max(0, rm.r - pad);
    return d <= max ? { x, y } : { x: rm.x + (dx / d) * max, y: rm.y + (dy / d) * max };
  }
  for (let k = 0; k < 8; k++) {
    const g = roomGap(rm, x, y);
    if (g >= pad - 0.5) break;
    const n = roomInward(rm, x, y);
    x += n.x * (pad - g + 0.5);
    y += n.y * (pad - g + 0.5);
  }
  return { x, y };
}

/** Which room (index) holds (x, y) with `pad` to spare, or -1. */
export function roomAt(m: HallsGeo, x: number, y: number, pad = 0): number {
  for (let i = 0; i < m.rooms.length; i++) {
    const r = m.rooms[i];
    if ((x - r.x) ** 2 + (y - r.y) ** 2 > (r.r - pad) ** 2) continue;
    if ((!r.parts && !r.holes) || roomGap(r, x, y) >= pad) return i;
  }
  return -1;
}

/**
 * H2b: a sealed room's grates (rm.lock past HALLS.lockDelay) close its doorways: nothing inside its floor gets out, and
 * nothing outside gets in. `o` (radius `r`) is kept wholly on its own side of the room's wall. The side is where `o`
 * started the tick (`px`, `py`, when it has them), so a dash or leap that lands past the grates (Blink, Glimmer Step,
 * Interpose, Sidestep, Charge, Rending Dash) stops at them instead.
 */
export function clampGrates(m: HallsGeo, o: { x: number; y: number; px?: number; py?: number }, r: number): void {
  for (const rm of m.rooms) {
    if (rm.lock === undefined || rm.lock < HALLS.lockDelay) continue;
    const from = o.px !== undefined && o.py !== undefined;
    if (!from && (o.x - rm.x) ** 2 + (o.y - rm.y) ** 2 > (rm.r + r) ** 2) continue;
    const g = roomGap(rm, o.x, o.y);
    const wasIn = from ? roomGap(rm, o.px!, o.py!) >= 0 : g >= 0;
    if (wasIn) {
      if (g >= r) continue;
      const q = roomClamp(rm, o.x, o.y, r);
      o.x = q.x;
      o.y = q.y;
    } else {
      if (g <= -r) continue;
      const n = roomInward(rm, o.x, o.y);
      o.x -= n.x * (r + g);
      o.y -= n.y * (r + g);
    }
  }
}

/** Which corridor (index) holds (x, y) with `pad` to spare, or -1. */
export function corridorAt(m: HallsGeo, x: number, y: number, pad = 0): number {
  const hw = HALLS.corridor / 2 - pad;
  for (let i = 0; i < m.corridors.length; i++) {
    const e = corridorEnds(m, m.corridors[i]);
    const q = segClosest(x, y, e.x1, e.y1, e.x2, e.y2);
    if ((x - q.x) ** 2 + (y - q.y) ** 2 <= hw * hw) return i;
  }
  return -1;
}

/** Whether a circle of radius `pad` at (x, y) stands wholly inside the map's rooms and corridors (one shape at least). */
export function inside(m: HallsGeo, x: number, y: number, pad = 0): boolean {
  return roomAt(m, x, y, pad) >= 0 || corridorAt(m, x, y, pad) >= 0;
}

/** Keeps `o` (radius `r`) inside the map: outside every room and corridor, it moves to the nearest point inside one. */
export function clampHalls(m: HallsGeo, o: { x: number; y: number }, r: number): void {
  if (inside(m, o.x, o.y, r)) return;
  let bx = o.x, by = o.y, bd = Infinity;
  for (const rm of m.rooms) {
    // A far room can't hold the nearest point (its bounding circle is further than the best so far).
    const far = Math.hypot(o.x - rm.x, o.y - rm.y) - rm.r;
    if (far > 0 && far * far > bd) continue;
    const q = roomClamp(rm, o.x, o.y, Math.min(r, rm.r));
    const dd = (q.x - o.x) ** 2 + (q.y - o.y) ** 2;
    if (dd < bd && roomGap(rm, q.x, q.y) >= Math.min(r, rm.r) - 1) { bd = dd; bx = q.x; by = q.y; }
  }
  const hw = Math.max(0, HALLS.corridor / 2 - r);
  for (const c of m.corridors) {
    const e = corridorEnds(m, c);
    const q = segClosest(o.x, o.y, e.x1, e.y1, e.x2, e.y2);
    const dx = o.x - q.x, dy = o.y - q.y, d = Math.hypot(dx, dy) || 1;
    const x = q.x + (dx / d) * Math.min(d, hw), y = q.y + (dy / d) * Math.min(d, hw);
    const dd = (x - o.x) ** 2 + (y - o.y) ** 2;
    if (dd < bd) { bd = dd; bx = x; by = y; }
  }
  o.x = bx;
  o.y = by;
}

/** Whether the straight walk from (x1, y1) to (x2, y2) stays inside the map (sampled every 40 units). */
export function clearWalk(m: HallsGeo, x1: number, y1: number, x2: number, y2: number, pad = 0): boolean {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(1, Math.ceil(d / 40));
  for (let k = 1; k < n; k++) {
    const t = k / n;
    if (!inside(m, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, pad)) return false;
  }
  return true;
}

/** The rooms from `from` to `to` along the corridors, both ends included (the map is a tree, so this is the only way). */
export function roomPath(m: HallsGeo, from: number, to: number): number[] {
  const prev = new Array<number>(m.rooms.length).fill(-2);
  prev[from] = -1;
  const queue = [from];
  while (queue.length) {
    const r = queue.shift()!;
    if (r === to) break;
    for (const c of m.corridors) {
      const n = c.a === r ? c.b : c.b === r ? c.a : -1;
      if (n >= 0 && prev[n] === -2) { prev[n] = r; queue.push(n); }
    }
  }
  if (prev[to] === -2) return [from];
  const out: number[] = [];
  for (let r = to; r !== -1; r = prev[r]) out.unshift(r);
  return out;
}

// ---------------------------------------------------------------- walking (H2c: rooms that aren't convex)

/**
 * The map's walking graph: every room's waypoints (HallsRoom.nav, or its centre) and both ends of every corridor, joined
 * where the walk between two of them is clear, with the shortest walk between every pair (Floyd). Built once a map.
 */
interface Nav {
  pts: { x: number; y: number }[];
  /** Rooms (index) and corridors (100 + index) each point stands in. */
  area: number[][];
  d: Float64Array;
  next: Int16Array;
  /** The first point of each room's waypoints. */
  roomStart: number[];
}
const NAV_PAD = 12;
/** A straight walk counts as clear with this much room to spare (a walker is about this wide). */
const WAY_PAD = 8;
const NAVS = new WeakMap<object, Nav>();

function areasAt(m: HallsGeo, x: number, y: number): number[] {
  const out: number[] = [];
  m.rooms.forEach((rm, i) => { if (roomGap(rm, x, y) >= 0) out.push(i); });
  const hw = HALLS.corridor / 2;
  m.corridors.forEach((c, i) => {
    const e = corridorEnds(m, c);
    const q = segClosest(x, y, e.x1, e.y1, e.x2, e.y2);
    if ((x - q.x) ** 2 + (y - q.y) ** 2 <= hw * hw) out.push(100 + i);
  });
  return out;
}

function navOf(m: HallsGeo): Nav {
  let nav = NAVS.get(m.rooms);
  if (nav) return nav;
  const pts: { x: number; y: number }[] = [];
  const roomStart: number[] = [];
  m.rooms.forEach((rm) => { roomStart.push(pts.length); for (const [x, y] of rm.nav ?? [[rm.x, rm.y]]) pts.push({ x, y }); });
  for (const c of m.corridors) { const e = corridorEnds(m, c); pts.push({ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }); }
  const n = pts.length;
  const area = pts.map((p) => areasAt(m, p.x, p.y));
  const d = new Float64Array(n * n).fill(Infinity);
  const next = new Int16Array(n * n).fill(-1);
  for (let i = 0; i < n; i++) { d[i * n + i] = 0; next[i * n + i] = i; }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!area[i].some((a) => area[j].includes(a))) continue;
      const a = pts[i], b = pts[j];
      if (!clearWalk(m, a.x, a.y, b.x, b.y, NAV_PAD)) continue;
      const l = Math.hypot(a.x - b.x, a.y - b.y);
      d[i * n + j] = d[j * n + i] = l;
      next[i * n + j] = j;
      next[j * n + i] = i;
    }
  }
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      const ik = d[i * n + k];
      if (ik === Infinity) continue;
      for (let j = 0; j < n; j++) {
        const v = ik + d[k * n + j];
        if (v < d[i * n + j]) { d[i * n + j] = v; next[i * n + j] = next[i * n + k]; }
      }
    }
  }
  nav = { pts, area, d, next, roomStart };
  NAVS.set(m.rooms, nav);
  return nav;
}

/** The walking-graph points the walk from (x, y) reaches in a straight line, with how far each is. */
function seen(m: HallsGeo, nav: Nav, x: number, y: number): [number, number][] {
  const here = areasAt(m, x, y);
  const out: [number, number][] = [];
  // With room to spare first (a walker aiming past a jutting corner, as where a twin's halves meet, snags on it).
  for (const pad of [WAY_PAD, 0]) {
    nav.pts.forEach((p, i) => {
      if (here.length && !nav.area[i].some((a) => here.includes(a))) return;
      if (clearWalk(m, x, y, p.x, p.y, pad)) out.push([i, Math.hypot(p.x - x, p.y - y)]);
    });
    if (out.length) return out;
  }
  // Off the floor, or nothing in sight: the nearest point.
  let best = 0, bd = Infinity;
  nav.pts.forEach((p, i) => { const dd = Math.hypot(p.x - x, p.y - y); if (dd < bd) { bd = dd; best = i; } });
  return [[best, bd]];
}

/**
 * Where a walker at (x, y) should head to reach (tx, ty): the target itself when the straight walk is clear, else the
 * next point on the shortest walk through the map's walking graph (round a ring's island, a cross's pillars, the
 * corridors). Used by awake foes (World.updateEnemies) and bots (sim/bot.ts).
 */
export function hallsWay(m: HallsGeo, x: number, y: number, tx: number, ty: number): { x: number; y: number } {
  if (clearWalk(m, x, y, tx, ty, WAY_PAD)) return { x: tx, y: ty };
  const nav = navOf(m), n = nav.pts.length;
  const from = seen(m, nav, x, y), to = seen(m, nav, tx, ty);
  let best = Infinity, bi = from[0][0], bj = to[0][0];
  for (const [i, di] of from) for (const [j, dj] of to) {
    const c = di + nav.d[i * n + j] + dj;
    if (c < best) { best = c; bi = i; bj = j; }
  }
  const p = nav.pts[bi];
  if (Math.hypot(p.x - x, p.y - y) < 30) {
    // Already there: on to the next point (or the target, from the last one).
    if (bi === bj) return { x: tx, y: ty };
    const k = nav.next[bi * n + bj];
    if (k >= 0) return nav.pts[k];
  }
  return { x: p.x, y: p.y };
}

/** H2c: the walking-graph path from (x1, y1) to (x2, y2), both ends included (the checker's walking line). */
export function hallsWalkLine(m: HallsGeo, x1: number, y1: number, x2: number, y2: number): { x: number; y: number }[] {
  const out = [{ x: x1, y: y1 }];
  let x = x1, y = y1;
  for (let k = 0; k < 200; k++) {
    const w = hallsWay(m, x, y, x2, y2);
    // Step to the waypoint itself (then hallsWay moves on from it).
    out.push(w);
    if (w.x === x2 && w.y === y2) return out;
    x = w.x;
    y = w.y;
  }
  out.push({ x: x2, y: y2 });
  return out;
}

/**
 * A push away from the nearest wall when within `within` of it, scaled 0 to 1 by how close (bots use it in place of
 * the arena's "don't get pinned against the wall").
 */
export function wallPush(m: HallsGeo, x: number, y: number, within: number): { x: number; y: number; k: number } {
  let gap = -Infinity, cx = x, cy = y, room = -1;
  // The roomiest shape the point is in decides the wall it is near.
  m.rooms.forEach((r, i) => {
    const g = roomGap(r, x, y);
    if (g > gap) { gap = g; room = i; }
  });
  for (const c of m.corridors) {
    const e = corridorEnds(m, c);
    const q = segClosest(x, y, e.x1, e.y1, e.x2, e.y2);
    const g = HALLS.corridor / 2 - Math.hypot(x - q.x, y - q.y);
    if (g > gap) { gap = g; cx = q.x; cy = q.y; room = -1; }
  }
  if (gap >= within) return { x: 0, y: 0, k: 0 };
  const k = Math.min(1, (within - gap) / within);
  if (room >= 0) { const n = roomInward(m.rooms[room], x, y); return { x: n.x, y: n.y, k }; }
  const dx = cx - x, dy = cy - y, d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d, k };
}

/** The main-path room order the bots and the edge arrow follow (R0, R1, R3, R5, door). */
export const MAIN_ROOMS = [0, 1, 3, 5, DOOR_ROOM];

/**
 * H2c: where a room's rolled layout stands. Pillars and vents go on a ring round `x, y` at the arena's spacing scaled by
 * `r / ARENA`; a lava channel crosses through it. World.hallsLayouts drops any piece that would stand off the floor.
 */
export function layoutFrame(rm: HallsRoom): { x: number; y: number; r: number } {
  if (rm.shape === 'hall' && rm.parts) { const [x, y, hx] = (rm.parts[0] as { b: number[] }).b; return { x, y, r: hx }; }
  if (rm.shape === 'twin' && rm.parts) { const [x, y, r] = (rm.parts[0] as { c: number[] }).c; return { x, y, r }; }
  if (rm.shape === 'cross' || rm.shape === 'ring') return { x: rm.x, y: rm.y, r: rm.shape === 'ring' ? rm.r : 450 };
  return { x: rm.x, y: rm.y, r: rm.r };
}

// ---------------------------------------------------------------- H2c generator

/**
 * Design's room sizes (h2-plan.md, H2c "Rooms"): round radius 390-550, hall 700-900 long by 420-520 wide (long axis
 * north-south), cross a 900 box with four 200-square pillars set 120 in from its walls (260-wide arms between them,
 * a loop round each), ring radius 520 round a 160 hearth island, twin two rounds of
 * radius 360-420 meeting in a 300-wide gap. Corridors 300-700 (main path; design's length rule keeps them short) and
 * east-west ones 300-400. Doorways end `port` inside a room's wall.
 */
export const HALLS_GEN = {
  round: [390, 550] as [number, number],
  hallLen: [700, 900] as [number, number],
  hallWide: [420, 520] as [number, number],
  crossBox: 900,
  /** The cross's four pillars: this square, set this far in from the walls (so the arms between them are 260 wide). */
  pillar: 200,
  pillarIn: 120,
  ring: 520,
  island: 160,
  twin: [360, 420] as [number, number],
  twinGap: 300,
  /** Main-path corridors (rim to rim) and side ones (east-west). */
  corridor: [300, 600] as [number, number],
  sideCorridor: [300, 400] as [number, number],
  /** A main corridor's sideways drift, at most this share of its length (they run mostly north-south). */
  drift: 0.35,
  port: 40,
  /** The boss door's alcove: its radius, and the gap from the door guard's room to it (as the template). */
  alcove: 130,
  alcoveGap: 26,
  /** The door guard stands this far inside the doorway to the boss door. */
  guardIn: 156,
  /** Design's checker (h2-plan.md, H2c "Rules"). */
  walk: [3600, 5600] as [number, number],
  roomGap: 80,
  cOff: 260,
  packApart: 700,
  minAcross: 420,
  tries: 400,
};

const G = HALLS_GEN;

/** A room as the generator lays it out: where its path axis stands, and how far its wall is on each side of it. */
interface GenRoom {
  room: HallsRoom;
  ax: number;
  ay: number;
  ext: { n: number; s: number; e: number; w: number };
  /** A twin's C half is on this side (+1 east, -1 west): nothing branches off that side. */
  cSide?: number;
  /** Where its pack stands (a twin's C half holds `spot2`). */
  spot: [number, number];
  spot2?: [number, number];
}

const loop = (x: number, y: number, r: number, n = 48): number[] => {
  const out: number[] = [];
  for (let k = 0; k < n; k++) { const a = (k / n) * 2 * Math.PI; out.push(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r)); }
  return out;
};

/** Builds room `shape` with its path axis at (0, 0); shiftRoom moves it into place. */
function genRoom(id: string, main: boolean, shape: RoomShape, rnd: () => number, o: { r?: [number, number]; cSide?: number; spotSide?: number } = {}): GenRoom {
  const lerp = (lh: [number, number]) => Math.round(lh[0] + (lh[1] - lh[0]) * rnd());
  if (shape === 'hall') {
    const hy = lerp(G.hallLen) / 2, hx = lerp(G.hallWide) / 2;
    return {
      room: { id, main, shape, x: 0, y: 0, r: Math.hypot(hx, hy), parts: [{ b: [0, 0, hx, hy] }], edge: [[-hx, -hy, hx, -hy, hx, hy, -hx, hy]], nav: [[0, 0]] },
      ax: 0, ay: 0, ext: { n: hy, s: hy, e: hx, w: hx }, spot: [0, 0],
    };
  }
  if (shape === 'cross') {
    // Design, 25 Nov: a box with four free-standing pillars, so the open floor reads as a cross with a loop round every
    // pillar (no dead-end arms). The arms between the pillars are crossArm wide.
    const H = G.crossBox / 2, P = G.pillar / 2, c = H - G.pillarIn - P, band = H - G.pillarIn / 2;
    const holes: RoomPart[] = [], edge: number[][] = [[-H, -H, H, -H, H, H, -H, H]], nav: [number, number][] = [[0, 0]];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      holes.push({ b: [sx * c, sy * c, P, P] });
      edge.push([sx * c - P, sy * c - P, sx * c + P, sy * c - P, sx * c + P, sy * c + P, sx * c - P, sy * c + P]);
      nav.push([sx * band, sy * band]);
    }
    nav.push([band, 0], [-band, 0], [0, band], [0, -band]);
    return { room: { id, main, shape, x: 0, y: 0, r: Math.hypot(H, H), parts: [{ b: [0, 0, H, H] }], holes, edge, nav }, ax: 0, ay: 0, ext: { n: H, s: H, e: H, w: H }, spot: [0, 0] };
  }
  if (shape === 'ring') {
    const R = G.ring, I = G.island, mid = (R + I) / 2;
    const nav: [number, number][] = [];
    for (let k = 0; k < 8; k++) { const a = (k / 8) * 2 * Math.PI; nav.push([Math.round(Math.cos(a) * mid), Math.round(Math.sin(a) * mid)]); }
    const side = o.spotSide ?? 1;
    return {
      room: { id, main, shape, x: 0, y: 0, r: R, holes: [{ c: [0, 0, I] }], edge: [loop(0, 0, R), loop(0, 0, I, 24)], nav },
      ax: 0, ay: 0, ext: { n: R, s: R, e: R, w: R }, spot: [side * mid, 0],
    };
  }
  if (shape === 'twin') {
    const r1 = lerp(G.twin), r2 = lerp(G.twin), cs = o.cSide ?? 1, h = G.twinGap / 2;
    const d1 = Math.sqrt(r1 * r1 - h * h), d2 = Math.sqrt(r2 * r2 - h * h), D = d1 + d2;
    const a = Math.atan2(h, d1), b = Math.atan2(h, d2);
    const edge: number[] = [];
    for (let k = 0; k <= 32; k++) { const t = a + ((2 * Math.PI - 2 * a) * k) / 32; edge.push(Math.round(cs * r1 * Math.cos(t)), Math.round(r1 * Math.sin(t))); }
    for (let k = 1; k < 32; k++) { const t = -(Math.PI - b) + ((2 * (Math.PI - b)) * k) / 32; edge.push(Math.round(cs * (D + r2 * Math.cos(t))), Math.round(r2 * Math.sin(t))); }
    const lo = -r1, hi = D + r2;
    return {
      room: {
        id, main, shape, x: (cs * (lo + hi)) / 2, y: 0, r: (hi - lo) / 2, parts: [{ c: [0, 0, r1] }, { c: [cs * D, 0, r2] }],
        edge: [edge], nav: [[0, 0], [cs * D, 0], [Math.round(cs * d1), 0]],
      },
      ax: 0, ay: 0, cSide: cs, ext: { n: r1, s: r1, e: cs > 0 ? hi : r1, w: cs > 0 ? r1 : hi }, spot: [0, 0], spot2: [cs * D, 0],
    };
  }
  const r = lerp(o.r ?? G.round);
  return { room: { id, main, shape: 'round', x: 0, y: 0, r, edge: [loop(0, 0, r)], nav: [[0, 0]] }, ax: 0, ay: 0, ext: { n: r, s: r, e: r, w: r }, spot: [0, 0] };
}

function shiftRoom(g: GenRoom, dx: number, dy: number): GenRoom {
  const rm = g.room;
  rm.x += dx; rm.y += dy;
  rm.parts = rm.parts?.map((p) => ('c' in p ? { c: [p.c[0] + dx, p.c[1] + dy, p.c[2]] } : { b: [p.b[0] + dx, p.b[1] + dy, p.b[2], p.b[3]] }));
  rm.holes = rm.holes?.map((p) => ('c' in p ? { c: [p.c[0] + dx, p.c[1] + dy, p.c[2]] } : { b: [p.b[0] + dx, p.b[1] + dy, p.b[2], p.b[3]] }));
  rm.edge = rm.edge?.map((l) => l.map((v, i) => Math.round(v + (i % 2 ? dy : dx))));
  rm.nav = rm.nav?.map(([x, y]) => [x + dx, y + dy]);
  g.ax += dx; g.ay += dy;
  g.spot = [g.spot[0] + dx, g.spot[1] + dy];
  if (g.spot2) g.spot2 = [g.spot2[0] + dx, g.spot2[1] + dy];
  return g;
}

type Side = 'n' | 's' | 'e' | 'w';
/** The point just inside room g's doorway on side `side` (on its path axis). */
const port = (g: GenRoom, side: Side): [number, number] => {
  const k = g.ext[side] - G.port;
  return side === 'n' ? [g.ax, g.ay - k] : side === 's' ? [g.ax, g.ay + k] : side === 'e' ? [g.ax + k, g.ay] : [g.ax - k, g.ay];
};

export interface GenMap {
  rooms: HallsRoom[];
  corridors: HallsCorridor[];
  spots: Spot[];
  door: { x: number; y: number };
  layoutRooms: { room: number; slot: number }[];
  /** Which roll passed the checker (0 = the first). */
  tries: number;
}

/** One roll of the layout from `rnd`, in the template's room order: R0 entrance, R1 (A), R2 (S), R3 (B, C), R4 (D), R5 (E), door. */
function genOnce(rnd: () => number): GenMap {
  const pick = <T>(list: T[]): T => list[Math.floor(rnd() * list.length)];
  const sgn = () => (rnd() < 0.5 ? -1 : 1);
  const len = (lh: [number, number]) => lh[0] + (lh[1] - lh[0]) * rnd();
  const anyShape: RoomShape[] = ['round', 'hall', 'cross', 'ring'];
  const r0 = genRoom('R0', true, pick<RoomShape>(['round', 'round', 'hall']), rnd, { r: [390, 450] });
  const r1 = genRoom('R1', true, pick(anyShape), rnd, { spotSide: sgn() });
  const cs = sgn();
  // B and C share a room: a round one big enough for C to stand 260 off the walk and B's foes outside C's pull, or a twin.
  const r3 = genRoom('R3', true, pick<RoomShape>(['round', 'twin']), rnd, { r: [530, 550], cSide: cs });
  const r5 = genRoom('R5', true, pick(anyShape), rnd, { spotSide: sgn() });
  const sSide = sgn();
  const r2 = genRoom('R2', false, pick(anyShape), rnd, { r: [390, 500], spotSide: sSide });
  const r4 = genRoom('R4', false, pick(anyShape), rnd, { r: [390, 500], spotSide: -cs });
  // The main path, south to north (north is -y), each room's axis drifting a little from the last.
  const chain = [r0, r1, r3, r5];
  for (let k = 1; k < chain.length; k++) {
    const a = chain[k - 1], b = chain[k];
    const gap = len(G.corridor);
    const drift = (rnd() * 2 - 1) * gap * G.drift;
    shiftRoom(b, a.ax + drift, a.ay - a.ext.n - gap - b.ext.s);
  }
  // Side rooms: S off A's room (either side), D off B and C's room on the side away from C.
  const branch = (parent: GenRoom, child: GenRoom, side: number) => {
    const gap = len(G.sideCorridor);
    const out = side > 0 ? parent.ext.e : parent.ext.w, back = side > 0 ? child.ext.w : child.ext.e;
    shiftRoom(child, parent.ax + side * (out + gap + back), parent.ay);
  };
  branch(r1, r2, sSide);
  branch(r3, r4, -cs);
  const doorY = r5.ay - r5.ext.n - G.alcoveGap - G.alcove;
  const alcove: HallsRoom = { id: 'door', main: true, shape: 'round', x: r5.ax, y: doorY, r: G.alcove, edge: [loop(r5.ax, doorY, G.alcove, 24)], nav: [[r5.ax, doorY]] };
  const rooms = [r0.room, r1.room, r2.room, r3.room, r4.room, r5.room, alcove];
  const cor = (a: number, b: number, pa: [number, number], pb: [number, number]): HallsCorridor => ({ a, b, ax: pa[0], ay: pa[1], bx: pb[0], by: pb[1] });
  const sideOut: Side = sSide > 0 ? 'e' : 'w', sideIn: Side = sSide > 0 ? 'w' : 'e';
  const dOut: Side = -cs > 0 ? 'e' : 'w', dIn: Side = -cs > 0 ? 'w' : 'e';
  const corridors = [
    cor(0, 1, port(r0, 'n'), port(r1, 's')),
    cor(1, 3, port(r1, 'n'), port(r3, 's')),
    cor(1, 2, port(r1, sideOut), port(r2, sideIn)),
    cor(3, 4, port(r3, dOut), port(r4, dIn)),
    cor(3, 5, port(r3, 'n'), port(r5, 's')),
    cor(5, 6, port(r5, 'n'), [r5.ax, doorY]),
  ];
  // B and C: a twin's halves, or in a round room B just south of the middle and C across, north and to its side.
  let B: [number, number], C: [number, number];
  if (r3.spot2) { B = r3.spot; C = r3.spot2; }
  else { const r = r3.room.r; B = [r3.ax - cs * 0.15 * r, r3.ay + 0.5 * r]; C = [r3.ax + cs * 0.6 * r, r3.ay - 0.5 * r]; }
  const spots: Spot[] = [
    { role: 'A', room: 1, x: r1.spot[0], y: r1.spot[1] },
    { role: 'S', room: 2, x: r2.spot[0], y: r2.spot[1] },
    { role: 'B', room: 3, x: B[0], y: B[1] },
    { role: 'C', room: 3, x: C[0], y: C[1] },
    { role: 'D', room: 4, x: r4.spot[0], y: r4.spot[1] },
    { role: 'E', room: 5, x: r5.ax, y: r5.ay - r5.ext.n + G.guardIn },
  ];
  for (const s of spots) { s.x = Math.round(s.x); s.y = Math.round(s.y); }
  return { rooms, corridors, spots, door: { x: r5.ax, y: doorY }, layoutRooms: [{ room: 1, slot: 0 }, { room: 3, slot: 1 }, { room: 5, slot: 3 }], tries: 0 };
}

/** Roll `t` of seed `seed`'s layout (before the checker). */
export function genRoll(seed: number, t: number): GenMap {
  let k = 0;
  const g = genOnce(() => hash(seed ^ 0x47656e48, t * 4096 + k++) / 4294967296);
  g.tries = t;
  return g;
}

/** What design's checker finds wrong with a roll ([] = it passes). */
export const genFaults = (g: GenMap): string[] => hallsCheck({ rooms: g.rooms, corridors: g.corridors, door: g.door, packs: g.spots, layoutRooms: g.layoutRooms });

/**
 * H2c: this seed's map. Rolls a layout from hashes of the seed alone (the run's rng is untouched, so co-op stays in step)
 * and re-rolls until design's checker passes; after HALLS_GEN.tries it falls back to the template.
 */
export function genHalls(seed: number): GenMap {
  for (let t = 0; t < G.tries; t++) {
    const g = genRoll(seed, t);
    if (!genFaults(g).length) return g;
  }
  const T = KILN_HALLS_A;
  return { rooms: T.rooms.map((r) => ({ ...r })), corridors: T.corridors.map((c) => ({ ...c })), spots: T.packs.map((s) => ({ ...s })), door: { ...T.door }, layoutRooms: T.layoutRooms.map((l) => ({ ...l })), tries: -1 };
}

/** The highest gap of room `rm`'s floor along the segment (sampled every 20): below 0, the segment stays out of it. */
function segRoomGap(rm: HallsRoom, x1: number, y1: number, x2: number, y2: number): number {
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 20));
  let worst = -Infinity;
  for (let k = 0; k <= n; k++) worst = Math.max(worst, roomGap(rm, x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n));
  return worst;
}

function segSeg(a: { x1: number; y1: number; x2: number; y2: number }, b: { x1: number; y1: number; x2: number; y2: number }): number {
  const n = 24;
  let best = Infinity;
  for (let k = 0; k <= n; k++) {
    const x = a.x1 + ((a.x2 - a.x1) * k) / n, y = a.y1 + ((a.y2 - a.y1) * k) / n;
    const q = segClosest(x, y, b.x1, b.y1, b.x2, b.y2);
    best = Math.min(best, Math.hypot(x - q.x, y - q.y));
  }
  return best;
}

/**
 * Design's checker (h2-plan.md, H2c "Rules"): every way the map breaks a rule, or [] when it passes. Rooms never overlap
 * (80 apart; the door alcove sits at its gap); every corridor clears every other room and corridor by 80; corridors are
 * 300-700 rim to rim (east-west ones at most 400, main ones mostly north-south); the walk from the entrance to the boss
 * door is 3,600-5,600; C stands 260 off that walk; packs in different rooms are 700 apart; the door guard's ring spans
 * the doorway to the boss door; A, B, C and E stand on reachable floor with room for their foes; layout rooms are 420
 * across.
 */
export function hallsCheck(m: HallsGeo & { door: { x: number; y: number }; packs: Spot[]; layoutRooms: { room: number; slot: number }[] }): string[] {
  const out: string[] = [];
  const R = m.rooms;
  for (let i = 0; i < R.length; i++) {
    for (let j = i + 1; j < R.length; j++) {
      const min = i === DOOR_ROOM || j === DOOR_ROOM ? G.alcoveGap - 6 : G.roomGap;
      const pts = (rm: HallsRoom) => rm.edge?.[0] ?? loop(rm.x, rm.y, rm.r);
      let worst = -Infinity;
      const pi = pts(R[i]), pj = pts(R[j]);
      for (let k = 0; k < pi.length; k += 2) worst = Math.max(worst, roomGap(R[j], pi[k], pi[k + 1]));
      for (let k = 0; k < pj.length; k += 2) worst = Math.max(worst, roomGap(R[i], pj[k], pj[k + 1]));
      if (worst > -min) out.push(`rooms ${R[i].id} and ${R[j].id} are ${Math.round(-worst)} apart`);
    }
  }
  const ends = m.corridors.map((c) => corridorEnds(m, c));
  m.corridors.forEach((c, i) => {
    const e = ends[i];
    R.forEach((rm, j) => {
      if (j === c.a || j === c.b) return;
      const g = segRoomGap(rm, e.x1, e.y1, e.x2, e.y2);
      if (g > -(HALLS.corridor / 2 + G.roomGap)) out.push(`corridor ${R[c.a].id}-${R[c.b].id} passes ${Math.round(-g - HALLS.corridor / 2)} from ${rm.id}`);
    });
    m.corridors.forEach((o, k) => {
      if (k <= i || o.a === c.a || o.a === c.b || o.b === c.a || o.b === c.b) return;
      const d = segSeg(e, ends[k]);
      if (d < HALLS.corridor + G.roomGap) out.push(`corridors ${R[c.a].id}-${R[c.b].id} and ${R[o.a].id}-${R[o.b].id} are ${Math.round(d - HALLS.corridor)} apart`);
    });
    if (c.b === DOOR_ROOM || c.a === DOOR_ROOM) return;
    // Rim to rim: the part of the centre line outside both its rooms.
    const n = Math.ceil(Math.hypot(e.x2 - e.x1, e.y2 - e.y1) / 10);
    let open = 0;
    for (let k = 0; k < n; k++) {
      const x = e.x1 + ((e.x2 - e.x1) * (k + 0.5)) / n, y = e.y1 + ((e.y2 - e.y1) * (k + 0.5)) / n;
      if (roomGap(R[c.a], x, y) < 0 && roomGap(R[c.b], x, y) < 0) open += Math.hypot(e.x2 - e.x1, e.y2 - e.y1) / n;
    }
    const ew = Math.abs(e.x2 - e.x1) > Math.abs(e.y2 - e.y1);
    const max = ew ? 400 : 700;
    if (open < 300 - 15 || open > max + 15) out.push(`corridor ${R[c.a].id}-${R[c.b].id} is ${Math.round(open)} long`);
    if (!ew && R[c.a].main && R[c.b].main && Math.abs(e.x2 - e.x1) > 0.45 * Math.abs(e.y2 - e.y1)) out.push(`corridor ${R[c.a].id}-${R[c.b].id} runs too far east-west`);
  });
  const start = R[0];
  const line = hallsWalkLine(m, start.x, start.y, m.door.x, m.door.y);
  let walk = 0;
  for (let k = 1; k < line.length; k++) walk += Math.hypot(line[k].x - line[k - 1].x, line[k].y - line[k - 1].y);
  if (walk < G.walk[0] || walk > G.walk[1]) out.push(`the walk is ${Math.round(walk)}`);
  const pk = (role: PackRole) => m.packs.find((p) => p.role === role)!;
  const C = pk('C');
  let off = Infinity;
  for (let k = 1; k < line.length; k++) { const q = segClosest(C.x, C.y, line[k - 1].x, line[k - 1].y, line[k].x, line[k].y); off = Math.min(off, Math.hypot(C.x - q.x, C.y - q.y)); }
  if (off < G.cOff) out.push(`C stands ${Math.round(off)} off the walk`);
  for (let i = 0; i < m.packs.length; i++) {
    for (let j = i + 1; j < m.packs.length; j++) {
      const a = m.packs[i], b = m.packs[j];
      if (a.room === b.room) continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < G.packApart) out.push(`packs ${a.role} and ${b.role} are ${Math.round(d)} apart`);
    }
  }
  // The door guard: both edges of the doorway to the boss door stand inside its ring.
  const dc = m.corridors.find((c) => c.a === DOOR_ROOM || c.b === DOOR_ROOM);
  const E = pk('E');
  if (dc) {
    const e = corridorEnds(m, dc), rm = R[dc.a === DOOR_ROOM ? dc.b : dc.a];
    const vx = e.x2 - e.x1, vy = e.y2 - e.y1, l = Math.hypot(vx, vy) || 1;
    // Walk out along the corridor to the room's wall: the doorway.
    let t = 0;
    while (t < l && roomGap(rm, e.x1 + (vx / l) * t, e.y1 + (vy / l) * t) >= 0) t += 2;
    const mx = e.x1 + (vx / l) * t, my = e.y1 + (vy / l) * t, hw = HALLS.corridor / 2;
    for (const s of [-1, 1]) {
      const d = Math.hypot(mx - (vy / l) * hw * s - E.x, my + (vx / l) * hw * s - E.y);
      if (d > HALLS.reach - 10) out.push(`the door guard can be walked round (${Math.round(d)} to the doorway's edge)`);
    }
  }
  const foeRoom = HALLS.spread * 1.25 + 30;
  for (const p of m.packs) {
    const g = roomGap(R[p.room], p.x, p.y);
    if (g < foeRoom) out.push(`pack ${p.role} has ${Math.round(g)} of floor round it`);
    if (roomPath(m, 0, p.room).length < 2 && p.room !== 0) out.push(`pack ${p.role} can't be reached`);
  }
  for (const { room } of m.layoutRooms) {
    const rm = R[room];
    let across = 2 * rm.r;
    if (rm.shape === 'hall' && rm.parts) { const b = (rm.parts[0] as { b: number[] }).b; across = 2 * Math.min(b[2], b[3]); }
    if (across < G.minAcross) out.push(`layout room ${rm.id} is ${Math.round(across)} across`);
  }
  if (roomAt(m, start.x, start.y, 30) !== 0) out.push('the entrance has no floor at its centre');
  return out;
}

// ---------------------------------------------------------------- H2d themes

/** Which themes suit which shape (design's h2-plan.md, H2d table "Fits"). */
const THEME_FITS: Record<RoomShape, RoomTheme[]> = {
  round: ['ash', 'slag', 'cooling'],
  hall: ['ash', 'bellows'],
  cross: ['slag', 'ash'],
  ring: ['cooling', 'ash'],
  twin: ['bellows', 'ash'],
};

/**
 * H2d: rolls each room's theme (design's h2-plan.md, H2d), from hashes of the seed alone. R2 (S, the shrine or named
 * room) is the Kiln shrine, and the shrine is nowhere else. The door guard's room is always the Slag channel, the
 * hottest look before the boss. A room that rolled the lava layout is a Slag channel and one that rolled vents a Cooling
 * yard, unless a neighbour already has it; any other room takes a theme that fits its shape. No two rooms joined by a
 * corridor share a theme. `layout(room)` is the layout the room rolled (World.hallsLayouts).
 */
export function hallsThemes(m: HallsGeo, seed: number, layout: (room: number) => string | undefined): void {
  const R = m.rooms;
  const near = (i: number) => m.corridors.flatMap((c) => (c.a === i ? [c.b] : c.b === i ? [c.a] : []));
  const free = (i: number, t: RoomTheme) => near(i).every((j) => R[j].theme !== t);
  for (const r of R) r.theme = undefined;
  R[2].theme = 'shrine';
  R[5].theme = 'slag';
  for (const i of [3, 1, 4, 0, DOOR_ROOM]) {
    const lay = layout(i);
    const want: RoomTheme | undefined = lay === 'channel' ? 'slag' : lay === 'vents' ? 'cooling' : undefined;
    if (want && free(i, want)) { R[i].theme = want; continue; }
    const fits = (i === DOOR_ROOM ? ['bellows' as RoomTheme] : THEME_FITS[R[i].shape ?? 'round']).filter((t) => free(i, t));
    const rest = (['ash', 'bellows', 'slag', 'cooling'] as RoomTheme[]).filter((t) => free(i, t));
    const pool = fits.length ? fits : rest;
    R[i].theme = pool[hash(seed ^ 0x54686d65, i) % pool.length];
  }
}
