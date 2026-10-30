# Provider capability matrix

Researched 2026-10-30. This document is the source for
`apps/server/src/modules/providers/registry.ts`; the registry is the enforcement
point and the public `/api/providers` payload exposes the same facts, including
`ingestion`.

## 1. How to read this

Every provider row answers three questions the UI must not blur:

- **What can be read?** (`metadata`, `search`, `analytics`)
- **What can be written?** (`publish`, `scheduling`)
- **May SonicWire fetch the media bytes?** (`ingestion`: `direct-media` or `link-only`)

`link-only` is not a TODO. It is the correct terminal state when no official API
serves the bytes: the product stores a reference and refuses to download, naming
the restriction. Nine of twelve providers are `link-only`.

Confidence legend: **A** = checked against vendor documentation during research
(linked below); **B** = consistent secondary sources / long-stable API shape;
**C** = plausible but unverified in this environment — re-check before building a
connector.

## 2. Matrix

| Provider | Category | Auth | Metadata | Search | Publish | Analytics | Scheduling | Ingestion | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| YouTube | video | OAuth 2.0 | official-api | official-api | official-api | official-api | none | **link-only** | A |
| Instagram | social | OAuth 2.0 | official-api | none | official-api | official-api | none | **link-only** | B |
| TikTok | social | OAuth 2.0 | official-api | none | official-api | official-api | none | **link-only** | A |
| X | social | OAuth 2.0 (PKCE) | official-api | official-api | official-api | official-api | none | **link-only** | A/B (pricing in flux) |
| Twitch | video | OAuth 2.0 | official-api | official-api | none | none | none | **link-only** | A (clips download added 2025 — see gap) |
| SoundCloud | audio | OAuth 2.0 | official-api | official-api | official-api | none | none | **link-only** | C |
| Vimeo | video | OAuth 2.0 | official-api | official-api | official-api | official-api | none | **link-only** | B |
| Reddit | social | OAuth 2.0 | official-api | official-api | official-api | none | none | **link-only** | A |
| Internet Archive | archive | none | official-api | official-api | official-api | none | none | **direct-media** | A |
| Wikimedia Commons | archive | none (UA policy) | official-api | official-api | official-api | none | none | **direct-media** | A |
| Podcast RSS enclosures | audio | none | official-api | none | none | none | none | **direct-media** | B |
| Direct media URL (self-hosted) | archive | none | official-api | none | none | none | none | **direct-media** | A (by construction) |

## 3. Why each `link-only` decision holds

**YouTube.** The Developer Policies forbid downloading, importing, backing up or
caching audiovisual content without prior written approval, and forbid using
anything other than the API Services to access API data. There is no download
endpoint for third-party videos. Search costs 100 quota units per call against a
10,000 unit/day default; unaudited projects can only upload private videos.
→ Reference-only ingest, refusal message quotes the policy. Source: [1], [2].

**TikTok.** Display API returns only the *authorizing* user's own profile and
videos (`user.info.basic`, `video.list`); it is explicitly not a discovery API.
Content Posting API keeps unaudited posts private. → Reference-only. Source: [3], [4].

**X.** v2 requires OAuth 2.0 user context for media upload; there is no download
endpoint for third-party media. Pricing/tiering changed repeatedly through 2026 —
public sources disagree about whether tiers still exist (pay-per-use vs Free/Basic/Pro),
so the matrix asserts only what is stable: access is metered, read allowances are
small, and terms change often. Re-verify before implementing. Source: [5], [6].

**Twitch.** Helix exposes stream/VOD/clip **metadata**. VOD file download is not
part of the API for third parties, and the Developer Agreement restricts
redistribution. *Gap to track:* developer-forum posts reference a clips download
endpoint appearing around September 2025; the registry deliberately models only
metadata until that endpoint is verified against primary documentation. Source: [7], [8].

**Instagram.** Content Publishing API supports professional accounts only, with
per-24h limits; public content search is not offered. → Reference-only. Confidence B.

