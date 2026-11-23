/**
 * HD-2D look test: draws the live run in three.js, in the look of the Claude Design handoff (09) with the
 * visuals team's v2 fixes. This file and three.js build into dist/hd2d.js (vite.hd2d.config.ts), which the
 * game fetches only when you press Delve with ?hd2d=1 (client/hd2d/api.ts).
 *
 * It reads the World every frame and draws:
 * - the Flue's room (tiled floor ringed by lava, curb, back wall, chimneys, the throne, braziers), scaled to the arena;
 * - pillars from the layout;
 * - heroes as the handoff's pixel sprites with their class rings, allies named;
 * - the Furnace Regent as the handoff's sprite, every other foe as its 2D sheet standing upright;
 * - telegraphs (hatched danger, gold soaks) filling as they near landing, Decrees and their scorch;
 * - hero bolts, strikes, gems and drops, and rising embers.
 * Damage numbers, nameplates over foes and cast bars stay 2D-only for now (the HUD's boss frame still shows casts).
 *
 * The 2D scene keeps running the sim and the HUD underneath; it only stops drawing its own camera.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { frames as artFrames, HERO, BOSS } from './art';
import type { Hd2dAdapter, Hd2dView } from './api';
import type { World } from '../../sim/world';

/** 3D units per world unit: the 560-unit arena becomes an 8-unit room. */
const S = 1 / 70;
/** The handoff room's floor radius, which everything in the room is built around (scaled to the arena after). */
const ROOM_R = 7.45;
const FLOOR = 0.125;
/** Handoff hero sprites are 46 px tall; this makes a hero about 1.5 units (105 world units) tall, near the handoff's size. */
const HERO_PX = 0.032;
const BOSS_PX = 0.03;
/** The 2D short side shows 500 world units (GameScene viewFor); the 3D view frames about the same, a little wider. */
const VIEW = 560 * S;

/** Class ring colours, as v2 settled them (the Duskblade's #ff5fa2 keeps it clear of danger pink). */
const RING: Record<string, string> = { bulwark: '#d6dde4', duskblade: '#ff5fa2', emberwright: '#ff8a3d', lumen: '#ffc861', slagbinder: '#ff9b4a' };
const ART: Record<string, string> = { bulwark: 'bw', duskblade: 'db', emberwright: 'ew', lumen: 'lu', slagbinder: 'sb' };

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function canvasTex(c: HTMLCanvasElement, o: { repeat?: [number, number]; nearest?: boolean } = {}): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  if (o.nearest) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  return t;
}

/* ---------- canvases (from the handoff) ---------- */
function brickCanvas() {
  const c = mk(256, 256), k = c.getContext('2d')!;
  k.fillStyle = '#140906'; k.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) for (let i = -1; i < 7; i++) {
    const x = i * 40 + (row % 2) * 20, y = row * 16, l = rnd(0.75, 1.1);
    k.fillStyle = `rgb(${86 * l | 0},${40 * l | 0},${26 * l | 0})`; k.fillRect(x + 2, y + 2, 36, 12);
    k.fillStyle = 'rgba(255,190,140,.08)'; k.fillRect(x + 2, y + 2, 36, 2);
    k.fillStyle = 'rgba(0,0,0,.25)'; k.fillRect(x + 2, y + 12, 36, 2);
  }
  for (let i = 0; i < 900; i++) { k.fillStyle = `rgba(0,0,0,${rnd(0.05, 0.3)})`; k.fillRect(rnd(0, 256), rnd(0, 256), 2, 2); }
  return c;
}
function grainCanvas() {
  const c = mk(64, 64), k = c.getContext('2d')!;
  for (let y = 0; y < 64; y += 2) for (let x = 0; x < 64; x += 2) { const v = rnd(150, 230) | 0; k.fillStyle = `rgb(${v},${v},${v})`; k.fillRect(x, y, 2, 2); }
  k.strokeStyle = 'rgba(40,30,25,.6)'; k.lineWidth = 1;
  for (let i = 0; i < 3; i++) { k.beginPath(); k.moveTo(rnd(0, 64), rnd(0, 64)); k.lineTo(rnd(0, 64), rnd(0, 64)); k.stroke(); }
  return c;
}
function lavaCanvas() {
  const c = mk(512, 512), k = c.getContext('2d')!;
  k.fillStyle = '#000'; k.fillRect(0, 0, 512, 512);
  const g = k.createRadialGradient(256, 256, 120, 256, 256, 256);
  g.addColorStop(0, 'rgba(120,30,5,0)'); g.addColorStop(0.75, 'rgba(160,45,8,.55)'); g.addColorStop(1, 'rgba(255,110,30,1)');
  k.fillStyle = g; k.fillRect(0, 0, 512, 512); k.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const a = rnd(0, Math.PI * 2), r0 = rnd(0.62, 0.95) * 256, a2 = a + rnd(-0.3, 0.3), r2 = r0 - rnd(20, 60);
    k.strokeStyle = `rgba(255,${rnd(100, 170) | 0},40,${rnd(0.5, 1)})`; k.lineWidth = rnd(3, 8);
    k.beginPath(); k.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0);
    k.quadraticCurveTo(256 + Math.cos(a + 0.1) * (r0 + r2) / 2, 256 + Math.sin(a - 0.1) * (r0 + r2) / 2, 256 + Math.cos(a2) * r2, 256 + Math.sin(a2) * r2); k.stroke();
  }
  return c;
}
function rimCanvas() {
  const c = mk(256, 256), k = c.getContext('2d')!;
  k.fillStyle = '#c23d0a'; k.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) { k.fillStyle = Math.random() < 0.5 ? `rgba(255,${rnd(140, 220) | 0},60,${rnd(0.3, 0.9)})` : `rgba(40,8,2,${rnd(0.3, 0.8)})`; k.beginPath(); k.arc(rnd(0, 256), rnd(0, 256), rnd(3, 14), 0, 7); k.fill(); }
  return c;
}
function dotCanvas(inner: string, outer: string) {
  const c = mk(64, 64), k = c.getContext('2d')!, g = k.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(1, outer); k.fillStyle = g; k.fillRect(0, 0, 64, 64); return c;
}
/** Telegraph art in danger pink, or gold for a soak (stand in it). */
const TEL = { hit: { line: '#ff3b6b', fill: 'rgba(255,59,107,.18)', hatch: 'rgba(255,59,107,.5)', dash: '#ffd6e0' }, soak: { line: '#ffc861', fill: 'rgba(255,200,97,.16)', hatch: 'rgba(255,200,97,.42)', dash: '#fff1c4' } };
type TelKind = keyof typeof TEL;
function hatch(k: CanvasRenderingContext2D, size: number, col: string) {
  k.save(); k.rotate(Math.PI / 4);
  for (let x = -size * 2; x < size * 2; x += 26) { k.fillStyle = col; k.fillRect(x, -size * 2, 10, size * 4); }
  k.restore();
}
function circleTel(kind: TelKind) {
  const T = TEL[kind], c = mk(256, 256), k = c.getContext('2d')!;
  k.save(); k.beginPath(); k.arc(128, 128, 120, 0, 7); k.clip(); k.fillStyle = T.fill; k.fillRect(0, 0, 256, 256); hatch(k, 256, T.hatch); k.restore();
  k.strokeStyle = T.line; k.lineWidth = 9; k.beginPath(); k.arc(128, 128, 120, 0, 7); k.stroke();
  k.strokeStyle = T.dash; k.lineWidth = 3.5; k.setLineDash([14, 12]); k.beginPath(); k.arc(128, 128, 104, 0, 7); k.stroke();
  return c;
}
/** A cone pointing along +x, `half` radians each side, filling the canvas's radius. */
function coneTel(kind: TelKind, half: number) {
  const T = TEL[kind], c = mk(512, 512), k = c.getContext('2d')!;
  const wedge = (r: number) => { k.beginPath(); k.moveTo(256, 256); k.arc(256, 256, r, -half, half); k.closePath(); };
  k.save(); wedge(248); k.clip(); k.fillStyle = T.fill; k.fillRect(0, 0, 512, 512); hatch(k, 512, T.hatch); k.restore();
  k.strokeStyle = T.line; k.lineWidth = 9; k.lineJoin = 'round'; wedge(248); k.stroke();
  return c;
}
/** The fill that grows inside a telegraph as it nears landing. */
function fillDisc(kind: TelKind) {
  const c = mk(128, 128), k = c.getContext('2d')!;
  k.fillStyle = kind === 'hit' ? 'rgba(255,59,107,.42)' : 'rgba(255,200,97,.36)'; k.beginPath(); k.arc(64, 64, 62, 0, 7); k.fill();
  return c;
}
function nameCanvas(text: string, color: string) {
  const c = mk(256, 64), k = c.getContext('2d')!;
  k.font = '600 28px "Iowan Old Style", Palatino, Georgia, serif'; k.textAlign = 'center'; k.textBaseline = 'middle';
  k.lineWidth = 7; k.strokeStyle = '#120b0a'; k.lineJoin = 'round'; k.strokeText(text, 128, 34);
  k.fillStyle = color; k.fillText(text, 128, 34); return c;
}

