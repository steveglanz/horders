/**
 * Phase 18 Halls H1, the screen side of the Kiln map (sim/halls.ts): the 2D greybox floor, sleeping packs and their
 * red reach rings, the camera rule (fit the room, lead along a corridor), the corner map, the edge arrow to the next
 * door on the main path, and the fade through the boss door. The 3D look draws its own floor, sleepers and rings
 * (client/hd2d, visuals) and takes the camera rule through the adapter (focus and zoom); the corner map, arrow and
 * fade are DOM, so they show over either look.
 */
import Phaser from 'phaser';
import type { World } from '../sim/world';
import { DOOR_ROOM, HALLS, HallsMap, MAIN_ROOMS, corridorAt, hallsWay, roomAt } from '../sim/halls';
import type { EnemyKind } from '../sim/content/enemies';
import { GRATE_WARN, Grate, grateState, hallsGrates, liftedOf, lockOf } from './hallsgrates';

/** The floor's plain greybox colours: warm dark stone, the Kiln's ember rim. */
const FLOOR = 0x2c211c;
const FLOOR_SIDE = 0x251b17;
const RIM = 0xff8a3d;
/** Red is bad (Steve, 23 Nov): a sleeping pack's reach ring. */
const DANGER = 0xff4d3d;
/** The path arrow and the open boss door: gold, the HUD's "next" colour. */
const GOLD = '#ffc861';

export interface HallsFrame {
  now: number;
  /** Seconds since the last frame. */
  dt: number;
  /** The 3D look's floor bridge is on: the 3D view draws the floor, sleepers and rings itself. */
  threeD: boolean;
  /** Your hero, interpolated. */
  px: number;
  py: number;
  /** Phones: the corner map starts hidden behind a button. */
  compact: boolean;
  /** Where world point (x, y) shows on screen (CSS px from the game canvas's top left), or null off the view. */
  project: (x: number, y: number) => { x: number; y: number } | null;
  /** The game canvas's CSS box. */
  rect: DOMRect;
  /** The 2D view's width in world units at today's zoom (GameScene viewFor), for the room fit. */
  view: number;
}

export class HallsView {
  /** How much more than today's view the camera shows (1 = today, >1 zooms out): the room fit. */
  zoomK = 1;
  /** The camera's lead along a corridor (world units), added to GameScene's focus. */
  leadX = 0;
  leadY = 0;

  private floorDrawn = false;
  private floor: Phaser.GameObjects.Graphics;
  private rings: Phaser.GameObjects.Graphics;
  private sleepers: Phaser.GameObjects.Image[] = [];
  private mapBox: HTMLDivElement;
  private mapCanvas: HTMLCanvasElement;
  private mapBtn: HTMLButtonElement;
  private arrow: HTMLDivElement;
  /** H2b: the "Sealed" tag beside the arrow while you're shut out of a sealed room. */
  private tag: HTMLDivElement;
  private fadeEl: HTMLDivElement;
  private open = false;
  private mapStamp = '';
  private lastDir = { x: 0, y: -1 };
  private fadeT = -1;
  private grates: Grate[] | null = null;

