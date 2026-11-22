/**
 * Line glyphs from the Horders UI design system (screen 07, Icon Set):
 * a 24-unit grid, one stroke path, 2.4 stroke, round caps, coloured by currentColor.
 */
import type { OmenId } from '../sim/content/omens';
import type { PotionId } from '../sim/content/potions';
import type { Branch, ClassId } from '../sim/content/emberwright';
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
  // Muster: a war banner, with the call ringing out from it.
  bulwark: 'M5 21.5V2.5 M5 3.5h12l-3 4 3 4H5 M17 15.5a3.5 3.5 0 0 1 0 5 M20 13a7 7 0 0 1 0 10',
  // Glow Pool: a pool with a mending cross rising from it.
  lumen: 'M3.5 17.5c0 2.6 17 2.6 17 0s-17-2.6-17 0Z M12 4v8 M8 8h8 M6 12.5v.01 M18 12.5v.01',
  // Cinder Sump: a molten pit with bubbles breaking.
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
    // Rim Smash: a shield with impact lines (from the design set).
    'M10 5 4 7v5c0 3 2 6 6 8 4-2 6-5 6-8V7Z M19 6l3-2 M20 11h3 M19 16l3 2',
    // Charge: a shield moving forward into an impact star.
    'M14 5 9 7v5c0 3 2 6 5 7.5 3-1.5 5-4.5 5-7.5V7Z M2 9h4 M3 13h3.5 M2 17h4 M21.5 3l1 1 M22.5 8h.01',
    // Anvil Skin: a braced tower shield, blows bouncing back off it.
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

/**
 * Season glows whose colours sit close to another glow's get a mark of their own, so they part by shape
 * as well as colour (colourblind players, and a near-white glow on a pale floor): 'double' adds an inner
 * ring, 'edge' a dark outline, 'facet' six crystal points on the ring, 'crack' a ring broken by dark seams.
 * The Deep Bellows' three warm glows: Bellows Orange plain, Kiln Red double, White Heat edged. The Cold Hearth's:
 * Rime Blue faceted (apart from the Hollow Tide's Tide Silver), Coal Glow cracked (apart from Bellows Orange) and
 * Frostbite edged (a near-white, like White Heat). The swatches in the hub carry the same marks.
 */
