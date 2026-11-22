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
  /**
   * Phase 14 X2: share of named elites that get one of the newer affixes (Brood, Smoldering)
   * instead, from an extra draw after the C2 ones, so the other C2 rolls don't move.
   */
  newAffixChance: 0.4,
  /** Brood: on death, `broodN` of the dungeon's pack foe (BROOD_KIND) come out of it. */
  broodN: 2,
  /** Smoldering: every `smolderEvery` s it leaves a fire circle where it stands, landing after `smolderDelay` s. */
  smolderEvery: 4, smolderR: 70, smolderDelay: 1.5, smolderDmg: 14,
  /** Tools only: an AFFIXES index every named foe gets (-1: rolled as usual), and 1 to put a named foe in every delve. */
  forceAffix: -1, forceNamed: 0,
};

/** Phase 14 X2 Brood: the pack foe a Brood elite lets out, by dungeon (cinderhounds elsewhere). */
export const BROOD_KIND: Record<string, 'cinderhound' | 'shade' | 'rimehound' | 'shoalLurker'> = {
  glarewell: 'shade', coldmarrow: 'rimehound', wrackline: 'shoalLurker',
};

/** Original titles (searched 21 Nov 2026, see the design doc). Shown as "<title>, <kind name>". */
export const NAMED_TITLES = [
  'Old Scald', 'Ashjaw', 'Brindlecoat', 'Cinderveil', 'Grist', 'Hollowmark',
  'Morrowfang', 'Quell', 'Sablehide', 'Tinderback', 'Vesk', 'Wickmother',
] as const;

/** The C2 three first (rolled as before), then Phase 14 X2's Brood and Smoldering. */
export const AFFIXES = ['Swift', 'Warded', 'Vengeful', 'Brood', 'Smoldering'] as const;
export const C2_AFFIXES = 3;
export type Affix = (typeof AFFIXES)[number];

/** Phase 14 X2: what each affix does, for the named foe's banner. */
export const AFFIX_TIP: Record<Affix, string> = {
  Swift: 'It runs fast.',
  Warded: 'It shields itself below half health.',
  Vengeful: 'It bursts where it falls: step away from the kill.',
  Brood: 'Its pack comes out of it when it falls.',
  Smoldering: 'It leaves fire where it stands: keep it moving.',
};
