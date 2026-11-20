// Plays daily bounties for a run of days and reports wins, time and health left.
// Env: DAYS (default 30), MAXTIER (default 2), SKILL (default 1), CLS.
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { bountyFor } from '../sim/content/bounty';

const days = Number(process.env.DAYS ?? 30);
const maxTier = Number(process.env.MAXTIER ?? 2);
const skill = Number(process.env.SKILL ?? 1);
let wins = 0, time = 0, hpShare = 0;
const twists: Record<string, [number, number]> = {};
for (let d = 0; d < days; d++) {
  const b = bountyFor(20400 + d, maxTier);
  const w = new World({ seed: b.seed, tier: b.tier, dungeon: b.dungeon, route: [...b.route], omens: [b.twist], bounty: b.day, cls: (process.env.CLS as 'emberwright') ?? 'emberwright' });
  while (w.state !== 'ended' && w.time < 800) {
    if (w.state === 'draft') w.choose(botChoose(w));
    else w.step(botInput(w, skill));
  }
  const t = (twists[b.twist] ??= [0, 0]);
  t[1]++;
  if (w.victory) { wins++; t[0]++; hpShare += w.player.hp / w.player.maxHp; }
  time += w.time;
  console.log(`day ${b.day} ${b.dungeon} T${b.tier} ${b.twist.padEnd(14)} ${b.route.join(',').padEnd(34)} ${w.victory ? 'WIN ' : 'LOSS'} ${w.time.toFixed(0)}s`);
}
console.log(`wins ${wins}/${days}  avg time ${(time / days).toFixed(0)}s  avg hp left on wins ${Math.round((100 * hpShare) / Math.max(1, wins))}%`);
console.log('by twist', JSON.stringify(twists));
