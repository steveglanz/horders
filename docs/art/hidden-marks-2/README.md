# Hidden in 3D, part 2: the Flue, the Smeltery, the Hoard (25 Nov)

Items 4-6 of the sweep in docs/art/oskel-3d (#762), in design's order. Each was drawn on overFx (or at depth 9.4),
which the 3D view covers. 2D is unchanged: rings that sit over a boss's body in 2D stay on overFx there, and in 3D
they draw on the main graphics, where the floor bridge lays them on the floor (`const o = this.bridge ? g : this.overFx`).

- **The Flue:** the Decree holder's seal with its countdown ring (gold, then red and beating in the last 3 s), and the
  Spent hero's cold seal with its grey arc, on the 3D overlay (drawLabels3d). They sit beside the hero, like the
  Pressed and Sundered marks, so they don't fight the 3D crown over the holder.
- **The Smeltery:** the Wheel's circling chevrons and closing ring, and Meltdown's closing ring, on the 3D floor.
- **The Hoard:**
  - Coal Gorge's closing ring, the Craw's four gold marks and its swallow timer, and the class-colour ring on a
    Swallowed hero are on the 3D floor.
  - A Swallowed hero's 3D sprite is hidden while they are inside Vorhulm. 2D fades them to 0.18. This saves the
    sprite's 3 draw calls.
  - The party-frame pointer to the Craw stays 2D only. The 3D view's own red edge marks point at an off-screen Craw.

Cost (320x568, `hd2d.stats()`), before / after:

| Moment | Before | After |
|---|---|---|
| Decree and Spent | 102 | 102 |
| Wheel | 89 | 89 |
| Meltdown | 89 | 89 |
| Coal Gorge | 84 | 84 |
| Craw with a hero swallowed | 87 | 84 |

The Flue's room is already over the 96 bar before this: 100 with no mechanic showing, at seed 3. That needs its own
look.

Shots, in the same order (Decree and Spent, the Decree in its last 3 s, Wheel, Meltdown, Coal Gorge, the Craw with a
hero swallowed): before-3d.jpg, after-3d.jpg, after-2d.jpg.
`MODE=flue|smeltery|hoard node docs/art/hidden-marks-2/shots.cjs dist <out>` (env NO3D=1, LAND=1).
