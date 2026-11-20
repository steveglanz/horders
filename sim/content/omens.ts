/**
 * Omens: tier modifiers that change how fights play, not just their numbers.
 * From tier 3 every fight carries Omens from a weekly rotation, so the tier
 * ladder plays differently each week. Each one asks for a different reaction.
 */
import { Rng } from '../rng';

export type OmenId = 'kindledDead' | 'sharedPain' | 'quickened' | 'warded' | 'volatileGround';

export interface OmenDef {
  id: OmenId;
  name: string;
  /** What it does, shown in the hub and the run HUD. */
  text: string;
  /** What the player should do about it, shown as a tip. */
  tip: string;
}

export const OMENS: Record<OmenId, OmenDef> = {
  kindledDead: { id: 'kindledDead', name: 'Kindled Dead', text: 'Elites burst into a fire circle where they die.', tip: 'Step away after a kill.' },
  sharedPain: { id: 'sharedPain', name: 'Shared Pain', text: 'When an enemy dies, the others in the fight heal 15%.', tip: 'Wear packs down together.' },
  quickened: { id: 'quickened', name: 'Quickened', text: 'Enemy casts are 30% faster.', tip: 'Quench sooner.' },
  warded: { id: 'warded', name: 'Warded', text: 'Enemies gain a shield worth 20% of their health the first time they drop below half.', tip: 'Save a big hit for the shield.' },
  volatileGround: { id: 'volatileGround', name: 'Volatile Ground', text: 'Every 15 seconds the ground erupts under you.', tip: 'Keep moving.' },
};

export const OMEN_IDS = Object.keys(OMENS) as OmenId[];

/** Omen tuning, kept here so balance changes are data changes. */
export const OMEN_TUNING = {
  kindledRadius: 90,
  kindledDelay: 1.1,
  kindledDamage: 35,
  sharedPainHeal: 0.15,
  quickenedCast: 0.7,
  wardShare: 0.2,
  volatileEvery: 15,
  volatileRadius: 70,
  volatileDelay: 1.8,
  volatileDamage: 16,
  /** Extra loot luck per active Omen. */
  luckPerOmen: 0.08,
  /** Extra loot luck while a world boss lives and adds its Omen. */
  bossOmenLuck: 0.15,
};

/** The first tier that carries Omens. */
export const OMEN_FROM_TIER = 3;

/** How many Omens a tier carries: 3 to 5 one, 6 to 9 two, 10 and up three. */
export function omenCount(tier: number): number {
  if (tier < OMEN_FROM_TIER) return 0;
  if (tier < 6) return 1;
  if (tier < 10) return 2;
  return 3;
}

/**
 * This week's Omen order, a fixed shuffle seeded by the week number. A tier
 * takes the first `omenCount(tier)`, so higher tiers add to lower ones rather
 * than replacing them. Pure: the client passes the week, the sim never reads
 * the clock.
 */
export function omensFor(tier: number, week: number): OmenId[] {
  const order = [...OMEN_IDS];
  const rng = new Rng(((week | 0) * 2654435761) ^ 0x51ed270b);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.slice(0, omenCount(tier));
}

/** Week number used for the rotation (weeks since 1 Jan 1970, a Thursday). */
export function weekOf(ms: number): number {
  return Math.floor(ms / (7 * 24 * 3600 * 1000));
}
