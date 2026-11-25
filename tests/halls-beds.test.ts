import { describe, expect, it } from 'vitest';
import { bedSamples, ROOM_BED_FADE, ROOM_BED_VOL, ROOM_BEDS, THEMES } from '../client/audio/music';
import { phoneShare } from '../tools/mixcheck';
import { readFileSync } from 'node:fs';
import { World } from '../sim/world';
import { DOOR_ROOM } from '../sim/halls';
import { ROOM_THEME_BED, roomBedFor } from '../client/audio/cues';

const R = 24000;
/** Energy share per band above 150 Hz (the part a phone plays): 150-400, 400-1k, 1k-2.5k, 2.5k-6k, 6k+. */
function profile(x: Float32Array): number[] {
  const cuts = [150, 400, 1000, 2500, 6000];
  const lows = cuts.map(() => 0), e = new Array(cuts.length).fill(0);
  const a = cuts.map((c) => 1 - Math.exp((-2 * Math.PI * c) / R));
  for (let i = 0; i < x.length; i++) {
    for (let k = 0; k < cuts.length; k++) lows[k] += (x[i] - lows[k]) * a[k];
    for (let k = 1; k < cuts.length; k++) e[k - 1] += (lows[k] - lows[k - 1]) ** 2;
    e[cuts.length - 1] += (x[i] - lows[cuts.length - 1]) ** 2;
  }
  const tot = e.reduce((p, q) => p + q, 0);
  return e.map((v) => v / tot);
}
/** How much a bed moves: the spread of its loudness in quarter-second windows, relative to its mean. */
function motion(x: Float32Array): number {
  const w = R / 4, r: number[] = [];
  for (let i = 0; i + w <= x.length; i += w) { let s = 0; for (let j = 0; j < w; j++) s += x[i + j] ** 2; r.push(Math.sqrt(s / w)); }
  const m = r.reduce((p, q) => p + q) / r.length;
  return Math.sqrt(r.reduce((p, q) => p + (q - m) ** 2, 0) / r.length) / m;
}

