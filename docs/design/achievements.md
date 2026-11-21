# P6: achievements (21 Nov 2026)

**Problem.** Titles show over a hero in co-op (engineering's P6 work), but only weekly quests, the season track and the collection book give them. Nothing recognises what a player has *done*: beating each boss, the raid, a deep key, every class.

**Design.** Fifteen achievements, shared by every class like titles and the book. Each one pays its title once, plus embers to the class playing. All the numbers are in `sim/content/achievements.ts`.

| Achievement | What to do | Title | Embers |
|---|---|---|---|
| Kiln-Breaker | Beat the Kiln Mother | Kiln-Breaker | 40 |
| Floodwalker | Beat Maelra in the Drowned Foundry | Floodwalker | 40 |
| Lightproof | Beat the Lensmother in the Glarewell | the Lightproof | 40 |
| Winterproof | Beat Nhevra in the Coldmarrow | the Winterproof | 40 |
| Ebbproof | Beat Hessa of the Ebb in the Wrackline | the Ebbproof | 40 |
| Anvilbreaker | Beat Ondrel in the Hammerdeep | Anvilbreaker | 40 |
| Twice-Burned | Beat Ysmeret in the Ashvents | Twice-Burned | 40 |
| Slagbane | Beat Grandmother Slag in the Crucible | Slagbane | 100 |
| Many Hands | Win a delve with every class | the Many-Handed | 100 |
| Quencher | Interrupt 100 casts | the Quencher | 40 |
| Spellsnuffer | Interrupt 1,000 casts | Spellsnuffer | 100 |
| Namebreaker | Fell 25 named foes | Namebreaker | 40 |
| Bountysworn | Win 10 daily bounties | Bountysworn | 40 |
| Keybearer | Beat a level 5 Delver's Key | the Keybearer | 40 |
| Lockbreaker | Beat a level 10 Delver's Key | Lockbreaker | 100 |

All fifteen together pay 840 embers over a long time. That is about the same as the collection book's 880, so it doesn't move the Forge targets in economy.md.

**Names (checked 21 Nov 2026).** Steve's rule is no names from WoW or Azeroth Survivors.
- **WoW:** each of the 14 titles was checked against Wowpedia's full title list (the Title page's wikitext, through the fandom API) and with web searches. None is a WoW title. Two were renamed anyway:
  - "Frostborn" became "the Winterproof", because the Frostborn are WoW's frost dwarves (warcraft.wiki.gg/wiki/The_Frostborn).
  - "Castbreaker" became "Spellsnuffer", because Castbreaker is the name of a WoW addon on CurseForge.
  - "the Rekindler" was considered and dropped, because Rekindle is a WoW spell.
- **Azeroth Survivors:** wowsurvivors.com shows no achievements or titles, and searches found none.
- Close WoW titles that don't match: the Stormbreaker, the Flamebreaker, Ironbane, Gnomebane and the Lightbringer.
- warcraft.wiki.gg blocks automated fetches, so Wowpedia was the list used.

**How it works.**
- `hero.deeds` sums every run in `applyRun`:
  - wins per dungeon, for any victory (a delve, a bounty or a key run)
  - which classes have won
  - interrupts and named kills, from wins and losses alike
  - bounty wins
- `hero.achieved` lists the achievements already paid.
- The key achievements read the best key beaten in any dungeon, by any class.
- **Old saves:** a save from before this gets credit for what it already records. Every class with a win counts toward Many Hands, and any win means the Kiln was beaten, because the Kiln is the only tier 1 dungeon. This is read before the current run counts, so nothing is counted twice.
- **Hub:** an Achievements button sits under Collection on the hero card. Its sheet shows each achievement's progress, title and embers. Earned titles are worn from the Season sheet, as before.
- **End screen:** a note for each achievement the run completed.

**Later:** skill deeds that need new run tracking, such as winning at tier 6 or higher without dropping below half health. Those would need a `lowHp` field on the run summary.

Screenshots: `node tools/deedshots.cjs <outDir>` after a build.
