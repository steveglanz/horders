# Group play and difficulty

Steve asked (20 Nov 2026): difficulty should adjust to the number of characters or players. Look at how a big MMO handles groups, dungeons, raids, threat, healing and damage, take notes, and tune Horders so it's hard but not too hard.

This file has two parts: what the research says, quoted from sources, and what Horders does with it. Everything in the second part is our own design. We take the lessons, not the names, numbers or content.

## Part 1: what the research says

All pages below were opened and read on 20 Nov 2026. Wiki pages are community-written, so treat them as reliable descriptions of the game, not official statements.

### Raid size and difficulty tiers
- The lower raid difficulties are flexible: "The three lower raid sizes are flexible and can accommodate raid groups from 10-25 people; Mythic is the only difficulty requiring a fixed size of the group." Mythic "is always scaled for 20 players" ([Instance difficulty, warcraft.wiki.gg](https://warcraft.wiki.gg/wiki/Instance_difficulty)).
- A suggested Mythic raid makeup is "2-3 tanks (mostly 2), 4-6 healers (mostly 5), ~13 DPS", per Ion Hazzikostas in 2014 (same page). The game never shows a per-player health formula.
- Blizzard tunes difficulty over time for whoever is playing: "It is important to keep in mind the audience that is engaging with an encounter at a given time" (Morgan Day, in [PC Gamer, 19 Feb 2024](https://www.pcgamer.com/how-blizzard-balances-and-rebalances-world-of-warcrafts-raids-to-evolve-with-their-players-it-is-important-to-keep-in-mind-the-audience-that-is-engaging-with-an-encounter-at-a-given-time/)). The article says they watch wipe rates per boss, and that flexible scaling has a known weak spot: small groups find the same difficulty much harder than full ones.

### Threat (who the monster attacks)
From [Threat, warcraft.wiki.gg](https://warcraft.wiki.gg/wiki/Threat) (the page is marked outdated, so read it as the classic model):
- "Damaging the NPC adds one threat per one damage done."
- Healing "adds one threat per two effective healing done, divided by the number of NPCs who observed the heal." Overhealing doesn't count.
- A monster switches targets when someone "Exceeds the previous target's threat by 10% while within melee range" or "by 30% while outside melee range."
- Tank stances multiply threat (5x in that version). Taunt "Sets threat equal to player highest on target's threat list."
- In modern play, per the page, a tank "either has aggro or doesn't, but they can easily maintain it once they do." The trend has been to make holding threat easier and make the fight itself the challenge.

### Dungeon difficulty ladder
From [Mythic+, warcraft.wiki.gg](https://warcraft.wiki.gg/wiki/Mythic%2B):
- Each keystone level makes enemies stronger: "Enemies deal 8% greater damage and have 8% greater health pools" per level. A 2017 patch note on the same page says 10%, and the page doesn't settle which is current.
- Affixes (rule changes) are added as the level rises, rotating weekly. The page's own patch notes move the thresholds around over time.
- Timed runs upgrade the key "+1 (on time), +2 (>20% time to spare) or +3 (>40% time to spare)."
- Wowhead reported an undocumented flat +30% health and +15% damage when a key starts ([Wowhead, 6 Mar 2022](https://www.wowhead.com/de/news/mythic-dungeons-scale-by-an-additional-30-health-and-15-damage-when-a-mythic-key-326223)), and called it unclear whether that was a bug. So even the big games tune by feel and patch.

### A comeback buff after wipes
From [Determination, warcraft.wiki.gg](https://warcraft.wiki.gg/wiki/Determination): in the easiest raid mode, "health, damage dealt, and healing received are increased by 5%" per stack. "One stack is applied each time the raid wipes to a boss, up to a maximum of 10 stacks," and "When a boss is killed, all stacks are removed."

### How a co-op roguelite scales with players
From [Difficulty, riskofrain2.wiki.gg](https://riskofrain2.wiki.gg/wiki/Difficulty): the starting difficulty is `playerFactor = 1 + 0.3 × (playerCount − 1)`, and the time ramp also grows with players (`playerCount^0.2`). That's one way to make 4 players face more than 1 without it being 4 times harder.

### Dynamic difficulty adjustment, and its limits
Hunicke and Chapman's Hamlet system ([AI for Dynamic Difficulty Adjustment in Games](https://users.cs.northwestern.edu/~hunicke/pubs/Hamlet.pdf)) watches for a player "flailing" and steps in. A "Comfort Zone" policy aims to keep players "at about 50% health, occasionally dipping near 25% or cresting to 75%." The authors also warn: "it is unclear to us at this time whether this is necessary, or even desirable," "DDA does not come cheaply," and "Ultimately, DDA systems take control away from the designer." The paper describes the system but reports no player results.

## Part 2: what Horders does with it

### Principles we take
1. **Scale health with heroes, not damage per hit.** A hit should hurt the same whoever takes it. More heroes means more health to chew through and more mechanics to handle, not one-shots.
2. **Give every hero something to do.** Groups get one copy of each targeted mechanic per hero (rings, soak circles), so nobody idles. That's the real lesson from big raids.
3. **Visible, small, temporary help after failure beats hidden adjustment.** Determination is shown on screen, capped, and cleared on a kill. Hamlet's own authors doubt hidden adjustment. So our help is a buff you can see, not secret enemy nerfs.
4. **Climb by rules, not only by numbers.** Ladders add rule changes as you climb (our Omens), with modest stat growth per step. Ours is +22% health and +12% damage per tier, plus Omens from tier 3.
5. **Make holding threat easy and the fight hard.** The trend in big games is toward a tank who can hold threat reliably. Our threat rules should be simple, so the challenge stays in the boss.
6. **Tune for who's playing now.** Watch where players die (wipe rates per fight) and adjust over time. We do this with the autopilot now, and with analytics events once real players arrive.

### What's built now (this change)
- **Party scaling** in `sim/content/scaling.ts`: enemy health ×1, 1.775, 2.5 or 3.175 for 1 to 4 heroes. It's a little under linear, because groups lose some damage to movement and overlap, and the size of that loss is a guess to check in co-op playtests. Damage per hit is unchanged. `WorldOptions.partySize` applies it. Solo is unchanged, and the number is ready for co-op rooms and for scaling world boss health by active fighters.
- **Grit:** after a loss, the hero gets +5% damage and health on that same dungeon and tier, up to 3 stacks (+15%). A win clears it. The hub shows "Grit ×N". Capped at 3, not 10, because our runs are short and we lose more often, so a 10-stack cap would carry players.
- `partyMechanics(n)` returns one copy per hero, for targeted mechanics in co-op. It isn't used yet, because there's only one hero today.

### Role rules for co-op (agreed with the skills team, 20 Nov 2026)
- **Threat:** each enemy attacks the hero with the most threat on it. Damage gives 1 threat per point. Healing gives 0.5 per point, split across the enemies in the fight. Tank stance multiplies threat by 4. An enemy switches only when someone beats the current target by 20% (one rule, since it's top-down). Taunt sets you to the top threat +10% and forces the enemy onto you for 3 s. Solo ignores threat.
- **Healer:** keeps the group up. Solo, overheal turns into damage, as the original plan says. Each boss gets at least one problem only healing or cleansing solves, such as a stacking bleed on whoever holds the boss.
- **Damage:** owns interrupts, adds and burst. Each boss gets a short burn window where it takes extra damage, so damage dealers have a moment that's theirs.
- **Tank:** holds the boss and turns it away from the group (cones and frontal hits matter more in co-op), and swaps or uses a big cooldown on a stacking hit.

How the current kits carry these (skills team):
- **Bulwark:** threat ×4 is a class passive, not a stance, because every class has four fixed slots. In co-op, Charge also taunts its target. Thorns, Bastion reflects and Thornwall count as damage for threat.
- **Duskblade:** in co-op, Sidestep halves your threat on every enemy (the melee threat dump). Solo it's unchanged.
- **Emberwright:** no change. Combustion is its burn window, and Quench covers interrupts.
- **Lumen:** overheal becomes damage solo, and a stacking tank bleed only a heal clears.

The threat rules are built as pure functions in `sim/threat.ts` (`damageThreat`, `healThreat`, `taunt`, `scaleThreat`, `dropHero`, `updateTarget`, tuning in `THREAT`), with tests in `tests/threat.test.ts`. They're wired in when co-op rooms land.

### How we keep it "hard but not too hard"
| Lever | Target | Measured by |
|-------|--------|-------------|
| Tier 1 win rate, new player | 40 to 60% | weak bot (`SKILL=0.5`) |
| Wall tier win rate | 40 to 50% | 50-run progression |
| Longest losing streak in 50 runs | 4 or fewer | progression with Grit on |
| Health left on a win | 25 to 75% of max (Hamlet's comfort band) | `tools/balance.ts` output |
| Each Omen | costs a few wins or a clear chunk of health, never a run-ender | balance.md table |

Numbers from this change are in [balance.md](balance.md).
