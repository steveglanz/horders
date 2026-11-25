# Wrackline Halls on phones (H3d, 25 Nov)

Phone pass on the Wrackline's Halls map (`?halls=1&hallsbeta=1`, 3D), at 320×568 and 568×320.
Shot with `node tools/wrackhallsshots.cjs <out> [p320|l568] [seed]`. Seed 8's first pack has a Barge Hauler, a walking
foe that can stand on a raft until the Ebb starts.

## Checked, fine

- The Ebb's line, "Get on a raft: the water keeps them off until it stops.", fits whole at 320px on two lines (`p320-2-ebb-warn`).
- The rafts read as afloat: wooden decks on the water, and their rims light up white for the warning (`l568-1-rafts`).
  No raft rests on a dry floor; the corridors are brick jetties.
- The pull: pale streaks run in from the rim to the room's drain (`p320-5-ebb-pull`).

## Fixed here

- When the Ebb starts, #725 pushes every foe off an afloat raft in a single step. On a phone that read as a jump
  (`before-p320-4-shove-after`). That foe now gets a splash where it lands and a short wake back to where it stood,
  for 0.45s of world time (`p320-3-shove-before` → `p320-4-shove-after`). The splash is drawn bold because the 3D
  floor carries it at about a third of its size on a Halls map.
