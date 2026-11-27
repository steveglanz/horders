/**
 * Oskel's falling Rivets and Stamp die (the Pressworks) in 3D. 2D draws both on overFx, which the 3D view covers, so a
 * phone in 3D saw only the floor rings (mobile's Pressworks phone pass, #759). Their shadows and the Stamp's reticle are
 * floor marks, which 2D draws on its main graphics and the floor bridge lays on the 3D floor; this draws what stands up.
 *
 * - Rivets: a brass domed rivet drops onto the middle of each Rivets ring (a 'hit' circle of OSKEL.rivetRadius owned
 *   by Oskel since CP4's melee answers; it was -1), falling as the ring's fuse runs (the 2D one's ease, (1 - f)^2) and landing as it goes off.
 * - Stamp: a steel die with a yellow-and-black hazard band and a plunger rod drops onto the hero Oskel is stamping
 *   (World.stampOn) as his Stamp cast runs, landing on their head as it hits.
 *
 * Cost: rivets 1 draw call (one InstancedMesh, count 0 when none fall); the die 2 while Oskel casts Stamp (the block
 * and the rod), none otherwise. Neither casts a shadow (the 2D shadow is on the floor already).
 */
import * as THREE from 'three';
import type { World } from '../../sim/world';

const CAP = 8;
/** How high a rivet starts (world px, as 2D's 140) and the die (2D's 150). */
const RIVET_DROP = 140;
const DIE_DROP = 150;
/** Where the die lands: its bottom this many world px over the hero's feet. */
const HEAD = 80;

export interface OskelView {
  group: THREE.Group;
  update(w: World, a: number): void;
}

/** A hazard band: yellow with black diagonal stripes over the bottom quarter, plain steel above. */
function dieSideTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5a645a'; g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#6c776c'; g.fillRect(0, 0, 128, 6);
  g.fillStyle = '#f2c230'; g.fillRect(0, 44, 128, 20);
  g.fillStyle = '#16120c';
  for (let x = -24; x < 140; x += 18) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 9, 64); g.lineTo(x + 21, 44); g.lineTo(x + 12, 44); g.closePath(); g.fill(); }
  g.fillStyle = '#d8e0d4'; g.beginPath(); g.arc(14, 18, 3.5, 0, Math.PI * 2); g.arc(114, 18, 3.5, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#0c0506'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, 125, 61);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildOskel3d(o: { S: number; floor: number; rivetR: number }): OskelView {
  const { S, floor: FLOOR } = o;
  const group = new THREE.Group();

  // A rivet: a short shank under a low dome (lathe profile, world px x S), its base at y = 0.
  // Twice the 2D rivet's size: at the 3D view's zoom on a phone a true-size one read as a speck.
  const prof = [[0, 0], [2.5, 0], [2.5, 9], [9, 9], [8.6, 11], [7.4, 13], [5.4, 14.6], [2.8, 15.5], [0, 15.8]].map(([x, y]) => new THREE.Vector2(x * 2.2 * S, y * 2.2 * S));
  const rivetGeo = new THREE.LatheGeometry(prof, 14);
  const rivetMat = new THREE.MeshStandardMaterial({ color: '#d8a850', roughness: 0.35, metalness: 0.75, emissive: new THREE.Color('#3a2408') });
  const rivets = new THREE.InstancedMesh(rivetGeo, rivetMat, CAP);
  rivets.count = 0; rivets.frustumCulled = false; group.add(rivets);

  // The die: a 72 x 36 x 54 px steel block (1.5x the 2D one, for the same reason), its hazard band round the sides, a
  // plunger rod on top.
  // Unlit, its shading painted in: it hangs right under the hero's own light, which washed a lit die out to white.
  const side = new THREE.MeshBasicMaterial({ map: dieSideTex() });
  const die = new THREE.Group();
  // One material (a box's six face groups would be six draw calls): the top and bottom faces sample plain steel.
  const boxGeo = new THREE.BoxGeometry(72 * S, 36 * S, 54 * S).translate(0, 18 * S, 0);
  boxGeo.clearGroups();
  const uv = boxGeo.attributes.uv as THREE.BufferAttribute;
  for (let k = 8; k < 16; k++) uv.setXY(k, 0.3 + 0.4 * uv.getX(k), 0.55 + 0.25 * uv.getY(k));
  const block = new THREE.Mesh(boxGeo, side);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(6 * S, 6 * S, 60 * S, 10).translate(0, 66 * S, 0), new THREE.MeshBasicMaterial({ color: '#b8c0b6' }));
  die.add(block, rod); die.visible = false; group.add(die);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  return {
    group,
    update(w, a) {
      let n = 0;
      if (w.dungeonId === 'pressworks') {
        for (const t of w.telegraphs) {
          if (!t.alive || t.kind !== 'hit' || w.enemies[t.owner]?.kind !== 'oskel' || t.r !== o.rivetR || n >= CAP) continue;
          const f = Math.min(1, t.t / Math.max(0.01, t.dur));
          rivets.setMatrixAt(n++, m4.compose(v.set(t.x * S, FLOOR + (1 - f) * (1 - f) * RIVET_DROP * S, t.y * S), q, one));
        }
      }
      rivets.count = n; rivets.instanceMatrix.needsUpdate = true;

      const b = w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
      const stamping = !!b && b.alive && b.kind === 'oskel' && b.castId === 'stamp' && b.castDur > 0;
      die.visible = stamping;
      if (stamping) {
        const f = Math.min(1, b!.castT / b!.castDur);
        const p = w.heroData(w.stampOn).player;
        const x = (p.px + (p.x - p.px) * a) * S, z = (p.py + (p.y - p.py) * a) * S;
        // It comes down onto the hero's head (their sprite stands about 80 px tall and is drawn toward the camera, so a die
        // any lower hides behind it).
        die.position.set(x, FLOOR + (HEAD + (1 - f) * (1 - f) * DIE_DROP) * S, z);
        // A rattle as it nears, like the reticle's beat.
        die.rotation.set(0, f > 0.75 ? Math.sin(f * 90) * 0.04 : 0, 0);
      }
    },
  };
}
