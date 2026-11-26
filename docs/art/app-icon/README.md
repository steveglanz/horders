# App icon and splash (1.0 M7, visuals)

The icon and splash for the Capacitor shell. One hand-drawn emblem, all original Horders art:
a horned iron hoard beast with slit ember eyes and a fanged, glowing maw, rising out of a
furnace ring over a mound of hoard gold. It uses the game's own palette (`--bg` #120b0a, ember,
gold) and the foe look rules: dark body, hot rim, angry slanted eyes. No text, so it needs no
font and no name check, and Apple's launch-screen guidance (no words) is met.

Made with free tools only: the SVG is written by hand in `tools/appicons.cjs` and rendered by the
Playwright Chromium already in the repo's tooling.

## Files

`node tools/appicons.cjs` writes the sources into `assets/`, in the "custom mode" layout of
[@capacitor/assets](https://www.npmjs.com/package/@capacitor/assets) 4.0.0:

| File | Size | Used for |
| --- | --- | --- |
| `icon-only.png` | 1024² | iOS app icon, Android legacy and round icons |
| `icon-foreground.png` | 1024², transparent | Android adaptive foreground |
| `icon-background.jpg` | 1024² | Android adaptive background |
| `splash.jpg` | 2732² | iOS and Android splash (cropped per device). The game is dark, so there is no separate dark splash |
| `*.svg` | | the masters the PNGs come from |

When engineering adds the shell (`npx cap add android`, `npx cap add ios`), one command makes
every size into the native projects:

```
npx @capacitor/assets generate
```

This was tried on 26 Nov 2026 against stub `android/` and `ios/` folders: it made 135 Android
files (mipmap ldpi to xxxhdpi 36 to 192 px, adaptive `mipmap-anydpi-v26` XML, portrait and
landscape splashes with night variants) and 11 iOS files (`AppIcon-512@2x.png` at 1024 and the
2732 splash set). `generated-android.png` shows three of its outputs: the xxxhdpi portrait
splash, the 192 px round icon and the adaptive layers composited, and the 48 px icon.

The tool wraps both adaptive layers in a 16.7 % `<inset>`, so each layer image fills the visible
72 dp and the 66 dp safe circle is its central 92 %. The emblem is drawn to fit inside that.

## Previews

- `icon-masks-light.png`, `icon-masks-dark.png`: iOS rounded square and the Android circle,
  squircle and teardrop masks, then 60, 48, 40 and 29 px. The eyes, horns and ring still read at 29 px.
- `splash-crops.png`: the splash as a portrait and a landscape phone crop it.
- `generated-android.png`: real output of `@capacitor/assets generate`.

## Not changed

`docs/store/icon.svg` (the older ember sun over an anvil) is still the web favicon and the
L5 store-listing icon. The store listing icon must match the app icon, so the M9 store refresh
should switch `tools/storeshots.cjs` icons to `assets/icon.svg`.
