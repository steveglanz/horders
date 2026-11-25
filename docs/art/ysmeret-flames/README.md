# The staged Ysmeret's two flames (25 Nov)

Design's Ysmeret v2 (ysmeret-v2.md, engineering #755, behind ?ysmeretv2=1). At 50% she splits into two flames that
share one health. The rule is "Keep a hero on each flame": a flame with no hero within YSMERETV2.flareR (150) for
flareAfter (3 s) flares and hits every hero.

- **Each flame's ring.** A ring of the flare reach is centred on the flame itself, because that is where the sim
  measures (flamesClock, `dist2(q, f)`). A flame stays within 40 of where it landed, so the ring barely moves.
  - **Covered:** a calm gold ring, the "stand here" colour her vents use.
  - **Left alone:** the ring turns red, broken and turning. Fire spreads out from the flame and reaches the ring as
    ysAway runs to the flare (away / flareAfter). The beat gets faster as it nears.
- **The flare** (event `ysFlare`): a red blast, a shockwave ring, a shake and "Flare!" over the flame.
- **Off screen:** a lone flame gets the gold edge arrow that an empty vent gets. In 3D that arrow is now drawn on the
  overlay too, so empty vents get it in 3D as well.
- **One health bar.** Both flames already show the one shared health (`ysPool`). Bosses get no bar over their heads,
  so the boss frame is the only bar. In stage 2 it says "Two flames · one health".

The rings are drawn on the 2D main graphics (depth 2), so the floor bridge lays them on the 3D floor at no extra draw
call. Cost (portrait 320x568, `hd2d.stats()`), before / after: split 80/80, lone flame 80/80, covered 76/76.
In landscape it is 77-85.

Shots: before-3d.jpg; after-3d.jpg (split, alone at half, about to flare, the flare, covered); after-3d-landscape.jpg;
after-2d.jpg. `node docs/art/ysmeret-flames/shots.cjs dist <out>` (env NO3D=1, LAND=1).