describe('Halls room beds (visuals\' five room themes, 25 Nov)', () => {
  const beds = Object.fromEntries(ROOM_BEDS.map((k) => [k, bedSamples(k, R)]));

  it('one bed per theme, each a clean loop a phone can play', () => {
    expect([...ROOM_BEDS]).toEqual(['ashStore', 'bellowsHall', 'slagChannel', 'coolingYard', 'kilnShrine', 'boilerRoom', 'cistern', 'pumpHall', 'anchorStore', 'lensGallery', 'starVault', 'shadeColonnade', 'mirrorHall', 'deadHearth', 'rimeHall', 'snowdriftCave', 'coldCrypt', 'harbourQuay', 'wreckYard', 'kelpBed', 'sluiceGate', 'anvilHall', 'chainGallery', 'quenchTrough', 'ingotStore']);
    for (const k of ROOM_BEDS) {
      const x = beds[k];
      expect(x.every(Number.isFinite), k).toBe(true);
      expect(x.reduce((p, v) => Math.max(p, Math.abs(v)), 0), k).toBeLessThanOrEqual(1);
      expect(phoneShare(x, R), k).toBeGreaterThan(0.25);
      // The loop's seam: the jump from the last sample to the first is no bigger than the bed's own sample-to-sample jumps
      // (the tail is crossfaded over the head). A quiet, noisy bed is normalised up, so its steps are large everywhere.
      let big = 0;
      for (let i = 1; i < x.length; i++) big = Math.max(big, Math.abs(x[i] - x[i - 1]));
      expect(Math.abs(x[x.length - 1] - x[0]), k).toBeLessThanOrEqual(big);
    }
  });

  // The beds a delve can play: each dungeon's own themes plus the shrine side room (Kiln; Drowned Foundry, H3a).
  const SETS = {
    kiln: ['ashStore', 'bellowsHall', 'slagChannel', 'coolingYard', 'kilnShrine'],
    foundry: ['boilerRoom', 'cistern', 'pumpHall', 'anchorStore', 'kilnShrine'],
    glarewell: ['lensGallery', 'starVault', 'shadeColonnade', 'mirrorHall', 'kilnShrine'],
    coldmarrow: ['deadHearth', 'rimeHall', 'snowdriftCave', 'coldCrypt', 'kilnShrine'],
    wrackline: ['harbourQuay', 'wreckYard', 'kelpBed', 'sluiceGate', 'kilnShrine'],
    hammerdeep: ['anvilHall', 'chainGallery', 'quenchTrough', 'ingotStore', 'kilnShrine'],
  } as const;

  it('within one dungeon, every room bed sounds different from the others on a phone', () => {
    for (const [dg, set] of Object.entries(SETS)) for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) {
      const a = profile(beds[set[i]]), b = profile(beds[set[j]]);
      const d = Math.sqrt(a.reduce((s, v, k) => s + (v - b[k]) ** 2, 0));
      const dm = Math.abs(motion(beds[set[i]]) - motion(beds[set[j]]));
      // Either the colour or the motion tells them apart.
      expect(d + dm, `${dg}: ${set[i]} vs ${set[j]}`).toBeGreaterThan(0.15);
    }
    expect([...new Set(Object.values(SETS).flat())].sort()).toEqual([...ROOM_BEDS].sort());
  });

  it('each keeps its room\'s one quiet motion: the bellows breathe and the steam puffs; ash and candle stay still', () => {
    const m = (k: (typeof ROOM_BEDS)[number]) => motion(beds[k]);
    for (const busy of ['bellowsHall', 'coolingYard'] as const) for (const still of ['ashStore', 'kilnShrine'] as const) expect(m(busy)).toBeGreaterThan(m(still));
    // The Foundry: the boiler puffs, the cistern's light swells, the pumps stroke; the anchor store doesn't move at all.
    for (const busy of ['boilerRoom', 'cistern', 'pumpHall'] as const) expect(m(busy)).toBeGreaterThan(2 * m('anchorStore'));
    expect(m('anchorStore')).toBeLessThan(m('kilnShrine'));
    // The Glarewell: the lens light swells and the orreries tick round; the colonnade and the mirrors stay still.
    for (const busy of ['lensGallery', 'starVault'] as const) for (const still of ['shadeColonnade', 'mirrorHall'] as const) expect(m(busy)).toBeGreaterThan(m(still));
    // The Coldmarrow: the dead flue draws, the rime shimmers, the drift gusts; the crypt is the stillest of them.
    for (const busy of ['deadHearth', 'rimeHall', 'snowdriftCave'] as const) expect(m(busy)).toBeGreaterThan(2 * m('coldCrypt'));
    // The Wrackline: the hulls creak and the kelp sways; the quay laps gently and the sluice pours steadily.
    for (const busy of ['wreckYard', 'kelpBed'] as const) for (const still of ['harbourQuay', 'sluiceGate'] as const) expect(m(busy)).toBeGreaterThan(2 * m(still));
    // The Hammerdeep: the lanterns breathe, the chains swing, the steam lifts; the ingot store is still.
    for (const busy of ['anvilHall', 'chainGallery', 'quenchTrough'] as const) expect(m(busy)).toBeGreaterThan(2 * m('ingotStore'));
  });

  it('sits under every dungeon theme\'s own bed and fades between rooms in a stride or two', () => {
    for (const th of Object.values(THEMES)) expect(ROOM_BED_VOL).toBeLessThan(th.bedVol);
    expect(ROOM_BED_FADE).toBeGreaterThanOrEqual(1);
    expect(ROOM_BED_FADE).toBeLessThanOrEqual(2);
  });
});

