# Glarewell Halls on phones (H3b, 25 Nov)

Phone pass on the Glarewell's Halls map (`?halls=1&hallsbeta=1`, 3D), at 320×568 and 568×320.
Shot with `node tools/glarehallsshots.cjs <out> [p320|l568] [seed] [round|ring|cross|hall|twin]`.

| Shot | What it shows |
| --- | --- |
| `*-1-room-glare-warn` | A Lensbearer's Glare starting in a round room: pillars, shadow wedges, the cast bar "Glare · tap Quench!" |
| `*-2-room-glare-lands` | The flash as it lands, now a screen-wide wash in 3D |
| `*-3-in-shadow-warn` | The "Glare!" banner, with the hero standing in a pillar's shadow |
| `p320-cross-3-in-shadow-warn` | A Cross (colonnade) room, where the room's stone plinths are the cover |
| `l568-ring-1-room-glare-warn` | A Ring room: the lens sits in the middle of the island |

## Fixed here

- In 3D the Glare flash (and the boss flash) lit a hard-edged pale square over the void and corridors round the room,
  because world graphics are painted onto the floor's square canvas. In 3D the flash is now a screen-wide wash
  (`#flashFx`). 2D is unchanged.

## Checked, fine

- The "Glare!" banner and its line fit at both sizes. So does the cast bar in the target frame.
- Pillars and the hero's green ring read clearly. The wedges show as dark bands with pale blue edges in round and Ring rooms.

## Reported, not changed

- The banner sits over the upper pillars for its 3.2 s, which covers the whole 2.6 s warning.
- In a Ring room the island is the coal hearth (glowing orange, "glow means lava"). The lens glow is under it, so you can't see the light.
- In a Cross room the wedges are faint next to the big plinths. They also run on past the room's wall, where the light is blocked anyway.
