# 2D fallback on phones without WebGL (1.0 M5, 27 Nov 2026)

Checked the automatic 2D fallback in Chromium launched with WebGL off (`--disable-webgl --disable-webgl2 --disable-3d-apis`) at 320x568 and 568x320, deviceScaleFactor 2.

    npm run build && NOGL=1 node tools/uxaudit.cjs <outDir> p320 l568

## Result
- Every screen of the audit ran with no page errors at both sizes (`*-metrics.json`, `errors: []`): hub, tabs, settings, bags, a run, the talent draft, pause, the Kiln Mother and the end screen.
- In the run: `webgl: false`, `look3d: false`, Phaser renderer type 1 (Canvas). The game never fetches `hd2d.js` and plays in the 2D look (`client/hd2d/api.ts` `lookWanted`).
- Shots: `*-08-hud.png` (a pack in the Kiln), `*-11-boss.png` (Kiln Mother), `*-12-end.png`.

## Fixed
- Settings still showed **3D** as the chosen look on a device that can't draw it. Now, without WebGL, the Look row shows **2D** as chosen, the 3D button is greyed out and can't be picked, and its tip says the device can't draw the 3D look (`client/settings.ts`). Shots: `*-settings-look.png`. With WebGL the row is unchanged (checked: 3D on, saves `look: "3d"`).
