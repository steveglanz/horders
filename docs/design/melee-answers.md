# Melee answers on every boss attack

*Classes, 27 Nov 2026. Pillar 2 (read it, answer it). Roadmap CP4 and vision section 6 item 6: every boss attack has a
safe spot within melee reach (under her, behind her, a gap in a ring) or can be rolled through, and cones and pulls show
for at least 0.8 s. A boss never hurts by touch: standing in reach is melee's job, so a touch is a blow with no answer.*

One boss per PR. Each row: the attack, its warning, the melee answer, and the status.

## The Kiln Mother (the Kiln Depths): done in CP3

Remade in PR #900 (docs/design/kiln-mother.md, "Melee answers"). No touch damage; Swipe, Kiln Draw and Kiln Brand all
have a spot in reach; the Ripple's rings have gaps and a 1 s wind-up.

## Dowager Bellows (Maelra, the Drowned Foundry): this PR

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

## Still to audit (one PR each)

- The Glass Heir (Lensmother, the Glarewell)
- The Banked Queen (Nhevra, the Coldmarrow)
- Aunt Ebb (Hessa, the Wrackline)
- The Iron Uncle (Ondrel, the Hammerdeep) and the other group and raid bosses after the launch places
