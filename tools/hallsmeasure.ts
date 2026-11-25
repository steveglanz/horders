/**
 * Phase 18 Halls H1: what design reads on a HALLS=1 run of tools/foundry.ts or tools/balance.ts (spec "Measuring"):
 * delve length (target 4 to 7 min) and travel time (target under 60 s: time walking the map with nothing awake),
 * plus when the party reached the boss door. Prints nothing on an arena run.
 *
 *   HALLS=1 DUNGEON=kiln TIER=2 npx tsx tools/balance.ts
 *   HALLS=1 HALLS_SIDE=1 DUNGEON=kiln TIER=3 npx tsx tools/foundry.ts   (bots clear the side rooms too)
 *   HALLS=1 HALLS_SKIP=1 ...                                             (bots walk round C, the named fight)
 *   HALLS=1 HALLS_RINGS=1 ...                                            (bots keep clear of sleeping packs in fights)
 */
import { TICK, World } from '../sim/world';
import { DUNGEONS } from '../sim/content/dungeon';

let travelTicks = 0;
let doorAt = 0;
const runs: { time: number; travel: number; door: number; win: boolean }[] = [];
// KILNTRASH (design, 25 Nov): seconds from each pack's wake to its clear, split into trash (opener packs, never a named
// gate) and the rest (named, hard, D), measured the same way with the flag on or off.
let wokeAt: number[] = [];
const packTimes = { trash: [] as number[], other: [] as number[] };
const isTrash = (w: World, k: number) => {
  const p = w.halls!.packs[k];
  return p.gate !== 'named' && DUNGEONS[w.dungeonId].openers.includes(p.enc);
};

/** Call after every step of a run. */
export function hallsTick(w: World): void {
  if (!w.halls) return;
  if (w.hallsOn && w.phase !== 'fight') travelTicks++;
  for (const ev of w.events) if (ev.type === 'hallsDoor') doorAt = w.time;
  w.halls.packs.forEach((p, k) => {
    if (p.state === 'awake' && wokeAt[k] === undefined) wokeAt[k] = w.time;
    if (p.state === 'cleared' && wokeAt[k] !== undefined && wokeAt[k] >= 0) {
      if (p.enc !== 'shrine') (isTrash(w, k) ? packTimes.trash : packTimes.other).push(w.time - wokeAt[k]);
      wokeAt[k] = -1;
    }
  });
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
  wokeAt = [];
}

/** Call at the end: the Halls averages over every run, and over the wins. */
export function hallsReport(): void {
  if (!runs.length) return;
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const wins = runs.filter((r) => r.win);
  const reached = runs.filter((r) => r.door > 0);
  console.log(`halls: ${runs.length} runs, avg delve ${avg(runs.map((r) => r.time))}s (wins ${avg(wins.map((r) => r.time))}s), avg travel ${avg(runs.map((r) => r.travel))}s, boss door reached ${reached.length}/${runs.length} at avg ${avg(reached.map((r) => r.door))}s`);
  const { trash, other } = packTimes;
  console.log(`halls packs: trash ${trash.length} cleared at avg ${avg(trash)}s (max ${Math.round(Math.max(0, ...trash))}s), named/hard ${other.length} at avg ${avg(other)}s (max ${Math.round(Math.max(0, ...other))}s)`);
}
