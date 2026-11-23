# Skills and talents design

Owner: the skills team. This covers class abilities, the action bar, in-run talent drafts and capstones for the three launch classes. Numbers are first-pass and get tuned with the bot (`tools/balance.ts`).

## What the dungeon run changed

A run is now five fights, and each clear is one level and one draft. A bot run ends at level 5, so a player sees **four drafts per run** (five with a bonus level). Measured on `main` at 1a0e83c with seeds 1 to 8: one run in eight reached a capstone, and that one took it on the last draft before the boss.

So with four ranks per capstone, the capstone (the "evolution" moment) almost never happens. The rules below are built for four drafts.

## Draft rules (all classes)

1. **One card per branch.** Each draft offers one talent from each of the three branches, so every pick is a build direction and not a random pile. A branch with nothing left is replaced by a card from another branch, then by a general card.
2. **Capstone at 3 ranks.** Three ranks in a branch unlock its capstone, which then takes that branch's card. A committed build takes its capstone on draft 4 and fights the boss with it. A build that splits its picks never sees one, and that is the trade.
3. **Ability talents.** Every branch has at least one talent that changes an action-bar ability, not only a passive number, so a pick changes how you play the next fight.
4. **General fallbacks** (+10% damage, heal) stay for when the tree runs dry.

## One verb per class

The positioning doc (game design) asks for deep kits rather than more spells, with one verb per class that no other class has:

| Class | Its verb | Where it lives |
| --- | --- | --- |
| Emberwright | **Burn**: fire that stays on the ground and spreads from foe to foe | Kindled Ground, Searing Burn, Spreading Coals, Combustion's burn |
| Duskblade | **Execute**: a finisher that doubles on wounded foes | Execution, Wring Out |
| Bulwark | **Turn back**: damage taken comes back out | Anvil Skin, Spiked Shield, Thornwall, Unbreakable |
| Lumen | **Overheal into light**: healing past full becomes damage | Brilliance, High Noon |

New talents should deepen a class's own verb before they borrow another class's.

## Dungeon checks every kit must pass

From the Drowned Foundry spec (roadmap R6), every class needs:
1. **An interrupt.** All four have one in slot F: Quench, Kick, Shield Toss and Hush.
2. **Cleave or a quick target swap,** for foes that must die together. Emberwright fire and Flame Wave, Duskblade swings and Whirling Dusk, Bulwark Shield Sweep, Lumen Radiant Burst and Prism. Auto-attacks retarget on their own.
3. **Movement that works while being pulled:** Blink, Sidestep and Rending Dash, Charge, Glimmer Step.
4. **Damage while moving,** for kiting: all four auto-attacks fire on the move. Melee keeps up with Rending Dash and Charge.

## Novice aid (melee, tiers 1 to 3)

A slow player in melee keeps drifting into contact, so the first tiers forgive it. The aid is full at tier 1, two thirds at tier 2, one third at tier 3, and gone from tier 4 on, so the geared balance is untouched.
- **Duskblade Blade Guard:** hits from the foe it is swinging at are cut by 50% at tier 1 and 70% at tiers 2 and 3 (`BLADE_GUARD`), and not at all from tier 4. Unlike the rest of the aid it doesn't fade through tiers 2 and 3. When it faded, a novice Duskblade won 0 of 40 ungeared at Kiln t2 and t3 (QA's playtest, 23 Nov). Most of the damage came from Cinder Brute hits.
- **Duskblade Sidestep:** heals up to 3% of max health.
- **Bulwark:** Anvil Skin heals up to 10% of max health (on top of Mended Iron), and Shield Block also covers every big foe within 75° of the last sweep.
- **Steady Breath (both):** once per fight, dropping below 30% health heals up to 20% of max health.

Reference: the novice bot (`LAG=0.3 SKILL=0.5`, Kiln tier 1, seeds 1 to 24) wins 8 to 16 of 24 with every class.

Blade Guard at tiers 2 and 3, measured with the Kiln, ungeared, seeds 1 to 80, wins out of 80 (23 Nov):

| Bot | Tier | Duskblade before | Duskblade after | Emberwright |
|---|---|---|---|---|
| Novice (`LAG=0.3 SKILL=0.5`) | 1 | 28 | 28 | - |
| Novice | 2 | 0 | 23 | 25 |
| Novice | 3 | 0 | 5 | 9 |
| Full skill | 2 | 77 | 78 | 49 |
| Full skill | 3 | 61 | 72 | 41 |

The novice Duskblade now sits just under the novice Emberwright. A full-skill Duskblade was already well over the Emberwright at tiers 2 and 3, and at tier 3 it gains 11. Those are learning tiers, so the gap is accepted. It is a watch item for skills if real players find tier 3 too easy on a Duskblade.

## Co-op threat hooks

