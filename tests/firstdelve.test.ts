import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { FIRST_DELVE, OPENING_LINES, coachLine } from '../sim/content/firstdelve';
import { genTutorial, hallsCheck, mainRooms, doorRoom } from '../sim/halls';
import { botChoose, botInput } from '../sim/bot';
import { KILN_T1 } from '../sim/world';

const inner = (w: World) => w as unknown as { keyHp: number; keyDmg: number };

describe('L1: the first delve', () => {
  it('fixes the teaching route and softens foes in the Kiln at tier 1, solo', () => {
    const w = new World({ seed: 3, dungeon: 'kiln', tier: 1, omens: [], cls: 'duskblade', firstDelve: true });
    expect(w.firstDelve).toBe(true);
    expect(w.route).toEqual(FIRST_DELVE.route);
    expect(inner(w).keyHp).toBeCloseTo(FIRST_DELVE.hp);
    expect(inner(w).keyDmg).toBeCloseTo(FIRST_DELVE.dmg);
  });

  it('offers no forks, so a named gate never replaces a lesson', () => {
    const w = new World({ seed: 3, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright', firstDelve: true });
    const x = w as unknown as { encounter: number; openFork(): void };
    for (let k = 1; k <= 3; k++) {
      x.encounter = k;
      x.openFork();
      expect(w.phase).toBe('intro');
    }
    expect(w.route).toEqual(FIRST_DELVE.route);
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
    // The opening (opening.md): R1 names the first button; R3's red and R5's blue lines come at the moment (client/coach.ts),
    // so those rooms open on an empty line; without F the caster's room says to step out instead.
    for (const id of FIRST_DELVE.route) expect(coachLine(id, 'Quench'), id).toBeDefined();
    expect(coachLine('pack', 'Quench', 'Flame Wave')).toBe('Your attack fires on its own. Tap Flame Wave when they bunch up.');
    expect(coachLine('wardens', 'Quench')).toBe('');
    expect(coachLine('brute', 'Quench')).toBe('');
    expect(coachLine('brute')).toContain('step out');
    expect(coachLine('kilnMother', 'Quench')).toBe('Roll out of the red. Quench her blue cast.');
    expect(OPENING_LINES.quench('Quench')).toBe('A blue bar is a cast. Tap Quench, the blue button, to stop it.');
    expect(coachLine('maelra', 'Kick')).toBeUndefined();
  });

  it('is room to room on its own small map: four round rooms in a line, one fight each, and the door guard last', () => {
    const w = new World({ seed: 3, dungeon: 'kiln', tier: 1, omens: [], cls: 'lumen', firstDelve: true, halls: true });
    const m = w.halls!;
    expect(m).not.toBeNull();
    expect(m.rooms.map((r) => r.id)).toEqual(['R0', 'R1', 'R3', 'R5', 'door']);
    expect(m.rooms.every((r) => r.shape === 'round')).toBe(true);
    expect(m.packs.map((p) => `${p.role}:${p.enc}`)).toEqual(['A:pack', 'B:wardens', 'C:brute']);
    // Three hounds, one slammer, one caster, and none of them trash.
    expect(m.packs.map((p) => p.foes.map((f) => f.kind).join(','))).toEqual(['cinderhound,cinderhound,cinderhound', 'husk', 'cinderBrute']);
    expect(m.packs.some((p) => p.trash)).toBe(false);
    expect(m.packs.find((p) => p.guard)?.role).toBe('C');
    expect(m.layoutRooms).toEqual([]);
    expect(mainRooms(m)).toEqual([0, 1, 2, 3, 4]);
    expect(doorRoom(m)).toBe(4);
    // The same for every seed, and it passes design's map checker.
    expect(new World({ seed: 99, dungeon: 'kiln', tier: 1, omens: [], cls: 'bulwark', firstDelve: true, halls: true }).halls!.rooms.map((r) => [r.x, r.y, r.r])).toEqual(m.rooms.map((r) => [r.x, r.y, r.r]));
    const g = genTutorial();
    expect(hallsCheck({ rooms: g.rooms, corridors: g.corridors, door: g.door, packs: g.spots, layoutRooms: g.layoutRooms })).toEqual([]);
  });

  it('a bot clears it and beats the shortened Kiln Mother', () => {
    const w = new World({ seed: 5, dungeon: 'kiln', tier: 1, omens: [], cls: 'emberwright', firstDelve: true, halls: true, unlockLevel: 1 });
    while (w.state !== 'ended' && w.time < 400) {
      if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
      w.step(botInput(w));
    }
    expect(w.summary().victory).toBe(true);
    expect(w.halls!.done).toBe(true);
  });

  it('the Kiln Mother is shorter at Kiln tier 1 only', () => {
    const boss = (opts: Partial<ConstructorParameters<typeof World>[0]>) => {
      const w = new World({ seed: 3, dungeon: 'kiln', omens: [], cls: 'emberwright', ...opts });
      const x = w as unknown as { spawn(k: string, x: number, y: number): number; enemies: { maxHp: number }[] };
      return x.enemies[x.spawn('kilnMother', 0, 0)].maxHp;
    };
    const t1 = boss({ tier: 1 }), t2 = boss({ tier: 2 });
    expect(t1).toBeCloseTo(3800 * KILN_T1.bossHp);
    expect(t2).toBeCloseTo(3800 * 1.22);
    expect(boss({ tier: 1, firstDelve: true })).toBeCloseTo(3800 * FIRST_DELVE.hp * FIRST_DELVE.bossHp);
  });
});
