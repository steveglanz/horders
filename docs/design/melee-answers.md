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

## The Glass Heir (Lensmother, the Glarewell): done (PR #912)

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

## The Banked Queen (Nhevra, the Coldmarrow): done (PR #914)

| Attack | Warning | Melee answer | Status |
|---|---|---|---|
| Touch (20 x tier, every 0.6 s against her) | none | none: it only ever hit melee (Cutwick 20%, Bulwark 9% max hp a run, ranged 1-4%) | **removed** |
| Long Night (every 30 s, 40 s in phase 2, halved when late), hits for 60% max hp x (1 - warmth) | 3 s blue cast, not stoppable | keep your coal bright (kill frost-touched foes and Snuffers, hit named foes); where you stand doesn't matter, so melee loses nothing by staying in reach | unchanged |
| Snuff (every 11 s), every coal dims 0.2 | 2.2 s blue cast, Quenchable | Kick (Bulwark, Cutwick, Emberwright); no damage | unchanged |
| Snuffer Tide (every 24 s), 2 Snuffers from the room's edge | always visible | kill them as they come (a kill gives the light back) | unchanged |
| Thin Ice (phase 2 base version), 2 cracks 260 apart centred on her | 2.5 s | stay in her strip: it is 180 px wide round her and she holds still while it is cracked, and she takes 25% more while it is open | unchanged (already a melee answer) |
| Emberdrift (phase 2 version), coals drain 2.5x, 3 embers on a 280 px ring | always visible | step out for an ember when your coal is low, then back | unchanged (every class walks for them) |
| Creeping Rime (phase 2 version), r85 patch, held 85 px off her edge, creeps round her toward the nearest hero at 48 px/s | always visible | step round her to the far side: it turns round her at about 0.4 rad/s, a hero at melee reach (128-152 px/s at about 80 px) 1.6 or more | unchanged |

Measured (scratch copy of tools/matrix.ts's run with damage by cause, Coldmarrow 10, tools/heroes/matrix hero-t10 n=0,
average skill reactBot(0.3, 1, forget 0.2, stepErr 0.5), Halls, client Omens, seeds 1-20, main vs this PR):

| Class | Wins main | Wins PR | Boss damage taken, % max hp per run (main / PR) |
|---|---|---|---|
| Cutwick | 18 | 19 | 91 / 73 (touch 20 / 0; Long Night 44 / 46) |
| Bulwark | 20 | 20 | 40 / 31 (touch 9 / 0) |
| Emberwright | 18 | 18 | 53 / 49 (touch 4 / 0) |
| Lumen | 17 | 18 | 120 / 109 (touch 14 / 0) |
| Slagbinder | 19 | 19 | 16 / 14 (touch 1 / 0) |

Boss-fight medians did not move (Cutwick 94 s, Bulwark 84 s, Emberwright 58 s, Lumen 98 s, Slagbinder 28 s). Merge gate
(CHECK=1, Coldmarrow, seeds 1-6): pass. The "red marks on the floor" in her fight (Cutwick 13-15% a run) are not hers:
in 6 Cutwick runs every unowned mark came from the Omens (Volatile Ground r70, Kindled Dead r90). Her casts start no
red marks, so the Quickened owner bug from #912 can't happen here. Lumen's extra cost is the cold itself (Frozen 17%,
Snuffers 18%), a coal question, not a melee one.

## Aunt Ebb (Hessa, the Wrackline): done (PR #915)

She never moves and has no blows of her own: everything she does runs on the Wrackline's clock (`wrackClock`).