  constructor(private scene: Phaser.Scene, private world: World, private texFor: (kind: EnemyKind) => string, private base: number) {
    this.floor = scene.add.graphics().setDepth(-5);
    // Above floor marks and shadows, under every sprite; never carried by the 3D floor bridge (it skips 2.3 and up).
    this.rings = scene.add.graphics().setDepth(2.4);
    const hud = document.getElementById('hud') ?? document.body;
    this.mapBox = document.createElement('div');
    this.mapBox.id = 'hallsMap';
    this.mapBox.setAttribute('role', 'img');
    this.mapBox.setAttribute('aria-label', 'Map of the Kiln Depths');
    this.mapCanvas = document.createElement('canvas');
    this.mapBox.append(this.mapCanvas);
    this.mapBtn = document.createElement('button');
    this.mapBtn.id = 'hallsMapBtn';
    this.mapBtn.type = 'button';
    this.mapBtn.textContent = 'Map';
    this.mapBtn.setAttribute('aria-label', 'Show the map');
    const toggle = (e: Event) => { e.stopPropagation(); e.preventDefault(); this.open = !this.open; this.mapStamp = ''; };
    this.mapBtn.addEventListener('pointerdown', toggle);
    this.mapBox.addEventListener('pointerdown', toggle);
    hud.append(this.mapBox, this.mapBtn);
    this.arrow = document.createElement('div');
    this.arrow.id = 'hallsArrow';
    this.arrow.hidden = true;
    this.tag = document.createElement('div');
    this.tag.id = 'hallsSealTag';
    this.tag.textContent = 'Sealed';
    this.tag.hidden = true;
    hud.append(this.arrow, this.tag);
    this.fadeEl = document.createElement('div');
    this.fadeEl.id = 'hallsFade';
    document.body.append(this.fadeEl);
  }

  /** The boss door: a short fade covers the move into the arena (the sim's HALLS.fade intro). */
  door(): void {
    this.fadeT = 0;
  }

  get map(): HallsMap | null {
    return this.world.halls;
  }

  frame(f: HallsFrame): void {
    const m = this.map;
    if (!m) return;
    this.fadeStep(f.dt);
    if (m.done) {
      this.hideAll();
      this.zoomK += (1 - this.zoomK) * Math.min(1, f.dt * 6);
      this.leadX = this.leadY = 0;
      return;
    }
    if (f.threeD) { this.floor.setVisible(false); this.rings.clear(); for (const s of this.sleepers) s.setVisible(false); } else {
      this.floor.setVisible(true);
      if (!this.floorDrawn) this.drawFloor(m);
      this.drawSleepers(m, f);
    }
    this.camera(m, f);
    this.drawMap(m, f);
    this.drawArrow(m, f);
  }

  destroy(): void {
    this.floor.destroy();
    this.rings.destroy();
    for (const s of this.sleepers) s.destroy();
    this.mapBox.remove();
    this.mapBtn.remove();
    this.arrow.remove();
    this.tag.remove();
    this.fadeEl.remove();
  }

  private hideAll(): void {
    this.floor.setVisible(false);
    this.rings.clear();
    for (const s of this.sleepers) s.setVisible(false);
    this.mapBox.hidden = true;
    this.mapBtn.hidden = true;
    this.arrow.hidden = true;
    this.tag.hidden = true;
  }

  private fadeStep(dt: number): void {
    if (this.fadeT < 0) return;
    this.fadeT += dt;
    // Black over the first half of the sim's fade, then clear again as the arena shows.
    const half = HALLS.fade / 2;
    const a = this.fadeT < half ? this.fadeT / half : Math.max(0, 1 - (this.fadeT - half) / half);
    this.fadeEl.style.opacity = String(a);
    if (this.fadeT >= HALLS.fade) { this.fadeT = -1; this.fadeEl.style.opacity = '0'; }
  }

