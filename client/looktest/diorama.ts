// style: palette-only
/**
 * Look test, version A: the "kiln-lit diorama" (vision.md section 7, docs/art/style/README.md).
 * One Kiln room floating in black, lit only by fire; one iron Bulwark figurine; one clay foe that shatters.
 * Low-poly shapes built in code, flat shading with a 3-step toon ramp, a dark outline, no textures.
 * Every colour comes from client/style.ts. Driven by timeline.ts so a recorder can render any moment:
 * window.lookTest.render(t) draws the frame at t seconds.
 */
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MASTER, ACCENTS, CLOTH, SIGNAL, SIGNAL_SHAPE, CAMERA, ANIM, SIZE } from '../style';
import {
  ROOM, heroAt, foeAt, telegraphAt, shakeAt, rng, SWINGS, HIT_DELAY, KILL_T, STAND, SLAMS, HITSTOP_SEC,
  easeOutBack, easeOutQuad,
} from './timeline';

const { soot, clay, iron, fire, hearth, signal } = MASTER;
const KILN = ACCENTS.kiln;
const C = (hex: string) => new THREE.Color(hex);

// ---------- materials ----------
const ramp = (() => {
  // 3-step toon ramp (LIGHT.toonSteps): shadow, mid, lit.
  const d = new Uint8Array([95, 170, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
const toonCache = new Map<string, THREE.MeshToonMaterial>();
const toon = (hex: string) => {
  let m = toonCache.get(hex);
  if (!m) { m = new THREE.MeshToonMaterial({ color: C(hex), gradientMap: ramp }); toonCache.set(hex, m); }
  return m;
};
/** Unlit: "if it glows flat, it matters" (signals), plus fire, which is light itself. */
const flat = (hex: string, opacity = 1) => new THREE.MeshBasicMaterial({ color: C(hex), transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide });
const OUTLINE_W = 0.035;
const outlineMat = new THREE.ShaderMaterial({
  uniforms: { w: { value: OUTLINE_W }, col: { value: C(soot[1]) } },
  vertexShader: 'uniform float w; void main(){ vec3 p = position + normal * w; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }',
  fragmentShader: 'uniform vec3 col; void main(){ gl_FragColor = vec4(col,1.0); }',
  side: THREE.BackSide,
});

/** A toon mesh with an inverted-hull outline (smooth normals so the hull has no gaps at hard edges). */
function part(geo: THREE.BufferGeometry, hex: string, outline = true): THREE.Mesh {
  // Flat shading: split every face so each one takes a single tone of the ramp.
  const fg = geo.index ? geo.toNonIndexed() : geo.clone(); fg.computeVertexNormals();
  const m = new THREE.Mesh(fg, toon(hex));
  m.castShadow = false;
  if (outline) {
    const g = geo.clone(); g.deleteAttribute('normal'); if (g.getAttribute('uv')) g.deleteAttribute('uv');
    const mg = mergeVertices(g, 1e-3); mg.computeVertexNormals();
    const o = new THREE.Mesh(mg, outlineMat); o.renderOrder = -1; m.add(o);
  }
  return m;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): T => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };

// ---------- scene ----------
const W = CAMERA.refWidthPx, H = CAMERA.refHeightPx;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(W, H);
renderer.setClearColor(C(soot[0]));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = null;

// Camera: pitched CAMERA.pitchDeg, CAMERA.fovDeg field of view, close enough for a 70-80 px hero (measured, see README).
const camera = new THREE.PerspectiveCamera(CAMERA.fovDeg, W / H, 0.5, 200);
const CAM_DIST = Number(new URLSearchParams(location.search).get('dist')) || 22;
const CAM_LOOK = new THREE.Vector3(0.2, 0.4, -0.25);
const pitch = THREE.MathUtils.degToRad(CAMERA.pitchDeg);
function placeCamera(shake: number, t: number) {
  const sx = shake ? Math.sin(t * 91) * 0.06 * shake : 0, sy = shake ? Math.cos(t * 77) * 0.05 * shake : 0;
  camera.position.set(CAM_LOOK.x + sx, CAM_LOOK.y + Math.sin(pitch) * CAM_DIST + sy, CAM_LOOK.z + Math.cos(pitch) * CAM_DIST);
  camera.lookAt(CAM_LOOK.x + sx, CAM_LOOK.y + sy, CAM_LOOK.z);
}

// Light: dim fill, the kiln, a brazier and the hero's carried lantern (LIGHT.maxRealLights = 4, 3 used + fill).
scene.add(new THREE.HemisphereLight(C(fire[3]), C(soot[1]), 0.22));
const kilnLight = new THREE.PointLight(C(fire[2]), 9, 6.5, 1.5);
const brazierLight = new THREE.PointLight(C(fire[3]), 5, 4.5, 1.5);
const heroLight = new THREE.PointLight(C(fire[4]), 5, 4, 1.5); // LIGHT.heroLightRadius
scene.add(kilnLight, brazierLight, heroLight);

// ---------- the room ----------
const room = new THREE.Group(); scene.add(room);
const R = rng(7);
{
  // A thick slab of cracked brick, so the room reads as a piece floating in the dark.
  const slab = part(box(ROOM.halfW * 2 + 0.5, 0.9, ROOM.halfD * 2 + 0.5), soot[2]);
  room.add(at(slab, 0, -0.45, 0));
  const tones = [soot[3], soot[4], soot[3], clay[0], soot[3]];
  const bw = 0.98, bd = 0.49;
  for (let row = 0, z = -ROOM.halfD + bd / 2; z < ROOM.halfD; z += bd + 0.02, row++) {
    for (let x = -ROOM.halfW + (row % 2 ? bw / 2 : 0); x < ROOM.halfW; x += bw + 0.02) {
      const w = Math.min(bw, ROOM.halfW - x + bw / 2) - 0.02; if (w < 0.2) continue;
      const xs = Math.max(-ROOM.halfW + 0.01, x - bw / 2), xe = Math.min(ROOM.halfW - 0.01, x + bw / 2);
      if (xe - xs < 0.15) continue;
      const h = 0.06 + R() * 0.05;
      const b = part(box(xe - xs - 0.03, h, bd - 0.03), tones[Math.floor(R() * tones.length)], false);
      room.add(at(b, (xs + xe) / 2, h / 2 - 0.02, z, 0, (R() - 0.5) * 0.04, 0));
    }
  }
  // Ember cracks in the floor: thin unlit fire lines near the kiln.
  for (let i = 0; i < 5; i++) {
    const len = 0.5 + R() * 0.9;
    const cr = new THREE.Mesh(box(len, 0.02, 0.05), flat(i % 2 ? fire[1] : fire[2]));
    room.add(at(cr, -1.9 + R() * 1.6, 0.1, -3.4 + R() * 2.2, 0, R() * Math.PI, 0));
  }
  // Back wall and low side walls of brick courses; the front wall is cut away.
  const wallBrick = (x: number, y: number, z: number, w: number, hgt: number, d: number, hex: string) => room.add(at(part(box(w, hgt, d), hex), x, y, z));
  const courses = 7, ch = ROOM.wallH / courses;
  for (let c = 0; c < courses; c++) {
    const off = c % 2 ? 0.45 : 0;
    for (let x = -ROOM.halfW - 0.25 + off; x < ROOM.halfW + 0.25; x += 0.9) {
      const xs = Math.max(-ROOM.halfW - 0.25, x), xe = Math.min(ROOM.halfW + 0.25, x + 0.88);
      const mid = (xs + xe) / 2;
      if (Math.abs(mid - ROOM.door.x) < ROOM.door.w / 2 + 0.3 && c < 5) continue; // door opening
      wallBrick(mid, c * ch + ch / 2, -ROOM.halfD - 0.12, xe - xs - 0.02, ch - 0.03, 0.4, R() < 0.25 ? KILN[0] : R() < 0.5 ? soot[4] : soot[3]);
    }
  }
  for (const side of [-1, 1]) {
    for (let c = 0; c < 3; c++) {
      for (let z = -ROOM.halfD + (c % 2 ? 0.45 : 0); z < ROOM.halfD - 0.6; z += 0.9) {
        const ze = Math.min(ROOM.halfD - 0.4, z + 0.88); const hgt = c === 2 ? 0.2 + 0.4 * (1 - (z + ROOM.halfD) / (ROOM.halfD * 2)) : ch - 0.03;
        if (ze - z < 0.2) continue;
        const y = c * ch + hgt / 2;
        wallBrick(side * (ROOM.halfW + 0.12), y, (z + ze) / 2, 0.4, hgt, ze - z - 0.02, R() < 0.3 ? KILN[0] : soot[3]);
      }
    }
  }
  // Door: a dark arch with a brass lintel and banked-ember glaze.
  const d = ROOM.door;
  room.add(at(part(box(d.w + 0.5, 0.35, 0.5), hearth[0]), d.x, ch * 5 + 0.1, -ROOM.halfD - 0.1));
  room.add(at(new THREE.Mesh(box(d.w, ch * 5, 0.1), flat(soot[0])), d.x, ch * 2.5, -ROOM.halfD - 0.05));
  for (const s of [-1, 1]) room.add(at(part(box(0.25, ch * 5, 0.5), KILN[1]), d.x + s * (d.w / 2 + 0.12), ch * 2.5, -ROOM.halfD - 0.1));

  // The beehive kiln: a low-poly dome with a glowing arched mouth (the room's landmark and main light).
  const kiln = new THREE.Group();
  kiln.add(at(part(new THREE.SphereGeometry(1.15, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), clay[0]), 0, 0, 0));
  kiln.add(at(part(new THREE.CylinderGeometry(1.2, 1.3, 0.3, 8), KILN[0]), 0, 0.12, 0));
  kiln.add(at(part(new THREE.CylinderGeometry(0.22, 0.28, 0.7, 6), soot[4]), 0.1, 1.25, -0.2));
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.42, 7, 0, Math.PI), flat(fire[3]));
  kiln.add(at(mouth, 0, 0.18, 1.06, -0.12, 0, 0));
  const mouthCore = new THREE.Mesh(new THREE.CircleGeometry(0.26, 7, 0, Math.PI), flat(fire[4]));
  kiln.add(at(mouthCore, 0, 0.19, 1.08, -0.12, 0, 0));
  room.add(at(kiln, -1.4, 0, -3.25, 0, 0.35, 0));
  kilnLight.position.set(-1.15, 1.0, -2.3);

  // Brazier on the right wall.
  const braz = new THREE.Group();
  braz.add(at(part(new THREE.CylinderGeometry(0.32, 0.18, 0.35, 6), iron[1]), 0, 0.85, 0));
  braz.add(at(part(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 5), iron[0]), 0, 0.35, 0));
  braz.add(at(part(new THREE.CylinderGeometry(0.25, 0.3, 0.06, 6), iron[0]), 0, 0.02, 0));
  braz.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.38, 5), flat(fire[3])), 0, 1.15, 0));
  braz.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 5), flat(fire[4])), 0, 1.12, 0));
  room.add(at(braz, 2.15, 0, 0.6));
  brazierLight.position.set(2.05, 1.5, 0.6);

  // Clay jars and old shards: the Court's pottery, and proof of earlier fights.
  const jar = (x: number, z: number, s: number, hex: string) => {
    const g = new THREE.Group();
    g.add(at(part(new THREE.CylinderGeometry(0.22 * s, 0.17 * s, 0.5 * s, 7), hex), 0, 0.25 * s, 0));
    g.add(at(part(new THREE.CylinderGeometry(0.12 * s, 0.22 * s, 0.16 * s, 7), hex), 0, 0.58 * s, 0));
    room.add(at(g, x, 0.08, z, 0, R() * 3, 0));
  };
  jar(2.15, -2.0, 1.2, clay[1]); jar(2.25, -1.35, 0.85, clay[2]); jar(-2.2, 1.8, 1.0, clay[1]); jar(-2.1, 2.45, 0.75, clay[0]);
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.08 + R() * 0.07), toon(R() < 0.5 ? clay[1] : clay[0]));
    room.add(at(s, -2.3 + R() * 1.4, 0.12, 0.8 + R() * 3.2, R() * 3, R() * 3, R() * 3));
  }
  // Hanging chain from the dark above the door side (the room's one quiet motion is the kiln embers).
}

