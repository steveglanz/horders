# Horders architecture

A browser and mobile action RPG: short dungeon delves, a persistent hero, and
shared world bosses. TypeScript, Phaser 4 for rendering, Vite single-file build.

## Layout

| Path | What lives there |
|---|---|
| `sim/` | The game rules. Deterministic (fixed 1/30 s tick, seeded `Rng`), no browser APIs (a test enforces this), so it runs in tests, bots and later on a server. |
| `sim/world.ts` | `World`: one delve. Player, enemies, abilities, encounters, loot drops, events (`SimEvent`) for the client to draw. |
| `sim/content/classes.ts` | Class registry: base health, speed, resource name, interrupt range, action bar. |
| `sim/content/emberwright.ts` | Talent trees for every class (tagged with `cls`), the Emberwright action bar, `GCD`, `MAX_HEAT`. |
| `sim/content/enemies.ts`, `dungeon.ts`, `items.ts` | Enemy stats, encounter list and route, item tables. |
| `sim/hero.ts` | The saved hero: levels, gear, passives, loot rolls, `applyRun`, world boss rewards. |
| `sim/bot.ts` | Autopilot used by tests, balance tools and the in-game autopilot. Knows each class. |
| `client/` | Phaser scene (`GameScene.ts`), procedural textures (`textures.ts`), HTML HUD (`ui.ts`), hub (`hub.ts`), saves (`save.ts`, `cloud.ts`), entry (`main.ts`, `index.html`). |
| `supabase/migrations/` | Backend schema: cloud saves, world boss tables and functions (RLS on everything). |
| `tests/` | Vitest: sim determinism, dungeon flow, classes, hero/loot. |
| `tools/` | `balance.ts` (bot win rates, `CLS=duskblade SEEDS=1,2,3`), `progression.ts`, Playwright playtests (`mmoshots.cjs`, `cloudcheck.cjs`). |

## Adding a class

1. Add the id to `ClassId` and its talents (with `cls`) in `sim/content/emberwright.ts`.
2. Add a `ClassDef` with its four abilities in `sim/content/classes.ts`.
3. In `World`: dispatch its abilities in `updateAbilities`, its auto-attack in `updateWeapons`, and talent hooks where they apply. Slot 3 is always the interrupt.
4. Teach `sim/bot.ts` to play it, and check `CLS=<id> npx tsx tools/balance.ts`.
5. Client: icons in `client/ui.ts`, a sprite in `client/textures.ts`, visuals for any new `SimEvent` in `GameScene.handleEvents`.

## Backend

Supabase project "Horders" (free tier). The browser holds only the publishable
key in `client/cloud.ts`. Players sign in anonymously. Schema changes go in a
new numbered file under `supabase/migrations/`; the engineering thread applies them.

## Working together

- Branch from `main`, open a PR. `npm test` and `npm run build` must pass.
- The engineering thread reviews and merges, and deploys to https://horders.netlify.app for significant updates.
- No copyrighted names, art or music: everything in the game is original.
