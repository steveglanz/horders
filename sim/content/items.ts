/** Gear: slots, rarity tiers, stats and mythic effects. All data. */
import type { ClassId } from './emberwright';
import type { SetId } from './sets';

export type Slot = 'weapon' | 'head' | 'chest' | 'hands' | 'ring' | 'trinket';
export const SLOTS: Slot[] = ['weapon', 'head', 'chest', 'hands', 'ring', 'trinket'];

export type Rarity = 'common' | 'fine' | 'rare' | 'epic' | 'mythic';
export const RARITIES: Rarity[] = ['common', 'fine', 'rare', 'epic', 'mythic'];

export interface RarityDef {
  id: Rarity;
  name: string;
  /** Relative drop weight before bad-luck protection. */
  weight: number;
  bonusStats: number;
  color: string;
  /** Embers returned when salvaged. */
  salvage: number;
}

export const RARITY: Record<Rarity, RarityDef> = {
  common: { id: 'common', name: 'Common', weight: 60, bonusStats: 0, color: '#c9bfb5', salvage: 1 },
  fine: { id: 'fine', name: 'Fine', weight: 26, bonusStats: 1, color: '#7fd67a', salvage: 3 },
  rare: { id: 'rare', name: 'Rare', weight: 10, bonusStats: 2, color: '#5aa9ff', salvage: 8 },
  epic: { id: 'epic', name: 'Epic', weight: 1.5, bonusStats: 3, color: '#c77dff', salvage: 20 },
  mythic: { id: 'mythic', name: 'Mythic', weight: 0.3, bonusStats: 3, color: '#ff9a3d', salvage: 50 },
};

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
export const WEAPON_NAMES: Record<'emberwright' | 'duskblade' | 'bulwark' | 'lumen', string[]> = {
  emberwright: ['Focus', 'Rod', 'Brand', 'Scepter'],
  duskblade: ['Fangs', 'Twinblades', 'Edges', 'Kris'],
  bulwark: ['Aegis', 'Greatshield', 'Mace', 'Warhammer'],
  lumen: ['Lantern', 'Censer', 'Sunstaff', 'Beacon'],
};

export const RARITY_PREFIX: Record<Rarity, string[]> = {
  common: ['Worn', 'Sooty', 'Plain', 'Cracked'],
  fine: ['Ashwoven', 'Tempered', 'Warded', 'Banked'],
  rare: ['Cinderforged', 'Kilnfired', 'Emberbound', 'Smoldering'],
  epic: ['Titanheart', 'Rimeburnt', 'Furnace-Sworn', 'Tidebreaker'],
  mythic: ['Heartfire', 'Everburning', 'Kaldera', 'Firstflame'],
};

export type MythicId =
  | 'phoenixFeather' | 'giantsBane' | 'gluttonsGem' | 'splittingCinders'
  | 'wanderersWake' | 'bankedHeart' | 'mirrorstep' | 'redLedger'
  | 'tetheredShield' | 'ringwallVow' | 'anchoredDawn' | 'eclipseGlass';

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
  ringwallVow: { cls: 'bulwark', name: 'Ringwall Vow', text: 'Shield Block guards every side for 20%, and Shield Slam pulls the horde in instead of shoving it.' },
  anchoredDawn: { cls: 'lumen', name: 'Anchored Dawn', text: 'Sanctuary lasts 50% longer but stays put, and Radiant Burst recovers 50% faster while you stand in it.' },
  eclipseGlass: { cls: 'lumen', name: 'Eclipse Glass', text: 'Radiant Burst reaches 10% further and deals 40% more damage, but heals half as much.' },
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
}
