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
 * Foe health and cast bars, foe names and damage numbers are drawn by the 2D scene on the overlay canvas over this view,
 * at each foe's projected place (GameScene drawLabels3d, #540).
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
import type { RoomSound } from '../audio/cues';
import type { World } from '../../sim/world';
import { SIM } from './simconsts';
import { buildHalls3d, type HallsView } from './halls3d';
import { buildKm3d, makeKmBellows } from './kilnmother3d';
import type { HallsMap } from '../../sim/halls';

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
/** How far (world units) your own hero's sprite is drawn toward the camera, so nothing standing next to you covers it. */
const SELF_LIFT = 1.6;
const BALLAST_PLANT = SIM.ballastPlant;
const LAMPEYE_FULL = SIM.lampeyeFull;
const DIMHORN_CALL = SIM.dimhornCall;

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
/** The Foundry's pit: dark water with caustic ripples (the 2D drawWater in client/textures.ts), foam at the edge. */
function waterCanvas() {
  const c = mk(512, 512), k = c.getContext('2d')!;
  k.fillStyle = '#06161a'; k.fillRect(0, 0, 512, 512);
  const g = k.createRadialGradient(256, 256, 150, 256, 256, 256);
  g.addColorStop(0, 'rgba(10,40,48,0)'); g.addColorStop(0.8, 'rgba(18,70,80,.6)'); g.addColorStop(1, 'rgba(80,190,200,.9)');
  k.fillStyle = g; k.fillRect(0, 0, 512, 512); k.lineCap = 'round';
  for (let i = 0; i < 90; i++) {
    const a = rnd(0, Math.PI * 2), r0 = rnd(0.6, 0.97) * 256, w = rnd(0.05, 0.16);
    k.strokeStyle = `rgba(120,220,235,${rnd(0.12, 0.4)})`; k.lineWidth = rnd(1.2, 3);
    k.beginPath(); k.arc(256, 256, r0, a, a + w); k.stroke();
  }
  return c;
}
/** The Coldmarrow's pit: dark blue ice with pale crack lines and frost at the edge. */
function iceCanvas() {
  const c = mk(512, 512), k = c.getContext('2d')!;
  k.fillStyle = '#0a1424'; k.fillRect(0, 0, 512, 512);
  const g = k.createRadialGradient(256, 256, 150, 256, 256, 256);
  g.addColorStop(0, 'rgba(30,60,100,0)'); g.addColorStop(0.8, 'rgba(70,120,180,.55)'); g.addColorStop(1, 'rgba(200,230,255,.9)');
  k.fillStyle = g; k.fillRect(0, 0, 512, 512); k.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    let a = rnd(0, Math.PI * 2), r = rnd(0.6, 0.95) * 256; k.strokeStyle = `rgba(210,235,255,${rnd(0.2, 0.55)})`; k.lineWidth = rnd(0.8, 2);
    k.beginPath(); k.moveTo(256 + Math.cos(a) * r, 256 + Math.sin(a) * r);
    for (let n = 0; n < 4; n++) { a += rnd(-0.08, 0.08); r += rnd(-18, 18); k.lineTo(256 + Math.cos(a) * r, 256 + Math.sin(a) * r); }
    k.stroke();
  }
  return c;
}
/** The Wrackline's floor: grey-green harbour water with pale ripples; tiles seamlessly. */
function harbourCanvas() {
  const s = 256, c = mk(s, s), k = c.getContext('2d')!;
  k.fillStyle = '#5a7a72'; k.fillRect(0, 0, s, s); k.lineCap = 'round';
  for (let i = 0; i < 30; i++) {
    const x = rnd(0, s), y = rnd(0, s), w = rnd(14, 40), a = rnd(0.08, 0.24);
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
      k.strokeStyle = `rgba(190,230,220,${a})`; k.lineWidth = 1.5;
      k.beginPath(); k.moveTo(x + ox - w / 2, y + oy); k.quadraticCurveTo(x + ox, y + oy - 4, x + ox + w / 2, y + oy); k.stroke();
    }
  }
  return c;
}
/** The Glarewell's pit: a dark indigo void with a scatter of pale stars, lit faintly gold at its rim. */
function voidCanvas() {
  const c = mk(512, 512), k = c.getContext('2d')!;
  k.fillStyle = '#03020a'; k.fillRect(0, 0, 512, 512);
  const g = k.createRadialGradient(256, 256, 160, 256, 256, 256);
  g.addColorStop(0, 'rgba(20,14,50,0)'); g.addColorStop(0.85, 'rgba(40,30,90,.5)'); g.addColorStop(1, 'rgba(230,200,130,.75)');
  k.fillStyle = g; k.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 220; i++) { const a = rnd(0, Math.PI * 2), r = rnd(0.6, 0.97) * 256; k.fillStyle = `rgba(${rnd(200, 255) | 0},${rnd(200, 240) | 0},255,${rnd(0.3, 0.9)})`; k.fillRect(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, rnd(1, 2.6), rnd(1, 2.6)); }
  return c;
}
/** The Glarewell's curb: pale worn stone with a thin gold seam. */
function paleRimCanvas() {
  const c = mk(256, 256), k = c.getContext('2d')!;
  k.fillStyle = '#4a4466'; k.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 200; i++) { k.fillStyle = Math.random() < 0.3 ? `rgba(255,226,150,${rnd(0.2, 0.6)})` : `rgba(10,8,24,${rnd(0.3, 0.7)})`; k.beginPath(); k.arc(rnd(0, 256), rnd(0, 256), rnd(2, 9), 0, 7); k.fill(); }
  return c;
}
/** The Foundry's curb edge: wet dark stone with verdigris and foam. */
function wetRimCanvas() {
  const c = mk(256, 256), k = c.getContext('2d')!;
  k.fillStyle = '#1e3836'; k.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) { k.fillStyle = Math.random() < 0.45 ? `rgba(${rnd(140, 200) | 0},235,230,${rnd(0.2, 0.6)})` : `rgba(4,12,12,${rnd(0.3, 0.8)})`; k.beginPath(); k.arc(rnd(0, 256), rnd(0, 256), rnd(3, 12), 0, 7); k.fill(); }
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
/**
 * The room kit (plan step 4): one shared shell (tiles, pit, curb, wall, sconces, rubble) and each dungeon's own
 * look on top. Dungeons without a room of their own yet use the Flue's.
 * - flue: chimneys, the Regent's throne, red banners, a brass inlay, barrels and crates.
 * - foundry: the Drowned Foundry. Dark water instead of lava, wet slate, three brass boilers with sea-glass
 *   gauges and pipes at the back, teal lamps, cool light with the forge's warmth only at the front.
 * - hammerdeep: cold forge iron, three great anvils at the back (a giant hammer resting by the middle one),
 *   a banked slag pit, pale lanterns and cool light.
 * - glarewell: a sunken observatory. Cool slate floor (the 2D floor's tint), a starry void round it instead of
 *   lava, a great lens in a brass ring high at the back, crystal shards, pale gold light from above.
 * - ashvents: pale ash floor, three smoking fumaroles at the back, ash cairns, rose embers.
 * - crucible: rosy slag-stone, a giant tilted ladle pouring a molten stream at the back, slag pots, a bright pit.
 * - hoard: dark bone-stone, Old Vorhulm's great mound of gold and bones at the back, a coal-red pit, coin heaps.
 * - coldmarrow: frozen slate, a frozen pit, ice-crusted stone arches hung with icicles, cold dim light (its
 *   Hearthcoals' warm pools are a mechanic, drawn by the 2D floor through the bridge).
 * - pressworks: oily olive brass, three press frames with their rams at the back, stacks of pressed plates.
 * - smeltery: sooty blue-grey cast iron, a great furnace mouth and ore carts on a rail at the back, ingot stacks.
 * - wrackline: no tiles. The floor is grey-green harbour water (the 2D floor's 0x6e8a80), and the rafts and
 *   the Whirl ride on it through the floor bridge. A wrecked hull and mooring posts at the back, grey sea light.
 * - kiln: the Kiln Depths, a potters' firing hall. Three brick beehive kilns with glowing mouths at the back,
 *   firebrick floor, pots and urns on shelves, stacked firewood, brick piers, a soot ring instead of brass.
 */
export type RoomId = 'flue' | 'kiln' | 'foundry' | 'hammerdeep' | 'glarewell' | 'ashvents' | 'crucible' | 'hoard' | 'coldmarrow' | 'pressworks' | 'smeltery' | 'wrackline';
interface RoomTheme {
  tile: string; wall: string; ground: string;
  /** Hemisphere sky and ground colours and intensity, the key light colour, the hero lamp colour. */
  hemi: [string, string, number]; key: string; lamp: string;
  /** The two shared warm lights: back wall and front. */
  backLight: string; frontLight: string;
  /** Scene background and fog colour; the rising motes' colour (HDR); the pit; the lamps' flame; tile wetness. */
  bg: string; fog: string; mote: [number, number, number]; pit: 'lava' | 'water' | 'void' | 'ice'; flame: 'fire' | 'teal' | 'pale'; rough: number;
  /** How bright the pit glows (the lava's colour multiplier). */
  pitGlow: number;
  /** Optional per-channel tint on the lava (the Hoard's coal red). */
  pitTint?: [number, number, number];
}
const ROOMS: Record<RoomId, RoomTheme> = {
  flue: { tile: '#6a5548', wall: '#ffffff', ground: '#1a100c', hemi: ['#c09a8a', '#3a2418', 1.25], key: '#ffd0a8', lamp: '#ffb27a', backLight: '#ff7a30', frontLight: '#ff8a3d', bg: '#0a0504', fog: '#120705', mote: [3, 1.35, 0.45], pit: 'lava', flame: 'fire', rough: 0.88, pitGlow: 0.8 },
  // Firebrick: warmer and redder than the Flue's ash-brown stone, as the 2D Kiln's furnaces (client/textures.ts kilnFurnace).
  kiln: { tile: '#7c4c3a', wall: '#e8b8a0', ground: '#1e0f0a', hemi: ['#d0a088', '#40200f', 1.3], key: '#ffc898', lamp: '#ffac70', backLight: '#ff6a24', frontLight: '#ff8a40', bg: '#0a0504', fog: '#140705', mote: [3, 1.35, 0.45], pit: 'lava', flame: 'fire', rough: 0.88, pitGlow: 0.8 },
  // Wet slate and verdigris, lit cool from above, the boilers' gauges teal (client/textures.ts foundryBoiler).
  foundry: { tile: '#4e5a58', wall: '#9cb4ae', ground: '#0a1414', hemi: ['#9fc4c8', '#1c2e2e', 1.45], key: '#d8ecf4', lamp: '#ffd6a8', backLight: '#3ad8bc', frontLight: '#ffa868', bg: '#040a0b', fog: '#071214', mote: [0.9, 2.2, 2.0], pit: 'water', flame: 'teal', rough: 0.42, pitGlow: 0.8 },
  // Cold forge iron, grey-violet (the 2D floor's 0x9c98a8 tint), a banked slag pit, pale lanterns: the red telegraphs read hot on it.
  // Cool slate (the 2D floor's 0xa49ccc tint) under pale gold from the great lens; indigo where it doesn't reach.
  glarewell: { tile: '#5c5874', wall: '#9a94c4', ground: '#07060d', hemi: ['#c8c0f0', '#1a1630', 1.4], key: '#ffe6b0', lamp: '#ffe2a8', backLight: '#ffd890', frontLight: '#9a8cff', bg: '#05040a', fog: '#0a0818', mote: [2.4, 2.1, 1.1], pit: 'void', flame: 'pale', rough: 0.6, pitGlow: 0.8 },
  // Pale ash (the 2D floor's 0xb8a49a tint), gold vents and rose embers.
  ashvents: { tile: '#a89a92', wall: '#c4aaa2', ground: '#141010', hemi: ['#f0dcd4', '#3a2420', 1.45], key: '#ffdcc4', lamp: '#ffb890', backLight: '#ff7058', frontLight: '#ffb060', bg: '#0a0606', fog: '#170c0a', mote: [3, 1.15, 1.05], pit: 'lava', flame: 'fire', rough: 0.95, pitGlow: 0.8 },
  // Rosy slag-stone (the 2D floor's 0xb88a7c tint) round a molten pit (MOLTEN 0xff6a1f).
  crucible: { tile: '#8a6458', wall: '#d8a898', ground: '#160c08', hemi: ['#f0c4b0', '#3a1c10', 1.35], key: '#ffd4b0', lamp: '#ffb27a', backLight: '#ff6a1f', frontLight: '#ff9a48', bg: '#0b0503', fog: '#180904', mote: [3.2, 1.3, 0.4], pit: 'lava', flame: 'fire', rough: 0.8, pitGlow: 1.0 },
  // Dark bone-stone (the 2D floor's 0x70584e tint), a coal-red pit (HOARD_RIM 0xd8382a), gold everywhere.
  hoard: { tile: '#5e4a42', wall: '#a88a80', ground: '#100806', hemi: ['#d8b8a8', '#2a1410', 1.4], key: '#ffe0b8', lamp: '#ffc88a', backLight: '#e09040', frontLight: '#ff6a48', bg: '#080403', fog: '#120605', mote: [3, 1.0, 0.7], pit: 'lava', flame: 'fire', rough: 0.85, pitGlow: 0.75, pitTint: [1.1, 0.55, 0.5] },
  // Frozen slate (COLD_FLOOR 0x7e98c4), a frozen pit, dim and cold: the Hearthcoals' warmth should be the light that matters.
  coldmarrow: { tile: '#5c6c88', wall: '#a8bcd8', ground: '#070a10', hemi: ['#b8d0f0', '#141c2c', 1.2], key: '#d8e8ff', lamp: '#ffc890', backLight: '#8ab8ff', frontLight: '#ffb070', bg: '#04060a', fog: '#0a0e18', mote: [1.8, 2.2, 2.8], pit: 'ice', flame: 'pale', rough: 0.3, pitGlow: 0.8 },
  // Oily olive brass (0x9aa070), the gold Downstroke plate and red Rivets read on it.
  pressworks: { tile: '#6a6e4c', wall: '#bab890', ground: '#0e0e08', hemi: ['#e0dcb0', '#262414', 1.35], key: '#fff0c8', lamp: '#ffd090', backLight: '#ffb050', frontLight: '#ff9a48', bg: '#080806', fog: '#12110a', mote: [2.8, 2.2, 0.9], pit: 'lava', flame: 'fire', rough: 0.5, pitGlow: 0.7 },
  // Sooty blue-grey cast iron (0x606878), so the Colossus's hot back and the Sweep read warm.
  smeltery: { tile: '#4e5462', wall: '#9aa0b0', ground: '#0a0b0e', hemi: ['#c0c8d8', '#1c1e26', 1.35], key: '#e8ecf8', lamp: '#ffc890', backLight: '#ff7a2a', frontLight: '#ffa050', bg: '#060608', fog: '#0e0f14', mote: [3, 1.4, 0.5], pit: 'lava', flame: 'fire', rough: 0.6, pitGlow: 0.9 },
  // Grey-green harbour water (0x6e8a80) for a floor, so the pale rafts and the drain read on it.
  wrackline: { tile: '#4a6a62', wall: '#98aca4', ground: '#081010', hemi: ['#c0d4d0', '#18262a', 1.4], key: '#e4f0f0', lamp: '#ffd8b0', backLight: '#9ad0d0', frontLight: '#ffb070', bg: '#050909', fog: '#0a1414', mote: [1.6, 2.2, 2.1], pit: 'water', flame: 'fire', rough: 0.3, pitGlow: 0.8 },
  hammerdeep: { tile: '#5c5a66', wall: '#aaa6ba', ground: '#0e0d12', hemi: ['#bcbcd4', '#24222c', 1.4], key: '#e6e6f6', lamp: '#ffd2a0', backLight: '#c4ccff', frontLight: '#ff9a58', bg: '#070709', fog: '#0d0c12', mote: [1.5, 1.6, 2.2], pit: 'lava', flame: 'pale', rough: 0.55, pitGlow: 0.42 },
};
/** Which room a dungeon gets. */
const OWN_ROOMS: readonly string[] = ['kiln', 'foundry', 'hammerdeep', 'glarewell', 'ashvents', 'crucible', 'hoard', 'coldmarrow', 'pressworks', 'smeltery', 'wrackline'];
export const roomOf = (dungeonId: string | undefined): RoomId => (dungeonId && OWN_ROOMS.includes(dungeonId) ? (dungeonId as RoomId) : 'flue');

