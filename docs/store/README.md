# Store page assets (roadmap L5)

Everything a store or launcher page needs, made from the game itself so it can be
regenerated after any art change.

## App icon

`icon.svg` is the master: the ember sun rising behind the forge anvil, on a dark
forge glow. It is a full-bleed square, and the art stays inside the central 80 %
circle, so it survives the rounded-square and circle masks that launchers apply
(see `icon-masks.png` in the screenshots folder).

The rendered sizes are in `icons/` (1024, 512, 192, 180, 48 and 32 px).
The game page uses the same SVG as its favicon, inlined in `client/index.html`
because the build is a single file.

## Screenshots

The screenshots are too large to keep in the repo (about 2 MB each), so they are
regenerated on demand. Previews of the current set are in `docs/art/store/`; the
full-size set was last made on 21 Nov 2026 from the build deployed that morning, and
is in the project files under `horders/visuals/store/v3/`.

`node tools/storeshots.cjs <outDir>` (after `npm run build`) writes:

| File | Size | For |
| --- | --- | --- |
| `icon-1024.png`, `icon-512.png` | 1024², 512² | App Store / Google Play store listing |
| `icon-192.png`, `icon-180.png` | 192², 180² | web app manifest, Apple touch icon |
| `icon-48.png`, `icon-32.png` | 48², 32² | favicons, small launchers |
| `phone-*.png` | 1290 × 2796 | phone portrait (Apple 6.7"/6.9", Google Play) |
| `landscape-*.png` | 2796 × 1290 | phone landscape |
| `desktop-*.png` | 1920 × 1080 | web / desktop listing |

The seven shots, in store order:

1. **Hub**: the delve cards, difficulty tiers and this week's Omens.
2. **Nhevra, the Cold Hearth**: the Coldmarrow boss winding up the Long Night, the floor going dark around the hero's Hearthcoal.
3. **Ondrel of the Hammerdeep**: the Hammerdeep group boss with a full party of four,
   mid-Anvilfall, with the party frames and the tank call-out.
4. **The Lensmother**: the Glarewell boss sweeping her lens.
5. **Maelra, the Drowned Bellows**: the Drowned Foundry boss over her steam vents.
6. **Grandmother Slag**: the raid, a party of four, a Ladle Pour tipping over the tank.
7. **Ysmeret, the Twofold Flame**: the Ashvents group boss opening her Twin Vents, with a Slagbinder (the fifth class) leading a party of four, a Cinder Sump under the boss and Bellow Slam winding up.

Name a target to make only that set (and `ONLY=2-nhevra,6-raid` to remake only those fights): `icons`, `phone`, `landscape`, `desktop`.
The game loads with `?hires=1` so the canvas renders at the full 3× of the phone sizes.

## Trailer capture

`node tools/storeshots.cjs <outDir> trailer` records 30 seconds of the Hammerdeep
boss with a party of four at 1280 × 720 (`trailer-hammerdeep.webm`). The bots play;
nothing is staged. It records in real time, so on a machine without a GPU the frame
rate is low; run it on a machine with one for the final cut, and edit or speed-ramp
it there.

## App icon for the stores (1.0)

The Capacitor app uses the hoard beast emblem in `assets/` (see `docs/art/app-icon/`). The store
listing icon must match the app's, so the M9 refresh should render the listing icons from
`assets/icon.svg` instead of `icon.svg` above.
