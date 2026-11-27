/** Gear: slots, rarity tiers, stats and mythic effects. All data. */
import type { ClassId } from './emberwright';
import type { SetId } from './sets';
import type { DungeonId } from './dungeon';

export type Slot = 'weapon' | 'head' | 'chest' | 'hands' | 'ring' | 'trinket';
export const SLOTS: Slot[] = ['weapon', 'head', 'chest', 'hands', 'ring', 'trinket'];

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export interface RarityDef {
  id: Rarity;
  name: string;
  bonusStats: number;
  color: string;
  /** Embers returned when salvaged. */
  salvage: number;
}

/**
 * Rarity ladder (Steve, 26 Nov): Common, Uncommon, Rare, Epic, Legendary, Mythic. Each step adds a bonus stat;
 * Epic and up give a class weapon effect on weapons, and a Mythic adds a Mythic effect. Drop odds are in LOOT.
 */
export const RARITY: Record<Rarity, RarityDef> = {
  common: { id: 'common', name: 'Common', bonusStats: 0, color: '#c9bfb5', salvage: 1 },
  uncommon: { id: 'uncommon', name: 'Uncommon', bonusStats: 1, color: '#7fd67a', salvage: 3 },
  rare: { id: 'rare', name: 'Rare', bonusStats: 2, color: '#5aa9ff', salvage: 8 },
  epic: { id: 'epic', name: 'Epic', bonusStats: 3, color: '#c77dff', salvage: 20 },
  legendary: { id: 'legendary', name: 'Legendary', bonusStats: 4, color: '#ffd84a', salvage: 35 },
  mythic: { id: 'mythic', name: 'Mythic', bonusStats: 4, color: '#ff9a3d', salvage: 50 },
};

/** Saves from before 26 Nov call Uncommon "fine". */
export function fixRarity(r: string): Rarity {
  return r === 'fine' ? 'uncommon' : (r as Rarity);
}

/**
 * What dropped an item (Steve, 26 Nov: a loot table per kind of foe). `trash` is a pack's clear bag and
 * stray trash drops; `elite` an elite (Cinder Brute, Ashmaw), a quest and a won run's end chest; `rare` a
 * named elite (a rare spawn); `boss` a dungeon or raid boss.
 */
export type LootSource = 'trash' | 'elite' | 'rare' | 'boss';

/**
 * Loot tables (Steve, 26 Nov). `table` is each source's tier 1 odds in percent, in RARITIES order: every step is
 * about five to ten times rarer than the one below it. Each tier above 1 multiplies a rarity's weight by
 * (1 + tierStep) for every step it sits above Common, up to `tierCap`, so higher tiers lean slowly towards better
 * gear. Omen luck multiplies every weight above Common. Legendary and Mythic can't drop below their tier.
 */
export const LOOT = {
  table: {
    trash: [80, 16, 3.5, 0.45, 0.05, 0.005],
    elite: [62, 28, 8, 1.7, 0.25, 0.03],
    rare: [45, 36, 15, 3.5, 0.5, 0.06],
    boss: [30, 45, 20, 4.5, 0.6, 0.08],
  } as Record<LootSource, number[]>,
  tierStep: 0.08,
  tierCap: 15,
  legendaryFromTier: 2,
  mythicFromTier: 3,
};

/** The chance of each rarity (RARITIES order, summing to 1) for one drop from `source` at `tier` with `luck`. */
export function rarityOdds(source: LootSource, tier: number, luck = 1): number[] {
  const grow = Math.pow(1 + LOOT.tierStep, Math.max(0, Math.min(tier, LOOT.tierCap) - 1));
  const w = LOOT.table[source].map((base, r) => {
    if (RARITIES[r] === 'legendary' && tier < LOOT.legendaryFromTier) return 0;
    if (RARITIES[r] === 'mythic' && tier < LOOT.mythicFromTier) return 0;
    return r === 0 ? base : base * Math.pow(grow, r) * luck;
  });
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / total);
}

export type Stat = 'power' | 'vitality' | 'haste' | 'crit' | 'swiftness' | 'reach';

export interface StatDef {
  id: Stat;
  name: string;
  /** Value per item level for a bonus roll. */
  perLevel: number;
  format: (v: number) => string;
}

const pct = (v: number) => `+${v.toFixed(1)}%`;

