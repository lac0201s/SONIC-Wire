# SONICWIRE

## Autonomous Product Research, Architecture, Design & Production Engineering Master Mandate

**Document type:** Autonomous Agent Master PRD / Execution Mandate\
**Project:** SonicWire\
**Mandate version:** 2.0.0\
**Prepared:** 30 October 2026\
**Status:** Governing project brief --- research, decide, document,
build, verify\
**Primary product direction:** Cinematic Industrial\
**Working product definition:** Universal Media Intelligence & Creation
Ecosystem

------------------------------------------------------------------------

# 0. EXECUTION DIRECTIVE

You are the autonomous principal product architect, research lead,
design director, systems engineer, security engineer, quality lead and
implementation agent for **SonicWire**.

Your responsibility is not to produce a mockup, concept, clickable
prototype, starter template, attractive landing page, architecture
diagram without implementation, or a collection of disconnected
features. Your responsibility is to research, specify, engineer, test
and deliver the strongest complete, coherent, maintainable and
production-ready SonicWire product that can reasonably be built within
the available environment, permissions, tools, time and resources.

You have broad technical and product decision-making autonomy. Do not
ask the user routine questions, do not stop after writing a plan, do not
wait for approval between ordinary engineering phases, and do not
require the user to repeatedly tell you to continue. Make reasoned
decisions, record them, execute the next safe step, validate the result
and continue.

**Do not interpret autonomy as permission to perform unsafe,
irreversible, costly, legally binding or externally visible actions.**
Never purchase services, accept legal terms, create paid accounts,
publish content, send messages, deploy publicly, modify DNS, expose
private data, access accounts without authorization, or incur charges
without explicit authorization. Use local development, free tiers, mock
external services only in isolated tests, and documented integration
boundaries where credentials or approvals are unavailable.

## 0.1 Operating rules

1.  **Research before commitment.** Verify current technologies,
    versions, APIs, licenses, platform rules, security advisories and
    component implementations using primary sources wherever possible.
2.  **Document before implementation.** Produce a complete product, UX,
    design, architecture, data, security, testing and deployment
    specification before building the corresponding production
    subsystem.
3.  **Continue autonomously.** Once a stage is complete and its exit
    criteria pass, proceed to the next stage without asking for
    permission.
4.  **No false completion.** Never call a feature complete because a
    screen exists. Completion requires functioning behavior, error
    handling, tests, accessibility, responsive behavior, documentation
    and operational visibility.
5.  **No fake functionality.** No dead buttons, fake progress,
    hard-coded analytics, fabricated provider results, decorative
    controls pretending to work, placeholder screens presented as
    finished, or simulated integrations in production paths.
6.  **No unbounded work.** All queues, concurrency, memory, network
    requests, uploads, downloads, retries, caches and background jobs
    require explicit limits and cancellation.
7.  **Evidence-led decisions.** Compare alternatives against stated
    criteria. Record sources, benchmarks, assumptions, trade-offs and
    rejected options.
8.  **Respect rights and provider restrictions.** Build integrations for
    authorized access, user-owned or properly licensed content, and
    provider-supported capabilities. Never bypass DRM, paywalls,
    authentication, private-account restrictions, technical access
    controls or platform safeguards.
9.  **Preserve user data.** Inspect an existing repository before
    changing it. Do not overwrite or delete user work without a safe
    backup and clear necessity.
10. **Deliver working software.** Prioritize an end-to-end, secure,
    reliable product over feature count, visual spectacle or
    architecture theatre.

## 0.2 Required decision behavior

When information is missing:

-   Search the repository, existing project documentation, installed
    tools, available skills and official documentation first.
-   Infer sensible defaults from the product mandate.
-   Select the safest and most maintainable option that meets the
    requirement.
-   Record assumptions and unresolved constraints in `docs/decisions/`
    and `docs/risks/`.
-   Continue wherever safe.
-   If a task genuinely requires an unavailable credential, human
    authorization, paid service, external account, legal decision or
    physical device, implement the surrounding integration contract and
    local test harness, clearly mark the external dependency, and
    continue with other work. Do not fabricate a successful integration.

Do not create an endless research loop. Research must converge into
decisions, documents, implementation and verification.

------------------------------------------------------------------------

# 1. PRODUCT VISION AND POSITIONING

## 1.1 Product vision

**SonicWire is a premium, cinematic, universal media intelligence and
creation ecosystem.**

It unifies the lifecycle of digital media:

-   Discover and identify media.
-   Acquire authorized media from supported sources.
-   Inspect media structure, metadata and technical quality.
-   Transform, transcode, remux, extract and package media.
-   Organize and preserve a personal or team media universe.
-   Play and preview audio and video.
-   Prepare content for creators and supported publishing destinations.
-   Connect social accounts through authorized provider integrations.
-   Enable a native SonicWire community and social layer.
-   Collaborate around collections, assets and workflows.
-   Automate repeatable media operations.
-   Coordinate local and distributed processing.
-   Observe performance, integrity, history and system health.
-   Extend capabilities through documented APIs, connectors and plugins.

SonicWire is not merely a downloader, converter, media player, social
feed or creator dashboard. It is a unified environment where these
capabilities share a consistent identity, media model, permissions
system, processing infrastructure and interaction language.

## 1.2 Product principles

1.  **Cinematic Industrial identity:** precise, dramatic, premium,
    tactile, confident and visually distinctive.
2.  **Functional excellence:** every visual decision supports clarity,
    control, comprehension or delight.
3.  **Media-first architecture:** media assets, metadata, provenance,
    versions, permissions and processing history are first-class
    concepts.
4.  **One coherent ecosystem:** modules share core services and data
    contracts without becoming a tightly coupled monolith.
5.  **Local-first where practical:** private media should not needlessly
    leave the user's device or trusted environment.
6.  **Provider-respecting connectivity:** integrations must reflect real
    API capabilities and legal/contractual restrictions.
7.  **Transparent intelligence:** recommendations and automated actions
    must be explainable, controllable and auditable.
8.  **Performance with evidence:** measure end-to-end latency,
    throughput, memory, CPU, network and rendering performance.
9.  **Accessible premium design:** motion, contrast, keyboard operation,
    screen readers and reduced-motion preferences are core requirements.
10. **Extensible by design:** third-party developers should be able to
    add connectors, processors, workflow nodes and integrations through
    safe, versioned contracts.

## 1.3 Target users

Design and validate for these user groups:

-   Individuals managing large personal media libraries.
-   Audio and video enthusiasts who need precise technical controls.
-   Creators managing content across multiple social platforms.
-   Editors and production teams transforming and reviewing assets.
-   Researchers and archivists working with large collections of
    authorized media.
-   Teams collaborating on media assets and publishing workflows.
-   Developers extending SonicWire through APIs and plugins.
-   Self-hosters and technically advanced users operating local or
    private deployments.

Do not assume every user needs every module. The experience must
progressively disclose advanced functionality without hiding
professional controls.

## 1.4 Product boundaries

SonicWire may support media discovery, metadata inspection, authorized
acquisition, processing, organization, playback, collaboration and
publishing where legally and technically supported.

SonicWire must not:

-   Circumvent DRM or technical protection measures.
-   Bypass paywalls, login controls, private-account permissions or
    provider access restrictions.
-   Scrape or download content in violation of applicable provider terms
    or law.
-   Store or expose user credentials in plaintext.
-   Imply that public visibility grants redistribution rights.
-   Claim lossless quality where a source is lossy.
-   claim a bitrate, resolution or codec that is not present in the
    actual media.
-   Claim quantum acceleration or impossible network latency without
    evidence.
-   Use unofficial integrations as if they were supported provider APIs.
-   Build covert tracking, fingerprinting or unauthorized account
    surveillance.

Every provider connector must declare its capabilities, restrictions,
authentication method, supported operations, quotas, data handling and
failure modes.

------------------------------------------------------------------------

# 2. PRODUCT ECOSYSTEM --- TWELVE INTERCONNECTED DOMAINS

Treat these as product domains sharing SonicWire Core, not twelve
independent applications. Research and document dependencies, release
sequencing and data ownership. Build a coherent end-to-end product
rather than presenting unimplemented domains as available.

## 2.1 Universal Discovery

Purpose: find and inspect media across supported sources and the user's
authorized library.

