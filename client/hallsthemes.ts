/**
 * Phase 18 Halls H2d (and H3, the other dungeons): room themes, the data both looks share (no imports beyond types, so the main bundle can take it).
 * Design plan /mnt/project-files/horders/design/halls/h2-plan.md; the names, looks and final list are visuals', agreed
 * with design on 25 Nov. Each room of the map rolls a theme. The theme decides the room's floor tiles, its wall colour,
 * the colour of the two moving room lights, its props and one quiet motion. The 3D side is client/hd2d/hallsthemes.ts.
 */
import type { HallsMap, HallsRoom } from '../sim/halls';
import { roomPieces, type EdgePiece } from './hallsshape';

/** The Kiln's five (H2d), the Drowned Foundry's four (H3a), the Glarewell's four (H3b), the Coldmarrow's four (H3c), then the Wrackline's four (H3d). Ids are unique across dungeons. */
export type ThemeId = 'ash' | 'bellows' | 'slag' | 'cooling' | 'shrine' | 'boiler' | 'cistern' | 'pump' | 'anchor' | 'lens' | 'orrery' | 'colonnade' | 'mirror' | 'hearthless' | 'rime' | 'drift' | 'crypt' | 'quay' | 'wreck' | 'kelp' | 'sluice' | 'anvil' | 'chain' | 'quench' | 'ingot' | 'fumarole' | 'obsidian' | 'cairn' | 'pumice';

export interface Theme {
  id: ThemeId;
  /** Shown nowhere yet; the corner map and the sound team use the same names. */
  name: string;
  /** The 2D look's floor colour (its greybox palette is darker than the 3D tiles). */
  floor2d: number;
  /** Floor tile colour (the tile canvas's base), and whether the tiles are cracked. */
  tile: string;
  cracked: boolean;
  /** Wall brick colour. */
  wall: string;
  /** The two room lights: colour, and a multiplier on their usual strength (rooms brighter, Steve 23 Nov). */
  light: string;
  lightK: number;
  /** How the room lights breathe: 0 = today's flicker only, >0 = a slow swell at this rate (Hz). */
  swell: number;
  /** The floor is open water (the Wrackline's quays): ripples that drift, not tiles; `tile` is the water's colour. */
  water?: boolean;
}

