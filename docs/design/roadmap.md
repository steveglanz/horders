# Horders design roadmap

Ordered by how much each item adds to "one more run" for the work it takes. Game design builds the items marked **design**; the other owners are noted. Each item lists what it needs from other teams so they can plan.

Status key: ✅ done, 🔨 in progress, ⏭ next, 💡 later.

| # | Item | Status | Owner | Needs from others |
|---|------|--------|-------|-------------------|
| R2 | The Forge: embers upgrade and temper gear | 🔨 this PR | design | Visuals: a nicer Forge panel later |
| R1 | Route choices between fights | ⏭ | design | Visuals: door/choice icons; engineering: none |
| R3 | Tier modifiers ("Omens") | ⏭ | design | Visuals: an icon and a tint per Omen |
| R5 | World boss you actually fight | 💡 | design + engineering | Engineering: per-boss rules on the server; visuals: boss art |
| R4 | Build-changing loot: more mythics, class weapon effects | 💡 | design + skills | Skills: effects that hook into each class kit |
| R6 | Second dungeon (zone 2) with a new boss | 💡 | design | Visuals: new enemy and arena art |
| R7 | Daily bounty: one delve with a single twist rule, extra reward | 💡 | design | Engineering: a daily seed from the server |
| R8 | Alchemy: one potion slot (run-start buff or a revive) | 💡 | design | Visuals: potion icons |
| R9 | Co-op delves, then raids | 💡 | engineering | Everyone |

## R2. The Forge (this PR)

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

## R3. Tier modifiers ("Omens")

**Problem.** Tiers only add health and damage. Tier 9 plays exactly like tier 1.

**Design.** From tier 3, each tier adds one Omen to every fight, picked from a weekly rotation (a seed from the week number), so the ladder changes each week. Starting set, each one asks for a different reaction:
- **Kindled Dead:** elites leave a burning pool where they die. (Move after kills.)
- **Shared Pain:** when an enemy dies, the others in the fight heal 15%. (Kill evenly, or burst them together.)
- **Quickened:** enemy casts are 30% faster. (Interrupt sooner.)
- **Warded:** the first time each enemy drops under half health, it gains a shield worth 20% of its health. (Save a cooldown for it.)
- **Volatile Ground:** a slow red circle appears under you every 12 seconds. (Keep moving.)

Higher tiers stack more Omens (tier 3 to 5: one, 6 to 9: two, 10 and up: three). Each Omen also adds +8% loot luck, so the hard ladder pays.

## R5. A world boss you actually fight

**Problem.** The world boss is a health bar on the menu.

**Design sketch.** Each world boss arrives as a sixth, optional fight at the end of a won delve: "Grandmother Slag's shadow" for a 60-second damage race with her signature mechanic. Damage there counts 3x toward the shared bar. Each world boss also sets a weekly blessing or curse on delves while it lives, which ties the shared world to every run. This is the solo version of "bigger enemies need a group"; co-op makes it a real raid later.

## R4, R6, R7, R8
Specs get written here when each one is next.
