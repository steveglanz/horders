/**
 * The staged Ondrel's burning slag (design's "Ondrel v2", engineering's ONDRELV2) in 3D.
 *
 * Stage 2: each Anvilfall leaves a flat patch of slag (World.slagPatches, radius ONDRELV2.r). It reads as burning
 * floor you can walk over but shouldn't stand in: a dark cooled crust broken into plates, molten seams glowing between
 * them, and a red rim that breathes slowly (red = bad, Steve's colour rule). Flat on the floor, nothing stands up, so it
 * never looks like a wall.
 * Stage 3: each patch glows for ONDRELV2.glow s (glow counts down from it), the seams widening and running white-hot
 * while the rim beats faster, then it bursts: a red-orange flash ring out to the burst radius. The burst's own circle
 * telegraph (radius ONDRELV2.burstR) is the renderer's usual telegraph.
 *
 * Cost: patches 1 draw call (one InstancedMesh, at most ONDRELV2.cap), bursts 1 while one is showing. Both are hidden
 * outside the fight (no patches, no draws).
 */
import * as THREE from 'three';

export interface SlagWorld {
  slagPatches?: { x: number; y: number; tick: number; glow: number }[];
}

/** How long a burst's flash ring takes to spread and fade (s). */
const BURST_T = 0.45;
const CAP = 8;

export interface SlagView {
  group: THREE.Group;
  update(w: SlagWorld, t: number, dt: number): void;
}

export function buildSlag3d(o: { S: number; floor: number; r: number; burstR: number; glowT: number; bad: THREE.Color }): SlagView {
  const { S, floor: FLOOR } = o;
  const group = new THREE.Group();
  const disc = new THREE.CircleGeometry(1, 48); disc.rotateX(-Math.PI / 2);
  const glowA = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1);
  const seedA = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1);
  disc.setAttribute('aGlow', glowA); disc.setAttribute('aSeed', seedA);
  // Plates: a cellular pattern (distance to the nearest cell minus the second nearest is small on a seam).
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    uniforms: { t: { value: 0 }, bad: { value: o.bad.clone() } },
    vertexShader: `attribute float aGlow; attribute float aSeed; varying vec2 vL; varying float vG; varying float vS;
      void main() { vL = position.xz; vG = aGlow; vS = aSeed; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float t; uniform vec3 bad; varying vec2 vL; varying float vG; varying float vS;
      vec2 h2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
      void main() {
        float d = length(vL);
        if (d > 1.0) discard;
        vec2 p = vL * 4.2 + vS * 17.0;
        vec2 c = floor(p); float f1 = 9.0, f2 = 9.0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 g = vec2(float(i), float(j)); vec2 q = g + h2(c + g) - fract(p);
          float e = dot(q, q); if (e < f1) { f2 = f1; f1 = e; } else if (e < f2) f2 = e;
        }
        float seam = sqrt(f2) - sqrt(f1);
        float w = 0.09 + 0.16 * vG;                       // seams widen as it nears bursting
        float m = 1.0 - smoothstep(w * 0.4, w, seam);     // 1 on a seam
        float breathe = 0.5 + 0.5 * sin(t * (vG > 0.0 ? 9.0 + 14.0 * vG : 2.2) + vS * 6.0);
        vec3 crust = mix(vec3(0.022, 0.009, 0.006), vec3(0.042, 0.016, 0.009), h2(c).x);   // linear: the output pass lifts it
        vec3 melt = mix(vec3(1.0, 0.32, 0.06), vec3(1.0, 0.62, 0.22), 0.5 + 0.5 * sin(t * 1.7 + vS * 9.0 + seam * 20.0));
        melt = mix(melt, vec3(1.0, 0.92, 0.7), vG * vG);  // white-hot just before it bursts
        vec3 col = mix(crust, melt * (1.1 + 0.3 * breathe), m);
        col += vec3(0.30, 0.05, 0.01) * (1.0 - d) * (0.12 + 0.6 * vG);   // a warm heart
        float rim = smoothstep(0.84, 0.93, d) * (1.0 - smoothstep(0.97, 1.0, d));
        col = mix(col, bad * (1.15 + 0.5 * breathe), rim);
        float a = mix(0.88, 1.0, m) * (1.0 - smoothstep(0.985, 1.0, d));
        gl_FragColor = vec4(col, a);
      }`,
  });
  const patches = new THREE.InstancedMesh(disc, mat, CAP);
  // After the floor bridge (1), before telegraphs (2), so the last heat's burst circle draws over its patch.
  patches.count = 0; patches.frustumCulled = false; patches.renderOrder = 1.5; group.add(patches);

  // Bursts: a flat flash ring spreading to the burst radius and fading.
  const ringGeo = new THREE.RingGeometry(0.72, 1, 48); ringGeo.rotateX(-Math.PI / 2);
  const burstMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6a2a'), transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
  const bursts = new THREE.InstancedMesh(ringGeo, burstMat, CAP);
  bursts.count = 0; bursts.frustumCulled = false; bursts.renderOrder = 3; group.add(bursts);
  const live: { x: number; y: number; age: number }[] = [];
  let was: { x: number; y: number; glow: number }[] = [];

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
  return {
    group,
    update(w, t, dt) {
      const list = w.slagPatches ?? [];
      // A patch that was glowing and is gone has burst.
      for (const a of was) if (a.glow > 0 && !list.some((b) => b.x === a.x && b.y === a.y)) live.push({ x: a.x, y: a.y, age: 0 });
      was = list.map((a) => ({ x: a.x, y: a.y, glow: a.glow }));
      const n = Math.min(CAP, list.length);
      for (let k = 0; k < n; k++) {
        const a = list[k], R = o.r * S;
        // Stage 3: glow counts down from glowT; 0 while it only burns.
        const g = a.glow > 0 ? 1 - a.glow / o.glowT : 0;
        const pulse = a.glow > 0 ? 1 + 0.04 * g * Math.sin(t * 30) : 1;
        patches.setMatrixAt(k, m4.compose(v.set(a.x * S, FLOOR + 0.03, a.y * S), q, s.set(R * pulse, 1, R * pulse)));
        glowA.setX(k, g); seedA.setX(k, ((a.x * 0.013 + a.y * 0.029) % 1 + 1) % 1);
      }
      patches.count = n; patches.instanceMatrix.needsUpdate = true; glowA.needsUpdate = true; seedA.needsUpdate = true;
      mat.uniforms.t.value = t;

      let b = 0;
      for (let k = live.length - 1; k >= 0; k--) { live[k].age += dt; if (live[k].age > BURST_T) live.splice(k, 1); }
      for (const e of live) {
        if (b >= CAP) break;
        const f = e.age / BURST_T, R = o.burstR * S * (0.35 + 0.65 * Math.sqrt(f));
        bursts.setMatrixAt(b++, m4.compose(v.set(e.x * S, FLOOR + 0.04, e.y * S), q, s.set(R, 1, R)));
      }
      burstMat.opacity = live.length ? 0.9 * (1 - Math.min(...live.map((e) => e.age / BURST_T))) : 0;
      bursts.count = b; bursts.instanceMatrix.needsUpdate = true;
    },
  };
}
