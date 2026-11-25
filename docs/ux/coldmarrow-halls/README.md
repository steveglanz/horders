# Coldmarrow Halls on phones (H3c, 25 Nov)

Phone pass on the Coldmarrow's Halls map (`?halls=1&hallsbeta=1`, 3D) at 320×568 and 568×320.
Shot with `node tools/coldhallsshots.cjs <out> [p320|l568] [seed]`. Seed 4's first pack has a Dimhorn. Once that pack
wakes, the tool takes the hero off autopilot, so the call goes off.

## Fixed here

- A foe's bar and name could float far from it. When foes bunch up, a bar steps up above the bars already placed, and
  the overlap box was a fixed 96px. So the Dimhorn, 50px from two Snuffers standing on the hero, had its bar stacked
  75px above it (`before-p320-3-dark-call`). The box is now the bar, or its measured name where that is wider, and an
  overlap of 14px or less nudges the bar sideways instead of up (`p320-3-dark-call`).

- The Dark Call now has a warning line (design's text): "Dark Call! Get your coal's light on the Dimhorn" (`p320-3-dark-call`).

## Reported, not changed (passed to visuals)

- The coal light round the hero reads as a faint thin ring on the darker floors.
- Rimehounds are near-black on the dark floor. You see their bars and a speck of red ring (`l568-4-hounds-in`).
