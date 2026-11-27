# Horders: unified vision and road to launch

*Game Director, 27 Nov 2026. This is the plan of record. It is built from the five team proposals, the five debate replies, both research reports (research-retention.md, research-market.md), the audit, the positioning page, the phone screenshots and the 3D room sheet. Claims about other games or the market link to a source. **(judgment)** marks my own call.*

**The short version.** The five teams found the same problems on their own: no world, everything too small, hits with no weight, too many systems on screen at once, names that read as generated, music from an AI tool, losses that pay nothing, melee that fails late, and twelve places that share one set of foes. We keep the core (room-to-room delves, a stick, four buttons, an automatic basic attack, bosses with telegraphs) and make it **smaller, bigger on screen, and about something**. We cut to six places we can make distinct and give them one hand-made look and one world. A new player meets one system at a time. Nothing is built at scale until one Kiln room passes a blind test against today's build.

---

## 1. The pitch and the hook

**Pitch (one sentence):** *Steal fire from a furnace full of greedy kings: real boss fights you read and beat in portrait, a few minutes at a time.*

The fantasy comes first, as every lasting game has one ("escape the underworld"; research-retention P2). Portrait boss fights are the proof. No game in our research has both: portrait-first touch play, which even Balatro's phone port lacks ([148Apps](https://148apps.com/balatro/review)), and boss fights you read and react to, with roles. The fan survivors game asks phone players to turn sideways and fires spells on its own (positioning.md).

**The hook: what grabs a player in the first 5 minutes.** One tap and you're playing. Within 5 minutes you have dodged a red slam, broken a blue cast and beaten a boss, and the fire you stole has relit your town.

| Time | What happens |
|---|---|
| 0:00 | Title: a cold town at night, one hearth guttering, a slow anvil beat. The name and "Tap to wake." Nothing else. |
| 0:10 | The Hearthkeeper, an old woman with the last coal, says two lines: *"The Court took the fire. Go down and take some back."* You are an Emberwright. There is no class picker yet. |
| 0:20 | You drop into the dark mouth of the Kiln, lit only by the ember you carry. You learn to move. |
| 0:40 | Three big cinderhounds. Your basic attack fires on its own and you press Flame Wave. Every hit flashes, knocks back and buzzes in your hand. They shatter like pottery. |
| 1:00 | First level-up: **Catch a Spark**, 3 cards. One of them changes how you play, not just a number. |
| 1:30 | A Warden slams the floor and draws a red, jagged zone. You learn the **flick-dodge** (flick the stick to roll). It works the same for every class. |
| 2:30 | A Warden starts a blue cast inside a cracked ring. You learn **Quench**. *"It fears water. Of course it does."* |
| 3:15 | Smolderhusk, the Kiln Mother, in a short 90-second version you can't lose. She taunts you and shows one red attack and one interrupt. |
| 4:30 | She falls. You carry her great ember up, the town hearth roars and the Forge lights. *"Bring more."* |
| 5:00 | One button: **Delve again**. |

I changed one thing from the Creative Director's draft. The tutorial teaches the flick-dodge on red, not Blink, because only one class has Blink and every class has the roll (Combat's point).

---

## 2. Design pillars

Every PR names the pillar it serves and passes that pillar's test. A PR that serves no pillar waits.

| # | Pillar | What it means | The PR test |
|---|---|---|---|
| 1 | **A dungeon night in your pocket** | The mini-MMO beats in one short sitting: a pull, trash, a named fight, a boss, loot, a "ding". You press abilities and choose when; nothing fires on its own except the basic attack. Roles (tank, healer, damage), cast bars and interrupts are the identity. | The PR names the beat it strengthens (pull, trash, boss, loot, ding, role) or one of the six positioning differences. It adds no auto-firing ability. |
| 2 | **Read it, answer it** | Every threat has one tell in a reserved signal colour **and** shape: red with a jagged edge means move, a gold ring with chevrons means stand here, a cracked blue ring means interrupt. Each one has an answer within reach of every class. | Every new attack has a tell drawn from `style.ts` signals. It gives at least 0.8 s of warning and starts on screen, or an edge arrow shows. It has a melee-range answer or can be rolled through. The palette test passes. |
| 3 | **Short, fair, and it always pays** | Trash takes 15 to 30 s, named fights 30 to 45 s, a boss 60 to 90 s, a delve 6 to 8 min, a Quick Delve about 4 min. You never lose to a clock. Every run, won or lost, sends you home with something you can see. | The bot matrix stays inside the fight budgets, and no class wins less than 60% as often as the best class, in every launch dungeon at average skill. The loss screen is never empty. |
| 4 | **Big in the hand** | Portrait at 390x844, two thumbs. The hero stands 70 to 80 px tall and trash at least 40 px. Every hit flashes and sounds within 50 ms. It holds 60 fps on a mid-range Android phone. | The PR attaches 390x844 screenshots, or a clip if the change moves. The measured hero height is at least 70 px and touch targets are at least 44 pt. The frame rate stays at 60 fps on the test device. |
| 5 | **One world, made by hand** | Every name, line, colour and sound comes from the world bible and `style.ts`. No generative-AI art, music, voice or text ships. A new player meets one new system per session. | New names appear in the rename map and follow the naming rules (section 3). No colour exists outside `style.ts`, enforced by a unit test. No audio file comes from a generator. Any new system names what it replaces and where it unlocks on the curve (section 4). |

