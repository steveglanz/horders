# Creative Director proposal: the hook and the world

*27 Nov 2026. Sources: our audit, game.md, positioning.md, research-retention.md, research-market.md, the phone screenshots and the 3D room sheet. Anything without a link is my judgment.*

## 1. Diagnosis

Horders has good bones (readable bosses, interrupts, roles, a clean warm UI) but, as Steve said, **it is not about anything.** No file mentions a story (audit: grep finds 0 files), so a player never learns who they are, what the Hoard is, or why embers matter. Every name came from a separate feature, so together they read as a pile of parts.

What I see on the screens:

- **The hub is a control panel, not a place.** Its first screen shows twelve dots, a tier strip and eight chips (Vent Floor, Omens, Potion, Bounty, Key, Weekly, Seen, Season) above the Delve button (13-01-hub.jpg). The cards have no art.
- **The fight is tiny.** Cinderhounds are a few pixels across, and most of the screen is empty floor (13-08-hud.jpg). The room sheet shows one tiled room in five colour washes, with "Hero 2 / Hero 3" tags that read as placeholders (rooms-sheet-0.png).
- **Losing feels like nothing happened.** "No loot this time" and half an empty screen (13-13-end-full.jpg).
- **Generated-sounding names.** Gear is built as "prefix + slot" ("Titanheart Hauberk", items.ts:107-132), which is the pattern players call AI slop.

Our strength is already in the content, scattered: **fire as a thing you carry and lose**: Heat, Quench, Coldmarrow's "keep your coal alight," embers as currency. We also have **a royal family of fire**: Smolderhusk the Kiln Mother, the Furnace Regent, Grandmother Slag, Nhevra the Cold Hearth.

## 2. The vision

**The world.** The surface has gone cold. Long ago the Furnace Court, a family of fire-kings and fire-mothers, pulled every flame in the land down into one mountain-sized furnace, the **Hoard**, and sealed themselves in with it. Above, the last town huddles around one dying hearth. You are a delver from that town. You go down into the Hoard, steal fire from the Court, and carry it home as **embers**.

**The fantasy the player lives: you are a fire thief.** Every room is a raid on someone else's fire. Every ember you carry home lights up something in your town. The tone is **cozy against menacing**: warm hearth above, hungry furnace below. It is dark and a little funny, never grim: the Court are greedy, grand and old.

**One-sentence pitch:** *"Steal fire from a furnace full of greedy kings, one boss at a time, and carry it home to relight your town."*

**Why this fits what we have.** Nearly every existing system gets a meaning it lacks today, without new code:

| Today | In the world |
|---|---|
| Embers (currency) | Stolen fire you carry home |
| Heat, Quench | Fire you hold, and water the Court fears |
| The Kiln Depths | The mouth of the Hoard |
| Drowned Foundry | Where the river broke in and drowned the Court's works |
| Glarewell | The Court's lens-tower, where they watch the cold world |
| Coldmarrow | The bottom, where even the Court's fire died |
| Wrackline | The underground quay where stolen fire was shipped in |
| Bosses, world boss | Members of the Furnace Court; Grandmother Slag is its matriarch |
| The five classes | The five fire trades of the town |

Classes become town trades: **Emberwright** hearth-keeper, **Bulwark** anvil-smith, **Lumen** lamp-bearer, **Duskblade** lamp-snuffer and born thief, **Slagbinder** foundry gunner.

