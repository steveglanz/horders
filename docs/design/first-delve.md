# L1: the first delve (21 Nov 2026)

**Problem.** A brand-new hero's first delve is an ordinary Kiln run at tier 1, with a random route. The novice reference (`LAG=0.3 SKILL=0.5`, tools/balance.ts) loses a third to a half of those first runs, depending on the class. The fight tips name verbs ("Quench its Ground Pound") without saying which button that is.

**Design.** A character's first delve (`hero.runs === 0`) in the Kiln at tier 1, solo, is a guided run. The numbers and coach lines are in `sim/content/firstdelve.ts`.
- **A fixed teaching route**, one lesson per fight:
  1. The Cinder Pack: your attacks fire on their own, so keep moving.
  2. Hollow Wardens: walk out of the red.
  3. Cinder Brute: Quench the cast.
  4. The Brute and its Acolytes: kill the healers first.
  5. The Kiln Mother: all three verbs at once.

  Forks still appear, so the shrine can still help.
- **Softer foes:** foe health ×0.85 and damage ×0.7, through the same multipliers a Delver's Key uses.
- **Coach lines:** each fight's banner and the route tracker show a coach line in place of the usual tip. The line names the hero's own interrupt (Quench, Kick, Shield Toss, Hush or Clinker) and calls it "the blue button", because the interrupt button and an interruptible cast bar are both blue.

**Where it applies.** `WorldOptions.firstDelve` is passed by the client when the character has no runs. The sim then also requires all of these:
- the Kiln, at tier 1
- solo play
- not a bounty, and not a key run

So a co-op guest or a bounty never gets it. A second character, of another class, gets its own first delve if it starts at Kiln tier 1. Everything else is unchanged, and `tools/hashcheck.ts` is identical to main.

## Numbers
Novice reference, Kiln tier 1, 40 seeds, a fresh hero with no gear (`FIRST=1` in tools/balance.ts; `FD_HP` and `FD_DMG` override the multipliers).

| Class | Normal first run | Teaching route only | Shipped (route, ×0.85 health, ×0.7 damage) |
|---|---|---|---|
| Emberwright | 26 | 24 | 36 |
| Duskblade | 20 | 21 | 39 |
| Bulwark | 21 | 21 | 39 |
| Lumen | 39 | 40 | 40 |
| Slagbinder | 33 | 39 | 40 |

- **The route alone doesn't change the odds;** the softer foes do. The target is about 90% for every class, so that a first run teaches rather than ends.
- **A 3-fight route was tried and dropped:** the pack, the Brute, then the Kiln Mother. The hero reaches her two levels short, and the novice Emberwright and Duskblade won only 2 of 40.

Screenshots: `node tools/firstshots.cjs <outDir> [phone]` after a build.

## First-time tips
After the first-delve coach (`client/coach.ts`: move, cast, interrupt) is done, two one-line tips each show once per browser (`horders.tips.v1`), for 5 s:
- **The first red hit circle that reaches the hero:** "Red on the floor is a hit coming. Step out before it fills."
- **The first gold soak circle:** "Gold circles want someone inside. Stand in it until it fills, or it blasts you."

Named mechanics such as Glare, Brand, Anvilfall and the Long Night already get their own cast banners, so they need no tip. On phones the tip sits where the move prompt does, beside the action bar. Test runs (`?seed=`) skip the tips unless `tips=1` is set. Screenshots: `node tools/tipshots.cjs <outDir> [phone]`.
