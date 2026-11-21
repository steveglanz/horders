/**
 * Which sound a tap on the interface makes. Menus feel physical when picking,
 * confirming and backing out each sound different.
 *
 * Other teams can choose a sound for any element with `data-sfx="select"` (or
 * confirm, back, open, click, salvage, forge, temper, brew, anvilPick, bellowsPick, equip, passive, none) without touching the audio code.
 */
import type { SoundId } from './sounds';

export type UiSound = Extract<SoundId, 'click' | 'select' | 'confirm' | 'back' | 'open' | 'salvage' | 'forge' | 'temper' | 'brew' | 'anvilPick' | 'bellowsPick' | 'equip' | 'passive'>;
/** salvage, forge, temper and brew are the ember purse's sounds: embers coming in, and spent at the Forge or on a potion. */
const NAMED: readonly string[] = ['click', 'select', 'confirm', 'back', 'open', 'salvage', 'forge', 'temper', 'brew', 'anvilPick', 'bellowsPick', 'equip', 'passive'];

/** The minimum of Element that this needs (so tests can pass a stand-in). */
export interface Tappable {
  closest(selector: string): Tappable | null;
  getAttribute(name: string): string | null;
}

export function uiSoundFor(target: Tappable | null): UiSound | null {
  const el = target?.closest('[data-sfx], button, .card, [role="button"]');
  if (!el) return null;
  const pick = el.getAttribute('data-sfx');
  if (pick === 'none') return null;
  if (pick && NAMED.includes(pick)) return pick as UiSound;
  if (el.closest('#startBtn, #againBtn, #quickBtn')) return 'confirm';
  if (el.closest('#menuBtn, #bagBack, #bagClose, #resumeBtn, #quitBtn, #leaveBtn, [aria-label="Back"], [aria-label="Close"]')) return 'back';
  if (el.closest('#bagBtn, #pauseBtn')) return 'open';
  if (el.getAttribute('aria-pressed') !== null || el.closest('.card, [data-cls], [data-d], [data-t]')) return 'select';
  return 'click';
}
