# Phone pass: the staged Oskel and the Kiln's denser packs (25 Nov)

Shots come from `tools/presshallsshots.cjs <outDir> [p320|l568] oskel v2` (Oskel v2, `?oskelv2=1`, with a Bulwark,
Slagbinder and Lumen bots) and `tools/kilntrashshots.cjs <outDir> [p320|l568] [cls]` (a solo Kiln on the Halls map).
All shots are in 3D at 320×568 and 568×320.

## Oskel v2
- The belt's streaks, the red crush line on the rim, and the flip warning's white arrows all read. `p320-flip-warning.png`
- **Fixed:** the "Stage 2: The belt" and "Stage 3: Full speed" calls were big banners over the floor, at the moment the belt starts carrying heroes toward the crush line. Both are now slim warning lines, the same as Ondrel's stage 3 and Ysmeret's stage 2. `before-p320-stage2-banner.png` → `after-p320-stage2-warn.png`
- **Fixed:** in landscape, a Pressed healer's party row showed "HEALER Pressed" with no name, because the role chip and the Pressed tag squeezed the name out. While a hero is Pressed (20 s), the role chip now gives way. `before-l568-healer-pressed-row.png`. In the after shot a Slagbinder is Pressed, not the healer: `after-l568-pressed-row.png`. The healer case is the CSS rule `.pf.pressed .pfr { display: none; }`.

## Kiln packs (for visuals)
On the Kiln's red-brown floor, the small dark foes (here the Ashbucks) and their thin red outlines have little
contrast at 320 px. Red is the "bad" colour, but it's close to the floor's own tone. `p320-kiln-ashbucks.png`. This is
not changed here, since foe colour and room light belong to visuals.
