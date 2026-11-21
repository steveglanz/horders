/**
 * Original art, drawn in code. Nothing here is borrowed; every texture can be
 * swapped for painted art later by loading an image with the same key.
 *
 * Characters are drawn at SPRITE_RES times their world size so they stay crisp
 * when the camera zooms in on big screens, and each one is a short sprite sheet
 * (frames '0'..'n-1') for its walk or idle cycle. Soft glows stay at 1x.
 */
import Phaser from 'phaser';
import { BOT_GLYPH } from './icons';

export const SPRITE_RES = 2;

type Ctx = CanvasRenderingContext2D;
type Draw = (ctx: Ctx, s: number) => void;
type FrameDraw = (ctx: Ctx, s: number, f: number) => void;

/** Frame counts for animated sheets, read by the scene. */
export const FRAMES: Record<string, number> = {};

function make(scene: Phaser.Scene, key: string, size: number, draw: Draw): void {
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return;
  draw(tex.getContext(), size);
  tex.refresh();
}

/** A row of `frames` hi-res frames of logical size `s`, drawn in logical units. */
function sheet(scene: Phaser.Scene, key: string, s: number, frames: number, draw: FrameDraw): void {
  const px = s * SPRITE_RES;
  const tex = scene.textures.createCanvas(key, px * frames, px);
  if (!tex) return;
  const ctx = tex.getContext();
  for (let f = 0; f < frames; f++) {
    ctx.save();
    ctx.translate(f * px, 0);
    ctx.scale(SPRITE_RES, SPRITE_RES);
    ctx.beginPath();
    ctx.rect(0, 0, s, s);
    ctx.clip();
    draw(ctx, s, f);
    ctx.restore();
    tex.add(String(f), 0, f * px, 0, px, px);
  }
  tex.refresh();
  FRAMES[key] = frames;
}

function glow(ctx: Ctx, s: number, inner: string, outer: string, core = 0.15): void {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(core, inner);
  g.addColorStop(0.55, outer);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

// ------------------------------------------------------------------ helpers

const INK = 'rgba(12,5,6,0.92)';

function ell(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

/** Fill the current path with a top-lit gradient and a dark outline. */
function shade(ctx: Ctx, top: string, bottom: string, y0: number, y1: number, line = 1.4): void {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = line;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function eyes(ctx: Ctx, pts: [number, number][], r: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 3;
  for (const [x, y] of pts) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff8e0';
  ctx.shadowBlur = 0;
  for (const [x, y] of pts) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Glowing lava cracks: a jagged polyline with a soft halo. */
function cracks(ctx: Ctx, lines: [number, number][][], color: string, w = 1): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 4;
  ctx.lineWidth = w;
  for (const l of lines) {
    ctx.beginPath();
    l.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
  ctx.restore();
}

function limb(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, color: string): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + 2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.restore();
}

function softGlow(ctx: Ctx, x: number, y: number, r: number, color: string, a = 1): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// ------------------------------------------------------------------ characters

/** The Emberwright: a hooded pyromancer with an ember-tipped staff. Faces right. */
function drawPlayer(ctx: Ctx, _s: number, f: number): void {
  const bob = [0, -1, 0, -1][f];
  const sway = [-1.6, 0, 1.6, 0][f];
  const step = [1, 0, -1, 0][f];
  // Feet peeking under the robe.
  ctx.fillStyle = '#1a0f14';
  ell(ctx, 20 + step * 2, 43.5, 3, 1.6); ctx.fill();
  ell(ctx, 28 - step * 2, 43.5, 3, 1.6); ctx.fill();
  // Staff, held forward.
  limb(ctx, 35, 14 + bob, 32, 45, 2.2, '#6b4426');
  softGlow(ctx, 35.5, 11 + bob, 9, 'rgba(255,170,70,0.9)');
  ctx.save();
  ctx.translate(35.5, 11 + bob);
  ctx.beginPath();
  ctx.moveTo(0, -4.5); ctx.lineTo(2.6, 0); ctx.lineTo(0, 4); ctx.lineTo(-2.6, 0); ctx.closePath();
  ctx.fillStyle = '#ffe9a8'; ctx.fill();
  ctx.lineWidth = 0.8; ctx.strokeStyle = '#a8461a'; ctx.stroke();
  ctx.restore();
  // Robe.
  ctx.beginPath();
  ctx.moveTo(18, 19 + bob);
  ctx.quadraticCurveTo(24, 16 + bob, 30, 19 + bob);
  ctx.lineTo(36 + sway, 42);
  ctx.quadraticCurveTo(24 + sway * 0.5, 45, 12 + sway, 42);
  ctx.closePath();
  shade(ctx, '#55306a', '#22122c', 18, 44);
  // Ember trim along the hem and a sash.
  ctx.save();
  ctx.strokeStyle = '#ff9a3d';
  ctx.shadowColor = '#ff7a2f';
  ctx.shadowBlur = 3;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(13 + sway, 40.8);
  ctx.quadraticCurveTo(24 + sway * 0.5, 43.6, 35 + sway, 40.8);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#c4552a';
  ctx.fillRect(18.5, 29 + bob, 12, 2.2);
  // Ember core on the chest.
  softGlow(ctx, 24.5, 25 + bob, 6, 'rgba(255,200,110,0.95)');
  // Arm reaching to the staff.
  limb(ctx, 27, 23 + bob, 33, 27 + bob, 3.6, '#43264f');
  ctx.fillStyle = '#e2b48a';
  ell(ctx, 33.5, 27 + bob, 1.8, 1.8); ctx.fill();
  // Hood with a swept-back point.
  ctx.beginPath();
  ctx.moveTo(15, 9 + bob);
  ctx.quadraticCurveTo(22, 4 + bob, 28, 8 + bob);
  ctx.quadraticCurveTo(33, 13 + bob, 31, 20 + bob);
  ctx.quadraticCurveTo(24, 23 + bob, 18, 20 + bob);
  ctx.quadraticCurveTo(15, 15 + bob, 15, 9 + bob);
  ctx.closePath();
  shade(ctx, '#6a3c80', '#341c40', 4, 22);
  // Face in shadow, with ember eyes.
  ell(ctx, 26.5, 15 + bob, 3.8, 4.2); ctx.fillStyle = '#0c0509'; ctx.fill();
  eyes(ctx, [[25.6, 14.8 + bob], [28.4, 14.8 + bob]], 0.9, '#ffcf70');
}

/** The Duskblade: a cloaked skirmisher with twin curved blades. Faces right. */
function drawDuskblade(ctx: Ctx, _s: number, f: number): void {
  const bob = [0, -1, 0, -1][f];
  const step = [1.5, 0, -1.5, 0][f];
  const flap = [0, 1.5, 3, 1.5][f];
  ctx.fillStyle = '#120c18';
  ell(ctx, 20 + step * 2, 43.5, 3, 1.6); ctx.fill();
  ell(ctx, 28 - step * 2, 43.5, 3, 1.6); ctx.fill();
  // Back blade, held low.
  ctx.save();
  ctx.translate(15, 29 + bob);
  ctx.rotate(2.5);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.quadraticCurveTo(7, -3, 15, -1); ctx.quadraticCurveTo(7, 1, 0, 1.6); ctx.closePath();
  shade(ctx, '#f4ecff', '#8a7aa8', -3, 2, 0.8);
  ctx.restore();
  // Cloak streaming behind.
  ctx.beginPath();
  ctx.moveTo(19, 18 + bob);
  ctx.quadraticCurveTo(10 - flap, 28, 9 - flap, 41);
  ctx.quadraticCurveTo(18, 43, 24, 40);
  ctx.lineTo(30, 20 + bob);
  ctx.closePath();
  shade(ctx, '#3a2456', '#140c20', 18, 42);
  // Body: a lean leather tunic.
  ctx.beginPath();
  ctx.moveTo(19, 19 + bob);
  ctx.quadraticCurveTo(25, 17 + bob, 30, 20 + bob);
  ctx.lineTo(32, 38);
  ctx.quadraticCurveTo(25, 41, 18, 38);
  ctx.closePath();
  shade(ctx, '#3b2a4a', '#1a1222', 18, 40);
  ctx.fillStyle = '#e0465a';
  ctx.fillRect(18.5, 29 + bob, 13, 1.8);
  // Front arm and blade, raised to strike.
  limb(ctx, 27, 23 + bob, 33, 26 + bob, 3.2, '#2c1f3a');
  ctx.save();
  ctx.translate(34, 26 + bob);
  ctx.rotate(-0.9);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, -3.5, 17, -1); ctx.quadraticCurveTo(8, 1.2, 0, 1.8); ctx.closePath();
  shade(ctx, '#ffffff', '#9c8cc0', -3.5, 2, 0.8);
  ctx.restore();
  softGlow(ctx, 41, 16 + bob, 5, 'rgba(200,170,255,0.6)');
  // Hood and mask.
  ctx.beginPath();
  ctx.moveTo(17, 9 + bob);
  ctx.quadraticCurveTo(23, 4 + bob, 29, 8 + bob);
  ctx.quadraticCurveTo(32, 13 + bob, 30, 19 + bob);
  ctx.quadraticCurveTo(24, 22 + bob, 19, 19 + bob);
  ctx.quadraticCurveTo(16, 14 + bob, 17, 9 + bob);
  ctx.closePath();
  shade(ctx, '#4b3268', '#22163a', 4, 21);
  ell(ctx, 26.5, 14.5 + bob, 3.6, 3.4); ctx.fillStyle = '#0b0710'; ctx.fill();
  ctx.fillStyle = '#2a1d38';
  ctx.fillRect(22.5, 16 + bob, 8, 3);
  eyes(ctx, [[25.6, 14 + bob], [28.4, 14 + bob]], 0.85, '#e0465a');
}

/** Ashling: a small hunched imp of cinders. */
function drawAshling(ctx: Ctx, _s: number, f: number): void {
  const hop = [0, -1.5, -2, -0.6][f];
  const leg = [1, 0, -1, 0][f];
  limb(ctx, 9, 17 + hop, 8 - leg, 21, 1.6, '#2c242f');
  limb(ctx, 14, 17 + hop, 15 + leg, 21, 1.6, '#2c242f');
  // Body.
  ell(ctx, 12, 13.5 + hop, 6.6, 5.6);
  shade(ctx, '#7a6a80', '#2e2632', 8, 19, 1.1);
  // Horns.
  ctx.fillStyle = '#1d161f';
  ctx.beginPath(); ctx.moveTo(10, 9 + hop); ctx.lineTo(8, 4.5 + hop); ctx.lineTo(12, 8.5 + hop); ctx.fill();
  ctx.beginPath(); ctx.moveTo(14, 8.6 + hop); ctx.lineTo(16.5, 4.4 + hop); ctx.lineTo(16, 9.5 + hop); ctx.fill();
  // Claw reaching forward.
  limb(ctx, 16, 14 + hop, 20, 13 + hop - leg, 1.4, '#3a3040');
  cracks(ctx, [[[8, 13 + hop], [10, 15 + hop], [9, 17 + hop]]], '#ff7a3c', 0.8);
  eyes(ctx, [[13.6, 12 + hop], [16.4, 12 + hop]], 1.1, '#ff5a3c');
}

/** Slagling (the raid): a squat blob of molten slag, its crust cooling dark over a bright core. */
function drawSlagling(ctx: Ctx, _s: number, f: number): void {
  const sq = [0, 0.8, 0, -0.6][f];
  const drip = [0, 1, 2, 1][f];
  softGlow(ctx, 13, 17, 11, 'rgba(255,120,40,0.55)');
  // A molten puddle under it.
  ell(ctx, 13, 22.5, 8 + sq, 2);
  ctx.fillStyle = 'rgba(255,120,40,0.7)';
  ctx.fill();
  // The body: a wide, sagging blob.
  ctx.beginPath();
  ctx.moveTo(4.5 - sq, 22);
  ctx.quadraticCurveTo(3 - sq, 12 + sq, 9, 8.5 + sq);
  ctx.quadraticCurveTo(13, 5.5 + sq, 17.5, 8.5 + sq);
  ctx.quadraticCurveTo(23 + sq, 12 + sq, 21.5 + sq, 22);
  ctx.closePath();
  shade(ctx, '#5a4a48', '#1e1614', 7, 22, 1.2);
  // The core showing through the crust.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(13, 17 + sq * 0.4, 5, 3.6, 0, 0, Math.PI * 2);
  const core = ctx.createRadialGradient(13, 17, 0, 13, 17, 5);
  core.addColorStop(0, '#fff2b0');
  core.addColorStop(0.5, '#ffb347');
  core.addColorStop(1, '#ff6a1f');
  ctx.fillStyle = core;
  ctx.fill();
  ctx.restore();
  cracks(ctx, [[[7, 12 + sq], [9.5, 14 + sq], [8.5, 17]], [[18.5, 11 + sq], [17, 13.5 + sq]], [[11, 9 + sq], [13, 11 + sq], [15.5, 9.5 + sq]]], '#ff8a3c', 0.9);
  // A drip falling off one side.
  ell(ctx, 21 + sq, 17 + drip * 1.6, 1.1, 1.6 + drip * 0.3);
  ctx.fillStyle = '#ff9a3c';
  ctx.fill();
  eyes(ctx, [[10.5, 12.5 + sq], [15.5, 12.5 + sq]], 1, '#ffe08a');
}

/** Cinderhound: a lean, smouldering hound in side view. */
function drawHound(ctx: Ctx, _s: number, f: number): void {
  const a = [0.5, 0.15, -0.5, -0.15][f];
  const bob = [0, -0.8, 0, -0.8][f];
  const legs: [number, number][] = [[11, a], [14, -a], [22, -a], [25, a]];
  for (const [x, k] of legs) limb(ctx, x, 21 + bob, x + Math.sin(k) * 5, 29, 2, '#38190f');
  // Flame tail.
  ctx.save();
  ctx.strokeStyle = '#5a2a18';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(9, 18 + bob);
  ctx.quadraticCurveTo(3, 15 + bob, 4, 9 + bob - a * 2);
  ctx.stroke();
  ctx.restore();
  softGlow(ctx, 4, 9 + bob - a * 2, 4, 'rgba(255,190,80,0.95)');
  // Body.
  ell(ctx, 17.5, 19 + bob, 10, 5.4);
  shade(ctx, '#a4502c', '#3a170d', 13, 25);
  // Neck and head.
  ell(ctx, 27, 15 + bob, 5, 4.4);
  shade(ctx, '#b0582f', '#41190e', 10, 20);
  ctx.beginPath();
  ctx.moveTo(29, 13.5 + bob); ctx.lineTo(34.5, 16 + bob); ctx.lineTo(30, 18.5 + bob); ctx.closePath();
  shade(ctx, '#9a4a28', '#3a170d', 13, 19, 1.1);
  // Ears.
  ctx.fillStyle = '#2c1209';
  ctx.beginPath(); ctx.moveTo(24, 12 + bob); ctx.lineTo(24.5, 7 + bob); ctx.lineTo(27, 11 + bob); ctx.fill();
  cracks(ctx, [[[10, 15.5 + bob], [14, 14.5 + bob], [18, 15 + bob], [23, 14 + bob]]], '#ffb347', 1);
  eyes(ctx, [[29.5, 14 + bob]], 1.1, '#ffd23c');
}

/** Hollow Warden: a hulking guardian of dark stone with pink runes. */
function drawWarden(ctx: Ctx, _s: number, f: number): void {
  const bob = [0, -1, 0, -1][f];
  const swing = [1.5, 0, -1.5, 0][f];
  // Legs.
  ctx.fillStyle = '#211a20';
  ell(ctx, 21 - swing, 45, 5, 4); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
  ell(ctx, 33 + swing, 45, 5, 4); ctx.fill(); ctx.stroke();
  // Back arm.
  ell(ctx, 12, 31 + bob - swing, 6, 9, 0.2);
  shade(ctx, '#4a3c48', '#1d171c', 22, 40);
  // Torso.
  ell(ctx, 27, 28 + bob, 15, 13.5);
  shade(ctx, '#5c4b59', '#1f191e', 15, 42, 1.6);
  // Plates on the torso.
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(15, 26 + bob); ctx.quadraticCurveTo(27, 32 + bob, 39, 26 + bob); ctx.stroke();
  ctx.restore();
  // Head sunk into the shoulders.
  ell(ctx, 31, 15.5 + bob, 6.2, 5.4);
  shade(ctx, '#6b5868', '#2b2229', 10, 21);
  // Front arm with a huge fist.
  ell(ctx, 42, 31 + bob + swing, 6.5, 9.5, -0.2);
  shade(ctx, '#5c4b59', '#221b21', 22, 41);
  ell(ctx, 44, 40 + bob + swing, 5.5, 4.5);
  shade(ctx, '#4d3f4b', '#1a1418', 36, 45);
  cracks(ctx, [[[23, 22 + bob], [26, 27 + bob], [24, 32 + bob]], [[29, 23 + bob], [30, 30 + bob]]], '#ff3b6b', 1.2);
  eyes(ctx, [[30, 15 + bob], [34, 15 + bob]], 1.2, '#ff3b6b');
}

/** Cinder Brute: a horned brute with molten fists. */
function drawBrute(ctx: Ctx, _s: number, f: number): void {
  const bob = [0, -1.2, 0, -1.2][f];
  const swing = [2, 0, -2, 0][f];
  ctx.fillStyle = '#2a0f0b';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ell(ctx, 25 - swing, 56, 6, 4); ctx.fill(); ctx.stroke();
  ell(ctx, 39 + swing, 56, 6, 4); ctx.fill(); ctx.stroke();
  // Back arm.
  limb(ctx, 18, 26 + bob, 11, 40 + bob - swing, 7, '#5a2318');
  softGlow(ctx, 11, 42 + bob - swing, 7, 'rgba(255,150,60,0.9)');
  ell(ctx, 11, 42 + bob - swing, 4.5, 4.5); shade(ctx, '#ffcf70', '#c2441c', 38, 47, 1.1);
  // Torso: broad shoulders tapering to the waist.
  ctx.beginPath();
  ctx.moveTo(14, 24 + bob);
  ctx.quadraticCurveTo(32, 14 + bob, 50, 24 + bob);
  ctx.quadraticCurveTo(47, 44 + bob, 40, 52);
  ctx.lineTo(24, 52);
  ctx.quadraticCurveTo(17, 44 + bob, 14, 24 + bob);
  ctx.closePath();
  shade(ctx, '#b0452a', '#3a1712', 16, 52, 1.6);
  // Head with curved horns.
  ell(ctx, 35, 17 + bob, 7, 6);
  shade(ctx, '#c0532f', '#4a1c13', 11, 23);
  ctx.save();
  ctx.fillStyle = '#efe0c8';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(30, 13 + bob); ctx.quadraticCurveTo(24, 4 + bob, 30, 2 + bob); ctx.quadraticCurveTo(27, 7 + bob, 33, 11.5 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(38, 11.5 + bob); ctx.quadraticCurveTo(44, 3 + bob, 48, 6 + bob); ctx.quadraticCurveTo(43, 7 + bob, 41, 13.5 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  // Front arm and molten fist.
  limb(ctx, 46, 26 + bob, 52, 40 + bob + swing, 8, '#8a3520');
  softGlow(ctx, 53, 43 + bob + swing, 9, 'rgba(255,160,70,0.95)');
  ell(ctx, 53, 43 + bob + swing, 5.5, 5.5); shade(ctx, '#fff0b0', '#d0501f', 38, 49, 1.2);
  cracks(ctx, [[[22, 28 + bob], [27, 34 + bob], [25, 42 + bob]], [[33, 27 + bob], [36, 35 + bob], [34, 46 + bob]], [[42, 30 + bob], [40, 38 + bob]]], '#ffb347', 1.3);
  eyes(ctx, [[34, 17 + bob], [38.5, 17 + bob]], 1.4, '#ffe16b');
}

/** Coalmouth the Glutton (id ashmaw): a bloated, frost-ash beast that is mostly mouth. */
function drawAshmaw(ctx: Ctx, _s: number, f: number): void {
  const j = [0, 1, 0, -1][f];
  ctx.fillStyle = '#1b1c26';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  for (const x of [18, 26, 36, 43]) { ell(ctx, x, 50, 4, 3); ctx.fill(); ctx.stroke(); }
  ell(ctx, 30, 30 - j * 0.5, 22 + j, 19 - j);
  shade(ctx, '#7f8db3', '#232534', 11, 50, 1.6);
  // Speckled ash.
  ctx.fillStyle = 'rgba(220,235,255,0.25)';
  for (const [x, y] of [[18, 22], [24, 17], [37, 19], [42, 26], [15, 33]]) { ell(ctx, x, y - j * 0.5, 1.4, 1.1); ctx.fill(); }
  // The maw.
  ell(ctx, 36, 35, 12 + j, 7.5 + j * 0.6);
  ctx.fillStyle = '#12080c';
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  softGlow(ctx, 36, 37, 7, 'rgba(150,200,255,0.45)');
  ctx.fillStyle = '#eef3ff';
  for (let k = 0; k < 6; k++) {
    const x = 27 + k * 3.6;
    ctx.beginPath(); ctx.moveTo(x - 1.4, 29 - j * 0.3); ctx.lineTo(x, 32.5); ctx.lineTo(x + 1.4, 29 - j * 0.3); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 1.2, 41 + j * 0.3); ctx.lineTo(x, 38); ctx.lineTo(x + 1.2, 41 + j * 0.3); ctx.fill();
  }
  eyes(ctx, [[34, 20], [41, 21]], 1.6, '#9fd0ff');
}

/**
 * Old Coalmouth (raid 2, the Hoard): a bloated heap of coal that is mostly mouth. A lumpy, faceted coal body with
 * ember seams, four stubby feet, two small ember eyes on top, and a maw splitting his whole front (he faces right)
 * with jagged coal teeth and a furnace glow deep inside. The jaw works open and shut over the four frames. Drawn
 * at 128 and scaled to the sheet (192, the size of Grandmother Slag's raid sheet).
 */
function drawCoalmouth(ctx: Ctx, s: number, f: number): void {
  const k = s / 128;
  const jaw = [0, 4, 9, 4][f];
  const glow = [0.75, 0.9, 1, 0.9][f];
  ctx.save();
  ctx.scale(k, k);
  softGlow(ctx, 70, 72, 62, `rgba(255,120,40,${0.18 * glow})`);
  // Stubby feet.
  ctx.fillStyle = '#16100e';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  for (const x of [26, 44, 70, 88]) { ell(ctx, x, 110, 9, 6); ctx.fill(); ctx.stroke(); }
  // The body: a lumpy heap of coal chunks round an ellipse.
  const pts: [number, number][] = [];
  const bumps = [1, 0.92, 1.06, 0.95, 1.04, 0.9, 1.05, 0.97, 1.02, 0.93, 1.06, 0.96];
  for (let i = 0; i < 12; i++) {
    const a = Math.PI * 0.5 + (i / 12) * Math.PI * 2;
    pts.push([58 + Math.cos(a) * 50 * bumps[i], 66 + Math.sin(a) * 44 * bumps[i]]);
  }
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  shade(ctx, '#3c3330', '#0c0909', 22, 110, 2.4);
  // Facets: lighter edges on the coal chunks, catching the light from above.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(150,140,140,0.35)';
  ctx.lineWidth = 1.2;
  for (const [x1, y1, x2, y2] of [[20, 44, 36, 30], [36, 30, 56, 26], [14, 66, 30, 54], [30, 54, 46, 58], [46, 58, 44, 40], [24, 84, 38, 74], [38, 74, 52, 80], [56, 26, 70, 34]]) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.restore();
  // Ember seams through the coal, brighter as the jaw opens.
  cracks(ctx, [[[18, 60], [28, 64], [34, 72], [44, 74]], [[30, 36], [38, 44], [36, 52]], [[22, 90], [34, 92], [42, 100]], [[50, 96], [58, 90], [66, 96]]], `rgba(255,140,50,${0.55 + 0.4 * glow})`, 1.6);
  // The maw: a huge wedge across his front, open by `jaw`.
  const top = 46 - jaw * 0.4;
  const bot = 92 + jaw;
  ctx.beginPath();
  ctx.moveTo(56, 70);
  ctx.quadraticCurveTo(74, top - 2, 112, top + 4);
  ctx.quadraticCurveTo(122, 70, 112, bot - 4);
  ctx.quadraticCurveTo(76, bot + 2, 56, 70);
  ctx.closePath();
  const mg = ctx.createRadialGradient(80, 70, 2, 84, 70, 34);
  mg.addColorStop(0, `rgba(255,214,120,${glow})`);
  mg.addColorStop(0.35, 'rgba(255,110,40,0.95)');
  mg.addColorStop(0.75, '#4a120a');
  mg.addColorStop(1, '#120606');
  ctx.fillStyle = mg;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // Jagged coal teeth, top and bottom, edged with ember light.
  const teeth = (y: number, dir: number, from: number, to: number, n: number): void => {
    for (let i = 0; i < n; i++) {
      const x = from + ((to - from) * (i + 0.5)) / n;
      const yy = y + (dir < 0 ? 0 : 0) + Math.abs(x - 84) * 0.08 * -dir;
      const h = 7 + ((i * 5) % 4);
      ctx.beginPath();
      ctx.moveTo(x - 3.6, yy);
      ctx.lineTo(x + 0.6, yy + h * dir);
      ctx.lineTo(x + 3.6, yy);
      ctx.closePath();
      ctx.fillStyle = '#2a2422';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,170,90,0.75)';
      ctx.stroke();
    }
  };
  teeth(top + 6, 1, 68, 110, 6);
  teeth(bot - 6, -1, 68, 108, 6);
  // Small ember eyes on top, set far back above the mouth.
  eyes(ctx, [[70, 32], [84, 36]], 2.6, '#ffc861');
  // A heavy brow ridge over them.
  ctx.beginPath(); ctx.moveTo(62, 28); ctx.quadraticCurveTo(76, 22, 92, 30);
  ctx.lineWidth = 3; ctx.strokeStyle = '#0c0909'; ctx.stroke();
  // Smoke and sparks puffing off his back.
  softGlow(ctx, 34, 20, 10, `rgba(255,170,90,${0.35 * glow})`);
  ctx.fillStyle = 'rgba(255,200,120,0.85)';
  for (const [x, y] of [[30, 16 - f], [40, 10 - f * 1.5], [24, 8 - f]]) { ell(ctx, x, y, 1.2, 1.2); ctx.fill(); }
  ctx.restore();
}

/**
 * The Craw (raid 2): a swollen throat-sac bulging off Old Coalmouth's side, its membrane stretched thin over a hot
 * core, veined and throbbing over the four frames. It lives 8 s, so it is the brightest thing near him: GameScene
 * adds a "hit this" ring and its countdown.
 */
function drawCraw(ctx: Ctx, s: number, f: number): void {
  const c = s / 2;
  const p = [0, 1.5, 3, 1.5][f];
  softGlow(ctx, c, c, 30, `rgba(255,160,60,${0.35 + p * 0.08})`);
  // A stub of coal where it hangs off him.
  ctx.beginPath(); ctx.moveTo(c - 10, c - 22); ctx.lineTo(c + 10, c - 22); ctx.lineTo(c + 6, c - 14); ctx.lineTo(c - 6, c - 14); ctx.closePath();
  shade(ctx, '#3c3330', '#120c0b', c - 22, c - 14, 1.6);
  // The sac.
  ell(ctx, c, c + 3, 19 + p, 17 + p * 0.8);
  const g = ctx.createRadialGradient(c - 3, c, 2, c, c + 3, 20 + p);
  g.addColorStop(0, '#fff0b0');
  g.addColorStop(0.35, '#ffb050');
  g.addColorStop(0.8, '#c2401e');
  g.addColorStop(1, '#5a1a14');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // Veins over the membrane.
  ctx.strokeStyle = 'rgba(90,20,14,0.75)';
  ctx.lineWidth = 1.2;
  for (const [x1, y1, x2, y2, x3, y3] of [[c - 12, c - 6, c - 6, c + 2, c - 10, c + 12], [c + 4, c - 12, c + 10, c - 2, c + 14, c + 8], [c - 2, c + 18, c + 2, c + 10, c + 8, c + 14]]) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(x2, y2, x3, y3); ctx.stroke();
  }
  // A shine, so it reads as stretched tight.
  ctx.fillStyle = 'rgba(255,255,230,0.75)';
  ell(ctx, c - 7, c - 5, 4, 2.4, -0.5); ctx.fill();
}

/** Smolderhusk, the Kiln Mother: a walking furnace of brick and slag. */
function drawKiln(ctx: Ctx, s: number, f: number): void {
  const breathe = [0, 1, 2, 1][f];
  const fire = [0.8, 0.95, 1, 0.9][f];
  // Stubby legs.
  ctx.fillStyle = '#1b0d0e';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ell(ctx, 38, 100, 11, 7); ctx.fill(); ctx.stroke();
  ell(ctx, 74, 100, 11, 7); ctx.fill(); ctx.stroke();
  // Chimney horns with smoke glow.
  for (const [x, lean] of [[34, -0.25], [78, 0.25]] as [number, number][]) {
    ctx.save();
    ctx.translate(x, 30);
    ctx.rotate(lean);
    ctx.beginPath();
    ctx.rect(-6, -24, 12, 26);
    shade(ctx, '#7a2b22', '#2a0f0d', -24, 2, 2);
    softGlow(ctx, 0, -25, 10, `rgba(255,140,60,${0.6 * fire})`);
    ctx.restore();
  }
  // Arms.
  limb(ctx, 22, 58, 10, 78 + breathe, 12, '#4a1a15');
  limb(ctx, 90, 58, 102, 78 + breathe, 12, '#4a1a15');
  softGlow(ctx, 10, 80 + breathe, 10, 'rgba(255,140,60,0.8)');
  softGlow(ctx, 102, 80 + breathe, 10, 'rgba(255,140,60,0.8)');
  // Dome body.
  ctx.beginPath();
  ctx.moveTo(18, 96);
  ctx.quadraticCurveTo(14, 58 - breathe, 32, 36 - breathe);
  ctx.quadraticCurveTo(56, 18 - breathe, 80, 36 - breathe);
  ctx.quadraticCurveTo(98, 58 - breathe, 94, 96);
  ctx.closePath();
  shade(ctx, '#8f3426', '#24100e', 20, 96, 2.4);
  // Brick courses.
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(15,5,5,0.55)';
  ctx.lineWidth = 1.2;
  for (let row = 0; row < 8; row++) {
    const y = 30 + row * 9 - breathe;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
    for (let c = 0; c < 9; c++) {
      const x = c * 14 + (row % 2) * 7;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 9); ctx.stroke();
    }
  }
  ctx.restore();
  // Furnace mouth with a grate.
  const my = 70;
  softGlow(ctx, 56, my, 30, `rgba(255,140,50,${0.85 * fire})`);
  ell(ctx, 56, my, 19, 13);
  const g = ctx.createRadialGradient(56, my + 3, 1, 56, my, 19);
  g.addColorStop(0, '#fffbe0');
  g.addColorStop(0.35, '#ffcf55');
  g.addColorStop(0.8, '#ff6a1f');
  g.addColorStop(1, '#8a1f0e');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.save();
  ctx.strokeStyle = '#2a0e0b';
  ctx.lineWidth = 2.4;
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath(); ctx.moveTo(56 + k * 7, my - 12); ctx.lineTo(56 + k * 7, my + 12); ctx.stroke();
  }
  ctx.restore();
  cracks(ctx, [[[30, 48], [36, 56], [32, 64]], [[80, 46], [76, 54], [82, 62]], [[50, 38], [56, 44], [62, 39]]], '#ffb347', 1.6);
  eyes(ctx, [[46, 46 - breathe], [66, 46 - breathe]], 2.4, '#ff3b6b');
}

