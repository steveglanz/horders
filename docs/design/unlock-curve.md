# The unlock curve (1.0, Checkpoint 1)

*Design, 27 Nov 2026. Pillar 1 (a dungeon night in your pocket) and pillar 5 (one world, one voice). Source: [vision/vision.md](vision/vision.md) section 4, with the roadmap's overrides ([roadmap.md](roadmap.md), "What changes": tiers kept at 15, interrupts only on some classes). Names follow [world.md](world.md) and [rename-map.md](rename-map.md) (Cutwick, Sparks, Treasures, Boil-over).*

**The rule.** Every system the player can see has a row here, with the moment it lights up. A PR that adds a system adds its row first. A new player sees **Play plus at most 2 lit buildings** in Wick, and meets **about 10 game words in the first hour** (world.md, "The first-hour word list"). Anything not yet unlocked is not shown at all: no greyed buttons, no "unlocks at tier 7" labels on the hub.

**Hours are targets, triggers are rules.** The hours below are judgment (a delve is 6-8 min, so hour 1 is about 7-9 delves). The code checks the trigger, never the clock. The event log (engineering, Checkpoint 1 spec) measures real time-to-trigger from Checkpoint 2 on, and the hours get corrected from it.

## The curve

| When (target) | What lights up | Trigger the code checks | Word it adds | Today on main (b8f5426) | Change needed, checkpoint |
|---|---|---|---|---|---|
| **Minutes 0-5** | Move, dodge (button; flick as an option) | First launch | - | No dodge | Dodge, CP2 |
| | Emberwright's Q (Flame Wave), basic attack | First launch | Wick, the Court, the Hoard (opening lines) | Q from level 1 (`SLOT_UNLOCK = [1, 2, 3, 4]`, sim/content/classes.ts:89) | Opening lines, CP3 |
| | Sparks (the in-run pick) | First level-up in the first delve | Sparks | Called "talents"; 24-30 cards per class (sim/content/emberwright.ts `TALENTS`) | Rename + 8 per class, CP2 |
| | Quench | Taught in the opening, on the Kiln Mother's first blue cast | Quench | The F slot opens at character level 4, so the first delve leaves Quench out (sim/content/firstdelve.ts:25) | **Design pick (27 Nov, [opening.md](opening.md)):** F opens at level 1 for every class (`SLOT_UNLOCK = [1, 2, 3, 1]`); classes grid passed and shipped 27 Nov (UNLOCK_AID now goes by level, not locked slots). Interrupts stay on Bulwark, Cutwick and Emberwright only |
| | The Kiln Mother (short, can't lose) | First delve | the Kiln Mother, embers | Tutorial Kiln, boss 19-37 s (docs/design/first-delve.md) | Remade in CP3 |
| | **The Forge** (building 1) | Back in Wick after the first delve, with embers in hand | the Forge | Forge is a hub tab, always shown | Wick hub, CP3 |
| **Hour 1** | Kiln tiers 1, 2, 3 | Win your top tier to open the next (today's rule) | - | Same rule (sim/hero.ts maxTier, cap 15 in sim/content/scaling.ts) | Keep |
| | **Cutwick** (second free class) | First Kiln tier 1 win | - | Every class is pickable from the start (client/hub.ts:319, no lock) | Class lock + trade halls, CP3 |
| | Relics (pick 1 of 2 after the door guard) | Second delve onward (the first delve stays bare) | Relics | Potions and in-run quests instead | Relics replace both, CP2 |
| | First Blueprint | First kill of any boss always drops one (the tutorial Kiln Mother's kill counts) | - (shown as "a new Spark/Relic for your pool", the word comes in hour 2) | None | CP4 |
| | **The Notice Board** (building 2): Quick Delve | After the third finished delve (won or lost) | the Notice Board | Daily bounty chip on the hub, open-arena map | Quick Delve, CP6 |
| | **The Court's First Seal** (end of the free part) | Reaching the Foundry door: winning Kiln tier 3, which opens tier 4 | - | Foundry opens at tier 4 (sim/content/dungeon.ts:191) | Story moment + purchase, CP7 |
| **Hours 2-5** | The Drowned Foundry | Tier 4 (after the Seal) | - | Tier 4 | Keep |
| | Bulwark, Lumen, Slagbinder (their trade halls light) | All three at the First Seal | - | Open from the start | CP3 lock, CP7 tie to the unlock |
| | Talents (the permanent tree, in the trade halls) | Character level 5. Points earned from level 2 are banked, not lost | Talents | Tree open from level 2 (sim/content/trees.ts:3) | Hide until level 5, CP6 |
| | Ability options (sidegrades at 8, 12, 16) | Character level 8, 12, 16 | - | Same (sim/content/classes.ts:109-131) | Keep, add a "recommended" tag, CP4 |
| | Omens | Tier 3 and up (1 Omen from t3, 2 from t6, 3 from t10) | Omens | Same (sim/content/omens.ts:51 `omenCount`) | Keep; tiers add rules from t3, CP5 |
| | Blueprints (the word and the pool view) | Second Blueprint found | Blueprints | None | CP4 |
| | The Glarewell | Tier 7 | - | Tier 7 | Keep |
| | The Weekly Cache (on the Notice Board) | First win after the Notice Board lit | the Weekly Cache | Weekly quests, first-win bonus, season marks as separate chips | CP6 |
| | **The Journal** (kept by the Hearthkeeper) | First kill of a second boss (the Foundry's) | the Journal | Collection, Achievements, Seen | CP6 |
| **Hours 5-20** | The Coldmarrow, the Wrackline | Tier 10, tier 13 | - | Same (dungeon.ts:201, 206) | Keep |
| | The Hammerdeep (bots or friends) | Shown from tier 7 | - | Opens at tier 4 (dungeon.ts:211) | Move the reveal to tier 7, CP6 |
| | Treasures (the named Epic-and-up chase) | The first Treasure drops | Treasures | Mythics, weapon effects, verb sets | CP6 |
| | Tiers up to 15 | Same win-to-open rule | - | Cap 15 (#863) | Keep (Steve's call) |
| | Grit | Shown the first time it applies (losses in a row) | Grit | A hub pill | CP6 |
| **Hour 20 on** | Delver's Keys (the endless ladder) and the Keys board | First Coldmarrow win (tier 10 won) | Keys | Keys from tier 6 (sim/content/keys.ts:13) | Move to tier 10 won, CP6 |
| | Seasons, the world boss | Season 1, about 6 weeks after launch | - | On now | Off at launch, CP6 |
| **Co-op** | Join a friend's run | Any time after the first delve | - | Any time | Keep (free) |
| | Host co-op | After the First Seal (free players: one hosted run a day) | - | Any time | CP7 |

## Checks for any PR that touches the hub or a new system

- [ ] The system has a row above, and its trigger is what the code checks.
- [ ] A fresh save (event log or `tools/playdriver.cjs`) never shows more than Play plus 2 new things at once.
- [ ] Its word is in world.md, and it arrives with one line from the Hearthkeeper and one reward.
- [ ] Nothing locked is drawn on the hub.

## What this curve does not decide

The free part's price and the purchase screen (CP7, Steve's decision 4). The exact Quench fix (CP3, classes). The hour targets, which the event log corrects.
