# Melee answers on every boss attack

*Classes, 27 Nov 2026. Pillar 2 (read it, answer it). Roadmap CP4 and vision section 6 item 6: every boss attack has a
safe spot within melee reach (under her, behind her, a gap in a ring) or can be rolled through, and cones and pulls show
for at least 0.8 s. A boss never hurts by touch: standing in reach is melee's job, so a touch is a blow with no answer.*

One boss per PR. Each row: the attack, its warning, the melee answer, and the status.

## The Kiln Mother (the Kiln Depths): done in CP3

Remade in PR #900 (docs/design/kiln-mother.md, "Melee answers"). No touch damage; Swipe, Kiln Draw and Kiln Brand all
have a spot in reach; the Ripple's rings have gaps and a 1 s wind-up.

## Dowager Bellows (Maelra, the Drowned Foundry): done (PR #911)

| Attack | Warning | Melee answer | Status |
|---|---|---|---|
| Touch (24 x tier, every 0.6 s against her) | none | none: it only ever hit melee | **removed** |
| Cone, 300 px, 65 deg, toward the hero | 1.1 s | step to her side or behind her; a Bulwark can parry it | **now hers** (owner set): parryable, and the loss screen names her instead of "red marks on the floor" |
| Circle under the hero, r110 | 1.3 s | roll (120 clears 110 + half the hero) or walk round her | unchanged |
| Undertow (phase 2+), pull 60% toward her + 12 | 2.5 s blue cast | Kick (Bulwark, Cutwick); melee is already beside her, so the pull costs nothing | unchanged |
| Vent eruptions (phase 3), r65 at the three vents | 1.5 s | don't stand on a vent; she follows you off it | unchanged |
| Rising water / Sluicetide | always visible | room shrinks or drifts; no damage | unchanged |

Measured (tools/kmfight.ts made generic in a scratch copy, Foundry 7, heroes-r2 t6 n=0, average skill
REACT=0.3 FORGET=0.2 STEPERR=0.5, Halls, seeds 1-20, main vs this PR):

| Class | Wins main | Wins PR | Boss damage taken, % max hp per run (main / PR) |
|---|---|---|---|
| Cutwick | 14 | 15 | 127 / 116 |
| Bulwark | 17 | 18 | 100 / 95 |
| Emberwright | 14 | 14 | 44 / 43 |
| Lumen | 20 | 20 | 165 / 169 |
| Slagbinder | 20 | 20 | 17 / 16 |

Boss-fight medians did not move (Cutwick 166 s, Bulwark 171-173 s, Emberwright 62 s, Slagbinder 59 s).

What this shows: per minute of fight, melee and ranged now take about the same from her blows (roughly: Cutwick circle 25%/min,
Emberwright 26%/min on main). Melee's Foundry 7 gap is **not** her attacks:
- Cutwick's other losses are before the boss: the Glass Warden and its Mirror Ward (4 of 5 losses).
- Melee boss fights run about 2.7x longer than the Emberwright's or Slagbinder's (166-173 s against 59-62 s), and the
  same gap shows on the Kiln Mother at tier 7 (Cutwick 109 s, Emberwright 37 s, 8 seeds). That is class damage scaling
  with gear and tier, a fight-budget question for the classes queue, not a melee-answer one.

## The Glass Heir (Lensmother, the Glarewell): this PR

| Attack | Warning | Melee answer | Status |
|---|---|---|---|
| Touch (22 x tier, every 0.6 s against her) | none | none: it only ever hit melee (10-13% max hp a run for Cutwick and Bulwark, 1-2% for ranged) | **removed** |
| Lens Sweep, cone 300 px, 60 deg, toward the hero, every 2.4 s | 1.1 s | step to her side or behind her (about 45 px at melee reach); a Bulwark can parry it | **now hers through the hit**: with the Quickened omen her cast bar ended before the cone landed, so the cone lost its owner (no parry, loss screen said "red marks on the floor") |
| Glare (hide in a pillar's shade) | 2.6 s blue cast, not stoppable | leave her for the nearest shade, then come back; she follows at walking pace | unchanged; see "Open" |
| Twin Brand (phase 2+, two 4 s Brands that burst on the carrier, r110) | 0.8 s cast, then 4 s | carry it a step out of her reach (a burst within 110 of her heals her 10%); a roll covers most of it | unchanged (the dungeon's lesson, "burst Brands in the open") |
| Glintfall (variant, circles r80 on every standing pillar) | 1.8 s | step off the pillar; under her is safe unless she stands at one | unchanged |
| Pillar cracks (phase 3, circle on one pillar, r pillar + 40) | 2.5 s | step off that pillar | unchanged |

Measured (scratch copy of tools/matrix.ts's run with damage by cause, Glarewell 7, heroes-r2 hero-t6 n=0, average skill
reactBot(0.3, 1, forget 0.2, stepErr 0.5), Halls, client Omens, seeds 1-20, main vs this PR):

| Class | Wins main | Wins PR | Boss damage taken, % max hp per run (main / PR) |
|---|---|---|---|
| Cutwick | 12 | 12 | 92 / 80 (touch 13 / 0; Lens Sweep 17 + 12 unowned / 28) |
| Bulwark | 15 | 19 | 58 / 53 (touch 10 / 0; Lens Sweep 11 + 8 unowned / 21) |
| Emberwright | 12 | 12 | 35 / 36 |
| Lumen | 20 | 20 | 92 / 89 |
| Slagbinder | 20 | 20 | 21 / 20 |

Merge gate (CHECK=1, Glarewell, seeds 1-6): pass. Cutwick's 8 losses: 4 before the boss (Shades, Lensbearers), 2 to
the Brand, 2 to her Lens Sweep. Its boss fight still runs about 138 s against 50 s for the Slagbinder: the damage
scaling gap #911 found, not her attacks.

### Open (design call)

- **Glare has no answer inside melee reach.** Melee takes the most Glare (Cutwick 32%, Bulwark 18-20% a run, against
  12-14% for the Emberwright and Slagbinder) and walks away from her for every one. A melee answer could be her own
  shadow: the spot right behind her, away from the lens, counts as shade. It needs a drawn shadow and a new tip line, so
  it waits for design and visuals (and Steve's OK on the line). In the Carried Light version the light is at her, so
  that answer would not exist there.

## Still to audit (one PR each)

- The Banked Queen (Nhevra, the Coldmarrow)
- Aunt Ebb (Hessa, the Wrackline)
- The Iron Uncle (Ondrel, the Hammerdeep) and the other group and raid bosses after the launch places
