/**
 * The shared simulation. Pure TypeScript with no rendering or browser code, so
 * the same file can run in the player's browser (alpha) and on an
 * authoritative game server (co-op, beta).
 *
 * Determinism rules: fixed time step, every random number comes from `rng`,
 * no Date/Math.random/performance calls in here.
 */
import { Rng } from './rng';
import { fillLootShare } from './content/botfill';
import { NAMED, NAMED_TITLES, AFFIXES, Affix } from './content/named';
import { keyScale } from './content/keys';
import { ENEMIES, EnemyDef, EnemyKind } from './content/enemies';
import { ABILITIES, AbilityDef, Branch, CAPSTONE_RANKS, GCD, MAX_HEAT, TALENTS, TalentDef, TalentId, ClassId, Situation } from './content/emberwright';
import { ALT_ABILITIES, CLASSES, ClassDef } from './content/classes';
import { Loadout, PassiveId, itemScore, loadoutFrom, rollDrop } from './hero';
import { Item, Rarity } from './content/items';
import { QUESTS, QuestId } from './content/quests';
import { BOUNTY } from './content/bounty';
import { FIRST_DELVE } from './content/firstdelve';
import { POTION, POTION_IDS, PotionId } from './content/potions';
import { SETS, SET_SLOTS, SET_TUNING, SetId, setForDungeon } from './content/sets';
import { DUNGEONS, DungeonId, ENCOUNTERS, EncounterId, GateKind, rollFork, rollRoute } from './content/dungeon';
import { OMENS, OMEN_TUNING, OmenId, omensFor } from './content/omens';
import { HEATS, HEAT_TUNING, HeatId, heatApplies } from './content/heat';
import { clampParty, partyHealth, gritMult, MAX_PARTY } from './content/scaling';
import { ThreatTable, damageThreat, dropHero, healThreat, newThreat, scaleThreat, taunt, updateTarget, THREAT } from './threat';

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
const BOSS_ENRAGE_AFTER = 150;
/**
 * Burnout (C7 stall fix): no fight can last forever. After `fight` s in a regular
 * fight, or `boss` s in a boss fight, the fire takes everything: every living hero
 * loses `ramp` of max health per second, plus `ramp` more each second it goes on,
 * through shields. `warn` s before, the HUD warns. `addCap`: a fight never holds
 * more than this many live foes (summons past it fizzle).
 */
export const BURNOUT = { fight: 240, boss: 360, warn: 30, ramp: 0.04, addCap: 150 };
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
/** Blade Guard: share of each hit the Duskblade stops from the foe it is swinging at. */
const BLADE_GUARD = 0.5;
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
  wakeRadius: 120, wakeDamage: 50, wakeStun: 1,
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
  /** Party only: a Bellows Slagbinder's damage when it has allies. */
  partyDmg: 0.7,
  /** The Flue (raid 4) is a damage race, where the Bellows' Brittle and sustain count for less: a lighter party cut there. */
  fluePartyDmg: 0.85,
};

/** Ability options (ALT_ABILITIES in content/classes.ts): tuning. */
export const ALT_KIT = {
  emberWardShare: 0.25, emberWardTime: 3, emberWardBurn: 12, emberWardBurnTime: 3,
  hamstringDamage: 55, hamstringBleed: 12, hamstringRadius: 120, hamstringTime: 4, slowNormal: 0.5, slowBig: 0.2,
  cryTime: 5, cryCut: 0.25, cryRadius: 200, cryHeal: 0.15,
  wellTime: 6, wellRadius: 90, wellHeal: 3,
  pitTime: 5, pitRadius: 80, pitDps: 10, pitSlowNormal: 0.4, pitRange: 360,
};

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
  /** Current cast ('' when not casting); shown on cast bars. */
  castId: string;
  castName: string;
  castT: number;
  castDur: number;
  interruptible: boolean;
  stunT: number;
  /** Kilnbreaker 3-piece: takes extra damage after being interrupted. */
  exposedT?: number;
  /** Slagbinder: the run time until which this foe is Brittle (takes more damage from everyone). */
  brittleUntil?: number;
  /** Hamstring and Cinder Sump: the run time until which this foe is slowed, and its speed factor. */
  slowUntil?: number;
  slowMult?: number;
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

