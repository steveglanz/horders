# The 5-minute opening (1.0, Checkpoint 3)

*Design, 27 Nov 2026. Pillar 1 (a dungeon night in your pocket), pillar 2 (read it, answer it) and pillar 5 (one world, one voice). Source: [vision/vision.md](vision/vision.md) section 1 ("The hook"), with the roadmap's overrides ([roadmap.md](roadmap.md), Checkpoint 3). Names and lines follow [world.md](world.md) and [rename-map.md](rename-map.md). The unlock moments follow [unlock-curve.md](unlock-curve.md). This page replaces the tutorial part of [first-delve.md](first-delve.md) once it is built; until then first-delve.md describes what is on main.*

**What it is.** The first thing a new save plays: one tap from the title into the Kiln, four small rooms that each teach one thing, a short Kiln Mother you can't lose, and back to Wick with her ember. About 5 minutes from first tap to the **Delve again** button. It plays once per save.

**Why it changes.** Both AI playtest panels say players drop at their first death and drown in words (playtesters/reports/2026-11-27-pilot/SUMMARY.md issues 1-2, 2026-11-27-cp2-kiln/SUMMARY.md issues 1 and 7). Today's first delve is safe (10 of 10 wins below), but it is 75-115 s long, its Kiln Mother dies in 10-26 s, it never teaches the dodge roll or Quench, and it opens on a hub full of tabs, a class picker and a tier row. The checkpoint asks that 4 of 5 cold testers finish the opening without help and that each can say who they are and why they went down (roadmap, Checkpoint 3).

## Today on main (d8245bc), measured

