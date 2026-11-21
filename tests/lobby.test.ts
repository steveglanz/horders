import { describe, expect, it } from 'vitest';
import { pickParty, shouldMerge, LobbyAd } from '../client/net/lobby';

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
});
