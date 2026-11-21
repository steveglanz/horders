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
  { name: 'Interpose', key: 'E', cost: 0, cooldown: 10, text: 'Leap where you are moving and shove small foes aside. In a party, leap to the most hurt ally and take most of their hits for 3s.' },
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
    id: 'slagbinder', name: 'Slagbinder', role: 'Off-tank', blurb: 'Molten plate for you and your friends. Brittle foes break.',
    resource: 'Slag', baseHp: 150, speed: 134, interruptRange: 380, abilities: SLAGBINDER_ABILITIES,
  },
};

export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

/**
 * Ability options (one per class, unlocked at hero level 8): a sidegrade for one action-bar slot,
 * picked in the hub and locked for the run. Never the interrupt (slot 3). See docs/skills.md.
 */
export const ALT_UNLOCK_LEVEL = 8;
export const ALT_ABILITIES: Record<ClassId, { slot: number; replaces: string; def: AbilityDef }> = {
  emberwright: { slot: 1, replaces: 'Blink', def: { name: 'Ember Ward', key: 'E', cost: 0, cooldown: 10, text: 'Wrap yourself in fire for 3s: a ward that stops blows (not Glare or ticks), and foes that strike you burn.' } },
  duskblade: { slot: 0, replaces: 'Rending Dash', def: { name: 'Hamstring', key: 'Q', cost: 25, cooldown: 5, text: 'Cut and bleed the foe in reach, and slow it and those near it by half for 4s (bosses and elites by a fifth). Better against single targets; you lose Rending Dash\'s gap-closer.' } },
  bulwark: { slot: 2, replaces: 'Anvil Skin', def: { name: 'Muster', key: 'R', cost: 50, cooldown: 20, text: 'For 5s, heroes near you take 25% less damage. Alone, you mend 15% of your health instead.' } },
  lumen: { slot: 1, replaces: 'Glimmer Step', def: { name: 'Glow Pool', key: 'E', cost: 0, cooldown: 12, text: 'Set down a well of light for 6s that heals anyone in it 3 a second. It never clears Slag Grip.' } },
  slagbinder: { slot: 1, replaces: 'Interpose', def: { name: 'Cinder Sump', key: 'E', cost: 0, cooldown: 10, text: 'Pour a pit at your target for 5s: foes in it slow by 40% (bosses and elites by a fifth) and burn.' } },
};
