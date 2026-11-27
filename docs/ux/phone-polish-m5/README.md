# Phone polish, M5 (27 Nov 2026)

Roadmap M5: every screen at 320x568 and 568x320, and the Downstroke banner (QA's open item: "The Downstroke banner sits
mid-screen over the floor on phones"). All shots are 3D, deviceScaleFactor 2, before = main at 31f5c16, after = this branch.

## What was checked
`node tools/uxaudit.cjs <dir> p320 l568` on main: hub, Hero and Group tabs, delve setup, Settings, Bags, the in-run HUD,
the talent draft, pause, a boss fight and the end screen. No page errors; the only control under 44 px is the Halls "Map"
button (54x34), which only shows outside fights. Three problems turned up, plus the Downstroke item.

Positions below are CSS px from `tools/introbannershots.cjs` (the hero is placed with `hd2d.project`).

| Problem | Before | After |
|---|---|---|
| Downstroke warning, Pressworks with party, 320x568 | slim line at y 345 to 375, over the floor, saying what the chip under the top row already says | phones skip that warning line; the chip ("Downstroke: one un-Pressed hero under it!", or "you are Pressed, stay out!") stays up while the plate is down. Wider screens keep the warning |
| Fight intro card, solo, 320x568 | Kiln Mother card y 164 to 293 (name on two lines at 22px), hero at y 304 | 18px title on screens up to 340 px wide: card y 164 to 262 |
| Fight intro card with party frames, 320x568 | card anchored above the action bar, y 293 to 378, hero at y 309 | card under the top row, y 66 to 146, over the boss frame and route chip (which repeat its name; the chip hides while it shows); party frames (from y 154) stay clear |
| Fight intro card, 568x320 | centred under the top row, x 153 to 415, y 70 to 185, hero at (283, 186) | top-right corner, x 350 to 554, above the action bar (y 218); the middle and the party frames stay clear. The one-line warnings keep their centred place |
| Pause ability names, 320x568 | "Rim Sm...", "Shield T...", "Flame ...", "Combu..." | names wrap to two lines, like the action bar |

The hero is not at the exact middle of a phone screen in 3D: about y 310 of 568 in portrait and y 185 of 320 in landscape.

## Shots
- `downstroke-p320-before.png`, `downstroke-p320-after.png`
- `solo-boss-p320-*.png`, `party-intro-p320-*.png`, `solo-boss-l568-*.png`, `party-intro-l568-*.png`
- `pause-p320-*.png`

## Not changed
- The landscape end screen leaves its right column empty when a run drops no loot (cosmetic, noted in the mobile brief).
- Other warning lines with party frames on a portrait phone (Stamp!, Twin Vents...) keep their place above the action bar
  (#750): they don't have a chip that repeats them, and they sit below the hero.
- Still open in M5: the automatic 2D fallback on a device without WebGL at both sizes.
