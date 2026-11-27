import { describe, expect, it } from 'vitest';
import { ENCOUNTERS } from '../sim/content/dungeon';
import { HELP } from '../sim/content/help';
import { SEEN_KIND_NAME } from '../sim/seen';

// Rename map, 27 Nov 2026 (docs/design/rename-map.md section 4): display names change, ids don't.
describe('rename map: systems', () => {
  it('calls the rest room the Delver\'s Rest and keeps its id', () => {
    expect(ENCOUNTERS.shrine.id).toBe('shrine');
    expect(ENCOUNTERS.shrine.name).toBe("Delver's Rest");
  });
  it('names Old Tricks, the Hoard stirring and the Court\'s Mood in the Seen list', () => {
    expect(SEEN_KIND_NAME.echo).toBe('Old Tricks');
    expect(SEEN_KIND_NAME.stir).toBe('The Hoard stirs');
    expect(SEEN_KIND_NAME.heat).toBe("The Court's Moods");
  });
  it('calls the in-run cards Sparks and keeps "talent" for the tree', () => {
    expect(HELP.runTalents).toContain('Sparks');
    expect(HELP.runTalents).not.toMatch(/talent card/i);
    expect(HELP.cardNumbers).not.toMatch(/talent/i);
    expect(HELP.heroTalents).toContain('talent tree');
  });
});
