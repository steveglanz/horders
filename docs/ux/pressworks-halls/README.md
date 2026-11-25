# Phone pass: the Pressworks on the Halls map, and Oskel (25 Nov)

Design asked for the same checks as the Hammerdeep (`docs/ux/hammerdeep-halls/`) on the Pressworks Halls map
(`?hallsbeta=1`, #749, themes #747), plus whether a player can tell at a glance who is Pressed. Shots come from
`tools/presshallsshots.cjs` (Bulwark with Slagbinder and Lumen bots, 3D, SwiftShader):
`npm run build && node tools/presshallsshots.cjs <outDir> [p320|l568] [halls|oskel] [maponly] [seed]`.

| Check | Result |
| --- | --- |
| Party rings in a tight room | Read: one green ring per hero, and the names stay apart (#750). `p320-fight-sealed.png` |
| Outside a sealed room | The green "Walk in" tag sits just inside the grate (#750). `p320-walk-in.png` |
| Corner map | Reads, and stays clear of the party frames (#753). `p320-map.png` |
| Who is Pressed | **Before: nothing showed it in 3D.** The 2D mark, the plate's badge and the warning ring are drawn on overFx, which the 3D view covers. Only the HUD line said "one un-Pressed hero under it". `before-p320-pressed.png`, `before-p320-pressed-on-plate.png` |

## Fix
- A Pressed hero gets the 2D mark beside them: a small red plate with a press-down glyph, ringed by the time left. It is drawn on the 3D overlay (`drawLabels3d`).
- Their party row says "Pressed" in red. The Flue's "Spent" works the same way.
- The plate's badge is back: a green tick while someone who isn't Pressed stands on it, a red cross when a Pressed hero does, and a red "!" when nobody does. A Pressed hero on the plate also gets a blinking red ring at their feet.

`after-p320-pressed.png`, `after-p320-pressed-on-plate.png`, `after-l568-pressed-on-plate.png`

## Noted, not changed
Oskel's falling Rivets and the Stamp die are also overFx drawings, so they don't show in 3D. The Rivets' floor rings do
read, and Stamp has its warning line, so the dodges are still clear. These need art in the 3D view (visuals).
