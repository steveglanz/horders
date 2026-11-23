import { describe, expect, it } from 'vitest';
import { World, LAMPEYE } from '../sim/world';
import { cueFor, CAST_SOUNDS, GAZE_STEPS, gazeCues, PRIORITY } from '../client/audio/cues';
import { SOUNDS } from '../client/audio/sounds';
import { recipeLength } from '../client/audio/synth';

type Inner = { spawn(kind: string, x: number, y: number): number; route: string[]; pillars: { x: number; y: number; r: number; cracked?: boolean }[] };

/** A Glarewell run already in its first fight (the Lampeye's), every foe cleared, as tests/lampeye.test.ts does. */
function fight() {
  const w = new World({ seed: 3, dungeon: 'glarewell', tier: 4, omens: [], cls: 'emberwright' });
  const inner = w as unknown as Inner;
  inner.route[0] = 'lampeye';
  for (const e of w.enemies) e.alive = false;
  (w as unknown as { phase: string }).phase = 'fight';
  w.player.x = 0; w.player.y = 0;
  return { w, inner };
}

describe('Sound for the Lampeye (Phase 16 U2)', () => {
  it('its gaze climbs in five rising steps, then Searing Look warns; all are must-hear, and the warning ends inside the cast', () => {
    expect(GAZE_STEPS.length).toBe(LAMPEYE.full - 1);
    for (const id of GAZE_STEPS) expect(PRIORITY.has(id)).toBe(true);
    expect(CAST_SOUNDS.searingLook.start).toBe('searingWarn');
    expect(PRIORITY.has('searingWarn')).toBe(true);
    expect(recipeLength(SOUNDS.searingWarn)).toBeLessThan(LAMPEYE.lookCast);
    // Each step is higher than the last (its first partial).
    const f = GAZE_STEPS.map((id) => SOUNDS[id][0].f);
    for (let k = 1; k < f.length; k++) expect(f[k]).toBeGreaterThan(f[k - 1]);
  });

  it('plays each whole second gained while it sees you, silent when it cannot, and again after the gaze falls back', () => {
    const st = { lv: [] as number[] };
    const at = (aux: number, sees = true) => gazeCues(st, [{ aux, sees }])?.id ?? null;
    expect(at(0.5)).toBeNull();
    expect(at(1.0)).toBe('gaze1');
    expect(at(1.6)).toBeNull();
    expect(at(2.1)).toBe('gaze2');
    // Behind a pillar it climbs no further, and falls: a small dip doesn't retrigger.
    expect(at(1.8, false)).toBeNull();
    expect(at(2.05)).toBeNull();
    // A real fall does.
    expect(at(1.2, false)).toBeNull();
    expect(at(2.0)).toBe('gaze2');
    // One that can't see you climbs in silence.
    expect(at(3.0, false)).toBeNull();
    expect(at(4.0)).toBe('gaze4');
    expect(at(5.0)).toBe('gaze5');
    // Full: the cast warning takes over (no sixth step), and after the look the gaze starts over.
    expect(at(6.0)).toBeNull();
    expect(at(0)).toBeNull();
    expect(at(1.0)).toBe('gaze1');
  });

  it('two eyes climbing at once play only the higher step', () => {
    const st = { lv: [] as number[] };
    expect(gazeCues(st, [{ aux: 1, sees: true }, { aux: 3, sees: true }])?.id).toBe('gaze3');
    expect(gazeCues(st, [])).toBeNull();
    expect(st.lv).toEqual([]);
  });

  it('in a real fight: the steps climb in order, then Searing Look warns and its hit lands as a slam', () => {
    const { w, inner } = fight();
    inner.pillars.length = 0;
    const l = inner.spawn('lampeye', 400, 0);
    w.player.hp = w.player.maxHp = 1e9;
    const st = { lv: [] as number[] };
    const heard: string[] = [];
    for (let k = 0; k < Math.ceil((LAMPEYE.full + LAMPEYE.lookCast + 0.3) * 30); k++) {
      w.step({ x: 0, y: 0 });
      const eyes = w.enemies.filter((e) => e.alive && e.kind === 'lampeye').map((e) => ({ aux: e.aux, sees: w.lampeyeSees(e, w.player.x, w.player.y) }));
      const g = gazeCues(st, eyes);
      if (g) heard.push(g.id);
      for (const ev of w.events) {
        const c = cueFor(ev, { cls: w.cls, acting: w.acting });
        if (c && (c.id === 'searingWarn' || (ev.type === 'slam' && ev.r === 40))) heard.push(ev.type === 'slam' ? 'slam' : c.id);
      }
    }
    expect(w.enemies[l].alive).toBe(true);
    expect(heard).toEqual([...GAZE_STEPS, 'searingWarn', 'slam']);
  });
});
