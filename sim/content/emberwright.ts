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
  | 'forge' | 'clinker' | 'crust'
  | 'general';
export type ClassId = 'emberwright' | 'duskblade' | 'bulwark' | 'lumen' | 'slagbinder';

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
  | 'chorus'
  | 'thickPour' | 'searingShell' | 'quickset' | 'everMolten' | 'twinPour'
  | 'heavyLob' | 'shrapnel' | 'brittleMind' | 'shatterpoint' | 'cinderHail'
  | 'crustedHide' | 'hotBlood' | 'hardened' | 'clinkerHeart' | 'slagTide'
  // C5 round 2: two more cards per branch for the Bulwark, Lumen and Slagbinder
  | 'rivetedPlates' | 'slowPulse' | 'hardKnocks' | 'grimTally' | 'broadShoulders' | 'fullWeight'
  | 'daybreakPulse' | 'lanternHeart' | 'lampglowCare' | 'steadyHalo' | 'longNote' | 'hallowedEmbers'
  | 'deepCoat' | 'wideSpatter' | 'fastLadle' | 'denseGlob' | 'slagScales' | 'slowCool'
  | 'deepSmoulder' | 'emberCarpet' | 'brightWick' | 'fastFuse' | 'sootCloak' | 'bankedFire'
  | 'slowDrip' | 'hungrySteel' | 'lightGrip' | 'keenLunge' | 'lowStance' | 'quietMend'
  | 'leeSide' | 'broadBack' | 'frontMend' | 'wideDawn' | 'turnedBack' | 'sharedBreath' | 'longKindle' | 'closeWarmth' | 'longStand' | 'wideShell'
  | 'ventFed' | 'readTheLane' | 'backToStone' | 'reachingLight' | 'slagWade';

/** What a site card needs ahead in the run: a layout (vents, pillars, lava) or a foe (Spitters, or a lob or charge lane). */
export type Situation = 'vents' | 'pillars' | 'lava' | 'spitter' | 'lane';

export interface TalentDef {
  id: TalentId;
  name: string;
  branch: Branch;
  /** Which class drafts it; shared fallbacks have none. */
  cls?: ClassId;
  maxRank: number;
  capstone?: boolean;
  /** A deep card (C5 round 2): offered only once its branch's capstone is taken, so it never crowds out the picks that build toward it. */
  deep?: boolean;
  /** A party card (Season 2): offered only with 2 or more heroes, so solo drafts never see it. Party cards are deep cards too. */
  party?: boolean;
  /** Short line shown on the draft card; {r} is replaced with the next rank. */
  text: string;
  /** Long-press tooltip with the numbers, for cards whose text has none. Falls back to `text`. */
  tip?: string;
  /** The action-bar slot this talent improves. A hero who swapped that slot's ability (ALT_ABILITIES) never drafts it. */
  ability?: number;
  /** A site card (Phase 11 variety): offered only while its layout or foe is still ahead in this run's route. */
  where?: Situation;
}

/** Ranks in one branch that unlock its capstone. A run has about four drafts. */
export const CAPSTONE_RANKS = 3;