export const GLOW_MARK: Record<string, GlowMark> = { kilnRed: 'double', whiteHeat: 'edge', rimeBlue: 'facet', coalGlow: 'crack', frostbite: 'edge' };
export type GlowMark = 'double' | 'edge' | 'facet' | 'crack';
/** The swatch class for a glow's mark ('' for none). */
export const glowMarkClass = (id: string): string => (GLOW_MARK[id] ? ` m-${GLOW_MARK[id]}` : '');

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
  // Wrackrider (stand fast): a mooring bollard on the quay with a rope made fast, over a wave.
  // (An anchor would read better, but Anchored Dawn's talent already uses one.)
  wrackrider: 'M5.5 7q6.5-4.5 13 0Z M8.5 7c1.4 2.6 1.4 6.4 0 9.5 M15.5 7c-1.4 2.6-1.4 6.4 0 9.5 M5 16.5h14 M14.6 11.5c3 0 5.2 1.4 6.6 4 M2.5 21q2.4-2.4 4.8 0t4.8 0 4.8 0 4.6 0',
  // Deepguard (stay close): a shield inside a broken ring, the reach you have to stay within.
  // (Two shields side by side read as a pair of items, not as standing together.)
  deepguard: 'M12 7.5l-3.8 1.4v3c0 2.5 1.6 4.2 3.8 5.1 2.2-.9 3.8-2.6 3.8-5.1v-3Z M7.5 3.6a9.5 9.5 0 0 1 9 0 M20.4 7.5a9.5 9.5 0 0 1 0 9 M16.5 20.4a9.5 9.5 0 0 1-9 0 M3.6 16.5a9.5 9.5 0 0 1 0-9',
  // Ventwalker (split up): one path forking to two vent circles, one hero to each.
  ventwalker: 'M12 21.5v-6.5l-5-5 M12 15l5-5 M5.5 3a3 3 0 1 1 0 6a3 3 0 1 1 0-6Z M18.5 3a3 3 0 1 1 0 6a3 3 0 1 1 0-6Z',
  // Kinbound (cover each other): two arrows turning round a heal, each hero covering the other in turn.
  // (Linked rings read as a chain or a link icon.)
  kinbound: 'M12 3.5a8.5 8.5 0 0 1 7.4 4.3 M17.3 9.6l3.6.4.4-3.6 M12 20.5a8.5 8.5 0 0 1-7.4-4.3 M6.7 14.4l-3.6-.4-.4 3.6 M12 9v6 M9 12h6',
  // Relayer (take turns): two press plates, one down on the floor and one raised with an arrow under it,
  // the next to come down. (Arrows chasing round a circle read as Kinbound or as a refresh button.)
  relay: 'M3 21h18 M7.5 3v10.5 M4.5 13.5h6v3.5h-6Z M16.5 3v3 M13.5 6h6v3.5h-6Z M16.5 12.5v5 M14.5 15.5l2 2 2-2',
  // Crawsplitter (break them free): a hero's head bursting up out of the Craw, its shell split along a jagged rim.
  // (A whole figure standing in the shell read as an anchor, which Anchored Dawn's talent already uses.)
  crawsplitter: 'M3.5 14a8.5 7.5 0 0 0 17 0l-3 1.6-2.6-2.4-2.9 2.2-2.9-2.2-2.6 2.4Z M12 6.5a3 3 0 1 1 0 6a3 3 0 1 1 0-6Z M4.5 3.5l2 3.5 M19.5 3.5l-2 3.5 M12 1.5v2.5',
  // Platewalker (get behind him): a riveted plate, and a path curling round its edge to come in behind it.
  // (An arrow circling a round body read as a refresh button.)
  platewalker: 'M2.5 4h7v16h-7Z M5 7.5h.01 M7 7.5h.01 M5 16.5h.01 M7 16.5h.01 M12 20.5c5.5 0 9-3.5 9-8.5s-3-8-7.5-8 M16.5 1.5L14 4l2.5 2.5',
  // Handover (pass it on): placeholder from design for visuals to redraw, a seal moving from one hand to another.
  handover: 'M3 15.5h5l3-2.5 M21 15.5h-5l-3-2.5 M12 3.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7Z M9 20.5h6',
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
  // Shared Melt (Slagbinder): a core with a fire burning inside.
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

/** P6: the Achievements button's crest, a medal on its ribbon. */
export const MEDAL_ICON = 'M8 2.5 10.5 9 M16 2.5 13.5 9 M12 8.5a6 6 0 1 1 0 12a6 6 0 1 1 0-12Z M12 11.8l1.1 2.2 2.4.3-1.8 1.6.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.6 2.4-.3Z';

/**
 * P6: a medal glyph per achievement (ACHIEVEMENTS in sim/content/achievements.ts, by id), in its
 * dungeon's or deed's colour. A new achievement needs an entry here; unknown ids fall back to the medal.
 */
