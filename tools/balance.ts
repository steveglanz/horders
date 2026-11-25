// Plays bot runs and reports outcomes plus how often the MMO mechanics fire.
import * as WORLD from '../sim/world';
import { World } from '../sim/world';
import { OmenId } from '../sim/content/omens';
import { botChoose, botInput, laggedBot, reactBot } from '../sim/bot';
import { hallsReport, hallsSeed, hallsTick } from './hallsmeasure';
import { FIRST_DELVE } from '../sim/content/firstdelve';

// FIRST=1 plays a first delve (L1); FD_HP and FD_DMG override its multipliers.
if (process.env.FD_HP) FIRST_DELVE.hp = Number(process.env.FD_HP);
if (process.env.FD_DMG) FIRST_DELVE.dmg = Number(process.env.FD_DMG);

// ROUTE=pack,brute,kilnMother fixes the fights. REACT=seconds gives the bot a reaction time (a novice proxy; see reactBot).
// FORGET=0.1 STEPERR=0.35 add reactBot's execution mistakes (BotMistakes): a chance to never notice a telegraph or
// cast, and steps off by up to that many radians.
// LAG=seconds is the old delayed-input proxy (laggedBot), which overstates melee and group difficulty; kept to compare.
const lagTicks = Math.round(Number(process.env.LAG ?? 0) * 30);
const react = Number(process.env.REACT ?? 0);

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
  const w = new World({ heat: (process.env.HEAT || undefined) as never, stance: (process.env.STANCE || undefined) as never, potion: process.env.POTION as never, seed, dungeon: (process.env.DUNGEON as 'kiln' | 'foundry') ?? 'kiln', tier: Number(process.env.TIER ?? 1), omens: process.env.OMENS !== undefined ? (process.env.OMENS.split(',').filter(Boolean) as OmenId[]) : undefined, cls: (process.env.CLS as 'emberwright' | 'duskblade') ?? 'emberwright', alt: process.env.ALT === '1', firstDelve: process.env.FIRST === '1', route: process.env.ROUTE ? (process.env.ROUTE.split(',') as never) : undefined, halls: process.env.HALLS === '1', hallsTemplate: process.env.HALLSMAP === 'a', bossV2: process.env.BOSSV2 === '1', hallsBeta: process.env.HALLS_BETA === '1' });
  const drive = react ? reactBot(react, skill, { forget: Number(process.env.FORGET ?? 0), stepErr: Number(process.env.STEPERR ?? 0), salt: seed }) : lagTicks ? laggedBot(lagTicks, skill) : (x: World) => botInput(x, skill);
  const c: Record<string, number> = {};
  const bump = (k: string) => (c[k] = (c[k] ?? 0) + 1);
  let bossAt = 0;
  while (w.state !== 'ended' && w.time < 800) {
    if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
    w.step(drive(w));
    hallsTick(w);
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
  hallsSeed(w, s.victory);
}
hallsReport();
console.log(`wins ${wins}/${seeds.length}`);
console.log(`avg hp left on wins ${Math.round(hpLeft / Math.max(1, wins))}`);
