/**
 * Talent trees for every class (the file keeps its first class's name), plus
 * the Emberwright's action bar. Each class has three branches, drafted on
 * level-up during a run.
 * Taking CAPSTONE_RANKS ranks in one branch unlocks that branch's capstone,
 * which transforms the class (the survivors "evolution" moment).
 */
export type Branch = 'wildfire' | 'kindling' | 'ashguard' | 'bloodletting' | 'tempo' | 'guard' | 'general';
export type ClassId = 'emberwright' | 'duskblade';

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
  | 'smallHeal'
  // Duskblade
  | 'serratedEdge'
  | 'hemorrhage'
  | 'deepCuts'
  | 'thirst'
  | 'crimsonTide'
  | 'quickBlades'
  | 'longReach'
  | 'precision'
  | 'momentumFlow'
  | 'bladeStorm'
  | 'thickHide'
  | 'secondWind'
  | 'nimble'
  | 'evasion'
  | 'riposte'
  // Emberwright ability talents
  | 'pyroclasm'
  | 'ignition'
  | 'blazingSpeed';

export interface TalentDef {
  id: TalentId;
  name: string;
  branch: Branch;
  /** Which class drafts it; shared fallbacks have none. */
  cls?: ClassId;
  maxRank: number;
  capstone?: boolean;
  /** Short line shown on the draft card; {r} is replaced with the next rank. */
  text: string;
}

/** Ranks in one branch that unlock its capstone. A run has about four drafts. */
export const CAPSTONE_RANKS = 3;

