# Phone pass: the Hoard raid on the Halls map (25 Nov)

Shots come from `tools/cruciblehallsshots.cjs <outDir> [p320|l568] hoard`: the Hoard on the Halls map
(`?hallsbeta=1`, H5b #798) with a Bulwark and three bot allies (Lumen, Emberwright, Duskblade), four heroes on screen.
All shots are in 3D at 320×568 and 568×320, seed 3.

## Fixed: the party frames faded with nothing under them (3D, portrait)
On a portrait phone the party frames fade while a boss or elite stands under them (#331). That check placed foes with
the 2D camera, but the 3D camera is tilted, so a foe shows somewhere else on screen. In the Hoard's first room the
frames faded while the Hollow Wardens were drawn below them, in the open (`before-p320-hoard-2b-frames-faded.png`).
The check now asks the 3D view where the foe is drawn, and uses the 2D camera only when there is no 3D view
(`client/ui.ts` fadeParty, `client/GameScene.ts`).
- After, same moment: the frames stay solid (`p320-hoard-2b-vent-flare.png`).
- A Hollow Warden set down where 3D draws it under the frames: they fade (`p320-hoard-2c-elite-under-frames.png`).

## Checked, no change needed
- **Party frames:** all three ally rows fit with their names, in both sizes (`*-1-start.png`).
- **The map:** it opens below the party frames, never over them (`*-1b-map.png`).
- **Rings in the rooms:** the Wardens' red slam rings and a vent's red circle read on the coal-brown floor
  (`*-2b-vent-flare.png`).
- **Walk in:** the green tag sits inside the grate and covers neither the hero nor the bars (`*-3-outside-sealed.png`).
