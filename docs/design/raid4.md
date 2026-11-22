# Raid 4: the Furnace Regent in the Flue (Phase 10, B1, 22 Nov 2026, design)

**Why.** The world boss rotates through four bosses (migration 0007: Grandmother Slag, the Cinder Colossus, Old Coalmouth and the Furnace Regent). Three can now be fought in person: Grandmother Slag (the Crucible), Old Coalmouth (the Hoard) and the Cinder Colossus (the Smeltery). The Furnace Regent is the last one. Visuals already drew its shadow sheet (`regent`, client/textures.ts), and sound gave it a shadow sting (`shadowRegent`).

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
| 1, Audience | 100 to 60% | **Decree** every 20 s: a burning seal lands on a non-tank hero. It deals a small burn each second, and after **8 s** it bursts for heavy party damage unless it has been passed on. A hero passes it by touching another hero (within 50 px). The hero who passed it can't take it back for 10 s (**Spent**). **Bellow** every 9 s: a tank hit. | Hand the Decree on before 8 s, to someone who isn't Spent. |
| 2, Edict | 60 to 25% | Two Decrees at once, on different heroes. A hero holding both takes both bursts. **Ash Fall** circles every 12 s. | Pass both without stacking them on one hero. |
| 3, Abdication | 25 to 0% | The Decrees stop. **Embers of Office** pulse party-wide fire every 3 s, growing each pulse (like Meltdown, but softer), so it's a damage race. | Burn it down. |
| Hard enrage | 480 s after it appears | **Last Word**: a 5 s cast that can't be stopped, then 10× max health to every hero. | Kill it first. |

**Targets** (as for the other raids): a real party in hero-t8-0 gear wins 55 to 70%, never more than 70%, on at least 80 seeds (40 proved too noisy in the Smeltery). Tier 11 with t8 gear may be out of reach (the Hoard won 0 of 40 at t10), so B1 measures at the tier where t8 gear can win and records it, or asks skills for hero-t10 files.

**Bots** (sims only): the Decree holder walks to the nearest hero who isn't Spent and isn't already holding one, as soon as it lands; the tank never takes it. With `NOPASS=1` nobody passes, and the party should win 0.

## Built on
- `regentDecree: {hero, t}[]` and per-hero `spentT` on Player. The array goes in netsync ARRAYS (the #316 test enforces it).
- Events `decree`, `decreePassed`, `decreeBurst`; casts `lastWord`.
- Achievement **Sealbreaker** (boss:flue), searched before building.
- The verb set for the Flue (after Phase 9's pattern): **Handover**, "Pass it on". Searched before building.

## For other teams
- Visuals (B2): the Regent in person at raid scale (from the `regent` shadow sheet), the Decree seal over a hero's head with an 8 s ring, the Spent mark, the Flue's floor and hub card, set icon.
- Sound (B3): a `flue` theme, and cues for a Decree landing on you, a pass, a burst, Spent ending, and the phase stings.
- Mobile (B4): the Decree timer and Spent mark must read at 360 px wide under the party frames.
- QA (B5): coopsweep with a guest dropping while holding a Decree (the holder index must not point at a hero who left).
