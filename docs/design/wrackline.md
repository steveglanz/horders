# The Wrackline (fifth solo dungeon, 21 Nov 2026)

**Setting:** a wrecked quay under the Hollow Tide. A drain at the bottom of the harbour pulls everything in, and only the rafts hold. It unlocks at **tier 13** (after the Coldmarrow at 10) and is solo friendly. The daily bounty and the weekly quests don't use it (below).

## The verb: ride the rafts
The roadmap's C1 note offered "a moving safe zone". Here it is.

- **Rafts:** three rafts (radius 78) drift round the arena on their own circles, at radii 125, 300 and 410. The middle one turns the other way. They drift at 38 units a second, about a quarter of a hero's speed, so you can always walk with them. Fresh rafts start every fight.
- **The Ebb:** every 18 s in trash fights (14 s with Hessa up), a 3 s warning. Pale streaks run in from the rim, the banner says "The Ebb!" and the rafts' rims light up. Then the water pulls for 4 s. A hero **off** a raft is:
  - dragged toward the centre at 75 units a second, slower than every class (128 to 152), so you can still walk out;
  - burned for 4% of max health a second;
  - burned 10% more inside the drain (radius 90).

  On a raft you're anchored and take nothing.
- **The water takes foes too.** Every foe except Lurkers and bosses drifts in at 80% of the pull, and the drain takes 6% of its max health a second. So a fight is often: get on a raft, and let the Ebb drag the Hollow Wardens into the drain.

How it differs:
- **The Foundry:** Maelra's Undertow is one cast that pulls you to her, and you Quench it. The Ebb is the whole floor, on a clock, and the answer is a place to stand.
- **The Glarewell:** its shade is fixed. Here the safe spots move, so you plan where the raft will be.
- **The Coldmarrow:** you carry your safety with you. Here you go to it.

## Foes
| Foe | What it does | The answer |
|---|---|---|
| **Shoal Lurker** (elite, 280 health, fast) | Swims, so the Ebb doesn't drag it, and it moves 30% faster in it. It **can't climb onto a raft**: it circles the edge. | Stand in the middle of a raft. Its title says "Can't board rafts" |
| **Barge Hauler** (elite, 950 health, slow) | **Haul**, every 8 s: a 1.6 s Quenchable cast with a narrow line telegraph. If it lands, it yanks its target up to 160 units toward it, off the raft if that's where you were | Quench it, or step out of the line |
| Hollow Warden and Cinderhound (from the Kiln) | Slow guards and fast hounds | The Ebb drags the Wardens into the drain |

**Route:**
- Openers: Shoal Lurkers (3 Lurkers and 2 Cinderhounds), The Barge Hauler (a Hauler and 2 Lurkers), Warden in the Shoals (2 Wardens and 3 Lurkers).
- Named: Two Haulers, Warden in the Shoals.
- Hard: Hauler and Warden (a Hauler, a Warden and 2 Lurkers), Two Haulers.

## Boss: Hessa of the Ebb (3 400 health)
She holds the drain at the centre and never moves. Melee have to stand in the drain to hit her, so they leave on each warning. The inner raft (radius 125) passes over her edge, so a melee hero riding it can keep hitting her through the Ebb.

| Mechanic | What it does | The answer |
|---|---|---|
| **The Ebb** | Every 14 s while she's up | Be on a raft |
| **Sink** | Every 9 s, a 2.2 s Quenchable cast on the afloat raft nearest her target. If it lands, that raft goes under for 12 s | Quench it, or move to another raft |
| **Call the Shoal** | Every 28 s, 2 Shoal Lurkers | Stand in a raft's middle, or kill them between pulls |
| **Phase 2, Riptide** (below half health) | Rafts drift 1.6× faster and the pull is 1.25× stronger | Move with the rafts |
| **Soft enrage** (240 s) | The Ebb every 7 s | Finish her |

Her touch is light (9), because she's a caster who holds still. At 20 it punished melee alone (tuning, below).

