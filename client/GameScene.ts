/**
 * Draws the shared simulation. This scene owns no game rules: it feeds input
 * into `World.step` at a fixed rate and renders interpolated state.
 */
import { OMENS } from '../sim/content/omens';
import { CoopSession, SNAP_SECONDS } from './net/coop';
import { applySnapshot } from '../sim/netsync';
import Phaser from 'phaser';
import { TICK, World, Input, SimEvent, WorldOptions, VEIN_TIME, ARENA, GLARE } from '../sim/world';
import { ENCOUNTERS } from '../sim/content/dungeon';
import { RARITY } from '../sim/content/items';
import { ENEMIES } from '../sim/content/enemies';
import { buildTextures, FRAMES, SPRITE_RES } from './textures';
import { Hud } from './ui';
import { botChoose, botInput } from '../sim/bot';

// World units visible on the screen's short side: a little closer on phones.
const viewFor = (shortSide: number) => (shortSide < 500 ? 500 : 640);
const DANGER = 0xff3b6b; // the one colour used for enemy attacks
const SOAK = 0xffc861; // gold: stand in it
const NAME_COLOR: Record<string, string> = { boss: '#ff8aa5', rare: '#9fd0ff', elite: '#ffc861', normal: '#d6a8ff' };
const hex = (css: string) => Number.parseInt(css.slice(1), 16);

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
}

interface FloatText {
  txt: Phaser.GameObjects.Text;
  life: number;
  age: number;
  vx: number;
}

