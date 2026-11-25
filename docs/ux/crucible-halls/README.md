# Phone pass: the Crucible raid on the Halls map (25 Nov)

Shots come from `tools/cruciblehallsshots.cjs <outDir> [p320|l568]`: the Crucible on the Halls map (`?hallsbeta=1`,
H5a #787, room themes #788) with a Bulwark and three bot allies (Lumen, Emberwright, Duskblade), four heroes on screen.
All shots are in 3D at 320×568 and 568×320, seed 3.

Nothing needed a change. What I checked:

- **Party frames:** all three ally rows fit with their names, in portrait (`p320-crucible-1-start.png`) and in
  landscape with the HEALER chip (`l568-crucible-1-start.png`). In a fight the foe card sits above them and covers
  nothing (`*-2-fight-sealed.png`).
- **The map:** the raid's tall map opens below the party frames in portrait and in landscape,
  never over them (`*-1b-map.png`). In landscape it is narrow (about 146 px wide), but every room still reads.
- **Rings in the rooms:** a flaring vent's circle is a clear red ring on the rose floor, and the four heroes' green
  rings stay apart from it (`*-2b-vent-flare.png`).
- **Walk in:** with the hero set down outside the sealed ladle hall, the green "Walk in" tag sits inside the grate and
  covers neither the hero nor the bars (`*-3-outside-sealed.png`).
- **Ally names:** with four heroes bunched up, the 3D names are lifted apart and don't print on top of each other.
  They are very small at 320 px, but the party frames carry the names.

## For visuals
The Cinderhounds are small and dark, and their thin red outlines sit on a rose floor. They read, but with less
contrast than in the grey rooms, the same as the Kiln's red-brown floor noted in `docs/ux/oskel-v2-kiln-trash/`.
Nothing is changed here, since foe colour and room light belong to visuals.
