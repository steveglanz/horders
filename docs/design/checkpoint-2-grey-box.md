# Checkpoint 2: the grey-box fun test (definition)

*Design, 27 Nov 2026. Pillars 1-4. This page is the one shared definition of the Checkpoint 2 slice (vision/vision.md section 11: "one shared slice with one definition"). It follows the roadmap's Checkpoint 2 row ([roadmap.md](roadmap.md), "Checkpoints"), which overrides the vision's older "one room that looks final" Checkpoint 2: the loop is proven on today's renderer first, and the new look is tested alongside it, not inside it.*

## The question it answers

**Is the new loop fun before any final art exists?** Everything here serves that one question. If a task doesn't help a cold tester decide "I want another run", it is not in Checkpoint 2.

## What a player gets (the slice)

One place, **the Kiln Depths, tiers 1-3**, all **five classes**, solo, on the public web build (horders.netlify.app) and the phone shells. Built as the default for everyone, with no switch (Steve, 25 Nov 22:23Z).

**The run: 5 rooms with one fork, 6-8 minutes.**

| Room | What's in it | Budget | Pays |
|---|---|---|---|
| 1 | Trash pack, 3-5 big foes | 15-30 s | A level and a Spark |
| 2 | Trash pack | 15-30 s | A level and a Spark |
| 3 | **The fork:** two doors, both visible. Hard door: a named foe. Easy door: a trash pack | Hard 30-45 s, easy 15-30 s | Hard: an extra item roll from the "rare" loot table (sim/content/items.ts LOOT). Easy: an extra Spark pick |
| 4 | The door guard (a named fight) | 30-45 s | **Pick 1 of 2 Relics**, then the boss door opens |
| 5 | The Kiln Mother, today's staged fight with **Boil-over at 90 s** | 60-90 s | Embers, the boss bag, tier unlock on a win |

Short corridors, no side rooms, no skippable pulls in this slice. The grey box uses today's Kiln foes; foes built from the 8 jobs come in Checkpoint 3. The hard door pays loot instead of a Blueprint because Blueprints come in Checkpoint 4 (the vision's fork pays a Blueprint once they exist).

**The first delve stays the tutorial Kiln** (sim/halls.ts genTutorial, docs/design/first-delve.md), with Sparks and dodge added and no Relic. The 5-room run starts from the second delve.

**Other places** keep today's Halls maps until Checkpoint 5, but get the run-wide changes below (Sparks, Relics, Boil-over, the mastery card), because one game can't have two rule sets.

## What gets built (and who owns it)

| # | Piece | Owner | "Done" for the grey box |
|---|---|---|---|
| 1 | **Camera in:** hero 70-80 px tall, trash 40 px+, a boss at least a third of the screen at 390x844; edge arrows for off-screen foes; the intro banner shrinks to one line | engineering | Measured on shots at 390x844 |
| 2 | **Big placeholder shapes:** today's 3D bodies scaled to the camera, signal tells from `style.ts` (red jagged = move, gold ring with chevrons = stand, cracked blue ring = interrupt) | engineering, visuals | Every tell is a style.ts shape and colour |
| 3 | **`feel.ts`**: hit flash, knockback, hit-stop on big hits, clay shatter that stays on the floor, shake (with an off switch in settings), haptics | engineering, mobile | Every hit flashes and sounds within 50 ms; hit-stop length settled on Steve's phone |
| 4 | **Dodge roll for every class**, on a dodge button by default, flick-the-stick as an option; bots learn "roll on red" | classes | Cold testers pick the default (see the test) |
| 5 | **The five signature verbs:** Emberwright Overheat, Cutwick Snip (was Backstab; rename-map section 4), Bulwark Parry, Lumen light motes, Slagbinder charged shot | classes | Each is on the bar and named in its tip |
| 6 | **8 Sparks per class**, 3 of which change how you play. Cut down from today's 24-30 draft cards per class (sim/content/emberwright.ts `TALENTS`); new talents still go in `BOT_PRIORITY` (sim/bot.ts) | classes, design | Pick and win rates logged |
| 7 | **4 Relics**, one picked per run after the door guard. Each bends a rule and has a cost. They replace potions and in-run quests, which are removed | design (queue item 4), engineering | No potion or quest UI left in a run |
| 8 | **The 5-room Kiln run with one fork** (above) | engineering, design | Passes `hallsCheck`; delve 6-8 min at average skill for every class |
| 9 | **Boil-over** at 90 s replaces Burnout (docs/design/fight-budgets.md) | engineering, design | No fight lost to a hidden timer |
| 10 | **The mastery card** on every end screen: dodges (x of y), interrupts (x of y, only for classes that have one), soaks, the blow that killed you, one lesson line, and your best time in the Kiln | engineering | Never empty, on a loss too |
| 11 | **The Sparks rename** everywhere ("Catch a Spark"); "talent" means only the permanent tree | engineering | No "Choose a talent" left (client/ui.ts, client/index.html) |
| 12 | **The event log live** on the public build (engineering spec, Checkpoint 1) | engineering | First run start, run end, second run start, quit point and Spark and Relic picks arrive |

