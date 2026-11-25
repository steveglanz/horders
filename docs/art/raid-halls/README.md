# The raids' own Halls themes (H5, 25 Nov)

These are for design's H5 plan (/mnt/project-files/horders/design/halls/h5-plan.md). No raid map is on yet: the raids
aren't in HALLS_BETA, and a raid map would roll the Kiln's themes today. Each raid gets four themes in the colours of
its arena (renderer ROOMS). They're bright on a phone and nothing glows. Each has one quiet motion: a hanging prop
that sways from its bracket, a wheel that turns, or the room light swelling slowly.

| Raid | Theme | Room | Motion |
|---|---|---|---|
| Crucible (H5a) | Ladle hall | door guard; Round, Cross | a great copper ladle sways under a wall crane |
| | Crane bay | boss door alcove; Hall, Ring, Twin | a hook block sways on its chain |
| | Mould floor | Round, Ring, Twin | the light swells faintly (0.06), as the moulds cool |
| | Clinker heap | the quiet room; any shape; cracked floor | the light barely breathes (0.04) |
| Hoard (H5b) | Coal bunker | door guard; cracked floor | warm light breathing (0.05) |
| | Scale hall | alcove | a great balance sways from a wall bracket |
| | Coffer vault | | gold light that swells a little (0.08) |
| | Tithe store | the quiet room | light barely breathing (0.04) |
| Smeltery (H5c) | Tapping floor | door guard | warm light breathing from the taphole (0.15; the trough itself doesn't glow) |
| | Flywheel hall | alcove | a big steel flywheel turns (about 30 s a turn) |
| | Billet rack | the quiet room; cracked floor | light barely breathing (0.04) |
| | Hoist shaft | | a hoist hook sways |
| Flue (H5d) | Firebox row | door guard | amber light breathing like the Kiln's bellows (0.2) |
| | Damper hall | alcove | a big damper plate rocks on its pivot |
| | Soot chamber | cracked floor | pale light barely breathing (0.05) |
| | Sweeps' gallery | the quiet room | light barely breathing (0.04) |

Sim kits: THEME_KITS.crucible, .hoard, .smeltery and .flue in sim/halls.ts. A new H5 test rolls each kit on the H2 map
for seeds 1-40. It checks that the door guard's room gets the raid's guard theme, R2 stays the shrine, every other
room gets one of the raid's themes, and no two neighbouring rooms share a theme. halls3d now asks MOVING (in
client/hd2d/hallsthemes.ts) which props move, instead of using a hard-coded list.

## Cost, four heroes on screen

Measured at 320x568 with `hd2d.stats()`, with three bots standing round the hero. The themes are injected into the
Hammerdeep map (seed 8), as for the Pressworks kit. Draw calls:

| Room | Hammerdeep's own themes | Crucible | Hoard | Smeltery | Flue |
|---|---|---|---|---|---|
| r1 | 89 | 89 | 89 | 89 | 89 |
| r3 | 95 | 94 | 94 | 94 | 94 |
| r4 | 75 | 74 | 74 | 73 | 73 |
| r7 | 92 | 92 | 92 | 91 | 91 |

Each theme adds one prop batch per room, the same as every theme before. The new themes cost the same as the
Hammerdeep's or one less. With four heroes, the busiest room is 94, 2 under the bar. The extra cost is the heroes,
not the themes: the same rooms cost 68-73 solo.

Shots, from the left: r1, r3, r4, r7.
- crucible.jpg: ladle hall, mould floor, crane bay, clinker heap.
- hoard.jpg: coal bunker, coffer vault, scale hall, tithe store.
- smeltery.jpg: tapping floor, hoist shaft, flywheel hall, billet rack.
- flue.jpg: firebox row, soot chamber, damper hall, sweeps' gallery.
- crucible-2d.jpg: the 2D look (r1, r4).

To make them: `THEMES=clinker,ladle,shrine,mould,crane,ladle,crane,clinker SPOTS=r1,r3,r4,r7 node docs/art/raid-halls/shots.cjs dist <out>`
(env NO3D=1 for 2D). The other lists are in the commit.