// ---------------------------------------------------------------- the Hammerdeep

/**
 * Ondrel of the Hammerdeep: a hulking iron warden whose chest is a forge anvil.
 * Cool steel with molten slag in the seams; a great hammer in its right hand
 * (it rises over the four frames), a visor slit with two hot eyes.
 */
// ------------------------------------------------------------------ The Coldmarrow
// The deep under the Kiln where the forge fires went out: black stone, blue-white rime.
// Everything here is cold; only the heroes' coals are warm, so these read blue on black.
const RIME_HI = '#eaf6ff';
const RIME = '#9cc8ec';
const RIME_LO = '#2a3a5a';

/** Rimehound: a pale, low-slung hound with a ridge of frost spikes down its back. Faces right. */
function drawRimehound(ctx: Ctx, _s: number, f: number): void {
  const a = [0.5, 0.15, -0.5, -0.15][f];
  const bob = [0, -0.8, 0, -0.8][f];
  for (const [x, k] of [[11, a], [14, -a], [22, -a], [25, a]] as [number, number][]) limb(ctx, x, 22 + bob, x + Math.sin(k) * 5, 30, 2, '#5a6a84');
  // Tail: a stiff frozen plume.
  ctx.beginPath(); ctx.moveTo(9, 19 + bob); ctx.lineTo(2, 14 + bob - a * 2); ctx.lineTo(5, 20 + bob); ctx.closePath();
  shade(ctx, RIME_HI, RIME, 13, 21, 1);
  ell(ctx, 17.5, 20 + bob, 10.5, 5);
  shade(ctx, '#d6e4f2', '#5a6a84', 15, 25);
  ell(ctx, 27.5, 16.5 + bob, 5, 4.2);
  shade(ctx, '#e2eef8', '#66788f', 12, 21);
  ctx.beginPath(); ctx.moveTo(30, 15 + bob); ctx.lineTo(35, 17.5 + bob); ctx.lineTo(30.5, 19.5 + bob); ctx.closePath();
  shade(ctx, '#c8d6e6', '#56677e', 15, 20, 1.1);
  ctx.fillStyle = '#3a4a64';
  ctx.beginPath(); ctx.moveTo(25, 13.5 + bob); ctx.lineTo(25.5, 8.5 + bob); ctx.lineTo(28, 12.5 + bob); ctx.fill();
  // Frost spikes along the spine.
  for (let k = 0; k < 5; k++) {
    const x = 11 + k * 3.4;
    const h = 3 + (k % 2) * 1.6;
    ctx.beginPath(); ctx.moveTo(x - 1.4, 15.6 + bob); ctx.lineTo(x + 0.3, 15.6 + bob - h); ctx.lineTo(x + 1.6, 15.6 + bob); ctx.closePath();
    shade(ctx, RIME_HI, RIME, 15.6 - h + bob, 16 + bob, 0.8);
  }
  eyes(ctx, [[30, 15.5 + bob]], 1.1, '#7fd8ff');
}

/** Snuffer: a slow hooded wraith of smoke whose open icy mouth drinks light. Faces right. */
function drawSnuffer(ctx: Ctx, _s: number, f: number): void {
  const w = [0, 1.2, 0, -1.2][f];
  // A cold halo that darkens rather than lights.
  softGlow(ctx, 20, 18, 18, 'rgba(120,170,220,0.28)');
  ctx.save(); ctx.lineCap = 'round';
  for (const [y, al, ww] of [[18, 0.5, 5], [24, 0.4, 4], [29, 0.3, 3]] as [number, number, number][]) {
    ctx.strokeStyle = `rgba(40,48,66,${al})`; ctx.lineWidth = ww;
    ctx.beginPath(); ctx.moveTo(14, y); ctx.quadraticCurveTo(8, y + w * 2, 2, y - 2 + w); ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(21, 3);
  ctx.quadraticCurveTo(33, 6, 32, 19);
  ctx.quadraticCurveTo(31 + w, 28, 27 - w, 33);
  ctx.quadraticCurveTo(24, 28, 21, 32 + w);
  ctx.quadraticCurveTo(18, 28, 14 + w, 33);
  ctx.quadraticCurveTo(10, 25, 10, 18);
  ctx.quadraticCurveTo(9, 6, 21, 3);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 3, 0, 34);
  g.addColorStop(0, 'rgba(92,102,124,0.97)'); g.addColorStop(0.6, 'rgba(38,44,60,0.95)'); g.addColorStop(1, 'rgba(18,20,30,0.5)');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(200,228,255,0.5)'; ctx.stroke();
  // The hood's dark opening and the mouth: a pale ring that pulls inward.
  ell(ctx, 24, 15, 6, 7); ctx.fillStyle = '#05070c'; ctx.fill();
  const m = 2.2 + [0, 0.6, 1.2, 0.6][f];
  ctx.save();
  ctx.strokeStyle = RIME_HI; ctx.shadowColor = '#bfe6ff'; ctx.shadowBlur = 5; ctx.lineWidth = 1.3;
  ell(ctx, 25, 18, m, m * 0.8); ctx.stroke();
  ctx.restore();
  eyes(ctx, [[22.5, 12.5], [26.5, 12.5]], 0.9, '#cfeaff');
}

/** Frost Warden: a blocky guard clad in ice plates over dark stone; the ice cracks orange when warmed. */
function drawFrostWarden(ctx: Ctx, _s: number, f: number): void {
  const bob = [0, -1, 0, -1][f];
  const swing = [1.5, 0, -1.5, 0][f];
  ctx.fillStyle = '#1a2030';
  ell(ctx, 21 - swing, 46, 5.5, 4); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
  ell(ctx, 33 + swing, 46, 5.5, 4); ctx.fill(); ctx.stroke();
  // Back arm.
  ctx.beginPath(); ctx.rect(6, 24 + bob - swing, 9, 16);
  shade(ctx, '#46546e', '#1a2030', 24, 40);
  // Torso: a squared block.
  ctx.beginPath();
  ctx.moveTo(13, 16 + bob); ctx.lineTo(41, 16 + bob); ctx.lineTo(43, 42 + bob); ctx.lineTo(11, 42 + bob); ctx.closePath();
  shade(ctx, '#3e4a62', '#141a28', 16, 42, 1.6);
  // Ice plates over it.
  for (const [x0, y0, x1, y1] of [[14, 18, 27, 30], [28, 18, 40, 28], [15, 32, 39, 40]]) {
    ctx.beginPath(); ctx.moveTo(x0, y0 + bob); ctx.lineTo(x1, y0 + bob); ctx.lineTo(x1 - 1, y1 + bob); ctx.lineTo(x0 + 1, y1 + bob); ctx.closePath();
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(234,246,255,0.95)'); g.addColorStop(1, 'rgba(120,170,220,0.75)');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(20,30,50,0.9)'; ctx.stroke();
  }
  // Fine cracks: the seams that glow orange when it's warmed in a coal's light.
  cracks(ctx, [[[20, 20 + bob], [22, 25 + bob], [19, 29 + bob]], [[33, 20 + bob], [31, 24 + bob]], [[24, 33 + bob], [28, 36 + bob], [26, 39 + bob]]], 'rgba(90,140,200,0.9)', 0.9);
  // Head: a helm of ice with a slit.
  ctx.beginPath(); ctx.rect(20, 5 + bob, 14, 12);
  shade(ctx, '#e2f0fc', '#6c8cb0', 5, 17, 1.4);
  ctx.fillStyle = '#0a0e18'; ctx.fillRect(22, 10 + bob, 10, 2.4);
  eyes(ctx, [[25, 11.2 + bob], [29.5, 11.2 + bob]], 1.1, '#7fd8ff');
  // Front arm with an ice maul fist.
  ctx.beginPath(); ctx.rect(40, 22 + bob + swing, 8, 15);
  shade(ctx, '#4a5874', '#1a2030', 22, 37);
  ctx.beginPath(); ctx.rect(38, 36 + bob + swing, 12, 9);
  shade(ctx, RIME_HI, RIME, 36, 45, 1.3);
}

// ------------------------------------------------------------------ the Wrackline
// A wrecked quay under the Hollow Tide: harbour grey-green, wet driftwood, rope, barnacles and
// pale surf (#7fd0e0, #bfe9ff). docs/design/wrackline.md.
const SURF = '#bfe9ff';

/** A few short surf arcs at the waterline, for things that swim or rise out of the water. */
function surf(ctx: Ctx, cx: number, cy: number, rx: number, phase: number, a = 0.8): void {
  ctx.save();
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const r = rx * (0.55 + 0.25 * k) + phase;
    ctx.strokeStyle = `rgba(191,233,255,${a * (1 - k * 0.28)})`;
    ctx.lineWidth = 1.4 - k * 0.3;
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.28, 0, Math.PI * 0.08, Math.PI * 0.92); ctx.stroke();
  }
  ctx.restore();
}

/** Shoal Lurker: a lean grey-green swimmer, back and fin above the water, circling the rafts. Faces right. */
function drawShoalLurker(ctx: Ctx, _s: number, f: number): void {
  const sway = [2.2, 0.8, -2.2, -0.8][f];
  const bob = [0, -0.6, 0, -0.6][f];
  // Dark water around it, so it reads as swimming, not walking.
  ell(ctx, 18, 24, 15, 5); ctx.fillStyle = 'rgba(6,24,32,0.55)'; ctx.fill();
  // Tail fluke, sweeping.
  ctx.beginPath(); ctx.moveTo(8, 21 + bob); ctx.lineTo(1, 15 + bob + sway); ctx.lineTo(3, 21 + bob); ctx.lineTo(1, 27 + bob + sway * 0.4); ctx.closePath();
  shade(ctx, '#6f9488', '#24403a', 15, 27, 1);
  // Body: a long eel-like back breaking the surface.
  ctx.beginPath();
  ctx.moveTo(7, 22 + bob);
  ctx.quadraticCurveTo(14, 13 + bob + sway * 0.3, 25, 15 + bob);
  ctx.quadraticCurveTo(33, 16 + bob, 34, 21 + bob);
  ctx.quadraticCurveTo(24, 25 + bob, 7, 22 + bob);
  ctx.closePath();
  shade(ctx, '#86ab9c', '#2c4a43', 13, 25);
  // Pale belly line along the waterline.
  ctx.strokeStyle = 'rgba(214,236,228,0.75)'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(12, 22.6 + bob); ctx.quadraticCurveTo(24, 23.6 + bob, 33, 21 + bob); ctx.stroke();
  // Ragged dorsal fin.
  ctx.beginPath(); ctx.moveTo(14, 15.5 + bob); ctx.lineTo(18, 7 + bob + sway * 0.25); ctx.lineTo(20, 10 + bob); ctx.lineTo(23, 8.5 + bob); ctx.lineTo(25, 15 + bob); ctx.closePath();
  shade(ctx, '#9cc4b4', '#335a50', 7, 16, 1);
  // Barnacle specks.
  ctx.fillStyle = 'rgba(232,226,210,0.85)';
  for (const [x, y] of [[16, 17.5], [21, 16.5], [27, 17.5]]) { ctx.beginPath(); ctx.arc(x, y + bob, 0.8, 0, Math.PI * 2); ctx.fill(); }
  // Jaw and a pale hungry eye.
  ctx.strokeStyle = INK; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(34, 20.6 + bob); ctx.lineTo(29, 20 + bob); ctx.stroke();
  eyes(ctx, [[30.2, 17.6 + bob]], 1.1, SURF);
  surf(ctx, 18, 24.5, 13, sway * 0.4, 0.75);
}

