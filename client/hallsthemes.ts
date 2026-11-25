/**
 * Phase 18 Halls H2d: room themes, the data both looks share (no imports beyond types, so the main bundle can take it).
 * Design plan /mnt/project-files/horders/design/halls/h2-plan.md; the names, looks and final list are visuals', agreed
 * with design on 25 Nov. Each room of the map rolls a theme. The theme decides the room's floor tiles, its wall colour,
 * the colour of the two moving room lights, its props and one quiet motion. The 3D side is client/hd2d/hallsthemes.ts.
 */
import type { HallsMap, HallsRoom } from '../sim/halls';
import { roomPieces, type EdgePiece } from './hallsshape';

export type ThemeId = 'ash' | 'bellows' | 'slag' | 'cooling' | 'shrine';

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
export const PROP_SCALE: Record<ThemeId, number> = { ash: 1, bellows: 1.55, slag: 1.6, cooling: 1, shrine: 1 };
