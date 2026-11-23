import { describe, expect, it } from 'vitest';
import { World, KILN_VARIANTS, MAELRA_VARIANTS, LENS_VARIANTS, NHEVRA_VARIANTS, HESSA_VARIANTS, ONDREL_VARIANTS, YSMERET_VARIANTS, OSKEL_VARIANTS, SLAG_VARIANTS, VORHULM_VARIANTS, COLOSSUS_VARIANTS, REGENT_VARIANTS } from '../sim/world';
import { BOSS_VERSION_NAME, runShape } from '../sim/runshape';
import { HEATS } from '../sim/content/heat';
import { applySnapshot, snapshot } from '../sim/netsync';

const kiln = (seed: number) => new World({ seed, dungeon: 'kiln', tier: 3, omens: [], cls: 'emberwright' });

describe('Phase 14 X4: this run\'s shape', () => {
  it('lists the route, and every rolled floor the route has, without touching the run', () => {
    let floored = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const w = kiln(seed);
      const before = w.hash();
      const shape = runShape(w);
      expect(w.hash()).toBe(before);
      const fights = w.route.filter((id) => id !== 'worldShadow');
      expect(shape[0]).toMatchObject({ kind: 'route', label: `Route: ${fights.length} fights` });
      const rolled = fights.filter((id, k) => w.layoutAt(k, id) !== 'open').length;
      const floor = shape.find((c) => c.kind === 'floor');
      if (!rolled) { expect(floor).toBeUndefined(); continue; }
      floored++;
      const n = [...floor!.label.matchAll(/(\d+) /g)].reduce((a, m) => a + Number(m[1]), 0);
      expect(n).toBe(rolled);
    }
    expect(floored).toBeGreaterThan(10);
  });

  it('names the boss version only once the boss has rolled one, and every version has a name', () => {
    const w = kiln(7);
    expect(runShape(w).some((c) => c.kind === 'boss')).toBe(false);
    w.bossVariant = 'draw';
    expect(runShape(w).find((c) => c.kind === 'boss')?.label).toBe('Boss: Kiln Draw');
    const all = [KILN_VARIANTS, MAELRA_VARIANTS, LENS_VARIANTS, NHEVRA_VARIANTS, HESSA_VARIANTS, ONDREL_VARIANTS, YSMERET_VARIANTS, OSKEL_VARIANTS, SLAG_VARIANTS, VORHULM_VARIANTS, COLOSSUS_VARIANTS, REGENT_VARIANTS].flat();
    for (const v of all) expect(BOSS_VERSION_NAME[v], v).toBeTruthy();
  });

  it('shows Today\'s Heat by name with its text as the tip', () => {
    const w = kiln(9);
    w.heat = 'richHaul';
    expect(runShape(w).find((c) => c.kind === 'heat')).toEqual({ kind: 'heat', label: `Heat: ${HEATS.richHaul.name}`, tip: HEATS.richHaul.text });
  });

  it('leaves out the world boss shadow, a bonus fight, from the route', () => {
    const w = kiln(11);
    const n = w.route.filter((id) => id !== 'worldShadow').length;
    w.route = [...w.route, 'worldShadow'];
    expect(runShape(w)[0].label).toBe(`Route: ${n} fights`);
  });

  it('a co-op guest\'s end screen shows the host\'s shape', () => {
    const w = new World({ seed: 21, dungeon: 'kiln', tier: 3, omens: [], cls: 'emberwright', party: [{ cls: 'lumen', name: 'Lumen' }] });
    w.bossVariant = 'cataclysm';
    w.heat = 'quickStudy';
    const g = new World({ seed: 99, dungeon: 'kiln', tier: 3, omens: [], cls: 'lumen', party: [{ cls: 'emberwright', name: 'Emberwright' }] });
    applySnapshot(g, JSON.parse(JSON.stringify(snapshot(w))), 1);
    expect(runShape(g)).toEqual(runShape(w));
    expect(runShape(g).map((c) => c.kind)).toContain('boss');
  });
});
