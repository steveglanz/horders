# Economy pass: ember sources and sinks (P7, 21 Nov 2026)

`tools/economy.ts` plays a hero with the bot over 10 days.
- **Each day:** 3 Kiln delves that climb tiers like `tools/progression.ts`, plus the daily bounty from tier 2.
- **Weekly quests:** on the real week clock (P1).
- **Loot:** everything not worn is salvaged.
- **`POLICY`:** `forge` spends every ember at the Forge, on the lowest worn item first. `draught` also brews Rising Draught before every delve it can afford. `hoard` spends nothing.

Main is d794a57 (with P1), with seed offsets 0 to 3 for each policy. The forge figures use offsets 1 to 3, run before the potion change. That change can't affect them, because the forge policy never brews.

## Where embers come from (forge policy, 30 delves)
| Source | Embers over 10 days | Share |
|---|---|---|
| Salvage | 1 591 to 1 757 | about 65% |
| Daily bounty | 558 to 804 | about 25% |
| Weekly quests | 144 to 384 | about 10% |
| **Total per delve** | **82 to 97** | |

## Where they go
**Forge:** 2.7 to 3.1 upgrades per delve, and the hero ends each day with almost nothing left. Embers don't pile up, which meets that half of the target. The rate is about three times the "about 1 upgrade per run" target in balance.md.

I'm not changing the Forge here:
- Upgrade costs set the power curve of every reference hero (heroes-r2 came from `progression.ts` with the Forge on).
- The skills team is locking class balance (L7) against those heroes right now.
- A Forge change belongs after that lock, measured against fresh reference heroes.

**Rising Draught** was the roadmap's question. At a flat 30 embers, the `draught` policy brewed it before **26 to 29 of 30 delves**. At about 85 embers a delve it was never a real choice.

## The change: Rising Draught scales with the hero's best tier
`potionCost(id, maxTier)` in `sim/content/potions.ts` is now `cost + costPerTier × (maxTier − 1)`.
- Rising Draught costs 30 + 6 per tier: 30 at tier 1, 60 at tier 6, 90 at tier 11.
- Stillwater Tonic (10) and Kindling Brew (12) stay flat.

| `draught` policy, 30 delves | Before | After |
|---|---|---|
| Rising Draughts brewed | 26, 29, 29, 29 | 13, 16, 14, 12 |
| Forge upgrades per delve | 1.80 to 2.17 | 1.77 to 2.07 |
| Best tier reached | 12 to 13 | 12 to 13 |

A player who wants the Draught every delve now gives up most of their Forge budget. Brewing it about every other delve fits the income.

The hub's potion card shows the scaled price. Win rates in the balance tables don't move, because the bots there never brew potions.

**Watch items:**
- Forge rate after L7.
- Whether real players brew Kindling Brew every run now that it is the cheap choice.

