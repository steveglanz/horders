import { SEASON, SeasonReward, SeasonState, runMarks, seasonDef, seasonLevel, seasonRewards, seasonState } from './content/season';
import { ACHIEVEMENTS, Achievement, AchievementView, Deeds, addDeeds } from './content/achievements';
import { COLLECTION_REWARDS, CollectionReward, EntryKey, entriesOf, rewardProgress } from './content/collections';
import { DUNGEONS } from './content/dungeon';
import type { DungeonId } from './content/dungeon';
/**
 * The persistent hero: levels, permanent talent points, inventory and gear.
 * Everything here is pure functions over plain data so it can run on the
 * server later (loot must be rolled server-side once cloud saves exist).
 */
import { KEYS, keyEmbers, keyStep } from './content/keys';
import { WeeklyQuest, WeeklyRun, WeeklyState, weekState, weeklyStep, weeklyTitle } from './content/weekly';
import { Rng } from './rng';
import { GRIT, MAX_TIER } from './content/scaling';
import { bountyEmbers } from './content/bounty';
import { ClassId } from './content/emberwright';
import { ALT_OPTIONS, AltId, cleanAlts } from './content/classes';
import { TREE, TreeNodeId, canTakeNode, isTreeNode } from './content/trees';
import type { SetId } from './content/sets';
import { RunSummary } from './world';
import {
  Item, MythicId, mythicPool, WeaponFxId, weaponFxFor, RARITIES, RARITY, RARITY_PREFIX, Rarity, LOOT, LootSource, rarityOdds, fixRarity, SLOTS, SLOT_MAIN, SLOT_NAMES, STATS, Slot, Stat, WEAPON_NAMES,
} from './content/items';

export type PassiveId = 'might' | 'fortitude' | 'insight' | 'alacrity';
/** A permanent point: an old stat point or a character tree node (content/trees.ts). */
export type PointId = PassiveId | TreeNodeId;

/**
 * Hero talents: permanent points bought with hero levels. `text` is the short label,
 * `tip` the long-press tooltip (what it does, per point, and at max).
 */
export const PASSIVES: Record<PassiveId, { name: string; text: string; tip: string; max: number }> = {
  might: { name: 'Might', text: '+3% damage per point', tip: 'Hit harder with everything. +3% damage per point, +30% at 10 points.', max: 10 },
  fortitude: { name: 'Fortitude', text: '+8 health per point', tip: 'More health. +8 max health per point, +80 at 10 points.', max: 10 },
  insight: {
    name: 'Insight', text: '+4% experience per point',
    tip: 'Level up faster during a delve, so you catch Sparks sooner. +4% experience per point, +20% at 5 points.', max: 5,
  },
  alacrity: {
    name: 'Alacrity', text: '+2% attack speed per point',
    tip: 'Your basic attack fires faster. +2% attack speed per point, +20% at 10 points.', max: 10,
  },
};

/** Runs without an Epic or better before the end chest's last item is one (26 Nov: 10 -> 30, Epics are meant to be rare). */
export const PITY_LIMIT = 30;
/** Mythics (build-changing items) only drop from this tier up, so the first ones are a milestone. */
export const MYTHIC_FROM_TIER = LOOT.mythicFromTier;

export interface HeroProfile {
  version: 1;
  level: number;
  xp: number;
  passives: Partial<Record<PointId, number>>;
  embers: number;
  inventory: Item[];
  equipped: Partial<Record<Slot, string>>;
  pity: number;
  runs: number;
  wins: number;
  bestTime: number;
  nextItemId: number;
  /** Highest difficulty tier unlocked (win a tier to unlock the next). */
  maxTier: number;
  /** The tier this character last delved (or was moved up to by a win). The hub opens on it (see startTier). */
  lastTier?: number;
  /** Class picked on the title screen (older saves have none: Emberwright). */
  cls?: ClassId;
  /** Forge actions taken; seeds temper rolls so they can be re-checked. */
  forged?: number;
  /** Losses in a row on one dungeon and tier, which grant Grit there. */
  grit?: { key: string; stacks: number };
  /** Day of the last daily bounty that paid out. */
  bountyDay?: number;
  /**
   * The classes not being played right now, each with its own progress. The
   * top-level fields are always the selected class's character. Saves from
   * before this field have none: their progress belongs to the selected class.
   */
  roster?: Partial<Record<ClassId, Character>>;
  /** P1: this week's quests (shared by every class, like the daily bounty). */
  weekly?: WeeklyState;
  /** Titles earned (P1 weekly quests give one for finishing all three). */
  titles?: string[];
  /** P3: Delver's Key level per solo dungeon, and the best key level beaten in each (for leaderboards). */
  keys?: Partial<Record<DungeonId, number>>;
  keyBest?: Partial<Record<DungeonId, number>>;
  /** 1.0 CP2 mastery card: this character's fastest win, in seconds, per `dungeon:tier` (bestKey). */
  bestClear?: Record<string, number>;
  /** Slagbinder stance (Anvil tanks, Bellows fills a damage slot); kept per character. Default Bellows. */
  stance?: 'anvil' | 'bellows';
  /** Old saves: the level-8 ability option was on. Read as `alts` holding that option. */
  alt?: boolean;
  /** Ability options (ALT_OPTIONS ids) picked for this character, one per slot; each applies from its level. */
  alts?: AltId[];
  /** P4: every collection book entry the account has held (shared by every class), and the rewards already paid. */
  collection?: EntryKey[];
  collectionPaid?: string[];
  /** P2: this season's track (shared by every class), the glows earned in any season, and what the hero wears. */
  season?: SeasonState;
  glows?: string[];
  /** P2: each season trail earned, by id, at its highest stage (1 to 3). */
  trails?: Record<string, number>;
  wear?: { title?: string; glow?: string; trail?: string };
  /** P6: what the account has done (shared by every class), and the achievements already paid. */
  deeds?: Deeds;
  achieved?: string[];
  /** Phase 15 Y4: the Seen log (sim/seen.ts), `dungeon:kind:id` keys, shared by every class. */
  seen?: string[];
  /** Halls (keep it simple, 25 Nov): encounters whose fight tip this account has already been shown on a Halls map. */
  tipsSeen?: string[];
  /** How many times this save was reset (resetCharacter / resetProgress). The higher count wins in newerHero, so an old cloud or local copy never brings back progress the player chose to erase. */
  resets?: number;
}

