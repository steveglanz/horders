# Horders design roadmap

Ordered by how much each item adds to "one more run" for the work it takes, and by how much it sets Horders apart ([positioning.md](positioning.md)). Game design builds the items marked **design**; the other owners are noted. Each item lists what it needs from other teams so they can plan.

Status key: ✅ done, 🔨 in progress, ⏭ next, 💡 later.

| # | Item | Status | Owner | Needs from others |
|---|------|--------|-------|-------------------|
| R2 | The Forge: embers upgrade and temper gear | ✅ PR #2 | design | ✅ Visuals: Forge panel in the Claude Design port (a17b1f8); Upgrade and Temper strike the item card (#139) |
| R1 | Route choices between fights | 🔨 built | design | ✅ Visuals: gate arch and portal sprites (76e9380, `gate`/`portal` in client/textures.ts) |
| R3 | Tier modifiers ("Omens") | 🔨 built | design | ✅ Visuals: an icon per Omen (OMEN_ICON, client/icons.ts); Warded shows a shield bar over the foe and "Warded" in the target frame |
| R5 | World boss you actually fight | ✅ built: the shadow fight #3; server rules in supabase/migrations 0001 to 0003 (strikes, shadow strikes, the weekly Omen) | design + engineering | Engineering: per-boss rules on the server; visuals: boss art |
| R6 | Second dungeon: the Drowned Foundry | 🔨 built | design | ✅ Visuals: Glass Warden, Ember Twins, Sluice Crawler, Maelra, steam vents and the water (6673909) |
| R10 | Group difficulty: party health scaling, Grit, co-op threat rules | 🔨 built | design | Skills: Charge taunt, Sidestep threat dump (agreed) |
| R9 | Co-op delves with tank, healer and damage roles, then raids | ✅ built: co-op rooms and netcode, the Hammerdeep group dungeon #51, party frames with roles (G4), revives (G6), the raid #100 and its tank swap #150 | engineering + design | Engineering: rooms and netcode; skills: role kits |
| R7 | Daily bounty: a 3-fight delve, one twist, the same seed for everyone that day | 🔨 built | design | ✅ Visuals: the gold bounty card in the hub; engineering: the daily leaderboard is V8 (#261, waiting on migration 0006) |
| R11 | Third themed dungeon: the Glarewell, light and shadow, from tier 7 | ✅ built (sim, bot, placeholder art) | design | ✅ Visuals: Glarewell art (#31); skills: add it to the class matrix; ✅ engineering: one Brand per hero in co-op |
| R4 | Build-changing loot: verb sets of 2 to 3 pieces, class weapon effects | ✅ built (sets #42, weapon effects #38) | design + skills | Skills: effects that hook into each class kit |
| R8 | Alchemy: one potion slot (run-start buff or a revive) | ✅ built | design | ✅ Visuals: potion icons (#35) and the brewing look (#163) |
| R12 | Group dungeons: the Hammerdeep needs a tank and a healer; the others are labelled solo friendly | 🔨 built #51 ([group-dungeons.md](group-dungeons.md)); retune after the bot fixes | design | ✅ built #51 ([group-dungeons.md](group-dungeons.md)); retuned with bot revives in #173. The Hammerdeep drops the Deepguard set (verb "stay close"), the Ashvents the Ventwalker set ("split up") |

## 1.0: the road to launch (plan of record, vision v2, 27 Nov 2026)

Steve (27 Nov 2026, 08:42-08:48Z): "very far from having a polished game, with engaging and balanced gameplay, fully flushed out classes and maps and dungeons and art"; "People will not pay for something that looks like it was thrown together, has no cohesive feel and concepts ... negative bias towards AI slop"; "Nothing is off the table ... look at what makes high rating/scoring long lasting games stick around. What's the replay value. What is the hook."

How this plan was made: our audit of main 75a7550 (screens, content, playtest data), two research reports (what keeps long-lasting games alive; the mobile market and how players react to AI-made content), five role proposals (creative director, systems and retention, combat and feel, art director, mobile product), a debate round, a director's synthesis and an outside red-team review. All of it, with sources, is in [docs/design/vision/](vision/). This section is the result, with the red team's fixes applied and checked against Steve's earlier calls.

**Honest size:** about **6 to 7 months of agent work** to a worldwide launch (judgment, from the checkpoint estimates below). Every checkpoint ends in something playable and measured, so we stop and change course early if the fun isn't there.

### The vision in one page
- **Pitch:** *A dungeon party in your pocket: steal fire from a furnace full of greedy kings, in boss fights you read and beat a few minutes at a time.* We lead with what only we have (tank, healer and damage roles, cast bars, interrupts, bots that fill your party), not "portrait boss fights", which Archero already owns.
- **World:** the surface has gone cold. The **Furnace Court**, a family of fire-kings, pulled every flame down into one mountain-sized furnace, **the Hoard**, and sealed themselves in. Above, the last town huddles round one dying hearth. You are a delver from that town; you go down, steal fire from the Court and carry it home as **embers**. Each dungeon is a layer of the Hoard; each boss is a member of the Court; each class is one of the town's fire trades. Embers, Heat, Quench and the Coldmarrow's coal all gain a meaning with no new code. The name "Horders" fits (the Court are the hoarders) but gets a store check (decision 3).
- **Material rule:** everything the Court made is **fired clay** that glows through cracks and shatters; everything the town made is **iron, cloth and brass**. One rule sets shapes, colours and sounds.
- **Tone:** cosy above, hungry below; dark and a little funny, never grim. Told in short lines only: boss taunts that react to the run, and a Hearthkeeper who reacts to your progress. No cutscenes, no voice.
- **The hook (first 5 minutes):** one tap to play, a cold town, two lines, drop into the Kiln, big foes that shatter, first Spark pick, dodge a red slam, Quench a blue cast, beat a short Kiln Mother you can't lose, carry her ember home and watch the town hearth roar. Then one button: Delve again.
- **Why people keep playing (replay value):** Sparks that change how you play (with Fusions), one Relic per run, five classes with a signature verb each, Blueprints from bosses that widen the pool, a chase for about 40 named Heirlooms, a ladder of tiers that add rules (not just health), the week's Omens, a daily seeded Quick Delve with a leaderboard, a mastery card on every end screen, a fork room each run, co-op with roles, and a free update every 6 to 8 weeks. Research basis in [vision/research-retention.md](vision/research-retention.md).

### Design pillars (every PR names one and passes its test)
| # | Pillar | The PR test |
|---|---|---|
| 1 | **A dungeon night in your pocket.** Pull, trash, named fight, boss, loot, ding, roles; you press abilities and choose when | Names the beat or role it strengthens; adds no auto-firing ability |
| 2 | **Read it, answer it.** Every threat has one tell in a reserved colour **and** shape (red jagged = move, gold ring with chevrons = stand, cracked blue ring = interrupt) and an answer for every class | Tell from `style.ts`, at least 0.8 s warning, a melee-range answer or can be rolled through |
| 3 | **Short, fair, and it always pays.** Trash 15-30 s, named 30-45 s, boss 60-90 s, delve 6-8 min; never lose to a clock; every run sends you home with something | Bot matrix inside the fight budgets; at average skill no class below 60% of the best class's wins in any launch place; the loss screen is never empty |
| 4 | **Big in the hand.** Portrait 390x844, hero 70-80 px tall, trash 40 px+, every hit flashes and sounds within 50 ms, 60 fps | 390x844 shots or a clip; measured sizes; frame rate held |
| 5 | **One world, one voice, honestly made.** Every name, line, colour and sound follows the world bible, the voice guide and `style.ts`. **No AI image, music or voice generators in new assets.** Text and code are written by Claude agents and every player-facing name and line is approved by Steve | Names in the rename map; no colour outside `style.ts` (unit test); no generated audio or images added |

**On "AI slop", honestly.** Every line of this game is written by Claude. So we never claim text is "hand-written". What we can truthfully say, once it's true: *"No AI art or music. Every model and sound is built in code."* A ready answer for "was this made with AI?" is written in Checkpoint 1. What makes a game read as slop is generic, inconsistent, unconsidered content; the cure is one world, one look, one voice, and Steve's sign-off on every name and line.

### What changes (decided)
**Combat and classes**
- Keep: room-to-room delves, the stick, four ability buttons unlocked at levels 1-4, the automatic basic attack, telegraphed bosses, threat and roles.
- Camera in close: hero 70-80 px, trash 40 px+, a boss at least a third of the screen; edge arrows; the intro banner shrinks to one line.
- A hit-feel kit in one table (`feel.ts`): hit flash, knockback, hit-stop on big hits, clay shatter that stays on the floor, shake with an off switch, haptics.
- A **dodge roll for every class**, on a **dodge button by default**, with flick-the-stick as an option. Bots learn "roll on red".
- **Fight budgets become a merge gate** (pillar 3). A visible **enrage at 90 s** replaces losing to Burnout.
- Every boss attack gets a melee answer; the **60% floor** fixes the melee walls (today Duskblade and Bulwark win 0/40 in the Coldmarrow at tier 10).
- **One signature verb per class:** Emberwright Overheat, Duskblade Backstab, Bulwark Parry, Lumen light motes, Slagbinder charged shot.
- **Interrupts stay on some classes** (Steve's call, 25 Nov; #841). The plan's proposal to give every class one was overruled; instead the stun-vs-interrupt difference must be readable on the button and in the fight.
- **Foes built from 8 jobs** (charger, spitter, shielder, caster, mender, bomber, swarmling, brute), each with one tell; each place re-glazes 4-5 jobs and adds one twist foe. **No two places share a trash list** (today 7 of 12 do, sim/content/dungeon.ts:211-249).
- Delves of **5 rooms with one fork**, 6-8 minutes.
- Every made-up name goes through the rename map, existing ones too (Maelra, Nhevra, Ysmeret and the rest).

**Systems: keep, merge, cut**
| Today | Ruling |
|---|---|
| In-run draft ("Choose a talent") | Rename **Sparks**; "talent" now means only the permanent tree. Start with **8 per class (3 that change behaviour)**; grow from pick and win rates. Fusions later |
| Potions, in-run quests | Cut; **one Relic per run** (pick 1 of 2 after the door guard), start with 4, grow to about 12 |
| Mythics, weapon effects, verb sets | Merge into about 40 named **Heirlooms**, each tied to a place; duplicates temper |
| Gear name generator (items.ts:107-132) | Deleted; plain gear named per place, approved by Steve |
| Collection, Achievements, Seen | Merge into one **Journal** (from hour 2) |
| Daily bounty (open arena), weekly quests, season marks | **Quick Delve** (daily seed, about 4 min, Halls map, leaderboard checked by replaying the run on the server) and one **Weekly Cache** filled by wins only |
| Tiers 1-15 (Steve's cap, #863) | **Kept at 15** (Steve picked it yesterday); from tier 3 each tier adds a rule, and number growth per tier is halved; Delver's Keys stay the endless ladder |
| Seasons, world boss | Seasons **off at launch**; Season 1 about 6 weeks after; the world boss returns as each season's finale weekend |
| Blueprints (new) | Bosses and named elites drop them; each adds a Spark, Relic or Fusion to your pool. The first kill of each boss always drops one |
| Hub | A town at night (one fixed diorama) behind one **Play** button; buildings light as systems unlock; a new player sees Play plus at most 2 buildings |
| Saves | **One save wipe before launch** with a thank-you title for early players, instead of a converter |

**Art and sound**
- **One look: kiln-lit dioramas.** Chunky, flat-shaded low-poly 3D built in code, a 3-step toon ramp and dark outline, rooms floating in black lit only by fire, clay foes that shatter, iron figurine heroes with one clear silhouette feature each. One 24-colour palette in `style.ts` with a unit test; each place adds two accents, never a full-screen wash. Only gameplay signals glow flat.
- **Animation is specified up front:** every body gets idle, move, wind-up, attack, hit and die, built from rigid parts with code tweens (anticipation, squash, recoil). A reference board of 6-8 shipped low-poly games is the quality target.
- **It's tested before it scales:** an animated 15-second clip of one hero against one foe in one Kiln room, judged blind by fresh players against today's look and a pixel-art version. If low-poly loses, the fallback is bigger hand-drawn pixel art with the same palette and signal rules.
- The 2D sprite set retires once the new look ships, replaced by a low-power 3D mode for weak phones, **but a flat debug renderer stays** for automated QA (3D runs about 10x slower than real time in our test machines).
- **Sound: five materials** (clay, iron, fire, water and steam, glass and bells) and one four-note **ember motif** through every place's music and every sting.
- **Music: Steve's call** (decision 2). We won't re-run the code-music test he already answered on 25 Nov.

**Launch scope:** the five solo dungeons and the Hammerdeep, each made distinct, plus **the Hoard raid with bots** if Checkpoint 5 is on time (else it leads Season 1). The Ashvents, Pressworks and the other three raids stay in the code and return one per season once each has its own foes. Nothing is deleted.

**Money (recommended, decided at Checkpoint 7):** free download, one **$5.99 unlock** ($3.99 launch week), no ads, never sell power. Free: the opening, the Kiln tiers 1-3, Emberwright and Duskblade, Quick Delve, joining co-op and **hosting one co-op run a day**. Fixes and Omens are free forever; new places and raids after launch may be small paid packs, so seasons aren't an unfunded promise.

### Checkpoints (each playable, measured, then the next scales)
Fresh testers ("cold testers": people who have never seen the game, recording their screen) judge every checkpoint from 2 on; Steve plays each one but can't be a blind judge. The AI playtester driver (tools/playdriver.cjs, #872) gives a cheap first read before humans see it. Durations are judgment.

| # | Checkpoint | Goal | Done when |
|---|---|---|---|
| 1 | **Direction locked** (about 1 week) | Everyone builds the same game | World bible, voice guide and rename map merged; `style.ts` with the palette test; fight-budget and 60%-floor gate fails a deliberately slow test PR; baseline class-by-dungeon matrix at average skill published; event log spec; the "made with AI?" answer written; Steve answers decisions 1 and 2 |
| 2 | **Fun test in grey box** (about 3 weeks), with the **look test** alongside | Prove the new loop is fun before final art | On today's renderer with the camera in and big placeholder shapes: `feel.ts`, dodge, all five verbs, 8 Sparks per class, 4 Relics, the 5-room run with a fork, the enrage and the mastery card, on the public web build with the event log. **Passes when** 3 of 5 cold testers finish a delve and start another unprompted, and 30%+ of web players start a second run. **Look test passes when** cold testers pick the animated clip over today's look and the pixel version |
| 3 | **Vertical slice: the Kiln and the first 15 minutes at final quality** (3-4 weeks) | One whole dungeon and the front door as they will ship | 4 of 5 cold testers finish the opening unaided and 3 of 5 ask for another run; each can say who they are and why they went down; none call it cheap or AI-made; the Kiln Mother falls in 60-90 s for both free classes at average skill; the hub shows Play plus 2 buildings or fewer; Steve says "I'd pay for this" |
| 4 | **Five classes worth mastering** (3-4 weeks) | Every class distinct, fair and fun on the Kiln and Foundry | Every class kills the Kiln Mother in 60-90 s at average skill; the 60% floor holds in both places; no Spark in more than 40% of winning builds; 3 of 5 cold testers name their class's verb unprompted |
| 5 | **Every launch place feels like a place** (6-8 weeks, alongside 6) | Foundry, Glarewell, Coldmarrow, Wrackline, Hammerdeep (and the Hoard raid if on time) at Kiln quality | No two places share a trash list; floor and budgets hold in every place and tier band; art checks green; a cold tester names each place from one screenshot |
| 6 | **The whole game loop** (about 4 weeks, alongside 5) | Hours 1-20 hand the player from one system to the next | A fresh save reaches hour 5 with never more than Play plus 2 new things shown; Journal, Weekly Cache, Heirlooms, Quick Delve (replay-checked leaderboard) live; the loss screen is never empty |
| 7 | **Closed test with the real purchase** (3 weeks build + 14 days test) | Strangers play the free hour and the unlock on real phones | 90%+ finish the tutorial, 40%+ reach the free part's end; 40%+ return day 1 and 15%+ day 7; 99.5%+ crash-free; purchase and restore pass on both stores; offline solo play ready |
| 8 | **Soft launch** (4-6 weeks) | Do strangers rate it, stay and pay? | At least 300 installs before any gate counts; rating 4.5+; 30%+ day 1, 10%+ day 7; 5%+ of tutorial finishers buy; top three complaints fixed |
| 9 | **Worldwide launch**, then Season 1 about 6 weeks later | Live on both stores | Live; rating 4.5+ after 30 days; Season 1 on time and nothing in it is a nerf |

Each checkpoint's tasks by team are in [vision/vision.md](vision/vision.md) section 9; the changes above (the new grey-box Checkpoint 2, smaller first content, interrupts kept, tiers kept at 15, the Hoard raid, the save wipe, the replay-checked leaderboard, the debug renderer, honest AI wording) override it where they differ. Team briefs carry the current queue.

**Getting players (from Checkpoint 2):** the public web build and an itch.io page, a short boss or interrupt clip each week (TikTok, YouTube Shorts, Reddit), a Discord for testers, and a Steam page weighed as a second store. Before the name is final, three 15-second clips test three pitch lines. A small paid ad test only with Steve's yes at soft launch.

**Store risks budgeted:** one Apple review round-trip under guideline 4.2 (a web-shell app must be more than a website: offline play, haptics and the purchase ready before the first submission); iPad support decided at Checkpoint 7 (on with a working layout and screenshots, or off).

### Decisions for Steve (when each is needed)
1. **Now: approve the look test, and retiring 2D if the new look wins.** This reverses the 23 Nov "3D with a 2D fallback" call (a low-power 3D mode covers weak phones). Recommendation: yes; nothing beyond one room is converted until fresh players pick it.
2. **Now: the music.** Keep your Suno songs and disclose AI music where stores ask, or replace them before we charge (human-made CC0 music for tests, then a composer for 8-10 short loops; quotes first, nothing paid until launch). Recommendation: replace before charging, because music is among the most disliked uses of AI in games (vision/research-market.md), but it's your music and your call.
3. **End of Checkpoint 2: the name.** Keep "Horders" or rename (the team suggests *Emberthief*, backup *Kilnward*, both to be store- and trademark-checked). Decided after fresh players repeat back the fantasy, before any store asset.
4. **Checkpoint 7: price and free part,** as recommended above.

**What only Steve can supply, with timing:** fresh testers (about 5 per checkpoint from Checkpoint 2, from friends, r/playmygame or Discord; we write the script and the screen-recording how-to); a mid-range Android test phone or a friend's (about $150-250 if bought, needed by Checkpoint 2 for the 60 fps gate; not bought until Steve says so); a yes on every player-facing name and line batch; then later the composer budget (if decision 2 is "replace"), the store accounts ($99 a year Apple, $25 once Google) at Checkpoint 7, and any ad test at Checkpoint 8.

**Running now:** the store-listing work pauses until the final look and name exist. The QA bug pass and the Android installable build keep going; their fixes carry over.

## 1.0 first-cut checklist (27 Nov 2026, superseded by vision v2 above)

Steve (27 Nov 2026, 08:42Z): "There should be more than that on the 1.0 checklist. I feel like we are very far from having a polished game, with engaging and balanced gameplay, fully flushed out classes and maps and dungeons and art. We have a great start, but we're not anywhere near where I would try to charge for our game." And at 08:45Z: "People will not pay for something that looks like it was thrown together, has no cohesive feel and concepts. And people also have a negative bias towards what they call 'AI slop'. So we can't throw anything on there without it being thought through."

So 1.0 is no longer "finish and ship". It is: **one cohesive world, a game that feels great in the hand, five classes worth mastering, a dozen places that each feel like a place, and a first hour that sells it.** Store steps stay, at the end. The first plan (M1 to M10, 25 Nov) is kept below as history; its done items (everything on, trees, pacing walls, redraws, Capacitor shell) are the base this plan builds on.

### Audit (27 Nov, main 75a7550): what a paying player would see
Checked by building main and shooting every screen at 390x844 (`tools/uxaudit.cjs`), the 3D room sheets in qa/3d-rooms, the average-player playtest (qa/playtest/average.md) and the content files. Strengths are real: 5 classes with trees, 12 dungeons and raids with authored bosses, co-op with roles, Halls maps, a clean dark UI kit. The gaps:

**Cohesion and identity (the biggest gap)**
- There is no world. No file in `sim/` or `client/` mentions lore or a story (grep, 0 files), and docs/design has no setting document. A player never learns who the heroes are, what the Hoard is, why they delve or what embers mean. Names and themes grew one feature at a time (forge, drowned foundry, observatory, frozen deep, quay), so nothing ties them together.
- Two systems are both called "talents": the in-run level-up draft ("Choose a talent") and the permanent tree on the Hero tab. Players will confuse them.
- Vocabulary sprawl. By tier 6 the hub shows Bounty, Key, Weekly, Seen, Season, Omens, Potion and Vent Floor chips, and the Hero tab adds Collection (60) and Achievements (19). Add embers, Heat, Grit, Quench, Echoes, verb sets, weapon effects, Mythics and the world boss. Each works, but together they read as bolted on, not designed.
- Generated-sounding names. Gear is `RARITY_PREFIX + SLOT_NAMES` (sim/content/items.ts:107-132): "Titanheart Hauberk", "Tidebreaker Coil", "Rimeburnt Focus". This is exactly the pattern players call AI slop.
- The 3D look mixes 2D billboard sprites (small heroes with "Hero 2" name tags) over 3D floors, with each dungeon washed in one strong colour (qa/3d-rooms/rooms-sheet-0.png). Heroes are about 30 px tall on a 390 px wide phone. The hub dungeon cards have no art at all, only a gradient and text (13-01-hub.jpg).
- Sound effects are synthesized in code (client/audio/synth.ts, sounds.ts); music is Suno. Both are fine as a base, but nothing checks that they share one palette, and synthesized effects can read cheap next to the music.

**Feel**
- Trash is tiny on a phone (cinderhounds are a few pixels, 13-08-hud.jpg); hits have little weight. Screen shake exists in 4 files, hit-stop in 1. No feel pass has ever been done as its own task.
- Boss fights still run long for some classes (Slagbinder wins average 581 s vs Duskblade 323 s, average.md; Kiln t1 Slagbinder boss 56 s), and the scripted audit run (`tools/uxaudit.cjs`, an Emberwright at tier 6) lost the Kiln Mother to Burnout after 6:08 ("the fight ran too long").

**Classes**
- Melee falls apart at average skill in the later solo dungeons: Coldmarrow t10 Duskblade and Bulwark 0/40, Glarewell t8 Bulwark 6/40, while ranged win 29-39/40 (average.md). M3 eased two cones, but the class spread at average skill was never re-measured across every dungeon.
- Ability options lean on skill (Bulwark Muster 24/40 vs Anvil Skin 6/40 at average skill) and nothing steers players.
- Classes have one hero sprite each; no class has its own look in the hub, intro or end screen.

**Dungeons and maps**
- Seven of twelve places share one trash pool. The Hammerdeep, Ashvents, Pressworks and all four raids draw their openers from the same Kiln and Foundry packs (warpack, glass, crawlers, riftfall, glassSpitters, spitters; named anvilguard, bellwarden, spitterBrute), sim/content/dungeon.ts:211-249. The Pressworks' list is the Hammerdeep's. Only the boss differs.
- A new player sees only the Kiln for tiers 1-3 (Foundry and Hammerdeep open at tier 4, dungeon.ts:186-214), while the hub shows twelve dots.
- Rooms in one dungeon look alike (one floor, one wall, one colour); there are no landmark rooms or set pieces.

**Onboarding, UI and progression**
- No title screen, no hook, no "who am I" moment: the first screen is the delve picker. The tutorial Kiln (#859) teaches moving and fighting, not the world or roles.
- Gear tiles are text only (no item icons, 13-06a-tab-hero.jpg); the end screen is half empty (13-13-end-full.jpg); a loss shows four numbers and no lesson beyond one line.
- No mapped progression curve: nobody has written what a player does and wants at hour 1, 5, 20 and 50, so the many meta systems compete instead of handing off.

### How this plan works
- **Tracks, not one queue.** Nine tracks (A to I). Each item is one short thread with a done-when bar. Teams take the top open item in their track; the order of tracks is the order of priority when threads are scarce.
- **Gate:** track A (world, art direction, vocabulary) comes first. Any new art, sound, names or text waits for A1 and A2, so nothing new is thrown on before the direction is set. Feel, balance and measurement work (B, C, parts of F and H) doesn't wait.
- **The cohesion test, for every PR from now on:** does it fit the world bible (A1), the art and sound guides (A2, G1) and the glossary (A3)? A PR that adds a player-facing name, icon, colour, sound or line of text says which guide it follows. Nothing generic: every name, item and line is written for this world.
- **Content lock, revisited.** Still no new dungeon, raid, class or mode for 1.0 (the Arena waits). Allowed now: new trash foes and packs so each place has its own (D2), landmark rooms (D1), and cutting or merging systems (A3).
- Unchanged: no switches (Steve 25 Nov), keep it simple and still a mini WoW, store-safe always, nothing paid before the end, Steve only when truly needed.

### Track A: one world, one look (first, gates new art and text)
| # | Item | Owner | Done when |
|---|---|---|---|
| A1 | **World bible.** One short doc: the setting (built from what exists: the Kiln, the Hoard, embers, the Furnace Regent), who the heroes are and why they delve, what embers and the Hoard are, the tone (grim-warm, a little wry, never jokey), the factions behind each dungeon, naming rules (sounds, word shapes, banned generic words), and one line placing every class, dungeon, boss and foe | design | docs/design/world.md merged; every dungeon, raid, boss, class and foe kind has its one line; naming rules have a do and don't list |
| A2 | **Art direction guide and target shots.** Palette per dungeon inside one master palette, shape language (menacing foes, readable heroes), hero and foe scale on a phone, camera, lighting, UI style, icon style. Decide one rendering approach (keep billboard sprites and make them sharper and bigger, or move heroes and foes to low-poly models) and show 2-3 directions as mocks of one Kiln room and the hub | visuals | docs/art/direction.md merged with mocks; **Steve picks one direction** (one card, the only Steve step in A); every later art PR cites it |
| A3 | **Vocabulary and systems pass.** One glossary of every player-facing term. Rename the in-run draft so it isn't "talents" (e.g. Boons). Merge or cut meta systems so the hub shows at most 4 meta entries by tier 6 (e.g. Seen + Collection + Achievements become one book; Bounty + Weekly become one "Today" card). Replace the gear name generator with hand-written names per dungeon and rarity | design, engineering | docs/design/glossary.md merged; no term is used for two things; hub chip count at tier 6 is 4 or fewer; no gear name comes from prefix + slot alone |
| A4 | **Slop sweep.** Walk every screen, tooltip, blurb and icon and list anything generic, inconsistent or placeholder (mixed icon styles, Unicode stars and keys as icons, generic names, filler text, odd colours). Fix each in small PRs against A1-A3 | design, visuals | a sweep list in docs/ux/slop-sweep.md with every line fixed or cut |
| A5 | **The name.** Check "Horders" against both stores and the web for clashes and readability (players may read it as "hoarders" misspelled); keep it or pick a final name before any listing work | design | a short note with the searches; the name is settled (a card to Steve only if we recommend a change) |

### Track B: game feel
| # | Item | Owner | Done when |
|---|---|---|---|
| B1 | **Hit feel.** Hit-stop on big hits and kills, hit flashes, small knockback on trash, death bursts, screen shake with a setting to turn it down, haptics on big hits (phones) | engineering, visuals | before/after clips of the same fight; a "Screen shake" setting; frame rate unchanged on the cost bar |
| B2 | **Readable on a phone.** Heroes and foes big enough to read at 320 px wide; class silhouettes tell apart at a glance; no "Hero 2" name tags in solo, short names in co-op; foes never hide under the HUD (the boss-under-buttons bug, average.md) | visuals, mobile | at 320x568 every hero and foe is at least 40 px tall (set in A2); a shot sheet of all five classes and every foe family |
| B3 | **One telegraph language.** Every danger uses the same shapes and colours (red floor = move, gold = stand, blue cast bar = Quench, lane = step aside) across all 12 places | design, visuals | docs/art/telegraphs.md; a sweep shot of every boss and elite telegraph matches it |
| B4 | **Controls.** Joystick dead zone and feel, targeting that picks what the player expects, ability buttons that press, glow when ready and shake when not | mobile, engineering | 5 short phone checks pass on iPhone (Steve's) and a 320 px emulator; no mis-tap reported in the QA pass |
| B5 | **Fight lengths.** Targets: trash pack 5-15 s, elite 20-45 s, dungeon boss 60-120 s, raid boss 2-4 min, run 8-12 min. Measure all 12 bosses for every class at average skill and pull the long ones in | design | a table of boss length by class; no class over the target by more than 30% |
| B6 | **Frame rate and loading.** 60 fps on Steve's iPhone 15 Pro Max, 30+ on a mid Android, level load under 5 s | engineering, QA | numbers logged for each dungeon in qa.md |

### Track C: classes worth mastering
| # | Item | Owner | Done when |
|---|---|---|---|
| C1 | **Average-skill spread.** Re-measure every class at average skill at each dungeon's entry tier and its tier + 3, solo dungeons first; fix the melee walls (Coldmarrow, Glarewell) | classes, design | every class within 10 wins of 20 of the best class at each point, smallest grid that answers it |
| C2 | **Each class its own fantasy.** A one-paragraph identity per class tied to the world (A1); its own colour, sound family and hit effects; its abilities look and sound like one kit | classes, visuals, sound | docs/design/classes/<class>.md; a shot and sound sheet per class |
| C3 | **Choices that matter.** No ability option or talent picked by the bots' best builds over 70% of the time; options that need skill say so; the tree shows a suggested build for new players | classes | a pick-rate table from bot runs; a "Suggested" button on the tree |
| C4 | **Teach the role.** First time a player picks the Bulwark or Lumen, a short role intro (hold threat, keep allies up) | classes, design | intro shown once per class; shots at 320x568 |
| C5 | **Bots that play their role.** Bot tank holds threat, bot healer keeps the party up, in every group dungeon and raid | engineering, classes | bot-filled parties clear each group dungeon at its entry tier at the same rate as a human-like average party (within 3 of 20) |

### Track D: places that feel like places
| # | Item | Owner | Done when |
|---|---|---|---|
| D1 | **Landmark rooms.** Each of the 12 places gets 1-2 set-piece rooms that tell its story (from A1) and break up the look: a different floor, props, light, one piece of quiet motion | visuals, design | a shot of each landmark; still under the cost bar (96) |
| D2 | **Own trash for the group dungeons and raids.** Each of the 7 places sharing the Kiln/Foundry pool gets 2-3 packs of its own (new foes allowed, each with a 3D tell and a sound) | design, visuals, sound | no two group places share more than 2 opener packs; Pressworks and Hammerdeep lists differ |
| D3 | **Boss moments.** Each boss gets an entrance (name card plus a beat of motion), clear phase changes and a death moment; the room is its own space | visuals, sound, design | a clip per boss; every boss passes the telegraph check (B3) |
| D4 | **Early variety.** A new player sees a second place before tier 4 (for example the Foundry from tier 2 or 3) | design | first 3 tiers offer 2 places; tier 1-3 novice wins unchanged |
| D5 | **Room variety per dungeon.** At least 3 map templates per solo dungeon with distinct room shapes, and packs that use the room (pillars, water, light) | design, engineering | template count per dungeon in docs/design; QA stuck checks pass on each |

### Track E: first hour and UI
| # | Item | Owner | Done when |
|---|---|---|---|
| E1 | **Title and first five minutes.** A title screen with key art, a two-line hook from the world bible, class pick with a portrait per class, then the tutorial Kiln. New systems appear one at a time as they unlock, each with one line | design, visuals, engineering | a fresh-player clip from launch to the first Kiln win; no meta chip shows before it means something |
| E2 | **Hub with art.** Dungeon cards with their own art, the hero shown in the hub, at most 4 meta entries (A3), a clear "what next" | visuals, engineering | hub shots at 320x568 and 390x844 match the A2 mocks |
| E3 | **Loot you can see.** An icon for every item slot and rarity, a compare view (better or worse at a glance), set and Mythic effects readable on the card | visuals, engineering | every gear tile has an icon; compare shown on pickup |
| E4 | **End of run.** Victory and loss screens that fill the space well: loot reveal, XP, what killed you and one tip, next goal | engineering, design | shots for win, loss and no-loot runs at both phone sizes |
| E5 | **Settings and access.** Text size, colour-blind safe telegraphs (shape as well as colour), shake and flash off, music and sound sliders, left-handed buttons | mobile, engineering | each setting works in a run; colour-blind sim shots of three bosses |

### Track F: progression and retention
| # | Item | Owner | Done when |
|---|---|---|---|
| F1 | **The progression map.** Write what a player does and wants at minute 10, hour 1, 5, 20 and 50, and which system carries each stage; cut what doesn't carry a stage (feeds A3) | design | docs/design/progression.md merged |
| F2 | **Measured curve.** Bot-measured time to each level, tier and dungeon unlock, and first Epic, Legendary, Mythic; fix dead stretches | design | a table against F1's targets; no stretch over 2x its target |
| F3 | **Upgrades that feel like upgrades.** A new item changes something visible (numbers that move, effects you notice); sets and Mythics change how you play | design, classes | a 30-minute bot run shows an upgrade at least every 2-3 runs at each stage |
| F4 | **One endgame loop.** Keys, season, world boss and raids form one clear "what do I do at max tier" path in the hub | design | one hub entry for the endgame; F1 stage 20-50 h points to it |
| F5 | **Saves you can trust.** Cloud save, link codes and resets tested on both phones, including app updates | QA, engineering | checklist passes in qa.md |

### Track G: sound
| # | Item | Owner | Done when |
|---|---|---|---|
| G1 | **Sound direction.** One palette (materials: iron, ember, stone, water, glass) for effects and music, written down; music themes per dungeon checked to sound like one game | sound | docs/audio/direction.md; a listening file per dungeon |
| G2 | **Effects pass.** Replace synthesized effects that read cheap next to the music, hit sounds with weight, UI sounds as one set | sound | before/after listening file; distance test still passes |
| G3 | **Mix.** Loudness matched across tracks, music ducks under big moments, boss music transitions without gaps | sound | measured loudness per track within 2 LU |

### Track H: quality and outside eyes
| # | Item | Owner | Done when |
|---|---|---|---|
| H1 | **Full QA pass** (was M5): every dungeon at tiers 1, 4, 8 and every raid, solo and co-op with Quick join and bots, a new-player session | QA | 0 stuck runs and no open blocker in qa.md. Run once now for bugs, and again after tracks A-E land |
| H2 | **Error reports.** Catch client errors into our own Supabase table (no outside service), and say so in the privacy page | engineering | errors visible in a table; privacy page updated |
| H3 | **Fresh eyes.** 5 or more players who have never seen the game play the first hour on their phones; we watch where they stop, get lost or smile | QA, design; Steve finds the players | notes from each session; top 10 fixes done |
| H4 | **Steve's own playthrough** (was M9's play check) | Steve, QA | Steve says it feels like a game worth paying for |

### Track I: ship (last; unchanged steps from M6, M8, M9, M10)
| # | Item | Owner | Done when |
|---|---|---|---|
| I1 | Store pages in the game (was M6): contact email on privacy and delete pages, both live | engineering; Steve sends the email | pages live with the address |
| I2 | Real-phone checks (was M8): every item in [app-stores.md](app-stores.md#check-on-a-device-not-proven) on an Android phone and in iPhone Safari | QA, mobile, sound; Steve installs builds | each item passes or is fixed and re-checked |
| I3 | Price and business model: paid up front, free with one unlock, or IAP; written up with store rules, decided by Steve once H4 is close | design; Steve decides | one card to Steve with a recommendation |
| I4 | Listing (was M9 prep): name (A5), descriptions, **screenshots and a trailer from the final look**, age rating, privacy labels, Data safety | design, visuals | docs/store/ ready; screenshots taken after tracks A, D and E land |
| I5 | Accounts and release (was M10): Apple and Google accounts (Steve, paid), TestFlight, Play closed test (12 testers, 14 days), review | Steve; engineering, QA | both stores show Horders 1.0 live; the same build on the site |

**Order when threads are scarce:** A1, A3 and C1 now (no art needed); A2 next (Steve picks a direction); then B1, B2, B5, E1 and F1; then D, E2-E5, G; then H1 again, H3, H4; then I. The Android installable build (I2 prep) and a first QA bug pass (H1) can keep running. **Store listing work (I4) waits** until the final look exists, so screenshots aren't made twice.

**Steve-only steps**, in order: pick one art direction (A2); send the Horders contact email (I1, nothing waits on it); install test builds (I2); help find 5 fresh players (H3); play the whole game (H4); pick the price model (I3); then, last, open and pay for the store accounts and submit (I5). Nothing paid before I5.

## 1.0 first plan (25 Nov 2026, kept as history)

Steve (25 Nov 2026, 22:24Z): "Ideally we have a roadmap and you would continue building towards our 1.0 launch and release on app stores." 1.0 is one build that goes live on the site and on both stores. The milestones run in this order, and each team's next tasks are in the "1.0 queue" of its brief (`/mnt/project-files/horders/teams/<team>.md`), so a fresh short thread can pick one up.

Rules for every milestone:
- **No switches.** Nothing ships behind a beta flag or `?…=1` setting. A feature is built, checked and on by default in the same PR series (Steve, 25 Nov 22:23Z).
- **Content is locked for 1.0.** No new dungeon, raid, class or mode. The Arena (Phase 17) waits until after 1.0. Work goes into finishing, pacing and polish.
- **Keep it simple, still a mini WoW.** One clear rule over several tuned ones.
- **Store-safe always** (Phase 19): bundled code only, no outside asset hosts, no purchases or ads, and every account gets a delete path.

| # | Milestone | Owner | Done when |
|---|---|---|---|
| M1 | ✅ **Everything on.** Every built feature behind a flag (the Foundry trash and any other `*_BETA` list) is checked and turned on, or cut | engineering, design | `HALLS_BETA` and `TRASH_BETA` are gone or empty, no player-facing `?…beta` setting is left, and `npm test` passes. Thread "Turn on every switched-off feature". ✅ Done: every flag removed (#823), trash on in every solo dungeon (`TRASH_ON` in sim/halls.ts) |
| M2 | ✅ **Classes finished.** A talent tree for every class (Bulwark #799, then Duskblade, Emberwright, Lumen, Slagbinder), on by default with a hub tree screen; ability unlocks by level (Q1, E2, R3, F4); the interrupt split last ([brief](https://claude.ai/artifact/W5qaXNLrbnvriJ7AZRD3Vz)) | classes, engineering (tree screen), visuals, sound | All five trees are on in main, every new talent is in `BOT_PRIORITY`, the L7 class spread holds (under 10 points at tiers 1, 4, 6, 8), and the tree screen fits 320x568. Thread "Build talent trees for every class". ✅ Done 26 Nov: five trees on for everyone (#833), unlocks Q1 E2 R3 F4 (#835), slot options at 8, 12 and 16 (#836-#840), the interrupt split (#841) |
| M3 | ✅ **Pacing and walls.** The trash rule on the remaining solo dungeons (Glarewell, Coldmarrow, Wrackline, one per PR); the Foundry tier 6 wall and the group-dungeon wall for average players; top tiers still scale | design | Each solo dungeon has fast trash on by default; the novice reference (LAG=0.3 SKILL=0.5) wins tiers 1-3 and an average player can clear Foundry t6 and the Hammerdeep t4-6 with a full party, measured with the smallest grid that answers it. 🔨 26 Nov: trash on in every solo dungeon; Foundry t6 average wall eased (Maelra cones #827, her floor circle 32 -> 22: Duskblade 21 -> 30, Emberwright 23 -> 33 of 40, #842). ✅ Done 26 Nov: the Hammerdeep t4-6 wall doesn't reproduce (full party, 20 seeds: average 20/20 at t4 and t6, novice 20/20 and 18/20), so no change; a tip tells a party with no true interrupter why bosses shrug off stuns (#843) |
| M4 | ✅ **Look and sound finished.** Menacing foes everywhere, redrawn by hand (no paid AI model tool before 1.0); the Slagbinder's cannon model, tracer and sound; the Flue's room beds | visuals, sound | No foe on the redraw list in visuals.md still looks round or friendly; every room and boss arena is under the draw-cost bar (96); every sim event has a sound cue. 🔨 26 Nov: the Slagbinder's cannon look is in (cannon on the hero in 3D and 2D, recoil pose, a tracer in both views, the Recoil icon; docs/art/slag-cannon). ✅ Since: all trash and boss redraws (#845-#848), every room and arena under the cost bar near walls and rims (#849), the Flue's four room beds (firebox, damper, soot, sweep). Since: own sounds for the ten new ability options and the cannon (#852); their cast effects drawn on the floor so 3D shows them, and four icons redrawn (docs/art/option-casts). ✅ Done 26 Nov: #852 and #854 merged |
| M5 | **Polish and bugs.** A full QA pass of every dungeon and raid, solo and co-op with Quick join and bots; a new-player first session; the open phone items (the Downstroke banner); 2D fallback and the battery setting | QA, mobile | A pass of every dungeon at tiers 1, 4 and 8 and every raid with 0 stuck runs and no open bug marked "blocker" in qa.md; every screen checked at 320x568 and 568x320 |
| M6 | 🔨 **Store requirements in the game.** 27 Nov: privacy policy and delete-account pages built and linked from Settings (#866, `client/public/privacy.html`, `delete-account.html`); live with the next deploy. Left: a contact email on both pages (Steve makes a free Horders-only address; marked `CONTACT EMAIL` in both files).  Phase 19 P1: Delete my account in Settings (removes the cloud save, leaderboard rows and the auth user), a privacy policy page and a deletion request page on the site, both linked in the app | engineering (design writes the text) | The delete path works end to end on the live site after Steve says yes to its migration, and the two pages are live |
| M7 | ✅ **Capacitor shell.** Phase 19 P2: `capacitor.config` with `webDir: 'dist'`, Android and iOS projects, icon and splash, no pinch zoom or text selection, Android API 36. Android builds in the cloud; iOS builds on a GitHub Actions macOS runner (free for public repos), so Steve's Windows PC is enough; the first M7 PR confirms the runner has Xcode 26. 🔨 26 Nov: app icon and splash sources in `assets/` (#850). 🔨 26 Nov: the shell is in (`capacitor.config.ts`, `android/`, `ios/`, Capacitor 8.6.3, app id `com.steveglanz.horders`, target API 36, icons and splash generated); the "App shell" workflow builds a debug APK and an unsigned iOS simulator build ([app-shell.md](app-shell.md)). ✅ 26 Nov: the `android-play` job installs the debug APK on an Android 15 emulator and plays a Kiln delve on autopilot inside the app (3D look on, won, 79 kills, no page errors) (#861). M7 done | engineering, visuals (icon, splash) | `npx cap sync` runs in CI, a debug Android build installs on an emulator and plays a delve, and an iOS simulator build passes in CI. Nothing is uploaded to a store |
| M8 | **Real-phone tests, free.** Phase 19 P3: every item in [app-stores.md](app-stores.md#check-on-a-device-not-proven) (pause and sound on background, safe areas, WebRTC co-op, Supabase from the app origin, saves across restarts and updates, haptics, frame rate and the first 3D delve). Android: a debug build installed straight on the phone, no store account. iPhone: the site in Safari now; the in-app iPhone check waits for M10 (TestFlight needs the paid Apple account) | QA, mobile, sound; Steve installs the builds | Each item has a pass, or a fix merged and re-checked, on an Android phone and in iPhone Safari |
| M9 | **Our own 1.0 check and store prep, free.** Steve and the teams play the whole game on phones; open bugs fixed. Store listing work that needs no account: name check, descriptions, screenshots (docs/store/), age rating answers, privacy labels and Data safety answers | design, QA, visuals; Steve plays | Steve says the game feels like a true 1.0, and the listing text and images are ready in docs/store/ |
| M10 | **Accounts and release (Steve, paid, last).** Phase 19 P4 and P5: Apple Developer Program (99 USD a year), Google Play (US$25 once, plus identity verification), the in-app iPhone check on TestFlight, the Play closed test (12 testers, 14 days in a row), then review. Nothing is paid or opened before M9 is done (Steve, 25 Nov 22:36Z) | Steve; engineering (signed builds), QA | Both stores show Horders 1.0 live, and the same build is deployed to the site |

**Steve-only steps**, in the order they come up: make a free email just for Horders and send it (the contact on the privacy and delete-account pages, needed before M10; nothing waits on it now); say yes to the Supabase migrations (0005 and the account-deletion one) and to each deploy; install test builds on his phones (M8); play the whole game and call 1.0 (M9); then, last, open and pay for the store accounts, find 12 testers and submit (M10). Steve (25 Nov 22:36Z): "Anything you can do without me do it. If you need payments just hold on that for me and until we are actually nearing a true 1.0 with our own testing and polish." So no paid tool, key or account is asked for before M10; foes stay hand-built (no Meshy).

## Phases (plan of record, 21 Nov 2026)

Steve (21 Nov 2026): "Keep it all building, we should have phases and features planned that can keep going." Each team takes the top open item in its column and moves on to the next one when it's done. Each item is its own PR, labelled `automerge`. When something blocks an item, skip to the next one and tell the owning team.

**Phase 1: Foundations ✅** (shipped). This covers:
- Four classes, three solo dungeons and the Forge.
- Omens, the daily bounty, potions, verb sets and weapon effects.
- Co-op for 1 to 4 heroes with Quick join.
- The Hammerdeep group dungeon.
- Cloud saves.

### Phase 2: Groups (now)
Make playing together the best way to play.

| # | Feature | Owner | Notes |
|---|---|---|---|
| G1 | **Role kits pass:** each class gets one group tool (Bulwark taunt-swap cue, Lumen cleanse button, Duskblade threat dump, Emberwright party buff) | skills | ✅ Built (docs/skills.md, "Group tools"; tests/grouptools.test.ts). Solo unchanged (hashcheck) |
| G2 | **Ondrel art and readability:** sprite, Anvilfall target marker over the hero, Slag Grip stack pips | visuals | ✅ #58 (Ondrel sprite, Anvilfall marker, Slag Grip pips) |
| G3 | **Second group dungeon boss** for tier 7+: the "split" check (party must stand in two places) and the "spread" check (no stacking) | design | ✅ #66 (the Ashvents: Ysmeret, split and spread; group-dungeons.md). Retuned with revives in #173 |
| G4 | **Party HUD:** party frames with health, role icon, Slag Grip and down state; a ping on the hero Ondrel targets | engineering | ✅ Frames, down and revive state, Slag Grip pips and the Anvilfall marker (visuals #41, #58); Tank and Healer chips on the frames (an Anvil Slagbinder counts as a tank) |
| G5 | **Group loot rules:** every hero gets their own boss item; group dungeons add a second Rare-or-better item each | design | ✅ built (it was killer-only before) |
| G6 | **Revive between fights and in fights:** a downed hero can be picked up by standing on them for 3 s | engineering + design | ✅ built. Boss rules: one pick-up per boss fight, 9 s while the boss is up (docs/design/group-dungeons.md) |
| G7 | **Group cues in sound:** tank-buster warning, party hit, "you're targeted" | sound | ✅ Boss wind-ups by cast id (CAST_SOUNDS), a "you're targeted" sting for Anvilfall, ally/tank/healer down calls, pick-up cues; priority cues duck the rest (tools/busycheck.ts) |
| G8 | **Co-op QA sweep:** 2, 3 and 4 heroes, a guest dropping mid-fight, Quick join role matching, the Hammerdeep solo block | QA | ✅ tools/coopsweep.cjs (solo block, parties of 2-4, guest drop, Hammerdeep boss revive cap, `--raid` for the guest's Swap tanks! cue); Quick join in tools/quickjoincheck.cjs, roles in tests/lobby.test.ts. Real Safari co-op still needs a device (headless WebKit has no WebRTC) |
| G9 | **Third group dungeon** for tier 10+: a new group check | design | ✅ The Pressworks: boss Oskel, Downstroke "take turns" soak (Pressed heroes can't take the next one), Rivets, Stamp ([group-dungeons.md](group-dungeons.md)). No Fill with bots there. Its verb set (the Relayer) and achievement (Pressbreaker) are in |

### Phase 3: Content
More places to go, so the weekly loop has variety.

| # | Feature | Owner | Notes |
|---|---|---|---|
| C1 | **Fourth solo dungeon** (tier 10+): a new verb, e.g. carrying a light source, or a moving safe zone | design | ✅ #90 (the Coldmarrow: carry your Hearthcoal through the dark; coldmarrow.md). Thin Ice #141, huddle #142 |
| C2 | **Rare spawns and named elites:** one surprise named foe per delve, with its own loot table | design | ✅ #95 (sim/content/named.ts; named-elites.md) |
| C3 | **Raid (R9):** an 8-minute, 4-hero world boss fight with phases, built on the world boss bar | engineering + design | ✅ #100 (the Crucible and Grandmother Slag; raid.md). Tank swap #150. The Crucible drops the Kinbound set ("cover each other") |
| C4 | **New enemy families** for C1, plus art for every placeholder enemy left (Glarewell, Hammerdeep trash) | visuals | ✅ Every enemy has drawn art (checked 21 Nov 2026): Glarewell #31, Hammerdeep #58, Ashvents #72, Coldmarrow #74, the raid #108 |
| C5 | **Class talents round 2:** a third talent branch per class (capstone choices) | skills | ✅ Every branch has two capstones (docs/skills.md, "Second capstones" parts 1 and 2), plus two deep cards per branch for every class (docs/skills.md, "Class talents round 2") |
| C6 | **Dungeon themes and ambience** for C1 and the raid; a boss phase-change sting for each boss | sound | ✅ A theme and texture bed for every dungeon and the raid (client/audio/music.ts), a phase sting per boss (PHASE_STING), and season hub themes (#210) |
| C7 | **Content QA:** each new dungeon's soft-lock check (can a run get stuck?), and the bot win-rate table in balance.md | QA + design | ✅ #106 (tools/contentcheck.ts soft-lock check); bot tables live in balance.md and l7-lock.md |
| C8 | **Fifth solo dungeon** (tier 13): a moving safe zone | design | ✅ The Wrackline ([wrackline.md](wrackline.md)): rafts drift, and the Ebb drags anyone off one toward the drain. Boss Hessa of the Ebb, with the Ebbproof achievement and the Wrackrider set (stand fast). Visuals: sprites for the Shoal Lurker, Barge Hauler and Hessa. Sound: a theme and cues |

### Phase 4: Progression and retention
Reasons to come back tomorrow and next week.

| # | Feature | Owner | Notes |
|---|---|---|---|
| P1 | **Weekly quests:** 3 goals a week (beat X with Y, interrupt 30 casts), paying embers and a cosmetic | design | ✅ #110 (sim/content/weekly.ts) |
| P2 | **Season track:** 30 levels over 6 weeks, earned by playing, with cosmetic rewards only | design + engineering | ✅ season.md (local track, titles and glows). ✅ Each season has a dungeon in season (+60 marks a win): Season 2 (31 Dec) is the Hammerdeep. ✅ Season trails at levels 8, 18 and 28 (data, sheet, wear). Visuals: draw them in runs. Engineering: send them in co-op looks. ✅ Visuals: glows render under the hero in runs (#137). Engineering: P6 shows the worn title in co-op |
| P3 | **Mythic+ style keys:** clear a tier and get a key for +1 with one more Omen; a leaderboard per dungeon | design + engineering | ✅ #117 (Delver's Keys). ✅ Leaderboard live (migration 0004). Design: a fresh board each season is specced in [keys.md](keys.md#for-engineering-a-board-per-season-21-nov-2026); engineering to build |
| P4 | **Collections:** a set and Mythic book with completion rewards | design + visuals | ✅ collections.md (sim, hub sheet, end-screen notes). ✅ Visuals: book art (#138) |
| P5 | **Hero roster:** a second hero slot, with account-wide embers | engineering | ✅ One character per class (switch on the title screen) and one shared ember purse; old per-class purses are added together on load (economy.md, Shared purse) |
| P6 | **Achievements and titles** shown over your hero in co-op | engineering + visuals | 🔨 Engineering: the worn season title (under the name) and glow (under the feet) now show over each hero in co-op, cleaned on receipt (client/net/coop.ts cleanLooks). Design: ✅ achievements built ([achievements.md](achievements.md)): 14 deeds, each a title, hub sheet, end-screen notes. ✅ Visuals: a medal per achievement (#161) |
| P7 | **Economy pass:** ember sources and sinks over 20 runs; check Rising Draught isn't bought every run | design | ✅ #114 (Rising Draught scales with tier); Forge rate settled in economy.md |

### Phase 5: Launch polish
Make it feel finished on a phone.

| # | Feature | Owner | Notes |
|---|---|---|---|
| L1 | **First 10 minutes:** a tutorial delve (one fight per verb), and tooltips the first time each mechanic shows up | design + engineering | ✅ First delve built ([first-delve.md](first-delve.md)): teaching route, softer foes, coach lines; novice first-run wins 50-65% → 90%+. 26 Nov (Steve): the first delve is now a very small room-to-room tutorial Kiln (4 rooms, 3 fights, about 2 minutes, novice 100%), and the Kiln tier 1 boss is shorter. First-time tips for red and gold circles (client/coach.ts) |
| L2 | **Performance:** 60 fps on a mid phone with 4 heroes; asset sizes; a load time under 3 s | engineering | 🔨 Load: about 3 s on slow 4G (2.80 to 3.05 s on 21 Nov after the Wrackline content, tools/partyperf.cjs) with a trimmed Phaser build that also drops Phaser's unused sound system. New content keeps adding bytes, so this needs watching. 23 Nov re-measure (main after #498, tools/partyperf.cjs): 1,813 KB page, 486 KB gzipped; the title paints at 0.4 to 0.85 s but is usable at 3.4 to 3.7 s on slow 4G (over the 3 s goal; 2.5 s of that is the download). The tool sends gzip -9; Netlify sends Brotli to browsers that ask for it, which at the highest setting is 402 KB here (19% smaller), but Netlify's own Brotli setting isn't published, so the real figure needs a check on a phone. Phaser is most of the script (its WebGL renderer alone is about 0.9 MB of source). Frame rate on a real mid phone still needs a device 24 Nov, 3D on by default (main a4f592f, tools/hd2dload.cjs, slow 4G and 4x CPU, files gzipped): the title is usable at about 3.5 s in both looks and hd2d.js (167 KB gzipped) only fetches after it. The first Delve takes 2.4 s in 2D (?hd2d=0) and 7.5 s in 3D (median of 3). The extra time is one long task of about 5 s after Delve (3 s at 1x CPU). About 1.1 s of it is the 3D build and first frame (hd2dTimes). Most of the rest is native GPU work in this machine's software GPU (SwiftShader). Turning off three.js's shader error check didn't change it (5.1 to 5.0 s). A real phone GPU should be much faster, so this needs a check on a phone; Steve said a few seconds of loading per level is fine. |
| L3 | **Accessibility:** colour-blind telegraph palettes, a reduced-shake option, text size | visuals + engineering | ✅ #61 (shake setting, colour-blind palette with hatching), #126 (text size) |
| L4 | **Audio mix and settings:** volume sliders, mute-on-blur, and a phone-speaker pass on every theme | sound | ✅ Music and Effects sliders and haptics in the pause menu, silence while the tab is hidden, every SFX and theme keeps ≥25% above 350 Hz (tools/mixcheck.ts, tools/themecheck.cjs, #246) |
| L5 | **Store page assets:** icon, screenshots and a 30 s trailer capture | visuals | ✅ #68 (docs/store/), screenshots refreshed in #132 |
| L6 | **Full regression and device QA:** iOS Safari, Android Chrome, desktop; save migration; offline | QA | 🔨 Engineering part done: tests/save-migration.test.ts loads every older save shape with nothing lost, and tools/offlinecheck.cjs plays a delve with the cloud refused and keeps the hero across a reload. Real devices still need QA |
| L7 | **Balance lock:** class spread under 10 points at tiers 1, 4, 6 and 8 in every dungeon | design + skills | ✅ #124; tables in /mnt/project-files/horders/skills/balance/l7-lock.md Re-checked with five classes on 21 Nov: all cells pass (the Slagbinder is at most 8.7 below the Emberwright) |

### Phase 6: Live (proposed by game design, 21 Nov 2026)
Phases 2 to 5 are built, apart from real-device work. Phase 6 keeps every team building toward a game that runs for months: new seasons, more reasons to group, and finishing the Pressworks.

| # | Feature | Owner | Notes |
|---|---|---|---|
| V1 | **Party quest:** a weekly quest for 2 group wins with another real hero | design | ✅ #266 (weekly-quests.md, "The party quest") |
| V2 | **Seasons 5 and 6:** new themes, so the rotation doesn't repeat Season 1 from 6 May 2027 (week 2992). Featured dungeons: the Pressworks (group), then the Wrackline (solo) | design | ✅ The Falling Press and the Low Ebb (season.md, "Seasons 5 and 6") |
| V3 | **Pressworks content QA (now W5):** the soft-lock check, and a co-op sweep with a guest dropping during a Downstroke | QA | ✅ #278, see W5 |
| V4 | **Talent branch traps:** the Emberwright's Ashguard and the Slagbinder's Crust can't finish a boss | skills | ✅ #276 (Ashguard, Crust), #277 (Forge, Grace, Wildfire): damage riders stated on the cards; every branch within ±10 of 40, Forge just outside at -11. Follow-up: W4 |
| V5 | **Season 3 key art and colours** | visuals | ✅ #252 (SEASON_ART[2], glow marks, Rime Dust frost trail). Next: Season 4 art, then 5 and 6 (/mnt/project-files/horders/design/season5-6-brief.md) |
| V6 | **Season 3 hub theme**, and a cue for the Relayer buff (`Player.relayT`) | sound | ✅ hubHearth (Season 3), the Relayed cue #265, and hub themes for Seasons 4 to 6 #272 |
| V7 | **Bots in online co-op:** 2 or 3 real heroes top up with bots, under the bot-fill limits | engineering + design | ✅ #270. Drops kept: 40%, 60% or 80% for 3, 2 or 1 bots; each real player added pays more (botfill.md) |
| V8 | **Daily bounty leaderboard** by clear time | engineering | 🔨 Built (#261): "Today's fastest" in the bounty sheet, server rules in supabase/migrations/0006_bounty_board.sql. 0006 applied on 22 Nov after Steve's yes, so the board is live |

### Phase 7: The world bosses in person (planned by game design, 21 Nov 2026)
Phase 6 is built, apart from the bounty board's migration. Phase 7 brings the next world boss down from the server bar into a fight, as the Crucible did for Grandmother Slag.

| # | Feature | Owner | Notes |
|---|---|---|---|
| W1 | **Rename Ashmaw to Vorhulm:** "Ashmaw" is a WoW NPC title (Maxnar the Ashmaw) | design + engineering | ✅ Design: the Kiln rare's display names (#289). 🔨 Engineering: migration 0007 (#292) renames the world boss "Old Ashmaw" to "Old Vorhulm"; not applied until Steve's yes |
| W2 | **Raid 2: Old Vorhulm in the Hoard,** tier 9. A new group check: break the Craw to get a swallowed ally out | design | ✅ [raid2.md](raid2.md), #295; banners #298, swallow countdown #299 |
| W3 | **Raid credit follows the live world boss:** the Crucible and the Hoard each count toward the world boss only when their boss is the live one | engineering | ✅ #293, a client rule (design's call): `DungeonDef.worldBoss` and `raidCountsTriple`; in another week a raid's hits count once. The Hoard sets `worldBoss: 'Old Vorhulm'` (#295) |
| W4 | **The Slagbinder in a party:** with the Slagbinder in place of the Duskblade, group runs sit above their bands (76 to 80% in the raid) | skills | ✅ #294: a party-only trim (Bellows x0.7 damage with allies, thinner ally shell and plating). Follow-up ✅ #308: the Anvil tank's cut on unblockable hits is 20% in a party (35% alone); the Pressworks stays the hard way to tank with it (27 of 80) |
| W5 | **Pressworks content QA** (carried over from V3) | QA | ✅ #278: contentcheck plays the Pressworks at tier 10 (0 stuck in 256 runs); `coopsweep.cjs --pressworks` drops a guest mid-Downstroke and the run reaches the end screen. Re-run on main at 60b2e73 |
| W6 | **The Hoard's art:** Vorhulm, the Craw, the swallowed state, the embers, a hub card | visuals | ✅ #297 |
| W7 | **The Hoard's sound:** a theme, a Swallow sting and a "you're swallowed" cue | sound | ✅ Theme `hoard` (chew bed), Swallow sting, belly muffle and heartbeat, and every Hoard event and cast cued (#296) |

### Visuals batch X (after Phase 7, game design, 21 Nov 2026)
Every visuals item in Phases 6 and 7 is done. These are gaps found in the code on main at 085c69b, most important first.

| # | Feature | Owner | Notes |
|---|---|---|---|
| X1 | **A shadow for each world boss:** the shadow fight always draws Grandmother Slag's silhouette, whichever boss is live (GameScene.ts, `e.kind === 'worldShadow' ? 'slagCrone'`). The rotation has four: Grandmother Slag, the Cinder Colossus, Old Vorhulm and the Furnace Regent (migration 0007) | visuals | ✅ #309 |
| X2 | **World boss portrait on the hub card:** `renderBoss` (hub.ts) shows only the name, a meter and text | visuals | ✅ #309 |
| X3 | **The Wrackline's hub card art:** every other dungeon has a `.dg[data-d=...]` art rule in index.html; the Wrackline has none | visuals | ✅ #309 |
| X4 | **Small fixes:** the Hoard's arena rim falls to the Kiln's orange default (the `rim` chain in GameScene.ts has no `hoard`); the Ysmeret "borrows the Kiln Mother's sheet" comment and fallback are stale now that `ysmeret` has a sheet | visuals | ✅ #309 |

### Sound batch S (after Phase 7, game design, 21 Nov 2026)
Every sound item in Phases 6 and 7 is done (#296, #302, #305). These are gaps found in the code on main at 89c7ab3, most important first.

| # | Feature | Owner | Notes |
|---|---|---|---|
| S1 | **The Hoard's theme never plays:** `hoard` is in THEMES (music.ts, #296), but GameScene still calls `audio.theme(w.dungeonId === 'crucible' \|\| w.dungeonId === 'hoard' ? 'raid' : w.dungeonId)`, so the Hoard gets the Crucible's raid theme | sound | ✅ #307 |
| S2 | **The hub is silent:** hub.ts imports no audio. Brewing a potion, Forge upgrade and temper, salvage, equipping, spending a passive point and claiming a world boss reward all make no sound (main.ts plays only matchmaking and party cues) | sound | ✅ #307 |
| S3 | **A shadow sting per world boss:** every shadow fight uses the one `worldShadow: 'phaseShadow'` cue (cues.ts), whichever boss is live | sound | ✅ #307 |

### Phase 8: the third raid, and making the Hoard hold up online (planned by game design, 21 Nov 2026)
Batches X (#309) and S (#307) are done. Phase 7 is built apart from applying migration 0007, which waits on Steve's yes. Phase 8 checks raid 2 in real online parties, then brings a third world boss into a fight.

| # | Feature | Owner | Notes |
|---|---|---|---|
| Y1 | **Raid 3 design: the Cinder Colossus in person,** tier 10, after the Hoard (t9). A new group check that neither the Crucible (tank swap, soaks) nor the Hoard (target switch) tests | design | ✅ [raid3.md](raid3.md), Y1 PR: the Smeltery, 26 of 40 at t10; "get behind him" (front plate, Wheel, Meltdown). "Cinder Colossus" had no WoW match in the 21 Nov search (raid2.md); the raid's place name gets its own search |
| Y2 | **Online co-op sync audit:** the Hoard's embers were not sent to guests (`coalEmbers` was missing from netsync ARRAYS; fixed with a test in the Phase 8 PR). Add a test that fails when any array on World is neither synced nor listed as local, so the next dungeon can't miss one | engineering | ✅ #316: tests/netsync-coverage.test.ts fails on any unlisted World array; it also found the Wrackline's rafts and the Glarewell's pillars unsent (fixed) |
| Y3 | **Hoard QA:** contentcheck at tier 9 (soft-locks), and `coopsweep` with a guest dropping while swallowed and while the Craw stands (the `swallowed` index must not point at a hero who left) | QA | ✅ #317: 0 stuck at t9; a hero inside him when he died stayed swallowed after the win (6 of 80), fixed; drops while swallowed or with the Craw up reach the end screen; guests see the embers |
| Y4 | **The Hoard on phones:** the swallow countdown chip (#299), the Craw and the ember rings at 360 px wide, and the Swallow banner over the boss panel | mobile | ✅ Checked at 360x740 and 390x844, no change needed: the chip, the banners and the Craw and ember rings all fit and read |
| Y5 | **Class coverage in the raids:** measure the Hoard at t9 with the Slagbinder (both stances) and with each damage class swapped in, against the 55 to 70% band. The Anvil tank fix (#308, 20% in a party) lands first | skills | ✅ #324: every class can now break the Craw, and Smeltery burns are judged from the hero who lit them. Design retuned COAL (swallowTick 0.06, then #341). The "19 without a Duskblade" Slagbinder rows were a measuring gap (heroes-r2 had no Slagbinder files, now added); fair numbers in docs/skills.md. Round 2 is Z5 |
| Y6 | **Raid 3 art:** the Colossus in person (the X1 shadow sprite at raid scale, as slagCroneRaid did for Grandmother Slag), the arena and a hub card | visuals | ✅ #320: colossusRaid and colossusMelt, turned by colFacing, the front arc and hot back on the floor, the Wheel and Meltdown rings, floor, rim, card and icon |
| Y7 | **Raid 3 sound:** a theme, and cues for its new mechanic | sound | ✅ Theme `smeltery` (#313, #315); Slag Sweep, Wheel, Pour Out, Meltdown pulses, phase stings, and a plate clank vs back crunch on your own hits (#321) |
| Y8 | **Apply the waiting migrations** 0006 (bounty board) and 0007 (Old Vorhulm) | engineering | ✅ Both applied on 22 Nov after Steve's yes (0007 renames to Old Vorhulm). Still waiting on Steve: 0005 (season leaderboard) |
| Y9 | **Older boss art at phone size:** a readability pass on the earlier bosses and their telegraphs at 360 px wide, no new names or captions | visuals | ✅ #326 (the Glarewell's shadow wedges), #329 (Snuffer piles share a bar, a pointer to the Craw beside the party frames; the Colossus in Meltdown reads as is) |
| Y10 | **Seasons 7 and 8:** after Season 6 the rotation wraps to Season 1's theme on Thu 29 Jul 2027 (week 3004, season.md). Season 7 **the Long Hunger** features the Hoard, and Season 8 **the Cracked Plate** (from 9 Sep 2027, week 3010) features the Smeltery. Neither name had a WoW match in a search on 21 Nov 2026 | design | ✅ Y10 PR: SEASONS 6 and 7 with their glows and trails, every colour at least 22 ΔE from Seasons 1 to 6 (tests/season.test.ts); palette in season.md |
| Y11 | **Season 7 and 8 hub themes** (`HUB_BY_SEASON` entries 6 and 7), drawn from the `hoard` and `smeltery` themes the way hubPress and hubEbb came from their dungeons (#272) | sound | ✅ #325: hubHunger (chew bed) and hubPlate (stride bed) |
| Y12 | **Season 7 and 8 art** (`SEASON_ART` 6 and 7: accent, highlight, deep, banner; glow swatches and trails) | visuals | ✅ #327: banners, SEASON_ART 6 and 7, Ember Crumbs and Plate Shards trail styles (Plate Shards 3.9:1 on the hub, kept) |

### Batch Z: checks across everything now built (planned by game design, 22 Nov 2026)
Y9 to Y12 are done. These are checks with tools that already exist, so each item ends in a measurement or a screenshot, and a fix only where one is found.

| # | Feature | Owner | Notes |
|---|---|---|---|
| Z1 | **The season screen with 8 seasons:** re-run `tools/seasonshots.cjs` and `tools/seasonartshots.cjs` for Seasons 7 and 8 (banner, glow swatches, trails) on desktop, iPhone 13 and 320 px; update `docs/design/shots/season-320.png` | visuals | ✅ #334 (re-checked on main 22 Nov; #454 adds the Flue at 320 px) |
| Z2 | **The three raids side by side at 320 px:** the Crucible, Hoard and Smeltery hub cards (`tools/hubcardshots.cjs`) with their lock lines (four heroes, no bot fill) readable, and no horizontal scroll | visuals | ✅ #334 (re-checked on main 22 Nov; #454 adds the Flue at 320 px) |
| Z3 | **Phone speakers across the new themes:** run `tools/mixcheck.ts` on `hoard`, `smeltery`, `hubHunger` and `hubPlate` and the raid 2 and 3 cues; anything that loses most of its level under 350 Hz gets a higher layer | sound | ✅ Nothing failed, so nothing changed. Themes: hoard 28-29%, smeltery 29%, hubHunger 51%, hubPlate 45% above 350 Hz (floor 25%). Raid 2 and 3 SFX: 26% (emberEaten) to 89%. Every priority cue at or above -26.5 dB (lowest phaseFeast -26.4) |
| Z4 | **Season 7 and 8 rewards:** a glow or trail unlock in Seasons 7 and 8 plays the same reward cue as Seasons 1 to 6 (check the new trail styles from #327 go through it) | sound | ✅ Every season's glows and trail stages, 1 to 8, play `unlock` (rewardCues); a test covers all of them. The trail style is drawing only and never reaches the cue |
| Z5 | **Raid class coverage, round 2:** with fair Slagbinder gear, the Hoard's high Slagbinder parties (Swallow victims recovering between Swallows) go to COAL (#341); the Smeltery's Meltdown race favours blades because ranged bots drifted out of reach. Target: every party 22 to 28 of 40 in the Hoard (t9) and the Smeltery (t10), base party unchanged | skills | ✅ #342 (ranged damage heroes keep their ring in Meltdown, Colossus 19000) and #347 (the Lumen heals a tank under 60% first in Meltdown); base 78 of 120. Parties without an Emberwright stay at 86% in the Smeltery, kept as raid identity (design, raid3.md) |

### Phase 9: verb sets for the newer raids (planned by game design, 22 Nov 2026)
Every dungeon drops a verb set (R4) except the two newest raids: `setForDungeon('hoard')` and `setForDungeon('smeltery')` returned nothing, so their head, hands and trinket drops were plain. Phase 9 gives each one a set built on the check it teaches.

| # | Feature | Owner | Notes |
|---|---|---|---|
| A1 | **Crawsplitter** (the Hoard, "break them free") and **Platewalker** (the Smeltery, "get behind him"): sets, `SET_TUNING` cs*/pw*, the Crawsplitter buff chip, tests | design | ✅ Phase 9 PR. Behind means the Colossus's back arc (COLO.backArc), the same arc that takes ×1.5. Both names had no WoW match in a search on 22 Nov 2026 |
| A2 | **Set icons:** SET_ICON.crawsplitter and .platewalker are placeholders from design (client/icons.ts); draw them in the set style | visuals | ✅ #343 (and the Handover icon in #357) |
| A3 | **Set cues:** Crawsplitter's "+8% after a break" chip (`freedT`) gets a SET_SOUND cue like Relayer's `relayed`; Platewalker has no timed buff, so a cue only if it reads well | sound | ✅ #337: `freed` (breaker and freed hero, after the Craw's break) and a soft `behindPlate` on stepping behind him, throttled to 3 s (a bot re-enters about every 7 s) |
| A4 | **Sets in the raid tables:** measure each raid with a party wearing its 3-piece set against the 55 to 70% band; if a set pushes the base party over 70%, tell design the numbers | skills | ✅ Full 3-piece, base party, 80 to 120 seeds: Platewalker +3.5 per 40 (kept); Crawsplitter +8.3, trimmed in #355 (csCraw 0.25 to 0.05, +2.7 per 40; table in docs/skills.md) |

### Phase 10: the Furnace Regent in person (planned by game design, 22 Nov 2026)
The last of the four world bosses without an in-person fight. Brief: [raid4.md](raid4.md). A new group check, "pass it on": the Regent's Decree must be handed between heroes before it bursts.

| # | Feature | Owner | Notes |
|---|---|---|---|
| B1 | **Raid 4: the Flue,** the Furnace Regent at tier 11 (Decree, Edict, Abdication, Last Word), achievement and verb set, bots, tests, 80+ seed tuning | design | ✅ B1 PR: hp 16250, base party 72 of 120 (60%), `NOPASS=1` 2 of 40. A tank can take a passed Decree, Spent is 6 s, and in Edict a Decree fades after one pass (raid4.md Status). The Handover set is in the follow-up PR (raid4.md, Handover) |
| B2 | **Raid 4 art:** the Regent at raid scale from the `regent` shadow sheet, the Decree seal and its 8 s ring, the Spent mark, floor, hub card, set icon | visuals | ✅ #356 (the Regent, Decree seal, Scorch ring, Spent mark, floor and card), #357 (banners, Handover icon) |
| B3 | **Raid 4 sound:** a `flue` theme, and cues for Decree on you, pass, burst, Spent ending, phase stings | sound | ✅ Theme `flue` (draft bed) and the Regent's sounds #349; Decree on you, pass, burst, Spent ending, Embers of Office, phase stings and Last Word wired #353; Handover's Spent set cue #354 |
| B4 | **Raid 4 on phones:** the Decree timer and Spent mark at 360 px under the party frames | mobile | ✅ #351: a Decree badge with its countdown and a Spent mark on the party rows, and Decree and Spent chips for you; checked at 320 to 430 portrait and in landscape, co-op guest view included |
| B5 | **Raid 4 QA:** contentcheck at t11, coopsweep with a guest dropping while holding a Decree | QA | ⏭ After B1 |
| B6 | **Raid 4 class coverage:** the steep damage race left the parties with less blade damage at 11 to 15 of 40 | skills, design | ✅ Design retuned the Flue to test survival as well (burst 50%, Ash Fall 70, hp 15000): base 80 of 120, every other party 26 to 28 of 40 except the Bellows Slagbinder beside an Emberwright at 18 (raid4.md). ✅ Skills #391: a Flue-only Bellows party cut (0.85, 0.7 elsewhere); Bellows with an Emberwright 39 to 48 of 80, with a Duskblade 50 to 56 |


### Phase 11: variety, so runs feel different (planned by game design, 22 Nov 2026)
Steve (22 Nov 2026): the bosses and waves feel similar, the same dungeon needs to change from run to run, and the environments need better designs. Brief: [variety.md](variety.md). Every roll is seeded (run rng, or the day or week number), so replays, co-op sync and the hashcheck still work.

| # | Feature | Owner | Notes |
|---|---|---|---|
| V1 | **Kiln wave archetypes:** Ember Spitter (ranged, Ember Lob), Ashbuck (shows a lane, charges), the Hollow Rift fight (Ashlings until you break it); Kiln pools 3 to 6 openers, 2 to 4 named | design | ✅ #362 |
| V2 | **Arena layouts:** open, pillars, lava channel, kiln vents, rolled per fight (2 in 5 open) | design, visuals | ✅ Kiln, #362 (variety.md, "V2 status"); art in V5 |
| V3 | **Boss variants:** the Kiln Mother rolls Molten Cataclysm or Kiln Draw per run; Maelra later | design | ✅ Kiln Mother (variety.md, "V3 status"); Maelra later |
| V4 | **A daily twist before tier 3**, the same for everyone that day | design | ✅ Today's Heat (variety.md, "V4 status") |
| V5 | **Layout and silhouette art** (with visuals' look overhaul): the four layouts, the Ember Spitter, the Ashbuck, the Hollow Rift and Ashlings, the Kiln Draw tell | visuals | ✅ #364 (layouts), #370 (Ember Spitter and Ashbuck sprites, Kiln Draw tell); the Hollow Rift has its `rift` sheet |
| V6 | **Sound:** Spitter lob, Rift spawn and break, Ashbuck charge, lava flare, Kiln Draw, the daily twist sting | sound | ✅ #361, #363, #365 (lob, charge, Rift spit, layouts, vent flare, lava), Kiln Draw #369 and #393, Today's Heat sting #372; V8 dungeons #376, #379, #382, #388, #390 |
| V7 | **Measure:** tier 1 to 4 win rates in band, and route variety per 20 runs | design, QA | ✅ Kiln: 0 repeats in 1000 runs (was 398), tools/variety.ts (variety.md, "V7 status") |
| V8 | **The same pass for the Foundry, the Glarewell and the Coldmarrow** | design | ✅ Foundry: fights, layouts and Maelra's Sluicetide; repeats 398 → 2 in 1000 (variety.md, "V8 status"). Glarewell: fights, vents and the Lensmother's Glintfall, repeats 409 → 2. Coldmarrow: fights, ice pillars and Nhevra's Emberdrift, repeats 306 → 2 |
### Phase 12: variety past the first four dungeons (planned by game design, 22 Nov 2026)
Phase 11 gave the four early solo dungeons new fights, layouts and a second boss version. Phase 12 does the same for the content players reach later: the Wrackline, the group dungeons and the raids. As before, every roll is hashed from the seed, so replays, co-op sync and the hashcheck still work. Status: [variety.md](variety.md), "Phase 12".

| # | Feature | Owner | Notes |
|---|---|---|---|
| W1 | **The Wrackline:** 4 new fights (3 openers, 1 named) from the Kiln's new foes in the water; raft currents rolled per fight; Hessa's second version, the **Outsurge** (from phase 2 the Ebb throws you out to a burning rim) | design | ✅ #406 |
| W2 | **Group dungeons** (the Hammerdeep, the Ashvents, the Pressworks): their own new fights, pillars or vents layouts (no lava in group play), and a second version of Ondrel, Ysmeret and Oskel. Fix Ondrel's double-scaled Hammer Sweep and re-measure the Hammerdeep with it | design, skills | 🔨 Hammerdeep fights, layouts and Ondrel's **Ironload** ✅ #409; Hammer Sweep counts the tier once ✅ #411; the Ashvents' fights and Ysmeret's **Wandering Vents** ✅ #416 (layouts held back; healer check: Scatter Embers 10% → 12%); the Pressworks' fights, layouts and Oskel's **Die Cut** (part 4) |
| W3 | **Raids:** a second version of Grandmother Slag, Old Vorhulm, the Cinder Colossus and the Furnace Regent | design | ✅ Grandmother Slag's **Brimming** #426 (with the Churn, part 4); Old Vorhulm's **Banked Coals** #429 (closer coals, part 4); the Colossus's **Plate Shift** #432; the Regent's **Summons** (part 4). Follow-ups: the Flue's double-scaled Ash Fall, and wider raid fight pools ([variety.md](variety.md)) |
| W4 | **Art** for the Outsurge (water running outward), the currents, and W2 and W3 tells | visuals | ✅ W2: #418 (Wandering Vents), #422 (Die Cut); W3: #428 (Brimming), #430 (Banked Coals), #436 (Plate Shift), #450 (Summons) |
| W5 | **Sound** for the Outsurge and the W2 and W3 casts | sound | ✅ Outsurge #407; Ironload and forge vents #412; Wandering Vents #417; Die Cut and steam-press vents #423; Brimming islands #427; Banked Coals #431; Plate Shift #435; Summons and a quiet Churn #449. Arena-edge ambience for every edge set #445. Every warning is at or above the phone floor and 6.0 to 9.3 dB over its fight's mix (busycheck) |
| W6 | **Talents for the variety foes and layouts** (situational cards, offered only where the situation is still ahead in the run) | skills | ✅ #414: Vent-Fed, Read the Lane, Back to Stone, Reaching Light, Slag Wade, solo dungeons only; every card within noise for bots, tier 1 bands hold (docs/skills.md, "Site cards") |
| W7 | **Raid class pass for the second boss versions:** as each W3 version lands (Grandmother Slag's Brimming first, then Vorhulm, the Colossus and the Regent), measure every standard party against the 55 to 70% band and check each class kit has an answer: melee reach and Lumen healing from the Brimming's islands, the Bellows Slagbinder rows, blade stacking (as Z5 and B6) | skills | ✅ Measured on all four (Brimming, Banked Coals, Plate Shift, Summons); design fixes in #446 and #458, the Summons walk-in #457, and the Anvil tank holds the Colossus in Plate Shift (#461) |

### Phase 13: arenas that change the fight (planned by game design, 22 Nov 2026)
Steve, 22 Nov: "the environments need better designs". Phases 11 and 12 gave the solo and group dungeons layouts (stones, vents, a lava channel) that change how a fight plays. The raids and the Ashvents still fight on an open floor. Phase 13 brings layouts to them, measured against the same bands, and keeps every roll hashed from the seed.

| # | Feature | Owner | Notes |
|---|---|---|---|
| E1 | **Raid trash layouts:** stones or vents in a raid's openers and named fight, never in the boss fight (each boss has its own floor rules: islands, coals, his back, the throne) | design | ✅ #462: all four raids open, open, pillars, vents (variety.md, Phase 13 E1); all in the band on 320 seeds |
| E2 | **The Ashvents' layouts** (held back from W2 because they cost 11/80 with the new fights) and its full-party band (53% at tier 8, just under 55%) | design | ✅ Layouts plus Ysmeret 5800 health: 61% full party, no healer 13% (variety.md, Phase 13 E2) |
| E3 | **Art** for raid-floor stones and vents (the Crucible's, the Hoard's, the Smeltery's and the Flue's own look) and the Ashvents' | visuals | ✅ #464, #468 |
| E4 | **Sound** for raid-floor vents | sound | ✅ Each raid's own vent warn, burst and sting #463, the Ashvents' #466; each raid's and the Ashvents' own stones sting (PILLAR_STING), matched to the E2/E3 art. Busy-fight margins unchanged (busycheck, heroes-r2 t8) |
| E5 | **QA:** contentcheck plays every raid layout (0 stuck) | QA | ✅ #470: the first 4 pillars and 4 vents seeds per raid, with four heroes, no tank and a drop-in guest; 216 runs with the Ashvents, 0 stuck |
| E6 | **Class check:** each class's answer on the new floors (melee pathing round stones, ranged lines of fire) | skills | ✅ No class change needed: stones block movement only, every class is held up under 1% of its moving time on pillars, trash fights are no longer or deadlier (skills.md, "Raid trash floors") |

### Phase 14: runs that surprise (planned by game design, 22 Nov 2026)
Steve, 22 Nov: "People aren't going to want to play the same dungeon multiple times with no changes." Phases 11 to 13 made the route, the floor and the boss version change from run to run. A run still has one shape from the first fight to the boss: once a layout or a named foe is rolled, nothing new happens inside the fight. Phase 14 adds changes that happen during a run, and lets the player see what this run rolled. Every roll stays hashed from the seed (and Today's Heat from the day), so co-op and the server agree.

| # | Feature | Owner | Notes |
|---|---|---|---|
| X1 | **Today's Heat everywhere solo:** the daily Heat (heatFor, content/heat.ts) reaches every solo dungeon, not only the Kiln tiers 1 to 2, with one heat of each dungeon's own | design | ✅ #477: HEAT_POOLS, plus Thick Steam, High Sun, Bright Coal, Slack Water; all within a few wins of no Heat (variety.md, Phase 14) |
| X2 | **Marked foes:** the C2 named elites (Swift, Warded, Vengeful) get two more affixes, shown on the banner | design | ✅ #477: Brood and Smoldering; Warded's shield 0.35 → 0.2, and Blooms no longer heal a named foe, after skills' X5 screen |
| X3 | **Arena events:** each dungeon has one or two mid-fight events in trash fights, never in the boss fight | design | ✅ #477: Cave-in, Vent Surge, Cold Snap (Coldmarrow), High Water (Wrackline) in 40% of solo trash fights; part 2 adds Cave-in and Vent Surge to the group dungeons. Raids later |
| X4 | **This run's shape:** the run summary (host and guests) lists what this run rolled: route, floors, named foe, events, boss version, Heat. Nothing before the run beyond Today's Heat, so nothing is spoiled | engineering | ✅ #478, #481 (sim/runshape.ts) |
| X5 | **Class check:** each class's answer to every mark and event | skills | ✅ No class talent needed. Fight-side fixes from the screen: Warded 0.2 and Blooms never heal a named foe (#477); the named foe's fight gets 60 s more before Burnout (Foundry Slagbinder 105 → 126 of 160) and a named foe feeds coal in the Coldmarrow (Emberwright 83 → 128, base 131) |
| X6 | **Art** for marks, each event's warning and effect, run-shape chips and Heat glyphs, in the current lit 2D style | visuals | ✅ #483, chip accents #489 |
| X7 | **Sound:** a cue for each mark when its foe appears and for each event's warning and landing | sound | ✅ #482, Brood spill #486 |
| X8 | **QA:** contentcheck plays every mark and event (0 stuck); variety.ts counts the distinct run shapes per dungeon | QA | ✅ #484: 624 runs, 0 stuck, 0 trapped; run shapes 998 to 1000 per 1000 seeds |
| X9 | **Phones:** the run-shape chips, the mark badge and event warnings fit at 320 px wide without covering the fight | phones | ✅ #479 (end-screen chips made compact: one line each at 320 and 568 with every chip a run can roll). Checked with no change needed on 23 Nov: every named-foe banner (AFFIX_TIP) and arena-event warning stays whole at 320, 360, 568 and 667, solo and with party frames; the trait badge sits on the foe's plate and Vent Surge's warning clears the HUD at 320 and 568; the Heat chip shows on every solo dungeon card with no cut or sideways scroll. Screenshots in docs/ux/phase14/. The co-op dungeon card's run shape isn't built yet: check it when it is |

### Phase 15: waves and bosses that don't repeat (planned by game design, 23 Nov 2026)
Steve, 22 Nov: "The bosses I have fought, and the waves, have seemed pretty similar." and "People aren't going to want to play the same dungeon multiple times with no changes." Phases 11 to 14 changed which fights come, the floor, the boss version, the named foe, mid-fight events and the day's Heat. Two things still play the same every time:
- **Waves:** every trash fight's foes all arrive at once, in one arc from the far side of the arena (`startEncounter`, sim/world.ts).
- **Bosses:** each boss has only two versions.

Phase 15 changes how waves arrive, gives bosses a third version, and lets players see what they haven't met yet. Every roll stays a hash of the seed.

| # | Feature | Owner | Notes |
|---|---|---|---|
| Y1 | **Wave shapes:** each trash fight's foes arrive in a seeded shape: today's arc; a pincer from two sides; a ring round the party; or half now and reinforcements a few seconds later, with a warning | design | ✅ #503: solo and group trash after the opener (pincer 20%, ring 15%, reinforcements 20%); natural rates within 3 of waves off in every solo dungeon ([variety.md](variety.md)). Raids keep the arc for now |
| Y2 | **Raid trash events:** Cave-in and Vent Surge in raid openers and named fights (never the boss), as the group dungeons got in #494 | design | ✅ Y2 PR: Crucible 88, Hoard 103, Smeltery 111, Flue 108 of 160 with events on, every raid in band ([variety.md](variety.md)) |
| Y3 | **Third boss versions:** a third phase-2 version for each solo boss, the Kiln Mother first, then Maelra, the Lensmother, Nhevra and Hessa; group and raid bosses after | design | ✅ Kiln Mother: Turning Fire (#519). Maelra: Sealed Vents (#521). The Lensmother: Carried Light (#526). Nhevra: Creeping Rime (#534). Hessa: the Whirl (#537). Every solo boss now has three. Group bosses: Ondrel, the Homeward Hammer (#541). Ysmeret: Rolling Vents (#550, with a Creeping Rime fix for melee). Oskel: Punch Line (#554). Every group boss now has three. Raid bosses: Grandmother Slag, the Overflow (#558). Old Vorhulm: Inhale (#564). The Cinder Colossus: Millstone (#575). The Furnace Regent: Tithe (#579, lone-soaker fix #580). Every raid boss now has three versions. One boss per PR, every version within the band; names searched for WoW matches |
| Y4 | **Seen log:** each hero keeps a record of the boss versions, named-foe traits, arena events, wave shapes and Heats they have met. The end screen marks what's new, and the hub shows what's still unseen in each dungeon | engineering | ✅ #498: sim/seen.ts. Saved on the hero (HeroProfile.seen, shared by every class); a run counts only what it met (boss version once rolled, named foe once spawned, event once warned, the run's Heat). The end screen stars first meetings; the hub has a Seen chip and sheet per dungeon. Wave shapes join when Y1's ids land (World.wavesMet) |
| Y5 | **Class check:** each class against each wave shape (melee against a ring, ranged against a pincer) and each third version | skills | ✅ No class talent needed; fight-side fixes from the check: Rimehound fights never ring (#517, #532), per-class stir bars (#532), Sealed Vents (#534), Creeping Rime (#550, #555), Ondrel's ring 5% (#554), Punch Line widens (#573). Tables in docs/skills.md |
| Y6 | **Art**, in the current lit 2D style: where each wave comes in from, the reinforcement warning, each third version's mechanic, and the Seen log | visuals | ✅ Seen log #501; wave marks and the stir #523; Turning Fire and Sealed Vents #525; Carried Light #528; Creeping Rime #536; the Whirl #539; the Homeward Hammer #544. Since 3D became the baseline (23 Nov), the rest are native 3D: Inhale #590, Tithe #593, Millstone #595, the Overflow (this PR). Rolling Vents and Punch Line use the existing vent and floor-telegraph art |
| Y7 | **Sound:** a cue for reinforcements arriving and for a wave from behind, and each third version's cues | sound | ✅ Wave shapes: the pincer and ring calls, and the reinforcement horn panned to its flank, then its landing (WAVE_SOUNDS, #508). Every solo boss's third version (#520, #524, #527, #535, #538) |
| Y8 | **QA:** contentcheck forces each wave shape and third version (0 stuck); variety.ts counts wave shapes | QA | ⏭ |
| Y9 | **Phones:** foes coming in from off screen get an edge marker at 320 px; the Seen log fits a phone | phones | ✅ #502 (a red chevron per direction for foes off screen or under the boss panel, gold-rimmed for an elite or boss, clear of the action bar and party frames), #506 (a chevron toward a held pack during More Coming), #509 (on phones the wave line and the stir get their own banners after the fight's), #515 (the chain resumes after an arena event's warning). Seen log (#498) fits at 320x568 and 568x320 with no change; Y6's wave and stir art (#523, #525) checked at both sizes. Not yet in the ?hd2d=1 3D test: its canvas covers the 2D layer the chevrons are drawn on |
| Y10 | **The dungeon stirs:** Steve, 23 Nov: "It would be cool if the dungeons sort of adapted or adjusted difficulty as you played, if you were doing really well they like added an extra monster or something." A fast, healthy trash clear builds a hidden count; when it fills, the next fight gets one reaction (an extra elite, a named foe, an arena event or a harder wave shape) with extra loot. A run going badly never gets harder. At most two per run, never the boss, off on the first delve and tiers 1 to 3; bots don't count in group runs, and the loot follows the bot loot rules | design | ✅ Y10 PR: two clean clears stir the next trash fight, about once a run for the good bot, with no change in win rates ([variety.md](variety.md)). Then skills, visuals, sound, QA, phones and engineering (Seen log) items. Follow-up (this PR): judged by the worst-off hero against their class bar (melee 2x), with a tighter group bar, so melee classes stir as often as the others and a party's stir depends on how well it plays |

### Phase 16: boss echoes and new foes (proposed by game design, 23 Nov 2026)
Phase 15 gave every boss three versions, but a run still meets only one of them, and most trash foes still just walk at the party. Phase 16 mixes the versions together late in a fight, and gives each solo dungeon one foe that asks for a new answer. Every roll stays a hash of the seed. This is a proposal: Steve can reorder or drop any row.

| # | Feature | Owner | Notes |
|---|---|---|---|
| U1 | **Echoes:** from tier 8, each boss's last phase also borrows one move from a version this run didn't roll (seeded), on a slower timer, so the same version can end two ways | design | ✅ Kiln Mother (#583), Maelra (#584), the Lensmother (#587), Nhevra (#589), Hessa (#591): every solo boss done. Group: Ondrel (#594), Ysmeret and Oskel (#596): every group boss done. Raids: the Furnace Regent, the Cinder Colossus, Old Vorhulm and Grandmother Slag (this PR): every boss done; every boss stays within the band with its echo on, measured against echoes off |
| U2 | **New foes:** one new elite for each solo dungeon whose answer is something other than "kill it or step out" (for example one that shields the foes behind it, a pair that must die close together, or one that calls a wave in from the edge if it lives too long) | design | ✅ The Kiln: the Ashwall, a shield that turns to face you and shelters the foes behind it (#603). The Foundry: the Ballast, which drops anchor in your reach and barely feels hits until you make it walk (#606). The Glarewell: the Lampeye, whose gaze sears you unless you break it behind a pillar, where the Shades grow tough (#612). The Coldmarrow: the Dimhorn, which calls Rimehounds from the dark unless you keep it in your coal's light (#621). The Wrackline: the Conchblower, whose conch brings the next Ebb sooner unless you Quench it (this PR). U2 is done. One dungeon per PR; names searched for WoW matches |
| U3 | **Seen log:** echoes and the new foes join the Seen log and the run summary | engineering | ✅ Echoes (#600) and the new foes (#604, NEW_FOES): all 12 bosses' echoes and all 5 elites (Ashwall, Ballast, Lampeye, Dimhorn, Conchblower) show in the Seen log and the end-screen run shape |
| U4 | **Class check:** each class against each echo and each new foe | skills | ✅ Every solo, group and raid boss echo and all five new foes measured; tables in docs/skills.md. Fixes from it: Nhevra's Rime echo (#601), the Anvil hold in Plate Shift echoes (#609), Lampeye melee (#628), Grit Guard for the novice Duskblade (#630) |
| U5 | **Art** (3D, with the 2D fallback): each echo's tell and each new foe | visuals | ✅ Echoes: a cold ghost of the boss on every echoed cast (#602), and the borrowed move keeps its own tell. New foes: 3D tells for the Ashwall and Ballast (#610), the Lampeye (#620), the Dimhorn and Conchblower (#626); their own sprites (#629) |
| U6 | **Sound:** each echo's warning and each new foe's cue | sound | ✅ Echoes: an echo sting, then the borrowed move's own cues, checked for all 36 boss and echo pairs (#585). New foes: the Ashwall (#605), Ballast (#608), Lampeye (#619), Dimhorn (#622) and Conchblower (#625), each warning at least 6 dB over its dungeon's mix on a phone (busycheck). 3D room life and foe lunges (#607) |
| U7 | **QA:** contentcheck forces each echo and new foe (0 stuck); variety.ts counts boss version plus echo pairs | QA | ✅ contentcheck `echo` cases force all 69 version+echo pairs of the 12 bosses (138 runs, 0 stuck, every boss played the forced pair) and `foe` cases put each new elite in as the opener, solo and with a guest who leaves (50 runs, 0 stuck, all met). variety.ts prints the pairs; its prediction matched 24 played runs. Watch: the Kiln Mother's echo comes on her second last-phase signature, so at t8 with t8 gear about half the won runs end before it (35 of 62 at full skill heard it) |
| U8 | **Phones:** the new foes' tells read at 320 px | phones | ✅ All five checked at 320x568 and 568x320, in 3D and 2D (`tools/newfoeshots.cjs`): the Ashwall's bash cone, the Ballast's slam ring, the Lampeye's eye and gaze, the Dimhorn's Dark Call and the Conchblower's Conch Call all read, with their cast bars on the foe panel. Their fight tips ran 4 lines at 320 wide, which kept the banner over the hero and the foe for 5 s as the first tell landed, so phones get shorter ones (PHONE_TIP): 2 lines, or 3 with a floor line. Shots in docs/ux/new-foes/ |

### Phase 17: the Arena, ranked one-on-one (asked for by Steve, 23 Nov 2026; not started)
Steve (23 Nov 2026, 15:46Z): "add the option from the home menu for a different game mode (arena) where you match up someone your level if possible and fight against them. Winner gets points towards their ranking similar to how wow does PvP. And at intervals of points you get a title or some achievement or something (we can add rewards later)". He said not to build it now. It comes after Phase 16.

The idea: a second mode next to delving. Two heroes fight each other 1v1 in a small arena, matched by level where possible. The winner gains rating points and the loser drops some. At set rating marks a hero earns a title or an achievement. The ladder is in the spirit of ranked PvP, but every name (mode, rating, tiers, titles) is our own and gets checked against WoW before it ships, like every other name.

| # | Feature | Owner | Notes |
|---|---|---|---|
| V1 | **Design brief:** the duel rules (arena size, time limit, what happens at time-out, potions and set bonuses on or off, hero-vs-hero damage scale), the rating sums (start rating, gain and loss per win, a smaller loss at low rating), the title marks, and the original names | design | ⏭ First step once Phase 17 starts; nothing built until Steve reads the brief |
| V2 | **Home menu entry and matchmaking:** an Arena button on the home menu. A queue matches two heroes of the same level band, then widens the band the longer a hero waits. Built on the co-op network code | engineering | ⏭ After V1 |
| V3 | **Duel sim:** heroes can hit each other (abilities, telegraphs and crowd control on a hero), with no foes in the arena; deterministic like the rest of the sim so netsync and replays still work | engineering | ⏭ After V1 |
| V4 | **Rating and titles:** a stored rating per hero, a season reset rule, titles or achievements at each mark (rewards later, as Steve said). Supabase table and migration, applied only after Steve says yes | engineering | ⏭ After V1 |
| V5 | **Class balance in duels:** every class against every class, with a PvP-only damage and healing scale if a pairing is lopsided, so no dungeon numbers change | skills | ⏭ After V3 |
| V6 | **Art and sound:** the arena floor, the duel start and end, the rating-up and title moments | visuals, sound | ⏭ After V2 |
| V7 | **QA:** matchmaking edge cases (nobody in the band, a leaver, a disconnect counted as a loss or not), rating sums, and no dungeon run changed | QA | ⏭ |
| V8 | **Phones:** the queue, the duel HUD and the rating screen at 320 px | phones | ⏭ |

## R2. The Forge

**Problem.** Salvage gives embers, and embers do nothing. Players salvage once, see nothing happen, and stop.

**Design.**
- **Upgrade:** +1 item level, up to hero level + (highest tier unlocked − 1) + 1, which is one above the best drop you can currently find. The main stat recalculates and bonus stats scale up with it. Cost grows with item level and rarity, so you spend on the pieces you'll keep (an Epic or Mythic) rather than on every Common.
- **Temper:** reroll the weakest bonus stat into a different stat, at the item's current level. Fine or better only (Commons have no bonus stats). The roll is seeded from the hero's forge counter, so the server can check it later, like loot.
- The cap keeps a favourite Epic or Mythic level with fresh drops without running away from them. A first version capped at hero level + 2, and the autopilot stopped forging around run 15 to 20 and ended with 1,585 embers unspent, because tier drops were already above that cap.

**Target.** At first, about one upgrade per run from normal salvage. Replaced on 21 Nov 2026 by an outcome target (worn gear trails the cap, the Forge is worth about one tier over ten days, embers don't pile up). See economy.md.

## R1. Route choices between fights

**Problem.** The route is rolled and hidden. Between fights you only pick a talent, so you never decide how risky your delve is.

**Design.** After fights 1, 2 and 3, the arena shows two exits and you walk into one:
- **Named fight:** the harder encounter with a better loot bag (minimum rarity one step higher).
- **Steady fight:** an ordinary encounter.
- Sometimes one exit is a **Shrine** instead of a fight: pick a heal to full, a run-long buff, or a free talent reroll.
- Walking into a door, rather than tapping a menu, keeps it a moment inside the game and works with the joystick.

**Why.** Push-your-luck choices are what make a run feel like yours, and they fit pillar 2: a strong hero takes the named path, a struggling one takes the shrine.

**Measure.** The bot picks named paths when its health is over 60%. Win rate on tier 1 should stay about where it is; average loot rarity should rise for players who take risks.

**As built.** After fights 1, 2 and 3, two gates appear a short walk from the player, so both fit on a phone screen. You have 10 seconds to walk into one, or the steady fight is taken. The other gate is a named fight that isn't already in your route (its loot bag is one rarity better), or, 30% of the time or when no named fight is left, an Ember Shrine. A shrine replaces the fight: full heal and a level (so a talent draft), but no loot bag. Code: `rollFork` in `sim/content/dungeon.ts`, the `choose` phase in `World`, `botGate` in the bot, gate drawing in `GameScene`. `tools/paths.ts` compares path policies. Numbers are in balance.md.

## R3. Tier modifiers ("Omens")

**Problem.** Tiers only add health and damage. Tier 9 plays exactly like tier 1.

**Design.** From tier 3, each tier adds one Omen to every fight, picked from a weekly rotation (a seed from the week number), so the ladder changes each week. Starting set, each one asks for a different reaction:
- **Kindled Dead:** elites leave a burning pool where they die. (Move after kills.)
- **Shared Pain:** when an elite dies, the other elites in the fight heal 15%, but never the boss. (Kill evenly, or burst them together.)
- **Quickened:** enemy casts are 30% faster. (Interrupt sooner.)
- **Warded:** the first time each enemy drops under half health, it gains a shield worth 20% of its health. (Save a cooldown for it.)
- **Volatile Ground:** a slow red circle appears under you every 12 seconds. (Keep moving.)

Higher tiers stack more Omens (tier 3 to 5: one, 6 to 9: two, 10 and up: three). Each Omen also adds +8% loot luck, so the hard ladder pays.

**As built.** `sim/content/omens.ts` holds the definitions and every tuning number. `omensFor(tier, week)` is a fixed shuffle per week; a tier takes the first N, so tier 7 has tier 3's Omen plus one more. The client passes the week number, so the sim stays clock-free and deterministic. Fairness rules: Volatile Ground never erupts while a soak circle is up, Kindled Dead and Shared Pain only trigger on elites and named foes, and none of them touch the boss's own death. Shared Pain never heals a boss either (21 Nov 2026): Hessa's Call the Shoal brings elite Lurkers, and QA measured her regaining 30 to 38% of her health from them in one fight. The hub shows this week's Omens under the tier picker, and the first fight's banner names them with their tips. Tuning results are in balance.md.

**World boss tie-in (proposal for engineering).** While a world boss lives, it adds one fixed Omen to every delve at every tier, with +15% loot luck. That gives each boss a weekly flavour using the same system, and only needs one `omen` column on the boss row.

## R5. A world boss you actually fight

**Problem.** The world boss is a health bar on the menu.

**Design sketch.** Each world boss arrives as a sixth, optional fight at the end of a won delve: "Grandmother Slag's shadow" for a 60-second damage race with her signature mechanic. Damage there counts 3x toward the shared bar. Each world boss also sets a weekly blessing or curse on delves while it lives, which ties the shared world to every run. This is the solo version of "bigger enemies need a group"; co-op makes it a real raid later.

## R6. Second dungeon: the Drowned Foundry

**Problem.** One dungeon with 7 encounters. After a handful of runs you've seen every fight, and the Kiln Mother tests the same three verbs (dodge, interrupt, soak) every time.

**Design.** A flooded forge under Emberhold, unlocked once you've beaten the Kiln Mother on tier 3. In the hub you pick which dungeon to delve; tiers, Omens and forks work the same in both. Every new enemy brings a verb the Kiln Depths doesn't have:

| Enemy | Rank | Verb | How it works |
|-------|------|------|--------------|
| Glass Warden | elite | **Stop or interrupt** | Casts Mirror Ward (2 s, can be Quenched). If it lands, for 3 s the warden reflects 40% of the damage it takes back at you. |
| Ember Twins | elite pair | **Balance damage** | Two linked twins. When one falls, the other starts a 6 s Rekindle cast that revives its twin at half health unless it dies or is Quenched first. |
| Sluice Crawler | elite | **Spread** | Every 9 s it marks your position with a ring that bursts 2.5 s later. Standing near other enemies when it bursts heals them, so drag the ring away. |
| **Maelra, the Drowned Bellows** | boss | **Kite through hazards** | See below. |

**Maelra.** 4,600 health and a 180 s enrage. Three steam vents sit at fixed spots in the arena.
- **Phase 1, Tempering:** every 7 s she gains a Temper stack (−12% damage taken each, up to 5). Kite her over a vent to boil the stacks off. This is the first fight where you lead the boss matters.
- **Phase 2 (below 60%), Rising Water:** the arena shrinks from 560 to 360 over 20 s, and she casts Undertow (can be Quenched), which drags you towards her.
- **Phase 3 (below 25%), Overpressure:** vents now erupt under their own telegraphs every 8 s. Kiting her over them is now a risk too, so time it between eruptions.

**Routes.** Opener (Twins, or Glass Wardens), opener (Sluice Crawler and two hounds), named (Glass Warden), hard (Twins plus an Acolyte), then Maelra. Forks pull named and hard alternatives from the same dungeon.

**Targets.** Boss fight 60 to 120 s for the good bot. Tier 1 Foundry win rate should be 15 to 25 points below the Kiln Depths at the same gear, since it unlocks later.

**As built.** Dungeons are a registry (`DUNGEONS` in `sim/content/dungeon.ts`), and `WorldOptions.dungeon` picks one. The Kiln route roll is unchanged. The hub has a dungeon picker, and the Foundry is locked until tier 4. Changes from the spec, found in tuning:
- The opener is one Glass Warden with two hounds, not two wardens. Two wardens killed a fresh hero in 4 of 24 runs in under 40 s.
- Mirror reflects 12%, not 40%, and wardens take turns mirroring.
- Maelra has 6,000 health, Temper is −15% per stack every 6 s, Undertow comes every 12 s, and phase 3 vents erupt every 7 s. All tuning is in `FOUNDRY` in `sim/world.ts`.

Placeholder art (needs the visuals team): the four new enemies use the generic creature shape in new colours. Vents are pale circles, and the shrinking water is a blue band. The target frame shows "Temper ×N", "Mirrored" or "Warded".

## R7. Daily bounty

**Why:** a shared reason to come back each day, and one of our differences ([positioning.md](positioning.md), point 4): every player gets the same delve.

**What:** from tier 2, the hub shows today's bounty. It's 3 fights (a named foe, a hard fight, then the dungeon's boss), with no forks and one twist, an Omen picked for the day. The day, seed, dungeon, fights and twist come only from the date (UTC), so everyone gets the same run with no server needed. Only the tier is your own, at one below your best, so it's a confident run, not a wall. If the day's dungeon is still locked for you, you get the Kiln version of the same day.

**Rules:** you start with 2 levels and drafts, for the two openers the bounty skips. Your first win each day pays 30 + 6 × tier embers on top of the usual loot. Replays are free practice. A bounty never changes your tier ladder or your Grit.

**Code:** `sim/content/bounty.ts` (`bountyFor`, `dayOf`, `BOUNTY`), `WorldOptions.bounty`, `HeroProfile.bountyDay`, `RunRewards.bountyEmbers`, the hub's bounty line, and `tools/bounty.ts` for balance. Tests are in `tests/bounty.test.ts`.

**Daily board (21 Nov 2026, engineering):** a bounty win's time goes on that day's board for its tier (the tier fixes the dungeon too), fastest first, shown as "Today's fastest" in the bounty sheet. Server side is `supabase/migrations/0006_bounty_board.sql` (`submit_bounty` accepts only the server's day, 40 s to 30 min, one try a minute); it shows nothing until that migration is applied.

## R11. Third dungeon: the Glarewell

**Why:** Steve asked (20 Nov) whether dungeons have themes with their own enemies. Each dungeon should be a new place *and* teach new verbs. This one teaches the two on our list that nothing uses yet: **stand behind a pillar** and **spread out**. It strengthens difference 1 (few tough fights you read) and difference 2 (cast bars and Quench).

**Theme:** a sunken observatory where a great lens still burns. Bright light hurts. Shadow is safe, but shadow has things in it. Unlocks at tier 7, so each dungeon has a stretch of the ladder where it's new (Kiln 1, Foundry 4, Glarewell 7).

**As built (21 Nov 2026).** All numbers live in `GLARE` in `sim/world.ts`.
- **Arena:** 4 pillars on a ring of 200 around a glowing lens at the centre, rebuilt fresh every fight. Each casts a shadow wedge outward, 300 long and widening, drawn on the floor exactly where `World.shadowed()` says you're safe.
- **Lensbearer** (elite): casts **Glare**, a 2.6 s cast bar (was 2 s; the skills team measured that 2.6 s lets every class reach shade on foot from anywhere while all 4 pillars stand), then the whole room flashes. In the light it hits for 34 (scaled by tier); in a shadow it misses. It can be Quenched. *Changed from the spec:* a room-wide flash after a cast bar, not a 3 s sweeping beam. It reads better on a phone and uses the cast bar the player already knows.
- **Shade** (packs of 2 to 4): takes 30% damage while standing in shadow. Pull them into the light.
- **Brandkeeper** (elite): a 0.8 s cast puts a **Brand** on you. After 4 s it bursts, radius 110: it hits you for 16, cracks any pillar inside it (no shadow for the rest of that fight), and heals every enemy inside it for 10% of their health. A gold ring on the hero shows the radius and a closing timer. It waits 6 s after a burst before branding again.
- **Twin Lamps** (named fight): two lanterns with a beam of light between them while both are alive and within 460 of each other. Standing in the beam burns for 30 per second. Kill one to break it.
- **The Lensmother** (boss, 6200 health): Glare every 12 s (not Quenchable), with Lens Sweep cones in between. Phase 2 (60%) adds **Twin Brand**, two Brands back to back. Phase 3 (25%) cracks a pillar 3 s in and then every 14 s, each telegraphed for 2.5 s, always leaving one standing. Enrages at 180 s.
- **Fights:** openers Shades, Lensbearer, Brandkeeper; named Twin Lamps or Brand and Lens; hard Lensbearer and the Dark or Twin Lamps.
- **The bot** hides behind the nearest standing pillar when it sees a Glare cast, walks clear of pillars and enemies while Branded, and steps out of the lamp beam.
- **Art:** placeholder sprites drawn in code (`client/textures.ts`) for the visuals team to replace.

**Balance:** see [balance.md](balance.md#the-glarewell-21-nov-2026). The Glarewell at tier 7 plays as hard as the Foundry at tier 7 for the same geared tier 6 hero.

**Names:** web searches on 21 Nov 2026 for "Glarewell" game, "Lensmother" game boss, and "Brandkeeper" or "Lensbearer" video game enemy turned up no game using them. That's from the result titles only, so it's a search check, not a legal clearance. "Shade" and "Twin Lamps" are common words.

**Not built yet:**
- **Co-op:** one Brand per hero, so a party has to spread out. ✅ Built: every living hero carries a Brand, and each burst hits every hero in its circle (`burstBrand` in sim/world.ts).
- **Skills check:** every class reaching cover in time (Blink, Sidestep, Charge, Lumen movement). The skills team adds the Glarewell to its class matrix.

## R8. Alchemy: one potion slot

**Why:** consumables before a hard fight are an MMO staple (difference 2, "an MMO inside the run"), and embers need a second use beside the Forge. A potion is a small, deliberate choice made before you delve.

**Rules (built 21 Nov 2026).** Code: `sim/content/potions.ts`, `brewPotion` in `sim/hero.ts`, `WorldOptions.potion`.
- In the hub, under the difficulty, you brew **one** potion for embers. It waits for your next delve and is used up when that delve starts, win or lose. Brewing a different one pours the first away with no refund.
- Each class keeps its own potion, like its embers and bags.
- No new button: every potion works on its own, which keeps the phone action bar at four.
- The **daily bounty ignores potions** (and doesn't use yours up), because everyone plays the same delve that day.
- In co-op each hero's own potion counts (engineering, 21 Nov 2026): a guest's brewed potion goes with their hero card and is used up when the host starts the delve; the bounty still takes none.

**The potions (one verb each, never a raw stat):**

| Potion | Cost | Effect |
|---|---|---|
| Rising Draught | 30 embers | The first blow that would fell you leaves you at 25% health with a 2 s shield. Once per delve. |
| Stillwater Tonic | 10 embers | Your interrupt (Quench and its class versions) recovers 40% faster. |
| Kindling Brew | 12 embers | Start the delve at level 2, with a talent pick before the first fight. |

**Cost:** a delve's salvage is worth roughly 10 to 25 embers (Common 1, Fine 3, Rare 8, Epic 20), and the daily bounty's first win pays 30 + 6 × tier. So Rising Draught costs about two delves of salvage, or half a bounty, that would otherwise go to the Forge. That's the trade.

**Names:** a web search on 21 Nov 2026 for the three names with "game potion" turned up no game using them (result titles only, so it's a search check, not a legal clearance).

**Balance:** see [balance.md](balance.md#alchemy-potions-21-nov-2026).

## R4: verb sets (built 21 Nov 2026)
Each dungeon drops its own set for the **head, hands and trinket** slots. A set rewards one verb the dungeon already asks of you:

| Dungeon | Set | Verb | 2 pieces | 3 pieces |
|---|---|---|---|---|
| Ember Kiln | Kilnbreaker | interrupt | Interrupting a cast gives +10% damage for 8 s | The interrupted foe takes +15% damage for 6 s |
| Drowned Foundry | Tidewalker | keep moving | 6% less damage taken while moving | After 2 s on the move, the next hit deals +30% |
| Glarewell | Glarewarden | dodge a marked attack | Stepping out of a telegraph heals 1.5% (at most every 4 s) | ...and gives +10% damage for 4 s |
| The Hoard (raid 2) | Crawsplitter | break them free | Your hits on the Craw deal 25% more damage | Breaking the Craw gives you and the freed hero 8% more damage for 10 s (Phase 9) |
| The Smeltery (raid 3) | Platewalker | get behind him | 6% less damage taken while behind the Cinder Colossus | 6% more damage while behind him (Phase 9) |
| The Flue (raid 4) | Handover | pass it on | A Decree you hold burns you and anyone near you 30% less | 8% more damage while Spent after passing a Decree (Phase 10) |

**Drops:** a boss item in a set slot has a 60% chance to be a piece of that dungeon's set (it gets the set's name prefix). Never in the daily bounty, stress runs or Mythics, so bounty runs stay equal. The roll uses its own seeded generator, so runs without set pieces replay exactly as before.
**As built:** `sim/content/sets.ts` holds the sets and every number (`SET_TUNING`); the item card shows a teal set line. Class weapon effects are the skills team's half (PR #38).
**Balance:** see [balance.md](balance.md#verb-sets-r4-21-nov-2026).

### Phase 18: Halls, dungeons you move through (asked for by Steve, 24 Nov 2026; top priority)
Steve (24 Nov 2026, 15:14Z): move delves toward MMO-style dungeons: "Move around a dungeon and clear enemy groups of mobs in order to reach a boss. You can sometimes even skip rooms or enemies by just avoiding them." At 15:36Z he made it the focus: "move the game more towards wow parity and dungeons instead of the survivors non moving around style". The brief, "Horders Halls" (working name), is a Claude Doc: https://claude.ai/artifact/EYGycXhryNa3cSaGGoxp3h. In short:
- A delve is a map of 6 to 8 rooms joined by corridors, with packs that sleep until you come close.
- Any pack can be skipped except a door guard and the boss. A cleared pack still pays a level, a draft and a bag.
- The boss room is today's arena, so every boss stays as tuned.

Five choices are on Steve's cards (run length, skipping, the per-pack draft, replace or add, order). The rows below follow design's recommended answers until he picks. Every phase is gated, and nothing past H1 starts until Steve has played the prototype on his phone.

| # | Feature | Owner | Notes |
|---|---|---|---|
| H1 | **Prototype, one Kiln map:** a greybox map behind a setting (`?halls=1`). It has rooms and corridors from one hand-made template, sleeping packs with reach rings, skipping, a door guard, the boss door into today's arena, a corner map, and bot paths on a room graph. Measure run length, tier 1-4 win rates (full skill and reactBot average), and frame rate on a phone | engineering, design | ✅ Built and played |
| H2 | **The Kiln for real:** a 3D kit (floors, walls, corridors, arches, the boss door) and room life; sound for packs waking, doors and travel; on phones, the corner map and the edge arrow; 3 templates; QA stuck checks on every template; a class check per pack | visuals, sound, phones, QA, skills, design | ✅ Kiln Halls on, with fast trash |
| H3 | **The other solo dungeons:** the Foundry, the Glarewell, the Coldmarrow and the Wrackline, one per PR, each with its kit, each measured against today's numbers | design, visuals, sound, QA | ✅ All on the Halls map; trash rule rollout is 1.0 M3 |
| H4 | **Group dungeons:** the Hammerdeep, the Ashvents and the Pressworks. The tank pulls, packs sync in co-op, a hero far behind catches up, and fill with bots follows the host | engineering, design, skills | ✅ On, co-op included |
| H5 | **Raids:** trash halls before each raid boss; boss rooms unchanged | design, engineering | ✅ All four raids on the Halls map (#802 to #815) |

Phase 17 (the Arena) and the endgame scaling card wait behind H1, if Steve agrees.

### Phase 19: the App Store and Google Play (asked for by Steve, 25 Nov 2026; direction now, build later)
Steve (25 Nov 2026, 16:29Z), on shipping to the iOS App Store and Google Play: "Yes make sure it's In the plan." The audit with sources is [app-stores.md](app-stores.md). In short: the plan is to wrap the existing `dist/` build with Capacitor and bundle it inside the app, so it plays offline and stays inside Apple's no-downloaded-code rule (2.5.2). The repo already loads every asset by a relative path, pads for safe areas and pauses on background. The required gaps are account deletion and a privacy policy. Nothing is sold, so store billing isn't needed unless a shop is planned later.

Until P1 starts, every team keeps the game store-safe: no assets from outside hosts, no code fetched at run time, no purchases or ads without a design brief, and any new account or login also gets a way to delete it.

| # | Feature | Owner | Notes |
|---|---|---|---|
| P1 | **Delete my account and a privacy policy:** a server function that removes the player's cloud save, leaderboard rows and auth user; a Delete button in Settings; a short privacy page and a deletion request page on the site. Required by Apple 5.1.1(i) and 5.1.1(v) and by Google's account deletion rule. The migration is applied only after Steve says yes | engineering, design | ⏭ First. Also useful on the web |
| P2 | **Capacitor shell (local only):** `capacitor.config` with `webDir: 'dist'`, iOS and Android projects, the app icon and splash, no pinch zoom or text selection, Android targeting API 36. Built and run on a simulator; nothing uploaded | engineering, visuals | ⏭ 1.0 M7. Steve's 25 Nov 22:24Z ask to build toward the stores is the go for this local shell (nothing uploaded). iOS builds need Xcode 26, planned on a GitHub Actions macOS runner (to be confirmed in the first M7 PR) |
| P3 | **Device checks:** pause and sound on background, safe areas on Android edge to edge, WebRTC co-op inside the app, Supabase calls from the app's origin, saves surviving restarts and updates, native haptics, frame rate and first 3D Delve on a mid phone | QA, phones, sound | ⏭ After P2. Each item is listed in [app-stores.md](app-stores.md#check-on-a-device-not-proven) |
| P4 | **Store accounts (Steve):** Apple Developer Program, 99 USD a year; Google Play, US$25 once, plus developer verification. A new personal Google account needs a closed test with 12 testers for 14 days in a row before release | Steve | ⏭ 1.0 M10, last: only after our own testing and polish (M9). Nobody opens an account or pays for Steve |
| P5 | **Listings and first release:** screenshots, descriptions, age rating, Apple privacy labels and Google's Data safety form, TestFlight and the Play closed test, then review. Store builds follow the big-batch rhythm of Netlify deploys | design, engineering, QA | ⏭ After P3 and P4 |

## Backlog notes
- **Acolyte heals as a real cast (Kiln).** Tried and rolled back 21 Nov 2026. A Kindle cast (Quenchable, then breakable by damage, then a staggerable channel) cost the Duskblade Kiln wins at tier 6 each time. Acolytes channel 0.8% per second again, shown as a pulsing beam; the answer is to kill them. See balance.md.
