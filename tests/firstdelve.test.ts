import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { FIRST_DELVE, coachLine } from '../sim/content/firstdelve';

const inner = (w: World) => w as unknown as { keyHp: number; keyDmg: number };

describe('L1: the first delve', () => {
  it('fixes the teaching route and softens foes in the Kiln at tier 1, solo', () => {
    const w = new World({ seed: 3, dungeon: 'kiln', tier: 1, omens: [], cls: 'duskblade', firstDelve: true });
    expect(w.firstDelve).toBe(true);
    expect(w.route).toEqual(FIRST_DELVE.route);
    expect(inner(w).keyHp).toBeCloseTo(FIRST_DELVE.hp);
    expect(inner(w).keyDmg).toBeCloseTo(FIRST_DELVE.dmg);
  });

  it('does nothing anywhere else: another tier, dungeon, a bounty or a party', () => {
    const cases = [
      { tier: 2 },
      { dungeon: 'foundry' as const, tier: 1 },
      { tier: 1, bounty: 20000 },
      { tier: 1, party: [{ cls: 'lumen' as const }] },
    ];
    for (const c of cases) {
      const w = new World({ seed: 3, dungeon: 'kiln', omens: [], cls: 'emberwright', firstDelve: true, ...c });
      expect(w.firstDelve).toBe(false);
      expect(inner(w).keyDmg).toBe(1);
    }
  });

  it('a plain first-tier run is unchanged by the option being off', () => {
    const a = new World({ seed: 9, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright' });
    const b = new World({ seed: 9, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright', firstDelve: false });
    expect(a.route).toEqual(b.route);
  });

  it('coaches every fight on the route, naming the hero\'s interrupt where it matters', () => {
    for (const id of FIRST_DELVE.route) expect(coachLine(id, 'Kick'), id).toBeTruthy();
    expect(coachLine('brute', 'Kick')).toContain('Kick');
    expect(coachLine('kilnMother', 'Hush')).toContain('Hush');
    expect(coachLine('maelra', 'Kick')).toBeUndefined();
  });
});