/** What belongs to one class's character. The rest (class choice, item ids, Forge seed, daily bounty) is shared. */
/** The options this character picked (old saves' `alt` reads as the level-8 option), whether or not unlocked yet. */
export function altsPicked(cls: ClassId, h: Pick<HeroProfile, 'alt' | 'alts'>): AltId[] {
  return cleanAlts(cls, h.alts ?? (h.alt ? [ALT_OPTIONS[cls][0].id] : []));
}

/** The ability options this character takes into the next run: picked, and at or past each one's level. */
export function altsOn(cls: ClassId, h: Pick<HeroProfile, 'alt' | 'alts' | 'level'>): AltId[] {
  return altsPicked(cls, h).filter((id) => (ALT_OPTIONS[cls].find((o) => o.id === id)?.level ?? 99) <= h.level);
}

/** P5: embers are not here. One purse is shared by every class (see shareEmbers and economy.md). */
export const CHARACTER_KEYS = ['level', 'xp', 'passives', 'inventory', 'equipped', 'pity', 'runs', 'wins', 'bestTime', 'maxTier', 'lastTier', 'grit', 'keys', 'keyBest', 'bestClear', 'stance', 'alt', 'alts'] as const;
export type Character = Pick<HeroProfile, (typeof CHARACTER_KEYS)[number]>;

function freshCharacter(): Character {
  const n = newHero();
  return { level: n.level, xp: n.xp, passives: {}, inventory: [], equipped: {}, pity: n.pity, runs: 0, wins: 0, bestTime: 0, maxTier: n.maxTier };
}

function takeCharacter(h: HeroProfile): Character {
  const c = {} as Record<string, unknown>;
  for (const k of CHARACTER_KEYS) if (h[k] !== undefined) c[k] = h[k];
  return c as unknown as Character;
}

/**
 * P5: one ember purse for the whole account. Saves from before this kept a
 * purse per class in the roster; fold those into the shared one so nobody
 * loses embers. Safe to run on every load (it does nothing once merged).
 */
export function shareEmbers(h: HeroProfile): HeroProfile {
  if (!h.roster) return h;
  for (const c of Object.values(h.roster) as (Character & { embers?: unknown })[]) {
    if (!c || !('embers' in c)) continue;
    const e = typeof c.embers === 'number' && Number.isFinite(c.embers) ? Math.max(0, Math.floor(c.embers)) : 0;
    h.embers = (h.embers ?? 0) + e;
    delete c.embers;
  }
  return h;
}

/** Switches the played class: the current character goes to the roster, and the new class's own character (or a fresh one) comes out. */
export function switchClass(h: HeroProfile, cls: ClassId): void {
  const cur = h.cls ?? 'emberwright';
  if (cur === cls) return;
  const roster = { ...(h.roster ?? {}) };
  roster[cur] = takeCharacter(h);
  const next = roster[cls] ?? freshCharacter();
  delete roster[cls];
  for (const k of CHARACTER_KEYS) delete h[k];
  Object.assign(h, freshCharacter(), next);
  h.roster = roster;
  h.cls = cls;
}

/**
 * Start one class over: its level, talents, gear, bags, keys and records go back to a fresh level 1.
 * Everything account-wide stays (the shared ember purse, collection, titles, deeds, season, the other classes).
 */
export function resetCharacter(h: HeroProfile, cls: ClassId): void {
  if ((h.cls ?? 'emberwright') === cls) {
    for (const k of CHARACTER_KEYS) delete h[k];
    Object.assign(h, freshCharacter());
  } else if (h.roster?.[cls]) {
    const roster = { ...h.roster };
    delete roster[cls];
    h.roster = roster;
  }
  h.resets = (h.resets ?? 0) + 1;
}

/** Start the whole account over: a brand new hero, keeping only the reset count (see newerHero). */
export function resetProgress(h: HeroProfile): HeroProfile {
  return { ...newHero(), resets: (h.resets ?? 0) + 1 };
}

/** Every class that has a character, the one being played first: for the Settings "Start over" list. */
export function charactersMade(h: HeroProfile): { cls: ClassId; level: number; runs: number }[] {
  const cur = h.cls ?? 'emberwright';
  const out = [{ cls: cur, level: h.level, runs: h.runs ?? 0 }];
  for (const [cls, c] of Object.entries(h.roster ?? {}) as [ClassId, Character][]) {
    if (c && cls !== cur) out.push({ cls, level: c.level ?? 1, runs: c.runs ?? 0 });
  }
  return out;
}

/** The character for `cls`, whether it is being played or waiting in the roster. */
export function characterOf(h: HeroProfile, cls: ClassId): Character | undefined {
  return (h.cls ?? 'emberwright') === cls ? takeCharacter(h) : h.roster?.[cls];
}

/** Delves played across every class on this save (CP3 opening: a save with none opens on the title, docs/design/opening.md). */
export function savedRuns(h: HeroProfile): number {
  return totals(h).runs;
}

