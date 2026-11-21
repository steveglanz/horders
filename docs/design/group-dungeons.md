# Group dungeons (spec, 21 Nov 2026)

Steve (21 Nov 2026, via the coordinator): "Maybe some dungeons are more geared to 'group dungeons' that should require tanks and healers and some are doable without it?"

## Today (checked on main)
- Parties are 1 to 4 heroes (`MAX_PARTY` in `sim/content/scaling.ts`). Enemy health scales ×1, ×1.775, ×2.5, ×3.175, and damage per hit doesn't scale.
- Roles exist but are optional: the Bulwark has ×4 threat and Charge taunts, the Lumen heals allies (#24), and threat picks each enemy's target (`sim/threat.ts`).
- No fight needs a role. Quick join (`client/net/lobby.ts`) matches by free spots only.

## The rule: two kinds of dungeon
| Kind | Dungeons | Label in delve setup | Who can enter |
|---|---|---|---|
| Solo friendly | Kiln Depths, Drowned Foundry, Glarewell | "Solo friendly · any party" | 1 to 4 heroes, any classes |
| Group | The Hammerdeep (new) | "Group · tank + healer recommended" | A party of 2 to 4. Solo can't enter |

Roles are *recommended*, not enforced. A party without a tank or healer can try, and the delve setup warns them ("No tank: Anvilfall will one-shot your damage dealers"). Hard locks would leave a party of friends unable to play together.

## The Hammerdeep (group dungeon)
Unlocks at tier 4 like the Foundry, so a new co-op group gets there quickly. Trash reuses existing enemy kinds (no new art needed to start), and the boss is new.

**Boss: Ondrel, the Anvilward.** Each mechanic asks one role for one thing:

| Mechanic | What it does | Who answers it |
|---|---|---|
| **Anvilfall** (tank-buster) | Every 12 s, a 2.5 s non-interruptible wind-up on its current threat target, then a hit for 75% of a non-tank's max health. The target also gets **Sundered** (+50% Anvilfall damage for 14 s). | The tank: the Bulwark takes it (armour + Bastion). Two Anvilfalls in a row on a non-tank kill it, so without a tank the party has to taunt-swap. |
| **Hammer Sweep** | A frontal cone toward its target between Anvilfalls. | Everyone else stands behind or beside it. The tank turns it away. |
| **Choir of Iron** (party damage) | Every 10 s, every hero takes 12% of max health. It grows +2% each time. | The healer: about 1.2% of the party's health per second has to come back. |
| **Slag Grip** (healer debuff) | Each melee hit on its target adds a stack (1% max health per second per stack, up to 5). Any heal **from another hero** clears it. | The healer's ally heals. Self-heals don't clear it. |

A soft enrage at 4 minutes (Choir every 5 s) keeps a party with no damage dealers from stalling it out.

**Threat:** uses the existing rules (`sim/threat.ts`). The Bulwark's ×4 threat holds Ondrel. Charge taunts for a swap, and the Duskblade's Sidestep dumps threat.

**Reward:** a boss chest one rarity step better than the same tier in a solo dungeon, plus a 4th verb set later (Anvilward set, verb: "hold the line"). That way groups have a reason to queue.

## Delve setup and Quick join (engineering)
- `DungeonDef.style: 'solo' | 'group'`. The delve card shows the label, and in a party it shows the roles present: **Tank ✓ Healer ✗ Damage ✓✓**. Classes map to roles from `CLASSES[].role`.
- Ask for engineering: add `roles` to `LobbyAd`, and let `pickParty` prefer a party that lacks your role (a Lumen seeker goes to a party with no healer first). The party card shows "Needs: Healer".

## Testing
- `tools/group.ts`: a party of bots, each hero driving its own input (`use(i)` then `botInput`). Target win rates with heroes-r2 hero-t6 at tier 6:
  - Tank + healer + 2 damage: 60 to 75%.
  - No tank, or no healer: under 25%.
  - Two damage dealers only: under 10%.
- Tests: Anvilfall targets the threat leader, Slag Grip clears on an ally heal and not on a self-heal, a solo hero can't start the Hammerdeep, and the label shows.

## Names
A web search on 21 Nov 2026 for "Hammerdeep" game and "Anvilward" game boss found no game using either name (result titles only, so it's a search check, not a legal clearance).