**Reddit.** Data API requires registration and, since the Responsible Builder
Policy update, manual approval; free tier is 100 queries/min per OAuth client,
commercial use needs written approval, and media hosted by Reddit is not
downloadable through the API. New public-API requests were reported to close on
2026-10-31. → Reference-only, and no connector should be planned without an
approval path. Source: [9], [10].

**SoundCloud / Vimeo.** SoundCloud API registration is restricted and download
requires the creator to enable it; Vimeo issues download URLs only when the owner
allows it. Both are `link-only` and marked B/C. Source: [11].

## 4. Why each `direct-media` decision holds

**Internet Archive.** `advancedsearch.php` for discovery, `metadata/<id>` for item
metadata, and `download/<id>/<file>` for files that the item marks public.
Lending-library items are access-controlled and must be refused. Client must send
an identifying User-Agent and respect rate limits. Source: [12].

**Wikimedia Commons.** MediaWiki API for metadata/search; `upload.wikimedia.org`
serves the file bytes for freely licensed media. Attribution travels with the
licence, and non-free media hosted on some wikis is not redistributable. Wikimedia's
2026 rate limits differentiate anonymous vs identified traffic and require a
descriptive User-Agent per the UA policy. Source: [13], [14].

**Podcast / RSS enclosures.** The feed publishes an `<enclosure url>` explicitly for
download; that URL — and only that URL — is fetchable. Publisher terms still apply.

**Direct media URL.** Any `http(s)` URL the operator owns. This is where the SSRF
guard matters most: loopback, link-local, CGNAT, metadata addresses and their IPv6
wrappers are refused before a socket is opened (see threat model).

## 5. Open research gaps

1. Twitch clips download endpoint (2025) — confirm scope, auth and terms.
2. Instagram Graph API publishing limits by account type and region.
3. SoundCloud API registration availability in 2026.
4. X API current pricing model — sources conflict; do not build a metered connector
   until the operator has a paid plan and the official pricing page is re-read.
5. YouTube quota cost per endpoint beyond search — only search cost is asserted here.

None of these gaps blocks the shipped product: unverified connectors stay
`not_configured` and the UI says so.

## 6. Sources

1. YouTube API Services — Developer Policies (prohibited downloading/caching, no non-API access): https://developers.google.com/youtube/terms/developer-policies
2. YouTube Data API quota context (search = 100 units of 10,000/day): https://developers.google.com/youtube/v3/determine_quota_cost
3. TikTok Display API — Get Started (`user.info.basic`, `video.list`, authorizing user only): https://developers.tiktok.com/docs/en/display-api-get-started
4. TikTok Content Posting / unaudited-client private-only behaviour (secondary, Sept 2026): https://www.xpoz.ai/blog/guides/tiktok-api-pricing-2026/
5. X API v2 media endpoints and OAuth 2.0 user context: https://docs.x.com/x-api/media/quickstart/media-upload-chunked
6. X API pricing in flux (secondary, conflicting reports): https://www.outstand.so/blog/x-api-pricing and https://elfsight.com/blog/how-to-get-x-twitter-api-key-in-2026/
7. Twitch Helix reference (clips/VOD metadata): https://dev.twitch.tv/docs/api/reference/
8. Twitch developer forums — VOD/clip download discussion: https://discuss.dev.twitch.com/t/official-api-endpoint-to-download-or-export-twitch-vods-similar-to-the-clips-download-endpoint/64561
9. Reddit Data API terms / Responsible Builder Policy (secondary, Oct 2026): https://prowlo.com/blog/reddit-data-api
10. Reddit rate limits (100 QPM per OAuth client, approval required): https://bigideasdb.com/reddit-api-pricing
11. Vimeo API download permissions: https://developer.vimeo.com/api/reference/videos
12. Internet Archive developer portal — search/metadata/download modules: https://cors.archive.org/developers/internetarchive/modules.html
13. Wikimedia API policy and rate limits: https://meta.wikimedia.org/wiki/API_Policy_Update_2024 and https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits
14. Wikimedia User-Agent policy: https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy
