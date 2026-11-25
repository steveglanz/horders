# Kiln foes stand out from the red-brown floor (25 Nov)

Mobile's phone pass (docs/ux/oskel-v2-kiln-trash/p320-kiln-ashbucks.png) found that on the Kiln's red-brown floor, the small dark foes (the Ashbucks) and their thin red outlines sank into the floor at 320 px.

Red stays the "bad" colour (Steve, 23 Nov). In the Kiln only (`warmRoom` in client/hd2d/renderer.ts):

- A foe's red edge is drawn twice as thick.
- Foes glow more of their own colour (emissive 0.6, from 0.34), so the ash-grey Ashbucks read lighter than the floor.
- The red ring at a foe's feet is wider and brighter (opacity 0.95, from 0.6), the same as in the Coldmarrow.

No new meshes, so the draw cost doesn't change. The other rooms are unchanged.

Shots come from `tools/kilntrashshots.cjs <outDir> p320` (solo Bulwark, Kiln tier 2, Halls map, seed 3), 3D at 320x568:

- `before-sealed.png`, `after-sealed.png`: the full screen, sealed in with the Ashbucks.
- `fight-before-after.png`: mid-fight, before (left) and after (right).
- `zoom-before-after.png`: two Ashbucks at 3x, before (left) and after (right).
