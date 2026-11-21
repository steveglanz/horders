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

**Boss: Ondrel of the Hammerdeep.** Each mechanic asks one role for one thing:

| Mechanic | What it does | Who answers it |
|---|---|---|
| **Anvilfall** (tank-buster) | Every 12 s, a 2.5 s non-interruptible wind-up on its current threat target, then a hit for 75% of a non-tank's max health. The target also gets **Sundered** (+50% Anvilfall damage for 14 s). | The tank: the Bulwark takes it (armour + Anvil Skin). Two Anvilfalls in a row on a non-tank kill it, so without a tank the party has to taunt-swap. |
| **Hammer Sweep** | A frontal cone toward its target between Anvilfalls. | Everyone else stands behind or beside it. The tank turns it away. |
| **Choir of Iron** (party damage) | Every 10 s, every hero takes 12% of max health. It grows +2% each time. | The healer: about 1.2% of the party's health per second has to come back. |
| **Slag Grip** (healer debuff) | Each melee hit on its target adds a stack (1% max health per second per stack, up to 5). Any heal **from another hero** clears it. | The healer's ally heals. Self-heals don't clear it. |

A soft enrage at 4 minutes (Choir every 5 s) keeps a party with no damage dealers from stalling it out.

**Threat:** uses the existing rules (`sim/threat.ts`). The Bulwark's ×4 threat holds Ondrel. Charge taunts for a swap, and the Duskblade's Sidestep dumps threat.

**Reward:** a boss chest one rarity step better than the same tier in a solo dungeon, plus the **Deepguard** verb set (verb: "stay close", below). That way groups have a reason to queue.

## The Deepguard set (21 Nov 2026)
This is the Hammerdeep's verb set, the first one from a group dungeon. Ondrel's head, hands and trinket drops can be Deepguard pieces, the same way the solo bosses drop their sets (`withSet`, 60% of set-slot drops, never in bounties). Group loot already gives every hero their own boss item. The verb is **stay close**: the Hammerdeep asks the party to stand together behind the tank. All the numbers are in `SET_TUNING` (`dg*`) in `sim/content/sets.ts`.

- **2 pieces:** while an ally stands within 140 of you, you take 3% less damage.
- **3 pieces:** allies within 140 of you take 2.5% less damage. Two wearers near the same hero don't stack it.
- **Solo it does nothing,** and the 2-piece text says so. It is a reason to keep grouping, not a solo upgrade.

