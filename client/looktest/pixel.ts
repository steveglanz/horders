// style: palette-only
/**
 * Look test, version B: the same Kiln room and the same 15-second fight as diorama.ts, in pixel art
 * (vision.md section 7 "Fallback": bigger pixel art at the new scale, same palette and signal rules).
 * Everything is drawn pixel by pixel in code at 195 x 422 art pixels (each art pixel is 2 CSS px on a
 * 390 x 844 phone): shapes with a 3-tone top light, a 1-pixel soot outline, a floor lit by the fire in
 * 4 dithered steps. No image files, no generators. window.lookTest.render(t) draws the frame at t.
 */
import { MASTER, ACCENTS, CLOTH, SIGNAL, SIGNAL_SHAPE, ANIM } from '../style';
import { ROOM, heroAt, foeAt, telegraphAt, shakeAt, rng, KILL_T, STAND, HITSTOP_SEC, easeOutBack, easeOutQuad } from './timeline';

const { soot, clay, iron, fire, hearth } = MASTER;
const KILN = ACCENTS.kiln;
const AW = 195, AH = 422;
const cv = document.createElement('canvas'); cv.width = AW; cv.height = AH;
cv.style.cssText = `width:${AW * 2}px;height:${AH * 2}px;image-rendering:pixelated;display:block`;
document.body.appendChild(cv);
const g = cv.getContext('2d')!;
g.imageSmoothingEnabled = false;

// Projection: a 3/4 view matched to the diorama's framing. World x,z on the floor, h is height.
const SX = 32, SZ = 28, SH = 19, CX = 97, CY = 238;
const proj = (x: number, z: number, h = 0) => [Math.round(CX + x * SX), Math.round(CY + z * SZ - h * SH)] as const;

const hexRGB = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

