import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { render, recipeLength } from '../client/audio/synth';
import { SOUNDS } from '../client/audio/sounds';
import { PRIORITY, ROOM_LIFE, roomCues, THROTTLE, type RoomSound } from '../client/audio/cues';

const drip: RoomSound = { kind: 'drip', x: 0, y: 0 };
const chain: RoomSound = { kind: 'chain', x: 0, y: 0 };
const half = () => 0.5;

describe('3D room life and foe lunges (visuals PR #602)', () => {
  it('the three sounds are short, quiet and ordinary (never a warning)', () => {
    for (const id of ['roomDrip', 'roomChain', 'lungeHit'] as const) {
      expect(recipeLength(SOUNDS[id])).toBeLessThan(0.5);
      const s = render(SOUNDS[id], 22050);
      expect(Math.max(...s.map(Math.abs))).toBeLessThanOrEqual(1);
      expect(PRIORITY.has(id)).toBe(false);
    }
    expect(THROTTLE.lungeHit).toBeGreaterThan(0);
  });

  it('a drip and a chain are heard only now and then, each with its own gap', () => {
    const st = { drip: 0, chain: 0 };
    const at = (t: number) => roomCues(st, [drip, chain, drip], { t }, half).map((c) => c.id);
    // One of each, not two drips in one tick.
    expect(at(1)).toEqual(['roomDrip', 'roomChain']);
    const dripGap = ROOM_LIFE.drip[0] + 0.5 * (ROOM_LIFE.drip[1] - ROOM_LIFE.drip[0]);
    const chainGap = ROOM_LIFE.chain[0] + 0.5 * (ROOM_LIFE.chain[1] - ROOM_LIFE.chain[0]);
    expect(st.drip).toBeCloseTo(1 + dripGap, 5);
    expect(st.chain).toBeCloseTo(1 + chainGap, 5);
    expect(at(1 + dripGap - 0.01)).toEqual([]);
    expect(at(1 + dripGap)).toEqual(['roomDrip']);
    expect(at(1 + chainGap)).toEqual(['roomDrip', 'roomChain']);
  });

  it('a boss fight keeps the room quiet but not the lunges', () => {
    const st = { drip: 0, chain: 0 };
    const lunge: RoomSound = { kind: 'lunge', x: 0, y: 0, melee: true, rank: 'boss' };
    expect(roomCues(st, [drip, chain, lunge], { t: 5, boss: 'kilnMother' }, half)).toEqual([{ id: 'lungeHit', vol: ROOM_LIFE.lunge.boss, jitter: 0.12, pan: 0 }]);
  });

  it('only a melee lunge sounds (a shot or boss move keeps its own cue), louder for bigger foes', () => {
    const st = { drip: 0, chain: 0 };
    const vols = roomCues(st, [
      { kind: 'lunge', x: 0, y: 0, melee: false, rank: 'elite' },
      { kind: 'lunge', x: 0, y: 0, melee: true, rank: 'normal' },
      { kind: 'lunge', x: 0, y: 0, melee: true, rank: 'elite' },
    ], { t: 2 }, half).map((c) => c.vol);
    expect(vols).toEqual([ROOM_LIFE.lunge.normal, ROOM_LIFE.lunge.elite]);
    expect(ROOM_LIFE.lunge.normal).toBeLessThan(ROOM_LIFE.lunge.elite);
  });

  it('pans from where the sound shows on screen in 3D', () => {
    const st = { drip: 0, chain: 0 };
    // A fake 3D view: screen x is world x / 2 + 200, half-width 200.
    const listen = { x: 0, y: 0, half: 300, screen: (x: number) => ({ x: x / 2 + 200, y: 0 }), screenHalf: 200 };
    const [c] = roomCues(st, [{ kind: 'drip', x: 200, y: 50 }], { t: 3, listen }, half);
    expect(c.pan).toBeCloseTo(0.5 * ROOM_LIFE.pan, 5);
  });

  it('a new run restarts the clocks', () => {
    const st = { drip: 900, chain: 900 };
    expect(roomCues(st, [drip], { t: 1 }, half).map((c) => c.id)).toEqual(['roomDrip']);
  });

  it('the renderer reports drips as they land and chains at the end of a sway, and busycheck knows the same rooms', () => {
    const src = readFileSync('client/hd2d/renderer.ts', 'utf8');
    expect(src).toContain("heard.push({ kind: 'drip', x, z })");
    expect(src).toContain("heard.push({ kind: 'chain', x: g.position.x, z: g.position.z })");
    expect(src).toContain("sfx.push({ kind: 'lunge', x: e.x, y: e.y, melee: e.touchCd > fa.touch + 0.05, rank: e.def.rank })");
    const list = (re: RegExp, s: string) => [...(s.match(re)?.[1].matchAll(/'(\w+)'/g) ?? [])].map((m) => m[1]).sort();
    const forge = list(/const forge = ([^;]+);/, src), wet = list(/const wet = ([^;]+);/, src);
    expect(forge.length).toBeGreaterThan(0);
    expect(wet.length).toBeGreaterThan(0);
    const busy = readFileSync('tools/busycheck.ts', 'utf8');
    expect(list(/const FORGE = new Set<string>\(\[([^\]]+)\]/, busy)).toEqual(forge);
    expect(list(/const WET = new Set<string>\(\[([^\]]+)\]/, busy)).toEqual(wet);
  });
});