export const STATS: Record<Stat, StatDef> = {
  power: { id: 'power', name: 'Power', perLevel: 0.6, format: (v) => `${pct(v)} damage` },
  vitality: { id: 'vitality', name: 'Vitality', perLevel: 2, format: (v) => `+${Math.round(v)} health` },
  haste: { id: 'haste', name: 'Haste', perLevel: 0.35, format: (v) => `${pct(v)} attack speed` },
  crit: { id: 'crit', name: 'Precision', perLevel: 0.3, format: (v) => `${pct(v)} crit chance` },
  swiftness: { id: 'swiftness', name: 'Swiftness', perLevel: 0.25, format: (v) => `${pct(v)} move speed` },
  reach: { id: 'reach', name: 'Reach', perLevel: 0.8, format: (v) => `${pct(v)} pickup range` },
};

/** Each slot's guaranteed main stat. */
export const SLOT_MAIN: Record<Slot, Stat> = {
  weapon: 'power',
  head: 'vitality',
  chest: 'vitality',
  hands: 'haste',
  ring: 'crit',
  trinket: 'power',
};

export const SLOT_NAMES: Record<Slot, string[]> = {
  weapon: ['Focus', 'Rod', 'Brand', 'Scepter'],
  head: ['Hood', 'Circlet', 'Cowl', 'Helm'],
  chest: ['Robe', 'Vestments', 'Hauberk', 'Mantle'],
  hands: ['Gloves', 'Wraps', 'Gauntlets', 'Grips'],
  ring: ['Band', 'Loop', 'Signet', 'Coil'],
  trinket: ['Charm', 'Idol', 'Talisman', 'Ember'],
};

/** Weapon names by the class that found them (four each, so a roll picks the same index for every class). */
export const WEAPON_NAMES: Record<ClassId, string[]> = {
  emberwright: ['Focus', 'Rod', 'Brand', 'Scepter'],
  duskblade: ['Fangs', 'Twinblades', 'Edges', 'Kris'],
  bulwark: ['Aegis', 'Greatshield', 'Mace', 'Warhammer'],
  lumen: ['Lantern', 'Censer', 'Sunstaff', 'Beacon'],
  slagbinder: ['Slagmaul', 'Clinkerhammer', 'Mould', 'Tongs'],
};

export const RARITY_PREFIX: Record<Rarity, string[]> = {
  common: ['Worn', 'Sooty', 'Plain', 'Cracked'],
  uncommon: ['Ashwoven', 'Tempered', 'Warded', 'Banked'],
  rare: ['Cinderforged', 'Kilnfired', 'Emberbound', 'Smoldering'],
  epic: ['Titanheart', 'Rimeburnt', 'Furnace-Sworn', 'Tidebreaker'],
  legendary: ['Ashcrowned', 'Starkiln', 'Hoardsworn', 'Sunbanked'],
  mythic: ['Heartfire', 'Everburning', 'Kaldera', 'Firstflame'],
};

/**
 * Item names written for one place (vision v2 CP3, docs/design/kiln-items.md). Replaces RARITY_PREFIX + SLOT_NAMES
 * for drops from that place. Common to Rare are plain gear (four per slot, four weapons per class); Epic and up are
 * one named piece per slot (and per class for weapons), each with a line (ITEM_LINES), until Treasures (CP6).
 * Every name was searched on warcraft.wiki.gg and wowpedia (no match). Steve may veto any of them.
 */
export interface PlaceNames {
  plain: Record<Exclude<Slot, 'weapon'>, string[]>;
  weapon: Record<ClassId, string[]>;
  court: Record<Exclude<Slot, 'weapon'>, string>;
  courtWeapon: Record<ClassId, string>;
}

export const PLACE_ITEMS: Partial<Record<DungeonId, PlaceNames>> = {
  kiln: {
    plain: {
      head: ["Stoker's Hood", 'Pot Helm', 'Glazed Half-Mask', 'Wet-Clay Cap'],
      chest: ["Potter's Apron", 'Slip-Stained Smock', 'Sherd Mail', "Patched Delver's Coat"],
      hands: ['Kiln Mitts', 'Wheel-Worn Gloves', 'Clay-Caked Wraps', 'Singed Gauntlets'],
      ring: ['Cutting-Wire Loop', 'Glaze-Bead Ring', 'Clay Signet', 'Brass Thimble'],
      trinket: ['Warm Sherd', 'Pocket Coal', "Potter's Stamp", 'Clay Whistle'],
    },
    weapon: {
      emberwright: ['Brass Tongs', 'Coal Pan', 'Kiln Rake', 'Fire Shovel'],
      duskblade: ['Wick Shears', 'Trimming Knife', 'Clay Knife', 'Glaze Scraper'],
      bulwark: ['Kiln-Door Shield', 'Damper Plate', 'Kiln Shelf', 'Wedging Mallet'],
      lumen: ['Clay Oil Lamp', 'Glazed Lantern', 'Brass Hand Lamp', 'Pot Lamp'],
      slagbinder: ['Patched Hand Cannon', 'Stovepipe Cannon', 'Short Bore', 'Bellmouth Gun'],
    },
    court: {
      head: "The Urn Warden's Lid",
      chest: "The Kiln Mother's Apron",
      hands: "The Kiln Mother's Mitts",
      ring: "The Taster's Ring",
      trinket: 'The First Witness Cone',
    },
    courtWeapon: {
      emberwright: "The Stoker's Last Tongs",
      duskblade: 'The Wheel Knife',
      bulwark: "The Kiln's Spare Door",
      lumen: 'The Peephole Lamp',
      slagbinder: 'The Bellows Nozzle',
    },
  },
};