  /** The greybox floor, drawn once: rooms and corridors in plain stone with an ember rim, walls left dark. */
  private drawFloor(m: HallsMap): void {
    this.floorDrawn = true;
    const g = this.floor.clear();
    const hw = HALLS.corridor / 2;
    const quad = (ax: number, ay: number, bx: number, by: number, w: number) => {
      const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1, nx = (-dy / d) * w, ny = (dx / d) * w;
      g.fillPoints([new Phaser.Math.Vector2(ax + nx, ay + ny), new Phaser.Math.Vector2(bx + nx, by + ny), new Phaser.Math.Vector2(bx - nx, by - ny), new Phaser.Math.Vector2(ax - nx, ay - ny)], true);
    };
    // A dark skirt round every shape first, so the walls read as walls on the dimmed ground.
    g.fillStyle(0x0b0705, 0.9);
    for (const r of m.rooms) g.fillCircle(r.x, r.y, r.r + 26);
    for (const c of m.corridors) { const a = m.rooms[c.a], b = m.rooms[c.b]; quad(a.x, a.y, b.x, b.y, hw + 26); }
    g.fillStyle(FLOOR_SIDE, 1);
    for (const c of m.corridors) { const a = m.rooms[c.a], b = m.rooms[c.b]; quad(a.x, a.y, b.x, b.y, hw); }
    g.fillStyle(FLOOR, 1);
    for (const r of m.rooms) g.fillCircle(r.x, r.y, r.r);
    // A faint flagstone grid, so walking reads as moving.
    g.lineStyle(1, 0x3a2c25, 0.6);
    for (const r of m.rooms) for (let k = -r.r + 60; k < r.r; k += 60) {
      const h = Math.sqrt(Math.max(0, r.r * r.r - k * k)) - 6;
      g.lineBetween(r.x + k, r.y - h, r.x + k, r.y + h);
      g.lineBetween(r.x - h, r.y + k, r.x + h, r.y + k);
    }
    // Ember rims: each room's edge, and the corridor sides between the rooms they join.
    g.lineStyle(4, RIM, 0.5);
    for (const r of m.rooms) g.strokeCircle(r.x, r.y, r.r);
    for (const c of m.corridors) {
      const a = m.rooms[c.a], b = m.rooms[c.b];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, nx = -uy * hw, ny = ux * hw;
      const ia = Math.sqrt(Math.max(0, a.r * a.r - hw * hw)), ib = Math.sqrt(Math.max(0, b.r * b.r - hw * hw));
      for (const s of [1, -1]) g.lineBetween(a.x + ux * ia + nx * s, a.y + uy * ia + ny * s, b.x - ux * ib + nx * s, b.y - uy * ib + ny * s);
    }
    // Open the rims across each corridor mouth (floor drawn back over the rim line there).
    g.fillStyle(FLOOR_SIDE, 1);
    for (const c of m.corridors) {
      const a = m.rooms[c.a], b = m.rooms[c.b];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      const ia = Math.sqrt(Math.max(0, a.r * a.r - hw * hw)), ib = Math.sqrt(Math.max(0, b.r * b.r - hw * hw));
      quad(a.x + ux * (ia - 6), a.y + uy * (ia - 6), a.x + ux * (a.r + 6), a.y + uy * (a.r + 6), hw - 2.5);
      quad(b.x - ux * (ib - 6), b.y - uy * (ib - 6), b.x - ux * (b.r + 6), b.y - uy * (b.r + 6), hw - 2.5);
    }
    // The boss door: a heavy arch at the end of the alcove (its glow is drawn each frame, gold once it opens).
    const dr = m.rooms[DOOR_ROOM];
    g.fillStyle(0x140d0a, 1).fillRect(dr.x - 70, dr.y - dr.r - 18, 140, 30);
    g.lineStyle(3, RIM, 0.7).strokeRect(dr.x - 70, dr.y - dr.r - 18, 140, 30);
  }