`tools/balance.ts`, `FIRST=1 HALLS=1 ULVL=1` (the tutorial map and a level-1 character's buttons), 10 seeds each, 27 Nov 2026.

| Class, skill | Wins | Whole run | Boss reached at | Kiln Mother fight |
|---|---|---|---|---|
| Emberwright, average (`REACT=0.3 FORGET=0.2 STEPERR=0.5`) | 10/10 | 82-115 s (avg 100) | avg 83 s | 11-22 s |
| Emberwright, novice (`LAG=0.3 SKILL=0.5`) | 10/10 | 82-114 s (avg 96) | avg 80 s | 10-22 s |
| Cutwick, average | 10/10 | 78-86 s (avg 81) | avg 61 s | 17-26 s |
| Cutwick, novice | 10/10 | 68-81 s (avg 75) | avg 55 s | 14-24 s |

For comparison, the second delve (the normal 5-room Kiln tier 1 run, `HALLS=1 ULVL=2`, Emberwright, 10 seeds): 10/10 at both skills, 102-166 s, Kiln Mother 16-41 s.

What a new save sees today, from the code:
- The hub, with a "New here?" box (client/hub.ts:401), five class buttons all open (client/hub.ts:318), the dungeon list and Delve.
- The coach: "Drag anywhere to move", then "Tap to cast" on the first button (client/coach.ts). Its interrupt step is skipped, because the F button opens at character level 4 (`SLOT_UNLOCK = [1, 2, 3, 4]`, sim/content/classes.ts:100), so a first delve has one button: Q.
- The route pack, Brute, Brute and Acolytes, Kiln Mother (sim/content/firstdelve.ts:14) on the four-room tutorial map (sim/halls.ts `genTutorial`), damage x0.5, health x0.85, the Kiln Mother at x0.5 on top, the old three-phase fight (`bossV2 = !firstDelve`, sim/world.ts:1516).
- If the cloud is online, a 60 s world-boss bonus fight is added after the Kiln Mother (sim/world.ts:7878, worldBoss from client/main.ts:298). The first delve doesn't skip it.

## The opening, beat by beat

Targets are game-clock times from the first tap. The rooms are today's tutorial map (R0, R1, R3, R5 and the boss door), each with a new job.

| Time | Beat | What the player does | What's on screen | Teaches |
|---|---|---|---|---|
| 0:00 | **Title** | Taps anywhere | A cold town at night, one hearth guttering. The name and "Tap to wake." Nothing else: no menu, no tabs, no class picker | - |
| 0:05 | **The Hearthkeeper** | Taps to go on (or waits 4 s per line) | Two lines on the dark scene, one at a time: *"The Court took the fire. Go down and take some back."* then *"Take this coal. It's the last one in Wick."* | Wick, the Court |
| 0:15 | **R0, the mouth** | Moves | The hero drops in, lit by the coal it carries. Coach: "Drag anywhere to move." The room is short: the door to R1 is 6 s of walking at most (the pilot panel found 5-9 s of empty walking, issue 4) | Move |
| 0:25 | **R1, three hounds** | Fights | 3 cinderhounds, bigger and slower than the normal pack. Coach: "Your attack fires on its own. Tap Flame Wave when they bunch up." They shatter like pottery (client/feel.ts) | Basic attack, Q |
| 0:45 | **First level-up** | Picks 1 of 3 | "Catch a Spark", 3 cards, one of them a play-changing Spark (CP2 Sparks). Coach: "Pick one. It lasts this delve." | Sparks |
| 0:55 | **R3, the slammer** | Rolls | One brute-job foe (today a Hollow Warden) that slams the floor every 5 s with a red jagged zone. On the first slam, coach: "Red on the floor is a hit coming. Tap Roll to get out." It lives through about 4 slams | Red means move; the roll |
| 1:35 | **R5, the caster** | Quenches | One caster-job foe with a blue cast bar (today the Cinder Brute's Ground Pound, the only interruptible cast in the Kiln). On the first cast, coach: "A blue bar is a cast. Tap Quench, the blue button, to stop it." A Quenched cast staggers it (takes double damage for 3 s). An un-Quenched cast lands for a light hit. It lives through about 3 casts. Banner on the first Quench: *"It fears water. Of course it does."* (the Hearthkeeper) | Blue means Quench |
| 2:20 | **The boss door** | Walks in | Banner "The Kiln Mother". Her first line: *"A thief from Wick. I thought you'd all gone cold."* | the Kiln Mother |
| 2:25 | **The Kiln Mother, short** | Rolls, Quenches | 75 s, two stages, below. Coach once: "Roll out of the red. Quench her blue cast." | Both answers at once |
| 3:40 | **She falls** | Watches | *"Take it, then. I can always make more than you can carry."* She cracks and shatters. Her great ember rises to the hero | embers |
| 3:50 | **Home** | Taps | Back in Wick: the hearth roars, and the Forge lights (building 1). The end card says "You carried home N embers." and one item from her (first-clear Rare). The Hearthkeeper: *"Bring more."* | the Forge |
| 4:10 | **Delve again** | Taps | The Home card's one button, Home to the Forge, opens the hub of Delve and the Forge only (engineering, 27 Nov: the panel never saw the Forge when the card went straight into delve 2). Its Delve starts delve 2: the normal 5-room Kiln tier 1 run with its fork and, from this run, Relics (unlock-curve.md) | - |

The play part (R0 to her fall) is about 3:25, against today's 1:15-1:55. A slower or newer player runs longer, and the times above are for the average-skill bot. The whole opening is capped by its rooms, not a clock: nothing ends it early.

### The short Kiln Mother

A cut-down version of the remade fight (the Kiln Mother remake is the next design slice, roadmap Checkpoint 3). It is the only boss fight the player meets before they know her full kit, so it shows one answer per stage.

| Stage | Health | Lasts (target) | Her moves | The answer |
|---|---|---|---|---|
| 1 | 100% to 50% | about 35 s | **Swipe**: a red cone in front of her every 6 s, shown 1.2 s ahead (the v2 stage 1 swipe, kiln-mother-v2.md) | Roll out, or stand at her side |
| 2 | 50% to 0 | about 40 s | Swipe every 8 s, plus one **blue cast** every 12 s (today's interruptible Molten Cataclysm, sim/world.ts:7304; its name goes in the remake, because "Cataclysm" is a WoW expansion, rename-map.md section 2). Line at the stage change: *"Mind the pots. I fired every one of them."* | Quench it. Un-Quenched, it lands as one light ring |

- No eggs, no bellows, no gold circles, no adds, no Boil-over countdown and no Old Tricks in this version. Each is taught later, in the remade fight.
- Her health is whatever makes the fight 60-90 s for the novice Emberwright (target median 75 s). Engineering tunes `FIRST_DELVE.bossHp` to that; today's 0.5 gives 10-22 s, so expect about 3-4x.

### Rules for the whole opening

1. **You can't lose it.** The hero's health never drops below 1 in the opening. Nothing says so. The run log still counts the blows that would have killed you, so we can see where players struggle. (Vision section 1: "a short 90-second version you can't lose".)
2. **One button per room.** Q from R1, the roll from R3, Quench from R5. The other two class buttons (W and E) stay hidden in the opening and open by character level as today.
3. **Emberwright only.** No class picker. Cutwick opens on the first Kiln tier 1 win, the other three at the First Seal (unlock-curve.md).
4. **Nothing extra.** No world-boss bonus fight, no loot bags from foes, no Relics, no Omens, no Court's Mood, no named elite, no Hollow Rift, no Grit, no tier row. The end card shows embers, the one item and the two things you learned (Rolled N, Quenched N), not the full mastery card.
5. **Seven words.** The opening uses Wick, the Court, embers, Sparks, Quench, the Kiln Mother and the Forge. That is 7 of the first hour's 10 (world.md, "The first-hour word list"). No other game word appears on any screen in the opening.
6. **Once per save.** It plays when the save has no runs. A second class's first run is a normal Kiln tier 1 run with that class's coach line for its verb. Quitting mid-opening starts it again from R0 next time (it's short).
7. **Co-op links skip it.** A new player who opens a friend's co-op link joins the friend's run straight away (joining is free and open from the start, unlock-curve.md). Their first solo Play then plays the opening.

## Ruling: Quench in the opening

unlock-curve.md left this open for Checkpoint 3: the opening teaches Quench, but the F button opens at character level 4. Design's pick:

- **The interrupt button opens at character level 1 for every class: `SLOT_UNLOCK = [1, 2, 3, 1]`.** One rule, no special case for the opening, and Quench never goes away after being taught (a one-time Quench in the opening would vanish again in delves 2 and 3).
- The F button is the class's interrupt (Emberwright, Cutwick, Bulwark) or stun (Lumen, Slagbinder), so every class gets its answer to a blue cast from the start. That matches pillar 2 ("each one has an answer within reach of every class").
- **The classes team confirms it** with the smallest grid: Kiln tiers 1-3, 5 classes, average skill, 20 seeds, main vs `[1, 2, 3, 1]`. The bar is within 3 of 20. Watch: heroes are hit softer for each button they don't have yet (sim/world.ts:4228), so opening F early also removes that softening at levels 1-3. If wins drop past the bar, the classes team trims that softening for the W and E slots instead of keeping F locked.
- Level 4 then opens nothing new. The classes team may move one ability option there; that's their call.

## What engineering builds (in this order, one PR each)

1. **First launch flow.** A save with no runs opens on the title ("Tap to wake"), then the two Hearthkeeper lines, then straight into the opening. No hub on the way in. Client: client/main.ts (start flow), client/hub.ts (the "New here?" box goes).
2. **The opening run.** Route R1 three hounds, R3 one slammer, R5 one caster, then the short Kiln Mother (sim/content/firstdelve.ts `route`, sim/halls.ts `genTutorial`). The R5 stagger on a Quenched cast. The 1-hp floor and the would-have-died count. No world-boss bonus (sim/world.ts:7878 skips when `firstDelve`). Coach lines from the table above (sim/content/firstdelve.ts `coachLine`, client/coach.ts gets the roll step).
3. **The short Kiln Mother.** Stages 1 and 2 above, then `FIRST_DELVE.bossHp` tuned on the novice Emberwright: 20 seeds, median 70-80 s, every run 60-90 s.
4. **Home.** The end card for the opening (embers, the item, Rolled and Quenched counts, "Bring more.", one Delve again button). Until the Wick diorama lands (visuals, Checkpoint 3), the card stands on today's end screen, and the hub after it shows Delve and the Forge only.
5. **Quench at level 1** (`SLOT_UNLOCK`), after the classes team's grid.

Each PR attaches 390x844 shots or a clip (pillar 4) and names the pillar.

## Done when

- **Bot:** the novice and average Emberwright, 20 seeds each, finish the opening every time; the play part takes 3:00-4:00 at average skill; the short Kiln Mother takes 60-90 s with a median near 75 s.
- **AI panel:** the new-mobile-player persona (/mnt/project-files/horders/playtesters/new-mobile-player.md) plays the opening by hand, with no `auto`, and can name the roll and Quench afterwards.
- **Cold testers (the Checkpoint 3 gate):** 4 of 5 finish the opening without help, and each can say who they are (a thief from Wick) and what the red and the blue mean.

## Lines in this page (for Steve to read; work doesn't wait)

New lines, inside the voice guide's lengths (world.md, part 2), no banned words, no exclamation marks:
- Title: "Tap to wake." (game voice)
- Hearthkeeper: "Take this coal. It's the last one in Wick." (9 words)
- Kiln Mother, on entry: "A thief from Wick. I thought you'd all gone cold." (10 words)
- Coach (game voice): "Your attack fires on its own. Tap Flame Wave when they bunch up." / "Pick one. It lasts this delve." / "Red on the floor is a hit coming. Tap Roll to get out." / "A blue bar is a cast. Tap Quench, the blue button, to stop it." / "Roll out of the red. Quench her blue cast." / "You carried home N embers."

Reused from world.md's sample lines: "The Court took the fire. Go down and take some back.", "It fears water. Of course it does.", "Mind the pots. I fired every one of them.", "Take it, then. I can always make more than you can carry.", "Bring more." The world.md line "Back again, little thief?" is kept for later runs, since in the opening she hasn't met you yet.

No new proper names. Her two moves keep plain words (Swipe) or today's name until the remake names them.

## Not decided here

- The full Kiln Mother remake (60-90 s at average skill for both free classes, phases of 20-30 s, about 25 taunts): the next design slice.
- Kiln foe jobs and names (the slammer and the caster above are jobs, not names) and the hand-written Kiln items: later Checkpoint 3 slices.
- Flick-dodge or a roll button: the CP2 cold testers pick (cold-testers.md Q8). The coach line says "Tap Roll" for the button and becomes "Flick to roll" if flick wins.
- The Wick diorama and title art: visuals, Checkpoint 3.
