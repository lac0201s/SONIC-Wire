# Competitor research

Scope: the products a media team would actually compare SonicWire with, and the
specific gap each leaves that SonicWire targets. Evidence quality is mixed by
necessity — vendor primary documentation was reachable only for the provider APIs
(see the capability matrix); the product comparisons below rely on published
comparison material and are marked **secondary**.

## 1. Comparator set

| Product | Category | Strength | Where it leaves a gap |
| --- | --- | --- | --- |
| Frame.io (Adobe) | Review & approval | Frame-accurate comments, versioned review context, approvals that persist across versions | Review-first, not archive-first: deep library operations (dedupe, codec/container truth, derivative lineage) are thin; the library exists to serve review. |
| iconik | MAM | Metadata-driven retrieval, configurable taxonomy, REST + webhooks automation | Enterprise deployment and licensing model; a small studio cannot self-host it as a single binary on a laptop. |
| Canto / Brandfolder | DAM | Brand-governed libraries, portals, rights metadata | Optimised for marketing assets, weak on media forensics (stream-level facts, transform provenance). |
| Dalet Flex | Orchestration | Workflow routing bound to asset state and metadata enforcement | Broadcast-scale, integration-heavy, not local-first. |
| DaVinci Resolve / Media Composer | NLE | Authoritative craft tools | They *consume* well-organised media; they do not inventory or verify it. |
| `ffprobe` + spreadsheets | Status quo | Free, exact | No lineage, no queue, no audit trail, no memory of which derivative came from which master. |

## 2. What the comparison implies

1. **Media forensics is the underserved middle.** Review tools assume the media is
   already known; NLEs assume the operator inspects by hand. The gap is a system
   that states, per asset, exactly what FFprobe reported and where every derivative
   came from — and refuses to invent anything it did not measure.
2. **Local-first is a real differentiator, not nostalgia.** Every strong comparator
   is a cloud tenant. A solo operator or a two-person studio with 4 TB of rushes
   wants dedupe, lineage and transforms without uploading masters anywhere.
3. **Refusal is a feature.** No competitor can honestly say "we will not fetch this
   provider's media because its terms forbid it". The researched capability matrix
   turns that into visible product policy instead of an error at 2am.
4. **Review/approval is table stakes but not the wedge.** SonicWire models
   `waiting_approval` as a job state and keeps an audit ledger, but frame-accurate
   collaborative review is roadmap work (Phase 4), because competing head-on with
   Frame.io in this build would have produced a shallow copy.

## 3. Deliberate non-goals (and why)

| Not built | Reason |
| --- | --- |
| Browser-based NLE timeline | 18 months of engineering to reach "worse than Resolve"; the product's value is upstream of the edit. |
| Cloud render farm | Requires infrastructure and spend the mandate forbids. Distributed processing is modelled as a local bounded worker pool with leases. |
| AI transcription/semantic search | Needs model hosting and produces claims that are hard to verify; a dishonest "AI tag" would violate the no-fabrication rule. Roadmap Phase 5 with an explicit provider boundary. |
| Social publishing connectors | Blocked on provider credentials, audits and approval — all outside an agent's authority. |

## 4. Positioning statement

> SonicWire is the media intelligence layer under a small studio's library: it
> measures what files actually contain, proves where every derivative came from,
> transforms media with verifiable outputs, and refuses to pretend it can fetch what
> a provider's terms forbid — on one machine, without a cloud tenant.

## 5. Sources (secondary)

- Video organisation software comparison, Oct 2026 — Frame.io vs iconik strengths: https://gitnux.org/best/video-organization-software/
- Video library management comparison, Sep 2026 — iconik metadata-first workflows: https://zipdo.co/best/video-library-management-software/
- Video metadata software comparison, Sep 2026 — Frame.io review-metadata framing: https://worldmetrics.org/best/video-metadata-software/
- Frame.io / iconik / Dalet Flex characterisations above are consistent across
  those three independent comparison articles; no vendor primary page was fetched,
  so treat specific feature claims as **B/C** confidence.
