/**
 * The shared simulation. Pure TypeScript with no rendering or browser code, so
 * the same file can run in the player's browser (alpha) and on an
 * authoritative game server (co-op, beta).
 *
 * Determinism rules: fixed time step, every random number comes from `rng`,
 * no Date/Math.random/performance calls in here.
 */
import { kilnTaunt, type KilnSay } from './content/kilnmother';
import { Rng } from './rng';
import { fillLootShare } from './content/botfill';
import { NAMED, NAMED_TITLES, AFFIXES, Affix, BROOD_KIND, C2_AFFIXES } from './content/named';
import { keyScale } from './content/keys';
import { ENEMIES, EnemyDef, EnemyKind } from './content/enemies';
import { ABILITIES, AbilityDef, Branch, GCD, MAX_HEAT, SPARKS, TALENTS, TalentDef, TalentId, ClassId, Situation } from './content/emberwright';
import { ALT_BY_ID, ALT_OPTIONS, AltId, AltOption, CLASSES, ClassDef, MAX_UNLOCK, SLAG_GUNNER, cleanAlts, slotOpen } from './content/classes';
import { Loadout, PointId, itemScore, loadoutFrom, rollDrop } from './hero';
import { TREE, TreeNodeId } from './content/trees';
/** Character tree numbers, re-exported so the tools' TUNE=TREE.bulkHp=8 reaches them. */
export { TREE };
import { Item, LootSource, RARITIES, Rarity } from './content/items';
import { BOUNTY } from './content/bounty';
import { FIRST_DELVE } from './content/firstdelve';
import { RELIC, RELICS, RELIC_IDS, RELIC_OFFER, RelicId } from './content/relics';
import { SETS, SET_SLOTS, SET_TUNING, SetId, setForDungeon } from './content/sets';
import { DUNGEONS, DungeonId, ENCOUNTERS, EncounterDef, EncounterId, GateKind, rollFork, rollRoute } from './content/dungeon';
import { OMENS, OMEN_TUNING, OmenId, omensFor } from './content/omens';
import { HEATS, HEAT_TUNING, HeatId, heatFits } from './content/heat';
import { clampParty, partyHealth, gritMult, GRIT, MAX_PARTY } from './content/scaling';
import { HALLS, HALLS_GEN, KILNTRASH, HallsMap, buildHalls, clampGrates, clampHalls, clearWalk, corridorAt, grateCut, hallsFor, hallsThemes, hallsWay, layoutFrame, roomAt, roomClamp, roomGap } from './halls';
import { ThreatTable, damageThreat, dropHero, healThreat, newThreat, scaleThreat, taunt, updateTarget, THREAT } from './threat';

/** Re-exported so tools' TUNE=KILNTRASH.hp=0.3 can reach it. */
export { KILNTRASH };
export const TICK = 1 / 30;
export const MINI_BOSS_AT = 240; // seconds
export const BOSS_AT = 480; // seconds
export const SPAWN_RADIUS = 700;
export const RARE_AT = 150;
/** Radius of the dungeon arena; everything stays inside it. */
export const ARENA = 560;
/** Seconds between a cleared fight (after the draft) and the next one. */
export const INTRO_TIME = 2.5;
/** Seconds to pick a gate at a fork before the steady path is taken. */
export const CHOOSE_TIME = 10;
/** Gate size and spacing at a fork. */
export const GATE_RADIUS = 46;
export const RIFT_TIMES = [60, 200, 330];
/** The Kiln Mother's own enrage (her harder, faster attacks); her Boil-over starts before it, at BOIL.kilnMother. */
const BOSS_ENRAGE_AFTER = 150;
/**
 * Boil-over (1.0 CP2, replaces Burnout; docs/design/fight-budgets.md, rename-map section 4): the boss's clock, shown.
 * The Kiln Mother boils over `kilnMother` s after she comes in; each other boss when it enrages (its own enrageAfter,
 * a raid boss's hard enrage) until its place is remade. It glows, taunts once, and every `every` s after that each hit
 * on a hero lands `step` harder. The boss plate counts down to it. No hidden timer kills anyone: you fall to the boss,
 * and the loss screen names the blow. The Kiln Mother's own enrage (BOSS_ENRAGE_AFTER, 150 s) still comes on top,
 * by then at Boil-over's 7th step (design, 27 Nov: moving her whole enrage to 90 s cost the Bulwark at tier 3 8 of 20
 * wins, Boil-over grid in teams/design.md).
 */
export const BOIL = { kilnMother: 90, every: 10, step: 0.2 };
/** Boil-over's one taunt (vision.md section 6 item 5; the Kiln Mother calls you "little thief", world.md), and the line for the other bosses until they get taunts. */
export const BOIL_TAUNT: { kilnMother: string; other: string } = { kilnMother: "You've stayed too long, little thief.", other: 'It hits harder every 10 s.' };
/**
 * Burnout's trash and named-fight timers are gone (1.0 CP2). What's left is a stall breaker that never hurts a hero:
 * a regular fight still going after `fight` s (`named` more for the delve's named foe) cracks its own foes, `ramp` of
 * their max health a second, plus `ramp` more each second. `addCap`: a fight never holds more than this many live
 * foes (summons past it fizzle).
 */
export const STALL = { fight: 240, named: 60, ramp: 0.04, addCap: 150 };
export const SHADOW_TIME = 60;
/** Chance that a normal enemy drops an item. */
const TRASH_DROP = 1 / 800;
const PLAYER_RADIUS = 12;
/** G6: an ally standing within this distance of a downed hero picks them up... */
export const REVIVE_RADIUS = 40;
/** ...at this share of their health. Leaving the circle resets the count. */
export const REVIVE_HEALTH = 0.3;
/**
 * G6 pick-up timing. Outside a boss fight a pick-up takes `seconds`, with no limit. While a boss
 * is up it takes `bossSeconds`, and the party gets `bossCap` pick-ups for the whole boss fight.
 */
export const REVIVE_RULES = { seconds: 3, bossSeconds: 9, bossCap: 1 };
/** Share of every hit the Bulwark's armor stops. */
const BULWARK_ARMOR = 0.2;
/** Shield Block: share of each hit stopped from the foe the Bulwark is sweeping. */
const BULWARK_BLOCK = 0.35;
const RINGWALL_BLOCK = 0.2;
/**
 * Blade Guard (novice aid): share of each hit the Duskblade stops from the foe it is swinging at, fading with the
 * rest of the aid (full at tier 1, none from tier 4; Grit Guard takes over from there). #618 had kept it at 0.7
 * through tiers 2 and 3, from laggedBot numbers; with reactBot the fading version already wins more than the
 * Emberwright at those tiers (design, 23 Nov; docs/skills.md).
 */
export const BLADE_GUARD = 0.5;
/**
 * Grit Guard (aid from tier 4, where Blade Guard ends): each Grit stack (a loss in a row on this tier, see GRIT) gives the
 * Duskblade `perStack` Blade Guard against the foe it is swinging at, up to `cap`. A win clears Grit, so a player who wins
 * never has it. In QA's career sim (LAG 0.5 SKILL 0.3, 190 t4 runs) it took the novice Duskblade from 0 to 26 t4 wins and its
 * worst losing streak from 21 to 13, with every career breaking through (skills, 23 Nov). See docs/skills.md.
 */
export const GRIT_GUARD = { perStack: 0.2, cap: 0.7, fromTier: 4 };
/**
 * Grit Cut (aid from tier 4 for every class but the Duskblade, which has Grit Guard instead): each Grit stack cuts all
 * damage the hero takes by `perStack`, up to GRIT.maxStacks stacks. Like Grit Guard it only exists after losses in a row on
 * that tier, so first tries and players who win are untouched (design, 23 Nov). See docs/skills.md.
 */
export const GRIT_CUT = { perStack: 0.07, fromTier: 4 };
/**
 * Ability unlocks (SLOT_UNLOCK in content/classes.ts): a hero below character level `until` deals `dmg` more damage and
 * takes `cut` less for each level it is short of it (level 1 three steps, 2 two, 3 one). This was one step per locked
 * slot when F opened at level 4; F now opens at level 1 (opening.md), and the aid stays by level, because dropping it with
 * F cost the Emberwright Kiln t3 at level 3 55 -> 46 of 60 wins at average skill (classes grid, 27 Nov). Only the first
 * character levels get it, so it only reaches the first delve and the first tiers a new character plays.
 */
export const UNLOCK_AID = { dmg: 0.1, cut: 0.1, until: 4 };
/** A hero's level is kept for unlocks while it still has a locked slot or UNLOCK_AID; past that it plays as unset. */
const UNLOCK_LEVEL_KEPT = Math.max(MAX_UNLOCK, UNLOCK_AID.until);
/**
 * 1.0 Checkpoint 2 (docs/design/checkpoint-2-grey-box.md, piece 4): the dodge roll every class has, on its own button.
 * The hero rolls `dist` px over `time` s (the way the stick points, else the way it faces), and no blow can touch it for
 * `guard` s (it uses shieldT, as Blink does: soaks, heat, cold and other unblockable ticks still land). `cd` s to recharge.
 */
export const ROLL = { dist: 120, time: 0.3, guard: 0.3, cd: 3 };
/**
 * 1.0 CP2 signature verb, Emberwright Overheat (vision.md section 6 item 7): at `from` Heat or more its fire deals `mult`
 * damage (dmgMult, so burns and burning ground lit while hot keep it), and its orb hits feed no more Heat. Reaching
 * full Heat in a fight (the slow drift, or Heat from kills and talents) scorches it for `scorch` of its max health
 * (unblockable) and vents the Heat down to `vent`.
 * Classes, 27 Nov (60% floor): orbs used to keep feeding Heat while hot, about 13.6 Heat/s in a long boss fight against
 * 10.7 at most that Flame Wave and Combustion on cooldown can spend, so the scorch could not be avoided and killed the
 * Emberwright in every boss loss at Wrackline 13 (65-100% of the damage taken).
 */
export const OVERHEAT = { from: 80, mult: 2, scorch: 0.04, vent: 55 };
/**
 * 1.0 CP2 signature verb, Cutwick (duskblade) Snip (id backstab; "Backstab" is a WoW Rogue ability, rename-map section 4): its direct hits on a foe from behind (outside `front` radians of
 * the way the foe faces) always crit, and a killing blow from behind readies Rending Dash at once. Foes face the way
 * they move, else their target, turning at `turn` rad/s (`bossTurn` for bosses), so a dash through a pack lands behind it.
 */
export const BACKSTAB = { front: (110 * Math.PI) / 180, turn: 5, bossTurn: 2.5 };
/** The dodge button's press id where a press travels as a slot number (the client's queue, a co-op guest's press). */
export const ROLL_SLOT = 4;
/**
 * 1.0 CP2 hold verbs (Bulwark Parry on E, Slagbinder charged shot on Q): an ability button held down. The client sends
 * Input.hold while the button is down; a release sooner than `tap` s is a plain press (the client casts the ability).
 */
export const HOLD = { tap: 0.22 };
/**
 * 1.0 CP2 signature verb, Bulwark Parry (vision.md section 6 item 7): hold E to raise the shield. While it is up the
 * Bulwark moves at `slow` speed and blows land `block` lighter. A red tell (a telegraph landing, a lunge, or a blow from
 * an elite, rare or boss) that lands within `window` s of raising it is parried: no damage, the attacker is staggered
 * `stagger` s (`bossStagger` for a boss) and Resolve refills. Raising it again within `rest` s of the last raise gives
 * no parry window, so tapping can't keep one open.
 */
export const PARRY = { window: 0.3, block: 0.4, slow: 0.5, stagger: 1.2, bossStagger: 0.5, rest: 0.8 };
/**
 * 1.0 CP2 signature verb, Lumen light motes: every `every`th Sunmote hit drops a mote of light by the foe it struck.
 * A hurt hero (any class) who walks within `reach` takes it and heals `heal` of its max health. A mote lasts `life` s;
 * at most `cap` lie on the floor (the oldest goes).
 */
export const LIGHT_MOTE = { every: 3, heal: 0.06, reach: 26, life: 8, cap: 5 };
/**
 * 1.0 CP2 signature verb, Slagbinder (gunner) charged shot: hold Q to charge the cannon (no shots while charging, `slow`
 * move speed); release after `min` s fires one shot, charged over `time` s: up to `mult` damage, and its pierce grows
 * from SLAG_KIT.cannonPierce to full. A fully charged shot shatters every Brittle foe it passes: `shatter` x its base
 * cannon damage to that foe and every foe within `shatterR`, and the Brittle is spent.
 */
export const CHARGE = { min: 0.25, time: 1.0, mult: 2.5, slow: 0.6, shatter: 1.0, shatterR: 100, slag: 18 };
/** Share of max health Sidestep heals. */
const SIDESTEP_HEAL = 0.03;
/** Share of max health Steady Breath restores, once per fight, to a melee hero below 30%. */
const SECOND_WIND = 0.2;
/** Share of max health Anvil Skin heals before Mended Iron. */
const BASTION_HEAL = 0.1;
/**
 * Group tools (roadmap G1). Each class gets one, and each fires only with more than one
 * hero, so solo play is unchanged.
 */
/** Second capstones (roadmap C5). Each branch's two capstones are offered together; taking one closes the other. */
export const CAPSTONES_2 = {
  /** Cinder Tide: Flame Wave all around you, and fire at your feet (radius, damage per second, seconds). */
  tideZoneR: 70, tideZoneDps: 14, tideZoneTime: 3,
  /** Searing Bloom: a crit splashes this share of the hit onto foes within this radius, and burns the target. */
  bloomShare: 0.6, bloomRadius: 90, bloomBurnDps: 30, bloomBurnTime: 3,
  /** Ashen Mantle: damage taken is cut by this share for this long after Blink. */
  mantleCut: 0.4, mantleTime: 3,
  /** Open Veins: bleed damage multiplier. */
  veinsMult: 1.6,
  /** Killing Rhythm: swing speed per stack, stack cap, and the longest gap that keeps the rhythm. */
  rhythmStep: 0.04, rhythmMax: 10, rhythmGap: 1.2,
  /** Iron Vigil: Anvil Skin's length. */
  vigilTime: 10,
  /**
   * Grudge: every this-many hits taken, the Bulwark lashes out at every foe within the radius,
   * for a flat amount plus this share of the damage those hits did, and staggers them.
   */
  grudgeEvery: 4, grudgeRadius: 150, grudgeDamage: 30, grudgeShare: 2, grudgeStun: 0.5,
  /** Shield Wake: the shockwave where Charge lands (radius, damage, stun seconds). */
  wakeRadius: 120, wakeDamage: 80, wakeStun: 1,
  /** Shield Wake: the shockwave hits elites, rares and bosses this many times as hard. */
  wakeBig: 2,
  /** Thornwall: the share of each hit always turned back, and Shield Sweep's damage multiplier while Anvil Skin is up. */
  thornReflect: 0.15, thornSkin: 3,
  /** Noonfire: Sunmote damage multiplier against elites, rares and bosses. */
  noonfireMult: 1.15,
  /** Haven: damage taken is cut by this share inside your own Sanctuary. */
  havenCut: 0.3,
  /** Chorus: every this-many Sunmotes, the target is struck twice. */
  chorusEvery: 8,
};

/**
 * Defence branches (Emberwright Ashguard, Slagbinder Crust): enough damage that a run committed to them
 * still finishes a boss before it enrages. Ring of Ash reach and damage; Cinder Skin and Mend in Embers
 * add damage per rank; Clinker Heart hits harder while the Slagbinder is plated.
 */
export const DEFENCE_BRANCH = {
  ringDamage: 45, ringR: 200, skinDmg: 0.06, mendDmg: 0.06, clinkerDmg: 0.5,
  /** Twin Coat (Forge): damage while plated. Kindled Ground (Wildfire), Renewal and Gleam Guard (Grace): damage per rank. */
  twinDmg: 0.4, groundDmg: 0.06, graceDmg: 0.08,
};

/** Party cards (Season 2): deep talent cards offered only with 2 or more heroes. Per rank unless noted. */
export const PARTY_CARDS = {
  leeRadius: 200, leeCut: 0.04, broadHeal: 0.06, frontMend: 0.04, wideDawn: 0.2, turnedBack: 0.06,
  breathRange: 300, breathHeal: 0.04, kindleTime: 2, kindleRadius: 60, warmRadius: 260, warmRegen: 0.2,
  standTime: 1, shellRadius: 50,
};

export const GROUP_TOOLS = {
  /** Emberwright, Kindling: Combustion lifts allies within this radius by this much damage for this long. */
  kindleRadius: 320, kindleMult: 1.1, kindleTime: 6,
  /**
   * Lumen, Purify: Hush with nothing to silence clears Slag Grip from an ally within this range.
   * It doesn't heal and doesn't clear Sundered: an 8% heal on top took a 4-hero party from 40 to 57
   * wins in 60 and a Bulwark + Lumen pair from 15 to 47, and clearing Sundered undoes the tank swap.
   */
  purifyRange: 500,
  /** Bulwark, Called Out: Shield Toss with nothing to interrupt taunts the boss within this range. */
  callOutRange: 420,
};
/** Health each Sunmote hit gives the Lumen. */
const SUNMOTE_HEAL = 1;
/** Shield Sweep damage multiplier against elites and bosses. */
const SWEEP_BIG_MULT = 1.15;
/** Duskblade Open Wounds: how long a swing's cut halves the foe's healing. */
const OPEN_WOUNDS_TIME = 3;
/** Resolve a Bulwark spends to smother a Sluice Crawler's bloom. */
const SMOTHER_COST = 10;
/** Lumen: Sunmote reach and the most Brilliance (stored overheal) it can hold. */
const LUMEN_RANGE = 500;
const LUMEN_MAX_BRILLIANCE = 200;
/** The Slagbinder, the fifth class: an off-tank and support hybrid (docs/skills.md). */
export const SLAG_KIT = {
  lobEvery: 0.7, lobRange: 360, lobDamage: 20, lobSplash: 14, lobSplashR: 50, lobSlag: 4,
  slagPerDamage: 0.5,
  plateShare: 0.15, plateTime: 6, plateBurst: 40, plateBurstR: 90, plateRange: 300,
  interposeLeap: 150, interposeRange: 450, interposeTime: 3, interposeShare: 0.6, interposeCut: 0.3,
  plateMend: 1, shellTime: 5, shellCut: 0.35, shellRadius: 160,
  brittleMult: 1.15, brittleTime: 6,
  bellowsThreat: 2, anvilPlate: 0.75, anvilShell: 2, bellowsInterpose: 1,
  anvilArmor: 0.35, anvilHp: 40,
  /** Party only: the Anvil's damage cut when it has allies (a party tank also has a healer). */
  partyAnvilArmor: 0.2,
  everMoltenRefund: 15, heartAt: 0.3, heartShare: 0.25, heartEvery: 30,
  tideRadius: 120, tideDamage: 60, tideStun: 1,
  hailEvery: 4, shatterMult: 1.25,
  /** Party only: Cooling Shell's cut on allies (its own wearer keeps shellCut), and plating poured on an ally. */
  allyShellCut: 0.2, allyPlate: 0.5,
  /** Party only: how much harder Brittle foes take hits from the Slagbinder's allies (its own hits use brittleMult). */
  allyBrittle: 1.15,
  /**
   * Solo only: a Bellows Slagbinder's damage when alone (design, 25 Nov). It was the slowest class everywhere, and a third
   * to a half of its Kiln 6/8 losses were the boss timer: 1.2 takes Kiln 8 from 20.7 to 29.0 of 40 (inside the L7 +-15 gate,
   * +13.3 over the Emberwright: a watch item) and its delve from 624 to 539 s. See docs/skills.md.
   */
  soloDmg: 1.2,
  /** Party only: a Bellows Slagbinder's damage when it has allies. */
  partyDmg: 0.7,
  /** The Flue (raid 4) is a damage race, where the Bellows' Brittle and sustain count for less: a lighter party cut there. */
  fluePartyDmg: 0.85,
  /**
   * The gunner (Steve 25 Nov: "a slower sniper type that fires a gun or cannon slowly but does heavier damage"; brief section 5).
   * The Slag Lob becomes a slow Cannon shot that pierces in a line, the Anvil stance goes (the Bulwark is the only tank),
   * Interpose is a self leap (Recoil), and the gunner has less health. The gunner uses gunnerSoloDmg alone instead of soloDmg.
   */
  cannonEvery: 1.6, cannonRange: 460, cannonDamage: 62, cannonWidth: 22, cannonPierce: 0.5, cannonSlag: 9, gunnerHp: 35,
  /**
   * Solo only: the gunner's damage when alone (classes, 26 Nov). With its tree it won 198-199 of 200 at one hard tier per
   * solo dungeon (heroes-r2, 40 seeds), against 171-185 for the Lumen and Emberwright; at 0.88 it is 188-194, delves
   * 169-316 s. 0.85 measured the same, so wins sit near the ceiling there. Parties keep partyDmg.
   */
  gunnerSoloDmg: 0.88,
};

/** Ability options (ALT_ABILITIES in content/classes.ts): tuning. */
export const ALT_KIT = {
  emberWardShare: 0.25, emberWardTime: 3, emberWardBurn: 12, emberWardBurnTime: 3,
  hamstringDamage: 55, hamstringBleed: 12, hamstringRadius: 120, hamstringTime: 4, slowNormal: 0.5, slowBig: 0.2,
  cryTime: 5, cryCut: 0.25, cryRadius: 200, cryHeal: 0.15,
  wellTime: 6, wellRadius: 90, wellHeal: 3,
  pitTime: 5, pitRadius: 80, pitDps: 10, pitSlowNormal: 0.4, pitRange: 360,
  /** Wide Cut (Duskblade R, level 12) and Quicken (Duskblade E, level 16). */
  wideCutDamage: 110, wideCutRadius: 150, wideCutBleed: 10, quickenTime: 5, quickenHaste: 0.4,
  /** Clout (Bulwark Q, level 12) and Gather (Bulwark E, level 16). */
  cloutDamage: 120, cloutSplash: 50, cloutSplashR: 90, cloutMend: 0.5, cloutStun: 1, cloutStunBig: 0.3,
  gatherRadius: 260, gatherTime: 4, gatherCut: 0.2, gatherResolve: 10, gatherStunBig: 0.8,
  /** Sunlance (Lumen Q, level 12) and Canopy (Lumen R, level 16; reuses Sanctuary's ground, radius and timer). */
  sunlanceDamage: 95, sunlanceHeal: 15, canopyCut: 0.25, canopyBurn: 0.5,
  /** Ember Dart (Emberwright Q, level 12) and White Heat (Emberwright R, level 16). */
  emberDartDamage: 110, emberDartBurn: 15, emberDartBurnTime: 4, emberDartRange: 400, whiteHeatDamage: 200, whiteHeatRadius: 200, whiteHeatShove: 80, whiteHeatBurn: 20, whiteHeatBurnTime: 4, whiteHeatLeap: 450,
  /**
   * Slag Spray (Slagbinder Q, level 12): a cone of molten slag; the splashback plates the gunner at sprayPlate of
   * Molten Plating's thickness. Slag Mortar (Slagbinder R, level 16): a shell that lands on a foe in reach.
   */
  sprayDamage: 75, sprayReach: 240, sprayHalf: 35, sprayShove: 50, sprayPlate: 0.5,
  mortarDamage: 110, mortarRadius: 110, mortarRange: 500, mortarStun: 1,
};

/** A hero's ability options for a run: `alts` by id (cleaned), else `alt` as the class's level-8 option. */
function altsFor(cls: ClassId, o: { alt?: boolean; alts?: AltId[] }): AltId[] | undefined {
  const ids = o.alts ? cleanAlts(cls, o.alts) : o.alt ? [ALT_OPTIONS[cls][0].id] : [];
  return ids.length ? ids : undefined;
}

/** Slagbinder stance, picked before the run and kept all run: Anvil tanks, Bellows fills a damage slot. */
export type Stance = 'anvil' | 'bellows';

/** High Noon and Choir of Dawn, reworked in L7 because both added almost nothing (see docs/skills.md). */
export const LUMEN_CAPS = {
  noonEvery: 4, noonBase: 40, noonPer: 1.5,
  choirR: 170, choirDamage: 16,
};

const CAP = { enemies: 900, orbs: 256, gems: 900, zones: 128, telegraphs: 24, strikes: 64, lances: 16, drops: 24, veins: 6, cracks: 4 };

export interface Input {
  /** Desired move direction; any length, normalised inside. */
  x: number;
  y: number;
  /** Ability button pressed this tick (0-3), if any. */
  cast?: number;
  /** The dodge button (ROLL) was pressed this tick. */
  roll?: boolean;
  /** 1.0 CP2: the ability button (0-3) held down this tick (HOLD; Parry, charged shot). */
  hold?: number;
}

export interface Enemy {
  alive: boolean;
  kind: EnemyKind;
  def: EnemyDef;
  x: number;
  y: number;
  px: number;
  py: number;
  hp: number;
  maxHp: number;
  touchCd: number;
  orbitCd: number;
  burnDps: number;
  burnT: number;
  /** The hero who last lit the burn or bleed (the Colossus judges its ticks from where they stand). */
  burnBy?: number;
  /** Duskblade Open Wounds: while above 0, this foe takes half healing. */
  woundT: number;
  flash: number;
  abilityT: number;
  spawnedAt: number;
  /** BOSSV2: when a hero last hit it (Vorhulm the Glutton Gorges after KILN_V2.gorgeQuiet s without one). */
  hitAt?: number;
  /** Character tree, Kickback: which hero this foe last hit, and when. */
  struckBy?: number;
  struckAt?: number;
  /** Current cast ('' when not casting); shown on cast bars. */
  castId: string;
  castName: string;
  castT: number;
  castDur: number;
  interruptible: boolean;
  stunT: number;
  /** Kilnbreaker 3-piece: takes extra damage after being interrupted. */
  exposedT?: number;
  /** The opening: a Quenched caster is staggered, taking FIRST_DELVE.stagger.taken times the damage while this runs. */
  staggerT?: number;
  /** Slagbinder: the run time until which this foe is Brittle (takes more damage from everyone). */
  brittleUntil?: number;
  /** Hamstring and Cinder Sump: the run time until which this foe is slowed, and its speed factor. */
  slowUntil?: number;
  slowMult?: number;
  /** Ember Twins: the fallen twin's maxHp while this one casts Rekindle (design, 25 Nov: it returns at half of that). */
  rekindleHp?: number;
  /** Damage taken during the current Kindle cast; enough of it breaks the cast. */
  /** Spare per-enemy timers and counters for scripted abilities. */
  aux: number;
  aux2: number;
  /** Warded Omen: remaining shield, and whether it has been granted yet. */
  ward: number;
  warded: boolean;
  /** C2: index into NAMED_TITLES (-1 for an ordinary foe), and into AFFIXES. */
  named: number;
  affix: number;
  /** Phase 18 Halls: the map pack (World.halls.packs index) this foe belongs to; set only on Halls runs. */
  pack?: number;
  /** Backstab (BACKSTAB): the way this foe faces, turned toward where it moves or its target. */
  face?: number;
  /** FOE_AI lunge: seconds until it may lunge again, wind-up left (red lane showing), dash left, and the lane's angle. */
  lungeT: number;
  lungeW: number;
  lungeD: number;
  lungeA: number;
}

export interface Orb {
  alive: boolean;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  target: number;
  dmg: number;
  /** Hero index that fired it. */
  owner: number;
  /** Piercing Cinders: foes it can still pass through, and the last one it hit. */
  pierce: number;
  lastHit: number;
}

export interface Gem {
  alive: boolean;
  x: number;
  y: number;
  px: number;
  py: number;
  value: number;
  pulled: boolean;
  /** Co-op: the hero this gem is flying to. */
  to?: number;
}

export interface Zone {
  alive: boolean;
  x: number;
  y: number;
  r: number;
  dps: number;
  life: number;
  maxLife: number;
  tickT: number;
  /** Hero index that made it. */
  owner: number;
}

export interface Telegraph {
  alive: boolean;
  shape: 'circle' | 'cone';
  x: number;
  y: number;
  r: number;
  angle: number;
  arc: number;
  t: number;
  dur: number;
  dmg: number;
  /** 'hit' damages whoever is inside; 'soak' punishes the raid if nobody stands in it. */
  /** 'bloom' (Sluice Crawler) also heals any enemy inside when it bursts. */
  kind: 'hit' | 'soak' | 'bloom';
  /** Enemy whose cast created it; interrupting that enemy removes it. */
  owner: number;
  /** The hero was inside when it appeared (so leaving it before it lands is a dodge). */
  wasIn?: boolean;
  /** Co-op: bit i set if hero i was inside when it appeared. */
  inMask?: number;
}

export interface Drop {
  alive: boolean;
  x: number;
  y: number;
  item: Item | null;
}

/** Coldmarrow phase 2: a crack in the frozen river, a straight strip of open water across the arena. */
export interface Crack {
  alive: boolean;
  /** A point on the crack's centre line, and the line's direction. */
  x: number;
  y: number;
  angle: number;
  /** Seconds since it appeared: it is a warning until COLD.crackWarn, then open water until COLD.crackWarn + COLD.crackOpen. */
  t: number;
}

/** The Wrackline: a raft drifting round the arena. Standing on one anchors you against the undertow. */
export interface Raft {
  /** Angle on its drift circle (radians) and the drift circle's radius. */
  a: number;
  ring: number;
  /** +1 or -1: which way round it drifts. */
  dir: number;
  x: number;
  y: number;
  /** Seconds left sunk by Hessa's Sink (0 = afloat). */
  sunkT: number;
}

export interface Vein {
  alive: boolean;
  x: number;
  y: number;
  progress: number;
}

export interface Gate {
  kind: GateKind;
  encounter: EncounterId;
  x: number;
  y: number;
  r: number;
}

export interface Strike {
  alive: boolean;
  x: number;
  y: number;
  r: number;
  t: number;
  dmg: number;
}

export interface Lance {
  alive: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
}

export interface Player {
  /** The Coldmarrow: Hearthcoal warmth (0 to 1), its light radius in world units, and Chill stacks (frozen at COLD.frozenAt). */
  coal?: number;
  coalR?: number;
  chill?: number;
  chillT?: number;
  /** Phase 15 Y10: share of max health this hero has lost in the current fight (for the dungeon's stir). */
  stirHurt?: number;
  /** The loss screen's "what hurt most": health lost this fight by what took it (foe names, 'Lava', 'Burnout'...), and the last blow. */
  hurtBy?: Record<string, number>;
  lastHurtBy?: string;
  /** Hammerdeep: Slag Grip stacks (an ally's heal clears them) and Sundered time left. */
  slag?: number;
  /** P1 weekly quests: casts this hero interrupted this run. */
  interrupts?: number;
  /**
   * 1.0 CP2 mastery card (sim/mastery.ts): red blows aimed at this hero (it stood in the tell when it appeared, or when it
   * landed) and the ones it walked or rolled out of; casts it could have Kicked (a kick class with F open) that went off.
   */
  tells?: number;
  dodges?: number;
  castsMissed?: number;
  sunderT?: number;
  /** Relay (verb set): seconds left of the damage bonus from a soak. */
  relayT?: number;
  /** Crawsplitter (verb set): seconds left of the damage bonus after the Craw breaks. */
  freedT?: number;
  /** Raid 2: seconds left inside Old Vorhulm (swallowed: can't act, can't be hit, digests at 0). */
  swallowT?: number;
  /** Raid 4: seconds left before this hero can hold a Decree again (after passing one on). */
  spentT?: number;
  /** The Pressworks: seconds left Pressed after taking a Downstroke (a Pressed hero can't take the next one). */
  pressedT?: number;
  /** Co-op: the run time until which an Emberwright's Kindling lifts this hero's damage. */
  kindleUntil?: number;
  /** Ashen Mantle: the run time until which this hero takes less damage. */
  mantleUntil?: number;
  /** Killing Rhythm: swings in a row, and when the last one landed. */
  rhythmN?: number;
  lastSwingAt?: number;
  /** Hits taken toward the next Grudge lash (Bulwark), and Sunmotes fired (Chorus). */
  grudge?: number;
  grudgeDmg?: number;
  motesFired?: number;
  /** Slagbinder: its stance, plating on this hero (until when, how much, who poured it), Interpose cover, Cooling Shell, Lobs thrown, Clinker Heart. */
  stance?: Stance;
  /** Ability options (ALT_OPTIONS) this hero swapped in, at most one per slot. */
  alts?: AltId[];
  /** Character level that sets which action-bar slots this hero has unlocked (SLOT_UNLOCK in content/classes.ts). Unset means all 4. */
  unlockLevel?: number;
  /** Muster, Glow Pool, Cinder Sump and Quicken timers and positions. */
  cryUntil?: number;
  quickUntil?: number;
  /** Gather (Bulwark E option): takes less damage until then. */
  gatherUntil?: number;
  /** Canopy (Lumen R option): the Lumen's Sanctuary ground is a Canopy (no heal, half burn, cuts damage). */
  canopy?: boolean;
  /** Under a Lumen's Canopy until then (refreshed each pulse). */
  canopyUntil?: number;
  wellUntil?: number;
  wellX?: number;
  wellY?: number;
  wellT?: number;
  pitUntil?: number;
  pitX?: number;
  pitY?: number;
  plateUntil?: number;
  /** Plating left (its own pool, apart from ward: it stops blows, never unblockable ticks), and how much was poured. */
  plate?: number;
  plateAmt?: number;
  plateBy?: number;
  interposeUntil?: number;
  interposeBy?: number;
  shellUntil?: number;
  lobs?: number;
  heartReadyAt?: number;
  x: number;
  y: number;
  px: number;
  py: number;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpToNext: number;
  pendingLevels: number;
  /** 1.0 CP2: a Relic pick is waiting (after the door guard), the Relic carried, and whether a Spare Wick has caught them. */
  relicPick?: boolean;
  relic?: RelicId;
  relicSpent?: boolean;
  /** Set timers (R4): Kilnbreaker damage, time on the move and a charged Tidewalker hit, Glarewarden damage. */
  kbT?: number;
  moveT?: number;
  moving?: boolean;
  surge?: boolean;
  gwT?: number;
  gwReadyAt?: number;
  /** Hearthkeeper: Warmth stacks from kills, and seconds since the last kill (a stack fades every SET_TUNING.hkFade). */
  warmth?: number;
  warmT?: number;
  /** Wrackrider: seconds standing still, and seconds left Planted, and whether the hero is Planted (still long enough, or on a raft in the Wrackline). */
  stillT?: number;
  /** Kinbound: seconds left Covered (an ally healed you, 2 pieces) and Bonded (you covered an ally, or one covered you, 3 pieces). */
  coverT?: number;
  bondT?: number;
  plantT?: number;
  planted?: boolean;
  /** Co-op, while downed: seconds an ally has stood on this hero (G6 in-fight revive). */
  reviveT?: number;
  volleyT: number;
  rainT: number;
  lanceT: number;
  orbitAngle: number;
  hurtFlash: number;
  facing: number;
  heat: number;
  /** Remaining cooldown per action-bar slot. */
  cds: number[];
  gcd: number;
  shieldT: number;
  /** Duskblade: swings so far, parry recharge, and a guaranteed crit. */
  swings: number;
  parryT: number;
  nextCrit: boolean;
  /** Vent-Fed: the next Cinder Volley deals double damage. */
  ventVolley?: boolean;
  /** Read the Lane: swings left with the bonus. */
  laneN?: number;
  /** Seconds left on the Hot Heels run boost. */
  hasteT: number;
  /** Dodge roll (ROLL): seconds left rolling, seconds until the next roll, its direction, and blows rolled through. */
  rollT?: number;
  rollCd?: number;
  rollAng?: number;
  rolled?: number;
  /** Rolls started this run (the opening's end card: "Rolled N"). */
  rolls?: number;
  /** 1.0 CP2 hold verbs (HOLD): the slot held (-1 or unset: none) and for how long. */
  holdSlot?: number;
  holdT?: number;
  /** Parry (PARRY): when the shield was last raised, whether this raise has a parry window, and parries made. */
  raiseAt?: number;
  parryOpen?: boolean;
  parries?: number;
  /** Light motes (LIGHT_MOTE): Sunmote hits toward the next mote. */
  moteHits?: number;
  /** Stored extra Blink charges (Hot Heels rank 2) and the timer refilling one. */
  blinkCharges: number;
  blinkChargeT: number;
  /** Bulwark: absorb shield, its refresh timer, Anvil Skin time left, damage Anvil Skin stopped, Shield Echo timer and angle. */
  ward: number;
  wardT: number;
  bastionT: number;
  /** Character tree, Onrush: seconds left of the cut after a Charge. */
  onrushT?: number;
  prevented: number;
  echoT: number;
  /** Bulwark: the foe its shield faces (the last Shield Sweep target); its hits are partly blocked. */
  guardId: number;
  /** Bulwark: direction of the last Shield Sweep; big foes in front of it are blocked too. */
  guardAng: number;
  echoAng: number;
  /** Lumen: stored overheal, Sanctuary and healing pool timers and centres, High Noon timer, Martyr's Halo used this fight. */
  brilliance: number;
  sanctT: number;
  sanctX: number;
  sanctY: number;
  sanctTick: number;
  poolT: number;
  poolX: number;
  poolY: number;
  noonT: number;
  haloUsed: boolean;
  /** Melee Steady Breath: used this fight. */
  windUsed: boolean;
  /** Mirrorstep: afterimage time left and where it stands. */
  imageT: number;
  imageX: number;
  imageY: number;
  /** Tethered Shield: the caster the shield hit, and how long Charge may rush it. */
  tossId: number;
  tossT: number;
  /** Banked Flame: orbs fired. Worrying Edge: the swing target and its stacks. */
  orbsFired: number;
  worryId: number;
  worryN: number;
}

export type SimEvent =
  /** `hero`: who landed it (World.acting), so a screen can tell its own hits from an ally's. */
  | { type: 'hit'; x: number; y: number; amount: number; crit: boolean; hero?: number; /** Phase 16 U2: an Ashwall's shield cut this hit (its front, or a foe sheltering behind it). */ glance?: true }
  | { type: 'kill'; x: number; y: number; kind: EnemyKind }
  | { type: 'playerHurt'; amount: number; hero?: number }
  | { type: 'levelUp'; level: number; hero?: number }
  | { type: 'eliteSpawn' }
  | { type: 'bossSpawn' }
  /** C2: a named elite joined this fight, and one fell. */
  | { type: 'namedKill'; x: number; y: number; name: string }
  | { type: 'namedSpawn'; index: number; name: string; affix: Affix }
  | { type: 'bossEnrage' }
  /** Boil-over (1.0 CP2): the boss glows and taunts, and from now on hits harder every BOIL.every s. */
  | { type: 'boilOver' }
  /** CP3 Kiln Mother remake: one of her taunts (sim/content/kilnmother.ts), once per moment per fight. */
  | { type: 'bossSay'; say: KilnSay; line: string }
  /** C7: a fight has gone on too long (`warn`: 30 s left; otherwise the fire now takes everything). */
  | { type: 'emberTaken'; x: number; y: number }
  | { type: 'emberEaten'; x: number; y: number; fed: number }
  | { type: 'swallowed'; hero: number }
  | { type: 'digested'; hero: number }
  | { type: 'spatOut'; hero: number }
  | { type: 'wheel'; hero: number }
  /** Phase 15 Y3 Millstone: the Colossus starts or stops grinding round (`dir` +1 or -1). */
  | { type: 'millstone'; stage: 'start' | 'end'; dir: number }
  /** Phase 16 U1: the boss uses her echo's move (`id`, a version id) in her last phase. */
  | { type: 'echo'; id: string }
  /** Phase 15 Y3 Tithe: the Regent's gold circle landed with `n` heroes in it; `ok` when that was enough. */
  | { type: 'tithe'; ok: boolean; n: number }
  | { type: 'meltPulse'; n: number }
  /** Raid 4 (the Flue): a Decree landed on a hero, was passed (`from` to `hero`; `done`: its last pass, so it fades), or burst. */
  | { type: 'decree'; hero: number }
  | { type: 'decreePassed'; from: number; hero: number; done: boolean }
  | { type: 'decreeBurst'; hero: number }
  | { type: 'officePulse'; n: number }
  | { type: 'explode'; x: number; y: number; r: number }
  /** Glarewell: a Glare went off; `hit` is whether it caught the hero in the light. */
  | { type: 'glare'; x: number; y: number; hit: boolean }
  | { type: 'brandBurst'; x: number; y: number; r: number }
  | { type: 'pillarCrack'; index: number }
  | { type: 'strike'; x: number; y: number; r: number }
  | { type: 'ysFlare'; /** YSMERETV2 stage 2: a flame with no hero near it flared and hit every hero. */ x: number; y: number }
  | { type: 'slam'; x: number; y: number; r: number; /** What landed, where a sound or draw needs to tell slams apart: 'slagBurst' is Ondrel v2's stage 3 burst, 'crush' Oskel v2's crush line (a hero hit or a foe crushed). */ source?: 'slagBurst' | 'crush' }
  /** V1: an Ember Spitter lobbed a fire circle from (x1, y1) to (x2, y2); an Ashbuck started down its lane. */
  | { type: 'spitLob'; index: number; x1: number; y1: number; x2: number; y2: number }
  | { type: 'charge'; index: number }
  /** V2: this fight's arena layout (not sent for an open arena), and a Kiln vent flaring at (x, y). */
  | { type: 'layout'; id: LayoutId }
  | { type: 'arenaEvent'; id: ArenaEventId; stage: 'warn' | 'land' }
  /** Phase 15 Y10: the dungeon stirred: this fight has a reaction (and drops a second bag). */
  | { type: 'stir'; id: StirId }
  /** Phase 15 Y1: a fight's wave came in a new shape (`start`), or its held pack is about to come (`warn`) or came (`land`). */
  | { type: 'waveShape'; id: Exclude<WaveShape, 'arc'>; stage: 'start' | 'warn' | 'land'; x: number; y: number }
  | { type: 'ventFlare'; x: number; y: number }
  /** V8: Nhevra's Emberdrift drops `n` embers; a hero picks one up. */
  | { type: 'emberDrift'; n: number }
  | { type: 'emberPick'; x: number; y: number; hero: number }
  /** V8: Maelra's Sluicetide turns; `angle` is the way the water now flows. */
  | { type: 'tideTurn'; angle: number }
  /** Y3 Carried Light: the Glarewell's light now comes from here. */
  | { type: 'lightMove'; x: number; y: number }
  | { type: 'homeward'; stage: 'out' | 'back'; x: number; y: number }
  | { type: 'ventRoll'; x: number; y: number; left: number }
  | { type: 'overflow'; stage: 'warn' | 'rise' | 'ebb' }
  | { type: 'inhale'; stage: 'warn' | 'draw' | 'end' }
  /** Y3 Creeping Rime: the rime rises here as phase 2 starts. */
  | { type: 'rimeRise'; x: number; y: number }
  /** Y3 Sealed Vents: the steam is about to move to `vent` ('warn'), or has moved there ('open'). */
  | { type: 'ventShift'; stage: 'warn' | 'open'; vent: number }
  | { type: 'chest'; x: number; y: number }
  | { type: 'revive'; hero?: number; /** Co-op: the ally who picked them up (absent for a Phoenix Feather). */ by?: number }
  /** A Relic (1.0 CP2) did its thing: the Spare Wick caught a hero, or one was picked up (`picked`). */
  | { type: 'relic'; id: RelicId; hero: number; x: number; y: number; picked?: boolean }
  | { type: 'ability'; slot: number; x: number; y: number; angle: number; r: number; /** The hero's ability option (ALT_ABILITIES), not the class's own. */ alt?: boolean; /** Who cast the option (World.acting), so a screen draws it as that hero's class and from that hero. */ hero?: number }
  | { type: 'blink'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'dash'; x1: number; y1: number; x2: number; y2: number; dodge: boolean }
  | { type: 'swing'; x: number; y: number; angle: number; r: number; arc: number; spin: boolean }
  | { type: 'parry'; x: number; y: number }
  | { type: 'mote'; x1: number; y1: number; x2: number; y2: number }
  /** The Slagbinder's Slag Lob, from the hero to the foe it hits. */
  | { type: 'lob'; x1: number; y1: number; x2: number; y2: number }
  /** The Slagbinder gunner's Cannon shot: from the hero (x1, y1) along its line to (x2, y2). */
  | { type: 'cannon'; x1: number; y1: number; x2: number; y2: number }
  /** id is the cast's stable key (sound keys on it; the name is display text and may be renamed). */
  | { type: 'castStart'; index: number; id: string; name: string }
  | { type: 'cleanse'; x: number; y: number }
  | { type: 'plate'; x: number; y: number; hero: number }
  | { type: 'brittle'; x: number; y: number }
  | { type: 'slagGrip'; x: number; y: number; stacks: number }
  | { type: 'interrupt'; x: number; y: number; name: string }
  /** The opening: a Quenched caster is staggered for `time` s (FIRST_DELVE.stagger). */
  | { type: 'staggered'; x: number; y: number; time: number }
  | { type: 'dodge'; x: number; y: number; healed: number }
  /** 1.0 CP2 Backstab: a Cutwick hit foe (x, y) from behind (a sure crit). */
  | { type: 'backstab'; x: number; y: number; hero: number }
  /** 1.0 CP2 Overheat: an Emberwright hit full Heat and scorched itself. */
  | { type: 'overheat'; x: number; y: number; hero: number }
  /** 1.0 CP2: a hero started a dodge roll (ROLL) from (x, y) toward `angle`. */
  | { type: 'roll'; x: number; y: number; angle: number; hero: number }
  /** 1.0 CP2 Parry: a Bulwark's raised shield turned a red tell aside at (x, y). */
  | { type: 'shieldParry'; x: number; y: number; hero: number }
  /** 1.0 CP2 light motes: a Lumen's hit dropped a mote at (x, y); a hero took one. */
  | { type: 'lightMote'; x: number; y: number }
  | { type: 'lightMoteTaken'; x: number; y: number; hero: number }
  /** 1.0 CP2 charged shot: a Slagbinder released a shot charged `c` (0-1) along the line; a full one shattered a Brittle foe. */
  | { type: 'chargedShot'; x1: number; y1: number; x2: number; y2: number; c: number; hero: number }
  | { type: 'shatter'; x: number; y: number; hero: number }
  | { type: 'castDone'; x: number; y: number; id: string; name: string }
  | { type: 'heal'; x: number; y: number; amount: number }
  | { type: 'ward'; index: number; amount: number }
  | { type: 'fork'; gates: Gate[] }
  | { type: 'gateChosen'; kind: GateKind; id: EncounterId; timedOut: boolean }
  | { type: 'phase'; phase: number }
  | { type: 'rareSpawn' }
  | { type: 'riftOpen'; x: number; y: number }
  | { type: 'riftClosed'; x: number; y: number }
  /** V1: a Hollow Rift spat out `n` Ashlings. */
  | { type: 'riftSpawn'; index: number; n: number }
  | { type: 'gather'; x: number; y: number }
  | { type: 'soak'; ok: boolean; x: number; y: number; /** The telegraph's owner: -4 is a Banked Coal (a miss feeds Vorhulm, no blast). */ owner?: number }
  | { type: 'drop'; x: number; y: number; rarity: Rarity }
  | { type: 'loot'; item: Item; equipped: boolean; delta: number; hero?: number }
  | { type: 'encounterStart'; index: number; id: EncounterId }
  /** Phase 18 Halls: map pack `pack` woke (World.halls.packs), and the party went through the boss door. */
  | { type: 'hallsWake'; pack: number }
  | { type: 'hallsDoor' }
  | { type: 'hallsGrateWarn'; room: number }
  | { type: 'hallsGrateDrop'; room: number }
  | { type: 'hallsGrateLift'; room: number }
  | { type: 'hallsLeash'; room: number }
  | { type: 'encounterClear'; index: number; id: EncounterId }
  | { type: 'end'; victory: boolean };

export type SimState = 'running' | 'draft' | 'ended';

export interface DraftOption {
  id: TalentId;
  nextRank: number;
  /** 1.0 CP2: a Relic card (after the door guard) instead of a Spark; `id` is then unused. */
  relic?: RelicId;
}

/** Another hero in a co-op party (the main hero comes from WorldOptions itself). */
/** P6: what a hero wears for the rest of the party to see. Looks only. */
export interface HeroLooks {
  title?: string;
  glow?: string;
  /** Season trail worn (a TRAILS id) and its best stage, 1 to 3. */
  trail?: { id: string; stage: number };
}

export interface HeroOptions {
  cls?: ClassId;
  /** Slagbinder stance for this run (default Bellows). */
  stance?: Stance;
  /** The class's level-8 ability option for this run (ALT_ABILITIES); `alts` names options by id instead. */
  alt?: boolean;
  /** Ability options for this run (ALT_OPTIONS ids, one per slot). */
  alts?: AltId[];
  /** This hero's character level, for ability unlocks (SLOT_UNLOCK); unset means all 4 slots. */
  unlockLevel?: number;
  gear?: Item[];
  passives?: Partial<Record<PointId, number>>;
  name?: string;
}

/** The per-hero state a co-op snapshot carries (the rest of HeroSlot comes from the start options). */
export interface HeroSlotData {
  player: Player;
  talents: Partial<Record<TalentId, number>>;
  choices: DraftOption[];
  revived: boolean;
  damageDealt: number;
  shadowDamage: number;
  runDrops: Item[];
  runEquipped: string[];
}

/** Everything that belongs to one hero; World swaps these in with use(). */
interface HeroSlot {
  id: string;
  name: string;
  player: Player;
  talents: Partial<Record<TalentId, number>>;
  choices: DraftOption[];
  loadout: Loadout;
  cls: ClassId;
  classDef: ClassDef;
  passives: Partial<Record<PointId, number>>;
  gear: Item[];
  revived: boolean;
  runDrops: Item[];
  runEquipped: string[];
  damageDealt: number;
  shadowDamage: number;
}

export interface WorldOptions {
  seed: number;
  /** Co-op: the main hero's name, shown over them to the rest of the party. */
  heroName?: string;
  /** Co-op: the other heroes in the party, after the main hero (at most 3). */
  party?: HeroOptions[];
  /** P6, client only (the sim never reads it): each hero's worn season title and glow, by hero index (0 is the main hero). */
  looks?: HeroLooks[];
  /** Stress test: hundreds of enemies from the start, player cannot die. */
  stress?: boolean;
  /** Developer option: the player takes no damage. */
  invulnerable?: boolean;
  /** Equipped gear brought into the run. */
  gear?: Item[];
  /** Permanent hero passives. */
  passives?: Partial<Record<PointId, number>>;
  /** Hero level, which sets the item level of drops. */
  heroLevel?: number;
  /** First free item id, so run drops never collide with the hero's bag. */
  nextItemId?: number;
  /** Fixed encounter route; rolled from the seed when left out. */
  route?: EncounterId[];
  /** Difficulty tier, 1 and up. Higher tiers hit harder and drop better loot. */
  tier?: number;
  /** Which class the hero plays this run. */
  cls?: ClassId;
  /** Slagbinder stance for this run (default Bellows). */
  stance?: Stance;
  /** The class's level-8 ability option for this run (ALT_ABILITIES); `alts` names options by id instead. */
  alt?: boolean;
  /** Ability options for this run (ALT_OPTIONS ids, one per slot). */
  alts?: AltId[];
  /** The main hero's character level, for ability unlocks (SLOT_UNLOCK); unset means all 4 slots (tools and tests). */
  unlockLevel?: number;
  /** Week number for the Omen rotation (the client passes it; the sim never reads the clock). */
  week?: number;
  /** P2 season track: the day number (dayOf in bounty.ts), for the first win of the day. */
  day?: number;
  /** V4: today's Heat (heatFor in content/heat.ts). The sim keeps it only where it fits (heatFits: a solo dungeon whose pool has it; not the first delve, a bounty or a key run). */
  heat?: HeatId;
  /** Fixed Omens, overriding the weekly rotation (tests and tools). */
  omens?: OmenId[];
  /** The living world boss's Omen: added to every delve on top of the tier's Omens, for extra luck. */
  bossOmen?: OmenId;
  /** Name of the living world boss; when set, a won delve offers a bonus fight against its shadow. */
  worldBoss?: string;
  /** Which dungeon to delve (default the Kiln Depths). */
  dungeon?: DungeonId;
  /** Heroes in the party (1 to 4). Scales enemy health and targeted mechanics. */
  partySize?: number;
  /** Fill with bots: how many of the party heroes are bots (content/botfill). A bot-filled party gets no extra group boss item. */
  fillBots?: number;
  /** Grit stacks from losses in a row on this tier (see content/scaling). */
  grit?: number;
  /** True when this tier is the hero's highest unlocked one: beating its boss guarantees an Epic. */
  firstClear?: boolean;
  /** L1: a brand-new hero's first delve (the Kiln, tier 1, solo): a fixed teaching route and softer foes. */
  firstDelve?: boolean;
  /** Day number of a daily bounty run: no forks, and the summary is marked so it doesn't count toward tiers or Grit. */
  bounty?: number;
  /** P3: a Delver's Key run at this key level (foes tougher per level; pass keyOmens as `omens`). */
  keyLevel?: number;
  /** Phase 18 Halls: play the dungeon as a map of rooms and sleeping packs (every dungeon in HALLS_ON; sim/halls.ts). The client always sets it; tools and tests may leave it off for the arena. */
  halls?: boolean;
  /** H2c: a Halls run on H1's hand-made map instead of the generated one (tests and tools only). */
  hallsTemplate?: boolean;
  /** The Slagbinder as the cannon gunner (default SLAG_GUNNER; false keeps the old Slag Lob and stances, for measuring). */
  gunner?: boolean;
}

export interface RunSummary {
  victory: boolean;
  tier?: number;
  time: number;
  kills: number;
  level: number;
  damageDealt: number;
  /** Damage dealt to the world boss's shadow, and seconds spent fighting it. */
  shadowDamage?: number;
  shadowTime?: number;
  talents: Partial<Record<TalentId, number>>;
  omens?: OmenId[];
  paths?: GateKind[];
  dungeon?: DungeonId;
  /** Day number when this was a daily bounty. */
  bounty?: number;
  /** Fights cleared before the run ended (a run that clears none earns no chest). */
  fightsCleared?: number;
  /** Phase 18: a Halls run (the dungeon as a map, ?halls=1). */
  halls?: boolean;
  /** P3: the key level, for a Delver's Key run. */
  keyLevel?: number;
  /** P1 weekly quests: the week, this hero's interrupts, and named elites the party felled. */
  week?: number;
  /** P2: the day the run was played (first win of the day). */
  day?: number;
  interrupts?: number;
  namedKills?: number;
  /** The hero's first delve (the tutorial Kiln): it sets no best time. */
  firstDelve?: boolean;
  /** The opening: blows that would have felled the hero, held at 1 health instead (opening.md rule 1). */
  floorSaves?: number;
  /** Real heroes in the party (bots left out), for a party run only. */
  realHeroes?: number;
}

function pool<T>(n: number, make: () => T): T[] {
  return Array.from({ length: n }, make);
}

const HASH_SIZE = 4096; // power of two
const CELL = 64;

export class World {
  readonly rng: Rng;
  readonly stress: boolean;
  readonly invulnerable: boolean;
  loadout: Loadout;
  readonly tier: number;
  cls: ClassId;
  classDef: ClassDef;
  readonly worldBoss: string;
  /** P3: key level of a Delver's Key run (0 for a normal delve). */
  readonly keyLevel: number;
  private keyHp = 1;
  private keyDmg = 1;
  /** The week (weekOf in omens.ts) this run was played in, for weekly quests. */
  readonly week: number | undefined;
  /** The day (dayOf in bounty.ts) this run was played in, for the season track's first win of the day. */
  readonly day: number | undefined;
  shadowDamage = 0;
  shadowStart = -1;
  /** C3: when the raid boss appeared (-1 until then). Her fight is the "shadow" part of the strike. */
  raidStart = -1;
  shadowDone = false;
  passives: Partial<Record<PointId, number>>;
  /** Gear currently worn (upgrades picked up mid-run replace pieces). */
  gear: Item[];
  /** Items picked up this run and the ids auto-equipped as upgrades. */
  runDrops: Item[] = [];
  runEquipped: string[] = [];
  nextItemId: number;
  readonly itemLevel: number;
  readonly luck: number;
  /** Tier modifiers active in every fight of this run. */
  readonly omens: OmenId[];
  /** The world boss's Omen when it added one the tier didn't already have. */
  readonly bossOmen: OmenId | undefined;
  readonly dungeonId: DungeonId;
  /** Relics (1.0 CP2): whether this run offers one after the door guard (not the first delve, the bounty or a stress run). */
  readonly relicsOn: boolean;
  /** Loose Lid: the boss fight's health cut is in (it lands once, whoever carries it). */
  private lidDone = false;
  /** The run's seed, for side streams that mustn't disturb the main rolls. */
  readonly seed: number;
  readonly bounty: number | undefined;
  readonly firstClear: boolean;
  /** Fill with bots: how many party heroes are bots (0 for a real party). */
  readonly fillBots: number;
  /** Fill with bots: its own dice for thinning the loot, so the fight itself plays out the same. */
  private fillRng: Rng | null = null;
  /** L1: this is the hero's first delve (FIRST_DELVE). */
  readonly firstDelve: boolean;
  /** The opening: blows that would have felled the hero (held at 1 health instead). */
  floorSaves = 0;
  /** BOSSV2: the three-stage Kiln Mother and the new Gorge, on every run but the first delve (which keeps the old fight). */
  readonly bossV2: boolean;
  /** Every Slagbinder in this run is the cannon gunner (no Anvil stance). */
  readonly gunner: boolean;
  /** ONDRELV2: 0 = not a v2 fight, else his stage (1 the hammer, 2 the burning slag, 3 the last heat). */
  ondrelStage = 0;
  /** OSKELV2: 0 = not a v2 fight, else his stage (1 the press, 2 the belt, 3 full speed). */
  osStage = 0;
  /** OSKELV2 stage 2-3: the way the press bed carries everyone (radians), and the s left until it flips (-1: no flip due). */
  osDir = 0;
  osFlipT = -1;
  /** OSKELV2: crush-line hits on heroes this run (for tools/group.ts). */
  osCrushHits = 0;
  /** YSMERETV2: 0 off, 1 the vents, 2 twofold (two flames). */
  ysStage = 0;
  /** YSMERETV2 stage 2: the two flames (enemy indices), where each landed (it stays there), and how long each has had no hero near it. */
  ysF0 = -1;
  ysF1 = -1;
  ysAx0 = 0;
  ysAy0 = 0;
  ysAx1 = 0;
  ysAy1 = 0;
  ysAway0 = 0;
  ysAway1 = 0;
  ysBel0 = 0;
  /** YSMERETV2 stage 2: the flames' one shared health (both show it). */
  ysPool = 0;
  /**
   * ONDRELV2 stage 2: the burning slag each Anvilfall leaves (design, 25 Nov: flat patches, no block). A patch burns a
   * hero standing in it until stage 3; then `glow` counts down to its burst (0 = still burning).
   */
  slagPatches: { x: number; y: number; tick: number; glow: number }[] = [];
  /** Parry: while a telegraph lands, its owner (a red tell, so a raised shield can parry it); -1 otherwise. Not state. */
  private tellFrom = -1;
  /** 1.0 CP2 light motes (LIGHT_MOTE) lying on the floor: where, seconds left, and the Lumen that dropped it. */
  lightMotes: { x: number; y: number; t: number; by: number }[] = [];
  /** Someone in the party has an interrupt (Bulwark, Duskblade, Emberwright) with F unlocked. Set at the start. */
  partyKick = false;
  /** Someone in the party has F unlocked (an interrupt or a stun). Set at the start. */
  partyF = false;
  /** BOSSV2 Kiln Mother: 0 = not a v2 fight, else her stage (1 the duel, 2 in the kiln, 3 the last fire). */
  kmStage = 0;
  /** The opening's short Kiln Mother (opening.md, FIRST_DELVE.boss): her stage, 1 or 2, or 0 when she isn't that fight. */
  kmOpen = 0;
  /** The opening's short Kiln Mother: s until her next Swipe and her next blue cast. Host only. */
  private kmOpenClock = { swipe: 0, cast: 0 };
  /** BOSSV2: she's inside the kiln (stage 2; she can't be hit all through stage 2, the walk in too). */
  kmInKiln = false;
  /** CP3 remake: which taunts she has said this fight, and the ones waiting to be said (at World.time). */
  private kmSaid = new Set<KilnSay>();
  private kmSayQ: { say: KilnSay; at: number }[] = [];
  /** BOSSV2 stage 1: ember eggs (hatch at t >= dur unless a hero touches one). */
  kmEggs: { x: number; y: number; t: number; dur: number; alive: boolean }[] = Array.from({ length: 4 }, () => ({ x: 0, y: 0, t: 0, dur: 0, alive: false }));
  /** BOSSV2 stage 2: the heated quarters. Quarter q is the angle q*90 deg +-45 round the arena's centre (0 = east, y down). */
  kmHeat = { safe: 0, warn: 0, on: false };
  /** BOSSV2 stage 3: eruption rings rolling out from her, each with two gaps [centre, width, centre, width] (radians). */
  kmRings: { x: number; y: number; r: number; w: number; gaps: number[]; alive: boolean; hit: number }[] = Array.from({ length: 3 }, () => ({ x: 0, y: 0, r: 0, w: 0, gaps: [0, 0, 0, 0], alive: false, hit: 0 }));
  private kmClock = { swipe: 0, egg: 0, kiln: 0, heat: 0, tick: 0, rings: 0, ringNext: 0, vuln: 0, bellows: 0 };
  /** BOSSV2, for the bot: seconds until the kiln stage's safe quarter next steps, and the warning it then gets. */
  get kmStepIn(): { next: number; warn: number } { return { next: this.kmClock.heat, warn: this.kmShow(KILN_V2.heatWarn) }; }
  readonly partySize: number;
  readonly grit: number;
  /** Current arena radius (Maelra's Rising Water shrinks it). */
  arenaR = ARENA;
  /** V2 (variety): this fight's arena layout, and its pieces (empty when the layout doesn't use them). */
  layout: LayoutId = 'open';
  /** V3: the Kiln Mother's signature from phase 2 this run ('' until she rises). */
  /**
   * Phase 16 U1: this run's echo, a second version of the same boss (never the rolled one) whose move she also uses in her
   * last phase, every other time her signature comes round. '' when none (below ECHO.minTier, the first delve, stress runs).
   */
  bossEcho: string = '';
  /** Phase 16 U3: the U2 new foes this run has met (spawned), as bits of NEW_FOE_BIT. */
  foesMet = 0;
  /** Phase 16 U3: true once this run's echo has actually gone off (its first 'echo' event), for the Seen log and run summary. */
  echoMet = false;
  /** Phase 16 U1: true when the next signature in the last phase is the echo's. */
  echoNext = false;
  /** Phase 16 U1: a boss whose versions are lasting effects (Maelra) runs her echo in windows; true while one is on. */
  echoLive = false;
  /** Phase 16 U1: the way Ysmeret's current vents run (her version, or her echo's). */
  ventMove: string = '';
  echoT = 0;
  bossVariant: KilnVariant | MaelraVariant | LensVariant | NhevraVariant | HessaVariant | OndrelVariant | YsmeretVariant | OskelVariant | SlagVariant | VorhulmVariant | ColossusVariant | RegentVariant | '' = '';
  /** Phase 12 W3: Grandmother Slag's cooling islands in the Brimming (her phase 2, `brim` version); `t` is seconds until it sinks. */
  islands: { x: number; y: number; t: number }[] = [];
  private islandN = 0;
  /** Phase 15 Y3 the Overflow: 0 still, 1 warning, 2 risen; time left on this stage (or until the next warning, when still). */
  flowStage = 0;
  flowT = 0;
  private flowTickT = 0;
  /** Phase 12 W3: how many Banked Coals Old Vorhulm has laid (turns where they land). */
  private bankN = 0;
  /** Phase 12 W2: how many Die Cuts Oskel has made this fight (turns the side). */
  cutCount = 0;
  /** V8 Emberdrift: embers on the floor that refill a coal. */
  driftEmbers: { x: number; y: number }[] = [];
  /** Y3 Creeping Rime: whether it's up, and where. */
  /** Y3 the Whirl: which way Hessa's water turns this Ebb (1 or -1). */
  whirlDir = 1;
  rimeOn = false;
  rimeX = 0;
  rimeY = 0;
  private driftT = 0;
  private driftN = 0;
  /** V8 Sluicetide: the way the water flows (radians), while it runs. */
  tideAngle = 0;
  private sluiceT = 0;
  private tideTurns = 0;
  /** Y3 Sealed Vents: the one open vent (-1 before it starts), the vent the steam moves to next (-1 until warned), and its clock. */
  openVent = -1;
  nextVent = -1;
  private sealT = 0;
  private sealMoves = 0;
  /** V4: the Day's Heat on this run, or '' for none. */
  heat: HeatId | '' = '';
  /** Standing stones: they block heroes and foes alike. */
  stones: { x: number; y: number; r: number }[] = [];
  /** Lava channels: a strip from (x1, y1) to (x2, y2), `w` wide, that burns a hero standing in it. */
  /**
   * V2 lava channels. Phase 18 Halls: a map room's strip carries `room` and `heat` (0 cooled crust .. 1 hot): it heats
   * over HALLS.lockDelay s (as its grates drop) while that room's pack is awake and burns only at 1 (undefined heat, an arena run: always hot).
   */
  lava: { x1: number; y1: number; x2: number; y2: number; w: number; room?: number; heat?: number }[] = [];
  /** Kiln vents: they flare one at a time, in turn. */
  flareVents: { x: number; y: number }[] = [];
  private flareT = 0;
  private flareK = 0;
  /** Phase 14 X3: this fight's arena event ('' for none), its clock, and its stage (0 waiting, 1 warned, 2 landed). */
  arenaEvent: ArenaEventId | '' = '';
  /** Phase 15 Y1: how this fight's wave came in. */
  waveShape: WaveShape = 'arc';
  /** Phase 15 Y1: how many foes a `reinforce` wave still holds back, the seconds until they come, and the angle they come from. */
  reinforceN = 0;
  reinforceT = 0;
  reinforceA = 0;
  /** Phase 15 Y10: the dungeon's hidden count of clean clears, the reactions so far, whether the next trash fight stirs, and this fight's reaction. */
  stirCount = 0;
  stirs = 0;
  stirNext = false;
  stir: StirId | '' = '';
  /** Phase 15 Y10/Y4: the reactions this run has met, as bits of STIR_BIT. */
  stirsMet = 0;
  /** Phase 15 Y10: this fight's damage taken (each hero's share of their own health, averaged over the party) and whether a hero went down. */
  fightHurt = 0;
  /** Phase 15 Y10: which hero was worst off in the last cleared fight (-1: none hurt), for the tools. */
  fightWorst = -1;
  fightDown = false;
  /** Phase 15 Y1/Y4: the wave shapes this run has met, as bits of WAVE_BIT (a pincer or ring when it starts, reinforcements when they warn). */
  wavesMet = 0;
  arenaEventT = 0;
  arenaEventStage = 0;
  /** Phase 15 Y4 (Seen log): each arena event this delve has warned of, one bit per id in ARENA_EVENT_ORDER. Read-only to the sim. */
  arenaEventsMet = 0;
  /** Phase 15 Y4: the named foe's affix index once it has spawned this delve (-1 before), for the Seen log. */
  namedMet = -1;
  /** Maelra's steam vents (empty in other fights). */
  vents: { x: number; y: number; r: number }[] = [];
  /** Maelra's Temper stacks: each cuts her damage taken. */
  temper = 0;
  /** Glarewell stone pillars around the central lens; each casts a shadow wedge outward. Empty elsewhere. */
  /** Glarewell cover. `fixed`: a Cross room's own stone pillar on a Halls map (H3b), which a Brand can't crack. */
  pillars: { x: number; y: number; r: number; cracked: boolean; fixed?: boolean }[] = [];
  /** Where the Glarewell's light comes from: the centre lens, or (Y3 Carried Light) where the Lensmother last began a Glare. */
  lightX = 0;
  lightY = 0;
  /** Seconds until the Brand on the hero bursts (0 when there's none). */
  markT = 0;
  /** A second Brand queued by the Lensmother's Twin Brand. */
  private markQueued = 0;
  /** The Twin Lamps' beam between them, or null. */
  lampBeam: { x1: number; y1: number; x2: number; y2: number } | null = null;
  private lampTickT = 0;
  private glareT = 0;
  /** Ondrel of the Hammerdeep (the Hammerdeep's group boss). */
  private anvilT = 0;
  private anvilTarget = 0;
  /** Hammerdeep: the hero Anvilfall will land on (read by the client to mark them during the wind-up). */
  /** Ysmeret's Bellow Slam target (the hero it is winding up on), for the client's wind-up. */
  get bellowSlamTarget(): number {
    return this.bellowTarget;
  }

  /** The Pressworks: the hero Oskel's Stamp is winding up on, for the client's wind-up. */
  get stampOn(): number {
    return this.stampTarget;
  }

  get anvilfallTarget(): number {
    return this.anvilTarget;
  }
  /** The raid: the hero Grandmother Slag's Ladle Pour will land on, for the client's wind-up. */
  get ladlePourTarget(): number {
    return this.ladleTarget;
  }
  private choirT = 0;
  private choirN = 0;
  /** Phase 12 W2: Ondrel's Ironload. The marked hero (-1: none), and how long until it lands. */
  loadHero = -1;
  loadT = 0;
  /** Phase 15 Y3 the Homeward Hammer: 0 in his hand, 1 thrown (landing), 2 flying home; where it lies, and the time left on this leg. */
  homeStage = 0;
  homeX = 0;
  homeY = 0;
  homeT = 0;
  /** Set while a dungeon verb that wards must not soak (Glare) lands. */
  private verbHit = false;
  private gripT = 0;
  // The Ashvents (Ysmeret): Twin Vents, Scatter Embers, Bellow Slam.
  private ventT = 0;
  private scatterT = 0;
  private bellowT = 0;
  private bellowTarget = 0;
  // The Pressworks (Oskel): Downstroke, Rivets, Stamp.
  private downT = 0;
  /** Raid 2 (the Hoard): Old Vorhulm's clocks, the swallowed hero, the Craw and the spilled embers. */
  private gorgeT = 0;
  private sweepT = 0;
  private wheelT = 0;
  private meltT = 0;
  private meltPulses = 0;
  /** Raid 3: the Cinder Colossus's facing (radians), and each hero's recent damage to him (Wheel). */
  colFacing = 0;
  /** Phase 12 W3 (Plate Shift): how far his plate's middle is turned from his facing, radians. 0 in the Wheel version. */
  colPlate = 0;
  /** Phase 15 Y3 Millstone: seconds left of his grind (0 when not grinding), its turn (+1 or -1), and the next heat tick. */
  millT = 0;
  millDir = 1;
  millTickT = 0;
  /** Phase 12 W3 (the Regent's Summons): seconds until the Summons lands, 0 when none is called. */
  summonsT = 0;
  /**
   * Seconds until the Regent next calls a Summons (it comes with each Ash Fall in phase 2 of his
   * court version), or Infinity when none is coming. Bots read it to walk in before the call.
   */
  summonsDue(): number {
    if (this.regentNextMove() !== 'court' || this.bossPhase !== 2 || this.summonsT > 0 || this.bossIndex < 0 || !this.enemies[this.bossIndex]?.alive) return Infinity;
    return this.ashT;
  }
  /**
   * Phase 16 U1: the Furnace Regent's next Ash-timer move: his own version, or his echo when the next turn is the
   * echo's (sound's check: with a Tithe echo in a court run, bots walked to the throne for a Summons that never came).
   */
  regentNextMove(): string {
    const e = this.bossIndex >= 0 ? this.enemies[this.bossIndex] : undefined;
    if (this.bossEcho && this.echoNext && e && e.hp <= e.maxHp * RAID_ECHO.regent) return this.bossEcho;
    return this.bossVariant;
  }
  /** True while a burn or bleed tick lands (see `burnBy`). */
  private burnTick = false;
  colDmg: number[] = [];
  /** Raid 4 (the Flue): the live Decrees: who holds each, seconds left, passes made, and seconds since it last moved. */
  regentDecree: { hero: number; t: number; passes: number; held: number }[] = [];
  private decreeT = 0;
  private ashT = 0;
  private officeT = 0;
  private officePulses = 0;
  private swallowT = 0;
  private spillT = 0;
  /** Phase 15 Y3 Inhale: 0 still, 1 warning, 2 breathing in; time left on this stage. */
  inhaleStage = 0;
  inhaleT = 0;
  private inhaleTickT = 0;
  private swallowed = -1;
  private crawIndex = -1;
  /** The Hoard's Craw while it is up (for the bot), or -1. */
  get craw(): number {
    return this.crawIndex >= 0 && this.enemies[this.crawIndex]?.alive && this.enemies[this.crawIndex].kind === 'craw' ? this.crawIndex : -1;
  }
  /** The Craw if it is up and within `range` of the acting hero: ranged attacks hit it before the boss, as blades do. */
  private crawIn(range: number): number {
    const c = this.craw;
    if (c < 0) return -1;
    const e = this.enemies[c];
    return dist2(this.player.x, this.player.y, e.x, e.y) < (range + e.def.radius) ** 2 ? c : -1;
  }
  /** Embers he has eaten: each heals him and makes him hit harder for the rest of the fight. */
  coalFed = 0;
  /** Spilled embers on the floor, with seconds left before he inhales them. */
  coalEmbers: { x: number; y: number; t: number }[] = [];
  private rivetT = 0;
  private stampT = 0;
  private stampTarget = 0;
  // The raid (Grandmother Slag).
  private ladleT = 0;
  private ladleTarget = 0;
  private addsT = 0;
  private pourT = 0;
  private heatT = 0;
  /** Phase 14 X1 High Sun: how far a pillar's shadow reaches this run. */
  get shadowLen(): number { return GLARE.shadowLength * (this.heat === 'highSun' ? HEAT_TUNING.sunShadow : 1); }
  /** Phase 14 X1 Bright Coal: a full coal's light radius this run. */
  get coalMaxR(): number { return COLD.maxR * (this.heat === 'brightCoal' ? HEAT_TUNING.coalRadius : 1); }
  /** Phase 14 X1 Thick Steam: seconds between Temper stacks this run. */
  get temperEvery(): number { return FOUNDRY.temperEvery * (this.heat === 'thickSteam' ? HEAT_TUNING.steamTemper : 1); }
  private raidVentT = 0;
  private marksT = 0;
  private raidBurnT = 0;
  private lastEmberCast = false;
  private slagTickT = 0;
  private bossBrandT = 0;
  private crackT = 0;
  private crackPending: { index: number; t: number } | null = null;
  private temperT = 0;
  private undertowT = 0;
  private twinVentT = 0;
  /** Phase 15 Y3 Rolling Vents: vents still to open in this roll, the last one's angle round her, and the way round (1 or -1). */
  rollLeft = 0;
  rollAng = 0;
  rollDir = -1;
  /** C2: the fight (encounter index) that hides this delve's named elite; -2 until rolled, -1 for none. */
  private namedAt = -2;
  /** Named elites felled this run (the whole party's). */
  namedKills = 0;
  /** 1.0 CP2 mastery card: gold circles that landed this run, and the ones somebody stood in. */
  soaks = 0;
  soaksMade = 0;
  private namedTitle = 0;
  private namedAffix = 0;
  // The Coldmarrow (Nhevra): Snuff, Snuffer Tide, Long Night.
  private snuffT = 0;
  /** Coldmarrow phase 2 (Thin Ice): 1 until Nhevra drops to COLD.phase2, then 2; and the clock to the next cracks. */
  coldPhase = 1;
  private iceT = 0;
  private tideT = 0;
  private nightT = 0;
  private waterT = 0;
  private volatileT = 0;
  rareSpawned = false;
  rareIndex = -1;
  riftsOpened = 0;
  bossPhase = 1;
  private brandT = 4;
  private nextVeinAt = 20;
  /** The dungeon: the route of fights, which one is next, and where we are in it. */
  route: EncounterId[] = [];
  encounter = 0;
  /** 'cleared' is the Halls map between fights: walking the rooms, nothing awake (drafts open then, as after a clear). */
  phase: 'intro' | 'fight' | 'cleared' | 'choose' = 'intro';
  /** Phase 18 Halls H1: this run's map (sim/halls.ts), or null for an arena run. Not synced (H1 is local play only). */
  halls: HallsMap | null = null;
  /** Halls: main-path packs cleared so far (World.encounter between fights). */
  hallsMain = 0;
  /** Halls: the pack whose foes are spawning right now (-1 otherwise), so spawn() tags them. */
  private hallsWaking = -1;
  /** KILNTRASH: set while a trash pack's clear pays out, so it drops no bag. */
  private trashClear = false;
  /** Halls "Catch breath": seconds with no pack awake and no foe alive (resting starts at HALLS.rest.delay). */
  hallsQuietT = 0;
  /** Gates on offer while `phase` is 'choose'. */
  gates: Gate[] = [];
  /** Paths taken at each fork, for the summary. */
  paths: GateKind[] = [];
  /** The current fight was a named path: its loot bag is one rarity better. */
  private namedFight = false;
  phaseT = INTRO_TIME;
  eliteKilled = false;
  revived = false;
  state: SimState = 'running';
  time = 0;
  tick = 0;
  kills = 0;
  damageDealt = 0;
  victory = false;
  bossIndex = -1;
  /** G6: pick-ups used in this boss fight (REVIVE_RULES.bossCap). */
  bossRevives = 0;
  eliteSpawned = false;
  bossSpawned = false;
  bossEnraged = false;
  nextSwarmAt = 90;

  player: Player;
  talents: Partial<Record<TalentId, number>> = {};
  choices: DraftOption[] = [];
  /** Every hero in the run. heroes[0] is the main (host) hero; `player` and the other per-hero fields show the acting hero. */
  heroes: HeroSlot[] = [];
  /** Index of the hero whose fields are swapped in. Always 0 between calls. */
  acting = 0;
  /** Co-op: who each enemy is attacking (parallel to `enemies`; unused solo). */
  threat: ThreatTable[] = [];

  enemies: Enemy[];
  orbs: Orb[];
  gems: Gem[];
  zones: Zone[];
  telegraphs: Telegraph[];
  strikes: Strike[];
  /** Which hero cast each strike, by pool index (kept off Strike: the extra field slowed V8 about 3x). */
  private readonly strikeOwner = new Int8Array(CAP.strikes);
  lances: Lance[];
  drops: Drop[];
  veins: Vein[];
  cracks: Crack[];
  /** The Wrackline: the rafts (empty elsewhere), and the undertow's clock and state. */
  rafts: Raft[] = [];
  /**
   * H3d: the Ebb's drain, the middle the rafts drift round: (0, 0) in the arena, the woken quay room's middle on a Halls
   * map. `wrackRoom` is that room (-1 in the arena); the Ebb only takes heroes and foes in it, so corridors stay dry.
   */
  wrackX = 0;
  wrackY = 0;
  wrackRoom = -1;
  /** Seconds until the next undertow warning starts. */
  private tideClockT = 0;
  /** Seconds left of the Ebb's warning (>0 while warning), then of the pull itself. */
  ebbWarnT = 0;
  ebbT = 0;
  /** Hessa: phase 2 (Riptide) from WRACK.phase2, and her clocks. */
  wrackPhase = 1;
  /** Phase 16 U1: this Ebb runs Hessa's echo instead of her own version. */
  ebbEcho = false;
  private sinkT = 0;
  private shoalT = 0;
  events: SimEvent[] = [];
  aliveEnemies = 0;
  /** When the current fight started (Burnout counts from here). */
  private fightStartedAt = 0;
  private stallTickT = 0;
  /** Boil-over: when this boss fight's boss boiled over (its enrage began), or -1. */
  boilStart = -1;

  // Spatial hash over enemies, rebuilt every tick.
  private head = new Int32Array(HASH_SIZE);
  private next = new Int32Array(CAP.enemies);

  constructor(opts: WorldOptions) {
    this.rng = new Rng(opts.seed);
    this.seed = opts.seed;
    this.stress = !!opts.stress;
    this.invulnerable = !!opts.invulnerable || this.stress;
    this.tier = Math.max(1, Math.floor(opts.tier ?? 1));
    this.cls = opts.cls && CLASSES[opts.cls] ? opts.cls : 'emberwright';
    this.classDef = CLASSES[this.cls];
    this.worldBoss = opts.worldBoss ?? '';
    this.week = opts.week;
    this.day = opts.day;
    this.passives = { ...(opts.passives ?? {}) };
    this.gear = [...(opts.gear ?? [])];
    this.loadout = loadoutFrom(this.passives, this.gear);
    this.nextItemId = opts.nextItemId ?? 1;
    this.itemLevel = Math.max(1, (opts.heroLevel ?? 1) + (this.tier - 1));
    this.dungeonId = opts.dungeon ?? 'kiln';
    this.bounty = opts.bounty;
    this.keyLevel = opts.keyLevel ?? 0;
    ({ hp: this.keyHp, dmg: this.keyDmg } = keyScale(this.keyLevel));
    this.firstClear = !!opts.firstClear && opts.bounty === undefined;
    this.fillBots = opts.fillBots ?? 0;
    this.partySize = clampParty(opts.partySize ?? 1 + Math.min(MAX_PARTY - 1, opts.party?.length ?? 0));
    this.firstDelve = !!opts.firstDelve && this.dungeonId === 'kiln' && this.tier === 1 && opts.bounty === undefined && !this.keyLevel && this.partySize === 1;
    // Relics from the second delve on (unlock-curve.md); the bounty is the same run for everyone.
    this.relicsOn = !this.firstDelve && !this.stress && opts.bounty === undefined;
    this.bossV2 = !this.firstDelve;
    this.gunner = opts.gunner ?? SLAG_GUNNER;
    if (this.firstDelve) {
      this.keyHp *= FIRST_DELVE.hp;
      this.keyDmg *= FIRST_DELVE.dmg;
      // The opening (opening.md rule 4): no world-boss bonus fight after the Kiln Mother.
      this.worldBoss = '';
    }
    this.grit = Math.max(0, Math.floor(opts.grit ?? 0));
    this.heat = opts.heat && HEATS[opts.heat] && heatFits(this.dungeonId, opts.heat) && !this.firstDelve && !this.stress
      && opts.bounty === undefined && !opts.keyLevel ? opts.heat : '';
    // The opening (opening.md rule 4): no Omens, not even the world boss's.
    const omens = this.firstDelve ? [] : opts.omens ?? (this.stress ? [] : omensFor(this.tier, opts.week ?? 0));
    const bossOmen = opts.bossOmen && OMENS[opts.bossOmen] && !this.stress && !this.firstDelve ? opts.bossOmen : undefined;
    this.bossOmen = bossOmen && !omens.includes(bossOmen) ? bossOmen : undefined;
    this.omens = this.bossOmen ? [...omens, this.bossOmen] : omens;
    // The boss's Omen always pays its bonus, even when the tier already rolled that Omen.
    // Omen luck only: the tier's own lean towards better loot is in the loot tables (LOOT.tierStep).
    this.luck = (1 + OMEN_TUNING.luckPerOmen * this.omens.length) * (bossOmen ? 1 + OMEN_TUNING.bossOmenLuck : 1)
      * (this.heat === 'richHaul' ? HEAT_TUNING.richHaulLuck : 1); // V4 Rich Haul
    const hp = Math.round((this.classDef.baseHp + this.loadout.maxHpBonus) * gritMult(this.grit));
    this.player = {
      x: 0, y: 0, px: 0, py: 0,
      hp, maxHp: hp,
      level: 1, xp: 0, xpToNext: xpFor(1), pendingLevels: 0,
      volleyT: 0.5, rainT: 4, lanceT: 2.5, orbitAngle: 0, hurtFlash: 0, facing: 0,
      heat: 0, cds: [0, 0, 0, 0], gcd: 0, shieldT: 0, swings: 0, parryT: 0, nextCrit: false, hasteT: 0, blinkCharges: 0, blinkChargeT: 0,
      ward: 0, wardT: 8, bastionT: 0, prevented: 0, echoT: 0, echoAng: 0, guardId: -1, guardAng: 0,
      brilliance: 0, sanctT: 0, sanctX: 0, sanctY: 0, sanctTick: 0, poolT: 0, poolX: 0, poolY: 0, noonT: 4, haloUsed: false, windUsed: false, imageT: 0, imageX: 0, imageY: 0, tossId: -1, tossT: 0, orbsFired: 0, worryId: -1, worryN: 0,
    };
    this.player.alts = altsFor(this.cls, opts);
    if (opts.unlockLevel !== undefined && opts.unlockLevel < UNLOCK_LEVEL_KEPT) this.player.unlockLevel = opts.unlockLevel;
    if (this.cls === 'slagbinder') {
      this.player.stance = this.gunner ? 'bellows' : opts.stance ?? 'bellows';
      if (this.player.stance === 'anvil') { this.player.maxHp += SLAG_KIT.anvilHp; this.player.hp = this.player.maxHp; }
      if (this.gunner) { this.player.maxHp -= SLAG_KIT.gunnerHp; this.player.hp = this.player.maxHp; }
    }
    this.enemies = pool(CAP.enemies, () => ({
      alive: false, kind: 'ashling' as EnemyKind, def: ENEMIES.ashling,
      x: 0, y: 0, px: 0, py: 0, hp: 0, maxHp: 0, touchCd: 0, orbitCd: 0,
      burnDps: 0, burnT: 0, woundT: 0, flash: 0, abilityT: 0, spawnedAt: 0,
      castId: '', castName: '', castT: 0, castDur: 0, interruptible: false, stunT: 0, aux: 0, aux2: 0, ward: 0, warded: false, named: -1, affix: 0, lungeT: 0, lungeW: 0, lungeD: 0, lungeA: 0,
    }));
    this.orbs = pool(CAP.orbs, () => ({ alive: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, life: 0, target: -1, dmg: 0, owner: 0, pierce: 0, lastHit: -1 }));
    this.gems = pool(CAP.gems, () => ({ alive: false, x: 0, y: 0, px: 0, py: 0, value: 0, pulled: false }));
    this.zones = pool(CAP.zones, () => ({ alive: false, x: 0, y: 0, r: 0, dps: 0, life: 0, maxLife: 0, tickT: 0, owner: 0 }));
    this.telegraphs = pool(CAP.telegraphs, () => ({
      alive: false, shape: 'circle' as const, x: 0, y: 0, r: 0, angle: 0, arc: 0, t: 0, dur: 0, dmg: 0, kind: 'hit' as const, owner: -1,
    }));
    this.drops = pool(CAP.drops, () => ({ alive: false, x: 0, y: 0, item: null }));
    this.veins = pool(CAP.veins, () => ({ alive: false, x: 0, y: 0, progress: 0 }));
    this.cracks = pool(CAP.cracks, () => ({ alive: false, x: 0, y: 0, angle: 0, t: 0 }));
    this.route = opts.route ?? (this.firstDelve ? [...FIRST_DELVE.route] : rollRoute((n) => this.rng.int(n), this.dungeonId));
    if (this.bounty !== undefined) {
      // A bounty skips the two openers, so the hero starts with the two levels (and drafts) they would have earned.
      this.player.level += BOUNTY.headStart;
      this.player.pendingLevels += BOUNTY.headStart;
      this.player.xpToNext = xpFor(this.player.level);
    }
    this.strikes = pool(CAP.strikes, () => ({ alive: false, x: 0, y: 0, r: 0, t: 0, dmg: 0 }));
    this.lances = pool(CAP.lances, () => ({ alive: false, x1: 0, y1: 0, x2: 0, y2: 0, life: 0 }));
    this.heroes.push(this.saveSlot('h0', opts.heroName ?? 'Hero'));
    const extra = (opts.party ?? []).slice(0, MAX_PARTY - 1);
    extra.forEach((h, k) => {
      this.heroes.push(this.makeHero(h, k + 1, opts));
    });
    // Foes adapt to the party (Steve, 26 Nov): who can stop a cast is fixed at the start (partyStops).
    this.partyKick = this.heroes.some((h) => h.classDef.kick && slotOpen(3, h.player.unlockLevel));
    this.partyF = this.heroes.some((h) => slotOpen(3, h.player.unlockLevel));
    if (this.heroes.length > 1) this.threat = this.enemies.map(() => newThreat());
    // Phase 18 Halls H1: the map is rolled after the route (its side room takes a fork roll from the run's rng).
    // Steve, 26 Nov: room to room is the standard game everywhere, the first delve included (on its own small map,
    // genTutorial). The daily bounty stays in the open arena, the survivors-style run now and then.
    if (opts.halls && hallsFor(this.dungeonId) && !this.stress && this.bounty === undefined) {
      this.halls = buildHalls(this.seed, this.route, this.dungeonId, (n) => this.rng.int(n), (q) => this.rng.chance(q), !!opts.hallsTemplate, this.tier, this.firstDelve);
      this.hallsLayouts();
      this.phase = 'cleared';
    }
  }

  /**
   * Steve, 26 Nov (Kiln tier 1: "the boss fight took too long spinning in circles around it"): the Kiln Mother's health
   * share at tier 1, solo or not (KILN_T1); the first delve's own (FIRST_DELVE.bossHp) on top of its softer foes.
   */
  private kilnT1BossHp(): number {
    if (this.stress || this.dungeonId !== 'kiln') return 1;
    if (this.firstDelve) return this.tier === 1 ? FIRST_DELVE.bossHp : 1;
    // CP3 remake: the remade fight's share at tiers 1 to 3 (KILN_BOSS_HP), so it lasts 60-90 s at each.
    if (this.bossV2) return KILN_BOSS_HP[this.tier] ?? 1;
    return this.tier === 1 ? KILN_T1.bossHp : 1;
  }

  /** Halls: walking on the map (not yet through the boss door). */
  get hallsOn(): boolean {
    return !!this.halls && !this.halls.done;
  }

  // ---------------------------------------------------------------- heroes

  private saveSlot(id: string, name: string): HeroSlot {
    return {
      id, name, player: this.player, talents: this.talents, choices: this.choices, loadout: this.loadout,
      cls: this.cls, classDef: this.classDef, passives: this.passives, gear: this.gear, revived: this.revived,
      runDrops: this.runDrops, runEquipped: this.runEquipped, damageDealt: this.damageDealt, shadowDamage: this.shadowDamage,
    };
  }

  /** Builds a party member: a fresh level 1 hero beside the main one. */
  private makeHero(h: HeroOptions, index: number, opts: WorldOptions): HeroSlot {
    const cls = h.cls && CLASSES[h.cls] ? h.cls : 'emberwright';
    const classDef = CLASSES[cls];
    const passives = { ...(h.passives ?? {}) };
    const gear = [...(h.gear ?? [])];
    const loadout = loadoutFrom(passives, gear);
    const hp = Math.round((classDef.baseHp + loadout.maxHpBonus) * gritMult(this.grit));
    const a = (index / MAX_PARTY) * Math.PI * 2;
    const player: Player = { ...this.heroes[0].player, cds: [0, 0, 0, 0], hp, maxHp: hp, x: Math.cos(a) * 40, y: Math.sin(a) * 40 };
    player.stance = cls === 'slagbinder' ? (this.gunner ? 'bellows' : h.stance ?? 'bellows') : undefined;
    player.alts = altsFor(cls, h);
    player.unlockLevel = h.unlockLevel !== undefined && h.unlockLevel < UNLOCK_LEVEL_KEPT ? h.unlockLevel : undefined;
    if (player.stance === 'anvil') { player.maxHp += SLAG_KIT.anvilHp; player.hp = player.maxHp; }
    if (cls === 'slagbinder' && this.gunner) { player.maxHp -= SLAG_KIT.gunnerHp; player.hp = player.maxHp; }
    player.px = player.x;
    player.py = player.y;
    if (opts.bounty === undefined) { player.level = 1; player.pendingLevels = 0; player.xpToNext = xpFor(1); }
    return {
      id: 'h' + index, name: h.name ?? 'Hero ' + (index + 1), player, talents: {}, choices: [], loadout, cls, classDef, passives, gear,
      revived: false, runDrops: [], runEquipped: [], damageDealt: 0, shadowDamage: 0,
    };
  }

  /** Swaps hero `i`'s fields in. Every loop over heroes ends with use(0). */
  use(i: number): void {
    if (i === this.acting) return;
    const cur = this.heroes[this.acting];
    cur.player = this.player; cur.talents = this.talents; cur.choices = this.choices; cur.loadout = this.loadout;
    cur.cls = this.cls; cur.classDef = this.classDef; cur.passives = this.passives; cur.gear = this.gear; cur.revived = this.revived;
    cur.runDrops = this.runDrops; cur.runEquipped = this.runEquipped; cur.damageDealt = this.damageDealt; cur.shadowDamage = this.shadowDamage;
    const h = this.heroes[i];
    this.player = h.player; this.talents = h.talents; this.choices = h.choices; this.loadout = h.loadout;
    this.cls = h.cls; this.classDef = h.classDef; this.passives = h.passives; this.gear = h.gear; this.revived = h.revived;
    this.runDrops = h.runDrops; this.runEquipped = h.runEquipped; this.damageDealt = h.damageDealt; this.shadowDamage = h.shadowDamage;
    this.acting = i;
  }

  /** Runs `fn` as each living hero in turn (all heroes with `all`), then swaps the main hero back. */
  private eachHero(fn: (i: number) => void, all = false): void {
    for (let i = 0; i < this.heroes.length; i++) {
      this.use(i);
      if (all || this.player.hp > 0 || this.heroes.length === 1) fn(i);
    }
    this.use(0);
  }

  /** Co-op snapshot: hero `i`'s changing state. */
  heroData(i: number): HeroSlotData {
    const h = i === this.acting ? this : this.heroes[i];
    return {
      player: h.player, talents: h.talents, choices: h.choices, revived: h.revived,
      damageDealt: h.damageDealt, shadowDamage: h.shadowDamage, runDrops: h.runDrops, runEquipped: h.runEquipped,
    };
  }

  /** Co-op guest: overwrite hero `i`'s changing state from a snapshot. */
  setHeroData(i: number, d: HeroSlotData): void {
    const h = (i === this.acting ? this : this.heroes[i]) as { -readonly [K in keyof HeroSlotData]: HeroSlotData[K] };
    if (!h) return;
    h.player = d.player; h.talents = d.talents; h.choices = d.choices; h.revived = d.revived;
    h.damageDealt = d.damageDealt; h.shadowDamage = d.shadowDamage; h.runDrops = d.runDrops; h.runEquipped = d.runEquipped;
  }

  /** A hero's live fields, whichever hero is swapped in. */
  hero(i: number): HeroSlot {
    const saved = this.acting;
    this.use(i);
    const slot = this.saveSlot(this.heroes[i].id, this.heroes[i].name);
    this.use(saved);
    return slot;
  }

  /** Who enemy `i` attacks: by threat in co-op, else the only hero. */
  private targetOf(i: number, dt: number): number {
    if (this.heroes.length === 1) return 0;
    const id = updateTarget(this.threat[i], dt);
    let k = id ? this.heroes.findIndex((h) => h.id === id) : -1;
    if (k >= 0 && this.heroPlayer(k).hp > 0 && !((this.heroPlayer(k).swallowT ?? 0) > 0)) return k;
    // Nobody has threat yet (or the target is down): the nearest living hero.
    const e = this.enemies[i];
    let best = 0;
    let bestD = Infinity;
    for (let j = 0; j < this.heroes.length; j++) {
      const hp = this.heroPlayer(j);
      if (hp.hp <= 0 || (hp.swallowT ?? 0) > 0) continue;
      const d = dist2(hp.x, hp.y, e.x, e.y);
      if (d < bestD) { bestD = d; best = j; }
    }
    k = best;
    return k;
  }

  private heroPlayer(i: number): Player {
    return i === this.acting ? this.player : this.heroes[i].player;
  }

  // ---------------------------------------------------------------- talents

  rank(id: TalentId): number {
    return this.talents[id] ?? 0;
  }

  /** Character tree points the acting hero has in `id` (content/trees.ts; 0 unless its class uses the tree). */
  tree(id: TreeNodeId): number {
    return this.passives[id] ?? 0;
  }

  /** Character tree: the highest points in `id` among the other living heroes within `r` of q. */
  private allyTree(id: TreeNodeId, q: Player, r: number): number {
    let best = 0;
    for (let k = 0; k < this.heroes.length; k++) {
      if (k === this.acting) continue;
      const n = this.heroes[k].passives[id] ?? 0;
      if (n <= best) continue;
      const h = this.heroes[k].player;
      if (h.hp > 0 && dist2(h.x, h.y, q.x, q.y) <= r * r) best = n;
    }
    return best;
  }

  /** Resolve a Bulwark spends to Smother a bloom (Damper lowers it). */
  private smotherCost(k: number): number {
    const n = (k === this.acting ? this.passives : this.heroes[k].passives).damper ?? 0;
    return SMOTHER_COST - TREE.damperCost * n;
  }

  /** Party cards: the highest rank of `id` among the other living heroes within `r` of q. */
  private allyRank(id: TalentId, q: Player, r: number): number {
    let best = 0;
    for (let k = 0; k < this.heroes.length; k++) {
      if (k === this.acting) continue;
      const n = this.heroes[k].talents[id] ?? 0;
      if (n <= best) continue;
      const h = this.heroes[k].player;
      if (h.hp > 0 && dist2(h.x, h.y, q.x, q.y) <= r * r) best = n;
    }
    return best;
  }

  branchRanks(branch: Branch): number {
    let n = 0;
    for (const id of Object.keys(this.talents) as TalentId[]) {
      const def = TALENTS[id];
      if (def.branch === branch && !def.capstone) n += this.talents[id]!;
    }
    return n;
  }

  /** Threat from this hero's damage: the Bulwark and an Anvil Slagbinder tank; a Bellows Slagbinder peels adds. */
  get threatMult(): number {
    if (this.cls === 'bulwark') return THREAT.tankMult;
    if (this.cls === 'slagbinder') return this.gunner ? 1 : this.player.stance === 'anvil' ? THREAT.tankMult : SLAG_KIT.bellowsThreat;
    return 1;
  }

  /** UNLOCK_AID steps for this hero: character levels short of UNLOCK_AID.until, 0 to 3 (0 when no level is set). */
  get aidSteps(): number {
    const lv = this.player.unlockLevel;
    if (lv === undefined) return 0;
    return Math.max(0, Math.min(3, UNLOCK_AID.until - Math.max(1, Math.floor(lv) || 1)));
  }
  get dmgMult(): number {
    // Small growth per level keeps damage in step with the horde's health.
    const p = this.player;
    // Rancor: the Bulwark hits harder the more hurt it is.
    const missing = Math.floor(Math.max(0, 1 - p.hp / p.maxHp) * 10);
    const vengeance = 1 + 0.04 * this.rank('vengeance') * missing;
    const kindled = this.time < (p.kindleUntil ?? -1) ? GROUP_TOOLS.kindleMult : 1;
    const plated = (p.plate ?? 0) > 0 && (p.plateUntil ?? -1) > this.time;
    const clinker = (this.rank('clinkerHeart') > 0 && plated ? DEFENCE_BRANCH.clinkerDmg : 0) + (this.rank('twinPour') > 0 && plated ? DEFENCE_BRANCH.twinDmg : 0);
    const guard = (1 + DEFENCE_BRANCH.skinDmg * this.rank('cinderSkin') + DEFENCE_BRANCH.mendDmg * this.rank('mend') + DEFENCE_BRANCH.groundDmg * this.rank('kindledGround') + DEFENCE_BRANCH.graceDmg * (this.rank('renewal') + this.rank('aegisOfLight'))) * (1 + clinker);
    const party = this.cls !== 'slagbinder' || p.stance === 'anvil' ? 1 : this.heroes.length > 1 ? (this.dungeonId === 'flue' ? SLAG_KIT.fluePartyDmg : SLAG_KIT.partyDmg) : this.gunner ? SLAG_KIT.gunnerSoloDmg : SLAG_KIT.soloDmg;
    const hot = this.cls === 'emberwright' && p.heat >= OVERHEAT.from ? OVERHEAT.mult : 1;
    return hot * party * guard * (1 + UNLOCK_AID.dmg * this.aidSteps) * (1 + 0.1 * this.rank('stoke')) * (1 + 0.03 * (p.level - 1)) * this.loadout.dmgMult * vengeance * gritMult(this.grit) * kindled;
  }
  get volleyCooldown(): number {
    return (0.9 * Math.pow(0.86, this.rank('quickcast'))) / this.loadout.hasteMult / (1 + TREE.briskHaste * this.tree('brisk'));
  }
  get orbCount(): number {
    return 1 + this.rank('extraOrb');
  }
  get critChance(): number {
    return 0.05 + 0.12 * (this.rank('searingFocus') + this.rank('precision')) + 0.08 * this.rank('brightWick') + TREE.whetCrit * this.tree('whet') + TREE.sparkCrit * this.tree('spark') + TREE.dazzleCrit * this.tree('dazzle') + this.loadout.critBonus;
  }
  get pickupRadius(): number {
    return 80 * (1 + 0.4 * (this.rank('magnetism') + this.rank('nimble'))) * this.loadout.pickupMult;
  }
  get moveSpeed(): number {
    const boost = (this.player.hasteT > 0 ? 1.3 : 1) * (1 + 0.05 * this.rank('momentum'));
    const chill = this.player.chill ? 1 - COLD.chillSlow * this.player.chill : 1;
    // Halls H2a: everything moves HALLS.moveScale faster on a Halls run (its boss fight too). One number, no travel run
    // (design, 25 Nov: Steve's "keep it simple").
    const halls = this.moveScale;
    // Hold verbs: the raised shield (Parry) and a charging cannon slow the hero.
    const held = (this.player.holdSlot ?? -1) < 0 ? 1 : this.cls === 'bulwark' ? PARRY.slow : this.cls === 'slagbinder' ? CHARGE.slow : 1;
    return held * this.classDef.speed * (1 + 0.06 * this.rank('magnetism') + 0.07 * this.rank('nimble')) * this.loadout.speedMult * boost * chill * halls;
  }
  /** Halls H2a (Steve, 25 Nov: "monster and player movements are very slow"): the move speed scale, 1 off a Halls run. */
  /** Share of max health a Sluice Crawler's Bloom heals a foe caught in its burst (less on a Halls run). */
  get bloomHeal(): number {
    return this.halls ? FOUNDRY.hallsBloomHeal : FOUNDRY.bloomHeal;
  }
  get moveScale(): number {
    return this.halls ? HALLS.moveScale : 1;
  }
  get regen(): number {
    const low = this.player.hp < this.player.maxHp * 0.5 ? 4 * this.rank('slowPulse') + 3 * this.rank('bankedFire') + 3 * this.rank('quietMend') : 0;
    // Close Warmth (party card): an Emberwright that took it warms the heroes around it.
    const warm = this.heroes.length > 1 ? PARTY_CARDS.warmRegen * this.allyRank('closeWarmth', this.player, PARTY_CARDS.warmRadius) : 0;
    return 0.8 * this.rank('mend') + 1 * this.rank('secondWind') + 1 * this.rank('renewal') + low + warm;
  }
  get abilities(): AbilityDef[] {
    if (!this.player.alts) return this.classDef.abilities;
    return this.classDef.abilities.map((d, k) => this.altAt(k)?.def ?? d);
  }

  /** The ability option this hero swapped into `slot`, if any. */
  altAt(slot: number): AltOption | undefined {
    const ids = this.player.alts;
    if (!ids) return undefined;
    for (const id of ids) if (ALT_BY_ID[id].slot === slot) return ALT_BY_ID[id];
    return undefined;
  }

  /** Whether this hero swapped in the option `id`. */
  hasAlt(id: AltId): boolean {
    return !!this.player.alts?.includes(id);
  }

  /** Whether `slot` holds this hero's ability option instead of the class's own ability. */
  isAlt(slot: number): boolean {
    return this.altAt(slot) !== undefined;
  }

  /** Resource cost of an action-bar slot after talents. */
  abilityCost(slot: number): number {
    const alt = this.altAt(slot);
    if (alt) return alt.def.cost;
    if (this.cls === 'emberwright' && slot === 0) return Math.max(0, ABILITIES[0].cost - 6 * this.rank('rollingInferno') - TREE.tinderCost * this.tree('tinder'));
    if (this.cls === 'duskblade' && slot === 0 && this.rank('flurryStep') >= 2) return this.abilities[0].cost - 10;
    return this.abilities[slot]?.cost ?? 0;
  }

  abilityCooldown(slot: number): number {
    return this.baseCooldown(slot);
  }

  private baseCooldown(slot: number): number {
    const base = this.abilities[slot]?.cooldown ?? 0;
    // Ram (Bulwark tree) speeds Gather like the Charge it replaces.
    if (this.isAlt(slot)) {
      const id = this.altAt(slot)?.id;
      if (id === 'gather') return base - TREE.ramCd * this.tree('ram');
      // Chime (Lumen tree) speeds Canopy like the Sanctuary it replaces.
      if (id === 'canopy') return base - TREE.chimeCd * this.tree('chime');
      // Fan and Primer (Emberwright tree) speed Ember Dart and White Heat like Flame Wave and Combustion.
      if (id === 'emberDart') return base - TREE.fanCd * this.tree('fan');
      if (id === 'whiteHeat') return base - TREE.primerCd * this.tree('primer');
      // Quickset and Ladle speed Slag Spray like the Molten Plating it replaces.
      if (id === 'slagSpray') return base - this.rank('quickset') - TREE.ladleCd * this.tree('ladle');
      return base;
    }
    if (this.cls === 'slagbinder') {
      if (slot === 0) return base - this.rank('quickset') - TREE.ladleCd * this.tree('ladle');
      // Recoil never drops below 1s.
      if (slot === 1) return Math.max(1, base - TREE.springCd * this.tree('spring'));
      if (slot === 2) return base + (this.hasMythic('clinkerCrown') ? 4 : 0);
      return base;
    }
    if (this.cls === 'bulwark') {
      if (slot === 1) return base - 2 * this.rank('momentum') - TREE.ramCd * this.tree('ram');
      if (slot === 2) return base - TREE.bedrockCd * this.tree('bedrock');
      return base;
    }
    if (this.cls === 'duskblade') {
      if (slot === 0) return base - 1 * this.rank('deepCuts') - TREE.openerCd * this.tree('opener');
      // Sidestep never drops below 1s, so its small heal can't be spammed when Evasion, Mirrorstep and Footwork stack.
      if (slot === 1) return Math.max(1, base - 1.5 * this.rank('evasion') - (this.hasMythic('mirrorstep') ? 2 : 0) - TREE.footworkCd * this.tree('footwork'));
      if (slot === 2) return base - 3 * this.rank('momentumFlow') - TREE.cadenceCd * this.tree('cadence');
      return base;
    }
    if (this.cls === 'lumen') {
      if (slot === 0) return base - 0.5 * this.rank('daybreakPulse');
      // Glimmer Step never drops below 1s (Flicker and Drift stack).
      if (slot === 1) return Math.max(1, base - 1.5 * this.rank('flicker') - TREE.driftCd * this.tree('drift'));
      if (slot === 2) return base - 3 * this.rank('heatSink') - 3 * this.rank('fastFuse') - TREE.chimeCd * this.tree('chime');
      return base;
    }
    if (this.cls === 'emberwright') {
      if (slot === 0) return base - TREE.fanCd * this.tree('fan');
      if (slot === 1) return Math.max(1, (base - 1.5 * this.rank('flicker') - TREE.skipCd * this.tree('skip')) * (this.hasMythic('wanderersWake') ? 0.5 : 1));
      if (slot === 2) return base - 3 * this.rank('heatSink') - 3 * this.rank('fastFuse') - TREE.primerCd * this.tree('primer');
      return base;
    }
    if (slot === 1) return base - 1.5 * this.rank('flicker');
    if (slot === 2) return base - 3 * this.rank('heatSink') - 3 * this.rank('fastFuse');
    return base;
  }

  /** Whether this hero's character level has unlocked the slot yet (SLOT_UNLOCK). */
  unlocked(slot: number): boolean {
    return slotOpen(slot, this.player.unlockLevel);
  }

  /** Whether the slot can be used right now (ignores whether a target exists). */
  canCast(slot: number): boolean {
    const p = this.player;
    const def = this.abilities[slot];
    if (!def || !this.unlocked(slot)) return false;
    if (p.cds[slot] > 0 && !(slot === 1 && p.blinkCharges > 0)) return false;
    if (!def.offGcd && p.gcd > 0) return false;
    return p.heat >= this.abilityCost(slot);
  }

  // ---------------------------------------------------------------- main step

  step(input: Input | Input[]): void {
    const inputs = Array.isArray(input) ? input : [input];
    const idle: Input = { x: 0, y: 0 };
    this.events.length = 0;
    if (this.state !== 'running') return;
    const dt = TICK;
    this.tick++;
    this.time += dt;

    if (this.stress) this.director();
    else this.dungeon(dt);
    if (this.heroes.length === 1) {
      // Solo fast path: the same calls in the same order, without the hero loops.
      const inp = inputs[0] ?? idle;
      this.updatePlayer(inp, dt);
      this.rebuildHash();
      this.updateAbilities(inp, dt);
      this.updateWeapons(dt);
      this.updateOrbs(dt, 0);
      this.updateEnemies(dt);
      this.updateZones(dt, 0);
      this.updateStrikes(dt, 0);
      this.updateLances(dt);
      this.updateTelegraphs(dt);
      if (this.kmStage) this.kmTick(dt);
      else if (this.kmOpen) this.kmOpenTalk();
      this.updateDrops();
      this.updateVeins(dt);
      this.updateGems(dt);
      if (this.lightMotes.length) this.updateLightMotes(dt);
      if (this.hallsOn && this.ebbT > 0) this.raftsClear();
      this.noteEcho();
      this.checkEnd();
      return;
    }
    this.eachHero((h) => this.updatePlayer((this.player.swallowT ?? 0) > 0 ? idle : inputs[h] ?? idle, dt));
    this.rebuildHash();
    this.eachHero((h) => {
      // Swallowed (raid 2): held inside the boss, the hero neither moves nor fights.
      if ((this.player.swallowT ?? 0) > 0) return this.holdSwallowed();
      this.updateAbilities(inputs[h] ?? idle, dt);
      this.updateWeapons(dt);
    });
    this.eachHero((h) => this.updateOrbs(dt, h), true);
    this.updateEnemies(dt);
    this.eachHero((h) => this.updateZones(dt, h), true);
    this.eachHero((h) => this.updateStrikes(dt, h), true);
    this.updateLances(dt);
    // Shared things tick once per step and then resolve for each hero (not once per hero).
    this.updatePartyTelegraphs(dt);
    if (this.kmStage) this.kmTick(dt);
    else if (this.kmOpen) this.kmOpenTalk();
    this.eachHero(() => this.updateDrops());
    this.updatePartyVeins(dt);
    this.updatePartyGems(dt);
    if (this.lightMotes.length) this.updateLightMotes(dt);
    this.updateRevives(dt);
    if (this.hallsOn && this.ebbT > 0) this.raftsClear();
    this.noteEcho();
    this.checkEnd();
  }

  /** Light motes (LIGHT_MOTE): age them, and a hurt hero who walks over one takes it. */
  private updateLightMotes(dt: number): void {
    const back = this.acting;
    const r2 = (LIGHT_MOTE.reach + PLAYER_RADIUS) ** 2;
    this.lightMotes = this.lightMotes.filter((m) => {
      m.t -= dt;
      if (m.t <= 0) return false;
      for (let h = 0; h < this.heroes.length; h++) {
        const q = this.heroPlayer(h);
        if (q.hp <= 0 || q.hp >= q.maxHp || dist2(q.x, q.y, m.x, m.y) > r2) continue;
        this.use(h);
        this.healPlayer(q.maxHp * LIGHT_MOTE.heal);
        this.events.push({ type: 'lightMoteTaken', x: m.x, y: m.y, hero: h });
        this.use(back);
        return false;
      }
      return true;
    });
  }

  /** Phase 16 U3: marks the echo met the first step it goes off. Reads this step's events only; no rng. */
  private noteEcho(): void {
    if (this.echoMet || !this.bossEcho) return;
    for (const e of this.events) if (e.type === 'echo') { this.echoMet = true; return; }
  }

  /** True while a boss is spawned and still standing (G6 boss revive rules apply). */
  get bossUp(): boolean {
    const b = this.bossSpawned && this.bossIndex >= 0 ? this.enemies[this.bossIndex] : undefined;
    return !!b && b.alive && b.hp > 0;
  }

  /** Seconds an ally must stand on a downed hero right now. */
  get reviveSeconds(): number {
    return this.bossUp ? REVIVE_RULES.bossSeconds : REVIVE_RULES.seconds;
  }

  /** Pick-ups the party still has in this boss fight (Infinity outside a boss fight). */
  get revivesLeft(): number {
    return this.bossUp ? Math.max(0, REVIVE_RULES.bossCap - this.bossRevives) : Infinity;
  }

  /** G6: a downed hero gets back up after a living ally stands on them for reviveSeconds. */
  private updateRevives(dt: number): void {
    const need = this.reviveSeconds;
    for (let i = 0; i < this.heroes.length; i++) {
      const d = this.heroPlayer(i);
      if (d.hp > 0) {
        d.reviveT = 0;
        continue;
      }
      let by = -1;
      if (this.revivesLeft > 0) {
        for (let j = 0; j < this.heroes.length && by < 0; j++) {
          const a = this.heroPlayer(j);
          if (j !== i && a.hp > 0 && dist2(a.x, a.y, d.x, d.y) <= REVIVE_RADIUS * REVIVE_RADIUS) by = j;
        }
      }
      if (by < 0) {
        d.reviveT = 0;
        continue;
      }
      d.reviveT = (d.reviveT ?? 0) + dt;
      if (d.reviveT >= need - 1e-9) {
        d.reviveT = 0;
        d.hp = d.maxHp * REVIVE_HEALTH;
        if (this.bossUp) this.bossRevives++;
        this.events.push({ type: 'revive', hero: i, by });
      }
    }
  }

  /** Apply a draft choice while the sim is paused for a level-up. */
  choose(index: number, hero = 0): void {
    if (this.state !== 'draft') return;
    if (this.heroes.length === 1) {
      const opt = this.choices[index];
      if (!opt) return;
      this.takePick(opt);
      this.choices = [];
      if (this.picksWaiting()) this.openDraft();
      else this.state = 'running';
      return;
    }
    this.use(hero);
    const opt = this.choices[index];
    if (opt) {
      this.takePick(opt);
      this.choices = [];
    }
    this.use(0);
    // Deal the next cards to anyone with picks left, including a hero who levelled
    // on the same tick the draft opened. The run resumes once nobody has cards.
    this.openDraftAll();
    if (this.heroes.every((_, i) => this.choicesOf(i).length === 0)) this.state = 'running';
  }

  /** A card taken: a Spark (a level's pick) or, once the levels are picked, the Relic. */
  private takePick(opt: DraftOption): void {
    const p = this.player;
    if (opt.relic) {
      p.relicPick = false;
      p.relic = opt.relic;
      if (opt.relic === 'spareWick') { p.maxHp *= RELIC.wickMaxHp; p.hp = Math.min(p.hp, p.maxHp); }
      this.events.push({ type: 'relic', id: opt.relic, hero: this.acting, x: p.x, y: p.y, picked: true });
      return;
    }
    this.applyTalent(opt.id);
    p.pendingLevels--;
  }

  /** Whether the acting hero has a pick waiting: a level's Spark, or the Relic after the door guard. */
  private picksWaiting(): boolean {
    return this.player.pendingLevels > 0 || !!this.player.relicPick;
  }

  /** The acting hero's next cards: Sparks while levels wait, then the Relic pick. */
  private nextCards(): DraftOption[] {
    if (this.player.pendingLevels > 0) return this.rollDraft();
    return this.player.relicPick ? this.relicCards() : [];
  }

  /**
   * RELIC_OFFER Relics the acting hero hasn't got, from those that fit this dungeon (Spare Wick only in a solo
   * dungeon; Loose Lid only where the boss has a Boil-over clock), drawn on the run's rng.
   */
  relicCards(): DraftOption[] {
    const pool = RELIC_IDS.filter((id) => (!RELICS[id].soloOnly || this.dungeonDef.style === 'solo') && (!RELICS[id].needsBoil || this.boilAfter(this.dungeonDef.boss as EnemyKind) !== undefined));
    const out: DraftOption[] = [];
    while (out.length < RELIC_OFFER && pool.length) out.push({ id: 'relic' as TalentId, nextRank: 1, relic: pool.splice(this.rng.int(pool.length), 1)[0] });
    return out;
  }

  /** Co-op: the draft cards hero `i` is choosing from (empty when they're done). */
  choicesOf(i: number): DraftOption[] {
    return i === this.acting ? this.choices : this.heroes[i].choices;
  }

  summary(): RunSummary {
    return {
      victory: this.victory,
      tier: this.tier,
      omens: [...this.omens],
      paths: [...this.paths],
      dungeon: this.dungeonId,
      bounty: this.bounty,
      fightsCleared: this.encounter,
      ...(this.halls ? { halls: true } : {}),
      time: this.time,
      kills: this.kills,
      level: this.player.level,
      damageDealt: Math.round(this.damageDealt),
      shadowDamage: Math.round(this.shadowDamage),
      shadowTime: this.shadowStart >= 0 ? Math.round(Math.min(SHADOW_TIME, this.time - this.shadowStart))
        : this.raidStart >= 0 ? Math.round(this.time - this.raidStart) : 0,
      talents: { ...this.talents },
      week: this.week,
      ...(this.day !== undefined ? { day: this.day } : {}),
      ...(this.keyLevel ? { keyLevel: this.keyLevel } : {}),
      interrupts: this.player.interrupts ?? 0,
      namedKills: this.namedKills,
      ...(this.firstDelve ? { firstDelve: true, floorSaves: this.floorSaves } : {}),
      ...(this.heroes.length > 1 ? { realHeroes: this.heroes.length - this.fillBots } : {}),
    };
  }

  /** Cheap state fingerprint for determinism tests and future server checks. */
  hash(): number {
    let h = 2166136261 >>> 0;
    const mix = (v: number) => {
      h ^= Math.round(v * 100) | 0;
      h = Math.imul(h, 16777619) >>> 0;
    };
    mix(this.tick);
    mix(this.player.x);
    mix(this.player.y);
    mix(this.player.hp);
    mix(this.kills);
    mix(this.rng.state);
    for (const e of this.enemies) if (e.alive) { mix(e.x); mix(e.y); mix(e.hp); }
    return h;
  }

  // ---------------------------------------------------------------- spawning

  // ---------------------------------------------------------------- dungeon

  get dungeonDef() {
    return DUNGEONS[this.dungeonId];
  }

  get encounterDef() {
    return ENCOUNTERS[this.route[Math.min(this.encounter, this.route.length - 1)]];
  }

  private dungeon(dt: number): void {
    if (this.hallsOn) {
      this.hallsClock(dt);
      return;
    }
    if (this.phase === 'intro') {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.startEncounter();
      return;
    }
    if (this.phase === 'choose') {
      this.phaseT -= dt;
      const p = this.player;
      const g = this.gates.find((q) => (q.x - p.x) ** 2 + (q.y - p.y) ** 2 <= (q.r + PLAYER_RADIUS) ** 2);
      if (g) this.takeGate(g, false);
      else if (this.phaseT <= 0) this.takeGate(this.gates[0], true);
      return;
    }
    if (this.inShadow) {
      if (this.time - this.shadowStart >= SHADOW_TIME) this.shadowDone = true;
      return;
    }
    if (this.phase === 'fight') this.runOmens(dt);
    if (this.phase === 'fight') this.dungeonClocks(dt);
    if (this.phase === 'fight' && this.layout !== 'open') this.layoutClock(dt);
    if (this.phase === 'fight' && this.arenaEvent) this.arenaEventClock(dt);
    if (this.phase === 'fight' && this.aliveEnemies > 0 && !this.victory) this.fightClock(dt);
    if (this.phase === 'fight' && this.reinforceN > 0 && !this.victory) this.reinforceClock(dt);
    if (this.phase === 'fight' && this.aliveEnemies === 0 && this.reinforceN === 0 && (!this.victory || this.shadowPending)) this.clearEncounter();
  }

  /**
   * Each dungeon's own per-tick fight clock. The arena's step and a Halls fight (hallsClock) both run it, so a
   * dungeon's mechanics can't run in one and not the other (H3b: the Glarewell's Brands never burst on the map
   * while this lived in the arena's step alone). Arena events stay arena-only (design, 25 Nov).
   */
  private dungeonClocks(dt: number): void {
    switch (this.dungeonId) {
      case 'glarewell': if (this.pillars.length || this.hallsOn) this.runGlarewell(dt); break;
      case 'hammerdeep': this.ondrelClock(dt); break;
      case 'ashvents': this.ysmeretClock(dt); break;
      case 'pressworks': this.oskelClock(dt); break;
      case 'coldmarrow': this.coldClock(dt); break;
      case 'wrackline': this.wrackClock(dt); break;
      case 'crucible': this.slagClock(dt); break;
      case 'hoard': this.coalClock(dt); break;
      case 'smeltery': this.colossusClock(dt); break;
      case 'flue': this.regentClock(dt); break;
    }
  }

  /** A won delve with a living world boss goes on to the shadow fight. */
  get shadowPending(): boolean {
    return this.victory && this.route[this.route.length - 1] === 'worldShadow' && !this.shadowDone;
  }
  get inShadow(): boolean {
    return this.shadowStart >= 0 && !this.shadowDone;
  }
  /** Seconds left in the shadow fight. */
  get shadowLeft(): number {
    return this.shadowStart >= 0 ? Math.max(0, SHADOW_TIME - (this.time - this.shadowStart)) : SHADOW_TIME;
  }

  /** C2's draws, made once per delve (the same whenever they are made, so namedPlan can ask early). */
  private planNamed(): void {
    if (this.namedAt === -2) {
      const r = new Rng((this.seed ^ 0x6e616d65) >>> 0);
      const fights = this.route.length - 1; // never the boss fight
      this.namedAt = r.chance(NAMED.chance) ? r.int(fights) : -1;
      this.namedTitle = r.int(NAMED_TITLES.length);
      this.namedAffix = r.int(C2_AFFIXES);
      // Phase 14 X2: an extra draw after the C2 ones, so the route pick and title don't move.
      if (r.chance(NAMED.newAffixChance)) this.namedAffix = C2_AFFIXES + r.int(AFFIXES.length - C2_AFFIXES);
      if (NAMED.forceAffix >= 0) this.namedAffix = NAMED.forceAffix;
      if (NAMED.forceNamed && this.namedAt < 0) this.namedAt = 1;
    }
  }

  /**
   * Phase 14 X4: this delve's named foe as it stands: the route position of its fight (a shrine there moves
   * it one on) and its affix, or null when the delve has none. Never in stress runs.
   */
  namedPlan(): { at: number; affix: Affix } | null {
    if (this.stress || this.route.length < 2) return null;
    this.planNamed();
    return this.namedAt >= 0 ? { at: this.namedAt, affix: AFFIXES[this.namedAffix] } : null;
  }

  /**
   * C2: about half of all delves hide one named elite in a fight before the boss.
   * Rolled on its own stream, so a delve's other rolls don't move.
   */
  private rollNamed(elite: number): void {
    // The first delve is the tutorial: no named elite with an affix in it.
    if (this.stress || this.firstDelve || this.route.length < 2) return;
    this.planNamed();
    if (this.encounter !== this.namedAt) return;
    if (elite < 0) {
      // A fight with no elite in it (a shrine): the next fight before the boss gets it.
      this.namedAt = this.encounter + 1 < this.route.length - 1 ? this.encounter + 1 : -1;
      return;
    }
    const e = this.enemies[elite];
    e.named = this.namedTitle;
    e.affix = this.namedAffix;
    this.namedMet = this.namedAffix;
    e.maxHp *= NAMED.hp;
    e.hp = e.maxHp;
    if (AFFIXES[e.affix] === 'Warded') {
      e.ward = e.maxHp * NAMED.ward;
      e.warded = true;
    }
    this.events.push({ type: 'namedSpawn', index: elite, name: this.namedName(elite), affix: AFFIXES[e.affix] });
  }

  /** "Ashjaw, Rimehound" for a named elite, else the kind's name. */
  namedName(i: number): string {
    const e = this.enemies[i];
    return e.named >= 0 ? `${NAMED_TITLES[e.named]}, ${e.def.name}` : e.def.name;
  }

  /** Boil-over's steps so far: 0 before the boss boils over, then 1, 2, 3... one more every BOIL.every s. */
  get boilSteps(): number {
    return this.boilStart < 0 ? 0 : 1 + Math.floor((this.time - this.boilStart) / BOIL.every + 1e-9);
  }

  /** Boil-over's share on every hit a hero takes now (1 until the second step). */
  get boilMult(): number {
    const n = this.boilSteps;
    return n > 1 ? 1 + BOIL.step * (n - 1) : 1;
  }

  /**
   * When this boss boils over, in seconds after it spawned (its enrage), or undefined for a boss that has none of its
   * own (a raid boss ends on its hard enrage instead). The boss plate counts down to it.
   */
  boilAfter(kind: EnemyKind): number | undefined {
    const at: Partial<Record<EnemyKind, number>> = {
      kilnMother: BOIL.kilnMother, maelra: FOUNDRY.enrageAfter, lensmother: GLARE.enrageAfter, nhevra: COLD.enrageAfter,
      hessa: WRACK.enrageAfter, ysmeret: YSMERET.enrageAfter, oskel: OSKEL.enrageAfter, ondrel: ONDREL.enrageAfter,
    };
    // The opening (opening.md): no Boil-over countdown in the short Kiln Mother.
    if (this.firstDelve) return undefined;
    const t = at[kind];
    // Loose Lid (a Relic): the boss boils over sooner.
    return t !== undefined && this.heroes.some((_, i) => this.heroPlayer(i).relic === 'looseLid') ? t - RELIC.lidSooner : t;
  }

  /** Every step of a fight: Boil-over in a boss fight, the stall breaker in any other (see BOIL and STALL). */
  private fightClock(dt: number): void {
    if (this.encounterDef.id === this.dungeonDef.boss) {
      const b = this.bossIndex >= 0 ? this.enemies[this.bossIndex] : undefined;
      // Loose Lid (a Relic): the boss comes in with less health (once, whoever in the party carries it).
      if (!this.lidDone && b?.alive && b.def.rank === 'boss' && this.heroes.some((_, i) => this.heroPlayer(i).relic === 'looseLid')) {
        this.lidDone = true;
        b.hp *= RELIC.lidHp;
        b.maxHp *= RELIC.lidHp;
      }
      if (this.boilStart >= 0) return;
      const after = b?.alive ? this.boilAfter(b.kind) : undefined;
      if (this.bossEnraged || (b?.alive && after !== undefined && this.time - b.spawnedAt >= after)) {
        this.boilStart = this.time;
        this.events.push({ type: 'boilOver' });
      }
      return;
    }
    const limit = this.fightStartedAt + STALL.fight + (this.encounter === this.namedAt ? STALL.named : 0);
    if (this.time < limit) return;
    this.stallTickT -= dt;
    if (this.stallTickT > 0) return;
    this.stallTickT += 1;
    const share = STALL.ramp * (1 + Math.floor(this.time - limit));
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.alive) this.damageEnemy(i, e.maxHp * share, false, true);
    }
  }

  /**
   * The start of a fight, shared by an arena fight (startEncounter) and a Halls pack waking with nothing else awake
   * (hallsWake), so each dungeon's per-fight setup runs on both (design, H3 plan: Coldmarrow's full Hearthcoal, the
   * Glarewell's fresh pillars, the Wrackline's rafts).
   */
  private fightSetup(def: EncounterDef): void {
    this.phase = 'fight';
    this.fightStartedAt = this.time;
    for (let k = 0; k < this.heroes.length; k++) { const q = this.heroPlayer(k); q.hurtBy = {}; q.lastHurtBy = undefined; }
    if (this.dungeonId === 'coldmarrow') {
      // Every fight starts with a full Hearthcoal and no Chill.
      for (let k = 0; k < this.heroes.length; k++) {
        const q = this.heroPlayer(k);
        q.coal = 1;
        q.coalR = this.coalMaxR;
        q.chill = 0;
        q.chillT = 0;
      }
    }
    if (this.dungeonId === 'wrackline') {
      // Fresh rafts every fight, spread round their circles; the first pull comes after a breather.
      // Phase 12 W1: every fight but Hessa's rolls its currents from the seed (which way each raft drifts,
      // and where they start), so the quay plays differently from fight to fight.
      const cur = this.rollCurrents(def.id);
      this.wrackX = 0;
      this.wrackY = 0;
      this.wrackRoom = -1;
      this.rafts = [0, 1, 2].map((k) => {
        const a = (k * 2 * Math.PI) / 3 + 0.5 + cur.turn;
        const ring = WRACK.raftRings[k];
        const dir = CURRENTS[cur.pattern][k];
        return { a, ring, dir, x: Math.cos(a) * ring, y: Math.sin(a) * ring, sunkT: 0 };
      });
      this.tideClockT = WRACK.firstTide;
      this.ebbWarnT = 0;
      this.ebbT = 0;
    }
    this.stallTickT = 0;
    this.player.haloUsed = false;
    this.player.windUsed = false;
    // Glarewell: fresh pillars every fight (a cracked pillar only stays down for that fight).
    this.pillars = this.dungeonId === 'glarewell'
      ? [0, 1, 2, 3].map((k) => {
        const a = Math.PI / 4 + (k * Math.PI) / 2;
        return { x: Math.cos(a) * GLARE.pillarRing, y: Math.sin(a) * GLARE.pillarRing, r: GLARE.pillarRadius, cracked: false };
      })
      : [];
    // The lens stands in the middle at the start of every fight (H3b: hallsGlare moves it to a woken pack's room).
    if (this.dungeonId === 'glarewell') { this.lightX = 0; this.lightY = 0; }
    this.markT = 0;
    this.markQueued = 0;
    this.lampBeam = null;
  }

  /**
   * H3b (design, 25 Nov): a Glarewell pack's room gets the fight's fresh pillars round its own middle, where the lens
   * stands: the arena's four on GLARE.pillarRing scaled to the room (clear of a Ring's island), left out where one
   * would stand off the floor or within reach of a doorway. A Cross room's own four stone pillars are its cover instead.
   */
  /**
   * H3d (design, 25 Nov): a woken quay room gets the arena's three rafts, drifting round its middle (a twin's: the half
   * the pack stands in). Their circles shrink with the room so a raft's far edge stays `HALLS_WRACK.clear` inside the
   * wall, which keeps every raft out of the doorways (moved in, never dropped).
   */
  private hallsWrack(room: number, px: number, py: number): void {
    const rm = this.halls!.rooms[room];
    let f = layoutFrame(rm);
    if (rm.shape === 'twin' && rm.parts) {
      const near = rm.parts.map((p) => (p as { c: number[] }).c).sort((a, b) => (a[0] - px) ** 2 + (a[1] - py) ** 2 - ((b[0] - px) ** 2 + (b[1] - py) ** 2))[0];
      f = { x: near[0], y: near[1], r: near[2] };
    }
    this.wrackX = f.x;
    this.wrackY = f.y;
    this.wrackRoom = room;
    const s = Math.min(1, (f.r - WRACK.raftR - HALLS_WRACK.clear) / Math.max(...WRACK.raftRings));
    for (const r of this.rafts) {
      r.ring *= s;
      r.x = f.x + Math.cos(r.a) * r.ring;
      r.y = f.y + Math.sin(r.a) * r.ring;
    }
  }

  private hallsGlare(room: number): void {
    const m = this.halls!, rm = m.rooms[room], f = layoutFrame(rm);
    this.lightX = f.x;
    this.lightY = f.y;
    if (rm.shape === 'cross' && rm.holes?.length) {
      this.pillars = rm.holes.map((h) => {
        const b = (h as { b: number[] }).b;
        return { x: b[0], y: b[1], r: Math.min(b[2], b[3]), cracked: false, fixed: true };
      });
      return;
    }
    const pr = GLARE.pillarRadius;
    const ring = Math.max((GLARE.pillarRing * f.r) / ARENA, (rm.shape === 'ring' ? HALLS_GEN.island : 0) + pr + 40);
    const doors = m.corridors.flatMap((c) => (c.a === room ? [{ x: c.ax ?? rm.x, y: c.ay ?? rm.y }] : c.b === room ? [{ x: c.bx ?? rm.x, y: c.by ?? rm.y }] : []));
    const clear = HALLS.corridor / 2 + pr + 40;
    this.pillars = [0, 1, 2, 3].map((k) => {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      return { x: f.x + Math.cos(a) * ring, y: f.y + Math.sin(a) * ring, r: pr, cracked: false };
    }).filter((c) => roomGap(rm, c.x, c.y) >= c.r + 20 && doors.every((d) => Math.hypot(d.x - c.x, d.y - c.y) > clear));
  }

  private startEncounter(): void {
    const def = this.encounterDef;
    this.fightSetup(def);
    const p = this.player;
    this.rollLayout(def.id);
    this.rollArenaEvent(def.id);
    this.rollStir(def.id);
    // Enter from the far side of the arena.
    const base = Math.atan2(-p.y, -p.x) + this.rng.range(-0.6, 0.6);
    const all = def.spawns.reduce((a, s) => a + s.n, 0);
    // Phase 15 Y1: how this wave comes in (a hash, so the run rng above is untouched).
    this.waveShape = this.waveShapeAt(this.encounter, def.id);
    if (this.stir === 'wave') this.waveShape = (this.stirHash() >>> 12) & 1 && !ringless(def.spawns) ? 'ring' : 'pincer';
    this.reinforceN = this.waveShape === 'reinforce' ? reinforceCount(def.spawns) : 0;
    this.reinforceT = WAVES.reinforceAt;
    this.reinforceA = base - Math.PI / 2; // a flank, never the hero's own side
    const held = heldMask(def.spawns, this.reinforceN);
    const n = all - this.reinforceN;
    if (this.waveShape !== 'arc') {
      const r = this.arenaR - 60;
      this.events.push({ type: 'waveShape', id: this.waveShape, stage: 'start', x: Math.cos(base) * r, y: Math.sin(base) * r });
      if (this.waveShape !== 'reinforce') this.wavesMet |= WAVE_BIT[this.waveShape];
    }
    let at = 0;
    const edge = this.arenaR - 60;
    const onEdge = (a: number) => ({ x: Math.cos(a) * edge, y: Math.sin(a) * edge });
    const outside = [0, 0];
    const wavePos = (k: number): { x: number; y: number } => {
      if (this.waveShape === 'pincer') {
        // The two flanks (a quarter turn either side of the far side), so neither half lands on the hero.
        const side = k % 2, m = side ? Math.floor(n / 2) : Math.ceil(n / 2), idx = Math.floor(k / 2);
        return onEdge(base + (side ? -1 : 1) * (Math.PI / 2) + (idx - (m - 1) / 2) * 0.35);
      }
      if (this.waveShape === 'ring') {
        // A ring round the hero. A foe that would stand outside the arena goes to the wall instead, at least
        // ringR from the hero (further round the wall for each one, so they don't stack).
        const a = base + (k * 2 * Math.PI) / n;
        const rr = Math.min(WAVES.ringR, edge);
        const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr;
        if (Math.hypot(x, y) <= edge) return { x, y };
        const d0 = Math.hypot(p.x, p.y), u = Math.atan2(p.y, p.x);
        const c = (edge * edge + d0 * d0 - rr * rr) / (2 * edge * d0);
        const th = Math.acos(Math.max(-1, Math.min(1, c)));
        const side = Math.sin(a - u) >= 0 ? 1 : -1;
        outside[side > 0 ? 0 : 1]++;
        return onEdge(u + side * (th + 0.3 * (outside[side > 0 ? 0 : 1] - 1)));
      }
      return onEdge(base + (k - (n - 1) / 2) * 0.35);
    };
    let k = 0;
    let lead = -1;
    let firstElite = -1;
    for (const sp of def.spawns) {
      for (let j = 0; j < sp.n; j++, k++) {
        if (held[k]) continue;
        const pos = wavePos(at++);
        const a = Math.atan2(pos.y, pos.x);
        const i = this.spawn(sp.kind, pos.x, pos.y);
        if (i < 0) continue;
        const e = this.enemies[i];
        if (firstElite < 0 && e.def.rank === 'elite') firstElite = i;
        if (sp.kind === 'acolyte') {
          e.aux = a;
          e.aux2 = lead;
        } else if (lead < 0) lead = i;
        if (sp.kind === 'rift') this.events.push({ type: 'riftOpen', x: e.x, y: e.y }); // V1: the Kiln's Hollow Rift fight
        if (sp.kind === 'worldShadow') {
          this.bossIndex = i;
          this.shadowStart = this.time;
          e.aux = 8; // first Molten Cataclysm
          this.bossPhase = 1;
          this.bossEnraged = false;
        }
        if (sp.kind === 'kilnMother') {
          this.bossSpawned = true;
          this.bossIndex = i;
          e.aux = 12; // first Molten Cataclysm
          this.bossVariant = this.rollKilnVariant();
          this.bossEcho = this.rollEcho(KILN_VARIANTS, this.bossVariant);
          this.echoNext = true; // QA #658: her first phase-3 signature is the echo, so a short last phase still hears it
          if (this.bossV2) this.kmStart();
          else if (this.firstDelve) this.kmOpenStart();
          this.events.push({ type: 'bossSpawn' });
        }
        // Wardens take turns mirroring, so one Quench can answer each Mirror Ward.
        if (sp.kind === 'glassWarden') e.abilityT = 3 + j * 2.5;
        if (sp.kind === 'maelra') {
          this.bossSpawned = true;
          this.bossIndex = i;
          this.startMaelra();
          this.bossVariant = this.rollMaelraVariant();
          // Rising water is already in every version but the Sluicetide, so only the other two echo.
          this.bossEcho = this.rollEcho(MAELRA_ECHOES, this.bossVariant);
          this.echoLive = false; this.echoT = MAELRA_ECHO.first;
          this.events.push({ type: 'bossSpawn' });
        }
        if (sp.kind === 'lensmother') {
          this.bossSpawned = true;
          this.bossIndex = i;
          this.glareT = 6;
          this.bossBrandT = 4;
          this.crackT = GLARE.crackEvery;
          this.bossVariant = this.rollLensVariant();
          this.bossEcho = this.rollEcho(LENS_VARIANTS, this.bossVariant);
          this.echoNext = true; // her first brand-timer cast (or Glare, for a Carried Light echo) in phase 3 is the echo
          this.events.push({ type: 'bossSpawn' });
        }
        if (sp.kind === 'ondrel') {
          this.bossSpawned = true;
          this.bossIndex = i;
          this.anvilT = ONDREL.firstAnvil;
          this.choirT = ONDREL.firstChoir;
          this.choirN = 0;
          this.loadHero = -1;
          this.loadT = 0;
          this.homeStage = 0;
          this.homeT = 0;
          this.bossVariant = this.rollOndrelVariant();
          this.bossEcho = this.rollEcho(ONDREL_VARIANTS, this.bossVariant);
          this.echoNext = true;
          this.gripT = 0;
          this.slagTickT = 1;
          this.ondrelStage = 1;
          this.slagPatches = [];
          e.maxHp *= ONDRELV2.hpMult; e.hp = e.maxHp;
          e.abilityT = ONDREL.sweepEvery;
          this.events.push({ type: 'bossSpawn' });
        }
        if (sp.kind === 'hessa') {
          // She holds the drain at the centre.
          e.x = e.px = 0;
          e.y = e.py = 0;
          this.bossSpawned = true;
          this.bossIndex = i;
          this.wrackPhase = 1;
          this.bossVariant = this.rollHessaVariant();
          this.bossEcho = this.rollEcho(HESSA_VARIANTS, this.bossVariant);
          this.echoNext = true; this.ebbEcho = false;
          this.sinkT = WRACK.firstSink;
          this.shoalT = WRACK.firstShoal;
          this.events.push({ type: 'bossSpawn' });
        }
        if (sp.kind === 'nhevra') {
          this.bossSpawned = true;
          this.bossIndex = i;
          this.snuffT = COLD.firstSnuff;
          this.tideT = COLD.firstTide;
          this.nightT = COLD.firstNight;
          this.bossVariant = this.rollNhevraVariant();
          this.bossEcho = this.rollNhevraEcho();
          this.echoLive = false; this.echoT = 0;
          this.driftEmbers = [];
          this.events.push({ type: 'bossSpawn' });
        }
        if (sp.kind === 'grandmotherSlag') {
          this.bossSpawned = true;
          this.bossIndex = i;
          this.bossPhase = 1;
          this.ladleT = SLAG.firstLadle;
          this.raidStart = this.time;
          this.addsT = SLAG.firstAdds;
          this.pourT = SLAG.pourEvery;
          this.heatT = SLAG.heatEvery;
          this.raidVentT = 4;
          this.marksT = 9;
          this.raidBurnT = 1;
          this.lastEmberCast = false;
          this.bossVariant = this.rollSlagVariant();
          this.bossEcho = this.rollEcho(SLAG_VARIANTS, this.bossVariant);
          this.echoLive = false; this.echoT = 0;
          this.islands = [];
          this.islandN = 0;
          this.flowStage = 0;
          this.flowT = 0;
          this.events.push({ type: 'bossSpawn' });
        }
        if (sp.kind === 'regent') {
          this.bossSpawned = true;
          this.bossIndex = i;
          this.bossPhase = 1;
          this.raidStart = this.time;
          this.decreeT = REGENT.firstDecree;
          this.ashT = REGENT.ashEvery;
          this.officeT = REGENT.officeEvery;
          this.officePulses = 0;
          this.regentDecree = [];
          this.lastEmberCast = false;
          this.summonsT = 0;
          this.bossVariant = this.rollRegentVariant();
          this.bossEcho = this.rollEcho(REGENT_VARIANTS, this.bossVariant);
          this.echoNext = true;
          this.events.push({ type: 'bossSpawn' });
        }
        if (sp.kind === 'colossus') {
          this.bossSpawned = true;
          this.bossIndex = i;
          this.bossPhase = 1;
          this.raidStart = this.time;
          this.sweepT = COLO.firstSweep;
          this.wheelT = COLO.firstWheel;
          this.meltT = COLO.meltEvery;
          this.meltPulses = 0;
          this.colDmg = this.heroes.map(() => 0);
          const t = this.heroPlayer(this.targetOf(i, 0));
          this.colFacing = Math.atan2(t.y - e.y, t.x - e.x);
          this.colPlate = 0;
          this.millT = 0;
          this.millDir = 1;
          this.millTickT = 0;
          this.bossVariant = this.rollColossusVariant();
          this.bossEcho = this.rollEcho(COLOSSUS_VARIANTS, this.bossVariant);
          this.echoNext = true;
          this.lastEmberCast = false;
          this.events.push({ type: 'bossSpawn' });
        }
        if (sp.kind === 'vorhulm') {
          this.bossSpawned = true;
          this.bossIndex = i;
          this.bossPhase = 1;
          this.raidStart = this.time;
          this.gorgeT = COAL.firstGorge;
          this.swallowT = COAL.firstSwallow;
          this.spillT = COAL.firstSpill;
          this.swallowed = -1;
          this.crawIndex = -1;
          this.coalFed = 0;
          this.coalEmbers.length = 0;
          this.lastEmberCast = false;
          this.bossVariant = this.rollVorhulmVariant();
          this.bossEcho = this.rollEcho(VORHULM_VARIANTS, this.bossVariant);
          this.echoNext = true;
          this.bankN = 0;
          this.inhaleStage = 0;
          this.inhaleT = 0;
          this.events.push({ type: 'bossSpawn' });
        }
        if (sp.kind === 'hoarfrostWeaver') e.abilityT = 3;
        if (sp.kind === 'conchblower') e.abilityT = CONCH.first;
        if (sp.kind === 'ysmeret') {
          this.bossSpawned = true;
          this.bossIndex = i;
          this.twinVentT = YSMERET.firstVents;
          this.rollLeft = 0;
          this.rollDir = -1;
          this.bossVariant = this.rollYsmeretVariant();
          this.bossEcho = this.rollEcho(YSMERET_VARIANTS, this.bossVariant);
          this.echoNext = true; this.ventMove = this.bossVariant;
          this.scatterT = YSMERET.firstScatter;
          this.bellowT = YSMERET.firstBellow;
          this.ysStage = 1;
          this.ysF0 = this.ysF1 = -1;
          this.events.push({ type: 'bossSpawn' });
        }
        if (sp.kind === 'oskel') {
          this.bossSpawned = true;
          this.bossIndex = i;
          this.downT = OSKEL.firstDown;
          this.rivetT = OSKEL.firstRivets;
          this.stampT = OSKEL.firstStamp;
          this.bossVariant = this.rollOskelVariant();
          this.bossEcho = this.rollEcho(OSKEL_VARIANTS, this.bossVariant);
          this.echoNext = true;
          this.cutCount = 0;
          // OSKELV2: the belt's first way comes from the seed, not the rng, so the rest of the run's draws don't move.
          this.osStage = 1;
          this.osDir = ((this.seed & 7) * Math.PI) / 4;
          this.osFlipT = -1;
          if (OSKELV2.hpMult !== 1) { e.maxHp *= OSKELV2.hpMult; e.hp = e.maxHp; }
          this.events.push({ type: 'bossSpawn' });
        }
        if (sp.kind === 'lensbearer') e.abilityT = 4 + j * 3;
        if (sp.kind === 'brandkeeper') e.abilityT = 3;
        if (sp.kind === 'cinderBrute') this.eliteSpawned = true;
        if (sp.kind === 'ashmaw') { this.rareSpawned = true; this.rareIndex = i; }
      }
    }
    if (this.stir === 'elite') {
      // One more of the fight's first elite kind joins from the far side.
      const kind = def.spawns.find((x) => ENEMIES[x.kind].rank === 'elite')!.kind;
      this.spawn(kind, Math.cos(base) * (this.arenaR - 60), Math.sin(base) * (this.arenaR - 60));
    }
    if (this.stir === 'named') this.namedAt = this.encounter;
    this.rollNamed(firstElite);
    if (this.stir) this.events.push({ type: 'stir', id: this.stir });
    this.events.push({ type: 'encounterStart', index: this.encounter, id: def.id });
  }

  private clearEncounter(): void {
    const def = this.encounterDef;
    this.events.push({ type: 'encounterClear', index: this.encounter, id: def.id });
    if (this.heroes.length === 1) this.clearEncounterFor(def);
    else this.eachHero(() => this.clearEncounterFor(def), true);
    this.afterClear(def);
  }

  private clearEncounterFor(def: (typeof ENCOUNTERS)[EncounterId]): void {
    const p = this.player;
    // Every clear is a level: a talent draft, some healing, and a loot bag.
    p.level++;
    p.pendingLevels++;
    this.events.push({ type: 'levelUp', level: p.level, hero: this.acting });
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
    if (def.id === 'shrine') {
      p.hp = p.maxHp;
    } else {
      // A clear bag rolls on the trash table, or the elite table after a named gate's fight (LOOT, 26 Nov: no floors).
      const src: LootSource = this.namedFight ? 'elite' : 'trash';
      // KILNTRASH: a trash pack drops no bag.
      if (this.trashClear) return;
      this.dropLoot(p.x + 40, p.y, src);
      // Phase 15 Y10: a stirred fight leaves a second bag.
      if (this.stir) this.dropLoot(p.x - 40, p.y, src);
    }
  }

  private afterClear(_def: (typeof ENCOUNTERS)[EncounterId]): void {
    // Co-op: heroes who went down get back up between fights.
    if (this.heroes.length > 1) for (let i = 0; i < this.heroes.length; i++) { const hp = this.heroPlayer(i); if (hp.hp <= 0) hp.hp = hp.maxHp * 0.3; }
    this.namedFight = false;
    this.countStir(this.route[this.encounter]);
    this.encounter++;
    this.openFork();
  }

  /** After a clear: offer a fork if this point in the route has one, else count down to the next fight. */
  private openFork(): void {
    const offer = this.stress || this.bounty !== undefined || this.firstDelve ? null : rollFork(this.route, this.encounter, (n) => this.rng.int(n), (q) => this.rng.chance(q), this.dungeonId);
    if (!offer) {
      this.phase = 'intro';
      this.phaseT = INTRO_TIME;
      return;
    }
    // Two gates side by side, a short walk from the player towards the arena's
    // centre, so both are on a phone screen at once.
    const p = this.player;
    const toward = Math.hypot(p.x, p.y) > 60 ? Math.atan2(-p.y, -p.x) : -Math.PI / 2;
    const cx = p.x + Math.cos(toward) * 140;
    const cy = p.y + Math.sin(toward) * 140;
    const px = -Math.sin(toward) * 85;
    const py = Math.cos(toward) * 85;
    this.gates = offer.map((o, k) => ({ kind: o.kind, encounter: o.encounter, x: cx + (k ? px : -px), y: cy + (k ? py : -py), r: GATE_RADIUS }));
    this.phase = 'choose';
    this.phaseT = CHOOSE_TIME;
    this.events.push({ type: 'fork', gates: this.gates.map((g) => ({ ...g })) });
  }

  private takeGate(g: Gate, timedOut: boolean): void {
    this.route[this.encounter] = g.encounter;
    this.namedFight = g.kind === 'named';
    this.paths.push(g.kind);
    this.gates = [];
    this.events.push({ type: 'gateChosen', kind: g.kind, id: g.encounter, timedOut });
    this.phase = 'intro';
    this.phaseT = INTRO_TIME * 0.6;
  }

  // ---------------------------------------------------------------- Phase 18 Halls H1

  /**
   * Halls: R1, R3 and R5 roll a layout as their fights would today (layoutAt, by the route slot of the room's
   * main-path pack), placed inside the room and scaled to it. Stones and lava stand all run; vents flare only while a
   * pack in their room is awake.
   */
  private hallsLayouts(): void {
    const m = this.halls!;
    this.stones = [];
    this.lava = [];
    this.flareVents = [];
    this.layout = 'open';
    const rolled = new Map<number, string>();
    for (const { room, slot } of m.layoutRooms) {
      const rm = m.rooms[room];
      const id = this.route[slot];
      const h = this.layoutHash(slot);
      if (h === undefined || !this.layoutRolls(id)) continue;
      const lay = this.layoutAt(slot, id);
      rolled.set(room, lay);
      let turn = ((h >>> 8) % 360) * (Math.PI / 180);
      // H2c: placed round the room's layout frame; a piece that would stand off the floor (in a cross's pillar, on a
      // ring's island) is left out. A round room is placed exactly as H1's.
      const f = layoutFrame(rm);
      const s = f.r / ARENA;
      const shaped = !!(rm.parts || rm.holes);
      const onFloor = (x: number, y: number, r: number) => !shaped || roomGap(rm, x, y) >= r + 20;
      if (lay === 'pillars') {
        for (let k = 0; k < LAYOUT.stoneCount; k++) {
          const a = turn + (k * 2 * Math.PI) / LAYOUT.stoneCount;
          const x = f.x + Math.cos(a) * LAYOUT.stoneRing * s, y = f.y + Math.sin(a) * LAYOUT.stoneRing * s;
          if (onFloor(x, y, LAYOUT.stoneRadius)) this.stones.push({ x, y, r: LAYOUT.stoneRadius });
        }
      } else if (lay === 'channel') {
        if (!shaped) {
          const L = rm.r - 40;
          this.lava.push({ x1: rm.x + Math.cos(turn) * L, y1: rm.y + Math.sin(turn) * L, x2: rm.x - Math.cos(turn) * L, y2: rm.y - Math.sin(turn) * L, w: LAYOUT.lavaWidth, room, heat: 0 });
        } else {
          // Along one of the room's axes (a hall's or a cross's arm), across the whole floor, in runs that keep 40 off
          // every wall and island past its own half width (a ring's channel is two runs either side of its hearth).
          turn = Math.round(turn / (Math.PI / 2)) * (Math.PI / 2);
          const ux = Math.cos(turn), uy = Math.sin(turn);
          let run: number | null = null;
          for (let t = -rm.r * 2; t <= rm.r * 2 + 10; t += 10) {
            const ok = t <= rm.r * 2 && roomGap(rm, f.x + ux * t, f.y + uy * t) >= 40 + LAYOUT.lavaWidth / 2;
            if (ok && run === null) run = t;
            if (!ok && run !== null) {
              const t1 = t - 10;
              if (t1 - run >= 120) this.lava.push({ x1: f.x + ux * run, y1: f.y + uy * run, x2: f.x + ux * t1, y2: f.y + uy * t1, w: LAYOUT.lavaWidth, room, heat: 0 });
              run = null;
            }
          }
        }
      } else if (lay === 'vents') {
        for (let k = 0; k < LAYOUT.ventCount; k++) {
          const a = turn + (k * 2 * Math.PI) / LAYOUT.ventCount;
          const x = f.x + Math.cos(a) * LAYOUT.ventRing * s, y = f.y + Math.sin(a) * LAYOUT.ventRing * s;
          if (onFloor(x, y, 30)) m.vents.push({ room, x, y });
        }
      }
    }
    // H2d: each room's theme, matched to the layout it rolled.
    hallsThemes(m, this.seed, (r) => rolled.get(r), this.dungeonId);
  }

  /**
   * H2b room lock (Steve, 25 Nov: "if you start attacking something in a room it should lock"). A pack waking starts its
   * room sealing; HALLS.lockDelay s later the grates drop. Then a hero in a doorway is pushed in, the room's foes are
   * brought in, and if no living hero is inside, the room's awake packs leash (their foes go and they sleep again, at full
   * health when next woken). The grates lift once no pack in the room is awake.
   */
  private hallsLocks(dt: number): void {
    const m = this.halls!;
    const packRoom = (k: number) => m.packs[k].room;
    m.rooms.forEach((rm, i) => {
      const awake = m.packs.some((pk, k) => pk.state === 'awake' && packRoom(k) === i);
      if (rm.lock === undefined || rm.lock < 0) {
        if (rm.lifted !== undefined) rm.lifted += dt;
        if (!awake) return;
        rm.lock = 0;
        this.events.push({ type: 'hallsGrateWarn', room: i });
        return;
      }
      if (!awake) {
        // Lifts once no pack in the room is awake (cleared). A seal that never dropped just stops warning.
        if (rm.lock >= HALLS.lockDelay) this.events.push({ type: 'hallsGrateLift', room: i });
        rm.lock = -1;
        rm.lifted = 0;
        return;
      }
      const was = rm.lock;
      rm.lock += dt;
      if (was >= HALLS.lockDelay || rm.lock < HALLS.lockDelay) return;
      // The grates drop. A hero standing in a doorway (within reach of the room's rim) is pushed inside.
      let inside = 0;
      for (let h = 0; h < this.heroes.length; h++) {
        const q = this.heroPlayer(h);
        if (q.hp <= 0) continue;
        const g = roomGap(rm, q.x, q.y);
        if (g < 0 && g >= -HALLS.corridor / 2 && corridorAt(m, q.x, q.y) >= 0) {
          const to = roomClamp(rm, q.x, q.y, 20);
          q.x = q.px = to.x;
          q.y = q.py = to.y;
        }
        if (roomGap(rm, q.x, q.y) >= 0) inside++;
      }
      if (!inside) {
        // Everyone walked away: the room's awake packs leash.
        m.packs.forEach((pk, k) => {
          if (pk.state !== 'awake' || packRoom(k) !== i) return;
          for (const e of this.enemies) if (e.alive && e.pack === k) { e.alive = false; this.aliveEnemies--; }
          pk.state = 'asleep';
        });
        rm.lock = -1;
        rm.lifted = 0;
        this.events.push({ type: 'hallsLeash', room: i });
        return;
      }
      // The room's own foes caught outside are brought in through the nearest doorway.
      for (const e of this.enemies) {
        if (!e.alive || e.pack === undefined || packRoom(e.pack) !== i) continue;
        if (roomGap(rm, e.x, e.y) >= e.def.radius) continue;
        const to = roomClamp(rm, e.x, e.y, e.def.radius + 10);
        e.x = e.px = to.x;
        e.y = e.py = to.y;
      }
      this.events.push({ type: 'hallsGrateDrop', room: i });
    });
  }

  /** The sealed room (grates down) a Halls pack's foe belongs to, or null. */
  private sealedRoomOf(e: Enemy): HallsMap['rooms'][number] | null {
    if (!this.hallsOn || e.pack === undefined) return null;
    const m = this.halls!;
    const rm = m.rooms[m.packs[e.pack]?.room ?? -1];
    return rm && rm.lock !== undefined && rm.lock >= HALLS.lockDelay ? rm : null;
  }

  /** The living hero inside `rm` nearest (x, y), or -1. */
  private heroInRoom(rm: HallsMap['rooms'][number], x: number, y: number): number {
    let best = -1, bd = Infinity;
    for (let k = 0; k < this.heroes.length; k++) {
      const q = this.heroPlayer(k);
      if (q.hp <= 0 || roomGap(rm, q.x, q.y) < 0) continue;
      const d = dist2(q.x, q.y, x, y);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  /** Whether the party is catching its breath on the map (the client's cue). */
  get hallsResting(): boolean {
    return this.hallsOn && this.hallsQuietT >= HALLS.rest.delay;
  }

  /**
   * Halls "Catch breath" (design, 24 Nov): once nothing has been awake or alive for HALLS.rest.delay s, each living hero
   * gets back HALLS.rest.hp of max hp a second and its class resource builds HALLS.rest.res a second faster. It stops the
   * moment a pack wakes. Only on the map: never in the boss arena or an arena delve.
   */
  private hallsRest(dt: number): void {
    const m = this.halls!;
    if (this.aliveEnemies > 0 || m.packs.some((pk) => pk.state === 'awake')) { this.hallsQuietT = 0; return; }
    this.hallsQuietT += dt;
    if (this.hallsQuietT < HALLS.rest.delay) return;
    const at = this.acting;
    for (let k = 0; k < this.heroes.length; k++) {
      const q = this.heroPlayer(k);
      if (q.hp <= 0) continue;
      q.hp = Math.min(q.maxHp, q.hp + q.maxHp * HALLS.rest.hp * dt);
      this.use(k);
      this.addHeat(HALLS.rest.res * dt);
    }
    this.use(at);
  }

  /** Halls: a room's lava heats while its pack is awake and cools back to crust once nothing there is (design, 24 Nov). */
  private hallsLavaHeat(dt: number): void {
    const m = this.halls!;
    for (const c of this.lava) {
      if (c.room === undefined || c.heat === undefined) continue;
      const hot = m.packs.some((pk) => pk.state === 'awake' && roomAt(m, pk.x, pk.y) === c.room);
      c.heat = Math.max(0, Math.min(1, c.heat + (hot ? dt : -dt) / HALLS.lockDelay));
    }
  }

  /** Halls: the awake pack whose centre is nearest (x, y), or -1 with none awake. */
  private hallsNearestAwake(x: number, y: number): number {
    const m = this.halls;
    if (!m) return -1;
    let best = -1, bd = Infinity;
    m.packs.forEach((pk, k) => {
      if (pk.state !== 'awake') return;
      const d = (pk.x - x) ** 2 + (pk.y - y) ** 2;
      if (d < bd) { bd = d; best = k; }
    });
    return best;
  }

  /** Halls, every step on the map: rooms seen, packs waking, fights clearing, and the boss door. */
  private hallsClock(dt: number): void {
    const m = this.halls!;
    this.hallsLocks(dt);
    for (let k = 0; k < this.heroes.length; k++) {
      const q = this.heroPlayer(k);
      if (q.hp <= 0) continue;
      const r = roomAt(m, q.x, q.y);
      if (r >= 0) m.seen[r] = true;
    }
    for (let k = 0; k < m.packs.length; k++) if (m.packs[k].state === 'asleep' && this.hallsStirs(k)) this.hallsWake(k);
    if (this.lava.length) this.hallsLavaHeat(dt);
    if (this.phase === 'fight') {
      this.runOmens(dt);
      this.dungeonClocks(dt);
      if (this.lava.length || this.flareVents.length) this.layoutClock(dt);
      if (this.aliveEnemies > 0 && !this.victory) this.fightClock(dt);
      for (let k = 0; k < m.packs.length; k++) {
        if (m.packs[k].state !== 'awake') continue;
        if (!this.enemies.some((e) => e.alive && e.pack === k)) this.hallsClear(k);
      }
      if (!m.packs.some((pk) => pk.state === 'awake')) {
        this.phase = 'cleared';
        this.encounter = this.hallsMain;
      }
      this.hallsQuietT = 0;
      return;
    }
    this.hallsRest(dt);
    if (this.lava.length) this.layoutClock(dt);
    const guard = m.packs.find((pk) => pk.guard);
    if (guard && guard.state !== 'cleared') return;
    for (let k = 0; k < this.heroes.length; k++) {
      const q = this.heroPlayer(k);
      if (q.hp > 0 && (q.x - m.door.x) ** 2 + (q.y - m.door.y) ** 2 <= HALLS.door ** 2) { this.hallsEnterBoss(); return; }
    }
  }

  /** Halls: whether sleeping pack `k` wakes this step (a living hero inside its ring, or an awake foe close by). */
  private hallsStirs(k: number): boolean {
    const m = this.halls!;
    const pk = m.packs[k];
    for (let h = 0; h < this.heroes.length; h++) {
      const q = this.heroPlayer(h);
      if (q.hp > 0 && (q.x - pk.x) ** 2 + (q.y - pk.y) ** 2 <= HALLS.reach ** 2) return true;
      // 1.0 CP2, the Kiln run: stepping into the room is enough.
      if (q.hp > 0 && pk.roomWake && roomAt(m, q.x, q.y) === pk.room) return true;
    }
    for (const e of this.enemies) if (e.alive && (e.x - pk.x) ** 2 + (e.y - pk.y) ** 2 <= HALLS.pull ** 2) return true;
    return false;
  }

  /**
   * H3c (design, 25 Nov): on a Halls map the Dimhorn's Dark Call brings its hounds in from the dark edge of its own
   * room, behind it as seen from the room's middle, and they join its pack. A spot off the floor or within a sleeping
   * pack's pull is walked in toward the Dimhorn, so the call never wakes a pack in another room.
   */
  private hallsDarkCall(e: Enemy): void {
    const m = this.halls!;
    const pack = e.pack ?? -1;
    const ri = pack >= 0 ? m.packs[pack].room : roomAt(m, e.x, e.y);
    if (ri < 0) return;
    const rm = m.rooms[ri], f = layoutFrame(rm), R = ENEMIES.rimehound.radius;
    const a = Math.atan2(e.y - f.y, e.x - f.x);
    const ok = (x: number, y: number) => roomGap(rm, x, y) >= R + 20 && m.packs.every((pk) => pk.state !== 'asleep' || (pk.x - x) ** 2 + (pk.y - y) ** 2 > (HALLS.pull + 40) ** 2);
    const was = this.hallsWaking;
    this.hallsWaking = pack;
    let lx = e.x, ly = e.y;
    for (let k = 0; k < DIMHORN.calls; k++) {
      const b = a + (k - (DIMHORN.calls - 1) / 2) * 0.35;
      // From the room's rim inward to the Dimhorn's own spot.
      let x = e.x, y = e.y;
      const rx = f.x + Math.cos(b) * f.r, ry = f.y + Math.sin(b) * f.r;
      for (let t = 1; t >= 0; t -= 0.05) {
        const qx = e.x + (rx - e.x) * t, qy = e.y + (ry - e.y) * t;
        if (ok(qx, qy)) { x = qx; y = qy; break; }
      }
      if (!ok(x, y)) continue;
      this.spawn('rimehound', x, y);
      lx = x; ly = y;
    }
    this.hallsWaking = was;
    this.events.push({ type: 'waveShape', id: 'reinforce', stage: 'land', x: lx, y: ly });
  }

  /**
   * Halls: pack `k` wakes. Its foes spawn where they stood (hp depth from the pack's route slot), and the first pack
   * awake starts a fight as startEncounter does. A shrine has no foes: stepping in clears it at once.
   */
  private hallsWake(k: number): void {
    const m = this.halls!;
    const pk = m.packs[k];
    const def = ENCOUNTERS[pk.enc];
    const first = !m.packs.some((q) => q.state === 'awake');
    pk.state = 'awake';
    this.events.push({ type: 'hallsWake', pack: k });
    // 1.0 CP2, the Kiln run's fork: taking one door sends the other door's pack away, unfought and unpaid.
    if (pk.fork) for (const q of m.packs) if (q.fork && q !== pk && q.state === 'asleep') { q.state = 'cleared'; q.skipped = true; }
    if (!def.spawns.length) {
      this.hallsClear(k);
      return;
    }
    this.encounter = pk.slot;
    if (first) this.fightSetup(def);
    if (first && this.dungeonId === 'glarewell') this.hallsGlare(pk.room);
    if (first && this.dungeonId === 'wrackline') this.hallsWrack(pk.room, pk.x, pk.y);
    this.hallsWaking = k;
    let lead = -1;
    let firstElite = -1;
    pk.foes.forEach((f, j) => {
      const i = this.spawn(f.kind, f.x, f.y);
      if (i < 0) return;
      const e = this.enemies[i];
      if (pk.trash) e.maxHp = e.hp = e.maxHp * KILNTRASH.hp;
      // The opening: each room's foe at its own health (FIRST_DELVE.kindHp); R1's hounds bigger and slower.
      else if (this.firstDelve) {
        e.maxHp = e.hp = e.maxHp * (FIRST_DELVE.kindHp[f.kind] ?? 1);
        if (f.kind === 'cinderhound') e.def = OPENING_HOUND;
      }
      // KILNTRASH.named (design, 25 Nov): on a map with trash, the other packs' foes at this share of health.
      else if (KILNTRASH.named !== 1 && this.halls!.packs.some((q) => q.trash)) e.maxHp = e.hp = e.maxHp * KILNTRASH.named;
      if (firstElite < 0 && e.def.rank === 'elite') firstElite = i;
      // As startEncounter: acolytes circle the pack's first foe, and some foes start their ability clocks offset.
      if (f.kind === 'acolyte') {
        e.aux = Math.atan2(f.y - pk.y, f.x - pk.x);
        e.aux2 = lead;
      } else if (lead < 0) lead = i;
      if (f.kind === 'rift') this.events.push({ type: 'riftOpen', x: e.x, y: e.y });
      if (f.kind === 'glassWarden') e.abilityT = 3 + j * 2.5;
      if (f.kind === 'hoarfrostWeaver') e.abilityT = 3;
      if (f.kind === 'conchblower') e.abilityT = CONCH.first;
      if (f.kind === 'lensbearer') e.abilityT = 4 + j * 3;
      if (f.kind === 'brandkeeper') e.abilityT = 3;
      if (f.kind === 'cinderBrute') this.eliteSpawned = true;
      if (f.kind === 'ashmaw') { this.rareSpawned = true; this.rareIndex = i; }
    });
    this.hallsWaking = -1;
    // H3d: a raft that would start on one of the pack's rifts slides along its circle until it's clear.
    if (this.dungeonId === 'wrackline' && first) {
      for (const r of this.rafts) {
        for (let k = 1; k <= 60 && this.raftOnRift(r.x, r.y); k++) {
          const a = r.a + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.05;
          const x = this.wrackX + Math.cos(a) * r.ring, y = this.wrackY + Math.sin(a) * r.ring;
          if (!this.raftOnRift(x, y)) { r.a = a; r.x = x; r.y = y; }
        }
      }
    }
    // C2: the delve's named elite still hides in one of the main-path fights (namedAt is a route slot).
    if (pk.main) this.rollNamed(firstElite);
    const vents = m.vents.filter((v) => v.room === pk.room);
    if (vents.length && !this.flareVents.length) { this.flareT = LAYOUT.ventFirst; this.flareK = 0; }
    for (const v of vents) if (!this.flareVents.some((f) => f.x === v.x && f.y === v.y)) this.flareVents.push({ x: v.x, y: v.y });
    this.events.push({ type: 'encounterStart', index: pk.slot, id: def.id });
  }

  /**
   * Halls: pack `k` is cleared. Every hero gets today's clear (a level, a talent draft once the fight is over, 30% heal
   * and a bag by the pack's slot); D pays a second bag. Heroes who went down get back up, as between arena fights.
   */
  private hallsClear(k: number): void {
    const m = this.halls!;
    const pk = m.packs[k];
    const def = ENCOUNTERS[pk.enc];
    pk.state = 'cleared';
    const at = this.encounter;
    this.encounter = pk.slot;
    this.namedFight = pk.gate === 'named';
    this.events.push({ type: 'encounterClear', index: pk.slot, id: def.id });
    const clear = () => {
      this.clearEncounterFor(def);
      if (def.id === 'shrine') return;
      const src: LootSource = this.namedFight ? 'elite' : 'trash';
      for (let b = 1; b < pk.bags; b++) this.dropLoot(this.player.x, this.player.y + 40 * b, src);
    };
    this.trashClear = !!pk.trash;
    const forkPay = () => {
      // 1.0 CP2 (checkpoint-2-grey-box.md): the hard door pays an extra roll on the rare loot table, the easy door an extra Spark.
      if (pk.fork === 'hard') this.dropLoot(this.player.x, this.player.y - 40, 'rare');
      if (pk.fork === 'easy') this.player.pendingLevels++;
    };
    // 1.0 CP2: the door guard falls, and each hero picks 1 of 2 Relics (after this clear's Spark).
    const relic = () => { if (pk.guard && this.relicsOn) this.player.relicPick = true; };
    if (this.heroes.length === 1) { clear(); forkPay(); relic(); }
    else { this.eachHero(clear, true); this.eachHero(forkPay, true); this.eachHero(relic, true); }
    this.trashClear = false;
    if (this.heroes.length > 1) for (let i = 0; i < this.heroes.length; i++) { const hp = this.heroPlayer(i); if (hp.hp <= 0) hp.hp = hp.maxHp * 0.3; }
    this.namedFight = false;
    if (pk.gate) this.paths.push(pk.gate);
    if (pk.main) this.hallsMain++;
    // Its room's vents go quiet unless another pack there is still awake.
    if (!m.packs.some((q) => q.state === 'awake' && q.room === pk.room)) {
      const mine = m.vents.filter((v) => v.room === pk.room);
      this.flareVents = this.flareVents.filter((f) => !mine.some((v) => v.x === f.x && v.y === f.y));
    }
    this.encounter = m.packs.some((q) => q.state === 'awake') ? at : this.hallsMain;
  }

  /**
   * Halls: the party walks through the boss door into today's Kiln arena, as if the boss fight of an arena run were
   * starting: levels, talents, hp and gear carry over, and the boss code runs unchanged. Loot and xp still lying on the
   * map come along (the arena sits where the map's first rooms are).
   */
  private hallsEnterBoss(): void {
    const m = this.halls!;
    const at = this.acting;
    for (const d of this.drops) {
      if (!d.alive || !d.item) continue;
      // The nearest living hero takes it, as walking over it would.
      let best = 0, bd = Infinity;
      for (let h = 0; h < this.heroes.length; h++) { const q = this.heroPlayer(h); const dd = (q.x - d.x) ** 2 + (q.y - d.y) ** 2; if (q.hp > 0 && dd < bd) { bd = dd; best = h; } }
      this.use(best);
      d.alive = false;
      this.pickUp(d.item);
      d.item = null;
    }
    this.use(at);
    for (const g of this.gems) if (g.alive) { g.alive = false; this.gainXp(g.value); }
    for (const e of this.enemies) if (e.alive) { e.alive = false; this.aliveEnemies--; }
    for (const pool of [this.telegraphs, this.zones, this.strikes, this.orbs, this.lances] as { alive: boolean }[][]) for (const o of pool) o.alive = false;
    m.done = true;
    m.vents = [];
    this.stones = [];
    this.lava = [];
    this.flareVents = [];
    this.layout = 'open';
    // The party comes in at the south of the arena; the boss enters from the far side (startEncounter).
    for (let h = 0; h < this.heroes.length; h++) {
      const q = this.heroPlayer(h);
      q.x = q.px = (h - (this.heroes.length - 1) / 2) * 50;
      q.y = q.py = ARENA * 0.45;
    }
    this.encounter = this.route.length - 1;
    this.phase = 'intro';
    this.phaseT = HALLS.fade;
    this.events.push({ type: 'hallsDoor' });
  }

  /**
   * V2 (variety): each fight in a dungeon that has layouts rolls one, from a hash of the seed and
   * the fight's place in the route, so the run's own rng is untouched. Boss fights and the first
   * delve stay open.
   */
  /**
   * Phase 16 U1: from ECHO.minTier, a boss also echoes one of her other versions in her last phase. Hashed from the seed
   * (no run-rng draws), never the rolled version, and none on the first delve or in stress runs.
   */
  /** Phase 16 U1: Nhevra's echo, from her other versions; a Creeping Rime run only ever echoes the Emberdrift (NHEVRA_RIME_ECHOES). */
  private rollNhevraEcho(): NhevraVariant | '' {
    return this.rollEcho(this.bossVariant === 'rime' ? NHEVRA_RIME_ECHOES : NHEVRA_VARIANTS, this.bossVariant);
  }

  private rollEcho<V extends string>(all: readonly V[], rolled: string): V | '' {
    if (this.firstDelve || this.stress || this.tier < ECHO.minTier || ECHO.off) return '';
    const others = all.filter((v) => v !== rolled);
    if (!others.length) return '';
    if (ECHO.force && (others as string[]).includes(ECHO.force)) return ECHO.force as V;
    let h = Math.imul(this.seed ^ 0x6c8e9cf5, 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    return others[(h >>> 4) % others.length];
  }

  /** V3: which signature the Kiln Mother uses from phase 2, hashed from the seed (no run-rng draws). The first delve keeps Molten Cataclysm. */
  private rollKilnVariant(): KilnVariant {
    if (this.firstDelve || this.stress) return 'cataclysm';
    let h = Math.imul(this.seed ^ 0x5bd1e995, 0x2c1b3c6d) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x297a2d39) >>> 0;
    return KILN_VARIANTS[(h >>> 4) % KILN_VARIANTS.length];
  }

  /** Phase 12 W3: Grandmother Slag's version this run, hashed from the seed (no run-rng draws). */
  private rollSlagVariant(): SlagVariant {
    if (this.stress) return 'pour';
    let h = Math.imul(this.seed ^ 0x6a09e667, 0x9e3779b1) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f) >>> 0;
    return SLAG_VARIANTS[(h >>> 4) % SLAG_VARIANTS.length];
  }

  /** Phase 12 W3: the Furnace Regent's version this run, hashed from the seed (no run-rng draws). */
  private rollRegentVariant(): RegentVariant {
    if (this.stress) return 'ash';
    let h = Math.imul(this.seed ^ 0x5be0cd19, 0xcc9e2d51) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f) >>> 0;
    return REGENT_VARIANTS[(h >>> 4) % REGENT_VARIANTS.length];
  }

  /** Phase 12 W3: the Cinder Colossus's version this run, hashed from the seed (no run-rng draws). */
  private rollColossusVariant(): ColossusVariant {
    if (this.stress) return 'wheel';
    let h = Math.imul(this.seed ^ 0x9b05688c ^ 0x1f83d9ab, 0xc2b2ae35) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f) >>> 0;
    return COLOSSUS_VARIANTS[(h >>> 4) % COLOSSUS_VARIANTS.length];
  }

  /** Old Vorhulm eats an ember (or a Banked Coal) at (x, y): he heals and hits harder for the rest of the fight. */
  private feedVorhulm(x: number, y: number): void {
    const e = this.bossIndex >= 0 ? this.enemies[this.bossIndex] : null;
    if (!e || !e.alive || e.kind !== 'vorhulm') return;
    this.coalFed++;
    const amount = e.maxHp * COAL.emberHeal * this.healTakenMult(e);
    e.hp = Math.min(e.maxHp, e.hp + amount);
    this.events.push({ type: 'heal', x: e.x, y: e.y, amount });
    this.events.push({ type: 'emberEaten', x, y, fed: this.coalFed });
  }

  /** Phase 12 W3: Old Vorhulm's version this run, hashed from the seed (no run-rng draws). */
  private rollVorhulmVariant(): VorhulmVariant {
    if (this.stress) return 'spill';
    let h = Math.imul(this.seed ^ 0x510e527f, 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f) >>> 0;
    return VORHULM_VARIANTS[(h >>> 4) % VORHULM_VARIANTS.length];
  }

  /** Is (x, y) on a cooling island that hasn't sunk? */
  onIsland(x: number, y: number): boolean {
    return this.islands.some((s) => s.t > 0 && dist2(x, y, s.x, s.y) <= (BRIM.radius + PLAYER_RADIUS * 0.5) ** 2);
  }

  /** The Brimming: place island `n` round Slag, turning by the golden angle, near and far in turn. */
  private placeIsland(e: { x: number; y: number }, n: number, life: number): { x: number; y: number; t: number } {
    const a = n * 2.39996 + (this.seed & 7) * 0.785;
    const r = n % 2 === 0 ? BRIM.near : BRIM.far;
    const c = { x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r };
    this.clampArena(c, BRIM.radius + 10);
    return { x: c.x, y: c.y, t: life };
  }

  /** Phase 12 W2: Oskel's version this run, hashed from the seed (no run-rng draws). */
  private rollOskelVariant(): OskelVariant {
    if (this.stress) return 'rivets';
    let h = Math.imul(this.seed ^ 0x3c6ef372, 0x1f83d9ab) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f) >>> 0;
    return OSKEL_VARIANTS[(h >>> 4) % OSKEL_VARIANTS.length];
  }

  /** Phase 12 W2: Ysmeret's version this run, hashed from the seed (no run-rng draws). */
  private rollYsmeretVariant(): YsmeretVariant {
    if (this.stress) return 'still';
    let h = Math.imul(this.seed ^ 0x9b05688c, 0x5be0cd19) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f) >>> 0;
    return YSMERET_VARIANTS[(h >>> 4) % YSMERET_VARIANTS.length];
  }

  /** Phase 12 W2: Ondrel's version this run, hashed from the seed (no run-rng draws). */
  private rollOndrelVariant(): OndrelVariant {
    if (this.stress) return 'choir';
    let h = Math.imul(this.seed ^ 0x510e527f, 0x9b05688c) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x1f83d9ab) >>> 0;
    return ONDREL_VARIANTS[(h >>> 4) % ONDREL_VARIANTS.length];
  }

  /** Phase 12 W1: Hessa's phase-2 signature this run, hashed from the seed (no run-rng draws). */
  private rollHessaVariant(): HessaVariant {
    if (this.stress) return 'riptide';
    let h = Math.imul(this.seed ^ 0x3c6ef372, 0x1b56c4e9) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2545f491) >>> 0;
    return HESSA_VARIANTS[(h >>> 4) % HESSA_VARIANTS.length];
  }

  /** Phase 16 U1: the version this Ebb runs: her echo's on an echoed Ebb, else her own. */
  private hessaEbb(): string {
    return this.ebbEcho && this.bossEcho ? this.bossEcho : this.bossVariant;
  }

  /** Phase 12 W1: is the Ebb running backwards right now (Hessa's Outsurge, from phase 2)? */
  /** Phase 15 Y3: Hessa's Whirl version, in phase 2 while she lives. */
  get whirl(): boolean {
    return this.hessaEbb() === 'whirl' && this.wrackPhase >= 2 && this.bossIndex >= 0 && !!this.enemies[this.bossIndex]?.alive && this.enemies[this.bossIndex].kind === 'hessa';
  }

  get outsurge(): boolean {
    return this.hessaEbb() === 'outsurge' && this.wrackPhase >= 2 && this.bossIndex >= 0 && !!this.enemies[this.bossIndex]?.alive && this.enemies[this.bossIndex].kind === 'hessa';
  }

  /** V8: Nhevra's phase-2 signature this run, hashed from the seed (no run-rng draws). */
  private rollNhevraVariant(): NhevraVariant {
    if (this.stress) return 'ice';
    let h = Math.imul(this.seed ^ 0x7a3d1f29, 0x5f356495) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x1b873593) >>> 0;
    return NHEVRA_VARIANTS[(h >>> 4) % NHEVRA_VARIANTS.length];
  }

  /** V8: the Lensmother's phase-2 signature this run, hashed from the seed (no run-rng draws). */
  private rollLensVariant(): LensVariant {
    if (this.stress) return 'brand';
    let h = Math.imul(this.seed ^ 0x2545f491, 0x4cf5ad43) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    return LENS_VARIANTS[(h >>> 4) % LENS_VARIANTS.length];
  }

  /** V8: Maelra's phase-2 signature this run, hashed from the seed (no run-rng draws). */
  /** Y3 Sealed Vents: the next open vent, never `not`, from the seed; the one under Maelra is skipped when another is free. */
  private pickVent(not: number, e: Enemy): number {
    const n = this.vents.length;
    let h = Math.imul(this.seed ^ 0x2c1b3c6d, 0x9e3779b1) + Math.imul(++this.sealMoves, 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35) >>> 0;
    const free: number[] = [];
    for (let k = 0; k < n; k++) {
      const v = this.vents[k];
      if (k !== not && dist2(e.x, e.y, v.x, v.y) > (v.r + e.def.radius) ** 2) free.push(k);
    }
    if (!free.length) for (let k = 0; k < n; k++) if (k !== not) free.push(k);
    if (MAELRA_SEAL.near) {
      // The free vent nearest her, so a slow melee lead can reach it.
      let best = free[0], bd = Infinity;
      for (const k of free) { const d = dist2(e.x, e.y, this.vents[k].x, this.vents[k].y); if (d < bd) { bd = d; best = k; } }
      return best;
    }
    return free[h % free.length];
  }

  private rollMaelraVariant(): MaelraVariant {
    if (this.stress) return 'water';
    let h = Math.imul(this.seed ^ 0x1b873593, 0x7feb352d) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
    return MAELRA_VARIANTS[(h >>> 4) % MAELRA_VARIANTS.length];
  }

  /** The layout hash for the fight at route position `k` (no run-rng draws). */
  private layoutHash(k: number): number | undefined {
    if (!LAYOUTS[this.dungeonId] || this.firstDelve || this.stress) return undefined;
    const h = (Math.imul(this.seed ^ 0x9e3779b9, 0x85ebca6b) + Math.imul(k + 1, 0xc2b2ae35)) >>> 0;
    return Math.imul(h ^ (h >>> 13), 0x27d4eb2f) >>> 0;
  }

  private layoutRolls(id: EncounterId): boolean {
    return id !== this.dungeonDef.boss && id !== 'shrine' && id !== 'worldShadow';
  }

  /** The layout the fight `id` at route position `k` gets (rollLayout uses this too). */
  layoutAt(k: number, id: EncounterId): LayoutId {
    const h = this.layoutHash(k);
    if (h === undefined || !this.layoutRolls(id)) return 'open';
    const pool = LAYOUTS[this.dungeonId]!;
    const forced = this.heat === 'stoneFloor' ? 'pillars' : this.heat === 'ventFloor' ? 'vents' : undefined;
    return forced ?? pool[h % pool.length];
  }

  /**
   * Site cards: whether `s` is still ahead in this run, as the route stands (a fork can still
   * swap a fight; that small miss is accepted). The fight under way counts only before it starts.
   */
  situationAhead(s: Situation): boolean {
    // Solo dungeons only for now: group tables (the Hammerdeep's stones and vents since W2) are measured without them.
    if (SITE_CARDS.off || this.dungeonDef.style !== 'solo') return false;
    const from = this.phase === 'fight' ? this.encounter + 1 : this.encounter;
    for (let k = from; k < this.route.length; k++) {
      const id = this.route[k];
      const def = ENCOUNTERS[id];
      if (!def) continue;
      if (s === 'vents' && this.layoutAt(k, id) === 'vents') return true;
      if (s === 'lava' && this.layoutAt(k, id) === 'channel') return true;
      if (s === 'pillars' && (this.layoutAt(k, id) === 'pillars' || this.dungeonId === 'glarewell')) return true;
      if (s === 'spitter' && def.spawns.some((x) => x.kind === 'emberSpitter')) return true;
      if (s === 'lane' && def.spawns.some((x) => x.kind === 'emberSpitter' || x.kind === 'ashbuck')) return true;
    }
    return false;
  }

  /** Read the Lane: the hero stands in an Ember Lob circle or an Ashbuck charge lane that hasn't landed. */
  inLaneTelegraph(): boolean {
    for (const t of this.telegraphs) {
      if (!t.alive || t.kind !== 'hit' || t.owner < 0) continue;
      const k = this.enemies[t.owner]?.kind;
      if ((k === 'emberSpitter' || k === 'ashbuck') && this.insideFor(t, this.player)) return true;
    }
    return false;
  }

  /**
   * Bots' "roll on red" (1.0 CP2): the red mark (a hit or bloom telegraph) the acting hero stands in that lands within
   * `within` s, or null. A gold soak is never one: rolling out of it would miss the soak.
   */
  redLanding(within: number): Telegraph | null {
    const p = this.player;
    for (const t of this.telegraphs) {
      if (!t.alive || t.kind === 'soak' || t.dur - t.t > within) continue;
      // A Bulwark takes a bloom on its shield (Smother) instead.
      if (t.kind === 'bloom' && this.cls === 'bulwark') continue;
      if (!this.insideFor(t, p)) continue;
      // Only when walking out can't make it in time: a roll is a last resort, so a tank doesn't tumble off its spot.
      const d = Math.sqrt(dist2(p.x, p.y, t.x, t.y));
      let exit = t.r + PLAYER_RADIUS * 0.5 - d;
      if (t.shape === 'cone') {
        const off = Math.abs(angleDiff(Math.atan2(p.y - t.y, p.x - t.x), t.angle));
        exit = Math.min(t.r - d, d * Math.sin(Math.max(0, t.arc / 2 - off)));
      }
      if (exit > this.moveSpeed * Math.max(0, t.dur - t.t)) return t;
    }
    return null;
  }

  /** Bots' parry (PARRY): a hit or bloom mark the acting hero stands in that lands within `within` s. */
  tellLanding(within: number): boolean {
    const p = this.player;
    for (const t of this.telegraphs) if (t.alive && t.kind !== 'soak' && t.dur - t.t <= within && this.insideFor(t, p)) return true;
    return false;
  }

  /** Bots: whether point (x, y) lies inside any live hit or bloom mark. */
  markedAt(x: number, y: number): boolean {
    const q = { x, y } as Player;
    for (const t of this.telegraphs) if (t.alive && t.kind !== 'soak' && this.insideFor(t, q)) return true;
    return false;
  }

  /** Back to Stone: the hero is within reach of a layout stone or a standing Glarewell pillar. */
  nearStone(p: Player = this.player): boolean {
    const r = SITE_CARDS.stoneRange + PLAYER_RADIUS;
    for (const c of this.stones) if (Math.hypot(p.x - c.x, p.y - c.y) - c.r <= r) return true;
    for (const c of this.pillars) if (!c.cracked && Math.hypot(p.x - c.x, p.y - c.y) - c.r <= r) return true;
    return false;
  }

  /** Slag Wade: the hero stands in a lava channel. */
  inLava(p: Player = this.player): boolean {
    for (const c of this.lava) if ((c.heat ?? 1) >= 1 && segDist2(p.x, p.y, c.x1, c.y1, c.x2, c.y2) <= (c.w / 2) ** 2) return true;
    return false;
  }

  /** Phase 12 W1: the Wrackline's currents for this fight, hashed from the seed and the fight's place (no run-rng draws). Hessa's fight keeps the first pattern. */
  private rollCurrents(id: EncounterId): { pattern: number; turn: number } {
    if (this.dungeonId !== 'wrackline' || this.stress || id === this.dungeonDef.boss) return { pattern: 0, turn: 0 };
    let h = (Math.imul(this.seed ^ 0x6a09e667, 0x9e3779b1) + Math.imul(this.encounter + 1, 0x85ebca77)) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae3d) >>> 0;
    return { pattern: h % CURRENTS.length, turn: ((h >>> 8) % 360) * (Math.PI / 180) };
  }

  private rollLayout(id: EncounterId): void {
    this.stones = [];
    this.lava = [];
    this.flareVents = [];
    this.layout = 'open';
    const h = this.layoutHash(this.encounter);
    if (h === undefined || !this.layoutRolls(id)) return;
    this.layout = this.layoutAt(this.encounter, id);
    const turn = ((h >>> 8) % 360) * (Math.PI / 180);
    if (this.layout === 'pillars') {
      for (let k = 0; k < LAYOUT.stoneCount; k++) {
        const a = turn + (k * 2 * Math.PI) / LAYOUT.stoneCount;
        this.stones.push({ x: Math.cos(a) * LAYOUT.stoneRing, y: Math.sin(a) * LAYOUT.stoneRing, r: LAYOUT.stoneRadius });
      }
    } else if (this.layout === 'channel') {
      const L = ARENA - 40;
      this.lava.push({ x1: Math.cos(turn) * L, y1: Math.sin(turn) * L, x2: -Math.cos(turn) * L, y2: -Math.sin(turn) * L, w: LAYOUT.lavaWidth });
    } else if (this.layout === 'vents') {
      for (let k = 0; k < LAYOUT.ventCount; k++) {
        const a = turn + (k * 2 * Math.PI) / LAYOUT.ventCount;
        this.flareVents.push({ x: Math.cos(a) * LAYOUT.ventRing, y: Math.sin(a) * LAYOUT.ventRing });
      }
      this.flareT = LAYOUT.ventFirst;
      this.flareK = 0;
    }
    this.events.push({ type: 'layout', id: this.layout });
  }

  /** Phase 15 Y3: which way this Turning Fire turns (1 anticlockwise, -1 clockwise). */
  turnDir = 1;

  /** Phase 15 Y10: whether this run can stir at all. */
  get stirOn(): boolean {
    return !STIR.off && !this.firstDelve && !this.stress && !this.dungeonDef.raid && this.tier >= STIR.minTier && this.fillBots === 0;
  }

  private stirHash(): number {
    const h = (Math.imul(this.seed ^ 0x7f4a7c15, 0x9e3779b1) + Math.imul(this.encounter + 1, 0x85ebca77)) >>> 0;
    return Math.imul(h ^ (h >>> 13), 0xc2b2ae3d) >>> 0;
  }

  /** Phase 15 Y10: after a trash clear, a clean fight builds the count and a rough one sets it back. */
  private countStir(id: EncounterId): void {
    const was = this.stir;
    this.stir = '';
    if (!this.stirOn || !this.layoutRolls(id) || was) return;
    // The worst-off hero decides, each judged against their own class's usual cost (STIR_CLASS).
    // A rough fight for anyone resets the count; the rough bar never loosens past STIR.roughMax of max health.
    let worst = 0;
    let rough = false;
    this.fightWorst = -1;
    for (let k = 0; k < this.heroes.length; k++) {
      const cls = k === this.acting ? this.cls : this.heroes[k].cls;
      const hurt = this.heroPlayer(k).stirHurt ?? 0;
      if (hurt / STIR_CLASS[cls] > worst) { worst = hurt / STIR_CLASS[cls]; this.fightWorst = k; }
      if (hurt >= Math.min(STIR.roughMax, STIR.rough * STIR_CLASS[cls])) rough = true;
    }
    this.fightHurt = worst;
    if (this.fightDown || rough) {
      this.stirCount = 0;
      this.stirNext = false;
    } else if (this.fightHurt <= STIR.clean * (this.heroes.length > 1 ? STIR.groupClean : 1) && ++this.stirCount >= STIR.need && this.stirs < STIR.max) {
      this.stirCount = 0;
      this.stirNext = true;
    }
  }

  /** The reactions fight `id` could take now. */
  private stirChoices(id: EncounterId): StirId[] {
    const def = ENCOUNTERS[id];
    const n = def.spawns.reduce((a, x) => a + x.n, 0);
    const elite = def.spawns.some((x) => ENEMIES[x.kind].rank === 'elite');
    const out: StirId[] = [];
    if (elite) out.push('elite');
    this.planNamed();
    if (elite && this.namedAt === -1) out.push('named');
    if (ARENA_EVENT_POOLS[this.dungeonId] && !this.arenaEvent && !ARENA_EVENTS.off) out.push('event');
    if (n >= 2 && this.waveShapeAt(this.encounter, id) === 'arc' && !WAVES.off && !def.spawns.some((x) => x.kind === 'twinLamp')) out.push('wave');
    return out;
  }

  /** Phase 15 Y10: a stirred fight picks its reaction (a hash, no run-rng draws) and applies the arena event one now. */
  private rollStir(id: EncounterId): void {
    this.stir = '';
    this.fightHurt = 0;
    this.fightDown = false;
    for (let k = 0; k < this.heroes.length; k++) this.heroPlayer(k).stirHurt = 0;
    if (!this.stirOn || !this.layoutRolls(id) || this.encounter === 0) return;
    if (!this.stirNext && !STIR.force) return;
    const choices = this.stirChoices(id);
    const pick = STIR.force && STIR.force !== 'any' ? (choices.includes(STIR.force as StirId) ? (STIR.force as StirId) : undefined) : choices[this.stirHash() % Math.max(1, choices.length)];
    if (!pick) return;
    this.stir = pick;
    this.stirNext = false;
    this.stirs++;
    this.stirsMet |= STIR_BIT[pick];
    if (pick === 'event') {
      const pool = ARENA_EVENT_POOLS[this.dungeonId]!;
      this.arenaEvent = pool[(this.stirHash() >>> 8) % pool.length];
      this.arenaEventStage = 0;
      this.arenaEventT = ARENA_EVENTS.at;
    }
  }

  /** Phase 15 Y1: a `reinforce` wave's held pack: warns, then comes in from the far side (at once if the first half is dead). */
  private reinforceClock(dt: number): void {
    const r = this.arenaR - 60;
    const x = Math.cos(this.reinforceA) * r, y = Math.sin(this.reinforceA) * r;
    const early = this.aliveEnemies === 0 && this.reinforceT > WAVES.reinforceWarn;
    const was = early ? Infinity : this.reinforceT;
    this.reinforceT = (early ? WAVES.reinforceWarn : this.reinforceT) - dt;
    if (was > WAVES.reinforceWarn && this.reinforceT <= WAVES.reinforceWarn) {
      this.events.push({ type: 'waveShape', id: 'reinforce', stage: 'warn', x, y });
      this.wavesMet |= WAVE_BIT.reinforce;
    }
    if (this.reinforceT > 0) return;
    const def = this.encounterDef;
    const held = heldMask(def.spawns, this.reinforceN);
    const m = this.reinforceN;
    let k = 0, at = 0;
    for (const sp of def.spawns) {
      for (let j = 0; j < sp.n; j++, k++) {
        if (!held[k]) continue;
        const a = this.reinforceA + (at++ - (m - 1) / 2) * 0.35;
        this.spawn(sp.kind, Math.cos(a) * r, Math.sin(a) * r);
      }
    }
    this.reinforceN = 0;
    this.events.push({ type: 'waveShape', id: 'reinforce', stage: 'land', x, y });
  }

  /** Phase 15 Y1: the wave shape the fight `id` at route position `k` gets: 'arc' unless a solo or group trash fight rolls another. */
  waveShapeAt(k: number, id: EncounterId): WaveShape {
    // The opener stays an arc: the hero has no talents yet, and a ring of hounds at level 1 killed in 11 s (Coldmarrow t10).
    if (WAVES.off || k === 0 || this.firstDelve || this.stress || this.dungeonDef.raid || !this.layoutRolls(id) || id === 'worldShadow') return 'arc';
    let h = (Math.imul(this.seed ^ 0x51ed270b, 0x9e3779b1) + Math.imul(k + 1, 0xc2b2ae35)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
    const def = ENCOUNTERS[id];
    const n = def ? def.spawns.reduce((a, s) => a + s.n, 0) : 0;
    if (WAVES.force) {
      const f = WAVES.force as WaveShape;
      if (f === 'reinforce') return def && reinforceCount(def.spawns) > 0 ? f : 'arc';
      return n >= 2 && !def!.spawns.some((x) => x.kind === 'twinLamp') && !(f === 'ring' && ringless(def!.spawns)) ? f : 'arc';
    }
    if (n < 2) return 'arc';
    // The Twin Lamps' beam runs between them, so split lamps would sweep the whole arena: they keep the arc.
    const lamps = def!.spawns.some((x) => x.kind === 'twinLamp');
    const u = (h % 1000) / 1000;
    if (u < WAVES.pincer) return lamps ? 'arc' : 'pincer';
    // Skills' Y5: three or more Rimehounds closing from every side at once took 405 health in 3.5 s, and only healers lived.
    if (u < WAVES.pincer + WAVES.ring) return lamps || ringless(def!.spawns) ? 'arc' : 'ring';
    if (u < WAVES.pincer + WAVES.ring + WAVES.reinforce && reinforceCount(def!.spawns) > 0) return 'reinforce';
    return 'arc';
  }

  /** Phase 14 X3: the arena event hash for route position `k` (its own salt, no run-rng draws). */
  private arenaEventHash(k: number): number {
    const h = (Math.imul(this.seed ^ 0x2f8a6b1d, 0x9e3779b1) + Math.imul(k + 1, 0x85ebca6b)) >>> 0;
    return Math.imul(h ^ (h >>> 15), 0xc2b2ae35) >>> 0;
  }

  /** Phase 14 X3: the event the fight `id` at route position `k` gets, if any (solo and group trash fights; never a raid). */
  arenaEventAt(k: number, id: EncounterId): ArenaEventId | '' {
    const pool = ARENA_EVENT_POOLS[this.dungeonId];
    if (!pool || ARENA_EVENTS.off || this.firstDelve || this.stress || !this.layoutRolls(id)) return '';
    const forced = ARENA_EVENTS.force as ArenaEventId | '';
    if (forced) return pool.includes(forced) ? forced : '';
    const h = this.arenaEventHash(k);
    if ((h % 1000) >= ARENA_EVENTS.chance * 1000) return '';
    return pool[(h >>> 10) % pool.length];
  }

  private rollArenaEvent(id: EncounterId): void {
    this.arenaEvent = this.arenaEventAt(this.encounter, id);
    this.arenaEventStage = 0;
    this.arenaEventT = this.arenaEvent ? ARENA_EVENTS.at + ((this.arenaEventHash(this.encounter) >>> 20) % (ARENA_EVENTS.spread + 1)) : 0;
  }

  /** Phase 14 X3: where a Cave-in's stones fall (fixed by the hash, so warn and land agree and co-op guests can draw them). */
  caveInSpots(): { x: number; y: number }[] {
    const h = this.arenaEventHash(this.encounter);
    const turn = ((h >>> 4) % 360) * (Math.PI / 180);
    const out: { x: number; y: number }[] = [];
    for (let k = 0; k < ARENA_EVENTS.caveCount; k++) {
      const a = turn + (k * 2 * Math.PI) / ARENA_EVENTS.caveCount;
      out.push({ x: Math.cos(a) * ARENA_EVENTS.caveRing, y: Math.sin(a) * ARENA_EVENTS.caveRing });
    }
    return out;
  }

  /** Phase 14 X3: where a Vent Surge erupts: the fight's own vents, or a ring of them on any other floor. */
  surgeSpots(): { x: number; y: number }[] {
    if (this.flareVents.length) return this.flareVents;
    const h = this.arenaEventHash(this.encounter);
    const turn = ((h >>> 4) % 360) * (Math.PI / 180);
    const out: { x: number; y: number }[] = [];
    for (let k = 0; k < LAYOUT.ventCount; k++) {
      const a = turn + (k * 2 * Math.PI) / LAYOUT.ventCount;
      out.push({ x: Math.cos(a) * LAYOUT.ventRing, y: Math.sin(a) * LAYOUT.ventRing });
    }
    return out;
  }

  /** Phase 14 X3: the arena event's clock: a warning, then it lands. */
  private arenaEventClock(dt: number): void {
    if (this.arenaEventStage >= 2) return;
    this.arenaEventT -= dt;
    if (this.arenaEventT > 0) return;
    const ev = this.arenaEvent as ArenaEventId;
    const A = ARENA_EVENTS;
    if (this.arenaEventStage === 0) {
      this.arenaEventStage = 1;
      this.arenaEventsMet |= 1 << ARENA_EVENT_ORDER.indexOf(ev);
      this.events.push({ type: 'arenaEvent', id: ev, stage: 'warn' });
      if (ev === 'caveIn') {
        for (const c of this.caveInSpots()) this.addTelegraph('circle', c.x, c.y, A.caveRadius + PLAYER_RADIUS, 0, 0, A.caveWarn, A.caveDamage); // scaled by tier as it lands
        this.arenaEventT = A.caveWarn;
      } else if (ev === 'ventSurge') {
        for (const v of this.surgeSpots()) this.addTelegraph('circle', v.x, v.y, LAYOUT.ventRadius, 0, 0, A.surgeWarn, A.surgeDamage);
        this.arenaEventT = A.surgeWarn;
      } else if (ev === 'coldSnap') {
        this.arenaEventT = A.snapWarn;
      } else {
        // High Water: the Ebb comes now (its own warning follows), whatever its clock said.
        if (this.ebbT <= 0 && this.ebbWarnT <= 0) this.tideClockT = 0;
        this.arenaEventT = 0;
      }
      return;
    }
    this.arenaEventStage = 2;
    this.events.push({ type: 'arenaEvent', id: ev, stage: 'land' });
    if (ev === 'caveIn') for (const c of this.caveInSpots()) this.stones.push({ x: c.x, y: c.y, r: A.caveRadius });
    if (ev === 'coldSnap') {
      // Every living hero's coal dims at once; kills feed it back as usual.
      for (let k = 0; k < this.heroes.length; k++) {
        const q = this.heroPlayer(k);
        if (q.hp > 0 && q.coal !== undefined) q.coal = Math.max(0, q.coal - A.snapCut);
      }
    }
  }

  /** V2: lava burns whoever stands in it; Kiln vents flare in turn. */
  private layoutClock(dt: number): void {
    const at = this.acting;
    for (const c of this.lava) {
      if ((c.heat ?? 1) < 1) continue; // Halls: cooled crust, or still heating
      for (let k = 0; k < this.heroes.length; k++) {
        const q = this.heroPlayer(k);
        if (q.hp <= 0 || segDist2(q.x, q.y, c.x1, c.y1, c.x2, c.y2) > (c.w / 2) ** 2) continue;
        this.use(k);
        this.hurtPlayer(this.player.maxHp * LAYOUT.lavaBurn * (1 - SITE_CARDS.wadeBurn * this.rank('slagWade')) * dt, -1, true, 'lava');
      }
    }
    this.use(at);
    if (this.flareVents.length) {
      this.flareT -= dt;
      if (this.flareT <= 0) {
        this.flareT = LAYOUT.ventEvery;
        const v = this.flareVents[this.flareK % this.flareVents.length];
        this.flareK++;
        this.addTelegraph('circle', v.x, v.y, LAYOUT.ventRadius, 0, 0, LAYOUT.ventCast, LAYOUT.ventDamage, 'hit', -1); // scaled by tier as it lands
        this.events.push({ type: 'ventFlare', x: v.x, y: v.y });
        // Vent-Fed: an Emberwright close to the flare, but outside its circle, feeds on it.
        for (let k = 0; k < this.heroes.length; k++) {
          const q = this.heroPlayer(k);
          if (q.hp <= 0) continue;
          this.use(k);
          const n = this.rank('ventFed');
          const d = Math.hypot(q.x - v.x, q.y - v.y);
          if (n > 0 && d <= SITE_CARDS.ventRange && d > LAYOUT.ventRadius + PLAYER_RADIUS) {
            this.addHeat(SITE_CARDS.ventHeat * n);
            q.ventVolley = true;
          }
        }
        this.use(at);
      }
    }
  }

  private clampArena(o: { x: number; y: number }, r: number): void {
    if (this.stress) return;
    if (this.hallsOn) {
      clampHalls(this.halls!, o, r);
      // Co-op only: grates let heroes in, never out (foes and shots still never cross). Solo play doesn't change.
      clampGrates(this.halls!, o, r, this.heroes.length > 1 && this.heroes.some((h) => h.player === o));
    }
    else {
      const d = Math.hypot(o.x, o.y);
      const max = this.arenaR - r;
      if (d > max) {
        o.x *= max / d;
        o.y *= max / d;
      }
    }
    for (const c of this.stones) {
      const dx = o.x - c.x;
      const dy = o.y - c.y;
      const dd = Math.hypot(dx, dy);
      const min = c.r + r;
      if (dd < min) {
        const k = dd > 0.001 ? min / dd : 1;
        o.x = c.x + (dd > 0.001 ? dx * k : min);
        o.y = c.y + (dd > 0.001 ? dy * k : 0);
      }
    }
    for (const c of this.pillars) {
      if (c.cracked) continue;
      const dx = o.x - c.x;
      const dy = o.y - c.y;
      const dd = Math.hypot(dx, dy);
      const min = c.r + r;
      if (dd < min) {
        const k = dd > 0.001 ? min / dd : 1;
        o.x = c.x + (dd > 0.001 ? dx * k : min);
        o.y = c.y + (dd > 0.001 ? dy * k : 0);
      }
    }
  }

  /** Is this point in a standing pillar's shadow (cast outward from the lens at the centre)? */
  shadowed(x: number, y: number): boolean {
    // H3b: on a Halls map a room's walls block the light too.
    if (this.hallsOn && !clearWalk(this.halls!, this.lightX, this.lightY, x, y)) return true;
    for (const c of this.pillars) {
      if (c.cracked) continue;
      const cx = c.x - this.lightX, cy = c.y - this.lightY;
      const d = Math.hypot(cx, cy);
      if (d < CARRIED_LIGHT.minD) continue;
      const ux = cx / d;
      const uy = cy / d;
      const px = x - this.lightX, py = y - this.lightY;
      const along = px * ux + py * uy - d;
      if (along <= 0 || along > this.shadowLen) continue;
      const across = Math.abs(px * uy - py * ux);
      if (across <= c.r + along * GLARE.shadowWiden) return true;
    }
    return false;
  }

  private director(): void {
    const t = this.time;
    if (!this.eliteSpawned && t >= MINI_BOSS_AT && !this.stress) {
      this.eliteSpawned = true;
      this.spawnAtRing('cinderBrute', 520);
      this.events.push({ type: 'eliteSpawn' });
    }
    if (!this.bossSpawned && t >= BOSS_AT && !this.stress) {
      this.bossSpawned = true;
      this.bossIndex = this.spawnAtRing('kilnMother', 480);
      if (this.bossIndex >= 0) this.enemies[this.bossIndex].aux = 12; // first Molten Cataclysm
      this.bossVariant = 'cataclysm';
      // Lesser named foes flee when the Kiln Mother rises, so the fight stays readable.
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (e.alive && (e.kind === 'ashmaw' || e.kind === 'cinderBrute' || e.kind === 'rift')) this.despawn(i);
      }
      this.events.push({ type: 'bossSpawn' });
    }
    if (!this.rareSpawned && t >= RARE_AT && !this.stress) {
      this.rareSpawned = true;
      this.rareIndex = this.spawnAtRing('ashmaw', 520);
      // KILNTRASH.named: the rare too, on a map with trash.
      const rare = this.enemies[this.rareIndex];
      if (rare && KILNTRASH.named !== 1 && this.halls?.packs.some((q) => q.trash)) rare.maxHp = rare.hp = rare.maxHp * KILNTRASH.named;
      this.events.push({ type: 'rareSpawn' });
    }
    if (!this.stress && !this.bossSpawned && this.riftsOpened < RIFT_TIMES.length && t >= RIFT_TIMES[this.riftsOpened]) {
      this.riftsOpened++;
      const i = this.spawnAtRing('rift', 330);
      if (i >= 0) this.events.push({ type: 'riftOpen', x: this.enemies[i].x, y: this.enemies[i].y });
    }
    if (!this.stress && !this.bossSpawned && t >= this.nextVeinAt) {
      this.nextVeinAt += 30;
      this.spawnVein();
    }

    let target = Math.min(28 + t * 0.6, 380);
    if (this.bossSpawned) target = 70;
    if (this.stress) target = 600;

    if (!this.bossSpawned && !this.stress && t >= this.nextSwarmAt) {
      this.nextSwarmAt += 75;
      const n = 36;
      const off = this.rng.next() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * Math.PI * 2;
        this.spawn('ashling', this.player.x + Math.cos(a) * 560, this.player.y + Math.sin(a) * 560);
      }
    }

    let budget = this.stress ? 40 : 6;
    while (this.aliveEnemies < target && budget-- > 0) {
      this.spawnAtRing(this.pickKind(t), SPAWN_RADIUS);
    }
  }

  private pickKind(t: number): EnemyKind {
    const wHound = t > 45 ? 0.6 : 0;
    const wHusk = t > 120 ? 0.35 + Math.min(0.4, (t - 120) / 600) : 0;
    const roll = this.rng.next() * (1 + wHound + wHusk);
    if (roll < 1) return 'ashling';
    if (roll < 1 + wHound) return 'cinderhound';
    return 'husk';
  }

  private spawnAtRing(kind: EnemyKind, radius: number): number {
    const a = this.rng.next() * Math.PI * 2;
    return this.spawn(kind, this.player.x + Math.cos(a) * radius, this.player.y + Math.sin(a) * radius);
  }

  private spawn(kind: EnemyKind, x: number, y: number): number {
    const def = ENEMIES[kind];
    // C7: summons past the cap fizzle, so a stalled fight can't flood the arena.
    if (!this.stress && this.phase === 'fight' && def.rank === 'normal' && kind !== 'kilnBellows' && this.aliveEnemies >= STALL.addCap) return -1;
    const idx = this.enemies.findIndex((e) => !e.alive);
    if (idx < 0) return -1;
    const e = this.enemies[idx];
    const tierHp = Math.pow(1.22, this.tier - 1) * (this.stress ? 1 : partyHealth(this.partySize) * this.keyHp);
    const depth = this.stress ? 1 : def.rank === 'boss' ? 1 : 1 + 0.12 * this.encounter;
    const scale = (this.stress && def.rank === 'normal' ? 1 + this.time / 220 : depth) * tierHp;
    e.alive = true;
    e.kind = kind;
    e.def = def;
    const nb = NEW_FOE_BIT[kind];
    if (nb) this.foesMet |= nb;
    if (this.threat.length) this.threat[idx] = newThreat();
    e.x = e.px = x;
    e.y = e.py = y;
    e.maxHp = e.hp = def.hp * scale * (kind === 'kilnMother' ? this.kilnT1BossHp() : 1);
    e.touchCd = 0;
    e.orbitCd = 0;
    e.brittleUntil = 0;
    e.slowUntil = 0;
    e.burnDps = 0;
    e.burnT = 0;
    e.woundT = 0;
    e.flash = 0;
    e.abilityT = def.rank === 'boss' ? 2 : def.stationary ? 1 : 4;
    e.spawnedAt = this.time;
    e.hitAt = this.time;
    e.castId = '';
    e.castName = '';
    e.castT = 0;
    e.castDur = 0;
    e.interruptible = false;
    e.stunT = 0;
    // Phase 16 U2: an Ashwall comes in with its shield already toward the hero (aux is its facing).
    e.aux = kind === 'ashwall' ? Math.atan2(this.player.y - y, this.player.x - x) : 0;
    e.aux2 = 0;
    // FOE_AI: the first lunge waits a while after it wakes, staggered per foe so a pack doesn't lunge as one.
    e.lungeT = FOE_AI.lungeFirst + foeHash(idx, 3) * FOE_AI.lungeSpread;
    e.lungeW = 0;
    e.lungeD = 0;
    e.lungeA = 0;
    e.ward = 0;
    e.warded = false;
    e.named = -1;
    e.affix = 0;
    // Halls: a waking pack's foe is that pack's; anything summoned later joins the awake pack nearest it.
    if (this.halls) e.pack = this.hallsWaking >= 0 ? this.hallsWaking : this.hallsNearestAwake(x, y);
    this.aliveEnemies++;
    return idx;
  }

  // ---------------------------------------------------------------- player

  private updatePlayer(input: Input, dt: number): void {
    const p = this.player;
    p.px = p.x;
    p.py = p.y;
    const len = Math.hypot(input.x, input.y);
    if ((p.rollCd ?? 0) > 0) p.rollCd = Math.max(0, (p.rollCd ?? 0) - dt);
    if (input.roll && (p.rollCd ?? 0) <= 0 && (p.rollT ?? 0) <= 0 && p.hp > 0) this.startRoll(input);
    this.updateHold(input, dt);
    if ((p.rollT ?? 0) > 0) {
      // Rolling: the roll carries the hero, whatever the stick says.
      const step = (ROLL.dist / ROLL.time) * Math.min(dt, p.rollT ?? 0);
      p.x += Math.cos(p.rollAng ?? 0) * step;
      p.y += Math.sin(p.rollAng ?? 0) * step;
      p.rollT = Math.max(0, (p.rollT ?? 0) - dt);
    } else if (len > 0.01) {
      const k = Math.min(1, len) / len;
      p.x += input.x * k * this.moveSpeed * dt;
      p.y += input.y * k * this.moveSpeed * dt;
      p.facing = Math.atan2(input.y, input.x);
    }
    this.updateSets(len > 0.01, dt);
    this.clampArena(p, PLAYER_RADIUS);
    p.hp = Math.min(p.maxHp, p.hp + this.regen * dt);
    if (p.hurtFlash > 0) p.hurtFlash -= dt;
    if (this.stress) p.hp = p.maxHp;
  }

  /** The slot whose hold is a verb for the acting hero (Bulwark E Parry, gunner Q charged shot), or -1. */
  get holdVerbSlot(): number {
    if (this.cls === 'bulwark') return this.unlocked(1) ? 1 : -1;
    if (this.cls === 'slagbinder' && this.gunner) return 0;
    return -1;
  }

  /** 1.0 CP2 hold verbs (HOLD): start, keep or release the held button. */
  private updateHold(input: Input, dt: number): void {
    const p = this.player;
    const want = input.hold !== undefined && input.hold === this.holdVerbSlot && p.hp > 0 && this.state === 'running' ? input.hold : -1;
    const had = p.holdSlot ?? -1;
    if (want === had) {
      if (want >= 0) p.holdT = (p.holdT ?? 0) + dt;
      return;
    }
    if (had >= 0) this.releaseHold(had);
    p.holdSlot = want;
    p.holdT = 0;
    if (want >= 0 && this.cls === 'bulwark') {
      // Parry: a raise opens a parry window only if the last one was PARRY.rest ago.
      p.parryOpen = this.time - (p.raiseAt ?? -99) >= PARRY.rest;
      p.raiseAt = this.time;
    }
  }

  private releaseHold(slot: number): void {
    const p = this.player;
    const held = p.holdT ?? 0;
    if (this.cls === 'slagbinder' && slot === 0 && held >= CHARGE.min) this.chargedShot(Math.min(1, held / CHARGE.time + 1e-6));
  }

  /** Parry (PARRY): the acting Bulwark's shield is up. */
  get shieldRaised(): boolean {
    return this.cls === 'bulwark' && (this.player.holdSlot ?? -1) === 1;
  }

  /** Charged shot (CHARGE): how far the acting gunner's charge has built (0-1), or -1 when it isn't charging. */
  get chargeLevel(): number {
    const p = this.player;
    return this.cls === 'slagbinder' && (p.holdSlot ?? -1) === 0 ? Math.min(1, (p.holdT ?? 0) / CHARGE.time + 1e-6) : -1;
  }

  /** The dodge roll (ROLL): the way the stick points (else the way the hero faces), a short guard against blows. */
  private startRoll(input: Input): void {
    const p = this.player;
    const ang = Math.hypot(input.x, input.y) > 0.01 ? Math.atan2(input.y, input.x) : p.facing;
    p.rollAng = ang;
    p.facing = ang;
    p.rollT = ROLL.time;
    p.rolls = (p.rolls ?? 0) + 1;
    p.rollCd = ROLL.cd * (p.relic === 'slipGlaze' ? RELIC.glazeCd : 1);
    p.shieldT = Math.max(p.shieldT, ROLL.guard + TICK);
    // Slip Glaze (a Relic): each roll costs a little health (never the last of it).
    if (p.relic === 'slipGlaze') p.hp = Math.max(1, p.hp - p.maxHp * RELIC.glazeCost);
    this.events.push({ type: 'roll', x: p.x, y: p.y, angle: ang, hero: this.acting });
  }

  /** Whether the acting hero can roll right now. */
  get rollReady(): boolean {
    return (this.player.rollCd ?? 0) <= 0 && (this.player.rollT ?? 0) <= 0;
  }

  /** Whether the acting hero is the one Ondrel is winding up Anvilfall on (for the bots). */
  /** The hero a boss tank-buster (Anvilfall, Bellow Slam, Ladle Pour) is winding up on, or -1. For the bots. */
  get busterTarget(): number {
    const b = this.bossIndex >= 0 ? this.enemies[this.bossIndex] : undefined;
    if (!b || !b.alive) return -1;
    if (b.castId === 'anvilfall') return this.anvilTarget;
    if (b.castId === 'bellowSlam') return this.bellowTarget;
    if (b.castId === 'ladlePour') return this.ladleTarget;
    if (b.castId === 'stamp') return this.stampTarget;
    return -1;
  }

  /** Whether this boss fight has a tank-buster worth saving a cooldown for. */
  get busterFight(): boolean {
    const b = this.bossIndex >= 0 ? this.enemies[this.bossIndex] : undefined;
    return !!b && b.alive && (b.kind === 'ondrel' || b.kind === 'ysmeret' || b.kind === 'grandmotherSlag' || b.kind === 'oskel');
  }

  get anvilOnMe(): boolean {
    const b = this.bossIndex >= 0 ? this.enemies[this.bossIndex] : undefined;
    return !!b && b.alive && b.castId === 'anvilfall' && this.acting === this.anvilTarget;
  }

  /** Co-op: the hero the boss is attacking, or -1 (solo, no boss, or nobody yet). */
  get bossTarget(): number {
    if (this.heroes.length === 1 || this.bossIndex < 0 || !this.enemies[this.bossIndex]?.alive) return -1;
    const id = this.threat[this.bossIndex]?.target;
    return id ? this.heroes.findIndex((h) => h.id === id) : -1;
  }

  /**
   * Co-op: the Bulwark's taunt cue. The boss is on another living hero, and Charge or
   * Shield Toss can take it back. The HUD and the bot both read it.
   */
  get tauntCue(): boolean {
    if (this.cls !== 'bulwark') return false;
    const k = this.bossTarget;
    if (k < 0 || k === this.acting || this.heroPlayer(k).hp <= 0 || !(this.canCast(1) || this.canCast(3))) return false;
    // The raid: leave the boss on another tank until Ladle Pour has Seared it.
    if (this.dungeonDef.raid && this.isTank(k)) return this.swapCue;
    return true;
  }

  /** Whether hero k tanks: a Bulwark, or a Slagbinder in the Anvil stance. */
  isTank(k: number): boolean {
    return this.heroes[k].cls === 'bulwark' || this.heroPlayer(k).stance === 'anvil';
  }

  /**
   * The raid's tank swap cue: Ladle Pour left Seared on the tank the boss is on, and the
   * acting hero is a fresh tank, so it should taunt the boss now. The HUD and the bots read it.
   */
  get swapCue(): boolean {
    if (!this.dungeonDef.raid || !this.isTank(this.acting) || (this.player.sunderT ?? 0) > 0) return false;
    const k = this.bossTarget;
    if (k < 0 || k === this.acting) return false;
    const t = this.heroPlayer(k);
    return t.hp > 0 && (t.sunderT ?? 0) > 0;
  }

  get tierDamage(): number {
    return Math.pow(1.12, this.tier - 1) * this.keyDmg;
  }

  /**
   * The loss screen's "what hurt most" line: health this hero lost this fight, by what took it, and the last blow.
   * Kept on Player so it reaches guests with the rest of the hero (Snapshot.heroes); startEncounter clears it.
   */
  private noteHurt(p: Player, amount: number, cause: string): void {
    if (!(amount > 0)) return;
    const by = p.hurtBy ?? (p.hurtBy = {});
    by[cause] = (by[cause] ?? 0) + amount;
    p.lastHurtBy = cause;
  }

  /**
   * What a telegraph's hit is put down to: the foe whose cast drew it, else what the hero saw, since many boss and arena
   * strikes draw without an owner (owner is also what an interrupt clears, so it isn't added just for this line).
   */
  private telegraphCause(t: Telegraph): string {
    if (t.kind === 'soak') return 'an empty gold circle';
    if (t.owner >= 0 && this.enemies[t.owner]) return this.enemies[t.owner].def.name;
    return 'red marks on the floor';
  }

  /**
   * `src` is the enemy that dealt the hit, when known (Bulwark thorns and reflects go back to it). `cause` names a hit
   * with no `src` for the loss screen's "what hurt most" line (noteHurt); left out, the hit is put down to `src`.
   */
  private hurtPlayer(amount: number, src = -1, unblockable = false, cause?: string): void {
    if (this.invulnerable || (this.player.shieldT > 0 && !unblockable)) return;
    // Swallowed: nothing outside can reach this hero (coalClock digests them).
    if ((this.player.swallowT ?? 0) > 0) return;
    const p = this.player;
    // Parry (Bulwark, shield raised on E): a red tell timed just after the raise is turned aside; any other blow lands lighter.
    if (!unblockable && amount > 0 && this.shieldRaised) {
      const from = src >= 0 ? src : this.tellFrom;
      const foe = src >= 0 ? this.enemies[src] : undefined;
      const red = this.tellFrom !== -1 || (!!foe && (foe.def.rank !== 'normal' || foe.lungeD > 0));
      if (red && p.parryOpen && (p.holdT ?? 0) <= PARRY.window) {
        this.shieldParry(from);
        return;
      }
      amount *= 1 - PARRY.block;
    }
    // Boil-over: from its second step, every hit in the boss fight lands harder (BOIL).
    amount *= this.boilMult;
    // Fire Brick (a Relic): less from every hit while standing still, more while moving.
    if (p.relic === 'fireBrick') amount *= p.moving ? RELIC.brickMoving : RELIC.brickStill;
    // Interpose: a Slagbinder beside this hero takes most of each direct hit, at less damage.
    // Only hits from a foe that can be blocked: never soaks, percent ticks, Ladle Burn or Slag Grip.
    if (src >= 0 && !unblockable && (p.interposeUntil ?? -1) > this.time) {
      const k = p.interposeBy ?? -1;
      if (k >= 0 && k !== this.acting && k < this.heroes.length && this.heroPlayer(k).hp > 0) {
        const moved = amount * SLAG_KIT.interposeShare;
        amount -= moved;
        const back = this.acting;
        this.use(k);
        // (Boil-over is already in `moved`: the inner call would add it again.)
        this.hurtPlayer((moved * (1 - SLAG_KIT.interposeCut)) / this.boilMult, src);
        this.use(back);
      }
    }
    // Cooling Shell: a Slagbinder's shell covers it, and in a party every hero close by.
    const ownShell = this.cls === 'slagbinder' && (p.shellUntil ?? -1) > this.time;
    if (ownShell || this.shellCovers(p)) amount *= 1 - (ownShell ? SLAG_KIT.shellCut : SLAG_KIT.allyShellCut) - (this.cls === 'slagbinder' ? 0.05 * this.rank('slowCool') : 0);
    // Steady Halo (Lumen) and Slag Scales (Slagbinder): a flat cut to every hit.
    if (this.cls === 'lumen') amount *= 1 - 0.05 * this.rank('steadyHalo');
    // A hero in its first character levels (UNLOCK_AID) is hit softer for each level it is short of level 4.
    amount *= 1 - UNLOCK_AID.cut * this.aidSteps;
    if (this.cls === 'slagbinder') amount *= (1 - 0.04 * this.rank('slagScales')) * (1 - TREE.shaleCut * this.tree('shale'));
    if (this.cls === 'emberwright') amount *= (1 - 0.04 * this.rank('sootCloak')) * (1 - TREE.sootCut * this.tree('soot'));
    if (this.cls === 'duskblade') amount *= (1 - 0.04 * this.rank('lowStance')) * (1 - TREE.poiseCut * this.tree('poise'));
    // Muster: in a party, heroes near the Bulwark take less.
    if (this.heroes.length > 1 && (p.cryUntil ?? -1) > this.time) amount *= 1 - ALT_KIT.cryCut;
    // Gather: the Bulwark braces for the pack it pulled in.
    if ((p.gatherUntil ?? -1) > this.time) amount *= 1 - ALT_KIT.gatherCut;
    // Canopy: heroes under a Lumen's dome take less.
    if ((p.canopyUntil ?? -1) > this.time) amount *= 1 - ALT_KIT.canopyCut;
    // Lee Side (party card): heroes close to a Bulwark that took it take less.
    if (this.heroes.length > 1) amount *= 1 - PARTY_CARDS.leeCut * this.allyRank('leeSide', p, PARTY_CARDS.leeRadius);
    // Cover (character tree): heroes close to a Bulwark with it take less.
    if (this.heroes.length > 1) amount *= 1 - TREE.coverCut * this.allyTree('cover', p, TREE.coverRadius);
    // Ember Mantle: whatever strikes the ward catches fire.
    if (src >= 0 && p.plateBy === -1 && (p.plate ?? 0) > 0 && (p.plateUntil ?? -1) > this.time && this.enemies[src]?.alive) {
      const e = this.enemies[src];
      e.burnDps = Math.max(e.burnDps, ALT_KIT.emberWardBurn * this.dmgMult);
      e.burnT = Math.max(e.burnT, ALT_KIT.emberWardBurnTime);
      e.burnBy = this.acting;
    }
    // Molten Plating and Ember Mantle stop blows, not unblockable ticks (heat, cold, Ladle Pour, Slag Grip) or Glare.
    if (!unblockable && !this.verbHit && (p.plate ?? 0) > 0 && (p.plateUntil ?? -1) > this.time) {
      const soak = Math.min(p.plate ?? 0, amount);
      p.plate = (p.plate ?? 0) - soak;
      amount -= soak;
      if (amount <= 0) return;
    }
    if (this.cls === 'slagbinder') {
      // Anvil stance: the slag plate is worn thick, so every hit lands lighter.
      if (p.stance === 'anvil') amount *= 1 - (this.heroes.length > 1 ? SLAG_KIT.partyAnvilArmor : SLAG_KIT.anvilArmor);
      this.addHeat(amount * SLAG_KIT.slagPerDamage + 2 * this.rank('hotBlood'));
      // Whatever strikes a shelled Slagbinder cracks.
      if (src >= 0 && (p.shellUntil ?? -1) > this.time) this.makeBrittle(src);
    }
    if (this.cls === 'bulwark') {
      amount = this.bulwarkMitigate(amount, src);
      if (amount <= 0) return;
    } else if (p.ward > 0) {
      // Shields (Gleam Guard) soak the hit first.
      const soak = Math.min(p.ward, amount);
      p.ward -= soak;
      amount -= soak;
      if (amount <= 0) return;
    }
    // Haven: the Lumen is sheltered inside its own Sanctuary.
    if (p.sanctT > 0 && this.rank('haven') > 0 && dist2(p.x, p.y, p.sanctX, p.sanctY) <= this.sanctuaryRadius ** 2) amount *= 1 - CAPSTONES_2.havenCut;
    // Grudge: every few hits that land, the Bulwark lashes out at everything around it.
    if (this.rank('grudge') > 0) {
      p.grudge = (p.grudge ?? 0) + 1;
      p.grudgeDmg = (p.grudgeDmg ?? 0) + amount;
      if (p.grudge >= CAPSTONES_2.grudgeEvery) {
        const dmg = (CAPSTONES_2.grudgeDamage + CAPSTONES_2.grudgeShare * p.grudgeDmg) * this.dmgMult;
        p.grudge = 0;
        p.grudgeDmg = 0;
        const gr = CAPSTONES_2.grudgeRadius;
        this.forEachNear(p.x, p.y, gr + 40, (i) => {
          const e = this.enemies[i];
          if (dist2(p.x, p.y, e.x, e.y) > (gr + e.def.radius) ** 2) return;
          this.damageEnemy(i, dmg, true);
          if (e.alive && !e.def.stationary) e.stunT = Math.max(e.stunT, CAPSTONES_2.grudgeStun);
        });
        this.events.push({ type: 'explode', x: p.x, y: p.y, r: gr });
      }
    }
    // Ashen Mantle: Blink leaves the Emberwright wrapped in ash for a moment.
    if (this.time < (p.mantleUntil ?? -1)) amount *= 1 - CAPSTONES_2.mantleCut;
    // Tidewalker: harder to pin down while moving.
    if (p.moving && this.setCount('tidewalker') >= 2) amount *= 1 - SET_TUNING.twCut;
    // Hearthkeeper: a hero kept warm by a chain of kills shrugs off part of each hit.
    if ((p.warmth ?? 0) >= SET_TUNING.hkMax && this.setCount('hearthkeeper') >= 3) amount *= 1 - SET_TUNING.hkCut;
    // Wrackrider: a Planted hero is hard to knock about.
    if (p.planted && this.setCount('wrackrider') >= 2) amount *= 1 - SET_TUNING.wrCut;
    // Platewalker: behind the Cinder Colossus, his blows land glancing.
    if (this.setCount('platewalker') >= 2 && this.bossIndex >= 0) {
      const b = this.enemies[this.bossIndex];
      if (b.alive && b.kind === 'colossus' && this.behindColossus(b, p.x, p.y)) amount *= 1 - SET_TUNING.pwCut;
    }
    // Deepguard: stay close. Less damage with an ally near (2), and a wearer of 3 guards the allies near it.
    if (this.heroes.length > 1) amount *= this.deepguardMult();
    // Kinbound: an ally's heal leaves you Covered.
    if ((p.coverT ?? 0) > 0) amount *= 1 - SET_TUNING.knCovered;
    // Blade Guard: the Duskblade turns part of each hit from the foe it is cutting.
    if (this.cls === 'duskblade' && src >= 0 && src === p.guardId) amount *= 1 - (this.noviceAid > 0 ? BLADE_GUARD * this.noviceAid : this.gritGuard);
    // Grit Cut: every other class shrugs off part of each hit after losses in a row from tier 4 (0 for the Duskblade).
    amount *= 1 - this.gritCut;
    if (amount >= p.hp && this.rank('martyrsHalo') > 0 && !p.haloUsed) {
      // Martyr's Halo: the killing blow is turned aside once per fight.
      p.haloUsed = true;
      p.hp = 1;
      p.shieldT = 2;
      this.events.push({ type: 'revive', hero: this.acting });
      return;
    }
    // Spare Wick (a Relic, offered in solo dungeons only): the first blow that would fell its carrier leaves them at a quarter.
    if (amount >= p.hp && p.relic === 'spareWick' && !p.relicSpent) {
      p.relicSpent = true;
      p.hp = p.maxHp * RELIC.wickHp;
      p.shieldT = RELIC.wickShield;
      this.events.push({ type: 'relic', id: 'spareWick', hero: this.acting, x: p.x, y: p.y });
      return;
    }
    if (this.rank('riposte') > 0 && p.parryT <= 0 && amount >= 5 && !unblockable) {
      // Parry: the hit is turned aside and answered.
      p.parryT = 6;
      const t = this.nearestEnemies(p.x, p.y, 1, 170)[0];
      if (t !== undefined) this.damageEnemy(t, 140 * this.dmgMult, true);
      this.events.push({ type: 'parry', x: p.x, y: p.y });
      return;
    }
    // The opening (opening.md rule 1): you can't lose it. The hero holds at 1 health, nothing says so, and the run counts
    // the blows that would have felled it (floorSaves), to see where new players struggle.
    if (this.firstDelve && amount >= p.hp && p.hp > 0) {
      this.floorSaves++;
      amount = Math.max(0, p.hp - 1);
    }
    this.noteHurt(p, Math.min(amount, Math.max(0, p.hp)), cause ?? (src >= 0 ? this.enemies[src]?.def.name : undefined) ?? 'the dungeon');
    p.hp -= amount;
    p.hurtFlash = 0.15;
    p.stirHurt = (p.stirHurt ?? 0) + amount / p.maxHp;
    if (p.hp <= 0) this.fightDown = true;
    this.events.push({ type: 'playerHurt', amount, hero: this.acting });
    // Steady Breath: once per fight, a melee hero knocked low catches its breath. The Emberwright gets it too: a novice
    // one lost every tier-3 career run at the Kiln Mother, to many different hits rather than one (skills, 23 Nov).
    // Clinker Heart: knocked low, the Slagbinder's own slag sets over it.
    if (this.cls === 'slagbinder' && this.rank('clinkerHeart') > 0 && p.hp > 0 && p.hp < p.maxHp * SLAG_KIT.heartAt && this.time >= (p.heartReadyAt ?? 0)) {
      p.heartReadyAt = this.time + SLAG_KIT.heartEvery;
      this.plate(this.acting, p.maxHp * SLAG_KIT.heartShare);
    }
    if ((this.cls === 'duskblade' || this.cls === 'bulwark' || this.cls === 'slagbinder' || this.cls === 'emberwright') && this.noviceAid > 0 && !p.windUsed && p.hp > 0 && p.hp < p.maxHp * 0.3) {
      p.windUsed = true;
      const healed = this.healPlayer(p.maxHp * SECOND_WIND * this.noviceAid);
      if (healed > 0) this.events.push({ type: 'heal', x: p.x, y: p.y, amount: healed });
    }
  }

  /** Parry (PARRY): no damage, Resolve to full, and the attacker staggers (never mid-cast: a parry is not an interrupt). */
  private shieldParry(from: number): void {
    const p = this.player;
    p.heat = MAX_HEAT;
    p.parries = (p.parries ?? 0) + 1;
    const e = from >= 0 ? this.enemies[from] : undefined;
    if (e && e.alive && !e.def.stationary && !e.castId) e.stunT = Math.max(e.stunT, e.def.rank === 'boss' ? PARRY.bossStagger : PARRY.stagger);
    this.events.push({ type: 'shieldParry', x: p.x, y: p.y, hero: this.acting });
  }

  // ---------------------------------------------------------------- action bar

  private addHeat(v: number): void {
    const p = this.player;
    p.heat = Math.min(MAX_HEAT, p.heat + v);
    // Overheat: full Heat in a fight burns the Emberwright and vents it (only fights: Heat fills on its own between them).
    if (p.heat >= MAX_HEAT && this.cls === 'emberwright' && this.phase === 'fight' && p.hp > 0) {
      p.heat = OVERHEAT.vent;
      this.hurtPlayer(p.maxHp * OVERHEAT.scorch, -1, true, 'Overheat');
      this.events.push({ type: 'overheat', x: p.x, y: p.y, hero: this.acting });
    }
  }

  /** Overheat (OVERHEAT): the acting Emberwright's fire is running hot. */
  get overheated(): boolean {
    return this.cls === 'emberwright' && this.player.heat >= OVERHEAT.from;
  }

  private updateAbilities(input: Input, dt: number): void {
    const p = this.player;
    for (let k = 0; k < p.cds.length; k++) if (p.cds[k] > 0) p.cds[k] = Math.max(0, p.cds[k] - dt);
    if (p.gcd > 0) p.gcd -= dt;
    if (p.shieldT > 0) p.shieldT -= dt;
    if (p.parryT > 0) p.parryT -= dt;
    if (p.hasteT > 0) p.hasteT -= dt;
    if (p.imageT > 0) p.imageT -= dt;
    if (p.tossT > 0) p.tossT -= dt;
    // Anchored Dawn: Radiant Burst recovers 50% faster inside your own Sanctuary.
    if (p.sanctT > 0 && p.cds[0] > 0 && this.hasMythic('anchoredDawn') && dist2(p.x, p.y, p.sanctX, p.sanctY) <= this.sanctuaryRadius ** 2) {
      p.cds[0] = Math.max(0, p.cds[0] - 0.5 * dt);
    }
    // Hot Heels rank 2 (Blink) and Shadow Slip (Sidestep): a second charge refills on the cooldown.
    if ((this.rank('blazingSpeed') >= 2 || this.rank('shadowSlip') > 0) && p.blinkCharges < 1) {
      p.blinkChargeT -= dt;
      if (p.blinkChargeT <= 0) {
        p.blinkCharges = 1;
        p.blinkChargeT = this.abilityCooldown(1);
      }
    }
    this.addHeat((this.cls === 'duskblade' ? 3 : this.cls === 'bulwark' || this.cls === 'slagbinder' ? 1 : this.cls === 'lumen' ? 4 : 2) * dt);
    const slot = input.cast;
    if (slot === undefined || slot < 0 || slot >= this.abilities.length || !this.canCast(slot)) return;
    p.heat -= this.abilityCost(slot);
    if (slot === 1 && p.cds[1] > 0 && !this.isAlt(1)) {
      // Spend the stored charge; the main cooldown keeps running.
      p.blinkCharges--;
      p.blinkChargeT = this.abilityCooldown(1);
    } else p.cds[slot] = this.abilityCooldown(slot);
    if (!this.abilities[slot].offGcd) p.gcd = GCD;
    if (this.isAlt(slot)) {
      this.castAlt(input, slot);
      return;
    }
    if (this.cls === 'lumen') {
      if (slot === 0) this.radiantBurst();
      else if (slot === 1) this.glimmerStep(input);
      else if (slot === 2) this.sanctuary();
      else this.quench();
      return;
    }
    if (this.cls === 'slagbinder') {
      if (slot === 0) this.moltenPlating();
      else if (slot === 1) this.interpose(input);
      else if (slot === 2) this.coolingShell();
      else this.quench();
      return;
    }
    if (this.cls === 'bulwark') {
      if (slot === 0) this.shieldSlam();
      else if (slot === 1) this.charge();
      else if (slot === 2) this.bastion();
      else this.quench();
      return;
    }
    if (this.cls === 'duskblade') {
      if (slot === 0) this.rendingDash();
      else if (slot === 1) this.sidestep(input);
      else if (slot === 2) this.execution();
      else this.quench();
      return;
    }
    if (slot === 0) this.flameWave();
    else if (slot === 1) this.blink(input);
    else if (slot === 2) this.combustion();
    else this.quench();
  }

  private flameWave(): void {
    const p = this.player;
    const t = this.nearestEnemies(p.x, p.y, 1, 400)[0];
    const ang = t !== undefined ? Math.atan2(this.enemies[t].y - p.y, this.enemies[t].x - p.x) : p.facing;
    const r = 230;
    const tide = this.rank('cinderTide') > 0;
    const half = tide ? Math.PI : (110 * Math.PI) / 360;
    const dmg = 50 * (1 + 0.2 * this.rank('emberCarpet')) * (1 + TREE.charWave * this.tree('char')) * this.dmgMult;
    if (tide) this.addZone(p.x, p.y, CAPSTONES_2.tideZoneR, CAPSTONES_2.tideZoneDps * this.dmgMult, CAPSTONES_2.tideZoneTime);
    this.forEachNear(p.x, p.y, r + 40, (i) => {
      const e = this.enemies[i];
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > r + e.def.radius) return;
      if (Math.abs(angleDiff(Math.atan2(dy, dx), ang)) > half + e.def.radius / d) return;
      if (e.def.rank === 'normal' && !e.def.stationary && !this.hasMythic('wanderersWake')) {
        e.x += (dx / d) * 60;
        e.y += (dy / d) * 60;
      }
      this.damageEnemy(i, dmg, true, false, this.rank('ignition') > 0);
    });
    const inferno = this.rank('rollingInferno');
    if (inferno > 0) {
      for (const k of [70, 140, 210]) {
        this.addZone(p.x + Math.cos(ang) * k, p.y + Math.sin(ang) * k, 34, 10 * inferno * this.dmgMult, 3);
      }
    }
    this.events.push({ type: 'ability', slot: 0, x: p.x, y: p.y, angle: ang, r });
  }

  private blink(input: Input): void {
    const p = this.player;
    const moving = Math.hypot(input.x, input.y) > 0.01;
    const ang = moving ? Math.atan2(input.y, input.x) : p.facing;
    const x1 = p.x;
    const y1 = p.y;
    p.x += Math.cos(ang) * 170;
    p.y += Math.sin(ang) * 170;
    this.clampArena(p, PLAYER_RADIUS);
    p.px = p.x;
    p.py = p.y;
    p.shieldT = 0.3 + 0.6 * this.rank('flicker');
    if (this.rank('blazingSpeed') > 0) p.hasteT = 2;
    if (this.rank('ashenMantle') > 0) p.mantleUntil = this.time + CAPSTONES_2.mantleTime;
    this.addZone(x1, y1, 44, 14 * this.dmgMult, 3);
    // Wanderer's Wake: the whole path burns.
    if (this.hasMythic('wanderersWake')) {
      for (const k of [0.33, 0.67, 1]) this.addZone(x1 + (p.x - x1) * k, y1 + (p.y - y1) * k, 44, 14 * this.dmgMult, 3);
    }
    this.events.push({ type: 'blink', x1, y1, x2: p.x, y2: p.y });
  }

  /** Combustion goes for the target that matters most: healers, then named foes. */
  private combustionTarget(): number {
    const p = this.player;
    const order = ['craw', 'acolyte', 'ashmaw', 'cinderBrute', 'kilnMother', 'rift'];
    let best = -1;
    let bestRank = Infinity;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive || dist2(p.x, p.y, e.x, e.y) > 450 * 450) continue;
      const r = order.indexOf(e.kind);
      if (r >= 0 && r < bestRank) { bestRank = r; best = i; }
    }
    return best >= 0 ? best : (this.nearestEnemies(p.x, p.y, 1, 450)[0] ?? -1);
  }

  private combustion(): void {
    const p = this.player;
    // Banked Heart: Combustion bursts around the Emberwright instead, and wider, unless it is
    // going for a healer (the Kiln's acolytes still have to die).
    let t = this.combustionTarget();
    const banked = this.hasMythic('bankedHeart');
    if (banked && t >= 0 && this.enemies[t].kind !== 'acolyte') t = -1;
    const x = t >= 0 ? this.enemies[t].x : p.x;
    const y = t >= 0 ? this.enemies[t].y : p.y;
    const r = banked ? 190 : 150;
    let kills = 0;
    // Co-op Kindling: the blast lifts nearby allies' damage for a few seconds.
    if (this.heroes.length > 1) {
      for (let k = 0; k < this.heroes.length; k++) {
        if (k === this.acting) continue;
        const ally = this.heroes[k].player;
        const long = this.rank('longKindle');
        if (ally.hp > 0 && dist2(p.x, p.y, ally.x, ally.y) <= (GROUP_TOOLS.kindleRadius + PARTY_CARDS.kindleRadius * long) ** 2) {
          ally.kindleUntil = this.time + GROUP_TOOLS.kindleTime + PARTY_CARDS.kindleTime * long;
        }
      }
    }
    const dmg = 240 * this.dmgMult * (1 + 0.2 * this.rank('heatSink') + 0.2 * this.rank('fastFuse'));
    this.forEachNear(x, y, r + 50, (i) => {
      const e = this.enemies[i];
      if (dist2(x, y, e.x, e.y) > (r + e.def.radius) ** 2) return;
      this.damageEnemy(i, dmg, true);
      if (e.alive) {
        e.burnDps = Math.max(e.burnDps, 20 * this.dmgMult);
        e.burnT = 4;
        e.burnBy = this.acting;
      } else kills++;
    });
    if (banked) this.addHeat(15 * kills);
    const pyro = this.rank('pyroclasm');
    if (pyro > 0) this.addZone(x, y, 90, 14 * pyro * this.dmgMult, 4);
    this.events.push({ type: 'ability', slot: 2, x, y, angle: 0, r });
  }

  /**
   * Whether the acting hero's F can stop this foe's cast. An interrupt stops any. The Lumen's and Slagbinder's stun stops
   * any alone too (solo bosses are tuned for every class), but in a party a boss shrugs it off: its casts need an interrupter.
   */
  canStop(e: { interruptible: boolean; def: { rank: string } }): boolean {
    return e.interruptible && this.unlocked(3) && (this.classDef.kick || e.def.rank !== 'boss' || this.heroes.length === 1);
  }

  /**
   * Whether anyone in the party can stop this foe's casts with F: an interrupt stops any, a stun any but a boss's in a
   * party (canStop). A foe facing a party that can't skips its STOP_ONLY casts and uses its other skills (Steve, 26 Nov).
   */
  partyStops(e: { def: { rank: string } }): boolean {
    return e.def.rank === 'boss' ? this.partyKick || (this.heroes.length === 1 && this.partyF) : this.partyF;
  }

  /** The enemy the acting hero's F would stop right now (interrupt, or the Lumen's and Slagbinder's stun), or -1. */
  interruptTarget(): number {
    const p = this.player;
    // The most dangerous caster first: boss, then rare, then elite.
    const weight = { boss: 0, rare: 1, elite: 2, normal: 3 };
    let best = -1;
    let bestW = Infinity;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      // The interrupt split: a Lumen's or Slagbinder's F is a stun, and in a party a boss shrugs it off (canStop).
      if (!e.alive || !e.castId || !this.canStop(e)) continue;
      const d = dist2(p.x, p.y, e.x, e.y);
      const reach = this.classDef.interruptRange + e.def.radius;
      if (d > reach * reach) continue;
      const w = weight[e.def.rank] * 1e7 + d;
      if (w < bestW) { bestW = w; best = i; }
    }
    return best;
  }

  private quench(): void {
    const p = this.player;
    const t = this.interruptTarget();
    if (t >= 0) {
      const e = this.enemies[t];
      this.events.push({ type: 'interrupt', x: e.x, y: e.y, name: e.castName });
      p.interrupts = (p.interrupts ?? 0) + 1;
      this.cancelCast(t);
      e.stunT = 2;
      // The opening (R5, opening.md): a Quenched cast staggers the caster.
      if (this.firstDelve && e.def.rank !== 'boss') {
        e.staggerT = FIRST_DELVE.stagger.time;
        this.events.push({ type: 'staggered', x: e.x, y: e.y, time: FIRST_DELVE.stagger.time });
      }
      // Reaching Light: Hushing a Spitter gives some of Hush back.
      if (e.kind === 'emberSpitter' && this.rank('reachingLight') > 0) p.cds[3] = Math.max(0, p.cds[3] - SITE_CARDS.hushRefund * this.rank('reachingLight'));
      // Kilnbreaker: an interrupt sharpens you (2 pieces) and exposes the foe (3).
      const kb = this.setCount('kilnbreaker');
      if (kb >= 2) p.kbT = SET_TUNING.kbTime;
      if (kb >= 3) e.exposedT = SET_TUNING.kbExposedTime;
      this.events.push({ type: 'ability', slot: 3, x: e.x, y: e.y, angle: 0, r: 40 });
      if (this.cls === 'slagbinder' && this.hasMythic('clinkerCrown')) this.crownBounce(t);
      if (this.cls === 'bulwark' && this.hasMythic('tetheredShield')) {
        // Tethered Shield: the shield bounces on to two more casters, and Charge can follow it.
        p.tossId = t;
        p.tossT = 4;
        for (let k = 0; k < 2; k++) {
          const n = this.interruptTarget();
          if (n < 0) break;
          const o = this.enemies[n];
          this.events.push({ type: 'interrupt', x: o.x, y: o.y, name: o.castName });
          p.interrupts = (p.interrupts ?? 0) + 1;
          this.cancelCast(n);
          o.stunT = 2;
        }
      }
      return;
    }
    // Co-op group tools on the interrupt slot, when there's nothing to interrupt.
    if (this.heroes.length > 1 && this.cls === 'lumen' && this.purify()) return;
    if (this.heroes.length > 1 && this.cls === 'bulwark' && this.callOut()) return;
    if (this.heroes.length > 1 && this.cls === 'slagbinder' && this.clinkerBoss()) return;
    // Nothing to interrupt: half the cooldown back (and a small bolt for casters).
    p.cds[3] = this.abilityCooldown(3) / 2;
    if (this.cls === 'duskblade') return;
    const n = this.nearestEnemies(p.x, p.y, 1, 480)[0];
    if (n !== undefined) {
      const e = this.enemies[n];
      this.damageEnemy(n, 30 * this.dmgMult, true);
      this.events.push({ type: 'ability', slot: 3, x: e.x, y: e.y, angle: 0, r: 30 });
    }
  }

  /** The ally a Lumen's Purify would cleanse: the one in range with the most Slag Grip stacks. -1 if none. */
  purifyTarget(): number {
    if (this.heroes.length === 1 || this.cls !== 'lumen') return -1;
    const p = this.player;
    let best = -1;
    let bestScore = 0;
    for (let k = 0; k < this.heroes.length; k++) {
      if (k === this.acting) continue;
      const a = this.heroPlayer(k);
      if (a.hp <= 0 || dist2(p.x, p.y, a.x, a.y) > GROUP_TOOLS.purifyRange ** 2) continue;
      const score = a.slag ?? 0;
      if (score > bestScore) {
        bestScore = score;
        best = k;
      }
    }
    return best;
  }

  /** Lumen, Purify: clears Slag Grip from one ally. False if nobody needs it. */
  private purify(): boolean {
    const k = this.purifyTarget();
    if (k < 0) return false;
    const a = this.heroPlayer(k);
    a.slag = 0;
    this.events.push({ type: 'cleanse', x: a.x, y: a.y });
    this.events.push({ type: 'ability', slot: 3, x: a.x, y: a.y, angle: 0, r: 40 });
    return true;
  }

  /** Bulwark, Called Out: Shield Toss taunts the boss when it's on someone else. False if not. */
  private callOut(): boolean {
    const b = this.bossIndex;
    if (b < 0 || !this.enemies[b].alive || !this.threat[b]) return false;
    const k = this.bossTarget;
    if (k < 0 || k === this.acting) return false;
    const e = this.enemies[b];
    const p = this.player;
    if (dist2(p.x, p.y, e.x, e.y) > (GROUP_TOOLS.callOutRange + e.def.radius) ** 2) return false;
    taunt(this.threat[b], this.heroes[this.acting].id);
    this.events.push({ type: 'ability', slot: 3, x: e.x, y: e.y, angle: 0, r: 40 });
    this.kinCover(k, true);
    this.broadBack(k);
    return true;
  }

  /** Broad Back (party card): taking the boss off hero k heals k. */
  private broadBack(k: number): void {
    if (k < 0 || k === this.acting || this.rank('broadBack') === 0) return;
    const a = this.heroPlayer(k);
    if (a.hp > 0) this.healAllies(a.x, a.y, 1, a.maxHp * PARTY_CARDS.broadHeal, k, false);
  }

  // ---------------------------------------------------------------- weapons

  private updateWeapons(dt: number): void {
    const p = this.player;
    this.updateAlt(dt);
    if (this.cls === 'duskblade') {
      this.updateBlades(dt);
      return;
    }
    if (this.cls === 'bulwark') {
      this.updateShield(dt);
      return;
    }
    if (this.cls === 'slagbinder') {
      this.updateSlag(dt);
      return;
    }
    if (this.cls === 'lumen') {
      this.updateLight(dt);
      return;
    }

    p.volleyT -= dt;
    if (p.volleyT <= 0) {
      p.volleyT += this.volleyCooldown;
      this.fireVolley();
    }

    const rain = this.rank('emberRain');
    if (rain > 0) {
      p.rainT -= dt;
      if (p.rainT <= 0) {
        p.rainT += 4;
        for (let i = 0; i < rain * 2; i++) {
          const target = this.randomEnemyNear(p.x, p.y, 380);
          if (target < 0) break;
          const e = this.enemies[target];
          this.addStrike(e.x, e.y, 55, 28 * this.dmgMult);
        }
      }
    }

    if (this.rank('phoenixLance') > 0) {
      p.lanceT -= dt;
      if (p.lanceT <= 0) {
        p.lanceT += 2.5;
        this.fireLance();
      }
    }

    this.updateOrbit(dt);
  }

  /** Three orbiting motes: Ring of Ash (Emberwright) or Choir of Dawn (Lumen, heals on hit). */
  private updateOrbit(dt: number): void {
    const p = this.player;
    const choir = this.rank('choirOfDawn') > 0;
    if (this.rank('ringOfAsh') > 0 || choir) {
      p.orbitAngle += 3.2 * dt;
      const r = this.orbitR;
      for (let k = 0; k < 3; k++) {
        const a = p.orbitAngle + (k * Math.PI * 2) / 3;
        const ox = p.x + Math.cos(a) * r;
        const oy = p.y + Math.sin(a) * r;
        this.forEachNear(ox, oy, 60, (i) => {
          const e = this.enemies[i];
          if (e.orbitCd > 0) return;
          if (dist2(ox, oy, e.x, e.y) <= (14 + e.def.radius) ** 2) {
            e.orbitCd = 0.4;
            this.damageEnemy(i, (choir ? LUMEN_CAPS.choirDamage : DEFENCE_BRANCH.ringDamage) * this.dmgMult, true);
            if (choir) this.healPlayer(1.5);
          }
        });
      }
    }
  }

  // ---------------------------------------------------------------- ability options

  /** One White Heat hit: the damage and its burn. */
  private whiteHeatHit(i: number, dmg: number): void {
    const e = this.enemies[i];
    this.damageEnemy(i, dmg, true);
    if (e.alive) {
      e.burnDps = Math.max(e.burnDps, ALT_KIT.whiteHeatBurn * this.dmgMult);
      e.burnT = Math.max(e.burnT, ALT_KIT.whiteHeatBurnTime);
      e.burnBy = this.acting;
    }
  }

  /** Casts the ability option in `slot` (ALT_OPTIONS). */
  private castAlt(input: Input, slot: number): void {
    const p = this.player;
    const id = this.altAt(slot)?.id;
    if (id === 'wideCut') {
      // Wide Cut: a full spin, every foe in reach takes the hit and a bleed. Execution's single-target answer for packs.
      const r = ALT_KIT.wideCutRadius;
      this.forEachNear(p.x, p.y, r + 40, (i) => {
        const e = this.enemies[i];
        if (dist2(p.x, p.y, e.x, e.y) > (r + e.def.radius) ** 2) return;
        this.damageEnemy(i, ALT_KIT.wideCutDamage * this.dmgMult, true);
        if (e.alive) {
          e.burnDps = Math.max(e.burnDps, ALT_KIT.wideCutBleed * this.bleedMult * this.dmgMult);
          e.burnT = Math.max(e.burnT, 4);
          e.burnBy = this.acting;
        }
      });
      this.events.push({ type: 'ability', alt: true, hero: this.acting, slot, x: p.x, y: p.y, angle: 0, r });
      return;
    }
    if (id === 'quicken') {
      p.quickUntil = this.time + ALT_KIT.quickenTime;
      this.events.push({ type: 'ability', alt: true, hero: this.acting, slot, x: p.x, y: p.y, angle: 0, r: 40 });
      return;
    }
    if (id === 'sunlance') {
      // Sunlance: one lance of light at the target; Radiant Burst's single-target answer. Pulse (tree) works on it.
      const t = this.bladeTarget(this.lumenRange);
      if (t < 0) return;
      const e = this.enemies[t];
      p.facing = Math.atan2(e.y - p.y, e.x - p.x);
      const lance = this.lances.find((l) => !l.alive);
      if (lance) Object.assign(lance, { alive: true, x1: p.x, y1: p.y, x2: e.x, y2: e.y, life: 0.25 });
      this.damageEnemy(t, ALT_KIT.sunlanceDamage * (1 + TREE.pulseBurst * this.tree('pulse')) * this.dmgMult, true);
      const ally = this.woundedAlly(this.lumenRange);
      if (ally >= 0) this.healAllies(this.heroes[ally].player.x, this.heroes[ally].player.y, 1, ALT_KIT.sunlanceHeal, ally);
      else this.healPlayer(ALT_KIT.sunlanceHeal);
      this.events.push({ type: 'ability', alt: true, hero: this.acting, slot, x: e.x, y: e.y, angle: p.facing, r: 30 });
      return;
    }
    if (id === 'canopy') {
      this.sanctuary(true);
      return;
    }
    if (id === 'emberDart') {
      // Ember Dart: one dart of fire at the target and a burn; Flame Wave's single-target answer. Char (tree) works on it.
      const t = this.nearestEnemies(p.x, p.y, 1, ALT_KIT.emberDartRange)[0];
      if (t === undefined) return;
      const e = this.enemies[t];
      p.facing = Math.atan2(e.y - p.y, e.x - p.x);
      const lance = this.lances.find((l) => !l.alive);
      if (lance) Object.assign(lance, { alive: true, x1: p.x, y1: p.y, x2: e.x, y2: e.y, life: 0.2 });
      this.damageEnemy(t, ALT_KIT.emberDartDamage * (1 + TREE.charWave * this.tree('char')) * this.dmgMult, true);
      if (e.alive) {
        e.burnDps = Math.max(e.burnDps, ALT_KIT.emberDartBurn * this.dmgMult);
        e.burnT = Math.max(e.burnT, ALT_KIT.emberDartBurnTime);
        e.burnBy = this.acting;
      }
      this.events.push({ type: 'ability', alt: true, hero: this.acting, slot, x: e.x, y: e.y, angle: p.facing, r: 30 });
      return;
    }
    if (id === 'whiteHeat') {
      // White Heat: a burst all around the Emberwright that throws the press back, and a tongue of it leaps to the
      // nearest big foe in reach (Combustion's job on elites and bosses).
      const r = ALT_KIT.whiteHeatRadius;
      const dmg = ALT_KIT.whiteHeatDamage * (1 + 0.2 * this.rank('heatSink')) * this.dmgMult;
      let big = -1;
      let bigD = ALT_KIT.whiteHeatLeap ** 2;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (!e.alive || e.def.rank === 'normal') continue;
        const d = dist2(p.x, p.y, e.x, e.y);
        if (d < bigD) { bigD = d; big = i; }
      }
      let bigHit = false;
      this.forEachNear(p.x, p.y, r + 40, (i) => {
        const e = this.enemies[i];
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > r + e.def.radius) return;
        if (e.def.rank === 'normal' && !e.def.stationary) {
          e.x += (dx / d) * ALT_KIT.whiteHeatShove;
          e.y += (dy / d) * ALT_KIT.whiteHeatShove;
        }
        if (i === big) bigHit = true;
        this.whiteHeatHit(i, dmg);
      });
      if (big >= 0 && !bigHit) {
        const e = this.enemies[big];
        const lance = this.lances.find((l) => !l.alive);
        if (lance) Object.assign(lance, { alive: true, x1: p.x, y1: p.y, x2: e.x, y2: e.y, life: 0.2 });
        this.whiteHeatHit(big, dmg);
      }
      this.events.push({ type: 'ability', alt: true, hero: this.acting, slot, x: p.x, y: p.y, angle: 0, r });
      return;
    }
    if (id === 'slagSpray') {
      // Slag Spray: a cone of molten slag at the foe in reach; everything it hits turns Brittle and small foes are
      // shoved back. The splashback plates the gunner thinly, so Coat, Blast and Glaze (tree) still count.
      const t = this.bladeTarget(ALT_KIT.sprayReach + 60);
      const ang = t >= 0 ? Math.atan2(this.enemies[t].y - p.y, this.enemies[t].x - p.x) : Math.hypot(input.x, input.y) > 0.01 ? Math.atan2(input.y, input.x) : p.facing;
      p.facing = ang;
      const r = ALT_KIT.sprayReach;
      const half = (ALT_KIT.sprayHalf * Math.PI) / 180;
      this.forEachNear(p.x, p.y, r + 40, (i) => {
        const e = this.enemies[i];
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > r + e.def.radius) return;
        if (Math.abs(angleDiff(Math.atan2(dy, dx), ang)) > half + e.def.radius / d) return;
        this.damageEnemy(i, ALT_KIT.sprayDamage * this.dmgMult, true);
        if (!e.alive) return;
        this.makeBrittle(i);
        if (e.def.rank === 'normal' && !e.def.stationary) {
          e.x += (dx / d) * ALT_KIT.sprayShove;
          e.y += (dy / d) * ALT_KIT.sprayShove;
          this.clampArena(e, e.def.radius);
        }
      });
      this.plate(this.acting, this.plateAmount * ALT_KIT.sprayPlate);
      this.events.push({ type: 'ability', alt: true, hero: this.acting, slot, x: p.x, y: p.y, angle: ang, r });
      return;
    }
    if (id === 'slagMortar') {
      // Slag Mortar: a heavy shell on the nearest big foe in reach (else the nearest foe); everything where it lands
      // takes the hit and turns Brittle, and small foes are stunned. Cooling Shell's damage answer.
      let t = -1;
      let best = ALT_KIT.mortarRange ** 2;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (!e.alive || e.def.rank === 'normal') continue;
        const d = dist2(p.x, p.y, e.x, e.y);
        if (d < best) { best = d; t = i; }
      }
      if (t < 0) t = this.nearestEnemies(p.x, p.y, 1, ALT_KIT.mortarRange)[0] ?? -1;
      if (t < 0) return;
      const x = this.enemies[t].x;
      const y = this.enemies[t].y;
      const r = ALT_KIT.mortarRadius;
      this.forEachNear(x, y, r + 40, (i) => {
        const e = this.enemies[i];
        if (dist2(x, y, e.x, e.y) > (r + e.def.radius) ** 2) return;
        this.damageEnemy(i, ALT_KIT.mortarDamage * this.dmgMult, true);
        if (!e.alive) return;
        this.makeBrittle(i);
        if (e.def.rank === 'normal' && !e.def.stationary) e.stunT = Math.max(e.stunT, ALT_KIT.mortarStun);
      });
      this.events.push({ type: 'ability', alt: true, hero: this.acting, slot, x, y, angle: 0, r });
      return;
    }
    if (id === 'clout') {
      // Clout: one heavy blow on the foe in front that mends the Bulwark. Rim Smash's pack answer, for one big foe.
      const t = this.bladeTarget(this.sweepReach + 40);
      if (t < 0) return;
      const e = this.enemies[t];
      p.facing = Math.atan2(e.y - p.y, e.x - p.x);
      if (this.threat.length) taunt(this.threat[t], this.heroes[this.acting].id);
      // The blow carries into foes pressed against the target (no stun on them); the mend counts everything it dealt.
      let dealt = 0;
      const sr = ALT_KIT.cloutSplashR;
      this.forEachNear(e.x, e.y, sr + 40, (i) => {
        const o = this.enemies[i];
        if (i !== t && dist2(e.x, e.y, o.x, o.y) > (sr + o.def.radius) ** 2) return;
        const hp0 = o.hp;
        this.damageEnemy(i, (i === t ? ALT_KIT.cloutDamage : ALT_KIT.cloutSplash) * this.dmgMult, true);
        dealt += Math.max(0, hp0 - Math.max(0, o.hp));
      });
      this.healPlayer(dealt * ALT_KIT.cloutMend);
      if (e.alive && !e.def.stationary) {
        e.stunT = Math.max(e.stunT, e.def.rank === 'normal' ? ALT_KIT.cloutStun : ALT_KIT.cloutStunBig);
        // Like Rim Smash, the blow shoves the foe back (big foes the most), so it can still steer them out of blooms.
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const push = e.def.rank === 'normal' ? 50 : e.def.rank === 'boss' ? 70 : 90;
        e.x += (dx / d) * push;
        e.y += (dy / d) * push;
        this.clampArena(e, e.def.radius);
      }
      this.events.push({ type: 'ability', alt: true, hero: this.acting, slot, x: e.x, y: e.y, angle: p.facing, r: 40 });
      return;
    }
    if (id === 'gather') {
      // Gather: drag the pack in to the shield and taunt it (big foes are taunted but not moved), and brace.
      const r = ALT_KIT.gatherRadius;
      p.gatherUntil = this.time + ALT_KIT.gatherTime;
      if (this.tree('onrush') > 0) p.onrushT = TREE.onrushTime;
      this.forEachNear(p.x, p.y, r + 40, (i) => {
        const e = this.enemies[i];
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > r + e.def.radius) return;
        if (this.threat.length) taunt(this.threat[i], this.heroes[this.acting].id);
        // Big foes are not moved, but are rocked like Charge's target (Foundry 8: 21 -> 23-24 of 40 with it).
        if (!e.def.stationary && e.def.rank !== 'normal') e.stunT = Math.max(e.stunT, ALT_KIT.gatherStunBig);
        if (e.def.stationary || e.def.rank !== 'normal' || e.named >= 0) return;
        const pull = Math.max(0, d - e.def.radius - PLAYER_RADIUS - 6);
        e.x -= (dx / d) * pull;
        e.y -= (dy / d) * pull;
        this.clampArena(e, e.def.radius);
      });
      // Like Charge, it builds Resolve for Anvil Skin.
      this.addHeat(ALT_KIT.gatherResolve);
      this.events.push({ type: 'ability', alt: true, hero: this.acting, slot, x: p.x, y: p.y, angle: 0, r });
      return;
    }
    if (this.cls === 'emberwright') {
      // Ember Mantle: a fire ward that stops blows; plateBy -1 marks it as not a Slagbinder's plating.
      p.plate = p.maxHp * ALT_KIT.emberWardShare;
      p.plateAmt = p.plate;
      p.plateUntil = this.time + ALT_KIT.emberWardTime;
      p.plateBy = -1;
      this.events.push({ type: 'ability', alt: true, hero: this.acting, slot: 1, x: p.x, y: p.y, angle: 0, r: 40 });
    } else if (this.cls === 'duskblade') {
      let t = this.bladeTarget(this.swingReach + 40);
      if (t < 0) t = this.nearestEnemies(p.x, p.y, 1, 220)[0] ?? -1;
      if (t < 0) return;
      const e = this.enemies[t];
      this.damageEnemy(t, ALT_KIT.hamstringDamage * this.dmgMult, true);
      // The cut bleeds like Rending Dash's, on the one foe it strikes.
      if (e.alive) {
        e.burnDps = Math.max(e.burnDps, ALT_KIT.hamstringBleed * this.bleedMult * this.dmgMult);
        e.burnT = Math.max(e.burnT, 4);
        e.burnBy = this.acting;
      }
      const r = ALT_KIT.hamstringRadius;
      this.forEachNear(e.x, e.y, r + 40, (i) => {
        const o = this.enemies[i];
        if (i !== t && dist2(e.x, e.y, o.x, o.y) > (r + o.def.radius) ** 2) return;
        this.slow(i, ALT_KIT.slowNormal, ALT_KIT.hamstringTime);
      });
      this.events.push({ type: 'ability', alt: true, hero: this.acting, slot: 0, x: e.x, y: e.y, angle: 0, r });
    } else if (this.cls === 'bulwark') {
      p.cryUntil = this.time + ALT_KIT.cryTime;
      for (let k = 0; k < this.heroes.length; k++) {
        if (k === this.acting) continue;
        const a = this.heroPlayer(k);
        if (a.hp > 0 && dist2(p.x, p.y, a.x, a.y) <= ALT_KIT.cryRadius ** 2) a.cryUntil = this.time + ALT_KIT.cryTime;
      }
      this.events.push({ type: 'ability', alt: true, hero: this.acting, slot: 2, x: p.x, y: p.y, angle: 0, r: ALT_KIT.cryRadius });
    } else if (this.cls === 'lumen') {
      p.wellUntil = this.time + ALT_KIT.wellTime;
      p.wellX = p.x;
      p.wellY = p.y;
      this.events.push({ type: 'ability', alt: true, hero: this.acting, slot: 1, x: p.x, y: p.y, angle: 0, r: ALT_KIT.wellRadius });
    } else if (this.cls === 'slagbinder') {
      const t = this.bladeTarget(ALT_KIT.pitRange);
      const ang = Math.hypot(input.x, input.y) > 0.01 ? Math.atan2(input.y, input.x) : p.facing;
      const x = t >= 0 ? this.enemies[t].x : p.x + Math.cos(ang) * 120;
      const y = t >= 0 ? this.enemies[t].y : p.y + Math.sin(ang) * 120;
      p.pitUntil = this.time + ALT_KIT.pitTime;
      p.pitX = x;
      p.pitY = y;
      this.addZone(x, y, ALT_KIT.pitRadius, ALT_KIT.pitDps * this.dmgMult, ALT_KIT.pitTime);
      this.events.push({ type: 'ability', alt: true, hero: this.acting, slot: 1, x, y, angle: 0, r: ALT_KIT.pitRadius });
    }
  }

  /** Slows foe i: `mult` for normal foes, at most ALT_KIT.slowBig for bosses, elites and named foes. */
  private slow(i: number, mult: number, time: number): void {
    const e = this.enemies[i];
    if (!e.alive || e.def.stationary) return;
    const m = e.def.rank === 'normal' && e.named < 0 ? mult : Math.min(mult, ALT_KIT.slowBig);
    e.slowMult = Math.max((e.slowUntil ?? 0) > this.time ? e.slowMult ?? 0 : 0, m);
    e.slowUntil = Math.max(e.slowUntil ?? 0, this.time + time);
  }

  /** Per-tick upkeep of the ability options: Muster's solo mend, Glow Pool, Cinder Sump's slow. */
  private updateAlt(dt: number): void {
    const p = this.player;
    if (!p.alts?.length) return;
    // Ember Mantle runs out (Slagbinder plating is cleared in updatePlates).
    if (p.plateBy === -1 && p.plateUntil !== undefined && (this.time >= p.plateUntil || (p.plate ?? 0) <= 0.01)) {
      p.plateUntil = undefined;
      p.plate = 0;
      p.plateAmt = 0;
      p.plateBy = undefined;
    }
    if (this.cls === 'bulwark' && this.heroes.length === 1 && (p.cryUntil ?? -1) > this.time) {
      this.healPlayer((p.maxHp * ALT_KIT.cryHeal * dt) / ALT_KIT.cryTime);
    }
    if (this.cls === 'lumen' && (p.wellUntil ?? -1) > this.time) {
      // Pulses twice a second, so heal events stay readable.
      p.wellT = (p.wellT ?? 0) + dt;
      if (p.wellT < 0.5) return;
      dt = p.wellT;
      p.wellT = 0;
      const x = p.wellX ?? p.x;
      const y = p.wellY ?? p.y;
      const r = ALT_KIT.wellRadius;
      if (dist2(p.x, p.y, x, y) <= r * r) this.healPlayer(ALT_KIT.wellHeal * dt);
      // Never clears Slag Grip or Ladle Burn (design: that stays Purify's and real heals' job).
      this.healAllies(x, y, r, ALT_KIT.wellHeal * dt, -1, false);
    }
    if (this.cls === 'slagbinder' && (p.pitUntil ?? -1) > this.time) {
      const x = p.pitX ?? p.x;
      const y = p.pitY ?? p.y;
      const r = ALT_KIT.pitRadius;
      this.forEachNear(x, y, r + 40, (i) => {
        const e = this.enemies[i];
        if (dist2(x, y, e.x, e.y) <= (r + e.def.radius) ** 2) this.slow(i, ALT_KIT.pitSlowNormal, 0.3);
      });
    }
  }

  // ---------------------------------------------------------------- slagbinder

  /** How long Brittle lasts from this hero. */
  private get brittleTime(): number {
    return (SLAG_KIT.brittleTime + 2 * this.rank('brittleMind') + TREE.flawTime * this.tree('flaw')) * (this.hasMythic('clinkerCrown') ? 2 : 1);
  }

  private makeBrittle(i: number): void {
    const e = this.enemies[i];
    if (!e || !e.alive) return;
    const fresh = (e.brittleUntil ?? 0) <= this.time;
    e.brittleUntil = Math.max(e.brittleUntil ?? 0, this.time + this.brittleTime);
    if (fresh) this.events.push({ type: 'brittle', x: e.x, y: e.y });
  }

  /** Whether a Slagbinder's Cooling Shell covers this hero (its own, or in a party one close by). */
  private shellCovers(q: Player): boolean {
    for (let k = 0; k < this.heroes.length; k++) {
      const h = this.heroPlayer(k);
      if ((h.shellUntil ?? -1) <= this.time || h.hp <= 0) continue;
      const r = SLAG_KIT.shellRadius + PARTY_CARDS.shellRadius * (this.heroes[k].talents.wideShell ?? 0);
      if (h === q || dist2(h.x, h.y, q.x, q.y) <= r * r) return true;
    }
    return false;
  }

  /** Lays plating worth `amount` on hero k, poured by the acting Slagbinder. */
  private plate(k: number, amount: number): void {
    const q = this.heroPlayer(k);
    if (q.hp <= 0) return;
    if (k !== this.acting) amount *= SLAG_KIT.allyPlate;
    // A fresh coat replaces the old one, so it never stacks past one plating.
    q.plate = amount;
    q.plateAmt = amount;
    q.plateUntil = this.time + SLAG_KIT.plateTime + this.rank('deepCoat');
    q.plateBy = this.acting;
    this.events.push({ type: 'plate', x: q.x, y: q.y, hero: k });
  }

  /** Plating that broke or ran out bursts around its wearer. */
  private updatePlates(): void {
    for (let k = 0; k < this.heroes.length; k++) {
      const q = this.heroPlayer(k);
      if (q.plateUntil === undefined || q.plateBy !== this.acting) continue;
      const broken = (q.plate ?? 0) <= 0.01;
      const done = this.time >= q.plateUntil;
      if (!broken && !done) continue;
      if (!broken && this.rank('everMolten') > 0) this.addHeat(SLAG_KIT.everMoltenRefund);
      // Your own plating that runs out unspent melts back into you (allies' plating doesn't).
      if (k === this.acting && (q.plate ?? 0) > 0) this.healPlayer((q.plate ?? 0) * SLAG_KIT.plateMend);
      q.plateUntil = undefined;
      q.plate = 0;
      q.plateAmt = 0;
      const r = (SLAG_KIT.plateBurstR + 15 * this.rank('wideSpatter')) * (this.hasMythic('moltenCore') ? 1.5 : 1);
      const dmg = SLAG_KIT.plateBurst * (1 + 0.3 * this.rank('searingShell') + 0.1 * this.rank('wideSpatter') + TREE.blastBurst * this.tree('blast')) * this.dmgMult;
      this.forEachNear(q.x, q.y, r + 40, (i) => {
        const e = this.enemies[i];
        if (dist2(q.x, q.y, e.x, e.y) <= (r + e.def.radius) ** 2) this.damageEnemy(i, dmg, true);
      });
      this.events.push({ type: 'explode', x: q.x, y: q.y, r });
    }
  }

  private get plateAmount(): number {
    const p = this.player;
    return p.maxHp * SLAG_KIT.plateShare * (1 + 0.2 * this.rank('thickPour') + 0.1 * this.rank('deepCoat') + TREE.coatPlate * this.tree('coat')) * (p.stance === 'anvil' ? SLAG_KIT.anvilPlate : 1);
  }

  /** The most hurt living ally (not the acting hero) within r, or -1. */
  private hurtAlly(r: number, skip = -1): number {
    const p = this.player;
    let best = -1;
    let bestShare = 2;
    for (let k = 0; k < this.heroes.length; k++) {
      if (k === this.acting || k === skip) continue;
      const a = this.heroPlayer(k);
      if (a.hp <= 0 || dist2(p.x, p.y, a.x, a.y) > r * r) continue;
      const share = a.hp / a.maxHp;
      if (share < bestShare) { bestShare = share; best = k; }
    }
    return best;
  }

  /** Molten Plating: on yourself solo; in a party, on the most hurt hero in reach (you included). */
  private moltenPlating(): void {
    const p = this.player;
    const amt = this.plateAmount;
    const twin = this.rank('twinPour') > 0;
    if (this.heroes.length === 1) {
      this.plate(this.acting, amt * (twin ? 1.5 : 1));
      return;
    }
    const wounded = this.woundedAlly(SLAG_KIT.plateRange);
    const first = wounded >= 0 ? wounded : this.acting;
    this.plate(first, amt);
    if (first !== this.acting && this.hasMythic('moltenCore')) this.plate(this.acting, amt * 0.5);
    if (twin) {
      // The second coat goes to whoever is next most hurt, you included.
      let second = -1;
      let share = 2;
      for (let k = 0; k < this.heroes.length; k++) {
        const q = this.heroPlayer(k);
        if (k === first || q.hp <= 0 || dist2(p.x, p.y, q.x, q.y) > SLAG_KIT.plateRange ** 2) continue;
        if (q.hp / q.maxHp < share) { share = q.hp / q.maxHp; second = k; }
      }
      if (second >= 0 && !(second === this.acting && first !== this.acting && this.hasMythic('moltenCore'))) this.plate(second, amt);
    }
  }

  /** Interpose: leap to the most hurt ally and cover them; solo (or no one to cover), a short leap. */
  private interpose(input: Input): void {
    const p = this.player;
    const x1 = p.x;
    const y1 = p.y;
    // The gunner's Recoil is always the self leap: it has no one to cover.
    const ally = this.heroes.length > 1 && !this.gunner ? this.hurtAlly(SLAG_KIT.interposeRange) : -1;
    if (ally >= 0) {
      const a = this.heroPlayer(ally);
      const dx = a.x - p.x;
      const dy = a.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const go = Math.max(0, d - 40);
      p.x += (dx / d) * go;
      p.y += (dy / d) * go;
      a.interposeUntil = this.time + SLAG_KIT.interposeTime + (p.stance === 'anvil' ? 0 : SLAG_KIT.bellowsInterpose) + PARTY_CARDS.standTime * this.rank('longStand');
      a.interposeBy = this.acting;
    } else {
      let ang: number;
      if (Math.hypot(input.x, input.y) > 0.01) ang = Math.atan2(input.y, input.x);
      else {
        const n = this.nearestEnemies(p.x, p.y, 1, 300)[0];
        ang = n !== undefined ? Math.atan2(p.y - this.enemies[n].y, p.x - this.enemies[n].x) : p.facing + Math.PI;
      }
      p.x += Math.cos(ang) * SLAG_KIT.interposeLeap;
      p.y += Math.sin(ang) * SLAG_KIT.interposeLeap;
    }
    this.clampArena(p, PLAYER_RADIUS);
    p.px = p.x;
    p.py = p.y;
    p.shieldT = Math.max(p.shieldT, 0.4);
    // Landing: small foes are shoved aside; Slag Tide turns it into a stunning wave.
    const tide = this.rank('slagTide') > 0;
    const r = tide ? SLAG_KIT.tideRadius : 90;
    this.forEachNear(p.x, p.y, r + 40, (i) => {
      const e = this.enemies[i];
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > r + e.def.radius) return;
      if (e.def.rank === 'normal' && !e.def.stationary) {
        e.x += (dx / d) * 60;
        e.y += (dy / d) * 60;
      }
      if (tide) {
        this.damageEnemy(i, SLAG_KIT.tideDamage * this.dmgMult, true);
        if (e.alive && !e.def.stationary) e.stunT = Math.max(e.stunT, SLAG_KIT.tideStun);
      }
    });
    this.events.push({ type: 'dash', x1, y1, x2: p.x, y2: p.y, dodge: true });
  }

  /** Cooling Shell: the Slagbinder hardens; in a party it covers heroes close by. */
  private coolingShell(): void {
    const p = this.player;
    p.shellUntil = this.time + SLAG_KIT.shellTime + this.rank('hardened') + (p.stance === 'anvil' ? SLAG_KIT.anvilShell : 0);
    this.events.push({ type: 'ability', slot: 2, x: p.x, y: p.y, angle: 0, r: this.heroes.length > 1 ? SLAG_KIT.shellRadius + PARTY_CARDS.shellRadius * this.rank('wideShell') : 50 });
  }

  /** Co-op Clinker with nothing to interrupt: the boss goes Brittle, and an Anvil takes it back. */
  private clinkerBoss(): boolean {
    const b = this.bossIndex;
    if (b < 0 || !this.enemies[b].alive) return false;
    const e = this.enemies[b];
    const p = this.player;
    if (dist2(p.x, p.y, e.x, e.y) > (this.classDef.interruptRange + e.def.radius) ** 2) return false;
    this.makeBrittle(b);
    if (p.stance === 'anvil' && this.threat[b]) taunt(this.threat[b], this.heroes[this.acting].id);
    this.damageEnemy(b, 30 * this.dmgMult, true);
    if (this.hasMythic('clinkerCrown')) this.crownBounce(b);
    this.events.push({ type: 'ability', slot: 3, x: e.x, y: e.y, angle: 0, r: 40 });
    return true;
  }

  /** Clinker Crown: the clinker bounces on to the nearest other foe and cracks it. */
  private crownBounce(from: number): void {
    const e = this.enemies[from];
    const n = this.nearestEnemies(e.x, e.y, 2, 300).find((j) => j !== from);
    if (n === undefined) return;
    this.damageEnemy(n, 30 * this.dmgMult, true);
    this.makeBrittle(n);
  }

  /** Slag Lob, the basic attack: a glob on the nearest foe that splashes around it. Also ticks plating. */
  private updateSlag(dt: number): void {
    const p = this.player;
    this.updatePlates();
    p.volleyT -= dt;
    // Charged shot: the cannon holds its fire while it charges.
    if (this.gunner && (p.holdSlot ?? -1) === 0) {
      p.volleyT = Math.max(0, p.volleyT);
      return;
    }
    if (p.volleyT > 0) return;
    const range = this.gunner ? SLAG_KIT.cannonRange : SLAG_KIT.lobRange;
    let t = this.bladeTarget(range);
    if (t < 0) {
      p.volleyT = 0;
      return;
    }
    if (this.bossIndex >= 0) {
      const boss = this.enemies[this.bossIndex];
      if (boss.alive && boss.def.rank === 'boss' && dist2(p.x, p.y, boss.x, boss.y) < (range + boss.def.radius) ** 2) t = this.bossIndex;
      if (this.crawIn(range) >= 0) t = this.crawIn(range);
      // As with Sunmote: an acolyte healing a wounded boss is struck first.
      if (boss.alive && boss.hp < boss.maxHp) {
        let best = (range + 40) ** 2;
        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i];
          if (!e.alive || e.kind !== 'acolyte' || e.aux2 !== this.bossIndex) continue;
          const d2 = dist2(p.x, p.y, e.x, e.y);
          if (d2 < best) { best = d2; t = i; }
        }
      }
    }
    p.volleyT += (this.gunner ? SLAG_KIT.cannonEvery : SLAG_KIT.lobEvery) / this.loadout.hasteMult / (1 + 0.1 * this.rank('fastLadle')) / (1 + TREE.reloadHaste * this.tree('reload'));
    if (p.volleyT < 0) p.volleyT = 0;
    p.lobs = (p.lobs ?? 0) + 1;
    if (this.gunner) {
      // The gunner: one heavy Cannon shot. Cinder Hail's every-4th volley adds a splashing lob at the target; Shatterpoint still makes it Brittle.
      this.cannon(t);
      if (this.rank('shatterpoint') > 0 && p.lobs % SLAG_KIT.hailEvery === 0 && this.enemies[t].alive) this.makeBrittle(t);
      if (this.rank('cinderHail') > 0 && p.lobs % SLAG_KIT.hailEvery === 0 && this.enemies[t].alive) this.lob(t);
      return;
    }
    const hail = this.rank('cinderHail') > 0 && p.lobs % SLAG_KIT.hailEvery === 0;
    this.lob(t);
    if (this.rank('shatterpoint') > 0 && p.lobs % SLAG_KIT.hailEvery === 0) this.makeBrittle(t);
    if (hail) {
      const e = this.enemies[t];
      for (const j of this.nearestEnemies(e.x, e.y, 3, 220)) if (j !== t && this.enemies[j].alive) this.lob(j);
      if (this.enemies[t].alive) this.lob(t);
    }
  }

  /**
   * Cannon (the gunner's basic attack): a slow heavy shot at `t` that carries on in a straight line to cannonRange,
   * hitting every foe it passes through for cannonPierce of its damage. Heavy Lob, Shatterpoint and Clinging Slag apply.
   */
  private cannon(t: number, k = 1, pierce: number = SLAG_KIT.cannonPierce, shatter = false): void {
    const p = this.player;
    const e = this.enemies[t];
    const ang = Math.atan2(e.y - p.y, e.x - p.x);
    p.facing = ang;
    const hits: number[] = [t];
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const L = SLAG_KIT.cannonRange;
    this.events.push({ type: 'cannon', x1: p.x, y1: p.y, x2: p.x + ux * L, y2: p.y + uy * L });
    const brittle = (e.brittleUntil ?? 0) > this.time;
    const mult = (1 + 0.3 * this.rank('heavyLob')) * (brittle && this.rank('shatterpoint') > 0 ? SLAG_KIT.shatterMult : 1);
    const base = SLAG_KIT.cannonDamage * (1 + TREE.boreCannon * this.tree('bore')) * this.dmgMult;
    const dmg = base * mult * k;
    this.damageEnemy(t, dmg, true);
    this.addHeat(SLAG_KIT.cannonSlag + 3 * this.rank('denseGlob') + (brittle && this.hasWeaponFx('temperedLob') ? 3 : 0));
    if (e.alive && this.hasWeaponFx('clingingSlag')) {
      e.burnDps = Math.max(e.burnDps, 6 * this.dmgMult);
      e.burnT = Math.max(e.burnT, 2);
      e.burnBy = this.acting;
    }
    // The shot carries on through the line: everything else it passes takes part of the hit.
    const mx = p.x + ux * L * 0.5;
    const my = p.y + uy * L * 0.5;
    this.forEachNear(mx, my, L * 0.5 + 60, (j) => {
      if (j === t) return;
      const o = this.enemies[j];
      const along = (o.x - p.x) * ux + (o.y - p.y) * uy;
      if (along < 0 || along > L) return;
      const off = Math.abs((o.x - p.x) * uy - (o.y - p.y) * ux);
      if (off <= SLAG_KIT.cannonWidth + o.def.radius) {
        hits.push(j);
        this.damageEnemy(j, dmg * pierce, false, true);
      }
    });
    if (!shatter) return;
    // A full charged shot shatters every Brittle foe it went through.
    for (const j of hits) {
      const o = this.enemies[j];
      if ((o.brittleUntil ?? 0) <= this.time) continue;
      o.brittleUntil = 0;
      const sx = o.x, sy = o.y;
      this.forEachNear(sx, sy, CHARGE.shatterR + 60, (m) => {
        const q = this.enemies[m];
        if (q.alive && dist2(sx, sy, q.x, q.y) <= (CHARGE.shatterR + q.def.radius) ** 2) this.damageEnemy(m, base * CHARGE.shatter, false, true);
      });
      this.events.push({ type: 'shatter', x: sx, y: sy, hero: this.acting });
    }
  }

  /** Charged shot (CHARGE): the gunner releases Q, charged `c` (0-1), at its target (the boss first, as its cannon does). */
  private chargedShot(c: number): void {
    const p = this.player;
    let t = this.bladeTarget(SLAG_KIT.cannonRange);
    if (this.bossIndex >= 0) {
      const boss = this.enemies[this.bossIndex];
      if (boss.alive && boss.def.rank === 'boss' && dist2(p.x, p.y, boss.x, boss.y) < (SLAG_KIT.cannonRange + boss.def.radius) ** 2) t = this.bossIndex;
    }
    if (t < 0) return;
    const e = this.enemies[t];
    const ang = Math.atan2(e.y - p.y, e.x - p.x);
    const L = SLAG_KIT.cannonRange;
    this.events.push({ type: 'chargedShot', x1: p.x, y1: p.y, x2: p.x + Math.cos(ang) * L, y2: p.y + Math.sin(ang) * L, c, hero: this.acting });
    this.cannon(t, 1 + (CHARGE.mult - 1) * c, SLAG_KIT.cannonPierce + (1 - SLAG_KIT.cannonPierce) * c, c >= 1);
    this.addHeat(CHARGE.slag * c);
    // The next plain shot comes a full reload later.
    p.volleyT = Math.max(p.volleyT, SLAG_KIT.cannonEvery / this.loadout.hasteMult);
  }

  private lob(t: number): void {
    const p = this.player;
    const e = this.enemies[t];
    p.facing = Math.atan2(e.y - p.y, e.x - p.x);
    this.events.push({ type: 'lob', x1: p.x, y1: p.y, x2: e.x, y2: e.y });
    const brittle = (e.brittleUntil ?? 0) > this.time;
    const mult = (1 + 0.3 * this.rank('heavyLob')) * (brittle && this.rank('shatterpoint') > 0 ? SLAG_KIT.shatterMult : 1);
    this.damageEnemy(t, SLAG_KIT.lobDamage * mult * this.dmgMult, true);
    this.addHeat(SLAG_KIT.lobSlag + 3 * this.rank('denseGlob') + (brittle && this.hasWeaponFx('temperedLob') ? 3 : 0));
    if (e.alive && this.hasWeaponFx('clingingSlag')) {
      e.burnDps = Math.max(e.burnDps, 6 * this.dmgMult);
      e.burnT = Math.max(e.burnT, 2);
      e.burnBy = this.acting;
    }
    const r = SLAG_KIT.lobSplashR + 15 * this.rank('shrapnel');
    const splash = SLAG_KIT.lobSplash * (1 + 0.3 * this.rank('shrapnel')) * mult * this.dmgMult;
    this.forEachNear(e.x, e.y, r + 40, (j) => {
      if (j === t) return;
      const o = this.enemies[j];
      if (dist2(e.x, e.y, o.x, o.y) <= (r + o.def.radius) ** 2) this.damageEnemy(j, splash, false, true);
    });
  }

  // ---------------------------------------------------------------- lumen

  /** Heals the hero. For the Lumen, overhealing is stored as Brilliance, which powers its damage. */
  /** Healing an enemy receives: Open Wounds halves it. */
  private healTakenMult(e: Enemy): number {
    return e.woundT > 0 ? 0.5 : 1;
  }

  /** Lumen: Lantern Heart raises the Brilliance cap. */
  get maxBrilliance(): number {
    return LUMEN_MAX_BRILLIANCE + 30 * this.rank('lanternHeart');
  }
  /** Lumen: Long Note stretches the reach of Sunmotes and the Sunbeam. */
  get lumenRange(): number {
    return LUMEN_RANGE + 40 * this.rank('longNote');
  }

  healPlayer(amount: number): number {
    const p = this.player;
    if (this.cls === 'lumen') amount *= (1 + 0.1 * this.rank('lampglowCare')) * (1 + TREE.tendHeal * this.tree('tend'));
    const eff = Math.max(0, Math.min(p.maxHp - p.hp, amount));
    p.hp += eff;
    // Co-op: effective healing draws threat, split across the living enemies.
    if (this.threat.length && eff > 0) healThreat(this.threat.filter((_, i) => this.enemies[i].alive), this.heroes[this.acting].id, eff);
    if (this.cls === 'lumen') {
      const over = amount - eff;
      if (over > 0) p.brilliance = Math.min(this.maxBrilliance, p.brilliance + over * (1 + 0.3 * this.rank('kindledLight')));
    }
    return eff;
  }

  /**
   * Co-op: heals every other living hero within `r` of (x, y). Effective healing draws
   * threat for the healer, like self-healing; the Lumen banks overheal as Brilliance.
   * `only` limits it to one hero. Solo it does nothing.
   */
  healAllies(x: number, y: number, r: number, amount: number, only = -1, cleanse = true): number {
    if (this.heroes.length === 1) return 0;
    const p = this.player;
    if (this.cls === 'lumen') amount *= (1 + 0.1 * this.rank('lampglowCare')) * (1 + TREE.tendHeal * this.tree('tend'));
    let total = 0;
    let over = 0;
    const tank = this.rank('frontMend') > 0 ? this.bossTarget : -1;
    for (let k = 0; k < this.heroes.length; k++) {
      if (k === this.acting || (only >= 0 && k !== only)) continue;
      const a = this.heroes[k].player;
      if (a.hp <= 0 || dist2(x, y, a.x, a.y) > r * r) continue;
      // Front Mend (party card): heals on the hero the boss is attacking land stronger.
      const amt = k === tank ? amount * (1 + PARTY_CARDS.frontMend * this.rank('frontMend')) : amount;
      const eff = Math.max(0, Math.min(a.maxHp - a.hp, amt));
      a.hp += eff;
      total += eff;
      // Slag Grip: only another hero's heal can loosen it.
      if (cleanse && amount > 0 && (a.slag ?? 0) > 0) {
        a.slag = 0;
        this.events.push({ type: 'cleanse', x: a.x, y: a.y });
      }
      over += amt - eff;
      if (eff > 0) {
        this.events.push({ type: 'heal', x: a.x, y: a.y, amount: eff });
        this.kinCover(k);
      }
    }
    if (this.threat.length && total > 0) healThreat(this.threat.filter((_, i) => this.enemies[i].alive), this.heroes[this.acting].id, total);
    if (this.cls === 'lumen' && over > 0) p.brilliance = Math.min(this.maxBrilliance, p.brilliance + over * (1 + 0.3 * this.rank('kindledLight')));
    return total;
  }

  /** Co-op: the living hero within `r` with the lowest share of health, or -1 when that's the acting hero. */
  private woundedAlly(r: number): number {
    if (this.heroes.length === 1) return -1;
    const p = this.player;
    let best = -1;
    let bestShare = p.hp / p.maxHp;
    for (let k = 0; k < this.heroes.length; k++) {
      if (k === this.acting) continue;
      const a = this.heroes[k].player;
      if (a.hp <= 0 || dist2(p.x, p.y, a.x, a.y) > r * r) continue;
      const share = a.hp / a.maxHp;
      if (share < bestShare) { bestShare = share; best = k; }
    }
    return best;
  }

  get moteCooldown(): number {
    return (0.7 * Math.pow(0.88, this.rank('hastedHymn'))) / this.loadout.hasteMult / (1 + TREE.liltHaste * this.tree('lilt'));
  }
  get burstRadius(): number {
    return (140 + 40 * this.rank('sunflare')) * (this.hasMythic('eclipseGlass') ? 1.1 : 1);
  }
  get sanctuaryRadius(): number {
    return 150;
  }

  private updateLight(dt: number): void {
    const p = this.player;
    // Sanctuary: hallowed ground that heals the Lumen and burns foes, in half-second pulses.
    if (p.sanctT > 0) {
      p.sanctT -= dt;
      if (this.rank('lingeringSanctuary') > 0 && !this.hasMythic('anchoredDawn')) {
        p.sanctX = p.x;
        p.sanctY = p.y;
      }
      p.sanctTick -= dt;
      if (p.sanctTick <= 0) {
        p.sanctTick += 0.5;
        const r = this.sanctuaryRadius;
        if (p.canopy) {
          // Canopy: no heal; every hero under it takes less until the next pulse.
          for (let k = 0; k < this.heroes.length; k++) {
            const a = k === this.acting ? p : this.heroes[k].player;
            if (a.hp > 0 && dist2(a.x, a.y, p.sanctX, p.sanctY) <= r * r) a.canopyUntil = this.time + 0.6;
          }
        } else {
          if (dist2(p.x, p.y, p.sanctX, p.sanctY) <= r * r) this.healPlayer(2);
          this.healAllies(p.sanctX, p.sanctY, r, 2);
        }
        const burn = p.canopy ? ALT_KIT.canopyBurn : 1;
        this.forEachNear(p.sanctX, p.sanctY, r + 40, (i) => {
          const e = this.enemies[i];
          if (dist2(p.sanctX, p.sanctY, e.x, e.y) <= (r + e.def.radius) ** 2) this.damageEnemy(i, 10 * burn * (1 + 0.5 * this.rank('hallowedEmbers')) * (1 + TREE.verseBurn * this.tree('verse')) * this.dmgMult, false, true);
        });
      }
    }
    if (p.poolT > 0) {
      p.poolT -= dt;
      if (dist2(p.x, p.y, p.poolX, p.poolY) <= 70 * 70) this.healPlayer(5 * this.rank('blessedGround') * dt);
      this.healAllies(p.poolX, p.poolY, 70, 5 * this.rank('blessedGround') * dt);
    }
    if (this.rank('noon') > 0) {
      p.noonT -= dt;
      if (p.noonT <= 0) {
        p.noonT = LUMEN_CAPS.noonEvery;
        if (this.bladeTarget(this.lumenRange) >= 0) this.sunbeam();
      }
    }
    this.updateOrbit(dt);
    p.volleyT -= dt;
    if (p.volleyT > 0) return;
    let t = this.bladeTarget(this.lumenRange);
    if (t < 0) {
      p.volleyT = 0;
      return;
    }
    // Bosses pull focus, as they do for the Emberwright's orbs.
    if (this.bossIndex >= 0) {
      const boss = this.enemies[this.bossIndex];
      if (boss.alive && boss.def.rank === 'boss' && !(this.kmStage === 2 && boss.kind === 'kilnMother') && dist2(p.x, p.y, boss.x, boss.y) < this.lumenRange * this.lumenRange) t = this.bossIndex;
      if (this.crawIn(this.lumenRange) >= 0) t = this.crawIn(this.lumenRange);
    }
    // Sunmote is a single bolt with no spread, so unlike orbs or swings it never touches the
    // acolytes on its own: light seeks out an acolyte that is healing a wounded boss first.
    if (this.bossIndex >= 0) {
      const boss = this.enemies[this.bossIndex];
      if (boss.alive && boss.hp < boss.maxHp) {
        let best = this.lumenRange * this.lumenRange;
        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i];
          if (!e.alive || e.kind !== 'acolyte' || e.aux2 !== this.bossIndex) continue;
          const d2 = dist2(p.x, p.y, e.x, e.y);
          if (d2 < best) { best = d2; t = i; }
        }
      }
    }
    p.volleyT += this.moteCooldown;
    if (p.volleyT < 0) p.volleyT = 0;
    this.sunmote(t);
  }

  /** Sunmote: an instant bolt of light that heals the Lumen a little and spends Brilliance for extra damage. */
  private sunmote(t: number): void {
    const p = this.player;
    const bonus = Math.min(p.brilliance, 10);
    p.brilliance -= bonus;
    const dmg = (22 * (1 + 0.15 * this.rank('searingRadiance') + 0.1 * this.rank('lanternHeart') + 0.1 * this.rank('longNote')) + bonus) * (1 + TREE.shineMote * this.tree('shine')) * this.dmgMult;
    const hit = (i: number, k: number) => {
      const e = this.enemies[i];
      this.events.push({ type: 'mote', x1: p.x, y1: p.y, x2: e.x, y2: e.y });
      const noonfire = e.def.rank !== 'normal' && this.rank('noonfire') > 0 ? CAPSTONES_2.noonfireMult : 1;
      this.damageEnemy(i, dmg * k * noonfire * (e.castId && this.hasWeaponFx('rebukingLight') ? 1.25 : 1), true);
      this.addHeat(3);
      // Co-op: the mote's heal goes to whoever is lowest on health nearby, the Lumen included.
      const ally = this.woundedAlly(this.lumenRange);
      const who = ally >= 0 ? this.heroes[ally].player : p;
      // Tender Light: double on a hero below half health.
      const heal = SUNMOTE_HEAL * (who.hp < who.maxHp * 0.5 && this.hasWeaponFx('tenderLight') ? 2 : 1);
      if (ally >= 0) this.healAllies(who.x, who.y, 1, heal, ally);
      else this.healPlayer(heal);
    };
    const e0 = this.enemies[t];
    p.facing = Math.atan2(e0.y - p.y, e0.x - p.x);
    hit(t, 1);
    // Light motes: every few Sunmote hits drop a mote of light at the Lumen's side of the foe.
    p.moteHits = (p.moteHits ?? 0) + 1;
    if (p.moteHits % LIGHT_MOTE.every === 0) {
      const d = Math.max(1, Math.sqrt(dist2(p.x, p.y, e0.x, e0.y)));
      const off = Math.min(d * 0.5, e0.def.radius + 16);
      const x = e0.x + ((p.x - e0.x) / d) * off, y = e0.y + ((p.y - e0.y) / d) * off;
      if (this.lightMotes.length >= LIGHT_MOTE.cap) this.lightMotes.shift();
      this.lightMotes.push({ x, y, t: LIGHT_MOTE.life, by: this.acting });
      this.events.push({ type: 'lightMote', x, y });
    }
    // Chorus: every few Sunmotes, the target is struck a second time.
    if (this.rank('chorus') > 0) {
      p.motesFired = (p.motesFired ?? 0) + 1;
      if (p.motesFired % CAPSTONES_2.chorusEvery === 0 && e0.alive) hit(t, 1);
    }
    const extra = this.rank('prism');
    if (extra > 0) {
      for (const j of this.nearestEnemies(e0.x, e0.y, extra + 1, 260)) if (j !== t && this.enemies[j].alive) hit(j, 0.6);
    }
  }

  /** High Noon: all stored Brilliance at once, as a piercing beam. */
  private sunbeam(): void {
    const p = this.player;
    const t = this.bladeTarget(this.lumenRange);
    const ang = t >= 0 ? Math.atan2(this.enemies[t].y - p.y, this.enemies[t].x - p.x) : p.facing;
    const x2 = p.x + Math.cos(ang) * 520;
    const y2 = p.y + Math.sin(ang) * 520;
    const lance = this.lances.find((l) => !l.alive);
    if (lance) Object.assign(lance, { alive: true, x1: p.x, y1: p.y, x2, y2, life: 0.25 });
    const dmg = (LUMEN_CAPS.noonBase + p.brilliance * LUMEN_CAPS.noonPer) * this.dmgMult;
    p.brilliance = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.alive && segDist2(e.x, e.y, p.x, p.y, x2, y2) <= (14 + e.def.radius) ** 2) this.damageEnemy(i, dmg, true);
    }
  }

  private radiantBurst(): void {
    const p = this.player;
    const eclipse = this.hasMythic('eclipseGlass');
    const burstHeal = (eclipse ? 7.5 : 15) * (1 + 0.1 * this.rank('daybreakPulse'));
    this.healPlayer(burstHeal);
    this.healAllies(p.x, p.y, this.burstRadius, burstHeal * (1 + PARTY_CARDS.wideDawn * this.rank('wideDawn')));
    const aegis = this.rank('aegisOfLight');
    if (aegis > 0) p.ward = Math.max(p.ward, p.maxHp * 0.08 * aegis);
    const r = this.burstRadius;
    const dmg = 40 * (1 + 0.5 * this.rank('sunflare')) * (1 + TREE.pulseBurst * this.tree('pulse')) * this.dmgMult * (eclipse ? 1.4 : 1);
    this.forEachNear(p.x, p.y, r + 40, (i) => {
      const e = this.enemies[i];
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > r + e.def.radius) return;
      if (e.def.rank === 'normal' && !e.def.stationary) {
        e.x += (dx / d) * 40;
        e.y += (dy / d) * 40;
      }
      this.damageEnemy(i, dmg, true);
    });
    // Reaching Light: the burn also reaches Ember Spitters keeping their distance.
    const reach = this.rank('reachingLight');
    if (reach > 0) {
      const far = SITE_CARDS.reachBase + SITE_CARDS.reachPerRank * reach;
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (!e.alive || e.kind !== 'emberSpitter') continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d > r + e.def.radius && d <= far + e.def.radius) this.damageEnemy(i, dmg, true);
      }
    }
    this.events.push({ type: 'ability', slot: 0, x: p.x, y: p.y, angle: 0, r });
  }

  private glimmerStep(input: Input): void {
    const p = this.player;
    const moving = Math.hypot(input.x, input.y) > 0.01;
    const ang = moving ? Math.atan2(input.y, input.x) : p.facing;
    const x1 = p.x;
    const y1 = p.y;
    p.x += Math.cos(ang) * 160;
    p.y += Math.sin(ang) * 160;
    this.clampArena(p, PLAYER_RADIUS);
    p.px = p.x;
    p.py = p.y;
    p.shieldT = Math.max(p.shieldT, 0.3);
    if (this.rank('blessedGround') > 0) {
      p.poolT = 4;
      p.poolX = p.x;
      p.poolY = p.y;
    }
    this.events.push({ type: 'blink', x1, y1, x2: p.x, y2: p.y });
  }

  private sanctuary(canopy = false): void {
    const p = this.player;
    p.canopy = canopy;
    p.sanctT = (6 + 2 * this.rank('lingeringSanctuary')) * (this.hasMythic('anchoredDawn') ? 1.5 : 1);
    p.sanctX = p.x;
    p.sanctY = p.y;
    p.sanctTick = 0;
    this.events.push({ type: 'ability', ...(canopy ? { alt: true, hero: this.acting } : {}), slot: 2, x: p.x, y: p.y, angle: 0, r: this.sanctuaryRadius });
  }

  // ---------------------------------------------------------------- bulwark

  get sweepCooldown(): number {
    return 0.8 / this.loadout.hasteMult / (1 + 0.08 * this.rank('broadShoulders'));
  }
  get sweepReach(): number {
    return 95 + 15 * this.rank('wideSweep');
  }
  /** Half of Shield Sweep's arc, in radians: 150 degrees, 250 at rank 1, a full circle at rank 2. */
  get sweepHalfArc(): number {
    const r = this.rank('wideSweep');
    return r >= 2 ? Math.PI : ((r === 1 ? 250 : 150) * Math.PI) / 360;
  }
  get damageTakenMult(): number {
    const p = this.player;
    const armor = 1 - (BULWARK_ARMOR + 0.04 * this.rank('holdTheLine') + 0.05 * this.rank('rivetedPlates'));
    const stone = this.rank('backToStone');
    const guard = stone > 0 && this.nearStone(p) ? 1 - (this.dungeonId === 'glarewell' ? SITE_CARDS.glareStoneDr : SITE_CARDS.stoneDr) * stone : 1;
    const tree = (1 - TREE.braceCut * this.tree('brace')) * ((p.onrushT ?? 0) > 0 ? 1 - TREE.onrushCut : 1);
    return armor * (p.bastionT > 0 ? 0.4 : 1) * guard * tree;
  }

  /** Armor, Anvil Skin, the Ward shield, Resolve gain, and damage turned back. Returns what gets through. */
  /**
   * Melee forgiveness for new heroes: 1 at tier 1, fading to 0 by tier 4, so the
   * first-impression tiers forgive slow reactions and the geared tiers are untouched.
   */
  get noviceAid(): number {
    return Math.max(0, 1 - (this.tier - 1) / 3);
  }

  /** Grit Guard: the extra block a run on Grit gets from GRIT_GUARD.fromTier (0 below it or with no Grit). */
  get gritGuard(): number {
    if (this.tier < GRIT_GUARD.fromTier) return 0;
    return Math.min(GRIT_GUARD.cap, GRIT_GUARD.perStack * Math.min(GRIT.maxStacks, this.grit));
  }

  /** Grit Cut: the share of each hit a non-Duskblade run on Grit sheds from GRIT_CUT.fromTier (0 below it or with no Grit). */
  get gritCut(): number {
    if (this.tier < GRIT_CUT.fromTier || this.cls === 'duskblade') return 0;
    return GRIT_CUT.perStack * Math.min(GRIT.maxStacks, this.grit);
  }

  /** True while bulwarkMitigate is turning a hit back (see there). */
  private turningBack = false;

  private bulwarkMitigate(raw: number, src: number): number {
    const p = this.player;
    this.addHeat(raw * 0.2 * (1 + 0.25 * this.rank('grimTally')));
    let amount = raw * this.damageTakenMult;
    // Shield Block: the foe the shield faces lands only part of its hits.
    if (this.hasMythic('ringwallVow')) {
      // Ringwall Vow: a lighter block, on every side.
      if (src >= 0) amount *= 1 - RINGWALL_BLOCK;
    } else if (src >= 0 && src === p.guardId) amount *= 1 - BULWARK_BLOCK;
    if (p.bastionT > 0) p.prevented += raw - amount;
    if (p.ward > 0) {
      const soak = Math.min(p.ward, amount);
      p.ward -= soak;
      amount -= soak;
    }
    let back = 0;
    if (src >= 0 && this.rank('spikedShield') > 0) back += 8 * this.rank('spikedShield') * this.dmgMult;
    // Character tree: Barbs pays every attacker back; Kickback marks it for a harder hit.
    if (src >= 0) {
      back += TREE.barbsDamage * this.tree('barbs') * this.dmgMult;
      if (this.tree('kickback') > 0) { this.enemies[src].struckBy = this.acting; this.enemies[src].struckAt = this.time; }
    }
    // Anvil Skin turns back a quarter of each hit (Payback adds to it); Thornwall turns back 15% even outside it, and
    // Bristle 10% while Resolve is at half or more.
    const reflect = (p.bastionT > 0 ? 0.25 + TREE.paybackReflect * this.tree('payback') : 0) + (this.rank('thornwall') > 0 ? CAPSTONES_2.thornReflect : 0)
      + (this.tree('bristle') > 0 && p.heat >= TREE.bristleResolve ? TREE.bristleReflect : 0);
    back += raw * reflect * this.dmgMult;
    // A hit that comes back while the Bulwark is turning one back (a Glass Warden's Mirror Ward)
    // is taken but not turned back again: otherwise the two bounce it forever and the sim never returns.
    if (back > 0 && !this.turningBack) {
      this.turningBack = true;
      try {
        const t = src >= 0 && this.enemies[src].alive ? src : (this.nearestEnemies(p.x, p.y, 1, 200)[0] ?? -1);
        if (t >= 0) this.damageEnemy(t, back, false);
        if (this.rank('thornwall') > 0) {
          // Thornwall: what is turned back hits everything around the Bulwark.
          this.forEachNear(p.x, p.y, 140, (i) => {
            const e = this.enemies[i];
            if (i === t || dist2(p.x, p.y, e.x, e.y) > (120 + e.def.radius) ** 2) return;
            this.damageEnemy(i, back, false, true);
          });
        }
      } finally {
        this.turningBack = false;
      }
    }
    return amount;
  }

  private updateShield(dt: number): void {
    const p = this.player;
    const ward = this.rank('ward');
    if (ward > 0) {
      p.wardT -= dt;
      if (p.wardT <= 0) {
        p.wardT = 8;
        p.ward = Math.max(p.ward, p.maxHp * 0.08 * ward);
      }
    }
    if ((p.onrushT ?? 0) > 0) p.onrushT = (p.onrushT ?? 0) - dt;
    if (p.bastionT > 0) {
      p.bastionT -= dt;
      if (p.bastionT <= 0 && this.rank('unbreakable') > 0 && p.prevented > 0) {
        // Unbreakable: everything Anvil Skin stopped comes back out at once.
        const dmg = Math.max(60, p.prevented * 2) * this.dmgMult;
        this.forEachNear(p.x, p.y, 200, (i) => {
          const e = this.enemies[i];
          if (dist2(p.x, p.y, e.x, e.y) <= (170 + e.def.radius) ** 2) this.damageEnemy(i, dmg, true);
        });
        this.events.push({ type: 'explode', x: p.x, y: p.y, r: 170 });
      }
    }
    if (p.echoT > 0) {
      p.echoT -= dt;
      if (p.echoT <= 0) this.slamCone(p.echoAng, 0.5, false);
    }
    p.volleyT -= dt;
    if (p.volleyT > 0) return;
    const t = this.bladeTarget(this.sweepReach + 20);
    if (t < 0) {
      p.volleyT = 0;
      return;
    }
    p.volleyT += this.sweepCooldown;
    if (p.volleyT < 0) p.volleyT = 0;
    this.shieldSweep(t);
  }

  private shieldSweep(t: number): void {
    const p = this.player;
    const e0 = this.enemies[t];
    const ang = Math.atan2(e0.y - p.y, e0.x - p.x);
    p.facing = ang;
    p.guardId = t;
    p.guardAng = ang;
    p.swings++;
    const r = this.sweepReach;
    const half = this.sweepHalfArc;
    // Thornwall: while Anvil Skin is up, the shield bites far harder.
    const dmg = 30 * this.dmgMult * (this.rank('thornwall') > 0 && p.bastionT > 0 ? CAPSTONES_2.thornSkin : 1);
    let hits = 0;
    let big = false;
    this.forEachNear(p.x, p.y, r + 40, (i) => {
      const e = this.enemies[i];
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > r + e.def.radius) return;
      if (half < Math.PI && Math.abs(angleDiff(Math.atan2(dy, dx), ang)) > half + e.def.radius / d) return;
      hits++;
      if (e.def.rank === 'normal' && !e.def.stationary) {
        e.x += (dx / d) * 22;
        e.y += (dy / d) * 22;
      }
      // The shield lands hardest on big foes: elites and bosses take more from each sweep.
      if (e.def.rank !== 'normal') big = true;
      this.damageEnemy(i, e.def.rank === 'normal' ? dmg : dmg * SWEEP_BIG_MULT, true);
    });
    this.addHeat(Math.min(12, 3 * hits));
    if (hits > 1 && this.hasWeaponFx('rallyingSweep')) this.addHeat(2 * (hits - 1));
    if (big && this.hasWeaponFx('wardingSweep')) p.ward = Math.min(p.maxHp * 0.2, p.ward + p.maxHp * 0.015);
    this.events.push({ type: 'swing', x: p.x, y: p.y, angle: ang, r, arc: half * 2, spin: half >= Math.PI });
    if (this.rank('warpath') > 0 && p.swings % 4 === 0) {
      // Warpath: a shockwave ring.
      const wr = 210;
      this.forEachNear(p.x, p.y, wr + 40, (i) => {
        const e = this.enemies[i];
        if (dist2(p.x, p.y, e.x, e.y) <= (wr + e.def.radius) ** 2) this.damageEnemy(i, dmg * 2, true);
      });
      this.events.push({ type: 'explode', x: p.x, y: p.y, r: wr });
    }
  }

  /** Rim Smash's cone. `scale` is the damage multiplier (Shield Echo hits for half). */
  private slamCone(ang: number, scale: number, stun: boolean): void {
    const p = this.player;
    const r = 150;
    const half = (100 * Math.PI) / 360;
    const dmg = 60 * scale * (1 + 0.2 * this.rank('hardKnocks')) * this.dmgMult;
    this.forEachNear(p.x, p.y, r + 40, (i) => {
      const e = this.enemies[i];
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > r + e.def.radius) return;
      if (Math.abs(angleDiff(Math.atan2(dy, dx), ang)) > half + e.def.radius / d) return;
      this.damageEnemy(i, dmg, true);
      if (stun && e.alive && !e.def.stationary) {
        const stoneStun = this.rank('backToStone') > 0 && this.nearStone() ? SITE_CARDS.stoneStun * this.rank('backToStone') : 0;
        e.stunT = Math.max(e.stunT, (e.def.rank === 'normal' ? 1.2 : 0.3) + stoneStun);
        // Rim Smash shoves even big foes off the Bulwark (bosses a little less), so it can steer them.
        let push = e.def.rank === 'normal' ? 50 : e.def.rank === 'boss' ? 70 : 90;
        // Ringwall Vow: the slam drags the horde in to the Bulwark instead, stopping at the shield.
        // Big foes are still shoved, so the slam can still steer them out of blooms.
        if (this.hasMythic('ringwallVow') && e.def.rank === 'normal') push = -Math.min(push, Math.max(0, d - e.def.radius - PLAYER_RADIUS - 6));
        e.x += (dx / d) * push;
        e.y += (dy / d) * push;
        this.clampArena(e, e.def.radius);
      }
    });
    this.events.push({ type: 'ability', slot: 0, x: p.x, y: p.y, angle: ang, r });
  }

  private shieldSlam(): void {
    const p = this.player;
    const t = this.bladeTarget(260);
    const ang = t >= 0 ? Math.atan2(this.enemies[t].y - p.y, this.enemies[t].x - p.x) : p.facing;
    p.facing = ang;
    this.slamCone(ang, 1, true);
    const echo = this.rank('shieldEcho');
    if (echo > 0) {
      p.echoT = 0.4;
      p.echoAng = ang;
      if (echo >= 2) this.addHeat(10);
    }
  }

  /** Charge goes for the biggest foe in range, then the nearest. */
  chargeTarget(): number {
    const p = this.player;
    if (p.tossT > 0 && p.tossId >= 0 && this.enemies[p.tossId]?.alive && dist2(p.x, p.y, this.enemies[p.tossId].x, this.enemies[p.tossId].y) <= 640 * 640) return p.tossId;
    let best = -1;
    let bestScore = Infinity;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      const d = Math.sqrt(dist2(p.x, p.y, e.x, e.y));
      if (d > 420) continue;
      const score = d - (e.def.rank === 'normal' ? 0 : 300);
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  private charge(): void {
    const p = this.player;
    const t = this.chargeTarget();
    const x1 = p.x;
    const y1 = p.y;
    let ang = p.facing;
    let len = 200;
    if (t >= 0) {
      const e = this.enemies[t];
      ang = Math.atan2(e.y - p.y, e.x - p.x);
      len = Math.max(0, Math.hypot(e.x - p.x, e.y - p.y) - e.def.radius - PLAYER_RADIUS - 4);
    }
    p.x += Math.cos(ang) * len;
    p.y += Math.sin(ang) * len;
    this.clampArena(p, PLAYER_RADIUS);
    p.px = p.x;
    p.py = p.y;
    p.facing = ang;
    p.shieldT = Math.max(p.shieldT, 0.2);
    if (t >= 0 && this.tree('onrush') > 0) p.onrushT = TREE.onrushTime;
    const ram = this.rank('batteringRam');
    const off = this.rank('broadBack') > 0 ? this.bossTarget : -1;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      const isTarget = i === t;
      if (!isTarget && (ram === 0 || segDist2(e.x, e.y, x1, y1, p.x, p.y) > (36 + e.def.radius) ** 2)) continue;
      // Co-op: Charge taunts what it hits onto the Bulwark.
      if (this.threat.length) taunt(this.threat[i], this.heroes[this.acting].id);
      if (i === this.bossIndex) this.broadBack(off);
      this.damageEnemy(i, (isTarget ? 35 : 25 * ram) * (1 + 0.5 * this.rank('fullWeight')) * this.dmgMult, true);
      if (e.alive && !e.def.stationary) e.stunT = Math.max(e.stunT, isTarget ? 0.8 : 0.5);
    }
    p.volleyT = Math.min(p.volleyT, 0.05);
    this.addHeat(10);
    if (this.rank('shieldWake') > 0) {
      // Shield Wake: the landing sends out a shockwave.
      const wr = CAPSTONES_2.wakeRadius;
      this.forEachNear(p.x, p.y, wr + 40, (i) => {
        const e = this.enemies[i];
        if (dist2(p.x, p.y, e.x, e.y) > (wr + e.def.radius) ** 2) return;
        this.damageEnemy(i, CAPSTONES_2.wakeDamage * (e.def.rank === 'normal' ? 1 : CAPSTONES_2.wakeBig) * this.dmgMult, true);
        if (e.alive && !e.def.stationary) e.stunT = Math.max(e.stunT, CAPSTONES_2.wakeStun);
      });
      this.events.push({ type: 'explode', x: p.x, y: p.y, r: wr });
    }
    this.events.push({ type: 'dash', x1, y1, x2: p.x, y2: p.y, dodge: false });
  }

  private bastion(): void {
    const p = this.player;
    p.bastionT = this.rank('ironVigil') > 0 ? CAPSTONES_2.vigilTime : 6;
    p.prevented = 0;
    // Anvil Skin steadies you for 10% of max health; Mended Iron adds 12% per rank.
    const amount = this.healPlayer(p.maxHp * (BASTION_HEAL * this.noviceAid + 0.12 * this.rank('lastStand')));
    if (amount > 0) this.events.push({ type: 'heal', x: p.x, y: p.y, amount });
    this.events.push({ type: 'ability', slot: 2, x: p.x, y: p.y, angle: 0, r: 70 });
  }

  // ---------------------------------------------------------------- duskblade

  get swingCooldown(): number {
    const rhythm = this.rank('killingRhythm') > 0 ? 1 + CAPSTONES_2.rhythmStep * (this.player.rhythmN ?? 0) : 1;
    return (0.6 * Math.pow(0.88, this.rank('quickBlades'))) / this.loadout.hasteMult / rhythm / (1 + 0.05 * this.rank('lightGrip')) / (1 + TREE.paceHaste * this.tree('pace')) / ((this.player.quickUntil ?? -1) > this.time ? 1 + ALT_KIT.quickenHaste : 1);
  }
  /** Open Veins: the Duskblade's bleeds hit harder. */
  get bleedMult(): number {
    return (this.rank('openVeins') > 0 ? CAPSTONES_2.veinsMult : 1) * (1 + 0.1 * this.rank('slowDrip')) * (1 + TREE.gashBleed * this.tree('gash'));
  }
  get swingReach(): number {
    return 92 * (1 + 0.15 * this.rank('longReach'));
  }

  /** The foe the Duskblade is fighting: bosses and named foes first, then the nearest. */
  bladeTarget(maxDist: number): number {
    const p = this.player;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      // BOSSV2: she can't be hit through stage 2, so blades and light look past her (to the bellows).
      if (!e.alive || (this.kmStage === 2 && e.kind === 'kilnMother')) continue;
      const d = Math.sqrt(dist2(p.x, p.y, e.x, e.y)) - e.def.radius;
      if (d > maxDist) continue;
      // Big foes count as a little closer, so the blades stay on them.
      // The Craw comes first of all: a hero is inside.
      const score = d - (e.kind === 'craw' ? 400 : e.def.rank === 'normal' ? 0 : 40);
      if (score < bestD) { bestD = score; best = i; }
    }
    return best;
  }

  private updateBlades(dt: number): void {
    const p = this.player;
    p.volleyT -= dt;
    if (p.volleyT > 0) return;
    const t = this.bladeTarget(this.swingReach + 30);
    if (t < 0) {
      p.volleyT = 0; // ready the moment something is in reach
      return;
    }
    p.volleyT += this.swingCooldown;
    if (p.volleyT < 0) p.volleyT = 0;
    this.swing(t);
  }

  private swing(t: number): void {
    const p = this.player;
    const e0 = this.enemies[t];
    const ang = Math.atan2(e0.y - p.y, e0.x - p.x);
    p.facing = ang;
    p.swings++;
    p.guardId = t;
    if (this.rank('killingRhythm') > 0) {
      const inTime = this.time - (p.lastSwingAt ?? -99) <= CAPSTONES_2.rhythmGap;
      p.rhythmN = inTime ? Math.min(CAPSTONES_2.rhythmMax, (p.rhythmN ?? 0) + 1) : 0;
      p.lastSwingAt = this.time;
    }
    const spin = this.rank('bladeStorm') > 0 && p.swings % 4 === 0;
    const r = this.swingReach;
    const half = spin ? Math.PI : ((130 * Math.PI) / 360) * (1 + 0.15 * this.rank('longReach'));
    const laneK = (p.laneN ?? 0) > 0 ? 1 + SITE_CARDS.laneDmg * this.rank('readTheLane') : 1;
    if ((p.laneN ?? 0) > 0) p.laneN = (p.laneN ?? 0) - 1;
    const dmg = 24 * this.dmgMult * (spin ? 2 : 1) * laneK;
    const forceCrit = p.nextCrit;
    p.nextCrit = false;
    let hits = 0;
    const bleed = this.rank('serratedEdge');
    let worry = 0;
    if (this.hasWeaponFx('worryingEdge')) {
      p.worryN = p.worryId === t ? Math.min(5, p.worryN + 1) : 0;
      p.worryId = t;
      worry = p.worryN;
    }
    this.forEachNear(p.x, p.y, r + 40, (i) => {
      const e = this.enemies[i];
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > r + e.def.radius) return;
      if (!spin && Math.abs(angleDiff(Math.atan2(dy, dx), ang)) > half + e.def.radius / d) return;
      hits++;
      e.woundT = OPEN_WOUNDS_TIME;
      // Cast-Cutter: casting foes take more. Worrying Edge: the target takes more each swing in a row.
      const k = (e.castId && this.hasWeaponFx('castCutter') ? 1.35 : 1) * (i === t ? 1 + 0.025 * worry : 1);
      this.damageEnemy(i, (forceCrit ? dmg * 2 : dmg) * k, !forceCrit);
      if (bleed > 0 && e.alive) {
        e.burnDps = Math.max(e.burnDps, 5 * bleed * this.dmgMult * this.bleedMult);
        e.burnT = Math.max(e.burnT, 3);
        e.burnBy = this.acting;
      }
    });
    this.addHeat(Math.min(15, 5 * hits) * (1 + 0.3 * this.rank('momentumFlow')) * (1 + TREE.rushMomentum * this.tree('rush')));
    // Mirrorstep: the afterimage strikes the nearest foe in its reach for half.
    if (p.imageT > 0) {
      const n = this.nearestEnemies(p.imageX, p.imageY, 1, r + 40)[0];
      if (n !== undefined) this.damageEnemy(n, dmg * 0.5, true);
    }
    this.events.push({ type: 'swing', x: p.x, y: p.y, angle: ang, r, arc: half * 2, spin });
  }

  private rendingDash(): void {
    const p = this.player;
    let t = this.bladeTarget(340);
    const x1 = p.x;
    const y1 = p.y;
    let ang = p.facing;
    let len = 200;
    if (t >= 0) {
      const e = this.enemies[t];
      ang = Math.atan2(e.y - p.y, e.x - p.x);
      len = Math.max(0, Math.min(300, Math.hypot(e.x - p.x, e.y - p.y) - e.def.radius - 20));
    } else t = -1;
    p.x += Math.cos(ang) * len;
    p.y += Math.sin(ang) * len;
    this.clampArena(p, PLAYER_RADIUS);
    p.px = p.x;
    p.py = p.y;
    p.facing = ang;
    p.shieldT = Math.max(p.shieldT, 0.2);
    const dmg = 55 * (1 + 0.25 * this.rank('keenLunge')) * this.dmgMult;
    const bleed = 12 * (1 + 0.5 * this.rank('deepCuts')) * this.dmgMult;
    let killed = false;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      if (segDist2(e.x, e.y, x1, y1, p.x, p.y) > (40 + e.def.radius) ** 2) continue;
      this.damageEnemy(i, dmg, true);
      if (!e.alive) killed = true;
      if (e.alive) {
        e.burnDps = Math.max(e.burnDps, bleed * this.bleedMult);
        e.burnT = Math.max(e.burnT, 4);
        e.burnBy = this.acting;
      }
    }
    // Flurry Step: a kill brings the dash straight back.
    if (killed && this.rank('flurryStep') > 0) p.cds[0] = 0;
    // Land swinging.
    p.volleyT = Math.min(p.volleyT, 0.05);
    this.events.push({ type: 'dash', x1, y1, x2: p.x, y2: p.y, dodge: false });
  }

  private sidestep(input: Input): void {
    const p = this.player;
    // Read the Lane: stepping out of a lob or a charge lane before it lands.
    const lane = this.rank('readTheLane');
    if (lane > 0 && this.inLaneTelegraph()) {
      p.cds[1] = Math.max(0, p.cds[1] - SITE_CARDS.laneRefund * lane);
      p.laneN = SITE_CARDS.laneSwings;
    }
    let ang: number;
    if (Math.hypot(input.x, input.y) > 0.01) ang = Math.atan2(input.y, input.x);
    else {
      const n = this.nearestEnemies(p.x, p.y, 1, 300)[0];
      ang = n !== undefined ? Math.atan2(p.y - this.enemies[n].y, p.x - this.enemies[n].x) : p.facing + Math.PI;
    }
    const x1 = p.x;
    const y1 = p.y;
    p.x += Math.cos(ang) * 130;
    p.y += Math.sin(ang) * 130;
    this.clampArena(p, PLAYER_RADIUS);
    p.px = p.x;
    p.py = p.y;
    const counter = this.rank('counterstep');
    p.shieldT = counter >= 2 ? 1.4 : 0.7;
    if (this.hasMythic('mirrorstep')) {
      p.imageT = 2;
      p.imageX = x1;
      p.imageY = y1;
    }
    if (this.rank('evasion') > 0) p.nextCrit = true;
    // Co-op: Sidestep sheds half the Duskblade's threat on every enemy.
    if (this.threat.length) {
      const id = this.heroes[this.acting].id;
      for (const t of this.threat) scaleThreat(t, id, 0.5);
    }
    // Catch your breath: Sidestep mends a little.
    this.healPlayer(p.maxHp * SIDESTEP_HEAL * this.noviceAid);
    // Shared Breath (party card): and the most hurt ally close by.
    if (this.rank('sharedBreath') > 0) {
      let k = -1;
      let low = 1;
      for (let j = 0; j < this.heroes.length; j++) {
        const a = this.heroPlayer(j);
        if (j === this.acting || a.hp <= 0 || dist2(p.x, p.y, a.x, a.y) > PARTY_CARDS.breathRange ** 2) continue;
        if (a.hp / a.maxHp < low) { low = a.hp / a.maxHp; k = j; }
      }
      if (k >= 0) this.healAllies(p.x, p.y, PARTY_CARDS.breathRange, this.heroPlayer(k).maxHp * PARTY_CARDS.breathHeal, k);
    }
    if (counter > 0) {
      const n = this.nearestEnemies(p.x, p.y, 1, this.swingReach + 40)[0];
      if (n !== undefined) this.damageEnemy(n, 60 * this.dmgMult, true);
    }
    this.events.push({ type: 'dash', x1, y1, x2: p.x, y2: p.y, dodge: true });
  }

  private execution(): void {
    const p = this.player;
    let t = this.bladeTarget(this.swingReach + 70);
    if (t < 0) t = this.nearestEnemies(p.x, p.y, 1, 220)[0] ?? -1;
    if (t < 0) {
      // Nothing in reach: refund most of it.
      p.heat = Math.min(MAX_HEAT, p.heat + this.abilityCost(2) * 0.8);
      p.cds[2] = 1;
      return;
    }
    const e = this.enemies[t];
    const ledger = this.hasMythic('redLedger');
    const low = e.hp < e.maxHp * (ledger ? 0.5 : 0.35);
    // Wring Out: the bleed's next 3s (6s at rank 2) land at once.
    const tear = e.burnT > 0 ? e.burnDps * 3 * this.rank('exsanguinate') : 0;
    this.damageEnemy(t, 230 * (1 + 0.2 * this.rank('hungrySteel')) * this.dmgMult * (low ? 2 : 1) + tear, true);
    // Red Ledger: an Execution kill brings Rending Dash straight back.
    if (ledger && !e.alive) p.cds[0] = 0;
    const cx = e.x;
    const cy = e.y;
    this.forEachNear(cx, cy, 120, (i) => {
      if (i === t) return;
      const o = this.enemies[i];
      if (dist2(cx, cy, o.x, o.y) <= (90 + o.def.radius) ** 2) this.damageEnemy(i, 60 * this.dmgMult, true);
    });
    this.events.push({ type: 'ability', slot: 2, x: cx, y: cy, angle: 0, r: 90 });
  }

  /** Orbit radius: Choir of Dawn's wisps circle wider than Ring of Ash, out past the Lumen's standoff. */
  private get orbitR(): number {
    return this.rank('choirOfDawn') > 0 ? LUMEN_CAPS.choirR : DEFENCE_BRANCH.ringR;
  }

  /** Orbiter positions for rendering. */
  orbiters(): { x: number; y: number }[] {
    if (this.rank('ringOfAsh') === 0 && this.rank('choirOfDawn') === 0) return [];
    const p = this.player;
    const r = this.orbitR;
    return [0, 1, 2].map((k) => {
      const a = p.orbitAngle + (k * Math.PI * 2) / 3;
      return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
    });
  }

  private fireVolley(): void {
    const p = this.player;
    const n = this.orbCount;
    const targets = this.nearestEnemies(p.x, p.y, n, 650);
    // Bosses pull focus: the first orb always goes to a boss in range.
    if (this.bossIndex >= 0) {
      const b = this.enemies[this.bossIndex];
      if (b.alive && b.def.rank === 'boss' && !(this.kmStage === 2 && b.kind === 'kilnMother') && dist2(p.x, p.y, b.x, b.y) < 480 * 480) targets.unshift(this.bossIndex);
    }
    if (this.crawIn(480) >= 0) targets.unshift(this.crawIn(480));
    for (let k = 0; k < n; k++) {
      const orb = this.orbs.find((o) => !o.alive);
      if (!orb) return;
      const t = targets.length ? targets[k % targets.length] : -1;
      let ang: number;
      if (t >= 0) {
        const e = this.enemies[t];
        ang = Math.atan2(e.y - p.y, e.x - p.x);
      } else {
        ang = p.facing + (k - (n - 1) / 2) * 0.3;
      }
      ang += (k - (n - 1) / 2) * 0.12;
      orb.alive = true;
      orb.x = orb.px = p.x;
      orb.y = orb.py = p.y;
      orb.vx = Math.cos(ang) * 330;
      orb.vy = Math.sin(ang) * 330;
      orb.life = 1.6;
      orb.target = t;
      orb.dmg = 12 * this.dmgMult;
      orb.owner = this.acting;
      orb.pierce = this.hasWeaponFx('piercingCinders') ? 1 : 0;
      orb.lastHit = -1;
      // Banked Flame: every 5th orb is a big one.
      if (this.hasWeaponFx('bankedFlame') && ++p.orbsFired % 5 === 0) orb.dmg *= 2.5;
      if (p.ventVolley) orb.dmg *= 2;
    }
    p.ventVolley = false;
  }

  private fireLance(): void {
    const p = this.player;
    const t = this.nearestEnemies(p.x, p.y, 1, 600)[0];
    const ang = t !== undefined ? Math.atan2(this.enemies[t].y - p.y, this.enemies[t].x - p.x) : p.facing;
    const len = 520;
    const x2 = p.x + Math.cos(ang) * len;
    const y2 = p.y + Math.sin(ang) * len;
    const lance = this.lances.find((l) => !l.alive);
    if (lance) Object.assign(lance, { alive: true, x1: p.x, y1: p.y, x2, y2, life: 0.25 });
    const dmg = 75 * this.dmgMult;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      if (segDist2(e.x, e.y, p.x, p.y, x2, y2) <= (12 + e.def.radius) ** 2) this.damageEnemy(i, dmg, true);
    }
  }

  private updateOrbs(dt: number, owner = 0): void {
    const burn = this.rank('searingBurn');
    const ground = this.rank('kindledGround');
    const boom = this.rank('conflagration') > 0;
    for (const o of this.orbs) {
      if (!o.alive || o.owner !== owner) continue;
      o.px = o.x;
      o.py = o.y;
      // Gentle homing toward the chosen target while it lives.
      if (o.target >= 0) {
        const e = this.enemies[o.target];
        if (e.alive) {
          const want = Math.atan2(e.y - o.y, e.x - o.x);
          const cur = Math.atan2(o.vy, o.vx);
          let d = want - cur;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          const turn = Math.max(-6 * dt, Math.min(6 * dt, d));
          const sp = Math.hypot(o.vx, o.vy);
          o.vx = Math.cos(cur + turn) * sp;
          o.vy = Math.sin(cur + turn) * sp;
        } else o.target = -1;
      }
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.life -= dt;
      // Halls H2b: a hero's shot stops at a sealed room's grates, as foes and heroes do.
      if (o.life <= 0 || (this.hallsOn && grateCut(this.halls!, o.px, o.py, o.x, o.y))) {
        o.alive = false;
        continue;
      }
      let hit = -1;
      this.forEachNear(o.x, o.y, 50, (i) => {
        if (hit >= 0) return;
        const e = this.enemies[i];
        if (i !== o.lastHit && dist2(o.x, o.y, e.x, e.y) <= (6 + e.def.radius) ** 2) hit = i;
      });
      if (hit < 0) continue;
      // Piercing Cinders: the orb carries on through the horde, but stops on a big foe.
      if (o.pierce > 0 && this.enemies[hit].def.rank === 'normal') {
        o.pierce--;
        o.lastHit = hit;
      } else o.alive = false;
      const e = this.enemies[hit];
      const hx = e.x;
      const hy = e.y;
      this.damageEnemy(hit, o.dmg, true);
      // Overheat: an orb that hits while the fire runs hot feeds no Heat, so only holding it (the slow drift) scorches.
      if (this.player.heat < OVERHEAT.from) this.addHeat(4 * (1 + 0.35 * this.rank('heatSink')));
      if (burn > 0 && e.alive) {
        e.burnDps = Math.max(e.burnDps, 6 * burn * (1 + 0.15 * this.rank('deepSmoulder')) * this.dmgMult);
        e.burnT = 3;
        e.burnBy = this.acting;
      }
      if (ground > 0) this.addZone(hx, hy, 26 + 8 * ground, 5 * ground * this.dmgMult, 2);
      if (boom) {
        this.events.push({ type: 'explode', x: hx, y: hy, r: 48 });
        // The blast also scorches the target itself, so the capstone helps against bosses.
        this.damageEnemy(hit, o.dmg * 0.5, false, true);
        this.forEachNear(hx, hy, 100, (i) => {
          if (i === hit) return;
          const n = this.enemies[i];
          if (dist2(hx, hy, n.x, n.y) <= (48 + n.def.radius) ** 2) this.damageEnemy(i, o.dmg * 0.6, false);
        });
      }
    }
  }

  // ---------------------------------------------------------------- enemies

  private updateEnemies(dt: number): void {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      // The enemy acts against its target: swap that hero in so aims and hits land on them.
      let tgt = this.heroes.length > 1 ? this.targetOf(i, dt) : 0;
      // QA and design, 25 Nov (the H2b rule, applied to aim): a foe in a sealed room only goes after heroes inside it.
      // With nobody inside to fight, it holds (a Lob landed past the grate on a hero shut outside, a Ground Pound was
      // cast from 440 away). With one-way grates a hero outside can always walk in.
      const sealed = this.sealedRoomOf(e);
      if (sealed && roomGap(sealed, this.heroPlayer(tgt).x, this.heroPlayer(tgt).y) < 0) tgt = this.heroInRoom(sealed, e.x, e.y);
      if (this.heroes.length > 1 && tgt >= 0) this.use(tgt);
      const p = this.player;
      this.turnFoe(e, p, dt);
      e.px = e.x;
      e.py = e.y;
      if (e.touchCd > 0) e.touchCd -= dt;
      if (e.orbitCd > 0) e.orbitCd -= dt;
      if (e.flash > 0) e.flash -= dt;

      if (e.woundT > 0) e.woundT -= dt;
      if ((e.exposedT ?? 0) > 0) e.exposedT = (e.exposedT ?? 0) - dt;
      if ((e.staggerT ?? 0) > 0) e.staggerT = (e.staggerT ?? 0) - dt;
      if (e.burnT > 0) {
        e.burnT -= dt;
        this.burnTick = true;
        this.damageEnemy(i, e.burnDps * dt, false, true);
        this.burnTick = false;
        if (!e.alive) continue;
      }

      if (tgt < 0) continue; // sealed in with nobody to fight
      if (e.def.stationary) {
        this.runStationary(i, dt);
        continue;
      }
      // BOSSV2 stage 2 (QA, 25 Nov): no hero's stun or shove lands on her on the walk or in the kiln. A stun would
      // stop her clocks here (the kiln's 40 s among them), and a shove would move her off the kiln mouth.
      if (e.kind === 'kilnMother' && this.kmStage === 2) {
        e.stunT = 0;
        if (this.kmInKiln) { e.x = 0; e.y = this.kmSpotY(); }
      }
      if (e.stunT > 0) {
        e.stunT -= dt;
        if (e.lungeW > 0 || e.lungeD > 0) this.stopLunge(i); // a stun breaks a lunge: the lane goes with it
        continue;
      }

      // Phase 14 X2 Smoldering: a fire circle where it stands every NAMED.smolderEvery s (timed from its spawn, so no new state).
      if (e.named >= 0 && AFFIXES[e.affix] === 'Smoldering') {
        const age = this.time - e.spawnedAt;
        if (Math.floor(age / NAMED.smolderEvery) > Math.floor((age - dt) / NAMED.smolderEvery) && age > dt) {
          this.addTelegraph('circle', e.x, e.y, NAMED.smolderR, 0, 0, NAMED.smolderDelay, NAMED.smolderDmg);
        }
      }
      let speed = e.castId ? 0 : e.def.speed * (e.named >= 0 && AFFIXES[e.affix] === 'Swift' ? NAMED.swift : 1);
      if (e.def.rank === 'boss' && this.bossEnraged) speed *= 1.6;
      if ((e.slowUntil ?? 0) > this.time) speed *= 1 - (e.slowMult ?? 0);
      // Thin Ice: Nhevra holds her ground while the river is cracked, so her strip stays hers.
      if (e.kind === 'nhevra' && this.cracks.some((c) => c.alive)) speed = 0;
      // The Wrackline: Shoal Lurkers ride the Ebb toward you.
      if (e.kind === 'shoalLurker' && this.ebbT > 0) speed *= WRACK.lurkerSurge;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      let mx = (dx / d) * speed;
      let my = (dy / d) * speed;
      // Phase 18 Halls: a foe that can't walk straight at its hero heads round the wall, room to room.
      let roundWall = false;
      if (this.hallsOn) {
        const wp = hallsWay(this.halls!, e.x, e.y, p.x, p.y);
        if (wp.x !== p.x || wp.y !== p.y) {
          const wx = wp.x - e.x, wy = wp.y - e.y, wd = Math.hypot(wx, wy) || 1;
          mx = (wx / wd) * speed;
          my = (wy / wd) * speed;
          roundWall = true;
        }
      }
      // FOE_AI (Steve, 26 Nov: "They just walk towards you"): with a clear path, a chaser cuts you off, comes in from its
      // own side and sways, so running a circle no longer drags the pack behind you in a line.
      if (!roundWall && speed > 0 && !FOE_AI_OWN_MOVE.has(e.kind) && e.def.rank !== 'boss') {
        const v = this.chaseDir(i, p, dx, dy, d, speed, dt);
        mx = v.x * speed;
        my = v.y * speed;
      }
      // The opening's hounds don't lunge: red on the floor is R3's lesson (FIRST_DELVE.hound).
      if (FOE_AI_LUNGERS.has(e.kind) && e.def.rank !== 'boss' && !this.firstDelve) {
        const l = this.runLunge(i, p, d, dt, speed);
        if (l) { mx = l.x; my = l.y; }
      }
      // V1: an Ember Spitter keeps its distance: it backs off when you close in and circles at range.
      if (e.kind === 'emberSpitter') {
        if (d < VARIETY.spitterNear) { mx = -mx; my = -my; }
        else if (d < VARIETY.spitterFar) { const s = i % 2 ? 0.5 : -0.5; const tx = -my * s; my = mx * s; mx = tx; }
      }
      // Phase 16 U2: the Ashwall turns its shield to the hero (slowly) and plants itself in front of the nearest foe it guards.
      if (e.kind === 'ashwall') {
        const want = Math.atan2(dy, dx);
        const step = ASHWALL.turn * dt;
        const diff = angleDiff(want, e.aux);
        e.aux = angleDiff(e.aux + Math.max(-step, Math.min(step, diff)), 0);
        const g = this.ashwallWard(i);
        if (g >= 0) {
          const o = this.enemies[g];
          const ox = p.x - o.x, oy = p.y - o.y, od = Math.hypot(ox, oy) || 1;
          const gx = o.x + (ox / od) * ASHWALL.guardGap - e.x, gy = o.y + (oy / od) * ASHWALL.guardGap - e.y;
          const gd = Math.hypot(gx, gy);
          mx = gd > 8 ? (gx / gd) * speed : 0;
          my = gd > 8 ? (gy / gd) * speed : 0;
        }
      }
      // Phase 16 U2: the Dimhorn shuns the light. It hangs just outside its hero's coal light; time out of every coal's
      // light (aux) builds toward its Dark Call, and inside one it drains and the horn can't sound.
      if (e.kind === 'dimhorn') {
        const lit = this.warmthAt(e.x, e.y, e.def.radius) > 0;
        if (!e.castId) {
          e.aux = lit ? Math.max(0, e.aux - dt * DIMHORN.drain) : e.aux + dt;
          if (!lit && e.aux >= DIMHORN.callAt && e.aux2 < DIMHORN.maxCalls) this.startCast(i, 'darkCall', 'Dark Call', DIMHORN.callCast, false);
        }
        const R = (p.coal ? p.coalR ?? this.coalMaxR : COLD.minR) + DIMHORN.hang;
        if (d < R) { mx = -mx; my = -my; }
        else if (d < R + DIMHORN.band) { const tx = -my * 0.6; my = mx * 0.6; mx = tx; }
      }
      // Phase 16 U2: the Lampeye's gaze (aux) builds while it can see its hero and fades while a pillar is between
      // them. Full, it starts its Searing Look (a cast, so a hero can still step behind a pillar).
      if (e.kind === 'lampeye' && !e.castId) {
        if (this.lampeyeSees(e, p.x, p.y)) e.aux = Math.min(LAMPEYE.full, e.aux + dt);
        else e.aux = Math.max(0, e.aux - dt * LAMPEYE.fade);
        if (e.aux >= LAMPEYE.full) {
          this.startCast(i, 'searingLook', 'Searing Look', LAMPEYE.lookCast, false);
        }
        // It keeps its distance, so its gaze crosses the room.
        if (d < LAMPEYE.keep) { mx = -mx; my = -my; }
      }
      // Phase 16 U2: the Ballast drops anchor after `plantDelay` s with its hero in reach, and pulls it up `unplant`
      // s after they leave it. `aux` counts toward planting (>= plantDelay is planted); `aux2` counts the time out of reach.
      if (e.kind === 'ballast') {
        const inReach = d < BALLAST.reach + e.def.radius;
        if (e.aux >= BALLAST.plantDelay) {
          e.aux2 = inReach ? 0 : e.aux2 + dt;
          if (e.aux2 >= BALLAST.unplant) { e.aux = 0; e.aux2 = 0; this.events.push({ type: 'castDone', x: e.x, y: e.y, id: 'unanchor', name: 'Weighs Anchor' }); }
        } else if (inReach) {
          e.aux += dt;
          if (e.aux >= BALLAST.plantDelay) { e.aux2 = 0; e.abilityT = Math.min(e.abilityT, BALLAST.slamFirst); this.events.push({ type: 'castDone', x: e.x, y: e.y, id: 'anchor', name: 'Drops Anchor' }); }
        } else e.aux = Math.max(0, e.aux - dt);
        if (e.aux >= BALLAST.plantDelay) { mx = 0; my = 0; }
      }
      // V1: an Ashbuck mid-charge runs straight down its lane, fast, and doesn't steer.
      if (e.kind === 'ashbuck' && e.aux2 > 0) {
        e.aux2 -= dt;
        mx = Math.cos(e.aux) * VARIETY.chargeSpeed;
        my = Math.sin(e.aux) * VARIETY.chargeSpeed;
      }

      // BOSSV2 stage 2: she walks to the kiln mouth and climbs in.
      if (e.kind === 'kilnMother' && this.kmStage === 2) {
        const sy = this.kmSpotY(), kx = -e.x, ky = sy - e.y, kd = Math.hypot(kx, ky);
        const run = e.def.speed * KILN_V2.walkIn;
        if (kd > 4) { mx = (kx / kd) * Math.min(run, kd / (dt * this.moveScale)); my = (ky / kd) * Math.min(run, kd / (dt * this.moveScale)); }
        else { mx = 0; my = 0; e.x = 0; e.y = sy; if (!this.kmInKiln) { this.kmInKiln = true; this.kmClock.kiln = 0; if (e.castId) this.cancelCast(i); this.events.push({ type: 'castDone', x: e.x, y: e.y, id: 'kmKiln', name: 'Into the Kiln' }); } }
      }
      // Separation so a group reads as separate foes, not a single blob.
      if (e.def.rank !== 'boss') {
        let sx = 0;
        let sy = 0;
        let count = 0;
        this.forEachNear(e.x, e.y, 30, (j) => {
          if (j === i || count > 6) return;
          const o = this.enemies[j];
          const ox = e.x - o.x;
          const oy = e.y - o.y;
          const dd = ox * ox + oy * oy;
          const min = e.def.radius + o.def.radius;
          if (dd > 0.0001 && dd < min * min) {
            const inv = 1 / Math.sqrt(dd);
            sx += ox * inv;
            sy += oy * inv;
            count++;
          }
        });
        mx += sx * speed * 0.9;
        my += sy * speed * 0.9;
      }

      // Despawn stragglers that fall far behind; they respawn ahead.
      if (e.def.rank === 'normal' && d > SPAWN_RADIUS * 1.5 && !this.hallsOn) {
        this.relocate(e);
        continue;
      }

      // Design, 25 Nov (H3a): on a Halls map a Sluice Crawler keeps the arena's speed. At 1.25x it walked its friends into
      // its own Bloom before the burst (inside a Bloom 52% of the time vs 34% in the arena).
      const ms = e.kind === 'sluiceCrawler' ? 1 : this.moveScale;
      e.x += mx * dt * ms;
      e.y += my * dt * ms;
      this.clampArena(e, e.def.radius);
      // The Wrackline: Shoal Lurkers swim; they can't climb onto a raft, so they circle its edge.
      // H3d (design, 25 Nov): on a Halls map, while the Ebb pulls, no foe can climb onto an afloat raft (the Lurkers' rule
      // for every foe but a boss), so a hero on a raft is safe until the water stops. The arena keeps its rule.
      if ((e.kind === 'shoalLurker' || (this.hallsOn && this.ebbT > 0 && e.def.rank !== 'boss')) && this.rafts.length) this.keepOffRafts(e);

      if (e.def.rank !== 'normal' && e.lungeW <= 0 && e.lungeD <= 0) this.runAbilities(i, dt); // no Snap mid-lunge

      // CP3 remake: the remade Kiln Mother (kmStage > 0) never hurts by touch; every blow of hers is a red mark first.
      if (d < e.def.radius + PLAYER_RADIUS && e.touchCd <= 0 && !((this.kmStage > 0 || this.kmOpen > 0) && e.kind === 'kilnMother')) {
        e.touchCd = 0.6;
        const mult = (e.def.rank === 'boss' && this.bossEnraged ? 2.5 : 1) * (e.kind === 'vorhulm' ? 1 + COAL.emberDamage * this.coalFed : 1)
          * (e.kind === 'ysmeret' && this.ysStage === 2 ? YSMERETV2.melee : 1);
        this.hurtPlayer(e.def.damage * mult * this.tierDamage, i);
        // A Snuffer's touch drinks the hero's light.
        if (e.kind === 'snuffer' && this.player.coal !== undefined) this.player.coal = Math.max(0, this.player.coal - COLD.snufferDim);
      }
    }
    this.use(0);
  }

  /** Removes an enemy without a kill (no loot, no credit). */
  private despawn(i: number): void {
    const e = this.enemies[i];
    if (e.castId) this.cancelCast(i);
    e.alive = false;
    this.aliveEnemies--;
  }

  private relocate(e: Enemy): void {
    const a = this.rng.next() * Math.PI * 2;
    e.x = e.px = this.player.x + Math.cos(a) * SPAWN_RADIUS;
    e.y = e.py = this.player.y + Math.sin(a) * SPAWN_RADIUS;
  }

  /** Rifts spawn ashlings; acolytes channel heals into the boss. */
  private runStationary(i: number, dt: number): void {
    const e = this.enemies[i];
    if (e.kind === 'kilnBellows') return; // BOSSV2: they only stand and wait to be broken
    if (e.kind === 'rift') {
      e.abilityT -= dt;
      if (e.abilityT <= 0) {
        e.abilityT = 3;
        // V1: in a dungeon fight a Rift keeps at most `riftCap` Ashlings out, so the swarm stays readable.
        let out = 0;
        if (!this.stress) for (const o of this.enemies) if (o.alive && o.kind === 'ashling') out++;
        const n = Math.min(3, this.stress ? 3 : VARIETY.riftCap - out);
        for (let k = 0; k < n; k++) {
          const a = this.rng.next() * Math.PI * 2;
          this.spawn('ashling', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40);
        }
        if (n > 0 && !this.stress) this.events.push({ type: 'riftSpawn', index: i, n });
      }
      return;
    }
    const ward = e.kind === 'acolyte' ? e.aux2 : -1;
    if (ward >= 0) {
      const b = this.enemies[ward];
      if (b.alive && b.def.rank !== 'normal') {
        // Acolytes circle their ward and channel Kindle into it, a steady heal.
        // The answer is to kill them (see the ACOLYTE note on why it isn't a cast).
        e.aux += 0.35 * dt;
        e.x = b.x + Math.cos(e.aux) * ACOLYTE_RING;
        e.y = b.y + Math.sin(e.aux) * ACOLYTE_RING;
        // A ward near the wall would swing its acolytes outside it, out of reach (QA, Y8): keep them in.
        this.clampArena(e, e.def.radius);
        b.hp = Math.min(b.maxHp, b.hp + b.maxHp * ACOLYTE.heal * dt * this.healTakenMult(b));
      }
    }
    const p = this.player;
    if (dist2(p.x, p.y, e.x, e.y) < (e.def.radius + PLAYER_RADIUS) ** 2 && e.touchCd <= 0) {
      e.touchCd = 0.6;
      this.hurtPlayer(e.def.damage * this.tierDamage, i);
    }
  }

  /**
   * FOE_AI: the way a chaser walks when its path is clear (a unit vector). It aims `lead` s ahead of where its hero is
   * running (at most `leadMax` px), comes in from its own side (`flank`), and sways (`weave`). Both side pulls fade out
   * inside `close` px, so the last steps are straight at you and hits still land.
   */
  private chaseDir(i: number, p: Player, dx: number, dy: number, d: number, speed: number, dt: number): { x: number; y: number } {
    let vx = (p.x - p.px) / dt, vy = (p.y - p.py) / dt;
    const vs = Math.hypot(vx, vy);
    if (vs > FOE_AI.heroTop) { vx *= FOE_AI.heroTop / vs; vy *= FOE_AI.heroTop / vs; } // a blink isn't a run
    const ahead = Math.min(FOE_AI.lead, d / Math.max(1, speed * this.moveScale));
    let ax = vx * ahead, ay = vy * ahead;
    const al = Math.hypot(ax, ay);
    if (al > FOE_AI.leadMax) { ax *= FOE_AI.leadMax / al; ay *= FOE_AI.leadMax / al; }
    const tx = dx + ax, ty = dy + ay, td = Math.hypot(tx, ty) || 1;
    const ux = tx / td, uy = ty / td;
    const fade = Math.max(0, Math.min(1, (d - FOE_AI.close) / (FOE_AI.far - FOE_AI.close)));
    const side = foeHash(i, 1) < 0.5 ? -1 : 1;
    const sway = Math.sin(this.time * Math.PI * 2 * FOE_AI.weaveHz + foeHash(i, 2) * Math.PI * 2);
    const k = fade * (side * FOE_AI.flank + sway * FOE_AI.weave);
    const wx = ux - uy * k, wy = uy + ux * k, wl = Math.hypot(wx, wy) || 1;
    return { x: wx / wl, y: wy / wl };
  }

  /**
   * FOE_AI lunge: from `lungeMin` to `lungeMax` away, now and then a chaser stops, shows a red lane `lungeLen` long for
   * `lungeWind` s, then dashes down it. The lane hits like `lungeHit` touches. At most `lungeCap` foes lunge at once, so
   * the floor stays readable on a phone. Returns the move to use this step, or null to keep walking.
   */
  private runLunge(i: number, p: Player, d: number, dt: number, speed: number): { x: number; y: number } | null {
    const e = this.enemies[i];
    if (e.lungeD > 0) {
      e.lungeD -= dt;
      return { x: Math.cos(e.lungeA) * FOE_AI.lungeSpeed, y: Math.sin(e.lungeA) * FOE_AI.lungeSpeed };
    }
    if (e.lungeW > 0) {
      e.lungeW -= dt;
      if (e.lungeW <= 0) {
        e.lungeW = 0;
        e.lungeD = FOE_AI.lungeLen / (FOE_AI.lungeSpeed * this.moveScale); // run the lane it showed, no further
      }
      return { x: 0, y: 0 };
    }
    e.lungeT -= dt;
    if (e.lungeT > 0 || e.castId || speed <= 0 || d < FOE_AI.lungeMin || d > FOE_AI.lungeMax) return null;
    let busy = 0;
    for (const o of this.enemies) if (o.alive && (o.lungeW > 0 || o.lungeD > 0)) busy++;
    if (busy >= FOE_AI.lungeCap) { e.lungeT = 0.5; return null; }
    e.lungeT = FOE_AI.lungeEvery * (0.75 + 0.5 * foeHash(i, 4 + Math.floor(this.time)));
    e.lungeW = FOE_AI.lungeWind;
    e.lungeA = Math.atan2(p.y - e.y, p.x - e.x);
    this.addTelegraph('cone', e.x, e.y, FOE_AI.lungeLen + e.def.radius, e.lungeA, FOE_AI.lungeArc, FOE_AI.lungeWind, e.def.damage * FOE_AI.lungeHit, 'hit', i);
    return { x: 0, y: 0 };
  }

  /** FOE_AI: ends a lunge early (stunned or killed) and takes its lane away, so nothing lands from a foe that didn't go. */
  private stopLunge(i: number): void {
    const e = this.enemies[i];
    if (e.lungeW > 0) for (const t of this.telegraphs) if (t.alive && t.owner === i && t.angle === e.lungeA) t.alive = false;
    e.lungeW = 0;
    e.lungeD = 0;
  }

  /** Starts a cast; false (and no cast) for a STOP_ONLY cast nobody in the party can stop (partyStops). */
  private startCast(i: number, id: string, name: string, dur: number, interruptible: boolean): boolean {
    const e = this.enemies[i];
    if (interruptible && STOP_ONLY.has(id) && !this.partyStops(e)) return false;
    e.castId = id;
    e.castName = name;
    e.castT = 0;
    e.castDur = this.hasOmen('quickened') ? dur * OMEN_TUNING.quickenedCast : dur;
    e.interruptible = interruptible;
    this.events.push({ type: 'castStart', index: i, id, name });
    return true;
  }

  private cancelCast(i: number): void {
    const e = this.enemies[i];
    e.castId = '';
    e.castName = '';
    e.castT = 0;
    for (const t of this.telegraphs) if (t.alive && t.owner === i) t.alive = false;
  }

  private finishCast(i: number): void {
    const e = this.enemies[i];
    const id = e.castId;
    const name = e.castName;
    // Mastery card: a cast a Kick could have stopped went off. (One whose caster died first counts for nothing.)
    if (e.interruptible) {
      for (let h = 0; h < this.heroes.length; h++) {
        const q = this.heroPlayer(h);
        if (q.hp > 0 && this.heroes[h].classDef.kick && slotOpen(3, q.unlockLevel)) q.castsMissed = (q.castsMissed ?? 0) + 1;
      }
    }
    e.castId = '';
    e.castName = '';
    for (const t of this.telegraphs) if (t.alive && t.owner === i) t.owner = -1; // let it land
    if (id === 'cataclysm') {
      const p = this.player;
      // The opening: un-Quenched, it lands as one light ring (FIRST_DELVE.boss.rippleDamage).
      this.hurtPlayer((this.kmOpen ? FIRST_DELVE.boss.rippleDamage : 45) * (this.bossEnraged ? 1.5 : 1) * this.tierDamage, i);
      this.events.push({ type: 'slam', x: p.x, y: p.y, r: 160 });
    } else if (id === 'charge') {
      e.aux2 = VARIETY.chargeLen / (VARIETY.chargeSpeed * this.moveScale); // run the lane it showed (faster on a Halls run, no further)
      this.events.push({ type: 'charge', index: i });
    } else if (id === 'mirror') {
      e.aux2 = FOUNDRY.mirrorTime;
    } else if (id === 'rekindle') {
      // Bring the fallen twin back beside this one at half of its own health (design, 25 Nov: a trash twin's 30% or a
      // named fight's 80% carries over; a fresh spawn's maxHp would ignore them).
      const k = this.spawn('emberTwin', e.x + 30, e.y);
      if (k >= 0) {
        const t = this.enemies[k];
        if (e.rekindleHp) t.maxHp = e.rekindleHp;
        t.hp = t.maxHp * 0.5;
      }
      e.rekindleHp = undefined;
    } else if (id === 'undertow') {
      const p = this.player;
      p.x += (e.x - p.x) * FOUNDRY.undertowPull;
      p.y += (e.y - p.y) * FOUNDRY.undertowPull;
      this.hurtPlayer(FOUNDRY.undertowDamage * this.tierDamage, -1, false, e.def.name);
      this.events.push({ type: 'slam', x: p.x, y: p.y, r: 60 });
    } else if (id === 'conchCall') {
      // Phase 16 U2: the next Ebb comes `hasten` s sooner (never sooner than `floor` s off). Mid-Ebb it holds the water.
      if (this.ebbT > 0) this.ebbT += CONCH.hold;
      else if (this.ebbWarnT <= 0) this.tideClockT = Math.max(CONCH.floor, this.tideClockT - CONCH.hasten);
      this.events.push({ type: 'castDone', x: e.x, y: e.y, id: 'conchBlown', name: 'The Ebb Comes Sooner' });
    } else if (id === 'darkCall') {
      // Phase 16 U2: the Dimhorn's horn calls the pack in from the dark edge behind it. A Dimhorn dragged into a coal's
      // light before the call ends is silenced, and the call is lost.
      e.aux = 0;
      if (this.warmthAt(e.x, e.y, e.def.radius) > 0) { this.events.push({ type: 'castDone', x: e.x, y: e.y, id: 'darkCallLost', name: 'Silenced' }); return; }
      e.aux2++;
      if (this.hallsOn) { this.hallsDarkCall(e); return; }
      const a = Math.atan2(e.y, e.x), r = this.arenaR - 60;
      for (let k = 0; k < DIMHORN.calls; k++) {
        const b = a + (k - (DIMHORN.calls - 1) / 2) * 0.35;
        this.spawn('rimehound', Math.cos(b) * r, Math.sin(b) * r);
      }
      this.events.push({ type: 'waveShape', id: 'reinforce', stage: 'land', x: Math.cos(a) * r, y: Math.sin(a) * r });
    } else if (id === 'searingLook') {
      // Phase 16 U2: the Lampeye sears a hero it can still see; a pillar in the way blocks it. Either way its gaze resets.
      const at = this.acting;
      this.eachHero(() => {
        const p = this.player;
        if (p.hp > 0 && this.lampeyeSees(e, p.x, p.y)) {
          this.hurtPlayer(LAMPEYE.lookDamage * this.tierDamage, i);
          this.events.push({ type: 'slam', x: p.x, y: p.y, r: 40 });
        }
      });
      this.use(at);
      e.aux = 0;
    } else if (id === 'glare') {
      // The lens flares: anyone in the light is burned, anyone in a pillar's shadow is safe.
      const dmg = GLARE.glareDamage * (this.bossEnraged ? 1.5 : 1) * this.tierDamage;
      if (this.heroes.length === 1) {
        const p = this.player;
        const hit = !this.shadowed(p.x, p.y);
        this.verbHit = true;
        if (hit) this.hurtPlayer(dmg, i);
        this.verbHit = false;
        this.events.push({ type: 'glare', x: e.x, y: e.y, hit });
      } else {
        // Co-op: the flare burns every hero standing in the light.
        const at = this.acting;
        let hit = false;
        this.eachHero((h) => {
          if (this.shadowed(this.player.x, this.player.y)) return;
          this.hurtPlayer(dmg, i);
          if (h === at) hit = true;
        });
        this.use(at);
        this.events.push({ type: 'glare', x: e.x, y: e.y, hit });
      }
    } else if (id === 'anvilfall') {
      // The tank-buster lands on the hero it picked at wind-up, through dodges and shields.
      const at = this.acting;
      this.use(this.anvilTarget);
      const p = this.player;
      if (p.hp > 0) {
        const sundered = (p.sunderT ?? 0) > 0;
        this.hurtPlayer(ONDREL.anvil * (sundered ? ONDREL.sunderMult : 1) * this.tierDamage, i, true);
        p.sunderT = ONDREL.sunderTime;
        this.events.push({ type: 'slam', x: p.x, y: p.y, r: 70 });
        // ONDRELV2 stage 2: it leaves burning slag where it landed, on the tank's spot.
        if (this.ondrelStage === 2) this.leaveSlag(p.x, p.y);
      }
      this.use(at);
    } else if (id === 'haul') {
      // Yanked toward the Hauler, to just in front of it.
      const at = this.acting;
      this.use(Math.min(this.heroes.length - 1, Math.max(0, e.aux | 0)));
      const p = this.player;
      if (p.hp > 0) {
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        // Anvil Skin anchors the Bulwark: the hook lands but can't move it.
        const pull = this.anchored(p) ? 0 : Math.min(WRACK.haul, Math.max(0, d - e.def.radius - PLAYER_RADIUS - 8));
        p.x += (dx / d) * pull;
        p.y += (dy / d) * pull;
        this.hurtPlayer(WRACK.haulDamage * this.tierDamage, i);
        this.events.push({ type: 'slam', x: p.x, y: p.y, r: 40 });
      }
      this.use(at);
    } else if (id === 'sink') {
      // Sink: the raft she marked goes under for a while.
      const r = this.rafts[e.aux | 0];
      if (r) r.sunkT = WRACK.sinkTime;
      this.events.push({ type: 'slam', x: r ? r.x : 0, y: r ? r.y : 0, r: WRACK.raftR });
    } else if (id === 'frostLace') {
      for (let k = 0; k < this.heroes.length; k++) {
        const q = this.heroPlayer(k);
        if (q.hp > 0 && dist2(q.x, q.y, e.aux, e.aux2) <= (COLD.laceR + PLAYER_RADIUS * 0.5) ** 2) q.chill = Math.min(COLD.frozenAt, (q.chill ?? 0) + COLD.laceChill);
      }
    } else if (id === 'snuff') {
      // Snuff: every hero's coal dims.
      for (let k = 0; k < this.heroes.length; k++) {
        const q = this.heroPlayer(k);
        if (q.coal !== undefined) q.coal = Math.max(0, q.coal - COLD.snuffCut);
      }
    } else if (id === 'longNight') {
      // The Long Night: the cold takes whatever your warmest coal can't hold back.
      const at = this.acting;
      const warmth: number[] = [];
      for (let k = 0; k < this.heroes.length; k++) { const q = this.heroPlayer(k); warmth.push(this.warmthAt(q.x, q.y)); }
      for (let k = 0; k < this.heroes.length; k++) {
        this.use(k);
        if (this.player.hp <= 0) continue;
        // Co-op huddle: each other living hero close by takes a share of the cold off you.
        const me = this.player;
        let near = 0;
        for (let j = 0; j < this.heroes.length; j++) {
          if (j === k) continue;
          const o = this.heroPlayer(j);
          if (o.hp > 0 && dist2(o.x, o.y, me.x, me.y) <= COLD.huddleR * COLD.huddleR) near++;
        }
        const huddle = 1 - COLD.huddleCut * Math.min(COLD.huddleMax, near);
        this.hurtPlayer(this.player.maxHp * COLD.nightMax * (1 - warmth[k]) * huddle, i, true);
        this.events.push({ type: 'slam', x: this.player.x, y: this.player.y, r: 40 });
      }
      this.use(at);
    } else if (id === 'ladlePour') {
      // Grandmother Slag's tank hit: worse for every Ladle Burn stack nobody healed off.
      const at = this.acting;
      this.use(this.ladleTarget);
      const p = this.player;
      if (p.hp > 0) {
        // Seared: a second pour inside `searTime` hits `searMult` harder, and no heal clears it.
        const seared = (p.sunderT ?? 0) > 0 ? 1 + SLAG.searMult : 1;
        this.hurtPlayer(SLAG.ladle * (1 + SLAG.ladleStackMult * (p.slag ?? 0)) * seared * this.tierDamage, i, true);
        p.slag = Math.min(SLAG.slagMax, (p.slag ?? 0) + SLAG.ladleStacks);
        p.sunderT = SLAG.searTime;
        this.events.push({ type: 'slagGrip', x: p.x, y: p.y, stacks: p.slag });
        this.events.push({ type: 'slam', x: p.x, y: p.y, r: 70 });
      }
      this.use(at);
    } else if (id === 'coalGorge') {
      // Old Vorhulm's Gorge: not interrupted, he heals.
      const amount = e.maxHp * COAL.gorgeHeal * this.healTakenMult(e);
      e.hp = Math.min(e.maxHp, e.hp + amount);
      this.events.push({ type: 'heal', x: e.x, y: e.y, amount });
    } else if (id === 'plateShift') {
      // Phase 12 W3: his plate slides round to face the non-tank who hurt him most; he keeps facing his target.
      let pick = -1;
      let most = -1;
      for (let k = 0; k < this.heroes.length; k++) {
        const q = this.heroPlayer(k);
        if (q.hp <= 0 || this.isTank(k)) continue;
        if ((this.colDmg[k] ?? 0) > most) { most = this.colDmg[k] ?? 0; pick = k; }
      }
      if (pick >= 0) {
        const q = this.heroPlayer(pick);
        this.colPlate = angleDiff(Math.atan2(q.y - e.y, q.x - e.x), this.colFacing);
        this.events.push({ type: 'wheel', hero: pick });
      }
    } else if (id === 'millstone') {
      // Phase 15 Y3: he starts to grind round.
      this.millT = MILL.time;
      this.millDir = this.rng.int(2) === 0 ? 1 : -1;
      this.millTickT = MILL.tick;
      this.events.push({ type: 'millstone', stage: 'start', dir: this.millDir });
    } else if (id === 'wheel') {
      // Raid 3: he turns on the non-tank who hurt him most in the last few seconds, and sweeps.
      let pick = -1;
      let most = -1;
      for (let k = 0; k < this.heroes.length; k++) {
        const q = this.heroPlayer(k);
        if (q.hp <= 0 || this.isTank(k)) continue;
        if ((this.colDmg[k] ?? 0) > most) { most = this.colDmg[k] ?? 0; pick = k; }
      }
      if (pick >= 0) {
        const q = this.heroPlayer(pick);
        this.colFacing = Math.atan2(q.y - e.y, q.x - e.x);
        this.events.push({ type: 'wheel', hero: pick });
      }
      this.slagSweep(i);
    } else if (id === 'lastWord') {
      // Raid 4's hard enrage: the Regent's last word.
      const at = this.acting;
      this.eachHero(() => this.hurtPlayer(this.player.maxHp * 10, i, true));
      this.use(at);
    } else if (id === 'pourOut') {
      // Raid 3's hard enrage: the Smeltery floods.
      const at = this.acting;
      this.eachHero(() => this.hurtPlayer(this.player.maxHp * 10, i, true));
      this.use(at);
    } else if (id === 'lastMeal') {
      // Raid 2's hard enrage: he swallows everyone.
      const at = this.acting;
      this.eachHero(() => this.hurtPlayer(this.player.maxHp * 10, i, true));
      this.use(at);
    } else if (id === 'lastEmber') {
      // The hard enrage: nothing stands through it.
      const at = this.acting;
      this.eachHero(() => this.hurtPlayer(this.player.maxHp * 10, i, true));
      this.use(at);
    } else if (id === 'stamp') {
      // Oskel's tank hit: lands on the hero picked at wind-up, through dodges and shields.
      const at = this.acting;
      this.use(this.stampTarget);
      const p = this.player;
      if (p.hp > 0) {
        this.hurtPlayer(OSKEL.stamp * this.tierDamage, i, true);
        this.events.push({ type: 'slam', x: p.x, y: p.y, r: 60 });
      }
      this.use(at);
    } else if (id === 'bellowSlam') {
      // Ysmeret's tank hit: lands on the hero picked at wind-up, through dodges and shields.
      const at = this.acting;
      this.use(this.bellowTarget);
      const p = this.player;
      if (p.hp > 0) {
        this.hurtPlayer(YSMERET.bellow * this.tierDamage, i, true);
        this.events.push({ type: 'slam', x: p.x, y: p.y, r: 60 });
      }
      this.use(at);
    } else if (id === 'scatter') {
      // Scatter Embers: every marked hero bursts. Each burst singes its hero a little
      // and hits every other hero inside it hard, so the party must spread out.
      const at = this.acting;
      const r2 = YSMERET.scatterRadius * YSMERET.scatterRadius;
      const n = this.heroes.length;
      const pos = [];
      for (let k = 0; k < n; k++) { const q = this.heroPlayer(k); pos.push({ x: q.x, y: q.y, up: q.hp > 0 }); }
      for (let k = 0; k < n; k++) {
        if (!pos[k].up) continue;
        this.use(k);
        // Grandmother Slag's Cinder Marks keep their own self-burn: the Ashvents' healer check (#424) is Ysmeret's alone.
        let share = this.enemies[i]?.kind === 'grandmotherSlag' ? SLAG.marksSelf : YSMERET.scatterSelf;
        for (let j = 0; j < n; j++) if (j !== k && pos[j].up && dist2(pos[j].x, pos[j].y, pos[k].x, pos[k].y) <= r2) share += YSMERET.scatterOther;
        this.hurtPlayer(this.player.maxHp * share, i, true);
        this.events.push({ type: 'slam', x: pos[k].x, y: pos[k].y, r: YSMERET.scatterRadius });
      }
      this.use(at);
    } else if (id === 'homeward') {
      // The Homeward Hammer: thrown at the hero farthest from him (the tank only if no one else stands).
      const tank = this.targetOf(i, 0);
      const b = this.enemies[i];
      let best = -1, bd = -1;
      for (let pass = 0; pass < 2 && best < 0; pass++) {
        for (let k = 0; k < this.heroes.length; k++) {
          const q = this.heroPlayer(k);
          if (q.hp <= 0 || (pass === 0 && k === tank && this.heroes.length > 1)) continue;
          const dd = dist2(q.x, q.y, b.x, b.y);
          if (dd > bd) { bd = dd; best = k; }
        }
      }
      if (best >= 0) {
        const q = this.heroPlayer(best);
        this.homeX = q.x; this.homeY = q.y;
        const dmg = HOMEWARD.damage * (1 + HOMEWARD.grow * this.choirN);
        this.choirN++;
        this.addTelegraph('circle', q.x, q.y, HOMEWARD.radius, 0, 0, HOMEWARD.fall, dmg, 'hit', i); // scaled by tier as it lands
        this.homeStage = 1;
        this.homeT = HOMEWARD.fall;
        this.events.push({ type: 'homeward', stage: 'out', x: q.x, y: q.y });
      }
    } else if (id === 'ironload') {
      // Mark a hero other than the one holding Ondrel; it lands in `time` s, split among everyone with them.
      const tank = this.targetOf(i, 0);
      const pick: number[] = [];
      for (let k = 0; k < this.heroes.length; k++) if (k !== tank && this.heroPlayer(k).hp > 0) pick.push(k);
      if (!pick.length) for (let k = 0; k < this.heroes.length; k++) if (this.heroPlayer(k).hp > 0) pick.push(k);
      if (pick.length) {
        this.loadHero = pick[this.rng.int(pick.length)];
        this.loadT = IRONLOAD.time;
      }
    } else if (id === 'choir') {
      // Every hero takes a share of their health, a bit more each time: the healer's job.
      const at = this.acting;
      const share = ONDREL.choir + ONDREL.choirGrow * this.choirN;
      this.choirN++;
      this.eachHero(() => this.hurtPlayer(this.player.maxHp * share, i, true));
      this.use(at);
    } else if (id === 'brand') {
      this.markT = GLARE.brandTime;
    } else if (id === 'twinBrand') {
      this.markT = GLARE.brandTime;
      this.markQueued = 1;
    } else if (id === 'gorge') {
      const amount = e.maxHp * 0.1 * this.healTakenMult(e);
      e.hp = Math.min(e.maxHp, e.hp + amount);
      this.events.push({ type: 'heal', x: e.x, y: e.y, amount });
    }
    this.events.push({ type: 'castDone', x: e.x, y: e.y, id, name });
  }

  private runAbilities(i: number, dt: number): void {
    const e = this.enemies[i];
    const p = this.player;
    if (e.castId) {
      if (e.castId === 'kilnDraw') this.kilnDrawPull(i, dt);
      e.castT += dt;
      if (e.castT >= e.castDur) this.finishCast(i);
      return;
    }
    e.abilityT -= dt;
    if (e.kind === 'emberSpitter') {
      // Ember Lob: a slow fire circle where you stand now. Keep moving, or close in on it.
      if (e.abilityT <= 0 && dist2(p.x, p.y, e.x, e.y) < VARIETY.lobRange ** 2) {
        e.abilityT = VARIETY.lobEvery + this.rng.next() * 0.6;
        this.startCast(i, 'emberLob', 'Lob', VARIETY.lobCast, false);
        this.addTelegraph('circle', p.x, p.y, VARIETY.lobRadius, 0, 0, VARIETY.lobLand, VARIETY.lobDamage, 'hit', i);
        this.events.push({ type: 'spitLob', index: i, x1: e.x, y1: e.y, x2: p.x, y2: p.y });
      }
      return;
    }
    if (e.kind === 'ballast') {
      // Anchor Slam: only while planted, a ring round it. Being in its reach is what plants it, so step out.
      if (e.aux >= BALLAST.plantDelay && e.abilityT <= 0) {
        e.abilityT = BALLAST.slamEvery;
        this.startCast(i, 'anchorSlam', 'Anchor Slam', BALLAST.slamCast, false);
        this.addTelegraph('circle', e.x, e.y, BALLAST.slamR + e.def.radius, 0, 0, BALLAST.slamCast, BALLAST.slamDamage, 'hit', i);
      }
      return;
    }
    if (e.kind === 'ashwall') {
      // Shield Bash: a short cone off the front of its shield. Its front is also where it is hard to hurt, so get round it.
      if (e.abilityT <= 0 && dist2(p.x, p.y, e.x, e.y) < (ASHWALL.bashRange + e.def.radius) ** 2) {
        e.abilityT = ASHWALL.bashEvery;
        this.startCast(i, 'shieldBash', 'Shield Bash', ASHWALL.bashCast, false);
        this.addTelegraph('cone', e.x, e.y, ASHWALL.bashRange + e.def.radius, e.aux, ASHWALL.bashArc, ASHWALL.bashCast, ASHWALL.bashDamage, 'hit', i);
      }
      return;
    }
    if (e.kind === 'ashbuck') {
      // Charge: it lines up on you and runs the lane. Step out of the line, not away.
      const dd = dist2(p.x, p.y, e.x, e.y);
      if (e.abilityT <= 0 && e.aux2 <= 0 && dd > VARIETY.chargeMin ** 2 && dd < VARIETY.chargeLen ** 2) {
        e.abilityT = VARIETY.chargeEvery;
        e.aux = Math.atan2(p.y - e.y, p.x - e.x);
        this.startCast(i, 'charge', 'Charge', VARIETY.chargeCast, false);
        this.addTelegraph('cone', e.x, e.y, VARIETY.chargeLen, e.aux, VARIETY.chargeArc, VARIETY.chargeCast, VARIETY.chargeDamage, 'hit', i);
      }
      return;
    }
    if (e.kind === 'cinderBrute') {
      if (e.abilityT <= 0) {
        e.abilityT = 5;
        this.startCast(i, 'groundPound', 'Ground Pound', 1.4, true);
        this.addTelegraph('circle', p.x, p.y, 95, 0, 0, 1.4, 30, 'hit', i);
      }
      return;
    }
    if (e.kind === 'cinderhound') {
      if (e.abilityT <= 0 && dist2(p.x, p.y, e.x, e.y) < 160 * 160) {
        e.abilityT = 3.5 + this.rng.next();
        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        this.startCast(i, 'snap', 'Snap', 0.6, false);
        this.addTelegraph('cone', e.x, e.y, 95, ang, (70 * Math.PI) / 180, 0.6, 12, 'hit', i);
      }
      return;
    }
    if (e.kind === 'husk') {
      if (e.abilityT <= 0 && dist2(p.x, p.y, e.x, e.y) < 220 * 220) {
        e.abilityT = this.firstDelve ? FIRST_DELVE.slamEvery : 4.5;
        this.startCast(i, 'slam', 'Warden Slam', 1.2, false);
        this.addTelegraph('circle', e.x, e.y, 115, 0, 0, 1.2, 24, 'hit', i);
      }
      return;
    }
    if (e.kind === 'ashmaw') {
      // BOSSV2: KILN_V2.gorgeQuiet s with no hit on it and it Gorges, healing gorgeHeal of its max health a second
      // until a hero hits it again (aux2 1 while it Gorges).
      if (this.bossV2) {
        const quiet = this.time - (e.hitAt ?? e.spawnedAt) >= KILN_V2.gorgeQuiet;
        if (quiet && e.hp < e.maxHp) {
          if (!e.aux2) { e.aux2 = 1; this.events.push({ type: 'castDone', x: e.x, y: e.y, id: 'gorgeStart', name: 'Gorge' }); }
          const amount = Math.min(e.maxHp - e.hp, e.maxHp * KILN_V2.gorgeHeal * dt * this.healTakenMult(e));
          e.hp += amount;
          if (Math.floor(this.time * 2) !== Math.floor((this.time - dt) * 2)) this.events.push({ type: 'heal', x: e.x, y: e.y, amount: e.maxHp * KILN_V2.gorgeHeal * 0.5 });
        } else e.aux2 = 0;
      }
      if (e.abilityT <= 0) {
        e.abilityT = 5;
        e.aux++;
        // BOSSV2: no Gorge cast; it Gorges on its own when nobody hits it (above). Nobody to stop it: it spits instead.
        if (e.aux % 2 === 0 && !this.bossV2 && this.partyStops(e)) {
          this.startCast(i, 'gorge', 'Gorge', 2.2, true);
        } else if (e.aux % 2 === 1 || !this.bossV2) {
          const ang = Math.atan2(p.y - e.y, p.x - e.x);
          this.startCast(i, 'spit', 'Ash Spit', 1.0, false);
          this.addTelegraph('cone', e.x, e.y, 260, ang, (60 * Math.PI) / 180, 1.0, 22, 'hit', i);
        }
      }
      return;
    }
    if (e.kind === 'hoarfrostWeaver') {
      if (e.abilityT <= 0) {
        // Frost Lace: a ring at the hero's feet. Quench it, or step out, or take Chill.
        e.abilityT = COLD.laceEvery;
        e.aux = p.x;
        e.aux2 = p.y;
        this.startCast(i, 'frostLace', 'Frost Lace', COLD.laceCast, true);
        this.addTelegraph('circle', p.x, p.y, COLD.laceR, 0, 0, COLD.laceCast, COLD.laceDamage, 'hit', i);
      }
      return;
    }
    if (e.kind === 'nhevra') return; // all on coldClock
    if (e.kind === 'hessa') return; // all on wrackClock
    if (e.kind === 'conchblower') {
      // Phase 16 U2: the conch calls the Ebb sooner. Quench the blast.
      if (e.abilityT <= 0) {
        e.abilityT = CONCH.every;
        this.startCast(i, 'conchCall', 'Conch Call', CONCH.cast, true);
      }
      return;
    }
    if (e.kind === 'bargeHauler') {
      if (e.abilityT <= 0) {
        // Haul: a hook line at its target. Quench it, or get yanked toward the Hauler.
        e.abilityT = WRACK.haulEvery;
        e.aux = this.acting;
        this.startCast(i, 'haul', 'Haul', WRACK.haulCast, true);
        this.addTelegraph('cone', e.x, e.y, WRACK.haulRange, Math.atan2(p.y - e.y, p.x - e.x), (14 * Math.PI) / 180, WRACK.haulCast, 0, 'hit', i);
      }
      return;
    }
    if (e.kind === 'glassWarden' || e.kind === 'emberTwin' || e.kind === 'sluiceCrawler') {
      this.runFoundryElite(i, dt);
      return;
    }
    if (e.kind === 'maelra') {
      this.runMaelra(i, dt);
      return;
    }
    if (e.kind === 'lensbearer' || e.kind === 'brandkeeper') {
      this.runGlareElite(i);
      return;
    }
    if (e.kind === 'lensmother') {
      this.runLensmother(i, dt);
      return;
    }
    if (e.kind === 'ondrel') {
      this.runOndrel(i);
      return;
    }
    if (e.kind === 'ysmeret') return; // all on ysmeretClock
    if (e.kind === 'oskel') return; // all on oskelClock
    if (e.kind === 'grandmotherSlag') return; // all on slagClock
    if (e.kind === 'vorhulm' || e.kind === 'craw' || e.kind === 'colossus' || e.kind === 'regent') return; // all on their raid clocks
    if (e.def.rank !== 'boss') return;
    this.runBoss(i, dt);
  }

  /** Smolderhusk, the Kiln Mother: three phases, interrupts, healers and soaks. */
  private runBoss(i: number, dt: number): void {
    const e = this.enemies[i];
    const p = this.player;
    // The opening: her short two-stage fight, with no enrage (opening.md, "The short Kiln Mother").
    if (this.kmOpen && e.kind === 'kilnMother') { this.runKilnOpening(i, dt); return; }
    if (!this.bossEnraged && this.time - e.spawnedAt > BOSS_ENRAGE_AFTER) {
      this.bossEnraged = true;
      this.events.push({ type: 'bossEnrage' });
    }
    // BOSSV2: stages 1 and 2 are her own; stage 3 is today's last phase, without the Acolytes or the interrupt.
    const v2 = this.kmStage > 0 && e.kind === 'kilnMother';
    if (v2 && this.kmStage < 3) { this.runKilnV2(i, dt); return; }
    // The shadow can't be worn down, so its phases follow the clock instead.
    const frac = e.kind === 'worldShadow' ? 1 - (this.time - e.spawnedAt) / SHADOW_TIME : e.hp / e.maxHp;
    const phase = v2 ? 3 : frac > 0.6 ? 1 : frac > 0.3 ? 2 : 3;
    if (phase > this.bossPhase) {
      this.bossPhase = phase;
      this.events.push({ type: 'phase', phase });
      if (phase === 2) {
        for (const side of [-1, 1]) {
          const a = Math.atan2(p.y - e.y, p.x - e.x) + side * Math.PI / 2;
          const k = this.spawn('acolyte', e.x + Math.cos(a) * ACOLYTE_RING, e.y + Math.sin(a) * ACOLYTE_RING);
          if (k >= 0) {
            this.enemies[k].aux = a;
            this.enemies[k].aux2 = i;
          }
        }
        this.brandT = 3;
      }
    }
    const mult = this.bossEnraged ? 2 : 1;

    // Molten Cataclysm: interrupt it or take a big hit wherever you stand.
    e.aux -= dt;
    if (e.aux <= 0) {
      e.aux = phase === 3 ? 12 : 18;
      // Phase 16 U1: in her last phase every other signature is her echo's.
      let move: string = this.bossVariant;
      if (phase === 3 && this.bossEcho) {
        if (this.echoNext) { move = this.bossEcho; this.events.push({ type: 'echo', id: this.bossEcho }); if (v2 && this.kmSaid.has('stage3')) this.kmSay('oldTricks'); }
        this.echoNext = !this.echoNext;
      }
      if (v2) this.kmSay('stage3');
      if (phase >= 2 && move === 'turning') {
        this.startCast(i, 'turningFire', 'Turning Fire', KILN_TURN.first, false);
        // She's busy pouring: nothing else from her until the last cone lands.
        const pour = KILN_TURN.first + (KILN_TURN.cones - 1) * KILN_TURN.step;
        e.abilityT = Math.max(e.abilityT, pour + 0.5);
        // And no Kiln Brand to soak while the fire turns: one job at a time.
        this.brandT = Math.max(this.brandT, pour + 1);
        // Clockwise or not, in turn, so a player can't learn one way round.
        const dir = (this.turnDir = e.aux2 = e.aux2 > 0 ? -1 : 1);
        const a0 = Math.atan2(p.y - e.y, p.x - e.x);
        for (let k = 0; k < KILN_TURN.cones; k++) {
          this.addTelegraph('cone', e.x, e.y, KILN_TURN.reach, a0 + dir * k * KILN_TURN.arc, KILN_TURN.arc, KILN_TURN.first + k * KILN_TURN.step, KILN_TURN.damage * (this.bossEnraged ? 1.5 : 1), 'hit', i);
        }
        return;
      }
      if (phase >= 2 && move === 'draw') {
        // V3 Kiln Draw: she breathes in and pulls everyone toward her mouth, where the fire lands. Walk out against the pull.
        this.startCast(i, 'kilnDraw', 'Kiln Draw', KILN_DRAW.cast, false);
        // CP3 remake (every boss attack has a melee answer): the fire comes out of her door-mouth, the half of the floor
        // in front of her, facing the hero as she starts. Behind her is safe, in melee reach; the pull keeps you there.
        if (v2) this.addTelegraph('cone', e.x, e.y, KILN_DRAW.frontReach, Math.atan2(p.y - e.y, p.x - e.x), KILN_DRAW.frontArc, KILN_DRAW.cast, KILN_DRAW.damage * (this.bossEnraged ? 1.5 : 1), 'hit', i);
        else this.addTelegraph('circle', e.x, e.y, KILN_DRAW.radius, 0, 0, KILN_DRAW.cast, KILN_DRAW.damage * (this.bossEnraged ? 1.5 : 1), 'hit', i);
        return;
      }
      // BOSSV2: Molten Cataclysm is eruption rings to walk through, not an interrupt.
      if (v2) {
        // CP3 remake: a ringWarn s wind-up (a cast bar, not interruptible) before the first ring rolls, so a hero in
        // melee reach has time to find a gap or roll (vision: 0.8 s or more of warning).
        this.kmClock.rings = KILN_V2.ringN;
        this.kmClock.ringNext = KILN_V2.ringWarn;
        this.startCast(i, 'kmRipple', 'Kiln Ripple', KILN_V2.ringWarn, false);
        this.events.push({ type: 'castDone', x: e.x, y: e.y, id: 'kmRings', name: 'Kiln Ripple' });
        return;
      }
      this.startCast(i, 'cataclysm', 'Kiln Ripple', 3, true);
      return;
    }
    // Kiln Brand: someone has to stand in the gold circle.
    if (phase >= 2) {
      this.brandT -= dt;
      if (this.brandT <= 0) {
        this.brandT = 14;
        const a = this.rng.next() * Math.PI * 2;
        // CP3 remake (melee answers): the gold circle lands at her side, so a melee hero can stand in it and keep hitting.
        if (v2) this.addTelegraph('circle', e.x + Math.cos(a) * KILN_V2.brandOff, e.y + Math.sin(a) * KILN_V2.brandOff, 70, 0, 0, 4, KILN_V2.brandMiss, 'soak', -1);
        else this.addTelegraph('circle', p.x + Math.cos(a) * 150, p.y + Math.sin(a) * 150, 70, 0, 0, 4, 40, 'soak', -1);
      }
    }
    if (e.abilityT > 0) return;
    // BOSSV2: her basic attacks keep today's phase 2 pace from when she comes out, and today's phase 3 pace below 30%
    // (design, 25 Nov); her signature and Brand run on the stage 3 clocks above.
    const pace = v2 ? (frac > 0.3 ? 2 : 3) : phase;
    e.abilityT = this.bossEnraged ? 1.6 : pace === 3 ? 2.4 : 3.2;
    if (v2) {
      // CP3 remake: a longer fight hits less often (stage3Pace), so a glass cannon still lasts 60-90 s.
      e.abilityT = this.bossEnraged ? 1.6 : KILN_V2.stage3Pace[pace === 3 ? 1 : 0];
      // CP3 remake: one basic attack, not three. A hero in her reach gets the stage 1 Swipe (stand at her side or
      // behind); a hero out of it gets a Lob, a red circle at their feet (step or roll out). No Ashling rings: her
      // adds come from the eggs in stage 1.
      const near = Math.hypot(p.x - e.x, p.y - e.y) < KILN_V2.swipeNear;
      if (near) {
        const show = this.kmShow(KILN_V2.swipeShow);
        this.startCast(i, 'kmSwipe', 'Swipe', show, false);
        this.addTelegraph('cone', e.x, e.y, KILN_V2.swipeReach, Math.atan2(p.y - e.y, p.x - e.x), KILN_V2.swipeArc, show, KILN_V2.swipeDamage * mult, 'hit', i);
      } else this.addTelegraph('circle', p.x, p.y, 120, 0, 0, 1.3, KILN_V2.lobDamage * mult);
      return;
    }
    const roll = this.rng.int(3);
    if (roll === 0) {
      this.addTelegraph('circle', p.x, p.y, 120, 0, 0, 1.3, 35 * mult);
      if (pace === 3) {
        const a = this.rng.next() * Math.PI * 2;
        this.addTelegraph('circle', p.x + Math.cos(a) * 170, p.y + Math.sin(a) * 170, 120, 0, 0, 1.6, 35 * mult);
      }
    } else if (roll === 1) {
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      this.addTelegraph('cone', e.x, e.y, 320, ang, (70 * Math.PI) / 180, 1.1, 30 * mult);
    } else {
      const n = pace === 3 ? 10 : 7;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        this.spawn('ashling', e.x + Math.cos(a) * 260, e.y + Math.sin(a) * 260);
      }
    }
  }

  /** The opening's short Kiln Mother starts in stage 1 (called when she spawns on a first delve). */
  private kmOpenStart(): void {
    this.kmOpen = 1;
    this.kmOpenClock = { swipe: FIRST_DELVE.boss.swipeFirst, cast: 0 };
    this.kmSaid.clear();
    this.kmSayQ = [];
    this.kmSay('enter', KILN_V2.sayDelay);
  }

  /** The opening's short Kiln Mother: her lines, once a step (her fall line too, which comes after her last step). */
  private kmOpenTalk(): void {
    const boss = this.bossIndex >= 0 ? this.enemies[this.bossIndex] : undefined;
    this.kmTalk(!!boss?.alive && boss.kind === 'kilnMother', boss);
  }

  /**
   * The opening's short Kiln Mother (opening.md, "The short Kiln Mother"; FIRST_DELVE.boss). Stage 1: a Swipe (a red
   * cone at the hero, shown ahead) every few seconds. Stage 2 from half health: slower Swipes, plus one blue cast (Kiln
   * Ripple) to Quench. No eggs, bellows, gold circles, adds, Boil-over or Old Tricks: those are taught in the remade
   * fight. One thing at a time: a move that comes due while she's casting waits for the cast to end.
   */
  private runKilnOpening(i: number, dt: number): void {
    const e = this.enemies[i];
    const p = this.player;
    const B = FIRST_DELVE.boss, c = this.kmOpenClock;
    if (this.kmOpen === 1 && e.hp <= e.maxHp * B.stage2At) {
      this.kmOpen = 2;
      this.bossPhase = 2;
      this.events.push({ type: 'phase', phase: 2 });
      this.kmSay('stage2', KILN_V2.sayDelay);
      c.cast = B.castFirst;
      c.swipe = Math.max(c.swipe, B.castFirst + B.castTime + 1);
    }
    c.swipe -= dt;
    if (this.kmOpen === 2) c.cast -= dt;
    if (e.castId) return;
    if (this.kmOpen === 2 && c.cast <= 0) {
      c.cast = B.castEvery;
      if (this.startCast(i, 'cataclysm', 'Kiln Ripple', B.castTime, true)) {
        c.swipe = Math.max(c.swipe, B.castTime + 1);
        return;
      }
    }
    if (c.swipe > 0) return;
    c.swipe = B.swipeEvery[this.kmOpen - 1];
    const show = this.kmShow(B.swipeShow);
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    this.startCast(i, 'kmSwipe', 'Swipe', show, false);
    this.addTelegraph('cone', e.x, e.y, B.swipeReach, a, B.swipeArc, show, B.swipeDamage, 'hit', i);
  }

  /** BOSSV2: the Kiln Mother's fight starts in stage 1 (called when she spawns). */
  private kmStart(): void {
    this.kmStage = 1;
    this.kmInKiln = false;
    this.kmClock = { swipe: KILN_V2.swipeEvery, egg: KILN_V2.eggFirst, kiln: 0, heat: 0, tick: 0, rings: 0, ringNext: 0, vuln: 0, bellows: 0 };
    this.kmHeat = { safe: 0, warn: 0, on: false };
    for (const g of this.kmEggs) g.alive = false;
    for (const r of this.kmRings) r.alive = false;
    this.kmSaid.clear();
    this.kmSayQ = [];
    this.kmSay('enter', KILN_V2.sayDelay);
  }

  /** CP3 remake: queue one of her taunts, `delay` s from now (after the stage banner), once per fight. */
  private kmSay(say: KilnSay, delay = 0): void {
    if (this.kmSaid.has(say)) return;
    this.kmSaid.add(say);
    this.kmSayQ.push({ say, at: this.time + delay });
  }

  /** Where she stands in the kiln mouth (the north wall, KILN_V2.mouthIn inside it). */
  private kmSpotY(): number {
    return -(this.arenaR - KILN_V2.mouthIn);
  }

  /** A telegraph's shown time on this run: design, 25 Nov, a Halls run shows them 1/moveScale as long. */
  private kmShow(t: number): number {
    return t / this.moveScale;
  }

  /** BOSSV2 stages 1 and 2 (design's kiln-mother-v2.md). */
  private runKilnV2(i: number, dt: number): void {
    const e = this.enemies[i];
    const p = this.player;
    const K = KILN_V2, c = this.kmClock;
    if (this.kmStage === 1) {
      if (e.hp / e.maxHp <= K.stage2At) {
        // Stage 2: she heads for the kiln (the walk is in updateEnemies); her swipe and eggs stop.
        this.kmStage = 2;
        this.bossPhase = 2;
        this.events.push({ type: 'phase', phase: 2 });
        this.kmSay('stage2', KILN_V2.sayDelay);
        if (e.castId) this.cancelCast(i);
        return;
      }
      // Swipe: she turns to the nearest hero, shows the cone, and holds her facing.
      c.swipe -= dt;
      if (c.swipe <= 0) {
        c.swipe = K.swipeEvery;
        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        const show = this.kmShow(K.swipeShow);
        this.startCast(i, 'kmSwipe', 'Swipe', show, false);
        this.addTelegraph('cone', e.x, e.y, K.swipeReach, ang, K.swipeArc, show, K.swipeDamage * (this.bossEnraged ? 1.5 : 1), 'hit', i);
      }
      // Ember eggs on the far side of her from the nearest hero.
      c.egg -= dt;
      if (c.egg <= 0) {
        c.egg = K.eggEvery;
        const away = Math.atan2(e.y - p.y, e.x - p.x);
        for (let k = 0; k < K.eggN; k++) {
          const g = this.kmEggs.find((q) => !q.alive);
          if (!g) break;
          const a = away + (this.rng.next() - 0.5) * K.eggSpread;
          const d = K.eggMin + (K.eggMax - K.eggMin) * this.rng.next();
          const o = { x: e.x + Math.cos(a) * d, y: e.y + Math.sin(a) * d };
          this.clampArena(o, K.eggR);
          Object.assign(g, { x: o.x, y: o.y, t: 0, dur: K.eggHatch, alive: true });
        }
      }
      return;
    }
    // Stage 2: in the kiln. The bellows come with her; break all 3 and she falls out stunned, or after kilnMax s she
    // comes out on her own. Either way stage 3 starts.
    if (!this.kmInKiln) return;
    if (c.kiln === 0) {
      // CP3 remake: one bellows at a time, each in the cool quarter as it turns cool (kmTick), so the stage lasts about
      // bellowsN heat steps for every class instead of ending as fast as a ranged class can shoot three.
      c.bellows = 0;
      c.heat = 0;
      this.kmHeat.safe = 3; // the first step moves it to 0 (east)
    }
    c.kiln += dt;
    const left = c.bellows < K.bellowsN || this.enemies.some((o) => o.alive && o.kind === 'kilnBellows');
    if (!left || c.kiln >= K.kilnMax) {
      for (let k = 0; k < this.enemies.length; k++) if (this.enemies[k].alive && this.enemies[k].kind === 'kilnBellows') this.despawn(k);
      this.kmInKiln = false;
      this.kmStage = 3;
      this.kmHeat.on = false;
      this.kmHeat.warn = 0;
      e.y = this.kmSpotY() + K.fallOut;
      e.aux = K.sigFirst;
      this.brandT = K.brandFirst;
      if (!left) {
        e.stunT = K.stun;
        c.vuln = this.time + K.stun;
        this.events.push({ type: 'castDone', x: e.x, y: e.y, id: 'kmFallen', name: 'She Falls Out' });
        this.kmSay('fallen', KILN_V2.sayDelay);
      } else {
        this.events.push({ type: 'castDone', x: e.x, y: e.y, id: 'kmOut', name: 'Out of the Kiln' });
        this.kmSay('kilnOut', KILN_V2.sayDelay);
      }
    }
  }

  /** BOSSV2: eggs, the heated quarters and the eruption rings, once a step for the whole party. */
  private kmTick(dt: number): void {
    const K = KILN_V2, c = this.kmClock;
    const boss = this.bossIndex >= 0 ? this.enemies[this.bossIndex] : undefined;
    const live = !!boss?.alive && boss.kind === 'kilnMother';
    for (const g of this.kmEggs) {
      if (!g.alive) continue;
      let touched = false;
      this.eachHero(() => { if (dist2(this.player.x, this.player.y, g.x, g.y) < (K.eggR + PLAYER_RADIUS) ** 2) touched = true; });
      if (touched || !live) {
        g.alive = false;
        if (touched) { this.events.push({ type: 'castDone', x: g.x, y: g.y, id: 'kmEggStamped', name: '' }); this.kmSay('eggStamp'); }
        continue;
      }
      g.t += dt;
      if (g.t >= g.dur) {
        g.alive = false;
        for (let k = 0; k < K.eggAshlings; k++) {
          const a = (k / K.eggAshlings) * Math.PI * 2;
          this.spawn('ashling', g.x + Math.cos(a) * 20, g.y + Math.sin(a) * 20);
        }
        this.events.push({ type: 'castDone', x: g.x, y: g.y, id: 'kmEggHatch', name: 'Hatched' });
        this.kmSay('eggHatch');
      }
    }
    // Heat: every heatEvery s the safe quarter steps clockwise; the other three are shown heatWarn s, then burn.
    if (this.kmInKiln && live) {
      const h = this.kmHeat;
      c.heat -= dt;
      if (c.heat <= 0) {
        c.heat = K.heatEvery;
        h.safe = (h.safe + 1) % 4;
        h.warn = this.kmShow(K.heatWarn);
        h.on = false;
        if (c.bellows < K.bellowsN) {
          c.bellows++;
          const a = (h.safe * Math.PI) / 2;
          this.spawn('kilnBellows', Math.cos(a) * K.bellowsRing, Math.sin(a) * K.bellowsRing);
        }
      }
      if (h.warn > 0) {
        h.warn -= dt;
        if (h.warn <= 0) { h.warn = 0; h.on = true; c.tick = 0; }
      }
      if (h.on) {
        c.tick -= dt;
        if (c.tick <= 0) {
          c.tick += K.heatTick;
          this.eachHero(() => {
            const p = this.player;
            if (p.hp > 0 && this.kmQuarter(p.x, p.y) !== h.safe) this.hurtPlayer(p.maxHp * K.heatShare, -1, false, 'Kiln Heat');
          });
        }
      }
    } else if (this.kmHeat.on || this.kmHeat.warn) { this.kmHeat.on = false; this.kmHeat.warn = 0; }
    // Eruption rings: one a second while any are left to roll, each hitting a hero once unless they stand in a gap.
    if (c.rings > 0 && live) {
      c.ringNext -= dt;
      if (c.ringNext <= 0) {
        const r = this.kmRings.find((q) => !q.alive);
        c.rings--;
        c.ringNext = K.ringEvery;
        if (r) {
          const g1 = this.rng.next() * Math.PI * 2;
          const g2 = g1 + Math.PI * (0.5 + this.rng.next());
          Object.assign(r, { x: boss!.x, y: boss!.y, r: boss!.def.radius, w: K.ringW, gaps: [g1, K.ringGap, angleDiff(g2, 0), K.ringGap], alive: true, hit: 0 });
        }
      }
    } else if (!live) c.rings = 0;
    for (const r of this.kmRings) {
      if (!r.alive) continue;
      const was = r.r;
      r.r += K.ringSpeed * this.moveScale * dt;
      if (was > this.arenaR * 1.5 || !live) { r.alive = false; continue; }
      this.eachHero((hi) => {
        const p = this.player;
        if (r.hit & (1 << hi) || p.hp <= 0) return;
        const d = Math.hypot(p.x - r.x, p.y - r.y);
        // The band sweeps from was to r.r this step: a hero it crossed is hit, unless they stand in a gap.
        if (d + PLAYER_RADIUS < was - r.w / 2 || d - PLAYER_RADIUS > r.r + r.w / 2) return;
        const a = Math.atan2(p.y - r.y, p.x - r.x);
        for (let k = 0; k < r.gaps.length; k += 2) if (Math.abs(angleDiff(a, r.gaps[k])) < r.gaps[k + 1] / 2) return;
        r.hit |= 1 << hi;
        this.hurtPlayer(K.ringDamage * (this.bossEnraged ? 1.5 : 1) * this.tierDamage, this.bossIndex, false, 'Kiln Ripple');
      }, true);
    }
    this.kmTalk(live, boss);
  }

  /** CP3 remake: her taunts for the hero's state and the fight's end, then any queued line that is due. */
  private kmTalk(live: boolean, boss: Enemy | undefined): void {
    if (boss?.kind !== 'kilnMother') return;
    let up = false, low = false;
    this.eachHero(() => { if (this.player.hp > 0) { up = true; if (this.player.hp < this.player.maxHp * 0.3) low = true; } });
    if (!live && !boss.alive) { this.kmSayQ = []; this.kmSay('sheFalls'); }
    else if (!up) { this.kmSayQ = []; this.kmSay('heroFalls'); }
    else if (low && !this.kmOpen) this.kmSay('heroLow');
    for (let k = 0; k < this.kmSayQ.length; k++) {
      const q = this.kmSayQ[k];
      if (q.at > this.time) continue;
      this.events.push({ type: 'bossSay', say: q.say, line: (this.kmOpen ? FIRST_DELVE.says[q.say] : undefined) ?? kilnTaunt(q.say, this.seed) });
      this.kmSayQ.splice(k--, 1);
    }
  }

  /** Which heat quarter (0 east, 1 south, 2 west, 3 north; y down) the point is in. */
  kmQuarter(x: number, y: number): number {
    const a = Math.atan2(y, x);
    return ((Math.round(a / (Math.PI / 2)) % 4) + 4) % 4;
  }

  /** Kiln Draw: each living hero slides toward the Kiln Mother while she breathes in, stopping at her edge. */
  private kilnDrawPull(i: number, dt: number): void {
    const e = this.enemies[i];
    this.eachHero(() => {
      const p = this.player;
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      const room = d - e.def.radius - PLAYER_RADIUS;
      if (room <= 0 || d > KILN_DRAW.reach) return;
      const step = Math.min(room, KILN_DRAW.pull * dt);
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
    });
  }

  private damageEnemy(i: number, amount: number, canCrit: boolean, silent = false, forceCrit = false): void {
    const e = this.enemies[i];
    if (!e.alive) return;
    // BOSSV2: from stage 2's start (the walk in, then inside the kiln) she can't be hit; fallen out, she takes double
    // for KILN_V2.stun s.
    if (e.kind === 'kilnMother' && this.kmStage === 2) return;
    e.hitAt = this.time;
    let dmg = amount;
    if (e.kind === 'kilnMother' && this.time < this.kmClock.vuln) dmg *= KILN_V2.stunTaken;
    let crit = false;
    if (e.def.rank !== 'normal' && this.hasMythic('giantsBane')) dmg *= 1.3;
    if (e.burnT > 0) dmg *= 1 + 0.1 * this.rank('hemorrhage') + TREE.torrentDmg * this.tree('torrent') + TREE.ablazeDmg * this.tree('ablaze');
    // Steadfast (Duskblade tree keystone): harder hits while the Duskblade stays above half health.
    // Glow (Emberwright tree keystone) works the same way.
    if (this.tree('steadfast') > 0 && this.player.hp >= this.player.maxHp * 0.5) dmg *= 1 + TREE.steadfastDmg;
    if (this.tree('glow') > 0 && this.player.hp >= this.player.maxHp * 0.5) dmg *= 1 + TREE.glowDmg;
    if (this.tree('serene') > 0 && this.player.hp >= this.player.maxHp * 0.5) dmg *= 1 + TREE.sereneDmg;
    if (this.tree('core') > 0 && this.player.hp >= this.player.maxHp * 0.5) dmg *= 1 + TREE.coreDmg;
    // Glaze (Slagbinder tree keystone): harder hits while the Slagbinder's own plating holds.
    if (this.tree('glaze') > 0 && (this.player.plate ?? 0) > 0 && (this.player.plateUntil ?? -1) > this.time) dmg *= 1 + TREE.glazeDmg;
    // Breach (Slagbinder tree keystone): harder on a Brittle foe.
    if (this.tree('breach') > 0 && (e.brittleUntil ?? 0) > this.time) dmg *= 1 + TREE.breachDmg;
    // Refrain (Lumen tree keystone): harder on a foe standing in the Lumen's Sanctuary.
    if (this.tree('refrain') > 0 && this.player.sanctT > 0 && dist2(this.player.sanctX, this.player.sanctY, e.x, e.y) <= (this.sanctuaryRadius + e.def.radius) ** 2) dmg *= 1 + TREE.refrainDmg;
    // Character tree, Kickback: harder on a foe that hit this hero in the last few seconds.
    if (e.struckBy === this.acting && this.time - (e.struckAt ?? -99) < TREE.kickbackWindow) dmg *= 1 + TREE.kickbackDmg * this.tree('kickback');
    // Turned Back (party card): the boss is busy with someone else.
    if (i === this.bossIndex && this.rank('turnedBack') > 0) {
      const k = this.bossTarget;
      if (k >= 0 && k !== this.acting) dmg *= 1 + PARTY_CARDS.turnedBack * this.rank('turnedBack');
    }
    // Brittle (Slagbinder): cracked slag on the foe, so every hero hits it harder.
    if ((e.brittleUntil ?? 0) > this.time) dmg *= this.cls === 'slagbinder' ? SLAG_KIT.brittleMult : SLAG_KIT.allyBrittle;
    dmg *= this.setDamageMult(e, silent);
    // Slag Wade: a Slagbinder standing in lava hits harder and leaves the foe Brittle (its own hits, not burn ticks).
    if (!this.burnTick && this.rank('slagWade') > 0 && this.inLava()) {
      dmg *= 1 + SITE_CARDS.wadeDmg * this.rank('slagWade');
      this.makeBrittle(i);
    }
    // Thin Ice: while the river is open, Nhevra's own footing is broken and she takes more.
    if (e.kind === 'nhevra' && this.coldPhase >= 2 && this.riverOpen()) dmg *= 1 + COLD.thinIceExposed;
    // The Cinder Colossus: plated in front, open behind, until Meltdown cracks the plate.
    if (e.kind === 'colossus' && this.bossPhase < 3) {
      // A burn or bleed ticks while the boss's target is swapped in, so judge it from whoever lit it.
      const by = this.burnTick && e.burnBy !== undefined && e.burnBy < this.heroes.length ? this.heroPlayer(e.burnBy) : this.player;
      dmg *= this.colossusSide(e, by.x, by.y);
    }
    // Phase 16 U2: a planted Ballast barely feels hits (its glance sounds like the Ashwall's).
    let glance = false;
    if (e.kind === 'ballast' && e.aux >= BALLAST.plantDelay) { dmg *= BALLAST.planted; glance = true; }
    // Phase 16 U2: an Ashwall's shield takes the hits on its front, and on the foes sheltering behind it.
    if (this.ashwallUp()) {
      const by = this.burnTick && e.burnBy !== undefined && e.burnBy < this.heroes.length ? this.heroPlayer(e.burnBy) : this.player;
      const m = this.ashwallTaken(i, by.x, by.y);
      dmg *= m;
      glance = m < 1;
    }
    // Backstab (Cutwick): a direct hit from behind always crits.
    const backstab = canCrit && !this.burnTick && this.cls === 'duskblade' && this.behindFoe(e);
    if (backstab || forceCrit || (canCrit && this.rng.chance(this.critChance))) {
      dmg *= 2 + 0.1 * this.rank('brightWick') + TREE.glintCrit * this.tree('glint') + TREE.noondayCrit * this.tree('noonday');
      crit = true;
      // Ignition rank 2: crits bring Flame Wave back sooner.
      if (this.rank('ignition') >= 2) this.player.cds[0] = Math.max(0, this.player.cds[0] - 0.3);
      // Searing Bloom: the crit bursts onto foes around the target (the splash can't crit, so it can't chain).
      if (this.rank('searingBloom') > 0) {
        const splash = dmg * CAPSTONES_2.bloomShare;
        const br = CAPSTONES_2.bloomRadius;
        this.forEachNear(e.x, e.y, br + 40, (j) => {
          if (j === i) return;
          const o = this.enemies[j];
          if (dist2(e.x, e.y, o.x, o.y) > (br + o.def.radius) ** 2) return;
          this.damageEnemy(j, splash, false, true);
        });
        this.events.push({ type: 'explode', x: e.x, y: e.y, r: br });
        // ...and sets the target burning, so it still pays against a lone boss.
        e.burnDps = Math.max(e.burnDps, CAPSTONES_2.bloomBurnDps * this.dmgMult);
        e.burnT = Math.max(e.burnT, CAPSTONES_2.bloomBurnTime);
        e.burnBy = this.acting;
      }
    }
    if (e.kind === 'maelra') dmg *= 1 - FOUNDRY.temperCut * this.temper;
    if (e.kind === 'shade' && this.shadowed(e.x, e.y)) dmg *= GLARE.shadeShadowTaken;
    if (e.kind === 'frostWarden') dmg *= this.warmthAt(e.x, e.y, e.def.radius) > 0 ? COLD.wardenWarm : COLD.wardenCold;
    if (e.kind === 'glassWarden' && e.aux2 > 0 && !this.invulnerable) {
      // Mirror Ward: part of the damage comes back at the attacker.
      this.hurtPlayer(dmg * FOUNDRY.mirrorReflect, -1, false, 'its Mirror Ward');
    }
    if (e.ward > 0) {
      const soak = Math.min(e.ward, dmg);
      e.ward -= soak;
      dmg -= soak;
    }
    e.hp -= dmg;
    // Phase 14 X5: a named foe in the Coldmarrow feeds the hitter's coal for each tenth of its health they take,
    // so one long fight with a 2x elite (and nothing dying) doesn't run the coal dry.
    if (e.named >= 0 && dmg > 0 && this.dungeonId === 'coldmarrow' && this.player.coal !== undefined) {
      const tenths = (hp: number) => Math.floor(((e.maxHp - Math.max(0, hp)) / e.maxHp) * 10);
      const steps = tenths(e.hp) - tenths(e.hp + dmg);
      if (steps > 0) this.player.coal = Math.min(1, this.player.coal + steps * COLD.namedFeed);
    }
    if (!e.warded && e.hp > 0 && e.hp < e.maxHp * 0.5 && this.hasOmen('warded') && !this.stress) {
      e.warded = true;
      e.ward = e.maxHp * OMEN_TUNING.wardShare;
      this.events.push({ type: 'ward', index: i, amount: e.ward });
    }
    this.damageDealt += dmg;
    if (this.threat.length) damageThreat(this.threat[i], this.heroes[this.acting].id, dmg, this.threatMult);
    // The shadow fight and the raid bosses all count triple toward the world boss (a raid only while its boss is the live one: raidCountsTriple).
    if (e.kind === 'worldShadow' || e.kind === 'grandmotherSlag' || e.kind === 'vorhulm' || e.kind === 'colossus' || e.kind === 'regent') this.shadowDamage += dmg;
    // Wheel turns on whoever hurt him most lately.
    if (e.kind === 'colossus') this.colDmg[this.acting] = (this.colDmg[this.acting] ?? 0) + dmg;
    const thirst = this.rank('thirst');
    const leech = 0.02 * thirst + TREE.leechHeal * this.tree('leech');
    if (leech > 0) this.player.hp = Math.min(this.player.maxHp, this.player.hp + dmg * leech);
    if (!silent) {
      e.flash = 0.08;
      this.events.push({ type: 'hit', x: e.x, y: e.y, amount: dmg, crit, hero: this.acting, ...(glance ? { glance: true as const } : {}) });
    }
    if (canCrit && this.hasMythic('splittingCinders')) {
      let other = -1;
      this.forEachNear(e.x, e.y, 70, (j) => {
        if (other < 0 && j !== i) other = j;
      });
      if (other >= 0) this.damageEnemy(other, dmg * 0.15, false, true);
    }
    if (backstab && !silent) this.events.push({ type: 'backstab', x: e.x, y: e.y, hero: this.acting });
    if (e.hp <= 0) {
      // Backstab: a killing blow from behind readies Rending Dash (not an option swapped onto Q).
      if (backstab && !this.isAlt(0)) this.player.cds[0] = 0;
      this.killEnemy(i);
    }
  }

  /** Verb set damage bonuses (R4). `silent` hits (damage over time) don't spend a Tidewalker charge. */
  private setDamageMult(e: Enemy, silent: boolean): number {
    const p = this.player;
    let m = 1;
    if ((p.kbT ?? 0) > 0) m *= 1 + SET_TUNING.kbDamage;
    if ((e.exposedT ?? 0) > 0) m *= 1 + SET_TUNING.kbExposed;
    if ((e.staggerT ?? 0) > 0) m *= FIRST_DELVE.stagger.taken;
    if ((p.gwT ?? 0) > 0) m *= 1 + SET_TUNING.gwDamage;
    if ((p.warmth ?? 0) > 0) m *= 1 + SET_TUNING.hkDamage * (p.warmth ?? 0);
    if (p.planted && this.setCount('wrackrider') >= 3) m *= 1 + SET_TUNING.wrDamage;
    if ((p.bondT ?? 0) > 0) m *= 1 + SET_TUNING.knBond;
    if ((p.relayT ?? 0) > 0) m *= 1 + SET_TUNING.rlDamage;
    if ((p.freedT ?? 0) > 0) m *= 1 + SET_TUNING.csFreed;
    if (e.kind === 'craw' && this.setCount('crawsplitter') >= 2) m *= 1 + SET_TUNING.csCraw;
    if (e.kind === 'colossus' && this.setCount('platewalker') >= 3 && this.behindColossus(e, p.x, p.y)) m *= 1 + SET_TUNING.pwDamage;
    if ((p.spentT ?? 0) > 0 && this.setCount('handover') >= 3) m *= 1 + SET_TUNING.hoDamage;
    if (this.heroes.length > 1 && this.setCount('ventwalker') >= 2 && this.splitFromAllies()) m *= 1 + SET_TUNING.vwDamage;
    if (p.surge && !silent) {
      p.surge = false;
      p.moveT = 0;
      m *= 1 + SET_TUNING.twSurge;
    }
    return m;
  }

  /** Ticks the verb set timers for the acting hero. */
  private updateSets(moving: boolean, dt: number): void {
    const p = this.player;
    p.moving = moving;
    if ((p.kbT ?? 0) > 0) p.kbT = (p.kbT ?? 0) - dt;
    if ((p.gwT ?? 0) > 0) p.gwT = (p.gwT ?? 0) - dt;
    if ((p.coverT ?? 0) > 0) p.coverT = (p.coverT ?? 0) - dt;
    if ((p.bondT ?? 0) > 0) p.bondT = (p.bondT ?? 0) - dt;
    if ((p.relayT ?? 0) > 0) p.relayT = (p.relayT ?? 0) - dt;
    if ((p.freedT ?? 0) > 0) p.freedT = (p.freedT ?? 0) - dt;
    if ((p.spentT ?? 0) > 0) p.spentT = Math.max(0, (p.spentT ?? 0) - dt);
    if ((p.warmth ?? 0) > 0) {
      p.warmT = (p.warmT ?? 0) + dt;
      if (p.warmT >= SET_TUNING.hkFade) { p.warmT -= SET_TUNING.hkFade; p.warmth = (p.warmth ?? 0) - 1; }
    }
    if (this.setCount('tidewalker') >= 3) {
      p.moveT = moving ? (p.moveT ?? 0) + dt : 0;
      if ((p.moveT ?? 0) >= SET_TUNING.twCharge) p.surge = true;
    }
    if (this.setCount('wrackrider') >= 2) {
      // Standing still for wrStill plants you; walking off keeps you Planted for wrHold more.
      p.stillT = moving ? 0 : (p.stillT ?? 0) + dt;
      if (p.stillT >= SET_TUNING.wrStill || (this.rafts.length > 0 && this.onRaft(p.x, p.y))) p.plantT = SET_TUNING.wrHold;
      else if ((p.plantT ?? 0) > 0) p.plantT = (p.plantT ?? 0) - dt;
      p.planted = (p.plantT ?? 0) > 0;
    }
  }

  /**
   * Mastery card: a red tell that landed. It counts when the hero stood in it as it appeared or as it landed; it is
   * dodged when the hero walked out, or stood in it while a roll's guard was up (rolled through).
   */
  private countTell(p: Player, wasIn: boolean, inside: boolean): void {
    if (!wasIn && !inside) return;
    p.tells = (p.tells ?? 0) + 1;
    if (!inside || ((p.rollT ?? 0) > 0 && p.shieldT > 0)) p.dodges = (p.dodges ?? 0) + 1;
  }

  /** Glarewarden: the hero stepped out of a marked attack before it landed. */
  private dodged(): void {
    const n = this.setCount('glarewarden');
    if (n < 2 || this.time < (this.player.gwReadyAt ?? 0)) return;
    this.player.gwReadyAt = this.time + SET_TUNING.gwEvery;
    const healed = this.healPlayer(this.player.maxHp * SET_TUNING.gwHeal);
    if (n >= 3) this.player.gwT = SET_TUNING.gwTime;
    this.events.push({ type: 'dodge', x: this.player.x, y: this.player.y, healed });
  }

  /**
   * Kinbound: the acting hero just covered ally `k` (a heal, or with `taunt` a taunt off it).
   * A healed ally wearing 2 pieces is Covered; a coverer wearing 3 Bonds itself and the ally.
   */
  private kinCover(k: number, taunted = false): void {
    const a = this.heroes[k].player;
    if (!taunted && (this.heroes[k].loadout.sets?.kinbound ?? 0) >= 2) a.coverT = SET_TUNING.knTime;
    if (this.setCount('kinbound') >= 3) {
      a.bondT = SET_TUNING.knTime;
      this.player.bondT = SET_TUNING.knTime;
    }
  }

  /** Ventwalker: an ally is alive, and none is within range of the acting hero. */
  private splitFromAllies(): boolean {
    const p = this.player;
    const r2 = SET_TUNING.dgRange * SET_TUNING.dgRange;
    let alive = false;
    for (let k = 0; k < this.heroes.length; k++) {
      if (k === this.acting) continue;
      const q = this.heroPlayer(k);
      if (q.hp <= 0) continue;
      if (dist2(p.x, p.y, q.x, q.y) <= r2) return false;
      alive = true;
    }
    return alive;
  }

  /** Deepguard (group set): the damage multiplier for the acting hero from its own pieces and from a nearby ally's 3-piece guard. */
  private deepguardMult(): number {
    const p = this.player;
    const r2 = SET_TUNING.dgRange * SET_TUNING.dgRange;
    const mine = this.setCount('deepguard');
    let near = false;
    let guarded = false;
    for (let k = 0; k < this.heroes.length; k++) {
      if (k === this.acting) continue;
      const q = this.heroPlayer(k);
      if (q.hp <= 0 || dist2(p.x, p.y, q.x, q.y) > r2) continue;
      near = true;
      if ((this.heroes[k].loadout.sets?.deepguard ?? 0) >= 3) guarded = true;
    }
    let m = 1;
    if (near && mine >= 2) m *= 1 - SET_TUNING.dgCut;
    if (guarded) m *= 1 - SET_TUNING.dgAura;
    return m;
  }

  /** How many pieces of a verb set the acting hero wears. */
  setCount(id: SetId): number {
    return this.loadout.sets?.[id] ?? 0;
  }

  hasMythic(id: Loadout['mythics'][number]): boolean {
    return this.loadout.mythics.includes(id);
  }

  hasWeaponFx(id: Loadout['weaponFx'][number]): boolean {
    return this.loadout.weaponFx.includes(id);
  }

  private killEnemy(i: number): void {
    const e = this.enemies[i];
    if (e.castId) this.cancelCast(i);
    if (e.lungeW > 0 || e.lungeD > 0) this.stopLunge(i);
    e.alive = false;
    this.aliveEnemies--;
    this.kills++;
    this.events.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind });
    if (this.dungeonId === 'coldmarrow' && COLD_FED_BY.includes(e.kind) && this.player.coal !== undefined) {
      // A frost-touched kill feeds the killer's Hearthcoal.
      const feed = (e.kind === 'snuffer' ? COLD.snufferFeed : COLD.feed) * (this.setCount('hearthkeeper') >= 2 ? 1 + SET_TUNING.hkFeed : 1);
      this.player.coal = Math.min(1, this.player.coal + feed);
    }
    if (this.setCount('hearthkeeper') >= 2) {
      // Hearthkeeper: every kill stokes a Warmth.
      this.player.warmth = Math.min(SET_TUNING.hkMax, (this.player.warmth ?? 0) + 1);
      this.player.warmT = 0;
    }
    this.omensOnKill(e);
    // Spreading Coals: a foe that dies burning passes its fire to its neighbours.
    if (e.burnT > 0 && this.rank('pyroclasm') > 0) {
      const dps = e.burnDps;
      this.forEachNear(e.x, e.y, 110, (j) => {
        const n = this.enemies[j];
        if (j === i || dist2(e.x, e.y, n.x, n.y) > 80 * 80) return;
        n.burnDps = Math.max(n.burnDps, dps);
        n.burnT = Math.max(n.burnT, 3);
        n.burnBy = this.acting;
      });
    }
    if (e.kind === 'emberTwin') this.twinFell(e.maxHp);
    if (e.kind === 'craw') this.crawBroken();
    if (e.burnT > 0 && this.rank('crimsonTide') > 0) {
      // Crimson Tide: the bleed bursts onto everything close by.
      const bleed = Math.max(e.burnDps, 14 * this.dmgMult);
      this.forEachNear(e.x, e.y, 120, (j) => {
        const o = this.enemies[j];
        if (dist2(e.x, e.y, o.x, o.y) > 120 * 120) return;
        o.burnDps = Math.max(o.burnDps, bleed);
        o.burnT = Math.max(o.burnT, 4);
        o.burnBy = this.acting;
      });
      this.events.push({ type: 'explode', x: e.x, y: e.y, r: 120 });
    }
    // YSMERETV2 stage 2: the flames share one health, so when one goes out the other does too (and that one is the win).
    if (e.kind === 'ysmeret' && this.ysStage === 2) {
      const other = this.enemies.findIndex((o, j) => j !== i && o.alive && o.kind === 'ysmeret');
      if (other >= 0) { this.bossIndex = other; this.enemies[other].hp = 0; this.killEnemy(other); return; }
    }
    if (e.def.rank === 'boss') {
      this.victory = true;
      // The run ends on this tick (or moves to the shadow fight), so boss loot goes straight to the bags.
      // The first time you beat a tier, the boss's item is at least FIRST_CLEAR_LADDER's rarity; otherwise it rolls on the boss table.
      // Every hero in the party gets their own boss item (not only whoever landed the
      // killing blow). Group dungeons add a second boss-table item each, but only
      // for a real party: a bot-filled run pays like a solo one.
      const raid = !!this.dungeonDef.raid;
      // The better of the first-clear ladder and a raid's guaranteed Epic.
      const floors: Rarity[] = ['common'];
      if (this.firstClear) floors.push(firstClearRarity(this.tier));
      if (raid && RAID_LOOT.epic) floors.push('epic');
      const min = floors.reduce((a, b) => (RARITIES.indexOf(b) > RARITIES.indexOf(a) ? b : a));
      const group = this.dungeonDef.style === 'group' && this.fillBots === 0;
      const give = () => {
        this.pickUp(this.withSet(this.makeItem('boss', min)));
        if (group) this.pickUp(this.makeItem('boss'));
        if (raid) for (let k = 0; k < RAID_LOOT.extra; k++) this.pickUp(this.makeItem('boss'));
      };
      if (this.heroes.length === 1) give();
      else {
        const at = this.acting;
        for (let k = 0; k < this.heroes.length; k++) {
          this.use(k);
          give();
        }
        this.use(at);
      }
      // The raid's boss is the world boss in person: no shadow fight after her.
      if (this.worldBoss && !this.dungeonDef.raid && !this.route.includes('worldShadow')) {
        this.route.push('worldShadow');
        // Clear the field so the bonus fight starts clean.
        for (let j = 0; j < this.enemies.length; j++) if (this.enemies[j].alive) this.despawn(j);
      }
      return;
    }
    if (e.kind === 'rift') {
      this.addHeat(20);
      this.events.push({ type: 'riftClosed', x: e.x, y: e.y });
    }
    if (e.named >= 0) {
      // A named elite (a rare spawn): its own loot from the rare table, and a Vengeful one bursts where it fell.
      this.dropLoot(e.x, e.y, 'rare');
      if (AFFIXES[e.affix] === 'Vengeful') this.addTelegraph('circle', e.x, e.y, NAMED.burstR, 0, 0, NAMED.burstDelay, NAMED.burstDmg);
      // Phase 14 X2 Brood: its pack comes out of it.
      if (AFFIXES[e.affix] === 'Brood') {
        const kind = BROOD_KIND[this.dungeonId] ?? 'cinderhound';
        for (let k = 0; k < NAMED.broodN; k++) {
          const a = (k / NAMED.broodN) * Math.PI * 2 + 0.6;
          this.spawn(kind, e.x + Math.cos(a) * 36, e.y + Math.sin(a) * 36);
        }
      }
      this.namedKills++;
      this.events.push({ type: 'namedKill', x: e.x, y: e.y, name: this.namedName(i) });
    }
    if (e.kind === 'ashmaw') {
      this.dropLoot(e.x, e.y, 'elite');
    }
    if (e.kind === 'cinderBrute') this.dropLoot(e.x, e.y, 'elite');
    if (this.stress && e.def.rank === 'normal' && this.rng.chance(TRASH_DROP)) this.dropLoot(e.x, e.y, 'trash');
    if (e.kind === 'cinderBrute' && !this.firstDelve) {
      this.eliteKilled = true;
      // Elite chest: a free bonus draft (not in the opening: one draft per room clear is enough to read).
      this.events.push({ type: 'chest', x: e.x, y: e.y });
      for (let h = 0; h < this.heroes.length; h++) this.heroPlayer(h).pendingLevels++;
    }
    if (e.def.xp > 0 && this.stress) this.dropGem(e.x, e.y, e.def.xp);
  }

  // ---------------------------------------------------------------- effects

  private addZone(x: number, y: number, r: number, dps: number, life: number): void {
    const z = this.zones.find((q) => !q.alive);
    if (!z) return;
    Object.assign(z, { alive: true, x, y, r, dps, life, maxLife: life, tickT: 0, owner: this.acting });
  }

  private updateZones(dt: number, owner = 0): void {
    for (const z of this.zones) {
      if (!z.alive || z.owner !== owner) continue;
      z.life -= dt;
      if (z.life <= 0) {
        z.alive = false;
        continue;
      }
      z.tickT -= dt;
      if (z.tickT > 0) continue;
      z.tickT = 0.5;
      this.forEachNear(z.x, z.y, z.r + 50, (i) => {
        const e = this.enemies[i];
        if (dist2(z.x, z.y, e.x, e.y) <= (z.r + e.def.radius) ** 2) this.damageEnemy(i, z.dps * 0.5, false, true);
      });
    }
  }

  private addStrike(x: number, y: number, r: number, dmg: number): void {
    const k = this.strikes.findIndex((q) => !q.alive);
    if (k < 0) return;
    Object.assign(this.strikes[k], { alive: true, x, y, r, t: 0.35, dmg });
    this.strikeOwner[k] = this.acting;
  }

  private updateStrikes(dt: number, owner = 0): void {
    for (let k = 0; k < this.strikes.length; k++) {
      const s = this.strikes[k];
      if (!s.alive || this.strikeOwner[k] !== owner) continue;
      s.t -= dt;
      if (s.t > 0) continue;
      s.alive = false;
      this.events.push({ type: 'strike', x: s.x, y: s.y, r: s.r });
      this.forEachNear(s.x, s.y, s.r + 50, (i) => {
        const e = this.enemies[i];
        if (dist2(s.x, s.y, e.x, e.y) <= (s.r + e.def.radius) ** 2) this.damageEnemy(i, s.dmg, true);
      });
    }
  }

  private updateLances(dt: number): void {
    for (const l of this.lances) if (l.alive && (l.life -= dt) <= 0) l.alive = false;
  }

  private addTelegraph(
    shape: 'circle' | 'cone', x: number, y: number, r: number, angle: number, arc: number, dur: number, dmg: number,
    kind: 'hit' | 'soak' | 'bloom' = 'hit', owner = -1,
  ): void {
    const t = this.telegraphs.find((q) => !q.alive);
    if (!t) return;
    Object.assign(t, { alive: true, shape, x, y, r, angle, arc, t: 0, dur, dmg, kind, owner, wasIn: false });
    t.wasIn = kind === 'hit' && this.insideTelegraph(t);
    if (this.heroes.length > 1) {
      let m = 0;
      if (kind === 'hit') for (let i = 0; i < this.heroes.length; i++) { const q = this.heroPlayer(i); if (q.hp > 0 && this.insideFor(t, q)) m |= 1 << i; }
      t.inMask = m;
    }
  }

  /** Is the acting hero inside this telegraph's area right now? */
  private insideTelegraph(t: Telegraph): boolean {
    return this.insideFor(t, this.player);
  }

  private insideFor(t: Telegraph, p: Player): boolean {
    const dd = dist2(p.x, p.y, t.x, t.y);
    if (t.shape === 'circle') return dd <= (t.r + PLAYER_RADIUS * 0.5) ** 2;
    if (dd > t.r * t.r) return false;
    let d = Math.atan2(p.y - t.y, p.x - t.x) - t.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d) <= t.arc / 2;
  }

  // ---------------------------------------------------------------- the Glarewell

  /** Lensbearers raise the lens (Glare); Brandkeepers Brand the hero. */
  private runGlareElite(i: number): void {
    // runAbilities has already advanced casts and the ability timer.
    const e = this.enemies[i];
    if (e.abilityT > 0) return;
    if (e.kind === 'lensbearer') {
      e.abilityT = GLARE.glareEvery * (this.heat === 'highSun' ? HEAT_TUNING.sunGlare : 1);
      this.startCast(i, 'glare', 'Glare', GLARE.glareWarn, true);
    } else if (e.kind === 'brandkeeper') {
      // One Brand at a time, and a breather after each burst.
      if (this.markT > 0) { e.abilityT = this.markT + GLARE.brandGap; return; }
      e.abilityT = GLARE.brandEvery;
      this.startCast(i, 'brand', 'Brand', GLARE.brandCast, false);
    }
  }

  /** Brands burst, the Twin Lamps' beam burns, pillars crack. */
  private runGlarewell(dt: number): void {
    const p = this.player;
    this.lensmotherClock(dt);
    if (this.markT > 0) {
      this.markT -= dt;
      if (this.markT <= 0) {
        this.markT = 0;
        this.burstBrand();
        if (this.markQueued > 0) {
          this.markQueued--;
          this.markT = GLARE.brandTime;
        }
      }
    }
    // The Twin Lamps: a beam of light runs between them while both stand.
    let a = -1;
    let b = -1;
    for (let j = 0; j < this.enemies.length; j++) {
      const o = this.enemies[j];
      if (!o.alive || o.kind !== 'twinLamp') continue;
      if (a < 0) a = j;
      else if (b < 0) b = j;
    }
    this.lampBeam = null;
    if (a >= 0 && b >= 0) {
      const ea = this.enemies[a];
      const eb = this.enemies[b];
      // H3b: on a Halls map a wall between them breaks the beam.
      if (dist2(ea.x, ea.y, eb.x, eb.y) <= GLARE.lampMaxDist ** 2 && !(this.hallsOn && !clearWalk(this.halls!, ea.x, ea.y, eb.x, eb.y))) {
        this.lampBeam = { x1: ea.x, y1: ea.y, x2: eb.x, y2: eb.y };
        this.lampTickT -= dt;
        if (this.lampTickT <= 0) {
          this.lampTickT = 0.5;
          if (segDist2(p.x, p.y, ea.x, ea.y, eb.x, eb.y) <= (GLARE.lampWidth + PLAYER_RADIUS) ** 2) {
            this.hurtPlayer(GLARE.lampDps * 0.5 * this.tierDamage, a);
          }
        }
      }
    }
  }

  private burstBrand(): void {
    if (this.heroes.length > 1) {
      // Co-op: every living hero carries a Brand. Each burst hits every hero
      // inside it, so a party that bunches up takes several.
      const at = this.acting;
      const centres: { x: number; y: number }[] = [];
      for (let h = 0; h < this.heroes.length; h++) {
        const q = this.heroPlayer(h);
        if (q.hp > 0) centres.push({ x: q.x, y: q.y });
      }
      for (const c of centres) this.burstBrandAt(c.x, c.y, true);
      this.use(at);
      return;
    }
    this.burstBrandAt(this.player.x, this.player.y, false);
  }

  private burstBrandAt(x: number, y: number, party: boolean): void {
    const p = { x, y };
    const r = GLARE.brandRadius;
    if (party) {
      this.eachHero(() => {
        if (dist2(this.player.x, this.player.y, x, y) <= (r + PLAYER_RADIUS) ** 2) this.hurtPlayer(GLARE.brandDamage * this.tierDamage, -1, false, 'the Brand');
      });
    } else this.hurtPlayer(GLARE.brandDamage * this.tierDamage, -1, false, 'the Brand');
    this.pillars.forEach((c, k) => {
      if (!c.cracked && !c.fixed && dist2(p.x, p.y, c.x, c.y) <= (r + c.r) ** 2) {
        c.cracked = true;
        this.events.push({ type: 'pillarCrack', index: k });
      }
    });
    // The burst feeds any enemy caught in it.
    for (const o of this.enemies) {
      if (!o.alive || dist2(p.x, p.y, o.x, o.y) > (r + o.def.radius) ** 2) continue;
      const amount = o.maxHp * GLARE.brandHeal * this.healTakenMult(o);
      o.hp = Math.min(o.maxHp, o.hp + amount);
      this.events.push({ type: 'heal', x: o.x, y: o.y, amount });
    }
    this.events.push({ type: 'brandBurst', x: p.x, y: p.y, r });
  }

  /** The Lensmother: Glare (hide), Twin Brand (spread), then she cracks the pillars one by one. */
  /**
   * The Lensmother's clocks: enrage, phases and the phase 3 pillar cracks.
   * They run every tick from runGlarewell, so they keep time while she casts.
   */
  private lensmotherClock(dt: number): void {
    if (this.bossIndex < 0) return;
    const e = this.enemies[this.bossIndex];
    if (!e || !e.alive || e.kind !== 'lensmother') return;
    if (!this.bossEnraged && this.time - e.spawnedAt > GLARE.enrageAfter) {
      this.bossEnraged = true;
      this.events.push({ type: 'bossEnrage' });
    }
    const frac = e.hp / e.maxHp;
    const phase = frac > 0.6 ? 1 : frac > 0.25 ? 2 : 3;
    if (phase > this.bossPhase) {
      this.bossPhase = phase;
      this.events.push({ type: 'phase', phase });
      // The first crack comes soon after phase 3 starts, so every kill sees it.
      if (phase === 3) this.crackT = GLARE.firstCrack;
    }
    // Phase 3: every so often a pillar shatters (telegraphed on the stone first).
    if (phase >= 3) {
      this.crackT -= dt;
      if (this.crackT <= 0) {
        this.crackT = GLARE.crackEvery;
        const left = this.pillars.map((c, k) => (c.cracked ? -1 : k)).filter((k) => k >= 0);
        if (left.length > 1) {
          const k = left[this.rng.int(left.length)];
          const c = this.pillars[k];
          this.addTelegraph('circle', c.x, c.y, c.r + 40, 0, 0, GLARE.crackDelay, 20, 'hit', -1);
          this.crackPending = { index: k, t: GLARE.crackDelay };
        }
      }
    }
    if (this.crackPending) {
      this.crackPending.t -= dt;
      if (this.crackPending.t <= 0) {
        const k = this.crackPending.index;
        this.crackPending = null;
        if (!this.pillars[k].cracked) {
          this.pillars[k].cracked = true;
          this.events.push({ type: 'pillarCrack', index: k });
        }
      }
    }
  }

  /**
   * The Lensmother's casts: Glare (hide), Twin Brand (spread) from phase 2,
   * and a Lens Sweep cone in between. runAbilities has already advanced any
   * cast and her ability timer.
   */
  private runLensmother(i: number, dt: number): void {
    const e = this.enemies[i];
    const p = this.player;
    this.glareT -= dt;
    if (this.glareT <= 0) {
      this.glareT = (this.bossEnraged ? GLARE.bossGlareEvery * 0.6 : GLARE.bossGlareEvery) * (this.heat === 'highSun' ? HEAT_TUNING.sunGlare : 1);
      this.startCast(i, 'glare', 'Glare', GLARE.glareWarn, false);
      // Y3 Carried Light: from phase 2 she carries the light; the shadows swing as the warning starts.
      let carry = this.bossPhase >= 2 && this.bossVariant === 'walk';
      // Phase 16 U1: a Carried Light echo carries every other Glare in her last phase; the others come from the middle again.
      if (this.bossPhase >= 3 && this.bossEcho === 'walk') {
        carry = this.echoNext;
        this.echoNext = !this.echoNext;
        if (carry) this.events.push({ type: 'echo', id: 'walk' });
        else if (this.lightX !== 0 || this.lightY !== 0) {
          this.lightX = 0; this.lightY = 0;
          this.events.push({ type: 'lightMove', x: 0, y: 0 });
        }
      }
      if (carry) {
        this.lightX = e.x;
        this.lightY = e.y;
        this.events.push({ type: 'lightMove', x: e.x, y: e.y });
      }
      return;
    }
    // Phase 16 U1: a Twin Brand or Glintfall echo takes every other turn of this timer in her last phase.
    const brandEcho = this.bossPhase >= 3 && (this.bossEcho === 'brand' || this.bossEcho === 'glint');
    if (this.bossPhase >= 2 && this.markT <= 0 && (this.bossVariant !== 'walk' || brandEcho)) {
      this.bossBrandT -= dt;
      if (this.bossBrandT <= 0) {
        this.bossBrandT = GLARE.bossBrandEvery;
        let move: string = this.bossVariant;
        if (brandEcho) {
          if (this.echoNext) { move = this.bossEcho; this.events.push({ type: 'echo', id: this.bossEcho }); }
          this.echoNext = !this.echoNext;
        }
        if (move === 'walk') {
          // A Carried Light run has nothing of its own on this timer: only the echo.
        } else if (move === 'glint') {
          // V8 Glintfall: light shards fall on every standing pillar. Step off your cover until they land.
          this.startCast(i, 'glintfall', 'Glintfall', GLINTFALL.cast, false);
          for (const q of this.pillars) {
            if (!q.cracked) this.addTelegraph('circle', q.x, q.y, GLINTFALL.radius, 0, 0, GLINTFALL.cast, GLINTFALL.damage * (this.bossEnraged ? 1.5 : 1), 'hit', i);
          }
          return;
        } else {
          this.startCast(i, 'twinBrand', 'Twin Brand', GLARE.brandCast, false);
          return;
        }
      }
    }
    if (e.abilityT > 0) return;
    e.abilityT = this.bossEnraged ? GLARE.sweepEveryEnraged : GLARE.sweepEvery;
    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    this.startCast(i, 'lensSweep', 'Lens Sweep', GLARE.sweepCast, false);
    this.addTelegraph('cone', e.x, e.y, GLARE.sweepRange, ang, (GLARE.sweepArc * Math.PI) / 180, GLARE.sweepCast, GLARE.sweepDamage * (this.bossEnraged ? 1.5 : 1), 'hit', i);
  }

  // ---------------------------------------------------------------- the Hammerdeep

  /** Ondrel between casts: Hammer Sweep at its target, and Slag Grip on whoever it's beating. */
  private runOndrel(i: number): void {
    const e = this.enemies[i];
    const p = this.player;
    const reach = e.def.radius + PLAYER_RADIUS + ONDREL.gripReach;
    if (this.gripT <= 0 && dist2(p.x, p.y, e.x, e.y) < reach * reach) {
      this.gripT = ONDREL.gripEvery;
      this.hurtPlayer(e.def.damage * this.tierDamage, i);
      p.slag = Math.min(ONDREL.slagMax, (p.slag ?? 0) + 1);
      this.events.push({ type: 'slagGrip', x: p.x, y: p.y, stacks: p.slag });
    }
    if (e.abilityT > 0 || this.homeStage > 0) return;
    e.abilityT = ONDREL.sweepEvery;
    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    this.startCast(i, 'hammerSweep', 'Hammer Sweep', ONDREL.sweepCast, false);
    this.addTelegraph('cone', e.x, e.y, ONDREL.sweepRange, ang, (ONDREL.sweepArc * Math.PI) / 180, ONDREL.sweepCast, ONDREL.sweepDamage, 'hit', i); // scaled by tier as it lands
  }

  // ---------------------------------------------------------------- the Coldmarrow

  /** The warmest living Hearthcoal whose light reaches this spot, or touches a body of radius `r` there (0 if none). */
  private warmthAt(x: number, y: number, r0 = 0): number {
    let best = 0;
    for (let k = 0; k < this.heroes.length; k++) {
      const q = this.heroPlayer(k);
      if (q.hp <= 0 || !q.coal) continue;
      const r = (q.coalR ?? this.coalMaxR) + r0;
      if (dist2(q.x, q.y, x, y) <= r * r) best = Math.max(best, q.coal);
    }
    return best;
  }

  /** Thin Ice: parallel cracks either side of Nhevra, at a random angle, so the floor splits into strips. */
  private crackRiver(x: number, y: number): void {
    const angle = this.rng.next() * Math.PI;
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    for (let k = 0; k < COLD.crackLanes; k++) {
      const c = this.cracks.find((q) => !q.alive);
      if (!c) return;
      const off = (k - (COLD.crackLanes - 1) / 2) * COLD.crackGap;
      Object.assign(c, { alive: true, x: x + nx * off, y: y + ny * off, angle, t: 0 });
    }
    this.events.push({ type: 'castStart', index: this.bossIndex, id: 'thinIce', name: 'Thin Ice' });
  }

  /** Is any crack open water right now? */
  riverOpen(): boolean {
    return this.cracks.some((c) => c.alive && c.t >= COLD.crackWarn);
  }

  /** Distance from a point to a crack's centre line. */
  crackDist(c: Crack, x: number, y: number): number {
    return Math.abs((x - c.x) * -Math.sin(c.angle) + (y - c.y) * Math.cos(c.angle));
  }

  /** Is this spot in open water (a crack past its warning)? */
  inWater(x: number, y: number): boolean {
    for (const c of this.cracks) if (c.alive && c.t >= COLD.crackWarn && this.crackDist(c, x, y) <= COLD.crackHalfW + PLAYER_RADIUS * 0.5) return true;
    return false;
  }

  /** Hearthcoals burn down, Chill builds while a coal is out, and Nhevra's clocks. */
  private coldClock(dt: number): void {
    for (let k = 0; k < this.heroes.length; k++) {
      const q = this.heroPlayer(k);
      if (q.hp <= 0) continue;
      if (q.coal === undefined) { q.coal = 1; q.chill = 0; q.chillT = 0; }
      // V8 Emberdrift: in phase 2 the cold eats coals faster, and fallen embers refill them.
      const drift = this.coldPhase >= 2 && versionLive(this, 'drift');
      q.coal = Math.max(0, q.coal - COLD.drain * (drift ? EMBERDRIFT.drainMult : 1) * (this.heat === 'brightCoal' ? HEAT_TUNING.coalDrain : 1) * dt);
      if (drift) {
        for (let n = this.driftEmbers.length - 1; n >= 0; n--) {
          const m = this.driftEmbers[n];
          if (dist2(q.x, q.y, m.x, m.y) > EMBERDRIFT.pickR * EMBERDRIFT.pickR) continue;
          q.coal = Math.min(1, q.coal + EMBERDRIFT.refill);
          this.driftEmbers.splice(n, 1);
          this.events.push({ type: 'emberPick', x: m.x, y: m.y, hero: k });
        }
      }
      q.coalR = COLD.minR + (this.coalMaxR - COLD.minR) * q.coal;
      if (q.coal <= 0) {
        // Out: the cold creeps in a stack at a time.
        q.chillT = (q.chillT ?? 0) + dt;
        if (q.chillT >= COLD.chillEvery) {
          q.chillT -= COLD.chillEvery;
          q.chill = Math.min(COLD.frozenAt, (q.chill ?? 0) + 1);
        }
      } else if ((q.chill ?? 0) > 0) {
        q.chillT = 0;
        q.chill = Math.max(0, (q.chill ?? 0) - COLD.chillDecay * dt);
      }
      if ((q.chill ?? 0) >= COLD.frozenAt && q.hp > 0) {
        // Frozen: the cold itself hurts.
        const at = this.acting;
        this.use(k);
        this.hurtPlayer(this.player.maxHp * COLD.frozenBurn * dt, -1, true, 'being Frozen');
        this.use(at);
      }
      if (this.rimeOn && q.hp > 0 && dist2(q.x, q.y, this.rimeX, this.rimeY) <= CREEPING_RIME.r ** 2) {
        // Y3 Creeping Rime: it soaks the coal and chills, but doesn't burn.
        q.coal = Math.max(0, q.coal - CREEPING_RIME.drain * dt);
        q.chill = Math.min(COLD.frozenAt, (q.chill ?? 0) + CREEPING_RIME.chill * dt);
      }
      if (this.coldPhase >= 2 && q.hp > 0 && this.inWater(q.x, q.y)) {
        // Thin Ice: open water soaks the coal, chills fast, and hurts.
        q.coal = Math.max(0, q.coal - COLD.waterDrain * dt);
        q.chill = Math.min(COLD.frozenAt, (q.chill ?? 0) + COLD.waterChill * dt);
        const at = this.acting;
        this.use(k);
        this.hurtPlayer(this.player.maxHp * COLD.waterBurn * dt, -1, true, 'open water');
        this.use(at);
      }
    }
    for (const c of this.cracks) {
      if (!c.alive) continue;
      c.t += dt;
      if (c.t >= COLD.crackWarn + COLD.crackOpen) c.alive = false;
    }
    if (this.bossIndex < 0) return;
    const i = this.bossIndex;
    const e = this.enemies[i];
    if (!e || !e.alive || e.kind !== 'nhevra') return;
    const late = this.time - e.spawnedAt > COLD.enrageAfter;
    if (late && !this.bossEnraged) {
      this.bossEnraged = true;
      this.events.push({ type: 'bossEnrage' });
    }
    if (this.coldPhase < 2 && e.hp <= e.maxHp * COLD.phase2) {
      this.coldPhase = 2;
      this.bossPhase = 2;
      this.iceT = COLD.firstCrack;
      this.events.push({ type: 'phase', phase: 2 });
    }
    // Phase 16 U1: from `NHEVRA_ECHO.below` health, her echo comes and goes, `on` s at a time.
    if (this.coldPhase >= 2 && this.bossEcho && e.hp <= e.maxHp * NHEVRA_ECHO.below) {
      this.echoT -= dt;
      if (this.echoT <= 0) {
        this.echoLive = !this.echoLive;
        this.echoT = this.echoLive ? NHEVRA_ECHO.on : NHEVRA_ECHO.off;
        if (this.echoLive) {
          this.events.push({ type: 'echo', id: this.bossEcho });
          if (this.bossEcho === 'drift') this.driftT = 0;
          if (this.bossEcho === 'ice') this.iceT = 0;
        } else if (this.bossEcho === 'drift') {
          this.driftEmbers = [];
        } else if (this.bossEcho === 'rime') {
          this.rimeOn = false;
        }
      }
    }
    const has = (v: NhevraVariant) => this.coldPhase >= 2 && versionLive(this, v);
    if (has('drift')) {
      // V8 Emberdrift: embers fall in a ring; the old ones gutter out.
      this.driftT -= dt;
      if (this.driftT <= 0) {
        this.driftT = EMBERDRIFT.every;
        let h = Math.imul(this.seed ^ 0x3b9aca07, 0x9e3779b1) + Math.imul(++this.driftN, 0x85ebca6b) >>> 0;
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
        const turn = ((h >>> 8) % 360) * (Math.PI / 180);
        this.driftEmbers = [];
        for (let k = 0; k < EMBERDRIFT.n; k++) {
          const a = turn + (k * 2 * Math.PI) / EMBERDRIFT.n;
          this.driftEmbers.push({ x: Math.cos(a) * EMBERDRIFT.ring, y: Math.sin(a) * EMBERDRIFT.ring });
        }
        this.events.push({ type: 'emberDrift', n: EMBERDRIFT.n });
      }
    }
    if (has('rime')) {
      // Y3 Creeping Rime: it rises under her, then creeps after the nearest hero.
      const risen = !this.rimeOn;
      if (!this.rimeOn) {
        this.rimeOn = true;
        this.rimeX = e.x;
        this.rimeY = e.y;
        this.events.push({ type: 'rimeRise', x: e.x, y: e.y });
      }
      let tx = this.rimeX, ty = this.rimeY, best = Infinity;
      for (let k = 0; k < this.heroes.length; k++) {
        const q = this.heroPlayer(k);
        if (q.hp <= 0) continue;
        const d = dist2(q.x, q.y, this.rimeX, this.rimeY);
        if (d < best) { best = d; tx = q.x; ty = q.y; }
      }
      const dx = tx - this.rimeX, dy = ty - this.rimeY, d = Math.hypot(dx, dy);
      const step = Math.min(d, CREEPING_RIME.speed * dt);
      const min = e.def.radius + CREEPING_RIME.hold;
      const nx = d > 1 ? this.rimeX + (dx / d) * step : this.rimeX, ny = d > 1 ? this.rimeY + (dy / d) * step : this.rimeY;
      if (CREEPING_RIME.hold > 0 && Math.hypot(nx - e.x, ny - e.y) < min) {
        // Her own body holds the rime off (`hold`, px past her edge): it creeps round her toward the hero, not through her.
        // Just risen under her, it first comes out on the hero's side. If she walks into it later, it is pushed out
        // along its own angle (QA on #550: snapping to the hero's side then made it jump up to 100 degrees round her).
        const hd = Math.hypot(this.rimeX - e.x, this.rimeY - e.y);
        const a0 = risen || hd < 1 ? Math.atan2(ty - e.y, tx - e.x) : Math.atan2(this.rimeY - e.y, this.rimeX - e.x);
        let da = Math.atan2(ty - e.y, tx - e.x) - a0;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        const turn = Math.sign(da || 1) * Math.min(Math.abs(da), (CREEPING_RIME.speed * CREEPING_RIME.orbit * dt) / min);
        this.rimeX = e.x + Math.cos(a0 + turn) * min;
        this.rimeY = e.y + Math.sin(a0 + turn) * min;
      } else {
        this.rimeX = nx;
        this.rimeY = ny;
      }
    }
    // Thin Ice is her base version: any run that didn't roll the other two has it.
    if (has('ice') || (this.coldPhase >= 2 && this.bossVariant !== 'drift' && this.bossVariant !== 'rime')) {
      this.iceT -= dt;
      if (this.iceT <= 0) {
        this.iceT = COLD.crackEvery;
        this.crackRiver(e.x, e.y);
      }
    }
    this.snuffT -= dt;
    this.tideT -= dt;
    this.nightT -= dt;
    if (this.tideT <= 0) {
      this.tideT = COLD.tideEvery;
      for (let n = 0; n < COLD.tideN; n++) this.spawnAtRing('snuffer', 420);
      this.events.push({ type: 'castStart', index: i, id: 'snufferTide', name: 'Snuffer Tide' });
    }
    if (e.castId || e.stunT > 0) return;
    if (this.nightT <= 0) {
      this.nightT = (this.coldPhase >= 2 ? COLD.nightEvery2 : COLD.nightEvery) / (late ? 2 : 1);
      this.startCast(i, 'longNight', 'Long Night', COLD.nightCast, false);
    } else if (this.snuffT <= 0) {
      this.snuffT = COLD.snuffEvery;
      this.startCast(i, 'snuff', 'Snuff', COLD.snuffCast, true);
    }
  }

  // ---------------------------------------------------------------- the Wrackline

  /** Push a swimmer back to the edge of any afloat raft it has drifted onto. */
  private keepOffRafts(e: Enemy): void {
    // H3d (QA, 25 Nov): on a Halls map a foe pinched between two rafts that nearly touch can be pushed off one onto the
    // other, so it resolves again (up to 4 passes), then walks out along the summed push of every raft it's still on.
    const passes = this.hallsOn ? 4 : 1;
    for (let k = 0; k < passes; k++) if (!this.keepOffRaftsOnce(e)) return;
    if (!this.hallsOn) return;
    const on = () => this.rafts.filter((r) => r.sunkT <= 0 && Math.hypot(e.x - r.x, e.y - r.y) < WRACK.raftR + e.def.radius * 0.5);
    let ux = 0, uy = 0;
    for (const r of on()) { const d = Math.hypot(e.x - r.x, e.y - r.y) || 1; ux += (e.x - r.x) / d; uy += (e.y - r.y) / d; }
    const ul = Math.hypot(ux, uy);
    if (ul < 0.001) { ux = e.x - this.wrackX || 1; uy = e.y - this.wrackY; }
    const l = Math.hypot(ux, uy) || 1;
    if (!on().length) return;
    for (let n = 0; n < 80 && on().length; n++) { e.x += (ux / l) * 4; e.y += (uy / l) * 4; }
    this.clampArena(e, e.def.radius);
  }

  /** One push off each afloat raft in turn; whether any push happened. */
  private keepOffRaftsOnce(e: Enemy): boolean {
    let moved = false;
    for (const r of this.rafts) {
      if (r.sunkT > 0) continue;
      const d = Math.hypot(e.x - r.x, e.y - r.y);
      const min = WRACK.raftR + e.def.radius * 0.5;
      if (d >= min) continue;
      // Out along the line from the raft's middle; dead centre, out the far side from the drain.
      let ux = d > 0.001 ? (e.x - r.x) / d : r.x;
      let uy = d > 0.001 ? (e.y - r.y) / d : r.y;
      const ul = Math.hypot(ux, uy) || 1;
      if (d <= 0.001 && ul === 1 && !r.x && !r.y) ux = 1;
      e.x = r.x + (ux / ul) * min;
      e.y = r.y + (uy / ul) * min;
      moved = true;
    }
    return moved;
  }

  /**
   * H3d (QA and design, 25 Nov): on a Halls map, while the Ebb pulls, the last thing each step does is push every foe but
   * a boss off an afloat raft, stunned or shoved ones too (their own move skips the push or comes before the shove).
   * Rafts turn back at rifts, so no raft sits on one.
   */
  private raftsClear(): void {
    if (!this.rafts.length) return;
    for (const e of this.enemies) if (e.alive && e.def.rank !== 'boss' && !e.def.stationary) this.keepOffRafts(e);
  }

  /** H3d: would a raft centred at (x, y) sit on a standing foe (a rift)? */
  private raftOnRift(x: number, y: number): boolean {
    for (const e of this.enemies) if (e.alive && e.def.stationary && e.def.rank !== 'boss' && (e.x - x) ** 2 + (e.y - y) ** 2 < (WRACK.raftR + e.def.radius) ** 2) return true;
    return false;
  }

  /** Is this spot on a raft that's afloat? */
  onRaft(x: number, y: number): boolean {
    for (const r of this.rafts) if (r.sunkT <= 0 && dist2(x, y, r.x, r.y) <= WRACK.raftR * WRACK.raftR) return true;
    return false;
  }

  /** The Wrackline: a Bulwark under Anvil Skin is anchored, so neither the Ebb nor a Haul moves it. */
  private anchored(q: Player): boolean {
    // Only the Bulwark's Anvil Skin sets bastionT.
    return q.bastionT > 0;
  }

  /** Rafts drift; every so often the Ebb warns, then drags everyone not on a raft toward the drain. Hessa's clocks. */
  private wrackClock(dt: number): void {
    const boss = this.bossIndex >= 0 && this.enemies[this.bossIndex]?.alive && this.enemies[this.bossIndex].kind === 'hessa' ? this.enemies[this.bossIndex] : null;
    const late = !!boss && this.time - boss.spawnedAt > WRACK.enrageAfter;
    // Phase 12 W1: in her Outsurge version, phase 2 turns the Ebb around (out to the rim) instead of Riptide.
    const out = this.outsurge;
    const whirl = this.whirl;
    const riptide = this.wrackPhase >= 2 && !out && !whirl;
    const drift = WRACK.drift * (riptide ? WRACK.riptideDrift : 1) * (this.heat === 'slackWater' ? HEAT_TUNING.slackDrift : 1);
    for (const r of this.rafts) {
      // H3d (design, 25 Nov): on a Halls map a rift blocks a drifting raft like a wall: it turns back the way it came.
      if (this.hallsOn) {
        const na = r.a + (r.dir * drift * dt) / r.ring;
        if (this.raftOnRift(this.wrackX + Math.cos(na) * r.ring, this.wrackY + Math.sin(na) * r.ring)) r.dir = -r.dir;
        else r.a = na;
      } else r.a += (r.dir * drift * dt) / r.ring;
      r.x = this.wrackX + Math.cos(r.a) * r.ring;
      r.y = this.wrackY + Math.sin(r.a) * r.ring;
      if (r.sunkT > 0) r.sunkT = Math.max(0, r.sunkT - dt);
    }
    if (this.ebbT > 0) {
      this.ebbT = Math.max(0, this.ebbT - dt);
      const pull = WRACK.drag * (riptide ? WRACK.riptideDrag : 1);
      const foePull = WRACK.foeDrag * (riptide ? WRACK.riptideDrag : 1);
      const rim = this.arenaR - OUTSURGE.rimR;
      // H3d: on a Halls map the Ebb drains the woken quay room only (the drain is its middle; corridors are dry jetties).
      const cx = this.wrackX, cy = this.wrackY;
      const wet = (x: number, y: number) => !this.hallsOn || roomAt(this.halls!, x, y) === this.wrackRoom;
      for (let k = 0; k < this.heroes.length; k++) {
        const q = this.heroPlayer(k);
        if (q.hp <= 0 || this.onRaft(q.x, q.y) || !wet(q.x, q.y)) continue;
        const d = Math.hypot(q.x - cx, q.y - cy) || 1;
        // Anvil Skin anchors the Bulwark: the water still burns, but it can't drag.
        // The pull is a share of the hero's own class speed, so every class walks out of it at the same pace.
        const room = out ? Math.max(0, this.arenaR - PLAYER_RADIUS - d) : d;
        const speed = CLASSES[this.heroes[k].cls].speed;
        const step = this.anchored(q) ? 0 : Math.min(room, pull * (whirl ? WHIRL.inward : 1) * speed * dt) * (out ? -1 : 1);
        q.x -= ((q.x - cx) / d) * step;
        q.y -= ((q.y - cy) / d) * step;
        if (this.hallsOn) this.clampArena(q, PLAYER_RADIUS);
        if (whirl && !this.anchored(q)) {
          // Y3 the Whirl: carried round the drain, the way it turns this Ebb.
          const s = WHIRL.spin * speed * dt * this.whirlDir;
          const qx = q.x;
          q.x += (-q.y / d) * s;
          q.y += (qx / d) * s;
          this.clampArena(q, PLAYER_RADIUS);
        }
        const share = WRACK.tideBurn + (out ? (d >= rim ? OUTSURGE.rimBurn : 0) : d <= WRACK.drainR ? WRACK.drainBurn : 0);
        const at = this.acting;
        this.use(k);
        this.hurtPlayer(this.player.maxHp * share * dt, -1, true, 'the Tide');
        this.use(at);
      }
      // The water takes foes too: all but Lurkers and bosses drift in, and the drain hurts them.
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (!e.alive || e.def.rank === 'boss' || e.kind === 'shoalLurker' || e.kind === 'conchblower' || e.def.stationary || !wet(e.x, e.y)) continue;
        const d = Math.hypot(e.x - cx, e.y - cy) || 1;
        const step = out ? -Math.min(Math.max(0, this.arenaR - e.def.radius - d), foePull * dt) : Math.min(d, foePull * dt);
        e.x -= ((e.x - cx) / d) * step * (whirl ? WHIRL.inward : 1);
        e.y -= ((e.y - cy) / d) * step * (whirl ? WHIRL.inward : 1);
        if (this.hallsOn) this.clampArena(e, e.def.radius);
        if (whirl) {
          const s = foePull * dt * this.whirlDir;
          const ex = e.x;
          e.x += (-e.y / d) * s;
          e.y += (ex / d) * s;
        }
        if (out ? d >= rim : d <= WRACK.drainR) this.damageEnemy(i, e.maxHp * WRACK.foeDrain * dt, false, true);
      }
    } else if (this.ebbWarnT > 0) {
      this.ebbWarnT = Math.max(0, this.ebbWarnT - dt);
      if (this.ebbWarnT <= 0) this.ebbT = WRACK.tideOpen;
    } else {
      this.tideClockT -= dt;
      if (this.tideClockT <= 0) {
        this.tideClockT = boss ? (late ? WRACK.tideLate : WRACK.tideBoss) : WRACK.tideEvery * (this.heat === 'slackWater' ? HEAT_TUNING.slackTide : 1);
        this.ebbWarnT = WRACK.tideWarn;
        // Phase 16 U1: from `HESSA_ECHO.below` health, every other Ebb runs her echo's way (the first one does).
        this.ebbEcho = false;
        if (boss && this.wrackPhase >= 2 && this.bossEcho && boss.hp <= boss.maxHp * HESSA_ECHO.below) {
          this.ebbEcho = this.echoNext;
          this.echoNext = !this.echoNext;
          if (this.ebbEcho) this.events.push({ type: 'echo', id: this.bossEcho });
        }
        const nowOut = this.outsurge, nowWhirl = this.whirl;
        if (nowWhirl) this.whirlDir = -this.whirlDir;
        this.events.push({ type: 'castStart', index: boss ? this.bossIndex : -1, id: 'ebb', name: nowOut ? 'The Outsurge' : nowWhirl ? 'The Whirl' : 'The Ebb' });
      }
    }
    if (!boss) return;
    const i = this.bossIndex;
    const e = boss;
    if (late && !this.bossEnraged) {
      this.bossEnraged = true;
      this.events.push({ type: 'bossEnrage' });
    }
    if (this.wrackPhase < 2 && e.hp <= e.maxHp * WRACK.phase2) {
      this.wrackPhase = 2;
      this.bossPhase = 2;
      this.events.push({ type: 'phase', phase: 2 });
    }
    this.sinkT -= dt;
    this.shoalT -= dt;
    if (this.shoalT <= 0) {
      this.shoalT = WRACK.shoalEvery;
      for (let n = 0; n < WRACK.shoalN; n++) this.spawnAtRing('shoalLurker', 420);
      this.events.push({ type: 'castStart', index: i, id: 'shoalCall', name: 'Call the Shoal' });
    }
    // Sink's circle rides along with the raft it marked.
    if (e.castId === 'sink') {
      const r = this.rafts[e.aux | 0];
      if (r) for (const t of this.telegraphs) if (t.alive && t.owner === i) { t.x = r.x; t.y = r.y; }
    }
    if (e.castId || e.stunT > 0) return;
    if (this.sinkT <= 0) {
      // Sink the afloat raft nearest her target, so the hero has to find another.
      let best = -1;
      let bd = Infinity;
      const p = this.player;
      this.rafts.forEach((r, k) => {
        if (r.sunkT > 0) return;
        const d = dist2(r.x, r.y, p.x, p.y);
        if (d < bd) { bd = d; best = k; }
      });
      if (best >= 0) {
        this.sinkT = WRACK.sinkEvery;
        e.aux = best;
        this.startCast(i, 'sink', 'Sink', WRACK.sinkCast, true);
        const r = this.rafts[best];
        this.addTelegraph('circle', r.x, r.y, WRACK.raftR, 0, 0, WRACK.sinkCast, 0, 'hit', i);
      }
    }
  }

  // ---------------------------------------------------------------- the Ashvents

  /**
   * Ysmeret's clocks. Twin Vents (split): two gold soak circles on opposite sides,
   * square to its target; each one needs a hero in it. Scatter Embers (spread) never
   * lands while vents are open. Bellow Slam is the tank hit.
   */
  private ysmeretClock(dt: number): void {
    if (this.bossIndex < 0) return;
    const i = this.bossIndex;
    const e = this.enemies[i];
    if (!e || !e.alive || e.kind !== 'ysmeret') return;
    const late = this.time - e.spawnedAt > YSMERET.enrageAfter;
    if (late && !this.bossEnraged) {
      this.bossEnraged = true;
      this.events.push({ type: 'bossEnrage' });
    }
    if (this.ysStage === 2) { this.flamesClock(dt); return; }
    if (this.ysStage === 1 && YSMERETV2.split > 0 && e.hp <= e.maxHp * YSMERETV2.split) { this.ysSplit(i); return; }
    this.twinVentT -= dt;
    this.scatterT -= dt;
    this.bellowT -= dt;
    const ventsOpen = this.telegraphs.some((t) => t.alive && t.kind === 'soak' && t.owner === -2);
    if (this.twinVentT <= 0 && !ventsOpen && this.rollLeft === 0) {
      this.twinVentT = late ? YSMERET.ventEnraged : YSMERET.ventEvery;
      const tgt = this.heroPlayer(this.targetOf(i, 0));
      const a = Math.atan2(tgt.y - e.y, tgt.x - e.x) + Math.PI / 2;
      // Phase 16 U1: from `GROUP_ECHO.below` health, every other set of vents is her echo's (the first one is).
      this.ventMove = this.bossVariant;
      if (this.bossEcho && e.hp <= e.maxHp * GROUP_ECHO.below) {
        if (this.echoNext) { this.ventMove = this.bossEcho; this.events.push({ type: 'echo', id: this.bossEcho }); }
        this.echoNext = !this.echoNext;
      }
      const roll = this.ventMove === 'roll';
      if (roll) {
        // Rolling Vents: only the first opens now; the rest follow round her (below).
        this.rollLeft = ROLLING.count - 1;
        this.rollAng = a;
        this.rollDir = -this.rollDir;
      }
      for (const s of roll ? [1] : [1, -1]) {
        const x = e.x + Math.cos(a) * YSMERET.ventDist * s;
        const y = e.y + Math.sin(a) * YSMERET.ventDist * s;
        const c = { x, y };
        this.clampArena(c, YSMERET.ventRadius + 10);
        // owner -2: a boss mechanic no interrupt removes.
        this.addTelegraph('circle', c.x, c.y, YSMERET.ventRadius, 0, 0, YSMERET.ventFuse, YSMERET.ventBlast, 'soak', -2);
      }
      this.events.push({ type: 'castStart', index: i, id: 'twinVents', name: roll ? 'Rolling Vents' : this.ventMove === 'wander' ? 'Wandering Vents' : 'Twin Vents' });
    } else if (!ventsOpen && this.rollLeft > 0) {
      // Rolling Vents: as one closes, the next opens further round her.
      this.rollLeft--;
      this.rollAng += this.rollDir * (ROLLING.step * Math.PI) / 180;
      const c = { x: e.x + Math.cos(this.rollAng) * YSMERET.ventDist, y: e.y + Math.sin(this.rollAng) * YSMERET.ventDist };
      this.clampArena(c, YSMERET.ventRadius + 10);
      this.addTelegraph('circle', c.x, c.y, YSMERET.ventRadius, 0, 0, ROLLING.fuse, YSMERET.ventBlast, 'soak', -2);
      this.events.push({ type: 'ventRoll', x: c.x, y: c.y, left: this.rollLeft });
    } else if (ventsOpen && this.ventMove === 'wander') {
      // Wandering Vents: the two circles circle Ysmeret while they fuse, so the soakers walk with them.
      const turn = (WANDER.speed / YSMERET.ventDist) * dt;
      for (const t of this.telegraphs) {
        if (!t.alive || t.kind !== 'soak' || t.owner !== -2) continue;
        // Always at ventDist from her (not the clamped distance), so a circle pulled in at the rim swings back out.
        const a = Math.atan2(t.y - e.y, t.x - e.x) + turn;
        const c = { x: e.x + Math.cos(a) * YSMERET.ventDist, y: e.y + Math.sin(a) * YSMERET.ventDist };
        this.clampArena(c, YSMERET.ventRadius + 10);
        t.x = c.x; t.y = c.y;
      }
    }
    if (e.castId || e.stunT > 0) return;
    // YSMERETV2 stage 1: Bellow Slam waits while her vents are open (its timer runs on; it goes off once they close).
    // Looked at again here, so vents that opened above in this same tick count too (QA, 25 Nov).
    const ventsNow = this.telegraphs.some((t) => t.alive && t.kind === 'soak' && t.owner === -2);
    if (this.bellowT <= 0 && !(this.ysStage === 1 && YSMERETV2.bellowWaits && (ventsNow || this.rollLeft > 0))) {
      this.bellowT = YSMERET.bellowEvery;
      this.bellowTarget = this.targetOf(i, 0);
      this.startCast(i, 'bellowSlam', 'Bellow Slam', YSMERET.bellowCast, false);
    } else if (this.scatterT <= 0 && ((!ventsOpen && this.rollLeft === 0) || (this.ventMove === 'roll' && ROLLING.scatterDuring)) && this.twinVentT > YSMERET.scatterCast + 0.5) {
      this.scatterT = YSMERET.scatterEvery;
      this.startCast(i, 'scatter', 'Scatter Embers', YSMERET.scatterCast, false);
    }
  }
  /**
   * YSMERETV2: at `split` of her health she splits into two flames `apart` px apart. They share one health (what she had
   * left, x `hpMult`) and each stays where it landed.
   */
  private ysSplit(i: number): void {
    const e = this.enemies[i];
    if (e.castId) this.cancelCast(i);
    // Her open vents go with her stage 1.
    for (const t of this.telegraphs) if (t.alive && t.kind === 'soak' && t.owner === -2) t.alive = false;
    this.rollLeft = 0;
    const pool = e.hp * YSMERETV2.hpMult;
    const tgt = this.heroPlayer(this.targetOf(i, 0));
    const a = Math.atan2(tgt.y - e.y, tgt.x - e.x) + Math.PI / 2;
    const d = YSMERETV2.apart / 2;
    const cx = e.x, cy = e.y;
    const j = this.spawn('ysmeret', cx - Math.cos(a) * d, cy - Math.sin(a) * d);
    e.x = e.px = cx + Math.cos(a) * d;
    e.y = e.py = cy + Math.sin(a) * d;
    this.clampArena(e, e.def.radius);
    e.maxHp = e.hp = pool;
    e.abilityT = YSMERETV2.firstScatter;
    this.ysF0 = i; this.ysAx0 = e.x; this.ysAy0 = e.y; this.ysAway0 = 0;
    this.ysF1 = j; this.ysAway1 = 0;
    if (j >= 0) {
      const f = this.enemies[j];
      this.clampArena(f, f.def.radius);
      f.maxHp = f.hp = pool;
      f.abilityT = YSMERETV2.firstScatter + YSMERET.scatterEvery / 2; // the two Scatters come half a timer apart
      this.ysAx1 = f.x; this.ysAy1 = f.y;
    }
    this.ysPool = pool;
    this.ysBel0 = YSMERETV2.bellowEvery * 0.5;
    this.ysStage = 2;
    this.bossPhase = 2;
    this.events.push({ type: 'phase', phase: 2 });
  }

  /**
   * YSMERETV2 stage 2: the flames share their health, stay on their spots, cast Scatter Embers on their own timers, and
   * one with no hero within `flareR` for `flareAfter` s flares (every hero takes YSMERET.ventBlast, like an empty vent).
   */
  private flamesClock(dt: number): void {
    // One health: whatever either flame lost since the last tick comes off both.
    let lost = 0;
    for (const j of [this.ysF0, this.ysF1]) if (j >= 0 && this.enemies[j].alive && this.enemies[j].kind === 'ysmeret') lost += Math.max(0, this.ysPool - this.enemies[j].hp);
    this.ysPool = Math.max(1, this.ysPool - lost);
    // The flame that holds the tank (her threat target); with no tank up, the first flame.
    let tankSlot = 0;
    for (const [slot, j] of [[0, this.ysF0], [1, this.ysF1]] as const) {
      if (j < 0 || !this.enemies[j].alive || this.enemies[j].kind !== 'ysmeret') continue;
      const t = this.targetOf(j, 0);
      if (t >= 0 && this.isTank(t) && this.heroPlayer(t).hp > 0) { tankSlot = slot; break; }
    }
    if (tankSlot === 0 && !(this.ysF0 >= 0 && this.enemies[this.ysF0].alive)) tankSlot = 1;
    for (const [slot, j] of [[0, this.ysF0], [1, this.ysF1]] as const) {
      if (j < 0) continue;
      const f = this.enemies[j];
      if (!f.alive || f.kind !== 'ysmeret') continue;
      f.hp = this.ysPool;
      // Leashed: it fights from where it landed.
      const ax = slot ? this.ysAx1 : this.ysAx0, ay = slot ? this.ysAy1 : this.ysAy0;
      const dx = f.x - ax, dy = f.y - ay, dd = Math.hypot(dx, dy);
      if (dd > YSMERETV2.leash) { f.x = ax + (dx / dd) * YSMERETV2.leash; f.y = ay + (dy / dd) * YSMERETV2.leash; }
      let near = false;
      for (let k = 0; k < this.heroes.length; k++) {
        const q = this.heroPlayer(k);
        if (q.hp > 0 && dist2(q.x, q.y, f.x, f.y) < YSMERETV2.flareR * YSMERETV2.flareR) { near = true; break; }
      }
      let away = slot ? this.ysAway1 : this.ysAway0;
      away = near ? 0 : away + dt;
      if (away >= YSMERETV2.flareAfter) {
        away = 0;
        this.events.push({ type: 'ysFlare', x: f.x, y: f.y });
        this.eachHero(() => { if (this.player.hp > 0) this.hurtPlayer(YSMERET.ventBlast * YSMERETV2.flareMult * this.tierDamage, j, false, 'a lone flame'); }, true);
      }
      if (slot) this.ysAway1 = away; else this.ysAway0 = away;
      // One Bellow timer (ysBel0), run by the flame that holds the tank.
      const bellows = YSMERETV2.bellowEvery > 0 && slot === tankSlot;
      if (bellows) this.ysBel0 -= dt;
      if (f.castId || f.stunT > 0) continue;
      if (bellows && this.ysBel0 <= 0) {
        // Bellow Slam on the tank this flame is on.
        this.ysBel0 = YSMERETV2.bellowEvery;
        this.bellowTarget = this.targetOf(j, 0);
        this.startCast(j, 'bellowSlam', 'Bellow Slam', YSMERET.bellowCast, false);
        continue;
      }
      if (f.abilityT > 0) continue;
      f.abilityT = YSMERET.scatterEvery; // runAbilities counts it down
      this.startCast(j, 'scatter', 'Scatter Embers', YSMERET.scatterCast, false);
    }
  }



  /**
   * Oskel's clocks. Downstroke: one gold circle someone must stand under; everyone under it
   * is Pressed for OSKEL.pressed s, and a Pressed hero under the next one is crushed and
   * doesn't count, so the party takes turns. Rivets: a ring under every hero. Stamp: the tank hit.
   */
  private oskelClock(dt: number): void {
    for (let k = 0; k < this.heroes.length; k++) {
      const q = this.heroPlayer(k);
      if ((q.pressedT ?? 0) > 0) q.pressedT = Math.max(0, (q.pressedT ?? 0) - dt);
    }
    if (this.bossIndex < 0) return;
    const i = this.bossIndex;
    const e = this.enemies[i];
    if (!e || !e.alive || e.kind !== 'oskel') return;
    if (this.osStage > 0) this.oskelStages(dt, e);
    const late = this.time - e.spawnedAt > OSKEL.enrageAfter;
    if (late && !this.bossEnraged) {
      this.bossEnraged = true;
      this.events.push({ type: 'bossEnrage' });
    }
    this.downT -= dt;
    this.rivetT -= dt;
    this.stampT -= dt;
    const downOpen = this.telegraphs.some((t) => t.alive && t.kind === 'soak' && t.owner === -3);
    if (this.downT <= 0 && !downOpen) {
      this.downT = late ? OSKEL.downEnraged : OSKEL.downEvery;
      // Off to one side of Oskel, away from the tank, so the press is a walk, not a step.
      const tgt = this.heroPlayer(this.targetOf(i, 0));
      const a = Math.atan2(tgt.y - e.y, tgt.x - e.x) + Math.PI * (0.5 + 0.5 * ((this.tick >> 4) % 2));
      const c = { x: e.x + Math.cos(a) * OSKEL.downDist, y: e.y + Math.sin(a) * OSKEL.downDist };
      this.clampArena(c, OSKEL.downRadius + 10);
      // owner -3: the Downstroke (Pressed heroes don't count).
      this.addTelegraph('circle', c.x, c.y, OSKEL.downRadius, 0, 0, OSKEL.downFuse, OSKEL.downMiss, 'soak', -3);
      this.events.push({ type: 'castStart', index: i, id: 'downstroke', name: 'Downstroke' });
      // OSKELV2 stage 2: every Downstroke flips the belt, after a warning arrow on the floor.
      if (this.osStage === 2) this.osFlipT = OSKELV2.flipWarn;
    }
    // Phase 16 U1: from `GROUP_ECHO.below` health, every other one on this timer is his echo's (the first one is).
    let move: string = this.bossVariant;
    if (this.rivetT <= 0 && this.bossEcho && e.hp <= e.maxHp * GROUP_ECHO.below) {
      if (this.echoNext) { move = this.bossEcho; this.events.push({ type: 'echo', id: this.bossEcho }); }
      this.echoNext = !this.echoNext;
    }
    if (this.rivetT <= 0 && move === 'cut') {
      // Die Cut: half the floor, split through Oskel. Away from an open plate, so its taker is safe;
      // otherwise the side turns a quarter each time.
      this.rivetT = DIECUT.every;
      const plate = this.telegraphs.find((t) => t.alive && t.kind === 'soak' && t.owner === -3);
      const a = plate ? Math.atan2(plate.y - e.y, plate.x - e.x) + Math.PI : (this.cutCount * Math.PI) / 2 + ((this.seed & 3) * Math.PI) / 2;
      this.cutCount++;
      this.addTelegraph('cone', e.x, e.y, ARENA * 2, a, Math.PI, DIECUT.fuse, DIECUT.damage, 'hit', -1); // scaled by tier as it lands
      this.events.push({ type: 'castStart', index: i, id: 'dieCut', name: 'Die Cut' });
    } else if (this.rivetT <= 0 && move === 'punch') {
      // Punch Line: marching rows of punches out from Oskel.
      this.rivetT = PUNCH.every;
      const plate = this.telegraphs.find((t) => t.alive && t.kind === 'soak' && t.owner === -3);
      let a: number;
      // With a plate open, it sits midway between two rows, so its taker is safe.
      if (plate) a = Math.atan2(plate.y - e.y, plate.x - e.x) + Math.PI / PUNCH.rows;
      else {
        const up: number[] = [];
        for (let k = 0; k < this.heroes.length; k++) if (this.heroPlayer(k).hp > 0) up.push(k);
        const q = this.heroPlayer(up.length ? up[this.rng.int(up.length)] : 0);
        a = Math.atan2(q.y - e.y, q.x - e.x);
      }
      for (let row = 0; row < PUNCH.rows; row++) {
        const s = (row * 2 * Math.PI) / PUNCH.rows;
        for (let n = 0; n < PUNCH.n; n++) {
          const d = PUNCH.gap * (n + 0.5);
          const x = e.x + Math.cos(a + s) * d, y = e.y + Math.sin(a + s) * d;
          if (x * x + y * y > (ARENA - PUNCH.r * 0.5) ** 2) break;
          this.addTelegraph('circle', x, y, PUNCH.r + PUNCH.grow * n, 0, 0, PUNCH.first + PUNCH.step * n, PUNCH.damage, 'hit', -1); // scaled by tier as it lands
        }
      }
      this.events.push({ type: 'castStart', index: i, id: 'punchLine', name: 'Punch Line' });
    } else if (this.rivetT <= 0) {
      this.rivetT = OSKEL.rivetEvery;
      for (let k = 0; k < this.heroes.length; k++) {
        const q = this.heroPlayer(k);
        if (q.hp > 0) this.addTelegraph('circle', q.x, q.y, OSKEL.rivetRadius, 0, 0, OSKEL.rivetFuse, OSKEL.rivet, 'hit', -1);
      }
      this.events.push({ type: 'castStart', index: i, id: 'rivets', name: 'Rivets' });
    }
    if (e.castId || e.stunT > 0) return;
    if (this.stampT <= 0) {
      this.stampT = OSKEL.stampEvery;
      this.stampTarget = this.targetOf(i, 0);
      this.startCast(i, 'stamp', 'Stamp', OSKEL.stampCast, false);
    }
  }

  /**
   * OSKELV2 (design, oskel-v2.md): the stages, and from stage 2 the press bed. The belt carries every hero, every foe but
   * Oskel, and the Downstroke plate `belt` a second along `osDir` (`belt3` in stage 3, which stops flipping). The crush line
   * is the downstream `arc` of the arena's rim, `depth` deep: a hero on it takes `crush` of max health and is pushed `push`
   * upstream, and a normal foe on it dies.
   */
  private oskelStages(dt: number, e: Enemy): void {
    const f = e.hp / e.maxHp;
    if (this.osStage === 1 && f <= OSKELV2.stage2) {
      this.osStage = 2;
      this.bossPhase = 2;
      this.events.push({ type: 'phase', phase: 2 });
    }
    if (this.osStage === 2 && f <= OSKELV2.stage3) {
      this.osStage = 3;
      this.bossPhase = 3;
      this.osFlipT = -1; // it keeps the way it had
      this.events.push({ type: 'phase', phase: 3 });
    }
    if (this.osStage < 2) return;
    if (this.osFlipT >= 0) {
      this.osFlipT -= dt;
      if (this.osFlipT <= 0) { this.osDir = (this.osDir + Math.PI) % (2 * Math.PI); this.osFlipT = -1; }
    }
    const v = (this.osStage === 3 ? OSKELV2.belt3 : OSKELV2.belt) * dt;
    const cx = Math.cos(this.osDir), cy = Math.sin(this.osDir);
    for (let k = 0; k < this.heroes.length; k++) {
      const q = this.heroPlayer(k);
      if (q.hp <= 0 || (q.swallowT ?? 0) > 0) continue;
      q.x += cx * v; q.y += cy * v;
      this.clampArena(q, PLAYER_RADIUS);
    }
    for (const o of this.enemies) {
      if (!o.alive || o.kind === 'oskel') continue;
      o.x += cx * v; o.y += cy * v;
      this.clampArena(o, o.def.radius);
    }
    if (OSKELV2.plateRides) for (const t of this.telegraphs) if (t.alive && t.kind === 'soak' && t.owner === -3) { t.x += cx * v; t.y += cy * v; this.clampArena(t, t.r + 10); }
    // The crush line.
    const at = this.acting;
    for (let k = 0; k < this.heroes.length; k++) {
      const q = this.heroPlayer(k);
      if (q.hp <= 0 || !this.onCrushLine(q.x, q.y, PLAYER_RADIUS)) continue;
      this.use(k);
      this.hurtPlayer(q.maxHp * OSKELV2.crush, -1, true, 'the crush line');
      // Far enough upstream that the belt takes at least pushSecs to carry a hero standing still back onto the line
      // (QA, 25 Nov: in stage 3 the belt carried them back within ~1 s). Stage 2 keeps `push`, which already gives that.
      const along = q.x * cx + q.y * cy;
      const back = along - (this.arenaR - OSKELV2.depth - PLAYER_RADIUS - OSKELV2.pushSecs * (this.osStage === 3 ? OSKELV2.belt3 : OSKELV2.belt));
      const push = Math.max(OSKELV2.push, back);
      q.x -= cx * push; q.y -= cy * push;
      this.clampArena(q, PLAYER_RADIUS);
      this.events.push({ type: 'slam', x: q.x, y: q.y, r: 50, source: 'crush' });
      this.osCrushHits++;
    }
    this.use(at);
    for (let j = 0; j < this.enemies.length; j++) {
      const o = this.enemies[j];
      if (o.alive && o.def.rank === 'normal' && this.onCrushLine(o.x, o.y, o.def.radius)) { o.hp = 0; this.killEnemy(j); }
    }
  }

  /** OSKELV2: whether a body at (x, y) of radius r touches the crush line (the downstream arc of the rim). */
  onCrushLine(x: number, y: number, r: number): boolean {
    if (this.osStage < 2) return false;
    if (Math.hypot(x, y) + r < this.arenaR - OSKELV2.depth) return false;
    let d = Math.atan2(y, x) - this.osDir;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return Math.abs(d) <= OSKELV2.arc / 2;
  }

  /**
   * A Downstroke lands: who is under it, who counts, and the crush on any Pressed hero.
   * Returns the heroes who took it (stood under it without being Pressed); none means it was missed.
   */
  private resolveDownstroke(t: Telegraph): number[] {
    const at = this.acting;
    const took: number[] = [];
    for (let k = 0; k < this.heroes.length; k++) {
      const q = this.heroPlayer(k);
      if (q.hp <= 0 || dist2(q.x, q.y, t.x, t.y) > (t.r + PLAYER_RADIUS) ** 2) continue;
      if ((q.pressedT ?? 0) > 0) {
        this.use(k);
        this.hurtPlayer(q.maxHp * OSKEL.crush, -1, true, 'a second Downstroke');
        this.events.push({ type: 'slam', x: q.x, y: q.y, r: 50, source: 'crush' });
      } else {
        took.push(k);
        q.pressedT = OSKEL.pressed;
      }
    }
    this.use(at);
    return took;
  }

  /** The heroes standing in a gold circle as it lands (the Downstroke has its own rule). */
  private soakers(t: Telegraph): number[] {
    if (t.owner === -3) return this.resolveDownstroke(t);
    const out: number[] = [];
    for (let k = 0; k < this.heroes.length; k++) {
      const q = this.heroPlayer(k);
      if (q.hp > 0 && dist2(q.x, q.y, t.x, t.y) <= (t.r + PLAYER_RADIUS) ** 2) out.push(k);
    }
    return out;
  }

  /** Relay (verb set): a soaker with 2 pieces deals more damage for a while; with 3, so does the nearest ally. */
  private relaySoak(took: number[]): void {
    const at = this.acting;
    for (const k of took) {
      this.use(k);
      const n = this.setCount('relay');
      if (n < 2) continue;
      const q = this.player;
      q.relayT = SET_TUNING.rlTime;
      if (n < 3) continue;
      let best = -1;
      let bd = Infinity;
      for (let j = 0; j < this.heroes.length; j++) {
        const o = this.heroPlayer(j);
        if (j === k || o.hp <= 0) continue;
        const d = dist2(o.x, o.y, q.x, q.y);
        if (d < bd) { bd = d; best = j; }
      }
      if (best >= 0) this.heroPlayer(best).relayT = SET_TUNING.rlTime;
    }
    this.use(at);
  }

  // ---------------------------------------------------------------- the raid

  /**
   * Grandmother Slag's clocks. Phase 1 The Ladle: Ladle Pour on the tank, Slagling adds.
   * Phase 2 The Pour: molten lanes and a steady party burn. Phase 3 Last Ember: soak vents
   * and Cinder Marks. Ladle Burn ticks the whole fight. Last Ember ends it at `hardEnrage`.
   */
  /** Phase 16 U1: Grandmother Slag's version in effect now: her echo while one is on, else her own. */
  private slagMove(): string {
    return this.echoLive && this.bossEcho ? this.bossEcho : this.bossVariant;
  }

  private slagClock(dt: number): void {
    if (this.bossIndex < 0) return;
    const i = this.bossIndex;
    const e = this.enemies[i];
    if (!e || !e.alive || e.kind !== 'grandmotherSlag') return;
    const frac = e.hp / e.maxHp;
    const phase = frac > SLAG.phase2 ? 1 : frac > SLAG.phase3 ? 2 : 3;
    if (phase > this.bossPhase) {
      this.bossPhase = phase;
      this.events.push({ type: 'phase', phase });
      if (phase === 2 && this.bossVariant === 'brim') {
        // The Brimming: the pit fills, and cooling islands rise, each due to sink at a different time.
        this.islands = [];
        for (let k = 0; k < BRIM.count; k++) this.islands.push(this.placeIsland(e, this.islandN++, BRIM.life * (k + 1) / BRIM.count));
        this.events.push({ type: 'castStart', index: i, id: 'brimming', name: 'The Brimming' });
      }
      if (phase === 2 && this.bossVariant === 'flow') { this.flowStage = 0; this.flowT = OVERFLOW.first; }
      if (phase === 3) { this.islands = []; if (this.flowStage) this.events.push({ type: 'overflow', stage: 'ebb' }); this.flowStage = 0; this.echoLive = false; }
    }
    // Phase 16 U1: from `RAID_ECHO.slag` health in phase 2, her echo takes her own version's place `SLAG_ECHO.on` s at a time.
    if (phase === 2 && this.bossEcho && frac <= RAID_ECHO.slag) {
      this.echoT -= dt;
      if (this.echoT <= 0) {
        this.echoLive = !this.echoLive;
        this.echoT = this.echoLive ? SLAG_ECHO.on : SLAG_ECHO.off;
        if (this.echoLive) this.events.push({ type: 'echo', id: this.bossEcho });
        // Clear what was running, then start the version that runs now.
        this.islands = [];
        if (this.flowStage) this.events.push({ type: 'overflow', stage: 'ebb' });
        this.flowStage = 0;
        const now = this.slagMove();
        if (now === 'brim') {
          for (let k = 0; k < BRIM.count; k++) this.islands.push(this.placeIsland(e, this.islandN++, BRIM.life * (k + 1) / BRIM.count));
          this.events.push({ type: 'castStart', index: i, id: 'brimming', name: 'The Brimming' });
        }
        if (now === 'flow') this.flowT = OVERFLOW.first;
      }
    }
    const move = this.slagMove();
    if (phase === 2 && move === 'flow') {
      // The Overflow: warn, rise from the rim, burn anyone far from her, ebb.
      this.flowT -= dt;
      if (this.flowT <= 0) {
        if (this.flowStage === 0) { this.flowStage = 1; this.flowT += OVERFLOW.warn; this.events.push({ type: 'overflow', stage: 'warn' }); }
        else if (this.flowStage === 1) { this.flowStage = 2; this.flowT += OVERFLOW.last; this.flowTickT = 0; this.events.push({ type: 'overflow', stage: 'rise' }); }
        else { this.flowStage = 0; this.flowT += OVERFLOW.every - OVERFLOW.warn - OVERFLOW.last; this.events.push({ type: 'overflow', stage: 'ebb' }); }
      }
      if (this.flowStage === 2) {
        this.flowTickT -= dt;
        if (this.flowTickT <= 0) {
          this.flowTickT += OVERFLOW.tick;
          const back = this.acting;
          this.eachHero(() => {
            if (dist2(this.player.x, this.player.y, e.x, e.y) > OVERFLOW.safeR ** 2) this.hurtPlayer(this.player.maxHp * OVERFLOW.burn, i, true);
          });
          this.use(back);
        }
      }
    }
    if (this.islands.length) {
      // An island that sinks is replaced by a new one elsewhere.
      for (let k = 0; k < this.islands.length; k++) {
        this.islands[k].t -= dt;
        if (this.islands[k].t <= 0) this.islands[k] = this.placeIsland(e, this.islandN++, BRIM.life);
      }
    }
    // Ladle Burn: once a second, every hero burns for their stacks.
    const at = this.acting;
    this.raidBurnT -= dt;
    if (this.raidBurnT <= 0) {
      this.raidBurnT += 1;
      for (let k = 0; k < this.heroes.length; k++) {
        this.use(k);
        const p = this.player;
        if ((p.slag ?? 0) > 0 && p.hp > 0) this.hurtPlayer(p.maxHp * SLAG.burnTick * (p.slag ?? 0), -1, true, 'Ladle Burn');
      }
      this.use(at);
    }
    for (let k = 0; k < this.heroes.length; k++) {
      const q = this.heroPlayer(k);
      if ((q.sunderT ?? 0) > 0) q.sunderT = Math.max(0, (q.sunderT ?? 0) - dt);
    }
    if (phase === 2) {
      this.heatT -= dt;
      if (this.heatT <= 0) {
        this.heatT += SLAG.heatEvery;
        // The Brimming: off an island the slag burns harder, and on one it doesn't burn at all.
        const brim = move === 'brim';
        this.eachHero(() => {
          const share = brim ? (this.onIsland(this.player.x, this.player.y) ? 0 : BRIM.heat) : move === 'flow' ? OVERFLOW.heat : SLAG.heat;
          if (share > 0) this.hurtPlayer(this.player.maxHp * share, i, true);
        });
        this.use(at);
      }
    }
    if (phase === 1) {
      this.addsT -= dt;
      if (this.addsT <= 0) {
        this.addsT = SLAG.addsEvery;
        for (let k = 0; k < SLAG.adds; k++) {
          const a = (k / SLAG.adds) * Math.PI * 2 + this.time;
          const c = { x: e.x + Math.cos(a) * 260, y: e.y + Math.sin(a) * 260 };
          this.clampArena(c, 20);
          this.spawn('slagling', c.x, c.y);
        }
      }
    }
    if (phase === 3) {
      this.raidVentT -= dt;
      this.marksT -= dt;
    }
    const ventsOpen = this.telegraphs.some((t) => t.alive && t.kind === 'soak' && t.owner === -2);
    if (phase === 3 && this.raidVentT <= 0 && !ventsOpen) {
      this.raidVentT = SLAG.ventEvery;
      const tgt = this.heroPlayer(this.targetOf(i, 0));
      const a = Math.atan2(tgt.y - e.y, tgt.x - e.x) + Math.PI / 2;
      for (const sgn of [1, -1]) {
        const c = { x: e.x + Math.cos(a) * SLAG.ventDist * sgn, y: e.y + Math.sin(a) * SLAG.ventDist * sgn };
        this.clampArena(c, SLAG.ventRadius + 10);
        this.addTelegraph('circle', c.x, c.y, SLAG.ventRadius, 0, 0, SLAG.ventFuse, SLAG.ventBlast, 'soak', -2);
      }
      this.events.push({ type: 'castStart', index: i, id: 'crucibleVents', name: 'Crucible Vents' });
    }
    if (e.castId || e.stunT > 0) return;
    if (!this.lastEmberCast && this.time - e.spawnedAt >= SLAG.hardEnrage) {
      this.lastEmberCast = true;
      if (!this.bossEnraged) {
        this.bossEnraged = true;
        this.events.push({ type: 'bossEnrage' });
      }
      this.startCast(i, 'lastEmber', 'Last Ember', SLAG.lastEmberCast, false);
      return;
    }
    this.ladleT -= dt;
    this.pourT -= dt;
    if (this.ladleT <= 0) {
      this.ladleT = phase === 1 ? SLAG.ladleEvery : SLAG.ladleLate;
      this.ladleTarget = this.targetOf(i, 0);
      this.startCast(i, 'ladlePour', 'Ladle Pour', SLAG.ladleCast, false);
    } else if (phase === 2 && this.pourT <= 0 && (move === 'brim' || move === 'flow')) {
      // The Brimming: she churns the pit on the Pour's timer and cast, with no lanes. It keeps the Pour's
      // pause on the tank (skills' W7 trace: without it an Anvil Slagbinder tank won 4 of 32).
      this.pourT = SLAG.pourEvery;
      this.startCast(i, 'churn', 'Churn', SLAG.pourCast, false);
    } else if (phase === 2 && this.pourT <= 0) {
      this.pourT = SLAG.pourEvery;
      const tgt = this.heroPlayer(this.targetOf(i, 0));
      const base = Math.atan2(tgt.y - e.y, tgt.x - e.x);
      this.startCast(i, 'pour', 'The Pour', SLAG.pourCast, false);
      for (let k = 0; k < SLAG.pourLanes; k++) {
        // One lane at the target, the rest spread round her, turning each pour.
        const ang = base + (k * Math.PI * 2) / SLAG.pourLanes;
        this.addTelegraph('cone', e.x, e.y, SLAG.pourRange, ang, (SLAG.pourArc * Math.PI) / 180, SLAG.pourCast, SLAG.pourDamage, 'hit', i);
      }
    } else if (phase === 3 && this.marksT <= 0 && !ventsOpen && this.raidVentT > YSMERET.scatterCast + 0.5) {
      this.marksT = SLAG.marksEvery;
      // Cinder Marks work as Ysmeret's Scatter Embers (finishCast 'scatter'): spread out.
      this.startCast(i, 'scatter', 'Cinder Marks', YSMERET.scatterCast, false);
    }
  }

  /**
   * The Furnace Regent's clocks (raid 4, the Flue). Phases 1 and 2: Decrees land on non-tank heroes
   * (one at a time, then two). A Decree burns its holder and anyone close; touch an ally who can
   * take it to pass it on (the passer is Spent for a while), and after `decreePasses` passes it
   * fades. Left too long, or on a fallen hero, it bursts on the whole party. Phase 2 adds Ash Fall.
   * Phase 3 (Abdication): no more Decrees, a growing party-wide burn. Last Word at `hardEnrage`.
   */
  private regentClock(dt: number): void {
    if (this.bossIndex < 0) return;
    const i = this.bossIndex;
    const e = this.enemies[i];
    if (!e || !e.alive || e.kind !== 'regent') {
      this.regentDecree = [];
      return;
    }
    const frac = e.hp / e.maxHp;
    const phase = frac > REGENT.phase2 ? 1 : frac > REGENT.phase3 ? 2 : 3;
    if (phase > this.bossPhase) {
      this.bossPhase = phase;
      this.events.push({ type: 'phase', phase });
      if (phase === 3) this.regentDecree = []; // Abdication: the Decrees lapse
    }
    const at = this.acting;
    this.tickDecrees(dt, i);
    if (phase === 3) {
      this.officeT -= dt;
      if (this.officeT <= 0) {
        this.officeT += REGENT.officeEvery;
        this.officePulses++;
        const share = REGENT.officeDamage * (1 + REGENT.officeGrow * (this.officePulses - 1));
        this.eachHero(() => this.hurtPlayer(this.player.maxHp * share, i, true));
        this.events.push({ type: 'officePulse', n: this.officePulses });
      }
    }
    this.use(at);
    if (e.castId || e.stunT > 0) return;
    if (!this.lastEmberCast && this.time - e.spawnedAt >= REGENT.hardEnrage) {
      this.lastEmberCast = true;
      if (!this.bossEnraged) {
        this.bossEnraged = true;
        this.events.push({ type: 'bossEnrage' });
      }
      this.startCast(i, 'lastWord', 'Last Word', REGENT.lastWordCast, false);
      return;
    }
    if (phase < 3) {
      this.decreeT -= dt;
      if (this.decreeT <= 0) {
        this.decreeT = REGENT.decreeEvery;
        for (let n = 0; n < (phase === 2 ? 2 : 1); n++) this.landDecree();
      }
    }
    if (this.summonsT > 0) {
      this.summonsT -= dt;
      if (this.summonsT <= 0) {
        // The Summons lands: everyone not before the throne (within SUMMONS.radius of him) is struck.
        this.summonsT = 0;
        const at = this.acting;
        this.eachHero(() => {
          if (dist2(this.player.x, this.player.y, e.x, e.y) > (SUMMONS.radius + PLAYER_RADIUS * 0.5) ** 2) this.hurtPlayer(SUMMONS.damage * this.tierDamage, i);
        });
        this.use(at);
        this.events.push({ type: 'castDone', x: e.x, y: e.y, id: 'summons', name: 'Summons' });
        this.events.push({ type: 'slam', x: e.x, y: e.y, r: SUMMONS.radius });
      }
    }
    if (phase === 2) {
      this.ashT -= dt;
      if (this.ashT <= 0) {
        this.ashT = REGENT.ashEvery;
        // Phase 16 U1: from `RAID_ECHO.regent` health, every other one is his echo's (the first one is).
        let move: string = this.bossVariant;
        if (this.bossEcho && e.hp <= e.maxHp * RAID_ECHO.regent) {
          if (this.echoNext) { move = this.bossEcho; this.events.push({ type: 'echo', id: this.bossEcho }); }
          this.echoNext = !this.echoNext;
        }
        if (move === 'tithe') {
          // Phase 15 Y3: he demands a Tithe instead of the ash: a gold circle away from him that needs at least TITHE.need heroes.
          const a = this.rng.next() * Math.PI * 2;
          let x = e.x + Math.cos(a) * TITHE.dist, y = e.y + Math.sin(a) * TITHE.dist;
          const lim = ARENA - TITHE.r - 20, m = Math.hypot(x, y);
          if (m > lim) { x *= lim / m; y *= lim / m; }
          this.addTelegraph('circle', x, y, TITHE.r, 0, 0, TITHE.fuse, 0, 'soak', -5);
          this.events.push({ type: 'castStart', index: i, id: 'tithe', name: 'Tithe' });
          return;
        }
        if (move === 'court') {
          // Phase 12 W3: as the ash falls he calls a Summons: step out of your circle, then come before him.
          this.summonsT = SUMMONS.warn;
          this.events.push({ type: 'castStart', index: i, id: 'summons', name: 'Summons' });
        }
        // Scaled by tier as it lands (it was scaled twice before; ashDamage now carries the old tier 11 factor).
        const dmg = REGENT.ashDamage;
        for (let k = 0; k < this.heroes.length; k++) {
          const q = this.heroPlayer(k);
          if (q.hp <= 0) continue;
          this.addTelegraph('circle', q.x, q.y, REGENT.ashRadius, 0, 0, REGENT.ashCast, dmg, 'hit', i);
        }
      }
    }
  }

  /**
   * True when hero `k` can be given a Decree: up, not Spent, not already holding one. The Regent
   * never lands one on a tank, but a tank can take one passed by hand (`pass`).
   */
  canHoldDecree(k: number, pass = false): boolean {
    const q = this.heroPlayer(k);
    if (q.hp <= 0 || (!pass && this.isTank(k)) || (q.spentT ?? 0) > 0) return false;
    return !this.regentDecree.some((d) => d.hero === k);
  }

  /** A Decree lands on a hero who can hold one (seeded pick), if anyone can. */
  private landDecree(): void {
    const ok: number[] = [];
    for (let k = 0; k < this.heroes.length; k++) if (this.canHoldDecree(k)) ok.push(k);
    if (ok.length === 0) return;
    const k = ok[this.rng.int(ok.length)];
    this.regentDecree.push({ hero: k, t: REGENT.decreeTime, passes: 0, held: 0 });
    this.events.push({ type: 'decree', hero: k });
  }

  /** Burns, passes and bursts for every live Decree. */
  private tickDecrees(dt: number, boss: number): void {
    for (let n = this.regentDecree.length - 1; n >= 0; n--) {
      const d = this.regentDecree[n];
      d.t -= dt;
      d.held += dt;
      const h = this.heroPlayer(d.hero);
      if (h.hp <= 0 || d.t <= 0) {
        // It bursts: on a fallen holder, or when time runs out.
        this.regentDecree.splice(n, 1);
        const share = REGENT.decreeBurst;
        this.eachHero(() => this.hurtPlayer(this.player.maxHp * share, boss, true));
        this.events.push({ type: 'decreeBurst', hero: d.hero });
        continue;
      }
      // The seal burns its holder, and anyone standing close (Handover 2: less on the holder's seal).
      this.use(d.hero);
      const burn = this.setCount('handover') >= 2 ? 1 - SET_TUNING.hoCut : 1;
      for (let k = 0; k < this.heroes.length; k++) {
        const q = this.heroPlayer(k);
        if (q.hp <= 0) continue;
        const near = k !== d.hero && dist2(q.x, q.y, h.x, h.y) <= REGENT.scorchRadius * REGENT.scorchRadius;
        if (k !== d.hero && !near) continue;
        this.use(k);
        this.hurtPlayer(this.player.maxHp * (k === d.hero ? REGENT.decreeTick : REGENT.scorchTick) * burn * dt, boss, true);
      }
      if (d.held < REGENT.settle) continue;
      // Pass it on: touch an ally who can take it.
      let to = -1;
      let best = REGENT.passRange * REGENT.passRange;
      for (let k = 0; k < this.heroes.length; k++) {
        if (k === d.hero || !this.canHoldDecree(k, true)) continue;
        const q = this.heroPlayer(k);
        const dd = dist2(q.x, q.y, h.x, h.y);
        if (dd <= best) { best = dd; to = k; }
      }
      if (to < 0) continue;
      const from = d.hero;
      h.spentT = REGENT.spentTime;
      d.passes++;
      // In Edict (two at once) each Decree fades after one pass, so two can keep moving among three non-tanks.
      const done = d.passes >= (this.bossPhase === 2 ? REGENT.edictPasses : REGENT.decreePasses);
      this.events.push({ type: 'decreePassed', from, hero: to, done });
      if (done) this.regentDecree.splice(n, 1);
      else { d.hero = to; d.t = REGENT.decreeTime; d.held = 0; }
    }
  }

  /**
   * The Cinder Colossus's clocks (raid 3, the Smeltery). He turns toward the hero he is
   * fighting at `turnRate`; his front is plated (`colossusSide`). Slag Sweep: a cone in front.
   * Phase 2 Wheel: he turns on the non-tank who hurt him most and sweeps there. Phase 3
   * Meltdown: the plate cracks and a growing party-wide burn pulses. Pour Out at `hardEnrage`.
   */
  private colossusClock(dt: number): void {
    if (this.bossIndex < 0) return;
    const i = this.bossIndex;
    const e = this.enemies[i];
    if (!e || !e.alive || e.kind !== 'colossus') return;
    const frac = e.hp / e.maxHp;
    const phase = frac > COLO.phase2 ? 1 : frac > COLO.phase3 ? 2 : 3;
    if (phase > this.bossPhase) {
      this.bossPhase = phase;
      this.events.push({ type: 'phase', phase });
    }
    const keep = Math.exp(-dt / COLO.wheelWindow);
    for (let k = 0; k < this.colDmg.length; k++) this.colDmg[k] *= keep;
    if (phase === 3) {
      this.meltT -= dt;
      if (this.meltT <= 0) {
        this.meltT += COLO.meltEvery;
        this.meltPulses++;
        const share = COLO.meltDamage * (1 + COLO.meltGrow * (this.meltPulses - 1));
        const at = this.acting;
        this.eachHero(() => this.hurtPlayer(this.player.maxHp * share, i, true));
        this.use(at);
        this.events.push({ type: 'meltPulse', n: this.meltPulses });
      }
    }
    if (this.millT > 0) {
      // Millstone: he grinds round, and slag pours off him onto any non-tank not at his back.
      this.millT -= dt;
      this.colFacing = angleDiff(this.colFacing + this.millDir * MILL.turn * dt, 0);
      this.millTickT -= dt;
      if (this.millTickT <= 0) {
        this.millTickT += MILL.tick;
        const at = this.acting;
        for (let k = 0; k < this.heroes.length; k++) {
          const q = this.heroPlayer(k);
          if (q.hp <= 0 || this.isTank(k)) continue;
          const d = Math.hypot(q.x - e.x, q.y - e.y);
          if (d > e.def.radius + MILL.range + PLAYER_RADIUS) continue;
          if (Math.abs(angleDiff(Math.atan2(q.y - e.y, q.x - e.x), this.colFacing)) > MILL.arc) continue;
          this.use(k);
          this.hurtPlayer(q.maxHp * MILL.damage, i, true);
        }
        this.use(at);
      }
      if (this.millT <= 0) {
        this.millT = 0;
        this.events.push({ type: 'millstone', stage: 'end', dir: this.millDir });
      }
    }
    // He turns toward the hero he is fighting, but slowly, and not while he casts or grinds.
    if (!e.castId && this.millT <= 0) {
      const t = this.heroPlayer(this.targetOf(i, 0));
      const want = Math.atan2(t.y - e.y, t.x - e.x);
      const diff = angleDiff(want, this.colFacing);
      const step = COLO.turnRate * dt;
      this.colFacing = angleDiff(this.colFacing + Math.max(-step, Math.min(step, diff)), 0);
    }
    if (e.castId || e.stunT > 0) return;
    if (!this.lastEmberCast && this.time - e.spawnedAt >= COLO.hardEnrage) {
      this.lastEmberCast = true;
      if (!this.bossEnraged) {
        this.bossEnraged = true;
        this.events.push({ type: 'bossEnrage' });
      }
      this.startCast(i, 'pourOut', 'Pour Out', COLO.pourOutCast, false);
      return;
    }
    if (this.millT > 0) return;
    this.sweepT -= dt;
    if (phase === 2) this.wheelT -= dt;
    if (phase === 2 && this.wheelT <= 0) {
      this.wheelT = COLO.wheelEvery;
      // Phase 16 U1: from `RAID_ECHO.colossus` health, every other one is his echo's (the first one is).
      let move: string = this.bossVariant;
      if (this.bossEcho && e.hp <= e.maxHp * RAID_ECHO.colossus) {
        if (this.echoNext) { move = this.bossEcho; this.events.push({ type: 'echo', id: this.bossEcho }); }
        this.echoNext = !this.echoNext;
      }
      if (move === 'shift') this.startCast(i, 'plateShift', 'Plate Shift', COLO.wheelCast, false);
      else if (move === 'mill') this.startCast(i, 'millstone', 'Millstone', COLO.wheelCast, false);
      else this.startCast(i, 'wheel', 'Wheel', COLO.wheelCast, false);
    } else if (phase < 3 && this.sweepT <= 0) {
      this.sweepT = COLO.sweepEvery;
      this.slagSweep(i);
    }
  }

  /** Slag Sweep: a telegraphed cone straight out of his front. */
  private slagSweep(i: number): void {
    const e = this.enemies[i];
    this.startCast(i, 'slagSweep', 'Slag Sweep', COLO.sweepCast, false);
    this.addTelegraph('cone', e.x, e.y, COLO.sweepRange, this.colFacing, (COLO.sweepArc * Math.PI) / 180, COLO.sweepCast, COLO.sweepDamage, 'hit', i);
  }

  /** The Colossus's damage taken from a hero at (x, y): plated in front, open behind. */
  /** True when (x, y) is in the Colossus's back arc, the same arc that takes COLO.backMult. Meltdown doesn't change where his back is. */
  /** Phase 16 U2: whether the Lampeye at `e` can see (x, y): no standing pillar crosses the line between them. */
  lampeyeSees(e: Enemy, x: number, y: number): boolean {
    const dx = x - e.x, dy = y - e.y, L2 = dx * dx + dy * dy || 1;
    // Too close for it to focus: a hero right under the eye is out of its gaze.
    if (L2 < (e.def.radius + LAMPEYE.under) ** 2) return false;
    // H3b: on a Halls map walls block its gaze, as pillars do.
    if (this.hallsOn && !clearWalk(this.halls!, e.x, e.y, x, y)) return false;
    for (const c of this.pillars) {
      if (c.cracked) continue;
      const k = Math.max(0, Math.min(1, ((c.x - e.x) * dx + (c.y - e.y) * dy) / L2));
      if (dist2(e.x + dx * k, e.y + dy * k, c.x, c.y) < c.r * c.r) return false;
    }
    return true;
  }

  /** Phase 16 U2: whether this fight has an Ashwall in it (cheap, so damage checks skip the rest otherwise). */
  ashwallUp(): boolean {
    return this.encounterDef.spawns.some((s) => s.kind === 'ashwall');
  }

  /** The foe Ashwall `i` guards: the nearest living foe that isn't an Ashwall or a boss, within `guardRange`; -1 for none. */
  ashwallWard(i: number): number {
    const a = this.enemies[i];
    let best = -1, bd = ASHWALL.guardRange ** 2;
    for (let j = 0; j < this.enemies.length; j++) {
      const o = this.enemies[j];
      if (j === i || !o.alive || o.kind === 'ashwall' || o.def.rank === 'boss') continue;
      const d = dist2(a.x, a.y, o.x, o.y);
      if (d < bd) { bd = d; best = j; }
    }
    return best;
  }

  /**
   * Phase 16 U2: the damage multiplier foe `i` takes from a hero at (x, y) because of Ashwalls. An Ashwall's
   * shield faces `aux`. Hit from inside its front arc, the Ashwall takes `front`, and any foe within
   * `shelterR` behind it (inside `shelterArc` of its back) takes `sheltered`. From its side or back, nothing.
   */
  ashwallTaken(i: number, x: number, y: number): number {
    const e = this.enemies[i];
    if (e.def.rank === 'boss') return 1;
    let m = 1;
    for (let k = 0; k < this.enemies.length; k++) {
      const a = this.enemies[k];
      if (!a.alive || a.kind !== 'ashwall') continue;
      if (Math.abs(angleDiff(Math.atan2(y - a.y, x - a.x), a.aux)) >= ASHWALL.frontArc) continue;
      if (k === i) { m = Math.min(m, ASHWALL.front); continue; }
      if (dist2(a.x, a.y, e.x, e.y) > ASHWALL.shelterR ** 2) continue;
      if (Math.abs(angleDiff(Math.atan2(e.y - a.y, e.x - a.x), a.aux + Math.PI)) < ASHWALL.shelterArc) m = Math.min(m, ASHWALL.sheltered);
    }
    return m;
  }

  /** Backstab: turn foe `e` toward the way it moved last tick, or toward hero `p` when it stood still. */
  private turnFoe(e: Enemy, p: Player, dt: number): void {
    const mx = e.x - e.px, my = e.y - e.py;
    const want = mx * mx + my * my > 0.25 ? Math.atan2(my, mx) : Math.atan2(p.y - e.y, p.x - e.x);
    if (e.face === undefined) { e.face = want; return; }
    const d = angleDiff(want, e.face);
    const step = (e.def.rank === 'boss' ? BACKSTAB.bossTurn : BACKSTAB.turn) * dt;
    e.face += Math.abs(d) <= step ? d : Math.sign(d) * step;
  }

  /** Backstab: hero `p` stands behind foe `e` (outside its front arc). */
  behindFoe(e: Enemy, p: Player = this.player): boolean {
    if (e.face === undefined || e.def.stationary) return false;
    return Math.abs(angleDiff(Math.atan2(p.y - e.y, p.x - e.x), e.face)) > BACKSTAB.front;
  }

  behindColossus(e: Enemy, x: number, y: number): boolean {
    return Math.abs(angleDiff(Math.atan2(y - e.y, x - e.x), this.colFacing + this.colPlate)) >= COLO.backArc;
  }

  colossusSide(e: Enemy, x: number, y: number): number {
    const off = Math.abs(angleDiff(Math.atan2(y - e.y, x - e.x), this.colFacing + this.colPlate));
    return off <= COLO.frontArc ? COLO.frontMult : off >= COLO.backArc ? COLO.backMult : 1;
  }

  /**
   * Old Vorhulm's clocks (raid 2, the Hoard). Phase 1 Gorge: an interruptible heal. Phase 2
   * Swallow: a hero goes inside and the Craw appears; break it to free them. Phase 3 Ember
   * Feast: spilled embers he eats unless the heroes grab them first. Last Meal at `hardEnrage`.
   */
  private coalClock(dt: number): void {
    if (this.bossIndex < 0) return;
    const i = this.bossIndex;
    const e = this.enemies[i];
    if (!e || !e.alive || e.kind !== 'vorhulm') {
      this.releaseSwallowed(false);
      return;
    }
    const frac = e.hp / e.maxHp;
    const phase = frac > COAL.phase2 ? 1 : frac > COAL.phase3 ? 2 : 3;
    if (phase > this.bossPhase) {
      this.bossPhase = phase;
      this.events.push({ type: 'phase', phase });
    }
    const at = this.acting;
    // The swallowed hero digests; when the time runs out they are downed.
    if (this.swallowed >= 0) {
      const q = this.heroPlayer(this.swallowed);
      q.swallowT = Math.max(0, (q.swallowT ?? 0) - dt);
      // The drain can't kill: only the clock running out Digests them, so the check is how fast the party breaks the Craw.
      q.hp = Math.max(1, q.hp - q.maxHp * COAL.swallowTick * dt);
      if (q.swallowT <= 0) this.releaseSwallowed(true);
    }
    // Spilled embers: a hero who walks over one takes it; he inhales the ones left too long.
    for (let k = this.coalEmbers.length - 1; k >= 0; k--) {
      const m = this.coalEmbers[k];
      m.t -= dt;
      let taken = false;
      for (let h = 0; h < this.heroes.length && !taken; h++) {
        const q = this.heroPlayer(h);
        if (q.hp > 0 && !((q.swallowT ?? 0) > 0) && dist2(q.x, q.y, m.x, m.y) <= COAL.emberPick * COAL.emberPick) taken = true;
      }
      if (taken) {
        this.coalEmbers.splice(k, 1);
        this.events.push({ type: 'emberTaken', x: m.x, y: m.y });
      } else if (m.t <= 0 || dist2(e.x, e.y, m.x, m.y) <= (e.def.radius + 10) ** 2) {
        this.coalEmbers.splice(k, 1);
        this.feedVorhulm(m.x, m.y);
      }
    }
    if (phase === 3) {
      this.spillT -= dt;
      if (this.spillT <= 0 && this.inhaleStage === 0) {
        this.spillT = COAL.spillEvery;
        // Phase 16 U1: in his last phase every other one is his echo's (the first one is).
        let move: string = this.bossVariant;
        if (this.bossEcho && e.hp <= e.maxHp * RAID_ECHO.vorhulm) {
          if (this.echoNext) { move = this.bossEcho; this.events.push({ type: 'echo', id: this.bossEcho }); }
          this.echoNext = !this.echoNext;
        }
        if (move === 'inhale') {
          // Inhale: warn, then draw everyone in; anyone at his mouth is bitten.
          this.inhaleStage = 1;
          this.inhaleT = INHALE.warn;
          this.events.push({ type: 'castStart', index: i, id: 'inhale', name: 'Inhale' });
          this.events.push({ type: 'inhale', stage: 'warn' });
        } else if (move === 'bank') {
          // Banked Coals: hot coals settle in a ring round him; a hero standing on one as it lands smothers it.
          for (let k = 0; k < BANK.count; k++) {
            const n = this.bankN++;
            const a = n * 2.39996 + (this.seed & 7) * 0.785;
            const r = n % 2 === 0 ? BANK.near : BANK.far;
            const c = { x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r };
            this.clampArena(c, BANK.radius + 10);
            // owner -4: a Banked Coal (no blast if missed: he eats it instead).
            this.addTelegraph('circle', c.x, c.y, BANK.radius, 0, 0, BANK.fuse, 0, 'soak', -4);
          }
          this.events.push({ type: 'castStart', index: i, id: 'bankedCoals', name: 'Banked Coals' });
        } else {
          for (let k = 0; k < COAL.spillN; k++) {
            const a = this.rng.range(0, Math.PI * 2);
            const r = this.rng.range(COAL.spillMin, COAL.spillMax);
            const c = { x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r };
            this.clampArena(c, 30);
            this.coalEmbers.push({ x: c.x, y: c.y, t: COAL.emberLife });
          }
          this.events.push({ type: 'castStart', index: i, id: 'emberSpill', name: 'Ember Spill' });
        }
      } else if (this.inhaleStage > 0) {
        this.inhaleT -= dt;
        if (this.inhaleT <= 0 && this.inhaleStage === 1) {
          this.inhaleStage = 2;
          this.inhaleT += INHALE.time;
          this.inhaleTickT = INHALE.tick;
          this.events.push({ type: 'inhale', stage: 'draw' });
        } else if (this.inhaleT <= 0) {
          this.inhaleStage = 0;
          this.events.push({ type: 'inhale', stage: 'end' });
        }
      }
      if (this.inhaleStage === 2) {
        const mouth = e.def.radius + INHALE.bite;
        this.inhaleTickT -= dt;
        const bite = this.inhaleTickT <= 0;
        if (bite) this.inhaleTickT += INHALE.tick;
        for (let k = 0; k < this.heroes.length; k++) {
          const q = this.heroPlayer(k);
          if (q.hp <= 0 || (q.swallowT ?? 0) > 0) continue;
          const dx = e.x - q.x, dy = e.y - q.y, d = Math.hypot(dx, dy) || 1;
          if (!this.anchored(q)) {
            const step = Math.min(Math.max(0, d - e.def.radius - PLAYER_RADIUS), INHALE.pull * CLASSES[this.heroes[k].cls].speed * dt);
            q.x += (dx / d) * step;
            q.y += (dy / d) * step;
          }
          if (bite && d <= mouth + PLAYER_RADIUS) {
            this.use(k);
            this.hurtPlayer(q.maxHp * INHALE.damage, i, true);
            this.events.push({ type: 'slam', x: q.x, y: q.y, r: 40 });
          }
        }
        this.use(at);
      }
    }
    if (phase >= 2 && this.swallowed < 0) this.swallowT -= dt;
    this.use(at);
    if (e.castId || e.stunT > 0) return;
    if (!this.lastEmberCast && this.time - e.spawnedAt >= COAL.hardEnrage) {
      this.lastEmberCast = true;
      if (!this.bossEnraged) {
        this.bossEnraged = true;
        this.events.push({ type: 'bossEnrage' });
      }
      this.startCast(i, 'lastMeal', 'Last Meal', COAL.lastMealCast, false);
      return;
    }
    this.gorgeT -= dt;
    if (phase >= 2 && this.swallowT <= 0 && this.swallowed < 0) {
      this.swallowT = COAL.swallowEvery;
      this.swallow(i);
    } else if (this.gorgeT <= 0) {
      this.gorgeT = COAL.gorgeEvery;
      this.startCast(i, 'coalGorge', 'Gorge', COAL.gorgeCast, true);
    }
  }

  /**
   * Swallow: he gulps down the living non-tank hero who has dealt the most damage this run, and the Craw
   * appears. (It used to be the furthest hero, which made the check how much health the ranged hero had.)
   */
  private swallow(i: number): void {
    const e = this.enemies[i];
    let pick = -1;
    let most = -1;
    for (let k = 0; k < this.heroes.length; k++) {
      const q = this.heroPlayer(k);
      if (q.hp <= 0 || this.isTank(k)) continue;
      const d = k === this.acting ? this.damageDealt : this.heroes[k].damageDealt;
      if (d > most) { most = d; pick = k; }
    }
    if (pick < 0) return;
    const q = this.heroPlayer(pick);
    q.swallowT = COAL.swallowTime;
    this.swallowed = pick;
    // The Craw bulges on his far side from the hero he is fighting.
    const tgt = this.heroPlayer(this.targetOf(i, 0));
    const a = Math.atan2(e.y - tgt.y, e.x - tgt.x);
    const c = { x: e.x + Math.cos(a) * COAL.crawDist, y: e.y + Math.sin(a) * COAL.crawDist };
    this.clampArena(c, 30);
    this.crawIndex = this.spawn('craw', c.x, c.y);
    this.events.push({ type: 'castStart', index: i, id: 'swallow', name: 'Swallow' });
    this.events.push({ type: 'swallowed', hero: pick });
  }

  /** The Craw broke: he spits the swallowed hero out beside it, with a moment's shield. */
  private crawBroken(): void {
    // Crawsplitter (3): the hero who broke it and the hero it frees both hit harder for a while.
    if (this.swallowed >= 0 && this.setCount('crawsplitter') >= 3) {
      this.player.freedT = SET_TUNING.csTime;
      this.heroPlayer(this.swallowed).freedT = SET_TUNING.csTime;
    }
    this.crawIndex = -1;
    this.releaseSwallowed(false);
  }

  /**
   * Lets the swallowed hero out. `digested`: the time ran out, so they come out downed.
   * Any Craw still standing goes too.
   */
  private releaseSwallowed(digested: boolean): void {
    if (this.swallowed < 0) return;
    const k = this.swallowed;
    const q = this.heroPlayer(k);
    q.swallowT = 0;
    this.swallowed = -1;
    const b = this.bossIndex >= 0 ? this.enemies[this.bossIndex] : undefined;
    const craw = this.crawIndex >= 0 ? this.enemies[this.crawIndex] : undefined;
    const out = craw?.alive ? craw : b;
    if (out) {
      const a = b ? Math.atan2(out.y - b.y, out.x - b.x) : 0;
      q.x = q.px = out.x + Math.cos(a) * 60;
      q.y = q.py = out.y + Math.sin(a) * 60;
      this.clampArena(q, PLAYER_RADIUS);
    }
    if (craw?.alive && craw.kind === 'craw') this.despawn(this.crawIndex);
    this.crawIndex = -1;
    if (digested) {
      this.noteHurt(q, Math.max(0, q.hp), ENEMIES.craw.name);
      q.hp = 0;
      this.events.push({ type: 'digested', hero: k });
    } else {
      q.hp = Math.max(1, q.hp);
      q.shieldT = Math.max(q.shieldT, COAL.spitShield);
      this.events.push({ type: 'spatOut', hero: k });
    }
  }

  /** A swallowed hero stays inside the boss: pinned to his middle, doing nothing. */
  private holdSwallowed(): void {
    const b = this.bossIndex >= 0 ? this.enemies[this.bossIndex] : undefined;
    if (!b) return;
    this.player.x = this.player.px = b.x;
    this.player.y = this.player.py = b.y;
  }

  /** ONDRELV2: the stage changes, the slag's burn, and the last heat's bursts. */
  private ondrelStages(dt: number, i: number, e: Enemy): void {
    const f = e.hp / e.maxHp;
    if (this.ondrelStage === 1 && f <= ONDRELV2.stage2) {
      this.ondrelStage = 2;
      this.bossPhase = 2;
      this.events.push({ type: 'phase', phase: 2 });
    }
    if (this.ondrelStage === 2 && f <= ONDRELV2.stage3) {
      // He slams: every patch glows, then bursts and is gone. No more slag after this.
      this.ondrelStage = 3;
      this.bossPhase = 3;
      this.events.push({ type: 'phase', phase: 3 });
      for (const a of this.slagPatches) {
        a.glow = ONDRELV2.glow;
        this.addTelegraph('circle', a.x, a.y, ONDRELV2.burstR, 0, 0, ONDRELV2.glow, ONDRELV2.burst, 'hit', i); // scaled by tier as it lands
      }
    }
    const at = this.acting;
    for (const a of this.slagPatches) {
      if (a.glow === 0) {
        a.tick -= dt;
        if (a.tick <= 0) {
          a.tick += ONDRELV2.tick;
          for (let k = 0; k < this.heroes.length; k++) {
            this.use(k);
            const p = this.player;
            if (p.hp > 0 && dist2(p.x, p.y, a.x, a.y) <= (ONDRELV2.r + PLAYER_RADIUS * 0.5) ** 2) this.hurtPlayer(p.maxHp * ONDRELV2.burn, i, true);
          }
        }
      } else if ((a.glow -= dt) <= 0) a.glow = -1;
    }
    this.use(at);
    if (this.slagPatches.some((a) => a.glow < 0)) {
      for (const a of this.slagPatches) if (a.glow < 0) this.events.push({ type: 'slam', x: a.x, y: a.y, r: ONDRELV2.burstR, source: 'slagBurst' });
      this.slagPatches = this.slagPatches.filter((a) => a.glow >= 0);
    }
  }

  /** ONDRELV2 stage 2: a slag patch at (x, y); past the cap the oldest cools. */
  private leaveSlag(x: number, y: number): void {
    this.slagPatches.push({ x, y, tick: ONDRELV2.tick, glow: 0 });
    while (this.slagPatches.length > ONDRELV2.cap) this.slagPatches.shift();
  }

  /** ONDRELV2: is (x, y) in a burning slag patch, with `pad` to spare? */
  inSlag(x: number, y: number, pad = 0): boolean {
    for (const a of this.slagPatches) if (a.glow === 0 && dist2(x, y, a.x, a.y) <= (ONDRELV2.r + pad) ** 2) return true;
    return false;
  }

  /** Ondrel's clocks run during casts too: Anvilfall, Choir of Iron, Slag Grip ticks, Sundered. */
  private ondrelClock(dt: number): void {
    if (this.bossIndex < 0) return;
    const i = this.bossIndex;
    const e = this.enemies[i];
    if (!e || !e.alive || e.kind !== 'ondrel') return;
    if (this.ondrelStage > 0) this.ondrelStages(dt, i, e);
    const late = this.time - e.spawnedAt > ONDREL.enrageAfter;
    if (late && !this.bossEnraged) {
      this.bossEnraged = true;
      this.events.push({ type: 'bossEnrage' });
    }
    if (this.gripT > 0) this.gripT -= dt;
    this.anvilT -= dt;
    this.choirT -= dt;
    if (!e.castId && e.stunT <= 0) {
      if (this.anvilT <= 0) {
        this.anvilT = late ? ONDREL.anvilEnraged : ONDREL.anvilEvery;
        this.anvilTarget = this.targetOf(i, 0);
        this.startCast(i, 'anvilfall', 'Anvilfall', ONDREL.anvilCast, false);
      } else if (this.choirT <= 0) {
        // ONDRELV2 stage 3: his version's move comes on the enraged timer.
        this.choirT = late ? ONDREL.choirEvery / 2 : this.ondrelStage === 3 ? ONDREL.choirEvery * ONDRELV2.lastChoir : ONDREL.choirEvery;
        // Phase 16 U1: from `GROUP_ECHO.below` health, every other one is his echo's (the first one is).
        let move: string = this.bossVariant;
        if (this.bossEcho && e.hp <= e.maxHp * GROUP_ECHO.below) {
          if (this.echoNext) { move = this.bossEcho; this.events.push({ type: 'echo', id: this.bossEcho }); }
          this.echoNext = !this.echoNext;
        }
        if (move === 'load') this.startCast(i, 'ironload', 'Ironload', ONDREL.choirCast, false);
        else if (move === 'home') { if (this.homeStage === 0) this.startCast(i, 'homeward', 'Homeward Hammer', ONDREL.choirCast, false); }
        else this.startCast(i, 'choir', 'Choir of Iron', ONDREL.choirCast, false);
      }
    }
    // The Homeward Hammer: once it has landed, it flies straight back to his hand.
    if (this.homeStage > 0) {
      this.homeT -= dt;
      if (this.homeT <= 0 && this.homeStage === 1) {
        // It lands ringing: every hero loses a share of health, like a lighter Choir.
        const at = this.acting;
        const ring = HOMEWARD.ring + ONDREL.choirGrow * (this.choirN - 1);
        if (ring > 0) this.eachHero(() => this.hurtPlayer(this.player.maxHp * ring, i, true));
        this.use(at);
        const d = Math.max(1, Math.hypot(e.x - this.homeX, e.y - this.homeY));
        const ang = Math.atan2(e.y - this.homeY, e.x - this.homeX);
        const dmg = HOMEWARD.backDamage * (1 + HOMEWARD.grow * (this.choirN - 1));
        this.addTelegraph('cone', this.homeX, this.homeY, d, ang, 2 * Math.atan(HOMEWARD.width / d), HOMEWARD.back, dmg, 'hit', i); // scaled by tier as it lands
        this.homeStage = 2;
        this.homeT = HOMEWARD.back;
        this.events.push({ type: 'homeward', stage: 'back', x: this.homeX, y: this.homeY });
      } else if (this.homeT <= 0 && this.homeStage === 2) {
        this.homeStage = 0;
        this.homeT = 0;
      }
    }
    // Ironload: when it lands, its weight is shared by every hero standing with the marked one.
    if (this.loadHero >= 0) {
      this.loadT -= dt;
      const m = this.heroPlayer(this.loadHero);
      if (!m || m.hp <= 0) { this.loadHero = -1; this.loadT = 0; }
      else if (this.loadT <= 0) {
        const at = this.acting;
        const near: number[] = [];
        for (let k = 0; k < this.heroes.length; k++) {
          const q = this.heroPlayer(k);
          if (q.hp > 0 && dist2(q.x, q.y, m.x, m.y) <= IRONLOAD.radius ** 2) near.push(k);
        }
        const share = (IRONLOAD.share + IRONLOAD.grow * this.choirN) / Math.max(1, near.length);
        this.choirN++;
        for (const k of near) { this.use(k); this.hurtPlayer(this.player.maxHp * share, i, true); }
        this.use(at);
        this.events.push({ type: 'slam', x: m.x, y: m.y, r: IRONLOAD.radius });
        this.loadHero = -1;
        this.loadT = 0;
      }
    }
    // Slag Grip burns once a second; Sundered fades.
    const at = this.acting;
    this.slagTickT -= dt;
    const tick = this.slagTickT <= 0;
    if (tick) this.slagTickT += 1;
    for (let k = 0; k < this.heroes.length; k++) {
      this.use(k);
      const p = this.player;
      if ((p.sunderT ?? 0) > 0) p.sunderT = (p.sunderT ?? 0) - dt;
      if (tick && (p.slag ?? 0) > 0 && p.hp > 0) this.hurtPlayer(p.maxHp * ONDREL.slagTick * (p.slag ?? 0), -1, true, 'Slag Grip');
    }
    this.use(at);
  }

  // ---------------------------------------------------------------- the Drowned Foundry

  /** Glass Wardens mirror, Ember Twins snap and rekindle, Sluice Crawlers bloom. */
  private runFoundryElite(i: number, dt: number): void {
    const e = this.enemies[i];
    const p = this.player;
    if (e.aux2 > 0) e.aux2 = Math.max(0, e.aux2 - dt);
    if (e.castId) {
      e.castT += dt;
      if (e.castT >= e.castDur) this.finishCast(i);
      return;
    }
    e.abilityT -= dt;
    if (e.abilityT > 0) return;
    if (e.kind === 'glassWarden') {
      e.aux++;
      if (e.aux % 2 === 1 && e.aux2 <= 0 && this.partyStops(e)) {
        e.abilityT = 4.5;
        this.startCast(i, 'mirror', 'Mirror Ward', FOUNDRY.mirrorCast, true);
      } else if (dist2(p.x, p.y, e.x, e.y) < 220 * 220) {
        e.abilityT = 3.5;
        this.startCast(i, 'slam', 'Glass Shatter', 1.1, false);
        this.addTelegraph('circle', e.x, e.y, 105, 0, 0, 1.1, 22, 'hit', i);
      } else e.abilityT = 0.5;
    } else if (e.kind === 'emberTwin') {
      if (dist2(p.x, p.y, e.x, e.y) < 170 * 170) {
        e.abilityT = 3 + this.rng.next();
        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        this.startCast(i, 'flare', 'Twin Flare', 0.7, false);
        this.addTelegraph('cone', e.x, e.y, 110, ang, (70 * Math.PI) / 180, 0.7, 14, 'hit', i);
      } else e.abilityT = 0.5;
    } else if (e.kind === 'sluiceCrawler') {
      e.abilityT = FOUNDRY.bloomEvery;
      this.addTelegraph('circle', p.x, p.y, FOUNDRY.bloomRadius, 0, 0, FOUNDRY.bloomDelay, FOUNDRY.bloomDamage, 'bloom', -1);
    }
  }

  /** A twin fell: a living twin tries to Rekindle it. Quench it or kill the caster. */
  private twinFell(maxHp: number): void {
    for (let j = 0; j < this.enemies.length; j++) {
      const o = this.enemies[j];
      if (o.alive && o.kind === 'emberTwin' && !o.castId) {
        o.rekindleHp = maxHp;
        this.startCast(j, 'rekindle', 'Rekindle', FOUNDRY.rekindleCast, true);
        return;
      }
    }
  }

  private startMaelra(): void {
    this.temper = 0;
    this.temperT = this.temperEvery;
    this.undertowT = 10;
    this.ventT = FOUNDRY.ventEvery;
    this.waterT = 0;
    this.vents = [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6].map((a) => ({
      x: Math.cos(a) * FOUNDRY.ventRing, y: Math.sin(a) * FOUNDRY.ventRing, r: FOUNDRY.ventRadius,
    }));
  }

  /** Maelra, the Drowned Bellows: Temper stacks you boil off at vents, rising water, Undertow. */
  private runMaelra(i: number, dt: number): void {
    const e = this.enemies[i];
    const p = this.player;
    if (!this.bossEnraged && this.time - e.spawnedAt > FOUNDRY.enrageAfter) {
      this.bossEnraged = true;
      this.events.push({ type: 'bossEnrage' });
    }
    const frac = e.hp / e.maxHp;
    const phase = frac > 0.6 ? 1 : frac > 0.25 ? 2 : 3;
    if (phase > this.bossPhase) {
      this.bossPhase = phase;
      this.events.push({ type: 'phase', phase });
    }
    // Phase 16 U1: in her last phase her echo comes and goes, `on` s at a time.
    if (phase >= 3 && this.bossEcho) {
      this.echoT -= dt;
      if (this.echoT <= 0) {
        this.echoLive = !this.echoLive;
        this.echoT = this.echoLive ? MAELRA_ECHO.on : MAELRA_ECHO.off;
        if (this.echoLive) {
          this.events.push({ type: 'echo', id: this.bossEcho });
          if (this.bossEcho === 'tide') this.sluiceT = 0;
        } else if (this.bossEcho === 'seal') {
          // The steam lets go: every vent is open again until the next echo.
          this.openVent = -1; this.nextVent = -1;
        }
      }
    }
    const has = (v: MaelraVariant) => versionLive(this, v);
    // Temper builds over time; dragging her through a vent boils it away.
    // Y3 Sealed Vents: with one vent open, her Temper builds `temperSlow` times slower from phase 2.
    this.temperT -= dt / (phase >= 2 && has('seal') ? MAELRA_SEAL.temperSlow : 1);
    if (this.temperT <= 0) {
      this.temperT = this.temperEvery;
      if (this.temper < FOUNDRY.temperMax) this.temper++;
    }
    // Y3 Sealed Vents: one vent open at a time, the steam moving round.
    const sealed = phase >= 2 && has('seal') && this.vents.length > 1;
    if (sealed) {
      if (this.openVent < 0) {
        this.openVent = this.pickVent(-1, e);
        this.sealT = MAELRA_SEAL.every;
        this.events.push({ type: 'ventShift', stage: 'open', vent: this.openVent });
      }
      this.sealT -= dt;
      if (this.nextVent < 0 && this.sealT <= MAELRA_SEAL.warn) {
        this.nextVent = this.pickVent(this.openVent, e);
        this.events.push({ type: 'ventShift', stage: 'warn', vent: this.nextVent });
      }
      if (this.sealT <= 0) {
        this.openVent = this.nextVent >= 0 ? this.nextVent : this.pickVent(this.openVent, e);
        this.nextVent = -1;
        this.sealT = MAELRA_SEAL.every;
        this.events.push({ type: 'ventShift', stage: 'open', vent: this.openVent });
      }
    }
    if (this.temper > 0) {
      for (let vi = 0; vi < this.vents.length; vi++) {
        const v = this.vents[vi];
        if (sealed && vi !== this.openVent) continue;
        if (dist2(e.x, e.y, v.x, v.y) <= (v.r * (sealed ? MAELRA_SEAL.wide : 1) + e.def.radius * 0.5) ** 2) {
          // Boiling her Temper away vents cool water back at the hero: a heal for playing the verb.
          const heal = this.healPlayer(p.maxHp * FOUNDRY.ventHealPerStack * (this.heat === 'thickSteam' ? HEAT_TUNING.steamHeal : 1) * (sealed ? MAELRA_SEAL.healMult : 1) * this.temper);
          if (heal > 0) {
            this.events.push({ type: 'heal', x: p.x, y: p.y, amount: heal });
          }
          this.temper = 0;
          this.temperT = this.temperEvery;
          this.events.push({ type: 'explode', x: v.x, y: v.y, r: v.r + 20 });
          break;
        }
      }
    }
    // V8 Sluicetide (some runs): instead of rising, the water runs across the room and turns now and then.
    if (phase >= 2 && has('tide')) {
      this.sluiceT -= dt;
      if (this.sluiceT <= 0) {
        this.sluiceT = SLUICETIDE.turnEvery;
        let h = Math.imul(this.seed ^ 0x68e31da4, 0xb5297a4d) + Math.imul(++this.tideTurns, 0x1b56c4e9) >>> 0;
        h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f) >>> 0;
        // Never straight back the way it came: a quarter turn either way, or onward at a slant.
        const turns = [Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4];
        this.tideAngle = this.tideTurns === 1 ? ((h >>> 8) % 360) * (Math.PI / 180) : this.tideAngle + turns[h % turns.length];
        this.events.push({ type: 'tideTurn', angle: this.tideAngle });
      }
      const ux = Math.cos(this.tideAngle), uy = Math.sin(this.tideAngle);
      this.eachHero(() => {
        const q = this.player;
        q.x += ux * SLUICETIDE.drift * dt;
        q.y += uy * SLUICETIDE.drift * dt;
        this.clampArena(q, PLAYER_RADIUS);
      });
    }
    // Phase 2: the water rises and the arena shrinks.
    if (phase >= 2 && this.bossVariant !== 'tide' && this.arenaR > FOUNDRY.waterMin) {
      this.waterT += dt;
      this.arenaR = Math.max(FOUNDRY.waterMin, ARENA - (ARENA - FOUNDRY.waterMin) * Math.min(1, this.waterT / FOUNDRY.waterTime));
      this.clampArena(p, PLAYER_RADIUS);
    }
    // Phase 3: vents erupt on their own.
    if (phase >= 3) {
      this.ventT -= dt;
      if (this.ventT <= 0) {
        this.ventT = FOUNDRY.ventEvery;
        for (const v of this.vents) this.addTelegraph('circle', v.x, v.y, v.r + 10, 0, 0, FOUNDRY.ventDelay, FOUNDRY.ventDamage);
      }
    }
    if (e.castId) {
      e.castT += dt;
      if (e.castT >= e.castDur) this.finishCast(i);
      return;
    }
    if (phase >= 2) {
      this.undertowT -= dt;
      if (this.undertowT <= 0) {
        this.undertowT = FOUNDRY.undertowEvery;
        this.startCast(i, 'undertow', 'Undertow', FOUNDRY.undertowCast, true);
        return;
      }
    }
    e.abilityT -= dt;
    if (e.abilityT > 0) return;
    const mult = this.bossEnraged ? 2 : 1;
    e.abilityT = this.bossEnraged ? 1.6 : phase === 3 ? 2.6 : 3.2;
    if (this.rng.int(2) === 0) {
      this.addTelegraph('circle', p.x, p.y, 110, 0, 0, 1.3, MAELRA_HITS.circle * mult);
    } else {
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      this.addTelegraph('cone', e.x, e.y, 300, ang, (65 * Math.PI) / 180, 1.1, MAELRA_HITS.cone * mult);
    }
  }

  // ---------------------------------------------------------------- omens

  hasOmen(id: OmenId): boolean {
    return this.omens.includes(id);
  }

  /** Per-tick Omens during a fight. */
  private runOmens(dt: number): void {
    if (!this.hasOmen('volatileGround') || this.victory) return;
    this.volatileT += dt;
    // Never erupt while a soak circle is up: standing still in gold must stay safe.
    if (this.volatileT >= OMEN_TUNING.volatileEvery && !this.telegraphs.some((t) => t.alive && t.kind === 'soak')) {
      this.volatileT = 0;
      const p = this.player;
      this.addTelegraph('circle', p.x, p.y, OMEN_TUNING.volatileRadius, 0, 0, OMEN_TUNING.volatileDelay, OMEN_TUNING.volatileDamage);
    }
  }

  private omensOnKill(e: Enemy): void {
    if (e.def.rank === 'boss' || this.stress) return;
    if (this.hasOmen('kindledDead') && e.def.rank !== 'normal') {
      this.addTelegraph('circle', e.x, e.y, OMEN_TUNING.kindledRadius, 0, 0, OMEN_TUNING.kindledDelay, OMEN_TUNING.kindledDamage);
    }
    if (this.hasOmen('sharedPain') && e.def.rank !== 'normal') {
      for (const o of this.enemies) {
        // Bosses are exempt: a boss's own adds would otherwise refill her (Hessa's Shoal Lurkers are elites).
        if (!o.alive || o === e || o.def.rank === 'normal' || o.def.rank === 'boss') continue;
        const amount = Math.min(o.maxHp - o.hp, o.maxHp * OMEN_TUNING.sharedPainHeal * this.healTakenMult(o));
        if (amount <= 0) continue;
        o.hp += amount;
        this.events.push({ type: 'heal', x: o.x, y: o.y, amount });
      }
    }
  }

  private updateTelegraphs(dt: number): void {
    const p = this.player;
    for (const t of this.telegraphs) {
      if (!t.alive) continue;
      t.t += dt;
      if (t.t < t.dur) continue;
      t.alive = false;
      if (t.kind === 'soak') {
        const took = this.soakers(t);
        const ok = took.length > 0;
        this.soaks++;
        if (ok) this.soaksMade++;
        this.relaySoak(took);
        this.events.push({ type: 'soak', ok, x: t.x, y: t.y, owner: t.owner });
        // Ventwalker (3): standing in the gold circle heals.
        if (ok && this.setCount('ventwalker') >= 3) this.healPlayer(p.maxHp * SET_TUNING.vwHeal);
        if (!ok) {
          this.hurtPlayer(t.dmg * this.tierDamage, -1, false, this.telegraphCause(t));
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            this.spawn('ashling', t.x + Math.cos(a) * 60, t.y + Math.sin(a) * 60);
          }
        }
        continue;
      }
      this.events.push({ type: 'slam', x: t.x, y: t.y, r: t.r });
      // Smother: a Bulwark standing in a bloom catches the burst on its shield for 25 Resolve, so it feeds no one.
      const smother = t.kind === 'bloom' && this.cls === 'bulwark' && p.heat >= this.smotherCost(this.acting)
        && dist2(p.x, p.y, t.x, t.y) <= (t.r + PLAYER_RADIUS) ** 2;
      if (smother) {
        p.heat -= this.smotherCost(this.acting);
        this.events.push({ type: 'parry', x: p.x, y: p.y });
      }
      if (t.kind === 'bloom' && !smother) {
        // The burst feeds any enemy caught in it.
        this.forEachNear(t.x, t.y, t.r + 40, (j) => {
          const o = this.enemies[j];
          // Phase 14 X5: never a named foe (a Swift Sluice Crawler stood in its own Blooms and healed back to full).
          if (!o.alive || o.def.rank === 'normal' || o.named >= 0 || dist2(o.x, o.y, t.x, t.y) > (t.r + o.def.radius) ** 2) return;
          const amount = Math.min(o.maxHp - o.hp, o.maxHp * this.bloomHeal * this.healTakenMult(o));
          if (amount <= 0) return;
          o.hp += amount;
          this.events.push({ type: 'heal', x: o.x, y: o.y, amount });
        });
      }
      const inside = this.insideTelegraph(t);
      if (!inside && t.wasIn && t.kind === 'hit') this.dodged();
      if (inside && (p.rollT ?? 0) > 0 && p.shieldT > 0) p.rolled = (p.rolled ?? 0) + 1;
      if (t.kind === 'hit' && p.hp > 0) this.countTell(p, !!t.wasIn, inside);
      // A smothered bloom lands on the shield: the Bulwark takes half.
      this.tellFrom = t.owner;
      if (inside) this.hurtPlayer(t.dmg * this.tierDamage * (smother ? 0.5 : 1), -1, false, this.telegraphCause(t));
      this.tellFrom = -1;
    }
  }

  /**
   * Co-op telegraphs: each one advances once per tick and, when it lands, hits
   * every living hero inside it. A soak is made if any hero stands in it; a
   * missed soak hurts everyone. A Bulwark inside with the Resolve smothers a bloom.
   */
  private updatePartyTelegraphs(dt: number): void {
    const n = this.heroes.length;
    for (const t of this.telegraphs) {
      if (!t.alive) continue;
      t.t += dt;
      if (t.t < t.dur) continue;
      t.alive = false;
      if (t.kind === 'soak') {
        const took = this.soakers(t);
        // The Regent's Tithe (owner -5) is only made with TITHE.need heroes in it: one alone gets no Relayer, no Ventwalker heal.
        const ok = took.length >= (t.owner === -5 ? TITHE.need : 1);
        this.soaks++;
        if (ok) this.soaksMade++;
        if (ok) this.relaySoak(took);
        this.events.push({ type: 'soak', ok, x: t.x, y: t.y, owner: t.owner });
        // Ventwalker (3): every wearer standing in the gold circle heals.
        if (ok) {
          this.eachHero(() => {
            const q = this.player;
            if (this.setCount('ventwalker') >= 3 && dist2(q.x, q.y, t.x, t.y) <= (t.r + PLAYER_RADIUS) ** 2) this.healPlayer(q.maxHp * SET_TUNING.vwHeal);
          });
        }
        if (t.owner === -5) {
          // Y3 the Regent's Tithe: enough heroes share it, or everyone pays.
          const boss = this.bossIndex;
          if (took.length >= TITHE.need) {
            const share = TITHE.cost / took.length;
            for (const k of took) { this.use(k); this.hurtPlayer(this.player.maxHp * share, boss, true); }
          } else this.eachHero(() => this.hurtPlayer(this.player.maxHp * TITHE.miss, boss, true));
          this.use(0);
          this.events.push({ type: 'tithe', ok: took.length >= TITHE.need, n: took.length });
          continue;
        }
        if (t.owner === -4) {
          // A Banked Coal: smothered, or he eats it (the same as an ember he inhales).
          if (ok) this.events.push({ type: 'emberTaken', x: t.x, y: t.y });
          else this.feedVorhulm(t.x, t.y);
          continue;
        }
        if (!ok) {
          this.eachHero(() => this.hurtPlayer(t.dmg * this.tierDamage, -1, false, this.telegraphCause(t)));
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            this.spawn('ashling', t.x + Math.cos(a) * 60, t.y + Math.sin(a) * 60);
          }
        }
        continue;
      }
      this.events.push({ type: 'slam', x: t.x, y: t.y, r: t.r });
      let smother = -1;
      if (t.kind === 'bloom') {
        for (let i = 0; i < n && smother < 0; i++) {
          const q = this.heroPlayer(i);
          if (q.hp > 0 && this.heroes[i].cls === 'bulwark' && q.heat >= this.smotherCost(i) && dist2(q.x, q.y, t.x, t.y) <= (t.r + PLAYER_RADIUS) ** 2) smother = i;
        }
        if (smother >= 0) {
          const q = this.heroPlayer(smother);
          q.heat -= this.smotherCost(smother);
          this.events.push({ type: 'parry', x: q.x, y: q.y });
        } else {
          this.forEachNear(t.x, t.y, t.r + 40, (j) => {
            const o = this.enemies[j];
            if (!o.alive || o.def.rank === 'normal' || o.named >= 0 || dist2(o.x, o.y, t.x, t.y) > (t.r + o.def.radius) ** 2) return;
            const amount = Math.min(o.maxHp - o.hp, o.maxHp * this.bloomHeal * this.healTakenMult(o));
            if (amount <= 0) return;
            o.hp += amount;
            this.events.push({ type: 'heal', x: o.x, y: o.y, amount });
          });
        }
      }
      const mask = t.inMask ?? 0;
      this.eachHero((h) => {
        const inside = this.insideTelegraph(t);
        if (!inside && t.kind === 'hit' && (mask >> h) & 1) this.dodged();
        if (inside && (this.player.rollT ?? 0) > 0 && this.player.shieldT > 0) this.player.rolled = (this.player.rolled ?? 0) + 1;
        if (t.kind === 'hit' && this.player.hp > 0) this.countTell(this.player, ((mask >> h) & 1) === 1, inside);
        // A smothered bloom lands on the shield: that Bulwark takes half.
        this.tellFrom = t.owner;
        if (inside) this.hurtPlayer(t.dmg * this.tierDamage * (h === smother ? 0.5 : 1), -1, false, this.telegraphCause(t));
        this.tellFrom = -1;
      });
    }
  }

  // ---------------------------------------------------------------- loot

  /** One item from `source`'s loot table (LOOT), at least `min`. */
  private makeItem(source: LootSource, min: Rarity = 'common'): Item {
    return rollDrop(this.rng, `i${this.nextItemId++}`, this.itemLevel, this.luck, min, this.cls, this.tier, source, this.dungeonId);
  }

  /**
   * Verb sets (R4): a boss's item that lands in a set slot is often a piece of
   * this dungeon's set. It rolls on its own stream so the run's main rolls are
   * the same with or without sets. Bounties and world boss shadows never drop sets.
   */
  private withSet(item: Item): Item {
    const set = setForDungeon(this.dungeonId);
    if (!set || this.bounty !== undefined || this.stress || !SET_SLOTS.includes(item.slot) || item.rarity === 'mythic') return item;
    const r = new Rng((this.seed ^ 0x5e75) + this.nextItemId);
    if (!r.chance(SET_TUNING.dropChance)) return item;
    // The last word is the thing itself ("Pot Helm" -> "Kilnbreaker Helm"), for prefix names and written ones.
    const noun = item.name.split(' ').pop();
    return { ...item, set, name: `${SETS[set].name} ${noun}` };
  }

  /**
   * Fill with bots: bot fills clear faster than solo runs, so only fillLootShare(bots) of the
   * in-run drops (clear bags, elite and named drops, in-run drops) survive. Boss items don't thin.
   */
  private fillKeeps(): boolean {
    if (!this.fillBots) return true;
    this.fillRng ??= new Rng((this.seed ^ 0x66696c6c) >>> 0);
    return this.fillRng.chance(fillLootShare(this.fillBots));
  }

  private dropLoot(x: number, y: number, source: LootSource): void {
    if (!this.fillKeeps()) return;
    // The opening (opening.md rule 4): no bags from foes; the Kiln Mother's item is picked up straight away.
    if (this.firstDelve) return;
    const item = this.makeItem(source);
    const d = this.drops.find((q) => !q.alive);
    if (!d) {
      this.pickUp(item);
      return;
    }
    // M5 QA, 27 Nov: a foe that dies pressed against a Halls wall can leave its bag just past it, where a bot never
    // reaches it (Hoard t4 seed 2 stood there forever). Bags land inside the map, a hero's width from the wall.
    if (this.hallsOn) { const q = { x, y }; clampHalls(this.halls!, q, PLAYER_RADIUS); x = q.x; y = q.y; }
    Object.assign(d, { alive: true, x, y, item });
    this.events.push({ type: 'drop', x, y, rarity: item.rarity });
  }

  /**
   * Adds an item to this run's haul and wears it right away if it is an upgrade,
   * unless that would take off a piece of a set whose 2- or 3-piece bonus is active.
   */
  private pickUp(item: Item): void {
    this.runDrops.push(item);
    const cur = this.gear.find((g) => g.slot === item.slot);
    const delta = Math.round(itemScore(item) - (cur ? itemScore(cur) : 0));
    const breaksSet = !!cur?.set && cur.set !== item.set && (this.loadout.sets[cur.set] ?? 0) >= 2;
    const equipped = delta > 0 && !breaksSet;
    if (equipped) {
      this.gear = this.gear.filter((g) => g.slot !== item.slot);
      this.gear.push(item);
      this.runEquipped.push(item.id);
      const before = this.loadout.maxHpBonus;
      this.loadout = loadoutFrom(this.passives, this.gear);
      const gain = this.loadout.maxHpBonus - before;
      this.player.maxHp += gain;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + Math.max(0, gain));
    }
    this.events.push({ type: 'loot', item, equipped, delta, hero: this.acting });
  }

  private updateDrops(): void {
    const p = this.player;
    for (const d of this.drops) {
      if (!d.alive || !d.item) continue;
      if (dist2(p.x, p.y, d.x, d.y) <= 46 * 46) {
        d.alive = false;
        this.pickUp(d.item);
        d.item = null;
      }
    }
  }

  private spawnVein(): void {
    if (this.veins.filter((v) => v.alive).length >= 3) return;
    const v = this.veins.find((q) => !q.alive);
    if (!v) return;
    const a = this.rng.next() * Math.PI * 2;
    Object.assign(v, { alive: true, x: this.player.x + Math.cos(a) * 260, y: this.player.y + Math.sin(a) * 260, progress: 0 });
  }

  /** Gathering: stand on an Ember Vein for a moment. */
  private updateVeins(dt: number): void {
    const p = this.player;
    for (const v of this.veins) {
      if (!v.alive) continue;
      if (dist2(p.x, p.y, v.x, v.y) <= 40 * 40) v.progress += dt;
      else v.progress = Math.max(0, v.progress - dt);
      if (v.progress < VEIN_TIME) continue;
      v.alive = false;
      this.addHeat(30);
      p.hp = Math.min(p.maxHp, p.hp + 10);
      this.gainXp(3);
      this.events.push({ type: 'gather', x: v.x, y: v.y });
    }
  }

  /** Co-op veins: one living hero on a vein fills it (it only drains when nobody is on it); that hero gets the reward. */
  private updatePartyVeins(dt: number): void {
    for (const v of this.veins) {
      if (!v.alive) continue;
      let on = -1;
      for (let i = 0; i < this.heroes.length && on < 0; i++) { const q = this.heroPlayer(i); if (q.hp > 0 && dist2(q.x, q.y, v.x, v.y) <= 40 * 40) on = i; }
      if (on >= 0) v.progress += dt;
      else v.progress = Math.max(0, v.progress - dt);
      if (v.progress < VEIN_TIME) continue;
      v.alive = false;
      this.use(on);
      const p = this.player;
      this.addHeat(30);
      p.hp = Math.min(p.maxHp, p.hp + 10);
      this.gainXp(3);
      this.events.push({ type: 'gather', x: v.x, y: v.y });
      this.use(0);
    }
  }

  // ---------------------------------------------------------------- xp

  private dropGem(x: number, y: number, value: number): void {
    const g = this.gems.find((q) => !q.alive);
    if (g) {
      Object.assign(g, { alive: true, x, y, px: x, py: y, value, pulled: false });
      return;
    }
    // Pool full: fold the value into an existing gem so no XP is lost.
    this.gems[this.rng.int(this.gems.length)].value += value;
  }

  private updateGems(dt: number): void {
    const p = this.player;
    const pr2 = this.pickupRadius ** 2;
    for (const g of this.gems) {
      if (!g.alive) continue;
      g.px = g.x;
      g.py = g.y;
      const dd = dist2(g.x, g.y, p.x, p.y);
      if (!g.pulled && dd <= pr2) g.pulled = true;
      if (g.pulled) {
        const d = Math.sqrt(dd) || 1;
        const sp = Math.max(260, this.moveSpeed * 2.2);
        g.x += ((p.x - g.x) / d) * sp * dt;
        g.y += ((p.y - g.y) / d) * sp * dt;
        if (d < 14) {
          g.alive = false;
          this.gainXp(g.value);
        }
      }
    }
    if (this.picksWaiting() && this.state === 'running' && this.phase !== 'fight') { if (this.heroes.length === 1) this.openDraft(); else this.openDraftAll(); }
  }

  /** Co-op gems: a gem flies to the first hero who pulls it, moving once per tick. */
  private updatePartyGems(dt: number): void {
    for (const g of this.gems) {
      if (!g.alive) continue;
      g.px = g.x;
      g.py = g.y;
      if (g.pulled && (g.to === undefined || this.heroPlayer(g.to).hp <= 0)) g.pulled = false;
    }
    this.eachHero((h) => {
      const p = this.player;
      const pr2 = this.pickupRadius ** 2;
      const sp = Math.max(260, this.moveSpeed * 2.2);
      for (const g of this.gems) {
        if (!g.alive) continue;
        const dd = dist2(g.x, g.y, p.x, p.y);
        if (!g.pulled && dd <= pr2) { g.pulled = true; g.to = h; }
        if (!g.pulled || g.to !== h) continue;
        const d = Math.sqrt(dd) || 1;
        g.x += ((p.x - g.x) / d) * sp * dt;
        g.y += ((p.y - g.y) / d) * sp * dt;
        if (d < 14) {
          g.alive = false;
          this.gainXp(g.value);
        }
      }
    });
    if (this.state === 'running' && this.phase !== 'fight' && this.heroes.some((_, i) => this.heroPlayer(i).pendingLevels > 0 || !!this.heroPlayer(i).relicPick)) this.openDraftAll();
  }

  private gainXp(v: number): void {
    const p = this.player;
    p.xp += v * this.loadout.xpMult * (this.heat === 'quickStudy' ? HEAT_TUNING.quickStudyXp : 1);
    while (p.xp >= p.xpToNext) {
      p.xp -= p.xpToNext;
      p.level++;
      p.xpToNext = xpFor(p.level);
      p.pendingLevels++;
      this.events.push({ type: 'levelUp', level: p.level, hero: this.acting });
    }
  }

  /** Opens a draft for every hero with picks waiting (solo: just the one). */
  private openDraftAll(): void {
    const at = this.acting;
    for (let i = 0; i < this.heroes.length; i++) {
      this.use(i);
      if (this.picksWaiting() && this.choices.length === 0) this.choices = this.nextCards();
    }
    this.use(at);
    this.state = 'draft';
  }

  private openDraft(): void {
    this.choices = this.nextCards();
    this.state = 'draft';
  }

  /** This class's three branches, in tree order. */
  get branches(): Branch[] {
    const out: Branch[] = [];
    for (const d of Object.values(TALENTS) as TalentDef[]) {
      if (d.cls === this.cls && !out.includes(d.branch)) out.push(d.branch);
    }
    return out;
  }

  /**
   * 1.0 CP2 Sparks (SPARKS in sim/content/emberwright.ts): offer 3 of the class's 8 Sparks, one from each branch where it
   * can. Until the hero catches a play-changing Spark, one card is always one of the three, taking turns draft by draft
   * (from a start set by the seed), so passing on one shows you the next; catching one closes the other two. A branch with nothing left gives its card to another branch, then to the
   * general fallbacks. Sparks for a slot that is locked or swapped for an ability option are never offered.
   */
  /** Whether the acting hero can be offered this card: its slot (if any) is unlocked and not swapped for an option. */
  canDraft(id: TalentId): boolean {
    const d = TALENTS[id];
    return d.ability === undefined || (!this.isAlt(d.ability) && this.unlocked(d.ability));
  }

  rollDraft(): DraftOption[] {
    const out: DraftOption[] = [];
    const sp = SPARKS[this.cls];
    const ok = (id: TalentId) => this.canDraft(id);
    const changed = sp.change.some((id) => this.rank(id) > 0);
    const change = changed ? [] : sp.change.filter(ok);
    const plain = sp.plain.filter((id) => ok(id) && this.rank(id) < TALENTS[id].maxRank);
    let used: Branch | null = null;
    if (change.length) {
      // Picks made so far (ranks held) turn the wheel; the seed and hero pick where it starts.
      const picks = Object.values(this.talents).reduce((a, r) => a + (r ?? 0), 0);
      const n = change.length, id = change[((((this.seed | 0) + this.acting + picks) % n) + n) % n];
      out.push({ id, nextRank: 1 });
      used = TALENTS[id].branch;
    }
    const spare: TalentId[] = [];
    for (const b of this.branches) {
      const ids = plain.filter((id) => TALENTS[id].branch === b);
      if (b !== used && ids.length && out.length < 3) {
        const id = ids.splice(this.rng.int(ids.length), 1)[0];
        out.push({ id, nextRank: this.rank(id) + 1 });
      }
      spare.push(...ids);
    }
    while (out.length < 3 && spare.length) {
      const id = spare.splice(this.rng.int(spare.length), 1)[0];
      out.push({ id, nextRank: this.rank(id) + 1 });
    }
    const fallbacks: TalentId[] = ['stoke', 'smallHeal'];
    for (const id of fallbacks) if (out.length < 3) out.push({ id, nextRank: this.rank(id) + 1 });
    return out.slice(0, 3);
  }

  private applyTalent(id: TalentId): void {
    const p = this.player;
    if (id === 'smallHeal') {
      p.hp = Math.min(p.maxHp, p.hp + 40);
      return;
    }
    this.talents[id] = this.rank(id) + 1;
    if ((id === 'blazingSpeed' && this.rank(id) === 2) || id === 'shadowSlip') {
      p.blinkCharges = 1;
      p.blinkChargeT = this.abilityCooldown(1);
    }
    if (id === 'crustedHide') {
      p.maxHp += 15;
      p.hp = Math.min(p.maxHp, p.hp + 15);
    }
    if (id === 'renewal') {
      p.maxHp += 20;
      p.hp = Math.min(p.maxHp, p.hp + 20);
    }
    if (id === 'holdTheLine') {
      p.maxHp += 30;
      p.hp = Math.min(p.maxHp, p.hp + 30);
    }
    if (id === 'cinderSkin') {
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 25);
    }
    if (id === 'thickHide') {
      p.maxHp += 30;
      p.hp = Math.min(p.maxHp, p.hp + 30);
    }
  }

  // ---------------------------------------------------------------- end

  private checkEnd(): void {
    if (this.state === 'ended') return;
    if (this.heroes.length === 1) {
      if (this.player.hp <= 0 && !this.revived && this.hasMythic('phoenixFeather')) {
        this.revived = true;
        this.player.hp = this.player.maxHp / 2;
        this.events.push({ type: 'revive', hero: this.acting });
        return;
      }
      if ((this.victory && !this.shadowPending) || this.player.hp <= 0) {
        if (this.player.hp <= 0) this.player.hp = 0;
        this.state = 'ended';
        this.events.push({ type: 'end', victory: this.victory });
      }
      return;
    }
    this.eachHero(() => {
      if (this.player.hp <= 0 && !this.revived && this.hasMythic('phoenixFeather')) {
        this.revived = true;
        this.player.hp = this.player.maxHp / 2;
        this.events.push({ type: 'revive', hero: this.acting });
      }
    }, true);
    let down = 0;
    for (let i = 0; i < this.heroes.length; i++) {
      const hp = this.heroPlayer(i);
      if (hp.hp <= 0) {
        hp.hp = 0;
        down++;
        if (this.heroes.length > 1) for (const t of this.threat) dropHero(t, this.heroes[i].id);
      }
    }
    // The run ends on a win, or when the whole party is down.
    if ((this.victory && !this.shadowPending) || down === this.heroes.length) {
      // The Hoard: a hero still inside when Old Vorhulm falls comes out with the win (coalClock never runs again).
      if (this.victory) this.releaseSwallowed(false);
      this.state = 'ended';
      this.events.push({ type: 'end', victory: this.victory });
    }
  }

  // ---------------------------------------------------------------- spatial hash

  private rebuildHash(): void {
    this.head.fill(-1);
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive) continue;
      const k = cellKey(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      this.next[i] = this.head[k];
      this.head[k] = i;
    }
  }

  /** Calls fn for enemies in cells overlapping the square around (x, y). */
  forEachNear(x: number, y: number, r: number, fn: (i: number) => void): void {
    const x0 = Math.floor((x - r) / CELL);
    const x1 = Math.floor((x + r) / CELL);
    const y0 = Math.floor((y - r) / CELL);
    const y1 = Math.floor((y + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        for (let i = this.head[cellKey(cx, cy)]; i !== -1; i = this.next[i]) {
          if (this.enemies[i].alive) fn(i);
        }
      }
    }
  }

  private nearestEnemies(x: number, y: number, n: number, maxDist: number): number[] {
    const best: { i: number; d: number }[] = [];
    const m2 = maxDist * maxDist;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive || (this.kmStage === 2 && e.kind === 'kilnMother')) continue;
      const d0 = dist2(x, y, e.x, e.y);
      if (d0 > m2) continue;
      // The Craw counts as much nearer, so auto-attacks break it and free the hero inside.
      const d = e.kind === 'craw' ? d0 * 0.05 : d0;
      if (best.length < n) best.push({ i, d });
      else {
        let worst = 0;
        for (let k = 1; k < best.length; k++) if (best[k].d > best[worst].d) worst = k;
        if (d < best[worst].d) best[worst] = { i, d };
      }
    }
    return best.sort((a, b) => a.d - b.d).map((b) => b.i);
  }

  private randomEnemyNear(x: number, y: number, maxDist: number): number {
    const cands: number[] = [];
    const m2 = maxDist * maxDist;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.alive && !(this.kmStage === 2 && e.kind === 'kilnMother') && dist2(x, y, e.x, e.y) <= m2) cands.push(i);
    }
    return cands.length ? cands[this.rng.int(cands.length)] : -1;
  }
}

export function xpFor(level: number): number {
  return Math.round(4 + level * 2 + Math.pow(level, 1.35));
}

export const VEIN_TIME = 1.2;
export const QUENCH_RANGE = 520;
/**
 * First clear of a tier (the hero's highest unlocked tier): the boss's item is at least this rarity, by tier
 * (Steve, 26 Nov: "depending on the tier it should give a guaranteed, so for tier one maybe a rare").
 * Each row is [from tier, rarity]; the steps line up with the Foundry (4), the Coldmarrow (10) and past the Wrackline (15).
 */
export const FIRST_CLEAR_LADDER: [number, Rarity][] = [[1, 'rare'], [4, 'epic'], [10, 'legendary'], [15, 'mythic']];

/** The rarity a first clear of `tier` guarantees from the boss. */
export function firstClearRarity(tier: number): Rarity {
  let r: Rarity = FIRST_CLEAR_LADDER[0][1];
  for (const [from, rarity] of FIRST_CLEAR_LADDER) if (tier >= from) r = rarity;
  return r;
}
/**
 * Raid boss loot (design, 24 Nov): a raid boss fight runs 140-340 s against 40-90 s in a group dungeon, so with the
 * same two boss items a raid paid about half the Rare-or-better items a minute. `epic` makes every hero's boss item
 * an Epic; `extra` adds that many more Rare-or-better items each.
 */
export const RAID_LOOT = { epic: 1, extra: 1 };

/** The Glarewell's tuning, kept together so balance changes are data changes. */
export const GLARE = {
  pillarRing: 200,
  pillarRadius: 26,
  /** How far a pillar's shadow reaches past the stone, and how much it widens per unit. */
  shadowLength: 300,
  shadowWiden: 0.12,
  /** Warning before a Glare goes off: every class reaches shade on foot in this time. */
  glareWarn: 2.6,
  glareDamage: 34,
  glareEvery: 9,
  brandCast: 0.8,
  brandTime: 4,
  brandRadius: 110,
  brandDamage: 16,
  brandHeal: 0.1,
  brandEvery: 11,
  /** Seconds after a Brand bursts before a Brandkeeper can Brand again. */
  brandGap: 6,
  /** Share of damage a Shade takes while standing in shadow. */
  shadeShadowTaken: 0.3,
  lampWidth: 18,
  lampDps: 30,
  lampMaxDist: 460,
  bossGlareEvery: 12,
  bossBrandEvery: 15,
  crackEvery: 14,
  /** Seconds into phase 3 before the first pillar cracks. */
  firstCrack: 3,
  crackDelay: 2.5,
  enrageAfter: 180,
  /**
   * The Lens Sweep cone between Glares: every so many seconds, and its damage. It reaches 300 px, so it only ever
   * lands on melee: 1.0 M3 (25 Nov) cut it from every 1.7 s at 26 to every 2.4 s at 10, as at average skill it walled
   * the Bulwark and Duskblade (1-2 of 20 at t7/t8) while ranged classes won 20 of 20.
   */
  sweepEvery: 2.4,
  sweepEveryEnraged: 1,
  sweepDamage: 10,
  /** The cone: its warning (s), reach (px) and full width (degrees). */
  sweepCast: 1.1, sweepRange: 300, sweepArc: 60,
};

/** Drowned Foundry tuning. */
/** V2 (variety): arena layouts. */
export type LayoutId = 'open' | 'pillars' | 'channel' | 'vents';
/** The layouts each dungeon's fights roll from (open is listed twice in the Kiln, so it stays the most common). */
export const LAYOUTS: Partial<Record<DungeonId, LayoutId[]>> = {
  kiln: ['open', 'open', 'pillars', 'channel', 'vents'],
  // Phase 12 W2: group dungeons get stones and vents, never lava (a party can't all cross it at once).
  hammerdeep: ['open', 'open', 'pillars', 'vents'],
  pressworks: ['open', 'open', 'pillars', 'vents'],
  // Phase 13 E2: the Ashvents' layouts, held back in W2.
  ashvents: ['open', 'open', 'pillars', 'vents'],
  // V8: the Foundry is drowned, so no lava channel: stones and steam vents.
  foundry: ['open', 'open', 'pillars', 'vents'],
  // V8: the Glarewell already has its own pillars, so only vents.
  glarewell: ['open', 'open', 'vents'],
  // V8: the Coldmarrow's fires are out, so no vents or lava: ice pillars only.
  coldmarrow: ['open', 'open', 'pillars'],
  // Phase 13 E1: raid trash gets stones and vents too (never the boss fight, see layoutRolls).
  crucible: ['open', 'open', 'pillars', 'vents'],
  hoard: ['open', 'open', 'pillars', 'vents'],
  smeltery: ['open', 'open', 'pillars', 'vents'],
  flue: ['open', 'open', 'pillars', 'vents'],
};
/** V2 tuning. Stones block movement; a lava channel burns `lavaBurn` of max health a second; vents flare every `ventEvery` s in turn. */
/**
 * Phase 15 Y1: wave shapes. A solo or group trash fight's foes come in as one arc from the far side (as before),
 * or a pincer (alternate foes from opposite sides), or a ring round the arena. `pincer` and `ring` are each fight's
 * chance of that shape. `force` (tools) forces one; `off` keeps every wave an arc. Never boss fights or raids.
 */
export type WaveShape = 'arc' | 'pincer' | 'ring' | 'reinforce';
export const WAVES = {
  pincer: 0.2,
  ring: 0.15,
  /** `reinforce`: up to half the pack (the kinds in REINFORCE_KINDS) is held back and comes in from the other side. */
  reinforce: 0.2,
  /** `ring`: how far from the hero the ring forms. */
  ringR: 460,
  /** Seconds into the fight the held pack arrives (sooner if the first half is already dead). */
  reinforceAt: 7,
  /** Seconds of warning before it arrives. */
  reinforceWarn: 2,
  force: '' as string,
  off: false,
};
/** Phase 15 Y1: the pack foes a `reinforce` wave can hold back. */
export const REINFORCE_KINDS: readonly EnemyKind[] = ['cinderhound', 'shade', 'rimehound', 'shoalLurker'];
/** Phase 15 Y1: how many of a fight's foes a `reinforce` wave holds back: the pack foes, at most half the fight, at least one left in. */
export function reinforceCount(spawns: readonly { kind: EnemyKind; n: number }[]): number {
  const all = spawns.reduce((a, s) => a + s.n, 0);
  const pack = spawns.reduce((a, s) => a + (REINFORCE_KINDS.includes(s.kind) ? s.n : 0), 0);
  return all < 3 ? 0 : Math.min(pack, Math.floor(all / 2));
}
/** Phase 15 Y5 fix: a Rimehound pack that is 3 or more with its Hoarfrost Weavers never forms a ring (it stays an arc). */
export function ringless(spawns: readonly { kind: EnemyKind; n: number }[]): boolean {
  // Hoarfrost Weavers count too: their Frost Lace pins a hero while the hounds close (skills' Y5, the Two Weavers).
  const n = (k: EnemyKind) => spawns.filter((s) => s.kind === k).reduce((a, s) => a + s.n, 0);
  const hounds = n('rimehound');
  return hounds >= 1 && hounds + n('hoarfrostWeaver') >= 3;
}
/** Which flat spawn slots are held back: the last `m` pack foes. */
function heldMask(spawns: readonly { kind: EnemyKind; n: number }[], m: number): boolean[] {
  const flat: EnemyKind[] = [];
  for (const sp of spawns) for (let j = 0; j < sp.n; j++) flat.push(sp.kind);
  const out = flat.map(() => false);
  for (let k = flat.length - 1; k >= 0 && m > 0; k--) if (REINFORCE_KINDS.includes(flat[k])) { out[k] = true; m--; }
  return out;
}
/** Phase 15 Y4: each shape's bit in World.wavesMet. */
export const WAVE_BIT: Record<Exclude<WaveShape, 'arc'>, number> = { pincer: 1, ring: 2, reinforce: 4 };
/** The shapes a `wavesMet` mask holds. */
export function wavesIn(mask: number): Exclude<WaveShape, 'arc'>[] {
  return (Object.keys(WAVE_BIT) as Exclude<WaveShape, 'arc'>[]).filter((s) => mask & WAVE_BIT[s]);
}
export const WAVE_SHAPE_INFO: Record<Exclude<WaveShape, 'arc'>, { name: string; tip: string }> = {
  pincer: { name: 'Pincer', tip: 'They come from both sides. Pick one side and break it.' },
  ring: { name: 'Surrounded', tip: 'They come from every side. Cut a way out.' },
  reinforce: { name: 'More Coming', tip: 'The rest of the pack is on its way from another side.' },
};

/**
 * Phase 15 Y10, the dungeon stirs (Steve, 23 Nov: "if you were doing really well they like added an extra monster").
 * A trash fight cleared taking at most `clean` of the party's health in damage, with nobody down, adds one to a hidden
 * count; one that took `rough` or more, or put a hero down, sets it back to 0. When it reaches `need`, the next trash fight
 * (never the boss) stirs: it gets one reaction and an extra loot bag. At most `max` a run. Off on the first delve, below
 * `minTier`, in raids, and in a party with fill bots. `force` (tools) stirs every trash fight after the opener with that
 * reaction (or 'any'); `off` turns it off.
 */
export type StirId = 'elite' | 'named' | 'event' | 'wave';
/**
 * Phase 15 Y10 follow-up: how much of a fight's usual cost each class takes, as a multiple of the clean and rough bars.
 * A Bulwark's kit trades hits in melee, so its bar is looser; the party's worst hero, so judged, decides.
 */
export const STIR_CLASS: Record<ClassId, number> = { emberwright: 1, duskblade: 2, bulwark: 2, lumen: 1, slagbinder: 1 };
/** `groupClean`: a party trash fight is clean only under `clean` times this (at 0.15 even half-skill bot parties stirred almost every run). `roughMax` caps a class's loosened rough bar. */
export const STIR = { clean: 0.15, rough: 0.5, roughMax: 0.8, groupClean: 0.35, need: 2, max: 2, minTier: 4, force: '' as string, off: false };
export const STIR_IDS: readonly StirId[] = ['elite', 'named', 'event', 'wave'];
export const STIR_INFO: Record<StirId, { name: string; tip: string }> = {
  elite: { name: 'Another joins', tip: 'One more joins the fight.' },
  named: { name: 'A named foe', tip: 'A named foe has come to meet you.' },
  event: { name: 'The ground answers', tip: 'The arena itself turns on you.' },
  wave: { name: 'They close in', tip: 'They come at you from more than one side.' },
};
/** Phase 15 Y10: each reaction's bit in World.stirsMet. */
export const STIR_BIT: Record<StirId, number> = { elite: 1, named: 2, event: 4, wave: 8 };
export type ArenaEventId = 'caveIn' | 'ventSurge' | 'coldSnap' | 'highWater';
/**
 * Phase 14 X3: arena events, one thing that happens partway through a solo trash fight.
 * `chance` of trash fights get one, `at` + 0..`spread` s in (a hash, so co-op agrees).
 * Cave-in: `caveCount` stones fall on a ring of `caveRing`; under one as it lands takes `caveDamage`, then it stands.
 * Vent Surge: every vent (or a ring of them on another floor) erupts at once after `surgeWarn` s.
 * Cold Snap (the Coldmarrow): after `snapWarn` s every hero's coal loses `snapCut` warmth.
 * High Water (the Wrackline): the Ebb comes at once. `force` (tools) forces one; `off` turns them off.
 * Damage numbers are before tierDamage.
 */
export const ARENA_EVENTS = {
  chance: 0.4, at: 9, spread: 5,
  caveCount: 3, caveRing: 150, caveRadius: 30, caveWarn: 2.2, caveDamage: 26,
  surgeWarn: 1.8, surgeDamage: 20,
  snapWarn: 2.5, snapCut: 0.2,
  force: '' as string, off: false,
};
/** Phase 15 Y4: a fixed order of the events, for World.arenaEventsMet's bits. Add new ids at the end. */
export const ARENA_EVENT_ORDER: ArenaEventId[] = ['caveIn', 'ventSurge', 'coldSnap', 'highWater'];
/** Phase 14 X3: each event's name and warning line, for its banner. */
export const ARENA_EVENT_INFO: Record<ArenaEventId, { name: string; tip: string }> = {
  caveIn: { name: 'Cave-in', tip: 'Rock is falling. Get out from under the shadows.' },
  ventSurge: { name: 'Vent Surge', tip: 'Every vent is about to blow. Get off them.' },
  coldSnap: { name: 'Cold Snap', tip: 'The cold bites. Your coal will dim, so feed it.' },
  highWater: { name: 'High Water', tip: 'The Ebb comes now. Get on a raft.' },
};
/** Phase 14 X3: each solo dungeon's events. Cave-in where its floors have stones, Vent Surge where they have vents. */
export const ARENA_EVENT_POOLS: Partial<Record<DungeonId, ArenaEventId[]>> = {
  kiln: ['caveIn', 'ventSurge'],
  foundry: ['caveIn', 'ventSurge'],
  glarewell: ['ventSurge'],
  coldmarrow: ['caveIn', 'coldSnap'],
  wrackline: ['highWater'],
  // Phase 14 X3, part 2: the group dungeons' trash, which has had stones and vents since Phase 12 W2.
  hammerdeep: ['caveIn', 'ventSurge'],
  ashvents: ['caveIn', 'ventSurge'],
  pressworks: ['caveIn', 'ventSurge'],
  // Phase 15 Y2: raid trash (openers and named fights, never the boss), which has had stones and vents since Phase 13 E1.
  crucible: ['caveIn', 'ventSurge'],
  hoard: ['caveIn', 'ventSurge'],
  smeltery: ['caveIn', 'ventSurge'],
  flue: ['caveIn', 'ventSurge'],
};
/** V3: the Kiln Mother's phase-2 signature this run. */
/**
 * Phase 16 U1 echoes: from `minTier`, a boss's last phase also uses one of her other versions' moves, every other time her
 * signature comes round. `off` and `force` (a version id) are for measuring.
 */
/**
 * Phase 16 U2/U3: the new foes the Seen log and run summary track, in bit order (append only: bits are saved on heroes'
 * Seen logs as ids, but the run's World.foesMet uses the order). A dungeon lists one when a trash fight on its route spawns it.
 */
export const NEW_FOES: readonly EnemyKind[] = ['ashwall', 'ballast', 'lampeye', 'dimhorn', 'conchblower'];
export const NEW_FOE_BIT: Partial<Record<EnemyKind, number>> = Object.fromEntries(NEW_FOES.map((k, i) => [k, 1 << i]));
export const ECHO: { minTier: number; off: boolean; force: string } = { minTier: 8, off: false, force: '' };
/** BOSSV2: where the kiln's mouth is on the Kiln arena's north wall (visuals' beehive kiln, renderer buildRoom). */
export const KM_MOUTH = { x: 0, y: -522, w: 120 };

/**
 * BOSSV2 (design's /mnt/project-files/horders/design/bosses/kiln-mother-v2.md, 25 Nov): the three-stage Kiln Mother
 * and the Glutton's Gorge without an interrupt. Shown times are arena values; a Halls run shows them 1/moveScale as long.
 */
/** Steve, 26 Nov: the Kiln Mother at tier 1 has this share of her health, so the first boss a hero meets is short. */
export const KILN_T1 = { bossHp: 0.65 };
/**
 * CP3 Kiln Mother remake (docs/design/kiln-mother.md): her health share by tier in the remade fight, on top of the usual
 * tier scaling, so the fight runs 60-90 s at average skill for the Emberwright and Cutwick at tiers 1 to 3. Tiers not
 * listed get 1.
 */
export const KILN_BOSS_HP: Record<number, number> = { 1: 1.7, 2: 1.6, 3: 1.3 };

export const KILN_V2 = {
  /** Stage 2 at this share of her health. */
  stage2At: 0.6,
  swipeEvery: 6, swipeArc: (120 * Math.PI) / 180, swipeReach: 220, swipeShow: 1.2, swipeDamage: 24,
  eggFirst: 8, eggEvery: 14, eggN: 2, eggMin: 150, eggMax: 250, eggHatch: 6, eggR: 30, eggAshlings: 3,
  /** Eggs land within this spread (radians) of the far side from the nearest hero. Engineering's pick. */
  eggSpread: (90 * Math.PI) / 180,
  /** Her walk to the kiln is this many times her speed (engineering's pick: at 30/s the walk would take up to 16 s). */
  walkIn: 4,
  /** She stands this far inside the north wall (y = -480 in the 560 arena). */
  mouthIn: 80,
  heatEvery: 9, heatWarn: 2.5, heatTick: 0.5, heatShare: 0.04,
  /** CP3 remake: bellowsN bellows, one at each of the first bellowsN heat steps, in the quarter that just turned cool. */
  bellowsRing: 380, bellowsN: 3,
  kilnMax: 40, stun: 8, stunTaken: 2,
  /** Fallen out, she lands this far in front of her kiln spot. Engineering's pick. */
  fallOut: 90,
  /** Stage 3: her first signature and first Kiln Brand come this many s in. Engineering's picks. */
  sigFirst: 4, brandFirst: 3,
  /** CP3 remake: her taunts wait this many s after a stage starts, so the stage banner is read first. */
  sayDelay: 2.5,
  /** CP3 remake, stage 3: she Swipes a hero this close to her middle (melee range); anyone farther gets a Lob. */
  swipeNear: 150,
  /** CP3 remake, stage 3: s between her basic attacks above and below 30% health (were 3.2 and 2.4), the Lob's damage
   * (was 35) and an empty Kiln Brand's (was 40). */
  stage3Pace: [4, 3.2], lobDamage: 26, brandMiss: 30,
  /** CP3 remake: Kiln Brand's gold circle lands this far from her middle (her radius 42 + 70 circle - a little), at her side. */
  brandOff: 100,
  ringN: 2, ringEvery: 1, ringWarn: 1, ringSpeed: 140, ringW: 24, ringGap: (60 * Math.PI) / 180, ringDamage: 30,
  gorgeQuiet: 3, gorgeHeal: 0.08,
};

/**
 * Interruptible casts whose only answer is stopping them (no floor telegraph to step out of). When nobody in the party
 * can stop the caster (World.partyStops: no unlocked F, or a boss in a party with no interrupter) the foe doesn't use
 * them and goes on with its other skills (Steve, 26 Nov: "if you don't have an interrupt, they shouldn't use that skill").
 * Casts with a telegraph (Ground Pound, Frost Lace, Haul, Sink, a Lensbearer's Glare) stay: they are dodged instead.
 */
export const STOP_ONLY = new Set(['cataclysm', 'gorge', 'coalGorge', 'snuff', 'conchCall', 'mirror', 'rekindle', 'undertow']);

export type KilnVariant = 'cataclysm' | 'draw' | 'turning';
export const KILN_VARIANTS: KilnVariant[] = ['cataclysm', 'draw', 'turning'];
/**
 * Phase 15 Y3 Turning Fire: from phase 2, in place of Molten Cataclysm, she pours `cones` cones of fire around herself,
 * each `arc` wide, the first on the hero, each next one a turn further on and landing `step` s after the last (the first
 * at `first` s). Not interruptible: follow the fire round her, into the ground the last cone already burned.
 */
export const KILN_TURN = { cones: 4, arc: (70 * Math.PI) / 180, first: 2.2, step: 0.7, reach: 900, damage: 40 };
/**
 * V3 Kiln Draw: a `cast` s inhale, not interruptible, pulling heroes within `reach` toward her at `pull` px/s; then fire lands
 * in a `radius` circle on her (old fight), or (CP3 remake) a `frontArc` cone `frontReach` long out of her mouth, so behind her is safe.
 */
export const KILN_DRAW = { cast: 2.2, pull: 80, reach: 900, radius: 150, damage: 45, frontReach: 330, frontArc: Math.PI };

/** V8: Nhevra's phase-2 signature this run: Thin Ice (as before) or Emberdrift. */
export type NhevraVariant = 'ice' | 'drift' | 'rime';
export const NHEVRA_VARIANTS: NhevraVariant[] = ['ice', 'drift', 'rime'];
/** Phase 16 U1: Nhevra has two phases, so her echo starts at `below` health, then runs `on` s on and `off` s off. */
export const NHEVRA_ECHO = { below: 0.25, on: 12, off: 10 };
/**
 * Skills' U4 check (23 Nov): Creeping Rime with a Thin Ice echo boxes a melee hero in between the cracks, the rime
 * and her body (Duskblade 41 -> 26 of 65 Rime runs, Coldmarrow t10), so a Rime Nhevra only ever echoes the Emberdrift.
 */
export const NHEVRA_RIME_ECHOES: NhevraVariant[] = ['drift'];
/**
 * Phase 15 Y3 Creeping Rime: from phase 2 a patch of rime `r` px across rises under Nhevra and creeps after the nearest hero
 * at `speed` px/s. Inside it a coal loses `drain`/s and Chill builds `chill` stacks/s. No Thin Ice in this version.
 */
export const CREEPING_RIME = { r: 85, speed: 48, drain: 0.05, chill: 1.5, hold: 85, orbit: 1 };
/** V8 Emberdrift: from phase 2 coals drain `drainMult` times faster; every `every` s, `n` embers fall on a `ring` px ring, each refilling `refill` of a coal when touched (within `pickR`). */
export const EMBERDRIFT = { every: 12, n: 3, ring: 280, pickR: 34, refill: 0.45, drainMult: 2.5 };

/** V8: the Lensmother's phase-2 signature this run: Twin Brand (as before) or Glintfall. */
export type LensVariant = 'brand' | 'glint' | 'walk';
export const LENS_VARIANTS: LensVariant[] = ['brand', 'glint', 'walk'];
/** V8 Glintfall: on the Twin Brand timer, a `cast` s warning, then a `radius` circle of falling light on every standing pillar. */
export const GLINTFALL = { cast: 1.8, radius: 80, damage: 24 };
/**
 * Phase 15 Y3 Carried Light: from phase 2 the light comes from her, not the centre lens.
 * Each Glare moves it to where she stands as the warning starts (so shadows swing then, `glareWarn` s before the burn),
 * and she has no Twin Brand. A pillar closer than `minD` to the light casts no shadow.
 */
export const CARRIED_LIGHT = { minD: 40 };

/** V8: Maelra's phase-2 signature this run: Rising Water (the arena shrinks) or the Sluicetide. */
export type MaelraVariant = 'water' | 'tide' | 'seal';
export const MAELRA_VARIANTS: MaelraVariant[] = ['water', 'tide', 'seal'];
/** V8 Sluicetide: from phase 2 the water pushes every hero `drift` px/s one way, and turns every `turnEvery` s. The arena keeps its size. */
export const SLUICETIDE = { drift: 45, turnEvery: 8 };
/** Phase 16 U1: Maelra's echo windows in her last phase: the first `first` s in, then `on` s on and `off` s off. */
/**
 * Maelra's hits between casts: a circle under the hero and a 300 px cone. The cone only ever lands on melee, so 1.0 M3
 * (25 Nov) cut it 28 -> 10, as at average skill she walled the Bulwark and Duskblade at t6 (7 and 3 of 20) while ranged
 * classes won 16-18 of 20. Same fix as the Lensmother's Lens Sweep (GLARE.sweepDamage).
 * 1.0 M3 (26 Nov): the circle under the hero then made every Duskblade loss at t6 (average skill, 6 of 6 killing
 * blows), so it went 32 -> 22: t6 seeds 21-60 Duskblade 21 -> 30, Emberwright 23 -> 33 of 40; t9 stays hard (1-15 of 20).
 */
export const MAELRA_HITS = { circle: 22, cone: 10 };
export const MAELRA_ECHO = { first: 2, on: 12, off: 10 };
/** Maelra's versions that can echo: rising water is in every version but the Sluicetide already. */
export const MAELRA_ECHOES: MaelraVariant[] = ['tide', 'seal'];
/** Phase 16 U1: is this version in effect now, rolled or as a live echo? (For bosses whose echo runs in windows.) */
export const versionLive = (w: { bossVariant: string; bossEcho: string; echoLive: boolean }, v: string): boolean =>
  w.bossVariant === v || (w.echoLive && w.bossEcho === v);
/**
 * Phase 15 Y3 Sealed Vents: from phase 2 only one vent is open; only it boils off her Temper.
 * Every `every` s the steam moves to another vent, shown `warn` s ahead. The open vent heals `healMult` times as much.
 * Skills' Y5 fix (the Bulwark fell to 49 of 160 at t6): the open vent boils her from `wide` times its radius, the steam moves
 * to the free vent nearest her when `near` is 1, and her Temper builds `temperSlow` times slower. The clock runs in runMaelra,
 * so it pauses while she casts.
 */
export const MAELRA_SEAL = { every: 16, warn: 2.5, healMult: 1.5, wide: 1.6, near: 1, temperSlow: 1.5 };

export const LAYOUT = {
  stoneCount: 5, stoneRing: 230, stoneRadius: 34,
  lavaWidth: 70, lavaBurn: 0.08,
  ventCount: 4, ventRing: 260, ventRadius: 75, ventCast: 1.2, ventEvery: 3.5, ventFirst: 4, ventDamage: 20,
};

/** V1 (variety, docs/design/variety.md): the Kiln's new foes. */
/** Site cards (Phase 11 variety talents). Per-rank numbers unless noted. */
export const SITE_CARDS = {
  /** Measuring only (TUNE=SITE_CARDS.off=1): never offer site cards, as before this pass. */
  off: 0,
  /** Vent-Fed: flare reach (px), Heat per rank; the next volley deals double. */
  ventRange: 260,
  ventHeat: 25,
  /** Read the Lane: Sidestep seconds back per rank, swings that get the bonus, bonus per rank. */
  laneRefund: 3,
  laneSwings: 3,
  laneDmg: 0.35,
  /** Back to Stone: reach past the stone's edge (px), damage cut per rank (lower in the Glarewell, whose pillars stand in every fight), Rim Smash stun per rank. */
  stoneRange: 50,
  stoneDr: 0.07,
  glareStoneDr: 0.04,
  stoneStun: 0.3,
  /** Reaching Light: Spitter reach = base + per rank (px); Hush seconds back per rank on a Spitter. */
  reachBase: 240,
  reachPerRank: 80,
  hushRefund: 2.5,
  /** Slag Wade: lava burn cut per rank (rank 2 is lava-proof), damage per rank while in lava. */
  wadeBurn: 0.5,
  wadeDmg: 0.1,
};

export const VARIETY = {
  /** Ember Spitter: backs off inside `spitterNear`, circles out to `spitterFar`; Ember Lob every `lobEvery` s within `lobRange`, a `lobRadius` circle that lands after `lobLand` s. */
  spitterNear: 190, spitterFar: 290, lobRange: 440, lobEvery: 3.2, lobCast: 0.7, lobLand: 1.6, lobRadius: 70, lobDamage: 18,
  /** Ashbuck: from `chargeMin` to `chargeLen` away it shows a lane (`chargeArc` wide cone) for `chargeCast` s, then runs it at `chargeSpeed`. */
  chargeMin: 110, chargeLen: 360, chargeArc: 0.24, chargeCast: 1.0, chargeEvery: 5, chargeSpeed: 720, chargeDamage: 22,
  /** Hollow Rift in a dungeon fight: Ashlings out at once. */
  riftCap: 8,
};

/**
 * Smarter foes (Steve, 26 Nov: "They just walk towards you. They should be smarter and move a little bit more
 * sporadically or maybe charge sometimes"). A chaser aims `lead` s ahead of a running hero (at most `leadMax` px; hero
 * speed counted up to `heroTop`), pulls `flank` to its own side and sways `weave` at `weaveHz`, both fading from `far`
 * px down to none at `close`. Lungers (FOE_AI_LUNGERS) also lunge (see World.runLunge): the first one `lungeFirst` s to
 * `lungeFirst + lungeSpread` s after it wakes, then about every `lungeEvery` s.
 */
export const FOE_AI = {
  lead: 0.7, leadMax: 150, heroTop: 220, flank: 0.5, weave: 0.35, weaveHz: 0.45, close: 80, far: 300,
  lungeMin: 70, lungeMax: 200, lungeLen: 170, lungeArc: 0.32, lungeWind: 0.6, lungeSpeed: 560, lungeHit: 1.5,
  lungeEvery: 7, lungeFirst: 1, lungeSpread: 4, lungeCap: 2,
};
/** Foes that keep their own way of moving (they hang back, guard, plant or charge), so FOE_AI leaves their walk alone. */
export const FOE_AI_OWN_MOVE: ReadonlySet<EnemyKind> = new Set<EnemyKind>(['emberSpitter', 'ashwall', 'dimhorn', 'lampeye', 'ballast', 'ashbuck', 'kilnMother', 'sluiceCrawler']);
/** The fast pack chasers with no charge of their own: these lunge. */
/** The opening's R1 hound (FIRST_DELVE.hound): a Cinderhound, bigger and slower. */
const OPENING_HOUND: EnemyDef = {
  ...ENEMIES.cinderhound,
  speed: ENEMIES.cinderhound.speed * FIRST_DELVE.hound.speed,
  radius: Math.round(ENEMIES.cinderhound.radius * FIRST_DELVE.hound.size),
  size: FIRST_DELVE.hound.size,
};
export const FOE_AI_LUNGERS: ReadonlySet<EnemyKind> = new Set<EnemyKind>(['cinderhound', 'ashling', 'slagling', 'shade', 'rimehound', 'snuffer', 'shoalLurker']);
/** A steady 0..1 number per foe slot and salt (no draw from the run's Rng, so nothing else shifts). */
function foeHash(i: number, salt: number): number {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

/**
 * Phase 16 U2: the Ashwall (the Kiln). Its shield turns toward its hero at `turn` rad/s. Hit inside `frontArc`
 * (half-angle) of it, the Ashwall takes `front`, and a foe within `shelterR` behind it (inside `shelterArc` of its
 * back) takes `sheltered`. It plants itself `guardGap` in front of the nearest foe within `guardRange`.
 * Shield Bash: a `bashArc` cone off its front, every `bashEvery` s while the hero is close.
 */
/**
 * Phase 16 U2: the Conchblower (the Wrackline). Every `every` s (first after `first`) it casts Conch Call for `cast` s,
 * Quenchable. A blast that lands brings the next Ebb `hasten` s sooner, but never to under `floor` s away; during an
 * Ebb it holds the water `hold` s longer. It swims the Ebb like a Shoal Lurker rather than drifting.
 */
export const CONCH = { first: 4, every: 8, cast: 1.8, hasten: 6, floor: 1, hold: 1.5 };

/**
 * Phase 16 U2: the Dimhorn (the Coldmarrow). It hangs `hang` px outside its hero's coal light (circling in a `band`
 * px wide ring). `Enemy.aux` counts its seconds out of every coal's light, draining `drain` times as fast inside one.
 * At `callAt` it casts Dark Call for `callCast` s, not interruptible: `calls` Rimehounds come in from the arena edge
 * behind it, unless it is inside a coal's light when the cast ends. After `maxCalls` calls (`Enemy.aux2` counts them) its
 * horn is spent. Uncapped, a ranged hero who never brought the light over it faced 10 to 26 calls and died every time.
 */
export const DIMHORN = { hang: 40, band: 70, drain: 2, callAt: 7, callCast: 2, calls: 3, maxCalls: 2 };

/**
 * Phase 16 U2: the Lampeye (the Glarewell). Its gaze (`Enemy.aux`, seconds) builds while it can see its hero and
 * fades `fade` times as fast behind a pillar. At `full` it casts Searing Look for `lookCast` s: every hero it can
 * still see takes `lookDamage`. It backs off inside `keep` px. A hero within `under` px of its edge is too close for it
 * to focus on, so out of its gaze: melee heroes beat it by getting right under it.
 */
export const LAMPEYE = { full: 6, fade: 2, lookCast: 1.0, lookDamage: 34, keep: 220, under: 70 };

/**
 * Phase 16 U2: the Ballast (the Foundry). With its hero within `reach` (past its own radius) for `plantDelay` s it
 * drops anchor: it stops, takes `planted` damage, and Anchor Slams a `slamR` ring every `slamEvery` s (the first
 * `slamFirst` s after planting). `unplant` s after its hero leaves its reach it weighs anchor and walks again.
 */
export const BALLAST = {
  reach: 90, plantDelay: 0.8, unplant: 0.6, planted: 0.3,
  slamFirst: 1.0, slamEvery: 2.6, slamCast: 0.9, slamR: 95, slamDamage: 16,
};

export const ASHWALL = {
  turn: 0.5, frontArc: Math.PI / 3, front: 0.5, shelterR: 150, shelterArc: 0.9, sheltered: 0.35,
  guardGap: 55, guardRange: 320,
  bashRange: 80, bashArc: 1.4, bashCast: 0.8, bashEvery: 5, bashDamage: 14,
};

export const FOUNDRY = {
  mirrorCast: 2,
  mirrorTime: 3,
  mirrorReflect: 0.12,
  /** Share of max health healed per Temper stack boiled off in a vent. */
  ventHealPerStack: 0.04,
  rekindleCast: 6,
  bloomEvery: 9,
  bloomRadius: 90,
  bloomDelay: 2.5,
  bloomDamage: 18,
  bloomHeal: 0.25,
  /**
   * On a Halls map a sealed room keeps a Crawler close to the hero it follows, so it walks back over its own Blooms
   * (half of the bursts fed a Crawler, against a third in the arena). Ranged heroes and healers lost those fights to
   * Burnout (Foundry t4 full: Slagbinder 35 -> 24, Lumen 33 -> 25 of 40). 0.15 brings them back (31, 34). Design, 25 Nov.
   */
  hallsBloomHeal: 0.15,
  temperEvery: 6,
  temperMax: 5,
  temperCut: 0.15,
  ventRing: 250,
  ventRadius: 55,
  ventEvery: 7,
  ventDelay: 1.5,
  ventDamage: 30,
  waterMin: 360,
  waterTime: 20,
  undertowEvery: 12,
  undertowCast: 2.5,
  undertowPull: 0.6,
  undertowDamage: 12,
  enrageAfter: 180,
};

/**
 * Ondrel of the Hammerdeep: a group boss whose mechanics each ask one role for one thing.
 * See docs/design/group-dungeons.md. Damage numbers are before tierDamage.
 */
/** The Coldmarrow (C1): the Hearthcoal, Chill, its foes and Nhevra. */
export const COLD = {
  /** Hearthcoal: warmth lost per second in a fight, and gained per frost-touched kill. Light radius from minR (out) to maxR (full). */
  drain: 0.01, feed: 0.07, minR: 70, maxR: 170,
  /** Phase 14 X5: coal fed to a hero for each tenth of a named foe's health they take. */
  namedFeed: 0.07,
  /** A Snuffer's touch takes this much warmth; killing one takes it back (it carries stolen light). */
  snufferDim: 0.15, snufferFeed: 0.15,
  /** Chill: a stack every `chillEvery` s while the coal is out, `chillDecay` stacks/s lost while it burns. Each stack slows `chillSlow`. Frozen at `frozenAt`: `frozenBurn` of max health per second. */
  chillEvery: 1.5, chillDecay: 2, chillSlow: 0.1, frozenAt: 5, frozenBurn: 0.04,
  /** Frost Warden: damage taken outside any coal's light, and inside it. */
  wardenCold: 0.4, wardenWarm: 1.4,
  /** Hoarfrost Weaver: Frost Lace (Quenchable), Chill stacks and damage on whoever is in it. */
  laceEvery: 7, laceCast: 1.4, laceR: 75, laceChill: 2, laceDamage: 10,
  /** Nhevra: Snuff (Quenchable) dims every coal; Snuffer Tide; Long Night hits for nightMax × (1 − warmth). */
  snuffEvery: 11, snuffCast: 2.2, snuffCut: 0.2, firstSnuff: 6,
  tideEvery: 24, tideN: 2, firstTide: 12,
  nightEvery: 30, nightCast: 3, nightMax: 0.6, firstNight: 20,
  /** Co-op huddle: the Long Night hits `huddleCut` less for each other living hero within `huddleR` (up to `huddleMax`). */
  huddleR: 110, huddleCut: 0.15, huddleMax: 3,
  /** Soft enrage: the Long Night comes twice as often. */
  enrageAfter: 200,
  /**
   * Phase 2, Thin Ice (from `phase2` of her health): every `crackEvery` s the river cracks into
   * `crackLanes` parallel strips (the first `firstCrack` s after the phase starts) of open water, `crackGap` apart and centred on Nhevra, at a random
   * angle. `crackWarn` s of warning, then open for `crackOpen` s. Open water: coal drains `waterDrain`/s,
   * Chill builds `waterChill` stacks/s, and it burns `waterBurn` of max health a second.
   */
  phase2: 0.5, crackEvery: 22, firstCrack: 4, crackLanes: 2, crackGap: 260, crackHalfW: 34, crackWarn: 2.5, crackOpen: 9,
  waterDrain: 0.05, waterChill: 2, waterBurn: 0.06,
  /** In phase 2 the Long Night comes every `nightEvery2` s instead (Thin Ice takes over as the pressure). */
  nightEvery2: 40,
  /** While any crack is open, Nhevra takes this much more damage. */
  thinIceExposed: 0.25,
};
/**
 * The Wrackline (fifth solo dungeon): rafts drift round the arena; the Ebb drags
 * anyone off a raft toward the drain at the centre, where Hessa waits.
 * Spec and tuning: docs/design/wrackline.md.
 */
export const WRACK = {
  /** Rafts: radius, the radius of each one's drift circle, and drift speed (world units/s along the circle). */
  raftR: 78, raftRings: [300, 125, 410], drift: 38,
  /** The Ebb: every `tideEvery` s in trash fights (`tideBoss` with Hessa up), `tideWarn` s of warning, then `tideOpen` s of pull. */
  tideEvery: 18, tideBoss: 14, tideLate: 7, firstTide: 8, tideWarn: 3, tideOpen: 4,
  /** Off a raft in the Ebb: dragged toward the centre at `drag` of your class speed (the Bulwark 64 u/s, the Duskblade 76), burned `tideBurn` of max health/s, plus `drainBurn` inside `drainR`. */
  drag: 0.5, tideBurn: 0.04, drainR: 90, drainBurn: 0.1,
  /** Foes drift at `foeDrag` units a second (75 × 0.8 before the pull became a share of hero speed), and the drain takes `foeDrain` of their max health a second. Shoal Lurkers swim faster in it instead. */
  foeDrag: 60, foeDrain: 0.06, lurkerSurge: 1.3,
  /** Barge Hauler: Haul (Quenchable) yanks its target up to `haul` units toward it. */
  haulEvery: 8, haulCast: 1.6, haul: 160, haulRange: 520, haulDamage: 8,
  /** Hessa: Sink (Quenchable) sinks the raft nearest her target for `sinkTime` s; Call the Shoal brings Lurkers. */
  sinkEvery: 9, sinkCast: 2.2, sinkTime: 12, firstSink: 7,
  /** Call the Shoal: `shoalN` Lurkers every `shoalEvery` s (2 until 25 Nov, when the solo Bulwark lost 3 of 5 Hessa fights to them on the map). */
  shoalEvery: 28, shoalN: 1, firstShoal: 14,
  /** Phase 2, Riptide (from `phase2` of her health): rafts drift faster and the pull is stronger. */
  phase2: 0.5, riptideDrift: 1.6, riptideDrag: 1.25,
  /** Soft enrage: the Ebb every `tideLate` s. */
  enrageAfter: 240,
};
/** Phase 12 W1: the Wrackline's raft currents: each raft's drift direction (1 or -1), inner ring in the middle. The first is the original. */
/** H3d: on a Halls map a raft's far edge stays this far inside its quay room's wall (clear of every doorway). */
export const HALLS_WRACK = { clear: 100 };
export const CURRENTS: number[][] = [[1, -1, 1], [1, 1, 1], [-1, 1, -1], [-1, -1, 1]];
/**
 * Phase 12 W3: the Furnace Regent's two versions (his phase 2). `ash`: Ash Fall, a circle under every hero (step out).
 * `court`: Summons, on Ash Fall's timer: after `warn` s, every hero farther than `radius` from him takes `damage`
 * (scaled by tier). The party has to gather on him, where a Decree's scorch (REGENT.scorchRadius) catches anyone close
 * to its holder, so holders stand at the edge and passes happen in the crowd.
 */
export type RegentVariant = 'ash' | 'court' | 'tithe';
export const REGENT_VARIANTS: RegentVariant[] = ['ash', 'court', 'tithe'];
/**
 * Phase 15 Y3 Tithe (his phase 2 in the `tithe` version, on Ash Fall's timer, in place of the ash): a gold circle of `r` lands
 * `dist` px from him (a random side) after `fuse` s. If at least `need` heroes stand in it, they share the tithe: each takes
 * `cost` of max health split between them. If fewer do, every hero pays `miss` of max health. Decrees still scorch anyone close
 * to their holder, so a holder who joins the tithe burns the others.
 */
export const TITHE = { dist: 240, r: 80, fuse: 4, need: 2, cost: 0.65, miss: 0.35 };
export const SUMMONS = { warn: 2.5, radius: 130, damage: 70 };
/**
 * Phase 12 W3: the Cinder Colossus's two versions (his phase 2). `wheel`: he turns on the hero who hurt him most and sweeps.
 * `shift`: Plate Shift, on the Wheel's timer and cast: his plate slides round to face that hero instead, and stays
 * there (World.colPlate) while he keeps facing the tank, so his open back moves and the damage dealers have to find it again.
 */
export type ColossusVariant = 'wheel' | 'shift' | 'mill';
export const COLOSSUS_VARIANTS: ColossusVariant[] = ['wheel', 'shift', 'mill'];
/**
 * Phase 15 Y3 Millstone (his phase 2 in the `mill` version, on the Wheel's timer and cast): he grinds round on the spot for `time` s,
 * turning `turn` radians a second one way (chosen at random), ignoring the tank. Slag pours off him all round: every `tick` s a non-tank
 * hero within `range` px of his edge and within `arc` radians of his facing (all but his open back) takes `damage` of max health. His open
 * back turns with him, so the damage dealers have to walk round with it. No Slag Sweep while he grinds. (A front-only burn, arc pi/3,
 * hit almost nobody: the bots already stood at his back.)
 */
export const MILL = { time: 6, turn: 0.9, arc: 2.1, range: 200, tick: 0.5, damage: 0.08 };
/** Phase 12 W3 and Phase 15 Y3: Old Vorhulm's versions. `spill`: Ember Feast scatters embers to grab. `bank`: Banked Coals, gold circles to stand on as they land. `inhale`: he draws the raid in to bite. */
export type VorhulmVariant = 'spill' | 'bank' | 'inhale';
export const VORHULM_VARIANTS: VorhulmVariant[] = ['spill', 'bank', 'inhale'];
/**
 * Phase 15 Y3 Inhale (his phase 3 in the `inhale` version, on Ember Spill's timer, in place of the embers): after a `warn` s
 * warning he breathes in for `time` s, drawing every hero toward him at `pull` of their class speed (Anvil Skin holds a Bulwark).
 * Anyone within `bite` px of his edge is bitten every `tick` s for `damage` of max health. (A bite that also healed him
 * made it a damage race weaker parties lost: half-skill bots won 20 of 80 with it, 38 without.)
 */
export const INHALE = { warn: 1.5, time: 3, pull: 0.3, bite: 40, tick: 0.5, damage: 0.08 };
/**
 * Banked Coals (his phase 3 in the `bank` version, on Ember Spill's timer, in place of the embers): `count` gold circles of
 * `radius`, `near` or `far` from him in turn, landing after `fuse` s. A hero standing in one smothers it; an empty one he eats
 * (COAL.emberHeal and COAL.emberDamage, as for an ember). No blast and no adds.
 */
export const BANK = { count: 2, radius: 50, fuse: 4, near: 120, far: 170 };
/** Phase 12 W3 and Phase 15 Y3: Grandmother Slag's versions. `pour`: phase 2 is the Pour's molten lanes. `brim`: the Brimming, cooling islands that sink. `flow`: the Overflow, the pit floods in from the rim. */
export type SlagVariant = 'pour' | 'brim' | 'flow';
export const SLAG_VARIANTS: SlagVariant[] = ['pour', 'brim', 'flow'];
/**
 * Phase 15 Y3 the Overflow (her phase 2 in the `flow` version, in place of the Pour's lanes): every `every` s (first after
 * `first`) the pit overflows from the rim. After a `warn` s warning, for `last` s every hero farther than `safeR` from her
 * burns `burn` of max health each `tick` s, so the raid gathers at her feet. The party heat burns `heat` (the Pour's is SLAG.heat) as before.
 */
export const OVERFLOW = { every: 14, first: 4, warn: 2.5, last: 4, safeR: 190, burn: 0.03, tick: 0.5, heat: 0.035 };
/**
 * The Brimming (her phase 2 in the `brim` version, in place of the Pour's lanes): `count` cooling islands of `radius`,
 * `near` or `far` from her. Each lasts `life` s (dimming for its last `warn`), then sinks and a new one rises elsewhere.
 * The rising slag burns a hero off an island `heat` of max health every SLAG.heatEvery s, and one on an island nothing.
 */
export const BRIM = { count: 3, radius: 80, life: 12, warn: 3, near: 170, far: 260, heat: 0.06 };
/** Phase 12 W2 and Phase 15 Y3: Oskel's versions. `rivets`: a ring under every hero. `cut`: Die Cut, half the floor at once. `punch`: Punch Line, three rows marching out from him. */
export type OskelVariant = 'rivets' | 'cut' | 'punch';
export const OSKEL_VARIANTS: OskelVariant[] = ['rivets', 'cut', 'punch'];
/**
 * Phase 15 Y3 Punch Line, on the Rivets timer: `rows` rows of punches run out from Oskel's feet, evenly spaced round him, one through a
 * hero (or, while a Downstroke plate is open, with the plate midway between two rows, so its taker is safe). Each row is `n` circles of `r`, `gap` apart;
 * the nearest lands after `first` s and each one further out `step` s later, so the punches march out across the floor. The nth punch out
 * has radius `r` + `grow` x n (55 at his feet to 85 at the far end), so melee under him lose less uptime than heroes standing off.
 */
export const PUNCH = { every: 7, rows: 3, n: 6, r: 55, grow: 6, gap: 90, first: 1.4, step: 0.25, damage: 35 };
/** True for a Punch Line punch's radius (PUNCH.r + PUNCH.grow * n, for n below PUNCH.n): its sound keys on the slam's size. */
export const isPunchR = (r: number): boolean => {
  for (let n = 0; n < PUNCH.n; n++) if (r === PUNCH.r + PUNCH.grow * n) return true;
  return false;
};
/** Die Cut: on the Rivets timer, a half-floor cut through Oskel with a `fuse` s warning; everyone in it takes `damage` (scaled by tier as it lands). */
export const DIECUT = { every: 9, fuse: 2.4, damage: 45 };
/** Phase 12 W2 and Phase 15 Y3: Ysmeret's versions. `still`: the Twin Vents stay where they open. `wander`: they circle her while they fuse. `roll`: Rolling Vents, one at a time round her. */
export type YsmeretVariant = 'still' | 'wander' | 'roll';
export const YSMERET_VARIANTS: YsmeretVariant[] = ['still', 'wander', 'roll'];
/**
 * Phase 15 Y3 Rolling Vents: one vent at a time, `count` in a row. The first opens where Twin Vents would (on its usual fuse);
 * each next one opens `step` degrees further round her as the last one closes, on a shorter `fuse`. The way round flips every cast.
 */
export const ROLLING = { count: 3, step: 120, fuse: 3.4, scatterDuring: 1 };
/** Wandering Vents: each circle moves `speed` px/s around Ysmeret (heroes run 128 to 152), about 70 degrees over a 4 s fuse. */
export const WANDER = { speed: 70 };
/** Phase 12 W2 and Phase 15 Y3: Ondrel's versions. `choir`: Choir of Iron hurts every hero. `load`: Ironload marks one, and the party shares it. `home`: the Homeward Hammer, thrown out and flying back. */
export type OndrelVariant = 'choir' | 'load' | 'home';
export const ONDREL_VARIANTS: OndrelVariant[] = ['choir', 'load', 'home'];
/** Phase 16 U1: the group bosses have one phase, so their echo starts at `below` health: every other signature is the echo's, the first one first. */
export const GROUP_ECHO = { below: 0.25 };
/**
 * Phase 16 U1: the raid bosses' signatures run in one phase, so each echo starts at that boss's health share here
 * and alternates with the boss's own signature on the same timer, echo first.
 */
export const RAID_ECHO = { regent: 0.4, colossus: 0.45, vorhulm: 1, slag: 0.5 };
/** Phase 16 U1: Grandmother Slag's echo windows in phase 2: `on` s on (one Overflow cycle), `off` s off. */
export const SLAG_ECHO = { on: 14, off: 10 };
/**
 * Phase 15 Y3 the Homeward Hammer, on the Choir's timer: he throws his hammer at the hero farthest from him. It lands
 * in a circle (`radius`, after `fall` s), then flies straight back to his hand along a line `width` px either side
 * (after `back` s). As it lands it rings through the floor: every hero loses `ring` of max health (growing like the Choir).
 * Each throw hits `grow` harder. While it is out he has no Hammer Sweep.
 */
export const HOMEWARD = { fall: 1.8, radius: 75, damage: 70, back: 1.2, width: 40, backDamage: 60, grow: 0.08, ring: 0.05 };
/**
 * Ironload, on the Choir's timer: marks a hero (not the one Ondrel is on) for `time` s. It lands for
 * `share` (+`grow` each time) of max health, split evenly among the living heroes within `radius` of the mark.
 * Four together take about what one Choir costs each; alone it is half a hero's health.
 */
export const IRONLOAD = { time: 5, radius: 110, share: 0.5, grow: 0.08 };
/** Phase 12 W1: Hessa's two versions. `riptide`: phase 2 speeds the rafts and the pull. `outsurge`: phase 2 turns the Ebb around. */
export type HessaVariant = 'riptide' | 'outsurge' | 'whirl';
export const HESSA_VARIANTS: HessaVariant[] = ['riptide', 'outsurge', 'whirl'];
/**
 * Phase 15 Y3 the Whirl: from phase 2 the Ebb swirls round the drain instead of only pulling in. Off a raft, a hero is carried
 * round at `spin` of their class speed and drawn in at `inward` of the usual pull; the way it turns flips every Ebb (World.whirlDir).
 */
export const WHIRL = { spin: 0.6, inward: 0.5 };
/**
 * Phase 16 U1: Hessa has two phases, so from `below` health every other Ebb runs her echo's way instead of hers.
 * 0.5 (was 0.25, QA's expert report): all of phase 2, so a run sees it about twice, not once at the very end.
 */
export const HESSA_ECHO = { below: 0.5 };
/** The Outsurge: the water pushes out to the rim instead of the drain, and burns `rimBurn` of max health a second within `rimR` of the edge (the drain's 0.1 at the centre). */
export const OUTSURGE = { rimR: 90, rimBurn: 0.1 };
/** How many phases each boss has, for the target frame ("Phase 2 of 3"). Unlisted bosses have 3; 1 means none to show. */
export const BOSS_PHASES: Partial<Record<EnemyKind, number>> = { nhevra: 2, ondrel: 1, ysmeret: 1, hessa: 2, oskel: 1 };

/** Kinds whose kill feeds the Hearthcoal. */
export const COLD_FED_BY: EnemyKind[] = ['rimehound', 'snuffer', 'frostWarden', 'hoarfrostWeaver'];

/** The Ashvents' group boss (G3; docs/design/group-dungeons.md). */
/**
 * C3, the raid: Grandmother Slag in the Crucible. Three phases by health, each
 * built on a verb the party already knows from the group dungeons.
 * Spec and tuning: docs/design/raid.md.
 */
export const SLAG = {
  /** Phases start at these shares of her health: 2 The Pour, 3 Last Ember. */
  phase2: 0.66, phase3: 0.33,
  /**
   * Ladle Pour: the tank hit, through dodges and shields, on the hero picked at wind-up.
   * It leaves `ladleStacks` of Ladle Burn (Slag Grip stacks: any ally's heal clears them),
   * and each stack still on the target makes the next pour hit `ladleStackMult` harder.
   */
  ladle: 60, ladleStacks: 2, ladleStackMult: 0.3, ladleEvery: 9, ladleLate: 13, ladleCast: 2, firstLadle: 6,
  /**
   * Seared (on `Player.sunderT`, like Hammerdeep's Sundered): a pour on a hero still Seared
   * hits `searMult` harder. It outlasts the gap between pours (9 s, then 13 s) but not two
   * gaps, so two tanks trading the boss after each pour never take a Seared pour.
   */
  searTime: 15, searMult: 0.4,
  /** Ladle Burn: share of max health per second per stack, up to `slagMax` stacks. */
  burnTick: 0.01, slagMax: 6,
  /** Phase 1: Slaglings pour out of the channels. */
  addsEvery: 18, adds: 5, firstAdds: 10,
  /** Phase 2, The Pour: molten lanes from her feet (narrow cones), one aimed at a hero. */
  pourEvery: 6, pourCast: 1.6, pourLanes: 3, pourRange: 620, pourArc: 18, pourDamage: 45,
  /** Phase 2: the rising slag burns every hero this share of max health every `heatEvery` s. */
  heat: 0.03, heatEvery: 3,
  /** Phase 3, Last Ember: Ysmeret's two checks together (soak vents, then Cinder Marks). */
  ventEvery: 16, ventFuse: 4, ventDist: 220, ventRadius: 55, ventBlast: 70,
  marksEvery: 14,
  /** Cinder Marks' burst on its own hero (Scatter Embers' 10% from before #424 raised Ysmeret's). */
  marksSelf: 0.1,
  /** Hard enrage: this long after she appears, she casts Last Ember, which wipes the party. */
  hardEnrage: 420, lastEmberCast: 5,
};

/** Raid 3's tuning: the Cinder Colossus in the Smeltery (docs/design/raid3.md). */
/** Raid 4 (the Flue): the Furnace Regent. */
export const REGENT = {
  phase2: 0.6, phase3: 0.25,
  /** Decree: every `decreeEvery` s (two at once in phase 2), on a non-tank. It burns its holder `decreeTick` of max health a second and anyone within `scorchRadius` `scorchTick`; after `decreeTime` s it bursts for `decreeBurst` of every hero's max health. */
  decreeEvery: 20, firstDecree: 6, decreeTime: 8, decreeTick: 0.01, scorchRadius: 70, scorchTick: 0.02, decreeBurst: 0.5,
  /** Passing: touch (within `passRange`) a hero who can hold it, after it has `settle` s on you. The passer is Spent for `spentTime` s; after `decreePasses` passes it fades (`edictPasses` in phase 2). A tank can take one by hand. */
  passRange: 50, settle: 1, spentTime: 6, decreePasses: 2, edictPasses: 1,
  /**
   * Ash Fall (phase 2): a circle under every hero. Until 22 Nov 2026 its 70 was scaled by tier twice (once when
   * cast, again when it lands); the Flue was tuned that way at its tier 11, so ashDamage keeps that hit there
   * (70 x 1.12^10, about 217 before tier) and now scales once, like every other telegraph, at other tiers.
   * 24 Nov 2026: halved to 35 x 1.12^10 (about 109). At 217 one circle landed for 145-180% of max health at t11, so a
   * single forgotten circle killed any hero, tank included; with average mistakes Ash Fall and Summons won 31 and 17
   * of 80 against Tithe's 80. At 109 a hit is 73-90% of max health and they win 58 and 48 (skills; docs/design/variety.md).
   */
  ashEvery: 12, ashCast: 1.5, ashRadius: 70, ashDamage: 35 * Math.pow(1.12, 10),
  /** Abdication (phase 3): a party-wide burn every `officeEvery` s, growing `officeGrow` a pulse. */
  officeEvery: 3, officeDamage: 0.025, officeGrow: 0.04,
  hardEnrage: 480, lastWordCast: 5,
};

export const COLO = {
  phase2: 0.6, phase3: 0.3,
  /** Front and back: within `frontArc` of his facing is plated, past `backArc` is his open back. */
  frontMult: 0.5, backMult: 1.5, frontArc: Math.PI / 2, backArc: (2 * Math.PI) / 3,
  /** How fast he turns toward his target, radians a second. */
  turnRate: 1.6,
  sweepEvery: 10, firstSweep: 5, sweepCast: 1.5, sweepRange: 200, sweepArc: 90, sweepDamage: 40,
  wheelEvery: 16, firstWheel: 3, wheelCast: 2, wheelWindow: 8,
  meltEvery: 3, meltDamage: 0.03, meltGrow: 0.05,
  hardEnrage: 480, pourOutCast: 5,
};

export const COAL = {
  /** Phases start at these shares of his health: 2 Swallow, 3 Ember Feast. */
  phase2: 0.6, phase3: 0.25,
  /** Gorge: an interruptible channel; if it finishes he heals `gorgeHeal` of max health. */
  gorgeEvery: 12, gorgeCast: 3, gorgeHeal: 0.08, firstGorge: 6,
  /**
   * Swallow (phase 2 on): the non-tank hero who has dealt the most damage goes inside for `swallowTime` s,
   * losing `swallowTick` of max health a second (never below 1). Break the Craw at his side to get them out;
   * otherwise they are Digested (downed) when the time runs out. `crawDist` is how far from his middle the Craw sits.
   */
  swallowEvery: 18, firstSwallow: 4, swallowTime: 8, swallowTick: 0.06, crawDist: 90, spitShield: 1.5,
  /** Ember Feast (phase 3): `spillN` embers scatter `spillMin`..`spillMax` from him; he inhales any left after `emberLife` s. */
  spillEvery: 10, firstSpill: 3, spillN: 6, spillMin: 140, spillMax: 320, emberLife: 7, emberPick: 34,
  /** Each ember he eats heals him this share and makes his blows this much harder for the rest of the fight. */
  emberHeal: 0.02, emberDamage: 0.05,
  /** The hard enrage, the same as the Crucible's (Burnout reads SLAG's numbers for any raid). */
  hardEnrage: 420, lastMealCast: 5,
};

export const YSMERET = {
  /** Twin Vents: two soak circles this far either side of Ysmeret; an empty one blasts every hero. */
  ventEvery: 16, ventEnraged: 8, ventFuse: 4, ventDist: 220, ventRadius: 55, ventBlast: 70, firstVents: 8,
  /** Scatter Embers: each hero's burst costs them `scatterSelf` of max health and each other hero inside `scatterOther`. */
  /** Phase 12 healer check: scatterSelf 0.1 -> 0.12, so a party with no healer wins under 25% at tier 6 (was 39%). */
  scatterEvery: 14, scatterCast: 2.5, scatterRadius: 80, scatterSelf: 0.12, scatterOther: 0.35, firstScatter: 4,
  /** Bellow Slam: the tank hit, through dodges and shields. Lighter than Anvilfall: the tank also runs to vents. */
  bellow: 90, bellowEvery: 9, bellowCast: 1.5, firstBellow: 5,
  /** Soft enrage: vents open twice as often. */
  enrageAfter: 270,
};

/**
 * YSMERETV2 (design 25 Nov, ysmeret-v2.md): starting values. Stage 1 is today's fight, but Bellow Slam waits while her vents
 * are open (`bellowWaits`). At `split` of her health she splits into two flames `apart` px apart (inside a Lumen's heal reach,
 * 500) that share one health (what she had left x `hpMult`). Each stays within `leash` of where it landed, hits with
 * `melee` of her melee damage and casts Scatter Embers on its own timer (offset by half); only the flame on the tank Bellows
 * (`bellowEvery`). A flame with no hero within `flareR` for `flareAfter` s flares and hits every hero for YSMERET.ventBlast.
 * `split: 0` keeps stage 1 only. Tuned 25 Nov (h4b-ashvents-grid.md): hpMult 1.6, bellowEvery 12.
 */
export const YSMERETV2 = {
  bellowWaits: 1, split: 0.5, apart: 420, melee: 1, firstScatter: 3,
  hpMult: 1.6, leash: 40, flareR: 150, flareAfter: 3,
  /** A flare hits for YSMERET.ventBlast x this. */
  flareMult: 1,
  /** Stage 2: the flame holding the tank (her threat target; the first flame with no tank up) Bellow Slams every this many s (0 = none). */
  bellowEvery: 12,
};

/**
 * OSKELV2 (design 25 Nov, oskel-v2.md): starting values. Stage 2 from `stage2` of his health: the press bed carries
 * everyone `belt` a second and flips at each Downstroke (`flipWarn` s of warning first); the downstream `arc` (radians)
 * of the rim, `depth` deep, is the crush line (`crush` of max health, pushed `push` upstream, or further if the belt would carry a hero standing still back onto it in under `pushSecs`). Stage 3 from `stage3`:
 * `belt3`, no more flips. `hpMult`: his health under v2. Belt 30 and hp x0.9 are design's two levers, measured 25 Nov (see the PR).
 */
export const OSKELV2 = {
  stage2: 0.55, stage3: 0.2, belt: 30, belt3: 70, flipWarn: 1.5,
  arc: Math.PI / 2, depth: 30, crush: 0.35, push: 120, pushSecs: 2, hpMult: 0.9,
  /** 1: the Downstroke plate rides the belt (design's rule); 0 for measuring only. */
  plateRides: 1,
};

export const OSKEL = {
  /**
   * Downstroke: one soak circle `downDist` from Oskel. Everyone under it who wasn't Pressed
   * becomes Pressed for `pressed` s; a Pressed hero under it takes `crush` of max health and
   * doesn't count. `pressed` is longer than `downEvery`, so nobody takes two in a row.
   * A missed one hits every hero for `downMiss` (and spawns adds, like any missed soak). 24 Nov 2026: 70 -> 50. With average
   * mistakes a party missed a quarter of its Downstrokes (one forgotten taker is a miss), at about 40% of everyone's health
   * each, and the base party won 41 / 20 of 80 at t10 / t11 against 80 / 77 at full skill (skills; docs/design/variety.md).
   */
  downEvery: 13, downEnraged: 8, downFuse: 4, downDist: 200, downRadius: 60, downMiss: 50, firstDown: 7,
  pressed: 20, crush: 0.5,
  /** Rivets: a ring under every hero; step out. */
  rivetEvery: 9, rivetFuse: 1.6, rivetRadius: 60, rivet: 30, firstRivets: 4,
  /** Stamp: the tank hit, through dodges and shields. */
  stamp: 75, stampEvery: 10, stampCast: 2, firstStamp: 5,
  /** Soft enrage: Downstrokes come faster than Pressed wears off for a duo. */
  enrageAfter: 270,
};

/**
 * ONDRELV2 (design 25 Nov, ondrel-v2.md): starting values for the grid. Stage 2 from `stage2` of his health: each
 * Anvilfall leaves a flat patch of burning slag (radius `r`, at most `cap`; no block, walking and shots pass) that burns
 * `burn` of max health every `tick` s while a hero stands in it, until stage 3. Stage 3 from `stage3`: every patch
 * glows `glow` s, then bursts (`burstR`, `burst` scaled by tier). Anvils as blocks (the first spec) cost average
 * parties 4-16 of 80 (engineering/h4a-hammerdeep-grid.md), so design dropped them.
 */
export const ONDRELV2 = {
  stage2: 0.6, stage3: 0.15, // stage 3 from 15% (design 25 Nov: 25% -> 15%, a little more slag at no cost: 4 cells 71/45/77/80 of 80)
  r: 80, cap: 4, burn: 0.03, tick: 0.5,
  glow: 2.5, burstR: 110, burst: 45,
  /** Stage 3: his version's move comes every choirEvery x this (design 25 Nov: 1, the normal timer; 0.5 measured too hard). */
  lastChoir: 1,
  /** His health under ONDRELV2 only, x this (design 25 Nov: the stage costs a number; -15% is the smaller cut that passed all 4 cells). */
  hpMult: 0.85,
};

export const ONDREL = {
  /** Anvilfall: the tank-buster on the threat target, through dodges and shields. */
  anvil: 160, anvilEvery: 12, anvilCast: 2.5, firstAnvil: 6,
  /**
   * Sundered: the next Anvilfall within this long hits harder. Shorter than
   * `anvilEvery`, so it only bites once the boss enrages (Anvilfall every
   * `anvilEnraged` s): then the tank needs a cooldown or a taunt swap.
   */
  sunderTime: 8, sunderMult: 1.5, anvilEnraged: 7,
  /**
   * Hammer Sweep: a frontal cone at the target between Anvilfalls. Telegraphs scale by tier as they land. Before Phase 12 the 14 here was scaled twice
   * (once when made), so 25 keeps tier 6 where it was (14 x 1.12^5 = 24.7).
   */
  sweepEvery: 5, sweepCast: 1.1, sweepRange: 230, sweepArc: 70, sweepDamage: 25,
  /** Choir of Iron: every hero loses this share of max health, growing each time. */
  choir: 0.12, choirGrow: 0.02, choirEvery: 10, choirCast: 1.5, firstChoir: 9,
  /** Slag Grip: a melee hit that stacks a burn (share of max health per second per stack). */
  gripEvery: 2.5, gripReach: 30, slagTick: 0.01, slagMax: 5,
  /** Soft enrage: the Choir comes twice as often. */
  enrageAfter: 240,
};

const ACOLYTE_RING = 190;
/**
 * Acolytes channel Kindle into their ward: `heal` of its health per second,
 * until they die. Three interactive versions were tried and dropped, because
 * each cost the Duskblade Kiln wins at tier 6 (see docs/design/balance.md):
 * a Quenchable Kindle cast, a cast that heavy hits break, and a channel that
 * heavy hits stagger.
 */
export const ACOLYTE = { heal: 0.008 };

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function cellKey(cx: number, cy: number): number {
  return (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663)) & (HASH_SIZE - 1);
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function segDist2(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / len2));
  return dist2(px, py, x1 + vx * t, y1 + vy * t);
}
export { HEAT_TUNING }; // tools' TUNE=HEAT_TUNING.x=y reaches the Heat numbers
export { NAMED }; // tools' TUNE=NAMED.x=y reaches the named-foe numbers