// Batch the static room by material (the cost bar is 96 draw calls on a phone): one mesh per material.
{
  room.updateMatrixWorld(true);
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  room.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    if (g.getAttribute('uv')) g.deleteAttribute('uv');
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    g.applyMatrix4(o.matrixWorld);
    const m = o.material as THREE.Material; if (!groups.has(m)) groups.set(m, []); groups.get(m)!.push(g);
  });
  scene.remove(room);
  for (const [m, gs] of groups) { const merged = new THREE.Mesh(mergeGeometries(gs, false)!, m); if (m === outlineMat) merged.renderOrder = -1; scene.add(merged); }
}

// Rising embers from the kiln mouth: the one quiet motion.
const EMBERS = 22;
const emberMeshes: THREE.Mesh[] = [];
const emberSeed = Array.from({ length: EMBERS }, (_, i) => { const r = rng(100 + i); return { ph: r(), sp: 0.35 + r() * 0.3, dx: (r() - 0.5) * 1.4, dz: r() * 0.8, sw: r() * 6 }; });
for (let i = 0; i < EMBERS; i++) { const m = new THREE.Mesh(box(0.05, 0.05, 0.05), flat(i % 3 ? fire[3] : fire[4])); emberMeshes.push(m); scene.add(m); }

// ---------- figures ----------
const blob = (r: number) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 16), flat(soot[0], 0.55)); m.rotation.x = -Math.PI / 2; return m; };
const ringMesh = (r: number, w: number, hex: string, opacity = 1) => { const m = new THREE.Mesh(new THREE.RingGeometry(r - w, r, 40), flat(hex, opacity)); m.rotation.x = -Math.PI / 2; return m; };

