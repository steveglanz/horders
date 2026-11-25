/**
 * Phase 18 Halls H2d, the 3D side of room themes (data in client/hallsthemes.ts; design plan /mnt/project-files/horders/design/halls/h2-plan.md; names, looks and the
 * final list are visuals', agreed with design 25 Nov). Each room of the map rolls a theme, and it decides the room's
 * floor tiles, wall colour, the colour of the two moving room lights, its props and one quiet motion. Steve's look
 * rules: rooms brighter, a little quiet motion and never busy; red means bad and green means good, so no theme lights a
 * room red-on-red or green.
 *
 * Cost: themes share one wall material (instance colours), one prop material and one shader; each room adds one prop
 * batch (one draw call), and steam (Cooling yard posts, Foundry boilers) one batch for the whole map.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { THEMES, type Theme, type ThemeId } from '../hallsthemes';

export { THEMES, PROP_SCALE, themeOf, themeSpots, type Theme, type ThemeId } from '../hallsthemes';

/** Paints a theme's floor tiles: the room's brick pattern in its colour, with cracks for the cracked ones. */
export function themeTileCanvas(th: Theme, paint: (color: string) => HTMLCanvasElement): HTMLCanvasElement {
  if (th.water) return waterCanvas(th.tile);
  const c = paint(th.tile);
  if (!th.cracked) return c;
  const k = c.getContext('2d')!;
  let s = 13;
  const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  k.strokeStyle = 'rgba(10,6,5,0.55)'; k.lineWidth = 1.2;
  for (let i = 0; i < 7; i++) {
    let x = r() * 128, y = r() * 128;
    k.beginPath(); k.moveTo(x, y);
    for (let j = 0; j < 4; j++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; k.lineTo(x, y); }
    k.stroke();
  }
  return c;
}

/** Open water for a quay floor: the water's colour, a little darker in soft patches, with pale ripple lines (tiles). */
function waterCanvas(color: string): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const k = c.getContext('2d')!;
  k.fillStyle = color; k.fillRect(0, 0, 128, 128);
  let s = 29;
  const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < 10; i++) { k.fillStyle = 'rgba(0,10,14,0.18)'; k.beginPath(); k.ellipse(r() * 128, r() * 128, 14 + r() * 20, 6 + r() * 8, 0, 0, 7); k.fill(); }
  k.strokeStyle = 'rgba(200,240,250,0.22)'; k.lineWidth = 1.4;
  for (let i = 0; i < 14; i++) {
    const x = r() * 128, y = r() * 128, w = 10 + r() * 16;
    for (const dx of [0, 128, -128]) for (const dy of [0, 128, -128]) { k.beginPath(); k.arc(x + dx, y + dy, w, Math.PI * 1.15, Math.PI * 1.85); k.stroke(); }
  }
  return c;
}

