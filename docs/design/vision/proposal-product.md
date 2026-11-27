# Horders: product and business proposal

*Mobile Product Lead, 27 Nov 2026. Sources are linked. Lines marked **(judgment)** are my own opinion, not a fact from a source.*

## 1. Diagnosis

Horders has more systems than most finished games. The problem isn't missing features. Three things stand between the game and a paying player:

1. **Nobody can say what it is in one sentence.** There's no title screen, no world and no "who am I" moment. The first screen is a delve picker with nine chips under it (13-01-hub.jpg). Names grew one feature at a time, and gear names come from a template (sim/content/items.ts:107-132), which is the pattern players call AI slop.
2. **The first hour doesn't sell the game.** Heroes are about 30 px tall and the hounds are a few pixels (13-08-hud.jpg). A loss shows "No loot this time" over a half-empty screen (13-13-end-full.jpg). A new player sees only the Kiln for tiers 1 to 3, even though the hub shows twelve dots.
3. **We have no way to know if anyone likes it.** The repo has no analytics or event logging and no purchase code. All our evidence comes from bots (average.md) and screenshots.

The games that last are simple, readable and fair, with one look and one price, and none sells power (research-market.md). Horders has to get smaller and sharper before it gets bigger.

## 2. Vision

**One sentence for the store (draft):** *"Real boss fights in ten minutes. Portrait, two thumbs, one price."*

**Target player (judgment):** an adult who played an online RPG for years, misses dungeon nights, and now has a phone and 10 spare minutes, not 3 hours. They know what a tank and an interrupt are. They don't want auto-fire swarms like Archero, which is built on one stick and automatic shots ([Deconstructor of Fun](https://www.deconstructoroffun.com/blog/2019/8/9/why-archero-banked-25m-but-leaves-25m-hanging-hlx9n)). They distrust free-to-play wallets. A second group is roguelite fans who already pay for games like Brotato and Pocket Rogues.

