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

**Not built yet.** These are deferred from the brief:
- The sinking cooling islands. The Pour uses moving lanes instead.
- A tank swap that is *required*. Today a heal clears the burn, so one tank is enough.

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

**How the numbers got here.** The first pass gave her 9 000 health. The full party won 6 of 6, with boss fights of 150 to 180 s, which was too short for a raid. At 18 000 health, the boss fight lands at about 280 s and every check matters.

**Watch items:**
- Bots play with perfect timing, so real parties will likely do worse. The full party's 67% is the top of what the raid should allow.
- If players stall in phase 2, the first lever is Rising slag (3%).

`tools/hashcheck.ts` is identical to main: the solo dungeons don't change.
