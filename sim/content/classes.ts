/**
 * Playable classes: base stats, resource and action bar. Talents live with
 * the trees in emberwright.ts (tagged by class).
 */
import { ABILITIES, AbilityDef, ClassId } from './emberwright';

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  blurb: string;
  /** What the action-bar resource is called. */
  resource: string;
  baseHp: number;
  speed: number;
  /** How far the interrupt (slot 3) reaches. */
  interruptRange: number;
  abilities: AbilityDef[];
}

export const DUSKBLADE_ABILITIES: AbilityDef[] = [
  { name: 'Rending Dash', key: 'Q', cost: 25, cooldown: 5, text: 'Dash through enemies to your target, cutting and bleeding everything in the way.' },
  { name: 'Sidestep', key: 'E', cost: 0, cooldown: 7, text: 'Slip aside and dodge every hit for a moment.' },
  { name: 'Execution', key: 'R', cost: 60, cooldown: 18, text: 'A huge strike on the target in reach. Double damage below 35% health.' },
  { name: 'Kick', key: 'F', cost: 0, cooldown: 10, offGcd: true, text: 'Interrupt a nearby enemy cast and stun it. You have to be close.' },
];

export const BULWARK_ABILITIES: AbilityDef[] = [
  { name: 'Rim Smash', key: 'Q', cost: 25, cooldown: 5, text: 'Slam the shield forward: a wide hit that stuns the horde.' },
  { name: 'Charge', key: 'E', cost: 0, cooldown: 9, text: 'Rush the biggest foe nearby and stun it.' },
  { name: 'Anvil Skin', key: 'R', cost: 50, cooldown: 20, text: 'For 6s take 60% less damage and turn a quarter of it back on the attacker.' },
  { name: 'Shield Toss', key: 'F', cost: 0, cooldown: 10, offGcd: true, text: 'Throw the shield to interrupt a cast and stun the caster. In a party, with nothing to interrupt, it takes the boss back.' },
];

export const LUMEN_ABILITIES: AbilityDef[] = [
  { name: 'Radiant Burst', key: 'Q', cost: 25, cooldown: 4, text: 'A pulse of light: heals you and burns everything close.' },
  { name: 'Glimmer Step', key: 'E', cost: 0, cooldown: 8, text: 'Step through light to where you are moving.' },
  { name: 'Sanctuary', key: 'R', cost: 60, cooldown: 22, text: 'Hallow the ground for 6s: you heal inside it and foes burn.' },
  { name: 'Hush', key: 'F', cost: 0, cooldown: 10, offGcd: true, text: "Silence an enemy cast and stun the caster. In a party, with nothing to silence, it clears an ally's Slag Grip." },
];

export const SLAGBINDER_ABILITIES: AbilityDef[] = [
  { name: 'Molten Plating', key: 'Q', cost: 30, cooldown: 6, text: 'Plate yourself in slag: a ward that bursts when it breaks or runs out. In a party, it plates the most hurt hero near you, at half thickness on an ally.' },
  { name: 'Recoil', key: 'E', cost: 0, cooldown: 10, text: 'Leap where you are moving (away from the nearest foe if standing still) and shove small foes aside.' },
  { name: 'Cooling Shell', key: 'R', cost: 60, cooldown: 24, text: 'For 5s take 35% less damage, and whatever hits you turns Brittle. In a party, heroes beside you take 20% less.' },
  { name: 'Clinker', key: 'F', cost: 0, cooldown: 10, offGcd: true, text: 'Hurl a clinker to interrupt a cast and stun the caster. In a party, with nothing to interrupt, it makes the boss Brittle.' },
];

export const CLASSES: Record<ClassId, ClassDef> = {
  emberwright: {
    id: 'emberwright', name: 'Emberwright', role: 'Ranged caster', blurb: 'Fire orbs, burning ground.',
    resource: 'Heat', baseHp: 120, speed: 140, interruptRange: 520, abilities: ABILITIES,
  },
  duskblade: {
    id: 'duskblade', name: 'Duskblade', role: 'Melee striker', blurb: 'Twin blades, bleeds, dashes.',
    resource: 'Momentum', baseHp: 190, speed: 152, interruptRange: 210, abilities: DUSKBLADE_ABILITIES,
  },
  bulwark: {
    id: 'bulwark', name: 'Bulwark', role: 'Tank', blurb: 'Shield and armor. Soak the hits, hit back.',
    resource: 'Resolve', baseHp: 160, speed: 128, interruptRange: 420, abilities: BULWARK_ABILITIES,
  },
  lumen: {
    id: 'lumen', name: 'Lumen', role: 'Healer', blurb: 'Light that mends. Overhealing turns into damage.',
    resource: 'Radiance', baseHp: 100, speed: 138, interruptRange: 480, abilities: LUMEN_ABILITIES,
  },
  slagbinder: {
    id: 'slagbinder', name: 'Slagbinder', role: 'Ranged gunner', blurb: 'A slow slag cannon that hits hard and pierces. Brittle foes break.',
    resource: 'Slag', baseHp: 150, speed: 134, interruptRange: 380, abilities: SLAGBINDER_ABILITIES,
  },
};

export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

/**
 * The Slagbinder plays as the cannon gunner (Steve 25 Nov; SLAG_KIT.cannon* in sim/world.ts): no stances, the Bulwark
 * is the only tank. Tools turn it off with GUNNER=0 for before/after measuring.
 */
export const SLAG_GUNNER = true;

