# Red team review of the Horders vision (vision.md, 27 Nov 2026)

*Written by an outside producer brought in to attack the plan. I read vision.md, both research reports, game.md, audit.md, positioning.md, the six phone screenshots, the 3D room sheet and parts of the repo (read-only). **(judgment)** marks my own opinion. Claims about other games or the market link to a source.*

## The verdict in plain words

The plan diagnoses the problem well. The audit is honest, the world idea (steal fire from a furnace of greedy kings) ties together systems that already exist, and gating the art redo on one test room is the right instinct. But the plan has five weak spots that could sink it:

1. **It polishes before it proves the fun.** The new verbs, Sparks, Relics, 5-room run and enrage are not tested until Checkpoints 3 and 4, after weeks of final-quality art.
2. **It makes a "made by hand" promise that an all-AI team cannot honestly keep as written.**
3. **It repeats a music test Steve has already answered.**
4. **It has no plan for how strangers will find the game**, so the soft-launch numbers it depends on may never arrive.
5. **It never adds up its own timeline.** The checkpoints add up to about 24 to 31 weeks, roughly six to seven months, before worldwide launch **(judgment, from the plan's own estimates)**.

None of these is fatal. All of them can be fixed by changing the plan, not by building more.

---

## 1. Is the hook actually strong?

**The fantasy is good. The proof is weaker than the plan claims.**

- *"Steal fire from a furnace full of greedy kings"* is a clear sentence a player can repeat. It gives embers, Heat, Quench and Coldmarrow's coal a meaning, and that is the plan's best idea. **(judgment)**
- The plan's uniqueness claim is that "no game in our research has both" portrait-first touch play and boss fights you read. **That is not true of the plan's own research.** Archero is in research-retention.md (section 3.11). It is played with "a single thumb" on a stick ([Pocket Gamer](https://www.pocketgamer.com/archero/how-to-play-archero-the-latest-free-mobile-rogueli)), upright on the phone (from my own play), and has boss fights in "a traditional bullet hell manner" ([Game Developer](https://gamedeveloper.com/design/finding-the-fun-archero-part-1---gameplay)). "Portrait plus bosses" is not a moat. A store reviewer will say "it's like Archero" in the first paragraph. **(judgment)**
- **The real difference is the one the plan plays down:** an MMO-style party in your pocket, with tank, healer and damage roles, interrupts, cast bars and threat (positioning.md, differences 2 and 5). The plan makes solo "the complete product", cuts all four raids from launch, and stops free players from hosting co-op. It keeps the fantasy and drops the proof that only Horders has.
- **The reason given for cutting raids doesn't hold.** The plan cites empty four-player lobbies (research-retention anti-pattern 11). But Horders already has bots that fill parties (game.md: "Bots can fill parties"). The real cost of a raid is art and distinct foes, not lobbies. Say that honestly, and look again at one raid on bots as the goal for hours 10 to 20.
- **The 5-minute opening is good**: one tap, the dodge on red, the interrupt on blue, a boss you can't lose, the town relit. Keep it. Its weak spot is control conflicts (section 4).

## 2. Would people keep playing after a week, or a month?

- **Week 1: probably yes, if the fights feel good.** There's the daily Quick Delve, the Sparks and Relics, Blueprints from first boss kills, and the tiers. That's enough for a week **(judgment)**.
- **Month 1: thin.** By about hour 20 a player has seen all six places. What's left is Delver's Keys, about 40 Heirlooms and 8 Omens that rotate weekly, so the Omens start repeating in week 9. Season 1 is "about 6 weeks after launch". So days 20 to 42 rely on Keys alone. That's acceptable for a $5.99 game: most premium roguelites are a 20 to 50 hour purchase, not a daily habit **(judgment)**. But then the plan should **stop judging itself by free-to-play retention numbers alone**, and add "hours played before the unlock" and "review score" as the main goals.
- **The daily leaderboard will be cheated on day one.** The game logic runs on the player's phone, so anyone can post an impossible score. The plan doesn't mention this. The good news: the game logic is seeded and repeatable (sim/rng.ts, sim/netsync.ts), so the server can replay a run's inputs and check the score.
- **Seasons cost money that a one-time price doesn't bring back.** The unlock promises "every future season's free content". Each season is weeks of agent work (and Claude usage costs) with no new revenue, unless paid expansions ($1.99 to $3.99, section 8) pay for it. Decide now which content is free and which is paid, or the plan has promised an endless free live service for $5.99.

## 3. What's missing

| Missing | Why it matters |
|---|---|
| **Getting players** | The soft launch is "with no marketing" in 1 or 2 small countries. A free mobile game with no featuring and no marketing may get only a few dozen installs. That's too few to test "5% buy" or "10% come back on day 7". The plan's own research says paid games "need featuring or marketing" (research-market section 3, [PocketGamer.biz](https://www.pocketgamer.biz/indie-mavens-are-paid-apps-dead/)). There's no community plan, no clip plan and no budget line. |
| **A web or Steam demo** | The game already runs at horders.netlify.app. A free web or itch.io build with the event log is the cheapest way to get real retention data months before the stores. A Steam page (or a Next Fest demo) is a sales channel the plan never weighs. Steam's AI-disclosure rules make the "no AI music" choice matter even more there ([VGC](https://www.videogameschronicle.com/news/valve-has-significantly-rewritten-steams-rules-for-how-developers-much-disclose-ai-use)). |
| **Animation** | The art section specifies shapes, palette, outlines and lights, but never says how the figures move. Code-built low-poly figures that slide around without wind-ups, recoil or squash will look cheap, however good the still frames are **(judgment)**. "Half a day per body" leaves no time for animation. |
| **Apple's "repackaged website" rule** | The app is a Capacitor (web) shell. Apple's guideline 4.2 says an app should be more than "a repackaged website" ([Apple guidelines via MobiLoud](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)), and web-wrapper apps get rejected under it often ([Apple Developer Forums](https://developer.apple.com/forums/thread/806726)). A real game with offline play, haptics and IAP should pass, but the plan should budget a review round-trip and have offline play ready before the first submission. |
| **Who recruits the testers, and on what phone** | "5 cold testers at every checkpoint" means about 35 new people who have never seen the game, each recording their screen. Agents can't recruit them. The plan's 60 fps gate needs "a mid-range Android", and nobody on the team has one. Steve has to supply both, and the plan never asks him. |
| **The QA tools depend on the 2D view** | The average-player playtest ran in 2D "because 3D runs at about 0.1 sim-s per wall-s here" (qa/playtest/average.md). The plan deletes the 2D sprite set (client/textures.ts) in Checkpoint 5. That breaks the team's browser QA unless a headless or debug renderer replaces it. |
| **Two thumbs in portrait** | Checkpoint 2 lets cold testers choose between flicking the move stick to roll and a dodge button. Flicking the stick you're already moving with will cause rolls by accident **(judgment)**. With 4 abilities, a dodge button and hold-to-aim, the right thumb has 5 targets on a 390 px screen. Test this on day 1 of the fun test, not as a side task. |
| **iPad** | A Capacitor app runs on iPad by default, and the App Store then needs iPad screenshots and a layout that works there. Decide whether to support iPad or turn it off. |

## 4. Is anything unbuildable by an agent team, or too big?

- **Buildable:** the camera, `feel.ts`, the palette test, merging the menus, the Journal, the Weekly Cache, Quick Delve, replay checks, the fight-budget gate, foes built from jobs, and the rename. These are code and data, and agents are strong at them.
- **Buildable but probably under-estimated:** the art. Five to seven weeks covers 5 heroes, roughly 30 job bodies plus 6 twist foes, 6 bosses, 6 places and a hub diorama. That leaves no animation time and assumes screenshot review keeps pace **(judgment)**. Agents also can't judge motion from still screenshots. They need short recorded clips, and someone (Steve or testers) to watch them.
- **Not buildable by agents alone:** cold testers, a test phone, blind judgments, music that beats Suno (see section 5), store accounts, and any marketing. Each needs Steve's time or money. Put them on a list with dates, so Steve sees the cost now and not at Checkpoint 7.
- **Probably wasted work:** the save converter for old items, Mythics and sets (Checkpoint 6). Before launch the game has testers, not customers. Wiping saves once, with a thank-you title for early players, costs a day instead of a week **(judgment)**.
- **Too much content for a first proof:** 20 Sparks per class with 8 that change behaviour is about 40 new behaviours, each needing code, effects, sound, bot support and balance. Prove the idea with **8 Sparks per class (3 that change behaviour) and 4 Relics** first, then grow from the pick-rate and win-rate data, as the plan itself says.

## 5. Is the checkpoint order right?

**Partly. The plan puts look and feel before the loop. For an action game, feel first is right. But it builds final art before it knows the new loop is fun.**

- Checkpoint 2 makes one room "look and feel final", then asks whether "3 of 5 cold testers play 10 minutes and ask for more". **One room has about 90 seconds of play in it**, and the new verbs, Sparks, Relic, fork and enrage don't exist yet. A tester can't judge the game's fun from that.
- The signature verbs (Overheat, Backstab, Parry, Charged shot) are the most important change to how combat feels, yet three of them arrive in Checkpoint 4, around week 10.
- The first real test of retention with strangers is Checkpoint 7, around week 20. If day-7 retention is poor then, months of art are already sunk.
- **"Steve picks blind" can't be blind.** Steve knows which build is new. The blind pick has to come from cold testers.
- **The music test has already been run.** client/audio/music.ts holds 1,223 lines of themes built in code for every place. On 25 Nov Steve called that music "pretty bad" and replaced it with Suno (client/audio/tracks.ts, header comment). Repeating that test costs weeks and will probably end the same way **(judgment)**. Also, Steve made the Suno songs himself, so replacing them needs to be put to him with care, not decided around him.

**Better order (judgment):**

1. **Weeks 1 to 3, the "grey box" fun test.** Use today's renderer with the camera pulled in, big placeholder shapes, `feel.ts`, the dodge, all five verbs, 8 Sparks per class, 4 Relics, the 5-room run with a fork, the enrage and the mastery card. Put it on the public web build with the event log. Cold testers play a whole delve.
2. **At the same time, a look test.** One art agent builds one room, one hero and one foe, *animated*, and records a 15-second clip. Cold testers pick blind between it, today's look and a pixel-art version.
3. **Only after both pass,** build the Kiln at final quality (today's Checkpoint 3) and then the rest.

## 6. What could still read as thrown together, or as AI slop?

- **The "made by hand" promise.** Pillar 5 says "No generative-AI ... text ships", and the naming rules say every item is "written by hand". But every line, name and model in this game is written by Claude, which is a generative AI. If a player or journalist learns that (a Claude-built game is an easy story), "hand-written" turns into the scandal the plan is trying to avoid. The Crimson Desert apology shows how fast this goes ([Engadget](https://engadget.com/gaming/crimson-desert-developer-apologizes-and-promises-to-replace-ai-generated-art-183716439.html)). Steam also counts AI-made content that ships in the game, not just images ([VGC](https://www.videogameschronicle.com/news/valve-has-significantly-rewritten-steams-rules-for-how-developers-much-disclose-ai-use)). **Fix the wording** (fix 2 below).
- **The plan breaks its own naming rule.** Rule 2 bans "made-up fantasy syllables", yet the plan keeps **Nhevra** the Cold Hearth, and the game shows **Maelra** (hub card, 13-01-hub.jpg) and **Ysmeret** (music.ts). Those names are exactly the pattern the rule exists to stop. Every existing name must go through the rename map, not just the new ones.
- **The Suno song titles** ("Shadow of the Digital Dragon", "Shadow Protocol", tracks.ts) don't fit a fire-and-clay world. If the songs stay for a while, at least rename them in any credits.
- **Familiar story parts.** A dying town, an old woman with the last coal, "Bring more." These are familiar fantasy pieces **(judgment)**. They aren't slop in themselves, but they need one specific, odd detail each. For example, the Hearthkeeper could be rude or comic, not wise. Otherwise they read as generated.
- **Static figurines.** See the animation gap above. Stiff motion is what players notice first in a 3D game made without artists **(judgment)**.
- **Today's evidence:** the 3D sheet shows "Hero 2/3/4" tags and one full-screen colour wash per dungeon (rooms-sheet-0.png). The hero tab lists "Rimeburnt Focus", "Tidebreaker Hood" and "Titanheart Hauberk" with no icons (13-06a-tab-hero.jpg). The end screen is half empty after a 6:08 loss to Burnout (13-13-end-full.jpg). The plan fixes all of these correctly. Make them the first visible wins, because they are cheap.

---

## The 10 most important fixes, ranked

**1. Prove the fun in grey box before any final art.**
- Insert a new Checkpoint 2, "Fun test", of about 3 weeks. Build it on today's renderer with the camera pulled in and big placeholder shapes.
- It contains: `feel.ts`, the dodge, all five signature verbs, 8 Sparks per class (3 that change behaviour), 4 Relics, the 5-room run with one fork, the visible enrage and the mastery card.
- Ship it to the public web build with the event log on.
- It passes when 3 of 5 cold testers finish a full delve and start another unprompted, and the event log shows at least 30% of web players start a second run.
- The look test runs alongside it (fix 5). No final-quality art beyond one room starts until both pass.

**2. Rewrite the "made by hand" claims so they're true.**
- Change pillar 5 to: "No AI image, music or voice generators. Every line is edited and approved by Steve."
- On the store, claim only what is true: *"No AI art or music. Every model and sound is built in code."*
- Never claim text or names are "hand-written". Steve reads and signs off every name and line before it ships, which also gives the game one consistent voice.
- Write down, now, how the team will answer "was this made with AI?", so the answer is ready before a reviewer asks.

**3. Stop re-testing music made in code. Budget human music now.**
- Steve already rejected the code music on 25 Nov (client/audio/tracks.ts).
- In Checkpoint 1, ask Steve one question with care, since he made the Suno songs himself: keep Suno and disclose it, or replace it.
- If he chooses to replace it: pick human-made CC0 music for the tests this week, and get 2 or 3 composer quotes for 8 to 10 short loops by Checkpoint 3. Use the ember motif as the brief.

**4. Add a plan for getting players, with numbers.**
- Name the channels: the public web build, an itch.io page, a short boss clip each week on TikTok, YouTube Shorts and Reddit, and a Discord for testers.
- Add a small paid-ads test, with Steve's approval, for the soft launch.
- Set a minimum sample before any soft-launch gate counts: at least 300 installs **(judgment)**.
- Replace "most cold testers name a fair price of $4.99 or more" with real behaviour, such as a wishlist, a sign-up, or a "notify me when the full game is out" tap. What people say they'd pay is not what they pay **(judgment)**.
- Weigh a Steam page as a second store.

**5. Specify animation and an art target before building the art kit.**
- Every body gets six states: idle, move, wind-up, attack, hit, die. They're built from rigid parts with code tweens (anticipation, squash, recoil).
- Collect a reference board of 6 to 8 shipped low-poly games, with links, as the quality target.
- The look test is a 15-second **animated** clip of one hero against one foe in the Kiln room. Cold testers pick blind between it, today's build and a pixel-art version.
- Re-estimate art at 1 day per body, including animation, and say plainly that this makes the total longer.

**6. Give Steve a list of what only he can supply, with dates.**
- Buy one mid-range Android test phone now (about $150 to $250, judgment). The 60 fps gate means nothing without one.
- Recruit about 35 cold testers over the project, 5 new ones per checkpoint, from his network, r/playmygame or Discord. Give them a written script and a screen-recording how-to.
- Note the developer-account dates and the composer budget.
- Make cold testers, not Steve, the judges of every "blind" test. Steve keeps a separate "I'd pay for this" sign-off.

**7. Keep a headless or debug renderer when the 2D art goes.**
- Deleting client/textures.ts breaks browser QA, because 3D runs about 10 times slower than real time in the test container (average.md).
- In Checkpoint 2, add a minimal debug view (flat shapes, no textures) for automated runs, kept out of the player's build.
- Only then delete the 2D look for players.
- Also run the bot balance matrix nightly, not on every PR, and gate merges on a small fast subset. A full 5-class, 6-place, 40-seed matrix per PR will stall the team **(judgment)**.

**8. Make the daily leaderboard cheat-proof before launching it.**
- Submit each daily run's seed and inputs.
- A Supabase function replays the run with the deterministic sim and rejects scores that don't match.
- If replay is too slow, check limits at least (minimum possible time, maximum damage), and let players report scores.
- Without this, the one shared daily feature fills with fake scores in week one.

**9. Sharpen the hook around what only Horders has, and test it.**
- Drop the "portrait plus bosses is unique" claim. Archero already sits there.
- Lead with "a dungeon party in your pocket": one tap to Quick join, bots filling the tank and healer, and a clip of an interrupt saving the group.
- Let free players host one co-op run a day.
- Before the rename (end of Checkpoint 2), post three 15-second clips with three pitch lines (fire-thief fantasy, pocket dungeon party, portrait boss fights) and keep the one that gets the most watch time and sign-ups.
- Look again at one raid on bots as the hour-10 to hour-20 goal, since bots answer the empty-lobby worry.

**10. Show the whole schedule and cut what isn't needed.**
- Put the total on the first page: about 24 to 31 weeks to worldwide launch.
- Cut the save converter, and wipe saves once with a thank-you title.
- Set the first content ceiling at 8 Sparks per class and 4 Relics, growing only from pick-rate and win-rate data.
- Default to a dodge button and offer flick as an option.
- Run every existing name (Nhevra, Maelra, Ysmeret and the rest) through the rename map.
- Decide now which content is free for unlock owners (fixes and Omens) and which is paid (new places and raids). This keeps "every future season free" from becoming an unfunded promise.
- Budget one Apple review round-trip under guideline 4.2, with offline play and haptics ready before the first submission.

---

*Sources used in this review: [Pocket Gamer on Archero](https://www.pocketgamer.com/archero/how-to-play-archero-the-latest-free-mobile-rogueli), [Game Developer on Archero](https://gamedeveloper.com/design/finding-the-fun-archero-part-1---gameplay), [MobiLoud on Apple guideline 4.2](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper), [Apple Developer Forums, 4.2 rejection](https://developer.apple.com/forums/thread/806726), [VGC on Steam AI disclosure](https://www.videogameschronicle.com/news/valve-has-significantly-rewritten-steams-rules-for-how-developers-much-disclose-ai-use), [Engadget on Crimson Desert](https://engadget.com/gaming/crimson-desert-developer-apologizes-and-promises-to-replace-ai-generated-art-183716439.html), [PocketGamer.biz on paid apps](https://www.pocketgamer.biz/indie-mavens-are-paid-apps-dead/). Horders' own state: vision.md, game.md, audit.md, positioning.md, the screenshots, rooms-sheet-0.png, qa/playtest/average.md, and the repo (client/audio/tracks.ts, client/audio/music.ts, sim/rng.ts, sim/netsync.ts, client/textures.ts).*