export const ACHIEVEMENT_ICON: Record<string, { color: string; d: string }> = {
  // Kiln-Breaker: the kiln's dome with its fire.
  'boss:kiln': { color: '#ff8a3d', d: 'M4 20.5h16 M6 20.5V12a6 6 0 0 1 12 0v8.5 M12 18.5c-1.6 0-2.6-1-2.6-2.4 0-1.4 1.2-2.3 2.6-3.9 1.4 1.6 2.6 2.5 2.6 3.9 0 1.4-1 2.4-2.6 2.4Z' },
  // Floodwalker: rising above the flood.
  'boss:foundry': { color: '#5fc8e8', d: 'M3 16.5c2 0 2-1.5 4.5-1.5S9.5 16.5 12 16.5s2-1.5 4.5-1.5 2.5 1.5 4.5 1.5 M3 20.5c2 0 2-1.5 4.5-1.5s2 1.5 4.5 1.5 2-1.5 4.5-1.5 2.5 1.5 4.5 1.5 M12 12V3.5 M8.5 7 12 3.5 15.5 7' },
  // Lightproof: the glare above, a ledge of shadow below.
  'boss:glarewell': { color: '#ffd76a', d: 'M12 5a3.6 3.6 0 1 1 0 7.2A3.6 3.6 0 1 1 12 5Z M12 1.5v.8 M5 8.6h.8 M18.2 8.6h.8 M7 3.6l.6.6 M17 3.6l-.6.6 M3.5 15.5h17 M6.5 19.5h11' },
  // Winterproof: a snowflake.
  'boss:coldmarrow': { color: '#bfe4ff', d: 'M12 2.5v19 M3.8 7.3l16.4 9.4 M3.8 16.7 20.2 7.3 M9.5 4 12 6.5 14.5 4 M9.5 20 12 17.5 14.5 20' },
  // Anvilbreaker: a cracked anvil.
  'boss:hammerdeep': { color: '#c9b8a6', d: 'M3 6.5h12.5c2.5 0 4.5 1.3 5 3.5h-5c-.6 2-2 3-4.5 3.5l1 3H8l1-3C6 13 4 11 3 6.5Z M6 20h12 M10.5 6.5 9.2 9.2l1.6 1.4-1 2' },
  // Twice-Burned: the twofold flame.
  'boss:ashvents': { color: '#ff7a8a', d: 'M8 20.5c-2.2 0-3.6-1.4-3.6-3.4 0-2.1 1.7-3.3 3.6-5.9 1.9 2.6 3.6 3.8 3.6 5.9 0 2-1.4 3.4-3.6 3.4Z M16 15c-2.2 0-3.6-1.4-3.6-3.4 0-2.1 1.7-3.3 3.6-5.9 1.9 2.6 3.6 3.8 3.6 5.9 0 2-1.4 3.4-3.6 3.4Z' },
  // Slagbane: Grandmother Slag's crucible, still steaming.
  'boss:crucible': { color: '#ff9b4a', d: 'M3.5 9.5h17 M5 9.5l1.4 8.7a2 2 0 0 0 2 1.8h7.2a2 2 0 0 0 2-1.8L19 9.5 M9 6.5c0-1.4 1.6-1.6 1.6-3.5 M13.5 6.5c0-1.4 1.6-1.6 1.6-3.5 M9.5 14h5' },
  // Pressbreaker: Oskel's press plate broken in two, the halves tipping apart over the floor. Brass, the Pressworks' colour.
  // Crawbreaker: Old Coalmouth's Craw split down the middle, its embers spilling out of the gap. Deep ember red, apart from the Crucible's orange.
  'boss:hoard': { color: '#ff5a2a', d: 'M9.5 4C5 8 3 12 3.6 15.8a5.6 5.6 0 0 0 5.4 4.4l-1.3-3.2 1.9-2.4-2-2.8 1.8-2.8Z M14.5 4C19 8 21 12 20.4 15.8a5.6 5.6 0 0 1-5.4 4.4l1.3-3.2-1.9-2.4 2-2.8-1.8-2.8Z M12 13.5v.01 M12 18v.01 M12 22v.01' },
  // Raid 3, the Smeltery ("get behind him"): his riveted front plate, and an arrow going round it to his back.
  'boss:smeltery': { color: '#ffb35c', d: 'M2.5 5h8v10l-4 3.5-4-3.5Z M5 8.5v.01 M8 8.5v.01 M5 12.5v.01 M8 12.5v.01 M7 21c6 1 12-2 13.5-8 .5-2 .3-4-.5-5.8 M17.5 9.5l2.6-2.6 2.6 2.4' },
  'boss:pressworks': { color: '#c8c27a', d: 'M9.5 4.5 3 6v6.5l6.5-1.5-1.2-3.4Z M14.5 4.5 21 6v6.5L14.5 11l1.2-3.4Z M3 20.5h18 M12 14v3.5 M8 16l-1.5 1.5 M16 16l1.5 1.5' },
  // The Wrackline (Ebbproof): Hessa's drain, a whirlpool over a wave. Seafoam, so it stays clear of the Foundry's blue.
  'boss:wrackline': { color: '#6fe0b0', d: 'M12 12.5a1.6 1.6 0 1 1 3.2 0a3.8 3.8 0 0 1-7.6 0a6 6 0 0 1 12 0 M3 20.5q2.25-2 4.5 0t4.5 0 4.5 0 4.5 0' },
  // Many Hands: five heroes joined in a ring.
  classes: { color: '#e8d9a8', d: 'M12 5 18.7 9.8 16.1 17.7H7.9L5.3 9.8Z M12 3.6v.01 M20 9.4v.01 M17 19v.01 M7 19v.01 M4 9.4v.01' },
  // Quencher: a drop, and the cast it cut.
  'interrupts:1': { color: '#8fd8ff', d: 'M12 4c2.6 3.6 4.2 5.8 4.2 8a4.2 4.2 0 0 1-8.4 0c0-2.2 1.6-4.4 4.2-8Z M4 20 20 4' },
  // Spellsnuffer: a rune ring split by a strike.
  'interrupts:2': { color: '#8fd8ff', d: 'M17.7 5.8A8 8 0 1 0 19.8 14.5 M14 2.5 10.5 11h4l-3.5 9' },
  // Namebreaker: a named foe's crown, cracked.
  named: { color: '#d8a8ff', d: 'M4.5 17 3.5 7.5l5 3.8L12 5l3.5 6.3 5-3.8-1 9.5Z M4.5 20.5h15 M12 9.5v2.5l-1.4 1.6 1 1.6' },
  // Bountysworn: a sealed bounty scroll.
  bounties: { color: '#ffc861', d: 'M6 4h11a2 2 0 0 1 2 2v12a2.5 2.5 0 0 1-2.5 2.5H7.5A2.5 2.5 0 0 1 5 18V5a1 1 0 0 1 1-1Z M8.5 8.5h7 M8.5 12h5 M15.5 15.5a1.8 1.8 0 1 1 0 3.6a1.8 1.8 0 1 1 0-3.6Z' },
  // Keybearer: a Delver's Key.
  'keys:1': { color: '#b48cff', d: 'M7.5 6.5a4 4 0 1 1 0 8a4 4 0 1 1 0-8Z M11.5 10.5H21 M18 10.5V14 M21 10.5v2.5' },
  // Lockbreaker: the lock, sprung open.
  'keys:2': { color: '#b48cff', d: 'M5 11h14v10H5Z M8 11V7a4 4 0 0 1 7.8-1.3 M12 14.5v3' },
};

