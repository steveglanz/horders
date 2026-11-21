# The raid: Grandmother Slag in the Crucible (C3, 21 Nov 2026)

The theme brief is at `/mnt/project-files/horders/design/briefs-c1-c3.md`. All the numbers are in `SLAG` in `sim/world.ts`.

**What it is.** The world boss steps out of the menu bar and into a fight. The Crucible is a group dungeon for 4 heroes (`minParty: 4`, `raid: true`) that unlocks at tier 8. A run takes about 8 minutes:
- Two opener fights (from Warden and Hounds, Glass Warden and Hounds, Sluice Crawler and Hounds) and a named fight (The Anvil Guard or Warden of the Bell).
- Then Grandmother Slag herself, for about 4 to 5 minutes.
- No hard fight, and no shadow fight after her, because she is the world boss in person.

**World boss credit.** Every hit on her is added to `shadowDamage`, and her fight time becomes `shadowTime`. That means the existing `strike_world_boss` counts it triple, the same as the shadow fight, with no server change. The server's existing cap still holds: 60 s × 600 damage, so 36 000 per hero, or 108 000 after the triple. Engineering can raise that cap for the raid later with a migration.

## The fight: three phases by health
| Phase | Health | What she does | The answer |
|---|---|---|---|
| 1, The Ladle | 100 to 66% | **Ladle Pour** every 9 s: a 2 s wind-up on her threat target, then 60 damage through dodges and shields. It leaves 2 stacks of **Ladle Burn**. Each stack burns 1% of max health a second, and each stack still on the target makes the next pour hit 30% harder. **Slaglings**: 5 adds every 18 s. | A healer's heal clears the Ladle Burn (any ally heal, or the Lumen's Purify). A Bulwark can also taunt-swap with Called Out. |
| 2, The Pour | 66 to 33% | **The Pour** every 6 s: three molten lanes (narrow 18° cones, 620 long) from her feet, one aimed at her target, for 45 damage. **Rising slag**: every hero loses 3% of max health every 3 s. Ladle Pour slows to every 13 s. | Step out of the lanes. The healer keeps the whole party up while it moves. |
| 3, Last Ember | 33 to 0% | **Crucible Vents** every 16 s: two gold soak circles either side of her. An empty one blasts every hero. **Cinder Marks** every 14 s: the same burst as Ysmeret's Scatter Embers (`castId 'scatter'`). | Split to fill both vents, then spread. |
| Hard enrage | 420 s after she appears | **Last Ember**: a 5 s cast that can't be stopped, then 10 × max health to every hero. | Kill her first. |

