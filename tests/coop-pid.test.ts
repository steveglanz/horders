import { describe, expect, it } from 'vitest';
import { cleanPid } from '../client/net/coop';

describe('co-op player ids (rejoin a delve after a drop)', () => {
  it('keeps 8 to 16 lowercase letters and digits, and nothing else', () => {
    expect(cleanPid('a1b2c3d4')).toBe('a1b2c3d4');
    expect(cleanPid('abcdefghij123456')).toBe('abcdefghij123456');
    for (const bad of ['short', 'abcdefghij1234567', 'ABCDEFGH', 'abcd efgh', '<script>x', 12345678, null, undefined, {}]) expect(cleanPid(bad)).toBeUndefined();
  });
});