export interface Quest {
  id: QuestId;
  progress: number;
  goal: number;
  done: boolean;
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
  /** Hammerdeep: Slag Grip stacks (an ally's heal clears them) and Sundered time left. */
  slag?: number;
  /** P1 weekly quests: casts this hero interrupted this run. */
  interrupts?: number;
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
  /** Ability option: this hero swapped one slot for its class's ALT_ABILITIES entry. */
  alt?: boolean;
  /** Muster, Glow Pool and Cinder Sump timers and positions. */
  cryUntil?: number;
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
  /** Stored extra Blink charges (Hot Heels rank 2) and the timer refilling one. */
  blinkCharges: number;
  blinkChargeT: number;
  /** Bulwark: absorb shield, its refresh timer, Anvil Skin time left, damage Anvil Skin stopped, Shield Echo timer and angle. */
  ward: number;
  wardT: number;
  bastionT: number;
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
  | { type: 'hit'; x: number; y: number; amount: number; crit: boolean; hero?: number }
  | { type: 'kill'; x: number; y: number; kind: EnemyKind }
  | { type: 'playerHurt'; amount: number; hero?: number }
  | { type: 'levelUp'; level: number; hero?: number }
  | { type: 'eliteSpawn' }
  | { type: 'bossSpawn' }
  /** C2: a named elite joined this fight, and one fell. */
  | { type: 'namedKill'; x: number; y: number; name: string }
  | { type: 'namedSpawn'; index: number; name: string; affix: Affix }
  | { type: 'bossEnrage' }
  /** C7: a fight has gone on too long (`warn`: 30 s left; otherwise the fire now takes everything). */
  | { type: 'burnout'; warn: boolean }
  | { type: 'emberTaken'; x: number; y: number }
  | { type: 'emberEaten'; x: number; y: number; fed: number }
  | { type: 'swallowed'; hero: number }
  | { type: 'digested'; hero: number }
  | { type: 'spatOut'; hero: number }
  | { type: 'wheel'; hero: number }
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
  | { type: 'slam'; x: number; y: number; r: number }
  /** V1: an Ember Spitter lobbed a fire circle from (x1, y1) to (x2, y2); an Ashbuck started down its lane. */
  | { type: 'spitLob'; index: number; x1: number; y1: number; x2: number; y2: number }
  | { type: 'charge'; index: number }
  /** V2: this fight's arena layout (not sent for an open arena), and a Kiln vent flaring at (x, y). */
  | { type: 'layout'; id: LayoutId }
  | { type: 'ventFlare'; x: number; y: number }
  /** V8: Nhevra's Emberdrift drops `n` embers; a hero picks one up. */
  | { type: 'emberDrift'; n: number }
  | { type: 'emberPick'; x: number; y: number; hero: number }
  /** V8: Maelra's Sluicetide turns; `angle` is the way the water now flows. */
  | { type: 'tideTurn'; angle: number }
  | { type: 'chest'; x: number; y: number }
  | { type: 'revive'; hero?: number; /** Co-op: the ally who picked them up (absent for a Phoenix Feather). */ by?: number }
  | { type: 'potion'; id: PotionId; x: number; y: number }
  | { type: 'ability'; slot: number; x: number; y: number; angle: number; r: number; /** The hero's ability option (ALT_ABILITIES), not the class's own. */ alt?: boolean }
  | { type: 'blink'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'dash'; x1: number; y1: number; x2: number; y2: number; dodge: boolean }
  | { type: 'swing'; x: number; y: number; angle: number; r: number; arc: number; spin: boolean }
  | { type: 'parry'; x: number; y: number }
  | { type: 'mote'; x1: number; y1: number; x2: number; y2: number }
  /** The Slagbinder's Slag Lob, from the hero to the foe it hits. */
  | { type: 'lob'; x1: number; y1: number; x2: number; y2: number }
  /** id is the cast's stable key (sound keys on it; the name is display text and may be renamed). */
  | { type: 'castStart'; index: number; id: string; name: string }
  | { type: 'cleanse'; x: number; y: number }
  | { type: 'plate'; x: number; y: number; hero: number }
  | { type: 'brittle'; x: number; y: number }
  | { type: 'slagGrip'; x: number; y: number; stacks: number }
  | { type: 'interrupt'; x: number; y: number; name: string }
  | { type: 'dodge'; x: number; y: number; healed: number }
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
  | { type: 'quest'; index: number }
  | { type: 'encounterStart'; index: number; id: EncounterId }
  | { type: 'encounterClear'; index: number; id: EncounterId }
  | { type: 'end'; victory: boolean };

export type SimState = 'running' | 'draft' | 'ended';

export interface DraftOption {
  id: TalentId;
  nextRank: number;
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
  /** Ability option for this run (ALT_ABILITIES). */
  alt?: boolean;
  gear?: Item[];
  passives?: Partial<Record<PassiveId, number>>;
  name?: string;
  /** Co-op: the potion this party member brewed (the lead hero's comes from WorldOptions.potion). */
  potion?: PotionId;
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
  passives: Partial<Record<PassiveId, number>>;
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
  passives?: Partial<Record<PassiveId, number>>;
  /** Hero level, which sets the item level of drops. */
  heroLevel?: number;
  /** First free item id, so run drops never collide with the hero's bag. */
  nextItemId?: number;
  /** Which quests to offer (none by default in the dungeon). */
  quests?: QuestId[];
  /** Fixed encounter route; rolled from the seed when left out. */
  route?: EncounterId[];
  /** Difficulty tier, 1 and up. Higher tiers hit harder and drop better loot. */
  tier?: number;
  /** Which class the hero plays this run. */
  cls?: ClassId;
  /** Slagbinder stance for this run (default Bellows). */
  stance?: Stance;
  /** Ability option for this run (ALT_ABILITIES): swaps one action-bar slot. */
  alt?: boolean;
  /** Week number for the Omen rotation (the client passes it; the sim never reads the clock). */
  week?: number;
  /** P2 season track: the day number (dayOf in bounty.ts), for the first win of the day. */
  day?: number;
  /** V4: today's Heat (heatFor in content/heat.ts). The sim keeps it only where it applies (heatApplies, not the first delve, a bounty or a key run). */
  heat?: HeatId;
  /** Fixed Omens, overriding the weekly rotation (tests and tools). */
  omens?: OmenId[];
  /** The living world boss's Omen: added to every delve on top of the tier's Omens, for extra luck. */
  bossOmen?: OmenId;
  /** Name of the living world boss; when set, a won delve offers a bonus fight against its shadow. */
  worldBoss?: string;
  /** Which dungeon to delve (default the Kiln Depths). */
  dungeon?: DungeonId;
  /** The potion brewed for this delve, if any (R8 Alchemy). */
  potion?: PotionId;
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
  questsDone?: number;
  omens?: OmenId[];
  paths?: GateKind[];
  dungeon?: DungeonId;
  /** Day number when this was a daily bounty. */
  bounty?: number;
  /** Fights cleared before the run ended (a run that clears none earns no chest). */
  fightsCleared?: number;
  /** P3: the key level, for a Delver's Key run. */
  keyLevel?: number;
  /** P1 weekly quests: the week, this hero's interrupts, and named elites the party felled. */
  week?: number;
  /** P2: the day the run was played (first win of the day). */
  day?: number;
  interrupts?: number;
  namedKills?: number;
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
  passives: Partial<Record<PassiveId, number>>;
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
  /** The lead hero's potion for this delve; `potionUsed` once their Rising Draught has fired. */
  readonly potion: PotionId | undefined;
  get potionUsed(): boolean { return this.potionSpent[0]; }
  /** Each hero's potion, by hero index (0 is `potion`), and whether their Rising Draught has fired. */
  private readonly potions: (PotionId | undefined)[] = [];
  private readonly potionSpent: boolean[] = [];
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
  readonly partySize: number;
  readonly grit: number;
  /** Current arena radius (Maelra's Rising Water shrinks it). */
  arenaR = ARENA;
  /** V2 (variety): this fight's arena layout, and its pieces (empty when the layout doesn't use them). */
  layout: LayoutId = 'open';
  /** V3: the Kiln Mother's signature from phase 2 this run ('' until she rises). */
  bossVariant: KilnVariant | MaelraVariant | LensVariant | NhevraVariant | HessaVariant | OndrelVariant | YsmeretVariant | OskelVariant | SlagVariant | VorhulmVariant | ColossusVariant | RegentVariant | '' = '';
  /** Phase 12 W3: Grandmother Slag's cooling islands in the Brimming (her phase 2, `brim` version); `t` is seconds until it sinks. */
  islands: { x: number; y: number; t: number }[] = [];
  private islandN = 0;
  /** Phase 12 W3: how many Banked Coals Old Vorhulm has laid (turns where they land). */
  private bankN = 0;
  /** Phase 12 W2: how many Die Cuts Oskel has made this fight (turns the side). */
  cutCount = 0;
  /** V8 Emberdrift: embers on the floor that refill a coal. */
  driftEmbers: { x: number; y: number }[] = [];
  private driftT = 0;
  private driftN = 0;
  /** V8 Sluicetide: the way the water flows (radians), while it runs. */
  tideAngle = 0;
  private sluiceT = 0;
  private tideTurns = 0;
  /** V4: the Day's Heat on this run, or '' for none. */
  heat: HeatId | '' = '';
  /** Standing stones: they block heroes and foes alike. */
  stones: { x: number; y: number; r: number }[] = [];
  /** Lava channels: a strip from (x1, y1) to (x2, y2), `w` wide, that burns a hero standing in it. */
  lava: { x1: number; y1: number; x2: number; y2: number; w: number }[] = [];
  /** Kiln vents: they flare one at a time, in turn. */
  flareVents: { x: number; y: number }[] = [];
  private flareT = 0;
  private flareK = 0;
  /** Maelra's steam vents (empty in other fights). */
  vents: { x: number; y: number; r: number }[] = [];
  /** Maelra's Temper stacks: each cuts her damage taken. */
  temper = 0;
  /** Glarewell stone pillars around the central lens; each casts a shadow wedge outward. Empty elsewhere. */
  pillars: { x: number; y: number; r: number; cracked: boolean }[] = [];
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
  /** Phase 12 W3 (the Regent's Summons): seconds until the Summons lands, 0 when none is called. */
  summonsT = 0;
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
  /** C2: the fight (encounter index) that hides this delve's named elite; -2 until rolled, -1 for none. */
  private namedAt = -2;
  /** Named elites felled this run (the whole party's). */
  namedKills = 0;
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
  quests: Quest[] = [];
  rareSpawned = false;
  rareIndex = -1;
  riftsOpened = 0;
  bossPhase = 1;
  private brandT = 4;
  private nextVeinAt = 20;
  /** The dungeon: the route of fights, which one is next, and where we are in it. */
  route: EncounterId[] = [];
  encounter = 0;
  phase: 'intro' | 'fight' | 'cleared' | 'choose' = 'intro';
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
  /** Seconds until the next undertow warning starts. */
  private tideClockT = 0;
  /** Seconds left of the Ebb's warning (>0 while warning), then of the pull itself. */
  ebbWarnT = 0;
  ebbT = 0;
  /** Hessa: phase 2 (Riptide) from WRACK.phase2, and her clocks. */
  wrackPhase = 1;
  private sinkT = 0;
  private shoalT = 0;
  events: SimEvent[] = [];
  aliveEnemies = 0;
  /** When the current fight started (Burnout counts from here). */
  private fightStartedAt = 0;
  private burnoutWarned = false;
  private burnoutTickT = 0;
  private burnoutOn = false;

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
    // Potions are for your own delves; the daily bounty is the same run for everyone.
    this.potion = opts.bounty === undefined ? opts.potion : undefined;
    this.bounty = opts.bounty;
    this.keyLevel = opts.keyLevel ?? 0;
    ({ hp: this.keyHp, dmg: this.keyDmg } = keyScale(this.keyLevel));
    this.firstClear = !!opts.firstClear && opts.bounty === undefined;
    this.fillBots = opts.fillBots ?? 0;
    this.partySize = clampParty(opts.partySize ?? 1 + Math.min(MAX_PARTY - 1, opts.party?.length ?? 0));
    this.firstDelve = !!opts.firstDelve && this.dungeonId === 'kiln' && this.tier === 1 && opts.bounty === undefined && !this.keyLevel && this.partySize === 1;
    if (this.firstDelve) {
      this.keyHp *= FIRST_DELVE.hp;
      this.keyDmg *= FIRST_DELVE.dmg;
    }
    this.grit = Math.max(0, Math.floor(opts.grit ?? 0));
    this.heat = opts.heat && HEATS[opts.heat] && heatApplies(this.dungeonId, this.tier) && !this.firstDelve && !this.stress
      && opts.bounty === undefined && !opts.keyLevel ? opts.heat : '';
    const omens = opts.omens ?? (this.stress ? [] : omensFor(this.tier, opts.week ?? 0));
    const bossOmen = opts.bossOmen && OMENS[opts.bossOmen] && !this.stress ? opts.bossOmen : undefined;
    this.bossOmen = bossOmen && !omens.includes(bossOmen) ? bossOmen : undefined;
    this.omens = this.bossOmen ? [...omens, this.bossOmen] : omens;
    // The boss's Omen always pays its bonus, even when the tier already rolled that Omen.
    this.luck = (1 + 0.12 * (this.tier - 1)) * (1 + OMEN_TUNING.luckPerOmen * this.omens.length) * (bossOmen ? 1 + OMEN_TUNING.bossOmenLuck : 1)
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
    if (opts.alt) this.player.alt = true;
    if (this.cls === 'slagbinder') {
      this.player.stance = opts.stance ?? 'bellows';
      if (this.player.stance === 'anvil') { this.player.maxHp += SLAG_KIT.anvilHp; this.player.hp = this.player.maxHp; }
    }
    this.enemies = pool(CAP.enemies, () => ({
      alive: false, kind: 'ashling' as EnemyKind, def: ENEMIES.ashling,
      x: 0, y: 0, px: 0, py: 0, hp: 0, maxHp: 0, touchCd: 0, orbitCd: 0,
      burnDps: 0, burnT: 0, woundT: 0, flash: 0, abilityT: 0, spawnedAt: 0,
      castId: '', castName: '', castT: 0, castDur: 0, interruptible: false, stunT: 0, aux: 0, aux2: 0, ward: 0, warded: false, named: -1, affix: 0,
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
    const ids = opts.quests ?? [];
    this.quests = ids.map((id) => ({ id, progress: 0, goal: QUESTS[id].goal, done: false }));
    this.route = opts.route ?? (this.firstDelve ? [...FIRST_DELVE.route] : rollRoute((n) => this.rng.int(n), this.dungeonId));
    if (this.bounty !== undefined) {
      // A bounty skips the two openers, so the hero starts with the two levels (and drafts) they would have earned.
      this.player.level += BOUNTY.headStart;
      this.player.pendingLevels += BOUNTY.headStart;
      this.player.xpToNext = xpFor(this.player.level);
    }
    if (this.potion === 'kindling') {
      // Kindling Brew: one level (and one talent pick) before the first fight.
      this.player.level += 1;
      this.player.pendingLevels += 1;
      this.player.xpToNext = xpFor(this.player.level);
    }
    this.strikes = pool(CAP.strikes, () => ({ alive: false, x: 0, y: 0, r: 0, t: 0, dmg: 0 }));
    this.lances = pool(CAP.lances, () => ({ alive: false, x1: 0, y1: 0, x2: 0, y2: 0, life: 0 }));
    this.heroes.push(this.saveSlot('h0', opts.heroName ?? 'Hero'));
    const extra = (opts.party ?? []).slice(0, MAX_PARTY - 1);
    this.potions.push(this.potion);
    extra.forEach((h, k) => {
      this.heroes.push(this.makeHero(h, k + 1, opts));
      this.potions.push(opts.bounty === undefined && h.potion && POTION_IDS.includes(h.potion) ? h.potion : undefined);
    });
    for (let i = 0; i < this.heroes.length; i++) {
      this.potionSpent.push(false);
      // Kindling Brew on a party member: one level (and one pick) before the first fight, as for the lead hero.
      if (i > 0 && this.potions[i] === 'kindling') {
        const p = this.heroes[i].player;
        p.level += 1;
        p.pendingLevels += 1;
        p.xpToNext = xpFor(p.level);
      }
    }
    if (this.heroes.length > 1) this.threat = this.enemies.map(() => newThreat());
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
    player.stance = cls === 'slagbinder' ? h.stance ?? 'bellows' : undefined;
    player.alt = h.alt ? true : undefined;
    if (player.stance === 'anvil') { player.maxHp += SLAG_KIT.anvilHp; player.hp = player.maxHp; }
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
    if (this.cls === 'slagbinder') return this.player.stance === 'anvil' ? THREAT.tankMult : SLAG_KIT.bellowsThreat;
    return 1;
  }

  get dmgMult(): number {
    // Small growth per level keeps damage in step with the horde's health.
    const p = this.player;
    // Vengeance: the Bulwark hits harder the more hurt it is.
    const missing = Math.floor(Math.max(0, 1 - p.hp / p.maxHp) * 10);
    const vengeance = 1 + 0.04 * this.rank('vengeance') * missing;
    const kindled = this.time < (p.kindleUntil ?? -1) ? GROUP_TOOLS.kindleMult : 1;
    const plated = (p.plate ?? 0) > 0 && (p.plateUntil ?? -1) > this.time;
    const clinker = (this.rank('clinkerHeart') > 0 && plated ? DEFENCE_BRANCH.clinkerDmg : 0) + (this.rank('twinPour') > 0 && plated ? DEFENCE_BRANCH.twinDmg : 0);
    const guard = (1 + DEFENCE_BRANCH.skinDmg * this.rank('cinderSkin') + DEFENCE_BRANCH.mendDmg * this.rank('mend') + DEFENCE_BRANCH.groundDmg * this.rank('kindledGround') + DEFENCE_BRANCH.graceDmg * (this.rank('renewal') + this.rank('aegisOfLight'))) * (1 + clinker);
    const party = this.cls === 'slagbinder' && p.stance !== 'anvil' && this.heroes.length > 1 ? (this.dungeonId === 'flue' ? SLAG_KIT.fluePartyDmg : SLAG_KIT.partyDmg) : 1;
    return party * guard * (1 + 0.1 * this.rank('stoke')) * (1 + 0.03 * (p.level - 1)) * this.loadout.dmgMult * vengeance * gritMult(this.grit) * kindled;
  }
  get volleyCooldown(): number {
    return (0.9 * Math.pow(0.86, this.rank('quickcast'))) / this.loadout.hasteMult;
  }
  get orbCount(): number {
    return 1 + this.rank('extraOrb');
  }
  get critChance(): number {
    return 0.05 + 0.12 * (this.rank('searingFocus') + this.rank('precision')) + 0.08 * this.rank('brightWick') + this.loadout.critBonus;
  }
  get pickupRadius(): number {
    return 80 * (1 + 0.4 * (this.rank('magnetism') + this.rank('nimble'))) * this.loadout.pickupMult;
  }
  get moveSpeed(): number {
    const boost = (this.player.hasteT > 0 ? 1.3 : 1) * (1 + 0.05 * this.rank('momentum'));
    const chill = this.player.chill ? 1 - COLD.chillSlow * this.player.chill : 1;
    return this.classDef.speed * (1 + 0.06 * this.rank('magnetism') + 0.07 * this.rank('nimble')) * this.loadout.speedMult * boost * chill;
  }
  get regen(): number {
    const low = this.player.hp < this.player.maxHp * 0.5 ? 4 * this.rank('slowPulse') + 3 * this.rank('bankedFire') + 3 * this.rank('quietMend') : 0;
    // Close Warmth (party card): an Emberwright that took it warms the heroes around it.
    const warm = this.heroes.length > 1 ? PARTY_CARDS.warmRegen * this.allyRank('closeWarmth', this.player, PARTY_CARDS.warmRadius) : 0;
    return 0.8 * this.rank('mend') + 1 * this.rank('secondWind') + 1 * this.rank('renewal') + low + warm;
  }
  get abilities(): AbilityDef[] {
    if (!this.player.alt) return this.classDef.abilities;
    const a = ALT_ABILITIES[this.cls];
    return this.classDef.abilities.map((d, k) => (k === a.slot ? a.def : d));
  }

  /** Whether `slot` holds this hero's ability option instead of the class's own ability. */
  isAlt(slot: number): boolean {
    return !!this.player.alt && ALT_ABILITIES[this.cls].slot === slot;
  }

  /** Resource cost of an action-bar slot after talents. */
  abilityCost(slot: number): number {
    if (this.isAlt(slot)) return ALT_ABILITIES[this.cls].def.cost;
    if (this.cls === 'emberwright' && slot === 0) return ABILITIES[0].cost - 6 * this.rank('rollingInferno');
    if (this.cls === 'duskblade' && slot === 0 && this.rank('flurryStep') >= 2) return this.abilities[0].cost - 10;
    return this.abilities[slot]?.cost ?? 0;
  }

  abilityCooldown(slot: number): number {
    const cd = this.baseCooldown(slot);
    // Stillwater Tonic: the interrupt comes back faster all delve.
    return slot === 3 && this.potions[this.acting] === 'stillwater' ? cd * POTION.stillwaterCd : cd;
  }

  private baseCooldown(slot: number): number {
    const base = this.abilities[slot]?.cooldown ?? 0;
    if (this.isAlt(slot)) return base;
    if (this.cls === 'slagbinder') {
      if (slot === 0) return base - this.rank('quickset');
      if (slot === 2) return base + (this.hasMythic('clinkerCrown') ? 4 : 0);
      return base;
    }
    if (this.cls === 'bulwark') {
      if (slot === 1) return base - 2 * this.rank('momentum');
      return base;
    }
    if (this.cls === 'duskblade') {
      if (slot === 0) return base - 1 * this.rank('deepCuts');
      if (slot === 1) return base - 1.5 * this.rank('evasion') - (this.hasMythic('mirrorstep') ? 2 : 0);
      if (slot === 2) return base - 3 * this.rank('momentumFlow');
      return base;
    }
    if (this.cls === 'lumen' && slot === 0) return base - 0.5 * this.rank('daybreakPulse');
    if (this.cls === 'emberwright' && slot === 1) return (base - 1.5 * this.rank('flicker')) * (this.hasMythic('wanderersWake') ? 0.5 : 1);
    if (slot === 1) return base - 1.5 * this.rank('flicker');
    if (slot === 2) return base - 3 * this.rank('heatSink') - 3 * this.rank('fastFuse');
    return base;
  }

  /** Whether the slot can be used right now (ignores whether a target exists). */
  canCast(slot: number): boolean {
    const p = this.player;
    const def = this.abilities[slot];
    if (!def) return false;
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
      this.updateDrops();
      this.updateVeins(dt);
      this.updateGems(dt);
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
    this.eachHero(() => this.updateDrops());
    this.updatePartyVeins(dt);
    this.updatePartyGems(dt);
    this.updateRevives(dt);
    this.checkEnd();
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
      this.applyTalent(opt.id);
      this.player.pendingLevels--;
      this.choices = [];
      if (this.player.pendingLevels > 0) this.openDraft();
      else this.state = 'running';
      return;
    }
    this.use(hero);
    const opt = this.choices[index];
    if (opt) {
      this.applyTalent(opt.id);
      this.player.pendingLevels--;
      this.choices = [];
    }
    this.use(0);
    // Deal the next cards to anyone with picks left, including a hero who levelled
    // on the same tick the draft opened. The run resumes once nobody has cards.
    this.openDraftAll();
    if (this.heroes.every((_, i) => this.choicesOf(i).length === 0)) this.state = 'running';
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
      time: this.time,
      kills: this.kills,
      level: this.player.level,
      damageDealt: Math.round(this.damageDealt),
      shadowDamage: Math.round(this.shadowDamage),
      shadowTime: this.shadowStart >= 0 ? Math.round(Math.min(SHADOW_TIME, this.time - this.shadowStart))
        : this.raidStart >= 0 ? Math.round(this.time - this.raidStart) : 0,
      talents: { ...this.talents },
      questsDone: this.quests.filter((q) => q.done).length,
      week: this.week,
      ...(this.day !== undefined ? { day: this.day } : {}),
      ...(this.keyLevel ? { keyLevel: this.keyLevel } : {}),
      interrupts: this.player.interrupts ?? 0,
      namedKills: this.namedKills,
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
    if (this.phase === 'fight' && this.pillars.length) this.runGlarewell(dt);
    if (this.phase === 'fight' && this.layout !== 'open') this.layoutClock(dt);
    if (this.phase === 'fight' && this.dungeonId === 'hammerdeep') this.ondrelClock(dt);
    if (this.phase === 'fight' && this.dungeonId === 'ashvents') this.ysmeretClock(dt);
    if (this.phase === 'fight' && this.dungeonId === 'pressworks') this.oskelClock(dt);
    if (this.phase === 'fight' && this.dungeonId === 'coldmarrow') this.coldClock(dt);
    if (this.phase === 'fight' && this.dungeonId === 'wrackline') this.wrackClock(dt);
    if (this.phase === 'fight' && this.dungeonId === 'crucible') this.slagClock(dt);
    if (this.phase === 'fight' && this.dungeonId === 'hoard') this.coalClock(dt);
    if (this.phase === 'fight' && this.dungeonId === 'smeltery') this.colossusClock(dt);
    if (this.phase === 'fight' && this.dungeonId === 'flue') this.regentClock(dt);
    if (this.phase === 'fight' && this.aliveEnemies > 0 && !this.victory) this.burnoutClock(dt);
    if (this.phase === 'fight' && this.aliveEnemies === 0 && (!this.victory || this.shadowPending)) this.clearEncounter();
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

  /**
   * C2: about half of all delves hide one named elite in a fight before the boss.
   * Rolled on its own stream, so a delve's other rolls don't move.
   */
  private rollNamed(elite: number): void {
    if (this.stress || this.route.length < 2) return;
    if (this.namedAt === -2) {
      const r = new Rng((this.seed ^ 0x6e616d65) >>> 0);
      const fights = this.route.length - 1; // never the boss fight
      this.namedAt = r.chance(NAMED.chance) ? r.int(fights) : -1;
      this.namedTitle = r.int(NAMED_TITLES.length);
      this.namedAffix = r.int(AFFIXES.length);
    }
    if (this.encounter !== this.namedAt) return;
    if (elite < 0) {
      // A fight with no elite in it (a shrine): the next fight before the boss gets it.
      this.namedAt = this.encounter + 1 < this.route.length - 1 ? this.encounter + 1 : -1;
      return;
    }
    const e = this.enemies[elite];
    e.named = this.namedTitle;
    e.affix = this.namedAffix;
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

  /** Burnout: the hard limit on any fight (see BURNOUT). */
  private burnoutClock(dt: number): void {
    // The raid boss has her own hard enrage (Last Ember), so Burnout only backs it up.
    const bossLimit = this.dungeonDef.raid ? SLAG.hardEnrage + SLAG.lastEmberCast + BURNOUT.warn : BURNOUT.boss;
    const limit = this.fightStartedAt + (this.encounterDef.id === this.dungeonDef.boss ? bossLimit : BURNOUT.fight);
    if (!this.burnoutWarned && this.time >= limit - BURNOUT.warn) {
      this.burnoutWarned = true;
      this.events.push({ type: 'burnout', warn: true });
    }
    if (this.time < limit) return;
    this.burnoutTickT -= dt;
    if (this.burnoutTickT > 0) return;
    // The first tick lands as soon as the limit passes, then one a second.
    if (!this.burnoutOn) {
      this.burnoutOn = true;
      this.events.push({ type: 'burnout', warn: false });
    }
    this.burnoutTickT += 1;
    const share = BURNOUT.ramp * (1 + Math.floor(this.time - limit));
    const at = this.acting;
    this.eachHero(() => {
      const p = this.player;
      p.hp -= p.maxHp * share;
      if (p.hp < 0) p.hp = 0;
    });
    this.use(at);
  }

  private startEncounter(): void {
    const def = this.encounterDef;
    this.phase = 'fight';
    this.fightStartedAt = this.time;
    if (this.dungeonId === 'coldmarrow') {
      // Every fight starts with a full Hearthcoal and no Chill.
      for (let k = 0; k < this.heroes.length; k++) {
        const q = this.heroPlayer(k);
        q.coal = 1;
        q.coalR = COLD.maxR;
        q.chill = 0;
        q.chillT = 0;
      }
    }
    if (this.dungeonId === 'wrackline') {
      // Fresh rafts every fight, spread round their circles; the first pull comes after a breather.
      // Phase 12 W1: every fight but Hessa's rolls its currents from the seed (which way each raft drifts,
      // and where they start), so the quay plays differently from fight to fight.
      const cur = this.rollCurrents(def.id);
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
    this.burnoutWarned = false;
    this.burnoutTickT = 0;
    this.burnoutOn = false;
    this.player.haloUsed = false;
    this.player.windUsed = false;
    const p = this.player;
    // Glarewell: fresh pillars every fight (a cracked pillar only stays down for that fight).
    this.pillars = this.dungeonId === 'glarewell'
      ? [0, 1, 2, 3].map((k) => {
        const a = Math.PI / 4 + (k * Math.PI) / 2;
        return { x: Math.cos(a) * GLARE.pillarRing, y: Math.sin(a) * GLARE.pillarRing, r: GLARE.pillarRadius, cracked: false };
      })
      : [];
    this.rollLayout(def.id);
    this.markT = 0;
    this.markQueued = 0;
    this.lampBeam = null;
    // Enter from the far side of the arena.
    const base = Math.atan2(-p.y, -p.x) + this.rng.range(-0.6, 0.6);
    const n = def.spawns.reduce((a, s) => a + s.n, 0);
    let k = 0;
    let lead = -1;
    let firstElite = -1;
    for (const sp of def.spawns) {
      for (let j = 0; j < sp.n; j++, k++) {
        const a = base + (k - (n - 1) / 2) * 0.35;
        const r = this.arenaR - 60;
        const i = this.spawn(sp.kind, Math.cos(a) * r, Math.sin(a) * r);
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
          this.events.push({ type: 'bossSpawn' });
        }
        // Wardens take turns mirroring, so one Quench can answer each Mirror Ward.
        if (sp.kind === 'glassWarden') e.abilityT = 3 + j * 2.5;
        if (sp.kind === 'maelra') {
          this.bossSpawned = true;
          this.bossIndex = i;
          this.startMaelra();
          this.bossVariant = this.rollMaelraVariant();
          this.events.push({ type: 'bossSpawn' });
        }
        if (sp.kind === 'lensmother') {
          this.bossSpawned = true;
          this.bossIndex = i;
          this.glareT = 6;
          this.bossBrandT = 4;
          this.crackT = GLARE.crackEvery;
          this.bossVariant = this.rollLensVariant();
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
          this.bossVariant = this.rollOndrelVariant();
          this.gripT = 0;
          this.slagTickT = 1;
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
          this.islands = [];
          this.islandN = 0;
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
          this.bossVariant = this.rollColossusVariant();
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
          this.bankN = 0;
          this.events.push({ type: 'bossSpawn' });
        }
        if (sp.kind === 'hoarfrostWeaver') e.abilityT = 3;
        if (sp.kind === 'ysmeret') {
          this.bossSpawned = true;
          this.bossIndex = i;
          this.twinVentT = YSMERET.firstVents;
          this.bossVariant = this.rollYsmeretVariant();
          this.scatterT = YSMERET.firstScatter;
          this.bellowT = YSMERET.firstBellow;
          this.events.push({ type: 'bossSpawn' });
        }
        if (sp.kind === 'oskel') {
          this.bossSpawned = true;
          this.bossIndex = i;
          this.downT = OSKEL.firstDown;
          this.rivetT = OSKEL.firstRivets;
          this.stampT = OSKEL.firstStamp;
          this.bossVariant = this.rollOskelVariant();
          this.cutCount = 0;
          this.events.push({ type: 'bossSpawn' });
        }
        if (sp.kind === 'lensbearer') e.abilityT = 4 + j * 3;
        if (sp.kind === 'brandkeeper') e.abilityT = 3;
        if (sp.kind === 'cinderBrute') this.eliteSpawned = true;
        if (sp.kind === 'ashmaw') { this.rareSpawned = true; this.rareIndex = i; }
      }
    }
    this.rollNamed(firstElite);
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
      // Clear bags top out at a guaranteed Rare; Epics only come from luck, first clears and bad-luck protection.
      const order: Rarity[] = ['common', 'fine', 'rare'];
      let min = this.encounter >= 3 ? 2 : this.encounter >= 2 ? 1 : 0;
      if (this.namedFight) min++;
      this.dropLoot(p.x + 40, p.y, order[Math.min(order.length - 1, min)]);
    }
  }

  private afterClear(_def: (typeof ENCOUNTERS)[EncounterId]): void {
    // Co-op: heroes who went down get back up between fights.
    if (this.heroes.length > 1) for (let i = 0; i < this.heroes.length; i++) { const hp = this.heroPlayer(i); if (hp.hp <= 0) hp.hp = hp.maxHp * 0.3; }
    this.namedFight = false;
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

  /**
   * V2 (variety): each fight in a dungeon that has layouts rolls one, from a hash of the seed and
   * the fight's place in the route, so the run's own rng is untouched. Boss fights and the first
   * delve stay open.
   */
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

  /** Phase 12 W1: is the Ebb running backwards right now (Hessa's Outsurge, from phase 2)? */
  get outsurge(): boolean {
    return this.bossVariant === 'outsurge' && this.wrackPhase >= 2 && this.bossIndex >= 0 && !!this.enemies[this.bossIndex]?.alive && this.enemies[this.bossIndex].kind === 'hessa';
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

  /** Back to Stone: the hero is within reach of a layout stone or a standing Glarewell pillar. */
  nearStone(p: Player = this.player): boolean {
    const r = SITE_CARDS.stoneRange + PLAYER_RADIUS;
    for (const c of this.stones) if (Math.hypot(p.x - c.x, p.y - c.y) - c.r <= r) return true;
    for (const c of this.pillars) if (!c.cracked && Math.hypot(p.x - c.x, p.y - c.y) - c.r <= r) return true;
    return false;
  }

  /** Slag Wade: the hero stands in a lava channel. */
  inLava(p: Player = this.player): boolean {
    for (const c of this.lava) if (segDist2(p.x, p.y, c.x1, c.y1, c.x2, c.y2) <= (c.w / 2) ** 2) return true;
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

  /** V2: lava burns whoever stands in it; Kiln vents flare in turn. */
  private layoutClock(dt: number): void {
    const at = this.acting;
    for (const c of this.lava) {
      for (let k = 0; k < this.heroes.length; k++) {
        const q = this.heroPlayer(k);
        if (q.hp <= 0 || segDist2(q.x, q.y, c.x1, c.y1, c.x2, c.y2) > (c.w / 2) ** 2) continue;
        this.use(k);
        this.hurtPlayer(this.player.maxHp * LAYOUT.lavaBurn * (1 - SITE_CARDS.wadeBurn * this.rank('slagWade')) * dt, -1, true);
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
    const d = Math.hypot(o.x, o.y);
    const max = this.arenaR - r;
    if (d > max) {
      o.x *= max / d;
      o.y *= max / d;
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
    for (const c of this.pillars) {
      if (c.cracked) continue;
      const d = Math.hypot(c.x, c.y);
      const ux = c.x / d;
      const uy = c.y / d;
      const along = x * ux + y * uy - d;
      if (along <= 0 || along > GLARE.shadowLength) continue;
      const across = Math.abs(x * uy - y * ux);
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
    if (!this.stress && this.phase === 'fight' && def.rank === 'normal' && this.aliveEnemies >= BURNOUT.addCap) return -1;
    const idx = this.enemies.findIndex((e) => !e.alive);
    if (idx < 0) return -1;
    const e = this.enemies[idx];
    const tierHp = Math.pow(1.22, this.tier - 1) * (this.stress ? 1 : partyHealth(this.partySize) * this.keyHp);
    const depth = this.stress ? 1 : def.rank === 'boss' ? 1 : 1 + 0.12 * this.encounter;
    const scale = (this.stress && def.rank === 'normal' ? 1 + this.time / 220 : depth) * tierHp;
    e.alive = true;
    e.kind = kind;
    e.def = def;
    if (this.threat.length) this.threat[idx] = newThreat();
    e.x = e.px = x;
    e.y = e.py = y;
    e.maxHp = e.hp = def.hp * scale;
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
    e.castId = '';
    e.castName = '';
    e.castT = 0;
    e.castDur = 0;
    e.interruptible = false;
    e.stunT = 0;
    e.aux = 0;
    e.aux2 = 0;
    e.ward = 0;
    e.warded = false;
    e.named = -1;
    e.affix = 0;
    this.aliveEnemies++;
    return idx;
  }

  // ---------------------------------------------------------------- player

  private updatePlayer(input: Input, dt: number): void {
    const p = this.player;
    p.px = p.x;
    p.py = p.y;
    const len = Math.hypot(input.x, input.y);
    if (len > 0.01) {
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

  /** `src` is the enemy that dealt the hit, when known (Bulwark thorns and reflects go back to it). */
  private hurtPlayer(amount: number, src = -1, unblockable = false): void {
    if (this.invulnerable || (this.player.shieldT > 0 && !unblockable)) return;
    // Swallowed: nothing outside can reach this hero (coalClock digests them).
    if ((this.player.swallowT ?? 0) > 0) return;
    const p = this.player;
    // Interpose: a Slagbinder beside this hero takes most of each direct hit, at less damage.
    // Only hits from a foe that can be blocked: never soaks, percent ticks, Ladle Burn or Slag Grip.
    if (src >= 0 && !unblockable && (p.interposeUntil ?? -1) > this.time) {
      const k = p.interposeBy ?? -1;
      if (k >= 0 && k !== this.acting && k < this.heroes.length && this.heroPlayer(k).hp > 0) {
        const moved = amount * SLAG_KIT.interposeShare;
        amount -= moved;
        const back = this.acting;
        this.use(k);
        this.hurtPlayer(moved * (1 - SLAG_KIT.interposeCut), src);
        this.use(back);
      }
    }
    // Cooling Shell: a Slagbinder's shell covers it, and in a party every hero close by.
    const ownShell = this.cls === 'slagbinder' && (p.shellUntil ?? -1) > this.time;
    if (ownShell || this.shellCovers(p)) amount *= 1 - (ownShell ? SLAG_KIT.shellCut : SLAG_KIT.allyShellCut) - (this.cls === 'slagbinder' ? 0.05 * this.rank('slowCool') : 0);
    // Steady Halo (Lumen) and Slag Scales (Slagbinder): a flat cut to every hit.
    if (this.cls === 'lumen') amount *= 1 - 0.05 * this.rank('steadyHalo');
    if (this.cls === 'slagbinder') amount *= 1 - 0.04 * this.rank('slagScales');
    if (this.cls === 'emberwright') amount *= 1 - 0.04 * this.rank('sootCloak');
    if (this.cls === 'duskblade') amount *= 1 - 0.04 * this.rank('lowStance');
    // Muster: in a party, heroes near the Bulwark take less.
    if (this.heroes.length > 1 && (p.cryUntil ?? -1) > this.time) amount *= 1 - ALT_KIT.cryCut;
    // Lee Side (party card): heroes close to a Bulwark that took it take less.
    if (this.heroes.length > 1) amount *= 1 - PARTY_CARDS.leeCut * this.allyRank('leeSide', p, PARTY_CARDS.leeRadius);
    // Ember Ward: whatever strikes the ward catches fire.
    if (src >= 0 && p.plateBy === -1 && (p.plate ?? 0) > 0 && (p.plateUntil ?? -1) > this.time && this.enemies[src]?.alive) {
      const e = this.enemies[src];
      e.burnDps = Math.max(e.burnDps, ALT_KIT.emberWardBurn * this.dmgMult);
      e.burnT = Math.max(e.burnT, ALT_KIT.emberWardBurnTime);
      e.burnBy = this.acting;
    }
    // Molten Plating and Ember Ward stop blows, not unblockable ticks (heat, cold, Ladle Pour, Slag Grip) or Glare.
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
    if (this.cls === 'duskblade' && src >= 0 && src === p.guardId) amount *= 1 - BLADE_GUARD * this.noviceAid;
    if (amount >= p.hp && this.rank('martyrsHalo') > 0 && !p.haloUsed) {
      // Martyr's Halo: the killing blow is turned aside once per fight.
      p.haloUsed = true;
      p.hp = 1;
      p.shieldT = 2;
      this.events.push({ type: 'revive', hero: this.acting });
      return;
    }
    // Solo dungeons only: in a group dungeon or the raid the party picks you up instead (potionWorksIn).
    if (amount >= p.hp && this.potions[this.acting] === 'risingDraught' && !this.potionSpent[this.acting] && this.dungeonDef.style === 'solo') {
      // Rising Draught: the hero who brewed it gets back up once, at a quarter health with a moment's shield.
      this.potionSpent[this.acting] = true;
      p.hp = p.maxHp * POTION.riseHp;
      p.shieldT = POTION.riseShield;
      this.events.push({ type: 'potion', id: 'risingDraught', x: p.x, y: p.y });
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
    p.hp -= amount;
    p.hurtFlash = 0.15;
    this.events.push({ type: 'playerHurt', amount, hero: this.acting });
    // Steady Breath: once per fight, a melee hero knocked low catches its breath.
    // Clinker Heart: knocked low, the Slagbinder's own slag sets over it.
    if (this.cls === 'slagbinder' && this.rank('clinkerHeart') > 0 && p.hp > 0 && p.hp < p.maxHp * SLAG_KIT.heartAt && this.time >= (p.heartReadyAt ?? 0)) {
      p.heartReadyAt = this.time + SLAG_KIT.heartEvery;
      this.plate(this.acting, p.maxHp * SLAG_KIT.heartShare);
    }
    if ((this.cls === 'duskblade' || this.cls === 'bulwark' || this.cls === 'slagbinder') && this.noviceAid > 0 && !p.windUsed && p.hp > 0 && p.hp < p.maxHp * 0.3) {
      p.windUsed = true;
      const healed = this.healPlayer(p.maxHp * SECOND_WIND * this.noviceAid);
      if (healed > 0) this.events.push({ type: 'heal', x: p.x, y: p.y, amount: healed });
    }
  }

  // ---------------------------------------------------------------- action bar

  private addHeat(v: number): void {
    this.player.heat = Math.min(MAX_HEAT, this.player.heat + v);
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
      this.castAlt(input);
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
    const dmg = 50 * (1 + 0.2 * this.rank('emberCarpet')) * this.dmgMult;
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

  /** The enemy Quench would interrupt right now, or -1. */
  interruptTarget(): number {
    const p = this.player;
    // The most dangerous caster first: boss, then rare, then elite.
    const weight = { boss: 0, rare: 1, elite: 2, normal: 3 };
    let best = -1;
    let bestW = Infinity;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.alive || !e.castId || !e.interruptible) continue;
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

  /** Casts this hero's ability option (ALT_ABILITIES), whichever class it is. */
  private castAlt(input: Input): void {
    const p = this.player;
    if (this.cls === 'emberwright') {
      // Ember Ward: a fire ward that stops blows; plateBy -1 marks it as not a Slagbinder's plating.
      p.plate = p.maxHp * ALT_KIT.emberWardShare;
      p.plateAmt = p.plate;
      p.plateUntil = this.time + ALT_KIT.emberWardTime;
      p.plateBy = -1;
      this.events.push({ type: 'ability', alt: true, slot: 1, x: p.x, y: p.y, angle: 0, r: 40 });
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
      this.events.push({ type: 'ability', alt: true, slot: 0, x: e.x, y: e.y, angle: 0, r });
    } else if (this.cls === 'bulwark') {
      p.cryUntil = this.time + ALT_KIT.cryTime;
      for (let k = 0; k < this.heroes.length; k++) {
        if (k === this.acting) continue;
        const a = this.heroPlayer(k);
        if (a.hp > 0 && dist2(p.x, p.y, a.x, a.y) <= ALT_KIT.cryRadius ** 2) a.cryUntil = this.time + ALT_KIT.cryTime;
      }
      this.events.push({ type: 'ability', alt: true, slot: 2, x: p.x, y: p.y, angle: 0, r: ALT_KIT.cryRadius });
    } else if (this.cls === 'lumen') {
      p.wellUntil = this.time + ALT_KIT.wellTime;
      p.wellX = p.x;
      p.wellY = p.y;
      this.events.push({ type: 'ability', alt: true, slot: 1, x: p.x, y: p.y, angle: 0, r: ALT_KIT.wellRadius });
    } else if (this.cls === 'slagbinder') {
      const t = this.bladeTarget(ALT_KIT.pitRange);
      const ang = Math.hypot(input.x, input.y) > 0.01 ? Math.atan2(input.y, input.x) : p.facing;
      const x = t >= 0 ? this.enemies[t].x : p.x + Math.cos(ang) * 120;
      const y = t >= 0 ? this.enemies[t].y : p.y + Math.sin(ang) * 120;
      p.pitUntil = this.time + ALT_KIT.pitTime;
      p.pitX = x;
      p.pitY = y;
      this.addZone(x, y, ALT_KIT.pitRadius, ALT_KIT.pitDps * this.dmgMult, ALT_KIT.pitTime);
      this.events.push({ type: 'ability', alt: true, slot: 1, x, y, angle: 0, r: ALT_KIT.pitRadius });
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
    if (!p.alt) return;
    // Ember Ward runs out (Slagbinder plating is cleared in updatePlates).
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
    return (SLAG_KIT.brittleTime + 2 * this.rank('brittleMind')) * (this.hasMythic('clinkerCrown') ? 2 : 1);
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
      const dmg = SLAG_KIT.plateBurst * (1 + 0.3 * this.rank('searingShell') + 0.1 * this.rank('wideSpatter')) * this.dmgMult;
      this.forEachNear(q.x, q.y, r + 40, (i) => {
        const e = this.enemies[i];
        if (dist2(q.x, q.y, e.x, e.y) <= (r + e.def.radius) ** 2) this.damageEnemy(i, dmg, true);
      });
      this.events.push({ type: 'explode', x: q.x, y: q.y, r });
    }
  }

  private get plateAmount(): number {
    const p = this.player;
    return p.maxHp * SLAG_KIT.plateShare * (1 + 0.2 * this.rank('thickPour') + 0.1 * this.rank('deepCoat')) * (p.stance === 'anvil' ? SLAG_KIT.anvilPlate : 1);
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
    const ally = this.heroes.length > 1 ? this.hurtAlly(SLAG_KIT.interposeRange) : -1;
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
    if (p.volleyT > 0) return;
    let t = this.bladeTarget(SLAG_KIT.lobRange);
    if (t < 0) {
      p.volleyT = 0;
      return;
    }
    if (this.bossIndex >= 0) {
      const boss = this.enemies[this.bossIndex];
      if (boss.alive && boss.def.rank === 'boss' && dist2(p.x, p.y, boss.x, boss.y) < (SLAG_KIT.lobRange + boss.def.radius) ** 2) t = this.bossIndex;
      if (this.crawIn(SLAG_KIT.lobRange) >= 0) t = this.crawIn(SLAG_KIT.lobRange);
      // As with Sunmote: an acolyte healing a wounded boss is struck first.
      if (boss.alive && boss.hp < boss.maxHp) {
        let best = (SLAG_KIT.lobRange + 40) ** 2;
        for (let i = 0; i < this.enemies.length; i++) {
          const e = this.enemies[i];
          if (!e.alive || e.kind !== 'acolyte' || e.aux2 !== this.bossIndex) continue;
          const d2 = dist2(p.x, p.y, e.x, e.y);
          if (d2 < best) { best = d2; t = i; }
        }
      }
    }
    p.volleyT += SLAG_KIT.lobEvery / this.loadout.hasteMult / (1 + 0.1 * this.rank('fastLadle'));
    if (p.volleyT < 0) p.volleyT = 0;
    p.lobs = (p.lobs ?? 0) + 1;
    const hail = this.rank('cinderHail') > 0 && p.lobs % SLAG_KIT.hailEvery === 0;
    this.lob(t);
    if (this.rank('shatterpoint') > 0 && p.lobs % SLAG_KIT.hailEvery === 0) this.makeBrittle(t);
    if (hail) {
      const e = this.enemies[t];
      for (const j of this.nearestEnemies(e.x, e.y, 3, 220)) if (j !== t && this.enemies[j].alive) this.lob(j);
      if (this.enemies[t].alive) this.lob(t);
    }
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
    if (this.cls === 'lumen') amount *= 1 + 0.1 * this.rank('lampglowCare');
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
    if (this.cls === 'lumen') amount *= 1 + 0.1 * this.rank('lampglowCare');
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
    return (0.7 * Math.pow(0.88, this.rank('hastedHymn'))) / this.loadout.hasteMult;
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
        if (dist2(p.x, p.y, p.sanctX, p.sanctY) <= r * r) this.healPlayer(2);
        this.healAllies(p.sanctX, p.sanctY, r, 2);
        this.forEachNear(p.sanctX, p.sanctY, r + 40, (i) => {
          const e = this.enemies[i];
          if (dist2(p.sanctX, p.sanctY, e.x, e.y) <= (r + e.def.radius) ** 2) this.damageEnemy(i, 10 * (1 + 0.5 * this.rank('hallowedEmbers')) * this.dmgMult, false, true);
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
      if (boss.alive && boss.def.rank === 'boss' && dist2(p.x, p.y, boss.x, boss.y) < this.lumenRange * this.lumenRange) t = this.bossIndex;
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
    const dmg = (22 * (1 + 0.15 * this.rank('searingRadiance') + 0.1 * this.rank('lanternHeart') + 0.1 * this.rank('longNote')) + bonus) * this.dmgMult;
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
    const dmg = 40 * (1 + 0.5 * this.rank('sunflare')) * this.dmgMult * (eclipse ? 1.4 : 1);
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

  private sanctuary(): void {
    const p = this.player;
    p.sanctT = (6 + 2 * this.rank('lingeringSanctuary')) * (this.hasMythic('anchoredDawn') ? 1.5 : 1);
    p.sanctX = p.x;
    p.sanctY = p.y;
    p.sanctTick = 0;
    this.events.push({ type: 'ability', slot: 2, x: p.x, y: p.y, angle: 0, r: this.sanctuaryRadius });
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
    return armor * (p.bastionT > 0 ? 0.4 : 1) * guard;
  }

  /** Armor, Anvil Skin, the Ward shield, Resolve gain, and damage turned back. Returns what gets through. */
  /**
   * Melee forgiveness for new heroes: 1 at tier 1, fading to 0 by tier 4, so the
   * first-impression tiers forgive slow reactions and the geared tiers are untouched.
   */
  get noviceAid(): number {
    return Math.max(0, 1 - (this.tier - 1) / 3);
  }

  /** Whether enemy `i` is a big foe in front of the Bulwark's shield (within 75 degrees of its last sweep). */
  private inGuardArc(i: number): boolean {
    const e = this.enemies[i];
    if (!e || e.def.rank === 'normal') return false;
    const p = this.player;
    return Math.abs(angleDiff(Math.atan2(e.y - p.y, e.x - p.x), p.guardAng)) <= (75 * Math.PI) / 180;
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
    } else if (src >= 0 && (src === p.guardId || (this.noviceAid > 0 && this.inGuardArc(src)))) amount *= 1 - BULWARK_BLOCK;
    if (p.bastionT > 0) p.prevented += raw - amount;
    if (p.ward > 0) {
      const soak = Math.min(p.ward, amount);
      p.ward -= soak;
      amount -= soak;
    }
    let back = 0;
    if (src >= 0 && this.rank('spikedShield') > 0) back += 8 * this.rank('spikedShield') * this.dmgMult;
    // Anvil Skin turns back a quarter of each hit; Thornwall turns back 15% even outside it.
    const reflect = (p.bastionT > 0 ? 0.25 : 0) + (this.rank('thornwall') > 0 ? 0.15 : 0);
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
    const dmg = 30 * this.dmgMult;
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
        this.damageEnemy(i, CAPSTONES_2.wakeDamage * this.dmgMult, true);
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
    return (0.6 * Math.pow(0.88, this.rank('quickBlades'))) / this.loadout.hasteMult / rhythm / (1 + 0.05 * this.rank('lightGrip'));
  }
  /** Open Veins: the Duskblade's bleeds hit harder. */
  get bleedMult(): number {
    return (this.rank('openVeins') > 0 ? CAPSTONES_2.veinsMult : 1) * (1 + 0.1 * this.rank('slowDrip'));
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
      if (!e.alive) continue;
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
    this.addHeat(Math.min(15, 5 * hits) * (1 + 0.3 * this.rank('momentumFlow')));
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
      if (b.alive && b.def.rank === 'boss' && dist2(p.x, p.y, b.x, b.y) < 480 * 480) targets.unshift(this.bossIndex);
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
      if (o.life <= 0) {
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
      this.addHeat(4 * (1 + 0.35 * this.rank('heatSink')));
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
      if (this.heroes.length > 1) this.use(this.targetOf(i, dt));
      const p = this.player;
      e.px = e.x;
      e.py = e.y;
      if (e.touchCd > 0) e.touchCd -= dt;
      if (e.orbitCd > 0) e.orbitCd -= dt;
      if (e.flash > 0) e.flash -= dt;

      if (e.woundT > 0) e.woundT -= dt;
      if ((e.exposedT ?? 0) > 0) e.exposedT = (e.exposedT ?? 0) - dt;
      if (e.burnT > 0) {
        e.burnT -= dt;
        this.burnTick = true;
        this.damageEnemy(i, e.burnDps * dt, false, true);
        this.burnTick = false;
        if (!e.alive) continue;
      }

      if (e.def.stationary) {
        this.runStationary(i, dt);
        continue;
      }
      if (e.stunT > 0) {
        e.stunT -= dt;
        continue;
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
      // V1: an Ember Spitter keeps its distance: it backs off when you close in and circles at range.
      if (e.kind === 'emberSpitter') {
        if (d < VARIETY.spitterNear) { mx = -mx; my = -my; }
        else if (d < VARIETY.spitterFar) { const s = i % 2 ? 0.5 : -0.5; const tx = -my * s; my = mx * s; mx = tx; }
      }
      // V1: an Ashbuck mid-charge runs straight down its lane, fast, and doesn't steer.
      if (e.kind === 'ashbuck' && e.aux2 > 0) {
        e.aux2 -= dt;
        mx = Math.cos(e.aux) * VARIETY.chargeSpeed;
        my = Math.sin(e.aux) * VARIETY.chargeSpeed;
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
      if (e.def.rank === 'normal' && d > SPAWN_RADIUS * 1.5) {
        this.relocate(e);
        continue;
      }

      e.x += mx * dt;
      e.y += my * dt;
      this.clampArena(e, e.def.radius);
      // The Wrackline: Shoal Lurkers swim; they can't climb onto a raft, so they circle its edge.
      if (e.kind === 'shoalLurker' && this.rafts.length) this.keepOffRafts(e);

      if (e.def.rank !== 'normal') this.runAbilities(i, dt);

      if (d < e.def.radius + PLAYER_RADIUS && e.touchCd <= 0) {
        e.touchCd = 0.6;
        const mult = (e.def.rank === 'boss' && this.bossEnraged ? 2.5 : 1) * (e.kind === 'vorhulm' ? 1 + COAL.emberDamage * this.coalFed : 1);
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
        b.hp = Math.min(b.maxHp, b.hp + b.maxHp * ACOLYTE.heal * dt * this.healTakenMult(b));
      }
    }
    const p = this.player;
    if (dist2(p.x, p.y, e.x, e.y) < (e.def.radius + PLAYER_RADIUS) ** 2 && e.touchCd <= 0) {
      e.touchCd = 0.6;
      this.hurtPlayer(e.def.damage * this.tierDamage, i);
    }
  }

  private startCast(i: number, id: string, name: string, dur: number, interruptible: boolean): void {
    const e = this.enemies[i];
    e.castId = id;
    e.castName = name;
    e.castT = 0;
    e.castDur = this.hasOmen('quickened') ? dur * OMEN_TUNING.quickenedCast : dur;
    e.interruptible = interruptible;
    this.events.push({ type: 'castStart', index: i, id, name });
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
    e.castId = '';
    e.castName = '';
    for (const t of this.telegraphs) if (t.alive && t.owner === i) t.owner = -1; // let it land
    if (id === 'cataclysm') {
      const p = this.player;
      this.hurtPlayer(45 * (this.bossEnraged ? 1.5 : 1) * this.tierDamage, i);
      this.events.push({ type: 'slam', x: p.x, y: p.y, r: 160 });
    } else if (id === 'charge') {
      e.aux2 = VARIETY.chargeLen / VARIETY.chargeSpeed; // run the lane it showed
      this.events.push({ type: 'charge', index: i });
    } else if (id === 'mirror') {
      e.aux2 = FOUNDRY.mirrorTime;
    } else if (id === 'rekindle') {
      // Bring the fallen twin back beside this one at half health.
      const k = this.spawn('emberTwin', e.x + 30, e.y);
      if (k >= 0) this.enemies[k].hp = this.enemies[k].maxHp * 0.5;
    } else if (id === 'undertow') {
      const p = this.player;
      p.x += (e.x - p.x) * FOUNDRY.undertowPull;
      p.y += (e.y - p.y) * FOUNDRY.undertowPull;
      this.hurtPlayer(FOUNDRY.undertowDamage * this.tierDamage);
      this.events.push({ type: 'slam', x: p.x, y: p.y, r: 60 });
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
        this.startCast(i, 'emberLob', 'Ember Lob', VARIETY.lobCast, false);
        this.addTelegraph('circle', p.x, p.y, VARIETY.lobRadius, 0, 0, VARIETY.lobLand, VARIETY.lobDamage, 'hit', i);
        this.events.push({ type: 'spitLob', index: i, x1: e.x, y1: e.y, x2: p.x, y2: p.y });
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
        e.abilityT = 4.5;
        this.startCast(i, 'slam', 'Warden Slam', 1.2, false);
        this.addTelegraph('circle', e.x, e.y, 115, 0, 0, 1.2, 24, 'hit', i);
      }
      return;
    }
    if (e.kind === 'ashmaw') {
      if (e.abilityT <= 0) {
        e.abilityT = 5;
        e.aux++;
        if (e.aux % 2 === 0) {
          this.startCast(i, 'gorge', 'Gorge', 2.2, true);
        } else {
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
    if (!this.bossEnraged && this.time - e.spawnedAt > BOSS_ENRAGE_AFTER) {
      this.bossEnraged = true;
      this.events.push({ type: 'bossEnrage' });
    }
    // The shadow can't be worn down, so its phases follow the clock instead.
    const frac = e.kind === 'worldShadow' ? 1 - (this.time - e.spawnedAt) / SHADOW_TIME : e.hp / e.maxHp;
    const phase = frac > 0.6 ? 1 : frac > 0.3 ? 2 : 3;
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
      if (phase >= 2 && this.bossVariant === 'draw') {
        // V3 Kiln Draw: she breathes in and pulls everyone toward her mouth, where the fire lands. Walk out against the pull.
        this.startCast(i, 'kilnDraw', 'Kiln Draw', KILN_DRAW.cast, false);
        this.addTelegraph('circle', e.x, e.y, KILN_DRAW.radius, 0, 0, KILN_DRAW.cast, KILN_DRAW.damage * (this.bossEnraged ? 1.5 : 1), 'hit', i);
        return;
      }
      this.startCast(i, 'cataclysm', 'Molten Cataclysm', 3, true);
      return;
    }
    // Kiln Brand: someone has to stand in the gold circle.
    if (phase >= 2) {
      this.brandT -= dt;
      if (this.brandT <= 0) {
        this.brandT = 14;
        const a = this.rng.next() * Math.PI * 2;
        this.addTelegraph('circle', p.x + Math.cos(a) * 150, p.y + Math.sin(a) * 150, 70, 0, 0, 4, 40, 'soak', -1);
      }
    }
    if (e.abilityT > 0) return;
    e.abilityT = this.bossEnraged ? 1.6 : phase === 3 ? 2.4 : 3.2;
    const roll = this.rng.int(3);
    if (roll === 0) {
      this.addTelegraph('circle', p.x, p.y, 120, 0, 0, 1.3, 35 * mult);
      if (phase === 3) {
        const a = this.rng.next() * Math.PI * 2;
        this.addTelegraph('circle', p.x + Math.cos(a) * 170, p.y + Math.sin(a) * 170, 120, 0, 0, 1.6, 35 * mult);
      }
    } else if (roll === 1) {
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      this.addTelegraph('cone', e.x, e.y, 320, ang, (70 * Math.PI) / 180, 1.1, 30 * mult);
    } else {
      const n = phase === 3 ? 10 : 7;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        this.spawn('ashling', e.x + Math.cos(a) * 260, e.y + Math.sin(a) * 260);
      }
    }
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
    let dmg = amount;
    let crit = false;
    if (e.def.rank !== 'normal' && this.hasMythic('giantsBane')) dmg *= 1.3;
    if (e.burnT > 0) dmg *= 1 + 0.1 * this.rank('hemorrhage');
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
    if (forceCrit || (canCrit && this.rng.chance(this.critChance))) {
      dmg *= 2 + 0.1 * this.rank('brightWick');
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
      this.hurtPlayer(dmg * FOUNDRY.mirrorReflect);
    }
    if (e.ward > 0) {
      const soak = Math.min(e.ward, dmg);
      e.ward -= soak;
      dmg -= soak;
    }
    e.hp -= dmg;
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
    if (thirst > 0) this.player.hp = Math.min(this.player.maxHp, this.player.hp + dmg * 0.02 * thirst);
    if (!silent) {
      e.flash = 0.08;
      this.events.push({ type: 'hit', x: e.x, y: e.y, amount: dmg, crit, hero: this.acting });
    }
    if (canCrit && this.hasMythic('splittingCinders')) {
      let other = -1;
      this.forEachNear(e.x, e.y, 70, (j) => {
        if (other < 0 && j !== i) other = j;
      });
      if (other >= 0) this.damageEnemy(other, dmg * 0.15, false, true);
    }
    if (e.hp <= 0) this.killEnemy(i);
  }

  /** Verb set damage bonuses (R4). `silent` hits (damage over time) don't spend a Tidewalker charge. */
  private setDamageMult(e: Enemy, silent: boolean): number {
    const p = this.player;
    let m = 1;
    if ((p.kbT ?? 0) > 0) m *= 1 + SET_TUNING.kbDamage;
    if ((e.exposedT ?? 0) > 0) m *= 1 + SET_TUNING.kbExposed;
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
    if (e.kind === 'emberTwin') this.twinFell();
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
    if (e.def.rank === 'boss') {
      this.victory = true;
      // The run ends on this tick (or moves to the shadow fight), so boss loot goes straight to the bags.
      // From tier 2, an Epic is guaranteed the first time you beat a tier; otherwise the boss drops Rare or better.
      // Every hero in the party gets their own boss item (not only whoever landed the
      // killing blow). Group dungeons add a second Rare-or-better item each, but only
      // for a real party: a bot-filled run pays like a solo one.
      const min: Rarity = this.firstClear && this.tier >= FIRST_CLEAR_EPIC_TIER ? 'epic' : 'rare';
      const group = this.dungeonDef.style === 'group' && this.fillBots === 0;
      const give = () => {
        this.pickUp(this.withSet(this.makeItem(min)));
        if (group) this.pickUp(this.makeItem('rare'));
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
    if (e.kind === 'cinderhound') this.progressQuest('hounds');
    if (e.kind === 'rift') {
      this.progressQuest('rifts');
      this.addHeat(20);
      this.events.push({ type: 'riftClosed', x: e.x, y: e.y });
    }
    if (e.named >= 0) {
      // A named elite: its own loot, and a Vengeful one bursts where it fell.
      const r = new Rng((this.seed ^ 0x6c6f6f74) + this.kills);
      this.dropLoot(e.x, e.y, r.chance(NAMED.epicChance) ? 'epic' : 'rare');
      if (AFFIXES[e.affix] === 'Vengeful') this.addTelegraph('circle', e.x, e.y, NAMED.burstR, 0, 0, NAMED.burstDelay, NAMED.burstDmg);
      this.namedKills++;
      this.events.push({ type: 'namedKill', x: e.x, y: e.y, name: this.namedName(i) });
    }
    if (e.kind === 'ashmaw') {
      this.progressQuest('ashmaw');
      this.dropLoot(e.x, e.y, 'rare');
    }
    if (e.kind === 'cinderBrute') this.dropLoot(e.x, e.y, 'fine');
    if (this.stress && e.def.rank === 'normal' && this.rng.chance(TRASH_DROP)) this.dropLoot(e.x, e.y, 'common');
    if (e.kind === 'cinderBrute') {
      this.eliteKilled = true;
      // Elite chest: a free bonus draft.
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
      e.abilityT = GLARE.glareEvery;
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
      if (dist2(ea.x, ea.y, eb.x, eb.y) <= GLARE.lampMaxDist ** 2) {
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
        if (dist2(this.player.x, this.player.y, x, y) <= (r + PLAYER_RADIUS) ** 2) this.hurtPlayer(GLARE.brandDamage * this.tierDamage);
      });
    } else this.hurtPlayer(GLARE.brandDamage * this.tierDamage);
    this.pillars.forEach((c, k) => {
      if (!c.cracked && dist2(p.x, p.y, c.x, c.y) <= (r + c.r) ** 2) {
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
      this.glareT = this.bossEnraged ? GLARE.bossGlareEvery * 0.6 : GLARE.bossGlareEvery;
      this.startCast(i, 'glare', 'Glare', GLARE.glareWarn, false);
      return;
    }
    if (this.bossPhase >= 2 && this.markT <= 0) {
      this.bossBrandT -= dt;
      if (this.bossBrandT <= 0) {
        this.bossBrandT = GLARE.bossBrandEvery;
        if (this.bossVariant === 'glint') {
          // V8 Glintfall: light shards fall on every standing pillar. Step off your cover until they land.
          this.startCast(i, 'glintfall', 'Glintfall', GLINTFALL.cast, false);
          for (const q of this.pillars) {
            if (!q.cracked) this.addTelegraph('circle', q.x, q.y, GLINTFALL.radius, 0, 0, GLINTFALL.cast, GLINTFALL.damage * (this.bossEnraged ? 1.5 : 1), 'hit', i);
          }
          return;
        }
        this.startCast(i, 'twinBrand', 'Twin Brand', GLARE.brandCast, false);
        return;
      }
    }
    if (e.abilityT > 0) return;
    e.abilityT = this.bossEnraged ? GLARE.sweepEveryEnraged : GLARE.sweepEvery;
    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    this.startCast(i, 'lensSweep', 'Lens Sweep', 1.1, false);
    this.addTelegraph('cone', e.x, e.y, 300, ang, (60 * Math.PI) / 180, 1.1, GLARE.sweepDamage * (this.bossEnraged ? 1.5 : 1), 'hit', i);
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
    if (e.abilityT > 0) return;
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
      const r = (q.coalR ?? COLD.maxR) + r0;
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
      const drift = this.coldPhase >= 2 && this.bossVariant === 'drift';
      q.coal = Math.max(0, q.coal - COLD.drain * (drift ? EMBERDRIFT.drainMult : 1) * dt);
      if (drift) {
        for (let n = this.driftEmbers.length - 1; n >= 0; n--) {
          const m = this.driftEmbers[n];
          if (dist2(q.x, q.y, m.x, m.y) > EMBERDRIFT.pickR * EMBERDRIFT.pickR) continue;
          q.coal = Math.min(1, q.coal + EMBERDRIFT.refill);
          this.driftEmbers.splice(n, 1);
          this.events.push({ type: 'emberPick', x: m.x, y: m.y, hero: k });
        }
      }
      q.coalR = COLD.minR + (COLD.maxR - COLD.minR) * q.coal;
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
        this.hurtPlayer(this.player.maxHp * COLD.frozenBurn * dt, -1, true);
        this.use(at);
      }
      if (this.coldPhase >= 2 && q.hp > 0 && this.inWater(q.x, q.y)) {
        // Thin Ice: open water soaks the coal, chills fast, and hurts.
        q.coal = Math.max(0, q.coal - COLD.waterDrain * dt);
        q.chill = Math.min(COLD.frozenAt, (q.chill ?? 0) + COLD.waterChill * dt);
        const at = this.acting;
        this.use(k);
        this.hurtPlayer(this.player.maxHp * COLD.waterBurn * dt, -1, true);
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
    if (this.coldPhase >= 2 && this.bossVariant === 'drift') {
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
    } else if (this.coldPhase >= 2) {
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
    }
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
    const riptide = this.wrackPhase >= 2 && !out;
    const drift = WRACK.drift * (riptide ? WRACK.riptideDrift : 1);
    for (const r of this.rafts) {
      r.a += (r.dir * drift * dt) / r.ring;
      r.x = Math.cos(r.a) * r.ring;
      r.y = Math.sin(r.a) * r.ring;
      if (r.sunkT > 0) r.sunkT = Math.max(0, r.sunkT - dt);
    }
    if (this.ebbT > 0) {
      this.ebbT = Math.max(0, this.ebbT - dt);
      const pull = WRACK.drag * (riptide ? WRACK.riptideDrag : 1);
      const foePull = WRACK.foeDrag * (riptide ? WRACK.riptideDrag : 1);
      const rim = this.arenaR - OUTSURGE.rimR;
      for (let k = 0; k < this.heroes.length; k++) {
        const q = this.heroPlayer(k);
        if (q.hp <= 0 || this.onRaft(q.x, q.y)) continue;
        const d = Math.hypot(q.x, q.y) || 1;
        // Anvil Skin anchors the Bulwark: the water still burns, but it can't drag.
        // The pull is a share of the hero's own class speed, so every class walks out of it at the same pace.
        const room = out ? Math.max(0, this.arenaR - PLAYER_RADIUS - d) : d;
        const step = this.anchored(q) ? 0 : Math.min(room, pull * CLASSES[this.heroes[k].cls].speed * dt) * (out ? -1 : 1);
        q.x -= (q.x / d) * step;
        q.y -= (q.y / d) * step;
        const share = WRACK.tideBurn + (out ? (d >= rim ? OUTSURGE.rimBurn : 0) : d <= WRACK.drainR ? WRACK.drainBurn : 0);
        const at = this.acting;
        this.use(k);
        this.hurtPlayer(this.player.maxHp * share * dt, -1, true);
        this.use(at);
      }
      // The water takes foes too: all but Lurkers and bosses drift in, and the drain hurts them.
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (!e.alive || e.def.rank === 'boss' || e.kind === 'shoalLurker' || e.def.stationary) continue;
        const d = Math.hypot(e.x, e.y) || 1;
        const step = out ? -Math.min(Math.max(0, this.arenaR - e.def.radius - d), foePull * dt) : Math.min(d, foePull * dt);
        e.x -= (e.x / d) * step;
        e.y -= (e.y / d) * step;
        if (out ? d >= rim : d <= WRACK.drainR) this.damageEnemy(i, e.maxHp * WRACK.foeDrain * dt, false, true);
      }
    } else if (this.ebbWarnT > 0) {
      this.ebbWarnT = Math.max(0, this.ebbWarnT - dt);
      if (this.ebbWarnT <= 0) this.ebbT = WRACK.tideOpen;
    } else {
      this.tideClockT -= dt;
      if (this.tideClockT <= 0) {
        this.tideClockT = boss ? (late ? WRACK.tideLate : WRACK.tideBoss) : WRACK.tideEvery;
        this.ebbWarnT = WRACK.tideWarn;
        this.events.push({ type: 'castStart', index: boss ? this.bossIndex : -1, id: 'ebb', name: out ? 'The Outsurge' : 'The Ebb' });
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
    this.twinVentT -= dt;
    this.scatterT -= dt;
    this.bellowT -= dt;
    const ventsOpen = this.telegraphs.some((t) => t.alive && t.kind === 'soak' && t.owner === -2);
    if (this.twinVentT <= 0 && !ventsOpen) {
      this.twinVentT = late ? YSMERET.ventEnraged : YSMERET.ventEvery;
      const tgt = this.heroPlayer(this.targetOf(i, 0));
      const a = Math.atan2(tgt.y - e.y, tgt.x - e.x) + Math.PI / 2;
      for (const s of [1, -1]) {
        const x = e.x + Math.cos(a) * YSMERET.ventDist * s;
        const y = e.y + Math.sin(a) * YSMERET.ventDist * s;
        const c = { x, y };
        this.clampArena(c, YSMERET.ventRadius + 10);
        // owner -2: a boss mechanic no interrupt removes.
        this.addTelegraph('circle', c.x, c.y, YSMERET.ventRadius, 0, 0, YSMERET.ventFuse, YSMERET.ventBlast, 'soak', -2);
      }
      this.events.push({ type: 'castStart', index: i, id: 'twinVents', name: this.bossVariant === 'wander' ? 'Wandering Vents' : 'Twin Vents' });
    } else if (ventsOpen && this.bossVariant === 'wander') {
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
    if (this.bellowT <= 0) {
      this.bellowT = YSMERET.bellowEvery;
      this.bellowTarget = this.targetOf(i, 0);
      this.startCast(i, 'bellowSlam', 'Bellow Slam', YSMERET.bellowCast, false);
    } else if (this.scatterT <= 0 && !ventsOpen && this.twinVentT > YSMERET.scatterCast + 0.5) {
      this.scatterT = YSMERET.scatterEvery;
      this.startCast(i, 'scatter', 'Scatter Embers', YSMERET.scatterCast, false);
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
    }
    if (this.rivetT <= 0 && this.bossVariant === 'cut') {
      // Die Cut: half the floor, split through Oskel. Away from an open plate, so its taker is safe;
      // otherwise the side turns a quarter each time.
      this.rivetT = DIECUT.every;
      const plate = this.telegraphs.find((t) => t.alive && t.kind === 'soak' && t.owner === -3);
      const a = plate ? Math.atan2(plate.y - e.y, plate.x - e.x) + Math.PI : (this.cutCount * Math.PI) / 2 + ((this.seed & 3) * Math.PI) / 2;
      this.cutCount++;
      this.addTelegraph('cone', e.x, e.y, ARENA * 2, a, Math.PI, DIECUT.fuse, DIECUT.damage, 'hit', -1); // scaled by tier as it lands
      this.events.push({ type: 'castStart', index: i, id: 'dieCut', name: 'Die Cut' });
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
        this.hurtPlayer(q.maxHp * OSKEL.crush, -1, true);
        this.events.push({ type: 'slam', x: q.x, y: q.y, r: 50 });
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
      if (phase === 3) this.islands = [];
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
        if ((p.slag ?? 0) > 0 && p.hp > 0) this.hurtPlayer(p.maxHp * SLAG.burnTick * (p.slag ?? 0), -1, true);
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
        const brim = this.bossVariant === 'brim';
        this.eachHero(() => {
          const share = brim ? (this.onIsland(this.player.x, this.player.y) ? 0 : BRIM.heat) : SLAG.heat;
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
    } else if (phase === 2 && this.pourT <= 0 && this.bossVariant === 'brim') {
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
        if (this.bossVariant === 'court') {
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
    // He turns toward the hero he is fighting, but slowly, and not while he casts.
    if (!e.castId) {
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
    this.sweepT -= dt;
    if (phase === 2) this.wheelT -= dt;
    if (phase === 2 && this.wheelT <= 0) {
      this.wheelT = COLO.wheelEvery;
      if (this.bossVariant === 'shift') this.startCast(i, 'plateShift', 'Plate Shift', COLO.wheelCast, false);
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
    if (phase === 3 && this.bossVariant === 'bank') {
      this.spillT -= dt;
      if (this.spillT <= 0) {
        // Banked Coals: hot coals settle in a ring round him; a hero standing on one as it lands smothers it.
        this.spillT = COAL.spillEvery;
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
      }
    } else if (phase === 3) {
      this.spillT -= dt;
      if (this.spillT <= 0) {
        this.spillT = COAL.spillEvery;
        for (let k = 0; k < COAL.spillN; k++) {
          const a = this.rng.range(0, Math.PI * 2);
          const r = this.rng.range(COAL.spillMin, COAL.spillMax);
          const c = { x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r };
          this.clampArena(c, 30);
          this.coalEmbers.push({ x: c.x, y: c.y, t: COAL.emberLife });
        }
        this.events.push({ type: 'castStart', index: i, id: 'emberSpill', name: 'Ember Spill' });
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

  /** Ondrel's clocks run during casts too: Anvilfall, Choir of Iron, Slag Grip ticks, Sundered. */
  private ondrelClock(dt: number): void {
    if (this.bossIndex < 0) return;
    const i = this.bossIndex;
    const e = this.enemies[i];
    if (!e || !e.alive || e.kind !== 'ondrel') return;
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
        this.choirT = late ? ONDREL.choirEvery / 2 : ONDREL.choirEvery;
        if (this.bossVariant === 'load') this.startCast(i, 'ironload', 'Ironload', ONDREL.choirCast, false);
        else this.startCast(i, 'choir', 'Choir of Iron', ONDREL.choirCast, false);
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
      if (tick && (p.slag ?? 0) > 0 && p.hp > 0) this.hurtPlayer(p.maxHp * ONDREL.slagTick * (p.slag ?? 0), -1, true);
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
      if (e.aux % 2 === 1 && e.aux2 <= 0) {
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
  private twinFell(): void {
    for (let j = 0; j < this.enemies.length; j++) {
      const o = this.enemies[j];
      if (o.alive && o.kind === 'emberTwin' && !o.castId) {
        this.startCast(j, 'rekindle', 'Rekindle', FOUNDRY.rekindleCast, true);
        return;
      }
    }
  }

  private startMaelra(): void {
    this.temper = 0;
    this.temperT = FOUNDRY.temperEvery;
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
    // Temper builds over time; dragging her through a vent boils it away.
    this.temperT -= dt;
    if (this.temperT <= 0) {
      this.temperT = FOUNDRY.temperEvery;
      if (this.temper < FOUNDRY.temperMax) this.temper++;
    }
    if (this.temper > 0) {
      for (const v of this.vents) {
        if (dist2(e.x, e.y, v.x, v.y) <= (v.r + e.def.radius * 0.5) ** 2) {
          // Boiling her Temper away vents cool water back at the hero: a heal for playing the verb.
          const heal = this.healPlayer(p.maxHp * FOUNDRY.ventHealPerStack * this.temper);
          if (heal > 0) {
            this.events.push({ type: 'heal', x: p.x, y: p.y, amount: heal });
          }
          this.temper = 0;
          this.temperT = FOUNDRY.temperEvery;
          this.events.push({ type: 'explode', x: v.x, y: v.y, r: v.r + 20 });
          break;
        }
      }
    }
    // V8 Sluicetide (some runs): instead of rising, the water runs across the room and turns now and then.
    if (phase >= 2 && this.bossVariant === 'tide') {
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
      this.addTelegraph('circle', p.x, p.y, 110, 0, 0, 1.3, 32 * mult);
    } else {
      const ang = Math.atan2(p.y - e.y, p.x - e.x);
      this.addTelegraph('cone', e.x, e.y, 300, ang, (65 * Math.PI) / 180, 1.1, 28 * mult);
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
        this.relaySoak(took);
        this.events.push({ type: 'soak', ok, x: t.x, y: t.y, owner: t.owner });
        // Ventwalker (3): standing in the gold circle heals.
        if (ok && this.setCount('ventwalker') >= 3) this.healPlayer(p.maxHp * SET_TUNING.vwHeal);
        if (!ok) {
          this.hurtPlayer(t.dmg * this.tierDamage);
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            this.spawn('ashling', t.x + Math.cos(a) * 60, t.y + Math.sin(a) * 60);
          }
        }
        continue;
      }
      this.events.push({ type: 'slam', x: t.x, y: t.y, r: t.r });
      // Smother: a Bulwark standing in a bloom catches the burst on its shield for 25 Resolve, so it feeds no one.
      const smother = t.kind === 'bloom' && this.cls === 'bulwark' && p.heat >= SMOTHER_COST
        && dist2(p.x, p.y, t.x, t.y) <= (t.r + PLAYER_RADIUS) ** 2;
      if (smother) {
        p.heat -= SMOTHER_COST;
        this.events.push({ type: 'parry', x: p.x, y: p.y });
      }
      if (t.kind === 'bloom' && !smother) {
        // The burst feeds any enemy caught in it.
        this.forEachNear(t.x, t.y, t.r + 40, (j) => {
          const o = this.enemies[j];
          if (!o.alive || o.def.rank === 'normal' || dist2(o.x, o.y, t.x, t.y) > (t.r + o.def.radius) ** 2) return;
          const amount = Math.min(o.maxHp - o.hp, o.maxHp * FOUNDRY.bloomHeal * this.healTakenMult(o));
          if (amount <= 0) return;
          o.hp += amount;
          this.events.push({ type: 'heal', x: o.x, y: o.y, amount });
        });
      }
      const inside = this.insideTelegraph(t);
      if (!inside && t.wasIn && t.kind === 'hit') this.dodged();
      // A smothered bloom lands on the shield: the Bulwark takes half.
      if (inside) this.hurtPlayer(t.dmg * this.tierDamage * (smother ? 0.5 : 1));
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
        const ok = took.length > 0;
        this.relaySoak(took);
        this.events.push({ type: 'soak', ok, x: t.x, y: t.y, owner: t.owner });
        // Ventwalker (3): every wearer standing in the gold circle heals.
        if (ok) {
          this.eachHero(() => {
            const q = this.player;
            if (this.setCount('ventwalker') >= 3 && dist2(q.x, q.y, t.x, t.y) <= (t.r + PLAYER_RADIUS) ** 2) this.healPlayer(q.maxHp * SET_TUNING.vwHeal);
          });
        }
        if (t.owner === -4) {
          // A Banked Coal: smothered, or he eats it (the same as an ember he inhales).
          if (ok) this.events.push({ type: 'emberTaken', x: t.x, y: t.y });
          else this.feedVorhulm(t.x, t.y);
          continue;
        }
        if (!ok) {
          this.eachHero(() => this.hurtPlayer(t.dmg * this.tierDamage));
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
          if (q.hp > 0 && this.heroes[i].cls === 'bulwark' && q.heat >= SMOTHER_COST && dist2(q.x, q.y, t.x, t.y) <= (t.r + PLAYER_RADIUS) ** 2) smother = i;
        }
        if (smother >= 0) {
          const q = this.heroPlayer(smother);
          q.heat -= SMOTHER_COST;
          this.events.push({ type: 'parry', x: q.x, y: q.y });
        } else {
          this.forEachNear(t.x, t.y, t.r + 40, (j) => {
            const o = this.enemies[j];
            if (!o.alive || o.def.rank === 'normal' || dist2(o.x, o.y, t.x, t.y) > (t.r + o.def.radius) ** 2) return;
            const amount = Math.min(o.maxHp - o.hp, o.maxHp * FOUNDRY.bloomHeal * this.healTakenMult(o));
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
        // A smothered bloom lands on the shield: that Bulwark takes half.
        if (inside) this.hurtPlayer(t.dmg * this.tierDamage * (h === smother ? 0.5 : 1));
      });
    }
  }

  // ---------------------------------------------------------------- loot

  private makeItem(min: Rarity): Item {
    return rollDrop(this.rng, `i${this.nextItemId++}`, this.itemLevel, this.luck, min, this.cls, this.tier);
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
    const noun = item.name.split(' ').slice(1).join(' ');
    return { ...item, set, name: `${SETS[set].name} ${noun}` };
  }

  /**
   * Fill with bots: bot fills clear faster than solo runs, so only fillLootShare(bots) of the
   * in-run drops (clear bags, elite and named drops, quest items) survive. Boss items don't thin.
   */
  private fillKeeps(): boolean {
    if (!this.fillBots) return true;
    this.fillRng ??= new Rng((this.seed ^ 0x66696c6c) >>> 0);
    return this.fillRng.chance(fillLootShare(this.fillBots));
  }

  private dropLoot(x: number, y: number, min: Rarity): void {
    if (!this.fillKeeps()) return;
    const item = this.makeItem(min);
    const d = this.drops.find((q) => !q.alive);
    if (!d) {
      this.pickUp(item);
      return;
    }
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
      this.progressQuest('veins');
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
      this.progressQuest('veins');
      this.events.push({ type: 'gather', x: v.x, y: v.y });
      this.use(0);
    }
  }

  // ---------------------------------------------------------------- quests

  pickQuests(): QuestId[] {
    const all = Object.keys(QUESTS) as QuestId[];
    all.splice(this.rng.int(all.length), 1);
    return all;
  }

  private progressQuest(id: QuestId): void {
    const k = this.quests.findIndex((q) => q.id === id && !q.done);
    if (k < 0) return;
    const q = this.quests[k];
    q.progress++;
    if (q.progress < q.goal) return;
    q.done = true;
    this.gainXp(this.player.xpToNext * 0.6);
    if (this.fillKeeps()) this.pickUp(this.makeItem('fine'));
    this.events.push({ type: 'quest', index: k });
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
    if (this.player.pendingLevels > 0 && this.state === 'running' && this.phase !== 'fight') { if (this.heroes.length === 1) this.openDraft(); else this.openDraftAll(); }
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
    if (this.state === 'running' && this.phase !== 'fight' && this.heroes.some((_, i) => this.heroPlayer(i).pendingLevels > 0)) this.openDraftAll();
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
      if (this.player.pendingLevels > 0 && this.choices.length === 0) this.choices = this.rollDraft();
    }
    this.use(at);
    this.state = 'draft';
  }

  private openDraft(): void {
    this.choices = this.rollDraft();
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
   * Offer one talent from each branch, so every pick is a build direction.
   * An unlocked branch offers all its capstones (taking one closes the rest). A branch with nothing left
   * gives its card to another branch, then to the general fallbacks.
   */
  rollDraft(): DraftOption[] {
    const out: DraftOption[] = [];
    const spare: TalentId[] = [];
    let capCards = 0;
    // A hero with an ability option never drafts talents for the ability it replaced.
    const swapped = this.player.alt ? ALT_ABILITIES[this.cls].slot : -1;
    const defs = (Object.values(TALENTS) as TalentDef[]).filter((d) => d.cls === this.cls && (d.ability === undefined || d.ability !== swapped) && (!d.party || this.heroes.length > 1) && (!d.where || this.situationAhead(d.where)));
    for (const b of this.branches) {
      const caps = defs.filter((d) => d.branch === b && d.capstone);
      const capped = caps.some((c) => this.rank(c.id) > 0);
      const open = (deep: boolean) => defs.filter((d) => d.branch === b && !d.capstone && !!d.deep === deep && this.rank(d.id) < d.maxRank).map((d) => d.id);
      // Deep cards (C5 round 2) join a branch once its capstone is taken.
      const ids = capped ? [...open(false), ...open(true)] : open(false);
      if (caps.length && caps.every((c) => this.rank(c.id) === 0) && this.branchRanks(b) >= CAPSTONE_RANKS) {
        // The capstone choice: every capstone of the branch, side by side, ahead of the other cards.
        out.splice(capCards, 0, ...caps.map((c) => ({ id: c.id, nextRank: 1 })));
        capCards += caps.length;
      } else if (ids.length) {
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
      if (!e.alive) continue;
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
      if (e.alive && dist2(x, y, e.x, e.y) <= m2) cands.push(i);
    }
    return cands.length ? cands[this.rng.int(cands.length)] : -1;
  }
}

export function xpFor(level: number): number {
  return Math.round(4 + level * 2 + Math.pow(level, 1.35));
}

export const VEIN_TIME = 1.2;
export const QUENCH_RANGE = 520;
/** First tier whose first clear guarantees an Epic from the boss. */
export const FIRST_CLEAR_EPIC_TIER = 2;

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
  /** The Lens Sweep cone between Glares: every so many seconds, and its damage. */
  sweepEvery: 1.7,
  sweepEveryEnraged: 1,
  sweepDamage: 26,
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
  // V8: the Foundry is drowned, so no lava channel: stones and steam vents.
  foundry: ['open', 'open', 'pillars', 'vents'],
  // V8: the Glarewell already has its own pillars, so only vents.
  glarewell: ['open', 'open', 'vents'],
  // V8: the Coldmarrow's fires are out, so no vents or lava: ice pillars only.
  coldmarrow: ['open', 'open', 'pillars'],
};
/** V2 tuning. Stones block movement; a lava channel burns `lavaBurn` of max health a second; vents flare every `ventEvery` s in turn. */
/** V3: the Kiln Mother's phase-2 signature this run. */
export type KilnVariant = 'cataclysm' | 'draw';
export const KILN_VARIANTS: KilnVariant[] = ['cataclysm', 'draw'];
/** V3 Kiln Draw: a `cast` s inhale, not interruptible, pulling heroes within `reach` toward her at `pull` px/s; then fire lands in a `radius` circle on her. */
export const KILN_DRAW = { cast: 2.2, pull: 80, reach: 900, radius: 150, damage: 45 };

/** V8: Nhevra's phase-2 signature this run: Thin Ice (as before) or Emberdrift. */
export type NhevraVariant = 'ice' | 'drift';
export const NHEVRA_VARIANTS: NhevraVariant[] = ['ice', 'drift'];
/** V8 Emberdrift: from phase 2 coals drain `drainMult` times faster; every `every` s, `n` embers fall on a `ring` px ring, each refilling `refill` of a coal when touched (within `pickR`). */
export const EMBERDRIFT = { every: 12, n: 3, ring: 280, pickR: 34, refill: 0.45, drainMult: 2.5 };

/** V8: the Lensmother's phase-2 signature this run: Twin Brand (as before) or Glintfall. */
export type LensVariant = 'brand' | 'glint';
export const LENS_VARIANTS: LensVariant[] = ['brand', 'glint'];
/** V8 Glintfall: on the Twin Brand timer, a `cast` s warning, then a `radius` circle of falling light on every standing pillar. */
export const GLINTFALL = { cast: 1.8, radius: 80, damage: 24 };

/** V8: Maelra's phase-2 signature this run: Rising Water (the arena shrinks) or the Sluicetide. */
export type MaelraVariant = 'water' | 'tide';
export const MAELRA_VARIANTS: MaelraVariant[] = ['water', 'tide'];
/** V8 Sluicetide: from phase 2 the water pushes every hero `drift` px/s one way, and turns every `turnEvery` s. The arena keeps its size. */
export const SLUICETIDE = { drift: 45, turnEvery: 8 };

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
  shoalEvery: 28, shoalN: 2, firstShoal: 14,
  /** Phase 2, Riptide (from `phase2` of her health): rafts drift faster and the pull is stronger. */
  phase2: 0.5, riptideDrift: 1.6, riptideDrag: 1.25,
  /** Soft enrage: the Ebb every `tideLate` s. */
  enrageAfter: 240,
};
/** Phase 12 W1: the Wrackline's raft currents: each raft's drift direction (1 or -1), inner ring in the middle. The first is the original. */
export const CURRENTS: number[][] = [[1, -1, 1], [1, 1, 1], [-1, 1, -1], [-1, -1, 1]];
/**
 * Phase 12 W3: the Furnace Regent's two versions (his phase 2). `ash`: Ash Fall, a circle under every hero (step out).
 * `court`: Summons, on Ash Fall's timer: after `warn` s, every hero farther than `radius` from him takes `damage`
 * (scaled by tier). The party has to gather on him, where a Decree's scorch (REGENT.scorchRadius) catches anyone close
 * to its holder, so holders stand at the edge and passes happen in the crowd.
 */
export type RegentVariant = 'ash' | 'court';
export const REGENT_VARIANTS: RegentVariant[] = ['ash', 'court'];
export const SUMMONS = { warn: 2.5, radius: 130, damage: 70 };
/**
 * Phase 12 W3: the Cinder Colossus's two versions (his phase 2). `wheel`: he turns on the hero who hurt him most and sweeps.
 * `shift`: Plate Shift, on the Wheel's timer and cast: his plate slides round to face that hero instead, and stays
 * there (World.colPlate) while he keeps facing the tank, so his open back moves and the damage dealers have to find it again.
 */
export type ColossusVariant = 'wheel' | 'shift';
export const COLOSSUS_VARIANTS: ColossusVariant[] = ['wheel', 'shift'];
/** Phase 12 W3: Old Vorhulm's two versions. `spill`: Ember Feast scatters embers to grab. `bank`: Banked Coals, gold circles to stand on as they land. */
export type VorhulmVariant = 'spill' | 'bank';
export const VORHULM_VARIANTS: VorhulmVariant[] = ['spill', 'bank'];
/**
 * Banked Coals (his phase 3 in the `bank` version, on Ember Spill's timer, in place of the embers): `count` gold circles of
 * `radius`, `near` or `far` from him in turn, landing after `fuse` s. A hero standing in one smothers it; an empty one he eats
 * (COAL.emberHeal and COAL.emberDamage, as for an ember). No blast and no adds.
 */
export const BANK = { count: 3, radius: 50, fuse: 4, near: 120, far: 170 };
/** Phase 12 W3: Grandmother Slag's two versions. `pour`: phase 2 is the Pour's molten lanes. `brim`: the Brimming, cooling islands that sink. */
export type SlagVariant = 'pour' | 'brim';
export const SLAG_VARIANTS: SlagVariant[] = ['pour', 'brim'];
/**
 * The Brimming (her phase 2 in the `brim` version, in place of the Pour's lanes): `count` cooling islands of `radius`,
 * `near` or `far` from her. Each lasts `life` s (dimming for its last `warn`), then sinks and a new one rises elsewhere.
 * The rising slag burns a hero off an island `heat` of max health every SLAG.heatEvery s, and one on an island nothing.
 */
export const BRIM = { count: 3, radius: 80, life: 12, warn: 3, near: 170, far: 260, heat: 0.06 };
/** Phase 12 W2: Oskel's two versions. `rivets`: a ring under every hero. `cut`: Die Cut, half the floor at once. */
export type OskelVariant = 'rivets' | 'cut';
export const OSKEL_VARIANTS: OskelVariant[] = ['rivets', 'cut'];
/** Die Cut: on the Rivets timer, a half-floor cut through Oskel with a `fuse` s warning; everyone in it takes `damage` (scaled by tier as it lands). */
export const DIECUT = { every: 9, fuse: 2.4, damage: 45 };
/** Phase 12 W2: Ysmeret's two versions. `still`: the Twin Vents stay where they open. `wander`: they circle her while they fuse. */
export type YsmeretVariant = 'still' | 'wander';
export const YSMERET_VARIANTS: YsmeretVariant[] = ['still', 'wander'];
/** Wandering Vents: each circle moves `speed` px/s around Ysmeret (heroes run 128 to 152), about 70 degrees over a 4 s fuse. */
export const WANDER = { speed: 70 };
/** Phase 12 W2: Ondrel's two versions. `choir`: Choir of Iron hurts every hero. `load`: Ironload marks one, and the party shares it. */
export type OndrelVariant = 'choir' | 'load';
export const ONDREL_VARIANTS: OndrelVariant[] = ['choir', 'load'];
/**
 * Ironload, on the Choir's timer: marks a hero (not the one Ondrel is on) for `time` s. It lands for
 * `share` (+`grow` each time) of max health, split evenly among the living heroes within `radius` of the mark.
 * Four together take about what one Choir costs each; alone it is half a hero's health.
 */
export const IRONLOAD = { time: 5, radius: 110, share: 0.5, grow: 0.08 };
/** Phase 12 W1: Hessa's two versions. `riptide`: phase 2 speeds the rafts and the pull. `outsurge`: phase 2 turns the Ebb around. */
export type HessaVariant = 'riptide' | 'outsurge';
export const HESSA_VARIANTS: HessaVariant[] = ['riptide', 'outsurge'];
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
   */
  ashEvery: 12, ashCast: 1.5, ashRadius: 70, ashDamage: 70 * Math.pow(1.12, 10),
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

export const OSKEL = {
  /**
   * Downstroke: one soak circle `downDist` from Oskel. Everyone under it who wasn't Pressed
   * becomes Pressed for `pressed` s; a Pressed hero under it takes `crush` of max health and
   * doesn't count. `pressed` is longer than `downEvery`, so nobody takes two in a row.
   * A missed one hits every hero for `downMiss` (and spawns adds, like any missed soak).
   */
  downEvery: 13, downEnraged: 8, downFuse: 4, downDist: 200, downRadius: 60, downMiss: 70, firstDown: 7,
  pressed: 20, crush: 0.5,
  /** Rivets: a ring under every hero; step out. */
  rivetEvery: 9, rivetFuse: 1.6, rivetRadius: 60, rivet: 30, firstRivets: 4,
  /** Stamp: the tank hit, through dodges and shields. */
  stamp: 75, stampEvery: 10, stampCast: 2, firstStamp: 5,
  /** Soft enrage: Downstrokes come faster than Pressed wears off for a duo. */
  enrageAfter: 270,
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
