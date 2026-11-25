# Phone pass: the Hammerdeep on the Halls map, and Ondrel v2 (25 Nov)

Design asked for a check of our first group map at 320 px with a 2-4 hero party (`?hallsbeta=1`), plus the staged Ondrel
(`?ondrelv2=1`). Shots come from `tools/hammerhallsshots.cjs`: a Bulwark with Slagbinder and Lumen bots, 3D look,
SwiftShader. Run it with `npm run build && node tools/hammerhallsshots.cjs <outDir> [p320|l568] [halls|ondrel] [v2] [seed]`.

| Check | Before | Fix |
| --- | --- | --- |
| Party in a tight room | The rings read (green, one per hero), but the 3D allies' names printed on top of each other ("Slagbinder" over "Lumen", neither readable). `before-p320-names-stacked.png` | The 3D renderer lifts a name that would land on another, as 2D's `unstackLabels` does. `after-p320-fight-sealed.png` |
| Outside a sealed room | Red bars and a grey arrow. Nothing said a hero can walk in (grates are one-way since #731). `before-p320-outside-sealed.png` | In co-op, a green "Walk in" tag stands just inside the nearest grate; off screen the arrow and tag turn green. Solo keeps grey "Sealed". `after-p320-walk-in.png` |
| Opening line | Every Halls dungeon opened as "The Kiln Depths". | It uses the dungeon's own name ("The Hammerdeep"); the map's label too. |
| Corner map | Reads at both sizes. Phones hide the Map button in fights (by design). `after-p320-map.png`, `after-l568-map.png` | Follow-up: the opened map fits beside or below the party frames, never over them (design: party frames win). `after-p320-map-clear-of-party.png`, `after-l568-map-clear-of-party.png` |
| Ondrel's tank swap | Sundered (the cracked red ring) went through the floor bridge at a third of its size: not visible. `before-p320-sundered.png` | Drawn on the 3D overlay beside the hero at its 2D size. `after-l568-sundered.png`, `after-p320-sundered-slag.png` |
| Ondrel v2 slag | Reads: dark red patches with a red rim. `after-p320-sundered-slag.png` | No change. |
| Stage 3 bursts | The big banner sat over the burst circles and the hero for the whole 2.5 s. `before-p320-stage3-banner.png` | A slim warning line, as cast warnings are. `after-p320-stage3-warn.png` |