export const THEMES: Record<ThemeId, Theme> = {
  // Grey sacks and crates, soft ash floor, warm and calm: the quiet room.
  ash: { id: 'ash', floor2d: 0x36312d, name: 'Ash store', tile: '#80756e', cracked: false, wall: '#8a7c74', light: '#ffc89a', lightK: 1.2, swell: 0 },
  // Big leather bellows against the walls that breathe slowly; orange light swelling with them.
  bellows: { id: 'bellows', floor2d: 0x2c211c, name: 'Bellows hall', tile: '#7c4c3a', cracked: false, wall: '#9a5a44', light: '#ffa050', lightK: 1.3, swell: 0.22 },
  // Dark basalt and cooled slag heaps; the room's lava layout glows from below.
  slag: { id: 'slag', floor2d: 0x261b17, name: 'Slag channel', tile: '#5c4038', cracked: true, wall: '#6a4034', light: '#ff7a3a', lightK: 1.25, swell: 0.12 },
  // Pale cracked tiles, steam posts: cool blue-grey, the one cold-lit room in the Kiln.
  cooling: { id: 'cooling', floor2d: 0x2a3134, name: 'Cooling yard', tile: '#8a969c', cracked: true, wall: '#78848a', light: '#cfe2ff', lightK: 1.3, swell: 0 },
  // The shrine or named room: sandstone, a carved niche and candles, gold light.
  shrine: { id: 'shrine', floor2d: 0x3a2f22, name: 'Kiln shrine', tile: '#a8865c', cracked: false, wall: '#b0845e', light: '#ffd890', lightK: 1.35, swell: 0 },
  // H3a, the Drowned Foundry (design plan /mnt/project-files/horders/design/halls/h3-plan.md). Steam and water; kept to
  // four, each with one quiet motion at most (Steve, 25 Nov: keep it simple).
  // Brass boilers, warm amber light, a slow puff of steam off each: the door guard's room.
  boiler: { id: 'boiler', floor2d: 0x2e2620, name: 'Boiler room', tile: '#5a5048', cracked: false, wall: '#8a6a50', light: '#ffc080', lightK: 1.3, swell: 0 },
  // Wet slate and stone basins of still water; cool cyan light that swells slowly.
  cistern: { id: 'cistern', floor2d: 0x223032, name: 'Cistern', tile: '#4e5a58', cracked: false, wall: '#7a8e8a', light: '#9fd8ec', lightK: 1.3, swell: 0.15 },
  // Pumps whose plungers stroke slowly up and down; pale blue-white light.
  pump: { id: 'pump', floor2d: 0x2a2e2e, name: 'Pump hall', tile: '#646a68', cracked: false, wall: '#8a9490', light: '#d8ecf4', lightK: 1.3, swell: 0 },
  // Anchors and coiled chain, dim cool grey, nothing moving: the quiet room.
  anchor: { id: 'anchor', floor2d: 0x25282a, name: 'Anchor store', tile: '#4a4e50', cracked: true, wall: '#6e7476', light: '#c8d0dc', lightK: 1.15, swell: 0 },
  // H3b, the Glarewell (a sunken observatory: light that burns, and the shadows of pillars to hide in). Cool slate and
  // violet stone like its arena; four themes, at most one quiet motion each.
  // Brass stands holding great lenses, pale gold light that swells slowly, like the glare gathering: the door guard's room.
  lens: { id: 'lens', floor2d: 0x2c2a3a, name: 'Lens gallery', tile: '#6a6684', cracked: false, wall: '#a49cc8', light: '#ffe6b0', lightK: 1.35, swell: 0.1 },
  // Dark slate under a dim violet light, brass orreries that turn slowly: the quiet room.
  orrery: { id: 'orrery', floor2d: 0x1e1c2c, name: 'Star vault', tile: '#4a4664', cracked: false, wall: '#7c74a8', light: '#b8a8ff', lightK: 1.25, swell: 0 },
  // Broken columns and fallen drums, cracked floor, soft pale light: shadows to hide in (Cross and Ring rooms).
  colonnade: { id: 'colonnade', floor2d: 0x22202c, name: 'Shade colonnade', tile: '#56526a', cracked: true, wall: '#8a84a8', light: '#d8d0f0', lightK: 1.15, swell: 0 },
  // Tall mirrors in brass frames along the walls, the brightest, whitest light in the dungeon.
  mirror: { id: 'mirror', floor2d: 0x2a2a36, name: 'Mirror hall', tile: '#76728c', cracked: false, wall: '#b0aad0', light: '#eef0ff', lightK: 1.4, swell: 0 },
  // H3c, the Coldmarrow (ids engineering's, 25 Nov). Its mechanic is your Hearthcoal's light against the dark and Chill,
  // so these floors are darker than the Kiln's and the lights cool and dim; the only warm light stays your coal.
  // A great dead hearth, cold grey ash and charred logs, no fire: the door guard's room.
  hearthless: { id: 'hearthless', floor2d: 0x1c1e24, name: 'Dead hearth hall', tile: '#3c4250', cracked: false, wall: '#7a8296', light: '#c8d4ec', lightK: 1.0, swell: 0 },
  // Frosted cracked tiles and ice-crusted stumps hung with icicles; pale blue light that shimmers slowly.
  rime: { id: 'rime', floor2d: 0x1e2430, name: 'Rime hall', tile: '#4c5a70', cracked: true, wall: '#94a8c4', light: '#bcd8ff', lightK: 1.15, swell: 0.1 },
  // Snow heaped in drifts against the walls, the palest floor of the four.
  drift: { id: 'drift', floor2d: 0x22262e, name: 'Snowdrift cave', tile: '#565e6e', cracked: false, wall: '#a0aabc', light: '#d8e4f4', lightK: 1.1, swell: 0 },
  // Dark stone, frosted stone coffins along the walls, a dim violet-blue light: the quiet room.
  crypt: { id: 'crypt', floor2d: 0x1a1c24, name: 'Cold crypt', tile: '#363a48', cracked: true, wall: '#70768c', light: '#a8b4e0', lightK: 1.0, swell: 0 },
  // H3d, the Wrackline (ids engineering's, 25 Nov). Every room is a quay: open water with the three rafts (the rafts
  // and the drain are drawn by the fight, GameScene wrackDraw), so every floor is water and the room is told by its
  // stone or timber walls, its props and its light.
  // Stone quay walls, bollards with coiled rope, warm lantern light: the door guard's room.
  quay: { id: 'quay', floor2d: 0x1a3236, name: 'Harbour quay', tile: '#2e5a62', cracked: false, wall: '#8a9a98', light: '#ffd6a0', lightK: 1.3, swell: 0, water: true },
  // Broken hull ribs and loose barrels against dark timber, grey daylight.
  wreck: { id: 'wreck', floor2d: 0x182c30, name: 'Wreck yard', tile: '#2a4e56', cracked: false, wall: '#7a6a58', light: '#c8dce4', lightK: 1.2, swell: 0, water: true },
  // Kelp swaying along the walls, cool sea light that swells slowly.
  kelp: { id: 'kelp', floor2d: 0x16302e, name: 'Kelp bed', tile: '#264e4c', cracked: false, wall: '#6e8a84', light: '#a8d8e8', lightK: 1.25, swell: 0.12, water: true },
  // Iron sluice gates with their wheels, the palest water: the boss door alcove's.
  sluice: { id: 'sluice', floor2d: 0x1c3440, name: 'Sluice gate', tile: '#30586a', cracked: false, wall: '#7a8a92', light: '#d0e4f0', lightK: 1.3, swell: 0, water: true },
  // H4a, the Hammerdeep: cold forge iron, grey-violet like Ondrel's arena (renderer ROOMS.hammerdeep), pale lantern
  // light, nothing glowing. One quiet motion each (design, 25 Nov): the anvil hall's lanterns breathe, the chains swing
  // slowly, steam lifts off the quench troughs; the ingot store is the still, quiet room.
  // Great anvils on oak blocks with a hammer leaning on one, warm lantern light: the door guard's room.
  anvil: { id: 'anvil', floor2d: 0x2a2830, name: 'Anvil hall', tile: '#686674', cracked: false, wall: '#a29eb2', light: '#ffd8b0', lightK: 1.35, swell: 0.08 },
  // Heavy chains hanging from an iron bracket on the wall, swinging slowly, pale cold light: the boss door alcove's.
  chain: { id: 'chain', floor2d: 0x26252e, name: 'Chain gallery', tile: '#5e5c6a', cracked: false, wall: '#9490a6', light: '#d8dcff', lightK: 1.3, swell: 0 },
  // Iron troughs of dark quench water with steam lifting off them, cool blue light.
  quench: { id: 'quench', floor2d: 0x24272e, name: 'Quench trough', tile: '#586070', cracked: false, wall: '#8890aa', light: '#c0d2ff', lightK: 1.3, swell: 0 },
  // Iron ingots stacked on pallets, cracked worn floor, plain pale light: the quiet room.
  // H4b, the Ashvents: pale ash floors and rose stone like Ysmeret's arena (renderer ROOMS.ashvents), warm pale light,
  // nothing glowing (the vents smoke, they don't burn). One quiet motion each, the cairn walk the still room.
  // Low stone vent cones with smoke rising off them: the door guard's room, and any vents room.
  fumarole: { id: 'fumarole', floor2d: 0x3a3230, name: 'Fumarole field', tile: '#a09088', cracked: true, wall: '#b8a098', light: '#ffd0b8', lightK: 1.3, swell: 0 },
  // Tall black obsidian shards against rose walls, a rose light that breathes slowly: the boss door alcove's.
  obsidian: { id: 'obsidian', floor2d: 0x302828, name: 'Obsidian gallery', tile: '#8e807c', cracked: false, wall: '#a88e8a', light: '#ffc0b4', lightK: 1.3, swell: 0.08 },
  // Cairns of flat stones along the walls, plain pale light: the quiet room.
  cairn: { id: 'cairn', floor2d: 0x383230, name: 'Cairn walk', tile: '#a89a92', cracked: false, wall: '#c0a8a0', light: '#ffe0d0', lightK: 1.25, swell: 0 },
  // Soft pale pumice boulders heaped by the walls, the palest floor, its light swelling faintly.
  pumice: { id: 'pumice', floor2d: 0x3e3836, name: 'Pumice drift', tile: '#b4a8a2', cracked: false, wall: '#c8b4ac', light: '#fff0e8', lightK: 1.3, swell: 0.06 },
  ingot: { id: 'ingot', floor2d: 0x2a2a2e, name: 'Ingot store', tile: '#6c6a74', cracked: true, wall: '#9692a2', light: '#e4e0f0', lightK: 1.25, swell: 0 },
};

