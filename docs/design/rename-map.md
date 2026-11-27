# Horders: rename map (Checkpoint 1)

*Design, 27 Nov 2026. Goes with [world.md](world.md) (world bible and voice guide). Pillar 5: one world, one voice, honestly made.*

**Status: approved for the rename work (27 Nov 2026).** Steve said not to wait on him (27 Nov 06:00Z: "You don't need to wait on me for anything") and earlier let the teams settle open design questions (25 Nov 16:41Z), so the in-game rows in sections 1-4 are settled and queued for engineering. Steve can veto any row at any time. **The game's own title is not settled:** a Horders to Emberthief change is on Steve's to-do list (section 8) and is not applied.

**How it gets applied.** Display names only: every id in code (`maelra`, `duskblade`, `hoard` and the rest) stays, so saves, bots, tests and netsync don't move. Engineering applies the rows in one PR per group (places and bosses, classes, systems), each with the boss tips and help text that mention the old names. Foe and item names come later with their own passes (Checkpoint 3 for the Kiln, Checkpoint 5 for the rest), using the rules here.

**How each name was checked.** Rules: world.md naming rules and banned words, and the vision's naming rules (vision/vision.md section 3). Clashes: web searches on 27 Nov 2026 for each new proper name or coined word, against WoW (warcraft.wiki.gg, wowhead), Blizzard, Azeroth Survivors and other games. Steve's rule (21 Nov): ordinary English words that WoW happens to use may stay; proper names, coined words, places and WoW phrases get renamed. A search that finds nothing is not proof of nothing; the links are in the search log at the end.

---

## 1. Places

| Today | Proposed | Why | Search |
|---|---|---|---|
| The Kiln Depths | **keep** | Real words, the Hoard's mouth | - |
| The Drowned Foundry | **keep** | Real words, tells its story | - |
| The Glarewell | **keep** | Real-word compound you can picture | no game found [1] |
| The Coldmarrow | **keep** | Real-word compound | no game found [1] |
| The Wrackline | **keep** | A real word (the tide line on a beach) | no game found [1] |
| The Hammerdeep | **keep** | Real-word compound | no game found [1] |
| The Hoard (raid) | **The Strongroom** | "The Hoard" now means the whole furnace (one word, one meaning). The raid is the Court's vault, and "strongroom" is a plain word for one. "The Counting House" was the first pick and was dropped: it is a Baldur's Gate 3 location, and WoW has two named Counting Houses [2]. | no WoW place found, only "Strongbox" items [3] |
| The Ashvents, The Pressworks, The Crucible, The Smeltery, The Flue | **keep** | Plain words; held for later seasons | - |

## 2. Bosses (the Furnace Court)

Rule: a family title plus one plain word tied to what they do, or "The" + plain word + title. No invented personal names (world.md).

| Today | Proposed | Why | Search |
|---|---|---|---|
| Smolderhusk, the Kiln Mother | **The Kiln Mother** | Her title says who she is; dropping "Smolderhusk" saves the first hour a word (vision rule 6) and a Smolder- prefix (banned) | "Smolderhusk" alone: no hits [4] |
| Maelra, the Drowned Bellows | **Dowager Bellows** | "Maelra" is an invented name. Keeps her bellows and drowned works; "Dowager" is grand and a little funny | no hits for the phrase [5] |
| The Lensmother | **The Glass Heir** | Two "Mothers" in five places blur. The vain youngest who watches through lenses; glass is the Court's material | no hits [6] |
| Nhevra, the Cold Hearth | **The Banked Queen** | "Nhevra" is an invented name with a generator-style "Nh". A banked fire is one covered to last the night; hers went cold | no hits [7] |
| Hessa of the Ebb | **Aunt Ebb** | Invented name out; ties her to the Ebb, her water mechanic | no exact hit [8] |
| Ondrel of the Hammerdeep | **The Iron Uncle** | Invented name out; he hoards Wick's stolen iron, which is why the armoury is the one place below with iron | no exact hit [8] |
| Old Vorhulm | **Uncle Glut** | Invented name out; "glut" is the greed and the Gorge in one plain word | no hits [6] |
| Vorhulm the Glutton (Kiln named foe) | **The Taster** | Uncle Glut's taster, sent up to eat embers first; no longer shares a name with a boss | plain word, not searched |
| Ysmeret, the Twofold Flame | **Cousin Fork** | Invented name out; a forked flame, the twofold fight | no hits [6] |
| Oskel of the Pressworks | **Cousin Stamp** | Invented name out; the press that stamps the Court's mark | no hits [6] |
| The Cinder Colossus | **The Colossus** | Drops a Cinder- prefix (fire-word budget); it's the Kiln Mother's largest firing | plain word |
| The Furnace Regent | **keep** | Plain words; the vision's own example | "Furnace Court" and "Furnace Regent": only an unrelated board game, *Furnace* [9] |
| Grandmother Slag | **keep** | Already follows the rule | - |
| Shadow of the World Boss | **name it with Season 1** | "Shadow" is banned filler; the world boss returns as a season finale, so its name comes with that season | - |

