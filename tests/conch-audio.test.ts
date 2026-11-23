import { describe, expect, it } from 'vitest';
import { World, CONCH } from '../sim/world';
import { cueFor, CAST_SOUNDS, PRIORITY } from '../client/audio/cues';
import { SOUNDS } from '../client/audio/sounds';
import { recipeLength } from '../client/audio/synth';

type Inner = { spawn(kind: string, x: number, y: number): number; route: string[] };

/** A Wrackline run already in its first fight (the Conchblower's), as tests/conchblower.test.ts does. */
function fight() {
  const w = new World({ seed: 3, dungeon: 'wrackline', tier: 10, omens: [], cls: 'emberwright', invulnerable: true });
  const inner = w as unknown as Inner;
  inner.route[0] = 'conch';
  for (const e of w.enemies) e.alive = false;
  (w as unknown as { phase: string }).phase = 'fight';
  w.player.x = 0; w.player.y = 0;
  return { w, inner };
}

describe('Sound for the Conchblower (Phase 16 U2)', () => {
  it('Conch Call warns with its own shell note, must-hear and inside the cast; the blast landing is ordinary', () => {
    expect(CAST_SOUNDS.conchCall.start).toBe('conchWarn');
    expect(PRIORITY.has('conchWarn')).toBe(true);
    expect(recipeLength(SOUNDS.conchWarn)).toBeLessThan(CONCH.cast);
    expect(CAST_SOUNDS.conchBlown.done).toBe('conchSwell');
    expect(PRIORITY.has('conchSwell')).toBe(false);
  });

  it('in a real fight, a call that lands is the shell note, then the swell, with no cast click', () => {
    const { w, inner } = fight();
    const i = inner.spawn('conchblower', 400, 0);
    const e = w.enemies[i];
    e.hp = e.maxHp = 1e9;
    e.abilityT = 0;
    const heard: string[] = [];
    for (let k = 0; k < Math.ceil((CONCH.cast + 0.3) * 30); k++) {
      w.step({ x: 0, y: 0 });
      for (const ev of w.events) {
        const c = cueFor(ev, { cls: w.cls, acting: w.acting });
        if (c && /^conch|^castDone$|^interrupt$/.test(c.id)) heard.push(c.id);
      }
    }
    expect(heard).toEqual(['conchWarn', 'conchSwell']);
  });
});
