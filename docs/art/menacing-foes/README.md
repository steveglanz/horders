# Menacing Kiln foes, drawn by hand (25 Nov)

Steve asked for foes that look "more intentionally menacing and creature like". AI-made 3D models are waiting on a Meshy API key. Until it arrives, the three most common Kiln foes are redrawn by hand in `client/textures.ts`. Each keeps its sprite size, palette, eye colour, facing and 4-frame walk, so hit boxes, outlines and the 2D fallback don't change.

- **Hollow Warden** (`husk`): was a round stone blob with a small head. Now it's a hunched brute: a jagged spined back, a wedge head thrust forward with a heavy brow, slit eyes, a gaping jaw of fangs, stone ribs, and long arms ending in hooked claws.
- **Ashling**: was a round imp. Now it has a hunched back, swept-back horns, a fanged grin, slanted eyes, and a long clawed arm reaching ahead.
- **Cinderhound**: was a plain dog. Now its head is low and its jaws are open on its fangs, its ears are pinned back, and a ridge of glowing cinder hackles runs along its spine.

There are no new meshes or textures, so the draw cost doesn't change.

## Shots

- `sheet-before-after.png`: the sprite sheets, before (left) and after (right). The Slagling, a raid foe, is unchanged.
- `before-fight.png` / `after-fight.png`: two Hollow Wardens in 3D at 320x568.
- `warden-fight-zoom.png`: the Wardens at 2x, before (left) and after (right).
- `before-warpack.png` / `after-warpack.png`: a Warden and its Cinderhounds.

To re-run: `node shots.cjs <dist> <outDir> [route]` (the route defaults to `wardens`; `warpack` gives the Warden and hounds).
