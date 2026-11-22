/**
 * P6 Achievements: deeds the account has done, each paying a title once (and a
 * few embers to the class playing). Shared by every class, like titles and the
 * collection book. Pure: applyRun in sim/hero.ts updates `deeds` from the run
 * summary. Spec: docs/design/achievements.md.
 */
import type { ClassId } from './emberwright';
import type { DungeonId } from './dungeon';

/** What the account has done, summed over every class and run. */
export interface Deeds {
  /** Wins per dungeon (any victory: delve, bounty or key). */
  bosses?: Partial<Record<DungeonId, number>>;
  /** Classes that have won a delve. */
  classes?: ClassId[];
  interrupts?: number;
  named?: number;
  bounties?: number;
}

/** What an achievement reads: the deeds and the best key beaten in each dungeon. */
export interface AchievementView {
  deeds: Deeds;
  keyBest: Partial<Record<DungeonId, number>>;
}

export interface Achievement {
  id: string;
  name: string;
  /** What to do, for the sheet. */
  text: string;
  title: string;
  embers: number;
  /** Progress toward it, and the amount needed. */
  need: number;
  have(v: AchievementView): number;
}

export const ACHIEVEMENT_TUNING = { small: 40, big: 100, interrupts: [100, 1000], named: 25, bounties: 10, keys: [5, 10] };
const T = ACHIEVEMENT_TUNING;

/** All five classes, for "win with every class". */
export const ALL_CLASSES: ClassId[] = ['emberwright', 'duskblade', 'bulwark', 'lumen', 'slagbinder'];

const boss = (id: string, d: DungeonId, name: string, foe: string, title: string, embers = T.small): Achievement => ({
  id, name, text: `Beat ${foe}.`, title, embers, need: 1, have: (v) => Math.min(1, v.deeds.bosses?.[d] ?? 0),
});

/** Every achievement, in sheet order. Titles are plain compound words picked for Horders and checked against WoW and Azeroth Survivors (see achievements.md). */
export const ACHIEVEMENTS: Achievement[] = [
  boss('boss:kiln', 'kiln', 'Kiln-Breaker', 'the Kiln Mother', 'Kiln-Breaker'),
  boss('boss:foundry', 'foundry', 'Floodwalker', 'Maelra in the Drowned Foundry', 'Floodwalker'),
  boss('boss:glarewell', 'glarewell', 'Lightproof', 'the Lensmother in the Glarewell', 'the Lightproof'),
  boss('boss:coldmarrow', 'coldmarrow', 'Winterproof', 'Nhevra in the Coldmarrow', 'the Winterproof'),
  boss('boss:wrackline', 'wrackline', 'Ebbproof', 'Hessa of the Ebb in the Wrackline', 'the Ebbproof'),
  boss('boss:hammerdeep', 'hammerdeep', 'Anvilbreaker', 'Ondrel in the Hammerdeep', 'Anvilbreaker'),
  boss('boss:ashvents', 'ashvents', 'Twice-Burned', 'Ysmeret in the Ashvents', 'Twice-Burned'),
  boss('boss:pressworks', 'pressworks', 'Pressbreaker', 'Oskel in the Pressworks', 'Pressbreaker'),
  boss('boss:flue', 'flue', 'Sealbreaker', 'the Furnace Regent in the Flue', 'Sealbreaker', T.big),
  boss('boss:smeltery', 'smeltery', 'Platebreaker', 'the Cinder Colossus in the Smeltery', 'Platebreaker', T.big),
  boss('boss:hoard', 'hoard', 'Crawbreaker', 'Old Vorhulm in the Hoard', 'Crawbreaker', T.big),
  boss('boss:crucible', 'crucible', 'Slagbane', 'Grandmother Slag in the Crucible', 'Slagbane', T.big),
  {
    id: 'classes', name: 'Many Hands', text: 'Win a delve with every class.', title: 'the Many-Handed', embers: T.big,
    need: ALL_CLASSES.length, have: (v) => ALL_CLASSES.filter((c) => v.deeds.classes?.includes(c)).length,
  },
  {
    id: 'interrupts:1', name: 'Quencher', text: `Interrupt ${T.interrupts[0]} casts.`, title: 'the Quencher', embers: T.small,
    need: T.interrupts[0], have: (v) => Math.min(T.interrupts[0], v.deeds.interrupts ?? 0),
  },
  {
    id: 'interrupts:2', name: 'Spellsnuffer', text: `Interrupt ${T.interrupts[1]} casts.`, title: 'Spellsnuffer', embers: T.big,
    need: T.interrupts[1], have: (v) => Math.min(T.interrupts[1], v.deeds.interrupts ?? 0),
  },
  {
    id: 'named', name: 'Namebreaker', text: `Fell ${T.named} named foes.`, title: 'Namebreaker', embers: T.small,
    need: T.named, have: (v) => Math.min(T.named, v.deeds.named ?? 0),
  },
  {
    id: 'bounties', name: 'Bountysworn', text: `Win ${T.bounties} daily bounties.`, title: 'Bountysworn', embers: T.small,
    need: T.bounties, have: (v) => Math.min(T.bounties, v.deeds.bounties ?? 0),
  },
  {
    id: 'keys:1', name: 'Keybearer', text: `Beat a level ${T.keys[0]} Delver's Key.`, title: 'the Keybearer', embers: T.small,
    need: T.keys[0], have: (v) => Math.min(T.keys[0], bestKey(v)),
  },
  {
    id: 'keys:2', name: 'Lockbreaker', text: `Beat a level ${T.keys[1]} Delver's Key.`, title: 'Lockbreaker', embers: T.big,
    need: T.keys[1], have: (v) => Math.min(T.keys[1], bestKey(v)),
  },
];

function bestKey(v: AchievementView): number {
  return Math.max(0, ...Object.values(v.keyBest).map((n) => n ?? 0));
}

/** Adds one run to the deeds. `cls` is the class that played it. */
export function addDeeds(d: Deeds, run: { victory: boolean; dungeon?: DungeonId; bounty?: number; interrupts?: number; namedKills?: number }, cls: ClassId): Deeds {
  const out: Deeds = { ...d, bosses: { ...(d.bosses ?? {}) }, classes: [...(d.classes ?? [])] };
  out.interrupts = (d.interrupts ?? 0) + (run.interrupts ?? 0);
  out.named = (d.named ?? 0) + (run.namedKills ?? 0);
  if (run.victory) {
    const dg = run.dungeon ?? 'kiln';
    out.bosses![dg] = (out.bosses![dg] ?? 0) + 1;
    if (!out.classes!.includes(cls)) out.classes!.push(cls);
    if (run.bounty !== undefined) out.bounties = (d.bounties ?? 0) + 1;
  }
  return out;
}