Potential capabilities:

-   Unified search across the local library and connected providers.
-   Provider-specific search adapters where official APIs permit.
-   URL ingestion and source recognition.
-   Creator, channel, album, playlist, collection and media discovery.
-   Search filters for type, duration, date, language, resolution, codec
    and provider where data is available.
-   Recent searches and saved searches.
-   Search result provenance and source links.
-   Duplicate and related-item suggestions.
-   Pagination, incremental loading and cancellation.
-   Clear distinction between indexed metadata, cached metadata and live
    provider data.

## 2.2 Media Intelligence

Purpose: understand what a media asset actually contains.

Capabilities to investigate and implement where appropriate:

-   Container and codec inspection.
-   Audio/video stream inventory.
-   Resolution, frame rate, pixel format, bit depth and color metadata.
-   Audio bitrate, sample rate, channels and channel layout.
-   Subtitle and caption tracks.
-   Language and metadata extraction.
-   Duration and variable-frame-rate detection.
-   Thumbnail and waveform generation.
-   Quality assessment based on measurable source properties.
-   File signature and MIME validation.
-   Hashing and integrity verification.
-   Duplicate and near-duplicate detection.
-   Metadata normalization and provenance.
-   Corrupt or incomplete file detection.
-   Media compatibility assessment for target devices and publishing
    destinations.

Never equate a larger bitrate or resolution label with better source
quality. Preserve source facts separately from derived estimates.

## 2.3 Universal Acquisition

Purpose: acquire content through permitted and supported mechanisms.

Capabilities:

-   URL and batch URL ingestion.
-   Authorized provider connector integrations.
-   Local file and folder import.
-   Playlist or collection ingestion where permitted.
-   Metadata-first previews.
-   User-selected output and quality profiles based on actual source
    availability.
-   Resumable transfers where source and protocol permit.
-   Retry with exponential backoff and jitter.
-   Cancellation and pause/resume where technically supported.
-   Per-job and global bandwidth limits.
-   Integrity verification.
-   Clear failure reasons and recovery guidance.
-   Provenance, source URL and acquisition timestamp.
-   Download queue prioritization and scheduling.
-   Safe handling of redirects, DNS, private IPs and malicious URLs.

The acquisition engine must not bypass authentication or provider
restrictions. Do not represent unsupported sources as supported.

## 2.4 Transformation Laboratory

Purpose: process authorized media using robust and inspectable
pipelines.

Capabilities to evaluate:

-   Audio extraction.
-   Video and audio transcoding.
-   Stream copy and remuxing.
-   Container conversion.
-   Codec conversion.
-   Bitrate and quality profiles.
-   Resolution and frame-rate conversion.
-   Audio resampling and channel conversion.
-   Loudness analysis and normalization.
-   Trimming and clipping.
-   Thumbnail and preview generation.
-   Subtitle extraction, conversion and synchronization.
-   Metadata editing and tagging.
-   Batch transformation.
-   Archive packaging.
-   Output presets and user-defined profiles.
-   Before/after technical comparison.
-   Job graphs and transformation history.

Use mature media tooling such as FFmpeg where appropriate. Verify build
configuration, codec licensing, patent implications, redistribution
terms and platform support before bundling. Do not reimplement mature
codecs without a measured reason.

Preserve original assets by default. Make destructive replacement an
explicit, recoverable user action.

## 2.5 Media Universe

Purpose: create a high-quality, durable media library.

Capabilities:

-   Unified media library.
-   Collections, folders, albums, playlists and smart collections.
-   Tags, custom metadata and notes.
-   Fast filtering and search.
-   Sorting and grouping.
-   Bulk selection and bulk actions.
-   Duplicate review.
-   Version and derivative relationships.
-   Favorites and saved items.
-   Recently added, recently played and recently processed views.
-   Storage usage and asset health.
-   Missing-file and offline-source detection.
-   Import/export of library metadata.
-   Thumbnail, waveform and preview caches.
-   Virtualized large collections.
-   Local and remote library locations.
-   Backup and restore workflows.

A library item must have stable identity independent of its filename or
storage path.

## 2.6 Social Universe

Purpose: add a native social environment designed around media
discovery, curation and collaboration---not a generic clone of existing
social networks.

Research and specify:

-   User profiles and creator identities.
-   Following creators, collections and topics.
-   Public and private collections.
-   Shared playlists and collaborative curation.
-   Media references and rights-aware previews.
-   Likes, reactions, comments and moderation.
-   Community spaces organized around media interests.
-   Discovery feeds with transparent ranking controls.
-   Search across public SonicWire content.
-   Notifications and user controls.
-   Reporting, blocking, muting and safety tools.
-   Account privacy settings.
-   Age-appropriate safety and abuse prevention.
-   Spam, impersonation and copyright reporting workflows.
-   Content ownership and attribution.
-   Community guidelines and moderation operations.

Social functionality must be designed with privacy, security, abuse
prevention, moderation capacity and legal review in mind. Do not launch
public social features without operational moderation, reporting, rate
limiting, account controls and a documented response process.

Do not automatically upload local media or expose private library
contents. Sharing must be an explicit user action.

## 2.7 Creator Studio

Purpose: help creators manage and prepare their own authorized content.

Capabilities:

-   Creator asset workspace.
-   Original and derivative asset management.
-   Platform-specific export presets based on verified requirements.
-   Aspect-ratio and crop preparation.
-   Thumbnail and cover-art preparation.
-   Caption and metadata management.
-   Drafts and publishing queue.
-   Scheduling where official APIs support it.
-   Publishing status and error reporting.
-   Connected-account management.
-   Content calendar.
-   Available analytics from authorized provider APIs.
-   Version history and source preservation.
-   Collaboration with editors and reviewers.

Do not promise cross-platform publishing parity. Each provider has
different permissions, endpoints, account eligibility, quotas and review
processes. Implement capability-aware integrations.

## 2.8 Workflow Intelligence

Purpose: let users build repeatable media processes.

Capabilities:

-   Visual workflow editor.
-   Typed workflow nodes and edges.
-   Ingest, inspect, transform, organize, export and notify nodes.
-   Conditions and branching.
-   Bounded parallel branches.
-   Retry and failure-handling nodes.
-   User approval gates for consequential actions.
-   Scheduling and triggers.
-   Reusable templates.
-   Workflow versioning.
-   Execution history and logs.
-   Dry-run and validation mode.
-   Resource budgets and concurrency controls.
-   Workflow import/export.
-   Safe plugin nodes.

A workflow must have typed inputs and outputs, validation, resource
budgets, cancellation and clear failure semantics. Never allow arbitrary
untrusted plugin code to execute inside the core process.

## 2.9 Distributed Processing

Purpose: coordinate processing efficiently across local workers and,
where justified, trusted remote workers.

Capabilities to research:

-   Work queues and durable job state.
-   Resource-aware scheduling.
-   CPU, memory, GPU and network awareness.
-   Fairness and priority policies.
-   Per-user and per-workspace quotas.
-   Backpressure.
-   Worker health and heartbeats.
-   Retry and dead-letter handling.
-   Job leases and idempotency.
-   Checkpointing where processing supports it.
-   Cancellation propagation.
-   Local worker mode.
-   Trusted remote worker mode.
-   Secure worker registration and authentication.
-   Artifact transfer and integrity verification.
-   Cost and resource accounting.
-   Observability and capacity planning.

Use classical algorithms as the dependable baseline. Investigate
quantum-inspired methods only where there is a clearly defined
optimization problem, measurable baseline and reproducible benchmark.
Actual quantum SDK or hardware integration is an optional research
experiment, not a required dependency for core operation. Never claim
quantum advantage without independent evidence.

## 2.10 Universal Media Experience

Capabilities:

-   Integrated audio and video playback.
-   Playlist and queue management.
-   Playback history and resume position.
-   Subtitle selection and synchronization.
-   Playback speed and audio track selection.
-   Keyboard shortcuts and accessible controls.
-   Media preview and scrubbing.
-   Device compatibility.
-   Picture-in-picture where supported.
-   Gapless playback where supported.
-   Audio visualization as an optional experience.
-   Clear distinction between remote streaming and local playback.

Use well-supported playback engines and browser capabilities. Do not
build a custom codec stack unless research demonstrates a compelling
need.

