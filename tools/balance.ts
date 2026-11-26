// Plays bot runs and reports outcomes plus how often the MMO mechanics fire.
import { readFileSync } from 'fs';
import { equippedItems, HeroProfile } from '../sim/hero';
import * as WORLD from '../sim/world';
import { World } from '../sim/world';
import { OmenId } from '../sim/content/omens';
import { botChoose, botInput, laggedBot, reactBot } from '../sim/bot';
import { buildPoints } from '../sim/content/trees';
import type { ClassId } from '../sim/content/emberwright';
import { hallsReport, hallsSeed, hallsTick } from './hallsmeasure';
import { FIRST_DELVE } from '../sim/content/firstdelve';
import { TRASH_ON } from '../sim/halls';
import type { DungeonId } from '../sim/content/dungeon';

// TRASH=glarewell,coldmarrow (measuring only): those maps' openers as trash too, as the Kiln's and the Foundry's are
// for players (sim/halls.ts TRASH_ON), to grid the next dungeons of the trash rollout before they go on.
if (process.env.TRASH) TRASH_ON.push(...(process.env.TRASH.split(',') as DungeonId[]));

// FIRST=1 plays a first delve (L1); FD_HP and FD_DMG override its multipliers.
if (process.env.FD_HP) FIRST_DELVE.hp = Number(process.env.FD_HP);
if (process.env.FD_DMG) FIRST_DELVE.dmg = Number(process.env.FD_DMG);

// ROUTE=pack,brute,kilnMother fixes the fights. REACT=seconds gives the bot a reaction time (a novice proxy; see reactBot).
// FORGET=0.1 STEPERR=0.35 add reactBot's execution mistakes (BotMistakes): a chance to never notice a telegraph or
// cast, and steps off by up to that many radians.
// LAG=seconds is the old delayed-input proxy (laggedBot), which overstates melee and group difficulty; kept to compare.
const lagTicks = Math.round(Number(process.env.LAG ?? 0) * 30);
const react = Number(process.env.REACT ?? 0);
// HERO=tools/heroes/hero-t6.json plays with that hero's gear, passives and level (as in tools/foundry.ts), for the higher tiers.
const hero: HeroProfile | null = process.env.HERO ? JSON.parse(readFileSync(process.env.HERO, 'utf8')) : null;
// TREE=bastion|retribution|vanguard (character trees, content/trees.ts): the hero's stat points become that branch's fixed
// build (TREE_BUILDS) with the same number of points (level - 1), for the class given by CLS.
const treePoints = (h: { level: number; passives: Record<string, number | undefined> }) => (process.env.TREE ? buildPoints((process.env.CLS ?? 'emberwright') as ClassId, process.env.TREE, h.level - 1) : h.passives);
const heroOpts = hero ? { gear: equippedItems(hero), passives: treePoints(hero), heroLevel: hero.level, nextItemId: hero.nextItemId } : {};

// ULVL=1 plays with only the abilities a level-1 character has unlocked (SLOT_UNLOCK in content/classes.ts).
// TUNE=DEFENCE_BRANCH.ringDamage=30 overrides an exported tuning number for this run only.
for (const kv of (process.env.TUNE ?? '').split(',').filter(Boolean)) {
  const [path, v] = kv.split('=');
  const keys = path.split('.');
  let o = (WORLD as unknown as Record<string, Record<string, unknown>>)[keys[0]] as Record<string, unknown>;
  for (const k of keys.slice(1, -1)) o = o[k] as Record<string, unknown>;
  o[keys[keys.length - 1]] = Number(v);
}
// KMSTAT=1 (BOSSV2): prints the kiln stages, how many ended with all 3 bellows broken, and Kiln Heat's hp loss per stage.
const kmStat = { stages: 0, broken: 0, heat: 0 };
if (process.env.KMSTAT === '1') {
  const proto = World.prototype as unknown as { hurtPlayer(this: World, amount: number, ...rest: unknown[]): unknown };
  const orig = proto.hurtPlayer;
  proto.hurtPlayer = function (this: World, amount: number, ...rest: unknown[]) {
    const before = this.player.hp;
    const r = orig.call(this, amount, ...rest);
    if (rest[2] === 'Kiln Heat') kmStat.heat += Math.max(0, before - this.player.hp) / this.player.maxHp;
    return r;
  };
}
const skill = Number(process.env.SKILL ?? 1);
const seeds = (process.env.SEEDS ?? '1,2,3,4,5,6,7,8').split(',').map(Number);
let wins = 0;
let hpLeft = 0;
for (const seed of seeds) {
  const w = new World({ ...heroOpts, heat: (process.env.HEAT || undefined) as never, stance: (process.env.STANCE || undefined) as never, potion: process.env.POTION as never, seed, dungeon: (process.env.DUNGEON as 'kiln' | 'foundry') ?? 'kiln', tier: Number(process.env.TIER ?? 1), omens: process.env.OMENS !== undefined ? (process.env.OMENS.split(',').filter(Boolean) as OmenId[]) : undefined, cls: (process.env.CLS as 'emberwright' | 'duskblade') ?? 'emberwright', alt: process.env.ALT === '1', alts: process.env.ALT && process.env.ALT !== '1' ? (process.env.ALT.split(',') as never) : undefined, firstDelve: process.env.FIRST === '1', route: process.env.ROUTE ? (process.env.ROUTE.split(',') as never) : undefined, halls: process.env.HALLS === '1', hallsTemplate: process.env.HALLSMAP === 'a', gunner: process.env.GUNNER === '0' ? false : undefined, unlockLevel: process.env.ULVL ? Number(process.env.ULVL) : undefined });
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
      if (ev.type === 'castDone' && (ev.id === 'kmFallen' || ev.id === 'kmOut')) { kmStat.stages++; if (ev.id === 'kmFallen') kmStat.broken++; }
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
if (process.env.KMSTAT === '1') console.log(`kiln stages ${kmStat.stages}, all bellows broken ${kmStat.broken}, Kiln Heat hp lost per stage ${((100 * kmStat.heat) / Math.max(1, kmStat.stages)).toFixed(1)}%`);
