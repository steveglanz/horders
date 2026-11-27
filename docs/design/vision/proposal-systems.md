# Proposal: Replay value and progression

*Systems and Retention Designer, 27 Nov 2026. Claims about other games link to a source. Anything marked **(judgment)** is my opinion.*

## 1. Diagnosis: lots of systems, but they don't pass you from one to the next

Horders already has nearly every system long-lived games use, from drafts and trees to keys, dailies, seasons and a world boss. The trouble is that nothing decides which one matters when:

- **The hub reads as a list of chores.** At tier 6 there are eight chips under the Delve button (Vent Floor, Omens, Potion, Bounty, Key, Weekly, Seen, Season, in 13-01-hub.jpg). The research is clear that the games that last show you one or two things at a time and open features over days ([MobileGamer on Habby](https://mobilegamer.biz/the-design-secrets-powering-habbys-hit-machine/)).
- **Runs don't change enough from one to the next.** The draft cards are mostly number tweaks ("Flame Wave costs 6 less Heat", 13-09-draft.jpg). Balatro, Risk of Rain 2 and Hades all get their replay value from parts that combine in surprising ways, not from +10% ([PC Gamer on RoR2](https://pcgamer.com/risk-of-rain-2-review)).
- **Loot is a stream of stats.** Names are built as prefix + slot ("Titanheart Hauberk", items.ts). Archero's mid-game shows what happens next: new drops stop mattering and chests lose their value ([Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2019/8/9/why-archero-banked-25m-but-leaves-25m-hanging-hlx9n)).
- **A loss pays almost nothing you can see.** "No loot this time" and half an empty screen (13-13-end-full.jpg). Hades was built to "take the pain out of dying" ([Game Developer](https://gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death)).
- **The endgame is mostly bigger numbers.** Each tier adds +22% foe health and +12% damage. There are only 5 Omens (omens.ts), so by tier 10 you've seen three of the five every week. Slay the Spire, Hades and Balatro climb by changing the rules, not the numbers ([Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire)).
- **Nobody has planned hours 1, 5, 20 and 50**, so the systems compete with each other instead of handing the player on.

## 2. Vision

**One sentence (judgment):** *Each delve you build a different hero from sparks you find in the dark. Between delves you choose what to carry home. Every week the Hoard changes its rules.*

That gives us three loops, and each one has a single job:

| Loop | Length | Job | What the player sees |
|---|---|---|---|
| **Run** | 4 min (Quick) or 8 to 10 min (Delve) | Make this run's build unlike the last one | Sparks, one Relic, a boss |
| **Hero** | over days | Make your hero yours, and keep loot exciting | Talent tree, Heirlooms, Blueprints |
| **Week and season** | 7 days and 6 weeks | Give a reason to come back that feels like a gift | One Hoard Cache, the week's Omens, the Descent board |

Everything else is folded into these three or cut. What sets us apart stays central: readable boss fights, interrupts, roles, portrait phone play.

## 3. Seven changes, most important first

### 1. Turn the draft into Sparks that change behaviour, and make pairs combine
- Rename the in-run pick to **Sparks**. "Talents" then means only the permanent tree.
- About 40% of each class's Spark pool should change *how you play*, not a number. For example: "Blink leaves a burning trail", "Rending Dash ricochets to a second foe", "your Quench also taunts". Keep the plain stat cards as filler.
- Add **Fusions**: when two named Sparks from different branches are both in your build, the next draft offers a Fusion card that combines them. Hades does this with duo boons (play knowledge). I'd start with 4 Fusions per class, 20 in total.
- Let a solo run occasionally break the game. Slay the Spire's team chose fun over strict balance in single-player ([Game Developer](https://gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder)).

*Buildable:* Sparks are data in sim/content (emberwright.ts already has this shape), and bot playtests log each Spark's pick and win rate.

### 2. One Relic per run, from the door guard or a named elite
After the door guard, or after a named elite if you find one, you pick **1 of 2 Relics**. A Relic is a run-only rule-bender with a cost, such as "Your Heat never cools, but each Combustion is twice as large." It gives each run a theme in its first two minutes. It also absorbs the potion slot and the in-run quests (quests.ts). **(judgment)**

### 3. Loot: fewer drops, each with a name and a purpose
- Keep Steve's six-step rarity ladder and exponential drop odds (his 26 Nov call). Change what the top of the ladder *means*:
  - **Common to Rare** are plain gear with a short, handwritten name per dungeon (about 4 per slot per place, no random prefixes). This is where item level and power come from.
  - **Epic and above are Heirlooms**: around 60 handwritten pieces, each one a named rule-changer with a line of flavour tied to its dungeon. The current Mythics, weapon effects and 12 verb sets become Heirlooms.
- **Duplicates temper.** A second copy of an Heirloom you own upgrades it one step (up to 5) instead of being salvaged. That replaces the Forge's stat upgrades, so a rare drop always matters, even at hour 50.
- **The Heirloom Book** replaces the Collection book, Achievements and the "Seen" bestiary. It becomes the long chase: each page shows where a piece drops, and finishing a dungeon's page earns that dungeon's title.
- **Never sell any of this.** Diablo Immortal's pay-for-power earned the lowest user score in Metacritic history ([VGC](https://www.videogameschronicle.com/news/diablo-immortal-now-has-the-lowest-user-score-in-metacritic-history)).

### 4. Every run moves you forward: Blueprints, mastery and a fair loss
- **Blueprints.** Bosses and named elites can drop a Blueprint that permanently adds a new Spark, Relic or Fusion to the pool. This is the unlock engine for hours 1 to 20. Vampire Survivors and Dead Cells work this way ([The Conversation](https://theconversation.com/vampire-survivors-how-developers-used-gambling-psychology-to-create-a-bafta-winning-game-203613), [PC Gamer](https://pcgamer.com/dead-cells-review)). A loss always gives Blueprint progress (shards), so it is never empty.
- **The mastery card.** The end screen fills its empty half with "You dodged 9 of 11 slams, Quenched 3 of 4 casts, and lost to Burnout", one tip and your personal best.
- **Kindled Resolve (optional).** After each loss on the same boss, you take 2% less damage there, up to 10%, shown openly. Hades' God Mode works like this ([Vice](https://www.vice.com/en/article/how-hades-made-a-genre-known-for-being-impossibly-hard-accessible)). It helps the average-skill melee players our playtest shows failing in later dungeons (average.md).

### 5. The Descent: one endgame ladder made of rules
- Shorten the **tiers to 1 to 10** (the "campaign"). Every tier from 3 up adds a rule (an Omen) rather than mostly numbers, and the per-tier number growth is halved.
- Past tier 10, **Delver's Keys become the Descent**, the single endgame. It keeps the par time, the key that climbs or drops and the Omen added every two levels (keys.ts already has all of this). It adds a **season score**: the sum of your best key in each solo dungeon, shown on a season leaderboard.
- **Grow the Omens from 5 to 12** by launch, and add 2 new ones each season.

### 6. One weekly Hoard Cache in place of five calendar systems
- Merge the daily bounty, weekly quests, first-win bonus and season marks into a single **Hoard Cache** that fills from normal wins. 1 win opens one reward choice, 3 wins two, and 6 wins three. You pick one (often an Heirloom or Blueprint). The cap rewards showing up, not grinding. Hearthstone's slower quests made casual players play *less* ([MMOBomb](https://mmobomb.com/news/progression-changes-aimed-getting-players-to-play-more-did-exact-opposite-so-hearthstone-new-progression-updates-inbound)).
- The **daily bounty stays as "Quick Delve"**: one seed for everyone that day, about 4 minutes, two fights and a boss. That fits the 5 to 6 minute median phone session ([GameAnalytics via GameDevReports](https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks)). It counts toward the Cache like any other win.
- **The hub shows one Play button and one "This week" card** (Omens, Cache progress, the featured dungeon). Nothing else until it's unlocked.
- **Seasons (6 weeks) bring a new toy**, never a nerf: 2 new Omens, a featured dungeon, about 6 new Heirlooms and Blueprints, and a fresh Descent board. Diablo IV's first season lost players by taking power away ([Windows Central](https://www.windowscentral.com/gaming/diablo-4-having-its-first-season-so-soon-after-launch-was-a-mistake)).

### 7. A written unlock curve, with co-op scoped to launch
- **Hour 1:** the Kiln, 1 class, Sparks, the first Relic, the first Blueprint. **Hour 2 to 5:** a second dungeon, the tree opens, Quick Delve, the Cache. **Hour 5 to 20:** all classes and solo dungeons, Heirlooms, group dungeons with bots. **Hour 20+:** the Descent, seasons, raids.
- **Co-op and roles stay, because they set us apart.** In a party, each player drafts their own Sparks. At the boss door the party votes on one shared **Party Relic** (pick 1 of 2). Bots keep filling any role. **(judgment)**
- **Launch with 8 places, not 12:** the 5 solo dungeons, 2 group dungeons and 1 raid. Hold back 1 group dungeon and 3 raids, finish their own trash, and ship one each season. A fixed rhythm works: Path of Exile's scheduled leagues each lift its player count ([PC Gamer](https://www.pcgamer.com/uk/the-making-of-path-of-exile)).

## 4. What to cut or fold in

| Today | What happens |
|---|---|
| "Choose a talent" draft | Renamed Sparks (change 1) |
| Potions / alchemy slot, in-run quests | Cut; Relics take their place |
| Forge stat upgrades | Cut; duplicates temper Heirlooms |
| Mythics, weapon effects, verb sets | Merged into ~60 Heirlooms |
| Collection book, Achievements, Seen bestiary | Merged into the Heirloom Book |
| Weekly quests, first-win bonus, separate season marks | Merged into the Hoard Cache |
| Tiers 11 to 15 | Cut; the Descent covers them |
| Always-on world boss | Becomes a season-finale weekend event |
| Vent Floor and other hub chips | Hidden until unlocked, then shown in the "This week" card |
| Prefix + slot item names | Replaced with handwritten names |
| 3 raids and 1 group dungeon at launch | Held back for season updates |

## 5. Risks

- **Fusions and Relics break co-op balance or the leaderboards.** Solo play is allowed to break. The Descent board uses its own capped rules, and bots log every pick. Dead Sparks and runaway combos get patched every week.
- **Save migration.** Old items convert to item level plus the nearest Heirloom, and old Mythics map one to one. A converter in sim/hero.ts, with tests.
- **Writing 60 Heirlooms and about 150 Sparks reads as generated.** Each piece gets a writer pass against the setting bible, with a rule against random prefixes. Better 60 good ones than 300 thin ones.
- **Cutting things Steve asked for** (the world boss, tiers 11 to 15). Rarity and drop odds stay as he set them. The world boss changes form but isn't deleted. Steve decides.
- **Too much at once.** Each checkpoint below is playable and measured before the next starts.

## 6. Three checkpoints

**C1: "One more run" (Kiln only, Emberwright and Duskblade).**
- Sparks with 4 Fusions each, Relics, the mastery card, Blueprint shards on a loss, Kindled Resolve, and a hub with one button.
- *Pass:* the bot sim shows that no single Spark is in more than 40% of winning builds. Steve plays 5 runs in a row and says they felt different.

**C2: "The first five hours."**
- All 5 classes on Sparks, Heirlooms and tempering, the Heirloom Book, tiers 1 to 10 with rule steps, Quick Delve, the Hoard Cache, and the unlock curve.
- *Pass:* a fresh-save playtest reaches hour 5, and the hub never shows more than the Play button plus 2 other items at once. Average-skill win rates for every class sit within 15 points of each other in every solo dungeon.

**C3: "A year of reasons."**
- The Descent with its score and board, 12 Omens, the Party Relic in co-op, a season content template (2 Omens, 6 Heirlooms, one held-back place), and the world boss as a finale event.
- *Pass:* season 2's content is built from the template in under a week by agents, and nothing shipped needs a nerf to make room for it.
