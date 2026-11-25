# Hidden in 3D, part 1: revive, Ysmeret's vents, Ondrel's Anvilfall (25 Nov)

These are the first three items of the sweep in docs/art/oskel-3d (#762), in design's order. Each was drawn on
overFx, which the 3D view covers.

- **Revive** (all group content):
  - The rescuer's tether and the revive progress ring are floor marks, so they move to the main graphics and the
    floor bridge lays them on the 3D floor.
  - The bobbing green "+" over a downed hero nobody is reviving yet, and the grey struck-through cross when a boss
    allows no more revives, go on the 3D overlay (drawLabels3d), above the hero's name.
- **Ysmeret's vents** (and Grandmother Slag's):
  - The gold ring on a covered vent and the red turning dashes on an empty one move to the floor layer.
  - The badge over each vent (a green tick when covered, a blinking red "!" when empty) goes on the 3D overlay, as the
    Pressworks plate badge does (#759).
- **Ondrel's Anvilfall:**
  - The closing red reticle moves to the floor layer.
  - The falling anvil is a mesh (client/hd2d/anvil3d.ts): the 2D silhouette extruded, falling with 2D's ease and
    landing on the target's head. It is unlit with its shading painted in by face, like the Stamp die, because the
    hero's own light washes a lit prop over their head out to white.

In 2D the moved floor marks now draw under the sprites, as every other floor mark does. The badges, the "+" and the
anvil stay where they were.

Cost (320x568, `hd2d.stats()`), before / after:

| Moment | Before | After |
|---|---|---|
| downed, calling | 82 | 82 |
| reviving | 79 | 80 |
| no revive left | 82 | 82 |
| vents | 86 | 86 |
| Anvilfall | 85 | 86 |

Shots, in the same order (downed and calling, reviving, no revive left, one vent covered and one empty, the anvil
falling, the anvil landing): before-3d.jpg, after-3d.jpg, after-2d.jpg (the first five).
`MODE=revive|vents|anvil node docs/art/hidden-marks-1/shots.cjs dist <out>` (env NO3D=1, LAND=1).

Next in design's order: the Flue, the Hoard and the Smeltery; then the class marks; then the rest.
