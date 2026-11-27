# The Kiln Mother, remade (1.0 Checkpoint 3)

*Design, 27 Nov 2026. Pillars 2 (read it, answer it) and 3 (short, fair, always pays). Roadmap Checkpoint 3: "Kiln Mother remade: 60 to 90 s, phases of 20 to 30 s, melee answers, visible enrage, about 25 taunts." Starts from the 25 Nov three-stage fight (BOSSV2, /mnt/project-files/horders/design/bosses/kiln-mother-v2.md). The first delve keeps its own short fight (docs/design/opening.md); nothing here changes it except the move's name.*

## Why it changes

At average skill she died in 25 s (Emberwright, tier 1 median) to 61 s (Cutwick, tier 3), so most players never saw her third stage and nobody saw Boil-over (playtest panel cp2-kiln, issue 3). Her stage 1 was 8 s long. Three of her moves had no answer for a melee hero: her touch hurt every 0.6 s, Kiln Draw pulled you into fire that landed on her, and the rings rolled out of her body with no warning. Her stage 2 banner still said "Ember Acolytes", a phase she no longer has.

## The fight

| Stage | Health | Lasts (Ember / Cutwick, t1-3 medians) | Her moves | The answer (melee first) |
|---|---|---|---|---|
| 1. The duel | 100% to 60% | 18-20 s / 26-28 s | **Swipe**: 120° red cone, reach 220, every 6 s, shown 1.2 s (0.96 s on a Halls run). **Eggs**: 2 every 14 s on her far side, hatch 3 Ashlings at 6 s | Stand at her side or behind. Walk over an egg to stamp it |
| 2. Into the kiln | she can't be hit | 22-25 s both | The heat: every 9 s the cool quarter steps clockwise; the other three burn 4% max hp every 0.5 s after a 2.5 s warning. **One bellows at a time**, in the quarter that just turned cool (3 in all) | Stand in the cool quarter. Break each bellows as it appears. All 3 broken: she falls out stunned for 8 s and takes double damage |
| 3. The last fire | 60% to 0 | 20 s / 28-35 s | **Swipe** on a hero within 150 of her, else a **Lob** (red circle at your feet, 1.3 s, 26), every 4 s (3.2 s under 30%). Her **signature** every 12 s, one of three by seed. **Kiln Brand**: a gold circle at her side every 14 s (30 to everyone if empty). **Old Tricks** (her other version's signature) on alternate signatures | See the signature table |

Her signatures (one per run, rolled from the seed, so a second run can differ):

| Signature | What it is | Melee answer |
|---|---|---|
| **Kiln Ripple** (was Molten Cataclysm) | A 1 s wind-up, then 2 rings of fire roll out a second apart, each with two 60° gaps, 30 a ring | Stand in a gap, or roll through the ring |
| **Kiln Draw** | A 2.2 s inhale that pulls everyone in, then fire out of her door-mouth over the half of the floor in front of her | Get behind her: the pull keeps you in reach |
| **Turning Fire** | 4 cones of fire poured round her, one after another | Follow the fire round her, into ground it already burned |

**She never hurts by touch.** Every blow of hers is a red mark first.

**Boil-over** is unchanged from Checkpoint 2: at 90 s she boils over, says her line and hits 20% harder every 10 s. With the new length, 5-25% of won fights reach it (grid below), so players now see it. The plate counts down its last 30 s. The boss glow is still the visuals team's job.

### Rules checked

- **Phases of 20 to 30 s:** every stage median is 17-29 s for both classes.
- **Melee answers (vision section 6 item 6):** every move above has a spot within melee reach or can be rolled through. Cones show for at least 0.96 s; the Ripple's wind-up is 1 s.
- **One new mechanic a stage:** eggs, then the kiln, then her signature. The old random triad of basic attacks (circles, a long cone, Ashling rings) is one basic attack now, and the Ashlings come only from eggs.
- **Stage 2 is timed by the kiln, not by damage.** The bellows used to come all at once, so a ranged class broke them in 13 s and a melee one in 19 s. One at a time, the stage is about 3 heat steps for every class, which closes the class gap in fight length.

## Taunts (25, plus Boil-over's)

In sim/content/kilnmother.ts. Each moment says one line, once a fight, picked from the run's seed (no run-rng draws, so bot balance is the same with or without them). The Court's voice (world.md): 12 words or fewer, no exclamation marks. A test checks length, banned words and repeats. They show in the one-line banner as "The Kiln Mother", 2.5 s after a stage starts so the stage banner is read first. **Steve can veto any line.**

| Moment | Lines |
|---|---|
| She is met | Back again, little thief? You still smell of my kiln. / Wipe your feet. I only just swept these ashes. / Every pot in here is mine. So is every ember. / A thief from Wick. I thought you'd all gone cold. |
| Stage 2 | Mind the pots. I fired every one of them. / Into the kiln. Let's see how you like the heat. / Stand still, dear. The heat does the rest. |
| First egg hatches | There. A fresh batch, straight from the kiln. / You let them hatch. They'll want feeding. |
| First egg stamped | Those were my eggs, little thief. / Clumsy. I'll fire another dozen tonight. |
| All bellows broken | My bellows. Do you know how old those were? / Put me back. Put me back this instant. |
| Out on her own | Done hiding? So am I. |
| Stage 3 (first signature) | Enough. I'll fire you myself. / Now you've made me hot under the lid. / All right. The last of my fire, then. |
| Hero under 30% | Cracking already? Poor glaze. / You're cooling, little thief. I can tell. |
| Old Tricks | I know an older trick than that. |
| Hero falls | Into the kiln with you. Everything comes out harder. / Leave the embers by the door, dear. / Come back when you're better fired. |
| She falls | Take it, then. I can always make more than you can carry. / Take your ember. I'll be warm again by morning. |
| Boil-over (CP2) | You've stayed too long, little thief. |

The hero-falls line is sent as a `bossSay` event as the run ends; the end screen (engineering) can show it with the felling blow.

## The name

"Molten Cataclysm" is a WoW expansion name (rename-map.md section 2). It becomes **Kiln Ripple** everywhere players see it, including the first delve's interruptible cast. Searched 27 Nov: no Kiln Ripple on Wowhead or as a game ability; WoW has "Ring of Fire" and "Fire Ring", so "Firing Rings" was dropped. The code id stays `cataclysm`.

## Numbers (sim/world.ts)

| What | Was | Now |
|---|---|---|
| Health share at tiers 1/2/3 (`KILN_BOSS_HP`, on top of tier scaling) | 0.65 / 1 / 1 | 1.7 / 1.6 / 1.3 |
| Stage 2 at (`stage2At`) | 65% | 60% |
| Heat step (`heatEvery`) | 6 s | 9 s |
| Bellows | 3 at once | `bellowsN` 3, one per heat step |
| Swipe damage | 30 | 24 |
| Ring damage, warning | 40, none | 30, `ringWarn` 1 s |
| Stage 3 basic attacks | 3 kinds, every 3.2 / 2.4 s | Swipe (within `swipeNear` 150) or Lob 26, every 4 / 3.2 s (`stage3Pace`) |
| Kiln Brand | 150 from the hero, 40 if empty | `brandOff` 100 from her, `brandMiss` 30 |
| Kiln Draw fire | circle r150 on her | `frontReach` 330 cone, `frontArc` 180° |
| Touch damage | 25 every 0.6 s | none |

## Measured

Tool: `HALLS=1 TIER=t CLS=c SEEDS=1..20 REACT=0.3 FORGET=0.2 STEPERR=0.5 npx tsx tools/kmfight.ts` (new: prints each stage's length, the boss's damage by source and what felled the hero). Average skill, Halls on, no hero file, main 60ee8b5 plus this change.

| Class | Tier | Before: wins, boss median (range) | After: wins, boss median (range) | Stages after (s) | Won fights past 90 s |
|---|---|---|---|---|---|
| Emberwright | 1 | 20/20, 25 s (20-50) | 20/20, 57 s (41-102) | 17/22/20 | 1 |
| Emberwright | 2 | 20/20, 35 s (23-79) | 20/20, 63 s (41-99) | 18/23/20 | 2 |
| Emberwright | 3 | 17/20, 47 s (25-101) | 18/20, 62 s (41-99) | 18/23/20 | 3 |
| Cutwick | 1 | 20/20, 35 s (25-42) | 20/20, 77 s (56-86) | 24/23/29 | 0 |
| Cutwick | 2 | 20/20, 55 s (43-70) | 20/20, 79 s (71-93) | 26/24/29 | 1 |
| Cutwick | 3 | 20/20, 61 s (38-77) | 20/20, 81 s (56-95) | 26/25/28 | 4 |

Tier 1 is 1.7, not 2.0, because of the fight-budget gate (tools/matrix.ts, Kiln t1, seeds 1-6). At 2.0 the Lumen took 98 s, over the 90 s ceiling. At 1.7 the gate reads Emberwright 51, Cutwick 79, Bulwark 78, Lumen 86 and Slagbinder 39 s. The cost is the Emberwright at tier 1, which sits at a 57 s median, just under 60 (floors aren't gated). Cutwick is inside 60-90 s at every tier. The Emberwright is inside at tiers 2-3 and 3 s short at tier 1. Wins are the same or better. Closing the class gap (Emberwright and Slagbinder fast, Lumen and Bulwark slow) is the classes team's Checkpoint 4 work. The other three classes (10 seeds, tiers 1 and 3, a flag only): Bulwark 10/10 and 9/10 at 92-95 s, Lumen 10/10 at 93-102 s, Slagbinder 10/10 at 40-42 s. Those are Checkpoint 4 work (classes: every class kills her in 60-90 s), and the Slagbinder's 7-8 s third stage says its burst in the stun window is the outlier.

## Not done here

- The boss glow at Boil-over and art for the new Kiln Draw cone (visuals). The client draws it as a normal red cone today.
- The end screen showing her hero-falls line (engineering, with the felling blow).
- The first delve's coach lines still say "Cataclysm" (sim/content/firstdelve.ts); the opening build (docs/design/opening.md, engineering) rewrites them.
