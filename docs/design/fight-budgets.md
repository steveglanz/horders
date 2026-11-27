# Fight budgets (1.0, Checkpoint 1)

*Design, 27 Nov 2026. Pillar 3: short, fair, and it always pays. Numbers from [roadmap.md](roadmap.md) (pillars table) and [vision/vision.md](vision/vision.md) sections 2 and 6. The merge gate that enforces them is engineering's `tools/matrix.ts` with its baseline `tools/matrix-baseline.json` (engineering thread "Add fight-budget and quality gates", PR pending on 27 Nov). **Where this page and the gate's code differ, the code is the source of truth for thresholds; fix this page.***

## The budgets

| What | Budget (at average skill) | How it's measured | Gated per PR? |
|---|---|---|---|
| **Trash pack** | 15-30 s | Median over every cleared pack in Halls rooms A, B and the side room | Ceiling only (30 s) |
| **Named fight** (named foe, hard fight, door guard, named gate) | 30-45 s | Median over Halls roles C, D, E and any named gate | Ceiling only (45 s) |
| **Boss** | 60-90 s | Median of boss spawn to kill, **won runs only** | Ceiling only (90 s) |
| **Boss stage** | 20-30 s each | Read from the boss's stage log | No (design reviews it per boss remake) |
| **Delve** | 6-8 min | Run start to end screen, won runs | No (nightly report) |
| **Quick Delve** | 3-5 min (about 4) | Same | No (from CP6) |
| **Fairness floor** | No class below 0.6x the best class's win rate, per place | Win rate per class per place | Yes |
| **Warning time** | Every threat telegraphed at least 0.8 s ahead | style.ts tell + the cast's wind-up | No (pillar 2 PR test) |

**Average skill** is `reactBot(0.3, 1)` with forget 0.2 and step error 0.5 (REACT=0.3 FORGET=0.2 STEPERR=0.5 in tools/balance.ts), Halls on, Omens rotating with the seed, gear heroes-r2 at the nearest file at or below the tier (none at Kiln tier 1).

**Places and tiers in the gate** (each place at its unlock tier): Kiln 1, Foundry 4, Hammerdeep 4 (party), Glarewell 7, Coldmarrow 10, Wrackline 13. Per PR: seeds 1-6, one CI job per place. Nightly: seeds 1-40, one job per class-and-place cell, report only.

**Floors are not gated.** A fight shorter than its budget is not a failure, so the tutorial Kiln Mother (19-37 s, docs/design/first-delve.md) is fine. Design reads short fights in the nightly report and decides case by case.

## The gate's rules (until each place is remade)

Today's fights are longer than the budgets (Halls runs are 8-12 min and a boss can take up to 6 min, vision section 4; the Burnout clock is 240 s per fight and 360 s per boss, sim/world.ts:58). So the gate compares against a committed baseline instead of failing everything on day one:

1. A cell inside its ceiling may not go over it.
2. A cell already over its ceiling may not get more than **10% slower**.
3. A class at or over the 0.6 floor in a place may not drop under it. A class already under may not fall by more than **0.10** more.

Baseline cells are tightened as each place is remade: the Kiln to the full budgets at **Checkpoint 3**, the other launch places at **Checkpoint 5**. A remade place is held to the plain ceilings (rule 1 only) from then on.

## The clock: Boil-over replaces Burnout

"Never lose to a clock" (pillar 3) means no hidden timer kills you. At **90 s** the boss shows **Boil-over** (rename-map section 4): it glows, says one taunt, and hits harder **every 10 s** after that (vision section 6, item 5). The player loses to the boss, and the loss screen names the blow. Burnout's trash and named-fight timers go away; packs are held to their budgets by tuning, not by a clock. Built in Checkpoint 2 (design queue item 4); the per-step damage rise is set there and measured on the Kiln.

**As built (CP2, 27 Nov; sim/world.ts `BOIL`, `boilAfter`, `fightClock`):** the Kiln Mother boils over at 90 s and hits +20% harder every 10 s after (x1.2 at 100 s, x1.4 at 110 s, and so on); her own enrage at 150 s stays as it was. The boss plate counts down the last 30 s ("Boils over in N s"), then reads "Boil-over xN"; a banner says her one line. The other bosses boil over at their old enrage time until their places are remade (Checkpoint 5). Trash and named fights have no clock that hurts the hero: past 240 s (named +60 s) a quiet stall breaker wears the foes down instead, so a stuck bot or a kiting player still finishes the fight. The boss glow is not built yet (grey box: banner, plate and sound).

## Steve's earlier pacing call

Steve (25 Nov 16:21Z): standard packs die fast, drop less, come denser; elites and rares up to about 1 min is OK; bosses 1+ min is OK. The budgets above sit inside that (named 30-45 s is under his 1 min, boss 60-90 s is his "1+ min"). If cold testers at Checkpoint 2 find named fights too short to read, the named ceiling can rise toward 60 s without breaking his call.

## How to read a miss

A miss on 6 seeds is a flag, not a verdict (40 seeds swing about plus or minus 5 wins; design brief, "How to measure"). Before acting on a cell, rerun it with 20-40 seeds. Check the door state too (level, talent ranks, hp on reaching the boss), because past gaps came from chests and ranks at the door, not the fight.
