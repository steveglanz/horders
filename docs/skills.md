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

## Duskblade (melee damage) — new

Fantasy: fast, fragile, stick to one big target and burst it, slip out of telegraphs.

Resource: **Energy** (0 to 100), regenerates 12/s. Plus **Marks** (0 to 5): each auto-attack hit on the same target adds a Mark to it, and finishers spend them.

Base: 90 health, 155 move speed.

Auto: **Twin Cuts**, every 0.45s, hit the nearest enemy within 70 for 9 damage and add a Mark to it.

| Key | Ability | Cost / CD | Effect |
| --- | --- | --- | --- |
| Q | Rupture | 35 Energy / 1.5s | Finisher: 25 damage plus 30 per Mark on the target, Marks consumed |
| E | Shadowstep | 0 / 7s | Teleport behind the nearest big enemy in 350 range (or forward), next hit crits |
| R | Blade Fan | 60 Energy / 16s | Spin: 70 damage to everything within 140, adds 2 Marks to each |
| F | Throat Strike | 0 / 10s, off GCD | Interrupt within 160 range, stuns 2s |

Branches:
- **Venom** (damage over time): *Toxic Edge* hits poison for 3 damage/s per rank; *Virulence* poison spreads to one nearby enemy on death; *Envenom* (ability) Rupture applies a strong poison scaled by Marks spent; capstone **Venom Bloom**: poisoned enemies burst on death, poisoning and damaging everything near them.
- **Shadow** (crit and evasion): *Keen Edge* +10% crit chance; *Fade* 25% chance to dodge a melee hit; *Ambush* (ability) Shadowstep resets when its target dies and makes you untouchable for 0.5s; capstone **Shadow Twin**: a shadow copies your Rupture and Twin Cuts at 50% damage.
- **Flurry** (speed and cleave): *Quick Hands* Twin Cuts 12% faster; *Whirling Steel* Twin Cuts also hit one more enemy; *Second Wind* (ability) Blade Fan refunds 20 Energy per enemy hit (max 60); capstone **Bladestorm**: Blade Fan becomes a 3s spin you can move in.

## Order of work

1. Draft rules and the three Emberwright ability talents (works on top of the class system PR).
2. Bulwark.
3. Duskblade, redesigned from engineering's first pass to match the above.
Each lands as its own PR with tests and bot balance numbers in the description.
