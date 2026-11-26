# Hidden in 3D, part 3: class marks (25 Nov)

Part 3 of the sweep in docs/art/oskel-3d (#762), in design's order. These marks show on every run for whoever plays
the class. 2D draws them on overFx, which the 3D view covers. They are now drawn on the 3D overlay (drawLabels3d), so
they cost no draw calls:

- **Cooling Shell** (Slagbinder): the pale dome over the hero, with its rim and highlight, fading out at the end.
- **Ember Mantle** (Emberwright option): the ring of flame tongues round the hero, fewer as the ward is spent.
- **Brittle** (Slagbinder): the pale fracture lines over the foe's drawn body, between its feet and the head the
  renderer reports (view.foeHead).

**Correction to the sweep:** the Slagbinder's plate (the molten band at the hero's feet) and the Cooling Shell's party
floor ring were never hidden. 2D draws them on the main graphics, and the floor bridge carries them. The second shot
shows the plate, the same before and after.

Cost (320x568, `hd2d.stats()`), before / after: 91 / 91 with the shell, the ward and three Brittle foes showing.

Shots (the shell on the Bulwark, the ward on the Lumen and three Brittle Hollow Wardens; then the plate):
before-3d.jpg, after-3d.jpg, after-2d.jpg (unchanged). `MODE=classes node docs/art/hidden-marks-3/shots.cjs dist <out>`.
