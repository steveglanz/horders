/**
 * Pause/resume mid-delve (vision v2 CP3, engineering item 5): a solo delve survives the page being closed or thrown
 * away (iOS drops a page left in the background). While you play, the run's options and every input go into a RunLog
 * (sim/runlog.ts); it is saved to this device on the way to the background, on pagehide and every few seconds. On the
 * next page load, main.ts replays it on a fresh World and opens the delve paused where you left it.
 *
 * Solo only (a bot-filled party counts: the bots are asked again on replay). Not saved: online co-op (the host's World
 * is shared live and nobody else could replay a guest's view), ?stress runs and the opening (it is 2-3 minutes and
 * plays again from the title, opening.md rule 6). A save from another build is thrown away, since a changed sim replays
 * to a different run.
 */
import type { WorldOptions } from '../sim/world';
import type { RunCheck, RunOp } from '../sim/runlog';

declare const __HORDERS_BUILD__: string | undefined;
/** Changes with every build (vite.config.ts), so a save only replays on the code that recorded it. */
export const BUILD_ID = typeof __HORDERS_BUILD__ === 'string' ? __HORDERS_BUILD__ : 'dev';

const KEY = 'horders.resume.v1';

export interface SavedRun {
  build: string;
  /** When it was saved (ms). A delve left more than RESUME_MAX_AGE ago is dropped. */
  at: number;
  opts: WorldOptions;
  runSeed: number;
  bounty: boolean;
  key: boolean;
  /** The hero it belongs to: the same class, the same number of banked runs and the same next item id. */
  hero: { cls: string; runs: number; nextItemId: number };
  ops: RunOp[];
  check: RunCheck;
}

/** Two days: past that, a delve is more likely forgotten than missed. */
export const RESUME_MAX_AGE = 2 * 24 * 3600 * 1000;

export function storeRun(run: SavedRun): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(run));
  } catch {
    // Storage full or blocked: the delve just won't survive a closed page.
  }
}

export function loadRun(): SavedRun | null {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return null;
    const r = JSON.parse(s) as SavedRun;
    return r && Array.isArray(r.ops) && r.opts && r.check ? r : null;
  } catch {
    return null;
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}

/** Why a saved delve can't be picked up, or '' if it can. */
export function resumeBlocker(r: SavedRun, hero: { cls: string; runs: number; nextItemId: number }, now: number): string {
  if (r.build !== BUILD_ID) return 'build';
  if (now - r.at > RESUME_MAX_AGE) return 'old';
  if (r.hero.cls !== hero.cls || r.hero.runs !== hero.runs || r.hero.nextItemId !== hero.nextItemId) return 'hero';
  return '';
}
