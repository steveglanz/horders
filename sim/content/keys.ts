/**
 * P3 Delver's Keys (Mythic+ style). Each solo dungeon has a key level per hero.
 * A key run is played at the hero's best beaten tier, with tougher foes per key
 * level and one more Omen every two levels (up to all five). Win inside the par time and
 * the key goes up; lose and it goes down. Pure data and functions; spec:
 * docs/design/keys.md.
 */
import { OMEN_IDS, OmenId, omenCount, omenOrder } from './omens';
import { MAX_TIER } from './scaling';

export const KEYS = {
  /** Keys open once the hero has unlocked this tier (two Omens by then). */
  unlockTier: 6,
  /** Each key level: enemy health and damage up this much (on top of the tier). */
  hpPerLevel: 0.06,
  dmgPerLevel: 0.03,
  /** Par time for the whole delve, in seconds. Inside `fast` × par the key goes up two. */
  par: 480,
  fast: 0.8,
  /** One more Omen every this many key levels, up to all five. */
  levelsPerOmen: 2,
  /** Embers for a key win: per key level. */
  emberPerLevel: 8,
  maxLevel: 30,
};

/** The tier a key run is played at: the hero's best beaten tier. */
export function keyTier(maxTier: number): number {
  return Math.max(1, Math.min(MAX_TIER, maxTier - 1));
}

/** The key run's Omens: the week's tier Omens plus one more every `levelsPerOmen` key levels, up to all five. */
export function keyOmens(tier: number, week: number, level: number): OmenId[] {
  const extra = Math.floor(Math.max(0, level) / KEYS.levelsPerOmen);
  return omenOrder(week).slice(0, Math.min(OMEN_IDS.length, omenCount(tier) + extra));
}

/** Enemy health and damage multipliers for a key level. */
export function keyScale(level: number): { hp: number; dmg: number } {
  const k = Math.max(0, level);
  return { hp: 1 + KEYS.hpPerLevel * k, dmg: 1 + KEYS.dmgPerLevel * k };
}

/** How the key moves after a run: +2 fast, +1 inside par, 0 for a slow win, −1 for a loss. */
export function keyStep(victory: boolean, time: number): number {
  if (!victory) return -1;
  if (time <= KEYS.par * KEYS.fast) return 2;
  if (time <= KEYS.par) return 1;
  return 0;
}

export function keyEmbers(level: number, victory: boolean): number {
  return victory ? KEYS.emberPerLevel * Math.max(1, level) : 0;
}
