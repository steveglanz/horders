/**
 * Original art, drawn in code. Nothing here is borrowed; every texture can be
 * swapped for painted art later by loading an image with the same key.
 *
 * Characters are drawn at SPRITE_RES times their world size so they stay crisp
 * when the camera zooms in on big screens, and each one is a short sprite sheet
 * (frames '0'..'n-1') for its walk or idle cycle. Soft glows stay at 1x.
 */
import Phaser from 'phaser';

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

/** Ashmaw the Glutton: a bloated, frost-ash beast that is mostly mouth. */
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

// ------------------------------------------------------------------ build

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
  sheet(scene, 'ashling', 24, 4, drawAshling);
  sheet(scene, 'cinderhound', 36, 4, drawHound);
  sheet(scene, 'husk', 56, 4, drawWarden);
  sheet(scene, 'cinderBrute', 64, 4, drawBrute);
  sheet(scene, 'ashmaw', 60, 4, drawAshmaw);
  sheet(scene, 'kilnMother', 112, 4, drawKiln);
  sheet(scene, 'acolyte', 34, 4, drawAcolyte);

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
