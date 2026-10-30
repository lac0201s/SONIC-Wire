import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Download,
  KeyRound,
  Link2,
  ShieldCheck,
  TriangleAlert,
  Trash2,
} from 'lucide-react';
import {
  useCapabilities,
  useChangePassword,
  useLogout,
  useProviders,
  usePurgeWorkspace,
  useRenameWorkspace,
  useSession,
  useSettings,
} from '../lib/queries';
import {
  Badge,
  Button,
  DataRow,
  Field,
  Input,
  Label,
  Modal,
  Panel,
  SectionHeading,
  StatusBadge,
  cn,
  useToast,
} from '../design-system/ui';
import { ApiError } from '../lib/api';
import { formatBytes } from '../lib/format';

export default function Settings() {
  const session = useSession();
  const settings = useSettings();
  const capabilities = useCapabilities();
  const providers = useProviders();
  const rename = useRenameWorkspace();
  const changePassword = useChangePassword();
  const purge = usePurgeWorkspace();
  const logout = useLogout();
  const { notify } = useToast();

  const [workspaceName, setWorkspaceName] = useState(settings.data?.workspace.name ?? '');
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState('');

  const isOwner = session.data?.workspace?.role === 'owner';

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Configuration, credentials and data custody."
        description="This deployment is local-first: the database and media live on this machine's disk. Nothing is sent to a SonicWire service because none exists."
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <Label>Account</Label>
            <Badge tone="neutral">{session.data?.workspace?.role ?? 'member'}</Badge>
          </div>
          <dl className="mt-2">
            <DataRow label="Name" value={settings.data?.user.displayName ?? '—'} numeric={false} />
            <DataRow label="Email" value={settings.data?.user.email ?? '—'} numeric={false} />
            <DataRow label="Workspace" value={settings.data?.workspace.name ?? '—'} numeric={false} />
          </dl>

          <div className="sw-hairline my-4" />
          <Label>Change password</Label>
          <div className="mt-3 space-y-3">
            <Field label="Current password" htmlFor="current-password">
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={passwords.current}
                onChange={(event) => setPasswords({ ...passwords, current: event.target.value })}
              />
            </Field>
            <Field label="New password" htmlFor="new-password" hint="At least 10 characters. Other sessions are revoked.">
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={passwords.next}
                onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
              />
            </Field>
            <Button
              variant="outline"
              loading={changePassword.isPending}
              disabled={!passwords.current || passwords.next.length < 10}
              onClick={() =>
                changePassword.mutate(
                  { currentPassword: passwords.current, newPassword: passwords.next },
                  {
                    onSuccess: () => {
                      setPasswords({ current: '', next: '' });
                      notify({ tone: 'ok', title: 'Password updated', body: 'Other sessions were signed out.' });
                    },
                    onError: (error) =>
                      notify({
                        tone: 'danger',
                        title: 'Password not changed',
                        body: error instanceof ApiError ? error.message : 'Unknown error',
                      }),
                  },
                )
              }
            >
              <KeyRound className="size-3.5" aria-hidden /> Update password
            </Button>
          </div>
        </Panel>

        <Panel className="p-5">
          <Label>Workspace</Label>
          <div className="mt-3 flex gap-2">
            <Input
              value={workspaceName || (settings.data?.workspace.name ?? '')}
              onChange={(event) => setWorkspaceName(event.target.value)}
              aria-label="Workspace name"
              disabled={!isOwner}
            />
            <Button
              variant="quiet"
              loading={rename.isPending}
              disabled={!isOwner || !workspaceName.trim()}
              onClick={() =>
                rename.mutate(workspaceName.trim(), {
                  onSuccess: () => notify({ tone: 'ok', title: 'Workspace renamed' }),
                  onError: (error) =>
                    notify({
                      tone: 'danger',
                      title: 'Rename failed',
                      body: error instanceof ApiError ? error.message : 'Unknown error',
                    }),
                })
              }
            >
              Save
            </Button>
          </div>
          <p className="mt-2 text-[11.5px] text-dim">
            {isOwner ? 'Only the owner can rename the workspace.' : 'Viewer/editor roles cannot rename the workspace.'}
          </p>

          <div className="sw-hairline my-4" />
          <Label>Storage & limits</Label>
          <dl className="mt-2">
            <DataRow label="Data directory" value={<span className="text-[10.5px] break-all">{settings.data?.storage.dataDir ?? '—'}</span>} />
            <DataRow label="Media root" value={<span className="text-[10.5px] break-all">{settings.data?.storage.mediaRoot ?? '—'}</span>} />
            <DataRow label="Disk free" value={formatBytes(settings.data?.storage.diskFreeBytes ?? null)} />
            <DataRow label="Upload cap" value={formatBytes(capabilities.data?.limits.maxUploadBytes ?? 0)} />
            <DataRow label="Download cap" value={formatBytes(capabilities.data?.limits.maxDownloadBytes ?? 0)} />
            <DataRow label="Download timeout" value={`${capabilities.data?.limits.maxDownloadSeconds ?? '—'} s`} />
            <DataRow label="Job workers" value={capabilities.data?.limits.jobWorkers ?? '—'} />
            <DataRow label="Session TTL" value={`${capabilities.data?.limits.sessionTtlHours ?? '—'} h`} />
          </dl>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <Label>Connected accounts</Label>
            <Link2 className="size-3.5 text-dim" aria-hidden />
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-mute">
            No provider is connected. Connections require operator credentials in the environment
            and a completed OAuth handshake; SonicWire never invents one.
          </p>
          <ul className="mt-3 space-y-2">
            {(providers.data?.items ?? []).slice(0, 6).map((provider) => (
              <li
                key={provider.id}
                className="flex items-center justify-between gap-3 rounded-[5px] border border-hairline bg-black/20 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] text-ink">{provider.name}</div>
                  <div className="text-[11.5px] text-dim">{provider.auth}</div>
                </div>
                <StatusBadge
                  status={provider.connectionStatus === 'not_configured' ? 'waiting_approval' : provider.connectionStatus}
                />
              </li>
            ))}
          </ul>
          <Link to="/app/acquire" className="mt-3 inline-block text-[11.5px] text-signal hover:text-plasma">
            open capability matrix →
          </Link>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <Label>Privacy & data custody</Label>
            <ShieldCheck className="size-3.5 text-ok" aria-hidden />
          </div>
          <ul className="mt-3 space-y-2.5">
            {[
              ['Telemetry', 'No analytics, no fingerprinting, no outbound beacons.'],
              ['Outbound network', 'Only URLs you submit are contacted, after SSRF validation.'],
              ['Storage', 'Media, metadata and audit events stay on this machine.'],
              ['Secrets', 'Credentials live in the local database; scrypt hashes only for passwords.'],
            ].map(([title, body]) => (
              <li key={title} className="text-[12px] leading-relaxed">
                <span className="text-[11.5px] text-mute">{title}</span>
                <p className="mt-0.5 text-mute">{body}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                window.location.href = '/api/settings/export-metadata';
              }}
            >
              <Download className="size-3.5" aria-hidden /> Export library metadata
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                logout.mutate();
              }}
            >
              Sign out
            </Button>
          </div>
        </Panel>
      </div>

      <Panel className="border-danger/25 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Label className={cn('text-danger')}>Danger zone</Label>
            <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-mute">
              Purge deletes every asset, derivative, collection, tag, workflow and job in this
              workspace, including the stored files. The account itself remains. This is
              irreversible and requires typing the workspace name.
            </p>
          </div>
          <Button variant="danger" onClick={() => setPurgeOpen(true)} disabled={!isOwner}>
            <Trash2 className="size-3.5" aria-hidden /> Purge workspace content
          </Button>
        </div>
        {!isOwner ? (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-warn">
            <AlertTriangle className="size-3" aria-hidden /> Only the owner can purge content.
          </p>
        ) : null}
      </Panel>

      <Modal
        open={purgeOpen}
        onClose={() => {
          setPurgeOpen(false);
          setPurgeConfirm('');
        }}
        title="Purge workspace content"
        description={`Type “${settings.data?.workspace.name ?? ''}” to confirm. Files are removed from disk; there is no undo.`}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setPurgeOpen(false);
                setPurgeConfirm('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={purge.isPending}
              disabled={purgeConfirm !== (settings.data?.workspace.name ?? '')}
              onClick={() =>
                purge.mutate(purgeConfirm, {
                  onSuccess: (result) => {
                    setPurgeOpen(false);
                    setPurgeConfirm('');
                    notify({
                      tone: 'ok',
                      title: 'Workspace content purged',
                      body: `${result.removedAssets} asset records and their files were deleted.`,
                    });
                  },
                  onError: (error) =>
                    notify({
                      tone: 'danger',
                      title: 'Purge aborted',
                      body: error instanceof ApiError ? error.message : 'Unknown error',
                    }),
                })
              }
            >
              Purge permanently
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-[5px] border border-danger/30 bg-danger/[0.06] px-3 py-2.5 text-[12px] leading-relaxed text-danger">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Audit events and your account survive this operation. Media files do not.
          </div>
          <Field label="Workspace name" htmlFor="purge-confirm">
            <Input
              id="purge-confirm"
              value={purgeConfirm}
              onChange={(event) => setPurgeConfirm(event.target.value)}
              placeholder={settings.data?.workspace.name ?? ''}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
