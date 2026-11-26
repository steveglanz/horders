// @ts-nocheck
/**
 * HD-2D look test (?hd2d=1): the pixel heroes and the Furnace Regent, drawn into canvases at load.
 * Ported from the Claude Design handoff "Horders UI Design System 1" (09) and the visuals team's v2 of it
 * (/mnt/project-files/horders/visuals/design-system-1/hd2d2.js). Each frame has a colour canvas (m) and a
 * glow mask (e) that becomes the emissive map, so the eyes, flames and runes bloom.
 * Kept as the handoff's untyped drawing code on purpose: it is art data, and the spike may be thrown away.
 */
/* ---------- pixel sprite authoring ---------- */
const OUT = [26, 13, 10];
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
class Pix {
  constructor(w, h, ox, oy, s = 1) {
    this.w = w; this.h = h; this.ox = ox; this.oy = oy; this.s = s;
    this.m = mk(w, h); this.em = mk(w, h);
    this.cs = [this.m.getContext('2d'), this.em.getContext('2d')];
    this.cs.forEach(c => { c.translate(ox, oy); c.scale(s, s); });
  }
  _d(f, col, g) { const [m, e] = this.cs; m.fillStyle = m.strokeStyle = col; f(m); e.fillStyle = e.strokeStyle = g ? col : '#000'; f(e); }
  r(x, y, w, h, c, g) { this._d(k => k.fillRect(x, y, w, h), c, g); }
  e(x, y, rx, ry, c, g) { this._d(k => { k.beginPath(); k.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); k.fill(); }, c, g); }
  p(pts, c, g) { this._d(k => { k.beginPath(); pts.forEach((q, i) => i ? k.lineTo(q[0], q[1]) : k.moveTo(q[0], q[1])); k.closePath(); k.fill(); }, c, g); }
  l(x1, y1, x2, y2, w, c, g) { this._d(k => { k.lineWidth = w; k.lineCap = 'round'; k.beginPath(); k.moveTo(x1, y1); k.lineTo(x2, y2); k.stroke(); }, c, g); }
  o(x, y, rx, ry, w, c, g) { this._d(k => { k.lineWidth = w; k.beginPath(); k.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); k.stroke(); }, c, g); }
  t(x, y, a, f) { this.cs.forEach(c => { c.save(); c.translate(x, y); c.rotate(a); }); f(); this.cs.forEach(c => c.restore()); }
}
function finalize(P) {
  const { w, h } = P, [mc, ec] = P.cs;
  mc.setTransform(1, 0, 0, 1, 0, 0); ec.setTransform(1, 0, 0, 1, 0, 0);
  const md = mc.getImageData(0, 0, w, h), ed = ec.getImageData(0, 0, w, h), M = md.data, E = ed.data;
  const op = new Uint8Array(w * h), em = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    op[i] = M[i * 4 + 3] > 110 ? 1 : 0;
    em[i] = op[i] && E[i * 4 + 3] > 110 && (E[i * 4] + E[i * 4 + 1] + E[i * 4 + 2]) > 60 ? 1 : 0;
  }
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : op[y * w + x];
  const S = new Uint8ClampedArray(M.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, k = i * 4;
    if (op[i]) {
      for (let c = 0; c < 3; c++) S[k + c] = M[k + c];
      S[k + 3] = 255;
      if (!em[i]) {
        if (!at(x - 1, y) || !at(x, y - 1)) for (let c = 0; c < 3; c++) S[k + c] = M[k + c] + (255 - M[k + c]) * 0.24;
        else if (!at(x + 1, y) || !at(x, y + 1)) for (let c = 0; c < 3; c++) S[k + c] = M[k + c] * 0.7;
      }
    } else {
      let n = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && op[yy * w + xx] && !em[yy * w + xx]) n = true;
      }
      if (n) { S[k] = OUT[0]; S[k + 1] = OUT[1]; S[k + 2] = OUT[2]; S[k + 3] = 255; }
    }
  }
  md.data.set(S); mc.putImageData(md, 0, 0);
  for (let i = 0; i < w * h; i++) { const k = i * 4; if (!em[i]) { E[k] = E[k + 1] = E[k + 2] = 0; } E[k + 3] = 255; }
  ec.putImageData(ed, 0, 0);
  return { m: P.m, e: P.em, w, h, ox: P.ox, oy: P.oy, s: P.s };
}
let HIT_GLOW = 0.4;
function hitOf(f, fx, fy) {
  const m = mk(f.w, f.h), e = mk(f.w, f.h);
  const k = m.getContext('2d'); k.imageSmoothingEnabled = false;
  k.translate(fx - 2, fy); k.rotate(-0.14); k.translate(-fx, -fy); k.drawImage(f.m, 0, 0);
  k.setTransform(1, 0, 0, 1, 0, 0); k.globalCompositeOperation = 'source-atop';
  k.fillStyle = 'rgba(255,246,236,.55)'; k.fillRect(0, 0, f.w, f.h);
  // v2: the hit flash glows at 0.12, not 0.4: at 0.4 the bloom turned a hit Bulwark into a white blot under its name.
  const ke = e.getContext('2d'); ke.fillStyle = '#000'; ke.fillRect(0, 0, f.w, f.h); ke.globalAlpha = HIT_GLOW; ke.drawImage(m, 0, 0);
  return { ...f, m, e };
}
function fx(f, draw) {
  [f.m, f.e].forEach(c => { const k = c.getContext('2d'); k.save(); k.translate(f.ox, f.oy); k.scale(f.s, f.s); draw(k); k.restore(); });
}
function flame(P, x, y, s) {
  P.p([[x, y - 5 * s], [x + 3 * s, y], [x + 2 * s, y + 2.5 * s], [x - 2 * s, y + 2.5 * s], [x - 3 * s, y]], '#ff8a3d', 1);
  P.p([[x, y - 2 * s], [x + 1.2 * s, y + 0.6 * s], [x, y + 2 * s], [x - 1.2 * s, y + 0.6 * s]], '#ffe2a0', 1);
}

