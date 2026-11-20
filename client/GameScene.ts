/**
 * Draws the shared simulation. This scene owns no game rules: it feeds input
 * into `World.step` at a fixed rate and renders interpolated state.
 */
import { OMENS } from '../sim/content/omens';
import Phaser from 'phaser';
import { TICK, World, Input, SimEvent, WorldOptions, VEIN_TIME, ARENA } from '../sim/world';
import { ENCOUNTERS } from '../sim/content/dungeon';
import { RARITY } from '../sim/content/items';
import { buildTextures } from './textures';
import { Hud } from './ui';
import { botChoose, botInput } from '../sim/bot';

// World units visible on the screen's short side: a little closer on phones.
const viewFor = (shortSide: number) => (shortSide < 500 ? 500 : 640);
const DANGER = 0xff3b6b; // the one colour used for enemy attacks
const SOAK = 0xffc861; // gold: stand in it
const NAME_COLOR: Record<string, string> = { boss: '#ff8aa5', rare: '#9fd0ff', elite: '#ffc861', normal: '#d6a8ff' };
const hex = (css: string) => Number.parseInt(css.slice(1), 16);

interface Fx {
  img: Phaser.GameObjects.Image;
  life: number;
  max: number;
  grow: number;
  vx: number;
  vy: number;
}