/**
 * Ability unlocks (class progression brief, 25 Nov): a new character starts with its basic attack and Q and earns
 * the other buttons over its first levels. SLOT_UNLOCK[slot] is the character level that slot opens at.
 */
export const SLOT_UNLOCK = [1, 2, 3, 4];
/** The level at which every slot is open. */
export const MAX_UNLOCK = Math.max(...SLOT_UNLOCK);
/** Whether a character of `level` has unlocked `slot` (no level means every slot, as tools and tests play). */
export function slotOpen(slot: number, level: number | undefined): boolean {
  if (level === undefined) return true;
  return slot === 0 || level >= (SLOT_UNLOCK[slot] ?? 1);
}

/**
 * Ability options: sidegrades for the action bar, picked in the hub and locked for the run, saved per character.
 * Each class earns up to three, at hero levels 8, 12 and 16, each for a different slot (never the interrupt, slot 3),
 * so by level 16 Q, E and R each have two abilities to choose from. See docs/skills.md, "Ability options".
 */
export type AltId = 'emberWard' | 'hamstring' | 'muster' | 'glowPool' | 'cinderSump' | 'wideCut' | 'quicken' | 'clout' | 'gather';
export interface AltOption { id: AltId; slot: number; level: number; replaces: string; def: AbilityDef }
export const ALT_UNLOCK_LEVEL = 8;
export const ALT_OPTIONS: Record<ClassId, AltOption[]> = {
  emberwright: [
    { id: 'emberWard', slot: 1, level: 8, replaces: 'Blink', def: { name: 'Ember Ward', key: 'E', cost: 0, cooldown: 10, text: 'Wrap yourself in fire for 3s: a ward that stops blows (not Glare or ticks), and foes that strike you burn.' } },
  ],
  duskblade: [
    { id: 'hamstring', slot: 0, level: 8, replaces: 'Rending Dash', def: { name: 'Hamstring', key: 'Q', cost: 25, cooldown: 5, text: 'Cut and bleed the foe in reach, and slow it and those near it by half for 4s (bosses and elites by a fifth). Better against single targets; you lose Rending Dash\'s gap-closer.' } },
    { id: 'wideCut', slot: 2, level: 12, replaces: 'Execution', def: { name: 'Wide Cut', key: 'R', cost: 60, cooldown: 18, text: 'Spin your blades through every foe around you: 110 damage and a 4s bleed to each. Better against packs; Execution is better on one big foe.' } },
    { id: 'quicken', slot: 1, level: 16, replaces: 'Sidestep', def: { name: 'Quicken', key: 'E', cost: 0, cooldown: 12, text: 'For 5s your blades swing 40% faster. You give up Sidestep\'s dodge and mend.' } },
  ],
  bulwark: [
    { id: 'muster', slot: 2, level: 8, replaces: 'Anvil Skin', def: { name: 'Muster', key: 'R', cost: 50, cooldown: 20, text: 'For 5s, heroes near you take 25% less damage. Alone, you mend 15% of your health instead.' } },
    { id: 'clout', slot: 0, level: 12, replaces: 'Rim Smash', def: { name: 'Clout', key: 'Q', cost: 25, cooldown: 5, text: 'Club the foe in front for 120 (50 to foes pressed against it), stun and shove it back, and mend half the damage dealt. Better on one big foe; Rim Smash is better on packs.' } },
    { id: 'gather', slot: 1, level: 16, replaces: 'Charge', def: { name: 'Gather', key: 'E', cost: 0, cooldown: 12, text: 'Drag every foe within 260 to your shield and hold their eyes on you; for 4s you take 20% less damage, and you gain 10 Resolve. Big foes are not moved but are stunned briefly. You give up Charge\'s rush and stun.' } },
  ],
  lumen: [
    { id: 'glowPool', slot: 1, level: 8, replaces: 'Glimmer Step', def: { name: 'Glow Pool', key: 'E', cost: 0, cooldown: 12, text: 'Set down a well of light for 6s that heals anyone in it 3 a second. It never clears Slag Grip.' } },
  ],
  slagbinder: [
    { id: 'cinderSump', slot: 1, level: 8, replaces: 'Recoil', def: { name: 'Cinder Sump', key: 'E', cost: 0, cooldown: 10, text: 'Pour a pit at your target for 5s: foes in it slow by 40% (bosses and elites by a fifth) and burn.' } },
  ],
};
/** Each class's first option (level 8). */
export const ALT_ABILITIES: Record<ClassId, AltOption> = Object.fromEntries(Object.entries(ALT_OPTIONS).map(([c, l]) => [c, l[0]])) as Record<ClassId, AltOption>;
/** Every option by id. */
export const ALT_BY_ID: Record<AltId, AltOption & { cls: ClassId }> = Object.fromEntries(
  Object.entries(ALT_OPTIONS).flatMap(([c, l]) => l.map((o) => [o.id, { ...o, cls: c as ClassId }])),
) as Record<AltId, AltOption & { cls: ClassId }>;

/** The picked options of `cls` that are real (this class's, one per slot, first pick wins). */
export function cleanAlts(cls: ClassId, picked: readonly string[] | undefined): AltId[] {
  const out: AltId[] = [];
  const used = new Set<number>();
  for (const id of picked ?? []) {
    const o = ALT_OPTIONS[cls].find((x) => x.id === id);
    if (!o || used.has(o.slot)) continue;
    used.add(o.slot);
    out.push(o.id);
  }
  return out;
}