function bulwark(P, pose) {
  const atk = pose === 'atk';
  P.r(11, 31, 4, 8, '#5d6672'); P.r(17, 31, 4, 8, '#474f5a'); P.r(10, 37, 5, 3, '#2e2622'); P.r(17, 37, 5, 3, '#2e2622');
  P.r(8, 21, 16, 11, '#9aa4b1'); P.r(16, 21, 8, 11, '#6c7582');
  P.r(12, 22, 8, 10, '#a8322c'); P.r(16, 22, 4, 10, '#7d211e');
  P.p([[16, 23.5], [18, 26], [16, 28.5], [14, 26]], '#ff8a3d', 1);
  P.r(8, 29, 16, 2, '#5a3426'); P.r(15, 29, 2, 2, '#ffc861');
  P.e(8.5, 21.5, 4.5, 3.5, '#b3bcc8'); P.e(23.5, 21.5, 4.5, 3.5, '#7d8794');
  P.e(16, 10.5, 6, 3.5, '#b3bcc8'); P.r(10, 10, 12, 11, '#b3bcc8'); P.r(16, 9, 6, 12, '#848e9b');
  P.r(11, 14, 10, 2, '#ff8a3d', 1);
  P.r(15, 3, 2, 5, '#c42a2a'); P.p([[17, 3], [24, 5], [23, 8], [17, 7]], '#a8322c');
  if (!atk) {
    P.r(24, 8, 2, 19, '#d6dce4'); P.r(24, 8, 1, 19, '#f2f5f8'); P.r(22, 27, 6, 2, '#ffc861'); P.r(24, 29, 2, 3, '#5a3426');
    P.e(25, 30.5, 2, 2, '#9aa4b1');
  } else {
    P.t(25, 29, 0.85, () => { P.r(-1, -20, 2.4, 18, '#d6dce4'); P.r(-1, -20, 1, 18, '#f2f5f8'); P.r(-3.5, -2, 7, 2, '#ffc861'); });
    P.e(25, 30, 2, 2, '#9aa4b1');
  }
  const sx = atk ? 6 : 7.5, sy = atk ? 25 : 27, r = atk ? 7.8 : 7.2;
  P.e(sx, sy, r, r, '#8a94a1'); P.e(sx, sy, r - 2.3, r - 2.3, '#3a2621');
  P.p([[sx, sy - 4.2], [sx + 2.7, sy], [sx, sy + 4.2], [sx - 2.7, sy]], '#ff8a3d', 1);
  P.r(sx - 1, sy - 1, 2, 2, '#ffe2a0', 1);
}
function lumen(P, pose) {
  const atk = pose === 'atk';
  P.p([[9, 40], [11, 25], [16, 20], [21, 25], [23, 40]], '#efe4d2');
  P.p([[16, 20], [21, 25], [23, 40], [16, 40]], '#cbb99f');
  P.r(9, 37, 15, 2, '#ffc861'); P.r(15, 25, 2, 12, '#ffc861');
  P.e(10.5, 28, 2.8, 4, '#e4d7c2');
  P.e(16, 16, 6, 6.5, '#f6ecdd'); P.p([[16, 9.5], [21.5, 14], [22, 20], [16, 22.5]], '#d8c9b0');
  P.e(16, 17, 3.4, 4, '#f0c9a2'); P.r(14, 17, 1, 1.4, '#3a2018'); P.r(17, 17, 1, 1.4, '#3a2018');
  P.o(16, 6, 7, 2, 1.8, '#ffc861', 1);
  if (!atk) {
    P.l(21, 24, 24, 30, 3, '#e4d7c2'); P.r(23.5, 30, 1, 2, '#8a6524'); P.r(23, 31, 3, 1, '#8a6524');
    P.r(22, 32, 5, 6, '#c99a3e'); P.r(23, 33, 3, 4, '#fff1b8', 1); P.r(23, 38, 3, 1, '#8a6524');
  } else {
    P.l(21, 23, 25, 14, 3, '#e4d7c2'); P.r(23, 6, 5, 6, '#c99a3e'); P.r(24, 7, 3, 4, '#fff1b8', 1);
    P.r(24, 5, 3, 1, '#8a6524'); P.r(24, 12, 3, 1, '#8a6524');
  }
}
function emberwright(P, pose) {
  const atk = pose === 'atk';
  P.p([[9, 40], [11, 26], [21, 26], [23, 40]], '#6c3fa3'); P.p([[16, 26], [21, 26], [23, 40], [16, 40]], '#47287a');
  P.r(9, 37, 15, 2, '#ff8a3d'); P.r(11, 28, 10, 1, '#ffc861');
  P.p([[10, 27], [7, 32], [10, 33], [13, 29]], '#7d4bb8');
  P.p([[9, 26], [11, 15], [15, 8], [21, 1.5], [20, 10], [22, 17], [23, 26]], '#7d4bb8');
  P.p([[19.5, 6], [20, 10], [22, 17], [23, 26], [17, 26]], '#583090');
  P.e(16, 21, 4, 3.5, '#1a0d0a'); P.r(14, 20.5, 1, 1, '#ff8a3d', 1); P.r(17, 20.5, 1, 1, '#ff8a3d', 1);
  if (!atk) { P.l(21, 27, 25, 30, 3, '#7d4bb8'); flame(P, 26, 24, 1); }
  else {
    P.l(21, 27, 27, 25, 3, '#7d4bb8');
    P.p([[27, 21], [32, 19], [32, 27], [27, 25]], '#e8642a', 1);
    P.e(32, 23, 4, 4, '#ff8a3d', 1); P.e(32, 23, 2, 2, '#ffe2a0', 1);
  }
}
function duskblade(P, pose) {
  const atk = pose === 'atk';
  P.t(atk ? 2 : 0, 0, 0, () => {
    P.p([[12, 30], [8, 39], [11, 40], [15, 31]], '#3a2244'); P.p([[20, 30], [24, 39], [21, 40], [17, 31]], '#2a1833');
    P.r(7, 38, 5, 2, '#1f1424'); P.r(20, 38, 5, 2, '#1f1424');
    P.p([[11, 31], [11, 23], [13, 20], [19, 20], [21, 23], [21, 31]], '#5a2f6e');
    P.p([[16, 20], [19, 20], [21, 23], [21, 31], [16, 31]], '#3e1f4e');
    P.r(11, 28, 10, 1.5, '#2a1833'); P.r(15, 28, 2, 1.5, '#ffc861');
    P.p([[11, 20], [4, 22], [1, 28], [6, 25], [11, 23]], '#c42a4e'); P.r(11, 18.5, 10, 3, '#d93a5e');
    P.e(16, 13.5, 5.5, 6, '#4a2860'); P.p([[16, 7.5], [21.5, 13], [21, 19], [16, 19]], '#341a45');
    P.r(12, 12, 8, 3.5, '#1a0d0a'); P.r(13, 13, 6, 1.2, '#ff5fa2', 1);
    if (!atk) {
      P.l(11, 23, 8, 28, 2.5, '#5a2f6e'); P.l(21, 23, 24, 28, 2.5, '#3e1f4e');
      P.l(8, 29, 1, 35, 2, '#dfe4ea'); P.l(24, 29, 31, 35, 2, '#dfe4ea');
      P.r(7, 28, 2, 2, '#c42a4e'); P.r(23, 28, 2, 2, '#c42a4e');
    } else {
      P.l(11, 23, 20, 24, 2.5, '#5a2f6e'); P.l(21, 23, 24, 22, 2.5, '#3e1f4e');
      P.l(21, 25, 31, 16, 2, '#dfe4ea'); P.l(23, 19, 32, 28, 2, '#dfe4ea');
      P.r(20, 24, 2, 2, '#c42a4e'); P.r(23, 20, 2, 2, '#c42a4e');
    }
  });
}
// v2: the fifth class, missing from the handoff. Squat, in cooling slag plate with orange seams, a slag cannon at the hip (the gunner, 25 Nov).
function slagbinder(P, pose) {
  const atk = pose === 'atk';
  P.r(10, 33, 5, 6, '#3b302b'); P.r(17, 33, 5, 6, '#2b221e'); P.r(9, 37, 6, 3, '#1f1814'); P.r(17, 37, 6, 3, '#1f1814');
  P.e(16, 27, 9, 8, '#5a4a40'); P.p([[16, 19], [25, 25], [24, 34], [16, 35]], '#3f332c');
  P.l(10, 24, 13, 31, 1.2, '#ff7a1f', 1); P.l(21, 23, 19, 32, 1.2, '#ff7a1f', 1); P.r(12, 30, 9, 1.2, '#ffb35c', 1);
  P.r(9, 31, 14, 3, '#6b4a2e'); P.r(15, 31, 2, 3, '#c99a3e');
  P.e(8, 22, 4.5, 3.8, '#6a5a50'); P.e(24, 22, 4.5, 3.8, '#46392f');
  P.e(16, 14, 6.5, 6, '#6a5a50'); P.p([[16, 8], [22.5, 13], [22, 19], [16, 20]], '#4a3d34');
  P.r(11, 13, 10, 3, '#1a0d0a'); P.r(12, 14, 8, 1.2, '#ffb35c', 1);
  // The slag cannon, held level at the hip. The attack pose is the recoil: the barrel kicks up and back,
  // flame and slag blow out of the muzzle, and smoke puffs off the breech.
  const gx = atk ? 16 : 18, gy = atk ? 27 : 28;
  P.l(24, 23, gx + 1, gy, 2.4, '#6a5a50');
  P.t(gx, gy, atk ? -0.3 : 0, () => {
    P.e(-3, 0, 3.4, 3.6, '#2b221e');
    P.p([[-2, -3.2], [14, -2.8], [14, 2.8], [-2, 3.2]], '#3b302b');
    P.r(-1, -3, 15, 1.1, '#6a5a50');
    P.r(3, -3.4, 1.5, 6.8, '#c99a3e'); P.r(9.5, -3.2, 1.4, 6.4, '#8a7a6e');
    P.p([[14, -4], [17, -4.6], [17, 4.6], [14, 4]], '#4a3d34');
    P.e(17.1, 0, 0.9, 2.4, '#ff7a1f', 1);
    P.l(-4.5, -1, 1, -0.5, 0.9, '#ff7a1f', 1);
    P.e(0.5, 1.6, 2, 1.8, '#6a5a50');
    if (atk) {
      P.p([[17, -3.6], [23, 0], [17, 3.6]], '#ff8a3d', 1);
      P.e(18.5, 0, 2.4, 2.2, '#fff1c4', 1);
      P.e(-6.5, -3.5, 2, 1.8, '#8a7a6e'); P.e(-8, -6, 1.4, 1.3, '#6a5a50');
    }
  });
}
function regent(P) {
  P.p([[26, 35], [18, 65], [13, 93], [50, 98], [87, 93], [82, 65], [74, 35]], '#8f1f2e');
  P.p([[56, 36], [74, 35], [82, 65], [87, 93], [63, 96]], '#5e1420');
  P.l(22, 60, 19, 90, 1.2, '#5e1420'); P.l(30, 62, 28, 94, 1.2, '#5e1420');
  P.p([[13, 91], [50, 96], [87, 91], [87, 93.5], [50, 98.5], [13, 93.5]], '#ffc861');
  P.r(39, 80, 8, 15, '#3b3536'); P.r(53, 80, 8, 15, '#2b2627'); P.r(37, 92, 11, 4, '#1f1a1b'); P.r(52, 92, 11, 4, '#1f1a1b');
  P.p([[31, 33], [69, 33], [73, 84], [27, 84]], '#4a4344');
  P.p([[51, 33], [69, 33], [73, 84], [51, 85]], '#2e2829');
  P.r(29, 45, 42, 1.5, '#1f1a1b'); P.r(28, 74, 44, 1.5, '#1f1a1b');
  [[33, 41], [40, 41], [60, 41], [66, 41], [32, 78], [67, 78], [45, 78], [55, 78]].forEach(([x, y]) => P.r(x, y, 1.6, 1.6, '#8a8082'));
  P.r(35, 48, 30, 26, '#1f1a1b');
  P.r(37, 50, 26, 22, '#e8642a', 1); P.r(39, 52, 22, 18, '#ff8a3d', 1); P.r(42, 55, 16, 12, '#ffb35c', 1); P.r(45, 58, 10, 7, '#fff1c4', 1);
  [41, 47, 53, 58.5].forEach(x => P.r(x, 50, 2.4, 22, '#1f1a1b'));
  for (let i = 0; i < 5; i++) { P.r(33 - i * 0.6, 76 + i * 2.3, 1.6, 1.6, '#9a8f86'); P.r(66 + i * 0.6, 76 + i * 2.3, 1.6, 1.6, '#9a8f86'); }
  [[30, 89], [70, 89]].forEach(([x, y]) => { P.e(x, y, 5.5, 5.5, '#b3202f'); P.o(x, y, 3.2, 3.2, 1.2, '#7d1420'); P.p([[x, y - 2.5], [x + 1.6, y + 0.6], [x, y + 2], [x - 1.6, y + 0.6]], '#ffc861'); P.r(x - 3, y + 4, 1.6, 3, '#b3202f'); });
  P.l(24, 42, 22, 62, 6, '#433c3d'); P.e(22, 64, 4, 4, '#554c4e');
  P.l(81, 18, 76, 97, 3, '#3a2a22');
  P.l(76, 42, 78, 58, 6, '#2e2829'); P.e(78, 60, 4, 4, '#433c3d');
  P.p([[77, 19], [81, 15], [85, 19], [83, 22], [79, 22]], '#c99a3e');
  P.e(81, 12.5, 3.6, 3.6, '#ff8a3d', 1); P.r(80, 11.5, 2, 2, '#ffe2a0', 1);
  P.e(28, 37, 9, 7, '#5d5456'); P.e(72, 37, 9, 7, '#2e2829');
  P.p([[37, 15], [37, 10], [40, 4], [41.5, 9], [43.5, 7], [44.5, 2], [48, 0], [49, 6], [51.5, 4], [53.5, 1], [56, 5], [57, 8.5], [59, 6], [62.5, 10], [63, 15]], '#ff8a3d', 1);
  P.p([[41, 15], [42, 11], [44, 9.5], [46, 12], [48, 6], [50, 10], [52, 7], [54, 11], [56, 10], [58, 15]], '#ffe2a0', 1);
  P.r(38, 17, 24, 17, '#4a4344'); P.r(51, 17, 11, 17, '#332d2e');
  P.r(42, 21.5, 16, 2, '#ffc861', 1); P.r(42, 25.5, 16, 2, '#ffb35c', 1); P.r(43, 29.5, 14, 2, '#ff8a3d', 1);
  P.r(36, 14, 28, 4, '#c99a3e'); P.r(43, 15, 2, 2, '#ff3b6b'); P.r(49, 15, 2, 2, '#ff3b6b'); P.r(55, 15, 2, 2, '#ff3b6b');
}

