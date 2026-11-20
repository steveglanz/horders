/**
 * The Forge: the first use for embers. Upgrade raises an item's level and
 * rescales its stats; Temper rerolls its weakest bonus stat. Pure functions
 * over the hero, seeded from the hero's forge counter so a server can re-check
 * every result the same way it re-checks loot.
 */
import { Rng } from './rng';
import { HeroProfile } from './hero';
import { Item, Rarity, SLOT_MAIN, STATS, Stat } from './content/items';

/**
 * Forge cap: the best item level the hero can currently find (hero level plus
 * the highest tier unlocked) plus one. So the Forge keeps a favourite item
 * level with fresh drops, and slightly ahead, but never runs away from them.
 */
export const FORGE_LEVEL_LEAD = 1;

const RARITY_COST: Record<Rarity, number> = { common: 0.5, fine: 0.75, rare: 1, epic: 1.5, mythic: 2 };

/** Embers to raise an item by one level. */
export function upgradeCost(it: Item): number {
  return Math.ceil((4 + it.ilvl * 1.5) * RARITY_COST[it.rarity]);
}

/** Embers to temper an item (reroll its weakest bonus stat). */
export function temperCost(it: Item): number {
  return Math.ceil((6 + it.ilvl) * RARITY_COST[it.rarity]);
}

export function maxForgeLevel(h: HeroProfile): number {
  return h.level + Math.max(0, h.maxTier - 1) + FORGE_LEVEL_LEAD;
}

export type ForgeCheck = { ok: true; cost: number } | { ok: false; cost: number; reason: string };

export function canUpgrade(h: HeroProfile, it: Item): ForgeCheck {
  const cost = upgradeCost(it);
  if (it.ilvl >= maxForgeLevel(h)) return { ok: false, cost, reason: `Item level is capped at ${maxForgeLevel(h)}. Level up or unlock a higher tier to raise it` };
  if (h.embers < cost) return { ok: false, cost, reason: `Needs ${cost} embers` };
  return { ok: true, cost };
}

export function canTemper(h: HeroProfile, it: Item): ForgeCheck {
  const cost = temperCost(it);
  if (it.stats.length < 2) return { ok: false, cost, reason: 'Common items have no bonus stat to temper' };
  if (h.embers < cost) return { ok: false, cost, reason: `Needs ${cost} embers` };
  return { ok: true, cost };
}

/** Stat value per level the same way loot rolls it (item level + 5 base). */
function base(ilvl: number): number {
  return ilvl + 5;
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Raises the item one level. Returns false (and changes nothing) if not allowed. */
export function upgradeItem(h: HeroProfile, itemId: string): boolean {
  const it = h.inventory.find((i) => i.id === itemId);
  if (!it) return false;
  const check = canUpgrade(h, it);
  if (!check.ok) return false;
  const ratio = base(it.ilvl + 1) / base(it.ilvl);
  it.ilvl++;
  const main = SLOT_MAIN[it.slot];
  it.stats = it.stats.map((s, k) =>
    k === 0 && s.stat === main
      ? { stat: s.stat, value: round1(STATS[main].perLevel * base(it.ilvl) * 1.6) }
      : { stat: s.stat, value: round1(s.value * ratio) });
  h.embers -= check.cost;
  h.forged = (h.forged ?? 0) + 1;
  return true;
}

/**
 * Rerolls the weakest bonus stat (by its share of a fresh roll's average)
 * into a different stat the item doesn't have, at the item's level.
 */
export function temperItem(h: HeroProfile, itemId: string): { from: Stat; to: Stat } | null {
  const it = h.inventory.find((i) => i.id === itemId);
  if (!it) return null;
  const check = canTemper(h, it);
  if (!check.ok) return null;
  const rng = new Rng((hashId(it.id) * 2654435761) ^ ((h.forged ?? 0) + 1) * 40503);
  // Weakest bonus stat relative to what an average roll would give.
  let worst = 1;
  let worstShare = Infinity;
  for (let k = 1; k < it.stats.length; k++) {
    const s = it.stats[k];
    const share = s.value / (STATS[s.stat].perLevel * base(it.ilvl) * 0.95);
    if (share < worstShare) { worstShare = share; worst = k; }
  }
  const have = new Set(it.stats.map((s) => s.stat));
  const pool = (Object.keys(STATS) as Stat[]).filter((s) => !have.has(s));
  if (!pool.length) return null;
  const from = it.stats[worst].stat;
  const to = pool[rng.int(pool.length)];
  it.stats[worst] = { stat: to, value: round1(STATS[to].perLevel * base(it.ilvl) * rng.range(0.85, 1.2)) };
  h.embers -= check.cost;
  h.forged = (h.forged ?? 0) + 1;
  return { from, to };
}

function hashId(id: string): number {
  let x = 2166136261;
  for (let i = 0; i < id.length; i++) x = Math.imul(x ^ id.charCodeAt(i), 16777619);
  return x >>> 0;
}
