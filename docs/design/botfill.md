# Fill with bots (21 Nov 2026)

**Steve's call (21 Nov 2026):** "Fill with bots might be ok but I'm concerned they will make it too easy to farm/win." This is the version with guardrails against that.

## What it does
A hero with no online party can pick a group dungeon (the Hammerdeep or the Ashvents) and press **Fill with bots** on the delve screen. Bots fill the party up to 4: a tank (Bulwark) and a healer (Lumen) first if the hero is neither, then damage (Duskblade, then Emberwright). A Slagbinder's role comes from its stance, as in `roleOf`. The bots are the same party bots the balance tables use (`botInput`, full skill). Code: `sim/content/botfill.ts`, plus `fillParty()` in `client/hub.ts` and the `fill` block in `client/main.ts`.

## The guardrails
1. **Bots are weaker than real players.** Each bot wears stand-in gear: copies of the player's own equipped items at **80% of their stats** (`BOT_FILL.gearScale`). The copies have no Mythic, no class weapon effect and no set tag. So a bot is never better geared than you, and it never gets Deepguard or Ventwalker bonuses.
2. **No bots in the raid or the Pressworks.** In the Pressworks, taking turns is the whole fight and bots never miss a turn, so a bot fill won as often as a real party (group-dungeons.md, the Pressworks).
   **The raid:** The Crucible needs four real heroes (`botFillBlocker`). The raid's hits count triple toward the world boss, and the raid is the social goal at the top of the game.
3. **A bot-filled win pays like a solo dungeon.** Every hero in a group dungeon normally gets a second Rare-or-better boss item. A bot-filled party doesn't (`WorldOptions.fillBots`). Everything else is unchanged: the normal boss item (and the first-clear Epic), set drops, XP, the tier ladder and season marks. The hero still has a reason to play, but a real party pays better.

Bot skill was tried as the knob first and rejected, because it barely changes anything. With a Bulwark player at tier 8, bots at skill 1, 0.7 and 0.5 won 18, 19 and 19 of 40 in the Hammerdeep, and 36, 35 and 32 of 40 in the Crucible.

## Measured
I used `tools/botfill.ts`: one player hero with its own heroes-r2 file, plus the bots `fillClasses` picks, in stand-in gear, all at skill 1. The "real party" column is `tools/group.ts`: Bulwark, Lumen, Duskblade and Emberwright, each in its own heroes-r2 file. Seeds 1 to 80, main 9c9d11b. Wins out of 80:

| | Real party | Bulwark + bots | Lumen + bots | Duskblade + bots | Emberwright + bots |
|---|---|---|---|---|---|
| Hammerdeep tier 6 (hero-t6-0) | 75 | 67 | 78 | 59 | 75 |
| Hammerdeep tier 8 (hero-t8-0) | 43 | 30 | 16 | 25 | 36 |
| Ashvents tier 6 (hero-t6-0) | 70 | 71 | 72 | 57 | 71 |
| Ashvents tier 8 (hero-t8-0) | 50 | 31 | 22 | 47 | 44 |

The real-party cells come from skills (docs/skills.md, on main 4dd9163), except the Ashvents tier 6, which I ran myself on main 9c9d11b.

- **Tier 8**, where the group dungeons are a challenge: every bot-filled party wins less than the real party, by 3 to 28 wins of 80. On average a bot fill wins 27 against 43 in the Hammerdeep, and 36 against 50 in the Ashvents.
- **Tier 6**, where everyone wins: bot fills sit near the real party. Two cells are 1 to 3 wins above it, within the ±5 noise of an 80-seed cell. Nothing there is worth farming, because the loot is a tier 6 solo run's.
- **A Lumen player does worst with bots,** because a Lumen bot's heals carry a party and a Lumen player's damage doesn't. That's the wanted direction: playing the healer yourself is the reason to find a real party.

**The raid, before it was ruled out (40 seeds, tier 8, hero-t8-0).** The real party (own gear) won 26 of 40.

| Bot gear | Bulwark + bots | Lumen + bots | Duskblade + bots | Emberwright + bots |
|---|---|---|---|---|
| 100% | 36 | 18 | | 37 |
| 80% | 21 | 19 | 30 | 35 |
| 60% | 8 | | | |

Bots made the raid as easy as 37 of 40 (93%), above the 70% ceiling, and how easy depended heavily on the player's class. No single gear scale fixes that.

**The 80% gear scale.** At 100%, bot fills in the Hammerdeep at tier 8 won 18 (Bulwark) and 30 (Emberwright) of 40, against the real party's 21.5. At 80%, they won 16 and 16, below it in every class.

## Open
- The bots' ally names show as "Lumen (bot)" and so on.
- Fill bots aren't in online co-op. A party of 2 or 3 real players can't top up with bots, because bots would need the co-op host to run them. If that's wanted, it's an engineering item.

## With skills' party cards (#241)
Party cards let bots draft party-only cards too, so I re-measured tier 8 on #241's head (7dcf076), with the same seeds and heroes. The real-party numbers are skills' measurements on #241.

| Tier 8, of 80 | Real party | Bulwark + bots | Lumen + bots | Duskblade + bots | Emberwright + bots |
|---|---|---|---|---|---|
| Hammerdeep | 42 | 34 | 12 | 25 | 30 |
| Ashvents | 53 | 37 | 16 | 49 | 47 |

Every bot-filled party still wins less than a real party.
