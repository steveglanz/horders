/**
 * Phase 18 Halls H1: what design reads on a HALLS=1 run of tools/foundry.ts or tools/balance.ts (spec "Measuring"):
 * delve length (target 4 to 7 min) and travel time (target under 60 s: time walking the map with nothing awake),
 * plus when the party reached the boss door. Prints nothing on an arena run.
 *
 *   HALLS=1 DUNGEON=kiln TIER=2 npx tsx tools/balance.ts
 *   HALLS=1 HALLS_SIDE=1 DUNGEON=kiln TIER=3 npx tsx tools/foundry.ts   (bots clear the side rooms too)
 *   HALLS=1 HALLS_SKIP=1 ...                                             (bots walk round C, the named fight)
 */
import { TICK, World } from '../sim/world';

let travelTicks = 0;
let doorAt = 0;
const runs: { time: number; travel: number; door: number; win: boolean }[] = [];

/** Call after every step of a run. */
export function hallsTick(w: World): void {
  if (!w.halls) return;
  if (w.hallsOn && w.phase !== 'fight') travelTicks++;
  for (const ev of w.events) if (ev.type === 'hallsDoor') doorAt = w.time;
}

/** Call once a run has ended: prints its Halls line and resets the counters. */
export function hallsSeed(w: World, win: boolean): void {
  if (!w.halls) return;
  const travel = travelTicks * TICK;
  const m = w.halls;
  const packs = m.packs.map((p) => `${p.role}:${p.enc}:${p.state}`).join(' ');
  console.log(`    halls: delve=${w.time.toFixed(0)}s travel=${travel.toFixed(0)}s door=${doorAt ? doorAt.toFixed(0) + 's' : '-'} mirror=${m.mirror ? 1 : 0} ${packs}`);
  runs.push({ time: w.time, travel, door: doorAt, win });
  travelTicks = 0;
  doorAt = 0;
}

/** Call at the end: the Halls averages over every run, and over the wins. */
export function hallsReport(): void {
  if (!runs.length) return;
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const wins = runs.filter((r) => r.win);
  const reached = runs.filter((r) => r.door > 0);
  console.log(`halls: ${runs.length} runs, avg delve ${avg(runs.map((r) => r.time))}s (wins ${avg(wins.map((r) => r.time))}s), avg travel ${avg(runs.map((r) => r.travel))}s, boss door reached ${reached.length}/${runs.length} at avg ${avg(reached.map((r) => r.door))}s`);
}
