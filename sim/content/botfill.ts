/**
 * Fill with bots: a solo hero can take bot allies into a group dungeon. The
 * guardrails keep it a way to play, not a way to farm. Spec and measurements:
 * docs/design/botfill.md.
 */
import { DUNGEONS, DungeonId, roleOf } from './dungeon';
import type { ClassId } from './emberwright';
import type { Item } from './items';

export const BOT_FILL = {
  /** A bot's stand-in gear carries this share of the player's item stats. */
  gearScale: 0.8,
  /** Bots fill the party up to this many heroes. */
  partySize: 4,
};

/**
 * A bot ally's gear: the player's own equipped items at BOT_FILL.gearScale of their
 * stats, with the specials taken off (no Mythic, no class weapon effect, no set piece).
 * A bot is always weaker geared than the hero it fights beside.
 */
export function standInGear(items: Item[], scale = BOT_FILL.gearScale): Item[] {
  return items.map((it) => ({
    id: `bot-${it.id}`, slot: it.slot, rarity: it.rarity, ilvl: it.ilvl, name: it.name,
    stats: it.stats.map((s) => ({ stat: s.stat, value: Math.round(s.value * scale * 10) / 10 })),
  }));
}

/** Why bots can't fill this dungeon, or '' if they can. */
export function botFillBlocker(d: DungeonId): string {
  const def = DUNGEONS[d];
  if (def.style !== 'group') return 'Solo dungeon: no bots needed';
  if (def.raid) return 'The raid needs four real heroes';
  // Taking turns is the whole fight, and bots never miss a turn: a bot fill won as often as a real party.
  if (d === 'pressworks') return 'Taking turns needs real heroes';
  return '';
}

/**
 * The classes the bots bring, filling the party to BOT_FILL.partySize: a tank and a
 * healer first if the party lacks them, then damage classes the party doesn't have yet.
 */
export function fillClasses(party: { cls: string; stance?: string }[]): ClassId[] {
  const have = party.map((p) => p.cls);
  const out: ClassId[] = [];
  const all = (): string[] => [...have, ...out];
  const roles = party.map((p) => roleOf(p.cls, p.stance));
  if (!roles.includes('tank')) out.push('bulwark');
  if (!roles.includes('healer')) out.push('lumen');
  // Damage: the measured bot classes the party lacks first, then repeats.
  const damage: ClassId[] = ['duskblade', 'emberwright'];
  const order = [...damage.filter((c) => !have.includes(c)), ...damage];
  for (const c of order) if (all().length < BOT_FILL.partySize) out.push(c);
  return out;
}
