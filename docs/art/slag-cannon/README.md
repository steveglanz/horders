# Slagbinder cannon look (1.0 M4)

The Slagbinder became a slow cannon gunner in #821, but still carried the old ladle, its shot was a plain orange line
in 2D only, and its E button still showed the Interpose icon. This gives it the look of the class it plays as.

- **Hero with a cannon, 3D and 2D.** The 3D pixel sprite (`client/hd2d/art.ts`) and the 2D sprite
  (`client/textures.ts`, `drawSlagbinder`) hold a squat iron cannon level at the hip: brass bands, a flared muzzle with
  molten slag glowing in the bore, and a heat seam on the breech. The 2D frames add a wisp of heat off the muzzle.
- **Recoil pose (3D).** The attack pose is the kick: the barrel jumps up and back, flame blows out of the muzzle and
  smoke puffs off the breech, and the hero rocks back from the shot instead of lunging in (`renderer.ts`).
- **Tracer.** 2D: a white-hot slug races down the whole line the shot pierces in its first 0.1 s and leaves a glowing
  trail that thins and fades, plus a grey smoke puff at the muzzle (`GameScene.ts`, shape kind `tracer`). 3D had no
  tracer at all before (the 2D effects layer is left out of the 3D floor bridge); it now draws one thin glowing bar at
  waist height down the shot line for 0.3 s (one extra draw call per Slagbinder, only while it shows). Its length is
  `SIM.cannonRange`, checked against `SLAG_KIT.cannonRange` in `tests/hd2dconsts.test.ts`.
- **Recoil (E) icon.** A cannon firing to the right, its kick throwing you back in an arc to the left
  (`ABILITY_GLYPH.slagbinder[1]`, replacing the old Interpose leap).

## Shots (320x568, iPhone-sized, Kiln, tier 2)
Each strip: before (shot, trail), then after (shot, trail).
- `3d-before-after.jpg`: the 3D view. Before: ladle, no tracer. After: cannon, recoil flash, tracer through the pack.
- `2d-before-after.jpg`: the 2D look (battery saver / fallback).
- `hero-close.png`: the 3D hero close up, before and after, at the shot and just after.
- `sheet.png`: the 2D sprite's four frames and the Recoil icon.
- `phone-3d-after.jpg`: the whole phone screen after, with the new Recoil button.

Re-make them: `npm run build && node docs/art/slag-cannon/shots.cjs dist <outDir> 3d` (and `2d`). In 3D the
script slows the sim to a tenth while it catches the shot, since software-GL screenshots are slow.