**Why they'd pay:** no other phone game gives them a readable boss with telegraphs, cast bars and roles, played in portrait, in a single sitting. Balatro's mobile port lost points for having no portrait mode ([148Apps](https://148apps.com/balatro/review)), and the fan WoW-style survivors game asks phone players to turn sideways (positioning.md). Portrait boss fights are our hook. The retention research reaches the same conclusion (research-retention.md, section 5).

**Positioning:** against Archero we press abilities and pay once. Against Soul Knight's 400+ weapons ([App Store](https://apps.apple.com/us/app/soul-knight/id1184159988)) we offer fewer, deeper fights with roles. We share Grimvalor's "first act free, then unlock" model ([Android Central](https://www.androidcentral.com/grimvalor-beautifully-polished-platformer-you-can-try-out-free-game-week)), but our runs replay and support co-op.

## 3. The changes, most important first

### 1. Cut the launch to a game we can polish
Ship 1.0 with **five solo dungeons** (Kiln, Foundry, Glarewell, Coldmarrow, Wrackline), **one group dungeon** (Hammerdeep, with bots or friends), all five classes, and the tier and key ladder. Raids and the other two group dungeons come back as free updates once they have their own foes. Today seven places share one trash pool (dungeon.ts:211-249), and a raid that needs four people risks empty lobbies at launch **(judgment)**. Dead Cells kept players for 7 years with 35 updates and 5 DLCs ([PC Gamer](https://pcgamer.com/games/roguelike/dead-cells-takes-a-bow-with-its-final-major-update-calling-an-end-to-7-years-of-development-that-spanned-35-updates-5-dlc-and-2-studios)). Held-back content becomes our update calendar.

### 2. Rebuild the first hour as the sales funnel
The free first hour is the demo, so every step in it gets designed and measured:

| Step | What happens | Target |
|---|---|---|
| Open | Title screen with the one-line fantasy, one tap to play | Playing within 10 seconds |
| Tutorial Kiln | Already exists (firstdelve.ts). First draft card within 60 seconds | 90% finish it |
| First real delve | The hub shows Play, the hero and one "Today" card, nothing else | 70% start a second run |
| Unlocks | Each system appears on its own with one line and one reward: draft, then tree, forge, daily, Omens, keys | No more than one new system per session |
| Foundry door, about 60 to 90 minutes in | A clear end to the free part, plus the unlock offer | 40% of tutorial finishers reach it |

This follows Habby unlocking features "over multiple days of sessions" ([MobileGamer](https://mobilegamer.biz/the-design-secrets-powering-habbys-hit-machine/)) and avoids Hades II's "tedious" gated opening ([PC Gamer](https://www.pcgamer.com/games/action/hades-2-review)). Targets are **(judgment)**.

### 3. Free to try, one $5.99 unlock, no ads, never sell power
- **Free:** the tutorial, the Kiln at tiers 1 to 3, two classes (Emberwright and Bulwark, one ranged and one melee), the daily bounty, and joining a friend's co-op.
- **One purchase, $5.99:** every class, dungeon and tier, plus keys and hosting co-op. A launch-week price of $3.99.
- **Later:** cosmetic packs and paid dungeon or class expansions at $1.99 to $3.99. The model is how Vampire Survivors and Brotato sell DLC (research-market.md).
- **Never:** embers, loot, Forge upgrades, revives, keys, energy or loot boxes.

Comparable premium games charge $2.99 to $9.99 ([Grimvalor](https://apps.apple.com/gb/app/grimvalor/id1369179088)). Old developer data put payers under "free to level five, then pay" at about 14% ([PocketGamer.biz](https://www.pocketgamer.biz/indie-mavens-are-paid-apps-dead/)), a direction, not a forecast. $1 says "throwaway" and funds nothing **(judgment)**. Tie the unlock to the cloud-save account, with a "restore purchase" button.

### 4. Make losing pay, and show mastery
Every end screen fills its empty half with three things: progress toward the next unlock, one specific lesson ("You stood in red 6 times; the Kiln Mother's slam fills from the outside in"), and a mastery line ("Dodged 9 of 11, interrupted 3 of 4") with a personal best for each dungeon. Hades set out "to take the pain out of dying" ([Game Developer](https://gamedeveloper.com/design/how-supergiant-weaves-narrative-rewards-into-i-hades-i-cycle-of-perpetual-death)). Bosses should also stay under 90 seconds for every class, because a 6-minute loss to "the fight ran too long" (13-13-end-full.jpg) feels like punishment **(judgment)**.

### 5. Settle the "AI slop" question before we charge
- **Replace the Suno music** with music written in code or with human-made CC0 music, then commission a composer at launch if Steve wants to. In one survey, 85% of players felt negative about generative AI in games, and music was among the most disliked uses ([Quantic Foundry](https://quanticfoundry.com/2025/12/18/gen-ai/)).
- **Hand-name every item**, with fewer items, each with a line of flavour.
- **One art direction**, proven in the vertical slice (the art team's call). My requirement: heroes at least 60 to 80 px tall on a 390 px phone, threats readable at a glance.
- **Then say it on the store page:** "One price. No ads. No energy. Every sprite and sound hand-built." Only if fully true.

### 6. One "Today" card and a 3-to-5-minute mode
Replace the nine chips with one card showing today's bounty and this week's three tasks, completed through normal play. The median phone session is 5 to 6 minutes ([GameAnalytics via GameDevReports](https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks)), so the daily bounty becomes the official "one fight" mode, with the same seed for everyone and a leaderboard. Add pause and resume in the middle of a delve, so a phone call never costs a run. Weeklies must feel like gifts. Hearthstone's slower quests made casual players play less ([MMOBomb](https://mmobomb.com/news/progression-changes-aimed-getting-players-to-play-more-did-exact-opposite-so-hearthstone-new-progression-updates-inbound)).

### 7. Measure with free tools, every week
- **Event log:** one Supabase table, using the free tier we already run. It records about 12 events under an anonymous ID, with no personal data: app open, each tutorial step, run start and end (class, dungeon, tier, time, result, cause of death), draft pick, the ability option chosen, a system's first appearance, the offer viewed, the purchase, and session length.
- **Weekly report:** a Claude agent turns the log into one page: funnel, day 1 and day 7 return, win rate by class and dungeon, draft pick rate against win rate, top causes of death. Slay the Spire balanced this way ([Game Developer](https://gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder)).
- **Human playtests:** 5 new people per checkpoint record their screen and talk aloud, uncoached, then answer: what is this game, what confused you, would you play tomorrow, would you pay $5.99?
- **Bots stay as the balance floor** (average.md): humans tell us about fun, bots about fairness. The event log needs privacy disclosures in both stores.

### 8. Write the store page early
Portrait screenshots with a boss telegraph in every shot, and a 15-second clip of an interrupt and a gold-circle soak. Write it at the vertical slice, not at the end: if no screenshot sells, the game isn't ready **(judgment)**.

## 4. What to cut or hide for 1.0

- **Cut until each has its own foes:** the raids (Crucible, Hoard, Smeltery, Flue), Ashvents and Pressworks.
- **Merge** the Collection book, the Seen bestiary and Achievements into one Journal, hidden until hour 2.
- **Rename the in-run draft** so that "talent" means only the permanent tree.
- **Seasons off at launch.** Season 1 starts about 4 to 6 weeks after launch, once there is a new toy to add. Diablo IV's first season came too soon and arrived with nerfs, and players punished it ([Windows Central](https://www.windowscentral.com/gaming/diablo-4-having-its-first-season-so-soon-after-launch-was-a-mistake)).
- **World boss:** keep it, because it is a real point of difference, but show it after the first unlock, not on the first loss screen.
- **Hide the potion, Vent Floor and Omen chips** until the systems are introduced. Omens start at tier 3, as they do today.
- **Off the table:** the $1 price, ads and a two-version (free and paid) release.

## 5. Risks

1. **A paid unlock gets fewer downloads.** Paid apps converted store visitors about 10 times worse than free ones in old data ([PocketGamer.biz](https://www.pocketgamer.biz/indie-mavens-are-paid-apps-dead/)). A free download helps, but with no marketing budget, reach is the biggest business risk. To reduce it: the daily-seed leaderboard, free players joining co-op, and short boss clips Steve can post.
2. **Scope creep and the art redo.** A new system that serves no first-hour step and none of our six differences waits. The art redo proves itself on one room, one hero, one pack and one boss before scaling.
3. **Store review.** Apple may look hard at a wrapped web app. We need offline play, a native-feeling shell, working restore purchases and no broken links **(judgment)**. Google Play requires new personal developer accounts to run a closed test with at least 12 testers for 14 days before going to production ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/14151465)).
4. **Co-op on mobile networks** can fail, so solo must be the complete product and co-op the bonus.
5. **One owner** answers reviews and support. Keep updates light: one free content update every 6 to 8 weeks **(judgment)**.

## 6. Three checkpoints

### Checkpoint A: vertical slice ("the first 15 minutes are final")
**Contents:** the title screen and one-line fantasy, the tutorial Kiln in the final art direction, one class finished, new music and sound, the new end screen, the "Today" hub, the event log live, and a draft store page.
**Pass if:** 4 of 5 new testers finish the tutorial without help, 3 of 5 ask for another run unprompted, nobody calls it AI-made or "cheap", and Steve says "I'd pay for this."

### Checkpoint B: closed test ("the free hour plus the unlock")
**Contents:** the full free hour, the six launch places reskinned, all five classes, purchase and restore in sandbox, pause and resume, the weekly report. TestFlight and a Play closed test, 20 to 50 testers, at least 14 days.
**Pass if:** at least 90% finish the tutorial, at least 40% reach the Foundry door, at least 40% come back on day 1 and at least 15% on day 7, the app is crash-free for at least 99% of sessions, and no class loses more than twice as often as the best class at average skill. These targets sit above the top-quartile benchmarks of about 27% on day 1 and 7 to 8% on day 7 ([GameAnalytics via GameDevReports](https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks)), because friendly testers flatter the numbers **(judgment)**.

### Checkpoint C: soft launch ("real strangers, real price")
**Contents:** a live release at $5.99 in one or two small English-speaking countries for 4 to 6 weeks, with no marketing.
**Pass if:** a store rating of at least 4.5, at least 30% return on day 1 and at least 10% on day 7, and at least 5% of tutorial finishers buy the unlock. The top three review complaints must be fixed. Then comes the worldwide launch with the $3.99 launch week, followed by Season 1 about 4 to 6 weeks later. All three thresholds are **(judgment)**. If a gate fails, we fix the weakest funnel step and test again rather than add content.

**Bottom line:** make the first hour a finished, honest, hand-made product that sells a $5.99 unlock, and measure it with free tools before we spend anything.
