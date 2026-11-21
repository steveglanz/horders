# Horders design roadmap

Ordered by how much each item adds to "one more run" for the work it takes, and by how much it sets Horders apart ([positioning.md](positioning.md)). Game design builds the items marked **design**; the other owners are noted. Each item lists what it needs from other teams so they can plan.

Status key: ✅ done, 🔨 in progress, ⏭ next, 💡 later.

| # | Item | Status | Owner | Needs from others |
|---|------|--------|-------|-------------------|
| R2 | The Forge: embers upgrade and temper gear | ✅ PR #2 | design | Visuals: a nicer Forge panel later |
| R1 | Route choices between fights | 🔨 built | design | Visuals: real gate art (placeholder circles and labels now) |
| R3 | Tier modifiers ("Omens") | 🔨 built | design | Visuals: an icon per Omen, a shield bar for Warded (`ward` on Enemy, `ward` event) |
| R5 | World boss you actually fight | 🔨 PR #3 (engineering) | design + engineering | Engineering: per-boss rules on the server; visuals: boss art |
| R6 | Second dungeon: the Drowned Foundry | 🔨 built | design | Visuals: art for 3 new enemies, the boss, steam vents and the water edge |
| R10 | Group difficulty: party health scaling, Grit, co-op threat rules | 🔨 built | design | Skills: Charge taunt, Sidestep threat dump (agreed) |
| R9 | Co-op delves with tank, healer and damage roles, then raids | ⏭ after current PRs | engineering + design | Engineering: rooms and netcode; skills: role kits |
| R7 | Daily bounty: a 3-fight delve, one twist, the same seed for everyone that day | 🔨 built | design | Visuals: a bounty badge in the hub; engineering later: a daily leaderboard by clear time |
| R11 | Third themed dungeon: the Glarewell, light and shadow, from tier 7 | ✅ built (sim, bot, placeholder art) | design | Visuals: replace the placeholder art; skills: add it to the class matrix; engineering: one Brand per hero in co-op |
| R4 | Build-changing loot: verb sets of 2 to 3 pieces, class weapon effects | 💡 | design + skills | Skills: effects that hook into each class kit |
| R8 | Alchemy: one potion slot (run-start buff or a revive) | ✅ built | design | Visuals: potion icons and a brewing look in the hub |

## R2. The Forge

**Problem.** Salvage gives embers, and embers do nothing. Players salvage once, see nothing happen, and stop.

**Design.**
- **Upgrade:** +1 item level, up to hero level + (highest tier unlocked − 1) + 1, which is one above the best drop you can currently find. The main stat recalculates and bonus stats scale up with it. Cost grows with item level and rarity, so you spend on the pieces you'll keep (an Epic or Mythic) rather than on every Common.
- **Temper:** reroll the weakest bonus stat into a different stat, at the item's current level. Fine or better only (Commons have no bonus stats). The roll is seeded from the hero's forge counter, so the server can check it later, like loot.
- The cap keeps a favourite Epic or Mythic level with fresh drops without running away from them. A first version capped at hero level + 2, and the autopilot stopped forging around run 15 to 20 and ended with 1,585 embers unspent, because tier drops were already above that cap.

**Target.** About one upgrade per run from normal salvage. Checked in balance.md.

## R1. Route choices between fights

**Problem.** The route is rolled and hidden. Between fights you only pick a talent, so you never decide how risky your delve is.

**Design.** After fights 1, 2 and 3, the arena shows two exits and you walk into one:
- **Named fight:** the harder encounter with a better loot bag (minimum rarity one step higher).
- **Steady fight:** an ordinary encounter.
- Sometimes one exit is a **Shrine** instead of a fight: pick a heal to full, a run-long buff, or a free talent reroll.
- Walking into a door, rather than tapping a menu, keeps it a moment inside the game and works with the joystick.

**Why.** Push-your-luck choices are what make a run feel like yours, and they fit pillar 2: a strong hero takes the named path, a struggling one takes the shrine.

**Measure.** The bot picks named paths when its health is over 60%. Win rate on tier 1 should stay about where it is; average loot rarity should rise for players who take risks.

