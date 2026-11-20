// Plays bot runs and reports outcomes plus how often the MMO mechanics fire.
import { World } from '../sim/world';
import { OmenId } from '../sim/content/omens';
import { botChoose, botInput } from '../sim/bot';

const skill = Number(process.env.SKILL ?? 1);
const seeds = (process.env.SEEDS ?? '1,2,3,4,5,6,7,8').split(',').map(Number);
let wins = 0;
let hpLeft = 0;
for (const seed of seeds) {
  const w = new World({ seed, tier: Number(process.env.TIER ?? 1), omens: process.env.OMENS !== undefined ? (process.env.OMENS.split(',').filter(Boolean) as OmenId[]) : undefined, cls: (process.env.CLS as 'emberwright' | 'duskblade') ?? 'emberwright' });
  const c: Record<string, number> = {};
  const bump = (k: string) => (c[k] = (c[k] ?? 0) + 1);
  let bossAt = 0;
  while (w.state !== 'ended' && w.time < 800) {
    if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
    w.step(botInput(w, skill));
    for (const ev of w.events) {
      if (ev.type === 'ability') bump(['wave', 'blink', 'comb', 'quench'][ev.slot]);
      if (ev.type === 'blink') bump('blink');
      if (ev.type === 'interrupt') bump('int:' + ev.name);
      if (ev.type === 'castDone') bump('cast:' + ev.name);
      if (ev.type === 'soak') bump(ev.ok ? 'soakOk' : 'soakFail');
      if (ev.type === 'quest') bump('quest');
      if (ev.type === 'loot') bump('loot');
      if (ev.type === 'gather') bump('vein');
      if (ev.type === 'riftClosed') bump('rift');
      if (ev.type === 'phase') bump('phase' + ev.phase);
      if (ev.type === 'bossSpawn') bossAt = w.time;
      if (ev.type === 'encounterStart') c['t' + ev.index] = -Math.round(w.time);
      if (ev.type === 'encounterClear') c['t' + ev.index] += Math.round(w.time);
      if (ev.type === 'kill' && ev.kind === 'ashmaw') c.ashmawAt = Math.round(w.time);
    }
  }
  const s = w.summary();
  if (s.victory) { wins++; hpLeft += w.player.hp; }
  console.log(`seed ${seed}: ${s.victory ? 'WIN ' : 'LOSS'} t=${s.time.toFixed(0)}s lvl=${s.level} hp=${w.player.hp.toFixed(0)} bossFight=${bossAt ? (s.time - bossAt).toFixed(0) + 's' : '-'} fights=${w.encounter}/5 route=${w.route.join(',')}`);
  console.log('   ', JSON.stringify(c));
}
console.log(`wins ${wins}/${seeds.length}`);
console.log(`avg hp left on wins ${Math.round(hpLeft / Math.max(1, wins))}`);
