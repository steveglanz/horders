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
// you, and Shades living in that shadow.

/** Lensbearer: a hunched keeper in indigo robes, holding up a great brass lens. Faces right. */
function drawLensbearer(ctx: Ctx, _s: number, f: number): void {
  const bob = [0, -1, 0, -1][f];
  const step = [1, 0, -1, 0][f];
  ctx.fillStyle = '#1c1830';
  ell(ctx, 22 + step * 2, 50, 4, 2); ctx.fill();
  ell(ctx, 32 - step * 2, 50, 4, 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(27, 14 + bob);
  ctx.quadraticCurveTo(39, 24, 40, 50);
  ctx.quadraticCurveTo(27, 53, 14, 50);
  ctx.quadraticCurveTo(15, 24, 27, 14 + bob);
  ctx.closePath();
  shade(ctx, '#4a4478', '#1a1630', 14, 52);
  ell(ctx, 26, 15 + bob, 6, 6);
  shade(ctx, '#3c3866', '#16132a', 9, 21);
  eyes(ctx, [[27.5, 15.5 + bob], [30.5, 15.5 + bob]], 0.9, '#ffe9a8');
  // The lens: a brass ring on a pole, glass catching the light.
  limb(ctx, 36, 28 + bob, 44, 14 + bob, 2.4, '#b88a3a');
  softGlow(ctx, 45, 12 + bob, 11, 'rgba(255,230,150,0.75)');
  ell(ctx, 45, 12 + bob, 6.5, 6.5);
  shade(ctx, '#fff6d0', '#e0b85a', 6, 18, 1.6);
  ctx.save();
  ctx.strokeStyle = '#8a6224'; ctx.lineWidth = 1.6;
  ell(ctx, 45, 12 + bob, 6.5, 6.5); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ell(ctx, 43, 10 + bob, 1.6, 1); ctx.fill();
  ctx.restore();
}

/** Shade: a wisp of living shadow with two cold eyes. Faces right. */
function drawShade(ctx: Ctx, _s: number, f: number): void {
  const w = [0, 1, 0, -1][f];
  softGlow(ctx, 18, 18, 17, 'rgba(40,30,90,0.55)');
  ctx.beginPath();
  ctx.moveTo(18, 4);
  ctx.quadraticCurveTo(30, 8, 29, 20);
  ctx.quadraticCurveTo(28 + w, 28, 24 - w, 33);
  ctx.quadraticCurveTo(21, 28, 18, 32 + w);
  ctx.quadraticCurveTo(15, 28, 12 + w, 33);
  ctx.quadraticCurveTo(8, 26, 7, 20);
  ctx.quadraticCurveTo(6, 8, 18, 4);
  ctx.closePath();
  shade(ctx, '#2c2650', '#0a0818', 4, 33, 1.2);
  eyes(ctx, [[19, 15], [24, 15]], 1.3, '#a8c8ff');
}

/** Brandkeeper: a tall figure with a glowing gold sigil burned into its chest. Faces right. */
function drawBrandkeeper(ctx: Ctx, _s: number, f: number): void {
  const bob = [0, -1, 0, -1][f];
  const step = [1, 0, -1, 0][f];
  const pulse = [0, 1, 2, 1][f];
  ctx.fillStyle = '#1a1424';
  ell(ctx, 21 + step * 2, 48, 3.6, 1.8); ctx.fill();
  ell(ctx, 30 - step * 2, 48, 3.6, 1.8); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(26, 12 + bob);
  ctx.quadraticCurveTo(37, 20, 37, 48);
  ctx.lineTo(15, 48);
  ctx.quadraticCurveTo(15, 20, 26, 12 + bob);
  ctx.closePath();
  shade(ctx, '#5a3a5c', '#20121e', 12, 48);
  limb(ctx, 18, 24 + bob, 12, 36, 2.6, '#3e2640');
  limb(ctx, 34, 24 + bob, 41, 18 + bob, 2.6, '#3e2640');
  ell(ctx, 26, 12 + bob, 5.5, 5.8);
  shade(ctx, '#6a4668', '#241426', 6, 18);
  eyes(ctx, [[27.5, 12.5 + bob], [30.3, 12.5 + bob]], 0.85, '#ffd36a');
  // The brand: a gold ring with a cross, on the chest and in the raised hand.
  softGlow(ctx, 26, 30 + bob, 9 + pulse, 'rgba(255,200,80,0.8)');
  softGlow(ctx, 42, 16 + bob, 6 + pulse, 'rgba(255,200,80,0.8)');
  ctx.save();
  ctx.strokeStyle = '#ffe7a0'; ctx.lineWidth = 1.3;
  ell(ctx, 26, 30 + bob, 4, 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(26, 25.5 + bob); ctx.lineTo(26, 34.5 + bob); ctx.moveTo(21.5, 30 + bob); ctx.lineTo(30.5, 30 + bob); ctx.stroke();
  ctx.restore();
}

/** Twin Lamp: a floating brass lantern with a white-gold flame. Faces right. */
function drawTwinLamp(ctx: Ctx, _s: number, f: number): void {
  const hover = [0, -1, -1.5, -1][f];
  const fl = [0, 1, 0.5, 1.5][f];
  softGlow(ctx, 22, 20 + hover, 21, 'rgba(255,236,170,0.6)');
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ell(ctx, 22, 41, 7, 2); ctx.fill();
  limb(ctx, 22, 4 + hover, 22, 9 + hover, 1.2, '#8a6224');
  ctx.beginPath();
  ctx.moveTo(14, 11 + hover); ctx.lineTo(30, 11 + hover); ctx.lineTo(28, 31 + hover); ctx.lineTo(16, 31 + hover);
  ctx.closePath();
  shade(ctx, '#e8c070', '#7a5420', 11, 31, 1.4);
  ctx.beginPath();
  ctx.rect(17, 14 + hover, 10, 14);
  ctx.fillStyle = 'rgba(255,250,225,0.95)';
  ctx.fill();
  ctx.save();
  ctx.fillStyle = '#ffd36a';
  ctx.beginPath();
  ctx.moveTo(22, 15 + hover - fl); ctx.quadraticCurveTo(26, 22 + hover, 22, 27 + hover); ctx.quadraticCurveTo(18, 22 + hover, 22, 15 + hover - fl);
  ctx.fill();
  ctx.restore();
  ell(ctx, 22, 9 + hover, 6, 2.4);
  shade(ctx, '#c49a4a', '#6a4618', 7, 11, 1);
  ell(ctx, 22, 32 + hover, 5, 2);
  shade(ctx, '#c49a4a', '#6a4618', 30, 34, 1);
}

/** The Lensmother: a vast veiled figure whose face is one great lens. Idles. */
function drawLensmother(ctx: Ctx, s: number, f: number): void {
  const c = s / 2;
  const breathe = [0, 1, 2, 1][f];
  softGlow(ctx, c, 40, 46 + breathe * 2, 'rgba(255,226,140,0.45)');
  // Robes: layered indigo veils sweeping to the floor.
  ctx.beginPath();
  ctx.moveTo(c, 26);
  ctx.quadraticCurveTo(c + 40, 40, c + 46, s - 8);
  ctx.quadraticCurveTo(c, s - 2, c - 46, s - 8);
  ctx.quadraticCurveTo(c - 40, 40, c, 26);
  ctx.closePath();
  shade(ctx, '#3e3870', '#110e22', 26, s - 4, 2);
  ctx.beginPath();
  ctx.moveTo(c, 40);
  ctx.quadraticCurveTo(c + 24, 60, c + 26, s - 12);
  ctx.quadraticCurveTo(c, s - 8, c - 26, s - 12);
  ctx.quadraticCurveTo(c - 24, 60, c, 40);
  ctx.closePath();
  shade(ctx, '#57508e', '#1c1838', 40, s - 8, 1.4);
  // Arms raised, holding small lenses.
  limb(ctx, c - 30, 54, c - 46, 30 - breathe, 4, '#2c2852');
  limb(ctx, c + 30, 54, c + 46, 30 - breathe, 4, '#2c2852');
  for (const x of [c - 47, c + 47]) {
    softGlow(ctx, x, 27 - breathe, 9, 'rgba(255,230,150,0.9)');
    ell(ctx, x, 27 - breathe, 4.5, 4.5);
    shade(ctx, '#fff6d0', '#d8a848', 22, 32, 1.2);
  }
  // The face: one great lens in a brass ring, with a burning pupil.
  softGlow(ctx, c, 28, 22 + breathe, 'rgba(255,240,190,0.95)');
  ell(ctx, c, 28, 15, 15);
  shade(ctx, '#fffbe6', '#e8c070', 13, 43, 2.4);
  ctx.save();
  ctx.strokeStyle = '#8a6224'; ctx.lineWidth = 3;
  ell(ctx, c, 28, 15, 15); ctx.stroke();
  ctx.fillStyle = '#ff9a3c';
  ell(ctx, c + 2, 29, 4.2 + breathe * 0.4, 4.2 + breathe * 0.4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ell(ctx, c - 5, 22, 3.4, 2); ctx.fill();
  ctx.restore();
}

/** Observatory pillar: a cracked marble column seen from above, gold-veined. */
function drawPillar(ctx: Ctx, s: number, f: number): void {
  const c = s / 2;
  const broken = f === 1;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ell(ctx, c + 2, c + 4, c * 0.9, c * 0.9); ctx.fill();
  ell(ctx, c, c, c * 0.86, c * 0.86);
  shade(ctx, broken ? '#8a8494' : '#e4dccb', broken ? '#3c3846' : '#8a8070', 2, s - 2, 2);
  ell(ctx, c, c, c * 0.6, c * 0.6);
  shade(ctx, broken ? '#9a94a2' : '#f4eedf', broken ? '#4a4652' : '#b0a690', 8, s - 8, 1);
  ctx.save();
  ctx.strokeStyle = broken ? 'rgba(20,10,30,0.9)' : 'rgba(210,170,80,0.7)';
  ctx.lineWidth = broken ? 2 : 1.2;
  ctx.beginPath();
  ctx.moveTo(c - 14, c - 6); ctx.lineTo(c - 4, c); ctx.lineTo(c + 2, c - 10);
  ctx.moveTo(c + 4, c + 12); ctx.lineTo(c + 10, c + 2);
  if (broken) { ctx.moveTo(c - 10, c + 14); ctx.lineTo(c, c + 2); ctx.lineTo(c + 14, c + 8); }
  ctx.stroke();
  ctx.restore();
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
  sheet(scene, 'ashling', 24, 4, drawAshling);
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
  sheet(scene, 'portal', 80, 1, drawPortal);

  // The Glarewell.
  sheet(scene, 'lensbearer', 54, 4, drawLensbearer);
  sheet(scene, 'shade', 36, 4, drawShade);
  sheet(scene, 'brandkeeper', 52, 4, drawBrandkeeper);
  sheet(scene, 'twinLamp', 44, 4, drawTwinLamp);
  sheet(scene, 'lensmother', 116, 4, drawLensmother);
  sheet(scene, 'pillar', 64, 2, drawPillar);

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
