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
} as const;
