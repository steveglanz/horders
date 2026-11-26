# Ability-option casts (1.0 M4, 26 Nov 2026)

The ten ability options from PRs #836-#840 (Wide Cut, Quicken, Clout, Gather, Sunlance, Canopy, Ember Dart,
White Heat, Slag Spray, Slag Mortar) had placeholder cast effects. In 3D most of them showed nothing but their name,
because their rings, flashes and sparks live on the 2D effects layer, which the floor bridge never carries into the
3D view (only floor graphics, depth under 2.3, reach it).

## What changed
- Each option now draws its main cast on the floor graphics (`GameScene.optionShape`, new `Shape` kinds), so the
  same effect shows in 3D and 2D. The 2D sparks and flashes stay as extras.
  - **Wide Cut**: a violet-white blade crescent sweeps one full turn round the hero.
  - **Quicken**: gold chevrons race ahead, and gold speed streaks trail the hero while the haste lasts.
  - **Clout**: gold cracks split the floor under the foe, with a ring out to the splash (90).
  - **Gather**: a gold ring closes in from the reach (260) onto the Bulwark, chevrons pointing in.
  - **Sunlance**: a pale gold lance from the Lumen to the foe and a four-point star where it lands.
  - **Canopy**: a pale blue ring and star on the cast; the dome now has six turning ribs and an inner ring, so it
    never reads as Sanctuary.
  - **Ember Dart**: an orange dart streak and a small fiery star on the foe.
  - **White Heat**: a white-hot band bursts out to the reach (200), flame tongues on its front.
  - **Slag Spray**: the orange cone now throws gobbets of slag (dark crust, hot core).
  - **Slag Mortar**: a smoke arc from the gunner over onto the burst, with cracks out to the blast.
- Colour rule: no option paints the floor red. Duskblade casts use violet-white (Wide Cut's floor ring was pink-red),
  Bulwark and Lumen gold, Lumen's Canopy pale blue, Emberwright and Slagbinder fire orange.
- Option cast events now name the caster (`hero`, World.acting), so a bot's or ally's option is drawn as its own
  class, from where it stands. Before, every option was drawn as the screen's own class.
- Four icons redrawn (`ALT_GLYPH` in client/icons.ts), see `icons-before-after.png`:
  - Wide Cut: two blade crescents (the arrowed ring read as a reload button).
  - Sunlance: a four-point star at the lance tip (the old tip blurred at bar size).
  - White Heat: a flame inside a jagged burst (the rayed sun read as a brightness setting).
  - Slag Spray: a fan of three streaks with a drop on each (the old dots drew as rings with dots).
  The other six icons already read well and are unchanged.

## Draw cost
The shapes draw on the existing floor graphics, so they add no 3D draw calls. In the Kiln shots the frame sat at
78-82 calls (cost bar 96) before and after; the 82s are from a foe's slam telegraph in the same frame.

## Shots
- `3d-before-after.jpg` and `2d-before-after.jpg`: Wide Cut, Quicken, Clout, Gather, Sunlance at 320x568, caught about
  90 ms of game time after the cast. Top row is main, bottom row is this branch.
- `3d-after-rest.jpg`: Canopy, Ember Dart, White Heat, Slag Spray, Slag Mortar after the change, from an earlier run
  without slow motion. Each one is caught at a different point in its cast.
- `icons-before-after.png`: the four redrawn icons.

Remake with `npm run build && node docs/art/option-casts/shots.cjs dist out 3d [ids]` (or `2d`). The script runs each
cast in slow motion (the sim and the effects at a fifth), because software GL in the sandbox draws a frame every
100 ms or more, which is longer than half of a cast's life. Known issue: in slow motion the sandbox browser crashes
on the sixth cast (Canopy) every time, so pass ids five at a time. Even then the batch starting at Canopy crashed
here, so its fair before/after shots are still to do.