**Standing rule:** we never sell power, energy, revives, keys, embers, loot or upgrades. Diablo Immortal sold power and holds the lowest user score in Metacritic history ([VGC](https://www.videogameschronicle.com/news/diablo-immortal-now-has-the-lowest-user-score-in-metacritic-history)).

---

## 3. World and tone

**The world.** The surface has gone cold. Long ago the **Furnace Court**, a family of fire-kings and fire-mothers, pulled every flame in the land down into one mountain-sized furnace called **the Hoard**, and sealed themselves inside with it. Above, the last town, **Wick**, huddles around one dying hearth. You are a delver from Wick. You go down into the Hoard, steal fire from the Court and carry it home as **embers**. Each place is a layer of the Hoard:

- **The Kiln Depths** are its mouth.
- **The Drowned Foundry** is where the river broke in and drowned the Court's works.
- **Glarewell** is the lens-tower where the Court watches the cold world.
- **Coldmarrow** is the bottom, where even the Court's fire died.
- **Wrackline** is the underground quay where stolen fire was shipped in.
- **The Hammerdeep** is the Court's armoury, a group dungeon.
- **The Hoard** itself is the vault. It is the raid, and it comes in Season 1.

The bosses are members of the Court: Smolderhusk the Kiln Mother, the Furnace Regent, Grandmother Slag the matriarch, and Nhevra the Cold Hearth. The five classes are Wick's fire trades:

| Class | Trade |
|---|---|
| Emberwright | hearth-keeper |
| Bulwark | anvil-smith |
| Lumen | lamp-bearer |
| Duskblade | lamp-snuffer and born thief |
| Slagbinder | foundry gunner |

The name "Horders" also fits: the Court are the hoarders. Nearly every system we already have gains a meaning without new code:

- Embers are stolen fire.
- Heat is fire you hold.
- Quench is water, which the Court fears.
- Coldmarrow's "keep your coal alight" is the whole fantasy in one mechanic.

**The material rule** (which the Art Director proposed and I adopt in full): *everything the Court made is fired clay* (terracotta, glaze and stoneware, glowing through cracks), *and everything Wick made is iron, cloth and brass.* That one rule settles shape, colour and sound.

**Tone: cozy against menacing.** Above is a warm hearth; below is a hungry furnace. The tone is dark and a little funny, never grim. The Court are greedy, grand and old, and they talk down to you ("Back again, little thief? You still smell of my kiln."). The story is told in short text only: about 100 boss taunts chosen by what happened in the run, and about 30 Hearthkeeper lines that react to your progress. There is no voice acting and no cutscenes. Hades shows that a world you hear across many deaths turns repeat runs into story ([Game Developer](https://gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death)).

**Naming rules** (enforced by one editor against the voice guide):

1. **Court names** use fire, kiln, pottery and royal words with grand family titles: Mother, Regent, Grandmother, Heir. **Wick names** use trade, tool and household words: Wick, Forge, Notice Board.
2. **Use real English words**, single or two-word compounds you could picture holding (Bellwarden's Collar, Kiln Mother). Don't use made-up fantasy syllables, apostrophes for flavour, fake Latin or "-ia" endings.
3. **Every item is written by hand** with a maker or place and one line of flavour ("Bellwarden's Collar: *rang every time she lied.*"). The prefix-plus-slot generator (sim/content/items.ts:107-132) is deleted.
4. **Banned as filler:** ancient, eldritch, arcane, void, titan, shadow-, -heart, -breaker, -bane, doom-. These are the words players read as generated.
5. **One word, one meaning.** "Talent" means only the permanent tree. In-run picks are **Sparks**. Keep existing words that work: embers, Heat, Quench, Omens, Delver's Keys, the Forge.
6. **No more than about 10 game words in the first hour.** Each new word arrives with its system, one line and one reward.
7. **Never use names or content from WoW, Blizzard or Azeroth Survivors.** That includes the obvious near-misses: no "Hearth-stone", no "keystone" or "affix" for our keys and Omens, no "Mythic+". Each new name is searched against them before it merges.
8. **Bots get trade names** ("Anvil-smith Brenna"), never "Hero 2".

---

## 4. The core loop

| Loop | Today | From now on |
|---|---|---|
| **Session** (5 to 10 min) | The hub shows 12 dungeon dots, a tier strip and 8 chips (13-01-hub.jpg) before one Delve button. | You open to **Wick**, a single fixed diorama of a town at night with one big **Play** button. Buildings stay dark until their system unlocks, and a new player sees Play plus at most 2 buildings. Pause and resume mid-delve, so a phone call never costs a run. |
| **Run** | A Halls map of 6 to 8 rooms, about 8 to 12 min, packs of 6 to 8 small foes, a boss that can take 6 min, losses to Burnout. | **5 rooms with one fork** (a hard room or an easy room, for a different reward), **6 to 8 min**. Packs of 3 to 5 big foes built from jobs. Level-ups give **Sparks**. After the door guard you pick **1 of 2 Relics**. The boss takes 60 to 90 s, with a visible enrage at 90 s instead of Burnout. You carry embers home whether you win or lose, and the end screen shows a mastery card. |
| **Daily** | Daily bounty on an open-arena survivors-style map. | **Quick Delve**: one seed for everyone that day, about 4 min, two fights and a boss in a normal Halls map, with a daily leaderboard. The median phone session is 5 to 6 min ([GameAnalytics via GameDevReports](https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks)). |
| **Weekly** | Weekly quests, first-win bonus, season marks: separate chips. | **One Weekly Cache** on the Notice Board, filled by **wins only**. 1 win opens one reward choice, 3 wins two, 6 wins three, and you pick one. The week's Omens rotate. Nothing like "play Lumen 3 times". Hearthstone's slower quests made casual players play less ([MMOBomb](https://mmobomb.com/news/progression-changes-aimed-getting-players-to-play-more-did-exact-opposite-so-hearthstone-new-progression-updates-inbound)). |
| **Season** (6 weeks) | On from day one, a track with glows and titles. | **Off at launch.** Season 1 starts about 6 weeks after launch and brings a new toy, never a nerf: the Hoard raid, 2 new Omens, about 6 Heirlooms, a fresh Keys leaderboard, and the world boss as the finale weekend. Diablo IV's first season came too soon and took power away, and players punished it ([Windows Central](https://www.windowscentral.com/gaming/diablo-4-having-its-first-season-so-soon-after-launch-was-a-mistake)). |

**The unlock curve** (written down for the first time; a new system needs a slot here):

| When | What unlocks |
|---|---|
| Minutes 0 to 5 | Move, flick-dodge, Flame Wave, Quench, Sparks, the Kiln Mother, the Forge. |
| Hour 1 | Kiln tiers 1 to 3, Duskblade, the first Relic, the first Blueprint, the Notice Board (Quick Delve). The free part ends at the **Court's First Seal**, the Foundry door (section 8). |
| Hours 2 to 5 | Talent tree, the other 3 classes, the Foundry and Glarewell, Omens from tier 3, the Weekly Cache, the Journal. |
| Hours 5 to 20 | Coldmarrow, Wrackline, the Hammerdeep with bots or friends, Heirlooms, tiers up to 10. |
| Hour 20 and on | Delver's Keys (the endgame ladder), Key leaderboards, seasons. |

**Meta systems: what we keep, merge or cut.**

| System today | Ruling |
|---|---|
| In-run draft ("Choose a talent") | **Keep and rename** to Sparks. About 20 per class, 8 of which change behaviour, plus 2 Fusions per class. |
| Permanent talent tree, ability options at 8/12/16 | **Keep.** The best option for most players gets a "recommended" tag. |
| Loot: 6 slots, 6 rarities, exponential odds | **Keep** Steve's ladder and odds. Common to Rare are plain gear with hand-written names per place. Epic and above become **Heirlooms** (below). |
| Mythics, class weapon effects, verb sets | **Merge** into about 40 hand-written **Heirlooms**, named rule-changers tied to a place. A duplicate **tempers** an Heirloom one rank, up to rank 3. |
| Forge (embers upgrade gear) | **Keep** as the single currency sink. It raises the item level of plain gear and Heirlooms. Embers are the **only** currency. |
| Potions / alchemy slot, in-run quests | **Cut.** The Relic takes their place. |
| Collection book (60), Achievements (19), Seen bestiary (25) | **Merge** into one **Journal**: where each Heirloom drops, foes met, titles earned. Hidden until hour 2. |
| Daily bounty (open-arena map) | **Rework** into Quick Delve (a Halls map, same seed for everyone). |
| Weekly quests, first-win bonus, season marks | **Merge** into the Weekly Cache. |
| Tiers 1 to 15 | **Cut to 1 to 10.** From tier 3, each tier adds a rule (an Omen or a new behaviour), and number growth per tier is halved. |
| Delver's Keys | **Keep** as the one endgame ladder past tier 10, with a par time, a key that climbs or drops, an Omen added every 2 levels, and a season score. |
| Omens (6 today, omens.ts) | **Keep, grow to 8** by launch, plus 2 each season. |
| Seasons | **Off at launch**; Season 1 about 6 weeks after. |
| World boss (shared damage) | **Keep the code**, show it as each season's finale weekend from Season 1. Always on, it would be a seventh thing on the hub. |
| Blueprints (new) | **Add.** Bosses and named elites drop them; each permanently adds a Spark, Relic or Fusion to your pool. This is the unlock engine for hours 1 to 20. The first kill of each boss always drops one. |
| Named elites, "the dungeon stirs" events, boss echoes | **Keep** as run variety. Echoes are renamed in the naming pass. |
| Leaderboards | **Keep two:** the daily Quick Delve board and the season Keys board. |
| Kindled Resolve (Systems' proposal) | **Not at launch.** It is a mercy mechanic, not a melee fix. We may add it later as an open accessibility setting. |
| Co-op 1 to 4 with roles, bots, Quick join | **Keep.** Solo is the complete product and co-op is the bonus. Each player drafts their own Sparks. |

---

## 5. Replay value: the sources and how each is built

| Source | What the player feels | How we build it | Research basis |
|---|---|---|---|
| **Sparks and Fusions** | "This run I'm a fire-trail Emberwright." | Data in sim/content per class (emberwright.ts already has this shape). About 40% of cards change behaviour ("Blink leaves a burning trail"). Two named Sparks from different branches unlock a Fusion card. Bots and the event log record pick rate against win rate. | Combining parts is the core replay engine in Balatro, Risk of Rain 2 and Hades ([PC Gamer on RoR2](https://pcgamer.com/risk-of-rain-2-review)) |
| **One Relic per run** | The run gets a theme in its first two minutes. | 1 of 2 picks after the door guard. Each Relic bends a rule and has a cost ("Your Heat never cools, but each Combustion is twice as large"). It replaces the potion slot. About 12 at launch. | Hades' rewards at each door **(judgment from play knowledge)** |
| **Five rule-bending classes** | Each class plays differently in the first 30 seconds. | One signature verb per class (section 6) plus its existing tree. | Brotato's characters are "surprisingly unique to use" ([TouchArcade](https://toucharcade.com/2023/04/04/brotato-iphone-ipad-android-review/)) |
| **Blueprints** | Every boss might widen what you can find. | A drop table on bosses and named elites. The first kill of each boss is guaranteed. Blueprints add to the Spark and Relic pools. | Vampire Survivors and Dead Cells unlock new parts as you play ([The Conversation](https://theconversation.com/vampire-survivors-how-developers-used-gambling-psychology-to-create-a-bafta-winning-game-203613), [PC Gamer](https://pcgamer.com/dead-cells-review)) |
| **The Heirloom chase** | A rare drop still matters at hour 50. | About 40 hand-written Heirlooms, each tied to one place. A duplicate tempers (up to rank 3). The Journal shows where each one drops. Old Mythics and sets convert one to one. | Archero's mid-game drops stop mattering ([Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2019/8/9/why-archero-banked-25m-but-leaves-25m-hanging-hlx9n)) |
| **A ladder of rules** | Each step asks for a new habit, not just more health. | Tiers 1 to 10, with a rule from tier 3, then Delver's Keys (keys.ts already has par time, climbing and Omens). | Slay the Spire's 20 Ascension levels ([Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire)) |
| **The week's Omens** | Your favourite dungeon plays differently this week. | Rotation from the date (as `weekOf` works today), the same for every player. 8 Omens at launch. | Weekly modifiers keep the same dungeons fresh (research-retention 3.10, studied as a pattern only) |
| **Daily Quick Delve** | "Can I beat yesterday's score?" | The seed comes from the date, so no server is needed. The leaderboard uses the Supabase we already run. | Slay the Spire's daily climb ([Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire)) |
| **Visible mastery** | "I dodged 11 of 11 this time." | Mastery card on every end screen: dodges, interrupts, soaks, the blow that killed you, one lesson, and your personal best per dungeon. The sim already knows every telegraph. | Players stay when they can see they're improving (research-retention P7) |
| **Fork rooms** | A small choice of risk on every delve. | One fork per delve, with a hard room for a Blueprint or an easy room for a Spark. | Dead Cells' branching routes ([PC Gamer](https://pcgamer.com/dead-cells-review)) |
| **Co-op with roles** | A dungeon night with friends, or with bots. | It already exists. In a party, each player drafts their own Sparks. | Positioning difference 5 |
| **Steady free updates** | Something new every 6 to 8 weeks. | The content we hold back (the Hoard raid, the Ashvents, the Pressworks and three raids) returns one per season, each with its own foes. | Dead Cells shipped 35 updates over 7 years ([PC Gamer](https://pcgamer.com/games/roguelike/dead-cells-takes-a-bow-with-its-final-major-update-calling-an-end-to-7-years-of-development-that-spanned-35-updates-5-dlc-and-2-studios)) |

**Launch content counts** (a ceiling, not a target; we grow what the data justifies):

| Content | At launch |
|---|---|
| Sparks | 20 per class (100 in total) |
| Fusions | 2 per class (10) |
| Relics | about 12 |
| Heirlooms | about 40 |
| Plain item names | about 4 per slot per place |
| Omens | 8 |
| Boss taunts | about 100 |
| Hearthkeeper lines | about 30 |

Solo runs may sometimes break the game, while co-op and the leaderboards stay balanced. Slay the Spire chose fun over strict balance in single-player ([Game Developer](https://gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder)).

---

## 6. Combat and classes: what changes

**Keep:** room-to-room delves, the virtual stick, four ability buttons unlocked at levels 1 to 4, the automatic basic attack, bosses with telegraphs, threat and roles. Dead Cells and Grimvalor use about the same layout on touch screens and are praised for it ([TouchArcade](https://toucharcade.com/2019/08/28/dead-cells-iphone-review/), [Android Central](https://www.androidcentral.com/grimvalor-beautifully-polished-platformer-you-can-try-out-free-game-week)).

**Change:**

1. **Camera and scale.**
   - The hero stands 70 to 80 px tall, trash at least 40 px, and a boss fills at least a third of the screen width.
   - Edge arrows warn of threats from off screen.
   - The intro banner shrinks to one line above the buttons. Today it covers the fight (13-08-hud.jpg).
2. **The hit-feel kit**, done once in one table (`feel.ts`) and applied everywhere:
   - Every hit gets a white flash of 60 to 80 ms, knockback on normal foes, and damage numbers that are small and never in a signal colour.
   - Big hits get 40 to 90 ms of hit-stop. The exact value is settled in the test scene.
   - Shake can be switched off.
   - The kill burst is clay shards that stay on the floor.
   - Haptics use the existing client/audio/haptics.ts: light when you land a hit, heavy when you take one, a pattern on an interrupt.
   - Vlambeer showed that about 30 small tweaks turn a dull shooter into a satisfying one ([Game Developer](https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games)).
3. **Flick-dodge for every class.**
   - Flick the stick to roll. Telegraphed hits can't touch you for 0.3 s, and the roll recharges in about 3 s.
   - **A dodge button is offered from day one** as a setting. Cold testers decide the default.
   - Bots learn "roll when red" so balance numbers stay honest.
   - Abilities aim at your target with a tap; hold a button to show the area and drag to aim.
4. **Fight budgets as a merge gate.**
   - Trash takes 15 to 30 s, named fights 30 to 45 s, bosses 60 to 90 s, for **every** class at average skill.
   - Boss phases last 20 to 30 s, and each adds one mechanic.
   - The bots already measure fight length, and a PR that pushes any class out of budget does not merge.
   - We close the class gap (Slagbinder 581 s against Duskblade 323 s, audit) by tuning the slow kits, not by adding damage everywhere.
5. **A visible enrage replaces Burnout.** At 90 s the boss glows, taunts ("You've stayed too long, little thief") and hits harder every 10 s. You fall to her, and the loss screen names the blow.
6. **Every boss attack has a melee answer.**
   - Each attack has a safe spot within melee reach, or it can be rolled through.
   - Cones and pulls get at least 0.8 s of warning.
   - **The floor:** at average skill, no class wins less than 60% as often as the best class, in any launch dungeon. Today Duskblade and Bulwark win 0 of 40 in Coldmarrow at tier 10 (audit). We re-measure the whole matrix.
7. **One signature verb per class**, felt within 30 seconds:

   | Class | Verb | What it does |
   |---|---|---|
   | Emberwright | **Overheat** | Above 80 Heat your fire does double damage. At 100 you scorch yourself. |
   | Duskblade | **Backstab** | Hits from behind always crit, and a kill resets Rending Dash. |
   | Bulwark | **Parry** | Hold E to raise the shield. Timed on a red tell, it staggers the attacker and refills Resolve. |
   | Lumen | **Light motes** | Your hits drop motes that heal whoever walks over them. |
   | Slagbinder | **Charged shot** | Hold Q to charge, then release to pierce. A charged shot shatters a Brittle foe. |

8. **Every F is an interrupt.** The split between interrupts and stuns (classes.ts `kick`) goes, because no player would discover it.
9. **Foes built from 8 jobs**, each with one tell:

   | Job | Tell |
   |---|---|
   | Charger | a red line |
   | Spitter | a slow projectile |
   | Shielder | guards the foes behind it, so you flank it |
   | Caster | a blue cast, interrupt it |
   | Mender | heals others, kill it first |
   | Bomber | a gold ring when it dies, step out |
   | Swarmling | dies in one or two hits |
   | Brute | a slow, heavy slam |

   - Each place re-glazes 4 or 5 jobs and adds **one twist foe** found nowhere else (for example, the Snuffer that dims your coal in Coldmarrow).
   - Packs mix 2 or 3 jobs, like a Shielder in front of a Caster.
   - **No two places share a trash list.** This ends the shared pool in dungeon.ts:211-249.
10. **Shorter delves:** 5 rooms with one fork and short corridors.

---

## 7. Art and sound

**One approach: kiln-lit dioramas.** Each room is a small hand-built diorama floating in black, lit only by fire. The Court's creatures are fired clay that cracks and shatters. Wick's heroes are painted iron figurines.

**How it's made:** chunky, flat-shaded, low-poly 3D built from simple shapes in code, with a 3-step toon shading ramp and a dark outline. There are no textures, no pixel art and no image generators. Thronefall's two non-artist developers shipped a coherent look with "a very limited color palette combined with simple 3D models" plus outlines ([Game Developer](https://gamedeveloper.com/design/mastering-minimalism-and-layering-complexity-with-strategy-game-thronefall)). Agents build geometry and numbers far better than they draw. One kit gives us the shatter, the lighting, and rendered hub art and icons.

**The readability rule:** *if it glows flat, it matters.* The world is lit and muted. The only bright, unlit colours are gameplay signals:

| Signal | Colour | Shape |
|---|---|---|
| Danger | #FF2D6F | a jagged, crawling edge |
| Stand here | #FFD34D | a ring with chevrons |
| Interrupt | #59C7FF | a cracked ring |
| Ally | #5DFF8A | |

The shapes mean colour-blind players can read every signal. Steve's green-good, red-bad rule holds. Dead Cells keeps "high-contrast enemies and projectiles" so threats stand out ([Game Developer](https://gamedeveloper.com/production/art-design-deep-dive-giving-back-colors-to-cryptic-worlds-in-i-dead-cells-i-)).

**The spec, in brief:**
- **Palette:** one 24-colour master palette in `style.ts`, and a unit test fails any colour outside it. Each place adds two accent colours on props and glaze, never a full-screen wash.
- **Camera:** pitched about 55 degrees with a 30-degree field of view.
- **Heroes:** rounded and upright, each with one feature you can tell from its silhouette alone: the Emberwright's tall hood and lantern staff, the Duskblade's crescent cowl, the Bulwark's door-sized shield, the Lumen's lamp-halo, the Slagbinder's lopsided shoulder cannon.
- **Foes:** angular hollow pottery with slit eyes and glowing cracks, one body per job.
- **Bosses:** 3 to 5 times hero size, built from their place's motif. The Kiln Mother is a walking kiln whose door is her mouth.
- **Places:** each gets its own floor (cracked brick, iron grates over water, polished stone, ice, wet planks) and one landmark room.
- **Light:** at most four real lights per room, and blob shadows to save battery.

**Why it won't read as AI slop:**
1. **No generator touches any asset.** Everything is geometry and synthesis in code we can show. In a late-2025 survey, 85% of players felt negative about generative AI in games, and art and music drew the strongest reactions ([Quantic Foundry](https://quanticfoundry.com/2025/12/18/gen-ai/)).
2. **It is consistent by construction:** one palette file, one figure kit, and one material rule (clay against iron). Inconsistency is what gives AI art away, as in the top complaint about *Vapor World*'s AI cutscenes ([PC Gamer](https://www.pcgamer.com/gaming-industry/steam-week-in-review-a-touch-of-ai-is-all-it-takes-to-trigger-backlash-as-a-promising-new-indie-falls-afoul-of-slop-skeptics/)).
3. **It has a point of view that is ours:** the black void, light only from fire, pottery foes that shatter and leave a floor of broken shards. A mock that loses these fails review. A generic look gets accused of AI use even when nothing was generated ([PC Gamer](https://www.pcgamer.com/games/rpg/rpg-dev-pushes-back-against-steam-review-ai-accusations-we-poured-years-of-our-lives-into-this-game-and-only-worked-with-real-human-artists-on-everything)).
4. **Hand-written words** replace generated-sounding names.
5. **Automated checks** stop drift between agents: palette, measured hero height, and a silhouette grid where every foe drawn in black must be tellable apart.

**Sound: five materials matched to the art.**

| Material | Used for |
|---|---|
| Clay | foe hits: a dull knock with a crack, and a tinkling shatter on death |
| Iron | heroes and armour |
| Fire | abilities |
| Water and steam | Quench is a steam hiss, water on fire |
| Glass and bells | loot, pitched higher with rarity |

Each place gets a short echo of its own. One four-note **ember motif** runs through every place's music and through the level-up, loot and victory stings.

**Music: Suno goes before we charge.** Today there are two Suno songs, one for the hub and one for every delve (client/audio/tracks.ts). One song for six places erases their identity, and AI music is our largest "slop" risk (research-market.md, section 2).
1. Build place themes in code with modelled instruments and the ember motif.
2. Steve picks blind between that and Suno.
3. If ours loses, we use human-made CC0 music for the closed test and commission a composer for 8 to 10 short loops at launch. Quotes come first; the cost isn't priced yet.

A paid build never ships Suno.

**What gets redone:**
- All in-world art: heroes, foes, bosses and rooms.
- The camera.
- All sound effects, rebuilt from the five materials.
- All music.
- New front-door art: hub town diorama, title screen, class figurines on turning plinths, item icons rendered from 6 slot shapes, and the app icon (the Kiln Mother's glowing door-mouth).

**What stays:** the warm dark UI kit, with one bundled open-licence serif for headings (the Art Director suggests Alegreya); the action bar; the telegraph logic; the synth engine.

**What gets cut:**
- The 2D look and its 5,000-line sprite set (client/textures.ts). A **low-power 3D mode** (no bloom, lower resolution, fewer lights) replaces it. This needs Steve's approval (section 10).
- The full-screen colour washes, "Hero N" tags and gradient-only cards.

**Estimate (judgment):** about 5 to 7 weeks of agent art work, partly in parallel:
- 1 to 2 weeks for the kit and renderer
- half a day per hero or foe body
- 1 to 2 days per boss
- 1 to 2 days per place

Reviewing screenshots is the hidden cost.

**Fallback:** if the one-room slice loses Steve's blind test, we redraw in 2D pixel art at the new scale with the same palette and signal rules. The low-poly bet is tested before it scales.

---

## 8. Monetization

**Recommendation:** a free download with one **$5.99 unlock**, $3.99 in launch week, **no ads**, and later only cosmetics and paid expansion packs at $1.99 to $3.99.

| | What's included |
|---|---|
| **Free** | The opening, the Kiln at tiers 1 to 3, Emberwright and Duskblade, Quick Delve, and joining a friend's co-op. About 60 to 90 minutes. It ends at the **Court's First Seal** (the Foundry door), shown as a story moment, not a popup. |
| **Unlock ($5.99)** | Every class, place and tier, Delver's Keys, hosting co-op, and every future season's free content. It is tied to the cloud-save account, with a "Restore purchase" button. |
| **Never** | Embers, loot, Forge upgrades, Heirlooms, Blueprints, revives, keys, energy, time skips or loot boxes. |

**Why this model:**
- Free-then-unlock is how Grimvalor sells ("Free w/Ads, $6.99" unlock on Android, £5.99 paid on iOS at 4.8 stars; [Android Central](https://www.androidcentral.com/grimvalor-beautifully-polished-platformer-you-can-try-out-free-game-week), [App Store](https://apps.apple.com/gb/app/grimvalor/id1369179088)).
- Comparable premium games sit between $2.99 and $9.99 (research-market.md, section 3).
- Paid-up-front apps converted store visitors about 10 times worse than free ones in old data, so a free download protects reach ([PocketGamer.biz](https://www.pocketgamer.biz/indie-mavens-are-paid-apps-dead/)).
- Premium mobile releases rose 77% in 2025, and Balatro made $21.3M on mobile ([Pocket Tactics](https://www.pockettactics.com/premium-mobile-games-increase)).
- $1 says "throwaway" and funds nothing **(judgment)**.
- Ads would clash with the premium feel and add SDK and privacy work **(judgment)**.

**Why Emberwright and Duskblade are free and not Bulwark:** they are the two classes the slice polishes first. Bulwark is the class that fails hardest late, and the free classes are the ones people review (Combat's point).

**What must be true before we charge anyone:**
1. **No generative-AI asset ships:** Suno is gone and every name and line is written by hand. Only then may the store page say "One price. No ads. No energy. No generative AI art or music."
2. **Fairness:** every class meets the 60% floor and the fight budgets in every launch dungeon, and no run is lost to a clock.
3. **Phone basics:** pause and resume, solo play offline, cloud save, and 60 fps on a mid-range Android (with a low-power mode for weaker phones). At least 99.5% of sessions are crash-free.
4. **Purchase basics:** the purchase and restore both work in sandbox on both stores, and the privacy labels describe the event log accurately.
5. **Evidence from strangers:** in the closed test (Checkpoint 7), at least 90% finish the tutorial, at least 40% reach the First Seal, at least 40% come back on day 1 and at least 15% on day 7. Of 5 cold testers at Checkpoint 3, most name a fair price of $4.99 or more, and none call it AI-made or cheap.
6. **Store screenshots sell:** a boss telegraph in every shot, taken from the real build. If no screenshot sells, the game isn't ready **(judgment)**.

---

## 9. Roadmap as checkpoints

**How it works.**
- Each checkpoint is playable and measured before the next one scales anything.
- Tasks are sized to be threaded. Owner teams: **design, engineering, classes, visuals, sound, mobile, QA, app-stores**.
- Every PR passes its pillar test (section 2).
- From Checkpoint 2 on, every checkpoint gets **5 cold testers**: new people who record their screen and think aloud, uncoached. Steve plays every checkpoint on his phone, but he can't be a cold tester.
- Durations are **(judgment)**.
- Checkpoints 5 and 6 run in parallel.

### Checkpoint 1: Direction locked (about 1 week)
**Goal:** everyone builds the same game.

| Owner | Task |
|---|---|
| design | Write the world bible (2 pages: the Court, Wick, the trades, the layers) and the voice guide with the banned-word list. |
| design | Rename map for places, bosses, classes, systems, Sparks and Echoes, checked against the naming rules and the no-WoW/no-Azeroth-Survivors list. |
| design | Name shortlist (Horders, Emberthief, Kilnward, Hearthless) with a store-search and trademark check. |
| design | Write the unlock curve (section 4), the fight-budget table and the slice definition (Checkpoint 2) as docs in docs/design. |
| visuals | Write `style.ts`: the 24-colour palette, the signal colours and shapes, and the size targets. Add the palette unit test. |
| engineering | Make the fight-budget and 60%-floor checks a merge gate on the existing bot matrix. Spec the event log (about 12 anonymous events in one Supabase table). |
| QA | Re-run the full average-skill class-by-dungeon matrix on main as the baseline. |
| — | Steve answers the decisions in section 10. |

**Done when:** Steve approves this document and answers the section 10 decisions. The bible, rename map and `style.ts` are merged. The budget gate fails a deliberately slow test PR. The baseline matrix is published.

### Checkpoint 2: One room that looks and feels final (about 2 weeks)
**Goal:** prove the look and the feel on the smallest possible piece before anything scales. This is the single critical path that all four proposals depend on.

| Owner | Task |
|---|---|
| visuals | Figure kit: toon ramp, outline, blob shadow, the "glows flat" signal material. |
| visuals | The Kiln entry room diorama. |
| visuals | Emberwright and Duskblade figurines. |
| visuals | Charger, Caster and Swarmling clay bodies with the shatter. |
| engineering | New camera (55 degrees, 30-degree field of view), edge arrows, one-line banner. |
| engineering | `feel.ts` hit kit with a test scene that records a clip of every hit size. |
| engineering | Event log live. |
| classes | Flick-dodge with a 0.3 s window, plus the dodge-button setting. Bots learn "roll when red". |
| sound | Clay, iron, fire and steam hit sounds. The ember motif sketched. |
| mobile | Haptics wired through haptics.ts on iOS and Android. Frame-rate capture on a mid-range Android. |
| QA | Blind side-by-side capture against today's build. Size and silhouette checks. |

**Done when:**
- Steve picks the new room over today's look in a blind side-by-side.
- The measured hero height is at least 70 px and trash at least 40 px.
- It holds 60 fps on the test Android.
- Every hit flashes and sounds within 50 ms.
- 3 of 5 cold testers play 10 minutes and ask for more.
- Cold testers choose flick or button, and that becomes the default.

If the blind test fails, we try the pixel-art fallback in the same room before going on.

### Checkpoint 3: Vertical slice, the Kiln and the first 15 minutes at final quality (about 3 to 4 weeks)
**Goal:** one whole dungeon and the front door, exactly as it will ship.

| Owner | Task |
|---|---|
| visuals | All Kiln rooms, the landmark (the great kiln door), the Kiln Mother model. |
| visuals | Wick hub diorama with cold and lit buildings. Title screen. Rendered item icons. |
| design | The 5-minute opening (section 1). Kiln Mother remade: 60 to 90 s, phases of 20 to 30 s, melee answers, visible enrage, about 25 taunts. Kiln foes from jobs. 5-room Halls with one fork. |
| design | Hand-written Kiln items. |
| classes | Sparks for Emberwright and Duskblade (20 each, 8 that change behaviour, 2 Fusions). Overheat and Backstab verbs. |
| engineering | End screen with the mastery card, the blow that killed you, one lesson and a personal best. Embers kept on a loss. |
| engineering | Hub with one Play button and buildings that unlock. Rename "Choose a talent" to "Catch a Spark". Pause and resume mid-delve. |
| sound | Hub and Kiln themes in code with the ember motif. Steve's blind test against Suno. |
| mobile | Title-to-play in 10 seconds or less on a cold start. |
| app-stores | Draft store page and 5 portrait screenshots from this build. |
| QA | 5 cold testers. Bot matrix for both classes on the Kiln. |

**Done when:**
- 4 of 5 cold testers finish the opening without help, and 3 of 5 ask for another run unprompted.
- Each tester can say who they are and why they went down.
- None call it AI-made or cheap, and most name a fair price of $4.99 or more.
- The Kiln Mother falls in 60 to 90 s for both classes at average skill.
- A new player's hub shows Play plus no more than 2 buildings.
- Steve says "I'd pay for this." The music blind test is decided.

### Checkpoint 4: Five classes worth mastering (about 3 to 4 weeks)
**Goal:** every class is distinct, fair and fun on the remade Kiln and Foundry.

| Owner | Task |
|---|---|
| visuals | Bulwark, Lumen and Slagbinder figurines. Class plinth renders. |
| classes | Parry, Light motes and Charged shot. Every F an interrupt (remove the `kick` split). |
| classes | Sparks for the remaining three classes (20 each, 8 behaviour-changing, 2 Fusions each). "Recommended" tags on ability options. |
| design | About 12 Relics replacing potions and in-run quests. Blueprints on bosses and elites. Trade names for bots. |
| engineering | Relic pick after the door guard. Blueprint pools. Spark and Relic pick-rate and win-rate logging. |
| sound | A cast and impact set for each class from the five materials. |
| QA | Full class matrix on the Kiln and Foundry. 5 cold testers. |

**Done when:**
- Every class kills the Kiln Mother in 60 to 90 s at average skill.
- The 60% floor holds in the Kiln and the Foundry.
- No single Spark appears in more than 40% of winning builds.
- 3 of 5 cold testers name their class's verb unprompted.

### Checkpoint 5: Every launch place feels like a place (about 6 to 8 weeks, parallel with 6)
**Goal:** the Drowned Foundry, Glarewell, Coldmarrow, Wrackline and the Hammerdeep at Kiln quality.

| Owner | Task |
|---|---|
| visuals | For each place: its own floor, landmark room, 4 or 5 re-glazed job bodies, a twist foe and the boss model. Hub card renders. |
| design | For each place: foe roster and packs (2 or 3 jobs each), boss passed through the budget and melee-answer rules, about 15 taunts, hand-written items and Heirlooms. Tiers 1 to 10 with a rule from tier 3. 8 Omens. Keys past tier 10. |
| sound | For each place: a theme in code with the ember motif, an echo, and twist-foe sounds. |
| engineering | Delete the 2D sprite set (client/textures.ts) and add the low-power 3D mode. Hold back the Ashvents, the Pressworks and the four raids behind a content flag for later seasons; it ships nothing hidden to players. |
| mobile | 60 fps on the mid-range Android in the heaviest room of every place. The low-power mode is tested on a cheap phone. |
| QA | Matrix across all six places. Palette, size and silhouette checks. |

**Done when:**
- No two places share a trash list.
- The 60% floor and the fight budgets hold in every place and every tier band.
- Every automated art check is green.
- The old sprite code is gone.
- A cold tester can name each place from one screenshot.

### Checkpoint 6: The whole game loop (about 4 weeks, parallel with 5)
**Goal:** hours 1 to 20 hand the player from one system to the next.

| Owner | Task |
|---|---|
| design | Hand-name every item (about 4 per slot per place) and about 40 Heirlooms with flavour lines. About 30 Hearthkeeper lines. |
| engineering | Heirlooms with tempering. Save converter for old items, Mythics and sets, with tests. The Journal, merging the Collection, Seen and Achievements. Weekly Cache. Quick Delve on a Halls seed with a daily leaderboard. The unlock curve wired to the town buildings. Remove potions, in-run quests, tiers 11 to 15 and the season track at launch. |
| visuals | Lit and cold states for the Forge, Notice Board and Journal hall. |
| sound | Loot bells by rarity. Stings for level-up, Blueprint and victory. |
| QA | A fresh-save run to hour 5 by a cold tester. A save migration test on real old saves. |

**Done when:**
- A fresh save reaches hour 5 and the hub never shows more than Play plus 2 new items at a time.
- Every old save loads with nothing lost.
- The loss screen is never empty.
- A Quick Delve takes 3 to 5 minutes.

### Checkpoint 7: Closed test, feature-complete with the real purchase (about 3 weeks of build, then at least 14 days of test)
**Goal:** strangers play the free hour and the unlock on real phones.

| Owner | Task |
|---|---|
| app-stores | Apple Developer Program and Google Play developer accounts (Steve pays). App records, age ratings, privacy labels for the event log. TestFlight build. Play closed test with at least 12 testers for 14 days, which new personal Play accounts require before production ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465)). |
| engineering | The $5.99 unlock with restore, tied to the cloud account, in sandbox on both stores. The Court's First Seal screen. A weekly one-page report from the event log. |
| mobile | Offline solo play. App-switch and phone-call resume. Low-power mode. Battery check over a 30-minute session. Native-feeling shell with no dead links. |
| sound | Final music: either our code score or human CC0 loops while composer quotes come in. |
| QA | 20 to 50 testers. Crash reporting. Accessibility pass (shake off, colour-blind shapes, text size). |

**Done when:**
- At least 90% finish the tutorial and at least 40% reach the First Seal.
- At least 40% come back on day 1 and at least 15% on day 7. These sit above the top-quartile benchmarks of about 27% and 7 to 8% ([GameAnalytics via GameDevReports](https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks)), because friendly testers flatter the numbers.
- At least 99.5% of sessions are crash-free.
- Purchase and restore pass on both stores.
- No class wins less than 60% as often as the best class, using human data.

### Checkpoint 8: Soft launch, real strangers and the real price (4 to 6 weeks)
**Goal:** find out whether strangers rate it, keep playing and pay.

| Owner | Task |
|---|---|
| app-stores | Release at $5.99 in 1 or 2 small English-speaking countries, with no marketing. Final store page with the 15-second clip of an interrupt and a gold soak. |
| design and engineering | Weekly balance patches from the event log (dead Sparks, runaway combos, top causes of death). Fix the top 3 review complaints. |
| QA | Watch reviews, crashes and the funnel every week. |

**Done when:**
- The store rating is at least 4.5.
- At least 30% return on day 1 and at least 10% on day 7.
- At least 5% of tutorial finishers buy the unlock.
- The top three complaints are fixed.

If a gate fails, we fix the weakest funnel step and test again. We don't add content. All thresholds are **(judgment)**.

### Checkpoint 9 (final): Worldwide store launch
**Goal:** launch on the App Store and Google Play everywhere.

| Owner | Task |
|---|---|
| app-stores | Worldwide release at $3.99 for launch week, then $5.99. Press kit and short boss clips Steve can post. Composer credit if one was commissioned. |
| engineering, mobile and QA | Launch-week watch: crashes, purchase and restore, server load on the leaderboards. |
| design | Season 1 built from a template: the Hoard raid with bots, 2 Omens, about 6 Heirlooms, the world-boss finale weekend. It ships about 6 weeks after launch. |

**Done when:**
- The game is live in both stores.
- The rating holds at 4.5 or above after 30 days.
- Season 1 ships on schedule and nothing in it is a nerf.

---

## 10. Decisions that need Steve

1. **Retire the 2D look and commit to the kiln-lit low-poly redo.** This reverses your earlier "3D baseline with 2D fallback" call.
   - **My recommendation: yes.** Keeping two art sets doubles every art task forever. A low-power 3D mode covers weak phones.
   - The redo is gated: nothing beyond one room is converted until you pick the new look blind against today's build (Checkpoint 2). If it loses, we fall back to bigger hand-drawn pixel art.
2. **Replace the Suno music before we charge.**
   - **My recommendation: yes.** You choose blind between a score built in code and the Suno tracks. If ours loses, we use human-made CC0 music for the test and budget for a human composer at launch (8 to 10 loops; we bring quotes).
   - Music is among the most disliked uses of generative AI (85% negative overall; [Quantic Foundry](https://quanticfoundry.com/2025/12/18/gen-ai/)). Steam would also require us to disclose it ([VGC](https://www.videogameschronicle.com/news/valve-has-significantly-rewritten-steams-rules-for-how-developers-much-disclose-ai-use)).
3. **The name.**
   - **My recommendation: rename to *Emberthief*** if the trademark and store check is clean, with *Kilnward* as the backup. In a store, "Horders" reads as a misspelling of "Hoarders", and "hordes" suggests swarms, the opposite of what sets us apart.
   - Decide by the end of Checkpoint 2, after hearing which fantasy cold testers repeat back, and before any store asset exists. If you keep "Horders", the world still works: the Court are the hoarders.
4. **Launch scope: six places, tiers 1 to 10 plus Keys.**
   - **My recommendation: yes.** Ship the five solo dungeons plus the Hammerdeep.
   - The Hoard raid becomes Season 1's headline. The Ashvents, the Pressworks and the other three raids return one per season once each has its own foes.
   - Nothing is deleted. It is held back until it's distinct.
5. **Price: free download, one $5.99 unlock, $3.99 in launch week, no ads, never sell power.**
   - **My recommendation: yes**, not $1. At launch time you also pay for the Apple Developer Program ($99 a year) and a Google Play developer account ($25 once); please check current prices when you sign up ([Apple](https://developer.apple.com/programs/), [Google](https://support.google.com/googleplay/android-developer/answer/6112435)).

---

## 11. Where the team disagreed, and how I ruled

| Disagreement | Positions | Ruling |
|---|---|---|
| **The hook sentence** | Product: "Real boss fights in ten minutes." Creative: a fire-thief fantasy. | **Fantasy first, proof second.** Product itself adopted this in the debate. |
| **Launch scope** | Systems 8 places, Creative 7 (with the Hoard raid on bots), Product 6, Combat and Art 6 or 7. | **6 places.** The Hoard raid is Season 1's finale. Each place costs about a week of art, a four-player raid risks empty lobbies (research-retention anti-pattern 11), and a season needs a new toy. |
| **Tiers** | Combat 1 to 15 with rules after 6. Systems and Creative 1 to 10 then Keys. | **1 to 10, then Delver's Keys.** One ladder, one progress bar, rules from tier 3. |
| **What comes first: loop or look** | Systems built Sparks and Relics first, on today's 30 px heroes. Combat, Art and Product put feel and camera first. | **One merged slice, feel and look first** (Checkpoint 2). Sparks are tuned on the real fight right after. Juice is "likely the best value for effort" (research-retention P9). |
| **Four separate first slices** | Each team defined its own Kiln room. | **One shared slice** with one definition (Checkpoint 2). Building them in sequence would cost about 6 weeks. |
| **Systems content load** | Systems wanted about 150 Sparks, 60 Heirlooms, 20 Fusions and 12 Omens; Creative wanted 120 items and 300 lines. | **Launch ceiling:** 20 Sparks per class, 2 Fusions per class, about 12 Relics, about 40 Heirlooms, 8 Omens, about 130 lines. We grow from logged pick and win rates. |
| **Relics and Blueprints now or later** | Creative: hold them; there are too many new words. Product and Combat: ship Relics. | **Ship both.** Relics replace potions and in-run quests, so the word count doesn't grow. Blueprints replace "No loot this time". Each arrives at its own slot on the unlock curve. |
| **What a loss pays** | Creative: keep your embers. Systems: Blueprint shards. | **Keep your embers.** It is the fantasy (you carry fire home), uses the currency we already have, and adds no new word. Blueprints drop from bosses and elites, never as shards. |
| **Hub: town or "Today" card** | Creative: a relit town. Product and Systems: one card. | **Both, in that order.** The town is the backdrop behind one Play button, and the Notice Board building *is* the card. Buildings light at milestones, never by spending embers or waiting on timers (Art's scope limit: one fixed diorama, no walking). |
| **Weekly system** | Systems: a Cache filled by wins. Product: 3 tasks a week. | **The Cache, filled by wins only.** No task pulls you off your class. |
| **World boss** | Product: keep it always on (it sets us apart). Systems: a season-finale weekend. | **Season finale, from Season 1.** At launch the shared element is the daily seed and its leaderboard. |
| **Melee fix** | Systems: Kindled Resolve. Combat: melee answers on every boss attack, plus the 60% floor. | **Combat's rule.** Kindled Resolve may come later as an open accessibility setting, never as the fix. |
| **Flick-dodge or button** | Combat: flick, with a button as fallback. Product: a button from day one. | **Both from day one.** Cold testers at Checkpoint 2 pick the default. |
| **Which melee class is free** | Product: Bulwark. Combat: not until it passes the floor. | **Duskblade.** It is polished in the slice. Bulwark joins with the unlock. |
| **Delve length** | Systems 8 to 10 min, Product 10, Combat 6 to 8. | **6 to 8 min (5 rooms), plus a 4-minute Quick Delve.** The median phone session is 5 to 6 min. |
| **Pixel art or low-poly** | The retention report leaned to pixel art (P10). Art, Market, Creative and Product chose low-poly. | **Low-poly**, because P10 compares hand-made with AI-made, not pixels with polygons, and agents build geometry better than drawings. **Pixel art is the tested fallback** if the blind test fails. |
| **When to rename** | Creative and Product: before store assets. Systems: after the slice. | **Decide at the end of Checkpoint 2:** after cold testers repeat the fantasy, before any store asset. |
| **Store claim wording** | Product: "Every sprite and sound hand-built." Art: "No generative AI art or music." | **Art's wording,** and only once Suno is gone. "Sprite" is wrong for a 3D game. |
| **Hit-stop length** | Art 40 to 60 ms, Combat 40 to 90 ms. | **Settled in the Checkpoint 2 test scene** on Steve's phone. |
| **How we know it works** | Most checkpoints ended with "Steve likes it." Product added analytics and cold testers. | **Both.** The event log goes live in Checkpoint 2, and there are 5 cold testers at every checkpoint. Bots measure fairness, humans measure fun. |

*Sources for Horders' own state: game.md, audit.md, positioning.md, the screenshots 13-01-hub.jpg, 13-08-hud.jpg, 13-09-draft.jpg, 13-11-boss.jpg, 13-06a-tab-hero.jpg and 13-13-end-full.jpg, rooms-sheet-0.png, and the repo at /home/user/horders (sim/content/items.ts, dungeon.ts, omens.ts, keys.ts; client/audio/tracks.ts, haptics.ts).*
