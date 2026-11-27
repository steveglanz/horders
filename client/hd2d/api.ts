/**
 * The 3D (HD-2D) look (Steve picked it 23 Nov 2026: "3d just looks so much better"), the default since then;
 * the 2D look stays as a battery-saving setting and the fallback (hd2dWanted).
 *
 * The 3D renderer and three.js are their own file, dist/hd2d.js, built by vite.hd2d.config.ts. The first page
 * load never fetches it: pressing Delve with the 3D look on shows a short loading screen while the browser fetches
 * ./hd2d.js, and then the run starts. If the file can't load, the run starts in the normal 2D look.
 *
 * This file is in the main bundle, so it stays tiny and imports nothing from three.js: only the types the
 * renderer and GameScene share.
 */
import type { World } from '../../sim/world';
import type { RoomSound } from '../audio/cues';

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
  /**
   * The floor bridge: the 2D scene's floor layer (every floor tell the 3D view doesn't draw yet: rafts, vents, the
   * Glarewell's light, coals, wave marks, boss tells), drawn top-down into a square canvas `span` world units across,
   * centred on (x, y) (on a Halls map it follows the hero), else (0, 0). The renderer lays it on its floor. `stamp` changes whenever the canvas was redrawn.
   */
  floor?(): { canvas: HTMLCanvasElement; span: number; stamp: number; x?: number; y?: number } | null;
  /** Phase 18 Halls: the texture key the 2D scene draws a foe of `kind` with, for sleeping packs (not in World.enemies yet). */
  kindTex?(kind: string): string;
  /** Phase 18 Halls: how much more than today's view the camera shows (1 = today's), for the room zoom. */
  zoom?(): number;
  /** Run time (World.time) of the boss's last echoed cast (the 'echo' event, Phase 16 U1), or -Infinity for none. */
  echoAt?(): number;
  /** How far (world units) the camera looks past your hero this frame ({0, 0} when it doesn't): phones' boss framing. */
  focus?(): { x: number; y: number };
}

export interface Hd2dStats { calls: number; triangles: number; ms: number; fx: boolean; pixelRatio: number; /** Attacks your hero has started this run (the attack pose). */ attacks: number; /** Foe attacks (lunges) started this run. */ foeAttacks: number; /** Your hero's figure height on screen, CSS px. */ heroPx: number }

export interface Hd2dView {
  /** Draws one frame from the world as it is now. `dt` is seconds since the last frame. */
  frame(dt: number): void;
  destroy(): void;
  stats(): Hd2dStats;
  /**
   * Where world point (x, y) on the floor shows on screen this frame, in CSS px from the 3D view's top left,
   * or null when it is behind the camera. For overlays drawn over the 3D view (the phone edge chevrons).
   */
  project(x: number, y: number): { x: number; y: number } | null;
  /**
   * Where the top of enemy i's drawn sprite shows on screen this frame (CSS px, as project), or null when it was not
   * drawn. The overlay hangs that foe's health and cast bar here, right over the sprite (QA 23 Nov: they floated high).
   */
  foeHead?(i: number): { x: number; y: number } | null;
  /**
   * What the room did since the last call that sound can follow (client/audio/cues.ts roomCues): drips landing,
   * forge chains at the end of a sway, and foe lunges starting. Drains the list.
   */
  sounds?(): RoomSound[];
  /** How tall your own hero's figure shows on screen this frame, CSS px (the camera rule, client/camera.ts). */
  heroPx?(): number;
}

export interface Hd2dModule {
  mount(host: HTMLElement, a: Hd2dAdapter, opts: { fx: boolean; saver: boolean }): Hd2dView;
}

const params = new URLSearchParams(location.search);
/** Whether this browser can make a WebGL context at all (asked once). Without one the 3D look can't run. */
let gl: boolean | undefined;
export function webglAvailable(): boolean {
  if (gl === undefined) {
    try {
      const c = document.createElement('canvas');
      gl = !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      gl = false;
    }
  }
  return gl;
}

/**
 * The 3D look is the baseline (Steve, 23 Nov 2026: "You can ditch non 3d, that should be our baseline").
 * It is off only when the player picked the 2D look (Settings, saves battery), with ?hd2d=0, or when the browser has
 * no WebGL. ?hd2d=1 turns it on whatever the setting says. If hd2d.js fails to load, the run plays in 2D (loadHd2d).
 * `look` is the saved setting (settings.ts display.look), read from storage so this file stays free of imports.
 */
export function lookWanted(look: '3d' | '2d' = lookSetting()): boolean {
  if (params.get('hd2d') === '0') return false;
  if (!webglAvailable()) return false;
  if (params.has('hd2d')) return true;
  return look === '3d';
}

/**
 * The look this page load uses, decided once: the game canvas is made see-through for the 3D look at boot
 * (client/main.ts) and can't change after, so a new choice in Settings applies when the page reloads.
 */
let decided: boolean | undefined;
export const hd2dWanted = (): boolean => (decided ??= lookWanted());

/** The saved look, read straight from storage (settings.ts owns it; this avoids importing it here). */
function lookSetting(): '3d' | '2d' {
  try {
    const v = JSON.parse(localStorage.getItem('horders.display.v1') ?? '{}') as { look?: string };
    return v.look === '2d' ? '2d' : '3d';
  } catch {
    return '3d';
  }
}
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
export function loadHd2d(dungeon?: string): Promise<Hd2dModule | null> {
  if (mounted) return Promise.resolve(mod);
  if (pending) return pending;
  const screen = document.getElementById('hd2dLoad');
  // Names the dungeon being entered ("Entering the Kiln Depths"): a fixed raid name read as the wrong dungeon.
  const title = screen?.querySelector('.hl-title');
  if (title) title.textContent = dungeon ? `Entering ${dungeon.replace(/^The /, 'the ')}` : 'Entering the depths';
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
