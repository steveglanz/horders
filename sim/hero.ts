/**
 * The persistent hero: levels, permanent talent points, inventory and gear.
 * Everything here is pure functions over plain data so it can run on the
 * server later (loot must be rolled server-side once cloud saves exist).
 */
import { Rng } from './rng';
import { GRIT } from './content/scaling';
import { bountyEmbers } from './content/bounty';
import { ClassId } from './content/emberwright';
import { RunSummary } from './world';
import {
  Item, MYTHICS, MythicId, RARITIES, RARITY, RARITY_PREFIX, Rarity, SLOTS, SLOT_MAIN, SLOT_NAMES, STATS, Slot, Stat,
} from './content/items';

export type PassiveId = 'might' | 'fortitude' | 'insight' | 'alacrity';

export const PASSIVES: Record<PassiveId, { name: string; text: string; max: number }> = {
  might: { name: 'Might', text: '+3% damage per point', max: 10 },
  fortitude: { name: 'Fortitude', text: '+8 health per point', max: 10 },
  insight: { name: 'Insight', text: '+4% experience per point', max: 5 },
  alacrity: { name: 'Alacrity', text: '+2% attack speed per point', max: 10 },
};

export const PITY_LIMIT = 10; // runs without an Epic or better before one is guaranteed

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
}

export const EMPTY_LOADOUT: Loadout = {
  dmgMult: 1, maxHpBonus: 0, hasteMult: 1, critBonus: 0, speedMult: 1, pickupMult: 1, xpMult: 1, mythics: [],
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
}

/** One random item for a mid-run drop, at least `minRarity`. */
export function rollDrop(rng: Rng, id: string, ilvl: number, luck: number, minRarity: Rarity = 'common'): Item {
  let rarity = rollRarity(rng, luck);
  if (RARITIES.indexOf(rarity) < RARITIES.indexOf(minRarity)) rarity = minRarity;
  const slot = SLOTS[rng.int(SLOTS.length)];
  return makeItem(rng, id, slot, rarity, Math.max(1, ilvl + rng.int(3) - 1));
}

function rollRarity(rng: Rng, luck: number): Rarity {
  const weights = RARITIES.map((r) => RARITY[r].weight * (r === 'common' ? 1 : luck));
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rng.next() * total;
  for (let i = 0; i < RARITIES.length; i++) {
    x -= weights[i];
    if (x <= 0) return RARITIES[i];
  }
  return 'common';
}

export function makeItem(rng: Rng, id: string, slot: Slot, rarity: Rarity, ilvl: number): Item {
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
  const nouns = SLOT_NAMES[slot];
  const item: Item = {
    id, slot, rarity, ilvl,
    name: `${prefixes[rng.int(prefixes.length)]} ${nouns[rng.int(nouns.length)]}`,
    stats,
  };
  if (rarity === 'mythic') {
    const ids = Object.keys(MYTHICS) as MythicId[];
    item.mythic = ids[rng.int(ids.length)];
  }
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
    let rarity = rollRarity(rng, luck);
    // Bad-luck protection: after enough dry runs the last drop is upgraded.
    if (k === count - 1 && !gotEpic && pity + 1 >= PITY_LIMIT && (rarity === 'common' || rarity === 'fine' || rarity === 'rare')) {
      rarity = 'epic';
    }
    if (rarity === 'epic' || rarity === 'mythic') gotEpic = true;
    const slot = SLOTS[rng.int(SLOTS.length)];
    const ilvl = Math.max(1, baseIlvl + rng.int(3) - 1);
    items.push(makeItem(rng, `i${hero.nextItemId + runDrops.length + k}`, slot, rarity, ilvl));
  }
  pity = gotEpic ? 0 : pity + 1;
  return { items, pity };
}

/**
 * Applies a finished run to the hero and returns what was earned.
 * `runDrops` are items picked up during the run (ids from `runItemIds`);
 * `runEquipped` are the ids the run auto-equipped as upgrades.
 */
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
  let bountyEmbersPaid = 0;
  if (s.bounty !== undefined) {
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
    if (s.victory) hero.grit = undefined;
    else hero.grit = { key, stacks: Math.min(GRIT.maxStacks, (hero.grit?.key === key ? hero.grit.stacks : 0) + 1) };
    if (s.victory) {
      hero.wins++;
      if ((s.tier ?? 1) >= hero.maxTier) hero.maxTier = (s.tier ?? 1) + 1;
    }
  }
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
  return { heroXp, items: [...runDrops, ...loot.items], levelsGained: levels, bountyEmbers: bountyEmbersPaid };
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
  const item = rollDrop(rng, `i${hero.nextItemId}`, hero.level + 3, 2, 'epic');
  hero.nextItemId++;
  hero.inventory.push(item);
  const embers = 50 + Math.floor(Math.max(0, damage) / 1000);
  hero.embers += embers;
  return { item, embers };
}

/** Which of two saves of the same hero has made more progress. */
export function newerHero(a: HeroProfile, b: HeroProfile): HeroProfile {
  if (a.runs !== b.runs) return a.runs > b.runs ? a : b;
  if (a.level !== b.level) return a.level > b.level ? a : b;
  if (a.xp !== b.xp) return a.xp > b.xp ? a : b;
  return a.nextItemId >= b.nextItemId ? a : b;
}