  /** Sleeping foes where they stand, and a pack's red ring once your hero is within HALLS.showRing of it. */
  private drawSleepers(m: HallsMap, f: HallsFrame): void {
    const g = this.rings.clear();
    let n = 0;
    for (const pk of m.packs) {
      if (pk.state !== 'asleep') continue;
      const d = Math.hypot(f.px - pk.x, f.py - pk.y);
      if (d < HALLS.showRing) {
        const near = 1 - Math.max(0, d - HALLS.reach) / (HALLS.showRing - HALLS.reach);
        const pulse = 0.85 + 0.15 * Math.sin(f.now / 260);
        g.fillStyle(DANGER, 0.05 + 0.07 * near).fillCircle(pk.x, pk.y, HALLS.reach);
        g.lineStyle(2.5, DANGER, (0.35 + 0.45 * near) * pulse).strokeCircle(pk.x, pk.y, HALLS.reach);
      }
      for (const foe of pk.foes) {
        let s = this.sleepers[n];
        if (!s) { s = this.scene.add.image(0, 0, 'ashling', '0').setDepth(4); this.sleepers.push(s); }
        const tex = this.texFor(foe.kind);
        if (s.texture.key !== tex) s.setTexture(tex, '0');
        // A slow breath, so they read as asleep rather than frozen.
        const b = Math.sin(f.now / 900 + n * 1.3) * 0.02;
        s.setVisible(true).setPosition(foe.x, foe.y).setScale(this.base, this.base * (1 + b)).setFlipX(foe.x > pk.x).setAlpha(0.92);
        g.fillStyle(0x000000, 0.35).fillEllipse(foe.x, foe.y + 16, 34, 12);
        n++;
      }
    }
    for (let k = n; k < this.sleepers.length; k++) this.sleepers[k].setVisible(false);
    this.drawGrates(m, f, g);
    // The boss door glows gold once the door guard falls.
    const guard = m.packs.find((p) => p.guard);
    const dr = m.rooms[DOOR_ROOM];
    if (guard?.state === 'cleared') g.lineStyle(6, 0xffc861, 0.55 + 0.25 * Math.sin(f.now / 300)).strokeRect(dr.x - 74, dr.y - dr.r - 22, 148, 38);
  }

  /**
   * H2b ember grates (client/hallsgrates.ts): a sealing room's doorways glow red for 1 s (red is bad), then a row of
   * iron bars, hot at the tips, drops across each; they lift once the room is cleared. The 3D look draws its own.
   */
  private drawGrates(m: HallsMap, f: HallsFrame, g: Phaser.GameObjects.Graphics): void {
    this.grates ??= hallsGrates(m, HALLS.corridor, DOOR_ROOM);
    for (const gr of this.grates) {
      const r = m.rooms[gr.room], lock = lockOf(r);
      const st = grateState(lock, liftedOf(r));
      if (st.glow <= 0.001 && st.drop <= 0.001) continue;
      const tx = -gr.uy, ty = gr.ux, w = gr.hw;
      const pulse = lock >= 0 && st.drop === 0 ? 0.75 + 0.25 * Math.sin((f.now / 1000) * (8 + 10 * st.glow)) : 1;
      // The warning band across the doorway, on the floor.
      const d = 20;
      g.fillStyle(DANGER, 0.65 * st.glow * pulse).fillPoints([
        new Phaser.Math.Vector2(gr.x + tx * w - gr.ux * d, gr.y + ty * w - gr.uy * d),
        new Phaser.Math.Vector2(gr.x - tx * w - gr.ux * d, gr.y - ty * w - gr.uy * d),
        new Phaser.Math.Vector2(gr.x - tx * w + gr.ux * d, gr.y - ty * w + gr.uy * d),
        new Phaser.Math.Vector2(gr.x + tx * w + gr.ux * d, gr.y + ty * w + gr.uy * d),
      ], true);
      if (st.drop <= 0.001) continue;
      // The bars: a dark iron rail across, with a hot red tip at each bar; slides in from the corridor side as it drops.
      const s = (1 - st.drop) * 40, cx = gr.x - gr.ux * s, cy = gr.y - gr.uy * s, a = Math.min(1, st.drop * 1.4);
      g.lineStyle(18, 0x2a2220, a).lineBetween(cx + tx * w, cy + ty * w, cx - tx * w, cy - ty * w);
      g.lineStyle(4, 0x6a5650, a).lineBetween(cx + tx * w, cy + ty * w, cx - tx * w, cy - ty * w);
      const n = Math.max(3, Math.round((2 * w) / 18));
      for (let b = 0; b < n; b++) {
        const off = ((b + 0.5) / n - 0.5) * 2 * w;
        g.fillStyle(DANGER, a * (0.55 + 0.45 * st.glow)).fillCircle(cx + tx * off, cy + ty * off, 4.5);
      }
    }
  }

