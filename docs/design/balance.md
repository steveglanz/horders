# Balance targets and numbers

All numbers come from the autopilot (`sim/bot.ts`), which plays worse than a good person and better than a new one. Re-run the commands below and update the tables when a change touches combat, loot or pacing.

## Targets

| What | Target | Why |
|------|--------|-----|
| Delve length | 3 to 6 minutes | Phone sessions; "one more run" |
| Opener fight | 15 to 40 s | Warm-up, teaches one mechanic |
| Named or hard fight | 30 to 70 s | Long enough to see every mechanic twice |
| Boss fight | 45 to 120 s | Raid-boss feel without dragging |
| Tier 1 win rate, good bot | 70% or more | A skilled player shouldn't lose on day one. noviceAid (tiers 1 to 3) is meant to lift this, so there is no upper bound (changed 21 Nov 2026) |
| Tier 1 win rate, novice reference (`LAG=0.3 SKILL=0.5`) | 40 to 65% | A new player loses some early runs. Plain `SKILL=0.5` without LAG is no longer the novice row, because it barely weakens the bot |
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

## Forks (20 Nov 2026, on the classes branch plus Omens)

`BOT_PATH=steady|named npx vite-node tools/paths.ts` runs 24 tier 1 delves with no Omens.

| Path policy | Wins | Average delve | Items picked up | Average rarity (0 Common to 4 Mythic) | Epic or better |
|-------------|------|---------------|-----------------|----------------------------------------|----------------|
| Always steady | 20 of 24 | 211 s | 164 | 1.46 | 23 |
| Named when offered | 19 of 24 | 225 s | 177 | 1.58 | 34 |

**Reading:** the named path costs about one win in 24 and 14 seconds, and pays about 50% more Epics. That's the trade we want: worth it for a confident player, not mandatory. Shrines show up in roughly two of every three forks that have no named option left, which is mostly the third fork. The bot only takes a shrine below 60% health, which it rarely is after the 30% heal, so shrine numbers need human playtests.

## Drowned Foundry (20 Nov 2026)

`npx vite-node tools/foundry.ts` runs 24 tier 1 delves with a fresh hero and no Omens. `DUNGEON=kiln` and `SKILL=0.5` are optional.

| Bot | Kiln Depths | Drowned Foundry | Foundry boss fight |
|-----|-------------|-----------------|--------------------|
| Good (skill 1) | 19 to 20 of 24 | 18 to 19 of 24 | 58 to 59 s average |
| Weak (skill 0.5) | 22 of 24 | 17 of 24 | 71 s average |

**Reading:** the Foundry is about 20 points harder than the Kiln for the weak bot and about the same for the good bot. The new fights punish sloppy play (missed Quenches, never kiting) more than they punish raw power, which is the intent. The good bot kites Maelra over a vent every time her Temper reaches 2, so her average Temper stays near 1. Humans will likely carry more stacks, so watch this in playtests. The weak bot doing better than the good bot in the Kiln is noise from forks and drafts over 24 seeds.

## Grit (20 Nov 2026)

50-run progression, autopilot, Kiln (`tools/progression.ts`, `NO_GRIT=1` for off). Ran twice, same results both times.

| Week | Grit | Wins | Longest losing streak | Final tier |
|------|------|------|----------------------|-----------|
| 0 | off | 21 | 6 | 13 |
| 0 | on | 20 | 4 | 12 |
| 2901 | off | 19 | 6 | 12 |
| 2901 | on | 20 | 5 | 13 |

Grit shortens the worst losing streak by 1 to 2 runs without changing total wins or how far the hero climbs. That fits the goal: it gets you past a wall, it doesn't carry you. The target is a longest streak of 4 or fewer, so week 2901 is still one over. Next lever if playtests agree: 4 stacks, not a bigger per-stack bonus.

Party health scaling (×1, 1.775, 2.5, 3.175) doesn't change solo, so it has no solo numbers yet. It needs co-op playtests.

