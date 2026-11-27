import { describe, expect, it } from 'vitest';
import { HERO_MIN_PX, roomZoom, zoomCap } from '../client/camera';

// Vision v2 camera rule (CP2): the hero stays 70 to 80 px tall at 390x844, so a room may zoom out only while it
// keeps the hero at HERO_MIN_PX or more (tools/heroheight.cjs measures the real build).
describe('camera rule', () => {
  it('lets the room fit zoom out only while the hero stays at least 70 px tall', () => {
    expect(HERO_MIN_PX).toBe(70);
    // A 390x844 phone at zoom 1 shows the hero about 75 px tall: barely any room to pull back.
    expect(zoomCap(75)).toBeCloseTo(75 / 70);
    expect(75 / zoomCap(75)).toBeGreaterThanOrEqual(HERO_MIN_PX - 1e-9);
    // Already under the floor: never zooms out.
    expect(zoomCap(60)).toBe(1);
    expect(zoomCap(0)).toBe(1);
    expect(zoomCap(Number.NaN)).toBe(1);
  });

  it('fits a big room only as far as the cap allows', () => {
    // Before CP2 a 300-unit room on a 500-unit view zoomed out 1.36x and a big one 2x (hero ~39 px on a phone).
    expect(roomZoom(300, 500, 9)).toBeCloseTo(680 / 500);
    expect(roomZoom(600, 500, 9)).toBe(2);
    expect(roomZoom(600, 500, 1.07)).toBeCloseTo(1.07);
    expect(roomZoom(100, 500, 1.07)).toBe(1);
  });
});
