import { describe, expect, it } from 'vitest';
import { CLASSES } from '../sim/content/classes';

// Rename map, 27 Nov 2026 (docs/design/rename-map.md section 3): display names change, ids don't.
describe('rename map: classes', () => {
  it('calls the duskblade class Cutwick and keeps its id', () => {
    expect(CLASSES.duskblade.id).toBe('duskblade');
    expect(CLASSES.duskblade.name).toBe('Cutwick');
  });
  it("calls the Lumen's resource Oil", () => {
    expect(CLASSES.lumen.resource).toBe('Oil');
  });
});
