# The Ashvents' own Halls themes (H4b, 25 Nov)

The Ashvents map rolled the Kiln's themes, as the Hammerdeep's did before #744. These four use pale ash floors and
rose stone like Ysmeret's arena, with warm pale light. Nothing glows: the vents smoke, they don't burn. Each has at
most one quiet motion:

| Theme | Room | Motion |
|---|---|---|
| Fumarole field | door guard, and any vents room | smoke rises off each vent's mouth (the boiler's steam) |
| Obsidian gallery | boss door alcove; Hall, Ring, Twin | its rose light breathes (swell 0.08) |
| Cairn walk | the quiet room; any shape | none |
| Pumice drift | Round, Ring, Twin; the palest floor | its light swells faintly (0.06) |

Sim kit: THEME_KITS.ashvents in sim/halls.ts. Only the Pressworks still falls back to the Kiln's themes. The H4b test
checks the Ashvents' themes, the door guard's fumarole field, and that no two neighbours share a theme.

Cost (seed 8, 320x568, `hd2d.stats()`), before / after: r0 43/43, r1 69/69, r3 74/73, r4 54/54, r5 76/77, r7 77/77.

Shots: before-3d-kiln-themes.jpg, after-3d.jpg (r1 fumarole, r3 cairn, r4 obsidian, r5 the fumarole guard, r7 pumice),
after-2d.jpg (r1, r4, r7). `node docs/art/ashvents-halls/shots.cjs dist <out>` (env SPOTS, NO3D=1).
