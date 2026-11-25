# The Hammerdeep's own Halls themes (H4a, 25 Nov)

The Hammerdeep map rolled the Kiln's themes, and a theme sets the floor, walls, light and props. So the map looked exactly
like the Kiln: sacks, bellows, slag heaps and brown floors. Design agreed it should have its own (every dungeon gets 3-5,
h3-plan.md). These four are cold forge iron, grey-violet like Ondrel's arena, with pale lantern light and nothing
glowing. Each has one quiet motion:

| Theme | Room | Motion |
|---|---|---|
| Anvil hall | door guard | its lanterns breathe (light swell 0.08) |
| Chain gallery | boss door alcove; Hall, Ring, Twin | chains sway a few degrees along the wall, about every 8 s |
| Quench trough | Round, Ring, Twin | steam lifts off the water (the Foundry boiler's steam) |
| Ingot store | the quiet room; any shape | none |

The shrine stays as R2. Data: client/hallsthemes.ts. 3D props: client/hd2d/hallsthemes.ts (swing in propMotion,
applied in halls3d roomLife). 2D props: client/hallsview.ts. Sim kit: THEME_KITS.hammerdeep in sim/halls.ts.
The H4a test now checks the Hammerdeep's themes, the door guard's anvil hall, and that no two neighbours share a theme.

Cost (seed 8, 320x568, `hd2d.stats()`): rooms r1/r3/r4/r5 drew 69/74/54/80 before and 68/74/54/81 after. The quench
room (r7) draws 76. Triangles are lower (props are simpler than the Kiln's).

Shots: before-3d-kiln-themes.jpg, after-3d.jpg (r1 anvil, r3 ingot, r4 chain, r5 anvil guard, r7 quench), after-2d.jpg.
`node docs/art/hammerdeep-halls/shots.cjs dist <out>` (env SPOTS=r1,r4 ..., NO3D=1).
