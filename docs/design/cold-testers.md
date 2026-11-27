# Cold testers: the script and the recording how-to (Checkpoint 2)

*Design, 27 Nov 2026. Pillars 1 and 3. Design queue item 5. This is what Steve hands out for the Checkpoint 2 fun test ([checkpoint-2-grey-box.md](checkpoint-2-grey-box.md), "How it passes"): **3 of 5 cold testers finish a delve and start another one unprompted.** It is built to be used again at every later checkpoint (vision/vision.md section 9: 5 cold testers per checkpoint), with only the "after you play" questions changing.*

## Steve's part, in five steps

1. **Wait for the go.** Send nothing until design says the Checkpoint 2 build is live on horders.netlify.app (queue item 4, the 5-room run, and the event log are not in yet on 27 Nov). A tester who plays the old build is a wasted tester, because each one can only be "cold" once.
2. **Pick 5 people** (rules below) and send each one **Message 1** as it is.
3. **Get the video back** (they send a link or file). Don't watch it with them and don't ask how it went yet.
4. **Then send Message 2**, the questions. They answer by voice memo or text, whichever is easier.
5. **Drop both into the project chat** (or a shared folder link). A design thread scores them with the sheet below. Steve doesn't need to watch anything.

## Who counts as a cold tester

- Has **never played or watched** Horders, including over Steve's shoulder. Steve can't be one (vision section 9).
- **18 or older**, so recording their voice needs no parent's say (judgment: the game's own store rating is expected to be 13+, but this keeps consent simple).
- **At least 3 of the 5 on a phone**, since the game is built for phones (pillar 4). Ideally at least one Android and one iPhone; the rest can be on a computer.
- **A spread of players** (judgment): about 2 who play phone games now and then, 2 who play a lot of games, and 1 who knows WoW or roguelikes. Not only people who play like Steve.
- Friends are fine. Ask them to be blunt; polite testers are the main risk with friends.

## Message 1: before they play (copy and send as is)

