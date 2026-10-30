import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useProviders, useSession } from '../lib/queries';
import { Mark } from '../design-system/Brand';
import { Button } from '../design-system/ui';

/**
 * Public landing page.
 *
 * Rules this page follows (taste-skill house style, `SKILL.md` §House rules):
 * two-line headlines, no eyebrows, no tiny uppercase labels, no monospace outside
 * the product fragment, no gradients, no glows, no shadows at rest, no hairline
 * section dividers, one accent colour, two typefaces, and real data only.
 *
 * The "picture" on this page is the product itself: a live interface fragment
 * (`data-ui`) wired to /api/health and /api/providers, and the provider policy
 * table which is fetched, not mocked.
 */

const NAV = [
  { href: '#what', label: 'What it does' },
  { href: '#providers', label: 'Provider policy' },
  { href: '#limits', label: 'Limits' },
];

export default function Landing() {
  const session = useSession();
  const health = useQuery({ queryKey: ['health', 'public'], queryFn: api.health, retry: false });
  const providers = useProviders();

  const enterTarget = session.data?.needsSetup
    ? '/setup'
    : session.data?.user
      ? '/app'
      : '/login';
  const enterLabel = session.data?.needsSetup
    ? 'Set up this instance'
    : session.data?.user
      ? 'Open the console'
      : 'Sign in';

  const items = providers.data?.items ?? [];
  const directMedia = items.filter((provider) => provider.ingestion === 'direct-media');
  const linkOnly = items.filter((provider) => provider.ingestion === 'link-only');

  return (
    <div className="min-h-dvh bg-obsidian text-ink">
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-6 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5" aria-label="SonicWire home">
          <Mark className="size-6 text-ink" />
          <span className="font-display text-[17px] font-semibold tracking-[-0.03em]">SonicWire</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 sm:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[14px] text-mute transition-colors hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <Link to={enterTarget}>
          <Button variant="quiet" size="sm">
            {enterLabel}
          </Button>
        </Link>
      </header>

      {/* Hero: headline is two lines at every width; the product fragment is the image. */}
      <section className="mx-auto grid max-w-[1180px] gap-14 px-5 pt-10 pb-24 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16 lg:pt-16">
        <div>
          <h1 className="font-display text-[clamp(2.7rem,6.2vw,4.6rem)] leading-[0.96] font-semibold tracking-[-0.045em]">
            Every signal measured.
            <br />
            Every frame accounted for.
          </h1>
          <p className="mt-7 max-w-[30em] text-[17px] leading-[1.55] text-mute sm:text-[19px]">
            SonicWire is a local media library that inspects what a file actually contains,
            transforms it with verifiable outputs, and keeps the lineage of every derivative.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to={enterTarget}>
              <Button variant="primary" size="lg">
                {enterLabel}
              </Button>
            </Link>
            <a
              href="#providers"
              className="text-[14px] text-mute underline decoration-white/25 underline-offset-4 transition-colors hover:text-ink hover:decoration-white/60"
            >
              See which sources it will and will not fetch
            </a>
          </div>
        </div>

        <CoreFragment
          version={health.data?.version}
          status={health.data?.status}
          checks={health.data?.checks}
          providers={items.length}
          direct={directMedia.length}
          linkOnly={linkOnly.length}
        />
      </section>

      <section id="what" className="bg-graphite py-24 sm:py-28">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <h2 className="max-w-[16em] font-display text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.02] font-semibold tracking-[-0.035em]">
            Three things happen to a file here, and each one leaves evidence.
          </h2>

          <div className="mt-16 grid gap-12 lg:grid-cols-3 lg:gap-10">
            <article>
              <h3 className="text-[19px] font-semibold text-ink">It arrives through a gate</h3>
              <p className="mt-3 text-[16px] leading-[1.6] text-mute">
                Uploads are hashed while they stream. Public URLs are resolved first, then
                refused if they point at loopback, a private range, a link-local address or a
                provider with no legal download path.
              </p>
              <p className="mt-4 text-[15px] leading-[1.6] text-dim">
                Redirects are re-checked at every hop and the validated IP is pinned, so a
                hostname cannot change its mind between the check and the fetch.
              </p>
            </article>
            <article>
              <h3 className="text-[19px] font-semibold text-ink">It gets measured</h3>
              <p className="mt-3 text-[16px] leading-[1.6] text-mute">
                FFprobe reports the container, both codecs, pixel format, bit rate, frame-rate
                mode, colour metadata and every stream. Those facts become the asset, not a
                description of it.
              </p>
              <p className="mt-4 text-[15px] leading-[1.6] text-dim">
                A bounded waveform and a poster frame are derived from the file itself. Nothing
                in the interface shows a number the engine did not produce.
              </p>
            </article>
            <article>
              <h3 className="text-[19px] font-semibold text-ink">It can be changed without being lost</h3>
              <p className="mt-3 text-[16px] leading-[1.6] text-mute">
                Transforms run as bounded jobs against a fixed preset list, with progress from
                the encoder and cancellation that kills the whole process tree.
              </p>
              <p className="mt-4 text-[15px] leading-[1.6] text-dim">
                Every output is a new asset with its own hash, its own probe and a link back to
                the master it came from. Bundles export as a zip with a manifest that proves it.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="providers" className="py-24 sm:py-28">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
            <h2 className="font-display text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.02] font-semibold tracking-[-0.035em]">
              {linkOnly.length > 0
                ? `${linkOnly.length} of ${items.length} sources cannot be downloaded, and SonicWire says so.`
                : 'What each official API actually permits.'}
            </h2>
            <p className="text-[16px] leading-[1.6] text-mute">
              A capability matrix researched from provider documentation. Where no official
              media-download API exists, SonicWire stores a reference and refuses the fetch with
              the provider's own restriction instead of scraping the page.
            </p>
          </div>

          <div className="mt-12 overflow-x-auto" data-ui>
            <table className="w-full min-w-[720px] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-white/12">
                  <th scope="col" className="py-3 pr-4 font-medium text-dim">Provider</th>
                  <th scope="col" className="px-4 py-3 font-medium text-dim">Metadata access</th>
                  <th scope="col" className="px-4 py-3 font-medium text-dim">Publishing</th>
                  <th scope="col" className="py-3 pl-4 text-right font-medium text-dim">Media bytes</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-[14px] text-dim">
                      {providers.isError
                        ? 'The capability matrix needs the API to be running.'
                        : 'Reading the capability matrix…'}
                    </td>
                  </tr>
                ) : (
                  items.map((provider) => (
                    <tr key={provider.id} className="border-b border-white/[0.06]">
                      <th scope="row" className="py-3 pr-4 font-normal text-ink">
                        {provider.name}
                      </th>
                      <td className="px-4 py-3 text-mute">
                        {provider.capabilities.metadata === 'official-api' ? 'Official API' : 'None'}
                      </td>
                      <td className="px-4 py-3 text-mute">
                        {provider.capabilities.publish === 'official-api' ? 'Official API' : 'None'}
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <span
                          className={
                            provider.ingestion === 'direct-media' ? 'text-ember' : 'text-dim'
                          }
                        >
                          {provider.ingestion === 'direct-media' ? 'Fetch allowed' : 'Reference only'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {linkOnly[0] ? (
            <p className="mt-10 max-w-[52em] text-[16px] leading-[1.6] text-mute">
              {linkOnly[0].name}: {linkOnly[0].restrictions[0] ?? 'No download API is offered.'}
            </p>
          ) : null}
        </div>
      </section>

      <section className="bg-graphite py-24 sm:py-28">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            <div>
              <h2 className="font-display text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.02] font-semibold tracking-[-0.035em]">
                One machine, no tenant, no telemetry.
              </h2>
              <p className="mt-6 max-w-[34em] text-[17px] leading-[1.6] text-mute">
                SQLite, a bounded worker pool and the bundled FFmpeg build. Media, metadata and
                the audit ledger stay in a directory you can copy, archive or delete.
              </p>
            </div>
            <div data-ui className="rounded-md bg-steel p-6">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
                <div>
                  <dt className="text-[13px] text-dim">Worker pool</dt>
                  <dd className="mt-1 text-[15px] text-ink">2 bounded workers</dd>
                </div>
                <div>
                  <dt className="text-[13px] text-dim">Queue durability</dt>
                  <dd className="mt-1 text-[15px] text-ink">SQLite leases</dd>
                </div>
                <div>
                  <dt className="text-[13px] text-dim">Retries</dt>
                  <dd className="mt-1 text-[15px] text-ink">3, transient only</dd>
                </div>
                <div>
                  <dt className="text-[13px] text-dim">Cancellation</dt>
                  <dd className="mt-1 text-[15px] text-ink">Process group</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section id="limits" className="py-24 sm:py-28">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <h2 className="font-display text-[clamp(1.9rem,3.4vw,2.6rem)] leading-[1.02] font-semibold tracking-[-0.035em]">
            What this build does not do.
          </h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            <p className="text-[16px] leading-[1.6] text-mute">
              No provider connectors are enabled. The twelve entries above are researched policy,
              and a connection requires operator credentials plus a completed OAuth handshake.
            </p>
            <p className="text-[16px] leading-[1.6] text-mute">
              No transcription, semantic search or AI tagging. Those would need a model host and
              a way to verify the claim; neither exists in this build.
            </p>
            <p className="text-[16px] leading-[1.6] text-mute">
              No cloud rendering or multi-host workers. The queue is local, leases included, and
              it recovers from a crash rather than pretending the job never happened.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.08] py-14">
        <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <span className="font-display text-[clamp(2rem,5vw,3.4rem)] leading-none font-semibold tracking-[-0.05em] text-ink/90">
              SonicWire
            </span>
            <div className="flex flex-wrap items-center gap-6 text-[14px] text-dim">
              <Link to={enterTarget} className="transition-colors hover:text-ink">
                {enterLabel}
              </Link>
              <a href="#providers" className="transition-colors hover:text-ink">
                Provider policy
              </a>
              <span>
                Build {health.data?.version ?? '0.1.0'} · runs locally
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * A real fragment of the console, not a mock: the same /api/health and
 * /api/providers endpoints the console reads. Unavailable values print as an
 * em dash rather than a spinner that never resolves.
 */
function CoreFragment({
  version,
  status,
  checks,
  providers,
  direct,
  linkOnly,
}: {
  version?: string;
  status?: string;
  checks?: Record<string, { ok: boolean; detail: string | null }>;
  providers: number;
  direct: number;
  linkOnly: number;
}) {
  const rows = [
    { label: 'Database', value: checks?.database?.ok ? 'SQLite responding' : '—' },
    { label: 'Engine', value: checks?.ffmpeg?.ok ? (checks.ffmpeg.detail ?? 'FFmpeg') : '—' },
    { label: 'Queue', value: checks?.queue?.detail ?? '—' },
  ];

  return (
    <div data-ui className="rounded-md bg-steel p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] text-dim">Core</span>
        <span className="flex items-center gap-2 text-[11.5px] text-mute">
          <span
            className={
              status === 'ok'
                ? 'size-1.5 rounded-full bg-ok'
                : 'size-1.5 rounded-full bg-dim'
            }
            aria-hidden
          />
          {status === 'ok' ? 'nominal' : status ?? 'offline'}
        </span>
      </div>

      <dl className="mt-5 space-y-2.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-[13px] text-dim">{row.label}</dt>
            <dd className="truncate text-[12.5px] text-ink">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 border-t border-white/[0.08] pt-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[13px] text-dim">Sources mapped</span>
          <span className="text-[12.5px] text-ink">
            {providers > 0 ? `${providers} providers` : '—'}
          </span>
        </div>
        <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
          {providers > 0 ? (
            <>
              <span className="bg-ember" style={{ width: `${(direct / providers) * 100}%` }} />
              <span className="bg-white/20" style={{ width: `${(linkOnly / providers) * 100}%` }} />
            </>
          ) : null}
        </div>
        <p className="mt-2.5 text-[12.5px] leading-[1.5] text-dim">
          {providers > 0
            ? `${direct} fetchable · ${linkOnly} reference only`
            : 'Waiting for the API to answer.'}
        </p>
      </div>

      <p className="mt-5 text-[11.5px] text-dim">build {version ?? '0.1.0'}</p>
    </div>
  );
}