  /**
   * The spec's camera: in a room, zoom out so the room fits; in a corridor, lead HALLS.lead ahead toward the far end
   * (the way your hero last walked along it). Eased, so walking through a doorway doesn't snap the view.
   */
  private camera(m: HallsMap, f: HallsFrame): void {
    const k = Math.min(1, f.dt * 3);
    const hero = this.world.player;
    const vx = hero.x - hero.px, vy = hero.y - hero.py;
    if (vx * vx + vy * vy > 0.01) { const l = Math.hypot(vx, vy); this.lastDir = { x: vx / l, y: vy / l }; }
    const room = roomAt(m, f.px, f.py);
    let want = 1, lx = 0, ly = 0;
    if (room >= 0) {
      want = Math.max(1, Math.min(2, (2 * (m.rooms[room].r + 40)) / f.view));
    } else {
      const c = corridorAt(m, f.px, f.py);
      if (c >= 0) {
        const a = m.rooms[m.corridors[c].a], b = m.rooms[m.corridors[c].b];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
        const s = this.lastDir.x * ux + this.lastDir.y * uy >= 0 ? 1 : -1;
        lx = ux * s * HALLS.lead; ly = uy * s * HALLS.lead;
      }
    }
    this.zoomK += (want - this.zoomK) * k;
    this.leadX += (lx - this.leadX) * k;
    this.leadY += (ly - this.leadY) * k;
  }