/** Delves and levels across every class, for picking the newer of two saves. */
function totals(h: HeroProfile): { runs: number; levels: number; xp: number } {
  const all = [takeCharacter(h), ...Object.values(h.roster ?? {})] as Character[];
  return {
    runs: all.reduce((a, c) => a + (c.runs ?? 0), 0),
    levels: all.reduce((a, c) => a + (c.level ?? 1), 0),
    xp: all.reduce((a, c) => a + (c.xp ?? 0), 0),
  };
}

export function newHero(): HeroProfile {
  return {
    version: 1, level: 1, xp: 0, passives: {}, embers: 0, inventory: [], equipped: {},
    pity: 0, runs: 0, wins: 0, bestTime: 0, nextItemId: 1, maxTier: 1,
  };
}

export function heroXpToNext(level: number): number {
  return Math.round(120 + level * 60 + Math.pow(level, 2) * 8);
}

export function heroMaxLevel(): number {
  return 20; // alpha cap
}

export function pointsAvailable(h: HeroProfile): number {
  const spent = Object.values(h.passives).reduce((a, b) => a + (b ?? 0), 0);
  return h.level - 1 - spent;
}

/** Hero XP from a run: survives and kills both count, a loss still pays. */
export function heroXpForRun(s: RunSummary): number {
  const tier = s.tier ?? 1;
  return Math.round((s.kills * 0.06 + s.time * 0.5 + (s.victory ? 120 : 0)) * (1 + 0.1 * (tier - 1)));
}

/** Loadout: everything the hero brings into a run, as multipliers the sim reads. */
export interface Loadout {
  dmgMult: number;
  maxHpBonus: number;
  hasteMult: number;
  critBonus: number;
  speedMult: number;
  pickupMult: number;
  xpMult: number;
  mythics: MythicId[];
  /** Set pieces worn, by set. */
  sets: Partial<Record<SetId, number>>;
  /** Class weapon effects from the equipped weapon. */
  weaponFx: WeaponFxId[];
}

export const EMPTY_LOADOUT: Loadout = {
  dmgMult: 1, maxHpBonus: 0, hasteMult: 1, critBonus: 0, speedMult: 1, pickupMult: 1, xpMult: 1, mythics: [], sets: {}, weaponFx: [],
};

export function equippedItems(h: HeroProfile): Item[] {
  return SLOTS.map((s) => h.inventory.find((i) => i.id === h.equipped[s])).filter((i): i is Item => !!i);
}

export function statTotals(h: HeroProfile): Record<Stat, number> {
  const t: Record<Stat, number> = { power: 0, vitality: 0, haste: 0, crit: 0, swiftness: 0, reach: 0 };
  for (const it of equippedItems(h)) for (const s of it.stats) t[s.stat] += s.value;
  return t;
}

export function loadoutFor(h: HeroProfile): Loadout {
  return loadoutFrom(h.passives, equippedItems(h));
}

/** Loadout from permanent passives plus a set of equipped items (used mid-run when gear changes). */
export function loadoutFrom(passives: Partial<Record<PointId, number>>, items: Item[]): Loadout {
  const t: Record<Stat, number> = { power: 0, vitality: 0, haste: 0, crit: 0, swiftness: 0, reach: 0 };
  for (const it of items) for (const s of it.stats) t[s.stat] += s.value;
  const p = (id: PassiveId) => passives[id] ?? 0;
  let treePts = 0;
  for (const [id, n] of Object.entries(passives)) if (isTreeNode(id)) treePts += n ?? 0;
  return {
    dmgMult: (1 + t.power / 100) * (1 + 0.03 * p('might')),
    maxHpBonus: Math.round(t.vitality + 8 * p('fortitude') + TREE.bulkHp * (passives.bulk ?? 0) + TREE.hardyHp * (passives.hardy ?? 0) + TREE.warmthHp * (passives.warmth ?? 0) + TREE.sturdyHp * (passives.sturdy ?? 0) + TREE.heftHp * (passives.heft ?? 0) + TREE.pointHp * treePts),
    hasteMult: (1 + t.haste / 100) * (1 + 0.02 * p('alacrity')),
    critBonus: t.crit / 100,
    speedMult: (1 + t.swiftness / 100) * (1 + TREE.strideSpeed * (passives.stride ?? 0)),
    pickupMult: 1 + t.reach / 100,
    xpMult: 1 + 0.04 * p('insight') + (items.some((i) => i.mythic === 'gluttonsGem') ? 0.25 : 0),
    mythics: items.map((i) => i.mythic).filter((m): m is MythicId => !!m),
    sets: items.reduce<Partial<Record<SetId, number>>>((a, i) => (i.set ? { ...a, [i.set]: (a[i.set] ?? 0) + 1 } : a), {}),
    weaponFx: items.map((i) => i.weaponFx).filter((f): f is WeaponFxId => !!f),
  };
}

/** Average item level of equipped gear, empty slots count as 0. */
export function gearScore(h: HeroProfile): number {
  const items = equippedItems(h);
  return Math.round(items.reduce((a, i) => a + i.ilvl, 0) / SLOTS.length);
}

// ------------------------------------------------------------------ loot

