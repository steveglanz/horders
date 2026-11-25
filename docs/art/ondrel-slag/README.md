# The staged Ondrel's burning slag (25 Nov)

Design's spec: /mnt/project-files/horders/design/bosses/ondrel-v2.md (engineering #730, behind `?ondrelv2=1`).

## Stage 2: burning slag
Each patch (World.slagPatches, radius ONDRELV2.r = 80) is a flat disc on the floor. It is a dark cooled crust
broken into plates, with molten orange seams glowing between them and a red rim that breathes slowly. It reads as
burning floor you can walk over but shouldn't stand in (red = bad). Nothing stands up, so it never looks like a wall.

## Stage 3: the last heat
While a patch glows (glow counts down from 2.5 s), its seams widen and run white-hot and the rim beats faster. Engineering's
circle telegraph (radius 110) draws over it. When it bursts, a red-orange flash ring spreads out to the burst radius.

## Where
- 3D: client/hd2d/ondrelslag3d.ts. All patches are one InstancedMesh with a small shader (cellular plates). The bursts
  are a second InstancedMesh, which draws only while a burst shows. It sits after the floor bridge and before the
  telegraphs, so the burst circle draws over its patch. polygonOffset keeps the floor tiles from poking through.
- 2D fallback: GameScene.ondrelSlagDraw, skipped under the floor bridge so 3D doesn't draw it twice. Crust fill, a
  jagged ring and six spokes of molten seams fixed per patch, and a red rim with a dark under-stroke.
- SIM.ondrelSlagR / ondrelBurstR / ondrelGlow are copied into client/hd2d/simconsts.ts. tests/hd2dconsts.test.ts
  checks them against ONDRELV2.

## Cost (hd2d.stats(), 320x568, same moments, Bulwark solo t5)
| | Before (#730's 2D drawing on the bridge) | After |
|---|---|---|
| Stage 2, three patches | 76 draws | 77 |
| Stage 3, glowing | 82 | 83 |

At 568x320 it is 74 to 80 after. One draw for every patch, plus one while a burst shows.

Strips: strip-before-3d.jpg, strip-after-3d.jpg and strip-after-2d.jpg (stage 2, hero standing in one, stage 3 glow,
just before the burst). Shots: `node docs/art/ondrel-slag/shots.cjs dist <out>` (env NO3D=1 for 2D, LAND=1 for landscape).