## Daily bounty (20 Nov 2026)

Autopilot with no gear, 30 days in a row (days 20400 to 20429), `tools/bounty.ts`. Normal delves use the same bot and 12 seeds (`tools/balance.ts`).

| Hero's best tier | Bounty tier | Bounty wins | Avg time | Health left on wins | Normal delve at that tier |
|---|---|---|---|---|---|
| 2 | 1 | 20/30 | 137 s | 54% | 10/12 |
| 5 | 4 | 10/30 | 225 s | 46% | 6/12 |

Without the 2-level head start it was 17/30 and 1/30, because the hero reached the hard fights underleveled. With the head start, a bounty plays a little harder than a normal delve at the same tier, which is about right for a run you take one tier below your best. Real heroes have gear, which this bot doesn't, so they'll win more. Volatile Ground was the hardest twist at tier 4 (0 of 6), so watch it once players arrive. Runs take 2 to 4 minutes, which suits a quick daily.

## Foundry sustain: vent heal (20 Nov 2026)

The skills team found that Maelra is a long fight with no healing at all, so the Lumen (the only class that heals itself) won 54 of 60 there while the others trailed. The encounter fix: boiling off her Temper in a steam vent now heals the hero 4% of max health per stack (up to 5 stacks, so 20%). Healing comes from playing the fight's verb, not from a free rest.