export interface RunRewards {
  heroXp: number;
  items: Item[];
  levelsGained: number;
  /** Embers paid by the daily bounty (0 if not a bounty, a loss, or already paid today). */
  bountyEmbers?: number;
  /** P1: weekly quests this run finished, the embers they paid, and the title for finishing the week. */
  weeklyDone?: WeeklyQuest[];
  weeklyEmbers?: number;
  title?: string;
  /** P3: a key run's key level before and after, and the embers it paid. */
  keyFrom?: number;
  keyTo?: number;
  keyEmbers?: number;
  /** P4: book entries this run added for the first time, and the collection rewards it completed. */
  collectionNew?: EntryKey[];
  collectionRewards?: CollectionReward[];
  /** P2: season marks this run earned (first win of the day included), the level before and after, and rewards reached. */
  seasonMarks?: number;
  seasonFrom?: number;
  seasonTo?: number;
  seasonRewards?: SeasonReward[];
  seasonFirstWin?: boolean;
  /** P2: the win was in the season's own dungeon and paid SEASON.featured extra marks. */
  seasonFeatured?: boolean;
  /** P6: achievements this run completed (each pays its title and embers once). */
  achievements?: Achievement[];
  /** Phase 15 Y4: Seen log keys this run met for the first time (set by the client from sim/seen.ts). */
  seenNew?: string[];
  /** 1.0 CP2 mastery card: this win set a new best time (bestClear); `bestBefore` is the old one, if any. */
  newBest?: boolean;
  bestBefore?: number;
}

/**
 * 1.0 CP2 mastery card: the best-time slot a run counts for, `dungeon:tier`, or '' when it sets none. Only a solo
 * delve on the tier ladder counts: the daily bounty, Delver's Key runs, party runs and the tutorial first delve don't.
 */
export function bestKey(s: Pick<RunSummary, 'dungeon' | 'tier' | 'bounty' | 'keyLevel' | 'realHeroes' | 'firstDelve'>): string {
  if (s.bounty !== undefined || s.keyLevel || s.realHeroes !== undefined || s.firstDelve) return '';
  return `${s.dungeon ?? 'kiln'}:${s.tier ?? 1}`;
}

/** One random item for a drop from `source` (its loot table), at least `minRarity`. */
export function rollDrop(
  rng: Rng, id: string, ilvl: number, luck: number, minRarity: Rarity = 'common', cls?: ClassId, tier = MYTHIC_FROM_TIER,
  source: LootSource = 'trash',
): Item {
  let rarity = rollRarity(rng, luck, tier, source);
  if (RARITIES.indexOf(rarity) < RARITIES.indexOf(minRarity)) rarity = minRarity;
  const slot = SLOTS[rng.int(SLOTS.length)];
  return makeItem(rng, id, slot, rarity, Math.max(1, ilvl + rng.int(3) - 1), cls);
}

function rollRarity(rng: Rng, luck: number, tier: number, source: LootSource): Rarity {
  const odds = rarityOdds(source, tier, luck);
  let x = rng.next();
  for (let i = 0; i < RARITIES.length; i++) {
    x -= odds[i];
    if (x <= 0 && odds[i] > 0) return RARITIES[i];
  }
  return 'common';
}

/**
 * `cls` names the weapon for the class that found it, and picks a Mythic from that class's pool.
 * Other slots and every stat roll are the same for all classes.
 */
export function makeItem(rng: Rng, id: string, slot: Slot, rarity: Rarity, ilvl: number, cls?: ClassId): Item {
  const main = SLOT_MAIN[slot];
  // A flat base keeps early drops meaningful; item level still scales them.
  const lvl = ilvl + 5;
  const stats: { stat: Stat; value: number }[] = [{ stat: main, value: round1(STATS[main].perLevel * lvl * 1.6) }];
  const pool = (Object.keys(STATS) as Stat[]).filter((s) => s !== main);
  for (let k = 0; k < RARITY[rarity].bonusStats && pool.length; k++) {
    const stat = pool.splice(rng.int(pool.length), 1)[0];
    stats.push({ stat, value: round1(STATS[stat].perLevel * lvl * rng.range(0.7, 1.2)) });
  }
  const prefixes = RARITY_PREFIX[rarity];
  const nouns = slot === 'weapon' && cls ? WEAPON_NAMES[cls] : SLOT_NAMES[slot];
  const item: Item = {
    id, slot, rarity, ilvl,
    name: `${prefixes[rng.int(prefixes.length)]} ${nouns[rng.int(nouns.length)]}`,
    stats,
  };
  if (rarity === 'mythic') {
    // Class Mythics drop only for their own class; with no class, only the shared ones.
    const ids = mythicPool(cls);
    item.mythic = ids[rng.int(ids.length)];
  }
  // Class weapon effect on an Epic or better weapon found by a class.
  if (slot === 'weapon' && cls && RARITIES.indexOf(rarity) >= RARITIES.indexOf('epic')) item.weaponFx = weaponFxFor(cls, id);
  return item;
}

/**
 * Rolls a run's loot. Deterministic for a given seed, so the server can roll
 * (or re-check) the same result. Mutates nothing; returns the items and the
 * new pity counter.
 */
export function rollLoot(
  seed: number, s: RunSummary, hero: HeroProfile, eliteKilled: boolean, runDrops: Item[] = [],
): { items: Item[]; pity: number } {
  // A run that cleared no fight earns no end chest and moves no pity, so quitting
  // a delve straight away can't be farmed for items or a pity Epic.
  if (!s.victory && s.fightsCleared === 0) return { items: [], pity: hero.pity };
  const rng = new Rng(seed ^ 0x9e3779b9);
  // Most loot now drops during the run; the end chest is a small top-up.
  const count = runDrops.length ? (s.victory ? 1 : 0) : Math.min(7, 1 + Math.floor(s.time / 150) + (eliteKilled ? 1 : 0) + (s.victory ? 2 : 0));
  const tier = s.tier ?? 1;
  const baseIlvl = hero.level + (s.victory ? 2 : 0) + (tier - 1);
  // A won run's chest rolls on the elite table, a lost one on the trash table (tier is in the tables).
  const source: LootSource = s.victory ? 'elite' : 'trash';
  const items: Item[] = [];
  let pity = hero.pity;
  const epicUp = (r: Rarity) => RARITIES.indexOf(r) >= RARITIES.indexOf('epic');
  let gotEpic = runDrops.some((i) => epicUp(i.rarity));
  for (let k = 0; k < count; k++) {
    let rarity = rollRarity(rng, 1, tier, source);
    // Bad-luck protection: after enough dry runs the last drop is upgraded.
    if (k === count - 1 && !gotEpic && pity + 1 >= PITY_LIMIT && !epicUp(rarity)) rarity = 'epic';
    if (epicUp(rarity)) gotEpic = true;
    const slot = SLOTS[rng.int(SLOTS.length)];
    const ilvl = Math.max(1, baseIlvl + rng.int(3) - 1);
    items.push(makeItem(rng, `i${hero.nextItemId + runDrops.length + k}`, slot, rarity, ilvl, hero.cls ?? 'emberwright'));
  }
  pity = gotEpic ? 0 : pity + 1;
  return { items, pity };
}

