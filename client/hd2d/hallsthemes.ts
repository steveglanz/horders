/**
 * Phase 18 Halls H2d, the 3D side of room themes (data in client/hallsthemes.ts; design plan /mnt/project-files/horders/design/halls/h2-plan.md; names, looks and the
 * final list are visuals', agreed with design 25 Nov). Each room of the map rolls a theme, and it decides the room's
 * floor tiles, wall colour, the colour of the two moving room lights, its props and one quiet motion. Steve's look
 * rules: rooms brighter, a little quiet motion and never busy; red means bad and green means good, so no theme lights a
 * room red-on-red or green.
 *
 * Cost: themes share one wall material (instance colours), one prop material and one shader; each room adds one prop
 * batch (one draw call), and a Cooling yard one more for its steam.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { THEMES, type Theme, type ThemeId } from '../hallsthemes';

export { THEMES, PROP_SCALE, themeOf, themeSpots, type Theme, type ThemeId } from '../hallsthemes';

/** Paints a theme's floor tiles: the room's brick pattern in its colour, with cracks for the cracked ones. */
export function themeTileCanvas(th: Theme, paint: (color: string) => HTMLCanvasElement): HTMLCanvasElement {
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
 * Bright parts (hot tips, flames) are near-white in colour so they read as lit; the prop material adds a little glow.
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
    // A slag heap with a hot, glowing tip, and a smaller one beside it.
    parts.push(part(cone, '#4a302a', 0, 0.28, 0, 0.9, 0.56, 0.9));
    parts.push(part(cone, '#e0a060', 0, 0.5, 0, 0.26, 0.14, 0.26));
    parts.push(part(cone, '#442c26', 0.5, 0.17, 0.2, 0.5, 0.34, 0.5));
    parts.push(part(cone, '#d88a50', 0.5, 0.3, 0.2, 0.14, 0.08, 0.14));
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

/** How a theme's prop moves, as a y scale and a glow for its instance at time t (phase ph): the quiet motion. */
export function propMotion(id: ThemeId, t: number, ph: number): { sy: number } {
  if (id === 'bellows') return { sy: 1 + 0.1 * Math.sin(t * 2 * Math.PI * THEMES.bellows.swell + ph) };
  return { sy: 1 };
}
