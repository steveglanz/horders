import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';

type Inner = {
  spawn(kind: string, x: number, y: number): number;
  hurtPlayer(amount: number, src?: number, unblockable?: boolean): void;
  talents: Record<string, number>;
  rebuildHash(): void;
};

describe('reflected damage', () => {
  // A Bulwark with Thornwall (and Anvil Skin up) beside Glass Wardens under Mirror Ward: each turned-back
  // hit was mirrored back at the Bulwark and turned back again, with no end, so the sim never returned
  // (a bot-filled Hammerdeep run crashed the browser tab this way).
  it('a Thornwall Bulwark next to mirrored Glass Wardens takes the hit and the sim returns', () => {
    const w = new World({ seed: 3, dungeon: 'foundry', omens: [], cls: 'bulwark' });
    const inner = w as unknown as Inner;
    for (const e of w.enemies) e.alive = false;
    const p = w.player;
    const a = inner.spawn('glassWarden', p.x + 40, p.y);
    const b = inner.spawn('glassWarden', p.x - 40, p.y);
    for (const i of [a, b]) w.enemies[i].aux2 = 3; // Mirror Ward up
    inner.rebuildHash();
    inner.talents.thornwall = 1;
    p.bastionT = 6; // Anvil Skin
    // Before the fix this call never returned (the test hangs rather than fails).
    const hp = p.hp;
    inner.hurtPlayer(40, a);
    expect(p.hp).toBeLessThan(hp);
    expect(w.events.length).toBeLessThan(100);
  });
});
