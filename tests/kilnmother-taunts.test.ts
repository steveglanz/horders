import { describe, expect, it } from 'vitest';
import { World, KILN_V2, BOIL_TAUNT, type SimEvent } from '../sim/world';
import { KILN_TAUNTS, kilnTaunt, type KilnSay } from '../sim/content/kilnmother';

/** CP3 Kiln Mother remake (docs/design/kiln-mother.md): her taunts. */
const BANNED = /\b(ancient|eldritch|arcane|void|titan|abyss|celestial|infernal|primal|mystic|nexus|essence|realm|destiny|chosen|forsaken|cursed|unholy|eternal|epic|legendary|unleash|embark|journey)\b/i;

describe('the Kiln Mother\'s taunts (CP3 remake)', () => {
  const all = [...Object.values(KILN_TAUNTS).flat(), BOIL_TAUNT.kilnMother];

  it('about 25 lines in the Court\'s voice: 12 words or fewer, no exclamation marks, no banned words, no repeats', () => {
    expect(all.length).toBeGreaterThanOrEqual(25);
    for (const l of all) {
      expect(l.split(/\s+/).length, l).toBeLessThanOrEqual(12);
      expect(l, l).not.toMatch(/!|—|\.\.\./);
      expect(l, l).not.toMatch(BANNED);
    }
    expect(new Set(all).size).toBe(all.length);
  });

  it('a line is picked from the seed alone, and every line can come up', () => {
    for (const say of Object.keys(KILN_TAUNTS) as KilnSay[]) {
      expect(kilnTaunt(say, 7)).toBe(kilnTaunt(say, 7));
      const seen = new Set<string>();
      for (let seed = 1; seed < 200; seed++) seen.add(kilnTaunt(say, seed));
      expect(seen.size).toBe(KILN_TAUNTS[say].length);
    }
  });

  it('in a fight: her entry line after the banner, once; her fall line when she dies', () => {
    const w = new World({ seed: 3, dungeon: 'kiln', tier: 2, omens: [], cls: 'emberwright' });
    const q = w as unknown as { spawn(k: string, x: number, y: number): number; kmStart(): void; bossIndex: number; bossSpawned: boolean; damageEnemy(i: number, a: number, c: boolean): void };
    for (const e of w.enemies) e.alive = false;
    w.player.x = 400; w.player.y = 0;
    const b = q.spawn('kilnMother', 0, 0);
    q.bossIndex = b; q.bossSpawned = true;
    q.kmStart();
    const says: { say: string; at: number }[] = [];
    const run = (s: number) => {
      for (let n = 0; n < Math.round(s * 30); n++) {
        for (const e of w.enemies) if (e.alive && e.kind !== 'kilnMother') e.alive = false;
        for (const t of w.telegraphs) t.alive = false;
        w.player.hp = w.player.maxHp;
        w.step({ x: 0, y: 0 });
        for (const ev of w.events as SimEvent[]) if (ev.type === 'bossSay') { says.push({ say: ev.say, at: w.time }); expect(KILN_TAUNTS[ev.say]).toContain(ev.line); }
      }
    };
    run(KILN_V2.sayDelay + 1);
    expect(says.map((s) => s.say)).toEqual(['enter']);
    expect(says[0].at).toBeGreaterThanOrEqual(KILN_V2.sayDelay - 0.1);
    q.damageEnemy(b, 1e9, false);
    run(0.2);
    expect(says.map((s) => s.say)).toEqual(['enter', 'sheFalls']);
  });
});
