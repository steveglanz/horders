// OMENS for the balance tools: which Omens a tool run plays with.
//   unset or OMENS=none  no Omens (the tools' old default; optimistic from tier 3, and most at t10+ where the client plays 3)
//   OMENS=client         what a normal delve gets in the client: omensFor(tier, week), with WEEK=n or else this week
//   OMENS=rotate         the client's pick, but each seed plays a different week (seed n plays week n), to average weeks
//   OMENS=a,b,c          exactly these Omen ids
import { OMEN_IDS, OmenId, omensFor, weekOf } from '../sim/content/omens';

export function toolOmens(tier: number, seed: number, env = process.env): OmenId[] {
  const v = (env.OMENS ?? '').trim();
  if (!v || v === 'none') return [];
  if (v === 'client') return omensFor(tier, env.WEEK !== undefined ? Number(env.WEEK) : weekOf(Date.now()));
  if (v === 'rotate') return omensFor(tier, seed);
  const ids = v.split(',').filter(Boolean) as OmenId[];
  const bad = ids.filter((o) => !OMEN_IDS.includes(o));
  if (bad.length) throw new Error(`OMENS: unknown Omen ${bad.join(', ')} (use none, client, rotate or ids from ${OMEN_IDS.join(', ')})`);
  return ids;
}