/** One coloured part of a prop. */
const part = (g: THREE.BufferGeometry, color: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry => {
  const p = g.index ? g.toNonIndexed() : g.clone();
  p.scale(sx, sy, sz); p.translate(x, y, z);
  const c = new THREE.Color(color), n = p.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  p.setAttribute('color', new THREE.BufferAttribute(a, 3));
  p.deleteAttribute('uv');
  return p;
};

/**
 * Each theme's prop as one geometry with vertex colours, standing on y = 0 with its back to -z (the wall), in 3D units.
 * Only the shrine's candle flames are near-white; nothing else glows, since on the map glow and red mean danger.
 */
export function themeProp(id: ThemeId): THREE.BufferGeometry {
  const box = new THREE.BoxGeometry(1, 1, 1), ball = new THREE.SphereGeometry(0.5, 10, 7), cone = new THREE.ConeGeometry(0.5, 1, 10), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
  const parts: THREE.BufferGeometry[] = [];
  if (id === 'ash') {
    // Two grey sacks leaning on a crate.
    parts.push(part(box, '#6a5446', 0, 0.25, -0.05, 0.5, 0.5, 0.45));
    parts.push(part(ball, '#a89c90', -0.42, 0.2, 0.05, 0.5, 0.42, 0.44));
    parts.push(part(ball, '#988c82', 0.4, 0.18, 0.12, 0.46, 0.38, 0.42));
    parts.push(part(ball, '#b0a498', -0.1, 0.56, -0.02, 0.42, 0.34, 0.38));
  } else if (id === 'bellows') {
    // Leather bellows: two boards and the leather between (this part breathes), an iron nozzle and a handle.
    parts.push(part(box, '#5a3424', 0, 0.08, 0, 0.9, 0.06, 0.62));
    parts.push(part(box, '#a8683e', 0, 0.26, 0, 0.84, 0.3, 0.56));
    parts.push(part(box, '#5a3424', 0, 0.44, 0, 0.9, 0.06, 0.62));
    parts.push(part(box, '#2e2624', 0, 0.26, 0.42, 0.14, 0.14, 0.3));
    parts.push(part(box, '#3a2a22', 0, 0.62, -0.28, 0.08, 0.36, 0.08));
  } else if (id === 'slag') {
    // A slag heap with a lighter, cooled crust on top, and a smaller one beside it (no glow: on the map, glow means lava).
    parts.push(part(cone, '#4a302a', 0, 0.28, 0, 0.9, 0.56, 0.9));
    parts.push(part(cone, '#7a5a48', 0, 0.5, 0, 0.26, 0.14, 0.26));
    parts.push(part(cone, '#442c26', 0.5, 0.17, 0.2, 0.5, 0.34, 0.5));
    parts.push(part(cone, '#6e5040', 0.5, 0.3, 0.2, 0.14, 0.08, 0.14));
  } else if (id === 'boiler') {
    // A brass boiler: a round drum on iron feet, two dark bands, a domed top and a stack (steam rises off it).
    parts.push(part(box, '#2e2a28', 0, 0.05, 0, 0.7, 0.1, 0.5));
    parts.push(part(cyl, '#b08a4a', 0, 0.55, 0, 0.72, 0.9, 0.72));
    parts.push(part(cyl, '#3a3430', 0, 0.35, 0, 0.74, 0.06, 0.74));
    parts.push(part(cyl, '#3a3430', 0, 0.8, 0, 0.74, 0.06, 0.74));
    parts.push(part(ball, '#a07a40', 0, 1.0, 0, 0.72, 0.4, 0.72));
    parts.push(part(cyl, '#3a3430', 0.18, 1.2, -0.1, 0.12, 0.3, 0.12));
  } else if (id === 'cistern') {
    // A low stone basin of still dark water.
    parts.push(part(box, '#6a7472', 0, 0.16, 0, 0.9, 0.32, 0.6));
    parts.push(part(box, '#2e5662', 0, 0.3, 0, 0.76, 0.03, 0.46));
  } else if (id === 'pump') {
    // A pump: an iron housing on a stone block, and a plunger rod above it (the whole pump strokes slowly).
    parts.push(part(box, '#5a5048', 0, 0.12, 0, 0.6, 0.24, 0.5));
    parts.push(part(cyl, '#6e7a78', 0, 0.5, 0, 0.42, 0.56, 0.42));
    parts.push(part(cyl, '#3e4446', 0, 0.9, 0, 0.1, 0.3, 0.1));
    parts.push(part(box, '#4a3a30', 0, 1.06, 0, 0.6, 0.06, 0.08));
  } else if (id === 'anchor') {
    // An anchor leaning on the wall, and a coil of chain at its foot.
    parts.push(part(box, '#3e4446', 0, 0.55, -0.1, 0.1, 1.0, 0.1));
    parts.push(part(box, '#3e4446', 0, 0.95, -0.1, 0.5, 0.08, 0.08));
    parts.push(part(box, '#3e4446', -0.2, 0.12, -0.1, 0.36, 0.08, 0.08));
    parts.push(part(box, '#3e4446', 0.2, 0.12, -0.1, 0.36, 0.08, 0.08));
    parts.push(part(cyl, '#555c5e', 0.32, 0.06, 0.18, 0.4, 0.12, 0.4));
    parts.push(part(cyl, '#2e3234', 0.32, 0.075, 0.18, 0.2, 0.13, 0.2));
  } else if (id === 'lens') {
    // A great lens on a brass stand: three legs, a post, and the pale gold glass in a brass rim, tilted to the room.
    for (const a of [0, 2.1, 4.2]) parts.push(part(box, '#8a6a34', Math.cos(a) * 0.2, 0.15, Math.sin(a) * 0.2 - 0.05, 0.05, 0.3, 0.05));
    parts.push(part(cyl, '#b8904a', 0, 0.55, -0.05, 0.08, 0.8, 0.08));
    const rim = new THREE.TorusGeometry(0.34, 0.05, 6, 20); rim.rotateX(-0.35);
    parts.push(part(rim, '#c8a058', 0, 1.1, 0));
    const glass = new THREE.CylinderGeometry(0.32, 0.32, 0.04, 20); glass.rotateX(Math.PI / 2 - 0.35);
    parts.push(part(glass, '#f4e6c0', 0, 1.1, 0));
  } else if (id === 'orrery') {
    // A brass orrery: a stone pedestal, two crossed rings and a pale ball in the middle (the whole top turns slowly).
    parts.push(part(cyl, '#5a5670', 0, 0.2, 0, 0.5, 0.4, 0.5));
    parts.push(part(cyl, '#b8904a', 0, 0.5, 0, 0.06, 0.3, 0.06));
    const r1 = new THREE.TorusGeometry(0.36, 0.03, 6, 24); r1.rotateX(Math.PI / 2 - 0.4);
    const r2 = new THREE.TorusGeometry(0.36, 0.03, 6, 24); r2.rotateY(Math.PI / 2); r2.rotateZ(0.3);
    parts.push(part(r1, '#c8a058', 0, 0.9, 0), part(r2, '#b08848', 0, 0.9, 0));
    parts.push(part(ball, '#e8e0ff', 0, 0.9, 0, 0.22, 0.22, 0.22));
  } else if (id === 'colonnade') {
    // A broken column (base, a shaft snapped off) and a fallen drum beside it.
    parts.push(part(box, '#6e6a84', 0, 0.08, 0, 0.6, 0.16, 0.6));
    parts.push(part(cyl, '#8a84a4', 0, 0.62, 0, 0.42, 0.95, 0.42));
    parts.push(part(cone, '#8a84a4', 0.05, 1.12, 0, 0.42, 0.14, 0.42));
    const drum = new THREE.CylinderGeometry(0.5, 0.5, 1, 12); drum.rotateZ(Math.PI / 2);
    parts.push(part(drum, '#7c7898', 0.55, 0.2, 0.25, 0.4, 0.4, 0.4));
  } else if (id === 'mirror') {
    // A tall mirror in a brass frame, leaning on the wall on two feet; the glass is pale and cool.
    parts.push(part(box, '#b8904a', 0, 0.7, -0.12, 0.62, 1.3, 0.06));
    parts.push(part(box, '#dde4f4', 0, 0.7, -0.08, 0.52, 1.18, 0.02));
    parts.push(part(box, '#8a6a34', -0.24, 0.04, 0.02, 0.08, 0.08, 0.3));
    parts.push(part(box, '#8a6a34', 0.24, 0.04, 0.02, 0.08, 0.08, 0.3));
  } else if (id === 'hearthless') {
    // A dead hearth: a stone surround with a dark mouth, grey ash and two charred logs on the floor before it (no fire).
    parts.push(part(box, '#5a6070', 0, 0.45, -0.15, 1.0, 0.9, 0.3));
    parts.push(part(box, '#1c1e24', 0, 0.32, -0.02, 0.56, 0.5, 0.04));
    parts.push(part(box, '#6a7080', 0, 0.94, -0.12, 1.1, 0.08, 0.36));
    parts.push(part(ball, '#7c7e84', 0, 0.03, 0.2, 0.7, 0.08, 0.36));
    const log = new THREE.CylinderGeometry(0.5, 0.5, 1, 8); log.rotateZ(Math.PI / 2);
    parts.push(part(log, '#2a2624', -0.05, 0.08, 0.18, 0.5, 0.12, 0.12), part(log, '#2e2a28', 0.08, 0.1, 0.26, 0.42, 0.11, 0.11));
  } else if (id === 'rime') {
    // An ice-crusted stone stump with a frosted cap and three icicles hanging off its lip.
    parts.push(part(cyl, '#5c6a80', 0, 0.35, 0, 0.5, 0.7, 0.5));
    parts.push(part(cyl, '#d4e4f4', 0, 0.74, 0, 0.56, 0.1, 0.56));
    for (const [x, z, h] of [[-0.18, 0.2, 0.3], [0.05, 0.27, 0.22], [0.22, 0.14, 0.34]] as const) {
      const ic = new THREE.ConeGeometry(0.5, 1, 6); ic.rotateX(Math.PI);
      parts.push(part(ic, '#c8dcf0', x, 0.69 - h / 2, z, 0.06, h, 0.06));
    }
  } else if (id === 'drift') {
    // Snow heaped against the wall: three soft white mounds.
    parts.push(part(ball, '#e4ecf4', 0, 0.1, -0.05, 1.0, 0.42, 0.6));
    parts.push(part(ball, '#d8e2ee', -0.42, 0.06, 0.08, 0.56, 0.26, 0.44));
    parts.push(part(ball, '#dce6f0', 0.4, 0.05, 0.12, 0.5, 0.22, 0.4));
  } else if (id === 'crypt') {
    // A stone coffin along the wall: a dark box with a lid stepping in, frost on the lid.
    parts.push(part(box, '#4a4e5e', 0, 0.22, 0, 1.0, 0.44, 0.46));
    parts.push(part(box, '#5c6072', 0, 0.48, 0, 0.94, 0.08, 0.42));
    parts.push(part(box, '#c4d0e0', 0, 0.53, 0, 0.7, 0.02, 0.26));
  } else if (id === 'quay') {
    // A stone bollard with a coil of rope round its foot, and a lantern on a post beside it (its glass pale, not lit red).
    parts.push(part(cyl, '#5a6062', 0, 0.25, 0, 0.36, 0.5, 0.36));
    parts.push(part(ball, '#6a7072', 0, 0.52, 0, 0.42, 0.2, 0.42));
    parts.push(part(cyl, '#a08a64', 0, 0.08, 0, 0.56, 0.12, 0.56));
    parts.push(part(box, '#3a3230', 0.45, 0.5, -0.05, 0.06, 1.0, 0.06));
    parts.push(part(box, '#fff0c8', 0.45, 1.05, -0.05, 0.14, 0.16, 0.14));
  } else if (id === 'wreck') {
    // Three hull ribs curving up out of the water and a barrel on its side.
    const rib = new THREE.TorusGeometry(0.5, 0.05, 5, 10, Math.PI * 0.6);
    for (const x of [-0.3, 0, 0.3]) { const g = rib.clone(); g.rotateY(Math.PI / 2); g.rotateX(-0.2); parts.push(part(g, '#5a4434', x, 0, -0.1)); }
    const barrel = new THREE.CylinderGeometry(0.5, 0.5, 1, 10); barrel.rotateZ(Math.PI / 2);
    parts.push(part(barrel, '#7a5a3c', 0.45, 0.14, 0.3, 0.38, 0.28, 0.28));
  } else if (id === 'kelp') {
    // Kelp fronds, tall thin blades leaning a little (the whole clump sways slowly).
    for (const [x, z, h, c] of [[-0.25, 0, 0.9, '#3e6a4a'], [0, 0.1, 1.2, '#4a7a52'], [0.22, -0.05, 0.8, '#3a5e44'], [0.08, 0.25, 0.6, '#46724e']] as const) {
      parts.push(part(cone, c, x, h / 2, z, 0.12, h, 0.06));
    }
  } else if (id === 'sluice') {
    // A sluice gate: two iron posts, a gate panel between them and a wheel on top.
    parts.push(part(box, '#3e4446', -0.42, 0.6, -0.1, 0.1, 1.2, 0.1), part(box, '#3e4446', 0.42, 0.6, -0.1, 0.1, 1.2, 0.1));
    parts.push(part(box, '#5c5448', 0, 0.4, -0.1, 0.76, 0.7, 0.06));
    const wheel = new THREE.TorusGeometry(0.22, 0.03, 5, 16);
    parts.push(part(wheel, '#6e7a7c', 0, 1.32, -0.06));
  } else if (id === 'anvil') {
    // A great anvil on an oak block, a hammer leaning against the block.
    parts.push(part(box, '#5a4030', 0, 0.2, 0, 0.5, 0.4, 0.42));
    parts.push(part(box, '#3e3c46', 0, 0.48, 0, 0.32, 0.16, 0.26));
    parts.push(part(box, '#4a4854', 0, 0.62, 0, 0.78, 0.14, 0.3));
    parts.push(part(cone, '#4a4854', 0.5, 0.62, 0, 0.14, 0.24, 0.14).rotateZ(0));
    parts.push(part(box, '#6a4a30', 0.38, 0.32, 0.3, 0.05, 0.62, 0.05));
    parts.push(part(box, '#3a3842', 0.38, 0.64, 0.3, 0.24, 0.1, 0.12));
  } else if (id === 'chain') {
    // An iron bracket high on the wall with three heavy chains hanging from it, the middle one ending in a hook. It
    // swings from the bracket (CHAIN_TOP), so the bracket barely moves.
    parts.push(part(box, '#3e3c46', 0, CHAIN_TOP, -0.1, 0.7, 0.1, 0.16));
    for (const [x, l] of [[-0.24, 0.8], [0, 1.05], [0.24, 0.65]] as const) parts.push(part(box, '#5a5866', x, CHAIN_TOP - l / 2, -0.05, 0.06, l, 0.06));
    const hook = new THREE.TorusGeometry(0.08, 0.025, 4, 10, Math.PI * 1.4);
    parts.push(part(hook, '#6a6876', 0, CHAIN_TOP - 1.12, -0.05));
  } else if (id === 'quench') {
    // A long iron trough of dark water on two feet.
    parts.push(part(box, '#3a3a44', 0, 0.22, 0, 0.94, 0.36, 0.48));
    parts.push(part(box, '#1e2a3a', 0, 0.405, 0, 0.84, 0.02, 0.38));
    parts.push(part(box, '#2a2a32', -0.36, 0.03, 0, 0.12, 0.06, 0.52), part(box, '#2a2a32', 0.36, 0.03, 0, 0.12, 0.06, 0.52));
  } else if (id === 'ingot') {
    // Iron ingots stacked on a wooden pallet, two layers crosswise.
    parts.push(part(box, '#6a5038', 0, 0.04, 0, 0.8, 0.08, 0.6));
    for (const x of [-0.24, 0, 0.24]) parts.push(part(box, '#5e5c68', x, 0.15, 0, 0.18, 0.14, 0.52));
    for (const z of [-0.16, 0.08]) parts.push(part(box, '#6a6874', 0, 0.29, z, 0.62, 0.14, 0.18));
  } else if (id === 'fumarole') {
    // A low stone vent cone with a dark mouth (smoke rises off it), and a smaller one beside it. No glow.
    parts.push(part(cone, '#6e5e5a', 0, 0.26, 0, 0.9, 0.52, 0.9));
    parts.push(part(cyl, '#2a2220', 0, 0.5, 0, 0.26, 0.04, 0.26));
    parts.push(part(cone, '#7a6a64', 0.52, 0.15, 0.22, 0.46, 0.3, 0.46));
  } else if (id === 'obsidian') {
    // Three tall black obsidian shards leaning out of a rubble foot.
    for (const [x, z, h, r, c] of [[-0.22, 0, 1.2, 0.12, '#2a2228'], [0.1, 0.06, 0.9, -0.15, '#342a30'], [0.32, -0.04, 0.7, 0.2, '#2e2428']] as const) {
      const sh = new THREE.ConeGeometry(0.5, 1, 4); sh.rotateZ(r);
      parts.push(part(sh, c, x, h / 2, z, 0.2, h, 0.16));
    }
    parts.push(part(ball, '#7a6864', 0, 0.04, 0.05, 0.9, 0.12, 0.5));
  } else if (id === 'cairn') {
    // A cairn of flat stones, each smaller than the one below, and a little one beside it.
    for (const [y, r] of [[0.06, 0.5], [0.17, 0.42], [0.28, 0.34], [0.38, 0.26], [0.47, 0.18]] as const) parts.push(part(cyl, y % 0.22 < 0.11 ? '#8a7a74' : '#9a8a84', 0.02 * Math.sin(y * 40), y, 0, r, 0.1, r * 0.9));
    parts.push(part(cyl, '#8e7e78', 0.48, 0.05, 0.22, 0.24, 0.1, 0.22), part(cyl, '#9e8e88', 0.48, 0.14, 0.22, 0.16, 0.08, 0.15));
  } else if (id === 'pumice') {
    // Pale pumice boulders heaped against the wall.
    parts.push(part(ball, '#d0c4bc', 0, 0.26, -0.05, 0.62, 0.52, 0.56));
    parts.push(part(ball, '#c4b6ae', -0.44, 0.17, 0.1, 0.4, 0.34, 0.38));
    parts.push(part(ball, '#dacec6', 0.42, 0.14, 0.14, 0.34, 0.28, 0.32));
  } else if (id === 'press') {
    // A small stamping press: two posts on a base, a crossbeam, and the ram hanging over the die (the press strokes).
    parts.push(part(box, '#4a4a36', 0, 0.08, 0, 0.8, 0.16, 0.5));
    parts.push(part(box, '#6a6a4a', -0.32, 0.6, -0.05, 0.12, 1.0, 0.14), part(box, '#6a6a4a', 0.32, 0.6, -0.05, 0.12, 1.0, 0.14));
    parts.push(part(box, '#8a8058', 0, 1.12, -0.05, 0.8, 0.14, 0.18));
    parts.push(part(box, '#5a5a42', 0, 0.78, 0, 0.36, 0.3, 0.3));
    parts.push(part(box, '#9a9070', 0, 0.2, 0, 0.4, 0.08, 0.32));
  } else if (id === 'gear') {
    // A great brass gear fixed flat to the wall, its hub at GEAR_AT (it turns about its hub).
    const ring = new THREE.TorusGeometry(0.42, 0.08, 6, 24);
    parts.push(part(ring, '#a08848', 0, GEAR_AT, -0.08));
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; parts.push(part(box, '#a08848', Math.cos(a) * 0.53, GEAR_AT + Math.sin(a) * 0.53, -0.08, 0.12, 0.12, 0.1).rotateZ(0)); }
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI; const sp = new THREE.BoxGeometry(0.84, 0.06, 0.06); sp.rotateZ(a); parts.push(part(sp, '#8a7440', 0, GEAR_AT, -0.08)); }
    parts.push(part(cyl.clone().rotateX(Math.PI / 2), '#5a4a2a', 0, GEAR_AT, -0.04, 0.16, 0.12, 0.16));
  } else if (id === 'plate') {
    // Two stacks of pressed plates on a pallet.
    parts.push(part(box, '#6a5038', 0, 0.04, 0, 0.84, 0.08, 0.56));
    parts.push(part(box, '#9a9a80', -0.2, 0.2, 0, 0.36, 0.24, 0.44), part(box, '#8a8a72', 0.2, 0.16, 0, 0.36, 0.16, 0.44));
    parts.push(part(box, '#b0ae94', -0.2, 0.33, 0, 0.36, 0.02, 0.44));
  } else if (id === 'oil') {
    // Three oil drums, one lying on its side.
    parts.push(part(cyl, '#4e5a38', -0.24, 0.26, 0, 0.36, 0.52, 0.36), part(cyl, '#5a5a3a', 0.16, 0.26, -0.06, 0.36, 0.52, 0.36));
    parts.push(part(cyl, '#2a2a1e', -0.24, 0.525, 0, 0.3, 0.01, 0.3), part(cyl, '#2a2a1e', 0.16, 0.525, -0.06, 0.3, 0.01, 0.3));
    const lying = new THREE.CylinderGeometry(0.5, 0.5, 1, 10); lying.rotateZ(Math.PI / 2);
    parts.push(part(lying, '#56603c', 0.12, 0.18, 0.32, 0.5, 0.36, 0.36));
  } else if (id === 'ladle') {
    // A wall crane's arm with a great copper ladle hanging under it on two rods (it sways from HANG_TOP).
    parts.push(part(box, '#4a3a36', 0, HANG_TOP, -0.12, 0.9, 0.1, 0.14));
    parts.push(part(box, '#5a4844', -0.18, HANG_TOP - 0.3, -0.02, 0.04, 0.6, 0.04), part(box, '#5a4844', 0.18, HANG_TOP - 0.3, -0.02, 0.04, 0.6, 0.04));
    const bowl = new THREE.CylinderGeometry(0.42, 0.3, 0.5, 12);
    parts.push(part(bowl, '#a8644a', 0, HANG_TOP - 0.82, 0));
    parts.push(part(cyl, '#5a3628', 0, HANG_TOP - 0.565, 0, 0.74, 0.02, 0.74));
    parts.push(part(box, '#8a523c', 0.5, HANG_TOP - 0.7, 0, 0.24, 0.06, 0.08));
  } else if (id === 'crane' || id === 'hoist') {
    // A jib on the wall, a chain, and a hook block (the Smeltery's hoist is the same in steel). It sways from HANG_TOP.
    const steel = id === 'hoist';
    parts.push(part(box, steel ? '#3a3e48' : '#4a3a36', 0, HANG_TOP, -0.1, 0.8, 0.1, 0.16));
    parts.push(part(box, steel ? '#6a7080' : '#6a5248', 0, HANG_TOP - 0.42, -0.02, 0.05, 0.84, 0.05));
    parts.push(part(box, steel ? '#8a90a0' : '#b07a5a', 0, HANG_TOP - 0.94, -0.02, 0.26, 0.22, 0.16));
    const hook = new THREE.TorusGeometry(0.1, 0.03, 4, 10, Math.PI * 1.4);
    parts.push(part(hook, steel ? '#9aa0b0' : '#c08a6a', 0, HANG_TOP - 1.14, -0.02));
  } else if (id === 'mould') {
    // Two rows of open ingot moulds on a low iron bed.
    parts.push(part(box, '#4a3632', 0, 0.05, 0, 0.9, 0.1, 0.6));
    for (const zz of [-0.14, 0.14]) for (const xx of [-0.3, 0, 0.3]) { parts.push(part(box, '#7a5448', xx, 0.15, zz, 0.24, 0.1, 0.2), part(box, '#3a2622', xx, 0.2, zz, 0.18, 0.01, 0.14)); }
  } else if (id === 'clinker') {
    // A heap of rose clinker lumps, a smaller one beside it.
    parts.push(part(ball, '#8a5a4c', 0, 0.22, 0, 0.8, 0.44, 0.7), part(ball, '#a06a58', -0.1, 0.42, 0.02, 0.4, 0.26, 0.36));
    parts.push(part(ball, '#7a5044', 0.48, 0.14, 0.18, 0.42, 0.28, 0.4));
  } else if (id === 'bunker') {
    // A timber bunker heaped with coal.
    parts.push(part(box, '#6a4a32', 0, 0.2, -0.24, 0.9, 0.4, 0.06));
    parts.push(part(box, '#6a4a32', -0.42, 0.18, 0, 0.06, 0.36, 0.52), part(box, '#6a4a32', 0.42, 0.18, 0, 0.06, 0.36, 0.52));
    parts.push(part(cone, '#2a2224', 0, 0.36, 0, 0.84, 0.5, 0.5), part(ball, '#3a3032', 0.2, 0.42, 0.08, 0.2, 0.14, 0.18));
  } else if (id === 'scale') {
    // A great balance hanging from a wall bracket: a beam and two pans on cords (it sways from HANG_TOP).
    parts.push(part(box, '#4a3c36', 0, HANG_TOP, -0.12, 0.2, 0.12, 0.14));
    parts.push(part(box, '#b08848', 0, HANG_TOP - 0.16, 0, 0.96, 0.05, 0.05));
    for (const xx of [-0.44, 0.44]) { parts.push(part(box, '#8a7a6a', xx, HANG_TOP - 0.4, 0, 0.02, 0.48, 0.02), part(cyl, '#c09a50', xx, HANG_TOP - 0.66, 0, 0.36, 0.05, 0.36)); }
  } else if (id === 'coffer') {
    // Two iron-bound coffers, one on top of the other, and a third beside them.
    parts.push(part(box, '#6a4630', -0.18, 0.18, 0, 0.5, 0.36, 0.36), part(box, '#7a5236', -0.18, 0.5, 0, 0.42, 0.28, 0.3));
    parts.push(part(box, '#3a3634', -0.18, 0.18, 0.185, 0.52, 0.06, 0.01), part(box, '#c09a50', -0.18, 0.5, 0.155, 0.08, 0.08, 0.01));
    parts.push(part(box, '#6e4a32', 0.34, 0.16, 0.06, 0.4, 0.32, 0.32), part(box, '#3a3634', 0.34, 0.16, 0.225, 0.42, 0.05, 0.01));
  } else if (id === 'tithe') {
    // Sacks against a tally board on the wall.
    parts.push(part(box, '#6a5040', 0, 0.6, -0.2, 0.7, 0.8, 0.04));
    for (let k = 0; k < 4; k++) parts.push(part(box, '#d8c8a8', -0.22 + k * 0.15, 0.7, -0.17, 0.02, 0.4, 0.01));
    parts.push(part(ball, '#a8947a', -0.3, 0.2, 0.05, 0.42, 0.42, 0.38), part(ball, '#988470', 0.22, 0.18, 0.1, 0.4, 0.36, 0.36));
  } else if (id === 'tap') {
    // A taphole in a brick boss on the wall, with a short iron trough running out of it (no glow: the light breathes).
    parts.push(part(box, '#4a4e5a', 0, 0.5, -0.18, 0.7, 0.8, 0.2));
    parts.push(part(box, '#22242a', 0, 0.42, -0.07, 0.18, 0.16, 0.02));
    parts.push(part(box, '#3a3e48', 0, 0.12, 0.2, 0.22, 0.12, 0.7), part(box, '#5a3a2a', 0, 0.18, 0.2, 0.14, 0.01, 0.66));
  } else if (id === 'flywheel') {
    // A big steel flywheel on the wall, its hub at WHEEL_AT (it turns about its hub), six spokes and a heavy rim.
    const rim = new THREE.TorusGeometry(0.48, 0.09, 6, 24);
    parts.push(part(rim, '#7a8090', 0, WHEEL_AT, -0.08));
    for (let k = 0; k < 3; k++) { const sp = new THREE.BoxGeometry(0.92, 0.07, 0.07); sp.rotateZ((k / 3) * Math.PI); parts.push(part(sp, '#5a6070', 0, WHEEL_AT, -0.08)); }
    parts.push(part(cyl.clone().rotateX(Math.PI / 2), '#3a3e48', 0, WHEEL_AT, -0.04, 0.2, 0.14, 0.2));
  } else if (id === 'billet') {
    // A rack of square steel billets.
    parts.push(part(box, '#3a3e48', -0.38, 0.3, 0, 0.06, 0.6, 0.4), part(box, '#3a3e48', 0.38, 0.3, 0, 0.06, 0.6, 0.4));
    for (const yy of [0.14, 0.34, 0.54]) for (const zz of [-0.1, 0.1]) parts.push(part(box, '#8a90a0', 0, yy, zz, 0.86, 0.12, 0.12));
  } else if (id === 'firebox') {
    // An iron fire door in a brick boss, with a grate below (no glow: the room light breathes like bellows).
    parts.push(part(box, '#5a4038', 0, 0.45, -0.18, 0.8, 0.9, 0.22));
    parts.push(part(box, '#2e2a28', 0, 0.5, -0.06, 0.44, 0.4, 0.04), part(box, '#8a7a6a', 0.14, 0.5, -0.03, 0.06, 0.06, 0.03));
    for (let k = 0; k < 4; k++) parts.push(part(box, '#3a3432', -0.15 + k * 0.1, 0.14, -0.06, 0.04, 0.16, 0.04));
  } else if (id === 'damper') {
    // A big damper plate hanging from its pivot bar on the wall (it rocks from HANG_TOP).
    parts.push(part(box, '#3e3430', 0, HANG_TOP, -0.12, 0.9, 0.1, 0.14));
    parts.push(part(box, '#6a5a50', -0.3, HANG_TOP - 0.12, -0.04, 0.05, 0.24, 0.05), part(box, '#6a5a50', 0.3, HANG_TOP - 0.12, -0.04, 0.05, 0.24, 0.05));
    parts.push(part(box, '#5a4c44', 0, HANG_TOP - 0.62, -0.04, 0.8, 0.8, 0.05));
    parts.push(part(box, '#7a6a5e', 0, HANG_TOP - 0.62, -0.01, 0.7, 0.06, 0.02), part(box, '#7a6a5e', 0, HANG_TOP - 0.62, -0.01, 0.06, 0.7, 0.02));
  } else if (id === 'soot') {
    // Soft grey soot drifts heaped by the wall.
    parts.push(part(ball, '#5a5250', 0, 0.16, 0, 0.9, 0.32, 0.6), part(ball, '#6e6460', -0.36, 0.12, 0.12, 0.5, 0.24, 0.4));
    parts.push(part(ball, '#4e4846', 0.4, 0.1, 0.16, 0.4, 0.2, 0.34));
  } else if (id === 'sweep') {
    // A ladder and two long sweeps' brushes leaning on the wall.
    parts.push(part(box, '#8a6a48', -0.3, 0.6, -0.12, 0.05, 1.2, 0.05), part(box, '#8a6a48', -0.06, 0.6, -0.12, 0.05, 1.2, 0.05));
    for (let k = 0; k < 5; k++) parts.push(part(box, '#7a5c3e', -0.18, 0.15 + k * 0.24, -0.12, 0.24, 0.04, 0.04));
    for (const xx of [0.2, 0.36]) { parts.push(part(box, '#6a5038', xx, 0.6, -0.1, 0.03, 1.1, 0.03), part(ball, '#2e2a28', xx, 1.18, -0.1, 0.22, 0.22, 0.22)); }
  } else if (id === 'cooling') {
    // A steam post: a squat iron drum with a grille top.
    parts.push(part(cyl, '#5c666c', 0, 0.22, 0, 0.5, 0.44, 0.5));
    parts.push(part(cyl, '#2c3236', 0, 0.46, 0, 0.42, 0.04, 0.42));
    parts.push(part(box, '#8a989e', 0, 0.48, 0, 0.44, 0.03, 0.06));
    parts.push(part(box, '#8a989e', 0, 0.48, 0, 0.06, 0.03, 0.44));
  } else {
    // A carved niche against the wall, and three candles before it (cream wax, near-white flames).
    parts.push(part(box, '#8a6a4a', 0, 0.55, -0.12, 0.8, 1.1, 0.24));
    parts.push(part(box, '#3a2a1e', 0, 0.62, -0.02, 0.46, 0.66, 0.06));
    for (const [x, h] of [[-0.24, 0.22], [0, 0.3], [0.24, 0.18]] as const) {
      parts.push(part(cyl, '#efe0c0', x, h / 2, 0.16, 0.08, h, 0.08));
      parts.push(part(cone, '#fff2b0', x, h + 0.05, 0.16, 0.06, 0.1, 0.06));
    }
  }
  const g = mergeGeometries(parts, false)!;
  g.computeVertexNormals();
  return g;
}

