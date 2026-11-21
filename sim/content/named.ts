/**
 * C2 rare spawns: about half of all delves hide one named elite in a fight before
 * the boss. It is one of that fight's own elites, tougher and with an affix, and it
 * drops its own loot. See docs/design/named-elites.md.
 */
export const NAMED = {
  /** Share of delves that have a named elite. */
  chance: 0.5,
  /** Health multiplier. */
  hp: 2,
  /** Swift: move speed multiplier. Warded: a shield worth this share of max health. */
  swift: 1.45, ward: 0.35,
  /** Vengeful: on death it bursts, a red circle that lands after `burstDelay` s. */
  burstR: 110, burstDmg: 32, burstDelay: 1.2,
  /** Its loot: one item, Rare or better, Epic with this chance. */
  epicChance: 0.25,
};

/** Original titles (searched 21 Nov 2026, see the design doc). Shown as "<title>, <kind name>". */
export const NAMED_TITLES = [
  'Old Scald', 'Ashjaw', 'Brindlecoat', 'Cinderveil', 'Grist', 'Hollowmark',
  'Morrowfang', 'Quell', 'Sablehide', 'Tinderback', 'Vesk', 'Wickmother',
] as const;

export const AFFIXES = ['Swift', 'Warded', 'Vengeful'] as const;
export type Affix = (typeof AFFIXES)[number];