// ---------- the room as a per-pixel surface map (built once), lit each frame ----------
// Ramp from void to firelit clay; a surface stores a base index and lighting adds up to 3 steps.
const RAMP = [soot[0], soot[1], soot[2], soot[3], soot[4], clay[0], clay[1], clay[2], clay[3]].map(hexRGB);
const WALL_RAMP = [soot[1], soot[2], soot[3], soot[4], KILN[0], clay[2], clay[3]].map(hexRGB);
const base = new Int8Array(AW * AH).fill(-1);
const surf = new Uint8Array(AW * AH); // 0 void, 1 floor, 2 wall, 3 slab
const wx = new Float32Array(AW * AH), wz = new Float32Array(AW * AH);
const R = rng(7);
const hash = (a: number, b: number) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
{
  const floorTop = CY - ROOM.halfD * SZ, floorBot = CY + ROOM.halfD * SZ;
  const wallTop = floorTop - ROOM.wallH * SH;
  for (let py = 0; py < AH; py++) for (let px = 0; px < AW; px++) {
    const i = py * AW + px;
    const x = (px + 0.5 - CX) / SX;
    if (Math.abs(x) <= ROOM.halfW && py >= floorTop && py < floorBot) {
      const z = (py + 0.5 - CY) / SZ; wx[i] = x; wz[i] = z; surf[i] = 1;
      const row = Math.floor((z + ROOM.halfD) / 0.5); const bx = x + ROOM.halfW + (row % 2 ? 0.5 : 0);
      const col = Math.floor(bx / 1.0);
      const mortar = (z + ROOM.halfD) % 0.5 < 0.06 || bx % 1.0 < 0.05;
      const tone = hash(row, col);
      base[i] = mortar ? 0 : tone < 0.2 ? 1 : tone < 0.75 ? 2 : 3;
      // A highlight pixel on the top edge of each brick, a chip here and there.
      if (!mortar && (z + ROOM.halfD) % 0.5 < 0.1 && base[i] < 3) base[i]++;
      if (!mortar && hash(px, py) < 0.02) base[i] = Math.max(0, base[i] - 1);
    } else if (Math.abs(x) <= ROOM.halfW + 0.25 && py >= wallTop && py < floorTop) {
      const h = (floorTop - py - 0.5) / SH; wx[i] = x; wz[i] = -ROOM.halfD + 0.3; surf[i] = 2;
      const door = Math.abs(x - ROOM.door.x) < ROOM.door.w / 2 && h < ROOM.wallH * 5 / 7;
      if (door) { base[i] = -2; continue; }
      const course = Math.floor(h / (ROOM.wallH / 7)); const bx = x + 3 + (course % 2 ? 0.45 : 0);
      const mortar = h % (ROOM.wallH / 7) < 0.05 || bx % 0.9 < 0.05;
      base[i] = mortar ? 0 : hash(course, Math.floor(bx / 0.9)) < 0.25 ? 3 : 2;
      if (!mortar && h % (ROOM.wallH / 7) > ROOM.wallH / 7 - 0.07) base[i]++;
    } else if (Math.abs(x) > ROOM.halfW && Math.abs(x) <= ROOM.halfW + 0.3 && py >= floorTop - 0.9 * SH && py < floorBot - 0.9 * SH) {
      // Low side walls: the top of the wall, seen from above.
      const z = (py + 0.5 - CY + 0.9 * SH) / SZ; wx[i] = x; wz[i] = z; surf[i] = 2;
      const seg = Math.floor((z + ROOM.halfD) / 0.9); const mortar = (z + ROOM.halfD) % 0.9 < 0.06;
      base[i] = mortar ? 1 : hash(seg, x > 0 ? 1 : 0) < 0.3 ? 4 : 3;
    } else if (Math.abs(x) <= ROOM.halfW + 0.3 && py >= floorBot - 0.9 * SH && py < floorBot + 0.9 * SH && (py >= floorBot || Math.abs(x) > ROOM.halfW)) {
      wx[i] = x; wz[i] = ROOM.halfD; surf[i] = 3; base[i] = py < floorBot + 2 ? 2 : 1; // slab front: the diorama's thick base
    }
  }
}
// Ember cracks in the floor near the kiln (unlit fire pixels).
const cracks: [number, number, string][] = [];
for (let i = 0; i < 5; i++) {
  const len = 0.5 + R() * 0.9, ang = R() * Math.PI, x0 = -1.9 + R() * 1.6, z0 = -3.4 + R() * 2.2; const col = i % 2 ? fire[1] : fire[2];
  for (let s = 0; s < len; s += 0.04) { const [px, py] = proj(x0 + Math.cos(ang) * s, z0 + Math.sin(ang) * s * 0.9); cracks.push([px + (Math.round(s * 25) % 3 === 0 ? 1 : 0), py, col]); }
}

// ---------- sprites built from shapes, shaded and outlined ----------
type Grid = (string | null)[][];
const grid = (w: number, h: number): Grid => Array.from({ length: h }, () => Array(w).fill(null));
/** Filled ellipse with a 3-tone light from the upper left. */
function ell(gr: Grid, cx: number, cy: number, rx: number, ry: number, tones: readonly string[]) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry; if (nx * nx + ny * ny > 1 || !gr[y] || x < 0 || x >= gr[0].length) continue;
    const l = -(nx * 0.45 + ny * 0.85);
    gr[y][x] = tones[l > 0.35 ? 2 : l > -0.35 ? 1 : 0];
  }
}
/** Filled box: light top rows, dark right column and bottom row. */
function rect(gr: Grid, x0: number, y0: number, w: number, h: number, tones: readonly string[]) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (!gr[y] || x < 0 || x >= gr[0].length) continue;
    gr[y][x] = y < y0 + Math.max(1, Math.round(h * 0.2)) ? tones[2] : x >= x0 + w - Math.max(1, Math.round(w * 0.25)) || y === y0 + h - 1 ? tones[0] : tones[1];
  }
}
const dot = (gr: Grid, x: number, y: number, c: string) => { if (gr[y] && x >= 0 && x < gr[0].length) gr[y][x] = c; };
/** A 1-pixel soot outline round every filled shape (the pixel version of the diorama's dark outline). */
function outline(gr: Grid): Grid {
  const h = gr.length, w = gr[0].length; const o = grid(w + 2, h + 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y + 1][x + 1] = gr[y][x];
  const out = o.map((r) => r.slice());
  for (let y = 0; y < h + 2; y++) for (let x = 0; x < w + 2; x++) {
    if (o[y][x]) continue;
    if ((o[y - 1]?.[x]) || (o[y + 1]?.[x]) || o[y][x - 1] || o[y][x + 1]) out[y][x] = soot[1];
  }
  return out;
}
interface Sprite { c: HTMLCanvasElement; flash: HTMLCanvasElement; w: number; h: number }
function bake(gr: Grid): Sprite {
  const w = gr[0].length, h = gr.length; const mk = (flash: boolean) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d')!;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const v = gr[yy][xx]; if (v) { x.fillStyle = flash ? (v === soot[1] ? soot[1] : ANIM.hit.flashColor) : v; x.fillRect(xx, yy, 1, 1); } }
    return c;
  };
  return { c: mk(false), flash: mk(true), w, h };
}
const IRON = [iron[0], iron[1], iron[2]] as const, IRON_HI = [iron[1], iron[2], iron[3]] as const;
const CLOTH3 = [iron[0], CLOTH.bulwark, iron[2]] as const;
const BRASS = [soot[4], hearth[0], hearth[1]] as const;
const CLAY = [clay[0], clay[1], clay[2]] as const, CLAY_HI = [clay[1], clay[2], clay[3]] as const;

