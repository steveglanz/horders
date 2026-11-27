# Kiln item names (vision v2, Checkpoint 3, design item 6d)

*Design, 27 Nov 2026. Follows [world.md](world.md) (voice guide, banned words, fire-word budget) and [rename-map.md](rename-map.md) row "Every generated gear name". Pillar 5: one world, one voice, honestly made. Steve can veto any name or line; design then brings one searched replacement.*

## What changes

Every item that drops in the Kiln Depths (in-run drops, boss items, the end chest) now takes a name written for the Kiln instead of RARITY_PREFIX + SLOT_NAMES ("Titanheart Hauberk"). Other places keep the old generator until their own pass at Checkpoint 5. Code: `PLACE_ITEMS`, `ITEM_LINES` and `itemName()` in sim/content/items.ts.

- **Common to Rare** are plain gear (vision section 4): four names per slot, four weapons per class. The rarity colour says how good it is; the name says what it is.
- **Epic and up** are one named piece per slot, and one per class for weapons, each with a line in its tooltip (world.md: "a maker and one line"). These are the Kiln's first stand-ins for Treasures, which arrive at Checkpoint 6 and will take over the Mythic effects, weapon effects and sets.
- Stats, rarity odds and every roll are unchanged: each item still makes the same two name rolls, so seeds, bots and balance grids give the same results.
- Set pieces (head, hands, trinket from the boss) keep the set word plus the last word of the name ("Kilnbreaker Mitts"). "Kilnbreaker" breaks the "-breaker" rule; sets are renamed when they merge into Treasures (CP6).
- Old saves keep the names their items already have.

## The names

Materials follow the world's rule: the Kiln's own things are clay and glaze; Wick things a delver left behind are brass, iron and cloth.

| Slot | Plain (Common to Rare) | Named piece (Epic and up) | Its line |
|---|---|---|---|
| Head | Stoker's Hood, Pot Helm, Glazed Half-Mask, Wet-Clay Cap | The Urn Warden's Lid | It guarded one door for a hundred years. |
| Chest | Potter's Apron, Slip-Stained Smock, Sherd Mail, Patched Delver's Coat | The Kiln Mother's Apron | She never once wiped her hands. |
| Hands | Kiln Mitts, Wheel-Worn Gloves, Clay-Caked Wraps, Singed Gauntlets | The Kiln Mother's Mitts | Still warm after four hundred years of firings. |
| Ring | Cutting-Wire Loop, Glaze-Bead Ring, Clay Signet, Brass Thimble | The Taster's Ring | He bit it to test it, like everything else. |
| Trinket | Warm Sherd, Pocket Coal, Potter's Stamp, Clay Whistle | The First Witness Cone | It slumped at the Kiln's first firing and never stood again. |

| Class weapon | Plain (Common to Rare) | Named piece (Epic and up) | Its line |
|---|---|---|---|
| Emberwright (coal-carrier) | Brass Tongs, Coal Pan, Kiln Rake, Fire Shovel | The Stoker's Last Tongs | Left here by a delver who never carried them home. |
| Cutwick (lamp-snuffer) | Wick Shears, Trimming Knife, Clay Knife, Glaze Scraper | The Wheel Knife | The Kiln Mother cut every pot free with it. |
| Bulwark (anvil-smith) | Kiln-Door Shield, Damper Plate, Kiln Shelf, Wedging Mallet | The Kiln's Spare Door | She had a spare made, so she won't miss this one. |
| Lumen (lamp-bearer) | Clay Oil Lamp, Glazed Lantern, Brass Hand Lamp, Pot Lamp | The Peephole Lamp | She hung it by the spyhole to watch her pots fire. |
| Slagbinder (foundry gunner) | Patched Hand Cannon, Stovepipe Cannon, Short Bore, Bellmouth Gun | The Bellows Nozzle | Made to blow air into her kiln, not slag at her pots. |

A witness cone is a real kiln tool: a small clay cone that bends when the firing reaches its heat. Wedging is kneading clay; slip is liquid clay; a damper is the plate that closes a flue.

## Rules checked

- No banned word, no Ember-/Cinder-/Ash-/Smolder- prefix, no made-up syllables, no "of the" chains, no repeat of a name already in the game (Censer and Snuffer are foes, Fire Brick a Relic, Long Poker a Spark, so none is used). A unit test (tests/kiln-items.test.ts) checks the banned list, line length (12 words or fewer), no "!" and no repeats.
- Every line is one sentence, concrete, and sure of itself (voice guide rules 1 to 3).

## Searches (27 Nov 2026)

Each of the 50 names was searched as an exact phrase on [warcraft.wiki.gg](https://warcraft.wiki.gg) and [wowpedia](https://wowpedia.fandom.com) through their search APIs (a control search for "Shield Slam" returned 548 hits, so the search worked).

- 48 of 50 had no match on either wiki.
- Two first picks were swapped though both are plain English: "Scorched Gauntlets" (wiki.gg hit: the WoW item Salt-Scorched Gauntlets) became **Singed Gauntlets**, and "Hanging Lamp" (WoW decor such as Valdrakken Hanging Lamp) became **Pot Lamp**. Both replacements have no match.
- Web: "Witness Cone" as a game item has no match (only D&D's Witness Crystal and The Binding of Isaac's Witch's Cone). "Kiln Mother" has no game match.
- Azeroth Survivors: its site (wowsurvivors.com) names none of these words.
- Watch, not a name clash: Double Fine released **Kiln** (2026), a pottery brawler ([Xbox Wire](https://news.xbox.com/en-us/2026/02/26/how-kiln-two-week-prototype-became-full-fledged-journey/)). It shares the clay theme with our first place. The place name (The Kiln Depths) was settled in #877; this pass adds no new use of "Kiln" as a proper name beyond the place and its boss.
