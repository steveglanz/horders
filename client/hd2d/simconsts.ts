/**
 * Sim numbers the 3D view needs, copied rather than imported: importing them from sim/world.ts pulls ~14 kB
 * (~5 kB gzipped) of the sim into dist/hd2d.js (measured 23 Nov: 660.47 -> 674.23 kB). tests/hd2dconsts.test.ts
 * fails if any copy drifts from sim/world.ts, so a retune can't go out of sync unnoticed.
 */
export const SIM = {
  /** BALLAST.plantDelay: seconds in reach before the Ballast drops anchor. */
  ballastPlant: 0.8,
  /** LAMPEYE.full: the Lampeye's gaze at which it starts its Searing Look. */
  lampeyeFull: 6,
  /** DIMHORN.callAt: seconds in the dark before the Dimhorn sounds its Dark Call. */
  dimhornCall: 7,
  /** OVERFLOW.safeR: how far from Grandmother Slag the Overflow leaves dry floor. */
  overflowSafeR: 190,
  /** OVERFLOW.warn: seconds the Overflow warns before it rises. */
  overflowWarn: 2.5,
  /** HALLS.corridor (sim/halls.ts): corridor width on a Halls map. */
  hallsCorridor: 160,
  /** HALLS.reach: a sleeping pack wakes when a hero steps this close; its red ring's radius. */
  hallsReach: 200,
  /** HALLS.showRing: the ring shows only with a hero this close. */
  hallsShowRing: 400,
  /** DOOR_ROOM: the room index of the boss door's alcove. */
  hallsDoorRoom: 6,
  /** ONDRELV2.r: the radius of a burning slag patch. */
  ondrelSlagR: 80,
  /** ONDRELV2.burstR: a patch's burst radius in the last heat. */
  ondrelBurstR: 110,
  /** ONDRELV2.glow: seconds a patch glows before it bursts. */
  ondrelGlow: 2.5,
} as const;
