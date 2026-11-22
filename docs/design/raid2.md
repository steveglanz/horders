# Raid 2: Old Vorhulm in the Hoard (Phase 7, 21 Nov 2026, design)

**Why.** The world boss rotates through four bosses (supabase/migrations/0003: Grandmother Slag, the Cinder Colossus, Old Ashmaw and the Furnace Regent), but only Grandmother Slag can be fought in person, in the Crucible (raid.md). For three weeks in four, the raid is a fight against a boss that isn't the live world boss. A second raid for the next boss in the rotation gives the top of the game a second goal, and a second reason to find three friends.

## Rename first: Ashmaw becomes Vorhulm
"Ashmaw" is a WoW NPC title: **Maxnar the Ashmaw** (wowhead.com npc=21389, warcraft.wiki.gg/wiki/Maxnar_the_Ashmaw). Under Steve's rule ("only true WoW-branded names") a coined word that WoW uses as a name is renamed, as "Anvilward" was in #220.
- **The Kiln rare** "Ashmaw the Glutton" is now **Vorhulm the Glutton** (display names only; the id stays `ashmaw`, so saves and quests are unchanged).
- **The world boss** "Old Ashmaw, Eater of Embers" should become **Old Vorhulm, Eater of Embers**. Its name lives in the server's rotation (migration 0003), so engineering prepares a migration, and it is applied only after Steve says yes.
- **Renamed again (22 Nov 2026):** the first replacement name sounded offensive to Steve, so the boss is now **Old Vorhulm**, an invented word (Steve: boss names can be made-up words). Searches for "Vorhulm" on 22 Nov 2026 found no WoW name and no meaning in English or elsewhere; the nearest real word is "haulm" (plant stalks). The kind id is `vorhulm` and migration 0007 (still unapplied) renames "Old Ashmaw" to "Old Vorhulm". "Eater of Embers", "Cinder Colossus", "Furnace Regent", "Walking Forge" and "Mother of Kilns" have no WoW match either. "The Gullet" was considered for the raid and dropped: it is a WoW place (warcraft.wiki.gg/wiki/The_Gullet).

## The raid: the Hoard
Vorhulm hoards embers in a cave of coal, which also fits the game's name. "Hoard" is a plain English word.
- 4 heroes, unlocks at **tier 9** (one after the Crucible), `raid: true`, so its hits count toward the world boss like the Crucible's.
- Two opener fights and a named fight from the existing pool, then Vorhulm. No bots (`botFillBlocker`, like the Crucible).

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
Built in the W2 PR (21 Nov 2026). Tuning lives in `COAL` (sim/world.ts) and `ENEMIES.vorhulm` / `ENEMIES.craw` (sim/content/enemies.ts). Achievement **Crawbreaker** (boss:hoard); "Crawbreaker" has no WoW match in a search on 21 Nov 2026. `worldBoss: 'Old Vorhulm'`, so his hits count triple only in his weeks (W3, #293).

**Measurements** (tools/group.ts, Bulwark, Lumen, Duskblade and Emberwright in heroes-r2 hero-t8-0 gear, tier 9, seeds 1 to 40, bot skill 1 unless noted):

| Old Vorhulm base hp | Craw base hp | Wins of 40 |
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

**Retune after the Craw fix (Y5, #324, 22 Nov 2026).** Once every class could break the Craw (crawIn), the parties won 34 to 38 of 40 at 18000, over the band. Raising his health alone split the parties, because losses then come from the hard enrage and the Burnout ramp. A faster drain inside him (`swallowTick` 0.04 to 0.06 of max health a second) brought the base party to 26. (The Slagbinder rows measured then were wrong: heroes-r2 had no slagbinder files, so it fought with no gear. Skills added them on 22 Nov.)

**Swallow rework (22 Nov 2026).** With fair Slagbinder gear, every Slagbinder party was over the band (33 to 37). Skills traced it: every base loss was a Digest, and the drain killed a hero who went in below about 45% health. So the check was the victim's health, and a Slagbinder (the furthest hero, with regen talents) went in nearly full. Two changes:
- The drain can't kill: it stops at 1 hp, and only the clock (`swallowTime`, 8 s) Digests. With only this, the spread stayed wide (8 s: 25 to 37; 7 s: 22 to 36; 6 s: 15 to 30), with the Slagbinder parties highest.
- He swallows the non-tank who has dealt the most damage this run, not the furthest. A party loses its best damage while it breaks the Craw, so the check is the party, not who stands at range.

| Party (heroes-r2 with slagbinder files, t9, seeds 1 to 40) | Wins of 40 |
|---|---|
| Base: Bulwark, Lumen, Duskblade, Emberwright | 27 (68%); seeds 41 to 80: 26 |
| Base, bot skill 0.7 | 20 |
| Two Duskblades | 29 |
| Two Emberwrights | 28 |
| Bellows Slagbinder for the Duskblade | 23 |
| Bellows Slagbinder for the Emberwright | 32 |
| Anvil Slagbinder as the tank | 36 |

The Bulwark-tank parties sit at 23 to 32. The Anvil tank party (36) is the one outlier left, on skills (Z5).

Placeholder art: Old Vorhulm borrows the Vorhulm rare's sheet and the Craw the rift's, until visuals (W6) draws them. Embers and the Gorge ring are drawn in GameScene. The raid theme plays (sound, W7).

**Phase 12 W3 (22 Nov 2026):** Old Vorhulm has a second version, **Banked Coals**, which replaces Ember Feast's embers in phase 3 with gold circles to stand on as they land (variety.md, Phase 12 W3 part 2). Part 4 moved the coals in to 120 or 170 from him, for the Bellows Slagbinder parties' damage race.
