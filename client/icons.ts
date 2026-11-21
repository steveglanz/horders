/**
 * Line glyphs from the Horders UI design system (screen 07, Icon Set):
 * a 24-unit grid, one stroke path, 2.4 stroke, round caps, coloured by currentColor.
 */
import type { OmenId } from '../sim/content/omens';
import type { PotionId } from '../sim/content/potions';
import type { ClassId } from '../sim/content/emberwright';
import type { SetId } from '../sim/content/sets';
import type { MythicId, WeaponFxId } from '../sim/content/items';

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
  // Slagbinder: a ladle pouring a drop.
  slagbinder: { color: '#ff9b4a', d: 'M3 8.5h11a5.5 5.5 0 0 1-11 0Z M14 8.5l7-5 M8.5 17.5c1 1.3 1.5 2.1 1.5 2.9a1.5 1.5 0 0 1-3 0c0-.8.5-1.6 1.5-2.9Z' },
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
/**
 * Ability-option glyphs (ALT_ABILITIES in sim/content/classes.ts), shown in the swapped slot.
 */
export const ALT_GLYPH: Record<ClassId, string> = {
  // Ember Ward: a hero wrapped in flame tongues (Quench already owns the drop in a ring).
  emberwright: 'M12 9.5a2.3 2.3 0 1 1 0 4.6a2.3 2.3 0 1 1 0-4.6Z M8.2 20.5c.7-2.4 2-3.6 3.8-3.6s3.1 1.2 3.8 3.6 M5 19C2.2 14.8 3 9 7.6 4.6c-.2 2.2.4 3.7 1.8 4.6 M19 19c2.8-4.2 2-10-2.6-14.4.2 2.2-.4 3.7-1.8 4.6',
  // Hamstring: a blade cuts through the stride, so the arrow of movement is broken.
  duskblade: 'M2.5 15.5h5 M14 15.5h4.5 M16.5 12.5l3 3-3 3 M16.5 2.5 10 17.5 M7.6 16.2l5 2.2 M10.1 17.3 9 20.5',
  // Rallying Cry: a war banner, with the call ringing out from it.
  bulwark: 'M5 21.5V2.5 M5 3.5h12l-3 4 3 4H5 M17 15.5a3.5 3.5 0 0 1 0 5 M20 13a7 7 0 0 1 0 10',
  // Lightwell: a pool with a mending cross rising from it.
  lumen: 'M3.5 17.5c0 2.6 17 2.6 17 0s-17-2.6-17 0Z M12 4v8 M8 8h8 M6 12.5v.01 M18 12.5v.01',
  // Slag Pit: a molten pit with bubbles breaking.
  slagbinder: 'M3 16.5c0 2.8 18 2.8 18 0s-18-2.8-18 0Z M8.5 9a1.7 1.7 0 1 1 0 3.4a1.7 1.7 0 1 1 0-3.4Z M15 4a2.3 2.3 0 1 1 0 4.6a2.3 2.3 0 1 1 0-4.6Z M14 12.5v.01',
};

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
  // Slagbinder (Molten Plating, Interpose, Cooling Shell, Clinker).
  slagbinder: [
    // Molten Plating: a plate with a molten drop held in it.
    'M12 3 5 6v5.5c0 4 3 7 7 8.5 4-1.5 7-4.5 7-8.5V6Z M9 8.5h6 M12 11c1.1 1.4 1.7 2.3 1.7 3.2a1.7 1.7 0 0 1-3.4 0c0-.9.6-1.8 1.7-3.2Z',
    // Interpose: a leap arcing in front of an ally.
    'M2.5 20c1-8 6-12.5 11.5-11.5 M14 8.5l-3.4-.9 M14 8.5l-1.8 3 M18.5 7a2 2 0 1 1 0 4a2 2 0 1 1 0-4Z M18.5 11v6 M16 20l2.5-3 2.5 3',
    // Cooling Shell: a dome over a hero, cold rising off it.
    'M3 20a9 9 0 0 1 18 0Z M12 13.5a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 1 1 0-3.6Z M12 5.5V2.5 M6.6 7.4 5 5.8 M17.4 7.4 19 5.8',
    // Clinker: a slag lump inside the cut cast ring.
    'M9.5 11l3-1.8 2.6 1.6-.4 3.1-3 1.5-2.6-1.6Z ' + CUT,
  ],
};

