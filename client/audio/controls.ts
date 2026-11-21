/**
 * Sound controls: a speaker toggle on the main menu and in the run's top bar,
 * plus Music and Effects sliders in the pause menu. Built in code so the page
 * markup stays the visuals team's. M toggles mute from the keyboard.
 */
import { audio } from './index';

const ON = '\u{1F50A}';
const OFF = '\u{1F507}';

const CSS = `
.snd-toggle { pointer-events: auto; flex: none; width: 38px; height: 38px; border-radius: 50%; background: var(--panel, rgba(28,18,16,0.85)); border: 1px solid var(--line, #5a4038); font-size: 16px; line-height: 1; padding: 0; color: inherit; }
.snd-toggle.off { opacity: 0.6; }
.hub-top .snd-toggle { width: 36px; height: 36px; flex: none; }
.snd-cell { display: flex; align-items: center; gap: 6px; justify-self: end; }
.snd-panel { margin: 14px 0 6px; text-align: left; display: grid; gap: 10px; }
.snd-panel label { display: grid; grid-template-columns: 64px 1fr 38px; align-items: center; gap: 10px; font-size: 14px; }
.snd-panel input[type=range] { width: 100%; accent-color: var(--gold, #e8b04a); min-height: 28px; }
.snd-panel .pct { font-variant-numeric: tabular-nums; text-align: right; opacity: 0.75; }
.snd-panel .row { display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
`;

function toggleButton(): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'snd-toggle';
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.toggleMute();
  });
  return b;
}

function slider(label: string, key: 'music' | 'sfx'): { el: HTMLLabelElement; sync: () => void } {
  const el = document.createElement('label');
  el.innerHTML = `<span>${label}</span><input type="range" min="0" max="100" step="5"><span class="pct"></span>`;
  const input = el.querySelector('input')!;
  const pct = el.querySelector('.pct')!;
  input.setAttribute('aria-label', `${label} volume`);
  input.addEventListener('input', () => audio.set({ [key]: Number(input.value) / 100, muted: false }));
  // Sliders shouldn't steer the hero or trigger game keys.
  input.addEventListener('keydown', (e) => e.stopPropagation());
  const sync = () => {
    input.value = String(Math.round(audio.settings[key] * 100));
    pct.textContent = `${input.value}%`;
  };
  return { el, sync };
}

export function installSoundControls(): void {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const toggles: HTMLButtonElement[] = [];
  // Main menu: beside the Bags pill, sharing its grid cell so the header layout holds.
  const bag = document.getElementById('bagBtn');
  if (bag?.parentElement) {
    const b = toggleButton();
    const cell = document.createElement('span');
    cell.className = 'snd-cell';
    bag.parentElement.insertBefore(cell, bag);
    cell.append(b, bag);
    toggles.push(b);
  }
  // In a run: beside the pause button.
  const pause = document.getElementById('pauseBtn');
  if (pause?.parentElement) {
    const b = toggleButton();
    pause.parentElement.insertBefore(b, pause);
    toggles.push(b);
  }

  // Pause menu: full controls.
  const sliders = [slider('Music', 'music'), slider('Effects', 'sfx')];
  const panel = document.querySelector('#pause .panel');
  let muteBox: HTMLInputElement | null = null;
  let buzzBox: HTMLInputElement | null = null;
  if (panel) {
    const box = document.createElement('div');
    box.className = 'snd-panel';
    const row = document.createElement('label');
    row.className = 'row';
    row.innerHTML = '<span>Sound</span><input type="checkbox" aria-label="Sound on">';
    muteBox = row.querySelector('input');
    muteBox!.addEventListener('change', () => audio.set({ muted: !muteBox!.checked }));
    box.append(row, ...sliders.map((s) => s.el));
    // Vibration only where the phone supports it (Android); iOS and desktops never see the row.
    if (audio.haptics.supported) {
      const hr = document.createElement('label');
      hr.className = 'row';
      hr.innerHTML = '<span>Vibration</span><input type="checkbox" aria-label="Vibration on">';
      buzzBox = hr.querySelector('input');
      buzzBox!.addEventListener('change', () => {
        audio.set({ haptics: buzzBox!.checked });
        if (buzzBox!.checked) audio.haptics.buzz([30]);
      });
      box.append(hr);
    }
    const resume = document.getElementById('resumeBtn');
    if (resume) panel.insertBefore(box, resume);
    else panel.appendChild(box);
  }

  const sync = () => {
    const off = audio.settings.muted;
    for (const b of toggles) {
      b.textContent = off ? OFF : ON;
      b.classList.toggle('off', off);
      b.setAttribute('aria-label', off ? 'Sound off. Tap to turn on' : 'Sound on. Tap to mute');
      b.title = off ? 'Sound off (M)' : 'Sound on (M)';
    }
    if (muteBox) muteBox.checked = !off;
    if (buzzBox) buzzBox.checked = audio.settings.haptics;
    sliders.forEach((s) => s.sync());
  };
  audio.onChange(sync);
  sync();
}