/** Painted iron figurine: the Bulwark, read by its door-sized shield. */
function makeHero() {
  const root = new THREE.Group();
  const spin = new THREE.Group(); root.add(at(spin, 0, 0.75, 0)); // the dodge roll turns round the waist
  const inner = new THREE.Group(); spin.add(at(inner, 0, -0.75, 0));
  const body = new THREE.Group(); inner.add(body); // bob, lean, squash
  const torso = part(new THREE.CylinderGeometry(0.34, 0.42, 0.72, 7), iron[2]); body.add(at(torso, 0, 0.72, 0));
  const tabard = part(box(0.5, 0.62, 0.12), CLOTH.bulwark); body.add(at(tabard, 0, 0.66, 0.34, -0.08, 0, 0));
  const cape = part(box(0.62, 0.78, 0.08), CLOTH.bulwark); body.add(at(cape, 0, 0.72, -0.36, 0.1, 0, 0));
  const belt = part(new THREE.CylinderGeometry(0.43, 0.43, 0.1, 7), hearth[0], false); body.add(at(belt, 0, 0.45, 0));
  const pauldL = part(new THREE.IcosahedronGeometry(0.2, 0), iron[2]); body.add(at(pauldL, -0.38, 1.05, 0));
  const pauldR = part(new THREE.IcosahedronGeometry(0.2, 0), iron[2]); body.add(at(pauldR, 0.38, 1.05, 0));
  const head = new THREE.Group(); body.add(at(head, 0, 1.33, 0));
  head.add(part(new THREE.CylinderGeometry(0.26, 0.3, 0.42, 7), iron[2]));
  head.add(at(new THREE.Mesh(box(0.36, 0.05, 0.05), flat(fire[4])), 0, 0.02, 0.27)); // visor glow
  head.add(at(part(new THREE.ConeGeometry(0.29, 0.2, 7), iron[2]), 0, 0.3, 0));
  head.add(at(part(box(0.06, 0.26, 0.36), hearth[0], false), 0, 0.42, -0.02)); // brass crest
  const legs = new THREE.Group(); inner.add(legs);
  const legL = part(box(0.2, 0.36, 0.24), iron[1]); legs.add(at(legL, -0.17, 0.18, 0));
  const legR = part(box(0.2, 0.36, 0.24), iron[1]); legs.add(at(legR, 0.17, 0.18, 0));
  // The door-sized shield on the left arm, with a brass rim and boss.
  const shield = new THREE.Group(); body.add(at(shield, -0.52, 0.8, 0.18, 0, -0.35, 0));
  shield.add(part(box(0.14, 1.25, 0.86), iron[1]));
  shield.add(at(part(box(0.06, 1.33, 0.06), hearth[0], false), 0.05, 0, 0.43));
  shield.add(at(part(box(0.06, 1.33, 0.06), hearth[0], false), 0.05, 0, -0.43));
  shield.add(at(part(new THREE.SphereGeometry(0.14, 6, 4), hearth[0]), 0.1, 0.05, 0));
  shield.add(at(part(box(0.04, 0.9, 0.12), CLOTH.bulwark, false), 0.08, 0, 0));
  // Hammer in the right hand; the arm group swings it.
  const arm = new THREE.Group(); body.add(at(arm, 0.45, 0.95, 0.05));
  arm.add(at(part(box(0.18, 0.42, 0.18), iron[2]), 0, -0.18, 0));
  const hammer = new THREE.Group(); arm.add(at(hammer, 0, -0.38, 0.12));
  hammer.add(at(part(new THREE.CylinderGeometry(0.04, 0.04, 0.85, 5), clay[0]), 0, 0, 0.3, Math.PI / 2, 0, 0));
  hammer.add(at(part(box(0.24, 0.24, 0.42), iron[3]), 0, 0, 0.72, 0, 0, 0));
  root.add(blob(0.55));
  const ring = ringMesh(0.62, SIGNAL_SHAPE.solidRing.ringWidth * 1.2, SIGNAL.ally.color); ring.position.y = 0.11; root.add(ring);
  const mats: THREE.Mesh[] = []; body.traverse((o) => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial) mats.push(o); });
  return { root, spin, body, head, arm, legs, legL, legR, shield, meshes: mats };
}