Emberwright with the autopilot, Foundry tier 1, seeds 1 to 60 (`tools/foundry.ts`): 47 wins before, 51 after. The boss fight still averages 62 to 63 s. (Duskblade reads 0 on this branch because its melee bot fixes are in PR #4. The skills team re-measures all four classes on a merge.)

## Geared reference heroes (20 Nov 2026)

Balance tools play an ungeared bot by default, which badly understates real heroes at higher tiers. `tools/progression.ts` now takes `SNAP=4,6,8`, which saves the hero (gear, passives, level) the first time each tier unlocks, to `tools/heroes/hero-t<N>.json`. `tools/foundry.ts` takes `HERO=<path>` to play with that hero. The autopilot unlocks tier 4 after 3 runs, tier 6 after 6 and tier 8 after 8.

Emberwright, seeds 1 to 40:

| Tier | Dungeon | No gear | Reference hero |
|---|---|---|---|
| 4 | Foundry | 8 | 40 |
| 6 | Foundry | 0 | 38 |
| 6 | Kiln | – | 38 |
| 8 | Foundry | – | 34 |
| 8 | Kiln | – | 35 |

With gear, the Foundry plays about as hard as the Kiln at the same tier, which was the goal. Class balance at tier 4 and above should be measured with these heroes, not ungeared.

### Which reference counts for class balance

1. **Geared tiers come first.** Use each class's own heroes (`CLS=<class> SNAP=4,6,8`), averaged over 3 progressions (`SEED_OFFSET=0,1,2`, saved as `hero-t<N>-<offset>.json`), because a single hero is noisy. Target: every class within 10 points of the others in each dungeon at tiers 4, 6 and 8.
2. **Tier 1 with no gear is the first-impression check.** Every class should win 40 to 60% with the weak bot (`SKILL=0.5`) and stay within 15 points of the others with the full bot. It must not be the bar for tuning, because players leave tier 1 within a few runs.

## Tier 1 first impression: a better novice proxy (20 Nov 2026)

`SKILL=0.5` barely weakens the autopilot, because its move direction is normalised: halving every avoidance force leaves the direction almost unchanged. So the Kiln at tier 1 read 83 to 100% even "at half skill". The bot now has a reaction time: `laggedBot(lagTicks, skill)` in `sim/bot.ts`, or `LAG=<seconds>` in `tools/balance.ts`. It acts on what it decided that long ago, moves and casts alike. A phone player's reaction time is a fair stand-in for a new player.

Kiln, tier 1, seeds 1 to 24, `SKILL=0.5`, on `stack` 750b9d5:

| Reaction time | Emberwright wins |
|---|---|
| 0 s | 22 |
| 0.3 s | 13 |
| 0.5 s | 8 |

With `LAG=0.3 SKILL=0.5` (the new novice reference): Emberwright 13, Duskblade 0, Bulwark 6, Lumen 23 out of 24.

Tier 1 itself is in range: the Emberwright is at 54% against the 40 to 60% target, so I'm leaving the fight alone. The spread between classes for slow players is the problem. The Duskblade is unplayable and the Lumen near-automatic, which goes to the skills team as forgiveness in the kits.

## Loot rarity: make Epics and Mythics feel earned (20 Nov 2026)

Steve got two Epics and a Mythic in his first delve. Before the change, every win guaranteed a boss Epic, named fights could raise a clear bag to Epic, and Mythics could drop at tier 1.

Changes: Epic weight 3.4 → 1.5 and Mythic 0.6 → 0.3. No Mythics below tier 3 (`MYTHIC_FROM_TIER`). The boss guarantees an Epic only on the first clear of a tier from tier 2 (`FIRST_CLEAR_EPIC_TIER`, `WorldOptions.firstClear`), and otherwise drops Rare or better. Clear bags top out at a guaranteed Rare. Bad-luck protection (an Epic after 10 dry runs) is unchanged.

Fresh hero, one run, seeds 1 to 40 (`tools/loot.ts`):

| | Runs with an Epic or better | Runs with a Mythic |
|---|---|---|
| Tier 1, before | 36/40 | 2/40 |
| Tier 1, after | 4/40 | 0/40 |

50-run autopilot progressions (`tools/progression.ts`, which now prints Epics, Mythics, the first Mythic run, and the longest stretch without an Epic):

| | Epics | Mythics | First Mythic | Longest stretch without an Epic | Wins | Final gear score |
|---|---|---|---|---|---|---|
| Before (2 heroes) | 54, 55 | 0, 7 | –, run 3 | 2, 2 | 18, 21 | 25, 28 |
| After (4 heroes) | 20, 19, 15, 16 | 2, 2, 2, 1 | runs 37, 16, 20, 6 | 10, 6, 9, 10 | 19, 21, 21, 18 | 27, 29, 27, 25 |

The ladder doesn't get harder: wins and gear score stay level, because a Rare at the same item level is close in power. Epics now come every 2.5 to 3 runs, and Mythics about one per 25 to 50 runs.

## The Glarewell (21 Nov 2026)

Measured with `tools/foundry.ts`, seeds 1 to 24, with the geared reference heroes (Emberwright). `DUNGEON=glarewell TIER=7 HERO=tools/heroes/hero-t6.json` and so on.

| Hero | Dungeon and tier | Wins of 24 | Boss fight |
|---|---|---|---|
| hero-t6 | Foundry, tier 7 | 21 | 115 s |
| hero-t6 | Glarewell, tier 7 | 22 | 127 to 129 s |
| hero-t8 | Kiln, tier 8 | 18 | 120 s |
| hero-t8 | Glarewell, tier 8 | 24 | 104 s |
| ungeared | Glarewell, tier 7 | 0 of 16 | – |

**Reading:** a geared hero arriving at tier 7 finds the Glarewell about as hard as the Foundry at the same tier, which was the target. Ungeared heroes can't clear it, as with the Foundry at tier 6. Most of the danger is in the Brandkeeper fights (8 to 14 Brand bursts a run) and the long boss fight. Glare hits the bot 1 to 4 times a run, so it hides most of the time. Humans will likely be hit more, so watch Glare in playtests.

**A bug found while tuning:** the first build ran the Glarewell elites' ability timers twice a tick, so the Brandkeeper branded 16 to 19 times a fight. That's fixed. The boss's clocks (enrage, phases, pillar cracks) now run every tick, even while she casts. The Lens Sweep keeps the cadence that was measured (every 1.7 s, every 1 s enraged), now written down as `GLARE.sweepEvery`. The Foundry's elites and Maelra use the same double-timer pattern. It's left alone because their tuning was measured with it, so it's a known quirk rather than a bug to fix silently.

**Kiln and Foundry unchanged:** `tools/hashcheck.ts` (4 classes, 2 dungeons, 3 seeds) prints the same output on main and on this branch.

## Kiln acolytes: Kindle casts (21 Nov 2026)

> **Rolled back the same day.** See [Kindle rolled back](#kindle-rolled-back-21-nov-2026) below.

Acolytes used to channel 0.8% of their ward's health per second with no tell. Now they cast **Kindle**: a 1.8 s interruptible cast every 6 s that heals 4.8% (the same rate if nobody Quenches). The first cast comes 2.5 s after they appear, with the second acolyte 1.5 s later. Numbers are in `ACOLYTE` in `sim/world.ts`.

The first version made novices lose more. The novice bot Quenched Kindles, and then had no Quench left for the Brute's Ground Pound. Two rules fixed that, and both are good for players too:
- Quench's auto-target treats a Kindle as the least urgent cast, so it takes a Ground Pound or Cataclysm first if one is up.
- Quenching a Kindle costs only half of Quench's cooldown.

Novice proxy (`tools/balance.ts`, LAG=0.3 SKILL=0.5, Kiln tier 1):

| Class | Seeds | main | first version | shipped |
|---|---|---|---|---|
| Emberwright | 1 to 120 | 69 | 54 | 69 |
| Duskblade | 1 to 120 | 67 | 54 | 66 |
| Bulwark | 1 to 40 | 22 | 25 | 27 |
| Lumen | 1 to 40 | 37 | 37 | 38 |

Geared hero-t4 in the Kiln at tier 4, seeds 1 to 40: 37 wins on main, 38 after.

## The Glarewell with the post-#17 heroes (21 Nov 2026)

The first Glarewell numbers above used the old reference heroes in `tools/heroes`. The skills team then found a 22-point class spread with their newer heroes (`heroes-r2`), mostly because the bot didn't hide from Glare. They fixed its shade-seeking (PR #30), and the Glare warning went to 2.6 s (PR #29).

Re-measured on main: `tools/foundry.ts`, tier 7, three hero-t6 heroes per class from the skills team's `heroes-r2`, seeds 1 to 40. Each cell is the average wins out of 40.

| Class | Glarewell, tier 7 | Foundry, tier 7 |
|---|---|---|
| Bulwark | 33.0 | 23.3 |
| Lumen | 32.7 | 21.3 |
| Emberwright | 30.7 | 27.3 |
| Duskblade | 26.3 | 28.3 |

**Reading:** the class spread in the Glarewell is 6.7 points, inside our 10-point bar. At tier 7 it plays a little easier than the Foundry at the same tier, which suits the dungeon you've just unlocked. No retune for now. The Bulwark gets Glared most (23% before the 2.6 s warning) because it has no movement skill, so keep an eye on it in playtests. The Foundry's own tier 7 spread is 7 points (Lumen 21.3, Duskblade 28.3). That belongs to the skills team's matrix, not to this change.

## Alchemy: potions (21 Nov 2026)

`POTION=<id>` in `tools/balance.ts` and `tools/foundry.ts` brews that potion for every run. With no potion, `tools/hashcheck.ts` prints the same output as main.

Novice proxy (LAG=0.3 SKILL=0.5), Kiln tier 1, seeds 1 to 60, wins out of 60:

| Potion | Emberwright | Duskblade |
|---|---|---|
| none | 35 | 32 |
| Rising Draught (25%) | 47 | 49 |
| Stillwater Tonic (40% faster) | 43 | 39 |
| Kindling Brew | 30 | 45 |

Geared Emberwright (`heroes-r2` hero-t6-0), Glarewell tier 7, seeds 1 to 40: none 32, Rising Draught (measured at 20%) 38, Kindling Brew 36, Stillwater Tonic (at 30% faster) 29.

**Reading:** Rising Draught is the strongest by far, worth 12 to 17 novice wins in 60, so it costs the most. A 40% version measured 51 of 60 for the Emberwright, which made losing nearly impossible, so it was cut to 25%. Stillwater and Kindling are modest, and seed noise is large (Kindling reads −5 for one class and +13 for the other), so treat them as small helps rather than precise numbers. Watch whether players buy Rising Draught every run once embers pile up. If they do, raise its cost or make it once a day.

## Kindle rolled back (21 Nov 2026)

With the skills team's geared heroes (`heroes-r2` hero-t6-0, Kiln tier 6), the Kindle cast from #29 cost the Duskblade wins. Wins out of the seeds shown:

| Version | Duskblade, seeds 1 to 40 | Duskblade, seeds 41 to 120 |
|---|---|---|
| Before Kindle (channel, commit a332967) | 33 | 55 |
| Kindle cast, Quenchable (#29) | 28 | not run |
| Kindle cast that 20% of the acolyte's health in damage breaks | 25 | 52 |
| Continuous channel plus a break stun | 28 | 58 |
| Channel that heavy hits stagger | 20 (26 if it keeps circling) | not run |
| Channel, no stagger (shipped) | 33 | not run |

Emberwright 29, Bulwark 35 and Lumen 38 of 40 before Kindle; the shipped channel gives the same Emberwright and Duskblade results as before Kindle (29 and 33), as expected since the code path is the same.

**Reading:** every version that lets you stop the heal early made the Duskblade lose more, even though it lowered the boss's healing. A frozen acolyte pinning a melee hero on its touch damage explains part of it, but not all. The same pattern shows up with damage buffs (below): a faster Kiln Mother kill doesn't mean more Duskblade wins. That's worth a look by whoever owns the Kiln Mother's phases. The heal is now a steady 0.8% per second again, drawn as a pulsing beam, and the counter is to kill the acolyte.

## Verb sets (R4, 21 Nov 2026)

`SET=<id> SETN=2|3` in `tools/foundry.ts` turns the hero's head, hands and trinket into set pieces. Geared `heroes-r2` hero-t6-0, each set in its own dungeon at tier 7, wins out of 40 (seeds 1 to 40) with the full set against none:

| Set (dungeon) | Emberwright | Duskblade | Bulwark | Lumen |
|---|---|---|---|---|
| Kilnbreaker (Kiln), first tuning +6%/+10% | 17 vs 19 | 12 vs 15 | 31 vs 30 | 20 vs 19 |
| Kilnbreaker, shipped +10%/+15% | 12 vs 19 | 15 vs 15 | 29 vs 30 | 25 vs 19 |
| Tidewalker (Foundry), shipped 6% / +30% | 31 vs 27 | 31 vs 24 | 21 vs 16 | 28 vs 27 |
| Glarewarden (Glarewell) | 37 vs 32 | 29 vs 22 | 33 vs 29 | 33 vs 35 |

Duskblade with Tidewalker over 80 seeds (1 to 80): 60 with the set, 51 without. Tidewalker was trimmed from 8% / +40% because it read about +10 for the Duskblade in 40.

**Reading, with a noise warning:** at these tiers a 40-seed run moves by ±5 wins from any change in timing, so single cells aren't reliable (Kilnbreaker's Emberwright cell fell from 17 to 12 when the buff went *up*). Overall, Tidewalker and Glarewarden help by about 2 to 7 wins in 40, and Kilnbreaker's effect is inside the noise. Kilnbreaker only pays off when you land interrupts, and the bots interrupt less than a good player. Revisit with real player data before tuning it further.

## The Hammerdeep: first pass (21 Nov 2026)

`tools/group.ts` runs one bot per hero (`PARTY=bulwark,lumen,duskblade,emberwright HEROES=<heroes-r2 dir>`). heroes-r2 hero-t6-0, tier 6. The seeds differ by party because the runs were done in separate batches:

| Party | Seeds | Wins |
|---|---|---|
| Bulwark + Lumen + Duskblade + Emberwright | 1 to 36 | 15 |
| No healer (Bulwark + Emberwright + Duskblade + Emberwright) | 1 to 36 | 5 |
| No tank (Duskblade + Lumen + Duskblade + Emberwright) | 1 to 36 | 3 |
| Four damage dealers | 13 to 36 | 1 |
| Bulwark + Lumen duo | 13 to 36 | 1 |

Earlier tuning that didn't ship:
- **Sundered lasting 14 s** (longer than Anvilfall's 12 s cycle): every Anvilfall after the first was Sundered, and the tank died to the second or third.
- **Hammer Sweep at 26:** the tank took 65 per sweep on top of Anvilfall.
- **Choir at 10% +1.5%:** full party 18 of 36, but no healer 13 and no tank 13, so roles stopped mattering.

**Reading:** roles matter in the order we want. The full party is below the 60 to 75% target because the bots play their roles badly. The Bulwark doesn't save Bastion for Anvilfall, and in traces the Lumen sat about 340 px from the tank and barely healed it. The skills team is fixing both bots. Retune after that, then give the duo its own pass.

## Kiln Brand placed away from the Kiln Mother: tried, not shipped (21 Nov 2026)

The skills team found melee heroes losing health to her contact hits while soaking the Kiln Brand. I dropped the Brand on the hero's far side from her (within 45°). Kiln tier 6, hero-t6-0, seeds 1 to 80, main against the change:

| Class | Main | Brand away |
|---|---|---|
| Emberwright | 60 | 65 |
| Duskblade | 60 | 61 |
| Bulwark | 71 | 77 |
| Lumen | 75 | 74 |

The Duskblade, the class it was meant to help, didn't move, and the Bulwark gained the most, which widens the Kiln class spread. So it's not shipped. The Duskblade's Kiln losses need another cause.

## The Hammerdeep retuned for the new group bots (21 Nov 2026)

The skills team's PR #54 fixes two bots: the Bulwark now saves Bastion for an Anvilfall aimed at it, and the co-op Lumen heals the most wounded ally. With those bots and the first-pass numbers, every tier 6 full party won (24 of 24), the Bulwark + Lumen duo won 24 of 24, and a party with no tank won 15 of 24. That means the healer carried parties with no tank.

The retune:
- Anvilfall goes from 120 to 160 (before tierDamage), so a non-tank barely survives one hit.
- Ondrel's health goes from 4400 to 4800.

Choir of Iron stays at 12% + 2%.

heroes-r2 hero-t6-0, tier 6, seeds 1 to 60, wins out of 60:

| Party | Wins |
|---|---|
| Bulwark + Lumen + Duskblade + Emberwright | 40 (67%) |
| No healer (Bulwark + Duskblade + Emberwright + Duskblade) | 6 |
| No tank (Duskblade + Lumen + Emberwright + Duskblade) | 1 |
| Bulwark + Lumen duo | 15 |

The full party at other tiers (seeds 1 to 24): tier 4 with hero-t4-0 won 24 of 24, and tier 8 with hero-t8-0 won 2 of 24. A trial at Anvilfall 170 with 5600 health dropped the full party to 7 of 24.

**Reading:**
- The full party is inside the 60 to 75% target.
- With no tank or no healer, a party mostly loses, which is the point of a group dungeon.
- The duo can clear it about one run in four.
- Tier 4, where it unlocks, is a gentle first visit. Tier 8 is steep, so watch it once real parties play.

## Tier 1 table redefined, and Burnout ends stalled runs (C7, 21 Nov 2026)

QA's C7 sweep (main 8087db3) raised two points.

**1. The Kiln tier 1 win rate looked too high.** It was measured against the old rows. With the plain bot at `SKILL=0.5`, every class won 83 to 100%. That row predates the novice reference (`LAG=0.3 SKILL=0.5`, see "Tier 1 first impression"), and noviceAid lifts tiers 1 to 3 on purpose. I re-measured on the novice reference (main 15a4375, Kiln, tier 1, seeds 1 to 24, ungeared):

| Class | Wins | Avg HP left on wins |
|---|---|---|
| Emberwright | 15/24 (62%) | 59 |
| Duskblade | 15/24 (62%) | 63 |
| Bulwark | 12/24 (50%) | 102 |
| Lumen | 22/24 (92%) | 130 |

The rows are now "good bot: 70% or more" and "novice reference: 40 to 65%". Three classes are inside the range. The Lumen is above it, which stays accepted as the gentlest novice class until there is real player data (see project memory). There's no tuning change. The Emberwright's low HP on wins (59 against 63 to 130) is on the watch list for skills' C5 talents.

**2. Runs that can neither be won nor lost.** A kiting Lumen against an enraged Kiln Mother ran past 1500 s with 549 live adds. An Emberwright in a Foundry tier 8 opener left the Sluice Crawler at full health forever. The fix is **Burnout** (`BURNOUT` in `sim/world.ts`):
- Every fight has a hard limit: 240 s for a regular fight, 360 s for a boss fight (well past every boss's soft enrage).
- 30 s before the limit, the HUD warns "The fire is closing in".
- Past the limit, every hero loses 4% of max health in the first second, 8% in the next, and so on. Shields don't stop it, so the run ends within about 6 s.
- A fight never holds more than 150 live foes. Summons past that fizzle.

`tools/stallcheck.ts` runs QA's repro cases with a 3000 s cap (Lumen Kiln T6 skill 0.5 seeds 1 to 12; Emberwright Foundry T8 seeds 2, 4 and 5):
- Every run ends. The longest is 872 s, against more than 1500 s before.
- The add peak is 150, against 549 before.
- The three Foundry stalls end at 249 s.

`tools/hashcheck.ts` is identical to main, because no reference bot run reaches 210 s in one fight or 150 live foes.

**Why the Foundry opener stalled.** I traced seed 2 (`tools/stallcheck.ts` cases). The ungeared Emberwright stays 200 units from the hounds, and wears them down to 247 of 603 and lower. The Crawler's blooms land on the hero with the hounds next to it, and each burst heals the hounds back. The Crawler itself stays 350 to 500 units away at full health. That is the fight's own mechanic ("Drag the blue ring away from the hounds before it bursts") beating a bot that doesn't drag. It isn't a bug, and an ungeared hero at tier 8 isn't a real case. Burnout now ends it.


## Content QA: the newest content (C7, 21 Nov 2026)

`tools/contentcheck.ts` runs the newest content with good (skill 1) and weak (skill 0.5) bots. It flags any run that hasn't ended by 3 000 s of sim time as a soft-lock. These runs use the skills team's heroes-r2 `hero-t8-0` for every hero, seeds 1 to 12, on main 0a6b715.

| Content | Good bot wins | Weak bot wins | Longest run |
|---|---|---|---|
| Coldmarrow T10, Emberwright | 5/12 | 2/12 | 544 s |
| Coldmarrow T10, Duskblade | 10/12 | 5/12 | 497 s |
| Coldmarrow T10, Bulwark | 6/12 | 5/12 | 439 s |
| Coldmarrow T10, Lumen | 5/12 | 5/12 | 528 s |
| Crucible T8, Bulwark + Lumen + Duskblade + Emberwright | 9/12 | 4/12 | 512 s |
| Crucible T8, no healer | 0/12 | 0/12 | 332 s |

**Result:** 144 runs, none stuck. The most foes alive at once was 13, so the Burnout add cap of 150 was never close.

**Watch items:**
- Coldmarrow runs take up to 9 minutes, against the 3 to 6 minute delve target. Its boss fights are already a watch item in coldmarrow.md. The first lever is Nhevra's health.
- At tier 10 the Coldmarrow is about where its tier 9 table put it. Two class pairs are more than 15 points apart: Duskblade and Emberwright, and Duskblade and Lumen.
