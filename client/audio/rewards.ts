/**
 * End-of-run unlock sounds. The run's victory or defeat sting plays first, then a
 * chime for each thing the run unlocked, in the order the end screen lists them:
 * an achievement gets the big one, and a title or a season, collection or weekly
 * reward gets a smaller one. Pure, so it can be tested.
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

export function rewardCues(r: RunRewards | undefined): TimedCue[] {
  if (!r) return [];
  const ids: SoundId[] = [
    ...(r.achievements ?? []).map(() => 'achievement' as const),
    ...(r.title ? ['unlock' as const] : []),
    ...(r.seasonRewards ?? []).map(() => 'unlock' as const),
    ...(r.collectionRewards ?? []).map(() => 'unlock' as const),
    ...(r.weeklyDone ?? []).map(() => 'unlock' as const),
  ];
  return ids.slice(0, MAX).map((id, k) => ({ id, at: FIRST + k * GAP }));
}