/** Barge Hauler: a broad, slow dock-hand in an oilskin coat, a rope coil on one shoulder and an iron hook. Faces right. */
function drawBargeHauler(ctx: Ctx, _s: number, f: number): void {
  const bob = [0, -1, 0, -1][f];
  const step = [1.6, 0, -1.6, 0][f];
  ell(ctx, 28, 51, 16, 3); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();
  // Boots.
  ctx.fillStyle = '#1c2422';
  ell(ctx, 21 - step, 49, 6, 3.6); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
  ell(ctx, 34 + step, 49, 6, 3.6); ctx.fill(); ctx.stroke();
  // Rope coil slung over the back shoulder.
  ctx.save(); ctx.lineWidth = 2.4; ctx.strokeStyle = '#8a6e48';
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(13, 27 + bob, 7 - k * 1.2, 9 - k * 1.4, -0.3, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
  // Oilskin coat: a heavy, flared trapezoid.
  ctx.beginPath();
  ctx.moveTo(16, 15 + bob); ctx.lineTo(40, 15 + bob); ctx.lineTo(45, 47 + bob * 0.5); ctx.lineTo(11, 47 + bob * 0.5); ctx.closePath();
  shade(ctx, '#557a72', '#1c2c2a', 15, 47, 1.7);
  // Wet sheen down the coat.
  ctx.strokeStyle = 'rgba(191,233,255,0.35)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(19, 18 + bob); ctx.lineTo(16, 44); ctx.stroke();
  // Toggle buttons.
  ctx.fillStyle = '#c8b48a';
  for (const y of [22, 29, 36]) { ctx.fillRect(28, y + bob, 3, 1.6); }
  // Shoulders and a thick neck under a sou'wester hat.
  ell(ctx, 28, 15 + bob, 13, 5); shade(ctx, '#5f857c', '#2a3e3a', 10, 20);
  ell(ctx, 29, 9.5 + bob, 6.5, 5.5); shade(ctx, '#c9a487', '#7a5844', 4, 15);
  ctx.beginPath(); ctx.moveTo(20, 7.5 + bob); ctx.quadraticCurveTo(29, -1 + bob, 38, 7.5 + bob); ctx.lineTo(40, 9 + bob); ctx.lineTo(18, 9 + bob); ctx.closePath();
  shade(ctx, '#e0c060', '#8a6a24', 1, 9);
  eyes(ctx, [[32, 10 + bob]], 0.9, '#fff0c8');
  // Hook arm reaching forward: forearm, fist and an iron hook.
  limb(ctx, 39, 20 + bob, 47, 30 + bob - step * 0.3, 5, '#4a6a62');
  ell(ctx, 48, 31 + bob, 3.4, 3.2); shade(ctx, '#c9a487', '#7a5844', 28, 34, 1.1);
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 3.6;
  ctx.beginPath(); ctx.moveTo(49, 33 + bob); ctx.lineTo(50, 40 + bob); ctx.arc(47.5, 40 + bob, 2.6, 0, Math.PI * 0.95); ctx.stroke();
  ctx.strokeStyle = '#b6c4c8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(49, 33 + bob); ctx.lineTo(50, 40 + bob); ctx.arc(47.5, 40 + bob, 2.6, 0, Math.PI * 0.95); ctx.stroke();
  ctx.restore();
}

/**
 * Hessa of the Ebb: tall and anchored on the drain. She rises out of a swirl of water from the waist,
 * kelp hair streaming back, a crown of shells, and a hooked anchor-staff planted in the drain.
 */
function drawHessa(ctx: Ctx, _s: number, f: number): void {
  const sway = [0, 2, 3, 1][f];
  const glowK = [0.8, 0.95, 1, 0.9][f];
  softGlow(ctx, 60, 70, 56, `rgba(127,208,224,${0.32 * glowK})`);
  // The water she rises from: a churning pool with foam arcs.
  ell(ctx, 60, 98, 42, 13); ctx.fillStyle = 'rgba(6,26,34,0.8)'; ctx.fill();
  ctx.save(); ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const a0 = f * 0.4 + k * (Math.PI / 2);
    ctx.strokeStyle = `rgba(191,233,255,${0.75 - k * 0.12})`; ctx.lineWidth = 2 - k * 0.3;
    ctx.beginPath(); ctx.ellipse(60, 98, 22 + k * 5, 7 + k * 1.6, 0, a0, a0 + 1.8); ctx.stroke();
  }
  ctx.restore();
  // Kelp hair streaming back behind her (drawn first, so it sits behind).
  ctx.save(); ctx.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    const y0 = 20 + k * 3.5;
    ctx.strokeStyle = k % 2 ? '#2f5a4a' : '#3f7260'; ctx.lineWidth = 4 - k * 0.3;
    ctx.beginPath(); ctx.moveTo(54, y0); ctx.bezierCurveTo(40, y0 + 8, 30 - sway, y0 + 18, 22 - sway * 1.4, y0 + 34 + k * 2); ctx.stroke();
  }
  ctx.restore();
  // Body: a long gown of sea-foam and grey-green water, narrowing into the pool.
  ctx.beginPath();
  ctx.moveTo(50, 30); ctx.quadraticCurveTo(60, 26, 70, 30);
  ctx.quadraticCurveTo(78, 58, 82, 92);
  ctx.quadraticCurveTo(60, 102, 38, 92);
  ctx.quadraticCurveTo(42, 58, 50, 30);
  ctx.closePath();
  shade(ctx, '#a8d4d0', '#1e4a52', 28, 96, 1.8);
  // Flowing folds that turn into water lines near the bottom.
  ctx.strokeStyle = 'rgba(234,250,255,0.55)'; ctx.lineWidth = 1.2;
  for (const [x0, x1] of [[54, 46], [60, 60], [66, 74]]) { ctx.beginPath(); ctx.moveTo(x0, 40); ctx.quadraticCurveTo((x0 + x1) / 2 + sway * 0.5, 66, x1, 92); ctx.stroke(); }
  // Barnacles crusting the hem.
  ctx.fillStyle = 'rgba(236,230,214,0.9)';
  for (const [x, y] of [[44, 86], [50, 90], [72, 88], [77, 84], [64, 92]]) { ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke(); }
  // Arms: one held out to call the tide, one gripping the anchor-staff.
  limb(ctx, 51, 36, 38, 52, 4.5, '#8cc0bc');
  limb(ctx, 69, 36, 84, 46, 4.5, '#8cc0bc');
  softGlow(ctx, 36, 54, 9, `rgba(191,233,255,${0.8 * glowK})`);
  // The anchor-staff, planted in the drain: a tall shaft with a hooked fluke below and a ring above.
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(86, 12); ctx.lineTo(86, 100); ctx.stroke();
  ctx.strokeStyle = '#7e8e92'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(86, 12); ctx.lineTo(86, 100); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 4.6;
  ctx.beginPath(); ctx.arc(86, 9, 4, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(76, 92); ctx.quadraticCurveTo(86, 104, 96, 92); ctx.stroke();
  ctx.strokeStyle = '#a4b4b8'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.arc(86, 9, 4, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(76, 92); ctx.quadraticCurveTo(86, 104, 96, 92); ctx.stroke();
  ctx.restore();
  ell(ctx, 85, 46, 3.6, 3.2); shade(ctx, '#a8d8d4', '#4a7a78', 43, 49, 1.1);
  // Head: pale, with a crown of shells and cold surf-white eyes.
  ell(ctx, 60, 20, 8, 9.5); shade(ctx, '#d2ece8', '#6a9a98', 10, 30, 1.5);
  for (const [x, y, r] of [[52, 12, 2.6], [56.5, 9, 3], [60, 7.5, 3.4], [63.5, 9, 3], [68, 12, 2.6]]) {
    ctx.beginPath(); ctx.moveTo(x - r, y + 2); ctx.lineTo(x, y - r); ctx.lineTo(x + r, y + 2); ctx.closePath();
    shade(ctx, '#f4ead8', '#b49c7a', y - r, y + 2, 0.9);
  }
  eyes(ctx, [[56.5, 20], [63.5, 20]], 1.4, SURF);
  ctx.strokeStyle = 'rgba(20,50,56,0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(57, 26); ctx.quadraticCurveTo(60, 27.5, 63, 26); ctx.stroke();
  // Water running off her outstretched hand.
  ctx.strokeStyle = `rgba(127,208,224,${0.8 * glowK})`; ctx.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(35 + k * 2, 56); ctx.lineTo(34 + k * 2, 64 + ((f + k) % 3) * 3); ctx.stroke(); }
}

/**
 * Oskel of the Pressworks: the stamping works' foreman, a barrel-bodied brute in oily olive coveralls and a riveted
 * leather apron. A box helmet with one amber visor slit, a pressure gauge on his chest whose needle swings, steam
 * puffing from two back stacks, a press lever held up in one fist and, on the other arm, a hydraulic piston that drives
 * a hazard-striped stamping die down and up (the Stamp and the Downstroke). Brass and steel, not forge red, so he
 * reads apart from Ondrel's anvil-giant. Faces right.
 */
function drawOskel(ctx: Ctx, _s: number, f: number): void {
  const push = [0, 4, 8, 4][f];
  const needle = [-0.9, -0.2, 0.7, 0.1][f];
  const puff = [0.5, 0.8, 1, 0.7][f];
  const STEEL_HI = '#a8b4a6';
  const STEEL_LO = '#28302a';
  const BRASS_HI = '#f0c66a';
  const BRASS_LO = '#6a4a1c';
  softGlow(ctx, 60, 64, 56, 'rgba(240,198,106,0.18)');
  // Steam from the two back stacks.
  for (const [x, k] of [[38, 0], [50, 1]] as const) {
    ctx.beginPath(); ctx.rect(x - 4, 14, 8, 20); shade(ctx, BRASS_HI, BRASS_LO, 14, 34, 1.4);
    softGlow(ctx, x - 2 - k * 2, 8 - puff * 4, 10 + puff * 4, `rgba(230,236,232,${0.55 * puff})`);
    softGlow(ctx, x - 6, 2 - puff * 2, 7 + puff * 3, `rgba(230,236,232,${0.3 * puff})`);
  }
  // Legs: heavy boots with brass toe caps.
  for (const x of [46, 72]) {
    limb(ctx, x, 84, x, 100, 11, '#3a4636');
    ctx.beginPath(); ctx.moveTo(x - 8, 108); ctx.lineTo(x - 7, 99); ctx.lineTo(x + 7, 99); ctx.quadraticCurveTo(x + 13, 102, x + 12, 108); ctx.closePath();
    shade(ctx, '#4a3a2a', '#1a120c', 99, 108, 1.4);
    ell(ctx, x + 8, 104, 4, 3.4); shade(ctx, BRASS_HI, BRASS_LO, 101, 107, 1);
  }
  // The lever arm (behind): a fist raised on a tall press lever with a red knob.
  limb(ctx, 42, 44, 30, 32, 8, '#4a5a46');
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(28, 64); ctx.lineTo(26, 16); ctx.stroke();
  ctx.strokeStyle = STEEL_HI; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(28, 64); ctx.lineTo(26, 16); ctx.stroke();
  ctx.restore();
  ell(ctx, 26, 13, 5, 5); shade(ctx, '#ff7a5a', '#8a1e14', 8, 18, 1.2);
  ell(ctx, 29, 31, 6, 5.5); shade(ctx, '#c49a7a', '#5a3a2a', 26, 37, 1.2);
  // Body: a barrel torso in oily olive coveralls.
  ctx.beginPath();
  ctx.moveTo(36, 40); ctx.quadraticCurveTo(60, 30, 84, 40);
  ctx.quadraticCurveTo(92, 62, 84, 88); ctx.quadraticCurveTo(60, 94, 36, 88);
  ctx.quadraticCurveTo(28, 62, 36, 40); ctx.closePath();
  shade(ctx, '#5c6c54', '#1a2018', 32, 92, 2);
  rimLight(ctx, 32, 60, 'rgba(240,198,106,0.55)', 1.2);
  // The apron, riveted down both sides.
  ctx.beginPath();
  ctx.moveTo(44, 50); ctx.lineTo(76, 50); ctx.lineTo(80, 92); ctx.quadraticCurveTo(60, 97, 40, 92); ctx.closePath();
  shade(ctx, '#7a5638', '#2a1a10', 50, 96, 1.6);
  ctx.fillStyle = BRASS_HI;
  for (let y = 56; y <= 88; y += 8) for (const x of [47 - (y - 50) * 0.1, 73 + (y - 50) * 0.1]) { ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill(); }
  // The pressure gauge on his chest: a brass dial whose needle swings with the press.
  ell(ctx, 60, 60, 8, 8); shade(ctx, BRASS_HI, BRASS_LO, 52, 68, 1.4);
  ell(ctx, 60, 60, 5.6, 5.6); ctx.fillStyle = '#f4ecd8'; ctx.fill();
  ctx.save();
  ctx.strokeStyle = 'rgba(20,16,12,0.7)'; ctx.lineWidth = 0.8;
  for (let k = 0; k < 5; k++) { const a = -2.4 + k * 0.6; ctx.beginPath(); ctx.moveTo(60 + Math.cos(a) * 4.2, 60 + Math.sin(a) * 4.2); ctx.lineTo(60 + Math.cos(a) * 5.4, 60 + Math.sin(a) * 5.4); ctx.stroke(); }
  ctx.strokeStyle = '#c42a1e'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(60, 60); ctx.lineTo(60 + Math.cos(needle - Math.PI / 2) * 4.6, 60 + Math.sin(needle - Math.PI / 2) * 4.6); ctx.stroke();
  ctx.restore();
  // Head: a riveted box helmet with one amber visor slit.
  ctx.beginPath();
  ctx.moveTo(48, 36); ctx.lineTo(48, 22); ctx.quadraticCurveTo(48, 14, 60, 13); ctx.quadraticCurveTo(72, 14, 72, 22); ctx.lineTo(72, 36); ctx.closePath();
  shade(ctx, STEEL_HI, STEEL_LO, 13, 36, 1.8);
  ctx.beginPath(); ctx.rect(53, 23, 18, 4.5); ctx.fillStyle = '#120c08'; ctx.fill();
  ctx.save(); ctx.shadowColor = '#ffb84a'; ctx.shadowBlur = 6; ctx.fillStyle = '#ffb84a'; ctx.fillRect(55, 24.2, 15, 2.2); ctx.restore();
  ctx.fillStyle = '#d8e0d4';
  for (const [x, y] of [[51, 18], [69, 18], [51, 33], [69, 33], [60, 15.5]]) { ctx.beginPath(); ctx.arc(x, y, 1.1, 0, Math.PI * 2); ctx.fill(); }
  // The press arm: a shoulder, a brass piston cylinder and the stamping die it drives down.
  limb(ctx, 80, 44, 92, 50, 9, '#4a5a46');
  ctx.beginPath(); ctx.rect(87, 42, 14, 24); shade(ctx, BRASS_HI, BRASS_LO, 42, 66, 1.6);
  ctx.strokeStyle = 'rgba(40,26,8,0.6)'; ctx.lineWidth = 1;
  for (const y of [48, 54, 60]) { ctx.beginPath(); ctx.moveTo(87, y); ctx.lineTo(101, y); ctx.stroke(); }
  ctx.beginPath(); ctx.rect(91.5, 66, 5, 8 + push); shade(ctx, '#e8eee6', '#7a867a', 66, 74 + push, 1.2);
  const dy = 74 + push;
  ctx.beginPath(); ctx.rect(80, dy, 28, 14); shade(ctx, STEEL_HI, STEEL_LO, dy, dy + 14, 1.8);
  // Hazard stripes on the die's face.
  ctx.save();
  ctx.beginPath(); ctx.rect(81, dy + 9, 26, 4); ctx.clip();
  ctx.fillStyle = '#f2c230'; ctx.fillRect(81, dy + 9, 26, 4);
  ctx.fillStyle = '#16120c';
  for (let x = 76; x < 110; x += 6) { ctx.beginPath(); ctx.moveTo(x, dy + 13); ctx.lineTo(x + 3, dy + 13); ctx.lineTo(x + 7, dy + 9); ctx.lineTo(x + 4, dy + 9); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = '#d8e0d4';
  for (const x of [84, 104]) { ctx.beginPath(); ctx.arc(x, dy + 4, 1.2, 0, Math.PI * 2); ctx.fill(); }
}

/** Hoarfrost Weaver: a thin robed caster holding a spindle that spins threads of ice. Faces right. */
function drawHoarfrostWeaver(ctx: Ctx, _s: number, f: number): void {
  const bob = [0, -1, 0, -1][f];
  const spin = f * (Math.PI / 4);
  ctx.fillStyle = '#121828';
  ell(ctx, 18, 46, 6, 1.8); ctx.fill();
  // Robe: tall and narrow, frayed at the hem.
  ctx.beginPath();
  ctx.moveTo(17, 10 + bob); ctx.quadraticCurveTo(25, 12 + bob, 26, 26);
  ctx.lineTo(28, 45); ctx.lineTo(24, 42); ctx.lineTo(20, 46); ctx.lineTo(16, 42); ctx.lineTo(11, 45);
  ctx.lineTo(12, 26); ctx.quadraticCurveTo(12, 12 + bob, 17, 10 + bob);
  ctx.closePath();
  shade(ctx, '#4a5a7a', '#141a2a', 10, 46, 1.3);
  rimLight(ctx, 10, 30, 'rgba(200,230,255,0.6)', 1);
  // Hood and a cold face.
  ell(ctx, 18.5, 9 + bob, 5.5, 6);
  shade(ctx, '#5a6c8e', '#1c2436', 3, 15, 1.2);
  ell(ctx, 19.8, 10 + bob, 3.2, 3.6); ctx.fillStyle = '#070a12'; ctx.fill();
  eyes(ctx, [[19.4, 9.6 + bob], [21.6, 9.6 + bob]], 0.8, '#cfeaff');
  // Arm reaching out with the spindle.
  limb(ctx, 22, 20 + bob, 30, 22 + bob, 2.6, '#3e4c6a');
  softGlow(ctx, 33, 22 + bob, 8, 'rgba(160,220,255,0.6)');
  ctx.save();
  ctx.translate(33, 22 + bob);
  ctx.strokeStyle = RIME_HI; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke();
  // Threads wound round it, turning.
  ctx.strokeStyle = 'rgba(180,225,255,0.85)'; ctx.lineWidth = 0.9;
  for (let k = 0; k < 3; k++) { ell(ctx, 0, 0, 3.4, 1.4, spin + (k * Math.PI) / 3); ctx.stroke(); }
  ctx.restore();
  // A loose thread trailing to the ground.
  ctx.save(); ctx.strokeStyle = 'rgba(180,225,255,0.6)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(33, 29 + bob); ctx.quadraticCurveTo(36 + bob, 38, 32, 46); ctx.stroke(); ctx.restore();
}

/**
 * Nhevra, the Cold Hearth: the dead forge's heart, a great stone hearth gone white with
 * frost, with a cold blue flame burning in its mouth and icicles hanging from the lintel.
 */
function drawNhevra(ctx: Ctx, _s: number, f: number): void {
  const flick = [0, -3, -5, -2][f];
  const glow = [0.75, 0.9, 1, 0.85][f];
  softGlow(ctx, 60, 64, 56, `rgba(120,190,255,${0.3 * glow})`);
  // Chimney stacks, frosted.
  for (const x of [34, 86]) {
    ctx.beginPath(); ctx.rect(x - 7, 8, 14, 30);
    shade(ctx, '#d8e8f6', '#3c4c68', 8, 38, 1.8);
    ctx.fillStyle = 'rgba(234,246,255,0.9)'; ctx.fillRect(x - 8, 6, 16, 4);
  }
  // Stone arms braced on the floor either side, frosted knuckles.
  for (const side of [-1, 1]) {
    limb(ctx, 60 + side * 40, 60, 60 + side * 50, 96, 11, '#56667e');
    ell(ctx, 60 + side * 50, 100, 9, 7);
    shade(ctx, RIME_HI, '#4a5a74', 93, 107, 1.6);
  }
  // The hearth body: a stone arch.
  ctx.beginPath();
  ctx.moveTo(18, 108); ctx.lineTo(18, 46); ctx.quadraticCurveTo(60, 22, 102, 46); ctx.lineTo(102, 108); ctx.closePath();
  shade(ctx, '#9aacc4', '#1a2238', 30, 108, 2.4);
  rimLight(ctx, 30, 70, 'rgba(234,246,255,0.8)', 1.4);
  // Stone courses under the frost.
  ctx.save();
  ctx.beginPath(); ctx.moveTo(18, 108); ctx.lineTo(18, 46); ctx.quadraticCurveTo(60, 22, 102, 46); ctx.lineTo(102, 108); ctx.closePath(); ctx.clip();
  ctx.strokeStyle = 'rgba(30,40,64,0.45)'; ctx.lineWidth = 1.2;
  for (let y = 52; y < 108; y += 10) { ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(102, y); ctx.stroke(); }
  for (let y = 52, r = 0; y < 108; y += 10, r++) for (let x = 18 + (r % 2) * 9; x < 102; x += 18) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 10); ctx.stroke(); }
  ctx.restore();
  // The mouth: dark, with the cold flame burning inside.
  ctx.beginPath();
  ctx.moveTo(36, 104); ctx.lineTo(36, 78); ctx.quadraticCurveTo(60, 60, 84, 78); ctx.lineTo(84, 104); ctx.closePath();
  ctx.fillStyle = '#04060c'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  softGlow(ctx, 60, 90, 26, `rgba(140,210,255,${0.85 * glow})`);
  flameTongue(ctx, 60, 104, 13, 60 + flick * 0.4, 62 + flick, '#f2fbff', '#7fd0ff', '#2a5aa8');
  flameTongue(ctx, 50, 104, 7, 46 - flick * 0.3, 78 - flick * 0.5, '#e6f6ff', '#6ab8f0', '#244a90');
  flameTongue(ctx, 70, 104, 7, 74 + flick * 0.3, 76 + flick * 0.3, '#e6f6ff', '#6ab8f0', '#244a90');
  // A frowning brow cracked across the arch, with two cold eyes burning in the stone.
  for (const x of [47, 73]) { ell(ctx, x, 58, 7, 5); ctx.fillStyle = '#05080f'; ctx.fill(); }
  cracks(ctx, [[[38, 50], [47, 54], [56, 52]], [[82, 50], [73, 54], [64, 52]]], `rgba(140,210,255,${glow})`, 2);
  eyes(ctx, [[47, 58], [73, 58]], 3.4, '#bfe6ff');
  // Icicles hanging from the lintel.
  for (const [x, l] of [[30, 10], [40, 16], [50, 8], [70, 9], [80, 15], [90, 11]]) {
    ctx.beginPath(); ctx.moveTo(x - 3, 47 - (x > 40 && x < 80 ? 9 : 2)); ctx.lineTo(x, 47 + l - (x > 40 && x < 80 ? 9 : 2)); ctx.lineTo(x + 3, 47 - (x > 40 && x < 80 ? 9 : 2)); ctx.closePath();
    shade(ctx, RIME_HI, RIME, 40, 60, 0.9);
  }
  // Hearthstone base.
  ctx.beginPath(); ctx.rect(12, 104, 96, 10);
  shade(ctx, '#9cb2c8', RIME_LO, 104, 114, 2);
}

