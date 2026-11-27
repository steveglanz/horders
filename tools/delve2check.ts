// Delve 2 check (design, 27 Nov 2026, "Smooth the jump into delve 2"): plays the Kiln tier 1 run a save gets right after
// the opening (level 2 Emberwright, runsDone=1) and prints, per seed, the win, when and in which fight the hero fell,
// the lowest health in fights 1-2, and the most foes awake at once in fight 1.
//
//   SEEDS=1,2,3 RUNS=1 REACT=0.3 FORGET=0.2 STEPERR=0.5 npx tsx tools/delve2check.ts   average skill
//   REACT=0.5 FORGET=0.9 STEPERR=0.5 SKILL=0.5 ...                                     a casual who almost never rolls
//   RUNS=5 plays a later delve (no ease-in), CLS= another class, ULVL= the unlock level (default 2).
import { World } from '../sim/world';
import { botChoose, reactBot } from '../sim/bot';
import { hallsTick } from './hallsmeasure';
import type { ClassId } from '../sim/content/emberwright';

const seeds = (process.env.SEEDS ?? '1,2,3,4,5,6,7,8,9,10').split(',').map(Number);
const runsDone = Number(process.env.RUNS ?? 1);
const ulvl = Number(process.env.ULVL ?? 2);
let wins = 0, deaths1 = 0;
const lows: number[] = [], packs: number[] = [];
for (const seed of seeds) {
  const w = new World({ seed, dungeon: 'kiln', tier: 1, cls: (process.env.CLS ?? 'emberwright') as ClassId, heroLevel: ulvl, unlockLevel: ulvl, halls: true, runsDone, heat: (process.env.HEAT || undefined) as never, bossOmen: (process.env.BOSSOMEN || undefined) as never });
  const drive = reactBot(Number(process.env.REACT ?? 0.3), Number(process.env.SKILL ?? 1), { forget: Number(process.env.FORGET ?? 0.2), stepErr: Number(process.env.STEPERR ?? 0.5), salt: seed });
  let low = 1, awake = 0;
  while (w.state !== 'ended' && w.time < 800) {
    if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
    w.step(drive(w));
    hallsTick(w);
    if (w.encounter <= 2) low = Math.min(low, w.player.hp / w.player.maxHp);
    if (w.encounter <= 1) awake = Math.max(awake, w.enemies.filter((e) => e.alive && e.def.rank !== 'boss').length);
  }
  const s = w.summary();
  if (s.victory) wins++;
  else if (w.encounter <= 1) deaths1++;
  lows.push(low); packs.push(awake);
  console.log(`seed ${seed}: ${s.victory ? 'WIN ' : 'LOSS'} t=${s.time.toFixed(0)}s fight=${w.encounter} low12=${Math.round(low * 100)}% awake1=${awake} route=${w.route.slice(0, 2).join(',')} omens=${w.omens.join('|') || '-'} heat=${w.heat || '-'}`);
}
const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`wins ${wins}/${seeds.length}, fell in fight 1: ${deaths1}, median low in fights 1-2 ${Math.round(med(lows) * 100)}%, median most awake in fight 1 ${med(packs)}`);
