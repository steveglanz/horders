# Season track (P2, 21 Nov 2026)

A 30-level track over a 6-week season, earned by playing, with cosmetic rewards only. Code is in `sim/content/season.ts` and `applySeason` in `sim/hero.ts`. Tests are in `tests/season.test.ts`.

## The clock
- **Seasons:** each lasts 6 weeks. Season 1 starts on week 2968, which is `weekOf(Date.UTC(2026, 10, 21))` and was checked with node. `seasonOf(week)` and `seasonWeeks(id)` give the bounds.
- **Pure sim:** like the weekly quests, the sim never reads the clock. The client passes `week` (already there for P1) and a new `day` (`dayOf`, from bounty.ts) in `WorldOptions`. Both reach `RunSummary`.
- **The track** is shared by every class (`HeroProfile.season`). It starts again when the season turns. Earned titles and glows are kept.

## Marks
| Source | Marks |
|---|---|
| A win (delve, key run or bounty) | 120 |
| A loss | 20 + 10 per fight cleared (up to 5) |
| The first win of each day | +200 |
| Each weekly quest finished | +150 |
| A win in the season's own dungeon (below) | +60 more |

500 marks a level, so 15,000 for all 30.

**Calibrated with `tools/economy.ts`**, the bot playing 10 days, `forge` policy:

| Play pattern | Marks over 10 days | A day | Days to level 30 |
|---|---|---|---|
| 3 delves and the bounty a day (offsets 0 to 3) | 6 050, 6 670, 6 350, 6 460 | about 640 | about 23 |
| 1 delve and the bounty a day (offsets 0 and 1) | 4 880, 5 010 | about 495 | about 30 |

From those daily rates (arithmetic, not simulated):
- A player who plays every day finishes in 3 to 4.5 weeks.
- One who plays 4 days a week with 3 delves finishes inside the 6 weeks.
- One who plays every other day with 1 delve reaches about level 20.

The first win of the day is the biggest single source on purpose: it is the reason to come back tomorrow.

## The season's dungeon (21 Nov 2026)
Each season theme names one dungeon that is **in season**. A win there (a delve, a key run or a bounty) pays **+60 marks** on top of the 120. A loss there pays nothing extra, so the bonus never rewards throwing runs. The point is variety: every six weeks the track pulls players toward a different dungeon, and group seasons pull them into parties.

| Season | Theme | In season | Why |
|---|---|---|---|
| 1 (from week 2968, Thu 19 Nov 2026) | the Hollow Tide | The Drowned Foundry | The rising water |
| 2 (from week 2974, Thu 31 Dec 2026) | the Deep Bellows | The Hammerdeep | The forge's bellows; the first group season, so a reason to queue as tank or healer |
| 3 (from week 2980, Thu 11 Feb 2027) | the Cold Hearth | The Coldmarrow | Nhevra's cold deep under the Kiln |
| 4 (from week 2986, Thu 25 Mar 2027) | the Slag Moon | The Glarewell | The sunken observatory that watches the sky |
| 5 (from week 2992, Thu 6 May 2027) | the Falling Press | The Pressworks | Oskel's Downstroke; the second group season, and taking turns needs a real party (no bots) |
| 6 (from week 2998, Thu 17 Jun 2027) | the Low Ebb | The Wrackline | Hessa of the Ebb and the drain; a solo season again |

Seasons 5 and 6 were added on 21 Nov 2026 so the rotation doesn't repeat Season 1 in May 2027. After Season 6 it wraps to the Hollow Tide (week 3004, Thu 29 Jul 2027). The pattern is solo, group, solo, solo, group, solo, so a group season comes round about every four months.

The weeks were checked with node (`new Date(w * 7 * 864e5)`): week numbers count from 1 Jan 1970, a Thursday, so every season turns on a Thursday (UTC). The Crucible is never in season, because it needs four heroes and a bonus there would only reward players who already have a raid group. No theme shares a dungeon (`tests/season.test.ts`).

**Pacing (arithmetic, not simulated):** a player who wins 3 delves a day, all in season, earns up to 180 more marks a day: about 820 instead of 640, so level 30 in about 18 days instead of 23. A player who never visits the season's dungeon is unchanged. Both stay inside the 3 to 6 week range above.

**Where it shows:** the season sheet has an "In season: The Hammerdeep, +60 marks a win." line under the marks rules, and the end screen's season note adds "(in season)" when the win paid it. Code: `SeasonDef.dungeon`, `SEASON.featured` and `runMarks(..., featured)` in `sim/content/season.ts`; `applySeason` in `sim/hero.ts` sets `RunRewards.seasonFeatured`. No new names, so nothing needed a WoW search.

## Rewards: looks only
| Level | Reward |
|---|---|
| 5, 15, 25 | A hero glow (3 per season) |
| 10, 20, 30 | A title: "Delver of", "Veteran of", "Paragon of" + the season's name |
| 8, 18, 28 | The season's trail, in three stages (added 21 Nov 2026, below) |

**Season names rotate:** the Hollow Tide (the game's tagline), the Deep Bellows (the world boss "Lord of the Deep Bellows"), the Cold Hearth (Nhevra) the Slag Moon (Grandmother Slag), the Falling Press (Oskel's Downstroke in the Pressworks) and the Low Ebb (Hessa of the Ebb). They are all built from Horders' own names. I searched "The Long Ember" first and dropped it, because it sits close to the game Lost Ember and Sky's "Season of Two Embers".

