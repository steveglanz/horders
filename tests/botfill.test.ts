import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { BOT_FILL, fillLootShare, botFillBlocker, fillClasses, standInGear } from '../sim/content/botfill';
import type { Item } from '../sim/content/items';

type Kill = { spawn(id: string, x: number, y: number): unknown; killEnemy(e: unknown): void; use(k: number): void };

describe('Fill with bots', () => {
  it('stand-in gear copies the player gear at gearScale, without specials', () => {
    const items: Item[] = [
      { id: 'i1', slot: 'weapon', rarity: 'mythic', ilvl: 20, name: 'A', stats: [{ stat: 'power', value: 50 }], mythic: 'x' as Item['mythic'], weaponFx: 'bankedFlame' },
      { id: 'i2', slot: 'head', rarity: 'epic', ilvl: 20, name: 'B', stats: [{ stat: 'vitality', value: 30 }], set: 'deepguard' },
    ];
    const out = standInGear(items);
    expect(out.map((it) => it.stats[0].value)).toEqual([50 * BOT_FILL.gearScale, 30 * BOT_FILL.gearScale]);
    for (const it of out) {
      expect(it.mythic).toBeUndefined();
      expect(it.weaponFx).toBeUndefined();
      expect(it.set).toBeUndefined();
      expect(it.id.startsWith('bot-')).toBe(true);
    }
    expect(items[0].stats[0].value).toBe(50); // the player's own items are untouched
  });

  it('is offered in group dungeons, never in the raid or a solo dungeon', () => {
    expect(botFillBlocker('hammerdeep')).toBe('');
    expect(botFillBlocker('ashvents')).toBe('');
    expect(botFillBlocker('crucible')).toMatch(/four real heroes/);
    expect(botFillBlocker('kiln')).not.toBe('');
  });

  it('fills to a party of 4, with a tank and a healer first', () => {
    expect(fillClasses([{ cls: 'emberwright' }])).toEqual(['bulwark', 'lumen', 'duskblade']);
    expect(fillClasses([{ cls: 'lumen' }])).toEqual(['bulwark', 'duskblade', 'emberwright']);
    expect(fillClasses([{ cls: 'bulwark' }])).toEqual(['lumen', 'duskblade', 'emberwright']);
    expect(fillClasses([{ cls: 'duskblade' }])).toEqual(['bulwark', 'lumen', 'emberwright']);
    // A Slagbinder's role comes from its stance: Anvil tanks.
    expect(fillClasses([{ cls: 'slagbinder', stance: 'anvil' }])).toEqual(['lumen', 'duskblade', 'emberwright']);
    expect(fillClasses([{ cls: 'slagbinder', stance: 'bellows' }])).toEqual(['bulwark', 'lumen', 'duskblade']);
  });

  it('a bot-filled party gets no extra group boss item', () => {
    for (const [fillBots, each] of [[0, 2], [2, 1]] as const) {
      const w = new World({ seed: 9, dungeon: 'hammerdeep', omens: [], cls: 'bulwark', party: [{ cls: 'lumen' }, { cls: 'duskblade' }], fillBots });
      const inner = w as unknown as Kill;
      const b = inner.spawn('ondrel', 0, 0);
      inner.killEnemy(b);
      for (let k = 0; k < 3; k++) expect(w.heroData(k).runDrops.length).toBe(each);
    }
  });

  it('a bot-filled run keeps only lootShare of its in-run drops; a real party keeps them all', () => {
    type Keep = { fillKeeps(): boolean };
    const kept = (fillBots: number) => {
      const w = new World({ seed: 9, dungeon: 'hammerdeep', omens: [], cls: 'bulwark', party: [{ cls: 'lumen' }], fillBots }) as unknown as Keep;
      let n = 0;
      for (let k = 0; k < 2000; k++) if (w.fillKeeps()) n++;
      return n / 2000;
    };
    expect(kept(0)).toBe(1);
    // V7: the share scales with the bots: 3 bots keep lootShare, 2 keep 60%, 1 keeps 80%.
    expect(Math.abs(kept(3) - BOT_FILL.lootShare)).toBeLessThan(0.04);
    expect(Math.abs(kept(2) - 0.6)).toBeLessThan(0.04);
    expect(Math.abs(kept(1) - 0.8)).toBeLessThan(0.04);
  });

  it('V7: fillLootShare is 40% for 3 bots, 60% for 2, 80% for 1 and all for none', () => {
    expect(fillLootShare(3)).toBeCloseTo(BOT_FILL.lootShare);
    expect(fillLootShare(2)).toBeCloseTo(0.6);
    expect(fillLootShare(1)).toBeCloseTo(0.8);
    expect(fillLootShare(0)).toBe(1);
  });
});
