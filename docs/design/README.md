# Horders game design

This is the living design doc for how Horders plays. The game design thread owns it; engineering, skills and visuals read it and propose changes by PR. The original plan (genre research, phases, tech, monetization) is the "Ember & Horde: MMO Survivors Design Plan" doc. Where the two differ, this file is newer and wins.

Companion files:
- [roadmap.md](roadmap.md): what we build next, in order, and who owns it.
- [balance.md](balance.md): targets, how we measure them, and the latest numbers.
- [decisions.md](decisions.md): the calls Steve has made, so nobody re-asks them.

## The game in one paragraph

Each delve is a short dungeon: a handful of tough, named fights in an arena, ending in a boss with raid-style mechanics (cast bars to interrupt, telegraphs to dodge, gold circles to soak, healers to kill first, phases and an enrage). Every fight you clear is a level, a talent draft and a loot bag, so your build snowballs inside the run like a survivors game. Your hero keeps the gear, levels and permanent points, so a loss still moves you forward. Above it all sits the shared world boss: every delve anyone finishes chips its health, and everyone who hit it gets paid when it falls.

Also: [positioning.md](positioning.md) (how we stay different from Azeroth Survivors) and [group-play.md](group-play.md) (party scaling, roles and threat, with sources).

## Design pillars

These come from Steve's feedback during the alpha. Every feature should serve at least one and break none.

1. **Few enemies, each one matters.** No swarms of meaningless monsters. A fight is one tough named enemy or a small pack of 2 to 4, each with a mechanic you can learn. Adds appear only as a boss mechanic.
2. **Hard fights you win by playing well, then by getting stronger.** Mechanics punish mistakes; gear and levels make the same fight forgiving later. Some bosses should be out of reach until the hero (or a group) is strong enough.
3. **One more run.** A delve is 3 to 6 minutes, starts in seconds, and always pays something permanent, even a loss. Never a long dry stretch: bad-luck protection on big drops.
4. **It feels like an MMO inside the run, not only between runs.** Action bar and resource, cast bars, interrupts, target frames, rarity beams, quest-style objectives, a "ding".
5. **Phone first.** Readable at a glance, playable with two thumbs, nothing that needs precise aiming.

## Core loop

1. Hub: equip, spend points, forge, pick a tier, check the world boss.
2. Delve: 5 fights. After each: level, a talent draft, loot bag, 30% heal. After fights 1 to 3, a fork: walk into the steady fight, a harder named fight with better loot, or sometimes a shrine.
3. Boss: the Kiln Mother, or Maelra in the Foundry. Win to unlock the next tier.
4. Results: hero XP, the items you picked up, a small end chest on a win, and a strike on the world boss.
5. Back to 1.

## Systems

### Dungeon and encounters (game design owns)
- Content is data in `sim/content/dungeon.ts` and `sim/content/enemies.ts`.
- A route is rolled from the seed: two openers, a named foe, a hard fight, then the boss.
- Fights scale with depth (+12% enemy health per fight cleared) and tier (+22% health and +12% damage per tier).
- **Forks (R1):** after fights 1 to 3 you choose your next fight by walking into a gate: steady, named (harder, better loot) or a shrine (full heal and a level, no loot).
- **Two dungeons (R6):** the Kiln Depths (dodge, interrupt, soak) and, from tier 4, the Drowned Foundry (stop-or-interrupt mirrors, twins you must kill together, rings you drag away from enemies, and Maelra, a boss you kite through steam vents while the water rises).

### Bosses
- Every boss teaches one or two verbs and tests them together at the end. The Kiln Mother: dodge (red telegraphs), interrupt (Molten Cataclysm), soak (gold circles), three phases and an enrage at 150 seconds.
- A good boss fight lasts 45 to 120 seconds. Shorter feels like a big elite; longer drags on a phone.
- New bosses should add a verb we don't have yet, for example "spread out", "kite it through a hazard", "break a shield before a cast ends" or "stand behind a pillar".

### Loot and gear
- 6 slots, 5 rarities (Common, Fine, Rare, Epic, Mythic), item level from hero level plus tier.
- Most loot drops mid-run with rarity beams; upgrades equip on the spot.
- Bad-luck protection: an Epic is guaranteed after 10 runs without one.
- **Earned rarity (20 Nov 2026):** Epics come from luck, bad-luck protection, the world boss, and the first time you beat each tier from tier 2. A boss otherwise drops Rare or better, and clear bags top out at a guaranteed Rare. Mythics only drop from tier 3. Target: an Epic every 2 to 3 runs and a Mythic every 25 to 30, with the first Mythic somewhere between run 5 and run 40.
- Salvage turns spare gear into embers.
- **The Forge:** embers now have a use. Spend them to raise an item's level (up to the best level you can currently find, plus one) or to temper an item, which rerolls its weakest bonus stat. This is the "smithing" profession from the plan, in its smallest form.
- **Gap:** items are mostly stat sticks. Mythics are the only build-changing loot, and there are 4. See R4.

### Hero progression
- Hero level cap 20 in alpha, one permanent point per level into 4 passives.
- The autopilot reaches level 19 in 50 runs (see balance.md). The plan's target was level 20 in about 40 runs, so pacing is close.

### Difficulty tiers
- Win a tier to unlock the next. Each tier adds +22% enemy health, +12% damage and +12% loot luck.
- **Omens (R3):** from tier 3, every fight carries Omens from a weekly rotation (1 at tiers 3 to 5, 2 at 6 to 9, 3 from 10). Each changes what you do: move after kills, wear packs down together, interrupt sooner, save burst for a shield, keep moving. Each adds +8% loot luck.

### World boss (engineering owns the backend, game design owns the rules)
- One shared boss in Supabase. Each finished delve strikes it with the damage dealt, capped per run on the server. When it falls, everyone who struck it claims an Epic item and embers.
- **Gap:** the world boss is a number that goes down. Nothing in a delve changes because of it, and there's no reason to care which boss is up. See R5.

### Classes, abilities and talents (skills team owns)
- Emberwright today; Duskblade and Bulwark arrive with the class-system PR. Game design sets the role goals each class must meet (see balance.md) and leaves kits to the skills team.

### Look and feel (visuals team owns)
- Anything new that game design adds (an encounter, an enemy, a modifier) lists what it needs drawn in its PR, so the visuals team can pick it up.
