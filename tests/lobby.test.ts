import { describe, expect, it } from 'vitest';
import { pickParty, shouldMerge, LobbyAd, cleanAd, roleOf, needs, LobbyRole } from '../client/net/lobby';
import { CLASSES } from '../sim/content/classes';

const ad = (code: string, n: number, max = 4): LobbyAd => ({ code, n, max, name: 'Hero ' + code });

describe('quick join lobby', () => {
  it('picks the fullest party with a free spot', () => {
    expect(pickParty([ad('AAAAA', 1), ad('BBBBB', 3), ad('CCCCC', 2)])?.code).toBe('BBBBB');
  });
  it('skips full parties, your own party and empty ads', () => {
    expect(pickParty([ad('AAAAA', 4), ad('BBBBB', 2), ad('CCCCC', 0)], 'BBBBB')).toBeNull();
    expect(pickParty([ad('AAAAA', 2, 2)])).toBeNull();
  });
  it('breaks ties by code so two seekers agree', () => {
    expect(pickParty([ad('ZZZZZ', 2), ad('KKKKK', 2)])?.code).toBe('KKKKK');
  });
  it('folds only one of two lone parties into the other', () => {
    const a = ad('AAAAA', 1), b = ad('BBBBB', 1);
    expect(shouldMerge(b, [a])?.code).toBe('AAAAA');
    expect(shouldMerge(a, [b])).toBeNull();
  });
  it('a lone party joins one that already has company, whatever its code', () => {
    expect(shouldMerge(ad('AAAAA', 1), [ad('ZZZZZ', 2)])?.code).toBe('ZZZZZ');
    expect(shouldMerge(ad('AAAAA', 2), [ad('BBBBB', 3)])).toBeNull();
  });
  it('strips markup from names other players advertise', () => {
    expect(cleanAd({ code: 'ABCDE', n: 1, max: 4, name: '<img src=x onerror=alert(1)>Mal' })?.name).toBe('img srcx onerroralert1Mal');
    expect(cleanAd({ code: 'ABCDE', n: 1, max: 4, name: '<>' })?.name).toBe('A hero');
    expect(cleanAd({ code: 'abc', n: 1, max: 4, name: 'x' })).toBeNull();
  });
  it('maps every class to a lobby role', () => {
    expect(Object.values(CLASSES).map((c) => [c.id, roleOf(c.role)])).toEqual([
      ['emberwright', 'dps'], ['duskblade', 'dps'], ['bulwark', 'tank'], ['lumen', 'healer'],
    ]);
  });
  it('sends a healer to the party without one, ahead of a fuller party', () => {
    const withRoles = (code: string, roles: LobbyRole[]): LobbyAd => ({ ...ad(code, roles.length), roles });
    const ads = [withRoles('AAAAA', ['tank', 'healer', 'dps']), withRoles('BBBBB', ['tank'])];
    expect(pickParty(ads, undefined, 'healer')?.code).toBe('BBBBB');
    expect(pickParty(ads, undefined, 'dps')?.code).toBe('AAAAA');
    expect(pickParty(ads)?.code).toBe('AAAAA');
    expect(needs(['tank'])).toEqual(['healer']);
    expect(needs()).toEqual(['tank', 'healer']);
  });
  it('keeps only known roles from the network', () => {
    expect(cleanAd({ code: 'ABCDE', n: 2, max: 4, name: 'x', roles: ['tank', '<b>', 'healer'] })?.roles).toEqual(['tank', 'healer']);
    expect(cleanAd({ code: 'ABCDE', n: 1, max: 4, name: 'x' })?.roles).toBeUndefined();
  });
});
