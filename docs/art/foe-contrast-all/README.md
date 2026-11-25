# Foe contrast on every map and arena (25 Nov)

#796 made foes stand out on the Kiln's red-brown floor. Mobile's Crucible phone pass (docs/ux/crucible-halls/) then found the same problem on the Crucible's rose floor: Cinderhounds' thin red outlines got lost. Design asked for one rule everywhere, so the Kiln treatment is now the default for every room, map and arena (client/hd2d/renderer.ts):

- A foe's red edge is twice as thick.
- Foes glow more of their own colour (emissive 0.6, up from 0.34). Per-kind values in `FOE_GLOW` (the Rimehound's 0.8) still win.
- The red ring at a foe's feet is wide and bright (inner radius 0.76, opacity 0.95, colour BAD x 1.5) everywhere.
- The Coldmarrow keeps its lighter blob shadow.

No meshes are added, so the draw cost is unchanged.

## Shots

Solo Bulwark, 3D at 320x568, on the Halls map, with the first pack drawn in round the hero:

- `zoom-before-after.png`: from top to bottom Crucible (tier 8), Glarewell (4), Coldmarrow (6) and Foundry (3). Before is on the left, after on the right.
- `before-<room>.png` and `after-<room>.png`: the full screens.

To re-run: `node shots.cjs <dist> <outDir> <dungeon> [tier]`