| Attack | Warning | Melee answer | Status |
|---|---|---|---|
| Touch (9 x tier, every 0.6 s against her) | none | none: it only ever hit melee (Bulwark 7%, Cutwick 4%, Lumen 6% max hp a run, Emberwright and Slagbinder 1%) | **removed** |
| The Ebb (every 14 s, 7 s after 240 s): 4 s pull to the drain, 4% max hp/s off a raft, plus 10% max hp/s inside 90 of her | 3 s, banner and lit raft rims | ride the inner raft: its ring (125) passes over her edge, so melee keeps hitting her through it (docs/design/wrackline.md) | unchanged |
| The Outsurge / the Whirl (phase 2 versions) | the same 3 s | the same: be on a raft | unchanged |
| Sink (every 9 s), the afloat raft nearest you goes under for 12 s | 2.2 s blue cast and a circle on the raft, Quenchable | Kick (Bulwark, Cutwick, Emberwright), or pick another raft; no damage | unchanged. Its circle does no damage, so the Quickened owner bug from #912 can't hurt here |
| Call the Shoal (every 28 s), 1 Shoal Lurker | always visible | kill it, or stand mid-raft (Lurkers can't board) | unchanged |

Measured (scratch copy of tools/matrix.ts's run with damage by cause, Wrackline 13, tools/heroes/matrix hero-t13 n=0,
average skill reactBot(0.3, 1, forget 0.2, stepErr 0.5), Halls, client Omens, seeds 1-20, main vs this PR):

| Class | Wins main | Wins PR | Boss damage taken, % max hp per run (main / PR) |
|---|---|---|---|
| Cutwick | 18 | 18 | 34 / 30 (touch 4 / 0) |
| Bulwark | 20 | 20 | 38 / 32 (touch 7 / 0) |
| Emberwright | 20 | 20 | 15 / 15 (touch 1 / 0) |
| Lumen | 20 | 20 | 42 / 32 (touch 6 / 0) |
| Slagbinder | 20 | 20 | 5 / 4 (touch 1 / 0) |

Boss-fight medians did not move (Cutwick 121 s, Bulwark 156 s, Emberwright 61 s, Lumen 114 s, Slagbinder 31 s). Merge
gate (CHECK=1, Wrackline, seeds 1-6): pass. Cutwick's 2 losses are both before the boss. The "red marks on the floor"
in her fight are all Omens (Volatile Ground r70, Kindled Dead r90; 6 Cutwick runs).

Still uneven: melee takes more of the Tide (Cutwick 13%, Bulwark 11% a run against 3-5% for the Emberwright and
Slagbinder), because its fights run 2-5x longer and it has to stand near the drain to hit her. That is the fight-length
gap #911 and #913 found, not a missing answer.

## The Iron Uncle (Ondrel, the Hammerdeep, group): done (PR #917)

A party fight: his blows land on the hero he is beating (his target, the tank in a normal party), and the party stands
round him. Melee damage dealers stand behind him, out of the Hammer Sweep.

| Attack | Warning | Melee answer | Status |
|---|---|---|---|
| Touch (16 x tier, every 0.6 s against his target) | none | none | **removed** (it landed on whoever he was beating; under 1% max hp a run at tier 4) |
| Slag Grip (every 2.5 s, his target within 30 px of his edge: 16 x tier and a burn stack, up to 5) | none | the tank's blow by design: the healer clears it (his tip: "healer clears Slag Grip") | unchanged: it only lands on his target, so melee behind him never takes it |
| Hammer Sweep, cone 230 px, 70 deg, at his target, every 5 s | 1.1 s | stand behind him; a Bulwark can parry it | **now his through the hit**: the cast ended as the cone landed, so some cones lost their owner (with or without Quickened) (no parry, loss screen said "red marks on the floor") |
| Anvilfall (every 12 s, 7 s late), 160 x tier on the target picked at wind-up, through dodges and shields | 2.5 s cast, not stoppable | the tank's job (a cooldown or a taunt swap when Sundered) | unchanged |
| Choir of Iron / Ironload / Homeward Hammer (his version, every 10 s) | 1.5 s cast | Choir: the healer's job, where you stand doesn't matter. Ironload: stand with the marked hero. Homeward: step out of the circle and off its line home | unchanged; the Homeward line home now stays his when another cast ends before it lands |
| Slag (stage 2, under the tank's Anvilfall spot, r80) and its bursts (stage 3, r110) | always visible; bursts 2.5 s | step off the patch; the bursts stay red marks for 2.5 s | the bursts **now stay his**: any cast ending in those 2.5 s used to disown them |

Why every mark stays his: none of his casts can be stopped (all are started not interruptible), so the "let it land"
disowning in finishCast only ever cost the owner, never saved a mark from an interrupt. Only his death clears them.

Measured (scratch copy of tools/matrix.ts's party run with boss damage by cause and hero, Hammerdeep 4, tools/heroes/matrix
hero-t4 n=0, average skill, Halls, client Omens, party = the class plus the standard fill, seeds 1-20, main vs this PR):

| Class (with fill) | Wins main / PR | Boss median s | Unowned marks in his fight, % max hp a run summed over the party (main / PR) |
|---|---|---|---|
| Cutwick | 20 / 20 | 22 / 22 | 3 / 0 |
| Bulwark | 20 / 20 | 18 / 18 | 4 / 0 |
| Emberwright | 20 / 20 | 21 / 21 | 2 / 0 |
| Lumen | 20 / 20 | 19 / 19 | 3 / 0 |
| Slagbinder | 20 / 20 | 17 / 17 | 0 / 0 |

Tier 4 is saturated (every class 40/40 in the baseline matrix), so this PR changes readability (his marks are named and
parryable) rather than wins. Merge gate (CHECK=1 PLACES=hammerdeep): pass.

## Cousin Fork (Ysmeret, the Ashvents, group): this PR

A party fight: the tank holds her in front, melee stands at her back edge, and the party spreads for Scatter Embers.
At half health she splits into two leashed flames 420 px apart that share one health.

| Attack | Warning | Melee answer | Status |
|---|---|---|---|
| Touch (15 x tier, every 0.6 s, whoever is in reach; stage 2: each flame) | none | none | **removed** (both stages; it landed on the tank and on melee at her edge: Bulwark 5-15%, Cutwick 5-10% max hp a run) |
| Bellow Slam (every 9 s, waits while vents are open; stage 2 every 12 s from the flame on the tank), 90 x tier on the hero picked at wind-up, through dodges and shields | 1.5 s cast | the tank's blow by design (the healer heals it) | unchanged: it only lands on her target |
| Scatter Embers (every 14 s, each flame on its own timer in stage 2): a burst r80 under every hero, 12% max hp to that hero and 35% to each other hero inside it | 2.5 s cast | spread: the tank in front and melee at her back edge are already over 80 px apart (her radius 42 x 2 plus the heroes'); melee that crowds the tank steps out for the cast | unchanged (owned by her, named on a loss) |
| Twin / Rolling / Wandering Vents: gold soak circles 220 px out (r55); an empty one blasts every hero for 70 x tier | 4 s fuse (Rolling 3.4 s each) | anyone soaks; a melee hero leaves her for 4 s or the ranged soak | unchanged (owner -2 on purpose: no interrupt removes them, and a loss says "an empty gold circle") |
| A lone flame (stage 2: no hero within 150 px for 3 s), 70 x tier to every hero | the flame's spot is fixed | stand at a flame: melee's natural spot | unchanged |

Her marks never go through finishCast's disowning: the vents are owner -2, and Scatter and Bellow Slam hit at the cast
end with her as the source. The "red marks on the floor" in her fight are Omens (Volatile Ground r70, traced to the
dungeon's Omen code on 4 seeds), not hers.

Measured (scratch copy of tools/matrix.ts's party run with boss damage by cause and hero, tools/heroes/matrix heroes,
average skill, Halls, client Omens, party = the class plus the standard fill, seeds 1-20, main vs this PR):

| Class (with fill) | Ashvents 7 (hero-t6) wins / boss median s, main / PR | Ashvents 10 (hero-t10) wins / boss median s, main / PR | Touch, % max hp a run on main (now 0) |
|---|---|---|---|
| Cutwick | 20 / 20, 57 / 58 | 20 / 20, 71 / 71 | Bulwark 10-11 |
| Bulwark | 20 / 20, 58 / 59 | 20 / 20, 68 / 66 | Bulwark 14-15, Cutwick 5-7 |
| Emberwright | 20 / 20, 62 / 61 | 20 / 20, 71 / 72 | Bulwark 8-10, Cutwick 6-10, Emberwright 1-2 |
| Lumen | 20 / 20, 58 / 58 | 20 / 20, 65 / 66 | Bulwark 10-11, Cutwick 5-7, Lumen 1 |
| Slagbinder | 20 / 20, 49 / 49 | 20 / 20, 58 / 58 | Bulwark 5-6 |

Both tiers are saturated, so this PR changes what melee and the tank take (no unwarned damage left in her fight), not
wins. The Ashvents are not in the bot matrix, so the merge gate does not cover this place. YSMERETV2.melee (the flames'
touch multiplier) is gone with the touch.

## Still to audit (one PR each)

- Cousin Stamp (Oskel, the Pressworks), then the four raid bosses (Grandmother
  Slag, Uncle Glut, the Colossus, the Furnace Regent)