/**
 * Applies a finished run to the hero and returns what was earned.
 * `runDrops` are items picked up during the run (ids from `runItemIds`);
 * `runEquipped` are the ids the run auto-equipped as upgrades.
 */
/**
 * Co-op guest: a run's drops carry the host's item ids. Gives them this hero's
 * next ids (the numbering applyRun expects) and maps what was equipped.
 */
export function rekeyDrops(hero: HeroProfile, drops: Item[], equipped: string[]): { drops: Item[]; equipped: string[] } {
  const map = new Map<string, string>();
  const out = drops.map((it, k) => {
    const id = `i${hero.nextItemId + k}`;
    map.set(it.id, id);
    return { ...it, id };
  });
  return { drops: out, equipped: equipped.map((id) => map.get(id)).filter((id): id is string => !!id) };
}

export function applyRun(
  hero: HeroProfile, seed: number, s: RunSummary, eliteKilled: boolean,
  runDrops: Item[] = [], runEquipped: string[] = [],
): RunRewards {
  const xpMult = loadoutFor(hero).xpMult;
  let heroXp = Math.round(heroXpForRun(s) * xpMult);
  // QA M5, 27 Nov: a tutorial win ended 2-11 XP short of level 2. The first win always reaches it.
  if (s.victory && hero.wins === 0 && hero.level === 1) heroXp = Math.max(heroXp, heroXpToNext(1) - hero.xp);
  const loot = rollLoot(seed, s, hero, eliteKilled, runDrops);
  const known = collectionOf(hero);
  // P6: a save from before achievements starts from what it records, read before this run counts.
  const deedsBefore = hero.deeds ?? backfillDeeds(hero);
  hero.inventory.push(...runDrops);
  for (const id of runEquipped) equip(hero, id);
  hero.nextItemId += runDrops.length;
  hero.runs++;
  const maxTierBefore = hero.maxTier;
  let bountyEmbersPaid = 0;
  let key: Pick<RunRewards, 'keyFrom' | 'keyTo' | 'keyEmbers'> = {};
  if (s.keyLevel) {
    // A key run is a side run like the bounty: it never moves the tier ladder or Grit.
    if (s.victory) hero.wins++;
    key = applyKey(hero, s);
  } else if (s.bounty !== undefined) {
    // A bounty is a side run: it never moves the tier ladder or Grit, and pays once a day.
    if (s.victory) {
      hero.wins++;
      if (hero.bountyDay !== s.bounty) {
        hero.bountyDay = s.bounty;
        bountyEmbersPaid = bountyEmbers(s.tier ?? 1);
        hero.embers += bountyEmbersPaid;
      }
    }
  } else {
    const key = gritKey(s.dungeon ?? 'kiln', s.tier ?? 1);
    // Grit is for a real attempt: a run quit before clearing a fight or lasting
    // GRIT.minTime seconds leaves it as it was.
    const attempt = s.victory || (s.fightsCleared ?? 1) > 0 || s.time >= GRIT.minTime;
    if (s.victory) hero.grit = undefined;
    else if (attempt) hero.grit = { key, stacks: Math.min(GRIT.maxStacks, (hero.grit?.key === key ? hero.grit.stacks : 0) + 1) };
    if (s.victory) {
      hero.wins++;
      if ((s.tier ?? 1) >= hero.maxTier) hero.maxTier = Math.min(MAX_TIER + 1, (s.tier ?? 1) + 1);
    }
  }
  const weekly = s.week !== undefined ? applyWeekly(hero, s, maxTierBefore) : undefined;
  hero.bestTime = Math.max(hero.bestTime, s.time);
  const bk = bestKey(s);
  const bestBefore = bk ? hero.bestClear?.[bk] : undefined;
  const newBest = !!bk && s.victory && (bestBefore === undefined || s.time < bestBefore);
  if (newBest) hero.bestClear = { ...(hero.bestClear ?? {}), [bk]: Math.round(s.time * 10) / 10 };
  hero.pity = loot.pity;
  hero.nextItemId += loot.items.length;
  hero.inventory.push(...loot.items);
  let levels = 0;
  hero.xp += heroXp;
  while (hero.level < heroMaxLevel() && hero.xp >= heroXpToNext(hero.level)) {
    hero.xp -= heroXpToNext(hero.level);
    hero.level++;
    levels++;
  }
  if (hero.level >= heroMaxLevel()) hero.xp = Math.min(hero.xp, heroXpToNext(hero.level));
  // Auto-equip into empty slots so new players see gear working right away.
  for (const it of loot.items) if (!hero.equipped[it.slot]) hero.equipped[it.slot] = it.id;
  const collection = applyCollection(hero, known);
  const season = s.week !== undefined ? applySeason(hero, s, weekly?.weeklyDone?.length ?? 0) : undefined;
  const achievements = applyAchievements(hero, s, deedsBefore);
  return { heroXp, items: [...runDrops, ...loot.items], levelsGained: levels, bountyEmbers: bountyEmbersPaid, ...(newBest ? { newBest } : {}), ...(bestBefore !== undefined ? { bestBefore } : {}), ...weekly, ...key, ...collection, ...season, ...achievements };
}