/** One line under a named piece's name in its tooltip (world.md: a maker and one line). Keyed by item name. */
export const ITEM_LINES: Record<string, string> = {
  "The Urn Warden's Lid": 'It guarded one door for a hundred years.',
  "The Kiln Mother's Apron": 'She never once wiped her hands.',
  "The Kiln Mother's Mitts": 'Still warm after four hundred years of firings.',
  "The Taster's Ring": 'He bit it to test it, like everything else.',
  'The First Witness Cone': "It slumped at the Kiln's first firing and never stood again.",
  "The Stoker's Last Tongs": 'Left here by a delver who never carried them home.',
  'The Wheel Knife': 'The Kiln Mother cut every pot free with it.',
  "The Kiln's Spare Door": "She had a spare made, so she won't miss this one.",
  'The Peephole Lamp': 'She hung it by the spyhole to watch her pots fire.',
  'The Bellows Nozzle': 'Made to blow air into her kiln, not slag at her pots.',
};

/**
 * An item's name. `a` and `b` are two rolls (0-3) made for every item, so a place's names never shift the run's
 * other rolls. A place with written names uses them (b picks the plain name); elsewhere, prefix + slot as before.
 */
export function itemName(slot: Slot, rarity: Rarity, a: number, b: number, cls?: ClassId, place?: DungeonId): string {
  const p = place ? PLACE_ITEMS[place] : undefined;
  if (p) {
    const c = cls ?? 'emberwright';
    if (RARITIES.indexOf(rarity) >= RARITIES.indexOf('epic')) return slot === 'weapon' ? p.courtWeapon[c] : p.court[slot];
    return slot === 'weapon' ? p.weapon[c][b] : p.plain[slot][b];
  }
  const nouns = slot === 'weapon' && cls ? WEAPON_NAMES[cls] : SLOT_NAMES[slot];
  return `${RARITY_PREFIX[rarity][a]} ${nouns[b]}`;
}

export type MythicId =
  | 'phoenixFeather' | 'giantsBane' | 'gluttonsGem' | 'splittingCinders'
  | 'wanderersWake' | 'bankedHeart' | 'mirrorstep' | 'redLedger'
  | 'tetheredShield' | 'ringwallVow' | 'anchoredDawn' | 'eclipseGlass'
  | 'moltenCore' | 'clinkerCrown';

/**
 * Mythic effects. The first four suit any class. The rest are class Mythics
 * (roadmap R4): each one bends its class's kit into a different way to play, and
 * only drops for that class.
 */
