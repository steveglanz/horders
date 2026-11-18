/**
 * Draws the shared simulation. This scene owns no game rules: it feeds input
 * into `World.step` at a fixed rate and renders interpolated state.
 */
import Phaser from 'phaser';
import { TICK, World, Input, SimEvent } from '../sim/world';
import { buildTextures } from './textures';
import { Hud } from './ui';
import { botChoose, botInput } from '../sim/bot';

// World units visible on the screen's short side: a little closer on phones.
const viewFor = (shortSide: number) => (shortSide < 500 ? 500 : 640);
const DANGER = 0xff3b6b; // the one colour used for enemy attacks

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

export class GameScene extends Phaser.Scene {
  world!: World;
  hud!: Hud;
  private acc = 0;
  private paused = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private stickVec = { x: 0, y: 0 };
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
  private orbiterSprites: Phaser.GameObjects.Image[] = [];
  private gfx!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private fx: Fx[] = [];
  private floats: FloatText[] = [];
  private shake = 0;

  // Frame timing for the stress test readout.
  private frameTimes: number[] = [];
  private workTimes: number[] = [];

  constructor() {
    super('game');
  }

  init(data: { seed: number; stress: boolean; god?: boolean; hud: Hud }): void {
    this.world = new World({ seed: data.seed, stress: data.stress, invulnerable: data.god });
    this.hud = data.hud;
    this.acc = 0;
    this.paused = false;
    this.fx = [];
    this.floats = [];
    this.enemySprites = [];
    this.enemyKinds = [];
    this.orbSprites = [];
    this.gemSprites = [];
    this.zoneSprites = [];
    this.orbiterSprites = [];
    this.frameTimes = [];
    this.workTimes = [];
  }

  create(): void {
    if (!this.textures.exists('ground')) buildTextures(this);
    const w = this.world;

    this.ground = this.add.tileSprite(0, 0, this.scale.width, this.scale.height, 'ground').setOrigin(0.5).setScrollFactor(0).setDepth(-10);

    w.zones.forEach(() => this.zoneSprites.push(this.add.image(0, 0, 'burn').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(1)));
    this.gfx = this.add.graphics().setDepth(2);
    w.gems.forEach(() => this.gemSprites.push(this.add.image(0, 0, 'gem').setVisible(false).setDepth(3)));
    w.enemies.forEach(() => {
      this.enemySprites.push(this.add.image(0, 0, 'ashling').setVisible(false).setDepth(4));
      this.enemyKinds.push('ashling');
    });
    this.aura = this.add.image(0, 0, 'aura').setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    this.player = this.add.image(0, 0, 'player').setDepth(6);
    w.orbs.forEach(() => this.orbSprites.push(this.add.image(0, 0, 'orb').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(7)));
    for (let i = 0; i < 3; i++) this.orbiterSprites.push(this.add.image(0, 0, 'ember').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(7));
    for (let i = 0; i < 160; i++) {
      this.fx.push({ img: this.add.image(0, 0, 'spark').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setDepth(8), life: 0, max: 1, grow: 0, vx: 0, vy: 0 });
    }
    this.bars = this.add.graphics().setDepth(9);
    for (let i = 0; i < 24; i++) {
      const txt = this.add.text(0, 0, '', { fontFamily: 'system-ui, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#ffe08a', stroke: '#2a0d06', strokeThickness: 4 }).setOrigin(0.5).setVisible(false).setDepth(10);
      this.floats.push({ txt, life: 0 });
    }

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,ONE,TWO,THREE,P,ESC') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown-ONE', () => this.pick(0));
    kb.on('keydown-TWO', () => this.pick(1));
    kb.on('keydown-THREE', () => this.pick(2));
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-ESC', () => this.togglePause());

    this.scale.on('resize', this.layout, this);
    this.layout();
    this.cameras.main.centerOn(0, 0);