**As built.** After fights 1, 2 and 3, two gates appear a short walk from the player, so both fit on a phone screen. You have 10 seconds to walk into one, or the steady fight is taken. The other gate is a named fight that isn't already in your route (its loot bag is one rarity better), or, 30% of the time or when no named fight is left, an Ember Shrine. A shrine replaces the fight: full heal and a level (so a talent draft), but no loot bag. Code: `rollFork` in `sim/content/dungeon.ts`, the `choose` phase in `World`, `botGate` in the bot, gate drawing in `GameScene`. `tools/paths.ts` compares path policies. Numbers are in balance.md.

## R3. Tier modifiers ("Omens")

**Problem.** Tiers only add health and damage. Tier 9 plays exactly like tier 1.

**Design.** From tier 3, each tier adds one Omen to every fight, picked from a weekly rotation (a seed from the week number), so the ladder changes each week. Starting set, each one asks for a different reaction:
- **Kindled Dead:** elites leave a burning pool where they die. (Move after kills.)
- **Shared Pain:** when an enemy dies, the others in the fight heal 15%. (Kill evenly, or burst them together.)
- **Quickened:** enemy casts are 30% faster. (Interrupt sooner.)
- **Warded:** the first time each enemy drops under half health, it gains a shield worth 20% of its health. (Save a cooldown for it.)
- **Volatile Ground:** a slow red circle appears under you every 12 seconds. (Keep moving.)

Higher tiers stack more Omens (tier 3 to 5: one, 6 to 9: two, 10 and up: three). Each Omen also adds +8% loot luck, so the hard ladder pays.

**As built.** `sim/content/omens.ts` holds the definitions and every tuning number. `omensFor(tier, week)` is a fixed shuffle per week; a tier takes the first N, so tier 7 has tier 3's Omen plus one more. The client passes the week number, so the sim stays clock-free and deterministic. Fairness rules: Volatile Ground never erupts while a soak circle is up, Kindled Dead and Shared Pain only trigger on elites and named foes, and none of them touch the boss's own death. The hub shows this week's Omens under the tier picker, and the first fight's banner names them with their tips. Tuning results are in balance.md.

**World boss tie-in (proposal for engineering).** While a world boss lives, it adds one fixed Omen to every delve at every tier, with +15% loot luck. That gives each boss a weekly flavour using the same system, and only needs one `omen` column on the boss row.

## R5. A world boss you actually fight

**Problem.** The world boss is a health bar on the menu.

**Design sketch.** Each world boss arrives as a sixth, optional fight at the end of a won delve: "Grandmother Slag's shadow" for a 60-second damage race with her signature mechanic. Damage there counts 3x toward the shared bar. Each world boss also sets a weekly blessing or curse on delves while it lives, which ties the shared world to every run. This is the solo version of "bigger enemies need a group"; co-op makes it a real raid later.

## R6. Second dungeon: the Drowned Foundry

**Problem.** One dungeon with 7 encounters. After a handful of runs you've seen every fight, and the Kiln Mother tests the same three verbs (dodge, interrupt, soak) every time.

**Design.** A flooded forge under Emberhold, unlocked once you've beaten the Kiln Mother on tier 3. In the hub you pick which dungeon to delve; tiers, Omens and forks work the same in both. Every new enemy brings a verb the Kiln Depths doesn't have:

| Enemy | Rank | Verb | How it works |
|-------|------|------|--------------|
| Glass Warden | elite | **Stop or interrupt** | Casts Mirror Ward (2 s, can be Quenched). If it lands, for 3 s the warden reflects 40% of the damage it takes back at you. |
| Ember Twins | elite pair | **Balance damage** | Two linked twins. When one falls, the other starts a 6 s Rekindle cast that revives its twin at half health unless it dies or is Quenched first. |
| Sluice Crawler | elite | **Spread** | Every 9 s it marks your position with a ring that bursts 2.5 s later. Standing near other enemies when it bursts heals them, so drag the ring away. |
| **Maelra, the Drowned Bellows** | boss | **Kite through hazards** | See below. |

**Maelra.** 4,600 health and a 180 s enrage. Three steam vents sit at fixed spots in the arena.
- **Phase 1, Tempering:** every 7 s she gains a Temper stack (−12% damage taken each, up to 5). Kite her over a vent to boil the stacks off. This is the first fight where you lead the boss matters.
- **Phase 2 (below 60%), Rising Water:** the arena shrinks from 560 to 360 over 20 s, and she casts Undertow (can be Quenched), which drags you towards her.
- **Phase 3 (below 25%), Overpressure:** vents now erupt under their own telegraphs every 8 s. Kiting her over them is now a risk too, so time it between eruptions.

