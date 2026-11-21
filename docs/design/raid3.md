# Raid 3: the Cinder Colossus in the Smeltery (Phase 8, Y1, 21 Nov 2026, design)

**Why.** The world boss rotates through four bosses (migration 0007: Grandmother Slag, the Cinder Colossus, Old Coalmouth and the Furnace Regent). Two can be fought in person: Grandmother Slag in the Crucible (C3) and Old Coalmouth in the Hoard (W2, #295). The Cinder Colossus is next. Visuals already drew his shadow (X1, #309, texture key `colossus`), and sound gave him a shadow sting (S3, #307).

**Names.**
- "Cinder Colossus" had no WoW match in the 21 Nov 2026 search (raid2.md).
- **The Smeltery** is a plain English word. A search on 21 Nov 2026 for "The Smelt" and "Smeltery" found WoW's Smelting recipes (a plain word, which is allowed) but no WoW place called the Smeltery. "Cinderhold" was dropped: WoW has a crowd of Cinder- places (Cindercreg, Cinderside Hall, Cinder Summit), and this one is too close to them.
- Mechanic names below are plain words.

## The raid: the Smeltery
- 4 heroes, unlocks at **tier 10** (one after the Hoard), `raid: true`, `worldBoss: 'The Cinder Colossus'`, so his hits count triple only in his weeks (W3, #293).
- Two opener fights and a named fight from the existing pool, then the Colossus. No bots (`botFillBlocker` blocks every raid).

## The fight: a new group check, "get behind him"
The Crucible tests tanks swapping and soaking. The Hoard tests switching targets to save someone. The Smeltery tests **position around the boss**: the tank holds his front, and everyone else works his back.

| Phase | Health | What he does | The answer |
|---|---|---|---|
| 1, Plating | 100 to 60% | His front is cooled slag plate: hits from within 90° of his facing do **half** damage, hits from more than 120° off it (his back) do **150%**, and the sides in between take full damage. He faces the hero he is attacking (`targetOf`). **Slag Sweep** every 10 s: a 1.5 s telegraphed cone in front of him. | Tank holds him still; damage dealers stand behind him. |
| 2, Wheel | 60 to 30% | Plating continues. **Wheel** every 16 s: a 2 s cast, then he turns to face the non-tank hero who dealt him the most damage in the last 8 s, and Slag Sweeps there at once. | Taunt him back (the tank), or step around him (the target). |
| 3, Meltdown | 30 to 0% | His plate cracks. No more front and back: every hit does full damage. **Meltdown** pulses party-wide fire every 3 s, growing 5% each pulse. | Healers keep up; everyone burns him down. |
| Hard enrage | 480 s after he appears | **Pour Out**: a 5 s cast that can't be stopped, then he floods the arena. | Kill him first. |

**Targets** (as for the other raids): a real party in hero-t8-0 gear wins 55 to 70% at tier 10, and never more than 70%. A first look at tier 10 with t8 gear: the Hoard won 0 of 40 there (raid2.md), so the measurements may need hero-t10 gear from the skills team.

**Bots** (for the sims only; real parties play it in the game): non-tanks walk to a point behind him (`boss.facing + π`, at their usual range); the tank keeps him facing away from the party; anyone in the Slag Sweep cone steps out.

## Built on
- A new `facing` on the Colossus (an angle; set toward `targetOf` each tick, and snapped on Wheel). The client already flips sprites by position; visuals can turn him by `facing`.
- Front and back test (`colossusSide`): the angle from his facing to where the acting hero stands. The plate covers 90° either side; behind means more than 120° off.
- Damage share for Wheel: a rolling 8 s total per hero. `damageEnemy` already knows the acting hero (it calls `damageThreat` with the hero's id), so the tally can sit beside that call.

## Status
Built in the Y1 PR (21 Nov 2026). Tuning is in `COLO` (sim/world.ts) and `ENEMIES.colossus` (sim/content/enemies.ts). He turns at 1.6 radians a second. Slag Sweep is a 200-range, 90° cone, every 10 s. Wheel comes every 16 s in phase 2 and picks by damage over about the last 8 s. Meltdown pulses 3% of max health every 3 s, plus 5% more each pulse. Achievement **Platebreaker** (boss:smeltery); "Platebreaker" had no WoW match in a search on 21 Nov 2026. `worldBoss: 'The Cinder Colossus'`.

**Measurements** (tools/group.ts, Bulwark, Lumen, Duskblade and Emberwright in heroes-r2 hero-t8-0 gear, tier 10, seeds 1 to 40, bot skill 1 unless noted):

| Colossus base hp | Hard enrage | Wins of 40 |
|---|---|---|
| 18000 | 420 s | 28 (70%) |
| 18500 | 420 s | 19 (48%) |
| 22000 | 420 s | 1 |
| 17000 | 480 s | 32 (80%) |
| **17750** | **480 s** | **26 (65%), chosen; re-run after merging main 9b2e748: 26** |
| 18500 | 480 s | 20 (50%) |
| 20000 | 480 s | 14 (35%) |
| 17750, bot skill 0.7 | 480 s | 29 (73%) |
| 17750, `NOFLANK=1` (nobody goes behind him) | 480 s | **0** |

At 420 s the wins fell off a cliff between 18000 and 18500, because winning parties were finishing just before the enrage. At 480 s the curve is smooth, and the losses come from the Meltdown burn instead. A party that ignores his back never wins, so the check bites. In the first three seeds, non-tank bots stood behind him for 88% of the time.

Skill 0.7 bots win a little more than skill 1. The likely cause is that lower-skill bots dodge less and so stay behind him. I haven't checked this.

Placeholder art: until visuals' `colossusRaid` lands, he uses the X1 shadow sheet `colossus`. Sound's theme `smeltery` is already on main (#315).
