import { describe, expect, it } from 'vitest';
import { render } from '../client/audio/synth';
import { SOUNDS, type SoundId } from '../client/audio/sounds';
import { cueFor, type CueContext } from '../client/audio/cues';
import { ALT_OPTIONS } from '../sim/content/classes';
import type { ClassId } from '../sim/content/emberwright';
import type { SimEvent } from '../sim/world';
import { phoneShare } from '../tools/mixcheck';
import { soundDistance } from '../tools/sfxdistance';

const R = 22050;
const CLASSES = Object.keys(ALT_OPTIONS) as ClassId[];
const ctx = (cls: ClassId): CueContext => ({ cls, acting: 0 });
const ability = (slot: number, alt: boolean): SimEvent => ({ type: 'ability', slot, x: 0, y: 0, angle: 0, r: 40, ...(alt ? { alt: true } : {}) });
const idOf = (ev: SimEvent, cls: ClassId): SoundId | undefined => cueFor(ev, ctx(cls))?.id;
/** Every sound a class's own buttons and moves can make (its abilities by slot, its dash or blink, the gunner's shot and plating). */
function classSounds(cls: ClassId): SoundId[] {
  const evs: SimEvent[] = [0, 1, 2, 3].map((s) => ability(s, false));
  evs.push({ type: 'dash', x1: 0, y1: 0, x2: 1, y2: 0, dodge: false }, { type: 'dash', x1: 0, y1: 0, x2: 1, y2: 0, dodge: true }, { type: 'blink', x1: 0, y1: 0, x2: 1, y2: 0 });
  if (cls === 'slagbinder') evs.push({ type: 'cannon', x1: 0, y1: 0, x2: 1, y2: 0 } as SimEvent, { type: 'plate', hero: 0, x: 0, y: 0 } as SimEvent);
  return [...new Set(evs.map((e) => idOf(e, cls)).filter((x): x is SoundId => !!x))];
}
const pcm = (id: SoundId) => render(SOUNDS[id], R);
/** Below this two of a class's sounds are too alike on a phone (the closest old pair, Dash and Sidestep, scores 0.21). */
const BAR = 0.22;

describe('ability option and cannon sounds (1.0 M4, 26 Nov)', () => {
  it('gives every ability option a sound of its own, never a borrowed one', () => {
    const seen = new Map<SoundId, string>();
    for (const cls of CLASSES) {
      const own = classSounds(cls);
      for (const o of ALT_OPTIONS[cls]) {
        const id = idOf(ability(o.slot, true), cls)!;
        expect(id, o.id).toBeDefined();
        expect(id, o.id).not.toBe('zap');
        expect(own, `${o.id} borrows a ${cls} sound`).not.toContain(id);
        expect(seen.get(id), `${o.id} shares ${id}`).toBeUndefined();
        seen.set(id, o.id);
      }
    }
  });

  it('makes each option sound clearly unlike every other sound its class plays, on a phone', () => {
    for (const cls of CLASSES) {
      const opts = ALT_OPTIONS[cls].map((o) => idOf(ability(o.slot, true), cls)!);
      const all = [...new Set([...classSounds(cls), ...opts])];
      for (const a of opts) for (const b of all) if (a !== b) {
        const d = soundDistance(pcm(a), pcm(b), R);
        expect(d, `${cls}: ${a} vs ${b} ${d.toFixed(3)}`).toBeGreaterThan(BAR);
      }
    }
  });

  it('fires the gunner\'s Cannon as its own heavy shot, not the Slag Lob, short and heard on a phone', () => {
    const id = idOf({ type: 'cannon', x1: 0, y1: 0, x2: 1, y2: 0 } as SimEvent, 'slagbinder');
    expect(id).toBe('cannonShot');
    const x = pcm('cannonShot');
    // A shot every 1.6 s: it must be over well before the next one.
    expect(x.length / R).toBeLessThan(0.6);
    expect(phoneShare(x, R)).toBeGreaterThan(0.3);
    for (const b of classSounds('slagbinder')) if (b !== 'cannonShot') expect(soundDistance(x, pcm(b), R), b).toBeGreaterThan(BAR);
  });
});
