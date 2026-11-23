/**
 * HD-2D look test (Steve picked it 23 Nov 2026: "3d just looks so much better"), behind ?hd2d=1.
 *
 * The 3D renderer and three.js are their own file, dist/hd2d.js, built by vite.hd2d.config.ts. The first page
 * load never fetches it: pressing Delve with HD-2D on shows a short loading screen while the browser fetches
 * ./hd2d.js, and then the run starts. If the file can't load, the run starts in the normal 2D look.
 *
 * This file is in the main bundle, so it stays tiny and imports nothing from three.js: only the types the
 * renderer and GameScene share.
 */
import type { World } from '../../sim/world';

/** What GameScene hands the renderer each run. */
export interface Hd2dAdapter {
  world(): World;
  /** How far between the last two sim steps this frame is (0..1), as the 2D render lerps. */
  alpha(): number;
  /** The texture key the 2D scene draws enemy slot `i` with (GameScene.enemyTex). */
  enemyTex(i: number): string;
  /** Frame `n` of a 2D texture, cropped into its own canvas (null if the key is missing). */
  frame(key: string, n: number): HTMLCanvasElement | null;
  /** How many frames that texture's walk or idle cycle has. */
  frames(key: string): number;
  /** World units per texture pixel (GameScene BASE), so a foe stands at its 2D size. */
  texScale: number;
  /** The name shown over hero `i` (allies only). */
  heroName(i: number): string;
}

export interface Hd2dStats { calls: number; triangles: number; ms: number; fx: boolean; pixelRatio: number }

export interface Hd2dView {
  /** Draws one frame from the world as it is now. `dt` is seconds since the last frame. */
  frame(dt: number): void;
  destroy(): void;
  stats(): Hd2dStats;
}

export interface Hd2dModule {
  mount(host: HTMLElement, a: Hd2dAdapter, opts: { fx: boolean; saver: boolean }): Hd2dView;
}

const params = new URLSearchParams(location.search);
/** The test is on with ?hd2d=1 (or ?hd2d), off by default. */
export const hd2dWanted = (): boolean => params.has('hd2d') && params.get('hd2d') !== '0';
/** ?hd2dfx=0 turns off bloom and tilt-shift (a cheaper frame, for comparing on phones). */
export const hd2dFx = (): boolean => params.get('hd2dfx') !== '0';

let mod: Hd2dModule | null = null;
let pending: Promise<Hd2dModule | null> | null = null;
/** Milliseconds the last load took, from Delve to the module being ready. */
export let hd2dLoadMs = 0;

/** Whether a 3D view has been mounted yet (the first mount compiles the shaders, behind the loading screen). */
let mounted = false;

export const hd2dMounted = (): boolean => mounted;

/** Hides the loading screen; GameScene calls it once the 3D view has drawn (or failed and fell back to 2D). */
export function hideHd2dLoading(): void {
  mounted = true;
  const screen = document.getElementById('hd2dLoad');
  if (screen) screen.hidden = true;
}

/** The renderer once it has loaded, or null (GameScene then draws in 2D as always). */
export const hd2dModule = (): Hd2dModule | null => mod;

let fetching: Promise<Hd2dModule | null> | null = null;
const fetchModule = (): Promise<Hd2dModule | null> => {
  if (!fetching) {
    const url = new URL('hd2d.js', document.baseURI).href;
    fetching = (import(/* @vite-ignore */ url) as Promise<Hd2dModule>)
      .then((m) => { mod = m; return m; })
      .catch((err: unknown) => { console.warn('HD-2D look failed to load, playing in 2D', err); fetching = null; return null; });
  }
  return fetching;
};

/**
 * With the test on, starts fetching ./hd2d.js quietly once the title screen is up and the page has gone idle,
 * so the first Delve waits less. Never before: the title screen's load stays exactly as it is.
 */
export function prefetchHd2d(): void {
  if (!hd2dWanted() || mod) return;
  const go = () => { void fetchModule(); };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  setTimeout(() => (idle ? idle(go, { timeout: 3000 }) : go()), 1500);
}

/**
 * Loads ./hd2d.js once (or finishes the quiet prefetch), showing the loading screen while it comes in. Resolves to the module, or to null
 * if it fails (the screen says so for a moment, and the run goes ahead in 2D).
 */
export function loadHd2d(): Promise<Hd2dModule | null> {
  if (mounted) return Promise.resolve(mod);
  if (pending) return pending;
  const screen = document.getElementById('hd2dLoad');
  const t0 = performance.now();
  if (screen) { screen.hidden = false; screen.classList.remove('failed'); }
  pending = fetchModule()
    .then(async (m) => {
      hd2dLoadMs = Math.round(performance.now() - t0);
      if (!m && screen) { screen.classList.add('failed'); await new Promise((r) => setTimeout(r, 1200)); screen.hidden = true; }
      // Two frames so the screen has painted before the run's first frame builds the room and compiles its shaders
      // (that blocks for a moment); GameScene hides the screen once the 3D view has drawn (hideHd2dLoading).
      if (m) await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      pending = null;
      return m;
    });
  return pending;
}