/** The Bulwark, seen from behind (the hero faces up the room for the whole clip), 26 x 38. */
const heroSprite = (() => {
  const s = grid(26, 38);
  rect(s, 8, 31, 4, 7, IRON); rect(s, 14, 31, 4, 7, IRON); // legs
  ell(s, 13, 23, 7, 9, IRON_HI); // torso
  rect(s, 7, 17, 12, 14, CLOTH3); // cape over the back
  for (let x = 7; x < 19; x++) dot(s, x, 30, iron[0]);
  rect(s, 7, 26, 12, 2, BRASS); // belt
  ell(s, 5, 17, 3.5, 3, IRON_HI); ell(s, 21, 17, 3.5, 3, IRON_HI); // pauldrons
  ell(s, 13, 10, 6, 6.5, IRON_HI); // helm
  for (let y = 9; y < 15; y++) dot(s, 13, y, iron[1]); // helm seam
  rect(s, 12, 1, 3, 6, BRASS); // brass crest
  return bake(outline(s));
})();
/** The door-sized shield on the hero's left arm, back face out, 10 x 25. */
const shieldSprite = (() => {
  const s = grid(10, 25);
  rect(s, 0, 0, 10, 25, IRON);
  for (let y = 0; y < 25; y++) { dot(s, 0, y, hearth[0]); dot(s, 9, y, hearth[0]); }
  for (let x = 0; x < 10; x++) { dot(s, x, 0, hearth[0]); dot(s, x, 24, hearth[0]); }
  rect(s, 3, 9, 4, 6, BRASS); // grip
  return bake(outline(s));
})();
/** The clay foe, front view, 34 x 44: hollow pot, open glowing maw, slit eyes, cracks. */
function foeSprite(eyes: string, crack: string): Sprite {
  const s = grid(34, 44);
  rect(s, 9, 37, 6, 7, CLAY); rect(s, 19, 37, 6, 7, CLAY); // feet
  ell(s, 17, 25, 13, 14, CLAY); // pot
  ell(s, 17, 12, 12, 4, CLAY_HI); // shoulder band
  ell(s, 17, 8, 9, 3.5, CLAY_HI); // rim
  ell(s, 17, 8, 6.5, 2, [fire[1], fire[2], fire[3]]); // maw glow
  // Slit eyes, slanted in (angry).
  for (let k = 0; k < 4; k++) { dot(s, 10 + k, 17 + (k >> 1), eyes); dot(s, 24 - k, 17 + (k >> 1), eyes); }
  for (let k = 0; k < 3; k++) { dot(s, 11 + k, 18 + (k >> 1), eyes); dot(s, 23 - k, 18 + (k >> 1), eyes); }
  // Cracks: zigzags down the body.
  const zig = (x: number, y: number, n: number, d: number) => { for (let k = 0; k < n; k++) dot(s, x + ((k >> 1) % 2 ? d : 0), y + k, crack); };
  zig(20, 22, 9, 1); zig(12, 26, 7, -1); zig(16, 31, 5, 1);
  return bake(outline(s));
}
const foeAwake = foeSprite(fire[4], fire[3]), foeAngry = foeSprite(fire[4], fire[4]), foeAsleep = foeSprite(fire[1], fire[2]);
const fistSprite = (() => { const s = grid(11, 11); ell(s, 5.5, 5.5, 5.2, 5, CLAY); return bake(outline(s)); })();
const kilnSprite = (() => {
  const s = grid(76, 56);
  ell(s, 38, 52, 37, 44, [soot[3], clay[0], clay[1]]); // dome (lower half is cut by the grid)
  for (let y = 46; y < 56; y++) for (let x = 0; x < 76; x++) if (s[y][x]) s[y][x] = y < 48 ? KILN[0] : soot[3];
  rect(s, 36, 0, 8, 10, [soot[3], soot[4], KILN[0]]); // chimney
  // Arched glowing mouth.
  for (let y = 30; y < 50; y++) for (let x = 24; x < 52; x++) { const nx = (x - 38) / 13, ny = (y - 50) / 19; if (nx * nx + ny * ny < 1) s[y][x] = nx * nx + ny * ny < 0.35 ? fire[4] : nx * nx + ny * ny < 0.7 ? fire[3] : fire[2]; }
  return bake(outline(s));
})();
const jarSprite = (tones: readonly string[]) => { const s = grid(12, 16); ell(s, 6, 10, 5.5, 5.5, tones); rect(s, 3, 1, 6, 4, tones); dot(s, 5, 1, soot[2]); dot(s, 6, 1, soot[2]); return bake(outline(s)); };
const jarA = jarSprite(CLAY), jarB = jarSprite(CLAY_HI);
const brazierSprite = (() => { const s = grid(14, 22); ell(s, 7, 9, 6.5, 3.5, IRON); rect(s, 6, 12, 2, 9, IRON); rect(s, 3, 20, 8, 2, IRON); return bake(outline(s)); })();

