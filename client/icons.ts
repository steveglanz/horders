/**
 * Line glyphs from the Horders UI design system (screen 07, Icon Set):
 * a 24-unit grid, one stroke path, 2.4 stroke, round caps, coloured by currentColor.
 */
import type { OmenId } from '../sim/content/omens';
import type { ClassId } from '../sim/content/emberwright';

const FLAME = 'M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3 0-5 1-8Z';

export const OMEN_ICON: Record<OmenId, { color: string; d: string }> = {
  kindledDead: { color: '#ff8a3d', d: 'M6 21V11a6 6 0 0 1 12 0v10Z M4 21h16 M12 11c-2 2-2.5 3-2.5 4a2.5 2.5 0 0 0 5 0c0-1-.5-2-2.5-4Z' },
  sharedPain: { color: '#ff3b6b', d: 'M9 6a6 6 0 1 1 0 12a6 6 0 1 1 0-12Z M15 6a6 6 0 1 1 0 12a6 6 0 1 1 0-12Z' },
  quickened: { color: '#ffc861', d: 'M5 5l7 7-7 7 M12 5l7 7-7 7' },
  warded: { color: '#8fd8ff', d: 'M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6Z M9 12l2 2 4-4' },
  volatileGround: { color: '#ff7a1f', d: 'M2 21h20 M6 21l2-6 3 3 1-8 3 6 2-3 1 8 M12 2v3 M6.5 4l1.5 2 M17.5 4 16 6' },
};

/** Each class's colour and a glyph for its card (from the design's ability set). */
export const CLASS_ICON: Record<ClassId, { color: string; d: string }> = {
  emberwright: { color: '#ff8a3d', d: FLAME },
  duskblade: { color: '#ff4f7a', d: 'M4 20 20 4 M4 4l16 16 M6 15l3 3 M15 18l3-3' },
  bulwark: { color: '#d6dde4', d: 'M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6Z M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6Z' },
  lumen: { color: '#ffc861', d: 'M5 5a7 2.5 0 1 0 14 0a7 2.5 0 1 0-14 0Z M12 11a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9Z' },
};

export function glyph(d: string, size = 24): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

/** A tinted tile holding an Omen glyph. */
export function omenTile(id: OmenId, size = 36): string {
  const o = OMEN_ICON[id];
  return `<span class="gtile" style="--gc:${o.color};width:${size}px;height:${size}px">${glyph(o.d, Math.round(size * 0.62))}</span>`;
}
