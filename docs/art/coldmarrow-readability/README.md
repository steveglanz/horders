# Coldmarrow Halls readability on phones (25 Nov)

Design relayed mobile's phone pass (PR #724, docs/ux/coldmarrow-halls/): Rimehounds read near-black on the dark Halls
floors, and the hero's coal light read as a faint thin ring. Shot with `shots.cjs` here (seed 4, 3D and the 2D look,
568x320 and 320x568), before = main at 703e87c, after = this branch.

## Rimehounds

- From above, a low-slung hound is a thin sliver of sprite over a black blob shadow, so on the dark floor you saw the
  shadow and a speck of red. Now, in the Coldmarrow only (3D): the foe ring is wider (0.76-1 of the hit box, was 0.86-1)
  and 0.95 opaque (was 0.6), and the blob shadow is 0.45 opaque, so the red ring says where a foe is, not a dark hole.
- The Rimehound glows more of its own pale colour in 3D (emissive 0.8, other foes 0.34).
- Its sprite gets a pale rime edge round the whole outline (client/textures.ts), so it reads in 3D and in 2D.
- Mobile's hounds shot caught them mid-spawn (frozen at about a third of their size), which made them look even smaller.

## Coal light edge (3D and 2D, drawn once in GameScene.coldDraw and carried onto the 3D floor)

- Lit: a solid warm line (4.5 wide) over a dark under-stroke, with a pale hot core. It still pulses red-orange when the
  coal runs low. The line itself doesn't move; the light under it already flickers.
- Out: a broken cold ring (3.5 wide, over a dark under-stroke), slowly turning, so "no light" never looks like a lit edge.
  It was a 1.5-wide grey line at 0.35, which was the faint ring mobile saw: in their shot the Snuffer had put the coal out.

## Cost

Same scene, same moment: 97 draw calls and 14,473 triangles before and after (`hd2d.stats()`). Nothing here adds a mesh;
97 is main's count with this many foes on screen.

| | Before | After |
|---|---|---|
| 3D, hounds, coal out (568x320) | before-3d-l568-hounds-coal-out.jpg | after-3d-l568-hounds-coal-out.jpg |
| 3D, coal lit (568x320) | before-3d-l568-coal-lit.jpg | after-3d-l568-coal-lit.jpg |
| 3D, hounds (320x568) | before-3d-p320-hounds.jpg | after-3d-p320-hounds.jpg |
| 2D, hounds, coal out | before-2d-l568-hounds-coal-out.jpg | after-2d-l568-hounds-coal-out.jpg |
| 2D, coal lit | before-2d-l568-coal-lit.jpg | after-2d-l568-coal-lit.jpg |

crop-3d-hounds.jpg and crop-2d-hounds.jpg: before left, after right, zoomed.