/** One tongue of flame from (x, y0) up to a tip at (tx, ty), `w` wide at the base. */
function flameTongue(ctx: Ctx, x: number, y0: number, w: number, tx: number, ty: number, hi: string, mid: string, lo: string): void {
  ctx.beginPath();
  ctx.moveTo(x - w, y0);
  ctx.bezierCurveTo(x - w * 1.25, y0 - (y0 - ty) * 0.45, tx - w * 0.35, ty + (y0 - ty) * 0.3, tx, ty);
  ctx.bezierCurveTo(tx + w * 0.35, ty + (y0 - ty) * 0.3, x + w * 1.25, y0 - (y0 - ty) * 0.45, x + w, y0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, ty, 0, y0);
  g.addColorStop(0, hi);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, lo);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/**
 * Ysmeret, the Twofold Flame (the Ashvents' group boss): a fire spirit rising out of a
 * basalt hearth, two flames wound into one. The gold flame on the left and the rose flame
 * on the right share a split obsidian mask, and each reaches an arm down toward its vent.
 */
function drawYsmeret(ctx: Ctx, _s: number, f: number): void {
  const sway = [0, 2.5, 0, -2.5][f];
  const lick = [0, -4, -7, -3][f];
  const heat = [0.8, 0.95, 1, 0.9][f];
  const GOLD = ['#fff3c4', '#ffc861', '#d9641c'] as const;
  const ROSE = ['#ffe0ea', '#ff6b8a', '#8a1f3c'] as const;
  softGlow(ctx, 60, 64, 54, `rgba(255,140,70,${0.35 * heat})`);
  // Arms: a wisp of each flame curling down and out toward its vent.
  ctx.save();
  ctx.lineCap = 'round';
  for (const [side, col] of [[-1, GOLD], [1, ROSE]] as const) {
    ctx.strokeStyle = INK; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(60 + side * 14, 64); ctx.quadraticCurveTo(60 + side * 44, 58 + sway * side, 60 + side * 50, 84); ctx.stroke();
    ctx.strokeStyle = col[1]; ctx.lineWidth = 6.5; ctx.stroke();
    ctx.strokeStyle = col[0]; ctx.lineWidth = 2; ctx.stroke();
    softGlow(ctx, 60 + side * 50, 86, 9, side < 0 ? 'rgba(255,200,97,0.9)' : 'rgba(255,107,138,0.9)', heat);
  }
  ctx.restore();
  // The two flames, each leaning across the other.
  // Side tongues first, so the main flames overlap them.
  flameTongue(ctx, 40, 96, 9, 28 - sway, 44 + lick * 0.5, GOLD[0], GOLD[1], GOLD[2]);
  flameTongue(ctx, 46, 96, 8, 40 + sway * 0.6, 30 - lick * 0.4, GOLD[0], GOLD[1], GOLD[2]);
  flameTongue(ctx, 80, 96, 9, 92 + sway, 42 - lick * 0.3, ROSE[0], ROSE[1], ROSE[2]);
  flameTongue(ctx, 74, 96, 8, 80 - sway * 0.6, 28 + lick * 0.5, ROSE[0], ROSE[1], ROSE[2]);
  flameTongue(ctx, 50, 98, 15, 66 + sway, 6 + lick, GOLD[0], GOLD[1], GOLD[2]);
  flameTongue(ctx, 70, 98, 15, 54 - sway, 10 + lick * 0.6, ROSE[0], ROSE[1], ROSE[2]);
  // Hot cores where they cross.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  flameTongue(ctx, 60, 96, 8, 60 + sway * 0.5, 40 + lick * 0.5, 'rgba(255,255,240,0.9)', 'rgba(255,220,150,0.6)', 'rgba(255,140,60,0)');
  ctx.restore();
  // The split mask: obsidian, gold eyes on one side, rose on the other.
  ell(ctx, 60, 54, 15, 17);
  shade(ctx, '#3a2a2e', '#0e0809', 37, 71, 1.8);
  ctx.save();
  ell(ctx, 60, 54, 15, 17); ctx.clip();
  ctx.strokeStyle = `rgba(255,200,140,${0.8 * heat})`; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(60, 37); ctx.lineTo(58, 46); ctx.lineTo(62, 54); ctx.lineTo(59, 63); ctx.lineTo(61, 72); ctx.stroke();
  ctx.restore();
  eyes(ctx, [[53, 52]], 2.6, '#ffc861');
  eyes(ctx, [[67, 52]], 2.6, '#ff6b8a');
  // The basalt hearth it rises from, with two glowing vent mouths.
  ell(ctx, 60, 100, 34, 11);
  shade(ctx, '#3c3236', '#141012', 89, 111, 2);
  ell(ctx, 60, 97, 26, 6);
  const mouth = ctx.createRadialGradient(60, 97, 2, 60, 97, 26);
  mouth.addColorStop(0, `rgba(255,236,170,${heat})`);
  mouth.addColorStop(0.5, `rgba(255,140,50,${0.9 * heat})`);
  mouth.addColorStop(1, 'rgba(120,30,20,0.9)');
  ctx.fillStyle = mouth;
  ctx.fill();
  cracks(ctx, [[[30, 102], [36, 106], [34, 110]], [[88, 102], [84, 107], [88, 110]]], `rgba(255,179,71,${heat})`, 1.2);
  // Sparks.
  ctx.save();
  for (const [x, y, r] of [[34, 30], [86, 26], [44, 12], [80, 44]].map(([x, y], k) => [x + ((k + f) % 2) * 2, y - f * 2, 1.4 + (k % 2)] as const)) {
    softGlow(ctx, x, y, r * 3, 'rgba(255,200,120,0.8)');
    ctx.fillStyle = '#fff1c8'; ell(ctx, x, y, r, r); ctx.fill();
  }
  ctx.restore();
}

function drawOndrel(ctx: Ctx, s: number, f: number): void {
  const lift = [0, 3, 6, 3][f];
  const heat = [0.75, 0.9, 1, 0.9][f];
  const STEEL_HI = '#9aa3b8';
  const STEEL_LO = '#262a36';
  // Legs: thick iron greaves.
  for (const x of [42, 78]) {
    ctx.beginPath();
    ctx.moveTo(x - 11, 92); ctx.lineTo(x + 11, 92); ctx.lineTo(x + 13, 112); ctx.lineTo(x - 13, 112); ctx.closePath();
    shade(ctx, '#3e3a46', '#121016', 92, 112, 2);
  }
  // Left arm hanging, fist of slag.
  limb(ctx, 30, 52, 18, 84, 13, '#3a3642');
  softGlow(ctx, 17, 87, 9, `rgba(255,140,60,${0.7 * heat})`);
  ell(ctx, 17, 87, 7, 6);
  shade(ctx, '#ffb347', '#a8381a', 81, 93, 2);
  // The great hammer, held up and back in the right hand.
  const hx = 96;
  const hy = 68 - lift;
  limb(ctx, 88, 52, hx, hy, 12, '#3a3642');
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(-0.35 - lift * 0.02);
  limb(ctx, 0, 10, 0, -36, 4.5, '#5b3a24');
  ctx.beginPath();
  ctx.rect(-15, -50, 30, 17);
  shade(ctx, STEEL_HI, STEEL_LO, -50, -33, 2.2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-13, -48); ctx.lineTo(13, -48); ctx.stroke();
  cracks(ctx, [[[-6, -46], [-2, -41], [-6, -36]]], '#ffb347', 1.2);
  ctx.restore();
  // Body: a broad iron cuirass narrowing to the hips.
  ctx.beginPath();
  ctx.moveTo(26, 46);
  ctx.quadraticCurveTo(60, 34, 94, 46);
  ctx.lineTo(86, 94);
  ctx.quadraticCurveTo(60, 100, 34, 94);
  ctx.closePath();
  shade(ctx, '#4a4652', '#141218', 40, 98, 2.4);
  rimLight(ctx, 36, 70, 'rgba(255,170,110,0.45)', 1.2);
  // Riveted plate seams with slag glowing through.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(26, 46); ctx.quadraticCurveTo(60, 34, 94, 46); ctx.lineTo(86, 94); ctx.quadraticCurveTo(60, 100, 34, 94); ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = `rgba(255,150,60,${0.85 * heat})`;
  ctx.lineWidth = 2;
  for (const y of [78, 88]) { ctx.beginPath(); ctx.moveTo(20, y); ctx.quadraticCurveTo(60, y + 4, 100, y); ctx.stroke(); }
  ctx.fillStyle = 'rgba(15,10,12,0.7)';
  for (const [x, y] of [[36, 82], [48, 84], [72, 84], [84, 82]]) { ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  cracks(ctx, [[[32, 66], [38, 72], [34, 80]], [[88, 64], [84, 72], [88, 78]]], `rgba(255,179,71,${heat})`, 1.4);
  // The anvil chest: flat face, waist and a horn pointing forward (right).
  ctx.beginPath();
  ctx.moveTo(36, 52); ctx.lineTo(80, 52);
  ctx.quadraticCurveTo(96, 53, 104, 58);
  ctx.quadraticCurveTo(92, 61, 80, 62);
  ctx.lineTo(74, 62); ctx.lineTo(70, 72); ctx.lineTo(46, 72); ctx.lineTo(42, 62); ctx.lineTo(36, 62);
  ctx.closePath();
  shade(ctx, '#b4bccd', '#3a3f4e', 52, 72, 2.2);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(38, 53.5); ctx.lineTo(80, 53.5); ctx.stroke();
  softGlow(ctx, 58, 66, 9, `rgba(255,150,60,${0.55 * heat})`);
  // Shoulder pauldrons.
  for (const x of [28, 92]) {
    ell(ctx, x, 46, 14, 10);
    shade(ctx, '#5a5562', '#1a181f', 36, 56, 2.2);
  }
  // Head: a squat helm sunk between the shoulders, a visor slit with two hot eyes.
  ctx.beginPath();
  ctx.moveTo(48, 44); ctx.lineTo(48, 28); ctx.quadraticCurveTo(60, 18, 72, 28); ctx.lineTo(72, 44); ctx.closePath();
  shade(ctx, '#55505e', '#16141a', 20, 44, 2.2);
  ctx.fillStyle = '#120a08';
  ctx.fillRect(51, 33, 18, 4.5);
  softGlow(ctx, 60, 35, 10, `rgba(255,120,40,${0.7 * heat})`);
  eyes(ctx, [[55.5, 35.2], [64.5, 35.2]], 1.9, '#ffcf55');
  // A crest of three iron ridges.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  for (const dx of [-5, 0, 5]) { ctx.beginPath(); ctx.moveTo(60 + dx, 22 + Math.abs(dx) * 0.3); ctx.lineTo(60 + dx * 1.2, 16 + Math.abs(dx) * 0.4); ctx.stroke(); }
  void s;
}

/** Ember Acolyte: a robed channeler holding green fire aloft. */
function drawAcolyte(ctx: Ctx, _s: number, f: number): void {
  const fl = [0, 1, 0.4, 1.4][f];
  ctx.beginPath();
  ctx.moveTo(17, 10);
  ctx.quadraticCurveTo(24, 18, 27, 32);
  ctx.quadraticCurveTo(17, 34, 7, 32);
  ctx.quadraticCurveTo(10, 18, 17, 10);
  ctx.closePath();
  shade(ctx, '#5a3018', '#26120a', 10, 33);
  limb(ctx, 13, 17, 10, 8, 2.4, '#4a2814');
  limb(ctx, 21, 17, 24, 8, 2.4, '#4a2814');
  ell(ctx, 17, 12, 4.4, 4.6);
  shade(ctx, '#6a3a1e', '#2c150b', 7, 17);
  eyes(ctx, [[16, 12.5], [18.6, 12.5]], 0.8, '#b6ffd2');
  softGlow(ctx, 17, 5, 8 + fl, 'rgba(125,255,176,0.85)');
  ctx.save();
  ctx.fillStyle = '#e6fff0';
  ctx.beginPath();
  ctx.moveTo(17, 0.5 - fl); ctx.quadraticCurveTo(20.5, 5, 17, 8); ctx.quadraticCurveTo(13.5, 5, 17, 0.5 - fl);
  ctx.fill();
  ctx.restore();
}

/** The Lumen: a healer in pale robes with a halo and a lantern staff. Faces right. */
function drawLumen(ctx: Ctx, _s: number, f: number): void {
  const bob = [0, -1, 0, -1][f];
  const sway = [-1.4, 0, 1.4, 0][f];
  const step = [1, 0, -1, 0][f];
  const swing = [0.08, 0, -0.08, 0][f];
  ctx.fillStyle = '#4a3a28';
  ell(ctx, 20 + step * 2, 43.5, 3, 1.6); ctx.fill();
  ell(ctx, 28 - step * 2, 43.5, 3, 1.6); ctx.fill();
  // Lantern staff, the lantern swinging on its hook.
  limb(ctx, 34, 12 + bob, 32, 45, 2, '#c9a46a');
  ctx.save();
  ctx.translate(36, 11 + bob);
  ctx.rotate(swing);
  limb(ctx, 0, 0, 2, 4, 0.8, '#8a6a3a');
  softGlow(ctx, 2, 8, 11, 'rgba(255,230,150,0.95)');
  ctx.beginPath(); ctx.rect(-0.5, 5, 5, 6); shade(ctx, '#fff8d8', '#e0b04a', 5, 11, 0.9);
  ctx.restore();
  // Robe.
  ctx.beginPath();
  ctx.moveTo(18, 19 + bob);
  ctx.quadraticCurveTo(24, 16 + bob, 30, 19 + bob);
  ctx.lineTo(36 + sway, 42);
  ctx.quadraticCurveTo(24 + sway * 0.5, 45, 12 + sway, 42);
  ctx.closePath();
  shade(ctx, '#fbf4e2', '#b9ad94', 18, 44);
  // Gold stole down the front.
  ctx.save();
  ctx.fillStyle = '#e8b84a';
  ctx.beginPath();
  ctx.moveTo(22, 20 + bob); ctx.lineTo(25, 20 + bob); ctx.lineTo(26 + sway * 0.4, 42); ctx.lineTo(22.5 + sway * 0.4, 42.5); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#8a6420'; ctx.lineWidth = 0.6; ctx.stroke();
  ctx.restore();
  // Arm to the staff.
  limb(ctx, 27, 23 + bob, 32.5, 26 + bob, 3.4, '#e9e0c8');
  ctx.fillStyle = '#e2b48a';
  ell(ctx, 33, 26 + bob, 1.7, 1.7); ctx.fill();
  // Hood, open face, halo.
  ctx.beginPath();
  ctx.moveTo(16, 10 + bob);
  ctx.quadraticCurveTo(23, 5 + bob, 29, 9 + bob);
  ctx.quadraticCurveTo(32, 14 + bob, 30, 20 + bob);
  ctx.quadraticCurveTo(24, 23 + bob, 18, 20 + bob);
  ctx.quadraticCurveTo(15, 15 + bob, 16, 10 + bob);
  ctx.closePath();
  shade(ctx, '#ffffff', '#cfc4a8', 5, 22);
  ell(ctx, 26.2, 14.8 + bob, 3.6, 4); ctx.fillStyle = '#e8bf98'; ctx.fill();
  ctx.fillStyle = '#3a2a20';
  ell(ctx, 25.4, 14.4 + bob, 0.6, 0.8); ctx.fill();
  ell(ctx, 28.2, 14.4 + bob, 0.6, 0.8); ctx.fill();
  ctx.save();
  ctx.strokeStyle = '#ffe08a';
  ctx.shadowColor = '#ffd27a';
  ctx.shadowBlur = 5;
  ctx.lineWidth = 1.6;
  ell(ctx, 23, 4.5 + bob + Math.sin(f * 1.57) * 0.4, 7, 2.2); ctx.stroke();
  ctx.restore();
}

/** The Bulwark: a plated knight behind a tower shield, mace in hand. Faces right. */
function drawBulwark(ctx: Ctx, _s: number, f: number): void {
  const bob = [0, -0.8, 0, -0.8][f];
  const step = [1.5, 0, -1.5, 0][f];
  ctx.fillStyle = '#2a2f38';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ell(ctx, 21 - step, 47, 4.5, 2.6); ctx.fill(); ctx.stroke();
  ell(ctx, 31 + step, 47, 4.5, 2.6); ctx.fill(); ctx.stroke();
  // Mace raised behind.
  limb(ctx, 17, 26 + bob, 11, 15 + bob, 2.2, '#6a4a2a');
  ell(ctx, 10, 13 + bob, 4, 4); shade(ctx, '#c8d0dc', '#4a5260', 9, 17, 1.1);
  ctx.fillStyle = '#e8eef6';
  for (const [x, y] of [[6.5, 11], [10, 8.6], [13.5, 11]]) { ell(ctx, x, y + bob, 1, 1); ctx.fill(); }
  // Body: a broad plated torso.
  ctx.beginPath();
  ctx.moveTo(15, 22 + bob);
  ctx.quadraticCurveTo(26, 15 + bob, 37, 22 + bob);
  ctx.lineTo(35, 42);
  ctx.quadraticCurveTo(26, 45, 17, 42);
  ctx.closePath();
  shade(ctx, '#8a97ab', '#2c323e', 16, 44, 1.5);
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(17, 31 + bob); ctx.quadraticCurveTo(26, 34 + bob, 35, 31 + bob); ctx.stroke();
  ctx.restore();
  // Pauldron and helm with a visor slit.
  ell(ctx, 18, 22 + bob, 6, 4.5); shade(ctx, '#b4c0d2', '#4a5262', 17, 27, 1.2);
  ctx.beginPath();
  ctx.moveTo(19, 18 + bob);
  ctx.quadraticCurveTo(19, 6 + bob, 27, 6 + bob);
  ctx.quadraticCurveTo(34, 7 + bob, 33, 18 + bob);
  ctx.closePath();
  shade(ctx, '#c4cedc', '#566070', 6, 18, 1.3);
  ctx.fillStyle = '#0c0e12';
  ctx.fillRect(25, 11.5 + bob, 8, 2);
  eyes(ctx, [[30.5, 12.5 + bob]], 0.8, '#ffd27a');
  ctx.fillStyle = '#d04a3a';
  ctx.beginPath(); ctx.moveTo(26, 6 + bob); ctx.quadraticCurveTo(20, 2 + bob, 16, 6 + bob); ctx.quadraticCurveTo(21, 4.5 + bob, 26, 7.5 + bob); ctx.fill();
  // Tower shield in front, with an ember sigil.
  ctx.beginPath();
  ctx.moveTo(33, 18 + bob);
  ctx.lineTo(45, 20 + bob);
  ctx.lineTo(45, 34 + bob);
  ctx.quadraticCurveTo(44, 43 + bob, 38, 46 + bob);
  ctx.quadraticCurveTo(33, 42 + bob, 32, 34 + bob);
  ctx.closePath();
  shade(ctx, '#6d7d96', '#2a3242', 18, 46, 1.6);
  ctx.save();
  ctx.strokeStyle = '#dfe7f2';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#ffd27a';
  ctx.shadowColor = '#ffb347';
  ctx.shadowBlur = 3;
  // An ember sigil: a ringed sun.
  ell(ctx, 38.8, 31 + bob, 3.2, 3.2); ctx.fill();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = '#ffd27a';
  ell(ctx, 38.8, 31 + bob, 5.4, 5.4); ctx.stroke();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(38.8 + Math.cos(a) * 6.4, 31 + bob + Math.sin(a) * 6.4); ctx.lineTo(38.8 + Math.cos(a) * 8, 31 + bob + Math.sin(a) * 8); ctx.stroke();
  }
  ctx.restore();
}

/** The Slagbinder: a squat figure in cooling slag plate, orange seams glowing through, a ladle of molten slag held out front. */
/** The Slagbinder. `anvil` is the Anvil stance (the tank): the same figure with an anvil-shaped slab of cooled slag
 * strapped to the back arm as a shield, and a second pauldron, so a party can tell its tank from a Bellows at a glance. */
