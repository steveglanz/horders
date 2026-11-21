/**
 * Talent trees for every class (the file keeps its first class's name), plus
 * the Emberwright's action bar. Each class has three branches, drafted on
 * level-up during a run.
 * Taking CAPSTONE_RANKS ranks in one branch unlocks that branch's capstones,
 * which transform the class (the survivors "evolution" moment). A branch can
 * have two capstones: the draft offers both, and taking one closes the other.
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
  | 'cinderTide'
  | 'extraOrb'
  | 'quickcast'
  | 'searingFocus'
  | 'phoenixLance'
  | 'searingBloom'
  | 'cinderSkin'
  | 'mend'
  | 'magnetism'
  | 'flicker'
  | 'rollingInferno'
  | 'heatSink'
  | 'ringOfAsh'
  | 'ashenMantle'
  | 'stoke'
  | 'smallHeal'
  // Duskblade
  | 'serratedEdge'
  | 'hemorrhage'
  | 'deepCuts'
  | 'thirst'
  | 'crimsonTide'
  | 'openVeins'
  | 'quickBlades'
  | 'longReach'
  | 'precision'
  | 'momentumFlow'
  | 'bladeStorm'
  | 'killingRhythm'
  | 'thickHide'
  | 'secondWind'
  | 'nimble'
  | 'evasion'
  | 'riposte'
  | 'shadowSlip'
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
  | 'ironVigil'
  | 'spikedShield'
  | 'vengeance'
  | 'shieldEcho'
  | 'thornwall'
  | 'grudge'
  | 'wideSweep'
  | 'momentum'
  | 'batteringRam'
  | 'warpath'
  | 'shieldWake'
  // Lumen
  | 'kindledLight'
  | 'searingRadiance'
  | 'sunflare'
  | 'noon'
  | 'noonfire'
  | 'aegisOfLight'
  | 'renewal'
  | 'blessedGround'
  | 'martyrsHalo'
  | 'haven'
  | 'hastedHymn'
  | 'prism'
  | 'lingeringSanctuary'
  | 'choirOfDawn'
  | 'chorus';

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
  /** Long-press tooltip with the numbers, for cards whose text has none. Falls back to `text`. */
  tip?: string;
}

/** Ranks in one branch that unlock its capstone. A run has about four drafts. */
export const CAPSTONE_RANKS = 3;

