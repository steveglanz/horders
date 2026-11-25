# Heroes and foes at their drawn shape in 3D (25 Nov)

Steve: "Sprites or designs are still a little funny looking, sometimes looking a little stretched."

**Cause.** The 3D view draws heroes and foes as flat sprites that stood straight up, and the camera looks down at
49 degrees (camDir 0, 15.5, 13.6). A card standing up, seen from that angle, shows at cos 49 = 0.66 of its height:
every hero and foe was two thirds as tall as it was drawn, so it read squat and wide. On top of that, hits and lunges
squashed them further (a foe hit while lunging was 24% wider and 20% shorter).

**Fix (client/hd2d/renderer.ts).**
- Hero, foe and Regent sprites lean back by the camera's angle (SPRITE_TILT), so they face it and show at their drawn
  proportions. Their normals are set so they light as they did standing (the lean would otherwise turn them up into the
  lights). The outline, your hero's shadow twin and foe head points (for bars and names) follow the lean.
- Squash and stretch kept small: a foe's hit 10% -> 4%, its lunge 14%/10% -> 6%/5%, its cast rear 6-10% -> 3-5%; a
  hero's punch 8%/5% -> 4%/3% and idle breath 3% -> 1.5%.
- Marks over heroes refit to the taller sprite: allies' names sit over the head, the revive "+" above them, and the
  Cooling Shell and Ember Ward ovals cover the body (GameScene drawLabels3d).
- 3D bosses (Ondrel and others built as models) are unchanged. 2D is unchanged.

Cost: unchanged (72/72, 78/78, 69/69, 74/74, 78/78 in the shots below).

Shots: before-3d.jpg / after-3d.jpg (the Bulwark and a Lumen; the Brood Ashwall; a downed ally calling for a revive),
before-3d-landscape.jpg / after-3d-landscape.jpg, hero-close.jpg (the Bulwark before and after, close up).
`MODE=classes|revive node docs/art/sprite-lean/shots.cjs dist <out>` (LAND=1 for landscape).
