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
| L1 | **First 10 minutes:** a tutorial delve (one fight per verb), and tooltips the first time each mechanic shows up | design + engineering | ✅ First delve built ([first-delve.md](first-delve.md)): teaching route, softer foes, coach lines; novice first-run wins 50-65% → 90%+. First-time tips for red and gold circles (client/coach.ts) |
| L2 | **Performance:** 60 fps on a mid phone with 4 heroes; asset sizes; a load time under 3 s | engineering | 🔨 Load: about 3 s on slow 4G (2.80 to 3.05 s on 21 Nov after the Wrackline content, tools/partyperf.cjs) with a trimmed Phaser build that also drops Phaser's unused sound system. New content keeps adding bytes, so this needs watching. Frame rate on a real mid phone still needs a device |
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
| V8 | **Daily bounty leaderboard** by clear time | engineering | 🔨 Built (#261): "Today's fastest" in the bounty sheet, server rules in supabase/migrations/0006_bounty_board.sql. Shows nothing until Steve OKs applying 0006 |

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
| Y8 | **Apply the waiting migrations** 0006 (bounty board) and 0007 (Old Vorhulm) | engineering | ⏸ Only after Steve says yes |
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
| Y1 | **Wave shapes:** each trash fight's foes arrive in a seeded shape: today's arc; a pincer from two sides; a ring round the party; or half now and reinforcements a few seconds later, with a warning | design | ⏭ Solo and group trash, then raids; measured against each band on 120 to 160 seeds |
| Y2 | **Raid trash events:** Cave-in and Vent Surge in raid openers and named fights (never the boss), as the group dungeons got in #494 | design | ⏭ Raids stay 55 to 70% at their unlock tier |
| Y3 | **Third boss versions:** a third phase-2 version for each solo boss, the Kiln Mother first, then Maelra, the Lensmother, Nhevra and Hessa; group and raid bosses after | design | ⏭ One boss per PR, every version within the band; names searched for WoW matches |
| Y4 | **Seen log:** each hero keeps a record of the boss versions, named-foe traits, arena events, wave shapes and Heats they have met. The end screen marks what's new, and the hub shows what's still unseen in each dungeon | engineering | ⏭ Reads runShape (sim/runshape.ts); saved with the hero |
| Y5 | **Class check:** each class against each wave shape (melee against a ring, ranged against a pincer) and each third version | skills | ⏭ After Y1 and Y3 ids |
| Y6 | **Art**, in the current lit 2D style: where each wave comes in from, the reinforcement warning, each third version's mechanic, and the Seen log | visuals | ⏭ After Y1, Y3 and Y4 ids |
| Y7 | **Sound:** a cue for reinforcements arriving and for a wave from behind, and each third version's cues | sound | ⏭ After Y1 and Y3 ids |
| Y8 | **QA:** contentcheck forces each wave shape and third version (0 stuck); variety.ts counts wave shapes | QA | ⏭ |
| Y9 | **Phones:** foes coming in from off screen get an edge marker at 320 px; the Seen log fits a phone | phones | ⏭ After Y1, Y4 and Y6 |

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

## Backlog notes
- **Acolyte heals as a real cast (Kiln).** Tried and rolled back 21 Nov 2026. A Kindle cast (Quenchable, then breakable by damage, then a staggerable channel) cost the Duskblade Kiln wins at tier 6 each time. Acolytes channel 0.8% per second again, shown as a pulsing beam; the answer is to kill them. See balance.md.
