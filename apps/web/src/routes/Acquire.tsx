import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, MinusCircle, ShieldAlert } from 'lucide-react';
import { useConnectProvider, useJobs, useProviders } from '../lib/queries';
import { ImportPanel } from '../components/ImportPanel';
import { JobList } from '../components/JobList';
import {
  Badge,
  Button,
  Label,
  Modal,
  Panel,
  SectionHeading,
  Select,
  Skeleton,
  StatusBadge,
  cn,
  useToast,
} from '../design-system/ui';
import { ApiError } from '../lib/api';

const CAPABILITY_LABEL = {
  'official-api': { label: 'official API', tone: 'plasma' as const },
  'link-only': { label: 'link only', tone: 'neutral' as const },
  none: { label: 'not offered', tone: 'neutral' as const },
};

export default function Acquire() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('');
  const jobs = useJobs({ limit: 20, status: status || undefined });
  const providers = useProviders();
  const connect = useConnectProvider();
  const { notify } = useToast();
  const [details, setDetails] = useState<string | null>(null);

  const tab = params.get('tab') === 'url' ? 'url' : 'upload';
  const selectedProvider = providers.data?.items.find((provider) => provider.id === details);

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Bring it in, with limits you can see."
        description="Uploads stream to local scratch storage. URL acquisition passes an SSRF guard, pins DNS per hop, caps bytes and time, and verifies the hash before an asset exists."
        action={<Badge tone="info">{providers.data?.items.length ?? '—'} providers mapped</Badge>}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        <ImportPanel defaultTab={tab} />

        <Panel className="flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <Label>Acquisition queue</Label>
            <Select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filter jobs by status"
              className="h-8 w-[150px] text-[12px]"
            >
              <option value="">All states</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>
          <div className="max-h-[560px] overflow-y-auto px-3 py-2">
            {jobs.isPending ? (
              <div className="space-y-2 p-1">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <JobList
                jobs={jobs.data?.items ?? []}
                emptyHint="Nothing has been acquired yet. Every transfer, probe and transform is tracked here."
              />
            )}
          </div>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline px-4 py-3">
          <div>
            <Label>Provider capability matrix</Label>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-mute">
              Researched from official developer documentation on 2026-10-30. Connections require
              operator credentials plus a completed OAuth handshake — SonicWire never fabricates a
              connected account.
            </p>
          </div>
          <Badge tone="warn">scraping refused by design</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse text-left">
            <thead>
              <tr className="bg-black/25">
                {[
                  'Provider',
                  'Auth',
                  'Ingest',
                  'Metadata',
                  'Search',
                  'Publish',
                  'Connection',
                ].map((heading) => (
                  <th key={heading} className="sw-label px-4 py-2.5 font-normal">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(providers.data?.items ?? []).map((provider) => (
                <tr key={provider.id} className="border-t border-hairline align-middle">
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setDetails(provider.id)}
                      className="text-left text-[12.5px] font-medium text-ink hover:text-ember"
                    >
                      {provider.name}
                    </button>
                    <div className="text-[11.5px] text-dim">
                      {provider.category}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[11.5px] text-mute">{provider.auth}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={provider.ingestion === 'direct-media' ? 'ok' : 'warn'}>
                      {provider.ingestion === 'direct-media' ? 'direct media' : 'link only'}
                    </Badge>
                  </td>
                  {(['metadata', 'search', 'publish'] as const).map((capability) => {
                    const value = provider.capabilities[capability];
                    const meta = CAPABILITY_LABEL[value];
                    return (
                      <td key={capability} className="px-4 py-2.5">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                    );
                  })}
                  <td className="px-4 py-2.5">
                    {provider.connectionStatus === 'not_configured' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          connect.mutate(provider.id, {
                            onSuccess: () => notify({ tone: 'ok', title: 'Connection requested' }),
                            onError: (error) =>
                              notify({
                                tone: 'info',
                                title: `${provider.name} is not connectable yet`,
                                body:
                                  error instanceof ApiError
                                    ? error.message
                                    : 'Operator credentials are required.',
                              }),
                          })
                        }
                      >
                        Connect
                      </Button>
                    ) : (
                      <StatusBadge status={provider.connectionStatus} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {providers.isError ? (
          <p className="px-4 py-4 text-[12px] text-warn">
            The provider catalogue could not be loaded. Retry after the core is reachable.
          </p>
        ) : null}
      </Panel>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: ShieldAlert,
            title: 'SSRF defence',
            body: 'Loopback, private, link-local, CGNAT and cloud-metadata addresses are refused before a socket opens. Redirects revalidate at every hop.',
          },
          {
            icon: MinusCircle,
            title: 'Refused by policy',
            body: 'YouTube, Instagram, TikTok, X and similar providers have no download API. SonicWire says so instead of scraping or implying support.',
          },
          {
            icon: CheckCircle2,
            title: 'Authorized sources',
            body: 'Direct media URLs, Internet Archive downloads, Wikimedia Commons files and podcast enclosures are fetched with hash verification.',
          },
        ].map((item) => (
          <Panel key={item.title} className="p-4">
            <item.icon className="size-4 text-ember" aria-hidden />
            <h3 className="mt-2.5 text-[13px] font-semibold text-ink">{item.title}</h3>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-mute">{item.body}</p>
          </Panel>
        ))}
      </div>

      <Modal
        open={Boolean(selectedProvider)}
        onClose={() => setDetails(null)}
        title={selectedProvider?.name ?? 'Provider'}
        description="What the official API permits, and what it does not."
        width="lg"
        footer={
          <Button variant="outline" onClick={() => setDetails(null)}>
            Close
          </Button>
        }
      >
        {selectedProvider ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={selectedProvider.ingestion === 'direct-media' ? 'ok' : 'warn'}>
                {selectedProvider.ingestion === 'direct-media'
                  ? 'media bytes may be fetched'
                  : 'reference only — bytes never fetched'}
              </Badge>
              <span className="text-[11.5px] text-mute">
                {selectedProvider.ingestion === 'direct-media'
                  ? 'SonicWire downloads into quarantine, verifies the hash, then promotes to the library.'
                  : 'SonicWire stores the link, title and metadata you supply. Downloading is refused with the provider restriction named.'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(['metadata', 'search', 'publish', 'analytics', 'scheduling'] as const).map((capability) => (
                <div key={capability} className="rounded-[4px] border border-hairline bg-black/25 p-2.5">
                  <div className="sw-label mb-1.5">{capability}</div>
                  <span
                    className={cn(
                      'text-[11.5px]',
                      selectedProvider.capabilities[capability] === 'official-api'
                        ? 'text-plasma'
                        : 'text-dim',
                    )}
                  >
                    {selectedProvider.capabilities[capability].replace('-', ' ')}
                  </span>
                </div>
              ))}
            </div>
            <div>
              <Label>Restrictions</Label>
              <ul className="mt-2 space-y-2">
                {selectedProvider.restrictions.map((restriction) => (
                  <li key={restriction} className="flex items-start gap-2 text-[12px] leading-relaxed text-mute">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0 text-warn" aria-hidden />
                    {restriction}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-dim">
              <span>
                Documentation:{' '}
                <a
                  href={selectedProvider.docsUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-signal hover:text-plasma"
                >
                  {new URL(selectedProvider.docsUrl).hostname}
                </a>
              </span>
              <span>Reviewed {selectedProvider.lastChecked}</span>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
