# Three 15-second pitch clips (plan)

*Design, 27 Nov 2026. Pillars 1 and 5. Design queue item 5. The roadmap says: "Before the name is final, three 15-second clips test three pitch lines" ([roadmap.md](roadmap.md), "Getting players"). The red team named the three lines to test: fire-thief fantasy, pocket dungeon party, portrait boss fights, and to "keep the one that gets the most watch time and sign-ups" ([vision/redteam.md](vision/redteam.md), point 9). The winner feeds Steve's name decision at the end of Checkpoint 2 (roadmap decision 3) and the store page's lead line. This page is the plan; nothing is recorded or posted yet.*

## The three clips

Same frame for all three, so only the line and its proof change: **vertical 9:16, 15 s, from the real build, portrait at 390x844 or the phone's native size.** 0-2 s the line on screen over the first shot; 2-12 s the proof; 12-15 s an end card with the line again and "Play in your browser: horders.netlify.app". No "free" until the price is decided (Steve may charge or add ads at launch), and no game title on the card until decision 3 is made: the card says the line, not a name.

| | A. Fire thief (the fantasy) | B. A dungeon party in your pocket (the roles) | C. Boss fights in portrait (the play) |
|---|---|---|---|
| **Line (draft, Steve approves)** | *Steal fire from a furnace full of greedy kings.* | *A dungeon party in your pocket.* | *Real boss fights, one thumb, a few minutes at a time.* |
| **Source** | vision.md section 1 pitch; world.md "do/don't" table uses it as the store line | roadmap.md pitch, first clause; red-team point 9 ("Lead with a dungeon party in your pocket") | vision.md section 1, "portrait boss fights are the proof" |
| **0-2 s** | Dark Kiln mouth, the hero walks in with one ember lit | Party of three in a Halls room: tank in front, healer behind | The Kiln Mother fills the top third of the phone |
| **2-12 s** | Trash shatters; the Kiln Mother's red slam, a dodge roll through it; she falls; her ember carried up and the town hearth lights | A boss starts a blue cast; the Bulwark (or Cutwick) kicks it; the healer's heal lands on the tank; the boss drops; loot bag | Red slam, roll; blue cast, Quench; another red, roll; her health bar empties |
| **12-15 s** | End card | End card | End card |
| **Honest promise?** | Yes: every new player meets this in the first 5 minutes (vision hook table) | **Partly.** The Checkpoint 2 slice is solo in the Kiln (checkpoint-2-grey-box.md), so a new player meets the party later. Judge B on watch time; read its sign-ups knowing the first session doesn't deliver the party yet | Yes, once the Checkpoint 2 camera is in (boss at least a third of the screen) |

The lines follow the world.md voice guide: none uses a banned word ("epic", "journey", "adventure", "legendary" and the rest), and line A is the store line world.md already gives as the "do" example. **They are drafts: Steve approves player-facing lines** (1.0 queue rule). If he wants a different line in a slot, the clip's shots stay the same.

## When

After the Checkpoint 2 grey box is live (camera in, `feel.ts` hit flashes, dodge, the enrage), because clips of today's small camera would test the old look, not the line. Before Steve's name decision at the end of Checkpoint 2. Clips are tested on their own, not shown to the 5 cold testers before they play ([cold-testers.md](cold-testers.md)), so the testers stay cold.

## How they get made (no AI generators)

- **Footage:** captured from the real build. Option 1 (first try, free): engineering scripts each shot with tools/playdriver.cjs on a fixed seed at 390x844 and saves frames, then joins them into video. This is untested for video: headless 3D runs about 8x slow in the cloud container (project memory, playtest panel), so frames would have to be stepped, not recorded live. Option 2 (fallback): Steve records the three shots on his iPhone with the screen recorder, from a save that has the party and the Kiln Mother unlocked; design sends a 6-line shot list.
- **Editing:** any free editor without generative features turned on, for example iMovie on the iPhone or DaVinci Resolve. Text typed by a person, no AI voice-over (pillar 5, vision rule: no AI image, music or voice generators in new assets).
- **Sound:** the game's own sound effects (synthesized in client/audio/). **Open:** the current music is Steve's Suno tracks, and pillar 5 keeps AI-made music out of new assets. Until the music is replaced, either mute the track in the editor and keep only hits and stings, or say "music made with Suno" in the caption (docs/design/made-with-ai.md). Steve's call; design recommends muting (simplest, nothing to disclose).

## How they're judged

- **Post all three the same day, same platform, same time of day, same caption shape** (the line plus the link), no paid boost. YouTube Shorts and TikTok are the roadmap's channels; one platform is enough for the test, two if Steve has both. **Posting is Steve's step**: it publishes under his account, so nothing goes out without his yes.
- **Measure after 7 days** (judgment): views, **average percentage watched** (the main number, since a pitch line has to hold attention), and link clicks. Each clip gets its own link, for example `horders.netlify.app/?from=a`, `?from=b`, `?from=c`, so plays can be traced to a clip. **Open for engineering:** the event log (Checkpoint 1 spec, not live on 27 Nov) has to record that `from` tag on a player's first run for "sign-ups" to mean anything; without it, only the platform's own click counts are available.
- **Pick the winner:** the highest average percentage watched, unless another clip has at least twice its link clicks (judgment: clicks are the stronger signal, but at small numbers they're noisy). Under about 300 views per clip, call it a tie and let the cold testers' Q1 answers (what they said the game is about) decide.
- **Report:** one table (views, % watched, clicks, plays per tag) into this page, the winner named, and the result handed to Steve's decision 3 with the cold testers' Q1 answers.

## Not in this plan

The **look test** clip (one hero, one foe, one Kiln room in the new low-poly look, judged blind against today's look and a pixel version; checkpoint-2-grey-box.md) is a different clip with a different question, and waits on Steve's yes to roadmap decision 1. Weekly boss and interrupt clips (roadmap, "Getting players") start after this test, using the winning line.
