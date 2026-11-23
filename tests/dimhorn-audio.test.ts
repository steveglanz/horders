import { describe, expect, it } from 'vitest';
import { World, DIMHORN } from '../sim/world';
import { cueFor, CAST_SOUNDS, PRIORITY } from '../client/audio/cues';
import { SOUNDS } from '../client/audio/sounds';
import { recipeLength } from '../client/audio/synth';

type Inner = { spawn(kind: string, x: number, y: number): number; route: string[] };

/** A Coldmarrow run already in its first fight (the Dimhorn's), as tests/dimhorn.test.ts does. */
function fight() {
  const w = new World({ seed: 3, dungeon: 'coldmarrow', tier: 10, omens: [], cls: 'emberwright' });
  const inner = w as unknown as Inner;
  inner.route[0] = 'dimhorn';
  for (const e of w.enemies) e.alive = false;
  (w as unknown as { phase: string }).phase = 'fight';
  w.player.x = 0; w.player.y = 0;
  w.player.coal = 1; w.player.coalR = 170;
  w.player.hp = w.player.maxHp = 1e9;
  return { w, inner };
}
/** The cue ids heard over n ticks (none of the hero's own attack sounds). */
function listen(w: World, n: number): string[] {
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    w.step({ x: 0, y: 0 });
    for (const ev of w.events) {
      const c = cueFor(ev, { cls: w.cls, acting: w.acting });
      if (c && /^dimhorn|^reinforce|^castDone$/.test(c.id)) out.push(c.id);
    }
  }
  return out;
}

describe('Sound for the Dimhorn (Phase 16 U2)', () => {
  it('Dark Call warns with its own horn, must-hear and inside the cast; Silenced is ordinary', () => {
    expect(CAST_SOUNDS.darkCall.start).toBe('dimhornCall');
    expect(PRIORITY.has('dimhornCall')).toBe(true);
    expect(recipeLength(SOUNDS.dimhornCall)).toBeLessThan(DIMHORN.callCast);
    expect(CAST_SOUNDS.darkCallLost.done).toBe('dimhornSilenced');
    expect(PRIORITY.has('dimhornSilenced')).toBe(false);
  });

  it('a call that lands: the horn, then the pack arriving (no cast click)', () => {
    const { w, inner } = fight();
    const e = w.enemies[inner.spawn('dimhorn', 300, 0)];
    e.aux = DIMHORN.callAt - 0.05;
    expect(listen(w, Math.ceil(DIMHORN.callCast * 30) + 6)).toEqual(['dimhornCall', 'reinforceLand']);
  });

  it('a call silenced in the light: the horn, then the choked note, and no pack', () => {
    const { w, inner } = fight();
    const e = w.enemies[inner.spawn('dimhorn', 300, 0)];
    e.def = { ...e.def, speed: 0 };
    e.aux = DIMHORN.callAt - 0.05;
    const heard = listen(w, 3);
    // Mid-call, the hero brings the light over it.
    w.player.x = 280;
    heard.push(...listen(w, Math.ceil(DIMHORN.callCast * 30) + 6));
    expect(heard).toEqual(['dimhornCall', 'dimhornSilenced']);
  });
});
