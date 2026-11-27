// Drowned Foundry check: per-run outcome plus how Maelra's mechanics fired.
// STANCE=anvil|bellows sets the Slagbinder stance (default bellows).
// TIER=n, SEEDS=..., CLS=..., BOT_PATH=... as in the other tools. HEAT=stoneFloor etc. plays with that Heat (Phase 14 X1).
// OMENS=client|rotate|none|ids picks the Omens (tools/omenopt.ts); the default is none, though the client plays 1 to 3 from tier 3.
// SET=kilnbreaker|tidewalker|glarewarden|hearthkeeper|wrackrider|deepguard|ventwalker|kinbound SETN=2|3 turns the hero's head, hands and trinket (in that order) into set pieces.
import * as WORLD from '../sim/world';
import { World } from '../sim/world';
import { botChoose, botInput } from '../sim/bot';
import { hallsReport, hallsSeed, hallsTick } from './hallsmeasure';
import { readFileSync } from 'fs';
import { equippedItems, HeroProfile } from '../sim/hero';
import type { Item } from '../sim/content/items';
import { SET_SLOTS, SetId } from '../sim/content/sets';
import { NAMED, AFFIXES } from '../sim/content/named';
import { toolOmens } from './omenopt';

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
// Phase 15 Y1: WAVE=off keeps every wave an arc; WAVE=pincer|ring|reinforce forces one.
if (process.env.WAVE === 'off') WORLD.WAVES.off = true;
else if (process.env.WAVE) WORLD.WAVES.force = process.env.WAVE;
// Phase 15 Y10: STIR=off turns the dungeon's stirring off; STIR=elite|named|event|wave|any stirs every trash fight after the opener.
// Phase 16 U1: ECHO=off turns boss echoes off; ECHO=<version id> forces that echo where the boss has it.
if (process.env.ECHO === 'off') WORLD.ECHO.off = true;
else if (process.env.ECHO) WORLD.ECHO.force = process.env.ECHO;
if (process.env.STIR === 'off') WORLD.STIR.off = true;
else if (process.env.STIR) WORLD.STIR.force = process.env.STIR;
const seeds = (process.env.SEEDS ?? Array.from({ length: 24 }, (_, i) => i + 1).join(',')).split(',').map(Number);
let wins = 0, bossTime = 0, bossFights = 0;
const fightHurts: number[] = [];
for (const seed of seeds) {
  const w = new World({ ...heroOpts, heat: (process.env.HEAT || undefined) as never, stance: (process.env.STANCE || undefined) as never, seed, dungeon: (process.env.DUNGEON as 'kiln') ?? 'foundry', tier: Number(process.env.TIER ?? 1), omens: toolOmens(Number(process.env.TIER ?? 1), seed), cls: (process.env.CLS as 'emberwright') ?? 'emberwright', halls: process.env.HALLS === '1', hallsTemplate: process.env.HALLSMAP === 'a' });
  // Phase 16 U2: FIGHT=<encounter id> makes it the first fight of every run (the run is still in its intro), so a new fight compares with another on the same seeds.
  if (process.env.FIGHT) w.route[0] = process.env.FIGHT as never;
  // BOSSV=turning (any boss version id) forces this run's boss version, so versions compare on the same seeds.
  if (process.env.BOSSV) {
    const q = w as unknown as Record<string, unknown>;
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(w))) if (/^roll\w+Variant$/.test(k)) q[k] = () => process.env.BOSSV;
  }
  const c: Record<string, number> = {};
  const bump = (k: string, n = 1) => (c[k] = (c[k] ?? 0) + n);
  let bossAt = 0, maxTemper = 0, temperTicks = 0, bossTicks = 0;
  while (w.state !== 'ended' && w.time < 900) {
    if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
    const before = w.temper;
    w.step(botInput(w, Number(process.env.SKILL ?? 1)));
    hallsTick(w);
    if (w.bossSpawned && !bossAt) bossAt = w.time;
    if (w.bossSpawned) { bossTicks++; temperTicks += w.temper; maxTemper = Math.max(maxTemper, w.temper); if (before > 0 && w.temper === 0) bump('boil'); }
    for (const ev of w.events) {
      if (ev.type === 'glare' && ev.hit) bump('glareHit');
      if (ev.type === 'brandBurst') bump('brandBurst');
      if (ev.type === 'pillarCrack') bump('crack');
      if (ev.type === 'dodge') bump('dodge');
      if (ev.type === 'interrupt') bump('int:' + ev.name);
      if (ev.type === 'stir') bump('stir:' + ev.id);
      if (ev.type === 'echo') bump('echo:' + ev.id);
      if (ev.type === 'encounterClear' && ev.index > 0) fightHurts.push(w.fightHurt);
      if (ev.type === 'encounterClear' && process.env.FIGHT && ev.id === process.env.FIGHT) { bump('fightT', Math.round(w.time - (w as unknown as { fightStartedAt: number }).fightStartedAt)); }
      if (ev.type === 'castDone') bump('cast:' + ev.name);
      if (ev.type === 'phase') bump('phase' + ev.phase);
      if (ev.type === 'playerHurt') bump('hurt', Math.round(ev.amount));
      if (ev.type === 'playerHurt' && process.env.FIGHT && w.encounterDef.id === process.env.FIGHT) bump('fightHurt', Math.round(ev.amount));
    }
  }
  const s = w.summary();
  if (s.victory) wins++;
  if (bossAt) { bossFights++; bossTime += s.time - bossAt; }
  console.log(`seed ${seed}: ${s.victory ? 'WIN ' : 'LOSS'} t=${s.time.toFixed(0)} boss=${bossAt ? (s.time - bossAt).toFixed(0) + 's' : '-'} fights=${w.encounter} avgTemper=${bossTicks ? (temperTicks / bossTicks).toFixed(1) : '-'} maxTemper=${maxTemper} arena=${Math.round(w.arenaR)} ${JSON.stringify(c)}`);
  hallsSeed(w, s.victory);
}
hallsReport();
// STIRHURT=1: share of health lost per trash fight after the opener (Phase 15 Y10's clean / rough bars), as percentiles.
if (process.env.STIRHURT === '1' && fightHurts.length) {
  const q = [...fightHurts].sort((x, y) => x - y);
  const at = (f: number) => q[Math.min(q.length - 1, Math.floor(f * q.length))].toFixed(3);
  console.log(`stirhurt n=${q.length} p25=${at(0.25)} p50=${at(0.5)} p75=${at(0.75)} clean<=0.15: ${q.filter((x) => x <= 0.15).length}`);
}
console.log(`wins ${wins}/${seeds.length}, avg boss fight ${bossFights ? Math.round(bossTime / bossFights) : '-'}s`);
