import { describe, expect, it } from 'vitest';
import { expandIPv6, isBlockedAddress, resolveSafeUrl } from './url-guard.js';

describe('isBlockedAddress', () => {
  it.each([
    ['127.0.0.1', 4, true],
    ['10.1.2.3', 4, true],
    ['172.16.5.4', 4, true],
    ['172.32.5.4', 4, false],
    ['192.168.0.10', 4, true],
    ['169.254.169.254', 4, true],
    ['100.64.1.1', 4, true],
    ['0.0.0.0', 4, true],
    ['8.8.8.8', 4, false],
    ['1.1.1.1', 4, false],
    ['::1', 6, true],
    ['fe80::1', 6, true],
    ['fd00::1', 6, true],
    ['::ffff:127.0.0.1', 6, true],
    ['2606:4700:4700::1111', 6, false],
  ])('%s (family %i) blocked=%s', (address, family, expected) => {
    expect(isBlockedAddress(address, family as 4 | 6)).toBe(expected);
  });
});

describe('IPv6 transition forms', () => {
  it('expands literals into eight groups', () => {
    expect(expandIPv6('::1')).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(expandIPv6('::ffff:7f00:1')).toEqual([0, 0, 0, 0, 0, 0xffff, 0x7f00, 1]);
    expect(expandIPv6('2001:db8::8')).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0, 8]);
    expect(expandIPv6('not-an-address')).toBeNull();
  });

  it('blocks IPv4 addresses smuggled through hex mapped forms', () => {
    // WHATWG normalises [::ffff:127.0.0.1] to [::ffff:7f00:1].
    expect(isBlockedAddress('::ffff:7f00:1', 6)).toBe(true);
    expect(isBlockedAddress('::ffff:a9fe:a9fe', 6)).toBe(true); // 169.254.169.254
    expect(isBlockedAddress('::ffff:0a00:0005', 6)).toBe(true); // 10.0.0.5
    expect(isBlockedAddress('::ffff:8080:0808', 6)).toBe(false); // 128.128.8.8 public
  });

  it('blocks NAT64 and 6to4 wrappers around private ranges', () => {
    expect(isBlockedAddress('64:ff9b::7f00:1', 6)).toBe(true);
    expect(isBlockedAddress('2002:7f00:1::', 6)).toBe(true);
    expect(isBlockedAddress('2002:8080:808::', 6)).toBe(false);
  });

  it('blocks unspecified, multicast and unique-local ranges', () => {
    expect(isBlockedAddress('::', 6)).toBe(true);
    expect(isBlockedAddress('ff02::1', 6)).toBe(true);
    expect(isBlockedAddress('fd12:3456::1', 6)).toBe(true);
    expect(isBlockedAddress('2001:4860:4860::8888', 6)).toBe(false);
  });
});

describe('resolveSafeUrl', () => {
  it('rejects non-http protocols', async () => {
    await expect(resolveSafeUrl('file:///etc/passwd')).rejects.toMatchObject({ code: 'bad_request' });
    await expect(resolveSafeUrl('ftp://example.com/file.mp3')).rejects.toMatchObject({ code: 'bad_request' });
  });

  it('rejects embedded credentials', async () => {
    await expect(resolveSafeUrl('http://user:pass@example.com/a.mp3')).rejects.toMatchObject({
      code: 'bad_request',
    });
  });

  it('rejects loopback and metadata literals', async () => {
    await expect(resolveSafeUrl('http://127.0.0.1:8787/api/health')).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(resolveSafeUrl('http://169.254.169.254/latest/meta-data')).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(resolveSafeUrl('http://[::1]/anything')).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('rejects localhost hostnames', async () => {
    await expect(resolveSafeUrl('http://localhost:3000/media.mp3')).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('rejects malformed urls', async () => {
    await expect(resolveSafeUrl('not a url')).rejects.toMatchObject({ code: 'bad_request' });
  });
});
