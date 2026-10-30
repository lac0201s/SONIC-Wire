# Research log

Every external fact used in this build, where it came from, and how far it can be
trusted. Retrieval date for all entries: **2026-10-30**.

| # | Topic | Source | Confidence | Used in |
| --- | --- | --- | --- | --- |
| 1 | YouTube prohibits downloading audiovisual content without written approval | https://developers.google.com/youtube/terms/developer-policies | A (primary policy text quoted in search result) | Provider matrix, registry restriction copy |
| 2 | YouTube search costs 100 quota units of 10,000/day | https://developers.google.com/youtube/v3/determine_quota_cost | B (documented, not re-fetched directly) | Registry restriction copy |
| 3 | TikTok Display API is authorizing-user only (`user.info.basic`, `video.list`) | https://developers.tiktok.com/docs/en/display-api-get-started | A | Provider matrix |
| 4 | TikTok content posting keeps unaudited clients private | https://www.xpoz.ai/blog/guides/tiktok-api-pricing-2026/ | B (secondary) | Registry restriction copy |
| 5 | X v2 media upload needs OAuth 2.0 user context; no third-party download endpoint | https://docs.x.com/x-api/media/quickstart/media-upload-chunked | B | Provider matrix |
| 6 | X API pricing/tiering disputed between sources in 2026 | https://www.outstand.so/blog/x-api-pricing vs https://elfsight.com/blog/how-to-get-x-twitter-api-key-in-2026/ | Conflict — recorded, not resolved | Matrix note; risk register R-07 |
| 7 | Twitch Helix exposes stream/VOD/clip metadata only | https://dev.twitch.tv/docs/api/reference/ | B | Provider matrix |
| 8 | A Twitch clips download endpoint appeared around Sept 2025 (unverified) | https://discuss.dev.twitch.com/t/official-api-endpoint-to-download-or-export-twitch-vods-similar-to-the-clips-download-endpoint/64561 | C — open gap | Matrix §5 |
| 9 | Reddit Data API needs approval; 100 QPM free tier; no media download | https://prowlo.com/blog/reddit-data-api | B (secondary, 2026) | Provider matrix |
| 10 | Reddit free access reportedly closing for new clients (Oct 2026/Mar 2027) | https://bigideasdb.com/reddit-api-pricing | C — recorded as risk | Risk register R-08 |
| 11 | Vimeo download URLs only when owner enables | https://developer.vimeo.com/api/reference/videos | B | Provider matrix |
| 12 | Internet Archive search/metadata/download modules | https://cors.archive.org/developers/internetarchive/modules.html | A (developer portal) | Provider matrix, acquisition design |
| 13 | Wikimedia API policy + new global rate limits requiring identified traffic | https://meta.wikimedia.org/wiki/API_Policy_Update_2024 · https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits | A | Provider matrix |
| 14 | Wikimedia User-Agent policy | https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy | A | Downloader `USER_AGENT` |
| 15 | Frame.io = review-first, iconik = metadata-first MAM, Dalet Flex = orchestration | Three independent 2026 comparison articles (see competitor research) | B/C (secondary only) | Competitor research, positioning |
| 16 | React Bits: 218 component folders, MIT + Commons Clause, 50.7k stars, GSAP-based text animations | GitHub REST API (metadata, contents, readme) | A (direct API inspection) | React Bits analysis |
| 17 | taste-skill / taste-skills exist as prompt skills; inventories published | GitHub search summaries | B (not installed or executed) | taste-skill analysis |
| 18 | Node 22.22.3 ships `node:sqlite` (experimental) | Local `node -v` + successful `DatabaseSync` use | A (measured) | ADR-0002, recon |
| 19 | Bundled FFmpeg `N-47683` supports libx264/aac/libmp3lame/libopus/flac/libvpx-vp9 | Local `ffmpeg -encoders` | A (measured) | README requirements, roadmap |
| 20 | npm packages resolve from `registry.npmjs.org` (fonts, GSAP-free animation libs, Tailwind 4, Vite 7) | `npm install` exit 0 | A (measured) | Design tokens, build |

## Rules applied while researching

1. **No claim without a source or a measurement.** Anything that had neither is
   either omitted or explicitly labelled C/unknown.
2. **Conflicts are surfaced.** X API pricing is the clearest example: three sources
   describe three different models. The product asserts only what they agree on.
3. **Nothing was "downloaded and inspected" unless it was.** The taste-skill
   analysis says plainly that the skill was never installed. React Bits *was*
   inspected through the GitHub API, and the specific file inspected is named.
4. **Unreachable hosts are recorded as unreachable**, not silently worked around.
   `raw.githubusercontent.com` returns connection failures from the shell; the
   GitHub REST API was used instead.
