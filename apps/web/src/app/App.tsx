import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSession } from '../lib/queries';
import { Mark } from '../design-system/Brand';
import { Button, Spinner } from '../design-system/ui';
import { AppShell } from './AppShell';

const Landing = lazy(() => import('../routes/Landing'));
const Setup = lazy(() => import('../routes/Setup'));
const Login = lazy(() => import('../routes/Login'));
const Command = lazy(() => import('../routes/Command'));
const Library = lazy(() => import('../routes/Library'));
const AssetDetail = lazy(() => import('../routes/AssetDetail'));
const Acquire = lazy(() => import('../routes/Acquire'));
const Studio = lazy(() => import('../routes/Studio'));
const Workflows = lazy(() => import('../routes/Workflows'));
const Observatory = lazy(() => import('../routes/Observatory'));
const Settings = lazy(() => import('../routes/Settings'));
const NotFound = lazy(() => import('../routes/NotFound'));

function BootScreen({ label }: { label: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-obsidian">
      <div className="flex items-center gap-3 text-ink">
        <Mark />
        <span className="font-display text-[20px] font-semibold tracking-[-0.04em]">
          Sonic<span className="text-ember">Wire</span>
        </span>
      </div>
      <div className="flex items-center gap-2 text-dim">
        <Spinner className="size-3.5" />
        <span className="sw-label">{label}</span>
      </div>
    </div>
  );
}

function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center gap-3 text-dim">
      <Spinner className="size-4" />
      <span className="sw-label">Loading surface</span>
    </div>
  );
}

export function App() {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) return <BootScreen label="Connecting to local core" />;

  if (session.isError || !session.data) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="sw-panel max-w-md px-6 py-8 text-center">
          <Mark className="mx-auto mb-4 text-ember" />
          <h1 className="text-[19px] font-semibold">The core did not answer</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-mute">
            SonicWire could not reach its API. Confirm the server is running, then retry.
          </p>
          <Button className="mt-5" variant="primary" onClick={() => void session.refetch()}>
            Retry connection
          </Button>
        </div>
      </div>
    );
  }

  const { needsSetup, user } = session.data;
  const authed = Boolean(user);

  if (needsSetup && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }
  if (!needsSetup && !authed && location.pathname.startsWith('/app')) {
    return <Navigate to="/login" replace />;
  }
  if (authed && (location.pathname === '/login' || location.pathname === '/setup')) {
    return <Navigate to="/app" replace />;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Command />} />
          <Route path="library" element={<Library />} />
          <Route path="assets/:assetId" element={<AssetDetail />} />
          <Route path="acquire" element={<Acquire />} />
          <Route path="studio" element={<Studio />} />
          <Route path="workflows" element={<Workflows />} />
          <Route path="observatory" element={<Observatory />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