export const MYTHICS: Record<MythicId, { name: string; text: string; cls?: ClassId }> = {
  phoenixFeather: { name: 'Phoenix Feather', text: 'Once per run, rise again with half health.' },
  giantsBane: { name: "Giant's Bane", text: '+30% damage to elites and bosses.' },
  gluttonsGem: { name: "Glutton's Gem", text: '+25% experience in runs.' },
  splittingCinders: { name: 'Splitting Cinders', text: 'Your attacks deal 15% extra damage to a nearby foe.' },
  wanderersWake: { cls: 'emberwright', name: "Wanderer's Wake", text: 'Blink recovers twice as fast and burns its whole path, but Flame Wave no longer knocks back.' },
  bankedHeart: { cls: 'emberwright', name: 'Banked Heart', text: 'Combustion bursts around you, wider (except on a healer), and each kill gives back 15 Heat.' },
  mirrorstep: { cls: 'duskblade', name: 'Mirrorstep', text: 'Sidestep recovers 2s sooner and leaves an afterimage for 2s that strikes with your swings at half damage.' },
  redLedger: { cls: 'duskblade', name: 'Red Ledger', text: 'Execution doubles below 50% health instead of 35%, and an Execution kill brings Rending Dash back.' },
  tetheredShield: { cls: 'bulwark', name: 'Tethered Shield', text: 'Shield Toss interrupts up to 3 casters, and for 4s Charge rushes the first one, from further away.' },
  ringwallVow: { cls: 'bulwark', name: 'Ringwall Vow', text: 'Shield Block guards every side for 20%, and Rim Smash pulls the horde in instead of shoving it.' },
  anchoredDawn: { cls: 'lumen', name: 'Anchored Dawn', text: 'Sanctuary lasts 50% longer but stays put, and Radiant Burst recovers 50% faster while you stand in it.' },
  eclipseGlass: { cls: 'lumen', name: 'Eclipse Glass', text: 'Radiant Burst reaches 10% further and deals 40% more damage, but heals half as much.' },
  moltenCore: { cls: 'slagbinder', name: 'Shared Melt', text: 'When Molten Plating coats an ally, you get half of it too, and plating bursts reach 50% further.' },
  clinkerCrown: { cls: 'slagbinder', name: 'Clinker Crown', text: 'Clinker strikes a second foe, and Brittle lasts twice as long, but Cooling Shell recovers 4s slower.' },
};

/** The Mythic effects a `cls` hero can roll: the shared four plus their own class's. */
export function mythicPool(cls?: ClassId): MythicId[] {
  return (Object.keys(MYTHICS) as MythicId[]).filter((m) => !MYTHICS[m].cls || MYTHICS[m].cls === cls);
}

export interface Item {
  id: string;
  slot: Slot;
  rarity: Rarity;
  ilvl: number;
  name: string;
  stats: { stat: Stat; value: number }[];
  mythic?: MythicId;
  /** A verb set piece (R4), dropped by that set's dungeon boss. */
  set?: SetId;
  /** Class weapon effect: Epic and Mythic weapons of a class change its basic attack. */
  weaponFx?: WeaponFxId;
}

export type WeaponFxId =
  | 'piercingCinders' | 'bankedFlame' | 'castCutter' | 'worryingEdge'
  | 'rallyingSweep' | 'wardingSweep' | 'tenderLight' | 'rebukingLight'
  | 'clingingSlag' | 'temperedLob';

/**
 * Class weapon effects (roadmap R4). Each class has two, and each one changes its basic
 * attack, so they don't overlap talents (abilities and stats) or Mythics (abilities).
 */
export const WEAPON_FX: Record<WeaponFxId, { cls: ClassId; name: string; text: string }> = {
  piercingCinders: { cls: 'emberwright', name: 'Piercing Cinders', text: 'Cinder Volley orbs pass through the first small foe they hit.' },
  bankedFlame: { cls: 'emberwright', name: 'Banked Flame', text: 'Every 5th orb is a big one that hits for 2.5 times the damage.' },
  castCutter: { cls: 'duskblade', name: 'Cast-Cutter', text: 'Swings hit a foe that is casting 35% harder.' },
  worryingEdge: { cls: 'duskblade', name: 'Worrying Edge', text: 'Each swing at the same target hits 2.5% harder, up to 5 times.' },
  rallyingSweep: { cls: 'bulwark', name: 'Rallying Sweep', text: 'Shield Sweep builds 2 more Resolve for each foe past the first.' },
  wardingSweep: { cls: 'bulwark', name: 'Warding Sweep', text: 'A Shield Sweep that hits a big foe shields you for 1.5% of your max health.' },
  tenderLight: { cls: 'lumen', name: 'Tender Light', text: "A Sunmote's heal is doubled on a hero below half health." },
  rebukingLight: { cls: 'lumen', name: 'Rebuking Light', text: 'Sunmotes hit a foe that is casting 25% harder.' },
  clingingSlag: { cls: 'slagbinder', name: 'Clinging Slag', text: 'Slag Lob leaves its target burning for 6 a second for 2s.' },
  temperedLob: { cls: 'slagbinder', name: 'Tempered Lob', text: 'A Slag Lob that hits a Brittle foe builds 3 more Slag.' },
};

/** The weapon effect an Epic or Mythic weapon with this id rolls for `cls`. Taken from the id, so no roll changes. */
export function weaponFxFor(cls: ClassId, id: string): WeaponFxId {
  const own = (Object.keys(WEAPON_FX) as WeaponFxId[]).filter((f) => WEAPON_FX[f].cls === cls);
  const n = Number(id.replace(/\D/g, '')) || 0;
  return own[n % own.length];
}