export const TALENTS: Record<TalentId, TalentDef> = {
  // Wildfire: area damage
  kindledGround: { id: 'kindledGround', cls: 'emberwright', name: 'Kindled Ground', branch: 'wildfire', maxRank: 3, text: 'Orbs leave burning ground behind, and +6% damage.', tip: "Each orb hit leaves burning ground for 2s: 5 damage per second per rank, and the patch grows with each rank. Each rank also gives +6% damage." },
  emberRain: { id: 'emberRain', cls: 'emberwright', name: 'Ember Rain', branch: 'wildfire', maxRank: 3, text: 'Every 4s, embers fall on nearby enemies.', tip: "Every 4s, 2 embers per rank fall on random foes within 380 px, 28 damage each." },
  searingBurn: { id: 'searingBurn', cls: 'emberwright', name: 'Searing Burn', branch: 'wildfire', maxRank: 3, text: 'Orb hits set enemies on fire.', tip: "Orb hits set the target burning for 3s: 6 damage per second per rank." },
  rollingInferno: { id: 'rollingInferno', cls: 'emberwright', name: 'Rolling Inferno', branch: 'wildfire', maxRank: 3, text: 'Flame Wave costs 6 less Heat and leaves fire behind.' },
  pyroclasm: { id: 'pyroclasm', cls: 'emberwright', name: 'Spreading Coals', branch: 'wildfire', maxRank: 2, text: 'Combustion leaves a fire pool, and burning foes spread their fire when they die.', tip: "Combustion leaves a fire pool for 4s, 14 damage per second per rank. A foe that dies burning passes its fire to foes within 80 px." },
  conflagration: { id: 'conflagration', cls: 'emberwright', name: 'Conflagration', branch: 'wildfire', maxRank: 1, capstone: true, text: 'Orbs explode on impact, scorching the target and everything near it.', tip: "Every orb explodes on impact: foes beside the target take 60% of the orb's damage, and the target takes another 50%." },
  cinderTide: { id: 'cinderTide', cls: 'emberwright', name: 'Cinder Tide', branch: 'wildfire', maxRank: 1, capstone: true, text: 'Flame Wave bursts out all around you and leaves you standing in fire.', tip: "Flame Wave hits every foe within 230 px, in every direction, and leaves fire at your feet for 3s: 14 damage per second." },
  // Kindling: projectiles and single target
  extraOrb: { id: 'extraOrb', cls: 'emberwright', name: 'Twin Cinders', branch: 'kindling', maxRank: 3, text: 'Cinder Volley fires one more orb.' },
  quickcast: { id: 'quickcast', cls: 'emberwright', name: 'Quickcast', branch: 'kindling', maxRank: 3, text: 'Cinder Volley fires 14% faster.' },
  searingFocus: { id: 'searingFocus', cls: 'emberwright', name: 'Searing Focus', branch: 'kindling', maxRank: 3, text: '+12% chance to crit for double damage.' },
  heatSink: { id: 'heatSink', cls: 'emberwright', name: 'Heat Sink', branch: 'kindling', maxRank: 3, text: 'Orb hits build 35% more Heat; Combustion hits 20% harder and recharges 3s faster.' },
  ignition: { id: 'ignition', cls: 'emberwright', name: 'Ignition', branch: 'kindling', maxRank: 2, text: 'Flame Wave always crits. Rank 2: every crit cuts its cooldown by 0.3s.' },
  phoenixLance: { id: 'phoenixLance', cls: 'emberwright', name: 'Phoenix Lance', branch: 'kindling', maxRank: 1, capstone: true, text: 'A piercing lance every 2.5s.', tip: "Every 2.5s, a lance hits everything in a 520 px line for 75 damage." },
  searingBloom: { id: 'searingBloom', cls: 'emberwright', name: 'Searing Bloom', branch: 'kindling', maxRank: 1, capstone: true, text: 'Your crits burst onto foes around the target and set the target burning.', tip: "Every crit splashes 60% of the hit onto foes within 90 px of the target, and burns the target for 30 damage per second for 3s." },
  // Ashguard: defense and utility
  cinderSkin: { id: 'cinderSkin', cls: 'emberwright', name: 'Cinder Skin', branch: 'ashguard', maxRank: 3, text: '+25 max health, heal 25, and +6% damage.' },
  mend: { id: 'mend', cls: 'emberwright', name: 'Mend in Embers', branch: 'ashguard', maxRank: 3, text: 'Regenerate 0.8 health per second, and +6% damage.' },
  magnetism: { id: 'magnetism', cls: 'emberwright', name: 'Ember Pull', branch: 'ashguard', maxRank: 3, text: '+40% pickup range, +6% move speed.' },
  flicker: { id: 'flicker', ability: 1, cls: 'emberwright', name: 'Flicker', branch: 'ashguard', maxRank: 3, text: 'Blink recharges 1.5s faster and shields you briefly.' },
  blazingSpeed: { id: 'blazingSpeed', ability: 1, cls: 'emberwright', name: 'Hot Heels', branch: 'ashguard', maxRank: 2, text: 'Run 30% faster for 2s after Blink. Rank 2: Blink holds a second charge.' },
  ringOfAsh: { id: 'ringOfAsh', cls: 'emberwright', name: 'Ring of Ash', branch: 'ashguard', maxRank: 1, capstone: true, text: 'Three embers orbit and burn foes.', tip: "Three embers circle you 200 px out and burn each foe they touch for 45 damage, at most once every 0.4s per foe." },
  ashenMantle: { id: 'ashenMantle', ability: 1, cls: 'emberwright', name: 'Ashen Mantle', branch: 'ashguard', maxRank: 1, capstone: true, text: 'For 3s after Blink, you take 40% less damage.' },
  // Fallbacks once the tree runs dry
  stoke: { id: 'stoke', name: 'Stoke the Flame', branch: 'general', maxRank: 99, text: '+10% damage.' },
  smallHeal: { id: 'smallHeal', name: 'Warm Hearth', branch: 'general', maxRank: 99, text: 'Heal 40 health.' },

  // Duskblade. Bloodletting: bleeds and sustain
  serratedEdge: { id: 'serratedEdge', cls: 'duskblade', name: 'Serrated Edge', branch: 'bloodletting', maxRank: 3, text: 'Swings make enemies bleed.', tip: "Swings make foes bleed for 3s: 5 damage per second per rank." },
  hemorrhage: { id: 'hemorrhage', cls: 'duskblade', name: 'Hemorrhage', branch: 'bloodletting', maxRank: 3, text: 'Bleeding enemies take 10% more damage from you.' },
  deepCuts: { id: 'deepCuts', ability: 0, cls: 'duskblade', name: 'Long Gash', branch: 'bloodletting', maxRank: 3, text: 'Rending Dash bleeds harder and recharges 1s faster.', tip: "Rending Dash bleeds for 12 per second for 4s, +50% per rank, and recharges 1s faster per rank." },
  thirst: { id: 'thirst', cls: 'duskblade', name: 'Thirst', branch: 'bloodletting', maxRank: 3, text: 'Heal for 2% of the damage you deal.' },
  exsanguinate: { id: 'exsanguinate', cls: 'duskblade', name: 'Wring Out', branch: 'bloodletting', maxRank: 2, text: 'Execution also tears open the target\'s bleed, dealing 3s of it at once (6s at rank 2).' },
  crimsonTide: { id: 'crimsonTide', cls: 'duskblade', name: 'Crimson Tide', branch: 'bloodletting', maxRank: 1, capstone: true, text: 'Bleeding foes burst when they die, spreading the bleed.', tip: "A foe that dies bleeding bursts, and every foe within 120 px bleeds for 4s." },
  openVeins: { id: 'openVeins', cls: 'duskblade', name: 'Open Veins', branch: 'bloodletting', maxRank: 1, capstone: true, text: 'Your bleeds deal 60% more damage.' },
  // Tempo: speed and crits
  quickBlades: { id: 'quickBlades', cls: 'duskblade', name: 'Quick Blades', branch: 'tempo', maxRank: 3, text: 'Swing 12% faster.' },
  longReach: { id: 'longReach', cls: 'duskblade', name: 'Long Reach', branch: 'tempo', maxRank: 3, text: 'Swings reach 15% farther and wider.' },
  precision: { id: 'precision', cls: 'duskblade', name: 'Precision', branch: 'tempo', maxRank: 3, text: '+12% chance to crit for double damage.' },
  momentumFlow: { id: 'momentumFlow', cls: 'duskblade', name: 'Flow', branch: 'tempo', maxRank: 3, text: 'Hits build 30% more Momentum; Execution recharges 3s faster.' },
  flurryStep: { id: 'flurryStep', ability: 0, cls: 'duskblade', name: 'Flurry Step', branch: 'tempo', maxRank: 2, text: 'Rending Dash comes back at once if it kills. Rank 2: it costs 10 less Momentum.' },
  bladeStorm: { id: 'bladeStorm', cls: 'duskblade', name: 'Whirling Dusk', branch: 'tempo', maxRank: 1, capstone: true, text: 'Every fourth swing is a full spin for double damage.' },
  killingRhythm: { id: 'killingRhythm', cls: 'duskblade', name: 'Killing Rhythm', branch: 'tempo', maxRank: 1, capstone: true, text: 'Each swing soon after the last is 4% faster, up to 10 times. A pause resets it.' },
  // Guard: survival
  thickHide: { id: 'thickHide', cls: 'duskblade', name: 'Thick Hide', branch: 'guard', maxRank: 3, text: '+30 max health, and heal 30.' },
  secondWind: { id: 'secondWind', cls: 'duskblade', name: 'Steady Breath', branch: 'guard', maxRank: 3, text: 'Regenerate 1 health per second.' },
  nimble: { id: 'nimble', cls: 'duskblade', name: 'Nimble', branch: 'guard', maxRank: 3, text: '+40% pickup range, +7% move speed.' },
  evasion: { id: 'evasion', cls: 'duskblade', name: 'Evasion', branch: 'guard', maxRank: 3, text: 'Sidestep recharges 1.5s faster; your next swing crits.' },
  counterstep: { id: 'counterstep', cls: 'duskblade', name: 'Counterstep', branch: 'guard', maxRank: 2, text: 'Sidestep cuts the nearest foe for 60 as you land. Rank 2: you dodge for twice as long.' },
  riposte: { id: 'riposte', cls: 'duskblade', name: 'Riposte', branch: 'guard', maxRank: 1, capstone: true, text: 'Every 6s, parry the next hit and strike back hard.', tip: "Parry the next hit of 5 or more: you take nothing and strike the nearest foe within 170 px for 140. Ready again 6s later." },
  shadowSlip: { id: 'shadowSlip', cls: 'duskblade', name: 'Shadow Slip', branch: 'guard', maxRank: 1, capstone: true, text: 'Sidestep holds a second charge.' },

  // Bulwark. Anvil Skin: soak and shields
  holdTheLine: { id: 'holdTheLine', cls: 'bulwark', name: 'Planted Heels', branch: 'bastion', maxRank: 3, text: '+30 max health and 4% less damage taken.' },
  ward: { id: 'ward', cls: 'bulwark', name: 'Ward', branch: 'bastion', maxRank: 3, text: 'Every 8s, gain a shield worth 8% of your max health.' },
  lastStand: { id: 'lastStand', ability: 2, cls: 'bulwark', name: 'Mended Iron', branch: 'bastion', maxRank: 2, text: 'Anvil Skin also heals 12% of your max health.' },
  unbreakable: { id: 'unbreakable', ability: 2, cls: 'bulwark', name: 'Unbreakable', branch: 'bastion', maxRank: 1, capstone: true, text: 'When Anvil Skin ends, it bursts for the damage it stopped.', tip: "When Anvil Skin ends, it bursts for twice the damage it stopped (at least 60) on every foe within 170 px." },
  rivetedPlates: { id: 'rivetedPlates', cls: 'bulwark', name: 'Riveted Plates', branch: 'bastion', deep: true, maxRank: 3, text: 'Your armor stops 5% more of each hit.' },
  slowPulse: { id: 'slowPulse', cls: 'bulwark', name: 'Slow Pulse', branch: 'bastion', deep: true, maxRank: 2, text: 'Below half health, heal 4 health per second.' },
  ironVigil: { id: 'ironVigil', ability: 2, cls: 'bulwark', name: 'Iron Vigil', branch: 'bastion', maxRank: 1, capstone: true, text: 'Anvil Skin lasts 10s instead of 6.' },
  // Retribution: thorns and anger
  spikedShield: { id: 'spikedShield', cls: 'bulwark', name: 'Spiked Shield', branch: 'retribution', maxRank: 3, text: 'Enemies that hit you take 8 damage back.' },
  vengeance: { id: 'vengeance', cls: 'bulwark', name: 'Vengeance', branch: 'retribution', maxRank: 3, text: '+4% damage for every 10% of health you are missing.' },
  shieldEcho: { id: 'shieldEcho', cls: 'bulwark', name: 'Shield Echo', branch: 'retribution', maxRank: 2, text: 'Rim Smash strikes again 0.4s later for half damage. Rank 2: each slam also builds 10 Resolve.' },
  hardKnocks: { id: 'hardKnocks', ability: 0, cls: 'bulwark', name: 'Hard Knocks', branch: 'retribution', deep: true, maxRank: 3, text: 'Rim Smash deals 20% more damage.' },
  grimTally: { id: 'grimTally', cls: 'bulwark', name: 'Grim Tally', branch: 'retribution', deep: true, maxRank: 2, text: 'Hits you take build 25% more Resolve.' },
  thornwall: { id: 'thornwall', cls: 'bulwark', name: 'Thornwall', branch: 'retribution', maxRank: 1, capstone: true, text: 'You always turn back 15% of each hit, and damage you turn back hits every enemy around you.' },
  grudge: { id: 'grudge', cls: 'bulwark', name: 'Grudge', branch: 'retribution', maxRank: 1, capstone: true, text: 'Every 4th hit you take, you lash out at everything around you with twice the damage those hits did.', tip: "Every 4th hit that lands on you, you strike every foe within 150 px for 30 plus twice the damage those 4 hits did to you, and stagger them for 0.5s." },
  // Vanguard: cleave and charge
  wideSweep: { id: 'wideSweep', cls: 'bulwark', name: 'Wide Sweep', branch: 'vanguard', maxRank: 2, text: 'Shield Sweep swings wider and farther. Rank 2: a full circle.', tip: "Shield Sweep reaches 15 farther per rank. Its arc grows from 150 degrees to 250 at rank 1, then a full circle at rank 2." },
  momentum: { id: 'momentum', cls: 'bulwark', name: 'Momentum', branch: 'vanguard', maxRank: 3, text: '+5% move speed; Charge recharges 2s faster.' },
  batteringRam: { id: 'batteringRam', cls: 'bulwark', name: 'Plough Through', branch: 'vanguard', maxRank: 2, text: 'Charge hits and stuns everything in its path.', tip: "Charge also hits everything in its path for 25 per rank and stuns them for 0.5s." },
  broadShoulders: { id: 'broadShoulders', cls: 'bulwark', name: 'Broad Shoulders', branch: 'vanguard', deep: true, maxRank: 3, text: 'Shield Sweep swings 8% more often.' },
  fullWeight: { id: 'fullWeight', ability: 1, cls: 'bulwark', name: 'Full Weight', branch: 'vanguard', deep: true, maxRank: 2, text: 'Charge hits 50% harder.' },
  warpath: { id: 'warpath', cls: 'bulwark', name: 'Warpath', branch: 'vanguard', maxRank: 1, capstone: true, text: 'Every 4th Shield Sweep sends out a shockwave for double damage.' },
  shieldWake: { id: 'shieldWake', cls: 'bulwark', name: 'Shield Wake', branch: 'vanguard', maxRank: 1, capstone: true, text: 'Charge lands with a shockwave that hits and stuns everything close.', tip: "Where Charge lands, a shockwave hits every foe within 120 px for 50 damage and stuns it for 1s." },

  // Lumen. Dawn: healing turned into damage
  kindledLight: { id: 'kindledLight', cls: 'lumen', name: 'Kindled Light', branch: 'dawn', maxRank: 3, text: 'Overhealing stores 30% more Brilliance.' },
  searingRadiance: { id: 'searingRadiance', cls: 'lumen', name: 'Searing Radiance', branch: 'dawn', maxRank: 3, text: 'Sunmotes deal 15% more damage.' },
  sunflare: { id: 'sunflare', cls: 'lumen', name: 'Noon Flash', branch: 'dawn', maxRank: 2, text: 'Radiant Burst reaches 40 farther and hits 50% harder.' },
  daybreakPulse: { id: 'daybreakPulse', ability: 0, cls: 'lumen', name: 'Daybreak Pulse', branch: 'dawn', deep: true, maxRank: 2, text: 'Radiant Burst recovers 0.5s sooner and heals 10% more.' },
  lanternHeart: { id: 'lanternHeart', cls: 'lumen', name: 'Lantern Heart', branch: 'dawn', deep: true, maxRank: 3, text: 'You can store 30 more Brilliance, and Sunmotes deal 10% more damage.' },
  noon: { id: 'noon', cls: 'lumen', name: 'High Noon', branch: 'dawn', maxRank: 1, capstone: true, text: 'Every 4s, a piercing sunbeam fires at your target, stronger with stored Brilliance.', tip: "Every 4s, a 520 px sunbeam pierces everything in line with your target: 40 damage plus 1.5 per Brilliance, and it spends all your Brilliance." },
  noonfire: { id: 'noonfire', cls: 'lumen', name: 'Noonfire', branch: 'dawn', maxRank: 1, capstone: true, text: 'Sunmotes deal 15% more to elites, rares and bosses.' },
  // Grace: shields and staying alive
  aegisOfLight: { id: 'aegisOfLight', cls: 'lumen', name: 'Gleam Guard', branch: 'grace', maxRank: 3, text: 'Radiant Burst also shields you for 8% of your max health, and +8% damage.' },
  renewal: { id: 'renewal', cls: 'lumen', name: 'Renewal', branch: 'grace', maxRank: 3, text: '+20 max health, 1 health per second, and +8% damage.' },
  blessedGround: { id: 'blessedGround', ability: 1, cls: 'lumen', name: 'Blessed Ground', branch: 'grace', maxRank: 2, text: 'Glimmer Step leaves a pool that heals 5 per second per rank for 4s.', tip: "Glimmer Step leaves a pool for 4s that heals you and allies in it 5 per second per rank." },
  lampglowCare: { id: 'lampglowCare', cls: 'lumen', name: 'Lampglow Care', branch: 'grace', deep: true, maxRank: 3, text: 'All your healing is 10% stronger.' },
  steadyHalo: { id: 'steadyHalo', cls: 'lumen', name: 'Steady Halo', branch: 'grace', deep: true, maxRank: 2, text: 'You take 5% less damage.' },
  martyrsHalo: { id: 'martyrsHalo', cls: 'lumen', name: "Martyr's Halo", branch: 'grace', maxRank: 1, capstone: true, text: 'Once per fight, a killing blow leaves you at 1 health and untouchable for 2s.' },
  haven: { id: 'haven', cls: 'lumen', name: 'Haven', branch: 'grace', maxRank: 1, capstone: true, text: 'You take 30% less damage while standing in your Sanctuary.' },
  // Choir: more light, faster
  hastedHymn: { id: 'hastedHymn', cls: 'lumen', name: 'Hasted Hymn', branch: 'choir', maxRank: 3, text: 'Sunmotes fly 12% more often.' },
  prism: { id: 'prism', cls: 'lumen', name: 'Prism', branch: 'choir', maxRank: 2, text: 'Each Sunmote also strikes one more enemy.' },
  lingeringSanctuary: { id: 'lingeringSanctuary', cls: 'lumen', name: 'Lingering Sanctuary', branch: 'choir', maxRank: 2, text: 'Sanctuary lasts 2s longer and moves with you.' },
  longNote: { id: 'longNote', cls: 'lumen', name: 'Long Note', branch: 'choir', deep: true, maxRank: 2, text: 'Sunmotes reach 40 farther and deal 10% more damage.' },
  hallowedEmbers: { id: 'hallowedEmbers', ability: 2, cls: 'lumen', name: 'Hallowed Embers', branch: 'choir', deep: true, maxRank: 3, text: 'Sanctuary burns foes 50% harder.' },
  choirOfDawn: { id: 'choirOfDawn', cls: 'lumen', name: 'Choir of Dawn', branch: 'choir', maxRank: 1, capstone: true, text: 'Three wisps circle wide around you, burning foes and healing you with each hit.', tip: "Three wisps circle you 170 px out and burn each foe they touch for 16, at most once every 0.4s per foe. Each hit heals you 1.5." },
  chorus: { id: 'chorus', cls: 'lumen', name: 'Chorus', branch: 'choir', maxRank: 1, capstone: true, text: 'Every 8th Sunmote strikes its target twice.' },

  // Slagbinder: Forge (plating), Clinker (damage and Brittle), Crust (self-tank).
  thickPour: { id: 'thickPour', cls: 'slagbinder', name: 'Thick Coat', branch: 'forge', maxRank: 3, text: 'Molten Plating holds 20% more.', tip: 'Molten Plating holds 20% more per rank.' },
  searingShell: { id: 'searingShell', cls: 'slagbinder', name: 'Searing Shell', branch: 'forge', maxRank: 3, text: 'Plating bursts 30% harder.', tip: 'When plating breaks or runs out, its burst deals 30% more per rank.' },
  quickset: { id: 'quickset', cls: 'slagbinder', name: 'Quickset', branch: 'forge', maxRank: 2, text: 'Molten Plating recovers 1s sooner.' },
  deepCoat: { id: 'deepCoat', ability: 0, cls: 'slagbinder', name: 'Deep Coat', branch: 'forge', deep: true, maxRank: 2, text: 'Molten Plating lasts 1s longer and holds 10% more.' },
  wideSpatter: { id: 'wideSpatter', ability: 0, cls: 'slagbinder', name: 'Wide Spatter', branch: 'forge', deep: true, maxRank: 3, text: 'Plating bursts 15 px wider and 10% harder.' },
  everMolten: { id: 'everMolten', cls: 'slagbinder', name: 'Ever-Molten', branch: 'forge', maxRank: 1, capstone: true, text: 'Plating that runs out unbroken gives back 15 Slag.' },
  twinPour: { id: 'twinPour', cls: 'slagbinder', name: 'Twin Coat', branch: 'forge', maxRank: 1, capstone: true, text: 'Molten Plating coats a second hero. Alone, it is 50% thicker. +40% damage while plated.' },
  heavyLob: { id: 'heavyLob', cls: 'slagbinder', name: 'Heavy Lob', branch: 'clinker', maxRank: 3, text: 'Slag Lob deals 30% more damage.' },
  shrapnel: { id: 'shrapnel', cls: 'slagbinder', name: 'Shrapnel', branch: 'clinker', maxRank: 2, text: 'Slag Lob splashes 15 px wider and 30% harder.' },
  brittleMind: { id: 'brittleMind', cls: 'slagbinder', name: 'Lasting Cracks', branch: 'clinker', maxRank: 2, text: 'Brittle lasts 2s longer.' },
  fastLadle: { id: 'fastLadle', cls: 'slagbinder', name: 'Fast Ladle', branch: 'clinker', deep: true, maxRank: 3, text: 'Slag Lob throws 10% more often.' },
  denseGlob: { id: 'denseGlob', cls: 'slagbinder', name: 'Dense Glob', branch: 'clinker', deep: true, maxRank: 2, text: 'Each Slag Lob gives 3 more Slag.' },
  shatterpoint: { id: 'shatterpoint', cls: 'slagbinder', name: 'Breakpoint', branch: 'clinker', maxRank: 1, capstone: true, text: 'Slag Lob hits Brittle foes 25% harder, and every 4th Lob makes its target Brittle.' },
  cinderHail: { id: 'cinderHail', cls: 'slagbinder', name: 'Cinder Hail', branch: 'clinker', maxRank: 1, capstone: true, text: 'Every 4th Slag Lob throws three globs.' },
  crustedHide: { id: 'crustedHide', cls: 'slagbinder', name: 'Crusted Hide', branch: 'crust', maxRank: 3, text: '+15 max health.' },
  hotBlood: { id: 'hotBlood', cls: 'slagbinder', name: 'Hot Blood', branch: 'crust', maxRank: 2, text: 'Each hit you take gives 2 more Slag.' },
  hardened: { id: 'hardened', cls: 'slagbinder', name: 'Hardened', branch: 'crust', maxRank: 2, text: 'Cooling Shell lasts 1s longer.' },
  slagScales: { id: 'slagScales', cls: 'slagbinder', name: 'Slag Scales', branch: 'crust', deep: true, maxRank: 3, text: 'You take 4% less damage.' },
  slowCool: { id: 'slowCool', ability: 2, cls: 'slagbinder', name: 'Slow Cool', branch: 'crust', deep: true, maxRank: 2, text: 'Your Cooling Shell cuts 5% more of the damage you take.' },
  deepSmoulder: { id: 'deepSmoulder', cls: 'emberwright', name: 'Deep Smoulder', branch: 'wildfire', deep: true, maxRank: 3, text: 'Orb fires burn 15% harder.' },
  emberCarpet: { id: 'emberCarpet', ability: 0, cls: 'emberwright', name: 'Ember Carpet', branch: 'wildfire', deep: true, maxRank: 2, text: 'Flame Wave hits 20% harder.' },
  brightWick: { id: 'brightWick', cls: 'emberwright', name: 'Bright Wick', branch: 'kindling', deep: true, maxRank: 3, text: '+8% chance to crit, and crits deal 10% more.' },
  fastFuse: { id: 'fastFuse', ability: 2, cls: 'emberwright', name: 'Fast Fuse', branch: 'kindling', deep: true, maxRank: 2, text: 'Combustion recharges 3s faster and hits 20% harder.' },
  sootCloak: { id: 'sootCloak', cls: 'emberwright', name: 'Soot Cloak', branch: 'ashguard', deep: true, maxRank: 3, text: 'You take 4% less damage.' },
  bankedFire: { id: 'bankedFire', cls: 'emberwright', name: 'Banked Fire', branch: 'ashguard', deep: true, maxRank: 2, text: 'Below half health, heal 3 health per second.' },
  slowDrip: { id: 'slowDrip', cls: 'duskblade', name: 'Slow Drip', branch: 'bloodletting', deep: true, maxRank: 3, text: 'Your bleeds deal 10% more damage.' },
  hungrySteel: { id: 'hungrySteel', ability: 2, cls: 'duskblade', name: 'Hungry Steel', branch: 'bloodletting', deep: true, maxRank: 2, text: 'Execution hits 20% harder.' },
  lightGrip: { id: 'lightGrip', cls: 'duskblade', name: 'Light Grip', branch: 'tempo', deep: true, maxRank: 3, text: 'Swing 5% faster.' },
  keenLunge: { id: 'keenLunge', ability: 0, cls: 'duskblade', name: 'Keen Lunge', branch: 'tempo', deep: true, maxRank: 2, text: 'Rending Dash hits 25% harder.' },
  lowStance: { id: 'lowStance', cls: 'duskblade', name: 'Low Stance', branch: 'guard', deep: true, maxRank: 3, text: 'You take 4% less damage.' },
  quietMend: { id: 'quietMend', cls: 'duskblade', name: 'Quiet Mend', branch: 'guard', deep: true, maxRank: 2, text: 'Below half health, heal 3 health per second.' },
  // Party cards (Season 2, the Deep Bellows): deep cards offered only in a party of 2 or more.
  leeSide: { id: 'leeSide', cls: 'bulwark', name: 'Lee Side', branch: 'bastion', deep: true, party: true, maxRank: 2, text: 'Allies within 200 px of you take 4% less damage.' },
  broadBack: { id: 'broadBack', cls: 'bulwark', name: 'Broad Back', branch: 'vanguard', deep: true, party: true, maxRank: 1, text: 'Taunting the boss off an ally heals that ally for 6% of its max health.' },
  frontMend: { id: 'frontMend', cls: 'lumen', name: 'Front Mend', branch: 'grace', deep: true, party: true, maxRank: 1, text: 'Your heals on the hero the boss is attacking are 4% stronger.' },
  wideDawn: { id: 'wideDawn', ability: 0, cls: 'lumen', name: 'Wide Dawn', branch: 'dawn', deep: true, party: true, maxRank: 2, text: 'Radiant Burst heals allies 20% more.' },
  turnedBack: { id: 'turnedBack', cls: 'duskblade', name: 'Turned Back', branch: 'bloodletting', deep: true, party: true, maxRank: 2, text: 'Deal 6% more damage to the boss while it attacks someone else.' },
  sharedBreath: { id: 'sharedBreath', ability: 1, cls: 'duskblade', name: 'Shared Breath', branch: 'guard', deep: true, party: true, maxRank: 1, text: 'Sidestep also heals the most hurt ally within 300 px for 4% of its max health.' },
  longKindle: { id: 'longKindle', cls: 'emberwright', name: 'Long Kindle', branch: 'kindling', deep: true, party: true, maxRank: 2, text: 'Kindling lasts 2s longer and reaches 60 px farther.' },
  closeWarmth: { id: 'closeWarmth', cls: 'emberwright', name: 'Close Warmth', branch: 'ashguard', deep: true, party: true, maxRank: 2, text: 'Allies within 260 px of you heal 0.2 health per second.' },
  longStand: { id: 'longStand', ability: 1, cls: 'slagbinder', name: 'Long Stand', branch: 'crust', deep: true, party: true, maxRank: 2, text: 'Interpose guards your ally 1s longer, in either stance.' },
  wideShell: { id: 'wideShell', ability: 2, cls: 'slagbinder', name: 'Wide Shell', branch: 'forge', deep: true, party: true, maxRank: 2, text: 'Cooling Shell covers allies 50 px farther away, in either stance.' },
  clinkerHeart: { id: 'clinkerHeart', cls: 'slagbinder', name: 'Clinker Heart', branch: 'crust', maxRank: 1, capstone: true, text: 'Falling below 30% health plates you for 25% of your max health, once every 30s. +50% damage while plated.' },
  slagTide: { id: 'slagTide', ability: 1, cls: 'slagbinder', name: 'Slag Tide', branch: 'crust', maxRank: 1, capstone: true, text: 'Interpose lands with a wave: 60 damage and a 1s stun within 120 px.' },
  // Site cards (Phase 11 variety): each pays off only in its situation, and is offered only while that situation is still ahead in the run.
  ventFed: { id: 'ventFed', cls: 'emberwright', name: 'Vent-Fed', branch: 'kindling', maxRank: 2, where: 'vents', text: 'A vent flaring near you gives Heat and doubles your next volley.', tip: 'When a vent flares within 260 px of you, and you are outside its circle, gain 25 Heat per rank, and your next Cinder Volley deals double damage.' },
  readTheLane: { id: 'readTheLane', ability: 1, cls: 'duskblade', name: 'Read the Lane', branch: 'guard', maxRank: 2, where: 'lane', text: 'Sidestep out of a lob or charge lane: Sidestep comes back sooner, and your next 3 swings hit harder.', tip: 'Sidestep while standing in an Ember Lob circle or an Ashbuck charge lane that has not landed: Sidestep comes back 3s sooner per rank, and your next 3 swings deal 35% more per rank.' },
  backToStone: { id: 'backToStone', cls: 'bulwark', name: 'Back to Stone', branch: 'bastion', maxRank: 2, where: 'pillars', text: 'Beside a stone or pillar, take less damage and Rim Smash stuns longer.', tip: 'While within 50 px of a stone or pillar, take 7% less damage per rank (4% in the Glarewell), and Rim Smash stuns 0.3s longer per rank.' },
  reachingLight: { id: 'reachingLight', cls: 'lumen', name: 'Reaching Light', branch: 'grace', maxRank: 2, where: 'spitter', text: 'Radiant Burst reaches Ember Spitters farther away, and Hush on a Spitter recharges faster.', tip: 'Radiant Burst also burns Ember Spitters out to 240 px plus 80 per rank. Hushing a Spitter gives 2.5s per rank of Hush back.' },
  slagWade: { id: 'slagWade', cls: 'slagbinder', name: 'Slag Wade', branch: 'forge', maxRank: 2, where: 'lava', text: 'Lava burns you less, and while you stand in it your hits are stronger and make foes Brittle.', tip: 'Lava burns you 50% less per rank (not at all at rank 2). While you stand in it, your hits deal 10% more per rank and make the foe Brittle.' },
};

export const BRANCH_NAMES: Record<Branch, string> = {
  wildfire: 'Wildfire',
  kindling: 'Kindling',
  ashguard: 'Ashguard',
  bloodletting: 'Bloodletting',
  tempo: 'Tempo',
  guard: 'Guard',
  bastion: 'Anvil Skin',
  retribution: 'Retribution',
  vanguard: 'Vanguard',
  dawn: 'Dawn',
  grace: 'Grace',
  choir: 'Choir',
  forge: 'Forge',
  clinker: 'Clinker',
  crust: 'Crust',
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
