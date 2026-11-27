import type { Player } from './world';

/**
 * 1.0 Checkpoint 2, piece 10 (docs/design/checkpoint-2-grey-box.md): the mastery card on every end screen. It shows how
 * the hero played, not what they got: red blows dodged (x of y), casts Kicked (x of y, kick classes only), gold circles
 * made, the blow that felled them, one lesson line, and the best time for this place and tier. Never empty, on a loss
 * too: the lesson line is always there. Game voice (docs/design/world.md part 2): plain, second person, exact numbers.
 */
export interface MasteryInput {
  victory: boolean;
  player: Pick<Player, 'tells' | 'dodges' | 'castsMissed' | 'interrupts' | 'hurtBy' | 'lastHurtBy'>;
  /** The class's F is a Kick (an interrupt), and its name ("Quench", "Kick"). */
  kick: boolean;
  fName: string;
  /** Gold circles that landed this run, and the ones somebody stood in. */
  soaks: number;
  soaksMade: number;
  /** Run time in seconds; the place's short name ("Kiln Depths") and the tier. */
  time: number;
  place: string;
  tier: number;
  /** Whether this run counts for a best time (hero.ts bestKey), the best before this run, and whether it set a new one. */
  timed: boolean;
  bestBefore?: number;
  newBest?: boolean;
}

export interface MasteryTile {
  label: string;
  value: string;
  /** All of them: the tile reads as a clean sweep. */
  clean: boolean;
}

export interface Mastery {
  tiles: MasteryTile[];
  /** "Felled by Ashbuck" on a loss, else ''. */
  blow: string;
  lesson: string;
  /** "Kiln Depths tier 2 best: 6:12" and the like, or '' for a run that sets no best time. */
  best: string;
}

/** A dodge or kick share below this is worth a lesson, once at least LESSON_MIN were missed. */
const LESSON_SHARE = 0.7;
const LESSON_MIN = 2;

export function clock(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A boss's full title is long for a phone: the name before the comma ("Smolderhusk, the Kiln Mother" -> "Smolderhusk"). */
const short = (n: string) => n.split(',')[0].replace(/^The /, 'the ');

export function mastery(m: MasteryInput): Mastery {
  const p = m.player;
  const tells = p.tells ?? 0;
  const dodges = Math.min(tells, p.dodges ?? 0);
  // Casts stopped, of casts stopped plus the ones that went off.
  const kicks = m.kick ? p.interrupts ?? 0 : 0;
  const casts = m.kick ? kicks + (p.castsMissed ?? 0) : 0;
  const tiles: MasteryTile[] = [];
  if (tells > 0) tiles.push({ label: 'Dodged', value: `${dodges} of ${tells}`, clean: dodges === tells });
  if (casts > 0) tiles.push({ label: m.fName, value: `${kicks} of ${casts}`, clean: kicks === casts });
  if (m.soaks > 0) tiles.push({ label: 'Gold circles', value: `${m.soaksMade} of ${m.soaks}`, clean: m.soaksMade === m.soaks });

  const blow = !m.victory && p.lastHurtBy ? `Felled by ${short(p.lastHurtBy)}` : '';

  // One lesson, the most useful first: a missed gold circle, then red blows, then casts, then what took the most health.
  const missedSoaks = m.soaks - m.soaksMade;
  const missedDodges = tells - dodges;
  const missedKicks = casts - kicks;
  let lesson = '';
  if (missedSoaks > 0) lesson = 'Stand in gold circles before they land. An empty one hurts.';
  else if (missedDodges >= LESSON_MIN && dodges / tells < LESSON_SHARE) lesson = 'Red ground lands where it shows. Walk out, or roll through it.';
  else if (missedKicks >= LESSON_MIN && kicks / casts < LESSON_SHARE) lesson = `Stop blue casts with ${m.fName} (F) before the bar fills.`;
  else if (!m.victory) {
    const by = Object.entries(p.hurtBy ?? {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const total = by.reduce((s, [, v]) => s + v, 0);
    lesson = total > 0
      ? `Watch ${short(by[0][0])}: it took ${Math.round((100 * by[0][1]) / total)}% of your health.`
      : 'Your gear and levels carry into the next delve.';
  } else if (tiles.length && tiles.every((t) => t.clean)) lesson = 'Clean run. Try the next tier.';
  else lesson = 'Win the next tier for better loot.';

  let best = '';
  if (m.timed) {
    const where = `${m.place} tier ${m.tier}`;
    if (m.victory && m.newBest) best = m.bestBefore !== undefined ? `New best for ${where}: ${clock(m.time)} (was ${clock(m.bestBefore)})` : `First win in ${where}: ${clock(m.time)}`;
    else if (m.bestBefore !== undefined) best = `Best for ${where}: ${clock(m.bestBefore)}${m.victory ? ` (this run ${clock(m.time)})` : ''}`;
    else best = `No best time in ${where} yet. Win it to set one.`;
  }
  return { tiles, blow, lesson, best };
}