## The Forge rate, revisited after L7 (21 Nov 2026)
The watch item said the Forge runs at about 3 upgrades a delve against a target of about 1. L7 is locked (#124), so I measured what that rate actually does before touching costs.

**Method.** `tools/economy.ts` on main 07ffce7, the Emberwright, 10 days, seed offsets 0 to 7 (8 runs per policy). `forge` spends everything at the Forge, `hoard` spends nothing. `DETAIL=1` (new) prints a line a day: upgrades, the Forge cap, and how far worn gear sits below it.

| 8 runs of 30 delves | `forge` | `hoard` |
|---|---|---|
| Wins (each run) | 13, 16, 15, 14, 16, 15, 16, 16 | 15, 14, 12, 15, 14, 15, 15, 14 |
| Average wins | 15.1 | 14.3 |
| Best tier (each run) | 11, 13, 11, 12, 12, 12, 13, 12 | 11, 11, 11, 11, 10, 12, 11, 11 |
| Average best tier | 12.0 | 11.0 |

**One run day by day (`forge`, offset 0):**

| Day | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Upgrades | 20 | 11 | 14 | 8 | 5 | 6 | 6 | 7 | 5 | 7 |
| Worn gear below cap (levels) | 0.3 | 3.0 | 1.3 | 3.8 | 3.5 | 3.3 | 4.0 | 3.3 | 3.3 | 3.2 |
| Embers left | 6 | 9 | 1 | 14 | 2 | 26 | 26 | 0 | 8 | 2 |

**What this shows.**
- Most of the high count is day 1: 20 upgrades on items below level 7. An upgrade costs (4 + 1.5 × level) × the rarity factor, so 3 to 22 embers at those levels. From day 4 it is 5 to 8 a day across 4 runs (3 delves and the bounty), so about 1.5 to 2 a run.
- Salvage pays a flat amount per rarity, while upgrade cost grows with item level. So the Forge slows down on its own as the hero climbs.
- Worn gear sits about 3 levels below the cap from day 2 on. The cap rises with hero level and tier faster than embers can follow, so the Forge never maxes everything out.
- The power it adds is modest: about one tier and one win over 30 delves against a hero who never forges.
- Embers never pile up. In that run the most left at the end of a day was 26, and the 8 `forge` runs ended day 10 with 2 to 60 embers (2, 60, 11, 2, 11, 26, 55, 22). A level-25 Rare costs 42 to upgrade, so that is one or two upgrades at most.

**Decision: no cost change.** Each upgrade is +1 level on one of six items, so the number of upgrades was the wrong measure. The outcome the target was written for (steady progress, no power spike, nothing piling up) is met. Tripling the cost to reach "1 a delve" would leave gear further behind fresh drops and make the Forge feel slow, for a power change of under a tier. balance.md now states the target as outcomes:
- Worn gear trails the cap by 2 to 4 levels.
- Over 10 days the Forge is worth about one tier against hoarding.
- Embers don't pile up.

**Watch items:**
- Day 1's burst of cheap upgrades means many taps in the Forge panel. An "upgrade the lowest worn item" button (visuals and engineering) would fit the bot's pattern.
- If a later change raises ember income (a season track, for example), check the gap to the cap again. If it drops under 2 levels, the Forge is turning into a power spike.

## The new sets' book rewards (21 Nov 2026)
Four sets were added on 21 Nov: Wrackrider, Deepguard, Ventwalker and Kinbound. The collection book's set rewards went from 720 to 1,040 embers in all. The watch item above asks whether new income pulls worn gear under 2 levels below the cap.

**Method.** `tools/economy.ts` only delves the Kiln, so it never drops the new sets. A new `WINDFALL=N WINDFALL_DAY=d` adds N embers at the start of day d. Runs: Emberwright, `forge` policy, 10 days, seed offsets 0 to 7, on main 871734b. Average gap below the cap over the 8 runs:

| Windfall on day 5 | Day 5 | Day 6 | Day 10 | Best tier | Embers left on day 10 |
|---|---|---|---|---|---|
| None | 2.6 | 2.8 | 2.7 | 12.1 | 4 to 36 |
| 80 (one set finished) | 2.8 | 2.6 | 2.8 | 12.5 | 1 to 40 |
| 320 (all four new sets on one day) | 2.1 | 1.9 | 2.9 | 12.4 | 0 to 36 |

**Result: no change.**
- One set's 80 embers changes nothing measurable.
- Even the worst case only brings gear to about 1.9 levels under the cap for a day, and by day 10 it is back to normal. That case is finishing all four new sets on one day, which takes group and raid wins, so it won't happen in practice.
- Embers still don't pile up, and best tier stays within noise. The Forge cap is what bounds a windfall: worn gear can't pass it, so extra embers just run out sooner.

## Shared purse (P5, 21 Nov 2026)
Embers are one purse for the whole account, not one per class. Every source keeps paying as before (delves, bounties, weekly quests, collections, achievements, the world boss), and all of it lands in the shared purse.
- **Old saves:** on load, every class's purse is added to the shared one, so nobody loses embers (`shareEmbers` in sim/hero.ts, run on the local save and on the cloud save). It's safe to run again.
- **Why sharing doesn't make a power spike:** the Forge cap still follows each class's own hero level and best tier, so embers earned on one class can't push another class's gear past what that class could reach on its own. Purses end a day with 2 to 60 embers (see above), so the one-time windfall is small.

## Run embers: every fight carries embers home, kept on a loss (1.0 CP3, 27 Nov 2026)
Vision v2 ("What a loss pays": keep your embers) says every run carries embers home, win or lose. Before this a delve itself paid no embers, only its loot (salvage), so there was nothing to keep. `runEmbers` in sim/hero.ts (`RUN_EMBERS`) now pays each cleared fight `round(1 + 0.25 × tier)` embers, and a won boss counts as 2 fights. A loss keeps all of it and only misses the fights it never reached. A run that cleared no fight carries nothing (like the end chest), so quitting at once is not a farm. The end screen says "Carried home +N embers" on a win and "You fell, but kept the N embers you carried" on a loss (`RunRewards.carriedEmbers`).

At tier 1 a won Kiln delve (4 fights and the boss) carries 6; at tier 16 it carries 30. `tools/economy.ts`, forge policy, 10 days, seed offset 1 (one run each, so seed noise is in it):

| | main c504511 | with run embers |
|---|---|---|
| Forge upgrades per delve | 3.37 | 3.87 |
| Run embers per delve (total in minus salvage, bounty, weekly and achievements) | 0 | about 28 |
| Left over after 10 days | 102 | 20 |

A first try at `0.5 × tier` paid about 50 a delve and left 1,008 embers unspent (the Forge cap stops spending), so it was halved. Embers still don't pile up.
