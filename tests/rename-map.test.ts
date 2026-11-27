import { describe, expect, it } from 'vitest';
import { DUNGEONS, ENCOUNTERS, worldBossLabel } from '../sim/content/dungeon';
import { ENEMIES } from '../sim/content/enemies';

// Rename map, 27 Nov 2026 (docs/design/rename-map.md): display names change, ids and server keys don't.
describe('rename map: places and bosses', () => {
  it('shows the new boss names and keeps the ids', () => {
    expect(ENEMIES.maelra.name).toBe('Dowager Bellows');
    expect(ENEMIES.lensmother.name).toBe('The Glass Heir');
    expect(ENEMIES.nhevra.name).toBe('The Banked Queen');
    expect(ENEMIES.kilnMother.name).toBe('The Kiln Mother');
    expect(ENEMIES.vorhulm.name).toBe('Uncle Glut');
    expect(ENEMIES.colossus.name).toBe('The Colossus');
    expect(ENCOUNTERS.ashmaw.name).toBe('The Taster');
    expect(DUNGEONS.hoard.name).toBe('The Strongroom');
  });
  it('keeps the server world-boss keys and maps them to the new names', () => {
    expect(DUNGEONS.hoard.worldBoss).toBe('Old Vorhulm');
    expect(DUNGEONS.smeltery.worldBoss).toBe('The Cinder Colossus');
    expect(worldBossLabel('Old Vorhulm')).toBe('Uncle Glut');
    expect(worldBossLabel('Old Ashmaw')).toBe('Uncle Glut');
    expect(worldBossLabel('The Cinder Colossus')).toBe('The Colossus');
    expect(worldBossLabel('Grandmother Slag')).toBe('Grandmother Slag');
  });
  it('leaves no old boss name in any player-facing name, tip or blurb', () => {
    const old = /Smolderhusk|Maelra|Lensmother|Nhevra|Hessa|Ondrel|Vorhulm|Ysmeret|Oskel|Cinder Colossus/;
    const text = [
      ...Object.values(ENEMIES).map((e) => e.name),
      ...Object.values(ENCOUNTERS).flatMap((e) => [e.name, e.tip]),
      ...Object.values(DUNGEONS).flatMap((d) => [d.name, d.blurb]),
    ];
    expect(text.filter((t) => old.test(t ?? ''))).toEqual([]);
  });
});