// ---------- per-frame drawing ----------
const img = g.createImageData(AW, AH);
function lightAt(x: number, z: number, hero: { x: number; z: number }, t: number) {
  const f = (dx: number, dz: number, r: number, I: number) => { const d = Math.hypot(dx, dz); return d >= r ? 0 : I * (1 - d / r) ** 1.4; };
  let L = 0.04;
  L += f(x + 1.15, z + 2.3, 4.4, 1.05 * (0.92 + 0.08 * Math.sin(t * 5.1) * Math.sin(t * 1.7 + 2)));
  L += f(x - 2.05, z - 0.6, 2.8, 0.55 * (0.9 + 0.1 * Math.sin(t * 7.3 + 1)));
  L += f(x - hero.x, z - hero.z, 3, 0.5);
  if (t >= STAND.on) L += f(x - STAND.x, z - STAND.z, 1.4, 0.3);
  return L;
}
function drawRoom(t: number, hero: { x: number; z: number }, ox: number, oy: number) {
  const d = img.data; d.fill(0);
  const [vr, vg, vb] = RAMP[0];
  for (let py = 0; py < AH; py++) for (let px = 0; px < AW; px++) {
    const sx = px - ox, sy = py - oy; const o = (py * AW + px) * 4;
    let c = RAMP[0];
    if (sx >= 0 && sx < AW && sy >= 0 && sy < AH) {
      const i = sy * AW + sx; const b = base[i];
      if (b === -2) c = RAMP[0];
      else if (b >= 0) {
        const L = surf[i] === 3 ? 0.15 : lightAt(wx[i], wz[i], hero, t);
        const lvl = Math.max(0, Math.min(5, Math.floor(L * 5 + bayer(sx, sy) - 0.5)));
        const ramp = surf[i] === 2 ? WALL_RAMP : RAMP; c = ramp[Math.min(ramp.length - 1, b + lvl)];
      }
    }
    d[o] = c[0] ?? vr; d[o + 1] = c[1] ?? vg; d[o + 2] = c[2] ?? vb; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
const put = (sp: Sprite, x: number, y: number, flash = false, sx = 1, sy = 1) => {
  const w = Math.round(sp.w * sx), h = Math.round(sp.h * sy);
  g.drawImage(flash ? sp.flash : sp.c, Math.round(x - w / 2), Math.round(y - h), w, h);
};
const px1 = (x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
/** An ellipse ring on the floor (world radius r), 1-2 px thick. */
function floorRing(x: number, z: number, r: number, c: string, thick = 1, gaps?: (a: number) => boolean) {
  const n = Math.ceil(r * 160);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2; if (gaps && gaps(a)) continue;
    for (let w = 0; w < thick; w++) { const rr = r - w / SX; const [qx, qy] = proj(x + Math.cos(a) * rr, z + Math.sin(a) * rr); px1(qx, qy, c); }
  }
}
function blob(x: number, z: number, r: number) {
  const [cx, cy] = proj(x, z); const rx = r * SX, ry = r * SZ;
  g.fillStyle = soot[0];
  for (let y = -ry; y <= ry; y++) for (let xx = -rx; xx <= rx; xx++) if ((xx / rx) ** 2 + (y / ry) ** 2 <= 1 && bayer(cx + xx, cy + y) < 0.45) g.fillRect(Math.round(cx + xx), Math.round(cy + y), 1, 1);
}
/** Danger zone: dithered fill with a solid serrated edge whose teeth crawl (SIGNAL_SHAPE.jagged). */
function danger(x: number, z: number, r: number, k: number, t: number) {
  const J = SIGNAL_SHAPE.jagged; const teeth = Math.max(8, Math.round(J.teethPerUnit * Math.PI * 2 * r)); const crawl = t * J.crawlUnitsPerSec * J.teethPerUnit;
  const [cx, cy] = proj(x, z); g.fillStyle = SIGNAL.danger.color;
  const R0 = r + J.toothDepth;
  for (let py = Math.floor(cy - R0 * SZ) - 1; py <= cy + R0 * SZ + 1; py++) for (let qx = Math.floor(cx - R0 * SX) - 1; qx <= cx + R0 * SX + 1; qx++) {
    const dx = (qx + 0.5 - cx) / SX, dz = (py + 0.5 - cy) / SZ; const d = Math.hypot(dx, dz); const a = Math.atan2(dz, dx);
    const ph = (((a / (Math.PI * 2)) * teeth + crawl) % 1 + 1) % 1; const edge = r + J.toothDepth * (1 - Math.abs(ph * 2 - 1));
    if (d > edge) continue;
    const inEdge = d > edge - 0.09; const inGrow = d < r * k;
    if (inEdge || bayer(qx, py) < (inGrow ? 0.55 : J.fillOpacity)) g.fillRect(qx, py, 1, 1);
  }
}
function hammer(x: number, y: number, ang: number) {
  // Handle as a pixel line, head as a small block at its end.
  const len = 11; let ex = x, ey = y;
  for (let s = 0; s <= len; s++) { ex = x + Math.cos(ang) * s; ey = y + Math.sin(ang) * s; px1(ex, ey, clay[0]); }
  g.fillStyle = soot[1]; g.fillRect(Math.round(ex) - 3, Math.round(ey) - 3, 7, 7);
  g.fillStyle = iron[2]; g.fillRect(Math.round(ex) - 2, Math.round(ey) - 2, 5, 5);
  g.fillStyle = iron[3]; g.fillRect(Math.round(ex) - 2, Math.round(ey) - 2, 5, 1);
}

const EMB = Array.from({ length: 22 }, (_, i) => { const r = rng(100 + i); return { ph: r(), sp: 0.35 + r() * 0.3, dx: (r() - 0.5) * 1.4, dz: r() * 0.8, sw: r() * 6 }; });
const shR = rng(42);
const SHARDS = Array.from({ length: 9 }, (_, i) => { const ang = (i / 9) * Math.PI * 2 + shR() * 0.5, sp = 0.9 + shR() * 1.3; return { vx: Math.cos(ang) * sp, vz: Math.sin(ang) * sp * 0.8, vy: 2.6 + shR() * 2.4, y0: 0.5 + shR() * 1.2, size: 2 + (i % 3), col: [clay[1], clay[2], clay[0]][i % 3] }; });
const BURST = Array.from({ length: ANIM.die.emberBurst }, (_, i) => { const a = shR() * Math.PI * 2, sp = 1 + shR() * 2.2; return { vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 2 + shR() * 2.5, life: 0.6 + shR() * 0.5, col: i % 2 ? fire[3] : fire[4] }; });

function render(t: number) {
  const sh = shakeAt(t); const ox = sh ? Math.round(Math.sin(t * 91) * 2 * sh) : 0, oy = sh ? Math.round(Math.cos(t * 77) * 2 * sh) : 0;
  const hp = heroAt(t), fp = foeAt(t);
  drawRoom(t, hp, ox, oy);
  g.save(); g.translate(ox, oy);
  for (const [x, y, c] of cracks) px1(x, y, c);
  // Door lintel and jambs on the back wall.
  { const [dx, dy] = proj(ROOM.door.x, -ROOM.halfD, ROOM.wallH * 5 / 7); const w = ROOM.door.w * SX;
    g.fillStyle = soot[1]; g.fillRect(dx - w / 2 - 6, dy - 5, w + 12, 7); g.fillStyle = hearth[0]; g.fillRect(dx - w / 2 - 5, dy - 4, w + 10, 5); g.fillStyle = hearth[1]; g.fillRect(dx - w / 2 - 5, dy - 4, w + 10, 1);
    g.fillStyle = KILN[1]; g.fillRect(dx - w / 2 - 4, dy + 1, 4, ROOM.wallH * 5 / 7 * SH - 1); g.fillRect(dx + w / 2, dy + 1, 4, ROOM.wallH * 5 / 7 * SH - 1); }

  // Painter's order: everything sorted by depth (z).
  const items: [number, () => void][] = [];
  const k0 = proj(-1.4, -3.25); items.push([-3.25, () => put(kilnSprite, k0[0], k0[1] + 6)]);
  items.push([-2.0, () => { const [x, y] = proj(2.15, -2.0); put(jarA, x, y); }]);
  items.push([-1.35, () => { const [x, y] = proj(2.25, -1.35); put(jarB, x, y, false, 0.85, 0.85); }]);
  items.push([1.8, () => { const [x, y] = proj(-2.2, 1.8); put(jarA, x, y); }]);
  items.push([2.45, () => { const [x, y] = proj(-2.1, 2.45); put(jarB, x, y, false, 0.8, 0.8); }]);
  items.push([0.6, () => { const [x, y] = proj(2.15, 0.6); put(brazierSprite, x, y);
    const fl = Math.floor(t * 10) % 3; g.fillStyle = fire[3]; g.fillRect(x - 3, y - 26 + (fl === 1 ? 1 : 0), 7, 5); g.fillStyle = fire[4]; g.fillRect(x - 1, y - 28 - fl, 3, 5); px1(x + (fl - 1) * 2, y - 31, fire[3]); }]);
  // Floor signals first (under figures).
  const tg = telegraphAt(t); if (tg) danger(tg.x, tg.z, tg.r * (0.7 + 0.3 * easeOutBack(Math.min(1, tg.k * 6))), tg.k, t);
  if (t >= STAND.on) {
    const ap = Math.min(1, (t - STAND.on) / 0.35); const r = 0.62 * easeOutBack(ap);
    floorRing(STAND.x, STAND.z, Math.max(0.05, r), SIGNAL.stand.color, 2);
    const pk = ((t - STAND.on) / SIGNAL_SHAPE.chevronRing.pulseSec) % 1; const rr = (0.95 - 0.28 * easeOutQuad(pk)) * ap;
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; const [cx, cy] = proj(STAND.x + Math.cos(a) * rr, STAND.z + Math.sin(a) * rr);
      const ix = -Math.cos(a), iy = -Math.sin(a); // points at the centre
      for (let s = -3; s <= 3; s++) { const back = Math.abs(s) * 0.8; px1(cx + ix * (2 - back) - iy * s, cy + iy * (2 - back) * 0.9 + ix * s * 0.9, SIGNAL.stand.color); px1(cx + ix * (1 - back) - iy * s, cy + iy * (1 - back) * 0.9 + ix * s * 0.9, SIGNAL.stand.color); } }
  }
  // Foe.
  const fx = fp.x - Math.cos(fp.face) * fp.knock, fz = fp.z - Math.sin(fp.face) * fp.knock;
  if (fp.state !== 'dead') items.push([fz, () => {
    blob(fx, fz, 0.5); floorRing(fx, fz, 0.7, SIGNAL.danger.color, 1);
    const [x, y] = proj(fx, fz);
    let sx = 1, sy = 1, lift = 0, fistY = -20, fistX = 15, shakeX = 0;
    const ph = (t / ANIM.idle.bobPeriod) * Math.PI * 2 + 1.7;
    let spr = foeAwake;
    if (fp.state === 'sleep') { spr = foeAsleep; lift = -1; sy = 1 + Math.sin(ph * 0.6) * 0.02; }
    else if (fp.state === 'wake') { lift = Math.round(3 * Math.sin((fp.st / fp.dur) * Math.PI)); }
    else if (fp.state === 'idle') { lift = Math.round((Math.sin(ph) * 0.5 + 0.5) * 2); sy = 1 + Math.sin(ph) * 0.03; }
    else if (fp.state === 'windup') { const k = easeOutQuad(Math.min(1, fp.st / 0.35)); sx = 1 + 0.1 * k; sy = 1 - 0.1 * k; fistY = -20 - 22 * k; fistX = 15 - 3 * k; spr = foeAngry; shakeX = fp.st > 0.35 ? (Math.floor(t * 30) % 2 ? 1 : -1) : 0; }
    else if (fp.state === 'slam') { const k = fp.st / fp.dur; const hit = Math.min(1, fp.st / 0.06); fistY = -42 + 40 * hit + 18 * easeOutQuad(k) * (k > 0.3 ? 1 : 0); fistX = 12; sx = 1 + 0.08 * (1 - k); sy = 1 - 0.08 * (1 - k); spr = foeAngry; lift = -Math.round(2 * (1 - k)); }
    if (fp.hitT < ANIM.hit.recoverSec + 0.05) { const k = 1 - fp.hitT / (ANIM.hit.recoverSec + 0.05); sx *= 1 + 0.12 * k; sy *= 1 - 0.1 * k; }
    const flash = fp.hitT < ANIM.hit.flashSec[1];
    const bx = x + shakeX, by = y - lift;
    put(fistSprite, bx - fistX, by + fistY * sy + (fp.state === 'slam' ? 0 : 0) - (fp.state === 'windup' ? 0 : 0) + 0, flash);
    put(spr, bx, by, flash, sx, sy);
    put(fistSprite, bx + fistX, by + fistY * sy, flash);
  }]);
  // Hero.
  items.push([hp.z, () => {
    blob(hp.x, hp.z, 0.36); floorRing(hp.x, hp.z, 0.55, SIGNAL.ally.color, 2);
    const [x, y] = proj(hp.x, hp.z);
    let lift = 0, sx = 1, sy = 1, lean = 0, ham = -Math.PI / 2 + 0.6, hamDX = 9, hamDY = -20;
    const ph = (t / ANIM.idle.bobPeriod) * Math.PI * 2;
    if (hp.state === 'idle') { lift = Math.round((Math.sin(ph) * 0.5 + 0.5) * 2); sy = 1 + Math.sin(ph) * 0.015; }
    else if (hp.state === 'move') { const step = hp.st * ANIM.move.stepsPerSec; const f = step % 1; lift = Math.round(Math.sin(f * Math.PI) * 3); if (f > 0.85 || f < 0.08) { sx = 1.06; sy = 0.94; } lean = Math.round(Math.cos(hp.face) * 2); ham += Math.sin(step * Math.PI) * 0.3; }
    else if (hp.state === 'roll') {
      // Pixel dodge roll: the sprite tumbles in 90-degree steps, tucked small.
      const k = hp.st / hp.dur; const q = Math.floor(easeOutQuad(k) * 4) % 4; const tuck = 0.75;
      g.save(); g.translate(Math.round(x), Math.round(y - 14 - 5 * Math.sin(k * Math.PI))); g.rotate((q * Math.PI) / 2);
      g.drawImage(heroSprite.c, -Math.round(heroSprite.w * tuck / 2), -Math.round(heroSprite.h * tuck / 2), Math.round(heroSprite.w * tuck), Math.round(heroSprite.h * tuck)); g.restore();
      return;
    } else if (hp.state === 'swing') {
      const wind = 0.14, snap = 0.09;
      if (hp.st < wind) { const k = easeOutQuad(hp.st / wind); ham = -Math.PI / 2 + 0.6 - 1.6 * k; hamDY = -20 - 4 * k; sx = 1 + 0.06 * k; sy = 1 - 0.06 * k; }
      else if (hp.st < wind + snap) { const k = (hp.st - wind) / snap; ham = -Math.PI / 2 - 1.0 + 2.6 * k; lean = 0; lift = -1; }
      else { const k = easeOutBack(Math.min(1, (hp.st - wind - snap) / (hp.dur - wind - snap))); ham = -Math.PI / 2 + 1.6 - 1.0 * k; }
      // The hammer swings toward the foe: turn the swing to face it.
      const fa = hp.face + Math.PI / 2; ham += fa * 0.6;
    }
    const by = y - lift;
    // Hammer behind (raised) or in front.
    put(heroSprite, x + lean, by, false, sx, sy);
    put(shieldSprite, x - 11 + lean, by - 6, false, 1, sy);
    hammer(x + hamDX + lean, by + hamDY, ham);
  }]);
  items.sort((a, b) => a[0] - b[0]).forEach(([, f]) => f());

  // Shatter: shards fly and stay; embers burst (after a short hit-stop).
  if (t >= KILL_T) {
    const kt = Math.max(0, t - KILL_T - HITSTOP_SEC);
    for (const s of SHARDS) {
      const gv = 9.8; const tLand = (s.vy + Math.sqrt(s.vy * s.vy + 2 * gv * (s.y0 - 0.06))) / gv; const tt = Math.min(kt, tLand);
      const h = Math.max(0.06, s.y0 + s.vy * tt - 0.5 * gv * tt * tt);
      const [qx, qy] = proj(fx + s.vx * tt, fz + s.vz * tt, h);
      g.fillStyle = soot[1]; g.fillRect(qx - 1, qy - 1, s.size + 2, s.size + 1);
      g.fillStyle = s.col; g.fillRect(qx, qy - 1, s.size, s.size);
      px1(qx, qy - 1, clay[3]);
    }
    for (const e of BURST) {
      const k = kt / e.life; if (k >= 1) continue;
      const [qx, qy] = proj(fx + e.vx * kt, fz + e.vz * kt, 1.0 + e.vy * kt - 2.5 * kt * kt);
      g.fillStyle = e.col; const sz = k < 0.5 ? 2 : 1; g.fillRect(qx, qy, sz, sz);
    }
  }
  // Slam dust.
  for (const [i, sl] of [[0, 4.55], [1, 8.6]] as const) {
    const dt = t - sl; if (dt < 0 || dt >= 0.5) continue; const s = tgSlam[i];
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; const rr = s.r * (0.5 + 0.7 * easeOutQuad(dt / 0.5)); const [qx, qy] = proj(s.x + Math.cos(a) * rr, s.z + Math.sin(a) * rr, 0.3 * Math.sin((dt / 0.5) * Math.PI)); const sz = dt < 0.25 ? 3 : 2; g.fillStyle = soot[4]; g.fillRect(qx - 1, qy - 1, sz, sz); }
  }
  // Rising embers from the kiln.
  for (const s of EMB) { const k = (t * s.sp * 0.25 + s.ph) % 1; const [qx, qy] = proj(-1.2 + s.dx * (0.3 + k) + Math.sin(t * 1.3 + s.sw) * 0.15, -2.3 + s.dz * k, 0.4 + k * 3.2); px1(qx, qy, k < 0.5 ? fire[4] : fire[3]); }
  g.restore();
}
const tgSlam = [{ x: 0.05, z: 0.55, r: 1.25 }, { x: 1.0, z: -0.95, r: 1.25 }];

(window as unknown as { lookTest: unknown }).lookTest = { render, ready: true };
render(0);
