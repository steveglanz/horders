# Menacing foes, part 5: Lensbearer, Brandkeeper, Dimhorn and Shoal Lurker (26 Nov)

This continues docs/art/menacing-foes (#801), menacing-spitter (#804), menacing-foes-2 (#818), menacing-foes-3 (#819) and menacing-foes-4 (#845). All four are drawn by hand in client/textures.ts (no paid AI tools before 1.0).

- **Lensbearer** (Glarewell): the tidy hooded robe is now a hunched zealot. The cowl comes to a long point and hangs forward, slit eyes and a row of fangs glint in the dark opening, a bony spine presses through the back, the hem is torn into ragged points, three brass thorns curl round the lens, and a bony hand hooks its talons round the staff.
- **Brandkeeper** (Glarewell): the round ball head is now a tall mask with a pointed chin, two horns sweeping back, slanted burning slits and a slot of fangs. The mantle is a collar of spikes, both hands end in talons (the raised one clutches the spark), and the hem is torn.
- **Dimhorn** (Coldmarrow): the plain bone mask with pin eyes is now a horned skull with angry slit eyes in dark sockets and a jutting jaw of needle teeth. Bone spines stick out of the hunched back and the long fingers are hooked talons.
- **Shoal Lurker** (Wrackline): the friendly fish is now an eel-shark. Its snout is hooked over a gaping jaw full of teeth that opens and shuts with the swim, the dorsal fin is a row of spines, the tail is forked, and it has gill slits, old scars and a cold slit eye under a heavy brow.

The size, palette, eye colour, 4 frames and facing are the same. Only canvas textures changed, so there are no new meshes: the fight shot counts 80 draw calls both before and after (bar 96).

- `sheet-before-after.png`: before on top, after below, at 3x. Re-make one half with `ZOOM=3 KEYS=lensbearer,brandkeeper,dimhorn,shoalLurker node tools/artsheet.cjs <out.png>` after `npm run build`.
- `fight-before-after.png`: all four spawned round the hero in a Glarewell fight in 3D at 320x568, before on the left, after on the right. Re-make it with `node docs/art/menacing-foes-5/shots.cjs dist <outDir> glarewell <tag>` after `npm run build`; it prints the draw calls. `KINDS=a,b,c` changes which foes it spawns.
