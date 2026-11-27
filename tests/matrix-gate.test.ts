// The fight-budget and 60%-floor gate's rules (tools/matrix.ts, docs/design/fight-budgets.md), on made-up cells.
import { describe, expect, it } from 'vitest';
import { Cell, gate } from '../tools/matrix';

const cell = (cls: Cell['cls'], wins: number, boss: number | null, trash = 20): Cell => ({
  place: 'kiln', tier: 1, cls, seeds: 10, wins,
  median: { trash, named: 35, boss }, n: { trash: 4, named: 2, boss: wins }, delve: 400,
});

describe('fight-budget gate', () => {
  const base = [cell('emberwright', 10, 80), cell('lumen', 8, 120), cell('bulwark', 4, 70)];
  it('passes the baseline against itself', () => expect(gate(base, base)).toEqual([]));
  it('fails a cell pushed over a ceiling it was inside', () => {
    const f = gate([cell('emberwright', 10, 95), base[1], base[2]], base);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatch(/emberwright boss: median 95 s is over the 90 s/);
  });
  it('lets a cell already over budget move by up to 10%, not more', () => {
    expect(gate([base[0], cell('lumen', 8, 132), base[2]], base)).toEqual([]);
    expect(gate([base[0], cell('lumen', 8, 133), base[2]], base)[0]).toMatch(/lumen boss: .* more than 10% slower/);
  });
  it('fails a class dropping under the 60% floor', () => {
    expect(gate([base[0], cell('lumen', 5, 120), base[2]], base)[0]).toMatch(/lumen floor: wins 5\/10 are 50%/);
  });
  it('lets a class already under the floor slip by 0.1 at most', () => {
    expect(gate([base[0], base[1], cell('bulwark', 3, 70)], base)).toEqual([]);
    expect(gate([base[0], base[1], cell('bulwark', 2, 70)], base)[0]).toMatch(/bulwark floor: already under, fell from 40% to 20%/);
  });
  it('reads the floor against the best class now: a better best class can sink the others', () => {
    const b = [cell('emberwright', 6, 80), cell('lumen', 4, 80)];
    expect(gate([cell('emberwright', 10, 80), cell('lumen', 4, 80)], b)[0]).toMatch(/lumen floor/);
  });
});
