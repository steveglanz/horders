/**
 * P4 Collections: a book of every verb set piece, Mythic and class weapon
 * effect the account has ever held. It's shared by every class, like titles,
 * so a Mythic or weapon effect that only one class can roll is a reason to
 * play that class. Completion pays embers once (to the class playing) and
 * some entries give a title. Spec: docs/design/collections.md.
 */
import { Item, MYTHICS, MythicId, WEAPON_FX, WeaponFxId } from './items';
import { SETS, SET_IDS, SET_SLOTS, SetId } from './sets';

/** A book entry: `set:<set>:<slot>`, `mythic:<id>` or `fx:<id>`. */
export type EntryKey = string;

export interface CollectionReward {
  id: string;
  name: string;
  /** The entries that complete it, and how many of them are needed. */
  entries: EntryKey[];
  need: number;
  embers: number;
  title?: string;
}

export const MYTHIC_IDS = Object.keys(MYTHICS) as MythicId[];
export const WEAPON_FX_IDS = Object.keys(WEAPON_FX) as WeaponFxId[];

export function setEntries(set: SetId): EntryKey[] {
  return SET_SLOTS.map((slot) => `set:${set}:${slot}`);
}

/** Every page of the book, in display order. */
export const BOOK = {
  sets: SET_IDS.map((s) => ({ id: s, entries: setEntries(s) })),
  mythics: MYTHIC_IDS.map((m) => `mythic:${m}`),
  weaponFx: WEAPON_FX_IDS.map((f) => `fx:${f}`),
};

export const COLLECTION_TUNING = { setEmbers: 80, mythicsHalfEmbers: 80, mythicsAllEmbers: 200, weaponFxEmbers: 120 };

export const COLLECTION_REWARDS: CollectionReward[] = [
  ...SET_IDS.map((s) => ({
    id: `set:${s}`, name: `${SETS[s].name} set`, entries: setEntries(s), need: SET_SLOTS.length,
    embers: COLLECTION_TUNING.setEmbers, title: `the ${SETS[s].name}`,
  })),
  { id: 'mythics:half', name: 'Half the Mythics', entries: BOOK.mythics, need: Math.ceil(BOOK.mythics.length / 2), embers: COLLECTION_TUNING.mythicsHalfEmbers },
  { id: 'mythics:all', name: 'Every Mythic', entries: BOOK.mythics, need: BOOK.mythics.length, embers: COLLECTION_TUNING.mythicsAllEmbers, title: 'the Mythbound' },
  { id: 'fx:all', name: 'Every weapon effect', entries: BOOK.weaponFx, need: BOOK.weaponFx.length, embers: COLLECTION_TUNING.weaponFxEmbers, title: 'Weaponsworn' },
];

/** The book entries an item fills (a set piece, a Mythic and a weapon effect can all be on one item). */
export function entriesOf(it: Item): EntryKey[] {
  const out: EntryKey[] = [];
  if (it.set && SET_SLOTS.includes(it.slot)) out.push(`set:${it.set}:${it.slot}`);
  if (it.mythic) out.push(`mythic:${it.mythic}`);
  if (it.weaponFx) out.push(`fx:${it.weaponFx}`);
  return out;
}

export function rewardProgress(r: CollectionReward, have: ReadonlySet<EntryKey>): number {
  return Math.min(r.need, r.entries.filter((e) => have.has(e)).length);
}
