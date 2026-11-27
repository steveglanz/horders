# Art Director proposal: one look, one sound

*27 Nov 2026. Based on the team docs, both research reports, the screenshots and the repo. Claims about other games link to a source; everything else is my judgment.*

## 1. Diagnosis

The game doesn't look thrown together because any one piece is bad. It looks that way because **the pieces were made to different rules.**

- **Two art styles in one frame.** The default 3D look (client/hd2d/renderer.ts) stands flat pixel sprites on lit 3D floors. The 2D look (5,000 lines of sprite code in textures.ts) is a second art set to keep in step, so every art task costs twice.
- **Everything is too small.** The hero is about 30 px tall, cinderhounds are specks, and most of the screen is empty floor (13-08-hud.jpg). On a phone, small reads as cheap.
- **Colour carries no meaning.** Each place is the same tiled room under a different full-screen wash (rooms-sheet-0.png). The wash hides foes, and places look like palette swaps.
- **Placeholders show:** "Hero 2/3/4" tags, gradient-only hub cards (13-01-hub.jpg), text-only gear tiles (13-06a-tab-hero.jpg).
- **Sound doesn't belong to the world.** The repo already has a synthesized score with a theme for each place (client/audio/music.ts, 1,223 lines). Steve found it weak and replaced it with **two Suno songs, one for the hub and one for every delve**, titled "Shadow Protocol" and "Shadow of the Digital Dragon" (client/audio/tracks.ts). One song for twelve places erases their identity, and in one survey 85% of 1,799 players felt negative about generative AI in games, with art and music drawing the strongest reactions ([Quantic Foundry](https://quanticfoundry.com/2025/12/18/gen-ai/)).

**Worth keeping:** the warm dark UI kit, the action bar, the telegraph language, the sound-effect synth engine and the fire theme.

## 2. The vision: "Kiln-lit dioramas"

**One sentence:** *each room is a small handmade diorama floating in black, lit only by fire, where the Court's creatures are fired clay that cracks and shatters, and the town's heroes are painted iron figurines.*

This builds on the Creative Director's world: the Furnace Court made its servants in the kiln, so **everything the Court made is ceramic**: terracotta, glaze and stoneware, glowing through cracks. **Everything the town made is iron, cloth and brass.** That one rule sets the shape, material, colour and sound of every asset.

