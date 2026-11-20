/**
 * Talent trees for every class (the file keeps its first class's name), plus
 * the Emberwright's action bar. Each class has three branches, drafted on
 * level-up during a run.
 * Taking CAPSTONE_RANKS ranks in one branch unlocks that branch's capstone,
 * which transforms the class (the survivors "evolution" moment).
 */
export type Branch =
  | 'wildfire' | 'kindling' | 'ashguard'
  | 'bloodletting' | 'tempo' | 'guard'
  | 'bastion' | 'retribution' | 'vanguard'
  | 'dawn' | 'grace' | 'choir'
  | 'general';
export type ClassId = 'emberwright' | 'duskblade' | 'bulwark' | 'lumen';

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
  | 'blazingSpeed'
  // Duskblade ability talents
  | 'exsanguinate'
  | 'flurryStep'
  | 'counterstep'
  // Bulwark
  | 'holdTheLine'
  | 'ward'
  | 'lastStand'
  | 'unbreakable'
  | 'spikedShield'
  | 'vengeance'
  | 'shieldEcho'
  | 'thornwall'
  | 'wideSweep'
  | 'momentum'
  | 'batteringRam'
  | 'warpath'
  // Lumen
  | 'kindledLight'
  | 'searingRadiance'
  | 'sunflare'
  | 'noon'
  | 'aegisOfLight'
  | 'renewal'
  | 'blessedGround'
  | 'martyrsHalo'
  | 'hastedHymn'
  | 'prism'
  | 'lingeringSanctuary'
  | 'choirOfDawn';

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
  exsanguinate: { id: 'exsanguinate', cls: 'duskblade', name: 'Exsanguinate', branch: 'bloodletting', maxRank: 2, text: 'Execution also tears open the target\'s bleed, dealing 3s of it at once (6s at rank 2).' },
  crimsonTide: { id: 'crimsonTide', cls: 'duskblade', name: 'Crimson Tide', branch: 'bloodletting', maxRank: 1, capstone: true, text: 'CAPSTONE: bleeding foes burst when they die, spreading the bleed.' },
  // Tempo: speed and crits
  quickBlades: { id: 'quickBlades', cls: 'duskblade', name: 'Quick Blades', branch: 'tempo', maxRank: 3, text: 'Swing 12% faster.' },
  longReach: { id: 'longReach', cls: 'duskblade', name: 'Long Reach', branch: 'tempo', maxRank: 3, text: 'Swings reach 15% farther and wider.' },
  precision: { id: 'precision', cls: 'duskblade', name: 'Precision', branch: 'tempo', maxRank: 3, text: '+12% chance to crit for double damage.' },
  momentumFlow: { id: 'momentumFlow', cls: 'duskblade', name: 'Flow', branch: 'tempo', maxRank: 3, text: 'Hits build 30% more Momentum; Execution recharges 3s faster.' },
  flurryStep: { id: 'flurryStep', cls: 'duskblade', name: 'Flurry Step', branch: 'tempo', maxRank: 2, text: 'Rending Dash comes back at once if it kills. Rank 2: it costs 10 less Momentum.' },
  bladeStorm: { id: 'bladeStorm', cls: 'duskblade', name: 'Blade Storm', branch: 'tempo', maxRank: 1, capstone: true, text: 'CAPSTONE: every fourth swing is a full spin for double damage.' },
  // Guard: survival
  thickHide: { id: 'thickHide', cls: 'duskblade', name: 'Thick Hide', branch: 'guard', maxRank: 3, text: '+30 max health, and heal 30.' },
  secondWind: { id: 'secondWind', cls: 'duskblade', name: 'Second Wind', branch: 'guard', maxRank: 3, text: 'Regenerate 1 health per second.' },
  nimble: { id: 'nimble', cls: 'duskblade', name: 'Nimble', branch: 'guard', maxRank: 3, text: '+40% pickup range, +7% move speed.' },
  evasion: { id: 'evasion', cls: 'duskblade', name: 'Evasion', branch: 'guard', maxRank: 3, text: 'Sidestep recharges 1.5s faster; your next swing crits.' },
  counterstep: { id: 'counterstep', cls: 'duskblade', name: 'Counterstep', branch: 'guard', maxRank: 2, text: 'Sidestep cuts the nearest foe for 60 as you land. Rank 2: you dodge for twice as long.' },
  riposte: { id: 'riposte', cls: 'duskblade', name: 'Riposte', branch: 'guard', maxRank: 1, capstone: true, text: 'CAPSTONE: every 6s, parry the next hit and strike back hard.' },

  // Bulwark. Bastion: soak and shields
  holdTheLine: { id: 'holdTheLine', cls: 'bulwark', name: 'Hold the Line', branch: 'bastion', maxRank: 3, text: '+30 max health and 4% less damage taken.' },
  ward: { id: 'ward', cls: 'bulwark', name: 'Ward', branch: 'bastion', maxRank: 3, text: 'Every 8s, gain a shield worth 8% of your max health.' },
  lastStand: { id: 'lastStand', cls: 'bulwark', name: 'Last Stand', branch: 'bastion', maxRank: 2, text: 'Bastion also heals 12% of your max health.' },
  unbreakable: { id: 'unbreakable', cls: 'bulwark', name: 'Unbreakable', branch: 'bastion', maxRank: 1, capstone: true, text: 'CAPSTONE: when Bastion ends, it bursts for the damage it stopped.' },
  // Retribution: thorns and anger
  spikedShield: { id: 'spikedShield', cls: 'bulwark', name: 'Spiked Shield', branch: 'retribution', maxRank: 3, text: 'Enemies that hit you take 8 damage back.' },
  vengeance: { id: 'vengeance', cls: 'bulwark', name: 'Vengeance', branch: 'retribution', maxRank: 3, text: '+4% damage for every 10% of health you are missing.' },
  shieldEcho: { id: 'shieldEcho', cls: 'bulwark', name: 'Shield Echo', branch: 'retribution', maxRank: 2, text: 'Shield Slam strikes again 0.4s later for half damage. Rank 2: each slam also builds 10 Resolve.' },
  thornwall: { id: 'thornwall', cls: 'bulwark', name: 'Thornwall', branch: 'retribution', maxRank: 1, capstone: true, text: 'CAPSTONE: you always turn back 15% of each hit, and damage you turn back hits every enemy around you.' },
  // Vanguard: cleave and charge
  wideSweep: { id: 'wideSweep', cls: 'bulwark', name: 'Wide Sweep', branch: 'vanguard', maxRank: 2, text: 'Shield Sweep swings wider and farther. Rank 2: a full circle.' },
  momentum: { id: 'momentum', cls: 'bulwark', name: 'Momentum', branch: 'vanguard', maxRank: 3, text: '+5% move speed; Charge recharges 2s faster.' },
  batteringRam: { id: 'batteringRam', cls: 'bulwark', name: 'Battering Ram', branch: 'vanguard', maxRank: 2, text: 'Charge hits and stuns everything in its path.' },
  warpath: { id: 'warpath', cls: 'bulwark', name: 'Warpath', branch: 'vanguard', maxRank: 1, capstone: true, text: 'CAPSTONE: every 4th Shield Sweep sends out a shockwave for double damage.' },

  // Lumen. Dawn: healing turned into damage
  kindledLight: { id: 'kindledLight', cls: 'lumen', name: 'Kindled Light', branch: 'dawn', maxRank: 3, text: 'Overhealing stores 30% more Brilliance.' },
  searingRadiance: { id: 'searingRadiance', cls: 'lumen', name: 'Searing Radiance', branch: 'dawn', maxRank: 3, text: 'Sunmotes deal 15% more damage.' },
  sunflare: { id: 'sunflare', cls: 'lumen', name: 'Sunflare', branch: 'dawn', maxRank: 2, text: 'Radiant Burst reaches 40 farther and hits 50% harder.' },
  noon: { id: 'noon', cls: 'lumen', name: 'High Noon', branch: 'dawn', maxRank: 1, capstone: true, text: 'CAPSTONE: every 4s, stored Brilliance fires a piercing sunbeam.' },
  // Grace: shields and staying alive
  aegisOfLight: { id: 'aegisOfLight', cls: 'lumen', name: 'Aegis of Light', branch: 'grace', maxRank: 3, text: 'Radiant Burst also shields you for 8% of your max health.' },
  renewal: { id: 'renewal', cls: 'lumen', name: 'Renewal', branch: 'grace', maxRank: 3, text: '+20 max health and 1 health per second.' },
  blessedGround: { id: 'blessedGround', cls: 'lumen', name: 'Blessed Ground', branch: 'grace', maxRank: 2, text: 'Glimmer Step leaves a pool that heals 10 per second for 4s.' },
  martyrsHalo: { id: 'martyrsHalo', cls: 'lumen', name: "Martyr's Halo", branch: 'grace', maxRank: 1, capstone: true, text: 'CAPSTONE: once per fight, a killing blow leaves you at 1 health and untouchable for 2s.' },
  // Choir: more light, faster
  hastedHymn: { id: 'hastedHymn', cls: 'lumen', name: 'Hasted Hymn', branch: 'choir', maxRank: 3, text: 'Sunmotes fly 12% more often.' },
  prism: { id: 'prism', cls: 'lumen', name: 'Prism', branch: 'choir', maxRank: 2, text: 'Each Sunmote also strikes one more enemy.' },
  lingeringSanctuary: { id: 'lingeringSanctuary', cls: 'lumen', name: 'Lingering Sanctuary', branch: 'choir', maxRank: 2, text: 'Sanctuary lasts 2s longer and moves with you.' },
  choirOfDawn: { id: 'choirOfDawn', cls: 'lumen', name: 'Choir of Dawn', branch: 'choir', maxRank: 1, capstone: true, text: 'CAPSTONE: three wisps circle you, burning foes and healing you with each hit.' },
};

export const BRANCH_NAMES: Record<Branch, string> = {
  wildfire: 'Wildfire',
  kindling: 'Kindling',
  ashguard: 'Ashguard',
  bloodletting: 'Bloodletting',
  tempo: 'Tempo',
  guard: 'Guard',
  bastion: 'Bastion',
  retribution: 'Retribution',
  vanguard: 'Vanguard',
  dawn: 'Dawn',
  grace: 'Grace',
  choir: 'Choir',
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
