/**
 * Draws the shared simulation. This scene owns no game rules: it feeds input
 * into `World.step` at a fixed rate and renders interpolated state.
 */
import { OMENS } from '../sim/content/omens';
import { coachLine } from '../sim/content/firstdelve';
import { CoopSession, SNAP_SECONDS, cleanLooks } from './net/coop';
import { applySnapshot } from '../sim/netsync';
import Phaser from 'phaser';
import { TICK, World, Input, SimEvent, WorldOptions, VEIN_TIME, ARENA, GLARE, REVIVE_RADIUS, YSMERET, COLD, SLAG_KIT, ALT_KIT, WRACK, OSKEL } from '../sim/world';
import { ENCOUNTERS } from '../sim/content/dungeon';
import { RARITY } from '../sim/content/items';
import { ENEMIES } from '../sim/content/enemies';
import { AFFIXES } from '../sim/content/named';
import { SET_TUNING } from '../sim/content/sets';
import { GLOWS, TRAILS } from '../sim/content/season';
import { botName, CLASS_ICON, GLOW_MARK, isBotAlly } from './icons';
import { ALT_ABILITIES, CLASSES } from '../sim/content/classes';
import { roleOf } from './net/lobby';
import { display, onDisplayChange, palette, shakeScale, textScale } from './settings';
import { buildTextures, FRAMES, SPRITE_RES } from './textures';
import { BRANCH_COLOR, Hud } from './ui';
import { BRANCH_NAMES, TALENTS, TalentId } from '../sim/content/emberwright';
import { botChoose, botInput } from '../sim/bot';
import { audio } from './audio';
import { pickCue, setFlagsOf } from './audio/cues';

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
 * that tumble off the heels (the Low Ebb).
 */
