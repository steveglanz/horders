# Balance targets and numbers

All numbers come from the autopilot (`sim/bot.ts`), which plays worse than a good person and better than a new one. Re-run the commands below and update the tables when a change touches combat, loot or pacing.

## Targets

| What | Target | Why |
|------|--------|-----|
| Delve length | 3 to 6 minutes | Phone sessions; "one more run" |
| Opener fight | 15 to 40 s | Warm-up, teaches one mechanic |
| Named or hard fight | 30 to 70 s | Long enough to see every mechanic twice |
| Boss fight | 45 to 120 s | Raid-boss feel without dragging |
| Tier 1 win rate, good bot | 60 to 80% | Beatable on day one, but you can lose |
| Tier 1 win rate, weak bot (skill 0.5) | 40 to 60% | A new player loses some early runs |
| Tier climb | Win rate settles near 40 to 50% at the hero's "wall" tier | Always a tier that pushes back |
| Hero level 20 | About 40 to 60 runs | From the original plan |
| Forge | About 1 upgrade per run from normal salvage; embers don't pile up | A sink that feels like steady progress, not a power spike |
| New class vs Emberwright | Within ±10 points of tier 1 win rate | Roles differ, power doesn't |

## Latest numbers (20 Nov 2026, main at 1a0e83c plus this PR)

**Single delves, tier 1, fresh hero** (`npx vite-node tools/balance.ts`, `SEEDS=...`, `SKILL=...`)

| Bot | Seeds | Wins |
|-----|-------|------|
| Good (skill 1) | 1 to 8 | 7 of 8 |
| Good (skill 1) | 11 to 20 | 9 of 10 |
| Weak (skill 0.5) | 1 to 10 | 8 of 10 |

Fight lengths over seeds 1 to 12, good bot: openers 13 to 39 s, named and hard fights 25 to 78 s, boss 19 to 98 s (seeds 1 to 8), whole delve 157 to 264 s.

**Reading:** tier 1 is easier than the target, especially for the weak bot (8 of 10 against a 40 to 60% target). Openers sit on target. Not changed in this PR, because the class-system PR changes combat next; retune tier 1 after it merges.

**50 runs in a row with hero progress carried** (`npx vite-node tools/progression.ts`; `FORGE=0` turns off salvage and the Forge)

| | Run 10 | Run 20 | Run 30 | Run 40 | Run 50 | Wins |
|---|---|---|---|---|---|---|
| No Forge: hero level / gear score / tier | 7 / 12 / T8 | 11 / 18 / T12 | 14 / 22 / T11 | 17 / 25 / T13 | 19 / 28 / T14 | 20 of 50 |
| With Forge: hero level / gear score / tier | 7 / 12 / T7 | 11 / 18 / T9 | 14 / 22 / T11 | 16 / 25 / T12 | 18 / 29 / T13 | 21 of 50 |

With the Forge the bot made 60 upgrades in 50 runs (1.2 per run), and its ember balance stayed between 2 and 24, so nothing piles up. Gear score ends one point higher. The tier column is noisy because the runs diverge once loot differs.

**Reading:** hero pacing is on target (level 18 to 19 by run 50). Tiers climb one per win up to about tier 8, then the bot hits a wall around tier 11 to 13 and wins about 40% there, which matches the target. The wall exists only because numbers scale, which is what Omens (roadmap R3) fix.

## Omens (20 Nov 2026, on the classes branch c04aaf3)

Each Omen forced on at tier 1, 24 seeds, good bot (`OMENS=<id> SEEDS=$(seq -s, 1 24) npx vite-node tools/balance.ts`). Target: each Omen costs a few wins or a clear chunk of health, and none is a run-ender on its own.

| Omens | Emberwright wins | Health left on wins | Duskblade wins |
|-------|------------------|---------------------|----------------|
| none | 20 of 24 | 94 | 7 of 24 |
| Kindled Dead | 20 | 84 | 5 |
| Shared Pain | 18 | 63 | 5 |
| Quickened | 20 | 65 | 4 |
| Warded | 18 | 76 | 1 |
| Volatile Ground | 21 | 82 | 4 |
| Volatile Ground + Warded + Shared Pain | 17 | 78 | 3 |

Tuning history: Volatile Ground started at 24 damage every 12 s with a 1.5 s warning and cut wins to 12 of 24, mostly by landing during boss soak circles. It now never erupts while a soak circle is up, and it hits for 16 every 15 s with a 1.8 s warning. Kindled Dead started at 22 damage in a 75 radius and did nothing, so it's now 35 in a 90 radius.

**Duskblade** loses far more than the Emberwright even with no Omens (7 of 24 against 20 of 24). That's for the skills team; it's been flagged to them. Warded hurts it most (1 of 24), so check again once its kit is tuned.

50-run progression with Omens (`tools/progression.ts`; `NO_OMENS=1` to compare; `WEEK=n` picks the rotation):

| | Run 10 | Run 30 | Run 50 | Wins | Wall tier |
|---|---|---|---|---|---|
| No Omens | T7, hero 7 | T11, hero 14 | T13, hero 18 | 21 of 50 | about 12 to 13 |
| Week 0 (Kindled Dead, Warded, Quickened) | T6, hero 7 | T9, hero 13 | T11, hero 17 | 21 of 50 | about 11 |
| Week 2901 (Quickened, Shared Pain, Kindled Dead) | T8, hero 7 | T12, hero 14 | T13, hero 18 | 20 of 50 | about 12 to 13 |

**Reading:** the wall tier moves by about one or two depending on the week, which is the weekly variety we want, and total wins hold steady. Hero pacing is unchanged.