/** Fired-clay foe: angular hollow pottery, slit eyes, glowing cracks, heavy fists for a slam. */
function makeFoe() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const S = 1.25;
  const pot = part(new THREE.CylinderGeometry(0.55 * S, 0.42 * S, 0.95 * S, 6), clay[1]); body.add(at(pot, 0, 0.75 * S, 0));
  const shoulder = part(new THREE.CylinderGeometry(0.4 * S, 0.58 * S, 0.3 * S, 6), clay[2]); body.add(at(shoulder, 0, 1.36 * S, 0));
  const rim = part(new THREE.CylinderGeometry(0.42 * S, 0.36 * S, 0.14 * S, 6), clay[3]); body.add(at(rim, 0, 1.58 * S, 0));
  const maw = new THREE.Mesh(new THREE.CircleGeometry(0.33 * S, 6), flat(fire[2])); maw.rotation.x = -Math.PI / 2; body.add(at(maw, 0, 1.66 * S, 0, -Math.PI / 2, 0, 0));
  // Slit eyes, slanted inward (angry), and glowing cracks down the body.
  const eyes: THREE.Mesh[] = [];
  for (const s of [-1, 1]) { const e = new THREE.Mesh(box(0.2 * S, 0.05 * S, 0.04), flat(fire[4])); body.add(at(e, s * 0.17 * S, 1.3 * S, 0.5 * S, 0, 0, s * 0.35)); eyes.push(e); }
  const cracks: THREE.Mesh[] = [];
  const crk = (x: number, y: number, len: number, rz: number, ry: number) => { const c = new THREE.Mesh(box(0.04, len, 0.04), flat(fire[3])); const g = new THREE.Group(); g.rotation.y = ry; c.position.set(x, y, 0.5 * S); c.rotation.z = rz; g.add(c); body.add(g); cracks.push(c); };
  crk(0.12, 0.85, 0.42, 0.4, 0); crk(0.04, 0.6, 0.26, -0.5, 0); crk(-0.1, 0.95, 0.3, 0.2, 1.4); crk(0.1, 0.7, 0.4, -0.3, -1.6); crk(0, 0.8, 0.35, 0.6, 3.0);
  const arms: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); body.add(at(a, s * 0.68 * S, 1.2 * S, 0));
    a.add(at(part(box(0.24 * S, 0.5 * S, 0.24 * S), clay[1]), 0, -0.25 * S, 0));
    a.add(at(part(new THREE.DodecahedronGeometry(0.28 * S, 0), clay[0]), 0, -0.6 * S, 0.08));
    arms.push(a);
  }
  for (const s of [-1, 1]) body.add(at(part(box(0.26 * S, 0.3 * S, 0.3 * S), clay[0]), s * 0.24 * S, 0.15 * S, 0));
  root.add(blob(0.78));
  // Steve's colour rule: a red ring under every foe (thin, plain; the jagged shape is kept for danger zones).
  const ring = ringMesh(0.8, 0.05, SIGNAL.danger.color, 0.85); ring.position.y = 0.11; root.add(ring);
  const mats: THREE.Mesh[] = []; body.traverse((o) => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshToonMaterial) mats.push(o); });
  return { root, body, eyes, cracks, arms, maw, ring, meshes: mats, S };
}

