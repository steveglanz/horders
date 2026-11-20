/**
 * Difficulty that adapts to who is fighting: how many heroes are in the party,
 * and how a hero has been doing on a tier. Pure data and functions, so the
 * server can apply the same numbers to co-op rooms and world bosses later.
 * Background and sources: docs/design/group-play.md.
 */

/** Party sizes the game is tuned for (co-op is planned for 2 to 4). */
export const MAX_PARTY = 4;

/**
 * Enemy health multiplier for a party of `n`. Each extra hero adds about a
 * full hero's damage, but groups lose some of it to movement and overlap, so
 * health grows a little slower than linearly: 1, 1.775, 2.5, 3.175.
 */
export function partyHealth(n: number): number {
  const k = clampParty(n) - 1;
  return 1 + 0.8 * k - 0.025 * k * k;
}

/**
 * Enemy damage per hit doesn't scale with party size: a hit should hurt the
 * same whoever takes it. Groups face more mechanics instead (see partyMechanics).
 */
export function partyDamage(_n: number): number {
  return 1;
}

/**
 * Extra copies of targeted mechanics (rings, soak circles) per party: one per
 * hero, so every player has something to handle and nobody idles.
 */
export function partyMechanics(n: number): number {
  return clampParty(n);
}

export function clampParty(n: number | undefined): number {
  return Math.max(1, Math.min(MAX_PARTY, Math.floor(n ?? 1)));
}

/**
 * Grit: a small, visible boost after repeated defeats on the same tier, so
 * a wall is hard but never hopeless. Each loss in a row adds a stack, a win
 * clears them. Capped low so it nudges rather than carries.
 */
export const GRIT = {
  perStack: 0.05,
  maxStacks: 3,
};

export function gritMult(stacks: number | undefined): number {
  return 1 + GRIT.perStack * Math.max(0, Math.min(GRIT.maxStacks, Math.floor(stacks ?? 0)));
}