**Wearing:** the season sheet's Wear row lists every earned title (weekly, collection and season) and every glow. `wearCosmetic(hero, 'title' | 'glow', id)` sets `hero.wear`. The worn title shows under the class name on the hero card. Glows are stored and chosen, but **they don't render in a run yet**. That is for visuals (a coloured ring or tint on the hero). Showing the title over the hero in co-op is P6 (engineering and visuals).

## Season trails (21 Nov 2026)
The six rewards left gaps of five levels, which is two to three days of play for a daily player. Each season now also has a **trail**: motes left behind the hero while they move, in the season's colour. It comes in three stages at levels 8, 18 and 28, so the track pays 9 rewards: 5, 8, 10, 15, 18, 20, 25, 28 and 30. That fills three of the five-level gaps. The 10 to 15 and 20 to 25 gaps stay, because a fourth cosmetic kind would be filler.

| Season | Trail | Colour |
|---|---|---|
| the Hollow Tide | Salt Mist | #bfe9ff |
| the Deep Bellows | Bellows Sparks | #ffb04a |
| the Cold Hearth | Rime Dust | #e6f6ff |
| the Slag Moon | Slag Drips | #ffcf6e |
| the Falling Press | Oil Sheen | #b8f07a |
| the Low Ebb | Raft Splinters | #c8915a |

**Stages:** stage 1 is the name alone ("Bellows Sparks"), then "Bellows Sparks II" and "III". A hero keeps a trail at its best stage forever (`hero.trails[id]`). Trails arrived mid-season 1, so a hero already past level 8 or 18 gets the stage they passed on their next run. Wearing one (`wearCosmetic(hero, 'trail', id)`) always shows its best stage.

**Rendering:** visuals draws them in runs (#205), with a small glint beside each mote so the pale colours read. Engineering sends them in co-op looks (#206). The brief they worked from:
- **Stage 1:** a few small motes, about 3 a second while moving, each fading over 0.4 s.
- **Stage 2:** about twice as many, and they last longer.
- **Stage 3:** stage 2 plus a small burst of motes on each dash or blink.
- Nothing draws while the hero stands still, so a trail never hides a telegraph.
- Keep it under the hero's depth and dim during boss telegraphs if needed.

Co-op needs `trail` and its stage in the looks message, cleaned against `TRAILS` the way `cleanLooks` checks glows. That is engineering's part.

**Names:** each was searched alone on wowhead.com, warcraft.wiki.gg and wowpedia, and none has an exact match. "Tide Spray" was dropped first, because WoW has a "Tidal Spray" spell and a "Tidespray Linen" cloth. The four names were also checked against Azeroth Survivors' builds page, and none appears there.

## UI
- **Delve tab:** a "Season N" prep chip, after the first delve like the weekly quests. Desktop shows the full box.
- **The sheet:**
  - The title "Season 1: the Hollow Tide".
  - Level and marks, and the days left.
  - First-win status and how marks are earned.
  - The six rewards.
  - The Wear row.
- **End screen:** marks earned (first win flagged), a level up, and any reward.

`tools/seasonshots.cjs` screenshots it on desktop, iPhone 13 and a 320 px phone: no page errors and no horizontal scroll. The 320 px shot is `docs/design/shots/season-320.png`.

**Watch items:**
- Real play rates. If most players finish in under 3 weeks, raise `marksPerLevel`.
- More cosmetic kinds (P6), so levels between rewards give something too. Trails (above) fill three of the five gaps.
- How many wins land in the season's dungeon. If almost none do, the bonus is too small to pull players there; if nearly all do, the other dungeons go quiet for six weeks.

## Seasons 5 and 6 (21 Nov 2026)
| Season | Glow 1 (level 5) | Glow 2 (level 15) | Glow 3 (level 25) | Trail |
|---|---|---|---|---|
| 5, the Falling Press | Oil Green #7fd46a | Rivet Blue #4f7dff | Hot Stamp #ff4fd8 | Oil Sheen #b8f07a |
| 6, the Low Ebb | Wrack Olive #b5c24a | Drain Blue #2fa8d8 | Ebb Indigo #7a5cff | Raft Splinters #c8915a |

**Colours.** Seasons 1 to 4 already use the pale blues, the oranges and the golds, and some of their glows sit very close together (Frostbite and Rime Dust are 4 apart in CIE Lab ΔE, Slag Gold and Slag Drips 5). The new glows use the hues nobody has yet: green, a deep blue, magenta and olive. Every new glow is at least 22 ΔE from every other season's glow and trail, and at least 24 from the other glows of its own season. Oil Green and its trail are 16 apart, like Season 2's orange and its sparks (12). Raft Splinters is the closest to an older colour, Coal Glow at 19. Checked with a small CIE76 script (sRGB to Lab, D65).

**Names.** Searched on 21 Nov 2026 with "World of Warcraft", wowhead and wowsurvivors.com:
- "the Falling Press", "the Low Ebb", "Hot Stamp", "Oil Sheen", "Rivet Blue", "Oil Green", "Wrack Olive", "Drain Blue", "Ebb Indigo" and "Raft Splinters": no WoW or Azeroth Survivors matches.
- "Driftwood" was dropped as the Low Ebb's trail because it's a WoW quest name (wowpedia.fandom.com/wiki/Driftwood_(quest)) and a WoW place (Driftwood Shore). Raft Splinters took its place.
- Titles follow the existing pattern: "Delver of the Falling Press" and so on.

**For other teams.** Visuals: no season box art yet for Seasons 5 and 6 (`SEASON_ART` in client/seasonArt.ts). The hub falls back to the plain season box until it's added. Sound: `hubThemeFor` already wraps, so the Falling Press and the Low Ebb play the existing hub themes until they get their own. Season 5 doesn't start until 6 May 2027, so neither is urgent.