**How it's rendered:** chunky, flat-shaded, low-poly 3D, built from simple shapes in code, with a 3-step toon shading ramp and a dark outline. No textures, no pixel art and no image generators. Thronefall's two non-artist developers shipped a coherent look with "a very limited color palette combined with simple 3D models", plus outlines so silhouettes read ([Game Developer](https://gamedeveloper.com/design/mastering-minimalism-and-layering-complexity-with-strategy-game-thronefall)). Claude agents build this best, because it is geometry and numbers, not drawing.

**The rule that makes it readable:** *if it glows flat, it matters.* The world is lit and muted. Gameplay signals are the only bright, unlit colours on screen: telegraphs, your ally ring, loot beams and interruptible casts. Dead Cells keeps "high-contrast enemies and projectiles" so threats stand out ([Game Developer](https://gamedeveloper.com/production/art-design-deep-dive-giving-back-colors-to-cryptic-worlds-in-i-dead-cells-i-)). Downwell gives each colour one job ([summary](https://mobileapps.wikiwand.com/en/Downwell_(video_game))).

## 3. Specification (precise enough to mock)

**Camera and scale (390x844 portrait).** The camera is fixed, pitched about 55 degrees, with a narrow 30-degree field of view (today it is 42). About 9 world units fit across the screen. Size targets:

| Thing | On screen |
|---|---|
| Hero | 70–80 px tall (1.8 units) |
| Trash foe | at least 40 px |
| Elite | about 60–90 px |
| Boss | at least one third of the screen width |

Rooms are portrait (about 9 by 14 units), front walls cut away.

**Master palette: 24 colours in one file (style.ts), and nothing else allowed.**

| Group | Colours | What it's for |
|---|---|---|
| Soot (5) | #0E0B0A to #574539 | void, floors, outlines (#120D0B, never pure black) |
| Clay (4) | #6B4A3A, #8E6248, #B5835E, #D9AE82 | Court creatures |
| Iron (4) | #23262B to #8A929C | heroes, props |
| Fire (5) | #7A1E0E, #C2410C, #F07A1F, #FFB347, #FFE2A0 | light, embers, cracks |
| Signal (4), reserved | Danger #FF2D6F (the current pink-red, which stays clear of fire orange), Stand-here #FFD34D, Interrupt #59C7FF, Ally #5DFF8A | gameplay signals only |
| Rarity | its own hues | UI and loot beams only |

Each place adds **two accent colours**, used only on props and glaze, never as a wash:

| Place | Accents |
|---|---|
| Kiln | ash grey and ember |
| Drowned Foundry | verdigris #3F8F7A and rust |
| Glarewell | brass #C9A227 and lens violet #8C7BFF |
| Coldmarrow | frost #A9C8D8 (muted, so it never reads as Interrupt) and the one warm coal |
| Wrackline | sea slate #2F4A55 and lantern amber |

Every signal also has a **shape**, for colour-blind players:
- **Danger:** a filled zone with a serrated, crawling edge.
- **Stand-here:** a solid ring with chevrons pointing in.
- **Interrupt:** a cracked ring around the caster.

**Shape language.**
- **Heroes** are rounded, upright and stable: capsules and cylinders. Each class has one silhouette feature you can tell from a black outline alone, plus one cloth colour.

  | Class | Silhouette feature | Cloth colour |
  |---|---|---|
  | Emberwright | tall hood and lantern staff | amber |
  | Duskblade | crescent cowl, low crouch, two short blades | plum |
  | Bulwark | a door-sized square shield, wide stance | slate blue |
  | Lumen | a lamp-halo floating above the head | ivory |
  | Slagbinder | an oversized shoulder cannon, deliberately lopsided | olive and brass |

- **Foes** lean forward, are angular and spiky, and are built as hollow pottery. They have two glowing slit eyes, and their cracks glow in the place's fire colour.
- **Bosses** are 3–5 times hero size and are built from their place's motif. The Kiln Mother is a walking kiln whose door is her mouth.

**Materials and light.**
- **Materials:** toon shading, colours painted on the shapes, an outline drawn as a slightly larger dark copy behind each shape, and bloom only on glowing parts.
- **Lights:** a dim fill light, a warm point light that each hero carries (radius about 4 units), and at most four real lights per room. Braziers and other glows are faked with additive light pools painted on the floor.
- **Shadows:** a soft blob under each figure, for battery.

**Animation without rigs.** Rigid parts bob, lean, squash, wind up and snap forward. **Death is the signature moment:** a foe shatters into 6–10 clay shards and a burst of embers, and the shards stay on the floor for the rest of the room. Each cleared room becomes a field of broken pottery ([small feel touches add a lot](https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games)).

**Places.** Each place gets its own floor builder instead of the shared tile grid:

| Place | Floor |
|---|---|
| Kiln | cracked brick with glowing seams |
| Foundry | iron grates over dark water |
| Glarewell | polished stone with brass rings |
| Coldmarrow | ice with dark shapes frozen inside |
| Wrackline | wet planks and raft edges |

Each place also gets **one landmark room**, such as the great kiln door or the lens tower's eye.

**UI.** Keep the current kit (dark warm panels, serif headings, orange accent), and tighten it:
- **Headings:** one distinctive open-licence serif (my pick is Alegreya), bundled in the app.
- **Rendered art:** the same three.js renderer draws, ahead of time, each place's landmark room as its **hub card art**, and each class as a **figurine on a turning plinth** for the class picker, title screen and end screen.
- **Item icons:** low-poly thumbnails, each built from one of 6 slot shapes plus parts and a material (clay, iron, brass, glass) with a rarity rim. Rendered at build time by our screenshot tool (tools/uxaudit.cjs).
- **Ability and system icons:** hand-written SVG on a 24-px grid, 2-px rounded stroke, one colour plus one fill.
- **App icon:** the Kiln Mother's glowing door-mouth on black.

**Sound palette: five materials, matched to the art.**

| Material | Used for |
|---|---|
| Clay | hits on foes: a dull knock with a crack, and a tinkling shatter on death |
| Iron | heroes and armour: clank and ring |
| Fire | abilities: whoosh and roar |
| Water and steam | Quench is a steam hiss, water on fire, so the interrupt sounds like what it does |
| Glass and bells | loot, with the pitch rising by rarity |

- **Struck and plucked sounds:** modelled from decaying tones at uneven pitches (clay, iron, bells) and a standard string model.
- **Space:** each place gets a short generated echo (Kiln dry, Coldmarrow long and glassy).
- **Theme:** one four-note **ember motif** appears in every place's music and in the level-up, loot and victory stings.

## 4. Changes, most important first

1. **Replace the in-game art with kiln-lit dioramas** (heroes, foes, bosses, rooms) on one shared figure kit and style.ts. **Yes, this is a full redo of the world art.** It is not a redo of the UI kit, the gameplay code or the telegraph logic.
2. **Camera and scale pass:** heroes at 70–80 px, readable trash, no name tags in solo (a small class badge in co-op).
3. **Impose the colour rules.** A unit test fails any colour that isn't in style.ts.
4. **Shatter, feel and material sound pass:** clay shards, ember bursts, hit-flash, a 40–60 ms hit-stop, haptics, and every effect rebuilt from the five materials. In my judgment, this is the cheapest step toward "can't put it down".
5. **Replace the Suno music before we charge.** Rebuild the place themes with modelled instruments and the ember motif, then let Steve pick blind between that and Suno. If ours loses, commission a human composer at launch for 8–10 short loops (not priced yet; we get quotes). A paid build never ships Suno.
6. **Rendered front door:** hub card dioramas, class figurines, the title screen and item icons, all drawn by the game's own renderer.

## 5. What to cut

- **The 2D look as a player option, and its sprite set** (textures.ts). A low-power 3D mode replaces it: no bloom, lower resolution, fewer lights. This reverses Steve's earlier "2D fallback" direction, so he needs to approve it.
- Full-screen colour washes, the tiled grid floor, "Hero N" tags and gradient-only cards.
- Bloom on everything, and any decoration in red, gold or cyan.
- Art for places we won't ship in 1.0. I back the Creative Director's cut to seven places, which brings the job to about 5 heroes, 7 bosses and about 25 foes, down from 43 enemy types today.

**Cost (my judgment):**

| Work | Estimate |
|---|---|
| Figure kit, style.ts and renderer conversion | about 1–2 weeks of agent work |
| Each hero or foe | about half a day |
| Each boss | 1–2 days |
| Each place's floor and landmark | 1–2 days |
| **Total** | **about 5–7 weeks**, with parts in parallel |

The hidden cost is **review**: agents see the game only through screenshots, so every art PR attaches 390x844 shots and passes the checks below.

## 6. Risks

- **Programmer art or generic low-poly.** Mitigation: a proportions sheet, outlines, toon ramp and glowing cracks, proven in checkpoint 1. The black void, fire-only light and pottery creatures are what make it ours; a mock that loses them fails review.
- **Phone performance.** Outlines double the draw calls. Mitigation: batch repeated shapes, blob shadows, four lights, 60 fps on a real mid-range Android.
- **Drift between agents.** Mitigation: one style.ts, plus automated checks for palette, size (hero height measured on screenshots) and silhouettes (every foe drawn black in a grid must be tellable apart).
- **The music bet.** Steve rejected synth music once, hence the blind test and the composer fallback.

## 7. Three checkpoints

1. **One room (visuals-only test slice).** KILL KNIGHT's team built a visuals-only slice before full production ([Unity](https://unity.com/blog/how-playside-studios-built-kill-knight-visual-identity)). Ours: the Kiln entry room, the Emberwright, a cinderhound pack, one telegraph, the shatter, new hit sounds and the ember motif. **Pass:** Steve picks it over today's look side by side; the hero measures at least 70 px; 60 fps on the test phone; the silhouette check is green.
2. **The Kiln and the front door.** The whole Kiln including the Kiln Mother, all 5 heroes, hub card art, the title screen, item icons, and hub and Kiln music. **Pass:** five people who have never seen the game look at it cold. None say it looks AI-made or cheap, and most name a fair price at $4.99 or more. We take the store screenshots from this build.
3. **Every shipped place.** The remaining places' floors, foes, bosses, landmarks, music and echoes. The old sprite code is deleted. **Pass:** every automated check is green, Steve signs off, and a trailer is recorded in-game.
