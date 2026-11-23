import { describe, expect, it } from 'vitest';
import { BALLAST, DIMHORN, LAMPEYE } from '../sim/world';
import { SIM } from '../client/hd2d/simconsts';

// The 3D renderer copies these instead of importing sim/world.ts (bundle size, see client/hd2d/simconsts.ts).
describe('3D view sim constants', () => {
  it('match sim/world.ts', () => {
    expect(SIM.ballastPlant).toBe(BALLAST.plantDelay);
    expect(SIM.lampeyeFull).toBe(LAMPEYE.full);
    expect(SIM.dimhornCall).toBe(DIMHORN.callAt);
  });
});
