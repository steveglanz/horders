# Hidden in 3D, part 4: the last boss marks and the event marks (25 Nov)

The last part of the sweep in docs/art/oskel-3d (#762; parts #764, #765, #766). 2D draws these over the sprites
(overFx at depth 8.6, footGfx at 4.5, the cave-in rock image at 5.5), and the 3D view covers that, so they never
showed in 3D. None costs a draw call:

- **Grandmother Slag's Ladle Pour** (the Crucible): the ladle over the target's head, tipping as the cast fills,
  and its stream pouring onto them at the end. Drawn on the 3D overlay (drawLabels3d), as 2D draws it.
- **Ysmeret's Scatter** (the Ashvents): the red tie line between two heroes standing too close, and the embers
  circling each hero. Bellow Slam's double closing ring on the tank was hidden the same way and is fixed too. These
  are floor marks: in 3D they now go on the main graphics, which the floor bridge carries (2D keeps them on overFx).
  At the shot's spacing the tie line mostly sits under the two heroes.
- **The Homeward Hammer's landing ring** (Ondrel's Homeward version): on the floor graphics in 3D (the bridge). The
  3D hammer itself was already drawn by the renderer.
- **A Frost Warden in a coal's light** (Coldmarrow): the ember cracks over its body and the ring round it, on the
  overlay.
- **A Brood elite's egg sacs**: round its feet, on the overlay (each sac placed by projecting its floor point).
- **Arena events**: a Cave-in's falling rock (the same stone texture 2D uses) and the dust trickling down ahead of
  it; a Cold Snap's snow; the grit when the dungeon stirs. On the overlay.

- **The Kiln Mother's Kiln Draw**: her furnace mouth swelling with light, on the overlay over her drawn body. (The
  streaming embers and chevrons were already floor marks. The sweep said the 3D view had its own inhale: that is the
  Inhale boss version's, not Kiln Draw's.)

Cost (320x568, `hd2d.stats()`), before / after, the same in every shot: ladle 78/78, Kiln Draw 84/84, Scatter 69/69, Homeward 77/77,
Frost Warden 73/73, Brood 74/74, Cave-in 67/67, Cold Snap 67/67.

Shots: before-3d-bosses.jpg / after-3d-bosses.jpg (ladle pouring, Kiln Draw, Scatter, Homeward ring, Frost Warden);
before-3d-events.jpg / after-3d-events.jpg (Brood egg sacs, Cave-in rocks falling, Cold Snap snow); after-2d-ladle.jpg
(2D unchanged). `MODE=ladle|kiln|scatter|home|frost|brood|cave|snow node docs/art/hidden-marks-4/shots.cjs dist <out>`
(NO3D=1 for 2D).