## 2.11 Collaboration Universe

Capabilities:

-   Workspaces and teams.
-   Role-based access control.
-   Shared libraries and collections.
-   Comments and annotations.
-   Review and approval workflows.
-   Shared processing jobs.
-   Version-aware collaboration.
-   Activity history.
-   Invitations and membership management.
-   Permission inheritance and explicit overrides.
-   Audit events.
-   Notifications and user preferences.

Collaboration must not leak private media or metadata across workspace
boundaries.

## 2.12 System Observatory

Capabilities:

-   Job and worker activity.
-   CPU, memory, GPU and network telemetry where available.
-   Queue depth and wait times.
-   Throughput and latency percentiles.
-   Storage usage and cache statistics.
-   Provider connector health and quota status.
-   Error rates and retry counts.
-   Job history and trace correlation.
-   Resource budgets and warnings.
-   Audit logs.
-   Diagnostics export with secret and personal-data redaction.

Telemetry must be useful without becoming invasive. Collect only what is
necessary, document retention and provide appropriate controls.

------------------------------------------------------------------------

# 3. PRODUCT EXPERIENCE AND INFORMATION ARCHITECTURE

## 3.1 Experience direction

The chosen visual direction is **Cinematic Industrial**.

Reference qualities:

-   Dramatic but controlled lighting.
-   Deep, rich dark surfaces with carefully selected neutral and
    metallic tones.
-   Precision-engineered visual elements.
-   Sophisticated editorial typography.
-   Strong compositional hierarchy.
-   Tactile controls and crisp interaction feedback.
-   High-quality transitions and depth.
-   Intentional use of 3D and generative graphics.
-   Confident negative space.
-   Dense professional data views where useful.
-   No generic dashboard-template appearance.

This is a direction, not permission to imitate Apple's proprietary
designs or another brand's identity. Study Apple's product-design
discipline, consistency, typography, storytelling and interaction
quality, then create an original SonicWire identity.

## 3.2 Separate public website and product application

Treat the public marketing website and the authenticated product
application as distinct experiences with a shared design system.

### Public website

Explore:

-   Cinematic opening sequence.
-   Strong SonicWire brand reveal.
-   Distinctive hero composition.
-   Scroll-driven product storytelling.
-   Interactive media demonstrations.
-   Product-domain showcases.
-   Creator and social ecosystem showcases.
-   Performance and architecture storytelling based on verified facts.
-   Pricing only when actual plans and costs are decided.
-   Documentation, support, security and legal pages.
-   Responsive mobile and desktop experiences.

The public site must not make unverified performance, provider-support,
security or feature claims.

### Product application

Explore a navigation architecture that makes the major environments easy
to understand. Candidate top-level environments:

-   Command.
-   Discover.
-   Media Universe.
-   Acquisition.
-   Transformation Studio.
-   Creator Studio.
-   Social Universe.
-   Workflows.
-   Collaboration.
-   Observatory.
-   Settings and developer tools.

Do not force all items into a permanent sidebar. Research contextual
navigation, command palette, workspace switching, adaptive navigation,
keyboard-first operation and mobile navigation.

## 3.3 UX documentation requirements

For every screen and significant interaction, document:

-   Purpose and user outcome.
-   Entry points and exit paths.
-   Navigation context.
-   Layout and responsive behavior.
-   Component inventory.
-   Data requirements.
-   Loading, empty, error, offline and permission-denied states.
-   Keyboard behavior.
-   Touch behavior.
-   Accessibility semantics.
-   Motion and transition behavior.
-   Analytics or telemetry events, if justified.
-   Security and privacy implications.
-   Acceptance criteria.
-   Test scenarios.

Create user journeys for first launch, onboarding, URL ingestion, local
import, media inspection, transformation, library management, creator
publishing, social sharing, collaboration, workflow execution, error
recovery, account disconnection, data export and account deletion.

## 3.4 Interaction quality

Every interaction must have:

-   Clear affordance.
-   Immediate acknowledgement.
-   Correct focus behavior.
-   Predictable keyboard support.
-   Touch targets suitable for mobile.
-   Loading and disabled states.
-   Error recovery.
-   Reduced-motion alternative.
-   No misleading progress or fake telemetry.

Use animation to communicate hierarchy, state change, continuity, cause
and effect---not as decoration without purpose.

------------------------------------------------------------------------

# 4. VISUAL DESIGN, ART DIRECTION AND ASSET PRODUCTION

This is a first-class engineering workstream. Do not treat visual design
as a final styling pass.

## 4.1 Mandatory design research

Before implementing the interface:

1.  Discover and read the complete available `taste-skill` documentation
    and its associated references.
2.  Record the actual skill version, source, license and
    installation/use requirements.
3.  Explore the React Bits catalogue comprehensively.
4.  Inspect actual component source, dependencies, license,
    accessibility, responsiveness, performance and maintenance status.
5.  Research additional high-quality component, motion, typography, 3D
    and design ecosystems.
6.  Review authoritative product-design and accessibility guidance.
7.  Build a visual reference library with source attribution.
8.  Develop multiple distinct SonicWire visual concepts.
9.  Compare them against a documented rubric.
10. Select and refine the Cinematic Industrial direction.
11. Produce a complete design system and screen specifications.
12. Validate concepts in real browser layouts before final
    implementation.

Do not assume a skill, component catalogue or external tool exists.
Discover it, verify access and record any unavailable resource. Never
fabricate that a resource was downloaded or inspected.

## 4.2 React Bits and component acquisition

React Bits is a preferred source, not the only source and not a
requirement to use every component.

For each selected component, record:

-   Component name and original source.
-   License and attribution requirements.
-   Source code location and pinned version or commit.
-   Dependencies and bundle cost.
-   Accessibility behavior.
-   Keyboard and touch behavior.
-   Responsive behavior.
-   Reduced-motion support.
-   Performance characteristics.
-   Changes made for SonicWire.
-   Tests and known limitations.

Adapt components to SonicWire's design tokens and architecture. Avoid
bloated wrappers and duplicate dependencies. Prefer maintainable,
locally controlled implementations when licensing permits.

Evaluate alternatives where appropriate, including GSAP, Motion,
Three.js, React Three Fiber, WebGL, shaders, Canvas, SVG, CSS animation,
Rive and Lottie. Select based on actual use case and measured cost.

## 4.3 Typography

Typography must be deliberately art-directed.

Research high-quality type families and evaluate:

-   Licensing for web, desktop and redistribution.
-   Variable font support.
-   Optical sizes and weight range.
-   Latin and required language coverage.
-   Numeral design and tabular numerals.
-   Readability at small sizes.
-   Rendering quality across platforms.
-   File size and loading behavior.

Create a semantic typography system for display, headings, body, labels,
metadata, code, numerical telemetry and dense tables. Use no more font
families than the design requires. Do not choose a font merely because
it is unusual.

## 4.4 Color, surfaces and materials

Create a complete token system:

-   Base backgrounds and elevated surfaces.
-   Primary and secondary text.
-   Muted and disabled text.
-   Accent and focus colors.
-   Success, warning, danger and informational states.
-   Borders and separators.
-   Shadows and depth.
-   Gradients and material treatments.
-   Light and dark themes where justified.

The Cinematic Industrial direction may use deep blacks, graphite, steel,
restrained metallic highlights and a carefully selected accent. Avoid
default purple/neon styling, excessive blur, indiscriminate
glassmorphism and low-contrast gray-on-gray controls.

## 4.5 Image generation and visual asset pipeline

The agent is authorized to use available image-generation tools and
other permitted creative tools to produce original SonicWire assets.

Generate as many assets as the actual design requires---including
hundreds or thousands if justified---but do not chase an arbitrary asset
count. Every asset must serve a documented purpose.

Potential asset categories:

-   Hero artwork.
-   Abstract media environments.
-   3D objects and product compositions.
-   Section illustrations.
-   Creator and community imagery.
-   Feature-specific editorial artwork.
-   Textures and material maps.
-   Thumbnails and demonstration media.
-   Empty-state illustrations.
-   Onboarding artwork.
-   Product screenshots and showcase compositions.
-   Background and foreground layers.
-   Social and creator campaign assets.

For every asset:

