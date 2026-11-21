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

## Rewards: looks only
| Level | Reward |
|---|---|
| 5, 15, 25 | A hero glow (3 per season) |
| 10, 20, 30 | A title: "Delver of", "Veteran of", "Paragon of" + the season's name |

**Season names rotate:** the Hollow Tide (the game's tagline), the Deep Bellows (the world boss "Lord of the Deep Bellows"), the Cold Hearth (Nhevra) and the Slag Moon (Grandmother Slag). They are all built from Horders' own names. I searched "The Long Ember" first and dropped it, because it sits close to the game Lost Ember and Sky's "Season of Two Embers".

**Wearing:** the season sheet's Wear row lists every earned title (weekly, collection and season) and every glow. `wearCosmetic(hero, 'title' | 'glow', id)` sets `hero.wear`. The worn title shows under the class name on the hero card. Glows are stored and chosen, but **they don't render in a run yet**. That is for visuals (a coloured ring or tint on the hero). Showing the title over the hero in co-op is P6 (engineering and visuals).

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
- More cosmetic kinds (P6), so levels between the six rewards give something too.