**Measured** with tools/group.ts (new `SET=` and `SETN=`, which make every hero's head, hands and trinket set pieces), heroes-r2, seeds 1 to 80, on main 5afb9cb plus this change. Wins out of 80:

| | No set | Every hero 2 pieces | Every hero 3 pieces |
|---|---|---|---|
| Tier 8, full party (Bulwark, Lumen, Duskblade, Emberwright, hero-t8-0) | 43 | | 51 |
| Tier 6, Bulwark and Lumen duo (hero-t6-0) | 24 | 34 | 37 |

The other sets give that duo nothing: with 3 Kilnbreaker pieces each it won 18, and with 3 Hearthkeeper pieces 23. So Deepguard is the set for groups, as intended.

- **Tier 8 full party:** +4 wins in 40 when everyone wears all 3 pieces, inside the solo sets' 2 to 7.
- **Tier 6 duo:** +6.5 in 40, at the top of that range. The duo is the most sensitive case, because every hit counts in a fight short of healing.
- **First pass:** a 6% cut and a 5% aura gave that duo 40 of 80 (+8 in 40), which is too much. The cut is now 4% and the aura 3%.

**Retune after the bots learned the verb (21 Nov 2026, main cfca513 with skills' #231).** Until #231, party bots never moved to stay close, so the numbers above measured the set without its verb. Now a ranged bot wearing 2+ Deepguard pieces drifts to within 105 of an ally. Most of the duo's gain is that positioning, not the set. To separate the two, I ran the set with its cut and aura set to 0 ("verb only"). Seeds 1 to 40 for the duo, 1 to 80 for the party, all heroes wearing 3 pieces:

| | No set | Verb only (0%, 0%) | Old: 4%, 3% | New: 3%, 2.5% |
|---|---|---|---|---|
| Tier 6 Bulwark and Lumen duo (hero-t6-0), of 40 | 12 | 24 | 33 | 30 |
| Tier 8 full party (hero-t8-0), of 80 | 43 | 56 | 55 | 61 |

- **Duo:** the set's own effect was +9 in 40 over the verb alone, above the 2 to 7 range. At 3% and 2.5% it is +6.
- **Full party:** the set's own effect is within noise at both settings (-1 and +5 of 80). That is +2.5 in 40 at most.
- **Also tried on the duo:** 3%/2% gave 28, 2%/2% gave 27, 2%/3% gave 28, 3%/3% gave 32 and 3.5%/2% gave 30.
- **The no-set positioning is unchanged.** Without a set, the Lumen bot stands too far from the tank. Skills measured that forcing the drift with no set lifts the duo from 24 to 49 of 80. The Hammerdeep's tuning was measured with today's bots, so changing that is a separate roadmap item.
- **The in-game text was stale.** The bonus text still quoted the first pass (6% and 5%). It now says 3% and 2.5%. The Wrackrider text also still quoted its first pass ("After 1s", "+10%"). It now says 0.5 s, the 1 s linger and +8%, matching wrackline.md. A test in tests/sets.test.ts now checks that those four sets' texts quote SET_TUNING.

**Ondrel's title is renamed** from "Ondrel, the Anvilward" to **"Ondrel of the Hammerdeep"**. The doc had also planned an "Anvilward set". A search found WoW's NPC Prospector Anvilward (wow.gamepedia.com/Prospector_Anvilward), and under Steve's rule coined words that match WoW names get renamed. The set's first verb, "hold the line", is a WoW quest and spell (wowhead.com quests 24469 and 14347, spell 325601), so it changed too. "Stand together" (spell 299254) and "Shoulder to shoulder" (a quest) were dropped for the same reason. "Deepguard" has no match on wowhead.com, warcraft.wiki.gg, wowpedia or the open web.

## The Ashvents (G3, second group dungeon)
Roadmap G3: a group boss for tier 7+ with a **split** check (the party must stand in two places at once) and a **spread** check (no stacking). Ondrel tests the tank and the healer; Ysmeret tests where everyone stands.

Unlocks at tier 7, group style, a party of 2 to 4. Trash reuses existing kinds. It needs the co-op telegraph fix (engineering's #59): a soak is made if *any* hero stands in it, and a telegraph's clock runs once per tick.

**Boss: Ysmeret, the Twofold Flame.** A fire spirit that breathes through two vents in the floor. (Not "bellows": the Foundry's Maelra already has that theme.)

| Mechanic | What it does | Who answers it |
|---|---|---|
| **Twin Vents** (split) | Every 16 s, two gold circles open on opposite sides of Ysmeret, 220 units out, square to the tank's line. Each lands after 4 s. An empty vent blasts **every** hero and spills Ashlings. | The party splits: at least one hero per vent. A party of 2 means the tank and healer each leave the boss for a moment. |
| **Scatter Embers** (spread) | Every 14 s (never while vents are open), a 2.5 s wind-up marks every hero. On landing, each mark bursts around its hero: the hero takes 10% of max health, and every **other** hero within 80 units takes 35%. | Everyone spreads out. Two stacked heroes take 45% each, and four take 115% (dead). Spread out, it's 10%. |
| **Bellow Slam** (tank) | Every 9 s, a 1.5 s wind-up on its threat target, then a heavy hit that blocks and dodges can't stop. | The tank takes it. It's lighter than Anvilfall, because the tank also has to run to a vent. |

Soft enrage at 4.5 minutes: vents open every 8 s.

**Why these two:** both are about position, not reflexes, and both read on a phone (a gold circle and a ring on each hero). They also test each other: the vents pull the party apart, and Scatter is timed so it never lands while vents are open.

**Bots** (`sim/bot.ts`) need two new behaviours to test it:
- Vents: each vent gets the nearest unclaimed hero, and the rest go to their nearest vent. Today every bot runs to the nearest soak, which would leave one vent empty.
- Scatter: while marked, move away from the nearest ally until 2 × 80 units apart.

**Targets** with tools/group.ts, heroes-r2 hero-t8-0, at tier 8:
- Tank + healer + 2 damage: 55 to 70%.
- Bots that ignore the vents (all to the nearest one): under 15%.
- Bots that ignore Scatter: under 25%.

**First pass, measured** (tools/group.ts, heroes-r2 hero-t8-0, tier 8, seeds 1-60). The table shows the final numbers on main with #59 and G1 #64. In brackets are the numbers before G1, with #59 merged in locally. `NOSPLIT=1` and `NOSPREAD=1` switch off the new bot behaviours to measure what each check is worth.

| Party | Wins |
|---|---|
| Bulwark + Lumen + Duskblade + Emberwright | 38/60 (36) |
| Same party, bots ignore the vents | 0/60 (2) |
| Same party, bots don't spread | 7/60 (8) |
| No tank (Lumen + 2 Duskblade + Emberwright) | 4/60 (7) |
| No healer (Bulwark + Duskblade + 2 Emberwright) | 14/60 (11) |

Tuning steps: Bellow Slam 90 and Scatter 8%/25% gave 1/6 on a quick check, because the tank died and the boss then slammed the damage dealers. Bellow 70 with Ysmeret at 4800 health gave 22/24 (too easy). Bellow 80, 4800 health and 8%/25% gave 33/40, but not spreading still won 19/40, so Scatter was raised to 10%/35% and Ysmeret's health to 5000. Bellow 90 was the last step.

**Reward:** the same as the Hammerdeep (G5: every hero gets a boss item plus a second Rare or better).

**Names:** web searches on 21 Nov 2026 for "Ashvents" game dungeon and "Ysmeret" game found no game using either (result titles only, so it's a search check, not a legal clearance).

## The Ventwalker set (21 Nov 2026)
This is the Ashvents' verb set. Ysmeret's head, hands and trinket drops can be Ventwalker pieces (`withSet`, 60% of set-slot drops, never in bounties). The verb is **split up**, the opposite of the Hammerdeep's Deepguard ("stay close"): Ysmeret's Twin Vents need the party in two places at once, and her Embers punish stacking. All the numbers are in `SET_TUNING` (`vw*`) in `sim/content/sets.ts`.

- **2 pieces:** while an ally is alive in the fight and none stands within 140 of you, you deal 6% more damage. Solo it does nothing, and the item text says so.
- **3 pieces:** standing in a gold circle when it lands (a vent, the raid's vents, or the Kiln Mother's Brand) heals you 5% of your health. This piece works solo too, in the Kiln.

**Measured** with tools/group.ts (`DUNGEON=ashvents SET=ventwalker SETN=3`), heroes-r2, seeds 1 to 80, on main f18add5 plus this change. Wins out of 80:

| | No set | Every hero 3 pieces |
|---|---|---|
| Tier 8, full party (hero-t8-0) | 50 | 60 |
| Tier 6, Bulwark and Lumen duo (hero-t6-0) | 31 | 39 |

That is +5 and +4 wins in 40, inside the 2 to 7 range the other sets give. Solo in the Kiln (tier 7, hero-t8-0, 40 seeds, `tools/foundry.ts`), the 3 pieces add 1 to 3 wins in 40 through the Brand: the Emberwright 27 to 30, the Duskblade 25 to 27, the Bulwark 37 to 38 and the Lumen 39 to 40.

**Name:** "Ventwalker" has no match on wowhead.com, warcraft.wiki.gg, wowpedia or the open web (21 Nov 2026). "Split up" is a plain phrase used as the verb label only.

## The Pressworks (G9, third group dungeon, 21 Nov 2026)
A stamping works, from tier 10. Its group check is new: **take turns**. The Hammerdeep asks the party to stay close and the Ashvents to split up. The Pressworks asks the party to share one job in rotation. Code: `OSKEL` and `oskelClock` in `sim/world.ts`, and `downstrokeTaker` in `sim/bot.ts`. Tests: `tests/pressworks.test.ts`.

**Oskel of the Pressworks** (6 400 health before tier and party scaling):

| Cast | What it does | Answer |
|---|---|---|
| **Downstroke** | Every 13 s (8 s after the 270 s soft enrage), one gold plate 200 from Oskel, with a 4 s fuse. A missed plate hits every hero for 70 and spawns adds, like any missed soak. Everyone under it who wasn't Pressed becomes **Pressed** for 20 s. A Pressed hero under the next plate takes 50% of max health and doesn't count | One hero who isn't Pressed stands under each plate. Pressed lasts longer than the gap between plates, so nobody can take two in a row: the party takes turns |
| **Rivets** | Every 9 s, a ring (radius 60, 1.6 s) under every hero | Step out |
| **Stamp** | Every 10 s, a 2 s cast, then a tank hit (75) through dodges and shields | A tank cooldown. Bots treat it as a tank-buster (`busterTarget`) |

The HUD shows a red "Pressed 12s" chip while it lasts. The banners say "Downstroke!" (or "You're Pressed: stay out of this one") and "Stamp!".

**Bots:** the nearest living hero who isn't Pressed takes the plate. The tank stays on Oskel unless nobody else can go. Everyone else steps out of it. NOTURNS=1 makes every bot run under every plate, to measure what taking turns is worth.

**Measured** with tools/group.ts, full party (Bulwark, Lumen, Duskblade, Emberwright), seeds 1 to 40, on main 63ddacc plus this change. Wins out of 40:

| | hero-t8-0 | hero-t8-1 | hero-t8-2 |
|---|---|---|---|
| Tier 10, bots take turns | 27 | 33 | 35 |
| Tier 10, nobody takes turns (NOTURNS=1) | 0 | | |

- **Tier 10 with hero-t8-0:** 27 of 40 (68%), inside the 60 to 75% group target at the unlock tier. Tier 11 gave 6 and tier 12 gave 2, as steep as the Ashvents, which went from 14 of 20 at tier 8 to 3 of 20 at tier 10 with the same heroes.
- **Taking turns is the check.** Without it the party won 0 of 40. A Bulwark and Lumen duo at tier 8 also went from 37 to 0 of 40.
- **Duo (Bulwark and Lumen, hero-t8-0):** 37 of 40 at tier 8, 11 at tier 9 and 5 at tier 10. The duo can do it, but it's the hard way, as in the other group dungeons.
- **Stamp was tuned down** from a first-pass 110 to 75. At 110 the full party won 0 of 6 at tier 10, every run lost to Stamp on the tank. At 60 it won 20 of 20.

**No Fill with bots here** (`botFillBlocker`). Bots never miss a turn, so a bot fill won as often as a real party. Across 12 fills (4 player classes × 3 hero files) at tier 10 it averaged 30.7 of 40, against the real party's 31.7. Lowering the bots' gear barely helped: a Bulwark with bots at 60% gear still won 31 and 38 of 40 with two hero files. Filling only to 3 heroes didn't help either (32 to 39 of 40). The guardrail from botfill.md is "a bot fill wins less than a real party", and only leaving the Pressworks out keeps it. The hub says "Taking turns needs real heroes: no bots."

**Reuses:** the trash comes from existing families (warpack, glass, wardens; named anvilguard and bellwarden), so the boss is the only new art. Visuals drew it on this branch (sprite, plate, rivets, Stamp die, Pressed mark, floor and card). Sound needs a theme and cues for `downstroke`, `rivets` and `stamp`.

**Follow-ups:** a verb set for the Pressworks ("take turns") and a boss achievement, each with a name check.

**Names:** every new name was searched on wowhead.com, warcraft.wiki.gg, wowpedia and wowsurvivors.com on 21 Nov 2026. "Pressworks", "Oskel" and "Downstroke" have no WoW matches. The only "Downstroke" hit is a Wowhead forum thread title, not a game name. "Rivets", "Stamp" and "Pressed" are plain words. None of them is used elsewhere in the game.

## In-fight revives (G6): the boss rules

**The rule.** Standing on a downed ally picks them up at 30% health (`REVIVE_RADIUS`, `REVIVE_HEALTH`). Outside a boss fight it takes 3 s, with no limit. While a boss is up, it takes 9 s, and the party gets one pick-up for the whole boss fight (`REVIVE_RULES` in sim/world.ts, read through `World.reviveSeconds` and `World.revivesLeft`). Once it's used, the downed hero's bar says "no revives left this boss", and the revive circle goes away.

**Why.** Revives in a boss fight are where they decide the outcome. Free ones turn every group fight into a win: with skills' rescuing bots (#159) and no limit, every full-party cell measured 39 or 40 of 40. MMO raids handle this the same general way, with a slow, limited rescue in combat and free ones between pulls. The 9 s pick-up costs the rescuer real damage and real danger, and one per fight keeps a wipe a wipe.

**How it was chosen** (tools/group.ts, heroes-r2 at the matching tier, 40 seeds, wins out of 40):

| Rule | Crucible 8 | Ashvents 8 | Hammerdeep 8 | Hammerdeep 6 |
|---|---|---|---|---|
| Bots never revive (main) | 26 | 34 | 26 | 38 |
| Unlimited, 3 s | 39 | 40 | 40 | 40 |
| Boss: none at all | 26 | 34 | 26 | 38 |
| Boss: 1 pick-up, 6 s | 29 | 37 | 36 | 39 |
| Boss: 2 pick-ups, 6 s | 30 | 37 | 36 | 39 |
| Boss: 1 pick-up, 9 s | 26 | 35 | 26 | 38 |
| Boss: 1 pick-up, 12 s | 26 | 32 | 23 | 37 |

All four are full parties. Trash-fight revives change nothing: "Boss: none at all" matches main exactly, and a 5 s trash pick-up measured the same as 3 s. One pick-up and two measured the same, so the rule is one. At 9 s the full parties land where they were before bots revived, so the bot party is now a fair stand-in for players who do.

**Ysmeret, 5000 to 6200 health.** The Ashvents full party was already over its 55 to 70% target on main (67 of 80, 84%) after #159's Anvil Skin fix. With 6200 it wins 54 of 80 (68%). 6600 gave 44 of 80 (55%), the bottom of the band.

**Final numbers, 80 seeds** (main, then this change):

| Cell | Main | Now |
|---|---|---|
| Crucible 8, full party | 46 | 49 (61%, under the raid's 70% ceiling) |
| Ashvents 8, full party | 67 | 54 (68%) |
| Ashvents 6, Bulwark and Lumen | 58 | 28 (35%) |
| Ashvents 6, Emberwright and Lumen | 0 | 0 |
| Hammerdeep 8, full party | 54 | 53 |
| Hammerdeep 6, Bulwark and Lumen | 29 | 28 |
| Hammerdeep 6, full party | 78 | 77 |

**Watch items.**
- The Ashvents duo of a tank and a healer fell from 72% to 35%, because Ysmeret's extra health weighs most on a party with little damage. There's no duo target, and a duo is short of damage by design.
  - **Closed 21 Nov 2026.** Health already scales by party size for every enemy, bosses included: `spawn` in `sim/world.ts` multiplies by `partyHealth(partySize)` (1.775 for two heroes, 3.175 for four, `sim/content/scaling.ts`). So "scale Ysmeret's health by party size" is already done, and it is not a free lever.
  - The duo now matches the Hammerdeep's: both group dungeons give a Bulwark and Lumen duo 28 of 80 at tier 6 (table above). The rule is the same in both: a tank and healer alone can clear a group dungeon about a third of the time, and adding a damage dealer is the way to win reliably. Re-open this only if real duos are a large share of group runs.
- Hammerdeep 6 with a full party is far over its old 60 to 75% target (77 of 80), and was before this change. Health is the wrong lever: Ondrel at 7200 brought it to 29 of 40, but the tier 8 party fell to 6 and the duo to 2. Settled below in "Hammerdeep targets, restated".
- A pair with no tank in the Ashvents still wins 0, inside the "under 25%" target for no tank.

### Hammerdeep targets, restated (21 Nov 2026)
The Hammerdeep's targets were set at tier 6, when it was the only group dungeon. Now the Ashvents opens at tier 7 and the Crucible at tier 8, so the Hammerdeep is where parties learn to group (it opens at tier 4). Its curve on main 9ab2145 (tools/group.ts, heroes-r2 at the matching tier, 80 seeds):

| Tier | Full party | Bulwark and Lumen |
|---|---|---|
| 4 | 80 (100%) | 79 (99%) |
| 6 | 77 (96%) | 28 (35%) |
| 8 | 53 (66%) | (not run) |

**New targets:**
- Tiers 4 to 6, the learning tiers: a full party with a tank and a healer wins at least 80%. The roles must still matter by tier 6. Measured (80 seeds):

  | Tier | No tank (Lumen, 2 Duskblades, Emberwright) | No healer (Bulwark, Duskblade, 2 Emberwrights) |
  |---|---|---|
  | 4 | 52 (65%) | 63 (79%) |
  | 6 | 7 (9%) | 15 (19%) |

  Tier 6 meets the "under 25%" bars. Tier 4 forgives a missing role, which suits a party's first group fight.
- Tier 8: 55 to 70% for a full party, the same band as the Ashvents. It's 66% now.
- A tank and healer with no damage dealer has no target. They lack damage by design.

**Why not tune tier 6 down:** every lever measured so far (Ondrel's health, revive timing) moves tier 8 and the duo far more than the tier 6 full party. A first group dungeon that a prepared party clears is the right first lesson.

## Delve setup and Quick join (engineering)
- `DungeonDef.style: 'solo' | 'group'`. The delve card shows the label, and in a party it shows the roles present: **Tank ✓ Healer ✗ Damage ✓✓**. Classes map to roles from `CLASSES[].role`.
- Ask for engineering: add `roles` to `LobbyAd`, and let `pickParty` prefer a party that lacks your role (a Lumen seeker goes to a party with no healer first). The party card shows "Needs: Healer".

## Testing
- `tools/group.ts`: a party of bots, each hero driving its own input (`use(i)` then `botInput`). Target win rates with heroes-r2 hero-t6 at tier 6 (the Hammerdeep's full-party band was restated, see "Hammerdeep targets, restated"):
  - Tank + healer + 2 damage: 60 to 75%.
  - No tank, or no healer: under 25%.
  - Two damage dealers only: under 10%.
- Tests: Anvilfall targets the threat leader, Slag Grip clears on an ally heal and not on a self-heal, a solo hero can't start the Hammerdeep, and the label shows.

## Names
A web search on 21 Nov 2026 for "Hammerdeep" game and "Anvilward" game boss found no game using either name. A later check found WoW's NPC Prospector Anvilward, so Ondrel's title became "Ondrel of the Hammerdeep" (see the Deepguard set) (result titles only, so it's a search check, not a legal clearance).