-   Record asset ID, purpose, prompt or production brief, source,
    generation tool, date, license/usage status, dimensions, aspect
    ratio, variants and destination.
-   Inspect for artifacts, distorted text, inconsistent branding, visual
    repetition and unintended marks.
-   Generate alternatives and curate rather than accepting the first
    result.
-   Keep generated text out of artwork when real HTML typography is more
    reliable.
-   Ensure images do not imply real customers, partnerships, provider
    endorsements or product capabilities that do not exist.
-   Optimize crops and variants for each viewport.
-   Use modern formats such as AVIF or WebP when supported and
    appropriate.
-   Preserve source masters and document derivative generation.

Do not use generated images as a substitute for real UI components,
product screenshots, data visualizations or editable diagrams when those
require accurate structured content.

## 4.6 Video and motion asset production

The agent may use available AI video-generation tools and creative
agents to produce original video assets when they materially improve the
experience.

Possible uses:

-   Public-site cinematic hero loops.
-   Brand reveal sequences.
-   Ambient visual backgrounds.
-   Scroll-triggered editorial sequences.
-   Product showcase clips.
-   Section transitions.
-   Creator-studio demonstrations.
-   Promotional material.

Video requirements:

-   Muted autoplay only where browser policy permits.
-   Explicit controls for meaningful content.
-   Poster image and fallback.
-   Responsive sources and aspect ratios.
-   Efficient encoding and bitrate ladders.
-   Lazy loading and visibility-aware playback.
-   Pause when offscreen or when the page is hidden where appropriate.
-   Reduced-motion and low-power alternatives.
-   No essential information conveyed only through video.
-   Captions or transcripts for meaningful spoken content.
-   No autoplay audio.
-   No excessive video payload on mobile or slow connections.

Do not generate videos merely to increase visual spectacle. Real-time
WebGL, procedural graphics, Canvas, SVG and CSS may be more interactive,
lighter and more maintainable. Compare the alternatives.

## 4.7 Custom visual engineering

Investigate custom:

-   WebGL shaders.
-   Particle systems.
-   3D media objects.
-   Procedural environments.
-   Audio waveform and spectrum displays.
-   Interactive network maps.
-   Processing pipeline visualizations.
-   Scroll-linked transitions.
-   Spatial parallax.
-   Kinetic typography.
-   Custom cursor or magnetic interactions where accessibility and
    usability remain intact.

Never let decorative visual systems obscure controls, reduce text
contrast, block input, create scroll traps or dominate CPU/GPU
resources.

## 4.8 Asset and visual quality governance

Maintain:

-   `docs/design/visual-direction.md`
-   `docs/design/design-system.md`
-   `docs/design/typography.md`
-   `docs/design/motion-language.md`
-   `docs/design/responsive-art-direction.md`
-   `docs/design/component-inventory.md`
-   `docs/design/asset-register.md`
-   `docs/design/visual-quality-rubric.md`
-   `docs/design/screen-specifications/`
-   `assets/` with clear source, generated, optimized and licensed
    subdirectories as appropriate.

Create visual regression tests and screenshot review at representative
viewport sizes. Never declare visual completion based only on successful
compilation.

------------------------------------------------------------------------

# 5. TECHNICAL RESEARCH AND ARCHITECTURE

## 5.1 Research current technology; do not blindly follow a stale version list

The initial proposal names React 19+, Vite, TypeScript, Go,
Fiber/fasthttp, TanStack, Zustand and TanStack Query. Treat these as
starting candidates.

Verify the current stable versions and compatibility as of the actual
research date. Use official release notes, documentation, repositories,
security advisories and benchmarks. Do not invent future versions. Do
not pin a version simply because this brief mentions it.

Research and document alternatives for each major decision. The final
architecture must explain why each technology is selected.

## 5.2 Frontend

Starting candidates:

-   React.
-   TypeScript with strict compiler settings.
-   Vite or a justified alternative.
-   Tailwind CSS or a justified styling architecture.
-   TanStack Query for server state.
-   Zustand for appropriate client state.
-   TanStack Table and TanStack Virtual for large data grids.
-   React Router or another suitable routing solution.
-   A validated schema system for runtime boundary validation.
-   Playwright for browser-level testing.

Requirements:

-   Strict TypeScript; avoid `any` and unsafe casts.
-   Feature-oriented module boundaries.
-   Reusable design tokens and semantic components.
-   Server state separated from local UI state.
-   Typed API client and typed error model.
-   Runtime validation at untrusted boundaries.
-   Route-level code splitting.
-   Lazy loading for heavy visualization modules.
-   Virtualized large collections.
-   Abortable requests and cleanup.
-   Stable keys and efficient rendering.
-   Error boundaries and recovery states.
-   Accessibility-first component APIs.
-   No generic starter UI or unused template assets.

Evaluate whether a PWA is useful. Investigate desktop packaging only if
it provides meaningful value and can reuse the web architecture safely.
Do not expand into multiple native applications without a documented
product case.

## 5.3 Backend

Go is the preferred core backend candidate because of its concurrency
model, deployment simplicity and systems integration strengths.

Research:

-   Current stable Go release.
-   `net/http` versus Fiber and other frameworks.
-   Standard-library HTTP capabilities versus `fasthttp` trade-offs.
-   Routing, middleware, observability and testing.
-   Context cancellation and deadline propagation.
-   Structured concurrency patterns.
-   Goroutine and worker lifecycle management.
-   Memory allocation and garbage collection.
-   Profiling and benchmark tooling.
-   Database drivers and migration tools.
-   Durable queues and event infrastructure.

Do not assume Fiber/fasthttp is automatically faster or better.
Benchmark realistic endpoints and payloads. Consider HTTP semantics,
streaming support, middleware compatibility, ecosystem maturity and
operational complexity.

## 5.4 SonicWire Core

Design a shared core with explicit boundaries. Candidate subsystems:

-   Identity and access.
-   Workspace and tenancy.
-   Media identity and metadata.
-   Provider registry.
-   Connector runtime.
-   Ingestion orchestration.
-   Processing engine.
-   Durable job scheduler.
-   Storage abstraction.
-   Search and indexing.
-   Playback and preview.
-   Social graph and content services.
-   Creator publishing orchestration.
-   Workflow engine.
-   Collaboration.
-   Notification service.
-   Event bus.
-   Audit and observability.
-   Plugin and developer platform.

Avoid premature microservices. Start with a modular architecture and
separate deployable services only where independent scaling, isolation,
ownership or reliability justify them. Document module boundaries and
dependency rules.

## 5.5 API and real-time communication

Evaluate REST, WebSocket, Server-Sent Events, gRPC and internal
messaging based on use case.

Requirements:

-   Versioned API contracts.
-   Typed request and response schemas.
-   Authentication and authorization on every protected operation.
-   Idempotency for job creation and consequential mutations.
-   Pagination and filtering.
-   Request size limits.
-   Rate limiting.
-   Timeouts and cancellation.
-   Correlation IDs and trace propagation.
-   Consistent error format.
-   Real-time job events with reconnection and replay/resynchronization
    strategy.
-   No assumption that WebSocket is always superior to SSE or ordinary
    HTTP.

## 5.6 Data architecture

Research and select appropriate technologies for:

-   Relational transactional data.
-   Object/blob storage.
-   Media metadata.
-   Full-text search.
-   Optional semantic search.
-   Cache.
-   Durable job state.
-   Event history.
-   Audit records.
-   Local-only deployment.

Evaluate PostgreSQL and other suitable relational options. Consider
SQLite for local/single-user deployment where appropriate. Do not
introduce a database or cache without a clear need.

Design canonical entities and relationships, including:

-   User.
-   Workspace.
-   Membership.
-   Role and permission.
-   Connected account.
-   Provider.
-   Media source.
-   Media asset.
-   Media stream.
-   Metadata record.
-   Asset version.
-   Derived asset.
-   Collection.
-   Playlist.
-   Tag.
-   Acquisition job.
-   Processing job.
-   Workflow and workflow run.
-   Worker.
-   Storage location.
-   Social post/reference.
-   Creator profile.
-   Comment and reaction.
-   Notification.
-   Audit event.
-   Plugin and connector manifest.

Define ownership, tenancy, deletion semantics, retention, indexes,
constraints, migrations and data lifecycle.

## 5.7 Storage and streaming architecture

