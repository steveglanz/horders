# Collections (P4, 21 Nov 2026)

A book of every verb set piece, Mythic and class weapon effect the account has held. Code is in `sim/content/collections.ts` and `applyCollection` in `sim/hero.ts`. Tests are in `tests/collections.test.ts`.

## Why
Once a hero's gear is good, a set piece or Mythic that isn't an upgrade gets salvaged and forgotten. The book turns every find into progress, and gives a reason to run each dungeon's boss for its set. Mythics and weapon effects that only one class can roll give a reason to play the other classes.

## What counts
| Page | Entries | How you get them |
|---|---|---|
| Sets | 4 sets × 3 slots (head, hands, trinket) = 12 | Each solo dungeon's boss (Kiln, Foundry, Glarewell, Coldmarrow) |
| Mythics | 4 shared + 2 per class = 12 | Mythic drops from tier 3. The class ones only drop for that class |
| Weapon effects | 2 per class = 8 | Epic and Mythic weapons |

The book has 38 entries in all. It is **shared by every class**, like titles: a find counts for the account, not for one character. An entry counts when the item reaches your bags at the end of a run, so salvaging it later doesn't remove it. Saves from before collections count whatever any class still holds.

## Rewards (paid once, to the class being played)
| Reward | Needs | Embers | Title |
|---|---|---|---|
| Each set | All 3 pieces of it | 80 | the Kilnbreaker, the Tidewalker, the Glarewarden, the Hearthkeeper, the Wrackrider, the Deepguard |
| Half the Mythics | 6 of 12 | 80 | |
| Every Mythic | 12 of 12 | 200 | the Mythbound |
| Every weapon effect | 8 of 8 | 120 | Weaponsworn |

- **Total:** 880 embers over the whole book (720 before the Wrackrider and Deepguard sets). At about 85 to 90 embers a delve (economy.md), that is about 8 delves of income spread over weeks of play, so it doesn't change the Forge outcome targets.
- **Names:** the set titles reuse our own set names. Web searches for "Mythbound" and "Weaponsworn" (21 Nov 2026) found no game, title or achievement with those names.
- **No power:** the rewards are embers and titles, so the book doesn't change win rates or the hashcheck.

## UI
- **Hero card:** a Collection button with the count (8/38). It's hidden until the first delve, like the weekly quests.
- **The sheet:**
  - Set slot pips.
  - Mythic and weapon effect tiles. Unfound tiles show ??? plus the class that can find them.
  - Reward rows with progress bars.
- **End screen:** notes how many entries are new, and any reward paid.

`tools/bookshots.cjs` screenshots it on desktop, iPhone 13 and a 320 px phone. None had page errors or horizontal scroll. Phone shot: `docs/design/shots/collection-phone.png`.

## When content is added
`BOOK` and `COLLECTION_REWARDS` are built from `SETS`, `MYTHICS` and `WEAPON_FX`, so a new set, Mythic or weapon effect joins the book on its own. A new set also gets its own set reward and title. A reward someone has already been paid stays paid. "Every Mythic" grows with the list, so a player who had them all can earn it again only if its id changes. Keep the id when adding Mythics, and decide then whether to add a new reward.

**Watch items:**
- The fifth class (skills) adds 2 Mythics and 2 weapon effects to the book.
- Visuals may want real art for the book tiles. This pass uses the existing tokens.
