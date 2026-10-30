import type { Provider } from '@sonicwire/contracts';

export interface ProviderDefinition {
  id: string;
  name: string;
  category: Provider['category'];
  hostnames: string[];
  auth: Provider['auth'];
  capabilities: Provider['capabilities'];
  /** How SonicWire may ingest media from this provider. */
  ingestion: 'direct-media' | 'link-only';
  restrictions: string[];
  requiredEnv: string[];
  docsUrl: string;
}

/**
 * Provider registry.
 *
 * Every entry states what the *official* API actually permits. `link-only`
 * means SonicWire will store a reference to the content and never fetch the
 * bytes, because no official download API exists and scraping would violate the
 * provider's terms. This registry is the single gate used by the acquisition
 * route, so an unsupported operation cannot quietly become a fetch.
 *
 * Researched 2026-10-30 from provider developer documentation. Quotas and
 * eligibility rules change frequently — re-verify before implementing a
 * connector. See docs/research/provider-research/README.md.
 */
export const PROVIDERS: ProviderDefinition[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    category: 'video',
    hostnames: ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'],
    auth: 'oauth2',
    capabilities: {
      metadata: 'official-api',
      search: 'official-api',
      publish: 'official-api',
      analytics: 'official-api',
      scheduling: 'none',
    },
    ingestion: 'link-only',
    restrictions: [
      'No public download API exists; downloading videos violates the YouTube Terms of Service.',
      'Data API v3 search costs 100 quota units per call against a 10,000 unit/day default quota.',
      'Unaudited API projects can only upload private videos; public uploads require an audit.',
    ],
    requiredEnv: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],
    docsUrl: 'https://developers.google.com/youtube/v3/docs',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    category: 'social',
    hostnames: ['instagram.com', 'www.instagram.com'],
    auth: 'oauth2',
    capabilities: {
      metadata: 'official-api',
      search: 'none',
      publish: 'official-api',
      analytics: 'official-api',
      scheduling: 'none',
    },
    ingestion: 'link-only',
    restrictions: [
      'Content Publishing API supports single images, videos, reels and carousels for professional accounts only.',
      'Publishing is rate limited per rolling 24-hour window and requires a Business or Creator account.',
      'Public content search is not offered by the official API.',
    ],
    requiredEnv: ['INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET'],
    docsUrl: 'https://developers.facebook.com/docs/instagram-platform',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    category: 'social',
    hostnames: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'],
    auth: 'oauth2',
    capabilities: {
      metadata: 'official-api',
      search: 'none',
      publish: 'official-api',
      analytics: 'official-api',
      scheduling: 'none',
    },
    ingestion: 'link-only',
    restrictions: [
      'Content Posting API direct posting requires an approved app and verified domain; unaudited clients can only upload to draft.',
      'Rate limits are per-user and per-app; private accounts cannot be read by third parties.',
    ],
    requiredEnv: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
    docsUrl: 'https://developers.tiktok.com/doc/content-posting-api-get-started',
  },
  {
    id: 'x',
    name: 'X',
    category: 'social',
    hostnames: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
    auth: 'oauth2-pkce',
    capabilities: {
      metadata: 'official-api',
      search: 'official-api',
      publish: 'official-api',
      analytics: 'official-api',
      scheduling: 'none',
    },
    ingestion: 'link-only',
    restrictions: [
      'API access is tiered and metered; read allowances on lower tiers are small and change often.',
      'Media upload requires the v2 media endpoints plus OAuth 2.0 user context.',
      'No official media download API for third-party posts.',
    ],
    requiredEnv: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
    docsUrl: 'https://docs.x.com/x-api',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    category: 'video',
    hostnames: ['twitch.tv', 'www.twitch.tv', 'clips.twitch.tv'],
    auth: 'oauth2',
    capabilities: {
      metadata: 'official-api',
      search: 'official-api',
      publish: 'none',
      analytics: 'none',
      scheduling: 'none',
    },
    ingestion: 'link-only',
    restrictions: [
      'Helix exposes streams, VODs and clips metadata; VOD file downloads require the broadcaster’s own access.',
      'Official API does not permit third-party redistribution of VOD media.',
    ],
    requiredEnv: ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET'],
    docsUrl: 'https://dev.twitch.tv/docs/api/',
  },
  {
    id: 'soundcloud',
    name: 'SoundCloud',
    category: 'audio',
    hostnames: ['soundcloud.com', 'www.soundcloud.com', 'on.soundcloud.com'],
    auth: 'oauth2',
    capabilities: {
      metadata: 'official-api',
      search: 'official-api',
      publish: 'official-api',
      analytics: 'none',
      scheduling: 'none',
    },
    ingestion: 'link-only',
    restrictions: [
      'Public API registration is restricted; new client credentials may not be issued.',
      'Downloading tracks requires the creator to enable downloads and the listener to be authorized.',
    ],
    requiredEnv: ['SOUNDCLOUD_CLIENT_ID', 'SOUNDCLOUD_CLIENT_SECRET'],
    docsUrl: 'https://developers.soundcloud.com/docs/api/guide',
  },
  {
    id: 'vimeo',
    name: 'Vimeo',
    category: 'video',
    hostnames: ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'],
    auth: 'oauth2',
    capabilities: {
      metadata: 'official-api',
      search: 'official-api',
      publish: 'official-api',
      analytics: 'official-api',
      scheduling: 'none',
    },
    ingestion: 'link-only',
    restrictions: [
      'Tus-based resumable upload is officially supported for paid account tiers.',
      'Video file download URLs are only issued when the owner enables downloads.',
    ],
    requiredEnv: ['VIMEO_CLIENT_ID', 'VIMEO_CLIENT_SECRET'],
    docsUrl: 'https://developer.vimeo.com/api/reference',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    category: 'social',
    hostnames: ['reddit.com', 'www.reddit.com', 'old.reddit.com'],
    auth: 'oauth2',
    capabilities: {
      metadata: 'official-api',
      search: 'official-api',
      publish: 'official-api',
      analytics: 'none',
      scheduling: 'none',
    },
    ingestion: 'link-only',
    restrictions: [
      'Data API access requires registration and adheres to usage-rate and content-use terms.',
      'Media hosted by Reddit is not downloadable through the official API.',
    ],
    requiredEnv: ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'],
    docsUrl: 'https://www.reddit.com/dev/api/',
  },
  {
    id: 'internet-archive',
    name: 'Internet Archive',
    category: 'archive',
    hostnames: ['archive.org', 'www.archive.org', 'ia800000.us.archive.org'],
    auth: 'none',
    capabilities: {
      metadata: 'official-api',
      search: 'official-api',
      publish: 'official-api',
      analytics: 'none',
      scheduling: 'none',
    },
    ingestion: 'direct-media',
    restrictions: [
      'Only items marked as publicly downloadable may be fetched; lending-library items are access-controlled.',
      'Respect the item’s stated licence and the Archive’s rate limits; identify your client in the user agent.',
    ],
    requiredEnv: [],
    docsUrl: 'https://archive.org/developers/',
  },
  {
    id: 'wikimedia',
    name: 'Wikimedia Commons',
    category: 'archive',
    hostnames: ['commons.wikimedia.org', 'upload.wikimedia.org', 'wikipedia.org'],
    auth: 'none',
    capabilities: {
      metadata: 'official-api',
      search: 'official-api',
      publish: 'official-api',
      analytics: 'none',
      scheduling: 'none',
    },
    ingestion: 'direct-media',
    restrictions: [
      'Freely licensed media may be fetched from upload.wikimedia.org; attribution requirements travel with the licence.',
      'Non-free media on Wikipedia is not redistributable.',
    ],
    requiredEnv: [],
    docsUrl: 'https://www.mediawiki.org/wiki/API:Main_page',
  },
  {
    id: 'podcast-rss',
    name: 'Podcast / RSS enclosures',
    category: 'audio',
    hostnames: [],
    auth: 'none',
    capabilities: {
      metadata: 'official-api',
      search: 'none',
      publish: 'none',
      analytics: 'none',
      scheduling: 'none',
    },
    ingestion: 'direct-media',
    restrictions: [
      'Only fetch enclosure URLs the feed explicitly publishes for download.',
      'Feed content may be licensed; check the publisher’s terms before redistributing.',
    ],
    requiredEnv: [],
    docsUrl: 'https://www.rssboard.org/rss-specification',
  },
  {
    id: 'direct-http',
    name: 'Direct media URL',
    category: 'archive',
    hostnames: [],
    auth: 'none',
    capabilities: {
      metadata: 'official-api',
      search: 'none',
      publish: 'none',
      analytics: 'none',
      scheduling: 'none',
    },
    ingestion: 'direct-media',
    restrictions: [
      'Only media you own or are authorized to download.',
      'Private, loopback and link-local destinations are blocked to prevent SSRF.',
    ],
    requiredEnv: [],
    docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests',
  },
];

export function findProviderForUrl(raw: string): ProviderDefinition | null {
  let hostname: string;
  try {
    hostname = new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
  return (
    PROVIDERS.find((provider) =>
      provider.hostnames.some((candidate) => hostname === candidate || hostname.endsWith(`.${candidate}`)),
    ) ?? null
  );
}

export function providerById(id: string): ProviderDefinition | null {
  return PROVIDERS.find((provider) => provider.id === id) ?? null;
}

/** True when every credential the connector needs is present in the environment. */
export function isConfigured(provider: ProviderDefinition): boolean {
  return provider.requiredEnv.every((key) => Boolean(process.env[key]));
}

export const RESEARCH_DATE = '2026-10-30';
