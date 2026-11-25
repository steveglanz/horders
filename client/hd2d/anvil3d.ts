/**
 * Ondrel's Anvilfall (the Hammerdeep) in 3D: the anvil falling onto its target. 2D draws it on overFx, which the 3D view
 * covers, so in 3D only its growing shadow showed (the sweep in docs/art/oskel-3d). The anvil is the 2D one's
 * silhouette (horn, waist, foot) extruded, dark iron with a pale face, falling with 2D's ease ((1 - f)^2) and landing
 * on the target's head as the cast ends. Its closing reticle and shadow are floor marks the bridge already carries.
 *
 * Cost: 1 draw call while Ondrel casts Anvilfall (one mesh, one material), none otherwise. No shadow cast.
 */
import * as THREE from 'three';
import type { World } from '../../sim/world';

/** How high it starts (world px, 2D's 150), and where it lands: its foot this many px over the target's feet. */
const DROP = 150;
const HEAD = 80;

export interface AnvilView {
  group: THREE.Group;
  update(w: World, a: number, t: number): void;
}

export function buildAnvil3d(o: { S: number; floor: number }): AnvilView {
  const { S, floor: FLOOR } = o;
  const group = new THREE.Group();
  // The 2D outline (x right, y down, 1.2x), here 1.5x it: y flipped to up, foot at y = 0.
  const pts = [[-26, -10], [22, -10], [34, -6], [22, -2], [14, -2], [10, 6], [16, 12], [-16, 12], [-10, 6], [-14, -2], [-26, -2]];
  const k = 1.8 * S;
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * k, (12 - y) * k)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 22 * k, bevelEnabled: true, bevelThickness: 1.5 * k, bevelSize: 1.5 * k, bevelSegments: 1 });
  geo.translate(0, 0, -11 * k);
  // Unlit, its shading painted in by face: the hero's own light washes a lit prop over their head out to white (oskel3d).
  // Faces pointing up get the worn steel face (the camera sees mostly that); the rest dark iron, a little lighter toward
  // the camera.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const ny = nrm.getY(i), nz = nrm.getZ(i);
    // Linear values: the output pass lifts darks a lot (0.16 reads tan), so the iron is very dark here.
    const c = ny > 0.7 ? [0.13, 0.14, 0.17] : nz > 0.7 ? [0.05, 0.045, 0.06] : [0.025, 0.022, 0.03];
    col.set(c, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  mesh.visible = false; mesh.frustumCulled = false; group.add(mesh);
  return {
    group,
    update(w, a, t) {
      const b = w.bossIndex >= 0 ? w.enemies[w.bossIndex] : undefined;
      const on = !!b && b.alive && b.kind === 'ondrel' && b.castId === 'anvilfall' && b.castDur > 0;
      mesh.visible = on;
      if (!on) return;
      const f = Math.min(1, b!.castT / b!.castDur);
      const p = w.heroData(w.anvilfallTarget).player;
      const x = (p.px + (p.x - p.px) * a) * S, z = (p.py + (p.y - p.py) * a) * S;
      mesh.position.set(x, FLOOR + (HEAD + (1 - f) * (1 - f) * DROP) * S, z);
      // A slow turn as it falls, settling square to the camera before it lands.
      mesh.rotation.set(0, (1 - f) * 0.6 * Math.sin(t * 2), 0);
    },
  };
}
