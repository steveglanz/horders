import type { DungeonId } from './content/dungeon';
/**
 * The persistent hero: levels, permanent talent points, inventory and gear.
 * Everything here is pure functions over plain data so it can run on the
 * server later (loot must be rolled server-side once cloud saves exist).
 */
import { KEYS, keyEmbers, keyStep } from './content/keys';
import { WeeklyQuest, WeeklyRun, WeeklyState, weekState, weeklyStep, weeklyTitle } from './content/weekly';
import { Rng } from './rng';
import { GRIT } from './content/scaling';
import { bountyEmbers } from './content/bounty';
import { ClassId } from './content/emberwright';
import { PotionId, potionCost } from './content/potions';
import type { SetId } from './content/sets';
import { RunSummary } from './world';
import {
  Item, MythicId, mythicPool, WeaponFxId, weaponFxFor, RARITIES, RARITY, RARITY_PREFIX, Rarity, SLOTS, SLOT_MAIN, SLOT_NAMES, STATS, Slot, Stat, WEAPON_NAMES,
} from './content/items';

export type PassiveId = 'might' | 'fortitude' | 'insight' | 'alacrity';

/**
 * Hero talents: permanent points bought with hero levels. `text` is the short label,
 * `tip` the long-press tooltip (what it does, per point, and at max).
 */
export const PASSIVES: Record<PassiveId, { name: string; text: string; tip: string; max: number }> = {
  might: { name: 'Might', text: '+3% damage per point', tip: 'Hit harder with everything. +3% damage per point, +30% at 10 points.', max: 10 },
  fortitude: { name: 'Fortitude', text: '+8 health per point', tip: 'More health. +8 max health per point, +80 at 10 points.', max: 10 },
  insight: {
    name: 'Insight', text: '+4% experience per point',
    tip: 'Level up faster during a delve, so you pick talent cards sooner. +4% experience per point, +20% at 5 points.', max: 5,
  },
  alacrity: {
    name: 'Alacrity', text: '+2% attack speed per point',
    tip: 'Your basic attack fires faster. +2% attack speed per point, +20% at 10 points.', max: 10,
  },
};

export const PITY_LIMIT = 10; // runs without an Epic or better before one is guaranteed
/** Mythics (build-changing items) only drop from this tier up, so the first ones are a milestone. */
export const MYTHIC_FROM_TIER = 3;

export interface HeroProfile {
  version: 1;
  level: number;
  xp: number;
  passives: Partial<Record<PassiveId, number>>;
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
  /** A potion brewed and waiting for the next delve (R8 Alchemy). */
  potion?: PotionId;
  /** P1: this week's quests (shared by every class, like the daily bounty). */
  weekly?: WeeklyState;
  /** Titles earned (P1 weekly quests give one for finishing all three). */
  titles?: string[];
  /** P3: Delver's Key level per solo dungeon, and the best key level beaten in each (for leaderboards). */
  keys?: Partial<Record<DungeonId, number>>;
  keyBest?: Partial<Record<DungeonId, number>>;
  /** Slagbinder stance (Anvil tanks, Bellows fills a damage slot); kept per character. Default Bellows. */
  stance?: 'anvil' | 'bellows';
}

/** What belongs to one class's character. The rest (class choice, item ids, Forge seed, daily bounty) is shared. */
export const CHARACTER_KEYS = ['level', 'xp', 'passives', 'embers', 'inventory', 'equipped', 'pity', 'runs', 'wins', 'bestTime', 'maxTier', 'grit', 'potion', 'keys', 'keyBest', 'stance'] as const;
export type Character = Pick<HeroProfile, (typeof CHARACTER_KEYS)[number]>;

function freshCharacter(): Character {
  const n = newHero();
  return { level: n.level, xp: n.xp, passives: {}, embers: n.embers, inventory: [], equipped: {}, pity: n.pity, runs: 0, wins: 0, bestTime: 0, maxTier: n.maxTier };
}

