/**
 * The three-stage Kiln Mother (design's doc "Bosses that aren't elites: the Kiln first", behind engineering's BOSSV2
 * flag): her ember eggs, the heated floor quarters, the eruption rings and the bellows in 3D. Steve's rules: keep it
 * simple, red means bad and green means good, so a hot quarter and a ring are red, the safe quarter and the ring's
 * gaps stay plain floor, and an egg (stamp it) stands in the gold "go here" ring the HUD and the Kiln Brand already use.
 *
 * Cost: eggs 2 draw calls (eggs and their rings), quarters 1 to 3, rings 1 each (at most 3), bellows 1 each (3). All
 * are hidden outside her fight. The great kiln she climbs into is the room's own centre kiln (renderer buildRoom);
 * the renderer flares its mouth by `mouthK`.
 */
import * as THREE from 'three';
import { themeProp } from './hallsthemes';

/** The fields engineering's sim sets on World for a v2 fight (kmStage 0 = not one). Read loosely until they're typed. */
export interface KmWorld {
  kmStage?: number;
  kmInKiln?: boolean;
  kmEggs?: { x: number; y: number; t: number; dur: number; alive: boolean }[];
  kmHeat?: { safe: number; warn: number; on: boolean } | null;
  kmRings?: { x: number; y: number; r: number; w: number; gaps: number[]; alive: boolean }[];
}

/** Seconds of wobble before an egg hatches (design: the last 1.5 s). */
const WOBBLE = 1.5;
/** The warning before the quarters burn (design: 1.5 s ahead). */
export const HEAT_WARN = 1.5;

export interface KmView {
  group: THREE.Group;
  /** Each frame; returns how much the great kiln's mouth should flare (1 = as today, more while she is inside). */
  update(w: KmWorld, t: number, hx: number, hy: number): number;
}

