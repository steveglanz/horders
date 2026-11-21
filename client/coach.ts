/**
 * First-delve coach: three light prompts for a brand-new player, then it never shows again.
 *   1. Move: "Drag anywhere to move" (touch) or "WASD to move", until the hero has walked a bit.
 *   2. Cast: once the first ability is affordable, a pulse and "Tap to cast" on it, until it is used.
 *   3. Interrupt: the first time an enemy starts an interruptible cast, a pulse on the interrupt button.
 * Each step also times out, so the coach never nags. Done is stored per browser.
 */
import type { World } from '../sim/world';
import { INTERRUPT_SLOT } from './icons';

const KEY = 'horders.coach.v1';
type Step = 'move' | 'cast' | 'kick' | 'done';

function loadDone(): boolean {
  // Test and screenshot runs (?seed=, ?god=, ?stress) never see the coach.
  const q = new URLSearchParams(location.search);
  if (q.has('seed') || q.has('god') || q.has('stress')) return q.get('coach') !== '1';
  try { return localStorage.getItem(KEY) === 'done'; } catch { return false; }
}

export class Coach {
  private step: Step = loadDone() ? 'done' : 'move';
  private start: { x: number; y: number } | null = null;
  private stepAt = 0;
  private el: HTMLDivElement | null = null;
  private touch = matchMedia('(pointer: coarse)').matches;

  /** Call once per HUD tick. `buttons` are the action bar buttons, in slot order. */
  tick(w: World, buttons: HTMLElement[]): void {
    if (this.step === 'done' || w.stress) return this.hide();
    const p = w.player;
    const now = w.time;
    if (!this.start) { this.start = { x: p.x, y: p.y }; this.stepAt = now; }
    if (this.step === 'move') {
      const moved = Math.hypot(p.x - this.start.x, p.y - this.start.y) > 90;
      if (moved || now - this.stepAt > 20) return this.next('cast', now, w);
      return this.show('move', this.touch ? 'Drag anywhere to move. Your attack fires on its own.' : 'WASD to move. Your attack fires on its own.');
    }
    if (this.step === 'cast') {
      const b = buttons[0];
      const used = (p.cds[0] ?? 0) > 0;
      if (used || now - this.stepAt > 40) return this.next('kick', now, w);
      if (b && !b.classList.contains('nores')) return this.show('cast', this.touch ? 'Tap to cast' : `Press ${b.querySelector('.k')?.textContent ?? 'Q'} to cast`, b);
      return this.hide();
    }
    if (this.step === 'kick') {
      const b = buttons[INTERRUPT_SLOT];
      if (now - this.stepAt > 120) return this.next('done', now, w);
      if (b && b.classList.contains('hot')) {
        if (!this.kickSince) this.kickSince = now;
        if (now - this.kickSince > 5) return this.next('done', now, w);
        return this.show('kick', this.touch ? 'Tap to interrupt that cast!' : 'Interrupt that cast!', b);
      }
      if (this.kickSince) return this.next('done', now, w);
      return this.hide();
    }
  }

  private kickSince = 0;

  private next(step: Step, now: number, _w: World): void {
    this.step = step;
    this.stepAt = now;
    this.hide();
    if (step === 'done') {
      try { localStorage.setItem(KEY, 'done'); } catch { /* storage blocked: shows again next visit */ }
    }
  }

  private show(kind: string, text: string, anchor?: HTMLElement): void {
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'coach';
      this.el.setAttribute('role', 'status');
      document.body.appendChild(this.el);
    }
    const el = this.el;
    if (el.dataset.kind !== kind || el.textContent !== text) {
      el.dataset.kind = kind;
      el.innerHTML = kind === 'move' && this.touch ? `<i class="ch-drag" aria-hidden="true"></i><span></span>` : '<span></span>';
      el.querySelector('span')!.textContent = text;
    }
    el.hidden = false;
    document.querySelectorAll('.ab.coach').forEach((b) => { if (b !== anchor) b.classList.remove('coach'); });
    if (anchor) {
      anchor.classList.add('coach');
      const r = anchor.getBoundingClientRect();
      const b = el.getBoundingClientRect();
      el.style.left = `${Math.round(Math.max(8, Math.min(window.innerWidth - b.width - 8, r.left + r.width / 2 - b.width / 2)))}px`;
      el.style.top = `${Math.round(r.top - b.height - 12)}px`;
      el.style.bottom = '';
    } else {
      el.style.left = '';
      el.style.top = '';
    }
  }

  hide(): void {
    if (this.el) this.el.hidden = true;
    document.querySelectorAll('.ab.coach').forEach((b) => b.classList.remove('coach'));
  }
}
