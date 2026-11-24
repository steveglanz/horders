/**
 * Display options (roadmap L3, accessibility): screen shake strength, a
 * colour-blind telegraph palette and text size. Saved per browser; shown in the pause menu
 * and on the main menu, and every copy of the controls stays in sync.
 */

export type ShakeSetting = 'full' | 'reduced' | 'off';
export type PaletteSetting = 'standard' | 'colorblind';
/** Which side of the screen the ability buttons sit on (touch screens). */
export type HandSetting = 'right' | 'left';
/** Auto drops effects when frames dip; Saver also caps at 30 fps and renders at 1x for battery. */
export type GraphicsSetting = 'auto' | 'saver' | 'full';
/** Text size (L3): Large grows combat text, the fight HUD's words and the menus' small print. */
export type TextSetting = 'normal' | 'large';
/** The 3D look (the default) or the 2D look, which saves battery (client/hd2d/api.ts hd2dWanted). */
export type LookSetting = '3d' | '2d';
/** Phase 18 Halls H1: the Kiln as a map of rooms (a prototype; ?halls=1 turns it on, ?halls=0 off). */
export type HallsSetting = 'off' | 'on';

export interface DisplaySettings {
  shake: ShakeSetting;
  palette: PaletteSetting;
  hand: HandSetting;
  graphics: GraphicsSetting;
  text: TextSetting;
  look: LookSetting;
  halls: HallsSetting;
}

const KEY = 'horders.display.v1';

/** Players whose OS asks for less motion start on reduced shake. */
function osReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function load(): DisplaySettings {
  const base: DisplaySettings = { shake: osReducedMotion() ? 'reduced' : 'full', palette: 'standard', hand: 'right', graphics: 'auto', text: 'normal', look: '3d', halls: 'off' };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const v = JSON.parse(raw) as Partial<DisplaySettings>;
    return {
      shake: v.shake === 'full' || v.shake === 'reduced' || v.shake === 'off' ? v.shake : base.shake,
      palette: v.palette === 'colorblind' ? 'colorblind' : 'standard',
      hand: v.hand === 'left' ? 'left' : 'right',
      graphics: v.graphics === 'saver' || v.graphics === 'full' ? v.graphics : 'auto',
      text: v.text === 'large' ? 'large' : 'normal',
      look: v.look === '2d' ? '2d' : '3d',
      halls: v.halls === 'on' ? 'on' : 'off',
    };
  } catch {
    return base;
  }
}

export const display: DisplaySettings = load();

/**
 * Phase 18 Halls H1: ?halls=1 turns the Kiln map prototype on for this browser (remembered, so a phone keeps it
 * after the link), ?halls=0 turns it off. The Settings toggle shows only once it has been on, so players who never
 * opened the link don't see a prototype.
 */
const hallsParam = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('halls') : null;
if (hallsParam === '1' || hallsParam === '0') {
  display.halls = hallsParam === '1' ? 'on' : 'off';
  try { localStorage.setItem(KEY, JSON.stringify(display)); } catch { /* storage blocked: holds for this page load */ }
}
const hallsKnown = hallsParam !== null || display.halls === 'on';
/** Whether a Kiln delve should be played as the Halls map. */
export const hallsWanted = (): boolean => display.halls === 'on';

/** How much of the normal screen shake to apply. */
export function shakeScale(): number {
  return display.shake === 'full' ? 1 : display.shake === 'reduced' ? 0.3 : 0;
}

/** How much bigger world text (nameplates, damage numbers) draws. */
export function textScale(): number {
  return display.text === 'large' ? 1.25 : 1;
}

/**
 * Telegraph colours. The colour-blind palette is built from the Okabe-Ito set,
 * which stays distinct for the common kinds of colour blindness: enemy attacks
 * are a bright reddish purple (not red against gold), soak circles yellow and
 * blooms sky blue. Attack zones also get a hatch so they never rely on colour alone.
 */
