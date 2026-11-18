/**
 * Emberwright talent tree: three branches, drafted on level-up during a run.
 * Taking CAPSTONE_RANKS ranks in one branch unlocks that branch's capstone,
 * which transforms the class (the survivors "evolution" moment).
 */
export type Branch = 'wildfire' | 'kindling' | 'ashguard' | 'general';

export type TalentId =
  | 'kindledGround'
  | 'emberRain'
  | 'searingBurn'
  | 'conflagration'
  | 'extraOrb'
  | 'quickcast'
  | 'searingFocus'
  | 'phoenixLance'
  | 'cinderSkin'
  | 'mend'
  | 'magnetism'
  | 'flicker'
  | 'rollingInferno'
  | 'heatSink'
  | 'ringOfAsh'
  | 'stoke'
  | 'smallHeal';

export interface TalentDef {
  id: TalentId;
  name: string;
  branch: Branch;
  maxRank: number;
  capstone?: boolean;
  /** Short line shown on the draft card; {r} is replaced with the next rank. */
  text: string;
}

export const CAPSTONE_RANKS = 4;

export const TALENTS: Record<TalentId, TalentDef> = {
  // Wildfire: area damage
  kindledGround: { id: 'kindledGround', name: 'Kindled Ground', branch: 'wildfire', maxRank: 3, text: 'Orbs leave burning ground behind.' },
  emberRain: { id: 'emberRain', name: 'Ember Rain', branch: 'wildfire', maxRank: 3, text: 'Every 4s, embers fall on nearby enemies.' },
  searingBurn: { id: 'searingBurn', name: 'Searing Burn', branch: 'wildfire', maxRank: 3, text: 'Orb hits set enemies on fire.' },
  rollingInferno: { id: 'rollingInferno', name: 'Rolling Inferno', branch: 'wildfire', maxRank: 3, text: 'Flame Wave costs 6 less Heat and leaves fire behind.' },
  conflagration: { id: 'conflagration', name: 'Conflagration', branch: 'wildfire', maxRank: 1, capstone: true, text: 'CAPSTONE: orbs explode on impact.' },
  // Kindling: projectiles and single target
  extraOrb: { id: 'extraOrb', name: 'Twin Cinders', branch: 'kindling', maxRank: 3, text: 'Cinder Volley fires one more orb.' },
  quickcast: { id: 'quickcast', name: 'Quickcast', branch: 'kindling', maxRank: 3, text: 'Cinder Volley fires 14% faster.' },
  searingFocus: { id: 'searingFocus', name: 'Searing Focus', branch: 'kindling', maxRank: 3, text: '+12% chance to crit for double damage.' },
  heatSink: { id: 'heatSink', name: 'Heat Sink', branch: 'kindling', maxRank: 3, text: 'Orb hits build 35% more Heat; Combustion recharges 3s faster.' },
  phoenixLance: { id: 'phoenixLance', name: 'Phoenix Lance', branch: 'kindling', maxRank: 1, capstone: true, text: 'CAPSTONE: a piercing lance every 2.5s.' },
  // Ashguard: defense and utility
  cinderSkin: { id: 'cinderSkin', name: 'Cinder Skin', branch: 'ashguard', maxRank: 3, text: '+25 max health, and heal 25.' },
  mend: { id: 'mend', name: 'Mend in Embers', branch: 'ashguard', maxRank: 3, text: 'Regenerate 0.8 health per second.' },
  magnetism: { id: 'magnetism', name: 'Ember Pull', branch: 'ashguard', maxRank: 3, text: '+40% pickup range, +6% move speed.' },
  flicker: { id: 'flicker', name: 'Flicker', branch: 'ashguard', maxRank: 3, text: 'Blink recharges 1.5s faster and shields you briefly.' },
  ringOfAsh: { id: 'ringOfAsh', name: 'Ring of Ash', branch: 'ashguard', maxRank: 1, capstone: true, text: 'CAPSTONE: three embers orbit and burn foes.' },
  // Fallbacks once the tree runs dry
  stoke: { id: 'stoke', name: 'Stoke the Flame', branch: 'general', maxRank: 99, text: '+10% damage.' },
  smallHeal: { id: 'smallHeal', name: 'Warm Hearth', branch: 'general', maxRank: 99, text: 'Heal 40 health.' },
};

export const BRANCH_NAMES: Record<Branch, string> = {
  wildfire: 'Wildfire',
  kindling: 'Kindling',
  ashguard: 'Ashguard',
  general: 'General',
};

/** The Emberwright action bar. Costs and cooldowns before talents. */
export interface AbilityDef {
  name: string;
  /** Keyboard key shown on the button. */
  key: string;
  cost: number;
  cooldown: number;
  /** Off the global cooldown (interrupts must always be usable). */
  offGcd?: boolean;
  text: string;
}

export const ABILITIES: AbilityDef[] = [
  { name: 'Flame Wave', key: 'Q', cost: 30, cooldown: 4, text: 'A cone of fire that knocks the horde back.' },
  { name: 'Blink', key: 'E', cost: 0, cooldown: 8, text: 'Teleport where you are moving, leaving fire behind.' },
  { name: 'Combustion', key: 'R', cost: 70, cooldown: 22, text: 'Detonate a big target and everything near it.' },
  { name: 'Quench', key: 'F', cost: 0, cooldown: 10, offGcd: true, text: 'Interrupt an enemy cast and stun it.' },
];

export const GCD = 0.4;
export const MAX_HEAT = 100;