/** Slot 3 (F) is every class's interrupt. */
export const INTERRUPT_SLOT = 3;

/** Verb sets share one teal so a set piece reads at a glance; the glyph names the dungeon's verb. */
export const SET_COLOR = '#5fe0c8';
export const SET_ICON: Record<SetId, string> = {
  // Kilnbreaker (interrupt): a kiln dome split by a crack.
  kilnbreaker: 'M5 20v-8a7 7 0 0 1 14 0v8Z M3 20h18 M12.5 5l-2 4.5 3 2-2 4.5',
  // Tidewalker (keep moving): two rolling waves.
  tidewalker: 'M2.5 9.5q2.4-3 4.8 0t4.8 0 4.8 0 4.6 0 M2.5 15.5q2.4-3 4.8 0t4.8 0 4.8 0 4.6 0',
  // Glarewarden (step out): a watching eye and a step to the side.
  glarewarden: 'M2 11s3.6-5 9-5 9 5 9 5-3.6 5-9 5-9-5-9-5Z M11 8.8a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 1 1 0-4.4Z M15 20.5h7 M19.5 18l2.5 2.5-2.5 2.5',
  // Hearthkeeper (keep the flame): a flame cupped in two hands.
  hearthkeeper: 'M12 3.5c2.2 2.8 3.6 4.6 3.6 7a3.6 3.6 0 0 1-7.2 0c0-2.4 1.4-4.2 3.6-7Z M12 9.5c.9 1.2 1.4 2 1.4 3a1.4 1.4 0 0 1-2.8 0c0-1 .5-1.8 1.4-3Z M2.5 13.5c2.2 0 3.2 1.2 4.3 3.2s2.8 3.3 5.2 3.3 4.1-1.3 5.2-3.3 2.1-3.2 4.3-3.2',
};

/** Alchemy potions: three flask shapes so each reads by silhouette, coloured by what they do. */
export const POTION_ICON: Record<PotionId, { color: string; d: string }> = {
  // Rising Draught: a round flask with a rising arrow (you get back up).
  risingDraught: { color: '#ffc861', d: 'M10 3h4 M10.5 3v4.5 M13.5 3v4.5 M10.5 7.5C7 8.8 5 11.5 5 14.5a7 7 0 0 0 14 0c0-3-2-5.7-5.5-7 M12 18.5v-6 M9.5 15 12 12.5l2.5 2.5' },
  // Stillwater Tonic: a tall vial holding a calm wave (interrupt blue).
  stillwater: { color: '#8fd8ff', d: 'M9 3h6 M10 3v15.5a2 2 0 0 0 4 0V3 M10 12.5q1-1.2 2 0t2 0' },
  // Kindling Brew: a conical flask with a flame inside.
  kindling: { color: '#ff8a3d', d: 'M9.5 3h5 M10.5 3v5L5.5 18.5A1.6 1.6 0 0 0 6.9 21h10.2a1.6 1.6 0 0 0 1.4-2.5L13.5 8V3 M12 12c.6 1.8 2.5 2.6 2.5 4.6a2.5 2.5 0 0 1-5 0c0-1 .6-1.8 1.2-2.4 0 .8.5 1.3 1 1.3 0-1.4 0-2.3.3-3.5Z' },
};