export function buildKm3d(o: { S: number; floor: number; arena: number; bad: THREE.Color; good: THREE.Color; gold: THREE.Color; saver: boolean }): KmView {
  const { S, floor: FLOOR } = o;
  const group = new THREE.Group();

  // Eggs: dark shells with ember cracks that glow brighter as they near hatching, in a gold ring.
  const EGGS = 6;
  const eggMat = new THREE.MeshStandardMaterial({ color: '#3a2018', roughness: 0.6, emissive: '#ff7a30', emissiveIntensity: 0.6 });
  const eggs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 14, 10), eggMat, EGGS);
  eggs.castShadow = !o.saver; eggs.frustumCulled = false; eggs.visible = false; group.add(eggs);
  const ringGeo = new THREE.RingGeometry(0.82, 1, 40); ringGeo.rotateX(-Math.PI / 2);
  const eggRingMat = new THREE.MeshBasicMaterial({ color: o.gold, transparent: true, opacity: 0.75, depthWrite: false });
  const eggRings = new THREE.InstancedMesh(ringGeo, eggRingMat, EGGS);
  eggRings.frustumCulled = false; eggRings.visible = false; eggRings.renderOrder = 2; group.add(eggRings);

  // Heated quarters: a red sector each, over the arena floor. Quarter q covers q*90 deg +-45 (0 = east, world y down);
  // a world angle a sits at 3D (cos a, sin a) on x and z, which a circle sector reaches at theta = -a after it is laid
  // flat, so q's sector starts at -(q*90 + 45) deg.
  // Drawn in the telegraph look (a fill, stripes and a bright edge), so it reads as "don't stand here" even on the
  // Kiln's red brick floor.
  const quarterMat = (a0: number) => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { col: { value: o.bad.clone() }, op: { value: 0 }, a0: { value: a0 }, R: { value: o.arena * S } },
    vertexShader: 'varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 col; uniform float op; uniform float a0; uniform float R; varying vec2 vP;
      void main() {
        vec2 d1 = vec2(cos(a0), sin(a0)), d2 = vec2(cos(a0 + 1.5707963), sin(a0 + 1.5707963));
        float e = min(min(abs(d1.x * vP.y - d1.y * vP.x), abs(d2.x * vP.y - d2.y * vP.x)), R - length(vP));
        float edge = 1.0 - smoothstep(0.04, 0.1, e);
        float stripe = step(0.6, fract((vP.x + vP.y) * 1.6));
        gl_FragColor = vec4(col * (1.0 + 0.6 * edge), op * (0.55 + 0.45 * stripe + 1.2 * edge));
      }`,
  });
  const quarters = [0, 1, 2, 3].map((q) => {
    // World angle a lands at 3D (cos a, sin a) on x and z, and the laid-flat sector covers that for theta in -a.
    const g = new THREE.CircleGeometry(o.arena * S, 24, -(q * Math.PI / 2 + Math.PI / 4), Math.PI / 2); g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, quarterMat(q * Math.PI / 2 - Math.PI / 4)); mesh.position.y = FLOOR + 0.012; mesh.renderOrder = 1; mesh.visible = false; group.add(mesh);
    return mesh;
  });

  // The safe quarter (QA, 25 Nov: at phone zoom the screen was all red stripes): a faint green floor (green is good),
  // and a green arrow at your hero's feet pointing to it whenever you stand outside it during the heat.
  const safeMats = [0, 1, 2, 3].map(() => new THREE.MeshBasicMaterial({ color: o.good, transparent: true, opacity: 0, depthWrite: false }));
  const safe = [0, 1, 2, 3].map((q) => {
    const g = new THREE.CircleGeometry(o.arena * S, 24, -(q * Math.PI / 2 + Math.PI / 4), Math.PI / 2); g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, safeMats[q]); mesh.position.y = FLOOR + 0.011; mesh.renderOrder = 1; mesh.visible = false; group.add(mesh);
    return mesh;
  });
  const arrowShape = new THREE.Shape([new THREE.Vector2(0.5, 0), new THREE.Vector2(-0.1, 0.36), new THREE.Vector2(0.05, 0), new THREE.Vector2(-0.1, -0.36)]);
  const arrowGeo = new THREE.ShapeGeometry(arrowShape); arrowGeo.rotateX(-Math.PI / 2);
  const arrowMat = new THREE.MeshBasicMaterial({ color: o.good.clone().multiplyScalar(1.3), transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, toneMapped: false });
  const arrow = new THREE.Mesh(arrowGeo, arrowMat); arrow.renderOrder = 8; arrow.visible = false; group.add(arrow);
  let warnMax = 0;

  // Eruption rings: a red band with its two gaps left open, rebuilt as the ring grows (at most 3, a few dozen
  // triangles each).
  const ringMat = new THREE.MeshBasicMaterial({ color: o.bad.clone().multiplyScalar(1.2), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
  const rings = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.BufferGeometry(), ringMat); m.visible = false; m.renderOrder = 2; group.add(m); return { m, key: '' }; });
  const bandGeo = (r: number, w: number, gaps: number[]): THREE.BufferGeometry => {
    // The open arcs between the gaps (gap a is centred on its angle), as one triangle strip each.
    const g: [number, number][] = [];
    for (let k = 0; k + 1 < gaps.length; k += 2) g.push([gaps[k], gaps[k + 1]]);
    g.sort((a, b) => a[0] - b[0]);
    const pos: number[] = [], r0 = Math.max(0.01, r - w / 2) * S, r1 = (r + w / 2) * S;
    const arcs: [number, number][] = [];
    if (!g.length) arcs.push([0, Math.PI * 2]);
    for (let k = 0; k < g.length; k++) {
      const end = g[k][0] + g[k][1] / 2, next = g[(k + 1) % g.length];
      let start = next[0] - next[1] / 2;
      if (start <= end) start += Math.PI * 2;
      arcs.push([end, start]);
    }
    for (const [a0, a1] of arcs) {
      const n = Math.max(2, Math.ceil(((a1 - a0) * r1) / 0.25));
      for (let i = 0; i < n; i++) {
        const u0 = a0 + ((a1 - a0) * i) / n, u1 = a0 + ((a1 - a0) * (i + 1)) / n;
        const p = (rr: number, a: number) => [Math.cos(a) * rr, 0, Math.sin(a) * rr];
        pos.push(...p(r0, u0), ...p(r1, u0), ...p(r1, u1), ...p(r0, u0), ...p(r1, u1), ...p(r0, u1));
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); return geo;
  };

  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  let mouth = 1;
  return {
    group,
    update(w, t, hx, hy) {
      const on = (w.kmStage ?? 0) > 0;
      group.visible = on;
      if (!on) { mouth += (1 - mouth) * 0.1; return mouth; }
      // Eggs: sit still, then wobble harder over their last 1.5 s, the cracks glowing brighter.
      let n = 0, hot = 0;
      for (const egg of w.kmEggs ?? []) {
        if (!egg.alive || n >= EGGS) continue;
        const left = egg.dur - egg.t, k = Math.max(0, Math.min(1, 1 - left / WOBBLE));
        hot = Math.max(hot, k);
        const wob = k * 0.35 * Math.sin(t * (14 + 10 * k));
        e.set(0, n * 1.7, wob); q4.setFromEuler(e);
        v.set(egg.x * S, FLOOR + 0.26, egg.y * S); s.set(0.36, 0.48, 0.36);
        m4.compose(v, q4, s); eggs.setMatrixAt(n, m4);
        q4.identity(); v.y = FLOOR + 0.02; const rr = 0.5 + 0.05 * Math.sin(t * 4 + n); s.set(rr, 1, rr);
        m4.compose(v, q4, s); eggRings.setMatrixAt(n, m4);
        n++;
      }
      eggs.count = eggRings.count = n; eggs.visible = eggRings.visible = n > 0;
      eggs.instanceMatrix.needsUpdate = eggRings.instanceMatrix.needsUpdate = true;
      eggMat.emissiveIntensity = 0.5 + 1.6 * hot + 0.2 * Math.sin(t * 6);
      // Quarters: the three that aren't safe warn for 1.5 s (pulsing, rising), then burn (steady, a slow shimmer).
      const h = w.kmHeat;
      quarters.forEach((mesh, qi) => {
        const m = mesh.material as THREE.ShaderMaterial;
        let a = 0;
        if (h && qi !== h.safe) {
          if (h.on) a = 0.5 + 0.05 * Math.sin(t * 3 + qi);
          else if (h.warn > 0) { const k = 1 - Math.min(1, h.warn / Math.max(HEAT_WARN, warnMax)); a = (0.12 + 0.3 * k) * (0.7 + 0.3 * Math.sin(t * (8 + 8 * k))); }
        }
        m.uniforms.op.value = a; mesh.visible = a > 0.005;
      });
      // The warning's length is the sim's (it grew from 1.5 s), so the pulse follows the longest warning seen this cycle.
      warnMax = h && h.warn > 0 ? Math.max(warnMax, h.warn) : 0;
      const heat = !!h && (h.on || h.warn > 0);
      safe.forEach((mesh, qi) => { const on = heat && qi === h!.safe; mesh.visible = on; safeMats[qi].opacity = on ? 0.16 + 0.04 * Math.sin(t * 3) : 0; });
      // Your hero's quarter (q*90 deg +-45, 0 = east, y down), and the arrow to the safe one if it isn't it.
      const mine = ((Math.round(Math.atan2(hy, hx) / (Math.PI / 2)) % 4) + 4) % 4;
      arrow.visible = heat && mine !== h!.safe;
      if (arrow.visible) {
        const a = (h!.safe * Math.PI) / 2, tx = Math.cos(a) * o.arena * 0.55, ty = Math.sin(a) * o.arena * 0.55;
        const dir = Math.atan2(ty - hy, tx - hx), bob = 0.12 * Math.sin(t * 6);
        arrow.position.set((hx + Math.cos(dir) * 70) * S + Math.cos(dir) * bob, FLOOR + 0.05, (hy + Math.sin(dir) * 70) * S + Math.sin(dir) * bob);
        arrow.rotation.y = -dir;
        arrowMat.opacity = h!.on ? 0.95 : 0.75;
      }
      // Rings: rebuilt only when their radius moves.
      const list = w.kmRings ?? [];
      rings.forEach((rg, k) => {
        const ring = list[k];
        if (!ring || !ring.alive) { rg.m.visible = false; return; }
        const key = `${Math.round(ring.r)}|${ring.w}|${ring.gaps.join(',')}`;
        if (key !== rg.key) { rg.m.geometry.dispose(); rg.m.geometry = bandGeo(ring.r, ring.w, ring.gaps); rg.key = key; }
        rg.m.position.set(ring.x * S, FLOOR + 0.03, ring.y * S); rg.m.visible = true;
      });
      // The great kiln's mouth roars while she is inside; it gutters once the bellows are broken and she falls out.
      const target = w.kmInKiln ? 1.9 + 0.25 * Math.sin(t * 7) : 1;
      mouth += (target - mouth) * 0.08;
      return mouth;
    },
  };
}

/**
 * A great bellows for the fight, 3D, standing where the sim's 'kilnBellows' enemy is: the Bellows hall's prop (one
 * merged mesh, so three of them cost 3 draw calls and 3 shadow draws), breathing slower and sagging darker as it is hurt.
 */
export function makeKmBellows(): { g: THREE.Group; set(hpK: number, t: number, flash: number): void } {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, emissive: '#ffd0a0', emissiveIntensity: 0.12 });
  const body = new THREE.Mesh(themeProp('bellows'), mat); body.castShadow = true; body.receiveShadow = true;
  g.add(body);
  return {
    g,
    set(hpK, t, flash) {
      // No new colour: its red ring and outline say "hit this", as on any foe.
      body.scale.y = (0.55 + 0.45 * hpK) * (1 + 0.12 * hpK * Math.sin(t * 2.2));
      mat.color.setScalar(0.85 + 0.6 * hpK);
      mat.emissiveIntensity = flash > 0 ? 0.4 : 0.12;
    },
  };
}