const hero = makeHero(); scene.add(hero.root);
const foe = makeFoe(); scene.add(foe.root);
// Hit flash: swap toon materials for one bone-white flat material (ANIM.hit.flashColor), 60-80 ms.
const flashMat = flat(ANIM.hit.flashColor);
const origMat = new Map<THREE.Mesh, THREE.Material>();
for (const m of [...hero.meshes, ...foe.meshes]) origMat.set(m, m.material as THREE.Material);
const setFlash = (meshes: THREE.Mesh[], on: boolean) => { for (const m of meshes) m.material = on ? flashMat : origMat.get(m)!; };

// Shatter: 9 pre-cut clay shards and 12 embers (ANIM.die). Shards land and stay for the rest of the room.
const shardR = rng(42);
const shards = Array.from({ length: 9 }, (_, i) => {
  const geo = i % 3 === 0 ? new THREE.TetrahedronGeometry(0.2 + shardR() * 0.12) : new THREE.OctahedronGeometry(0.14 + shardR() * 0.1);
  geo.scale(1, 0.55, 1);
  const m = part(geo, [clay[1], clay[2], clay[0]][i % 3]);
  const ang = (i / 9) * Math.PI * 2 + shardR() * 0.5;
  const sp = 0.9 + shardR() * 1.3;
  const s = { m, vx: Math.cos(ang) * sp, vz: Math.sin(ang) * sp * 0.8, vy: 2.6 + shardR() * 2.4, y0: 0.5 + shardR() * 1.2, spin: [shardR() * 9 - 4.5, shardR() * 9 - 4.5, shardR() * 9 - 4.5], rest: [shardR() * 3, shardR() * 3, shardR() * 3] };
  m.visible = false; scene.add(m); return s;
});
const burst = Array.from({ length: ANIM.die.emberBurst }, (_, i) => {
  const m = new THREE.Mesh(box(0.08, 0.08, 0.08), flat(i % 2 ? fire[3] : fire[4]));
  const a = shardR() * Math.PI * 2, sp = 1 + shardR() * 2.2;
  m.visible = false; scene.add(m);
  return { m, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: 2 + shardR() * 2.5, life: 0.6 + shardR() * 0.5 };
});
// Dust puffs on a slam (soot, lit): 8 cubes thrown out low.
const dust = Array.from({ length: 8 }, (_, i) => { const m = part(new THREE.IcosahedronGeometry(0.16, 0), soot[4], false); m.visible = false; scene.add(m); return { m, a: (i / 8) * Math.PI * 2 }; });

// Danger zone: filled disc with a serrated crawling edge (SIGNAL_SHAPE.jagged), rebuilt per frame.
const dangerFill = new THREE.Mesh(new THREE.BufferGeometry(), flat(SIGNAL.danger.color, SIGNAL_SHAPE.jagged.fillOpacity));
const dangerEdge = new THREE.Mesh(new THREE.BufferGeometry(), flat(SIGNAL.danger.color));
const dangerGrow = new THREE.Mesh(new THREE.BufferGeometry(), flat(SIGNAL.danger.color, 0.35));
for (const m of [dangerFill, dangerEdge, dangerGrow]) { m.rotation.x = -Math.PI / 2; scene.add(m); }
function jaggedRing(r: number, inner: number, crawl: number): THREE.BufferGeometry {
  const J = SIGNAL_SHAPE.jagged; const teeth = Math.max(8, Math.round(J.teethPerUnit * Math.PI * 2 * r));
  const n = teeth * 4; const pos: number[] = []; const idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2; const ph = ((i / n) * teeth + crawl) % 1; const tooth = 1 - Math.abs(ph * 2 - 1);
    const ro = r + J.toothDepth * tooth; const ri = inner < 0 ? 0 : ro - inner;
    pos.push(Math.cos(a) * ro, Math.sin(a) * ro, 0, Math.cos(a) * ri, Math.sin(a) * ri, 0);
    if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
// Stand-here ring at the exit: solid ring plus 4 chevrons pulsing inward (SIGNAL_SHAPE.chevronRing).
const stand = new THREE.Group(); scene.add(stand); stand.visible = false;
{
  const CR = SIGNAL_SHAPE.chevronRing; const r = 0.62;
  const rr = ringMesh(r, CR.ringWidth, SIGNAL.stand.color); stand.add(rr);
}
const chevrons: THREE.Group[] = [];
for (let i = 0; i < SIGNAL_SHAPE.chevronRing.chevrons; i++) {
  // A V whose tip points at the ring's centre (-x in its own group, which turns round the ring).
  const s = SIGNAL_SHAPE.chevronRing.chevronSize; const sh = new THREE.Shape();
  sh.moveTo(s * 0.6, -s); sh.lineTo(-s * 0.2, 0); sh.lineTo(s * 0.6, s); sh.lineTo(s * 0.95, s); sh.lineTo(s * 0.15, 0); sh.lineTo(s * 0.95, -s);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), flat(SIGNAL.stand.color)); m.rotation.x = -Math.PI / 2;
  const g = new THREE.Group(); g.add(m); g.rotation.y = -((i / SIGNAL_SHAPE.chevronRing.chevrons) * Math.PI * 2 + Math.PI / 4); chevrons.push(g); stand.add(g);
}
const standLight = new THREE.PointLight(C(signal[1]), 0, 2.5, 2); // borrowed as the 4th real light only after the kill

