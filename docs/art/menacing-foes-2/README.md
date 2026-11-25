# Menacing foes, part 2: Glarewell, Coldmarrow and Wrackline trash (25 Nov)

This continues docs/art/menacing-foes (#801) and menacing-spitter (#804). The foes are drawn by hand in client/textures.ts until the Meshy key for AI 3D models arrives. These three were the friendliest-looking foes outside the Kiln:

- **Shade** (Glarewell): a smile and round eyes, changed to slanted eyes, a torn maw of needle teeth, and clawed wisps reaching forward.
- **Snuffer** (Coldmarrow): slanted eyes over its pulling mouth ring, which now has needle teeth.
- **Conchblower** (Wrackline): a round cartoon eye, changed to a cold yellow slit eye under a hard brow, a wide mouth of needle teeth, and a taller, sharper crest.

The size, palette, frames and facing are the same, so hit boxes, outlines and the 2D fallback are unchanged. No new meshes.

- `sheet-before-after.png`: the sprite sheets, before on top and after below. Made with `KEYS=shade,snuffer,conchblower node tools/artsheet.cjs <out.png>`.
- `after-zoom.png`: one frame of each, after, at 4x.