The initial proposal favors zero-disk in-memory ZIP streaming. Treat
that as an optimization mode, not a universal rule.

Research and implement safe storage strategies:

-   Direct streaming for suitable outputs.
-   Bounded in-memory buffers.
-   Temporary-file spooling when required.
-   Configurable scratch storage.
-   Object storage for large or durable outputs.
-   Range requests where supported.
-   Resumable uploads/downloads where supported.
-   Checksums and integrity verification.
-   Cleanup and retention policies.
-   Per-job storage quotas.
-   Backpressure and slow-client handling.
-   Cancellation and partial-output cleanup.

Never buffer arbitrarily large media or archives entirely in RAM. Use
bounded buffers, streaming pipelines and explicit disk-spill thresholds.
Do not start an HTTP response before the system can reliably communicate
failures and headers. A ZIP archive generally cannot be finalized until
its entries are complete; design streaming behavior correctly and
document trade-offs.

## 5.8 Media processing

Evaluate FFmpeg and other mature tools. Build a controlled execution
layer:

-   Explicit binary and codec capability detection.
-   Argument construction without shell injection.
-   Sandboxed execution where feasible.
-   Per-job CPU, memory, time and output limits.
-   Cancellation and process-tree cleanup.
-   Safe temporary storage.
-   Input probing and validation.
-   Output validation.
-   Metadata and integrity checks.
-   Structured logs.
-   License and codec compliance.
-   Resource-aware scheduling.

Do not assume every format, codec, profile or hardware accelerator is
available on every deployment.

## 5.9 Quantum-inspired research

The initial PRD refers to quantum-inspired scheduling and quantum SDKs.
Investigate this rigorously.

First define actual optimization problems, for example:

-   Worker-to-job assignment.
-   Multi-resource scheduling.
-   Deadline and priority optimization.
-   Batch grouping.
-   Network-aware placement.

Establish classical baselines such as heuristics, greedy strategies,
local search, simulated annealing or other appropriate optimization
methods. Measure solution quality, runtime, memory, reproducibility and
operational overhead.

Only add quantum-inspired methods if they outperform or materially
complement the baseline for a realistic workload. Quantum SDK
integrations are optional experiments and must be isolated from core
operation. No quantum hardware dependency may be required for the
product to function.

## 5.10 Plugin and extension architecture

Research a secure extension model for:

-   Provider connectors.
-   Processing adapters.
-   Workflow nodes.
-   Export targets.
-   Metadata enrichers.
-   Search integrations.
-   UI extensions where justified.

Define manifest format, permissions, API versioning, resource quotas,
sandboxing, signing/trust model, update and rollback behavior,
compatibility rules and audit logging.

Never load arbitrary third-party code into the privileged core process
without isolation and a threat model.

------------------------------------------------------------------------

# 6. SOCIAL CONNECTORS, PROVIDER CAPABILITIES AND RIGHTS

## 6.1 Provider capability matrix

For each proposed provider, research official documentation and record:

-   Supported API products.
-   Authentication and OAuth scopes.
-   Account eligibility.
-   Read capabilities.
-   Search capabilities.
-   Metadata capabilities.
-   Upload/publishing capabilities.
-   Scheduling capabilities.
-   Analytics capabilities.
-   Webhook support.
-   Rate limits and quotas.
-   Review or verification requirements.
-   Geographic limitations.
-   Content and media access restrictions.
-   Terms and developer policies.
-   Data retention and deletion requirements.
-   Required credentials and human approvals.

Potential providers to investigate include YouTube, Instagram, Facebook,
TikTok, Twitch, SoundCloud, Vimeo, X, Reddit and other relevant
services. This is a research list, not a claim that every provider
offers every operation.

If an official API does not permit an operation, do not silently
substitute prohibited scraping. Clearly state the limitation and provide
an authorized alternative such as link saving, metadata entry,
user-provided file import or provider-native handoff.

## 6.2 OAuth and connected accounts

Requirements:

-   OAuth 2.0 / OIDC patterns appropriate to each provider.
-   PKCE where applicable.
-   Least-privilege scopes.
-   Secure token storage and encryption.
-   Token refresh and revocation handling.
-   No client-side exposure of secrets.
-   Explicit connection and disconnection flows.
-   Clear permission explanations.
-   Audit events.
-   Data deletion on disconnect where required.
-   No credential collection through imitation login pages.

## 6.3 Native SonicWire social platform

If implemented, include:

-   Profiles.
-   Follows.
-   Collections.
-   Posts or media references.
-   Comments and reactions.
-   Feeds and discovery.
-   Communities.
-   Notifications.
-   Messaging only if the security and moderation scope is justified.
-   Blocking, muting and reporting.
-   Moderation queues and enforcement actions.
-   Privacy controls.
-   Content attribution and rights reporting.
-   Rate limits and anti-spam controls.

Design for safety from the start. Do not release a public community
feature without reporting, moderation, abuse response, privacy controls
and clear community rules.

## 6.4 Creator publishing

Implement only officially supported publishing workflows. Include draft
state, review state, scheduled state, publishing state, success,
failure, retry policy and provider response details. Publishing must be
an explicit user-authorized action, never an invisible side effect of
importing or transforming media.

------------------------------------------------------------------------

# 7. SECURITY, PRIVACY AND TRUST

Security is an engineering workstream, not a final checklist.

## 7.1 Threat modelling

Create a threat model covering:

-   Malicious URLs and SSRF.
-   DNS rebinding and redirect abuse.
-   Malicious media files and parser vulnerabilities.
-   Archive bombs and decompression bombs.
-   Path traversal.
-   Command and shell injection.
-   Cross-site scripting.
-   CSRF.
-   SQL injection.
-   Authentication and session theft.
-   OAuth token leakage.
-   Broken object-level authorization.
-   Tenant/workspace data leakage.
-   Insecure direct object references.
-   Plugin compromise.
-   Worker compromise.
-   Resource exhaustion and denial of service.
-   Social spam, impersonation and harassment.
-   Supply-chain compromise.
-   Secrets leakage in logs and diagnostics.
-   Unsafe file preview and content rendering.

## 7.2 Mandatory controls

-   Secure authentication and session lifecycle.
-   Strong authorization checks on every object and operation.
-   Workspace isolation.
-   Encryption in transit.
-   Encryption at rest where appropriate.
-   Secret management through environment or a suitable secret store.
-   No committed secrets.
-   CSRF and XSS protections.
-   Content Security Policy.
-   Secure headers.
-   Input validation.
-   Output encoding.
-   Rate limits and quotas.
-   Safe URL resolution and network egress controls.
-   File type and content validation.
-   Sandboxed media processing where feasible.
-   Dependency scanning.
-   Static analysis.
-   Audit trails.
-   Backup and recovery.
-   Data export and deletion workflows.
-   Retention policies.
-   Privacy-conscious telemetry.

## 7.3 User trust

Clearly explain:

-   What data is collected.
-   What remains local.
-   What is sent to external providers.
-   What is stored.
-   How long data is retained.
-   How connected accounts are used.
-   How users disconnect services.
-   How users export or delete their data.

Never use private tracking or covert profiling.

------------------------------------------------------------------------

# 8. PERFORMANCE AND SCALE ENGINEERING

## 8.1 Replace vague speed claims with measurable service objectives

Do not promise sub-millisecond end-to-end media acquisition or network
transfer. Separate internal computation latency from external provider
latency, network transfer time, codec processing time and user-perceived
latency.

Establish measurable targets after profiling the real environment.
Define:

-   API latency percentiles.
-   Time to first meaningful UI response.
-   Time to first byte for streaming operations.
-   Metadata resolution time by provider and cache state.
-   Throughput by media type and workload.
-   Queue wait time.
-   Processing throughput.
-   Memory per active job.
-   CPU and GPU utilization.
-   Frontend interaction latency.
-   Bundle and asset budgets.
-   Recovery time after failure.

Document test hardware, operating system, network conditions, data size,
concurrency, cache state and measurement method.

## 8.2 Resource governance

Every subsystem must have:

-   Global and per-user concurrency limits.
-   Bounded queues.
-   Memory budgets.
-   CPU and GPU budgets where possible.
-   Network bandwidth controls.
-   Job deadlines.
-   Cancellation.
-   Retry limits.
-   Backpressure.
-   Admission control.
-   Fair scheduling.
-   Cleanup guarantees.
-   Observability.

