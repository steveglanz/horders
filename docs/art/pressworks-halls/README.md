# The Pressworks' own Halls themes (H4c, 25 Nov)

The Pressworks map isn't on yet (it isn't in HALLS_BETA), and it would roll the Kiln's themes like the Hammerdeep and
the Ashvents did before #744 and #746. These four are ready for when engineering switches it on. They use olive-brass
floors and pale brass walls like Oskel's arena, with warm pale light. Nothing glows. Each has at most one quiet motion:

| Theme | Room | Motion |
|---|---|---|
| Press floor | door guard; Round, Cross | each press's ram rises and settles slowly (5 s) |
| Gear room | boss door alcove; Hall, Ring, Twin | one big gear on the wall turns slowly |
| Plate store | the quiet room; Round, Hall, Cross; cracked floor | none |
| Oil sump | Round, Ring, Twin | its light swells faintly (0.08) |

Sim kit: THEME_KITS.pressworks in sim/halls.ts. No dungeon falls back to the Kiln's themes now. Since the map is off,
the new H4c test rolls the kit on the H2 map for seeds 1-40: the door guard's room is the press floor, the quiet room
stays the shrine, every other room is a Pressworks theme, and no two neighbours share one.

Shots inject the themes into the Hammerdeep map (seed 8):
`THEMES=plate,press,shrine,plate,gear,press,gear,oil node docs/art/pressworks-halls/shots.cjs dist <out>`
(env SPOTS, NO3D=1).

Cost (320x568, `hd2d.stats()`), Kiln themes before / Pressworks after: r1 69/68, r3 74/73, r4 53/52, r5 80/80, r7 76/71.

Shots: before-3d-kiln-themes.jpg, after-3d.jpg (r1 press floor, r3 plate store, r4 gear room, r5 the press floor door
guard, r7 oil sump), after-2d.jpg (r1, r4, r7).