/** How high the Chain gallery's bracket is: its chains swing from here. */
export const CHAIN_TOP = 1.4;
/** How high the raids' hanging props (ladle, crane, scale, hoist, damper) hang from: they sway about here. */
export const HANG_TOP = 1.5;
/** How high the Flywheel hall's hub is: it turns about here. */
export const WHEEL_AT = 0.75;
/** H5: the raids' hanging props and how far and how slowly each sways (radians, Hz). */
const SWAY: Partial<Record<ThemeId, [number, number]>> = { ladle: [0.04, 0.1], crane: [0.06, 0.12], scale: [0.05, 0.1], hoist: [0.06, 0.12], damper: [0.05, 0.08] };
/** The props whose instances move (halls3d's roomLife updates only these). */
export const MOVING = new Set<ThemeId>(['bellows', 'pump', 'orrery', 'kelp', 'chain', 'gear', 'press', 'flywheel', ...(Object.keys(SWAY) as ThemeId[])]);
/** How high the Gear room's gear hub is: it turns about here. */
export const GEAR_AT = 0.75;

/** How a theme's prop moves, as a y scale, a turn and a sway along the wall (pivoting at height `swingAt`) for its instance at time t (phase ph): the quiet motion. */
export function propMotion(id: ThemeId, t: number, ph: number): { sy: number; ry?: number; swing?: number; swingAt?: number } {
  // The Chain gallery's chains swing a few degrees, about once every eight seconds.
  if (id === 'chain') return { sy: 1, swing: 0.06 * Math.sin(t * 2 * Math.PI * 0.12 + ph), swingAt: CHAIN_TOP };
  // H5: a raid's hanging prop sways from its bracket; the Smeltery's flywheel turns about once every 30 s.
  const sw = SWAY[id];
  if (sw) return { sy: 1, swing: sw[0] * Math.sin(t * 2 * Math.PI * sw[1] + ph), swingAt: HANG_TOP };
  if (id === 'flywheel') return { sy: 1, swing: t * 0.2 + ph, swingAt: WHEEL_AT };
  // The Gear room's gear turns about once every 40 s; the Press floor's press strokes as slowly as the pumps.
  if (id === 'gear') return { sy: 1, swing: t * 0.16 + ph, swingAt: GEAR_AT };
  if (id === 'press') return { sy: 1 + 0.05 * Math.sin(t * 2 * Math.PI * 0.2 + ph) };
  // The Star vault's orreries turn about once a minute.
  if (id === 'orrery') return { sy: 1, ry: t * 0.1 + ph };
  if (id === 'bellows') return { sy: 1 + 0.1 * Math.sin(t * 2 * Math.PI * THEMES.bellows.swell + ph) };
  // The Foundry's pumps stroke as slowly as the bellows breathe.
  // The Kelp bed's fronds sway, as slowly as the water moves.
  if (id === 'kelp') return { sy: 1 + 0.06 * Math.sin(t * 2 * Math.PI * 0.15 + ph) };
  if (id === 'pump') return { sy: 1 + 0.07 * Math.sin(t * 2 * Math.PI * 0.2 + ph) };
  return { sy: 1 };
}
