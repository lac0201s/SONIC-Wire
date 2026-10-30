import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Landing from '../routes/Landing';
import Login from '../routes/Login';
import NotFound from '../routes/NotFound';

/**
 * Route smoke tests. They render real routes against a stubbed fetch so a
 * runtime regression (bad hook order, missing provider, unguarded optional
 * field) fails here instead of in the browser.
 */
const payloads: Record<string, unknown> = {
  '/api/health': {
    status: 'ok',
    version: '0.1.0',
    uptimeSeconds: 12,
    checks: {
      database: { ok: true, detail: 'SQLite responding' },
      ffmpeg: { ok: true, detail: '6.1 (bundled)' },
      queue: { ok: true, detail: '0 active of 2 workers' },
    },
  },
  '/api/auth/session': { needsSetup: false, user: null, workspace: null, csrfToken: null, capabilities: [] },
  '/api/providers': {
    items: [
      {
        id: 'internet-archive',
        name: 'Internet Archive',
        category: 'archive',
        auth: 'none',
        capabilities: {
          metadata: 'official-api',
          search: 'official-api',
          publish: 'official-api',
          analytics: 'none',
          scheduling: 'none',
        },
        ingestion: 'direct-media',
        restrictions: [],
        connectionStatus: 'available',
        docsUrl: 'https://archive.org/developers/',
        lastChecked: '2026-10-30',
      },
      {
        id: 'youtube',
        name: 'YouTube',
        category: 'video',
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
        ],
        connectionStatus: 'not_configured',
        docsUrl: 'https://developers.google.com/youtube/v3/docs',
        lastChecked: '2026-10-30',
      },
    ],
  },
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
      const path = url.split('?')[0] ?? url;
      const body = payloads[path];
      if (body === undefined) {
        return new Response(
          JSON.stringify({ error: { code: 'not_found', message: `no stub for ${path}` } }),
          { status: 404, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderRoute(node: React.ReactElement, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('marketing surface', () => {
  it('renders the hero and a live core fragment wired to the API', async () => {
    renderRoute(<Landing />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
      'Every signal measured',
    );
    // The fragment is real data: /api/health and /api/providers, never a mock.
    await waitFor(() => expect(screen.getByText(/SQLite responding/)).toBeTruthy());
    expect(screen.getByText(/6\.1 \(bundled\)/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText('YouTube')).toBeTruthy());
    expect(screen.getByText('Reference only')).toBeTruthy();
    expect(screen.getByText('Fetch allowed')).toBeTruthy();
  });

  it('states the refusal policy with the provider wording', async () => {
    renderRoute(<Landing />);
    await waitFor(() => expect(screen.getByText(/1 of 2 sources cannot be downloaded/)).toBeTruthy());
    expect(screen.getByText(/violates the YouTube Terms of Service/)).toBeTruthy();
  });

  it('links into the console without a fake sign-up path', () => {
    renderRoute(<Landing />);
    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    // Signed-out visitors are routed to sign-in; there is no self-service
    // registration because the instance has exactly one owner.
    expect(links).toContain('/login');
    expect(links.some((href) => href?.includes('signup'))).toBe(false);
  });
});

describe('auth surface', () => {
  it('renders labelled credential fields', () => {
    renderRoute(<Login />, '/login');
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password').getAttribute('type')).toBe('password');
    expect(screen.getByRole('button', { name: /enter console/i }).getAttribute('type')).toBe(
      'submit',
    );
  });
});

describe('fallback', () => {
  it('explains the 404 and offers a way back', () => {
    renderRoute(<NotFound />, '/nope');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('not wired');
    expect(screen.getAllByRole('link').length).toBe(2);
  });
});