**The name.** I recommend **renaming "Horders."** In a store it reads like a misspelling of "Hoarders," which most people link to a TV show about compulsive hoarding. "Hordes" also suggests swarms, and our positioning is the opposite: "few tough fights, not swarms" (positioning.md). My lead choice is **Emberthief**. It says the fantasy in one word. A quick search found no game with that exact title, but the "Ember" space is crowded: [Ember on Steam](https://store.steampowered.com/app/339580/Ember/), [Emberheart](https://store.steampowered.com/app/1437300/Emberheart%20Demo), [Emberstride](https://rawg.io/games/emberstride). "Hoard" is also taken ([HOARD, 2010](https://store.steampowered.com/app/63000)). Backups: **Kilnward** or **Hearthless**. A proper store and trademark check comes before we commit (checkpoint 1). If Steve keeps "Horders," the world still works: the Court are the hoarders.

## 3. Seven changes, most important first

**1. Write the world bible, then rename everything to fit it.** Two pages: the Court, the town, the five trades, the layers of the Hoard, and one voice guide. Then a full naming pass. Throw out the prefix + slot gear generator. Replace it with about 120 hand-written items (fewer, better), each with a named maker and one line of flavour, e.g. "Bellwarden's Collar: *rang every time she lied.*" Fix the vocabulary clash: the in-run picks become **Sparks** (gone when the run ends), and the permanent tree stays **Talents**. Buildable: writing and data entry, reviewed by one editor against the voice guide.

**2. Make the hub a town that you relight.** Replace the chip panel with one screen: a cold town at night around a guttering hearth. Embers you bring home light buildings, one at a time, and **each building is one system**. The Forge holds gear upgrades. The Still holds potions. The Notice Board holds the bounty and weeklies. The Hall of Echoes holds the bestiary, collection and achievements. The Bell Tower holds the world boss. This shows a new player one system at a time over days, which the research shows works ([MobileGamer on Habby](https://mobilegamer.biz/the-design-secrets-powering-habbys-hit-machine/)), instead of eight chips at once. It also gives a loss somewhere to go (change 4). It is one portrait screen of tappable buildings, buildable in our UI kit.

**3. One look: "fired clay and cast iron, lit by embers."** Stop mixing 2D billboard sprites with 3D floors. Everything in the game becomes chunky, flat-shaded low-poly shapes with outlines, the approach two non-artists used for Thronefall ([Game Developer](https://gamedeveloper.com/design/mastering-minimalism-and-layering-complexity-with-strategy-game-thronefall)). Heroes look like cast-iron figurines. Court creatures look like kiln-fired pottery, cracked and glowing from inside. The scenes are near-black, and **the only strong light is fire**: your hero's ember, braziers, the boss's glow. Each place gets 2 or 3 accent colours from one master palette, not a full colour wash. Bring the camera in so heroes stand about 70 px tall and trash reads as a creature. It is easy to build in code (simple shapes and a toon shader), cohesive by design, and cannot be mistaken for generated art. That matters, because 85% of players in one survey felt negative about generative AI in games ([Quantic Foundry](https://quanticfoundry.com/2025/12/18/gen-ai/)).

**4. Every run brings something home.** Whatever happens, you carry fire up. If you fall, you keep the embers you were carrying (or most of them), the town gets a little brighter, and the bestiary logs what killed you. The loss screen then names one lesson in plain words ("The Kiln Mother's breath pulled you in 3 times: walk away when she inhales"). Hades built its whole loop on making death not a fail state ([Vice](https://www.vice.com/en/article/how-hades-made-a-genre-known-for-being-impossibly-hard-accessible)).

**5. Give the Court a voice.** Hades shows that a world the player hears turns repeated runs into story ([Game Developer](https://gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death)). We can do a small version with no voice acting: each boss gets 10 to 20 short taunts as text bubbles, picked by what happened ("Back again, little thief? You still smell of my kiln."), and the Hearthkeeper in town gets 30 lines that react to your progress. About 300 hand-written text lines.

**6. A first five minutes that sells the game** (detail in section 4). One authored, can't-lose opening that teaches move, dodge, interrupt and the fantasy, and ends with your first ember lighting the town.

**7. Cut the place count to what we can make distinct.** Seven of twelve places share one trash pool, and the Pressworks' list is the Hammerdeep's (dungeon.ts:211-249). Ship 1.0 with the **five solo layers**, **one group dungeon** (the Hammerdeep, the Court's armoury) and **one raid, the Hoard itself**: the Court's vault and the final goal of the whole game. Give each place its own creatures and one landmark room. The other raids return as free updates, which is the cadence that kept Dead Cells alive for years ([PC Gamer](https://pcgamer.com/games/roguelike/dead-cells-takes-a-bow-with-its-final-major-update-calling-an-end-to-7-years-of-development-that-spanned-35-updates-5-dlc-and-2-studios)).

## 4. The first five minutes

- **0:00** Title. A cold, dark town at night. One hearth flickers. The music is a slow anvil beat. The only text is the game's name and "Tap to wake."
- **0:10** The Hearthkeeper, an old woman with the last coal, speaks in two text lines: *"The Court took the fire. Go down and take some back."* No class picker yet: you are an Emberwright. The other trades unlock in town.
- **0:20** You drop into the dark mouth of the Kiln, lit only by your ember, and learn to move.
- **0:40** Three big cinderhounds. Your basic attack fires on its own, and you press Flame Wave. Hits flash and knock back.
- **1:00** First level. You pick your first Spark from three cards, one of which changes how you play, not just your numbers.
- **1:30** A Warden slams the floor and shows a red circle. You learn Blink.
- **2:30** A Warden starts a blue cast. You learn Quench. *"It fears water. Of course it does."*
- **3:15** Smolderhusk, the Kiln Mother, in a short 90-second version that can't be lost. She taunts you and shows one red attack and one interrupt.
- **4:30** She falls. You carry her great ember up; the town hearth roars and the Forge lights. *"Bring more."*
- **5:00** One button: **Delve again**. Nothing else is on screen yet.

## 5. What to cut or rework

- **Cut:** the prefix + slot item names; the eight hub chips (they move into buildings); the "Hero 2/3/4" tags (bots get trade names); the Pressworks, Ashvents and three raids for 1.0 (kept for updates); the 2D billboard sprites in 3D.
- **Rework:** "Choose a talent" becomes "Catch a Spark." The daily bounty becomes a "Court Errand" on the Notice Board. Seasons become "the Court's Feast," a six-week event with one new rule. Omens become "the Court's moods" ("The Regent is restless: foes move faster").
- **Replace the Suno music** with an original score built from anvil, bellows and hearth sounds, made in code like our sound effects or commissioned at launch. The research flags AI music as our highest AI-slop risk (research-market.md, [Quantic Foundry](https://quanticfoundry.com/2025/12/18/gen-ai/)).

## 6. Risks

- **The art change is the biggest job and could stall everything.** To limit that, build one test room before converting the rest (checkpoint 2), as the KILL KNIGHT team did with a visuals-only slice ([Unity](https://unity.com/blog/how-playside-studios-built-kill-knight-visual-identity)).
- **The writing could turn generic.** A voice that is "dark but funny" done badly reads as AI filler. Fix: one editor, a voice guide with banned words, Steve reads the first 50 lines.
- **Renaming has a cost** (store pages, the domain, Steve's attachment to the name). Decide early, before store assets exist.
- **Cutting places may feel like going backwards to Steve.** They return as updates once each has its own creatures.
- **The town meta could become a chore.** Buildings must light from normal play, never from timers or grinding.

## 7. Three checkpoints

1. **World on paper (about 1 week).** A two-page world bible, voice guide, name shortlist with a store and trademark check, and the full rename map (places, bosses, classes, Sparks, about 120 items). Done when Steve can say the one-sentence pitch back and approves the name.
2. **The vertical slice (about 2-3 weeks).** One Kiln room, one hero, one cinderhound pack, the Kiln Mother and the town hub, all in the clay-and-iron look, with the five-minute opening playable end to end on a phone. Done when a cold tester finishes the opening and, unprompted, can say who they are and why they went down.
3. **The cohesive 1.0 core (about 6-8 weeks).** Five solo layers plus the Hammerdeep and the Hoard raid, each with its own creatures and a landmark room. The town with all its buildings, Court taunts, the new loss screen and the new music. Done when every screen passes a "does this belong in the world?" review and a 30-minute cold playtest ends with the tester asking to keep playing.
