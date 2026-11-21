import { describe, expect, it } from 'vitest';
import { World, PARTY_CARDS, SLAG_KIT } from '../sim/world';
import { BOT_PRIORITY } from '../sim/bot';
import { TALENTS, TalentId } from '../sim/content/emberwright';
import type { ClassId } from '../sim/content/emberwright';

type Inner = {
  use(i: number): void;
  spawn(kind: string, x: number, y: number): number;
  combustion(): void;
  hurtPlayer(amount: number, src?: number): void;
  healAllies(x: number, y: number, r: number, amount: number, only?: number, cleanse?: boolean): number;
  damageEnemy(i: number, amount: number, canCrit: boolean): void;
  shellCovers(q: unknown): boolean;
  broadBack(k: number): void;
  rebuildHash(): void;
  regen: number;
  bossIndex: number;
  talents: Partial<Record<TalentId, number>>;
  threat: { target: string | null; amounts: Record<string, number> }[];
};

const PARTY: TalentId[] = ['leeSide', 'broadBack', 'frontMend', 'wideDawn', 'turnedBack', 'sharedBreath', 'longKindle', 'closeWarmth', 'longStand', 'wideShell'];
const CLASSES: ClassId[] = ['emberwright', 'duskblade', 'bulwark', 'lumen', 'slagbinder'];

/** Hero 0 of `main` at the origin of the fight, `rest` standing `gap` px to its right, Ondrel up and no other foes. */
function party(main: ClassId, rest: ClassId[], gap = 100): { w: World; inner: Inner; b: number } {
  const w = new World({ seed: 4, dungeon: 'hammerdeep', omens: [], cls: main, party: rest.map((cls) => ({ cls })) });
  for (const e of w.enemies) e.alive = false;
  const inner = w as unknown as Inner;
  const b = inner.spawn('ondrel', w.player.x + 300, w.player.y + 300);
  inner.bossIndex = b;
  for (let k = 1; k < w.heroes.length; k++) Object.assign(w.heroes[k].player, { x: w.player.x + gap, y: w.player.y });
  return { w, inner, b };
}

function aggro(w: World, inner: Inner, b: number, k: number): void {
  inner.threat[b].target = w.heroes[k].id;
  inner.threat[b].amounts[w.heroes[k].id] = 1000;
}

/** One capstone from every branch of `cls`, so deep cards are open. */
function capped(cls: ClassId): Partial<Record<TalentId, number>> {
  const out: Partial<Record<TalentId, number>> = {};
  const seen = new Set<string>();
  for (const d of Object.values(TALENTS)) {
    if (d.cls === cls && d.capstone && !seen.has(d.branch)) { seen.add(d.branch); out[d.id] = 1; }
  }
  return out;
}

