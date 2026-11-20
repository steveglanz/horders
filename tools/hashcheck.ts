// Prints a fingerprint of bot runs so a refactor can prove solo play is unchanged.
// Usage: npx tsx tools/hashcheck.ts > before.txt  (then diff with after)
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
for (const cls of ['emberwright', 'duskblade', 'bulwark', 'lumen'] as const) {
  for (const dungeon of ['kiln', 'foundry'] as const) {
    for (const seed of [1, 2, 3]) {
      const w = new World({ seed, cls, dungeon, tier: seed + 2, worldBoss: 'Grandmother Slag', week: 2900 });
      const marks: number[] = [];
      while (w.state !== 'ended' && w.time < 900) {
        if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
        w.step(botInput(w, 1));
        if (w.tick % 300 === 0) marks.push(w.hash());
      }
      const s = w.summary();
      console.log(cls, dungeon, seed, s.victory, w.tick, Math.round(s.damageDealt), s.kills, w.hash(), marks.join(','));
    }
  }
}