## What is NOT in Checkpoint 2

- New art of any kind: the kiln-lit look, figurines, the Wick hub diorama. (The look test runs alongside, below.)
- New names or lines beyond the rename map and world.md, and none without Steve's yes on the batch.
- Blueprints, Treasures, Fusions, the Journal, the Weekly Cache, Quick Delve, the trade halls, class locks, the purchase.
- Co-op changes. Co-op keeps working with the new run rules; it is not what the test judges.
- New foes from jobs and the Kiln Mother remake (Checkpoint 3).
- Any AI image, music or voice generator (pillar 5).

## How it passes

**The fun test** (both, on the public build with the event log):
1. **3 of 5 cold testers** finish a delve and **start another one unprompted**. A cold tester has never seen the game, records their screen and thinks aloud, uncoached (script and recording how-to: [cold-testers.md](cold-testers.md)). Steve plays it too, but he can't be one of the five.
2. **30% or more of web players start a second run.** Counted from the event log: of anonymous players whose first run ended (won or lost), the share who start a second run within 24 hours. It counts once at least **50 first-time players** have played (judgment, to keep 5-player noise out).

**Gates that must already hold** (bots, before any human sees it):
- Fight budgets and the 60% floor on the Kiln at tiers 1-3 (fight-budgets.md), with the Kiln Mother inside 60-90 s or no slower than the baseline.
- Hero 70-80 px and trash 40 px+ measured at 390x844.
- Every hit flashes and sounds within 50 ms.
- 60 fps on a mid-range Android, once Steve says yes to a test phone (roadmap, "What only Steve can supply"). Until then, the Android emulator in CI and Steve's iPhone 15 Pro Max give a first read.
- A first read from the AI playtest panel (tools/playdriver.cjs, playtesters/README.md) before humans play it.

**Also decided by the cold testers:** dodge button or flick as the default, and whether named fights at 30-45 s feel long enough to read.

## The look test (alongside, judged separately)

A 15-second animated clip of one hero against one foe in one Kiln room, in the new low-poly look, shown blind next to today's look and a pixel-art version. **It passes when cold testers pick the animated clip.** It needs Steve's yes on roadmap decision 1 first. It changes nothing in the build; if it fails, the pixel-art fallback is tried in the same room before Checkpoint 3 scales anything.

## If the fun test fails

Nothing scales. Design reads the five recordings and the event log's quit points, writes the top three reasons in one page, and Checkpoint 2 repeats with fixes to those three only. Checkpoint 3 (the Kiln at final quality) does not start until the fun test passes.

## After it passes

Steve decides the game's name (roadmap decision 3), using which fantasy the cold testers repeated back. Then Checkpoint 3 starts.