/* ---------- the room ---------- */
function buildRoom(scene: THREE.Scene, saver: boolean, addLight: (c: string, i: number, d: number, p: THREE.Vector3, s?: number) => void) {
  const room = new THREE.Group(); scene.add(room);
  const grain = canvasTex(grainCanvas(), { repeat: [1, 1] });
  const tileMat = new THREE.MeshStandardMaterial({ map: grain, roughness: 0.88, metalness: 0.02 });
  const cells: [number, number, number][] = [];
  // Tiles at 0.62 units (the handoff's were 1): with the camera over the floor, whole-unit tiles dwarfed the heroes.
  const T = 0.62;
  for (let x = -13; x <= 13; x++) for (let z = -13; z <= 13; z++) {
    const px = (x + (z % 2 ? 0.5 : 0)) * T, d = Math.hypot(px, z * T);
    if (d > ROOM_R || (d > 5.6 && Math.random() < 0.06)) continue;
    cells.push([px, z * T, d]);
  }
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.94 * T, 0.25, 0.94 * T), tileMat, cells.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color(), one = new THREE.Vector3(1, 1, 1);
  cells.forEach(([px, z, d], i) => {
    e.set(rnd(-0.025, 0.025), rnd(-0.04, 0.04), rnd(-0.025, 0.025)); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(px, rnd(-0.03, 0.02), z), q, one); tiles.setMatrixAt(i, m4);
    col.set('#6a5548').multiplyScalar(rnd(0.78, 1.08) * (d > 6 ? 0.85 : 1)); tiles.setColorAt(i, col);
  });
  tiles.receiveShadow = true; room.add(tiles);
  const lava = new THREE.Mesh(new THREE.CircleGeometry(7.7, 64), new THREE.MeshBasicMaterial({ map: canvasTex(lavaCanvas()), color: new THREE.Color(0.8, 0.8, 0.8) }));
  lava.rotation.x = -Math.PI / 2; lava.position.y = -0.1; room.add(lava);
  const rim = new THREE.Mesh(new THREE.RingGeometry(7.55, 8.3, 96, 1), new THREE.MeshBasicMaterial({ map: canvasTex(rimCanvas(), { repeat: [12, 1] }), color: new THREE.Color(1.2, 1.2, 1.2) }));
  rim.rotation.x = -Math.PI / 2; rim.position.y = -0.12; room.add(rim);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#1a100c', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.35; ground.receiveShadow = true; room.add(ground);
  const basalt = new THREE.MeshStandardMaterial({ color: '#3a302c', roughness: 0.8, map: grain });
  const curbN = 60, curb = new THREE.InstancedMesh(new THREE.BoxGeometry(0.86, 0.55, 0.62), basalt, curbN);
  for (let i = 0; i < curbN; i++) {
    const a = (i / curbN) * Math.PI * 2; e.set(0, a, 0); q.setFromEuler(e);
    m4.compose(new THREE.Vector3(Math.sin(a) * 8.62, -0.05 + rnd(-0.04, 0.04), Math.cos(a) * 8.62), q, one); curb.setMatrixAt(i, m4);
  }
  curb.castShadow = curb.receiveShadow = true; room.add(curb);
  const brick = brickCanvas();
  // The wall wraps all the way round here (the handoff's fixed camera only ever saw the back half).
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(10.6, 10.6, 11, 72, 1, true), new THREE.MeshStandardMaterial({ map: canvasTex(brick, { repeat: [28, 5] }), roughness: 0.92, side: THREE.BackSide }));
  wall.position.y = 5.2; wall.receiveShadow = true; room.add(wall);
  // Dimmer than the handoff's (3.2, 1.25, 0.35): at the brighter exposure, colours over about 1.2 tone-map to white.
  const chimMouth = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.42, 0.1) });
  const chimInner = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 0.6, 0.18) });
  for (const [a, w] of [[Math.PI, 3.4], [Math.PI - 0.78, 2.2], [Math.PI + 0.78, 2.2]] as const) {
    const g = new THREE.Group(); g.position.set(Math.sin(a) * 9.7, 0, Math.cos(a) * 9.7); g.lookAt(0, 0, 0);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 13, 1.9), new THREE.MeshStandardMaterial({ map: canvasTex(brick, { repeat: [w / 1.5, 7] }), roughness: 0.9 }));
    body.position.y = 6.2; body.castShadow = body.receiveShadow = true; g.add(body);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.4, 2.2), basalt); cap.position.set(0, 2.4, 0.1); g.add(cap);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, 1.7), chimMouth); mouth.position.set(0, 1.1, 0.96); g.add(mouth);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.36, 0.9), chimInner); inner.position.set(0, 0.8, 0.97); g.add(inner);
    room.add(g);
  }
  const iron = new THREE.MeshStandardMaterial({ color: '#2b2526', roughness: 0.5, metalness: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c99a3e', roughness: 0.35, metalness: 0.85 });
  // The throne stands outside the floor, against the back wall, so it never hides a fight.
  const throne = new THREE.Group(); throne.position.set(0, FLOOR, -9.1);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(3.0, 4.2, 0.6), iron); tb.position.y = 2.1; throne.add(tb);
  const tt = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.3, 0.8), brass); tt.position.y = 4.25; throne.add(tt);
  for (const x of [-1.55, 1.55]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 4.6, 8), brass); p.position.set(x, 2.3, 0.15); throne.add(p);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 8), chimInner); f.position.set(x, 4.9, 0.15); throne.add(f);
  }
  throne.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true; }); room.add(throne);
  const flames: THREE.Mesh[] = [];
  // Only the back braziers: the handoff's two front ones stood between this camera and the fight, and side ones
  // (PI ± 1.55) came within a metre of the camera when your hero stood at that side (mobile's 568x320 check, 23 Nov).
  for (const a of [Math.PI - 0.5, Math.PI + 0.5, Math.PI - 1.1, Math.PI + 1.1]) {
    const g = new THREE.Group(); g.position.set(Math.sin(a) * 8.62, 0.22, Math.cos(a) * 8.62);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.26, 0.4, 10), iron); bowl.position.y = 0.75; g.add(bowl);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.6, 6), iron); stem.position.y = 0.3; g.add(stem);
    const coals = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 10), chimMouth); coals.position.y = 0.95; g.add(coals);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.0, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.38, 0.1), transparent: true, opacity: 0.92 }));
    fl.position.y = 1.45; g.add(fl); flames.push(fl);
    bowl.castShadow = stem.castShadow = true;
    room.add(g);
  }
  // Steve, 23 Nov: "the environment still seems empty and very dark". Props and floor detail, every set one
  // instanced batch (one draw call each), placed from a fixed seed so the room looks the same every run.
  let seed = 9;
  const sr = (a: number, b: number) => { seed = (seed * 16807) % 2147483647; return a + ((seed - 1) / 2147483646) * (b - a); };
  const back = (a: number) => Math.abs(((a - Math.PI + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 1.0; // the chimneys and throne
  // The camera looks in from +z, so anything tall on the near side would stand between it and the fight.
  const near = (a: number) => Math.cos(a) > 0.15;
  const put = (im: THREE.InstancedMesh, n: number, x: number, y: number, z: number, ry: number, sx: number, sy = sx, sz = sx, rx = 0, rz = 0) => {
    e.set(rx, ry, rz); q.setFromEuler(e); m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)); im.setMatrixAt(n, m4);
  };
  const wood = new THREE.MeshStandardMaterial({ color: '#7a4e2c', roughness: 0.85, map: grain });
  const hoop = new THREE.MeshStandardMaterial({ color: '#4a4048', roughness: 0.45, metalness: 0.7 });
  // Barrels and crates in clusters outside the curb, against the wall (never on the fight floor).
  const spots: number[] = [];
  // Spread round the open part of the wall (at most 200 tries each, so a crowded wall can never hang the build).
  for (let k = 0; k < 8; k++) { for (let tries = 0; tries < 200; tries++) { const a = sr(0, Math.PI * 2); if (!back(a) && !spots.some((b) => Math.abs(b - a) < 0.4)) { spots.push(a); break; } } }
  const barrels = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.3, 0.9, 12), wood, 24);
  const bands = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.355, 0.355, 0.08, 12, 1, true), hoop, 48);
  const crates = new THREE.InstancedMesh(new THREE.BoxGeometry(0.75, 0.75, 0.75), wood, 20);
  let nb = 0, nc = 0;
  for (const a of spots) {
    const r0 = sr(9.4, 9.9);
    const cxs = Math.sin(a) * r0, czs = Math.cos(a) * r0;
    const nB = Math.round(sr(1, 3)), nC = Math.round(sr(1, 2));
    for (let j = 0; j < nB && nb < 24; j++) {
      const bx = cxs + sr(-0.6, 0.6), bz = czs + sr(-0.6, 0.6), tip = sr(0, 1) < 0.2;
      const y = tip ? 0.3 : 0.45 - 0.08;
      put(barrels, nb, bx, y, bz, sr(0, 6), 1, 1, 1, tip ? Math.PI / 2 : 0);
      [-0.28, 0.28].forEach((dy, j2) => put(bands, 2 * nb + j2, bx, tip ? y : y + dy, tip ? bz + dy : bz, 0, 1, 1, 1, tip ? Math.PI / 2 : 0));
      nb++;
    }
    for (let j = 0; j < nC && nc < 20; j++) {
      const s2 = sr(0.7, 1.05);
      put(crates, nc++, cxs + sr(-0.7, 0.7), 0.375 * s2 - 0.05, czs + sr(-0.7, 0.7), sr(0, 6), s2);
      if (sr(0, 1) < 0.4 && nc < 20) put(crates, nc++, cxs + sr(-0.2, 0.2), 0.75 * s2 + 0.3, czs + sr(-0.2, 0.2), sr(0, 6), 0.7);
    }
  }
  barrels.count = nb; crates.count = nc; bands.count = Math.min(48, nb * 2);
  for (const im of [barrels, crates]) { im.castShadow = im.receiveShadow = true; room.add(im); }
  room.add(bands);
  // Broken basalt columns round the wall, for a skyline at the edge of view.
  const cols = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.42, 0.5, 1, 10), basalt, 8);
  for (let k = 0; k < 8; k++) {
    const a = Math.PI + (k < 4 ? -1 : 1) * (1.05 + (k % 4) * 0.2), h = sr(1.4, 4.2);
    put(cols, k, Math.sin(a) * 10.05, h / 2 - 0.1, Math.cos(a) * 10.05, sr(0, 6), 1, h, 1, sr(-0.04, 0.04), sr(-0.04, 0.04));
  }
  cols.castShadow = cols.receiveShadow = true; room.add(cols);
  // Wall sconces: an iron bracket and a flame that glows on its own (no light each: the phone budget keeps two).
  const SC = saver ? 6 : 12;
  const bracket = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.5, 0.4), iron, SC);
  const scFlame = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.5, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.38, 0.1) }), SC);
  for (let k = 0; k < SC; k++) {
    const a = (k / SC) * Math.PI * 2 + 0.26, r = 10.45;
    if (near(a)) { put(bracket, k, 0, -50, 0, 0, 0.001); put(scFlame, k, 0, -50, 0, 0, 0.001); continue; }
    put(bracket, k, Math.sin(a) * r, 2.6, Math.cos(a) * r, a, 1);
    put(scFlame, k, Math.sin(a) * (r - 0.25), 3.05, Math.cos(a) * (r - 0.25), 0, 1);
  }
  room.add(bracket, scFlame);
  // Banners between the sconces: dark red cloth with a pale anvil mark.
  const bc = document.createElement('canvas'); bc.width = 64; bc.height = 160;
  { const k = bc.getContext('2d')!; const g = k.createLinearGradient(0, 0, 0, 160); g.addColorStop(0, '#5a1414'); g.addColorStop(1, '#2e0a0c'); k.fillStyle = g; k.fillRect(0, 0, 64, 140);
    k.beginPath(); k.moveTo(0, 140); k.lineTo(32, 160); k.lineTo(64, 140); k.fill(); k.fillStyle = '#c99a3e'; k.fillRect(0, 6, 64, 5); k.fillRect(0, 128, 64, 4);
    k.fillStyle = '#d9b46a'; k.fillRect(16, 60, 32, 10); k.fillRect(26, 70, 12, 14); k.fillRect(18, 84, 28, 8); }
  const BN = saver ? 4 : 8;
  const banners = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9, 2.3), new THREE.MeshStandardMaterial({ map: canvasTex(bc), roughness: 0.95, side: THREE.DoubleSide }), BN);
  for (let k = 0; k < BN; k++) { const a = (k / BN) * Math.PI * 2 + 0.26 + Math.PI / SC * 1.0; if (back(a) || near(a)) { put(banners, k, 0, -50, 0, 0, 0.001); continue; } put(banners, k, Math.sin(a) * 10.5, 4.3, Math.cos(a) * 10.5, a + Math.PI, 1); }
  room.add(banners);
  // Chains hanging from the dark above, at the edge of the room.
  const chains = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 5), hoop, 10);
  // Only on the far half: on the near half they hung between the camera and the floor.
  for (let k = 0; k < 10; k++) { const a = Math.PI + sr(-1.3, 1.3), len = sr(4, 7.5); put(chains, k, Math.sin(a) * 9.3, 12 - len / 2, Math.cos(a) * 9.3, 0, 1, len, 1); }
  room.add(chains);
  // The floor: a brass inlay (two rings and eight spokes), worn and dull so telegraphs stay the brightest thing on it.
  const inlay = new THREE.MeshStandardMaterial({ color: '#8a6a34', roughness: 0.4, metalness: 0.8, emissive: new THREE.Color('#2a1606') });
  for (const [r0, r1] of [[2.55, 2.68], [5.75, 5.9]]) { const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 96), inlay); ring.rotation.x = -Math.PI / 2; ring.position.y = FLOOR + 0.004; ring.receiveShadow = true; room.add(ring); }
  const spokes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.01, 3.07), inlay, 8);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; put(spokes, k, Math.sin(a) * 4.215, FLOOR + 0.004, Math.cos(a) * 4.215, a, 1); }
  spokes.receiveShadow = true; room.add(spokes);
  // Ember cracks: a few faint seams in the floor tiles (dim, so they never read as a fire telegraph).
  const cc = document.createElement('canvas'); cc.width = cc.height = 128;
  { const k = cc.getContext('2d')!; k.strokeStyle = 'rgba(255,140,50,1)'; k.lineCap = 'round'; k.shadowColor = '#ff6a1f'; k.shadowBlur = 6;
    for (let j = 0; j < 3; j++) { k.lineWidth = 3 - j; k.beginPath(); let x = 64, y = 64; k.moveTo(x, y); for (let n = 0; n < 6; n++) { x += Math.cos(j * 2.1 + n * 0.7) * 10; y += Math.sin(j * 2.1 + n * 0.5) * 10; k.lineTo(x, y); } k.stroke(); } }
  const CR = saver ? 4 : 8;
  const cracks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: canvasTex(cc), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }), CR);
  for (let k = 0; k < CR; k++) { const a = sr(0, Math.PI * 2), r = sr(1.2, 7.0); put(cracks, k, Math.sin(a) * r, FLOOR + 0.006, Math.cos(a) * r, 0, sr(0.7, 1.3), sr(0.7, 1.3), 1, -Math.PI / 2, sr(0, 6)); }
  room.add(cracks);
  // Rubble and coal along the floor's edge and outside it, low enough never to hide a telegraph.
  const RB = saver ? 40 : 90;
  const rubble = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), basalt, RB);
  const coal = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#1c1614', roughness: 0.7, emissive: new THREE.Color('#5a1a04'), emissiveIntensity: 0.6 }), Math.round(RB / 3));
  for (let k = 0; k < RB; k++) { const a = sr(0, Math.PI * 2), r = k % 3 ? sr(6.7, 7.4) : sr(9.0, 10.3), sz = sr(0.04, k % 3 ? 0.1 : 0.22); put(rubble, k, Math.sin(a) * r, FLOOR + sz * 0.4 - (r > 8 ? 0.15 : 0), Math.cos(a) * r, sr(0, 6), sz, sz * sr(0.5, 0.9), sz, sr(0, 3)); }
  for (let k = 0; k < coal.count; k++) { const a = sr(0, Math.PI * 2), r = sr(6.4, 7.4), sz = sr(0.04, 0.08); put(coal, k, Math.sin(a) * r, FLOOR + sz * 0.4, Math.cos(a) * r, sr(0, 6), sz); }
  rubble.receiveShadow = true; room.add(rubble, coal);
  // v2's phone budget: two shared warm lights instead of nine (one at the back wall, one at the front braziers).
  addLight('#ff7a30', 34, 22, new THREE.Vector3(0, 2.4, -8.2), 1.4);
  if (!saver) addLight('#ff8a3d', 14, 14, new THREE.Vector3(0, 2.2, 7.6), 2.0);
  return { room, flames, basalt };
}

