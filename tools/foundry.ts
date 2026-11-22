// Drowned Foundry check: per-run outcome plus how Maelra's mechanics fired.
// STANCE=anvil|bellows sets the Slagbinder stance (default bellows).
// TIER=n, SEEDS=..., CLS=..., BOT_PATH=... as in the other tools. HEAT=stoneFloor etc. plays with that Heat (Phase 14 X1).
// POTION=risingDraught|stillwater|kindling brews that potion for every run.
// SET=kilnbreaker|tidewalker|glarewarden|hearthkeeper|wrackrider|deepguard|ventwalker|kinbound SETN=2|3 turns the hero's head, hands and trinket (in that order) into set pieces.
import * as WORLD from '../sim/world';
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { readFileSync } from 'fs';
import { equippedItems, HeroProfile } from '../sim/hero';
import type { Item } from '../sim/content/items';
import { SET_SLOTS, SetId } from '../sim/content/sets';
import { NAMED, AFFIXES } from '../sim/content/named';

// HERO=path/to/hero.json plays with that hero's gear, passives and level (see SNAP in tools/progression.ts).
const hero: HeroProfile | null = process.env.HERO ? JSON.parse(readFileSync(process.env.HERO, 'utf8')) : null;
const setId = process.env.SET as SetId | undefined;
const setN = Number(process.env.SETN ?? 3);
const tagSet = (items: Item[]): Item[] => {
  if (!setId) return items;
  let n = 0;
  return items.map((it) => (SET_SLOTS.includes(it.slot) && n++ < setN ? { ...it, set: setId } : it));
};
const heroOpts = hero ? { gear: tagSet(equippedItems(hero)), passives: hero.passives, heroLevel: hero.level, nextItemId: hero.nextItemId } : {};
if (setId && hero) console.log('set pieces worn:', heroOpts.gear?.filter((i) => i.set).length);

// TUNE=DEFENCE_BRANCH.ringDamage=30 overrides an exported tuning number for this run only.
for (const kv of (process.env.TUNE ?? '').split(',').filter(Boolean)) {
  const [path, v] = kv.split('=');
  const keys = path.split('.');
  let o = (WORLD as unknown as Record<string, Record<string, unknown>>)[keys[0]] as Record<string, unknown>;
  for (const k of keys.slice(1, -1)) o = o[k] as Record<string, unknown>;
  o[keys[keys.length - 1]] = Number(v);
}
// Phase 14 X3: ARENA=caveIn|ventSurge|coldSnap|highWater forces that arena event in every trash fight that can have it; ARENA=off turns them off.
// Phase 14 X2: AFFIX=Brood (any AFFIXES name) gives every named foe that affix; NAMEDALL=1 puts a named foe in every delve.
if (process.env.AFFIX) NAMED.forceAffix = AFFIXES.indexOf(process.env.AFFIX as never);
if (process.env.NAMEDALL === '1') NAMED.forceNamed = 1;
if (process.env.ARENA === 'off') WORLD.ARENA_EVENTS.off = true;
else if (process.env.ARENA) WORLD.ARENA_EVENTS.force = process.env.ARENA;
const seeds = (process.env.SEEDS ?? Array.from({ length: 24 }, (_, i) => i + 1).join(',')).split(',').map(Number);
let wins = 0, bossTime = 0, bossFights = 0;
for (const seed of seeds) {
  const w = new World({ ...heroOpts, heat: (process.env.HEAT || undefined) as never, stance: (process.env.STANCE || undefined) as never, potion: process.env.POTION as never, seed, dungeon: (process.env.DUNGEON as 'kiln') ?? 'foundry', tier: Number(process.env.TIER ?? 1), omens: [], cls: (process.env.CLS as 'emberwright') ?? 'emberwright' });
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
      if (ev.type === 'dodge') bump('dodge');
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
