import dns from 'node:dns/promises';
import net from 'node:net';
import { config } from '../../config.js';
import { AppError } from '../../http/errors.js';

export interface ResolvedTarget {
  url: URL;
  address: string;
  family: 4 | 6;
  allAddresses: string[];
}

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal']);
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];

/**
 * Expands an IPv6 literal into eight 16-bit groups. Returns null when the
 * input is not a valid IPv6 address. Needed because WHATWG URLs normalise
 * IPv4-mapped addresses into hex (`[::ffff:127.0.0.1]` becomes
 * `[::ffff:7f00:1]`), so dotted-quad string checks silently miss them.
 */
export function expandIPv6(address: string): number[] | null {
  const value = address.split('%')[0] ?? '';
  if (!net.isIPv6(value)) return null;
  const [head, tail] = value.split('::') as [string | undefined, string | undefined];
  const parseGroups = (chunk: string | undefined): string[] =>
    chunk ? chunk.split(':').filter((part) => part.length > 0) : [];
  let groups: string[];
  if (value.includes('::')) {
    const left = parseGroups(head);
    const right = parseGroups(tail);
    const missing = 8 - left.length - right.length;
    if (missing < 0) return null;
    groups = [...left, ...Array.from({ length: missing }, () => '0'), ...right];
  } else {
    groups = parseGroups(value);
  }
  if (groups.length !== 8) return null;
  const parsed = groups.map((group) => Number.parseInt(group, 16));
  return parsed.every((group) => Number.isFinite(group) && group >= 0 && group <= 0xffff) ? parsed : null;
}

const ipv4FromGroups = (groups: number[], offset: number): string =>
  [groups[offset]! >> 8, groups[offset]! & 0xff, groups[offset + 1]! >> 8, groups[offset + 1]! & 0xff].join('.');

/**
 * Rejects private, loopback, link-local, CGNAT, multicast and reserved
 * destinations. Without this, a user-supplied URL becomes an SSRF primitive
 * against the machine's own services and cloud metadata endpoints. IPv6
 * transition forms (IPv4-mapped, NAT64, 6to4) are unwrapped before the check
 * because each of them can smuggle a private IPv4 literal.
 */
export function isBlockedAddress(address: string, family: 4 | 6): boolean {
  if (family === 6) {
    const groups = expandIPv6(address);
    if (!groups) return true;
    const allZero = groups.every((group) => group === 0);
    if (allZero) return true; // ::
    if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return true; // ::1
    const first = groups[0]!;
    if ((first & 0xfe00) === 0xfe00) return true; // fe80::/10 link-local
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    const embeds = (prefix: number[], offset: number): boolean =>
      prefix.every((group, index) => groups[index] === group) &&
      isBlockedAddress(ipv4FromGroups(groups, offset), 4);
    if (embeds([0, 0, 0, 0, 0, 0xffff], 6)) return true; // ::ffff:0:0/96 IPv4-mapped
    if (embeds([0, 0, 0, 0, 0, 0], 6) && !allZero) return true; // deprecated IPv4-compatible
    if (embeds([0x64, 0xff9b, 0, 0, 0, 0], 6)) return true; // 64:ff9b::/96 NAT64
    if (first === 0x2002) {
      // 6to4 embeds the IPv4 address in groups 1 and 2.
      if (isBlockedAddress(ipv4FromGroups(groups, 1), 4)) return true;
    }
    return false;
  }
  if (!net.isIPv4(address)) return true;
  const octets = address.split('.').map(Number);
  const [a, b] = octets as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && octets[2] === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 192 && b === 0 && octets[2] === 2) return true; // TEST-NET-1
  if (a === 198 && b === 51 && octets[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && octets[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

export async function resolveSafeUrl(raw: string): Promise<ResolvedTarget> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError('bad_request', 'That is not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError('bad_request', 'Only http and https URLs can be acquired');
  }
  if (url.username || url.password) {
    throw new AppError('bad_request', 'URLs containing embedded credentials are refused');
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) throw new AppError('bad_request', 'URL has no hostname');
  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    if (!config.ALLOW_PRIVATE_NETWORK) {
      throw new AppError('forbidden', 'Requests to local or internal hostnames are not allowed');
    }
  }

  let records: { address: string; family: number }[] = [];
  if (net.isIP(hostname)) {
    records = [{ address: hostname, family: net.isIPv6(hostname) ? 6 : 4 }];
  } else {
    try {
      records = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new AppError('bad_request', `Could not resolve ${hostname}`);
    }
  }
  if (records.length === 0) throw new AppError('bad_request', `Could not resolve ${hostname}`);

  const resolved = records.map((record) => ({
    address: record.address,
    family: (record.family === 6 ? 6 : 4) as 4 | 6,
  }));

  if (!config.ALLOW_PRIVATE_NETWORK) {
    const blocked = resolved.find((record) => isBlockedAddress(record.address, record.family));
    if (blocked) {
      throw new AppError(
        'forbidden',
        'That host resolves to a private or reserved address, which SonicWire refuses to contact',
      );
    }
  }

  const chosen = resolved[0] as { address: string; family: 4 | 6 };
  return {
    url,
    address: chosen.address,
    family: chosen.family,
    allAddresses: resolved.map((record) => record.address),
  };
}
