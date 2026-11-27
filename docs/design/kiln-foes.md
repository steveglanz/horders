# The Kiln's foes, from jobs (Checkpoint 3)

Design, 27 Nov 2026. Vision v2 section 6 rule 9 ([vision/vision.md](vision/vision.md)): foes are built from 8 jobs, each with one tell; each place re-glazes 4 or 5 jobs and adds one twist foe; packs mix 2 or 3 jobs; no two places share a trash list. Names follow [world.md](world.md) ("name it for the pot or clay thing it is, or for its job in plain words", no Ember-, Cinder-, Ash- prefix). Pillar 2 (read it, answer it) and pillar 5 (one world, one voice).

Steve can veto any name; design then brings one searched alternative. Work doesn't wait.

## Before

The Kiln drew from 10 foe kinds, and two of them did the same job: the Cinderhound and the Ashbuck both charge down a red lane. It shared every opener with other places (`riftfall` sat in 7 of 12 dungeons). 3 of 7 openers were one job only (`pack`, `wardens`, and `ashbucks`, whose Ashbucks and Hound are all chargers). Seven names broke the prefix rule (Cinderhound, Cinder Brute, Ember Spitter, Ember Acolyte, Ashling, Ashbuck, Ashwall).

## The roster: five jobs and one twist

Ids in the code don't change (saves, netsync and art key on them). Only what players read changes.

| Job | Foe (was) | Tell, as the code has it | Answer |
|---|---|---|---|
| Charger | **Hound** (Cinderhound) | Snap: a red cone, 0.6 s. Pack lunge down a red lane (FOE_AI_LUNGERS) | Step to the side |
| Brute | **Urn Warden** (Hollow Warden) | Warden Slam: a red ring round it, 1.2 s, every 4.5 s (sim/world.ts, `husk`) | Walk or roll out of the red |
| Caster | **Crock** (Cinder Brute) | Ground Pound: a blue cast bar, 1.4 s, interruptible (`startCast(..., true)`) | Quench it |
| Mender | **Censer** (Ember Acolyte) | Circles the Crock and mends it, a steady heal (runStationary) | Break it first |
| Spitter | **Spout** (Ember Spitter) | Lob: a slow fire circle where you stand (spitLob) | Keep moving, then run it down |
| Twist | **Wall Crack** spilling **Sherds** (Hollow Rift, Ashling) | Stands still; spills up to `riftCap` Sherds every 3 s | Break the Crack first |

Named: **the Taster** stays (Uncle Glut's taster). The Kiln Mother and her bellows are her fight.

The nameplate's second line is now the job (Charger, Brute, Caster, Mender, Spitter, Swarm, "Break it first"), so a new player reads what a foe is for before they learn its name.

**What left the Kiln.** The Ashbuck (a second charger) and the Ashwall (the shielder, a sixth job). [world.md](world.md) already put both in the Foundry, so the Ashwall's pack takes the Foundry opener slot of the shared `riftfall`. That makes the Wall Crack one step closer to the Kiln's own; the other places drop it in their Checkpoint 5 pass. The Ashbuck stays where it already was (Foundry, Glarewell and Wrackline fights). Bomber and shielder are jobs for later places.

No new foe kinds, so FOE_AI_OWN_MOVE and FOE_AI_LUNGERS (sim/world.ts) don't change: the Hound is already a lunger and the Spout already moves on its own.

## The packs

Openers (rooms A, B and the easy fork door; trash: twice the foes at 30% health, a single special foe stays at one, sim/halls.ts KILNTRASH). Every opener is two jobs, and no other place uses it.

| Id | Name | Foes (before trash doubling) | Jobs |
|---|---|---|---|
| houndSpout | Hounds and a Spout | 3 Hounds, 1 Spout | charger + spitter |
| urnHounds | The Urn Warden and its Hounds | 1 Urn Warden, 2 Hounds | brute + charger |
| urnSpouts | Spouts behind the Urn | 1 Urn Warden, 2 Spouts | brute + spitter |
| crackHounds | The Wall Crack | 1 Wall Crack, 2 Hounds | twist + charger |
| crackUrn | The Crack and the Urn | 1 Wall Crack, 1 Urn Warden | twist + brute |

Named (the hard fork door, C): `brute` the Crock, `ashmaw` the Taster, `spitterBrute` the Crock and its Spouts (caster + spitter), `crockHounds` the Crock and its Hounds (caster + charger, new; replaces Warden and Ashbucks).

Door guard (E): `acolytes` the Crock and its Censers (caster + mender), or the Taster. Unchanged.

The opening (docs/design/opening.md) keeps its own fixed rooms (hounds, the slammer, the caster); they are the Hound, the Urn Warden and the Crock.

Shared encounters that other places still use (`pack`, `wardens`, `spitters`, `riftfall`, ...) keep their ids and get the new foe names in their text.

## Balance check

Smallest grid that answers "did the Kiln get harder or easier": average skill (REACT=0.3 FORGET=0.2 STEPERR=0.5), HALLS=1, 20 seeds, 5 classes, Kiln t1-t3 with a fresh hero, plus the Foundry at t4 (hero-t4-0) and t6 (hero-t6-0) for the Ashwall move. Bar: within 3 of 20, a miss gets more seeds before anyone acts. main 61e916f vs this change:

Wins of 20, main -> this change:

| Class | Kiln t1 | Kiln t2 | Kiln t3 | Foundry t4 | Foundry t6 |
|---|---|---|---|---|---|
| Bulwark | 20 -> 20 | 20 -> 20 | 16 -> 18 | 20 -> 20 | 20 -> 20 |
| Duskblade | 20 -> 20 | 20 -> 20 | 20 -> 19 | 20 -> 20 | 19 -> 19 |
| Emberwright | 20 -> 20 | 20 -> 20 | 17 -> 16 | 18 -> 20 | 7 -> 8 |
| Lumen | 20 -> 20 | 17 -> 20 | 18 -> 17 | 20 -> 20 | 20 -> 20 |
| Slagbinder | 20 -> 20 | 20 -> 20 | 20 -> 20 | 20 -> 20 | 20 -> 20 |

Every cell is within 3, so no retune. The Emberwright's Foundry t6 (7-8 of 20) is the known wall from before this change (teams/design.md open work 1), not from the Ashwall.

## Open

- Art: the Hound, Urn Warden, Crock, Spout, Censer and Wall Crack still wear today's sprites and 3D bodies; visuals re-glazes them as pottery (one body per job) with the look test winner.
- Sound: no change (cues key on ids).
- Checkpoint 5: every other place's own roster; the Ashbuck and Ashwall get prefix-free names there; the Wall Crack leaves the other places' lists.
