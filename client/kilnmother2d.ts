/**
 * The three-stage Kiln Mother in the 2D look (the 3D look draws its own: client/hd2d/kilnmother3d.ts). Her ember
 * eggs in a gold "go here" ring, the heated quarters (red, the safe one left plain), the eruption rings with their gaps
 * left plain, and the great kiln's mouth at the north wall, roaring while she is inside. Keep it simple: one look for
 * each meaning, the same as 3D.
 */
import Phaser from 'phaser';
import type { KmWorld } from './hd2d/kilnmother3d';

const RED = 0xff4d3d;
const GOLD = 0xffc861;
const WOBBLE = 1.5;
const HEAT_WARN = 1.5;

/** The great kiln's mouth (sim KM_MOUTH: x 0, y -522, 120 wide). */
const MOUTH = { x: 0, y: -522, w: 120 };

export function drawKm2d(g: Phaser.GameObjects.Graphics, w: KmWorld, arena: number, now: number): void {
  if (!w.kmStage) return;
  const t = now / 1000;
  // The great kiln's mouth: a brick arch at the north wall with fire inside; it roars while she is in it.
  const roar = w.kmInKiln ? 0.75 + 0.25 * Math.sin(t * 7) : 0.35;
  g.fillStyle(0x3a2018, 1).fillRoundedRect(MOUTH.x - MOUTH.w / 2 - 14, MOUTH.y - 70, MOUTH.w + 28, 84, 20);
  g.fillStyle(0xff8a3d, roar).fillRoundedRect(MOUTH.x - MOUTH.w / 2, MOUTH.y - 56, MOUTH.w, 62, 16);
  g.fillStyle(0xfff2c4, roar * 0.7).fillEllipse(MOUTH.x, MOUTH.y - 6, MOUTH.w * 0.6, 22);
  // Heated quarters: the three that aren't safe pulse red through the 1.5 s warning, then burn steady.
  const h = w.kmHeat;
  if (h) for (let q = 0; q < 4; q++) {
    if (q === h.safe) continue;
    let a = 0;
    if (h.on) a = 0.32 + 0.04 * Math.sin(t * 3 + q);
    else if (h.warn > 0) { const k = 1 - Math.min(1, h.warn / HEAT_WARN); a = (0.06 + 0.18 * k) * (0.7 + 0.3 * Math.sin(t * (8 + 8 * k))); }
    if (a <= 0) continue;
    const c = (q * Math.PI) / 2;
    g.fillStyle(RED, a).slice(0, 0, arena, c - Math.PI / 4, c + Math.PI / 4, false).fillPath();
    // A bright edge, as on every telegraph, so the line between hot and safe floor is sharp.
    g.lineStyle(3, RED, Math.min(1, a * 2.4)).slice(0, 0, arena, c - Math.PI / 4, c + Math.PI / 4, false).strokePath();
  }
  // Eruption rings: a red band with its two gaps open.
  for (const r of w.kmRings ?? []) {
    if (!r.alive) continue;
    const gaps: [number, number][] = [];
    for (let k = 0; k + 1 < r.gaps.length; k += 2) gaps.push([r.gaps[k], r.gaps[k + 1]]);
    gaps.sort((a, b) => a[0] - b[0]);
    g.lineStyle(r.w, RED, 0.8);
    if (!gaps.length) g.strokeCircle(r.x, r.y, r.r);
    for (let k = 0; k < gaps.length; k++) {
      const a0 = gaps[k][0] + gaps[k][1] / 2, nx = gaps[(k + 1) % gaps.length];
      let a1 = nx[0] - nx[1] / 2;
      if (a1 <= a0) a1 += Math.PI * 2;
      g.beginPath().arc(r.x, r.y, r.r, a0, a1, false).strokePath();
    }
  }
  // Eggs: a gold ring (stamp it), a dark shell with glowing cracks, wobbling over its last 1.5 s.
  for (const e of w.kmEggs ?? []) {
    if (!e.alive) continue;
    const k = Math.max(0, Math.min(1, 1 - (e.dur - e.t) / WOBBLE)), wob = k * 5 * Math.sin(t * (14 + 10 * k));
    g.lineStyle(3, GOLD, 0.8).strokeCircle(e.x, e.y, 30);
    g.fillStyle(0x000000, 0.3).fillEllipse(e.x, e.y + 10, 26, 9);
    g.fillStyle(0x3a2018, 1).fillEllipse(e.x + wob, e.y - 4, 22, 28);
    g.fillStyle(0xff7a30, 0.45 + 0.5 * k).fillEllipse(e.x + wob, e.y - 4, 8, 14);
  }
}
