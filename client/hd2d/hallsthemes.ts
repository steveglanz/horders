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

/** How a theme's prop moves, as a y scale and a turn for its instance at time t (phase ph): the quiet motion. */
export function propMotion(id: ThemeId, t: number, ph: number): { sy: number; ry?: number } {
  // The Star vault's orreries turn about once a minute.
  if (id === 'orrery') return { sy: 1, ry: t * 0.1 + ph };
  if (id === 'bellows') return { sy: 1 + 0.1 * Math.sin(t * 2 * Math.PI * THEMES.bellows.swell + ph) };
  // The Foundry's pumps stroke as slowly as the bellows breathe.
  // The Kelp bed's fronds sway, as slowly as the water moves.
  if (id === 'kelp') return { sy: 1 + 0.06 * Math.sin(t * 2 * Math.PI * 0.15 + ph) };
  if (id === 'pump') return { sy: 1 + 0.07 * Math.sin(t * 2 * Math.PI * 0.2 + ph) };
  return { sy: 1 };
}
