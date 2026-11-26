# Menacing bosses, part 1: Cinder Colossus, Ondrel, Oskel and Hessa (26 Nov)

The trash redraws (docs/art/menacing-foes to menacing-foes-5) are done, so this starts on the bosses. A 2x contact sheet of every boss sprite was reviewed and these four read the least menacing: two blocky robots, a foreman with a friendly box helmet, and a calm robed lady. All four are drawn by hand in client/textures.ts (no paid AI tool before 1.0). Two small helpers were added there: `spikes()` (shaded horns and spikes) and `fangRow()` (a row of fangs pointing up or down).

- **Cinder Colossus** (Smeltery world boss sheet): the tiny box head is now a brutish horned head with a slanted furnace slit glaring down under a heavy brow and a slag-lit underbite of cinder fangs. Jagged spikes jut from both boulder shoulders and the dragging knuckles.
- **Ondrel** (Hammerdeep): the squat round helm is now a horned war-helm with a jutting brow, a V-shaped visor with slit eyes, and a jaw grille of iron fangs with slag glowing behind it. Spikes run along both pauldrons and the slag fist has claws. A crest of three iron blades replaces the thin ridges.
- **Oskel** (Pressworks): the box helmet now has two bent horn-pipes, a brow plate cut into an angry V over the amber visor (now a scowl, not a straight line), and a jaw of iron teeth. A spiked collar plate sits over the press shoulder. The pressure gauge stays because his fight reads it.
- **Hessa** (Wrackline): the calm pale face is now a drowned one: gaunt and grey-green, cold surf-white slit eyes in dark sunken sockets, a gaping mouth of needle teeth, wet kelp over the brow, and a taller crown of jagged shells. Both hands have hooked claws and grasping tendrils trail from her hem into the pool.

Size, palette, eye colour, 4 frames, facing and the boss tells (hammer, die, gauge, anchor-staff) are unchanged. Only canvas textures changed, so there are no new meshes and the fight shot measures 79 draw calls before and after (bar 96).

- `sheet-before-after.png`: before on top, after below, at 3x. Re-make one half with `ZOOM=3 KEYS=colossus,ondrel,oskel,hessa node tools/artsheet.cjs <out.png>` after `npm run build`.
- `fight-before-after.png`: the four bosses spawned round a Bulwark in a Foundry room, 3D at 320x568, before on the left, after on the right. Re-make it with `node docs/art/menacing-bosses/shots.cjs dist <outDir> foundry <tag>`; it prints the draw calls, and `KINDS=a,b` picks other kinds. (Hammerdeep times out on a solo restart, so the shot uses the Foundry.)

Next boss candidates by the same review: Maelra (round hood), Slag Crone (round bug head), Lensmother and the Furnace Regent; Kiln Mother, Vorhulm, Ysmeret and Nhevra already read as menacing.