/** A medal tile for an achievement: lit when done, dim until then. */
export function medalTile(id: string, done: boolean, size = 34): string {
  const ic = ACHIEVEMENT_ICON[id] ?? { color: '#ffc861', d: MEDAL_ICON };
  return `<span class="medal${done ? ' won' : ''}" style="--gc:${ic.color};width:${size}px;height:${size}px">${glyph(ic.d, Math.round(size * 0.58))}${done ? '<i class="tick" aria-hidden="true"></i>' : ''}</span>`;
}

/**
 * Talent cards: one glyph per talent branch (Branch in sim/content/emberwright.ts), drawn in the
 * branch colour on the draft card. A new talent picks up its branch's glyph; a new branch needs
 * an entry here. Capstones show the same glyph inside a ring.
 */
export const BRANCH_GLYPH: Record<Branch, string> = {
  // Emberwright
  wildfire: 'M12 3c1 3 5 5 5 9.5a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 0 1.8.9 2.8 2 2.8-.6-2.6 0-5 .5-7.3Z',
  kindling: 'M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6Z M12 3v2.5 M12 18.5V21 M3 12h2.5 M18.5 12H21 M5.6 5.6l1.8 1.8 M16.6 16.6l1.8 1.8',
  ashguard: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6Z M12 9c.9 1.3 2.2 2 2.2 3.6a2.2 2.2 0 0 1-4.4 0c0-1 .6-1.7 1.3-2.3',
  // Duskblade
  bloodletting: 'M4 20 14 10 M14 10l4-6 2 2-6 4 M17.5 14.5c1.2 1.6 2 2.6 2 3.6a2 2 0 0 1-4 0c0-1 .8-2 2-3.6Z',
  tempo: 'M13 8a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13Z M13 11v3.5l2.2 1.5 M11 3h4 M13 3v5 M2.5 11.5h4 M3.5 15.5h2.5',
  guard: 'M5 5l14 14 M19 5 5 19 M5 5h3.5 M5 5v3.5 M19 5h-3.5 M19 5v3.5 M8 17l-1 1 M16 17l1 1',
  // Bulwark
  bastion: 'M6 3h12v9c0 4-3 7-6 9-3-2-6-5-6-9Z M12 6.5v11 M8.5 10.5h7',
  retribution: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6Z M13.2 7.5l-3 4.8h3.8l-3 4.8',
  vanguard: 'M4 6l6 6-6 6 M11 6l6 6-6 6 M19.5 5v14',
  // Lumen
  dawn: 'M3 18h18 M7 18a5 5 0 0 1 10 0 M12 5.5v3 M5.4 9.4l2 2 M18.6 9.4l-2 2 M8.5 21.5h7',
  grace: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z M12 9.5v5 M9.5 12h5',
  choir: 'M9 17.5V6l10-2v11.5 M9 17.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0Z M19 15.5a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0Z M9 9.5l10-2',
  // Slagbinder
  forge: 'M3.5 8h13a4 4 0 0 0 4-4 M3.5 8c0 3 2 4.5 5.5 4.5h4 M10.5 12.5v3.5 M7 20h10l-2-4H9Z',
  clinker: 'M3.5 18l3.5-6.5 4 2.2 3.2-5.2 6.3 9.5Z M8.5 7.5l1.6-3.2 2.2 1.6',
  crust: 'M5 7.5l7-3 7 3 M5 11.5l7-3 7 3 M5 15.5l7-3 7 3v3.5l-7 3-7-3Z',
  general: 'M12 3l2.2 5.8 6.1.7-4.6 4 1.4 6L12 16.4 6.9 19.5l1.4-6-4.6-4 6.1-.7Z',
};

