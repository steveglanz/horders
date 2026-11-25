# Phone pass: the Flue raid on the Halls map (25 Nov)

Shots come from `tools/cruciblehallsshots.cjs <outDir> [p320|l568] flue`: the Flue on the Halls map (`?hallsbeta=1`,
H5d #809) with a Bulwark and three bot allies (Lumen, Emberwright, Duskblade), four heroes on screen. All shots are in
3D at 320×568 and 568×320, seed 3.

Nothing needed a change.

## Cost bar (96 draw calls)
The four heroes set at each room's centre and then by its far wall (where the theme props stand), outside a fight,
highest of 20 frames (`hd2d.stats().calls`):

| Room | Theme | 320×568 centre | far wall | 568×320 centre | far wall |
|---|---|---|---|---|---|
| 0 | sweep | 61 | 67 | 60 | 67 |
| 1 | firebox | 72 | 75 | 72 | 75 |
| 2 | shrine | 52 | 52 | 52 | 52 |
| 3 | sweep | 74 | 67 | 74 | 67 |
| 4 | firebox | 72 | 75 | 72 | 75 |
| 5 | damper (boss door alcove) | 75 | 70 | 74 | 67 |

Every room is at least 21 under the bar. These are the same numbers as the Smeltery's rooms (`docs/ux/smeltery-halls/`).
Seed 3 gives both raids the same room layout (the sealed room 1 has radius 534 at the same place in both runs), and
the themes in matching rooms cost the same. The Flue's arena measured 87 after #767; its Halls rooms measure lower. Shots: `*-4-room1-firebox.png`, `*-4-room5-damper.png`, `*-4-room0-sweep.png`.

## Checked, no change needed
- **Party frames:** all three ally rows fit with their names, in both sizes (`*-1-start.png`). They fade only while an
  elite is drawn under them (`p320-flue-2b-vent-flare.png` solid, `p320-flue-2c-elite-under-frames.png` faded).
- **The map:** it opens below the party frames, never over them (`*-1b-map.png`).
- **Rings in the rooms:** the red rings read on the amber brick (`*-2b-vent-flare.png`).
- **Walk in:** on the grate, clear of the hero and the bars (`*-3-outside-sealed.png`). Off the bottom of the screen,
  the tag and arrow sit left of the action bar (`*-4-room3-sweep.png`, from #811).
