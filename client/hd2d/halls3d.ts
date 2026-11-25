/**
 * Phase 18 Halls H1: the greybox Kiln map in 3D (design spec /mnt/project-files/horders/design/halls/h1-prototype-spec.md,
 * visuals' kit plan https://claude.ai/artifact/6i5Tz2eWZ7CAu5FMxAR5iV). Plain shapes in the Kiln's colours: floors for the
 * rooms and corridors, walls round them, the boss door, and a faint red ring under each sleeping pack. The H2 kit
 * (arches, dressing, room life) replaces these once Steve has played H1.
 *
 * Walls follow the plan's facing rule. The camera always looks north from about 49 degrees, so a wall on the near (south)
 * side of the floor h tall hides about 0.88 h of floor behind it: far walls stand 3 units, east and west walls 1.6, and
 * near walls are a 0.35 ledge, blended by which way each piece faces.
 *
 * Only what is near the hero is drawn (each room and each corridor is its own group, hidden when off screen), so a frame
 * costs about what today's one room does. The map is built once, in world units times S, with no per-room scaling.
 */
import * as THREE from 'three';
import type { HallsMap } from '../../sim/halls';
import { SIM } from './simconsts';
import { grateState, hallsGrates, liftedOf, lockOf } from '../hallsgrates';
import { Loop, inCorridor, inLoop, inRoom, roomLoops, roomPieces } from '../hallsshape';

/** Floor tiles: the room's 0.62-unit firebrick tiles (renderer.ts buildRoom), drawn into one repeating texture. */
const TILE = 0.62;
const WALL_T = 0.22;
const FAR_H = 3, SIDE_H = 1.6, NEAR_H = 0.35;

/** A wall piece's height from the z part of its outward normal (+z faces the camera). */
export function wallHeight(nz: number): number {
  if (nz <= -0.3) return FAR_H;
  if (nz <= 0.1) return FAR_H + ((nz + 0.3) / 0.4) * (SIDE_H - FAR_H);
  if (nz <= 0.5) return SIDE_H + ((nz - 0.1) / 0.4) * (NEAR_H - SIDE_H);
  return NEAR_H;
}

/** One wall piece: centre (world units), length (world units), outward normal (world x, y), and whether it rings an island. */
export interface WallPiece { x: number; y: number; len: number; nx: number; ny: number; island?: boolean }

/** Each map's room outlines, worked out once (client/hallsshape.ts). */
const LOOPS = new WeakMap<HallsMap, Loop[][]>();
const loopsOf = (m: HallsMap): Loop[][] => LOOPS.get(m) ?? LOOPS.set(m, m.rooms.map(roomLoops)).get(m)!;

/** The Ring room's island is a low hearth (camera rule, agreed with design 25 Nov): it may hide no more than a body. */
const HEARTH_H = 0.5;

/**
 * The map's walls as straight pieces about 70 world units long: each room's outline, leaving a gap where a corridor
 * meets it (and the door alcove's north side, where the boss door stands), and both sides of each corridor between the
 * rooms. Any room shape works: the outline is HallsRoom.edge, or the room's circle when there is none.
 */
export function hallsWalls(m: HallsMap, corridor: number, doorRoom: number): { room: number; corridor: number; p: WallPiece }[] {
  const out: { room: number; corridor: number; p: WallPiece }[] = [];
  const hw = corridor / 2, loops = loopsOf(m);
  m.rooms.forEach((_, i) => {
    // The door alcove: the boss door spans it across its middle, so only its south half gets a rim (a low near ledge),
    // leaving the corridor's mouth open. Its north half lies behind the door.
    const half = i === doorRoom;
    for (const p of roomPieces(m, i, hw)) {
      if (half && !p.island && p.ny <= 0.05) continue;
      out.push({ room: i, corridor: -1, p: { x: p.x, y: p.y, len: p.len * 1.04, nx: p.nx, ny: p.ny, island: p.island } });
    }
  });
  m.corridors.forEach((c, ci) => {
    const a = m.rooms[c.a], b = m.rooms[c.b];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    for (const s of [1, -1]) {
      const nx = -uy * s, ny = ux * s, sx = a.x + nx * hw, sy = a.y + ny * hw;
      // Where this side leaves room a's outline and enters room b's, marching out from each centre.
      let t0 = 0; while (t0 < L && inLoop(loops[c.a][0], sx + ux * t0, sy + uy * t0)) t0 += 4;
      let t1 = L; while (t1 > t0 && inLoop(loops[c.b][0], sx + ux * t1, sy + uy * t1)) t1 -= 4;
      if (t1 - t0 < 8) continue;
      const n = Math.max(1, Math.round((t1 - t0) / 70)), step = (t1 - t0) / n;
      for (let k = 0; k < n; k++) {
        const t = t0 + (k + 0.5) * step;
        out.push({ room: -1, corridor: ci, p: { x: sx + ux * t, y: sy + uy * t, len: step * 1.02, nx, ny } });
      }
    }
  });
  return out;
}

