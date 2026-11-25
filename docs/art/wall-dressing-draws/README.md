# Wall chains and press frames in fewer draws

Oskel's arena in the Pressworks went over the 3D cost bar (96 draw calls at 320x568) when the camera was near the arena rim. Two sets of dressing were drawn one piece at a time:

- **Wall chains** (forge rooms: Kiln, Flue, Hammerdeep, Pressworks, Smeltery, Crucible, Hoard): every link of each of the 7 chains was its own mesh. Each chain is now one merged mesh.
- **Pressworks press frames**: each frame was several meshes (posts, beam, head). Each frame's parts are now merged into one mesh per material. They still cast and receive shadows.

The look does not change: the same geometry, the same materials, the same positions.

## Draw calls (hd2d.stats().calls, Pressworks Oskel stage 1, solo)

| Camera on the hero at | Before | After |
|---|---|---|
| Back wall (0, -430) | 101 | 76 |
| North-east rim (300, -300) | 107 | 77 |
| West rim (-420, -120) | 98 | 71 |
| Centre (0, 110) | 70 | 69 |

The other rooms' room-life shots (docs/art/room-life-draws, shots.cjs modes flue, smeltery, hoard, anvil) give the same counts before and after: Flue 84/86/86, Smeltery 73, Hoard 68, Anvil 69/70/70. Their camera does not see the chains.

## Shots

- `before-back-wall.png`, `after-back-wall.png`: the back wall, before and after.
- `rim-w-top-before-after.jpg`: the press frame by the west rim, before (top) and after (bottom).

Pixel differences between the before and after shots are the moving embers and Oskel, not the walls.

Re-run: `node shots.cjs <dist> <outDir>`.
