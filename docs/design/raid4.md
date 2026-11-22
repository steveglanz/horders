# Raid 4: the Furnace Regent in the Flue (Phase 10, B1, 22 Nov 2026, design)

**Why.** The world boss rotates through four bosses (migration 0007: Grandmother Slag, the Cinder Colossus, Old Vorhulm and the Furnace Regent). Three can now be fought in person: Grandmother Slag (the Crucible), Old Vorhulm (the Hoard) and the Cinder Colossus (the Smeltery). The Furnace Regent is the last one. Visuals already drew its shadow sheet (`regent`, client/textures.ts), and sound gave it a shadow sting (`shadowRegent`).

**Names.**
- "Furnace Regent" had no WoW match in the 21 Nov 2026 search (raid2.md).
- **The Flue** is a plain English word. A search on 22 Nov 2026 for "The Flue" with World of Warcraft found no WoW zone or dungeon of that name. "the Chimney Court" was dropped before building, because "the Ember Court" is a WoW (Venthyr) feature and "X Court" reads too close.
- Mechanic names below are plain words.

## The raid: the Flue
- 4 heroes, unlocks at **tier 11** (one after the Smeltery), `raid: true`, `worldBoss: 'The Furnace Regent'`, so its hits count triple only in its weeks (W3, #293).
- Two opener fights and a named fight from the existing pool, then the Regent. No bots (`botFillBlocker` blocks every raid).

## The fight: a new group check, "pass it on"
The Crucible tests tank swaps and soaks, the Hoard switching targets to save someone, and the Smeltery position around the boss. The Flue tests **handing a burden between heroes**: the Regent's Decree must keep moving, and no one can hold it twice in a row.

| Phase | Health | What it does | The answer |
|---|---|---|---|
| 1, Audience | 100 to 60% | **Decree** every 20 s: a burning seal lands on a non-tank hero. It deals a small burn each second, and after **8 s** it bursts for heavy party damage unless it has been passed on. A hero passes it by touching another hero (within 50 px). The hero who passed it can't take it back for 6 s (**Spent**; 10 s in the first draft, see Status). **Bellow** every 9 s: a tank hit. | Hand the Decree on before 8 s, to someone who isn't Spent. |
| 2, Edict | 60 to 25% | Two Decrees at once, on different heroes. A hero holding both takes both bursts. **Ash Fall** circles every 12 s. | Pass both without stacking them on one hero. |
| 3, Abdication | 25 to 0% | The Decrees stop. **Embers of Office** pulse party-wide fire every 3 s, growing each pulse (like Meltdown, but softer), so it's a damage race. | Burn it down. |
| Hard enrage | 480 s after it appears | **Last Word**: a 5 s cast that can't be stopped, then 10× max health to every hero. | Kill it first. |

**Targets** (as for the other raids): a real party in hero-t8-0 gear wins 55 to 70%, never more than 70%, on at least 80 seeds (40 proved too noisy in the Smeltery). Tier 11 with t8 gear may be out of reach (the Hoard won 0 of 40 at t10), so B1 measures at the tier where t8 gear can win and records it, or asks skills for hero-t10 files.

**Bots** (sims only): the Decree holder walks to the nearest hero who isn't Spent and isn't already holding one, as soon as it lands; the tank never gets one from the Regent, but can take one passed by hand (see Status). With `NOPASS=1` nobody passes, and the party should win 0.

## Built on
- `regentDecree: {hero, t, passes, held}[]` and per-hero `spentT` on Player. The array goes in netsync ARRAYS (the #316 test enforces it).
- Events `decree`, `decreePassed`, `decreeBurst`; casts `lastWord`.
- Achievement **Sealbreaker** (boss:flue), searched before building.
- The verb set for the Flue (after Phase 9's pattern): **Handover**, "Pass it on". Searched before building.

## For other teams
- Visuals (B2): the Regent in person at raid scale (from the `regent` shadow sheet), the Decree seal over a hero's head with an 8 s ring, the Spent mark, the Flue's floor and hub card, set icon.
- Sound (B3): a `flue` theme, and cues for a Decree landing on you, a pass, a burst, Spent ending, and the phase stings.
- Mobile (B4): the Decree timer and Spent mark must read at 360 px wide under the party frames.
- QA (B5): coopsweep with a guest dropping while holding a Decree (the holder index must not point at a hero who left).

## Status
Built in the B1 PR (22 Nov 2026). Tuning is in `REGENT` (sim/world.ts) and `ENEMIES.regent` (sim/content/enemies.ts, hp 16250). Achievement **Sealbreaker** (boss:flue). `worldBoss: 'The Furnace Regent'`. Events: `decree {hero}`, `decreePassed {from, hero, done}` (hero is the new holder; done means it faded on that pass), `decreeBurst {hero}`, `officePulse {n}`; cast `lastWord`. `World.regentDecree` is synced to guests (netsync ARRAYS) and `Player.spentT` is the Spent time left.

**Two rule changes from the brief, both from the first measurements.** With 18000 hp and the brief's rules, the base party won 0 of every set of runs at tiers 9, 10 and 11 (9 to 14 seeds each). A party has three non-tanks, so in Edict two Decrees left at most one hero free to take either, and each fight saw about 6 bursts at 35% of every hero's health.
- **A tank can take a Decree passed by hand.** The Regent still never lands one on a tank. Spent is now **6 s** (the brief said 10), so a hero can take one again before the next Decree runs out.
- **In Edict a Decree fades after one pass** (`REGENT.edictPasses`). In Audience it still takes two. On the 40 hardest seeds (41 to 80, 16000 hp) this took the base party from 19 to 27 wins, and Edict deaths from 80 to 37. A softer Ash Fall (45 to 30 damage) gave 20, and a softer holder and scorch burn (half) gave 19, so neither was kept.

**Measurements** (tools/group.ts, Bulwark, Lumen, Duskblade and Emberwright in heroes-r2 hero-t8-0 gear, tier 11, bot skill 1). Wins with the final rules:

| Regent hp | Seeds 1-40 | 41-80 | 81-120 | Total |
|---|---|---|---|---|
| 16000 | 29 | 26 | 28 | 83 of 120 (69%) |
| **16250** | **21** | **25** | **26** | **72 of 120 (60%), chosen** |
| 16500 | 19 | 22 | 24 | 65 of 120 (54%) |
| 17000 | 14 | - | - | 14 of 40 |
| 16000, `NOPASS=1` (nobody passes) | 2 | - | - | 2 of 40 |

Before the Edict change, health barely moved it: on 120 seeds, 15500 won 63 and 16000 won 61, and a 25% burst at 16000 won 64. In those runs 70% of hero deaths came in Edict.

Every standard party at 16250, seeds 1 to 40: base 21, two Duskblades 26, two Emberwrights 14, Bellows Slagbinder with an Emberwright 11, Bellows Slagbinder with a Duskblade 14, Anvil Slagbinder tank 15, and the base party at bot skill 0.7 19. So the base party and two Duskblades are in the band, and every party with less blade damage is under it (28 to 38%). A longer enrage (540 s) with more health (17250) did not flatten this: base 16, two Duskblades 15, two Emberwrights 8, Bellows with an Emberwright 4. That's a class-side follow-up for skills (B6), like Z5 for the older raids.

**Flattening the damage race (B6, 22 Nov 2026).** Skills traced the low parties (raid4 B6): it isn't the hand-off (each hero holds a Decree about 10 s a fight, and bursts were 0.3 to 0.9 a run). The fight was a steep damage race decided by Last Word: two Emberwrights deal 9% less than two Duskblades, which was worth about 12 wins of 40. Class knobs barely moved it. A softer clock made the spread wider (14000 hp, officeGrow 0.1, Last Word at 600 s, of 40: base 29, two Duskblades 36, two Emberwrights 16, Bellows with an Emberwright 15). Making the fight test survival as well as damage worked: a heavier Decree burst (35% to **50%**) and Ash Fall (45 to **70**), with less health (**15000**). Seeds 1 to 40, before and after:

| Party | 16250, burst 35%, Ash 45 | **15000, burst 50%, Ash 70 (shipped)** |
|---|---|---|
| Base (seeds 1 to 120) | 72 of 120 | **80 of 120 (67%)** (26, 28, 26) |
| Two Duskblades | 26 | 26 |
| Two Emberwrights | 14 | 28 |
| Bellows Slagbinder with an Emberwright | 11 | 18 |
| Bellows Slagbinder with a Duskblade | 14 | 26 |
| Anvil Slagbinder tank | 15 | 26 |
| `NOPASS=1` | 2 | 2 |

Only the Bellows Slagbinder beside an Emberwright is still under the band (45%), so that row stays with skills.

Tier 11 with t8 gear was in reach once the rules changed, so `unlockTier` stays 11. The verb set **Handover** came in the follow-up PR (below).

## Handover, the Flue's verb set ("pass it on")
The Regent's head, hands and trinket drops can be Handover pieces, as for the other raids (`withSet`, 60% of set-slot drops). All the numbers are in `SET_TUNING` (`ho*`, sim/content/sets.ts).
- **2 pieces:** a Decree you hold burns you, and anyone near you, 30% less (`hoCut`). The burst is not cut.
- **3 pieces:** while you are Spent after passing a Decree, you deal 8% more damage (`hoDamage`). The HUD shows a "Handover +8%" chip. It needs no new field: it reads `Player.spentT`.
- **Name:** "Handover" is a plain word. A search on 22 Nov 2026 found no WoW spell, item or achievement by that name.
- **Icon:** `SET_ICON.handover` in client/icons.ts is a placeholder from design for visuals to redraw.

**Measured** with tools/group.ts (`DUNGEON=flue SET=handover SETN=3`), base party in heroes-r2 hero-t8-0, tier 11, seeds 1 to 80, on main 60aa9fd plus this change. Wins of 80:

| No set | Control (`SET=platewalker`, a set that does nothing in the Flue) | Every hero with 3 Handover pieces |
|---|---|---|
| 46 (21, 25) | 39 (20, 19) | 48 (21, 27) |

Tagged pieces cost the control 7 wins, because a bot won't swap out a piece of an active set for a better drop (`breaksSet`). Against that control the full set adds +9 of 80, about +4.5 per 40. That's inside the 2 to 7 per 40 of the earlier sets, so it ships as it is. Skills found in the Hoard that the tag control is the fair comparison (A4).
