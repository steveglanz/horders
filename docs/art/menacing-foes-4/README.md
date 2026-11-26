# Menacing foes, part 4: Slagling, Glass Warden, Ember Twins and Sluice Crawler (26 Nov)

This continues docs/art/menacing-foes (#801), menacing-spitter (#804), menacing-foes-2 (#818) and menacing-foes-3 (#819). All four are drawn by hand in client/textures.ts (no paid AI tools before 1.0).

- **Slagling** (raids): the round smiling blob is now a hunched slag beast. Its crust splits into a ridge of spikes, its front is a wide molten maw full of black teeth, it has a clawed forefoot, and slit eyes sit under a heavy brow.
- **Glass Warden** (Foundry): the friendly round-headed golem is now hunched and bristling. Broken shards jut from its back and shoulders, the head is a low wedge with slanted eye slits and shard tusks, the back arm ends in a sharp shard, the shield edge is a saw of shards, and the feet are jagged.
- **Ember Twins** (Foundry, both colours): the round mask with round eyes is now a horned iron skull. Long horns curl up and out, the eyes are slanted burning slits in deep sockets, and the mouth is a jagged row of fangs with the flame showing through. The flames are sharper and sweep back like a mane.
- **Sluice Crawler** (Foundry): the brass dome on stilts is now a low crab with a saw-tooth ridge of spikes, legs splayed and bent at the knee, a bigger serrated claw that snaps open and shut, mandibles, slitted eyes on stalks and a narrow tank window.

The size, palette, eye colour, 4 frames and facing are the same. Only canvas textures changed, so there are no new meshes: the fight shot counts 88 draw calls both before and after (bar 96).

- `sheet-before-after.png`: before on top, after below, at 3x. Re-make one half with `ZOOM=3 KEYS=slagling,glassWarden,emberTwin,emberTwinB,sluiceCrawler node tools/artsheet.cjs <out.png>` (ZOOM is new in this PR).
- `fight-before-after.png`: a Foundry fight in 3D at 320x568, before on the left, after on the right. Re-make it with `node docs/art/menacing-foes-4/shots.cjs dist <outDir> foundry <tag>` after `npm run build`; it prints the draw calls.
