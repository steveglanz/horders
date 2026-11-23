import type { Player } from './world';

/**
 * The loss screen's "what hurt most" line (playtest: a new player's loss screen never said what killed them).
 * Reads the health this hero lost in the fight they fell in (Player.hurtBy, by foe name or hazard) and the last blow.
 * Returns '' when nothing was recorded (an older save's guest snapshot, or a loss with no hits).
 */
export function hurtRecap(p: Pick<Player, 'hurtBy' | 'lastHurtBy'>): string {
  // A boss's full title is long for a phone ("Smolderhusk, the Kiln Mother"): the name before the comma, as the end screen's own line.
  const by = Object.entries(p.hurtBy ?? {}).filter(([, v]) => v > 0).map(([n, v]) => [short(n), v] as const).sort((a, b) => b[1] - a[1]);
  const total = by.reduce((s, [, v]) => s + v, 0);
  if (!total) return '';
  const pct = (v: number) => `${Math.round((100 * v) / total)}%`;
  // Two causes at most, and a second one only when it took a real share (a phone line stays one or two lines).
  const top = by.slice(0, 2).filter(([, v], k) => k === 0 || v / total >= 0.15);
  const most = top.map(([n, v]) => `${n} (${pct(v)})`).join(' and ');
  const lastBy = p.lastHurtBy ? short(p.lastHurtBy) : '';
  const last = lastBy && lastBy !== top[0][0] ? ` Last blow: ${lastBy}.` : '';
  return `Hurt most by ${most}.${last}`;
}

const short = (n: string) => n.split(',')[0].replace(/^The /, 'the ');
