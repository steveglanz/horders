// Plays bot runs and reports outcomes plus how often the MMO mechanics fire.
import * as WORLD from '../sim/world';
import { World } from '../sim/world';
import { OmenId } from '../sim/content/omens';
import { botChoose, botInput, laggedBot } from '../sim/bot';
import { FIRST_DELVE } from '../sim/content/firstdelve';

// FIRST=1 plays a first delve (L1); FD_HP and FD_DMG override its multipliers.
if (process.env.FD_HP) FIRST_DELVE.hp = Number(process.env.FD_HP);
if (process.env.FD_DMG) FIRST_DELVE.dmg = Number(process.env.FD_DMG);

// ROUTE=pack,brute,kilnMother fixes the fights. LAG=seconds gives the bot a reaction time (a novice proxy; see laggedBot).
const lagTicks = Math.round(Number(process.env.LAG ?? 0) * 30);

// TUNE=DEFENCE_BRANCH.ringDamage=30 overrides an exported tuning number for this run only.
for (const kv of (process.env.TUNE ?? '').split(',').filter(Boolean)) {
  const [path, v] = kv.split('=');
  const keys = path.split('.');
  let o = (WORLD as unknown as Record<string, Record<string, unknown>>)[keys[0]] as Record<string, unknown>;
  for (const k of keys.slice(1, -1)) o = o[k] as Record<string, unknown>;
  o[keys[keys.length - 1]] = Number(v);
}
const skill = Number(process.env.SKILL ?? 1);
const seeds = (process.env.SEEDS ?? '1,2,3,4,5,6,7,8').split(',').map(Number);
let wins = 0;
let hpLeft = 0;
for (const seed of seeds) {
  const w = new World({ potion: process.env.POTION as never, seed, dungeon: (process.env.DUNGEON as 'kiln' | 'foundry') ?? 'kiln', tier: Number(process.env.TIER ?? 1), omens: process.env.OMENS !== undefined ? (process.env.OMENS.split(',').filter(Boolean) as OmenId[]) : undefined, cls: (process.env.CLS as 'emberwright' | 'duskblade') ?? 'emberwright', alt: process.env.ALT === '1', firstDelve: process.env.FIRST === '1', route: process.env.ROUTE ? (process.env.ROUTE.split(',') as never) : undefined });
  const drive = lagTicks ? laggedBot(lagTicks, skill) : (x: World) => botInput(x, skill);
  const c: Record<string, number> = {};
  const bump = (k: string) => (c[k] = (c[k] ?? 0) + 1);
  let bossAt = 0;
  while (w.state !== 'ended' && w.time < 800) {
    if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
    w.step(drive(w));
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
