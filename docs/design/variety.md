# Variety pass: make every run feel different (Phase 11, 22 Nov 2026, design)

Steve, after playing (22 Nov 2026): "The bosses I have fought, and the waves, have seemed pretty similar." And: "People aren't going to want to play the same dungeon multiple times with no changes. And the environments need better designs."

## What a new player sees first (audit of main, 22 Nov 2026)
A new hero plays the **Kiln Depths** at tiers 1 to 3, then the **Drowned Foundry** and the **Hammerdeep** from tier 4.
- **Few fights to draw from.** A Kiln route is two of 3 openers (`pack` 4 hounds, `wardens` 2 Hollow Wardens, `warpack` 1 Warden + 2 hounds), one of 2 named fights (`brute`, `ashmaw`), one hard fight (`acolytes` or `ashmaw`), then the Kiln Mother (sim/content/dungeon.ts). That is about a dozen routes, and they share most of their fights.
- **Every foe plays the same way.** The Kiln has five foes, and four of them walk at you and cast one red shape: the hound a cone (Snap), the Warden a circle on itself (Warden Slam), the Brute a circle on you (Ground Pound), and the Glutton a heal (Gorge). The Acolyte is the only one that does anything else: it stands still and heals (sim/world.ts, the per-kind ability block). Nothing shoots from range, swarms, hides, charges or guards.
- **Every arena is the same.** The arena is an empty circle (`ARENA_RADIUS`). Only the Glarewell (pillars), the Coldmarrow (river crack) and the Wrackline (rafts) add anything, and a new player reaches none of them until tier 7.
- **Nothing changes between runs before tier 3.** Omens (sim/content/omens.ts) start at tier 3 and rotate weekly. Named elites (half of all delves) and forks are the only other variation.

## The plan
Each item is seeded from the run's rng, or from the day or week number like bounties and Omens. So a seed still replays exactly, co-op guests stay in sync, and the hashcheck only moves where we mean it to.