describe('which room bed plays where (roomBedFor)', () => {
  const w = new World({ seed: 3, tier: 2, halls: true, cls: 'emberwright' });
  const m = w.halls!;

  it('a room plays its theme\'s bed (HallsRoom.theme, rolled in the sim since H2d), or one from its index without one', () => {
    const r0 = m.rooms[0];
    expect(roomBedFor(m, r0.x, r0.y)).toBe(ROOM_THEME_BED[m.rooms[0].theme!]);
    expect(roomBedFor(m, m.rooms[1].x, m.rooms[1].y)).toBe(ROOM_THEME_BED[m.rooms[1].theme!]);
    const bare = { ...m, rooms: m.rooms.map((r) => ({ ...r, theme: undefined })) };
    expect(roomBedFor(bare, r0.x, r0.y)).toBe('ashStore');
    expect(roomBedFor(bare, m.rooms[1].x, m.rooms[1].y)).toBe('bellowsHall');
    const themed = { ...m, rooms: m.rooms.map((r, i) => (i === 0 ? { ...r, theme: 'shrine' as const } : r)) };
    expect(roomBedFor(themed, r0.x, r0.y)).toBe('kilnShrine');
    expect(Object.values(ROOM_THEME_BED).sort()).toEqual([...ROOM_BEDS].sort());
    // Visuals' Foundry ids (25 Nov).
    expect([ROOM_THEME_BED.boiler, ROOM_THEME_BED.cistern, ROOM_THEME_BED.pump, ROOM_THEME_BED.anchor]).toEqual(['boilerRoom', 'cistern', 'pumpHall', 'anchorStore']);
    expect([ROOM_THEME_BED.lens, ROOM_THEME_BED.orrery, ROOM_THEME_BED.colonnade, ROOM_THEME_BED.mirror]).toEqual(['lensGallery', 'starVault', 'shadeColonnade', 'mirrorHall']);
    expect([ROOM_THEME_BED.hearthless, ROOM_THEME_BED.rime, ROOM_THEME_BED.drift, ROOM_THEME_BED.crypt]).toEqual(['deadHearth', 'rimeHall', 'snowdriftCave', 'coldCrypt']);
    expect([ROOM_THEME_BED.quay, ROOM_THEME_BED.wreck, ROOM_THEME_BED.kelp, ROOM_THEME_BED.sluice]).toEqual(['harbourQuay', 'wreckYard', 'kelpBed', 'sluiceGate']);
    expect([ROOM_THEME_BED.anvil, ROOM_THEME_BED.chain, ROOM_THEME_BED.quench, ROOM_THEME_BED.ingot]).toEqual(['anvilHall', 'chainGallery', 'quenchTrough', 'ingotStore']);
  });

  it('a corridor, the boss door alcove and anywhere off the map are quiet', () => {
    const d = m.rooms[DOOR_ROOM];
    expect(roomBedFor(m, d.x, d.y)).toBeNull();
    expect(roomBedFor(m, 1e6, 1e6)).toBeNull();
    expect(roomBedFor(undefined, 0, 0)).toBeNull();
    expect(roomBedFor(null, 0, 0)).toBeNull();
    // Halfway along a corridor between two rooms that don't overlap.
    const c = m.corridors.find((k) => Math.hypot(m.rooms[k.a].x - m.rooms[k.b].x, m.rooms[k.a].y - m.rooms[k.b].y) > m.rooms[k.a].r + m.rooms[k.b].r + 40)!;
    const a = m.rooms[c.a], b = m.rooms[c.b];
    const ux = (b.x - a.x) / Math.hypot(b.x - a.x, b.y - a.y), uy = (b.y - a.y) / Math.hypot(b.x - a.x, b.y - a.y);
    expect(roomBedFor(m, a.x + ux * (a.r + 20), a.y + uy * (a.r + 20))).toBeNull();
  });

  it('the game passes the hero\'s room bed only on the Halls map, and the hub or end screen stops it', () => {
    const scene = readFileSync('client/GameScene.ts', 'utf8');
    expect(scene).toContain('hallsBed: w.hallsOn && w.player.hp > 0 ? roomBedFor(w.halls, w.player.x, w.player.y) : null');
    const engine = readFileSync('client/audio/index.ts', 'utf8');
    expect(engine).toContain('this.roomBed(ctx.hallsBed ?? null);');
    expect(engine).toContain("if (id === null || id.startsWith('hub')) this.roomBed(null);");
  });
});