/* ---------- sprites ---------- */
type Frame = { m: HTMLCanvasElement; e: HTMLCanvasElement; w: number; h: number };
function spriteMat(f: Frame, glow: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map: canvasTex(f.m, { nearest: true }), emissiveMap: canvasTex(f.e, { nearest: true }), emissive: new THREE.Color(1, 1, 1), emissiveIntensity: glow, alphaTest: 0.5, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  // The handoff's trick: a little of the sprite's own colour always glows, so sprites never go black in shadow.
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.32;'); };
  return m;
}
/** A unit plane standing on its bottom edge, scaled per sprite. */
const standGeo = (pad: number) => { const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5 - pad, 0); return g; };

let shared: THREE.WebGLRenderer | null = null;

export function mount(host: HTMLElement, A: Hd2dAdapter, opts: { fx: boolean; saver: boolean }): Hd2dView {
  const saver = opts.saver;
  const fx = opts.fx && !saver;
  // One renderer for every run: three.js keeps its compiled shaders per renderer, so the second Delve on doesn't
  // compile them again (the first is most of the wait after the loading screen on a slow phone).
  const renderer = shared ?? (shared = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }));
  // Phones: at most 1.5x (2x tripled the bloom's cost for little gain at this pixel-art scale); saver 1x.
  const pr = saver ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(pr);
  renderer.info.autoReset = false;
  renderer.shadowMap.enabled = !saver; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  // A touch over the handoff's 1.0. Steve, 23 Nov: 0.78 read "very dark".
  renderer.toneMappingExposure = 1.05;
  const cv = renderer.domElement;
  cv.className = 'hd2d-canvas';
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:1';
  host.appendChild(cv);
  // A dark band under the HUD's top line: in portrait the room's brightest light sits behind it, and the gold
  // "Fight 1 of 5" was hard to read there at 320 px (QA, 23 Nov).
  const shade = document.createElement('div');
  shade.className = 'hd2d-shade';
  shade.style.cssText = 'position:absolute;left:0;right:0;top:0;height:calc(max(10px, env(safe-area-inset-top)) + 96px);'
    + 'pointer-events:none;z-index:1;background:linear-gradient(to bottom, rgba(8,4,3,0.72), rgba(8,4,3,0.4) 55%, rgba(8,4,3,0))';
  host.appendChild(shade);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0a0504');
  scene.fog = new THREE.Fog('#120705', 26, 46);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  /** The handoff's camera angle: up 15.5 and back 13.6 from what it looks at. */
  const camDir = new THREE.Vector3(0, 15.5, 13.6).normalize();

  scene.add(new THREE.HemisphereLight('#c09a8a', '#3a2418', 1.25));
  const key = new THREE.DirectionalLight('#ffd0a8', 1.3);
  key.castShadow = !saver; key.shadow.mapSize.set(512, 512);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 40 });
  key.shadow.bias = -0.0008; scene.add(key); scene.add(key.target);
  // A warm lamp over your own hero, so the ground you fight on is always lit (the room's other lights sit at its edges).
  const lamp = new THREE.PointLight('#ffb27a', saver ? 0 : 5, 6.5, 2); lamp.position.set(0, 2.4, 0); if (!saver) scene.add(lamp);
  const rimCool = new THREE.DirectionalLight('#7f8cff', 0.35); rimCool.position.set(4, 6, -10); scene.add(rimCool);
  const flick: { l: THREE.PointLight; base: number; seed: number; speed: number }[] = [];
  const addLight = (c: string, i: number, d: number, p: THREE.Vector3, speed = 1) => { const l = new THREE.PointLight(c, i, d, 2); l.position.copy(p); scene.add(l); flick.push({ l, base: i, seed: Math.random() * 100, speed }); };
  const { room, flames, basalt } = buildRoom(scene, saver, addLight);
  let roomFor = -1;

  const flat = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = FLOOR + y; m.renderOrder = 2; scene.add(m); return m; };
  const blobTex = canvasTex(dotCanvas('rgba(0,0,0,.7)', 'rgba(0,0,0,0)'));
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  const circle = new THREE.CircleGeometry(1, 24);

  /* heroes */
  const F = artFrames(true) as Record<string, Record<string, Frame>>;
  const heroGeo = standGeo(HERO.pad / HERO.H);
  type HeroS = { cls: string; mesh: THREE.Mesh; mats: Record<string, THREE.MeshStandardMaterial>; blob: THREE.Mesh; ring: THREE.Mesh; disc: THREE.Mesh; name: THREE.Sprite | null; nameText: string;
    /** Attack pose: when the last attack began (run time), and what the hero's attack timers read last frame. */
    atkAt: number; lastVolley: number; lastSwings: number; lastCds: number[] };
  const heroes: HeroS[] = [];
  const heroSprite = (i: number, cls: string): HeroS => {
    const set = F[ART[cls] ?? 'ew'];
    const mats: Record<string, THREE.MeshStandardMaterial> = {};
    for (const p of Object.keys(set)) mats[p] = spriteMat(set[p], 1.8);
    const mesh = new THREE.Mesh(heroGeo, mats.idle); mesh.castShadow = true;
    mesh.scale.set(HERO.W * HERO_PX, HERO.H * HERO_PX, 1); scene.add(mesh);
    const rc = new THREE.Color(RING[cls] ?? '#ffc861');
    const ring = flat(new THREE.RingGeometry(0.4, 0.5, 48), new THREE.MeshBasicMaterial({ color: rc.clone().multiplyScalar(1.3), transparent: true, depthWrite: false }), 0.03);
    const disc = flat(new THREE.CircleGeometry(0.4, 48), new THREE.MeshBasicMaterial({ color: rc, transparent: true, opacity: 0.18, depthWrite: false }), 0.028);
    const blob = flat(circle, blobMat, 0.006); blob.scale.setScalar(0.48);
    const h: HeroS = { cls, mesh, mats, blob, ring, disc, name: null, nameText: '', atkAt: -9, lastVolley: 0, lastSwings: 0, lastCds: [] };
    heroes[i] = h; return h;
  };
  const dropHero = (h: HeroS) => { for (const o of [h.mesh, h.blob, h.ring, h.disc, h.name]) if (o) scene.remove(o); };

  /* foes */
  const foeGeo = standGeo(0.04);
  const bossGeo = standGeo(BOSS.pad / BOSS.H);
  const regentMat = spriteMat(F.boss.idle, 0.85);
  const foeMats = new Map<string, THREE.MeshStandardMaterial | null>();
  const foeMat = (key: string, n: number) => {
    const id = `${key}#${n}`;
    let m = foeMats.get(id);
    if (m === undefined) {
      const c = A.frame(key, n);
      if (c) {
        m = new THREE.MeshStandardMaterial({ map: canvasTex(c), alphaTest: 0.45, roughness: 1, metalness: 0, side: THREE.DoubleSide, emissive: new THREE.Color(1, 1, 1), emissiveMap: canvasTex(c), emissiveIntensity: 0.22 });
        (m.map as THREE.Texture).userData = { w: c.width, h: c.height };
      } else m = null;
      foeMats.set(id, m);
    }
    return m;
  };
  type FoeS = { mesh: THREE.Mesh; blob: THREE.Mesh };
  const foes: FoeS[] = [];
  const foe = (i: number): FoeS => {
    let f = foes[i];
    if (!f) {
      const mesh = new THREE.Mesh(foeGeo, regentMat); mesh.castShadow = !saver; scene.add(mesh);
      const blob = flat(circle, blobMat, 0.005);
      f = foes[i] = { mesh, blob };
    }
    return f;
  };
  const bossLight = new THREE.PointLight('#ff7a2e', 0, 6, 2); scene.add(bossLight);

  /* telegraphs */
  const telTex = { hit: canvasTex(circleTel('hit')), soak: canvasTex(circleTel('soak')) };
  const fillTex = { hit: canvasTex(fillDisc('hit')), soak: canvasTex(fillDisc('soak')) };
  const coneTex = new Map<string, THREE.CanvasTexture>();
  const coneOf = (kind: TelKind, half: number) => { const id = `${kind}${half.toFixed(2)}`; let t = coneTex.get(id); if (!t) { t = canvasTex(coneTel(kind, half)); coneTex.set(id, t); } return t; };
  const telMat = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, color: new THREE.Color(1.25, 1.25, 1.25), polygonOffset: true, polygonOffsetFactor: -2 });
  const plane = new THREE.PlaneGeometry(1, 1);
  type TelS = { m: THREE.Mesh; fill: THREE.Mesh };
  const tels: TelS[] = [];
  const tel = (i: number): TelS => {
    let t = tels[i];
    if (!t) { t = tels[i] = { m: flat(plane, telMat(telTex.hit), 0.02), fill: flat(circle, new THREE.MeshBasicMaterial({ map: fillTex.hit, transparent: true, depthWrite: false }), 0.022) }; }
    return t;
  };
  /* Decrees: a molten scorch ring round the holder and a burning crown over them. */
  const scorchMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.9, 0.25), transparent: true, opacity: 0.55, depthWrite: false });
  const crownMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.2, 0.8) });
  const decrees: { ring: THREE.Mesh; crown: THREE.Mesh }[] = [];
  const decree = (i: number) => {
    let d = decrees[i];
    if (!d) { d = decrees[i] = { ring: flat(new THREE.RingGeometry(0.92, 1, 64), scorchMat, 0.035), crown: new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 5), crownMat) }; scene.add(d.crown); }
    return d;
  };

  /* bolts, strikes, gems and drops */
  const boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.2, 0.6) });
  const bolts = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), boltMat, 256); bolts.frustumCulled = false; scene.add(bolts);
  const gemMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.4, 2.0) });
  const gems = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.07), gemMat, 512); gems.frustumCulled = false; scene.add(gems);
  const dropMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 0.9) });
  const drops = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.13), dropMat, 64); drops.frustumCulled = false; scene.add(drops);
  const strikeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.6), transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
  const strikes = new THREE.InstancedMesh(new THREE.RingGeometry(0.8, 1, 32).rotateX(-Math.PI / 2), strikeMat, 128); strikes.frustumCulled = false; scene.add(strikes);
  const zoneMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.8, 0.2), transparent: true, opacity: 0.32, depthWrite: false });
  const zones = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), zoneMat, 64); zones.frustumCulled = false; scene.add(zones);

  /* pillars, rebuilt when the layout changes */
  let pillarSig = '';
  const pillarGroup = new THREE.Group(); scene.add(pillarGroup);
  const pillarGeo = new THREE.CylinderGeometry(1, 1.08, 1, 10);

  /* embers */
  const N = saver ? 60 : 120, pos = new Float32Array(N * 3), vel = new Float32Array(N);
  const spawn = (i: number, cx: number, cz: number, anywhere: boolean) => { const a = rnd(0, Math.PI * 2), r = rnd(0, 7); pos[i * 3] = cx + Math.sin(a) * r; pos[i * 3 + 1] = anywhere ? rnd(0, 6) : rnd(0, 0.4); pos[i * 3 + 2] = cz + Math.cos(a) * r; vel[i] = rnd(0.35, 1.1); };
  for (let i = 0; i < N; i++) spawn(i, 0, 0, true);
  const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const embers = new THREE.Points(pgeo, new THREE.PointsMaterial({ map: canvasTex(dotCanvas('rgba(255,255,255,1)', 'rgba(255,255,255,0)')), color: new THREE.Color(3, 1.35, 0.45), size: 0.11, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  embers.frustumCulled = false; scene.add(embers);

  /* post */
  let composer: EffectComposer | null = null;
  let bloom: UnrealBloomPass | null = null, hT: ShaderPass | null = null, vT: ShaderPass | null = null;
  if (fx) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.45, 0.95); composer.addPass(bloom);
    hT = new ShaderPass(HorizontalTiltShiftShader); hT.uniforms.r.value = 0.55; composer.addPass(hT);
    vT = new ShaderPass(VerticalTiltShiftShader); vT.uniforms.r.value = 0.55; composer.addPass(vT);
    composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);float d=distance(vUv,vec2(.5,.52));c.rgb*=mix(.45,1.,smoothstep(.8,.35,d));gl_FragColor=c;}',
    }));
    composer.addPass(new OutputPass());
  }

  let W = 0, H = 0, dist = 20;
  /** How many attacks your hero has started (stats(), so a test can see the pose fire). */
  let attacks = 0;
  let bridge: { mesh: THREE.Mesh; tex: THREE.CanvasTexture; stamp: number } | null = null;
  const resize = () => {
    const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
    if (w === W && h === H) return;
    W = w; H = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    // Frame VIEW units across the short side at the hero's depth.
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    dist = camera.aspect < 1 ? VIEW / (2 * tanV * camera.aspect) : VIEW / (2 * tanV);
    if (composer) {
      composer.setSize(w, h);
      // Bloom at half size: a third of its cost, and it blurs anyway.
      bloom!.resolution.set(w / 2, h / 2);
      // Softer than the handoff's 1.5: this camera is close, so a strong tilt-shift blurred heroes near the screen edges.
      hT!.uniforms.h.value = 0.9 / (w * pr); vT!.uniforms.v.value = 0.9 / (h * pr);
    }
  };

  const times: number[] = [];
  const m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  let t = 0;
  const place = (im: THREE.InstancedMesh, n: number, x: number, y: number, z: number, s: number) => { v3.set(x, y, z); sc.set(s, s, s); m4.compose(v3, q0, sc); im.setMatrixAt(n, m4); };

  const frame = (dtIn: number) => {
    // Counted over the whole frame (bloom and tilt-shift passes too), so stats() reports real draw calls.
    renderer.info.reset();
    resize();
    const dt = Math.min(0.05, Math.max(0, dtIn));
    t += dt;
    const w: World = A.world();
    const a = A.alpha();
    const L = (p: number, c: number) => p + (c - p) * a;

    if (roomFor !== w.arenaR) {
      roomFor = w.arenaR;
      room.scale.setScalar((w.arenaR * S) / ROOM_R);
    }
    // The floor bridge: the 2D scene's floor layer, laid flat just over the tiles and under the 3D telegraphs.
    const fl = A.floor?.();
    if (fl) {
      if (!bridge || bridge.tex.image !== fl.canvas) {
        if (bridge) { scene.remove(bridge.mesh); bridge.tex.dispose(); (bridge.mesh.material as THREE.Material).dispose(); }
        const tex = new THREE.CanvasTexture(fl.canvas); tex.colorSpace = THREE.SRGBColorSpace;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
        mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 1; scene.add(mesh);
        bridge = { mesh, tex, stamp: -1 };
      }
      bridge.mesh.scale.set(fl.span * S, fl.span * S, 1);
      bridge.mesh.position.set(0, FLOOR + 0.026, 0); // tiles reach FLOOR + 0.02 (rnd jitter), so lie above the highest
      if (fl.stamp !== bridge.stamp) { bridge.stamp = fl.stamp; bridge.tex.needsUpdate = true; }
    }
    // Pillars.
    const sig = w.pillars.map((p) => `${p.x | 0},${p.y | 0},${p.r | 0}`).join(';');
    if (sig !== pillarSig) {
      pillarSig = sig;
      pillarGroup.clear();
      for (const p of w.pillars) {
        const m = new THREE.Mesh(pillarGeo, basalt); m.position.set(p.x * S, 1.1, p.y * S); m.scale.set(p.r * S, 2.2, p.r * S);
        m.castShadow = m.receiveShadow = true; pillarGroup.add(m);
      }
    }

    // Heroes.
    let cx = 0, cz = 0;
    for (let i = 0; i < w.heroes.length; i++) {
      const cls = w.heroes[i].cls;
      let h = heroes[i];
      if (!h || h.cls !== cls) { if (h) dropHero(h); h = heroSprite(i, cls); }
      const p = w.heroData(i).player;
      const x = L(p.px, p.x) * S, z = L(p.py, p.y) * S;
      if (i === 0) { cx = x; cz = z; }
      const dead = p.hp <= 0;
      // An attack starts when the auto-attack timer resets (volleyT jumps up: every class's basic attack), a melee
      // swing lands (swings counts up), or an ability goes on cooldown. Steve, 23 Nov: his hero never animated, because
      // this read p.lastSwingAt, which only the Killing Rhythm talent sets.
      const cds = p.cds ?? [];
      if (p.volleyT > h.lastVolley + 0.05 || p.swings > h.lastSwings || cds.some((c, k) => c > (h.lastCds[k] ?? 0) + 0.05)) { h.atkAt = w.time; if (i === 0) attacks++; }
      h.lastVolley = p.volleyT; h.lastSwings = p.swings; h.lastCds = cds.slice();
      const since = w.time - h.atkAt;
      const swing = !dead && since >= 0 && since < 0.24;
      const pose = swing ? 'atk' : p.hurtFlash > 0 ? 'hit' : 'idle';
      h.mesh.material = h.mats[pose] ?? h.mats.idle;
      const moving = (p.x - p.px) ** 2 + (p.y - p.py) ** 2 > 0.01;
      const bob = moving ? Math.abs(Math.sin(t * 11 + i)) * 0.05 : 0;
      const face = p.x - p.px < -0.05 ? -1 : p.x - p.px > 0.05 ? 1 : Math.sign(h.mesh.scale.x) || 1;
      // While attacking: face the target (p.facing), lunge a little toward it and punch out, then settle back.
      const k = swing ? Math.sin(Math.min(1, since / 0.24) * Math.PI) : 0;
      const fx = Math.cos(p.facing ?? 0), fz = Math.sin(p.facing ?? 0);
      const faceNow = swing && Math.abs(fx) > 0.2 ? Math.sign(fx) : face;
      h.mesh.scale.set(faceNow * HERO.W * HERO_PX * (1 + 0.08 * k), HERO.H * HERO_PX * (1 + (moving ? 0 : 0.03 * Math.sin(t * 2.4 + i)) - 0.05 * k) * (dead ? 0.35 : 1), 1);
      // Your own hero a hair nearer the camera, so an ally standing on the same spot never hides it.
      h.mesh.position.set(x + fx * 0.12 * k, FLOOR + bob, z + fz * 0.12 * k + (i === 0 ? 0.02 : 0));
      h.mesh.visible = true;
      (h.mats.idle as THREE.MeshStandardMaterial).opacity = 1;
      h.blob.position.set(x, FLOOR + 0.006, z);
      h.ring.position.set(x, FLOOR + 0.03, z); h.disc.position.set(x, FLOOR + 0.028, z);
      h.ring.visible = h.disc.visible = !dead;
      if (i > 0) {
        const nm = A.heroName(i);
        if (nm !== h.nameText) {
          if (h.name) scene.remove(h.name);
          h.name = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(nameCanvas(nm, RING[cls] ?? '#ffc861')), depthTest: false, transparent: true }));
          h.name.scale.set(1.7, 0.425, 1); h.name.renderOrder = 10; scene.add(h.name); h.nameText = nm;
        }
        h.name!.position.set(x, FLOOR + 1.45, z);
      }
    }
    for (let i = w.heroes.length; i < heroes.length; i++) if (heroes[i]) { dropHero(heroes[i]); delete heroes[i]; }

    // Foes.
    let fi = 0, bossOn = false;
    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i];
      if (!e.alive) continue;
      const x = L(e.px, e.x) * S, z = L(e.py, e.y) * S;
      if (Math.abs(x - cx) > 9 || z - cz > 6 || cz - z > 12) continue;
      const f = foe(fi++);
      const age = w.time - e.spawnedAt;
      const rise = age < 0.3 ? 0.3 + 0.7 * (age / 0.3) + Math.sin((age / 0.3) * Math.PI) * 0.25 : 1;
      const hit = e.flash > 0 ? 0.1 : 0;
      let wd: number, ht: number;
      if (e.kind === 'regent') {
        f.mesh.geometry = bossGeo; f.mesh.material = regentMat;
        wd = BOSS.W * BOSS_PX; ht = BOSS.H * BOSS_PX;
        regentMat.emissiveIntensity = e.flash > 0 ? 1.15 : 0.85;
        bossOn = true; bossLight.position.set(x, 2, z + 0.6);
      } else {
        const key = A.enemyTex(i);
        const n = A.frames(key);
        const moving = (e.x - e.px) ** 2 + (e.y - e.py) ** 2 > 0.01;
        const fr = n > 1 && (moving || e.def.rank !== 'normal') ? Math.floor(t * (moving ? 7 : 4) + i * 1.7) % n : 0;
        const m = foeMat(key, fr);
        if (!m) { f.mesh.visible = f.blob.visible = false; continue; }
        f.mesh.geometry = foeGeo; f.mesh.material = m;
        const d = (m.map as THREE.Texture).userData as { w: number; h: number };
        wd = d.w * A.texScale * S; ht = d.h * A.texScale * S;
        m.emissiveIntensity = e.flash > 0 ? 0.7 : 0.22;
      }
      const flip = !e.def.stationary && x > cx ? -1 : 1;
      f.mesh.scale.set(flip * wd * rise * (1 + hit), ht * rise * (1 - hit), 1);
      f.mesh.position.set(x, FLOOR, z);
      f.mesh.rotation.z = e.stunT > 0 ? Math.sin(t * 16) * 0.1 : 0;
      f.mesh.visible = true;
      f.blob.visible = true; f.blob.position.set(x, FLOOR + 0.005, z); f.blob.scale.setScalar(e.def.radius * S * 1.25 * rise);
    }
    for (let i = fi; i < foes.length; i++) { foes[i].mesh.visible = false; foes[i].blob.visible = false; }
    bossLight.intensity = bossOn ? 10 * (0.8 + 0.2 * Math.sin(t * 1.6)) : 0;

    // Telegraphs.
    let ti = 0;
    for (const g of w.telegraphs) {
      if (!g.alive) continue;
      const s = tel(ti++);
      const kind: TelKind = g.kind === 'soak' ? 'soak' : 'hit';
      const prog = Math.min(1, Math.max(0, g.t / Math.max(0.01, g.dur)));
      const mat = s.m.material as THREE.MeshBasicMaterial;
      const r = g.r * S;
      s.m.visible = true; s.m.position.set(g.x * S, FLOOR + 0.02 + ti * 0.0004, g.y * S);
      if (g.shape === 'cone') {
        const map = coneOf(kind, g.arc / 2);
        if (mat.map !== map) { mat.map = map; mat.needsUpdate = true; }
        s.m.scale.set(r * 2 * (256 / 248), r * 2 * (256 / 248), 1);
        s.m.rotation.z = -g.angle;
        s.fill.visible = false;
      } else {
        const map = telTex[kind];
        if (mat.map !== map) { mat.map = map; mat.needsUpdate = true; }
        s.m.scale.set(r * 2 * (256 / 240), r * 2 * (256 / 240), 1);
        s.m.rotation.z = 0;
        const fm = s.fill.material as THREE.MeshBasicMaterial;
        if (fm.map !== fillTex[kind]) { fm.map = fillTex[kind]; fm.needsUpdate = true; }
        s.fill.visible = true; s.fill.position.set(g.x * S, FLOOR + 0.024 + ti * 0.0004, g.y * S); s.fill.scale.setScalar(Math.max(0.001, r * prog));
      }
      mat.opacity = 0.82 + 0.18 * Math.sin(t * 6 + ti);
    }
    for (let i = ti; i < tels.length; i++) { tels[i].m.visible = false; tels[i].fill.visible = false; }

    // Decrees (the Flue).
    const ds = w.regentDecree ?? [];
    let di = 0;
    for (const d of ds) {
      const q = w.heroData(d.hero).player;
      const x = L(q.px, q.x) * S, z = L(q.py, q.y) * S;
      const o = decree(di++);
      o.ring.visible = o.crown.visible = true;
      o.ring.position.set(x, FLOOR + 0.035, z); o.ring.scale.setScalar(70 * S);
      o.crown.position.set(x, FLOOR + 1.35 + Math.sin(t * 4) * 0.04, z); o.crown.rotation.set(Math.PI, t * 2, 0);
    }
    for (let i = di; i < decrees.length; i++) { decrees[i].ring.visible = false; decrees[i].crown.visible = false; }

    // Bolts, gems, drops, strikes, zones.
    let n = 0;
    for (const o of w.orbs) if (o.alive && n < 256) place(bolts, n++, L(o.px, o.x) * S, FLOOR + 0.55, L(o.py, o.y) * S, 1);
    bolts.count = n; bolts.instanceMatrix.needsUpdate = true;
    n = 0;
    for (const g of w.gems) if (g.alive && n < 512) place(gems, n++, L(g.px, g.x) * S, FLOOR + 0.12 + Math.sin(t * 3 + g.x) * 0.03, L(g.py, g.y) * S, 1);
    gems.count = n; gems.instanceMatrix.needsUpdate = true;
    n = 0;
    for (const d of w.drops) if (d.alive && n < 64) place(drops, n++, d.x * S, FLOOR + 0.25 + Math.sin(t * 2.5 + d.x) * 0.05, d.y * S, 1);
    drops.count = n; drops.instanceMatrix.needsUpdate = true;
    n = 0;
    for (const s of w.strikes) if (s.alive && n < 128) place(strikes, n++, s.x * S, FLOOR + 0.04, s.y * S, Math.max(0.05, s.r * S));
    strikes.count = n; strikes.instanceMatrix.needsUpdate = true;
    n = 0;
    for (const z of w.zones) if (z.alive && n < 64) place(zones, n++, z.x * S, FLOOR + 0.015, z.y * S, z.r * S);
    zones.count = n; zones.instanceMatrix.needsUpdate = true;

    // Room life.
    for (const f of flick) f.l.intensity = f.base * (0.84 + 0.1 * Math.sin(t * 7 * f.speed + f.seed) + 0.06 * Math.sin(t * 17 * f.speed + f.seed * 2));
    flames.forEach((fl, i) => fl.scale.set(1, 0.85 + 0.25 * Math.abs(Math.sin(t * 9 + i * 1.7)), 1));
    for (let i = 0; i < N; i++) {
      pos[i * 3 + 1] += vel[i] * dt; pos[i * 3] += Math.sin(t * 0.8 + i) * dt * 0.25;
      if (pos[i * 3 + 1] > 6) spawn(i, cx, cz, false);
    }
    pgeo.attributes.position.needsUpdate = true;

    // The camera follows the hero like the 2D camera, at the handoff's angle; the sun's shadow box follows too.
    const look = v3.set(cx, 0, cz - 0.9);
    camera.position.copy(camDir).multiplyScalar(dist).add(look);
    camera.lookAt(look);
    key.position.set(cx - 7, 14, cz - 3); key.target.position.set(cx, 0, cz);
    lamp.position.set(cx, 2.4, cz + 0.6);

    const t0 = performance.now();
    if (composer) composer.render(); else renderer.render(scene, camera);
    times.push(performance.now() - t0); if (times.length > 60) times.shift();
  };

  return {
    frame,
    destroy() {
      // Frees this run's meshes and canvases; the renderer (and its compiled shaders) stays for the next run.
      const seen = new Set<object>();
      const free = (o: { dispose?: () => void } | null | undefined) => { if (o && !seen.has(o)) { seen.add(o); o.dispose?.(); } };
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        free(m.geometry);
        for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as (THREE.Material & { map?: THREE.Texture; emissiveMap?: THREE.Texture })[]) {
          if (!mat) continue;
          free(mat.map); free(mat.emissiveMap); free(mat);
        }
      });
      for (const t of coneTex.values()) free(t);
      for (const t of [telTex.hit, telTex.soak, fillTex.hit, fillTex.soak]) free(t);
      composer?.dispose();
      renderer.renderLists.dispose();
      cv.remove();
      shade.remove();
    },
    project(x, y) {
      const p = pv.set(x * S, FLOOR, y * S).project(camera);
      if (p.z > 1 || !W || !H) return null;
      return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H };
    },
    stats() {
      const ms = times.length ? times.reduce((x, y) => x + y, 0) / times.length : 0;
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, ms: +ms.toFixed(2), fx, pixelRatio: pr, attacks };
    },
  };
}