**Routes.** Opener (Twins, or Glass Wardens), opener (Sluice Crawler and two hounds), named (Glass Warden), hard (Twins plus an Acolyte), then Maelra. Forks pull named and hard alternatives from the same dungeon.

**Targets.** Boss fight 60 to 120 s for the good bot. Tier 1 Foundry win rate should be 15 to 25 points below the Kiln Depths at the same gear, since it unlocks later.

**As built.** Dungeons are a registry (`DUNGEONS` in `sim/content/dungeon.ts`), and `WorldOptions.dungeon` picks one. The Kiln route roll is unchanged. The hub has a dungeon picker, and the Foundry is locked until tier 4. Changes from the spec, found in tuning:
- The opener is one Glass Warden with two hounds, not two wardens. Two wardens killed a fresh hero in 4 of 24 runs in under 40 s.
- Mirror reflects 12%, not 40%, and wardens take turns mirroring.
- Maelra has 6,000 health, Temper is −15% per stack every 6 s, Undertow comes every 12 s, and phase 3 vents erupt every 7 s. All tuning is in `FOUNDRY` in `sim/world.ts`.

Placeholder art (needs the visuals team): the four new enemies use the generic creature shape in new colours. Vents are pale circles, and the shrinking water is a blue band. The target frame shows "Temper ×N", "Mirrored" or "Warded".

## R7. Daily bounty

**Why:** a shared reason to come back each day, and one of our differences ([positioning.md](positioning.md), point 4): every player gets the same delve.

