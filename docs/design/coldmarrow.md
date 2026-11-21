# The Coldmarrow (C1, fourth solo dungeon, 21 Nov 2026)

The theme brief is at `/mnt/project-files/horders/design/briefs-c1-c3.md`.

**Setting:** the deep under the Kiln, where the fires went out. It unlocks at tier 10 and is solo friendly. The daily bounty doesn't use it, because `BOUNTY_DUNGEON_IDS` keeps the bounty on the first three dungeons so past and future days don't reshuffle.

## The verb: keep the flame
Each hero carries a **Hearthcoal**. The fields are `Player.coal` (0 to 1), `coalR` (the light radius) and `chill`. All the numbers are in `COLD` in `sim/world.ts`.

- **The coal burns down.** It starts full in every fight and loses 1% a second. Its light shrinks from 170 units to 70 as it dims.
- **Kills feed it.** A frost-touched kill adds 7%. Killing a Snuffer adds 15%, because it carries stolen light.
- **Snuffers drain it.** A Snuffer's touch takes 15%.
- **Chill builds once the coal is out:** one stack every 1.5 s. Each stack slows you 10%. At 5 stacks you're frozen and lose 4% of max health a second.
- **Frost Wardens** take ×1.4 damage inside a coal's light and ×0.4 outside it. Ranged heroes have to bring them in close.
- **Hoarfrost Weaver** casts Frost Lace, a ring at your feet that can be Quenched. If it lands, you take a hit and 2 Chill stacks.

How it differs from the Glarewell: there you hide in fixed shade. Here you carry your own safety and keep it alive.

## Boss: Nhevra, the Cold Hearth (5 600 → 4 400 → 3 400 health in tuning)
| Mechanic | What it does | The answer |
|---|---|---|
| **Snuff** | Every 11 s, a 2.2 s cast that can be Quenched. If it lands, every coal dims by 20%. | Quench it |
| **Snuffer Tide** | Every 24 s, 2 Snuffers come in from the dark | Kill them first: each kill gives 15% back |
| **Long Night** | Every 30 s, a 3 s cast that can't be stopped. Every hero takes 60% of max health × (1 − the warmest coal reaching them) | Keep your coal bright. In co-op, stand in the brightest coal |

Soft enrage at 200 s: the Long Night comes twice as often. Burnout (#73) still applies.

**Deferred to a later pass:**
- Phase 2: the frozen river cracks into lanes you can't cross.
- A co-op check that Long Night pulls a party together.

## The Hearthkeeper set (21 Nov 2026)
Nhevra's head, hands and trinket drops can be Hearthkeeper pieces, the same way the other solo bosses drop their sets (`withSet`, 60% of set-slot drops, never in bounties). The verb is **keep the flame**: keep killing to stay warm. All numbers are in `SET_TUNING` (`hk*`) in `sim/content/sets.ts`.

- **2 pieces:** each kill adds a Warmth, up to 5. Each one gives +2% damage. Without a kill, one fades every 2 s. In the Coldmarrow, kills also feed your Hearthcoal 50% more.
- **3 pieces:** at 5 Warmth you take 8% less damage.

Like the other sets, it works in every dungeon. It is strongest in horde fights and weakest against a lone boss, which is the opposite of the Kilnbreaker.

**Measured** with `SET=hearthkeeper` in `tools/foundry.ts`, heroes-r2 hero-t8-0, Coldmarrow tier 10, seeds 1 to 80, on main 7c1c369 or later (with #124). Wins out of 80, full set against none:

| | Emberwright | Duskblade | Bulwark | Lumen |
|---|---|---|---|---|
| No set | 57 | 54 | 61 | 51 |
| Hearthkeeper (3) | 67 | 56 | 68 | 59 |

That is +1 to +5 wins in 40, inside the range the other sets give (2 to 7 in 40, balance.md). The no-set seeds 1 to 40 match the skills team's L7 table (26, 28, 25, 26).

## Bots
A ranged bot moves close enough to a Frost Warden that the warden's body is inside its coal's light. The bots already Quench Snuff and Frost Lace through the existing interrupt logic.

## Tuning
All runs use tools/foundry.ts with the skills team's heroes-r2 hero-t8-0 and 40 seeds, on main cac46fb plus this PR.

| Class | Tier 9 | Tier 10 |
|---|---|---|
| Emberwright | 29/40 (73%), boss 138 s | 26/40, boss 163 s |
| Duskblade | 27/40 (68%), boss 146 s | 25/40, boss 183 s |
| Bulwark | 34/40 (85%), boss 142 s | 20/40, boss 156 s |
| Lumen | 20/40 (50%), boss 140 s | 12/40, boss 134 s |

Tier 9 plays the role here that tier 7 with hero-t6 plays for the Glarewell: the unlock tier measured with the best hero below it. There are no tier-10 heroes yet.

**How the numbers got here:**
- The first pass lost every run.
  - Openers ran past the coal's 83 s life, because Frost Wardens with 1 500 health take only 40% damage outside the light.
  - The boss fight piled up Snuffers.
- Fixes for the trash:
  - Lower trash health: Rimehound 260, Snuffer 200, Frost Warden 700, Hoarfrost Weaver 700.
  - A slower drain: from 1.2% a second to 1%.
  - A wider minimum light radius: 70 instead of 50.
  - Warmth now reaches a Warden's body, not only its centre.
  - The ranged bot now pulls in.
- After those fixes, the trash was on target, with 24 of 24 runs reaching the boss. The boss still won every time.
- A damage tally showed the Long Night did 3 373 of 3 462 boss-fight damage. The coal only ever went down, because Snuffers were the only thing to feed it.
- Fixes for the boss:
  - A Snuffer kill now feeds 15%.
  - Snuff cut from 25% to 20%.
  - The Tide cut from 3 Snuffers every 20 s to 2 every 24 s.
  - Long Night cut from 70% to 60%.
  - Nhevra's health cut from 5 600 to 4 400.

**Watch items:**
- The Lumen trails the Bulwark by 35 points at tier 9, which is wider than the ±15 target. The Lumen's long solo boss fights are already on the skills team's C5 watch list.
- Boss fights run 134 to 183 s, against the 45 to 120 s target.
- The bots never seek out kills to feed the coal, so a human who does should do better.

`tools/hashcheck.ts` is identical to main. The solo path only changes inside the Coldmarrow.

## Retune: shorter boss fights (21 Nov 2026, later)
On main aeed845, which includes the skills team's second capstones (#86 and #107), Nhevra's fights still ran 135 to 171 s, against the 45 to 120 s target. Her health is now 3 400, down from 4 400. These runs use tools/foundry.ts with heroes-r2 hero-t8-0 and 40 seeds.

| Class | Tier 9 before | Tier 9 after | Tier 10 before | Tier 10 after |
|---|---|---|---|---|
| Emberwright | 30/40, boss 137 s | 34/40, boss 108 s | 24/40, boss 152 s | 26/40, boss 124 s |
| Duskblade | 26/40, 135 s | 28/40, 108 s | 24/40, 171 s | 28/40, 140 s |
| Bulwark | 34/40, 144 s | 36/40, 113 s | 22/40, 156 s | 25/40, 132 s |
| Lumen | 19/40, 143 s | 28/40, 121 s | 12/40, 140 s | 15/40, 123 s |

**What it did:**
- Tier 9 boss fights are now inside the target, and tier 10 fights are close.
- At tier 9, the Lumen's gap to the best class closed from 15 wins to 8.
- At tier 10, the Lumen is still 13 wins behind the Duskblade. That gap is on the skills team's L7 list.
