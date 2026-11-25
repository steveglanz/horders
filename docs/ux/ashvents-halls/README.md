# Phone pass: the Ashvents on the Halls map, and the staged Ysmeret (25 Nov)

Design asked for the Hammerdeep checks on the Ashvents Halls map (`?hallsbeta=1`, #740, themes #746), plus the staged
Ysmeret (`?ysmeretv2=1`, art #757). Shots come from `tools/ashhallsshots.cjs` (Bulwark with Slagbinder and Lumen bots,
3D, SwiftShader): `npm run build && node tools/ashhallsshots.cjs <outDir> [p320|l568] [halls|ysmeret] [v2|maponly] [seed]`.

| Check | Result |
| --- | --- |
| Party rings in a tight room | Read. `p320-fight-sealed.png` |
| Outside a sealed room | The green "Walk in" tag. `p320-walk-in.png` |
| Corner map | Reads, clear of the party frames. `p320-map.png` |
| Scatter Embers | Each hero's ring reads. `p320-scatter.png` |
| The two flame rings | Read: gold when a hero covers the flame, red and beating with the fire spreading when nobody does. `p320-lone-flame.png` |
| Shared boss bar | Reads "Two flames · one health" (with "Warded" from the omen) at both sizes. |
| "Flare!" | Shows over the flame, with the blast ring. `p320-flare.png` |

## Fixes
- **Stage 2 call:** the big "Stage 2: Twofold" banner covered the middle of the floor while a lone flame has 3 s before it flares. It is now a slim warning line ("A hero on each flame; the tank's flame still Bellows"), the same as Ondrel's stage 3. Before: `before-p320-stage2-banner.png`. After: `after-p320-stage2-warn.png`. In that shot the tool holds the line on screen, because SwiftShader's slow frames outlast its 3.2 s.
- **A lone flame under the party frames** (it sits at the room's edge) had no gold arrow, since it counted as on screen. Now the arrow stands just right of the frames and points at it. `after-l568-flame-arrow.png`