/**
 * P4: the collection book as it stands. The stored list plus anything held
 * by any class right now, so saves from before collections count what they
 * still own.
 */
export function collectionOf(hero: HeroProfile): Set<EntryKey> {
  const have = new Set<EntryKey>(hero.collection ?? []);
  const bags = [hero.inventory, ...Object.values(hero.roster ?? {}).map((c) => c?.inventory ?? [])];
  for (const bag of bags) for (const it of bag) for (const e of entriesOf(it)) have.add(e);
  return have;
}

/** P2: adds this run's season marks and grants every reward the track passed. */
function applySeason(hero: HeroProfile, s: RunSummary, weeklyDone: number): Pick<RunRewards, 'seasonMarks' | 'seasonFrom' | 'seasonTo' | 'seasonRewards' | 'seasonFirstWin' | 'seasonFeatured'> {
  const st = { ...seasonState(hero.season, s.week ?? 0) };
  const firstWin = s.victory && s.day !== undefined && st.firstWinDay !== s.day;
  if (firstWin) st.firstWinDay = s.day;
  const featured = s.victory && s.dungeon !== undefined && s.dungeon === seasonDef(st.id).dungeon;
  const marks = runMarks(s.victory, s.fightsCleared ?? 0, weeklyDone, firstWin, featured);
  const from = seasonLevel(st.marks);
  st.marks = Math.min(SEASON.levels * SEASON.marksPerLevel, st.marks + marks);
  hero.season = st;
  const to = seasonLevel(st.marks);
  const got = seasonRewards(st.id).filter((r) => r.level > from && r.level <= to);
  for (const r of got) {
    if (r.kind === 'glow') hero.glows = [...new Set([...(hero.glows ?? []), r.glow.id])];
    else if (r.kind === 'trail') hero.trails = { ...(hero.trails ?? {}), [r.trail.id]: Math.max(hero.trails?.[r.trail.id] ?? 0, r.stage) };
    else hero.titles = [...new Set([...(hero.titles ?? []), r.title])];
  }
  // Trails came mid-season: a hero already past a trail level gets it on their next run.
  for (const r of seasonRewards(st.id)) {
    if (r.kind === 'trail' && r.level <= to && (hero.trails?.[r.trail.id] ?? 0) < r.stage) hero.trails = { ...(hero.trails ?? {}), [r.trail.id]: r.stage };
  }
  return { seasonMarks: marks, seasonFrom: from, seasonTo: to, ...(got.length ? { seasonRewards: got } : {}), ...(firstWin ? { seasonFirstWin: true } : {}), ...(featured ? { seasonFeatured: true } : {}) };
}

/** P6: adds the run to the account's deeds and pays every achievement it completes, once each. */
function applyAchievements(hero: HeroProfile, s: RunSummary, before: Deeds): Pick<RunRewards, 'achievements'> {
  hero.deeds = addDeeds(before, s, hero.cls ?? 'emberwright');
  const done = new Set(hero.achieved ?? []);
  const got: Achievement[] = [];
  const view = achievementView(hero);
  for (const a of ACHIEVEMENTS) {
    if (done.has(a.id) || a.have(view) < a.need) continue;
    done.add(a.id);
    hero.embers += a.embers;
    hero.titles = [...new Set([...(hero.titles ?? []), a.title])];
    got.push(a);
  }
  hero.achieved = [...done];
  return got.length ? { achievements: got } : {};
}

/**
 * P6: deeds for a save from before achievements, from what it already records: every
 * class with a win, and the Kiln (a first win is always there, the only tier 1 dungeon).
 */
export function backfillDeeds(hero: HeroProfile): Deeds {
  const classes: ClassId[] = [];
  if (hero.wins > 0) classes.push(hero.cls ?? 'emberwright');
  for (const [c, ch] of Object.entries(hero.roster ?? {})) if ((ch?.wins ?? 0) > 0 && !classes.includes(c as ClassId)) classes.push(c as ClassId);
  return classes.length ? { classes, bosses: { kiln: 1 } } : {};
}

/** P6: what the achievements read. Key bests from every class count. */
export function achievementView(hero: HeroProfile): AchievementView {
  const keyBest: Partial<Record<DungeonId, number>> = { ...(hero.keyBest ?? {}) };
  for (const c of Object.values(hero.roster ?? {})) {
    for (const [d, n] of Object.entries(c?.keyBest ?? {})) keyBest[d as DungeonId] = Math.max(keyBest[d as DungeonId] ?? 0, n ?? 0);
  }
  return { deeds: hero.deeds ?? {}, keyBest };
}

/** P2: wear an earned title, glow or trail (undefined takes it off). Returns false if the hero hasn't earned it. */
export function wearCosmetic(hero: HeroProfile, kind: 'title' | 'glow' | 'trail', id: string | undefined): boolean {
  const earned = kind === 'title' ? hero.titles ?? [] : kind === 'glow' ? hero.glows ?? [] : Object.keys(hero.trails ?? {});
  if (id !== undefined && !earned.includes(id)) return false;
  hero.wear = { ...(hero.wear ?? {}), [kind]: id };
  if (id === undefined) delete hero.wear[kind];
  return true;
}

