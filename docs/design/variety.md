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

**Run variety** (tools/variety.ts, tier 8): the Crucible has only 12 routes, and with the two versions 24 run shapes. A raid's fight pools are short. Widening them is a W3 follow-up.
