import { describe, expect, it } from 'vitest';
import { DUNGEONS, DungeonId, raidCountsTriple } from '../sim/content/dungeon';

describe('W3: raid credit follows the live world boss', () => {
  it('the Crucible counts triple only while Grandmother Slag is live', () => {
    expect(DUNGEONS.crucible.worldBoss).toBe('Grandmother Slag');
    expect(raidCountsTriple('crucible', 'Grandmother Slag')).toBe(true);
    for (const other of ['The Cinder Colossus', 'Old Coalmouth', 'The Furnace Regent', undefined]) expect(raidCountsTriple('crucible', other)).toBe(false);
  });

  it('every other dungeon keeps its shadow fight triple whoever is live', () => {
    for (const id of Object.keys(DUNGEONS) as DungeonId[]) {
      if (DUNGEONS[id].raid) continue;
      expect(raidCountsTriple(id, 'The Cinder Colossus')).toBe(true);
    }
    expect(raidCountsTriple(undefined, undefined)).toBe(true);
  });

  it('every raid names its world boss', () => {
    for (const d of Object.values(DUNGEONS)) if (d.raid) expect(d.worldBoss, d.id).toBeTruthy();
  });
});