// ---------- frame ----------
const tmp = new THREE.Vector3();
function poseHero(t: number) {
  const p = heroAt(t);
  const r = hero.root, b = hero.body;
  r.position.set(p.x, 0.1, p.z);
  r.rotation.set(0, Math.PI / 2 - p.face, 0);
  b.position.set(0, 0, 0); b.rotation.set(0, 0, 0); b.scale.set(1, 1, 1);
  hero.spin.rotation.set(0, 0, 0); hero.spin.position.set(0, 0.75, 0); hero.spin.scale.setScalar(1);
  hero.arm.rotation.set(0, 0, 0); hero.legL.position.y = 0.18; hero.legR.position.y = 0.18; hero.legs.rotation.set(0, 0, 0); hero.legs.position.set(0, 0, 0);
  const A = ANIM;
  const ph = (t / A.idle.bobPeriod) * Math.PI * 2;
  if (p.state === 'idle') {
    const s = 1 + Math.sin(ph) * A.idle.breatheScale * 0.5;
    b.position.y = (Math.sin(ph) * 0.5 + 0.5) * A.idle.bobHeightFrac * SIZE.heroUnits; b.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
  } else if (p.state === 'move') {
    const step = p.st * A.move.stepsPerSec; const f = step % 1;
    const hop = Math.sin(f * Math.PI) * A.move.hopHeightFrac * SIZE.heroUnits;
    const ease = Math.min(1, p.st / 0.15, (p.dur - p.st) / 0.15);
    b.position.y = hop * ease; b.rotation.x = THREE.MathUtils.degToRad(A.move.leanDeg[1]) * ease;
    if (f > 0.85 || f < 0.08) { const [sx, sy] = A.move.landSquash; b.scale.set(1 + (sx - 1) * ease, 1 + (sy - 1) * ease, 1 + (sx - 1) * ease); }
    const swing = Math.sin(step * Math.PI) * 0.12 * ease;
    hero.legL.position.y = 0.18 + Math.max(0, swing); hero.legR.position.y = 0.18 + Math.max(0, -swing);
    hero.arm.rotation.x = Math.sin(step * Math.PI) * 0.4 * ease;
  } else if (p.state === 'roll') {
    // Dodge roll: tuck, one forward turn round the waist, a little hop, land in a squash.
    const k = p.st / p.dur;
    hero.spin.rotation.x = easeOutQuad(k) * Math.PI * 2;
    hero.spin.position.y = 0.75 + 0.25 * Math.sin(k * Math.PI);
    hero.spin.scale.setScalar(0.82 + 0.18 * Math.abs(Math.cos(k * Math.PI)));
  } else if (p.state === 'swing') {
    // Wind-up (pull back, squash), snap with overshoot, settle (ANIM.windup / ANIM.attack).
    const wind = 0.14, snap = A.attack.snapSec[1];
    let arm: number, lean: number;
    if (p.st < wind) { const k = easeOutQuad(p.st / wind); arm = -1.9 * k; lean = -THREE.MathUtils.degToRad(A.windup.pullBackDeg) * k; b.scale.set(1 + 0.06 * k, 1 - 0.06 * k, 1 + 0.06 * k); }
    else if (p.st < wind + snap) { const k = (p.st - wind) / snap; arm = -1.9 + (1.9 + 1.6 + 0.35) * k; lean = THREE.MathUtils.degToRad(A.attack.overshootDeg) * k; }
    else { const k = easeOutBack(Math.min(1, (p.st - wind - snap) / (p.dur - wind - snap))); arm = 1.95 - 1.95 * k; lean = THREE.MathUtils.degToRad(A.attack.overshootDeg) * (1 - k); }
    hero.arm.rotation.x = arm; b.rotation.x = lean;
  }
  heroLight.position.set(p.x + 0.4, 2.6, p.z + 0.9);
  return p;
}

