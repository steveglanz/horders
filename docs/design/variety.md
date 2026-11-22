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
- **Foes:** `emberSpitter` (Ember Spitter, 420 hp, keeps 190 to 290 px away, casts `emberLob`: a 70-radius circle on your spot that lands 1.6 s later) and `ashbuck` (Ashbuck, 620 hp, casts `charge` for 1 s with a lane telegraph, then runs 360 px straight down it). The Hollow Rift fight reuses `rift` and `ashling`, with at most `VARIETY.riftCap` = 8 Ashlings out. Tuning is in `VARIETY` (sim/world.ts).
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
