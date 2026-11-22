/**
 * End-of-run unlock sounds. The run's victory or defeat sting plays first, then a
 * chime for each thing the run unlocked, in the order the end screen lists them:
 * an achievement gets the big one, a new season-track level its own sting, a
 * Delver's Key move a key turning (up, fast or down), an in-season win (the season's own dungeon) a spark chime, and a
 * title or a season, collection or weekly reward a smaller one. Achievements come
 * first, so a cap of three never drops one. Pure, so it can be tested.
 */
import type { RunRewards } from '../../sim/hero';
import type { SoundId } from './sounds';

export interface TimedCue {
  id: SoundId;
  /** Seconds after the end screen opens. */
  at: number;
}

/** Leave the victory fanfare (about 1.7 s) room before the first unlock. */
const FIRST = 1.8;
const GAP = 0.9;
/** More than this many in one run would just be noise: the end screen lists them all. */
const MAX = 3;

/** Which sound the Delver's Key's move gets, if it moved. */
function keyCue(r: RunRewards): SoundId | undefined {
  if (r.keyFrom === undefined || r.keyTo === undefined) return undefined;
  const d = r.keyTo - r.keyFrom;
  return d > 1 ? 'keyFast' : d > 0 ? 'keyUp' : d < 0 ? 'keyDown' : undefined;
}

export function rewardCues(r: RunRewards | undefined): TimedCue[] {
  if (!r) return [];
  const ids: SoundId[] = [
    ...(r.achievements ?? []).map(() => 'achievement' as const),
    // A season-track level: its own rising sting.
    ...((r.seasonTo ?? 0) > (r.seasonFrom ?? 0) ? ['seasonUp' as const] : []),
    // P3: the Delver's Key moved (a fast clear moves it two or more).
    ...(keyCue(r) ? [keyCue(r)!] : []),
    // A win in the season's dungeon (SeasonDef.dungeon, e.g. the Hammerdeep in the Deep Bellows) paid extra marks.
    ...(r.seasonFeatured ? ['inSeason' as const] : []),
    // The daily bounty's embers.
    ...(r.bountyEmbers ? ['bountyPaid' as const] : []),
    ...(r.title ? ['unlock' as const] : []),
    ...(r.seasonRewards ?? []).map(() => 'unlock' as const),
    ...(r.collectionRewards ?? []).map(() => 'unlock' as const),
    ...(r.weeklyDone ?? []).map(() => 'unlock' as const),
  ];
  return ids.slice(0, MAX).map((id, k) => ({ id, at: FIRST + k * GAP }));
}

/**
 * The end screen deals the run's loot in one card at a time (client/index.html lootIn: 0.45 s, then 0.11 s
 * apart, the ninth and later together), and Epics and Mythics get a shine 0.3 s after their card lands
 * (lootShine). Each card gets a soft flick, and each shine a sparkle, timed to the animation.
 * Reduced motion turns the animation off, so the cards make no sound either.
 */
export const LOOT_DEAL = { first: 0.45, gap: 0.11, cap: 8, shine: 0.3 };

export function lootCues(r: RunRewards | undefined, reducedMotion = false): TimedCue[] {
  if (!r || reducedMotion) return [];
  const out: TimedCue[] = [];
  r.items.forEach((it, k) => {
    const at = LOOT_DEAL.first + Math.min(k, LOOT_DEAL.cap) * LOOT_DEAL.gap;
    // Cards past the cap land together: one flick for the lot.
    if (k <= LOOT_DEAL.cap) out.push({ id: 'lootDeal', at });
    if (it.rarity === 'epic' || it.rarity === 'mythic') out.push({ id: 'lootShine', at: at + LOOT_DEAL.shine });
  });
  // Several shines landing together after the cap would stack: keep one per moment.
  return out.filter((c, i) => out.findIndex((o) => o.id === c.id && Math.abs(o.at - c.at) < 1e-6) === i);
}
