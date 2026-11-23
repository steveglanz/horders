import { describe, expect, it } from 'vitest';
import { World, BALLAST } from '../sim/world';
import { cueFor, CAST_SOUNDS, PRIORITY } from '../client/audio/cues';
import { SOUNDS } from '../client/audio/sounds';
import { recipeLength } from '../client/audio/synth';

type Inner = { spawn(kind: string, x: number, y: number): number; damageEnemy(i: number, amount: number, canCrit: boolean): void; route: string[] };

/** A Foundry run already in its first fight (the Ballast's), every foe cleared, as tests/ballast.test.ts. */
function fight() {
  const w = new World({ seed: 3, dungeon: 'foundry', tier: 4, omens: [], cls: 'emberwright' });
  const inner = w as unknown as Inner;
  inner.route[0] = 'ballast';
  for (const e of w.enemies) e.alive = false;
  (w as unknown as { phase: string }).phase = 'fight';
  w.player.x = 0; w.player.y = 0;
  return { w, inner };
}

describe('Sound for the Ballast (Phase 16 U2)', () => {
  it('Anchor Slam winds up with its own warning, shorter than the cast; dropping and weighing anchor are ordinary', () => {
    expect(CAST_SOUNDS.anchorSlam.start).toBe('anchorWarn');
    expect(PRIORITY.has('anchorWarn')).toBe(true);
    expect(recipeLength(SOUNDS.anchorWarn)).toBeLessThan(BALLAST.slamCast);
    expect(PRIORITY.has('anchorDrop')).toBe(false);
    expect(PRIORITY.has('anchorWeigh')).toBe(false);
  });

  it('in a real fight: drops anchor, slams with the warning, glances while planted, weighs anchor when you step out', () => {
    const { w, inner } = fight();
    const b = inner.spawn('ballast', 60, 0);
    const heard: string[] = [];
    const listen = (n: number) => {
      for (let k = 0; k < n; k++) {
        w.step({ x: 0, y: 0 });
        for (const ev of w.events) { const c = cueFor(ev, { cls: w.cls, acting: w.acting }); if (c && /^anchor|^glance$/.test(c.id)) heard.push(c.id); }
      }
    };
    w.player.hp = w.player.maxHp = 1e9;
    listen(Math.ceil((BALLAST.plantDelay + BALLAST.slamFirst + 0.2) * 30));
    // (the hero's own auto attacks glance off it once it is planted)
    expect(heard.filter((id) => id !== 'glance').slice(0, 2)).toEqual(['anchorDrop', 'anchorWarn']);
    expect(heard.indexOf('glance')).toBeGreaterThan(heard.indexOf('anchorDrop'));
    // Planted: a hit is a glance.
    w.events.length = 0;
    w.enemies[b].hp = w.enemies[b].maxHp = 1e6;
    inner.damageEnemy(b, 100, false);
    expect(w.events.filter((ev) => ev.type === 'hit').map((ev) => cueFor(ev, { cls: w.cls, acting: w.acting })?.id)).toEqual(['glance']);
    // Step well out of its reach: it weighs anchor.
    heard.length = 0;
    w.player.x = -600;
    listen(Math.ceil((BALLAST.unplant + 0.3) * 30));
    expect(heard).toContain('anchorWeigh');
  });
});
