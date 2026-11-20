# Competitive positioning

Steve (20 Nov 2026): Horders must be clearly different from Azeroth Survivors, but we can borrow general ideas when they help. This page lists what that game has, what we take as a general genre idea, and what sets Horders apart. The roadmap follows from it.

## What Azeroth Survivors is (sources)

Both pages below are fan sites about the same game, Azeroth Survivors by Aethus, which is played at wow.aethus.pl. We read them on 20 Nov 2026 but didn't play the game itself, so this describes the game as those pages present it.

- **What it is:** "A free, fan-made World of Warcraft-style survivors roguelike that runs in the browser." "Your spells fire on their own, choose level-up cards and beat each zone's five bosses" ([azeroth-survivors.org](https://azeroth-survivors.org/)). "Choose a class, move through enemy waves and pick upgrades as you level up" ([wowsurvivors.com](https://wowsurvivors.com/)).
- **IP:** a fan game in the WoW setting, with nine WoW class names and WoW place names such as Naxxramas (azeroth-survivors.org).
- **Size:** nine classes, "All 115 spells", talent trees with "51 points", "Eight pieces and set bonuses", and "five bosses" per zone (azeroth-survivors.org).
- **Modes:** an Endless mode after the final boss, with "Slower Endless scaling", and lobby co-op: "Host a lobby, join your party" (azeroth-survivors.org). Neither page gives a party size.
- **Platform:** browser with WebGPU, plus a Windows download. On phones: "Use landscape orientation", and "a full mobile playthrough [has] not been comprehensively tested" (wowsurvivors.com). Progress is saved in the browser, with optional manual cloud saves (azeroth-survivors.org).
- **Not on either page:** tank, healer and damage roles, threat, a raid or world boss, anything shared between players outside a lobby, and interrupts or cast bars.

## What we borrow (general genre ideas, never their names or content)

| Idea | Common in the genre? | How Horders does it, in our own way |
|------|---------------------|-------------------------------------|
| Set bonuses | Yes, an MMO staple | Small sets of 2 to 3 pieces tied to *a verb* (for example interrupts refund mana), dropped by our own bosses. Part of R4. |
| Endless after the last boss | Yes, a survivors staple | Our endless is already the **tier ladder plus weekly Omens**: rules change, not just numbers. No separate mode for now. |
| Talent trees | Yes | We keep the in-run **draft**, one card per branch (skills team), so builds happen during the run. No 51-point planner. |
| Lobby co-op | Yes | Co-op with **roles and threat** (R9), scaled by party size ([group-play.md](group-play.md)). |

## What sets Horders apart (protect these)

1. **Few tough fights, not swarms.** Five named fights a delve, each with a mechanic to learn: dodge, interrupt, soak, kite. Their game is waves with spells that fire on their own. Ours is fights you read and react to. (Pillar 1.)
2. **An MMO inside the run.** An action bar you press, cast bars, interrupts, target frames, a "ding". (Pillar 4.) Neither page mentions interrupts or cast bars.
3. **Phone first, portrait, two thumbs.** They ask phone players to use landscape and say phones are untested. We design for portrait first and screenshot every feature at phone size.
4. **Shared and persistent.** The world boss everyone strikes, cloud saves for every hero, and a weekly Omen rotation that's the same for every player. Their progress is per browser and co-op is per lobby.
5. **Roles that matter in a group.** Tank, healer and damage roles with threat and taunts, and a healer-only problem on every boss. Neither page has roles.
6. **Original world.** Our own names, places and classes (the Kiln Depths, the Drowned Foundry, Bulwark, Duskblade, Emberwright, Lumen). No WoW names, ever.

## What we don't chase

- **Spell count or class count.** Five deep kits beat nine shallow ones. Each class gets one verb no one else has.
- **Auto-fire.** Pressing an ability, and choosing when, is the point.
- **Endless waves as the main mode.** It works against pillar 1.

## How this steers the roadmap

- **R9 co-op with roles moves up**, from "later" to right after the current PRs merge, since it's our biggest difference and the threat rules are built. It needs engineering for rooms and netcode.
- **R7 daily bounty is next for design.** One fight, one twist, the same seed for every player that day. It's a shared reason to come back that a per-browser game can't easily match. It needs no server, because the seed comes from the date (as `weekOf` works today).
- **R4 build-changing loot** adds verb sets (see the borrow table), with the skills team.
- Every new feature gets a one-line check in its spec: *which of the six differences does it strengthen?*