export const HERO = { W: 50, H: 46, ox: 9, oy: 4, pad: 2 };
export const BOSS = { W: 130, H: 132, ox: 3, oy: 4, s: 1.25, pad: 8 };
let _frames = null;
let _framesV = null;
export function frames(v2 = true) {
  if (_frames && _framesV === v2) return _frames;
  _framesV = v2; HIT_GLOW = v2 ? 0.12 : 0.4;
  const hero = (fn, fxFn) => {
    const f = {};
    ['idle', 'atk'].forEach(p => { const P = new Pix(HERO.W, HERO.H, HERO.ox, HERO.oy); fn(P, p); f[p] = finalize(P); });
    if (fxFn) fx(f.atk, fxFn);
    f.hit = hitOf(f.idle, HERO.ox + 16, HERO.oy + 40);
    return f;
  };
  const arc = (cx, cy, r, a0, a1, col, w = 1.6) => k => { k.strokeStyle = col; k.lineWidth = w; k.lineCap = 'round'; k.beginPath(); k.arc(cx, cy, r, a0, a1); k.stroke(); };
  _frames = {
    bw: hero(bulwark, arc(25, 29, 19, -2.2, -0.35, '#fff4e2')),
    lu: hero(lumen, k => { k.strokeStyle = '#ffe7a8'; k.lineWidth = 1.2; [[25.5, 2, 25.5, -1], [31, 5, 33, 3], [20, 5, 18, 3], [31, 10, 34, 10]].forEach(([a, b, c, d]) => { k.beginPath(); k.moveTo(a, b); k.lineTo(c, d); k.stroke(); }); }),
    ew: hero(emberwright),
    db: hero(duskblade, arc(26, 23, 11, -1.3, 1.1, '#ff9fc8', 1.4)),
    sb: hero(slagbinder),
  };
  const P = new Pix(BOSS.W, BOSS.H, BOSS.ox, BOSS.oy, BOSS.s); regent(P);
  _frames.boss = { idle: finalize(P) };
  return _frames;
}