function drawSlagbinder(ctx: Ctx, _s: number, f: number, anvil = false): void {
  const bob = [0, -0.8, 0, -0.8][f];
  const step = [1.5, 0, -1.5, 0][f];
  const SEAM = '#ff9b4a';
  ctx.fillStyle = '#26211f';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ell(ctx, 20 - step, 47, 5, 2.8); ctx.fill(); ctx.stroke();
  ell(ctx, 31 + step, 47, 5, 2.8); ctx.fill(); ctx.stroke();
  // Back arm resting on a heavy hammer haft.
  limb(ctx, 16, 28 + bob, 11, 40 + bob, 3.2, '#3a3230');
  // Body: a broad, rounded slab of cooled slag.
  ctx.beginPath();
  ctx.moveTo(13, 24 + bob);
  ctx.quadraticCurveTo(25, 14 + bob, 37, 23 + bob);
  ctx.quadraticCurveTo(40, 34, 36, 44);
  ctx.quadraticCurveTo(25, 47, 15, 44);
  ctx.quadraticCurveTo(10, 34, 13, 24 + bob);
  ctx.closePath();
  shade(ctx, '#5d5450', '#1e1a19', 15, 46, 1.5);
  // Glowing seams between the plates.
  cracks(ctx, [
    [[14, 31 + bob], [20, 33 + bob], [26, 31.5 + bob], [33, 33.5 + bob], [38, 31 + bob]],
    [[22, 33 + bob], [21, 38], [23, 44]],
    [[31, 33.5 + bob], [32.5, 39], [31, 44]],
    [[19, 21 + bob], [21, 26 + bob]],
  ], SEAM, 1.1);
  // A glowing core in the chest.
  softGlow(ctx, 26, 37, 5, 'rgba(255,155,74,0.55)');
  ctx.save();
  ctx.fillStyle = '#ffd08a'; ctx.shadowColor = SEAM; ctx.shadowBlur = 4;
  ell(ctx, 26, 37, 1.6, 1.6); ctx.fill();
  ctx.restore();
  // Heavy pauldron.
  ell(ctx, 16, 23 + bob, 6.5, 5); shade(ctx, '#6e6460', '#2a2422', 18, 28, 1.2);
  cracks(ctx, [[[12, 23.5 + bob], [15, 22 + bob], [17, 24.5 + bob]]], SEAM, 0.9);
  // Helm: a rounded slag dome with a burning slit.
  ctx.beginPath();
  ctx.moveTo(18, 19 + bob);
  ctx.quadraticCurveTo(17.5, 6 + bob, 26.5, 6 + bob);
  ctx.quadraticCurveTo(34.5, 6.5 + bob, 34, 19 + bob);
  ctx.quadraticCurveTo(26, 21 + bob, 18, 19 + bob);
  ctx.closePath();
  shade(ctx, '#6a605b', '#2a2422', 6, 19, 1.3);
  ctx.save();
  ctx.fillStyle = '#ffb35c'; ctx.shadowColor = SEAM; ctx.shadowBlur = 4;
  ctx.fillRect(24.5, 12 + bob, 8, 1.8);
  ctx.restore();
  cracks(ctx, [[[22, 8 + bob], [23.5, 11 + bob]]], SEAM, 0.8);
  if (anvil) {
    // A second pauldron on the front shoulder.
    ell(ctx, 34, 23.5 + bob, 5.2, 4.2); shade(ctx, '#6e6460', '#2a2422', 19, 28, 1.2);
    cracks(ctx, [[[31.5, 23.5 + bob], [34, 22.5 + bob], [36.5, 24 + bob]]], SEAM, 0.8);
    // The anvil slab on the back arm, big enough to read at game scale: a flat striking face, a short horn to
    // the back, and a narrow waist over a wide foot.
    ctx.save();
    ctx.translate(12, 36 + bob);
    ctx.scale(1.25, 1.25);
    ctx.beginPath();
    ctx.moveTo(-10.5, -3.5);
    ctx.quadraticCurveTo(-7.5, -4, -5.5, -5.5);
    ctx.lineTo(8.5, -5.5);
    ctx.lineTo(8.5, -0.5);
    ctx.lineTo(5, 1.5);
    ctx.lineTo(5, 4.5);
    ctx.lineTo(9, 7.5);
    ctx.lineTo(-6.5, 7.5);
    ctx.lineTo(-2.5, 4.5);
    ctx.lineTo(-2.5, 1.5);
    ctx.lineTo(-5.5, -0.5);
    ctx.quadraticCurveTo(-8, -1.5, -10.5, -3.5);
    ctx.closePath();
    shade(ctx, '#58504c', '#16120f', -6, 8, 1.3);
    // The striking face catches the light; a seam glows through the waist.
    ctx.fillStyle = 'rgba(235,225,215,0.8)';
    ctx.fillRect(-5, -5, 13, 1.3);
    cracks(ctx, [[[-1.5, 3], [1, 4.5], [3.5, 3]]], SEAM, 0.8);
    ctx.restore();
  }
  // Front arm and the ladle: a long haft, a deep bowl brimming with molten slag, one drip falling.
  limb(ctx, 33, 26 + bob, 39, 31 + bob, 3, '#4a403c');
  limb(ctx, 37, 34 + bob, 41.5, 25 + bob, 1.8, '#5a4a3a');
  // The bowl: a deep iron cup, its rim brimming.
  ctx.beginPath();
  ctx.moveTo(37.5, 22 + bob);
  ctx.quadraticCurveTo(38, 30 + bob, 43.5, 30 + bob);
  ctx.quadraticCurveTo(49, 30 + bob, 49.5, 22 + bob);
  ctx.closePath();
  shade(ctx, '#7a6e68', '#2c2624', 22, 30, 1.2);
  ctx.save();
  ctx.fillStyle = '#ffb347'; ctx.shadowColor = '#ff7a2a'; ctx.shadowBlur = 5;
  ell(ctx, 43.5, 22.2 + bob, 6, 1.7); ctx.fill();
  ctx.fillStyle = '#fff0c0';
  ell(ctx, 42, 21.9 + bob, 2.2, 0.6); ctx.fill();
  ctx.fillStyle = '#ffb347';
  const drop = (f % 2) * 2.5;
  ell(ctx, 49.2, 25 + bob + drop, 0.9, 1.3); ctx.fill();
  ctx.restore();
}

/** A route gate: a broken stone arch. The portal inside is a separate tinted glow. */
function drawGate(ctx: Ctx, s: number): void {
  const c = s / 2;
  ctx.beginPath();
  ctx.moveTo(c - 30, s - 6);
  ctx.lineTo(c - 30, 34);
  ctx.quadraticCurveTo(c - 30, 8, c, 8);
  ctx.quadraticCurveTo(c + 30, 8, c + 30, 34);
  ctx.lineTo(c + 30, s - 6);
  ctx.lineTo(c + 20, s - 6);
  ctx.lineTo(c + 20, 36);
  ctx.quadraticCurveTo(c + 20, 18, c, 18);
  ctx.quadraticCurveTo(c - 20, 18, c - 20, 36);
  ctx.lineTo(c - 20, s - 6);
  ctx.closePath();
  shade(ctx, '#6a5e58', '#2a2220', 8, s - 6, 1.8);
  // Stone joints and a keystone.
  ctx.save();
  ctx.strokeStyle = 'rgba(10,5,5,0.55)';
  ctx.lineWidth = 1;
  for (const y of [44, 56, 68]) {
    ctx.beginPath(); ctx.moveTo(c - 30, y); ctx.lineTo(c - 20, y); ctx.moveTo(c + 20, y); ctx.lineTo(c + 30, y); ctx.stroke();
  }
  for (const a of [-1.1, -0.55, 0.55, 1.1]) {
    ctx.beginPath();
    ctx.moveTo(c + Math.sin(a) * 10, 28 - Math.cos(a) * 10);
    ctx.lineTo(c + Math.sin(a) * 23, 28 - Math.cos(a) * 21);
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(c - 5, 7); ctx.lineTo(c + 5, 7); ctx.lineTo(c + 4, 19); ctx.lineTo(c - 4, 19); ctx.closePath();
  shade(ctx, '#8a7c74', '#3a3030', 7, 19, 1.3);
  // Rubble at the feet.
  for (const [x, r] of [[c - 34, 3], [c + 33, 2.5], [c + 26, 2]] as [number, number][]) {
    ell(ctx, x, s - 6, r * 1.3, r); shade(ctx, '#5a4e48', '#221a18', s - 6 - r, s - 6 + r, 1);
  }
}

/** Portal glow that fills a gate arch (white, tinted by the gate's kind). */
function drawPortal(ctx: Ctx, s: number): void {
  const c = s / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(c - 20, s - 6);
  ctx.lineTo(c - 20, 36);
  ctx.quadraticCurveTo(c - 20, 18, c, 18);
  ctx.quadraticCurveTo(c + 20, 18, c + 20, 36);
  ctx.lineTo(c + 20, s - 6);
  ctx.closePath();
  ctx.clip();
  const g = ctx.createRadialGradient(c, s * 0.6, 2, c, s * 0.6, 34);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0.15)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    for (let t = 0; t <= 1.001; t += 0.05) {
      const a = k * 2.1 + t * 4;
      const r = 3 + t * 16;
      const x = c + Math.cos(a) * r;
      const y = s * 0.6 + Math.sin(a) * r * 1.3;
      if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Grandmother Slag (world boss): a towering crone of cooled slag with a molten ladle. Faces right. */
function drawSlagCrone(ctx: Ctx, s: number, f: number): void {
  const sway = [0, 1.5, 3, 1.5][f];
  const drip = [0, 2, 4, 6][f];
  const c = s / 2;
  // Skirts of layered slag, wide at the ground.
  ctx.beginPath();
  ctx.moveTo(c - 44, 120);
  ctx.quadraticCurveTo(c - 40, 70, c - 18, 48);
  ctx.lineTo(c + 18, 48);
  ctx.quadraticCurveTo(c + 40, 70, c + 44 + sway * 0.4, 120);
  ctx.quadraticCurveTo(c, 126, c - 44, 120);
  ctx.closePath();
  shade(ctx, '#4a3f3c', '#151110', 48, 124, 2.2);
  // Glowing seams in the skirts.
  cracks(ctx, [[[c - 30, 112], [c - 24, 96], [c - 28, 80]], [[c + 2, 118], [c + 6, 100], [c + 1, 86], [c + 5, 70]], [[c + 28, 114], [c + 24, 98]]], '#ff8a3d', 1.6);
  // Hunched back with a shawl.
  ell(ctx, c - 6, 50, 30, 20, -0.2);
  shade(ctx, '#5a4d48', '#1f1917', 30, 70, 2);
  ctx.save();
  ctx.fillStyle = '#7a2e22';
  ctx.beginPath();
  ctx.moveTo(c - 34, 46); ctx.quadraticCurveTo(c - 6, 30, c + 22, 44); ctx.quadraticCurveTo(c + 6, 66, c - 28, 62); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.restore();
  // Back arm leaning on a staff of fused rebar.
  limb(ctx, c - 24, 56, c - 36, 82, 6, '#3d3331');
  limb(ctx, c - 38, 30, c - 36, 122, 3.4, '#2a2624');
  // Head jutting forward: a hooded skull-face with ember eyes and a long chin.
  ctx.beginPath();
  ctx.moveTo(c + 4, 26);
  ctx.quadraticCurveTo(c + 14, 10, c + 30, 18);
  ctx.quadraticCurveTo(c + 38, 30, c + 30, 42);
  ctx.quadraticCurveTo(c + 18, 46, c + 8, 40);
  ctx.closePath();
  shade(ctx, '#6a5a54', '#2a221f', 10, 46, 1.8);
  ell(ctx, c + 26, 30, 7, 8); ctx.fillStyle = '#c9b8a8'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = '#1a0e0a';
  ell(ctx, c + 26, 37, 3, 1.4); ctx.fill();
  eyes(ctx, [[c + 23.5, 28], [c + 29, 28]], 1.8, '#ffb347');
  // Wild ash hair.
  ctx.save();
  ctx.strokeStyle = '#9a8f88';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  for (const [x, y, dx, dy] of [[c + 6, 22, -10, 6], [c + 10, 16, -12, -2], [c + 16, 13, -8, -8], [c + 4, 30, -12, 12]]) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + dx * 0.6, y + dy * 0.2 - 3, x + dx, y + dy); ctx.stroke();
  }
  ctx.restore();
  // Front arm holding out a ladle of molten slag that drips.
  limb(ctx, c + 14, 54, c + 34, 62, 6, '#4a3e3a');
  limb(ctx, c + 34, 62, c + 52, 58 + sway * 0.5, 2.4, '#3a3230');
  softGlow(ctx, c + 54, 62 + sway * 0.5, 16, 'rgba(255,150,60,0.9)');
  ell(ctx, c + 54, 62 + sway * 0.5, 8, 4.4);
  shade(ctx, '#fff0b0', '#e0601f', 58, 66, 1.4);
  ctx.save();
  ctx.fillStyle = '#ffb347';
  ctx.shadowColor = '#ff8a3d';
  ctx.shadowBlur = 4;
  ctx.beginPath();
  const dy = 66 + sway * 0.5;
  ctx.moveTo(c + 52, dy); ctx.quadraticCurveTo(c + 54, dy + 4 + drip, c + 52, dy + 6 + drip); ctx.quadraticCurveTo(c + 50, dy + 4 + drip, c + 52, dy);
  ctx.fill();
  ctx.restore();
}

/**
 * The Cinder Colossus (a world boss; its shadow fight uses this sheet): a hulking giant of stacked cinder blocks,
 * all shoulders and fists, with a tiny head and one furnace slit for an eye. Knuckles drag on the ground; the
 * shoulders heave as it breathes and the core in its chest pulses. 128 units, faces right.
 */
