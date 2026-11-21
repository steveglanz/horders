# Named elites (C2, 21 Nov 2026)

**What it is.** About half of all delves hide one named elite in a fight before the boss. It is one of that fight's own elites, promoted: it gets a name, an affix, double health and its own loot. A banner and a chime announce it, and its plate and target frame show the name in the Rare colour. It gives a run a "something special is here" moment without adding a new fight.

All the numbers are in `NAMED` in `sim/content/named.ts`.

## The rules
- **Which delves:** a roll on its own random stream, seeded from the delve's seed (`seed ^ 0x6e616d65`). The delve's other rolls don't move, and the same seed always gives the same named elite.
- **Which fight:** any fight before the boss. If that fight has no elite (a shrine, say), the next fight before the boss gets it. If none is left, the delve has none.
- **Which foe:** the first elite that fight spawns.
- **Health:** ×2 its already-scaled health.
- **Loot:** one item, Rare, or Epic 25% of the time, on top of the normal drops.
- **Not in stress runs:** `rollNamed` skips stress worlds and routes shorter than two fights. The daily bounty can have one.

| Affix | What it does | The answer |
|---|---|---|
| Swift | Moves ×1.45 | Kill it fast, or kite wider |
| Warded | A shield worth 35% of its max health | Burst through the shield |
| Vengeful | When it dies, a 110-unit circle lands where it fell 1.2 s later, for 32 damage | Step out after the kill |

**Names.** Twelve original titles: Old Scald, Ashjaw, Brindlecoat, Cinderveil, Grist, Hollowmark, Morrowfang, Quell, Sablehide, Tinderback, Vesk, Wickmother. They show as "Title, Kind", for example "Tinderback, Cinder Brute". I ran two web searches on 21 Nov 2026 for these titles together with "game". Neither turned up a game using any of them. That is a search check, not a legal clearance.

## Events, for visuals and sound
- `namedSpawn {index, name, affix}` when it joins a fight.
- `namedKill {x, y, name}` when it falls.

The client already shows a banner and plays a ding. Visuals and sound can replace them with their own.

## Tuning
All runs use `tools/foundry.ts` with 60 seeds.

The first pass gave it ×2.5 health. Measured on the Foundry at tier 6 with the skills team's `hero-t6-0`, Ember lost 5 wins and Lumen lost 5 against main. Cutting it to ×2 gave these results:

| Class | Main | With named elites |
|---|---|---|
| Emberwright | 55/60 | 51/60 |
| Lumen | 49/60 | 45/60 |
| Duskblade | 54/60 | 53/60 |
| Bulwark | 54/60 | 51/60 |

At tier 3 with a fresh hero, the changes are mixed in sign and within run-to-run noise:

| Class | Kiln, main → named | Foundry, main → named |
|---|---|---|
| Emberwright | 34 → 40 | 37 → 34 |
| Lumen | 59 → 58 | 52 → 56 |
| Duskblade | 46 → 43 | 52 → 52 |

**Watch item:** a Swift Cinder Brute in an early fight can run down an Emberwright. In `tools/hashcheck.ts`, seed 1 on the Foundry ends at 138 s. That doesn't show in the 60-seed totals. If players report it, the first lever is to keep Swift off the slowest elites.

`tools/hashcheck.ts` changes for every seed that rolls a named elite, as expected: seed 1 differs, and seeds 2 and 3 are identical to main.
