# Room life in fewer draw calls (25 Nov)

Design asked (after the hidden-in-3D part 3, #766) to bring the Flue's room back under the 96 draw-call bar
(320x568) before raids move onto the Halls map (H5), where they get more foes on screen. The Flue measured 100 with
nothing showing and 102 with the Decree and Spent marks.

**Where the draws went.** A per-object count (a temporary `onAfterRender` / `onAfterShadow` hook on every mesh, not
committed) showed the room's quiet motion from 23 Nov drawing 17 separate meshes: five light shafts, five floor pools
under them and seven mist planes, each its own draw call. Every room has them.

**The change.** The shafts, the pools and the mist are now three InstancedMeshes (one draw call each), placed every
frame by the same sway and drift as before. Nothing about how they look changed: same geometry, same materials, same
motion. The mist planes share one colour, so the order they blend in makes no difference.

Cost (320x568, `hd2d.stats()`, seed 3), before / after:

| Room | Base | With marks |
|---|---|---|
| Flue | 100 / 87 | 102 / 89 (Decree + Spent) |
| Smeltery | 89 / 76 | 89 / 76 (Wheel, Meltdown) |
| Hoard | 84 / 71 | 84 / 71 (Craw, hero swallowed) |
| Ashvents | 82 / 69 | 86 / 73 (vents) |
| Hammerdeep | 85 / 72 | 82 / 69 (revive) |

13 fewer in every room. Shots, before and after (differences are only the shafts' sway and the embers' timing):
before-/after-flue-1-decree-and-spent.jpg, before-/after-smeltery-0-base.jpg, before-/after-hoard-0-base.jpg.
`MODE=flue|smeltery|hoard|vents|revive node docs/art/room-life-draws/shots.cjs dist <out>`.
