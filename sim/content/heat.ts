/**
 * V4 variety (docs/design/variety.md): the Day's Heat, one gentle twist on the Kiln at
 * tiers 1 and 2, the same for everyone that day, so early runs change before weekly
 * Omens start at tier 3. Pure: the client passes the day, the sim never reads the clock.
 */
import type { DungeonId } from './dungeon';
import { OMEN_FROM_TIER } from './omens';

export type HeatId = 'stoneFloor' | 'ventFloor' | 'quickStudy' | 'richHaul';

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
};

export const HEAT_IDS = Object.keys(HEATS) as HeatId[];

/** Heat tuning, kept here so balance changes are data changes. */
export const HEAT_TUNING = { quickStudyXp: 1.25, richHaulLuck: 1.2 };

/** Where the Day's Heat applies: the Kiln, below the first Omen tier. */
export function heatApplies(dungeon: DungeonId, tier: number): boolean {
  return dungeon === 'kiln' && tier < OMEN_FROM_TIER;
}

/** Today's Heat: a fixed pick from the day number (dayOf in bounty.ts), the same for everyone. */
export function heatFor(day: number): HeatId {
  let h = Math.imul((day | 0) ^ 0x3c6ef372, 0x9e3779b1) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  return HEAT_IDS[((h ^ (h >>> 13)) >>> 0) % HEAT_IDS.length];
}