    this.hud.bindRun({
      onPick: (i) => this.pick(i),
      onPause: () => this.togglePause(),
      onStick: (x, y) => { this.stickVec.x = x; this.stickVec.y = y; },
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
      const input = this.autopilot ? botInput(w) : this.readInput();
      while (this.acc >= TICK && w.state === 'running') {
        w.step(input);
        this.acc -= TICK;
        this.handleEvents(w.events);
      }
      if ((w.state as string) === 'draft') {
        if (this.autopilot && this.autoPick) this.pick(botChoose(w));
        else this.hud.showDraft(w);
      }
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

  private handleEvents(events: SimEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'hit':
          if (ev.crit || ev.amount >= 40) this.floatText(ev.x, ev.y - 10, Math.round(ev.amount).toString(), ev.crit);
          break;
        case 'kill':
          this.burst(ev.x, ev.y, ev.kind === 'kilnMother' ? 40 : ev.kind === 'cinderBrute' ? 24 : 4);
          if (ev.kind === 'kilnMother' || ev.kind === 'cinderBrute') this.shake = 0.5;
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
          this.burst(this.world.player.x, this.world.player.y, 16);
          break;
        case 'eliteSpawn':
          this.hud.banner('A Cinder Brute approaches', 'Defeat it for a bonus talent');
          break;
        case 'bossSpawn':
          this.hud.banner('Smolderhusk, the Kiln Mother', 'Step out of the red before it lands');
          this.shake = 0.6;
          break;
        case 'bossEnrage':
          this.hud.banner('The Kiln Mother is enraged', 'Finish it, fast');
          break;
        case 'chest':
          this.burst(ev.x, ev.y, 30);
          break;
        case 'end':
          this.time.delayedCall(700, () => this.hud.showEnd(this.world));
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
    else this.player.clearTint();
    this.aura.setPosition(px, py).setScale(1 + Math.sin(this.time.now / 300) * 0.05);

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
      s.setVisible(true).setPosition(x, y).setFlipX(x > px);
      if (e.flash > 0) s.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
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
    const orbiters = w.orbiters();
    this.orbiterSprites.forEach((s, k) => {
      const o = orbiters[k];
      if (!o) { s.setVisible(false); return; }
      s.setVisible(true).setPosition(o.x, o.y);
    });

    // Telegraphs, lances and health bars are redrawn each frame.
    const g = this.gfx;
    g.clear();
    for (const t of w.telegraphs) {
      if (!t.alive) continue;
      const f = Math.min(1, t.t / t.dur);
      if (t.shape === 'circle') {
        g.fillStyle(DANGER, 0.14).fillCircle(t.x, t.y, t.r);
        g.fillStyle(DANGER, 0.3).fillCircle(t.x, t.y, t.r * f);
        g.lineStyle(2, DANGER, 0.9).strokeCircle(t.x, t.y, t.r);
      } else {
        const a0 = t.angle - t.arc / 2;
        const a1 = t.angle + t.arc / 2;
        g.fillStyle(DANGER, 0.14).slice(t.x, t.y, t.r, a0, a1, false).fillPath();
        g.fillStyle(DANGER, 0.3).slice(t.x, t.y, t.r * f, a0, a1, false).fillPath();
        g.lineStyle(2, DANGER, 0.9).slice(t.x, t.y, t.r, a0, a1, false).strokePath();
      }
    }
    for (const l of w.lances) {
      if (!l.alive) continue;
      const k = l.life / 0.25;
      g.lineStyle(14 * k + 2, 0xff9a3d, 0.5 * k).lineBetween(l.x1, l.y1, l.x2, l.y2);
      g.lineStyle(4, 0xfff0c0, k).lineBetween(l.x1, l.y1, l.x2, l.y2);
    }

    const b = this.bars;
    b.clear();
    for (const e of w.enemies) {
      if (!e.alive || e.def.rank !== 'elite') continue;
      const bw = 60;
      b.fillStyle(0x000000, 0.6).fillRect(e.x - bw / 2, e.y - e.def.radius - 14, bw, 6);
      b.fillStyle(0xffb347, 1).fillRect(e.x - bw / 2, e.y - e.def.radius - 14, (bw * Math.max(0, e.hp)) / e.maxHp, 6);
    }

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
      f.img.setTexture('spark').setTint(0xffffff).clearTint().setVisible(true).setPosition(x, y).setScale(1 + Math.random()).setAlpha(1);
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

  private floatText(x: number, y: number, s: string, crit: boolean): void {
    let t = this.floats.find((q) => q.life <= 0);
    if (!t) t = this.floats.reduce((a, b) => (a.life < b.life ? a : b));
    t.txt.setText(crit ? s + '!' : s).setPosition(x, y).setVisible(true).setAlpha(1).setColor(crit ? '#ffe08a' : '#ffffff').setFontSize(crit ? 18 : 14);
    t.life = 0.7;
  }
}