| # | What | Owner | First where |
|---|---|---|---|
| V1 | **Wave archetypes.** New foes that move and attack differently: a ranged **Ember Spitter** that keeps its distance and lobs a slow fire circle where you stand (close in or keep moving); a **Hollow Rift** encounter that spits Ashlings until you break it (swarm, kill the source); a **Charger** that lines up and dashes (sidestep a line, not a circle). Each new encounter mixes one archetype with the existing foes, so the Kiln goes from 3 openers and 2 named fights to 6 and 4. | design | Kiln, then the Foundry |
| V2 | **Arena layouts.** Each fight rolls one of four layouts: open; **pillars** (block movement and line of sight, reusing the Glarewell's pillar collision); a **lava channel** across the arena that burns if you stand in it; **kiln vents** that flare in turn. The layout is shown as the fight starts. | design (sim), visuals (art) | Kiln, then the Foundry |
| V3 | **Boss variants.** The Kiln Mother and Maelra each roll one of two signature phase-2 mechanics per run, so the boss can play differently from one run to the next. Kiln Mother: Molten Cataclysm (today), or **Kiln Draw** (she breathes in and pulls you toward her while a fire ring closes in). Maelra: Rising Water (today), or **Undertow** (currents push across the arena). The boss intro names the variant. | design | Kiln Mother, then Maelra |
| V4 | **Run-to-run changes before tier 3.** A daily **Kindling**, the same for everyone that day: one gentle twist from a small pool, such as "hounds hunt in bigger packs", "shrines come more often", "Brutes carry treasure" or "every fight is a lava layout". Shown in the hub. Weekly Omens still start at tier 3. | design | Kiln tiers 1 to 2 |
| V5 | **Environment and silhouette art.** Each layout gets art, so each dungeon looks like a place rather than a floor tint. Each new foe and the Kiln Draw get a silhouette and tells that read at 360 px. Paired with visuals' look overhaul. | visuals | With V1 to V3 |
| V6 | **Sound.** Cues for the Spitter's lob, the Rift's spawn and break, the Charger's dash, the lava flare, Kiln Draw and Undertow. | sound | With V1 to V3 |
| V7 | **Measure.** contentcheck at tiers 1 to 4 with the new pools. Kiln and Foundry win rates stay in their current bands (balance.md). Count distinct routes and layouts per 20 runs, aiming for no two runs alike in 20. | design, QA | After V1 to V3 |
| V8 | **The same pass for the Glarewell and the Coldmarrow.** | design | After V7 |

**Order:** V1 and V2 for the Kiln first (tiers 1 to 3), then V3 (the Kiln Mother), V4, and then the Foundry. Visuals and sound start their parts from this brief while design builds the sim.

**Names:** every new name is searched first (wowhead, warcraft.wiki.gg, the open web), and boss names can be invented words (Steve, 22 Nov 2026).

## V1 status (built 22 Nov 2026)
- **Foes:** `emberSpitter` (Ember Spitter, 420 hp, keeps 190 to 290 px away, casts `emberLob`: a 70-radius circle on your spot that lands 1.6 s later) and `ashbuck` (Ashbuck, 620 hp, 520 since V7, casts `charge` for 1 s with a lane telegraph, then runs 360 px straight down it). The Hollow Rift fight reuses `rift` and `ashling`, with at most `VARIETY.riftCap` = 8 Ashlings out. Tuning is in `VARIETY` (sim/world.ts).
- **Fights:** openers `spitters` (2 Spitters, 2 hounds), `riftfall` (a Rift and 2 hounds), `ashbucks` (2 Ashbucks, a hound); named `spitterBrute` and `ashbuckWarden`. The first delve keeps its fixed route.
- **Bots:** a ranged bot closes in on a Rift (the fight's tip). The Rift fight first had a Hollow Warden: at tier 3 the Emberwright lost the opener in 11 of 20 runs (the Warden's slams while it went for the Rift), so the Warden became 2 hounds. Then it lost none of 20, though the fight runs about 56 s for an Emberwright, longer than an opener should (15 to 40 s). V7 looks at that.
- **Events:** `spitLob {index, x1, y1, x2, y2}`, `charge {index}`, `riftSpawn {index, n}`; `riftOpen` now also fires when a fight spawns a Rift.
- **Names:** "Ember Spitter" and "Ashbuck" had no WoW match (searches on 22 Nov 2026). "Cinder Charger" was dropped (WoW has the Cindermane Charger mount), and so was "Kiln Ram" (WoW has an NPC Kilram).
- **Placeholders:** the Spitter wears the acolyte sheet and the Ashbuck the hound's until visuals draw them (V5).

**Measured** (tools/balance.ts, Emberwright unless noted, seeds 1 to 40, main 38ae385 against this change):

| Check | Before | After |
|---|---|---|
| Tier 1, novice (`LAG=0.3 SKILL=0.5`), Emberwright | 26 | 20 (50%) |
| Tier 1, novice, Bulwark | 16 | 17 (43%) |
| Tier 1, good bot | 34 | 33 |
| Tier 3, good bot | 24 | 23 |

All stay in balance.md's bands (novice 40 to 65%, good bot at tier 1 70% or more).

## V2 status (built 22 Nov 2026)
- **Layouts:** each Kiln fight except the Kiln Mother, shrines and the first delve rolls one of `LAYOUTS.kiln` = open, open, pillars, channel, vents (so open 2 in 5). The roll hashes the run seed and the fight number and doesn't draw from the run rng, so it adds no rng calls; every other dungeon stays open. Tuning is in `LAYOUT` (sim/world.ts).
  - **Pillars:** 5 stones of radius 34 on a ring of 230 px. Heroes and foes can't walk through them.
  - **Channel:** a lava strip 70 px wide across the arena that burns 8% of max health a second while you stand in it.
  - **Vents:** 4 vents on a ring of 260 px. One at a time, every 3.5 s (first at 4 s), a vent shows a 75-radius circle for 1.2 s, then flares for 20 damage.
- **Co-op:** `stones`, `lava` and `flareVents` are synced to guests (netsync ARRAYS), and `layout` is a synced scalar.
- **Bots:** step out of lava; they already dodge vent circles like any telegraph.
- **Events:** `layout {id}` as a fight starts (the fight banner names it), `ventFlare {x, y}` as a vent's circle goes up.
- **Placeholders:** the client draws stones, lava and vents as plain shapes until visuals' art (V5).
- **Hashcheck:** only the Kiln rows change; the Foundry rows are identical.

**Measured** (tools/balance.ts, seeds 1 to 40 unless noted, main 38ae385 / V1 / V1 and V2):

| Check | Main | V1 | V1 and V2 |
|---|---|---|---|
| Tier 1, novice, Emberwright | 26 | 20 | 17 (seeds 1 to 80: 38 of 80, main 50 of 80) |
| Tier 1, novice, Bulwark | 16 | 17 | 20 |
| Tier 1, good bot | 34 | 33 | 32 |
| Tier 3, good bot | 24 | 23 | 20 |

All in band, but the novice Emberwright sits near the 40% floor. Softer lava (5%) and vents (14 damage) gave 39 of 80, no real change, so the tuning stays and V7 rechecks it with the full pools.

## V3 status (built 22 Nov 2026): the Kiln Mother's Kiln Draw
- **Two versions:** as the Kiln Mother rises, the run rolls `bossVariant` from the seed (a hash, no run-rng draws): `cataclysm` (as before) or `draw`. The first delve always gets `cataclysm`. Phase 1 is the same in both, so a player still learns to Quench her Molten Cataclysm.
- **Kiln Draw** (from phase 2, on the Cataclysm timer): she breathes in for 2.2 s. It can't be interrupted. Every hero within 900 px slides toward her at 80 px/s (heroes run at 128 to 152), and a 150-radius fire circle on her lands for 45 damage (x1.5 enraged) when the breath ends. Answer: walk away from her until it lands. Tuning is in `KILN_DRAW` (sim/world.ts).
- **Intro:** the boss banner says so: "Quench her Cataclysm at first. Later she breathes in and pulls you to her fire: walk away from her." (`KILN_DRAW_TIP`, sim/content/dungeon.ts).
- **Sound and art:** the cast id is `kilnDraw` (`castStart` carries it). Sound already has `kilnDraw` (#361).
- **Co-op:** `bossVariant` is a synced scalar, and the pull moves every living hero.
- **Fix:** V2's vents scaled their damage by tier twice (when made and when landing). They now scale once, as other telegraphs do.
- **Name:** "Kiln Draw" had no WoW match (web search, 22 Nov 2026). Maelra's second version (later) needs another name, because the Foundry already has an Undertow.

**Measured** (tools/balance.ts, seeds 1 to 80, V2 tip against V3; boss = wins of the runs that reached the Kiln Mother, split by this run's version):

| Check | V2 | V3 | Boss, cataclysm seeds | Boss, draw seeds (V2 → V3) |
|---|---|---|---|---|
| Tier 1, novice, Emberwright | 38 | 37 | 23 of 43, same | 15 → 14 of 31 |
| Tier 1, novice, Bulwark | 39 | 38 | 23 of 47, same | 16 → 15 of 29 |
| Tier 1, good bot | 64 | 62 | 38 of 47, same | 26 → 24 of 31 |
| Tier 3, good bot | 44 | 45 | 26 of 42, same | 18 → 19 of 30 |

The Kiln Draw costs at most 2 boss wins in 31 against the same seeds, so the two versions are about as hard. Everything stays in band (novice 46 to 48%, good bot at tier 1 78%).

## V4 status (built 22 Nov 2026): Today's Heat
The plan called this the "Kindling", but Kindling is already a potion, so it is **Today's Heat**: one twist on the Kiln at tiers 1 and 2, the same for everyone that day. Weekly Omens still start at tier 3.
- **Pick:** `heatFor(day)` in sim/content/heat.ts hashes the day number (`dayOf`, as the daily bounty uses). The client passes it as `heat`, and the sim keeps it only on the Kiln below tier 3 (`heatApplies`), and never on the first delve, a bounty or a key run. The sim never reads the clock. Tools and tests run with no Heat unless asked (`HEAT=` in tools/balance.ts), so the hashcheck doesn't move.
- **The Heats:**
  - **Stone Floor:** every fight but the boss has the pillars layout.
  - **Vent Floor:** every fight but the boss has the vents layout.
  - **Quick Study:** 25% more experience.
  - **Rich Haul:** +20% loot luck.
- **Shown:** in the hub ("Today's Heat") and in the first fight's banner. `heat` is a synced scalar for co-op guests.
- **Cut after measuring:**
  - **Lava Floor** (a channel every fight): the novice Emberwright fell to 23 of 80 and the good bot to 45 of 80.
  - **Big Packs** (one more hound per group): the novice Bulwark fell to 28 of 80, and still 31 of 80 with the hounds at 75% health.
- **Names:** "Day's Heat", "Quick Study" and "Rich Haul" had no WoW match (web searches, 22 Nov 2026). Stone Floor and Vent Floor are plain words.

**Measured** (tools/balance.ts, seeds 1 to 80, Emberwright unless noted):

| Heat | Tier 1 novice Emberwright | Tier 1 novice Bulwark | Tier 1 good bot | Tier 2 good bot |
|---|---|---|---|---|
| None | 37 | 38 | 62 | 45 |
| Stone Floor | 41 | 37 | 60 | 66 |
| Vent Floor | 41 | 38 | 63 | 57 |
| Quick Study | 37 | 38 | 62 | 45 |
| Rich Haul | 36 | 39 | 63 | 44 |

All four keep tier 1 in band (novice 45 to 51%, good bot 75 to 79%). A forced pillars or vents day also skips the lava channel, which is why those days run easier at tier 2.

## Found on the way (for V7)
- **Hammer Sweep:** Ondrel's Hammer Sweep (sim/world.ts, since #51) multiplies its damage by tier when it is made, and telegraphs multiply by tier again when they land. So at tier 8 it hits about 2.2 times harder than `ONDREL.sweepDamage` says. The Hammerdeep's group tables were tuned with this, so it stays until V7 re-measures the Hammerdeep with a fix. Fixed in Phase 12 W2: see "Phase 12 W2, part 2".
- **Lava channel:** the V2 lava channel is the hardest layout for bots. V7 checks it with the full pools before it goes to other dungeons. Done: see "The lava channel and the L7 check" at the end.

## V7 status (measured 22 Nov 2026): the Kiln
**Run variety.** tools/variety.ts (new) counts run shapes: the route, each fight's layout and the Kiln Mother's version, all fixed by the seed. It looks at 50 blocks of 20 runs in a row (seeds 1 to 1000).

| Dungeon, tier | Runs that repeat an earlier run in their block of 20 | Distinct routes | Distinct run shapes |
|---|---|---|---|
| Kiln 1, main 38ae385 (before Phase 11) | 398 of 1000 | 18 | 18 |
| Kiln 1, now | **0 of 1000** | 206 | 989 |
| Foundry 4, now (no V1 to V3 yet) | 398 of 1000 | 18 | 18 |

The target was no two runs alike in 20, and the Kiln now meets it in all 50 blocks. The Foundry still repeats 4 runs in 10, so it is next (V8). Today's Heat adds a daily change on top, which this count leaves out.

**Fight length** (tools/balance.ts, seeds 1 to 80, tier 1 Emberwright, the average time to clear each fight, good bot / novice):
- **Openers:** pack 18 / 19 s, wardens 33 / 36, warpack 37 / 39, spitters 38 / 35, riftfall 34 / 37, and ashbucks 46 / 49 s.
- **Change:** Ashbucks was the one opener over the 15 to 40 s target, so the Ashbuck went from 620 to 520 hp. Ashbucks now runs 40 / 43 s.
- **Rift fight:** at tier 1 it runs 34 / 37 s, inside the target. The 56 s seen in V1 was at tier 3.
- **Named and hard fights:** 31 to 53 s.

**Win rates after the Ashbuck change** (seeds 1 to 80, before → after): tier 1 novice Emberwright 37 → 36, novice Bulwark 38 → 36, good bot 62 → 61, tier 3 good bot 45 → 45. That is within run-to-run noise, and all stay in band. Hashcheck: only the Kiln rows move.

**Still open:**
- The lava channel: see "Found on the way".
- Ondrel's double-scaled Hammer Sweep: re-measure the Hammerdeep with a fix, together with the group team.

## V8 status, part 1 (built 22 Nov 2026): the Drowned Foundry's fights and layouts
- **Fights:** the Foundry now draws from 6 openers (was 3) and 3 named fights (was 2). New: `glassSpitters` (a Glass Warden and 2 Ember Spitters), `crawlerCharge` (a Sluice Crawler, an Ashbuck and a hound), plus the Kiln's `riftfall` opener and `spitterBrute` named fight.
- **Layouts:** `LAYOUTS.foundry` = open, open, pillars, vents. There is no lava channel, since the Foundry is drowned and the channel was the layout bots handled worst. Maelra's fight stays open (it has its own steam vents).
- **Run variety** (tools/variety.ts, tier 4, 50 blocks of 20): repeats fell from 398 of 1000 to 4, with 149 routes (was 18) and 853 run shapes.

**Measured** with tools/foundry.ts and the geared reference heroes, seeds 1 to 60, before → after:

| Check | Before | After |
|---|---|---|
| Tier 4, hero-t4, good bot | 58 | 59 |
| Tier 4, hero-t4, `SKILL=0.5` | 57 | 54 |
| Tier 4, hero-t4 as a Bulwark, `SKILL=0.5` | 56 | 59 |
| Tier 6, hero-t6, good bot | 54 | 50 |

Hashcheck: only the Foundry rows move. Maelra's second version is part 2.

## V8 status, part 2 (built 22 Nov 2026): Maelra's Sluicetide
- **Two versions:** as Maelra rises, the run rolls `bossVariant` from the seed (a hash, no run-rng draws). It is either `water`, today's Rising Water where the arena shrinks from phase 2, or `tide`, the **Sluicetide**. Phase 1, Temper, the vents and Undertow are the same in both.
- **Sluicetide** (from phase 2):
  - The arena keeps its size.
  - The water pushes every hero 45 px/s one way (heroes run at 128 to 152).
  - Every 8 s it turns a quarter or an eighth, never straight back. Each turn emits `tideTurn {angle}`, and `World.tideAngle` holds the flow.
  - You kite her through the vents while leaning against the current. Tuning is in `SLUICETIDE` (sim/world.ts).
- **Intro:** the boss banner says so (`SLUICETIDE_TIP`), and "The tide turns" shows on each turn until visuals draw the current.
- **Co-op:** `bossVariant` and `tideAngle` are synced scalars, and the push moves every living hero.
- **Name:** "Sluicetide" is an invented word. Web searches on 22 Nov 2026 found no WoW match. "Crosscurrent" was dropped because it may be a WoW spell name. The plan's "Undertow" is already a Maelra cast.

**Measured** with tools/foundry.ts, geared reference heroes, seeds 1 to 60. The boss counts are wins out of the runs that reached Maelra, split by this run's version, part 1 → part 2:

| Check | All runs | Boss, water seeds | Boss, tide seeds |
|---|---|---|---|
| Tier 4, hero-t4, good bot | 59 → 58 | 27 of 27, same | 32 → 31 of 32 |
| Tier 4, hero-t4, `SKILL=0.5` | 54 → 54 | 22 of 24, same | 32 of 32, same |
| Tier 4, hero-t4 as a Bulwark, `SKILL=0.5` | 59 → 59 | 28 of 28, same | 31 of 31, same |
| Tier 6, hero-t6, good bot | 50 → 53 | 25 of 25, same | 25 → 28 of 31 |

The two versions are about as hard. A Bulwark's fight runs longer with the tide (125 s against 113 s on average). Hashcheck: only Foundry rows move.

**Run variety** with both parts (tools/variety.ts, tier 4, which now counts Maelra's version): 2 runs of 1000 repeat an earlier run in their block of 20 (was 398 before V8), with 925 distinct run shapes.

## V8 status, part 3 (built 22 Nov 2026): the Glarewell's fights and layouts
- **Fights:** 6 openers (was 3) and 3 named fights (was 2). New: `shadeSpitters` (2 Shades, 2 Ember Spitters), `shadeCharge` (an Ashbuck and 3 Shades), the Kiln's `riftfall`, and the named `lensCharge` (a Lensbearer and 2 Ashbucks).
- **Layouts:** `LAYOUTS.glarewell` = open, open, vents. The Glarewell already has its own pillars for hiding from the Glare, so it gets no stones. The Lensmother's fight stays open.
- **Run variety** (tools/variety.ts, tier 7): repeats in blocks of 20 fell from 409 of 1000 to 7, with 150 routes (was 18) and 724 run shapes.
- **Win rates** (tools/foundry.ts, `DUNGEON=glarewell TIER=7 HERO=tools/heroes/hero-t6.json`, seeds 1 to 40, before → after): good bot 39 → 38, `SKILL=0.5` 40 → 40. The hashcheck has no Glarewell rows, and every row is unchanged.
- **Next:** a second version of the Lensmother, then the Coldmarrow.

## V8 status, part 4 (built 22 Nov 2026): the Lensmother's Glintfall
- **Two versions:** as the Lensmother rises, the seed picks `bossVariant`. It uses a hash, so the run rng is untouched.
  - `brand`: Twin Brand from phase 2, as before.
  - `glint`: **Glintfall** on the same timer.
- **Glintfall:** a 1.8 s cast (`glintfall`) puts an 80-radius circle of falling light on every standing pillar. It lands for 24 damage, or 1.5 times that when she is enraged.
  - The pillars you hide behind from her Glare are unsafe for a moment, so you step off your cover and come back.
  - Tuning is in `GLINTFALL` (sim/world.ts). The banner says so (`GLINTFALL_TIP`).
- **Co-op:** `bossVariant` is a synced scalar.
- **Name:** "Glintfall" is an invented word. A web search on 22 Nov 2026 found no WoW match; the nearest is WoW's unrelated "Glintrok" NPCs.
- **Measured:** tools/foundry.ts, tier 7, hero-t6, seeds 1 to 60, before → after.
  - Good bot: 58 → 59 wins.
  - `SKILL=0.5`: 60 → 60 wins.
  - On glint seeds the boss record is 32 → 33 of 33 (good bot) and 33 of 33 both times (`SKILL=0.5`). The average fight stays 127 to 133 s.
  - The geared bot steps out of the circles, so Glintfall costs it nothing. It is a movement check for humans more than a damage check. Watch it in playtests.
- **Run variety** (tier 7, now counting her version): 2 repeats in 1000 runs (was 409 before V8), with 853 run shapes.

## V8 status, part 5 (built 22 Nov 2026): the Coldmarrow's fights and layout
- **Fights:** 6 openers (was 3) and 3 named fights (was 2), all from the Coldmarrow's own cold foes, since the fire foes don't fit a place where the fires went out.
  - New openers: `snufferPack` (a Snuffer and 3 Rime hounds), `wardenPack` (a Frost Warden and 3 Rime hounds) and `weaverSnuffers` (a Hoarfrost Weaver and 2 Snuffers).
  - New named fight: `twoWeavers` (2 Weavers and 2 Rime hounds).
- **Layouts:** `LAYOUTS.coldmarrow` is open, open or pillars (ice pillars). There are no vents or lava, and Nhevra's fight stays open.
- **Run variety** (tools/variety.ts, tier 10): repeats within blocks of 20 fell from 306 of 1000 to 6. Routes went from 24 to 179, with 766 run shapes.
- **Win rates** (tools/foundry.ts, `DUNGEON=coldmarrow TIER=10 HERO=tools/heroes/hero-t8.json`, seeds 1 to 40, before → after): good bot 36 → 38, `SKILL=0.5` 29 → 32. The new fights run a little easier than the old pool. The hashcheck has no Coldmarrow rows, so it is unchanged.
- **Next:** a second version of Nhevra.

## V8 status, part 6 (built 22 Nov 2026): Nhevra's Emberdrift
- **Two versions:** as Nhevra rises, the seed picks `bossVariant` (a hash, no run-rng draws).
  - `ice`: Thin Ice, as before.
  - `drift`: **Emberdrift**.
- **Emberdrift**, from phase 2:
  - Coals drain 2.5 times faster.
  - Every 12 s, 3 embers fall on a ring of 280 px (`World.driftEmbers`), replacing the last ones.
  - Walking over an ember refills 45% of your coal.
  - Players have to route between embers to stay bright for the Long Night, rather than step around strips of open water.
  - Events: `emberDrift {n}` and `emberPick {x, y, hero}`. Tuning is in `EMBERDRIFT`, and the banner says so (`EMBERDRIFT_TIP`).
- **Bots:** a hero whose coal is low (below 0.3 to 0.6, by skill) walks to the nearest ember.
- **Co-op:** `driftEmbers` is in netsync ARRAYS, and `bossVariant` is a synced scalar.
- **Client:** placeholder glows until visuals draw the embers.
- **Name:** "Emberdrift" is an invented word. A web search on 22 Nov 2026 found no WoW match; WoW has the unrelated "Emberflow" and "Emberdawn". "Banked Embers" was dropped because our talents already use "Banked".
- **Measured:** tools/foundry.ts, `DUNGEON=coldmarrow TIER=10 HERO=tools/heroes/hero-t8.json`, seeds 1 to 60, before → after.
  - Good bot: 54 → 54 wins.
  - `SKILL=0.5`: 49 → 52 wins.
  - Boss record on drift seeds: 23 of 24 both times (good bot), 22 → 25 of 25 (`SKILL=0.5`).
  - Emberdrift plays slightly easier than Thin Ice for bots. It stays as tuned until playtests, since humans will miss embers more often than bots do.
- **Run variety** (tier 10, now counting her version): 2 repeats in 1000 runs (was 306 before V8), with 866 run shapes.

**V8 is done.** All four solo dungeons a player meets before the raids repeat at most 2 runs in 1000 within a block of 20, against 306 to 409 before Phase 11.

## The lava channel and the L7 check (22 Nov 2026)
Skills' L7 re-check after the variety pass (l7-lock.md) had the tier 1 good-bot Emberwright at 119 of 160 on the Kiln, 10.25 per 40 behind the Duskblade and Bulwark. That is just past the ±10 bar. Before V1 (38ae385) it was 135 of 160.

**160 seeds is too few for this cell.** Measured with tools/balance.ts, good bot, tier 1, no gear:

| Seeds | Before V1 (38ae385) | main 8e2c124 |
|---|---|---|
| 1 to 480 | 411 | 359 |
| 481 to 960 | 386 | 372 |
| 961 to 1440 | 382 | 373 |
| All 1440, per 40 | **32.75** | **30.7** |

Seeds 1 to 480 happened to be lucky for the old code. Over 1440 seeds, the variety pass costs about 2 per 40, not 4.

**Where the 2 points go.** Seeds 1 to 480, main code with parts switched off. The Kiln Mother uses Molten Cataclysm only, so Kiln Draw plays no part:

| | Wins |
|---|---|
| Old fight pools, open arenas | 411 (same as before V1) |
| New fight pools, open arenas | 389 |
| Old fight pools, layouts | 380 |

So no other code change moved it. The heroes reach the Kiln Mother at the same level and full health, and with gear within 2 points of before.

**The lava channel bug.** Of the 45 early deaths on main in 1440 runs, every one I traced was in a lava channel fight, nearly all with a Brute. A ranged bot backs away from a Brute. The old lava rule pushed it off the near bank with a fixed force, so it stood pinned on that bank and was beaten down.

Lava burn has nothing to do with it: `LAYOUT.lavaBurn` 0 or 0.04 gives the same 119 of 160.

A player would just cross, which costs about 3% health. Now a bot pressed against the bank crosses straight over. It only does this when the rest of its pull points across, at least 0.25 of the way, and is stronger than 0.02. Otherwise it keeps off the lava as before. The threshold was picked from 0 to 0.05 at 160 seeds.

**After the fix** (1440 seeds, tier 1 Kiln, per 40):

| Cell | main | With the fix |
|---|---|---|
| Good-bot Emberwright | 30.7 (45 early deaths) | **31.4** (9 early deaths) |
| Novice Emberwright | 19.7 | 21.3 (53%, in the 40 to 65% band) |
| Novice Duskblade | 14.2 (seeds 1 to 480 only) | 14.3 |

At 160 seeds, the good-bot Duskblade and Bulwark win 159 or 160 of 160 both before and after. The good-bot gap is now about 8.6 and the novice gap about 7.0, both inside ±10. Melee heroes rarely back into the lava, so they barely move.

I also tried a tier 1 spawn cut: one Spitter in Brute and Spitters, one Ashbuck in Warden and Ashbucks. It made no difference beyond noise, so I dropped it.

The bot change only affects channel fights, which only the Kiln has. The hashcheck's Kiln rows move.

## Phase 12 W1 (built 22 Nov 2026): the Wrackline
- **Fights:** 6 openers (was 3) and 3 named fights (was 2). The new fights mix the Kiln's new foes into the water:
  - `quaySpitters`: 2 Ember Spitters and 2 Shoal Lurkers.
  - `quayCharge`: 2 Ashbucks and a Lurker.
  - `shoalRift`: a Hollow Rift and 2 Lurkers. The Ebb drags its Ashlings to the drain.
  - Named fight `haulerSpitters`: a Barge Hauler and 2 Spitters.
- **Currents:** every fight but Hessa's rolls which way each raft drifts (`CURRENTS`, 4 patterns, the first is the original) and where the rafts start, from a hash of the seed and the fight's place. There are no stone, lava or vent layouts here, since the rafts already shape the floor.
- **Hessa's second version.** As she rises, the seed picks `bossVariant`:
  - `riptide`: as before, phase 2 speeds the rafts and the pull.
  - `outsurge`: from phase 2 **the Outsurge** turns the Ebb around. Off a raft, the water throws you out to the rim instead of into the drain. The last 90 px of the rim burns 10% of max health a second, like the drain does. Foes are thrown out too, and the rim hurts them.
  - Tuning is in `OUTSURGE`. The cast is still `castStart` with id `ebb`, named "The Outsurge". `World.outsurge` says when it is live, and the banner says so (`OUTSURGE_TIP`).
- **Client:** the Ebb's foam streaks run outward during the Outsurge (placeholder until visuals).
- **Names:** "Outsurge" is an invented word, and a web search on 22 Nov 2026 found no WoW match. The Rift fight was first called "The Drowned Rift" but became "The Rift in the Wrack", because WoW has a Drowned City and a Drowned Lair.

**Run variety** (tools/variety.ts, tier 10, now counting Hessa's version and the currents): 1 run in 1000 repeats an earlier run in its block of 20, against 409 before. Routes went from 18 to 150, and there are 923 run shapes.

**Win rates** (tools/foundry.ts, `DUNGEON=wrackline HERO=tools/heroes/hero-t8.json`, seeds 1 to 160, main 5a5f6c9 → this change):

| Class | Tier 10 | Tier 13 |
|---|---|---|
| Emberwright | 145 → 149 | 33 → 25 |
| Duskblade | 151 → 154 | |
| Bulwark | 154 → 156 | 20 → 23 |
| Lumen | 160 → 160 | |
| Slagbinder | 160 → 160 | |

Hessa's boss record by version (tier 10, wins out of the runs that reached her):
- Emberwright: riptide 77 of 77, outsurge 69 of 69.
- Duskblade: riptide 75 of 78, outsurge 77 of 77.
- Bulwark: riptide 78 of 81, outsurge 76 of 79.

The two versions are about as hard for bots, which ride a raft through every Ebb either way. For a human, the Outsurge changes where the danger is.

The tier 13 moves are within the noise at 160 seeds (about ±5). The hashcheck has no Wrackline rows and is identical to main.

## Phase 12 W2, part 1 (built 22 Nov 2026): the Hammerdeep and Ondrel's Ironload
- **Fights:** 6 openers (was 3) and 3 named fights (was 2).
  - New openers: `glassSpitters`, `riftfall` and the Kiln's `spitters`.
  - New named fight: `spitterBrute`.
- **Ashbucks are left out of group play.** The first set had `crawlerCharge` and `ashbuckWarden`. An Ashbuck's charge lane runs through a party standing together, and the full party at tier 8 fell from 96 to 71 of 160 with the new fights alone (layouts alone: 94).
- **Layouts:** `LAYOUTS.hammerdeep` is open, open, pillars or vents. There is no lava in group dungeons, since a party can't all cross it at once. The vents borrow the Kiln's fire sounds (`VENT_SOUNDS.hammerdeep`) until sound gives them their own. Ondrel's fight stays open.
- **Ondrel's second version.** The seed picks `bossVariant`:
  - `choir`: Choir of Iron, as before.
  - `load`: **Ironload** on the same timer. It marks a hero other than the one Ondrel is on (`World.loadHero`). After 5 s it lands for 50% of max health, plus 8% more each time. The damage is split evenly among the living heroes within 110 px of the mark.
  - Four heroes together take about what one Choir costs each. Alone, the marked hero takes half its health.
  - The Choir is a healer check. Ironload is a party positioning check, the opposite of the Ashvents' Scatter Embers, which want you spread out.
  - Tuning is in `IRONLOAD`. The banner says so (`IRONLOAD_TIP`), and the client draws a placeholder iron ring that fills as it comes down.
- **Bots:** while a hero is marked, everyone walks to it, and the marked hero walks to the others. `NOSTACK=1` turns this off for measuring.
- **Name:** "Ironload" is an invented word, and a web search on 22 Nov 2026 found no WoW match. "Ironbrand" was dropped as too close to WoW's "Ironband", and "Shared Weight" as too close to WoW's "Shared Burden".

**Measured** with tools/group.ts, heroes-r2 at the matching tier, full party Bulwark, Lumen, Duskblade and Emberwright, main → this change:

| Check | main | This change |
|---|---|---|
| Tier 4, seeds 1 to 80 | 80 | 80 |
| Tier 6, seeds 1 to 80 | 78 | 78 |
| Tier 6, no tank (Lumen, 2 Duskblades, Emberwright) | 5 | 3 |
| Tier 6, no healer (Bulwark, Duskblade, 2 Emberwrights) | 10 | 19 (24%, under the 25% bar) |
| Tier 8, seeds 1 to 160 | 96 (60%) | 94 (59%, in the 55 to 70% band) |

At tier 8, Ondrel's record by version is choir 52 of 88 and load 42 of 72, so the two are about as hard.

**Run variety** (tools/variety.ts, tier 6, now counting Ondrel's version): 2 of 1000 runs repeat an earlier run in their block of 20, against 409 before. Routes went from 18 to 150, and there are 928 run shapes.

The hashcheck has no Hammerdeep rows and is identical to main. Ondrel's double-scaled Hammer Sweep is still open; it is the next W2 PR, with its own re-measure.

## Phase 12 W2, part 2 (22 Nov 2026): Ondrel's Hammer Sweep counts the tier once
Hammer Sweep made its telegraph with `ONDREL.sweepDamage * tierDamage`, and telegraphs multiply by `tierDamage` again when they land. So it hit 14 × 1.12^(2(tier − 1)). Now the sweep is made unscaled, like every other telegraph. `sweepDamage` goes from 14 to 25, which keeps tier 6 where it was (14 × 1.12^5 = 24.7).

The landed hit, before → after:

| Tier | Before | After |
|---|---|---|
| 4 | 28 | 35 |
| 6 | 43 | 44 |
| 8 | 68 | 55 |
| 10 | 107 | 78 |

Mythic key levels scale `tierDamage` too, so the sweep no longer squares the key multiplier either.

**Measured** (tools/group.ts, heroes-r2, full party, main 64541ba → this change):
- Tier 8, hero-t8-0, seeds 1 to 160: 94 → 95.
- Tier 10, hero-t8-0, seeds 1 to 80: 7 → 8.

Bots step out of the cone, so the fix barely moves them. It matters for players, who will be hit by the sweep sometimes. Tiers 4 and 6 are 80 and 78 of 80 on main, and the tier 6 sweep is unchanged. The hashcheck has no Hammerdeep rows.

## Phase 12 W2, part 3 (built 22 Nov 2026): the Ashvents and Ysmeret's Wandering Vents
- **Fights:** 6 openers (was 3) and 3 named fights (was 2).
  - New openers: `riftfall`, `glassSpitters` and the Kiln's `spitters`.
  - New named fight: `spitterBrute`. No Ashbuck fights, for the same reason as the Hammerdeep.
- **Layouts stay as they were (all open).** Pillars or vents on top of the new fights cost about 11 of 80 tier 8 wins (seeds 1 to 80: main 54, layouts alone 56, fights alone 55, both 43). Each half alone is inside noise, so this ships the fights and leaves layouts for later.
- **Ysmeret's second version.** The seed picks `bossVariant` (its own salt, no run-rng draws):
  - `still`: Twin Vents, as before.
  - `wander`: **Wandering Vents.** The same two soak circles open, then move around her at 70 px/s (`WANDER.speed`, about 70 degrees over the fuse) while they fuse. The soakers have to walk with them. The banner says so (`WANDER_TIP`).
  - It reuses the `castStart` event with the id `twinVents`, so sound and art already play for it.
- **Name:** "Wandering Vents" had no WoW match in a web search on 22 Nov 2026.

**Measured** with tools/group.ts, heroes-r2 at the matching tier, main 5e68e1a → this change:

| Check | main | This change |
|---|---|---|
| Tier 4, full party, seeds 1 to 40 | 40 | 40 |
| Tier 6, full party, seeds 1 to 80 | 71 | 75 |
| Tier 6, no tank (Lumen, 2 Duskblades, Emberwright), seeds 1 to 40 | 5 | 6 |
| Tier 6, no healer (Bulwark, Duskblade, 2 Emberwrights), seeds 1 to 120 | 36 (30%) | 47 (39%) |
| Tier 8, full party, seeds 1 to 160 | 95 (59%) | 103 (64%, in the 55 to 70% band) |

At tier 8, by Ysmeret's version: still 46 of 76 (main, same seeds: 52) and wander 57 of 84 (main: 43). The seeds differ between the two groups, so this says the versions are close, not which is harder.

**Open: the Ashvents' healer check is too soft.** No healer wins 30% on main, already over the 25% bar, and 39% now. Almost every loss in both is at Ysmeret, so the fix belongs in her fight (for example Scatter Embers or Bellow Slam damage), measured on its own.

**Run variety** (tools/variety.ts, tier 8): 21 of 1000 runs repeat an earlier run in their block of 20, against 306 on main. Routes went from 24 to 179, and there are 339 run shapes. The hashcheck has no Ashvents rows.

## Phase 12 W2, part 4 (built 22 Nov 2026): the Pressworks and Oskel's Die Cut
- **Fights:** 6 openers (was 3) and 3 named fights (was 2), the same additions as the Ashvents: `riftfall`, `glassSpitters`, `spitters`, and named `spitterBrute`. No Ashbuck fights.
- **Layouts:** `LAYOUTS.pressworks` is open, open, pillars or vents, like the Hammerdeep. Oskel's fight stays open. The vents borrow the Hammerdeep's forge sounds (`VENT_SOUNDS.pressworks`) until sound gives them their own.
- **Oskel's second version.** The seed picks `bossVariant` (its own salt, no run-rng draws):
  - `rivets`: Rivets, as before.
  - `cut`: **Die Cut** on the Rivets timer (every 9 s). Half the floor, split through Oskel, warns for 2.4 s and hits everyone in it for 45 (scaled by tier as it lands). While a Downstroke plate is open the cut goes to the far side from it, so the plate's taker is safe and the party has to cross to the plate's side. With no plate open the side turns a quarter each time. Tuning in `DIECUT`.
  - Rivets ask each hero to step out on their own. Die Cut moves the whole party at once, and it meets the Downstroke: the party gathers on the plate's half while one hero takes the plate and the next one waits.
  - The banner says so (`DIECUT_TIP`). The cast id is `dieCut`.
- **Bots:** inside a cut of 162 degrees or more, a bot walks straight back across its edge (`sim/bot.ts`). Outside one, it ignores it.
- **Name:** "Die Cut" is a plain stamping term. Two web searches on 22 Nov 2026 found no WoW spell or zone by that name.
- **Ysmeret fix (from visuals' shots):** a Wandering Vent that the arena edge pulled in close to her stayed close, because each tick turned the clamped spot. Now each tick places it at `YSMERET.ventDist` from her and then clamps, so it swings back out. The Ashvents at tier 8, full party, seeds 1 to 160: 103 before the fix, 102 after.

**Measured** with tools/group.ts, heroes-r2 hero-t8-0, main → this change (wins):

| Check | main | This change |
|---|---|---|
| Tier 10, full party, seeds 1 to 160 | 116 (73%) | 113 (71%, in the 60 to 75% band) |
| Tier 10, full party, seeds 1 to 80, Die Cut alone | 59 | 56 |
| Tier 10, full party, seeds 1 to 80, fights and Die Cut, no layouts | 59 | 60 |
| Duo (Bulwark, Lumen) tier 9, seeds 1 to 80 | 26 (33%) | 35 (44%) |

By Oskel's version, Die Cut alone on seeds 1 to 80: cut 28 of 42 (main, same seeds: 31) and rivets 28 of 38 (main: 28). Most losses are still the Stamp on the tank. The duo gets easier with the new fights, but it's still under half, the hard way.

**Run variety** (tools/variety.ts, tier 10): 3 of 1000 runs repeat an earlier run in their block of 20, against 409 on main. Routes went from 18 to 150, and there are 922 run shapes. The hashcheck has no Pressworks rows.

## Phase 12: the Ashvents' healer check (22 Nov 2026)
After part 3, a party with no healer won 39% of tier 6 Ashvents runs (main before it: 30%), over the 25% bar for a party missing a role. Almost every loss was at Ysmeret, so the fix is in her fight. Scatter Embers now costs each hero 12% of max health (`YSMERET.scatterSelf`, was 10%). That is party-wide damage every 14 s, which a healer covers.

**Measured** with tools/group.ts, heroes-r2 at the matching tier, wins (scatterSelf 0.10 is main after #421):

| Check | 0.10 | 0.11 | 0.12 (shipped) | 0.13 | 0.15 |
|---|---|---|---|---|---|
| Tier 6, no healer (Bulwark, Duskblade, 2 Emberwrights), seeds 1 to 120 | 47 (39%) | 35 (29%) | 26 (22%) | | |
| Tier 6, no healer, seeds 1 to 80 | 29 | 22 | 19 | 16 | 12 |
| Tier 8, full party, seeds 1 to 160 | 102 (64%) | 90 (56%) | 84 (53%) | | |
| Tier 8, full party, seeds 1 to 80 | 52 | 47 | 46 | 42 | 33 |
| Tier 6, full party, seeds 1 to 80 | 75 | | 72 (90%) | | |
| Tier 6, no tank (Lumen, 2 Duskblades, Emberwright), seeds 1 to 40 | 6 | | 5 | | |
| Tier 4, full party, seeds 1 to 40 | 40 | | 40 | | |

The knob moves both cells together. 0.11 keeps tier 8 in its 55 to 70% band but leaves no healer at 29%. 0.12 meets the role bar, and tier 8 lands at 53%, 2 points under its band and inside the ±4% noise of 160 seeds. The role bar is the rule that keeps the group dungeon a group check, so 0.12 ships. If players find tier 8 too hard, the next knob is one that hits a full party less than a party with no healer, not this one.

## Phase 12 W3, part 1 (built 22 Nov 2026): Grandmother Slag's Brimming
The raid brief's cooling islands, deferred in C3, are now Grandmother Slag's second version. The seed picks `bossVariant` (its own salt, no run-rng draws):
- `pour`: phase 2 is the Pour, as before. Molten lanes every 6 s, and every hero loses 3% of max health every 3 s.
- `brim`: phase 2 is **the Brimming**. There are no lanes. Three cooling islands rise (radius 80), 170 or 260 from her in turn. Each lasts 12 s, dims for its last 3 s, then sinks, and a new one rises elsewhere. They start staggered, so one sinks every 4 s. The rising slag burns a hero off an island 6% of max health every 3 s and a hero on one nothing. Phases 1 and 3 are unchanged. Tuning is in `BRIM`, and the islands are `World.islands`, synced to guests.
- The Pour asks the party to dodge. The Brimming asks it to keep moving together from island to island while the tank holds her and the healer stays in reach.
- The banner says "Phase 2: The Brimming". The cast id is `brimming` (castStart when phase 2 starts). The client draws placeholder islands (dark discs with a glowing rim that flicker as they sink).
- **Name:** "The Brimming" and "Brimming Pit" had no WoW match in web searches on 22 Nov 2026. Names that start with "Slag" were avoided, since WoW has many (Slag Pit, Slagworks, Slag Forge).

**Bots** (`islandStep` in sim/bot.ts) walk to an island with more than 3 s left and stay near its middle. Melee heroes weigh the island's distance from her too. A Lumen weighs its distance from the hero it heals (the tank when nobody is low).

**Tuning on the way.** The first pass put the near islands 110 from her. That won 5 of the 33 Brimming seeds (seeds 1 to 80), against 23 on main. A trace of seed 2 showed why. The party stood on the near island 50 to 80 from her, inside her touch range (radius 56), and her touch drained the tank while the Lumen sat at full health. A lower burn (3%) and the bot changes barely helped. Bigger islands (110) gave 13. Moving the near islands out to 170 gave 20.

**Found on the way: #424 also changed the Crucible.** Cinder Marks (her phase 3) used Ysmeret's `scatterSelf`, so the Ashvents' healer check raised them from 10% to 12% too. They now have their own `SLAG.marksSelf` (0.1), which restores them. The measurements below compare against main before #424.

**Measured** with tools/group.ts, heroes-r2 hero-t8-0, tier 8, main 8910e46 → this change (wins):

| Check | main | This change |
|---|---|---|
| One tank (Bulwark, Lumen, Duskblade, Emberwright), seeds 1 to 160 | 94 (59%) | 91 (57%, in the 55 to 70% band) |
| By version: Pour seeds (74) | 43 | 43 |
| By version: Brimming seeds (86) | 51 | 48 |
| Two tanks (Bulwark, Lumen, Bulwark, Emberwright), seeds 1 to 80 | 66 | 66 |
| Brimming seeds 1 to 80 (33), bots ignore the islands (NOISLAND=1) | | 5 (with islands: 21) |

Two-tank parties were already over the 70% ceiling on main (raid.md). This change leaves them where they were. Standing on the islands is the check: without it the party wins 5 of 33.

**Run variety** (tools/variety.ts, tier 8): the Crucible has only 12 routes, and with the two versions 24 run shapes. A raid's fight pools were short. Part 5 widened them.

## Phase 12 W3, part 2 (built 22 Nov 2026): Old Vorhulm's Banked Coals
The seed picks `bossVariant` for Old Vorhulm (its own salt, no run-rng draws):
- `spill`: phase 3 is Ember Feast, as before. Embers scatter, and the party grabs them before he does.
- `bank`: phase 3 is **Banked Coals**. On Ember Spill's 10 s timer, three gold circles (radius 50) settle 170 or 260 from him, turning by the golden angle, and land after 4 s. A hero standing in one smothers it. He eats an empty one, exactly as he eats an ember: he heals 2% and hits 5% harder for the rest of the fight. There's no blast and there are no adds, so the price of a miss is a stronger boss, the Hoard's own rule. Tuning is in `BANK`. The circles are soak telegraphs with owner -4.
- Ember Feast asks everyone to run and grab. Banked Coals asks three heroes to split up and hold a spot while he keeps swallowing, so a Swallow at the wrong time costs a coal.
- The banner says "Phase 3: Banked Coals". The cast id is `bankedCoals`. A smothered coal sends `emberTaken` and an eaten one `emberEaten`, so the existing ember sounds play.
- **Name:** "Banked Coals" and "Banked Embers" had no WoW match in a web search on 22 Nov 2026.

**Measured** with tools/group.ts, heroes-r2 hero-t8-0, tier 9, full party (Bulwark, Lumen, Duskblade, Emberwright), main → this change, seeds 1 to 160:

| | main | This change |
|---|---|---|
| All seeds | 112 (70%, at the ceiling) | 99 (62%, in the 55 to 70% band) |
| Ember Feast seeds (77) | 49 | 49 |
| Banked Coals seeds (83) | 63 | 50 |

On seeds 1 to 80, he ate 290 embers or coals in the new runs against 185 on main, and the bots smothered most coals. Banked Coals is the harder version (60% against Ember Feast's 64%), and both are inside the band. The Hoard had been at the 70% ceiling, so this also brings it back under.

**Run variety:** like the Crucible, the Hoard has 12 routes and now 24 run shapes. Widening raid fight pools is still a follow-up.

## Phase 12 W3, part 3 (built 22 Nov 2026): the Cinder Colossus's Plate Shift
The seed picks `bossVariant` for the Cinder Colossus (its own salt, no run-rng draws):
- `wheel`: phase 2 is the Wheel, as before. He turns on the non-tank who hurt him most in the last 8 s and Slag Sweeps there.
- `shift`: phase 2 is **Plate Shift**, on the Wheel's timer and 2 s cast. His body keeps facing the tank, but his plate slides round to face the non-tank who hurt him most, and it stays there until the next shift (`World.colPlate`, the plate's turn from his facing). No sweep comes with it. His open back moves with the plate, so the damage dealers who were behind him are now hitting plate (half damage) and have to walk round to find his back again. It is often where the tank stands.
- The Wheel asks the tank to take him back. Plate Shift asks the damage dealers to keep reading where his back is.
- `colossusSide` and `behindColossus` (the Platewalker set) both use the plate's angle, and so do the bots' flanking (`colossusFlank`) and the floor arcs that show his front and back. The banner says "Phase 2: Plate Shift". The cast id is `plateShift`, and it reuses the `wheel` event for the hero it turned to, so "it's on you" cues still play.
- **Name:** "Plate Shift" had no WoW spell or zone match in a web search on 22 Nov 2026.

Also in this PR: the `soak` event now carries the telegraph's `owner`, and GameScene skips the missed-soak blast and the "Brand missed!" text for Banked Coals (owner -4). Sound found this.

**Measured** with tools/group.ts, heroes-r2 hero-t8-0, tier 10, full party (Bulwark, Lumen, Duskblade, Emberwright), main → this change, seeds 1 to 160:

| | main | This change |
|---|---|---|
| All seeds | 111 (69%) | 109 (68%, in the 55 to 70% band) |
| Wheel seeds (73) | 48 | 48 |
| Plate Shift seeds (87) | 63 | 61 |

The two versions are about as hard. The bots find his back again, as players will have to.

## Phase 12 W3, part 4 (built 22 Nov 2026): the Furnace Regent's Summons, and fixes from the class pass
The seed picks `bossVariant` for the Furnace Regent (its own salt, no run-rng draws):
- `ash`: phase 2 (Edict) is as before: two Decrees, and Ash Fall under every hero every 12 s.
- `court`: each Ash Fall comes with a **Summons**. After 2.5 s, every hero farther than 130 from him takes 70 (scaled by tier). So the party must step out of its own ash circle, then come in close to him, while two Decrees burn and must not touch the wrong hero. Tuning is in `SUMMONS`. `World.summonsT` counts down while one is pending (a scalar, so guests get it). The cast id is `summons` (castStart, then castDone and a `slam` of radius 130 when it lands).
- Ash Fall pulls the party apart and the Summons pulls it together, so the two Decrees become a problem of who stands next to whom.
- The client draws a placeholder gold ring round him while a Summons is pending, and the phase 2 banner and the boss intro (`COURT_TIP`) say what to do.
- **Name:** the first name, "Audience", was already the name of his phase 1 (raid4.md), so it became "Summons", a single plain word.
- **Bots:** a bot walks in only once it isn't standing in a circle. Without that rule the bots walked in through their ash and the court version won 0 of 38. With it, 30 of 38.

**Measured** with tools/group.ts, heroes-r2 hero-t8-0, Flue tier 11, full party, seeds 1 to 160:

| | main | This change |
|---|---|---|
| All seeds | 107 (67%) | 101 (63%, in the 55 to 70% band) |
| Ash seeds (79) | 55 | 55 |
| Court seeds (81) | 52 | 46 |

Court seeds 1 to 80 (38), by role: no healer (Bulwark, two Emberwrights, Duskblade) 9 → 2, and no tank (two Duskblades, Lumen, Emberwright) 24 → 6. The second number is from the court version. The Summons rewards a party that can stand together, so a party missing a role falls further than on main.

Tuning on the way (court seeds, of 38): radius 160 and warn 3 s won 30, and radius 120 won 32, so radius alone was noisy. Radius 130 with warn 2.5 s won 23.

**Grandmother Slag's Brimming: the Churn.** Skills' class pass (W7) found an Anvil Slagbinder tank winning 4 of 32 Brimming seeds. In the Pour version, the 1.6 s Pour cast every 6 s is the tank's breather. The Brimming had none, so she hit the tank without a pause. Now, on the Pour's timer and cast time, she **Churns** the pit (cast id `churn`): a cast with no lanes. Same seeds (the 33 Brimming seeds of 1 to 80), with the version forced (both on the same seeds):

| Party | Pour | Brimming, with the Churn |
|---|---|---|
| Base | 23 | 22 |
| Anvil Slagbinder tank | 22 | 21 |
| Base, novice bots (skill 0.5) | 20 | 17 |

QA's novice gap (Brimming 25% against Pour 100%, on different seeds) was mostly the seeds: on the same seeds the gap is 3 of 33. Novice losses are the tank dying to Ladle Pour, often from low health at the start of phase 2. Longer islands, a lower burn, or cooling Ladle Burn on an island didn't change it by more than 3. (A measuring note: an earlier Anvil row of 4 of 47 came from a run script that dropped STANCE=anvil.)

**Old Vorhulm's Banked Coals: closer coals.** Skills found Bellows with an Emberwright at 14 of 39 on Banked Coals against 26 of 40 on Ember Feast: a damage race, with the coals taking hitting time away. The coals now land 120 or 170 from him (they were 170 or 260). Seeds 1 to 40, version forced:

| Party | Ember Feast | Banked Coals before | Banked Coals now |
|---|---|---|---|
| Bellows Slagbinder with an Emberwright | 23 | 18 | 23 |
| Base | 27 | 25 | 26 |
| Bellows Slagbinder with a Duskblade | 28 | | 25 |
| Two Duskblades | | | 28 |
| Anvil tank | 36 | | 37 |

Two coals instead of three helped the Emberwright row as much (26) but made the base party too strong (33 of 40).

**The Cinder Colossus's Plate Shift: left as it is.** Skills found an Anvil tank at 25 of 51 on Plate Shift. Seeds 1 to 40, version forced: base 25 (Wheel) and 26 (Plate Shift), Anvil tank 29 and 21. Every Anvil loss wipes with him at 1 to 8%, and skills' position trace shows the Anvil and Bulwark parties standing the same way, so it is damage. Fight knobs move the base party more than the Anvil: 3% less health in this version only gave base 32 and Anvil 23, and 5% gave 33 and 23. A plate shift every 22 s gave 23 and 24. So Plate Shift stays as it is, and the Anvil gap is noted for skills.

**Ash Fall's double scaling (fixed in the next PR).** Ash Fall passed `REGENT.ashDamage * tierDamage` into `addTelegraph`, which scales it by tier again when it lands (the same double scaling as Hammer Sweep before #411). The Flue was tuned that way at tier 11, so `ashDamage` is now 70 × 1.12^10 (about 217 before tier) and scales once. At tier 11 the hit is exactly the same number (70·a·a and (70·a)·a are the same floating-point product), so nothing needs re-tuning. Above tier 11 (keys, harder tiers) it now grows by 1.12 a tier, not 1.25.

## Phase 12 W3, part 5 (built 22 Nov 2026): wider raid fight pools
Each raid used the same three openers (Warpack, Glass, Crawlers) and two named fights (Anvilguard, Bellwarden), so a raid had 12 routes. Now:

| Raid | Openers | Named | Routes |
|---|---|---|---|
| The Crucible | + Hollow Rift, Warden and Spitters | + Brute and Spitters | 60 |
| The Hoard | + Hollow Wardens, Ember Spitters | + Brute and Spitters | 60 |
| The Smeltery | + Hollow Wardens | | 24 |
| The Flue | + Hollow Wardens | | 24 |

With the boss's two versions that's 120 run shapes in the Crucible and Hoard and 48 in the Smeltery and Flue. There are still no Ashbuck charge fights in group play. tests/variety.test.ts checks every raid has at least 24 routes.

**Measured** with tools/group.ts, heroes-r2 hero-t8-0, full party, at each raid's unlock tier, main → this change:

| Raid | Seeds | main | This change |
|---|---|---|---|
| Crucible t8 | 1 to 160 | 98 | 96 |
| Hoard t9 | 1 to 160 | 99 | 97 |
| Smeltery t10 | 1 to 320 | 219 (68%) | 206 (64%), with 19500 health |
| Flue t11 | 1 to 320 | 212 | 213 |

**Why the Smeltery and Flue got only one new opener.** The first try gave them five openers and three named fights each, the same as the Crucible and Hoard. The Smeltery fell from 109 to 82 of 160 and the Flue from 101 to 65. Parties wiped before the boss in 21 and 43 runs, against 2 and 5 on main. At tiers 10 and 11 with t8 gear, the extra fights wore the party down, and the old named fights did the killing (Anvilguard 11 times in the Flue). Spitter fights also ran long into the trash clock. With Hollow Wardens as the only new opener, early wipes fell back to 1 and 4.

**The Smeltery's health.** With the wider pool the Smeltery won 229 of 320 (72%), over the band. Hollow Rift as its fourth opener instead won 235. The Colossus now has 19500 health (it was 19000), which wins 206 (19750 won 210). Skills: the Anvil Plate Shift row will move with this.

**The Flue after skills' walk-in (#457).** Bots now walk in to the throne 2 s before a Summons is due, as a player learns to. With that and the wider pool, the Flue won 236 of 320 (74%; court 118 of 162, ash 118 of 158), over the band. The Regent now has 15500 health (it was 15000): 206 of 320 (64%; court 100 of 162, ash 106 of 158). 16000 won 190 (59%). A smaller Summons ring barely mattered once the bots walk in early (seeds 1 to 160: radius 130 won 120, 110 won 118, 95 won 115), so the ring stays at 130.

## Phase 13 E1 (built 22 Nov 2026): stones and vents in raid trash
Each raid's openers and named fight now roll a layout, as the group dungeons do: `LAYOUTS.crucible`, `.hoard`, `.smeltery` and `.flue` are open, open, pillars, vents. The boss fight never rolls one (`layoutRolls`), since each boss already has floor rules of its own: islands, coals, his open back, the throne. There's no lava in group play. Stones and vents are the existing pieces (`World.stones`, `flareVents`, both in netsync), so guests get them already. Until visuals draws raid looks for them (E3), the client draws them in its default look.

**Measured** with tools/group.ts, heroes-r2 hero-t8-0, full party, seeds 1 to 320, main (#458) → this change:

| Raid | main | With layouts |
|---|---|---|
| Crucible t8 | 189 (59%) | 199 (62%) |
| Hoard t9 | 190 (59%) | 191 (60%) |
| Smeltery t10 | 206 (64%) | 205 (64%) |
| Flue t11 | 206 (64%) | 191 (60%) |

Every raid stays in the band. The Flue loses about 5 points, and parties wiped before the boss in 7 runs (4 before). That's the cost of vents at tier 11, and I've kept it.

## Phase 13 E2 (built 22 Nov 2026): the Ashvents' layouts and band
The Ashvents now roll open, open, pillars or vents for their trash, like the other group dungeons (`LAYOUTS.ashvents`). In W2 the layouts were held back because, together with the new fights, they cost 11 of 80. Measured on their own now, they cost nothing. The dungeon was also just under its band (53% at tier 8), so Ysmeret has 5800 health (she had 6200). Her vents get sound's own set (#466).

Tier 8, heroes-r2 hero-t8-0, seeds 1 to 320:

| | Wins |
|---|---|
| Full party, main | 170 (53%) |
| Full party, with layouts | 169 (53%) |
| Full party, with layouts and 5800 health | **195 (61%)** |
| No healer (Bulwark, two Emberwrights, Duskblade), 5800 | 42 (13%, under the 25% bar) |
| No tank (two Duskblades, Lumen, Emberwright), 5800 | 6 (2%) |

**Banked Coals, two coals (22 Nov 2026).** Skills re-measured after #458 and found Banked Coals harder than Ember Feast for every party (base 65 against 81 of 120). Now two coals land each time, not three (`BANK.count`). Hoard t9, seeds 1 to 120, version forced:

| Party | Ember Feast | Banked Coals, 3 coals | 2 coals |
|---|---|---|---|
| Base | 77 | 67 | 81 |
| Bellows Slagbinder with an Emberwright | 52 | | 53 |
| Bellows Slagbinder with a Duskblade | 86 | | 81 |
| Two Duskblades | 97 | | 92 |

The other knobs I tried on base: coals of radius 65 won 70 and radius 80 won 72, and a 5 s fuse won 55. Two Duskblades and a Bellows Slagbinder with a Duskblade run high in both versions, which is the class-side Z5.

## Phase 14 X1 to X3 (built 22 Nov 2026): runs that surprise
Steve, 22 Nov: "People aren't going to want to play the same dungeon multiple times with no changes." These three items add things that change during a run, not only before it. Every roll is a hash: of the day for the Heat, and of the seed with its own salt for the named foe and the arena events. So none of them draws from the run rng, and co-op guests agree with the host.

### X1: Today's Heat in every solo dungeon
- **Where:** `HEAT_POOLS` (sim/content/heat.ts) lists each solo dungeon's Heats. A dungeon has a Heat at every tier, still never on a first delve, a bounty or a key run. Group dungeons and raids have none.
  - A floor Heat goes only where that floor is in `LAYOUTS`. The Glarewell has no Stone Floor, the Coldmarrow no Vent Floor, and the Wrackline neither.
  - The Kiln's pool keeps the V4 order, so the Kiln's Heat on any day is unchanged.
- **Code:** `heatFor(day, dungeon)` picks from the dungeon's pool, and `heatFits` lets the sim drop a Heat that can't come there.
- **Own Heats**, one per later dungeon, each a give and a take on its signature mechanic (`HEAT_TUNING`):

| Heat | Dungeon | What it does |
|---|---|---|
| Thick Steam | Foundry | Temper builds faster (timer ×0.75), and vents heal twice as much per stack |
| High Sun | Glarewell | The Glare comes more often (×0.8), and pillar shadows reach farther (×1.25) |
| Bright Coal | Coldmarrow | Coal light ×1.25 wider; it burns down 15% faster |
| Slack Water | Wrackline | Rafts drift at 0.6 speed |

- **Names:** web searches on 22 Nov 2026 found no WoW match for any of the four.
- **Cut after measuring:**
  - Slack Water's faster Ebb (timer ×0.78) together with the slower rafts gave 9 of 160 against 24 at tier 13. Each on its own gave 24.
  - Bright Coal with drain ×1.3 gave 90 of 120 against 107.

**Measured** with tools/foundry.ts (`HEAT=`), good bot, geared reference heroes, wins against no Heat:

| Dungeon, tier, hero, seeds | None | Stone Floor | Vent Floor | Quick Study | Rich Haul | Own Heat |
|---|---|---|---|---|---|---|
| Foundry t4, hero-t4, 320 | 305 | 296 | 303 | 305 | 305 | Thick Steam 310 |
| Glarewell t7, hero-t6, 320 | 313 | | 307 | 313 | 314 | High Sun 310 (base 314 on this build) |
| Coldmarrow t10, hero-t8, 160 | 140 | 144 | | 140 | 140 | Bright Coal 105 of 120 (base 107) |
| Wrackline t13, hero-t8, 320 | 56 | | | 56 | 59 | Slack Water 24 of 160 (base 24) |

The Wrackline at tier 13 is only a relative check: the reference heroes stop at hero-t8.

### X2: two more named-foe affixes
The C2 named elites (named-elites.md) already had Swift, Warded and Vengeful. Two more are added:
- **Brood:** when it dies, 2 of the dungeon's pack foe come out of it (`BROOD_KIND`: Shades in the Glarewell, Rimehounds in the Coldmarrow, Shoal Lurkers in the Wrackline, Cinderhounds elsewhere).
- **Smoldering:** every 4 s it leaves a fire circle (radius 70) where it stands, landing 1.5 s later.

How they come:
- An extra draw after the C2 draws gives 40% of named foes one of the two new affixes. So where a named foe appears and what it's called don't move, and each old affix now comes on 20% of named foes instead of 33%.
- `AFFIX_TIP` adds a line to the named-foe banner. `namedPlan()` reports the named foe's position and affix ahead of time, for the run summary (X4).

**Retuned after skills' X5 screen:**
- **Warded:** shield 0.35 → 0.2 of health. Forced on every Coldmarrow t10 run, Warded cost ranged classes about half their wins, because the 2x-health Weaver plus its shield ran them into Burnout. Emberwright, 120 seeds: base 107, Warded 0.35 81, 0.2 93.
- **Blooms no longer heal a named foe.** A Swift Sluice Crawler stood in its own Blooms and healed back to full, and that was most Swift losses in the Foundry. Forced Swift, Foundry t4, before → after: Emberwright 128 → 156 of 160 (base 155), Bulwark 110 → 125 of 127 (base 123). Slowing Swift to 1.3 instead did nothing (130), so Swift keeps 1.45.

**Measured** with every delve given a named foe of that affix (`NAMEDALL=1 AFFIX=`, events off), good bot:

| Check | Base | Swift (after the Bloom fix) | Brood | Smoldering |
|---|---|---|---|---|
| Foundry t4, Emberwright, 160 | 155 | 156 | 155 | 157 |
| Foundry t4, Bulwark, 127 | 123 | 125 | 124 | 118 |
| Glarewell t7, Emberwright, 160 | 159 | 158 (before the fix) | 158 | 157 |

### X3: arena events
In 40% of solo trash fights (never the boss), one event comes 9 to 14 s in. Each is hashed per fight. Tuning is in `ARENA_EVENTS`, the pools are in `ARENA_EVENT_POOLS`, and banner copy is in `ARENA_EVENT_INFO`.

| Event | Dungeons | What happens |
|---|---|---|
| Cave-in | Kiln, Foundry, Coldmarrow | 3 circles warn for 2.2 s, hit for 26 (before tierDamage), then stones (r 30) stand there for the rest of the fight |
| Vent Surge | Kiln, Foundry, Glarewell | Every vent erupts at once after 1.8 s (a ring of 4 on floors without vents) |
| Cold Snap | Coldmarrow | After 2.5 s every hero's coal loses 0.2 warmth (0.3 measured 96 of 120; 0.2 measured 98) |
| High Water | Wrackline | The Ebb comes at once, with its own warning |

The event is `{ type: 'arenaEvent', id, stage: 'warn' | 'land' }`, and the scalars `arenaEvent`, `arenaEventStage` and `arenaEventT` sync. Tools: `ARENA=caveIn|ventSurge|coldSnap|highWater|off` in tools/foundry.ts. QA's X8 contentcheck played every event in every dungeon whose pool has it: 0 stuck, and 0 heroes trapped in a fallen stone.

**Measured** with the event forced in every trash fight that can have it, good bot:

| Check | Events off | Cave-in | Vent Surge | Own event |
|---|---|---|---|---|
| Kiln t2, default hero, 160 | 99 | 93 | 105 | |
| Foundry t4, hero-t4, 160 | 152 | 150 | 152 of 158 (base 150) | |
| Glarewell t7, hero-t6, 120 | 119 | | 116 | |
| Coldmarrow t10, hero-t8, 120 | 107 | 106 | | Cold Snap 98 |
| Wrackline t13, hero-t8, 160 | 24 | | | High Water 24 |

Live, an event is in about 40% of trash fights, split across the dungeon's pool. So the forced numbers are the worst case.

### X5 follow-up (23 Nov 2026): named foes for ranged classes
Skills' re-screen (heroes-r2, every named foe forced to Warded, seeds 41 to 200) still found two gaps. Each has a fight-side fix that matches its cause:
- **Foundry, Slagbinder (Burnout):** the 2x-health named foe outlasted the 240 s fight limit. `BURNOUT.named` = 60 gives the fight that holds the named foe 60 s more. Slagbinder 105 → 126 of 160, base 125.
- **Coldmarrow, ranged (the cold, not Burnout):** in a long fight against one 2x Weaver nothing dies, so the coal runs dry (COLD.drain 1%/s, fed only by kills) and the frozen burn kills. `COLD.namedFeed` = 0.07 feeds the hitter's coal for each tenth of a named foe's health they take, the same as a frost-touched kill. The extra Burnout time alone changed nothing here (83 → 83). Wins of 160, before → after, against base:

| Class | Before | After | Base |
|---|---|---|---|
| Emberwright | 83 | 128 | 131 |
| Slagbinder | 81 | 109 | 103 |
| Lumen | 116 | 125 | 125 |

My own check, good bot, hero-t8, Coldmarrow t10: `BURNOUT.named` 0 against 60 gave 93 and 93 of 120 on the same seeds.

### X3, part 2 (23 Nov 2026): arena events in the group dungeons
The Hammerdeep, the Ashvents and the Pressworks trash fights now roll Cave-in and Vent Surge, as the solo dungeons do: 40% of trash fights, never the boss. Raids don't roll them yet. Their trash got stones and vents in Phase 13 E1, and the raids' bands are tight.

**Measured** with tools/group.ts (`ARENA=`), the full party (Bulwark, Lumen, Duskblade, Emberwright), heroes-r2 hero-t8-0, event forced in every trash fight:

| Dungeon, tier, seeds | Events off | Cave-in | Vent Surge |
|---|---|---|---|
| Hammerdeep t8, 120 | 70 | 79 | 73 |
| Ashvents t8, 100 | 62 | 69 | 65 |
| Pressworks t10, 74 | 47 | 50 | 47 |

- **No healer** (Bulwark, Duskblade, Emberwright, Slagbinder), Hammerdeep t8, 80 seeds: 6 with events off and 6 with Cave-in. That stays well under the 25% missing-role line.
- **Sound:** each group dungeon has its own landing sounds (#493).
- Forced events don't cost a full party anything here. I haven't traced why.

## Phase 15 Y1 (built 23 Nov 2026): wave shapes

Steve: "The bosses I have fought, and the waves, have seemed pretty similar." Until now every trash fight's foes came in at once, in one arc from the far side of the arena (`startEncounter`).

Now each solo and group trash fight after the opener rolls how its wave comes in (`waveShapeAt`, a hash of the seed and the fight's place, so the run's other rolls don't move):

| Shape | Chance | What happens |
|---|---|---|
| Arc | the rest | As before: one arc from the far side |
| Pincer | 20% | Alternate foes come from the two flanks, a quarter turn either side of the far side |
| Ring | 15% | The foes form a ring 460 round the hero (a foe that would stand outside the arena waits at the wall instead, still 460 away) |
| Reinforcements | 20% | Up to half the fight's pack foes (Cinderhounds, Shades, Rimehounds, Shoal Lurkers) wait. After 7 s, or as soon as the first half is dead, a 2 s warning, then they come from a flank. The fight doesn't end while they're on the way |

Never in the opener, a boss fight, a shrine, a raid or the first delve. A fight with one foe stays an arc, and so does the Twin Lamps fight (split lamps would sweep their beam across the whole arena). Tuning is in `WAVES`; names and tips in `WAVE_SHAPE_INFO`; `World.wavesMet` holds which shapes a run met (for engineering's Seen log, Y4). Event: `{ type: 'waveShape', id, stage: 'start' | 'warn' | 'land', x, y }`. Tools: `WAVE=off` or `WAVE=pincer|ring|reinforce` in tools/foundry.ts and tools/group.ts.

**What the first build got wrong.** The first try put a pincer's second half, the ring and the reinforcements on the far side's opposite, which is the hero's own side: foes spawned on top of the hero. Glarewell with every fight forced to a pincer fell from 119 to 109 of 120, the Twin Lamps fight lost 4 runs in each of ring and pincer, and Coldmarrow's opener (four Rimehounds at level 1) killed the hero in 11 s. The flanks, the wider ring, keeping the Lamps in an arc and leaving the opener alone fixed those.

**Measured,** solo, seeds 1 to 120, the shape forced in every trash fight after the opener, then the natural rates:

| Dungeon, tier, hero | Waves off | Pincer | Ring | Reinforcements | Natural |
|---|---|---|---|---|---|
| Kiln t2, no gear | 71 | 78 | 77 | 79 | 74 |
| Foundry t4, hero-t4 | 118 | 115 | 117 | 117 | 119 |
| Glarewell t7, hero-t6 | 119 | 119 | 117 | 119 | 118 |
| Coldmarrow t10, hero-t8 | 114 | 105 | 95 | 112 | 111 |
| Wrackline t13, hero-t8 | 19 | 10 | 21 | 14 | 20 |

- A forced ring is the hardest shape in Coldmarrow (95 against 114): its Snuffers and Rimehounds close from every side at once. At the natural rate it costs 3 of 120, and that's the point of a ring. Kept.
- Wrackline t13 with t8 gear wins too few runs to read a shape from (10 to 21 of 120). The natural rate matches waves off.
- Reinforcements never cost anything: half a pack at a time is easier, but the second half comes from somewhere new.

**Group,** tools/group.ts, the full party (Bulwark, Lumen, Duskblade, Emberwright), heroes-r2 hero-t8-0, seeds 1 to 120:

| Dungeon, tier | Waves off | Pincer | Ring | Reinforcements | Natural |
|---|---|---|---|---|---|
| Hammerdeep t8 | 72 | 75 | 77 | 67 | 81 |
| Ashvents t8 | 77 | 75 | 78 | 77 | 83 |
| Pressworks t10 | 81 | 88 | 96 | 82 | 88 |

- No shape costs a full party much. A forced ring helps in the Pressworks (96 against 81). I haven't traced why.
- **No healer** (Bulwark, Duskblade, Emberwright, Slagbinder), Hammerdeep t8, 80 seeds: 7 with waves off, 7 natural, 5 forced ring, 5 forced pincer. That stays well under the 25% missing-role line.
- **Names:** Pincer, Surrounded and More Coming are plain English. A search on 23 Nov found no WoW-branded name among them.

## Phase 15 Y10 (built 23 Nov 2026): the dungeon stirs

Steve, 23 Nov: "It would be cool if the dungeons sort of adapted or adjusted difficulty as you played, if you were doing really well they like added an extra monster or something, or something happened."

**How it works** (`STIR` in sim/world.ts):
- After each trash fight, the dungeon looks at how much damage the party took: each hero's damage as a share of their own health, averaged over the party (`World.fightHurt`).
- A clean clear (at most 15%, nobody down) adds one to a hidden count. A rough one (50% or more, or a hero down) sets it back to 0. Anything in between leaves it as it is.
- Two clean clears in a row stir the next trash fight. It gets one reaction, picked by a hash of the seed and the fight's place (no run-rng draws), from the ones that fit the fight:

| Reaction | What happens |
|---|---|
| Another joins (`elite`) | One more of the fight's first elite kind comes in from the far side |
| A named foe (`named`) | The fight's first elite becomes a named foe, only if the run has none |
| The ground answers (`event`) | An arena event from the dungeon's pool, only if the fight has none |
| They close in (`wave`) | The wave comes as a pincer or a ring, only if it was an arc |

- A stirred fight drops a second loot bag at the same rarity as its clear bag.
- At most 2 a run. Never the opener or the boss. Off on the first delve, on tiers 1 to 3, in raids, and in any party with a fill bot, so a bot party can't farm it. A run that's going badly never gets harder.
- The fight banner says "The dungeon stirs." with the reaction's line. On phones it gets its own banner after the fight's.
- `World.stirsMet` holds the reactions a run met (`STIR_BIT`), for the Seen log. The event is `{ type: 'stir', id }`.
- Tools: `STIR=off` or `STIR=elite|named|event|wave|any` in tools/foundry.ts and tools/group.ts.

**Measured,** the good bot (Emberwright solo, the full party in groups), seeds 1 to 120:

| Dungeon, tier | Stir off | Natural | Stirs in 120 runs | Every fight stirred |
|---|---|---|---|---|
| Foundry t4, hero-t4 | 119 | 120 | 94 | 114 |
| Glarewell t7, hero-t6 | 118 | 115 | 72 | 103 |
| Coldmarrow t10, hero-t8 | 111 | 109 | 110 | 108 |
| Wrackline t13, hero-t8 | 20 | 18 | 30 | 11 |
| Hammerdeep t8 (group) | 81 | 81 | 119 | |
| Ashvents t8 (group) | 83 | 85 | 118 | |
| Pressworks t10 (group) | 88 | 87 | 119 | |

- The bot takes almost no damage in most trash fights (its median is 0% of its health), so it stirs about once a run. Players who take more hits will see it less, which is the point.
- **Loot:** tools/lootrate.ts, Emberwright, hero-t6, Glarewell t7, 40 seeds: items a minute 0.92 with stir off and 1.02 on, Rare or better 0.52 and 0.62. Fill with bots runs don't change, since stirring is off there.
- **Name:** "The dungeon stirs" had no WoW-branded match in a search on 23 Nov.

## Phase 15 Y2 (built 23 Nov 2026): arena events in raid trash

The raids' trash fights (openers and named fights, never the boss) now roll Cave-in and Vent Surge, as the group dungeons have since #494: 40% of trash fights, from `ARENA_EVENT_POOLS` crucible, hoard, smeltery and flue. Their trash has had stones and vents since Phase 13 E1. Each raid has its own landing sounds (#513).

**Measured** with tools/group.ts, the full party (Bulwark, Lumen, Duskblade, Emberwright), heroes-r2 hero-t8-0, seeds 1 to 160, at each raid's unlock tier. The band is 55 to 70%:

| Raid, tier | Events off | Events on (natural) |
|---|---|---|
| Crucible t8 | 94 (59%) | 88 (55%) |
| Hoard t9 | 97 (61%) | 103 (64%) |
| Smeltery t10 | 108 (68%) | 111 (69%) |
| Flue t11 | 99 (62%) | 108 (68%) |

- Every raid stays in the band. Any change to the trash reshuffles the run rng before the boss, and paired-seed swings this size are luck (horders-raid-measuring), so I read these as no change.
- The Crucible is at the bottom edge (88 of 160). If later work takes it lower, it's the first raid to retune.
- tests/audio.test.ts's real Smeltery run moved from seed 3 to seed 19. Seed 3's run changed and no longer reached Meltdown; seed 19 hears every cue the test lists.

**Y5 follow-up (23 Nov 2026): no ring of Rimehounds.** Skills' class check (seeds 41 to 200) found the ring's Coldmarrow cost was the Hoarfrost Weaver fight. On a ring, its 3 Rimehounds reached the hero from 2 or 3 sides within a second and took 405 health in 3.5 s. The Emberwright won 97 of 160 with a forced ring, against 134 with waves off, and the Duskblade 82 against 107. Healers lived through it. A bot rule to step out through the widest gap didn't help. Now a fight with 3 or more Rimehounds never forms a ring: a rolled or forced ring stays an arc, and a stir's wave reaction there is a pincer. Emberwright, hero-t8, Coldmarrow t10, seeds 1 to 120: forced ring 95 → 111, natural 111 → 112 (waves off 114).

## Phase 15 Y3 (built 23 Nov 2026): the Kiln Mother's third version, Turning Fire

The Kiln Mother had two phase-2 versions (Cataclysm and the Draw). The third is **Turning Fire** (`turning`, cast `turningFire`). In phase 2 she pours four fire cones round herself, one after another, each turned 70° from the last, the first aimed at the hero. The direction flips every pour (`w.turnDir`). The first cone lands after 2.2 s and the next ones 0.7 s apart, 40 damage each before tier scaling, 1.5x when she's enraged. While she pours, her other abilities and the Kiln Brand wait. Tuning is `KILN_TURN` in sim/world.ts. The tip says: step back against the turn.

- The Seen log picks it up from `KILN_VARIANTS` and `BOSS_VERSION_NAME`, so tests/seen.test.ts's Kiln pool went from 20 to 21.
- The bot steps sideways against the turn when it stands inside a Turning Fire cone (sim/bot.ts), the way a player reads the tell.

**Measured** with tools/foundry.ts, seeds 1 to 160, forcing each version with `BOSSV`:

| Kiln, setup | Cataclysm | The Draw | Turning Fire |
|---|---|---|---|
| t2, no gear | 107 | 106 | 105 |
| t4, hero-t4 | 156 | 155 | 152 |

- Natural rolls at t2 (all three versions): 109 of 160.
- The first build (first cone at 1.2 s, 50° cones) won 32 of 160 at t2. The cones landed before a hero could leave them. A 2.2 s lead and 70° cones brought it into line.
- **Name:** "Turning Fire" had no WoW-branded match in a search on 23 Nov.

### Y3 Maelra: Sealed Vents (built 23 Nov 2026)

Maelra had two phase-2 versions (Rising Water and the Sluicetide). The third is **Sealed Vents** (`seal`). From phase 2 only one steam vent is open, and only it boils off her Temper. Every 16 s the steam moves to another vent, never the one she stands on when another is free. The next vent pulses 2.5 s ahead, with a "The steam moves" ding. Boiling her Temper at the open vent heals 1.5x as much as a normal vent. The arena keeps its size and nothing pushes the hero. Tuning is `MAELRA_SEAL` in sim/world.ts. Events: `{type:'ventShift', stage:'warn'|'open', vent}`. Fields `w.openVent` and `w.nextVent` (-1 when off). The bot leads her to the open vent.

**Measured** with tools/foundry.ts, Foundry t4, seeds 1 to 160, each version forced with `BOSSV`:

| Setup | Rising Water | Sluicetide | Sealed Vents |
|---|---|---|---|
| hero-t4 | 157 | 159 | 156 |
| no gear | 59 | 52 | 61 |

- Natural rolls with hero-t4: 155 of 160.
- With the steam moving every 12 s, no gear won 45 and hero-t4 153. With 16 s it sits with the other two.
- Raising the heal to 2.5x changed nothing (46), so the time between moves is the knob.
- **Name:** "Sealed Vents" had no WoW-branded match in a search on 23 Nov.

### Y3 the Lensmother: Carried Light (built 23 Nov 2026)

The Lensmother had two phase-2 versions (Twin Brand and Glintfall). The third is **Carried Light** (`walk`). From phase 2 the light comes from her, not the centre lens. Each Glare moves the light to where she stands as its 2.6 s warning starts, so the shadows swing then and the hero has the whole warning to put a pillar between them and her. She casts no Twin Brand in this version. A pillar within 40 px of the light casts no shadow (`CARRIED_LIGHT.minD`). Fields `w.lightX` and `w.lightY` (0, 0 is the centre lens), event `{type:'lightMove', x, y}`. `World.shadowed`, the drawn wedges and the bot's shade spot all use the light's position.

**Measured** with tools/foundry.ts, Glarewell t7, seeds 1 to 160, each version forced with `BOSSV`:

| Setup | Twin Brand | Glintfall | Carried Light |
|---|---|---|---|
| hero-t6 | 152 | 159 | 159 |
| hero-t4 | 122 | 149 | 147 |

- Natural rolls: 157 of 160 with hero-t6, 138 with hero-t4.
- Carried Light sits with Glintfall. Twin Brand stays the hardest of the three, as before.
- **Name:** first called Walking Light, which is too close to WoW's "Walk in the Light" and "Walk Into Light", so renamed. "Carried Light" had no WoW match in a search on 23 Nov.

### Y10 follow-up (23 Nov 2026): a fair stir for melee classes, and parties judged by their worst hero

Skills' Y10 check found two problems. In the Foundry the melee classes almost never stirred (Bulwark 13 of 80, Duskblade 23, against 49 to 60 for the others). In group dungeons nearly every run stirred, whatever the party (74 to 80 of 80).

**Changes**
- Each hero's loss in a fight is tracked on its own (`Player.stirHurt`). The fight is judged by the worst-off hero.
- Each hero is judged against their own class bar, `STIR_CLASS`. The Bulwark and the Duskblade trade hits in melee, so their clean and rough bars are 2x. The loosened rough bar never goes past 80% of max health (`STIR.roughMax`).
- A party fight is clean only under 0.15 x 0.35, which is about 5% of a hero's health (`STIR.groupClean`). Even half-skill bot parties stayed under 0.15 in almost every trash fight.
- tools/foundry.ts and tools/group.ts take `STIRHURT=1`, which prints the judged cost of each trash fight as percentiles.

**Per-fight cost** (`STIRHURT=1`, heroes-r2, seeds 41 to 120). This is the share of trash fights after the opener with at most 0.15 lost, before the change:

| Class | Kiln t6 | Foundry t6 | Glarewell t8 | Coldmarrow t10 |
|---|---|---|---|---|
| Emberwright | 214/240 | 151/228 | 151/228 | 205/230 |
| Duskblade | 155/237 | 70/228 | 103/234 | 181/232 |
| Bulwark | 137/240 | 60/226 | 133/222 | 148/229 |
| Lumen | 198/237 | 157/237 | 135/238 | 207/231 |
| Slagbinder | 211/240 | 166/195 | 181/240 | 185/240 |

**Runs that stirred, out of 80** (same seeds), before and after:

| Class | Kiln t6 | Foundry t6 | Glarewell t8 | Coldmarrow t10 |
|---|---|---|---|---|
| Emberwright | 74 / 74 | 49 / 49 | 61 / 61 | 75 / 76 |
| Duskblade | 63 / 73 | 23 / 50 | 37 / 64 | 77 / 77 |
| Bulwark | 62 / 80 | 13 / 48 | 46 / 72 | 62 / 73 |
| Lumen | 73 / 73 | 49 / 49 | 39 / 39 | 72 / 73 |
| Slagbinder | 76 / 76 | 60 / 60 | 76 / 76 | 72 / 72 |

Win rates moved by at most 5 of 80 in any cell (Glarewell Duskblade 70 to 65). The Lumen still trails in the Glarewell (39). Its trash fights cost little most of the time but a lot when they go wrong (75th percentile 57% of health), so a class multiplier doesn't fit it. I've left it as a watch item.

**Groups**, with the full party (Bulwark, Lumen, Duskblade, Emberwright), heroes-r2 hero-t8-0, seeds 41 to 120. Each cell gives the runs that stirred and the wins, out of 80:

| Dungeon | Before | Worst hero only | Plus groupClean 0.35 | Half-skill bots (SKILL=0.5), before / after |
|---|---|---|---|---|
| Hammerdeep t8 | skills: 74 to 80 | 79, 50 wins | 54, 48 wins | 76 / 46 |
| Ashvents t8 | skills: 74 to 80 | 74, 52 wins | 29, 54 wins | - |
| Pressworks t10 | skills: 74 to 80 | 73, 55 wins | 29, 63 wins | 66 / 20 |

- Judging by the worst hero alone changed little, because a bot party's tank and healer keep everyone's trash cost low. Worst-hero cost on Hammerdeep (seeds 41 to 70): median 0, 90th percentile 9%. The tighter group bar is what makes a stir depend on how well the party plays.
- The Pressworks went from 55 to 63 wins, since fewer stirred fights mean fewer extra elites. That's a watch item for its next retune.

**Y5 ring follow-up: the Two Weavers.** Skills found that the Emberwright's ring deaths in the Coldmarrow had moved to the Two Weavers fight (two Weavers, two Rimehounds). Weavers now count toward the threshold: a fight with at least one Rimehound, and 3 or more Rimehounds and Hoarfrost Weavers together, never forms a ring. Emberwright, heroes-r2 hero-t8-0, Coldmarrow t10, seeds 41 to 200: forced ring went from 103 to 113 (skills' number before, mine after), and natural is 114 both times. So the rest of the natural gap to waves off (126 in skills' run) doesn't come from the ring.

**Acolytes stay inside the wall** (QA's note). A ward near the wall swung its acolytes outside the arena, out of reach. Their circling position is now clamped inside. Kiln t6, heroes-r2, seeds 41 to 120, with the new stir rules, wins before and after the clamp: Emberwright 52 / 51, Duskblade 44 / 46, Bulwark 63 / 62, Lumen 78 / 79, Slagbinder 52 / 52.

**Sealed Vents fix (23 Nov 2026, after skills' Y5).** In skills' class check (seeds 41 to 200), the Bulwark at t6 won 49 of 160 on Sealed Vents, against 131 on Rising Water. It fought her 204 s against 161 and boiled her less often. Her Temper also stayed high: in my runs it averaged 2.4 stacks against 1.0 on Rising Water, so she took less damage for longer. Three changes, all in `MAELRA_SEAL`:
- The open vent boils her from 1.6x its radius (`wide`).
- The steam moves to the free vent nearest her (`near`).
- Her Temper builds 1.5x slower in this version (`temperSlow`).

The Bulwark was the worst case, so I measured it on heroes-r2 hero-t6-0 at Foundry t6, seeds 41 to 120. Wins out of 80, against 62 on Rising Water:

| Change | Bulwark |
|---|---|
| Before | 23 |
| Nearest vent | 27 |
| 1.6x radius | 36 |
| Every 24 s | 31 |
| Nearest + 1.6x | 37 |
| Temper 1.5x slower | 33 |
| Temper 2x slower | 40 |
| **Nearest + 1.6x + Temper 1.5x slower (shipped)** | **52** |
| Nearest + 1.6x + Temper 2x slower | 55 |

- The Emberwright, same setup: 62 before, 65 after (Rising Water 63).
- Foundry t4, seeds 1 to 160: hero-t4 156 (unchanged), no gear 55 (Rising Water 59, Sluicetide 52).
- Skills will add a stronger melee vent lead to the bot on top of this. Their test of it alone gave +6 of 80.
- QA's note: the steam clock lives in runMaelra, which doesn't run while she casts. So the warning can run past 2.5 s, but it always comes before the move.

### Y3 Nhevra: Creeping Rime (built 23 Nov 2026)

Nhevra had two phase-2 versions, Thin Ice and Emberdrift. The third is **Creeping Rime** (`rime`).
- When phase 2 starts, a patch of rime 85 px across rises under her. It creeps after the nearest living hero at 48 px/s, slower than any hero walks.
- Inside it, a coal loses 0.05 warmth a second on top of the usual drain, and Chill builds 1.5 stacks a second. While the coal still burns, Chill falls faster than that (2 a second), so in practice the Chill only bites once the coal is out.
- There is no Thin Ice in this version. The Long Night keeps its phase-2 pace.
- Tuning is `CREEPING_RIME` in sim/world.ts. Fields `w.rimeOn`, `w.rimeX` and `w.rimeY`, all scalars. Event `{type:'rimeRise', x, y}`.
- The bot keeps clear of the patch.

**Measured** with tools/foundry.ts at Coldmarrow t10, seeds 1 to 160, each version forced with `BOSSV`:

| Setup | Thin Ice | Emberdrift | Creeping Rime |
|---|---|---|---|
| hero-t8 | 144 | 156 | 150 |
| hero-t6 | 81 | 113 | 106 |

- Creeping Rime sits between the other two. Thin Ice stays the hardest.
- **Name:** "Creeping Rime" had no WoW match in a search on 23 Nov ("Rime" alone is a WoW page, but it's a single plain word).

### Y3 Hessa: the Whirl (built 23 Nov 2026)

Hessa had two phase-2 versions, Riptide and the Outsurge. The third is **the Whirl** (`whirl`).
- From phase 2, each Ebb swirls round the drain instead of only pulling in.
- A hero off a raft is carried round at 0.6x their class speed and pulled in at half the usual rate.
- The direction flips every Ebb (`w.whirlDir`), so the safe way to wade to a raft changes each time. The Ebb's cast is named "The Whirl".
- Foes in the water swirl too.
- Anvil Skin still anchors the Bulwark.
- Rafts drift at their normal speed. Riptide's faster drift doesn't apply in this version.
- Tuning is `WHIRL` in sim/world.ts.
- The client has a placeholder: streaks run round the drain in the direction of the turn.

**Measured** with tools/foundry.ts, hero-t8, seeds 1 to 160, each version forced with `BOSSV`:

| Setup | Riptide | Outsurge | The Whirl |
|---|---|---|---|
| Wrackline t10 | 144 | 144 | 143 |
| Wrackline t13 | 21 | 25 | 27 |

- At tier 10, one run of 160 was lost to Hessa (Whirl). The other losses came before her. Tier 13 is only a relative check, because the reference heroes stop at hero-t8, and with hero-t6 every version won 0.
- As with the Outsurge, the bots ride a raft through every Ebb, so the bot numbers barely tell the versions apart. For a person, the Whirl changes which way to wade.
- **Name:** a search on 23 Nov found no WoW spell named just "Whirl". WoW has compounds such as Fire Whirl, Grievous Whirl and Whirlwind, so "Whirl" falls under the single-plain-word rule.


### Y3 Ondrel: the Homeward Hammer (built 23 Nov 2026)

Ondrel (the Hammerdeep) had two versions on the Choir's timer: the Choir of Iron (every hero hurt) and Ironload (stack to share a mark). The third is **the Homeward Hammer** (`home`, tuning in `HOMEWARD`, sim/world.ts). It is a movement check where the other two are a healing check and a stacking check.

- On the Choir's timer he throws his hammer at the hero farthest from him. A circle (`radius` 75) lands there after `fall` 1.8 s for `damage` 70.
- As it lands, it rings through the floor: every hero loses `ring` 8% of max health, growing by the Choir's 2% a throw. Without this ring the version was far too easy (see below), and it keeps the healer's job.
- Then it flies straight back to his hand: a line from where it lay to him (`width` 40 px either side) lands after `back` 1.2 s for `backDamage` 60.
- Each throw hits `grow` 8% harder. While the hammer is out he makes no Hammer Sweep.
- The throw targets the farthest hero, so the ranged heroes learn to step out, then sideways off the line home.

Hammerdeep tier 8, heroes-r2 hero-t8-0, the base party (Bulwark, Lumen, Duskblade, Emberwright), seeds 1 to 80, each version forced (`BOSSV`, now read by tools/group.ts too):

| Setup | Choir of Iron | Ironload | Homeward Hammer |
|---|---|---|---|
| Full-skill bots | 47 | 48 | 49 |
| Half-skill bots (`SKILL=0.5`) | 46 | 49 | 49 |
| No healer (Slagbinder for the Lumen), seeds 1 to 40 | 2 | 1 | 3 |

- First build, with no ring: 77 of 80. A ring of 8% gave 49, 12% gave 44, 16% gave 37.
- The bots step out of every throw and line: with the circle or the line set to 2000 damage, no hero died to either (25 and 27 of 40, the same as normal). So the sim only measures the ring and the lost Sweeps. For a person, the throw and the line are the new part.
- **Name:** searches on 23 Nov found WoW NPC spells named Hammer Throw and Throw Hammer, so those were avoided. "Homeward Hammer" found no WoW match.

### Y10 follow-up 2 (23 Nov 2026): Anvil parties stir more, and that is kept

Skills' re-run of #532 found that a party with an Anvil Slagbinder tank stirs 2 to 3 times as often as one with a Bulwark (Hammerdeep / Ashvents / Pressworks: 76 / 76 / 67 of 80, against 54 / 29 / 29). `STIRHURT=1` in tools/group.ts now also tallies which hero was worst off in each cleared fight (`World.fightWorst`), to trace it. Seeds 41 to 120, heroes-r2 hero-t8-0; Hammerdeep t8, Ashvents t6, Pressworks t10:

| Party | Fights where nobody was hurt | Worst hero (most often) | Runs that stirred |
|---|---|---|---|
| Bulwark tank, Hammerdeep | 138 of 320 | Bulwark 131 | 54 |
| Anvil tank, Hammerdeep | 227 of 320 | Duskblade 62 (Anvil 4) | 76 |
| Bulwark tank, Pressworks | 115 of 320 | Bulwark 154 | 29 |
| Anvil tank, Pressworks | 209 of 320 | Duskblade 72 (Anvil 3) | 67 |

- A tank bar for the Anvil would change nothing: the Anvil is almost never the worst hero. In most Anvil fights no hero loses any health at all.
- Counting health that the Anvil's plating soaks as damage was tried. It only moved Hammerdeep 76 to 73 and Pressworks 67 to 65, so it was dropped.
- The extra stirs do not cost the Anvil party wins. With the stir off, Anvil parties won 45 (Hammerdeep) and 36 (Pressworks), against 48 and 39 with it on. Bulwark parties won 47 and 63 with it off, against 48 and 63 on.
- **Kept as it is.** The Anvil party does clear trash cleanly, which is what the stir answers. The Pressworks win gap between the Anvil and the Bulwark (36 and 63 with the stir off) is a class question, so it went to skills.
### Y3 Ysmeret: Rolling Vents (built 23 Nov 2026)

Ysmeret (the Ashvents) had Twin Vents (two circles to split for) and Wandering Vents (the two circles drift round her). The third is **Rolling Vents** (`roll`, tuning in `ROLLING`, sim/world.ts).

- She opens one vent at a time, `count` 3 in a row. The first opens where a Twin Vent would, on the usual 4 s fuse.
- As each closes, the next opens `step` 120 degrees further round her, on a shorter `fuse` of 3.4 s. The way round flips every cast (`World.rollDir`).
- Scatter Embers can come while a vent is open (`scatterDuring`). In the other two versions it waits for the vents. So the party gathers in one circle, then has to spread out of it.
- A missed vent blasts every hero and spawns ashlings, as before. Each new vent fires `{type:'ventRoll', x, y, left}`.

Ashvents tier 8, heroes-r2 hero-t8-0, the base party, seeds 1 to 80, each version forced:

| Setup | Twin Vents | Wandering Vents | Rolling Vents |
|---|---|---|---|
| Full-skill bots | 54 | 54 | 51 |
| Half-skill bots | 52 | 53 | 47 |
| No healer (Slagbinder for the Lumen), seeds 1 to 40 | 7 | — | 5 |

- **Tuning steps:**
  - With Scatter held back and a 2.8 s fuse it won 71: everyone ran to each vent together, and nobody had to spread.
  - A 2.2 s fuse gave 72, and 4 vents gave 64.
  - Letting Scatter come during the roll gave 46 at a 2.8 s fuse, 54 with 2 vents, and 51 at 3.4 s with 3 vents. The last one was kept.
- **Name:** a search on 23 Nov found no WoW match for "Rolling Vents". WoW has a "Steam Vent", which is a different phrase.

### Creeping Rime fix (23 Nov 2026): her body holds the rime off

Skills' class check on #534 (seeds 41 to 200, out of 160) found Creeping Rime far too hard for melee. Ice / drift / rime: Duskblade 63 / 126 / 19, Bulwark 104 / 139 / 39. The rime rises under her and creeps after the nearest hero, and a melee hero is always nearest, standing at her side.

- **The fix:** the rime is now held `hold` 85 px past her edge. When it would creep through her, it slides round her toward the hero instead, at its usual speed (`orbit` 1). When it first rises, it comes out on the hero's side.
  - So a melee hero has to keep stepping round her, away from it.
  - A ranged hero is chased across the floor as before.
- **Bot:** a melee hero within 120 px of her edge, with the rime near, steps on round her away from it (weight 0.5; `RIMEROUND=0` turns it off for measuring).

Coldmarrow tier 10, heroes-r2 `<class>/hero-t8-0`, seeds 41 to 120, out of 80:

| Class | Thin Ice | Emberdrift | Rime before | Rime now |
|---|---|---|---|---|
| Duskblade | 34 | 65 | 11 | 54 |
| Bulwark | 52 | 67 | 19 | 44 |
| Slagbinder | 37 | 73 | — | 40 |
| Emberwright | 54 | 66 | 66 | 66 |
| Lumen | 48 | 69 | — | 60 |

- **Tried and dropped:**
  - A slower creep (30 px/s) took the Duskblade to 52 but the Bulwark only to 29.
  - A smaller patch (r 70) gave the Duskblade 22 and the Bulwark 26.
  - A plain radial push-out (it stalled when the hero stood straight across from it) gave the Bulwark 54, but only through that stall.
  - A slower slide round her (`orbit` 0.5 or 0.7) changed nothing beyond noise.
  - A wider gap (`hold` 130) made it worse: Bulwark 22, Duskblade 19.
- Skills will re-run all five classes on 160 seeds.

### Homeward Hammer follow-up (23 Nov 2026): a lighter ring

Skills' Hammerdeep sweep on #541 (seeds 41 to 200, out of 160, choir / load / home) found the Homeward Hammer was the hard version for two parties: two Duskblades 95 / 86 / 66 and Bellows 97 / 71 / 73. The base party was level (95 / 96 / 95).

- **Traced:** in the two-Duskblade party (Bulwark, Lumen, two Duskblades; seeds 41 to 120), the ring is the cause.
  - Ring 0 gave 66 of 80, 6% gave 39, and 8% gave 33. Ironload and the Choir both gave 45.
  - Taking the throw and the return line's damage away left it at 33.
  - Stopping the return line short of his body gave 31.
- **The fix:** `HOMEWARD.ring` goes from 0.08 to 0.05.

Hammerdeep t8, seeds 41 to 120, out of 80:

| Party | Choir | Ironload | Home, ring 8% | Home, ring 5% |
|---|---|---|---|---|
| Base (Bulwark, Lumen, Duskblade, Emberwright) | 48 | 48 | 48 | 52 |
| Two Duskblades (Bulwark, Lumen, Duskblade, Duskblade) | 45 | 45 | 33 | 42 |
| Bellows (Bulwark, Lumen, Slagbinder, Emberwright) | 41 | — | 35 | 46 |

- With no healer (Slagbinder for the Lumen, seeds 1 to 40) it now wins 9 of 40, against 3 at 8% (Choir 2, Ironload 1). So it still needs a healer, though less than the Choir does.

### Y3 Oskel: Punch Line (built 23 Nov 2026)

Oskel (the Pressworks) had Rivets (a ring under every hero) and Die Cut (half the floor at once) on the Rivets timer. The third is **Punch Line** (`punch`, tuning in `PUNCH`, sim/world.ts).

- Every `every` 7 s, `rows` 3 rows of punches run out from his feet, evenly spaced round him. One row goes through a random living hero.
- While a Downstroke plate is open, the plate sits midway between two rows instead, so its taker is safe.
- Each row is `n` 6 circles of `r` 65, `gap` 90 apart, for `damage` 35. The nearest lands after `first` 1.4 s and each one further out `step` 0.25 s later, so the punches march out across the floor.
- A hero steps off the line, or crosses it just behind a punch.

Pressworks tier 10, heroes-r2 hero-t8-0, the base party, seeds 1 to 80, each version forced:

| Setup | Rivets | Die Cut | Punch Line |
|---|---|---|---|
| Full-skill bots | 64 | 55 | 58 |
| Half-skill bots | 52 | 55 | 55 |

- **Tuning steps:**
  - Two rows of r 50 every 9 s gave 70.
  - Three rows gave 64 when a plate was placed square to one row. A row could then clip the plate's edge, so that placement was dropped, and the version went back to 70.
  - Every 7 s gave 65, r 65 gave 64, and a faster march (1.1 s first, 0.2 s step) gave 65. Every 7 s with r 65 together gave 58, which was kept.
- The bots step out of the punches, so the sim mostly measures the time spent moving. Up to 18 circles fit in the 24-telegraph pool, beside the plate.
- **Name:** searches on 23 Nov found no WoW ability called "Punch Line".

### Punch Line fix (23 Nov 2026): wider punches further out

Skills' sweep on #554 (seeds 41 to 200, out of 160, band 88 to 112) found Punch Line split by range. Two Emberwrights won 150 and Bellows 141, but Two Duskblades won only 78. Melee heroes under Oskel lost uptime stepping out of the first punches, while ranged heroes stood off.

- **The fix:** the nth punch out now has radius `r` 55 + `grow` 6 x n, so 55 at his feet and 85 at the far end. Before, every punch had radius 65.
- Pressworks t10, heroes-r2 hero-t8-0, seeds 41 to 120, BOSSV=punch, wins out of 80:

| Party | Before (r 65) | r 50 + 8 x n | r 55 + 6 x n (kept) | Kept, plus 7 punches, 0.18 s step |
|---|---|---|---|---|
| Base | 56 | 58 | 57 | 56 |
| Two Duskblades | 32 | 47 | 50 | 41 |
| Two Emberwrights | 76 | 78 | 77 | 76 |
| Bellows | 71 | 77 | 75 | 76 |

- Wider punches far out didn't touch the ranged parties: the bots dodge them, and a faster, longer march only hurt the melee party. Ranged parties are high across the Pressworks (skills had them at 129 to 132 of 160 on Rivets too), so that is a dungeon-wide watch item, not Punch Line's.

### Creeping Rime fix 2 (23 Nov 2026): no jump when she walks into it

QA on #550 found that Nhevra could walk into the held rime (as close as 90 px). On the next tick it snapped to the hero's side, a jump of 110 to 173 px (51 to 103 degrees round her), 8 times in 16 solo runs.

- **The fix:** it now comes out on the hero's side only on the tick it rises. After that, when she walks into it, it is pushed out along its own angle and slides round at its usual speed.
- Coldmarrow t10, seeds 41 to 120: Bulwark 44 to 54 of 80 (Thin Ice 52), Duskblade 54 (ice 34, drift 65).
- QA also saw Rolling Vents win 12 of 24 against 23 for Twin Vents, at tier 6 with hero-t6 gear. On 80 seeds at tier 6 (hero-t6-0) they are level: roll 72, still 72, wander 73. So that was a small-sample gap.

### Y3 Grandmother Slag: the Overflow (built 23 Nov 2026)

Grandmother Slag (the Crucible, raid 1) had two phase-2 versions: the Pour's molten lanes and the Brimming's cooling islands. The third is **the Overflow** (`flow`, tuning in `OVERFLOW`, sim/world.ts). Where the Brimming spreads the raid onto islands, the Overflow pulls it in to her.

- In phase 2 the pit overflows from the rim every `every` 14 s (the first after `first` 4 s).
- After a `warn` 2.5 s warning it rises for `last` 4 s. Every hero farther than `safeR` 190 px from her burns `burn` 3% of max health every `tick` 0.5 s. Close to her, nothing.
- Between floods, the party heat burns `heat` 3.5% every SLAG.heatEvery s (the Pour's is 3%).
- She churns on the Pour's timer, as in the Brimming, so the tank keeps the Pour's pause. There are no lanes and no islands.
- New state: `World.flowStage` (0 still, 1 warning, 2 risen) and `flowT`. New event `{type:'overflow', stage:'warn'|'rise'|'ebb'}`.
- Bot: while it warns or has risen, a hero farther than safeR − 45 heads in to her (`NOFLOW=1` turns this off for measuring).
- Client: a placeholder ring at safeR while it warns, and molten slag outside it while it has risen.

Crucible tier 8, heroes-r2 hero-t8-0, each version forced:

| Setup | The Pour | The Brimming | The Overflow |
|---|---|---|---|
| Base party, seeds 1 to 80 | 43 | 48 | 45 |
| Half-skill bots, seeds 41 to 120 | 50 | 48 | 53 |
| Anvil party, seeds 41 to 120 | 48 | 51 | 59 |

- **Tuning steps:**
  - With the Pour's 3% heat it won 56. At 4% it won 36, at 5% 18, and 3.5% (kept) gave 45.
  - A tighter safe ring (160) gave 54, floods every 11 s gave 53, and both together 56.
- Without the bots gathering in (`NOFLOW=1`) it won 13 of 80, so the flood is the real check.
- The Anvil party is 8 to 11 above its other versions: a watch item for skills' raid sweep.
- **Name:** a search on 23 Nov turned up WoW compounds such as "Sanguine Overflow", and no spell called just "Overflow" in its results. "The Overflow" is a single plain word.

### Y3 Old Vorhulm: Inhale (built 23 Nov 2026)

Old Vorhulm (the Hoard, raid 2) had two phase-3 versions: Ember Feast's embers to grab and Banked Coals' gold circles to stand on. The third is **Inhale** (`inhale`, tuning in `INHALE`, sim/world.ts). Both older versions send heroes out to something on the floor. Inhale pulls them in, and the job is to walk out.

- In phase 3, on Ember Spill's timer (COAL.spillEvery 10 s), he casts Inhale in place of the embers. There are no embers.
- After a `warn` 1.5 s warning he breathes in for `time` 3 s. Every hero is drawn toward him at `pull` 0.3 of their class speed. A Bulwark under Anvil Skin is anchored, as against the Ebb.
- Anyone within `bite` 40 px of his edge is bitten every `tick` 0.5 s for `damage` 8% of max health. A swallowed hero is skipped.
- New state: `World.inhaleStage` (0 quiet, 1 warning, 2 drawing), `inhaleT` and `inhaleTickT`. New event `{type:'inhale', stage:'warn'|'draw'|'end'}`.
- Bot: while he warns or draws, a hero within his mouth plus 90 px walks straight away from him (`NOINHALE=1` turns this off for measuring).
- Client: `INHALE_TIP`, a phase-3 banner, `BOSS_VERSION_NAME.inhale`, and a placeholder ring at his mouth's reach with streaks drawn in toward him (2D floor layer, `flowGfx`).

Hoard tier 9, heroes-r2 hero-t8-0, each version forced:

| Setup | Ember Feast | Banked Coals | Inhale |
|---|---|---|---|
| Base party, seeds 1 to 80 | 58 | 50 | 56 |
| Half-skill bots, seeds 41 to 120 | 43 | 38 | 38 |
| Anvil party, seeds 41 to 120 | 73 | 74 | 74 |

- **Tuning steps** (base / half skill):
  - The first build had a bite that also healed him 1% of his health. At pull 0.45 and 6% bites it won 45 of 80. At pull 0.38 it won 51, but half-skill bots won only 14.
  - The losses were a damage race in phase 3: he ended them at 2% to 23%. Without the heal, pull 0.38 gave 53 / 38. Pull 0.3 with 8% bites (kept) gave 56 / 38.
  - A longer breath (4 s at pull 0.3) gave 44 / 5, so the breath stays at 3 s.
- Without the bots walking out (`NOINHALE=1`) it wins 24 of 80, so the walk-out is the real check.
- **Name:** WoW has a spell called "Inhale" (wowhead spell 153721). It is a single plain word, which Steve's rule allows (21 Nov). The cast is shown as "Inhale".
- **Overflow timing fix (QA's nit on #558):** the Overflow's stage changes now add to `flowT` instead of setting it, so each stage keeps the leftover part of the tick. Warnings were 14.07 s apart and are now 14 s. Inhale's warning-to-draw step does the same. The Overflow's base result is unchanged at 45 of 80.

### Y3 the Cinder Colossus: Millstone (built 23 Nov 2026)

The Cinder Colossus (the Smeltery, raid 3) had two phase-2 versions on the Wheel's timer: the Wheel (he turns on whoever hurts him most and sweeps) and Plate Shift (his plate slides round to them). The third is **Millstone** (`mill`, tuning in `MILL`, sim/world.ts). Both older versions move his open back once. Millstone keeps it moving.

- On the Wheel's timer (COLO.wheelEvery 16 s, the same 2 s cast) he casts Millstone. Then he grinds round on the spot for `time` 6 s, turning `turn` 0.9 radians a second one way, picked at random, and ignoring the tank.
- Slag pours off him all round. Every `tick` 0.5 s, a non-tank hero within `range` 200 px of his edge and within `arc` 2.1 radians of his facing takes `damage` 8% of max health. That covers everything but his open back.
- His open back turns with him, so the damage dealers walk round with it, or step well clear. There is no Slag Sweep while he grinds, and he turns back toward his target when it ends.
- New state: `World.millT`, `millDir` (+1 or -1) and `millTickT`. New event `{type:'millstone', stage:'start'|'end', dir}`.
- Bot: a non-tank in the burn, or just ahead of it, gets clear. Close in, it walks round the way he turns. Further out, where his edge turns faster than a hero walks, it steps out of reach. `NOMILL=1` turns this off for measuring.
- Client: `MILLSTONE_TIP`, a phase-2 banner, `BOSS_VERSION_NAME.mill`, and a placeholder wedge of slag round him while he grinds (2D floor layer, `flowGfx`).

Smeltery tier 10, heroes-r2 hero-t8-0, each version forced:

| Setup | Wheel | Plate Shift | Millstone |
|---|---|---|---|
| Base party, seeds 1 to 80 | 54 | 58 | 57 |
| Half-skill bots, seeds 41 to 120 | 58 | 53 | 51 |
| Anvil party, seeds 41 to 120 | 60 | 54 | 57 |

- **Tuning steps:**
  - The first build burned only his front (arc pi/3, 4%). It won 59, and 60 without the bots dodging. The flanking bots already stood at his back, so it hit almost nobody, even at 10%.
  - The bot's walk-round also couldn't keep a ranged hero ahead of his edge at 230 px. Stepping out of reach fixed that.
  - Burning everything but his back (arc 2.1): 4% won 61 (54 without the dodge), 6% 58, 8% (kept) 57, 10% 55. A faster turn (1.2) didn't change it.
- Without the bots getting clear (`NOMILL=1`) it wins 42 of 80.
- **Name:** a search on 23 Nov found no WoW spell called "Millstone". It is a single plain word.
- tests/audio.test.ts: the Smeltery fight test's seed 19 now rolls Millstone, so the test pins its Wheel run.
- **Timing (QA on #575):** the Wheel's 16 s timer stops while he casts and grinds, so Millstones come about 29.5 s apart (median), against 25 s for the Wheel. The results above were measured that way.

### Y3 the Furnace Regent: Tithe (built 23 Nov 2026)

The Furnace Regent (the Flue, raid 4) had two phase-2 versions on Ash Fall's timer: Ash Fall (a circle under every hero, so spread out) and the Summons (come close to him). The third is **Tithe** (`tithe`, tuning in `TITHE`, sim/world.ts). Ash Fall spreads the party, and the Summons gathers it on him. Tithe gathers it somewhere else.

- On Ash Fall's timer (REGENT.ashEvery 12 s), he demands a Tithe in place of the ash. A gold circle of `r` 80 lands `dist` 240 px from him on a random side (kept inside the arena), after `fuse` 4 s.
- If at least `need` 2 heroes stand in it, they share the tithe: each takes `cost` 65% of max health, split between them. Four heroes take about 16% each, and two take about 33%. If fewer than 2 are in it, every hero pays `miss` 35%.
- The Decrees go on as before, two at once in phase 2. A holder who joins the tithe scorches the others standing close.
- New event `{type:'tithe', ok, n}` as the circle lands (plus the usual `soak`). The circle is a soak telegraph with owner -5, drawn like every gold circle, so it needs no new placeholder.
- Bot: every hero runs into the gold circle, like any soak (`NOTITHE=1` makes them ignore it, for measuring).
- Client: `TITHE_TIP`, a phase-2 banner, and `BOSS_VERSION_NAME.tithe`.

Flue tier 11, heroes-r2 hero-t8-0, each version forced:

| Setup | Ash Fall | Summons | Tithe |
|---|---|---|---|
| Base party, seeds 1 to 80 | 55 | 55 | 55 |
| Half-skill bots, seeds 41 to 120 | 44 | 56 | 50 |
| Anvil party, seeds 41 to 120 | 51 | 54 | 48 |

- **Tuning steps** (base / half skill / Anvil): a 60% tithe won 59 / 58 / 53, and 65% (kept) 55 / 50 / 48. It is steep above that: 80% won 27 and 100% won 6.
- Without the bots answering it (`NOTITHE=1`, measured at 60%) it won 0 of 80.
- **Name:** "Tithe" turns up in WoW (a warcraft.wiki.gg page called Tithe, and a spell called "Scouring Tithe"). It is a single plain word, which Steve's rule allows (21 Nov).
- **Fix (QA on #579):** a hero alone in the gold circle used to read as a made soak. The client showed the gold blast and played the made-soak sound, and that hero got the Relayer buff and the Ventwalker 3-piece heal, while everyone paid 35%. A Tithe now only counts as made with `TITHE.need` heroes in it, and a missed one reads "Tithe unpaid!".

## Phase 16 U1: the Kiln Mother's echo

From tier 8 (`ECHO.minTier`), the Kiln Mother's last phase also borrows the signature of one version this run didn't roll. A Draw run can now end with Turning Fire in the mix, so the same version can end two ways.

- **The pick:** `rollEcho` hashes the seed (no run-rng draws) over the versions other than the rolled one. There's no echo below tier 8, on the first delve (always tier 1), or in stress runs.
- **The timer:** in phase 3 her signatures alternate, her own and then the echo's. She casts one every 12 s in phase 3, so the echo comes every 24 s. Phase 2 never echoes.
- New event `{type:'echo', id}` when she casts the echo, followed by the echo's own cast events. The cue is a placeholder (`return null`) until sound adds one.
- **Client:** the phase-3 banner reads "She casts faster, and echoes Turning Fire" (or whichever echo it is, from `BOSS_VERSION_NAME`).
- **Tools:** `ECHO=off` turns echoes off, and `ECHO=<id>` forces one (if it isn't the rolled version), in tools/foundry.ts and tools/group.ts.

Solo Kiln at tier 8, heroes-r2 hero-t8-0, seeds 1 to 80, wins out of 80:

| Class | Echo on | Echo off |
|---|---|---|
| Bulwark | 48 | 50 |
| Duskblade | 29 | 29 |
| Emberwright | 46 | 47 |
| Lumen | 56 | 55 |
| Slagbinder | 51 | 48 |

Every class is within 3 wins of echoes off. In the Bulwark logs all 80 runs reached her (every one shows her Molten Cataclysm).

## Phase 16 U1: Maelra's echo

Maelra's versions are lasting effects, not single casts, so her echo comes and goes in windows. From tier 8, in her last phase, the echo is on for `MAELRA_ECHO.on` 12 s, then off for `off` 10 s. The first window starts `first` 2 s into phase 3.

- **Which versions echo:** only the Sluicetide and Sealed Vents (`MAELRA_ECHOES`). The water already rises in every version but the Sluicetide, so a Rising Water echo would change nothing. A Rising Water run echoes one of the two, picked from the seed. A Sluicetide run echoes Sealed Vents, and a Sealed Vents run echoes the Sluicetide.
- **Sealed Vents echo:** while it is on, one vent is open and the steam moves as in that version. When it ends, every vent opens again.
- **Sluicetide echo:** while it is on, the current runs and turns as in that version. It stops when the window ends.
- `World.echoLive` is true while a window is on. `versionLive(w, id)` tells the bot and the client whether a version is in effect, rolled or echoed. Each window that opens fires `{type:'echo', id}`.
- **Client:** the phase-3 banner reads "The vents erupt on their own, and Sealed Vents comes and goes" (or the Sluicetide).

Solo Drowned Foundry at tier 8, heroes-r2 hero-t8-0, seeds 1 to 80, wins out of 80:

| Class | Echo on | Echo off |
|---|---|---|
| Bulwark | 40 | 39 |
| Duskblade | 53 | 54 |
| Emberwright | 62 | 62 |
| Lumen | 66 | 66 |
| Slagbinder | 66 | 64 |

Every class is within 2 wins of echoes off.

## Phase 16 U1: the Lensmother's echo

From tier 8, the Lensmother's last phase also uses the version this run didn't roll. Her first echo-able cast in phase 3 is the echo, then her own and the echo alternate.

- **A Twin Brand or Glintfall echo** takes every other turn of her brand timer (`GLARE.bossBrandEvery`).
  - On a Twin Brand or Glintfall run, the timer alternates her own cast and the echo.
  - A Carried Light run has nothing of its own on that timer. In phase 3 the timer runs, and every other turn casts the echo.
- **A Carried Light echo** carries every other Glare: the light moves to her as the warning starts. On the Glares between, the light goes back to the middle of the room (with a `lightMove` event to 0, 0).
- Each echo cast fires `{type:'echo', id}`. The client draws the carried-light beams for a Carried Light echo too. The phase-3 banner reads "She cracks a pillar every so often, and echoes Glintfall" (or whichever echo it is).

Solo Glarewell at tier 8, heroes-r2 hero-t8-0, seeds 1 to 80. Wins out of 80, and how many runs reached phase 3 and saw an echo:

| Class | Echo on | Echo off | Phase 3 | Saw an echo |
|---|---|---|---|---|
| Bulwark | 72 | 73 | 74 | 71 |
| Duskblade | 64 | 67 | 70 | 64 |
| Emberwright | 75 | 73 | 77 | 71 |
| Lumen | 79 | 79 | 79 | 78 |
| Slagbinder | 80 | 80 | 80 | 80 |

- **Echo first:** with her own cast first, phase 3 often ended before the echo came, and wins were unchanged in every class. So the echo comes first.
- **The Kiln Mother keeps her own signature first.** With her echo first, solo Bulwark at Kiln t8 fell to 42 from 50, against 48 with her own first (#583). The other classes stayed within 2. 14 seeds changed outcome: 5 of the new losses had a Kiln Draw echo and 4 a Molten Cataclysm echo.

## Phase 16 U1: Nhevra's echo

Nhevra has two phases, so her echo starts deeper into her second phase. From tier 8, once she is at `NHEVRA_ECHO.below` (25%) health, the version this run didn't roll comes and goes on top of her own. It is on for `on` 12 s and off for `off` 10 s, starting at once.

- **Thin Ice echo:** the river cracks as the window opens, and again every `COLD.crackEvery` while it is on.
- **Emberdrift echo:** the ember ring drops as the window opens. Coals drain faster while it is on, and the embers are cleared when it ends.
- **Creeping Rime echo:** the rime rises under her and creeps while it is on, and fades when it ends.
- Each window that opens fires `{type:'echo', id}`. The client now dings "Echo: <version name>" on every echo event, for every boss.

Solo Coldmarrow at tier 10, heroes-r2 hero-t8-0, seeds 1 to 80, wins out of 80:

| Class | Echo on | Echo off | Saw an echo |
|---|---|---|---|
| Bulwark | 56 | 56 | 64 |
| Duskblade | 43 | 49 | 57 |
| Emberwright | 65 | 65 | 68 |
| Lumen | 61 | 61 | 66 |
| Slagbinder | 51 | 51 | 63 |

- **The Duskblade** loses ground: 43 against 49 on seeds 1 to 80, and 44 against 49 on seeds 81 to 160. On the seeds that flipped, the Duskblade took more damage in the last 25% (for example 420 hurt against 303 on seed 6). Forcing one echo gave 39 with Thin Ice and 40 with Creeping Rime.
  - Each fix I tried did worse:
    - a later start at 15% health: 40;
    - 8 s windows: 42;
    - the echo replacing her own version instead of stacking on it: 41 and 42, with every other class down 1 to 3.
  - Kept as is: 43 to 44 of 80 (54 to 55%) sits inside the tier-10 wall band of 40 to 60% (coldmarrow.md). It's a watch item for skills' class check (U4).

**Skills' U4 check (23 Nov): a Creeping Rime Nhevra only echoes the Emberdrift** (`NHEVRA_RIME_ECHOES`). On seeds 41 to 200 the Duskblade won 41 of 65 Rime runs with echoes off and 26 with Thin Ice forced. Thin Ice cracks, the rime and her body box a blade in: its contact damage from her went from 0.3 to 4.2 per second, and it drifted out of its Snuff interrupt reach. A wider interrupt reach and a bot rule for the cracks each won back at most 1 of 27 seeds. Forced Emberdrift on Rime runs gave 40 of 65 and hurt no other class. Ice and Drift runs still echo both of their other versions.

Coldmarrow t10, seeds 1 to 80, natural echoes, before / after: Bulwark 56 / 56, Duskblade 43 / 48, Emberwright 65 / 66, Lumen 61 / 62, Slagbinder 51 / 57.

## Phase 16 U1: Hessa's echo

Hessa's versions change the Ebb, so her echo is an Ebb run another way. From tier 8, once she is at `HESSA_ECHO.below` (25%) health, every other Ebb runs the way of the version this run didn't roll, starting with the first. The echo takes her own version's place for that Ebb, since an Ebb can only run one way.

- `World.ebbEcho` is true from that Ebb's warning until the next one starts. The `whirl` and `outsurge` getters (sim, bot and client) read the echo's way while it is on. A Riptide echo is an Ebb that is neither of those.
- The Ebb's cast name follows the way it runs ("The Whirl", "The Outsurge", "The Ebb"). Each echoed Ebb fires `{type:'echo', id}`, and the client dings "Echo: <version name>".

Solo Wrackline at tier 10, heroes-r2 hero-t8-0, seeds 1 to 80, wins out of 80:

| Class | Echo on | Echo off | Saw an echo |
|---|---|---|---|
| Bulwark | 50 | 46 | 61 |
| Duskblade | 48 | 49 | 52 |
| Emberwright | 55 | 55 | 55 |
| Lumen | 70 | 70 | 70 |
| Slagbinder | 79 | 79 | 79 |

Every class is within 4 wins of echoes off.

**Kiln Mother design call (QA on #583).** Her moves come from her health at the moment, so when the Ember Acolytes heal her back over 60% she uses her phase-1 Molten Cataclysm again, and over 30% she leaves her phase-3 echo. I tested making her moves follow the furthest phase she had reached instead. At Kiln t8 solo, seeds 1 to 80, echoes off, wins went from 50 to 24 for the Bulwark, 47 to 25 for the Emberwright, 55 to 47 for the Lumen and 48 to 48 for the Slagbinder, with the Duskblade unchanged at 28. The fallback Cataclysm can be interrupted, and that is part of what keeps Kiln Draw and Turning Fire runs fair. Kept: healing her back undoes her phase, which also rewards killing the acolytes.

## Phase 16 U1: Ysmeret's and Oskel's echoes

These follow the same rule as Ondrel: from tier 8 and `GROUP_ECHO.below` (25%) health, every other signature on the boss's timer is the echo's, the first one first.

- **Ysmeret:** each set of vents runs the way of `World.ventMove`, which is her version or her echo's: Twin, Wandering or Rolling Vents. The vents' cast name follows it. The Wandering Vents drawing and the Scatter-during-the-roll rule read `ventMove` too.
- **Oskel:** his Rivets timer gives Rivets, Die Cut or Punch Line, with the echo on every other turn.

Base party (Bulwark, Lumen, Duskblade, Emberwright), heroes-r2 hero-t8-0, wins out of 80, and how many runs saw an echo:

| Boss | Setup | Echo on | Echo off | Saw an echo |
|---|---|---|---|---|
| Ysmeret, Ashvents t8 | Base, seeds 1 to 80 | 49 | 54 | 69 |
| Ysmeret, Ashvents t8 | Half skill, seeds 41 to 120 | 47 | 49 | 68 |
| Oskel, Pressworks t10 | Base, seeds 1 to 80 | 58 | 58 | 76 |

- Ysmeret's runs stay inside the 55 to 70% band (59 to 61%).
- The Pressworks base party was already over the band (73%) before echoes, and the echo doesn't move it.

## Phase 16 U1: raid echoes

Raid bosses have long fights with several phases, so each one's echo starts at its own health mark (`RAID_ECHO` in sim/world.ts) in its last phase, from tier 8 like every other echo.

- **The Furnace Regent** (from 40%): his phase-2 Ash timer alternates the echo and his own move, echo first. Ash Fall, Summons or Tithe.
- **The Cinder Colossus** (from 45%): his phase-2 Wheel timer alternates the echo and his own move, echo first. Wheel, Plate Shift or Millstone.
- **Old Vorhulm** (all of phase 3): his phase-3 timer alternates the echo and his own move, echo first. Ember Feast, Banked Coals or Inhale. The Banked Coals drawing and the Inhale's 3D pull read `bossEcho` too.
- **Grandmother Slag** (from 50%, in phase 2): the echo comes in windows, on `SLAG_ECHO.on` 14 s and off `off` 10 s, and takes her own version's place while it is on. Each change clears the islands and the overflow and sets up the version now running (the Brimming's islands, or the Overflow from its first beat). Her flow, heat share and churn read the running version. The windows stop when she goes into phase 3.
- Each echo fires `{type:'echo', id}`, and the client dings "Echo: <version name>".

Wins out of 80, heroes-r2 hero-t8-0, and how many runs saw an echo. Base party is Bulwark, Lumen, Duskblade, Emberwright; Anvil is Slagbinder, Lumen, Duskblade, Emberwright with `STANCE=anvil`.

| Boss | Setup | Echo on | Echo off | Saw an echo |
|---|---|---|---|---|
| Regent, Flue t11 | Base, seeds 1 to 80 | 59 | 56 | 78 |
| Regent, Flue t11 | Half skill, seeds 41 to 120 | 55 | 48 | 79 |
| Regent, Flue t11 | Anvil, seeds 41 to 120 | 50 | 53 | 76 |
| Colossus, Smeltery t10 | Base, seeds 1 to 80 | 59 | 58 | 80 |
| Colossus, Smeltery t10 | Half skill, seeds 41 to 120 | 57 | 50 | 80 |
| Colossus, Smeltery t10 | Anvil, seeds 41 to 120 | 48 | 60 | 80 |
| Vorhulm, Hoard t9 | Base, seeds 1 to 80 | 55 | 58 | 79 |
| Vorhulm, Hoard t9 | Half skill, seeds 41 to 120 | 37 | 41 | 77 |
| Vorhulm, Hoard t9 | Anvil, seeds 41 to 120 | 72 | 73 | 77 |
| Grandmother Slag, Crucible t8 | Base, seeds 1 to 80 | 51 | 47 | 57 |
| Grandmother Slag, Crucible t8 | Half skill, seeds 41 to 120 | 52 | 47 | 63 |
| Grandmother Slag, Crucible t8 | Anvil, seeds 41 to 120 | 63 | 59 | 73 |

- The base parties land at 64 to 74% with echoes on, against 59 to 73% with them off.
- **Grandmother Slag** gets a little easier with her echo (4 to 5 wins in every setup). Each window change clears the islands or the overflow that was building, which may be why; I haven't measured that. Every setup stays inside the band, so it is kept. Fewer runs see her echo (57 to 73 of 80), because only a run that brings her to 50% in phase 2 gets a window.
- **The Colossus Anvil party** drops the most, 60 to 48 (75% to 60%), and is still inside the band. The Anvil party was over the band before echoes.
- **The Anvil bots and a Plate Shift echo (QA on #599, 23 Nov):** the drop was the bots, not the echo. The Anvil tank's hold (`anvilHold` in sim/bot.ts, which keeps him close so he doesn't walk off with his plates turned) only ran in his own Plate Shift version, so a Plate Shift echo found the tank wandering. The hold now also runs once a Plate Shift echo's turns have begun (`bossEcho === 'shift'` and his hp at or under `RAID_ECHO.colossus`). `NOSHIFTECHOHOLD=1` turns that off for measuring. Smeltery t10, Anvil party, wins out of 80:

| Seeds | Hold in the echo | No hold in the echo | Echoes off |
|---|---|---|---|
| 41 to 120 | 59 | 48 | 60 |
| 121 to 200 | 59 | 47 | 57 |

  Of the 60 runs that drew a Plate Shift echo, 40 won with the hold and 17 without. With the hold the Anvil party is back level with echoes off (118 against 117 of 160).
- **The Hoard at half skill** was under the band before echoes (51%) and the echo takes it to 46%. That was already a known gap (#324), not something the echo opened.
- **Bots and a Tithe echo (sound's check, 23 Nov):** in court runs the bots missed 6 of 13 Tithe echoes, because the bots' walk to the throne ahead of a Summons (`summonsDue`) only read his own version. `World.regentNextMove()` now gives his next Ash-timer move, echo included. On Flue t11 court runs with `ECHO=tithe`, base party, seeds 1 to 40, missed Tithes went from 11 to 8 (of about 100), and 7 of the 8 left came with only one hero alive, so nobody could share them. Wins went 29 to 28. His own Tithe version missed none of 414.

- **The Hoard echo and the parties without a Duskblade (23 Nov):** skills found Old Vorhulm's echo cost the Bellows party (Bulwark, Lumen, Slagbinder with `STANCE=bellows`, Emberwright) and the two-Emberwright party (Bulwark, Lumen, two Emberwrights) about 10 to 14 wins of 160, spread over all three echoes. I tried five changes to when and how often the echo comes. Hoard t9, heroes-r2 hero-t8-0, seeds 1 to 160, wins out of 160:

| Setup | Bellows | Two Emberwrights | Base |
|---|---|---|---|
| Echoes off | 86 | 80 | 111 |
| Echo as shipped (every other spill, echo first) | 72 | 70 | 109 |
| His own move first | 78 | 72 | |
| Echo every third spill | 79 | | |
| Echo only below 15% health | 77 | 70 | |
| At most 3 echoes | 71 | 71 | 104 |
| At most 2 echoes | 75 | 73 | |

  None of them wins back more than about half the cost, and opening-order changes move 6 or fewer wins, which is inside the rng-reshuffle noise for raids (horders-raid-measuring). The base party loses only 2 to the echo. The flipped runs (won with echoes off, lost with them on) all wiped in phase 3, between 2% and 38% boss health. Both parties were already under the band with echoes off, so the echo widens an existing class-side gap (skills' Z5, #324) rather than opening one. Kept as shipped; no change to `RAID_ECHO.vorhulm`.
- **Novice aid at tier 4:** skills' Grit Guard (#630, `GRIT_GUARD` in docs/skills.md) gives the Duskblade Blade Guard per Grit stack from tier 4, so only a player who keeps losing a tier gets it.

## Phase 16 U2: the Kiln's new elite, the Ashwall

U2 gives each solo dungeon one new elite whose answer isn't "kill it or step out". The Kiln's is the **Ashwall** (`ashwall`, 900 hp, elite, title "Shields those behind it"), a slab of cooled slag carried as a shield. It comes in the new opener **The Ashwall** (`ashwall`): one Ashwall and two Ember Spitters. Tip: "It shields the foes behind it, and its own front. Walk round it, or draw them out from behind it." The name was searched: no World of Warcraft match.

- **The shield** faces its hero (`Enemy.aux`) and turns toward them at `ASHWALL.turn` (0.5 rad/s), slower than a hero circles close in. A hit from inside its front arc (`frontArc`, 60 degrees either side) does `front` (50%) to the Ashwall, and `sheltered` (35%) to any foe within `shelterR` (150 px) behind it, inside `shelterArc` of its back. From its side or back, every hit lands in full. Bosses are never sheltered. Burn ticks are judged from the hero who lit them.
- **Guarding:** it walks to `guardGap` (55 px) in front of the nearest foe within `guardRange` (320 px), on the hero's side, so it keeps putting itself between you and the Spitters.
- **Shield Bash:** a `bashArc` cone off its front, every `bashEvery` (5 s) while the hero is within reach. It is not interruptible. It punishes standing in front of it.
- **Glance:** a hit its shield cut carries `glance: true` on its `hit` event, so sound can play a dull thunk instead.
- **Client:** a heavy arc across its front and a faint wedge behind it where foes shelter. It wears the Hollow Warden until visuals draw it.
- **Bots:** a melee hero in front of an Ashwall walks round it (`NOASHWALL=1` turns that off). Ranged heroes don't circle. With circling, the Emberwright's Ashwall fight got shorter (120 s to 81 s), but its wins at Kiln t8 over seeds 1 to 160 went from 93 to 76, while its Spitters fight gave 91.
- **Tools:** `FIGHT=<encounter id>` in tools/foundry.ts makes that the first fight of every run, and counts `fightT` (its length) and `fightHurt`.

Kiln t8, heroes-r2 hero-t8-0, seeds 1 to 80, with the first fight forced (`FIGHT=`). Median fight seconds:

| Class | Ashwall | Ashwall, no circling | Ember Spitters |
|---|---|---|---|
| Bulwark | 60 | 77 | 37 |
| Duskblade | 47 | 61 | 33 |
| Emberwright | (ranged: no circling) | 120 | 55 |
| Lumen | (ranged: no circling) | 108 | 49 |
| Slagbinder | (ranged: no circling) | 129 | 64 |

- Walking round it cuts a melee hero's fight by a fifth to a quarter. It is still the longest Kiln opener: a ranged hero takes about twice as long as against the Spitters, because a bot doesn't draw the Spitters out of the wedge the way a player can. That's a watch item for QA's playtest.
- **Whole-run wins from a forced first fight are chaotic.** The Lumen on seeds 81 to 160 won anywhere from 54 to 68 depending only on which old opener came first (Spitters 68, Spitter Brute 68, Warden and Hounds 60, Hollow Wardens 54, Ashbucks 54). It won 50 with the Ashwall, and 53 with the Ashwall's shield turned off, so the gap comes from the fight's make-up, not the shield. Natural runs (below) are the check.

Natural Kiln t8 runs (the Ashwall is one of 7 openers, and it came up in 16 of seeds 1 to 80), seeds 1 to 160, wins before / after: Bulwark 99 / 96, Duskblade 62 / 67, Emberwright 92 / 91, Lumen 114 / 114, Slagbinder 99 / 92. Adding an opener re-rolls every Kiln route, so these move by reshuffle as well as by the Ashwall. Every class is within 7.

## Phase 16 U2: the Foundry's new elite, the Ballast

The Drowned Foundry already asks you to kite Maelra over its vents, so its new elite asks the same thing. The **Ballast** (`ballast`, 950 hp, elite, title "Keep it moving") drops anchor when you stand in its reach, and while it's planted it barely feels hits. It comes in the new opener **The Ballast** (`ballast`): one Ballast and two Cinderhounds. Tip: "When you stand in its reach it drops anchor and barely feels hits. Step back so it has to walk after you, and hit it while it walks." The name was searched: no World of Warcraft match.

- **Anchor:** with its hero within `BALLAST.reach` (90 px past its radius) for `plantDelay` (0.8 s), it drops anchor (`Enemy.aux` counts toward it, and a ring fills on the client). Out of reach the count drains at the same rate rather than resetting, so a hero who steps out and straight back in plants it sooner (QA saw 0.33 to 0.6 s in 84 of 811 plants). That is on purpose: dancing on the edge of its reach can't keep it walking for free. Planted, it stops, takes `planted` (30%) damage, and each hit is a `glance` for sound. It weighs anchor `unplant` (0.6 s) after its hero leaves its reach; that clock starts again if the hero comes back into reach first (`aux2` resets), which may explain the 16 of 807 QA saw take up to 0.9 s (not traced). Each change fires `castDone` with id `anchor` or `unanchor`.
- **Anchor Slam:** only while planted, a ring `slamR` (95 px past its radius) round it, `slamFirst` (1 s) after it plants and then every `slamEvery` (2.6 s). It is not interruptible.
- **Bots:** any hero near a planted Ballast steps out of its reach (`NOBALLAST=1` turns that off). Ranged heroes never let it plant, so for them it is a plain chaser.
- **Seen log:** appended to `NEW_FOES`.
- **Tuning:** the first version slammed 0.6 s after planting, for 20 damage. Bulwarks then died in the fight after it, and their runs fell further. With 1 s and 16, at Foundry t8 forced first fight, seeds 1 to 80: Bulwark 25 to 28, Duskblade 52 to 59.

Foundry t8, heroes-r2 hero-t8-0, seeds 1 to 80, first fight forced (`FIGHT=`), median fight seconds and wins (first version):

| Class | Ballast | Ballast, no stepping out | Sluice Crawler and Hounds |
|---|---|---|---|
| Bulwark | 88 s, 25 | 82 s, 27 | 59 s, 33 |
| Duskblade | 60 s, 52 | 76 s, 49 | 41 s, 53 |
| Emberwright | 71 s, 64 | 71 s, 64 | 102 s, 67 |
| Lumen | 52 s, 71 | 52 s, 71 | 77 s, 65 |
| Slagbinder | 67 s, 73 | 67 s, 73 | 96 s, 65 |

Natural Foundry t8 runs, seeds 1 to 160 (first version), wins before / after: Bulwark 72 / 62, Duskblade 112 / 110, Emberwright 125 / 121, Lumen 133 / 126, Slagbinder 125 / 119. With the tuned slam the Bulwark gets 61. Of the Bulwark's 160 runs, 24 met the Ballast and won 7 of them (29%). Its other runs won 54 of 136 (40%), against 45% before, so most of its drop is the re-rolled routes. **The Bulwark against the Ballast is a watch item for skills:** it is the Foundry's weakest class already, and it has to step out of reach the most.

## Phase 16 U2: the Glarewell's new elite, the Lampeye

The Glarewell already teaches you to hide behind pillars from the Lensmother's Glare, and its Shades grow tough in shadow. Its new elite plays those two against each other. The **Lampeye** (`lampeye`, 800 hp, elite, title "Break its gaze") is a slow floating eye that keeps its distance. It comes in the new opener **The Lampeye** (`lampeye`): one Lampeye and three Shades. Tip: "While it can see you its gaze builds, and when it is full it sears you. Put a pillar between you and it to let the gaze fade, but pull the Shades into the light." The name was searched: no World of Warcraft match ("Gazer" is used there, so it was avoided).

- **Gaze** (`Enemy.aux`, seconds): it builds 1 a second while the Lampeye can see its hero, meaning no standing pillar crosses the line between them (`World.lampeyeSees`). Behind a pillar it fades `LAMPEYE.fade` (2) times as fast. A cracked pillar blocks nothing.
- **Searing Look:** at `full` (6 s) it casts Searing Look for `lookCast` (1 s), not interruptible. When the cast ends, every hero it can still see takes `lookDamage` (34) times the tier's damage. A hero who gets behind a pillar during the cast takes nothing. Either way the gaze resets to 0.
- **It keeps its distance:** inside `keep` (220 px) it backs away, so its gaze crosses the room. But a hero who closes to within `under` (70 px) of its edge is out of its gaze.
- **The trade:** a pillar's shadow is where Shades take less damage (`GLARE.shadeShadowTaken`). Hide to break the gaze, then step back out and draw the Shades into the light.
- **Bots:** once the gaze is half full and it can see them, a ranged bot heads for the far side of the nearest standing pillar (`NOLAMPEYE=1` turns that off). Melee bots stay on the eye.
- **Client:** a ring round it fills as the gaze builds, and a thin beam joins it to your hero while it can see you. The beam flares during Searing Look. It wears the Shade's sprite until visuals draw it.
- **Seen log:** appended to `NEW_FOES`.

Glarewell t8, heroes-r2 hero-t8-0, seeds 1 to 80, first fight forced (`FIGHT=`), median fight seconds and whole-run wins:

| Class | Lampeye | Lampeye, bots don't hide | Shades |
|---|---|---|---|
| Bulwark | 95 s, 59 | 45 s, 69 | 22 s, 71 |
| Duskblade | 53 s, 48 | 42 s, 44 | 28 s, 63 |
| Emberwright | 83 s, 70 | 76 s, 8 | 39 s, 74 |
| Lumen | 65 s, 78 | 75 s, 22 | 53 s, 79 |
| Slagbinder | 80 s, 78 | 82 s, 80 | 44 s, 80 |

The fight times count only fights that were cleared. Without hiding, the Emberwright cleared 9 of 80 and the Lumen 22, so the gaze is the fight for ranged heroes. Natural Glarewell t8 runs, seeds 1 to 160, wins before / after: Bulwark 139 / 139, Duskblade 118 / 116, Emberwright 143 / 144, Lumen 156 / 152, Slagbinder 160 / 157. **Melee bots don't hide (skills' U4, 23 Nov):** forced first fight, seeds 41 to 200, whole-run wins of 160, the Duskblade won 89 hiding against 127 for the Shades control, and the Bulwark 118 against 145; with `NOLAMPEYE=1` the Bulwark is back to 145. The Duskblade lost 38 runs in the Lampeye fight itself. So the pillar rule is now for ranged heroes only, and a melee hero stays on the eye. The Duskblade lost the fight either way (92 of 160 not hiding), so the fight gained an answer for melee too: **a hero within `LAMPEYE.under` (70 px) of its edge is too close for it to focus on** and is out of its gaze. Get right under it, or behind a pillar. Seeds 1 to 80, forced first fight, whole-run wins (runs lost in the Lampeye fight): Duskblade 48 (12) hiding, 44 (19) not hiding, 60 (0) with `under`; Bulwark 59 (6), 69 (1), 72 (0). Ranged heroes hide before they get that close: Emberwright 70 and Lumen 78 with or without it.

## Routes never repeat a fight (playtest must-fix, 23 Nov)

QA's playtest found that one route could hold the same fight twice. Some fights are in more than one of a dungeon's lists:
- The Coldmarrow's Frost Wardens are an opener and a named fight, and its Snuffers are an opener and a hard fight.
- The Wrackline's Warden Shoal is an opener and a named fight.

`rollRoute` (sim/content/dungeon.ts) now leaves out fights already rolled when it picks the named and hard fights. It still takes one pick per slot, so a route that had no repeat rolls exactly as before.

Over 2000 seeds, the repeat routes were 535 in the Coldmarrow and 220 in the Wrackline. Those are the only routes that change. No other dungeon had a repeat.

Natural runs at t10, heroes-r2 hero-t8-0, seeds 1 to 160, wins before / after:

| Class | Coldmarrow | Wrackline |
|---|---|---|
| Bulwark | 115 / 116 | 93 / 92 |
| Duskblade | 95 / 90 | 112 / 110 |
| Emberwright | 124 / 121 | 120 / 122 |
| Lumen | 125 / 123 | 137 / 136 |
| Slagbinder | 118 / 116 | 158 / 158 |

## Phase 16 U2: the Coldmarrow's new elite, the Dimhorn

In the Coldmarrow you carry your light with you, so its new elite is one you have to bring your light to. The **Dimhorn** (`dimhorn`, 750 hp, elite, title "Calls from the dark") is a quick, thin thing with a horn. It shuns the light and calls the pack from the dark. It comes in the new opener **The Dimhorn** (`dimhorn`): one Dimhorn and two Snuffers, which dim your coal and shrink its light. Tip: "Out in the dark it winds its horn and calls the pack. Keep it inside your coal's light, where it can't sound it."

The name was searched and has no match. I passed on "Horncaller", because it was too close to WoW's "Wyrmcaller's Horn". The Ember Twins already cover the "pair that must die together" idea, so the Dimhorn takes the other roadmap example instead: a foe that calls a wave in if it lives too long.

- **It shuns the light.** It hangs `DIMHORN.hang` (40 px) outside its hero's coal light. It backs off if it is inside, and circles in a `band` (70 px) ring just outside.
- **Dark Call:** `Enemy.aux` counts its seconds outside every coal's light. Inside a light it drains `drain` (2) times as fast, and it can't start the call there. At `callAt` (7 s) it casts Dark Call for `callCast` (2 s). The call can't be interrupted. When it ends, `calls` (3) Rimehounds come in from the arena edge behind it, unless the Dimhorn is inside a coal's light by then. In that case the call is lost (`castDone` id `darkCallLost`). After `maxCalls` (2) calls its horn is spent (`Enemy.aux2` counts them).
- **The trade:** Rimehound kills feed your coal, so a call isn't all loss. But the Snuffers shrink the light you need, and chasing it pulls a ranged hero into melee.
- **Bots:** once its count is 40% of the way to a call, or it is calling, a bot moves toward it until it is well inside the light. `NODIMHORN=1` turns that off.
- **Client:** a cold ring round it fills toward the call and pulses during the call. It wears the Snuffer's sprite until visuals draw it.
- **Seen log:** appended to `NEW_FOES`.
- **Tuning:** the first version had no cap on calls. A ranged hero who never brought the light over it faced 10 to 26 calls and died every time (Emberwright, Lumen and Slagbinder 0 of 80). With two calls at most, an unhelped hero survives but the fight takes about twice as long.

Coldmarrow t10, heroes-r2 hero-t8-0, seeds 1 to 80, first fight forced (`FIGHT=`). Each cell is the median fight time, then whole-run wins:

| Class | Dimhorn | Dimhorn, bots don't bring the light | The Snuffers |
|---|---|---|---|
| Bulwark | 50 s, 56 | 53 s, 49 | 28 s, 54 |
| Duskblade | 45 s, 42 | 79 s, 44 | 33 s, 45 |
| Emberwright | 90 s, 62 | 121 s, 53 | 55 s, 56 |
| Lumen | 57 s, 74 | 151 s, 61 | 58 s, 57 |
| Slagbinder | 83 s, 55 | 138 s, 57 | 64 s, 59 |

With their rule, the bots never let it call. Without the rule, the Emberwright, Lumen and Slagbinder met a call in all 80 runs, the Duskblade in 51 and the Bulwark in 33. Natural Coldmarrow t10 runs, seeds 1 to 160, wins before / after: Bulwark 116 / 117, Duskblade 90 / 89, Emberwright 121 / 121, Lumen 123 / 121, Slagbinder 116 / 122. The cap doesn't change these, because with the rule no call happens.

## Phase 16 U2: the Wrackline's new elite, the Conchblower

The Wrackline is a fight against the Ebb's clock, so its new elite plays with that clock. The **Conchblower** (`conchblower`, 560 hp, elite, title "Calls the Ebb") swims the quay with a great shell. It comes in the new opener **The Conchblower** (`conch`): one Conchblower and two Shoal Lurkers, which surge in the Ebb. Tip: "Each blast of its conch brings the next Ebb sooner. Quench the blast, and be near a raft when the water turns." The name was searched: no World of Warcraft match.

- **Conch Call:** `CONCH.first` (4 s) after it spawns, then every `every` (8 s), it casts Conch Call for `cast` (1.8 s). The cast is Quenchable, like the Hauler's Haul. When a blast lands, the next Ebb comes `hasten` (6 s) sooner, but never less than `floor` (1 s) away. During an Ebb, a blast holds the water `hold` (1.5 s) longer. Each landed blast fires `castDone` id `conchBlown`.
- **It swims the Ebb:** like a Shoal Lurker, the water doesn't drag it.
- **The answer:** keep your Quench for the conch, and fight near a raft, because blasts you miss bring the water early.
- **Bots:** the usual interrupt rule covers it. Even at half skill the bots Quench nearly every blast.
- **Client:** the cast bar shows the blast. It wears the Barge Hauler's sprite until visuals draw it.
- **Seen log:** appended to `NEW_FOES`.
- **Tuning:** the first version had 700 hp and three Lurkers. Ranged heroes then spent about 94 s in the fight. With 560 hp and two Lurkers it takes 61 to 79 s.

Wrackline t10, heroes-r2 hero-t8-0, seeds 1 to 80, first fight forced (`FIGHT=`). Each cell is the median fight time, then whole-run wins. The Lurkers column is the first version's control run.

| Class | Conchblower | The Lurkers | Blasts Quenched / landed |
|---|---|---|---|
| Bulwark | 45 s, 44 | 27 s, 46 | 377 / 2 |
| Duskblade | 42 s, 56 | 29 s, 57 | 293 / 40 |
| Emberwright | 72 s, 53 | 59 s, 63 | 572 / 17 |
| Lumen | 61 s, 74 | 53 s, 55 | 484 / 30 |
| Slagbinder | 79 s, 79 | 55 s, 79 | 572 / 105 |

Natural Wrackline t10 runs, seeds 1 to 160, wins before / after: Bulwark 92 / 92, Duskblade 110 / 107, Emberwright 122 / 113, Lumen 136 / 140, Slagbinder 158 / 157.

The Emberwright's drop is not the Conchblower. It won 13 of the 19 runs that met it (68%). In its other 141 runs it won 100 (71%), against 76% over all 160 before, so most of the drop is re-rolled routes. **Watch item for skills:** the Emberwright's forced first fight, 53 against 63.

## Playtest follow-up: melee heroes and the Lensmother (23 Nov)

QA's average-player playtest (qa/playtest/average.md) found melee heroes fall off at average skill in the Glarewell t8. It blamed Lens Sweep, because Lens Sweep was the last cast to finish before most deaths. Counting where the damage actually comes from tells a different story. Boss fight only, heroes-r2 hero-t8-0, laggedBot at 0.15 s and skill 0.75:

| Source | Bulwark (seeds 1 to 30) | Duskblade (seeds 1 to 20) |
|---|---|---|
| Her touch (22 every 0.6 s while in contact) | 76% | 69% |
| Her casts (finishCast) | 8% | 16% |
| Burst Brands | 11% | 11% |
| Telegraphs, Lens Sweep included | 5% | 5% |

At full skill the Bulwark takes 75% from her touch too. It just survives. Spacing the sweeps out didn't help melee (sweepEvery 1.7 to 2.2 or 2.6: Bulwark 19, 22, 11 of 80), so the change is to her touch: `damage` 22 to 16, the same as the group bosses. Ranged heroes kite her and never touch her.

Glarewell t8, seeds 1 to 80, wins out of 80:

| Hero | Average 22 (was) | Average 16 | Average 12 | Full skill 22 | Full skill 16 |
|---|---|---|---|---|---|
| Bulwark | 19 | 33 | 37 | 74 | 74 |
| Duskblade | 13 | 19 | 26 | 63 | 71 |
| Emberwright | 60 | 61 | | | |

- At 16 the average Bulwark goes 19 to 33 and the Duskblade 13 to 19, while the Emberwright stays put. At full skill the Duskblade comes up level with the Bulwark (71 and 74). 12 would close more of the gap, but it would make her touch the softest of any boss, so 16 it is.
- The average Duskblade's bigger loss is still the trash: 45 of its 80 runs end before the boss, against 8 at full skill. That's next.
- Lens Sweep's 1.1 s cast, 300 px reach and 60° width are now in `GLARE` (`sweepCast`, `sweepRange`, `sweepArc`), as QA's bug 6 asked, with the same values.

