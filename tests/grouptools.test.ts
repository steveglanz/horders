import { describe, expect, it } from 'vitest';
import { World, GROUP_TOOLS } from '../sim/world';
import { botCast } from '../sim/bot';
import type { ClassId } from '../sim/content/emberwright';

type Inner = {
  use(i: number): void;
  spawn(kind: string, x: number, y: number): number;
  combustion(): void;
  quench(): void;
  rebuildHash(): void;
  bossIndex: number;
  threat: { target: string | null; amounts: Record<string, number> }[];
};

/** A party led by `main`, with Ondrel spawned 200 px away and no other foes. */
function party(main: ClassId, rest: ClassId[]): { w: World; inner: Inner; b: number } {
  const w = new World({ seed: 4, dungeon: 'hammerdeep', omens: [], cls: main, party: rest.map((cls) => ({ cls })) });
  for (const e of w.enemies) e.alive = false;
  const inner = w as unknown as Inner;
  const b = inner.spawn('ondrel', w.player.x + 200, w.player.y);
  inner.bossIndex = b;
  return { w, inner, b };
}

/** Puts the boss on hero `k` by threat. */
function aggro(w: World, inner: Inner, b: number, k: number): void {
  inner.threat[b].target = w.heroes[k].id;
  inner.threat[b].amounts[w.heroes[k].id] = 1000;
}

describe('group tools (G1)', () => {
  it('Kindling: Combustion lifts a nearby ally\'s damage by 10% for 6 s', () => {
    const { w, inner } = party('emberwright', ['duskblade']);
    inner.use(1);
    const before = w.dmgMult;
    inner.use(0);
    const ally = w.heroes[1].player;
    ally.x = w.player.x + 100;
    ally.y = w.player.y;
    inner.rebuildHash();
    inner.combustion();
    expect(ally.kindleUntil).toBeCloseTo(w.time + GROUP_TOOLS.kindleTime);
    inner.use(1);
    expect(w.dmgMult).toBeCloseTo(before * GROUP_TOOLS.kindleMult);
    inner.use(0);
  });

  it('Purify: a co-op Lumen\'s Hush with nothing to silence clears an ally\'s Slag Grip', () => {
    const { w, inner } = party('lumen', ['bulwark']);
    const tank = w.heroes[1].player;
    tank.slag = 4;
    tank.sunderT = 5;
    expect(w.purifyTarget()).toBe(1);
    expect(botCast(w)).toBe(3);
    inner.quench();
    expect(tank.slag).toBe(0);
    // Sundered stays: the tank swap is the answer to it.
    expect(tank.sunderT).toBe(5);
  });

  it('Called Out: a co-op Bulwark\'s Shield Toss with nothing to interrupt takes the boss back, and the cue shows when it can', () => {
    const { w, inner, b } = party('bulwark', ['duskblade']);
    aggro(w, inner, b, 1);
    expect(w.bossTarget).toBe(1);
    expect(w.tauntCue).toBe(true);
    expect(botCast(w)).toBe(3);
    inner.quench();
    expect(w.bossTarget).toBe(0);
    expect(w.tauntCue).toBe(false);
  });

  it('the Duskblade bot Sidesteps to dump threat when it pulls the boss off a Bulwark', () => {
    const { w, inner, b } = party('duskblade', ['bulwark']);
    aggro(w, inner, b, 0);
    expect(botCast(w)).toBe(1);
  });

  it('solo, the interrupt slot with nothing to interrupt is unchanged', () => {
    for (const cls of ['lumen', 'bulwark'] as ClassId[]) {
      const w = new World({ seed: 4, omens: [], cls });
      for (const e of w.enemies) e.alive = false;
      const inner = w as unknown as Inner;
      inner.quench();
      // Nothing to interrupt: half the cooldown back, as before.
      expect(w.player.cds[3]).toBe(w.abilityCooldown(3) / 2);
      expect(w.bossTarget).toBe(-1);
      expect(w.tauntCue).toBe(false);
      expect(w.purifyTarget()).toBe(-1);
    }
  });
});