type TrailStyle = 'motes' | 'sparks' | 'frost' | 'drip' | 'oil' | 'chips';
const TRAIL_STYLE: Record<string, TrailStyle> = { bellowsSparks: 'sparks', rimeDust: 'frost', slagDrips: 'drip', oilSheen: 'oil', raftSplinters: 'chips' };
/** The deeper rime blue a settled crystal turns, so a near-white trail still shows on the Coldmarrow's frost. */
const FROST_SETTLE = 0x7fa6e8;
/** The dim forge red an ember cools to. */
const EMBER_COOL = 0x9a2e1c;
/** The dull crust red a slag drop cools to once it lands. */
const SLAG_CRUST = 0x8a2a2a;
/** The dark wet wood a splinter darkens to as it settles. */
const WET_WOOD = 0x5a3a22;
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
  private emptyVents: { x: number; y: number }[] = [];
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
  private player!: Phaser.GameObjects.Image;
  private aura!: Phaser.GameObjects.Image;
  private enemySprites: Phaser.GameObjects.Image[] = [];
  private enemyKinds: string[] = [];
  private orbSprites: Phaser.GameObjects.Image[] = [];
  private gemSprites: Phaser.GameObjects.Image[] = [];
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
  private bars!: Phaser.GameObjects.Graphics;
  private fx: Fx[] = [];
  /** Ash puffs and dying bodies: normal blending, drawn at body depth. */
  private smoke: Fx[] = [];
  private shadows: Phaser.GameObjects.Image[] = [];
  private playerShadow!: Phaser.GameObjects.Image;
  private enemyFrames: number[] = [];
  private motes: { img: Phaser.GameObjects.Image; ph: number; sp: number }[] = [];
  private ventSprites: Phaser.GameObjects.Image[] = [];
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
    this.pillarSprites = [];
    this.glareFlash = 0;
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
    audio.theme(w.dungeonId === 'crucible' ? 'raid' : w.dungeonId);

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
    // The Wrackline's floor is grey-green harbour water (visuals' pick: at least 21 Delta-E from every other floor), so the pale rafts and the drain read on it.
    else if (w.dungeonId === 'wrackline') this.ground.setTint(0x6e8a80);
    // The Pressworks' floor is oily olive brass (at least 21 Delta-E from every other floor), so the gold Downstroke
    // plate and the red Rivets both read on it.
    else if (w.dungeonId === 'pressworks') this.ground.setTint(0x9aa070);

    w.zones.forEach(() => this.zoneSprites.push(this.add.image(0, 0, 'burn').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(1)));
    w.veins.forEach(() => this.veinSprites.push(this.add.image(0, 0, 'vein').setVisible(false).setDepth(1.5)));
    this.gfx = this.add.graphics().setDepth(2);
    this.overFx = this.add.graphics().setDepth(8.6);
    this.coalLights = [];
    this.laceShown = false;
    // The Coldmarrow: Hearthcoal light is added onto the floor, under every sprite.
    if (w.dungeonId === 'coldmarrow') for (let k = 0; k < w.heroes.length; k++) this.coalLights.push(this.add.image(0, 0, 'coalLight').setDepth(1.2).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
    this.frost = document.getElementById('frost');
    if (this.frost) { this.frost.style.opacity = '0'; this.frost.classList.remove('frozen', 'flash'); }
    w.gems.forEach(() => this.gemSprites.push(this.add.image(0, 0, 'gem').setVisible(false).setDepth(3)));
    w.drops.forEach(() => {
      this.beamSprites.push(this.add.image(0, 0, 'beam').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(3));
      this.dropSprites.push(this.add.image(0, 0, 'loot').setVisible(false).setDepth(3.5));
    });
    w.enemies.forEach(() => {
      this.shadows.push(this.add.image(0, 0, 'shadow').setVisible(false).setDepth(2.5));
      this.enemySprites.push(this.add.image(0, 0, 'ashling', '0').setScale(BASE).setVisible(false).setDepth(4));
      this.enemyKinds.push('ashling');
      this.enemyFrames.push(0);
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
    this.player = this.add.image(0, 0, w.cls === 'emberwright' ? 'player' : w.cls, '0').setScale(BASE).setDepth(6);
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
        img: this.add.image(0, 0, cls === 'emberwright' ? 'player' : cls, '0').setScale(BASE).setDepth(5.9),
        label: this.add.text(0, 0, name, { fontFamily: 'Georgia, serif', fontSize: '12px', fontStyle: 'bold', color: CLASS_ICON[cls].color, stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(9.5),
        tag: look.title ? this.add.text(0, 0, look.title, { fontFamily: 'Georgia, serif', fontSize: '10px', fontStyle: 'italic', color: '#e8d9a8', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(9.5) : undefined,
        glow: ag ? this.glowImage(ag) : undefined,
      });
      // An ally's trail: a smaller pool, since it is somebody else's flourish.
      this.addTrail(j, look.trail, 24);
    }
    w.orbs.forEach(() => this.orbSprites.push(this.add.image(0, 0, 'bolt').setOrigin(0.78, 0.5).setScale(0.7).setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(7)));
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
      this.scale.off('resize', this.layout, this);
      if (this.frost) { this.frost.style.opacity = '0'; this.frost.classList.remove('frozen', 'flash'); }
    });
    this.layout();
    this.cameras.main.centerOn(0, 0);

    this.hud.bindRun({
      onPick: (i) => this.pick(i),
      onPause: () => this.togglePause(),
      onStick: (x, y) => { this.stickVec.x = x; this.stickVec.y = y; },
      onCast: (slot) => this.cast(slot),
    });
    this.hud.showRun(w);
  }

  private layout(): void {
    const { width, height } = this.scale;
    const short = Math.min(width, height);
    // The canvas may be at device resolution (see --dpr in index.html); pick the
    // view from the CSS size so phones and desktops frame the same as before.
    const dpr = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dpr')) || 1;
    const zoom = short / viewFor(short / dpr);
    this.baseZoom = zoom;
    this.cameras.main.setZoom(zoom);
    // Scroll-factor-0 objects still scale with zoom around the screen centre,
    // so size the ground in world units and centre it.
    this.ground.setPosition(width / 2, height / 2).setSize(width / zoom + 4, height / zoom + 4);
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
    if (swap && !this.swapShown) this.hud.banner('Swap tanks!', `The other tank is Seared. Take her with ${w.abilities[3].name}`);
    this.swapShown = swap;
    audio.events(events, {
      cls: w.cls,
      acting: w.acting,
      hp: w.heroes.length > 1 ? w.heroes.map((_, i) => w.heroData(i).player.hp) : undefined,
      boss: w.bossIndex >= 0 ? w.enemies[w.bossIndex]?.kind : undefined,
      anvilOnMe: w.dungeonId === 'hammerdeep' && w.anvilOnMe,
      ebbPull: w.dungeonId === 'wrackline' && w.ebbT > 0,
      sets: setFlagsOf(w.player, (id) => w.setCount(id)),
      listen: { x: w.player.x, half: this.cameras.main.worldView.width / 2 },
      roles: w.heroes.length > 1 ? w.heroes.map((h, i) => roleOf(CLASSES[h.cls].role, w.heroData(i).player.stance)) : undefined,
      revive: w.heroes.length > 1 ? { t: w.heroes.map((_, i) => w.heroData(i).player.reviveT ?? 0), need: w.reviveSeconds, left: w.revivesLeft } : undefined,
    });
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
              this.ring(q.x, q.y, (q.coalR ?? COLD.maxR) * 0.9, 0x6a86b8, 0.45);
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
          if (ev.name === 'Glare') this.hud.banner('Glare!', `Hide behind a pillar${w.dungeonId === 'glarewell' && w.enemies.some((o) => o.alive && o.castId === 'glare' && o.kind === 'lensbearer') ? `, or ${w.abilities[3].name} it` : ''}`);
          else if (ev.name === 'Brand' || ev.name === 'Twin Brand') this.hud.banner(ev.name === 'Twin Brand' ? 'Twin Brand!' : 'Branded!', 'Get clear of pillars and enemies before it bursts');
          else if (ev.name === 'Molten Cataclysm') this.hud.banner('Molten Cataclysm!', `Interrupt it with ${w.abilities[3].name}, or brace for impact`);
          else if (ev.name === 'Anvilfall') this.hud.banner('Anvilfall!', 'A huge hit on its target. Tanks: Anvil Skin or Cooling Shell now. Everyone else: heal them');
          else if (ev.name === 'Choir of Iron') this.hud.banner('Choir of Iron!', 'The whole party is hit. Healers: get ready');
          else if (ev.name === 'Twin Vents') this.hud.banner('Twin Vents!', 'Split up: someone in each gold vent');
          else if (ev.name === 'Downstroke') this.hud.banner('Downstroke!', (w.player.pressedT ?? 0) > 0 ? "You're Pressed: stay out of this one" : 'One hero who is not Pressed stands under the plate. Take turns');
          else if (ev.name === 'Stamp') this.hud.banner('Stamp!', 'A huge hit on its target. Tanks: Anvil Skin or Cooling Shell now');
          else if (ev.name === 'Scatter Embers') this.hud.banner('Scatter Embers!', 'Spread out: keep your ring off everyone else');
          else if (ev.name === 'Snuff') this.hud.banner('Snuff!', `${w.abilities[3].name} it, or every Hearthcoal dims`);
          else if (ev.name === 'Long Night') this.hud.banner('The Long Night!', w.heroes.length > 1 ? "It can't be stopped. Huddle up in the brightest light: every ally close by takes some of the cold" : "It can't be stopped. Get into the brightest light you can");
          else if (ev.name === 'Snuffer Tide') this.hud.banner('Snuffer Tide!', 'Kill the Snuffers before they drink your light');
          else if (ev.name === 'Thin Ice') this.hud.banner('Thin Ice!', "The river cracks. Stay off the open water. She can't move while it's open, and takes more damage");
          else if (ev.name === 'Frost Lace' && !this.laceShown) {
            // Once a fight: the Weaver casts it every few seconds, and its cast bar says the rest.
            this.laceShown = true;
            this.hud.banner('Frost Lace!', `Step out of the ring, or ${w.abilities[3].name} the Weaver`);
          }
          // The Wrackline.
          else if (ev.name === 'The Ebb') this.hud.banner('The Ebb!', 'The water is about to pull. Get on a raft');
          else if (ev.name === 'Sink') this.hud.banner('Sink!', `${w.abilities[3].name} it, or the marked raft goes under`);
          else if (ev.name === 'Call the Shoal') this.hud.banner('Call the Shoal!', "Lurkers swim in. They can't climb onto a raft");
          // The raid: Grandmother Slag.
          else if (ev.name === 'Ladle Pour') this.hud.banner('Ladle Pour!', 'A huge hit on the tank. Healers: heal the Ladle Burn off them');
          else if (ev.name === 'The Pour') this.hud.banner('The Pour!', 'Molten lanes: step out of the red');
          else if (ev.name === 'Crucible Vents') this.hud.banner('Crucible Vents!', 'Split up: someone in each gold vent');
          else if (ev.name === 'Cinder Marks') this.hud.banner('Cinder Marks!', 'Spread out: keep your ring off everyone else');
          else if (ev.name === 'Last Ember') this.hud.banner('Last Ember!', 'She burns everything. Finish her now');
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
          if (w.dungeonId === 'glarewell') {
            if (ev.phase === 2) this.hud.banner('Phase 2: Twin Brand', 'Two Brands in a row. Burst them in the open');
            else this.hud.banner('Phase 3: The pillars fall', 'She cracks a pillar every so often. Save the rest');
          } else if (w.dungeonId === 'crucible') {
            if (ev.phase === 2) this.hud.banner('Phase 2: The Pour', 'Molten lanes and rising slag. Keep moving, healers keep everyone up');
            else this.hud.banner('Phase 3: Last Ember', 'Split up to fill both vents, then spread for the Cinder Marks');
          } else if (w.dungeonId === 'foundry') {
            if (ev.phase === 2) this.hud.banner('Phase 2: Rising Water', `The arena shrinks. ${w.abilities[3].name} her Undertow`);
            else this.hud.banner('Phase 3: Overpressure', 'The vents erupt on their own. Time your kiting');
          } else if (w.dungeonId === 'wrackline') {
            this.hud.banner('Phase 2: Riptide', 'The rafts drift faster and the water pulls harder. Move with them');
          } else if (w.dungeonId === 'coldmarrow') {
            // Thin Ice has its own banner when the first cracks open.
          } else if (ev.phase === 2) this.hud.banner('Phase 2: Ember Acolytes', 'Kill the healers, and stand in the gold circles');
          else this.hud.banner('Phase 3: The kiln cracks', `She casts faster. Keep ${w.abilities[3].name} ready`);
          break;
        case 'soak':
          this.blast(ev.x, ev.y, 70, ev.ok ? SOAK : DANGER);
          if (!ev.ok) this.floatText(ev.x, ev.y, 'Brand missed!', '#ff8aa5', 16);
          break;
        case 'eliteSpawn':
          this.hud.banner('A Cinder Brute approaches', 'Interrupt its Ground Pound. Its death grants a bonus talent');
          break;
        case 'rareSpawn':
          this.hud.banner('Rare: Ashmaw the Glutton', 'Interrupt its Gorge or it heals. Drops rare loot');
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
        case 'bossSpawn':
          this.shake = 0.6;
          break;
        case 'namedSpawn': {
          this.hud.banner(ev.name, `A named foe (${ev.affix}). It carries its own loot.`);
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
          // Phones keep the intro short: the Omens get one line, with details in the pause menu.
          const omens = ev.index === 0 && w.omens.length
            ? (this.hud.compact
              ? ` ${w.omens.length === 1 ? 'Omen' : 'Omens'}: ${w.omens.map((o) => OMENS[o].name).join(', ')} (details in pause).`
              : ` Omens: ${w.omens.map((o) => `${OMENS[o].name} (${OMENS[o].tip.toLowerCase().replace(/\.$/, '')})`).join(', ')}.`)
            : '';
          // L1: the first delve coaches each fight instead of the usual tip. Coach lines, and on phones a first
          // fight that also names its Omens, get the full-length banner so nothing is cut off.
          const coach = w.firstDelve ? coachLine(ev.id, w.abilities[3].name) : undefined;
          this.hud.banner(ev.id === 'worldShadow' && w.worldBoss ? `Shadow of ${w.worldBoss}` : def.name, coach ?? def.tip + omens, !!coach || (this.hud.compact && !!omens));
          break;
        }
        case 'fork':
          this.hud.banner('Choose your path', 'Walk into a gate. The steady fight is taken if you wait.');
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
          // A fallen boss gets its moment before the end screen covers it.
          this.time.delayedCall(this.bossFell ? 1700 : 700, () => this.onEnd(this.world));
          break;
      }
    }
  }

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
    if (this.punch > 0) {
      this.punch = Math.max(0, this.punch - dt * 0.12);
      // The camera lean is part of the shake: only at Full.
      cam.setZoom(this.baseZoom * (1 + (display.shake === 'full' ? this.punch : 0)));
    } else if (cam.zoom !== this.baseZoom) cam.setZoom(this.baseZoom);
    if (this.shake > 0) {
      this.shake -= dt;
      const m = Math.min(1, this.shake) * 10 * shakeScale();
      sx = (Math.random() - 0.5) * m;
      sy = (Math.random() - 0.5) * m;
    }
    cam.centerOn(px + sx, py + sy);
    this.ground.setTilePosition(cam.worldView.x, cam.worldView.y);
    this.ground.setTileScale(1);

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
    }
    this.unstackLabels();
    // A bot's mark rides just left of its name (after the names lift apart), at the name's cap height.
    for (const al of this.allies) {
      if (!al.mark) continue;
      const lb = al.label;
      const s = (lb.displayHeight * 0.78) / 48;
      al.mark.setScale(s).setPosition(lb.x - lb.displayWidth / 2 - 4, lb.y - lb.displayHeight * 0.5).setAlpha(lb.alpha * (w.heroData(al.hero).player.hp <= 0 ? 0.5 : 1));
    }

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
    for (let i = 0; i < w.enemies.length; i++) {
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
      // The world boss shadow is Grandmother Slag's silhouette;
      // Ember Twins alternate palettes by slot so a pair always reads as two.
      // Ysmeret borrows the Kiln Mother's sheet until its own sprite lands.
      const tex = e.kind === 'worldShadow' ? 'slagCrone' : e.kind === 'grandmotherSlag' ? (this.textures.exists('slagCroneRaid') ? 'slagCroneRaid' : 'slagCrone')
        : e.kind === 'slagling' && !this.textures.exists('slagling') ? 'ashling' : e.kind === 'emberTwin' && i % 2 ? 'emberTwinB' : (e.kind === 'ondrel' || e.kind === 'ysmeret') && !this.textures.exists(e.kind) ? 'kilnMother' : e.kind;
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
      s.setVisible(true).setPosition(x, y).setFlipX(!e.def.stationary && x > px).setScale(BASE * k * (1 + hit) * (e.kind === 'worldShadow' ? 1.05 : 1), BASE * k * (1 - hit) * (e.kind === 'worldShadow' ? 1.05 : 1));
      const r = e.def.radius;
      if (cheap && e.def.rank === 'normal') { if (sh.visible) sh.setVisible(false); } else sh.setVisible(true).setPosition(x, y + r * 0.85).setScale((r * 2.5 * k) / 32, (r * 0.9 * k) / 32);
      if (e.kind === 'rift') s.setRotation(now / 900);
      else s.setRotation(e.stunT > 0 ? Math.sin(now / 60) * 0.15 : 0);
      if (!cheap && e.burnT > 0 && Math.random() < 0.03) this.spark(x + (Math.random() - 0.5) * r, y - r * 0.5, 0, -50, 0.5, 1.4);
      // Hit flash: small foes blink solid white; bosses and rares brighten instead, so a
      // big boss being hit nonstop never turns into a white silhouette.
      // Ondrel's iron is near black, so a full-strength screen flash washes it out: give it a softer one.
      if (e.flash > 0) s.setTint(idleRank(e) ? (e.kind === 'ondrel' ? 0x3a2e26 : 0x6a5a4a) : 0xffffff).setTintMode(idleRank(e) ? Phaser.TintModes.SCREEN : Phaser.TintModes.FILL);
      else if (e.stunT > 0) s.setTint(0x8fd8ff).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (e.burnT > 0) s.setTint(0xffa060).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (e.kind === 'frostWarden' && this.coalWarmth(e.x, e.y, r) > 0) s.setTint(0xffc49a).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (e.kind === 'worldShadow') s.setTint(0x8a6cff).setTintMode(Phaser.TintModes.MULTIPLY);
      else s.clearTint();
    }

    for (let i = 0; i < w.orbs.length; i++) {
      const o = w.orbs[i];
      const s = this.orbSprites[i];
      if (!o.alive) { if (s.visible) s.setVisible(false); continue; }
      s.setVisible(true).setPosition(lerp(o.px, o.x), lerp(o.py, o.y)).setRotation(Math.atan2(o.vy, o.vx));
    }
    for (let i = 0; i < w.gems.length; i++) {
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
        if (bag.visible) { bag.setVisible(false); beam.setVisible(false); }
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
    this.overFx.clear();
    if (this.coalLights.length) this.coldDraw(g, now);
    if (w.rafts.length) this.wrackDraw(g, now);
    else if (this.drainImg?.visible) { this.drainImg.setVisible(false); for (const r of this.raftImgs) { r.deck.setVisible(false); r.rim.setVisible(false); } }
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
    for (const al of this.allies) {
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
          if (found) o.lineStyle(3, REVIVE, 0.55 + 0.3 * pulse).lineBetween(rx, ry, x, y);
          // A boss pick-up takes 9 s, so it counts down under the circle.
          if (w.bossUp && !reviveShown) {
            reviveShown = true;
            this.reviveText.setVisible(true).setPosition(x, y + 6 + R + 4).setText(`Reviving ${Math.max(0, w.reviveSeconds * (1 - t)).toFixed(1)}`);
          }
          const a1 = -Math.PI / 2 + t * Math.PI * 2;
          o.lineStyle(6, REVIVE, 0.95).beginPath().arc(x, y + 6, R, -Math.PI / 2, a1, false).strokePath();
          o.fillStyle(0xf2fff0, 1).fillCircle(x + Math.cos(a1) * R, y + 6 + Math.sin(a1) * R, 4.5);
          if (!this.lowFx && Math.random() < 0.35) {
            this.emit(this.fx, 'spark', undefined, x + (Math.random() - 0.5) * 30, y + 10, 0.7, { tint: REVIVE, vx: (Math.random() - 0.5) * 20, vy: -70 - Math.random() * 50, drag: 0.97, sx0: 1.6, sx1: 0.3 });
          }
        } else {
          // A bobbing cross over the body asks for help.
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
        if ((q.sunderT ?? 0) > 0) {
          // Beside the hero (above is their name and health bar).
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
      const R = w.arenaR ?? ARENA;
      const rim = w.dungeonId === 'foundry' ? 0x5ab8ff : w.dungeonId === 'glarewell' ? 0xffe2a0 : w.dungeonId === 'hammerdeep' ? 0xc8d0e0 : w.dungeonId === 'ashvents' ? 0xff9a7a : w.dungeonId === 'coldmarrow' ? FROST : w.dungeonId === 'crucible' ? MOLTEN : w.dungeonId === 'wrackline' ? 0x7fd0e0 : w.dungeonId === 'pressworks' ? 0xf0c66a : 0xff8a3d;
      g.lineStyle(900, 0x070302, 0.82).strokeCircle(0, 0, R + 450);
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
      g.lineStyle(4, rim, 0.55).strokeCircle(0, 0, R);
      g.lineStyle(14, rim, 0.12).strokeCircle(0, 0, R + 6);
      // The Crucible: the arena is a crucible's rim, molten slag slowly breathing just beyond it.
      if (w.dungeonId === 'crucible') g.lineStyle(40, MOLTEN, 0.12 + 0.06 * Math.sin(now / 700)).strokeCircle(0, 0, R + 30);
    }
    // The Glarewell: the floor is lit pale gold, and pillars cast shadow wedges
    // away from the centre lens. The wedges match World.shadowed(), so what you
    // see is where you're safe.
    if (w.pillars.length) g.fillStyle(0xffe2a0, 0.07).fillCircle(0, 0, w.arenaR ?? ARENA);
    this.pillarSprites.forEach((ps, k) => {
      const c = w.pillars[k];
      if (!c) { if (ps.visible) ps.setVisible(false); return; }
      if (!c.cracked) {
        const d = Math.hypot(c.x, c.y) || 1;
        const ux = c.x / d;
        const uy = c.y / d;
        const L = GLARE.shadowLength;
        const w0 = c.r;
        const w1 = c.r + L * GLARE.shadowWiden;
        g.fillStyle(0x06051a, 0.62).lineStyle(2, 0x8a9cff, 0.35).beginPath();
        g.moveTo(c.x - uy * w0, c.y + ux * w0);
        g.lineTo(c.x + ux * L - uy * w1, c.y + uy * L + ux * w1);
        g.lineTo(c.x + ux * L + uy * w1, c.y + uy * L - ux * w1);
        g.lineTo(c.x + uy * w0, c.y - ux * w0);
        g.closePath();
        g.fillPath();
        g.strokePath();
      }
      const fr = c.cracked ? '1' : '0';
      if (ps.frame.name !== fr) ps.setFrame(fr);
      ps.setVisible(true).setPosition(c.x, c.y).setScale((c.r * 2.3) / (64 * SPRITE_RES)).setAlpha(c.cracked ? 0.7 : 1);
    });
    if (w.pillars.length) {
      // The centre lens glows; it brightens while a Glare is coming.
      const glaring = w.enemies.some((o) => o.alive && o.castId === 'glare');
      const a = glaring ? 0.25 + 0.2 * Math.sin(now / 50) : 0.1;
      g.fillStyle(0xfff0c0, a).fillCircle(0, 0, 60);
      g.lineStyle(3, 0xffe2a0, 0.5).strokeCircle(0, 0, 60);
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
    if (this.glareFlash > 0) {
      // Bright enough to sting, faint enough that you can still see the fight.
      this.glareFlash = Math.max(0, this.glareFlash - this.game.loop.delta / 450);
      g.fillStyle(0xfff0c0, 0.55 * this.glareFlash).fillCircle(w.player.x, w.player.y, 2000);
    }
    if (this.bossFlash > 0) {
      this.bossFlash = Math.max(0, this.bossFlash - this.game.loop.delta / 700);
      g.fillStyle(0xfff4dc, 0.6 * this.bossFlash * this.bossFlash).fillCircle(w.player.x, w.player.y, 2000);
    }
    // Maelra's steam vents: iron grates that glow and breathe steam.
    this.ventSprites.forEach((vs, k) => {
      const v = w.vents[k];
      if (!v) { if (vs.visible) vs.setVisible(false); return; }
      const fr = String(Math.floor(now / 160 + k) % 4);
      if (vs.frame.name !== fr) vs.setFrame(fr);
      vs.setVisible(true).setPosition(v.x, v.y).setScale((v.r * 2.25) / (64 * SPRITE_RES)).setAlpha(0.88);
      g.lineStyle(2, 0xbfe6ff, 0.35).strokeCircle(v.x, v.y, v.r);
    });
    if (w.vents.length && now > this.steamAt && !this.lowFx) {
      this.steamAt = now + 140;
      const v = w.vents[Math.floor(Math.random() * w.vents.length)];
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
    for (const t of w.telegraphs) {
      // Once the boss has fallen its last wind-up never lands, so stop drawing it.
      if (!t.alive || this.bossFell) continue;
      const f = Math.min(1, t.t / t.dur);
      const col = t.kind === 'soak' ? SOAK : t.kind === 'bloom' ? BLOOM : DANGER;
      // The edge glows and flickers faster as the strike gets close.
      const flick = f > 0.7 ? 0.5 + 0.5 * Math.sin(now / (f > 0.9 ? 30 : 60)) : 1;
      if (t.shape === 'circle') {
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
        if (t.owner >= 0 && w.enemies[t.owner]?.kind === 'grandmotherSlag') this.pourLane(g, t, f, now);
      }
    }
    if (!soakShown && this.soakText.visible) this.soakText.setVisible(false);
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
    for (const e of w.enemies) {
      if (!e.alive) continue;
      if (e.kind === 'acolyte') {
        // The Kindle beam to the ward pulses while it heals: kill the acolyte to stop it.
        const ward = e.aux2 >= 0 ? w.enemies[e.aux2] : boss;
        if (ward?.alive) {
          const pulse = 0.55 + Math.sin(now / 90) * 0.2;
          g.lineStyle(4, 0x7dffb0, pulse).lineBetween(e.x, e.y, ward.x, ward.y);
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
      if (e.kind === 'ondrel' && e.castId) this.ondrelCast(g, e, w.enemies.indexOf(e), now);
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
      // An ally off screen gets an arrow at the screen edge pointing their way.
      const v = cam.worldView;
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
    // The Ashvents: an empty vent off screen gets a gold arrow at the edge, so nobody misses it.
    for (const ev of this.emptyVents) {
      const v = cam.worldView;
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
      const blink = 0.6 + 0.4 * Math.sin(now / 90);
      b.fillStyle(0x000000, 0.6).fillCircle(ex, ey, sz * 1.25);
      b.lineStyle(2 / cam.zoom, SOAK, blink).strokeCircle(ex, ey, sz * 1.25);
      b.fillStyle(SOAK, blink).fillTriangle(
        ex + Math.cos(a) * sz, ey + Math.sin(a) * sz,
        ex + Math.cos(a + 2.4) * sz * 0.8, ey + Math.sin(a + 2.4) * sz * 0.8,
        ex + Math.cos(a - 2.4) * sz * 0.8, ey + Math.sin(a - 2.4) * sz * 0.8,
      );
    }
    let plate = 0;
    // A pack of the same elite (four Shoal Lurkers round a raft) shows its name once, over the topmost one: the
    // same name printed over each stacks into an unreadable block on a phone. Every one keeps its own health bar.
    const names: { x: number; y: number; text: string; color: string }[] = [];
    for (const e of w.enemies) {
      if (!e.alive || (e.def.rank === 'normal' && !e.def.stationary) || e.def.rank === 'boss') continue;
      if (!onScreen(e.x, e.y)) continue;
      const bw = e.def.rank === 'rare' ? 70 : 56;
      const top = e.y - e.def.radius - 14;
      b.fillStyle(0x000000, 0.6).fillRect(e.x - bw / 2, top, bw, 6);
      b.fillStyle(hex(NAME_COLOR[e.named >= 0 ? 'rare' : e.def.rank]), 1).fillRect(e.x - bw / 2, top, (bw * Math.max(0, e.hp)) / e.maxHp, 6);
      if (e.named >= 0) this.namedMark(g, b, e, top, now);
      if (e.castId) {
        b.fillStyle(0x000000, 0.7).fillRect(e.x - bw / 2, top + 8, bw, 5);
        b.fillStyle(e.interruptible ? 0x8fd8ff : SOAK, 1).fillRect(e.x - bw / 2, top + 8, (bw * e.castT) / e.castDur, 5);
      }
      // Warded: a pale shield segment over the health bar, and a bubble on the body.
      if (e.ward > 0) {
        const wf = Math.min(1, e.ward / e.maxHp);
        b.fillStyle(0xe8f4ff, 0.95).fillRect(e.x - bw / 2, top - 3, bw * Math.min(1, wf * 5), 3);
        g.lineStyle(2, 0xcfe6ff, 0.55 + 0.2 * Math.sin(now / 120)).strokeCircle(e.x, e.y, e.def.radius + 8);
        g.fillStyle(0xcfe6ff, 0.08).fillCircle(e.x, e.y, e.def.radius + 8);
      }
      // C2: a named elite shows its title in the rare colour.
      names.push({ x: e.x, y: top, text: e.named >= 0 ? w.namedName(w.enemies.indexOf(e)) : e.def.name, color: NAME_COLOR[e.named >= 0 ? 'rare' : e.def.rank] });
    }
    names.sort((a, c) => a.y - c.y);
    const shown: typeof names = [];
    for (const n of names) {
      if (shown.some((q) => q.text === n.text && Math.abs(q.x - n.x) < 110 && n.y - q.y < 70)) continue;
      shown.push(n);
      const t = this.plates[plate++];
      if (t) setColorIf(t.setVisible(true).setPosition(n.x, n.y - 2).setText(n.text), n.color);
    }
    for (; plate < this.plates.length; plate++) if (this.plates[plate].visible) this.plates[plate].setVisible(false);

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

  /** A worn trail, if it names a known trail: its motes sit on the floor with the glow, under the
   * telegraph layer (depth 2), so a trail never hides an attack. Each has its own pool, so a busy fight
   * can't steal its motes. */
  private addTrail(hero: number, worn: { id: string; stage: number } | undefined, pool: number): void {
    const def = worn ? TRAILS[worn.id] : undefined;
    if (!def || !(worn!.stage >= 1)) return;
    const fx: Fx[] = [];
    const style = TRAIL_STYLE[def.id] ?? 'motes';
    const tex = style === 'frost' ? 'frostFlake' : style === 'oil' ? 'oilDrop' : style === 'chips' ? 'woodChip' : 'trailMote';
    // Motes and sparks glow (additive). The others blend normally, so what settles on the floor (rime blue, slag crust,
    // an oil slick, wet wood) stays visible instead of fading into it.
    for (let i = 0; i < pool; i++) fx.push(this.newFx(tex, 1.35, style === 'motes' || style === 'sparks'));
    this.trails.push({ hero, color: hex(def.color), stage: Math.min(3, Math.floor(worn!.stage)), fx, acc: 0, style });
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

  /** Death: the body flashes, flattens and fades into a puff of ash. */
  private death(kind: string, x: number, y: number): void {
    const big = kind === 'kilnMother' || kind === 'cinderBrute' || kind === 'ashmaw' || kind === 'husk';
    if (this.textures.exists(kind)) {
      const f = this.emit(this.smoke, kind, '0', x, y, big ? 0.45 : 0.22, { flip: x > this.world.player.x, sx0: BASE * 1.1, sy0: BASE * 0.95, sx1: BASE * 1.35, sy1: BASE * 0.15 });
      f?.img.setTint(0xffd7a0).setTintMode(Phaser.TintModes.FILL);
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
      // A closing reticle in the boss's red.
      const r = 110 - 60 * f;
      o.lineStyle(3, DANGER, 0.85 * close).strokeCircle(t.x, t.y, r);
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + now / 900;
        o.lineBetween(t.x + Math.cos(a) * (r + 6), t.y + Math.sin(a) * (r + 6), t.x + Math.cos(a) * (r + 20), t.y + Math.sin(a) * (r + 20));
      }
      // The anvil itself, falling from above the target.
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
    }
  }

  /** The warmest living Hearthcoal whose light reaches this spot (World.warmthAt, read on the client). */
  private coalWarmth(x: number, y: number, r0 = 0): number {
    const w = this.world;
    let best = 0;
    for (let k = 0; k < w.heroes.length; k++) {
      const q = w.heroData(k).player;
      if (q.hp <= 0 || !q.coal) continue;
      const r = (q.coalR ?? COLD.maxR) + r0;
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

  private wrackDraw(g: Phaser.GameObjects.Graphics, now: number): void {
    const w = this.world;
    const pulling = w.ebbT > 0;
    const warn = w.ebbWarnT > 0;
    // The drain: a dark whirlpool on the floor that turns, faster while the water pulls.
    // The Wrackline's images lie on the floor itself, under every ground effect (burn zones at depth 1)
    // and the telegraph layer (depth 2), so a zone on a raft or a Sink circle always shows on top.
    if (!this.drainImg) this.drainImg = this.add.image(0, 0, 'drain').setDepth(0.8);
    this.drainImg.setVisible(true).setScale((WRACK.drainR * 2.3) / 256).setRotation(-(now / 1000) * (pulling ? 2.6 : warn ? 1.2 : 0.5)).setAlpha(pulling ? 1 : 0.85);
    if (pulling && !this.lowFx) {
      // Foam spun off the drain's rim.
      for (let k = 0; k < 3; k++) {
        const a = -(now / 1000) * 2.6 + (k * 2 * Math.PI) / 3;
        g.lineStyle(2, 0xbfe9ff, 0.5).beginPath().arc(0, 0, WRACK.drainR * 1.02, a, a + 0.7).strokePath();
      }
    }
    if (warn || pulling) {
      // The Ebb: foam streaks rushing from the rim toward the drain, each a bright head with a fading
      // tail. Faint and slow through the 3 s warning, then fast and bold through the pull.
      const n = this.lowFx ? 10 : 18;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + 0.2 + Math.sin(k * 7.3) * 0.08;
        const t = (now / (pulling ? 500 : 900) + k * 0.37) % 1;
        const r0 = ARENA - t * (ARENA - WRACK.drainR);
        const len = pulling ? 80 : 44;
        const r1 = Math.min(ARENA, r0 + len);
        const cx = Math.cos(a), cy = Math.sin(a);
        const al = pulling ? 0.6 : 0.3 + 0.25 * Math.sin(now / 90);
        g.lineStyle(pulling ? 4 : 2, 0x7fd0e0, al * 0.45).lineBetween(cx * r0, cy * r0, cx * r1, cy * r1);
        g.lineStyle(pulling ? 2 : 1.5, 0xbfe9ff, al).lineBetween(cx * r0, cy * r0, cx * (r0 + len * 0.4), cy * (r0 + len * 0.4));
        g.fillStyle(0xeafaff, al).fillCircle(cx * r0, cy * r0, pulling ? 2.6 : 1.8);
      }
    }
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
      const r = q.coalR ?? COLD.maxR;
      if (q.coal > 0) {
        const flick = 1 + 0.025 * Math.sin(now / 90 + k * 2) + 0.015 * Math.sin(now / 37 + k);
        // Brighter while the coal is full, and brighter still against the Long Night.
        light?.setVisible(true).setPosition(x, y).setDisplaySize(r * 2 * flick, r * 2 * flick).setAlpha(Math.min(1, (0.6 + 0.4 * q.coal) * (1 + 0.6 * night)));
        // The edge: a slowly turning dashed ring, pulsing red-orange when the coal runs low.
        const low = q.coal < 0.25 ? 0.5 + 0.5 * Math.sin(now / 120) : 0;
        const edge = low ? 0xff5a3a : 0xffb070;
        const n = 28;
        const rot = now / 4000 + k;
        g.lineStyle(2, edge, 0.35 + 0.35 * q.coal + 0.3 * low);
        for (let d = 0; d < n; d++) {
          const a0 = rot + (d / n) * Math.PI * 2;
          g.beginPath().arc(x, y, r, a0, a0 + (Math.PI * 2) / n * 0.55, false).strokePath();
        }
      } else {
        light?.setVisible(false);
        // Out: a cold grey ring where the light was.
        g.lineStyle(1.5, 0x9fb6d0, 0.35).strokeCircle(x, y, r);
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
          const after = COLD.minR + (COLD.maxR - COLD.minR) * Math.max(0, q.coal - COLD.snuffCut);
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
    o.lineStyle(3, DANGER, 0.85 * close).strokeRect(t.x - r, t.y - r * 0.8, r * 2, r * 1.6);
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
    if (covered) {
      o.lineStyle(4, SOAK, 0.95).strokeCircle(t.x, t.y, t.r);
      o.fillStyle(0x10200f, 0.85).fillCircle(bx, by, 11);
      o.lineStyle(2, 0x9fe8a8, 1).strokeCircle(bx, by, 11);
      o.lineStyle(3, 0x9fe8a8, 1).beginPath().moveTo(bx - 5, by).lineTo(bx - 1, by + 4).lineTo(bx + 6, by - 4).strokePath();
    } else {
      const blink = 0.5 + 0.5 * Math.sin(now / (f > 0.6 ? 60 : 140));
      o.lineStyle(3, DANGER, 0.4 + 0.5 * blink);
      for (let d = 0; d < 16; d++) {
        const a0 = (d * Math.PI * 2) / 16 - now / 2000;
        o.beginPath().arc(t.x, t.y, t.r + 8, a0, a0 + 0.22, false).strokePath();
      }
      o.fillStyle(0x200a0e, 0.85).fillCircle(bx, by, 11);
      o.lineStyle(2, DANGER, 0.6 + 0.4 * blink).strokeCircle(bx, by, 11);
      o.fillStyle(DANGER, 1).fillRect(bx - 1.5, by - 7, 3, 9).fillRect(bx - 1.5, by + 4, 3, 3);
    }
  }

  /** Ysmeret's wind-ups: Scatter Embers rings every hero, Bellow Slam draws both flames to the tank. */
  private ysmeretCast(g: Phaser.GameObjects.Graphics, e: World['enemies'][number], now: number): void {
    const w = this.world;
    const f = Math.min(1, e.castT / e.castDur);
    const o = this.overFx;
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
