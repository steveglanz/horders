import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
const cases: [string, string, number, number, number][] = [];
for (const s of [1,2,3,4,5,6,7,8,9,10,11,12]) cases.push(['lumen', 'kiln', 6, 0.5, s]);
for (const s of [2,4,5]) cases.push(['emberwright', 'foundry', 8, 1, s]);
let worst = 0;
for (const [cls, dungeon, tier, skill, seed] of cases) {
  const w = new World({ seed, cls: cls as any, dungeon: dungeon as any, tier, omens: [] });
  let maxAlive = 0, burn = '';
  while (w.state !== 'ended' && w.time < 3000) {
    if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
    w.step(botInput(w, skill));
    maxAlive = Math.max(maxAlive, w.aliveEnemies);
    for (const e of w.events) if (e.type === 'bossEnrage') burn += `boil@${w.time.toFixed(0)} `;
  }
  worst = Math.max(worst, w.time);
  console.log(`${cls} ${dungeon} T${tier} s${seed}: ${w.state === 'ended' ? (w.summary().victory ? 'WIN' : 'LOSS') : 'STUCK'} t=${w.time.toFixed(0)} maxAlive=${maxAlive} ${burn}`);
}
console.log('longest run', worst.toFixed(0));