interface FloatText {
  txt: Phaser.GameObjects.Text;
  life: number;
}

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
  private gfx!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private fx: Fx[] = [];
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
    this.hud = data.hud;
    this.onEnd = data.onEnd;
    this.acc = 0;
    this.paused = false;
    this.queued = null;
    this.fx = [];
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

    w.zones.forEach(() => this.zoneSprites.push(this.add.image(0, 0, 'burn').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(1)));
    w.veins.forEach(() => this.veinSprites.push(this.add.image(0, 0, 'vein').setVisible(false).setDepth(1.5)));
    this.gfx = this.add.graphics().setDepth(2);
    w.gems.forEach(() => this.gemSprites.push(this.add.image(0, 0, 'gem').setVisible(false).setDepth(3)));
    w.drops.forEach(() => {
      this.beamSprites.push(this.add.image(0, 0, 'beam').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(3));
      this.dropSprites.push(this.add.image(0, 0, 'loot').setVisible(false).setDepth(3.5));
    });
    w.enemies.forEach(() => {
      this.enemySprites.push(this.add.image(0, 0, 'ashling').setVisible(false).setDepth(4));
      this.enemyKinds.push('ashling');
    });
    this.aura = this.add.image(0, 0, 'aura').setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    this.player = this.add.image(0, 0, w.cls === 'duskblade' ? 'duskblade' : 'player').setDepth(6);
    w.orbs.forEach(() => this.orbSprites.push(this.add.image(0, 0, 'orb').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(7)));
    for (let i = 0; i < 3; i++) this.orbiterSprites.push(this.add.image(0, 0, 'ember').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(7));
    for (let i = 0; i < 160; i++) {
      this.fx.push({ img: this.add.image(0, 0, 'spark').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(8), life: 0, max: 1, grow: 0, vx: 0, vy: 0 });
    }
    this.bars = this.add.graphics().setDepth(9);
    const plateStyle = { fontFamily: 'Georgia, serif', fontSize: '12px', color: '#ffffff', stroke: '#000000', strokeThickness: 3 };
    for (let i = 0; i < 10; i++) this.plates.push(this.add.text(0, 0, '', plateStyle).setOrigin(0.5, 1).setVisible(false).setDepth(9.5));
    this.soakText = this.add.text(0, 0, 'Stand here', { ...plateStyle, fontSize: '13px', color: '#ffe08a' }).setOrigin(0.5).setVisible(false).setDepth(9.5);
    for (let i = 0; i < 28; i++) {
      const txt = this.add.text(0, 0, '', { fontFamily: 'system-ui, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#ffe08a', stroke: '#2a0d06', strokeThickness: 4 }).setOrigin(0.5).setVisible(false).setDepth(10);
      this.floats.push({ txt, life: 0 });
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
    const zoom = short / viewFor(short);
    this.cameras.main.setZoom(zoom);
    // Scroll-factor-0 objects still scale with zoom around the screen centre,
    // so size the ground in world units and centre it.
    this.ground.setPosition(width / 2, height / 2).setSize(width / zoom + 4, height / zoom + 4);
  }

  private pick(i: number): void {
    if (this.world.state !== 'draft') return;
    this.world.choose(i);
    if (this.world.state === 'draft') this.hud.showDraft(this.world);
    else this.hud.hideDraft();
  }

  /** Queue an ability press; it fires on the next tick it is usable (within 0.35s). */
  cast(slot: number): void {
    if (this.paused || this.world.state !== 'running') return;
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

    if (!this.paused && w.state === 'running') {
      this.acc += Math.min(deltaMs / 1000, 0.25) * this.warp;
      while (this.acc >= TICK && w.state === 'running') {
        const input = this.autopilot ? botInput(w) : this.readInput();
        if (!this.autopilot && this.queued) {
          if (this.time.now > this.queued.until) this.queued = null;
          else input.cast = this.queued.slot;
        }
        const slot = input.cast;
        const cdBefore = slot !== undefined ? w.player.cds[slot] : 0;
        w.step(input);
        if (slot !== undefined && w.player.cds[slot] > cdBefore) {
          if (!this.autopilot) this.queued = null;
          this.hud.flashAbility(slot);
        }
        this.acc -= TICK;
        this.handleEvents(w.events);
      }
    }
    if (!this.paused && w.state === 'draft') {
      if (this.autopilot && this.autoPick) this.pick(botChoose(w));
      else this.hud.showDraft(w);
    }
    const alpha = w.state === 'running' && !this.paused ? this.acc / TICK : 1;
    this.render(alpha, deltaMs / 1000);
    this.hud.tick(w, this.fps());
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
          if (ev.crit || ev.amount >= 40) this.floatText(ev.x, ev.y - 10, Math.round(ev.amount).toString(), ev.crit ? '#ffe08a' : '#ffffff', ev.crit ? 18 : 14);
          break;
        case 'kill':
          if (ev.kind === 'kilnMother' || ev.kind === 'cinderBrute' || ev.kind === 'ashmaw') {
            this.burst(ev.x, ev.y, ev.kind === 'kilnMother' ? 40 : 24);
            this.shake = 0.5;
          } else this.burst(ev.x, ev.y, 4);
          break;
        case 'explode':
        case 'strike':
          this.blast(ev.x, ev.y, ev.r);
          break;
        case 'slam':
          this.blast(ev.x, ev.y, ev.r, DANGER);
          this.shake = Math.max(this.shake, 0.18);
          break;
        case 'playerHurt':
          this.shake = Math.max(this.shake, ev.amount >= 20 ? 0.3 : 0.08);
          break;
        case 'levelUp':
          this.burst(w.player.x, w.player.y, 16);
          this.addShape({ kind: 'pillar', x: w.player.x, y: w.player.y, x2: 0, y2: 0, r: 26, angle: 0, color: 0xffd27a, life: 0.9 });
          break;
        case 'ability':
          if (ev.slot === 0) {
            this.addShape({ kind: 'cone', x: ev.x, y: ev.y, x2: 0, y2: 0, r: ev.r, angle: ev.angle, color: 0xff8a3d, life: 0.3 });
          } else if (ev.slot === 2) {
            this.blast(ev.x, ev.y, ev.r);
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
        case 'parry':
          this.floatText(ev.x, ev.y - 34, 'Parry!', '#f1e6ff', 18);
          this.addShape({ kind: 'ring', x: ev.x, y: ev.y, x2: 0, y2: 0, r: 46, angle: 0, color: 0xf1e6ff, life: 0.3 });
          break;
        case 'blink':
          this.addShape({ kind: 'line', x: ev.x1, y: ev.y1, x2: ev.x2, y2: ev.y2, r: 0, angle: 0, color: 0xffc861, life: 0.3 });
          this.burst(ev.x2, ev.y2, 10);
          break;
        case 'castStart':
          if (ev.name === 'Molten Cataclysm') this.hud.banner('Molten Cataclysm!', `Interrupt it with ${w.abilities[3].name}, or brace for impact`);
          break;
        case 'interrupt':
          this.floatText(ev.x, ev.y - 40, 'Interrupted!', '#8fd8ff', 18);
          this.burst(ev.x, ev.y, 14);
          break;
        case 'heal':
          this.floatText(ev.x, ev.y - 40, `+${Math.round(ev.amount)}`, '#7dffb0', 18);
          break;
        case 'phase':
          if (ev.phase === 2) this.hud.banner('Phase 2: Ember Acolytes', 'Kill the healers, and stand in the gold circles');
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
        case 'loot':
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
          const def = ENCOUNTERS[ev.id];
          // The first fight also names the run's Omens, so the player knows the twist.
          const omens = ev.index === 0 && w.omens.length ? ` Omens: ${w.omens.map((o) => `${OMENS[o].name} (${OMENS[o].tip.toLowerCase().replace(/\.$/, '')})`).join(', ')}.` : '';
          this.hud.banner(def.name, def.tip + omens);
          break;
        }
        case 'encounterClear':
          this.hud.ding(ev.index + 1 >= w.route.length ? 'Victory!' : 'Cleared!');
          break;
        case 'bossEnrage':
          this.hud.banner('The Kiln Mother is enraged', 'Finish it, fast');
          break;
        case 'revive':
          this.hud.banner('Phoenix Feather', 'You rise from the ashes');
          break;
        case 'chest':
          this.burst(ev.x, ev.y, 30);
          break;
        case 'end':
          this.time.delayedCall(700, () => this.onEnd(this.world));
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
    if (this.shake > 0) {
      this.shake -= dt;
      const m = Math.min(1, this.shake) * 10;
      sx = (Math.random() - 0.5) * m;
      sy = (Math.random() - 0.5) * m;
    }
    cam.centerOn(px + sx, py + sy);
    this.ground.setTilePosition(cam.worldView.x, cam.worldView.y);
    this.ground.setTileScale(1);

    this.player.setPosition(px, py);
    if (p.hurtFlash > 0) this.player.setTint(0xff6060).setTintMode(Phaser.TintModes.FILL);
    else if (p.shieldT > 0) this.player.setTint(0x8fd8ff).setTintMode(Phaser.TintModes.MULTIPLY);
    else this.player.clearTint();
    this.aura.setPosition(px, py).setScale(1 + Math.sin(this.time.now / 300) * 0.05 + (p.heat / 100) * 0.25);

    const view = cam.worldView;
    const margin = 80;
    const onScreen = (x: number, y: number) => x > view.x - margin && x < view.right + margin && y > view.y - margin && y < view.bottom + margin;

    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i];
      const s = this.enemySprites[i];
      if (!e.alive) {
        if (s.visible) s.setVisible(false);
        continue;
      }
      const x = lerp(e.px, e.x);
      const y = lerp(e.py, e.y);
      if (!onScreen(x, y)) {
        if (s.visible) s.setVisible(false);
        continue;
      }
      if (this.enemyKinds[i] !== e.kind) {
        s.setTexture(e.kind);
        this.enemyKinds[i] = e.kind;
      }
      s.setVisible(true).setPosition(x, y).setFlipX(!e.def.stationary && x > px);
      if (e.kind === 'rift') s.setRotation(this.time.now / 900);
      else s.setRotation(e.stunT > 0 ? Math.sin(this.time.now / 60) * 0.15 : 0);
      if (e.flash > 0) s.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else if (e.stunT > 0) s.setTint(0x8fd8ff).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (e.burnT > 0) s.setTint(0xffa060).setTintMode(Phaser.TintModes.MULTIPLY);
      else s.clearTint();
    }

    for (let i = 0; i < w.orbs.length; i++) {
      const o = w.orbs[i];
      const s = this.orbSprites[i];
      if (!o.alive) { if (s.visible) s.setVisible(false); continue; }
      s.setVisible(true).setPosition(lerp(o.px, o.x), lerp(o.py, o.y));
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
      bag.setVisible(true).setPosition(d.x, d.y + bob).setTint(c).setTintMode(Phaser.TintModes.MULTIPLY);
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
      g.lineStyle(900, 0x070302, 0.82).strokeCircle(0, 0, ARENA + 450);
      g.lineStyle(4, 0xff8a3d, 0.55).strokeCircle(0, 0, ARENA);
      g.lineStyle(14, 0xff5a1f, 0.12).strokeCircle(0, 0, ARENA + 6);
    }
    let soakShown = false;
    for (const t of w.telegraphs) {
      if (!t.alive) continue;
      const f = Math.min(1, t.t / t.dur);
      const col = t.kind === 'soak' ? SOAK : DANGER;
      if (t.shape === 'circle') {
        g.fillStyle(col, t.kind === 'soak' ? 0.22 : 0.14).fillCircle(t.x, t.y, t.r);
        g.fillStyle(col, 0.3).fillCircle(t.x, t.y, t.r * f);
        g.lineStyle(t.kind === 'soak' ? 3 : 2, col, 0.9).strokeCircle(t.x, t.y, t.r);
        if (t.kind === 'soak' && !soakShown) {
          soakShown = true;
          this.soakText.setVisible(true).setPosition(t.x, t.y).setText(`Stand here ${Math.max(0, t.dur - t.t).toFixed(1)}`);
        }
      } else {
        const a0 = t.angle - t.arc / 2;
        const a1 = t.angle + t.arc / 2;
        g.fillStyle(col, 0.14).slice(t.x, t.y, t.r, a0, a1, false).fillPath();
        g.fillStyle(col, 0.3).slice(t.x, t.y, t.r * f, a0, a1, false).fillPath();
        g.lineStyle(2, col, 0.9).slice(t.x, t.y, t.r, a0, a1, false).strokePath();
      }
    }
    if (!soakShown && this.soakText.visible) this.soakText.setVisible(false);
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
      if (e.kind === 'acolyte' && boss?.alive) {
        const pulse = 0.5 + Math.sin(this.time.now / 120) * 0.25;
        g.lineStyle(3, 0x7dffb0, pulse).lineBetween(e.x, e.y, boss.x, boss.y);
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
        g.fillStyle(s.color, 0.45 * f).slice(s.x, s.y, s.r * (1.1 - f * 0.3), s.angle - half, s.angle + half, false).fillPath();
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
      const t = this.plates[plate++];
      if (t) t.setVisible(true).setPosition(e.x, top - 2).setText(e.def.name).setColor(NAME_COLOR[e.def.rank]);
    }
    for (; plate < this.plates.length; plate++) if (this.plates[plate].visible) this.plates[plate].setVisible(false);

    for (const f of this.fx) {
      if (f.life <= 0) continue;
      f.life -= dt;
      if (f.life <= 0) { f.img.setVisible(false); continue; }
      const k = f.life / f.max;
      f.img.x += f.vx * dt;
      f.img.y += f.vy * dt;
      f.img.setAlpha(k);
      if (f.grow) f.img.setScale(f.grow * (1.15 - k * 0.5));
    }
    for (const t of this.floats) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.txt.y -= 30 * dt;
      t.txt.setAlpha(Math.min(1, t.life * 2));
      if (t.life <= 0) t.txt.setVisible(false);
    }
  }

  private nextFx(): Fx | undefined {
    let best: Fx | undefined;
    for (const f of this.fx) {
      if (f.life <= 0) return f;
      if (!best || f.life < best.life) best = f;
    }
    return best;
  }

  private burst(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const f = this.nextFx();
      if (!f) return;
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      f.img.setTexture('spark').clearTint().setVisible(true).setPosition(x, y).setScale(1 + Math.random()).setAlpha(1);
      Object.assign(f, { life: 0.4 + Math.random() * 0.3, max: 0.7, grow: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
    }
  }

  private blast(x: number, y: number, r: number, tint?: number): void {
    const f = this.nextFx();
    if (!f) return;
    f.img.setTexture('blast').setVisible(true).setPosition(x, y).setAlpha(1);
    if (tint) f.img.setTint(tint).setTintMode(Phaser.TintModes.MULTIPLY);
    else f.img.clearTint();
    Object.assign(f, { life: 0.3, max: 0.3, grow: (r * 2.2) / 64, vx: 0, vy: 0 });
  }

  private floatText(x: number, y: number, s: string, color: string, size: number): void {
    let t = this.floats.find((q) => q.life <= 0);
    if (!t) t = this.floats.reduce((a, b) => (a.life < b.life ? a : b));
    t.txt.setText(s).setPosition(x, y).setVisible(true).setAlpha(1).setColor(color).setFontSize(size);
    t.life = color === '#ffffff' || color === '#ffe08a' ? 0.7 : 1.1;
  }
}