Use `sync.Pool` only where profiling shows it helps. Do not use pools as
a substitute for correct ownership and lifecycle management. Avoid
unsafe memory tricks without evidence and a documented safety case.

## 8.3 Large playlists and collections

Do not attempt to materialize millions of rows or metadata records in
browser memory.

Use:

-   Cursor-based or keyset pagination.
-   Incremental ingestion.
-   Server-side filtering and sorting.
-   Virtualized rendering.
-   Lazy thumbnail loading.
-   Bounded client caches.
-   Batch operations with progress and cancellation.
-   Durable import state.
-   Backpressure from UI to backend.
-   Efficient bulk persistence.

The UI must remain responsive without claiming zero performance cost.

## 8.4 Frontend performance

Measure:

-   Core Web Vitals where applicable.
-   JavaScript bundle sizes.
-   Route and component loading.
-   Long tasks.
-   React rendering behavior.
-   Image decode and loading.
-   Video memory and decoding.
-   Canvas/WebGL frame rate.
-   Scroll performance.
-   Memory after long sessions.
-   Mobile power consumption.

Heavy visual effects must degrade gracefully on low-power devices, small
screens, reduced-motion settings and constrained networks.

------------------------------------------------------------------------

# 9. RESPONSIVE DESIGN AND DEVICE SUPPORT

Support a genuinely adaptive experience across:

-   Compact phones.
-   Standard phones.
-   Large phones.
-   Tablets.
-   Foldables and dual-screen devices.
-   Laptops.
-   Desktop monitors.
-   High-density and 4K displays.
-   Wide and ultra-wide displays.

Use fluid layouts, CSS Grid, Flexbox and container queries. Do not
impose arbitrary fixed-width layouts. Use breakpoints based on content
and interaction needs rather than device marketing labels.

Requirements:

-   Touch targets appropriate to platform guidance.
-   Keyboard-first desktop interaction.
-   Adaptive navigation.
-   Contextual density.
-   Responsive media previews.
-   Safe-area handling.
-   Fold and hinge awareness where platform/browser support permits.
-   Reduced-motion mode.
-   High-contrast and accessible focus states.
-   Zoom and text scaling.
-   No horizontal overflow unless explicitly designed for a specialized
    workspace.

Create and test a representative viewport matrix. Include real browser
screenshots and interaction tests.

------------------------------------------------------------------------

# 10. DOCUMENTATION DELIVERABLES --- THE SONICWIRE BIBLES

Before major implementation, create a structured documentation system.
Documents must be detailed, interconnected, maintained and traceable to
requirements.

Recommended repository structure:

``` text
docs/
  00-executive/
    vision.md
    product-principles.md
    scope-and-boundaries.md
    glossary.md
    assumptions.md
  01-product/
    product-bible.md
    domain-map.md
    feature-catalogue.md
    personas-and-jobs.md
    user-journeys.md
    release-strategy.md
    requirements-traceability.md
  02-ux/
    ux-bible.md
    information-architecture.md
    navigation-model.md
    screen-inventory.md
    interaction-specifications/
    state-matrices/
    accessibility-specification.md
  03-design/
    design-bible.md
    visual-direction.md
    design-system.md
    typography.md
    color-and-materials.md
    motion-language.md
    responsive-art-direction.md
    component-inventory.md
    asset-register.md
    visual-quality-rubric.md
    screen-specifications/
  04-architecture/
    architecture-bible.md
    system-context.md
    module-boundaries.md
    runtime-topology.md
    data-flow.md
    event-model.md
    api-strategy.md
    architecture-decisions/
  05-backend/
    backend-bible.md
    service-contracts/
    concurrency-and-scheduling.md
    streaming-and-storage.md
    media-processing.md
    worker-lifecycle.md
  06-media/
    media-bible.md
    formats-and-codecs.md
    metadata-model.md
    quality-model.md
    acquisition-policy.md
    transformation-pipelines.md
  07-social/
    social-bible.md
    provider-capability-matrix.md
    oauth-and-account-linking.md
    creator-publishing.md
    moderation-and-safety.md
  08-data/
    data-bible.md
    entity-model.md
    schema-specification.md
    indexing-and-search.md
    retention-and-deletion.md
    backup-and-recovery.md
  09-security/
    security-bible.md
    threat-model.md
    authorization-model.md
    privacy-model.md
    secure-development.md
    incident-response.md
  10-performance/
    performance-bible.md
    service-objectives.md
    benchmark-methodology.md
    capacity-model.md
    profiling-results/
  11-testing/
    testing-bible.md
    test-strategy.md
    acceptance-criteria/
    visual-regression.md
    load-and-soak-testing.md
    security-testing.md
  12-operations/
    deployment-bible.md
    local-development.md
    configuration-reference.md
    monitoring-and-alerting.md
    backup-restore-runbooks.md
    troubleshooting.md
  13-developer-platform/
    api-bible.md
    plugin-bible.md
    connector-sdk.md
    workflow-node-sdk.md
    versioning-and-compatibility.md
  decisions/
  risks/
  research/
    source-register.md
    technology-evaluations/
    provider-research/
    design-research/
  plans/
    implementation-roadmap.md
    milestones.md
    verification-matrix.md
```

Do not generate empty documents merely to fill this structure. Every
created document must contain useful, researched and internally
consistent material. Link related documents and identify owners, status,
revision date and sources.

## 10.1 Architecture Decision Records

Each significant decision must record:

-   Context.
-   Requirements.
-   Options considered.
-   Evidence and sources.
-   Evaluation criteria.
-   Decision.
-   Consequences.
-   Risks.
-   Revisit conditions.

## 10.2 Research source register

For every important external claim, record:

-   Claim or decision supported.
-   Source title and URL.
-   Publisher/maintainer.
-   Publication or revision date when available.
-   Date accessed.
-   Relevant version.
-   Reliability classification.
-   Relevant excerpt or concise summary.
-   How it influenced the decision.

Prefer official documentation, specifications, source repositories,
release notes and security advisories. Use independent benchmarks and
community experience as supplementary evidence, not as replacements for
primary sources.

------------------------------------------------------------------------

# 11. IMPLEMENTATION AND REPOSITORY ENGINEERING

## 11.1 Inspect before modifying

At the beginning:

-   Inspect the repository and current branch.
-   Identify existing code and user changes.
-   Read project instructions.
-   Detect available runtimes, package managers, tools and environment
    constraints.
-   Inspect available design skills and creative tools.
-   Establish a baseline build and test status.
-   Record existing problems.
-   Never assume the repository is empty.

Do not destroy user work to create a preferred layout. If a clean
architecture is needed, migrate safely and preserve history/data.

## 11.2 Suggested repository organization

Adjust based on evidence, but maintain clear separation:

``` text
/frontend/
  src/
    app/
    routes/
    features/
    shared/
    design-system/
    services/
    state/
    assets/
    tests/
/backend/
  cmd/
  internal/
    core/
    identity/
    media/
    providers/
    acquisition/
    processing/
    scheduler/
    storage/
    search/
    social/
    creator/
    workflows/
    collaboration/
    observability/
  api/
  migrations/
  tests/
/worker/
/packages/
/plugins/
/website/
/docs/
/assets/
/infra/
/scripts/
```

Do not create empty folders or artificial abstractions. The actual
architecture must be reflected in the code.

## 11.3 Engineering standards

-   Strict types and explicit contracts.
-   Small cohesive modules.
-   Clear ownership and dependency direction.
-   Structured logging.
-   Consistent error handling.
-   Context cancellation.
-   Idempotent job processing.
-   Database transactions where needed.
-   Safe migrations.
-   Configuration validation.
-   No hard-coded secrets.
-   No unexplained magic constants.
-   No giant god objects or files.
-   No speculative abstraction without a use case.
-   No unreviewed generated code.
-   No silent error swallowing.
-   No ignored test failures.

Use formatters, linters, static analyzers, dependency audits and
reproducible builds.

## 11.4 Build vertical slices

Do not build every backend subsystem first and leave the frontend
disconnected. Deliver complete vertical slices with frontend, API,
persistence, background processing, error handling and tests.

