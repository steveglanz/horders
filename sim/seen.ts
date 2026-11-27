/**
 * Phase 15 Y4 (docs/design/roadmap.md, "Seen log"): what a hero has met in each dungeon. That covers the
 * boss's versions, the wave shapes, the named foe's traits, the arena events and the day's Heats. It is kept on the hero
 * save, shared by every class like the collection book. The end screen marks what a run met for the
 * first time, and the hub lists what each dungeon still has to show.
 *
 * A key is `${dungeon}:${kind}:${id}`. A run counts only what it actually met. The boss version counts
 * once the boss has rolled it. A named foe counts once it has spawned. An arena event counts once its
 * warning has gone off. The Heat counts once the run has started with it. Read-only on the World, so a
 * co-op guest reads the same from the host's snapshot.
 *
 * New foes (Phase 16 U2) count once one has spawned (World.foesMet).
 * Echoes (Phase 16 U3) count once the echo has gone off (World.echoMet), not when it is only rolled.
 * Wave shapes (Y1) count from World.wavesMet: a pincer or ring when its fight starts, reinforcements when they
 * warn. Y3's third boss versions show up here by themselves once they are in their *_VARIANTS list.
 */
import { DUNGEONS, ENCOUNTERS, type DungeonId } from './content/dungeon';
import { ENEMIES, type EnemyKind } from './content/enemies';
import { HEATS, HEAT_POOLS, type HeatId } from './content/heat';
import { AFFIXES, AFFIX_TIP } from './content/named';
import type { HeroProfile } from './hero';
import { BOSS_VERSION_NAME } from './runshape';
import {
  ARENA_EVENT_INFO, ARENA_EVENT_ORDER, ARENA_EVENT_POOLS, type World, WAVE_SHAPE_INFO, STIR_IDS, STIR_INFO, STIR_BIT, type StirId, reinforceCount, wavesIn, type WaveShape,
  KILN_VARIANTS, MAELRA_VARIANTS, LENS_VARIANTS, NHEVRA_VARIANTS, HESSA_VARIANTS, ONDREL_VARIANTS, YSMERET_VARIANTS,
  OSKEL_VARIANTS, SLAG_VARIANTS, VORHULM_VARIANTS, COLOSSUS_VARIANTS, REGENT_VARIANTS, MAELRA_ECHOES, ECHO, NEW_FOES, NEW_FOE_BIT,
} from './world';

export type SeenKind = 'boss' | 'echo' | 'foe' | 'wave' | 'mark' | 'event' | 'stir' | 'heat';
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
export const SEEN_KIND_NAME: Record<SeenKind, string> = { boss: 'Boss versions', echo: 'Old Tricks', foe: 'New foes', wave: 'Wave shapes', mark: 'Named foe traits', event: 'Arena events', stir: 'The Hoard stirs', heat: "The Court's Moods" };

export const seenKey = (dungeon: DungeonId, kind: SeenKind, id: string): SeenKey => `${dungeon}:${kind}:${id}`;

/** Everything `dungeon` can show a hero, in hub order. */
export function seenPool(dungeon: DungeonId): SeenEntry[] {
  const boss = DUNGEONS[dungeon].boss;
  const out: SeenEntry[] = BOSS_VERSIONS[dungeon].map((id) => ({ kind: 'boss' as const, id, name: BOSS_VERSION_NAME[id] ?? id, tip: `How ${ENCOUNTERS[boss].name.split(',')[0]} fights in this version` }));
  const who = ENCOUNTERS[boss].name.split(',')[0];
  for (const v of echoesPossible(dungeon)) out.push({ kind: 'echo', id: v, name: BOSS_VERSION_NAME[v] ?? v, tip: `From tier ${ECHO.minTier}, ${who} can fall back on this version's move late in the fight, an old trick` });
  for (const k of foesPossible(dungeon)) out.push({ kind: 'foe', id: k, name: ENEMIES[k].name, tip: ENEMIES[k].title ?? ENEMIES[k].name });
  for (const v of wavesPossible(dungeon)) out.push({ kind: 'wave', id: v, name: WAVE_SHAPE_INFO[v].name, tip: WAVE_SHAPE_INFO[v].tip });
  for (const a of AFFIXES) out.push({ kind: 'mark', id: a, name: a, tip: AFFIX_TIP[a] });
  for (const e of ARENA_EVENT_POOLS[dungeon] ?? []) out.push({ kind: 'event', id: e, name: ARENA_EVENT_INFO[e].name, tip: ARENA_EVENT_INFO[e].tip });
  for (const v of stirsPossible(dungeon)) out.push({ kind: 'stir', id: v, name: STIR_INFO[v].name, tip: STIR_INFO[v].tip });
  for (const h of HEAT_POOLS[dungeon] ?? []) out.push({ kind: 'heat', id: h, name: HEATS[h].name, tip: HEATS[h].text });
  return out;
}