  /**
   * The corner map: seen rooms and their corridors, cleared packs grey, sleeping packs red dots, the boss door marked,
   * your party as green dots (green is good). Phones keep it behind a Map button; a tap shows the whole map.
   */
  private drawMap(m: HallsMap, f: HallsFrame): void {
    const show = !f.compact || this.open;
    this.mapBox.hidden = !show;
    this.mapBtn.hidden = !f.compact;
    this.mapBtn.textContent = this.open ? 'Close' : 'Map';
    this.mapBox.classList.toggle('big', f.compact && this.open);
    if (!show) return;
    const size = f.compact && this.open ? Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.8) : 128;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // Redrawn about 6 times a second (enough for dots walking), or at once when something changed.
    const locks = m.rooms.map((r) => { const l = lockOf(r); return l < 0 ? '-' : l < GRATE_WARN ? 'w' : 's'; }).join('');
    const stamp = `${size}|${m.seen.join('')}|${m.packs.map((p) => p.state[1]).join('')}|${locks}|${Math.floor(f.now / 160)}`;
    if (stamp === this.mapStamp) return;
    this.mapStamp = stamp;
    const cv = this.mapCanvas;
    if (cv.width !== size * dpr) { cv.width = cv.height = size * dpr; cv.style.width = cv.style.height = `${size}px`; }
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const r of m.rooms) { x0 = Math.min(x0, r.x - r.r); x1 = Math.max(x1, r.x + r.r); y0 = Math.min(y0, r.y - r.r); y1 = Math.max(y1, r.y + r.r); }
    const pad = 8 * dpr, S = size * dpr;
    const sc = Math.min((S - 2 * pad) / (x1 - x0), (S - 2 * pad) / (y1 - y0));
    const ox = (S - (x1 - x0) * sc) / 2 - x0 * sc, oy = (S - (y1 - y0) * sc) / 2 - y0 * sc;
    const X = (x: number) => ox + x * sc, Y = (y: number) => oy + y * sc;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(12, 8, 6, 0.78)';
    ctx.fillRect(0, 0, S, S);
    // Corridors to or between seen rooms, then the seen rooms.
    ctx.strokeStyle = 'rgba(150, 120, 100, 0.85)';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, HALLS.corridor * sc);
    for (const c of m.corridors) {
      if (!m.seen[c.a] && !m.seen[c.b]) continue;
      const a = m.rooms[c.a], b = m.rooms[c.b];
      ctx.beginPath(); ctx.moveTo(X(a.x), Y(a.y)); ctx.lineTo(X(b.x), Y(b.y)); ctx.stroke();
    }
    m.rooms.forEach((r, i) => {
      ctx.beginPath(); ctx.arc(X(r.x), Y(r.y), r.r * sc, 0, Math.PI * 2);
      ctx.fillStyle = m.seen[i] ? 'rgba(120, 92, 74, 0.95)' : 'rgba(40, 30, 26, 0.9)';
      ctx.fill();
    });
    // H2b: a sealing or sealed room. Red is bad: its rim turns red (pulsing for the 1 s warning, solid once the grates are
    // down) and a red bar closes each of its doorways, so a phone shows at a glance which room you can't walk out of
    // (or, in co-op, into).
    this.grates ??= hallsGrates(m, HALLS.corridor, DOOR_ROOM);
    const sealing = m.rooms.map((r) => lockOf(r));
    if (sealing.some((l) => l >= 0)) {
      const blink = 0.55 + 0.45 * Math.abs(Math.sin(f.now / 140));
      m.rooms.forEach((r, i) => {
        const l = sealing[i];
        if (l < 0 || !m.seen[i]) return;
        const down = l >= GRATE_WARN;
        ctx.beginPath(); ctx.arc(X(r.x), Y(r.y), r.r * sc, 0, Math.PI * 2);
        ctx.strokeStyle = down ? '#ff4d3d' : `rgba(255, 77, 61, ${blink.toFixed(2)})`;
        ctx.lineWidth = (down ? 2.5 : 2) * dpr;
        ctx.stroke();
      });
      ctx.lineCap = 'butt';
      for (const gr of this.grates) {
        const l = sealing[gr.room];
        if (l < 0 || !m.seen[gr.room]) continue;
        // A bar across the corridor a few px out from the rim (on the rim it would vanish into the red ring), a little
        // wider than the corridor so it reads as a gate at phone size.
        const down = l >= GRATE_WARN, tx = -gr.uy, ty = gr.ux, w = Math.max(4 * dpr, gr.hw * sc * 1.5 + 1.5 * dpr);
        const cx = X(gr.x) - gr.ux * 5 * dpr, cy = Y(gr.y) - gr.uy * 5 * dpr;
        ctx.strokeStyle = down ? '#ff4d3d' : `rgba(255, 77, 61, ${blink.toFixed(2)})`;
        ctx.lineWidth = 3 * dpr;
        ctx.beginPath(); ctx.moveTo(cx + tx * w, cy + ty * w); ctx.lineTo(cx - tx * w, cy - ty * w); ctx.stroke();
      }
    }
    // Packs: red dots asleep (in rooms you have seen), grey once cleared, a red ring while the fight is on.
    for (const pk of m.packs) {
      if (!m.seen[pk.room]) continue;
      ctx.beginPath(); ctx.arc(X(pk.x), Y(pk.y), Math.max(3 * dpr, 60 * sc), 0, Math.PI * 2);
      if (pk.state === 'cleared') { ctx.fillStyle = 'rgba(150, 150, 150, 0.7)'; ctx.fill(); }
      else if (pk.state === 'asleep') { ctx.fillStyle = '#ff4d3d'; ctx.fill(); }
      else { ctx.strokeStyle = '#ff4d3d'; ctx.lineWidth = 2 * dpr; ctx.stroke(); }
    }
    // The boss door: always marked (gold once open), so the goal is never a mystery.
    const guard = m.packs.find((p) => p.guard);
    ctx.fillStyle = guard?.state === 'cleared' ? GOLD : 'rgba(255, 138, 61, 0.8)';
    ctx.fillRect(X(m.door.x) - 9 * dpr, Y(m.door.y) - 4 * dpr, 18 * dpr, 8 * dpr);
    // Your party: green (good), you a little bigger with a white edge.
    for (let i = 0; i < this.world.heroes.length; i++) {
      const q = this.world.heroData(i).player;
      if (q.hp <= 0) continue;
      const me = i === this.world.acting;
      ctx.beginPath(); ctx.arc(X(q.x), Y(q.y), (me ? 4 : 3) * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#5fe07a'; ctx.fill();
      if (me) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 * dpr; ctx.stroke(); }
    }
  }

  /**
   * The edge arrow (Phase 15 Y9's chevrons, in gold): toward the next doorway on the main path, from wherever your
   * hero is (a side room points back the way it came). Hidden while a fight is on, or when the doorway is in view.
   */
  private drawArrow(m: HallsMap, f: HallsFrame): void {
    // H2b co-op: shut out of a sealed room (the grates dropped with you outside), the arrow turns grey with a "Sealed"
    // tag and points at that room, so you know where your party is and why you can't reach it yet.
    const shut = this.shutOut(m, f.px, f.py);
    const goal = shut ?? (this.world.phase === 'fight' ? null : this.nextGoal(m, f.px, f.py));
    this.arrow.classList.toggle('sealed', !!shut);
    this.tag.hidden = true;
    if (!goal) { this.arrow.hidden = true; return; }
    const wp = hallsWay(m, f.px, f.py, goal.x, goal.y);
    const at = f.project(wp.x, wp.y);
    const W = f.rect.width, H = f.rect.height;
    const inset = 40;
    if (at && at.x > inset && at.x < W - inset && at.y > inset + 50 && at.y < H - inset) { this.arrow.hidden = true; return; }
    const me = f.project(f.px, f.py) ?? { x: W / 2, y: H / 2 };
    // Screen direction from your hero to the way point (a point behind the camera still gives the right side).
    let dx: number, dy: number;
    if (at) { dx = at.x - me.x; dy = at.y - me.y; } else { dx = wp.x - f.px; dy = wp.y - f.py; }
    const a = Math.atan2(dy, dx);
    const hw = W / 2 - inset, hh = H / 2 - inset - 30;
    const r = Math.min(hw / Math.abs(Math.cos(a) || 1e-6), hh / Math.abs(Math.sin(a) || 1e-6));
    const ex = W / 2 + Math.cos(a) * r, ey = H / 2 + 15 + Math.sin(a) * r;
    this.arrow.hidden = false;
    this.arrow.style.transform = `translate(${f.rect.left + ex}px, ${f.rect.top + ey}px) rotate(${a}rad)`;
    if (shut) {
      // The tag sits just inside the arrow, toward the screen's middle, kept on screen.
      const tx = Math.max(34, Math.min(W - 34, ex - Math.cos(a) * 34)), ty = Math.max(14, Math.min(H - 14, ey - Math.sin(a) * 26));
      this.tag.hidden = false;
      this.tag.style.transform = `translate(${f.rect.left + tx}px, ${f.rect.top + ty}px) translate(-50%, -50%)`;
    }
  }

  /** A sealed room (grates down) that your living hero stands outside of, or null. */
  private shutOut(m: HallsMap, x: number, y: number): { x: number; y: number } | null {
    if (this.world.player.hp <= 0) return null;
    for (const r of m.rooms) {
      if (lockOf(r) < GRATE_WARN) continue;
      if (Math.hypot(x - r.x, y - r.y) > r.r) return { x: r.x, y: r.y };
    }
    return null;
  }

  /** The next main-path room past the furthest one any hero has seen (hallsWay finds the way there from anywhere). */
  private nextGoal(m: HallsMap, x: number, y: number): { x: number; y: number } | null {
    if (roomAt(m, x, y) === DOOR_ROOM) return null;
    let far = 0;
    MAIN_ROOMS.forEach((r, i) => { if (m.seen[r]) far = i; });
    const r = m.rooms[MAIN_ROOMS[Math.min(MAIN_ROOMS.length - 1, far + 1)]];
    return { x: r.x, y: r.y };
  }
}
