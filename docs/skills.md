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

## Bulwark (tank) — new

Fantasy: you plant yourself in the middle of the pack, soak the hits and hit back. Shorter reach than the Emberwright, much more health, and damage that grows with what you take.

Resource: **Resolve** (0 to 100). Gained when you are hit (2 per 10 damage taken) and when your swing lands (3 per hit). Decays slowly out of combat.

Base: 160 health, 10% damage reduction, 125 move speed.

Auto: **Shield Sweep**, every 1.1s, a 150° arc in front of you, 95 range, 16 damage, light knockback on normal enemies.

| Key | Ability | Cost / CD | Effect |
| --- | --- | --- | --- |
| Q | Shield Slam | 25 Resolve / 5s | 60° cone, 140 range, 55 damage, stuns normal enemies 1s |
| E | Charge | 0 / 9s | Dash 220 toward the nearest big enemy (or where you face), 30 damage and 0.6s stun on arrival |
| R | Bastion | 60 Resolve / 24s | 6s: take 60% less damage and 25% of damage taken is reflected at the attacker |
| F | Shield Toss | 0 / 10s, off GCD | Ranged interrupt (420 range), stuns 2s |

Branches:
- **Bastion** (defense): *Hold the Line* +30 max health and +4% damage reduction; *Ward* every 8s gain a shield for 12% of max health; *Last Stand* (ability) Bastion also heals 20% of max health; capstone **Unbreakable**: when Bastion ends, it explodes for the damage it prevented.
- **Retribution** (thorns): *Spiked Shield* melee attackers take 6 damage when they hit you; *Vengeance* +4% damage for every 10% of health missing; *Shield Echo* (ability) Shield Slam hits a second time 0.4s later for half damage; capstone **Thornwall**: reflected and thorns damage also hits every enemy within 120.
- **Vanguard** (cleave and mobility): *Wide Sweep* Shield Sweep's arc becomes a full circle at rank 2 and gains range; *Momentum* +5% move speed and Charge cooldown -2s; *Battering Ram* (ability) Charge damages everything along its path; capstone **Warpath**: every 4th Shield Sweep sends out a shockwave ring for 3× its damage.

## Duskblade (melee damage)

Engineering's class-system PR shipped a first-pass Duskblade: Momentum resource, auto swings, Rending Dash (Q), Sidestep (E), Execution (R), Kick (F), and the Bloodletting, Tempo and Guard branches. That kit plays well and is kept as the base, so the earlier Energy and Marks sketch is dropped. The skills work on it is tuning (its bot win rate is far below the Emberwright's) and one ability talent per branch, the same as the other classes.

## Order of work

1. Draft rules and the three Emberwright ability talents (on top of the class system PR).
2. Bulwark.
3. Duskblade tuning and ability talents.
Each lands as its own PR with tests and bot balance numbers in the description.