With a party, enemies pick targets by threat (`sim/threat.ts`). The kits add to it:
- **Bulwark:** 4× threat from damage (engineering's damage hook), and **Charge taunts** everything it hits onto the Bulwark for 3s.
- **Duskblade:** **Sidestep halves** its threat on every enemy.
- **Healing:** effective healing (no overheal) makes 0.5 threat per point, split across the living enemies. This goes through `World.healPlayer`.
Solo ignores all of this.

## Shared action bar shape

Every class has the same four slots so the boss mechanics work for all of them:

| Key | Slot | Role |
| --- | --- | --- |
| Q | Core | Main pressed ability, on a short cooldown |
| E | Move | Mobility or a defensive answer |
| R | Big | Long cooldown, the big hit or big save |
| F | Interrupt | Off the global cooldown. Stops a cast and stuns. With nothing to stop, a small hit and half the cooldown back |

Each class also has an auto-attack (survivors style) and its own resource.

## Emberwright (ranged caster) — deepen

Resource: **Heat**, built by orb hits and slowly over time. Auto: Cinder Volley (homing orbs).

Bar stays: Flame Wave (Q), Blink (E), Combustion (R), Quench (F).

New ability talents, one per branch:
- Wildfire, **Spreading Coals** (2 ranks): Combustion leaves a fire pool on its target, and its burn spreads to enemies near anything that dies burning.
- Kindling, **Ignition** (2 ranks): a crit refunds 15% of Flame Wave's cooldown, and Flame Wave crits always.
- Ashguard, **Hot Heels** (2 ranks): Blink gains a second charge, and you move 30% faster for 2s after it.

## Bulwark (tank)

Fantasy: you plant yourself in the middle of the pack, soak the hits and hit back. Short reach, more health, armor, and damage that grows with what you take.

Resource: **Resolve** (0 to 100). Gained when you are hit (1 per 5 damage before armor), when Shield Sweep lands (3 per enemy, up to 12 per swing), 10 from Charge, and 1 per second.

Base: 160 health, armor stops 20% of every hit, 128 move speed.

**Shield Block**: hits from the foe the shield faces (the last Shield Sweep target) are cut a further 35%. A tank that keeps its shield on the boss can stand in contact with it.

**Smother**: a Bulwark standing in a Sluice Crawler's bloom when it bursts catches it on the shield for 10 Resolve: the burst heals no one, and the Bulwark takes half its damage. This is the tank's answer to the Tide Pair: soak the ring instead of dragging it away. Rim Smash also shoves what it hits (50 for normal foes, 90 for elites, 70 for bosses), so the Bulwark can steer Maelra toward a vent.

Auto: **Shield Sweep**, every 0.8s, a 150° arc toward the target, 95 range, 30 damage (15% more against elites and bosses), small knockback on normal enemies.

| Key | Ability | Cost / CD | Effect |
| --- | --- | --- | --- |
| Q | Rim Smash | 25 Resolve / 5s | 100° cone, 150 range, 60 damage, stuns normal enemies 1.2s and big ones 0.3s |
| E | Charge | 0 / 9s | Rush the biggest foe within 420 (or the nearest), 35 damage and 0.8s stun |
| R | Anvil Skin | 50 Resolve / 20s | 6s: take 60% less damage, and turn 25% of each hit back on the attacker |
| F | Shield Toss | 0 / 10s, off GCD | Interrupt within 420, stuns 2s. With nothing to stop, a small hit and half the cooldown back |

Branches:
- **Anvil Skin** (soak): *Planted Heels* (3) +30 max health and 4% less damage taken; *Ward* (3) every 8s a shield worth 8% of max health; *Mended Iron* (2, ability) Anvil Skin heals 12% of max health; capstone **Unbreakable**: when Anvil Skin ends it bursts for twice the damage it stopped.
- **Retribution** (thorns): *Spiked Shield* (3) enemies that hit you take 8 back; *Vengeance* (3) +4% damage per 10% health missing; *Shield Echo* (2, ability) Rim Smash hits again 0.4s later for half, rank 2 adds 10 Resolve; capstone **Thornwall**: always turn back 15% of each hit, and turned-back damage hits everything around you.
- **Vanguard** (cleave and charge): *Wide Sweep* (2) wider and longer sweeps, a full circle at rank 2; *Momentum* (3) +5% move speed and Charge 2s faster; *Plough Through* (2, ability) Charge hits and stuns everything in its path; capstone **Warpath**: every 4th sweep sends a shockwave for double damage.

## Duskblade (melee damage)

Engineering's class-system PR shipped a first-pass Duskblade: Momentum resource, auto swings, Rending Dash (Q), Sidestep (E), Execution (R), Kick (F), and the Bloodletting, Tempo and Guard branches. That kit plays well and is kept as the base, so the earlier Energy and Marks sketch is dropped. Most of its low bot win rate turned out to be the bot standing in contact with big foes and running straight back from cone attacks; fixing the melee bot took it from 13 to 47 wins out of 60. **Open Wounds** (passive): a foe hit by a Duskblade swing takes half healing for 3s. That is the Duskblade's answer to fights where enemies heal, like the Tide Pair's blooms. It also gets one ability talent per branch, like the other classes:
- Bloodletting, **Wring Out** (2 ranks): Execution also deals the target's next 3s of bleed at once (6s at rank 2).
- Tempo, **Flurry Step** (2 ranks): Rending Dash comes back at once if it kills; rank 2 makes it cost 10 less Momentum.
- Guard, **Counterstep** (2 ranks): Sidestep cuts the nearest foe for 60 as you land; rank 2 doubles the dodge window.

## Lumen (healer)

Fantasy: light that mends. In a group the Lumen keeps others alive. Solo, there is nobody else to heal, so overhealing turns into damage, the way the original plan describes. Co-op healing of allies arrives with group play (`docs/design/group-play.md`); the rules agreed with game design: healing makes 0.5 threat per point, split across the enemies in the fight.

Resource: **Radiance** (0 to 100), 4 per second plus 3 per Sunmote hit.
**Brilliance**: overhealing is stored (up to 200). Each Sunmote spends up to 10 of it as bonus damage.

Base: 100 health, 138 move speed.

Auto: **Sunmote**, every 0.7s, an instant bolt of light at the target within 500 (bosses first), 22 damage, heals you 1.

| Key | Ability | Cost / CD | Effect |
| --- | --- | --- | --- |
| Q | Radiant Burst | 25 Radiance / 4s | Heal 15, and a 140-radius pulse for 40 damage that pushes normal enemies back |
| E | Glimmer Step | 0 / 8s | Step 160 where you are moving, untouchable for 0.3s |
| R | Sanctuary | 60 Radiance / 22s | 6s of hallowed ground (radius 150): heal 4 per second inside, foes inside take 20 per second |
| F | Hush | 0 / 10s, off GCD | Interrupt within 480, stuns 2s. With nothing to stop, a small hit and half the cooldown back |

Branches:
- **Dawn** (healing into damage): *Kindled Light* (3) overheal stores 30% more Brilliance; *Searing Radiance* (3) Sunmotes +15% damage; *Noon Flash* (2, ability) Radiant Burst +40 radius and +50% damage; capstone **High Noon**: every 4s, stored Brilliance fires a piercing sunbeam for 30 plus 1.5 per point.
- **Grace** (shields and staying alive): *Gleam Guard* (3) Radiant Burst shields you for 8% of max health; *Renewal* (3) +20 max health and 1 health per second; *Blessed Ground* (2, ability) Glimmer Step leaves a pool that heals 5 per second per rank for 4s; capstone **Martyr's Halo**: once per fight, a killing blow leaves you at 1 health and untouchable for 2s.
- **Choir** (more light, faster): *Hasted Hymn* (3) Sunmotes 12% more often; *Prism* (2) each Sunmote also strikes one more enemy for 60%; *Lingering Sanctuary* (2, ability) Sanctuary lasts 2s longer and moves with you; capstone **Choir of Dawn**: three wisps circle you, burning foes and healing you 1.5 with each hit.

## Co-op healing (roadmap R9, healer role)

In a party, the Lumen heals the group, not just itself. Solo play is unchanged: everything below is skipped when there's only one hero, and `tools/hashcheck.ts` fingerprints are identical.
- **Radiant Burst** heals every living ally inside its radius for the same amount it heals the Lumen.
- **Sanctuary** pulses heal allies standing in it (2 per 0.5 s).
- **Blessed Ground** pools heal allies standing in them.
- **Sunmote**'s small heal goes to whoever in range (500) has the lowest share of health, the Lumen included.

Ally healing goes through `World.healAllies`. Like self-healing, effective healing draws 0.5 threat per point split across the living enemies, and overheal still feeds Brilliance. Downed heroes can't be healed, because they stand back up between fights. Tests are in `tests/coop.test.ts`.

## Second capstones (roadmap C5, part 1: Emberwright and Duskblade)

Each Emberwright and Duskblade branch now has two capstones. When a branch reaches 3 ranks, the draft shows both side by side, ahead of the other card. Taking one closes the other (`World.rollDraft`). Tuning is in `CAPSTONES_2` in `sim/world.ts`, and the tests are in `tests/capstones2.test.ts`.

| Class | Branch | Existing capstone | New capstone |
|---|---|---|---|
| Emberwright | Wildfire | Conflagration | **Cinder Tide:** Flame Wave hits all around you and leaves fire at your feet (14/s for 3 s) |
| Emberwright | Kindling | Phoenix Lance | **Searing Bloom:** crits splash 60% of the hit on foes within 90 px and burn the target for 30/s for 3 s |
| Emberwright | Ashguard | Ring of Ash | **Ashen Mantle:** 40% less damage taken for 3 s after Blink |
| Duskblade | Bloodletting | Crimson Tide | **Open Veins:** bleeds deal 60% more |
| Duskblade | Tempo | Whirling Dusk | **Killing Rhythm:** each swing within 1.2 s of the last is 4% faster, up to 10 stacks |
| Duskblade | Guard | Riposte | **Shadow Slip:** Sidestep holds a second charge |

The bot still takes the old capstones by default, so solo fingerprints are identical. With `NEW_CAPS=1` it takes the new ones, for balance runs.

Balance: matrix.sh with heroes-r2, 3 heroes per class, 40 seeds. Numbers are average wins out of 40, old capstones / new.

| | Foundry 6 | Foundry 8 | Glarewell 6 | Glarewell 8 | Kiln 6 | Kiln 8 |
|---|---|---|---|---|---|---|
| Duskblade | 36.0 / 35.0 | 28.3 / 29.3 | 31.7 / 33.0 | 30.0 / 31.3 | 31.0 / 29.0 | 20.3 / 23.3 |
| Emberwright | 33.3 / 31.3 | 31.3 / 30.3 | 37.7 / 35.0 | 30.7 / 26.7 | 27.7 / 27.0 | 17.7 / 22.0 |

The Duskblade numbers are from the first pass; its capstones haven't changed since. The first Searing Bloom (a 40% splash, no burn) was up to 13 wins behind, because it does nothing against a lone boss, so it gained the burn.

## Second capstones (roadmap C5, part 2: Bulwark and Lumen)

| Class | Branch | Existing capstone | New capstone |
|---|---|---|---|
| Bulwark | Anvil Skin | Unbreakable | **Iron Vigil:** Anvil Skin lasts 10 s instead of 6 |
| Bulwark | Retribution | Thornwall | **Grudge:** every 4th hit that lands on you, strike every foe within 150 px for 30 plus twice the damage those hits did, and stagger them 0.5 s |
| Bulwark | Vanguard | Warpath | **Shield Wake:** Charge lands with a shockwave: 50 damage and a 1 s stun within 120 px |
| Lumen | Dawn | High Noon | **Noonfire:** Sunmotes deal 15% more to elites, rares and bosses |
| Lumen | Grace | Martyr's Halo | **Haven:** 30% less damage taken inside your own Sanctuary |
| Lumen | Choir | Choir of Dawn | **Chorus:** every 8th Sunmote strikes its target twice |

Balance: matrix.sh with heroes-r2, 3 heroes per class, 40 seeds, against main at 699d5b7. Numbers are average wins out of 40, old capstones / new.

| | Foundry 6 | Foundry 8 | Glarewell 6 | Glarewell 8 | Kiln 6 | Kiln 8 |
|---|---|---|---|---|---|---|
| Bulwark | 37.7 / 37.7 | 22.0 / 19.3 | 37.0 / 38.0 | 32.7 / 32.3 | 38.0 / 38.7 | 30.3 / 24.0 |
| Lumen | 34.3 / 36.3 | 25.7 / 32.0 | 39.7 / 39.7 | 33.0 / 37.7 | 36.0 / 39.3 | 17.7 / 31.3 |

What the numbers show:
- **Bulwark:** the bot mostly takes Thornwall. With no capstone at all, the bot scores 15.3 at Foundry 8 and 25.7 at Kiln 8. So Thornwall is worth about 5 to 7 wins at tier 8.
  - Grudge started as a Rim Smash damage stack. Even at +30% a stack it stayed 6 to 8 wins behind, so it now returns the damage you take, like a burst version of Thornwall.
  - It's still 6 behind at Kiln 8.
- **Lumen:** with no capstone, the bot scores 17.7 at Kiln 8, exactly the same as with High Noon and Choir of Dawn. So those capstones add nothing there.
  - Small damage gains swing the Lumen a lot at tier 8. Noonfire at +40% and Chorus on every 4th mote won 38.3 there, so both were cut back.
  - The old Lumen capstones need a look of their own (watch item for game design).

## Class talents round 2 (roadmap C5, part 3: deep cards)

Two more cards per branch for the Bulwark, Lumen and Slagbinder: 18 in all. They are **deep cards** (`deep: true` in TALENTS). A branch offers them only once its capstone is taken.

| Class | Branch | Card | Ranks | Effect per rank |
|---|---|---|---|---|
| Bulwark | Anvil Skin | Riveted Plates | 3 | Armor stops 5% more of each hit |
| Bulwark | Anvil Skin | Slow Pulse | 2 | Below half health, heal 4 health per second |
| Bulwark | Retribution | Hard Knocks | 3 | Rim Smash deals 20% more damage |
| Bulwark | Retribution | Grim Tally | 2 | Hits you take build 25% more Resolve |
| Bulwark | Vanguard | Broad Shoulders | 3 | Shield Sweep swings 8% more often |
| Bulwark | Vanguard | Full Weight | 2 | Charge hits 50% harder |
| Lumen | Dawn | Daybreak Pulse | 2 | Radiant Burst recovers 0.5 s sooner and heals 10% more |
| Lumen | Dawn | Lantern Heart | 3 | 30 more Brilliance cap, Sunmotes deal 10% more |
| Lumen | Grace | Lampglow Care | 3 | All your healing is 10% stronger |
| Lumen | Grace | Steady Halo | 2 | You take 5% less damage |
| Lumen | Choir | Long Note | 2 | Sunmotes reach 40 farther and deal 10% more |
| Lumen | Choir | Hallowed Embers | 3 | Sanctuary burns foes 50% harder |
| Slagbinder | Forge | Deep Coat | 2 | Molten Plating lasts 1 s longer and holds 10% more |
| Slagbinder | Forge | Wide Spatter | 3 | Plating bursts 15 px wider and 10% harder |
| Slagbinder | Clinker | Fast Ladle | 3 | Slag Lob throws 10% more often |
| Slagbinder | Clinker | Dense Glob | 2 | Each Slag Lob gives 3 more Slag |
| Slagbinder | Crust | Slag Scales | 3 | You take 4% less damage |
| Slagbinder | Crust | Slow Cool | 2 | Your Cooling Shell cuts 5% more of the damage you take |

**Emberwright and Duskblade deep cards** (added after #190, same rules):

| Class | Branch | Card | Ranks | Effect per rank |
|---|---|---|---|---|
| Emberwright | Wildfire | Deep Smoulder | 3 | Orb fires (Searing Burn) burn 15% harder |
| Emberwright | Wildfire | Ember Carpet | 2 | Flame Wave hits 20% harder |
| Emberwright | Kindling | Bright Wick | 3 | +8% chance to crit, and crits deal 10% more |
| Emberwright | Kindling | Fast Fuse | 2 | Combustion recharges 3 s faster and hits 20% harder |
| Emberwright | Ashguard | Soot Cloak | 3 | You take 4% less damage |
| Emberwright | Ashguard | Banked Fire | 2 | Below half health, heal 3 health per second |
| Duskblade | Bloodletting | Slow Drip | 3 | Your bleeds deal 10% more damage |
| Duskblade | Bloodletting | Hungry Steel | 2 | Execution hits 20% harder |
| Duskblade | Tempo | Light Grip | 3 | Swing 5% faster |
| Duskblade | Tempo | Keen Lunge | 2 | Rending Dash hits 25% harder |
| Duskblade | Guard | Low Stance | 3 | You take 4% less damage |
| Duskblade | Guard | Quiet Mend | 2 | Below half health, heal 3 health per second |

Balance against main 6f26577 (average wins out of 40, main / this change; heroes-fair, 3 heroes × 40 seeds):

| | F6 | F8 | K6 | K8 | CM9 | CM10 |
|---|---|---|---|---|---|---|
| Emberwright | 30.3 / 31.0 | 28.7 / 25.7 | 30.0 / 28.0 | 19.0 / 16.7 | 28.3 / 28.3 | 22.7 / 22.7 |
| Duskblade | 36.7 / 36.0 | 23.3 / 22.3 | 30.7 / 31.3 | 17.7 / 19.7 | 23.7 / 23.7 | 12.3 / 12.3 |

- Tier 1 Kiln, good bot: Emberwright 34 (34), Duskblade 40 (40). Novice over 160 seeds: Emberwright 89 (91), Duskblade 71 (77).
- Crucible tier 8, full party, 90 seeds: 56/90 against main's 60/90.
- The Duskblade row and the Crucible were measured on this branch before Bright Wick and Fast Fuse were raised (that change touches only the Emberwright). The Emberwright row and tier 1 Emberwright numbers are after it; the Crucible was re-run after it.
- The Emberwright loses about 2 wins at tier 8, because after Phoenix Lance the bot takes a deep card instead of Twin Cinders or Quickcast. Bright Wick and Fast Fuse were raised once (from "crits deal 15% more" and "2 s faster"), which moved Kiln 6 from 26.0 to 28.0. All cells stay inside the ±15 band.

Names rejected on the search or the repo check: White Heat (unclear on Wowhead), Red Ledger (already a Duskblade Mythic) and Warm Hearth (already the shared heal card).

Capstone card texts no longer start with "CAPSTONE:", since the draft card already shows a Capstone chip and the hold tooltip names it (phone team's ask).

**Names.** Each name was web-searched against WoW and Azeroth Survivors before it shipped. Rejected on the search: Shoulder Check (a Hearthstone card), Soft Glow (a WoW quest and spell), Quick Hands (unclear) and Cinder Skin (already an Emberwright talent).

**Why the gate.** A run gets about 5 picks, and each branch already has 13 core ranks. When the new cards joined the pool from the start, they crowded out the core picks. In the first pass the Lumen fell from 30.3 to 16.7 out of 40 at Kiln 8 and the Slagbinder Kiln 6 from 21.3 to 12.3. Hiding the new cards from the draft gave exactly main's numbers, which proved the cause was the offers and not the effects. Raising the cards' numbers alone barely helped (Lumen Kiln 8: 20.7). After the capstone, the core picks have already done their job, so a deep card is a real choice there.

**Balance** (21 Nov 2026, main at 9900c87, average wins out of 40, main / this change). Foundry and Kiln use heroes-fair, Coldmarrow uses the Coldmarrow heroes, 3 heroes and 40 seeds each.

| | Foundry 6 | Foundry 8 | Kiln 6 | Kiln 8 | Coldmarrow 9 | Coldmarrow 10 |
|---|---|---|---|---|---|---|
| Bulwark | 36.0 / 35.7 | 21.3 / 19.3 | 39.0 / 37.7 | 27.3 / 28.0 | 35.0 / 35.0 | 29.0 / 29.0 |
| Lumen | 36.0 / 36.0 | 32.7 / 33.0 | 38.7 / 39.3 | 30.3 / 29.3 | 28.7 / 28.7 | 19.3 / 19.3 |
| Slagbinder | 30.7 / 32.0 | 21.0 / 21.0 | 21.3 / 21.3 | 12.3 / 11.0 | 16.0 / 16.0 | 8.7 / 8.7 |

- Tier 1 Kiln, 40 seeds, good bot: 40 for all three classes, as on main. Novice: Bulwark 16 (main 21), Lumen 39 (39), Slagbinder 35 (36). The Bulwark gap is noise: on seeds 41 to 160 it's 65/120 against main's 63/120.
- Crucible tier 8, full party (Bulwark, Lumen, Duskblade, Emberwright), 90 seeds: 60/90 (67%) against main's 53/90 (59%). Under the 70% cap. With the Slagbinder in place of the Duskblade, 30 seeds: 20/30, same as main.
- Coldmarrow matches main in every cell.
- Replays (tools/hashcheck.ts): the Emberwright and Duskblade are identical to main. The Bulwark and Lumen change wherever a run reaches a capstone.

**Bot.** Every talent must have a place in `BOT_PRIORITY` (sim/bot.ts). A missing card scores -1 and is drafted ahead of everything. The deep cards sit at the end of each class's list. tests/talents-round2.test.ts fails if any talent is missing.

## Class tools for the Wrackline (21 Nov 2026)

The Wrackline's Ebb drags every hero who is off a raft toward the drain (docs/design/wrackline.md). Each class now has an answer from its own kit. No new abilities and no new names: only existing kits, the Ebb and the Haul are touched, so every other dungeon is unchanged (tools/hashcheck.ts identical to main).
- **Bulwark, anchored:** while Anvil Skin is up (`bastionT > 0`), neither the Ebb nor a Barge Hauler's Haul can move it. The water still burns. The Bulwark is the only class with no movement ability, and it was the lowest class there. `World.anchored()`.
- **Emberwright, Lumen and Duskblade:** Blink, Glimmer Step and Sidestep already carry a hero 170, 160 and 130 units. The bot now uses them to reach a raft in the Ebb when walking would be late, and only when the raft is far enough that the hop helps (`raftHop` in sim/bot.ts).
- **Slagbinder:** the bot keeps Interpose for its usual uses. Hopping to rafts with it cost 3.7 wins of 30 against Hessa.

Wrackline, tier 10, heroes-fair hero-t8-0 to 2, 30 seeds each. Average wins out of 30, main b748f13 / this change:

| Class | Wins | Share of the Ebb spent off a raft |
|---|---|---|
| Emberwright | 21.0 / 21.7 | 3% / 2% |
| Duskblade | 19.0 / 19.3 | 7% / 7% |
| Bulwark | 15.3 / 17.3 | 13% / 11% |
| Lumen | 28.0 / 29.0 | 3% / 1% |
| Slagbinder | 29.0 / 29.0 | 5% / 5% |

The Bulwark still dies mostly to Hessa: 43 of 90 runs on main, 37 here (the second hero's 20 fell to 13). It stays the lowest class here, a watch item for game design.

## Party bots play their verb set (21 Nov 2026)

The Deepguard ("stay close") and Ventwalker ("split up") sets reward where you stand, but the party bots stood in the same places with or without them. So the set measurements in docs/design/group-dungeons.md were taken from bots that never played the verb. Now, in a party, a ranged bot (Emberwright or Lumen) wearing 2 or more pieces:
- **Deepguard:** drifts toward its nearest ally when that ally is more than 105 away (the set needs 140).
- **Ventwalker:** drifts away from its nearest ally when that ally is within 168. The Lumen keeps its healing post instead.

Melee bots stay on their target, and Scatter Embers' spreading still wins over both. Solo play and parties without these sets are unchanged: the no-set party cells below match main exactly, and tools/hashcheck.ts is identical.

tools/group.ts, heroes-r2, seeds 1 to 80, wins out of 80, main 9195d8f / this change:

| | Main | This change |
|---|---|---|
| Hammerdeep tier 8, full party, no set | 43 | 43 |
| Hammerdeep tier 8, full party, 3 Deepguard each | 51 | 55 |
| Hammerdeep tier 6, Bulwark and Lumen duo, 3 Deepguard each | 37 | 67 |
| Ashvents tier 8, full party, no set | 50 | 50 |
| Ashvents tier 8, full party, 3 Ventwalker each | 60 | 59 |

**The duo jump is mostly positioning, not the set.** With the Deepguard drift forced on and no set worn, the duo wins 49 of 80 against 24 on main. Its Lumen bot normally stands too far from the Bulwark for Ondrel's fight. On top of that baseline, the set adds 18 of 80 (+9 in 40), above the 2 to 7 range the other sets give. That is game design's call.

## Party cards for Season 2 (21 Nov 2026)

Season 2 (the Deep Bellows) is the Hammerdeep group season, so every class gets two **party cards**. These are deep cards (they join a branch's draft after its capstone) marked `party: true`, and rollDraft offers them only with 2 or more heroes. Solo drafts never see them, and tools/hashcheck.ts is identical to main. Tuning is in `PARTY_CARDS` in sim/world.ts, and the tests are in tests/party-cards.test.ts.

| Class | Card | Branch | Effect |
|---|---|---|---|
| Bulwark | Lee Side | Bastion | Allies within 200 px take 4% less damage per rank (2 ranks) |
| Bulwark | Broad Back | Vanguard | A taunt that takes the boss off an ally (Called Out or Charge) heals that ally for 6% of its max health |
| Lumen | Front Mend | Grace | Heals on the hero the boss is attacking are 4% stronger (1 rank) |
| Lumen | Wide Dawn | Dawn | Radiant Burst heals allies 20% more per rank (2) |
| Duskblade | Turned Back | Bloodletting | 6% more damage per rank (2) to the boss while it attacks someone else |
| Duskblade | Shared Breath | Guard | Sidestep also heals the most hurt ally within 300 px for 4% of its max health |
| Emberwright | Long Kindle | Kindling | Kindling lasts 2 s longer and reaches 60 px farther per rank (2) |
| Emberwright | Close Warmth | Ashguard | Allies within 260 px heal 0.2 health per second per rank (2) |
| Slagbinder | Long Stand | Crust | Interpose guards the ally 1 s longer per rank (2), in either stance |
| Slagbinder | Wide Shell | Forge | Cooling Shell covers allies 50 px farther per rank (2), in either stance |

Every name was searched in the repo and on the web (WoW and Wowhead) before it shipped. "Fireside" was dropped for Close Warmth because a Wowhead hit was unclear.

tools/group.ts, wins, main 4dd9163 / this change. Game design's bar: within +5 of 80 of main, and the Crucible under 70%.

| | Main | Party cards |
|---|---|---|
| Hammerdeep tier 6, full party (heroes-r2), of 80 | 75 | 77 |
| Hammerdeep tier 8, full party (heroes-r2), of 80 | 43 | 42 |
| Hammerdeep tier 6, Bulwark and Lumen duo, of 80 | 24 | 28 |
| Hammerdeep tier 8, Slagbinder in place of the Duskblade (heroes-fair), of 80 | 72 | 67 |
| Ashvents tier 8, full party, of 80 | 50 | 53 |
| Crucible tier 8, full party, of 90 | 56 (62%) | 56 (62%) |

In 30 Hammerdeep tier 8 runs (both parties, 120 heroes), the bots took Long Kindle 13 times, Broad Back 8, Turned Back 8, Wide Dawn 7, Wide Shell 3 and Long Stand 2. The other four (Lee Side, Front Mend, Shared Breath and Close Warmth) sit in branches whose capstone the bot rarely takes, so their effect on the numbers above is untested in runs. Only the unit tests cover them.

**Retune of the four the bot doesn't draft (after #241).** `GRANT=leeSide:2` in tools/group.ts gives each hero of the card's class those ranks from the start of the run. Granted ranks don't count toward the branch's capstone, so the bot's own draft stays as it was. Each card was compared with the same grant at zero effect (`TUNE=PARTY_CARDS.leeCut=0`), and those controls match main (42, 28 and 56). Holding a card from the very start is an upper bound, because a drafted deep card arrives after the capstone.

Wins with the card held from the start, at #241's values and then at the new ones. Main is 42 of 80 for Hammerdeep tier 8, 28 of 80 for the tier 6 duo, and 56 of 90 for the Crucible tier 8:

| Card | #241 value | Hammerdeep t8 | t6 duo | Crucible t8 | New value | Hammerdeep t8 | t6 duo | Crucible t8 |
|---|---|---|---|---|---|---|---|---|
| Lee Side | 5% ×2 | 43 | 28 | 63 | 4% ×2 | 43 | 28 | 62 |
| Front Mend | 12% ×2 | 46 | 59 | 73 | 4% ×1 | 42 | 36 | 61 |
| Close Warmth | 1.5 hp/s ×2 | 58 | n/a | 80 | 0.2 hp/s ×2 | 45 | n/a | 66 |
| Shared Breath | 4% | 45 | n/a | 57 | unchanged | | | |

The tier 6 duo is very sensitive to any extra healing on the tank. Front Mend at 2% still read 38, and at 3% ×2 it read 37. So it is kept to one rank, and its upper bound on the duo is +8 of 80. Close Warmth readings are noisy, at about ±5 of 90: 0.1 hp/s read 54, 0.2 read 66, 0.3 read 64 and 0.5 read 70. Values this small change nothing at all, which rules out a hidden side effect: 0.0001 for Front Mend read 28, and 0.001 for Close Warmth read 55.

## Talent name sweep (21 Nov 2026)

There were 46 talent names that neither game design's audit nor the skills team's own checks had covered. Each one was quote-searched on warcraft.wiki.gg, Wowhead and Wowpedia. Steve's rule of 21 Nov at 15:48 is that only "true wow branded names" change.
- **Renamed, because they are distinctly WoW:** Sunflare becomes **Noon Flash** (Sunflare is a WoW item). Shatterpoint becomes **Breakpoint** (Shatter Point is a WoW place).
- **Kept, because they are ordinary English that WoW also uses:** Thick Hide, Heat Sink, High Noon and Shadow Slip.

Only the shown names changed. The talent ids (`sunflare`, `shatterpoint`) are the same, so saves, hashes and the bot's priority list are untouched. The full list is in the wow-name-audit project memory.

## Party bots huddle with no set: a flag, off (21 Nov 2026)

`BOT_PARTY.huddle` in sim/bot.ts gives ranged party bots the Deepguard drift (toward the nearest ally when it is more than 105 away) with no set worn. A worn Ventwalker still wins. It is **off by default**, so play on main does not change. Game design decides whether to turn it on and retune Hammerdeep. Fill bots won't use it either way. `HUDDLE=1` turns it on in tools/group.ts.

tools/group.ts, heroes-r2, seeds 1 to 80, no sets, wins out of 80, off / on:

| | Off (main) | On |
|---|---|---|
| Hammerdeep tier 6, Bulwark and Lumen duo | 24 | 49 |
| Hammerdeep tier 6, full party | 75 | 77 |
| Hammerdeep tier 8, full party | 43 | 58 |
| Ashvents tier 8, full party | 50 | 47 |

The off column matches the main numbers in the section above (43, 50 and 24), so the flag changes nothing while it is off. With it on, the Hammerdeep duo doubles and tier 8 gains 15 of 80. The Ashvents loses 3 of 80, which is within noise.

## High Noon and Choir of Dawn rework (roadmap L7)
Both of the Lumen's original capstones added almost nothing:
- **High Noon** fired only when the Lumen held 20 Brilliance or more. Sunmote spends up to 10 Brilliance a shot, so the beam almost never fired: 0 times in 10 Kiln 8 runs with hero-t8-0, and 9 times in 10 runs at tier 6.
- **Choir of Dawn's** wisps circled 78 px out. The Lumen fights from range, so they did under 1% of its boss damage.
- With no capstone at all, the bot scored 17.7 out of 40 at Kiln 8, the same as with these two.

The rework (tuning in `LUMEN_CAPS` in sim/world.ts):
- **High Noon:** every 4 s, the beam fires at your target whenever there is one. It deals 40 plus 1.5 per Brilliance, and spends all your Brilliance as before.
- **Choir of Dawn:** the wisps circle 170 px out. (Ring of Ash moved to 200 px in the branch coverage fix below.)

**Balance:** matrix.sh with heroes-r2, 3 heroes and 40 seeds each, on main d52313c. Numbers are average wins out of 40.

| | Foundry 6 | Foundry 8 | Kiln 6 | Kiln 8 |
|---|---|---|---|---|
| Lumen before | 34.3 | 25.7 | 36.0 | 17.7 |
| Lumen after | 36.0 | 32.7 | 38.7 | 30.3 |
| Emberwright | 30.3 | 28.7 | 30.0 | 19.0 |
| Duskblade | 36.7 | 23.3 | 30.7 | 17.7 |
| Bulwark | 36.0 | 21.3 | 39.0 | 27.3 |

The Lumen now sits next to its C5 capstones (Kiln 8: 31.3), and every cell is within design's ±15 of the Emberwright. A first version, with a 60 base and 200 px, won 34.3 at Kiln 8, 15.3 ahead of the Emberwright, so both numbers were trimmed.

## Fifth class: the Slagbinder (spec, draft for design review)
**Role: Off-tank, an off-tank and support hybrid.** The Bulwark holds the boss, and the Lumen heals after the damage lands. The Slagbinder stops damage before it lands, on whoever is about to take it. It wears molten slag as armour and pours it onto allies as plating. Solo, it plates itself and fights at mid range. In a party, it picks up loose adds, takes a hit for a friend, and makes the boss Brittle for everyone.

**Name check (21 Nov 2026):** a web search for "Slagbinder" found no game, class or product of that name, only unrelated Dutch hardware listings. Slag already belongs to Horders' own world (Grandmother Slag, Slag Grip).

### Base stats
| Stat | Value | Compared with the others |
|---|---|---|
| Health | 150 | Between the Lumen (100) and the Bulwark (160) |
| Speed | 134 | Between the Bulwark (128) and the Lumen (138) |
| Resource | **Slag**, 0 to 100 | You gain 1 per 2 damage taken and 4 per hit landed. It cools by 2 a second out of combat. |
| Threat | ×2 | Between damage dealers (×1) and the Bulwark (×4), so it peels adds but never steals the boss by accident |
| Interrupt range | 380 | |

**Basic attack, Slag Lob:** every 0.7 s, a glob lands on the nearest foe within 320 px. It deals 18 and splashes 9 within 50 px. This is mid range: close enough to stay with the party, far enough to step out of a cleave.

### Action bar
| Key | Ability | Cost | Cooldown | Solo | Party |
|---|---|---|---|---|---|
| Q | **Molten Plating** | 30 | 6 s | Plates you with a ward of 15% max health for 6 s. When it breaks or runs out, it bursts for 40 within 90 px. Your own plating that runs out unspent heals you for what's left. | Plates the most hurt hero within 300 px instead, the Slagbinder included. |
| E | **Interpose** | 0 | 10 s | Leap 150 px the way you're moving, immune for 0.4 s, and knock small foes back on landing. | Leap to the most hurt ally. For 3 s you take 60% of the damage aimed at them, at 30% less. |
| R | **Cooling Shell** | 60 | 24 s | For 5 s you take 35% less damage, and anything that hits you is Brittle for 6 s (takes 15% more damage). | The 35% applies to every hero within 160 px. |
| F | **Clinker** (interrupt) | 0 | 10 s | Hurl a clinker within 380 px: it interrupts a cast and stuns the caster for 1.5 s. | With nothing to interrupt, it makes the boss Brittle for 6 s. |

Brittle is the class's party signature. It doesn't stack, so one Slagbinder in a party is the point.

**What Interpose moves (design review):** only direct hits from an enemy, such as contact, swings, slams with a source and projectiles. It never moves:
- soak telegraphs or the soak head count,
- percent-of-max-health ticks (the Crucible's heat, the Coldmarrow's cold, Ladle Burn, Slag Grip),
- telegraph hits with no source.

In code, it redirects only when the hit has a source enemy and is not unblockable.

**Weapon effects and Mythics, for parity with the other classes:**
- Weapon effects:
  - **Clinging Slag:** Lob leaves a 2 s burn.
  - **Tempered Lob:** Lob on a Brittle foe builds 3 more Slag.
- Mythics:
  - **Shared Melt:** plating an ally plates you for half, and bursts reach 50% further.
  - **Clinker Crown:** Clinker strikes a second foe and Brittle lasts twice as long, but Cooling Shell recovers 4 s slower.

**The stance persists per character**, saved with the hero like the class, and is sent to co-op peers.

### Stance: one role per run
The player picks a stance in the hub before the run, and it is locked for the run. That way one hero never fills both the tank and the healer slot of a group dungeon (design, 21 Nov 2026).

| Stance | Role for Quick join and group gates | Threat | Change |
|---|---|---|---|
| **Anvil** | Tank | ×4, like the Bulwark | Cooling Shell lasts +2 s. Clinker on the boss also taunts it, the way Shield Toss does. Plating is 25% weaker. |
| **Bellows** (default) | Damage slot | ×2 | Plating as listed above. Interpose lasts +1 s. (Not "Pour": that clashes with Grandmother Slag's pour lanes and Ladle Pour.) |

**In a party** (21 Nov 2026, PRs #294 and #308):
- A Bellows Slagbinder deals 30% less damage.
- An Anvil takes 20% less from every hit, against 35% alone (`SLAG_KIT.partyAnvilArmor`). The stance tip says so.

Anvil-tank party (Anvil Slagbinder, Lumen, Duskblade, Emberwright), 80 seeds, Crucible out of 90:

| | Hammerdeep t8 | Ashvents t8 | Pressworks t10 | Crucible t8 |
|---|---|---|---|---|
| Anvil, 35% (before) | 79 | 75 | 68 | 71 |
| Anvil, 20% | 50 (63%) | 54 (68%) | 27 (34%) | 57 (63%) |
| Bulwark tank | 45 | 54 | 59 | 55 |

The Anvil is the hard way to tank Oskel. Stamp is meant to punish a tank that can't block it. A Bulwark party wins it 59 of 80, and no group is forced into an Anvil. There is no Pressworks-only exception (design).

Solo, the stance only changes the numbers in its row. To support this, `roleOf` in sim/content/dungeon.ts takes the hero's stance as well as the class, and threat reads the multiplier from it rather than from `cls === 'bulwark'`. The Bulwark-only checks for call-outs and Smother stay Bulwark-only.

### Talents (three branches, like the other classes)
- **Forge (plating):**
  - Thick Coat: plating +20% per rank.
  - Searing Shell: plating bursts +30% per rank.
  - Quickset: Molten Plating cooldown −1 s per rank.
  - Capstones:
    - **Ever-Molten:** plating that runs out without breaking refunds 15 Slag.
    - **Twin Coat:** plating also coats a second hero.
- **Clinker (damage and Brittle):**
  - Heavy Lob: Lob +15% per rank.
  - Shrapnel: splash radius +15 px per rank.
  - Brittle Mind: Brittle lasts +2 s per rank.
  - Capstones:
    - **Breakpoint:** Brittle foes take 25% more from Slag Lob.
    - **Cinder Hail:** every 5th Lob throws three globs.
- **Crust (self-tank):**
  - Thick Skin: max health +6% per rank.
  - Hot Blood: +1 Slag per hit taken per rank.
  - Hardened: Cooling Shell lasts +1 s per rank.
  - Capstones:
    - **Clinker Heart:** below 30% health, you gain a 25% plating once every 30 s.
    - **Slag Tide:** Interpose's landing deals 60 and stuns for 1 s.

Each branch gets 3 card talents and two capstones from the start, so this class ships at C5 parity.

### Bot
- Plate on cooldown: yourself solo, the most hurt hero in a party.
- Interpose an ally below 50% who is the target of a telegraph or boss cast.
- Cooling Shell below 55% health, or when 3 or more foes are in melee reach.
- Clinker: casts first, then the boss for Brittle.
- Hold mid range (about 220 px) and step out of telegraphs as the Lumen does.

### What other teams need
- **Visuals:**
  - Four ability icons (ABILITY_GLYPH.slagbinder).
  - A class sprite: a heavy figure in cooling slag plate, with an orange glow in the seams.
  - A plating ring on the plated hero.
  - A Brittle crack mark on foes.
- **Sound:**
  - Cues for Lob, plating applied and plating burst, Interpose leap, Cooling Shell, Clinker, and Brittle applied.
- **Engineering:**
  - The new ClassId in the hub, the class picker, save files and Quick join role badges.
  - Its role comes from the stance: Anvil counts as tank, Bellows as a damage slot. The hub's party role chips (client/hub.ts) need a stance toggle for the Slagbinder.

### Balance targets
- The same as L7:
  - At tier 1 on the Kiln, within ±10 of the Emberwright for the good bot and the novice reference.
  - Within ±15 at tiers 6 and 8 on the Foundry and the Kiln, using heroes built with tools/progression.ts.
- Solo hashcheck for the four existing classes must stay identical.
- In parties, swapping the Slagbinder for a damage dealer shouldn't raise a full party's Crucible win rate above about 70%.

### Build notes and balance (21 Nov 2026)
**Tuning lives in `SLAG_KIT` in sim/world.ts.** What changed from the draft while building:
- **Slag Lob:** 20 damage, and Heavy Lob is +30% per rank. It strikes an acolyte that is healing a wounded boss first, as Sunmote does. Before that, the Kiln Mother out-healed it: the good bot won 0 of 40 at Kiln tier 1.
- **Molten Plating:** a pool of its own (`plate`), separate from ward. It stops blows but never unblockable ticks (heat, cold, Ladle Pour, Slag Grip). While it soaked them, a Slagbinder in place of the Duskblade won the Crucible 30 of 30. Now it wins 20 of 30, the same as the Duskblade.
- **Anvil stance:** takes 35% less damage and has +40 max health. Without that, an Anvil tank won 1 of 30 in the Crucible.
- **Clinker:** stuns for 2 s, like every interrupt.
- **Slag:** passive regen is 1 a second, like the Bulwark's Resolve. There is no out-of-combat cooling.

**Balance.** Wins out of 40, 40 seeds. "Fair" means the Slagbinder plays the Duskblade's heroes-r2 profiles, because a Slagbinder hero built with tools/progression.ts reaches tier 8 at level 12, against level 8 for the heroes-r2 heroes.

| | Kiln 1 good | Kiln 1 novice | Foundry 4 | Foundry 6 | Foundry 8 | Kiln 4 | Kiln 6 | Kiln 8 |
|---|---|---|---|---|---|---|---|---|
| Slagbinder | 40 | 33 | 31.3 | 24.0 | 18.3 | 18.7 | 20.0 | 10.3 |
| Emberwright | 34 | 26 | 32.3 | 30.3 | 28.7 | 29.0 | 30.0 | 19.0 |

Every cell is within the L7 bands (±10 at tier 1, ±15 at tiers 6 and 8). It is the weakest solo class at tier 8, which suits a support hybrid, and it's the first thing to raise if players find it slow.

**Group content:** heroes-r2 hero-t8-0 and hero-t6-0, 30 seeds.

| Party | Wins |
|---|---|
| Crucible 8: Bulwark, Lumen, Duskblade, Emberwright | 20/30 |
| Crucible 8: Bulwark, Lumen, Bellows Slagbinder, Emberwright | 20/30 |
| Crucible 8: Anvil Slagbinder, Lumen, Duskblade, Emberwright | about 7/30 |
| Hammerdeep 6: Bulwark tank | 29/30 |
| Hammerdeep 6: Anvil Slagbinder tank | 23/30 |

The Anvil can tank the Hammerdeep but is far behind the Bulwark in the raid, mostly to Ladle Pour with Slag Grip stacks. That's open with design.

## Group tools (roadmap G1)

Each class has one tool for party play. All of them are skipped with only one hero, so solo play is unchanged: `tools/hashcheck.ts` fingerprints are identical. Tuning is in `GROUP_TOOLS` in `sim/world.ts`, and the tests are in `tests/grouptools.test.ts`.
- **Bulwark, Called Out:** Shield Toss with nothing to interrupt taunts the boss back when it's on another hero (within 420 px). `World.tauntCue` is true while the boss is on someone else and Charge or Shield Toss is ready, for the HUD to show. The bot uses Shield Toss, or Charge when Charge would hit the boss.
- **Lumen, Purify:** Hush with nothing to silence clears Slag Grip from the ally in range (500) with the most stacks, at full cooldown. It doesn't heal and doesn't clear Sundered, which is answered by Anvil Skin or a taunt swap. `World.purifyTarget()` names the ally.
- **Emberwright, Kindling:** Combustion lifts the damage of allies within 320 px by 10% for 6 s (`Player.kindleUntil`).
- **Duskblade:** Sidestep already halves its threat in co-op. The bot now Sidesteps when it pulls the boss off a living Bulwark.

Measured with `tools/group.ts`, heroes-r2 hero-t6-0, 60 seeds, against Ondrel after #55. Numbers are wins out of 60.

| Party | Main | With the tools |
|---|---|---|
| Full party (Bulwark, Lumen, Duskblade, Emberwright), tier 6 | 40 | 44 |
| No healer, tier 6 | 6 | 5 |
| No tank, tier 6 | 1 | 1 |
| Bulwark and Lumen pair, tier 6 | 15 | 15 |
| Full party, tier 8 | 11 | 8 |

A first Purify that also healed for 8% of max health took the full party to 57 and the pair to 47, so it was cut to a cleanse. Clearing Sundered as well made it 59 and 54.

## Class weapon effects (roadmap R4)

An Epic or Mythic weapon found by a class carries one of that class's two weapon effects. The effect is picked from the item id, so no other roll changes. Each effect changes the class's basic attack. That keeps them separate from talents, which change abilities and stats, and from Mythics, which change abilities. Data is in `WEAPON_FX` (`sim/content/items.ts`), and the item tooltip shows the effect.

| Class | Effect | What it does |
|---|---|---|
| Emberwright | Piercing Cinders | Cinder Volley orbs pass through the first small foe they hit |
| Emberwright | Banked Flame | Every 5th orb hits for 2.5 times the damage |
| Duskblade | Cast-Cutter | Swings hit a casting foe 35% harder |
| Duskblade | Worrying Edge | Each swing at the same target hits 2.5% harder, up to 5 stacks |
| Bulwark | Rallying Sweep | Shield Sweep builds 2 more Resolve for each foe past the first |
| Bulwark | Warding Sweep | A sweep that hits a big foe shields you for 1.5% of max health |
| Lumen | Tender Light | A Sunmote's heal is doubled on a hero below half health |
| Lumen | Rebuking Light | Sunmotes hit a casting foe 25% harder |

Game design's Kiln set rewards an interrupt *after* the cast stops, so Cast-Cutter and Rebuking Light, which reward hitting *during* the cast, stack only in a small way. Tests are in `tests/weaponfx.test.ts`.

## Class Mythics (roadmap R4)

Each class has two Mythics of its own, on top of the shared four. A Mythic should change how the class plays, not just add numbers. The bar: at tier 6 each one stays within 3 wins of its class baseline. A Mythic drops only for its own class (`mythicPool` in `sim/content/items.ts`). Names were checked against existing games on 20 Nov 2026.

| Class | Mythic | Effect | Plays as |
|---|---|---|---|
| Emberwright | Wanderer's Wake | Blink recovers twice as fast and burns its whole path. Flame Wave no longer knocks back. | A kiting fire-trail mage |
| Emberwright | Banked Heart | Combustion bursts around you (radius 190), and each kill gives back 15 Heat. It still goes for an acolyte when one is in reach, so the Kiln's healers still die. | A close-range horde-clearer |
| Duskblade | Mirrorstep | Sidestep recovers 2 s sooner and leaves a 2 s afterimage that strikes with your swings for half damage. | A dodge-weaver |
| Duskblade | Red Ledger | Execution doubles below 50% health instead of 35%, and an Execution kill brings Rending Dash back. | A chain executioner |
| Bulwark | Tethered Shield | Shield Toss interrupts up to 3 casters, and for 4 s Charge rushes the first one, from up to 640 away. | A mobile interrupter |
| Bulwark | Ringwall Vow | Shield Block guards every side for 20% instead of the front for 35%. Rim Smash pulls the horde in, but still shoves big foes so it can steer them out of blooms. | A gather-and-hold tank |
| Lumen | Anchored Dawn | Sanctuary lasts 50% longer but stays put, even with Lingering Sanctuary. Radiant Burst recovers 50% faster inside it. | An anchored battle-priest |
| Lumen | Eclipse Glass | Radiant Burst reaches 10% further and deals 40% more damage, but heals half as much. | A damage Lumen |

Tests are in `tests/mythics.test.ts`.

## Ability options (one swap per class)
From hero level 8 (`ALT_UNLOCK_LEVEL`), each class can swap one action-bar slot for a sidegrade. The interrupt (F) is never swapped. The pick is made in the hub under the class picker, locked for the run, and saved per character (`alt` in CHARACTER_KEYS and the co-op HeroCard). Definitions are in `ALT_ABILITIES` in sim/content/classes.ts, and tuning is in `ALT_KIT` in sim/world.ts.

| Class | Slot | Replaces | Option | Cost / cooldown | What it does |
|---|---|---|---|---|---|
| Emberwright | E | Blink | Ember Ward | 0 heat / 10 s | A ward of 25% max health for 3 s that stops blows. Foes that strike it burn (12 a second for 3 s). |
| Duskblade | Q | Rending Dash | Hamstring | 25 / 5 s | 55 damage and a 4 s bleed (12 a second) on the foe in reach, and a 4 s slow on it and foes within 120 px. |
| Bulwark | R | Anvil Skin | Muster | 50 / 20 s | In a party, heroes within 200 px take 25% less for 5 s. Alone, you mend 15% of max health over 5 s. |
| Lumen | E | Glimmer Step | Glow Pool | 0 / 12 s | A 90 px well for 6 s that heals anyone in it 3 a second, in two pulses a second. |
| Slagbinder | E | Interpose | Cinder Sump | 0 / 10 s | An 80 px pit at your target for 5 s: it burns (10 a second) and slows foes in it by 40%. |

Design's conditions (21 Nov 2026), all built in:
- **Ember Ward** never stops Glare, the Long Night, Ladle Pour or percent ticks. It shares the plate pool, which only stops blockable hits, and Glare sets a `verbHit` flag so wards skip it.
- **Glow Pool** never clears Slag Grip or Ladle Burn: it heals through `healAllies(…, cleanse = false)`.
- **Hamstring and Cinder Sump** slow bosses, elites, rares and named foes by 20% at most. Only normal foes get the full slow.
- **Muster** must keep the Crucible full party at or under about 70% (21/30).
- **Drafts:** a talent tagged with `ability` (the slot it upgrades) is never drafted when that slot is swapped.

**Bot:** `altCast` in sim/bot.ts presses the option, and the class's own logic can't press the swapped slot. Interrupts still come first.

**Tools:** ALT=1 turns the option on in tools/balance.ts, tools/group.ts and the matrix's foundry2.ts. In group.ts, ALT=bulwark,lumen turns it on for those classes only.

**Placeholders:** the option glyphs (`ALT_GLYPH` in client/icons.ts) and the cast effect (a ring and the name) are placeholders until visuals draws them. Sound can tell an option apart by `alt: true` on the 'ability' event.

## Branch coverage: defence branches deal damage (21 Nov 2026)
`BOT_BRANCH=<branch>` (balance tools only, sim/bot.ts) makes the bot draft one branch until its capstone, so every branch can be measured. At Foundry t6, 40 seeds, 13 of 15 branches were within noise of their class default. Two were traps:
- **Ashguard** (Emberwright): 4 of 40 against the default 31, and 0 of 40 at Kiln t6.
- **Crust** (Slagbinder): 14 of 40 against 30, and 0 of 40 at Kiln t6.

Both survive but run out of time: the boss enrages at 150 s. The fix (tuning in `DEFENCE_BRANCH`, sim/world.ts), with the card texts stating the numbers:
- **Ring of Ash:** 45 damage a touch (was 16), 200 px out (was 78).
- **Cinder Skin, Mend in Embers:** +6% damage per rank.
- **Clinker Heart:** +50% damage while plated. The health cards are unchanged.

**Balance,** 80 seeds, heroes-r2 (Emberwright) and heroes-fair (Slagbinder), hero-t*-0:

| | Foundry t6 | Kiln t6 |
|---|---|---|
| Ashguard forced, before (40 seeds, doubled) | 8 | 0 |
| Ashguard forced, after | 67 | 47 |
| Emberwright default | 61 | 53 |
| Crust forced, before (40 seeds, doubled) | 28 | 0 |
| Crust forced, after | 61 | 27 |
| Slagbinder default | 58 | 35 |

Novice reference (LAG=0.3 SKILL=0.5), Emberwright Kiln t1, 160 seeds: Ashguard 82 before, 84 after; default 64.

Default bots, main against this branch, 80 seeds: Emberwright Foundry 6/8 61/61, 56/57; Kiln 6/8 53/53, 38/38; Slagbinder Foundry 6/8 57/58, 58/59; Kiln 6/8 34/35, 32/34; Hammerdeep t8 42/43, with the Slagbinder 67/66; Crucible (of 90) 56/56. All within noise. Clinker Heart sweep (40 seeds, Foundry/Kiln t6): +30% 26/6, +50% 30/13, +80% 34/26, +120% 35/37.

### Kiln pass: Forge, Grace and Wildfire
The same check at Kiln t6, 80 seeds, found three more branches outside ±10 of 40 of their class default: Forge 2 (default 35), Grace 45 (default 79) and Wildfire 32 (default 53). Clinker was 72, above the Slagbinder default but below Lumen's 79, so design left it alone.

The fix, also in `DEFENCE_BRANCH`, with every number stated on the card:
- **Twin Coat** (Forge capstone): +40% damage while plated.
- **Renewal and Gleam Guard** (Grace): +8% damage per rank. A Haven rider was tried first (design's pick), but it levelled off: Haven forced, +100% damage in the Sanctuary won 54 of 80, and +150% won 28 of 40. The Lumen isn't in its Sanctuary often enough. The per-rank cards also cover runs that take Martyr's Halo.
- **Kindled Ground** (Wildfire): +6% damage per rank.

`BOT_CAP=<capstone>` (balance tools only) makes the bot take that capstone over its twin.

**Forced branches,** 80 seeds:

| | Foundry t6 | Kiln t6 |
|---|---|---|
| Forge, before | n/a | 2 |
| Forge, after | 66 | 22 |
| Grace (Martyr's Halo), before | n/a | 45 |
| Grace (Martyr's Halo), after | 75 | 76 |
| Grace (Haven), after | 75 | 65 |
| Wildfire, before | n/a | 32 |
| Wildfire, after | 60 | 40 |
| Clinker (unchanged) | n/a | 72 |

**Default bots,** main cd4a9de against this branch, 80 seeds:

| | Foundry 6 | Foundry 8 | Kiln 6 | Kiln 8 |
|---|---|---|---|---|
| Emberwright | 61 / 61 | 57 / 59 | 53 / 55 | 38 / 41 |
| Lumen | 73 / 73 | 63 / 63 | 79 / 79 | 60 / 60 |
| Slagbinder | 58 / 69 | 59 / 70 | 35 / 44 | 34 / 48 |

The default Slagbinder bot drafts Twin Coat often, so fixing Forge lifts the class by about 5 to 7 of 40. Parties: Hammerdeep t8 43 / 45, with the Slagbinder 66 / 70; Crucible 56 / 55 of 90. Fill bots (Bulwark plus three bots, Hammerdeep t8): 34 / 30, still under the real party. Replay fingerprints are identical to main.

Design accepted the Slagbinder rise (it was the weakest class at Kiln). Against the new default, Forge at Kiln t6 is just outside at -11 of 40, like Wildfire was at -10.5. Clinker (72) stays untouched because it is under Lumen's 79.

## Slagbinder in a party: party-only trim (21 Nov 2026)
With a Bellows Slagbinder in place of the Duskblade (Bulwark, Lumen, Slagbinder, Emberwright, hero-t8-0 from heroes-fair), every group dungeon was above its 55 to 70% band, or the raid's 70% ceiling. Design asked for a trim that leaves solo play alone.

**Where the edge comes from** (Hammerdeep t8, 40 seeds, 32 wins as the base):
- With every ally effect off (shell and plating on allies, Interpose, Brittle for allies), it still wins 30.
- With its own shell and plating also off, it wins 28.
- The edge is mostly the Slagbinder's own damage and the way it survives Anvilfall. Little of it comes from what it gives allies.

**The trim,** in `SLAG_KIT` (sim/world.ts). Every part applies only with allies and is stated in the game:
- **Bellows damage in a party:** x0.7 (`partyDmg`). The stance tip says "In a party, you deal 30% less damage." An Anvil Slagbinder isn't touched.
- **Cooling Shell on allies:** 20% less damage, against 35% for the wearer (`allyShellCut`). The ability text says so.
- **Molten Plating on an ally:** half as thick (`allyPlate`). The ability text says so.

**Results,** main 5b42ce0 against this branch, 80 seeds (Crucible out of 90), no potions:

| | Main | Branch | Band |
|---|---|---|---|
| Hammerdeep t8 | 70 (88%) | 44 (55%) | 55 to 70% |
| Ashvents t8 | 65 (81%) | 54 (68%) | 55 to 70% |
| Pressworks t10 | 73 (91%) | 65 (81%) | 55 to 70% |
| Crucible t8 | 72 (80%) | 52 (58%) | 70% or under |

The Duskblade party on the same main wins Hammerdeep 45, Ashvents 54 and Pressworks 59 of 80. So the Pressworks is above its band (74%) without a Slagbinder too: that's the dungeon's tuning. The Slagbinder party now sits close to the Duskblade one everywhere.

Solo replay fingerprints are identical to main, so solo L7 is unchanged.

**Watch:** an Anvil Slagbinder tanking the Hammerdeep t8 (Slagbinder, Lumen, Duskblade, Emberwright) wins 78 of 80 on main and 79 on this branch, against 45 for a Bulwark tank. That was there before this change.

### The Anvil as a party tank
An Anvil Slagbinder tanking (Slagbinder, Lumen, Duskblade, Emberwright, heroes-fair hero-t8-0) was far above every band.

**Ablation** (Hammerdeep t8, 40 seeds, base 40 of 40):
- With no Anvil damage cut it wins 2. With no plating it wins 15, with no shell 25, with no ally effects 32, and with no extra health 35.
- Cutting only blockable hits by 35% changes nothing (79 of 80). The strength is the Anvil's 35% cut on unblockable hits: Anvilfall, Stamp, Glare.

**The trim:** with allies, the Anvil's cut is `SLAG_KIT.partyAnvilArmor` = 20%. Alone it keeps `anvilArmor` = 35%. The stance tip says "hits land 35% lighter (20% in a party)".

Sweep, 80 seeds (Crucible out of 90):

| Party cut | Hammerdeep t8 | Ashvents t8 | Pressworks t10 | Crucible t8 |
|---|---|---|---|---|
| 35% (main 633b46a) | 79 | 75 | 68 | 71 |
| 30% | 70 | 72 | 59 | 66 |
| 25% | 62 | 62 | 49 | 64 |
| **20% (this change)** | **50** | **54** | **27** | **57** |
| 15% | 36 | 37 | 21 | 50 |
| Bulwark tank, for reference | 45 | 54 | 59 | 55 |

At 20% the Anvil matches the Bulwark in three of the four. The Pressworks is the exception: Oskel's Stamp kills the Anvil there, so it becomes the hard way to tank it (34%). Solo replay fingerprints are identical to main.

## The Hoard: class coverage (Y5, 21 Nov 2026)
Measured on the Hoard t9 with tools/group.ts, heroes-r2 hero-t8-0 (the Slagbinder on the Duskblade's files), 40 seeds, no potions. The band is 22 to 28 of 40.

**The bug:** Slag Lob, Sunmote and the Emberwright's first orb always lock onto a boss in range. Only blades (`bladeTarget`) ever went for the Craw. A party without a Duskblade couldn't break it, so its swallowed heroes were Digested. The Anvil tank also kited Old Vorhulm away from the Craw, so even the Duskblade lost reach.

**The fix:**
- While the Craw is up and in range, it comes first for all three (`crawIn` in sim/world.ts).
- A hero more than 280 px from it walks to it (sim/bot.ts). The boss follows its tank there.
- Solo play can't meet a Craw, so solo replay fingerprints are identical to main.

| Party | Before | After |
|---|---|---|
| Base: Bulwark, Lumen, Duskblade, Emberwright | 27 | 38 |
| Two Duskblades | 31 | 34 |
| Two Emberwrights | 18 | 37 |
| Bellows Slagbinder for the Duskblade | 12 | 36 |
| Bellows Slagbinder for the Emberwright | 31 | 38 |
| Anvil Slagbinder as the tank | 0 | 37 |

The class spread is gone: every party now wins 34 to 38. That puts the Hoard over its band. COAL was tuned around a Craw that only blades could break, so design retunes it (design, Y5).

## The Smeltery: class coverage (22 Nov 2026)

Does every class and stance work the Cinder Colossus's open back? Measured at t10, 40 seeds, heroes-fair hero-t8-0, tallying each hero's damage on him by side (front x0.5, side x1, back x1.5) until Meltdown cracks the plate.

- Every non-tank hits his back: 93 to 98% of each hero's damage, for the Lumen, the Duskblade, the Emberwright and the Slagbinder (Bellows), in every party below, and with the Kindling, Wildfire, Bloodletting and Tempo branches forced. With `NOFLANK=1` it drops to 12 to 32% and the party wins 0 of 40.
- **Bug fixed:** a burn or bleed ticks while the boss's target (the tank) is swapped in, so every tick was judged from the tank's spot in front of him, at half. Now each tick is judged from the hero who lit it (`Enemy.burnBy`). Only the Colossus reads it, so solo fingerprints and every other dungeon are unchanged. Test: `tests/smeltery-dots.test.ts`.

**Correction (22 Nov 2026):** the table that was here used heroes-fair, my scratch copy of heroes-r2 with a Slagbinder linked to the Duskblade's files. The design tables used heroes-r2, which had no Slagbinder, so `tools/group.ts` ran it with no gear, no passives and the default level. heroes-r2 now has a `slagbinder` folder (copies of the Duskblade's files, same item level), and `tools/group.ts` warns when a hero file is missing. Every number below uses that fair set.

| Party (wins of 40) | Hoard t9 | Smeltery t10, main | Smeltery t10, Meltdown ring fix |
|---|---|---|---|
| Base: Bulwark, Lumen, Duskblade, Emberwright | 26 | 28 | 32 |
| Two Duskblades | 24 | 39 | 39 |
| Two Emberwrights | 28 | 25 | 31 |
| Bellows Slagbinder for the Duskblade | 33 | 19 | 21 |
| Bellows Slagbinder for the Emberwright | 36 | 37 | 35 |
| Anvil Slagbinder tank | 37 | 22 | 39 |

The Hoard column is before design's COAL fix (#341), which changes it.

### Meltdown: ranged damage heroes keep their ring

All Smeltery losses are Meltdown wipes with the boss at 0 to 9%, so phase 3 is a damage race against growing pulses. Per hero, boss damage a second in phases 1, 2 and 3 (base party, 16 seeds):

| Hero | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| Duskblade | 258 | 265 | 218 |
| Emberwright | 334 | 322 | 174 |
| Lumen | 314 | 303 | 169 |

His back takes x1.5 until Meltdown, so x1 in phase 3 should cost a third: the Emberwright should land near 223, but it fell to 174. Once `colossusFlank` stopped at Meltdown, the ranged bots drifted out of reach (they back off a boss inside 200 px and nothing brings them back). Now an Emberwright or a Slagbinder keeps its ring in phase 3 (any side does, since the plate is gone), and it deals 222. The blades and the Lumen still fight as usual. Keeping the Lumen on the ring too cost the two-Duskblade party 6 of 16 wins (16 to 10; I did not trace why). Test: `tests/smeltery-bot.test.ts`. Only Smeltery party runs change; solo fingerprints are identical.

What's left at the Smeltery: two Duskblades 39 and the Anvil party 39 are over the band, and Bellows for the Duskblade (21) is under it. The base party moves from 28 to 32 with the fix, so COLO needs a re-centre after it (design).

### Meltdown: the Lumen heals the tank first

With the ring fix and the Colossus at 19000 health (design's re-centre), parties without a Duskblade still lost Meltdown on the tank. In phase 3 the Bulwark recovered only 0.12 of its health and died in 11 of 20 runs in the Bellows-for-Duskblade party, against 0.50 recovered and no deaths with two Duskblades (17750 health, 20 seeds). The Lumen bot follows the lowest hero, and in Meltdown the pulses keep everyone low, so it stayed on the back ring.

Now, at the Smeltery in phase 3, a Lumen goes to the tank whenever the tank is under `MELT_TANK_FIRST` (0.6) of its health, and to the lowest hero otherwise. Smeltery t10, heroes-r2, 40 seeds, Colossus at 19000:

| Party | Before | After |
|---|---|---|
| Base | 24 | 25 |
| Two Duskblades | 33 | 33 |
| Two Emberwrights | 27 | 29 |
| Bellows Slagbinder for the Duskblade | 17 | 25 |
| Bellows Slagbinder for the Emberwright | 32 | 32 |
| Anvil Slagbinder tank | 35 | 29 |

Before is design's table on #342. The rule only runs at the Smeltery, so every other dungeon and the solo fingerprints are unchanged. Test: `tests/smeltery-bot.test.ts`. Still over 70%: two Duskblades (33) and Bellows beside a Duskblade (32).

### Plate Shift: the Anvil tank holds him close (W7, 22 Nov 2026)
An Anvil tank (a ranged Slagbinder) fights the Colossus from about 340 px. In his Plate Shift version that cost the Anvil party half its wins. With the version forced, seeds 1-80 at t10, it won 39/80 against 59/80 in the Wheel version. The pace through phases 1 and 2 was the same. The gap opened in Meltdown, which took 138 s in winning Shift runs against 123 s in Wheel runs, with the Lumen and the Emberwright dealing less there.

The bot now holds him at `ANVIL_SHIFT_HOLD` (200 px, the edge of his Slag Sweep), in Plate Shift only (`anvilHold` in sim/bot.ts). It doesn't hold while one of his telegraphs is out. `NOANVILHOLD=1` turns it off.

| Anvil party, version forced | Shift | Wheel |
|---|---|---|
| main, before | 39/80 | 59/80 |
| main, after | 60/80 | 59/80 |
| #458 (Colossus 19500, wider pools), seeds 1-160, before | 59/160 | 119/160 |
| #458, seeds 1-160, after | 117/160 | 119/160 |
| main, fresh seeds 81-160, before / after (trial) | 42/80 / 61/80 | |

I measured the hold distances before picking 200 (Shift / Wheel, seeds 1-80): 160 px gave 62 / 49, 200 px gave 63 / 48, 240 px gave 46 / 60 and 280 px gave 38 / 58. That's why it's Shift only. I haven't found why the distance matters in one version and not the other. Holding the ranged damage heroes on the inner edge of their ring in Meltdown made things worse (Anvil 29 / 26), so it isn't simply their reach.

## Crawsplitter trim (A4, 22 Nov 2026)

Base party, Hoard t9, heroes-r2 hero-t8-0, all four heroes in the 3-piece, seeds 1 to 120. Wins of 120, with the blocks of 40 in brackets. The control tags the gear Platewalker, which does nothing in the Hoard: tagged pieces are kept by the bot (`breaksSet`), so part of any set's lift is the tag.

| Case | Wins |
|---|---|
| Control (Platewalker tag) | 83 (31, 27, 25) |
| Full Crawsplitter, csCraw 0.25 | 108 (37, 33, 38) |
| csCraw 0 | 88 (33, 27, 28) |
| csFreed 0 | 111 (38, 35, 38) |
| Both 0 | 83, seed for seed the control |
| csCraw 0.03 | 95 (35, 30, 30) |
| **csCraw 0.05, chosen (#355)** | **91 (32, 25, 34)** |
| csCraw 0.08 | 100 (35, 30, 35) |

The Craw bonus carried the whole lift. Its effect is a threshold (break the Craw before the 8 s Digest), so it is not linear. 0.05 adds +2.7 per 40 over the control, inside the 2 to 7 of earlier sets, and leaves room below the jump at 0.08 (design's call).

## The Flue: a lighter Bellows cut (B6, 22 Nov 2026)

After design's retune of the Flue (base 80 of 120), one party stayed under the band: a Bellows Slagbinder beside an Emberwright, at 18 of 40. The Flue is a damage race, where the Bellows' Brittle and sustain count for less than raw damage. Bellows party cut, seeds 1 to 80, wins of 80:

| Party | Cut | Flue t11 | Hoard t9 | Smeltery t10 |
|---|---|---|---|---|
| Bellows with an Emberwright | 0.7 | 39 | 48 | 53 |
| Bellows with an Emberwright | 0.85 | 48 | 52 | 56 |
| Bellows with an Emberwright | 1.0 | 47 | - | - |
| Bellows with a Duskblade | 0.7 | 50 | 65 | 69 |
| Bellows with a Duskblade | 0.85 | 56 | 69 | 66 |
| Bellows with a Duskblade | 1.0 | 57 | - | - |

A raid-wide 0.85 would push the Hoard's Bellows-with-Duskblade party (already 81%) further over, so the lighter cut is the Flue's only: `SLAG_KIT.fluePartyDmg` 0.85. The Bellows tip in the hub says so. Test: tests/party-cards.test.ts.

### The Regent's Summons: bots walk in before the call (W7, 22 Nov 2026)
In his court version the Regent calls a Summons with every Ash Fall in phase 2: after 2.5 s, every hero more than 130 px from him is struck. A ranged hero standing 300 px out spends about 1.5 s of that warning leaving its own Ash circle, so it can't reach him in time. The Anvil Slagbinder tanks from about 336 px and took 61 of 297 Summons itself, and Lumen was struck on 38% of calls in that party (11% in base).

A player learns the cadence after one Summons, so bots now walk in to the throne `BOT_SUMMONS_LEAD` (2 s) before it is due (`World.summonsDue()`). `NOCOURT=1` turns this off along with the existing walk-in. Measured at Flue t11, heroes-r2 hero-t8-0, seeds 1-160 split by version:

| Party | Court before | Court after | Ash (unchanged) |
|---|---|---|---|
| base | 46/80 | 55/80 | 55/75 |
| two Duskblades | 51/80 | 58/80 | 52/78 |
| two Emberwrights | 31/74 | 59/74 | 53/73 |
| Bellows + Emberwright | 35/71 | 41/71 | 50/68 |
| Bellows + Duskblade | 59/80 | 54/80 | 53/74 |
| Anvil tank | 21/76 | 47/76 | 50/72 |

An Anvil-only rule (hold the Regent close in phase 2) moved the Anvil row only from 21 to 24/76, because the healer and the caster were still struck. Design re-tunes the Summons itself afterward, aiming base near 62%.

## Raid trash floors: class check (E6, 22 Nov 2026)
Phase 13 E1 (#462) gave each raid's openers and named fight open, open, pillars or vents. The boss fight is always open.

**What the floors do.** Stones only block movement (`clampArena`). Nothing checks them for shots, orbs or Radiant Burst, so there are no lines of fire to block. Vents flare in turn, as they do in the solo dungeons.

**Measured.** 6 parties (base, two Duskblades, two Emberwrights, Bellows with an Emberwright, Bellows with a Duskblade, Anvil tank) in 4 raids at their tiers, seeds 1-80, heroes-r2 hero-t8-0, on main after #467.

"Held up" counts ticks where a bot pushed to move at over half speed but covered less than 30% of a step, as a share of its moving ticks in trash fights:

| Class | Open | Pillars | Vents |
|---|---|---|---|
| Bulwark | 0.08% | 0.52% | 0.09% |
| Lumen | 0.08% | 0.76% | 0.08% |
| Duskblade | 0.08% | 0.72% | 0.06% |
| Emberwright | 0.07% | 0.68% | 0.06% |
| Slagbinder | 0.06% | 0.70% | 0.06% |

Trash fights by floor (all 6 parties pooled; fights, mean seconds, hero deaths, wipes):

| Raid | Open | Pillars | Vents |
|---|---|---|---|
| Crucible t8 | 648, 59 s, 0, 0 | 372, 56 s, 0, 0 | 420, 58 s, 0, 0 |
| Hoard t9 | 648, 73 s, 3, 1 | 370, 70 s, 0, 1 | 419, 73 s, 0, 0 |
| Smeltery t10 | 645, 90 s, 5, 5 | 368, 86 s, 3, 2 | 416, 91 s, 3, 1 |
| Flue t11 | 634, 105 s, 24, 15 | 360, 102 s, 14, 6 | 412, 110 s, 21, 10 |

Every class gets round a stone the same way, and pillar fights are a little shorter. The Flue's vent fights run 5% longer, with deaths a little higher per fight (0.051 vs 0.038), but no class carries it. So no class change is needed.

**A measuring trap.** Forcing the same trash fights open on the same seeds gave a few big win swings in the boss fight. For example, Flue Anvil won 35/80 with layouts against 52/80 forced open, though the boss arena is open in both. The floors change how many run-rng draws the trash uses, so the drafts and the boss fight roll differently. A control that keeps the fights open but adds 1, 2 or 3 extra rng draws per fight gave 39, 39 and 38 of 80. So the 52 was luck, not the floors. Compare floors on the trash itself, or use 320 seeds or more for the whole run, as design did (#462).

## Marks and arena events: class check (X5, 23 Nov 2026)
Phase 14 gave the named foes two more affixes (Brood, Smoldering; X2) and gave the solo trash fights arena events (Cave-in, Vent Surge, Cold Snap, High Water; X3). X5 asks whether every class has an answer to each one.

**How it was measured.** The harness is skills scratch: tmpm/x5.ts, kept in the project files as balance/x5-harness.ts. It runs the good bot, solo, with heroes-r2 hero-<tier>-0 files. A forced row puts a named foe in every delve and gives it the one affix (`NAMED.forceNamed = 1`, `NAMED.forceAffix`), with arena events off. An event row forces that event (`ARENA_EVENTS.force`). Base rows turn events off and leave the named foe rolled as usual. Each cell gives wins and, per fight kind, hero deaths. Tiers: Kiln and Foundry t6, Glarewell t8, Coldmarrow t10, Wrackline t13. The Wrackline is out of reach with t8 gear (0 to 15 of 40), so its rows are only a relative baseline.

**Screen.** First all 165 cells on 40 seeds: on #477's head, then again on main after #477. Every cell that came out 6 or more below its own base then got 160 seeds (41 to 200).

**What changed from the screen.** Every fix was on the fight side. No class needed a talent.
- #477: Warded's shield 0.35 → 0.2 of health, and Blooms never heal a named foe. A Swift Sluice Crawler had been healing in its own Bloom.
- #488: the named foe's fight gets 60 s more before Burnout (`BURNOUT.named`), and in the Coldmarrow a named foe feeds coal as it loses health (`COLD.namedFeed` 0.07 per tenth). A ranged hero's Warded fight there used to outlast the coal, and the Long Night's Chill killed it about 153 s after the foe appeared. That was the coal, not Burnout: `BURNOUT.named` 0 and 60 gave the same Coldmarrow results.

Wins out of 160, seeds 41 to 200, every named foe Warded:

| Cell | Before #488 | After #488 | Base |
|---|---|---|---|
| Coldmarrow t10 Emberwright | 83 | 128 | 131 |
| Coldmarrow t10 Slagbinder | 81 | 109 | 103 |
| Coldmarrow t10 Lumen | 116 | 125 | 125 |
| Foundry t6 Slagbinder | 105 | 126 | 127 |

**The rest of the 160-seed checks, on main after #488:**

| Cell | Forced | Base | Reading |
|---|---|---|---|
| Coldmarrow Emberwright, Brood | 130 | 131 | level |
| Coldmarrow Slagbinder, Vengeful | 110 | 103 | level |
| Kiln Bulwark, Brood / Swift / Vengeful / Smoldering / Warded | 133 / 126 / 135 / 134 / 136 | 142 | rng reshuffle (controls 128 to 136) |
| Kiln Duskblade, Cave-in / Vent Surge | 87 / 86 | 99 | rng reshuffle (controls 79 to 93) |
| Glarewell Emberwright, Swift / Vengeful | 148 / 142 | 146 | level |
| Glarewell Emberwright, Warded | 131 | 146 | real, accepted (below) |

The control is base plus 1, 2 or 3 extra run-rng draws per fight, as in E6. The Kiln losses all land at the boss, with 0 to 2 deaths in the named or event fight, and the controls spread just as wide.

**Accepted: the Glarewell Emberwright against a Warded Brandkeeper.** It dies in the named fight 21 times in 160, against 4 in base. Solo, a Brand always bursts on the hero (35 damage at t8, every 11.8 s), and the Emberwright brings no healing into the fight. At 365 health it falls at the eleventh Brand, 127 s after the foe appears (seed 59: the foe at 24%). In that run 21 heroes died in the named fight with the foe still standing, 17 of them exactly 127 s after it appeared. Forced on every run it costs 9% of wins. In real runs (a named foe in half the delves, Warded about one affix in five) it is about 1.5 in 160, so it stays. If it ever needs closing, the knob is the Brand's cadence on a named Brandkeeper, not an Emberwright talent.

**Also accepted:** a forced Cold Snap in the Coldmarrow costs 9 to 12 of 160 for the Emberwright, the Lumen and the Slagbinder. Design kept it after cutting `snapCut` to 0.2 (#477).

## Wave shapes, stirs and third versions: class check (Y5, 23 Nov 2026)
Phase 15 gave trash fights wave shapes (Y1), made the dungeon stir after clean fights (Y10), and gave every boss a third phase-2 version (Y3). Y5 asks whether every class and party can answer each one. All the fixes landed on the fight side. Two bot rules were tried and dropped, and no class needed a new talent.

**How it was measured.** Everything uses heroes-r2 files and the good bot. Solo cells come from tools/foundry.ts, or from the X5 harness with a wave tag added (balance/y5-harness.ts in the project files). Party cells come from tools/group.ts with five parties: base (Bulwark, Lumen, Duskblade, Emberwright), Anvil (an Anvil Slagbinder tanks), Bellows (the Slagbinder replaces the Duskblade), two Duskblades, and two Emberwrights. Boss versions are forced with `BOSSV` on the same seeds (41-200), so the trash is identical and only the boss fight differs. Wave shapes are forced with `WAVE`. Wins are out of 160, and the party band is 88 to 112.

### Wave shapes (Y1)
A screen of 100 cells (Kiln, Foundry, Glarewell and Coldmarrow, each class, off / natural / pincer / ring / reinforce, 80 seeds) flagged only the Coldmarrow. At 160 seeds, a forced ring there cost the Duskblade 25 and the Emberwright 37. That came from 24 to 36 trash deaths, against 3 to 8 with waves off, almost all of them in the Weaver fights. On an arc the Rimehounds come from one side and the bot keeps them at range. On a ring two or three of them bite from different sides at once, and 405 health goes in 3.5 s. Lumen and Slagbinder heal or plate through it.

- A bot rule that steps out through the widest gap among the foes changed nothing (Emberwright ring 46/80 against 48), so it was reverted.
- Design's fix (#517, then #532): a fight with at least one Rimehound, where hounds plus Weavers come to 3 or more, never forms a ring.
- After it, Coldmarrow t10 natural rates for Emberwright / Bulwark / Duskblade / Lumen / Slagbinder were 114 / 128 / 95 / 120 / 107, against 126 / 133 / 93 / 119 / 106 with waves off. With the Two Weavers fight added (#532), design measured the Emberwright's forced ring at 113.
- A forced pincer in the Foundry costs the Bulwark a little (96 against 110); at natural rates it's 108. Design kept it as a watch item.

### The dungeon stirs (Y10)
These are runs out of 80 that stirred at least once (seeds 41-120, natural rates). Before #532 the melee classes were nearly shut out of the Foundry (Bulwark 13, Duskblade 23, against 49 to 60 for the rest), and every party stirred in 74 to 80 runs. Design's #532 judges each hero against a per-class bar, lets the worst-off hero decide for a party, and gives party fights a 0.35x clean bar. After it:

| | Bulwark | Duskblade | Emberwright | Lumen | Slagbinder |
|---|---|---|---|---|---|
| Kiln t6 | 80 | 73 | 74 | 73 | 76 |
| Foundry t6 | 48 | 50 | 48 | 49 | 60 |
| Glarewell t8 | 72 | 64 | 61 | 39 | 76 |
| Coldmarrow t10 | 73 | 77 | 76 | 73 | 72 |

Parties now stir in 26 to 54 runs of 80. The exception is the Anvil party, at 67 to 76, because a party with an Anvil tank takes almost no damage in trash. Design traced that and kept it, since turning the stir off doesn't change its wins. The Glarewell Lumen at 39 is a watch item.

### Third boss versions (Y3)
Each row lists the boss's three versions, with the new one last.

| Solo boss (tier) | Emberwright | Duskblade | Bulwark | Lumen | Slagbinder |
|---|---|---|---|---|---|
| Kiln Mother t6: cataclysm / draw / turning | 103 / 105 / 96 | 93 / 83 / 95 | 136 / 119 / 126 | 156 / 154 / 152 | 92 / 93 / 89 |
| Maelra t6: water / tide / seal (after #534) | 128 / 125 / 131 | 129 / 131 / 126 | 121 / 96 / 110 | 153 / 154 / 155 | 124 / 120 / 131 |
| Lensmother t7: brand / glint / walk | 114 / 141 / 141 | 84 / 123 / 113 | 126 / 141 / 141 | 153 / 155 / 154 | 149 / 154 / 159 |
| Nhevra t10: ice / drift / rime (after #555) | 101 / 128 / 129 | 63 / 126 / 103 | 104 / 139 / 104 | 97 / 143 / 122 | 72 / 144 / 88 |
| Hessa t10: riptide / outsurge / whirl | 121 / 124 / 124 | 112 / 112 / 110 | 85 / 88 / 83 | 137 / 138 / 138 | 160 / 159 / 159 |

- **Maelra's Sealed Vents** first cost the Bulwark 49 against 131 at t6. It lives on vent heals, and with one open vent moving every 16 s, its slow melee lead reached it less often. A stronger melee vent lead in the bot helped only partly (19 → 29 of 80 on seeds 41-120). Design's #534 fixed the fight: the open vent boils her from 1.6x its radius, the steam moves to the free vent nearest her, and her Temper builds 1.5x slower in seal. After that the bot rule was within noise (Bulwark 110 with it, 105 without), so it wasn't shipped.
- **Nhevra's Creeping Rime** first gave the Duskblade 19 and the Bulwark 39. The rime rose under her and chased the nearest hero, which in solo play is the melee hero standing on her. A bot rule that circles her made it worse (Bulwark 19 → 2 of 80). Design's #550 holds the rime 85 px off her body and slides it round her, and #555 fixed a jump when she walked into it.

| Party boss (tier) | Base | Anvil | Bellows | Two Duskblades | Two Emberwrights |
|---|---|---|---|---|---|
| Ondrel t8: choir / load / home (after #554) | 95 / 96 / 95 | 110 / 79 / 94 | 97 / 71 / 102 | 95 / 86 / 86 | 120 / 92 / 99 |
| Ysmeret t8: still / wander / roll | 105 / 100 / 107 | 104 / 124 / 139 | 109 / 111 / 92 | 72 / 80 / 85 | 116 / 117 / 108 |
| Oskel t10: rivets / cut / punch (punch after #573) | 129 / 105 / 117 | 81 / 95 / 123 | 132 / 133 / 148 | 106 / 84 / 98 | 132 / 108 / 152 |
| Grandmother Slag t8: pour / brim / flow | 84 / 88 / 89 | 103 / 117 / 127 | 95 / 107 / 102 | 99 / 88 / 96 | 89 / 86 / 97 |
| Old Vorhulm t9: spill / bank / inhale | 106 / 97 / 99 | 147 / 149 / 146 | 81 / 87 / 79 | 122 / 115 / 106 | 75 / 65 / 86 |
| Cinder Colossus t10: wheel / shift / mill | 107 / 106 / 101 | 120 / 117 / 114 | 76 / 64 / 71 | 133 / 131 / 129 | 95 / 86 / 88 |
| Furnace Regent t11: ash / court / tithe | 106 / 100 / 113 | 97 / 104 / 94 | 80 / 83 / 85 | 110 / 97 / 147 | 110 / 98 / 87 |

- **Ondrel's Homeward Hammer** first gave two Duskblades 66. Design traced it to the 8% ring and cut it to 5% (#554).
- **Oskel's Punch Line** first split by range: two Duskblades 78, two Emberwrights 150. #573 widens punches further out, which brought two Duskblades to 98. Ranged parties are high across the whole Pressworks, and design logged that as a dungeon-wide watch item.
- **Watch items, kept as they are:** the Anvil party on Rolling Vents (139) and the Overflow (127); two Duskblades on the Tithe (147), which design is tracing; and the Anvil party in the Hoard on every version.
- **The Hoard's Anvil party** has been at 67 to 73 of 80 (seeds 41-120) since before #341, so it isn't a regression. No single Slagbinder kit piece explains it: allyBrittle at 1.0 gives 66, and turning off plating, plateMend, party armour and Brittle together gives 62. Holding Vorhulm close doesn't remove it either (76 to 78). The other half is the Bulwark: it died 470 times in 480 base-party runs, mostly late, while another hero was Swallowed. Design tried softening Vorhulm's blows while a hero is Swallowed. It lifted every Bulwark party by about the same amount, so it didn't separate the parties and wasn't shipped.
- **Known and accepted:** the Pressworks Anvil party at 36 of 80 (seeds 41-120) stays the hard way to tank there, as ruled in #308.

## Site cards: talents for the variety layouts and foes (22 Nov 2026)

Phase 11 gave the solo dungeons rolled layouts (pillars, a lava channel, vents) and new foes (the Ember Spitter's lob, the Ashbuck's charge). Each class now has one card that pays off only in its situation. Brief, agreed with design: /mnt/project-files/horders/skills/variety-talents-brief.md.

| Class (branch) | Card | Situation | Per rank (max 2) |
|---|---|---|---|
| Emberwright (kindling) | Vent-Fed | Vents | A vent flaring within 260 px (you outside its circle): +25 Heat, and the next Cinder Volley deals double |
| Duskblade (guard) | Read the Lane | Lob circles, charge lanes | Sidestep while in one that hasn't landed: Sidestep back 3 s sooner, next 3 swings +35% |
| Bulwark (bastion) | Back to Stone | Stones, Glarewell pillars | Within 50 px of one: 7% less damage (4% in the Glarewell), Rim Smash stuns 0.3 s longer |
| Lumen (grace) | Reaching Light | Ember Spitters | Radiant Burst also burns Spitters out to 240 + 80 px; Hush on a Spitter gives 2.5 s back |
| Slagbinder (forge) | Slag Wade | Lava | Lava burns 50% less (lava-proof at rank 2); in lava, hits +10% and make the foe Brittle |

**Offered only while the situation is still ahead** (`TalentDef.where`, `World.situationAhead`). The draft checks the fights still to come in this run's route: each fight's layout (`World.layoutAt`, the same hash `rollLayout` uses, with Today's Heat), and the foes in each remaining slot. The boss arena is always open, so a layout card is never offered with only the boss left. A fork that later swaps a fight is an accepted small miss. `SITE_CARDS.off=1` (TUNE, measuring only) turns them off, which matches main exactly (tools/hashcheck.ts identical).

**Solo dungeons only** for now (`style: 'solo'`): since Phase 12 W2 the Hammerdeep has stones and vents too, but group tables are measured without these cards. Since W1 the Wrackline has Spitters and Ashbucks, so Read the Lane and Reaching Light can be offered there.

**Bots:** the cards are in BOT_PRIORITY after each class's plain cards. Two movement rules were tried and dropped. Pulling a Bulwark with Back to Stone toward the nearest stone cost 23 of the 80 Coldmarrow runs that took the card. A Slagbinder with Slag Wade staying in lava above half health cost 10 of 45 Kiln runs. #402's lava crossing is untouched. `BOT_SITE=1` (tools only) makes the bot take a site card whenever one is offered, unless a capstone is.

**Measured** (heroes-r2, 3 heroes x 80 seeds, `BOT_SITE=1` against `SITE_CARDS.off=1`). Columns: wins per 40 over all runs, then wins on the seeds where the card was taken, against the same seeds with the cards off:

| Card | Dungeon, tier | All runs, on / off | Taken seeds: on vs off |
|---|---|---|---|
| Vent-Fed | Kiln 6 | 25.8 / 25.3 | 25 vs 26 of 42 |
| Vent-Fed | Foundry 6 | 30.3 / 31.7 | 53 vs 57 of 66 |
| Vent-Fed | Glarewell 8 | 35.2 / 35.3 | 59 vs 58 of 64 |
| Read the Lane | Kiln 6 | 24.3 / 24.8 | 31 vs 34 of 43 |
| Read the Lane | Foundry 6 | 36.2 / 35.8 | 28 vs 26 of 32 |
| Read the Lane | Glarewell 8 | 32.7 / 32.7 | 25 vs 25 of 32 |
| Back to Stone | Kiln 6 | 37.7 / 37.2 | 49 vs 46 of 51 |
| Back to Stone | Foundry 6 | 30.5 / 31.3 | 42 vs 47 of 58 |
| Back to Stone | Glarewell 8 | 35.0 / 34.7 | 100 vs 98 of 115 |
| Back to Stone | Coldmarrow 10 | 31.5 / 31.2 | 60 vs 59 of 80 |
| Reaching Light | Kiln 6 | 38.3 / 39.0 | 28 vs 32 of 33 |
| Reaching Light | Foundry 6 | 35.7 / 35.5 | 40 vs 39 of 42 |
| Reaching Light | Glarewell 8 | 39.7 / 39.7 | 9 vs 9 of 9 |
| Slag Wade | Kiln 6 | 29.5 / 29.0 (no bot rule) | 27 vs 30 of 45 |
| Read the Lane | Wrackline 10 (hero-t8, after W1) | 25.5 / 25.3 | 21 vs 20 of 30 |
| Reaching Light | Wrackline 10 (hero-t8, after W1) | 36.2 / 36.3 | 24 vs 25 of 25 |

Every cell is within seed noise of zero: bots don't seek out a situation, and a taken card replaces another pick. That is the intended shape: the cards don't win every draft, and they pay a player who plays to the room. Design asked for Back to Stone in the Glarewell (pillars in every fight) to be checked on its own: +2 wins in the 115 runs that took it, well under +4 per 40, so it keeps its 4% Glarewell value. The first numbers (Heat 15, 2 swings at +20%, reach 200 + 60, burn -30% and +5%) measured the same, so the stronger ones shipped.

**Tier 1 Kiln** (no gear, 480 seeds, cards on / off): good bot Emberwright 368 / 379, Duskblade 478 / 478, Bulwark 480 / 480, Lumen 461 / 461, Slagbinder 479 / 479. Novice: Emberwright 270 / 270, Duskblade 167 / 167, Bulwark 206 / 216, Lumen 459 / 459, Slagbinder 478 / 478. The good-bot Emberwright gap to the Duskblade goes from 8.2 to 9.1 per 40 (the bot takes Vent-Fed in about half its offers), still inside ±10. Everything else is unchanged or under 1 per 40. **Hashcheck:** 1 of 24 rows moves (emberwright kiln seed 3), because a site card in the pool changes that draft.

## Order of work

1. Draft rules and the three Emberwright ability talents (on top of the class system PR).
2. Bulwark.
3. Duskblade tuning and ability talents.
4. Lumen (healer), solo version first; ally healing and threat with group play.
Each lands as its own PR with tests and bot balance numbers in the description.