function poseFoe(t: number) {
  const p = foeAt(t);
  const r = foe.root, b = foe.body, S = foe.S;
  const away = Math.atan2(FOE_DIR.z, FOE_DIR.x);
  r.position.set(p.x - Math.cos(p.face) * p.knock, 0.1, p.z - Math.sin(p.face) * p.knock);
  void away;
  r.rotation.set(0, Math.PI / 2 - p.face, 0);
  b.position.set(0, 0, 0); b.rotation.set(0, 0, 0); b.scale.set(1, 1, 1);
  for (const a of foe.arms) a.rotation.set(0, 0, 0);
  const A = ANIM; const ph = (t / A.idle.bobPeriod) * Math.PI * 2 + 1.7;
  let eye = 0.55, crack = 0.5 + 0.5 * Math.sin(t * 2.2);
  r.visible = p.state !== 'dead';
  if (p.state === 'sleep') { eye = 0.15; b.position.y = -0.06; b.rotation.x = 0.12; const s = 1 + Math.sin(ph * 0.6) * 0.02; b.scale.set(1, s, 1); crack = 0.3 + 0.2 * Math.sin(t * 1.3); }
  else if (p.state === 'wake') { const k = p.st / p.dur; eye = 0.15 + 0.85 * k; b.position.y = 0.12 * Math.sin(k * Math.PI); }
  else if (p.state === 'idle') { const s = 1 + Math.sin(ph) * A.idle.breatheScale; b.position.y = (Math.sin(ph) * 0.5 + 0.5) * A.idle.bobHeightFrac * 1.9; b.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s)); }
  else if (p.state === 'windup') {
    // Pull back and squash, arms raised, eyes brighten; held for the whole tell.
    const k = easeOutQuad(Math.min(1, p.st / 0.35)); const shake = p.st > 0.35 ? Math.sin(t * 60) * 0.015 : 0;
    const [sx, sy] = A.windup.squash;
    b.scale.set(1 + (sx - 1) * k, 1 + (sy - 1) * k, 1 + (sx - 1) * k); b.rotation.x = -THREE.MathUtils.degToRad(A.windup.pullBackDeg) * k; b.position.x = shake;
    for (const a of foe.arms) a.rotation.x = -2.5 * k;
    eye = 1; crack = 1;
  } else if (p.state === 'slam') {
    const k = p.st / p.dur; const hit = Math.min(1, p.st / A.attack.snapSec[0]);
    b.rotation.x = THREE.MathUtils.degToRad(25) * (hit - easeOutQuad(Math.max(0, k - 0.2) / 0.8) * 0.9);
    for (const a of foe.arms) a.rotation.x = -2.5 + 3.6 * hit - 1.1 * easeOutQuad(k);
    b.scale.set(1 + 0.08 * (1 - k), 1 - 0.08 * (1 - k), 1 + 0.08 * (1 - k));
    eye = 1; crack = 1;
  }
  // Hit reaction: flash, squash, recover (ANIM.hit).
  const flashOn = p.hitT < A.hit.flashSec[1] && p.state !== 'dead';
  setFlash(foe.meshes, flashOn);
  if (p.hitT < A.hit.recoverSec + 0.05) { const k = 1 - p.hitT / (A.hit.recoverSec + 0.05); const [sx, sy] = A.hit.squash; b.scale.multiply(tmp.set(1 + (sx - 1) * k, 1 + (sy - 1) * k, 1 + (sx - 1) * k)); }
  for (const e of foe.eyes) { e.scale.set(1, 0.5 + eye, 1); (e.material as THREE.MeshBasicMaterial).color.set(eye > 0.6 ? fire[4] : fire[2]); }
  for (const c of foe.cracks) (c.material as THREE.MeshBasicMaterial).color.set(crack > 0.75 ? fire[4] : crack > 0.4 ? fire[3] : fire[2]);
  (foe.maw.material as THREE.MeshBasicMaterial).color.set(crack > 0.75 ? fire[3] : fire[2]);
  void S;
  return p;
}
const FOE_DIR = { x: 0, z: 1 };

