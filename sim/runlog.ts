/**
 * Pause/resume mid-delve (vision v2 CP3, engineering item 5). iOS throws away a page left in the background, and a
 * delve used to die with it. The World is deterministic (no Math.random, no clock: sim/rng.ts only), so a run is fully
 * described by its WorldOptions plus what the player did each tick. RunLog records that as the run is played, and
 * replayRun plays it back on a fresh World to the same state.
 *
 * The only calls that change a World from outside are step(input) and choose(i, hero) (grepped 27 Nov), so those are
 * all a log holds. Bot allies are not logged: botInput reads only the World, so replay asks the bots again.
 *
 * Ops, in play order:
 * - a step run: [n, x, y, flags], the same Input n ticks in a row (run-length, so standing still is one op).
 *   flags = (cast + 1) | (roll ? 8 : 0) | ((hold + 1) << 4).
 * - a pick: [-1, index, hero].
 */
import { botInput } from './bot';
import type { Input, World } from './world';

export type RunOp = number[];

/** Where the run stood when it was saved, to prove the replay landed on the same run. */
export interface RunCheck {
  tick: number;
  hp: number;
  x: number;
  y: number;
}

/** Stick values are kept to 2 decimals, live and in the log alike, so the log replays exactly what the sim saw. */
export function quantize(input: Input): Input {
  const out: Input = { x: Math.round(input.x * 100) / 100, y: Math.round(input.y * 100) / 100 };
  if (input.cast !== undefined) out.cast = input.cast;
  if (input.roll) out.roll = true;
  if (input.hold !== undefined) out.hold = input.hold;
  return out;
}

function flagsOf(i: Input): number {
  return (i.cast !== undefined ? i.cast + 1 : 0) | (i.roll ? 8 : 0) | (i.hold !== undefined ? (i.hold + 1) << 4 : 0);
}

function inputOf(x: number, y: number, f: number): Input {
  const out: Input = { x, y };
  if (f & 7) out.cast = (f & 7) - 1;
  if (f & 8) out.roll = true;
  if (f >> 4) out.hold = (f >> 4) - 1;
  return out;
}

export class RunLog {
  ops: RunOp[] = [];

  /** The player's input for one tick (already quantized: the live sim gets the same value). */
  step(input: Input): void {
    const f = flagsOf(input);
    const last = this.ops[this.ops.length - 1];
    if (last && last[0] > 0 && last[1] === input.x && last[2] === input.y && last[3] === f) last[0]++;
    else this.ops.push([1, input.x, input.y, f]);
  }

  pick(index: number, hero: number): void {
    this.ops.push([-1, index, hero]);
  }
}

export function checkOf(w: World): RunCheck {
  return { tick: w.tick, hp: w.player.hp, x: w.player.x, y: w.player.y };
}

export function sameCheck(a: RunCheck, b: RunCheck): boolean {
  return a.tick === b.tick && a.hp === b.hp && a.x === b.x && a.y === b.y;
}

/** The inputs a solo step is given: the player's, then each bot ally's (as GameScene.updateInner does). */
export function stepInputs(w: World, input: Input): Input | Input[] {
  if (w.heroes.length < 2) return input;
  const out: Input[] = [input];
  for (let i = 1; i < w.heroes.length; i++) { w.use(i); out.push(botInput(w)); }
  w.use(0);
  return out;
}

/**
 * Plays ops [from, ...) on w, at most `budget` ticks this call (so the client can spread a long replay over frames).
 * Returns where to carry on, or ops.length when done. A step op part-way through is split: `done` counts its ticks.
 */
export function replayRun(w: World, ops: RunOp[], at: { op: number; done: number }, budget = Infinity): { op: number; done: number } {
  let { op, done } = at;
  let left = budget;
  while (op < ops.length && left > 0) {
    const o = ops[op];
    if (o[0] < 0) {
      w.choose(o[1], o[2]);
      op++;
      continue;
    }
    const input = inputOf(o[1], o[2], o[3]);
    while (done < o[0] && left > 0) {
      w.step(stepInputs(w, input));
      done++;
      left--;
    }
    if (done >= o[0]) { op++; done = 0; }
  }
  return { op, done };
}
