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

## Boss: Nhevra, the Cold Hearth (5 600 → 4 400 health in tuning)
| Mechanic | What it does | The answer |
|---|---|---|
| **Snuff** | Every 11 s, a 2.2 s cast that can be Quenched. If it lands, every coal dims by 20%. | Quench it |
| **Snuffer Tide** | Every 24 s, 2 Snuffers come in from the dark | Kill them first: each kill gives 15% back |
| **Long Night** | Every 30 s, a 3 s cast that can't be stopped. Every hero takes 60% of max health × (1 − the warmest coal reaching them) | Keep your coal bright. In co-op, stand in the brightest coal |

Soft enrage at 200 s: the Long Night comes twice as often. Burnout (#73) still applies.

**Deferred to a later pass:**
- Phase 2: the frozen river cracks into lanes you can't cross.
- The Hearthkeeper verb set.
- A co-op check that Long Night pulls a party together.

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
