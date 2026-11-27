# Debate: Mobile Product Lead

*27 Nov 2026. I've read all five proposals and both research reports. **(judgment)** marks my opinion.*

## Where all five of us already agree

Nobody needs to argue these any more:
- **Cut the launch** to about seven places.
- **Hand-name every item.**
- **Get Suno out** before we charge.
- **Bring the camera in** so heroes are about 70 px tall.
- **Make every loss pay**, with a mastery line.
- **Replace the hub chips** with one clear path.
- **Never sell power.**

Each of these is backed by research: P1, P3, P9, P10 and P13, plus the 85% negative reaction to generative AI ([Quantic Foundry](https://quanticfoundry.com/2025/12/18/gen-ai/)). It's rare for five disciplines to converge like this, and we should take it as a signal. The fight now is about **scope and order**, not direction.

## What I adopt from others

- **The world and the name (Creative).** My draft hook, "real boss fights in ten minutes", says what the game does but gives no reason to care. "Fire thief" gives us P2's one-sentence fantasy. It also gives meaning to embers, Heat and Quench without new code. I also back **renaming before any store assets exist**. Our biggest risk is reach with no marketing budget, and paid apps already convert about 10 times worse ([PocketGamer.biz](https://www.pocketgamer.biz/indie-mavens-are-paid-apps-dead/)). A name that store search reads as "Hoarders" costs us organic installs we can't buy back **(judgment)**. A trademark check comes first.
- **The town hub, on my conditions.** A town you relight is better than my "Today" card, because it also shows unlocks one at a time (P13). The conditions: Play is always the biggest thing on screen, a new player sees no more than Play plus 2 buildings, and buildings light from normal wins, never from timers.
- **The combat budgets, nearly whole.** I adopt the 60 to 90 s boss budget for every class as a merge gate. I adopt the **visible enrage in place of Burnout**: a 6-minute loss with no killing blow is anti-pattern 7, a loss that wastes your time. I adopt every F as an interrupt, and the floor that no class wins less than 60% as often as the best class. That floor replaces my looser "no class loses twice as often". Five rooms at 6 to 8 minutes also fits the 5 to 6 minute median session better than today's 8 to 12 ([GameAnalytics](https://gamedevreports.substack.com/p/gameanalytics-mobile-gaming-benchmarks)).
- **Kiln-lit dioramas (Art).** The market research names flat-shaded low-poly with outlines as the most realistic look for an agent-built three.js game. The retention report's "pixel art is safer" line came before we knew who would build the art. The palette unit test and the measured hero height are exactly the kind of checks a team of agents needs.
- **From Systems:** Sparks that change behaviour, **one Relic per run**, Blueprint shards on a loss, Quick Delve as the official short mode, and merging the four calendar systems into a **single Hoard Cache**. That last one simplifies the game, which I wanted anyway.

## Where I disagree

1. **No raid at 1.0.** Creative wants the Hoard raid and Systems wants 2 group dungeons plus a raid. A four-person raid at launch risks empty lobbies (anti-pattern 11), and co-op on mobile networks is our least reliable feature. I'd ship **one group dungeon** (bot-fillable) and make **the Hoard raid Season 1's "new toy"**. That answers the Diablo IV lesson: a season needs something new, not a nerf ([Windows Central](https://www.windowscentral.com/gaming/diablo-4-having-its-first-season-so-soon-after-launch-was-a-mistake)).
2. **Systems is too much before we have any data.** Sixty Heirlooms with tempering, about 150 Sparks, 20 Fusions, 12 Omens, the Descent board and a save converter is a second game. Slay the Spire balanced from logged pick rates ([Game Developer](https://gamedeveloper.com/design/how-i-slay-the-spire-i-s-devs-use-data-to-balance-their-roguelike-deck-builder)), and we have no log yet. For 1.0, ship:
   - Sparks, with about 40% that change behaviour
   - 2 Fusions per class
   - Relics
   - shards and Blueprints
   - the Cache

   **The Descent, the full Heirloom tempering system and Omens past 8 should wait for soft-launch data.** Seasons exist to deliver them later.
3. **Every checkpoint ends with "Steve plays and likes it."** That's necessary but not enough. Steve isn't the target player and can't be a cold tester. No other proposal adds analytics. Without the event log and 5 cold testers per checkpoint, we can't tell whether the town, Sparks or the camera actually helped **(judgment)**.
4. **The flick-dodge needs a dodge button from day one**, not just as a fallback. Accidental rolls on a thumb stick are the kind of "mouse-like touch" problem that cost Balatro's port points ([148Apps](https://148apps.com/balatro/review)). We test both with cold players.
5. **Too much running at once.**
   - The estimates add up to 5 to 7 weeks of art, 6 to 8 weeks of combat, 6 to 8 weeks of world work, plus the systems work.
   - All four assume the same Kiln slice is done first. So that slice is our only critical path, and it needs **one shared definition**: one room, Emberwright plus Duskblade, a three-job pack, the new camera and feel kit, the clay-and-iron look, new music, the event log, and a blind side-by-side test against today's build.
   - Nobody scales anything until it passes.
6. **Cutting the 2D mode** needs Steve's explicit sign-off. It also needs a tested low-power 3D mode, because App Store review and cheap Android phones will find our frame-rate problems before players do.

## The three decisions the team must make together (Steve decides)

1. **The name.** Rename to Emberthief (backups: Kilnward, Hearthless) before any store asset exists, or keep "Horders" and accept the cost in search.
2. **What 1.0 includes.** Which places ship (I say 5 solo plus 1 group, with the raid in Season 1), and which systems layers ship versus wait for data.
3. **Committing to the art and audio redo.** Full kiln-lit dioramas, the 2D look retired, Suno replaced through a blind test or a composer, all gated on the shared one-room slice passing cold testers.

## My vote

- **Hook:** *"Steal fire from a furnace full of greedy kings: real, readable boss fights in ten minutes, in portrait, for one fair price."*
- **Core loop: adjust.** Keep the room-to-room delve, the stick plus four buttons, the auto-attack and the telegraphed bosses. Adjust:
  - 5 rooms in about 6 to 8 minutes
  - 3 to 5 big foes per pack
  - fight budgets with a visible enrage
  - Sparks that change behaviour, plus one Relic
  - every run carries fire home
- **Art direction:** kiln-lit dioramas: fired-clay Court creatures and iron hero figurines, low-poly with outlines, lit only by fire, with signal colours reserved for gameplay.
- **Top 5 priorities, in order:**
  1. **The shared one-room vertical slice:** camera, feel kit and haptics, the diorama look, new music, and the event log live, tested blind and on cold players.
  2. **The first five minutes and the free hour as a funnel:** the authored opening, the town hub opening one building at a time, and the loss screen that pays and teaches.
  3. **Fair fights:** 60 to 90 s bosses for every class, the visible enrage, the 60% melee floor, one signature verb per class, and every F an interrupt.
  4. **The world bible and naming pass**, plus Sparks and Relics, with about 120 hand-written items.
  5. **The launch package:** cut to 5 solo places plus 1 group dungeon, a $5.99 unlock with restore, no ads, the store page shot from the slice, then the closed test and soft launch gates.
