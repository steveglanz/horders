/**
 * First-delve coach: three light prompts for a brand-new player, then it never shows again.
 *   1. Move: "Drag anywhere to move" (touch) or "WASD to move", until the hero has walked a bit.
 *   2. Cast: once the first ability is affordable, a pulse and "Tap to cast" on it, until it is used.
 *   3. Interrupt: the first time an enemy starts an interruptible cast, a pulse on the interrupt button.
 * Each step also times out, so the coach never nags. Done is stored per browser.
 * After that, L1's first-time tips: the first red hit circle near the hero and the first gold
 * soak circle each get one line, once per browser (see docs/design/first-delve.md). A party with no
 * true interrupter gets one line the first time a boss starts a cast it can't stop (the interrupt split).
 */
import type { World } from '../sim/world';
import { INTERRUPT_SLOT } from './icons';
import { CLASSES } from '../sim/content/classes';

const KEY = 'horders.coach.v1';
const TIPS_KEY = 'horders.tips.v1';
/** L1 first-time tips: shown once each, for this long. */
const TIPS: Record<string, string> = {
  red: 'Red on the floor is a hit coming. Step out before it fills.',
  gold: 'Gold circles want someone inside. Stand in it until it fills, or it blasts you.',
  // The interrupt split (#841): in a party a boss shrugs off the Lumen's and Slagbinder's stun.
  nokick: 'In a party, bosses shrug off stuns. Bring a Bulwark, Cutwick or Emberwright to interrupt.',
};
const TIP_TIME = 5;

function loadTips(): Set<string> {
  const q = new URLSearchParams(location.search);
  if (q.has('seed') || q.has('god') || q.has('stress')) return new Set(q.get('tips') === '1' ? [] : Object.keys(TIPS));
  try { return new Set(JSON.parse(localStorage.getItem(TIPS_KEY) ?? '[]') as string[]); } catch { return new Set(); }
}
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
    if (w.stress) return this.hide();
    if (this.step === 'done') return this.tickTips(w);
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
      // F unlocks at character level 4: a newer hero has no interrupt to teach yet.
      if (!w.unlocked(INTERRUPT_SLOT)) return this.next('done', now, w);
      if (now - this.stepAt > 120) return this.next('done', now, w);
      if (b && b.classList.contains('hot')) {
        if (!this.kickSince) this.kickSince = now;
        if (now - this.kickSince > 5) return this.next('done', now, w);
        // The Lumen's and Slagbinder's F is a stun (the interrupt split): it breaks the cast all the same.
        const verb = w.classDef.kick ? 'interrupt that cast' : 'stun that caster';
        return this.show('kick', this.touch ? `Tap to ${verb}!` : `${verb[0].toUpperCase()}${verb.slice(1)}!`, b);
      }
      if (this.kickSince) return this.next('done', now, w);
      return this.hide();
    }
  }

  private kickSince = 0;
  private seenTips = loadTips();
  private tip = '';
  private tipUntil = 0;

  /** L1: one line the first time a red hit circle lands near the hero, or a gold soak circle appears. */
  private tickTips(w: World): void {
    if (this.tip && w.time < this.tipUntil) return this.show('tip', TIPS[this.tip]);
    this.tip = '';
    const p = w.player;
    let found = '';
    for (const t of w.telegraphs) {
      if (!t.alive) continue;
      if (t.kind === 'soak' && !this.seenTips.has('gold')) { found = 'gold'; break; }
      if (t.kind === 'hit' && !this.seenTips.has('red') && Math.hypot(t.x - p.x, t.y - p.y) < t.r + 60) { found = 'red'; break; }
    }
    // A party with no true interrupter, the first time a boss starts a cast that someone could otherwise stop.
    if (!found && !this.seenTips.has('nokick') && w.heroes.length > 1 && !w.heroes.some((h) => CLASSES[h.cls].kick)
      && w.enemies.some((e) => e.alive && e.def.rank === 'boss' && e.castId && e.interruptible)) found = 'nokick';
    if (!found) return this.hide();
    this.tip = found;
    this.tipUntil = w.time + TIP_TIME;
    this.seenTips.add(found);
    try { localStorage.setItem(TIPS_KEY, JSON.stringify([...this.seenTips])); } catch { /* storage blocked: shows again next visit */ }
    this.show('tip', TIPS[found]);
  }

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
      // Above the whole action bar, not just this button: over a bottom-row button it covered the names of the
      // two buttons above it (QA, 23 Nov). The button itself is lit (.coach), so it still points the way.
      const bar = anchor.closest('#actionbar');
      const edge = bar ? Math.min(r.top, bar.getBoundingClientRect().top) : r.top;
      el.style.top = `${Math.round(edge - b.height - 8)}px`;
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
