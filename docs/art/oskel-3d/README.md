# Oskel's Rivets and Stamp in 3D, and the sweep for hidden marks (25 Nov)

Mobile's Pressworks phone pass (#759) found that Oskel's falling Rivets and the Stamp die were drawn on overFx. That
2D layer (depth 8.6) sits over the sprites, and the 3D view covers it: the floor bridge only carries depth under 2.3.
So in 3D the rings showed, but nothing fell into them.

## Fix
- **Rivets** (client/hd2d/oskel3d.ts): a brass domed rivet drops into the middle of each Rivets ring as its fuse
  runs, with 2D's ease, and lands as the ring goes off. It is twice the 2D size, because a true-size one read as a
  speck at the phone's 3D zoom. One InstancedMesh: 1 draw call while rivets fall.
- **Stamp**: a steel die with a yellow-and-black hazard band and a plunger rod drops onto the stamped hero (World.stampOn)
  as the cast runs. It lands on their head and rattles near the end. It is unlit, with its shading painted in,
  because it hangs right under the hero's own light, which washed a lit die out to white. 2 draw calls during the cast.
- The Stamp's closing red reticle moves from overFx to the main graphics, so the bridge puts it on the 3D floor. In
  2D it now draws under the sprites, like every other floor mark.
- Shadows under both were already floor marks, so they show in 3D through the bridge.

Cost (320x568, `hd2d.stats()`), before / after: no cast 84/84, rivets 90/91, Stamp 84/86. In landscape it is at most 92.

Shots: before-3d.jpg (rivets falling, Stamp falling, Stamp landing); after-3d.jpg (rivets falling and landing, Stamp
falling and landing); after-3d-landscape.jpg; after-2d.jpg. `node docs/art/oskel-3d/shots.cjs dist <out>` (env NO3D=1,
LAND=1).

## The sweep: boss and group marks still drawn only on hidden layers
Everything GameScene draws on overFx (8.6), footGfx (4.5) and homeLie (2.55) is hidden in 3D unless the 3D view
draws its own. Names, bars, numbers, "Stand here", "Reviving", Sundered and (with #759) Pressed are redrawn on the 3D
overlay (drawLabels3d). The renderer draws its own Decree scorch and crown, the Homeward Hammer, the Kiln Mother's
inhale, and (since #757) the empty-vent edge arrow. Still hidden in 3D (GameScene.ts):

| Where | What is hidden | Why it matters |
|---|---|---|
| Revive, all group content (`render`, G6) | the bobbing "+" over a downed hero, the rescuer's tether, the revive progress arc and its dot, and the grey struck-through cross when a boss allows no revive | the floor circle shows, but not who is calling for help, or that a revive is running |
| Ashvents vents, Ysmeret (`ventMark`) | the badge over each vent (green tick when covered, red "!" when empty), the gold covered ring and the red turning dashes on an empty vent | it is on for players; you can't see at a glance which vent is empty |
| Hammerdeep, Ondrel (`ondrelCast`) | Anvilfall's closing red reticle and the falling anvil (its growing shadow does show) | Ondrel v2 is now on by default |
| Ashvents, Ysmeret Scatter (`ysmeretCast`) | the red tie line between two heroes standing too close (the rings show) | it tells a stacked pair why their rings are red |
| The Flue, Regent (`flueMarks`) | the Decree seal over the holder and its countdown ring (gold, then red), and the cold Spent seal with its grey arc | the 3D crown has no timer, and nothing shows who is Spent |
| The Smeltery, Colossus (`smelteryDraw`) | the Wheel's circling chevrons and closing ring, and Meltdown's closing ring | the cast's timing |
| The Hoard, Vorhulm (`hoardDraw`, `hoardHeroes`) | Coal Gorge's closing blue ring, the Craw's gold marks and swallow timer, its gold edge arrow, and the ring on a Swallowed hero | who to free, and how long they have |
| The Crucible, Grandmother Slag (`slagCast`) | the ladle and its pouring stream | the cast's source |
| The Kiln, Kiln Draw (`kilnDrawTell`) | the furnace-mouth glow swelling (the 3D view has its own inhale) | minor |
| Homeward Hammer (`homeDraw`) | the faint ring where the thrown hammer will land (the 3D hammer shows) | minor |
| Coldmarrow (`coldDraw`) | ember cracks on a Frost Warden inside a coal's light | minor |

Class and event marks on the same layers (not boss mechanics): the Slagbinder's plate, Cooling Shell dome and Brittle
cracks (`slagDraw`), Ember Ward's flames (`altDraw`), the Brood's egg sacs (footGfx), falling rock and dust in arena
events (`waveDraw`, `arenaEventDraw`), and snow. The Pressworks plate badge and Pressed mark are fixed by #759.
