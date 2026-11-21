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
- **Duskblade Blade Guard:** hits from the foe it is swinging at are cut by up to 50%.
- **Duskblade Sidestep:** heals up to 3% of max health.
- **Bulwark:** Anvil Skin heals up to 10% of max health (on top of Mended Iron), and Shield Block also covers every big foe within 75° of the last sweep.
- **Steady Breath (both):** once per fight, dropping below 30% health heals up to 20% of max health.

Reference: the novice bot (`LAG=0.3 SKILL=0.5`, Kiln tier 1, seeds 1 to 24) wins 8 to 16 of 24 with every class.

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
- **Dawn** (healing into damage): *Kindled Light* (3) overheal stores 30% more Brilliance; *Searing Radiance* (3) Sunmotes +15% damage; *Sunflare* (2, ability) Radiant Burst +40 radius and +50% damage; capstone **High Noon**: every 4s, stored Brilliance fires a piercing sunbeam for 30 plus 1.5 per point.
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

tools/group.ts, heroes-r2, seeds 1 to 80, wins out of 80, main 2555b0c / this change:

| | Main | This change |
|---|---|---|
| Hammerdeep tier 8, full party, no set | 43 | 43 |
| Hammerdeep tier 8, full party, 3 Deepguard each | 51 | 55 |
| Hammerdeep tier 6, Bulwark and Lumen duo, 3 Deepguard each | 37 | 67 |
| Ashvents tier 8, full party, no set | 50 | 50 |
| Ashvents tier 8, full party, 3 Ventwalker each | 60 | 59 |

**The duo jump is mostly positioning, not the set.** With the Deepguard drift forced on and no set worn, the duo wins 49 of 80 against 24 on main. Its Lumen bot normally stands too far from the Bulwark for Ondrel's fight. On top of that baseline, the set adds 18 of 80 (+9 in 40), above the 2 to 7 range the other sets give. That is game design's call.

## High Noon and Choir of Dawn rework (roadmap L7)
Both of the Lumen's original capstones added almost nothing:
- **High Noon** fired only when the Lumen held 20 Brilliance or more. Sunmote spends up to 10 Brilliance a shot, so the beam almost never fired: 0 times in 10 Kiln 8 runs with hero-t8-0, and 9 times in 10 runs at tier 6.
- **Choir of Dawn's** wisps circled 78 px out. The Lumen fights from range, so they did under 1% of its boss damage.
- With no capstone at all, the bot scored 17.7 out of 40 at Kiln 8, the same as with these two.

The rework (tuning in `LUMEN_CAPS` in sim/world.ts):
- **High Noon:** every 4 s, the beam fires at your target whenever there is one. It deals 40 plus 1.5 per Brilliance, and spends all your Brilliance as before.
- **Choir of Dawn:** the wisps circle 170 px out. Ring of Ash keeps its 78 px.

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
    - **Shatterpoint:** Brittle foes take 25% more from Slag Lob.
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

## Order of work

1. Draft rules and the three Emberwright ability talents (on top of the class system PR).
2. Bulwark.
3. Duskblade tuning and ability talents.
4. Lumen (healer), solo version first; ally healing and threat with group play.
Each lands as its own PR with tests and bot balance numbers in the description.