/** Gear slots, for the bag grid on phones (docs/design/mobile-ux.md §3.4). */
export const SLOT_ICON: Record<'weapon' | 'head' | 'chest' | 'hands' | 'ring' | 'trinket', string> = {
  // Weapon: a sword, point up-left.
  weapon: 'M14.5 17.5 3 6V3h3l11.5 11.5 M13 19l6-6 M16 16l4 4 M19 21l2-2',
  // Head: a helm with a visor slit.
  head: 'M5 18v-5a7 7 0 0 1 14 0v5h-4v-4H9v4Z',
  // Chest: a tunic.
  chest: 'M8 3 4 6v6h3v9h10v-9h3V6l-4-3c0 2-2 3-4 3S8 5 8 3Z',
  // Hands: a glove.
  hands: 'M7 21v-9V6a1.5 1.5 0 0 1 3 0v5 M10 11V4.5a1.5 1.5 0 0 1 3 0V11 M13 11V5.5a1.5 1.5 0 0 1 3 0V12 M16 12V8.5a1.5 1.5 0 0 1 3 0V15c0 3-2 6-6 6H7',
  // Ring: a band with a stone.
  ring: 'M12 9a6 6 0 1 1 0 12a6 6 0 0 1 0-12Z M9 4h6l-3 5Z',
  // Trinket: an amulet on a cord.
  trinket: 'M7 3l5 7 5-7 M12 10a5 5 0 1 1 0 10a5 5 0 0 1 0-10Z M12 13v4',
};

/** Mythics share the Mythic rarity colour; the glyph names the effect (P4 Collection tiles). */
export const MYTHIC_ICON: Record<MythicId, string> = {
  // Phoenix Feather (rise again): a quill with its barbs.
  phoenixFeather: 'M19 3C10 4.5 5.5 10.5 5 21 M19 3c-.5 7.5-5.5 12.5-12.5 13.5 M12.5 13.5 8 12.5 M15 10l-4.5-1.2 M17.2 6.5l-4-1',
  // Giant's Bane (elites and bosses): crosshairs on a big target.
  giantsBane: 'M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16Z M12 9.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5Z M12 1.5v4.5 M12 18v4.5 M1.5 12H6 M18 12h4.5',
  // Glutton's Gem (experience): a cut gem.
  gluttonsGem: 'M7 4h10l4.5 5L12 21 2.5 9Z M2.5 9h19 M9.5 4 12 9l2.5-5 M12 9v12',
  // Splitting Cinders (extra damage to a nearby foe): an ember cracking into two halves.
  splittingCinders: 'M10 4.5a7.5 7.5 0 0 0 0 15 M10 4.5l1.5 4-2 3.5 2 3-1.5 4.5 M14.5 4.5a7.5 7.5 0 0 1 0 15 M14.5 4.5l1.5 4-2 3.5 2 3-1.5 4.5',
  // Wanderer's Wake (Blink burns its path): a dashed trail ending in a flame.
  wanderersWake: 'M2 19h3 M7 19h3 M12 19h1.5 M17 19c-2 0-3.2-1.5-3.2-3.3 0-2.4 1.9-3.8 3.2-6.7 1.3 2.9 3.2 4.3 3.2 6.7 0 1.8-1.2 3.3-3.2 3.3Z',
  // Banked Heart (Combustion, Heat back): a heart holding a flame.
  bankedHeart: 'M12 20.5S3.5 15.7 3.5 9.8A4.6 4.6 0 0 1 12 7.2a4.6 4.6 0 0 1 8.5 2.6c0 5.9-8.5 10.7-8.5 10.7Z M12 10c1 1.4 1.8 2.3 1.8 3.6a1.8 1.8 0 0 1-3.6 0c0-1.3.8-2.2 1.8-3.6Z',
  // Mirrorstep (an afterimage): a step to each side of a mirror line.
  mirrorstep: 'M12 2.5v19 M8.5 7 3.5 12l5 5 M15.5 7l5 5-5 5',
  // Red Ledger (Execution): a ledger with a tally struck through.
  redLedger: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5Z M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3 M9 7v7 M12 7v7 M15 7v7 M8 13l8-5',
  // Tethered Shield (Shield Toss, Charge): a shield on a chain.
  tetheredShield: 'M9 3 3.5 5v5c0 3.5 2.3 6 5.5 7.5 3.2-1.5 5.5-4 5.5-7.5V5Z M14.5 14.5l2 2 M16.5 16.5a2 2 0 1 1 2.8 2.8a2 2 0 1 1-2.8-2.8Z',
  // Ringwall Vow (guard every side): a ring of wall around a keep.
  ringwallVow: 'M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18Z M12 8.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7Z M12 3v5.5 M12 15.5V21 M3 12h5.5 M15.5 12H21',
  // Anchored Dawn (Sanctuary stays put): an anchor.
  anchoredDawn: 'M12 7v14 M4.5 14c0 4 3.3 7 7.5 7s7.5-3 7.5-7 M2.5 14h4 M17.5 14h4 M8.5 10h7 M12 2.5a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 1 1 0-4.4Z',
  // Eclipse Glass (more burst, less heal): a sun with the shadow crossing it.
  eclipseGlass: 'M12 6.5a5.5 5.5 0 1 1 0 11a5.5 5.5 0 1 1 0-11Z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4 M9.5 9.5a3.5 3.5 0 0 1 5 5',
  // Molten Core (Slagbinder): a core with a fire burning inside.
  moltenCore: 'M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17Z M12 8c1.7 2.1 2.7 3.5 2.7 5.3a2.7 2.7 0 0 1-5.4 0c0-1.8 1-3.2 2.7-5.3Z',
  // Clinker Crown (Slagbinder): a crown of clinker with a glowing stone.
  clinkerCrown: 'M3 19.5h18 M4 19.5 3 9l5 4 4-8 4 8 5-4-1 10.5 M12 14.5l1.6 1.2-1.6 1.3-1.6-1.3Z',
};

