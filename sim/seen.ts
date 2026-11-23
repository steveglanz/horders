/**
 * Phase 15 Y4 (docs/design/roadmap.md, "Seen log"): what a hero has met in each dungeon. That covers the
 * boss's versions, the named foe's traits, the arena events and the day's Heats. It is kept on the hero
 * save, shared by every class like the collection book. The end screen marks what a run met for the
 * first time, and the hub lists what each dungeon still has to show.
 *
 * A key is `${dungeon}:${kind}:${id}`. A run counts only what it actually met. The boss version counts
 * once the boss has rolled it. A named foe counts once it has spawned. An arena event counts once its
 * warning has gone off. The Heat counts once the run has started with it. Read-only on the World, so a
 * co-op guest reads the same from the host's snapshot.
 *
 * Y1 (wave shapes) and Y3 (third boss versions) add ids: a new boss version goes in its *_VARIANTS list
 * and shows up here by itself, and a wave shape needs a 'wave' entry in POOLS below.
 */
import { DUNGEONS, ENCOUNTERS, type DungeonId } from './content/dungeon';
import { HEATS, HEAT_POOLS, type HeatId } from './content/heat';
import { AFFIXES, AFFIX_TIP } from './content/named';
import type { HeroProfile } from './hero';
import { BOSS_VERSION_NAME } from './runshape';
import {
  ARENA_EVENT_INFO, ARENA_EVENT_ORDER, ARENA_EVENT_POOLS, type World,
  KILN_VARIANTS, MAELRA_VARIANTS, LENS_VARIANTS, NHEVRA_VARIANTS, HESSA_VARIANTS, ONDREL_VARIANTS, YSMERET_VARIANTS,
  OSKEL_VARIANTS, SLAG_VARIANTS, VORHULM_VARIANTS, COLOSSUS_VARIANTS, REGENT_VARIANTS,
} from './world';

export type SeenKind = 'boss' | 'mark' | 'event' | 'heat';
export type SeenKey = string;

export interface SeenEntry {
  kind: SeenKind;
  id: string;
  /** Its name, as the run-shape chips and banners show it. */
  name: string;
  /** One line on what it does. */
  tip: string;
}

/** Each dungeon's boss versions (the list its roll picks from in sim/world.ts). */
export const BOSS_VERSIONS: Record<DungeonId, readonly string[]> = {
  kiln: KILN_VARIANTS, foundry: MAELRA_VARIANTS, glarewell: LENS_VARIANTS, coldmarrow: NHEVRA_VARIANTS, wrackline: HESSA_VARIANTS,
  hammerdeep: ONDREL_VARIANTS, ashvents: YSMERET_VARIANTS, pressworks: OSKEL_VARIANTS,
  crucible: SLAG_VARIANTS, hoard: VORHULM_VARIANTS, smeltery: COLOSSUS_VARIANTS, flue: REGENT_VARIANTS,
};

/** The section names, in the order the hub lists them. */
export const SEEN_KIND_NAME: Record<SeenKind, string> = { boss: 'Boss versions', mark: 'Named foe traits', event: 'Arena events', heat: 'Heats' };

export const seenKey = (dungeon: DungeonId, kind: SeenKind, id: string): SeenKey => `${dungeon}:${kind}:${id}`;

/** Everything `dungeon` can show a hero, in hub order. */
export function seenPool(dungeon: DungeonId): SeenEntry[] {
  const boss = DUNGEONS[dungeon].boss;
  const out: SeenEntry[] = BOSS_VERSIONS[dungeon].map((id) => ({ kind: 'boss' as const, id, name: BOSS_VERSION_NAME[id] ?? id, tip: `How ${ENCOUNTERS[boss].name.split(',')[0]} fights in this version` }));
  for (const a of AFFIXES) out.push({ kind: 'mark', id: a, name: a, tip: AFFIX_TIP[a] });
  for (const e of ARENA_EVENT_POOLS[dungeon] ?? []) out.push({ kind: 'event', id: e, name: ARENA_EVENT_INFO[e].name, tip: ARENA_EVENT_INFO[e].tip });
  for (const h of HEAT_POOLS[dungeon] ?? []) out.push({ kind: 'heat', id: h, name: HEATS[h].name, tip: HEATS[h].text });
  return out;
}

/** What this run met, as Seen keys (no rng, no state changes). */
export function metIn(w: World): SeenKey[] {
  const d = w.dungeonId;
  const out: SeenKey[] = [];
  if (w.bossVariant) out.push(seenKey(d, 'boss', w.bossVariant));
  if (w.namedMet >= 0 && AFFIXES[w.namedMet]) out.push(seenKey(d, 'mark', AFFIXES[w.namedMet]));
  ARENA_EVENT_ORDER.forEach((e, k) => { if (w.arenaEventsMet & (1 << k)) out.push(seenKey(d, 'event', e)); });
  if (w.heat && w.heat in HEATS) out.push(seenKey(d, 'heat', w.heat as HeatId));
  return out;
}

/** Adds `met` to the hero's Seen log and returns the keys that are new to it. */
export function recordSeen(hero: HeroProfile, met: SeenKey[]): SeenKey[] {
  const have = new Set(hero.seen ?? []);
  const fresh = [...new Set(met)].filter((k) => !have.has(k));
  if (fresh.length) hero.seen = [...have, ...fresh].sort();
  return fresh;
}

/** `dungeon`'s pool with whether the hero has met each, and the count. */
export function seenIn(hero: Pick<HeroProfile, 'seen'>, dungeon: DungeonId): { entries: (SeenEntry & { seen: boolean })[]; seen: number; total: number } {
  const have = new Set(hero.seen ?? []);
  const entries = seenPool(dungeon).map((e) => ({ ...e, seen: have.has(seenKey(dungeon, e.kind, e.id)) }));
  return { entries, seen: entries.filter((e) => e.seen).length, total: entries.length };
}
