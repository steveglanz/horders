# Foe shadows and rings as two instanced meshes (25 Nov)

Design asked to bring the Coldmarrow Halls scene from PR #732 back under the 96-draw bar. On main it drew 96 at
320x568 (the size the bar was set at) and 97 at 568x320, with six foes up (Dimhorn, two Snuffers, three Rimehounds).

Every foe cost about five draws: its sprite, the sprite again in the shadow pass, its red outline, its blob shadow and
its red ring. The blob and the ring are now two InstancedMesh, one draw each for all foes, with the same geometry,
material, height and draw order (blobs first, rings over them). Nothing about the look changes.

Same scene, same moment, `hd2d.stats()`:

| | Before | After |
|---|---|---|
| 568x320 | 97 draws, 14,473 triangles | 87 draws, 14,473 triangles |
| 320x568 | 96 | 86 most frames, 92 at the busiest moment sampled (the Dimhorn's call rings up) |

Each extra foe now adds about three draws, not five.

`peak.cjs` samples `hd2d.stats()` through the fight. It needs a local, uncommitted debug line after
`const scene = new THREE.Scene();` in client/hd2d/renderer.ts: `(window as any).__h3 = { scene, renderer };`.
