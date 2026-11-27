# Horders (working title)

A survivors-style run game with MMO-style progression. This is **build step 1: the run prototype**.

## What's in step 1
- One class (Emberwright), one arena, the Hollow Tide horde.
- Level-up talent drafts from a three-branch tree, with a capstone per branch.
- A Cinder Brute mini-boss at 4:00 (drops a bonus talent) and the boss, the Kiln Mother, at 8:00, with telegraphed attacks and an enrage timer.
- Touch joystick (drag anywhere) and keyboard (WASD / arrows). Auto-pause when the app goes to the background.
- No saving yet: hero levels, gear and loot are step 2.

## Layout
- `sim/`: the shared simulation. Pure TypeScript, no rendering, deterministic (fixed 30 Hz tick, seeded RNG). The same code is meant to run on a co-op server later. A test enforces that it never imports Phaser or browser APIs.
- `sim/content/`: enemies and talents as data.
- `sim/bot.ts`: an autopilot used by tests and balancing.
- `client/`: Phaser 4 renderer and HTML overlay (HUD, drafts, menus). Placeholder art is drawn in code.
- `tests/`: Vitest tests for the simulation.
- `tools/`: balance script and Playwright playtest / performance scripts.

## Commands
- `npm install`
- `npm run dev`: local dev server
- `npm test`: simulation tests
- `npm run build`: type-check and build a single-file `dist/index.html`
- `npx vite-node tools/balance.ts`: five autopilot runs with results
- `node tools/perf.cjs`: stress test (600 enemies) in headless Chromium

URL options: `?stress=1` (600 enemies, can't die, shows frame rate), `?debug=1` (frame rate readout), `?seed=N` (fixed run), `?god=1` (can't die).