/** Characters draw a little larger than their hitboxes so they read on phones. */
const BASE = 1.15 / SPRITE_RES;
/** Players who ask the OS for less motion get a gentler shake and no camera lean. */
const REDUCED_MOTION = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  /** Co-op session, or null for solo. */
  coop: CoopSession | null = null;
  /** Guest: seconds since the last snapshot, for smoothing between them. */
  private snapAge = 0;
  private lastInputAt = 0;
  /** Guest: the draft (level and picks left) a pick was already sent for. */
  private sentPick = -1;
  /** The other heroes in a co-op party. */
  private allies: { hero: number; img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }[] = [];
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
  /** Labels over the two gates at a fork (game design: placeholder look, visuals can restyle). */
  private gateTexts: Phaser.GameObjects.Text[] = [];
  private gfx!: Phaser.GameObjects.Graphics;
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
  private fxCheckAt = 0;
  private vignette: HTMLElement | null = null;
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
    this.gateSprites = [];
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

    this.ground = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'ground').setOrigin(0.5).setScrollFactor(0).setDepth(-10);
    // The Glarewell's floor is cool slate, so its gold light and indigo shadows read against it.
    if (w.dungeonId === 'glarewell') this.ground.setTint(0xa49ccc);

    w.zones.forEach(() => this.zoneSprites.push(this.add.image(0, 0, 'burn').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(1)));
    w.veins.forEach(() => this.veinSprites.push(this.add.image(0, 0, 'vein').setVisible(false).setDepth(1.5)));
    this.gfx = this.add.graphics().setDepth(2);
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
    this.aura = this.add.image(0, 0, 'aura').setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    const auraTint: Record<string, number> = { duskblade: 0x9a6cff, lumen: 0xfff0c0, bulwark: 0x9ab8ff };
    if (auraTint[w.cls]) this.aura.setTint(auraTint[w.cls]);
    this.player = this.add.image(0, 0, w.cls === 'emberwright' ? 'player' : w.cls, '0').setScale(BASE).setDepth(6);
    // Co-op: everyone else in the party, with their name over their head.
    for (let j = 0; j < w.heroes.length; j++) {
      if (j === w.acting) continue;
      const cls = w.heroes[j].cls;
      this.allies.push({
        hero: j,
        shadow: this.add.image(0, 0, 'shadow').setDepth(2.5),
        img: this.add.image(0, 0, cls === 'emberwright' ? 'player' : cls, '0').setScale(BASE).setDepth(5.9),
        label: this.add.text(0, 0, w.heroes[j].name, { fontFamily: 'Georgia, serif', fontSize: '12px', color: '#d8f3ff', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(9.5),
      });
    }
    w.orbs.forEach(() => this.orbSprites.push(this.add.image(0, 0, 'bolt').setOrigin(0.78, 0.5).setScale(0.7).setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(7)));
    for (let i = 0; i < 3; i++) this.orbiterSprites.push(this.add.image(0, 0, 'ember').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(7));
    for (let i = 0; i < 200; i++) this.fx.push(this.newFx('spark', 8, true));
    // Drifting embers in the air, wrapped around the camera.
    if (!w.stress) {
      for (let i = 0; i < 34; i++) {
        const img = this.add.image(Math.random() * 1400 - 700, Math.random() * 1000 - 500, 'spark').setBlendMode(Phaser.BlendModes.ADD).setDepth(8.5);
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
    this.soakText = this.add.text(0, 0, 'Stand here', { ...plateStyle, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5).setVisible(false).setDepth(9.5);
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
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
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
  }

  private pick(i: number): void {
    if (this.world.state !== 'draft') return;
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

  /** Average milliseconds of game code (simulation + scene updates) per frame. */
  workMs(): number {
    return this.workTimes.length ? this.workTimes.reduce((a, b) => a + b, 0) / this.workTimes.length : 0;
  }

  private updateInner(deltaMs: number): void {
    const w = this.world;
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
        w.step(this.coop ? [input, ...this.coop.remoteInputs(w)] : input);
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
          if (w.cls === 'lumen' && (ev.slot === 0 || ev.slot === 2)) {
            this.addShape({ kind: 'ring', x: ev.x, y: ev.y, x2: 0, y2: 0, r: ev.r, angle: 0, color: ev.slot === 0 ? 0xfff2b0 : 0xffd27a, life: 0.4 });
            if (ev.slot === 2) this.floatText(ev.x, ev.y - 36, 'Sanctuary', '#ffe9a8', 18);
          } else if (w.cls === 'bulwark' && ev.slot === 0) {
            this.addShape({ kind: 'cone', x: ev.x, y: ev.y, x2: 0, y2: 0, r: ev.r, angle: ev.angle, color: 0xdfe7f2, life: 0.25 });
            this.shake = Math.max(this.shake, 0.12);
          } else if (w.cls === 'bulwark' && ev.slot === 2) {
            this.addShape({ kind: 'ring', x: ev.x, y: ev.y, x2: 0, y2: 0, r: ev.r, angle: 0, color: 0xffd27a, life: 0.5 });
            this.floatText(ev.x, ev.y - 36, 'Bastion', '#ffd27a', 18);
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
          break;
        case 'mote':
          this.addShape({ kind: 'line', x: ev.x1, y: ev.y1, x2: ev.x2, y2: ev.y2, r: 0, angle: 0, color: 0xfff2b0, life: 0.12 });
          break;
        case 'parry':
          this.floatText(ev.x, ev.y - 34, 'Parry!', '#f1e6ff', 18);
          this.addShape({ kind: 'ring', x: ev.x, y: ev.y, x2: 0, y2: 0, r: 46, angle: 0, color: 0xf1e6ff, life: 0.3 });
          break;
        case 'blink':
          this.addShape({ kind: 'line', x: ev.x1, y: ev.y1, x2: ev.x2, y2: ev.y2, r: 0, angle: 0, color: 0xffc861, life: 0.3 });
          this.burst(ev.x2, ev.y2, 10);
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
          }
          break;
        case 'castStart':
          if (ev.name === 'Glare') this.hud.banner('Glare!', `Hide behind a pillar${w.dungeonId === 'glarewell' && w.enemies.some((o) => o.alive && o.castId === 'glare' && o.kind === 'lensbearer') ? `, or ${w.abilities[3].name} it` : ''}`);
          else if (ev.name === 'Brand' || ev.name === 'Twin Brand') this.hud.banner(ev.name === 'Twin Brand' ? 'Twin Brand!' : 'Branded!', 'Get clear of pillars and enemies before it bursts');
          else if (ev.name === 'Molten Cataclysm') this.hud.banner('Molten Cataclysm!', `Interrupt it with ${w.abilities[3].name}, or brace for impact`);
          break;
        case 'interrupt':
          this.floatText(ev.x, ev.y - 40, 'Interrupted!', '#8fd8ff', 18);
          this.burst(ev.x, ev.y, 14);
          this.ring(ev.x, ev.y, 90, 0x8fd8ff, 0.4);
          // The skill moment of the game: a short freeze and a nudge of the camera.
          if (!this.coop) this.stop(0.06);
          this.shakeBy(0.12);
          break;
        case 'dodge':
          // Glarewarden: stepped out of a marked attack in time.
          this.floatText(ev.x, ev.y - 44, ev.healed > 0 ? `Dodged +${Math.round(ev.healed)}` : 'Dodged', '#5fe0c8', 16);
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
          } else if (w.dungeonId === 'foundry') {
            if (ev.phase === 2) this.hud.banner('Phase 2: Rising Water', `The arena shrinks. ${w.abilities[3].name} her Undertow`);
            else this.hud.banner('Phase 3: Overpressure', 'The vents erupt on their own. Time your kiting');
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
        case 'encounterStart': {
          this.bossFell = false;
          const def = ENCOUNTERS[ev.id];
          // The first fight also names the run's Omens, so the player knows the twist.
          const omens = ev.index === 0 && w.omens.length ? ` Omens: ${w.omens.map((o) => `${OMENS[o].name} (${OMENS[o].tip.toLowerCase().replace(/\.$/, '')})`).join(', ')}.` : '';
          this.hud.banner(ev.id === 'worldShadow' && w.worldBoss ? `Shadow of ${w.worldBoss}` : def.name, def.tip + omens);
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
        case 'bossEnrage':
          this.hud.banner(`${ENCOUNTERS[w.dungeonDef.boss].name.split(',')[0]} is enraged`, 'Finish it, fast');
          break;
        case 'revive':
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
      cam.setZoom(this.baseZoom * (1 + (REDUCED_MOTION ? 0 : this.punch)));
    } else if (cam.zoom !== this.baseZoom) cam.setZoom(this.baseZoom);
    if (this.shake > 0) {
      this.shake -= dt;
      const m = Math.min(1, this.shake) * (REDUCED_MOTION ? 3 : 10);
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
    if (p.hurtFlash > 0) this.player.setTint(0xff6060).setTintMode(Phaser.TintModes.FILL);
    else if (p.shieldT > 0) this.player.setTint(0x8fd8ff).setTintMode(Phaser.TintModes.MULTIPLY);
    else if (p.bastionT > 0) this.player.setTint(0xffd27a).setTintMode(Phaser.TintModes.MULTIPLY);
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
      al.label.setPosition(ax, ay - 34).setText(down ? `${w.heroes[al.hero].name} (down)` : w.heroes[al.hero].name);
    }

    const view = cam.worldView;
    const margin = 80;
    const onScreen = (x: number, y: number) => x > view.x - margin && x < view.right + margin && y > view.y - margin && y < view.bottom + margin;

    this.hitSparks = 0;
    if (now > this.fxCheckAt && this.frameTimes.length >= 120) {
      this.fxCheckAt = now + 2000;
      const fps = this.fps().avg;
      if (fps < 42) this.lowFx = true;
      else if (fps > 56) this.lowFx = false;
    }
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
      const tex = e.kind === 'worldShadow' ? 'slagCrone' : e.kind === 'emberTwin' && i % 2 ? 'emberTwinB' : e.kind;
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
      if (e.flash > 0) s.setTint(idleRank(e) ? 0x6a5a4a : 0xffffff).setTintMode(idleRank(e) ? Phaser.TintModes.SCREEN : Phaser.TintModes.FILL);
      else if (e.stunT > 0) s.setTint(0x8fd8ff).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (e.burnT > 0) s.setTint(0xffa060).setTintMode(Phaser.TintModes.MULTIPLY);
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
    if (!w.stress) {
      // The arena: darkness beyond the edge, an ember rim on it.
      // The Foundry's rim is water-blue; Rising Water pulls it in (w.arenaR).
      const R = w.arenaR ?? ARENA;
      const rim = w.dungeonId === 'foundry' ? 0x5ab8ff : w.dungeonId === 'glarewell' ? 0xffe2a0 : 0xff8a3d;
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
      txt.setVisible(true).setText(label).setColor('#' + col.toString(16).padStart(6, '0')).setPosition(gate.x, gate.y - gate.r - 34);
    });
    let soakShown = false;
    for (const t of w.telegraphs) {
      // Once the boss has fallen its last wind-up never lands, so stop drawing it.
      if (!t.alive || this.bossFell) continue;
      const f = Math.min(1, t.t / t.dur);
      const col = t.kind === 'soak' ? SOAK : t.kind === 'bloom' ? 0x5fe0c8 : DANGER;
      // The edge glows and flickers faster as the strike gets close.
      const flick = f > 0.7 ? 0.5 + 0.5 * Math.sin(now / (f > 0.9 ? 30 : 60)) : 1;
      if (t.shape === 'circle') {
        g.fillStyle(col, t.kind === 'soak' ? 0.22 : 0.14).fillCircle(t.x, t.y, t.r);
        g.fillStyle(col, 0.3).fillCircle(t.x, t.y, t.r * f);
        g.lineStyle(10, col, 0.12 * flick).strokeCircle(t.x, t.y, t.r + 3);
        g.lineStyle(t.kind === 'soak' ? 3 : 2, col, 0.9 * (0.6 + 0.4 * flick)).strokeCircle(t.x, t.y, t.r);
        g.lineStyle(1.5, 0xffffff, 0.5 * f).strokeCircle(t.x, t.y, t.r * f);
        if (t.kind === 'soak' && !soakShown) {
          soakShown = true;
          this.soakText.setVisible(true).setPosition(t.x, t.y).setText(`Stand here ${Math.max(0, t.dur - t.t).toFixed(1)}`);
        }
      } else {
        const a0 = t.angle - t.arc / 2;
        const a1 = t.angle + t.arc / 2;
        g.fillStyle(col, 0.14).slice(t.x, t.y, t.r, a0, a1, false).fillPath();
        g.fillStyle(col, 0.3).slice(t.x, t.y, t.r * f, a0, a1, false).fillPath();
        g.lineStyle(10, col, 0.12 * flick).slice(t.x, t.y, t.r + 3, a0, a1, false).strokePath();
        g.lineStyle(2, col, 0.9 * (0.6 + 0.4 * flick)).slice(t.x, t.y, t.r, a0, a1, false).strokePath();
      }
    }
    if (!soakShown && this.soakText.visible) this.soakText.setVisible(false);
    // The Lumen's Sanctuary and Blessed Ground pool.
    const lp = w.player;
    if (lp.sanctT > 0) {
      g.fillStyle(0xffe9a8, 0.08).fillCircle(lp.sanctX, lp.sanctY, w.sanctuaryRadius);
      g.lineStyle(2, 0xffd27a, 0.6).strokeCircle(lp.sanctX, lp.sanctY, w.sanctuaryRadius);
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
    }
    let plate = 0;
    for (const e of w.enemies) {
      if (!e.alive || (e.def.rank === 'normal' && !e.def.stationary) || e.def.rank === 'boss') continue;
      if (!onScreen(e.x, e.y)) continue;
      const bw = e.def.rank === 'rare' ? 70 : 56;
      const top = e.y - e.def.radius - 14;
      b.fillStyle(0x000000, 0.6).fillRect(e.x - bw / 2, top, bw, 6);
      b.fillStyle(hex(NAME_COLOR[e.def.rank]), 1).fillRect(e.x - bw / 2, top, (bw * Math.max(0, e.hp)) / e.maxHp, 6);
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
      const t = this.plates[plate++];
      if (t) t.setVisible(true).setPosition(e.x, top - 2).setText(e.def.name).setColor(NAME_COLOR[e.def.rank]);
    }
    for (; plate < this.plates.length; plate++) if (this.plates[plate].visible) this.plates[plate].setVisible(false);

    this.stepFx(this.fx, dt);
    this.stepFx(this.smoke, dt);
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
      img.y -= m.sp * dt;
      img.x += Math.sin(now / 900 + m.ph) * 10 * dt;
      if (img.y < view.y - 20) img.y += view.height + 40;
      else if (img.y > view.bottom + 20) img.y -= view.height + 40;
      if (img.x < view.x - 20) img.x += view.width + 40;
      else if (img.x > view.right + 20) img.x -= view.width + 40;
      img.setAlpha(0.25 + 0.35 * (0.5 + 0.5 * Math.sin(now / 500 + m.ph * 3)));
    }
    if (this.vignette) this.vignette.classList.toggle('low', p.hp > 0 && p.hp / p.maxHp < 0.3);
  }

  private newFx(tex: string, depth: number, add: boolean): Fx {
    const img = this.add.image(0, 0, tex).setVisible(false).setDepth(depth);
    if (add) img.setBlendMode(Phaser.BlendModes.ADD);
    return { img, life: 0, max: 1, vx: 0, vy: 0, drag: 1, spin: 0, sx0: 1, sy0: 1, sx1: 1, sy1: 1 };
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
    return f;
  }

  private spark(x: number, y: number, vx: number, vy: number, life: number, size = 1.5): void {
    this.emit(this.fx, 'spark', undefined, x, y, life, { vx, vy, drag: 0.93, sx0: size, sx1: size * 0.4 });
  }

  private burst(x: number, y: number, n: number): void {
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
    const n = big ? 5 : 1;
    for (let k = 0; k < n; k++) {
      const s = (big ? 1.4 : 0.6) + Math.random() * 0.4;
      this.emit(this.smoke, 'puff', undefined, x + (Math.random() - 0.5) * (big ? 40 : 6), y + (Math.random() - 0.5) * (big ? 30 : 6), 0.5 + Math.random() * 0.3, {
        tint: 0x9a8a84, vy: -18, vx: (Math.random() - 0.5) * 20, spin: (Math.random() - 0.5) * 2, rot: Math.random() * 6, sx0: s * 0.6, sx1: s * 1.3,
      });
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
    // Ash and embers rise from where it stood.
    for (let k = 0; k < 14; k++) {
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
    for (let k = 0; k < 10; k++) {
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
    t.txt.setText(s).setPosition(x, y).setVisible(true).setAlpha(1).setColor(color).setFontSize(size).setScale(1.7);
    t.age = 0;
    t.vx = (Math.random() - 0.5) * 60;
    t.life = color === '#ffffff' || color === '#ffe08a' ? 0.7 : 1.1;
  }
}
