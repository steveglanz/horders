/**
 * Co-op snapshots. The host's World is the only one that steps; it sends a
 * snapshot every few ticks and each guest copies it into a mirror World built
 * from the same options, then views it as their own hero with use(me).
 *
 * Generic on purpose: every number, boolean and string field on World is sent,
 * and every pooled array (objects with `alive`) is sent as its living entries,
 * so new sim fields reach guests without touching this file. Only enemy `def`
 * (a content reference) is rebuilt from `kind`.
 */
import { World, SimEvent, HeroSlotData } from './world';
import { ENEMIES } from './content/enemies';
import { ThreatTable } from './threat';

/** Pools sent as their living entries: [index, ...values in `keys` order]. */
export const POOLS = ['enemies', 'orbs', 'gems', 'zones', 'telegraphs', 'strikes', 'lances', 'drops', 'veins', 'cracks'] as const;
/**
 * Small arrays of plain data sent whole. A new array on World must go here, in POOLS, or in
 * NOT_SENT (tests/netsync-coverage.test.ts fails otherwise): the Hoard's embers once missed it.
 */
export const ARRAYS = ['omens', 'vents', 'gates', 'paths', 'route', 'coalEmbers', 'pillars', 'rafts', 'colDmg', 'regentDecree', 'stones', 'lava', 'flareVents', 'driftEmbers', 'islands', 'kmEggs', 'kmRings', 'slagPatches', 'lightMotes'] as const;
/**
 * Plain objects on World a guest draws from, sent whole alongside ARRAYS (QA, 25 Nov: BOSSV2's kmHeat never reached
 * guests, so they saw no burning or safe quarters). A new plain object goes here or in NOT_SENT.
 */
export const OBJECTS = ['kmHeat'] as const;
/** Arrays a snapshot carries in fields of their own (Snapshot.heroes, strikeOwner, bossThreat, events). */
export const SENT_APART = ['heroes', 'strikeOwner', 'threat', 'events'] as const;
/** Arrays on World that a guest never needs, and why. */
export const NOT_SENT: Record<string, string> = {
  head: 'spatial hash, rebuilt from enemies every step',
  next: 'spatial hash, rebuilt from enemies every step',
  // Per-hero fields of the hero swapped in: sent per hero through Snapshot.heroes (heroData).
  gear: 'per hero, fixed at the start from the start options',
  runDrops: 'per hero, sent in Snapshot.heroes',
  runEquipped: 'per hero, sent in Snapshot.heroes',
  choices: 'per hero, sent in Snapshot.heroes',
  // Plain objects (OBJECTS covers the sent ones).
  rng: 'the host rolls every random number',
  loadout: 'per hero, sent in Snapshot.heroes',
  classDef: 'per hero, fixed at the start from the class',
  passives: 'per hero, fixed at the start from the start options',
  talents: 'per hero, sent in Snapshot.heroes',
  player: 'per hero, sent in Snapshot.heroes',
  kmClock: 'BOSSV2 timers only the host steps; guests draw kmHeat, kmEggs and kmRings',
  kmSaid: 'CP3 Kiln Mother taunts: the host decides; guests get each line as a bossSay event',
  kmSayQ: 'CP3 Kiln Mother taunts waiting to be said: host only',
  halls: 'H4: the guest builds the same map from the start options; its moving parts ride in Snapshot.halls',
};
/** Fields a guest keeps for itself. */
const LOCAL = new Set(['acting', 'stress']);
/** Previous-position fields: the guest fills them from its last copy, for smooth motion. */
const PREV = new Set(['px', 'py', 'def']);

