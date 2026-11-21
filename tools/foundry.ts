// Drowned Foundry check: per-run outcome plus how Maelra's mechanics fired.
// TIER=n, SEEDS=..., CLS=..., BOT_PATH=... as in the other tools.
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { readFileSync } from 'fs';
import { equippedItems, HeroProfile } from '../sim/hero';

// HERO=path/to/hero.json plays with that hero's gear, passives and level (see SNAP in tools/progression.ts).
const hero: HeroProfile | null = process.env.HERO ? JSON.parse(readFileSync(process.env.HERO, 'utf8')) : null;
const heroOpts = hero ? { gear: equippedItems(hero), passives: hero.passives, heroLevel: hero.level, nextItemId: hero.nextItemId } : {};

const seeds = (process.env.SEEDS ?? Array.from({ length: 24 }, (_, i) => i + 1).join(',')).split(',').map(Number);
let wins = 0, bossTime = 0, bossFights = 0;
for (const seed of seeds) {
  const w = new World({ ...heroOpts, seed, dungeon: (process.env.DUNGEON as 'kiln') ?? 'foundry', tier: Number(process.env.TIER ?? 1), omens: [], cls: (process.env.CLS as 'emberwright') ?? 'emberwright' });
  const c: Record<string, number> = {};
  const bump = (k: string, n = 1) => (c[k] = (c[k] ?? 0) + n);
  let bossAt = 0, maxTemper = 0, temperTicks = 0, bossTicks = 0;
  while (w.state !== 'ended' && w.time < 900) {
    if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
    const before = w.temper;
    w.step(botInput(w, Number(process.env.SKILL ?? 1)));
    if (w.bossSpawned && !bossAt) bossAt = w.time;
    if (w.bossSpawned) { bossTicks++; temperTicks += w.temper; maxTemper = Math.max(maxTemper, w.temper); if (before > 0 && w.temper === 0) bump('boil'); }
    for (const ev of w.events) {
      if (ev.type === 'glare' && ev.hit) bump('glareHit');
      if (ev.type === 'brandBurst') bump('brandBurst');
      if (ev.type === 'pillarCrack') bump('crack');
      if (ev.type === 'interrupt') bump('int:' + ev.name);
      if (ev.type === 'castDone') bump('cast:' + ev.name);
      if (ev.type === 'phase') bump('phase' + ev.phase);
      if (ev.type === 'playerHurt') bump('hurt', Math.round(ev.amount));
    }
  }
  const s = w.summary();
  if (s.victory) wins++;
  if (bossAt) { bossFights++; bossTime += s.time - bossAt; }
  console.log(`seed ${seed}: ${s.victory ? 'WIN ' : 'LOSS'} t=${s.time.toFixed(0)} boss=${bossAt ? (s.time - bossAt).toFixed(0) + 's' : '-'} fights=${w.encounter} avgTemper=${bossTicks ? (temperTicks / bossTicks).toFixed(1) : '-'} maxTemper=${maxTemper} arena=${Math.round(w.arenaR)} ${JSON.stringify(c)}`);
}
console.log(`wins ${wins}/${seeds.length}, avg boss fight ${bossFights ? Math.round(bossTime / bossFights) : '-'}s`);