Boss **move** names (Anvilfall, Slag Grip, Cataclysm, Decree and the rest) are checked when each boss is remade (Kiln Mother at Checkpoint 3, the rest at Checkpoint 5). "Cataclysm" is a WoW expansion name and should not survive the Kiln Mother remake.

## 3. Classes (Wick's trades)

| Today | Proposed | Trade | Why | Search |
|---|---|---|---|---|
| Emberwright | **keep** | Coal-carrier | "-wright" is a trade word; the first class | no game class found [10] |
| Bulwark | **keep** | Anvil-smith | Plain word that says "tank" to a new player | - |
| Lumen | **keep** | Lamp-bearer | Plain word. "Lamplighter" was the first pick and was dropped: the Lamplighters are a WoW: The War Within faction [11] | - |
| Duskblade | **Cutwick** | Lamp-snuffer | **Duskblade is a Dungeons & Dragons 3.5 base class** (Player's Handbook II) [12]. "Cutwick" is a lamp-snuffer's trade (cutting wicks), a nod to a cutpurse, and ties the class to Wick | no game or WoW hit; only English place names [13] |
| Slagbinder | **keep** | Foundry gunner | Trade-like compound, fits the cannon rework | no game class found [10] |

Class resources: keep Heat, Momentum, Resolve and Slag. **Lumen's "Radiance" → "Oil"** (approved with the rest): a lamp burns oil, which is concrete and a trade word, where "Radiance" is generic fantasy.

## 4. Systems and words

One word, one meaning (vision rule 5). Rows marked *roadmap* are already decided there; this map only records them.

| Today | Proposed | Why |
|---|---|---|
| In-run "talent" cards ("Choose a talent") | **Sparks**, "Catch a Spark" | *Roadmap.* "Talent" now means only the permanent tree |
| Hero talents (the tree) | **Talents** | *Roadmap* |
| Heirlooms (planned in the vision) | **Treasures** | **Heirlooms is a WoW item system** [14]. The Court's named treasures fit a game about a hoard; plain and clear to a new player |
| The Day's Heat (daily twist, sim/content/heat.ts) | **The Court's Mood** ("The Court is restless today: …") | "Heat" is also the Emberwright's resource; one word, one meaning |
| Boss echoes (Seen: "Echoes") | **Old Tricks** ("She falls back on an old trick") | The Court are old and repeat themselves; says what happens |
| Burnout (losing to a clock) | **Boil-over** at 90 s, shown | *Roadmap* replaces Burnout with a visible enrage; this names it |
| Hero (in player text: Hero tab, "Hero 2") | **Delver** in world text; bots get trade names | The world calls you a delver (Delver's Keys already do). The UI tab can stay "Hero" until the Wick hub replaces tabs |
| "The dungeon stirs" | **"The Hoard stirs"** | Every place is a layer of the one Hoard |
| Ember Shrine (rest room) | **Delver's Rest** | A Wick-made stash, not a Court shrine; drops an Ember- prefix |
| Potions, Rising Draught, in-run quests | cut | *Roadmap*: Relics replace them |
| Collection, Achievements, Seen | **Journal** | *Roadmap* |
| Daily bounty | **Quick Delve** | *Roadmap* |
| Weekly quests, first-win bonus, season marks | **Weekly Cache** | *Roadmap* |
| Mythics, weapon effects, verb sets | **Treasures** (above) | *Roadmap* merge, new name |
| Embers, Quench, Grit, Omens, Delver's Keys, the Forge, Relics, Blueprints, Fusions, Notice Board | **keep** | Plain words that already fit the world |
| Rarities Common to Mythic | **keep** | Steve's ladder (#860, #862) |

## 5. Sparks (the in-run cards)

The roadmap starts Sparks at 8 per class (3 that change behavior), chosen at Checkpoint 2. So the card names are written then, against these rules, and each new card name is searched. What to fix from today's 137 card names (sim/content/emberwright.ts) when they carry over:

| Today | Rule it breaks | Do |
|---|---|---|
| Clinker Heart, Lantern Heart | banned "-heart" | rename if kept |
| Phoenix Lance | "phoenix" is stock fantasy, and doesn't fit fire stolen from a furnace | rename if kept |
| Shadow Slip | banned "shadow-" (kept on 21 Nov under the old rule; the new list bans it) | rename if kept |
| Hot Blood, Warm Hearth | fine: ordinary phrases | keep |
| Cards named after WoW abilities that Steve kept on 21 Nov (Combustion, Conflagration, Momentum, Execution, Hamstring, Charge, Kick, Blink) | Steve's ruling stands | keep unless Steve asks to revisit; never add more |

Card names follow world.md: concrete, plain English, the trade's tools and materials (tongs, coal, shears, wick, anvil, lamp, slag), no Ember-, Cinder-, Ash- or Smolder- prefix.

## 6. Other names that break the new rules (fix when their system is rebuilt)

| Today | Where | Rule | When |
|---|---|---|---|
| Kilnbreaker (set) | sim/content/sets.ts | banned "-breaker" | sets merge into Treasures |
| Hearthkeeper (set) | sim/content/sets.ts:39 | name now belongs to the Hearthkeeper | sets merge into Treasures |
| Lockbreaker, Namebreaker (achievements) | sim/content/achievements.ts | banned "-breaker" | Journal (Checkpoint 6) |
| Banked Heart, Phoenix Feather (items) | sim/content/items.ts | "-heart"; stock fantasy | items are rewritten by hand per place |
| Every generated gear name (prefix + slot) | sim/content/items.ts:107-132 | rule 3 | *roadmap*: the generator is deleted |
| "the Cold Hearth" (Season 3 title) | sim/content/season.ts:62 | free now that the boss is the Banked Queen; seasons are off at launch | with Season 3 |

## 7. Foes (naming rule now, names with the job pass)

Rule (world.md): a Court foe is named for the pot or clay thing it is, or for its job in plain words, never with an Ember-, Cinder- or Ash- prefix. Ideas to start the Kiln pass from, **not proposals yet** (they get searched with the pass): Hollow Warden → Urn Warden, Ember Spitter → Spout, Ember Acolyte → Censer, Ashling → Sherds, Cinder Brute → Crock. Cinderhound, Glass Warden, Snuffer, Barge Hauler, Conchblower and the other plain-word foes can stay if their job survives.

---

## 8. The game's name (shortlist)

Decision 3 in the roadmap: decided at the end of Checkpoint 2, after cold testers repeat back the fantasy, before any store asset. This is the first check, not a legal clearance.

| Name | What the searches found (27 Nov 2026) | Read |
|---|---|---|
| **Horders** | App Store search is full of "Horde" games: Horde.io, Heroes vs Hordes, Hold the Horde, Against the Horde, Horde [15]. Google Play already has an app called "HORDERS" (a dealer-ordering app by Hawkins Cookers Ltd; [docs/store/listing.md](../store/listing.md):19, #870). "Horde" is also a WoW faction (same file, line 23). Reads as a misspelling of "Hoarders" | Works with the world (the Court are the hoarders) but is hard to find and easy to misread |
| **Emberthief** | No game with that title found. The "Ember" space is crowded: *Ember* (Steam and App Store), *Emberheart*, *Emberstride*, *Emberbane* [16]. "Ember"-named trademarks exist for game companies (Ember Games Inc., Ember Entertainment) [17] | Says the fantasy in one word; still the lead pick, pending a USPTO search |
| **Kilnward** | No exact hit. A game titled *Kiln* is listed (games.gg, gamepressure) [18] | Backup; less clear as a fantasy |
| **Hearthless** | No game found, but every result is Blizzard's *Hearthstone* [19] | **Drop:** in a store search it sits beside Blizzard's game |

**Still needed before a name is final:** a USPTO trademark search (free, tmsearch.uspto.gov; needs a browser, a later thread or Steve's Chrome), a search inside both stores on a phone, and a domain check. None of this costs money.

---

## Waiting on Steve

Only the game's title (section 8). Recommendation: keep "Horders" in every build until the end of Checkpoint 2, then rename to **Emberthief** if the USPTO search, the in-store phone search and the domain check are clean, with Kilnward as the backup. A veto on any in-game row gets one searched alternative from design.

## Search log (27 Nov 2026)

1. "Glarewell" OR "Coldmarrow" OR "Wrackline" OR "Hammerdeep" game: no game with these names in results (noisy; itch.io and BackerKit pages only).
2. [bg3.wiki: The Counting House](https://bg3.wiki/wiki/The_Counting_House); [warcraft.wiki.gg: Orgrimmar Counting House](https://warcraft.wiki.gg/wiki/Orgrimmar_Counting_House); [Tradewinds Counting House](https://warcraft.wiki.gg/wiki/Tradewinds_Counting_House).
3. "Strongroom" warcraft wiki: only strongbox items, e.g. [Blackrock Strongbox](https://warcraft.wiki.gg/wiki/Blackrock_Strongbox).
4. "Smolderhusk": results only about the word "smoldering".
5. "Aunt Bellows" OR "Glass Dowager" OR "Anvil Heir" game: only the board game *Deadly Dowagers* ([Dice Tower](https://dicetower.com/board-game/381790)).
6. "Cousin Stamp" OR "Cousin Fork" OR "Uncle Glut" OR "Glass Heir"; "Banked Queen" OR "Uncle Glut" game: shopping and card-game pages, no game character.
7. as 6.
8. "Iron Uncle" OR "Aunt Ebb" OR "Dowager Bellows" warcraft: WoW iron dwarves and Moira Thaurissan pages, no exact name ([Iron dwarf](https://warcraft.wiki.gg/wiki/Iron_dwarves)).
9. "Furnace Court" game: only the board game *Furnace* ([Dice Tower](https://dicetower.com/board-game/318084)).
10. "Slagbinder" OR "Emberwright" game class: homebrew documents, no published game class.
11. [warcraft.wiki.gg: Lamplighter Kaerter](https://warcraft.wiki.gg/wiki/Lamplighter_Kaerter), [Lamplighter Recruit](https://warcraft.wiki.gg/wiki/Lamplighter_Recruit), [Lamplighter's Unlit Torch](https://warcraft.wiki.gg/wiki/Lamplighter%27s_Unlit_Torch).
12. [Wikipedia: Player's Handbook II](https://en.wikipedia.org/wiki/Player%27s_Handbook_II); [D&D 3.5 SRD: Duskblade](https://drinkinganddragons.com/d20/srd/classes/duskblade.htm).
13. "Cutwick": English place-name pages only (e.g. [Cuttice Down](https://epns.nottingham.ac.uk/browse/id/532886d2b47fc40d380000a6-Cuttice+Down)).
14. [warcraft.wiki.gg: Heirlooms](https://warcraft.wiki.gg/wiki/Heirlooms); [Blizzard: New Heirloom System](https://worldofwarcraft.com/en-us/news/17862500).
15. [Horde.io](https://apps.apple.com/us/app/id6473726670), [Heroes vs Hordes](https://apps.apple.com/us/app/heroes-vs-hordes-survival-rpg/id1608898173), [Hold the Horde](https://apps.apple.com/us/app/-/id6450905300), [Against the Horde](https://apps.apple.com/us/app/id1631351942), [Horde](https://apps.apple.com/in/app/horde/id6475875320).
16. [Ember (Steam)](https://store.steampowered.com/app/339580/Ember/), [Ember (App Store)](https://apps.apple.com/gb/app/ember/id906826053), [Emberheart Demo](https://store.steampowered.com/app/1437300/Emberheart%20Demo), [Emberstride](https://rawg.io/games/emberstride), Emberbane (Steam app 2085310).
17. [Ember Games Inc. trademarks](https://trademarks.justia.com/owners/ember-games-inc-2264420), [Ember Entertainment trademarks](https://trademark.justia.com/owners/ember-entertainment-inc-2249719).
18. "Kilnward" and "Kilnward" OR "Kiln Ward" game: no exact hit; [games.gg: Kiln](https://games.gg/ja/kiln/), [gamepressure: Kiln](https://www.gamepressure.com/games/kiln/z07144).
19. "Hearthless" game app: only Hearthstone pages ([App Store](https://apps.apple.com/US/app/id625257520)).
