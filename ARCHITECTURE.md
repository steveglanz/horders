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
| `tools/` | `balance.ts` (bot win rates, `CLS=duskblade SEEDS=1,2,3`), `progression.ts`, Playwright playtests (`mmoshots.cjs`, `cloudcheck.cjs`), art review (`artsheet.cjs` contact sheet of every texture, `fxshots.cjs` busy-moment screenshots), `perf.cjs` (600-enemy stress, includes a 2x-DPR phone). |

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

## Co-op networking

- `client/net/party.ts`: parties of up to 4 over direct WebRTC data channels. The host's browser runs the authoritative sim; guests send inputs and draw snapshots. Each link has a reliable `rel` channel (joins, drafts, run control) and an unreliable `fast` one (inputs, snapshots).
- `client/net/signal.ts`: the handshake only. `supabaseSignal` uses Supabase Realtime Broadcast on topic `horders-party-<CODE>`; `localSignal` uses BroadcastChannel for tests and two-tab play. Game traffic never goes through Supabase: the free plan allows 2M Realtime messages a month and 100 a second per project ([limits](https://supabase.com/docs/guides/realtime/limits)).
- Why host authority and not lockstep: `Math.sin`/`Math.cos` are implementation-approximated in the JS spec, so Safari and Chrome can drift apart.
- Public STUN only, no TURN relay, so players on some strict networks can't connect yet.
- Party sim: `new World({ party: [{ cls: 'bulwark' }, ...] })` adds up to three heroes beside the main one. Per-hero state lives in `world.heroes`; the sim swaps one hero's fields into `world.player`, `talents`, `cls` and so on with `use(i)`, and every hero loop ends back on hero 0, so solo code paths read the same fields as before. `step()` takes one input per hero. Enemies attack by threat (`sim/threat.ts`, one table per enemy in `world.threat`); orbs, zones and strikes remember which hero cast them. Downed heroes stand back up between fights at 30% health; the run ends when the whole party is down. Drafts deal cards to every hero with levels waiting, `choose(card, hero)` takes the hero, and the run resumes once nobody has cards.
- Solo runs are unchanged: `npx tsx tools/hashcheck.ts` fingerprints 24 solo bot runs (4 classes, 2 dungeons, 3 seeds); diff its output before and after a sim change.
- `node tools/netcheck.cjs` runs a host, three guests and a refused fifth player in Chromium.

## Working together

- Branch from `main`, open a PR. `npm test` and `npm run build` must pass.
- The engineering thread reviews and merges, and deploys to https://horders.netlify.app for significant updates.
- No copyrighted names, art or music: everything in the game is original.

## Merging

- Add the `automerge` label to a PR into `main`. Once CI passes on the PR's latest commit, `.github/workflows/automerge.yml` squash-merges it and deletes the branch. A new push waits for its own green run. Remove the label to stop it.
- After pushes to `main`, CI runs and PR updates, the same workflow checks every open PR into `main`. One that conflicts gets the `conflict` label and one comment; merge `main` into it to clear it.