function takeCharacter(h: HeroProfile): Character {
  const c = {} as Record<string, unknown>;
  for (const k of CHARACTER_KEYS) if (h[k] !== undefined) c[k] = h[k];
  return c as unknown as Character;
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

/** The character for `cls`, whether it is being played or waiting in the roster. */
export function characterOf(h: HeroProfile, cls: ClassId): Character | undefined {
  return (h.cls ?? 'emberwright') === cls ? takeCharacter(h) : h.roster?.[cls];
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
export function loadoutFrom(passives: Partial<Record<PassiveId, number>>, items: Item[]): Loadout {
  const t: Record<Stat, number> = { power: 0, vitality: 0, haste: 0, crit: 0, swiftness: 0, reach: 0 };
  for (const it of items) for (const s of it.stats) t[s.stat] += s.value;
  const p = (id: PassiveId) => passives[id] ?? 0;
  return {
    dmgMult: (1 + t.power / 100) * (1 + 0.03 * p('might')),
    maxHpBonus: Math.round(t.vitality + 8 * p('fortitude')),
    hasteMult: (1 + t.haste / 100) * (1 + 0.02 * p('alacrity')),
    critBonus: t.crit / 100,
    speedMult: 1 + t.swiftness / 100,
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
}

/** One random item for a mid-run drop, at least `minRarity`. */
export function rollDrop(rng: Rng, id: string, ilvl: number, luck: number, minRarity: Rarity = 'common', cls?: ClassId, tier = MYTHIC_FROM_TIER): Item {
  let rarity = rollRarity(rng, luck, tier);
  if (RARITIES.indexOf(rarity) < RARITIES.indexOf(minRarity)) rarity = minRarity;
  const slot = SLOTS[rng.int(SLOTS.length)];
  return makeItem(rng, id, slot, rarity, Math.max(1, ilvl + rng.int(3) - 1), cls);
}

function rollRarity(rng: Rng, luck: number, tier = MYTHIC_FROM_TIER): Rarity {
  const weights = RARITIES.map((r) => (r === 'mythic' && tier < MYTHIC_FROM_TIER ? 0 : RARITY[r].weight * (r === 'common' ? 1 : luck)));
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rng.next() * total;
  for (let i = 0; i < RARITIES.length; i++) {
    x -= weights[i];
    if (x <= 0) return RARITIES[i];
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
  // Class weapon effect on an Epic or Mythic weapon found by a class.
  if (slot === 'weapon' && cls && (rarity === 'epic' || rarity === 'mythic')) item.weaponFx = weaponFxFor(cls, id);
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
  const luck = (s.victory ? 1.6 : 1) * (1 + 0.12 * (tier - 1));
  const items: Item[] = [];
  let pity = hero.pity;
  let gotEpic = runDrops.some((i) => i.rarity === 'epic' || i.rarity === 'mythic');
  for (let k = 0; k < count; k++) {
    let rarity = rollRarity(rng, luck, tier);
    // Bad-luck protection: after enough dry runs the last drop is upgraded.
    if (k === count - 1 && !gotEpic && pity + 1 >= PITY_LIMIT && (rarity === 'common' || rarity === 'fine' || rarity === 'rare')) {
      rarity = 'epic';
    }
    if (rarity === 'epic' || rarity === 'mythic') gotEpic = true;
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
  const heroXp = Math.round(heroXpForRun(s) * xpMult);
  const loot = rollLoot(seed, s, hero, eliteKilled, runDrops);
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
      if ((s.tier ?? 1) >= hero.maxTier) hero.maxTier = (s.tier ?? 1) + 1;
    }
  }
  const weekly = s.week !== undefined ? applyWeekly(hero, s, maxTierBefore) : undefined;
  hero.bestTime = Math.max(hero.bestTime, s.time);
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
  return { heroXp, items: [...runDrops, ...loot.items], levelsGained: levels, bountyEmbers: bountyEmbersPaid, ...weekly, ...key };
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
  };
  const done: WeeklyQuest[] = [];
  let embers = 0;
  for (const q of st.quests) {
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

export function spendPoint(hero: HeroProfile, id: PassiveId): boolean {
  if (pointsAvailable(hero) <= 0) return false;
  const r = hero.passives[id] ?? 0;
  if (r >= PASSIVES[id].max) return false;
  hero.passives[id] = r + 1;
  return true;
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
  const item = rollDrop(rng, `i${hero.nextItemId}`, hero.level + 3, 2, 'epic', hero.cls ?? 'emberwright');
  hero.nextItemId++;
  hero.inventory.push(item);
  const embers = 50 + Math.floor(Math.max(0, damage) / 1000);
  hero.embers += embers;
  return { item, embers };
}

/** Which of two saves of the same hero has made more progress. */
export function newerHero(a: HeroProfile, b: HeroProfile): HeroProfile {
  const ta = totals(a);
  const tb = totals(b);
  if (ta.runs !== tb.runs) return ta.runs > tb.runs ? a : b;
  if (ta.levels !== tb.levels) return ta.levels > tb.levels ? a : b;
  if (ta.xp !== tb.xp) return ta.xp > tb.xp ? a : b;
  return a.nextItemId >= b.nextItemId ? a : b;
}

/** Why a potion can't be brewed right now, or null if it can. */
export function brewBlocker(hero: HeroProfile, id: PotionId): string | null {
  if (hero.potion === id) return 'Already brewed for your next delve';
  const cost = potionCost(id, hero.maxTier);
  if (hero.embers < cost) return `Needs ${cost} embers`;
  return null;
}

/**
 * Brews a potion for the next delve. Only one waits at a time: brewing a
 * different one pours the old one away (no refund), so the choice matters.
 */
export function brewPotion(hero: HeroProfile, id: PotionId): boolean {
  if (brewBlocker(hero, id)) return false;
  hero.embers -= potionCost(id, hero.maxTier);
  hero.potion = id;
  return true;
}

/** Takes the waiting potion for a delve that's starting (it's used up either way). */
export function takePotion(hero: HeroProfile): PotionId | undefined {
  const p = hero.potion;
  hero.potion = undefined;
  return p;
}