/** P4: records the book and pays every reward it now completes, once each. `known` is the book before this run. */
function applyCollection(hero: HeroProfile, known: Set<EntryKey>): Pick<RunRewards, 'collectionNew' | 'collectionRewards'> {
  const have = collectionOf(hero);
  hero.collection = [...have].sort();
  const fresh = hero.collection.filter((e) => !known.has(e));
  const paid = new Set(hero.collectionPaid ?? []);
  const done: CollectionReward[] = [];
  for (const r of COLLECTION_REWARDS) {
    if (paid.has(r.id) || rewardProgress(r, have) < r.need) continue;
    paid.add(r.id);
    hero.embers += r.embers;
    if (r.title) hero.titles = [...new Set([...(hero.titles ?? []), r.title])];
    done.push(r);
  }
  hero.collectionPaid = [...paid];
  return { ...(fresh.length ? { collectionNew: fresh } : {}), ...(done.length ? { collectionRewards: done } : {}) };
}

/** The hero's key level in a dungeon (keys start at 1 once unlocked). */
export function keyLevelOf(hero: HeroProfile, d: DungeonId): number {
  return hero.keys?.[d] ?? 1;
}

/** Whether this hero can run Delver's Keys yet. */
export function keysOpen(hero: HeroProfile): boolean {
  return hero.maxTier >= KEYS.unlockTier;
}

/** P3: moves the key for a key run's dungeon and pays a win. */
function applyKey(hero: HeroProfile, s: RunSummary): Pick<RunRewards, 'keyFrom' | 'keyTo' | 'keyEmbers'> {
  const d = s.dungeon ?? 'kiln';
  const from = s.keyLevel ?? 1;
  const to = Math.max(1, Math.min(KEYS.maxLevel, from + keyStep(s.victory, s.time)));
  hero.keys = { ...(hero.keys ?? {}), [d]: to };
  if (s.victory) hero.keyBest = { ...(hero.keyBest ?? {}), [d]: Math.max(hero.keyBest?.[d] ?? 0, from) };
  const embers = keyEmbers(from, s.victory);
  hero.embers += embers;
  return { keyFrom: from, keyTo: to, keyEmbers: embers };
}

/** P1: moves this week's quests, pays the ones that finish, and gives the week's title for all three. */
function applyWeekly(hero: HeroProfile, s: RunSummary, maxTier: number): Pick<RunRewards, 'weeklyDone' | 'weeklyEmbers' | 'title'> {
  const week = s.week ?? 0;
  const st = weekState(hero.weekly, week, maxTier);
  hero.weekly = st;
  const run: WeeklyRun = {
    victory: s.victory, dungeon: s.dungeon ?? 'kiln', tier: s.tier ?? 1, maxTier, kills: s.kills,
    interrupts: s.interrupts ?? 0, namedKills: s.namedKills ?? 0, bounty: s.bounty !== undefined,
    group: DUNGEONS[s.dungeon ?? 'kiln'].style !== 'solo', realHeroes: s.realHeroes,
  };
  const done: WeeklyQuest[] = [];
  let embers = 0;
  for (const q of st.party ? [...st.quests, st.party] : st.quests) {
    if (q.done) continue;
    q.progress = Math.min(q.goal, q.progress + weeklyStep(q, run));
    if (q.progress >= q.goal) {
      q.done = true;
      embers += q.embers;
      done.push({ ...q });
    }
  }
  hero.embers += embers;
  let title: string | undefined;
  if (!st.titled && st.quests.every((q) => q.done)) {
    st.titled = true;
    title = weeklyTitle(week);
    hero.titles = [...new Set([...(hero.titles ?? []), title])];
  }
  return done.length || title ? { weeklyDone: done, weeklyEmbers: embers, ...(title ? { title } : {}) } : {};
}

function gritKey(dungeon: string, tier: number): string {
  return `${dungeon}:${tier}`;
}

/** Grit stacks the hero brings into a delve of this dungeon and tier. */
export function gritFor(hero: HeroProfile, dungeon: string, tier: number): number {
  return hero.grit?.key === gritKey(dungeon, tier) ? hero.grit.stacks : 0;
}

export function equip(hero: HeroProfile, itemId: string): void {
  const it = hero.inventory.find((i) => i.id === itemId);
  if (it) hero.equipped[it.slot] = it.id;
}

export function salvage(hero: HeroProfile, itemId: string): number {
  const idx = hero.inventory.findIndex((i) => i.id === itemId);
  if (idx < 0) return 0;
  const it = hero.inventory[idx];
  if (hero.equipped[it.slot] === it.id) return 0;
  hero.inventory.splice(idx, 1);
  const gain = RARITY[it.rarity].salvage;
  hero.embers += gain;
  return gain;
}

/**
 * Salvage all: the spare items it breaks down, and what it keeps. It never takes what you wear, a set piece, an
 * Epic or Mythic, a weapon with a class effect, or an upgrade on what you wear in that slot (or an item for a slot you
 * have empty), so one tap can't throw away anything worth a second look.
 */
export function salvageAllPlan(hero: HeroProfile): { items: Item[]; embers: number; kept: number } {
  const worn = new Set(Object.values(hero.equipped));
  const wornScore = new Map<string, number>();
  for (const it of equippedItems(hero)) wornScore.set(it.slot, itemScore(it));
  const items: Item[] = [];
  let kept = 0;
  for (const it of hero.inventory) {
    if (worn.has(it.id)) continue;
    const cur = wornScore.get(it.slot);
    const keep = !!it.set || it.rarity === 'epic' || it.rarity === 'mythic' || !!it.mythic || !!it.weaponFx
      || cur === undefined || itemScore(it) > cur;
    if (keep) kept++;
    else items.push(it);
  }
  return { items, embers: items.reduce((a, it) => a + RARITY[it.rarity].salvage, 0), kept };
}

/**
 * The end screen's "Equip upgrade" (design, 23 Nov: players who never open Bags left the run's chest item unworn and
 * lost more delves at tiers 3 and 4). Of `items` (a run's loot), the best one per slot that beats what you wear there
 * by the same gear score Bags shows (itemScore), or fills a slot you have empty. Items already worn are skipped.
 */