Burnout backs her up at 455 s (her hard enrage, plus the cast, plus Burnout's 30 s warning), instead of the usual 360 s boss limit.

**Not built yet.** The sinking cooling islands from the brief are deferred; the Pour uses moving lanes instead. The tank swap is built (below).

## The tank swap: Seared (21 Nov 2026)
**The rule.** Ladle Pour leaves **Seared** on its target for 15 s (`SLAG.searTime`). A pour that lands on a hero who is still Seared hits 40% harder (`SLAG.searMult`). This is on top of the Ladle Burn stacks. No heal and no Purify clears Seared.
- The sear outlasts one gap between pours (9 s, then 13 s from phase 2), but not two (18 s).
- So two tanks who trade the boss after each pour never take a Seared pour. A lone tank takes every pour after the first Seared.
- It reuses `Player.sunderT`, the field behind Hammerdeep's Sundered. The client already draws that crack beside a hero, and netsync already carries it.

**The cue.** `World.swapCue` is true when the boss is on another tank who is Seared, and the acting hero is a fresh tank. `World.isTank(k)` means a Bulwark, or a Slagbinder in the Anvil stance.
- **In the raid, a Bulwark's `tauntCue`** no longer pulls the boss off another tank who is fresh. It waits for the swap cue. It still pulls the boss off anyone who isn't a tank.
- **Bots:**
  - The Bulwark bot follows `tauntCue`.
  - An Anvil Slagbinder's Clinker taunts, so in the raid its bot doesn't Clinker the boss while she is on another fresh tank.
- **HUD:** a "Swap tanks!" banner names the taunt ability when the cue comes up.

**Health.** On main, two-tank parties already won 27 of 30, above the raid's 70% ceiling. Seared alone didn't change that, because two tanks never take a Seared pour. So her health went from 18 000 to 22 000. The boss fight of a won run is now about 350 to 375 s, against 292 s before.

| Crucible tier 8, 30 seeds, heroes-r2 hero-t8-0 | main (18 000 health) | Seared +60%, 18 000 health | Seared +40%, 22 000 health (shipped) |
|---|---|---|---|
| Bulwark, Lumen, Duskblade, Emberwright (one tank) | 20 | 11 | 13 |
| Bulwark, Lumen, Anvil Slagbinder, Emberwright | 27 | 25 | 18 |
| Bulwark, Lumen, Bulwark, Emberwright | 27 | 28 | 25 |
| Anvil Slagbinder, Lumen, Duskblade, Emberwright (one tank) | 5 | 2 | 1 |

The Slagbinder plays the Duskblade's hero files, as in docs/skills.md. These other settings were also measured, as one-tank and Bulwark-plus-Anvil wins:
- Seared +60% at 20 000 health: 9 and 25.
- Seared +40% at 20 000 health: 13 and 22.
- Seared +60% at 23 000 health: 4 and 18.
- Seared +40% at 23 000 health: 9 and 18.

`TUNE=SLAG.searMult=0.4,ENEMIES.grandmotherSlag.hp=22000` in `tools/group.ts` overrides any number for one run.

**Watch items:**
- Two Bulwarks still win 25 of 30 (83%). Their combined tankiness carries the raid, and that's a skills question.
- An Anvil Slagbinder as the only tank wins 1 of 30. That fits its role as an off-tank, which design ruled on for #127.
- With 30 seeds, a cell moves by about ±4.

**Names.** Cast names: `Ladle Pour`, `The Pour`, `Crucible Vents`, `Cinder Marks`, `Last Ember`. Kinds: `grandmotherSlag` and `slagling`. Dungeon id: `crucible`.
- The client plays `audio.theme('raid')` for it.
- It uses visuals' `slagCroneRaid` texture, or `slagCrone` if that is missing.
- A slagling uses the ashling sprite until it has its own.
- Sound already has `Ladle Pour` and `Cinder Marks` cues and a raid phase sting for each phase.
- `ladlePourTarget` names the hero the pour will land on, for a wind-up marker.

## Bots
No new bot logic was needed:
- The healer bots already heal and Purify the Ladle Burn.
- The soak split (`soakFor`) works for any pair of soak circles.
- The spread keys on `castId 'scatter'`.

## Tuning
All runs use `tools/group.ts` with the skills team's heroes-r2 `hero-t8-0` for every hero, and 30 seeds, on main 0e857be plus this PR.

| Party (tier 8) | Wins | Average boss fight |
|---|---|---|
| Bulwark, Lumen, Duskblade, Emberwright | 20/30 (67%) | 282 s |
| The same, without splitting for vents (NOSPLIT=1) | 0/30 | 236 s |
| The same, without spreading for marks (NOSPREAD=1) | 8/30 | 280 s |
| The full party at tier 9 | 11/30 | 273 s |

A won run takes 474 s on average, so about 8 minutes. On 12 seeds:
- No healer (Bulwark, Emberwright, Duskblade, Emberwright) won 0 of 12. The tank died to Ladle Pour with the burn stacked.
- No tank (Lumen, Emberwright, Duskblade, Emberwright) won 1 of 12.

**How the numbers got here.** The first pass gave her 9 000 health. The full party won 6 of 6, with boss fights of 150 to 180 s, which was too short for a raid. At 18 000 health, the boss fight lands at about 280 s and every check matters. The tank swap raised it to 22 000 (below).

**Watch items:**
- Bots play with perfect timing, so real parties will likely do worse. The full party's 67% is the top of what the raid should allow.
- If players stall in phase 2, the first lever is Rising slag (3%).

`tools/hashcheck.ts` is identical to main: the solo dungeons don't change.