export function palette(): { danger: number; soak: number; bloom: number; hatch: boolean } {
  return display.palette === 'colorblind'
    ? { danger: 0xe86bd0, soak: 0xf0e442, bloom: 0x56b4e9, hatch: true }
    : { danger: 0xff3b6b, soak: 0xffc861, bloom: 0x5fe0c8, hatch: false };
}

const listeners: (() => void)[] = [];

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(display));
  } catch {
    // Private mode or blocked storage: the choice still holds for this session.
  }
  for (const l of listeners) l();
}

/** Called after any change (GameScene re-reads the palette). */
export function onDisplayChange(fn: () => void): void {
  listeners.push(fn);
}

function segmented<T extends string>(label: string, value: () => T, options: [T, string][], set: (v: T) => void): { el: HTMLElement; sync: () => void } {
  const el = document.createElement('div');
  el.className = 'opt-row';
  el.innerHTML = `<span>${label}</span><div class="seg" role="radiogroup" aria-label="${label}">${options
    .map(([v, name]) => `<button type="button" role="radio" data-v="${v}">${name}</button>`)
    .join('')}</div>`;
  const buttons = [...el.querySelectorAll<HTMLButtonElement>('button')];
  for (const b of buttons) {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      set(b.dataset.v as T);
      save();
    });
  }
  const sync = () => {
    for (const b of buttons) {
      const on = b.dataset.v === value();
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    }
  };
  return { el, sync };
}

/** Fill a container with the display controls. */
export function mountDisplayOptions(box: HTMLElement): void {
  const shake = segmented<ShakeSetting>('Screen shake', () => display.shake, [['full', 'Full'], ['reduced', 'Reduced'], ['off', 'Off']], (v) => { display.shake = v; });
  const pal = segmented<PaletteSetting>('Danger colours', () => display.palette, [['standard', 'Standard'], ['colorblind', 'Colour-blind']], (v) => { display.palette = v; });
  const gfx = segmented<GraphicsSetting>('Graphics', () => display.graphics, [['auto', 'Auto'], ['saver', 'Battery saver'], ['full', 'Full']], (v) => { display.graphics = v; });
  gfx.el.setAttribute('data-tip', 'Auto trims effects when the frame rate dips. Battery saver always does, caps at 30 fps and renders at 1x. Full never trims.');
  const text = segmented<TextSetting>('Text size', () => display.text, [['normal', 'Normal'], ['large', 'Large']], (v) => { display.text = v; });
  text.el.setAttribute('data-tip', 'Large grows nameplates, damage numbers, the fight HUD and the small print in menus.');
  const look = segmented<LookSetting>('Look', () => display.look, [['3d', '3D'], ['2d', '2D (saves battery)']], (v) => { display.look = v; });
  look.el.setAttribute('data-tip', 'The 3D look is the full game. The 2D look draws the same fights flat, which is lighter on the battery. Switching restarts the game screen from the main menu.');
  const rows = [shake, pal, text, gfx, look];
  if (hallsKnown) {
    const halls = segmented<HallsSetting>('Kiln map (prototype)', () => display.halls, [['off', 'Arena'], ['on', 'Map']], (v) => { display.halls = v; });
    halls.el.setAttribute('data-tip', 'Prototype: the Kiln Depths as rooms and corridors. Packs sleep until you step close, so pick your fights; the door guard must fall before the boss door opens. Takes effect on your next Kiln delve.');
    rows.push(halls);
  }
  // Only touch screens have on-screen ability buttons to move.
  if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) {
    const hand = segmented<HandSetting>('Ability buttons', () => display.hand, [['right', 'Right'], ['left', 'Left']], (v) => { display.hand = v; });
    hand.el.setAttribute('data-tip', 'Put the ability buttons under your left thumb and steer with your right.');
    rows.push(hand);
  }
  box.append(...rows.map((r) => r.el));
  const sync = () => { for (const r of rows) r.sync(); };
  listeners.push(sync);
  sync();
}
