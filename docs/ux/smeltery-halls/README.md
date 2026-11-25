# Phone pass: the Smeltery raid on the Halls map (25 Nov)

Shots come from `tools/cruciblehallsshots.cjs <outDir> [p320|l568] smeltery`: the Smeltery on the Halls map
(`?hallsbeta=1`, H5c #806) with a Bulwark and three bot allies (Lumen, Emberwright, Duskblade), four heroes on screen.
All shots are in 3D at 320×568 and 568×320, seed 3.

## Fixed: the "Walk in" tag and arrow could sit behind the action bar
When the shut-out hero's way to the sealed room runs off the bottom of the screen, the arrow and its "Walk in" tag go
to the screen edge. On a phone the action bar holds that edge, so the tag sat behind Anvil Skin
(`before-p320-walkin-under-bar.png`). A first fix lifted them above the bar, but in landscape that put the tag on the
party in the middle of the screen (`before-l568-walkin-on-party.png`).
Now (`client/hallsview.ts` drawArrow) a point under the action bar counts as off screen, and the arrow and tag move to
the left of the bar when there is room there, else just above it. The tag on a visible grate also gives way if the
bar covers it. After: `p320-smeltery-4-room3-billet.png`, `l568-smeltery-4-room3-billet.png`. The usual case, the
tag on the grate, is unchanged (`*-3-outside-sealed.png`).

## Cost bar (96 draw calls)
The four heroes set at each room's centre and then by its far wall (where the theme props stand), outside a fight,
highest of 20 frames (`hd2d.stats().calls`):

| Room | Theme | Centre | Far wall |
|---|---|---|---|
| 0 | billet | 61 | 67 |
| 1 | tap | 72 | 75 |
| 2 | shrine | 52 | 52 |
| 3 | billet | 74 | 67 |
| 4 | tap | 72 | 75 |
| 5 | flywheel (boss door alcove) | 75 | 70 |

320×568; 568×320 is within 3 of these. Every room is at least 21 under the bar. Shots: `*-4-room1-tap.png`,
`*-4-room5-flywheel.png`.

## Checked, no change needed
- **Party frames:** all three ally rows fit with their names, in both sizes (`*-1-start.png`).
- **The map:** it opens below the party frames, never over them (`*-1b-map.png`).
- **Rings in the rooms:** the red rings read on the blue-grey stone (`*-2b-vent-flare.png`). The frames fade only while
  an elite is drawn under them (`p320-smeltery-2c-elite-under-frames.png`, from #807).
- **Walk in on the grate:** inside the grate, clear of the hero and the bars (`*-3-outside-sealed.png`).
