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
| Emberwright | **Burn**: fire that stays on the ground and spreads from foe to foe | Kindled Ground, Searing Burn, Pyroclasm, Combustion's burn |
| Duskblade | **Execute**: a finisher that doubles on wounded foes | Execution, Exsanguinate |
| Bulwark | **Turn back**: damage taken comes back out | Bastion, Spiked Shield, Thornwall, Unbreakable |
| Lumen | **Overheal into light**: healing past full becomes damage | Brilliance, High Noon |

New talents should deepen a class's own verb before they borrow another class's.

## Dungeon checks every kit must pass

From the Drowned Foundry spec (roadmap R6), every class needs:
1. **An interrupt.** All four have one in slot F: Quench, Kick, Shield Toss and Hush.
2. **Cleave or a quick target swap,** for foes that must die together. Emberwright fire and Flame Wave, Duskblade swings and Blade Storm, Bulwark Shield Sweep, Lumen Radiant Burst and Prism. Auto-attacks retarget on their own.
3. **Movement that works while being pulled:** Blink, Sidestep and Rending Dash, Charge, Glimmer Step.
4. **Damage while moving,** for kiting: all four auto-attacks fire on the move. Melee keeps up with Rending Dash and Charge.

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
- Wildfire, **Pyroclasm** (2 ranks): Combustion leaves a fire pool on its target, and its burn spreads to enemies near anything that dies burning.
- Kindling, **Ignition** (2 ranks): a crit refunds 15% of Flame Wave's cooldown, and Flame Wave crits always.
- Ashguard, **Blazing Speed** (2 ranks): Blink gains a second charge, and you move 30% faster for 2s after it.

## Bulwark (tank)

Fantasy: you plant yourself in the middle of the pack, soak the hits and hit back. Short reach, more health, armor, and damage that grows with what you take.

Resource: **Resolve** (0 to 100). Gained when you are hit (1 per 5 damage before armor), when Shield Sweep lands (3 per enemy, up to 12 per swing), 10 from Charge, and 1 per second.

Base: 160 health, armor stops 20% of every hit, 128 move speed.

**Shield Block**: hits from the foe the shield faces (the last Shield Sweep target) are cut a further 35%. A tank that keeps its shield on the boss can stand in contact with it.

**Smother**: a Bulwark standing in a Sluice Crawler's bloom when it bursts catches it on the shield for 10 Resolve, and the burst heals no one. It still takes the hit. This is the tank's answer to the Tide Pair: soak the ring instead of dragging it away. Shield Slam also shoves what it hits (50 for normal foes, 90 for elites, 70 for bosses), so the Bulwark can steer Maelra toward a vent.

Auto: **Shield Sweep**, every 0.8s, a 150° arc toward the target, 95 range, 30 damage, small knockback on normal enemies.

| Key | Ability | Cost / CD | Effect |
| --- | --- | --- | --- |
| Q | Shield Slam | 25 Resolve / 5s | 100° cone, 150 range, 60 damage, stuns normal enemies 1.2s and big ones 0.3s |
| E | Charge | 0 / 9s | Rush the biggest foe within 420 (or the nearest), 35 damage and 0.8s stun |
| R | Bastion | 50 Resolve / 20s | 6s: take 60% less damage, and turn 25% of each hit back on the attacker |
| F | Shield Toss | 0 / 10s, off GCD | Interrupt within 420, stuns 2s. With nothing to stop, a small hit and half the cooldown back |

Branches:
- **Bastion** (soak): *Hold the Line* (3) +30 max health and 4% less damage taken; *Ward* (3) every 8s a shield worth 8% of max health; *Last Stand* (2, ability) Bastion heals 12% of max health; capstone **Unbreakable**: when Bastion ends it bursts for twice the damage it stopped.
- **Retribution** (thorns): *Spiked Shield* (3) enemies that hit you take 8 back; *Vengeance* (3) +4% damage per 10% health missing; *Shield Echo* (2, ability) Shield Slam hits again 0.4s later for half, rank 2 adds 10 Resolve; capstone **Thornwall**: always turn back 15% of each hit, and turned-back damage hits everything around you.
- **Vanguard** (cleave and charge): *Wide Sweep* (2) wider and longer sweeps, a full circle at rank 2; *Momentum* (3) +5% move speed and Charge 2s faster; *Battering Ram* (2, ability) Charge hits and stuns everything in its path; capstone **Warpath**: every 4th sweep sends a shockwave for double damage.

## Duskblade (melee damage)

Engineering's class-system PR shipped a first-pass Duskblade: Momentum resource, auto swings, Rending Dash (Q), Sidestep (E), Execution (R), Kick (F), and the Bloodletting, Tempo and Guard branches. That kit plays well and is kept as the base, so the earlier Energy and Marks sketch is dropped. Most of its low bot win rate turned out to be the bot standing in contact with big foes and running straight back from cone attacks; fixing the melee bot took it from 13 to 47 wins out of 60. It also gets one ability talent per branch, like the other classes:
- Bloodletting, **Exsanguinate** (2 ranks): Execution also deals the target's next 3s of bleed at once (6s at rank 2).
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
- **Grace** (shields and staying alive): *Aegis of Light* (3) Radiant Burst shields you for 8% of max health; *Renewal* (3) +20 max health and 1 health per second; *Blessed Ground* (2, ability) Glimmer Step leaves a pool that heals 5 per second per rank for 4s; capstone **Martyr's Halo**: once per fight, a killing blow leaves you at 1 health and untouchable for 2s.
- **Choir** (more light, faster): *Hasted Hymn* (3) Sunmotes 12% more often; *Prism* (2) each Sunmote also strikes one more enemy for 60%; *Lingering Sanctuary* (2, ability) Sanctuary lasts 2s longer and moves with you; capstone **Choir of Dawn**: three wisps circle you, burning foes and healing you 1.5 with each hit.

## Order of work

1. Draft rules and the three Emberwright ability talents (on top of the class system PR).
2. Bulwark.
3. Duskblade tuning and ability talents.
4. Lumen (healer), solo version first; ally healing and threat with group play.
Each lands as its own PR with tests and bot balance numbers in the description.