**What:** from tier 2, the hub shows today's bounty. It's 3 fights (a named foe, a hard fight, then the dungeon's boss), with no forks and one twist, an Omen picked for the day. The day, seed, dungeon, fights and twist come only from the date (UTC), so everyone gets the same run with no server needed. Only the tier is your own, at one below your best, so it's a confident run, not a wall. If the day's dungeon is still locked for you, you get the Kiln version of the same day.

**Rules:** you start with 2 levels and drafts, for the two openers the bounty skips. Your first win each day pays 30 + 6 × tier embers on top of the usual loot. Replays are free practice. A bounty never changes your tier ladder or your Grit.

**Code:** `sim/content/bounty.ts` (`bountyFor`, `dayOf`, `BOUNTY`), `WorldOptions.bounty`, `HeroProfile.bountyDay`, `RunRewards.bountyEmbers`, the hub's bounty line, and `tools/bounty.ts` for balance. Tests are in `tests/bounty.test.ts`.

**Later:** a daily leaderboard by clear time (engineering), since the runs are directly comparable.

## R11. Third dungeon: the Glarewell

**Why:** Steve asked (20 Nov) whether dungeons have themes with their own enemies. Each dungeon should be a new place *and* teach new verbs. This one teaches the two on our list that nothing uses yet: **stand behind a pillar** and **spread out**. It strengthens difference 1 (few tough fights you read) and difference 2 (cast bars and Quench).

**Theme:** a sunken observatory where a great lens still burns. Bright light hurts. Shadow is safe, but shadow has things in it. Unlocks at tier 7, so each dungeon has a stretch of the ladder where it's new (Kiln 1, Foundry 4, Glarewell 7).

**As built (21 Nov 2026).** All numbers live in `GLARE` in `sim/world.ts`.
- **Arena:** 4 pillars on a ring of 200 around a glowing lens at the centre, rebuilt fresh every fight. Each casts a shadow wedge outward, 300 long and widening, drawn on the floor exactly where `World.shadowed()` says you're safe.
- **Lensbearer** (elite): casts **Glare**, a 2.6 s cast bar (was 2 s; the skills team measured that 2.6 s lets every class reach shade on foot from anywhere while all 4 pillars stand), then the whole room flashes. In the light it hits for 34 (scaled by tier); in a shadow it misses. It can be Quenched. *Changed from the spec:* a room-wide flash after a cast bar, not a 3 s sweeping beam. It reads better on a phone and uses the cast bar the player already knows.
- **Shade** (packs of 2 to 4): takes 30% damage while standing in shadow. Pull them into the light.
- **Brandkeeper** (elite): a 0.8 s cast puts a **Brand** on you. After 4 s it bursts, radius 110: it hits you for 16, cracks any pillar inside it (no shadow for the rest of that fight), and heals every enemy inside it for 10% of their health. A gold ring on the hero shows the radius and a closing timer. It waits 6 s after a burst before branding again.
- **Twin Lamps** (named fight): two lanterns with a beam of light between them while both are alive and within 460 of each other. Standing in the beam burns for 30 per second. Kill one to break it.
- **The Lensmother** (boss, 6200 health): Glare every 12 s (not Quenchable), with Lens Sweep cones in between. Phase 2 (60%) adds **Twin Brand**, two Brands back to back. Phase 3 (25%) cracks a pillar 3 s in and then every 14 s, each telegraphed for 2.5 s, always leaving one standing. Enrages at 180 s.
- **Fights:** openers Shades, Lensbearer, Brandkeeper; named Twin Lamps or Brand and Lens; hard Lensbearer and the Dark or Twin Lamps.
- **The bot** hides behind the nearest standing pillar when it sees a Glare cast, walks clear of pillars and enemies while Branded, and steps out of the lamp beam.
- **Art:** placeholder sprites drawn in code (`client/textures.ts`) for the visuals team to replace.

**Balance:** see [balance.md](balance.md#the-glarewell-21-nov-2026). The Glarewell at tier 7 plays as hard as the Foundry at tier 7 for the same geared tier 6 hero.

**Names:** web searches on 21 Nov 2026 for "Glarewell" game, "Lensmother" game boss, and "Brandkeeper" or "Lensbearer" video game enemy turned up no game using them. That's from the result titles only, so it's a search check, not a legal clearance. "Shade" and "Twin Lamps" are common words.

**Not built yet:**
- **Co-op:** one Brand per hero, so a party has to spread out. That's with engineering's R9 party work. Today there is one Brand, on the lead hero.
- **Skills check:** every class reaching cover in time (Blink, Sidestep, Charge, Lumen movement). The skills team adds the Glarewell to its class matrix.

## R8. Alchemy: one potion slot

**Why:** consumables before a hard fight are an MMO staple (difference 2, "an MMO inside the run"), and embers need a second use beside the Forge. A potion is a small, deliberate choice made before you delve.

**Rules (built 21 Nov 2026).** Code: `sim/content/potions.ts`, `brewPotion` in `sim/hero.ts`, `WorldOptions.potion`.
- In the hub, under the difficulty, you brew **one** potion for embers. It waits for your next delve and is used up when that delve starts, win or lose. Brewing a different one pours the first away with no refund.
- Each class keeps its own potion, like its embers and bags.
- No new button: every potion works on its own, which keeps the phone action bar at four.
- The **daily bounty ignores potions** (and doesn't use yours up), because everyone plays the same delve that day.
- In co-op only the lead hero's potion counts for now. Per-hero potions come with engineering's party saves.

**The potions (one verb each, never a raw stat):**

| Potion | Cost | Effect |
|---|---|---|
| Rising Draught | 30 embers | The first blow that would fell you leaves you at 25% health with a 2 s shield. Once per delve. |
| Stillwater Tonic | 10 embers | Your interrupt (Quench and its class versions) recovers 40% faster. |
| Kindling Brew | 12 embers | Start the delve at level 2, with a talent pick before the first fight. |

**Cost:** a delve's salvage is worth roughly 10 to 25 embers (Common 1, Fine 3, Rare 8, Epic 20), and the daily bounty's first win pays 30 + 6 × tier. So Rising Draught costs about two delves of salvage, or half a bounty, that would otherwise go to the Forge. That's the trade.

**Names:** a web search on 21 Nov 2026 for the three names with "game potion" turned up no game using them (result titles only, so it's a search check, not a legal clearance).

**Balance:** see [balance.md](balance.md#alchemy-potions-21-nov-2026).

## R4
Specs get written here when each one is next.

## Backlog notes
- **Acolyte heals as a real cast (Kiln).** ✅ Built 21 Nov 2026: acolytes cast **Kindle**, a 1.8 s interruptible heal every 6 s, so "kill the healer" has a visible tell. Quench treats a Kindle as the least urgent cast and only spends half its cooldown on one. See balance.md.
