# Raid 2: Old Coalmouth in the Hoard (Phase 7, 21 Nov 2026, design)

**Why.** The world boss rotates through four bosses (supabase/migrations/0003: Grandmother Slag, the Cinder Colossus, Old Ashmaw and the Furnace Regent), but only Grandmother Slag can be fought in person, in the Crucible (raid.md). For three weeks in four, the raid is a fight against a boss that isn't the live world boss. A second raid for the next boss in the rotation gives the top of the game a second goal, and a second reason to find three friends.

## Rename first: Ashmaw becomes Coalmouth
"Ashmaw" is a WoW NPC title: **Maxnar the Ashmaw** (wowhead.com npc=21389, warcraft.wiki.gg/wiki/Maxnar_the_Ashmaw). Under Steve's rule ("only true WoW-branded names") a coined word that WoW uses as a name is renamed, as "Anvilward" was in #220.
- **The Kiln rare** "Ashmaw the Glutton" is now **Coalmouth the Glutton** (display names only; the id stays `ashmaw`, so saves and quests are unchanged).
- **The world boss** "Old Ashmaw, Eater of Embers" should become **Old Coalmouth, Eater of Embers**. Its name lives in the server's rotation (migration 0003), so engineering prepares a migration, and it is applied only after Steve says yes.
- **Search (21 Nov 2026):** "Coalmouth" turned up no WoW or Azeroth Survivors name (only the unrelated pet "Lil' Coalee"). "Eater of Embers", "Cinder Colossus", "Furnace Regent", "Walking Forge" and "Mother of Kilns" have no WoW match either. "The Gullet" was considered for the raid and dropped: it is a WoW place (warcraft.wiki.gg/wiki/The_Gullet).

## The raid: the Hoard
Coalmouth hoards embers in a cave of coal, which also fits the game's name. "Hoard" is a plain English word.
- 4 heroes, unlocks at **tier 9** (one after the Crucible), `raid: true`, so its hits count toward the world boss like the Crucible's.
- Two opener fights and a named fight from the existing pool, then Coalmouth. No bots (`botFillBlocker`, like the Crucible).

## The fight: a new group check, "get them out"
The Crucible tests tanks swapping and soaking. The Hoard tests the party switching targets to save one of their own.

| Phase | Health | What he does | The answer |
|---|---|---|---|
| 1, Gorge | 100 to 60% | **Gorge** every 12 s: a 3 s interruptible cast that heals him 8% if it lands. | Interrupt it (the Kiln rare's lesson, at raid scale). |
| 2, Swallow | 60 to 25% | Gorge continues. **Swallow** every 18 s: he swallows the non-tank hero furthest from him. That hero vanishes, can't act, and loses 4% of max health a second. A **Craw** (a weak spot with its own health) appears at his side. Break it inside 8 s and he spits the hero out. Otherwise the hero is Digested (downed). | Switch to the Craw at once. |
| 3, Ember Feast | 25 to 0% | Swallow continues. Every 10 s **Ember Spill** scatters 6 embers around the arena. A hero who walks over one takes it. One left 7 s, or that he walks over, he eats: it heals him 2% and makes him hit 5% harder for the rest of the fight. | Grab the embers before he does. |
| Hard enrage | 420 s after he appears | **Last Meal**: a 5 s cast that can't be stopped, then he swallows everyone. | Kill him first. |

**Targets** (the same as the Crucible): a real party in hero-t8-0 gear wins 55 to 70% at tier 9, and never more than 70%. Two-tank parties have no special answer here: the check is everyone's, not the tanks'.

**Bots:** the party bot targets the Craw while it stands (breaking it is everyone's job), interrupts Gorge as it does the Kiln rare's, and walks to the nearest ember in phase 3.

## Status
Built in the W2 PR (21 Nov 2026). Tuning lives in `COAL` (sim/world.ts) and `ENEMIES.coalmouth` / `ENEMIES.craw` (sim/content/enemies.ts). Achievement **Crawbreaker** (boss:hoard); "Crawbreaker" has no WoW match in a search on 21 Nov 2026. `worldBoss: 'Old Coalmouth'`, so his hits count triple only in his weeks (W3, #293).

**Measurements** (tools/group.ts, Bulwark, Lumen, Duskblade and Emberwright in heroes-r2 hero-t8-0 gear, tier 9, seeds 1 to 40, bot skill 1 unless noted):

| Old Coalmouth base hp | Craw base hp | Wins of 40 |
|---|---|---|
| 20000 | 900 | 0 of 6 seeds (every Swallow digested: a 900 Craw scales to about 19,000 at tier 9) |
| 13000 | 120 | 9 of 10 seeds |
| 15000 | 120 | 31 (78%) |
| 16500 | 120 | 29 (73%) |
| **18000** | **120** | **27 (68%), chosen** |
| 19500 | 120 | 20 (50%) |
| 18000, bot skill 0.7 | 120 | 18 (45%) |
| 18000, tier 10 | 120 | 0 (tier 10 needs better than t8 gear) |

At 18000 a run sees about 6 to 8 Swallows, 2 to 3 of them Digested, and most Gorges interrupted. The bots grab most embers, so Ember Feast mostly punishes a party that loses track.

Placeholder art: Old Coalmouth borrows the Coalmouth rare's sheet and the Craw the rift's, until visuals (W6) draws them. Embers and the Gorge ring are drawn in GameScene. The raid theme plays (sound, W7).
