/**
 * Daily bounty (R7): a short delve that is the same for every player on a
 * given day: the same dungeon, fights, spawns and one twist (an Omen). Pure:
 * the client passes the day, the sim never reads the clock. Only the tier is
 * the hero's own, so it stays a fair challenge for everyone.
 */
import { Rng } from '../rng';
import { DUNGEONS, DUNGEON_IDS, DungeonId, EncounterId } from './dungeon';
import { OMEN_IDS, OmenId } from './omens';

export const BOUNTY = {
  /** The hub shows the bounty once the hero has won a delve (tier 2 unlocked). */
  unlockTier: 2,
  /** Embers paid for the first bounty win of the day: base plus per tier. */
  emberBase: 30,
  emberPerTier: 6,
  /** Levels (and drafts) the hero starts with, for the two openers a bounty skips. */
  headStart: 2,
};

export interface Bounty {
  day: number;
  seed: number;
  dungeon: DungeonId;
  route: EncounterId[];
  twist: OmenId;
  tier: number;
}

/** Day number (days since 1 Jan 1970, UTC), so the bounty turns over at the same moment everywhere. */
export function dayOf(ms: number): number {
  return Math.floor(ms / (24 * 3600 * 1000));
}

/** Tier a hero takes the bounty at: one below their best, so it's a confident run, not a wall. */
export function bountyTier(maxTier: number): number {
  return Math.max(1, maxTier - 1);
}

/**
 * The day's bounty. Dungeon, route, twist and seed come only from the day.
 * If the day's dungeon is still locked for this hero, they get the Kiln
 * version of the same day (same twist and seed).
 */
export function bountyFor(day: number, maxTier: number): Bounty {
  const rng = new Rng(((day | 0) * 2246822519) ^ 0x2c1b3c6d);
  const seed = rng.int(2 ** 31);
  const twist = OMEN_IDS[rng.int(OMEN_IDS.length)];
  const dayDungeon = DUNGEON_IDS[rng.int(DUNGEON_IDS.length)];
  const pickN = rng.int(1 << 16);
  const pickH = rng.int(1 << 16);
  const dungeon = maxTier >= DUNGEONS[dayDungeon].unlockTier ? dayDungeon : 'kiln';
  const d = DUNGEONS[dungeon];
  const named = d.named[pickN % d.named.length];
  const hard = d.hard.filter((h) => h !== named);
  return { day, seed, dungeon, route: [named, hard[pickH % hard.length], d.boss], twist, tier: bountyTier(maxTier) };
}

export function bountyEmbers(tier: number): number {
  return BOUNTY.emberBase + BOUNTY.emberPerTier * tier;
}