export interface Snapshot {
  tick: number;
  scalars: Record<string, number | boolean | string | null>;
  pools: Record<string, { keys: string[]; rows: unknown[][] }>;
  arrays: Record<string, unknown>;
  heroes: HeroSlotData[];
  /** Everything the host's sim emitted since the last snapshot, oldest first. */
  events: SimEvent[];
  /**
   * The host's events of its last RESEND_TICKS ticks, by the tick they came on. Snapshots go on an unordered channel with
   * no retransmits, and a guest draws only the newest one each frame, so one lost or skipped snapshot used to lose its
   * events (QA, 25 Nov: a guest heard 21 of the host's 22 Ysmeret flares). With `recent`, a guest plays each tick's events
   * once, from whichever snapshot brings them first, and ignores `events`.
   */
  recent?: { tick: number; events: SimEvent[] }[];
  /** Strike owners ride along with strikes (they live in a side array). */
  strikeOwner?: number[];
  /** The boss's threat table, so a guest's bossTarget, tauntCue and swapCue see who the boss is on. */
  bossThreat?: ThreatTable;
  /**
   * H4: a Halls map's moving parts. The guest builds the same map from the same start options (the generator only
   * hashes the seed), so only what changes is sent: each room's lock and lift clocks, each pack's state, the rooms
   * seen, and whether the map is done.
   */
  halls?: { lock: (number | null)[]; lifted: (number | null)[]; packs: string[]; seen: boolean[]; done: boolean };
}

type Bag = Record<string, unknown>;

/** How many host ticks of events every snapshot carries again (8 ticks is 4 snapshots, about a quarter second). */
export const RESEND_TICKS = 8;

/**
 * A guest keeps every snapshot's `recent` batches it hears until its next frame (heardEvents), so a frame that comes
 * more than RESEND_TICKS host ticks after the last one still plays them all (QA, 25 Nov: a slow guest frame dropped
 * 7 of 21 flares). It holds at most this many host ticks (2 s), so a tab coming back from the background doesn't play
 * a long backlog at once.
 */
export const EVENT_HOLD_TICKS = 60;

/**
 * Host, after each step: drops the event batches every guest has had their chance at. A batch goes once it is
 * RESEND_TICKS old and has ridden two snapshots (it came on or before `prevSentTick`, the tick of the snapshot before
 * the last one sent; -1 for none), so one lost snapshot never loses it. QA, 25 Nov: trimming by age alone lost a tick's
 * events when a host frame ran 8 or more ticks (a 250 ms hitch, one snapshot per frame), so guests heard 2 of 3 grate
 * lifts. Never kept past EVENT_HOLD_TICKS.
 */
export function trimRecent(batches: { tick: number }[], tick: number, prevSentTick: number): void {
  while (batches.length && (batches[0].tick <= tick - EVENT_HOLD_TICKS || (batches[0].tick <= tick - RESEND_TICKS && batches[0].tick <= prevSentTick))) batches.shift();
}

/** Guest, for every snapshot heard (newest or not): keeps its event batches by host tick for the next frame. */
export function heardEvents(heard: Map<number, SimEvent[]>, s: Snapshot): void {
  if (!s.recent) return;
  for (const b of s.recent) if (!heard.has(b.tick)) heard.set(b.tick, b.events);
  const newest = Math.max(...heard.keys());
  for (const t of [...heard.keys()]) if (t <= newest - EVENT_HOLD_TICKS) heard.delete(t);
}

/** Guest, at a frame: the newest snapshot, carrying every batch heard since the last frame (oldest first). */
export function withHeard(s: Snapshot, heard: Map<number, SimEvent[]>): Snapshot {
  if (!s.recent) return s;
  const recent = [...heard.entries()].sort((a, b) => a[0] - b[0]).map(([tick, events]) => ({ tick, events }));
  heard.clear();
  return { ...s, recent };
}

/** The last host tick whose events each guest mirror has played (see Snapshot.recent). */
const playedTo = new WeakMap<World, number>();

