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
  { name: 'Shield Slam', key: 'Q', cost: 25, cooldown: 5, text: 'Slam the shield forward: a wide hit that stuns the horde.' },
  { name: 'Charge', key: 'E', cost: 0, cooldown: 9, text: 'Rush the biggest foe nearby and stun it.' },
  { name: 'Bastion', key: 'R', cost: 50, cooldown: 20, text: 'For 6s take 60% less damage and turn a quarter of it back on the attacker.' },
  { name: 'Shield Toss', key: 'F', cost: 0, cooldown: 10, offGcd: true, text: 'Throw the shield to interrupt a cast and stun the caster.' },
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
};

export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];
