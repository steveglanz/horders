import { describe, expect, it } from 'vitest';
import { BALLAST, DIMHORN, LAMPEYE, ONDRELV2, OSKEL, OVERFLOW, SLAG_KIT } from '../sim/world';
import { SIM } from '../client/hd2d/simconsts';
import { DOOR_ROOM, HALLS } from '../sim/halls';

// The 3D renderer copies these instead of importing sim/world.ts (bundle size, see client/hd2d/simconsts.ts).
describe('3D view sim constants', () => {
  it('match sim/world.ts', () => {
    expect(SIM.cannonRange).toBe(SLAG_KIT.cannonRange);
    expect(SIM.ballastPlant).toBe(BALLAST.plantDelay);
    expect(SIM.lampeyeFull).toBe(LAMPEYE.full);
    expect(SIM.dimhornCall).toBe(DIMHORN.callAt);
    expect(SIM.overflowSafeR).toBe(OVERFLOW.safeR);
    expect(SIM.overflowWarn).toBe(OVERFLOW.warn);
    expect(SIM.hallsCorridor).toBe(HALLS.corridor);
    expect(SIM.hallsReach).toBe(HALLS.reach);
    expect(SIM.hallsShowRing).toBe(HALLS.showRing);
    expect(SIM.hallsDoorRoom).toBe(DOOR_ROOM);
    expect(SIM.ondrelSlagR).toBe(ONDRELV2.r);
    expect(SIM.ondrelBurstR).toBe(ONDRELV2.burstR);
    expect(SIM.ondrelGlow).toBe(ONDRELV2.glow);
    expect(SIM.oskelRivetR).toBe(OSKEL.rivetRadius);
  });
});