describe('party cards (Season 2)', () => {
  it('two per class, all deep party cards the bot knows', () => {
    for (const cls of CLASSES) expect(PARTY.filter((id) => TALENTS[id].cls === cls)).toHaveLength(2);
    for (const id of PARTY) {
      expect(TALENTS[id].party).toBe(true);
      expect(TALENTS[id].deep).toBe(true);
      expect(BOT_PRIORITY).toContain(id);
    }
    expect((Object.values(TALENTS)).filter((d) => d.party).map((d) => d.id).sort()).toEqual([...PARTY].sort());
  });

  it('solo drafts never offer them; party drafts do once the capstone is taken', () => {
    const solo = new Set<string>();
    const duo = new Set<string>();
    for (const cls of CLASSES) {
      for (let s = 1; s <= 60; s++) {
        const a = new World({ seed: s, cls, tier: 4, omens: [] });
        (a as unknown as Inner).talents = capped(cls);
        for (const o of a.rollDraft()) solo.add(o.id);
        const b = new World({ seed: s, cls, tier: 4, omens: [], party: [{ cls: 'bulwark' }] });
        (b as unknown as Inner).talents = capped(cls);
        for (const o of b.rollDraft()) duo.add(o.id);
      }
    }
    expect(PARTY.filter((id) => solo.has(id))).toEqual([]);
    expect(PARTY.filter((id) => !duo.has(id))).toEqual([]);
  });

  it('Lee Side: a hero close to the Bulwark takes 5% less per rank', () => {
    const hit = (rank: number, gap: number) => {
      const { w, inner } = party('duskblade', ['bulwark'], gap);
      w.heroes[1].talents.leeSide = rank;
      const before = w.player.hp;
      inner.hurtPlayer(100);
      return before - w.player.hp;
    };
    const base = hit(0, 100);
    expect(hit(2, 100)).toBeCloseTo(base * (1 - 2 * PARTY_CARDS.leeCut));
    expect(hit(2, PARTY_CARDS.leeRadius + 50)).toBeCloseTo(base);
  });

  it('Close Warmth: heroes near the Emberwright regenerate', () => {
    const { w, inner } = party('duskblade', ['emberwright']);
    const base = inner.regen;
    w.heroes[1].talents.closeWarmth = 2;
    expect(inner.regen).toBeCloseTo(base + 2 * PARTY_CARDS.warmRegen);
    w.heroes[1].player.x = w.player.x + PARTY_CARDS.warmRadius + 50;
    expect(inner.regen).toBeCloseTo(base);
  });

  it('Wide Shell: Cooling Shell reaches 50 px farther, in either stance', () => {
    for (const stance of ['anvil', 'bellows'] as const) {
      const { w, inner } = party('duskblade', ['slagbinder'], SLAG_KIT.shellRadius + 30);
      const s = w.heroes[1].player;
      s.stance = stance;
      s.shellUntil = w.time + 5;
      expect(inner.shellCovers(w.player)).toBe(false);
      w.heroes[1].talents.wideShell = 1;
      expect(inner.shellCovers(w.player)).toBe(true);
    }
  });

  it('Front Mend: the Lumen heals the hero the boss is on harder', () => {
    const heal = (rank: number, onAlly: boolean) => {
      const { w, inner, b } = party('lumen', ['bulwark']);
      inner.talents = { frontMend: rank };
      aggro(w, inner, b, onAlly ? 1 : 0);
      w.heroes[1].player.hp = 1;
      return inner.healAllies(w.player.x, w.player.y, 500, 10);
    };
    expect(heal(0, true)).toBeCloseTo(10);
    expect(heal(1, true)).toBeCloseTo(10 * (1 + PARTY_CARDS.frontMend));
    expect(heal(1, false)).toBeCloseTo(10);
  });

  it('Turned Back: the Duskblade hits the boss harder while it attacks someone else', () => {
    const dealt = (rank: number, onAlly: boolean) => {
      const { w, inner, b } = party('duskblade', ['bulwark']);
      inner.talents = { turnedBack: rank };
      aggro(w, inner, b, onAlly ? 1 : 0);
      const e = w.enemies[b];
      const before = e.hp;
      inner.damageEnemy(b, 100, false);
      return before - e.hp;
    };
    expect(dealt(2, true)).toBeCloseTo(dealt(0, true) * (1 + 2 * PARTY_CARDS.turnedBack));
    expect(dealt(2, false)).toBeCloseTo(dealt(0, false));
  });

  it('Broad Back: taking the boss off an ally heals that ally', () => {
    const { w, inner } = party('bulwark', ['duskblade']);
    const a = w.heroes[1].player;
    a.hp = a.maxHp * 0.5;
    inner.broadBack(1);
    expect(a.hp).toBeCloseTo(a.maxHp * 0.5);
    inner.talents = { broadBack: 1 };
    inner.broadBack(1);
    expect(a.hp).toBeCloseTo(a.maxHp * (0.5 + PARTY_CARDS.broadHeal));
  });

  it('Long Kindle: Kindling reaches farther', () => {
    const kindled = (rank: number) => {
      const { w, inner } = party('emberwright', ['duskblade'], 320 + 40);
      inner.talents = { longKindle: rank };
      inner.rebuildHash();
      inner.combustion();
      return (w.heroes[1].player.kindleUntil ?? -1) > w.time;
    };
    expect(kindled(0)).toBe(false);
    expect(kindled(1)).toBe(true);
  });
});