/** H1's template has no theme field: R0 entrance, R1 A, R2 S (side), R3 B/C, R4 D (side), R5 door guard, door alcove. */
const FALLBACK: ThemeId[] = ['ash', 'cooling', 'shrine', 'bellows', 'ash', 'slag', 'bellows'];

/** A room's theme: HallsRoom.theme from the generator, else the template's fallback by index. */
export function themeOf(m: HallsMap, i: number): Theme {
  const t = (m.rooms[i] as HallsRoom & { theme?: string }).theme;
  return THEMES[(t && t in THEMES ? t : FALLBACK[i % FALLBACK.length]) as ThemeId];
}

/** Where a room's props stand: every fourth piece of its far and side walls (never the low near ledge or an island),
 * starting at a hash of the room, at most 4 (Steve, 25 Nov: keep it simple, quiet rooms over busy ones), so the middle of the room stays clear for the fight. None in the alcove. */
export function themeSpots(m: HallsMap, i: number, hw: number, doorRoom: number): EdgePiece[] {
  if (i === doorRoom) return [];
  const spots = roomPieces(m, i, hw).filter((p) => !p.island && p.ny < 0.35);
  const pick: EdgePiece[] = [];
  for (let k = (i * 7) % 4; k < spots.length && pick.length < 4; k += 4) pick.push(spots[k]);
  return pick;
}

/** How big each theme's prop stands (bellows and slag heaps read too small at 1 from the 3D camera). */
export const PROP_SCALE: Record<ThemeId, number> = { ash: 1, bellows: 1.55, slag: 1.6, cooling: 1, shrine: 1, boiler: 1.3, cistern: 1.2, pump: 1.5, anchor: 1.4, lens: 1.4, orrery: 1.3, colonnade: 1.5, mirror: 1.4, hearthless: 1.5, rime: 1.4, drift: 1.6, crypt: 1.4, quay: 1.4, wreck: 1.5, kelp: 1.5, sluice: 1.5, anvil: 1.7, chain: 1.6, quench: 1.4, ingot: 1.5, fumarole: 1.6, obsidian: 1.5, cairn: 1.4, pumice: 1.5 };
