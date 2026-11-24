import { describe, expect, it } from 'vitest';
import { World } from '../sim/world';
import { botChoose, laggedBot } from '../sim/bot';
import { hurtRecap } from '../sim/hurtrecap';
import { applySnapshot, snapshot } from '../sim/netsync';

/** A new player's Kiln delve, driven by the slow novice bot until it ends. */
function lose(seed: number, tier: number): World {
  const w = new World({ seed, cls: 'duskblade', dungeon: 'kiln', tier });
  const drive = laggedBot(15, 0.3);
  while (w.state !== 'ended' && w.time < 900) { if (w.state === 'draft') w.choose(botChoose(w)); else w.step(drive(w)); }
  return w;
}

describe('playtest: the loss screen says what hurt you most', () => {
  it('names the top cause with its share, a second only past 15%, and a different last blow', () => {
    expect(hurtRecap({ hurtBy: { 'Cinder Brute': 96, Cinderhound: 4 }, lastHurtBy: 'Cinder Brute' })).toBe('Hurt most by Cinder Brute (96%).');
    expect(hurtRecap({ hurtBy: { Ashbuck: 70, 'Hollow Warden': 30 }, lastHurtBy: 'Hollow Warden' }))
      .toBe('Hurt most by Ashbuck (70%) and Hollow Warden (30%). Last blow: Hollow Warden.');
  });

  it('shortens a boss title to the name before the comma, and lowercases a leading "The"', () => {
    expect(hurtRecap({ hurtBy: { 'Smolderhusk, the Kiln Mother': 3, 'The Lensmother': 1 } })).toBe('Hurt most by Smolderhusk (75%) and the Lensmother (25%).');
  });

  it('says nothing when nothing was recorded (an older guest snapshot, or no hits)', () => {
    // A name with its own bracket takes the share inside it; a sole cause gets no "(100%)".
    expect(hurtRecap({ hurtBy: { 'Burnout (the fight ran too long)': 60, Cinderhound: 40 } })).toBe('Hurt most by Burnout (the fight ran too long, 60%) and Cinderhound (40%).');
    expect(hurtRecap({ hurtBy: { 'Burnout (the fight ran too long)': 30 } })).toBe('Hurt only by Burnout (the fight ran too long).');
    expect(hurtRecap({})).toBe('');
    expect(hurtRecap({ hurtBy: {} })).toBe('');
  });

  it('a real loss records only the fight it was lost in, and every cause is named', () => {
    let losses = 0;
    for (let seed = 1; seed <= 12 && losses < 3; seed++) {
      const w = lose(seed * 37, 4);
      if (w.summary().victory) continue;
      losses++;
      const by = w.player.hurtBy ?? {};
      const lost = Object.values(by).reduce((s, v) => s + v, 0);
      expect(lost).toBeGreaterThan(0);
      expect(Object.keys(by)).not.toContain('the dungeon');
      expect(w.player.lastHurtBy).toBeTruthy();
      expect(hurtRecap(w.player)).toMatch(/^Hurt (most|only) by /);
    }
    expect(losses).toBeGreaterThan(0);
  });

  it('clears when the next fight starts', () => {
    const w = new World({ seed: 5, cls: 'emberwright', dungeon: 'kiln', tier: 1 });
    w.player.hurtBy = { Ashling: 10 };
    w.player.lastHurtBy = 'Ashling';
    (w as unknown as { startEncounter(): void }).startEncounter();
    expect(w.player.hurtBy).toEqual({});
    expect(w.player.lastHurtBy).toBeUndefined();
  });

  it('reaches a guest with the rest of the hero', () => {
    const host = new World({ seed: 5, dungeon: 'kiln', tier: 2, party: [{ cls: 'lumen' }], partySize: 2 });
    host.heroData(1).player.hurtBy = { Cinderhound: 42 };
    host.heroData(1).player.lastHurtBy = 'Cinderhound';
    const guest = new World({ seed: 5, dungeon: 'kiln', tier: 2, party: [{ cls: 'lumen' }], partySize: 2 });
    applySnapshot(guest, JSON.parse(JSON.stringify(snapshot(host))), 1);
    expect(guest.player.hurtBy).toEqual({ Cinderhound: 42 });
    expect(hurtRecap(guest.player)).toBe('Hurt only by Cinderhound.');
  });
});
