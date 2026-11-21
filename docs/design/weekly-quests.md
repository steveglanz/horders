# Weekly quests (P1, 21 Nov 2026)

**What it is.** Every week brings three quests, the same three for every player. Each one pays embers when it's done, and finishing all three gives the week's title. It gives players a reason to come back across the week, next to the daily bounty.

The code is in `sim/content/weekly.ts`. Progress is in `applyRun` in `sim/hero.ts`, and the hub and end screen in `client/hub.ts` and `client/ui.ts`.

## The rules
- **Same quests for everyone:** `weeklyFor(week, maxTier)` rolls them from the week alone (`weekOf` in omens.ts, the same clock as the Omens).
  - A hero keeps the quests rolled when they first play that week, so a tier-up mid-week doesn't swap them.
  - If the week's "Into the Deep" dungeon is still locked for a hero, they get the Kiln Depths instead.
  - The daily bounty opens at tier 2, so a tier-1 hero gets another quest in place of "Bounty Hunter".
- **Shared across classes:** the week is stored once on the hero profile (`weekly`, next to `bountyDay`). Every class's runs count toward it, and the embers go to the class that finished the quest.
- **Embers:** 40 + 8 × the hero's best tier for each quest, set when the week starts. At tier 8 that's 104 each, or 312 a week. For scale, the daily bounty pays 30 + 6 × its tier, so 72 a day at tier 7.
- **Title:** finishing all three adds the week's title to `hero.titles`. The titles rotate: the Unquenched, Emberhand, of the Deep Road, the Slagproof, Cinderstrider, Keeper of the Last Coal. Showing a title over the hero in co-op is P6 (engineering + visuals).

| Quest | Goal | Counts |
|---|---|---|
| Delver | Win 5 delves | Wins, not bounties |
| Quench Them All | Interrupt 30 casts | This hero's interrupts (`summary.interrupts`, kept per hero in co-op) |
| Name Hunter | Defeat 3 named elites | Named elites the party felled (C2) |
| Into the Deep | Win 2 delves in the week's dungeon | Wins there, not bounties |
| Cull the Deep | Defeat 600 foes | Kills |
| Bounty Hunter | Win 3 daily bounties | Bounty wins, replays included |
| Push the Wall | Win a delve at your best tier | A win at or above the best tier before the run |

**Names.** The quest names are plain phrases. On 21 Nov 2026 I web-searched the titles together with "game":
- "Ashwalkers" is an existing game, so that title was replaced with Cinderstrider.
- "Lantern-Bearer" sits close to a Shadow of Mordor achievement, so it was replaced with Keeper of the Last Coal.
- Neither replacement turned up in a search.

That is a search check, not a legal clearance.

## For other teams
- **Sim:**
  - `RunSummary` gains `week`, `interrupts` and `namedKills`.
  - `Player.interrupts` counts casts that hero interrupted.
  - `World.week` is undefined unless the client passes `week`, so tools and tests don't touch the quests.
- **Hub:**
  - In tab mode, a "Weekly n/3" chip opens a sheet with the three quests, their progress and the title.
  - In full mode, the same box sits under the bounty.
  - It appears after the first delve, like the potion chip.
- **End screen:** "Weekly quest done: <name> +<embers>" and "Title earned: <title>".
- **Visuals:** the box uses the existing `.box` styling. It's yours to restyle.

`tools/hashcheck.ts` is identical to main: the sim only counts things, and nothing it counts changes play.
