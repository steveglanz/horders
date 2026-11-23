/**
 * V4 variety (docs/design/variety.md): the Day's Heat, one gentle twist on a solo dungeon,
 * the same for everyone that day. V4 gave it to the Kiln at tiers 1 and 2; Phase 14 X1 gives
 * it to every solo dungeon at every tier, each from its own pool (HEAT_POOLS).
 * Pure: the client passes the day, the sim never reads the clock.
 */
import type { DungeonId } from './dungeon';

export type HeatId = 'stoneFloor' | 'ventFloor' | 'quickStudy' | 'richHaul' | 'thickSteam' | 'highSun' | 'brightCoal' | 'slackWater';

export interface HeatDef {
  id: HeatId;
  name: string;
  /** What it does, shown in the hub and the first fight's banner. */
  text: string;
}

export const HEATS: Record<HeatId, HeatDef> = {
  stoneFloor: { id: 'stoneFloor', name: 'Stone Floor', text: 'Every fight but the boss has stones that block the way.' },
  ventFloor: { id: 'ventFloor', name: 'Vent Floor', text: 'Every fight but the boss has vents that flare in turn.' },
  quickStudy: { id: 'quickStudy', name: 'Quick Study', text: 'Embers give 25% more experience.' },
  richHaul: { id: 'richHaul', name: 'Rich Haul', text: 'Better odds of good loot (+20% luck).' },
  // Phase 14 X1: one Heat of each later solo dungeon's own, a give and a take on its signature mechanic.
  thickSteam: { id: 'thickSteam', name: 'Thick Steam', text: 'Temper builds faster, and vents heal twice as much per stack.' },
  highSun: { id: 'highSun', name: 'High Sun', text: 'The Glare comes more often, and shadows reach farther.' },
  brightCoal: { id: 'brightCoal', name: 'Bright Coal', text: 'Your coal shines wider, and burns down faster.' },
  slackWater: { id: 'slackWater', name: 'Slack Water', text: 'Rafts drift slower, so they are easier to stay on.' },
};

export const HEAT_IDS = Object.keys(HEATS) as HeatId[];
/** The V4 Heats, shared by any dungeon whose floors fit them. */
export const SHARED_HEATS: HeatId[] = ['stoneFloor', 'ventFloor', 'quickStudy', 'richHaul'];

/** Heat tuning, kept here so balance changes are data changes. */
export const HEAT_TUNING = {
  quickStudyXp: 1.25, richHaulLuck: 1.2,
  /** Thick Steam (Foundry): Temper's timer and the vent heal per stack. */
  steamTemper: 0.75, steamHeal: 2,
  /** High Sun (Glarewell): the Glare's timers (trash and boss) and pillar shadow length. */
  sunGlare: 0.8, sunShadow: 1.25,
  /** Bright Coal (Coldmarrow): the coal's full light radius and its drain. */
  coalRadius: 1.25, coalDrain: 1.15,
  /** Slack Water (Wrackline): raft drift and the trash Ebb's timer (1: unchanged; 0.78 with the slower drift cost 15 of 160 at tier 13). */
  slackDrift: 0.6, slackTide: 1,
};

/**
 * Phase 14 X1: each solo dungeon's Heats. A floor Heat only goes where that floor is one of
 * the dungeon's layouts (LAYOUTS in sim/world.ts): the Glarewell has no stones, the Coldmarrow
 * no vents, and the Wrackline's rafts have no layouts at all. Group dungeons and raids have none.
 * The Kiln's pool is HEAT_IDS in its V4 order, so the Kiln's Heat on any day is unchanged.
 */
export const HEAT_POOLS: Partial<Record<DungeonId, HeatId[]>> = {
  kiln: ['stoneFloor', 'ventFloor', 'quickStudy', 'richHaul'],
  foundry: ['stoneFloor', 'ventFloor', 'quickStudy', 'richHaul', 'thickSteam'],
  glarewell: ['ventFloor', 'quickStudy', 'richHaul', 'highSun'],
  coldmarrow: ['stoneFloor', 'quickStudy', 'richHaul', 'brightCoal'],
  wrackline: ['quickStudy', 'richHaul', 'slackWater'],
};

/** Where the Day's Heat applies: every solo dungeon with a pool, at every tier (`tier` is kept for callers). */
export function heatApplies(dungeon: DungeonId, _tier?: number): boolean {
  return !!HEAT_POOLS[dungeon]?.length;
}

/** Today's Heat in `dungeon`: a fixed pick from the day number (dayOf in bounty.ts), the same for everyone. */
export function heatFor(day: number, dungeon: DungeonId = 'kiln'): HeatId {
  const pool = HEAT_POOLS[dungeon] ?? SHARED_HEATS;
  let h = Math.imul((day | 0) ^ 0x3c6ef372, 0x9e3779b1) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  return pool[((h ^ (h >>> 13)) >>> 0) % pool.length];
}

/** Whether `heat` can be today's Heat in `dungeon` (the sim drops one that can't, such as Stone Floor in the Glarewell). */
export function heatFits(dungeon: DungeonId, heat: HeatId): boolean {
  return !!HEAT_POOLS[dungeon]?.includes(heat);
}