/** Party cards (Season 2): two heroes side by side, on a small badge at the tile's corner. */
/** Fill with bots (sim/content/botfill): a bot ally's mark, a little construct head, worn beside its name in the
 * party frames and over its head in a run, so a stand-in reads at a glance without a word after every name. */
export const BOT_GLYPH = 'M7 8.5h10a2.5 2.5 0 0 1 2.5 2.5v6.5a2.5 2.5 0 0 1-2.5 2.5H7a2.5 2.5 0 0 1-2.5-2.5V11A2.5 2.5 0 0 1 7 8.5Z M12 8.5V5 M12 3h0 M9.3 14.2h0 M14.7 14.2h0 M1.8 12.5v3 M22.2 12.5v3';

/** Whether hero `j` is a Fill with bots stand-in: bots join after everyone else (World's constructor). */
export function isBotAlly(w: { fillBots: number; heroes: readonly unknown[] }, j: number): boolean {
  return w.fillBots > 0 && j >= w.heroes.length - w.fillBots;
}

/** A bot's name as it is shown next to its mark (main.ts names it "Class (bot)"; the mark says the rest). */
export function botName(name: string): string {
  return name.replace(/ \(bot\)$/, '');
}

export const PARTY_GLYPH = 'M8 5.5a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2Z M16 5.5a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2Z M2.5 19.5a5.5 5.5 0 0 1 11 0 M10.5 19.5a5.5 5.5 0 0 1 11 0';

/** The glyph tile on a talent card; a capstone's sits inside a ring, a deep card's (C5) in a double frame, and a
 * party card (a deep card offered only in a party) adds a two-hero badge on its corner. */
export function talentTile(branch: Branch, color: string, capstone = false, size = 34, deep = false, party = false): string {
  return `<span class="gtile tglyph${capstone ? ' cap' : deep ? ' deep' : ''}" style="--gc:${color};width:${size}px;height:${size}px">${glyph(BRANCH_GLYPH[branch], Math.round(size * 0.6))}`
    + `${party ? `<span class="pbadge" aria-hidden="true">${glyph(PARTY_GLYPH, 11)}</span>` : ''}</span>`;
}
