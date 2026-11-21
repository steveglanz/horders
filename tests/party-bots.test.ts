import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { BOT_PARTY, botInput } from '../sim/bot';

describe('party bots', () => {
  it('walk to a downed ally and pick them up (with BOT_PARTY.revive on)', () => {
    BOT_PARTY.revive = true;
    const w = new World({ seed: 2, cls: 'emberwright', tier: 4, omens: [], party: [{ cls: 'lumen' }] });
    for (const e of w.enemies) e.alive = false;
    const down = w.heroes[1].player;
    down.hp = 0;
    down.x = w.player.x + 200;
    down.y = w.player.y;
    let up = false;
    for (let n = 0; n < 30 * 8 && !up; n++) {
      const inputs = w.heroes.map((_, i) => { w.use(i); const inp = botInput(w); w.use(0); return inp; });
      w.step(inputs);
      for (const e of w.enemies) e.alive = false;
      up = w.heroes[1].player.hp > 0;
    }
    BOT_PARTY.revive = false;
    expect(up).toBe(true);
  });
});