export function snapshot(w: World, events: SimEvent[] = [], recent?: Snapshot['recent']): Snapshot {
  const W = w as unknown as Bag;
  const scalars: Snapshot['scalars'] = {};
  for (const k of Object.keys(W)) {
    const v = W[k];
    if (LOCAL.has(k)) continue;
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' || v === null) scalars[k] = v as never;
  }
  const pools: Snapshot['pools'] = {};
  for (const name of POOLS) {
    const pool = W[name] as Bag[] | undefined;
    if (!pool?.length) continue;
    const keys = Object.keys(pool[0]).filter((k) => !PREV.has(k) && k !== 'alive');
    const rows: unknown[][] = [];
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (!o.alive) continue;
      const row: unknown[] = [i];
      for (const k of keys) row.push(typeof o[k] === 'number' ? Math.round((o[k] as number) * 100) / 100 : o[k]);
      rows.push(row);
    }
    pools[name] = { keys, rows };
  }
  const arrays: Snapshot['arrays'] = {};
  for (const name of ARRAYS) if (Array.isArray(W[name])) arrays[name] = W[name];
  for (const name of OBJECTS) if (W[name] && typeof W[name] === 'object') arrays[name] = W[name];
  const heroes = w.heroes.map((_, i) => w.heroData(i));
  const so = W.strikeOwner as Int8Array | undefined;
  const bossThreat = w.bossIndex >= 0 ? w.threat[w.bossIndex] : undefined;
  const m = w.halls;
  const halls = m
    ? { lock: m.rooms.map((r) => r.lock ?? null), lifted: m.rooms.map((r) => r.lifted ?? null), packs: m.packs.map((p) => p.state), seen: [...m.seen], done: m.done }
    : undefined;
  return { tick: w.tick, scalars, pools, arrays, heroes, events, ...(recent ? { recent } : {}), strikeOwner: so ? Array.from(so) : undefined, bossThreat, halls };
}

/**
 * Copies a snapshot into a guest's mirror World and views it as hero `me`.
 * JSON in and out (the network sends it as text), so nothing is shared with the host's objects.
 */
export function applySnapshot(w: World, s: Snapshot, me: number): void {
  const W = w as unknown as Bag;
  w.use(0);
  for (const k of Object.keys(s.scalars)) if (!LOCAL.has(k) && k in W) W[k] = s.scalars[k];
  for (const name of POOLS) {
    const pool = W[name] as Bag[] | undefined;
    const p = s.pools[name];
    if (!pool || !p) continue;
    const seen = new Uint8Array(pool.length);
    for (const row of p.rows) {
      const i = row[0] as number;
      const o = pool[i];
      if (!o) continue;
      seen[i] = 1;
      const was = o.alive;
      if ('px' in o) {
        o.px = was ? o.x : row[1 + p.keys.indexOf('x')];
        o.py = was ? o.y : row[1 + p.keys.indexOf('y')];
      }
      o.alive = true;
      for (let k = 0; k < p.keys.length; k++) o[p.keys[k]] = row[k + 1];
      if (name === 'enemies') o.def = ENEMIES[o.kind as keyof typeof ENEMIES];
    }
    for (let i = 0; i < pool.length; i++) if (!seen[i]) pool[i].alive = false;
  }
  for (const name of ARRAYS) if (name in s.arrays) W[name] = s.arrays[name];
  for (const name of OBJECTS) if (name in s.arrays) W[name] = s.arrays[name];
  s.heroes.forEach((h, i) => {
    const old = w.heroData(i).player;
    h.player.px = old.x;
    h.player.py = old.y;
    w.setHeroData(i, h);
  });
  const so = W.strikeOwner as Int8Array | undefined;
  if (so && s.strikeOwner) so.set(s.strikeOwner);
  if (s.bossThreat && w.bossIndex >= 0 && w.bossIndex < w.threat.length) w.threat[w.bossIndex] = JSON.parse(JSON.stringify(s.bossThreat));
  const m = w.halls;
  if (m && s.halls && s.halls.packs.length === m.packs.length) {
    m.rooms.forEach((r, i) => { r.lock = s.halls!.lock[i] ?? undefined; r.lifted = s.halls!.lifted[i] ?? undefined; });
    m.packs.forEach((p, i) => { p.state = s.halls!.packs[i] as typeof p.state; });
    m.seen = s.halls.seen;
    m.done = s.halls.done;
  }
  if (s.recent) {
    const from = playedTo.get(w) ?? -1;
    w.events = s.recent.filter((b) => b.tick > from).flatMap((b) => b.events);
    playedTo.set(w, Math.max(from, ...s.recent.map((b) => b.tick)));
  } else {
    w.events = s.events;
  }
  w.use(Math.min(me, w.heroes.length - 1));
}
