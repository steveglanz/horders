/**
 * Tooltips everywhere: press and hold on a phone, hover with a mouse.
 *
 * Any element with a `title` gets one automatically (the title moves to `data-tip`, so the
 * browser's own tooltip doesn't double up). For rich content, call `setTip(el, () => html)`.
 * A long press that opened a tip swallows the tap that follows, so holding a talent
 * button explains it without spending a point.
 */

const HOLD_MS = 380;
const HOVER_MS = 260;
const MOVE_PX = 10;

const rich = new WeakMap<Element, () => string>();
let box: HTMLDivElement | null = null;
let holdTimer = 0;
let hoverTimer = 0;
let holdFrom: { x: number; y: number; el: Element } | null = null;
let shownFor: Element | null = null;
let swallowClickUntil = 0;

/** Rich tooltip HTML for an element (game data only: never put another player's text in here). */
export function setTip(el: Element, html: () => string): void {
  rich.set(el, html);
  el.setAttribute('data-tip', '');
}

function tipTarget(t: EventTarget | null): Element | null {
  return t instanceof Element ? t.closest('[data-tip]') : null;
}

function content(el: Element): HTMLElement | null {
  const div = document.createElement('div');
  const html = rich.get(el);
  if (html) div.innerHTML = html();
  else {
    const text = el.getAttribute('data-tip');
    if (!text) return null;
    div.textContent = text;
  }
  return div;
}

function show(el: Element): void {
  const c = content(el);
  if (!c) return;
  if (!box) {
    box = document.createElement('div');
    box.id = 'tip';
    box.setAttribute('role', 'tooltip');
    document.body.appendChild(box);
  }
  box.replaceChildren(c);
  box.hidden = false;
  shownFor = el;
  // Above the element if there's room, else below; clamped to the screen.
  const r = el.getBoundingClientRect();
  const W = window.innerWidth;
  const H = window.innerHeight;
  box.style.left = '0px';
  box.style.top = '0px';
  const b = box.getBoundingClientRect();
  let x = r.left + r.width / 2 - b.width / 2;
  x = Math.max(8, Math.min(W - b.width - 8, x));
  let y = r.top - b.height - 10;
  if (y < 8) y = Math.min(H - b.height - 8, r.bottom + 10);
  box.style.left = `${Math.round(x)}px`;
  box.style.top = `${Math.round(Math.max(8, y))}px`;
}

export function hideTip(): void {
  if (box) box.hidden = true;
  shownFor = null;
}

function clearHold(): void {
  clearTimeout(holdTimer);
  holdFrom = null;
}

/** Moves `title` attributes to `data-tip` under `root`, so they get our tooltip instead of the browser's. */
function adoptTitles(root: ParentNode): void {
  root.querySelectorAll?.('[title]').forEach((el) => {
    const t = el.getAttribute('title');
    el.removeAttribute('title');
    if (t && !rich.has(el)) el.setAttribute('data-tip', t);
  });
}

export function installTips(): void {
  adoptTitles(document);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'attributes' && m.target instanceof Element && m.target.hasAttribute('title')) adoptTitles(m.target.parentNode ?? document);
      m.addedNodes.forEach((n) => { if (n instanceof Element) { if (n.hasAttribute('title')) adoptTitles(n.parentNode ?? document); adoptTitles(n); } });
    }
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });

  document.addEventListener('pointerdown', (e) => {
    const el = tipTarget(e.target);
    if (shownFor && shownFor !== el) hideTip();
    clearHold();
    if (!el || e.pointerType === 'mouse') return;
    holdFrom = { x: e.clientX, y: e.clientY, el };
    holdTimer = window.setTimeout(() => {
      if (!holdFrom) return;
      show(holdFrom.el);
      swallowClickUntil = performance.now() + 1200;
      navigator.vibrate?.(8);
    }, HOLD_MS);
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (holdFrom && Math.hypot(e.clientX - holdFrom.x, e.clientY - holdFrom.y) > MOVE_PX) clearHold();
  }, true);
  const end = () => clearHold();
  document.addEventListener('pointerup', end, true);
  document.addEventListener('pointercancel', end, true);
  // The tap that ends a long press must not also press the button.
  document.addEventListener('click', (e) => {
    if (performance.now() < swallowClickUntil) {
      swallowClickUntil = 0;
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  // iOS: a long press would otherwise open the text/link callout.
  document.addEventListener('contextmenu', (e) => { if (tipTarget(e.target)) e.preventDefault(); });

  // Mouse: hover.
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = tipTarget(e.target);
    clearTimeout(hoverTimer);
    if (!el) { if (shownFor) hideTip(); return; }
    if (el === shownFor) return;
    hoverTimer = window.setTimeout(() => show(el), HOVER_MS);
  });
  document.addEventListener('pointerout', (e) => {
    if (e.pointerType !== 'mouse') return;
    const to = tipTarget(e.relatedTarget);
    if (to && to === tipTarget(e.target)) return;
    clearTimeout(hoverTimer);
    hideTip();
  });
  window.addEventListener('scroll', hideTip, true);
  window.addEventListener('resize', hideTip);
}
