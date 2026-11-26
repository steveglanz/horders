# Draw calls near walls and rims (1.0 M4)

The cost bar is 96 draw calls at 320x568 (`hd2d.stats().calls`). Rooms were only ever checked at their centres and a
few spots, so `sweep.cjs` now walks every dungeon: each Halls room's centre and 8 points just inside its outer wall,
every corridor's middle, the boss door, then through the door into the boss arena (boss up) at the centre, the south
and 8 points 60 units inside the rim. Group dungeons and raids are measured with 4 heroes on screen (the worst case),
solo dungeons with 1. Seed 8, tier 6, Graphics full.

## What was over

Only the boss arenas, at the north rim, where the camera sees the back-wall props:

| Dungeon (heroes) | Before: worst | After: worst |
|---|---|---|
| Flue, raid 4 (4) | **106** (arena NE rim; centre 95-97) | 95-96 |
| Smeltery, raid 3 (4) | **102** (arena NE rim) | 83-86 |
| Kiln (1) | 96, on the bar (arena NW rim) | 79-82 |
| Crucible, raid 1 (4) | 96, on the bar (arena NE rim) | 90-92 |

Everything else was already under: Foundry 88-89, Glarewell 94-95, Coldmarrow 95, Wrackline 86-87, Hammerdeep 91,
Ashvents 89, Pressworks 88-89, Hoard 85-86. Readings move by 1-2 between runs (things sway and move).

## Why, and the fix

A per-object count (a temporary `onAfterRender` / `onAfterShadow` hook on every mesh, as in
docs/art/room-life-draws) showed the arena props built as a mesh per part, each also drawn again in the shadow pass:

- the three beehive kilns (Kiln, and every arena that uses the default dressing): 6 meshes each, 11 draws a kiln;
- the Flue's throne: 6 meshes, 12 draws;
- the Smeltery's four ore carts: 4 meshes each, 32 draws in all;
- the four braziers (most forge arenas): 4 meshes each.

Each prop now merges its parts that share a material into one mesh (`mergeGeometries`), exactly as #795 did for the
wall chains: the kilns are 3 meshes (basalt, brick, the glowing mouth), the throne 3 (iron, brass, flames), the carts 2
for all four (iron, ore), and the braziers 2 for all four (iron, coals) plus a flame each, since the flames flicker one
by one. Same shapes, places, materials and shadows, so the look is unchanged (see the before/after pairs).

- `flue-arena-rim7-before-after.jpg`: 106 → 95, four heroes, the Furnace Regent up.
- `smeltery-arena-rim7-before-after.jpg`: 102 → 83, four heroes, the Cinder Colossus up.
- `kiln-arena-rim5-before-after.jpg`: 96 → 79, solo, the Kiln Mother up.

## Re-make

```
npm run build
node docs/art/rim-draws/sweep.cjs dist out                      # all 12 dungeons, about 10 minutes each batch of 4
ARENA_ONLY=1 node docs/art/rim-draws/sweep.cjs dist out flue    # just the boss arena
SHOTS=1 DSF=2 TAG=after- ARENA_ONLY=1 node docs/art/rim-draws/sweep.cjs dist out flue,smeltery,kiln
```

Each dungeon also writes `<dungeon>.json` (every point and its draw count) and `summary.json`.