function drawColossus(ctx: Ctx, s: number, f: number): void {
  const heave = [0, -1.5, -3, -1.5][f];
  const pulse = [0.7, 0.85, 1, 0.85][f];
  const c = s / 2;
  softGlow(ctx, c, 70, 56, `rgba(255,120,40,${0.14 * pulse})`);
  // Stubby pillar legs.
  for (const x of [c - 20, c + 12]) {
    ctx.beginPath(); ctx.rect(x, 96, 16, 24);
    shade(ctx, '#3e3532', '#141010', 96, 120, 1.8);
  }
  cracks(ctx, [[[c - 14, 100], [c - 10, 110], [c - 13, 118]], [[c + 18, 102], [c + 21, 114]]], '#ff8a3d', 1.2);
  // The torso: a wide block, narrower at the waist.
  ctx.beginPath();
  ctx.moveTo(c - 34, 44 + heave);
  ctx.lineTo(c + 34, 44 + heave);
  ctx.lineTo(c + 24, 100);
  ctx.lineTo(c - 24, 100);
  ctx.closePath();
  shade(ctx, '#544945', '#1a1514', 44, 100, 2.2);
  // Block seams across the body.
  ctx.save();
  ctx.strokeStyle = 'rgba(12,5,6,0.7)'; ctx.lineWidth = 1.4;
  for (const [x1, y1, x2, y2] of [[c - 31, 62, c + 31, 62], [c - 27, 82, c + 27, 82], [c - 8, 44, c - 10, 62], [c + 14, 62, c + 12, 82], [c - 14, 82, c - 13, 100]]) {
    ctx.beginPath(); ctx.moveTo(x1, y1 + (y1 < 50 ? heave : 0)); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.restore();
  // The core: a glowing furnace heart behind a cracked plate.
  softGlow(ctx, c + 2, 70, 16, `rgba(255,170,70,${0.85 * pulse})`);
  ell(ctx, c + 2, 70, 7, 7);
  ctx.save(); ctx.fillStyle = '#ffd890'; ctx.shadowColor = '#ff8a3d'; ctx.shadowBlur = 8 * pulse; ctx.fill(); ctx.restore();
  cracks(ctx, [[[c - 6, 64], [c + 2, 70], [c - 4, 78]], [[c + 10, 64], [c + 2, 70], [c + 12, 76]], [[c - 20, 90], [c - 10, 94], [c + 2, 90]]], '#ff9b4a', 1.4);
  // Boulder shoulders.
  for (const [x, r] of [[c - 34, 15], [c + 34, 15]] as const) {
    ell(ctx, x, 44 + heave, r, r * 0.85);
    shade(ctx, '#655853', '#221b19', 30 + heave, 58 + heave, 2);
  }
  cracks(ctx, [[[c - 42, 40 + heave], [c - 34, 36 + heave], [c - 28, 42 + heave]], [[c + 28, 40 + heave], [c + 36, 37 + heave]]], '#ff8a3d', 1.1);
  // Arms hanging to knuckles that drag the ground.
  limb(ctx, c - 40, 54 + heave, c - 46, 92, 11, '#433835');
  limb(ctx, c + 40, 54 + heave, c + 47, 92, 11, '#4a3f3b');
  for (const x of [c - 47, c + 48]) {
    ell(ctx, x, 104, 11, 9);
    shade(ctx, '#5a4e49', '#1c1716', 95, 113, 1.8);
  }
  cracks(ctx, [[[c + 42, 102], [c + 48, 106], [c + 54, 102]]], '#ff8a3d', 1);
  // A tiny head sunk between the shoulders, with one furnace slit for an eye.
  ctx.beginPath();
  ctx.moveTo(c - 10, 42 + heave);
  ctx.lineTo(c - 8, 26 + heave);
  ctx.lineTo(c + 10, 25 + heave);
  ctx.lineTo(c + 13, 42 + heave);
  ctx.closePath();
  shade(ctx, '#6a5d57', '#2a2220', 25 + heave, 42 + heave, 1.8);
  ctx.save();
  ctx.fillStyle = '#ffc861'; ctx.shadowColor = '#ff8a3d'; ctx.shadowBlur = 6;
  ctx.fillRect(c - 1, 32 + heave, 13, 3);
  ctx.restore();
}

/**
 * The Furnace Regent (a world boss; its shadow fight uses this sheet): a tall, regal stove of black iron in a
 * heavy mantle, a crown of flame on a grated face, the grate in its belly roaring, and a poker for a sceptre.
 * The crown flickers and the mantle sways. 128 units, faces right.
 */
function drawRegent(ctx: Ctx, s: number, f: number): void {
  const sway = [0, 1.2, 2.4, 1.2][f];
  const flick = [0, 1, 2, 1][f];
  const c = s / 2;
  softGlow(ctx, c, 60, 58, 'rgba(255,140,50,0.14)');
  // The mantle: a heavy cloak falling wide to the ground behind the body.
  ctx.beginPath();
  ctx.moveTo(c - 18, 36);
  ctx.quadraticCurveTo(c - 44, 70, c - 46 - sway, 122);
  ctx.quadraticCurveTo(c, 128, c + 40 + sway * 0.5, 122);
  ctx.quadraticCurveTo(c + 36, 70, c + 18, 36);
  ctx.closePath();
  shade(ctx, '#6a2432', '#1e0a10', 36, 124, 2.2);
  // The mantle's ermine of pale ash at the hem.
  ctx.save();
  ctx.strokeStyle = '#cbbcae'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(c - 44 - sway, 119); ctx.quadraticCurveTo(c, 125, c + 38 + sway * 0.5, 119); ctx.stroke();
  ctx.restore();
  // The body: a tall iron stove, flared at the base.
  ctx.beginPath();
  ctx.moveTo(c - 15, 40);
  ctx.lineTo(c + 15, 40);
  ctx.lineTo(c + 20, 112);
  ctx.lineTo(c - 20, 112);
  ctx.closePath();
  shade(ctx, '#4a4446', '#141214', 40, 112, 2);
  // Rivets and a brass band.
  ctx.save();
  ctx.fillStyle = '#c8a050';
  ctx.fillRect(c - 17, 58, 34, 3);
  ctx.fillStyle = 'rgba(200,180,150,0.6)';
  for (const y of [48, 70, 104]) for (const x of [c - 12, c + 12]) { ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  // The grate in its belly, roaring.
  softGlow(ctx, c, 86, 20, 'rgba(255,170,70,0.9)');
  ctx.beginPath(); ctx.rect(c - 11, 74, 22, 22);
  shade(ctx, '#ffd890', '#ff6a2a', 74, 96, 1.6);
  ctx.save();
  ctx.strokeStyle = '#1a1214'; ctx.lineWidth = 2.2;
  for (const x of [c - 5.5, c, c + 5.5]) { ctx.beginPath(); ctx.moveTo(x, 74); ctx.lineTo(x, 96); ctx.stroke(); }
  ctx.restore();
  // Back arm under the mantle; front arm holds the poker sceptre, its tip glowing.
  limb(ctx, c - 14, 46, c - 24, 72, 6, '#3a3436');
  limb(ctx, c + 14, 46, c + 28, 66, 6, '#4a4446');
  limb(ctx, c + 30, 30, c + 32, 116, 2.6, '#2a2628');
  softGlow(ctx, c + 30, 26, 9, 'rgba(255,160,60,0.9)');
  ell(ctx, c + 30, 26, 3, 3);
  ctx.save(); ctx.fillStyle = '#ffd08a'; ctx.shadowColor = '#ff8a3d'; ctx.shadowBlur = 6; ctx.fill(); ctx.restore();
  ell(ctx, c + 29, 66, 4.5, 4); shade(ctx, '#5a5456', '#2a2628', 62, 70, 1.4);
  // Head and crown drawn a third wider, so the crown reads at game scale.
  ctx.save();
  ctx.translate(c, 0);
  ctx.scale(1.35, 1);
  ctx.translate(-c, 0);
  // The head: an iron box with a grated face, a stack collar beneath.
  ctx.beginPath(); ctx.rect(c - 9, 18, 18, 20);
  shade(ctx, '#5a5456', '#1e1c1e', 18, 38, 1.8);
  ctx.save();
  ctx.fillStyle = '#ffb347'; ctx.shadowColor = '#ff8a3d'; ctx.shadowBlur = 5;
  for (const y of [24, 28.5, 33]) ctx.fillRect(c - 4, y, 12, 1.8);
  ctx.restore();
  // The crown: five flame tongues on a brass circlet.
  const tips: [number, number][] = [[c - 8, 4 + flick], [c - 4, 0 - flick], [c, 2 + flick * 0.5], [c + 4, -1 + flick], [c + 8, 4 - flick * 0.5]];
  ctx.save();
  ctx.shadowColor = '#ff8a3d'; ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(c - 10, 17);
  for (let i = 0; i < tips.length; i++) {
    const [tx, ty] = tips[i];
    ctx.quadraticCurveTo(tx - 2.5, 12, tx, ty + 6);
    ctx.quadraticCurveTo(tx + 2.5, 12, tx + 2, 17);
  }
  ctx.closePath();
  const fg = ctx.createLinearGradient(0, 2, 0, 17);
  fg.addColorStop(0, '#fff0b0'); fg.addColorStop(0.5, '#ffb347'); fg.addColorStop(1, '#e0601f');
  ctx.fillStyle = fg; ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#c8a050'; ctx.fillRect(c - 10, 15.5, 20, 3);
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(c - 10, 15.5, 20, 3);
  ctx.restore();
}

/** The sheet that draws a world boss by its server name (its shadow fight and the hub's portrait). Old Ashmaw is
 * Old Coalmouth's name until migration 0007 runs. */
export const WORLD_BOSS_SHEET: Record<string, { key: string; size: number }> = {
  'Grandmother Slag': { key: 'slagCrone', size: 128 },
  'The Cinder Colossus': { key: 'colossus', size: 128 },
  'Old Coalmouth': { key: 'coalmouth', size: 192 },
  'Old Ashmaw': { key: 'coalmouth', size: 192 },
  'The Furnace Regent': { key: 'regent', size: 128 },
};
const WORLD_BOSS_DRAW: Record<string, FrameDraw> = { slagCrone: drawSlagCrone, colossus: drawColossus, coalmouth: drawCoalmouth, regent: drawRegent };

/** Draws frame `f` of a world boss into a plain 2D canvas `px` pixels square, for the hub (no Phaser). */
export function drawWorldBossPortrait(ctx: Ctx, px: number, name: string, f = 0): boolean {
  const sh = WORLD_BOSS_SHEET[name];
  if (!sh) return false;
  ctx.save();
  ctx.scale(px / sh.size, px / sh.size);
  WORLD_BOSS_DRAW[sh.key](ctx, sh.size, f);
  ctx.restore();
  return true;
}

/**
 * Grandmother Slag in person, for the raid (R9): the shadow sprite's crone at 1.5x, with
 * a crown of cooled slag spikes, seams that pulse molten through her skirts, a brimming
 * ladle that spills, and embers falling around her. Drawn in the 128-unit space of
 * drawSlagCrone and scaled up, so the two always match.
 */
function drawSlagCroneRaid(ctx: Ctx, s: number, f: number): void {
  const k = s / 128;
  const c = 64;
  const pulse = [0.7, 0.85, 1, 0.85][f];
  const sway = [0, 1.5, 3, 1.5][f];
  ctx.save();
  // A touch smaller than the full frame and lowered, so the crown and the spill fit.
  ctx.scale(k * 0.94, k * 0.94);
  ctx.translate(0, 6);
  // A heat haze behind her.
  softGlow(ctx, c, 80, 60, `rgba(255,110,40,${0.22 * pulse})`);
  drawSlagCrone(ctx, 128, f);
  // Molten seams pulsing through the skirts, brighter than the shadow's.
  cracks(ctx, [[[c - 36, 118], [c - 32, 104], [c - 36, 92], [c - 30, 78]], [[c + 16, 120], [c + 20, 104], [c + 14, 90]], [[c - 12, 122], [c - 8, 108], [c - 14, 96]], [[c + 34, 118], [c + 30, 104], [c + 34, 92]]], `rgba(255,200,90,${pulse})`, 2);
  // A crown of cooled slag spikes along the hood, their tips still glowing.
  for (const [x, y, h, lean] of [[c + 8, 22, 9, -0.5], [c + 14, 15, 11, -0.25], [c + 21, 12, 12, 0], [c + 28, 13, 10, 0.25], [c + 34, 19, 8, 0.5]]) {
    const tx = x + Math.sin(lean) * h;
    const ty = y - Math.cos(lean) * h;
    ctx.beginPath(); ctx.moveTo(x - 2.4, y); ctx.lineTo(tx, ty); ctx.lineTo(x + 2.4, y); ctx.closePath();
    shade(ctx, '#5a4d48', '#211a18', ty, y, 1.1);
    softGlow(ctx, tx, ty, 3.5, `rgba(255,170,70,${0.9 * pulse})`);
  }
  // The ladle brims over: a second, longer pour and drops falling to the floor.
  const lx = c + 54;
  const ly = 66 + sway * 0.5;
  ctx.save();
  ctx.fillStyle = '#ffb347'; ctx.shadowColor = '#ff8a3d'; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.moveTo(lx + 3, ly); ctx.quadraticCurveTo(lx + 6, ly + 14, lx + 4, ly + 26 + f * 2); ctx.quadraticCurveTo(lx + 2, ly + 14, lx + 1, ly); ctx.fill();
  for (let d = 0; d < 3; d++) { ell(ctx, lx + 4 + (d - 1) * 3, ly + 34 + ((f + d * 2) % 6) * 4, 1.6, 2.2); ctx.fill(); }
  ctx.restore();
  // A pool of slag where it lands.
  ell(ctx, lx + 4, 122, 10, 3);
  ctx.fillStyle = `rgba(255,140,50,${0.75 * pulse})`; ctx.fill();
  // Embers drifting up around her.
  for (const [x, y] of [[c - 46, 60], [c - 30, 30], [c + 44, 34], [c + 6, 4], [c - 50, 96]]) {
    const yy = y - f * 3;
    softGlow(ctx, x, yy, 4, 'rgba(255,190,100,0.85)');
    ctx.fillStyle = '#ffe2a0'; ell(ctx, x, yy, 1, 1); ctx.fill();
  }
  ctx.restore();
}

/**
 * The Cinder Colossus in person, for raid 3 (Y6): the shadow sprite's giant at 1.5x, with molten slag running in
 * every seam between its blocks, two vents on its shoulders breathing flame, a blazing eye slit, slag dripping
 * from its knuckles into pools on the floor, and cinders drifting up. Drawn in the 128-unit space of
 * drawColossus and scaled up, so the two always match.
 */
function drawColossusRaid(ctx: Ctx, s: number, f: number, melt = false): void {
  const k = s / 128;
  const c = 64;
  const pulse = [0.7, 0.85, 1, 0.85][f];
  const heave = [0, -1.5, -3, -1.5][f];
  ctx.save();
  // A touch smaller than the full frame and lowered, so the shoulder flames fit.
  ctx.scale(k * 0.92, k * 0.92);
  ctx.translate(5, 10);
  softGlow(ctx, c, 76, 62, `rgba(255,110,40,${0.24 * pulse})`);
  drawColossus(ctx, 128, f);
  // Molten slag in the seams between the blocks, brighter than the shadow's.
  cracks(ctx, [[[c - 31, 62], [c - 8, 62], [c + 14, 62], [c + 31, 62]], [[c - 27, 82], [c - 4, 82], [c + 27, 82]], [[c - 8, 44 + heave], [c - 10, 62]], [[c + 14, 62], [c + 12, 82]], [[c - 14, 82], [c - 13, 100]]], `rgba(255,190,80,${0.85 * pulse})`, 1.8);
  // The eye slit blazes.
  softGlow(ctx, c + 5, 33.5 + heave, 9, `rgba(255,200,90,${0.9 * pulse})`);
  // Raid 3, "get behind him": a hot back and a cooled front. His back (left, as drawn facing right) carries an open
  // furnace hatch, bright and soft; his front half wears a heavy plate of cooled slag, dull and hard.
  softGlow(ctx, c - 22, 72, 18, `rgba(255,170,70,${0.8 * pulse})`);
  ctx.beginPath(); ctx.rect(c - 30, 64, 14, 16);
  shade(ctx, '#fff0b0', '#ff7a2a', 64, 80, 1.6);
  ctx.save(); ctx.strokeStyle = '#3a1a10'; ctx.lineWidth = 1.6;
  for (const x of [c - 25.5, c - 20.5]) { ctx.beginPath(); ctx.moveTo(x, 64); ctx.lineTo(x, 80); ctx.stroke(); }
  ctx.restore();
  // The front plate: a broad slab over the chest and front shoulder.
  ctx.beginPath();
  ctx.moveTo(c + 6, 48 + heave);
  ctx.lineTo(c + 33, 48 + heave);
  ctx.lineTo(c + 27, 96);
  ctx.lineTo(c + 8, 98);
  ctx.quadraticCurveTo(c + 2, 72, c + 6, 48 + heave);
  ctx.closePath();
  shade(ctx, melt ? '#7a4a38' : '#8a8a92', melt ? '#2a120c' : '#33323a', 48, 98, 1.8);
  ctx.save();
  ctx.strokeStyle = 'rgba(230,235,245,0.55)'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(c + 8, 50 + heave); ctx.lineTo(c + 31, 50 + heave); ctx.stroke();
  ctx.fillStyle = 'rgba(200,205,215,0.7)';
  for (const [x, y] of [[c + 12, 56], [c + 27, 56], [c + 12, 90], [c + 24, 90]]) { ctx.beginPath(); ctx.arc(x, y + (y < 60 ? heave : 0), 1.3, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  if (melt) {
    // Meltdown: the plate splits and glows through, so front and back no longer matter.
    cracks(ctx, [[[c + 20, 48 + heave], [c + 16, 60], [c + 22, 70], [c + 14, 82], [c + 19, 97]], [[c + 16, 60], [c + 28, 64]], [[c + 22, 70], [c + 9, 74]], [[c + 14, 82], [c + 25, 88]]], `rgba(255,220,120,${pulse})`, 2.2);
    softGlow(ctx, c + 18, 72, 20, `rgba(255,150,50,${0.55 * pulse})`);
  }
  // Two vents on the shoulders, each breathing a tongue of flame.
  for (const [x, lean] of [[c - 36, -0.25], [c + 36, 0.25]] as const) {
    const y = 32 + heave;
    ctx.beginPath(); ctx.rect(x - 4, y - 4, 8, 6);
    shade(ctx, '#4a3f3b', '#1a1514', y - 4, y + 2, 1.2);
    const h = 10 + 3 * pulse + (f % 2) * 2;
    flameTongue(ctx, x, y - 4, 3.6, x + Math.sin(lean) * h, y - 4 - h, '#fff0b0', '#ffb347', '#e0601f');
  }
  // Slag drips from the knuckles into pools on the floor.
  for (const x of [c - 47, c + 48]) {
    ctx.save();
    ctx.fillStyle = '#ffb347'; ctx.shadowColor = '#ff8a3d'; ctx.shadowBlur = 5;
    ell(ctx, x + 2, 114 + ((f * 2) % 6), 1.6, 2.4); ctx.fill();
    ctx.restore();
    ell(ctx, x + 2, 121, 9, 2.6);
    ctx.fillStyle = `rgba(255,140,50,${0.7 * pulse})`; ctx.fill();
  }
  // Cinders drifting up.
  for (const [x, y] of [[c - 52, 50], [c - 24, 20], [c + 50, 24], [c + 10, 6], [c + 56, 80]]) {
    const yy = y - f * 3;
    softGlow(ctx, x, yy, 4, 'rgba(255,190,100,0.85)');
    ctx.fillStyle = '#ffe2a0'; ell(ctx, x, yy, 1, 1); ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ the Drowned Foundry

/** Glass Warden: a golem of cracked furnace glass around a banked ember. */
function drawGlassWarden(ctx: Ctx, _s: number, f: number): void {
  const bob = [0, -1, 0, -1][f];
  const swing = [1.5, 0, -1.5, 0][f];
  const pane = (pts: [number, number][], top: string, bottom: string, y0: number, y1: number) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + bob) : ctx.moveTo(x, y + bob)));
    ctx.closePath();
    shade(ctx, top, bottom, y0 + bob, y1 + bob, 1.3);
  };
  ctx.fillStyle = '#1a2a33';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ell(ctx, 21 - swing, 49, 5, 3.5); ctx.fill(); ctx.stroke();
  ell(ctx, 35 + swing, 49, 5, 3.5); ctx.fill(); ctx.stroke();
  // Back arm.
  pane([[10, 24], [16, 22], [14, 40 - swing], [7, 38 - swing]], 'rgba(150,225,245,0.85)', 'rgba(40,90,110,0.9)', 22, 40);
  // Torso: faceted panes.
  pane([[16, 18], [28, 12], [40, 18], [42, 34], [34, 46], [22, 46], [14, 34]], 'rgba(170,235,250,0.92)', 'rgba(36,82,104,0.95)', 12, 46);
  // The ember core seen through the glass.
  softGlow(ctx, 28, 30 + bob, 11, 'rgba(255,150,60,0.9)');
  ell(ctx, 28, 30 + bob, 3.6, 4.2); ctx.fillStyle = '#fff1c0'; ctx.fill();
  // Facet lines and a crack.
  ctx.save();
  ctx.strokeStyle = 'rgba(230,250,255,0.55)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(28, 12 + bob); ctx.lineTo(28, 22 + bob); ctx.lineTo(16, 18 + bob);
  ctx.moveTo(28, 22 + bob); ctx.lineTo(40, 18 + bob);
  ctx.moveTo(14, 34 + bob); ctx.lineTo(22, 38 + bob); ctx.lineTo(34, 38 + bob); ctx.lineTo(42, 34 + bob);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.moveTo(19, 21 + bob); ctx.lineTo(22, 26 + bob); ctx.lineTo(20, 30 + bob); ctx.stroke();
  ctx.restore();
  // Head: a prism with one eye slit.
  pane([[23, 6], [33, 6], [35, 12], [28, 15], [21, 12]], 'rgba(200,245,255,0.95)', 'rgba(60,120,140,0.95)', 6, 15);
  eyes(ctx, [[30.5, 10 + bob]], 1.2, '#ffb347');
  // Front arm: a mirror shield.
  pane([[40, 22], [47, 24], [50, 40 + swing], [42, 42 + swing]], 'rgba(220,250,255,0.95)', 'rgba(70,140,160,0.95)', 22, 42);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.moveTo(42, 25 + bob); ctx.lineTo(45, 26 + bob); ctx.lineTo(43, 34 + bob + swing); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** Ember Twins: masked flame spirits; the palette tells the pair apart. */
function twin(core: string, mid: string, outer: string, mask: string): FrameDraw {
  return (ctx, _s, f) => {
    const fl = [0, 1.2, 0.4, 1.6][f];
    const bob = [0, -1, -1.5, -0.5][f];
    softGlow(ctx, 20, 24 + bob, 16, outer);
    // Flame body: three licking tongues.
    ctx.save();
    const g = ctx.createLinearGradient(0, 6, 0, 36);
    g.addColorStop(0, core);
    g.addColorStop(0.45, mid);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(10, 32 + bob);
    ctx.quadraticCurveTo(7, 20, 13, 12 - fl);
    ctx.quadraticCurveTo(14, 18, 17, 17);
    ctx.quadraticCurveTo(18, 8, 21, 3 - fl * 1.5);
    ctx.quadraticCurveTo(23, 12, 26, 14);
    ctx.quadraticCurveTo(28, 10, 29, 9 - fl);
    ctx.quadraticCurveTo(34, 22, 30, 32 + bob);
    ctx.quadraticCurveTo(20, 37, 10, 32 + bob);
    ctx.fill();
    ctx.restore();
    // Iron mask.
    ell(ctx, 20.5, 21 + bob, 6.4, 7);
    shade(ctx, mask, '#1c1418', 14, 28, 1.2);
    ctx.fillStyle = '#0b0608';
    ell(ctx, 20.5, 25.5 + bob, 2.2, 1.2); ctx.fill();
    eyes(ctx, [[18, 20 + bob], [23, 20 + bob]], 1.1, core);
  };
}

/** Sluice Crawler: a brass-shelled crab that hauls foundry water. Faces right. */
function drawCrawler(ctx: Ctx, _s: number, f: number): void {
  const a = [0.45, 0.15, -0.45, -0.15][f];
  const bob = [0, -0.6, 0, -0.6][f];
  // Legs: three a side, alternating.
  for (let k = 0; k < 3; k++) {
    const x = 16 + k * 7;
    const ph = k % 2 ? a : -a;
    limb(ctx, x, 30 + bob, x - 6 + Math.sin(ph) * 4, 40, 1.8, '#5a3f22');
    limb(ctx, x + 2, 30 + bob, x + 6 + Math.sin(-ph) * 4, 41, 1.8, '#6a4a28');
  }
  // Claw.
  limb(ctx, 36, 27 + bob, 42, 22 + bob - a * 2, 2.6, '#7a5530');
  ctx.save();
  ctx.translate(43, 21 + bob - a * 2);
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.quadraticCurveTo(5, -5, 4, -1); ctx.lineTo(1, 0); ctx.quadraticCurveTo(5, 3, 2, 4); ctx.closePath();
  shade(ctx, '#d9a45c', '#6a4220', -5, 4, 1);
  ctx.restore();
  // Shell.
  ctx.beginPath();
  ctx.moveTo(9, 30 + bob);
  ctx.quadraticCurveTo(12, 14 + bob, 25, 14 + bob);
  ctx.quadraticCurveTo(38, 14 + bob, 40, 30 + bob);
  ctx.closePath();
  shade(ctx, '#e0b065', '#5c3a1c', 14, 30, 1.4);
  // Rivets and bands.
  ctx.save();
  ctx.strokeStyle = 'rgba(40,20,8,0.6)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(18, 16 + bob); ctx.quadraticCurveTo(15, 23, 15, 30 + bob); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(31, 16 + bob); ctx.quadraticCurveTo(34, 23, 34, 30 + bob); ctx.stroke();
  ctx.fillStyle = '#fff0c8';
  for (const [x, y] of [[13, 27], [24, 18], [36, 27]]) { ell(ctx, x, y + bob, 0.9, 0.9); ctx.fill(); }
  ctx.restore();
  // Valve on top, with a water tank window.
  limb(ctx, 25, 14 + bob, 25, 9 + bob, 2.2, '#4a3a30');
  ell(ctx, 25, 8.5 + bob, 4, 1.6); shade(ctx, '#d04a3a', '#6a1a12', 7, 10, 1);
  ell(ctx, 25, 24 + bob, 5, 3.4);
  const w = ctx.createLinearGradient(0, 21, 0, 27);
  w.addColorStop(0, '#9ff0ff'); w.addColorStop(1, '#1f6a80');
  ctx.fillStyle = w; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke();
  // Eye stalks.
  limb(ctx, 37, 20 + bob, 39, 15 + bob, 1.2, '#6a4a28');
  eyes(ctx, [[39.2, 14.5 + bob]], 1.2, '#7dfcff');
}

/** Maelra, the Drowned Bellows: a matron of kelp and iron, her body a giant bellows. */
function drawMaelra(ctx: Ctx, s: number, f: number): void {
  const pump = [0, 2, 4, 2][f]; // pleats compress and open
  const steam = [0.6, 0.85, 1, 0.8][f];
  const c = s / 2;
  // Anchor chain trailing behind.
  ctx.save();
  ctx.strokeStyle = '#3a3f44';
  ctx.lineWidth = 2.4;
  for (let k = 0; k < 6; k++) { ell(ctx, 18 - k * 2.4, 98 + k * 3, 3, 2, 0.6); ctx.stroke(); }
  ctx.restore();
  // Bellows body: stacked leather pleats between iron boards.
  const top = 46 + pump * 0.5;
  const bottom = 104;
  const pleats = 5;
  ctx.beginPath();
  ctx.moveTo(c - 30, top); ctx.lineTo(c + 30, top); ctx.lineTo(c + 36, bottom); ctx.lineTo(c - 36, bottom); ctx.closePath();
  shade(ctx, '#24403c', '#0c1614', top, bottom, 1.6);
  for (let k = 0; k < pleats; k++) {
    const t = k / (pleats - 1);
    const y = top + (bottom - top) * t;
    const w = 34 + Math.sin(t * Math.PI) * (10 - pump);
    ell(ctx, c, y, w, 7 - pump * 0.4);
    shade(ctx, '#3d5c58', '#14211f', y - 7, y + 7, 1.6);
  }
  // Iron boards.
  ctx.beginPath(); ctx.rect(c - 36, bottom - 2, 72, 9); shade(ctx, '#5a5f66', '#22252a', bottom - 2, bottom + 7, 1.8);
  // Brass nozzle that breathes steam.
  ctx.beginPath();
  ctx.moveTo(c - 6, top + 4); ctx.lineTo(c + 6, top + 4); ctx.lineTo(c + 3, top + 22); ctx.lineTo(c - 3, top + 22); ctx.closePath();
  shade(ctx, '#ffd890', '#8a5a22', top + 4, top + 22, 1.4);
  softGlow(ctx, c, top + 26, 16, `rgba(200,240,255,${0.7 * steam})`);
  // Shoulders and arms of kelp-wrapped iron.
  limb(ctx, c - 30, 44, c - 46, 70 + pump, 9, '#2c3e3a');
  limb(ctx, c + 30, 44, c + 46, 70 + pump, 9, '#2c3e3a');
  for (const sx of [-1, 1]) {
    ell(ctx, c + sx * 47, 74 + pump, 7, 6);
    shade(ctx, '#7a8088', '#2a2d33', 68 + pump, 80 + pump, 1.4);
  }
  // Hooded head with kelp hair.
  ctx.beginPath();
  ctx.moveTo(c - 26, 50);
  ctx.quadraticCurveTo(c - 30, 14, c, 10);
  ctx.quadraticCurveTo(c + 30, 14, c + 26, 50);
  ctx.quadraticCurveTo(c, 42, c - 26, 50);
  ctx.closePath();
  shade(ctx, '#2f5550', '#0f1d1b', 10, 50, 2);
  ctx.save();
  ctx.strokeStyle = '#3f7a52';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  for (const [x, len, sw] of [[c - 22, 30, -3], [c - 16, 36, 2], [c + 16, 34, -2], [c + 22, 28, 3]] as [number, number, number][]) {
    ctx.beginPath();
    ctx.moveTo(x, 40);
    ctx.quadraticCurveTo(x + sw * 2, 40 + len / 2, x + sw, 40 + len);
    ctx.stroke();
  }
  ctx.restore();
  // Face: pale, drowned, with a riveted iron jaw.
  ell(ctx, c, 30, 13, 14);
  shade(ctx, '#b8d6cf', '#5d7f78', 16, 44, 1.6);
  ctx.beginPath(); ctx.rect(c - 9, 34, 18, 8); shade(ctx, '#6a7078', '#2a2e33', 34, 42, 1.2);
  ctx.fillStyle = '#e8eef0';
  for (const x of [c - 6, c, c + 6]) { ell(ctx, x, 38, 0.9, 0.9); ctx.fill(); }
  eyes(ctx, [[c - 5, 27], [c + 5, 27]], 2.2, '#5ff0ff');
  // Water dripping down the pleats.
  ctx.save();
  ctx.fillStyle = 'rgba(140,230,255,0.75)';
  for (const [x, y] of [[c - 20, 64], [c + 12, 72], [c - 4, 86], [c + 24, 90]]) {
    ctx.beginPath();
    ctx.moveTo(x, y + pump); ctx.quadraticCurveTo(x + 1.6, y + 3 + pump, x, y + 4 + pump); ctx.quadraticCurveTo(x - 1.6, y + 3 + pump, x, y + pump);
    ctx.fill();
  }
  ctx.restore();
}

/** Steam vent: an iron grate set in the floor, glowing and puffing. */
function drawVent(ctx: Ctx, s: number, f: number): void {
  const c = s / 2;
  const heat = [0.5, 0.75, 1, 0.7][f];
  ell(ctx, c, c, 26, 18);
  shade(ctx, '#4a4f55', '#1a1c20', c - 18, c + 18, 2);
  ell(ctx, c, c, 20, 13);
  const g = ctx.createRadialGradient(c, c, 1, c, c, 20);
  g.addColorStop(0, `rgba(255,${200 + 40 * heat},${150 + 80 * heat},1)`);
  g.addColorStop(0.5, `rgba(255,120,40,${0.8 * heat})`);
  g.addColorStop(1, '#2a0e08');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = '#22252a';
  ctx.lineWidth = 3;
  for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(c + k * 6, c - 14); ctx.lineTo(c + k * 6, c + 14); ctx.stroke(); }
  ctx.restore();
  for (const [x, y] of [[c - 22, c - 6], [c + 22, c - 6], [c - 14, c + 14], [c + 14, c + 14]]) {
    ell(ctx, x, y, 1.6, 1.4); ctx.fillStyle = '#9aa0a8'; ctx.fill();
  }
  softGlow(ctx, c, c - 6, 22, `rgba(230,245,255,${0.35 * heat})`);
}

/** Steam cloud puff for vents and Maelra's nozzle (white, tinted per use). */
function drawSteam(ctx: Ctx, s: number): void {
  for (const [x, y, r] of [[s * 0.5, s * 0.6, s * 0.3], [s * 0.32, s * 0.5, s * 0.22], [s * 0.68, s * 0.48, s * 0.24], [s * 0.5, s * 0.32, s * 0.24]]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.6, 'rgba(240,248,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }
}

/** Dark foundry water with caustic ripples; tiles seamlessly. */
function drawWater(ctx: Ctx, s: number): void {
  ctx.fillStyle = '#0a1d22';
  ctx.fillRect(0, 0, s, s);
  let seed = 23;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = rnd() * s;
    const y = rnd() * s;
    const w = 12 + rnd() * 30;
    const a = 0.08 + rnd() * 0.14;
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
      ctx.strokeStyle = `rgba(120,220,235,${a})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + ox - w / 2, y + oy);
      ctx.quadraticCurveTo(x + ox, y + oy - 3, x + ox + w / 2, y + oy);
      ctx.stroke();
    }
  }
}

// ------------------------------------------------------------------ build

// ------------------------------------------------------------------ the Glarewell
// A sunken observatory: pale gold light that burns, indigo shadow that hides
// you, and Shades living in that shadow. Light always falls from above (the
// great lens), so every Glarewell creature gets a warm gold rim on top and
// cool indigo below.

/** A thin gold rim light along the top of the current path. */
function rimLight(ctx: Ctx, y0: number, y1: number, color = 'rgba(255,226,150,0.85)', w = 1.2): void {
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,226,150,0)');
  ctx.strokeStyle = g;
  ctx.lineWidth = w * 2.4;
  ctx.stroke();
  ctx.restore();
}

/** The sun-eye sigil of the Glarewell's keepers: a ring, a pupil and six short rays. */
function sunEye(ctx: Ctx, x: number, y: number, r: number, color: string, w = 1.2): void {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.shadowColor = color; ctx.shadowBlur = r;
  ell(ctx, x, y, r, r * 0.62); ctx.stroke();
  ell(ctx, x, y, r * 0.3, r * 0.3); ctx.fill();
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k - 2.5) * 0.42;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 0.95); ctx.lineTo(x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 1.35); ctx.stroke();
  }
  ctx.restore();
}

/** A brass-ringed lens with a highlight. */
function lens(ctx: Ctx, x: number, y: number, r: number, ring = 1.6): void {
  softGlow(ctx, x, y, r * 1.9, 'rgba(255,232,160,0.7)');
  ell(ctx, x, y, r, r);
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#fffdf2'); g.addColorStop(0.55, '#fde6a4'); g.addColorStop(1, '#d9a64a');
  ctx.fillStyle = g; ctx.fill();
  ctx.save();
  ctx.lineWidth = ring + 1.4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = ring; ctx.strokeStyle = '#a8792e'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ell(ctx, x - r * 0.35, y - r * 0.38, r * 0.28, r * 0.16, -0.5); ctx.fill();
  ctx.restore();
}

/** Lensbearer: a hooded keeper in indigo robes, raising a brass lens on a staff. Faces right. */
function drawLensbearer(ctx: Ctx, _s: number, f: number): void {
  const bob = [0, -1, 0, -1][f];
  const step = [1, 0, -1, 0][f];
  ctx.fillStyle = '#141024';
  ell(ctx, 21 + step * 2, 50, 4.2, 2); ctx.fill();
  ell(ctx, 31 - step * 2, 50, 4.2, 2); ctx.fill();
  // Robe, flaring at the hem.
  ctx.beginPath();
  ctx.moveTo(26, 15 + bob);
  ctx.quadraticCurveTo(37, 22, 39, 49);
  ctx.quadraticCurveTo(33, 52, 26, 50.5);
  ctx.quadraticCurveTo(19, 52, 13, 49);
  ctx.quadraticCurveTo(15, 22, 26, 15 + bob);
  ctx.closePath();
  shade(ctx, '#4e4888', '#16122c', 15, 52);
  rimLight(ctx, 15 + bob, 30);
  // Gold-stitched hem and a centre seam.
  ctx.save();
  ctx.strokeStyle = 'rgba(232,188,96,0.85)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(14, 47.5); ctx.quadraticCurveTo(19, 50, 26, 49); ctx.quadraticCurveTo(33, 50, 38, 47.5); ctx.stroke();
  ctx.strokeStyle = 'rgba(20,14,40,0.6)';
  ctx.beginPath(); ctx.moveTo(27, 26 + bob); ctx.quadraticCurveTo(28, 38, 27, 49); ctx.stroke();
  ctx.restore();
  // Hood with a deep shadowed opening.
  ctx.beginPath();
  ctx.moveTo(19, 22 + bob); ctx.quadraticCurveTo(18, 9 + bob, 27, 8 + bob); ctx.quadraticCurveTo(35, 9 + bob, 34, 21 + bob); ctx.quadraticCurveTo(27, 24 + bob, 19, 22 + bob);
  ctx.closePath();
  shade(ctx, '#5a54a0', '#221c46', 8, 24);
  rimLight(ctx, 8 + bob, 16);
  ell(ctx, 28.5, 16.5 + bob, 4.2, 4.6); ctx.fillStyle = '#0a0816'; ctx.fill();
  eyes(ctx, [[28.5, 16.5 + bob], [31, 16.5 + bob]], 0.9, '#ffe9a8');
  // Staff and lens; the lens casts a few rays downward.
  limb(ctx, 35, 40 + bob, 44, 16 + bob, 2.2, '#b98b3c');
  limb(ctx, 34, 29 + bob, 38, 27 + bob, 3, '#3a3470');
  ctx.save();
  ctx.globalAlpha = 0.35; ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 1; ctx.lineCap = 'round';
  for (const [dx, dy] of [[-5, 12], [0, 14], [5, 12]]) { ctx.beginPath(); ctx.moveTo(45, 18 + bob); ctx.lineTo(45 + dx, 18 + bob + dy); ctx.stroke(); }
  ctx.restore();
  lens(ctx, 45, 11 + bob, 6.2);
}

/** Shade: a wisp of living shadow with a trailing tail and two cold eyes. Faces right. */
function drawShade(ctx: Ctx, _s: number, f: number): void {
  const w = [0, 1.2, 0, -1.2][f];
  softGlow(ctx, 19, 17, 17, 'rgba(60,40,140,0.5)');
  // Tail: three tapering streamers drifting behind (to the left).
  ctx.save();
  ctx.lineCap = 'round';
  for (const [y, a, ww] of [[16, 0.55, 5], [22, 0.45, 4], [27, 0.35, 3]] as [number, number, number][]) {
    ctx.strokeStyle = `rgba(30,22,70,${a})`; ctx.lineWidth = ww;
    ctx.beginPath(); ctx.moveTo(14, y); ctx.quadraticCurveTo(8, y + w * 2, 2, y - 2 + w); ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(20, 4);
  ctx.quadraticCurveTo(32, 7, 31, 19);
  ctx.quadraticCurveTo(30 + w, 27, 26 - w, 32);
  ctx.quadraticCurveTo(23, 27, 20, 31 + w);
  ctx.quadraticCurveTo(17, 27, 14 + w, 32);
  ctx.quadraticCurveTo(10, 25, 10, 19);
  ctx.quadraticCurveTo(9, 7, 20, 4);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 4, 0, 33);
  g.addColorStop(0, 'rgba(58,48,112,0.97)'); g.addColorStop(0.6, 'rgba(22,16,52,0.95)'); g.addColorStop(1, 'rgba(10,8,24,0.55)');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(138,156,255,0.55)'; ctx.stroke();
  eyes(ctx, [[21.5, 15], [26.5, 15]], 1.4, '#a8c8ff');
  ctx.save(); ctx.strokeStyle = 'rgba(168,200,255,0.5)'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(21, 21); ctx.quadraticCurveTo(24, 23, 27, 21); ctx.stroke(); ctx.restore();
}

/** Brandkeeper: a tall mantled keeper with the sun-eye sigil burning on its chest. Faces right. */
function drawBrandkeeper(ctx: Ctx, _s: number, f: number): void {
  const bob = [0, -1, 0, -1][f];
  const step = [1, 0, -1, 0][f];
  const pulse = [0, 1, 2, 1][f];
  ctx.fillStyle = '#16101e';
  ell(ctx, 21 + step * 2, 48, 3.8, 1.8); ctx.fill();
  ell(ctx, 30 - step * 2, 48, 3.8, 1.8); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(26, 12 + bob);
  ctx.quadraticCurveTo(37, 19, 37.5, 48);
  ctx.lineTo(14.5, 48);
  ctx.quadraticCurveTo(15, 19, 26, 12 + bob);
  ctx.closePath();
  shade(ctx, '#5e3c66', '#1c1020', 12, 48);
  rimLight(ctx, 12 + bob, 26);
  // Gold-edged mantle over the shoulders.
  ctx.beginPath();
  ctx.moveTo(16, 24 + bob); ctx.quadraticCurveTo(26, 15 + bob, 36, 24 + bob); ctx.lineTo(33, 28 + bob); ctx.quadraticCurveTo(26, 22 + bob, 19, 28 + bob); ctx.closePath();
  shade(ctx, '#7a4e3a', '#3a2018', 15, 28, 1);
  ctx.save(); ctx.strokeStyle = '#e8bc60'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(19, 28 + bob); ctx.quadraticCurveTo(26, 22 + bob, 33, 28 + bob); ctx.stroke(); ctx.restore();
  limb(ctx, 18, 25 + bob, 12, 37, 2.6, '#3e2640');
  limb(ctx, 34, 25 + bob, 41, 18 + bob, 2.6, '#3e2640');
  // Head: a smooth mask with a single slit.
  ell(ctx, 26, 11.5 + bob, 5.5, 6);
  shade(ctx, '#e8dcc0', '#8c7c62', 5.5, 17.5);
  ctx.fillStyle = '#1a1020';
  ctx.fillRect(25.5, 11 + bob, 6, 1.6);
  softGlow(ctx, 29, 11.8 + bob, 3, 'rgba(255,211,106,0.9)');
  // The brand: the sun-eye on the chest and a spark of it in the raised hand.
  softGlow(ctx, 26, 34 + bob, 10 + pulse, 'rgba(255,200,80,0.75)');
  softGlow(ctx, 42, 16 + bob, 6 + pulse, 'rgba(255,200,80,0.85)');
  sunEye(ctx, 26, 35 + bob, 3.6, '#ffe7a0', 1.1);
  ell(ctx, 42, 16 + bob, 1.8, 1.8); ctx.fillStyle = '#fff4c8'; ctx.fill();
}

/** Twin Lamp: a floating brass lantern, white-gold flame behind glass panes. Faces right. */
function drawTwinLamp(ctx: Ctx, _s: number, f: number): void {
  const hover = [0, -1, -1.5, -1][f];
  const fl = [0, 1, 0.5, 1.5][f];
  softGlow(ctx, 22, 21 + hover, 22, 'rgba(255,236,170,0.6)');
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ell(ctx, 22, 41, 7, 2); ctx.fill();
  // Ring and chain stub.
  ctx.save(); ctx.strokeStyle = '#8a6224'; ctx.lineWidth = 1.3;
  ell(ctx, 22, 4.5 + hover, 2.2, 2.2); ctx.stroke(); ctx.restore();
  limb(ctx, 22, 6.5 + hover, 22, 9 + hover, 1.2, '#8a6224');
  // Body: a hexagonal lantern, tapering down.
  ctx.beginPath();
  ctx.moveTo(14, 12 + hover); ctx.lineTo(30, 12 + hover); ctx.lineTo(28.5, 30 + hover); ctx.lineTo(15.5, 30 + hover);
  ctx.closePath();
  shade(ctx, '#e8c070', '#6e4a1a', 12, 30, 1.4);
  // Glass panes with the flame inside.
  ctx.beginPath(); ctx.rect(16.5, 14 + hover, 11, 14);
  const glass = ctx.createLinearGradient(0, 14 + hover, 0, 28 + hover);
  glass.addColorStop(0, '#fffbe8'); glass.addColorStop(1, '#ffe39a');
  ctx.fillStyle = glass; ctx.fill();
  ctx.save();
  ctx.shadowColor = '#ffb84a'; ctx.shadowBlur = 6;
  ctx.fillStyle = '#ffc24f';
  ctx.beginPath();
  ctx.moveTo(22, 15 + hover - fl); ctx.quadraticCurveTo(26.5, 22 + hover, 22, 27 + hover); ctx.quadraticCurveTo(17.5, 22 + hover, 22, 15 + hover - fl);
  ctx.fill();
  ctx.fillStyle = '#fffbe6';
  ctx.beginPath(); ctx.moveTo(22, 19 + hover - fl * 0.5); ctx.quadraticCurveTo(24, 23 + hover, 22, 26 + hover); ctx.quadraticCurveTo(20, 23 + hover, 22, 19 + hover - fl * 0.5); ctx.fill();
  ctx.restore();
  // Brass frame bars over the glass.
  ctx.save(); ctx.strokeStyle = '#8a6224'; ctx.lineWidth = 1.2;
  for (const x of [16.5, 22, 27.5]) { ctx.beginPath(); ctx.moveTo(x, 14 + hover); ctx.lineTo(x, 28 + hover); ctx.stroke(); }
  ctx.restore();
  ell(ctx, 22, 10 + hover, 7, 2.6);
  shade(ctx, '#d8ae5a', '#6a4618', 7.5, 12.5, 1);
  ell(ctx, 22, 31 + hover, 5.5, 2.2);
  shade(ctx, '#c49a4a', '#6a4618', 29, 33, 1);
  // A couple of motes drifting off the flame.
  ctx.fillStyle = 'rgba(255,240,190,0.9)';
  ell(ctx, 31 + fl, 8 - fl * 2 + hover, 0.9, 0.9); ctx.fill();
  ell(ctx, 13 - fl * 0.5, 15 - fl + hover, 0.7, 0.7); ctx.fill();
}

/** The Lensmother: a vast veiled figure whose face is one great lens, crowned by a halo of small lenses. Idles. */
function drawLensmother(ctx: Ctx, s: number, f: number): void {
  const c = s / 2;
  const breathe = [0, 1, 2, 1][f];
  softGlow(ctx, c, 36, 50 + breathe * 2, 'rgba(255,226,140,0.42)');
  // Halo: six small lenses on a thin brass ring behind the head.
  ctx.save(); ctx.strokeStyle = 'rgba(200,150,70,0.8)'; ctx.lineWidth = 1.6;
  ell(ctx, c, 26, 24, 20); ctx.stroke(); ctx.restore();
  for (let k = 0; k < 6; k++) {
    const a = Math.PI + (k / 5) * Math.PI;
    lens(ctx, c + Math.cos(a) * 24, 26 + Math.sin(a) * 20, 3 + (k % 2) * 0.6 + breathe * 0.15, 1.1);
  }
  // Outer veil.
  ctx.beginPath();
  ctx.moveTo(c, 24);
  ctx.quadraticCurveTo(c + 42, 38, c + 48, s - 8);
  ctx.quadraticCurveTo(c + 24, s - 3, c, s - 5);
  ctx.quadraticCurveTo(c - 24, s - 3, c - 48, s - 8);
  ctx.quadraticCurveTo(c - 42, 38, c, 24);
  ctx.closePath();
  shade(ctx, '#423c7c', '#100d22', 24, s - 4, 2);
  rimLight(ctx, 24, 60, 'rgba(255,226,150,0.7)', 1.6);
  // A scatter of star-chart points on the veil.
  ctx.save(); ctx.fillStyle = 'rgba(255,232,170,0.7)';
  for (const [x, y, r] of [[-30, 70, 1], [-22, 84, 0.8], [-36, 92, 1.1], [28, 74, 1], [36, 90, 0.8], [22, 96, 1.1], [-12, 100, 0.7], [12, 104, 0.9]] as [number, number, number][]) { ell(ctx, c + x, y, r, r); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,232,170,0.25)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(c - 30, 70); ctx.lineTo(c - 22, 84); ctx.lineTo(c - 36, 92); ctx.moveTo(c + 28, 74); ctx.lineTo(c + 36, 90); ctx.lineTo(c + 22, 96); ctx.stroke();
  ctx.restore();
  // Inner veil with a gold-stitched edge.
  ctx.beginPath();
  ctx.moveTo(c, 40);
  ctx.quadraticCurveTo(c + 24, 60, c + 26, s - 12);
  ctx.quadraticCurveTo(c, s - 7, c - 26, s - 12);
  ctx.quadraticCurveTo(c - 24, 60, c, 40);
  ctx.closePath();
  shade(ctx, '#5c5498', '#1c1838', 40, s - 8, 1.4);
  ctx.save(); ctx.strokeStyle = 'rgba(232,188,96,0.9)'; ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(c - 26, s - 12); ctx.quadraticCurveTo(c, s - 7, c + 26, s - 12); ctx.stroke(); ctx.restore();
  // Sleeved arms raised, each holding a lens.
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c + sx * 26, 50); ctx.quadraticCurveTo(c + sx * 40, 46, c + sx * 46, 32 - breathe); ctx.lineTo(c + sx * 50, 36 - breathe); ctx.quadraticCurveTo(c + sx * 44, 56, c + sx * 30, 60);
    ctx.closePath();
    shade(ctx, '#3a3470', '#16132c', 30, 60, 1.4);
    lens(ctx, c + sx * 48, 27 - breathe, 5);
  }
  // The face: one great lens with iris rings and a burning pupil.
  softGlow(ctx, c, 28, 24 + breathe, 'rgba(255,240,190,0.95)');
  lens(ctx, c, 28, 15, 3);
  ctx.save();
  ctx.strokeStyle = 'rgba(200,140,60,0.55)'; ctx.lineWidth = 1;
  ell(ctx, c + 1, 29, 9, 9); ctx.stroke();
  ell(ctx, c + 1.5, 29, 6.2, 6.2); ctx.stroke();
  ctx.fillStyle = '#ff9a3c'; ctx.shadowColor = '#ff7a1f'; ctx.shadowBlur = 8;
  ell(ctx, c + 2, 29, 4 + breathe * 0.4, 4 + breathe * 0.4); ctx.fill();
  ctx.fillStyle = '#fff4d8'; ctx.shadowBlur = 0;
  ell(ctx, c + 2, 29, 1.4, 1.4); ctx.fill();
  ctx.restore();
}

/** Observatory pillar from above: a fluted marble drum with a gold inlay ring. Frame 1 is cracked and chipped. */
function drawPillar(ctx: Ctx, s: number, f: number): void {
  const c = s / 2;
  const broken = f === 1;
  const R = c * 0.86;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ell(ctx, c + 2, c + 4, c * 0.9, c * 0.9); ctx.fill();
  // Fluted edge: a scalloped outline.
  const flutes = 16;
  ctx.beginPath();
  for (let k = 0; k <= flutes * 2; k++) {
    const a = (k / (flutes * 2)) * Math.PI * 2;
    let r = k % 2 ? R : R - 2.2;
    if (broken && a > 0.4 && a < 1.3) r -= 6 * Math.sin(((a - 0.4) / 0.9) * Math.PI);
    const x = c + Math.cos(a) * r;
    const y = c + Math.sin(a) * r;
    k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  shade(ctx, broken ? '#8a8494' : '#efe6d2', broken ? '#3c3846' : '#8c8270', 2, s - 2, 2);
  // Capital: an inner disc with a gold inlay ring and a sun-eye at the centre.
  ell(ctx, c, c, R * 0.66, R * 0.66);
  shade(ctx, broken ? '#9a94a2' : '#fbf6ea', broken ? '#4a4652' : '#b8ad96', 8, s - 8, 1);
  ctx.save();
  ctx.strokeStyle = broken ? 'rgba(120,100,70,0.6)' : 'rgba(214,170,80,0.85)';
  ctx.lineWidth = 1.4;
  ell(ctx, c, c, R * 0.5, R * 0.5); ctx.stroke();
  ctx.restore();
  if (!broken) sunEye(ctx, c, c, 4.2, 'rgba(200,150,60,0.9)', 1);
  if (broken) {
    cracks(ctx, [[[c - 16, c - 8], [c - 5, c], [c + 2, c - 12]], [[c + 5, c + 14], [c + 12, c + 2], [c + 18, c + 6]], [[c - 12, c + 16], [c, c + 3], [c + 15, c + 9]]], 'rgba(20,10,30,0.95)', 2);
    // Rubble spilled from the chipped side.
    ctx.fillStyle = '#6a6474';
    for (const [x, y, r] of [[c + 22, c + 20, 2.4], [c + 26, c + 14, 1.8], [c + 17, c + 25, 1.6]] as [number, number, number][]) { ell(ctx, x, y, r, r * 0.8); ctx.fill(); }
  } else {
    cracks(ctx, [[[c - 13, c - 7], [c - 6, c - 3]], [[c + 6, c + 11], [c + 10, c + 5]]], 'rgba(214,170,80,0.55)', 1);
  }
}

export function buildTextures(scene: Phaser.Scene): void {
  // Ground: dark basalt flagstones with faint ember seams. Tiles seamlessly and
  // stays low-contrast so creatures and telegraphs read on top of it.
  make(scene, 'ground', 384, (ctx, s) => {
    ctx.fillStyle = '#18100e';
    ctx.fillRect(0, 0, s, s);
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const wrap = (fn: (ox: number, oy: number) => void) => { for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) fn(ox, oy); };
    // Soft mottling.
    for (let i = 0; i < 160; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const r = 10 + rnd() * 30;
      const a = 0.025 + rnd() * 0.04;
      const light = rnd() < 0.5;
      wrap((ox, oy) => {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, light ? `rgba(70,48,40,${a * 2})` : `rgba(0,0,0,${a * 3})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      });
    }
    // Flagstone seams: a jittered grid of plates.
    const n = 5;
    const cell = s / n;
    const pts: [number, number][][] = [];
    for (let i = 0; i <= n; i++) {
      pts.push([]);
      for (let j = 0; j <= n; j++) pts[i].push([(rnd() - 0.5) * cell * 0.6, (rnd() - 0.5) * cell * 0.6]);
    }
    for (let i = 0; i <= n; i++) { pts[i][n] = pts[i][0]; pts[n][i] = pts[0][i]; }
    const P = (i: number, j: number): [number, number] => [i * cell + pts[i][j][0], j * cell + pts[i][j][1]];
    ctx.lineCap = 'round';
    // Some seams are skipped so stones merge into irregular slabs; each seam
    // bends at its midpoint so the grid never reads as a mesh.
    const seams: [number, number][][] = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const a = P(i, j);
      for (const b of [P(i + 1, j), P(i, j + 1)]) {
        if (rnd() < 0.22) continue;
        const m: [number, number] = [(a[0] + b[0]) / 2 + (rnd() - 0.5) * 14, (a[1] + b[1]) / 2 + (rnd() - 0.5) * 14];
        seams.push([a, m, b]);
      }
    }
    for (const [col, w, dy] of [['rgba(0,0,0,0.38)', 2.6, 0], ['rgba(110,78,62,0.10)', 1, 1.5]] as [string, number, number][]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      for (const l of seams) wrap((ox, oy) => {
        ctx.beginPath();
        l.forEach(([x, y], k) => (k ? ctx.lineTo(x + ox, y + oy + dy) : ctx.moveTo(x + ox, y + oy + dy)));
        ctx.stroke();
      });
    }
    // A few seams that still glow.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,110,40,0.28)';
    ctx.shadowColor = 'rgba(255,90,30,0.8)';
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.1;
    for (let k = 0; k < 3; k++) {
      const l = seams[Math.floor(rnd() * seams.length)];
      wrap((ox, oy) => {
        ctx.beginPath();
        l.forEach(([x, y], q) => (q ? ctx.lineTo(x + ox, y + oy) : ctx.moveTo(x + ox, y + oy)));
        ctx.stroke();
      });
    }
    ctx.restore();
    // Pebbles.
    for (let i = 0; i < 70; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(60,42,36,0.5)' : 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(x, y, 0.8 + rnd() * 1.4, 0, Math.PI * 2); ctx.fill();
    }
  });

  // Characters (sprite sheets, faced right).
  sheet(scene, 'player', 48, 4, drawPlayer);
  sheet(scene, 'duskblade', 48, 4, drawDuskblade);
  sheet(scene, 'lumen', 48, 4, drawLumen);
  sheet(scene, 'bulwark', 52, 4, drawBulwark);
  sheet(scene, 'slagbinder', 52, 4, drawSlagbinder);
  sheet(scene, 'slagbinderAnvil', 52, 4, (ctx, sz, f) => drawSlagbinder(ctx, sz, f, true));
  sheet(scene, 'ashling', 24, 4, drawAshling);
  sheet(scene, 'slagling', 26, 4, drawSlagling);
  sheet(scene, 'cinderhound', 36, 4, drawHound);
  sheet(scene, 'husk', 56, 4, drawWarden);
  sheet(scene, 'cinderBrute', 64, 4, drawBrute);
  sheet(scene, 'ashmaw', 60, 4, drawAshmaw);
  sheet(scene, 'kilnMother', 112, 4, drawKiln);
  sheet(scene, 'acolyte', 34, 4, drawAcolyte);

  // The Drowned Foundry.
  sheet(scene, 'glassWarden', 56, 4, drawGlassWarden);
  sheet(scene, 'emberTwin', 40, 4, twin('#fff2c0', '#ff8a3d', 'rgba(255,140,60,0.55)', '#5a4a48'));
  sheet(scene, 'emberTwinB', 40, 4, twin('#e8fbff', '#5fd0ff', 'rgba(90,200,255,0.5)', '#4a5058'));
  sheet(scene, 'sluiceCrawler', 48, 4, drawCrawler);
  sheet(scene, 'maelra', 120, 4, drawMaelra);
  sheet(scene, 'vent', 64, 4, drawVent);
  make(scene, 'steam', 48, drawSteam);
  make(scene, 'water', 128, drawWater);
  sheet(scene, 'gate', 80, 1, drawGate);
  sheet(scene, 'slagCrone', 128, 4, drawSlagCrone);
  sheet(scene, 'colossus', 128, 4, drawColossus);
  sheet(scene, 'colossusRaid', 192, 4, (ctx, sz, f) => drawColossusRaid(ctx, sz, f));
  sheet(scene, 'colossusMelt', 192, 4, (ctx, sz, f) => drawColossusRaid(ctx, sz, f, true));
  sheet(scene, 'regent', 128, 4, drawRegent);
  // The raid's Grandmother Slag in person (EnemyKind 'grandmotherSlag' maps to this key).
  sheet(scene, 'slagCroneRaid', 192, 4, drawSlagCroneRaid);
  sheet(scene, 'portal', 80, 1, drawPortal);

  // The Glarewell.
  sheet(scene, 'lensbearer', 54, 4, drawLensbearer);
  sheet(scene, 'shade', 36, 4, drawShade);
  sheet(scene, 'brandkeeper', 52, 4, drawBrandkeeper);
  sheet(scene, 'twinLamp', 44, 4, drawTwinLamp);
  sheet(scene, 'lensmother', 116, 4, drawLensmother);
  sheet(scene, 'pillar', 64, 2, drawPillar);

  // The Hammerdeep.
  sheet(scene, 'ondrel', 120, 4, drawOndrel);

  // The Ashvents.
  sheet(scene, 'ysmeret', 120, 4, drawYsmeret);

  // The Coldmarrow (drawn ahead of its sim; keys match design's EnemyKind ids).
  sheet(scene, 'rimehound', 36, 4, drawRimehound);
  sheet(scene, 'snuffer', 36, 4, drawSnuffer);
  sheet(scene, 'frostWarden', 56, 4, drawFrostWarden);
  sheet(scene, 'hoarfrostWeaver', 48, 4, drawHoarfrostWeaver);
  sheet(scene, 'nhevra', 120, 4, drawNhevra);

  // The Wrackline (keys match design's EnemyKind ids).
  sheet(scene, 'shoalLurker', 36, 4, drawShoalLurker);
  sheet(scene, 'bargeHauler', 56, 4, drawBargeHauler);
  sheet(scene, 'hessa', 120, 4, drawHessa);
  sheet(scene, 'oskel', 120, 4, drawOskel);
  // Raid 2, the Hoard.
  sheet(scene, 'coalmouth', 192, 4, drawCoalmouth);
  sheet(scene, 'craw', 56, 4, drawCraw);
  // The Wrackline's raft: a round deck of driftwood boards, gaps between them, nails, a wet edge
  // and a rope lashed round the rim. Drawn once; GameScene scales it to WRACK.raftR.
  make(scene, 'raft', 256, (ctx, s) => {
    const c = s / 2, r = s / 2 - 6;
    ctx.save();
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#2a1e14'; ctx.fillRect(0, 0, s, s);
    const boards = 7, bw = (r * 2) / boards;
    for (let k = 0; k < boards; k++) {
      const y = c - r + k * bw;
      const g = ctx.createLinearGradient(0, y, 0, y + bw);
      const tone = [0, 10, -8, 6, -4, 12, -10][k];
      g.addColorStop(0, `rgb(${196 + tone},${166 + tone},${124 + tone})`);
      g.addColorStop(1, `rgb(${142 + tone},${112 + tone},${78 + tone})`);
      ctx.fillStyle = g; ctx.fillRect(0, y + 2, s, bw - 4);
      // Grain: a few long, faint wavy lines per board.
      ctx.strokeStyle = 'rgba(90,64,40,0.35)'; ctx.lineWidth = 1.2;
      for (let j = 0; j < 3; j++) {
        const gy = y + 6 + j * (bw - 12) / 2;
        ctx.beginPath(); ctx.moveTo(0, gy);
        for (let x = 0; x <= s; x += 32) ctx.quadraticCurveTo(x + 16, gy + (((k + j + x / 32) % 2) ? 2.5 : -2.5), x + 32, gy);
        ctx.stroke();
      }
      // A knot, and nails at the cross-beams.
      ctx.fillStyle = 'rgba(80,56,34,0.6)';
      ctx.beginPath(); ctx.ellipse(40 + ((k * 53) % 170), y + bw / 2, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(40,36,34,0.9)';
      for (const x of [c - r * 0.55, c + r * 0.55]) { ctx.beginPath(); ctx.arc(x, y + bw / 2, 2.4, 0, Math.PI * 2); ctx.fill(); }
    }
    // Wet edge: the boards darken where the water laps them.
    const wet = ctx.createRadialGradient(c, c, r * 0.72, c, c, r);
    wet.addColorStop(0, 'rgba(20,40,44,0)'); wet.addColorStop(1, 'rgba(20,40,44,0.55)');
    ctx.fillStyle = wet; ctx.fillRect(0, 0, s, s);
    ctx.restore();
    // Rope round the rim: a dark core with twisted light strands.
    ctx.lineWidth = 9; ctx.strokeStyle = '#4a3a24';
    ctx.beginPath(); ctx.arc(c, c, r - 2, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = '#c8aa74'; ctx.lineCap = 'round';
    for (let k = 0; k < 64; k++) {
      const a = (k / 64) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(c, c, r - 2, a, a + 0.05); ctx.stroke();
    }
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(12,8,6,0.9)';
    ctx.beginPath(); ctx.arc(c, c, r + 2.5, 0, Math.PI * 2); ctx.stroke();
  });
  // The raft's warning rim: a white ring, tinted and pulsed while the Ebb is coming.
  make(scene, 'raftRim', 256, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, c * 0.8, c, c, c);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
  // The drain: a dark whirlpool with foam arms spiralling in. GameScene turns it, faster in the Ebb.
  make(scene, 'drain', 256, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(1,6,10,1)'); g.addColorStop(0.35, 'rgba(4,20,28,0.95)'); g.addColorStop(0.8, 'rgba(14,52,62,0.55)'); g.addColorStop(1, 'rgba(14,52,62,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    ctx.lineCap = 'round';
    for (let arm = 0; arm < 4; arm++) {
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? 'rgba(191,233,255,0.75)' : 'rgba(127,208,224,0.35)';
        ctx.lineWidth = pass ? 2.2 : 6;
        ctx.beginPath();
        for (let t = 0; t <= 1; t += 0.02) {
          const rr = c * (0.95 - 0.8 * t);
          const a = arm * (Math.PI / 2) + t * 4.2;
          const x = c + Math.cos(a) * rr, y = c + Math.sin(a) * rr;
          if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
  });

  // Hollow Rift: a violet tear with a swirling eye.
  sheet(scene, 'rift', 56, 1, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, '#f6e6ff');
    g.addColorStop(0.2, '#b06bff');
    g.addColorStop(0.55, 'rgba(70,20,120,0.8)');
    g.addColorStop(1, 'rgba(20,0,40,0)');
    ctx.fillStyle = g;
    ell(ctx, c, c, c * 0.95, c * 0.95);
    ctx.fill();
    ctx.save();
    ctx.strokeStyle = 'rgba(235,200,255,0.8)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      for (let t = 0; t <= 1.001; t += 0.05) {
        const a = k * (Math.PI / 2) + t * 2.6;
        const r = 4 + t * 20;
        const x = c + Math.cos(a) * r;
        const y = c + Math.sin(a) * r;
        if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  });

  // Soft contact shadow under every unit.
  make(scene, 'shadow', 32, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.6)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  // The Coldmarrow's Hearthcoal light: warm and bright at the coal, a long even falloff,
  // and still faintly lit at the very edge, so the light's reach reads on the frozen floor.
  make(scene, 'coalLight', 256, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,214,150,0.62)');
    g.addColorStop(0.18, 'rgba(255,170,90,0.42)');
    g.addColorStop(0.6, 'rgba(255,130,60,0.24)');
    g.addColorStop(0.94, 'rgba(255,110,45,0.13)');
    g.addColorStop(1, 'rgba(255,110,45,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  // P2 season glow under the hero: a soft disc with a brighter rim, white so it takes the glow's tint.
  make(scene, 'heroGlow', 128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.3)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.88, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  // Marked season glows (GLOW_MARK in icons.ts): the same disc with an inner second ring ('double'), and one
  // with a dark outline outside the rim ('edge'), drawn with normal blending so the dark shows on any floor.
  make(scene, 'heroGlowDouble', 128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.38, 'rgba(255,255,255,0.18)');
    g.addColorStop(0.48, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.58, 'rgba(255,255,255,0.15)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.88, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
  make(scene, 'heroGlowEdge', 128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.2)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.28)');
    g.addColorStop(0.72, 'rgba(255,255,255,0.8)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.83, 'rgba(24,10,6,0.9)');
    g.addColorStop(0.95, 'rgba(24,10,6,0.75)');
    g.addColorStop(1, 'rgba(24,10,6,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  // Season 3 glow marks (icons.ts GLOW_MARK). Facet: six crystal points stand on the ring, so Rime Blue reads apart
  // from Season 1's Tide Silver. The points are drawn tall because the scene squashes the glow to about a third
  // of its width under the hero.
  make(scene, 'heroGlowFacet', 128, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.16)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.22)');
    g.addColorStop(0.8, 'rgba(255,255,255,0.6)');
    g.addColorStop(0.88, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#ffffff';
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      const x = s / 2 + Math.cos(a) * s * 0.4;
      const y = s / 2 + Math.sin(a) * s * 0.36;
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x + 4.5, y);
      ctx.lineTo(x, y + 10);
      ctx.lineTo(x - 4.5, y);
      ctx.closePath();
      ctx.fill();
    }
  });
  // Crack: the ring breaks into glowing pieces with dark seams, like a coal, so Coal Glow reads apart from the
  // Deep Bellows' smooth Bellows Orange.
  make(scene, 'heroGlowCrack', 128, (ctx, s) => {
    // The seams are cut by clipping (the whole square minus thin wedges, even-odd), not by erasing, so no dark
    // pixels are left behind for the additive blend to show.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, s, s);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + 0.3;
      const p = (r: number, d: number) => [s / 2 + Math.cos(a + d) * s * r, s / 2 + Math.sin(a + d) * s * r] as const;
      const pts = [p(0.32, -0.035), p(0.46, 0.06), p(0.46, 0.13), p(0.32, 0.035)];
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
      ctx.closePath();
    }
    ctx.clip('evenodd');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.2)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.3)');
    g.addColorStop(0.78, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.9, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.restore();
  });

  // Fill with bots: the bot mark (icons.ts BOT_GLYPH) in white, tinted by the scene to the ally's class colour.
  make(scene, 'botMark', 48, (ctx, s) => {
    ctx.scale(s / 24, s / 24);
    const p = new Path2D(BOT_GLYPH);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 5;
    ctx.stroke(p);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.4;
    ctx.stroke(p);
  });

  // Season trail mote: a small white glow, so the trail's tint shows true (the orange spark would darken a blue trail).
  make(scene, 'trailMote', 16, (ctx, s) => glow(ctx, s, '#ffffff', 'rgba(255,255,255,0.55)', 0.4));

  // Season 3 trail crystal (Rime Dust): a six-armed frost star in white with a dark outline, tinted by the scene,
  // drawn normal-blended so it still shows on the Coldmarrow's pale frost.
  make(scene, 'frostFlake', 16, (ctx, s) => {
    const c = s / 2;
    const arms = (r: number) => {
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI) / 3;
        ctx.moveTo(c - Math.cos(a) * r, c - Math.sin(a) * r);
        ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      }
    };
    ctx.lineCap = 'round';
    arms(6.2);
    ctx.strokeStyle = 'rgba(8,16,32,0.85)';
    ctx.lineWidth = 3.4;
    ctx.stroke();
    arms(6);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  });

  // Oil Sheen (the Falling Press trail): a dark oil drop with a rainbow sheen round its rim and a glint. It is emitted
  // untinted and tinted toward the trail's green as it settles, so the sheen fades into an oil slick.
  make(scene, 'oilDrop', 16, (ctx, s) => {
    const c = s / 2;
    ctx.beginPath(); ctx.arc(c, c, 5.6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(10,20,10,0.88)'; ctx.fill();
    const sheen = ['#ff6ad5', '#ffd36a', '#8dff7a', '#6ae0ff', '#8a7aff', '#ff6ad5'];
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath(); ctx.arc(c, c, 4.6, (k * 2 * Math.PI) / 5, ((k + 1) * 2 * Math.PI) / 5);
      ctx.strokeStyle = sheen[k]; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(c - 1.8, c - 1.8, 1.1, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
  });

  // Raft Splinters (the Low Ebb trail): a wood sliver with a dark outline and one grain line, tinted the trail's brown.
  make(scene, 'woodChip', 16, (ctx, s) => {
    const c = s / 2;
    ctx.beginPath(); ctx.moveTo(c - 6, c + 1.2); ctx.lineTo(c - 4, c - 1.8); ctx.lineTo(c + 6, c - 1); ctx.lineTo(c + 4.5, c + 1.8); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(20,10,4,0.9)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(c - 3.5, c + 0.2); ctx.lineTo(c + 4, c - 0.2); ctx.strokeStyle = 'rgba(90,60,30,0.7)'; ctx.lineWidth = 0.8; ctx.stroke();
  });

  make(scene, 'aura', 128, (ctx, s) => glow(ctx, s, 'rgba(255,170,80,0.35)', 'rgba(255,90,30,0.10)', 0.02));

  // Ember Vein: a gatherable crystal cluster.
  sheet(scene, 'vein', 36, 1, (ctx, s) => {
    softGlow(ctx, s / 2, s - 8, 14, 'rgba(255,150,60,0.5)');
    const shard = (x: number, h: number, w: number, lean: number) => {
      ctx.beginPath();
      ctx.moveTo(x + lean, s - h);
      ctx.lineTo(x + w, s - 10);
      ctx.lineTo(x + w * 0.6, s - 4);
      ctx.lineTo(x - w * 0.6, s - 4);
      ctx.lineTo(x - w, s - 10);
      ctx.closePath();
      shade(ctx, '#fff1b8', '#a8381a', s - h, s - 4, 1.1);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(x + lean, s - h + 2); ctx.lineTo(x - w * 0.5, s - 10); ctx.lineTo(x - w * 0.15, s - 9); ctx.closePath();
      ctx.fill();
    };
    shard(s * 0.3, s * 0.5, 5, -2);
    shard(s * 0.7, s * 0.6, 5, 2);
    shard(s * 0.5, s * 0.88, 6.5, 0);
  });

  // Loot bag on the ground, white so it can be tinted by rarity.
  sheet(scene, 'loot', 24, 1, (ctx, s) => {
    const c = s / 2;
    ctx.beginPath();
    ctx.moveTo(c - 4, 6);
    ctx.quadraticCurveTo(c, 8.5, c + 4, 6);
    ctx.lineTo(c + 3, 9.5);
    ctx.quadraticCurveTo(s - 2, 13, c + 6, s - 2);
    ctx.lineTo(c - 6, s - 2);
    ctx.quadraticCurveTo(2, 13, c - 3, 9.5);
    ctx.closePath();
    shade(ctx, '#ffffff', '#9a9a9a', 6, s - 2, 1.3);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(c - 3.5, 9.5); ctx.lineTo(c + 3.5, 9.5); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ell(ctx, c - 2.5, 14, 1.6, 2.6, -0.4); ctx.fill();
  });

  make(scene, 'beam', 16, (ctx, s) => {
    const g = ctx.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  // Player effects (warm palette).
  make(scene, 'orb', 34, (ctx, s) => glow(ctx, s, '#ffd27a', 'rgba(255,110,30,0.6)'));
  // Fire bolt: a bright head with a tapering tail, pointing right.
  const bolt = scene.textures.createCanvas('bolt', 64, 24);
  if (bolt) {
    const ctx = bolt.getContext();
    const tail = ctx.createLinearGradient(0, 0, 52, 0);
    tail.addColorStop(0, 'rgba(255,80,20,0)');
    tail.addColorStop(0.6, 'rgba(255,130,40,0.55)');
    tail.addColorStop(1, 'rgba(255,220,130,0.95)');
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(2, 12); ctx.quadraticCurveTo(30, 5, 50, 5); ctx.lineTo(50, 19); ctx.quadraticCurveTo(30, 19, 2, 12);
    ctx.fill();
    const head = ctx.createRadialGradient(50, 12, 0, 50, 12, 12);
    head.addColorStop(0, '#ffffff');
    head.addColorStop(0.3, '#ffe39a');
    head.addColorStop(0.65, 'rgba(255,120,40,0.65)');
    head.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = head;
    ctx.fillRect(38, 0, 26, 24);
    bolt.refresh();
  }
  make(scene, 'ember', 32, (ctx, s) => glow(ctx, s, '#ffe3a1', 'rgba(255,120,40,0.7)', 0.2));
  make(scene, 'burn', 64, (ctx, s) => glow(ctx, s, 'rgba(255,150,60,0.55)', 'rgba(200,60,20,0.35)', 0.05));
  make(scene, 'blast', 64, (ctx, s) => glow(ctx, s, 'rgba(255,220,140,0.9)', 'rgba(255,100,30,0.5)', 0.1));
  make(scene, 'spark', 8, (ctx, s) => glow(ctx, s, '#ffcf70', 'rgba(255,100,30,0.6)', 0.3));
  // Impact star for hits.
  make(scene, 'hitstar', 32, (ctx, s) => {
    const c = s / 2;
    softGlow(ctx, c, c, c, 'rgba(255,220,150,0.8)');
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const r = k % 2 === 0 ? c * 0.95 : c * 0.2;
      ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });
  // Ash puff left behind by a kill (white, tinted per use).
  make(scene, 'puff', 48, (ctx, s) => {
    for (const [x, y, r] of [[24, 26, 14], [16, 22, 10], [32, 21, 11], [24, 16, 10]]) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
  });
  // Shockwave ring.
  make(scene, 'ring', 128, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, c * 0.62, c, c, c);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  // XP: cool teal so it never blends with fire. A faceted crystal.
  make(scene, 'gem', 14, (ctx, s) => {
    const c = s / 2;
    ctx.beginPath();
    ctx.moveTo(c, 0.8); ctx.lineTo(s - 2, c - 1); ctx.lineTo(c, s - 0.8); ctx.lineTo(2, c - 1); ctx.closePath();
    ctx.fillStyle = '#2bb59a';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(c, 0.8); ctx.lineTo(s - 2, c - 1); ctx.lineTo(c, c + 1); ctx.lineTo(2, c - 1); ctx.closePath();
    ctx.fillStyle = '#6ff5d6';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(c, 0.8); ctx.lineTo(c, c + 1); ctx.lineTo(2, c - 1); ctx.closePath();
    ctx.fillStyle = '#d8fff4';
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(0,40,30,0.8)';
    ctx.beginPath();
    ctx.moveTo(c, 0.8); ctx.lineTo(s - 2, c - 1); ctx.lineTo(c, s - 0.8); ctx.lineTo(2, c - 1); ctx.closePath();
    ctx.stroke();
  });
}