export function lootUpgrades(hero: HeroProfile, items: Item[]): { item: Item; gain: number }[] {
  const worn = new Set(Object.values(hero.equipped));
  const best = new Map<string, { item: Item; gain: number }>();
  for (const it of items) {
    if (worn.has(it.id) || !hero.inventory.some((i) => i.id === it.id)) continue;
    const curId = hero.equipped[it.slot];
    const cur = curId ? hero.inventory.find((i) => i.id === curId) : undefined;
    const gain = itemScore(it) - (cur ? itemScore(cur) : 0);
    if (gain <= 0) continue;
    const had = best.get(it.slot);
    if (!had || gain > had.gain) best.set(it.slot, { item: it, gain });
  }
  return [...best.values()];
}

/**
 * Bags' "Equip best" (Steve, 25 Nov: "an auto equip or equip best button that puts on your highest gear score"): in
 * every slot, wears the bag's highest gear-score piece (itemScore, the score Bags shows and the end screen's Equip
 * upgrade uses) when it beats what is worn there or the slot is empty. Gear score only: it doesn't weigh set bonuses.
 * Returns the pieces put on and the gear score gained.
 */
export function equipBest(hero: HeroProfile): { items: Item[]; gain: number } {
  const ups = lootUpgrades(hero, hero.inventory);
  for (const u of ups) equip(hero, u.item.id);
  return { items: ups.map((u) => u.item), gain: ups.reduce((a, u) => a + u.gain, 0) };
}

/** Breaks down everything salvageAllPlan picks. Returns the items broken down and the embers gained. */
export function salvageAll(hero: HeroProfile): { count: number; embers: number } {
  const plan = salvageAllPlan(hero);
  let embers = 0;
  for (const it of plan.items) embers += salvage(hero, it.id);
  return { count: plan.items.length, embers };
}

export function spendPoint(hero: HeroProfile, id: PointId): boolean {
  if (pointsAvailable(hero) <= 0) return false;
  // Level points go on the character's tree; the old stat points can't be bought any more.
  if (!isTreeNode(id) || !canTakeNode(hero.passives, hero.cls ?? 'emberwright', id)) return false;
  hero.passives[id] = (hero.passives[id] ?? 0) + 1;
  return true;
}

/** Free respec: every point the character put in its tree comes back. */
export function resetTree(hero: HeroProfile): void {
  for (const id of Object.keys(hero.passives)) if (isTreeNode(id)) delete hero.passives[id];
}

/**
 * Moving a character onto the tree: its old stat points (Might, Fortitude, Insight, Alacrity) come back to spend there.
 */
export function refundStatPoints(hero: Pick<HeroProfile, 'passives'>): void {
  for (const id of Object.keys(hero.passives ?? {})) if (!isTreeNode(id)) delete hero.passives[id as PassiveId];
}

/**
 * Trees for everyone (25 Nov): every character on a save, played or in the roster, gets its old stat points back to
 * spend on its tree. Safe to run on every load (it does nothing once moved).
 */
export function toTree(h: HeroProfile): HeroProfile {
  refundStatPoints(h);
  for (const c of Object.values(h.roster ?? {})) if (c?.passives) refundStatPoints(c);
  renameRarities(h);
  return h;
}

/** 26 Nov: "Fine" items became Uncommon. Renames them in the save and every roster character's bags (safe on every load). */
export function renameRarities(h: HeroProfile): void {
  const bags = [h.inventory, ...Object.values(h.roster ?? {}).map((c) => c?.inventory)];
  for (const bag of bags) for (const it of bag ?? []) it.rarity = fixRarity(it.rarity);
}

/** A rough single-number strength used to compare items. */
export function itemScore(it: Item): number {
  const w: Record<Stat, number> = { power: 1.6, vitality: 0.35, haste: 2.2, crit: 2.4, swiftness: 1.4, reach: 0.5 };
  return it.stats.reduce((a, s) => a + s.value * w[s.stat], 0) + (it.mythic ? 25 : 0);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export interface BossReward {
  item: Item;
  embers: number;
}

/**
 * Reward for helping fell a world boss: one Epic (or better) item a little
 * above the hero's level, plus embers that grow with the damage dealt.
 * Deterministic for a boss id and hero state, so it can be re-checked.
 */
export function grantBossReward(hero: HeroProfile, bossId: number, damage: number): BossReward {
  const rng = new Rng((bossId * 2654435761) ^ hero.nextItemId);
  const item = rollDrop(rng, `i${hero.nextItemId}`, hero.level + 3, 2, 'epic', hero.cls ?? 'emberwright', MYTHIC_FROM_TIER, 'boss');
  hero.nextItemId++;
  hero.inventory.push(item);
  const embers = 50 + Math.floor(Math.max(0, damage) / 1000);
  hero.embers += embers;
  return { item, embers };
}

/** Which of two saves of the same hero has made more progress. */
export function newerHero(a: HeroProfile, b: HeroProfile): HeroProfile {
  // A reset is the player's choice: the copy made after more resets wins, whatever its progress.
  if ((a.resets ?? 0) !== (b.resets ?? 0)) return (a.resets ?? 0) > (b.resets ?? 0) ? a : b;
  const ta = totals(a);
  const tb = totals(b);
  if (ta.runs !== tb.runs) return ta.runs > tb.runs ? a : b;
  if (ta.levels !== tb.levels) return ta.levels > tb.levels ? a : b;
  if (ta.xp !== tb.xp) return ta.xp > tb.xp ? a : b;
  return a.nextItemId >= b.nextItemId ? a : b;
}

