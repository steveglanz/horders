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
- Embers never pile up. In that run the most left at the end of a day was 26, and the 8 `forge` runs ended day 10 with 2 to 60 embers (2, 60, 11, 2, 11, 26, 55, 22), under one upgrade's cost at that level.

**Decision: no cost change.** Each upgrade is +1 level on one of six items, so the number of upgrades was the wrong measure. The outcome the target was written for (steady progress, no power spike, nothing piling up) is met. Tripling the cost to reach "1 a delve" would leave gear further behind fresh drops and make the Forge feel slow, for a power change of under a tier. balance.md now states the target as outcomes:
- Worn gear trails the cap by 2 to 4 levels.
- Over 10 days the Forge is worth about one tier against hoarding.
- Embers don't pile up.

**Watch items:**
- Day 1's burst of cheap upgrades means many taps in the Forge panel. An "upgrade the lowest worn item" button (visuals and engineering) would fit the bot's pattern.
- If a later change raises ember income (a season track, for example), check the gap to the cap again. If it drops under 2 levels, the Forge is turning into a power spike.