/** Class weapon effects, coloured by their class (P4 Collection tiles). The two cast-hitters wear the interrupt cut. */
export const WEAPON_FX_ICON: Record<WeaponFxId, string> = {
  // Piercing Cinders: an orb with a shot through it.
  piercingCinders: 'M2 12h20 M18.5 8.5 22 12l-3.5 3.5 M9.5 8a4 4 0 1 1 0 8a4 4 0 1 1 0-8Z',
  // Banked Flame: small orbs, then a big one.
  bankedFlame: 'M2.5 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0Z M7.5 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0Z M13 12a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0Z',
  // Cast-Cutter: the interrupt cut.
  castCutter: CUT,
  // Worrying Edge: stacking chevrons.
  worryingEdge: 'M5 20.5l7-5 7 5 M5 14.5l7-5 7 5 M5 8.5l7-5 7 5',
  // Rallying Sweep: a sweeping arc with Resolve rising.
  rallyingSweep: 'M3.5 17a9 9 0 0 1 17 0 M12 18V9 M8.5 12.5 12 9l3.5 3.5',
  // Warding Sweep: a sweeping arc over a shield.
  wardingSweep: 'M2.5 12.5a9.5 9.5 0 0 1 19 0 M12 9.5 7.5 11.2v3.3c0 2.4 1.8 4.2 4.5 5.5 2.7-1.3 4.5-3.1 4.5-5.5v-3.3Z',
  // Tender Light: a heart with a mending cross.
  tenderLight: 'M12 20.5S3.5 15.7 3.5 9.8A4.6 4.6 0 0 1 12 7.2a4.6 4.6 0 0 1 8.5 2.6c0 5.9-8.5 10.7-8.5 10.7Z M12 10.5v6 M9 13.5h6',
  // Rebuking Light: a sun inside the interrupt cut.
  rebukingLight: CUT + ' M12 9.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5Z',
  // Clinging Slag (Slagbinder): a glob of slag dripping.
  clingingSlag: 'M5 10.5C5 6.5 8 4 12 4s7 2.5 7 6.5c0 2-.8 3-2 3.3v2.7a1.5 1.5 0 0 1-3 0V14h-1v5a1.5 1.5 0 0 1-3 0v-5h-1v2.5a1.5 1.5 0 0 1-3 0v-2.7c-1.2-.3-2-1.3-2-3.3Z',
  // Tempered Lob (Slagbinder): a glob lobbed on a high arc.
  temperedLob: 'M2.5 20c2-8 7-12.5 12-11.5 M18 6.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7Z',
};

/** The Collection book: an open book. */
export const BOOK_ICON = 'M12 6.5C10 5 7 4.5 3 5v14c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5Z M12 6.5v14';
