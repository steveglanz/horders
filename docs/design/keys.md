# Delver's Keys (P3, Mythic+ style, 21 Nov 2026)

**What it is.** Once a hero has unlocked tier 6, every solo dungeon has a **Delver's Key** with a level, starting at +1. A key run plays that dungeon at the hero's best beaten tier, made harder by the key level. Beat it fast and the key goes up, lose and it goes down. The ladder never ends, so strong heroes have a reason to keep coming back, and key levels give a leaderboard something to rank.

All the numbers are in `KEYS` in `sim/content/keys.ts`. The hero side is `applyKey` in `sim/hero.ts`.

## The rules
- **Tier:** `keyTier(maxTier)` is the hero's best beaten tier (one below their highest unlocked tier).
- **Omens:** `keyOmens(tier, week, level)` gives the tier's usual weekly Omens, plus one more every 2 key levels, taken in the week's Omen order (`omenOrder`), up to all five.
- **Toughness:** each key level adds 6% to enemy health and 3% to enemy damage, on top of the tier (`keyScale`, applied in `spawn` and `tierDamage`).
- **Par time:** 480 s for the whole delve.

  | Result | Key change |
  |---|---|
  | Win in 384 s or less (0.8 × par) | +2 |
  | Win inside par | +1 |
  | Win over par | stays the same |
  | Loss | −1 (never below +1) |
- **Rewards:** a key win pays 8 embers per key level, on top of the normal loot. Loot luck already grows with each Omen.
- **A side run, like the bounty:** a key run never moves the tier ladder or Grit, and it can't open a shadow fight's first-clear Epic.
- **Solo only:** key runs are for solo dungeons outside a party. Party keys need the host and guests to agree on a level, so they wait for the leaderboard work.
- **Per class:** `keys` and `keyBest` (the best level beaten in each dungeon) are stored per class, in `CHARACTER_KEYS`, because they measure that hero's power.

**Hub:**
- In tab mode, a "Key +N" chip for the picked dungeon opens a sheet. It shows the level, tier, Omen count, extra health, par time and best level, plus a "Use the key" button.
- In full mode, the same box sits under the bounty.
- The end screen says "Delver's Key +a → +b" and lists the embers.
- "Delve again" repeats a key run.

## Tuning
All runs use `tools/keys.ts` with the skills team's heroes-r2 `hero-t8-0` (best beaten tier 7), on the Kiln, 20 seeds each, in week 2900.

| Key | Omens | Emberwright | Duskblade | Bulwark | Lumen |
|---|---|---|---|---|---|
| none (plain tier 7) | 2 | 12 wins, 11 inside par | 16, 16 | 16, 16 | 13, 11 |
| +1 | 2 | 8, 6 | 11, 11 | 13, 12 | 9, 6 |
| +2 | 3 | 11, 9 | 9, 9 | 8, 5 | 5, 2 |
| +4 | 4 | 2, 1 | 5, 4 | 3, 3 | 2, 0 |
| +6 | 5 | 3, 1 | 1, 1 | 2, 0 | 1, 0 |

A tier-8 hero's key settles around +2 to +3, and that wall rises as the hero gears up.

**How the numbers got here.** The first pass added an Omen at every key level, with a 330 s par:
- Key +3 already had all five Omens.
- No class's wins landed inside par, because plain tier 7 wins took 300 to 440 s on average.

So Omens now come every two levels, and par is 480 s.

**Watch items:**
- The Lumen's slow clears: 443 s on average at plain tier 7. It makes par less often than the others, which matches its long-fights watch item on the skills team's C5 list.
- The Duskblade clears fastest and will climb keys first.

## For engineering: the leaderboard
`hero.keyBest[dungeon]` is the best key level a hero has beaten in each solo dungeon. A per-dungeon leaderboard needs:
- A table such as `key_runs(user_id, dungeon, level, time, week)`.
- A `submit_key` RPC with a server-side clamp: the level can rise by at most 2 per run, and the time must be at least some floor.
- A read view for the top N per dungeon.

That's a Supabase migration, so it's engineering's call. The sim already reports `summary.keyLevel`, `summary.time` and `summary.dungeon`.

`tools/hashcheck.ts` is identical to main: with no key, `keyScale` is exactly 1.