export const TALENTS: Record<TalentId, TalentDef> = {
  // Wildfire: area damage
  kindledGround: { id: 'kindledGround', cls: 'emberwright', name: 'Kindled Ground', branch: 'wildfire', maxRank: 3, text: 'Orbs leave burning ground behind.' },
  emberRain: { id: 'emberRain', cls: 'emberwright', name: 'Ember Rain', branch: 'wildfire', maxRank: 3, text: 'Every 4s, embers fall on nearby enemies.' },
  searingBurn: { id: 'searingBurn', cls: 'emberwright', name: 'Searing Burn', branch: 'wildfire', maxRank: 3, text: 'Orb hits set enemies on fire.' },
  rollingInferno: { id: 'rollingInferno', cls: 'emberwright', name: 'Rolling Inferno', branch: 'wildfire', maxRank: 3, text: 'Flame Wave costs 6 less Heat and leaves fire behind.' },
  pyroclasm: { id: 'pyroclasm', cls: 'emberwright', name: 'Pyroclasm', branch: 'wildfire', maxRank: 2, text: 'Combustion leaves a fire pool, and burning foes spread their fire when they die.' },
  conflagration: { id: 'conflagration', cls: 'emberwright', name: 'Conflagration', branch: 'wildfire', maxRank: 1, capstone: true, text: 'CAPSTONE: orbs explode on impact, scorching the target and everything near it.' },
  // Kindling: projectiles and single target
  extraOrb: { id: 'extraOrb', cls: 'emberwright', name: 'Twin Cinders', branch: 'kindling', maxRank: 3, text: 'Cinder Volley fires one more orb.' },
  quickcast: { id: 'quickcast', cls: 'emberwright', name: 'Quickcast', branch: 'kindling', maxRank: 3, text: 'Cinder Volley fires 14% faster.' },
  searingFocus: { id: 'searingFocus', cls: 'emberwright', name: 'Searing Focus', branch: 'kindling', maxRank: 3, text: '+12% chance to crit for double damage.' },
  heatSink: { id: 'heatSink', cls: 'emberwright', name: 'Heat Sink', branch: 'kindling', maxRank: 3, text: 'Orb hits build 35% more Heat; Combustion hits 20% harder and recharges 3s faster.' },
  ignition: { id: 'ignition', cls: 'emberwright', name: 'Ignition', branch: 'kindling', maxRank: 2, text: 'Flame Wave always crits. Rank 2: every crit cuts its cooldown by 0.3s.' },
  phoenixLance: { id: 'phoenixLance', cls: 'emberwright', name: 'Phoenix Lance', branch: 'kindling', maxRank: 1, capstone: true, text: 'CAPSTONE: a piercing lance every 2.5s.' },
  // Ashguard: defense and utility
  cinderSkin: { id: 'cinderSkin', cls: 'emberwright', name: 'Cinder Skin', branch: 'ashguard', maxRank: 3, text: '+25 max health, and heal 25.' },
  mend: { id: 'mend', cls: 'emberwright', name: 'Mend in Embers', branch: 'ashguard', maxRank: 3, text: 'Regenerate 0.8 health per second.' },
  magnetism: { id: 'magnetism', cls: 'emberwright', name: 'Ember Pull', branch: 'ashguard', maxRank: 3, text: '+40% pickup range, +6% move speed.' },
  flicker: { id: 'flicker', cls: 'emberwright', name: 'Flicker', branch: 'ashguard', maxRank: 3, text: 'Blink recharges 1.5s faster and shields you briefly.' },
  blazingSpeed: { id: 'blazingSpeed', cls: 'emberwright', name: 'Blazing Speed', branch: 'ashguard', maxRank: 2, text: 'Run 30% faster for 2s after Blink. Rank 2: Blink holds a second charge.' },
  ringOfAsh: { id: 'ringOfAsh', cls: 'emberwright', name: 'Ring of Ash', branch: 'ashguard', maxRank: 1, capstone: true, text: 'CAPSTONE: three embers orbit and burn foes.' },
  // Fallbacks once the tree runs dry
  stoke: { id: 'stoke', name: 'Stoke the Flame', branch: 'general', maxRank: 99, text: '+10% damage.' },
  smallHeal: { id: 'smallHeal', name: 'Warm Hearth', branch: 'general', maxRank: 99, text: 'Heal 40 health.' },

  // Duskblade. Bloodletting: bleeds and sustain
  serratedEdge: { id: 'serratedEdge', cls: 'duskblade', name: 'Serrated Edge', branch: 'bloodletting', maxRank: 3, text: 'Swings make enemies bleed.' },
  hemorrhage: { id: 'hemorrhage', cls: 'duskblade', name: 'Hemorrhage', branch: 'bloodletting', maxRank: 3, text: 'Bleeding enemies take 10% more damage from you.' },
  deepCuts: { id: 'deepCuts', cls: 'duskblade', name: 'Deep Cuts', branch: 'bloodletting', maxRank: 3, text: 'Rending Dash bleeds harder and recharges 1s faster.' },
  thirst: { id: 'thirst', cls: 'duskblade', name: 'Thirst', branch: 'bloodletting', maxRank: 3, text: 'Heal for 2% of the damage you deal.' },
  crimsonTide: { id: 'crimsonTide', cls: 'duskblade', name: 'Crimson Tide', branch: 'bloodletting', maxRank: 1, capstone: true, text: 'CAPSTONE: bleeding foes burst when they die, spreading the bleed.' },
  // Tempo: speed and crits
  quickBlades: { id: 'quickBlades', cls: 'duskblade', name: 'Quick Blades', branch: 'tempo', maxRank: 3, text: 'Swing 12% faster.' },
  longReach: { id: 'longReach', cls: 'duskblade', name: 'Long Reach', branch: 'tempo', maxRank: 3, text: 'Swings reach 15% farther and wider.' },
  precision: { id: 'precision', cls: 'duskblade', name: 'Precision', branch: 'tempo', maxRank: 3, text: '+12% chance to crit for double damage.' },
  momentumFlow: { id: 'momentumFlow', cls: 'duskblade', name: 'Flow', branch: 'tempo', maxRank: 3, text: 'Hits build 30% more Momentum; Execution recharges 3s faster.' },
  bladeStorm: { id: 'bladeStorm', cls: 'duskblade', name: 'Blade Storm', branch: 'tempo', maxRank: 1, capstone: true, text: 'CAPSTONE: every fourth swing is a full spin for double damage.' },
  // Guard: survival
  thickHide: { id: 'thickHide', cls: 'duskblade', name: 'Thick Hide', branch: 'guard', maxRank: 3, text: '+30 max health, and heal 30.' },
  secondWind: { id: 'secondWind', cls: 'duskblade', name: 'Second Wind', branch: 'guard', maxRank: 3, text: 'Regenerate 1 health per second.' },
  nimble: { id: 'nimble', cls: 'duskblade', name: 'Nimble', branch: 'guard', maxRank: 3, text: '+40% pickup range, +7% move speed.' },
  evasion: { id: 'evasion', cls: 'duskblade', name: 'Evasion', branch: 'guard', maxRank: 3, text: 'Sidestep recharges 1.5s faster; your next swing crits.' },
  riposte: { id: 'riposte', cls: 'duskblade', name: 'Riposte', branch: 'guard', maxRank: 1, capstone: true, text: 'CAPSTONE: every 6s, parry the next hit and strike back hard.' },
};

export const BRANCH_NAMES: Record<Branch, string> = {
  wildfire: 'Wildfire',
  kindling: 'Kindling',
  ashguard: 'Ashguard',
  bloodletting: 'Bloodletting',
  tempo: 'Tempo',
  guard: 'Guard',
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
