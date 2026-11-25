/**
 * Draws the shared simulation. This scene owns no game rules: it feeds input
 * into `World.step` at a fixed rate and renders interpolated state.
 */
import { OMENS } from '../sim/content/omens';
import { coachLine } from '../sim/content/firstdelve';
import { CoopSession, SNAP_SECONDS, cleanLooks } from './net/coop';
import { applySnapshot } from '../sim/netsync';
import Phaser from 'phaser';
import { ASHWALL, BALLAST, DIMHORN, LAMPEYE, SUMMONS, BANK, BRIM, ARENA_EVENTS, TICK, World, Input, SimEvent, type Enemy, WorldOptions, VEIN_TIME, ARENA, GLARE, CARRIED_LIGHT, CREEPING_RIME, OVERFLOW, INHALE, MILL, MAELRA_SEAL, REVIVE_RADIUS, YSMERET, COLD, SLAG_KIT, ALT_KIT, WRACK, OSKEL, COAL as VORHULM, COLO, REGENT, LAYOUT, KILN_DRAW, EMBERDRIFT, IRONLOAD, ONDRELV2, YSMERETV2, OSKELV2, OUTSURGE, ARENA_EVENT_INFO, WAVE_SHAPE_INFO, WAVES, STIR_INFO, versionLive } from '../sim/world';
import { HallsView } from './hallsview';
import { inLoop, roomLoops } from './hallsshape';
import { BANKED_TIP, INHALE_TIP, BRIMMING_TIP, OVERFLOW_TIP, COURT_TIP, TITHE_TIP, PLATE_SHIFT_TIP, MILLSTONE_TIP, EMBERDRIFT_TIP, CREEPING_RIME_TIP, DIECUT_TIP, PUNCH_TIP, ENCOUNTERS, GLINTFALL_TIP, CARRIED_LIGHT_TIP, IRONLOAD_TIP, HOMEWARD_TIP, ROLLING_TIP, KILN_DRAW_TIP, TURNING_FIRE_TIP, SEALED_VENTS_TIP, OUTSURGE_TIP, WHIRL_TIP, SLUICETIDE_TIP, WANDER_TIP } from '../sim/content/dungeon';
import { BOSS_VERSION_NAME } from '../sim/runshape';
import { HEATS } from '../sim/content/heat';
import { RARITY } from '../sim/content/items';
import { ENEMIES } from '../sim/content/enemies';
import { AFFIXES, AFFIX_TIP, NAMED as NAMED_TUNE } from '../sim/content/named';
import { SET_TUNING } from '../sim/content/sets';
import { GLOWS, TRAILS } from '../sim/content/season';
import { botName, CLASS_ICON, GLOW_MARK, isBotAlly } from './icons';
import { ALT_ABILITIES, CLASSES } from '../sim/content/classes';
import { roleOf } from './net/lobby';
import { display, onDisplayChange, palette, shakeScale, textScale } from './settings';
import { hd2dFx, hd2dModule, hideHd2dLoading, type Hd2dView } from './hd2d/api';
import { buildTextures, FRAMES, SPRITE_RES, WORLD_BOSS_SHEET } from './textures';
import { BRANCH_COLOR, Hud } from './ui';
import { BRANCH_NAMES, TALENTS, TalentId } from '../sim/content/emberwright';
import { botChoose, botInput } from '../sim/bot';
import { audio } from './audio';
import { type CueContext, behindColossusNow, colossusCue, inLavaNow, inRimeNow, myIsland, pickCue, roomBedFor, setFlagsOf } from './audio/cues';
import { themeFor } from './audio/music';
import { drawKm2d } from './kilnmother2d';

// World units visible on the screen's short side: a little closer on phones.
const viewFor = (shortSide: number) => (shortSide < 500 ? 500 : 640);
// Telegraph colours come from the display palette (client/settings.ts): standard or colour-blind.
/** G6 revive green. */
const REVIVE = 0x9fe8a8;
/** The Coldmarrow: ice blue, the Hearthcoal's warm orange, and the frozen floor. */
const FROST = 0xbfe4ff;
const COAL = 0xff8a3d;
const COLD_FLOOR = 0x7e98c4;
/** C2 named elites: the Rare blue, from the loot colours. */
const NAMED = 0x5aa9ff;
/** The Crucible (raid): molten slag. */
const MOLTEN = 0xff6a1f;
/** Phase 14 X6: each named-foe trait's body tint (multiplied, so it stays subtle). */
const AFFIX_TINT: Record<string, number> = { Swift: 0xe0f0ff, Warded: 0xd8e8ff, Vengeful: 0xffc4c4, Brood: 0xe6f0c4, Smoldering: 0xffd2aa };
/** Phase 13 E3 (raids) and E2 (the Ashvents): each one's own stones and vents for its trash-fight layouts (the boss fight is always open). */
const RAID_STONE: Record<string, string> = { ashvents: 'pumiceStone', crucible: 'slagStone', hoard: 'boneStone', smeltery: 'ingotStone', flue: 'brickStone' };
const RAID_VENT: Record<string, string> = { ashvents: 'fumaroleVent', crucible: 'slagVent', hoard: 'emberVent', smeltery: 'tuyereVent', flue: 'ashVent' };
let DANGER = 0xff3b6b; // the one colour used for enemy attacks
let SOAK = 0xffc861; // gold: stand in it
let BLOOM = 0x5fe0c8;
let HATCH = false;
function applyPalette(): void {
  const p = palette();
  DANGER = p.danger;
  SOAK = p.soak;
  BLOOM = p.bloom;
  HATCH = p.hatch;
}
applyPalette();
onDisplayChange(applyPalette);
const NAME_COLOR: Record<string, string> = { boss: '#ff8aa5', rare: '#9fd0ff', elite: '#ffc861', normal: '#d6a8ff' };
const hex = (css: string) => Number.parseInt(css.slice(1), 16);
/**
 * L2: Phaser's Text.setColor redraws the text and re-uploads its texture even
 * when the colour is unchanged (TextStyle.setColor always calls update), unlike
 * setText. Labels updated every frame go through this instead.
 */
function setColorIf<T extends Phaser.GameObjects.Text>(t: T, color: string): T {
  return t.style.color === color ? t : (t.setColor(color) as T);
}
/** Slagbinder colours: molten slag, and the cold of Cooling Shell. */
const SLAG = 0xff9b4a;
/** Shorter fight tips for phones, where even the 4-line banner cuts these off (checked at 320 and 568 wide). */
const PHONE_TIP: Record<string, string> = {
  [ENCOUNTERS.regent.tip]: 'Its Decree burns whoever holds it: walk it to an ally before it bursts. It never lands on the tank, but the tank can take one.',
  [COURT_TIP]: 'Its Decree burns whoever holds it: walk it to an ally before it bursts. On a Summons, get inside his gold ring.',
  [PLATE_SHIFT_TIP]: 'His front is plated: the tank holds it, everyone else hits his back. Step out of the Slag Sweep. When his plate shifts, find his open back again.',
  [MILLSTONE_TIP]: 'His front is plated: the tank holds it, everyone else hits his back. Step out of the Slag Sweep. When he grinds round, walk round with him.',
  [TITHE_TIP]: 'Its Decree burns whoever holds it: walk it to an ally before it bursts. On a Tithe, two or more of you share the gold circle.',
  [OVERFLOW_TIP]: 'Heal the Ladle burn off the tank. When the pit overflows, gather close to her until it ebbs. Then fill the vents and spread for the Cinder Marks.',
  [WHIRL_TIP]: 'Hit her between pulls and keep a raft afloat. Later the water swirls and carries you, turning the other way each time: wade across it to a raft.',
  [ROLLING_TIP]: 'Her vents open one at a time, each further round her: spread so someone is near the next. Never stand together when the Embers mark you.',
  // Phase 16 U8: the new elites. Their full tips run 4 lines at 320 wide, which holds the banner over the middle of the
  // fight for 5 s, right as their first tell lands (the Ballast's slam, the Ashwall's bash). Same answer, about half the words.
  [ENCOUNTERS.ashwall.tip]: 'Its shield guards its front and the foes behind it. Walk round it.',
  [ENCOUNTERS.ballast.tip]: 'In its reach it drops anchor and shrugs off hits. Step back, hit it as it walks.',
  [ENCOUNTERS.lampeye.tip]: 'Hide behind a pillar to break its gaze. Fight the Shades in the light.',
  [ENCOUNTERS.dimhorn.tip]: 'Out in the dark it calls the pack. Keep it in your coal\'s light.',
  [ENCOUNTERS.conch.tip]: 'Its conch brings the next Ebb sooner. Quench it, and stay near a raft.',
};
const SLAG_COOL = 0xbcd6e6;
// Ability options (ALT_ABILITIES): Ember Ward fire, the Hamstring slow, Muster gold, Glow Pool light.
const WARD_FIRE = 0xff7a2e;
const SLOWED = 0xa58cff;
const CRY = 0xffd27a;
const WELL = 0xfff0b0;

/** A pooled sprite effect: moves, spins, fades and scales from (sx0, sy0) to (sx1, sy1). */
interface Fx {
  img: Phaser.GameObjects.Image;
  life: number;
  max: number;
  vx: number;
  vy: number;
  drag: number;
  spin: number;
  sx0: number;
  sy0: number;
  sx1: number;
  sy1: number;
  /** Optional colour shift over the effect's life: from tint0 to tint1 (0 = none). */
  tint0: number;
  tint1: number;
}

/**
 * How each season trail is drawn (TRAILS ids); any other trail is soft motes. 'sparks': rising, cooling embers (the
 * Deep Bellows). 'frost': falling crystals that settle (the Cold Hearth). 'drip': molten drops that fall and cool (the
 * Slag Moon). 'oil': iridescent oil drops that spread into a green slick (the Falling Press). 'chips': wood splinters
 * that tumble off the heels (the Low Ebb). 'crumbs': hot coal crumbs that drop and cool (the Long Hunger). 'shards':
 * steel plate shards that flash crack cyan as they break off and fall (the Cracked Plate).
 */
type TrailStyle = 'motes' | 'sparks' | 'frost' | 'drip' | 'oil' | 'chips' | 'crumbs' | 'shards';
const TRAIL_STYLE: Record<string, TrailStyle> = { bellowsSparks: 'sparks', rimeDust: 'frost', slagDrips: 'drip', oilSheen: 'oil', raftSplinters: 'chips', emberCrumbs: 'crumbs', plateShards: 'shards' };
/** The deeper rime blue a settled crystal turns, so a near-white trail still shows on the Coldmarrow's frost. */
const FROST_SETTLE = 0x7fa6e8;
/** The dim forge red an ember cools to. */
const EMBER_COOL = 0x9a2e1c;
/** The dull crust red a slag drop cools to once it lands. */
const SLAG_CRUST = 0x8a2a2a;
/** The Hoard's arena rim: deep coal red, apart from the Kiln's orange and the Crucible's molten. */
const HOARD_RIM = 0xd8382a;
/** The Flue (raid 4): a sooty plum floor and a crimson-rose rim, the Regent's colours. */
const FLUE_FLOOR = 0xb878a8;
const FLUE_RIM = 0xe0607a;
/** The dark wet wood a splinter darkens to as it settles. */
const WET_WOOD = 0x5a3a22;
/** The hot gold an ember crumb starts at before it cools to the trail's red (the Long Hunger's Hoard Gilt, warmed). */
const CRUMB_HOT = 0xffc46a;
/** The crack cyan a plate shard flashes as it breaks off, before it settles to the trail's plate blue. */
const SHARD_FLASH = 0x26e9ff;
/** Blend two 0xRRGGBB colours, t from 0 (a) to 1 (b). */
function mixRgb(a: number, b: number, t: number): number {
  const m = (sh: number) => Math.round(((a >> sh) & 255) + ((((b >> sh) & 255) - ((a >> sh) & 255)) * t)) << sh;
  return m(16) | m(8) | m(0);
}

interface FloatText {
  txt: Phaser.GameObjects.Text;
  life: number;
  age: number;
  vx: number;
}

/** Characters draw a little larger than their hitboxes so they read on phones. */
const BASE = 1.15 / SPRITE_RES;
/** Bosses and rares: big sprites that idle-animate and get a softer hit flash. */
/** A hero's sprite sheet. The Emberwright's is the original 'player' sheet; an Anvil Slagbinder wears the slab. */
const heroTex = (cls: string, stance?: string): string => (cls === 'emberwright' ? 'player' : cls === 'slagbinder' && stance === 'anvil' ? 'slagbinderAnvil' : cls);
/** The live world boss's sheet for its shadow fight; Grandmother Slag's when the name is unknown. */
const shadowSheet = (name?: string): { key: string; size: number } => (name && WORLD_BOSS_SHEET[name]) || WORLD_BOSS_SHEET['Grandmother Slag'];
const idleRank = (e: { def: { rank: string } }): boolean => e.def.rank === 'boss' || e.def.rank === 'rare';
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/** Short-lived vector effects drawn with Graphics (ability shapes, beams). */
interface Shape {
  kind: 'cone' | 'line' | 'pillar' | 'ring';
  /** Cone width in radians (default 110 degrees). */
  arc?: number;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  angle: number;
  color: number;
  life: number;
  max: number;
}

export interface SceneData {
  opts: WorldOptions;
  hud: Hud;
  onEnd: (w: World) => void;
  /** Co-op: the party session (host steps the World, guest mirrors it). */
  coop?: CoopSession;
  /** P2: the season glow the hero wears (GLOWS id), drawn under them. Looks only. */
  glow?: string;
  /** Season trail the hero wears (TRAILS id) and its best stage, 1 to 3. Looks only. */
  trail?: { id: string; stage: number };
}

/**
 * L2: one past the last live slot of a pool. Pools fill lowest slot first (World.spawn takes the
 * first dead enemy), so in a normal fight this is a handful out of 900, and the render loops below
 * stop there instead of touching every slot's sprite each frame.
 */
function liveEnd(pool: readonly { alive: boolean }[]): number {
  for (let i = pool.length - 1; i >= 0; i--) if (pool[i].alive) return i + 1;
  return 0;
}

/** Arena edge props and light by dungeon, for GameScene.edgeDraw. flicker is the light's slow period in ms. */
/** `light: null` places the props without floor pools, for a dungeon where light is a mechanic (the Coldmarrow). */
const EDGE_SETS: Record<string, { big: string; small: string; light: string | null; flicker: number; puff: 'spark' | 'steam' | 'none' }> = {
  kiln: { big: 'kilnFurnace', small: 'kilnBrazier', light: 'coalLight', flicker: 130, puff: 'spark' },
  foundry: { big: 'foundryBoiler', small: 'foundryValve', light: 'coolLight', flicker: 420, puff: 'steam' },
  hammerdeep: { big: 'deepAnvil', small: 'deepLantern', light: 'paleLight', flicker: 700, puff: 'none' },
  ashvents: { big: 'ashFumarole', small: 'ashCairn', light: 'coalLight', flicker: 180, puff: 'spark' },
  wrackline: { big: 'wrackWreck', small: 'wrackPost', light: 'coalLight', flicker: 400, puff: 'none' },
  pressworks: { big: 'pressFrame', small: 'pressStack', light: 'paleLight', flicker: 900, puff: 'none' },
  hoard: { big: 'hoardPile', small: 'hoardBones', light: 'paleLight', flicker: 1100, puff: 'none' },
  smeltery: { big: 'smeltCart', small: 'smeltIngots', light: 'paleLight', flicker: 900, puff: 'spark' },
  flue: { big: 'flueChimney', small: 'flueBanner', light: 'paleLight', flicker: 800, puff: 'spark' },
  glarewell: { big: 'glareLens', small: 'glareShards', light: null, flicker: 1000, puff: 'none' },
  coldmarrow: { big: 'coldArch', small: 'coldBrazier', light: null, flicker: 1000, puff: 'none' },
  crucible: { big: 'crucibleLadle', small: 'crucibleSlagPot', light: 'coalLight', flicker: 160, puff: 'spark' },
};

/** A named foe's banner line. */
function namedLine(affix: keyof typeof AFFIX_TIP): string {
  return `A named foe (${affix}). ${AFFIX_TIP[affix]} It carries its own loot.`;
}

export class GameScene extends Phaser.Scene {
  world!: World;
  hud!: Hud;
  private onEnd!: (w: World) => void;
  private acc = 0;
  private paused = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private stickVec = { x: 0, y: 0 };
  /** A pressed ability waits briefly for the global cooldown, like an MMO spell queue. */
  private queued: { slot: number; until: number } | null = null;
  /** Test hooks: autopilot plays the run; warp runs extra ticks per frame. */
  autopilot = false;
  /** Ashvents vents with nobody in them this frame (for the edge arrows). */
  private emptyVents: { x: number; y: number; col?: number }[] = [];
  /** Co-op session, or null for solo. */
  coop: CoopSession | null = null;
  /** Guest: seconds since the last snapshot, for smoothing between them. */
  private snapAge = 0;
  private lastInputAt = 0;
  /** The raid: whether the tank swap banner is up for this swap. */
  private swapShown = false;
  /** Guest: the draft (level and picks left) a pick was already sent for. */
  private sentPick = -1;
  /** The other heroes in a co-op party. */
  private allies: {
    hero: number;
    img: Phaser.GameObjects.Image;
    shadow: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Text;
    /** P6: their worn season title, under their name. */
    tag?: Phaser.GameObjects.Text;
    /** P6: their worn season glow, on the floor under them. */
    glow?: Phaser.GameObjects.Image;
    /** Fill with bots: the bot mark just left of the name, which then drops its "(bot)". */
    mark?: Phaser.GameObjects.Image;
    /** The name as shown (a bot's without "(bot)"). */
    name: string;
  }[] = [];
  autoPick = true;
  warp = 1;

  private ground!: Phaser.GameObjects.TileSprite;
  /** HD-2D look test (?hd2d=1): the 3D view drawn over this scene, when its module has loaded (client/hd2d/api.ts). */
  private hd2d: Hd2dView | null = null;
  private hd2dAlpha = 1;
  /** The floor bridge (3D look): a second camera drawing the floor layer top-down into the canvas's corner, copied each frame. */
  private bridge: { cam: Phaser.Cameras.Scene2D.Camera; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; n: number; span: number; stamp: number; blank: boolean; cx: number; cy: number } | null = null;
  private hd2dDt = 0;
  /** How long the 3D view took to build and to draw its first frame, in ms (tools/hd2dload.cjs). */
  hd2dTimes: { mount: number; firstFrame: number } | null = null;
  private player!: Phaser.GameObjects.Image;
  private aura!: Phaser.GameObjects.Image;
  private enemySprites: Phaser.GameObjects.Image[] = [];
  private enemyKinds: string[] = [];
  private orbSprites: Phaser.GameObjects.Image[] = [];
  private gemSprites: Phaser.GameObjects.Image[] = [];
  /** L2: sprites at or past these slots are already hidden (see liveEnd). */
  private shownEnd = { enemies: 0, orbs: 0, gems: 0 };
  private zoneSprites: Phaser.GameObjects.Image[] = [];
  private dropSprites: Phaser.GameObjects.Image[] = [];
  private beamSprites: Phaser.GameObjects.Image[] = [];
  private veinSprites: Phaser.GameObjects.Image[] = [];
  private orbiterSprites: Phaser.GameObjects.Image[] = [];
  private plates: Phaser.GameObjects.Text[] = [];
  private soakText!: Phaser.GameObjects.Text;
  private reviveText!: Phaser.GameObjects.Text;
  /** Labels over the two gates at a fork (game design: placeholder look, visuals can restyle). */
  private gateTexts: Phaser.GameObjects.Text[] = [];
  private gfx!: Phaser.GameObjects.Graphics;
  /** Wind-ups that must read over the sprites (Ondrel's falling anvil). */
  private overFx!: Phaser.GameObjects.Graphics;
  /** Raid 4 (the Flue): a burning seal over each Decree holder, and a cold one over each Spent hero. */
  private decreeImgs: Phaser.GameObjects.Image[] = [];
  private spentImgs: Phaser.GameObjects.Image[] = [];
  private bars!: Phaser.GameObjects.Graphics;
  private fx: Fx[] = [];
  /** Ash puffs and dying bodies: normal blending, drawn at body depth. */
  private smoke: Fx[] = [];
  private shadows: Phaser.GameObjects.Image[] = [];
  private playerShadow!: Phaser.GameObjects.Image;
  private enemyFrames: number[] = [];
  private motes: { img: Phaser.GameObjects.Image; ph: number; sp: number }[] = [];
  private ventSprites: Phaser.GameObjects.Image[] = [];
  /** V5 (variety): the Kiln's layout art, pooled and matched to World.stones / lava / flareVents each frame. */
  private stoneImgs: Phaser.GameObjects.Image[] = [];
  /** Phase 14 X6: the cave-in rocks as they fall, each the dungeon's own stone (stoneKey). */
  private caveRocks: Phaser.GameObjects.Image[] = [];
  private kilnVentImgs: Phaser.GameObjects.Image[] = [];
  private lavaStrips: Phaser.GameObjects.TileSprite[] = [];
  /** V8: Foundry vent steam, on its own layer under the main graphics so it never covers a class ring. */
  private steamGfx: Phaser.GameObjects.Graphics | null = null;
  /**
   * The darkness beyond the arena edge, on its own layer (1.95) under the edge props (1.97) and the main graphics (2).
   * It used to be the first stroke of the main graphics with the props drawn just after it at 2.05; in that order,
   * WebGL (Chromium/SwiftShader, Phaser 4.2.1) dropped pieces of the boss sprite drawn later in the frame (#404/#405
   * shots of Maelra and Ondrel). With darkness and props both before the main graphics, 48 checked frames were whole.
   */
  private darkGfx: Phaser.GameObjects.Graphics | null = null;
  /** The Wrackline's water marks (raft wakes, Hessa's Outsurge surf), over the rafts (0.9) and under the main graphics. */
  private surfGfx: Phaser.GameObjects.Graphics | null = null;
  /** Phase 12 W2: the Wandering Vents' trail and chevrons, under the main graphics (1.9) like the other floor tells. */
  private wanderGfx: Phaser.GameObjects.Graphics | null = null;
  /** Phase 12 W3: the Brimming's molten floor wash and island seams (1.88), the island crusts (1.9), and when each island rose. */
  private brimGfx: Phaser.GameObjects.Graphics | null = null;
  private brimImgs: Phaser.GameObjects.Image[] = [];
  private brimBorn = new WeakMap<object, number>();
  private brimStart = 0;
  /** Phase 12 W3: the Regent's Summons tell (depth 1.9). */
  private summonsGfx: Phaser.GameObjects.Graphics | null = null;
  /** Phase 15 Y6: wave marks on the floor (depth 1.95): a ring closing, pincer chevrons, the reinforcement gate and its burst. */
  private waveGfx: Phaser.GameObjects.Graphics | null = null;
  /** Y6: the Kiln Mother's Turning Fire sweep arrow (depth 2.1, over the cones), and Maelra's sealed-vent plates (depth 1.42, over the grates). */
  private turnGfx: Phaser.GameObjects.Graphics | null = null;
  /** Y6 Carried Light: the light's drawn spot, gliding from where it was to her over 0.6 s when it moves (lightMove). */
  private lightAnim: { fx: number; fy: number; tx: number; ty: number; t0: number } | null = null;
  /** Y6 Creeping Rime: its floor layer (1.44, with the other floor tells), when it rose, and which way it is creeping. */
  private rimeGfx: Phaser.GameObjects.Graphics | null = null;
  /** BOSSV2 marks in the 2D look: the three-stage Kiln Mother's floor and the Glutton's Gorge (3D draws its own). */
  private kmGfx: Phaser.GameObjects.Graphics | null = null;
  private flowGfx: Phaser.GameObjects.Graphics | null = null;
  private rimeBorn = 0;
  private rimeDir = { x: 0, y: 1, lx: 0, ly: 0 };
  /** Y6 the Whirl: the way it last turned, and when that flipped (whirlDraw grows the arrows in fresh). */
  private whirlSeen = 0;
  /** Y6 the Homeward Hammer: the throw (from him to where it lands, when), its floor layer and its lying layer, the last stage seen. */
  private homeThrow: { fx: number; fy: number; tx: number; ty: number; t0: number } | null = null;
  private homeFloor: Phaser.GameObjects.Graphics | null = null;
  private homeLie: Phaser.GameObjects.Graphics | null = null;
  /** World.time of the boss's last echoed cast, for the 3D view's ghost (Hd2dAdapter.echoAt). */
  private echoAt = -Infinity;
  /** Camera focus offset in world y (see bossInView): 0 except when it slides to keep a boss clear of the bottom HUD. */
  private focusY = 0;
  private focusX = 0;
  /** Phase 18 Halls H1: the map's floor, sleepers, camera rule, corner map and arrow (client/hallsview.ts). */
  private halls: HallsView | null = null;
  private homeLast = 0;
  private whirlGfx: Phaser.GameObjects.Graphics | null = null;
  private whirlFlip = 0;
  private sealGfx: Phaser.GameObjects.Graphics | null = null;
  private waveFx: { kind: 'ring' | 'pincer' | 'gate' | 'burst'; x: number; y: number; a: number; t0: number; dur: number }[] = [];
  /** Phase 15 Y10: the extra elite a stirred fight sends (enemy slot and when it spawned), marked until it dies; and the stir beat's start. */
  private stirElite: { i: number; at: number } | null = null;
  private stirAt = -1;
  /** Phase 14 X6: the arena events' floor marks (depth 1.9); falling rock goes on overFx. */
  private arenaGfx: Phaser.GameObjects.Graphics | null = null;
  /** Phase 14 X6: just above enemy bodies and under heroes (Brood egg sacs at a foe's feet). */
  private footGfx: Phaser.GameObjects.Graphics | null = null;
  /** Phase 12 W3 (Plate Shift): the Colossus's plate turn as drawn, easing to World.colPlate, and when it was last eased. */
  private plateShown: number | null = null;
  private plateAt = 0;
  /** Phase 12 W3: Old Vorhulm's Banked Coals: their glow (1.89), the coal heaps (1.9), how smothered each looks, and the ash a smothered one leaves. */
  private bankGfx: Phaser.GameObjects.Graphics | null = null;
  private bankImgs: { hot: Phaser.GameObjects.Image; ash: Phaser.GameObjects.Image }[] = [];
  private bankCool = new WeakMap<object, number>();
  private bankAsh: { img: Phaser.GameObjects.Image; at: number }[] = [];
  /** Phase 12 W2: Oskel's Die Cut (the steel die over the doomed half and its cutting edge), under the main graphics. */
  private dieGfx: Phaser.GameObjects.Graphics | null = null;
  /** The arena edge props (EDGE_SETS, just outside the rim) and their light pools; made on first need. */
  private edgeProps: { img: Phaser.GameObjects.Image; light: Phaser.GameObjects.Image | null; x: number; y: number; fire: boolean }[] = [];
  /** V8: Maelra's Sluicetide current, on a layer under the main graphics so it never covers a class ring. */
  private tideGfx: Phaser.GameObjects.Graphics | null = null;
  /** The current's drawn direction, eased toward World.tideAngle so a turn swings round instead of snapping. */
  private tideShown = 0;
  private tideOn = false;
  /** A turn's beat: 1 on tideTurn, fading to 0. */
  private tideBeat = 0;
  /** V8: the Lensmother's Glintfall shards, above the pillars (1.5) and under the main graphics (2), so never over a ring. */
  private glintGfx: Phaser.GameObjects.Graphics | null = null;
  /** V8: Nhevra's Emberdrift embers, pooled, and when the last set fell (for the drop-in). */
  private driftImgs: Phaser.GameObjects.Image[] = [];
  /** Phase 12 W2: Ondrel's Ironload weight over the marked hero, and where it last hung (for the landing sparks). */
  private loadImg: Phaser.GameObjects.Image | null = null;
  private loadShown: { x: number; y: number } | null = null;
  private driftFallAt = -1e9;
  private pillarSprites: Phaser.GameObjects.Image[] = [];
  /** A Glare's white-gold wash over the room, fading from 1 to 0. */
  private glareFlash = 0;
  private gateSprites: { arch: Phaser.GameObjects.Image; portal: Phaser.GameObjects.Image }[] = [];
  private steamAt = 0;
  private facing = 1;
  private hitSparks = 0;
  private hitStop = 0;
  /** Juice: a brief zoom-in on big moments (fraction of the base zoom), and the zoom it returns to. */
  private punch = 0;
  private baseZoom = 1;
  /** The Halls zoom the ground was last sized for (layout sizes it for 1). */
  private groundK = 1;
  /** Today's view across the short side, in world units (viewFor). */
  private viewUnits = 500;
  /** The game canvas's CSS box, re-read every half second (the Halls arrow places itself with it). */
  private canvasBox = { at: -1e9, rect: new DOMRect() };
  /** Last crit hit-stop (scene ms), so a stream of crits doesn't stutter the game. */
  private lastCritStop = 0;
  /** A full-screen flash after a boss falls (colour and strength, 0 to 1). */
  private bossFlash = 0;
  /** Set when a boss falls, so the end screen waits for the death moment. */
  private bossFell = false;
  /** When each loot drop appeared (scene ms), for its pop-in. */
  private dropBorn: number[] = [];
  /** Set when the frame rate sags: drops cosmetic extras (shadows under fodder, embers in the air). */
  lowFx = false;
  /** The render scale can't go lower (or the Graphics setting isn't Auto). */
  private resFloor = false;
  private fxCheckAt = 0;
  private vignette: HTMLElement | null = null;
  /** The 3D view's Glare and boss flash: a screen-wide wash, its opacity set each frame. */
  private flashFx: HTMLElement | null = null;
  private flashShown = -1;
  /** The Coldmarrow: the additive Hearthcoal light layer, and the frost creeping in from the screen edge. */
  private coalLights: Phaser.GameObjects.Image[] = [];
  private frost: HTMLElement | null = null;
  private laceShown = false;
  private floats: FloatText[] = [];
  private shapes: Shape[] = [];
  private shake = 0;

  // Frame timing for the stress test readout.
  private frameTimes: number[] = [];
  private workTimes: number[] = [];

  constructor() {
    super('game');
  }

  init(data: SceneData): void {
    this.world = new World(data.opts);
    this.looks = data.opts.looks ?? [];
    this.coop = data.coop ?? null;
    // A guest draws the run as their own hero.
    if (this.coop?.role === 'guest') this.world.use(this.coop.me);
    this.snapAge = 0;
    this.sentPick = -1;
    this.allies = [];
    this.hud = data.hud;
    this.onEnd = data.onEnd;
    this.acc = 0;
    this.paused = false;
    this.queued = null;
    this.fx = [];
    this.smoke = [];
    this.shadows = [];
    this.enemyFrames = [];
    this.motes = [];
    this.ventSprites = [];
    this.stoneImgs = [];
    this.caveRocks = [];
    this.kilnVentImgs = [];
    this.lavaStrips = [];
    this.steamGfx = null;
    this.darkGfx = null;
    this.surfGfx = null;
    this.wanderGfx = null;
    this.brimGfx = null;
    this.brimImgs = [];
    this.brimStart = 0;
    this.summonsGfx = null;
    this.arenaGfx = null;
    this.footGfx = null;
    this.waveGfx = null;
    this.turnGfx = null;
    this.lightAnim = null;
    this.rimeGfx = null;
    this.flowGfx = null;
    this.rimeBorn = 0;
    this.whirlSeen = 0;
    this.homeThrow = null;
    this.homeFloor = null;
    this.homeLie = null;
    this.homeLast = 0;
    this.whirlGfx = null;
    this.lightLast = { x: 0, y: 0 };
    this.sealGfx = null;
    this.waveFx = [];
    this.stirElite = null;
    this.stirAt = -1;
    this.plateShown = null;
    this.bankGfx = null;
    this.bankImgs = [];
    this.bankAsh = [];
    this.dieGfx = null;
    this.edgeProps = [];
    this.tideGfx = null;
    this.tideOn = false;
    this.tideBeat = 0;
    this.glintGfx = null;
    this.driftImgs = [];
    this.loadImg = null;
    this.loadShown = null;
    this.driftFallAt = -1e9;
    this.pillarSprites = [];
    this.glareFlash = 0;
    this.raftPrev = [];
    this.shoves = [];
    this.warmSeen = 0;
    this.glowId = data.glow;
    this.heroGlow = undefined;
    this.ownTrail = data.trail;
    this.trails = [];
    this.raftImgs = [];
    this.drainImg = undefined;
    this.plantK = 0;
    this.gateSprites = [];
    // The gate labels are rebuilt in create(), like the gate sprites: the old ones were destroyed
    // with the last scene, and layout() resizing them crashed the next delve's create().
    this.gateTexts = [];
    this.facing = 1;
    this.hitStop = 0;
    this.punch = 0;
    this.bossFlash = 0;
    this.bossFell = false;
    this.dropBorn = [];
    this.floats = [];
    this.shapes = [];
    this.enemySprites = [];
    this.enemyKinds = [];
    this.orbSprites = [];
    this.gemSprites = [];
    this.shownEnd = { enemies: 0, orbs: 0, gems: 0 };
    this.zoneSprites = [];
    this.dropSprites = [];
    this.beamSprites = [];
    this.veinSprites = [];
    this.orbiterSprites = [];
    this.plates = [];
    this.frameTimes = [];
    this.workTimes = [];
  }

  create(): void {
    if (!this.textures.exists('ground')) buildTextures(this);
    const w = this.world;
    audio.theme(themeFor(w.dungeonId));

    this.ground = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'ground').setOrigin(0.5).setScrollFactor(0).setDepth(-10);
    // The Glarewell's floor is cool slate, so its gold light and indigo shadows read against it.
    if (w.dungeonId === 'glarewell') this.ground.setTint(0xa49ccc);
    // The Hammerdeep's floor is cold forge iron, so slag and the red telegraphs read hot against it.
    else if (w.dungeonId === 'hammerdeep') this.ground.setTint(0x9c98a8);
    // The Ashvents' floor is pale ash, so the gold vents and rose embers stand out on it.
    else if (w.dungeonId === 'ashvents') this.ground.setTint(0xb8a49a);
    // The Coldmarrow's floor is frozen slate, so each Hearthcoal's warm light pools on it.
    else if (w.dungeonId === 'coldmarrow') this.ground.setTint(COLD_FLOOR);
    // The Crucible's floor is cooled slag, a little redder, so the molten lanes and the gold vents both read.
    else if (w.dungeonId === 'crucible') this.ground.setTint(0xb88a7c);
    // The Hoard's floor is coal-dark brown (visuals' pick: at least 24 Delta-E from every other floor), so the glowing embers and the Craw stand out.
    else if (w.dungeonId === 'hoard') this.ground.setTint(0x70584e);
    // The Wrackline's floor is grey-green harbour water (visuals' pick: at least 21 Delta-E from every other floor), so the pale rafts and the drain read on it.
    else if (w.dungeonId === 'wrackline') this.ground.setTint(0x6e8a80);
    // The Pressworks' floor is oily olive brass (at least 21 Delta-E from every other floor), so the gold Downstroke
    // plate and the red Rivets both read on it.
    else if (w.dungeonId === 'pressworks') this.ground.setTint(0x9aa070);
    // The Smeltery's floor is sooty blue-grey cast iron (at least 20 Delta-E from every other floor), so his hot back,
    // the Sweep cone and the Meltdown pulses read warm against it.
    else if (w.dungeonId === 'smeltery') this.ground.setTint(0x606878);
    // The Flue's floor is sooty plum brick (at least 22 Delta-E from every other floor, the untinted ones too), dark
    // like the inside of a chimney, so the burning Decree seals and their Scorch rings read hot against it.
    else if (w.dungeonId === 'flue') this.ground.setTint(FLUE_FLOOR);

    w.zones.forEach(() => this.zoneSprites.push(this.add.image(0, 0, 'burn').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(1)));
    w.veins.forEach(() => this.veinSprites.push(this.add.image(0, 0, 'vein').setVisible(false).setDepth(1.5)));
    this.gfx = this.add.graphics().setDepth(2);
    this.overFx = this.add.graphics().setDepth(8.6);
    // Phase 18 Halls H1: the Kiln as a map. The ground outside the rooms goes dark (the walls), and the map layer draws the rest.
    this.halls = null;
    if (w.halls) {
      this.halls = new HallsView(this, w, (kind) => this.enemyTex({ kind } as Enemy, 0), BASE);
      this.ground.setAlpha(0.3);
    }
    this.coalLights = [];
    this.laceShown = false;
    // The Coldmarrow: Hearthcoal light is added onto the floor, under every sprite.
    if (w.dungeonId === 'coldmarrow') for (let k = 0; k < w.heroes.length; k++) this.coalLights.push(this.add.image(0, 0, 'coalLight').setDepth(1.2).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
    this.frost = document.getElementById('frost');
    if (this.frost) { this.frost.style.opacity = '0'; this.frost.classList.remove('frozen', 'flash'); }
    w.drops.forEach(() => {
      this.beamSprites.push(this.add.image(0, 0, 'beam').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(3));
      this.dropSprites.push(this.add.image(0, 0, 'loot').setVisible(false).setDepth(3.5));
    });
    for (let i = 0; i < 48; i++) this.smoke.push(this.newFx('puff', 4.5, false));
    this.playerShadow = this.add.image(0, 0, 'shadow').setDepth(2.5);
    // The worn season glow sits on the floor under the telegraph layer, so it never hides an attack.
    const glow = this.glowId ? GLOWS[this.glowId] : undefined;
    if (glow) this.heroGlow = this.glowImage(glow);
    this.addTrail(w.acting, this.ownTrail, 40);
    this.aura = this.add.image(0, 0, 'aura').setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    const auraTint: Record<string, number> = { duskblade: 0x9a6cff, lumen: 0xfff0c0, bulwark: 0x9ab8ff };
    if (auraTint[w.cls]) this.aura.setTint(auraTint[w.cls]);
    this.player = this.add.image(0, 0, heroTex(w.cls, w.heroData(w.acting).player.stance), '0').setScale(BASE).setDepth(6);
    // Co-op: everyone else in the party, with their name over their head and (P6) the title and glow they wear.
    // Looks come from other players' browsers, so they are cleaned again here.
    const looks = this.looks;
    for (let j = 0; j < w.heroes.length; j++) {
      if (j === w.acting) continue;
      const cls = w.heroes[j].cls;
      const look = cleanLooks(looks[j]);
      const ag = look.glow ? GLOWS[look.glow] : undefined;
      const bot = isBotAlly(w, j);
      const name = bot ? botName(w.heroes[j].name) : w.heroes[j].name;
      this.allies.push({
        hero: j,
        name,
        mark: bot ? this.add.image(0, 0, 'botMark').setOrigin(1, 0.5).setDepth(9.5).setTint(hex(CLASS_ICON[cls].color)) : undefined,
        shadow: this.add.image(0, 0, 'shadow').setDepth(2.5),
        img: this.add.image(0, 0, heroTex(cls, w.heroData(j).player.stance), '0').setScale(BASE).setDepth(5.9),
        label: this.add.text(0, 0, name, { fontFamily: 'Georgia, serif', fontSize: '12px', fontStyle: 'bold', color: CLASS_ICON[cls].color, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(9.5),
        tag: look.title ? this.add.text(0, 0, look.title, { fontFamily: 'Georgia, serif', fontSize: '10px', fontStyle: 'italic', color: '#e8d9a8', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(9.5) : undefined,
        glow: ag ? this.glowImage(ag) : undefined,
      });
      // An ally's trail: a smaller pool, since it is somebody else's flourish.
      this.addTrail(j, look.trail, 24);
    }
    for (let i = 0; i < 3; i++) this.orbiterSprites.push(this.add.image(0, 0, 'ember').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(7));
    for (let i = 0; i < 200; i++) this.fx.push(this.newFx('spark', 8, true));
    // Drifting embers in the air, wrapped around the camera.
    if (!w.stress) {
      for (let i = 0; i < 34; i++) {
        const img = this.add.image(Math.random() * 1400 - 700, Math.random() * 1000 - 500, 'spark').setBlendMode(Phaser.BlendModes.ADD).setDepth(8.5);
        // The Coldmarrow: the embers are snow.
        if (w.dungeonId === 'coldmarrow') img.setTint(FROST);
        this.motes.push({ img, ph: Math.random() * 6.28, sp: 8 + Math.random() * 18 });
      }
    }
    this.vignette = document.getElementById('vignette');
    this.flashFx = document.getElementById('flashFx');
    this.flashShown = -1;
    // Foundry steam vents and fork gates (pooled; most runs never show them).
    for (let k = 0; k < 4; k++) this.ventSprites.push(this.add.image(0, 0, 'vent', '0').setScale(BASE).setVisible(false).setDepth(1.4));
    // Glarewell pillars stand above the floor and the shadows they cast.
    for (let k = 0; k < 4; k++) this.pillarSprites.push(this.add.image(0, 0, 'pillar', '0').setScale(BASE).setVisible(false).setDepth(1.5));
    for (let k = 0; k < 2; k++) {
      this.gateSprites.push({
        portal: this.add.image(0, 0, 'portal', '0').setScale(BASE * 1.1).setOrigin(0.5, 0.92).setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(3.9),
        arch: this.add.image(0, 0, 'gate', '0').setScale(BASE * 1.1).setOrigin(0.5, 0.92).setVisible(false).setDepth(3.95),
      });
    }
    this.bars = this.add.graphics().setDepth(9);
    const plateStyle = { fontFamily: 'Georgia, serif', fontSize: '12px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 };
    for (let i = 0; i < 10; i++) this.plates.push(this.add.text(0, 0, '', plateStyle).setOrigin(0.5, 1).setVisible(false).setDepth(9.5));
    for (let k = 0; k < 2; k++) this.gateTexts.push(this.add.text(0, 0, '', { ...plateStyle, fontSize: '13px', align: 'center' }).setOrigin(0.5, 1).setVisible(false).setDepth(9.5));
    this.soakText = this.add.text(0, 0, 'Stand here', { ...plateStyle, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5, 0).setVisible(false).setDepth(9.5);
    this.reviveText = this.add.text(0, 0, '', { ...plateStyle, fontSize: '13px', color: '#c8ffd0' }).setOrigin(0.5, 0).setVisible(false).setDepth(9.5);
    this.decreeImgs = [];
    this.spentImgs = [];
    if (w.dungeonId === 'flue') {
      for (let i = 0; i < 4; i++) this.decreeImgs.push(this.add.image(0, 0, 'decreeSeal').setVisible(false).setDepth(9.4));
      for (let i = 0; i < 4; i++) this.spentImgs.push(this.add.image(0, 0, 'spentMark').setVisible(false).setDepth(9.4));
    }
    for (let i = 0; i < 28; i++) {
      const txt = this.add.text(0, 0, '', { fontFamily: 'system-ui, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#ffe08a', stroke: '#2a0d06', strokeThickness: 4 }).setOrigin(0.5).setVisible(false).setDepth(10);
      this.floats.push({ txt, life: 0, age: 0, vx: 0 });
    }

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE,FOUR,Q,E,R,F,P,ESC') as Record<string, Phaser.Input.Keyboard.Key>;
    // Number keys pick talents during a draft and fire abilities otherwise.
    kb.on('keydown-ONE', () => (this.world.state === 'draft' ? this.pick(0) : this.cast(0)));
    kb.on('keydown-TWO', () => (this.world.state === 'draft' ? this.pick(1) : this.cast(1)));
    kb.on('keydown-THREE', () => (this.world.state === 'draft' ? this.pick(2) : this.cast(2)));
    kb.on('keydown-FOUR', () => this.cast(3));
    kb.on('keydown-Q', () => this.cast(0));
    kb.on('keydown-E', () => this.cast(1));
    kb.on('keydown-R', () => this.cast(2));
    kb.on('keydown-F', () => this.cast(3));
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-ESC', () => this.togglePause());

    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => {
      if (this.flashFx) this.flashFx.style.opacity = '0'; // a run that ends mid-flash must not leave the screen washed
      this.halls?.destroy();
      this.halls = null;
      this.hd2d?.destroy();
      this.hd2d = null;
      this.bridgeStop();
      this.edgeCanvas?.remove();
      this.edgeCanvas = null;
      this.scale.off('resize', this.layout, this);
      if (this.frost) { this.frost.style.opacity = '0'; this.frost.classList.remove('frozen', 'flash'); }
    });
    this.layout();
    this.cameras.main.centerOn(0, 0);
    // HD-2D: the 3D view draws the run; this scene keeps the sim, input and HUD, and stops drawing its own camera.
    const hd = hd2dModule();
    if (hd) {
      const t0 = performance.now();
      try {
        this.hd2d = hd.mount(this.game.canvas.parentElement ?? document.body, {
          world: () => this.world,
          alpha: () => this.hd2dAlpha,
          enemyTex: (i) => this.enemyTex(this.world.enemies[i], i),
          frame: (key, n) => this.frameCanvas(key, n),
          frames: (key) => FRAMES[key] ?? 1,
          texScale: BASE,
          heroName: (i) => this.world.heroes[i]?.name ?? '',
          floor: () => (this.bridge ? { canvas: this.bridge.canvas, span: this.bridge.span, stamp: this.bridge.stamp, x: this.bridge.cx, y: this.bridge.cy } : null),
          kindTex: (kind) => this.enemyTex({ kind } as Enemy, 0),
          echoAt: () => this.echoAt,
          focus: () => ({ x: this.focusX + (this.halls?.leadX ?? 0), y: this.focusY + (this.halls?.leadY ?? 0) }),
          zoom: () => this.halls?.zoomK ?? 1,
        }, { fx: hd2dFx(), saver: display.graphics === 'saver' });
        this.cameras.main.setVisible(false);
        this.bridgeStart();
        const t1 = performance.now();
        // The first frame builds and compiles everything while the loading screen is still up.
        this.hd2d.frame(0);
        this.hd2dTimes = { mount: Math.round(t1 - t0), firstFrame: Math.round(performance.now() - t1) };
      } catch (err) {
        console.warn('HD-2D view failed, drawing in 2D', err);
        this.hd2d?.destroy();
        this.hd2d = null;
        this.bridgeStop();
        this.cameras.main.setVisible(true);
      }
      hideHd2dLoading();
    }

    this.hud.bindRun({
      onPick: (i) => this.pick(i),
      onPause: () => this.togglePause(),
      onStick: (x, y) => { this.stickVec.x = x; this.stickVec.y = y; },
      onCast: (slot) => this.cast(slot),
    });
    // Phones: the HUD fades the party frames while a boss, elite or the Craw stands under them.
    // In 3D the tilted camera puts a foe somewhere else on screen than the 2D view would (Hoard raid phone pass, 25 Nov:
    // the frames faded for a Hollow Warden standing below them), so the HUD asks the 3D view where it is drawn.
    this.hud.view = { rect: this.cameras.main.worldView, canvas: this.game.canvas, project: (x, y) => this.hd2d?.project(x, y) ?? null };
    this.hud.showRun(w);
    // Halls H1: no fight starts the run, so the map says what to do.
    // Every Halls dungeon's own name (phone pass 25 Nov: the Hammerdeep opened as "The Kiln Depths").
    if (w.halls) this.hud.banner(w.dungeonDef.name, this.hud.compact ? 'Foes sleep until you step close. Pick your fights; the door guard must fall.' : 'Foes sleep until you step into their red ring, so pick your fights. The door guard must fall before the boss door opens.');
  }

  /**
   * The floor bridge (3D look, step 2 of the 3D plan): every floor tell drawn in 2D (rafts, vents, the Glarewell's light,
   * coals, wave marks, boss tells) shows on the 3D floor without porting each one. A second camera draws the whole arena
   * top-down into an n x n corner of this canvas, skipping the ground, the edge props and everything standing (depth 2.3
   * and up: heroes, foes, stones, names, bars, effects), which the 3D view draws itself. After Phaser renders, that corner
   * is copied into a small canvas the renderer lays on its floor (bridgeCopy). The main camera stays as it was, hidden.
   */
  private bridgeStart(): void {
    const cv = this.game.canvas;
    const n = Math.floor(Math.min(512, cv.width, cv.height));
    if (n < 128) return;
    const span = 2 * ((this.world.arenaR ?? ARENA) + 80);
    const cam = this.cameras.add(0, 0, n, n, false, 'bridge');
    cam.setZoom(n / span).centerOn(0, 0);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = n;
    const ctx = canvas.getContext('2d');
    if (!ctx) { this.cameras.remove(cam); return; }
    this.bridge = { cam, canvas, ctx, n, span, stamp: 0, blank: true, cx: 0, cy: 0 };
    this.bridgeFilter();
    this.game.events.on('postrender', this.bridgeCopy, this);
  }

  private bridgeStop(): void {
    if (!this.bridge) return;
    this.game.events.off('postrender', this.bridgeCopy, this);
    this.cameras.remove(this.bridge.cam);
    this.bridge = null;
  }

  /** Keeps the bridge camera to the floor layer: new objects appear all run, so each frame checks for unfiltered ones. */
  private bridgeFilter(): void {
    const b = this.bridge;
    if (!b) return;
    const id = b.cam.id;
    const props = new Set<Phaser.GameObjects.GameObject>();
    for (const p of this.edgeProps) { props.add(p.img); if (p.light) props.add(p.light); }
    for (const o of this.children.list) {
      const d = (o as Phaser.GameObjects.Image).depth ?? 0;
      if ((o.cameraFilter & id) !== 0) continue;
      if (d >= 2.3 || d < 0 || d === 1.95 || d === 1.97 || props.has(o)) b.cam.ignore(o);
    }
  }

  /** After Phaser has drawn the bridge camera's corner: copy it out, then draw the 3D frame over it. */
  private bridgeCopy(): void {
    const b = this.bridge;
    if (!b || !this.hd2d) return;
    // Copy (a GPU readback plus a texture upload) only when the bridge camera drew something, or once to clear it after.
    // A Graphics cleared this frame still renders, so it counts only if its buffer holds a fill or stroke (Phaser's
    // Graphics Commands 3 and 8 to 11; an argument can match too, which only costs a copy).
    const drew = b.cam.renderList.some((o) => !(o instanceof Phaser.GameObjects.Graphics) || o.commandBuffer.some((c) => c === 3 || (c >= 8 && c <= 11)));
    if (drew || !b.blank) {
      b.ctx.clearRect(0, 0, b.n, b.n);
      if (drew) b.ctx.drawImage(this.game.canvas, 0, 0, b.n, b.n, 0, 0, b.n, b.n);
      b.blank = !drew;
      b.stamp++;
    }
    this.hd2d.frame(this.hd2dDt);
    this.hd2dDt = 0;
    this.foeEdgeMarks3d(this.time.now);
  }

  /** Where sound pans from: in 3D, by where things show on screen (client/audio/cues.ts panFor), else the 2D camera's width. */
  private listenFrom(w: World): NonNullable<CueContext['listen']> {
    const l = { x: w.player.x, y: w.player.y, half: this.cameras.main.worldView.width / 2 };
    const view = this.hd2d, width = this.game.canvas.parentElement?.clientWidth ?? 0;
    return view && width > 0 ? { ...l, screen: (x, y) => view.project(x, y), screenHalf: width / 2 } : l;
  }

  private layout(): void {
    const { width, height } = this.scale;
    const short = Math.min(width, height);
    // The canvas may be at device resolution (see --dpr in index.html); pick the
    // view from the CSS size so phones and desktops frame the same as before.
    const dpr = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dpr')) || 1;
    const zoom = short / viewFor(short / dpr);
    this.baseZoom = zoom;
    this.viewUnits = viewFor(short / dpr);
    this.cameras.main.setZoom(zoom);
    // Scroll-factor-0 objects still scale with zoom around the screen centre,
    // so size the ground in world units and centre it.
    this.ground.setPosition(width / 2, height / 2).setSize(width / zoom + 4, height / zoom + 4);
    this.groundK = 1;
    // Phones see the world zoomed out (a 500-unit view on a ~375px screen), which shrank
    // nameplates and combat text to 9-10px. Grow world text back to at least its design size.
    // The Large text setting (L3) grows it again on top.
    this.textK = Math.min(1.4, Math.max(1, viewFor(short / dpr) / (short / dpr))) * textScale();
    this.textSeen = display.text;
    const k = this.textK;
    const res = Math.max(1, Math.min(3, zoom * k));
    for (const t of this.plates) t.setFontSize(12 * k).setResolution(res);
    for (const t of this.gateTexts) t.setFontSize(13 * k).setResolution(res);
    this.soakText?.setFontSize(13 * k).setResolution(res);
    this.reviveText?.setFontSize(13 * k).setResolution(res);
    for (const a of this.allies) {
      a.label.setFontSize(12 * k).setResolution(res);
      a.tag?.setFontSize(10 * k).setResolution(res);
    }
    for (const f of this.floats) f.txt.setResolution(res);
  }

  /** World text multiplier for small screens (see layout). */
  private textK = 1;
  private textSeen = display.text;
  /** Hearthkeeper Warmth last frame, to flare once when it fills. */
  private warmSeen = 0;
  /** P6: each hero's worn title and glow from the start options (cleaned before drawing). */
  private looks: { title?: unknown; glow?: unknown }[] = [];
  /** P2: the worn season glow under the hero, if any. */
  private glowId?: string;
  private heroGlow?: Phaser.GameObjects.Image;
  /** Worn season trails, ours and each ally's: colour, stage, the hero, its own mote pool and spawn clock. */
  private trails: { hero: number; color: number; stage: number; fx: Fx[]; acc: number; style: TrailStyle }[] = [];
  /** Our own worn trail from the start data, made into a pool in create(). */
  private ownTrail?: { id: string; stage: number };
  /** The Wrackline: a deck image and a warning rim per raft, and the drain's whirlpool (made on first use). */
  /** Wrackrider Planted cue: 0 to 1 as the stakes drive in (eased in plantedDraw). */
  private plantK = 0;
  private raftImgs: { deck: Phaser.GameObjects.Image; rim: Phaser.GameObjects.Image }[] = [];
  private drainImg?: Phaser.GameObjects.Image;

  private pick(i: number): void {
    if (this.world.state !== 'draft') return;
    const chosen = this.world.choices[i] ? TALENTS[this.world.choices[i].id as TalentId] : undefined;
    if (chosen?.capstone) this.deepUnlock(chosen.branch);
    audio.cue(pickCue(this.world.choices[i]?.id));
    if (this.coop?.role === 'guest') {
      // The host applies it; hide the cards until the next snapshot shows what's left.
      if (!this.world.choices[i]) return;
      this.sentPick = this.world.player.level * 100 + this.world.player.pendingLevels;
      this.coop.sendPick(i);
      this.hud.hideDraft();
      return;
    }
    this.world.choose(i, 0);
    if (this.world.state === 'draft') this.hud.showDraft(this.world);
    else this.hud.hideDraft();
  }

  /**
   * C5 round 2: taking a capstone opens its branch's deep cards (if the class has any). The hero
   * flares in the branch colour and a banner says what just opened.
   */
  private deepUnlock(branch: keyof typeof BRANCH_NAMES): void {
    const cls = this.world.cls;
    // Party cards are deep cards that only a party is offered, so a solo hero isn't told about them.
    const solo = this.world.heroes.length < 2;
    const n = Object.values(TALENTS).filter((d) => d.cls === cls && d.branch === branch && (d as { deep?: boolean }).deep && !(solo && (d as { party?: boolean }).party)).length;
    if (!n) return;
    const p = this.world.player;
    const c = hex(BRANCH_COLOR[branch]);
    this.ring(p.x, p.y, 150, c, 1.1);
    this.time.delayedCall(220, () => this.ring(this.world.player.x, this.world.player.y, 100, c, 0.9));
    const m = this.lowFx ? 6 : 18;
    for (let k = 0; k < m; k++) {
      const a = (k / m) * Math.PI * 2;
      this.emit(this.fx, 'spark', undefined, p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 12, 1, { tint: c, vx: Math.cos(a) * 30, vy: -110 - Math.random() * 70, drag: 0.96, sx0: 2.4, sx1: 0.4 });
    }
    this.hud.banner(`${BRANCH_NAMES[branch]} runs deeper`, `${n} deep card${n > 1 ? 's' : ''} now join${n > 1 ? '' : 's'} your drafts`);
  }

  /** Queue an ability press; it fires on the next tick it is usable (within 0.35s). */
  cast(slot: number): void {
    if (this.paused || this.world.state !== 'running') return;
    if (this.coop?.role === 'guest') {
      this.coop.sendCast(slot);
      return;
    }
    this.queued = { slot, until: this.time.now + 350 };
  }

  togglePause(force?: boolean): void {
    if (this.world.state === 'ended') return;
    this.paused = force ?? !this.paused;
    this.hud.setPaused(this.paused);
  }

  private readInput(): Input {
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k.A.isDown || k.LEFT.isDown) x -= 1;
    if (k.D.isDown || k.RIGHT.isDown) x += 1;
    if (k.W.isDown || k.UP.isDown) y -= 1;
    if (k.S.isDown || k.DOWN.isDown) y += 1;
    if (x === 0 && y === 0) return { x: this.stickVec.x, y: this.stickVec.y };
    return { x, y };
  }

  update(_time: number, deltaMs: number): void {
    const t0 = performance.now();
    this.updateInner(deltaMs);
    this.workTimes.push(performance.now() - t0);
    if (this.workTimes.length > 240) this.workTimes.shift();
  }

  /** Inputs for bot allies (heroes from..n): a local party from 1, or a co-op host's fill bots after the guests. */
  private botAllies(w: World, from = 1): Input[] {
    const out: Input[] = [];
    for (let i = from; i < w.heroes.length; i++) { w.use(i); out.push(botInput(w)); }
    w.use(0);
    return out;
  }

  /** Host: this hero, the guests' inputs, then any fill bots (V7), which the host runs. */
  private coopInputs(w: World, input: Input): Input[] {
    const guests = this.coop!.remoteInputs(w);
    return w.fillBots ? [input, ...guests, ...this.botAllies(w, 1 + guests.length)] : [input, ...guests];
  }

  /** Average milliseconds of game code (simulation + scene updates) per frame. */
  workMs(): number {
    return this.workTimes.length ? this.workTimes.reduce((a, b) => a + b, 0) / this.workTimes.length : 0;
  }

  private updateInner(deltaMs: number): void {
    const w = this.world;
    // Text size changed in the pause menu: resize the world text now.
    if (this.textSeen !== display.text) this.layout();
    // The Coldmarrow: the music's coal crackle follows your Hearthcoal.
    if (w.dungeonId === 'coldmarrow' && w.player.coal !== undefined) audio.warmth(w.player.coal);
    this.frameTimes.push(deltaMs);
    if (this.frameTimes.length > 240) this.frameTimes.shift();

    if (this.coop?.role === 'guest') this.guestFrame(deltaMs);
    else if (this.hitStop > 0) this.hitStop -= deltaMs / 1000;
    // Co-op never pauses the shared run: the pause menu just floats over it.
    else if ((!this.paused || this.coop) && w.state === 'running') {
      this.acc += Math.min(deltaMs / 1000, 0.25) * this.warp;
      while (this.acc >= TICK && w.state === 'running') {
        const input = this.autopilot ? botInput(w) : this.readInput();
        if (!this.autopilot && this.queued) {
          if (this.time.now > this.queued.until) this.queued = null;
          else input.cast = this.queued.slot;
        }
        const slot = input.cast;
        const cdBefore = slot !== undefined ? w.player.cds[slot] : 0;
        w.step(this.coop ? this.coopInputs(w, input) : w.heroes.length > 1 ? [input, ...this.botAllies(w)] : input);
        this.coop?.afterStep(w);
        if (slot !== undefined && w.player.cds[slot] > cdBefore) {
          if (!this.autopilot) this.queued = null;
          this.hud.flashAbility(slot);
        }
        this.acc -= TICK;
        this.handleEvents(w.events);
      }
    }
    if (this.coop?.role === 'host') this.coop.frame(w, this.time.now);
    // A local bot party (?botparty): allies take the bot's card.
    // A co-op host picks for its fill bots (V7); guests pick their own.
    if ((!this.coop || this.coop.role === 'host') && w.state === 'draft') {
      for (let i = 1; i < w.heroes.length; i++) if ((!this.coop || isBotAlly(w, i)) && w.choicesOf(i).length) { w.use(i); const c = botChoose(w); w.use(0); w.choose(c, i); }
    }
    if ((!this.paused || this.coop) && w.state === 'draft') {
      const key = w.player.level * 100 + w.player.pendingLevels;
      if (this.autopilot && this.autoPick && w.choices.length) this.pick(botChoose(w));
      else if (this.sentPick !== key) this.hud.showDraft(w);
    } else if (w.state !== 'draft') this.hud.hideDraft();
    const alpha = this.coop?.role === 'guest'
      ? Math.min(1, this.snapAge / SNAP_SECONDS)
      : w.state === 'running' && (!this.paused || this.coop) ? this.acc / TICK : 1;
    this.render(alpha, deltaMs / 1000);
    if (this.hd2d) {
      this.hd2dAlpha = alpha;
      this.hd2dDt += deltaMs / 1000;
      this.bridgeFilter();
      // Phase 18 Halls: a map is too big for one fixed bridge (2.5 world units a pixel over today's arena would be about 7
      // over the Kiln map), so on the map it follows your hero at today's span, snapped to whole bridge pixels so the floor
      // doesn't shimmer. Back at (0, 0) for the boss arena and every other run.
      const b = this.bridge;
      if (b) {
        const p = w.player, on = w.hallsOn, step = b.span / b.n;
        const hx = on ? p.px + (p.x - p.px) * alpha : 0, hy = on ? p.py + (p.y - p.py) * alpha : 0;
        const cx = Math.round(hx / step) * step, cy = Math.round(hy / step) * step;
        if (cx !== b.cx || cy !== b.cy) { b.cx = cx; b.cy = cy; b.cam.centerOn(cx, cy); }
      }
      // With the floor bridge, the 3D frame is drawn after Phaser renders (bridgeCopy), so the floor it lays is this frame's.
      if (!this.bridge) { this.hd2d.frame(this.hd2dDt); this.hd2dDt = 0; this.foeEdgeMarks3d(this.time.now); }
    }
    this.hud.tick(w, this.fps());
  }

  /** Co-op guest: draw the newest snapshot and send movement (about 30 times a second). */
  private guestFrame(deltaMs: number): void {
    const w = this.world;
    const c = this.coop!;
    const s = c.take();
    if (s) {
      applySnapshot(w, s, c.me);
      this.snapAge = 0;
      this.handleEvents(w.events);
    } else this.snapAge += deltaMs / 1000;
    if (w.state === 'running' && this.time.now - this.lastInputAt > 33) {
      this.lastInputAt = this.time.now;
      const inp = this.readInput();
      c.sendInput(inp.x, inp.y);
    }
  }

  fps(): { avg: number; p95ms: number } {
    const n = this.frameTimes.length;
    if (!n) return { avg: 0, p95ms: 0 };
    const sum = this.frameTimes.reduce((a, b) => a + b, 0);
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    return { avg: 1000 / (sum / n), p95ms: sorted[Math.floor(n * 0.95)] };
  }

  private addShape(s: Omit<Shape, 'max'>): void {
    if (this.shapes.length > 40) this.shapes.shift();
    this.shapes.push({ ...s, max: s.life });
  }

  private handleEvents(events: SimEvent[]): void {
    const w = this.world;
    // The raid: Ladle Pour Seared the other tank, so this tank takes the boss.
    const swap = w.swapCue;
    if (swap && !this.swapShown) this.hud.warn('Swap tanks!', `The other tank is Seared. Take her with ${w.abilities[3].name}`);
    this.swapShown = swap;
    audio.events(events, {
      cls: w.cls,
      acting: w.acting,
      hp: w.heroes.length > 1 ? w.heroes.map((_, i) => w.heroData(i).player.hp) : undefined,
      boss: w.bossIndex >= 0 ? w.enemies[w.bossIndex]?.kind : undefined,
      // Ironload marked on you plays the same "it's on you" sting as Anvilfall.
      anvilOnMe: w.dungeonId === 'hammerdeep' && (w.anvilOnMe || (w.loadHero === w.acting && w.loadT > 0)),
      ebbPull: w.dungeonId === 'wrackline' && w.ebbT > 0,
      outsurge: w.dungeonId === 'wrackline' && w.outsurge,
      whirl: w.dungeonId === 'wrackline' && w.whirl,
      swallowLeft: w.dungeonId === 'hoard' ? w.player.swallowT ?? 0 : 0,
      pressed: w.dungeonId === 'pressworks' && (w.player.pressedT ?? 0) > 0,
      spent: w.dungeonId === 'flue' && (w.player.spentT ?? 0) > 0,
      gaze: w.enemies.filter((e) => e.alive && e.kind === 'lampeye').map((e) => ({ aux: e.aux, sees: w.player.hp > 0 && w.lampeyeSees(e, w.player.x, w.player.y) })),
      islands: w.islands,
      myIsland: w.islands.length ? myIsland(w) : -1,
      stance: w.player.stance,
      worldBoss: w.worldBoss || undefined,
      colossus: colossusCue(w),
      t: w.time,
      dungeon: w.dungeonId,
      namedAffix: w.namedPlan()?.affix,
      heat: w.heat || undefined,
      // ONDRELV2: standing in Ondrel's burning slag sizzles like the Kiln's lava.
      inLava: (w.lava.length > 0 && inLavaNow(w)) || (w.slagPatches.length > 0 && w.player.hp > 0 && w.inSlag(w.player.x, w.player.y)),
      slag: w.slagPatches,
      kmHeat: w.kmStage ? w.kmHeat : undefined,
      // One entry per flame slot (a fallen flame counts as covered), so flameCues keeps each flame's own edge.
      ysFlames: w.ysStage === 2 ? ([[w.ysF0, w.ysAway0], [w.ysF1, w.ysAway1]] as const).map(([j, away]) => { const f = j >= 0 ? w.enemies[j] : undefined; return f?.alive ? { x: f.x, y: f.y, away } : { x: 0, y: 0, away: 0 }; }) : undefined,
      inRime: inRimeNow(w),
      sets: setFlagsOf(w.player, (id) => w.setCount(id), behindColossusNow(w)),
      listen: this.listenFrom(w),
      arenaR: w.arenaR,
      roomSounds: this.hd2d?.sounds?.(),
      hallsPacks: w.hallsOn ? w.halls!.packs : undefined,
      hallsResting: w.hallsResting,
      // OSKELV2: from stage 2 the running press bed plays in place of the room's bed (arena or Halls).
      hallsBed: w.player.hp <= 0 ? null : w.osStage >= 2 ? 'pressBelt' : w.hallsOn ? roomBedFor(w.halls, w.player.x, w.player.y) : null,
      osFlip: w.osStage === 2 && w.osFlipT > 0,
      roles: w.heroes.length > 1 ? w.heroes.map((h, i) => roleOf(CLASSES[h.cls].role, w.heroData(i).player.stance)) : undefined,
      revive: w.heroes.length > 1 ? { t: w.heroes.map((_, i) => w.heroData(i).player.reviveT ?? 0), need: w.reviveSeconds, left: w.revivesLeft } : undefined,
    });
    // A named foe steps out as its fight starts: its banner follows the fight's own (encounterStart), which would replace it.
    const fightStarts = events.some((e) => e.type === 'encounterStart');
    for (const ev of events) {
      switch (ev.type) {
        case 'hit':
          if (this.hitSparks < 12) {
            this.hitSparks++;
            this.impact(ev.x, ev.y, ev.crit ? 0.75 : 0.45);
          }
          // A big crit freezes the frame for a blink (solo only: co-op never stalls the shared run).
          if (ev.crit && ev.amount >= 60 && !this.coop && this.time.now - this.lastCritStop > 350) {
            this.lastCritStop = this.time.now;
            this.stop(0.035);
          }
          if (ev.crit || ev.amount >= 40) this.floatText(ev.x, ev.y - 10, Math.round(ev.amount).toString(), ev.crit ? '#ffe08a' : '#ffffff', ev.crit ? 18 : 14);
          break;
        case 'kill':
          this.death(ev.kind, ev.x, ev.y);
          if (ENEMIES[ev.kind].rank === 'boss') this.bossDeath(ev.kind, ev.x, ev.y);
          else if (ENEMIES[ev.kind].rank === 'rare' || ev.kind === 'cinderBrute') {
            this.burst(ev.x, ev.y, 24);
            this.ring(ev.x, ev.y, 120, 0xffb347, 0.5);
            this.shakeBy(0.4);
            this.punch = Math.max(this.punch, 0.05);
            this.stop(0.08);
          } else this.burst(ev.x, ev.y, 4);
          break;
        case 'explode':
        case 'strike':
          if (ev.type === 'explode' && w.vents.some((v) => Math.abs(v.x - ev.x) < 2 && Math.abs(v.y - ev.y) < 2)) {
            // A vent boils Maelra's Temper off: a column of steam instead of fire.
            for (let k = 0; k < 8; k++) this.steam(ev.x + (Math.random() - 0.5) * ev.r, ev.y + (Math.random() - 0.5) * ev.r * 0.5, 1 + Math.random() * 0.8);
            this.ring(ev.x, ev.y, ev.r * 1.3, 0xd8f6ff, 0.45);
            this.floatText(ev.x, ev.y - 40, 'Temper boiled off!', '#d8f6ff', 16);
            break;
          }
          this.blast(ev.x, ev.y, ev.r);
          this.ring(ev.x, ev.y, ev.r, 0xffa050, 0.3);
          break;
        case 'ysFlare':
          // YSMERETV2: a lone flame flared and hit every hero.
          this.blast(ev.x, ev.y, YSMERETV2.flareR, DANGER);
          this.ring(ev.x, ev.y, YSMERETV2.flareR * 2.2, 0xff6a2a, 0.45);
          this.floatText(ev.x, ev.y - 60, 'Flare!', '#ff8a5a', 18);
          this.shake = Math.max(this.shake, 0.25);
          break;
        case 'slam':
          this.blast(ev.x, ev.y, ev.r, DANGER);
          this.ring(ev.x, ev.y, ev.r, DANGER, 0.35);
          this.shake = Math.max(this.shake, 0.18);
          break;
        case 'playerHurt':
          // Co-op: shake and flash only for hits on your own hero.
          if (ev.hero !== undefined && ev.hero !== w.acting) break;
          this.shake = Math.max(this.shake, ev.amount >= 20 ? 0.3 : 0.08);
          this.pulseVignette(ev.amount >= 20 ? 'hurt big' : 'hurt');
          break;
        case 'levelUp': {
          // Co-op: the pillar of light rises on whoever levelled.
          const lp = ev.hero !== undefined && ev.hero !== w.acting ? w.heroData(ev.hero).player : w.player;
          this.burst(lp.x, lp.y, 16);
          this.ring(lp.x, lp.y, 110, 0xffd27a, 0.6);
          this.addShape({ kind: 'pillar', x: lp.x, y: lp.y, x2: 0, y2: 0, r: 26, angle: 0, color: 0xffd27a, life: 0.9 });
          break;
        }
        case 'ability':
          if (ev.alt) {
            this.altCast(ev.x, ev.y, ev.r);
          } else if (w.cls === 'lumen' && (ev.slot === 0 || ev.slot === 2)) {
            this.addShape({ kind: 'ring', x: ev.x, y: ev.y, x2: 0, y2: 0, r: ev.r, angle: 0, color: ev.slot === 0 ? 0xfff2b0 : 0xffd27a, life: 0.4 });
            if (ev.slot === 2) this.floatText(ev.x, ev.y - 36, w.abilities[2].name, '#ffe9a8', 18);
          } else if (w.cls === 'slagbinder') {
            // Cooling Shell: a cold ring out to what it covers. Plating and Interpose have their own events.
            if (ev.slot === 2) {
              this.ring(ev.x, ev.y, ev.r + 30, SLAG_COOL, 0.5);
              this.addShape({ kind: 'ring', x: ev.x, y: ev.y, x2: 0, y2: 0, r: ev.r, angle: 0, color: SLAG_COOL, life: 0.5 });
              for (let k = 0; k < 6; k++) this.steam(ev.x + (Math.random() - 0.5) * 40, ev.y + (Math.random() - 0.5) * 20, 0.6 + Math.random() * 0.4);
              this.floatText(ev.x, ev.y - 36, w.abilities[2].name, '#cfe0ea', 18);
            }
          } else if (w.cls === 'bulwark' && ev.slot === 0) {
            this.addShape({ kind: 'cone', x: ev.x, y: ev.y, x2: 0, y2: 0, r: ev.r, angle: ev.angle, color: 0xdfe7f2, life: 0.25 });
            this.shake = Math.max(this.shake, 0.12);
          } else if (w.cls === 'bulwark' && ev.slot === 2) {
            this.addShape({ kind: 'ring', x: ev.x, y: ev.y, x2: 0, y2: 0, r: ev.r, angle: 0, color: 0xffd27a, life: 0.5 });
            this.floatText(ev.x, ev.y - 36, w.abilities[2].name, '#ffd27a', 18);
          } else if (ev.slot === 0) {
            this.addShape({ kind: 'cone', x: ev.x, y: ev.y, x2: 0, y2: 0, r: ev.r, angle: ev.angle, color: 0xff8a3d, life: 0.3 });
            // Flames licking out along the wave front.
            for (let k = 0; k < 9; k++) {
              const a = ev.angle + (k / 8 - 0.5) * 1.8;
              const d = ev.r * (0.35 + Math.random() * 0.25);
              this.spark(ev.x + Math.cos(a) * d, ev.y + Math.sin(a) * d, Math.cos(a) * 260, Math.sin(a) * 260, 0.35, 2.2);
            }
          } else if (ev.slot === 2) {
            this.blast(ev.x, ev.y, ev.r);
            this.ring(ev.x, ev.y, ev.r * 1.1, 0xffb347, 0.45);
            this.burst(ev.x, ev.y, 18);
            this.addShape({ kind: 'ring', x: ev.x, y: ev.y, x2: 0, y2: 0, r: ev.r, angle: 0, color: 0xffb347, life: 0.4 });
            this.shake = Math.max(this.shake, 0.25);
          } else if (ev.slot === 3) {
            this.addShape({ kind: 'line', x: w.player.x, y: w.player.y, x2: ev.x, y2: ev.y, r: 0, angle: 0, color: 0x8fd8ff, life: 0.25 });
          }
          break;
        case 'swing':
          this.addShape({ kind: 'cone', x: ev.x, y: ev.y, x2: 0, y2: 0, r: ev.r, angle: ev.angle, arc: ev.arc, color: ev.spin ? 0xe0465a : 0xd9c8ff, life: 0.16 });
          break;
        case 'dash':
          this.addShape({ kind: 'line', x: ev.x1, y: ev.y1, x2: ev.x2, y2: ev.y2, r: 0, angle: 0, color: ev.dodge ? 0x8fc7a8 : 0xb58cff, life: 0.25 });
          if (!ev.dodge) this.burst(ev.x2, ev.y2, 8);
          this.trailDash(ev.x1, ev.y1, ev.x2, ev.y2);
          break;
        case 'mote':
          this.addShape({ kind: 'line', x: ev.x1, y: ev.y1, x2: ev.x2, y2: ev.y2, r: 0, angle: 0, color: 0xfff2b0, life: 0.12 });
          break;
        case 'lob':
          this.slagLob(ev.x1, ev.y1, ev.x2, ev.y2);
          break;
        case 'plate':
          // Molten Plating poured on a hero: a bright ring closing in and a few drips.
          this.emit(this.fx, 'ring', undefined, ev.x, ev.y + 8, 0.35, { tint: SLAG, sx0: 0.9, sx1: 0.35 });
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * Math.PI * 2;
            this.emit(this.fx, 'spark', undefined, ev.x + Math.cos(a) * 26, ev.y + Math.sin(a) * 12, 0.4, { tint: SLAG, vx: -Math.cos(a) * 40, vy: 30, drag: 0.92, sx0: 0.5, sx1: 0.15 });
          }
          if (ev.hero !== w.acting) this.floatText(ev.x, ev.y - 34, 'Plated', '#ffc08a', 14);
          break;
        case 'brittle':
          this.floatText(ev.x, ev.y - 30, 'Brittle', '#d8d0c6', 13);
          for (let k = 0; k < 5; k++) this.emit(this.fx, 'spark', undefined, ev.x, ev.y - 6, 0.35, { tint: 0xe8e0d6, vx: (Math.random() - 0.5) * 160, vy: -40 - Math.random() * 80, drag: 0.9, sx0: 0.45, sx1: 0.1 });
          break;
        case 'parry':
          this.floatText(ev.x, ev.y - 34, 'Parry!', '#f1e6ff', 18);
          this.addShape({ kind: 'ring', x: ev.x, y: ev.y, x2: 0, y2: 0, r: 46, angle: 0, color: 0xf1e6ff, life: 0.3 });
          break;
        case 'blink':
          this.addShape({ kind: 'line', x: ev.x1, y: ev.y1, x2: ev.x2, y2: ev.y2, r: 0, angle: 0, color: 0xffc861, life: 0.3 });
          this.burst(ev.x2, ev.y2, 10);
          this.trailDash(ev.x1, ev.y1, ev.x2, ev.y2);
          break;
        case 'ward': {
          const we = w.enemies[ev.index];
          if (we) {
            this.ring(we.x, we.y, we.def.radius + 30, 0xcfe6ff, 0.4);
            this.floatText(we.x, we.y - we.def.radius - 30, 'Warded!', '#dfeeff', 16);
          }
          break;
        }
        case 'castDone':
          if (ev.name === 'Undertow') {
            // Water rushes from the hero to Maelra.
            this.addShape({ kind: 'line', x: w.player.x, y: w.player.y, x2: ev.x, y2: ev.y, r: 0, angle: 0, color: 0x5ab8ff, life: 0.45 });
            this.ring(w.player.x, w.player.y, 90, 0x5ab8ff, 0.4);
            for (let k = 0; k < 5; k++) this.steam(w.player.x + (Math.random() - 0.5) * 40, w.player.y, 0.8);
          } else if (ev.name === 'Anvilfall') {
            // The anvil lands: a heavy shake and a ring of grit.
            const t = w.heroData(w.anvilfallTarget).player;
            this.ring(t.x, t.y, 110, 0xc8d0e0, 0.45);
            this.burst(t.x, t.y, 16);
            this.shakeBy(0.45);
          } else if (ev.name === 'Choir of Iron') {
            // The iron bell tolls through every hero.
            for (let k = 0; k < w.heroes.length; k++) {
              const q = w.heroData(k).player;
              if (q.hp > 0) this.ring(q.x, q.y, 80, 0xffd27a, 0.45);
            }
            this.ring(ev.x, ev.y, 600, 0xffd27a, 0.6);
            this.shakeBy(0.22);
            this.pulseVignette('hurt');
          } else if (ev.name === 'Hammer Sweep') {
            this.shakeBy(0.15);
          } else if (ev.name === 'Bellow Slam') {
            // Both flames hit the tank at once: a gold and a rose ring and a hard shake.
            const t = w.heroData(w.bellowSlamTarget).player;
            this.ring(t.x, t.y, 90, SOAK, 0.4);
            this.ring(t.x, t.y, 120, 0xff6b8a, 0.5);
            this.blast(t.x, t.y, 50, 0xffb070);
            this.shakeBy(0.35);
          } else if (ev.name === 'Scatter Embers') {
            this.shakeBy(0.2);
          } else if (ev.name === 'Ladle Pour') {
            // The ladle empties onto the tank: a molten splash, droplets and a hard shake.
            const t = w.heroData(w.ladlePourTarget).player;
            this.ring(t.x, t.y, 100, MOLTEN, 0.45);
            this.blast(t.x, t.y, 60, 0xffb347);
            if (!this.lowFx) for (let m = 0; m < 14; m++) {
              const a = Math.random() * Math.PI * 2;
              const sp = 80 + Math.random() * 120;
              this.emit(this.fx, 'spark', undefined, t.x, t.y - 6, 0.7, { tint: m % 2 ? MOLTEN : 0xffd27a, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - 80, drag: 0.92, sx0: 2, sx1: 0.4 });
            }
            this.shakeBy(0.35);
          } else if (ev.name === 'The Pour') {
            this.shakeBy(0.15);
          } else if (ev.name === 'Last Ember') {
            this.ring(ev.x, ev.y, 700, 0xffd27a, 0.8);
            this.blast(ev.x, ev.y, 220, MOLTEN);
            this.shakeBy(0.8);
            this.pulseVignette('hurt big');
          } else if (ev.name === 'Snuff') {
            // Every coal gutters: a puff of dark smoke and a closing ring on each hero.
            for (let k = 0; k < w.heroes.length; k++) {
              const q = w.heroData(k).player;
              if (q.hp <= 0) continue;
              this.ring(q.x, q.y, (q.coalR ?? w.coalMaxR) * 0.9, 0x6a86b8, 0.45);
              for (let n = 0; n < 8; n++) {
                const a = (n / 8) * Math.PI * 2;
                this.emit(this.fx, 'spark', undefined, q.x + Math.cos(a) * 20, q.y + Math.sin(a) * 12, 0.7, { tint: 0x8fb0e8, vx: Math.cos(a) * 60, vy: Math.sin(a) * 30 - 40, drag: 0.92, sx0: 1.6, sx1: 3 });
              }
            }
            this.shakeBy(0.12);
          } else if (ev.name === 'Long Night') {
            // The cold breaks over everyone: a white frost ring per hero, a hard shake and the frost edge flaring.
            for (let k = 0; k < w.heroes.length; k++) {
              const q = w.heroData(k).player;
              if (q.hp > 0) this.ring(q.x, q.y, 120, 0xdff4ff, 0.5);
            }
            this.ring(ev.x, ev.y, 650, FROST, 0.7);
            this.shakeBy(0.4);
            this.pulseVignette('hurt big');
            if (this.frost) { this.frost.classList.remove('flash'); void this.frost.offsetWidth; this.frost.classList.add('flash'); }
          }
          break;
        case 'castStart':
          if (ev.name === 'Glare') this.hud.warn('Glare!', `Hide behind a pillar${w.dungeonId === 'glarewell' && w.enemies.some((o) => o.alive && o.castId === 'glare' && o.kind === 'lensbearer') ? `, or ${w.abilities[3].name} it` : ''}`);
          else if (ev.name === 'Brand' || ev.name === 'Twin Brand') this.hud.warn(ev.name === 'Twin Brand' ? 'Twin Brand!' : 'Branded!', 'Get clear of pillars and enemies before it bursts');
          else if (ev.name === 'Molten Cataclysm') this.hud.warn('Molten Cataclysm!', `Interrupt it with ${w.abilities[3].name}, or brace for impact`);
          else if (ev.name === 'Anvilfall') this.hud.warn('Anvilfall!', this.hud.compact ? 'Tanks: Anvil Skin or Cooling Shell now. Everyone else: heal them' : 'A huge hit on its target. Tanks: Anvil Skin or Cooling Shell now. Everyone else: heal them');
          else if (ev.name === 'Choir of Iron') this.hud.warn('Choir of Iron!', 'The whole party is hit. Healers: get ready');
          else if (ev.name === 'Twin Vents') this.hud.warn('Twin Vents!', 'Split up: someone in each gold vent');
          else if (ev.name === 'Downstroke') this.hud.warn('Downstroke!', (w.player.pressedT ?? 0) > 0 ? "You're Pressed: stay out of this one" : 'One hero who is not Pressed stands under the plate. Take turns');
          else if (ev.name === 'Stamp') this.hud.warn('Stamp!', 'A huge hit on its target. Tanks: Anvil Skin or Cooling Shell now');
          else if (ev.name === 'Scatter Embers') this.hud.warn('Scatter Embers!', 'Spread out: keep your ring off everyone else');
          else if (ev.name === 'Snuff') this.hud.warn('Snuff!', `${w.abilities[3].name} it, or every Hearthcoal dims`);
          else if (ev.name === 'Long Night') this.hud.warn('The Long Night!', w.heroes.length > 1 ? "It can't be stopped. Huddle up in the brightest light: every ally close by takes some of the cold" : "It can't be stopped. Get into the brightest light you can");
          else if (ev.name === 'Dark Call') this.hud.warn('Dark Call!', "Get your coal's light on the Dimhorn");
          else if (ev.name === 'Snuffer Tide') this.hud.warn('Snuffer Tide!', 'Kill the Snuffers before they drink your light');
          else if (ev.name === 'Thin Ice') this.hud.warn('Thin Ice!', "The river cracks. Stay off open water. She's stuck and takes more damage.");
          else if (ev.name === 'Frost Lace' && !this.laceShown) {
            // Once a fight: the Weaver casts it every few seconds, and its cast bar says the rest.
            this.laceShown = true;
            this.hud.warn('Frost Lace!', `Step out of the ring, or ${w.abilities[3].name} the Weaver`);
          }
          // The Wrackline.
          else if (ev.name === 'The Ebb') this.hud.warn('The Ebb!', w.hallsOn ? 'Get on a raft: the water keeps them off until it stops.' : 'The water is about to pull. Get on a raft');
          else if (ev.name === 'Sink') this.hud.warn('Sink!', `${w.abilities[3].name} it, or the marked raft goes under`);
          else if (ev.name === 'Call the Shoal') this.hud.warn('Call the Shoal!', "Lurkers swim in. They can't climb onto a raft");
          // The raid: Grandmother Slag.
          else if (ev.name === 'Ladle Pour') this.hud.warn('Ladle Pour!', 'A huge hit on the tank. Healers: heal the Ladle Burn off them');
          else if (ev.name === 'The Pour') this.hud.warn('The Pour!', 'Molten lanes: step out of the red');
          else if (ev.name === 'Crucible Vents') this.hud.warn('Crucible Vents!', 'Split up: someone in each gold vent');
          else if (ev.name === 'Cinder Marks') this.hud.warn('Cinder Marks!', 'Spread out: keep your ring off everyone else');
          else if (ev.name === 'Last Ember') this.hud.warn('Last Ember!', 'She burns everything. Finish her now');
          // Raid 3: the Cinder Colossus.
          else if (ev.name === 'Wheel') this.hud.warn('Wheel!', 'He is turning on someone. Get out of his front');
          else if (ev.name === 'Pour Out') this.hud.warn('Pour Out!', "It can't be stopped. Finish him now");
          // Raid 4: the Furnace Regent.
          else if (ev.name === 'Last Word') this.hud.warn('Last Word!', 'Kill him before he finishes');
          // Raid 2: Old Vorhulm.
          else if (ev.name === 'Swallow') this.hud.warn('Swallow!', (w.player.swallowT ?? 0) > 0 ? "You're inside. Hold on: your party is breaking the Craw" : 'Break the Craw on his side to get them out');
          else if (ev.name === 'Last Meal') this.hud.warn('Last Meal!', "It can't be stopped. Finish him now");
          break;
        case 'interrupt':
          this.floatText(ev.x, ev.y - 40, 'Interrupted!', '#8fd8ff', 18);
          this.burst(ev.x, ev.y, 14);
          this.ring(ev.x, ev.y, 90, 0x8fd8ff, 0.4);
          // The skill moment of the game: a short freeze and a nudge of the camera.
          if (!this.coop) this.stop(0.06);
          this.shakeBy(0.12);
          break;
        case 'cleanse':
          // Hammerdeep: an ally's heal broke Slag Grip.
          this.floatText(ev.x, ev.y - 44, `${w.dungeonId === 'crucible' ? 'Ladle Burn' : 'Slag Grip'} cleared`, '#9fffc8', 15);
          break;
        case 'slagGrip':
          this.floatText(ev.x, ev.y - 44, `${w.dungeonId === 'crucible' ? 'Ladle Burn' : 'Slag Grip'} ×${ev.stacks}`, '#ff9a4a', 15);
          break;
        // The Hoard: Swallow, the Craw and Ember Feast.
        case 'swallowed':
        case 'spatOut':
        case 'digested': {
          const q = w.hero(ev.hero).player;
          const msg = ev.type === 'swallowed' ? 'Swallowed! Break the Craw' : ev.type === 'spatOut' ? 'Spat out' : 'Digested';
          this.floatText(q.x, q.y - 50, msg, ev.type === 'spatOut' ? '#9fffc8' : '#ff9a4a', 16);
          if (ev.type === 'swallowed') this.shakeBy(0.1);
          break;
        }
        case 'emberEaten':
          this.floatText(ev.x, ev.y - 20, `Fed ×${ev.fed}`, '#ff9a4a', 13);
          if (w.dungeonId === 'hoard' && (w.bossVariant === 'bank' || w.bossEcho === 'bank')) this.bankEaten(ev.x, ev.y);
          break;
        // The Smeltery: Wheel snaps him round, and each Meltdown pulse rolls out from him.
        case 'wheel': {
          const e = w.enemies.find((q) => q.alive && q.kind === 'colossus');
          if (e) this.ring(e.x, e.y, 150, 0xffd27a, 0.35);
          this.shakeBy(0.08);
          break;
        }
        case 'meltPulse': {
          const e = w.enemies.find((q) => q.alive && q.kind === 'colossus');
          this.meltAt = w.time;
          if (e) { this.ring(e.x, e.y, 420, MOLTEN, 0.7); this.ring(e.x, e.y, 220, 0xffd27a, 0.45); }
          this.shakeBy(0.05);
          break;
        }
        // The Flue: a Decree lands with a flare, a pass flashes on its new holder, and a burst rolls out over everyone.
        case 'ventFlare':
          this.ring(ev.x, ev.y, LAYOUT.ventRadius, this.world.dungeonId === 'foundry' ? 0xdff6f0 : this.world.dungeonId === 'glarewell' ? 0xfff0c0 : 0xffb060, 0.35);
          break;
        case 'decree': {
          const q = this.heroXY(ev.hero);
          this.ring(q.x, q.y, 70, 0xff6a3d, 0.4);
          break;
        }
        case 'decreePassed': {
          const a = this.heroXY(ev.from);
          const q = this.heroXY(ev.hero);
          this.ring(a.x, a.y, 40, 0xb8b0a8, 0.35);
          if (!ev.done) this.ring(q.x, q.y, 60, 0xffb347, 0.4);
          break;
        }
        case 'decreeBurst': {
          const q = this.heroXY(ev.hero);
          this.ring(q.x, q.y, 320, 0xff4a2a, 0.7);
          this.ring(q.x, q.y, 160, 0xffd27a, 0.45);
          this.shakeBy(0.12);
          break;
        }
        case 'emberTaken':
          this.burst(ev.x, ev.y, 6);
          if (w.dungeonId === 'hoard' && (w.bossVariant === 'bank' || w.bossEcho === 'bank')) this.bankSmothered(ev.x, ev.y);
          break;
        case 'dodge':
          // Glarewarden: stepped out of a marked attack in time.
          this.floatText(ev.x, ev.y - 44, ev.healed > 0 ? `Dodged +${Math.round(ev.healed)}` : 'Dodged', '#5fe0c8', 16);
          // A teal ripple and a few motes rising off the hero.
          this.ring(ev.x, ev.y, 70, 0x5fe0c8, 0.4);
          for (let k = 0; k < 6; k++) this.spark(ev.x + (Math.random() - 0.5) * 30, ev.y + 10, (Math.random() - 0.5) * 40, -90 - Math.random() * 60, 0.6, 1.4);
          break;
        case 'potion':
          // Rising Draught: the hero gets back up in a column of gold.
          this.hud.banner('Rising Draught!', 'Back on your feet at a quarter health');
          this.ring(ev.x, ev.y, 120, 0xffc861, 0.6);
          this.burst(ev.x, ev.y, 24);
          this.floatText(ev.x, ev.y - 50, 'Risen!', '#ffd36a', 20);
          break;
        case 'glare':
          // The whole room flashes white-gold; a hit also shakes it.
          this.glareFlash = ev.hit ? 1 : 0.6;
          if (ev.hit) {
            this.shake = Math.max(this.shake, 0.3);
            this.floatText(ev.x, ev.y - 40, 'Glared!', '#ffe08a', 18);
          } else this.floatText(ev.x, ev.y - 40, 'Hidden', '#a8c8ff', 16);
          break;
        case 'brandBurst':
          this.blast(ev.x, ev.y, ev.r, 0xffc861);
          this.ring(ev.x, ev.y, ev.r, 0xffc861, 0.45);
          this.shake = Math.max(this.shake, 0.2);
          break;
        case 'pillarCrack': {
          const c = w.pillars[ev.index];
          if (c) {
            this.burst(c.x, c.y, 16);
            this.ring(c.x, c.y, c.r + 40, 0xd8cfc4, 0.4);
            this.floatText(c.x, c.y - c.r - 20, 'Pillar cracked!', '#d8cfc4', 16);
            this.shake = Math.max(this.shake, 0.25);
          }
          break;
        }
        case 'heal':
          this.floatText(ev.x, ev.y - 40, `+${Math.round(ev.amount)}`, '#7dffb0', 18);
          break;
        case 'phase':
          if (w.bossIndex >= 0 && w.enemies[w.bossIndex]?.kind === 'worldShadow') {
            // QA, 25 Nov: a world boss's Shadow fights as the Kiln Mother does (Acolytes, then faster casts) in every
            // dungeon, but took the dungeon boss's lines: after a staged Ondrel it read "Stage 2: Burning slag".
            if (ev.phase === 2) this.hud.banner('Phase 2: Ember Acolytes', 'Kill the healers, and stand in the gold circles');
            else this.hud.banner('Phase 3: The kiln cracks', `She casts faster. Keep ${w.abilities[3].name} ready`);
          } else if (w.dungeonId === 'pressworks' && w.osStage > 0) {
            // OSKELV2 (design, oskel-v2.md): one line per stage.
            // Both stages start the belt carrying heroes toward the crush line at once, so they are slim warning lines,
            // not the big banner over the floor (phone pass, 25 Nov), as Ondrel's stage 3 and Ysmeret's stage 2 are.
            if (ev.phase === 2) this.hud.warn('Stage 2: The belt', 'Walk against it; stay off the crush line');
            else this.hud.warn('Stage 3: Full speed', 'The belt runs faster. Keep walking');
          } else if (w.dungeonId === 'ashvents' && w.ysStage > 0) {
            // YSMERETV2 (design, ysmeret-v2.md): her stage 2.
            // A lone flame flares in 3 s, so this is a slim warning line, not the big banner over the floor (phone pass, 25 Nov).
            if (ev.phase === 2) this.hud.warn('Stage 2: Twofold', "A hero on each flame; the tank's flame still Bellows");
          } else if (w.dungeonId === 'hammerdeep' && w.ondrelStage > 0) {
            // ONDRELV2 (design, ondrel-v2.md): one line per stage.
            if (ev.phase === 2) this.hud.banner('Stage 2: Burning slag', 'Every Anvilfall leaves burning slag. Drag him off it');
            // Stage 3 gives 2.5 s to step out of the glowing slag: a slim warning line up top, as cast warnings are
            // (phone pass, 25 Nov: the big banner sat over the burst circles and the hero for the whole window).
            else this.hud.warn('Stage 3: The slag bursts', 'Get clear of it, then burn him');
          } else if (w.dungeonId === 'glarewell') {
            // Phase 2 names this run's version (it was always Twin Brand, even when she has none).
            if (ev.phase === 2 && w.bossVariant === 'glint') this.hud.banner('Phase 2: Glintfall', 'Light drops on every pillar. Step off your cover until it lands');
            else if (ev.phase === 2 && w.bossVariant === 'walk') this.hud.banner('Phase 2: Carried Light', 'She carries the light now. When a Glare starts, put a pillar between you and her');
            else if (ev.phase === 2) this.hud.banner('Phase 2: Twin Brand', 'Two Brands in a row. Burst them in the open');
            else if (w.bossEcho) this.hud.banner('Phase 3: The pillars fall', `She cracks a pillar every so often, and echoes ${BOSS_VERSION_NAME[w.bossEcho] ?? w.bossEcho}`);
            else this.hud.banner('Phase 3: The pillars fall', 'She cracks a pillar every so often. Save the rest');
          } else if (w.dungeonId === 'crucible') {
            if (ev.phase === 2 && w.bossVariant === 'brim') this.hud.banner('Phase 2: The Brimming', 'The pit fills. Stand on the cooling islands, and move before they sink');
            else if (ev.phase === 2 && w.bossVariant === 'flow') this.hud.banner('Phase 2: The Overflow', 'The pit floods in from the rim. When it rises, gather close to her');
            else if (ev.phase === 2) this.hud.banner('Phase 2: The Pour', 'Molten lanes and rising slag. Keep moving, healers keep everyone up');
            else this.hud.banner('Phase 3: Last Ember', 'Split up to fill both vents, then spread for the Cinder Marks');
          } else if (w.dungeonId === 'foundry') {
            if (ev.phase === 2 && w.bossVariant === 'tide') this.hud.banner('Phase 2: Sluicetide', 'The water runs across the room and pushes you. Lean into it, and watch for it to turn');
            else if (ev.phase === 2 && w.bossVariant === 'seal') this.hud.banner('Phase 2: Sealed Vents', 'Only one vent steams now. Drag her to it, and watch for the steam to move');
            else if (ev.phase === 2) this.hud.banner('Phase 2: Rising Water', `The arena shrinks. ${w.abilities[3].name} her Undertow`);
            else if (w.bossEcho) this.hud.banner('Phase 3: Overpressure', `The vents erupt on their own, and ${BOSS_VERSION_NAME[w.bossEcho] ?? w.bossEcho} comes and goes`);
            else this.hud.banner('Phase 3: Overpressure', 'The vents erupt on their own. Time your kiting');
          } else if (w.dungeonId === 'wrackline') {
            if (w.bossVariant === 'outsurge') this.hud.banner('Phase 2: The Outsurge', 'The water throws you out to the rim, and the rim burns. Stay on a raft');
            else if (w.bossVariant === 'whirl') this.hud.banner('Phase 2: The Whirl', 'The water swirls round the drain and carries you. It turns the other way each time');
            else this.hud.banner('Phase 2: Riptide', 'The rafts drift faster and the water pulls harder. Move with them');
          } else if (w.dungeonId === 'smeltery') {
            if (ev.phase === 2 && w.bossVariant === 'shift') this.hud.banner('Phase 2: Plate Shift', 'His plate slides round to face whoever hurts him most. Find his open back again');
            else if (ev.phase === 2 && w.bossVariant === 'mill') this.hud.banner('Phase 2: Millstone', 'He grinds round, pouring slag everywhere but his back. Walk round with him');
            else if (ev.phase === 2) this.hud.banner('Phase 2: Wheel', 'He turns on whoever hurts him most. Tank: take him back');
            else this.hud.banner('Phase 3: Meltdown', 'His plate cracks: hit him anywhere. Healers, the heat keeps rising');
          } else if (w.dungeonId === 'flue') {
            if (ev.phase === 2 && w.bossVariant === 'court') this.hud.banner('Phase 2: Edict', this.hud.compact ? 'Two Decrees at once. On a Summons, get inside his gold ring' : 'Two Decrees at once. When he calls a Summons, come inside the gold ring, but keep clear of a Decree');
            else if (ev.phase === 2 && w.bossVariant === 'tithe') this.hud.banner('Phase 2: Edict', this.hud.compact ? 'Two Decrees at once. On a Tithe, two or more share the gold circle' : 'Two Decrees at once. When he demands a Tithe, at least two of you share the gold circle, or everyone pays');
            else if (ev.phase === 2) this.hud.banner('Phase 2: Edict', 'Two Decrees at once. Each fades after one pass, and Ash falls under everyone');
            else this.hud.banner('Phase 3: Abdication', 'The Decrees lapse. Burn him down, the fire keeps rising');
          } else if (w.dungeonId === 'hoard') {
            if (ev.phase === 2) this.hud.banner('Phase 2: Swallow', 'He swallows one of you. Break the Craw to get them out');
            else if (w.bossVariant === 'bank') this.hud.banner('Phase 3: Banked Coals', 'Hot coals settle round him. Stand on each one as it lands, or he eats it');
            else if (w.bossVariant === 'inhale') this.hud.banner('Phase 3: Inhale', 'He breathes you in. Walk away from his mouth until he stops');
            else this.hud.banner('Phase 3: Ember Feast', 'Grab the spilled embers before he eats them');
          } else if (w.dungeonId === 'coldmarrow') {
            // Thin Ice has its own banner when the first cracks open.
          } else if (ev.phase === 2) this.hud.banner('Phase 2: Ember Acolytes', 'Kill the healers, and stand in the gold circles');
          else if (w.bossEcho) this.hud.banner('Phase 3: The kiln cracks', `She casts faster, and echoes ${BOSS_VERSION_NAME[w.bossEcho] ?? w.bossEcho}`);
          else this.hud.banner('Phase 3: The kiln cracks', `She casts faster. Keep ${w.abilities[3].name} ready`);
          break;
        case 'soak':
          // A Banked Coal (owner -4) has its own ember effects, and a missed one blasts nobody.
          if (ev.owner === -4) break;
          this.blast(ev.x, ev.y, 70, ev.ok ? SOAK : DANGER);
          if (!ev.ok) this.floatText(ev.x, ev.y, ev.owner === -5 ? 'Tithe unpaid!' : 'Brand missed!', '#ff8aa5', 16);
          break;
        case 'eliteSpawn':
          this.hud.banner('A Cinder Brute approaches', 'Interrupt its Ground Pound. Its death grants a bonus talent');
          break;
        case 'rareSpawn':
          this.hud.banner('Rare: Vorhulm the Glutton', 'Interrupt its Gorge or it heals. Drops rare loot');
          break;
        case 'riftOpen':
          this.hud.banner('A Hollow Rift tears open', 'Close it before the Tide pours out');
          break;
        case 'riftClosed':
          this.blast(ev.x, ev.y, 60);
          this.floatText(ev.x, ev.y - 30, 'Rift sealed', '#d6a8ff', 16);
          break;
        case 'gather':
          this.burst(ev.x, ev.y, 12);
          this.floatText(ev.x, ev.y - 24, '+30 Heat', '#ffb347', 15);
          break;
        case 'drop':
          this.dropFlourish(ev.x, ev.y, ev.rarity);
          break;
        case 'loot':
          if (ev.hero !== undefined && ev.hero !== w.acting) break;
          this.hud.toast(ev.item, ev.equipped, ev.delta);
          break;
        case 'quest': {
          const q = w.quests[ev.index];
          this.hud.ding('Quest complete');
          if (q) this.burst(w.player.x, w.player.y, 18);
          break;
        }
        case 'echo':
          // Phase 16 U1: the boss borrows another version's move. Name it, so a phone shows what's coming.
          this.hud.ding(`Echo: ${BOSS_VERSION_NAME[ev.id] ?? ev.id}`);
          this.echoAt = w.time;
          break;
        case 'emberDrift':
          // V8 Emberdrift: fresh embers drop in; a ring marks each as it lands.
          this.driftFallAt = this.time.now;
          this.time.delayedCall(550, () => { for (const m of this.world.driftEmbers) this.ring(m.x, m.y, 46, 0xffb060, 0.4); });
          break;
        case 'emberPick':
          this.burst(ev.x, ev.y, 10);
          this.ring(ev.x, ev.y, 40, 0xffd27a, 0.35);
          break;
        case 'tideTurn':
          // V8: Maelra's Sluicetide changes course (visuals draw the current).
          this.hud.ding('The tide turns');
          this.tideBeat = 1;
          break;
        case 'homeward': {
          // Y6 the Homeward Hammer: 'out' as he throws it (homeDraw flies it there for the circle's 1.8 s), 'back' as it lands.
          const b = w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
          if (ev.stage === 'out') this.homeThrow = { fx: b?.x ?? ev.x, fy: (b?.y ?? ev.y) - 30, tx: ev.x, ty: ev.y, t0: this.time.now };
          else {
            this.homeThrow = null;
            this.shakeBy(6);
            this.emit(this.fx, 'ring', undefined, ev.x, ev.y + 6, 0.4, { tint: 0xffc27a, sx0: 0.5, sx1: 1.3 });
            for (let m = 0; m < (this.lowFx ? 5 : 12); m++) {
              const a2 = (m / 12) * Math.PI * 2;
              this.emit(this.fx, 'spark', undefined, ev.x + Math.cos(a2) * 14, ev.y + Math.sin(a2) * 6, 0.45, { tint: 0xffd08a, vx: Math.cos(a2) * 160, vy: Math.sin(a2) * 70 - 60, drag: 0.92, sx0: 1.6, sx1: 0.3 });
            }
          }
          break;
        }
        case 'lightMove':
          // Y3 Carried Light: the shadows swing to point away from her.
          this.hud.ding('The light moves');
          this.ring(ev.x, ev.y, 70, 0xfff0c0, 0.6);
          {
            // Y6: the light glides from where it was onto her, and the shadow wedges swing with it.
            const from = this.lightLast;
            this.lightAnim = { fx: from.x, fy: from.y, tx: ev.x, ty: ev.y, t0: this.time.now };
          }
          break;
        case 'rimeRise':
          // Y3 Creeping Rime: the frost rises under Nhevra.
          this.hud.ding('The rime creeps');
          this.ring(ev.x, ev.y, CREEPING_RIME.r, 0xcfeaff, 0.7);
          // Y6: the frost spreads out from under her over 0.6 s (rimeDraw), with a puff of flakes.
          this.rimeBorn = this.time.now;
          this.rimeDir = { x: 0, y: 1, lx: ev.x, ly: ev.y };
          for (let m = 0; m < (this.lowFx ? 6 : 14); m++) {
            const a = (m / 14) * Math.PI * 2;
            this.emit(this.fx, 'frostFlake', undefined, ev.x + Math.cos(a) * 20, ev.y + Math.sin(a) * 12, 0.7, { tint: FROST, vx: Math.cos(a) * 120, vy: Math.sin(a) * 70, drag: 0.93, spin: 3, sx0: 1.2, sx1: 0.3 });
          }
          break;
        case 'ventShift': {
          // Y3 Sealed Vents: the steam is moving (warn) or has moved (open) to one vent.
          const v = w.vents[ev.vent];
          if (ev.stage === 'warn') this.hud.ding('The steam moves');
          if (v) this.ring(v.x, v.y, v.r + 16, 0xbfe6ff, ev.stage === 'open' ? 0.7 : 0.4);
          break;
        }
        case 'bossSpawn':
          this.shake = 0.6;
          break;
        case 'tideTurn':
          // V8: Maelra's Sluicetide changes course (visuals draw the current).
          this.hud.ding('The tide turns');
          break;
        case 'namedSpawn': {
          if (!fightStarts) this.hud.banner(ev.name, namedLine(ev.affix));
          // It steps out of the pack: a blue flare, rings and a little shake.
          const ne = w.enemies[ev.index];
          if (ne) {
            this.ring(ne.x, ne.y, ne.def.radius + 60, NAMED, 0.5);
            this.ring(ne.x, ne.y, ne.def.radius + 110, 0xe8f4ff, 0.7);
            this.blast(ne.x, ne.y, ne.def.radius + 20, NAMED);
            this.shakeBy(0.15);
          }
          break;
        }
        case 'waveShape':
          // Phase 15 Y1: a held pack about to come gets its own banner. A pincer or ring is named in the fight's
          // own banner (encounterStart), which comes after 'start' and would replace a banner here.
          if (ev.stage === 'warn') this.hud.warn(WAVE_SHAPE_INFO[ev.id].name, WAVE_SHAPE_INFO[ev.id].tip);
          {
            // Y6: a ring closing in round the hero, chevrons squeezing in from both flanks, or the gate the held pack
            // comes through (pulsing for its 2 s warning) and a burst as it arrives.
            const now = this.time.now;
            if (ev.stage === 'start' && (ev.id === 'ring' || ev.id === 'pincer')) this.waveFx.push({ kind: ev.id, x: w.player.x, y: w.player.y, a: Math.atan2(ev.y, ev.x), t0: now, dur: 1500 });
            else if (ev.stage === 'warn') this.waveFx.push({ kind: 'gate', x: ev.x, y: ev.y, a: Math.atan2(ev.y, ev.x), t0: now, dur: WAVES.reinforceWarn * 1000 + 300 });
            else if (ev.stage === 'land') {
              this.waveFx = this.waveFx.filter((f) => f.kind !== 'gate');
              this.waveFx.push({ kind: 'burst', x: ev.x, y: ev.y, a: Math.atan2(ev.y, ev.x), t0: now, dur: 600 });
              this.shakeBy(0.08);
            }
          }
          break;
        case 'stir': {
          // Y10: the dungeon notices. The screen's edges darken and warm for a moment, grit falls, and the ground shudders.
          this.stirAt = this.time.now;
          this.shakeBy(0.12);
          if (this.vignette) { this.vignette.classList.remove('stir'); void this.vignette.offsetWidth; this.vignette.classList.add('stir'); }
          if (ev.id === 'elite') {
            // The extra elite is the newest elite (it spawns after the fight's own pack).
            let best = -1;
            w.enemies.forEach((e, i) => { if (e.alive && e.def.rank === 'elite' && (best < 0 || e.spawnedAt >= w.enemies[best].spawnedAt)) best = i; });
            this.stirElite = best >= 0 ? { i: best, at: w.enemies[best].spawnedAt } : null;
          }
          break;
        }
        case 'arenaEvent':
          // Phase 14 X3: the warning gets a banner. X6: what each event looks like as it lands (its warning is drawn
          // each frame in arenaEventDraw).
          // The warning wins over a fight's banner chain (stir, wave, named foe), which resumes after it.
          if (ev.stage === 'warn') this.hud.warn(ARENA_EVENT_INFO[ev.id].name, ARENA_EVENT_INFO[ev.id].tip, this.hud.pendingBanner());
          else if (ev.stage === 'land' && ev.id === 'caveIn') {
            this.shakeBy(0.35);
            for (const c of w.caveInSpots()) {
              this.ring(c.x, c.y, ARENA_EVENTS.caveRadius + 50, 0xb8aca4, 0.5);
              for (let m = 0; m < (this.lowFx ? 3 : 7); m++) this.emit(this.smoke, 'puff', undefined, c.x + (Math.random() - 0.5) * 50, c.y + (Math.random() - 0.5) * 24, 0.9 + Math.random() * 0.4, { tint: 0x9a8e88, vy: -30 - Math.random() * 30, vx: (Math.random() - 0.5) * 60, spin: 1, rot: Math.random() * 6, sx0: 1, sx1: 2.4 });
              if (!this.lowFx) for (let m = 0; m < 8; m++) { const a = Math.random() * Math.PI * 2; this.spark(c.x, c.y, Math.cos(a) * 140, Math.sin(a) * 90 - 60, 0.5, 1.6); }
            }
          } else if (ev.stage === 'land' && ev.id === 'coldSnap') {
            this.shakeBy(0.15);
            this.ring(w.player.x, w.player.y, 260, FROST, 0.6);
          } else if (ev.stage === 'land' && ev.id === 'ventSurge') this.shakeBy(0.25);
          break;
        case 'namedKill':
          this.hud.ding(`${ev.name.split(',')[0]} falls!`);
          // A crown of blue and gold sparks where it fell.
          this.ring(ev.x, ev.y, 120, NAMED, 0.5);
          this.blast(ev.x, ev.y, 60, 0xffd27a);
          if (!this.lowFx) for (let m = 0; m < 18; m++) {
            const a = (m / 18) * Math.PI * 2;
            this.emit(this.fx, 'spark', undefined, ev.x, ev.y - 10, 0.8, { tint: m % 3 ? NAMED : 0xffd27a, vx: Math.cos(a) * 160, vy: Math.sin(a) * 110 - 60, drag: 0.93, sx0: 1.8, sx1: 0.3 });
          }
          break;
        case 'encounterStart': {
          this.bossFell = false;
          const def = ENCOUNTERS[ev.id];
          // The first fight also names the run's Omens, so the player knows the twist.
          const omens = ev.index === 0 && w.omens.length
            ? ` Omens: ${w.omens.map((o) => `${OMENS[o].name} (${OMENS[o].tip.toLowerCase().replace(/\.$/, '')})`).join(', ')}.`
            : '';
          // L1: the first delve coaches each fight instead of the usual tip. Coach lines get the full-length banner.
          const coach = w.firstDelve ? coachLine(ev.id, w.abilities[3].name) : undefined;
          // V4: the first fight also names the Day's Heat.
          const heatDef = ev.index === 0 && w.heat ? HEATS[w.heat] : undefined;
          const heat = heatDef ? ` Today's Heat, ${heatDef.name}: ${heatDef.text}` : '';
          // V2: name the arena layout too, so the player knows why the floor looks different.
          const floor = w.layout === 'pillars' ? ' Stones block the way.' : w.layout === 'channel' ? ' Lava burns: cross it, don\'t stand in it.' : w.layout === 'vents' ? ' The vents flare in turn.' : '';
          // Phase 15 Y1: a pincer or ring wave says so in the fight banner (a banner of its own would be replaced by this one).
          const shaped = w.waveShape === 'pincer' || w.waveShape === 'ring' ? w.waveShape : undefined;
          // Phase 15 Y10: a stirred fight says so (a 'wave' reaction's wave line already says how they come).
          const stirTip = w.stir ? (w.stir === 'wave' ? STIR_INFO.wave.tip : STIR_INFO[w.stir].tip) : '';
          const stirLine = w.stir ? ` The dungeon stirs.${w.stir === 'wave' ? '' : ` ${stirTip}`}` : '';
          const ground = floor + stirLine + (shaped ? ` ${WAVE_SHAPE_INFO[shaped].tip}` : '');
          // V3: this run's Kiln Mother breathes in from phase 2 instead of casting Molten Cataclysm.
          const tip = ev.id === 'kilnMother' && w.bossVariant === 'draw' ? KILN_DRAW_TIP : ev.id === 'kilnMother' && w.bossVariant === 'turning' ? TURNING_FIRE_TIP : ev.id === 'maelra' && w.bossVariant === 'seal' ? SEALED_VENTS_TIP : ev.id === 'maelra' && w.bossVariant === 'tide' ? SLUICETIDE_TIP
            : ev.id === 'lensmother' && w.bossVariant === 'walk' ? CARRIED_LIGHT_TIP : ev.id === 'lensmother' && w.bossVariant === 'glint' ? GLINTFALL_TIP
            : ev.id === 'nhevra' && w.bossVariant === 'rime' ? CREEPING_RIME_TIP : ev.id === 'nhevra' && w.bossVariant === 'drift' ? EMBERDRIFT_TIP
            : ev.id === 'hessa' && w.bossVariant === 'whirl' ? WHIRL_TIP : ev.id === 'hessa' && w.bossVariant === 'outsurge' ? OUTSURGE_TIP
            : ev.id === 'ondrel' && w.bossVariant === 'home' ? HOMEWARD_TIP : ev.id === 'ondrel' && w.bossVariant === 'load' ? IRONLOAD_TIP
            : ev.id === 'ysmeret' && w.bossVariant === 'roll' ? ROLLING_TIP : ev.id === 'ysmeret' && w.bossVariant === 'wander' ? WANDER_TIP
            : ev.id === 'oskel' && w.bossVariant === 'punch' ? PUNCH_TIP : ev.id === 'oskel' && w.bossVariant === 'cut' ? DIECUT_TIP
            : ev.id === 'grandmotherSlag' && w.bossVariant === 'flow' ? OVERFLOW_TIP : ev.id === 'grandmotherSlag' && w.bossVariant === 'brim' ? BRIMMING_TIP
            : ev.id === 'vorhulm' && w.bossVariant === 'inhale' ? INHALE_TIP : ev.id === 'vorhulm' && w.bossVariant === 'bank' ? BANKED_TIP
            : ev.id === 'colossus' && w.bossVariant === 'shift' ? PLATE_SHIFT_TIP : ev.id === 'colossus' && w.bossVariant === 'mill' ? MILLSTONE_TIP
            : ev.id === 'regent' && w.bossVariant === 'court' ? COURT_TIP : ev.id === 'regent' && w.bossVariant === 'tithe' ? TITHE_TIP : def.tip;
          const title = ev.id === 'worldShadow' && w.worldBoss ? `Shadow of ${w.worldBoss}` : def.name;
          const named = events.find((e) => e.type === 'namedSpawn');
          const namedNext = named?.type === 'namedSpawn' ? { title: named.name, sub: namedLine(named.affix) } : undefined;
          if (w.hallsOn && !coach && !omens && !heat) {
            // Halls (keep it simple, design 25 Nov, every screen): a pack's tip shows only the first time this hero meets
            // that encounter, then just its name. A named foe folds into the same banner instead of a second one.
            const met = this.hud.tipSeen?.(ev.id) ?? false;
            if (!met) this.hud.markTip?.(ev.id);
            const lines = [met ? '' : (this.hud.compact ? PHONE_TIP[tip] ?? tip : tip) + ground, named?.type === 'namedSpawn'
              // Phones keep it to the name and trait (the target frame says NAMED and the trait too), so a first meeting's
              // tip plus the named line still fits the 4-line banner at 320 wide; other screens get the trait's line.
              ? (this.hud.compact ? `Named: ${named.name} (${named.affix}).` : `${named.name}: ${namedLine(named.affix).replace(/^A named/, 'a named')}`) : '']
              .map((l) => l.trim()).filter(Boolean);
            if (met && ground.trim()) lines.unshift(ground.trim());
            this.hud.banner(title, lines.join(' '));
          } else if (this.hud.compact && !coach && (omens || heat)) {
            // Phones: the fight tip and floor line first, then the Omens and Heat on a banner of their own,
            // so neither is cut off (a tip, a floor line, the Heat and four Omens don't fit even 4 lines at 320 wide).
            // The Omens banner names them only (details in pause); a Heat on its own has room for its line.
            const next = omens
              ? { title: w.omens.length === 1 ? 'Omen' : 'Omens', sub: `${w.omens.map((o) => OMENS[o].name).join(', ')}. Details in pause.${heatDef ? ` Today's Heat: ${heatDef.name}.` : ''}` }
              : { title: "Today's Heat", sub: `${heatDef!.name}: ${heatDef!.text}` };
            this.hud.banner(title, (PHONE_TIP[tip] ?? tip) + ground, false, namedNext ?? next);
          } else if (this.hud.compact && !coach && (shaped || w.stir)) {
            // Phones: a long fight tip, a floor line and the wave line overflow even 4 lines at 320 wide (the Ashbuck
            // in the Dark: 198 characters), and the wave line is the part cut off. Each gets its own banner right after,
            // the stir first (Y10), then the wave, then a named foe's (if one stepped out).
            const waveNext = shaped ? { title: WAVE_SHAPE_INFO[shaped].name, sub: WAVE_SHAPE_INFO[shaped].tip, next: namedNext } : namedNext;
            const after = w.stir ? { title: 'The dungeon stirs', sub: stirTip, next: waveNext } : waveNext;
            this.hud.banner(title, (PHONE_TIP[tip] ?? tip) + floor, false, after);
          } else this.hud.banner(title, coach ?? (this.hud.compact ? PHONE_TIP[tip] ?? tip : tip) + ground + heat + omens, !!coach, namedNext);
          break;
        }
        case 'fork':
          this.hud.banner('Choose your path', 'Walk into a gate. The steady fight is taken if you wait.');
          break;
        case 'hallsWake': {
          // A shrine has no fight (no encounterStart), so its wake names it.
          const pk = w.halls?.packs[ev.pack];
          if (pk?.enc === 'shrine') this.hud.banner(ENCOUNTERS.shrine.name, ENCOUNTERS.shrine.tip);
          break;
        }
        case 'hallsDoor':
          this.halls?.door();
          this.ground.setAlpha(1);
          break;
        case 'gateChosen':
          if (ev.kind === 'named') this.hud.ding('Named path!');
          break;
        case 'encounterClear':
          this.hud.ding(ev.index + 1 >= w.route.length ? 'Victory!' : 'Cleared!');
          break;
        case 'burnout':
          if (ev.warn) this.hud.banner('The fire is closing in', '30 seconds to finish this fight');
          else this.hud.banner('Burnout', 'The fire takes everything');
          break;
        case 'bossEnrage':
          this.hud.banner(`${ENCOUNTERS[w.dungeonDef.boss].name.split(',')[0]} is enraged`, 'Finish it, fast');
          break;
        case 'revive':
          if (ev.by !== undefined && ev.hero !== undefined) {
            const q = w.heroData(ev.hero).player;
            this.ring(q.x, q.y, REVIVE_RADIUS * 2.2, REVIVE, 0.55);
            this.blast(q.x, q.y, REVIVE_RADIUS, REVIVE);
            if (!this.lowFx) for (let m = 0; m < 14; m++) this.emit(this.fx, 'spark', undefined, q.x + (Math.random() - 0.5) * 36, q.y + 12, 0.9, { tint: REVIVE, vx: (Math.random() - 0.5) * 40, vy: -90 - Math.random() * 90, drag: 0.96, sx0: 1.8, sx1: 0.3 });
            if (ev.hero === w.acting) {
              this.hud.banner('Back on your feet', `${w.heroes[ev.by]?.name ?? 'An ally'} pulled you up`);
              break;
            }
          }
          if (ev.hero !== undefined && ev.hero !== w.acting) {
            this.floatText(w.heroData(ev.hero).player.x, w.heroData(ev.hero).player.y - 40, 'Back up!', '#ffd27a', 18);
            break;
          }
          if (w.cls === 'lumen' && w.player.haloUsed && w.player.hp <= 1) this.hud.banner("Martyr's Halo", 'The killing blow is turned aside');
          else this.hud.banner('Phoenix Feather', 'You rise from the ashes');
          break;
        case 'chest':
          this.burst(ev.x, ev.y, 30);
          break;
        case 'end':
          // A fallen boss gets its moment before the end screen covers it. Real time, not the scene clock: Phaser caps
          // each frame's step, so on a slow frame rate (3.5 fps in QA's software-GPU 3D run) a 1.7 s game-clock wait took 40 s.
          { const w = this.world; window.setTimeout(() => { if (this.world === w && this.sys.isActive()) this.onEnd(w); }, this.bossFell ? 1700 : 700); }
          break;
      }
    }
  }

  /** The 2D texture enemy slot `i` draws with (the HD-2D view stands the same sheet up in 3D). */
  private enemyTex(e: Enemy, i: number): string {
    const w = this.world;
    return e.kind === 'worldShadow' ? shadowSheet(w.worldBoss).key : e.kind === 'grandmotherSlag' ? (this.textures.exists('slagCroneRaid') ? 'slagCroneRaid' : 'slagCrone')
      : e.kind === 'slagling' && !this.textures.exists('slagling') ? 'ashling' : e.kind === 'emberTwin' && i % 2 ? 'emberTwinB' : e.kind === 'ondrel' && !this.textures.exists('ondrel') ? 'kilnMother'
      // Old Vorhulm and his Craw borrow the Vorhulm rare's and the rift's sheets until their own land.
      // The Cinder Colossus in person (raid 3) wears the 192 raid sheet, cracked in Meltdown; 'colossus' is his shadow's.
      : e.kind === 'colossus' ? (w.bossPhase >= 3 ? 'colossusMelt' : 'colossusRaid')
      // The Furnace Regent in person (raid 4) wears the 192 raid sheet, abdicating in phase 3; 'regent' is his shadow's.
      : e.kind === 'regent' ? (w.bossPhase >= 3 ? 'regentAbdicate' : 'regentRaid')
      : e.kind === 'vorhulm' && !this.textures.exists('vorhulm') ? 'ashmaw' : e.kind === 'craw' && !this.textures.exists('craw') ? 'rift'
      // V1 (variety): fallbacks from before their sheets existed (both drawn since #370).
      : e.kind === 'emberSpitter' && !this.textures.exists('emberSpitter') ? 'acolyte'
      : e.kind === 'ashbuck' && !this.textures.exists('ashbuck') ? 'cinderhound' : e.kind;
  }

  /** Frame `n` of a texture, cropped into its own canvas, for the HD-2D view (cached per key and frame). */
  private frameCanvas(key: string, n: number): HTMLCanvasElement | null {
    const id = `${key}#${n}`;
    const hit = this.frameCache.get(id);
    if (hit !== undefined) return hit;
    let out: HTMLCanvasElement | null = null;
    if (this.textures.exists(key)) {
      const f = this.textures.getFrame(key, String(n)) ?? this.textures.getFrame(key);
      const src = f?.source.image as CanvasImageSource | undefined;
      if (f && src) {
        out = document.createElement('canvas');
        out.width = f.cutWidth; out.height = f.cutHeight;
        out.getContext('2d')!.drawImage(src, f.cutX, f.cutY, f.cutWidth, f.cutHeight, 0, 0, f.cutWidth, f.cutHeight);
      }
    }
    this.frameCache.set(id, out);
    return out;
  }
  private readonly frameCache = new Map<string, HTMLCanvasElement | null>();

  // ---------------------------------------------------------------- rendering

  private render(a: number, dt: number): void {
    const w = this.world;
    const lerp = (p: number, c: number) => p + (c - p) * a;
    const p = w.player;
    const px = lerp(p.px, p.x);
    const py = lerp(p.py, p.y);

    const cam = this.cameras.main;
    let sx = 0;
    let sy = 0;
    // Halls: the map's camera rule zooms out to fit a room (1 = today's view).
    const mapK = this.halls?.zoomK ?? 1;
    const z0 = this.baseZoom / mapK;
    if (this.punch > 0) {
      this.punch = Math.max(0, this.punch - dt * 0.12);
      // The camera lean is part of the shake: only at Full.
      cam.setZoom(z0 * (1 + (display.shake === 'full' ? this.punch : 0)));
    } else if (cam.zoom !== z0) cam.setZoom(z0);
    if (mapK !== this.groundK) {
      // Zoomed out, the screen-fixed ground must cover more world.
      this.groundK = mapK;
      this.ground.setSize(this.scale.width / z0 + 4, this.scale.height / z0 + 4);
    }
    if (this.shake > 0) {
      this.shake -= dt;
      const m = Math.min(1, this.shake) * 10 * shakeScale();
      sx = (Math.random() - 0.5) * m;
      sy = (Math.random() - 0.5) * m;
    }
    this.bossInView(dt, px, py);
    cam.centerOn(px + this.focusX + (this.halls?.leadX ?? 0) + sx, py + this.focusY + (this.halls?.leadY ?? 0) + sy);
    // HD-2D hides this camera, and Phaser skips a hidden camera's preRender, which is what keeps worldView current.
    // Name plates, bars and edge marks all cull against worldView, so keep it current by hand.
    if (!cam.visible) {
      const dw = cam.width / cam.zoom, dh = cam.height / cam.zoom;
      cam.worldView.setTo(cam.midPoint.x - dw / 2, cam.midPoint.y - dh / 2, dw, dh);
    }
    this.ground.setTilePosition(cam.worldView.x, cam.worldView.y);
    this.ground.setTileScale(1);
    if (this.halls) this.hallsFrame(px, py, dt);

    // The hero: walk cycle while moving, a gentle breath while still.
    const now = this.time.now;
    const pdx = p.x - p.px;
    const pdy = p.y - p.py;
    const moving = pdx * pdx + pdy * pdy > 0.01;
    if (pdx > 0.05) this.facing = 1;
    else if (pdx < -0.05) this.facing = -1;
    const pf = moving ? Math.floor(now / 110) % (FRAMES[this.player.texture.key] ?? 1) : 0;
    if (this.player.frame.name !== String(pf)) this.player.setFrame(String(pf));
    const breath = moving ? 0 : Math.sin(now / 420) * 0.025;
    const squash = p.hurtFlash > 0 ? 0.1 : 0;
    this.player.setPosition(px, py).setFlipX(this.facing < 0).setScale(BASE * (1 + squash), BASE * (1 + breath - squash));
    this.playerShadow.setPosition(px, py + 22).setScale(34 / 32, 12 / 32);
    // Season trails: ours and each ally's drop motes while that hero moves.
    for (const tr of this.trails) {
      const q = w.heroData(tr.hero).player;
      if (q.hp <= 0) continue;
      if (tr.hero === w.acting) { if (moving) this.trailStep(tr, px, py, dt); }
      else if ((q.x - q.px) ** 2 + (q.y - q.py) ** 2 > 0.01) this.trailStep(tr, lerp(q.px, q.x), lerp(q.py, q.y), dt);
    }
    if (this.heroGlow) {
      const gp = Math.sin(now / 520);
      this.heroGlow.setPosition(px, py + 22).setScale((60 + gp * 3) / 128, (22 + gp * 1) / 128).setAlpha(p.hp > 0 ? 0.8 + gp * 0.15 : 0.3);
    }
    if (p.hurtFlash > 0) this.player.setTint(0xff6060).setTintMode(Phaser.TintModes.FILL);
    else if (p.shieldT > 0) this.player.setTint(0x8fd8ff).setTintMode(Phaser.TintModes.MULTIPLY);
    else if (p.bastionT > 0) this.player.setTint(0xffd27a).setTintMode(Phaser.TintModes.MULTIPLY);
    else if ((p.chill ?? 0) >= COLD.frozenAt) this.player.setTint(FROST).setTintMode(Phaser.TintModes.MULTIPLY);
    else this.player.clearTint();
    this.aura.setPosition(px, py).setScale(1 + Math.sin(this.time.now / 300) * 0.05 + (p.heat / 100) * 0.25);
    for (const al of this.allies) {
      const q = w.heroData(al.hero).player;
      const ax = lerp(q.px, q.x);
      const ay = lerp(q.py, q.y);
      const qm = (q.x - q.px) ** 2 + (q.y - q.py) ** 2 > 0.01;
      const af = qm ? Math.floor(now / 110) % (FRAMES[al.img.texture.key] ?? 1) : 0;
      if (al.img.frame.name !== String(af)) al.img.setFrame(String(af));
      const down = q.hp <= 0;
      al.img.setPosition(ax, ay).setFlipX(Math.cos(q.facing) < 0).setAlpha(down ? 0.45 : 1);
      if (q.hurtFlash > 0) al.img.setTint(0xff6060).setTintMode(Phaser.TintModes.FILL);
      else al.img.clearTint();
      al.shadow.setPosition(ax, ay + 22).setScale(34 / 32, 12 / 32);
      // The title sits just over the head and the name above it, so a titled hero reads "name / title".
      if (al.tag) al.tag.setPosition(ax, ay - 34).setAlpha(down ? 0.5 : 1);
      if (al.glow) {
        const gp = Math.sin(now / 520 + al.hero);
        // An ally's glow sits just outside their class ring (44 x 16), so the ring, which is how a healer finds
        // the tank in a crowd, always shows; a touch dimmer than your own so a full party doesn't crowd a phone.
        al.glow.setPosition(ax, ay + 22).setScale((78 + gp * 3) / 128, (29 + gp * 1) / 128).setAlpha(down ? 0.25 : 0.62 + gp * 0.12);
      }
      al.label.setPosition(ax, ay - (al.tag ? 34 + al.tag.height : 34)).setText(down ? `${al.name} · down` : al.name);
      setColorIf(al.label, down ? '#9a8a84' : CLASS_ICON[w.heroes[al.hero].cls].color);
      // A hero near the edge of a phone's view kept their name centred over them, so half of it ran off screen
      // ("Emberwri"). The name and title slide inward to stay whole; the hero's ring still marks where they are.
      const ev = cam.worldView;
      const pad = 6 / cam.zoom;
      const keepIn = (t: Phaser.GameObjects.Text, extraL: number) => {
        const hw = t.displayWidth / 2;
        const lo = ev.x + pad + hw + extraL;
        const hi = ev.right - pad - hw;
        if (lo < hi) t.x = Math.min(hi, Math.max(lo, t.x));
      };
      keepIn(al.label, al.mark ? al.label.displayHeight * 0.78 + 4 : 0);
      if (al.tag) keepIn(al.tag, 0);
    }
    this.unstackLabels();
    // A bot's mark rides just left of its name (after the names lift apart), at the name's cap height.
    for (const al of this.allies) {
      if (!al.mark) continue;
      const lb = al.label;
      const s = (lb.displayHeight * 0.78) / 48;
      al.mark.setScale(s).setPosition(lb.x - lb.displayWidth / 2 - 4, lb.y - lb.displayHeight * 0.5).setAlpha(lb.alpha * (w.heroData(al.hero).player.hp <= 0 ? 0.5 : 1));
    }
    this.hideCoveredLabels();

    const view = cam.worldView;
    const margin = 80;
    const onScreen = (x: number, y: number) => x > view.x - margin && x < view.right + margin && y > view.y - margin && y < view.bottom + margin;

    this.hitSparks = 0;
    if (now > this.fxCheckAt && this.frameTimes.length >= 120) {
      this.fxCheckAt = now + 2000;
      const fps = this.fps().avg;
      // Still slow with the light effects already on: render fewer pixels (lowerRes in main.ts).
      if (fps < 36 && this.lowFx && !this.resFloor && display.graphics === 'auto') {
        const lower = this.registry.get('lowerRes') as (() => boolean) | undefined;
        if (!lower || !lower()) this.resFloor = true;
        this.frameTimes.length = 0;
      }
      if (fps < 42) this.lowFx = true;
      else if (fps > 56) this.lowFx = false;
    }
    // The Graphics setting overrides the automatic choice.
    if (display.graphics !== 'auto') this.lowFx = display.graphics === 'saver';
    const cheap = this.lowFx;
    // Slots past the last live enemy only need hiding once (shownEnd), then are skipped.
    const eEnd = liveEnd(w.enemies);
    this.growPools(eEnd, liveEnd(w.orbs), liveEnd(w.gems));
    const eLoop = Math.min(w.enemies.length, Math.max(eEnd, this.shownEnd.enemies));
    this.shownEnd.enemies = eEnd;
    for (let i = 0; i < eLoop; i++) {
      const e = w.enemies[i];
      const s = this.enemySprites[i];
      const sh = this.shadows[i];
      if (!e.alive) {
        if (s.visible) { s.setVisible(false); sh.setVisible(false); }
        continue;
      }
      const x = lerp(e.px, e.x);
      const y = lerp(e.py, e.y);
      if (!onScreen(x, y)) {
        if (s.visible) { s.setVisible(false); sh.setVisible(false); }
        continue;
      }
      // The world boss shadow is the live boss's silhouette (Grandmother Slag's if the name is unknown);
      // Ember Twins alternate palettes by slot so a pair always reads as two.
      const tex = this.enemyTex(e, i);
      if (this.enemyKinds[i] !== tex) {
        s.setTexture(tex, '0').setAlpha(e.kind === 'worldShadow' ? 0.85 : 1);
        this.enemyKinds[i] = tex;
        this.enemyFrames[i] = 0;
      }
      // Walk cycle while moving; big and stationary foes idle-animate slowly.
      const frames = FRAMES[tex] ?? 1;
      if (frames > 1) {
        const dx = e.x - e.px;
        const dy = e.y - e.py;
        const walking = dx * dx + dy * dy > 0.01;
        const idle = e.def.stationary || e.def.rank === 'boss' || e.def.rank === 'rare';
        const fps = walking ? 6 + e.def.speed / 12 : idle ? 5 : 0;
        const fr = fps ? Math.floor(now / (1000 / fps) + i * 1.7) % frames : 0;
        if (fr !== this.enemyFrames[i]) { s.setFrame(String(fr)); this.enemyFrames[i] = fr; }
      }
      // Spawn: rise out of the ground with a little overshoot. Hit: squash.
      const age = w.time - e.spawnedAt;
      let k = 1;
      if (age < 0.3) {
        const t = age / 0.3;
        k = 0.3 + 0.7 * t + Math.sin(t * Math.PI) * 0.25;
      }
      const hit = e.flash > 0 ? 0.12 : 0;
      // Every shadow shows at the size Grandmother Slag's 128-unit sheet always did, whatever its sheet's size.
      const shadowScale = e.kind === 'worldShadow' ? (1.05 * 128) / shadowSheet(w.worldBoss).size : 1;
      s.setVisible(true).setPosition(x, y).setFlipX(e.kind === 'colossus' ? Math.cos(w.colFacing) < 0 : !e.def.stationary && x > px).setScale(BASE * k * (1 + hit) * (e.kind === 'worldShadow' ? shadowScale : 1), BASE * k * (1 - hit) * (e.kind === 'worldShadow' ? shadowScale : 1));
      const r = e.def.radius;
      if (cheap && e.def.rank === 'normal') { if (sh.visible) sh.setVisible(false); } else sh.setVisible(true).setPosition(x, y + r * 0.85).setScale((r * 2.5 * k) / 32, (r * 0.9 * k) / 32);
      if (e.kind === 'rift') s.setRotation(now / 900);
      else s.setRotation(e.stunT > 0 ? Math.sin(now / 60) * 0.15 : 0);
      if (!cheap && e.burnT > 0 && Math.random() < 0.03) this.spark(x + (Math.random() - 0.5) * r, y - r * 0.5, 0, -50, 0.5, 1.4);
      // Hit flash: small foes blink solid white; bosses and rares brighten instead, so a
      // big boss being hit nonstop never turns into a white silhouette.
      // Ondrel's iron is near black, so a full-strength screen flash washes it out: give it a softer one.
      // Old Vorhulm's coal is darker still and a raid hits him nearly every frame, so even the soft screen
      // flash left him grey all fight: his hits add a faint warm glow instead, as if the coal heats up. The Cinder
      // Colossus is the same dark cinder, so he gets it too, and so does the Furnace Regent's black iron. Grandmother
      // Slag's raid pot is dark iron too: the soft flash turned her flat beige a third of the fight (tools/slagflashshots.cjs).
      if (e.flash > 0 && (e.kind === 'vorhulm' || e.kind === 'colossus' || e.kind === 'regent' || e.kind === 'grandmotherSlag')) s.setTint(0x1c0c04).setTintMode(Phaser.TintModes.ADD);
      else if (e.flash > 0) s.setTint(idleRank(e) ? (e.kind === 'ondrel' ? 0x3a2e26 : 0x6a5a4a) : 0xffffff).setTintMode(idleRank(e) ? Phaser.TintModes.SCREEN : Phaser.TintModes.FILL);
      else if (e.stunT > 0) s.setTint(0x8fd8ff).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (e.burnT > 0) s.setTint(0xffa060).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (e.kind === 'frostWarden' && this.coalWarmth(e.x, e.y, r) > 0) s.setTint(0xffc49a).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (e.kind === 'worldShadow') s.setTint(0x8a6cff).setTintMode(Phaser.TintModes.MULTIPLY);
      // Phase 14 X6: a named foe's trait tints its body a little (Swift and Warded cool, Vengeful red, Brood sickly, Smoldering warm).
      else if (e.named >= 0 && AFFIX_TINT[AFFIXES[e.affix]]) s.setTint(AFFIX_TINT[AFFIXES[e.affix]]).setTintMode(Phaser.TintModes.MULTIPLY);
      else s.clearTint();
    }

    const oEnd = liveEnd(w.orbs);
    const oLoop = Math.min(w.orbs.length, Math.max(oEnd, this.shownEnd.orbs));
    this.shownEnd.orbs = oEnd;
    for (let i = 0; i < oLoop; i++) {
      const o = w.orbs[i];
      const s = this.orbSprites[i];
      if (!o.alive) { if (s.visible) s.setVisible(false); continue; }
      s.setVisible(true).setPosition(lerp(o.px, o.x), lerp(o.py, o.y)).setRotation(Math.atan2(o.vy, o.vx));
    }
    const gEnd = liveEnd(w.gems);
    const gLoop = Math.min(w.gems.length, Math.max(gEnd, this.shownEnd.gems));
    this.shownEnd.gems = gEnd;
    for (let i = 0; i < gLoop; i++) {
      const g = w.gems[i];
      const s = this.gemSprites[i];
      if (!g.alive) { if (s.visible) s.setVisible(false); continue; }
      const x = lerp(g.px, g.x);
      const y = lerp(g.py, g.y);
      if (!onScreen(x, y)) { if (s.visible) s.setVisible(false); continue; }
      s.setVisible(true).setPosition(x, y).setScale(g.value >= 4 ? 1.4 : 1);
    }
    for (let i = 0; i < w.zones.length; i++) {
      const z = w.zones[i];
      const s = this.zoneSprites[i];
      if (!z.alive) { if (s.visible) s.setVisible(false); continue; }
      s.setVisible(true).setPosition(z.x, z.y).setScale((z.r * 2.4) / 64).setAlpha(Math.min(1, z.life / z.maxLife + 0.2));
    }
    // Loot on the ground: a bag with a tall beam in its rarity colour.
    for (let i = 0; i < w.drops.length; i++) {
      const d = w.drops[i];
      const bag = this.dropSprites[i];
      const beam = this.beamSprites[i];
      if (!d.alive || !d.item) {
        if (bag.visible) {
          // Picked up: the bag flies into the nearest hero and shrinks, so you see where it went.
          if (!d.alive && this.time.now - (this.dropBorn[i] ?? -1e9) > 400) this.lootFly(bag.x, bag.y, bag.tintTopLeft);
          bag.setVisible(false); beam.setVisible(false);
        }
        continue;
      }
      const c = hex(RARITY[d.item.rarity].color);
      const bob = Math.sin(this.time.now / 250 + i) * 3;
      // Pop-in: the bag hops up out of the kill and lands with a squash.
      const t = Math.min(1, (this.time.now - (this.dropBorn[i] ?? -1e9)) / 380);
      const hop = t < 1 ? -Math.sin(t * Math.PI) * 26 : 0;
      const pop = t < 1 ? 0.4 + 0.6 * (1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2)) : 1;
      bag.setVisible(true).setPosition(d.x, d.y + bob + hop).setScale(pop).setTint(c).setTintMode(Phaser.TintModes.MULTIPLY);
      const tall = d.item.rarity === 'common' ? 60 : d.item.rarity === 'fine' ? 90 : 150;
      beam.setVisible(true).setPosition(d.x, d.y + 6).setDisplaySize(18, tall).setTint(c).setAlpha(0.55 + Math.sin(this.time.now / 300) * 0.15);
    }
    for (let i = 0; i < w.veins.length; i++) {
      const v = w.veins[i];
      const s = this.veinSprites[i];
      if (!v.alive) { if (s.visible) s.setVisible(false); continue; }
      s.setVisible(true).setPosition(v.x, v.y - 10).setScale(1 + Math.sin(this.time.now / 400 + i) * 0.04);
    }
    const orbiters = w.orbiters();
    this.orbiterSprites.forEach((s, k) => {
      const o = orbiters[k];
      if (!o) { s.setVisible(false); return; }
      s.setVisible(true).setPosition(o.x, o.y);
    });

    // Telegraphs, lances, beams and health bars are redrawn each frame.
    const g = this.gfx;
    g.clear();
    this.footGfx?.clear();
    this.overFx.clear();
    if (this.world.dungeonId === 'hoard') this.hoardHeroes(g, now);
    if (this.world.dungeonId === 'flue') this.flueMarks(now);
    if (this.coalLights.length) this.coldDraw(g, now);
    if (w.rafts.length) this.wrackDraw(g, now);
    else if (this.drainImg?.visible) { this.drainImg.setVisible(false); this.surfGfx?.clear(); for (const r of this.raftImgs) { r.deck.setVisible(false); r.rim.setVisible(false); } }
    this.summonsDraw(now);
    this.kmDraw(now);
    this.arenaEventDraw(now);
    this.waveDraw(now);
    // Hearthkeeper: Warmth glows under the hero; at full Warmth with 3 pieces (the damage cut) a ring and five orbiting embers.
    const hk = w.setCount('hearthkeeper');
    const warm = hk >= 2 ? w.player.warmth ?? 0 : 0;
    if (warm > 0) this.warmthDraw(g, this.player.x, this.player.y + 22, warm, hk >= 3 && warm >= SET_TUNING.hkMax, now);
    if (hk >= 3 && warm >= SET_TUNING.hkMax && this.warmSeen < SET_TUNING.hkMax) {
      this.ring(this.player.x, this.player.y + 10, 70, 0xffb347, 0.45);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        this.emit(this.fx, 'spark', undefined, this.player.x + Math.cos(a) * 18, this.player.y + 14 + Math.sin(a) * 7, 0.55, { tint: 0xffa040, vx: Math.cos(a) * 50, vy: -50 - Math.random() * 40, drag: 0.93, sx0: 0.5, sx1: 0.1 });
      }
    }
    this.warmSeen = warm;
    // Wrackrider: while Planted (2 pieces), four teal stakes stand driven in round the hero's feet.
    if (w.setCount('wrackrider') >= 2) this.plantedDraw(g, this.player.x, this.player.y + 22, !!w.player.planted && w.player.hp > 0, dt);
    this.slagDraw(g, now);
    this.altDraw(g, now);
    // Co-op: each ally stands on a ring in their class colour, so you can find them in a crowd.
    for (const al of this.bridge ? [] : this.allies) {
      const down = w.heroData(al.hero).player.hp <= 0;
      g.lineStyle(2, down ? 0x6a5a54 : hex(CLASS_ICON[w.heroes[al.hero].cls].color), down ? 0.5 : 0.85).strokeEllipse(al.img.x, al.img.y + 22, 44, 16);
    }
    // G6: a downed hero lies in a soft green circle that an ally must stand in. A dashed
    // ring turns slowly, a "+" bobs over the body until someone arrives, and then a
    // tether runs from the rescuer while the ring fills, with motes lifting off the body.
    let reviveShown = false;
    if (w.heroes.length > 1) {
      const me = w.player;
      const spots = [...this.allies.map((al) => ({ k: al.hero, q: w.heroData(al.hero).player, x: al.img.x, y: al.img.y })), { k: w.acting, q: me, x: this.player.x, y: this.player.y }];
      const o = this.overFx;
      for (const { k, q, x, y } of spots) {
        if (q.hp > 0) continue;
        // G6 boss rule: with no pick-ups left, there is no revive circle to stand in. A grey,
        // broken ring and a struck-through cross mark the body instead, so nobody runs over.
        if (w.revivesLeft <= 0) {
          g.lineStyle(2, 0x8a7d78, 0.5);
          for (let d = 0; d < 6; d++) {
            const a0 = (d * Math.PI * 2) / 6 + 0.2;
            g.beginPath().arc(x, y + 6, REVIVE_RADIUS * 0.8, a0, a0 + 0.55, false).strokePath();
          }
          const by = y - 64;
          o.fillStyle(0x140c0a, 0.75).fillCircle(x, by, 10);
          o.lineStyle(2, 0x8a7d78, 0.9).strokeCircle(x, by, 10);
          o.fillStyle(0x8a7d78, 1).fillRect(x - 5, by - 1.5, 10, 3).fillRect(x - 1.5, by - 5, 3, 10);
          o.lineStyle(2.5, 0xff6b6b, 0.95).lineBetween(x - 8, by + 8, x + 8, by - 8);
          continue;
        }
        const t = Math.min(1, (q.reviveT ?? 0) / w.reviveSeconds);
        const pulse = 0.5 + 0.5 * Math.sin(now / 250);
        const R = REVIVE_RADIUS;
        g.fillStyle(REVIVE, 0.07 + 0.05 * pulse + 0.12 * t).fillCircle(x, y + 6, R);
        // Twelve dashes, turning.
        g.lineStyle(2, REVIVE, 0.45 + 0.2 * pulse);
        const spin = now / 1400;
        for (let d = 0; d < 12; d++) {
          const a0 = spin + (d * Math.PI * 2) / 12;
          g.beginPath().arc(x, y + 6, R, a0, a0 + 0.3, false).strokePath();
        }
        if (t > 0) {
          // The rescuer: whichever living hero stands in the circle.
          let rx = 0, ry = 0, found = false;
          for (let j = 0; j < w.heroes.length && !found; j++) {
            if (j === k) continue;
            const a = w.heroData(j).player;
            if (a.hp > 0 && (a.x - q.x) ** 2 + (a.y - q.y) ** 2 <= R * R) {
              const img = j === w.acting ? this.player : this.allies.find((al) => al.hero === j)?.img;
              if (img) { rx = img.x; ry = img.y; found = true; }
            }
          }
          // The tether and the progress ring are floor marks (main graphics), so the floor bridge shows them in 3D too.
          if (found) g.lineStyle(3, REVIVE, 0.55 + 0.3 * pulse).lineBetween(rx, ry, x, y);
          // A boss pick-up takes 9 s, so it counts down under the circle.
          if (w.bossUp && !reviveShown) {
            reviveShown = true;
            this.reviveText.setVisible(true).setPosition(x, y + 6 + R + 4).setText(`Reviving ${Math.max(0, w.reviveSeconds * (1 - t)).toFixed(1)}`);
          }
          const a1 = -Math.PI / 2 + t * Math.PI * 2;
          g.lineStyle(6, REVIVE, 0.95).beginPath().arc(x, y + 6, R, -Math.PI / 2, a1, false).strokePath();
          g.fillStyle(0xf2fff0, 1).fillCircle(x + Math.cos(a1) * R, y + 6 + Math.sin(a1) * R, 4.5);
          if (!this.lowFx && Math.random() < 0.35) {
            this.emit(this.fx, 'spark', undefined, x + (Math.random() - 0.5) * 30, y + 10, 0.7, { tint: REVIVE, vx: (Math.random() - 0.5) * 20, vy: -70 - Math.random() * 50, drag: 0.97, sx0: 1.6, sx1: 0.3 });
          }
        } else {
          // A bobbing cross over the body asks for help (the 3D overlay draws its own: drawLabels3d).
          const by = y - 62 + Math.sin(now / 300) * 3;
          o.fillStyle(0x0c1a10, 0.75).fillCircle(x, by, 11);
          o.lineStyle(2, REVIVE, 0.9).strokeCircle(x, by, 11);
          o.fillStyle(REVIVE, 1).fillRect(x - 6, by - 2, 12, 4).fillRect(x - 2, by - 6, 4, 12);
        }
      }
    }
    if (!reviveShown && this.reviveText.visible) this.reviveText.setVisible(false);
    // Hammerdeep: Slag Grip glows at a hero's feet with one pip per stack; Sundered cracks a ring above them.
    // The Crucible's Ladle Burn is the same stacks (Player.slag), shown the same way.
    if (w.dungeonId === 'hammerdeep' || w.dungeonId === 'crucible') {
      for (let k = 0; k < w.heroes.length; k++) {
        const q = w.heroData(k).player;
        const img = k === w.acting ? this.player : this.allies.find((al) => al.hero === k)?.img;
        if (!img || q.hp <= 0) continue;
        const slag = q.slag ?? 0;
        if (slag > 0) {
          const pulse = 0.6 + 0.4 * Math.sin(now / 160);
          g.lineStyle(3, 0xff7a1f, 0.5 + 0.4 * pulse).strokeEllipse(img.x, img.y + 22, 50, 18);
          g.fillStyle(0xff7a1f, 0.12 * slag).fillEllipse(img.x, img.y + 22, 50, 18);
          for (let n = 0; n < slag; n++) g.fillStyle(0xffb347, 1).fillCircle(img.x - (slag - 1) * 5 + n * 10, img.y + 36, 3);
        }
        if ((q.sunderT ?? 0) > 0 && !this.bridge) {
          // Beside the hero (above is their name and health bar). The 3D look draws it on its overlay (drawLabels3d).
          const x = img.x - 30;
          const y = img.y - 8;
          g.fillStyle(0x000000, 0.5).fillCircle(x, y, 12);
          g.lineStyle(2.5, DANGER, 0.9).beginPath().arc(x, y, 9, -2.6, -0.9, false).strokePath();
          g.beginPath().arc(x, y, 9, -0.5, 1.2, false).strokePath();
          g.lineStyle(2, DANGER, 0.9).lineBetween(x - 2, y - 10, x + 2, y - 3).lineBetween(x + 2, y - 3, x - 1, y + 2);
        }
      }
    }
    if (!w.stress) {
      // The arena: darkness beyond the edge, an ember rim on it.
      // The Foundry's rim is water-blue; Rising Water pulls it in (w.arenaR).
      // The Hoard's is a deep coal red, darker than the Kiln's orange, like the embers he hoards.
      const R = w.arenaR ?? ARENA;
      const rim = w.dungeonId === 'foundry' ? 0x5ab8ff : w.dungeonId === 'glarewell' ? 0xffe2a0 : w.dungeonId === 'hammerdeep' ? 0xc8d0e0 : w.dungeonId === 'ashvents' ? 0xff9a7a : w.dungeonId === 'coldmarrow' ? FROST : w.dungeonId === 'crucible' ? MOLTEN : w.dungeonId === 'wrackline' ? 0x7fd0e0 : w.dungeonId === 'pressworks' ? 0xf0c66a : w.dungeonId === 'hoard' ? HOARD_RIM : w.dungeonId === 'smeltery' ? 0xa8906c : w.dungeonId === 'flue' ? FLUE_RIM : 0xff8a3d;
      if (!this.darkGfx) this.darkGfx = this.add.graphics().setDepth(1.95);
      this.darkGfx.clear();
      if (!w.hallsOn) this.darkGfx.lineStyle(900, 0x070302, 0.82).strokeCircle(0, 0, R + 450);
      if (R < ARENA) {
        // Floodwater: a deep band with ripples rolling in and foam on the shore.
        g.lineStyle(ARENA - R, 0x0b2f44, 0.8).strokeCircle(0, 0, (ARENA + R) / 2);
        for (let k = 0; k < 3; k++) {
          const t = ((now / 2600 + k / 3) % 1);
          const rr = ARENA - t * (ARENA - R);
          g.lineStyle(2, 0x7fd8f0, 0.25 * Math.sin(t * Math.PI)).strokeCircle(0, 0, rr);
        }
        g.lineStyle(6, 0xd8f6ff, 0.18 + 0.08 * Math.sin(now / 400)).strokeCircle(0, 0, R + 4);
      }
      // In 3D the room's own edge marks a full-size arena, so the floor bridge carries the rim only once it has moved in.
      if (w.hallsOn) { /* Halls: the map layer draws its own walls and rims. */ } else if (!this.bridge || R < ARENA) {
        g.lineStyle(4, rim, 0.55).strokeCircle(0, 0, R);
        g.lineStyle(14, rim, 0.12).strokeCircle(0, 0, R + 6);
      }
      // The Crucible: the arena is a crucible's rim, molten slag slowly breathing just beyond it.
      if (w.dungeonId === 'crucible' && !this.bridge) g.lineStyle(40, MOLTEN, 0.12 + 0.06 * Math.sin(now / 700)).strokeCircle(0, 0, R + 30);
    }
    // The Glarewell: the floor is lit pale gold, and pillars cast shadow wedges
    // away from the centre lens. The wedges match World.shadowed(), so what you
    // see is where you're safe.
    // (H3b: on a Halls map the room's own floor is lit by its theme, so no arena-wide glow.)
    if (w.pillars.length && !w.hallsOn) g.fillStyle(0xffe2a0, 0.07).fillCircle(0, 0, w.arenaR ?? ARENA);
    const light = this.lightAt(now);
    // On a Halls map the light's room is lit the same pale gold, so its shadows read as in the arena (design, 25 Nov:
    // a Cross room's wedges were faint), and each wedge stops at the room's wall, where the light is blocked anyway.
    let wall: number[] | null = null;
    if (w.pillars.length && w.hallsOn && w.halls) {
      const room = w.halls.rooms.find((r) => inLoop(roomLoops(r)[0], light.x, light.y));
      if (room) {
        wall = roomLoops(room)[0];
        const pts: Phaser.Math.Vector2[] = [];
        for (let k = 0; k + 1 < wall.length; k += 2) pts.push(new Phaser.Math.Vector2(wall[k], wall[k + 1]));
        g.fillStyle(0xffe2a0, 0.07).fillPoints(pts, true);
      }
    }
    /** How far a shadow runs from (x, y) along (ux, uy) before it meets the room's wall (at most L). */
    const toWall = (x: number, y: number, ux: number, uy: number, L: number): number => {
      if (!wall) return L;
      let d = 0; while (d < L && inLoop(wall, x + ux * d, y + uy * d)) d += 8;
      return Math.min(L, d);
    };
    // Y6 Carried Light: while her Glare is coming from a carried light, pale beams run from the light to every whole
    // pillar, so a phone shows which way each shadow now falls before it lands.
    const carried = (w.bossVariant === 'walk' || w.bossEcho === 'walk') && (light.x !== 0 || light.y !== 0) && w.enemies.some((o) => o.alive && o.castId === 'glare');
    if (carried && w.pillars.length) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 80);
      for (const c of w.pillars) {
        if (c.cracked) continue;
        g.lineStyle(10, 0xfff0c0, 0.08 + 0.06 * pulse).lineBetween(light.x, light.y, c.x, c.y);
        g.lineStyle(3, 0xffe2a0, 0.45 + 0.3 * pulse).lineBetween(light.x, light.y, c.x, c.y);
      }
    }
    this.pillarSprites.forEach((ps, k) => {
      const c = w.pillars[k];
      if (!c) { if (ps.visible) ps.setVisible(false); return; }
      if (!c.cracked) {
        // Y3 Carried Light: the wedge points away from wherever the light is now.
        const cx = c.x - light.x, cy = c.y - light.y;
        const d = Math.hypot(cx, cy) || 1;
        const ux = cx / d;
        const uy = cy / d;
        let L = d < CARRIED_LIGHT.minD ? 0 : w.shadowLen;
        const w0 = c.r;
        // Clipped at the wall along its middle and both edges, so no part of it runs on past the room.
        if (wall && L > 0) {
          const wL = c.r + L * GLARE.shadowWiden, ex = (wL - w0) / L;
          for (const sd of [0, 1, -1]) {
            // An edge ray: from the pillar's side, widening as it goes.
            const sx = c.x - uy * w0 * sd, sy = c.y + ux * w0 * sd, dx = ux - uy * ex * sd, dy = uy + ux * ex * sd, dl = Math.hypot(dx, dy);
            L = Math.min(L, toWall(sx, sy, dx / dl, dy / dl, L * dl) / dl);
          }
        }
        const w1 = c.r + L * GLARE.shadowWiden;
        // Y9: the edge thickens with the phone text scale and is brighter, so the safe wedge reads on a 360 px phone.
        g.fillStyle(0x06051a, wall ? 0.7 : 0.62).lineStyle(2.5 * this.textK, 0x9aaaff, wall ? 0.8 : 0.65).beginPath();
        g.moveTo(c.x - uy * w0, c.y + ux * w0);
        g.lineTo(c.x + ux * L - uy * w1, c.y + uy * L + ux * w1);
        g.lineTo(c.x + ux * L + uy * w1, c.y + uy * L - ux * w1);
        g.lineTo(c.x + uy * w0, c.y - ux * w0);
        g.closePath();
        g.fillPath();
        g.strokePath();
      }
      // H3b: a Cross room's own stone pillar is drawn by the room; only its shadow is drawn here.
      if (c.fixed) { if (ps.visible) ps.setVisible(false); return; }
      const fr = c.cracked ? '1' : '0';
      if (ps.frame.name !== fr) ps.setFrame(fr);
      ps.setVisible(true).setPosition(c.x, c.y).setScale((c.r * 2.3) / (64 * SPRITE_RES)).setAlpha(c.cracked ? 0.7 : 1);
    });
    if (w.pillars.length) {
      // The centre lens glows; it brightens while a Glare is coming.
      const glaring = w.enemies.some((o) => o.alive && o.castId === 'glare');
      const a = glaring ? 0.25 + 0.2 * Math.sin(now / 50) : 0.1;
      // Y3 Carried Light: the glow sits wherever the light is now.
      g.fillStyle(0xfff0c0, a).fillCircle(light.x, light.y, 60);
      g.lineStyle(3, 0xffe2a0, 0.5).strokeCircle(light.x, light.y, 60);
      if (this.lightAnim) g.fillStyle(0xfff8e0, 0.5).fillCircle(light.x, light.y, 22); // the bright core as it travels
    }
    if (w.lampBeam) {
      const b = w.lampBeam;
      const fl = 0.55 + 0.2 * Math.sin(now / 70);
      g.lineStyle(GLARE.lampWidth * 2, 0xffe9a0, 0.25).lineBetween(b.x1, b.y1, b.x2, b.y2);
      g.lineStyle(6, 0xfffbe6, fl).lineBetween(b.x1, b.y1, b.x2, b.y2);
    }
    if (w.markT > 0) {
      // The Brand: a gold ring the size of the burst, closing in. In co-op every living hero carries one.
      const f = Math.min(1, w.markT / GLARE.brandTime);
      const flick = w.markT < 1.2 ? 0.5 + 0.5 * Math.sin(now / 40) : 1;
      for (let h = 0; h < w.heroes.length; h++) {
        const p = h === w.acting ? w.player : w.heroData(h).player;
        if (w.heroes.length > 1 && p.hp <= 0) continue;
        g.fillStyle(0xffc861, 0.08 + 0.1 * (1 - f)).fillCircle(p.x, p.y, GLARE.brandRadius);
        g.lineStyle(3, 0xffc861, 0.8 * flick).strokeCircle(p.x, p.y, GLARE.brandRadius);
        g.lineStyle(4, 0xfff0c0, 0.9).beginPath();
        g.arc(p.x, p.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f, false);
        g.strokePath();
      }
    }
    // In 3D the world graphics are painted onto the floor's square canvas, so a world-space flash lit a hard-edged
    // pale square over the void and the corridors round a Halls room (phone pass, 25 Nov). There the flash is a
    // screen-wide wash (#flashFx) instead; 2D keeps drawing it into the world.
    let wash = 0;
    if (this.glareFlash > 0) {
      // Bright enough to sting, faint enough that you can still see the fight.
      this.glareFlash = Math.max(0, this.glareFlash - this.game.loop.delta / 450);
      if (this.hd2d) wash = Math.max(wash, 0.55 * this.glareFlash);
      else g.fillStyle(0xfff0c0, 0.55 * this.glareFlash).fillCircle(w.player.x, w.player.y, 2000);
    }
    if (this.bossFlash > 0) {
      this.bossFlash = Math.max(0, this.bossFlash - this.game.loop.delta / 700);
      if (this.hd2d) wash = Math.max(wash, 0.6 * this.bossFlash * this.bossFlash);
      else g.fillStyle(0xfff4dc, 0.6 * this.bossFlash * this.bossFlash).fillCircle(w.player.x, w.player.y, 2000);
    }
    if (this.flashFx && wash !== this.flashShown) { this.flashShown = wash; this.flashFx.style.opacity = wash.toFixed(3); }
    this.layoutDraw(g, now);
    this.edgeDraw(now);
    this.wanderDraw(now);
    this.brimDraw(now);
    this.bankDraw(now);
    this.dieCutDraw(now);
    this.kilnDrawTell(g, now);
    this.turnDraw(now);
    this.tideDraw(now);
    this.glintDraw(now);
    this.rimeDraw(now);
    this.overflowDraw(now);
    this.homeDraw(now);
    // Maelra's steam vents: iron grates that glow and breathe steam.
    let sealedDrawn = false;
    this.ventSprites.forEach((vs, k) => {
      const v = w.vents[k];
      if (!v) { if (vs.visible) vs.setVisible(false); return; }
      const fr = String(Math.floor(now / 160 + k) % 4);
      if (vs.frame.name !== fr) vs.setFrame(fr);
      // Y3 Sealed Vents: a sealed vent goes dark; the open one glows; the next one pulses before the steam moves.
      const sealed = w.openVent >= 0 && versionLive(w, 'seal') && k !== w.openVent;
      const next = sealed && k === w.nextVent;
      vs.setVisible(true).setPosition(v.x, v.y).setScale((v.r * 2.25) / (64 * SPRITE_RES)).setAlpha(0.88);
      if (sealed) {
        // Y6: a sealed vent is capped with a riveted iron plate. The next one's plate rattles, its seam glows and steam
        // leaks round its rim in the 2.5 s before the steam moves there.
        if (!this.sealGfx) this.sealGfx = this.add.graphics().setDepth(1.42);
        const sg = this.sealGfx;
        if (!sealedDrawn) { sg.clear(); sealedDrawn = true; }
        const jig = next ? Math.sin(now / 35) * 1.5 : 0;
        const x = v.x + jig, y = v.y, r = v.r * 1.02;
        sg.fillStyle(0x000000, 0.35).fillCircle(v.x, v.y + 3, r + 2);
        sg.fillStyle(0x3b3431, 1).fillCircle(x, y, r);
        sg.fillStyle(0x534945, 1).fillCircle(x - r * 0.12, y - r * 0.14, r * 0.8);
        sg.fillStyle(0x3b3431, 1).fillCircle(x, y, r * 0.62);
        sg.lineStyle(Math.max(3, r * 0.14), 0x2a2422, 1).lineBetween(x - r * 0.9, y, x + r * 0.9, y);
        for (let j = 0; j < 6; j++) {
          const a = (j / 6) * Math.PI * 2 + 0.5;
          sg.fillStyle(0x8a7f78, 1).fillCircle(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82, Math.max(1.6, r * 0.07));
        }
        if (next) {
          const p = 0.5 + 0.5 * Math.sin(now / 90);
          sg.lineStyle(3, 0xbfe6ff, 0.45 + 0.4 * p).strokeCircle(x, y, r + 1);
          sg.lineStyle(2, 0xffffff, 0.25 + 0.35 * p).lineBetween(x - r * 0.9, y, x + r * 0.9, y);
          if (!this.lowFx && Math.random() < 0.25) { const a = Math.random() * Math.PI * 2; this.steam(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8 - 4, 0.35); }
        }
      } else if (w.openVent >= 0 && versionLive(w, 'seal')) {
        // Y6: the open vent boils her from MAELRA_SEAL.wide times its radius (skills' Y5 fix), so its reach is drawn
        // there: a faint steam pool and a ring of dashes turning slowly, round the grate's own ring.
        const tk = Math.max(1, this.textK);
        const R = v.r * MAELRA_SEAL.wide;
        g.lineStyle(3, 0xbfe6ff, 0.75).strokeCircle(v.x, v.y, v.r + 4);
        g.fillStyle(0xbfe6ff, 0.07 + 0.03 * Math.sin(now / 300)).fillCircle(v.x, v.y, R);
        const D = 20, rot = now / 2400;
        for (let j = 0; j < D; j++) {
          const a0 = rot + (j / D) * Math.PI * 2;
          g.lineStyle(2.4 * tk, 0xdff3ff, 0.6).beginPath();
          g.arc(v.x, v.y, R, a0, a0 + (Math.PI * 2 / D) * 0.55).strokePath();
        }
      }
      else g.lineStyle(2, 0xbfe6ff, 0.35).strokeCircle(v.x, v.y, v.r);
    });
    if (!sealedDrawn) this.sealGfx?.clear();
    if (w.vents.length && now > this.steamAt && !this.lowFx) {
      this.steamAt = now + 140;
      const v = w.openVent >= 0 && versionLive(w, 'seal') && w.vents[w.openVent] ? w.vents[w.openVent] : w.vents[Math.floor(Math.random() * w.vents.length)];
      this.steam(v.x + (Math.random() - 0.5) * v.r * 0.6, v.y - 4, 0.5 + Math.random() * 0.4);
    }
    // Fork gates: gold for the named path, teal for a shrine, pale for the steady fight.
    const GATE_COL = { steady: 0xd8cfc4, named: 0xffc861, shrine: 0x5fe0c8 } as const;
    this.gateTexts.forEach((txt, k) => {
      const gate = w.phase === 'choose' ? w.gates[k] : undefined;
      if (!gate) {
        if (txt.visible) { txt.setVisible(false); this.gateSprites[k]?.arch.setVisible(false); this.gateSprites[k]?.portal.setVisible(false); }
        return;
      }
      const col = GATE_COL[gate.kind];
      const pulse = 1 + Math.sin(this.time.now / 250 + k) * 0.05;
      g.fillStyle(col, 0.1).fillCircle(gate.x, gate.y, gate.r * pulse);
      g.lineStyle(2, col, 0.6).strokeCircle(gate.x, gate.y, gate.r * pulse);
      const gs = this.gateSprites[k];
      if (gs) {
        gs.arch.setVisible(true).setPosition(gate.x, gate.y + gate.r * 0.35);
        gs.portal.setVisible(true).setPosition(gate.x, gate.y + gate.r * 0.35).setTint(col).setAlpha(0.65 + 0.25 * Math.sin(now / 200 + k));
      }
      const name = ENCOUNTERS[gate.encounter].name;
      const label = gate.kind === 'named' ? `${name}\nHarder · better loot` : gate.kind === 'shrine' ? 'Shrine\nHeal · level · no loot' : name;
      setColorIf(txt.setVisible(true).setText(label), '#' + col.toString(16).padStart(6, '0')).setPosition(gate.x, gate.y - gate.r - 34);
    });
    let soakShown = false;
    // Telegraph edges thicken with the phone text scale, so a zoomed-out world keeps a 2px edge.
    const lk = this.textK;
    this.emptyVents.length = 0;
    if (w.dungeonId === 'pressworks' && w.osStage >= 2 && !this.bossFell) this.oskelBelt(g, now);
    // In 3D the view draws the plain circles and cones itself, so the floor bridge keeps only the marks drawn over them.
    const plain = !this.bridge;
    for (const t of w.telegraphs) {
      // Once the boss has fallen its last wind-up never lands, so stop drawing it.
      if (!t.alive || this.bossFell) continue;
      const f = Math.min(1, t.t / t.dur);
      const col = t.kind === 'soak' ? SOAK : t.kind === 'bloom' ? BLOOM : DANGER;
      // The edge glows and flickers faster as the strike gets close.
      const flick = f > 0.7 ? 0.5 + 0.5 * Math.sin(now / (f > 0.9 ? 30 : 60)) : 1;
      if (t.shape === 'circle') {
        if (plain) {
          g.fillStyle(col, t.kind === 'soak' ? 0.22 : 0.14).fillCircle(t.x, t.y, t.r);
          g.fillStyle(col, 0.3).fillCircle(t.x, t.y, t.r * f);
          g.lineStyle(10, col, 0.12 * flick).strokeCircle(t.x, t.y, t.r + 3);
          g.lineStyle((t.kind === 'soak' ? 3 : 2) * lk, col, 0.9 * (0.6 + 0.4 * flick)).strokeCircle(t.x, t.y, t.r);
          g.lineStyle(1.5 * lk, 0xffffff, 0.5 * f).strokeCircle(t.x, t.y, t.r * f);
          // Colour-blind palette: attack zones are hatched, so shape tells them apart, not just colour.
          if (HATCH && t.kind === 'hit') {
            g.lineStyle(2, col, 0.45);
            for (let d = -t.r + 14; d < t.r; d += 16) {
              // Diagonal chords across the circle.
              const h = Math.sqrt(t.r * t.r - d * d);
              const c = Math.SQRT1_2;
              g.lineBetween(t.x + d * c - h * c, t.y + d * c + h * c, t.x + d * c + h * c, t.y + d * c - h * c);
            }
          }
        }
        if (t.kind === 'soak' && t.owner === -2 && (w.dungeonId === 'ashvents' || w.dungeonId === 'crucible')) this.ventMark(g, t, f, now);
        if (w.dungeonId === 'pressworks' && t.kind === 'soak' && t.owner === -3) this.pressMark(g, t, f, now);
        if (w.dungeonId === 'pressworks' && t.kind === 'hit' && t.owner === -1 && t.r === OSKEL.rivetRadius) this.rivetMark(t, f);
        if (t.owner >= 0 && w.enemies[t.owner]?.kind === 'hoarfrostWeaver') this.laceMark(g, t, f, now);
        if (t.kind === 'soak' && !soakShown) {
          soakShown = true;
          // Under the circle's rim, so it never sits on the names of the heroes standing in it.
          this.soakText.setVisible(true).setPosition(t.x, t.y + t.r + 4).setText(`Stand here ${Math.max(0, t.dur - t.t).toFixed(1)}`);
        }
      } else {
        const a0 = t.angle - t.arc / 2;
        const a1 = t.angle + t.arc / 2;
        if (plain) {
          g.fillStyle(col, 0.14).slice(t.x, t.y, t.r, a0, a1, false).fillPath();
          g.fillStyle(col, 0.3).slice(t.x, t.y, t.r * f, a0, a1, false).fillPath();
          g.lineStyle(10, col, 0.12 * flick).slice(t.x, t.y, t.r + 3, a0, a1, false).strokePath();
          g.lineStyle(2 * lk, col, 0.9 * (0.6 + 0.4 * flick)).slice(t.x, t.y, t.r, a0, a1, false).strokePath();
          if (HATCH && t.kind === 'hit') {
            // Hatched cones: spokes every few degrees and arcs across them.
            g.lineStyle(2, col, 0.45);
            const n = Math.max(3, Math.round(t.arc / 0.14));
            for (let k = 1; k < n; k++) {
              const a = a0 + (t.arc * k) / n;
              g.lineBetween(t.x + Math.cos(a) * 30, t.y + Math.sin(a) * 30, t.x + Math.cos(a) * t.r, t.y + Math.sin(a) * t.r);
            }
          }
        }
        if (t.owner >= 0 && w.enemies[t.owner]?.kind === 'grandmotherSlag') this.pourLane(g, t, f, now);
      }
    }
    if (!soakShown && this.soakText.visible) this.soakText.setVisible(false);
    // Under the top panels the countdown only shows through the panel as a smear: the edge arrow points there instead.
    if (soakShown && this.soakText.y < this.clearView().y) this.soakText.setVisible(false);
    // The Lumen's Sanctuary and Blessed Ground pool.
    const lp = w.player;
    if (lp.sanctT > 0) {
      g.fillStyle(0xffe9a8, 0.08).fillCircle(lp.sanctX, lp.sanctY, w.sanctuaryRadius);
      g.lineStyle(2, 0xffd27a, 0.6);
      this.dashedCircle(g, lp.sanctX, lp.sanctY, w.sanctuaryRadius, now);
    }
    if (lp.poolT > 0) g.fillStyle(0xb8ffd0, 0.12).fillCircle(lp.poolX, lp.poolY, 70);
    for (const l of w.lances) {
      if (!l.alive) continue;
      const k = l.life / 0.25;
      g.lineStyle(14 * k + 2, 0xff9a3d, 0.5 * k).lineBetween(l.x1, l.y1, l.x2, l.y2);
      g.lineStyle(4, 0xfff0c0, k).lineBetween(l.x1, l.y1, l.x2, l.y2);
    }
    // Gathering progress around ember veins.
    for (const v of w.veins) {
      if (!v.alive) continue;
      g.lineStyle(2, 0xffb347, 0.35).strokeCircle(v.x, v.y, 40);
      if (v.progress > 0) {
        g.lineStyle(4, 0xffe08a, 1).beginPath().arc(v.x, v.y, 40, -Math.PI / 2, -Math.PI / 2 + (v.progress / VEIN_TIME) * Math.PI * 2, false).strokePath();
      }
    }
    // Boss casts and acolyte heal beams.
    const boss = w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
    for (let ei = 0; ei < eEnd; ei++) {
      const e = w.enemies[ei];
      if (!e.alive) continue;
      if (e.kind === 'acolyte') {
        // The Kindle beam to the ward pulses while it heals: kill the acolyte to stop it.
        const ward = e.aux2 >= 0 ? w.enemies[e.aux2] : boss;
        if (ward?.alive) {
          const pulse = 0.55 + Math.sin(now / 90) * 0.2;
          g.lineStyle(4, 0x7dffb0, pulse).lineBetween(e.x, e.y, ward.x, ward.y);
        }
      }
      // Phase 16 U2: the Ashwall's shield, a heavy arc across its front (where hits glance off), and a faint wedge
      // behind it where foes shelter. Walk round the arc to hit it, or draw its foes out of the wedge.
      if (e.kind === 'ashwall') {
        const fa = e.aux;
        g.fillStyle(0xff9a50, 0.07).slice(e.x, e.y, ASHWALL.shelterR, fa + Math.PI - ASHWALL.shelterArc, fa + Math.PI + ASHWALL.shelterArc, false).fillPath();
        g.lineStyle(7, 0x6e6258, 0.95).beginPath().arc(e.x, e.y, e.def.radius + 9, fa - ASHWALL.frontArc, fa + ASHWALL.frontArc, false).strokePath();
        g.lineStyle(2, 0xffb070, 0.8).beginPath().arc(e.x, e.y, e.def.radius + 13, fa - ASHWALL.frontArc, fa + ASHWALL.frontArc, false).strokePath();
      }
      // Phase 16 U2: the Ballast. A ring fills as it gets ready to drop anchor; planted, a heavy iron ring holds it
      // and its reach shows, so you know to step out and make it walk.
      if (e.kind === 'ballast') {
        const r0 = e.def.radius + 8;
        if (e.aux >= BALLAST.plantDelay) {
          g.lineStyle(6, 0x4a5260, 0.95).strokeCircle(e.x, e.y, r0);
          g.lineStyle(2, 0x9fb0c8, 0.35).strokeCircle(e.x, e.y, BALLAST.reach + e.def.radius);
        } else if (e.aux > 0) {
          const k = e.aux / BALLAST.plantDelay;
          g.lineStyle(4, 0x8fa0b8, 0.8).beginPath().arc(e.x, e.y, r0, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2, false).strokePath();
        }
      }
      // Phase 16 U2: the Dimhorn. A cold ring fills while it is out in the dark, toward its Dark Call; during the call it
      // pulses, so you know to bring your light over it.
      if (e.kind === 'dimhorn') {
        const r0 = e.def.radius + 8;
        const calling = e.castId === 'darkCall';
        const k = calling ? 1 : Math.min(1, e.aux / DIMHORN.callAt);
        if (k > 0) g.lineStyle(calling ? 5 : 3, 0x9ab8ff, calling ? 0.6 + 0.35 * Math.sin(now / 80) : 0.75).beginPath().arc(e.x, e.y, r0, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2, false).strokePath();
      }
      // Phase 16 U2: the Lampeye. A ring fills as its gaze builds, and while it can see your hero a thin beam joins
      // them, so you know to put a pillar in the way; it flares during Searing Look.
      if (e.kind === 'lampeye') {
        const r0 = e.def.radius + 8;
        const k = Math.min(1, e.aux / LAMPEYE.full);
        if (k > 0) g.lineStyle(4, 0xfff0a0, 0.85).beginPath().arc(e.x, e.y, r0, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2, false).strokePath();
        const p = w.player;
        if (p.hp > 0 && w.lampeyeSees(e, p.x, p.y)) {
          const looking = e.castId === 'searingLook';
          g.lineStyle(looking ? 4 : 1.5, 0xfff4c0, looking ? 0.8 : 0.15 + 0.4 * k).lineBetween(e.x, e.y, p.x, p.y);
        }
      }
      // Mirror Ward: a glassy shell that flickers while it reflects damage.
      if (e.kind === 'glassWarden' && e.aux2 > 0) {
        const fl = 0.55 + 0.35 * Math.sin(now / 50);
        g.lineStyle(3, 0xbff4ff, fl).strokeCircle(e.x, e.y, e.def.radius + 12);
        g.fillStyle(0x9fe8ff, 0.12).fillCircle(e.x, e.y, e.def.radius + 12);
      }
      // Maelra's Temper: steel pips circling her, one per stack.
      if (e.kind === 'maelra' && w.temper > 0) {
        for (let k = 0; k < w.temper; k++) {
          const a = now / 700 + (k / 5) * Math.PI * 2;
          const px2 = e.x + Math.cos(a) * (e.def.radius + 18);
          const py2 = e.y + Math.sin(a) * (e.def.radius + 18) * 0.5 - 10;
          g.fillStyle(0xcfd8e6, 0.95).fillCircle(px2, py2, 4);
          g.lineStyle(1.5, 0x3a4250, 1).strokeCircle(px2, py2, 4);
        }
        g.lineStyle(2 + w.temper, 0xcfd8e6, 0.12 + w.temper * 0.06).strokeCircle(e.x, e.y, e.def.radius + 10);
      }
      if (e.kind === 'vorhulm') this.hoardDraw(g, e, now);
      if (e.kind === 'colossus') this.smelteryDraw(g, e, now);
      if (e.kind === 'ondrel' && e.castId) this.ondrelCast(g, e, w.enemies.indexOf(e), now);
      if (e.kind === 'ondrel' && w.slagPatches.length) this.ondrelSlagDraw(g, now);
      if (e.kind === 'ysmeret' && w.ysStage === 2 && w.enemies.indexOf(e) === w.ysF0) this.ysFlamesDraw(g, now);
      if ((e.kind === 'ysmeret' || (e.kind === 'grandmotherSlag' && e.castId === 'scatter')) && e.castId) this.ysmeretCast(g, e, now);
      if (e.kind === 'nhevra' && e.castId) this.nhevraCast(g, e, now);
      if (e.kind === 'oskel' && e.castId === 'stamp') this.stampMark(g, e, now);
      if (e.kind === 'grandmotherSlag' && e.castId) this.slagCast(g, e, now);
      if (e.castId === 'cataclysm') {
        const f = e.castT / e.castDur;
        g.lineStyle(4, DANGER, 0.5 + f * 0.5).strokeCircle(e.x, e.y, 60 + f * 500);
        g.fillStyle(DANGER, 0.05 + f * 0.08).fillCircle(e.x, e.y, 60 + f * 500);
      }
    }
    for (let k = this.shapes.length - 1; k >= 0; k--) {
      const s = this.shapes[k];
      s.life -= dt;
      if (s.life <= 0) { this.shapes.splice(k, 1); continue; }
      const f = s.life / s.max;
      if (s.kind === 'cone') {
        const half = (s.arc ?? (110 * Math.PI) / 180) / 2;
        // A sweeping front: a soft outer band, a brighter crest, and a hot core near the caster.
        const reach = s.r * (1.1 - f * 0.3);
        g.fillStyle(s.color, 0.22 * f).slice(s.x, s.y, reach, s.angle - half, s.angle + half, false).fillPath();
        g.fillStyle(s.color, 0.35 * f).slice(s.x, s.y, reach * 0.86, s.angle - half * 0.92, s.angle + half * 0.92, false).fillPath();
        g.fillStyle(0xffe6a8, 0.3 * f).slice(s.x, s.y, reach * 0.5, s.angle - half * 0.7, s.angle + half * 0.7, false).fillPath();
        g.lineStyle(3 * f + 1, 0xfff0c8, 0.7 * f).beginPath().arc(s.x, s.y, reach, s.angle - half, s.angle + half, false).strokePath();
      } else if (s.kind === 'line') {
        g.lineStyle(8 * f + 2, s.color, f).lineBetween(s.x, s.y, s.x2, s.y2);
      } else if (s.kind === 'ring') {
        g.lineStyle(6 * f, s.color, f).strokeCircle(s.x, s.y, s.r * (1.2 - f * 0.4));
      } else if (s.kind === 'pillar') {
        g.fillStyle(s.color, 0.35 * f).fillRect(s.x - s.r / 2, s.y - 220, s.r, 230);
        g.fillStyle(0xffffff, 0.5 * f).fillRect(s.x - s.r / 6, s.y - 220, s.r / 3, 230);
      }
    }

    // Nameplates and health bars for named enemies and objectives.
    const b = this.bars;
    b.clear();
    for (const al of this.allies) {
      const q = w.heroData(al.hero).player;
      const x = al.img.x - 22;
      const y = al.img.y - 32;
      b.fillStyle(0x000000, 0.6).fillRect(x, y, 44, 5);
      b.fillStyle(0x6fe08a, 1).fillRect(x, y, (44 * Math.max(0, q.hp)) / q.maxHp, 5);
      // An ally off screen, or hidden under the HUD's top panels, gets an arrow at the edge of the clear view.
      const v = this.clearView();
      const pad = 26 / cam.zoom;
      const inset = 20 / cam.zoom;
      if (al.img.x < v.x + inset || al.img.x > v.right - inset || al.img.y < v.y + inset || al.img.y > v.bottom - inset) {
        const cx = v.centerX;
        const cy = v.centerY;
        const a = Math.atan2(al.img.y - cy, al.img.x - cx);
        const hw = v.width / 2 - pad;
        const hh = v.height / 2 - pad;
        const k = Math.min(hw / Math.abs(Math.cos(a) || 1e-6), hh / Math.abs(Math.sin(a) || 1e-6));
        const ex = cx + Math.cos(a) * k;
        const ey = cy + Math.sin(a) * k;
        const sz = 12 / cam.zoom;
        const col = q.hp <= 0 ? 0x9a8a84 : hex(CLASS_ICON[w.heroes[al.hero].cls].color);
        b.fillStyle(0x000000, 0.55).fillCircle(ex, ey, sz * 1.2);
        b.fillStyle(col, 1).fillTriangle(
          ex + Math.cos(a) * sz, ey + Math.sin(a) * sz,
          ex + Math.cos(a + 2.4) * sz * 0.8, ey + Math.sin(a + 2.4) * sz * 0.8,
          ex + Math.cos(a - 2.4) * sz * 0.8, ey + Math.sin(a - 2.4) * sz * 0.8,
        );
      }
    }
    // Y9: on a phone the view is narrow, so foes coming in from the sides or behind (or hidden under the boss panel)
    // get a small red chevron at the edge of the clear view: one per direction, a little bigger for a crowd, with a
    // gold rim when an elite or the boss is among them. Desktop views see the arena, so they stay clean.
    if (this.hud.compact && w.phase === 'fight') this.foeEdgeMarks(b, now);
    // The Pressworks: a Pressed hero (they took the last Downstroke) wears a red press plate by their health bar,
    // its ring running down with the time left, so the party can see at a glance who must stay out of the next one.
    if (w.dungeonId === 'pressworks') {
      for (let k = 0; k < w.heroes.length; k++) {
        const q = w.heroData(k).player;
        const left = q.pressedT ?? 0;
        if (left <= 0 || q.hp <= 0) continue;
        const al = k === w.acting ? undefined : this.allies.find((a) => a.hero === k);
        const hx = al ? al.img.x : this.player.x;
        const hy = al ? al.img.y : this.player.y;
        this.pressedMark(hx + 32, hy - 30, left / OSKEL.pressed);
      }
    }
    // An empty vent or press plate off screen, or hidden under the HUD's top panels (on a phone the boss panel covers
    // the top quarter of the view), gets a gold arrow at the edge of the clear view, so nobody misses it.
    for (const ev of this.emptyVents) {
      const v = this.clearView();
      const inset = 20 / cam.zoom;
      if (ev.x > v.x + inset && ev.x < v.right - inset && ev.y > v.y + inset && ev.y < v.bottom - inset) continue;
      const pad = 30 / cam.zoom;
      const cx = v.centerX;
      const cy = v.centerY;
      const a = Math.atan2(ev.y - cy, ev.x - cx);
      const k = Math.min((v.width / 2 - pad) / Math.abs(Math.cos(a) || 1e-6), (v.height / 2 - pad) / Math.abs(Math.sin(a) || 1e-6));
      const ex = cx + Math.cos(a) * k;
      const ey = cy + Math.sin(a) * k;
      const sz = 16 / cam.zoom;
      // It pulses but never fades below 0.55, so a still frame (or a glance) always catches it.
      const blink = 0.775 + 0.225 * Math.sin(now / 90);
      b.fillStyle(0x000000, 0.6).fillCircle(ex, ey, sz * 1.25);
      b.lineStyle(2 / cam.zoom, ev.col ?? SOAK, blink).strokeCircle(ex, ey, sz * 1.25);
      b.fillStyle(ev.col ?? SOAK, blink).fillTriangle(
        ex + Math.cos(a) * sz, ey + Math.sin(a) * sz,
        ex + Math.cos(a + 2.4) * sz * 0.8, ey + Math.sin(a + 2.4) * sz * 0.8,
        ex + Math.cos(a - 2.4) * sz * 0.8, ey + Math.sin(a - 2.4) * sz * 0.8,
      );
    }
    let plate = 0;
    // A pack of the same elite (four Shoal Lurkers round a raft) shows its name once, over the topmost one: the
    // same name printed over each stacks into an unreadable block on a phone.
    const names: { x: number; y: number; text: string; color: string }[] = [];
    const bars: World['enemies'] = [];
    const trash: World['enemies'] = [];
    for (let ei = 0; ei < eEnd; ei++) {
      const e = w.enemies[ei];
      if (!e.alive || (e.def.rank === 'normal' && !e.def.stationary) || e.def.rank === 'boss') continue;
      if (!onScreen(e.x, e.y)) continue;
      // Warded: a bubble on the body (the shield segment goes on the bar below).
      if (e.ward > 0) {
        g.lineStyle(2, 0xcfe6ff, 0.55 + 0.2 * Math.sin(now / 120)).strokeCircle(e.x, e.y, e.def.radius + 8);
        g.fillStyle(0xcfe6ff, 0.08).fillCircle(e.x, e.y, e.def.radius + 8);
      }
      // Kiln trash (design, 25 Nov): an opener-pack foe gets a small bar right on it, only once it has been hit, and
      // trash bars never stack or lift. Doubled packs stacked 6-8 full bars into a column ~100 px above the clump.
      // One mid-cast keeps the full bar below, so an interrupt target is always marked.
      if (!e.castId && this.trashFoe(e)) { if (e.hp < e.maxHp) trash.push(e); continue; }
      bars.push(e);
    }
    // Y9: a pile of the same unnamed elite (Nhevra's Snuffers crowding in) shares one bar, so a dozen bars don't
    // stack into a block. A pack of PACK_MIN or more draws one bar over its topmost member, with the pack's summed health, a count and the summed ward. Smaller
    // groups, named elites and any elite mid-cast keep their own bars, so an interrupt target is always marked.
    const PACK_DX = 70;
    const PACK_DY = 50;
    const PACK_MIN = 3;
    bars.sort((a, c) => (a.y - a.def.radius) - (c.y - c.def.radius));
    // Packs merge transitively: two of a kind whose bars would crowd (within PACK_DX by PACK_DY) share a pack.
    const solo = (m: World['enemies'][number]) => m.named >= 0 || !!m.castId;
    const root = bars.map((_, i) => i);
    const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
    for (let i = 0; i < bars.length; i++) {
      if (solo(bars[i])) continue;
      for (let j = i + 1; j < bars.length; j++) {
        const p = bars[i], q = bars[j];
        if (solo(q) || q.def !== p.def || Math.abs(q.x - p.x) >= PACK_DX || Math.abs(q.y - p.y) >= PACK_DY) continue;
        root[find(j)] = find(i);
      }
    }
    const byRoot = new Map<number, World['enemies']>();
    bars.forEach((e, i) => { const r = find(i); const pk = byRoot.get(r); if (pk) pk.push(e); else byRoot.set(r, [e]); });
    const packs = [...byRoot.values()];
    // Where enemy bars and names sit this frame, so an ally's name over one can step back (below).
    const foeBoxes: { l: number; r: number; t: number; b: number }[] = [];
    this.barRecs.length = 0;
    const drawBar = (e: World['enemies'][number], hp: number, maxHp: number, ward: number, cast: World['enemies'][number] | undefined, x: number, top: number): void => {
      const bw = e.def.rank === 'rare' ? 70 : 56;
      // HD-2D: the overlay redraws these bars over the 3D view (foeEdgeMarks3d), at the foe's projected place.
      if (this.hd2d) this.barRecs.push({ i: w.enemies.indexOf(e), pack: x !== e.x, sx: 0, sy: 0, x, y: e.y, top, bw, hp: Math.max(0, hp) / maxHp, col: NAME_COLOR[e.named >= 0 ? 'rare' : e.def.rank], cast: cast ? cast.castT / cast.castDur : -1, castCol: cast ? (cast.interruptible ? '#8fd8ff' : '#' + SOAK.toString(16).padStart(6, '0')) : '', ward: ward > 0 ? Math.min(1, (ward / maxHp) * 5) : 0 });
      foeBoxes.push({ l: x - bw / 2, r: x + bw / 2, t: top - 3, b: top + (cast ? 13 : 6) });
      b.fillStyle(0x000000, 0.6).fillRect(x - bw / 2, top, bw, 6);
      b.fillStyle(hex(NAME_COLOR[e.named >= 0 ? 'rare' : e.def.rank]), 1).fillRect(x - bw / 2, top, (bw * Math.max(0, hp)) / maxHp, 6);
      if (cast) {
        b.fillStyle(0x000000, 0.7).fillRect(x - bw / 2, top + 8, bw, 5);
        b.fillStyle(cast.interruptible ? 0x8fd8ff : SOAK, 1).fillRect(x - bw / 2, top + 8, (bw * cast.castT) / cast.castDur, 5);
      }
      if (ward > 0) b.fillStyle(0xe8f4ff, 0.95).fillRect(x - bw / 2, top - 3, bw * Math.min(1, (ward / maxHp) * 5), 3);
    };
    for (const pk of packs) {
      if (pk.length < PACK_MIN) {
        for (const e of pk) {
          const top = e.y - e.def.radius - 14;
          drawBar(e, e.hp, e.maxHp, e.ward, e.castId ? e : undefined, e.x, top);
          if (e.named >= 0) this.namedMark(g, b, e, top, now);
          // Phones (keep it simple): the foe in the target frame doesn't repeat its name over its head; its bar stays.
          if (this.hud.compact && w.enemies.indexOf(e) === this.hud.targetShown) continue;
          // C2: a named elite shows its title in the rare colour.
          names.push({ x: e.x, y: top, text: e.named >= 0 ? w.namedName(w.enemies.indexOf(e)) : e.def.name, color: NAME_COLOR[e.named >= 0 ? 'rare' : e.def.rank] });
        }
        continue;
      }
      const e = pk[0];
      let hp = 0, maxHp = 0, ward = 0, x = 0;
      for (const m of pk) { hp += Math.max(0, m.hp); maxHp += m.maxHp; ward += m.ward; x += m.x; }
      x /= pk.length;
      const top = e.y - e.def.radius - 14;
      drawBar(e, hp, maxHp, ward, undefined, x, top);
      names.push({ x, y: top, text: `${e.def.name} \u00d7${pk.length}`, color: NAME_COLOR[e.def.rank] });
    }
    for (const e of trash) {
      const bw = 30, top = e.y - e.def.radius - 7, hp = Math.max(0, e.hp) / e.maxHp, col = NAME_COLOR[e.def.rank];
      if (this.hd2d) this.barRecs.push({ i: w.enemies.indexOf(e), pack: false, trash: true, sx: 0, sy: 0, x: e.x, y: e.y, top, bw, hp, col, cast: -1, castCol: '', ward: 0 });
      b.fillStyle(0x000000, 0.6).fillRect(e.x - bw / 2, top, bw, 4);
      b.fillStyle(hex(col), 1).fillRect(e.x - bw / 2, top, bw * hp, 4);
    }
    names.sort((a, c) => a.y - c.y);
    const shown: typeof names = [];
    for (const n of names) {
      const base = n.text.replace(/ \u00d7\d+$/, '');
      if (shown.some((q) => q.text.replace(/ \u00d7\d+$/, '') === base && Math.abs(q.x - n.x) < 110 && n.y - q.y < 70)) continue;
      shown.push(n);
      const t = this.plates[plate++];
      if (t) {
        setColorIf(t.setVisible(true).setPosition(n.x, n.y - 2).setText(n.text), n.color);
        foeBoxes.push({ l: n.x - t.displayWidth / 2, r: n.x + t.displayWidth / 2, t: n.y - 2 - t.displayHeight, b: n.y - 2 });
      }
    }
    for (; plate < this.plates.length; plate++) if (this.plates[plate].visible) this.plates[plate].setVisible(false);
    // An ally's name over an enemy's bar or name (the tank's, nearly always, since it stands in melee) hid the enemy's
    // health. The foe's plate matters more mid-fight and the class ring still says who the ally is, so the name fades
    // back while it overlaps. A downed ally's name ("· down") always stays solid.
    for (const al of this.allies) {
      const lb = al.label;
      if (!lb.visible) continue;
      const hw = lb.displayWidth / 2, lt = lb.y - lb.displayHeight;
      const over = w.heroData(al.hero).player.hp > 0 && foeBoxes.some((q) => lb.x - hw < q.r && lb.x + hw > q.l && lt < q.b && lb.y > q.t);
      const a = over ? 0.3 : 1;
      if (lb.alpha !== a) lb.setAlpha(a);
    }

    this.stepFx(this.fx, dt);
    this.stepFx(this.smoke, dt);
    for (const tr of this.trails) this.stepFx(tr.fx, dt);
    for (const t of this.floats) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.age += dt;
      t.txt.y -= 34 * dt;
      t.txt.x += t.vx * dt;
      t.vx *= 0.92;
      // Pop in big, settle, then fade.
      t.txt.setScale(1 + Math.max(0, 1 - t.age / 0.14) * 0.7);
      // A long call-out ("Swallowed! Break the Craw") over a hero near the edge of a phone's view ran off it: keep it
      // whole inside the view (its origin is its centre).
      const fhw = t.txt.displayWidth / 2;
      const flo = view.x + 4 / cam.zoom + fhw;
      const fhi = view.right - 4 / cam.zoom - fhw;
      if (flo < fhi) t.txt.x = Math.min(fhi, Math.max(flo, t.txt.x));
      t.txt.setAlpha(Math.min(1, t.life * 2.5));
      if (t.life <= 0) t.txt.setVisible(false);
    }
    // Ambient embers drift up through the camera view and wrap around it.
    for (const m of this.motes) {
      const img = m.img;
      if (img.visible === this.lowFx) img.setVisible(!this.lowFx);
      img.y += (this.coalLights.length ? 1.2 : -1) * m.sp * dt;
      img.x += Math.sin(now / 900 + m.ph) * 10 * dt;
      if (img.y < view.y - 20) img.y += view.height + 40;
      else if (img.y > view.bottom + 20) img.y -= view.height + 40;
      if (img.x < view.x - 20) img.x += view.width + 40;
      else if (img.x > view.right + 20) img.x -= view.width + 40;
      img.setAlpha(0.25 + 0.35 * (0.5 + 0.5 * Math.sin(now / 500 + m.ph * 3)));
    }
    if (this.vignette) this.vignette.classList.toggle('low', p.hp > 0 && p.hp / p.maxHp < 0.3);
  }

  /** A season glow under a hero, with its mark (GLOW_MARK): an edged glow blends normally so its dark rim shows. */
  private glowImage(g: { id: string; color: string }): Phaser.GameObjects.Image {
    const mark = GLOW_MARK[g.id];
    const tex = { double: 'heroGlowDouble', edge: 'heroGlowEdge', facet: 'heroGlowFacet', crack: 'heroGlowCrack' }[mark ?? ''] ?? 'heroGlow';
    const img = this.add.image(0, 0, tex).setTint(hex(g.color)).setDepth(1.3);
    return mark === 'edge' ? img : img.setBlendMode(Phaser.BlendModes.ADD);
  }

  /**
   * L2: enemy, shadow, orb and gem sprites are made the first time their slot fills, not all
   * 2,960 up front: Phaser walks every display-list object each frame (getVisibleChildren,
   * willRender), and a fight shows a few dozen. Depths sit just under the objects made after them
   * in create() (hero shadows 2.5, loot beams 3, orbiters 7), so the draw order is unchanged.
   */
  private growPools(enemies: number, orbs: number, gems: number): void {
    while (this.enemySprites.length < enemies) {
      this.shadows.push(this.add.image(0, 0, 'shadow').setVisible(false).setDepth(2.49));
      this.enemySprites.push(this.add.image(0, 0, 'ashling', '0').setScale(BASE).setVisible(false).setDepth(4));
      this.enemyKinds.push('ashling');
      this.enemyFrames.push(0);
    }
    while (this.orbSprites.length < orbs) this.orbSprites.push(this.add.image(0, 0, 'bolt').setOrigin(0.78, 0.5).setScale(0.7).setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(6.99));
    while (this.gemSprites.length < gems) this.gemSprites.push(this.add.image(0, 0, 'gem').setVisible(false).setDepth(2.99));
  }

  private newFx(tex: string, depth: number, add: boolean): Fx {
    const img = this.add.image(0, 0, tex).setVisible(false).setDepth(depth);
    if (add) img.setBlendMode(Phaser.BlendModes.ADD);
    return { img, life: 0, max: 1, vx: 0, vy: 0, drag: 1, spin: 0, sx0: 1, sy0: 1, sx1: 1, sy1: 1, tint0: 0, tint1: 0 };
  }

  private stepFx(pool: Fx[], dt: number): void {
    for (const f of pool) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) { f.img.setVisible(false); continue; }
      const k = f.life / f.max;
      const t = easeOut(1 - k);
      const img = f.img;
      img.x += f.vx * dt;
      img.y += f.vy * dt;
      if (f.drag !== 1) { const d = Math.pow(f.drag, dt * 60); f.vx *= d; f.vy *= d; }
      if (f.spin) img.rotation += f.spin * dt;
      img.setAlpha(k).setScale(f.sx0 + (f.sx1 - f.sx0) * t, f.sy0 + (f.sy1 - f.sy0) * t);
      if (f.tint1) img.setTint(mixRgb(f.tint0, f.tint1, 1 - k));
    }
  }

  private pulseVignette(cls: string): void {
    const v = this.vignette;
    if (!v) return;
    v.classList.remove('hurt', 'big');
    void v.offsetWidth; // restart the CSS animation
    v.classList.add(...cls.split(' '));
  }

  private nextFx(pool: Fx[] = this.fx): Fx | undefined {
    let best: Fx | undefined;
    for (const f of pool) {
      if (f.life <= 0) return f;
      if (!best || f.life < best.life) best = f;
    }
    return best;
  }

  /** Start a pooled effect. Scales are absolute; tint 0 clears the tint. */
  private emit(pool: Fx[], tex: string, frame: string | undefined, x: number, y: number, life: number, o: Partial<Fx> & { tint?: number; rot?: number; flip?: boolean } = {}): Fx | undefined {
    const f = this.nextFx(pool);
    if (!f) return undefined;
    const img = f.img;
    if (img.texture.key !== tex || (frame !== undefined && img.frame.name !== frame)) img.setTexture(tex, frame);
    img.setVisible(true).setPosition(x, y).setAlpha(1).setRotation(o.rot ?? 0).setFlipX(!!o.flip);
    if (o.tint) img.setTint(o.tint).setTintMode(Phaser.TintModes.MULTIPLY);
    else img.clearTint();
    f.life = life;
    f.max = life;
    f.vx = o.vx ?? 0;
    f.vy = o.vy ?? 0;
    f.drag = o.drag ?? 1;
    f.spin = o.spin ?? 0;
    f.sx0 = o.sx0 ?? 1;
    f.sy0 = o.sy0 ?? f.sx0;
    f.sx1 = o.sx1 ?? f.sx0;
    f.sy1 = o.sy1 ?? f.sx1;
    f.tint0 = o.tint ?? 0;
    f.tint1 = o.tint1 ?? 0;
    return f;
  }

  /**
   * Season trail motes dropped behind the moving hero: stage 1 about 3 a second fading over 0.4 s,
   * stage 2 and 3 about 6 a second lasting 0.8 s (docs/design/season.md, "Season trails").
   * Trimmed effects keep stage 1's rate.
   */
  private trailStep(tr: GameScene['trails'][number], px: number, py: number, dt: number): void {
    const rich = tr.stage >= 2;
    tr.acc += dt * (rich && !this.lowFx ? 6 : 3);
    while (tr.acc >= 1) {
      tr.acc -= 1;
      if (tr.style === 'sparks') { this.trailEmbers(tr, px, py, rich); continue; }
      if (tr.style === 'frost') { this.trailFrost(tr, px, py, rich); continue; }
      if (tr.style === 'drip') { this.trailDrip(tr, px, py, rich); continue; }
      if (tr.style === 'oil') { this.trailOil(tr, px, py, rich); continue; }
      if (tr.style === 'chips') { this.trailChips(tr, px, py, rich); continue; }
      if (tr.style === 'crumbs') { this.trailCrumbs(tr, px, py, rich); continue; }
      if (tr.style === 'shards') { this.trailShards(tr, px, py, rich); continue; }
      // Each mote is a soft glow with a small glint beside it, so a few a second still read as a trail.
      const life = rich ? 0.8 : 0.4;
      const sz = (rich ? 1.6 : 1.4) + Math.random() * 0.3;
      const x = px + (Math.random() - 0.5) * 14;
      const y = py + 14 + (Math.random() - 0.5) * 8;
      this.emit(tr.fx, 'trailMote', undefined, x, y, life, { tint: tr.color, vx: (Math.random() - 0.5) * 10, vy: -10 - Math.random() * 8, drag: 0.96, sx0: sz, sx1: sz * 0.45 });
      if (!this.lowFx) this.emit(tr.fx, 'trailMote', undefined, x + (Math.random() - 0.5) * 18, y + (Math.random() - 0.5) * 10, life * 0.8, { tint: tr.color, vy: -16 - Math.random() * 10, drag: 0.95, sx0: sz * 0.5, sx1: sz * 0.15 });
    }
  }

  /**
   * A sparks trail (the Deep Bellows): small embers flicked up off the hero's heels that rise and cool
   * from the trail's colour to a dim forge red as they fade, like sparks off a bellows, instead of mist.
   */
  private trailEmbers(tr: GameScene['trails'][number], px: number, py: number, rich: boolean): void {
    const life = rich ? 0.8 : 0.4;
    const n = this.lowFx ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const sz = (i ? 0.8 : 1.2) + Math.random() * 0.25;
      this.emit(tr.fx, 'trailMote', undefined, px + (Math.random() - 0.5) * 30, py + 18 + (Math.random() - 0.5) * 8, life * (i ? 0.75 : 1),
        { tint: tr.color, tint1: EMBER_COOL, vx: (Math.random() - 0.5) * 26, vy: -20 - Math.random() * 14, drag: 0.97, sx0: sz, sy0: sz * 1.5, sx1: sz * 0.4, sy1: sz * 0.55 });
    }
  }

  /**
   * A frost trail (the Cold Hearth): small six-armed crystals shed off the hero's heels that drift down, turn
   * slowly and settle on the floor, deepening from the trail's near-white to rime blue as they fade: the
   * opposite of the Deep Bellows' rising sparks. They blend normally so their dark outline holds on pale frost.
   */
  private trailFrost(tr: GameScene['trails'][number], px: number, py: number, rich: boolean): void {
    // Shed at the heels and wide of the body (the hero's sprite would hide them), falling about 13 px to settle.
    const life = rich ? 1 : 0.6;
    const n = this.lowFx ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const sz = (i ? 0.6 : 0.85) + Math.random() * 0.15;
      this.emit(tr.fx, 'frostFlake', undefined, px + (Math.random() - 0.5) * 34, py + 14 + (Math.random() - 0.5) * 8, life * (i ? 0.8 : 1),
        { tint: tr.color, tint1: FROST_SETTLE, rot: Math.random() * Math.PI, vx: (Math.random() - 0.5) * 12, vy: 34 + Math.random() * 12, drag: 0.95, spin: (Math.random() - 0.5) * 3, sx0: sz, sx1: sz * 0.8 });
    }
  }

  /**
   * A drip trail (the Slag Moon): molten drops shaken off the hero's heels. Each falls a short way, stretched like a
   * drop, then squashes flat where it lands and cools from the trail's gold to a dull crust red as it fades. Unlike
   * the Deep Bellows' embers they fall instead of rising, and they pool instead of drifting. They blend normally (addTrail),
 * so the cooled crust stays visible on a dark floor instead of fading out.
   */
  private trailDrip(tr: GameScene['trails'][number], px: number, py: number, rich: boolean): void {
    const life = rich ? 1.2 : 0.7;
    const n = this.lowFx ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const sz = (i ? 0.8 : 1.1) + Math.random() * 0.2;
      this.emit(tr.fx, 'trailMote', undefined, px + (Math.random() - 0.5) * 30, py + 8 + (Math.random() - 0.5) * 6, life * (i ? 0.8 : 1),
        { tint: tr.color, tint1: SLAG_CRUST, vx: (Math.random() - 0.5) * 6, vy: 46 + Math.random() * 14, drag: 0.9, sx0: sz * 0.8, sy0: sz * 1.8, sx1: sz * 1.5, sy1: sz * 0.55 });
    }
  }

  /**
   * An oil trail (the Falling Press): small drops flicked off the heels that land and spread into a flat slick. Each
   * starts untinted, showing the texture's rainbow sheen, and settles to the trail's oil green as it fades.
   */
  private trailOil(tr: GameScene['trails'][number], px: number, py: number, rich: boolean): void {
    const life = rich ? 1.1 : 0.65;
    const n = this.lowFx ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const sz = (i ? 0.7 : 0.95) + Math.random() * 0.2;
      this.emit(tr.fx, 'oilDrop', undefined, px + (Math.random() - 0.5) * 30, py + 14 + (Math.random() - 0.5) * 6, life * (i ? 0.8 : 1),
        { tint: 0xffffff, tint1: tr.color, vx: (Math.random() - 0.5) * 16, vy: 6 + Math.random() * 6, drag: 0.9, sx0: sz * 0.8, sy0: sz * 0.8, sx1: sz * 1.5, sy1: sz * 0.7 });
    }
  }

  /**
   * A splinter trail (the Low Ebb): wood chips kicked off the heels that tumble out sideways, spinning, and darken
   * from the trail's raft brown to wet wood as they settle, like a raft shedding splinters.
   */
  private trailChips(tr: GameScene['trails'][number], px: number, py: number, rich: boolean): void {
    const life = rich ? 0.9 : 0.55;
    const n = this.lowFx ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const sz = (i ? 0.7 : 0.95) + Math.random() * 0.2;
      this.emit(tr.fx, 'woodChip', undefined, px + (Math.random() - 0.5) * 26, py + 14 + (Math.random() - 0.5) * 6, life * (i ? 0.8 : 1),
        { tint: tr.color, tint1: WET_WOOD, rot: Math.random() * Math.PI, vx: (Math.random() - 0.5) * 44, vy: -8 + Math.random() * 16, drag: 0.92, spin: (Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 5), sx0: sz, sx1: sz * 0.85 });
    }
  }

  /**
   * A crumb trail (the Long Hunger): small coal crumbs dropped off the heels, as if spilled from the Hoard. Each drops a
   * short way and lands, cooling from hot gold to the trail's ember red and crumbling a little smaller as it fades.
   * Unlike the Slag Moon's drips they are lumps, not stretched drops, and they don't splash flat.
   */
  private trailCrumbs(tr: GameScene['trails'][number], px: number, py: number, rich: boolean): void {
    const life = rich ? 1 : 0.6;
    const n = this.lowFx ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const sz = (i ? 0.65 : 0.9) + Math.random() * 0.2;
      this.emit(tr.fx, 'coalCrumb', undefined, px + (Math.random() - 0.5) * 30, py + 10 + (Math.random() - 0.5) * 6, life * (i ? 0.8 : 1),
        { tint: CRUMB_HOT, tint1: tr.color, rot: Math.random() * Math.PI, vx: (Math.random() - 0.5) * 18, vy: 26 + Math.random() * 10, drag: 0.88, sx0: sz, sx1: sz * 0.7 });
    }
  }

  /**
   * A shard trail (the Cracked Plate): angular steel shards that break off the hero's heels with a flash of crack cyan,
   * then fall, turning slowly, and settle to the trail's plate blue. Plate blue is the darkest trail yet, so each
   * shard starts bright cyan and only darkens as it settles, keeping the fresh end of the trail readable on a dark floor.
   */
  private trailShards(tr: GameScene['trails'][number], px: number, py: number, rich: boolean): void {
    const life = rich ? 1 : 0.6;
    const n = this.lowFx ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const sz = (i ? 0.75 : 1) + Math.random() * 0.2;
      this.emit(tr.fx, 'plateShard', undefined, px + (Math.random() - 0.5) * 32, py + 12 + (Math.random() - 0.5) * 6, life * (i ? 0.8 : 1),
        { tint: SHARD_FLASH, tint1: tr.color, rot: Math.random() * Math.PI * 2, vx: (Math.random() - 0.5) * 20, vy: 30 + Math.random() * 10, drag: 0.9, spin: (Math.random() - 0.5) * 4, sx0: sz, sx1: sz * 0.9 });
    }
  }

  /** A worn trail, if it names a known trail: its motes sit on the floor with the glow, under the
   * telegraph layer (depth 2), so a trail never hides an attack. Each has its own pool, so a busy fight
   * can't steal its motes. */
  private addTrail(hero: number, worn: { id: string; stage: number } | undefined, pool: number): void {
    const def = worn ? TRAILS[worn.id] : undefined;
    if (!def || !(worn!.stage >= 1)) return;
    const fx: Fx[] = [];
    const style = TRAIL_STYLE[def.id] ?? 'motes';
    const tex = style === 'frost' ? 'frostFlake' : style === 'oil' ? 'oilDrop' : style === 'chips' ? 'woodChip' : style === 'crumbs' ? 'coalCrumb' : style === 'shards' ? 'plateShard' : 'trailMote';
    // Motes and sparks glow (additive). The others blend normally, so what settles on the floor (rime blue, slag crust,
    // an oil slick, wet wood) stays visible instead of fading into it.
    for (let i = 0; i < pool; i++) fx.push(this.newFx(tex, 1.35, style === 'motes' || style === 'sparks'));
    this.trails.push({ hero, color: hex(def.color), stage: Math.min(3, Math.floor(worn!.stage)), fx, acc: 0, style });
  }

  /**
   * The Hoard (raid 2) art over the telegraph layer:
   * - Ember Feast: each spilled ember is a glowing coal nugget that flickers harder as it gutters out, inside a
   *   pickup ring whose arc runs down with its time (he eats it at zero).
   * - Fed: a furnace glow round his mouth that grows with every ember he has eaten (each one makes him hit harder).
   * - Gorge: an interruptible cast, so it wears the interrupt blue (the same as an interruptible cast bar): a ring
   *   closing in on him with the cast, and a pulsing outer ring.
   * - The Craw: a pulsing "hit this" ring of four brackets round it and an arc running down with the swallowed
   *   hero's time.
   * - Swallowed: the hero fades almost out (they are inside him) and a ring in their class colour pulses on his belly.
   */
  /**
   * V5 (variety): the Kiln's arena layouts, matched to the sim each frame.
   * - Stones (World.stones): basalt stumps whose base circle is the stone's r, so what blocks you is what you see.
   * - Lava (World.lava): a scrolling lava strip exactly c.w wide, with dark crust edges and a heat glow.
   * - Vents (World.flareVents): brick fire pits that rest dim and flare up while their circle is on the floor.
   * Pools are created on first need and hidden when a fight has fewer.
   */
  private layoutDraw(g: Phaser.GameObjects.Graphics, now: number): void {
    const w = this.world;
    // Phase 12 W2, Ondrel's Ironload: an iron weight hangs over the marked hero and comes down as it counts down. The
    // ground under them is the gold stand-in-it circle (SOAK): everyone inside shares the weight. A gold sweep round its
    // edge is the timer, and the weight's shadow darkens as it nears. The weight stays above the hero's name and bar,
    // so it never covers a class ring, and drops out of sight on the landing (the sim's slam).
    if (w.loadHero >= 0 && w.loadT > 0) {
      const m = w.heroData(w.loadHero).player;
      const hs = w.loadHero === w.acting ? this.player : this.allies.find((al) => al.hero === w.loadHero)?.img;
      const mx = hs?.x ?? m.x, my = hs?.y ?? m.y;
      const u = Math.min(1, 1 - w.loadT / IRONLOAD.time);
      const R = IRONLOAD.radius;
      const pulse = 0.5 + 0.5 * Math.sin(now / (u > 0.75 ? 70 : 140));
      g.fillStyle(SOAK, 0.1 + 0.08 * u).fillCircle(mx, my, R);
      g.lineStyle(2.5, SOAK, 0.55 + 0.3 * pulse).strokeCircle(mx, my, R);
      g.lineStyle(6, SOAK, 0.9).beginPath().arc(mx, my, R, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2, false).strokePath();
      g.fillStyle(0x000000, 0.12 + 0.3 * u).fillEllipse(mx, my + 4, 30 + 30 * u, (30 + 30 * u) * 0.4);
      if (!this.loadImg) this.loadImg = this.add.image(0, 0, 'ironWeight').setOrigin(0.5, 1).setDepth(6.5);
      const lift = 230 - 135 * u * u;
      this.loadImg.setVisible(true).setPosition(mx, my - lift).setScale(0.5 + 0.12 * u).setRotation(Math.sin(now / 260) * 0.05 * (1 - u));
      // A dashed drop line from the weight to just over the hero's name, so which hero it is never in doubt.
      for (let y = my - lift + 4; y < my - 62; y += 10) g.lineStyle(2, 0xc8d2e0, 0.5).lineBetween(mx, y, mx, Math.min(y + 5, my - 62));
      this.loadShown = { x: mx, y: my - lift };
    } else if (this.loadImg?.visible) {
      // Landed (or the mark ended): the weight drops the last stretch and is gone.
      this.loadImg.setVisible(false);
      if (this.loadShown && !this.lowFx) for (let k = 0; k < 6; k++) this.emit(this.fx, 'spark', undefined, this.loadShown.x + (Math.random() - 0.5) * 30, this.loadShown.y, 0.5, { tint: 0xc8d0e0, vx: (Math.random() - 0.5) * 120, vy: 40 + Math.random() * 60, drag: 0.95, sx0: 1.2, sx1: 0.3 });
      this.loadShown = null;
    }
    // V8 Emberdrift (Nhevra): live embers on the ice, walk over one to refill your coal. Each glows and breathes, sends up
    // a spark now and then, and shows its pick-up reach as a faint ring. For a moment after they fall (emberDrift) each
    // drops in from above on a fiery streak.
    const fallU = Math.min(1, (now - this.driftFallAt) / 550);
    w.driftEmbers.forEach((m, k) => {
      let img = this.driftImgs[k];
      if (!img) img = this.driftImgs[k] = this.add.image(0, 0, 'driftEmber').setDepth(1.6);
      const drop = (1 - fallU) * (1 - fallU) * 220;
      const pulse = 0.5 + 0.5 * Math.sin(now / 200 + k * 2.1);
      img.setVisible(true).setPosition(m.x, m.y - drop).setScale(0.8 + 0.08 * pulse);
      g.fillStyle(0xff9a4a, 0.22 + 0.12 * pulse).fillCircle(m.x, m.y, 24);
      g.lineStyle(1.5, 0xffb060, 0.35).strokeCircle(m.x, m.y, EMBERDRIFT.pickR);
      if (drop > 1) {
        g.lineStyle(6, 0xff8a3a, 0.35).lineBetween(m.x, m.y - drop - 70, m.x, m.y - drop);
        g.lineStyle(2.5, 0xffe2a0, 0.8).lineBetween(m.x, m.y - drop - 40, m.x, m.y - drop);
      } else {
        const u = ((now / 1100) + k * 0.37) % 1;
        g.fillStyle(0xffd27a, 0.8 * (1 - u)).fillCircle(m.x + Math.sin(now / 300 + k) * 5 * u, m.y - 10 - 34 * u, 2.2);
      }
    });
    for (let k = w.driftEmbers.length; k < this.driftImgs.length; k++) this.driftImgs[k].setVisible(false);
    // V8: the Drowned Foundry rolls the same layouts; there the stones are wet slate and the vents steam.
    const wet = w.dungeonId === 'foundry';
    // V5 in the Glarewell: its vents are cracked skylight lenses that flare with light.
    const glass = w.dungeonId === 'glarewell';
    if ((wet || glass) && !this.steamGfx) this.steamGfx = this.add.graphics().setDepth(1.45);
    this.steamGfx?.clear();
    w.stones.forEach((c, k) => {
      let img = this.stoneImgs[k];
      if (!img) img = this.stoneImgs[k] = this.add.image(0, 0, this.stoneKey()).setOrigin(0.5, 0.64).setDepth(2.4);
      img.setVisible(true).setPosition(c.x, c.y).setScale(c.r / 68);
    });
    for (let k = w.stones.length; k < this.stoneImgs.length; k++) this.stoneImgs[k].setVisible(false);
    w.lava.forEach((c, k) => {
      const len = Math.hypot(c.x2 - c.x1, c.y2 - c.y1);
      const ang = Math.atan2(c.y2 - c.y1, c.x2 - c.x1);
      let ts = this.lavaStrips[k];
      if (!ts) ts = this.lavaStrips[k] = this.add.tileSprite(0, 0, 64, 64, 'lavaTile').setDepth(1.5);
      ts.setVisible(true).setPosition((c.x1 + c.x2) / 2, (c.y1 + c.y2) / 2).setSize(len, c.w).setRotation(ang);
      ts.tilePositionX = -now / 60;
      // Phase 18 Halls (design's rule, #665): on the map a strip is cooled crust (heat 0, harmless) until its room's pack
      // wakes, then heats over a second and burns only at 1. Arena strips have no heat: always hot, drawn as before.
      const heat = c.heat ?? 1, heating = heat > 0 && heat < 1;
      // Crust is the lava darkened to grey-brown rock; it brightens back to today's lava as it heats.
      const mix = heat * heat;
      const ch = (a: number, b: number) => Math.round(a + (b - a) * mix);
      ts.setTint((ch(0x4a, 0xff) << 16) | (ch(0x38, 0xff) << 8) | ch(0x30, 0xff));
      // Heat glow either side, then dark crust on the edges, so the burning width reads exactly.
      const nx = -Math.sin(ang), ny = Math.cos(ang), hw = c.w / 2;
      const pulse = 0.5 + 0.5 * Math.sin(now / 300);
      // While it heats, the glow flares fast and bright: the warning that it is about to burn.
      const flare = heating ? 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(now / 55)) : 0;
      g.lineStyle(c.w + 26, 0xff5a14, (0.1 + 0.05 * pulse) * heat + flare).lineBetween(c.x1, c.y1, c.x2, c.y2);
      // Cooled: a faint ember seam down the middle, so it still reads as lava rock and not as floor.
      if (heat < 1) g.lineStyle(3, 0xff6a1f, 0.28 * (1 - heat)).lineBetween(c.x1, c.y1, c.x2, c.y2);
      for (const sd of [-1, 1]) {
        g.lineStyle(5, 0x2a0a04, 0.95).lineBetween(c.x1 + nx * hw * sd, c.y1 + ny * hw * sd, c.x2 + nx * hw * sd, c.y2 + ny * hw * sd);
        g.lineStyle(2, 0xffb060, 0.7 * heat + (heating ? 0.3 : 0)).lineBetween(c.x1 + nx * (hw - 4) * sd, c.y1 + ny * (hw - 4) * sd, c.x2 + nx * (hw - 4) * sd, c.y2 + ny * (hw - 4) * sd);
      }
    });
    for (let k = w.lava.length; k < this.lavaStrips.length; k++) this.lavaStrips[k].setVisible(false);
    w.flareVents.forEach((v, k) => {
      let img = this.kilnVentImgs[k];
      if (!img) img = this.kilnVentImgs[k] = this.add.image(0, 0, wet ? 'steamVent' : glass ? 'lensVent' : w.dungeonId === 'hammerdeep' ? 'forgeVent' : w.dungeonId === 'pressworks' ? 'pressVent' : RAID_VENT[w.dungeonId] ?? 'kilnVent').setDepth(1.4);
      // Its turn: a flare circle of its radius sits on it.
      const hot = w.telegraphs.some((t) => t.alive && t.shape === 'circle' && Math.abs(t.r - LAYOUT.ventRadius) < 1 && Math.abs(t.x - v.x) < 2 && Math.abs(t.y - v.y) < 2);
      const f = hot ? 0.5 + 0.5 * Math.sin(now / 70) : 0;
      img.setVisible(true).setPosition(v.x, v.y).setScale(0.5 + 0.06 * f).setAlpha(hot ? 1 : 0.85);
      if (hot && wet) {
        // Steam: soft puffs rising and spreading from the grate, staggered so the column keeps moving.
        for (let p = 0; p < (this.lowFx ? 3 : 6); p++) {
          const u = ((now / 900) + p / 6) % 1;
          const px = v.x + Math.sin(p * 2.1 + now / 400) * 10 * u, py = v.y - 70 * u;
          this.steamGfx!.fillStyle(0xdff6f0, 0.32 * (1 - u)).fillCircle(px, py, 12 + 26 * u);
        }
      } else if (hot && glass) {
        // Light: a pale gold glow on the lens and slow-turning rays spilling out of it, on the under layer.
        const sg = this.steamGfx!;
        sg.fillStyle(0xfff0c0, 0.16 + 0.1 * f).fillCircle(v.x, v.y, 46);
        const n = this.lowFx ? 5 : 9;
        for (let r = 0; r < n; r++) {
          const a = (r / n) * Math.PI * 2 + now / 2400, wdt = 0.09;
          const r1 = 58 + 10 * f;
          sg.fillStyle(0xfff4d6, 0.14 + 0.08 * f).fillTriangle(
            v.x + Math.cos(a - wdt) * 14, v.y + Math.sin(a - wdt) * 14,
            v.x + Math.cos(a + wdt) * 14, v.y + Math.sin(a + wdt) * 14,
            v.x + Math.cos(a) * r1, v.y + Math.sin(a) * r1);
        }
      } else if (hot) g.fillStyle(0xff8a3a, 0.18 + 0.12 * f).fillCircle(v.x, v.y, 40);
      g.lineStyle(1.5, wet ? 0x9fe8da : glass ? 0xffe6a0 : 0xff8a3a, 0.25).strokeCircle(v.x, v.y, LAYOUT.ventRadius);
    });
    for (let k = w.flareVents.length; k < this.kilnVentImgs.length; k++) this.kilnVentImgs[k].setVisible(false);
  }

  /**
   * V8 (variety): the tell for the Lensmother's Glintfall. While she casts it (castId 'glintfall'), shards of light gather
   * in a turning crown high over every standing pillar and brighten; in the last fifth of the cast they drop onto the
   * pillar, landing as the 80-radius hit circles do.
   */
  private glintDraw(now: number): void {
    const w = this.world;
    const m = w.enemies.find((e) => e.alive && e.kind === 'lensmother' && e.castId === 'glintfall');
    if (!m) { this.glintGfx?.clear(); return; }
    if (!this.glintGfx) this.glintGfx = this.add.graphics().setDepth(1.55);
    const g = this.glintGfx;
    g.clear();
    const f = Math.min(1, m.castT / Math.max(0.01, m.castDur));
    const n = this.lowFx ? 4 : 7;
    const fall = Math.max(0, (f - 0.8) / 0.2);
    for (const q of w.pillars) {
      if (q.cracked) continue;
      const hy = q.y - q.r - 90;
      const y0 = hy + (q.y - hy) * fall * fall;
      const gather = Math.min(1, f / 0.8);
      const spread = 46 * (1 - gather) + 10;
      g.fillStyle(0xfff4d6, 0.12 + 0.22 * gather).fillCircle(q.x, y0, 16 + 10 * gather);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + now / 500;
        const sx = q.x + Math.cos(a) * spread, sy = y0 + Math.sin(a) * spread * 0.5;
        // A long, thin diamond pointing down, so each shard reads as falling glass.
        const hl = 13 + 7 * gather + 18 * fall, hw = 4;
        g.fillStyle(0xfffbea, 0.5 + 0.4 * gather);
        g.fillTriangle(sx - hw, sy, sx + hw, sy, sx, sy - hl * 0.6);
        g.fillTriangle(sx - hw, sy, sx + hw, sy, sx, sy + hl);
      }
    }
  }

  /**
   * V8 (variety): Maelra's Sluicetide. From her phase 2 (60% health) on a tide run, the whole arena flows: a lattice of
   * pale water streaks drifts along World.tideAngle, faster than the heroes are pushed so the way reads at a glance,
   * with a faint teal wash over the floor. On each turn (tideTurn) the streaks flare brighter and swing round to the
   * new way. It sits on its own layer under the main graphics, so it never covers a class ring or a danger area.
   */
  private tideDraw(now: number): void {
    const w = this.world;
    const m = versionLive(w, 'tide') ? w.enemies.find((e) => e.alive && e.kind === 'maelra') : undefined;
    if (!m || m.hp > m.maxHp * 0.6) { this.tideGfx?.clear(); this.tideOn = false; return; }
    if (!this.tideGfx) this.tideGfx = this.add.graphics().setDepth(1.3);
    const g = this.tideGfx;
    g.clear();
    const dt = Math.min(0.1, this.game.loop.delta / 1000);
    if (!this.tideOn) { this.tideOn = true; this.tideShown = w.tideAngle; }
    const d = Math.atan2(Math.sin(w.tideAngle - this.tideShown), Math.cos(w.tideAngle - this.tideShown));
    this.tideShown += d * Math.min(1, dt * 5);
    this.tideBeat = Math.max(0, this.tideBeat - dt * 1.2);
    const ux = Math.cos(this.tideShown), uy = Math.sin(this.tideShown), px = -uy, py = ux;
    const R = w.arenaR;
    g.fillStyle(0x2fa596, 0.06 + 0.06 * this.tideBeat).fillCircle(0, 0, R);
    // The lattice in flow space (a along the current, b across it), clipped to what the camera sees and to the arena.
    const view = this.cameras.main.worldView;
    const cx = view.centerX, cy = view.centerY, half = Math.hypot(view.width, view.height) / 2 + 60;
    const S = this.lowFx ? 110 : 70, L = 150, len = 38;
    const ca = cx * ux + cy * uy, cb = cx * px + cy * py;
    const shift = ((now / 1000) * 120) % L;
    const alpha = 0.2 + 0.3 * this.tideBeat;
    g.lineStyle(3, 0xbff6ea, alpha);
    for (let j = Math.floor((cb - half) / S); j <= Math.ceil((cb + half) / S); j++) {
      const b = j * S;
      const off = (((j * 2654435761) >>> 0) % 1000) / 1000 * L;
      for (let i = Math.floor((ca - half) / L) - 1; i <= Math.ceil((ca + half) / L); i++) {
        const a = i * L + off + shift;
        const x = a * ux + b * px, y = a * uy + b * py;
        if (x * x + y * y > (R - 12) * (R - 12)) continue;
        g.lineBetween(x - ux * len, y - uy * len, x, y);
        // A small head, so each streak is also an arrow.
        g.lineBetween(x, y, x - ux * 10 + px * 7, y - uy * 10 + py * 7);
        g.lineBetween(x, y, x - ux * 10 - px * 7, y - uy * 10 - py * 7);
      }
    }
  }

  /**
   * Arena edge environments, by dungeon (EDGE_SETS). Props stand just outside the rim, alternating big and small,
   * each throwing a light pool that spills onto the floor inside. Props sit outside the play area (above the dark
   * beyond the rim, depth 1.97) and the light sits under everything that matters (depth 1.2), so neither ever hides a
   * danger area or a class ring. The pools flicker; the small props give off a spark or a steam puff now and then
   * (not on trimmed effects).
   * - The Kiln: brick furnaces and braziers, warm light, embers.
   * - The Drowned Foundry: brass boilers and valve standpipes, teal light, steam from the valve nozzles.
   * - The Hammerdeep: great anvils and miners' lanterns, a steady steel-white light.
   * - The Ashvents: basalt fumaroles and ember cairns, warm light, sparks.
   */
  private edgeDraw(now: number): void {
    const w = this.world;
    const set = EDGE_SETS[w.dungeonId];
    if (!set || w.stress) return;
    if (!this.edgeProps.length) {
      const R = ARENA;
      for (let k = 0; k < 12; k++) {
        const big = k % 2 === 0;
        const a = (k / 12) * Math.PI * 2 + 0.26;
        // Far enough out that even a prop below the arena (drawn upward) stays outside the rim.
        const r = R + (big ? 92 : 62);
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        const img = this.add.image(x, y, big ? set.big : set.small).setOrigin(0.5, 0.85).setScale(big ? 0.55 : 0.6).setDepth(1.97);
        const lr = R - 10;
        const light = set.light ? this.add.image(Math.cos(a) * lr, Math.sin(a) * lr, set.light).setBlendMode(Phaser.BlendModes.ADD).setDepth(1.2).setScale(big ? 1.15 : 0.85) : null;
        this.edgeProps.push({ img, light, x, y, fire: !big });
      }
    }
    this.edgeProps.forEach((p, k) => {
      const fl = this.lowFx ? 0 : 0.5 * Math.sin(now / set.flicker + k * 1.7) + 0.5 * Math.sin(now / (set.flicker * 0.44) + k * 4.1);
      p.light?.setAlpha(0.55 + 0.07 * fl);
      if (!p.fire || this.lowFx) return;
      if (set.puff === 'spark' && Math.random() < 0.03) {
        this.emit(this.fx, 'spark', undefined, p.x + (Math.random() - 0.5) * 10, p.y - 36, 0.9, { tint: 0xffb060, vx: (Math.random() - 0.5) * 20, vy: -50 - Math.random() * 30, drag: 0.98, sx0: 1.2, sx1: 0.2 });
      } else if (set.puff === 'steam' && Math.random() < 0.012) {
        // From the valve's side nozzle (texture 96 px, origin 0.5/0.85, scale 0.6: nozzle at about +12, -39).
        this.steam(p.x + 12, p.y - 39, 0.55);
      }
    });
  }

  /**
   * V5 (variety): the tell for the Kiln Mother's Kiln Draw (V3). While she casts it (castId 'kilnDraw'):
   * - embers stream in toward her from all round, faster as the cast fills, so the pull reads as a pull;
   * - chevrons on a ring point inward at her;
   * - her furnace mouth swells with light until the 150-radius burst lands.
   * The burst itself is the sim's ordinary red circle telegraph; this only adds the inward motion.
   */
  /** Y6 Carried Light: where the light is drawn now: World.lightX/Y, or on its way there for 0.6 s after it moved. */
  private lightAt(now: number): { x: number; y: number } {
    const w = this.world, an = this.lightAnim;
    const k = an ? (now - an.t0) / 600 : 1;
    if (an && (k >= 1 || an.tx !== w.lightX || an.ty !== w.lightY)) this.lightAnim = null;
    const e = 1 - (1 - k) * (1 - k);
    const at = this.lightAnim && an ? { x: an.fx + (an.tx - an.fx) * e, y: an.fy + (an.ty - an.fy) * e } : { x: w.lightX, y: w.lightY };
    this.lightLast = at;
    return at;
  }
  private lightLast = { x: 0, y: 0 };

  /**
   * Y6: the Kiln Mother's Turning Fire. Her four cones land one after another, turning one cone each time (w.turnDir).
   * A molten arrow curves round her through the cones in the order they land, the next cone to land shows a bright
   * leading edge, and small pips count 1 to 4 along each cone, so the way the sweep turns reads at a glance.
   */
  /**
   * Y6 Creeping Rime (Nhevra's third version): frost on the floor where the rime is. Fingers of hoarfrost branch out from
   * its middle and reach further on the side it is creeping toward, the trailing side thins, crystals glint, and a cold
   * mist rolls round the rim. The rim itself stays a clear pale line at CREEPING_RIME.r, so you can see where it bites.
   */
  /**
   * The 2D look (the fallback, and the battery-saving 2D setting) of three phase tells; 3D draws them natively.
   * - Millstone (the Cinder Colossus): a molten fan off his sides and front (never his open back) with droplets flung
   *   outward along it, and a bright leading edge.
   * - Inhale (Old Vorhulm): his bite ring; while he breathes in, a glowing maw and embers and ash streaming in to it.
   * - The Overflow (Grandmother Slag): while it warns, slag creeps in from the rim and her dry ring (OVERFLOW.safeR)
   *   pulses gold; once risen, a dark crust with drifting hot cracks fills everything outside the ring, with a bright
   *   lip where it laps at the dry floor.
   */
  private overflowDraw(now: number): void {
    const w = this.world;
    const b = w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
    if ((!w.flowStage && !w.inhaleStage && !(w.millT > 0)) || !b?.alive) { this.flowGfx?.clear(); return; }
    if (!this.flowGfx) this.flowGfx = this.add.graphics().setDepth(1.43);
    const g = this.flowGfx;
    g.clear();
    if (w.millT > 0) {
      const R = b.def.radius + MILL.range;
      const a0 = w.colFacing - MILL.arc, a1 = w.colFacing + MILL.arc;
      const flick = 0.22 + 0.08 * Math.sin(now / 90);
      g.fillStyle(0x7a1e08, 0.3).slice(b.x, b.y, R, a0, a1, false).fillPath();
      g.fillStyle(0xff6020, flick).slice(b.x, b.y, R * 0.72, a0, a1, false).fillPath();
      // Droplets flung out along the fan, each on its own spoke, racing outward and cooling as they go.
      const n = this.lowFx ? 14 : 28;
      for (let k = 0; k < n; k++) {
        const a = a0 + ((k * 0.618) % 1) * (a1 - a0);
        const f = (now / 700 + k * 0.37) % 1;
        const r = b.def.radius + f * (R - b.def.radius);
        g.fillStyle(f < 0.6 ? 0xffd080 : 0xff6a20, 0.9 * (1 - f * 0.7)).fillCircle(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, 3.2 - f * 1.6);
      }
      g.lineStyle(6, 0xff9040, 0.25).beginPath().arc(b.x, b.y, R, a0, a1, false).strokePath();
      g.lineStyle(2, 0xffd090, 0.85).beginPath().arc(b.x, b.y, R, a0, a1, false).strokePath();
      return;
    }
    if (w.inhaleStage) {
      const m = b.def.radius + INHALE.bite;
      const pulse = 0.5 + 0.5 * Math.sin(now / 120);
      const drawing = w.inhaleStage === 2;
      g.fillStyle(0xff5030, drawing ? 0.14 : 0.06 + 0.05 * pulse).fillCircle(b.x, b.y, m);
      g.lineStyle(3, 0xff5030, drawing ? 0.9 : 0.4 + 0.4 * pulse).strokeCircle(b.x, b.y, m);
      if (drawing) {
        // The maw: a hot glow at his centre, and embers and ash spiralling in to it from all round.
        g.fillStyle(0xffb070, 0.25 + 0.15 * pulse).fillCircle(b.x, b.y, b.def.radius * 0.7);
        g.fillStyle(0xfff0c0, 0.6).fillCircle(b.x, b.y, b.def.radius * 0.3);
        const n = this.lowFx ? 18 : 36;
        for (let k = 0; k < n; k++) {
          const f = 1 - ((now / 900 + k * 0.29) % 1);
          const a = (k / n) * Math.PI * 2 + (1 - f) * 0.9;
          const r = m * 0.6 + f * 260;
          const x = b.x + Math.cos(a) * r, y = b.y + Math.sin(a) * r;
          const ash = k % 3 === 0;
          g.fillStyle(ash ? 0x8a8078 : 0xffc080, (ash ? 0.5 : 0.85) * (1 - f * 0.5)).fillCircle(x, y, ash ? 2.6 : 2.2);
          if (!ash) g.lineStyle(1.5, 0xffd0a0, 0.35).lineBetween(x, y, x + Math.cos(a) * 18, y + Math.sin(a) * 18);
        }
      }
      return;
    }
    // In 3D the Overflow is drawn natively (a molten sheet and a gold safe ring, client/hd2d/renderer.ts), so the
    // floor bridge must not carry this flat one too.
    if (this.bridge) return;
    const R = OVERFLOW.safeR;
    const outer = ARENA * 2;
    if (w.flowStage === 2) {
      // The flood: a dark molten crust everywhere outside her ring...
      g.lineStyle(outer - R, 0x5a1606, 0.62).strokeCircle(b.x, b.y, (outer + R) / 2);
      // ...with hot cracks drifting round in it (seeded rings of short arcs, each turning at its own pace)...
      const n = this.lowFx ? 18 : 40;
      for (let k = 0; k < n; k++) {
        const rr = R + 24 + ((k * 61) % 360);
        const a = ((k * 2.399) % (Math.PI * 2)) + now / (2600 + (k % 5) * 500) * (k % 2 ? 1 : -1);
        const len = 0.18 + ((k * 0.37) % 0.25);
        g.lineStyle(2 + (k % 3), 0xff7a26, 0.55 + 0.25 * Math.sin(now / 200 + k)).beginPath().arc(b.x, b.y, rr, a, a + len, false).strokePath();
      }
      // ...and a bright lip where it laps at the dry floor.
      g.lineStyle(14, 0xff8a30, 0.28 + 0.06 * Math.sin(now / 140)).strokeCircle(b.x, b.y, R + 7);
      g.lineStyle(4, 0xffd080, 0.95).strokeCircle(b.x, b.y, R);
    } else {
      // The warning: slag creeping in from the rim, and her dry ring pulsing gold (the soak colour: come here).
      const k = Math.min(1, Math.max(0, 1 - w.flowT / OVERFLOW.warn));
      const edge = ARENA - (ARENA - R) * 0.35 * k;
      g.lineStyle(outer - edge, 0x6a1c08, 0.45).strokeCircle(b.x, b.y, (outer + edge) / 2);
      g.lineStyle(5, 0xff8a30, 0.6).strokeCircle(b.x, b.y, edge);
      const pulse = 0.5 + 0.5 * Math.sin(now / 110);
      g.fillStyle(SOAK, 0.06 + 0.06 * pulse).fillCircle(b.x, b.y, R);
      g.lineStyle(3 + 2 * pulse, SOAK, 0.5 + 0.4 * pulse).strokeCircle(b.x, b.y, R);
    }
  }

  /**
   * BOSSV2 in 2D: the three-stage Kiln Mother's eggs, heated quarters, eruption rings and kiln mouth (kilnmother2d.ts),
   * and red rings drawing in to Vorhulm the Glutton while it Gorges (aux2 1). Skipped under the 3D look, which draws
   * both itself (the floor bridge would otherwise copy them on top).
   */
  private kmDraw(now: number): void {
    const w = this.world;
    const glut = w.bossV2 ? w.enemies.find((e) => e.alive && e.kind === 'ashmaw' && e.aux2 === 1) : undefined;
    if (this.bridge || (!w.kmStage && !glut)) { this.kmGfx?.clear(); return; }
    if (!this.kmGfx) this.kmGfx = this.add.graphics().setDepth(1.46);
    const g = this.kmGfx.clear();
    drawKm2d(g, w, w.arenaR, now, w.player.x, w.player.y);
    if (glut) {
      const ph = (now / 1000 * 1.2) % 1, r = glut.def.radius * (2.6 - 1.5 * ph);
      g.lineStyle(3, 0xff3b3b, 0.75 * Math.sin(ph * Math.PI)).strokeCircle(glut.x, glut.y, r);
    }
  }

  private rimeDraw(now: number): void {
    const w = this.world;
    if (!w.rimeOn) { this.rimeGfx?.clear(); return; }
    if (!this.rimeGfx) this.rimeGfx = this.add.graphics().setDepth(1.44);
    const g = this.rimeGfx;
    g.clear();
    const x = w.rimeX, y = w.rimeY;
    // It spreads out from under her as it rises, then breathes a little.
    const grow = this.rimeBorn ? Math.min(1, (now - this.rimeBorn) / 600) : 1;
    const r = CREEPING_RIME.r * (1 - (1 - grow) ** 3) * (1 + 0.025 * Math.sin(now / 420));
    if (r < 2) return;
    // Which way it creeps, smoothed, so the leading fingers don't flick about as the nearest hero changes.
    const d = this.rimeDir;
    const mx = x - d.lx, my = y - d.ly, ml = Math.hypot(mx, my);
    if (ml > 0.2) { d.x += (mx / ml - d.x) * 0.08; d.y += (my / ml - d.y) * 0.08; }
    d.lx = x; d.ly = y;
    const dl = Math.hypot(d.x, d.y) || 1;
    const dir = Math.atan2(d.y / dl, d.x / dl);
    // The rime's floor: a cold sheen, densest in the middle, and a faint shadow ring outside the rim.
    g.fillStyle(0x0c1a2c, 0.18).fillCircle(x, y + 3, r * 1.04);
    for (let k = 0; k < 4; k++) g.fillStyle(0xe6f5ff, 0.07 + k * 0.025).fillCircle(x, y, r * (1 - k * 0.2));
    // Hoarfrost fingers: fixed angles and lengths (so the pattern holds still as it moves), longer toward where it creeps.
    const N = this.lowFx ? 16 : 26;
    const tk = Math.max(1, this.textK);
    for (let i = 0; i < N; i++) {
      const h = Math.sin(i * 12.9898) * 43758.5453;
      const rnd = h - Math.floor(h);
      const a = (i / N) * Math.PI * 2 + rnd * 0.3;
      const lead = Math.cos(a - dir);
      const len = r * (0.72 + rnd * 0.22) * (lead > 0 ? 1 + 0.18 * lead : 1 + 0.12 * lead);
      const ca = Math.cos(a), sa = Math.sin(a);
      const x0 = x + ca * r * 0.06, y0 = y + sa * r * 0.06;
      const x1 = x + ca * len, y1 = y + sa * len;
      const wv = (1.2 + rnd * 0.9) * tk;
      const al = 0.42 + 0.3 * Math.max(0, lead);
      // A tapered blade: wide at the root, a point at the tip.
      g.fillStyle(0xf6fcff, al).fillTriangle(x0 - sa * wv, y0 + ca * wv, x0 + sa * wv, y0 - ca * wv, x1, y1);
      // Two side branches at about 55%, and on the leading side a third further out.
      for (const [at, side, bl] of [[0.35, 1, 0.22], [0.5, -1, 0.26], [0.65, 1, 0.24], [0.8, -1, lead > 0.3 ? 0.2 : 0.12]] as const) {
        if (!bl) continue;
        const bx = x + ca * len * at, by = y + sa * len * at;
        const ba = a + side * (0.6 + rnd * 0.25);
        const bw = wv * 0.6;
        g.fillStyle(0xeaf7ff, al * 0.85).fillTriangle(bx - sa * bw, by + ca * bw, bx + sa * bw, by - ca * bw, bx + Math.cos(ba) * len * bl, by + Math.sin(ba) * len * bl);
      }
    }
    // Crystals that catch the light, a few at a time.
    for (let i = 0; i < 9; i++) {
      const h = Math.sin(i * 78.233 + 1.7) * 24634.6345;
      const rnd = h - Math.floor(h);
      const a = rnd * Math.PI * 2, rr = r * (0.25 + 0.6 * ((rnd * 7.3) % 1));
      const tw = Math.max(0, Math.sin(now / 260 + i * 2.1));
      if (tw < 0.4) continue;
      const cx = x + Math.cos(a) * rr, cy = y + Math.sin(a) * rr, cs = (2 + 2.5 * tw) * tk;
      g.fillStyle(0xffffff, 0.5 + 0.5 * tw);
      g.fillTriangle(cx - cs, cy, cx, cy - cs * 1.6, cx + cs, cy);
      g.fillTriangle(cx - cs, cy, cx, cy + cs * 1.6, cx + cs, cy);
    }
    // Cold mist rolling round the rim: soft puffs that drift round and swell, thicker on the leading side.
    const P = this.lowFx ? 8 : 12;
    for (let i = 0; i < P; i++) {
      const a = (i / P) * Math.PI * 2 + now / 5200 * (i % 2 ? 1 : -1);
      const lead = Math.max(0, Math.cos(a - dir));
      const sw = 0.5 + 0.5 * Math.sin(now / 700 + i * 1.9);
      g.fillStyle(0xdcefff, 0.04 + 0.04 * sw + 0.05 * lead).fillCircle(x + Math.cos(a) * r * 1.0, y + Math.sin(a) * r * 1.0, r * (0.12 + 0.06 * sw + 0.05 * lead));
    }
    // The rim: a crisp frost line, ragged by a few px, brightest where it is creeping.
    const pts: Phaser.Math.Vector2[] = [];
    const M = 40;
    for (let k = 0; k <= M; k++) {
      const a = (k / M) * Math.PI * 2;
      const j = k % M;
      const h = Math.sin(j * 4.1 + 0.3) * 9631.17;
      const rr = r * (0.985 + 0.03 * (h - Math.floor(h)));
      pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * rr, y + Math.sin(a) * rr));
    }
    g.lineStyle(2.4 * tk, 0xd4ecff, 0.8).strokePoints(pts, true);
    const lx = x + Math.cos(dir) * r, ly = y + Math.sin(dir) * r;
    g.lineStyle(3.2 * tk, 0xffffff, 0.55 + 0.25 * Math.sin(now / 160)).beginPath();
    g.arc(x, y, r, dir - 0.7, dir + 0.7).strokePath();
    g.fillStyle(0xffffff, 0.35).fillCircle(lx, ly, 3 * tk);
  }

  /** Points of Ondrel's thrown hammer (a long haft and an iron head), turned by `ang`, at (x, y), `k` times life size. */
  private hammerShape(g: Phaser.GameObjects.Graphics, x: number, y: number, ang: number, k: number, glow = 0): void {
    const c = Math.cos(ang), sn = Math.sin(ang);
    const P = (pts: number[][]) => pts.map(([px, py]) => new Phaser.Math.Vector2(x + (px * c - py * sn) * k, y + (px * sn + py * c) * k));
    // The haft runs along +x from the grip; the head sits across its far end.
    const haft = P([[-30, -3], [16, -3], [16, 3], [-30, 3]]);
    const head = P([[12, -15], [30, -13], [30, 13], [12, 15]]);
    const face = P([[26, -12], [30, -11], [30, 11], [26, 12]]);
    g.fillStyle(0x5a3a22, 1).fillPoints(haft, true);
    g.lineStyle(1.5, 0x1a0e08, 1).strokePoints(haft, true);
    g.fillStyle(0x4a4650, 1).fillPoints(head, true);
    g.fillStyle(glow > 0 ? 0xffc27a : 0x8a8694, glow > 0 ? 0.6 + 0.4 * glow : 1).fillPoints(face, true);
    g.lineStyle(2, 0x0c0506, 1).strokePoints(head, true);
  }

  /**
   * Y6 the Homeward Hammer (Ondrel's third version). Stage 1: the hammer wheels end over end through the air from him to
   * the farthest hero, its shadow racing ahead and swelling, and lands as the circle does. Stage 2: it lies in a cracked
   * crater, rattling harder as it is called home, with a tug line drawn back to him; in the last 0.25 s it streaks back
   * along the line, the moment that line strikes. While it is out he has no hammer, so this is the only one on screen.
   */
  private homeDraw(now: number): void {
    const w = this.world;
    const st = w.bossVariant === 'home' || w.bossEcho === 'home' ? w.homeStage : 0;
    const b = w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
    if (!st || !b) {
      if (this.homeLast === 2 && b?.alive) this.emit(this.fx, 'ring', undefined, b.x, b.y - 20, 0.3, { tint: 0xffd08a, sx0: 0.6, sx1: 0.2 });
      this.homeLast = st;
      this.homeFloor?.clear(); this.homeLie?.clear();
      return;
    }
    this.homeLast = st;
    if (!this.homeFloor) this.homeFloor = this.add.graphics().setDepth(1.44);
    if (!this.homeLie) this.homeLie = this.add.graphics().setDepth(2.55);
    const fl = this.homeFloor, lie = this.homeLie, o = this.overFx;
    fl.clear(); lie.clear();
    const hx = w.homeX, hy = w.homeY;
    if (st === 1) {
      // In flight: from his hand to where it lands, timed to land as the circle does (HOMEWARD.fall).
      const th = this.homeThrow ?? { fx: b.x, fy: b.y - 30, tx: hx, ty: hy, t0: now - (1 - w.homeT / 1.8) * 1800 };
      const f = Math.min(1, (now - th.t0) / 1800);
      const gx = th.fx + (th.tx - th.fx) * f, gy = th.fy + 30 * f + (th.ty - th.fy - 30) * f;
      const lift = Math.sin(Math.PI * f) * 150 * (1 - 0.3 * f);
      fl.fillStyle(0x000000, 0.2 + 0.35 * f).fillEllipse(gx, gy + 8, 26 + 30 * f, 9 + 10 * f);
      this.hammerShape(o, gx, gy - lift - 10, now / 70, 1.1);
      // A faint arc of where it's going, so the farthest hero sees it's for them.
      // (On the floor graphics in 3D, which the bridge carries: overFx is covered there.)
      (this.bridge ? fl : o).lineStyle(2, 0xffc27a, 0.25 + 0.2 * f).strokeCircle(th.tx, th.ty, 10 + 8 * (1 - f));
      return;
    }
    // Landed: a cracked crater with the hammer head-down in it.
    const left = Math.max(0, w.homeT);
    const pull = 1 - left / 1.2;
    fl.fillStyle(0x000000, 0.35).fillEllipse(hx, hy + 6, 70, 26);
    fl.lineStyle(2, 0x1a1210, 0.9);
    for (let k = 0; k < 6; k++) {
      const a = k * 1.05 + 0.3;
      fl.beginPath().moveTo(hx + Math.cos(a) * 12, hy + 4 + Math.sin(a) * 5).lineTo(hx + Math.cos(a + 0.2) * 30, hy + 4 + Math.sin(a + 0.2) * 12).lineTo(hx + Math.cos(a) * 44, hy + 4 + Math.sin(a) * 17).strokePath();
    }
    const ang = Math.atan2(b.y - hy, b.x - hx);
    if (left > 0.25) {
      // The tug line back to him, brightening as it's called home, and the hammer rattling in the crater.
      const dash = 14, len = Math.hypot(b.x - hx, b.y - hy);
      const ux = (b.x - hx) / (len || 1), uy = (b.y - hy) / (len || 1);
      const run = (now / 12) % (dash * 2);
      fl.lineStyle(3, 0xffc27a, 0.25 + 0.45 * pull);
      for (let d = run; d < len - 20; d += dash * 2) fl.lineBetween(hx + ux * d, hy + uy * d, hx + ux * Math.min(len, d + dash), hy + uy * Math.min(len, d + dash));
      const jig = Math.sin(now / (pull > 0.6 ? 25 : 55)) * (2 + 4 * pull);
      this.hammerShape(lie, hx + Math.cos(ang) * jig * 0.5, hy - 8, Math.PI / 2 + jig * 0.04 + ang * 0.15 * pull, 1.1, pull);
    } else {
      // Home: it streaks back along the line with a hot trail.
      const f = 1 - left / 0.25;
      const x = hx + (b.x - hx) * f, y = hy - 8 + (b.y - 30 - hy + 8) * f;
      o.lineStyle(10, 0xffc27a, 0.25).lineBetween(hx, hy - 8, x, y);
      o.lineStyle(4, 0xfff0c0, 0.6).lineBetween(hx + (x - hx) * 0.4, hy - 8 + (y - hy + 8) * 0.4, x, y);
      this.hammerShape(o, x, y, ang + Math.PI + now / 40, 1.1, 1);
    }
  }

  private turnDraw(now: number): void {
    const w = this.world;
    const boss = w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
    const cones = boss?.alive && boss.kind === 'kilnMother' && w.bossVariant === 'turning'
      ? w.telegraphs.filter((t) => t.alive && t.shape === 'cone' && t.owner === w.bossIndex).sort((a, b) => (a.dur - a.t) - (b.dur - b.t))
      : [];
    if (!cones.length) { this.turnGfx?.clear(); return; }
    if (!this.turnGfx) this.turnGfx = this.add.graphics().setDepth(2.1);
    const g = this.turnGfx.clear();
    const dir = w.turnDir;
    const cx = boss!.x, cy = boss!.y;
    const R = boss!.def.radius + 70;
    const first = cones[0].angle, last = cones[cones.length - 1].angle;
    // The arrow: from the next cone to land round to the last, ending in a head that points the way it turns.
    const a0 = first - dir * cones[0].arc * 0.25, a1 = last + dir * cones[0].arc * 0.2;
    const steps = 24;
    g.lineStyle(10, 0x000000, 0.35).beginPath();
    for (let j = 0; j <= steps; j++) { const a = a0 + (a1 - a0) * (j / steps); const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R; if (j) g.lineTo(x, y); else g.moveTo(x, y); }
    g.strokePath();
    const flow = (now / 400) % 1;
    for (let j = 0; j < steps; j++) {
      const u = j / steps, a = a0 + (a1 - a0) * u, b = a0 + (a1 - a0) * ((j + 1) / steps);
      const lit = 0.55 + 0.45 * Math.max(0, Math.cos((u - flow) * Math.PI * 2));
      g.lineStyle(6, MOLTEN, lit).beginPath().moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R).lineTo(cx + Math.cos(b) * R, cy + Math.sin(b) * R).strokePath();
    }
    const hx = cx + Math.cos(a1) * R, hy = cy + Math.sin(a1) * R;
    const ta = a1 + dir * Math.PI / 2; // the tangent, the way it turns
    const back = 22, half = 14;
    g.fillStyle(MOLTEN, 1).fillTriangle(
      hx + Math.cos(ta) * 16, hy + Math.sin(ta) * 16,
      hx - Math.cos(ta) * back + Math.cos(a1) * half, hy - Math.sin(ta) * back + Math.sin(a1) * half,
      hx - Math.cos(ta) * back - Math.cos(a1) * half, hy - Math.sin(ta) * back - Math.sin(a1) * half,
    );
    // The next cone's leading edge (the side the sweep turns toward), brightening as it lands.
    const nx = cones[0], k = Math.max(0, Math.min(1, nx.t / nx.dur));
    const ea = nx.angle + dir * nx.arc / 2;
    g.lineStyle(4, 0xffe2a0, 0.4 + 0.5 * k).lineBetween(cx + Math.cos(ea) * boss!.def.radius, cy + Math.sin(ea) * boss!.def.radius, cx + Math.cos(ea) * Math.min(nx.r, 420), cy + Math.sin(ea) * Math.min(nx.r, 420));
    // Order pips: 1 to 4 dots along each cone's middle.
    cones.forEach((c, n) => {
      for (let j = 0; j <= n; j++) {
        const d = R + 46 + j * 16;
        g.fillStyle(n === 0 ? 0xffe2a0 : MOLTEN, n === 0 ? 1 : 0.8).fillCircle(cx + Math.cos(c.angle) * d, cy + Math.sin(c.angle) * d, 4.5);
      }
    });
  }

  private kilnDrawTell(g: Phaser.GameObjects.Graphics, now: number): void {
    const w = this.world;
    const i = w.enemies.findIndex((e) => e.alive && e.kind === 'kilnMother' && e.castId === 'kilnDraw');
    if (i < 0) return;
    const e = w.enemies[i];
    const sp = this.enemySprites[i];
    const cx = sp?.x ?? e.x, cy = sp?.y ?? e.y;
    const fill = Math.min(1, e.castT / Math.max(0.01, e.castDur));
    // Streaming embers: each on its own spoke, moving in from R to the mouth and starting over.
    const R = 360;
    const n = this.lowFx ? 18 : 40;
    const speed = 0.55 + 0.9 * fill;
    for (let k = 0; k < n; k++) {
      const a = k * 2.39996 + 0.3;
      const p = (now / 1000 * speed + k * 0.618) % 1;
      const r = R * (1 - p) + 30;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      const tail = 18 + 30 * p;
      const al = Math.min(1, p * 3) * (0.5 + 0.5 * fill);
      g.lineStyle(3, 0xff8a3a, 0.35 * al).lineBetween(x, y, x + Math.cos(a) * tail, y + Math.sin(a) * tail);
      g.lineStyle(1.6, 0xffd27a, 0.9 * al).lineBetween(x, y, x + Math.cos(a) * tail * 0.5, y + Math.sin(a) * tail * 0.5);
    }
    // Chevrons pointing in, on a ring just outside the burst.
    const ringR = KILN_DRAW.radius + 60 - 30 * ((now / 600) % 1);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + now / 4000;
      const tx = cx + Math.cos(a) * ringR, ty = cy + Math.sin(a) * ringR;
      const bx = Math.cos(a) * 12, by = Math.sin(a) * 12, px = -Math.sin(a) * 10, py = Math.cos(a) * 10;
      g.lineStyle(4, 0xffb060, 0.55 + 0.3 * fill);
      g.beginPath(); g.moveTo(tx + bx + px, ty + by + py); g.lineTo(tx, ty); g.lineTo(tx + bx - px, ty + by - py); g.strokePath();
    }
    // The furnace mouth swelling with light (the mouth sits 14 of 112 px below the sprite's centre).
    const my = cy + 14 * ((sp?.displayHeight ?? 112) / 112);
    const o = this.overFx;
    const pulse = 0.5 + 0.5 * Math.sin(now / 80);
    o.fillStyle(0xff8a3a, 0.18 + 0.25 * fill).fillCircle(cx, my, 26 + 30 * fill);
    o.fillStyle(0xffe6a0, 0.25 + 0.35 * fill * pulse).fillCircle(cx, my, 12 + 14 * fill);
  }

  /** Where hero `k` is drawn: your own sprite, an ally's, or the sim's position. */
  private heroXY(k: number): { x: number; y: number } {
    const w = this.world;
    if (k === w.acting) return { x: this.player.x, y: this.player.y };
    const al = this.allies.find((a) => a.hero === k);
    if (al) return { x: al.img.x, y: al.img.y };
    const q = w.heroData(k).player;
    return { x: q.x, y: q.y };
  }

  /**
   * The Flue (raid 4, "pass it on"), every frame:
   * - Each Decree holder wears a burning seal over their head, inside a ring that runs down with its 8 s (gold, then
   *   red and pulsing in the last 3 s), and stands in a Scorch ring (REGENT.scorchRadius) that burns anyone close.
   * - A hero who just passed one wears the seal gone cold and cracked (Spent), with a grey arc running down with
   *   the time left, so the holder can see at a glance who can't take it back.
   * The seals sit above the name, so they never cover a class ring.
   */
  private flueMarks(now: number): void {
    const w = this.world;
    const g = this.gfx;
    const o = this.overFx;
    const k = this.textK;
    const lift = 66;
    let di = 0;
    for (const d of w.regentDecree) {
      const q = this.heroXY(d.hero);
      const late = d.t < 3;
      const pulse = 0.5 + 0.5 * Math.sin(now / (late ? 90 : 220));
      // Scorch: a hot dashed ring on the floor round the holder (the 3D view draws its own).
      if (!this.bridge) {
        g.fillStyle(0xff5a2a, 0.07 + 0.05 * pulse).fillCircle(q.x, q.y, REGENT.scorchRadius);
        g.lineStyle(3, 0xff7a3a, 0.55 + 0.3 * pulse);
        this.dashedCircle(g, q.x, q.y, REGENT.scorchRadius, now);
      }
      const img = this.decreeImgs[di++];
      const sy = q.y - lift * k;
      if (img) img.setVisible(true).setPosition(q.x, sy).setScale(0.62 * k * (late ? 1 + 0.08 * pulse : 1));
      // The countdown ring round the seal.
      const R = 19 * k;
      const f = Math.max(0, Math.min(1, d.t / REGENT.decreeTime));
      o.lineStyle(4 * k, 0x000000, 0.55).strokeCircle(q.x, sy, R);
      o.lineStyle(3 * k, late ? 0xff3a2a : 0xffc861, late ? 0.7 + 0.3 * pulse : 0.95).beginPath().arc(q.x, sy, R, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2, false).strokePath();
    }
    for (; di < this.decreeImgs.length; di++) if (this.decreeImgs[di].visible) this.decreeImgs[di].setVisible(false);
    let si = 0;
    for (let h = 0; h < w.heroes.length; h++) {
      const st = w.heroData(h).player.spentT ?? 0;
      if (st <= 0 || w.regentDecree.some((d) => d.hero === h)) continue;
      const img = this.spentImgs[si++];
      if (!img) break;
      const q = this.heroXY(h);
      const sy = q.y - lift * k;
      img.setVisible(true).setPosition(q.x, sy).setScale(0.75 * k).setAlpha(0.9);
      o.lineStyle(2.5 * k, 0xc8c0b8, 0.8).beginPath().arc(q.x, sy, 15 * k, -Math.PI / 2, -Math.PI / 2 + Math.min(1, st / REGENT.spentTime) * Math.PI * 2, false).strokePath();
    }
    for (; si < this.spentImgs.length; si++) if (this.spentImgs[si].visible) this.spentImgs[si].setVisible(false);
  }

  /** World time of the last Meltdown pulse, for the countdown ring to the next. */
  private meltAt = -1;

  /**
   * The Smeltery (raid 3, "get behind him"), drawn under the sprites. Phases 1 and 2: a cool steel arc on the floor
   * round his plated front half, and a hot slice behind him where hits land hardest (`colossusSide`'s arcs). Wheel:
   * gold chevrons circle him faster as the cast runs, with a ring closing in. Meltdown: the arcs go, his plate
   * cracks (the sheet) and a ring closes in on him until each pulse.
   */
  private smelteryDraw(g: Phaser.GameObjects.Graphics, e: World['enemies'][number], now: number): void {
    const w = this.world;
    // The Wheel's and Meltdown's rings: over his body in 2D (overFx), and on the main graphics in 3D, where the floor
    // bridge lays them on the floor (the 3D view covers overFx).
    const o = this.bridge ? g : this.overFx;
    // Outside his drawn body (the 192 sheet is wider than his hit radius), so the floor marks show round him.
    const R = e.def.radius + 36;
    // Phase 12 W3: the plate's middle (turned from his facing after a Plate Shift). The drawn plate slides to the sim's
    // over about a third of a second, so the band visibly sweeps round when the cast lands.
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    if (this.plateShown === null) this.plateShown = w.colPlate;
    this.plateShown = wrap(this.plateShown + wrap(w.colPlate - this.plateShown) * (1 - Math.exp(-Math.max(0, now - this.plateAt) / 110)));
    this.plateAt = now;
    const shifting = e.castId === 'plateShift' ? Math.min(1, e.castT / e.castDur) : 0;
    // While Plate Shift is cast, the band rattles in place.
    const fa = w.colFacing + this.plateShown + (shifting ? Math.sin(now / 28) * 0.05 * shifting : 0);
    if (w.bossPhase < 3) {
      // His plated front: a steel band round the front half, with a chevron where it points.
      g.lineStyle(7, shifting ? 0xffe0a8 : 0xc8d0e0, 0.5 + 0.3 * shifting).beginPath().arc(e.x, e.y, R, fa - COLO.frontArc, fa + COLO.frontArc, false).strokePath();
      g.lineStyle(2, 0xeef2ff, 0.75).beginPath().arc(e.x, e.y, R + 5, fa - COLO.frontArc, fa + COLO.frontArc, false).strokePath();
      const chev = (a: number, r: number, size: number, col: number, alpha: number) => {
        const cx = e.x + Math.cos(a) * r;
        const cy = e.y + Math.sin(a) * r;
        g.fillStyle(col, alpha).fillTriangle(cx + Math.cos(a) * size, cy + Math.sin(a) * size, cx + Math.cos(a + 2.4) * size * 0.78, cy + Math.sin(a + 2.4) * size * 0.78, cx + Math.cos(a - 2.4) * size * 0.78, cy + Math.sin(a - 2.4) * size * 0.78);
      };
      chev(fa, R + 10, 9, 0xeef2ff, 0.7);
      // Plate Shift's cast: sparks scrape off the band's ends, and a ghost band grows where it will slide to
      // (the same pick as the sim: the living non-tank who has hurt him most).
      if (shifting) {
        if (!this.lowFx && Math.random() < 0.5) {
          const end = fa + (Math.random() < 0.5 ? -1 : 1) * COLO.frontArc;
          this.spark(e.x + Math.cos(end) * R, e.y + Math.sin(end) * R, (Math.random() - 0.5) * 120, -40 - Math.random() * 80, 0.4, 1.3);
        }
        let pick = -1;
        let most = -1;
        for (let k = 0; k < w.heroes.length; k++) {
          const q = w.heroData(k).player;
          if (q.hp <= 0 || w.isTank(k)) continue;
          if ((w.colDmg[k] ?? 0) > most) { most = w.colDmg[k] ?? 0; pick = k; }
        }
        if (pick >= 0) {
          const q = w.heroData(pick).player;
          const ta = Math.atan2(q.y - e.y, q.x - e.x);
          g.lineStyle(6, 0xeef2ff, 0.25 + 0.55 * shifting).beginPath().arc(e.x, e.y, R + 14, ta - COLO.frontArc * shifting, ta + COLO.frontArc * shifting, false).strokePath();
        }
      }
      // His open back: a hot slice that breathes.
      const back = fa + Math.PI;
      const half = Math.PI - COLO.backArc;
      const breathe = 0.5 + 0.5 * Math.sin(now / 260);
      g.fillStyle(0xff8a3d, 0.08 + 0.06 * breathe).slice(e.x, e.y, R + 46, back - half, back + half, false).fillPath();
      g.lineStyle(4, 0xffb347, 0.55 + 0.25 * breathe).beginPath().arc(e.x, e.y, R + 46, back - half, back + half, false).strokePath();
    }
    if (e.castId === 'wheel') {
      const k = Math.min(1, e.castT / e.castDur);
      // Chevrons circling him, faster as the cast runs, and a ring closing in.
      const spin = (now / 1000) * (2 + 8 * k);
      o.lineStyle(3, 0xffd27a, 0.85);
      for (let q = 0; q < 3; q++) {
        const a = spin + (q * Math.PI * 2) / 3;
        o.beginPath().arc(e.x, e.y, R + 24, a, a + 0.9, false).strokePath();
        const hx = e.x + Math.cos(a + 0.9) * (R + 24);
        const hy = e.y + Math.sin(a + 0.9) * (R + 24);
        const t = a + 0.9 + Math.PI / 2;
        o.fillStyle(0xffd27a, 0.9).fillTriangle(hx + Math.cos(t) * 8, hy + Math.sin(t) * 8, hx + Math.cos(t + 2.3) * 6, hy + Math.sin(t + 2.3) * 6, hx + Math.cos(t - 2.3) * 6, hy + Math.sin(t - 2.3) * 6);
      }
      o.lineStyle(5, 0xffd27a, 0.8).strokeCircle(e.x, e.y, R + 70 - 50 * k);
    }
    if (w.bossPhase >= 3) {
      // Meltdown: a molten ring closes in on him until the next pulse.
      const since = this.meltAt >= 0 ? w.time - this.meltAt : 0;
      const k = Math.min(1, Math.max(0, since / COLO.meltEvery));
      const pulse = 0.5 + 0.5 * Math.sin(now / 120);
      g.fillStyle(MOLTEN, 0.08 + 0.06 * pulse).fillCircle(e.x, e.y, R + 10);
      o.lineStyle(4, MOLTEN, 0.35 + 0.5 * k).strokeCircle(e.x, e.y, R + 160 - 150 * k);
    }
  }

  private hoardDraw(g: Phaser.GameObjects.Graphics, e: World['enemies'][number], now: number): void {
    const w = this.world;
    // Coal Gorge's ring and the Craw's marks: over the bodies in 2D (overFx), and on the main graphics in 3D, where the
    // floor bridge lays them on the floor (the 3D view covers overFx). The party-frame pointer stays 2D only.
    const o = this.bridge ? g : this.overFx;
    for (const m of w.coalEmbers) {
      const f = Math.max(0, Math.min(1, m.t / VORHULM.emberLife));
      // Steady while fresh, guttering in the last third.
      const flick = f > 0.35 ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(now / 70 + m.x));
      const r = 7 + 2 * Math.sin(now / 200 + m.y);
      g.fillStyle(0xff7a2a, 0.22 * flick).fillCircle(m.x, m.y, r * 2.4);
      // A six-sided coal nugget with a hot core.
      const pts: Phaser.Math.Vector2[] = [];
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + m.x * 0.1;
        const rr = r * (k % 2 ? 0.8 : 1.05);
        pts.push(new Phaser.Math.Vector2(m.x + Math.cos(a) * rr, m.y + Math.sin(a) * rr * 0.85));
      }
      g.fillStyle(0x2a1a14, 0.95).fillPoints(pts, true);
      g.lineStyle(2, 0xffa040, 0.9 * flick).strokePoints(pts, true);
      g.fillStyle(0xffe6a0, 0.85 * flick).fillCircle(m.x, m.y, r * 0.42);
      // The pickup ring, its arc the time left.
      g.lineStyle(1.5, 0xffe2a0, 0.25).strokeCircle(m.x, m.y, VORHULM.emberPick);
      g.lineStyle(3, 0xffc861, 0.85).beginPath().arc(m.x, m.y, VORHULM.emberPick, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2, false).strokePath();
    }
    // Fed: his mouth burns brighter for every ember he has eaten (capped at 6).
    if (w.coalFed > 0) {
      const fed = Math.min(6, w.coalFed) / 6;
      const mx = e.x + (this.enemySprites[w.enemies.indexOf(e)]?.flipX ? -1 : 1) * e.def.radius * 0.35;
      g.fillStyle(0xff8a3d, 0.1 + 0.18 * fed + 0.05 * Math.sin(now / 180)).fillCircle(mx, e.y, e.def.radius * (0.7 + 0.5 * fed));
    }
    if (e.castId === 'coalGorge') {
      const k = Math.min(1, e.castT / e.castDur);
      const pulse = 0.5 + 0.5 * Math.sin(now / 90);
      o.lineStyle(3, 0x8fd8ff, 0.45 + 0.35 * pulse).strokeCircle(e.x, e.y, e.def.radius + 46);
      o.lineStyle(6, 0x8fd8ff, 0.9).strokeCircle(e.x, e.y, e.def.radius + 46 - 34 * k);
    }
    // The Craw.
    const cw = w.enemies.find((q) => q.alive && q.kind === 'craw');
    let left = 0;
    for (let k = 0; k < w.heroes.length; k++) left = Math.max(left, w.heroData(k).player.swallowT ?? 0);
    if (cw) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 110);
      const R = cw.def.radius + 14 + 4 * pulse;
      o.lineStyle(4, 0xfff0b0, 0.65 + 0.35 * pulse);
      for (let q = 0; q < 4; q++) {
        const a = q * (Math.PI / 2) + Math.PI / 4;
        o.beginPath().arc(cw.x, cw.y, R, a - 0.35, a + 0.35, false).strokePath();
      }
      if (left > 0) o.lineStyle(3, 0xff6a3d, 0.9).beginPath().arc(cw.x, cw.y, cw.def.radius + 6, -Math.PI / 2, -Math.PI / 2 + (left / VORHULM.swallowTime) * Math.PI * 2, false).strokePath();
      // Y9: on a phone the party frames sit over the left of the arena, and he often stands under them with the Craw
      // hidden. Then a pulsing pointer sits just right of the frames, aimed at it, so the "break this" target never
      // vanishes behind the HUD.
      const pb = this.partyBox();
      if (pb && cw.x + R > pb.l && cw.x - R < pb.r && cw.y + R > pb.t && cw.y - R < pb.b) {
        const cam = this.cameras.main;
        const sz = 16 / cam.zoom;
        const ex = pb.r + sz * 1.6;
        const ey = Math.min(pb.b - sz, Math.max(pb.t + sz, cw.y));
        const a = Math.atan2(cw.y - ey, cw.x - ex);
        const blink = 0.775 + 0.225 * Math.sin(now / 90);
        o.fillStyle(0x000000, 0.6).fillCircle(ex, ey, sz * 1.25);
        o.lineStyle(2 / cam.zoom, 0xfff0b0, blink).strokeCircle(ex, ey, sz * 1.25);
        o.fillStyle(0xfff0b0, blink).fillTriangle(
          ex + Math.cos(a) * sz, ey + Math.sin(a) * sz,
          ex + Math.cos(a + 2.4) * sz * 0.8, ey + Math.sin(a + 2.4) * sz * 0.8,
          ex + Math.cos(a - 2.4) * sz * 0.8, ey + Math.sin(a - 2.4) * sz * 0.8,
        );
      }
    }
  }

  /** The Hoard, every frame (even after he falls, so nobody stays faded): a swallowed hero fades nearly out, since
   * they are inside him, and a ring in their class colour pulses on his belly. */
  private hoardHeroes(g: Phaser.GameObjects.Graphics, now: number): void {
    const w = this.world;
    // Its ring: over the hero in 2D (overFx); on the main graphics in 3D, where the floor bridge carries it.
    const o = this.bridge ? g : this.overFx;
    const heroes = [{ k: w.acting, img: this.player as Phaser.GameObjects.Sprite | Phaser.GameObjects.Image }, ...this.allies.map((al) => ({ k: al.hero, img: al.img as Phaser.GameObjects.Sprite | Phaser.GameObjects.Image }))];
    for (const { k, img } of heroes) {
      const q = w.heroData(k).player;
      const inside = (q.swallowT ?? 0) > 0;
      const a = inside ? 0.18 : 1;
      if (img.alpha !== a) img.setAlpha(a);
      if (!inside) continue;
      const col = hex(CLASS_ICON[w.heroes[k].cls].color);
      const beat = 0.5 + 0.5 * Math.sin(now / 140);
      g.fillStyle(col, 0.18 + 0.12 * beat).fillCircle(img.x, img.y + 6, 20 + 4 * beat);
      o.lineStyle(3, col, 0.75 + 0.25 * beat).strokeCircle(img.x, img.y + 6, 20 + 4 * beat);
    }
  }

  /** CSS px of the screen's top that the HUD covers (the top row, party frames' first row, boss panel, hints), refreshed
   * twice a second: reading the layout every frame would force a reflow. `banner` is the cast banner's box while it
   * shows (CSS px), or undefined. */
  private hudCover: { px: number; at: number; row: number; bar: number; barL: number; banner?: DOMRect; party?: DOMRect } = { px: 0, at: -1, row: 0, bar: 0, barL: 0 };

  /** The party frames' box in world units, if they are showing (refreshed with clearView's HUD read). */
  private partyBox(): { l: number; r: number; t: number; b: number } | undefined {
    this.clearView();
    const pr = this.hudCover.party;
    const full = this.cameras.main.worldView;
    const c = this.game.canvas.getBoundingClientRect();
    if (!pr || !c.width || !c.height) return undefined;
    return {
      l: full.x + ((pr.left - c.left) / c.width) * full.width, r: full.x + ((pr.right - c.left) / c.width) * full.width,
      t: full.y + ((pr.top - c.top) / c.height) * full.height, b: full.y + ((pr.bottom - c.top) / c.height) * full.height,
    };
  }

  /**
   * Allies' names (with their title and bot mark) that sit under the HUD's top panels or behind the cast banner are
   * hidden: the boss panel is see-through, so a name under it shows as a smear across the boss's name, and names
   * over the banner's text make both unreadable on a phone. Their health bars and edge arrows stay.
   */
  private hideCoveredLabels(): void {
    const v = this.clearView();
    const full = this.cameras.main.worldView;
    const c = this.game.canvas.getBoundingClientRect();
    const bn = this.hudCover.banner;
    // The banner's box in world units.
    const bw = bn && c.width && c.height ? {
      l: full.x + ((bn.left - c.left) / c.width) * full.width, r: full.x + ((bn.right - c.left) / c.width) * full.width,
      t: full.y + ((bn.top - c.top) / c.height) * full.height, b: full.y + ((bn.bottom - c.top) / c.height) * full.height,
    } : undefined;
    for (const al of this.allies) {
      const lb = al.label;
      const top = lb.y - lb.displayHeight * lb.originY;
      const hw = lb.displayWidth / 2;
      const behind = !!bw && lb.x + hw > bw.l && lb.x - hw < bw.r && top + lb.displayHeight > bw.t && top < bw.b;
      const show = top >= v.y && !behind;
      if (lb.visible !== show) lb.setVisible(show);
      if (al.tag && al.tag.visible !== show) al.tag.setVisible(show);
      if (al.mark && al.mark.visible !== show) al.mark.setVisible(show);
    }
  }

  /**
   * The part of the camera's view the HUD doesn't cover, in world units: the full view minus the strip under the top
   * panels. Edge arrows test against it and sit on its edge, so a gold circle under the boss panel still gets one.
   */
  private barCover: { at: number; r?: { left: number; top: number }; party?: { right: number; top: number; bottom: number } } = { at: -1 };
  /** Y9: edge chevrons for foes off screen on a phone (see the call in the draw loop). */
  private foeEdgeMarks(b: Phaser.GameObjects.Graphics, now: number): void {
    const w = this.world;
    const cam = this.cameras.main;
    const v = this.clearView();
    const inset = 10 / cam.zoom;
    const SECTORS = 16;
    const count = new Array<number>(SECTORS).fill(0);
    const big = new Array<boolean>(SECTORS).fill(false);
    const sx = new Array<number>(SECTORS).fill(0);
    const sy = new Array<number>(SECTORS).fill(0);
    const cx = v.centerX;
    const cy = v.centerY;
    for (const e of w.enemies) {
      if (!e.alive || e.def.stationary) continue;
      if (e.x > v.x + inset && e.x < v.right - inset && e.y > v.y + inset && e.y < v.bottom - inset) continue;
      const a = Math.atan2(e.y - cy, e.x - cx);
      const k = ((Math.round((a / (Math.PI * 2)) * SECTORS) % SECTORS) + SECTORS) % SECTORS;
      count[k]++;
      sx[k] += e.x - cx;
      sy[k] += e.y - cy;
      if (e.def.rank !== 'normal') big[k] = true;
    }
    // Phase 15 Y1: a held pack about to come in (the 2 s "More Coming" warning) has not spawned yet, so point at the
    // flank it comes from, sized by how many are coming and pulsing faster than the foes already here.
    const fast = new Array<boolean>(SECTORS).fill(false);
    if (w.reinforceN > 0 && w.reinforceT <= WAVES.reinforceWarn) {
      const rr = w.arenaR - 60;
      const ix = Math.cos(w.reinforceA) * rr, iy = Math.sin(w.reinforceA) * rr;
      if (!(ix > v.x + inset && ix < v.right - inset && iy > v.y + inset && iy < v.bottom - inset)) {
        const a = Math.atan2(iy - cy, ix - cx);
        const k = ((Math.round((a / (Math.PI * 2)) * SECTORS) % SECTORS) + SECTORS) % SECTORS;
        count[k] += w.reinforceN;
        sx[k] += (ix - cx) * w.reinforceN;
        sy[k] += (iy - cy) * w.reinforceN;
        fast[k] = true;
      }
    }
    const pad = 20 / cam.zoom;
    const hw = v.width / 2 - pad;
    const hh = v.height / 2 - pad;
    const pulse = 0.8 + 0.2 * Math.sin(now / 160);
    // The action bar covers the bottom-right corner of a phone's view: a mark that would land under it slides
    // along the edge to clear it (left along the bottom edge, up along the right edge).
    if (now - this.barCover.at > 500) {
      this.barCover.at = now;
      const el = document.getElementById('actionbar');
      const r = el && !el.hidden ? el.getBoundingClientRect() : undefined;
      const c = this.game.canvas.getBoundingClientRect();
      this.barCover.r = r && r.width > 0 && c.width > 0
        ? { left: (r.left - c.left) / c.width, top: (r.top - c.top) / c.height }
        : undefined;
      // The party frames sit on the left edge in co-op: a mark that would land under them drops just below them.
      const pe = document.getElementById('party');
      const pr = pe && !pe.hidden ? pe.getBoundingClientRect() : undefined;
      this.barCover.party = pr && pr.width > 0 && c.width > 0
        ? { right: (pr.right - c.left) / c.width, top: (pr.top - c.top) / c.height, bottom: (pr.bottom - c.top) / c.height }
        : undefined;
    }
    const wv = cam.worldView;
    const bar = this.barCover.r ? { left: wv.x + this.barCover.r.left * wv.width, top: wv.y + this.barCover.r.top * wv.height } : undefined;
    const pc = this.barCover.party;
    const party = pc ? { right: wv.x + pc.right * wv.width, top: wv.y + pc.top * wv.height, bottom: wv.y + pc.bottom * wv.height } : undefined;
    for (let k = 0; k < SECTORS; k++) {
      if (!count[k]) continue;
      const a = Math.atan2(sy[k], sx[k]);
      const r = Math.min(hw / Math.abs(Math.cos(a) || 1e-6), hh / Math.abs(Math.sin(a) || 1e-6));
      let ex = cx + Math.cos(a) * r;
      let ey = cy + Math.sin(a) * r;
      if (bar && ex > bar.left - pad && ey > bar.top - pad) {
        if (ey >= v.bottom - pad - 1) ex = bar.left - pad;
        else ey = bar.top - pad;
      }
      if (party && ex < party.right + pad && ey > party.top - pad && ey < party.bottom + pad) ey = party.bottom + pad;
      const sz = (count[k] >= 5 ? 14 : count[k] >= 2 ? 12 : 10) / cam.zoom;
      const tri = (s: number) => [
        ex + Math.cos(a) * s, ey + Math.sin(a) * s,
        ex + Math.cos(a + 2.5) * s * 0.85, ey + Math.sin(a + 2.5) * s * 0.85,
        ex + Math.cos(a - 2.5) * s * 0.85, ey + Math.sin(a - 2.5) * s * 0.85,
      ] as const;
      b.fillStyle(0x000000, 0.55).fillTriangle(...tri(sz * 1.45));
      const pk = fast[k] ? 0.7 + 0.3 * Math.sin(now / 70) : pulse;
      if (big[k]) b.fillStyle(0xffc861, pk).fillTriangle(...tri(sz * 1.25));
      b.fillStyle(0xff4d3d, pk).fillTriangle(...tri(sz));
    }
  }

  /** HD-2D: this frame's foe health and cast bars, for the overlay (world units, as drawBar draws them in 2D). */
  private barRecs: { i: number; pack: boolean; trash?: boolean; sx: number; sy: number; x: number; y: number; top: number; bw: number; hp: number; col: string; cast: number; castCol: string; ward: number }[] = [];
  /** The 3D view's overlay for the phone edge chevrons (it covers the Phaser canvas they are drawn on in 2D). */
  private edgeCanvas: HTMLCanvasElement | null = null;
  /**
   * Y9 in the HD-2D test: the same chevrons as foeEdgeMarks, placed with the 3D camera (Hd2dView.project) and
   * drawn on a 2D canvas above the 3D one (z-index 2: over its canvas and top shade, under the HUD).
   */
  private foeEdgeMarks3d(now: number): void {
    const view = this.hd2d;
    const host = this.game.canvas.parentElement;
    if (!view || !host) return;
    let cv = this.edgeCanvas;
    const foes = this.hud.compact && this.world.phase === 'fight';
    // Co-op: an ally off screen gets its class-coloured arrow at every size, as in 2D (the 3D view hides those too).
    // Bars, names and combat text are flat UI the 3D view leaves to this overlay too (see drawLabels3d).
    const on = true;
    if (!cv) {
      if (!on) return;
      cv = this.edgeCanvas = document.createElement('canvas');
      cv.className = 'hd2d-edge';
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:2';
      host.appendChild(cv);
    }
    const hr = host.getBoundingClientRect();
    const W = hr.width, H = hr.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!on || !W || !H) return;
    const w = this.world;
    // The clear view: below a full-width boss or quest panel (clearView's cache, in viewport px), at most 40% down.
    this.clearView();
    const top = Math.min(0.4 * H, Math.max(0, this.hudCover.px - hr.top));
    this.drawLabels3d(g, view, Math.max(top, this.hudCover.row - hr.top), W, H);
    const inset = 10;
    const cx = W / 2, cy = (top + H) / 2;
    const SECTORS = 16;
    const count = new Array<number>(SECTORS).fill(0);
    const big = new Array<boolean>(SECTORS).fill(false);
    const fast = new Array<boolean>(SECTORS).fill(false);
    const sx = new Array<number>(SECTORS).fill(0);
    const sy = new Array<number>(SECTORS).fill(0);
    const add = (x: number, y: number, n: number, isBig: boolean, isFast: boolean) => {
      const p = view.project(x, y);
      // Behind the camera: point straight away from it (down the screen is toward the camera, so up).
      const px = p ? p.x : cx, py = p ? p.y : -H;
      if (p && px > inset && px < W - inset && py > top + inset && py < H - inset) return;
      const a = Math.atan2(py - cy, px - cx);
      const k = ((Math.round((a / (Math.PI * 2)) * SECTORS) % SECTORS) + SECTORS) % SECTORS;
      count[k] += n;
      sx[k] += (px - cx) * n;
      sy[k] += (py - cy) * n;
      if (isBig) big[k] = true;
      if (isFast) fast[k] = true;
    };
    if (foes) for (const e of w.enemies) if (e.alive && !e.def.stationary) add(e.x, e.y, 1, e.def.rank !== 'normal', false);
    if (foes && w.reinforceN > 0 && w.reinforceT <= WAVES.reinforceWarn) {
      const rr = w.arenaR - 60;
      add(Math.cos(w.reinforceA) * rr, Math.sin(w.reinforceA) * rr, w.reinforceN, false, true);
    }
    const pad = 20;
    const hw = W / 2 - pad, hh = (H - top) / 2 - pad;
    const rel = (id: string) => {
      const el = document.getElementById(id);
      const r = el && !el.hidden ? el.getBoundingClientRect() : undefined;
      return r && r.width > 0 ? { left: r.left - hr.left, top: r.top - hr.top, right: r.right - hr.left, bottom: r.bottom - hr.top } : undefined;
    };
    const bar = rel('actionbar');
    const party = rel('party');
    const pulse = 0.8 + 0.2 * Math.sin(now / 160);
    const tri = (ex: number, ey: number, a: number, s: number, col: string, alpha: number) => {
      g.globalAlpha = alpha;
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(ex + Math.cos(a) * s, ey + Math.sin(a) * s);
      g.lineTo(ex + Math.cos(a + 2.5) * s * 0.85, ey + Math.sin(a + 2.5) * s * 0.85);
      g.lineTo(ex + Math.cos(a - 2.5) * s * 0.85, ey + Math.sin(a - 2.5) * s * 0.85);
      g.closePath();
      g.fill();
    };
    for (let k = 0; k < SECTORS; k++) {
      if (!count[k]) continue;
      const a = Math.atan2(sy[k], sx[k]);
      const r = Math.min(hw / Math.abs(Math.cos(a) || 1e-6), hh / Math.abs(Math.sin(a) || 1e-6));
      let ex = cx + Math.cos(a) * r;
      let ey = cy + Math.sin(a) * r;
      // Clear of the action bar (slide along the edge) and below the co-op party frames, as in 2D.
      if (bar && ex > bar.left - pad && ey > bar.top - pad) {
        if (ey >= H - pad - 1) ex = bar.left - pad;
        else ey = bar.top - pad;
      }
      if (party && ex < party.right + pad && ey > party.top - pad && ey < party.bottom + pad) ey = party.bottom + pad;
      const sz = count[k] >= 5 ? 14 : count[k] >= 2 ? 12 : 10;
      const pk = fast[k] ? 0.7 + 0.3 * Math.sin(now / 70) : pulse;
      tri(ex, ey, a, sz * 1.45, '#000000', 0.55);
      if (big[k]) tri(ex, ey, a, sz * 1.25, '#ffc861', pk);
      tri(ex, ey, a, sz, '#ff4d3d', pk);
    }
    // Allies off screen or under the top panels: a class-coloured arrow on a dark disc (grey when down), as in 2D.
    for (const al of this.allies) {
      const q = w.heroData(al.hero).player;
      const p = view.project(q.x, q.y);
      const px = p ? p.x : cx, py = p ? p.y : -H;
      const ins = 20, pd = 26;
      if (p && px > ins && px < W - ins && py > top + ins && py < H - ins) continue;
      const a = Math.atan2(py - cy, px - cx);
      const k = Math.min((W / 2 - pd) / Math.abs(Math.cos(a) || 1e-6), ((H - top) / 2 - pd) / Math.abs(Math.sin(a) || 1e-6));
      const ex = cx + Math.cos(a) * k, ey = cy + Math.sin(a) * k;
      const sz = 12;
      g.globalAlpha = 0.55;
      g.fillStyle = '#000000';
      g.beginPath(); g.arc(ex, ey, sz * 1.2, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      g.fillStyle = q.hp <= 0 ? '#9a8a84' : CLASS_ICON[w.heroes[al.hero].cls].color;
      g.beginPath();
      g.moveTo(ex + Math.cos(a) * sz, ey + Math.sin(a) * sz);
      g.lineTo(ex + Math.cos(a + 2.4) * sz * 0.8, ey + Math.sin(a + 2.4) * sz * 0.8);
      g.lineTo(ex + Math.cos(a - 2.4) * sz * 0.8, ey + Math.sin(a - 2.4) * sz * 0.8);
      g.closePath(); g.fill();
    }
    // An empty vent or a lone Ysmeret flame off screen: the gold arrow 2D draws (emptyVents), placed with the 3D camera.
    // Oskel v2's crush line gets a red one (ev.col).
    for (const ev of this.emptyVents) {
      const p = view.project(ev.x, ev.y);
      const px = p ? p.x : cx, py = p ? p.y : -H;
      const ins = 20, pd = 30;
      // Under the co-op party frames counts as hidden too (phone pass, Ashvents, 25 Nov: a lone flame under them got no
      // arrow): the arrow then stands just right of the frames, pointing at it.
      const under = !!p && !!party && px < party.right + 6 && py > party.top - 6 && py < party.bottom + 6;
      if (p && !under && px > ins && px < W - ins && py > top + ins && py < H - ins) continue;
      let a = Math.atan2(py - cy, px - cx);
      const k = Math.min((W / 2 - pd) / Math.abs(Math.cos(a) || 1e-6), ((H - top) / 2 - pd) / Math.abs(Math.sin(a) || 1e-6));
      let ex = cx + Math.cos(a) * k, ey = cy + Math.sin(a) * k;
      if (under) { ex = party!.right + 24; ey = Math.max(party!.top + 16, Math.min(party!.bottom - 16, py)); a = Math.atan2(py - ey, px - ex); }
      const sz = 16, blink = 0.775 + 0.225 * Math.sin(now / 90);
      g.globalAlpha = 0.6; g.fillStyle = '#000000';
      g.beginPath(); g.arc(ex, ey, sz * 1.25, 0, Math.PI * 2); g.fill();
      const gold = '#' + (ev.col ?? SOAK).toString(16).padStart(6, '0');
      g.globalAlpha = blink; g.strokeStyle = gold; g.lineWidth = 2;
      g.beginPath(); g.arc(ex, ey, sz * 1.25, 0, Math.PI * 2); g.stroke();
      tri(ex, ey, a, sz, gold, blink);
    }
    g.globalAlpha = 1;
  }

  /**
   * HD-2D: foe health and cast bars, foe names, damage numbers and the soak, revive and gate texts, which the 2D
   * scene draws on its own (hidden) camera. Each goes at its projected floor point, at the same on-screen size as
   * in 2D. Over-the-head items (bars, names) get lifted by the 2D offset times LIFT, since the 3D sprites stand up.
   */
  private drawLabels3d(g: CanvasRenderingContext2D, view: Hd2dView, top: number, W: number, H: number): void {
    // The camera zoom maps world px to the game canvas, which runs at device resolution (main.ts); this overlay draws
    // in CSS px, so divide by that ratio or every name, number and bar comes out DPR times too big.
    const cw = this.game.canvas.getBoundingClientRect().width || 1;
    const z = this.cameras.main.zoom * (cw / this.game.canvas.width);
    const LIFT = 3.2;
    // A foe whose floor point is off screen gets no bar, name or number, as in 2D, where they'd be outside the camera.
    const onScreen = (q: { x: number; y: number }) => q.x >= 0 && q.x <= W && q.y >= 0 && q.y <= H;
    // Bars are never drawn smaller than 2D's own size at zoom 1: on a zoomed-out phone they shrank to ~40 px, too
    // small to read a cast on (QA playtest, 23 Nov: the first delve's coach line points at the Brute's cast bar).
    const zb = Math.max(z, 1);
    const placed: { l: number; r: number; t: number; b: number }[] = [];
    for (const r of this.barRecs) {
      r.sx = r.sy = NaN;
      const p = view.project(r.x, r.y);
      if (!p || !onScreen(p)) continue;
      // The bar sits just over the foe's drawn sprite (the renderer reports its head), so it reads as that foe's bar.
      // QA, 23 Nov: lifting the 2D offset by a fixed LIFT left bars and names ~60-100 px above short foes.
      const head = view.foeHead?.(r.i);
      if (r.trash) {
        // Trash: a small bar right on the foe's head, never stacked or lifted (design, 25 Nov).
        const tw = r.bw * zb, tx = (head ? head.x : p.x) - tw / 2, ty = head ? head.y - 6 * zb : p.y + (r.top - r.y) * z * LIFT;
        r.sx = tx + tw / 2; r.sy = ty;
        if (ty < top) continue;
        g.globalAlpha = 0.6; g.fillStyle = '#000000'; g.fillRect(tx, ty, tw, 4 * zb);
        g.globalAlpha = 1; g.fillStyle = r.col; g.fillRect(tx, ty, tw * r.hp, 4 * zb);
        continue;
      }
      const h = r.cast >= 0 ? 13 : 6;
      const bw = r.bw * zb;
      let cxp = head && !r.pack ? head.x : p.x;
      let y = head ? head.y - (h + 4) * zb : p.y + (r.top - r.y) * z * LIFT;
      // Foes bunched together: a bar (with its name above it) that would land on one already placed steps up above
      // it, so each name stays with its own bar (QA on #602: "Ember Spitter" and "Ashwall" printed on top of each other).
      // The box is the bar, or its name where that is wider (measured, not a fixed 96 px: phone pass 25 Nov, a Dimhorn
      // 50 px from two Snuffers had its bar stacked 75 px above it). A small overlap nudges the bar sideways instead.
      const plate = this.plates.find((t) => t.visible && t.text && Math.abs(r.x - t.x) < 1 && Math.abs(r.top - (t.y + 2)) < 1);
      let tw = 0;
      if (plate) { g.font = `${plate.style.fontStyle || ''} ${parseFloat(String(plate.style.fontSize)) * z * plate.scaleY}px ${plate.style.fontFamily}`; tw = g.measureText(plate.text).width; }
      const nameH = plate ? 16 * zb : 0, half = Math.max(bw / 2, tw / 2 + 3 * zb);
      for (let k = 0; k < 8; k++) {
        const hit = placed.find((q) => cxp - half < q.r && q.l < cxp + half && y - nameH < q.b && q.t < y + h * zb);
        if (!hit) break;
        const left = cxp <= (hit.l + hit.r) / 2;
        const shift = left ? cxp + half - hit.l : hit.r - (cxp - half);
        if (shift <= 14 * zb) cxp += left ? -(shift + 1) : shift + 1;
        else y = hit.t - h * zb - 3 * zb;
      }
      const x = cxp - bw / 2;
      placed.push({ l: cxp - half, r: cxp + half, t: y - nameH, b: y + h * zb });
      r.sx = cxp; r.sy = y;
      // Under the top row or a full-width panel the bar goes with its name (below), so neither clutters the HUD.
      if (y < top) continue;
      g.globalAlpha = 0.6; g.fillStyle = '#000000'; g.fillRect(x, y, bw, 6 * zb);
      g.globalAlpha = 1; g.fillStyle = r.col; g.fillRect(x, y, bw * r.hp, 6 * zb);
      if (r.cast >= 0) {
        g.globalAlpha = 0.7; g.fillStyle = '#000000'; g.fillRect(x, y + 8 * zb, bw, 5 * zb);
        g.globalAlpha = 1; g.fillStyle = r.castCol; g.fillRect(x, y + 8 * zb, bw * r.cast, 5 * zb);
      }
      if (r.ward > 0) { g.globalAlpha = 0.95; g.fillStyle = '#e8f4ff'; g.fillRect(x, y - 3 * zb, bw * r.ward, 3 * zb); }
    }
    g.globalAlpha = 1;
    const texts: { t: Phaser.GameObjects.Text; head: boolean; float?: boolean }[] = [
      ...this.plates.map((t) => ({ t, head: true })),
      ...this.floats.filter((f) => f.life > 0).map((f) => ({ t: f.txt, head: false, float: true })),
      ...this.gateTexts.map((t) => ({ t, head: false })),
      { t: this.soakText, head: false },
      { t: this.reviveText, head: false },
    ];
    const heads: { l: number; r: number; t: number; b: number; text: string }[] = [];
    // Combat numbers already drawn this frame: one hit on a tight pack lands the same number on the same spot (QA
    // playtest: "68" three times over), and the 3D tilt squashes the gap between them, so a number that would sit on
    // another steps up above it.
    const nums: { l: number; r: number; t: number; b: number }[] = [];
    for (const { t, head, float } of texts) {
      if (!t || !t.visible || !t.text || t.alpha <= 0) continue;
      // A name sits on its foe's bar: project the foe's own floor point (the bar record just below it) and lift.
      let p: { x: number; y: number } | null;
      if (head) {
        const bar = this.barRecs.find((r) => Math.abs(r.x - t.x) < 1 && Math.abs(r.top - (t.y + 2)) < 1);
        if (bar && !Number.isNaN(bar.sy)) p = { x: bar.sx, y: bar.sy - 2 * zb };
        else {
          const q = bar ? view.project(bar.x, bar.y) : view.project(t.x, t.y);
          if (!q || !onScreen(q)) continue;
          p = bar ? { x: q.x, y: q.y + (t.y - bar.y) * z * LIFT } : q;
        }
      } else p = view.project(t.x, t.y);
      if (!p || !onScreen(p)) continue;
      // A name under the top row, or the boss or quest panel, stays hidden.
      if (head && p.y < top) continue;
      const st = t.style;
      const size = parseFloat(String(st.fontSize)) * z * t.scaleY;
      g.font = `${st.fontStyle || ''} ${size}px ${st.fontFamily}`;
      g.textAlign = 'center';
      g.textBaseline = t.originY >= 1 ? 'bottom' : t.originY <= 0 ? 'top' : 'middle';
      g.globalAlpha = t.alpha;
      // Two of a kind whose names the 3D view's foreshortening pushes together: the second is dropped, as 2D drops
      // a name within 110 x 70 of the same one.
      if (head) {
        const tw = g.measureText(t.text).width;
        const box = { l: p.x - tw / 2, r: p.x + tw / 2, t: p.y - size, b: p.y };
        if (heads.some((q) => q.text === t.text && q.l < box.r && box.l < q.r && q.t < box.b && box.t < q.b)) continue;
        heads.push({ ...box, text: t.text });
      }
      if (float) {
        const tw = g.measureText(t.text).width;
        const box = { l: p.x - tw / 2, r: p.x + tw / 2, t: p.y - size / 2, b: p.y + size / 2 };
        for (let k = 0; k < 6; k++) {
          const hit = nums.find((q) => q.l < box.r && box.l < q.r && q.t < box.b && box.t < q.b);
          if (!hit) break;
          const dy = box.b - hit.t + 1;
          box.t -= dy; box.b -= dy;
        }
        nums.push(box);
        p = { x: p.x, y: (box.t + box.b) / 2 };
      }
      const lines = t.text.split('\n');
      const lh = size * 1.15;
      lines.forEach((line, i) => {
        const ly = p!.y - (lines.length - 1 - i) * lh * (t.originY >= 1 ? 1 : 0) + i * lh * (t.originY >= 1 ? 0 : 1);
        if (st.strokeThickness) { g.lineJoin = 'round'; g.lineWidth = st.strokeThickness * z; g.strokeStyle = st.stroke; g.strokeText(line, p!.x, ly); }
        g.fillStyle = st.color as string;
        g.fillText(line, p!.x, ly);
      });
    }
    // Hammerdeep (and the Crucible): Sundered, the tank swap's cue, as the 2D mark (a cracked red ring beside the hero).
    // The floor bridge flattened it onto the floor at a third of its size, unreadable on a phone (phone pass, 25 Nov).
    const w = this.world;
    // G6 revive: the bobbing green "+" over a downed hero nobody is reviving yet, or the grey struck-through cross when
    // a boss allows no more revives. 2D draws these on overFx, which the 3D view covers (sweep, docs/art/oskel-3d). The
    // revive circle, tether and progress ring are floor marks the bridge carries.
    if (w.heroes.length > 1) {
      const now = this.time.now;
      const rv = '#' + REVIVE.toString(16).padStart(6, '0');
      for (let k = 0; k < w.heroes.length; k++) {
        const q = w.heroData(k).player;
        if (q.hp > 0 || (w.revivesLeft > 0 && (q.reviveT ?? 0) > 0)) continue;
        const p = view.project(q.x, q.y);
        if (!p || !onScreen(p)) continue;
        const none = w.revivesLeft <= 0;
        // Above the hero's name, which sits over the body.
        const x = p.x, y = p.y - (90 + (none ? 0 : 3 * Math.sin(now / 300))) * zb, r = 11 * zb;
        g.globalAlpha = 0.8; g.fillStyle = none ? '#140c0a' : '#0c1a10';
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1; g.strokeStyle = none ? '#8a7d78' : rv; g.lineWidth = 2 * zb;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
        g.fillStyle = none ? '#8a7d78' : rv;
        g.fillRect(x - 6 * zb, y - 2 * zb, 12 * zb, 4 * zb); g.fillRect(x - 2 * zb, y - 6 * zb, 4 * zb, 12 * zb);
        if (none) {
          g.strokeStyle = '#ff6b6b'; g.lineWidth = 2.5 * zb; g.lineCap = 'round';
          g.beginPath(); g.moveTo(x - 8 * zb, y + 8 * zb); g.lineTo(x + 8 * zb, y - 8 * zb); g.stroke(); g.lineCap = 'butt';
        }
      }
    }
    // Ysmeret's (and Grandmother Slag's) vents: the badge over each, a green tick while a hero covers it and a blinking
    // red "!" while it is empty, as 2D's ventMark (its rings are floor marks the bridge carries).
    if (w.dungeonId === 'ashvents' || w.dungeonId === 'crucible') {
      const now = this.time.now;
      const dg = '#' + DANGER.toString(16).padStart(6, '0');
      for (const t of w.telegraphs) {
        if (!t.alive || t.kind !== 'soak' || t.owner !== -2) continue;
        let covered = false;
        for (let k = 0; k < w.heroes.length && !covered; k++) {
          const q = w.heroData(k).player;
          if (q.hp > 0 && (q.x - t.x) ** 2 + (q.y - t.y) ** 2 <= t.r * t.r) covered = true;
        }
        const bp = view.project(t.x, t.y - t.r);
        if (!bp || !onScreen(bp)) continue;
        const bx = bp.x, by = bp.y - 14 * zb, r = 11 * zb;
        const f = Math.min(1, Math.max(0, t.t / Math.max(0.01, t.dur)));
        const blink = 0.5 + 0.5 * Math.sin(now / (f > 0.6 ? 60 : 140));
        g.fillStyle = covered ? 'rgba(16,32,15,0.85)' : 'rgba(32,10,14,0.85)';
        g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.fill();
        g.lineCap = 'round';
        if (covered) {
          g.strokeStyle = '#9fe8a8'; g.lineWidth = 2 * zb; g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.stroke();
          g.lineWidth = 3 * zb; g.beginPath(); g.moveTo(bx - 5 * zb, by); g.lineTo(bx - 1 * zb, by + 4 * zb); g.lineTo(bx + 6 * zb, by - 4 * zb); g.stroke();
        } else {
          g.globalAlpha = 0.6 + 0.4 * blink; g.strokeStyle = dg; g.lineWidth = 2 * zb;
          g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
          g.fillStyle = dg; g.fillRect(bx - 1.5 * zb, by - 7 * zb, 3 * zb, 9 * zb); g.fillRect(bx - 1.5 * zb, by + 4 * zb, 3 * zb, 3 * zb);
        }
        g.lineCap = 'butt';
      }
    }
    // Class marks 2D draws on overFx, which the 3D view covers: the Slagbinder's Cooling Shell (a pale dome over the
    // hero) and Brittle (pale fracture lines over a foe), and the Emberwright's Ember Ward (a ring of flame tongues round
    // the hero, thinning as it is spent). The Slagbinder's plate band and the shell's floor ring are floor marks the
    // bridge carries. Drawn on this overlay, so no draw calls.
    {
      const now = this.time.now, t = w.time;
      const css = (c: number) => '#' + c.toString(16).padStart(6, '0');
      for (let k = 0; k < w.heroes.length; k++) {
        const q = w.heroData(k).player;
        if (q.hp <= 0) continue;
        const shell = (q.shellUntil ?? -1) > t;
        const ward = q.plateBy === -1 && (q.plate ?? 0) > 0 && (q.plateUntil ?? -1) > t;
        if (!shell && !ward) continue;
        const p = view.project(q.x, q.y);
        if (!p || !onScreen(p)) continue;
        // The hero's body: about 36 px over the feet, 34 wide and 52 tall at zoom 1 (the 3D sprite stands at its full
        // drawn height since it leans to face the camera).
        const cx = p.x, cy = p.y - 36 * zb, rx = 34 * zb, ry = 52 * zb;
        if (shell) {
          const fade = Math.min(1, ((q.shellUntil ?? 0) - t) / 0.6);
          g.globalAlpha = 0.14 * fade; g.fillStyle = css(SLAG_COOL);
          g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
          g.globalAlpha = (0.6 + 0.15 * Math.sin(now / 200)) * fade; g.strokeStyle = css(SLAG_COOL); g.lineWidth = 2 * zb;
          g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, Math.PI * 1.02, Math.PI * 1.98); g.stroke();
          g.globalAlpha = 0.4 * fade; g.strokeStyle = '#ffffff'; g.lineWidth = 1.5 * zb;
          g.beginPath(); g.ellipse(cx - 5 * zb, cy - 6 * zb, rx * 0.68, ry * 0.68, 0, Math.PI * 1.2, Math.PI * 1.45); g.stroke();
          g.globalAlpha = 1;
        }
        if (ward) {
          const frac = Math.max(0.15, Math.min(1, (q.plate ?? 0) / Math.max(1, q.plateAmt ?? q.plate ?? 1)));
          const fade = Math.min(1, ((q.plateUntil ?? 0) - t) / 0.4);
          g.globalAlpha = 0.1 * fade; g.fillStyle = css(WARD_FIRE);
          g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
          g.globalAlpha = 0.55 * fade; g.strokeStyle = css(WARD_FIRE); g.lineWidth = 2 * zb;
          g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.stroke();
          const n = 12;
          for (let j = 0; j < n && j / n < frac; j++) {
            const a = now / 700 + (j / n) * Math.PI * 2;
            const fl = (7 + 4 * Math.sin(now / 90 + j * 1.7)) * zb;
            const bx = cx + Math.cos(a) * rx, by = cy + Math.sin(a) * ry;
            g.globalAlpha = 0.9 * fade; g.fillStyle = j % 2 ? '#ffb347' : css(WARD_FIRE);
            g.beginPath(); g.moveTo(bx - 4 * zb, by + 2 * zb); g.lineTo(bx + 4 * zb, by + 2 * zb); g.lineTo(bx + Math.cos(a) * 3 * zb, by - fl); g.closePath(); g.fill();
          }
          g.globalAlpha = 1;
        }
      }
      // Brittle: the 2D cracks, over the foe's drawn body (between its feet and the head the renderer reports).
      for (let i = 0; i < w.enemies.length; i++) {
        const e = w.enemies[i];
        if (!e.alive || (e.brittleUntil ?? 0) <= t) continue;
        const p = view.project(e.x, e.y);
        if (!p || !onScreen(p)) continue;
        const head = view.foeHead?.(i);
        const r = e.def.radius * zb;
        const cx = p.x, cy = head ? (p.y + head.y) / 2 : p.y - r;
        const line = () => {
          g.beginPath(); g.moveTo(cx - r * 0.5, cy - r * 0.55); g.lineTo(cx - r * 0.1, cy - r * 0.15); g.lineTo(cx - r * 0.25, cy + r * 0.2); g.lineTo(cx + r * 0.15, cy + r * 0.55); g.stroke();
          g.beginPath(); g.moveTo(cx - r * 0.1, cy - r * 0.15); g.lineTo(cx + r * 0.45, cy - r * 0.3); g.stroke();
        };
        g.lineJoin = 'round';
        g.globalAlpha = 0.7; g.strokeStyle = '#1a1412'; g.lineWidth = 3 * zb; line();
        g.globalAlpha = 0.95; g.strokeStyle = '#f0e8de'; g.lineWidth = 1.5 * zb; line();
        g.globalAlpha = 1; g.lineJoin = 'miter';
      }
    }
    // Boss and event marks 2D draws over the sprites (overFx, footGfx, images at depth 5.5), which the 3D view covers.
    // Drawn on this overlay, so no draw calls. Floor marks of the same casts are on the main graphics (the bridge).
    {
      const now = this.time.now;
      const css = (c: number) => '#' + c.toString(16).padStart(6, '0');
      const dot = (x: number, y: number, r: number, col: string, a: number) => { g.globalAlpha = a; g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
      // The Crucible, Grandmother Slag's Ladle Pour: the ladle over the target's head, tipping as the cast fills, and
      // pouring onto them at the end (2D's drawing, at the overlay's scale).
      const gs = w.enemies.find((e) => e.alive && e.kind === 'grandmotherSlag' && e.castId === 'ladlePour' && e.castDur > 0);
      const lq = gs ? w.heroData(w.ladlePourTarget).player : undefined;
      const lp = lq && lq.hp > 0 ? view.project(lq.x, lq.y) : null;
      if (gs && lp && onScreen(lp)) {
        const f = gs.castT / gs.castDur, pulse = 0.6 + 0.4 * Math.sin(now / 70);
        const hx = lp.x - 10 * zb, hy = lp.y - 92 * zb, tip = -0.15 - f * 1.0;
        const ux = Math.cos(tip), uy = Math.sin(tip);
        const bx = hx + ux * 22 * zb, by = hy + uy * 22 * zb;
        const line = (w0: number, col: string, a: number, x0: number, y0: number, x1: number, y1: number) => { g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = w0 * zb; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
        g.lineCap = 'round';
        dot(bx + 12 * zb, by + 6 * zb, 30 * zb, css(MOLTEN), 0.18 + 0.12 * pulse);
        line(9, '#140c08', 1, hx - ux * 34 * zb, hy - uy * 34 * zb, bx, by);
        line(5, '#9a8a80', 1, hx - ux * 34 * zb, hy - uy * 34 * zb, bx, by);
        dot(bx + 12 * zb, by + 6 * zb, 18 * zb, '#140c08', 1);
        dot(bx + 12 * zb, by + 6 * zb, 15 * zb, '#6a5a52', 1);
        dot(bx + 12 * zb, by + 2 * zb, 11 * zb, '#ffb347', 1);
        dot(bx + 10 * zb, by, 5 * zb, '#fff0b0', 0.9);
        if (f > 0.7) {
          const k = (f - 0.7) / 0.3, sx = bx + 26 * zb, sy = by + 4 * zb, ey = sy + (lp.y - 6 * zb - sy) * k;
          line(9, css(MOLTEN), 0.5, sx, sy, lp.x, ey);
          line(5, '#ffb347', 1, sx, sy, lp.x, ey);
          line(2, '#fff0b0', 1, sx, sy, lp.x, ey);
        }
        g.lineCap = 'butt';
      }
      // The Kiln Mother's Kiln Draw: her furnace mouth swelling with light (14 of her 112 px below the sprite's middle).
      // The streaming embers and chevrons are floor marks the bridge carries.
      for (let i = 0; i < w.enemies.length; i++) {
        const e = w.enemies[i];
        if (!e.alive || e.kind !== 'kilnMother' || e.castId !== 'kilnDraw') continue;
        const p = view.project(e.x, e.y);
        if (!p || !onScreen(p)) continue;
        const head = view.foeHead?.(i), h = head ? p.y - head.y : 112 * zb;
        const my = p.y - h / 2 + 14 * (h / 112), fill = Math.min(1, e.castT / Math.max(0.01, e.castDur));
        const pulse = 0.5 + 0.5 * Math.sin(now / 80);
        dot(p.x, my, (26 + 30 * fill) * zb, '#ff8a3a', 0.18 + 0.25 * fill);
        dot(p.x, my, (12 + 14 * fill) * zb, '#ffe6a0', 0.25 + 0.35 * fill * pulse);
      }
      // Coldmarrow: a Frost Warden inside a coal's light, ember cracks glowing through the ice, over its drawn body.
      if (w.dungeonId === 'coldmarrow') for (let i = 0; i < w.enemies.length; i++) {
        const e = w.enemies[i];
        if (!e.alive || e.kind !== 'frostWarden' || this.coalWarmth(e.x, e.y, e.def.radius) <= 0) continue;
        const p = view.project(e.x, e.y);
        if (!p || !onScreen(p)) continue;
        const head = view.foeHead?.(i), r = e.def.radius * zb;
        const cx = p.x, cy = head ? (p.y + head.y) / 2 : p.y - r;
        const pulse = 0.55 + 0.35 * Math.sin(now / 110 + i);
        g.globalAlpha = 0.25 + 0.2 * pulse; g.strokeStyle = css(COAL); g.lineWidth = 3 * zb;
        g.beginPath(); g.ellipse(cx, cy, r + 6 * zb, (head ? (p.y - head.y) / 2 : r) + 6 * zb, 0, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = pulse; g.strokeStyle = '#ffb347'; g.lineWidth = 2.5 * zb; g.lineJoin = 'round';
        for (let c = 0; c < 4; c++) {
          let a = (i * 2.399 + c * 1.571) % (Math.PI * 2), lx = cx, ly = cy;
          g.beginPath(); g.moveTo(lx, ly);
          for (let seg = 0; seg < 3; seg++) { a += seg % 2 ? 0.6 : -0.5; lx += Math.cos(a) * r * 0.32; ly += Math.sin(a) * r * 0.32; g.lineTo(lx, ly); }
          g.stroke();
        }
        g.lineJoin = 'miter';
      }
      // A Brood elite's egg sacs round its feet (2D's footGfx), swelling as it is hurt.
      for (const e of w.enemies) {
        if (!e.alive || e.named < 0 || AFFIXES[e.affix] !== 'Brood') continue;
        const r = e.def.radius, hpF = Math.max(0, e.hp) / e.maxHp;
        for (let k = 0; k < 3; k++) {
          const a = Math.PI * (0.27 + k * 0.23);
          const sw = (1 + 0.08 * Math.sin(now / (160 + 120 * hpF) + k * 2) + 0.15 * (1 - hpF)) * zb;
          const p = view.project(e.x + Math.cos(a) * (r - 2), e.y + r * 0.3 + Math.sin(a) * (r - 2));
          if (!p || !onScreen(p)) continue;
          const ex = p.x, ey = p.y - 6 * zb;
          g.globalAlpha = 0.95; g.fillStyle = '#d8c89a'; g.beginPath(); g.ellipse(ex, ey, 6.5 * sw, 8 * sw, 0, 0, Math.PI * 2); g.fill();
          g.globalAlpha = 0.9; g.strokeStyle = '#1a1010'; g.lineWidth = 2 * zb; g.stroke();
          g.globalAlpha = 0.7; g.fillStyle = '#8a9a3a'; g.beginPath(); g.ellipse(ex + zb, ey + 2 * zb, 3 * sw, 4 * sw, 0, 0, Math.PI * 2); g.fill();
          dot(ex - 2.5 * zb, ey - 4 * zb, 1.8 * zb, '#fff6d8', 0.8);
        }
      }
      // Arena events: a Cave-in's rock falling onto its shadow with dust trickling down ahead of it, and a Cold Snap's
      // snow (and the dungeon stirring's grit) falling through the view.
      const ev = w.arenaEvent, A = ARENA_EVENTS;
      if (ev === 'caveIn' && w.arenaEventStage === 1) {
        const k = Math.max(0, Math.min(1, 1 - w.arenaEventT / A.caveWarn));
        const img = this.textures.get(this.stoneKey()).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
        for (const [n, c] of w.caveInSpots().entries()) {
          const p = view.project(c.x, c.y);
          if (!p) continue;
          for (let m = 0; m < (this.lowFx ? 3 : 6); m++) {
            const u = ((now / 700) + m / 6 + n * 0.31) % 1;
            dot(p.x + Math.sin(m * 2.3 + n) * 18 * zb, p.y - (220 - 220 * u) * zb, (1.6 + m % 2) * zb, '#b8aca4', 0.6 * (1 - u));
          }
          if (k > 0.6) {
            const f = (k - 0.6) / 0.4, sc = (A.caveRadius / 68) * (1.3 - 0.3 * f) * zb;
            const iw = img.width * sc, ih = img.height * sc;
            g.save(); g.globalAlpha = 1; g.translate(p.x, p.y - 260 * (1 - f * f) * zb); g.rotate((1 - f) * (n % 2 ? 0.5 : -0.5));
            g.drawImage(img, -iw * 0.5, -ih * 0.64, iw, ih); g.restore();
          }
        }
      }
      const snow = ev === 'coldSnap' && w.arenaEventStage === 1 ? Math.max(0, Math.min(1, 1 - w.arenaEventT / A.snapWarn)) : 0;
      if (snow > 0) {
        const N = this.lowFx ? 10 : 24;
        for (let m = 0; m < N; m++) {
          const u = ((now / 2600) + m * 0.137) % 1;
          dot(((m + 0.5) / N) * W + Math.sin(now / 900 + m) * 12 * zb, top + u * (H - top), (1.6 + (m % 3) * 0.6) * zb, '#f2fbff', 0.7 * snow);
        }
      }
      if (this.stirAt >= 0 && now - this.stirAt < 1400 && !this.lowFx) {
        const k = (now - this.stirAt) / 1400;
        for (let j = 0; j < 26; j++) {
          const u = (k * 1.6 + j * 0.137) % 1;
          dot(((j * 97.31) % 1) * W + (j % 2 ? 6 : -6) * u * zb, top + u * (H - top), (1.4 + (j % 3) * 0.6) * zb, '#b8aca4', 0.55 * (1 - k));
        }
      }
      g.globalAlpha = 1;
    }
    // The Flue: a Decree holder's seal with its countdown ring (gold, then red and beating in the last 3 s), and a Spent
    // hero's cold seal with a grey arc for the time left. 2D draws these over the head on overFx and depth 9.4, which
    // the 3D view covers; the 3D view's crown has no timer. Beside the hero, as the Pressed and Sundered marks.
    if (w.dungeonId === 'flue') {
      const now = this.time.now;
      const seal = this.textures.get('decreeSeal').getSourceImage() as CanvasImageSource;
      const spent = this.textures.get('spentMark').getSourceImage() as CanvasImageSource;
      const mark = (k: number, img: CanvasImageSource, f: number, col: string, alpha: number, sz: number) => {
        const q = w.heroData(k).player;
        const p = view.project(q.x, q.y);
        if (!p || !onScreen(p)) return;
        const x = p.x + 26 * zb, y = p.y - 24 * zb, r = sz * zb;
        g.globalAlpha = 0.6; g.fillStyle = '#000000';
        g.beginPath(); g.arc(x, y, r * 1.25, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1; g.drawImage(img, x - r, y - r, r * 2, r * 2);
        g.globalAlpha = alpha; g.strokeStyle = col; g.lineWidth = 3 * zb;
        g.beginPath(); g.arc(x, y, r * 1.2, -Math.PI / 2, -Math.PI / 2 + Math.max(0, Math.min(1, f)) * Math.PI * 2); g.stroke();
        g.globalAlpha = 1;
      };
      for (const d of w.regentDecree) {
        const late = d.t < 3, pulse = 0.5 + 0.5 * Math.sin(now / (late ? 90 : 220));
        mark(d.hero, seal, d.t / REGENT.decreeTime, late ? '#ff3a2a' : '#ffc861', late ? 0.7 + 0.3 * pulse : 0.95, 12 * (late ? 1 + 0.08 * pulse : 1));
      }
      for (let k = 0; k < w.heroes.length; k++) {
        const st = w.heroData(k).player.spentT ?? 0;
        if (st <= 0 || w.regentDecree.some((d) => d.hero === k)) continue;
        mark(k, spent, st / REGENT.spentTime, '#c8c0b8', 0.8, 10);
      }
    }
    if (w.dungeonId === 'hammerdeep' || w.dungeonId === 'crucible') {
      const dg = '#' + DANGER.toString(16).padStart(6, '0');
      for (let k = 0; k < w.heroes.length; k++) {
        const q = w.heroData(k).player;
        if (q.hp <= 0 || (q.sunderT ?? 0) <= 0) continue;
        const p = view.project(q.x, q.y);
        if (!p || !onScreen(p)) continue;
        const x = p.x - 24 * zb, y = p.y - 22 * zb, r = 9 * zb;
        g.globalAlpha = 0.6; g.fillStyle = '#000000';
        g.beginPath(); g.arc(x, y, r * 1.35, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1; g.strokeStyle = dg; g.lineCap = 'round';
        g.lineWidth = 2.5 * zb;
        g.beginPath(); g.arc(x, y, r, -2.6, -0.9); g.stroke();
        g.beginPath(); g.arc(x, y, r, -0.5, 1.2); g.stroke();
        g.lineWidth = 2 * zb;
        g.beginPath(); g.moveTo(x - 2 * zb, y - 10 * zb); g.lineTo(x + 2 * zb, y - 3 * zb); g.lineTo(x - 1 * zb, y + 2 * zb); g.stroke();
        g.lineCap = 'butt';
      }
    }
    // The Pressworks: who is Pressed (took the last Downstroke, can't take the next), the warning ring on a Pressed
    // hero who steps onto the plate, and the plate's badge (tick, cross, "!"). 2D draws these on overFx, which the 3D
    // view covers, so on a phone nobody could tell who was Pressed (phone pass, Pressworks Halls, 25 Nov).
    if (w.dungeonId === 'pressworks') {
      const dg = '#' + DANGER.toString(16).padStart(6, '0');
      const now = this.time.now;
      const plate = w.telegraphs.find((t) => t.alive && t.kind === 'soak' && t.owner === -3);
      let ok = 0, crushed = false;
      for (let k = 0; k < w.heroes.length; k++) {
        const q = w.heroData(k).player;
        if (q.hp <= 0) continue;
        const onPlate = !!plate && (q.x - plate.x) ** 2 + (q.y - plate.y) ** 2 <= plate.r * plate.r;
        const left = q.pressedT ?? 0;
        if (onPlate) { if (left > 0) crushed = true; else ok++; }
        if (left <= 0) continue;
        const p = view.project(q.x, q.y);
        if (!p || !onScreen(p)) continue;
        if (onPlate) {
          g.globalAlpha = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(now / 70));
          g.strokeStyle = dg; g.lineWidth = 3 * zb;
          g.beginPath(); g.ellipse(p.x, p.y, 26 * zb, 11 * zb, 0, 0, Math.PI * 2); g.stroke();
          g.globalAlpha = 1;
        }
        // The 2D mark: a small red plate with a press-down glyph, ringed by the time left.
        const x = p.x + 24 * zb, y = p.y - 22 * zb, r = 10 * zb, kk = Math.max(0, Math.min(1, left / OSKEL.pressed));
        g.fillStyle = 'rgba(32,10,14,0.9)'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(90,32,40,0.9)'; g.lineWidth = 2 * zb; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = dg; g.lineWidth = 2.5 * zb; g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * kk); g.stroke();
        g.fillStyle = dg;
        g.fillRect(x - 5 * zb, y - 6 * zb, 10 * zb, 3 * zb); g.fillRect(x - 1.25 * zb, y - 3 * zb, 2.5 * zb, 5 * zb);
        g.beginPath(); g.moveTo(x - 4 * zb, y + 1 * zb); g.lineTo(x + 4 * zb, y + 1 * zb); g.lineTo(x, y + 5 * zb); g.closePath(); g.fill();
        g.fillRect(x - 5 * zb, y + 5 * zb, 10 * zb, 1.6 * zb);
      }
      const bp = plate ? view.project(plate.x, plate.y - plate.r) : null;
      if (plate && bp && onScreen(bp)) {
        const bx = bp.x, by = bp.y - 14 * zb, r = 11 * zb;
        const f = Math.min(1, Math.max(0, plate.t / Math.max(0.01, plate.dur)));
        const blink = 0.5 + 0.5 * Math.sin(now / (f > 0.6 ? 60 : 140));
        g.fillStyle = crushed || !ok ? 'rgba(32,10,14,0.85)' : 'rgba(16,32,15,0.85)';
        g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.fill();
        g.lineCap = 'round';
        if (crushed || !ok) {
          g.globalAlpha = 0.6 + 0.4 * blink; g.strokeStyle = dg; g.lineWidth = 2 * zb;
          g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
          if (crushed) {
            g.lineWidth = 3 * zb; g.beginPath();
            g.moveTo(bx - 5 * zb, by - 5 * zb); g.lineTo(bx + 5 * zb, by + 5 * zb); g.moveTo(bx - 5 * zb, by + 5 * zb); g.lineTo(bx + 5 * zb, by - 5 * zb); g.stroke();
          } else { g.fillStyle = dg; g.fillRect(bx - 1.5 * zb, by - 7 * zb, 3 * zb, 9 * zb); g.fillRect(bx - 1.5 * zb, by + 4 * zb, 3 * zb, 3 * zb); }
        } else {
          g.strokeStyle = '#9fe8a8'; g.lineWidth = 2 * zb; g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.stroke();
          g.lineWidth = 3 * zb; g.beginPath(); g.moveTo(bx - 5 * zb, by); g.lineTo(bx - 1 * zb, by + 4 * zb); g.lineTo(bx + 6 * zb, by - 4 * zb); g.stroke();
        }
        g.lineCap = 'butt';
      }
    }
    g.globalAlpha = 1;
  }

  /**
   * Phones (QA playtest, 23 Nov): the camera centres on your hero, so a boss far below you sat under the ability
   * buttons or the loot toasts (the Lensmother in phase 3, Nhevra). In a boss fight the camera slides along y, a
   * little at a time, until the boss is back between the top panels and the action bar, as long as your hero stays
   * in that band too. When the band is too short for both, it also slides sideways so the boss clears the action
   * bar (which covers only the right side). The 3D view follows the same offsets (Hd2dAdapter.focus).
   */
  /** Phase 18 Halls H1: the map layer's frame (client/hallsview.ts), with a screen projection for either look. */
  private hallsFrame(px: number, py: number, dt: number): void {
    const now = this.time.now;
    if (now - this.canvasBox.at > 500) this.canvasBox = { at: now, rect: this.game.canvas.getBoundingClientRect() };
    const rect = this.canvasBox.rect;
    const cam = this.cameras.main;
    const view = this.hd2d;
    const zc = cam.zoom * ((rect.width || 1) / this.game.canvas.width);
    this.halls!.frame({
      now, dt, threeD: !!this.bridge, px, py, compact: this.hud.compact, rect,
      view: this.viewUnits,
      project: view ? (x, y) => view.project(x, y) : (x, y) => ({ x: (x - cam.worldView.x) * zc, y: (y - cam.worldView.y) * zc }),
    });
    // The arena's edge props stand round the boss arena; on the map they would stand in the first rooms.
    const onMap = this.world.hallsOn;
    for (const p of this.edgeProps) { p.img.setVisible(!onMap); p.light?.setVisible(!onMap); }
  }

  private bossInView(dt: number, px: number, py: number): void {
    const w = this.world;
    const boss = this.hud.compact && w.phase === 'fight' ? w.enemies.find((e) => e.alive && e.def.rank === 'boss') : undefined;
    let wantY = 0, wantX = 0;
    if (boss) {
      this.clearView();
      const rect = this.game.canvas.getBoundingClientRect();
      const view = this.hd2d;
      const cam = this.cameras.main;
      const zc = cam.zoom * ((rect.width || 1) / this.game.canvas.width);
      // Screen point (CSS px from the canvas top left) of world point (x, y) with the camera offset by (ox, oy).
      const at = (x: number, y: number, ox: number, oy: number): { x: number; y: number } | null => {
        if (view) {
          const q = view.project(x, y);
          return q ? { x: q.x + (this.focusX - ox) * this.pxPerUnitX, y: q.y + (this.focusY - oy) * this.pxPerUnit } : null;
        }
        return { x: rect.width / 2 + (x - px - ox) * zc, y: rect.height / 2 + (y - py - oy) * zc };
      };
      if (view) {
        const a = view.project(px, py), b = view.project(px, py + 40), c = view.project(px + 40, py);
        if (a && b && b.y - a.y > 1) this.pxPerUnit = (b.y - a.y) / 40;
        if (a && c && c.x - a.x > 1) this.pxPerUnitX = (c.x - a.x) / 40;
      } else this.pxPerUnit = this.pxPerUnitX = zc;
      const k = this.pxPerUnit, kx = this.pxPerUnitX;
      const top = Math.max(this.hudCover.px, this.hudCover.row) - rect.top + 24;
      const bottom = (this.hudCover.bar || rect.bottom) - rect.top - 24;
      const barLeft = (this.hudCover.barL || rect.right) - rect.left - 24;
      const b = at(boss.x, boss.y, this.focusX, this.focusY);
      const h = at(px, py, 0, 0);
      if (b && h && bottom - top > 120) {
        wantY = this.focusY;
        if (b.y > bottom) wantY += (b.y - bottom) / k;
        else if (b.y < top) wantY -= (top - b.y) / k;
        else wantY -= Math.sign(wantY) * Math.min(Math.abs(wantY), Math.max(0, (wantY > 0 ? bottom - b.y : b.y - top) - 8) / k);
        // Never so far that your hero leaves the band (at least 40 px inside it).
        const lo = (h.y - (bottom - 40)) / k, hi = (h.y - (top + 40)) / k;
        wantY = lo > hi ? 0 : Math.max(lo, Math.min(hi, wantY));
        // Still under the bar's top edge once that offset is reached: slide sideways until the boss is left of it.
        wantX = this.focusX;
        const yThen = b.y + (this.focusY - wantY) * k;
        // (Its right edge, not its feet: a boss sprite is wide.)
        const edge = barLeft - (boss.def.radius ?? 30) * 1.2 * kx;
        if (yThen > bottom && b.x > edge) wantX += (b.x - edge) / kx;
        else if (wantX > 0) wantX -= Math.min(wantX, Math.max(0, edge - b.x - 8) / kx);
        // Your hero stays at least 40 px from either side.
        wantX = Math.max(0, Math.min((h.x - 40) / kx, wantX));
      }
    }
    const f = Math.min(1, dt * 4);
    this.focusY += (wantY - this.focusY) * f;
    this.focusX += (wantX - this.focusX) * f;
    if (!boss && Math.abs(this.focusY) < 0.05) this.focusY = 0;
    if (!boss && Math.abs(this.focusX) < 0.05) this.focusX = 0;
  }
  private pxPerUnit = 1;
  private pxPerUnitX = 1;

  private clearView(): { x: number; y: number; right: number; bottom: number; width: number; height: number; centerX: number; centerY: number } {
    const v = this.cameras.main.worldView;
    const now = this.time.now;
    if (now - this.hudCover.at > 500 || this.hudCover.at < 0) {
      this.hudCover.at = now;
      let px = 0;
      for (const id of ['target', 'quests']) {
        const el = document.getElementById(id);
        // (The panels are position: fixed, so offsetParent is always null: a zero rect is what says hidden.)
        if (!el || el.hidden) continue;
        const r = el.getBoundingClientRect();
        // Only a panel spanning most of the width counts: a narrow one leaves the view beside it clear.
        if (r.height > 0 && r.width > window.innerWidth * 0.5) px = Math.max(px, r.bottom);
      }
      this.hudCover.px = px;
      // The top row (level, health, clock): the 3D overlay keeps names and bars out of it (see drawLabels3d).
      const row = document.querySelector('#hud > .row');
      this.hudCover.row = row ? row.getBoundingClientRect().bottom : 0;
      const bar = document.getElementById('actionbar');
      const brr = bar && !bar.hidden ? bar.getBoundingClientRect() : undefined;
      this.hudCover.bar = brr ? brr.top : 0;
      this.hudCover.barL = brr ? brr.left : 0;
      const banner = document.getElementById('banner');
      const br = banner?.classList.contains('show') ? banner.getBoundingClientRect() : undefined;
      this.hudCover.banner = br && br.width > 0 && br.height > 0 ? br : undefined;
      const pe = document.getElementById('party');
      const pr = pe && !pe.hidden ? pe.getBoundingClientRect() : undefined;
      this.hudCover.party = pr && pr.width > 0 && pr.height > 0 ? pr : undefined;
    }
    const ch = this.game.canvas.getBoundingClientRect().height || 1;
    // Never take more than 40% of the view, so a tall panel can't push arrows down into the fight.
    const top = v.y + Math.min(0.4, this.hudCover.px / ch) * v.height;
    const height = v.bottom - top;
    return { x: v.x, y: top, right: v.right, bottom: v.bottom, width: v.width, height, centerX: v.centerX, centerY: top + height / 2 };
  }

  /** Stage 3 trail: a dash or blink leaves a line of motes along its path, then a puff where it lands. */
  private trailDash(x1: number, y1: number, x2: number, y2: number): void {
    // Dash and blink events carry no hero, so the trail is the one whose hero the dash ends on.
    const tr = this.trails.find((t) => { const q = this.world.heroData(t.hero).player; return Math.hypot(x2 - q.x, y2 - q.y) <= 4; });
    if (!tr || tr.stage < 3) return;
    const n = this.lowFx ? 4 : 10;
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1);
      const a = Math.random() * Math.PI * 2;
      const sp = k >= n - 3 ? 40 + Math.random() * 40 : 8;
      if (tr.style === 'oil') {
        // Oil: the landing drops splash out and spread flat.
        this.emit(tr.fx, 'oilDrop', undefined, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + 12, 0.6 + t * 0.4,
          { tint: 0xffffff, tint1: tr.color, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.35, drag: 0.9, sx0: 0.8, sx1: 1.5, sy1: 0.65 });
        continue;
      }
      if (tr.style === 'chips') {
        // Splinters: the landing ones burst out spinning, like a plank giving way.
        this.emit(tr.fx, 'woodChip', undefined, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + 12, 0.5 + t * 0.35,
          { tint: tr.color, tint1: WET_WOOD, rot: Math.random() * Math.PI, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, drag: 0.92, spin: (Math.random() - 0.5) * 16, sx0: 1, sx1: 0.85 });
        continue;
      }
      if (tr.style === 'crumbs') {
        // Crumbs: the landing ones scatter out low like a spilled handful, then cool.
        this.emit(tr.fx, 'coalCrumb', undefined, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + 12, 0.55 + t * 0.4,
          { tint: CRUMB_HOT, tint1: tr.color, rot: Math.random() * Math.PI, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp * 0.3 + 18, drag: 0.9, sx0: 0.95, sx1: 0.7 });
        continue;
      }
      if (tr.style === 'shards') {
        // Shards: the landing ones burst out like a plate cracking apart, then fall and settle.
        this.emit(tr.fx, 'plateShard', undefined, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + 12, 0.6 + t * 0.4,
          { tint: SHARD_FLASH, tint1: tr.color, rot: Math.random() * Math.PI * 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.4 + 24, drag: 0.92, spin: (Math.random() - 0.5) * 10, sx0: 1.1, sx1: 0.9 });
        continue;
      }
      if (tr.style === 'sparks') {
        // Embers: the landing ones fly up and out like a struck forge, then cool.
        this.emit(tr.fx, 'trailMote', undefined, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + 14, 0.5 + t * 0.35,
          { tint: tr.color, tint1: EMBER_COOL, vx: Math.cos(a) * sp, vy: -Math.abs(Math.sin(a)) * sp - 30, drag: 0.95, sx0: 1.3, sy0: 1.9, sx1: 0.45, sy1: 0.65 });
        continue;
      }
      if (tr.style === 'drip') {
        // Slag: the landing drops splash out low and flat, then cool where they land.
        this.emit(tr.fx, 'trailMote', undefined, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + 12, 0.55 + t * 0.4,
          { tint: tr.color, tint1: SLAG_CRUST, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp * 0.25 + 20, drag: 0.9, sx0: 1, sy0: 1.6, sx1: 1.6, sy1: 0.6 });
        continue;
      }
      if (tr.style === 'frost') {
        // Frost: the landing crystals scatter outward, then fall and settle like shaken rime.
        this.emit(tr.fx, 'frostFlake', undefined, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + 8, 0.6 + t * 0.4,
          { tint: tr.color, tint1: FROST_SETTLE, rot: Math.random() * Math.PI, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.4 + 30, drag: 0.93, spin: (Math.random() - 0.5) * 5, sx0: 0.8, sx1: 0.55 });
        continue;
      }
      this.emit(tr.fx, 'trailMote', undefined, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + 14, 0.5 + t * 0.3,
        { tint: tr.color, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5 - 8, drag: 0.93, sx0: 1.8, sx1: 0.6 });
    }
  }

  private spark(x: number, y: number, vx: number, vy: number, life: number, size = 1.5): void {
    this.emit(this.fx, 'spark', undefined, x, y, life, { vx, vy, drag: 0.93, sx0: size, sx1: size * 0.4 });
  }

  private burst(x: number, y: number, n: number): void {
    // Trimmed effects keep a third of the sparks: kills and pick-ups fire this dozens of times a second.
    if (this.lowFx) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      const sz = 1 + Math.random() * 1.2;
      this.emit(this.fx, 'spark', undefined, x, y, 0.4 + Math.random() * 0.35, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.94, sx0: sz, sx1: sz * 0.3 });
    }
  }

  private blast(x: number, y: number, r: number, tint?: number): void {
    const g = (r * 2.2) / 64;
    this.emit(this.fx, 'blast', undefined, x, y, 0.3, { tint, sx0: g * 0.65, sx1: g * 1.15 });
  }

  /** An expanding shockwave ring that reaches radius r. */
  private ring(x: number, y: number, r: number, tint: number, life: number): void {
    const g = (r * 2) / 128;
    this.emit(this.fx, 'ring', undefined, x, y, life, { tint, sx0: g * 0.25, sx1: g });
  }

  /** A rising, spreading steam puff. */
  private steam(x: number, y: number, size: number): void {
    this.emit(this.smoke, 'steam', undefined, x, y, 0.9 + Math.random() * 0.5, {
      tint: 0xe6f4ff, vy: -40 - Math.random() * 30, vx: (Math.random() - 0.5) * 16, drag: 0.98, spin: (Math.random() - 0.5) * 1.5, rot: Math.random() * 6, sx0: size * 0.5, sx1: size * 1.5,
    });
  }

  /** A quick white impact star where a hit landed. */
  private impact(x: number, y: number, size: number): void {
    this.emit(this.fx, 'hitstar', undefined, x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, 0.14, { rot: Math.random() * Math.PI, sx0: size * 0.6, sx1: size * 1.1 });
  }

  /**
   * Death: the body flashes, is knocked back away from your hero, flattens and fades into a puff of ash, and a few
   * embers spray out the far side, so a kill lands with some weight instead of just vanishing.
   */
  private death(kind: string, x: number, y: number): void {
    const big = kind === 'kilnMother' || kind === 'cinderBrute' || kind === 'ashmaw' || kind === 'husk';
    const p = this.world.player;
    const d = Math.hypot(x - p.x, y - p.y) || 1;
    const ux = (x - p.x) / d, uy = (y - p.y) / d;
    const kick = big ? 40 : 110;
    if (this.textures.exists(kind)) {
      const f = this.emit(this.smoke, kind, '0', x, y, big ? 0.45 : 0.3, {
        flip: x > p.x, vx: ux * kick, vy: uy * kick - 30, drag: 0.88, spin: (x > p.x ? 1 : -1) * (big ? 0.4 : 2.2),
        sx0: BASE * 1.1, sy0: BASE * 0.95, sx1: BASE * 1.35, sy1: BASE * 0.15,
      });
      f?.img.setTint(0xffd7a0).setTintMode(Phaser.TintModes.FILL);
    }
    // Embers out the far side, in a cone away from the hero (none on trimmed effects: kills come dozens a second).
    if (!this.lowFx) {
      const base = Math.atan2(uy, ux);
      for (let k = 0; k < (big ? 8 : 4); k++) {
        const a = base + (Math.random() - 0.5) * 1.3;
        const sp = 120 + Math.random() * 110;
        this.emit(this.fx, 'spark', undefined, x, y - 6, 0.35 + Math.random() * 0.2, { tint: k % 2 ? 0xffb060 : 0xffe2a0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, drag: 0.9, sx0: 1.4, sx1: 0.3 });
      }
    }
    // Trimmed effects: a small foe leaves only its fading silhouette, a big one two puffs.
    const n = this.lowFx ? (big ? 2 : 0) : big ? 5 : 1;
    for (let k = 0; k < n; k++) {
      const s = (big ? 1.4 : 0.6) + Math.random() * 0.4;
      this.emit(this.smoke, 'puff', undefined, x + (Math.random() - 0.5) * (big ? 40 : 6), y + (Math.random() - 0.5) * (big ? 30 : 6), 0.5 + Math.random() * 0.3, {
        tint: 0x9a8a84, vy: -18, vx: (Math.random() - 0.5) * 20, spin: (Math.random() - 0.5) * 2, rot: Math.random() * 6, sx0: s * 0.6, sx1: s * 1.3,
      });
    }
  }

  /**
   * ONDRELV2, the 2D look's burning slag (the 3D look draws its own, client/hd2d/ondrelslag3d.ts, so this is skipped
   * under the floor bridge): a dark cooled crust cracked by glowing molten seams, with a red rim that breathes slowly,
   * so it reads as burning floor you can walk over but shouldn't stand in (red = bad). In the last heat each patch
   * glows, its seams widening and running white-hot while the rim beats faster, until it bursts (the 'slam' event).
   */
  private ondrelSlagDraw(g: Phaser.GameObjects.Graphics, now: number): void {
    if (this.bridge) return;
    const R = ONDRELV2.r;
    for (const a of this.world.slagPatches) {
      if (a.glow < 0) continue;
      const hot = a.glow > 0 ? 1 - a.glow / ONDRELV2.glow : 0;
      const seams = this.slagSeams(a.x, a.y);
      const breathe = 0.5 + 0.5 * Math.sin(now / (hot ? 70 - 40 * hot : 420) + a.x);
      g.fillStyle(0x2a120c, 0.82).fillCircle(a.x, a.y, R);
      g.fillStyle(0xff5a1a, 0.1 + 0.25 * hot).fillCircle(a.x, a.y, R * 0.6);
      const seam = hot > 0.6 ? 0xfff0c8 : 0xffa040;
      for (const [w, col, al] of [[6 + 8 * hot, 0xff4a10, 0.3 + 0.3 * hot], [2 + 2 * hot, seam, 0.85 + 0.15 * breathe]] as [number, number, number][]) {
        g.lineStyle(w, col, al);
        for (const line of seams) { g.beginPath(); line.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.strokePath(); }
      }
      g.lineStyle(8, 0x000000, 0.35).strokeCircle(a.x, a.y, R);
      g.lineStyle(4, DANGER, 0.7 + 0.3 * breathe).strokeCircle(a.x, a.y, R - 1);
    }
  }

  /** A slag patch's seams in the 2D look: a jagged ring and six jagged spokes, fixed per patch (seeded by where it lies). */
  private slagSeams(x: number, y: number): [number, number][][] {
    const key = `${Math.round(x)},${Math.round(y)}`;
    let s = this.slagSeamCache.get(key);
    if (s) return s;
    let h = (Math.round(x) * 73856093) ^ (Math.round(y) * 19349663);
    const rnd = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
    const R = ONDRELV2.r;
    s = [];
    const ring: [number, number][] = [];
    for (let k = 0; k <= 14; k++) { const a = (k / 14) * Math.PI * 2, r = R * (0.48 + 0.1 * (k % 14 ? rnd() - 0.5 : 0)); ring.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); }
    s.push(ring);
    const a0 = rnd() * Math.PI * 2;
    for (let k = 0; k < 6; k++) {
      const a = a0 + (k / 6) * Math.PI * 2 + (rnd() - 0.5) * 0.5, line: [number, number][] = [];
      for (let j = 0; j <= 4; j++) { const r = R * (0.12 + 0.7 * (j / 4)), o = j ? (rnd() - 0.5) * 0.28 : 0; line.push([x + Math.cos(a + o) * r, y + Math.sin(a + o) * r]); }
      s.push(line);
    }
    if (this.slagSeamCache.size > 32) this.slagSeamCache.clear();
    this.slagSeamCache.set(key, s);
    return s;
  }
  private slagSeamCache = new Map<string, [number, number][][]>();

  /**
   * Ondrel's wind-ups, drawn over the generic telegraphs:
   * Anvilfall drops an anvil onto its target, Hammer Sweep swings a hammer head
   * across its cone, and Choir of Iron sends bell rings out to every hero.
   */
  private ondrelCast(g: Phaser.GameObjects.Graphics, e: World['enemies'][number], i: number, now: number): void {
    const w = this.world;
    const f = Math.min(1, e.castT / e.castDur);
    if (e.castId === 'anvilfall') {
      const t = w.heroData(w.anvilfallTarget).player;
      const close = 0.6 + 0.4 * Math.sin(now / (f > 0.75 ? 40 : 90));
      const o = this.overFx;
      // A shadow that grows and darkens as the anvil comes down.
      g.fillStyle(0x000000, 0.25 + 0.35 * f).fillEllipse(t.x, t.y + 18, 40 + 50 * f, 14 + 18 * f);
      // A closing reticle in the boss's red: a floor mark (main graphics), so the bridge shows it in 3D too.
      const r = 110 - 60 * f;
      g.lineStyle(3, DANGER, 0.85 * close).strokeCircle(t.x, t.y, r);
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + now / 900;
        g.lineBetween(t.x + Math.cos(a) * (r + 6), t.y + Math.sin(a) * (r + 6), t.x + Math.cos(a) * (r + 20), t.y + Math.sin(a) * (r + 20));
      }
      // The anvil itself, falling from above the target (3D: anvil3d.ts).
      const ay = t.y - 46 - (1 - f) * (1 - f) * 150;
      const ax = t.x;
      const pts = [
        [-26, -10], [22, -10], [34, -6], [22, -2], [14, -2], [10, 6], [16, 12], [-16, 12], [-10, 6], [-14, -2], [-26, -2],
      ].map(([x, y]) => new Phaser.Math.Vector2(ax + x * 1.2, ay + y * 1.2));
      o.fillStyle(0x3a3642, 0.95).fillPoints(pts, true);
      o.lineStyle(2, 0x0c0506, 1).strokePoints(pts, true);
      o.lineStyle(2, 0xc8d0e0, 0.9).lineBetween(ax - 29, ay - 11, ax + 25, ay - 11);
    } else if (e.castId === 'hammerSweep') {
      const tg = w.telegraphs.find((t) => t.alive && t.owner === i && t.shape === 'cone');
      if (!tg) return;
      // A hammer head travels along the cone's rim from one edge to the other.
      const a = tg.angle - tg.arc / 2 + tg.arc * f;
      const hx = tg.x + Math.cos(a) * tg.r * 0.85;
      const hy = tg.y + Math.sin(a) * tg.r * 0.85;
      g.lineStyle(5, 0x5b3a24, 0.9).lineBetween(tg.x + Math.cos(a) * 50, tg.y + Math.sin(a) * 50, hx, hy);
      g.fillStyle(0x9aa3b8, 0.95).fillCircle(hx, hy, 14);
      g.lineStyle(2, 0x0c0506, 1).strokeCircle(hx, hy, 14);
      g.lineStyle(3, 0xc8d0e0, 0.5).beginPath().arc(tg.x, tg.y, tg.r * 0.85, tg.angle - tg.arc / 2, a, false).strokePath();
    } else if (e.castId === 'choir') {
      // Bell rings roll out from Ondrel and each hero's ring tightens as the toll comes.
      for (let k = 0; k < 3; k++) {
        const p = (now / 900 + k / 3) % 1;
        g.lineStyle(3, 0xffd27a, 0.5 * (1 - p)).strokeCircle(e.x, e.y, e.def.radius + p * 520);
      }
      for (let k = 0; k < w.heroes.length; k++) {
        const q = w.heroData(k).player;
        if (q.hp <= 0) continue;
        g.lineStyle(2.5, 0xffd27a, 0.4 + 0.5 * f).strokeCircle(q.x, q.y, 60 - 30 * f);
      }
    }
  }

  /**
   * The Ashvents' Twin Vents: a grate in each gold circle with flame licking up through it.
   * A vent with a hero in it shows a check and a steady ring; an empty one flashes "!",
   * so the party can see at a glance which vent still needs someone.
   */
  /**
   * The Pour: molten slag runs out along each lane while it winds up, bright blobs flowing
   * from her feet to the lane's tip, so the lanes read as molten and not just red.
   */
  private pourLane(g: Phaser.GameObjects.Graphics, t: World['telegraphs'][number], f: number, now: number): void {
    const c = Math.cos(t.angle), sn = Math.sin(t.angle);
    const reach = t.r * Math.min(1, 0.25 + f);
    g.lineStyle(6, MOLTEN, 0.35 + 0.3 * f).lineBetween(t.x, t.y, t.x + c * reach, t.y + sn * reach);
    g.lineStyle(2, 0xffe08a, 0.5 + 0.4 * f).lineBetween(t.x, t.y, t.x + c * reach, t.y + sn * reach);
    for (let j = 0; j < 7; j++) {
      const d = ((now / 500 + j / 7) % 1) * reach;
      const wob = Math.sin(now / 90 + j * 2) * 4;
      g.fillStyle(j % 2 ? 0xffb347 : 0xffe08a, 0.8).fillCircle(t.x + c * d - sn * wob, t.y + sn * d + c * wob, 4 + 2 * f);
    }
  }

  /**
   * Grandmother Slag's wind-ups. Ladle Pour: a ladle tips over the tank, a target ring tightens
   * at their feet (thicker for each Ladle Burn stack, since each one makes it hit harder), and
   * the slag starts to run as it lands. Last Ember: a molten ring swells out from her.
   */
  private slagCast(g: Phaser.GameObjects.Graphics, e: World['enemies'][number], now: number): void {
    const w = this.world;
    const f = e.castT / e.castDur;
    if (e.castId === 'ladlePour') {
      const q = w.heroData(w.ladlePourTarget).player;
      if (q.hp <= 0) return;
      const al = w.ladlePourTarget === w.acting ? undefined : this.allies.find((a) => a.hero === w.ladlePourTarget);
      const x = al ? al.img.x : w.ladlePourTarget === w.acting ? this.player.x : q.x;
      const y = al ? al.img.y : w.ladlePourTarget === w.acting ? this.player.y : q.y;
      const stacks = q.slag ?? 0;
      const pulse = 0.6 + 0.4 * Math.sin(now / 70);
      // The target ring at their feet, closing in.
      const rr = 30 + (1 - f) * 50;
      g.fillStyle(MOLTEN, 0.12 + 0.12 * f).fillCircle(x, y + 10, rr);
      g.lineStyle(3 + stacks, MOLTEN, 0.6 + 0.35 * pulse).strokeCircle(x, y + 10, rr);
      // A dotted line back to her.
      const dx = x - e.x, dy = y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      g.lineStyle(2, MOLTEN, 0.4);
      for (let s = 0; s < d; s += 22) {
        const u0 = s / d, u1 = Math.min(1, (s + 10) / d);
        g.lineBetween(e.x + dx * u0, e.y + dy * u0, e.x + dx * u1, e.y + dy * u1);
      }
      // The ladle over their head, tipping as the cast fills.
      const hx = x - 10, hy = y - 92;
      const tip = -0.15 - f * 1.0;
      const o = this.overFx;
      const ux = Math.cos(tip), uy = Math.sin(tip);
      const bx = hx + ux * 22, by = hy + uy * 22;
      o.fillStyle(MOLTEN, 0.18 + 0.12 * pulse).fillCircle(bx + 12, by + 6, 30);
      o.lineStyle(9, 0x140c08, 1).lineBetween(hx - ux * 34, hy - uy * 34, bx, by);
      o.lineStyle(5, 0x9a8a80, 1).lineBetween(hx - ux * 34, hy - uy * 34, bx, by);
      o.fillStyle(0x140c08, 1).fillCircle(bx + 12, by + 6, 18);
      o.fillStyle(0x6a5a52, 1).fillCircle(bx + 12, by + 6, 15);
      o.fillStyle(0xffb347, 1).fillCircle(bx + 12, by + 2, 11);
      o.fillStyle(0xfff0b0, 0.9).fillCircle(bx + 10, by, 5);
      if (f > 0.7) {
        // It starts to pour onto them.
        const k = (f - 0.7) / 0.3;
        const sx = bx + 26, sy = by + 4;
        const ey = sy + (y - 6 - sy) * k;
        o.lineStyle(9, MOLTEN, 0.5).lineBetween(sx, sy, x, ey);
        o.lineStyle(5, 0xffb347, 1).lineBetween(sx, sy, x, ey);
        o.lineStyle(2, 0xfff0b0, 1).lineBetween(sx, sy, x, ey);
      }
    } else if (e.castId === 'lastEmber') {
      const pulse = 0.5 + 0.5 * Math.sin(now / 60);
      const rr = e.def.radius + 20 + f * 560;
      g.fillStyle(MOLTEN, 0.06 + 0.1 * f).fillCircle(e.x, e.y, rr);
      g.lineStyle(6, 0xffd27a, 0.5 + 0.4 * pulse).strokeCircle(e.x, e.y, rr);
      g.lineStyle(18, MOLTEN, 0.15).strokeCircle(e.x, e.y, rr + 8);
    }
  }

  /**
   * C2 named elite: a turning blue rune ring under it, a small crown over its name, and its
   * affix shown on the body. Swift trails speed streaks, Vengeful smoulders red faster as it
   * nears death (it bursts where it falls), and Warded already wears the ward bubble.
   */
  /** Trash (design, 25 Nov, Kiln retune): an unnamed foe of a Halls opener pack (map roles A and B). */
  private trashFoe(e: World['enemies'][number]): boolean {
    const m = this.world.halls;
    if (!m || e.pack === undefined || e.named >= 0) return false;
    const role = m.packs[e.pack]?.role;
    return role === 'A' || role === 'B';
  }

  private namedMark(g: Phaser.GameObjects.Graphics, b: Phaser.GameObjects.Graphics, e: World['enemies'][number], top: number, now: number): void {
    const r = e.def.radius;
    const rr = r + 14;
    const rot = now / 1400;
    g.fillStyle(NAMED, 0.08).fillCircle(e.x, e.y + r * 0.3, rr);
    g.lineStyle(2.5, NAMED, 0.8);
    for (let k = 0; k < 3; k++) {
      const a0 = rot + (k / 3) * Math.PI * 2;
      g.beginPath().arc(e.x, e.y + r * 0.3, rr, a0 + 0.25, a0 + (Math.PI * 2) / 3 - 0.25, false).strokePath();
      const dx = e.x + Math.cos(a0) * rr, dy = e.y + r * 0.3 + Math.sin(a0) * rr;
      g.fillStyle(0xe8f4ff, 0.95).fillTriangle(dx, dy - 5, dx + 4, dy, dx - 4, dy).fillTriangle(dx, dy + 5, dx + 4, dy, dx - 4, dy);
    }
    // The crown: three points and a band, floating over the name plate.
    const cx = e.x, cy = top - 26 + Math.sin(now / 300) * 1.5;
    b.fillStyle(0x000000, 0.7).fillRect(cx - 10, cy - 1, 20, 7);
    b.fillTriangle(cx - 10, cy, cx - 6, cy - 10, cx - 2, cy).fillTriangle(cx - 4, cy, cx, cy - 13, cx + 4, cy).fillTriangle(cx + 2, cy, cx + 6, cy - 10, cx + 10, cy);
    b.fillStyle(0x9fd0ff, 1).fillRect(cx - 8, cy, 16, 4);
    b.fillTriangle(cx - 8, cy, cx - 6, cy - 7, cx - 3, cy).fillTriangle(cx - 3, cy, cx, cy - 10, cx + 3, cy).fillTriangle(cx + 3, cy, cx + 6, cy - 7, cx + 8, cy);
    b.fillStyle(0xffd27a, 1).fillCircle(cx, cy + 2, 1.6);
    const affix = AFFIXES[e.affix];
    if (affix === 'Swift') {
      const vx = e.x - e.px, vy = e.y - e.py;
      const v = Math.hypot(vx, vy);
      if (v > 0.1) {
        const ux = vx / v, uy = vy / v;
        g.lineStyle(2, 0xe8f4ff, 0.55);
        for (let k = -1; k <= 1; k++) {
          const ox = e.x - ux * r * 0.8 - uy * k * r * 0.45, oy = e.y - uy * r * 0.8 + ux * k * r * 0.45;
          const len = r * (0.9 + 0.4 * ((Math.sin(now / 60 + k * 2) + 1) / 2));
          g.lineBetween(ox, oy, ox - ux * len, oy - uy * len);
        }
      }
    } else if (affix === 'Vengeful') {
      const hpF = Math.max(0, e.hp) / e.maxHp;
      const pulse = 0.5 + 0.5 * Math.sin(now / (70 + 260 * hpF));
      g.lineStyle(3, DANGER, 0.3 + 0.5 * pulse * (1.2 - hpF)).strokeCircle(e.x, e.y, r + 5);
      if (!this.lowFx && Math.random() < 0.08 + 0.2 * (1 - hpF)) this.spark(e.x + (Math.random() - 0.5) * r, e.y - r * 0.3, (Math.random() - 0.5) * 30, -60, 0.5, 1.2);
    } else if (affix === 'Brood') {
      // Phase 14 X6: egg sacs clinging round its feet, swelling and twitching; its pack comes out of them when it dies.
      const hpF = Math.max(0, e.hp) / e.maxHp;
      if (!this.footGfx) this.footGfx = this.add.graphics().setDepth(4.5);
      const fg = this.footGfx;
      for (let k = 0; k < 3; k++) {
        const a = Math.PI * (0.27 + k * 0.23);
        const sw = 1 + 0.08 * Math.sin(now / (160 + 120 * hpF) + k * 2) + 0.15 * (1 - hpF);
        const ex = e.x + Math.cos(a) * (r - 2), ey = e.y + r * 0.3 + Math.sin(a) * (r - 2); // round its feet, over the body sprite (footGfx) and under any hero
        fg.fillStyle(0xd8c89a, 0.95).fillEllipse(ex, ey, 13 * sw, 16 * sw);
        fg.lineStyle(2, 0x1a1010, 0.9).strokeEllipse(ex, ey, 13 * sw, 16 * sw);
        fg.fillStyle(0x8a9a3a, 0.7).fillEllipse(ex + 1, ey + 2, 6 * sw, 8 * sw);
        fg.fillStyle(0xfff6d8, 0.8).fillCircle(ex - 2.5, ey - 4, 1.8);
      }
    } else if (affix === 'Smoldering') {
      // Phase 14 X6: a ring of embers under it fills toward its next fire circle (every NAMED.smolderEvery s from its
      // spawn), and smoke curls off it.
      const age = this.world.time - e.spawnedAt;
      const f = (age % NAMED_TUNE.smolderEvery) / NAMED_TUNE.smolderEvery;
      g.lineStyle(4, 0x1a0804, 0.55).strokeCircle(e.x, e.y + r * 0.3, r + 8);
      g.lineStyle(3, MOLTEN, 0.45 + 0.5 * f).beginPath().arc(e.x, e.y + r * 0.3, r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f, false).strokePath();
      if (!this.lowFx && Math.random() < 0.12) this.emit(this.smoke, 'puff', undefined, e.x + (Math.random() - 0.5) * r, e.y - r * 0.5, 0.9, { tint: 0x5a4a44, vy: -36, vx: (Math.random() - 0.5) * 10, spin: 1, rot: Math.random() * 6, sx0: 0.4, sx1: 1.1 });
      if (!this.lowFx && Math.random() < 0.15) this.spark(e.x + (Math.random() - 0.5) * r, e.y, (Math.random() - 0.5) * 20, -50, 0.6, 1.3);
    }
    this.affixBadge(b, affix, cx + 19, cy + 1, now);
  }

  /**
   * Phase 14 X6: the named foe's trait as a small round badge right of its crown, so the plate says which one it is
   * at a glance on a phone (the banner names it once when it steps out). Swift: chevrons; Warded: a shield; Vengeful:
   * a red burst; Brood: three eggs; Smoldering: a flame.
   */
  private affixBadge(b: Phaser.GameObjects.Graphics, affix: string, x: number, y: number, now: number): void {
    const AFFIX_COL: Record<string, number> = { Swift: 0xe8f4ff, Warded: 0xcfe6ff, Vengeful: DANGER, Brood: 0xd8c89a, Smoldering: MOLTEN };
    const col = AFFIX_COL[affix] ?? 0xffffff;
    b.fillStyle(0x000000, 0.75).fillCircle(x, y, 8.5);
    b.lineStyle(1.5, col, 0.9).strokeCircle(x, y, 8.5);
    b.fillStyle(col, 1);
    if (affix === 'Swift') {
      b.lineStyle(2, col, 1);
      for (const dx of [-3, 2]) b.beginPath().moveTo(x + dx - 2, y - 4).lineTo(x + dx + 2, y).lineTo(x + dx - 2, y + 4).strokePath();
    } else if (affix === 'Warded') {
      b.fillTriangle(x - 5, y - 4, x + 5, y - 4, x, y + 6).fillRect(x - 5, y - 5, 10, 3);
    } else if (affix === 'Vengeful') {
      for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI + now / 900; b.fillTriangle(x + Math.cos(a) * 6, y + Math.sin(a) * 6, x + Math.cos(a + 1.9) * 2, y + Math.sin(a + 1.9) * 2, x - Math.cos(a) * 6, y - Math.sin(a) * 6); }
    } else if (affix === 'Brood') {
      for (const [dx, dy] of [[-3, 2], [3, 2], [0, -3]]) b.fillEllipse(x + dx, y + dy, 4.5, 5.5);
    } else if (affix === 'Smoldering') {
      b.fillTriangle(x - 4, y + 4, x + 4, y + 4, x, y - 6);
      b.fillStyle(0xffe2a0, 1).fillTriangle(x - 2, y + 4, x + 2, y + 4, x, y - 1);
    }
  }

  /** The warmest living Hearthcoal whose light reaches this spot (World.warmthAt, read on the client). */
  private coalWarmth(x: number, y: number, r0 = 0): number {
    const w = this.world;
    let best = 0;
    for (let k = 0; k < w.heroes.length; k++) {
      const q = w.heroData(k).player;
      if (q.hp <= 0 || !q.coal) continue;
      const r = (q.coalR ?? w.coalMaxR) + r0;
      if ((q.x - x) ** 2 + (q.y - y) ** 2 <= r * r) best = Math.max(best, q.coal);
    }
    return best;
  }

  /**
   * The Coldmarrow, drawn each frame: every hero's Hearthcoal pools warm light on the frozen
   * floor out to its radius (the edge is dashed, so you can tell exactly what's inside), your
   * own coal shows as a gauge at your feet with Chill pips under it, Frost Wardens in any light
   * glow with ember cracks, and Chill frosts the screen edge. The Long Night darkens the floor,
   * so only the lights are left.
   */
  /** Slag Lob: a glob on a high arc (a trail of embers), and a splash where it lands. */
  private slagLob(x1: number, y1: number, x2: number, y2: number): void {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const h = Math.min(90, d * 0.3);
    for (let k = 1; k <= 7; k++) {
      const t = k / 8;
      this.emit(this.fx, 'spark', undefined, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t - Math.sin(Math.PI * t) * h, 0.12 + t * 0.12, { tint: k === 7 ? 0xffd08a : SLAG, sx0: 0.35 + t * 0.35, sx1: 0.1 });
    }
    this.emit(this.fx, 'ring', undefined, x2, y2, 0.25, { tint: SLAG, sx0: 0.15, sx1: (SLAG_KIT.lobSplashR * 2) / 128 });
    for (let k = 0; k < 4; k++) this.emit(this.fx, 'spark', undefined, x2, y2, 0.3, { tint: SLAG, vx: (Math.random() - 0.5) * 180, vy: -30 - Math.random() * 90, drag: 0.9, sx0: 0.4, sx1: 0.1 });
  }

  /**
   * Slagbinder states: molten plate around a plated hero (its arc shrinks as the plating is used up),
   * a cold dome on a hero in Cooling Shell (and in a party the floor it covers), and cracks on Brittle foes.
   */
  private slagDraw(g: Phaser.GameObjects.Graphics, now: number): void {
    const w = this.world;
    const o = this.overFx;
    const heroes = [{ q: w.player, x: this.player.x, y: this.player.y }, ...this.allies.map((al) => ({ q: w.heroData(al.hero).player, x: al.img.x, y: al.img.y }))];
    for (const { q, x, y } of heroes) {
      if (q.hp <= 0) continue;
      if ((q.shellUntil ?? -1) > w.time) {
        const left = (q.shellUntil ?? 0) - w.time;
        const fade = Math.min(1, left / 0.6);
        if (w.heroes.length > 1) g.lineStyle(2.5, SLAG_COOL, 0.6 * fade).strokeEllipse(x, y + 10, SLAG_KIT.shellRadius * 2, SLAG_KIT.shellRadius * 0.9).fillStyle(SLAG_COOL, 0.07 * fade).fillEllipse(x, y + 10, SLAG_KIT.shellRadius * 2, SLAG_KIT.shellRadius * 0.9);
        o.fillStyle(SLAG_COOL, 0.1 * fade).fillEllipse(x, y - 4, 64, 66);
        o.lineStyle(2, SLAG_COOL, (0.55 + 0.15 * Math.sin(now / 200)) * fade).beginPath().arc(x, y + 6, 32, Math.PI * 1.02, Math.PI * 1.98).strokePath();
        o.lineStyle(1.5, 0xffffff, 0.35 * fade).beginPath().arc(x - 4, y - 2, 22, Math.PI * 1.2, Math.PI * 1.45).strokePath();
      }
      // Ember Ward (plateBy -1) shares the plating pool but has its own look, in altDraw.
      if ((q.plateUntil ?? -1) > w.time && (q.plate ?? 0) > 0 && q.plateBy !== -1) {
        const frac = Math.max(0.08, Math.min(1, (q.plate ?? 0) / Math.max(1, q.plateAmt ?? q.plate ?? 1)));
        const spin = now / 900;
        // A molten band at the feet, broken into plates, fewer as it is spent.
        const n = 8;
        for (let k = 0; k < n; k++) {
          if (k / n >= frac) break;
          const a0 = spin + (k / n) * Math.PI * 2;
          for (const [lw, col, al] of [[7, 0x2a1d18, 0.85], [4, SLAG, 0.95]] as const) {
            g.lineStyle(lw, col, al);
            g.beginPath();
            for (let s2 = 0; s2 <= 6; s2++) {
              const a = a0 + ((Math.PI * 2) / n - 0.2) * (s2 / 6);
              const px = x + Math.cos(a) * 26;
              const py = y + 18 + Math.sin(a) * 10;
              if (s2 === 0) g.moveTo(px, py); else g.lineTo(px, py);
            }
            g.strokePath();
          }
        }
        g.fillStyle(SLAG, 0.12 + 0.06 * Math.sin(now / 160)).fillEllipse(x, y + 18, 56, 22);
      }
    }
    for (const e of w.enemies) {
      if (!e.alive || (e.brittleUntil ?? 0) <= w.time) continue;
      const r = e.def.radius;
      const cx = e.x;
      const cy = e.y - r * 0.2;
      // Pale fracture lines over the body, the way cooled slag cracks.
      o.lineStyle(3, 0x1a1412, 0.7);
      o.beginPath().moveTo(cx - r * 0.5, cy - r * 0.55).lineTo(cx - r * 0.1, cy - r * 0.15).lineTo(cx - r * 0.25, cy + r * 0.2).lineTo(cx + r * 0.15, cy + r * 0.55).strokePath();
      o.beginPath().moveTo(cx - r * 0.1, cy - r * 0.15).lineTo(cx + r * 0.45, cy - r * 0.3).strokePath();
      o.lineStyle(1.5, 0xf0e8de, 0.95);
      o.beginPath().moveTo(cx - r * 0.5, cy - r * 0.55).lineTo(cx - r * 0.1, cy - r * 0.15).lineTo(cx - r * 0.25, cy + r * 0.2).lineTo(cx + r * 0.15, cy + r * 0.55).strokePath();
      o.beginPath().moveTo(cx - r * 0.1, cy - r * 0.15).lineTo(cx + r * 0.45, cy - r * 0.3).strokePath();
    }
  }

  /** Hearthkeeper Warmth at the hero's feet: a glow that grows with each stack, and at full (the cut) a ring with five embers circling it. */
  /**
   * An ability option's cast (ALT_ABILITIES). The event carries no class, so like the other casts
   * it is drawn as this screen's class.
   */
  private altCast(x: number, y: number, r: number): void {
    const w = this.world;
    const name = ALT_ABILITIES[w.cls].def.name;
    switch (w.cls) {
      case 'emberwright': {
        // Ember Ward: fire closes in around the hero and flames leap up.
        this.emit(this.fx, 'ring', undefined, x, y + 4, 0.35, { tint: WARD_FIRE, sx0: 1.1, sx1: 0.45 });
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          this.spark(x + Math.cos(a) * 30, y + 8 + Math.sin(a) * 14, Math.cos(a) * 20, -90 - Math.random() * 60, 0.45, 2);
        }
        this.floatText(x, y - 40, name, '#ffb27a', 18);
        break;
      }
      case 'duskblade': {
        // Hamstring: a cross cut on the foe, blood, and a violet ring out to the slow's reach.
        this.addShape({ kind: 'line', x: x - 22, y: y - 22, x2: x + 22, y2: y + 22, r: 0, angle: 0, color: 0xe0465a, life: 0.3 });
        this.addShape({ kind: 'line', x: x + 22, y: y - 22, x2: x - 22, y2: y + 22, r: 0, angle: 0, color: 0xffd0d8, life: 0.25 });
        this.impact(x, y, 1.4);
        for (let k = 0; k < 7; k++) {
          const a = Math.random() * Math.PI * 2;
          this.emit(this.fx, 'spark', undefined, x, y, 0.4, { tint: 0xe0465a, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 + 40, drag: 0.9, sx0: 1.6, sx1: 0.5 });
        }
        this.ring(x, y, r, SLOWED, 0.55);
        this.addShape({ kind: 'ring', x, y, x2: 0, y2: 0, r, angle: 0, color: SLOWED, life: 0.5 });
        this.floatText(x, y - 40, name, '#d0b8ff', 18);
        break;
      }
      case 'bulwark': {
        // Muster: three gold waves roll out to the cry's reach.
        for (let k = 0; k < 3; k++) this.emit(this.fx, 'ring', undefined, x, y, 0.4 + k * 0.15, { tint: CRY, sx0: 0.15, sx1: ((r * 2) / 128) * (0.7 + k * 0.15) });
        this.addShape({ kind: 'ring', x, y, x2: 0, y2: 0, r, angle: 0, color: CRY, life: 0.55 });
        this.shakeBy(0.1);
        this.floatText(x, y - 40, name, '#ffd27a', 20);
        break;
      }
      case 'lumen': {
        // Glow Pool: a shaft of light lands and the well spreads out.
        this.addShape({ kind: 'pillar', x, y, x2: 0, y2: 0, r: 22, angle: 0, color: WELL, life: 0.7 });
        this.ring(x, y, r, WELL, 0.5);
        this.floatText(x, y - 40, name, '#fff0b0', 18);
        break;
      }
      case 'slagbinder': {
        // Cinder Sump: a glob arcs out and the pit splashes open where it lands.
        this.slagLob(this.player.x, this.player.y, x, y);
        this.ring(x, y, r, SLAG, 0.4);
        this.burst(x, y, 10);
        for (let k = 0; k < 4; k++) this.steam(x + (Math.random() - 0.5) * r, y + (Math.random() - 0.5) * r * 0.5, 0.6);
        this.floatText(x, y - 40, name, '#ffb27a', 18);
        break;
      }
    }
  }

  /**
   * A dashed, slowly turning rim. Friendly ground effects (Sanctuary, Glow Pool, Cinder Sump) use it,
   * and telegraphs keep their solid rim, so a hero can tell "good to stand in" from "a mechanic"
   * by shape as well as colour (L3: the colours alone can merge for colour-blind players).
   */
  /**
   * Ally names lift apart when heroes bunch up (a soak, the tank spot), so two names never print
   * over each other on a phone. Lower names keep their place; a name that would overlap one
   * already placed moves up just clear of it.
   */
  private unstackLabels(): void {
    if (this.allies.length < 2) return;
    const order = [...this.allies].sort((a, b) => b.label.y - a.label.y);
    const placed: { l: number; r: number; t: number; b: number }[] = [];
    for (const al of order) {
      const lb = al.label;
      const w2 = lb.displayWidth / 2;
      let bottom = lb.y;
      const h = lb.displayHeight;
      // A bot's mark sits left of its name, so it takes room too.
      const l = lb.x - w2 - (al.mark ? h * 0.78 + 4 : 0);
      for (let pass = 0; pass < 4; pass++) {
        const hit = placed.find((q) => l < q.r && lb.x + w2 > q.l && bottom - h < q.b && bottom > q.t);
        if (!hit) break;
        bottom = hit.t - 1;
      }
      lb.y = bottom; // only the name moves; a title stays over its hero's head
      placed.push({ l, r: lb.x + w2, t: bottom - h, b: bottom });
    }
  }

  private dashedCircle(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, now: number): void {
    const n = Math.max(12, Math.round(r / (this.lowFx ? 14 : 7)));
    const step = (Math.PI * 2) / n;
    const turn = now / 4000;
    for (let k = 0; k < n; k++) {
      const a = turn + k * step;
      g.beginPath().arc(x, y, r, a, a + step * 0.55).strokePath();
    }
  }

  /** What the ability options leave in the world: wards, slows, the cry, wells and pits. */
  private altDraw(g: Phaser.GameObjects.Graphics, now: number): void {
    const w = this.world;
    const o = this.overFx;
    const t = w.time;
    const heroes = [{ q: w.player, x: this.player.x, y: this.player.y }, ...this.allies.map((al) => ({ q: w.heroData(al.hero).player, x: al.img.x, y: al.img.y }))];
    for (const { q, x, y } of heroes) {
      // Glow Pool and Cinder Sump stay where they were cast, even after the caster goes down.
      if ((q.wellUntil ?? -1) > t && q.wellX !== undefined && q.wellY !== undefined) {
        const fade = Math.min(1, ((q.wellUntil ?? 0) - t) / 0.8);
        const wx = q.wellX, wy = q.wellY, r = ALT_KIT.wellRadius;
        const pulse = 0.5 + 0.5 * Math.sin(now / 300);
        g.fillStyle(WELL, (0.1 + 0.04 * pulse) * fade).fillCircle(wx, wy, r);
        g.fillStyle(0xffffff, 0.08 * fade).fillCircle(wx, wy, r * 0.35);
        g.lineStyle(2.5, WELL, 0.75 * fade);
        this.dashedCircle(g, wx, wy, r, now);
        // Slow-turning rays in the pool (skipped when effects are trimmed).
        g.lineStyle(1.5, WELL, 0.3 * fade);
        if (!this.lowFx) for (let k = 0; k < 6; k++) {
          const a = now / 2400 + (k / 6) * Math.PI * 2;
          g.lineBetween(wx + Math.cos(a) * r * 0.3, wy + Math.sin(a) * r * 0.3, wx + Math.cos(a) * r * 0.85, wy + Math.sin(a) * r * 0.85);
        }
        if (!this.lowFx && Math.random() < 0.35 * fade) {
          const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r * 0.9;
          this.emit(this.fx, 'spark', undefined, wx + Math.cos(a) * d, wy + Math.sin(a) * d, 0.8, { tint: WELL, vy: -50, drag: 0.98, sx0: 1.3, sx1: 0.3 });
        }
      }
      if ((q.pitUntil ?? -1) > t && q.pitX !== undefined && q.pitY !== undefined) {
        const fade = Math.min(1, ((q.pitUntil ?? 0) - t) / 0.8);
        const px = q.pitX, py = q.pitY, r = ALT_KIT.pitRadius;
        // A dark crust over molten slag, with glowing seams and bubbles breaking.
        g.fillStyle(0x2a1d18, 0.5 * fade).fillCircle(px, py, r);
        g.fillStyle(SLAG, (0.16 + 0.06 * Math.sin(now / 180)) * fade).fillCircle(px, py, r * 0.75);
        g.lineStyle(2.5, SLAG, 0.8 * fade);
        this.dashedCircle(g, px, py, r, now);
        g.lineStyle(2, 0xffc27a, 0.55 * fade);
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + 0.4;
          g.beginPath().moveTo(px + Math.cos(a) * r * 0.2, py + Math.sin(a) * r * 0.2)
            .lineTo(px + Math.cos(a + 0.25) * r * 0.5, py + Math.sin(a + 0.25) * r * 0.5)
            .lineTo(px + Math.cos(a) * r * 0.85, py + Math.sin(a) * r * 0.85).strokePath();
        }
        if (!this.lowFx) for (let k = 0; k < 4; k++) {
          const ph = (now / 900 + k * 0.27) % 1;
          const a = k * 1.9 + 0.7, d = r * (0.3 + 0.12 * k);
          g.lineStyle(1.5, 0xffd9a0, (1 - ph) * 0.8 * fade).strokeCircle(px + Math.cos(a) * d, py + Math.sin(a) * d, 2 + ph * 6);
        }
      }
      if (q.hp <= 0) continue;
      // Ember Ward: a ring of flame tongues around the hero, thinning as the ward is spent.
      if (q.plateBy === -1 && (q.plate ?? 0) > 0 && (q.plateUntil ?? -1) > t) {
        const frac = Math.max(0.15, Math.min(1, (q.plate ?? 0) / Math.max(1, q.plateAmt ?? q.plate ?? 1)));
        const fade = Math.min(1, ((q.plateUntil ?? 0) - t) / 0.4);
        o.fillStyle(WARD_FIRE, 0.08 * fade).fillEllipse(x, y - 2, 66, 70);
        o.lineStyle(2, WARD_FIRE, 0.5 * fade).strokeEllipse(x, y - 2, 66, 70);
        const n = 12;
        for (let k = 0; k < n; k++) {
          if (k / n >= frac) break;
          const a = now / 700 + (k / n) * Math.PI * 2;
          const fl = 7 + 4 * Math.sin(now / 90 + k * 1.7);
          const bx = x + Math.cos(a) * 31, by = y - 2 + Math.sin(a) * 33;
          o.fillStyle(k % 2 ? 0xffb347 : WARD_FIRE, 0.85 * fade).fillTriangle(bx - 4, by + 2, bx + 4, by + 2, bx + Math.cos(a) * 3, by - fl);
        }
      }
      // Muster: a gold ring at the feet with chevrons rising through it.
      if ((q.cryUntil ?? -1) > t) {
        const fade = Math.min(1, ((q.cryUntil ?? 0) - t) / 0.6);
        g.lineStyle(2.5, CRY, 0.75 * fade).strokeEllipse(x, y + 20, 50, 18);
        for (let k = 0; k < 2; k++) {
          const ph = (now / 800 + k * 0.5) % 1;
          const cy = y + 18 - ph * 22, al = Math.sin(ph * Math.PI) * 0.8 * fade;
          for (const sx of [-1, 1]) {
            const cx = x + sx * 30;
            g.lineStyle(2, CRY, al).beginPath().moveTo(cx - 4, cy + 3).lineTo(cx, cy - 1).lineTo(cx + 4, cy + 3).strokePath();
          }
        }
      }
    }
    // Hamstring and Cinder Sump: a slowed foe drags a violet shackle ring at its feet.
    for (const e of w.enemies) {
      if (!e.alive || (e.slowUntil ?? 0) <= t) continue;
      const r = e.def.radius;
      const fade = Math.min(1, ((e.slowUntil ?? 0) - t) / 0.5);
      const fy = e.y + r * 0.85 + 3;
      const rr = Math.max(20, r * 1.1);
      if (this.lowFx) {
        // Trimmed effects: one ring per slowed foe, since a slowed pack can be dozens of foes.
        g.lineStyle(2.5, SLOWED, 0.8 * fade).strokeEllipse(e.x, fy, rr * 2, rr * 0.8);
        continue;
      }
      g.fillStyle(SLOWED, 0.12 * fade).fillEllipse(e.x, fy, rr * 2, rr * 0.8);
      g.lineStyle(2.5, SLOWED, 0.85 * fade);
      for (let k = 0; k < 5; k++) {
        const a0 = now / 1500 + (k / 5) * Math.PI * 2;
        g.beginPath();
        for (let j = 0; j <= 4; j++) {
          const a = a0 + 0.8 * (j / 4);
          const px = e.x + Math.cos(a) * rr, py = fy + Math.sin(a) * rr * 0.4;
          if (j) g.lineTo(px, py); else g.moveTo(px, py);
        }
        g.strokePath();
      }
      // Drag marks behind it, so it reads as held back.
      g.lineStyle(1.5, SLOWED, 0.5 * fade).lineBetween(e.x - rr * 0.5, fy + 3, e.x - rr * 1.2, fy + 3).lineBetween(e.x + rr * 0.5, fy + 3, e.x + rr * 1.2, fy + 3);
    }
  }

  private warmthDraw(g: Phaser.GameObjects.Graphics, x: number, y: number, n: number, full: boolean, now: number): void {
    const f = n / SET_TUNING.hkMax;
    g.fillStyle(0xff8a2a, 0.06 + 0.1 * f).fillEllipse(x, y, 40 + 16 * f, 15 + 6 * f);
    if (!full) return;
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);
    g.lineStyle(2, 0xffb347, 0.55 + 0.3 * pulse).strokeEllipse(x, y, 58, 21);
    for (let k = 0; k < SET_TUNING.hkMax; k++) {
      const a = now / 700 + (k / SET_TUNING.hkMax) * Math.PI * 2;
      const ex = x + Math.cos(a) * 29;
      const ey = y + Math.sin(a) * 10.5;
      g.fillStyle(0xff8a2a, 0.35).fillCircle(ex, ey, 4);
      g.fillStyle(0xffe0a0, 0.95).fillCircle(ex, ey, 1.8);
    }
  }

   /**
   * The Wrackline: the drain at the centre, the rafts, and the Ebb. During the warning,
   * pale lines rush inward from the rim; while it pulls, the floor darkens and streaks run
   * to the drain. A sunk raft is a dim ring of ripples until it bobs back up.
   */
  /**
   * Wrackrider's Planted (the set's 2-piece bonus): four short stakes driven in round the hero's feet
   * on a faint teal ring, in the set colour. They drive in over 0.15 s with a small ring, and pull out
   * over 0.25 s when the hero moves off.
   */
  private plantedDraw(g: Phaser.GameObjects.Graphics, x: number, y: number, on: boolean, dt: number): void {
    const was = this.plantK;
    this.plantK = on ? Math.min(1, was + dt / 0.15) : Math.max(0, was - dt / 0.25);
    if (on && was === 0) this.emit(this.fx, 'ring', undefined, x, y, 0.3, { tint: 0x5fe0c8, sx0: 0.45, sx1: 0.2 });
    const k = this.plantK;
    if (k <= 0) return;
    g.lineStyle(1.5, 0x5fe0c8, 0.4 * k).strokeEllipse(x, y, 54, 20);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const sx = x + Math.cos(a) * 27, sy = y + Math.sin(a) * 10;
      // Drawn from the cap down: a stake rises 8 px out of the ground, shorter as it drives in.
      const h = 8 * (1.6 - 0.6 * k);
      g.lineStyle(4, 0x0c1a18, 0.7 * k).lineBetween(sx, sy, sx, sy - h);
      g.lineStyle(2.4, 0x5fe0c8, 0.9 * k).lineBetween(sx, sy, sx, sy - h);
      g.fillStyle(0xd8fff6, 0.9 * k).fillRect(sx - 2, sy - h - 1.5, 4, 2);
    }
  }

  /**
   * Y6 Hessa's Whirl: which way the water turns this Ebb, readable at a glance on a phone. Curved arrows circle the drain
   * on two rings (one near the drain, one out where the heroes stand), turning the way whirlDir carries you. The way flips
   * every Ebb as the warning starts, so the arrows grow in fresh with a white flash then, and go bold and fast in the pull.
   */
  private whirlDraw(g: Phaser.GameObjects.Graphics, now: number, pulling: boolean): void {
    const w = this.world;
    const dir = w.whirlDir;
    if (dir !== this.whirlSeen) { this.whirlSeen = dir; this.whirlFlip = now; }
    const age = (now - this.whirlFlip) / 450;
    const grow = Math.min(1, age);
    const flash = Math.max(0, 1 - age);
    const tk = Math.max(1, this.textK);
    const turn = dir * (now / 1000) * (pulling ? 0.9 : 0.35);
    const rings: [number, number][] = [[WRACK.drainR + 70, 3], [Math.min(ARENA - 70, WRACK.drainR + 210), 4]];
    for (const [R, n] of rings) {
      const span = (pulling ? 1.15 : 0.95) * grow;
      for (let k = 0; k < n; k++) {
        const a0 = turn + (k / n) * Math.PI * 2;
        const a1 = a0 + dir * span;
        const hw = (pulling ? 12 : 9) * tk;
        const thick = (pulling ? 6 : 4.5) * tk;
        const al = pulling ? 0.9 : 0.7 + 0.2 * Math.sin(now / 140);
        const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
        // A dark under-stroke so the arrow reads on bright water, then the water-blue body and a pale crest.
        g.lineStyle(thick + 3 * tk, 0x07202a, 0.55 * al).beginPath().arc(0, 0, R, lo, hi).strokePath();
        g.lineStyle(thick, 0x7fd0e0, al).beginPath().arc(0, 0, R, lo, hi).strokePath();
        g.lineStyle(thick * 0.35, 0xeafaff, al * (0.6 + 0.4 * flash)).beginPath().arc(0, 0, R - thick * 0.15, lo + (hi - lo) * 0.25, hi).strokePath();
        // The head: a point ahead of the arc's end, along the way it turns.
        const tipA = a1 + (dir * hw * 1.6) / R;
        const tx = Math.cos(tipA) * R, ty = Math.sin(tipA) * R;
        const bx0 = Math.cos(a1) * (R - hw), by0 = Math.sin(a1) * (R - hw);
        const bx1 = Math.cos(a1) * (R + hw), by1 = Math.sin(a1) * (R + hw);
        g.fillStyle(0x07202a, 0.55 * al).fillTriangle(tx, ty, bx0 - Math.cos(a1) * 2, by0 - Math.sin(a1) * 2, bx1 + Math.cos(a1) * 2, by1 + Math.sin(a1) * 2);
        g.fillStyle(flash > 0 ? 0xffffff : 0xbfe9ff, Math.min(1, al + 0.15)).fillTriangle(tx, ty, bx0, by0, bx1, by1);
      }
    }
  }

  /** Where each foe stood last frame and whether it was on an afloat raft, for the Ebb's shove (by enemy index). */
  private raftPrev: { x: number; y: number; on: boolean }[] = [];
  private shoves: { x0: number; y0: number; x: number; y: number; t: number }[] = [];

  /**
   * H3d (#725): on a Halls map the Ebb pushes every foe off an afloat raft in a single step, which on a phone read as a
   * jump. Phone pass, 25 Nov: a foe that leaves a raft that way gets a splash where it lands and a short wake back to
   * where it stood, so it reads as a shove.
   */
  private shoveDraw(g: Phaser.GameObjects.Graphics, pulling: boolean): void {
    const w = this.world;
    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i];
      const on = e.alive && w.onRaft(e.x, e.y);
      const was = this.raftPrev[i];
      if (pulling && w.hallsOn && e.alive && was?.on && !on && Math.hypot(e.x - was.x, e.y - was.y) > 8) {
        this.shoves.push({ x0: was.x, y0: was.y, x: e.x, y: e.y, t: w.time });
      }
      this.raftPrev[i] = { x: e.x, y: e.y, on };
    }
    this.raftPrev.length = w.enemies.length;
    // Timed on the world's clock (0.45 s), so a slow frame can't skip it and a pause holds it.
    const LIFE = 0.45;
    this.shoves = this.shoves.filter((s) => w.time - s.t < LIFE && w.time >= s.t);
    for (const s of this.shoves) {
      const k = (w.time - s.t) / LIFE;
      // Bold enough for the 3D floor, which carries this at about a third of its size on a Halls map.
      g.lineStyle(14 * (1 - k) + 4, 0xd8fbff, 0.75 * (1 - k)).lineBetween(s.x0, s.y0, s.x, s.y);
      g.fillStyle(0xd8fbff, 0.35 * (1 - k)).fillCircle(s.x, s.y, 30 + 40 * k);
      g.lineStyle(7, 0xffffff, 0.9 * (1 - k)).strokeCircle(s.x, s.y, 30 + 40 * k);
    }
  }

  private wrackDraw(g: Phaser.GameObjects.Graphics, now: number): void {
    const w = this.world;
    const pulling = w.ebbT > 0;
    const warn = w.ebbWarnT > 0;
    // H3d: on a Halls map the drain sits in the woken room (World.wrackX/Y, wrackRoom; -1 or absent in the arena), and
    // the Ebb's streaks run in from that room's rim, not the arena's.
    const wx = w as unknown as { wrackX?: number; wrackY?: number; wrackRoom?: number };
    const ox = wx.wrackX ?? 0, oy = wx.wrackY ?? 0;
    const room = (wx.wrackRoom ?? -1) >= 0 ? w.halls?.rooms[wx.wrackRoom!] : undefined;
    const RIM = room ? Math.min(ARENA, room.r - 20) : ARENA;
    this.shoveDraw(g, pulling);
    // The drain: a dark whirlpool on the floor that turns, faster while the water pulls.
    // The Wrackline's images lie on the floor itself, under every ground effect (burn zones at depth 1)
    // and the telegraph layer (depth 2), so a zone on a raft or a Sink circle always shows on top.
    if (!this.drainImg) this.drainImg = this.add.image(0, 0, 'drain').setDepth(0.8);
    // Y6 the Whirl: the drain turns the way the water will carry you (whirlDir 1 is clockwise on screen).
    const spinDir = w.whirl ? w.whirlDir : -1;
    this.drainImg.setVisible(true).setPosition(ox, oy).setScale((WRACK.drainR * 2.3) / 256).setRotation(spinDir * (now / 1000) * (pulling ? 2.6 : warn ? 1.2 : 0.5)).setAlpha(pulling ? 1 : 0.85);
    if (pulling && !this.lowFx) {
      // Foam spun off the drain's rim.
      for (let k = 0; k < 3; k++) {
        const a = spinDir * (now / 1000) * 2.6 + (k * 2 * Math.PI) / 3;
        g.lineStyle(2, 0xbfe9ff, 0.5).beginPath().arc(ox, oy, WRACK.drainR * 1.02, a, a + 0.7).strokePath();
      }
    }
    if (warn || pulling) {
      // The Ebb: foam streaks rushing from the rim toward the drain, each a bright head with a fading
      // tail. Faint and slow through the 3 s warning, then fast and bold through the pull.
      const n = this.lowFx ? 10 : 18;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + 0.2 + Math.sin(k * 7.3) * 0.08;
        const t = (now / (pulling ? 500 : 900) + k * 0.37) % 1;
        // Phase 12 W1: Hessa's Outsurge runs the other way, from the drain out to the rim (placeholder until visuals).
        const outward = w.outsurge;
        if (w.whirl) {
          // Y3 the Whirl: streaks run round the drain the way it turns (the arrowed eddies are drawn below, whirlDraw).
          const rr = WRACK.drainR + 60 + ((k * 97) % (RIM - WRACK.drainR - 90));
          const a0 = a + w.whirlDir * t * 1.4;
          const a1 = a0 - w.whirlDir * (pulling ? 0.22 : 0.12);
          const al = pulling ? 0.6 : 0.3 + 0.25 * Math.sin(now / 90);
          g.lineStyle(pulling ? 4 : 2, 0x7fd0e0, al * 0.45).lineBetween(ox + Math.cos(a1) * rr, oy + Math.sin(a1) * rr, ox + Math.cos(a0) * rr, oy + Math.sin(a0) * rr);
          g.fillStyle(0xeafaff, al).fillCircle(ox + Math.cos(a0) * rr, oy + Math.sin(a0) * rr, pulling ? 2.6 : 1.8);
          continue;
        }
        const r0 = outward ? WRACK.drainR + t * (RIM - WRACK.drainR) : RIM - t * (RIM - WRACK.drainR);
        const len = pulling ? 80 : 44;
        const r1 = outward ? Math.max(WRACK.drainR, r0 - len) : Math.min(RIM, r0 + len);
        const cx = Math.cos(a), cy = Math.sin(a);
        const al = pulling ? 0.6 : 0.3 + 0.25 * Math.sin(now / 90);
        g.lineStyle(pulling ? 4 : 2, 0x7fd0e0, al * 0.45).lineBetween(ox + cx * r0, oy + cy * r0, ox + cx * r1, oy + cy * r1);
        g.lineStyle(pulling ? 2 : 1.5, 0xbfe9ff, al).lineBetween(ox + cx * r0, oy + cy * r0, ox + cx * (r0 + (outward ? -1 : 1) * len * 0.4), oy + cy * (r0 + (outward ? -1 : 1) * len * 0.4));
        g.fillStyle(0xeafaff, al).fillCircle(ox + cx * r0, oy + cy * r0, pulling ? 2.6 : 1.8);
      }
    }
    // Y6: the Whirl's eddies lie on the water under the rafts (0.85; rafts 0.9), so a raft, which the water can't carry, stays clear.
    if (!this.whirlGfx && w.whirl) this.whirlGfx = this.add.graphics().setDepth(0.85);
    this.whirlGfx?.clear();
    if (w.whirl && (warn || pulling) && this.whirlGfx) this.whirlDraw(this.whirlGfx, now, pulling);
    if (!this.surfGfx) this.surfGfx = this.add.graphics().setDepth(1.35);
    const sg = this.surfGfx.clear();
    if (w.outsurge && (warn || pulling)) this.outsurgeDraw(sg, now, pulling);
    // The raft texture's deck is 248 of its 256 px across.
    const scale = (WRACK.raftR * 2) / 248;
    w.rafts.forEach((r, i) => {
      let im = this.raftImgs[i];
      if (!im) {
        im = { deck: this.add.image(0, 0, 'raft').setDepth(0.9), rim: this.add.image(0, 0, 'raftRim').setDepth(0.95).setBlendMode(Phaser.BlendModes.ADD).setVisible(false) };
        this.raftImgs.push(im);
      }
      if (r.sunkT > 0) {
        im.deck.setVisible(false); im.rim.setVisible(false);
        // Under water: rings of ripples where it went down, and a few loose boards bobbing on them.
        const t = (now / 700) % 1;
        g.lineStyle(2, 0x7fd0e0, 0.45 * (1 - t)).strokeCircle(r.x, r.y, WRACK.raftR * (0.4 + 0.6 * t));
        g.lineStyle(1, 0x7fd0e0, 0.25).strokeCircle(r.x, r.y, WRACK.raftR);
        for (let k = 0; k < 3; k++) {
          const a = k * 2.1 + now / 2400, d = WRACK.raftR * (0.3 + 0.2 * k);
          const bx = r.x + Math.cos(a) * d, by = r.y + Math.sin(a) * d * 0.8 + Math.sin(now / 300 + k) * 2;
          g.fillStyle(0x8a6c48, 0.75).fillRect(bx - 9, by - 2.5, 18, 5);
        }
        return;
      }
      // Phase 12 W1: which way each raft drifts changes from fight to fight, so it trails a wake.
      this.raftWake(sg, r, now, w.wrackPhase >= 2 && !w.outsurge);
      // A slight bob and roll, so a raft reads as afloat even while it drifts slowly.
      const bob = 1 + Math.sin(now / 650 + i * 2) * 0.012;
      im.deck.setVisible(true).setPosition(r.x, r.y).setScale(scale * bob).setRotation(Math.sin(now / 1900 + i) * 0.04);
      // The Ebb is coming: the rim lights near-white and pulses, so the safe ground is unmistakable.
      if (warn || pulling) {
        const p = pulling ? 0.85 : 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(now / 120));
        im.rim.setVisible(true).setPosition(r.x, r.y).setScale(scale * 1.08).setTint(0xe8fbff).setAlpha(p);
      } else im.rim.setVisible(false);
    });
    for (let i = w.rafts.length; i < this.raftImgs.length; i++) { this.raftImgs[i].deck.setVisible(false); this.raftImgs[i].rim.setVisible(false); }
  }

/**
   * Phase 12 W1, Hessa's Outsurge: while the Ebb runs outward, the outer OUTSURGE.rimR of the arena is breaking surf
   * that burns. A band of churned water with foam crests rolling out to the rim; its inner edge, where the burn starts,
   * is a dashed danger line through the warning and a solid one through the pull. Drawn under the main graphics, so a
   * class ring or a telegraph in the surf still shows on top.
   */
  /**
   * Phase 12 W2, Ysmeret's Wandering Vents: while her two soak circles circle her, each drags a fading gold swath along
   * the path it came from, and gold chevrons slide ahead of it along the path it will take, so the soakers can walk
   * with it. Drawn under the main graphics (1.9): the circles, class rings and other telegraphs stay on top.
   */
  /**
   * Phase 12 W3: Grandmother Slag's Brimming. The pit fills: a molten wash over the floor with slow bright flow, and the
   * cooling islands as crusts of dark slag. An island rises over half a second; in its last BRIM.warn s it settles,
   * its cracks flare and it flickers as the slag takes it, with a shrinking arc for the time it has left.
   */
  private brimDraw(now: number): void {
    const w = this.world;
    const isl = w.islands;
    if (!isl.length) {
      if (this.brimGfx) { this.brimGfx.clear(); for (const im of this.brimImgs) im.setVisible(false); }
      this.brimStart = 0;
      return;
    }
    if (!this.brimGfx) this.brimGfx = this.add.graphics().setDepth(1.88);
    if (!this.brimStart) this.brimStart = now;
    const g = this.brimGfx.clear();
    const R = ARENA;
    const fill = Math.min(1, (now - this.brimStart) / 1500);
    // The molten wash: a dark-red pool, brighter where it flows, breathing.
    g.fillStyle(0x7a1e06, 0.5 * fill).fillCircle(0, 0, R);
    g.fillStyle(MOLTEN, (0.16 + 0.05 * Math.sin(now / 600)) * fill).fillCircle(0, 0, R);
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4 + now / (9000 + k * 700), d = R * (0.25 + 0.6 * ((k * 0.37) % 1));
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      g.fillStyle(0xffa040, (0.10 + 0.06 * Math.sin(now / 500 + k)) * fill).fillEllipse(x, y, 150 + 30 * Math.sin(now / 800 + k), 70);
    }
    // Bright veins slowly crawling round the pool.
    g.lineStyle(3, 0xffd27a, 0.28 * fill);
    for (let k = 0; k < 5; k++) {
      const r0 = R * (0.3 + k * 0.13), a0 = k * 1.3 + now / (7000 - k * 600);
      g.beginPath();
      for (let j = 0; j <= 10; j++) { const a = a0 + j * 0.09, rr = r0 + Math.sin(j * 1.7 + now / 900 + k) * 9; const px = Math.cos(a) * rr, py = Math.sin(a) * rr; if (j === 0) g.moveTo(px, py); else g.lineTo(px, py); }
      g.strokePath();
    }
    const rad = BRIM.radius;
    isl.forEach((s, k) => {
      let born = this.brimBorn.get(s);
      if (born === undefined) { born = now; this.brimBorn.set(s, born); }
      const rise = Math.min(1, (now - born) / 500);
      const sinking = s.t < BRIM.warn;
      const u = sinking ? Math.max(0, s.t / BRIM.warn) : 1; // 1 = solid, 0 = gone
      const flick = sinking ? 0.75 + 0.25 * Math.sin(now / 70 + k) : 1;
      // The seam where the slag laps the crust: a hot halo, brighter as it sinks.
      g.lineStyle(16, 0xffb040, (0.22 + (1 - u) * 0.35) * rise * flick).strokeCircle(s.x, s.y, rad + 6);
      // The time it has left, in its last BRIM.warn s.
      if (sinking) g.lineStyle(3, 0xfff0c0, 0.85).beginPath().arc(s.x, s.y, rad + 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * u).strokePath();
      let im = this.brimImgs[k];
      if (!im) im = this.brimImgs[k] = this.add.image(0, 0, 'brimIsland').setDepth(1.9);
      const sc = ((rad * 2 + 12) / 192) * (0.75 + 0.25 * rise) * (0.88 + 0.12 * u);
      // Sinking, the crust takes the slag's colour and goes under.
      const f = 1 - u, tint = (255 << 16) | (Math.round(255 - f * 117) << 8) | Math.round(255 - f * 175);
      im.setVisible(true).setPosition(s.x, s.y).setScale(sc).setAlpha(rise * (0.3 + 0.7 * u) * flick).setTint(tint);
    });
    for (let k = isl.length; k < this.brimImgs.length; k++) this.brimImgs[k].setVisible(false);
  }

  /**
   * Phase 12 W3: Old Vorhulm's Banked Coals (his phase 3, `bank` version): a heap of glowing coals inside each gold soak
   * circle, settling in and burning brighter as the fuse runs. While a hero stands in one it cools toward grey ash, so a
   * smothered coal reads differently from an empty one. The gold ring and fuse stay on the main graphics as for any soak.
   */
  private bankDraw(now: number): void {
    const w = this.world;
    const coals = w.dungeonId === 'hoard' && (w.bossVariant === 'bank' || w.bossEcho === 'bank') ? w.telegraphs.filter((t) => t.alive && t.kind === 'soak' && t.owner === -4) : [];
    // The ash a smothered coal leaves, fading over 2.5 s.
    this.bankAsh = this.bankAsh.filter((a) => {
      const u = (now - a.at) / 2500;
      if (u >= 1) { a.img.destroy(); return false; }
      a.img.setAlpha(0.9 * (1 - u * u));
      return true;
    });
    if (!coals.length) {
      if (this.bankGfx) { this.bankGfx.clear(); for (const im of this.bankImgs) { im.hot.setVisible(false); im.ash.setVisible(false); } }
      return;
    }
    if (!this.bankGfx) this.bankGfx = this.add.graphics().setDepth(1.89);
    const g = this.bankGfx.clear();
    coals.forEach((t, k) => {
      const f = Math.min(1, t.t / t.dur);
      let covered = false;
      for (let i = 0; i < w.heroes.length && !covered; i++) {
        const q = w.heroData(i).player;
        if (q.hp > 0 && (q.x - t.x) ** 2 + (q.y - t.y) ** 2 <= t.r * t.r) covered = true;
      }
      // How smothered it looks eases toward 1 while covered and back while empty.
      const cool = Math.max(0, Math.min(1, (this.bankCool.get(t) ?? 0) + (covered ? 0.05 : -0.05)));
      this.bankCool.set(t, cool);
      const settle = Math.min(1, t.t / 0.35);
      const heat = (1 - cool) * (0.6 + 0.4 * f) * (0.85 + 0.15 * Math.sin(now / 110 + k * 2));
      g.fillStyle(MOLTEN, 0.3 * heat * settle).fillCircle(t.x, t.y, t.r * 1.15);
      g.fillStyle(0xffd27a, 0.18 * heat * settle).fillCircle(t.x, t.y, t.r * 0.6);
      let im = this.bankImgs[k];
      if (!im) im = this.bankImgs[k] = { hot: this.add.image(0, 0, 'coalBed').setDepth(1.9), ash: this.add.image(0, 0, 'coalAsh').setDepth(1.9) };
      const sc = ((t.r * 1.9) / 128) * (0.8 + 0.2 * settle);
      im.hot.setVisible(true).setPosition(t.x, t.y - (1 - settle) * 30).setScale(sc).setAlpha(settle * (1 - cool * 0.85));
      im.ash.setVisible(cool > 0).setPosition(t.x, t.y - (1 - settle) * 30).setScale(sc).setAlpha(settle * cool);
      // Embers lifting off a live heap.
      if (!this.lowFx && Math.random() < 0.15 * heat) this.spark(t.x + (Math.random() - 0.5) * t.r, t.y + (Math.random() - 0.5) * t.r * 0.6, (Math.random() - 0.5) * 20, -50 - 50 * f, 0.7, 1.4);
    });
    for (let k = coals.length; k < this.bankImgs.length; k++) { this.bankImgs[k].hot.setVisible(false); this.bankImgs[k].ash.setVisible(false); }
  }

  /** A Banked Coal smothered as it lands: grey ash left behind, and a puff of smoke. */
  private bankSmothered(x: number, y: number): void {
    const img = this.add.image(x, y, 'coalAsh').setDepth(1.9).setScale((BANK.radius * 1.9) / 128).setAlpha(0.9);
    this.bankAsh.push({ img, at: this.time.now });
    this.ring(x, y, BANK.radius, 0xb8b0a8, 0.35);
  }

  /** An empty Banked Coal he eats: it flares, and its embers stream to him. */
  private bankEaten(x: number, y: number): void {
    const w = this.world;
    const e = w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
    this.ring(x, y, BANK.radius * 1.3, MOLTEN, 0.5);
    if (!e) return;
    const dx = e.x - x, dy = e.y - y, d = Math.max(1, Math.hypot(dx, dy));
    for (let k = 0; k < 10; k++) this.spark(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 20, (dx / d) * (180 + Math.random() * 120), (dy / d) * (180 + Math.random() * 120), 0.6 + Math.random() * 0.3, 1.8);
  }

  /**
   * Phase 12 W3: the Furnace Regent's Summons (court version, phase 2). Unlike every other ring, it says "come close":
   * - inside SUMMONS.radius round him, a gold (SOAK, "stand in it") court circle with a timer sweep;
   * - gold chevrons outside the rim crawling in toward him;
   * - just outside the rim, a narrow DANGER band that strengthens as it is about to land;
   * - for each living hero still outside, a gold arrow a little way from their feet pointing at him.
   * The Ash Fall circles that come with it stay on the main graphics above this.
   */
  private summonsDraw(now: number): void {
    const w = this.world;
    const e = w.summonsT > 0 && w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
    if (!e || !e.alive) { this.summonsGfx?.clear(); return; }
    if (!this.summonsGfx) this.summonsGfx = this.add.graphics().setDepth(1.9);
    const g = this.summonsGfx.clear();
    const R = SUMMONS.radius;
    const k = Math.max(0, Math.min(1, 1 - w.summonsT / SUMMONS.warn));
    const pulse = 0.5 + 0.5 * Math.sin(now / 140);
    // Just outside: a narrow danger band fading outward from the rim (kept narrow so the Ash Fall circles, also DANGER, stay readable).
    for (let n = 0; n < 6; n++) g.lineStyle(12, DANGER, (0.34 - n * 0.055) * (0.5 + 0.5 * k)).strokeCircle(e.x, e.y, R + 8 + n * 12);
    // Inside: the court circle.
    g.fillStyle(SOAK, 0.1 + 0.08 * k).fillCircle(e.x, e.y, R);
    g.lineStyle(5, SOAK, 0.75 + 0.25 * pulse).strokeCircle(e.x, e.y, R);
    g.lineStyle(3, 0xfff2c8, 0.9).beginPath().arc(e.x, e.y, R - 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - k), false).strokePath();
    // Chevrons crawling in from outside the rim.
    for (let q = 0; q < 10; q++) {
      const a = (q / 10) * Math.PI * 2 + 0.15;
      for (let j = 0; j < 2; j++) {
        const u = ((now / 900 + j * 0.5) % 1);
        const r = R + 70 - 60 * u;
        const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
        const ia = a + Math.PI;
        const al = 0.85 * Math.sin(u * Math.PI);
        g.lineStyle(4, SOAK, al).beginPath()
          .moveTo(x + Math.cos(ia + 2.4) * 10, y + Math.sin(ia + 2.4) * 10).lineTo(x + Math.cos(ia) * 6, y + Math.sin(ia) * 6).lineTo(x + Math.cos(ia - 2.4) * 10, y + Math.sin(ia - 2.4) * 10).strokePath();
      }
    }
    // An arrow toward him beside each hero still outside.
    for (let i = 0; i < w.heroes.length; i++) {
      const q = w.heroData(i).player;
      if (q.hp <= 0) continue;
      const dx = e.x - q.x, dy = e.y - q.y, d = Math.hypot(dx, dy);
      if (d <= R) continue;
      const ux = dx / d, uy = dy / d;
      const bx = q.x + ux * 44, by = q.y + 10 + uy * 44;
      const ia = Math.atan2(uy, ux);
      g.fillStyle(SOAK, 0.6 + 0.35 * pulse).fillTriangle(bx + Math.cos(ia) * 14, by + Math.sin(ia) * 14, bx + Math.cos(ia + 2.5) * 10, by + Math.sin(ia + 2.5) * 10, bx + Math.cos(ia - 2.5) * 10, by + Math.sin(ia - 2.5) * 10);
      g.lineStyle(2, 0x1a1010, 0.8).strokeTriangle(bx + Math.cos(ia) * 14, by + Math.sin(ia) * 14, bx + Math.cos(ia + 2.5) * 10, by + Math.sin(ia + 2.5) * 10, bx + Math.cos(ia - 2.5) * 10, by + Math.sin(ia - 2.5) * 10);
    }
  }

  /**
   * Phase 14 X6: each arena event's warning, drawn while it is warned (World.arenaEventStage 1).
   * - Cave-in: dust trickles down over each of its spots, a shadow grows under it, and a rock drops in the last moment
   *   (the warned circle is the usual danger circle; the rock is a stone of the dungeon's look once it lands).
   * - Vent Surge: every vent already brightens under its circle; on an open floor (no vent there) the spot cracks and glows.
   * - Cold Snap: frost creeps in from the arena edge and snow falls; when it lands the coals dim (the sim) with a frost ring.
   * - High Water: the Ebb's own warning shows it, so there is nothing more to draw.
   */
  /** Each dungeon's stone texture for its layouts and cave-ins (the boss fight is always open). */
  private stoneKey(): string {
    const id = this.world.dungeonId;
    return id === 'foundry' ? 'foundryStone' : id === 'coldmarrow' ? 'iceStone' : id === 'hammerdeep' ? 'deepStone' : id === 'pressworks' ? 'pressStone' : RAID_STONE[id] ?? 'kilnStone';
  }

  /** Phase 15 Y6 and Y10: the wave marks (waveFx), the stir beat's falling grit, and the stirred elite's mark. */
  private waveDraw(now: number): void {
    const w = this.world;
    this.waveFx = this.waveFx.filter((f) => now - f.t0 < f.dur);
    const se = this.stirElite;
    const elite = se && w.enemies[se.i]?.alive && w.enemies[se.i].spawnedAt === se.at ? w.enemies[se.i] : null;
    if (!elite) this.stirElite = null;
    const stirring = this.stirAt >= 0 && now - this.stirAt < 1400;
    if (!this.waveFx.length && !elite && !stirring) { this.waveGfx?.clear(); return; }
    if (!this.waveGfx) this.waveGfx = this.add.graphics().setDepth(1.95);
    const g = this.waveGfx.clear();
    const AMBER = 0xffb35c, DEEP = 0xff6a1f;
    const chevron = (x: number, y: number, a: number, size: number, col: number, alpha: number, width = 4) => {
      // Points along a.
      const bx = x - Math.cos(a) * size, by = y - Math.sin(a) * size;
      const px = -Math.sin(a) * size * 0.8, py = Math.cos(a) * size * 0.8;
      g.lineStyle(width, col, alpha).beginPath().moveTo(bx + px, by + py).lineTo(x, y).lineTo(bx - px, by - py).strokePath();
    };
    for (const f of this.waveFx) {
      const k = (now - f.t0) / f.dur;
      const fade = Math.min(1, k * 5) * Math.min(1, (1 - k) * 4);
      if (f.kind === 'ring') {
        // A dashed ring round where the hero stood, drawing in from where the wave forms (WAVES.ringR) as it fades.
        const r = WAVES.ringR * (1 - 0.6 * (1 - (1 - k) * (1 - k)));
        const n = 28, turn = k * 0.6;
        for (let j = 0; j < n; j++) {
          const a0 = turn + (j / n) * Math.PI * 2;
          g.lineStyle(5, AMBER, 0.75 * fade).beginPath().arc(f.x, f.y, r, a0, a0 + (Math.PI * 2) / n * 0.55).strokePath();
        }
        for (let j = 0; j < 8; j++) {
          const a = (j / 8) * Math.PI * 2 + turn;
          chevron(f.x + Math.cos(a) * (r - 26), f.y + Math.sin(a) * (r - 26), a + Math.PI, 12, AMBER, 0.85 * fade);
        }
      } else if (f.kind === 'pincer') {
        // Two columns of chevrons squeezing in on the hero from both flanks (a quarter turn either side of the far side).
        for (const side of [1, -1]) {
          const a = f.a + side * (Math.PI / 2);
          for (let j = 0; j < 3; j++) {
            const d = 250 - 150 * ((k * 1.4 + j * 0.18) % 1);
            chevron(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, a + Math.PI, 20, AMBER, 0.9 * fade * (1 - j * 0.2), 6);
          }
        }
      } else if (f.kind === 'gate') {
        // The held pack's gate: a glowing stretch of the arena wall and chevrons marching in from it, pulsing faster as it nears.
        const R = w.arenaR - 18, pulse = 0.65 + 0.35 * Math.sin(now / (110 - 50 * k));
        g.lineStyle(14, DEEP, 0.22 * fade).beginPath().arc(0, 0, R, f.a - 0.55, f.a + 0.55).strokePath();
        g.lineStyle(5, AMBER, 0.9 * fade * pulse).beginPath().arc(0, 0, R, f.a - 0.5, f.a + 0.5).strokePath();
        g.fillStyle(DEEP, 0.18 * fade * pulse).fillCircle(f.x, f.y, 70 + 20 * k);
        for (let j = 0; j < 3; j++) {
          const d = (now / 9 + j * 45) % 135;
          chevron(f.x - Math.cos(f.a) * (30 + d), f.y - Math.sin(f.a) * (30 + d), f.a + Math.PI, 16, AMBER, 0.9 * fade * (1 - d / 135), 5);
        }
      } else {
        // The pack bursts through: a ring of dust thrown out from the gate.
        g.lineStyle(6 * (1 - k) + 1, AMBER, 0.8 * (1 - k)).strokeCircle(f.x, f.y, 30 + 110 * k);
        g.fillStyle(0xb8aca4, 0.35 * (1 - k)).fillCircle(f.x, f.y, 30 + 70 * k);
      }
    }
    if (stirring && !this.lowFx) {
      // Grit shaken loose from the dark above, over the whole view.
      const v = this.cameras.main.worldView, k = (now - this.stirAt) / 1400;
      for (let j = 0; j < 26; j++) {
        const u = ((k * 1.6 + j * 0.137) % 1);
        const x = v.x + ((j * 97.31) % 1) * v.width + (j % 2 ? 6 : -6) * u;
        this.overFx.fillStyle(0xb8aca4, 0.55 * (1 - k)).fillCircle(x, v.y + u * v.height, 1.4 + (j % 3) * 0.6);
      }
    }
    if (elite) {
      // The stirred elite: an amber rune ring turning under it, with three notches, so the extra one reads as the dungeon's.
      const r = elite.def.radius * 1.35, a0 = now / 700;
      const x = elite.x, y = elite.y + elite.def.radius * 0.55;
      g.lineStyle(3, AMBER, 0.75).strokeEllipse(x, y, r * 2, r * 0.9);
      g.lineStyle(2, DEEP, 0.5).strokeEllipse(x, y, r * 2.3, r * 1.05);
      for (let j = 0; j < 3; j++) {
        const a = a0 + (j / 3) * Math.PI * 2;
        g.fillStyle(AMBER, 0.9).fillCircle(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.45, 4);
      }
    }
  }

  private arenaEventDraw(now: number): void {
    const w = this.world;
    const ev = w.arenaEvent;
    for (const r of this.caveRocks) r.setVisible(false);
    if (!ev || w.arenaEventStage !== 1 || ev === 'highWater') { this.arenaGfx?.clear(); return; }
    if (!this.arenaGfx) this.arenaGfx = this.add.graphics().setDepth(1.9);
    const g = this.arenaGfx.clear();
    const o = this.overFx;
    const A = ARENA_EVENTS;
    if (ev === 'caveIn') {
      const k = Math.max(0, Math.min(1, 1 - w.arenaEventT / A.caveWarn));
      for (const [n, c] of w.caveInSpots().entries()) {
        g.fillStyle(0x000000, 0.18 + 0.32 * k).fillEllipse(c.x, c.y + 4, A.caveRadius * 2 * (0.4 + 0.8 * k), A.caveRadius * 1.2 * (0.4 + 0.8 * k));
        // Dust and grit trickling down from the dark above.
        for (let m = 0; m < (this.lowFx ? 3 : 6); m++) {
          const u = ((now / 700) + m / 6 + n * 0.31) % 1;
          o.fillStyle(0xb8aca4, 0.6 * (1 - u)).fillCircle(c.x + Math.sin(m * 2.3 + n) * 18, c.y - 220 + 220 * u, 1.6 + m % 2);
        }
        // The rock: it falls in the last 40% of the warning. It is the very stone it becomes, in this dungeon's own
        // look (Hammerdeep iron, Pressworks plate, Coldmarrow ice, pumice in the Ashvents), a little larger while high.
        if (k > 0.6) {
          const f = (k - 0.6) / 0.4;
          const rock = this.caveRocks[n] ?? (this.caveRocks[n] = this.add.image(0, 0, this.stoneKey()).setOrigin(0.5, 0.64).setDepth(5.5)); // under heroes (6): never over an ally's ring
          rock.setTexture(this.stoneKey()).setVisible(true).setPosition(c.x, c.y - 260 * (1 - f * f))
            .setScale((A.caveRadius / 68) * (1.3 - 0.3 * f)).setRotation((1 - f) * (n % 2 ? 0.5 : -0.5));
        }
      }
    } else if (ev === 'ventSurge') {
      const k = Math.max(0, Math.min(1, 1 - w.arenaEventT / A.surgeWarn));
      if (w.flareVents.length) return; // the vents themselves flare under their circles
      for (const [n, c] of w.surgeSpots().entries()) {
        const glow = 0.25 + 0.45 * k + 0.15 * Math.sin(now / 60 + n);
        g.fillStyle(MOLTEN, 0.12 + 0.18 * k).fillCircle(c.x, c.y, 26 + 14 * k);
        g.lineStyle(3, 0xffb060, glow);
        for (let q = 0; q < 5; q++) {
          const a = q * 1.256 + n;
          const l1 = 10 + 22 * k;
          g.beginPath().moveTo(c.x, c.y).lineTo(c.x + Math.cos(a) * l1 * 0.6, c.y + Math.sin(a + 0.3) * l1 * 0.6).lineTo(c.x + Math.cos(a + 0.2) * l1, c.y + Math.sin(a + 0.2) * l1).strokePath();
        }
        if (!this.lowFx && Math.random() < 0.2 + 0.3 * k) this.spark(c.x + (Math.random() - 0.5) * 20, c.y, (Math.random() - 0.5) * 30, -80 - 60 * k, 0.5, 1.4);
      }
    } else if (ev === 'coldSnap') {
      const k = Math.max(0, Math.min(1, 1 - w.arenaEventT / A.snapWarn));
      const R = w.arenaR ?? ARENA;
      const band = 40 + 240 * k;
      g.lineStyle(band, FROST, 0.1 + 0.18 * k).strokeCircle(0, 0, R - band / 2);
      g.lineStyle(3, 0xffffff, 0.35 + 0.4 * k).strokeCircle(0, 0, R - band);
      // Snow drifting down through the view.
      const cam = this.cameras.main.worldView;
      const N = this.lowFx ? 10 : 24;
      for (let m = 0; m < N; m++) {
        const u = ((now / 2600) + m * 0.137) % 1;
        o.fillStyle(0xf2fbff, 0.7 * k).fillCircle(cam.x + ((m + 0.5) / N) * cam.width + Math.sin(now / 900 + m) * 12, cam.y + u * cam.height, 1.6 + (m % 3) * 0.6);
      }
    }
  }

  private wanderDraw(now: number): void {
    const w = this.world;
    const e = w.dungeonId === 'ashvents' && w.ventMove === 'wander' && w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
    const vents = e?.alive && e.kind === 'ysmeret' ? w.telegraphs.filter((t) => t.alive && t.kind === 'soak' && t.owner === -2) : [];
    if (!vents.length) { this.wanderGfx?.clear(); return; }
    if (!this.wanderGfx) this.wanderGfx = this.add.graphics().setDepth(1.9);
    const g = this.wanderGfx.clear();
    const vr = YSMERET.ventRadius;
    for (const t of vents) {
      const R = Math.hypot(t.x - e!.x, t.y - e!.y);
      if (R < 1) continue;
      const a0 = Math.atan2(t.y - e!.y, t.x - e!.x);
      // The sim turns them by a growing angle: forward is +a (clockwise on screen).
      const step = 0.07;
      for (let i = 0; i < 8; i++) {
        g.lineStyle(vr * 1.3, SOAK, 0.16 * (1 - i / 8)).beginPath().arc(e!.x, e!.y, R, a0 - (i + 1) * step - vr / R * 0.4, a0 - i * step - vr / R * 0.4, false).strokePath();
      }
      const n = this.lowFx ? 2 : 3;
      for (let k = 0; k < n; k++) {
        const u = ((now / 700) + k / n) % 1;
        const a = a0 + (vr + 14) / R + u * 0.42;
        const cx = e!.x + Math.cos(a) * R, cy = e!.y + Math.sin(a) * R;
        const tx = -Math.sin(a), ty = Math.cos(a), nx = Math.cos(a), ny = Math.sin(a);
        const al = 0.8 * Math.sin(u * Math.PI);
        g.lineStyle(3.5, SOAK, al).beginPath().moveTo(cx - tx * 7 + nx * 10, cy - ty * 7 + ny * 10).lineTo(cx + tx * 7, cy + ty * 7).lineTo(cx - tx * 7 - nx * 10, cy - ty * 7 - ny * 10).strokePath();
      }
    }
  }

  /**
   * Phase 12 W2, Oskel's Die Cut: the half-floor 'hit' cone (arc pi) through him reads as a stamping die coming down.
   * Over the doomed half, steel die lines run parallel to the cut and close in on it as the fuse burns; the cut itself is
   * a white-hot blade edge with a danger glow and teeth biting into the doomed side, brighter and faster near the end.
   * Under the main graphics (1.9), so the cone's own red fill and every class ring stay on top.
   */
  private dieCutDraw(now: number): void {
    const w = this.world;
    const t = w.dungeonId === 'pressworks' ? w.telegraphs.find((q) => q.alive && q.shape === 'cone' && q.kind === 'hit' && q.arc >= Math.PI - 1e-3 && q.r >= ARENA * 1.5) : undefined;
    if (!t) { this.dieGfx?.clear(); return; }
    if (!this.dieGfx) this.dieGfx = this.add.graphics().setDepth(1.9);
    const g = this.dieGfx.clear();
    const R = w.arenaR ?? ARENA;
    const u = Math.min(1, t.t / t.dur);
    const nx = Math.cos(t.angle), ny = Math.sin(t.angle); // into the doomed half
    const dx = -ny, dy = nx; // along the cut
    // The chord of the arena circle along the line through p in direction (dx, dy).
    const chord = (px: number, py: number): [number, number, number, number] | null => {
      const b = px * dx + py * dy, c = px * px + py * py - R * R, disc = b * b - c;
      if (disc <= 0) return null;
      const s0 = -b - Math.sqrt(disc), s1 = -b + Math.sqrt(disc);
      return [px + dx * s0, py + dy * s0, px + dx * s1, py + dy * s1];
    };
    // Die lines over the doomed half, sliding toward the edge.
    const gap = 46;
    const slide = ((now / (u > 0.7 ? 160 : 320)) % 1) * gap;
    for (let o = gap - slide; o < R * 2; o += gap) {
      const c = chord(t.x + nx * o, t.y + ny * o);
      if (!c) continue;
      g.lineStyle(6, 0x1a1c22, 0.35).lineBetween(c[0], c[1], c[2], c[3]);
      g.lineStyle(2, 0xc8ccd8, 0.18 + 0.2 * u).lineBetween(c[0], c[1], c[2], c[3]);
    }
    const e = chord(t.x, t.y);
    if (!e) return;
    const pulse = 0.5 + 0.5 * Math.sin(now / (u > 0.7 ? 50 : 110));
    g.lineStyle(16, DANGER, 0.25 + 0.25 * u).lineBetween(e[0], e[1], e[2], e[3]);
    g.lineStyle(5, 0xf4f6ff, 0.6 + 0.35 * pulse * u).lineBetween(e[0], e[1], e[2], e[3]);
    // Teeth along the edge, biting into the doomed side.
    const len = Math.hypot(e[2] - e[0], e[3] - e[1]);
    const step = 30;
    g.fillStyle(0xdfe3ee, 0.55 + 0.3 * u);
    for (let s = step / 2; s < len; s += step) {
      const x = e[0] + dx * s, y = e[1] + dy * s;
      g.fillTriangle(x - dx * 8, y - dy * 8, x + dx * 8, y + dy * 8, x + nx * 13, y + ny * 13);
    }
  }

  private outsurgeDraw(sg: Phaser.GameObjects.Graphics, now: number, pulling: boolean): void {
    const R = this.world.arenaR ?? ARENA;
    const band = OUTSURGE.rimR;
    const r0 = R - band;
    const pulse = pulling ? 1 : 0.55 + 0.35 * Math.sin(now / 120);
    sg.lineStyle(band, 0x0e5060, (pulling ? 0.5 : 0.22) * (0.8 + 0.2 * pulse)).strokeCircle(0, 0, r0 + band / 2);
    // Foam crests: broken arcs rolling outward across the band, brightest mid-way, fading as they reach the rim.
    const crests = this.lowFx ? 2 : 3;
    for (let j = 0; j < crests; j++) {
      const t = (now / (pulling ? 650 : 1300) + j / crests) % 1;
      const rr = r0 + t * band;
      const al = (pulling ? 0.75 : 0.4) * Math.sin(t * Math.PI);
      const segs = 28;
      for (let k = 0; k < segs; k++) {
        const a = (k / segs) * Math.PI * 2 + j * 0.7 + Math.sin(k * 3.7 + j) * 0.05;
        sg.lineStyle(pulling ? 3 : 2, 0xe6fbff, al).beginPath().arc(0, 0, rr, a, a + ((Math.PI * 2) / segs) * 0.62).strokePath();
      }
    }
    // The burn line.
    if (pulling) sg.lineStyle(3, DANGER, 0.85).strokeCircle(0, 0, r0);
    else {
      const dashes = 48;
      for (let k = 0; k < dashes; k++) {
        const a = (k / dashes) * Math.PI * 2 + now / 4000;
        sg.lineStyle(2.5, DANGER, 0.45 + 0.4 * pulse).beginPath().arc(0, 0, r0, a, a + ((Math.PI * 2) / dashes) * 0.55).strokePath();
      }
    }
  }

  /**
   * Phase 12 W1: a raft's wake, two foam lines spreading behind it and bubbles slipping back along them, so the way a
   * raft drifts reads at a glance. Longer in Riptide, when the rafts drift faster.
   */
  private raftWake(sg: Phaser.GameObjects.Graphics, r: { a: number; dir: number; x: number; y: number }, now: number, fast: boolean): void {
    const R = WRACK.raftR;
    // Travel direction: along the ring, the way the raft turns.
    const tx = -Math.sin(r.a) * r.dir, ty = Math.cos(r.a) * r.dir;
    const nx = Math.cos(r.a), ny = Math.sin(r.a);
    const L = R * (fast ? 1.1 : 0.75);
    // White water churned up against the raft's stern.
    const back = Math.atan2(-ty, -tx);
    sg.lineStyle(7, 0x7fd0e0, 0.22).beginPath().arc(r.x, r.y, R + 4, back - 0.85, back + 0.85).strokePath();
    sg.lineStyle(2.5, 0xeafaff, 0.6).beginPath().arc(r.x, r.y, R + 3, back - 0.7, back + 0.7).strokePath();
    for (const side of [-1, 1]) {
      // From the raft's rear quarter, out and back.
      const sx = r.x - tx * R * 0.72 + nx * side * R * 0.69, sy = r.y - ty * R * 0.72 + ny * side * R * 0.69;
      const ex = sx - tx * L + nx * side * L * 0.4, ey = sy - ty * L + ny * side * L * 0.4;
      sg.lineStyle(7, 0x7fd0e0, 0.2).lineBetween(sx, sy, ex, ey);
      sg.lineStyle(2.5, 0xd8f6ff, 0.55).lineBetween(sx, sy, ex, ey);
      if (this.lowFx) continue;
      for (let k = 0; k < 3; k++) {
        const t = (now / (fast ? 500 : 900) + k / 3 + (side > 0 ? 0.17 : 0)) % 1;
        sg.fillStyle(0xeafaff, 0.6 * (1 - t)).fillCircle(sx + (ex - sx) * t, sy + (ey - sy) * t, 2.4 - t);
      }
    }
  }

 
 private coldDraw(g: Phaser.GameObjects.Graphics, now: number): void {
    const w = this.world;
    const boss = w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
    const night = boss?.alive && boss.castId === 'longNight' ? boss.castT / boss.castDur : 0;
    // The floor sinks toward black under the Long Night.
    const dim = 1 - 0.6 * night;
    const fr = ((COLD_FLOOR >> 16) & 255) * dim, fg = ((COLD_FLOOR >> 8) & 255) * dim, fb = (COLD_FLOOR & 255) * (1 - 0.45 * night);
    this.ground.setTint((Math.round(fr) << 16) | (Math.round(fg) << 8) | Math.round(fb));
    // Thin Ice (phase 2): cracks run across the river. A warning is a pale fracture line that
    // widens; open water is a dark band with bright broken edges.
    for (const c of w.cracks) {
      if (!c.alive) continue;
      const dx = Math.cos(c.angle), dy = Math.sin(c.angle);
      const pd = c.x * dx + c.y * dy;
      const disc = pd * pd - (c.x * c.x + c.y * c.y - ARENA * ARENA);
      if (disc <= 0) continue;
      const t0 = -pd - Math.sqrt(disc), t1 = -pd + Math.sqrt(disc);
      const x0 = c.x + dx * t0, y0 = c.y + dy * t0, x1 = c.x + dx * t1, y1 = c.y + dy * t1;
      const nx = -dy, ny = dx;
      const len = t1 - t0;
      // Broken ice never runs ruler-straight: each crack gets its own fixed jag (seeded by its
      // angle, so it holds still frame to frame). The jag stays within a few px of the true edge.
      const n = Math.max(6, Math.round(len / 26));
      const seed = Math.floor(c.angle * 1000) + Math.floor(c.x);
      const jag = (i: number, side: number) => {
        if (i === 0 || i === n) return 0;
        const h = Math.sin((i + 1) * 12.9898 + seed * 0.731 + side * 78.233) * 43758.5453;
        return (h - Math.floor(h) - 0.5) * 9;
      };
      const along = (i: number, off: number, side: number): [number, number] => {
        const at = i / n, o = off + jag(i, side);
        return [x0 + (x1 - x0) * at + nx * o, y0 + (y1 - y0) * at + ny * o];
      };
      const edge = (off: number, side: number) => {
        g.beginPath();
        for (let i = 0; i <= n; i++) { const [px, py] = along(i, off, side); if (i) g.lineTo(px, py); else g.moveTo(px, py); }
        g.strokePath();
      };
      const hw = COLD.crackHalfW;
      if (c.t < COLD.crackWarn) {
        const f = c.t / COLD.crackWarn;
        const flick = 0.55 + 0.35 * Math.sin(now / 70);
        // Where the water will open: a faint cold strip at full width, so you know how far to step.
        g.fillStyle(FROST, 0.05 + 0.08 * f).beginPath()
          .moveTo(x0 + nx * hw, y0 + ny * hw).lineTo(x1 + nx * hw, y1 + ny * hw)
          .lineTo(x1 - nx * hw, y1 - ny * hw).lineTo(x0 - nx * hw, y0 - ny * hw).closePath().fillPath();
        g.lineStyle(1, FROST, 0.18 + 0.25 * f);
        edge(hw, 1); edge(-hw, -1);
        // The fracture itself: a jagged bright line that thickens as the ice gives.
        g.lineStyle(2 + 2.5 * f, FROST, flick);
        edge(0, 0);
        g.lineStyle(1, 0xffffff, 0.5 * flick);
        edge(0, 0);
        // Hairline branches either side, reaching out toward the strip's edge as it nears.
        g.lineStyle(1.5, FROST, 0.35 + 0.35 * f);
        for (let i = 1; i < n; i++) {
          const [bx, by] = along(i, 0, 0);
          const sd = (i % 2 ? 1 : -1) * hw * (0.35 + 0.65 * f) * (0.7 + 0.3 * Math.abs(Math.sin(i * 7.1 + seed)));
          const mx = bx + nx * sd * 0.5 + dx * 6, my = by + ny * sd * 0.5 + dy * 6;
          g.beginPath().moveTo(bx, by).lineTo(mx, my).lineTo(bx + nx * sd + dx * 2, by + ny * sd + dy * 2).strokePath();
        }
      } else {
        const left = COLD.crackWarn + COLD.crackOpen - c.t;
        const a = Math.min(1, left / 1.2);
        // Open water: a dark band between broken edges.
        g.fillStyle(0x06121c, 0.84 * a).beginPath();
        for (let i = 0; i <= n; i++) { const [px, py] = along(i, hw, 1); if (i) g.lineTo(px, py); else g.moveTo(px, py); }
        for (let i = n; i >= 0; i--) { const [px, py] = along(i, -hw, -1); g.lineTo(px, py); }
        g.closePath().fillPath();
        // Deeper water down the middle.
        g.fillStyle(0x020a12, 0.5 * a).beginPath()
          .moveTo(x0 + nx * hw * 0.45, y0 + ny * hw * 0.45).lineTo(x1 + nx * hw * 0.45, y1 + ny * hw * 0.45)
          .lineTo(x1 - nx * hw * 0.45, y1 - ny * hw * 0.45).lineTo(x0 - nx * hw * 0.45, y0 - ny * hw * 0.45).closePath().fillPath();
        // The current: short glints drifting along the strip.
        const drift = (now / 1000) * 38;
        g.lineStyle(1.5, 0x9fd8ff, 0.45 * a);
        if (!this.lowFx) for (let k = 0; k < Math.ceil(len / 70); k++) {
          const s = ((k * 70 + drift + (k % 2) * 35) % len + len) % len;
          const o = ((k * 37) % 5 - 2) * hw * 0.22;
          const gx = x0 + dx * s + nx * o, gy = y0 + dy * s + ny * o;
          g.lineBetween(gx, gy, gx + dx * 14, gy + dy * 14);
        }
        // Bright broken ice edges, with a cold shimmer.
        const shim = 0.75 + 0.2 * Math.sin(now / 220);
        g.lineStyle(3, FROST, shim * a);
        edge(hw, 1); edge(-hw, -1);
        g.lineStyle(1, 0xffffff, 0.55 * a);
        edge(hw - 2, 1); edge(-hw + 2, -1);
        // Small floes broken off the edges, bobbing in the water.
        g.fillStyle(0xd8eeff, 0.55 * a);
        if (!this.lowFx) for (let i = 2; i < n - 1; i += 3) {
          const side = i % 2 ? 1 : -1;
          const bob = Math.sin(now / 400 + i) * 2;
          const [fx, fy] = along(i, side * (hw - 9) + bob, side);
          g.fillTriangle(fx - 4, fy - 2, fx + 4, fy - 3, fx + 1, fy + 3);
        }
      }
    }
    // The frost edge: Chill creeps in from the screen's rim, and the Long Night brings it in too.
    let frostOp = night * 0.55;
    let frozenMe = false;
    for (let k = 0; k < w.heroes.length; k++) {
      const q = w.heroData(k).player;
      const light = this.coalLights[k];
      if (q.hp <= 0 || q.coal === undefined) { light?.setVisible(false); continue; }
      const al = k === w.acting ? undefined : this.allies.find((a) => a.hero === k);
      const x = al ? al.img.x : this.player.x;
      const y = al ? al.img.y : this.player.y;
      const r = q.coalR ?? w.coalMaxR;
      if (q.coal > 0) {
        const flick = 1 + 0.025 * Math.sin(now / 90 + k * 2) + 0.015 * Math.sin(now / 37 + k);
        // Brighter while the coal is full, and brighter still against the Long Night.
        light?.setVisible(true).setPosition(x, y).setDisplaySize(r * 2 * flick, r * 2 * flick).setAlpha(Math.min(1, (0.6 + 0.4 * q.coal) * (1 + 0.6 * night)));
        // The edge (design 25 Nov, phone pass): the whole map is about staying inside this light, so its edge must read
        // at 320 px on the darkest floors. A solid warm line over a dark under-stroke, with a pale hot core; it pulses
        // red-orange when the coal runs low. The light itself flickers, so the line stays still: quiet, not busy.
        const low = q.coal < 0.25 ? 0.5 + 0.5 * Math.sin(now / 120) : 0;
        const edge = low ? 0xff5a3a : 0xffb070;
        g.lineStyle(10, 0x000000, 0.32).strokeCircle(x, y, r);
        g.lineStyle(4.5, edge, 0.7 + 0.2 * q.coal + 0.1 * low).strokeCircle(x, y, r);
        g.lineStyle(1.5, low ? 0xffd0c0 : 0xffe8c8, 0.85).strokeCircle(x, y, r);
      } else {
        light?.setVisible(false);
        // Out: a broken cold ring where the light was, slowly turning, so "no light" never reads like a lit edge.
        const n = 20, rot = now / 6000 + k;
        g.lineStyle(9, 0x000000, 0.3).strokeCircle(x, y, r);
        g.lineStyle(3.5, 0xbcd4f0, 0.75);
        for (let d = 0; d < n; d++) {
          const a0 = rot + (d / n) * Math.PI * 2;
          g.beginPath().arc(x, y, r, a0, a0 + (Math.PI * 2) / n * 0.55, false).strokePath();
        }
      }
      if (k !== w.acting) continue;
      // Your coal gauge: an arc under your feet that empties as the coal burns down.
      const gx = x, gy = y + 4, gr = 30;
      const a0 = Math.PI * 0.15, span = Math.PI * 0.7;
      g.lineStyle(5, 0x000000, 0.45).beginPath().arc(gx, gy, gr, a0, a0 + span, false).strokePath();
      if (q.coal > 0) g.lineStyle(3, q.coal < 0.25 ? 0xff5a3a : 0xffb347, 0.95).beginPath().arc(gx, gy, gr, a0 + span * (1 - q.coal), a0 + span, false).strokePath();
      // Chill pips: five frost diamonds under the gauge, filling as the cold gets in.
      const chill = q.chill ?? 0;
      if (chill > 0.05) {
        const frozen = chill >= COLD.frozenAt;
        for (let c = 0; c < COLD.frozenAt; c++) {
          const cx = gx + (c - 2) * 11;
          const cy = gy + gr + 10;
          const fill = Math.max(0, Math.min(1, chill - c));
          const dia = (h: number, hw: number) => g.fillTriangle(cx, cy - h, cx + hw, cy, cx - hw, cy).fillTriangle(cx, cy + h, cx + hw, cy, cx - hw, cy);
          g.fillStyle(0x0b1420, 0.6);
          dia(5, 4);
          if (fill > 0) {
            g.fillStyle(frozen ? 0xffffff : FROST, (frozen ? 0.7 + 0.3 * Math.sin(now / 90) : 0.95) * (0.35 + 0.65 * fill));
            dia(4, 3);
          }
        }
      }
      frostOp = Math.min(1, (chill / COLD.frozenAt) * 0.95 + night * 0.55);
      frozenMe = chill >= COLD.frozenAt;
    }
    // Frost Wardens inside a coal's light: ember cracks glow through the ice and chips flake off.
    const o = this.overFx;
    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i];
      if (!e.alive || e.kind !== 'frostWarden') continue;
      const s = this.enemySprites[i];
      if (!s?.visible) continue;
      const r = e.def.radius;
      if (this.coalWarmth(e.x, e.y, r) <= 0) continue;
      const pulse = 0.55 + 0.35 * Math.sin(now / 110 + i);
      const cx = s.x, cy = s.y - r * 0.2;
      for (let c = 0; c < 4; c++) {
        let a = ((i * 2.399 + c * 1.571) % (Math.PI * 2));
        let lx = cx, ly = cy;
        o.lineStyle(2.5, 0xffb347, pulse).beginPath().moveTo(lx, ly);
        for (let seg = 0; seg < 3; seg++) {
          a += (seg % 2 ? 0.6 : -0.5);
          lx += Math.cos(a) * r * 0.32;
          ly += Math.sin(a) * r * 0.32;
          o.lineTo(lx, ly);
        }
        o.strokePath();
      }
      o.lineStyle(3, COAL, 0.25 + 0.2 * pulse).strokeCircle(s.x, s.y - r * 0.1, r + 6);
      if (!this.lowFx && Math.random() < 0.12) this.emit(this.fx, 'spark', undefined, cx + (Math.random() - 0.5) * r, cy, 0.6, { tint: FROST, vx: (Math.random() - 0.5) * 70, vy: -60 - Math.random() * 40, drag: 0.94, sx0: 1.4, sx1: 0.4 });
    }
    if (this.frost) {
      this.frost.style.opacity = frostOp.toFixed(3);
      this.frost.classList.toggle('frozen', frozenMe);
    }
  }

  /** Frost Lace: a six-fold lace of ice turns inside the ring, and a thread runs back to its Weaver. */
  private laceMark(g: Phaser.GameObjects.Graphics, t: World['telegraphs'][number], f: number, now: number): void {
    const wv = this.world.enemies[t.owner];
    const a = 0.45 + 0.45 * f;
    const rot = now / 2500;
    g.lineStyle(2, FROST, a);
    for (let k = 0; k < 6; k++) {
      const ang = rot + (k / 6) * Math.PI * 2;
      const c = Math.cos(ang), sn = Math.sin(ang);
      const L = t.r * 0.82;
      g.lineBetween(t.x, t.y, t.x + c * L, t.y + sn * L);
      for (const at of [0.45, 0.7]) {
        const bx = t.x + c * L * at, by = t.y + sn * L * at;
        const bl = L * (at === 0.45 ? 0.22 : 0.16);
        for (const side of [-1, 1]) {
          const b = ang + side * 0.7;
          g.lineBetween(bx, by, bx + Math.cos(b) * bl, by + Math.sin(b) * bl);
        }
      }
    }
    g.fillStyle(FROST, 0.5 * a).fillCircle(t.x, t.y, 5);
    if (wv?.alive) {
      // A dashed thread of frost from the Weaver's hands to the ring.
      const dx = t.x - wv.x, dy = t.y - wv.y;
      const d = Math.hypot(dx, dy) || 1;
      const n = Math.floor(d / 18);
      g.lineStyle(2, FROST, 0.5);
      const off = (now / 60) % 18;
      for (let k = 0; k < n; k++) {
        const s0 = (k * 18 + off) / d, s1 = Math.min(1, (k * 18 + off + 9) / d);
        if (s0 >= 1) break;
        g.lineBetween(wv.x + dx * s0, wv.y + dy * s0, wv.x + dx * s1, wv.y + dy * s1);
      }
    }
  }

  /**
   * Nhevra's wind-ups. Snuff: dark tendrils reach from her to every hero, and a dashed ring
   * shows how far each coal's light will shrink if it lands. Long Night: her blue flame swells
   * (the floor darkening is in coldDraw).
   */
  private nhevraCast(g: Phaser.GameObjects.Graphics, e: World['enemies'][number], now: number): void {
    const w = this.world;
    const f = e.castT / e.castDur;
    if (e.castId === 'snuff') {
      for (let k = 0; k < w.heroes.length; k++) {
        const q = w.heroData(k).player;
        if (q.hp <= 0) continue;
        // A wavy tendril, reaching further as the cast fills.
        const dx = q.x - e.x, dy = q.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const nx = -dy / d, ny = dx / d;
        const steps = 16;
        for (const [wd, col, al] of [[9, 0x6a86b8, 0.35], [4, 0x0d1424, 0.85]] as const) {
          g.lineStyle(wd, col, al * (0.5 + 0.5 * f)).beginPath().moveTo(e.x, e.y);
          for (let s = 1; s <= steps * f; s++) {
            const u = s / steps;
            const wob = Math.sin(u * 9 - now / 120 + k) * 14 * (1 - u * 0.5);
            g.lineTo(e.x + dx * u + nx * wob, e.y + dy * u + ny * wob);
          }
          g.strokePath();
        }
        if (q.coal) {
          const after = COLD.minR + (w.coalMaxR - COLD.minR) * Math.max(0, q.coal - COLD.snuffCut);
          g.lineStyle(2, 0x6a86b8, 0.4 + 0.5 * f).strokeCircle(q.x, q.y, after);
        }
      }
      g.lineStyle(3, 0x6a86b8, 0.6).strokeCircle(e.x, e.y, e.def.radius + 10 + (1 - f) * 40);
    } else if (e.castId === 'longNight') {
      const pulse = 0.5 + 0.5 * Math.sin(now / 80);
      g.fillStyle(FROST, 0.08 + 0.12 * f).fillCircle(e.x, e.y, e.def.radius + 20 + f * 60);
      g.lineStyle(4, FROST, 0.5 + 0.4 * pulse).strokeCircle(e.x, e.y, e.def.radius + 20 + f * 60);
    }
  }

  /**
   * The Pressworks' Downstroke: a steel stamping plate with a hazard-striped rim inside the gold soak circle, and the
   * press head's square shadow closing down onto it, so it reads as "a press comes down here", not an Ashvents vent.
   * Over it, a badge: a tick while someone who isn't Pressed stands on it, a cross when a Pressed hero is on it (they
   * would be crushed and don't count), "!" when nobody is. A Pressed hero on the plate gets a red warning ring.
   */
  /**
   * OSKELV2 (design, oskel-v2.md): the running press bed, on the floor graphics so 3D shows it through the floor bridge.
   * - Chevron streaks over the whole floor drift the way the belt carries (osDir) at its speed, so the motion reads.
   * - The crush line: a red band on the downstream 90 degrees of rim, 30 deep, with press teeth along its inner edge.
   * - The 1.5 s before a flip: big white arrows the new way through the middle, and the next crush line outlined.
   */
  private oskelBelt(g: Phaser.GameObjects.Graphics, now: number): void {
    const w = this.world, R = w.arenaR ?? ARENA;
    const dir = w.osDir, cx = Math.cos(dir), cy = Math.sin(dir), nx = -cy, ny = cx;
    const fast = w.osStage === 3;
    const speed = fast ? OSKELV2.belt3 : OSKELV2.belt;
    const flipping = w.osFlipT > 0;
    // Streaks: rows of chevrons across the belt, sliding downstream. Inside the rim only.
    const gap = 80, off = ((w.time * speed) % gap + gap) % gap, ch = 24;
    g.lineStyle(6, 0xf0c66a, flipping ? 0.15 : fast ? 0.6 : 0.5);
    for (let a = -R; a <= R; a += gap) {
      for (let b = -R + gap / 2; b <= R; b += gap) {
        const u = a + off, x = cx * u + nx * b, y = cy * u + ny * b;
        if (x * x + y * y > (R - 46) * (R - 46)) continue;
        g.lineBetween(x - cx * ch + nx * ch, y - cy * ch + ny * ch, x, y);
        g.lineBetween(x, y, x - cx * ch - nx * ch, y - cy * ch - ny * ch);
      }
    }
    // The crush line, and the next one while a flip is due.
    const band = (d: number, fillA: number, edgeA: number, teeth: boolean): void => {
      const h = OSKELV2.arc / 2, n = 18, r0 = R - OSKELV2.depth, pts: Phaser.Math.Vector2[] = [];
      for (let k = 0; k <= n; k++) { const t = d - h + (2 * h * k) / n; pts.push(new Phaser.Math.Vector2(Math.cos(t) * R, Math.sin(t) * R)); }
      for (let k = n; k >= 0; k--) { const t = d - h + (2 * h * k) / n; pts.push(new Phaser.Math.Vector2(Math.cos(t) * r0, Math.sin(t) * r0)); }
      if (fillA > 0) g.fillStyle(DANGER, fillA).fillPoints(pts, true);
      g.lineStyle(3, DANGER, edgeA);
      g.beginPath(); g.arc(0, 0, r0, d - h, d + h); g.strokePath();
      if (!teeth) return;
      // Press teeth: short spikes pointing inward along the band's inner edge.
      g.fillStyle(0xff8a8a, edgeA * 0.9);
      for (let k = 0; k < 9; k++) {
        const t = d - h + (2 * h * (k + 0.5)) / 9, c = Math.cos(t), s = Math.sin(t), tc = Math.cos(t + 0.035), ts = Math.sin(t + 0.035), bc = Math.cos(t - 0.035), bs = Math.sin(t - 0.035);
        g.fillTriangle(bc * r0, bs * r0, tc * r0, ts * r0, c * (r0 - 14), s * (r0 - 14));
      }
    };
    const pulse = 0.5 + 0.5 * Math.sin(now / 160);
    band(dir, 0.3 + 0.12 * pulse, 0.85, true);
    // The crush line off screen (or the next one, while a flip is due) gets a red arrow at the edge of the view.
    const next = flipping ? dir + Math.PI : dir, er = R - OSKELV2.depth / 2;
    this.emptyVents.push({ x: Math.cos(next) * er, y: Math.sin(next) * er, col: DANGER });
    if (flipping) {
      // Never below 0.6, so a still frame (or a glance) always catches it.
      const blink = 0.8 + 0.2 * Math.sin(now / 70);
      band(dir + Math.PI, 0, 0.5 * blink, false);
      // Big arrows the new way, under every living hero (QA's phone check, 25 Nov: the party fights near Oskel and
      // the rim, so arrows through the middle of the floor were usually off screen).
      const ux = -cx, uy = -cy;
      const arrow = (px: number, py: number, L: number) => g.fillTriangle(px + ux * L, py + uy * L, px - ux * L * 0.4 + nx * L, py - uy * L * 0.4 + ny * L, px - ux * L * 0.4 - nx * L, py - uy * L * 0.4 - ny * L);
      for (let k = 0; k < w.heroes.length; k++) {
        const q = w.heroData(k).player;
        if (q.hp <= 0) continue;
        // A dark edge under each white arrow, so it reads on the pale 3D press bed too.
        for (const d of [-58, 58]) {
          const px = q.x + ux * d, py = q.y + uy * d;
          g.fillStyle(0x000000, 0.5 * blink); arrow(px - ux * 3, py - uy * 3, 46);
          g.fillStyle(0xffffff, 0.9 * blink); arrow(px, py, 38);
        }
      }
    }
  }

  private pressMark(g: Phaser.GameObjects.Graphics, t: World['telegraphs'][number], f: number, now: number): void {
    const w = this.world;
    const o = this.overFx;
    let ok = 0;
    let crushed = false;
    for (let k = 0; k < w.heroes.length; k++) {
      const q = w.heroData(k).player;
      if (q.hp <= 0 || (q.x - t.x) ** 2 + (q.y - t.y) ** 2 > t.r * t.r) continue;
      if ((q.pressedT ?? 0) > 0) {
        crushed = true;
        const blink = 0.5 + 0.5 * Math.sin(now / 70);
        o.lineStyle(3, DANGER, 0.5 + 0.5 * blink).strokeCircle(q.x, q.y + 6, 24);
      } else ok++;
    }
    // The press head's shadow, closing in and darkening as it comes down.
    const sh = t.r * (1.5 - 0.5 * f);
    g.fillStyle(0x000000, 0.12 + 0.3 * f).fillRoundedRect(t.x - sh / 2 * 1.2, t.y - sh / 2 * 0.9, sh * 1.2, sh * 0.9, 8);
    // The plate: dark steel, a striped rim and a rivet in each corner.
    const pw = t.r * 1.15;
    const ph = t.r * 0.85;
    g.fillStyle(0x4a524a, 0.7).fillRect(t.x - pw / 2, t.y - ph / 2, pw, ph);
    g.lineStyle(5, 0xf2c230, 0.9).strokeRect(t.x - pw / 2, t.y - ph / 2, pw, ph);
    g.lineStyle(2.5, 0x16120c, 0.85);
    const dash = (x1: number, y1: number, x2: number, y2: number) => {
      const n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 11));
      for (let k = 0; k < n; k++) {
        const x = x1 + ((x2 - x1) * (k + 0.5)) / n;
        const y = y1 + ((y2 - y1) * (k + 0.5)) / n;
        g.lineBetween(x - 2.5, y + 2.5, x + 2.5, y - 2.5);
      }
    };
    const L = t.x - pw / 2, R = t.x + pw / 2, T = t.y - ph / 2, B = t.y + ph / 2;
    dash(L, T, R, T); dash(L, B, R, B); dash(L, T, L, B); dash(R, T, R, B);
    g.fillStyle(0xd8e0d4, 0.9);
    for (const [x, y] of [[L + 8, T + 8], [R - 8, T + 8], [L + 8, B - 8], [R - 8, B - 8]]) g.fillCircle(x, y, 2.6);
    if (!ok) this.emptyVents.push({ x: t.x, y: t.y });
    // The badge over the circle.
    const bx = t.x;
    const by = t.y - t.r - 16;
    const blink = 0.5 + 0.5 * Math.sin(now / (f > 0.6 ? 60 : 140));
    if (crushed) {
      o.fillStyle(0x200a0e, 0.85).fillCircle(bx, by, 11);
      o.lineStyle(2, DANGER, 0.6 + 0.4 * blink).strokeCircle(bx, by, 11);
      o.lineStyle(3, DANGER, 1).lineBetween(bx - 5, by - 5, bx + 5, by + 5).lineBetween(bx - 5, by + 5, bx + 5, by - 5);
    } else if (ok) {
      o.lineStyle(4, SOAK, 0.95).strokeCircle(t.x, t.y, t.r);
      o.fillStyle(0x10200f, 0.85).fillCircle(bx, by, 11);
      o.lineStyle(2, 0x9fe8a8, 1).strokeCircle(bx, by, 11);
      o.lineStyle(3, 0x9fe8a8, 1).beginPath().moveTo(bx - 5, by).lineTo(bx - 1, by + 4).lineTo(bx + 6, by - 4).strokePath();
    } else {
      o.fillStyle(0x200a0e, 0.85).fillCircle(bx, by, 11);
      o.lineStyle(2, DANGER, 0.6 + 0.4 * blink).strokeCircle(bx, by, 11);
      o.fillStyle(DANGER, 1).fillRect(bx - 1.5, by - 7, 3, 9).fillRect(bx - 1.5, by + 4, 3, 3);
    }
  }

  /** Oskel's Rivets: a domed rivet drops onto each ring's middle, its shadow growing under it as it falls. */
  private rivetMark(t: World['telegraphs'][number], f: number): void {
    const o = this.overFx;
    this.gfx.fillStyle(0x000000, 0.2 + 0.35 * f).fillEllipse(t.x, t.y + 4, 10 + 14 * f, 4 + 6 * f);
    const ry = t.y - (1 - f) * (1 - f) * 140;
    o.fillStyle(0x6a4a1c, 1).fillRect(t.x - 2.5, ry - 2, 5, 10);
    o.fillStyle(0xd8a850, 1).fillEllipse(t.x, ry - 3, 18, 10);
    o.fillStyle(0xf8dc94, 0.9).fillEllipse(t.x - 3, ry - 5, 6, 3);
    o.lineStyle(1.5, 0x1a1008, 0.9).strokeEllipse(t.x, ry - 3, 18, 10);
  }

  /** Oskel's Stamp: a hazard-striped die drops onto the tank, with a closing reticle and a darkening shadow. */
  private stampMark(g: Phaser.GameObjects.Graphics, e: World['enemies'][number], now: number): void {
    const w = this.world;
    const f = Math.min(1, e.castT / e.castDur);
    const t = w.heroData(w.stampOn).player;
    const o = this.overFx;
    const close = 0.6 + 0.4 * Math.sin(now / (f > 0.75 ? 40 : 90));
    g.fillStyle(0x000000, 0.25 + 0.35 * f).fillRect(t.x - (20 + 22 * f), t.y + 12, 40 + 44 * f, 10 + 10 * f);
    const r = 100 - 52 * f;
    // The reticle is a floor mark: on the main graphics, so the floor bridge shows it in 3D (the die is oskel3d.ts there).
    g.lineStyle(3, DANGER, 0.85 * close).strokeRect(t.x - r, t.y - r * 0.8, r * 2, r * 1.6);
    const dy = t.y - 50 - (1 - f) * (1 - f) * 150;
    o.fillStyle(0x5a645a, 0.97).fillRect(t.x - 24, dy - 12, 48, 24);
    o.fillStyle(0xf2c230, 1).fillRect(t.x - 23, dy + 5, 46, 6);
    o.lineStyle(2.5, 0x16120c, 1);
    for (let x = -20; x <= 18; x += 7) o.lineBetween(t.x + x, dy + 11, t.x + x + 5, dy + 5);
    o.lineStyle(2, 0x0c0506, 1).strokeRect(t.x - 24, dy - 12, 48, 24);
    o.fillStyle(0xd8e0d4, 1).fillCircle(t.x - 18, dy - 5, 2).fillCircle(t.x + 18, dy - 5, 2);
    o.fillStyle(0xe8eee6, 0.95).fillRect(t.x - 4, dy - 40, 8, 28);
    o.lineStyle(1.5, 0x0c0506, 1).strokeRect(t.x - 4, dy - 40, 8, 28);
  }

  /** A Pressed hero's mark: a small red plate with a press-down glyph, ringed by the time left (`k`, 1 to 0). */
  private pressedMark(x: number, y: number, k: number): void {
    const o = this.overFx;
    o.fillStyle(0x200a0e, 0.9).fillCircle(x, y, 10);
    o.lineStyle(2, 0x5a2028, 0.9).strokeCircle(x, y, 10);
    o.lineStyle(2.5, DANGER, 1).beginPath().arc(x, y, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, k)), false).strokePath();
    o.fillStyle(DANGER, 1).fillRect(x - 5, y - 6, 10, 3).fillRect(x - 1.25, y - 3, 2.5, 5);
    o.fillTriangle(x - 4, y + 1, x + 4, y + 1, x, y + 5);
    o.fillRect(x - 5, y + 5, 10, 1.6);
  }

  private ventMark(g: Phaser.GameObjects.Graphics, t: World['telegraphs'][number], f: number, now: number): void {
    const w = this.world;
    const o = this.overFx;
    let covered = false;
    for (let k = 0; k < w.heroes.length && !covered; k++) {
      const q = w.heroData(k).player;
      if (q.hp > 0 && (q.x - t.x) ** 2 + (q.y - t.y) ** 2 <= t.r * t.r) covered = true;
    }
    // The grate: dark bars over a glowing mouth.
    const gr = t.r * 0.42;
    g.fillStyle(0xff8a3d, 0.35 + 0.25 * f).fillCircle(t.x, t.y, gr);
    g.lineStyle(4, 0x1a0e0a, 0.9);
    for (let b = -2; b <= 2; b++) {
      const x = t.x + b * gr * 0.4;
      const h = Math.sqrt(Math.max(0, gr * gr - (b * gr * 0.4) ** 2));
      g.lineBetween(x, t.y - h, x, t.y + h);
    }
    g.lineStyle(3, 0x1a0e0a, 0.9).strokeCircle(t.x, t.y, gr);
    // Flame licking up through it, taller as the vent gets ready to blow.
    if (!this.lowFx && Math.random() < 0.3 + 0.4 * f) {
      this.emit(this.fx, 'spark', undefined, t.x + (Math.random() - 0.5) * gr * 1.4, t.y, 0.6, { tint: SOAK, vx: (Math.random() - 0.5) * 16, vy: -60 - 120 * f, drag: 0.97, sx0: 1.8, sx1: 0.3 });
    }
    // Covered or not.
    const bx = t.x;
    const by = t.y - t.r - 16;
    if (!covered) this.emptyVents.push({ x: t.x, y: t.y });
    // The covered gold ring and an empty vent's red dashes are floor marks (main graphics, so the bridge shows them in
    // 3D); the badge over the vent stays above the sprites, and the 3D overlay draws its own (drawLabels3d).
    if (covered) {
      g.lineStyle(4, SOAK, 0.95).strokeCircle(t.x, t.y, t.r);
      o.fillStyle(0x10200f, 0.85).fillCircle(bx, by, 11);
      o.lineStyle(2, 0x9fe8a8, 1).strokeCircle(bx, by, 11);
      o.lineStyle(3, 0x9fe8a8, 1).beginPath().moveTo(bx - 5, by).lineTo(bx - 1, by + 4).lineTo(bx + 6, by - 4).strokePath();
    } else {
      const blink = 0.5 + 0.5 * Math.sin(now / (f > 0.6 ? 60 : 140));
      g.lineStyle(3, DANGER, 0.4 + 0.5 * blink);
      for (let d = 0; d < 16; d++) {
        const a0 = (d * Math.PI * 2) / 16 - now / 2000;
        g.beginPath().arc(t.x, t.y, t.r + 8, a0, a0 + 0.22, false).strokePath();
      }
      o.fillStyle(0x200a0e, 0.85).fillCircle(bx, by, 11);
      o.lineStyle(2, DANGER, 0.6 + 0.4 * blink).strokeCircle(bx, by, 11);
      o.fillStyle(DANGER, 1).fillRect(bx - 1.5, by - 7, 3, 9).fillRect(bx - 1.5, by + 4, 3, 3);
    }
  }

  /**
   * YSMERETV2 stage 2, "Keep a hero on each flame": a gold ring (stand here, as her vents were) of the flare reach round
   * each flame, centred on the flame itself since that is where the sim measures. Covered, it is a calm gold ring. Left
   * alone, it turns red and beats, and a red-orange fire spreads out from the flame to the ring as ysAway runs to the
   * flare (away / flareAfter), so the build-up is plain from across the room. On the main graphics (depth 2), so the
   * floor bridge lays it on the 3D floor too, at no draw call. An uncovered flame off screen gets the empty-vent arrow.
   */
  private ysFlamesDraw(g: Phaser.GameObjects.Graphics, now: number): void {
    const w = this.world;
    const R = YSMERETV2.flareR;
    for (const [j, away] of [[w.ysF0, w.ysAway0], [w.ysF1, w.ysAway1]] as const) {
      const f = j >= 0 ? w.enemies[j] : undefined;
      if (!f?.alive || f.kind !== 'ysmeret') continue;
      let covered = false;
      for (let k = 0; k < w.heroes.length && !covered; k++) {
        const q = w.heroData(k).player;
        if (q.hp > 0 && (q.x - f.x) ** 2 + (q.y - f.y) ** 2 < R * R) covered = true;
      }
      if (covered) {
        g.fillStyle(SOAK, 0.1).fillCircle(f.x, f.y, R);
        g.lineStyle(5, SOAK, 0.9).strokeCircle(f.x, f.y, R);
        continue;
      }
      const k = Math.min(1, away / YSMERETV2.flareAfter);
      const beat = 0.5 + 0.5 * Math.sin(now / (110 - 70 * k));
      g.fillStyle(DANGER, 0.08).fillCircle(f.x, f.y, R);
      // The fire spreading from the flame: a hot core and a red front that reaches the ring as it flares.
      const front = R * (0.25 + 0.75 * k);
      g.fillStyle(0xff6a2a, 0.22 + 0.2 * k).fillCircle(f.x, f.y, front);
      g.fillStyle(0xffc070, 0.25 + 0.35 * k * beat).fillCircle(f.x, f.y, front * 0.45);
      g.lineStyle(3, 0xff6a2a, 0.6 + 0.4 * beat).strokeCircle(f.x, f.y, front);
      // The ring itself, red and broken, turning, brighter as it nears.
      g.lineStyle(5, DANGER, 0.55 + 0.45 * beat);
      for (let d = 0; d < 16; d++) {
        const a0 = (d * Math.PI * 2) / 16 + now / 1600;
        g.beginPath().arc(f.x, f.y, R, a0, a0 + 0.26, false).strokePath();
      }
      this.emptyVents.push({ x: f.x, y: f.y });
    }
  }

  /** Ysmeret's wind-ups: Scatter Embers rings every hero, Bellow Slam draws both flames to the tank. */
  private ysmeretCast(g: Phaser.GameObjects.Graphics, e: World['enemies'][number], now: number): void {
    const w = this.world;
    const f = Math.min(1, e.castT / e.castDur);
    // In 3D the main graphics (the floor bridge) carries these; overFx is covered there. 2D keeps them over the sprites.
    const o = this.bridge ? g : this.overFx;
    if (e.castId === 'scatter') {
      // Each living hero carries an ember ring the size of their burst. Two rings that
      // overlap turn red and are tied together, so a stacked pair can see the problem.
      const R = YSMERET.scatterRadius;
      const up: { x: number; y: number }[] = [];
      for (let k = 0; k < w.heroes.length; k++) {
        const q = w.heroData(k).player;
        if (q.hp > 0) up.push({ x: q.x, y: q.y });
      }
      const close = new Set<number>();
      for (let a = 0; a < up.length; a++) for (let b = a + 1; b < up.length; b++) {
        if ((up[a].x - up[b].x) ** 2 + (up[a].y - up[b].y) ** 2 <= R * R) {
          close.add(a); close.add(b);
          o.lineStyle(3, DANGER, 0.6 + 0.4 * Math.sin(now / 60)).lineBetween(up[a].x, up[a].y, up[b].x, up[b].y);
        }
      }
      const flick = f > 0.7 ? 0.5 + 0.5 * Math.sin(now / 40) : 1;
      up.forEach((p, k) => {
        const col = close.has(k) ? DANGER : 0xff8a5c;
        g.fillStyle(col, 0.08 + 0.12 * f).fillCircle(p.x, p.y, R);
        g.lineStyle(3, col, 0.85 * flick).strokeCircle(p.x, p.y, R);
        // The fuse: an arc closing around the ring.
        g.lineStyle(5, 0xffe0c8, 0.9).beginPath().arc(p.x, p.y, R - 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f, false).strokePath();
        // Embers circling the hero.
        for (let m = 0; m < 3; m++) {
          const a = now / 300 + (m * Math.PI * 2) / 3;
          o.fillStyle(0xffc0a0, 0.9).fillCircle(p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 12 - 8, 3);
        }
      });
    } else if (e.castId === 'bellowSlam') {
      // Both flames stream from Ysmeret to the tank, and a double ring closes on them.
      const t = w.heroData(w.bellowSlamTarget).player;
      const dx = t.x - e.x;
      const dy = t.y - e.y;
      const L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L;
      const ny = dx / L;
      for (const [side, col] of [[1, SOAK], [-1, 0xff6b8a]] as const) {
        const bend = 50 * side * (1 - f);
        const pts: Phaser.Math.Vector2[] = [];
        for (let k = 0; k <= 12; k++) {
          const u = k / 12;
          const off = Math.sin(u * Math.PI) * bend;
          pts.push(new Phaser.Math.Vector2(e.x + dx * u + nx * off, e.y + dy * u + ny * off));
        }
        g.lineStyle(4 + 4 * f, col, 0.35 + 0.5 * f).strokePoints(pts, false);
      }
      const r = 70 - 40 * f;
      const close = 0.6 + 0.4 * Math.sin(now / (f > 0.7 ? 40 : 90));
      o.lineStyle(3, SOAK, 0.9 * close).strokeCircle(t.x, t.y, r);
      o.lineStyle(3, 0xff6b8a, 0.9 * close).strokeCircle(t.x, t.y, r + 8);
      g.fillStyle(0x000000, 0.2 + 0.3 * f).fillEllipse(t.x, t.y + 18, 40 + 30 * f, 14 + 10 * f);
    }
  }

  /** Freeze the sim for a moment (keeps the longer of two stops). */
  private stop(seconds: number): void {
    this.hitStop = Math.max(this.hitStop, seconds);
  }

  private shakeBy(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  /**
   * A boss falls: a freeze, a white-gold flash, the camera leans in, and three
   * shockwaves crack outward while ash rises. The end screen waits for it.
   */
  private bossDeath(kind: string, x: number, y: number): void {
    this.bossFell = true;
    this.stop(0.2);
    this.shakeBy(0.7);
    this.punch = 0.12;
    this.bossFlash = 1;
    const def = ENEMIES[kind as keyof typeof ENEMIES];
    if (def) this.hud.banner(`${def.name.split(',')[0]} falls`, 'The Hollow Tide breaks');
    const gold = 0xffc861;
    for (let wave = 0; wave < 3; wave++) {
      this.time.delayedCall(wave * 260, () => {
        this.ring(x, y, 140 + wave * 110, wave === 1 ? 0xffffff : gold, 0.55);
        this.burst(x, y, 20 - wave * 4);
        this.shakeBy(0.25);
      });
    }
    // Light breaks out of the body in eight rays.
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.random() * 0.3;
      this.addShape({ kind: 'line', x, y, x2: x + Math.cos(a) * 260, y2: y + Math.sin(a) * 260, r: 0, angle: 0, color: gold, life: 0.6 });
    }
    // Ash and embers rise from where it stood (every other one when effects are trimmed).
    for (let k = 0; k < 14; k += this.lowFx ? 2 : 1) {
      this.time.delayedCall(200 + k * 60, () => {
        this.spark(x + (Math.random() - 0.5) * 70, y + (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 40, -120 - Math.random() * 120, 0.9, 1.8);
        if (k % 3 === 0) {
          this.emit(this.smoke, 'puff', undefined, x + (Math.random() - 0.5) * 60, y, 1, { tint: 0x9a8a84, vy: -40, spin: 1, rot: Math.random() * 6, sx0: 1, sx1: 2.2 });
        }
      });
    }
  }

  /** A picked-up bag flies into the nearest hero, shrinking, with a small flash in its rarity colour when it arrives. */
  private lootFly(x: number, y: number, tint: number): void {
    const w = this.world;
    let to = this.heroXY(w.acting), best = Infinity;
    for (let k = 0; k < w.heroes.length; k++) {
      const q = this.heroXY(k), dd = (q.x - x) ** 2 + (q.y - y) ** 2;
      if (dd < best) { best = dd; to = q; }
    }
    const life = 0.22;
    const f = this.emit(this.fx, 'loot', undefined, x, y, life, { vx: (to.x - x) / life, vy: (to.y - 14 - y) / life, sx0: 1, sx1: 0.35 });
    f?.img.setTint(tint).setTintMode(Phaser.TintModes.MULTIPLY);
    this.time.delayedCall(life * 1000, () => this.ring(to.x, to.y - 10, 26, tint, 0.25));
  }

  /** Loot hits the floor: the bag pops in, and the better the rarity the louder the arrival. */
  private dropFlourish(x: number, y: number, rarity: string): void {
    const i = this.world.drops.findIndex((d) => d.alive && Math.abs(d.x - x) < 1 && Math.abs(d.y - y) < 1);
    if (i >= 0) this.dropBorn[i] = this.time.now;
    const c = hex(RARITY[rarity as keyof typeof RARITY].color);
    if (rarity === 'common') return;
    this.ring(x, y, rarity === 'fine' ? 50 : 90, c, 0.45);
    if (rarity === 'fine') return;
    for (let k = 0; k < (this.lowFx ? 4 : 10); k++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const sp = 140 + Math.random() * 120;
      this.spark(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.6, 1.6);
    }
    if (rarity === 'rare') return;
    // Epic and better: a name in the air and a nudge.
    this.floatText(x, y - 50, `${RARITY[rarity as keyof typeof RARITY].name}!`, RARITY[rarity as keyof typeof RARITY].color, 20);
    this.shakeBy(0.15);
    this.punch = Math.max(this.punch, 0.04);
  }

  private floatText(x: number, y: number, s: string, color: string, size: number): void {
    let t = this.floats.find((q) => q.life <= 0);
    if (!t) t = this.floats.reduce((a, b) => (a.life < b.life ? a : b));
    t.txt.setText(s).setPosition(x, y).setVisible(true).setAlpha(1).setColor(color).setFontSize(Math.round(size * this.textK)).setScale(1.7);
    t.age = 0;
    t.vx = (Math.random() - 0.5) * 60;
    t.life = color === '#ffffff' || color === '#ffe08a' ? 0.7 : 1.1;
  }
}