/** The open boss door's light: the whole opening glows, white-gold at the floor to deep orange at the top. */
function doorGlowTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 96;
  const k = c.getContext('2d')!, g = k.createLinearGradient(0, 96, 0, 0);
  g.addColorStop(0, '#fff2c4'); g.addColorStop(0.45, '#ffb24a'); g.addColorStop(1, '#c8500e');
  k.fillStyle = g; k.fillRect(0, 0, 64, 96);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Banked coals for an island hearth: near-black lumps with a few embers glowing between them, tiled in world space. */
function coalTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const k = c.getContext('2d')!;
  k.fillStyle = '#120806'; k.fillRect(0, 0, 128, 128);
  let s = 5;
  const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < 60; i++) { k.fillStyle = `rgba(${150 + r() * 105 | 0},${40 + r() * 50 | 0},10,${0.25 + r() * 0.5})`; k.beginPath(); k.arc(r() * 128, r() * 128, 1 + r() * 3, 0, 7); k.fill(); }
  for (let i = 0; i < 40; i++) { k.fillStyle = `rgba(20,12,10,${0.7 + r() * 0.3})`; k.beginPath(); k.arc(r() * 128, r() * 128, 5 + r() * 8, 0, 7); k.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function tileCanvas(color: string): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const k = c.getContext('2d')!;
  k.fillStyle = '#140906'; k.fillRect(0, 0, 128, 128);
  const base = new THREE.Color(color);
  // Two rows of two tiles, the second row offset by half a tile, as the room's floor lays them.
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let row = 0; row < 2; row++) for (let i = -1; i < 2; i++) {
    const x = i * 64 + (row % 2) * 32, y = row * 64;
    const l = 0.8 + r() * 0.28;
    k.fillStyle = `#${base.clone().multiplyScalar(l).getHexString()}`;
    k.fillRect(x + 3, y + 3, 58, 58);
    k.fillStyle = 'rgba(255,200,160,0.06)'; k.fillRect(x + 3, y + 3, 58, 4);
    k.fillStyle = 'rgba(0,0,0,0.22)'; k.fillRect(x + 3, y + 55, 58, 6);
  }
  for (let i = 0; i < 500; i++) { k.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.2})`; k.fillRect(r() * 128, r() * 128, 2, 2); }
  return c;
}

/** Whether (x, y) is on the map's floor: in a room (off its islands), or within half a corridor's width of its centre line. */
export function onFloor(m: HallsMap, corridor: number, x: number, y: number): boolean {
  const loops = loopsOf(m);
  for (let i = 0; i < m.rooms.length; i++) {
    const r = m.rooms[i];
    if ((x - r.x) ** 2 + (y - r.y) ** 2 <= r.r * r.r && inRoom(loops[i], x, y)) return true;
  }
  const hw = corridor / 2;
  for (let ci = 0; ci < m.corridors.length; ci++) if (inCorridor(m, ci, hw, x, y)) return true;
  return false;
}

/**
 * How tall a wall piece may stand so that it hides no floor behind it, in 3D units: the camera looks north, so a wall h
 * tall hides about 0.88 h of whatever lies north of it. A room's far wall can have another room's floor just beyond it
 * (template A: R1's north rim is 100 world units from R3's floor), so it walks north from the piece's middle and both
 * ends to the nearest floor and stays low enough to leave it in sight.
 */
export function clearance(m: HallsMap, corridor: number, p: WallPiece, S: number): number {
  const tx = -p.ny, ty = p.nx;
  let best = Infinity;
  for (const k of [-0.5, 0, 0.5]) {
    const x = p.x + tx * p.len * k + p.nx * 16, y = p.y + ty * p.len * k + p.ny * 16;
    for (let d = 8; d < 280; d += 8) if (onFloor(m, corridor, x, y - d)) { best = Math.min(best, d); break; }
  }
  return best === Infinity ? Infinity : ((best - 12) * S) / 0.88;
}

/** Sets a floor geometry's uvs from its world position, so every room and corridor shares one seamless tiling. */
function worldUv(g: THREE.BufferGeometry): void {
  const p = g.attributes.position as THREE.BufferAttribute, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) / (2 * TILE); uv[i * 2 + 1] = p.getZ(i) / (2 * TILE); }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}

export interface HallsView {
  group: THREE.Group;
  /** Each frame: hide what is off screen around the camera's ground point, set the door and the pack rings. */
  update(m: HallsMap, cx: number, cz: number, heroX: number, heroY: number, t: number): void;
  /** Draw calls the map can add at most (the stats check). */
  pieces: number;
}

export function buildHalls3d(m: HallsMap, o: { S: number; floor: number; tile: string; ground: string; saver: boolean; bad: THREE.Color; corridor: number; doorRoom: number }): HallsView {
  const { S, floor: FLOOR } = o;
  const group = new THREE.Group();
  const tex = new THREE.CanvasTexture(tileCanvas(o.tile));
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, metalness: 0.02 });
  const wallMat = new THREE.MeshStandardMaterial({ color: '#9a5a44', roughness: 0.92 });
  const capMat = new THREE.MeshStandardMaterial({ color: '#4a3a34', roughness: 0.8 });
  const coalMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.95, emissive: '#ffffff', emissiveIntensity: 0.9 });
  { const ct = coalTex(); coalMat.map = ct; coalMat.emissiveMap = ct; }
  const box = new THREE.BoxGeometry(1, 1, 1);

  // Each room and each corridor is a chunk: its floor, its walls and their caps, and a bound for the on-screen check.
  type Chunk = { g: THREE.Group; x: number; z: number; r: number };
  const chunks: Chunk[] = [];
  const roomChunk = m.rooms.map((r) => { const g = new THREE.Group(); group.add(g); const c = { g, x: r.x * S, z: r.y * S, r: r.r * S + 0.4 }; chunks.push(c); return c; });
  const corChunk = m.corridors.map((c) => {
    const a = m.rooms[c.a], b = m.rooms[c.b];
    const g = new THREE.Group(); group.add(g);
    const ch = { g, x: ((a.x + b.x) / 2) * S, z: ((a.y + b.y) / 2) * S, r: (Math.hypot(b.x - a.x, b.y - a.y) / 2) * S + 0.4 };
    chunks.push(ch); return ch;
  });

  // Floors. Corridors sit a hair under the rooms, so where they overlap the room wins without flicker.
  loopsOf(m).forEach((loops, i) => {
    // The outline as a flat shape (islands as holes), laid on the floor: shape y is minus world y, so after the turn
    // onto the ground it lands at +z = world y.
    const pts = (l: Loop) => { const v: THREE.Vector2[] = []; for (let k = 0; k < l.length; k += 2) v.push(new THREE.Vector2(l[k] * S, -l[k + 1] * S)); return v; };
    const shape = new THREE.Shape(pts(loops[0]));
    for (let k = 1; k < loops.length; k++) shape.holes.push(new THREE.Path(pts(loops[k])));
    const g = new THREE.ShapeGeometry(shape, 4); g.rotateX(-Math.PI / 2); g.translate(0, FLOOR, 0); worldUv(g);
    const mesh = new THREE.Mesh(g, floorMat); mesh.receiveShadow = true; roomChunk[i].g.add(mesh);
    // Islands (the Ring's hearth): a bed of banked coals level with the hearth's low wall, so the corridor floor that
    // runs under it never shows, and it reads as something shots can't cross.
    for (let k = 1; k < loops.length; k++) {
      const hg = new THREE.ShapeGeometry(new THREE.Shape(pts(loops[k])), 4); hg.rotateX(-Math.PI / 2); hg.translate(0, FLOOR + HEARTH_H - 0.02, 0); worldUv(hg);
      roomChunk[i].g.add(new THREE.Mesh(hg, coalMat));
    }
  });
  m.corridors.forEach((c, i) => {
    const a = m.rooms[c.a], b = m.rooms[c.b], L = Math.hypot(b.x - a.x, b.y - a.y);
    const g = new THREE.PlaneGeometry(L * S, o.corridor * S); g.rotateX(-Math.PI / 2); g.rotateY(-Math.atan2(b.y - a.y, b.x - a.x));
    g.translate(((a.x + b.x) / 2) * S, FLOOR - 0.004, ((a.y + b.y) / 2) * S); worldUv(g);
    const mesh = new THREE.Mesh(g, floorMat); mesh.receiveShadow = true; corChunk[i].g.add(mesh);
  });

  // The dark beyond the walls, level with the floor, over the whole map.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const r of m.rooms) { x0 = Math.min(x0, r.x - r.r); x1 = Math.max(x1, r.x + r.r); y0 = Math.min(y0, r.y - r.r); y1 = Math.max(y1, r.y + r.r); }
  const gw = (x1 - x0) * S + 40, gd = (y1 - y0) * S + 40;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(gw, gd), new THREE.MeshStandardMaterial({ color: o.ground, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(((x0 + x1) / 2) * S, FLOOR - 0.02, ((y0 + y1) / 2) * S); ground.receiveShadow = true; group.add(ground);

  // Walls: one instanced batch of bricks and one of caps per chunk.
  const pieces = hallsWalls(m, o.corridor, o.doorRoom);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  let seed = 11;
  const sr = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const byChunk = new Map<Chunk, WallPiece[]>();
  for (const w of pieces) { const ch = w.room >= 0 ? roomChunk[w.room] : corChunk[w.corridor]; (byChunk.get(ch) ?? byChunk.set(ch, []).get(ch)!).push(w.p); }
  for (const [ch, list] of byChunk) {
    const walls = new THREE.InstancedMesh(box, wallMat, list.length), caps = new THREE.InstancedMesh(box, capMat, list.length);
    list.forEach((p, k) => {
      const h = Math.max(NEAR_H, Math.min(p.island ? HEARTH_H : wallHeight(p.ny), clearance(m, o.corridor, p, S))), len = p.len * S;
      // Along the rim: local x runs along the wall (the tangent), so it turns by the normal's angle.
      e.set(0, -Math.atan2(p.ny, p.nx) + Math.PI / 2, 0); q.setFromEuler(e);
      const px = (p.x + p.nx * (WALL_T / S / 2)) * S, pz = (p.y + p.ny * (WALL_T / S / 2)) * S;
      m4.compose(new THREE.Vector3(px, FLOOR + h / 2, pz), q, new THREE.Vector3(len, h, WALL_T)); walls.setMatrixAt(k, m4);
      col.set('#ffffff').multiplyScalar(0.82 + sr() * 0.22); walls.setColorAt(k, col);
      m4.compose(new THREE.Vector3(px, FLOOR + h + 0.04, pz), q, new THREE.Vector3(len * 1.02, 0.08, WALL_T + 0.08)); caps.setMatrixAt(k, m4);
    });
    walls.castShadow = !o.saver && true; walls.receiveShadow = true; caps.receiveShadow = true;
    ch.g.add(walls, caps);
  }

  // The boss door: a brick frame in the alcove's north side. Sealed while the door guard lives (dark iron, a dull red
  // bar: red is bad); once he falls the door is gone and gold light fills the arch.
  const door = new THREE.Group();
  const dr = m.rooms[o.doorRoom];
  // Across the alcove's middle, as wide as the alcove (130 world units in radius since the 1.3 scale, #668), so its
  // sides never show the dark beyond.
  door.position.set(m.door.x * S, FLOOR, m.door.y * S);
  const dw = dr.r * S;
  const post = new THREE.BoxGeometry(0.42, 3.3, 0.5);
  const frameMat = new THREE.MeshStandardMaterial({ color: '#c47a5c', roughness: 0.9 });
  for (const sx of [-(dw + 0.21), dw + 0.21]) { const p = new THREE.Mesh(post, frameMat); p.position.set(sx, 1.65, 0); p.castShadow = !o.saver; door.add(p); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(2 * dw + 0.9, 0.5, 0.56), frameMat); lintel.position.y = 3.45; lintel.castShadow = !o.saver; door.add(lintel);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2 * dw + 0.04, 3.2, 0.14), new THREE.MeshStandardMaterial({ color: '#3a2e2c', roughness: 0.5, metalness: 0.6 }));
  panel.position.set(0, 1.6, -0.05); door.add(panel);
  // The seal: a red disc on the door (a bar read as a health bar), with a darker rim.
  const bar = new THREE.Group(); bar.position.set(0, 1.7, 0.08); door.add(bar);
  bar.add(new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), new THREE.MeshBasicMaterial({ color: o.bad.clone().multiplyScalar(0.85) })));
  const sealRim = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 28), new THREE.MeshStandardMaterial({ color: '#1e1614', roughness: 0.4, metalness: 0.7 })); sealRim.position.z = 0.002; bar.add(sealRim);
  const glowMat = new THREE.MeshBasicMaterial({ map: doorGlowTex(), transparent: true, depthWrite: false, opacity: 0, fog: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2 * dw + 0.1, 3.25), glowMat); glow.position.set(0, 1.62, -0.12); door.add(glow);
  roomChunk[o.doorRoom].g.add(door);

  // Sleeping packs: a faint red ring at the reach, shown only with a hero near (the spec's 400).
  const ringMat = m.packs.map(() => new THREE.MeshBasicMaterial({ color: o.bad.clone().multiplyScalar(1.1), transparent: true, opacity: 0, depthWrite: false }));
  const ringGeo = new THREE.RingGeometry(SIM.hallsReach * S - 0.05, SIM.hallsReach * S, 72);
  const rings = m.packs.map((p, k) => {
    const r = new THREE.Mesh(ringGeo, ringMat[k]); r.rotation.x = -Math.PI / 2; r.position.set(p.x * S, FLOOR + 0.03, p.y * S); r.renderOrder = 2;
    roomChunk[p.room].g.add(r); return r;
  });

  // H2b ember grates: a sealing room's doorways glow red on the floor for 1 s (red is bad), then iron bars, hot at the
  // edges, drop across them; they lift once the room is cleared. One batch of bars and one of floor glows for the whole
  // map, written each frame for the rooms that are sealing, sealed or lifting, and hidden otherwise (no cost at rest).
  const grates = hallsGrates(m, o.corridor, o.doorRoom);
  const BAR_GAP = 0.26, BAR_H = 1.3, BAR_LIFT = 2.6;
  const perGrate = grates.map((g) => Math.max(3, Math.round((2 * g.hw * S) / BAR_GAP)));
  const barMat = new THREE.MeshStandardMaterial({ color: '#2a2220', roughness: 0.45, metalness: 0.7, emissive: o.bad, emissiveIntensity: 0 });
  const bars = new THREE.InstancedMesh(box, barMat, Math.max(1, perGrate.reduce((a, b) => a + b + 2, 0)));
  bars.frustumCulled = false; bars.visible = false; group.add(bars);
  const stripMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const stripGeo = new THREE.PlaneGeometry(1, 1); stripGeo.rotateX(-Math.PI / 2);
  const strips = new THREE.InstancedMesh(stripGeo, stripMat, Math.max(1, grates.length));
  strips.frustumCulled = false; strips.visible = false; strips.renderOrder = 2; group.add(strips);
  const v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), gq = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const red = o.bad.clone();
  const drawGrates = (mm: HallsMap, t: number) => {
    let nb = 0, ns = 0, hot = 0;
    grates.forEach((g, k) => {
      const r = mm.rooms[g.room];
      const st = grateState(lockOf(r), liftedOf(r));
      if (st.glow <= 0.001 && st.drop <= 0.001) return;
      // Bars across the doorway, along its tangent; a top and a bottom rail. Up out of sight while the floor glows.
      gq.setFromAxisAngle(up, -Math.atan2(g.uy, g.ux) + Math.PI / 2);
      const tx = -g.uy, ty = g.ux, w = 2 * g.hw * S, n = perGrate[k];
      // Dropping, they fall from above; lifting, they sink back into the floor (rising bars float in front of the room
      // from this camera and read as part of it).
      const lifting = lockOf(r) < 0, bh = lifting ? BAR_H * st.drop : BAR_H;
      const base = FLOOR + (lifting ? 0 : (1 - st.drop) * BAR_LIFT);
      if (st.drop > 0.001) {
        for (let b = 0; b < n; b++) {
          const off = ((b + 0.5) / n - 0.5) * w;
          v3.set(g.x * S + tx * off, base + bh / 2, g.y * S + ty * off); s3.set(0.07, bh, 0.07);
          m4.compose(v3, gq, s3); bars.setMatrixAt(nb++, m4);
        }
        for (const yy of [Math.min(0.12, bh * 0.5), bh - 0.06]) {
          v3.set(g.x * S, base + Math.max(0.03, yy), g.y * S); s3.set(w, 0.09, 0.1);
          m4.compose(v3, gq, s3); bars.setMatrixAt(nb++, m4);
        }
      }
      hot = Math.max(hot, st.glow);
      // The floor's warning: a red band across the doorway, pulsing faster as the drop nears.
      const lock = lockOf(r), pulse = lock >= 0 && st.drop === 0 ? 0.75 + 0.25 * Math.sin(t * (8 + 10 * st.glow)) : 1;
      v3.set(g.x * S, FLOOR + 0.02, g.y * S); s3.set(w + 0.1, 1, 0.55);
      m4.compose(v3, gq, s3); strips.setMatrixAt(ns, m4);
      col.copy(red).multiplyScalar(Math.min(1, st.glow * pulse) * 0.9); strips.setColorAt(ns++, col);
    });
    bars.count = nb; bars.visible = nb > 0; bars.instanceMatrix.needsUpdate = true;
    strips.count = ns; strips.visible = ns > 0; strips.instanceMatrix.needsUpdate = true;
    if (strips.instanceColor) strips.instanceColor.needsUpdate = true;
    barMat.emissiveIntensity = 0.12 + 0.75 * hot;
  };

  let openK = 0, lastT = 0;
  return {
    group,
    pieces: chunks.length * 3 + 8,
    update(mm, cx, cz, hx, hy, t) {
      const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
      // On screen: the camera shows about 9 units either side and from 12 ahead to 6 behind the hero (the foe cull's box).
      for (const c of chunks) c.g.visible = c.x + c.r > cx - 10 && c.x - c.r < cx + 10 && c.z + c.r > cz - 14 && c.z - c.r < cz + 7;
      const guard = mm.packs.find((p) => p.guard);
      const open = !guard || guard.state === 'cleared';
      openK = Math.max(0, Math.min(1, openK + (open ? dt : -dt) * 1.5));
      panel.visible = openK < 0.99; panel.scale.x = 1 - openK; bar.visible = !open;
      glowMat.opacity = openK * (0.9 + 0.1 * Math.sin(t * 3));
      drawGrates(mm, t);
      mm.packs.forEach((p, k) => {
        const near = Math.hypot(hx - p.x, hy - p.y) < SIM.hallsShowRing;
        const target = p.state === 'asleep' && near ? 0.38 + 0.06 * Math.sin(t * 2 + k) : 0;
        const mat = ringMat[k]; mat.opacity += (target - mat.opacity) * Math.min(1, dt * 6);
        rings[k].visible = mat.opacity > 0.01;
      });
    },
  };
}
