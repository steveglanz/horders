/**
 * The camera rule (vision v2, Checkpoint 2, pillar 4 "big in the hand"): your hero stands 70 to 80 px tall on a
 * 390x844 phone. Before this, a Halls room zoomed out until the whole room fit, which shrank the hero to about 39 px
 * (tools/heroheight.cjs, 27 Nov). Now a room may zoom out only while the hero stays at least HERO_MIN_PX tall; foes
 * left outside the view get edge arrows instead (GameScene.foeEdgeMarks3d).
 */
export const HERO_MIN_PX = 70;

/** The room fit's ceiling: how far the camera may pull back given the hero's height (CSS px) at zoom 1. */
export function zoomCap(heroPxAtOne: number): number {
  if (!(heroPxAtOne > 0)) return 1;
  return Math.max(1, heroPxAtOne / HERO_MIN_PX);
}

/** The Halls room fit (client/hallsview.ts): zoom out to show the room, up to 2x and never past the cap. */
export function roomZoom(roomR: number, view: number, cap: number): number {
  return Math.max(1, Math.min(2, cap, (2 * (roomR + 40)) / view));
}