export const TALENTS: Record<TalentId, TalentDef> = {
  // Wildfire: area damage
  kindledGround: { id: 'kindledGround', cls: 'emberwright', name: 'Kindled Ground', branch: 'wildfire', maxRank: 3, text: 'Orbs leave burning ground behind.', tip: "Each orb hit leaves burning ground for 2s: 5 damage per second per rank, and the patch grows with each rank." },
  emberRain: { id: 'emberRain', cls: 'emberwright', name: 'Ember Rain', branch: 'wildfire', maxRank: 3, text: 'Every 4s, embers fall on nearby enemies.', tip: "Every 4s, 2 embers per rank fall on random foes within 380 px, 28 damage each." },
  searingBurn: { id: 'searingBurn', cls: 'emberwright', name: 'Searing Burn', branch: 'wildfire', maxRank: 3, text: 'Orb hits set enemies on fire.', tip: "Orb hits set the target burning for 3s: 6 damage per second per rank." },
  rollingInferno: { id: 'rollingInferno', cls: 'emberwright', name: 'Rolling Inferno', branch: 'wildfire', maxRank: 3, text: 'Flame Wave costs 6 less Heat and leaves fire behind.' },
  pyroclasm: { id: 'pyroclasm', cls: 'emberwright', name: 'Pyroclasm', branch: 'wildfire', maxRank: 2, text: 'Combustion leaves a fire pool, and burning foes spread their fire when they die.', tip: "Combustion leaves a fire pool for 4s, 14 damage per second per rank. A foe that dies burning passes its fire to foes within 80 px." },
  conflagration: { id: 'conflagration', cls: 'emberwright', name: 'Conflagration', branch: 'wildfire', maxRank: 1, capstone: true, text: 'CAPSTONE: orbs explode on impact, scorching the target and everything near it.', tip: "Every orb explodes on impact: foes beside the target take 60% of the orb's damage, and the target takes another 50%." },
  cinderTide: { id: 'cinderTide', cls: 'emberwright', name: 'Cinder Tide', branch: 'wildfire', maxRank: 1, capstone: true, text: 'CAPSTONE: Flame Wave bursts out all around you and leaves you standing in fire.', tip: "Flame Wave hits every foe within 230 px, in every direction, and leaves fire at your feet for 3s: 14 damage per second." },
  // Kindling: projectiles and single target
  extraOrb: { id: 'extraOrb', cls: 'emberwright', name: 'Twin Cinders', branch: 'kindling', maxRank: 3, text: 'Cinder Volley fires one more orb.' },
  quickcast: { id: 'quickcast', cls: 'emberwright', name: 'Quickcast', branch: 'kindling', maxRank: 3, text: 'Cinder Volley fires 14% faster.' },
  searingFocus: { id: 'searingFocus', cls: 'emberwright', name: 'Searing Focus', branch: 'kindling', maxRank: 3, text: '+12% chance to crit for double damage.' },
  heatSink: { id: 'heatSink', cls: 'emberwright', name: 'Heat Sink', branch: 'kindling', maxRank: 3, text: 'Orb hits build 35% more Heat; Combustion hits 20% harder and recharges 3s faster.' },
  ignition: { id: 'ignition', cls: 'emberwright', name: 'Ignition', branch: 'kindling', maxRank: 2, text: 'Flame Wave always crits. Rank 2: every crit cuts its cooldown by 0.3s.' },
  phoenixLance: { id: 'phoenixLance', cls: 'emberwright', name: 'Phoenix Lance', branch: 'kindling', maxRank: 1, capstone: true, text: 'CAPSTONE: a piercing lance every 2.5s.', tip: "Every 2.5s, a lance hits everything in a 520 px line for 75 damage." },
  searingBloom: { id: 'searingBloom', cls: 'emberwright', name: 'Searing Bloom', branch: 'kindling', maxRank: 1, capstone: true, text: 'CAPSTONE: your crits burst onto foes around the target and set the target burning.', tip: "Every crit splashes 60% of the hit onto foes within 90 px of the target, and burns the target for 30 damage per second for 3s." },
  // Ashguard: defense and utility
  cinderSkin: { id: 'cinderSkin', cls: 'emberwright', name: 'Cinder Skin', branch: 'ashguard', maxRank: 3, text: '+25 max health, and heal 25.' },
  mend: { id: 'mend', cls: 'emberwright', name: 'Mend in Embers', branch: 'ashguard', maxRank: 3, text: 'Regenerate 0.8 health per second.' },
  magnetism: { id: 'magnetism', cls: 'emberwright', name: 'Ember Pull', branch: 'ashguard', maxRank: 3, text: '+40% pickup range, +6% move speed.' },
  flicker: { id: 'flicker', cls: 'emberwright', name: 'Flicker', branch: 'ashguard', maxRank: 3, text: 'Blink recharges 1.5s faster and shields you briefly.' },
  blazingSpeed: { id: 'blazingSpeed', cls: 'emberwright', name: 'Blazing Speed', branch: 'ashguard', maxRank: 2, text: 'Run 30% faster for 2s after Blink. Rank 2: Blink holds a second charge.' },
  ringOfAsh: { id: 'ringOfAsh', cls: 'emberwright', name: 'Ring of Ash', branch: 'ashguard', maxRank: 1, capstone: true, text: 'CAPSTONE: three embers orbit and burn foes.', tip: "Three embers circle you and burn each foe they touch for 16 damage, at most once every 0.4s per foe." },
  ashenMantle: { id: 'ashenMantle', cls: 'emberwright', name: 'Ashen Mantle', branch: 'ashguard', maxRank: 1, capstone: true, text: 'CAPSTONE: for 3s after Blink, you take 40% less damage.' },
  // Fallbacks once the tree runs dry
  stoke: { id: 'stoke', name: 'Stoke the Flame', branch: 'general', maxRank: 99, text: '+10% damage.' },
  smallHeal: { id: 'smallHeal', name: 'Warm Hearth', branch: 'general', maxRank: 99, text: 'Heal 40 health.' },

  // Duskblade. Bloodletting: bleeds and sustain
  serratedEdge: { id: 'serratedEdge', cls: 'duskblade', name: 'Serrated Edge', branch: 'bloodletting', maxRank: 3, text: 'Swings make enemies bleed.', tip: "Swings make foes bleed for 3s: 5 damage per second per rank." },
  hemorrhage: { id: 'hemorrhage', cls: 'duskblade', name: 'Hemorrhage', branch: 'bloodletting', maxRank: 3, text: 'Bleeding enemies take 10% more damage from you.' },
  deepCuts: { id: 'deepCuts', cls: 'duskblade', name: 'Deep Cuts', branch: 'bloodletting', maxRank: 3, text: 'Rending Dash bleeds harder and recharges 1s faster.', tip: "Rending Dash bleeds for 12 per second for 4s, +50% per rank, and recharges 1s faster per rank." },
  thirst: { id: 'thirst', cls: 'duskblade', name: 'Thirst', branch: 'bloodletting', maxRank: 3, text: 'Heal for 2% of the damage you deal.' },
  exsanguinate: { id: 'exsanguinate', cls: 'duskblade', name: 'Exsanguinate', branch: 'bloodletting', maxRank: 2, text: 'Execution also tears open the target\'s bleed, dealing 3s of it at once (6s at rank 2).' },
  crimsonTide: { id: 'crimsonTide', cls: 'duskblade', name: 'Crimson Tide', branch: 'bloodletting', maxRank: 1, capstone: true, text: 'CAPSTONE: bleeding foes burst when they die, spreading the bleed.', tip: "A foe that dies bleeding bursts, and every foe within 120 px bleeds for 4s." },
  openVeins: { id: 'openVeins', cls: 'duskblade', name: 'Open Veins', branch: 'bloodletting', maxRank: 1, capstone: true, text: 'CAPSTONE: your bleeds deal 60% more damage.' },
  // Tempo: speed and crits
  quickBlades: { id: 'quickBlades', cls: 'duskblade', name: 'Quick Blades', branch: 'tempo', maxRank: 3, text: 'Swing 12% faster.' },
  longReach: { id: 'longReach', cls: 'duskblade', name: 'Long Reach', branch: 'tempo', maxRank: 3, text: 'Swings reach 15% farther and wider.' },
  precision: { id: 'precision', cls: 'duskblade', name: 'Precision', branch: 'tempo', maxRank: 3, text: '+12% chance to crit for double damage.' },
  momentumFlow: { id: 'momentumFlow', cls: 'duskblade', name: 'Flow', branch: 'tempo', maxRank: 3, text: 'Hits build 30% more Momentum; Execution recharges 3s faster.' },
  flurryStep: { id: 'flurryStep', cls: 'duskblade', name: 'Flurry Step', branch: 'tempo', maxRank: 2, text: 'Rending Dash comes back at once if it kills. Rank 2: it costs 10 less Momentum.' },
  bladeStorm: { id: 'bladeStorm', cls: 'duskblade', name: 'Blade Storm', branch: 'tempo', maxRank: 1, capstone: true, text: 'CAPSTONE: every fourth swing is a full spin for double damage.' },
  killingRhythm: { id: 'killingRhythm', cls: 'duskblade', name: 'Killing Rhythm', branch: 'tempo', maxRank: 1, capstone: true, text: 'CAPSTONE: each swing soon after the last is 4% faster, up to 10 times. A pause resets it.' },
  // Guard: survival
  thickHide: { id: 'thickHide', cls: 'duskblade', name: 'Thick Hide', branch: 'guard', maxRank: 3, text: '+30 max health, and heal 30.' },
  secondWind: { id: 'secondWind', cls: 'duskblade', name: 'Second Wind', branch: 'guard', maxRank: 3, text: 'Regenerate 1 health per second.' },
  nimble: { id: 'nimble', cls: 'duskblade', name: 'Nimble', branch: 'guard', maxRank: 3, text: '+40% pickup range, +7% move speed.' },
  evasion: { id: 'evasion', cls: 'duskblade', name: 'Evasion', branch: 'guard', maxRank: 3, text: 'Sidestep recharges 1.5s faster; your next swing crits.' },
  counterstep: { id: 'counterstep', cls: 'duskblade', name: 'Counterstep', branch: 'guard', maxRank: 2, text: 'Sidestep cuts the nearest foe for 60 as you land. Rank 2: you dodge for twice as long.' },
  riposte: { id: 'riposte', cls: 'duskblade', name: 'Riposte', branch: 'guard', maxRank: 1, capstone: true, text: 'CAPSTONE: every 6s, parry the next hit and strike back hard.', tip: "Parry the next hit of 5 or more: you take nothing and strike the nearest foe within 170 px for 140. Ready again 6s later." },
  shadowSlip: { id: 'shadowSlip', cls: 'duskblade', name: 'Shadow Slip', branch: 'guard', maxRank: 1, capstone: true, text: 'CAPSTONE: Sidestep holds a second charge.' },

  // Bulwark. Bastion: soak and shields
  holdTheLine: { id: 'holdTheLine', cls: 'bulwark', name: 'Hold the Line', branch: 'bastion', maxRank: 3, text: '+30 max health and 4% less damage taken.' },
  ward: { id: 'ward', cls: 'bulwark', name: 'Ward', branch: 'bastion', maxRank: 3, text: 'Every 8s, gain a shield worth 8% of your max health.' },
  lastStand: { id: 'lastStand', cls: 'bulwark', name: 'Last Stand', branch: 'bastion', maxRank: 2, text: 'Bastion also heals 12% of your max health.' },
  unbreakable: { id: 'unbreakable', cls: 'bulwark', name: 'Unbreakable', branch: 'bastion', maxRank: 1, capstone: true, text: 'CAPSTONE: when Bastion ends, it bursts for the damage it stopped.', tip: "When Bastion ends, it bursts for twice the damage it stopped (at least 60) on every foe within 170 px." },
  ironVigil: { id: 'ironVigil', cls: 'bulwark', name: 'Iron Vigil', branch: 'bastion', maxRank: 1, capstone: true, text: 'CAPSTONE: Bastion lasts 10s instead of 6.' },
  // Retribution: thorns and anger
  spikedShield: { id: 'spikedShield', cls: 'bulwark', name: 'Spiked Shield', branch: 'retribution', maxRank: 3, text: 'Enemies that hit you take 8 damage back.' },
  vengeance: { id: 'vengeance', cls: 'bulwark', name: 'Vengeance', branch: 'retribution', maxRank: 3, text: '+4% damage for every 10% of health you are missing.' },
  shieldEcho: { id: 'shieldEcho', cls: 'bulwark', name: 'Shield Echo', branch: 'retribution', maxRank: 2, text: 'Shield Slam strikes again 0.4s later for half damage. Rank 2: each slam also builds 10 Resolve.' },
  thornwall: { id: 'thornwall', cls: 'bulwark', name: 'Thornwall', branch: 'retribution', maxRank: 1, capstone: true, text: 'CAPSTONE: you always turn back 15% of each hit, and damage you turn back hits every enemy around you.' },
  grudge: { id: 'grudge', cls: 'bulwark', name: 'Grudge', branch: 'retribution', maxRank: 1, capstone: true, text: 'CAPSTONE: every 5th hit you take, you lash out at everything around you with the damage those hits did.', tip: "Every 5th hit that lands on you, you strike every foe within 150 px for 30 plus all the damage those 5 hits did to you, and stagger them for 0.5s." },
  // Vanguard: cleave and charge
  wideSweep: { id: 'wideSweep', cls: 'bulwark', name: 'Wide Sweep', branch: 'vanguard', maxRank: 2, text: 'Shield Sweep swings wider and farther. Rank 2: a full circle.', tip: "Shield Sweep reaches 15 farther per rank. Its arc grows from 150 degrees to 250 at rank 1, then a full circle at rank 2." },
  momentum: { id: 'momentum', cls: 'bulwark', name: 'Momentum', branch: 'vanguard', maxRank: 3, text: '+5% move speed; Charge recharges 2s faster.' },
  batteringRam: { id: 'batteringRam', cls: 'bulwark', name: 'Battering Ram', branch: 'vanguard', maxRank: 2, text: 'Charge hits and stuns everything in its path.', tip: "Charge also hits everything in its path for 25 per rank and stuns them for 0.5s." },
  warpath: { id: 'warpath', cls: 'bulwark', name: 'Warpath', branch: 'vanguard', maxRank: 1, capstone: true, text: 'CAPSTONE: every 4th Shield Sweep sends out a shockwave for double damage.' },
  shieldWake: { id: 'shieldWake', cls: 'bulwark', name: 'Shield Wake', branch: 'vanguard', maxRank: 1, capstone: true, text: 'CAPSTONE: Charge lands with a shockwave that hits and stuns everything close.', tip: "Where Charge lands, a shockwave hits every foe within 120 px for 50 damage and stuns it for 1s." },

  // Lumen. Dawn: healing turned into damage
  kindledLight: { id: 'kindledLight', cls: 'lumen', name: 'Kindled Light', branch: 'dawn', maxRank: 3, text: 'Overhealing stores 30% more Brilliance.' },
  searingRadiance: { id: 'searingRadiance', cls: 'lumen', name: 'Searing Radiance', branch: 'dawn', maxRank: 3, text: 'Sunmotes deal 15% more damage.' },
  sunflare: { id: 'sunflare', cls: 'lumen', name: 'Sunflare', branch: 'dawn', maxRank: 2, text: 'Radiant Burst reaches 40 farther and hits 50% harder.' },
  noon: { id: 'noon', cls: 'lumen', name: 'High Noon', branch: 'dawn', maxRank: 1, capstone: true, text: 'CAPSTONE: every 4s, stored Brilliance fires a piercing sunbeam.', tip: "Every 4s, if you have 20 Brilliance or more, all of it fires as a 520 px sunbeam: 30 damage plus 1.5 per Brilliance." },
  noonfire: { id: 'noonfire', cls: 'lumen', name: 'Noonfire', branch: 'dawn', maxRank: 1, capstone: true, text: 'CAPSTONE: Sunmotes deal 15% more to elites, rares and bosses.' },
  // Grace: shields and staying alive
  aegisOfLight: { id: 'aegisOfLight', cls: 'lumen', name: 'Aegis of Light', branch: 'grace', maxRank: 3, text: 'Radiant Burst also shields you for 8% of your max health.' },
  renewal: { id: 'renewal', cls: 'lumen', name: 'Renewal', branch: 'grace', maxRank: 3, text: '+20 max health and 1 health per second.' },
  blessedGround: { id: 'blessedGround', cls: 'lumen', name: 'Blessed Ground', branch: 'grace', maxRank: 2, text: 'Glimmer Step leaves a pool that heals 5 per second per rank for 4s.', tip: "Glimmer Step leaves a pool for 4s that heals you and allies in it 5 per second per rank." },
  martyrsHalo: { id: 'martyrsHalo', cls: 'lumen', name: "Martyr's Halo", branch: 'grace', maxRank: 1, capstone: true, text: 'CAPSTONE: once per fight, a killing blow leaves you at 1 health and untouchable for 2s.' },
  haven: { id: 'haven', cls: 'lumen', name: 'Haven', branch: 'grace', maxRank: 1, capstone: true, text: 'CAPSTONE: you take 30% less damage while standing in your Sanctuary.' },
  // Choir: more light, faster
  hastedHymn: { id: 'hastedHymn', cls: 'lumen', name: 'Hasted Hymn', branch: 'choir', maxRank: 3, text: 'Sunmotes fly 12% more often.' },
  prism: { id: 'prism', cls: 'lumen', name: 'Prism', branch: 'choir', maxRank: 2, text: 'Each Sunmote also strikes one more enemy.' },
  lingeringSanctuary: { id: 'lingeringSanctuary', cls: 'lumen', name: 'Lingering Sanctuary', branch: 'choir', maxRank: 2, text: 'Sanctuary lasts 2s longer and moves with you.' },
  choirOfDawn: { id: 'choirOfDawn', cls: 'lumen', name: 'Choir of Dawn', branch: 'choir', maxRank: 1, capstone: true, text: 'CAPSTONE: three wisps circle you, burning foes and healing you with each hit.', tip: "Three wisps circle you and burn each foe they touch for 16, at most once every 0.4s per foe. Each hit heals you 1.5." },
  chorus: { id: 'chorus', cls: 'lumen', name: 'Chorus', branch: 'choir', maxRank: 1, capstone: true, text: 'CAPSTONE: every 8th Sunmote strikes its target twice.' },
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
  { name: 'Combustion', key: 'R', cost: 70, cooldown: 22, text: 'Detonate a big target and everything near it. In a party, nearby allies deal 10% more damage for 6s.' },
  { name: 'Quench', key: 'F', cost: 0, cooldown: 10, offGcd: true, text: 'Interrupt an enemy cast and stun it.' },
];

export const GCD = 0.4;
export const MAX_HEAT = 100;
