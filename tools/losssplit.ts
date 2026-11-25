// Untracked scratch: where generator/H1 runs are lost (map room shape + pack, or boss) and the arrival state at the boss.
import { World } from '../sim/world';
import { botChoose, botInput, reactBot } from '../sim/bot';
import { roomAt } from '../sim/halls';
const cls = process.env.CLS as never, tier = Number(process.env.TIER), avg = process.env.SK === 'avg';
const seeds = Array.from({ length: Number(process.env.N ?? 80) }, (_, i) => i + Number(process.env.START ?? 1));
const out: unknown[] = [];
for (const seed of seeds) {
  const w = new World({ seed, dungeon: (process.env.DUNGEON ?? 'kiln') as never, tier, cls, halls: true, hallsTemplate: process.env.HALLSMAP === 'a' } as never);
  const drive = avg ? reactBot(0.3, 1, { forget: 0.2, stepErr: 0.5, salt: seed }) : (x: World) => botInput(x, 1);
  let arrive: { hp: number; frac: number; heat: number; t: number } | null = null, spawn: typeof arrive = null, lv: unknown = null;
  while (w.state !== 'ended' && w.time < 800) {
    if (w.state === 'draft') { w.choose(botChoose(w)); continue; }
    w.step(drive(w));
    if (!spawn && w.events.some((e) => e.type === 'bossSpawn')) spawn = { hp: Math.round(w.player.hp), frac: +(w.player.hp / w.player.maxHp).toFixed(3), heat: Math.round(w.player.heat ?? 0), t: Math.round(w.time) };
    if (!arrive && w.halls && !w.hallsOn) lv = { level: w.summary().level, cleared: w.halls.packs.filter((k) => k.state === 'cleared').map((k) => k.role).join('') } as never;
    if (!arrive && w.halls && !w.hallsOn) arrive = { hp: Math.round(w.player.hp), frac: +(w.player.hp / w.player.maxHp).toFixed(3), heat: Math.round(w.player.heat ?? 0), t: Math.round(w.time) };
  }
  const s = w.summary();
  let where = 'win';
  if (!s.victory) {
    if (w.state !== 'ended') where = 'timeout';
    else if (w.hallsOn) {
      const m = w.halls!, p = w.player, ri = roomAt(m, p.x, p.y);
      const awake = m.packs.filter((k) => k.state === 'awake').map((k) => k.role + '=' + k.enc).join('') || '-';
      where = `map:${ri < 0 ? 'corridor' : m.rooms[ri].shape + '#' + ri}:awake=${awake}`;
    } else where = 'boss';
  }
  out.push({ seed, win: s.victory, where, arrive, spawn, lv, shapes: w.halls?.rooms.map((r) => r.shape).join(',') });
}
console.log(JSON.stringify(out));