/**
 * A flame's colour up a cone (ConeGeometry's v runs 0 at the base to 1 at the tip): gold at the base to deep
 * orange at the tip. A flat colour read as one pale blob once bloom spread it (mobile's 568x320 check, 23 Nov).
 */
function flameCanvas(kind: 'fire' | 'teal' | 'pale' = 'fire') {
  const c = mk(8, 64), k = c.getContext('2d')!, g = k.createLinearGradient(0, 64, 0, 0);
  // The Foundry's lamps burn sea-glass teal, like its boilers' gauges.
  // Hammerdeep's lanterns burn pale, cold white-blue (client/textures.ts deepLantern, paleLight).
  if (kind === 'pale') { g.addColorStop(0, '#f4f6ff'); g.addColorStop(0.35, '#b8c4f0'); g.addColorStop(0.75, '#5a64a0'); g.addColorStop(1, '#1e2244'); }
  else if (kind === 'teal') { g.addColorStop(0, '#d8fff4'); g.addColorStop(0.35, '#4fe3c1'); g.addColorStop(0.75, '#178a7c'); g.addColorStop(1, '#063a36'); }
  else { g.addColorStop(0, '#ffd27a'); g.addColorStop(0.35, '#ff9a3a'); g.addColorStop(0.75, '#d8480e'); g.addColorStop(1, '#7a1a04'); }
  k.fillStyle = g; k.fillRect(0, 0, 8, 64); return c;
}

/** A beehive kiln's mouth: an arch of fire, white-gold at the heart (colours stay under 1, so bloom gives the glow). */
function archCanvas() {
  const c = mk(128, 160), k = c.getContext('2d')!;
  k.beginPath(); k.moveTo(14, 160); k.lineTo(14, 70); k.arc(64, 70, 50, Math.PI, 0); k.lineTo(114, 160); k.closePath();
  const g = k.createRadialGradient(64, 130, 6, 64, 110, 96);
  g.addColorStop(0, '#fff0b8'); g.addColorStop(0.35, '#ffa040'); g.addColorStop(0.8, '#b8380c'); g.addColorStop(1, '#5a1404');
  k.fillStyle = g; k.fill();
  // Licks of flame rising from the floor of the mouth.
  k.fillStyle = 'rgba(255,236,170,0.75)';
  for (const [x, h] of [[44, 54], [64, 72], [86, 50]]) { k.beginPath(); k.moveTo(x - 9, 160); k.quadraticCurveTo(x - 6, 160 - h * 0.6, x, 160 - h); k.quadraticCurveTo(x + 6, 160 - h * 0.6, x + 9, 160); k.fill(); }
  return c;
}

