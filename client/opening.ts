/**
 * CP3 opening, PR 1 (docs/design/opening.md, "What engineering builds" 1): the first launch flow.
 * Pillar 1 (a dungeon night in your pocket) and pillar 5 (one world, one voice).
 *
 * A save with no delves opens on the title ("Tap to wake."), then two Hearthkeeper lines, then straight
 * into the opening run. No hub, no class picker and no tier row on the way in. Lines are from the spec
 * (world.md voice: the Hearthkeeper is dry and short, no exclamation marks).
 */
import { HeroProfile, savedRuns } from '../sim/hero';

/** The Hearthkeeper's two lines, shown one at a time on the dark scene. */
export const WAKE_LINES = [
  'The Court took the fire. Go down and take some back.',
  "Take this coal. It's the last one in Wick.",
] as const;
/** Each line moves on by itself after this long, or sooner on a tap (opening.md, beat 0:05). */
export const LINE_MS = 4000;

/** True when this save should open on the title instead of the hub: it has never delved, on any class. */
export function opensOnWake(h: HeroProfile, stress = false): boolean {
  return !stress && savedRuns(h) === 0;
}

/** The steps of the wake screen: the title, then each line, then the delve. */
export type WakeStep = 'title' | 0 | 1 | 'go';
export function nextStep(s: WakeStep): WakeStep {
  if (s === 'title') return 0;
  if (s === 0) return 1;
  return 'go';
}

export interface Wake {
  /** Where the screen is now. */
  step(): WakeStep;
  /** Moves on one step (a tap, Enter or the line timer). */
  advance(): void;
  /** Takes the screen down without delving (the cloud brought back a hero who has played). */
  close(): void;
  /** True until the delve starts or the screen is closed. */
  open(): boolean;
}

/**
 * Shows the wake screen (#wake in index.html) and calls onGo once, when the last line ends.
 * A tap anywhere moves on; so does Enter or Space.
 */
export function showWake(root: HTMLElement, onGo: () => void): Wake {
  const line = root.querySelector<HTMLElement>('.wake-line')!;
  const hint = root.querySelector<HTMLElement>('.wake-tap')!;
  let at: WakeStep = 'title';
  let timer = 0;
  let live = true;
  const render = () => {
    root.dataset.step = String(at);
    if (at === 0 || at === 1) {
      line.textContent = WAKE_LINES[at];
      line.classList.remove('in');
      void line.offsetWidth;
      line.classList.add('in');
      hint.hidden = true;
    }
  };
  const close = () => {
    if (!live) return;
    live = false;
    clearTimeout(timer);
    root.hidden = true;
    root.removeEventListener('pointerup', advance);
    window.removeEventListener('keydown', key, true);
  };
  function advance(): void {
    if (!live) return;
    clearTimeout(timer);
    at = nextStep(at);
    if (at === 'go') {
      close();
      onGo();
      return;
    }
    render();
    timer = window.setTimeout(advance, LINE_MS);
  }
  function key(e: KeyboardEvent): void {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    // The hub's Enter starts a delve: the wake screen owns the key while it shows.
    e.stopImmediatePropagation();
    e.preventDefault();
    advance();
  }
  root.hidden = false;
  render();
  root.addEventListener('pointerup', advance);
  window.addEventListener('keydown', key, true);
  return { step: () => at, advance, close, open: () => live };
}