A vertical slice is not complete until the user can perform the workflow
end to end in the actual application.

------------------------------------------------------------------------

# 12. TESTING, QUALITY AND ACCEPTANCE

## 12.1 Required test layers

-   Unit tests.
-   Integration tests.
-   API contract tests.
-   Database migration tests.
-   Provider adapter tests using approved fixtures.
-   Media processing tests with redistributable or self-created
    fixtures.
-   Workflow tests.
-   End-to-end browser tests.
-   Accessibility tests.
-   Visual regression tests.
-   Responsive layout tests.
-   Performance benchmarks.
-   Load tests.
-   Long-duration soak tests.
-   Failure injection.
-   Security tests.
-   Backup and restore tests.

## 12.2 Test data

Use legally redistributable, generated or user-owned media fixtures.
Document the origin and license of every test asset. Never rely on a
real user's private account or copyrighted media as a test fixture
without authorization.

## 12.3 Failure testing

Test:

-   Network disconnect.
-   Slow provider.
-   Provider quota exceeded.
-   Expired OAuth token.
-   Malformed URL.
-   Malicious redirect.
-   Corrupt media.
-   Unsupported codec.
-   Disk full.
-   Memory pressure.
-   Worker crash.
-   Database restart.
-   Queue restart.
-   Browser refresh during a job.
-   Duplicate job submission.
-   User cancellation.
-   Partial archive failure.
-   Lost real-time connection.
-   Permission revocation.
-   Workspace boundary violations.

## 12.4 Definition of Done

A feature is complete only when:

1.  Requirements and acceptance criteria are documented.
2.  UX and responsive states are implemented.
3.  UI matches the approved design system.
4.  Backend behavior is real and integrated.
5.  Persistence and data lifecycle are correct.
6.  Authorization and security checks exist.
7.  Errors and cancellation are handled.
8.  Unit and integration tests pass.
9.  Relevant E2E tests pass.
10. Accessibility checks pass.
11. Performance is measured.
12. Documentation is current.
13. Observability exists.
14. No placeholder or fake functionality remains in the claimed
    production path.

## 12.5 Release quality gates

Never mark the product production-ready while any of the following
remain:

-   Critical or high-severity security vulnerabilities without accepted
    mitigation.
-   Data-loss or cross-tenant authorization defects.
-   Unbounded resource consumption.
-   Unrecoverable job-state corruption.
-   Broken primary user journeys.
-   Unhandled destructive operations.
-   Major accessibility failures.
-   Severe performance regressions.
-   Missing backup/restore verification for persistent deployments.
-   Unlicensed or prohibited dependencies/assets.
-   Public social features without moderation and abuse controls.
-   Claims that exceed implemented capabilities.

------------------------------------------------------------------------

# 13. AUTONOMOUS EXECUTION PHASES

Work continuously through these phases. Each phase has exit criteria. Do
not stop for routine user approval.

## Phase 0 --- Environment and repository reconnaissance

-   Inspect repository, branch, existing changes and environment.
-   Discover installed skills, design tools, image/video generation
    capabilities and browser testing tools.
-   Identify constraints and permissions.
-   Establish baseline build/test status.
-   Create a safe working plan.

**Exit:** repository and environment report; no user work lost; tools
and constraints documented.

## Phase 1 --- Product and market research

-   Research relevant products and competitors.
-   Identify product patterns worth learning from and weaknesses to
    avoid.
-   Research target users, jobs and workflows.
-   Verify media and social provider capabilities.
-   Research current technology and security landscape.
-   Identify legal, licensing and operational constraints.

**Exit:** research register, product positioning, domain map, feature
catalogue, risks and evidence-backed opportunity assessment.

## Phase 2 --- Design intelligence acquisition

-   Read Taste Skill fully.
-   Explore React Bits and other design ecosystems.
-   Inspect component source and licenses.
-   Research typography, 3D, motion, image and video production tools.
-   Build a visual reference library.
-   Explore multiple art directions.
-   Select and refine Cinematic Industrial.

**Exit:** design research report, visual direction, tool evaluation,
reference library and design-system proposal.

## Phase 3 --- Product and UX architecture

-   Define information architecture.
-   Define navigation.
-   Map user journeys.
-   Inventory every screen.
-   Specify responsive states.
-   Specify interaction and error states.
-   Define accessibility behavior.
-   Prioritize feature dependencies and releases.

**Exit:** complete UX Bible, screen specifications, interaction maps,
acceptance criteria and traceability matrix.

## Phase 4 --- System architecture and technical decisions

-   Define module boundaries.
-   Compare backend and frontend candidates.
-   Define data model and storage architecture.
-   Define job lifecycle and worker orchestration.
-   Define provider connector contracts.
-   Define social and creator integration model.
-   Define plugin security model.
-   Define deployment topology.
-   Define observability and performance objectives.

**Exit:** Architecture Bible, data Bible, API contracts, ADRs, threat
model and benchmark plan.

## Phase 5 --- Visual system and asset production

-   Implement design tokens.
-   Develop typography and icon system.
-   Adapt selected React Bits components.
-   Build custom components where justified.
-   Generate and curate required images and video assets.
-   Develop custom 3D and generative visuals where valuable.
-   Create responsive art direction.
-   Build visual test fixtures.

**Exit:** functional design system, approved screen designs, asset
register and visual verification baseline.

## Phase 6 --- Foundation engineering

-   Establish reproducible frontend and backend builds.
-   Configure CI checks.
-   Implement identity, authorization and workspace foundations.
-   Implement core data model and migrations.
-   Implement typed API contracts.
-   Implement event and job foundations.
-   Implement storage abstraction.
-   Implement logging, metrics and tracing.
-   Establish secure configuration.

**Exit:** tested foundations and operational development environment.

## Phase 7 --- Core media vertical slices

Implement and verify end-to-end workflows in sensible dependency order:

1.  Local media import and validation.
2.  Media probing and intelligence.
3.  Media library and search.
4.  Acquisition through permitted connectors.
5.  Job orchestration and resumability.
6.  Transformation pipelines.
7.  Playback and preview.
8.  Packaging and export.
9.  Workflow automation.
10. System observability.

**Exit:** real, integrated and tested core media experience.

## Phase 8 --- Social, creator and collaboration

-   Implement connected-account management.
-   Implement provider integrations that are actually authorized and
    supported.
-   Implement creator workspace.
-   Implement draft and publishing flows where official APIs permit.
-   Implement native social features with moderation and privacy
    controls.
-   Implement shared collections and collaboration.
-   Implement notifications and user controls.

**Exit:** only capabilities that pass their security, moderation, API
and acceptance gates may be marked production-ready. Unsupported
provider features must be transparently unavailable, not simulated.

## Phase 9 --- Advanced optimization and extensions

-   Profile real workloads.
-   Improve scheduling and resource governance.
-   Evaluate quantum-inspired algorithms against classical baselines.
-   Add trusted distributed workers if justified.
-   Implement plugin/connector SDK and compatibility rules.
-   Improve search and media intelligence.
-   Optimize large libraries and batch operations.

**Exit:** reproducible benchmark evidence, safe extension architecture
and documented limitations.

## Phase 10 --- Full product hardening

-   Run all test layers.
-   Run security and dependency audits.
-   Run load and soak tests.
-   Run backup/restore tests.
-   Run visual regression across viewports.
-   Verify reduced-motion and accessibility.
-   Inspect memory and resource behavior.
-   Verify cancellation, recovery and data deletion.
-   Review every primary user journey.

**Exit:** all release gates pass or remaining blockers are explicitly
documented and the product is not falsely labeled production-ready.

## Phase 11 --- Delivery and handover

Deliver:

-   Working source code.
-   Reproducible build instructions.
-   Environment configuration example with no secrets.
-   Database migrations.
-   Test suite and test reports.
-   Benchmark reports.
-   Security and privacy documentation.
-   User documentation.
-   Developer and plugin documentation.
-   Deployment and operations runbooks.
-   Known limitations.
-   Release notes.
-   Final architecture and product documentation index.

Do not perform public deployment or paid provisioning without explicit
authorization.

------------------------------------------------------------------------

# 14. AUTONOMOUS WORK LOOP AND CONTINUITY

Operate with this loop:

