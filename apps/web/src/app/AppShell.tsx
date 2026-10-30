import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Boxes,
  Compass,
  Gauge,
  LibraryBig,
  Import,
  LayoutDashboard,
  LogOut,
  Search,
  Settings2,
  SlidersHorizontal,
  Workflow as WorkflowIcon,
} from 'lucide-react';
import { useLogout, useRealtime, useSession } from '../lib/queries';
import { Mark, Wordmark } from '../design-system/Brand';
import { Button, IconButton, Kbd, cn, useToast } from '../design-system/ui';
import { CommandPalette } from './CommandPalette';

const NAV = [
  { to: '/app', label: 'Command', icon: LayoutDashboard, end: true },
  { to: '/app/library', label: 'Universe', icon: LibraryBig },
  { to: '/app/acquire', label: 'Acquire', icon: Import },
  { to: '/app/studio', label: 'Studio', icon: SlidersHorizontal },
  { to: '/app/workflows', label: 'Workflows', icon: WorkflowIcon },
  { to: '/app/observatory', label: 'Observatory', icon: Activity },
  { to: '/app/settings', label: 'Settings', icon: Settings2 },
] as const;

const MOBILE_NAV = [
  { to: '/app', label: 'Command', icon: LayoutDashboard, end: true },
  { to: '/app/library', label: 'Library', icon: LibraryBig },
  { to: '/app/acquire', label: 'Acquire', icon: Import },
  { to: '/app/observatory', label: 'Observe', icon: Gauge },
] as const;

const TITLES: Record<string, string> = {
  '/app': 'Command',
  '/app/library': 'Media Universe',
  '/app/acquire': 'Acquisition',
  '/app/studio': 'Transformation Studio',
  '/app/workflows': 'Workflow Intelligence',
  '/app/observatory': 'Observatory',
  '/app/settings': 'Settings',
};

export function AppShell() {
  const session = useSession();
  const logout = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const { connected } = useRealtime(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { notify } = useToast();

  const workspaceName = session.data?.workspace?.name ?? 'Workspace';
  const user = session.data?.user;

  const title = useMemo(() => {
    if (location.pathname.startsWith('/app/assets/')) return 'Asset inspector';
    return TITLES[location.pathname] ?? 'SonicWire';
  }, [location.pathname]);

  const go = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  useEffect(() => {
    let awaitingG = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;

      if (awaitingG) {
        awaitingG = false;
        const map: Record<string, string> = {
          c: '/app',
          l: '/app/library',
          a: '/app/acquire',
          s: '/app/studio',
          w: '/app/workflows',
          o: '/app/observatory',
          g: '/app/settings',
        };
        const destination = map[event.key.toLowerCase()];
        if (destination) {
          event.preventDefault();
          go(destination);
        }
        return;
      }
      if (event.key.toLowerCase() === 'g') {
        awaitingG = true;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          awaitingG = false;
        }, 1200);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (timer) clearTimeout(timer);
    };
  }, [go]);

  return (
    <div className="min-h-dvh bg-obsidian">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded focus:bg-ember focus:px-3 focus:py-2 focus:text-[13px] focus:font-medium focus:text-black"
      >
        Skip to content
      </a>
      <div className="mx-auto flex w-full max-w-[1800px]">
        {/* Desktop rail */}
        <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 flex-col border-r border-hairline bg-graphite/70 px-3 py-4 lg:flex">
          <NavLink to="/" className="mb-6 flex items-center gap-2.5 px-2 py-1">
            <Mark className="text-ember" />
            <Wordmark />
          </NavLink>

          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="sw-label">Workspace</div>
              <div className="truncate text-[12.5px] font-medium text-ink">{workspaceName}</div>
            </div>
            <span
              className={cn('size-1.5 shrink-0 rounded-full', connected ? 'bg-ok sw-live-dot' : 'bg-warn')}
              title={connected ? 'Live event stream connected' : 'Live stream reconnecting'}
            />
          </div>

          <nav aria-label="Primary" className="flex-1 space-y-0.5">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={'end' in item ? item.end : false}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-3 rounded-[5px] px-2.5 py-2 text-[13px] transition-colors',
                    isActive
                      ? 'bg-white/[0.055] text-ink'
                      : 'text-mute hover:bg-white/[0.03] hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn('size-[15px] shrink-0', isActive ? 'text-mute' : 'text-dim group-hover:text-mute')}
                      aria-hidden
                    />
                    <span className="flex-1">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-4 space-y-2 border-t border-hairline pt-3">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex w-full items-center justify-between rounded-[5px] border border-hairline bg-black/25 px-2.5 py-2 text-[12px] text-mute transition-colors hover:border-hairline-strong hover:text-ink"
            >
              <span className="flex items-center gap-2">
                <Search className="size-3.5" aria-hidden /> Search / jump
              </span>
              <Kbd>⌘K</Kbd>
            </button>
            {user ? (
              <div className="flex items-center justify-between gap-2 px-1 py-1">
                <div className="min-w-0">
                  <div className="truncate text-[12px] text-ink">{user.displayName}</div>
                  <div className="truncate text-[11.5px] text-dim">{user.email}</div>
                </div>
                <IconButton
                  label="Sign out"
                  onClick={() => {
                    logout.mutate(undefined, {
                      onSuccess: () => notify({ tone: 'info', title: 'Signed out' }),
                    });
                    go('/login');
                  }}
                >
                  <LogOut className="size-3.5" aria-hidden />
                </IconButton>
              </div>
            ) : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-hairline bg-obsidian">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <NavLink to="/app" className="lg:hidden" aria-label="SonicWire home">
                  <Mark className="text-ember" />
                </NavLink>
                <div className="min-w-0">
                  <div className="sw-label truncate">{workspaceName}</div>
                  <h1 className="truncate text-[15px] font-semibold tracking-[-0.02em] text-ink sm:text-[17px]">
                    {title}
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-2 sm:flex">
                  <span
                    className={cn('size-1 rounded-full', connected ? 'bg-ok sw-live-dot' : 'bg-warn')}
                    aria-hidden
                  />
                  <span className="sw-label">{connected ? 'Live' : 'Reconnecting'}</span>
                </span>
                <IconButton label="Open command palette" onClick={() => setPaletteOpen(true)}>
                  <Compass className="size-4" aria-hidden />
                </IconButton>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => go('/app/acquire')}
                  className="hidden sm:inline-flex"
                >
                  <Import className="size-3.5" aria-hidden /> Ingest
                </Button>
              </div>
            </div>
          </header>

          <main id="main" className="min-w-0 flex-1 px-4 pt-6 pb-28 sm:px-6 lg:pb-12">
            <Outlet />
          </main>

          <footer className="hidden border-t border-hairline px-6 py-3 lg:block">
            <div className="flex items-center justify-between text-[11px] text-dim">
              <span className="">
                SonicWire · local-first core · capability-honest build
              </span>
              <NavLink to="/" className="hover:text-mute">
                Public site
              </NavLink>
            </div>
          </footer>
        </div>
      </div>

      {/* Mobile navigation */}
      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-hairline bg-graphite pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[10px]',
                  isActive ? 'text-ember' : 'text-dim',
                )
              }
            >
              <item.icon className="size-4" aria-hidden />
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex flex-col items-center gap-1 py-2.5 text-[10px] text-dim"
          >
            <Boxes className="size-4" aria-hidden />
            More
          </button>
        </div>
      </nav>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
