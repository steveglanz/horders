# Combat and feel proposal: fewer fights, bigger fights, every one a duel you read

*Combat and Feel Designer, 27 Nov 2026. Claims about other games link a source; **(judgment)** marks my opinion. Horders evidence: audit.md, the phone screenshots, the repo.*

## 1. Diagnosis

**My verdict: keep the core and sharpen it hard.** The core is room-to-room delves, a stick, four ability buttons, an automatic basic attack and bosses with telegraphs. It suits a portrait phone. Dead Cells and Grimvalor use about the same layout on touch screens, and reviewers praise their controls ([TouchArcade](https://toucharcade.com/2019/08/28/dead-cells-iphone-review/), [Android Central](https://www.androidcentral.com/grimvalor-beautifully-polished-platformer-you-can-try-out-free-game-week)). It also sets us apart from auto-fire survivors games (positioning.md). The problem is execution, not concept.

1. **You can't see the fight.** In 13-08-hud.jpg the hero is about 30 px tall, the eight cinderhounds are each smaller than a fingertip, and about half the screen is empty corridor and floor. A banner covers the fight's first seconds. Foes this small make hits feel weightless and damage feel random.
2. **Hits have no weight.** Screen shake lives in 4 files and hit-stop (a tiny freeze when a blow lands) in just 1 (client/GameScene.ts). No one has ever done a feel pass as its own task (audit).
3. **Fights run too long, and some losses come from a clock.** At average skill a Slagbinder win takes 581 s against Duskblade's 323 s (audit). The audit run lost the Kiln Mother to "Burnout (the fight ran too long)" after 6:08, with no damage taken from the boss (13-13-end-full.jpg). A loss with no killing blow feels like being cheated **(judgment)**.
4. **Melee fails when the dungeons get harder.** At average skill, Duskblade and Bulwark win 0 of 40 in Coldmarrow at tier 10, while the ranged classes win 29 to 39 of 40 (audit).
5. **The foes don't make you think.** Seven of twelve places draw their trash packs from the same Kiln and Foundry pool (dungeon.ts:211-249). Packs rarely combine foes into a problem to solve.
6. **The classes play alike in the first minute.** All five have a Q attack, a mobility move on E, a big R and an interrupt on F. The real differences hide in resources and trees.

## 2. Vision

**"Every fight is a short duel you read and answer."** Picture 3 to 5 foes on screen, each big enough to read by its outline. Each has one tell in a fixed colour: red means move, gold means stand here, blue means interrupt. You answer with a flick of your thumb or a button press, and every answer lands with weight: a flash, a short freeze, a knockback, a buzz in your hand. Trash takes 15 to 30 seconds. A named fight takes 30 to 45 seconds. A boss takes 60 to 90 seconds for every class. A delve takes 6 to 8 minutes.

That is "a mini MMO dungeon in your pocket," and it backs the hook the retention research found: readable boss fights in a portrait game with roles (research-retention.md, section 5).

## 3. Seven changes, most important first

### 1. Bring the camera in and make every foe matter
- Zoom in so heroes stand 70 to 80 px tall (as the market research also says). Trash should be at least 40 px. Bosses should fill about a third of the screen width.
- Cut packs from 6 to 8 small foes to 3 to 5 bigger ones. Any crowd is "Swarmlings" that die to one or two basic attacks, so the auto-attack feels strong.
- Add an arrow at the screen edge for any telegraph aimed at you from off screen.
- Move the intro banner to a one-line strip above the buttons.
- *Buildable:* camera and spawn counts are settings.

### 2. A hit-feel kit, done once and applied everywhere
Vlambeer showed that about 30 small tweaks turn a dull shooter into a satisfying one ([Game Developer](https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games)). Our kit has one level for each hit size, from small to boss:
- **Every hit:** a white flash (60 to 80 ms), a short knockback on normal foes, a damage number sized to the hit.
- **Big hits and kills:** 40 to 90 ms hit-stop, small screen shake (with an off switch), a burst of shards on death.
- **Haptics:** a light buzz when your hit lands, a heavy one when you take damage, a pattern when you interrupt a cast. The free Capacitor Haptics plugin does this on iOS and Android ([Capacitor docs](https://capacitorjs.com/docs/apis/haptics)).
- **Sound:** a layered impact with slight pitch changes; the interrupt gets the best sound in the game **(judgment)**.
- *Buildable:* one `feel.ts` table plus a test scene that records a clip of every hit size for Steve to approve.

### 3. A flick-dodge on the movement thumb
A quick flick of the stick rolls the hero a short distance. During the roll, telegraphed attacks can't hurt you (0.3 s), and the roll recharges in about 3 s. No new button, and every class has it, so E becomes a true class move. Telegraphs are our fight language, so red needs one reliable answer always under the thumb **(judgment)**. It also helps melee: stay close and roll through a slam instead of walking out and back.
- Keep the automatic basic attack. Abilities aim at your current target with a tap. Holding a button shows the area and lets you drag to aim. Brawl Stars uses this tap-or-drag pattern (play knowledge; see [PocketGamer's guide](https://www.pocketgamer.com/brawl-stars/brawl-stars-tips-and-tricks-a-guide-for-the-beginner-brawler/)).
- *Buildable:* one input gesture and one i-frame flag in the sim. The bots need a "roll when red" rule so the playtest numbers stay honest.

### 4. Fight-length budgets, and no more losses to the clock
- Set a time budget for every fight: trash 15 to 30 s, named 30 to 45 s, boss 60 to 90 s, at average skill, for **every** class. Bots already measure fight lengths (balance.md); make that a gate, so no change merges that pushes a class out of budget.
- Close the class gap (Slagbinder runs take nearly twice as long as Duskblade's) by tuning the slow classes' kits, not by adding damage everywhere.
- Replace Burnout with a **visible enrage**. At 90 s the boss glows, says a line, and hits harder every 10 s. You fall to her, not to a timer, and the loss screen can name the blow.
- Boss phases of 20 to 30 s, each adding one new mechanic.

### 5. Every boss attack has a melee answer
Add a rule to every boss spec: each attack has a safe spot within melee reach (under her, behind her, or a gap in the ring), or it can be rolled through. Cones and pulls get at least 0.8 s of warning. Give melee one survival edge: Duskblade heals a little on hits against bleeding foes, and Bulwark can parry (change 6). **Target:** at average skill, no class falls below 60% of the best class's win rate in any dungeon. Re-measure the whole matrix; it hasn't been since the M3 cone fix.

### 6. One signature verb per class that you feel within 30 seconds
Brotato's characters are "surprisingly unique to use" because each one bends a rule ([TouchArcade](https://toucharcade.com/2023/04/04/brotato-iphone-ipad-android-review/)). Each class gets one, inside its existing kit:
- **Emberwright, Overheat:** Heat over 80 doubles your fire, but at 100 you scorch yourself. You play close to the edge.
- **Duskblade, Backstab:** hits from behind always crit, and a kill resets Rending Dash. You flow from foe to foe.
- **Bulwark, Parry:** hold E to raise the shield. Raise it just as a red tell lands and you parry, which staggers the attacker and refills Resolve. This is the tank's moment of skill.
- **Lumen, Light motes:** your hits drop motes that heal whoever walks over them. Healing becomes positioning, even solo.
- **Slagbinder, Charged shot:** hold Q to charge the cannon and release to pierce. A charged shot on a Brittle foe shatters it, with a big burst of hit feel.

Also make F an interrupt for every class. Today's split between interrupts and stuns that party bosses ignore (classes.ts `kick`) is a rule no player will discover **(judgment)**. And mark the ability option that suits most players as "recommended," since Muster wins 24 of 40 at average skill against Anvil Skin's 6 of 40.

### 7. A foe roster built from jobs, with packs set like chords
Define about 8 jobs, each with one tell: **Charger** (a red line), **Spitter** (a slow projectile), **Shielder** (guards the foes behind it, so you flank it), **Caster** (a blue cast bar, interrupt it), **Mender** (heals others, kill it first), **Bomber** (a gold ring when it dies, step out), **Swarmling** (one hit kills it) and **Brute** (a slow, heavy slam). Each place gives 4 or 5 of these its own outline and name, plus **one twist foe found nowhere else**, like the Snuffer that dims your coal in Coldmarrow. Packs then combine 2 or 3 jobs, so each pack is a small puzzle: "a Shielder in front of a Caster" or "a Mender among Swarmlings." This ends the shared trash pool. *Buildable:* behaviours are shared code, and each place is data plus a model.

(Sparks and Relics belong to the systems proposal, the look and world to the creative proposal; these changes fit both.)

## 4. What to cut

- **Burnout as a way to lose.** Replaced by a visible enrage.
- **Packs of tiny foes** that ask nothing of you.
- **The split between interrupts and stuns.** Every F interrupts.
- **Empty walking.** Shorten the corridors, and go from 6 to 8 rooms down to 5 rooms with one fork, a hard room or an easy one for a different reward **(judgment)**.
- **Difficulty from numbers alone.** Past tier 6, a tier step should add an Omen or a new behaviour, not just ×1.22 health.
- **Unreadable mechanics.** Anything average-skill bots fail over half the time with no clear tell is redone or removed.

## 5. Risks

- **Agents can measure feel but not feel it.** *Mitigation:* the test scene, recorded clips, and Steve playing on his phone at each checkpoint.
- **Accidental dodges** when you only meant to move. *Mitigation:* tune the flick speed; offer a dodge button option.
- **A closer camera hides threats.** *Mitigation:* the edge arrows, and a rule that a telegraph must start on screen or give 1 s of warning.
- **Co-op lag** makes dodge and parry timing unfair. *Mitigation:* each player's device decides its own hero's dodges and parries.
- **Rebalancing.** New verbs void today's numbers. *Mitigation:* the matrix runs on every merge.
- **The art redo changes hitboxes.** Build the feel kit on size settings, not today's sprites.

## 6. Three checkpoints

1. **"One room that feels great" (1 to 2 weeks).** One Kiln room, with Emberwright and Duskblade, one pack mixing three jobs (Charger, Caster, Swarmlings), the new camera, the flick-dodge, the full hit-feel kit and haptics. **Done when:** Steve plays 10 minutes on his phone and wants more, it holds 60 fps on a mid-range phone, and every hit flashes and sounds within 50 ms.
2. **"The Kiln Mother, remade, for all five classes" (3 to 4 weeks).** All five signature verbs, every F an interrupt, the visible enrage instead of Burnout, the melee-answer rule applied to her, and a line on the end screen like "You dodged 9 of 11 slams and interrupted 3 of 4." **Done when:** every class kills her in 60 to 90 s at average skill (bot matrix), no run is lost to a clock, and 3 or more cold testers can each name their class's verb unprompted.
3. **"Every place fights differently" (6 to 8 weeks).** The job roster spread across the places in 1.0, each with its own foes and one twist foe, packs set as chords, the tier steps as rules, and a written difficulty curve from tier 1 to 15. **Done when:** the 60% floor holds in every dungeon, every fight is in budget, and no two places share a trash list.