## Tuning (tier 10, hero-t8-0 for each class, 20 seeds, measured against the Coldmarrow at the same tier)
There are no hero snapshots past tier 8 gear, and with tier 8 gear both the Coldmarrow and the Wrackline are near 0 at tier 12. So the Wrackline is tuned to sit near the Coldmarrow **at the same tier**, which leaves the tier 13 unlock as the step up.

| Class | The Wrackline | The Coldmarrow | Wrackline: average boss fight, and share of the Ebb spent off a raft |
|---|---|---|---|
| Emberwright | 15/20 | 13/20 | 199 s, 2% |
| Duskblade | 14/20 | 12/20 | 170 s, 7% |
| Bulwark | 10/20 | 12/20 | 221 s, 11% |
| Lumen | 18/20 | 12/20 | 143 s, 3% |
| Slagbinder (Duskblade's gear) | 20/20 | 6/20 | 193 s, 4% |

Measured with the script at `/mnt/project-files/horders/design/wrackline/wr.ts` on this branch, after #204. On average it's easier than the Coldmarrow at the same tier: 77% of runs won against 55%, and the Lumen and Slagbinder are the main gap. It opens three tiers later, which scales enemy health and damage by about 1.8 times, so a hero meets it with better gear than these snapshots. Real play data should settle whether it needs to be harder (watch items below).

**How it got here:**
- **Shoal Lurkers first swam onto the rafts** and mauled a hero standing still through the Ebb. Every class lost the first fight. Making them unable to board was both the fix and a clearer rule.
- **The Sluice Crawler's ring fought the rafts**, because you can't drag a ring away while standing on a raft. It was swapped for Hollow Wardens, which the Ebb drags into the drain instead.
- **Bots** were taught to make for the nearest afloat raft when the warning leaves just enough time, to step out of a circle about to land first, and to ease toward the raft's middle (`ebbRaft` in `sim/bot.ts`).
- **Melee were far behind** ranged. The inner raft over Hessa's edge, a lighter touch and a 240 s enrage brought them up.
- **The pull speed matters most for the Bulwark** (128 speed). At 110 it netted 18 units a second against the water, and was off a raft for 17% of each Ebb.

**Soft-lock check:** `tools/contentcheck.ts` now includes the Wrackline (`ONLY=wrackline` runs just it). 32 runs, 4 classes, good and weak bots: none stuck, the longest 544 s, at most 8 foes alive at once.

**Watch items:**
- The Lumen and Slagbinder win nearly every run at tier 10. The Ebb is attrition, and both have sustain. If real players find it soft, push on Sink and the Ebb's burn, not on Hessa's health: health stretches the fight, and that hurts the Bulwark most.
- The Bulwark is the lowest class here, as the Slagbinder is in the Coldmarrow.
- In co-op, rafts are shared, and only the nearest raft to Hessa's target sinks. It is untested with a party.

## What else this changed
- `WEEKLY_DUNGEON_IDS` in `sim/content/dungeon.ts` pins the weekly quest dungeons to the four from before. `weeklyFor` drew from `SOLO_DUNGEON_IDS`, so a fifth solo dungeon would have reshuffled this week's quests for everyone, mid-week. `BOUNTY_DUNGEON_IDS` already did this for the bounty. Keys get a Wrackline key automatically, from `SOLO_DUNGEON_IDS`.
- `tools/hashcheck.ts` is identical to main, so other dungeons are unchanged.
- The client draws:
  - the drain's swirl and the rafts (planks, and a bright rim during the Ebb);
  - sunk rafts as ripples, and the Ebb's streaks;
  - banners for The Ebb, Sink, Call the Shoal and Riptide.

  `tools/wrackshots.cjs` screenshots it on desktop and phone.
- **A pre-existing bug fixed on the way:** the Coldmarrow's phase 2 showed the Kiln's "Phase 2: Ember Acolytes" banner, because the phase banner had no Coldmarrow case. It now shows nothing there, because Thin Ice has its own banner.

**For other teams:**
- **Visuals:** sprites are needed for the Shoal Lurker, the Barge Hauler and Hessa (they show placeholders), plus the floor and the raft art. The floor tint is #6e8a80, a grey-green harbour colour. Visuals picked it to sit at least 21 ΔE from every other floor.
- **Sound:** a dungeon theme, plus cues for the Ebb's warning and pull, Sink, Haul and Call the Shoal.
- **Design follow-up:** done below (the Ebbproof achievement and the Wrackrider set).

## The Ebbproof achievement and the Wrackrider set (21 Nov 2026)
**Ebbproof:** beat Hessa of the Ebb in the Wrackline. It pays the title "the Ebbproof" and 40 embers, like the other solo bosses (`sim/content/achievements.ts`).

**The Wrackrider set.** Hessa's head, hands and trinket drops can be Wrackrider pieces, the same way the other solo bosses drop their sets (`withSet`, 60% of set-slot drops, never in bounties). The verb is **stand fast**: the Wrackline teaches you to find your footing and hold it while the water pulls. It is the opposite of the Foundry's Tidewalker (keep moving). All numbers are in `SET_TUNING` (`wr*`) in `sim/content/sets.ts`.

- **2 pieces:** after 0.5 s standing still you are **Planted**, and you take 6% less damage. Planted lasts 1 s after you walk off. In the Wrackline, standing on a raft keeps you Planted even while you walk.
- **3 pieces:** while Planted, your hits deal +8% damage.

A "Planted" chip shows in the buff row while it is on. The set glyph in `client/icons.ts` is a placeholder (a figure on a raft over a wave) until visuals draws one.

**Measured** with `SET=wrackrider` in `tools/foundry.ts`, heroes-r2 hero-t8-0, Wrackline tier 10, seeds 1 to 80, on main d282506 plus this change. Wins out of 80, full set against none:

| | Emberwright | Duskblade | Bulwark | Lumen |
|---|---|---|---|---|
| No set | 57 | 54 | 42 | 75 |
| Wrackrider (3) | 67 | 59 | 44 | 74 |

That is -0.5 to +5 wins in 40, inside the range the other sets give (the Hearthkeeper gave +1 to +5). The Lumen is already near the ceiling.

- **First pass:** Planted only after 1 s still, and no linger. It gave +1 to +2 wins in 40, too little.
- **Second pass:** 0.5 s still, a 2 s linger and +10% damage. It gave the Emberwright +9 in 40, too much.
- **Shipped:** 0.5 s, 1 s linger, +8%.

**Outside the Wrackline it is unmeasured.** Our bots almost never stand still: in 6 Kiln runs per class, the Emberwright and Bulwark stood still 0.7 to 0.8% of the fight, and with the shipped numbers the set changed no Kiln result (tier 7, seeds 1 to 40, all four classes). So outside the Wrackline it only helps a player who stops to fight. Whether phone players lift their thumb often enough is for real play data. If they never do, the fix is a longer linger, not a bigger bonus.

`tools/hashcheck.ts` is identical to main b748f13, so nothing changes for heroes without the set.

## Names
Each was searched on wowhead.com, warcraft.wiki.gg and wowpedia, and the bigger ones on the open web too.
- **No exact match:** "Wrackline", "Hessa of the Ebb", "Shoal Lurker", "Barge Hauler", "Call the Shoal" and "Warden in the Shoals".
- **The set and achievement (searched on the open web, and on the three WoW sites):** "Wrackrider" and "Ebbproof" have no match anywhere. The nearest is WoW's "Wavestrider", a different word.
- **"Planted"** is a single plain word, kept under Steve's rule. Wowhead lists an internal spell of that name (spell 22935). "Steady" was the first pick, but our own talents already have Steady Halo and Steady Breath. "Anchored" was dropped because Wowhead lists several "Anchored" spells.
- **Single ordinary words, kept under Steve's rule:** "The Ebb" (Wowpedia has a page named Ebb), "Riptide" (a WoW shaman spell), and "Haul" and "Sink".
- **Dropped:**
  - "The Slagway": too close to the Slagworks in Blackrock Foundry.
  - A molten "Pour" theme: the raid already has the Ladle Pour and The Pour.
  - "Undertow" for the mechanic: Maelra already casts Undertow.
  - "Brinecutter": too close to The Briny Cutter.