> Hi! I'm making a small game and I'd love you to try it before anyone else does. It takes about 15 minutes.
>
> 1. **Turn on Do Not Disturb** so no messages show up in the video.
> 2. **Start a screen recording with your microphone on** (how-to for your device is below).
> 3. Open **horders.netlify.app** in Safari or Chrome. Just use the browser; please don't add it to your home screen.
> 4. **Play it the way you'd play any new game you'd just found.** There's nothing you have to do and no wrong way to play.
> 5. **Say out loud what you're thinking** as you go: what you're trying to do, what confuses you, what you like, what bugs you. It feels odd at first; just keep talking.
> 6. **Stop whenever you'd normally put it down**, even after 2 minutes. That's useful too. Then stop the recording.
> 7. Send me the video (an iCloud, Google Drive or WeTransfer link is easiest, since it may be big).
>
> I can't help while you play, so if you get stuck, say so out loud and do whatever you'd do on your own. After you send the video I'll send you a few quick questions.
>
> **How to record with your voice:**
> - **iPhone:** swipe down from the top-right corner, touch and hold the grey Record button, tap Microphone so it's on, then tap Record. To stop, tap the recording button at the top of the screen, then Stop.
> - **Android:** swipe down twice from the top, tap Screen record (swipe right or tap Edit if it's missing), turn audio recording on (pick the microphone if it asks), then Start. To stop, swipe down and tap the screen recorder notification.
> - **Mac:** press Shift-Command-5, choose "Record the entire screen", open Options and pick your microphone under Microphone, then click Record. Stop with the button in the menu bar.
> - **Windows 11:** press Windows + Shift + R (Snipping Tool), drag over the browser window, turn the microphone on, then Start. The video saves to your Screen Recordings folder.
>
> Your recording only goes to me and the people making the game, and I'll delete it once we've gone through it.

**Why the wording is like this.** It never says "play two runs", "try again" or "beat the boss", because the test is whether they *start another run unprompted*. It never names classes, buttons or the dodge, so the first minutes show what the game teaches on its own. The browser-only line keeps each tester to one anonymous player in the event log (a home-screen app is a separate player; see the link-code notes in project memory).

**Where the recording steps come from** (read 27 Nov 2026): iPhone, [Apple Support 102653](https://support.apple.com/en-gb/102653); Android, [Android Help 9075928](https://support.google.com/android/answer/9075928?hl=en) (Pixel needs Android 11 or later for some steps; the exact audio menu wording varies by phone maker); Mac, [Mac User Guide mh26782](https://support.apple.com/guide/mac-help/take-a-screenshot-mh26782/mac); Windows, [Microsoft, Snipping Tool](https://www.microsoft.com/en-us/windows/learning-center/how-to-use-snipping-tool-on-windows-screenshots-shortcuts-and-screen-recordings). If a tester's video has no sound, the microphone was off; ask them for a voice memo of the questions and keep the video anyway.

## Message 2: after they send the video (copy and send as is)

> Thanks so much! Last bit, a few quick questions. A voice memo is perfect, or just type. Short answers are fine.
>
> 1. If you told a friend about this game in one sentence, what would you say it's about?
> 2. Who were you in the game, and why were you going down there?
> 3. What was the best moment?
> 4. When were you most confused or bored?
> 5. Did anything feel unfair or cheap?
> 6. The bigger fights before the boss: too short, about right, or too long?
> 7. Would you play it again tomorrow without me asking? Why or why not?
> 8. One more thing if you have 2 minutes: open Settings (the gear), set **Dodge** to **Flick the stick**, and play one fight. Which do you prefer, the roll button or the flick?
> 9. Anything else, good or bad?

Q1 is the fantasy check that feeds the name decision (roadmap decision 3: Steve decides the name using which fantasy testers repeat back). Q2 is the same check Checkpoint 3 uses. Q6 and Q8 settle the two Checkpoint 2 questions the cold testers own (checkpoint-2-grey-box.md, "Also decided by the cold testers"). Q8 comes after the scored play on purpose, so it can't count as an unprompted second run. The Dodge setting and its two options are real: client/settings.ts, `Dodge`, "Roll button" / "Flick the stick", default "Roll button".

## The scoring sheet (design fills this in, one row per tester)

| Tester | Device | Finished a delve (won or lost)? | **Started another run unprompted?** (time in video) | Runs played | Minutes played | Where they stopped and why (their words) | First confusion (time, what) | Deaths, and what killed them | Q1 in their words | Q2 | Named fights (Q6) | Dodge pick (Q8) | Said "cheap", "unfair", "AI" or "generic"? |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | | | | | |

**How to score the key column.** "Finished a delve" means a run reached its end screen, won or lost. "Started another unprompted" means that, after that end screen, the tester started a new delve on their own before stopping the recording. Quitting to the hub and looking around then stopping is a no. **Pass: 3 or more of 5 yes.** The other columns feed the "if it fails" page (top three reasons, checkpoint-2-grey-box.md) whether it passes or not. The dodge default goes to whichever of button or flick wins Q8; on a tie it stays the button (vision decision table: a button from day one, testers pick the default).

**Reading the videos.** The design thread works from the video, the tester's own words, and the answers. Every line in the sheet cites a time in the video or a quoted answer; nothing is guessed. If a thread can't open or play a video format, it says so and asks for a link in another format rather than scoring from memory or guesswork.

## Keeping it fair

- **No coaching, ever.** If a tester messages mid-play ("how do I…?"), Steve replies only "Do whatever you'd do on your own, and say it out loud." Coached sessions are still read, but don't count toward 3 of 5; send a sixth tester instead.
- **One build for all five.** If a fix ships mid-test, note the date on the sheet; testers either side of it are scored separately.
- **Privacy.** Recordings stay with Steve and the design threads, are never posted, and are deleted once scored. Nothing personal goes in the sheet beyond a first name or "Tester 3".

## Later checkpoints

Reuse Message 1 unchanged (raise "15 minutes" if the checkpoint needs it: Checkpoint 3 asks testers to play about 10 minutes). Swap Message 2's questions for the checkpoint's pass rules, for example Checkpoint 3 adds "What would be a fair price for this?" (vision section 8: most name $4.99 or more) and Checkpoint 4 asks testers to name their class's special move.

The **look test** (three 15-second clips judged blind) is separate and needs Steve's yes on roadmap decision 1 first; it is not part of these messages. The pitch-line clips are in [pitch-clips.md](pitch-clips.md).
