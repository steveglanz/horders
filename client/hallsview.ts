/**
 * Phase 18 Halls H1, the screen side of the Kiln map (sim/halls.ts): the 2D greybox floor, sleeping packs and their
 * red reach rings, the camera rule (fit the room, lead along a corridor), the corner map, the edge arrow to the next
 * door on the main path, and the fade through the boss door. The 3D look draws its own floor, sleepers and rings
 * (client/hd2d, visuals) and takes the camera rule through the adapter (focus and zoom); the corner map, arrow and
 * fade are DOM, so they show over either look.
 */
import Phaser from 'phaser';
import type { World } from '../sim/world';
import { HALLS, doorRoom, HallsMap, HallsRoom, corridorAt, mainRooms, hallsWay, roomAt } from '../sim/halls';
import type { EnemyKind } from '../sim/content/enemies';
import { GRATE_WARN, Grate, grateState, hallsGrates, liftedOf, lockOf } from './hallsgrates';
import { corridorEnds, inLoop, inRoom, roomLoops } from './hallsshape';
import { type ThemeId, themeOf, themeSpots } from './hallsthemes';

/** The corridors' plain greybox stone and the Kiln's ember rim (rooms take their theme's floor2d, hallsthemes.ts). */
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
  /** H2b: the "Sealed" tag beside the arrow while you're shut out of a sealed room ("Walk in" on its grate in co-op). */
  private tag: HTMLDivElement;
  private fadeEl: HTMLDivElement;
  private open = false;
  private mapStamp = '';
  private lastDir = { x: 0, y: -1 };
  private fadeT = -1;
  private grates: Grate[] | null = null;
  /** The corner map's bounds and doorways (world units), worked out once: a map never changes shape. */
  private bounds: { x0: number; x1: number; y0: number; y1: number } | null = null;
  private doors: MapDoor[] | null = null;

  constructor(private scene: Phaser.Scene, private world: World, private texFor: (kind: EnemyKind) => string, private base: number) {
    this.floor = scene.add.graphics().setDepth(-5);
    // Above floor marks and shadows, under every sprite; never carried by the 3D floor bridge (it skips 2.3 and up).
    this.rings = scene.add.graphics().setDepth(2.4);
    const hud = document.getElementById('hud') ?? document.body;
    this.mapBox = document.createElement('div');
    this.mapBox.id = 'hallsMap';
    this.mapBox.setAttribute('role', 'img');
    this.mapBox.setAttribute('aria-label', `Map of ${world.dungeonDef.name.replace(/^The /, 'the ')}`);
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

  /**
   * The floor, drawn once: rooms in their theme's colour (H2d, client/hallsthemes.ts) for any outline (H2c,
   * client/hallsshape.ts: Round, Hall, Cross, Ring, Twin; the Ring's island a stone plinth), corridors in plain stone,
   * an ember rim round it all, walls left dark, and one simple prop per theme along the walls.
   */
  private drawFloor(m: HallsMap): void {
    this.floorDrawn = true;
    const g = this.floor.clear();
    const hw = HALLS.corridor / 2;
    const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);
    const poly = (l: number[]) => { const v: Phaser.Math.Vector2[] = []; for (let k = 0; k < l.length; k += 2) v.push(V(l[k], l[k + 1])); return v; };
    const quad = (ax: number, ay: number, bx: number, by: number, w: number) => {
      const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1, nx = (-dy / d) * w, ny = (dx / d) * w;
      g.fillPoints([V(ax + nx, ay + ny), V(bx + nx, by + ny), V(bx - nx, by - ny), V(ax - nx, ay - ny)], true);
    };
    const loops = m.rooms.map(roomLoops);
    // Where each corridor's centre line leaves its two rooms' outlines (the doorways).
    const span = m.corridors.map((c) => {
      const e = corridorEnds(m, c), L = Math.hypot(e.x2 - e.x1, e.y2 - e.y1) || 1, ux = (e.x2 - e.x1) / L, uy = (e.y2 - e.y1) / L;
      let t0 = 0; while (t0 < L && inLoop(loops[c.a][0], e.x1 + ux * t0, e.y1 + uy * t0)) t0 += 2;
      let t1 = L; while (t1 > t0 && inLoop(loops[c.b][0], e.x1 + ux * t1, e.y1 + uy * t1)) t1 -= 2;
      return { ...e, ux, uy, t0, t1 };
    });
    // A dark skirt round every shape first, so the walls read as walls on the dimmed ground.
    g.fillStyle(0x0b0705, 0.9).lineStyle(52, 0x0b0705, 0.9);
    for (const l of loops) { g.fillPoints(poly(l[0]), true); g.strokePoints(poly(l[0]), true, true); }
    for (const c of span) quad(c.x1, c.y1, c.x2, c.y2, hw + 26);
    g.fillStyle(FLOOR_SIDE, 1);
    for (const c of span) quad(c.x1, c.y1, c.x2, c.y2, hw);
    loops.forEach((l, i) => {
      g.fillStyle(themeOf(m, i).floor2d, 1).fillPoints(poly(l[0]), true);
      // Islands: dark stone plinths with a lighter stone rim, no glow (glow means lava; design, 25 Nov).
      for (let k = 1; k < l.length; k++) { g.fillStyle(0x2a2624, 1).fillPoints(poly(l[k]), true); g.lineStyle(5, 0x5a524c, 0.9).strokePoints(poly(l[k]), true, true); }
    });
    // A faint flagstone grid inside each room, so walking reads as moving (segments kept to the floor).
    g.lineStyle(1, 0x3a2c25, 0.6);
    loops.forEach((l, i) => {
      const r = m.rooms[i];
      for (let k = -r.r + 60; k < r.r; k += 60) for (const vert of [true, false]) {
        let start: number | null = null;
        for (let u = -r.r; u <= r.r + 10; u += 10) {
          const x = vert ? r.x + k : r.x + u, y = vert ? r.y + u : r.y + k, on = u <= r.r && inRoom(l, x, y);
          if (on && start === null) start = u;
          if (!on && start !== null) {
            const e0 = start + 4, e1 = u - 14;
            if (e1 > e0) g.lineBetween(vert ? x : r.x + e0, vert ? r.y + e0 : y, vert ? x : r.x + e1, vert ? r.y + e1 : y);
            start = null;
          }
        }
      }
    });
    // Ember rims: each room's outline, and the corridor sides between the rooms they join.
    g.lineStyle(4, RIM, 0.5);
    for (const l of loops) g.strokePoints(poly(l[0]), true, true);
    for (const c of span) {
      const nx = -c.uy * hw, ny = c.ux * hw;
      for (const s of [1, -1]) g.lineBetween(c.x1 + c.ux * c.t0 + nx * s, c.y1 + c.uy * c.t0 + ny * s, c.x1 + c.ux * c.t1 + nx * s, c.y1 + c.uy * c.t1 + ny * s);
    }
    // Open the rims across each corridor mouth (corridor floor drawn back over the rim line there).
    g.fillStyle(FLOOR_SIDE, 1);
    for (const c of span) {
      quad(c.x1 + c.ux * (c.t0 - 8), c.y1 + c.uy * (c.t0 - 8), c.x1 + c.ux * (c.t0 + 6), c.y1 + c.uy * (c.t0 + 6), hw - 2.5);
      quad(c.x1 + c.ux * (c.t1 - 6), c.y1 + c.uy * (c.t1 - 6), c.x1 + c.ux * (c.t1 + 8), c.y1 + c.uy * (c.t1 + 8), hw - 2.5);
    }
    // One simple prop per theme along the walls, where the 3D look stands its props.
    m.rooms.forEach((_, i) => {
      const th = themeOf(m, i);
      for (const p of themeSpots(m, i, hw, doorRoom(m))) this.prop2d(g, th.id, p.x - p.nx * 40, p.y - p.ny * 40, p.nx, p.ny);
    });
    // The boss door: a heavy arch at the end of the alcove (its glow is drawn each frame, gold once it opens).
    const dr = m.rooms[doorRoom(m)];
    g.fillStyle(0x140d0a, 1).fillRect(dr.x - 70, dr.y - dr.r - 18, 140, 30);
    g.lineStyle(3, RIM, 0.7).strokeRect(dr.x - 70, dr.y - dr.r - 18, 140, 30);
  }

  /** A theme's 2D prop at (x, y), its back to the wall whose outward normal is (nx, ny): plain shapes, no red or green. */
  private prop2d(g: Phaser.GameObjects.Graphics, id: ThemeId, x: number, y: number, nx: number, ny: number): void {
    const tx = -ny, ty = nx;
    if (id === 'ash') {
      g.fillStyle(0x6a5446, 1).fillRect(x - 14, y - 14, 28, 28);
      g.fillStyle(0x9a8e84, 1).fillEllipse(x - tx * 20, y - ty * 20, 30, 24).fillEllipse(x + tx * 18 - nx * 6, y + ty * 18 - ny * 6, 26, 22);
    } else if (id === 'bellows') {
      g.fillStyle(0x5a3424, 1).fillPoints([new Phaser.Math.Vector2(x + tx * 30, y + ty * 30), new Phaser.Math.Vector2(x - tx * 30, y - ty * 30), new Phaser.Math.Vector2(x - tx * 16 - nx * 36, y - ty * 16 - ny * 36), new Phaser.Math.Vector2(x + tx * 16 - nx * 36, y + ty * 16 - ny * 36)], true);
      g.fillStyle(0xa8683e, 1).fillCircle(x - nx * 10, y - ny * 10, 12);
      g.fillStyle(0x2e2624, 1).fillCircle(x - nx * 40, y - ny * 40, 5);
    } else if (id === 'slag') {
      g.fillStyle(0x4a302a, 1).fillCircle(x, y, 26).fillCircle(x + tx * 26, y + ty * 26, 15);
      g.fillStyle(0x7a5a48, 1).fillCircle(x, y, 8).fillCircle(x + tx * 26, y + ty * 26, 4);
    } else if (id === 'cooling') {
      g.fillStyle(0x5c666c, 1).fillCircle(x, y, 17);
      g.lineStyle(3, 0x8a989e, 1).lineBetween(x - 12, y, x + 12, y).lineBetween(x, y - 12, x, y + 12);
      g.fillStyle(0xe8f2ff, 0.12).fillCircle(x - nx * 6, y - ny * 6 - 18, 20);
    } else if (id === 'boiler') {
      g.fillStyle(0xb08a4a, 1).fillCircle(x, y, 22);
      g.lineStyle(3, 0x3a3430, 1).strokeCircle(x, y, 22);
      g.fillStyle(0x3a3430, 1).fillCircle(x + tx * 8 + nx * 6, y + ty * 8 + ny * 6, 6);
    } else if (id === 'cistern') {
      g.fillStyle(0x6a7472, 1).fillRect(x - 28, y - 18, 56, 36);
      g.fillStyle(0x2e5662, 1).fillRect(x - 22, y - 12, 44, 24);
    } else if (id === 'pump') {
      g.fillStyle(0x5a5048, 1).fillRect(x - 18, y - 16, 36, 32);
      g.fillStyle(0x6e7a78, 1).fillCircle(x, y, 13);
      g.lineStyle(4, 0x4a3a30, 1).lineBetween(x - tx * 20, y - ty * 20, x + tx * 20, y + ty * 20);
    } else if (id === 'anchor') {
      g.lineStyle(6, 0x3e4446, 1).lineBetween(x + nx * 14, y + ny * 14, x - nx * 22, y - ny * 22).lineBetween(x - nx * 22 - tx * 14, y - ny * 22 - ty * 14, x - nx * 22 + tx * 14, y - ny * 22 + ty * 14);
      g.lineStyle(4, 0x555c5e, 1).strokeCircle(x + tx * 22, y + ty * 22, 10);
    } else if (id === 'lens') {
      g.fillStyle(0xb8904a, 1).fillCircle(x, y, 18);
      g.fillStyle(0xf4e6c0, 0.9).fillCircle(x, y, 13);
      g.fillStyle(0xffe6b0, 0.12).fillCircle(x - nx * 14, y - ny * 14, 26);
    } else if (id === 'orrery') {
      g.fillStyle(0x5a5670, 1).fillCircle(x, y, 20);
      g.lineStyle(3, 0xc8a058, 1).strokeEllipse(x, y, 34, 16).strokeEllipse(x, y, 16, 34);
      g.fillStyle(0xe8e0ff, 1).fillCircle(x, y, 6);
    } else if (id === 'colonnade') {
      g.fillStyle(0x6e6a84, 1).fillRect(x - 22, y - 22, 44, 44);
      g.fillStyle(0x8a84a4, 1).fillCircle(x, y, 17);
      g.fillStyle(0x7c7898, 1).fillEllipse(x + tx * 34 - nx * 10, y + ty * 34 - ny * 10, 34, 20);
    } else if (id === 'mirror') {
      g.fillStyle(0xb8904a, 1).fillRect(x - tx * 24 - 4, y - ty * 24 - 4, 8, 8).fillRect(x + tx * 24 - 4, y + ty * 24 - 4, 8, 8);
      g.lineStyle(8, 0xb8904a, 1).lineBetween(x - tx * 24, y - ty * 24, x + tx * 24, y + ty * 24);
      g.lineStyle(4, 0xdde4f4, 1).lineBetween(x - tx * 20, y - ty * 20, x + tx * 20, y + ty * 20);
    } else if (id === 'hearthless') {
      g.fillStyle(0x5a6070, 1).fillRect(x - tx * 30 + nx * 8 - 6, y - ty * 30 + ny * 8 - 6, 12, 12).fillRect(x + tx * 30 + nx * 8 - 6, y + ty * 30 + ny * 8 - 6, 12, 12);
      g.lineStyle(10, 0x5a6070, 1).lineBetween(x - tx * 30 + nx * 8, y - ty * 30 + ny * 8, x + tx * 30 + nx * 8, y + ty * 30 + ny * 8);
      g.fillStyle(0x7c7e84, 0.9).fillEllipse(x - nx * 10, y - ny * 10, 44, 22);
      g.lineStyle(6, 0x2a2624, 1).lineBetween(x - tx * 14 - nx * 10, y - ty * 14 - ny * 10, x + tx * 14 - nx * 12, y + ty * 14 - ny * 12);
    } else if (id === 'rime') {
      g.fillStyle(0x5c6a80, 1).fillCircle(x, y, 18);
      g.fillStyle(0xd4e4f4, 1).fillCircle(x, y, 12);
    } else if (id === 'drift') {
      g.fillStyle(0xdce6f0, 0.85).fillEllipse(x, y, 60, 34).fillEllipse(x - tx * 30 - nx * 6, y - ty * 30 - ny * 6, 30, 22);
    } else if (id === 'crypt') {
      g.fillStyle(0x4a4e5e, 1).fillPoints([new Phaser.Math.Vector2(x - tx * 32 + nx * 10, y - ty * 32 + ny * 10), new Phaser.Math.Vector2(x + tx * 32 + nx * 10, y + ty * 32 + ny * 10), new Phaser.Math.Vector2(x + tx * 32 - nx * 14, y + ty * 32 - ny * 14), new Phaser.Math.Vector2(x - tx * 32 - nx * 14, y - ty * 32 - ny * 14)], true);
      g.lineStyle(2, 0xc4d0e0, 0.8).lineBetween(x - tx * 22, y - ty * 22, x + tx * 22, y + ty * 22);
    } else if (id === 'quay') {
      g.fillStyle(0x5a6062, 1).fillCircle(x, y, 14);
      g.lineStyle(4, 0xa08a64, 1).strokeCircle(x, y, 19);
      g.fillStyle(0xfff0c8, 0.9).fillCircle(x + tx * 30, y + ty * 30, 5);
    } else if (id === 'wreck') {
      g.lineStyle(5, 0x5a4434, 1);
      for (const o of [-22, 0, 22]) g.beginPath().arc(x + tx * o, y + ty * o, 20, Math.atan2(-ny, -nx) - 1, Math.atan2(-ny, -nx) + 1).strokePath();
      g.fillStyle(0x7a5a3c, 1).fillEllipse(x + tx * 36 - nx * 12, y + ty * 36 - ny * 12, 26, 18);
    } else if (id === 'kelp') {
      g.lineStyle(4, 0x4a7a52, 0.9);
      for (const o of [-16, -4, 10, 20]) g.lineBetween(x + tx * o, y + ty * o, x + tx * (o + 6) - nx * 34, y + ty * (o + 6) - ny * 34);
    } else if (id === 'anvil') {
      g.fillStyle(0x5a4030, 1).fillRect(x - 14, y - 12, 28, 24);
      g.fillStyle(0x4a4854, 1).fillRect(x - tx * 26 - 7, y - ty * 26 - 7, 14, 14).fillRect(x + tx * 20 - 6, y + ty * 20 - 6, 12, 12);
      g.lineStyle(10, 0x4a4854, 1).lineBetween(x - tx * 26, y - ty * 26, x + tx * 20, y + ty * 20);
      g.lineStyle(3, 0x6a4a30, 1).lineBetween(x + tx * 16 - nx * 18, y + ty * 16 - ny * 18, x + tx * 28 - nx * 30, y + ty * 28 - ny * 30);
    } else if (id === 'chain') {
      g.lineStyle(8, 0x5a4636, 1).lineBetween(x - tx * 32 + nx * 8, y - ty * 32 + ny * 8, x + tx * 32 + nx * 8, y + ty * 32 + ny * 8);
      g.lineStyle(3, 0x5a5866, 1);
      for (const o of [-16, 0, 16]) g.lineBetween(x + tx * o + nx * 8, y + ty * o + ny * 8, x + tx * o - nx * 18, y + ty * o - ny * 18);
    } else if (id === 'quench') {
      g.fillStyle(0x3a3a44, 1).fillRect(x - 28, y - 16, 56, 32);
      g.fillStyle(0x1e2a3a, 1).fillRect(x - 23, y - 11, 46, 22);
    } else if (id === 'ingot') {
      g.fillStyle(0x6a5038, 1).fillRect(x - 24, y - 18, 48, 36);
      g.fillStyle(0x6a6874, 1);
      for (const o of [-12, 0, 12]) g.fillRect(x + tx * o - 5, y + ty * o - 5, 10, 10);
    } else if (id === 'fumarole') {
      g.fillStyle(0x6e5e5a, 1).fillCircle(x, y, 24).fillCircle(x + tx * 26 - nx * 8, y + ty * 26 - ny * 8, 13);
      g.fillStyle(0x2a2220, 1).fillCircle(x, y, 8);
      g.fillStyle(0xe8e0dc, 0.14).fillCircle(x - nx * 6, y - ny * 6 - 20, 22);
    } else if (id === 'obsidian') {
      g.fillStyle(0x2a2228, 1);
      for (const o of [-14, 2, 16]) g.fillTriangle(x + tx * (o - 6), y + ty * (o - 6), x + tx * (o + 6), y + ty * (o + 6), x + tx * o - nx * 30, y + ty * o - ny * 30);
    } else if (id === 'cairn') {
      g.fillStyle(0x8a7a74, 1).fillCircle(x, y, 18);
      g.fillStyle(0x9a8a84, 1).fillCircle(x, y, 12);
      g.fillStyle(0x8a7a74, 1).fillCircle(x, y, 6);
      g.fillStyle(0x8e7e78, 1).fillCircle(x + tx * 26 - nx * 8, y + ty * 26 - ny * 8, 9);
    } else if (id === 'pumice') {
      g.fillStyle(0xd0c4bc, 1).fillCircle(x, y, 20);
      g.fillStyle(0xc4b6ae, 1).fillCircle(x - tx * 24 - nx * 6, y - ty * 24 - ny * 6, 13);
      g.fillStyle(0xdacec6, 1).fillCircle(x + tx * 22 - nx * 8, y + ty * 22 - ny * 8, 11);
    } else if (id === 'press') {
      g.fillStyle(0x4a4a36, 1).fillRect(x - 24, y - 16, 48, 32);
      g.lineStyle(7, 0x8a8058, 1).lineBetween(x - tx * 26 + nx * 8, y - ty * 26 + ny * 8, x + tx * 26 + nx * 8, y + ty * 26 + ny * 8);
      g.fillStyle(0x5a5a42, 1).fillRect(x - 10, y - 10, 20, 20);
    } else if (id === 'gear') {
      g.lineStyle(7, 0xa08848, 1).strokeCircle(x + nx * 6, y + ny * 6, 18);
      g.fillStyle(0x5a4a2a, 1).fillCircle(x + nx * 6, y + ny * 6, 6);
    } else if (id === 'plate') {
      g.fillStyle(0x6a5038, 1).fillRect(x - 26, y - 18, 52, 36);
      g.fillStyle(0x9a9a80, 1).fillRect(x - tx * 12 - 10, y - ty * 12 - 10, 20, 20).fillRect(x + tx * 12 - 10, y + ty * 12 - 10, 20, 20);
    } else if (id === 'oil') {
      g.fillStyle(0x4e5a38, 1).fillCircle(x - tx * 12, y - ty * 12, 11).fillCircle(x + tx * 12, y + ty * 12, 11);
      g.fillStyle(0x2a2a1e, 1).fillCircle(x - tx * 12, y - ty * 12, 8).fillCircle(x + tx * 12, y + ty * 12, 8);
    } else if (id === 'ladle' || id === 'crane' || id === 'hoist' || id === 'scale' || id === 'damper') {
      // H5's hanging props, seen from above: the bracket on the wall and what hangs under it.
      const steel = id === 'hoist';
      g.lineStyle(7, steel ? 0x3a3e48 : 0x4a3a36, 1).lineBetween(x - tx * 24, y - ty * 24, x + tx * 24, y + ty * 24);
      if (id === 'ladle') { g.fillStyle(0xa8644a, 1).fillCircle(x - nx * 14, y - ny * 14, 16); g.fillStyle(0x5a3628, 1).fillCircle(x - nx * 14, y - ny * 14, 11); }
      else if (id === 'scale') { g.lineStyle(4, 0xb08848, 1).lineBetween(x - tx * 22 - nx * 10, y - ty * 22 - ny * 10, x + tx * 22 - nx * 10, y + ty * 22 - ny * 10); g.fillStyle(0xc09a50, 1).fillCircle(x - tx * 22 - nx * 10, y - ty * 22 - ny * 10, 8).fillCircle(x + tx * 22 - nx * 10, y + ty * 22 - ny * 10, 8); }
      else if (id === 'damper') g.fillStyle(0x5a4c44, 1).fillRect(x - nx * 8 - 16, y - ny * 8 - 16, 32, 32);
      else { g.fillStyle(steel ? 0x8a90a0 : 0xb07a5a, 1).fillRect(x - nx * 14 - 8, y - ny * 14 - 8, 16, 16); }
    } else if (id === 'mould') {
      g.fillStyle(0x4a3632, 1).fillRect(x - 26, y - 18, 52, 36);
      g.fillStyle(0x3a2622, 1); for (const k of [-1, 0, 1]) for (const j of [-1, 1]) g.fillRect(x + tx * k * 16 + nx * j * 8 - 6, y + ty * k * 16 + ny * j * 8 - 5, 12, 10);
    } else if (id === 'clinker' || id === 'soot') {
      const a = id === 'clinker' ? 0x8a5a4c : 0x5a5250, b = id === 'clinker' ? 0xa06a58 : 0x6e6460;
      g.fillStyle(a, 1).fillCircle(x, y, 22).fillCircle(x + tx * 24 - nx * 6, y + ty * 24 - ny * 6, 12);
      g.fillStyle(b, 1).fillCircle(x - tx * 4, y - ty * 4, 10);
    } else if (id === 'bunker') {
      g.lineStyle(5, 0x6a4a32, 1).strokeRect(x - 26, y - 18, 52, 36);
      g.fillStyle(0x2a2224, 1).fillCircle(x, y, 15).fillCircle(x + tx * 12, y + ty * 12, 10);
    } else if (id === 'coffer') {
      g.fillStyle(0x6a4630, 1).fillRect(x - tx * 10 - 13, y - ty * 10 - 10, 26, 20).fillRect(x + tx * 16 - 10, y + ty * 16 - 8, 20, 16);
      g.fillStyle(0xc09a50, 1).fillCircle(x - tx * 10, y - ty * 10, 3);
    } else if (id === 'tithe' ) {
      g.fillStyle(0xa8947a, 1).fillCircle(x - tx * 14, y - ty * 14, 13).fillCircle(x + tx * 12, y + ty * 12, 12);
      g.lineStyle(4, 0x6a5040, 1).lineBetween(x - tx * 24 + nx * 8, y - ty * 24 + ny * 8, x + tx * 24 + nx * 8, y + ty * 24 + ny * 8);
    } else if (id === 'tap' || id === 'firebox') {
      g.fillStyle(id === 'tap' ? 0x4a4e5a : 0x5a4038, 1).fillRect(x - 24, y - 16, 48, 32);
      g.fillStyle(0x22242a, 1).fillRect(x - 9, y - 7, 18, 14);
      if (id === 'tap') g.lineStyle(6, 0x3a3e48, 1).lineBetween(x, y, x - nx * 34, y - ny * 34);
    } else if (id === 'flywheel') {
      g.lineStyle(7, 0x7a8090, 1).strokeCircle(x + nx * 6, y + ny * 6, 18);
      g.fillStyle(0x3a3e48, 1).fillCircle(x + nx * 6, y + ny * 6, 6);
    } else if (id === 'billet') {
      g.fillStyle(0x3a3e48, 1).fillRect(x - 26, y - 16, 52, 32);
      g.fillStyle(0x8a90a0, 1); for (const k of [-1, 0, 1]) g.fillRect(x - 22 + (k + 1) * 0, y + k * 9 - 3, 44, 6);
    } else if (id === 'sweep') {
      g.lineStyle(4, 0x8a6a48, 1).lineBetween(x - tx * 24, y - ty * 24, x + tx * 8, y + ty * 8);
      g.fillStyle(0x2e2a28, 1).fillCircle(x + tx * 18, y + ty * 18, 8).fillCircle(x + tx * 28, y + ty * 28, 8);
    } else if (id === 'sluice') {
      g.lineStyle(10, 0x3e4446, 1).lineBetween(x - tx * 28, y - ty * 28, x + tx * 28, y + ty * 28);
      g.lineStyle(3, 0x6e7a7c, 1).strokeCircle(x - nx * 10, y - ny * 10, 10);
    } else {
      g.fillStyle(0x8a6a4a, 1).fillRect(x + nx * 10 - 22, y + ny * 10 - 22, 44, 44);
      g.fillStyle(0x3a2a1e, 1).fillRect(x + nx * 10 - 12, y + ny * 10 - 12, 24, 24);
      for (const o of [-16, 0, 16]) g.fillStyle(0xfff2b0, 0.95).fillCircle(x + tx * o - nx * 18, y + ty * o - ny * 18, 3.5);
    }
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
    const dr = m.rooms[doorRoom(m)];
    if (guard?.state === 'cleared') g.lineStyle(6, 0xffc861, 0.55 + 0.25 * Math.sin(f.now / 300)).strokeRect(dr.x - 74, dr.y - dr.r - 22, 148, 38);
  }

  /**
   * H2b ember grates (client/hallsgrates.ts): a sealing room's doorways glow red for 1 s (red is bad), then a row of
   * iron bars, hot at the tips, drops across each; they lift once the room is cleared. The 3D look draws its own.
   */
  private drawGrates(m: HallsMap, f: HallsFrame, g: Phaser.GameObjects.Graphics): void {
    this.grates ??= hallsGrates(m, HALLS.corridor, doorRoom(m));
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
    // Phones (keep it simple, Steve 25 Nov): no map in a fight. The Map button sat on the target frame's corner, and a
    // fight is no time to read a map; a map left open closes when a pack wakes.
    const fighting = f.compact && this.world.phase === 'fight';
    if (fighting && this.open) { this.open = false; this.mapStamp = ''; }
    const show = !f.compact || this.open;
    this.mapBox.hidden = !show;
    this.mapBtn.hidden = !f.compact || fighting;
    this.mapBtn.textContent = this.open ? 'Close' : 'Map';
    this.mapBox.classList.toggle('big', f.compact && this.open);
    if (!show) return;
    // The map's bounds in world units (H2c rooms by their outline, H1's by their circle), cached: the map never moves.
    this.bounds ??= mapBounds(m);
    const { x0, x1, y0, y1 } = this.bounds;
    // The sheet takes the map's shape inside its box: generated maps are tall (about 5,000 by 3,000), so a square sheet
    // would waste the sides of a phone and shrink every room. Desktop's corner map stays inside 128 x 128; a phone's
    // opened map inside 86% of the width and 62% of the height (clear of the top row and the action bar's top).
    const big = f.compact && this.open;
    let boxW = 128, boxH = 128;
    let place: { left: number; top: number } | null = null;
    if (big) {
      // A phone's opened map takes the larger of two clear areas: above the action bar (full width), or beside it
      // (landscape: the bar holds the bottom right). Both start under the Map button, so the top row stays readable.
      const W = window.innerWidth, H = window.innerHeight, g = 8;
      const top = (this.mapBtn.getBoundingClientRect().bottom || 98) + g;
      const bar = document.getElementById('actionbar')?.getBoundingClientRect();
      const barTop = bar && bar.height ? bar.top : H, barLeft = bar && bar.width ? bar.left : W;
      let areas = [
        { left: 12, top, w: W - 24, h: barTop - g - top },
        { left: 12, top, w: barLeft - g - 12, h: H - 12 - top },
      ];
      // Party frames win (design, 25 Nov: health keeps a party alive): an area that would cover them gives way to the
      // part of it beside the frames or below them, whichever fits the map bigger.
      const pe = document.getElementById('party');
      const pr = pe && !pe.hidden && pe.childElementCount ? pe.getBoundingClientRect() : null;
      if (pr && pr.width && pr.height) {
        areas = areas.flatMap((a) => {
          if (pr.right + g <= a.left || pr.left - g >= a.left + a.w || pr.bottom + g <= a.top || pr.top - g >= a.top + a.h) return [a];
          const r = Math.ceil(pr.right) + g, b = Math.ceil(pr.bottom) + g;
          return [{ left: r, top: a.top, w: a.left + a.w - r, h: a.h }, { left: a.left, top: b, w: a.w, h: a.top + a.h - b }];
        });
      }
      areas = areas.filter((a) => a.w > 80 && a.h > 80);
      const scaleOf = (a: { w: number; h: number }) => Math.min((a.w - 16) / (x1 - x0), (a.h - 16) / (y1 - y0));
      const a = areas.sort((p, q) => scaleOf(q) - scaleOf(p))[0] ?? { left: 12, top, w: W - 24, h: H - top - 12 };
      boxW = Math.round(a.w); boxH = Math.round(a.h);
      place = a;
    }
    const fit = Math.min(boxW / (x1 - x0), boxH / (y1 - y0));
    const cw = Math.max(64, Math.round(Math.min(boxW, (x1 - x0) * fit + 16))), chh = Math.max(64, Math.round(Math.min(boxH, (y1 - y0) * fit + 16)));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // Redrawn about 6 times a second (enough for dots walking), or at once when something changed.
    const locks = m.rooms.map((r) => { const l = lockOf(r); return l < 0 ? '-' : l < GRATE_WARN ? 'w' : 's'; }).join('');
    const stamp = `${cw}x${chh}|${m.seen.join('')}|${m.packs.map((p) => p.state[1]).join('')}|${locks}|${Math.floor(f.now / 160)}`;
    if (stamp === this.mapStamp) return;
    this.mapStamp = stamp;
    // Centred in its clear area (inline, so the stylesheet's centring is only the fallback).
    if (place) {
      this.mapBox.style.left = `${Math.round(place.left + (boxW - cw) / 2)}px`;
      this.mapBox.style.top = `${Math.round(place.top + (boxH - chh) / 2)}px`;
      this.mapBox.style.transform = 'none';
      this.mapBox.style.bottom = 'auto';
    } else this.mapBox.style.left = this.mapBox.style.top = this.mapBox.style.transform = this.mapBox.style.bottom = '';
    const cv = this.mapCanvas;
    if (cv.width !== cw * dpr || cv.height !== chh * dpr) { cv.width = cw * dpr; cv.height = chh * dpr; cv.style.width = `${cw}px`; cv.style.height = `${chh}px`; }
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const pad = 8 * dpr, SW = cw * dpr, SH = chh * dpr;
    const sc = Math.min((SW - 2 * pad) / (x1 - x0), (SH - 2 * pad) / (y1 - y0));
    const ox = (SW - (x1 - x0) * sc) / 2 - x0 * sc, oy = (SH - (y1 - y0) * sc) / 2 - y0 * sc;
    const X = (x: number) => ox + x * sc, Y = (y: number) => oy + y * sc;
    // A room's floor as a path: its outline loops (outer wall, then islands, cut out by even-odd), or its circle.
    const roomPath = (i: number, outerOnly = false) => {
      const r = m.rooms[i], edge = edgeOf(r);
      ctx.beginPath();
      if (!edge) { ctx.arc(X(r.x), Y(r.y), r.r * sc, 0, Math.PI * 2); return; }
      for (const loop of outerOnly ? edge.slice(0, 1) : edge) {
        for (let k = 0; k < loop.length; k += 2) (k ? ctx.lineTo(X(loop[k]), Y(loop[k + 1])) : ctx.moveTo(X(loop[k]), Y(loop[k + 1])));
        ctx.closePath();
      }
    };
    ctx.clearRect(0, 0, SW, SH);
    ctx.fillStyle = 'rgba(12, 8, 6, 0.78)';
    ctx.fillRect(0, 0, SW, SH);
    // Corridors to or between seen rooms (from end to end: H2c's doorways sit off the room centres), then the rooms.
    ctx.strokeStyle = 'rgba(150, 120, 100, 0.85)';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, HALLS.corridor * sc);
    for (const c of m.corridors) {
      if (!m.seen[c.a] && !m.seen[c.b]) continue;
      const e = corridorEnds(m, c);
      ctx.beginPath(); ctx.moveTo(X(e.x1), Y(e.y1)); ctx.lineTo(X(e.x2), Y(e.y2)); ctx.stroke();
    }
    m.rooms.forEach((_, i) => {
      roomPath(i);
      ctx.fillStyle = m.seen[i] ? 'rgba(120, 92, 74, 0.95)' : 'rgba(40, 30, 26, 0.9)';
      ctx.fill('evenodd');
    });
    // H2b: a sealing or sealed room. Red is bad: its outer wall turns red (pulsing for the 1 s warning, solid once the
    // grates are down) and a red bar closes each of its doorways, so a phone shows at a glance which room you can't walk
    // out of (or, in co-op, into).
    const sealing = m.rooms.map((r) => lockOf(r));
    if (sealing.some((l) => l >= 0)) {
      this.doors ??= mapDoors(m);
      const blink = 0.55 + 0.45 * Math.abs(Math.sin(f.now / 140));
      m.rooms.forEach((_, i) => {
        const l = sealing[i];
        if (l < 0 || !m.seen[i]) return;
        const down = l >= GRATE_WARN;
        roomPath(i, true);
        ctx.strokeStyle = down ? '#ff4d3d' : `rgba(255, 77, 61, ${blink.toFixed(2)})`;
        ctx.lineWidth = (down ? 2.5 : 2) * dpr;
        ctx.stroke();
      });
      ctx.lineCap = 'butt';
      for (const d of this.doors) {
        const l = sealing[d.room];
        if (l < 0 || !m.seen[d.room]) continue;
        // A bar across the corridor a few px out from the wall (on the wall it would vanish into the red outline), a
        // little wider than the corridor so it reads as a gate at phone size.
        const down = l >= GRATE_WARN, tx = -d.uy, ty = d.ux, w = Math.max(4 * dpr, (HALLS.corridor / 2) * sc * 1.5 + 1.5 * dpr);
        const cx = X(d.x) + d.ux * 5 * dpr, cy = Y(d.y) + d.uy * 5 * dpr;
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
    // Grates let heroes in, never out (#731, co-op only): shut out of your party's room, the arrow and tag turn green
    // (green is good) and say "Walk in", since the red bars alone read as a wall (phone pass, Hammerdeep Halls, 25 Nov).
    const walkIn = !!shut && this.world.heroes.length > 1;
    this.arrow.classList.toggle('sealed', !!shut && !walkIn);
    this.arrow.classList.toggle('in', walkIn);
    this.tag.classList.toggle('in', walkIn);
    const label = walkIn ? 'Walk in' : 'Sealed';
    if (this.tag.textContent !== label) this.tag.textContent = label;
    this.tag.hidden = true;
    if (!goal) { this.arrow.hidden = true; return; }
    const wp = hallsWay(m, f.px, f.py, goal.x, goal.y);
    const at = f.project(wp.x, wp.y);
    const W = f.rect.width, H = f.rect.height;
    const inset = 40;
    if (walkIn) {
      // The room's nearest doorway in view: the tag stands on its grate, so you see where to walk in.
      this.grates ??= hallsGrates(m, HALLS.corridor, doorRoom(m));
      let best: Grate | null = null, bd = Infinity;
      for (const gr of this.grates) {
        if (gr.room !== shut!.i) continue;
        const d = Math.hypot(gr.x - f.px, gr.y - f.py);
        if (d < bd) { bd = d; best = gr; }
      }
      const gp = best ? f.project(best.x + best.ux * 120, best.y + best.uy * 120) : null; // inside, past the bars: clear of them and your hero
      if (gp && gp.x > 30 && gp.x < W - 30 && gp.y > 60 && gp.y < H - 14) {
        this.arrow.hidden = true;
        this.tag.hidden = false;
        this.tag.style.transform = `translate(${f.rect.left + gp.x}px, ${f.rect.top + gp.y}px) translate(-50%, -50%)`;
        return;
      }
    }
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
  private shutOut(m: HallsMap, x: number, y: number): { x: number; y: number; i: number } | null {
    if (this.world.player.hp <= 0) return null;
    const here = roomAt(m, x, y);
    for (let i = 0; i < m.rooms.length; i++) {
      const r = m.rooms[i];
      if (lockOf(r) < GRATE_WARN || here === i) continue;
      return { x: r.x, y: r.y, i };
    }
    return null;
  }

  /** The next main-path room past the furthest one any hero has seen (hallsWay finds the way there from anywhere). */
  private nextGoal(m: HallsMap, x: number, y: number): { x: number; y: number } | null {
    if (roomAt(m, x, y) === doorRoom(m)) return null;
    let far = 0;
    const main = mainRooms(m);
    main.forEach((r, i) => { if (m.seen[r]) far = i; });
    const r = m.rooms[main[Math.min(main.length - 1, far + 1)]];
    return { x: r.x, y: r.y };
  }
}

/** H2c: a room's outline loops (flat x, y lists, outer wall first, then islands), or undefined for H1's circles. */
function edgeOf(r: HallsRoom): number[][] | undefined {
  const e = (r as HallsRoom & { edge?: number[][] }).edge;
  return e && e.length && e[0].length >= 6 ? e : undefined;
}

/** The whole map's extent in world units: every room's outline (or circle), and every corridor's ends. */
export function mapBounds(m: HallsMap): { x0: number; x1: number; y0: number; y1: number } {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const add = (x: number, y: number, r = 0) => { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); };
  for (const r of m.rooms) {
    const e = edgeOf(r);
    if (!e) add(r.x, r.y, r.r);
    else for (let k = 0; k < e[0].length; k += 2) add(e[0][k], e[0][k + 1]);
  }
  for (const c of m.corridors) { const e = corridorEnds(m, c); add(e.x1, e.y1, HALLS.corridor / 2); add(e.x2, e.y2, HALLS.corridor / 2); }
  return { x0, x1, y0, y1 };
}

/** A room's doorway on the map: where a corridor leaves its floor, and the way out along the corridor (unit vector). */
export interface MapDoor { room: number; x: number; y: number; ux: number; uy: number }

/**
 * Every doorway of every room but the boss door's alcove: walking each corridor's centre line out from its end in a
 * room until the point leaves that room's floor (roomAt), so it works for any outline, not only circles.
 */
export function mapDoors(m: HallsMap): MapDoor[] {
  const out: MapDoor[] = [];
  for (const c of m.corridors) {
    const e = corridorEnds(m, c);
    for (const [room, sx, sy, tx, ty] of [[c.a, e.x1, e.y1, e.x2, e.y2], [c.b, e.x2, e.y2, e.x1, e.y1]]) {
      if (room === doorRoom(m)) continue;
      const dx = tx - sx, dy = ty - sy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      let t = 0;
      while (t < L && roomAt(m, sx + ux * t, sy + uy * t) === room) t += 8;
      out.push({ room, x: sx + ux * t, y: sy + uy * t, ux, uy });
    }
  }
  return out;
}
