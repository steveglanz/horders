import { runBot } from '../sim/bot';
for (const seed of [1, 2, 3, 4, 5]) {
  const t0 = performance.now();
  const w = runBot(seed);
  const s = w.summary();
  console.log(`seed ${seed}: ${s.victory ? 'WIN ' : 'LOSS'} t=${s.time.toFixed(0)}s lvl=${s.level} kills=${s.kills} hp=${w.player.hp.toFixed(0)} boss=${w.bossSpawned} bossFight=${w.bossSpawned ? (s.time-480).toFixed(0)+'s' : '-'} cpu=${(performance.now()-t0).toFixed(0)}ms talents=${JSON.stringify(s.talents)}`);
}