1.  Identify the highest-priority incomplete requirement.
2.  Read its specification and dependencies.
3.  Research missing evidence.
4.  Make and record a decision.
5.  Implement a bounded, reviewable change.
6.  Run relevant tests and checks.
7.  Inspect the actual UI or system behavior.
8.  Fix regressions.
9.  Update documentation and traceability.
10. Commit or checkpoint safely if repository policy allows.
11. Select the next incomplete requirement.
12. Continue.

Maintain these living files:

-   `docs/plans/current-state.md`
-   `docs/plans/next-actions.md`
-   `docs/plans/milestones.md`
-   `docs/risks/risk-register.md`
-   `docs/decisions/decision-index.md`
-   `docs/implementation-status.md`
-   `docs/testing/verification-matrix.md`

At the end of each autonomous work session, record:

-   What changed.
-   What passed.
-   What failed.
-   What remains.
-   Exact next action.
-   Commands required to resume.
-   Any human authorization or external dependency required.

If execution time, context window or tool limits interrupt work, leave a
complete checkpoint and resume from it when execution is available. Do
not claim that work continued while the agent was not running.

Do not spend hours repeating research already completed. Search existing
documentation and source registers before researching again.

------------------------------------------------------------------------

# 15. PRIORITIZATION AND SCOPE CONTROL

The product vision is intentionally ambitious. Protect it from
uncontrolled scope expansion.

Use these priority classes:

-   **P0 --- Product integrity:** security, identity, data integrity,
    permissions, core media model, job lifecycle and reliable
    foundations.
-   **P1 --- Core product:** discovery, acquisition, media intelligence,
    library, transformation, playback and observability.
-   **P2 --- Ecosystem:** creator studio, authorized social connectors,
    workflows, collaboration and native social capabilities.
-   **P3 --- Advanced extensions:** distributed workers, developer
    marketplace, advanced AI, quantum-inspired experiments and
    specialized visual experiences.

This is a dependency and risk priority, not permission to leave P0/P1 as
prototypes. The release plan must define coherent production milestones.
Do not present P2/P3 as complete until they meet the same Definition of
Done.

For every proposed feature, record:

-   User problem.
-   Expected value.
-   Dependencies.
-   Complexity.
-   Security and privacy impact.
-   Operational burden.
-   Evidence.
-   Acceptance criteria.
-   Release priority.

Reject features that add complexity without a meaningful user outcome.

------------------------------------------------------------------------

# 16. PRODUCT AND VISUAL QUALITY SCORECARD

Create measurable scorecards. Do not use subjective claims such as "best
in class" as proof.

Evaluate:

## Product quality

-   Primary user journeys complete.
-   Feature reliability.
-   Data integrity.
-   Recovery behavior.
-   Discoverability.
-   Consistency.
-   Accessibility.
-   Privacy and user control.

## Visual quality

-   Originality and coherence.
-   Typography quality.
-   Composition and hierarchy.
-   Detail and spacing.
-   Responsive art direction.
-   Motion quality.
-   Accessibility.
-   Asset quality and consistency.
-   Visual regression stability.

## Engineering quality

-   Architecture clarity.
-   Type safety.
-   Test coverage and meaningful assertions.
-   Performance.
-   Security posture.
-   Observability.
-   Maintainability.
-   Reproducibility.
-   Documentation quality.

## Operational quality

-   Deployment repeatability.
-   Backup and restore.
-   Monitoring.
-   Incident diagnosis.
-   Upgrade and migration safety.
-   Resource controls.
-   Cost visibility.
-   Recovery and rollback.

Set concrete thresholds only after researching the environment and
measuring realistic baselines. Record why each threshold is appropriate.

------------------------------------------------------------------------

# 17. FINAL AUTONOMOUS AGENT INSTRUCTIONS

You are expected to behave like a coordinated senior product and
engineering organization, not a code generator waiting for the next
prompt.

-   Think independently.
-   Research deeply.
-   Challenge the initial proposal when evidence warrants it.
-   Improve the product beyond the initial feature list when a strong,
    relevant opportunity is discovered.
-   Do not add speculative features merely because they sound
    futuristic.
-   Prefer robust, measurable engineering over fashionable terminology.
-   Make the Cinematic Industrial design direction exceptional and
    original.
-   Explore the complete available Taste Skill and React Bits resources.
-   Use image and video generation when it genuinely improves the
    product.
-   Produce as many visual assets as needed, with rigorous curation and
    optimization.
-   Make the website and application distinct but visually related.
-   Build the full product experience, not just its landing page.
-   Implement real integrations only where permissions and provider
    capabilities support them.
-   Build safety, moderation and privacy into social features.
-   Make all primary functionality real, tested and recoverable.
-   Keep the system modular without unnecessary microservices.
-   Use Go and concurrency deliberately, with bounded resources and
    profiling.
-   Investigate quantum-inspired optimization scientifically, without
    exaggerated claims.
-   Never trade data safety for speed.
-   Never trade usability for visual effects.
-   Never mark an incomplete capability as complete.
-   Never ask the user routine questions that can be resolved through
    research and sound engineering judgment.
-   Never stop merely because a phase or document is finished. Continue
    to the next safe, defined task.
-   Never perform externally visible, paid, destructive or legally
    binding actions without authorization.

**Your mission is to turn SonicWire into a coherent, exceptional,
secure, maintainable and genuinely usable media technology ecosystem.
Research, document, engineer, test, refine and verify it to the highest
standard the available environment can support.**

The final measure of success is not the length of the documentation, the
number of generated images, the number of technologies used or the
complexity of the architecture.

It is whether SonicWire works exceptionally well for real users, looks
unmistakably premium, handles real workloads safely, respects creators
and providers, and can evolve for years without collapsing under its own
complexity.

------------------------------------------------------------------------

# APPENDIX A --- INITIAL RESEARCH QUESTIONS

The agent must resolve these through research and documented decisions
rather than asking the user:

1.  Which deployment model best supports local-first, cloud and
    self-hosted use?
2.  Is a web-first application with PWA capabilities sufficient, or is a
    desktop shell justified?
3.  Which Go HTTP stack offers the best balance of performance,
    standards compliance and maintainability?
4.  Which database and object-storage architecture fits local and
    multi-user deployments?
5.  Which job queue and event-delivery design provides durable,
    recoverable processing?
6.  Which media processing tools and codec builds are legally and
    technically suitable?
7.  Which provider APIs permit each proposed operation?
8.  What is the safest and most maintainable native social architecture?
9.  What moderation and abuse operations are required before public
    launch?
10. Which component ecosystems best complement Taste Skill and React
    Bits?
11. Which typography families are legally licensable and technically
    appropriate?
12. Which image, video and 3D generation tools are available and
    permitted?
13. Which visual effects are worth their performance and maintenance
    costs?
14. Which workloads genuinely benefit from quantum-inspired
    optimization?
15. Which features should be local, server-side or distributed?
16. What are realistic performance objectives for the target hardware
    and deployment models?
17. How can the product support large libraries without unbounded memory
    use?
18. What is the minimum coherent production release and how does it
    expand without architectural rework?

# APPENDIX B --- REQUIRED FIRST OUTPUTS

Before significant implementation, produce these concrete artifacts:

1.  Repository and environment reconnaissance report.
2.  Product research and competitor analysis.
3.  Provider capability and restrictions matrix.
4.  Taste Skill acquisition and analysis report.
5.  React Bits and component ecosystem evaluation.
6.  Cinematic Industrial visual research board.
7.  Multiple art-direction concepts and selection rationale.
8.  Product domain and dependency map.
9.  Feature catalogue with priority and acceptance criteria.
10. Complete navigation and information architecture.
11. Screen inventory and user journeys.
12. Design tokens, typography and motion specification.
13. Asset generation and curation plan.
14. Architecture alternatives and ADRs.
15. Data model and API contract proposal.
16. Threat model and privacy model.
17. Performance and benchmark methodology.
18. Test strategy and release gates.
19. Phased implementation roadmap.
20. Traceability matrix connecting vision → requirements → design → code
    → tests.

After these artifacts are sufficiently complete and internally
consistent, proceed directly into implementation. Do not wait for
routine user approval.

------------------------------------------------------------------------

**END OF SONICWIRE AUTONOMOUS PRODUCT, DESIGN AND ENGINEERING MASTER
MANDATE**
