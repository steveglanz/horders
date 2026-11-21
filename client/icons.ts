/**
 * Line glyphs from the Horders UI design system (screen 07, Icon Set):
 * a 24-unit grid, one stroke path, 2.4 stroke, round caps, coloured by currentColor.
 */
import type { OmenId } from '../sim/content/omens';
import type { PotionId } from '../sim/content/potions';
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

/** The interrupt family: a cast ring cut open by a slash at the top right. Every F ability carries it. */
const CUT = 'M17.7 6.3A8 8 0 1 1 13.5 4.1 M14.5 2.5l7 7';

/**
 * Action-bar glyphs per class, in slot order Q, E, R, F (the order of CLASSES[cls].abilities).
 * Names follow the skills team's map, /mnt/project-files/horders/skills/ability-icons.md.
 */
export const ABILITY_GLYPH: Record<ClassId, string[]> = {
  emberwright: [
    // Flame Wave: a cone of fire fanning out from one point.
    'M3 12 17 4 M3 12 17 20 M17 4l3 2.5-1.8 2.2 3 2.3-3 2.3 1.8 2.2-3 2.5 M9 12h3',
    // Blink: a flame left behind, a gap, and a spark further on.
    'M4.5 15.5c0-2 2-3 2-5.5 1.6 1.4 2.6 3.2 2.6 5.5a2.3 2.3 0 0 1-4.6 0Z M11.5 13h1 M14.5 13h1 M20 8v8 M16.5 12h7',
    // Combustion: a burst inside a ring.
    'M12 6.5l1.6 3.9 3.9 1.6-3.9 1.6-1.6 3.9-1.6-3.9L6.5 12l3.9-1.6Z M12 2.5a9.5 9.5 0 1 1 0 19a9.5 9.5 0 1 1 0-19Z',
    // Quench: a droplet inside the cut cast ring.
    'M12 8.5c1.8 2.6 2.8 4 2.8 5.4a2.8 2.8 0 0 1-5.6 0c0-1.4 1-2.8 2.8-5.4Z ' + CUT,
  ],
  duskblade: [
    // Rending Dash: speed lines, a blade out front, blood drops trailing.
    'M2.5 9h5 M2 13h4 M7 17 19 5 M19 5l-.8 4 M19 5l-4 .8 M10.5 20.5h.01 M14 19h.01',
    // Sidestep: a dotted afterimage beside a solid figure, with a side arrow.
    'M7 5h.01 M7 9h.01 M7 13h.01 M7 17h.01 M14 4.5a2 2 0 1 1 0 4a2 2 0 1 1 0-4Z M14 11v9 M18 14h4 M20 12l2 2-2 2',
    // Execution: a heavy downward blade over a half-empty health bar.
    'M12 2v10 M9 9.5 12 14l3-4.5 M3.5 17.5h17v4h-17Z M5.5 19.5h6',
    // Kick: a heel strike inside the cut cast ring.
    'M9.5 8h2.6v4.4l3.4 1.7v2.3h-6Z ' + CUT,
  ],
  bulwark: [
    // Shield Slam: a shield with impact lines (from the design set).
    'M10 5 4 7v5c0 3 2 6 6 8 4-2 6-5 6-8V7Z M19 6l3-2 M20 11h3 M19 16l3 2',
    // Charge: a shield moving forward into an impact star.
    'M14 5 9 7v5c0 3 2 6 5 7.5 3-1.5 5-4.5 5-7.5V7Z M2 9h4 M3 13h3.5 M2 17h4 M21.5 3l1 1 M22.5 8h.01',
    // Bastion: a braced tower shield, blows bouncing back off it.
    'M12 5 6.5 7.2v5c0 3.3 2.4 5.7 5.5 7.1 3.1-1.4 5.5-3.8 5.5-7.1v-5Z M12 8.5v7.5 M3 8.5a9 9 0 0 0 0 8 M21 8.5a9 9 0 0 1 0 8',
    // Shield Toss: a small shield inside the cut cast ring.
    'M12 8.5 9 9.7v2.4c0 1.8 1.3 3.1 3 3.9 1.7-.8 3-2.1 3-3.9V9.7Z ' + CUT,
  ],
  lumen: [
    // Radiant Burst: a sun pulse with a plus at its heart.
    'M12 7.5a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9Z M12 10.5v3 M10.5 12h3 M12 1.5V4 M12 20v2.5 M1.5 12H4 M20 12h2.5 M4.6 4.6l1.8 1.8 M17.6 17.6l1.8 1.8 M19.4 4.6l-1.8 1.8 M6.4 17.6l-1.8 1.8',
    // Glimmer Step: a light streak with sparkles at both ends.
    'M9 15 15 9 M5.5 14.5v6 M2.5 17.5h6 M18.5 3.5v6 M15.5 6.5h6',
    // Sanctuary: hallowed ground with rising light (from the design set).
    'M3 19a9 9 0 0 1 18 0Z M12 6V3 M6 9 4 7 M18 9l2-2',
    // Hush: a muted sound wave inside the cut cast ring.
    'M7.5 12.5q1.1-2 2.2 0t2.2 0 2.2 0 2.2 0 ' + CUT,
  ],
};

/** Slot 3 (F) is every class's interrupt. */
export const INTERRUPT_SLOT = 3;

/** Alchemy potions: three flask shapes so each reads by silhouette, coloured by what they do. */
export const POTION_ICON: Record<PotionId, { color: string; d: string }> = {
  // Rising Draught: a round flask with a rising arrow (you get back up).
  risingDraught: { color: '#ffc861', d: 'M10 3h4 M10.5 3v4.5 M13.5 3v4.5 M10.5 7.5C7 8.8 5 11.5 5 14.5a7 7 0 0 0 14 0c0-3-2-5.7-5.5-7 M12 18.5v-6 M9.5 15 12 12.5l2.5 2.5' },
  // Stillwater Tonic: a tall vial holding a calm wave (interrupt blue).
  stillwater: { color: '#8fd8ff', d: 'M9 3h6 M10 3v15.5a2 2 0 0 0 4 0V3 M10 12.5q1-1.2 2 0t2 0' },
  // Kindling Brew: a conical flask with a flame inside.
  kindling: { color: '#ff8a3d', d: 'M9.5 3h5 M10.5 3v5L5.5 18.5A1.6 1.6 0 0 0 6.9 21h10.2a1.6 1.6 0 0 0 1.4-2.5L13.5 8V3 M12 12c.6 1.8 2.5 2.6 2.5 4.6a2.5 2.5 0 0 1-5 0c0-1 .6-1.8 1.2-2.4 0 .8.5 1.3 1 1.3 0-1.4 0-2.3.3-3.5Z' },
};