/**
 * Phase 16 U1/U3: the versions `dungeon`'s boss can echo (World.rollEcho picks one that isn't the rolled version). Every
 * version can, except that Maelra echoes only her lasting ones (MAELRA_ECHOES).
 */
export function echoesPossible(dungeon: DungeonId): readonly string[] {
  return dungeon === 'foundry' ? MAELRA_ECHOES : BOSS_VERSIONS[dungeon];
}

/** Phase 16 U2/U3: the new foes (NEW_FOES) a trash fight on `dungeon`'s route can spawn. */
export function foesPossible(dungeon: DungeonId): readonly EnemyKind[] {
  const defs = trashFights(dungeon);
  return NEW_FOES.filter((k) => defs.some((e) => e.spawns.some((x) => x.kind === k)));
}

/**
 * Y1's wave shapes `dungeon` can roll (World.waveShapeAt): none in a raid; a pincer or ring where a trash fight on
 * its route has two or more foes and no Twin Lamps; reinforcements where one has pack foes to hold back.
 */
export function wavesPossible(dungeon: DungeonId): Exclude<WaveShape, 'arc'>[] {
  const d = DUNGEONS[dungeon];
  if (d.raid) return [];
  const defs = trashFights(dungeon);
  const out: Exclude<WaveShape, 'arc'>[] = [];
  if (defs.some((e) => e.spawns.reduce((a, x) => a + x.n, 0) >= 2 && !e.spawns.some((x) => x.kind === 'twinLamp'))) out.push('pincer', 'ring');
  if (defs.some((e) => reinforceCount(e.spawns) > 0)) out.push('reinforce');
  return out;
}

/**
 * Y10's reactions `dungeon` can stir (World.stirChoices): none in a raid; another foe or a named one where a trash
 * fight has an elite; an arena event where the dungeon has events; a closing wave where a fight has two or more foes
 * and no Twin Lamps. Stirring needs tier 4 or higher, which every dungeon can be played at.
 */
export function stirsPossible(dungeon: DungeonId): StirId[] {
  const d = DUNGEONS[dungeon];
  if (d.raid) return [];
  const defs = trashFights(dungeon);
  const can: Record<StirId, boolean> = {
    elite: defs.some((e) => e.spawns.some((x) => ENEMIES[x.kind].rank === 'elite')),
    named: defs.some((e) => e.spawns.some((x) => ENEMIES[x.kind].rank === 'elite')),
    event: !!ARENA_EVENT_POOLS[dungeon]?.length,
    wave: defs.some((e) => e.spawns.reduce((a, x) => a + x.n, 0) >= 2 && !e.spawns.some((x) => x.kind === 'twinLamp')),
  };
  return STIR_IDS.filter((v) => can[v]);
}

function trashFights(dungeon: DungeonId) {
  const d = DUNGEONS[dungeon];
  return [...new Set([...d.openers, ...d.named, ...d.hard])]
    .filter((id) => id !== d.boss && id !== 'shrine' && id !== 'worldShadow')
    .map((id) => ENCOUNTERS[id]).filter((e) => !!e);
}

/** What this run met, as Seen keys (no rng, no state changes). */
export function metIn(w: World): SeenKey[] {
  const d = w.dungeonId;
  const out: SeenKey[] = [];
  if (w.bossVariant) out.push(seenKey(d, 'boss', w.bossVariant));
  if (w.echoMet && w.bossEcho) out.push(seenKey(d, 'echo', w.bossEcho));
  for (const k of NEW_FOES) if (w.foesMet & (NEW_FOE_BIT[k] ?? 0)) out.push(seenKey(d, 'foe', k));
  for (const v of wavesIn(w.wavesMet)) out.push(seenKey(d, 'wave', v));
  if (w.namedMet >= 0 && AFFIXES[w.namedMet]) out.push(seenKey(d, 'mark', AFFIXES[w.namedMet]));
  ARENA_EVENT_ORDER.forEach((e, k) => { if (w.arenaEventsMet & (1 << k)) out.push(seenKey(d, 'event', e)); });
  for (const v of STIR_IDS) if (w.stirsMet & STIR_BIT[v]) out.push(seenKey(d, 'stir', v));
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
