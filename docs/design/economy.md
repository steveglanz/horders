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
