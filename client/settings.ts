/**
 * Display options (roadmap L3, accessibility): screen shake strength and a
 * colour-blind telegraph palette. Saved per browser; shown in the pause menu
 * and on the main menu, and every copy of the controls stays in sync.
 */

export type ShakeSetting = 'full' | 'reduced' | 'off';
export type PaletteSetting = 'standard' | 'colorblind';

export interface DisplaySettings {
  shake: ShakeSetting;
  palette: PaletteSetting;
}

const KEY = 'horders.display.v1';

/** Players whose OS asks for less motion start on reduced shake. */
function osReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function load(): DisplaySettings {
  const base: DisplaySettings = { shake: osReducedMotion() ? 'reduced' : 'full', palette: 'standard' };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const v = JSON.parse(raw) as Partial<DisplaySettings>;
    return {
      shake: v.shake === 'full' || v.shake === 'reduced' || v.shake === 'off' ? v.shake : base.shake,
      palette: v.palette === 'colorblind' ? 'colorblind' : 'standard',
    };
  } catch {
    return base;
  }
}

export const display: DisplaySettings = load();

/** How much of the normal screen shake to apply. */
export function shakeScale(): number {
  return display.shake === 'full' ? 1 : display.shake === 'reduced' ? 0.3 : 0;
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
  box.append(shake.el, pal.el);
  const sync = () => { shake.sync(); pal.sync(); };
  listeners.push(sync);
  sync();
}