function poseFx(t: number, foeP: ReturnType<typeof foeAt>) {
  // Danger zone.
  const tg = telegraphAt(t);
  for (const m of [dangerFill, dangerEdge, dangerGrow]) m.visible = !!tg;
  if (tg) {
    const J = SIGNAL_SHAPE.jagged; const crawl = (t * J.crawlUnitsPerSec * J.teethPerUnit) % 1;
    const appear = Math.min(1, tg.k * 6);
    const r = tg.r * (0.7 + 0.3 * easeOutBack(appear));
    dangerFill.geometry.dispose(); dangerFill.geometry = jaggedRing(r, -1, crawl);
    dangerEdge.geometry.dispose(); dangerEdge.geometry = jaggedRing(r, J.edgeWidth * 1.4, crawl);
    dangerGrow.geometry.dispose(); dangerGrow.geometry = jaggedRing(r * tg.k, -1, crawl); // fills as the slam nears
    for (const m of [dangerFill, dangerEdge, dangerGrow]) m.position.set(tg.x, 0.12, tg.z);
    dangerGrow.position.y = 0.125; dangerEdge.position.y = 0.13;
  }
  // Slam dust.
  for (const s of SLAMS) {
    const dt = t - s.strike;
    for (const d of dust) {
      if (dt >= 0 && dt < 0.5) {
        d.m.visible = true; const k = dt / 0.5; const rr = s.r * (0.5 + 0.7 * easeOutQuad(k));
        d.m.position.set(s.x + Math.cos(d.a) * rr, 0.2 + 0.3 * Math.sin(k * Math.PI), s.z + Math.sin(d.a) * rr); d.m.scale.setScalar(1.2 * (1 - k) + 0.2);
      } else if (dt >= 0.5 && dt < 0.6) d.m.visible = false;
    }
    if (dt >= 0 && dt < 0.5) break;
  }
  if (!SLAMS.some((s) => t - s.strike >= 0 && t - s.strike < 0.5)) for (const d of dust) d.m.visible = false;
  // Shatter, with a short hit-stop on the killing blow.
  const kt = Math.max(0, t - KILL_T - HITSTOP_SEC);
  const home = { x: foeP.x - Math.cos(foeP.face) * foeP.knock, z: foeP.z - Math.sin(foeP.face) * foeP.knock };
  for (const s of shards) {
    s.m.visible = t >= KILL_T;
    if (!s.m.visible) continue;
    const g = 9.8; const tLand = (s.vy + Math.sqrt(s.vy * s.vy + 2 * g * (s.y0 - 0.16))) / g; const tt = Math.min(kt, tLand);
    const slide = kt > tLand ? Math.min(0.25, (kt - tLand) * 0.6) : 0;
    s.m.position.set(home.x + s.vx * (tt + slide * 0.3), Math.max(0.16, s.y0 + s.vy * tt - 0.5 * g * tt * tt), home.z + s.vz * (tt + slide * 0.3));
    if (kt < tLand) s.m.rotation.set(s.rest[0] + s.spin[0] * kt, s.rest[1] + s.spin[1] * kt, s.rest[2] + s.spin[2] * kt);
    else s.m.rotation.set(0.0, s.rest[1] + s.spin[1] * tLand, 0.0);
  }
  for (const e of burst) {
    const k = kt / e.life; e.m.visible = t >= KILL_T && k < 1;
    if (!e.m.visible) continue;
    e.m.position.set(home.x + e.vx * kt, 1.0 + e.vy * kt - 2.5 * kt * kt, home.z + e.vz * kt); e.m.scale.setScalar(1 - k);
  }
  // Embers rising from the kiln.
  for (let i = 0; i < EMBERS; i++) {
    const s = emberSeed[i]; const k = (t * s.sp * 0.25 + s.ph) % 1;
    emberMeshes[i].position.set(-1.2 + s.dx * (0.3 + k) + Math.sin(t * 1.3 + s.sw) * 0.15, 0.4 + k * 3.2, -2.3 + s.dz * k); emberMeshes[i].scale.setScalar(1 - k * 0.8);
  }
  // Kiln and brazier flicker (slow, small).
  kilnLight.intensity = 9 * (0.92 + 0.08 * Math.sin(t * 5.1) * Math.sin(t * 1.7 + 2));
  brazierLight.intensity = 5 * (0.9 + 0.1 * Math.sin(t * 7.3 + 1));
  // Stand-here ring at the exit.
  stand.visible = t >= STAND.on;
  if (stand.visible) {
    const appear = easeOutBack(Math.min(1, (t - STAND.on) / 0.35));
    stand.position.set(STAND.x, 0.13, STAND.z); stand.scale.setScalar(Math.max(0.01, appear));
    const CR = SIGNAL_SHAPE.chevronRing; const pk = ((t - STAND.on) / CR.pulseSec) % 1;
    for (const c of chevrons) c.children[0].position.set(0.95 - 0.28 * easeOutQuad(pk), 0.005, 0);
    standLight.intensity = 3 * appear; standLight.position.set(STAND.x, 0.8, STAND.z);
  }
}
scene.add(standLight);
kilnLight.castShadow = false;
void SWINGS; void HIT_DELAY;

function render(t: number) {
  const heroP = poseHero(t);
  const foeP = poseFoe(t);
  poseFx(t, foeP);
  // Swing hits on the hero side: a tiny hero lunge already covered; flash the hero never (no hero damage in the clip).
  setFlash(hero.meshes, false);
  void heroP;
  placeCamera(shakeAt(t), t);
  renderer.render(scene, camera);
}

/** Measure a figure's on-screen height in CSS px (for the size check in the README). */
function measure(which: 'hero' | 'foe', t = 1.0) {
  render(t);
  const o = which === 'hero' ? hero.body : foe.body; const r = which === 'hero' ? hero.root : foe.root;
  const top = new THREE.Box3().setFromObject(o).max.y;
  const a = tmp.set(r.position.x, 0.1, r.position.z).project(camera).y;
  const bTop = tmp.set(r.position.x, top, r.position.z).project(camera).y;
  return { px: Math.round((bTop - a) / 2 * H), units: +(top - 0.1).toFixed(2) };
}

(window as unknown as { lookTest: unknown }).lookTest = { render, measure, ready: true, calls: () => renderer.info.render.calls };
render(0);
