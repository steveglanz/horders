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

/** One wall piece: centre (world units), length (world units), outward normal (world x, y). */
export interface WallPiece { x: number; y: number; len: number; nx: number; ny: number }

/**
 * The map's walls as straight pieces about 70 world units long: each room's rim, leaving a gap where a corridor meets
 * it (and the door alcove's north side, where the boss door stands), and both sides of each corridor between the rooms.
 */
export function hallsWalls(m: HallsMap, corridor: number, doorRoom: number): { room: number; corridor: number; p: WallPiece }[] {
  const out: { room: number; corridor: number; p: WallPiece }[] = [];
  const hw = corridor / 2;
  m.rooms.forEach((r, i) => {
    const gaps: [number, number][] = [];
    for (const c of m.corridors) {
      if (c.a !== i && c.b !== i) continue;
      const o = m.rooms[c.a === i ? c.b : c.a];
      gaps.push([Math.atan2(o.y - r.y, o.x - r.x), Math.asin(Math.min(1, hw / r.r))]);
    }
    // The door alcove has no rim of its own: the door frame and the corridor's walls close it.
    if (i === doorRoom) return;
    const n = Math.max(8, Math.ceil((2 * Math.PI * r.r) / 70));
    for (let k = 0; k < n; k++) {
      const a = (k + 0.5) * ((2 * Math.PI) / n) - Math.PI;
      if (gaps.some(([g, h]) => Math.abs(Math.atan2(Math.sin(a - g), Math.cos(a - g))) < h)) continue;
      const nx = Math.cos(a), ny = Math.sin(a);
      out.push({ room: i, corridor: -1, p: { x: r.x + nx * r.r, y: r.y + ny * r.r, len: ((2 * Math.PI * r.r) / n) * 1.04, nx, ny } });
    }
  });
  m.corridors.forEach((c, ci) => {
    const a = m.rooms[c.a], b = m.rooms[c.b];
    const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const t0 = Math.sqrt(Math.max(0, a.r * a.r - hw * hw)), t1 = L - Math.sqrt(Math.max(0, b.r * b.r - hw * hw));
    if (t1 <= t0) return;
    const n = Math.max(1, Math.round((t1 - t0) / 70)), step = (t1 - t0) / n;
    for (const s of [1, -1]) {
      const nx = -uy * s, ny = ux * s;
      for (let k = 0; k < n; k++) {
        const t = t0 + (k + 0.5) * step;
        out.push({ room: -1, corridor: ci, p: { x: a.x + ux * t + nx * hw, y: a.y + uy * t + ny * hw, len: step * 1.02, nx, ny } });
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

/** Whether (x, y) is on the map's floor: in a room, or within half a corridor's width of its centre line. */
export function onFloor(m: HallsMap, corridor: number, x: number, y: number): boolean {
  for (const r of m.rooms) if ((x - r.x) ** 2 + (y - r.y) ** 2 <= r.r * r.r) return true;
  const hw = corridor / 2;
  for (const c of m.corridors) {
    const a = m.rooms[c.a], b = m.rooms[c.b], vx = b.x - a.x, vy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy || 1)));
    if ((x - a.x - vx * t) ** 2 + (y - a.y - vy * t) ** 2 <= hw * hw) return true;
  }
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
  m.rooms.forEach((r, i) => {
    const g = new THREE.CircleGeometry(r.r * S, 56); g.rotateX(-Math.PI / 2); g.translate(r.x * S, FLOOR, r.y * S); worldUv(g);
    const mesh = new THREE.Mesh(g, floorMat); mesh.receiveShadow = true; roomChunk[i].g.add(mesh);
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
      const h = Math.max(NEAR_H, Math.min(wallHeight(p.ny), clearance(m, o.corridor, p, S))), len = p.len * S;
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
  door.position.set(m.door.x * S, FLOOR, (m.door.y - dr.r) * S);
  const post = new THREE.BoxGeometry(0.42, 3.3, 0.5);
  const frameMat = new THREE.MeshStandardMaterial({ color: '#c47a5c', roughness: 0.9 });
  for (const sx of [-1.45, 1.45]) { const p = new THREE.Mesh(post, frameMat); p.position.set(sx, 1.65, 0); p.castShadow = !o.saver; door.add(p); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 0.56), frameMat); lintel.position.y = 3.45; lintel.castShadow = !o.saver; door.add(lintel);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.2, 0.14), new THREE.MeshStandardMaterial({ color: '#3a2e2c', roughness: 0.5, metalness: 0.6 }));
  panel.position.set(0, 1.6, -0.05); door.add(panel);
  // The seal: a red disc on the door (a bar read as a health bar), with a darker rim.
  const bar = new THREE.Group(); bar.position.set(0, 1.7, 0.08); door.add(bar);
  bar.add(new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), new THREE.MeshBasicMaterial({ color: o.bad.clone().multiplyScalar(0.85) })));
  const sealRim = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.52, 28), new THREE.MeshStandardMaterial({ color: '#1e1614', roughness: 0.4, metalness: 0.7 })); sealRim.position.z = 0.002; bar.add(sealRim);
  const glowMat = new THREE.MeshBasicMaterial({ map: doorGlowTex(), transparent: true, depthWrite: false, opacity: 0, fog: false });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.25), glowMat); glow.position.set(0, 1.62, -0.12); door.add(glow);
  roomChunk[o.doorRoom].g.add(door);

  // Sleeping packs: a faint red ring at the reach, shown only with a hero near (the spec's 400).
  const ringMat = m.packs.map(() => new THREE.MeshBasicMaterial({ color: o.bad.clone().multiplyScalar(1.1), transparent: true, opacity: 0, depthWrite: false }));
  const ringGeo = new THREE.RingGeometry(SIM.hallsReach * S - 0.05, SIM.hallsReach * S, 72);
  const rings = m.packs.map((p, k) => {
    const r = new THREE.Mesh(ringGeo, ringMat[k]); r.rotation.x = -Math.PI / 2; r.position.set(p.x * S, FLOOR + 0.03, p.y * S); r.renderOrder = 2;
    roomChunk[p.room].g.add(r); return r;
  });

  let openK = 0, lastT = 0;
  return {
    group,
    pieces: chunks.length * 3 + 6,
    update(mm, cx, cz, hx, hy, t) {
      const dt = Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
      // On screen: the camera shows about 9 units either side and from 12 ahead to 6 behind the hero (the foe cull's box).
      for (const c of chunks) c.g.visible = c.x + c.r > cx - 10 && c.x - c.r < cx + 10 && c.z + c.r > cz - 14 && c.z - c.r < cz + 7;
      const guard = mm.packs.find((p) => p.guard);
      const open = !guard || guard.state === 'cleared';
      openK = Math.max(0, Math.min(1, openK + (open ? dt : -dt) * 1.5));
      panel.visible = openK < 0.99; panel.scale.x = 1 - openK; bar.visible = !open;
      glowMat.opacity = openK * (0.9 + 0.1 * Math.sin(t * 3));
      mm.packs.forEach((p, k) => {
        const near = Math.hypot(hx - p.x, hy - p.y) < SIM.hallsShowRing;
        const target = p.state === 'asleep' && near ? 0.38 + 0.06 * Math.sin(t * 2 + k) : 0;
        const mat = ringMat[k]; mat.opacity += (target - mat.opacity) * Math.min(1, dt * 6);
        rings[k].visible = mat.opacity > 0.01;
      });
    },
  };
}