function buildRoom(scene: THREE.Scene, saver: boolean, addLight: (c: string, i: number, d: number, p: THREE.Vector3, s?: number) => void, id: RoomId = 'flue') {
  const th = ROOMS[id];
  const glows: THREE.MeshBasicMaterial[] = [];
  /** The Kiln's centre kiln mouth, which flares while the three-stage Kiln Mother is inside it. */
  let kilnMouth: THREE.MeshBasicMaterial | null = null;
  /** Textures whose offset drifts each frame (the Wrackline's water). */
  const drift: THREE.Texture[] = [];
  const room = new THREE.Group(); scene.add(room);
  const grain = canvasTex(grainCanvas(), { repeat: [1, 1] });
  const tileMat = new THREE.MeshStandardMaterial({ map: grain, roughness: th.rough, metalness: id === 'foundry' ? 0.12 : id === 'hammerdeep' ? 0.35 : 0.02 });
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
    col.set(th.tile).multiplyScalar(rnd(0.78, 1.08) * (d > 6 ? 0.85 : 1)); tiles.setColorAt(i, col);
  });
  tiles.receiveShadow = true;
  if (id === 'wrackline') {
    // The Wrackline's floor is water: a sheet of harbour at floor height, its ripples drifting (frame()).
    const hw = canvasTex(harbourCanvas(), { repeat: [7, 7] });
    const sea = new THREE.Mesh(new THREE.CircleGeometry(ROOM_R + 0.3, 64), new THREE.MeshStandardMaterial({ map: hw, color: '#d8ece6', roughness: th.rough, metalness: 0.05 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = FLOOR - 0.01; sea.receiveShadow = true; sea.userData.drift = hw; room.add(sea);
    drift.push(hw);
  } else room.add(tiles);
  const lava = new THREE.Mesh(new THREE.CircleGeometry(7.7, 64), new THREE.MeshBasicMaterial({ map: canvasTex(th.pit === 'water' ? waterCanvas() : th.pit === 'void' ? voidCanvas() : th.pit === 'ice' ? iceCanvas() : lavaCanvas()), color: new THREE.Color(...(th.pitTint ?? [1, 1, 1])).multiplyScalar(th.pitGlow) }));
  lava.rotation.x = -Math.PI / 2; lava.position.y = -0.1; room.add(lava);
  const rim = new THREE.Mesh(new THREE.RingGeometry(7.55, 8.3, 96, 1), new THREE.MeshBasicMaterial({ map: canvasTex(th.pit === 'water' ? wetRimCanvas() : th.pit === 'void' || th.pit === 'ice' ? paleRimCanvas() : rimCanvas(), { repeat: [12, 1] }), color: th.pit === 'lava' ? new THREE.Color(...(th.pitTint ?? [1, 1, 1])).multiplyScalar(1.5 * th.pitGlow) : new THREE.Color().setScalar(0.9) }));
  rim.rotation.x = -Math.PI / 2; rim.position.y = -0.12; room.add(rim);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: th.ground, roughness: 1 }));
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
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(10.6, 10.6, 11, 72, 1, true), new THREE.MeshStandardMaterial({ map: canvasTex(brick, { repeat: [28, 5] }), color: th.wall, roughness: 0.92, side: THREE.BackSide }));
  wall.position.y = 5.2; wall.receiveShadow = true; room.add(wall);
  // Dimmer than the handoff's (3.2, 1.25, 0.35): at the brighter exposure, colours over about 1.2 tone-map to white.
  const chimMouth = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.42, 0.1) });
  const chimInner = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 0.6, 0.18) });
  const iron = new THREE.MeshStandardMaterial({ color: '#2b2526', roughness: 0.5, metalness: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c99a3e', roughness: 0.35, metalness: 0.85 });
  if (id === 'flue') {
    for (const [a, w] of [[Math.PI, 3.4], [Math.PI - 0.78, 2.2], [Math.PI + 0.78, 2.2]] as const) {
      const g = new THREE.Group(); g.position.set(Math.sin(a) * 9.7, 0, Math.cos(a) * 9.7); g.lookAt(0, 0, 0);
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, 13, 1.9), new THREE.MeshStandardMaterial({ map: canvasTex(brick, { repeat: [w / 1.5, 7] }), roughness: 0.9 }));
      body.position.y = 6.2; body.castShadow = body.receiveShadow = true; g.add(body);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.4, 2.2), basalt); cap.position.set(0, 2.4, 0.1); g.add(cap);
      const mouth = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, 1.7), chimMouth); mouth.position.set(0, 1.1, 0.96); g.add(mouth);
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.36, 0.9), chimInner); inner.position.set(0, 0.8, 0.97); g.add(inner);
      room.add(g);
    }
    // The throne stands outside the floor, against the back wall, so it never hides a fight.
    const throne = new THREE.Group(); throne.position.set(0, FLOOR, -9.1);
    const tb = new THREE.Mesh(new THREE.BoxGeometry(3.0, 4.2, 0.6), iron); tb.position.y = 2.1; throne.add(tb);
    const tt = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.3, 0.8), brass); tt.position.y = 4.25; throne.add(tt);
    for (const x of [-1.55, 1.55]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 4.6, 8), brass); p.position.set(x, 2.3, 0.15); throne.add(p);
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 8), chimInner); f.position.set(x, 4.9, 0.15); throne.add(f);
    }
    throne.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true; }); room.add(throne);
  } else if (id === 'glarewell') {
    // The great lens, high at the back in a brass ring on two arms, glowing pale gold (the light that burns),
    // and two brass telescopes trained on it. Outside the floor.
    const brassG = new THREE.MeshStandardMaterial({ color: '#b8904a', roughness: 0.3, metalness: 0.9 });
    const lg = new THREE.Group(); lg.position.set(0, 6.2, -9.6); lg.rotation.x = 0.35;
    const lensMat = new THREE.MeshBasicMaterial({ map: canvasTex(dotCanvas('rgba(255,246,214,1)', 'rgba(220,170,90,0.75)')), transparent: true }); lensMat.userData.base = lensMat.color.clone(); glows.push(lensMat);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40), lensMat); lg.add(lens);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.18, 10, 48), brassG); lg.add(ring);
    for (const x of [-2.6, 2.6]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 7, 0.22), brassG); arm.position.set(x, -3.3, -0.3); lg.add(arm); }
    room.add(lg);
    for (const a of [Math.PI - 0.75, Math.PI + 0.75]) {
      const g = new THREE.Group(); g.position.set(Math.sin(a) * 9.6, 0, Math.cos(a) * 9.6); g.lookAt(0, 0, 0);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 2.6, 8), brassG); leg.position.y = 1.3; g.add(leg);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 3.2, 14), brassG); tube.position.set(0, 2.9, 0.2); tube.rotation.x = -0.9; tube.rotation.z = a > Math.PI ? -0.5 : 0.5; g.add(tube);
      g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true; });
      room.add(g);
    }
  } else if (id === 'ashvents') {
    // Three fumaroles: ash-rock cones with a gold vent glowing in each crater and smoke rising into the dark.
    const ashRock = new THREE.MeshStandardMaterial({ color: '#6a5a54', roughness: 0.95, map: grain });
    const smoke = new THREE.MeshBasicMaterial({ map: canvasTex(dotCanvas('rgba(120,100,96,0.5)', 'rgba(120,100,96,0)')), transparent: true, depthWrite: false });
    for (const [a, r] of [[Math.PI, 2.2], [Math.PI - 0.8, 1.6], [Math.PI + 0.8, 1.6]] as const) {
      const g = new THREE.Group(); g.position.set(Math.sin(a) * 9.5, 0, Math.cos(a) * 9.5); g.lookAt(0, 0, 0);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.32, r, r * 1.5, 9, 1), ashRock); cone.position.y = r * 0.75 - 0.1; g.add(cone);
      const vm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.7, 0.3) }); vm.userData.base = vm.color.clone(); glows.push(vm);
      const vent = new THREE.Mesh(new THREE.CircleGeometry(r * 0.26, 12), vm); vent.rotation.x = -Math.PI / 2; vent.position.y = r * 1.5 - 0.09; g.add(vent);
      for (let j = 0; j < 3; j++) { const puff = new THREE.Mesh(new THREE.PlaneGeometry(r * (1 + j * 0.5), r * (1 + j * 0.5)), smoke); puff.position.y = r * 1.5 + 0.8 + j * 1.3; g.add(puff); }
      cone.castShadow = cone.receiveShadow = true;
      room.add(g);
    }
  } else if (id === 'crucible') {
    // A giant ladle tilted on a frame at the back, pouring a molten stream into the pit, with two great
    // crucibles banked either side, glowing at the lip. Outside the floor.
    const ironC = new THREE.MeshStandardMaterial({ color: '#3a302c', roughness: 0.55, metalness: 0.7 });
    const molten = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 0.5, 0.14) }); molten.userData.base = molten.color.clone(); glows.push(molten);
    const lg = new THREE.Group(); lg.position.set(0, 0, -9.3);
    for (const x of [-2.4, 2.4]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 0.4), ironC); post.position.set(x, 3, 0); lg.add(post); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.4, 0.4), ironC); beam.position.y = 6; lg.add(beam);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), ironC); bowl.position.set(0, 4.2, 0); bowl.rotation.x = -0.7; lg.add(bowl);
    const melt = new THREE.Mesh(new THREE.CircleGeometry(1.42, 20), molten); melt.position.set(0, 4.2, 0); melt.rotation.x = -Math.PI / 2 - 0.7; lg.add(melt);
    const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 4.4, 8), molten); stream.position.set(0, 2.0, 1.25); lg.add(stream);
    lg.traverse((o) => { if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).material !== molten) o.castShadow = o.receiveShadow = true; });
    room.add(lg);
    for (const a of [Math.PI - 0.8, Math.PI + 0.8]) {
      const g = new THREE.Group(); g.position.set(Math.sin(a) * 9.5, 0, Math.cos(a) * 9.5);
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 0.9, 2.2, 16), ironC); pot.position.y = 1.0; g.add(pot);
      const lip = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), molten); lip.rotation.x = -Math.PI / 2; lip.position.y = 2.05; g.add(lip);
      pot.castShadow = pot.receiveShadow = true;
      room.add(g);
    }
  } else if (id === 'hoard') {
    // Old Vorhulm's hoard: a great mound of gold at the back with bones and a few ribs sticking out of it, two
    // smaller heaps beside it. Outside the floor.
    const gold = new THREE.MeshStandardMaterial({ color: '#c09038', roughness: 0.5, metalness: 0.65, emissive: new THREE.Color('#140a02') });
    const bone = new THREE.MeshStandardMaterial({ color: '#d8ccb4', roughness: 0.8 });
    for (const [a, r] of [[Math.PI, 3.4], [Math.PI - 0.85, 2.0], [Math.PI + 0.85, 2.0]] as const) {
      const mound = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold);
      mound.scale.y = 0.55; mound.position.set(Math.sin(a) * (9.4 + r * 0.25), -0.1, Math.cos(a) * (9.4 + r * 0.25)); mound.castShadow = mound.receiveShadow = true; room.add(mound);
    }
    // A ribcage half-buried in the big mound: arcs of bone, one draw call.
    const ribs = new THREE.InstancedMesh(new THREE.TorusGeometry(0.9, 0.07, 6, 16, Math.PI), bone, 8);
    for (let k = 0; k < 8; k++) {
      const a = Math.PI + (k - 3.5) * 0.11; e.set(0.25, a + Math.PI / 2, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(Math.sin(a) * 10.4, 1.25 - Math.abs(k - 3.5) * 0.09, Math.cos(a) * 10.4), q, one); ribs.setMatrixAt(k, m4);
    }
    ribs.castShadow = true; room.add(ribs);
  } else if (id === 'coldmarrow') {
    // Three ice-crusted stone arches against the back wall (coldArch), hung with icicles, frost on their caps.
    const frostStone = new THREE.MeshStandardMaterial({ color: '#8aa0c0', roughness: 0.35, metalness: 0.1 });
    const ice = new THREE.MeshStandardMaterial({ color: '#d8ecff', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.85, emissive: new THREE.Color('#182a44') });
    const icicles = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 1, 6), ice, 36);
    let ni = 0;
    for (const [a, w] of [[Math.PI, 3.2], [Math.PI - 0.8, 2.2], [Math.PI + 0.8, 2.2]] as const) {
      const g = new THREE.Group(); g.position.set(Math.sin(a) * 9.6, 0, Math.cos(a) * 9.6); g.lookAt(0, 0, 0);
      for (const x of [-w / 2, w / 2]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.6, 0.8), frostStone); leg.position.set(x, 1.8, 0); g.add(leg); }
      const arc = new THREE.Mesh(new THREE.TorusGeometry(w / 2, 0.36, 8, 20, Math.PI), frostStone); arc.position.y = 3.6; g.add(arc);
      const cap = new THREE.Mesh(new THREE.TorusGeometry(w / 2, 0.2, 6, 20, Math.PI), ice); cap.position.set(0, 3.82, 0.05); g.add(cap);
      g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true; });
      room.add(g);
      for (let j = 0; j < 12 && ni < 36; j++) {
        const t = (j + 0.5) / 12 * Math.PI, lx = Math.cos(t) * w / 2, ly = 3.6 + Math.sin(t) * (w / 2) - 0.45, len = 0.4 + ((j * 7) % 5) * 0.15;
        const wx = Math.sin(a) * 9.6 + Math.cos(a) * lx, wz = Math.cos(a) * 9.6 - Math.sin(a) * lx;
        e.set(Math.PI, 0, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(wx, ly - len / 2 + 0.2, wz), q, new THREE.Vector3(1, len, 1)); icicles.setMatrixAt(ni++, m4);
      }
    }
    icicles.count = ni; room.add(icicles);
  } else if (id === 'pressworks') {
    // Three press frames against the back wall (pressFrame): two iron posts, a crown beam, a ram hanging from it
    // over a brass bed. Outside the floor.
    const ironP = new THREE.MeshStandardMaterial({ color: '#3c3e34', roughness: 0.5, metalness: 0.7 });
    const brassP = new THREE.MeshStandardMaterial({ color: '#b09a50', roughness: 0.4, metalness: 0.85 });
    for (const [a, w] of [[Math.PI, 3.0], [Math.PI - 0.8, 2.2], [Math.PI + 0.8, 2.2]] as const) {
      const g = new THREE.Group(); g.position.set(Math.sin(a) * 9.5, 0, Math.cos(a) * 9.5); g.lookAt(0, 0, 0);
      for (const x of [-w / 2, w / 2]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 5.2, 0.6), ironP); post.position.set(x, 2.6, 0); g.add(post); }
      const crown = new THREE.Mesh(new THREE.BoxGeometry(w + 0.9, 0.7, 0.9), ironP); crown.position.y = 5.3; g.add(crown);
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.8, 8), brassP); screw.position.y = 4.1; g.add(screw);
      const ram = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.9, 0.8), ironP); ram.position.y = 2.9; g.add(ram);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, 0.6, 1.0), brassP); bed.position.y = 0.3; g.add(bed);
      g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true; });
      room.add(g);
    }
  } else if (id === 'smeltery') {
    // A great furnace in the back wall, its mouth glowing, and ore carts on a curved rail either side (smeltCart).
    const castI = new THREE.MeshStandardMaterial({ color: '#3a3e48', roughness: 0.55, metalness: 0.7 });
    const fg = new THREE.Group(); fg.position.set(0, 0, -9.7);
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.6, 6.5, 1.8), new THREE.MeshStandardMaterial({ map: canvasTex(brick, { repeat: [3, 4] }), color: '#8a8e9c', roughness: 0.9 })); body.position.y = 3.25; fg.add(body);
    const mm = new THREE.MeshBasicMaterial({ map: canvasTex(archCanvas()), transparent: true, color: new THREE.Color(1, 1, 1) }); mm.userData.base = mm.color.clone(); glows.push(mm);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), mm); mouth.position.set(0, 1.35, 0.92); fg.add(mouth);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.5, 2.2), castI); hood.position.y = 6.6; fg.add(hood);
    body.castShadow = body.receiveShadow = true; room.add(fg);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(9.9, 0.06, 4, 64, 2.4), castI); rail.rotation.x = Math.PI / 2; rail.rotation.z = -Math.PI / 2 - 1.2; rail.position.y = 0.05; room.add(rail);
    const ore = new THREE.MeshStandardMaterial({ color: '#5a4a40', roughness: 0.9, map: grain });
    for (const a of [Math.PI - 0.55, Math.PI - 0.95, Math.PI + 0.6, Math.PI + 1.0]) {
      const g = new THREE.Group(); g.position.set(Math.sin(a) * 9.9, 0, Math.cos(a) * 9.9); g.rotation.y = a + Math.PI / 2;
      const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 0.8, 8, 1, true), castI); tub.position.y = 0.75; g.add(tub);
      const load = new THREE.Mesh(new THREE.SphereGeometry(0.66, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), ore); load.position.y = 1.05; load.scale.y = 0.6; g.add(load);
      for (const z of [-0.45, 0.45]) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.3, 10), castI); wh.rotation.x = Math.PI / 2; wh.rotation.z = Math.PI / 2; wh.position.set(z, 0.22, 0); g.add(wh); }
      g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true; });
      room.add(g);
    }
  } else if (id === 'wrackline') {
    // A wrecked hull against the back wall (wrackWreck): a keel and ribs of dark wet timber, a broken mast; and
    // mooring posts either side (wrackPost), all standing in the water outside the floor.
    const timber = new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 0.75, map: grain });
    const wg = new THREE.Group(); wg.position.set(0, -0.2, -9.6); wg.rotation.y = 0.2;
    const keel = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.4, 0.5), timber); keel.position.y = 0.2; wg.add(keel);
    for (let k = 0; k < 7; k++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(1.5 - Math.abs(k - 3) * 0.12, 0.1, 6, 14, Math.PI), timber); rib.position.set(-2.7 + k * 0.9, 0.2, 0); rib.rotation.y = Math.PI / 2; rib.rotation.z = 0; wg.add(rib); }
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 5.5, 8), timber); mast.position.set(0.6, 2.4, 0); mast.rotation.z = 0.35; wg.add(mast);
    wg.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true; });
    room.add(wg);
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2, 0.24, 2.4, 8), timber, 6);
    [Math.PI - 0.7, Math.PI - 1.0, Math.PI - 1.3, Math.PI + 0.7, Math.PI + 1.0, Math.PI + 1.3].forEach((a, k) => { e.set(0.06 * (k % 2 ? 1 : -1), 0, 0.05); q.setFromEuler(e); m4.compose(new THREE.Vector3(Math.sin(a) * 8.9, 0.9, Math.cos(a) * 8.9), q, one); posts.setMatrixAt(k, m4); });
    posts.castShadow = true; room.add(posts);
  } else if (id === 'hammerdeep') {
    // Three great anvils on stone plinths against the back wall, and a giant hammer resting head-down
    // beside the middle one. Cold iron, a little lit by the slag. Outside the floor.
    const cold = new THREE.MeshStandardMaterial({ color: '#4a4852', roughness: 0.42, metalness: 0.8 });
    const haft = new THREE.MeshStandardMaterial({ color: '#4a3424', roughness: 0.8, map: grain });
    for (const [a, sc] of [[Math.PI, 1.35], [Math.PI - 0.8, 1], [Math.PI + 0.8, 1]] as const) {
      const g = new THREE.Group(); g.position.set(Math.sin(a) * 9.5, 0, Math.cos(a) * 9.5); g.lookAt(0, 0, 0);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.2 * sc, 1.0, 1.6 * sc), basalt); plinth.position.y = 0.3; g.add(plinth);
      const waist = new THREE.Mesh(new THREE.BoxGeometry(0.9 * sc, 1.0 * sc, 0.8 * sc), cold); waist.position.y = 0.8 + 0.5 * sc; g.add(waist);
      const face = new THREE.Mesh(new THREE.BoxGeometry(2.4 * sc, 0.55 * sc, 1.0 * sc), cold); face.position.y = 0.8 + 1.27 * sc; g.add(face);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.42 * sc, 1.4 * sc, 4), cold); horn.rotation.z = Math.PI / 2; horn.rotation.x = Math.PI / 4; horn.position.set(1.9 * sc, 0.8 + 1.3 * sc, 0); g.add(horn);
      if (sc > 1.2) {
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 4.6, 8), haft); stick.position.set(-1.76, 3.2, 0.2); stick.rotation.z = -0.28; g.add(stick);
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.0), cold); head.position.set(-2.4, 0.5, 0.2); head.rotation.z = -0.28; g.add(head);
      }
      g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true; });
      room.add(g);
    }
  } else if (id === 'foundry') {
    // Three brass boilers against the back wall: upright tanks with domed tops, verdigris bands, a sea-glass
    // gauge glowing teal on each, joined by a pipe run. Outside the floor, like the Flue's chimneys.
    const bronze = new THREE.MeshStandardMaterial({ color: '#8a6a34', roughness: 0.38, metalness: 0.85 });
    const verd = new THREE.MeshStandardMaterial({ color: '#4f8a78', roughness: 0.6, metalness: 0.4 });
    for (const [a, r] of [[Math.PI, 1.5], [Math.PI - 0.8, 1.15], [Math.PI + 0.8, 1.15]] as const) {
      const g = new THREE.Group(); g.position.set(Math.sin(a) * 9.4, 0, Math.cos(a) * 9.4); g.lookAt(0, 0, 0);
      const h = r * 2.6;
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), bronze); tank.position.y = h / 2; g.add(tank);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), bronze); dome.position.y = h; g.add(dome);
      for (const y of [0.25, 0.55, 0.85]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.03, r * 1.03, 0.12, 24), verd); b.position.y = h * y; g.add(b); }
      const gm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.22, 0.7, 0.6) }); gm.userData.base = gm.color.clone(); glows.push(gm);
      const gauge = new THREE.Mesh(new THREE.CircleGeometry(r * 0.3, 20), gm); gauge.position.set(0, h * 0.68, r + 0.02); g.add(gauge);
      const bezel = new THREE.Mesh(new THREE.RingGeometry(r * 0.3, r * 0.38, 20), bronze); bezel.position.set(0, h * 0.68, r + 0.03); g.add(bezel);
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, 5, 10), iron); stack.position.y = h + r + 2.2; g.add(stack);
      g.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== gauge) o.castShadow = o.receiveShadow = true; });
      room.add(g);
    }
    // A pipe run round the back wall at head height, and the waterline stain under it.
    const pipe = new THREE.Mesh(new THREE.TorusGeometry(10.2, 0.16, 8, 64, 2.6), bronze); pipe.rotation.x = Math.PI / 2; pipe.rotation.z = -Math.PI / 2 - 1.3; // the arc's middle at the back (-z) pipe.position.y = 3.4; room.add(pipe);
    const pipe2 = new THREE.Mesh(new THREE.TorusGeometry(10.25, 0.1, 8, 64, 2.2), verd); pipe2.rotation.x = Math.PI / 2; pipe2.rotation.z = -Math.PI / 2 - 1.1; pipe2.position.y = 4.1; room.add(pipe2);
  } else {
    // Three beehive kilns against the back wall, where the Flue has its chimneys: brick domes on a plinth, each
    // with an arched mouth of fire and a short stack. They stand outside the floor, so they never hide a fight.
    const kb = new THREE.MeshStandardMaterial({ map: canvasTex(brick, { repeat: [6, 3] }), color: '#d89a80', roughness: 0.9 });
    const arch = canvasTex(archCanvas());
    for (const [a, r] of [[Math.PI, 2.3], [Math.PI - 0.8, 1.65], [Math.PI + 0.8, 1.65]] as const) {
      const g = new THREE.Group(); g.position.set(Math.sin(a) * (9.2 + r * 0.25), 0, Math.cos(a) * (9.2 + r * 0.25)); g.lookAt(0, 0, 0);
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.14, 0.5, 20), basalt); plinth.position.y = 0.1; g.add(plinth);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 0.55, 24, 1, true), kb); drum.position.y = 0.35 + r * 0.275; g.add(drum);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), kb); dome.position.y = 0.35 + r * 0.55; g.add(dome);
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.22, r * 0.9, 10), kb); stack.position.y = 0.35 + r * 1.5; g.add(stack);
      const lip = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.24, r * 0.24, 0.12, 10), basalt); lip.position.y = 0.35 + r * 1.95; g.add(lip);
      const gm = new THREE.MeshBasicMaterial({ map: arch, transparent: true, color: new THREE.Color(1, 1, 1) }); gm.userData.base = gm.color.clone(); glows.push(gm);
      if (a === Math.PI) kilnMouth = gm; // the great kiln the three-stage Kiln Mother climbs into (kilnmother3d.ts)
      const mouth = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.75, r * 0.94), gm); mouth.position.set(0, 0.36 + r * 0.47, r + 0.02); g.add(mouth);
      g.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== mouth) o.castShadow = o.receiveShadow = true; });
      room.add(g);
    }
  }
  const flames: THREE.Mesh[] = [];
  const flameTex = canvasTex(flameCanvas(th.flame));
  // Only the back braziers: the handoff's two front ones stood between this camera and the fight, and side ones
  // (PI ± 1.55) came within a metre of the camera when your hero stood at that side (mobile's 568x320 check, 23 Nov).
  // The Foundry is drowned: no braziers, its teal lamps and gauges light it.
  for (const a of id === 'foundry' || id === 'hammerdeep' || id === 'glarewell' || id === 'coldmarrow' || id === 'wrackline' ? [] : [Math.PI - 0.5, Math.PI + 0.5, Math.PI - 1.1, Math.PI + 1.1]) {
    const g = new THREE.Group(); g.position.set(Math.sin(a) * 8.62, 0.22, Math.cos(a) * 8.62);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.26, 0.4, 10), iron); bowl.position.y = 0.75; g.add(bowl);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.6, 6), iron); stem.position.y = 0.3; g.add(stem);
    const coals = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.06, 10), chimMouth); coals.position.y = 0.95; g.add(coals);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.0, 8), new THREE.MeshBasicMaterial({ map: flameTex, color: new THREE.Color(0.9, 0.9, 0.9), transparent: true, opacity: 0.92 }));
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
  if (id === 'glarewell' || id === 'ashvents' || id === 'hoard' || id === 'coldmarrow' || id === 'pressworks' || id === 'smeltery') {
    // The Glarewell: clusters of pale crystal shards (glareShards). The Ashvents: cairns of flat ash stones (ashCairn).
    // The Hoard: heaps of coin (hoardPile).
    // The Coldmarrow: ice chunks. The Pressworks: stacks of pressed brass plates (pressStack). The Smeltery: ingot stacks (smeltIngots).
    const glare = id === 'glarewell' || id === 'coldmarrow', hoard = id === 'hoard', plates = id === 'pressworks' || id === 'smeltery';
    const mat = id === 'coldmarrow' ? new THREE.MeshStandardMaterial({ color: '#cfe6ff', roughness: 0.1, emissive: new THREE.Color('#14243a'), transparent: true, opacity: 0.85 })
      : id === 'pressworks' ? new THREE.MeshStandardMaterial({ color: '#b09a50', roughness: 0.4, metalness: 0.85 })
      : id === 'smeltery' ? new THREE.MeshStandardMaterial({ color: '#8a8e9a', roughness: 0.4, metalness: 0.85 })
      : hoard ? new THREE.MeshStandardMaterial({ color: '#c09038', roughness: 0.5, metalness: 0.65, emissive: new THREE.Color('#140a02') }) : glare ? new THREE.MeshStandardMaterial({ color: '#d8d0ff', roughness: 0.15, metalness: 0.1, emissive: new THREE.Color('#2a2050'), transparent: true, opacity: 0.85 }) : new THREE.MeshStandardMaterial({ color: '#8a7a74', roughness: 1, map: grain });
    const bits = new THREE.InstancedMesh(plates ? new THREE.BoxGeometry(id === 'smeltery' ? 0.7 : 0.8, 0.14, id === 'smeltery' ? 0.3 : 0.8) : hoard ? new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2) : glare ? new THREE.OctahedronGeometry(0.3, 0) : new THREE.CylinderGeometry(0.42, 0.5, 0.18, 7), mat, 64);
    let nbt = 0;
    for (const a of spots) {
      const r0 = sr(9.4, 9.9), cx = Math.sin(a) * r0, cz = Math.cos(a) * r0;
      for (let j = 0; j < 7 && nbt < 64; j++) {
        if (plates) { const smelt = id === 'smeltery'; put(bits, nbt++, cx + (smelt ? (j % 2) * 0.34 - 0.17 : sr(-0.05, 0.05)), 0.02 + (smelt ? Math.floor(j / 2) : j) * 0.15, cz + sr(-0.05, 0.05), smelt ? a + (Math.floor(j / 2) % 2) * Math.PI / 2 : sr(-0.15, 0.15), 1); }
        else if (hoard) { if (j < 3) { const sc = sr(0.6, 1.3); put(bits, nbt++, cx + sr(-0.7, 0.7), -0.06, cz + sr(-0.7, 0.7), sr(0, 6), sc, sc * 0.45, sc); } }
        else if (glare) { const sc = sr(0.6, 1.8); put(bits, nbt++, cx + sr(-0.7, 0.7), sc * 0.3, cz + sr(-0.7, 0.7), sr(0, 6), sc * 0.7, sc * 1.6, sc * 0.7, sr(-0.3, 0.3), sr(-0.3, 0.3)); }
        else { const sc = 1 - j * 0.11; put(bits, nbt++, cx + sr(-0.08, 0.08), 0.05 + j * 0.17, cz + sr(-0.08, 0.08), sr(0, 6), sc); }
      }
    }
    bits.count = nbt; bits.castShadow = bits.receiveShadow = true; room.add(bits);
  } else if (id !== 'kiln') {
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
  } else {
    // The potters' work: pots and urns (a lathe profile, terracotta, a few glazed), on plank shelves or on the
    // ground, and firewood stacked for the kilns.
    const clay = new THREE.MeshStandardMaterial({ color: '#b0603e', roughness: 0.8 });
    const glaze = new THREE.MeshStandardMaterial({ color: '#3e6a68', roughness: 0.3, metalness: 0.1 });
    const prof = [[0, 0], [0.16, 0], [0.24, 0.12], [0.27, 0.3], [0.22, 0.48], [0.12, 0.58], [0.13, 0.66], [0.16, 0.7]].map(([x, y]) => new THREE.Vector2(x, y));
    const potGeo = new THREE.LatheGeometry(prof, 12);
    const pots = new THREE.InstancedMesh(potGeo, clay, 40), glazed = new THREE.InstancedMesh(potGeo, glaze, 12);
    const shelves = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), wood, 16);
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 1, 0.08), wood, 32);
    const logs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.11, 1.1, 7), wood, 48);
    let np = 0, ng = 0, ns = 0, nl = 0, npo = 0;
    const pot = (x: number, y: number, z: number, sc: number) => { if (sr(0, 1) < 0.22 && ng < 12) put(glazed, ng++, x, y, z, sr(0, 6), sc); else if (np < 40) put(pots, np++, x, y, z, sr(0, 6), sc); };
    spots.forEach((a, k) => {
      const r0 = sr(9.5, 9.9), cx = Math.sin(a) * r0, cz = Math.cos(a) * r0, tx = Math.cos(a), tz = -Math.sin(a);
      if (k % 2 === 0 && ns < 15) {
        // A two-tier shelf along the wall, pots on each tier.
        for (const h of [0.55, 1.2]) {
          put(shelves, ns++, cx, h, cz, a, 1);
          for (let j = 0; j < 3; j++) { const o = -0.5 + j * 0.5 + sr(-0.08, 0.08); pot(cx + tx * o, h + 0.04, cz + tz * o, sr(0.55, 0.8)); }
        }
        for (const o of [-0.75, 0.75]) for (const d of [-0.2, 0.2]) if (npo < 32) put(posts, npo++, cx + tx * o + Math.sin(a) * d, 0.6, cz + tz * o + Math.cos(a) * d, a, 1, 1.3, 1);
      } else {
        // Firewood stacked log on log, and big urns beside it.
        for (let row = 0; row < 3; row++) for (let j = 0; j < 4 - row && nl < 48; j++) {
          const o = (j - (3 - row) / 2) * 0.23;
          put(logs, nl++, cx + tx * o, 0.06 + row * 0.2, cz + tz * o, a, 1, 1, 1, Math.PI / 2);
        }
        for (let j = 0; j < 2; j++) pot(cx + tx * (j ? 1.0 : -1.0) + sr(-0.1, 0.1), -0.05, cz + tz * (j ? 1.0 : -1.0), sr(1.2, 1.6));
      }
    });
    pots.count = np; glazed.count = ng; shelves.count = ns; posts.count = npo; logs.count = nl;
    for (const im of [pots, glazed, shelves, posts, logs]) { im.castShadow = im.receiveShadow = true; room.add(im); }
  }
  // Broken basalt columns round the wall, for a skyline at the edge of view.
  // The Kiln's are square brick piers, the Flue's broken basalt.
  const cols = new THREE.InstancedMesh(id === 'kiln' ? new THREE.BoxGeometry(0.8, 1, 0.8) : new THREE.CylinderGeometry(0.42, 0.5, 1, 10), id === 'kiln' ? new THREE.MeshStandardMaterial({ map: canvasTex(brick, { repeat: [1, 2] }), color: '#c88a70', roughness: 0.9 }) : basalt, 8);
  for (let k = 0; k < 8; k++) {
    const a = Math.PI + (k < 4 ? -1 : 1) * (1.05 + (k % 4) * 0.2), h = sr(1.4, 4.2);
    put(cols, k, Math.sin(a) * 10.05, h / 2 - 0.1, Math.cos(a) * 10.05, sr(0, 6), 1, h, 1, sr(-0.04, 0.04), sr(-0.04, 0.04));
  }
  cols.castShadow = cols.receiveShadow = true; room.add(cols);
  // Wall sconces: an iron bracket and a flame that glows on its own (no light each: the phone budget keeps two).
  const SC = saver ? 6 : 12;
  const bracket = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.5, 0.4), iron, SC);
  const scFlame = new THREE.InstancedMesh(new THREE.ConeGeometry(0.16, 0.5, 8), new THREE.MeshBasicMaterial({ map: flameTex, color: new THREE.Color(0.9, 0.9, 0.9) }), SC);
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
  if (id === 'flue') room.add(banners);
  // Chains hanging from the dark above, at the edge of the room.
  const chains = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 5), hoop, 10);
  // Only on the far half: on the near half they hung between the camera and the floor.
  for (let k = 0; k < 10; k++) { const a = Math.PI + sr(-1.3, 1.3), len = sr(4, 7.5); put(chains, k, Math.sin(a) * 9.3, 12 - len / 2, Math.cos(a) * 9.3, 0, 1, len, 1); }
  room.add(chains);
  // The floor: a brass inlay (two rings and eight spokes), worn and dull so telegraphs stay the brightest thing on it.
  const inlay = new THREE.MeshStandardMaterial({ color: '#8a6a34', roughness: 0.4, metalness: 0.8, emissive: new THREE.Color('#2a1606') });
  // The Kiln's floor has no brass: rings of soot where the heat has scorched it.
  if (id === 'kiln') {
    const soot = new THREE.MeshBasicMaterial({ map: canvasTex(dotCanvas('rgba(10,4,2,0)', 'rgba(10,4,2,0.55)')), transparent: true, depthWrite: false });
    const sootRing = new THREE.Mesh(new THREE.RingGeometry(5.4, 7.5, 64), soot); sootRing.rotation.x = -Math.PI / 2; sootRing.position.y = FLOOR + 0.004; room.add(sootRing);
  }
  if (id !== 'kiln' && id !== 'ashvents' && id !== 'wrackline') for (const [r0, r1] of [[2.55, 2.68], [5.75, 5.9]]) { const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 96), inlay); ring.rotation.x = -Math.PI / 2; ring.position.y = FLOOR + 0.004; ring.receiveShadow = true; room.add(ring); }
  const spokes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.01, 3.07), inlay, 8);
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; put(spokes, k, Math.sin(a) * 4.215, FLOOR + 0.004, Math.cos(a) * 4.215, a, 1); }
  spokes.receiveShadow = true; if (id !== 'kiln' && id !== 'ashvents' && id !== 'wrackline') room.add(spokes);
  // Ember cracks: a few faint seams in the floor tiles (dim, so they never read as a fire telegraph).
  const cc = document.createElement('canvas'); cc.width = cc.height = 128;
  { const k = cc.getContext('2d')!; k.strokeStyle = 'rgba(255,140,50,1)'; k.lineCap = 'round'; k.shadowColor = '#ff6a1f'; k.shadowBlur = 6;
    for (let j = 0; j < 3; j++) { k.lineWidth = 3 - j; k.beginPath(); let x = 64, y = 64; k.moveTo(x, y); for (let n = 0; n < 6; n++) { x += Math.cos(j * 2.1 + n * 0.7) * 10; y += Math.sin(j * 2.1 + n * 0.5) * 10; k.lineTo(x, y); } k.stroke(); } }
  const CR = saver ? 4 : 8;
  const cracks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: canvasTex(cc), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }), CR);
  for (let k = 0; k < CR; k++) { const a = sr(0, Math.PI * 2), r = sr(1.2, 7.0); put(cracks, k, Math.sin(a) * r, FLOOR + 0.006, Math.cos(a) * r, 0, sr(0.7, 1.3), sr(0.7, 1.3), 1, -Math.PI / 2, sr(0, 6)); }
  if (id === 'flue' || id === 'kiln' || id === 'ashvents' || id === 'crucible' || id === 'smeltery') room.add(cracks);
  // Rubble and coal along the floor's edge and outside it, low enough never to hide a telegraph.
  const RB = saver ? 40 : 90;
  const rubble = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), basalt, RB);
  const coal = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#1c1614', roughness: 0.7, emissive: new THREE.Color(id === 'foundry' || id === 'glarewell' || id === 'coldmarrow' || id === 'wrackline' ? '#000000' : id === 'hammerdeep' ? '#2a0a02' : '#5a1a04'), emissiveIntensity: 0.6 }), Math.round(RB / 3));
  // The Wrackline's floor is water: no rubble floating on it, and no coal.
  for (let k = 0; k < RB; k++) { const a = sr(0, Math.PI * 2), r = k % 3 && id !== 'wrackline' ? sr(6.7, 7.4) : sr(9.0, 10.3), sz = sr(0.04, k % 3 ? 0.1 : 0.22); put(rubble, k, Math.sin(a) * r, FLOOR + sz * 0.4 - (r > 8 ? 0.15 : 0), Math.cos(a) * r, sr(0, 6), sz, sz * sr(0.5, 0.9), sz, sr(0, 3)); }
  for (let k = 0; k < coal.count; k++) { const a = sr(0, Math.PI * 2), r = sr(6.4, 7.4), sz = sr(0.04, 0.08); put(coal, k, Math.sin(a) * r, FLOOR + sz * 0.4, Math.cos(a) * r, sr(0, 6), sz); }
  rubble.receiveShadow = true; room.add(rubble); if (id !== 'wrackline') room.add(coal);
  // v2's phone budget: two shared warm lights instead of nine (one at the back wall, one at the front braziers).
  addLight(th.backLight, id === 'kiln' ? 38 : 34, 22, new THREE.Vector3(0, 2.4, -8.2), 1.4);
  if (!saver) addLight(th.frontLight, 14, 14, new THREE.Vector3(0, 2.2, 7.6), 2.0);
  // Life (Steve, 23 Nov: "it's kind of dead. I don't want to make it busy, but I want to have something"): quiet motion
  // that every room has, ticked by frame(): faint shafts of light swaying down from above, low mist drifting over the
  // floor, and per room chains swaying on the walls (forges) or drips falling and ringing on the floor (wet rooms).
  const life: ((t: number) => void)[] = [];
  // What sound can follow (Hd2dView.sounds): a drip landing, a chain at the end of its sway. Room units.
  const heard: { kind: 'drip' | 'chain'; x: number; z: number }[] = [];
  {
    const keyC = new THREE.Color(th.key);
    // Shafts of light: tall soft cones from the dark above, each with a pool on the floor, swaying slowly.
    const shaftTex = canvasTex((() => { const c = mk(16, 128), k = c.getContext('2d')!; const g = k.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0.9)'); k.fillStyle = g; k.fillRect(0, 0, 16, 128); return c; })());
    const shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, color: keyC.clone().multiplyScalar(0.045), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, fog: false });
    const poolMat = new THREE.MeshBasicMaterial({ map: canvasTex(dotCanvas('rgba(255,255,255,0.5)', 'rgba(255,255,255,0)')), color: keyC.clone().multiplyScalar(0.16), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const shaftGeo = new THREE.CylinderGeometry(0.3, 0.75, 9, 16, 1, true).translate(0, 4.5, 0);
    const SH = [[2.2, -3.4], [-4.6, -1.2], [4.8, 2.6], [-1.8, 4.4], [0.6, 0.8]];
    SH.forEach(([sx, sz], k) => {
      const sh = new THREE.Mesh(shaftGeo, shaftMat); sh.position.set(sx, FLOOR, sz); room.add(sh);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(0.95, 24), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.set(sx, FLOOR + 0.012, sz); room.add(pool);
      life.push((t) => { const a = Math.sin(t * 0.21 + k * 1.7); sh.rotation.set(a * 0.05, 0, Math.cos(t * 0.17 + k) * 0.05); pool.scale.setScalar(1 + 0.08 * a); });
    });
    life.push((t) => { shaftMat.opacity = 0.85 + 0.15 * Math.sin(t * 0.5); });
    // Low mist drifting over the floor, tinted by the room's fog, very faint so telegraphs stay clear.
    if (id !== 'wrackline') {
      const mc = new THREE.Color(th.wall).lerp(new THREE.Color(th.fog), 0.35);
      const mistMat = new THREE.MeshBasicMaterial({ map: canvasTex(dotCanvas('rgba(255,255,255,0.55)', 'rgba(255,255,255,0)')), color: mc, transparent: true, opacity: 0.12, depthWrite: false });
      for (let k = 0; k < 7; k++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 3.2), mistMat); m.rotation.x = -Math.PI / 2; m.position.y = FLOOR + 0.08 + k * 0.004; room.add(m);
        const r0 = 2 + (k * 1.37) % 5, a0 = k * 2.1, sp = 0.012 + (k % 3) * 0.006;
        life.push((t) => { const a = a0 + t * sp * (k % 2 ? 1 : -1); m.position.x = Math.cos(a) * r0; m.position.z = Math.sin(a) * r0; m.rotation.z = a * 0.5; });
      }
    }
    const forge = id === 'flue' || id === 'kiln' || id === 'hammerdeep' || id === 'pressworks' || id === 'smeltery' || id === 'crucible' || id === 'hoard';
    const wet = id === 'foundry' || id === 'coldmarrow' || id === 'wrackline' || id === 'glarewell';
    if (forge) {
      // Chains hanging on the walls, swaying a little, a hook at the end.
      const iron = new THREE.MeshStandardMaterial({ color: '#2a2422', roughness: 0.6, metalness: 0.8 });
      const link = new THREE.TorusGeometry(0.09, 0.025, 4, 8);
      for (let k = 0; k < 7; k++) {
        const a = Math.PI + (k - 3) * 0.42, r = 8.6;
        const g = new THREE.Group(); g.position.set(Math.sin(a) * r, 6.2, Math.cos(a) * r); g.rotation.y = a;
        const n = 10 + (k * 3) % 7;
        for (let j = 0; j < n; j++) { const l = new THREE.Mesh(link, iron); l.position.y = -j * 0.15; l.rotation.y = j % 2 ? Math.PI / 2 : 0; g.add(l); }
        const hook = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 4, 10, Math.PI * 1.3), iron); hook.position.y = -n * 0.15 - 0.12; g.add(hook);
        room.add(g);
        let swing = 0;
        life.push((t) => {
          g.rotation.z = Math.sin(t * 0.7 + k * 1.3) * 0.045; g.rotation.x = Math.sin(t * 0.5 + k) * 0.03;
          // The end of a sway, where the links knock.
          const dir = Math.sign(Math.cos(t * 0.7 + k * 1.3));
          if (swing && dir && dir !== swing && heard.length < 16) heard.push({ kind: 'chain', x: g.position.x, z: g.position.z });
          if (dir) swing = dir;
        });
      }
    }
    if (wet) {
      // Drips falling from the dark above near the walls and arena edge, each ringing out on the floor.
      const dropC = new THREE.Color(id === 'coldmarrow' ? '#d8ecff' : id === 'glarewell' ? '#e0d8ff' : '#bfe8e0');
      const dropMat = new THREE.MeshBasicMaterial({ color: dropC.clone().multiplyScalar(1.6) });
      const ringMat = new THREE.MeshBasicMaterial({ color: dropC, transparent: true, depthWrite: false });
      for (let k = 0; k < 9; k++) {
        const a = k * 0.73 + 0.4, r = 3 + (k * 2.3) % 4.8;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const drop = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), dropMat); drop.scale.y = 2.2; room.add(drop);
        const ringM = ringMat.clone();
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 24), ringM); ring.rotation.x = -Math.PI / 2; ring.position.set(x, FLOOR + 0.015, z); room.add(ring);
        const per = 2.2 + (k % 4) * 0.7, off = k * 0.61;
        let was = -1;
        life.push((t) => {
          const ph = ((t + off) % per) / per, fall = 0.45; // 45% of the cycle falling, then the ring spreads
          // It lands as the ring starts.
          if (was >= 0 && was < fall && ph >= fall && heard.length < 16) heard.push({ kind: 'drip', x, z });
          was = ph;
          drop.visible = ph < fall;
          if (ph < fall) { const f = ph / fall; drop.position.set(x, FLOOR + 6 * (1 - f * f), z); }
          const rp = ph < fall ? -1 : (ph - fall) / 0.35;
          ring.visible = rp >= 0 && rp < 1;
          if (ring.visible) { ring.scale.setScalar(0.08 + 0.5 * rp); ringM.opacity = 0.7 * (1 - rp); }
        });
      }
    }
  }
  return { room, flames, basalt, glows, th, drift, life, heard, kilnMouth };
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
  renderer.toneMappingExposure = 1.65; // 1.05 read murky on Steve's phone (23 Nov)
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
  const rid = roomOf(A.world().dungeonId), th0 = ROOMS[rid];
  scene.background = new THREE.Color(th0.bg);
  scene.fog = new THREE.Fog(th0.fog, 26, 46);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  /** The handoff's camera angle: up 15.5 and back 13.6 from what it looks at. */
  const camDir = new THREE.Vector3(0, 15.5, 13.6).normalize();

  scene.add(new THREE.HemisphereLight(th0.hemi[0], th0.hemi[1], th0.hemi[2] * 1.6));
  const key = new THREE.DirectionalLight(th0.key, 1.6);
  key.castShadow = !saver; key.shadow.mapSize.set(512, 512);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 40 });
  key.shadow.bias = -0.0008; scene.add(key); scene.add(key.target);
  // A warm lamp over your own hero, so the ground you fight on is always lit (the room's other lights sit at its edges).
  const lamp = new THREE.PointLight(th0.lamp, saver ? 0 : 7, 8, 2); lamp.position.set(0, 2.4, 0); if (!saver) scene.add(lamp);
  const rimCool = new THREE.DirectionalLight('#7f8cff', 0.35); rimCool.position.set(4, 6, -10); scene.add(rimCool);
  const flick: { l: THREE.PointLight; base: number; seed: number; speed: number }[] = [];
  const addLight = (c: string, i: number, d: number, p: THREE.Vector3, speed = 1) => { const l = new THREE.PointLight(c, i, d, 2); l.position.copy(p); scene.add(l); flick.push({ l, base: i, seed: Math.random() * 100, speed }); };
  const { room, flames, basalt, glows, drift, life, heard, kilnMouth } = buildRoom(scene, saver, addLight, rid);
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
    atkAt: number; lastVolley: number; lastSwings: number; lastCds: number[];
    /** Your own hero only: an invisible twin at the true spot that casts the shadow, since the drawn sprite is lifted. */
    twin?: THREE.Mesh;
    /** The green outline (outline()). */
    rim: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> };
  const heroes: HeroS[] = [];
  /** Per enemy slot: its attack timers last frame, when its last attack began, and which way it lunged. */
  const foeAtk: ({ born: number; touch: number; abil: number; at: number; dx: number; dz: number } | undefined)[] = [];
  const heroSprite = (i: number, cls: string): HeroS => {
    const set = F[ART[cls] ?? 'ew'];
    const mats: Record<string, THREE.MeshStandardMaterial> = {};
    for (const p of Object.keys(set)) mats[p] = spriteMat(set[p], 1.8);
    const mesh = new THREE.Mesh(heroGeo, mats.idle); mesh.castShadow = i !== 0;
    mesh.scale.set(HERO.W * HERO_PX, HERO.H * HERO_PX, 1); scene.add(mesh);
    const rc = GOOD.clone(); // was the class colour (RING); Steve, 23 Nov: green = good
    const ring = flat(new THREE.RingGeometry(0.4, 0.5, 48), new THREE.MeshBasicMaterial({ color: rc.clone().multiplyScalar(1.3), transparent: true, depthWrite: false }), 0.03);
    const disc = flat(new THREE.CircleGeometry(0.4, 48), new THREE.MeshBasicMaterial({ color: rc, transparent: true, opacity: 0.18, depthWrite: false }), 0.028);
    const blob = flat(circle, blobMat, 0.006); blob.scale.setScalar(0.48);
    const rim = new THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>(heroGeo, rimMat(GOOD, false)); rim.renderOrder = 4; scene.add(rim);
    const h: HeroS = { cls, mesh, mats, blob, ring, disc, rim, name: null, nameText: '', atkAt: -9, lastVolley: 0, lastSwings: 0, lastCds: [] };
    if (i === 0) {
      const tm = new THREE.MeshBasicMaterial({ map: mats.idle.map, alphaTest: 0.5, side: THREE.DoubleSide, colorWrite: false, depthWrite: false });
      h.twin = new THREE.Mesh(heroGeo, tm); h.twin.castShadow = true; scene.add(h.twin);
    }
    heroes[i] = h; return h;
  };
  const dropHero = (h: HeroS) => { for (const o of [h.mesh, h.blob, h.ring, h.disc, h.name, h.twin, h.rim]) if (o) scene.remove(o); };

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
  type FoeS = { mesh: THREE.Mesh; rim: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>; shield?: THREE.Mesh; anchor?: THREE.Group; eye?: EyeS; horn?: HornS; conch?: ConchS; bellows?: ReturnType<typeof makeKmBellows>; gorge?: THREE.Mesh };
  // Phase 16 U2, the Ballast (design #606): an iron anchor on a chain at its side. It drops as Enemy.aux counts up to
  // BALLAST.plantDelay, bites into the floor once planted, and heaves up and glows while it winds up its slam.
  const anchorIron = new THREE.MeshStandardMaterial({ color: '#5a6470', roughness: 0.5, metalness: 0.85, emissive: new THREE.Color('#ff9040'), emissiveIntensity: 0 });
  const makeAnchor = () => {
    const g = new THREE.Group();
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8).translate(0, 0.35, 0), anchorIron); g.add(shank);
    const arms = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 6, 16, Math.PI), anchorIron); arms.rotation.z = Math.PI; arms.position.y = 0.26; g.add(arms);
    for (const sx of [-1, 1]) { const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 4), anchorIron); fluke.position.set(sx * 0.26, 0.3, 0); g.add(fluke); }
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.06), anchorIron); stock.position.y = 0.62; g.add(stock);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 12), anchorIron); ring.position.y = 0.76; g.add(ring);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 5).translate(0, 0.5, 0), anchorIron); chain.position.y = 0.82; chain.name = 'chain'; g.add(chain);
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = !saver; });
    scene.add(g); return g;
  };
  // Phase 16 U2, the Lampeye (design #612): a floating eye in 3D, not a sprite. Its iris turns to your hero, glows
  // brighter and its pupil narrows as the gaze (Enemy.aux) builds; while it can see you a pale beam joins you, which
  // flares through Searing Look. A pillar between you breaks the beam, as it breaks the gaze. A red shell behind the eye
  // shows through anything in front of it, like every foe's red outline.
  type EyeS = { g: THREE.Group; ball: THREE.Mesh; iris: THREE.Mesh; pupil: THREE.Mesh; lid: THREE.Mesh; hull: THREE.Mesh; beam: THREE.Mesh; irisMat: THREE.MeshStandardMaterial; beamMat: THREE.MeshBasicMaterial };
  const eyeVeins = (() => { const c = mk(128, 64), k = c.getContext('2d')!; k.fillStyle = '#f2e8d6'; k.fillRect(0, 0, 128, 64); k.strokeStyle = 'rgba(190,60,50,0.55)'; k.lineWidth = 1;
    for (let i = 0; i < 22; i++) { k.beginPath(); let x = Math.random() * 128, y = 64; k.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (Math.random() - 0.5) * 14; y -= 4 + Math.random() * 5; k.lineTo(x, y); } k.stroke(); }
    return canvasTex(c); })();
  const eyeBallGeo = new THREE.SphereGeometry(1, 24, 16);
  const eyeLidGeo = new THREE.SphereGeometry(1.08, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const eyeIrisGeo = new THREE.CircleGeometry(0.62, 24);
  const eyePupilGeo = new THREE.CircleGeometry(0.26, 18);
  const eyeBeamGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
  const makeEye = (): EyeS => {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(eyeBallGeo, new THREE.MeshStandardMaterial({ map: eyeVeins, roughness: 0.35, metalness: 0, emissive: new THREE.Color('#fff2d8'), emissiveMap: eyeVeins, emissiveIntensity: 0.3 }));
    const irisMat = new THREE.MeshStandardMaterial({ color: '#e07a10', roughness: 0.4, emissive: new THREE.Color('#ff9a20'), emissiveIntensity: 0.6 });
    const iris = new THREE.Mesh(eyeIrisGeo, irisMat); iris.position.z = 1.001;
    const pupil = new THREE.Mesh(eyePupilGeo, new THREE.MeshBasicMaterial({ color: '#0a0604' })); pupil.position.z = 1.003;
    const lid = new THREE.Mesh(eyeLidGeo, new THREE.MeshStandardMaterial({ color: '#2e2a33', roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide }));
    lid.rotation.x = -Math.PI / 2 + 0.35; // a dark hood over the back and top, open toward the front
    lid.position.z = -0.12;
    const hull = new THREE.Mesh(eyeBallGeo, new THREE.MeshBasicMaterial({ color: BAD, transparent: true, opacity: 0.5, side: THREE.BackSide, depthTest: false, depthWrite: false, toneMapped: false }));
    hull.scale.setScalar(1.14); hull.renderOrder = 6;
    // The eye draws in the transparent pass after its hull (three.js draws every opaque mesh first, so an opaque eye
    // was painted over by the depth-ignoring hull and showed as a plain red ball).
    for (const m of [ball, iris, pupil, lid]) { m.renderOrder = 7; const mm = m.material as THREE.Material; mm.transparent = true; mm.opacity = 1; }
    g.add(hull, ball, lid, iris, pupil);
    ball.castShadow = lid.castShadow = !saver;
    scene.add(g);
    const beamMat = new THREE.MeshBasicMaterial({ color: '#fff4c0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const beam = new THREE.Mesh(eyeBeamGeo, beamMat); beam.renderOrder = 5; scene.add(beam);
    return { g, ball, iris, pupil, lid, hull, beam, irisMat, beamMat };
  };
  // Phase 16 U2, the Dimhorn (design #621): a long curled horn on its head. The horn frosts over and glows cold blue as
  // its time in the dark (Enemy.aux) fills toward the Dark Call; through the call it tips up and blue rings of sound
  // roll off its bell, so you know to bring your coal's light over it.
  type HornS = { g: THREE.Group; mat: THREE.MeshStandardMaterial; rings: THREE.Mesh[]; ringMat: THREE.MeshBasicMaterial };
  const hornCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 0.28, 0), new THREE.Vector3(0.22, 0.5, 0), new THREE.Vector3(0.48, 0.58, 0), new THREE.Vector3(0.7, 0.5, 0)]);
  const hornGeo = (() => {
    const g = new THREE.TubeGeometry(hornCurve, 24, 1, 8, false);
    // Taper: thick at the root, flaring again into a small bell at the tip.
    const pos = g.attributes.position as THREE.BufferAttribute, n = pos.count, ring = 9;
    for (let v = 0; v < n; v++) {
      const seg = Math.floor(v / ring) / 24, c = hornCurve.getPointAt(seg); // TubeGeometry lays rings by arc length
      const r = seg < 0.85 ? 0.09 * (1 - seg * 0.75) : 0.035 + (seg - 0.85) * 0.5;
      const x = pos.getX(v) - c.x, y = pos.getY(v) - c.y, z = pos.getZ(v) - c.z, l = Math.hypot(x, y, z) || 1;
      pos.setXYZ(v, c.x + (x / l) * r, c.y + (y / l) * r, c.z + (z / l) * r);
    }
    g.computeVertexNormals();
    return g;
  })();
  const hornTip = hornCurve.getPointAt(1);
  const hornRingGeo = new THREE.TorusGeometry(1, 0.06, 6, 28);
  const makeHorn = (): HornS => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#d8d0bc', roughness: 0.45, metalness: 0.05, emissive: new THREE.Color('#7aa8ff'), emissiveIntensity: 0 });
    const m = new THREE.Mesh(hornGeo, mat); m.castShadow = !saver; g.add(m);
    const ringMat = new THREE.MeshBasicMaterial({ color: '#9ab8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const rings: THREE.Mesh[] = [];
    for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(hornRingGeo, ringMat.clone()); r.position.copy(hornTip); r.rotation.y = Math.PI / 2; g.add(r); rings.push(r); }
    scene.add(g);
    return { g, mat, rings, ringMat };
  };
  // Phase 16 U2, the Conchblower (design #623): a great spiral shell carried at its side. Through its Conch Call
  // (Quenchable; it hastens the Ebb) it lifts the shell to its mouth, the shell glows sea green, rings of sound roll
  // off the mouth and a ripple runs out over the floor around it.
  type ConchS = { g: THREE.Group; shell: THREE.Group; mat: THREE.MeshStandardMaterial; rings: THREE.Mesh[]; ripple: THREE.Mesh; rippleMat: THREE.MeshBasicMaterial };
  const conchStripes = (() => { const c = mk(64, 64), k = c.getContext('2d')!; k.fillStyle = '#f1d9c4'; k.fillRect(0, 0, 64, 64); k.fillStyle = '#c98a6a';
    for (let y = 0; y < 64; y += 8) { k.save(); k.translate(0, y); k.transform(1, 0.35, 0, 1, 0, 0); k.fillRect(0, 0, 64, 3); k.restore(); } return canvasTex(c); })();
  const makeConch = (): ConchS => {
    const g = new THREE.Group(), shell = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ map: conchStripes, roughness: 0.4, metalness: 0.05, emissive: new THREE.Color('#40ffc8'), emissiveIntensity: 0 });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 12, 1), mat); body.rotation.z = -Math.PI / 2; body.position.x = -0.1; shell.add(body);
    const whorl = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.07, 8, 16), mat); whorl.position.x = 0.12; whorl.rotation.y = Math.PI / 2; shell.add(whorl);
    for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 5), mat); const a = (k / 5) * Math.PI * 2; sp.position.set(0.02 - k * 0.06, Math.cos(a) * 0.17, Math.sin(a) * 0.17); sp.rotation.x = a; shell.add(sp); }
    shell.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = !saver; });
    g.add(shell);
    const rings: THREE.Mesh[] = [];
    for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(hornRingGeo, new THREE.MeshBasicMaterial({ color: '#7dffd8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })); r.rotation.x = -0.6; g.add(r); rings.push(r); } // facing the camera, not edge-on
    scene.add(g);
    const rippleMat = new THREE.MeshBasicMaterial({ color: '#7dffd8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const ripple = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), rippleMat); ripple.rotation.x = -Math.PI / 2; scene.add(ripple);
    return { g, shell, mat, rings, ripple, rippleMat };
  };
  // Phase 16 U2, the Ashwall: a real slab of cooled slag carried before it, glowing in its cracks, turned to Enemy.aux
  // (its shield facing). The front arc and the shelter wedge are 2D floor marks the bridge already carries.
  const slagCracks = (() => { const c = mk(64, 64), k = c.getContext('2d')!; k.fillStyle = '#000'; k.fillRect(0, 0, 64, 64); k.strokeStyle = '#ffffff'; k.lineWidth = 2;
    for (let i = 0; i < 9; i++) { k.beginPath(); let x = Math.random() * 64, y = Math.random() * 64; k.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (Math.random() - 0.5) * 26; y += (Math.random() - 0.5) * 26; k.lineTo(x, y); } k.stroke(); }
    return canvasTex(c); })();
  const shieldMat = new THREE.MeshStandardMaterial({ color: '#4a3e38', roughness: 0.85, metalness: 0.15, emissive: new THREE.Color('#ff7a30'), emissiveMap: slagCracks, emissiveIntensity: 1.1 });
  const shieldGeo = new THREE.BoxGeometry(1, 1, 0.14).translate(0, 0.5, 0);
  // Steve, 23 Nov: "Can't see the enemies... Green = good, red = bad". Every foe gets a faint red outline and a red
  // ring the size of its hit box at its feet; every hero (you and allies) a green outline and a green ring.
  const GOOD = new THREE.Color('#5dff8a'), BAD = new THREE.Color('#ff3b3b');
  /**
   * An outline of a sprite: a quad a little larger than it whose shader lights only the texels just outside the
   * sprite's alpha edge, in one colour. A foe's outline ignores depth (`xray`), so a foe standing behind or under a hero
   * still shows its red edge: melee foes crowd inside your hero's footprint, which hid them completely (23 Nov).
   */
  const rimMat = (tint: THREE.Color, xray: boolean) => new THREE.ShaderMaterial({
    uniforms: { map: { value: null as THREE.Texture | null }, opacity: { value: 0.9 }, tint: { value: tint.clone() }, texel: { value: new THREE.Vector2(1 / 32, 1 / 32) }, k: { value: new THREE.Vector2(1, 1) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D map; uniform float opacity; uniform vec3 tint; uniform vec2 texel; uniform vec2 k; varying vec2 vUv;
      float A(vec2 u) { if (u.x < 0.0 || u.x > 1.0 || u.y < 0.0 || u.y > 1.0) return 0.0; return texture2D(map, u).a; }
      void main() {
        vec2 u = (vUv - vec2(0.5, 0.0)) * k + vec2(0.5, 0.0);
        vec2 dx = vec2(texel.x * 1.5, 0.0), dy = vec2(0.0, texel.y * 1.5);
        float n = max(max(max(A(u + dx), A(u - dx)), max(A(u + dy), A(u - dy))), max(max(A(u + dx + dy), A(u - dx - dy)), max(A(u + dx - dy), A(u - dx + dy))));
        float e = step(0.5, n) * (1.0 - step(0.5, A(u)));
        if (e * opacity < 0.01) discard;
        gl_FragColor = vec4(tint, e * opacity);
      }`,
    transparent: true, depthWrite: false, depthTest: !xray, side: THREE.DoubleSide, toneMapped: false,
  });
  /** Lays `rim` over `m` (same geometry, frame and pose), grown by `grow` world units round the sprite for the edge. */
  const outline = (rim: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>, m: THREE.Mesh, grow: number) => {
    rim.visible = m.visible;
    if (!m.visible) return;
    const map = (m.material as THREE.MeshStandardMaterial).map;
    if (!map) { rim.visible = false; return; }
    const u = rim.material.uniforms;
    u.map.value = map;
    const img = map.image as { width?: number; height?: number } | undefined;
    u.texel.value.set(1 / (img?.width || 32), 1 / (img?.height || 32));
    rim.geometry = m.geometry;
    rim.position.copy(m.position).addScaledVector(camDir, 0.01);
    rim.rotation.copy(m.rotation);
    const sx = Math.abs(m.scale.x) || 1, sy = m.scale.y || 1;
    const kx = 1 + (2 * grow) / sx, ky = 1 + grow / sy;
    rim.scale.set(m.scale.x * kx, sy * ky, 1);
    u.k.value.set(kx, ky);
  };
  const RIM_GROW = 0.05;
  // The Coldmarrow is the darkest floor (design 25 Nov, phone pass: Rimehounds read near-black at 320 px). Seen from
  // above, a low-slung hound is a thin sliver of sprite over its black blob shadow, so there its red ring is brighter
  // and wider and the blob lighter: the ring, not a dark hole, says where the foe is. Same meshes, no extra draws.
  const darkRoom = rid === 'coldmarrow';
  const foeRingGeo = new THREE.RingGeometry(0.86, 1, 40), foeRingDark = new THREE.RingGeometry(0.76, 1, 40);
  const foeBlobMat = darkRoom ? (() => { const m = blobMat.clone(); m.opacity = 0.45; return m; })() : blobMat;
  /** Foes made of rime or pale stone glow more of their own colour, so they read pale on the dark floor. */
  const FOE_GLOW: Partial<Record<string, number>> = { rimehound: 0.8 };
  // Every foe's blob shadow and red ring are two instanced meshes, one draw each for the whole room (they were two
  // meshes a foe: 12 draws for six foes). Same geometry, material and height as before, so they look the same; the
  // blobs are made first so the rings still draw over them. Grown (and remade) when more foes are up than fit.
  const ringMat = new THREE.MeshBasicMaterial({ color: BAD.clone().multiplyScalar(1.2), transparent: true, opacity: darkRoom ? 0.95 : 0.6, depthWrite: false });
  const flatQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const feetOf = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.renderOrder = 2; m.frustumCulled = false; scene.add(m); return m; };
  let feetCap = 32, foeBlobs = feetOf(circle, foeBlobMat, feetCap), foeRings = feetOf(darkRoom ? foeRingDark : foeRingGeo, ringMat, feetCap);
  let feetN = 0;
  const footM = new THREE.Matrix4(), footP = new THREE.Vector3(), footS = new THREE.Vector3();
  /** Puts foe feet number feetN (blob of radius br, ring of radius rr) at x, z. */
  const addFeet = (x: number, z: number, br: number, rr: number) => {
    if (feetN >= feetCap) {
      feetCap *= 2;
      const nb = feetOf(circle, foeBlobMat, feetCap), nr = feetOf(foeRings.geometry, ringMat, feetCap);
      for (let k = 0; k < feetN; k++) { foeBlobs.getMatrixAt(k, footM); nb.setMatrixAt(k, footM); foeRings.getMatrixAt(k, footM); nr.setMatrixAt(k, footM); }
      scene.remove(foeBlobs, foeRings); foeBlobs.dispose(); foeRings.dispose(); foeBlobs = nb; foeRings = nr;
    }
    foeBlobs.setMatrixAt(feetN, footM.compose(footP.set(x, FLOOR + 0.005, z), flatQ, footS.set(br, br, br)));
    foeRings.setMatrixAt(feetN, footM.compose(footP.set(x, FLOOR + 0.031, z), flatQ, footS.set(rr, rr, rr)));
    feetN++;
  };
  const foes: FoeS[] = [];
  const foe = (i: number): FoeS => {
    let f = foes[i];
    if (!f) {
      const mesh = new THREE.Mesh(foeGeo, regentMat); mesh.castShadow = !saver; scene.add(mesh);
      const rim = new THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>(foeGeo, rimMat(BAD, true)); rim.renderOrder = 6; scene.add(rim);
      f = foes[i] = { mesh, rim };
    }
    return f;
  };
  const bossLight = new THREE.PointLight('#ff7a2e', 0, 6, 2); scene.add(bossLight);
  // BOSSV2, the three-stage Kiln Mother (kilnmother3d.ts): her eggs, the heated quarters and the eruption rings; hidden
  // unless World.kmStage is set.
  const km = buildKm3d({ S, floor: FLOOR, arena: 560, /* World ARENA: her fight is always in the 560 room */ bad: BAD, good: GOOD, gold: new THREE.Color('#ffc861'), saver });
  scene.add(km.group);
  // Vorhulm the Glutton's Gorge (BOSSV2, aux2 1 while it heals): red rings draw in to it, as if it is gulping, until
  // someone hits it.
  const gorgeMat = new THREE.MeshBasicMaterial({ color: BAD.clone().multiplyScalar(1.3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const gorgeGeo = new THREE.RingGeometry(0.9, 1, 40);
  const hideExtra = (f: FoeS) => { if (f.bellows) f.bellows.g.visible = false; if (f.gorge) f.gorge.visible = false; };
  // Phase 18 Halls H1: the greybox map (halls3d.ts), built the first frame a run has one. Today's room hides while the
  // party walks the map and comes back when they go through the boss door (World.halls.done).
  let halls: HallsView | null = null, hallsOf: HallsMap | null = null;
  /** Sleeping packs' foes: they aren't in World.enemies until their pack wakes, so they're drawn from the map's plan. */
  type Sleeper = { pack: number; x: number; z: number; mesh: THREE.Mesh; blob: THREE.Mesh; ring: THREE.Mesh; wd: number; ht: number; ph: number };
  const sleepers: Sleeper[] = [];
  const sleepRingMat = new THREE.MeshBasicMaterial({ color: BAD.clone().multiplyScalar(1.2), transparent: true, opacity: 0.45, depthWrite: false });
  const sleepRingGeo = new THREE.RingGeometry(0.86, 1, 40);
  /** Where the two warm room lights stand in today's room, to put them back after the map. */
  const lightHome = flick.map((f) => f.l.position.clone());
  /** Their colour and strength in today's room, for the same reason; on the map the room's theme sets them (H2d). */
  const lightHomeCol = flick.map((f) => f.l.color.clone()), lightHomeBase = flick.map((f) => f.base);
  const themeCol = new THREE.Color();
  const buildHallsView = (m: HallsMap) => {
    if (halls) scene.remove(halls.group);
    for (const z of sleepers) scene.remove(z.mesh, z.blob, z.ring);
    sleepers.length = 0;
    // Corridors take the dungeon's own floor and a darker shade of its wall (the Kiln keeps its brick).
    const hr = ROOMS[rid];
    halls = buildHalls3d(m, { S, floor: FLOOR, tile: rid === 'wrackline' ? '#6a5a48' /* dry timber jetties between the quays */ : hr.tile, ground: hr.ground, lensDais: rid === 'glarewell', corridorWall: rid === 'kiln' ? undefined : '#' + new THREE.Color(hr.wall).multiplyScalar(0.66).getHexString(), saver, bad: BAD, corridor: SIM.hallsCorridor, doorRoom: SIM.hallsDoorRoom });
    scene.add(halls.group);
    hallsOf = m;
    m.packs.forEach((p, k) => p.foes.forEach((f, j) => {
      const key = A.kindTex?.(f.kind) ?? f.kind;
      const mat = foeMat(key, 0);
      if (!mat) return;
      const d = (mat.map as THREE.Texture).userData as { w: number; h: number };
      const mesh = new THREE.Mesh(foeGeo, mat); mesh.castShadow = !saver; scene.add(mesh);
      const blob = flat(circle, foeBlobMat, 0.005);
      const ring = flat(sleepRingGeo, sleepRingMat, 0.031);
      sleepers.push({ pack: k, x: f.x * S, z: f.y * S, mesh, blob, ring, wd: d.w * A.texScale * S, ht: d.h * A.texScale * S, ph: k * 1.3 + j * 0.7 });
    }));
  };
  // Old Vorhulm's Inhale (the Hoard, phase 3): his maw glows and air, ash and embers stream in to it from all round.
  // The floor ring of his bite and the 2D streaks still come through the bridge.
  // The Cinder Colossus's Millstone (the Smeltery, phase 2): as he grinds round, molten slag is flung off his sides and
  // front in arcs (never off his open back, MILL.arc of colFacing), and sparks race round his base the way he turns.
  const MLN = 120;
  const millPos = new Float32Array(MLN * 3);
  const millGeo = new THREE.BufferGeometry(); millGeo.setAttribute('position', new THREE.BufferAttribute(millPos, 3));
  const millMat = new THREE.PointsMaterial({ map: canvasTex(dotCanvas('rgba(255,240,190,1)', 'rgba(255,110,30,0)')), color: new THREE.Color(2.2, 1.1, 0.45), size: 0.42, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const mill = new THREE.Points(millGeo, millMat); mill.frustumCulled = false; mill.visible = false; scene.add(mill);
  // An echoed cast (Phase 16 U1: the boss borrows another version's move): a pale, ghostly double of him swells out
  // and fades for ECHO_GHOST s, with a cold ring at his feet, so the borrowed move reads as not his own.
  const ECHO_GHOST = 1.6;
  // A silhouette: the sprite's alpha only, filled with a cold colour (his own dark colours would add almost nothing).
  const ghostMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: null as THREE.Texture | null }, opacity: { value: 0 }, tint: { value: new THREE.Color(0.45, 0.8, 1.5) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D map; uniform float opacity; uniform vec3 tint; varying vec2 vUv; void main() { float a = texture2D(map, vUv).a * opacity; if (a < 0.01) discard; gl_FragColor = vec4(tint * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const ghost = new THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>(foeGeo, ghostMat); ghost.visible = false; ghost.renderOrder = 3; scene.add(ghost);
  const ghostRing = flat(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.9, 1.5), transparent: true, depthWrite: false }), 0.04);
  ghostRing.visible = false;
  // Grandmother Slag's Overflow (the Crucible raid, phase 2, Y3 #558): molten slag floods in over the floor from the
  // rim and leaves only a dry ring round her (OVERFLOW.safeR). While it warns, the slag creeps in from the arena edge and
  // her safe ring pulses gold; once risen it is a churning, glowing sheet everywhere outside the ring, with a bright
  // crust line where it laps at the dry floor; on the ebb it drains back to the rim.
  const floodMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, inner: { value: 99 }, outer: { value: 8 }, ctr: { value: new THREE.Vector2() }, opacity: { value: 0 } },
    vertexShader: 'varying vec2 vW; void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xz; gl_Position = projectionMatrix * viewMatrix * wp; }',
    fragmentShader: `uniform float time; uniform float inner; uniform float outer; uniform vec2 ctr; uniform float opacity; varying vec2 vW;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main() {
        float d = length(vW - ctr);
        if (d < inner || length(vW) > outer) discard;
        vec2 p = vW * 2.6;
        float k = n(p + vec2(time * 0.35, time * 0.2)) * 0.6 + n(p * 2.3 - vec2(time * 0.5, -time * 0.3)) * 0.4;
        vec3 crust = vec3(0.16, 0.035, 0.01), hot = vec3(1.5, 0.45, 0.08);
        vec3 col = mix(crust, hot, smoothstep(0.5, 0.72, k));
        float lip = 1.0 - smoothstep(0.0, 0.22, d - inner);
        col += vec3(1.8, 0.9, 0.3) * lip;
        float a = opacity * (0.82 + 0.18 * lip) * (1.0 - smoothstep(outer - 0.3, outer, length(vW)));
        gl_FragColor = vec4(col, a);
      }`,
    transparent: true, depthWrite: false, toneMapped: false,
  });
  const flood = flat(new THREE.CircleGeometry(1, 96), floodMat, 0.045); flood.renderOrder = 3; flood.visible = false;
  const safeRing = flat(new THREE.RingGeometry(0.965, 1, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.7, 0.6), transparent: true, depthWrite: false, toneMapped: false }), 0.05);
  safeRing.visible = false;
  let floodK = 0, floodWas = 0;
  const INH = 80;
  const inhPos = new Float32Array(INH * 3);
  const inhGeo = new THREE.BufferGeometry(); inhGeo.setAttribute('position', new THREE.BufferAttribute(inhPos, 3));
  const inhMat = new THREE.PointsMaterial({ map: canvasTex(dotCanvas('rgba(255,236,200,1)', 'rgba(255,140,60,0)')), color: new THREE.Color(1.8, 1.2, 0.8), size: 0.32, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const inhale = new THREE.Points(inhGeo, inhMat); inhale.frustumCulled = false; inhale.visible = false; scene.add(inhale);
  const maw = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(dotCanvas('rgba(255,240,200,1)', 'rgba(255,90,30,0)')), color: new THREE.Color(2.2, 1.2, 0.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  maw.visible = false; scene.add(maw);

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
  // Ondrel's Homeward Hammer (Hammerdeep): a real hammer that wheels through the air, lies head-down rattling as it is
  // called home, then streaks back to him. The 2D one is drawn above the floor layer, so the bridge never carried it.
  // The Regent's Tithe (the Flue, phase 2): a gold tribute dish round the soak circle, its coin stacks rising as the
  // fuse runs, so it reads apart from the Ventwalker and Banked Coal soak circles.
  const goldMat = new THREE.MeshStandardMaterial({ color: '#d8a640', roughness: 0.35, metalness: 0.8, emissive: new THREE.Color('#4a2c06') });
  const coinGeo = new THREE.CylinderGeometry(0.11, 0.11, 1, 12).translate(0, 0.5, 0);
  const dishRim = new THREE.TorusGeometry(1, 0.035, 6, 64).rotateX(Math.PI / 2);
  const dishes: { g: THREE.Group; stacks: THREE.Mesh[] }[] = [];
  const dish = (i: number) => {
    let d = dishes[i];
    if (!d) {
      const g = new THREE.Group(); const rim = new THREE.Mesh(dishRim, goldMat); rim.position.y = 0.04; g.add(rim);
      const stacks: THREE.Mesh[] = [];
      for (let k = 0; k < 8; k++) { const c = new THREE.Mesh(coinGeo, goldMat); c.castShadow = !saver; stacks.push(c); g.add(c); }
      scene.add(g); d = dishes[i] = { g, stacks };
    }
    return d;
  };
  const hammer = new THREE.Group();
  const hamHeadMat = new THREE.MeshStandardMaterial({ color: '#5a524c', roughness: 0.45, metalness: 0.7, emissive: new THREE.Color('#ff9a40'), emissiveIntensity: 0 });
  const hamHead = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.32, 0.32), hamHeadMat); hamHead.castShadow = !saver; hammer.add(hamHead);
  const hamHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.95, 8), new THREE.MeshStandardMaterial({ color: '#6a4426', roughness: 0.9 }));
  hamHandle.position.y = 0.62; hamHandle.castShadow = !saver; hammer.add(hamHandle);
  const hamBand = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 8), hamHeadMat); hamBand.position.y = 0.22; hammer.add(hamBand);
  hammer.visible = false; scene.add(hammer);
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
  // Standing stones (World.stones: the 'pillars' layout, in every dungeon that rolls one). Until 24 Nov the 3D view drew
  // only the Glarewell's pillars, so these blocked heroes and foes unseen. The Kiln and the Flue get square brick piers,
  // as the Kiln room's own; other rooms a rough stone post in their floor's colour. Shorter than the Glarewell's pillars
  // (1.4 units, about 100 world), so a stone hides little of the floor behind it.
  const brickStone = rid === 'kiln' || rid === 'flue';
  const stoneGeo = brickStone ? new THREE.BoxGeometry(1.8, 1, 1.8) : new THREE.CylinderGeometry(0.95, 1.08, 1, 9);
  const stoneMat = brickStone ? new THREE.MeshStandardMaterial({ map: canvasTex(brickCanvas(), { repeat: [1, 2] }), color: '#ffd0b4', emissive: new THREE.Color('#2a1008'), roughness: 0.9 }) : basalt.clone();
  if (!brickStone) (stoneMat as THREE.MeshStandardMaterial).color.set(th0.tile).multiplyScalar(1.15);
  const STONE_H = 1.4;

  /* embers */
  const N = saver ? 60 : 120, pos = new Float32Array(N * 3), vel = new Float32Array(N);
  const spawn = (i: number, cx: number, cz: number, anywhere: boolean) => { const a = rnd(0, Math.PI * 2), r = rnd(0, 7); pos[i * 3] = cx + Math.sin(a) * r; pos[i * 3 + 1] = anywhere ? rnd(0, 6) : rnd(0, 0.4); pos[i * 3 + 2] = cz + Math.cos(a) * r; vel[i] = rnd(0.35, 1.1); };
  for (let i = 0; i < N; i++) spawn(i, 0, 0, true);
  const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const embers = new THREE.Points(pgeo, new THREE.PointsMaterial({ map: canvasTex(dotCanvas('rgba(255,255,255,1)', 'rgba(255,255,255,0)')), color: new THREE.Color(...th0.mote), size: 0.11, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
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
  /** How many foe attacks (lunges) have started, for stats(). */
  let foeAttacks = 0;
  /** Sounds for Hd2dView.sounds since it was last asked, in world units (capped, in case nobody asks). */
  const sfx: RoomSound[] = [];
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
  /** Per enemy index: where its sprite's head was drawn this frame (3D units), for view.foeHead. */
  const foeHeads: { x: number; z: number; h: number; at: number }[] = [];
  let frameNo = 0;
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
    const hm = w.halls, onMap = !!hm && !hm.done;
    if (hm && hm !== hallsOf) buildHallsView(hm);
    room.visible = !onMap;
    if (halls) halls.group.visible = onMap;
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
      // On a Halls map the bridge follows the hero (GameScene centres its camera there and says where).
      bridge.mesh.position.set((fl.x ?? 0) * S, FLOOR + 0.026, (fl.y ?? 0) * S); // tiles reach FLOOR + 0.02 (rnd jitter), so lie above the highest
      if (fl.stamp !== bridge.stamp) { bridge.stamp = fl.stamp; bridge.tex.needsUpdate = true; }
    }
    // Pillars.
    const sig = w.pillars.map((p) => `${p.x | 0},${p.y | 0},${p.r | 0}`).join(';') + '|' + w.stones.map((p) => `${p.x | 0},${p.y | 0},${p.r | 0}`).join(';');
    if (sig !== pillarSig) {
      pillarSig = sig;
      pillarGroup.clear();
      for (const p of w.pillars) {
        if (p.fixed) continue; // H3b: a Cross room's own stone pillar; the room kit draws it
        const m = new THREE.Mesh(pillarGeo, basalt); m.position.set(p.x * S, 1.1, p.y * S); m.scale.set(p.r * S, 2.2, p.r * S);
        m.castShadow = m.receiveShadow = true; pillarGroup.add(m);
      }
      for (const p of w.stones) {
        const m = new THREE.Mesh(stoneGeo, stoneMat); m.position.set(p.x * S, FLOOR + STONE_H / 2, p.y * S); m.scale.set(p.r * S, STONE_H, p.r * S);
        m.rotation.y = ((p.x * 7 + p.y * 13) % 6) * 0.5;
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
      h.mesh.position.set(x + fx * 0.12 * k, FLOOR + bob, z + fz * 0.12 * k);
      if (h.twin) {
        // Your own hero always draws over allies and foes it overlaps, as in 2D (depth 6 over allies' 5.9): phones saw
        // a Lumen bot a step in front cover you completely. The sprite slides toward the camera along its own view ray,
        // so it stays on the same pixels, shrunk to keep its size; the twin left at the true spot casts the shadow.
        h.twin.position.copy(h.mesh.position); h.twin.scale.copy(h.mesh.scale); h.twin.visible = true;
        const lift = Math.min(SELF_LIFT, dist * 0.5);
        h.mesh.position.addScaledVector(camDir, lift);
        h.mesh.scale.multiplyScalar((dist - lift) / dist);
      }
      h.mesh.visible = true;
      (h.mats.idle as THREE.MeshStandardMaterial).opacity = 1;
      h.blob.position.set(x, FLOOR + 0.006, z);
      h.ring.position.set(x, FLOOR + 0.03, z); h.disc.position.set(x, FLOOR + 0.028, z);
      h.ring.visible = h.disc.visible = !dead;
      outline(h.rim, h.mesh, RIM_GROW); if (dead) h.rim.visible = false;
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
    feetN = 0;
    let fi = 0, bossOn = false, bossX = 0, bossZ = 0, bossH = 0, bossR = 0;
    // Steve, 23 Nov: enemies had no attack animation. A foe attacks when its touch timer resets (a melee hit, the
    // 0.6 s touchCd) or its ability timer jumps back up (a shot, a summon, a boss move): it lunges at the nearest hero
    // and squashes, for FOE_ATK s. While casting it rears up and pulses.
    const FOE_ATK = 0.3;
    const heroPts: { x: number; y: number }[] = [];
    for (let j = 0; j < w.heroes.length; j++) { const q = w.heroData(j).player; if (q.hp > 0) heroPts.push({ x: q.x, y: q.y }); }
    let bossMesh: THREE.Mesh | null = null;
    frameNo++;
    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i];
      if (!e.alive) continue;
      const x = L(e.px, e.x) * S, z = L(e.py, e.y) * S;
      if (Math.abs(x - cx) > 9 || z - cz > 6 || cz - z > 12) continue;
      const f = foe(fi++);
      const age = w.time - e.spawnedAt;
      const rise = age < 0.3 ? 0.3 + 0.7 * (age / 0.3) + Math.sin((age / 0.3) * Math.PI) * 0.25 : 1;
      const hit = e.flash > 0 ? 0.1 : 0;
      let fa = foeAtk[i];
      if (!fa || fa.born !== e.spawnedAt) fa = foeAtk[i] = { born: e.spawnedAt, touch: e.touchCd, abil: e.abilityT, at: -9, dx: 0, dz: 1 };
      if (e.touchCd > fa.touch + 0.05 || e.abilityT > fa.abil + 0.05) {
        if (sfx.length < 32) sfx.push({ kind: 'lunge', x: e.x, y: e.y, melee: e.touchCd > fa.touch + 0.05, rank: e.def.rank });
        fa.at = w.time; foeAttacks++;
        let best = Infinity;
        for (const q of heroPts) { const d = (q.x - e.x) ** 2 + (q.y - e.y) ** 2; if (d < best) { best = d; const l = Math.sqrt(d) || 1; fa.dx = (q.x - e.x) / l; fa.dz = (q.y - e.y) / l; } }
      }
      fa.touch = e.touchCd; fa.abil = e.abilityT;
      const sinceAtk = w.time - fa.at;
      const ak = sinceAtk >= 0 && sinceAtk < FOE_ATK ? Math.sin((sinceAtk / FOE_ATK) * Math.PI) : 0;
      const rear = e.castId ? 0.06 + 0.04 * Math.sin(t * 12) : 0;
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
        if (!m) { f.mesh.visible = f.rim.visible = false; if (f.shield) f.shield.visible = false; if (f.anchor) f.anchor.visible = false; if (f.eye) { f.eye.g.visible = false; f.eye.beam.visible = false; } if (f.horn) f.horn.g.visible = false; if (f.conch) { f.conch.g.visible = false; f.conch.ripple.visible = false; } hideExtra(f); continue; }
        f.mesh.geometry = foeGeo; f.mesh.material = m;
        const d = (m.map as THREE.Texture).userData as { w: number; h: number };
        wd = d.w * A.texScale * S; ht = d.h * A.texScale * S;
        m.emissiveIntensity = e.flash > 0 ? Math.max(0.7, FOE_GLOW[e.kind] ?? 0) : FOE_GLOW[e.kind] ?? 0.34; // 0.22 hid foes on the dark floor (Steve, 23 Nov)
      }
      const flip = !e.def.stationary && x > cx ? -1 : 1;
      f.mesh.scale.set(flip * wd * rise * (1 + hit + 0.14 * ak), ht * rise * (1 - hit - 0.1 * ak + rear), 1);
      const reach = Math.min(0.35, (e.def.radius * S) * 0.6) * ak;
      f.mesh.position.set(x + fa.dx * reach, FLOOR, z + fa.dz * reach);
      // Where this foe's head is drawn, for its health and cast bar on the overlay (view.foeHead).
      (foeHeads[i] ??= { x: 0, z: 0, h: 0, at: 0 });
      foeHeads[i].x = f.mesh.position.x; foeHeads[i].z = f.mesh.position.z; foeHeads[i].h = FLOOR + ht * rise * (1 - 0.04); foeHeads[i].at = frameNo;
      if (i === w.bossIndex) { bossX = x; bossZ = z; bossH = ht * rise; bossR = e.def.radius * S; bossMesh = f.mesh; }
      f.mesh.rotation.z = e.stunT > 0 ? Math.sin(t * 16) * 0.1 : -fa.dx * 0.22 * ak;
      f.mesh.visible = true;
      addFeet(x, z, e.def.radius * S * 1.25 * rise, e.def.radius * S * rise);
      if (e.kind === 'ashwall') {
        if (!f.shield) { f.shield = new THREE.Mesh(shieldGeo, shieldMat); f.shield.castShadow = !saver; scene.add(f.shield); }
        const r = e.def.radius * S, fx = Math.cos(e.aux), fz = Math.sin(e.aux);
        f.shield.visible = true;
        f.shield.position.set(x + fa.dx * reach + fx * r * 1.1, FLOOR, z + fa.dz * reach + fz * r * 1.1);
        f.shield.rotation.set(-0.08 - 0.25 * ak, Math.atan2(fx, fz), 0, 'YXZ');
        f.shield.scale.set(r * 2.6, ht * rise * 0.8, 1);
        shieldMat.emissiveIntensity = (e.castId ? 1.8 + 0.6 * Math.sin(t * 14) : 1.1) * (e.flash > 0 ? 1.4 : 1);
      } else if (f.shield) f.shield.visible = false;
      if (e.kind === 'ballast') {
        if (!f.anchor) f.anchor = makeAnchor();
        const r = e.def.radius * S, plant = Math.min(1, Math.max(0, e.aux / BALLAST_PLANT));
        const planted = e.aux >= BALLAST_PLANT, heave = e.castId ? 0.12 + 0.06 * Math.sin(t * 16) : 0;
        const side = flip > 0 ? 1 : -1;
        const ax = x + side * r * 1.15, az = z + r * 0.7; // a little in front, so a planted anchor isn't hidden by the body
        const y = FLOOR + (1 - plant) * 0.9 - (planted ? 0.12 : 0) + heave;
        f.anchor.visible = true; f.anchor.position.set(ax, y, az); f.anchor.scale.setScalar(1.35);
        f.anchor.rotation.set(0, 0, planted ? side * 0.12 : Math.sin(t * 3 + i) * 0.15 * (1 - plant));
        const chain = f.anchor.getObjectByName('chain')!;
        chain.scale.y = Math.max(0.05, ht * rise * 0.55 - (y - FLOOR) * 0.2 + (1 - plant) * 0.2);
        anchorIron.emissiveIntensity = e.castId ? 0.9 + 0.5 * Math.sin(t * 14) : planted ? 0.25 : 0;
      } else if (f.anchor) f.anchor.visible = false;
      if (e.kind === 'lampeye') {
        if (!f.eye) f.eye = makeEye();
        const E = f.eye, k = Math.min(1, e.aux / LAMPEYE_FULL), looking = e.castId === 'searingLook';
        const R = 0.36 * rise * (1 + hit * 0.6), ey = FLOOR + 0.95 + Math.sin(t * 1.7 + i) * 0.08;
        E.g.visible = true; E.g.position.set(x + fa.dx * reach, ey, z + fa.dz * reach); E.g.scale.setScalar(R);
        const me = w.heroData(0).player;
        const tx = me.x * S, tz = me.y * S, ty = FLOOR + 0.75;
        // It looks at you, but turned half toward the camera, so you can see the iris (and which way it is looking)
        // from above instead of the back of its hood.
        {
          const hx = tx - E.g.position.x, hz = tz - E.g.position.z, hl = Math.hypot(hx, hz) || 1;
          pv.copy(E.g.position).addScaledVector(camDir, 1).add(v3.set((hx / hl) * 0.5, 0, (hz / hl) * 0.5));
          E.g.lookAt(pv);
        }
        E.irisMat.emissiveIntensity = (looking ? 2.4 + 0.8 * Math.sin(t * 22) : 0.5 + 1.6 * k) * (e.flash > 0 ? 1.3 : 1);
        E.pupil.scale.setScalar(looking ? 0.35 : 1 - 0.55 * k);
        const sees = me.hp > 0 && w.lampeyeSees(e, me.x, me.y);
        E.beam.visible = sees && (k > 0.02 || looking);
        if (E.beam.visible) {
          const dx = tx - E.g.position.x, dy = ty - ey, dz = tz - E.g.position.z, len = Math.hypot(dx, dy, dz);
          const th = looking ? 0.07 + 0.02 * Math.sin(t * 30) : 0.012 + 0.02 * k;
          E.beam.position.copy(E.g.position); E.beam.lookAt(tx, ty, tz); E.beam.scale.set(th, th, len);
          E.beamMat.opacity = looking ? 0.75 : 0.12 + 0.4 * k;
        }
        // The eye stands in for the sprite: hide the placeholder body and its outline, and hang the bar over the eye.
        f.mesh.visible = false;
        foeHeads[i].h = ey + R * 1.1;
      } else if (f.eye) { f.eye.g.visible = false; f.eye.beam.visible = false; }
      if (e.kind === 'kilnBellows') {
        // A great bellows in 3D stands in for the sprite; its red ring and outline still say "hit this".
        if (!f.bellows) { f.bellows = makeKmBellows(); f.bellows.g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = !saver; }); scene.add(f.bellows.g); }
        const B = f.bellows, sc = e.def.radius * S * 4.4 * rise; // big enough to see past a hero standing at it (QA phone shots, 25 Nov)
        B.g.visible = true; B.g.position.set(x, FLOOR, z); B.g.scale.setScalar(sc);
        B.g.rotation.y = Math.atan2(-x, -z); // its nozzle at the arena centre, where she waits in the kiln's light
        B.set(Math.max(0, e.hp / e.maxHp), t + i, e.flash);
        f.mesh.visible = false;
        foeHeads[i].h = FLOOR + sc * 0.75;
      } else if (f.bellows) f.bellows.g.visible = false;
      if (e.kind === 'ashmaw' && e.aux2 === 1) {
        if (!f.gorge) { f.gorge = flat(gorgeGeo, gorgeMat, 0.034); }
        const r = e.def.radius * S, ph = (t * 1.2) % 1;
        f.gorge.visible = true; f.gorge.position.set(x, FLOOR + 0.034, z); f.gorge.scale.setScalar(r * (2.6 - 1.5 * ph));
        gorgeMat.opacity = 0.75 * Math.sin(ph * Math.PI);
        f.mesh.scale.multiplyScalar(1 + 0.05 * Math.sin(t * 9));
      } else if (f.gorge) f.gorge.visible = false;
      if (e.kind === 'dimhorn') {
        if (!f.horn) f.horn = makeHorn();
        const H = f.horn, calling = e.castId === 'darkCall', k = calling ? 1 : Math.min(1, e.aux / DIMHORN_CALL);
        const side = flip > 0 ? 1 : -1, sc = 1.4 * rise;
        H.g.visible = true;
        H.g.position.set(f.mesh.position.x - side * wd * 0.12, FLOOR + ht * rise * 0.72, f.mesh.position.z + 0.02);
        H.g.scale.set(side * sc, sc, sc);
        H.g.rotation.set(0, 0, calling ? side * (0.5 + 0.06 * Math.sin(t * 18)) : side * 0.12 * k);
        H.mat.emissiveIntensity = calling ? 1.6 + 0.6 * Math.sin(t * 14) : 0.15 + 1.1 * k * k;
        H.mat.color.setRGB(0.85 - 0.25 * k, 0.82 - 0.12 * k, 0.74 + 0.2 * k);
        H.rings.forEach((r, j) => {
          const ph = calling ? ((t * 1.4 + j / 3) % 1) : 0;
          r.visible = calling;
          r.scale.setScalar(0.06 + ph * 0.32);
          r.position.set(hornTip.x + ph * 0.4, hornTip.y + ph * 0.08, 0);
          (r.material as THREE.MeshBasicMaterial).opacity = calling ? 0.8 * (1 - ph) : 0;
        });
      } else if (f.horn) f.horn.g.visible = false;
      if (e.kind === 'conchblower') {
        if (!f.conch) f.conch = makeConch();
        const C = f.conch, calling = e.castId === 'conchCall';
        const cf = calling ? Math.min(1, e.castT / Math.max(0.01, e.castDur)) : 0, lift = calling ? Math.min(1, cf * 4) : 0;
        const side = flip > 0 ? 1 : -1, sc = 0.75 * rise;
        C.g.visible = true;
        // At rest under its arm at hip height; through the call raised to its mouth, mouth pointing out to the side.
        C.g.position.set(f.mesh.position.x + side * wd * (0.6 - 0.1 * lift), FLOOR + ht * rise * (0.38 + 0.4 * lift), f.mesh.position.z + 0.05);
        C.g.scale.set(side * sc, sc, sc);
        C.shell.rotation.set(Math.sin(t * 2 + i) * 0.1 * (1 - lift), 0, 0.25 * lift + (calling ? 0.04 * Math.sin(t * 20) : 0));
        C.mat.emissiveIntensity = calling ? 0.25 + 0.5 * cf + 0.15 * Math.sin(t * 16) : 0;
        C.rings.forEach((r, j) => {
          const ph = (t * 1.6 + j / 3) % 1;
          r.visible = calling && lift > 0.9;
          r.position.set(0.25 + ph * 0.6, 0.06 * ph, 0); r.scale.setScalar(0.1 + ph * 0.5);
          (r.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - ph);
        });
        C.ripple.visible = calling;
        if (calling) {
          const ph = (t * 0.9) % 1;
          C.ripple.position.set(x, FLOOR + 0.035, z); C.ripple.scale.setScalar(e.def.radius * S * (1.5 + ph * 4));
          C.rippleMat.opacity = 0.55 * (1 - ph);
        }
      } else if (f.conch) { f.conch.g.visible = false; f.conch.ripple.visible = false; }
      outline(f.rim, f.mesh, RIM_GROW);
    }
    foeBlobs.count = foeRings.count = feetN; foeBlobs.instanceMatrix.needsUpdate = foeRings.instanceMatrix.needsUpdate = true;
    for (let i = fi; i < foes.length; i++) { foes[i].mesh.visible = false; foes[i].rim.visible = false; if (foes[i].shield) foes[i].shield!.visible = false; if (foes[i].anchor) foes[i].anchor!.visible = false; if (foes[i].eye) { foes[i].eye!.g.visible = false; foes[i].eye!.beam.visible = false; } if (foes[i].horn) foes[i].horn!.g.visible = false; if (foes[i].conch) { foes[i].conch!.g.visible = false; foes[i].conch!.ripple.visible = false; } hideExtra(foes[i]); }
    bossLight.intensity = bossOn ? 10 * (0.8 + 0.2 * Math.sin(t * 1.6)) : 0;
    const echoAge = w.time - (A.echoAt?.() ?? -Infinity);
    const echoing = !!bossMesh && echoAge >= 0 && echoAge < ECHO_GHOST;
    // The Overflow. floodK eases the rise (stage 2) and the ebb (back to 0) so the sheet never pops.
    {
      const st = w.flowStage, boss = w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
      const on = !!boss?.alive && st > 0;
      if (st === 2) floodK = Math.min(1, floodK + dt / 0.45); else floodK = Math.max(0, floodK - dt / (floodWas === 2 ? 0.8 : 0.3));
      floodWas = st;
      const warnK = st === 1 ? Math.min(1, Math.max(0, 1 - w.flowT / SIM.overflowWarn)) : 0;
      const showFlood = !!boss?.alive && (st === 1 || floodK > 0);
      flood.visible = showFlood; safeRing.visible = on;
      if (boss && showFlood) {
        const ar = w.arenaR * S, sr = SIM.overflowSafeR * S, bx = L(boss.px, boss.x) * S, bz = L(boss.py, boss.y) * S;
        const u = floodMat.uniforms;
        u.time.value = t; u.outer.value = ar; u.ctr.value.set(bx, bz);
        // Warning: the slag creeps in from the rim, a third of the way. Risen: right up to her safe ring. Ebb: back out.
        const reach = st === 1 ? ar - (ar - sr) * 0.35 * warnK : ar - (ar - sr) * floodK;
        u.inner.value = Math.max(sr, reach);
        u.opacity.value = st === 1 ? 0.55 + 0.25 * warnK : 0.92 * Math.max(floodK, 0.2);
        flood.scale.setScalar(ar + 0.1); flood.position.y = FLOOR + 0.045 + 0.04 * floodK;
      }
      if (boss && on) {
        const bx = L(boss.px, boss.x) * S, bz = L(boss.py, boss.y) * S, sr = SIM.overflowSafeR * S;
        safeRing.position.set(bx, FLOOR + 0.06 + 0.04 * floodK, bz); safeRing.scale.setScalar(sr);
        (safeRing.material as THREE.MeshBasicMaterial).opacity = st === 1 ? 0.45 + 0.45 * Math.abs(Math.sin(t * 6)) : 0.9;
      }
    }
    ghost.visible = ghostRing.visible = echoing;
    if (echoing && bossMesh) {
      const bm = bossMesh as THREE.Mesh;
      const k = echoAge / ECHO_GHOST;
      const map = (bm.material as THREE.MeshStandardMaterial).map;
      ghostMat.uniforms.map.value = map;
      ghost.geometry = bm.geometry;
      ghost.position.copy(bm.position).addScaledVector(camDir, 0.05); ghost.position.y += 0.1 * k;
      ghost.scale.copy(bm.scale).multiplyScalar(1.04 + 0.22 * k);
      ghostMat.uniforms.opacity.value = 0.8 * (1 - k) * (0.8 + 0.2 * Math.sin(t * 20));
      ghostRing.position.set(bossX, FLOOR + 0.04, bossZ); ghostRing.scale.setScalar(bossR * (1.1 + 0.9 * k));
      (ghostRing.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k);
    }
    const milling = w.millT > 0 && bossH > 0;
    mill.visible = milling;
    if (milling) {
      const reach = 200 * S, arc = 2.1, face = w.colFacing; // MILL.range, MILL.arc
      for (let k = 0; k < MLN; k++) {
        const h = Math.sin(k * 12.9898 + 4.1) * 43758.5453, rr = h - Math.floor(h);
        if (k < 90) {
          // Slag: each blob is flung from his edge out to his reach on a low arc, then lands and starts again.
          const ph = (t * (0.9 + 0.5 * rr) + rr * 7) % 1;
          const a = face + (rr * 2 - 1) * arc * 0.97;
          const r = bossR * 0.9 + reach * ph * (0.55 + 0.45 * ((k * 0.618) % 1));
          millPos[k * 3] = bossX + Math.cos(a) * r;
          millPos[k * 3 + 1] = FLOOR + 0.05 + Math.sin(ph * Math.PI) * (0.5 + 0.6 * rr) + 0.35 * (1 - ph);
          millPos[k * 3 + 2] = bossZ + Math.sin(a) * r;
        } else {
          // Grinding sparks round his base, racing the way he turns (millDir).
          const a = w.millDir * t * 2.7 + ((k - 90) / (MLN - 90)) * Math.PI * 2;
          millPos[k * 3] = bossX + Math.cos(a) * bossR; millPos[k * 3 + 1] = FLOOR + 0.12 + 0.1 * rr; millPos[k * 3 + 2] = bossZ + Math.sin(a) * bossR;
        }
      }
      millGeo.attributes.position.needsUpdate = true;
    }
    const inh = (w.bossVariant === 'inhale' || w.bossEcho === 'inhale') && w.inhaleStage > 0 && bossH > 0 ? w.inhaleStage : 0;
    inhale.visible = maw.visible = inh > 0;
    if (inh) {
      const my = FLOOR + bossH * 0.55, mz = bossZ + 0.08;
      const glow = inh === 2 ? 1 : 0.45 + 0.35 * Math.sin(t * 9);
      maw.position.set(bossX, my, mz); maw.scale.setScalar(0.7 + 0.6 * glow);
      bossLight.position.set(bossX, my, bossZ + 0.7); bossLight.intensity = 4 + 10 * glow;
      // Each mote spirals in from 3-6 units out, rising to his maw; faster and denser while he breathes in.
      const n = inh === 2 ? INH : 14, speed = inh === 2 ? 0.9 : 0.25;
      for (let k = 0; k < INH; k++) {
        if (k >= n) { inhPos[k * 3 + 1] = -50; continue; }
        const h = Math.sin(k * 78.233) * 43758.5453, rr = h - Math.floor(h);
        const ph = (t * speed + rr) % 1, a = k * 2.399 + ph * 1.4;
        const r = (3 + 3 * rr) * (1 - ph) ** 1.4 + 0.15;
        inhPos[k * 3] = bossX + Math.cos(a) * r;
        inhPos[k * 3 + 1] = FLOOR + 0.25 + (my - FLOOR - 0.25) * ph * ph + 0.3 * rr * (1 - ph);
        inhPos[k * 3 + 2] = mz + Math.sin(a) * r;
      }
      inhGeo.attributes.position.needsUpdate = true;
      inhMat.opacity = inh === 2 ? 0.95 : 0.6;
    }

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

    // Tithe dishes (the Regent's gold soak circle, owner -5).
    let tdi = 0;
    for (const g of w.telegraphs) {
      if (!g.alive || g.kind !== 'soak' || g.owner !== -5) continue;
      const d = dish(tdi++), r = g.r * S, prog = Math.min(1, Math.max(0, g.t / Math.max(0.01, g.dur)));
      d.g.visible = true; d.g.position.set(g.x * S, FLOOR, g.y * S);
      d.g.children[0].scale.set(r, 1, r);
      d.stacks.forEach((c, k) => {
        const a = (k / 8) * Math.PI * 2 + 0.2;
        c.position.set(Math.cos(a) * r * 0.86, 0, Math.sin(a) * r * 0.86);
        c.scale.set(1, 0.04 + (0.08 + 0.05 * (k % 3)) * prog * 2, 1);
      });
    }
    for (let i = tdi; i < dishes.length; i++) dishes[i].g.visible = false;

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

    // The Homeward Hammer (mirrors GameScene.homeDraw's timing: HOMEWARD.fall 1.8 s out, HOMEWARD.back 1.2 s home).
    const hb = w.bossVariant === 'home' && w.homeStage > 0 && w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
    hammer.visible = !!hb;
    if (hb) {
      const bx = L(hb.px, hb.x) * S, bz = L(hb.py, hb.y) * S, hx = w.homeX * S, hz = w.homeY * S;
      const yaw = Math.atan2(hz - bz, hx - bx);
      if (w.homeStage === 1) {
        const f = Math.min(1, Math.max(0, 1 - w.homeT / 1.8));
        const lift = Math.sin(Math.PI * f) * 150 * S * (1 - 0.3 * f);
        hammer.position.set(bx + (hx - bx) * f, FLOOR + 0.6 * (1 - f) + 0.2 + lift, bz + (hz - bz) * f);
        hammer.rotation.set(0, -yaw, -t * 14, 'YXZ');
        hamHeadMat.emissiveIntensity = 0.15;
      } else {
        const left = Math.max(0, w.homeT), pull = 1 - left / 1.2;
        if (left > 0.25) {
          // Head-down in the crater, rattling harder as it is called home, glowing hotter.
          const jig = Math.sin(t * (pull > 0.6 ? 40 : 18)) * (0.04 + 0.1 * pull);
          hammer.position.set(hx, FLOOR + 0.12, hz);
          hammer.rotation.set(0, -yaw, jig + 0.25 * pull, 'YXZ');
          hamHeadMat.emissiveIntensity = 0.1 + 0.9 * pull;
        } else {
          const f = 1 - left / 0.25;
          hammer.position.set(hx + (bx - hx) * f, FLOOR + 0.12 + 0.6 * f, hz + (bz - hz) * f);
          hammer.rotation.set(0, -yaw, t * 25, 'YXZ');
          hamHeadMat.emissiveIntensity = 1;
        }
      }
    }

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
    for (const d of drift) { d.offset.x = (t * 0.012) % 1; d.offset.y = (t * 0.007) % 1; }
    for (const f of life) f(t);
    // Room units to world: the room is centred on the arena and scaled so ROOM_R is World.arenaR.
    for (const h of heard.splice(0)) if (sfx.length < 32) sfx.push({ kind: h.kind, x: (h.x * w.arenaR) / ROOM_R, y: (h.z * w.arenaR) / ROOM_R });
    glows.forEach((g, i) => g.color.copy(g.userData.base as THREE.Color).multiplyScalar(0.86 + 0.08 * Math.sin(t * 5 + i * 2.3) + 0.06 * Math.sin(t * 13 + i)));
    { const me = w.heroData(0).player, mk = km.update(w, t, me.x, me.y); if (kilnMouth && mk !== 1) kilnMouth.color.multiplyScalar(mk); }
    for (let i = 0; i < N; i++) {
      pos[i * 3 + 1] += vel[i] * dt; pos[i * 3] += Math.sin(t * 0.8 + i) * dt * 0.25;
      if (pos[i * 3 + 1] > 6) spawn(i, cx, cz, false);
    }
    pgeo.attributes.position.needsUpdate = true;

    // The camera follows the hero like the 2D camera, at the handoff's angle; the sun's shadow box follows too.
    // GameScene's focus offset (phones: keep the boss clear of the ability buttons) moves the camera, not the lamp.
    const fo = A.focus?.();
    const look = v3.set(cx + (fo?.x ?? 0) * S, 0, cz - 0.9 + (fo?.y ?? 0) * S);
    // The Halls room zoom (GameScene, from engineering's camera rule): 1 is today's framing, above 1 shows more.
    camera.position.copy(camDir).multiplyScalar(dist * (A.zoom?.() ?? 1)).add(look);
    if (hm && halls) {
      const me = w.player;
      halls.update(hm, look.x, look.z, me.x, me.y, t);
      for (const z of sleepers) {
        const on = onMap && hm.packs[z.pack].state === 'asleep' && Math.abs(z.x - look.x) < 10 && z.z - look.z < 7 && look.z - z.z < 14;
        z.mesh.visible = z.blob.visible = z.ring.visible = on;
        if (!on) continue;
        // Asleep: standing still, breathing slowly.
        const br = 1 + 0.025 * Math.sin(t * 1.6 + z.ph);
        z.mesh.scale.set(z.wd, z.ht * br, 1); z.mesh.position.set(z.x, FLOOR, z.z);
        z.blob.position.set(z.x, FLOOR + 0.005, z.z); z.blob.scale.setScalar(z.wd * 0.55);
        z.ring.position.set(z.x, FLOOR + 0.031, z.z); z.ring.scale.setScalar(z.wd * 0.45);
      }
      // The two warm room lights stay two (a light switched on or off recompiles every material): on the map they move
      // to the back of the room the hero is in and just ahead of the hero; through the boss door, back home.
      if (onMap) {
        let best = hm.rooms[0], bd = Infinity, bi = 0;
        hm.rooms.forEach((r, i) => { const d = Math.hypot(me.x - r.x, me.y - r.y) - r.r; if (d < bd) { bd = d; best = r; bi = i; } });
        flick[0]?.l.position.set(best.x * S, 3, (best.y - best.r * 0.45) * S);
        flick[1]?.l.position.set(cx, 2.2, cz + 3.2);
        // The room's theme colours both lights, eased so walking through a doorway blends one room into the next; a
        // Bellows hall or Slag channel swells slowly (the quiet motion), never faster than a breath.
        const th = halls.theme(bi), ease = Math.min(1, 2.5 * (1 / 60));
        themeCol.set(th.light);
        const swell = th.swell > 0 ? 1 + 0.12 * Math.sin(t * 2 * Math.PI * th.swell) : 1;
        flick.slice(0, 2).forEach((f, k) => { f.l.color.lerp(themeCol, ease); f.base += (lightHomeBase[k] * th.lightK * swell - f.base) * ease * 4; });
      } else flick.forEach((f, k) => { f.l.position.copy(lightHome[k]); f.l.color.copy(lightHomeCol[k]); f.base = lightHomeBase[k]; });
    }
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
    foeHead(i) {
      const f = foeHeads[i];
      if (!f || f.at !== frameNo || !W || !H) return null;
      const p = pv.set(f.x, f.h, f.z).project(camera);
      if (p.z > 1) return null;
      return { x: (p.x + 1) / 2 * W, y: (1 - p.y) / 2 * H };
    },
    sounds() {
      return sfx.splice(0);
    },
    stats() {
      const ms = times.length ? times.reduce((x, y) => x + y, 0) / times.length : 0;
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, ms: +ms.toFixed(2), fx, pixelRatio: pr, attacks, foeAttacks };
    },
  };
}
