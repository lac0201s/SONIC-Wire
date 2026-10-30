import { useEffect, useRef, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import type { AssetQuery, AssetSummary, CreateWorkflowInput, PaginatedAssets, TransformRequest } from '@sonicwire/contracts';
import { api, onUnauthorized, setCsrfToken, uploadFile, type UploadProgress } from './api';

export const keys = {
  session: ['session'] as const,
  assets: (query: Partial<AssetQuery>) => ['assets', query] as const,
  asset: (id: string) => ['asset', id] as const,
  derivatives: (id: string) => ['derivatives', id] as const,
  waveform: (id: string) => ['waveform', id] as const,
  jobs: (query: Record<string, unknown>) => ['jobs', query] as const,
  collections: ['collections'] as const,
  tags: ['tags'] as const,
  workflows: ['workflows'] as const,
  workflowRuns: (id: string) => ['workflow-runs', id] as const,
  providers: ['providers'] as const,
  observatory: ['observatory'] as const,
  audit: ['audit'] as const,
  capabilities: ['capabilities'] as const,
  settings: ['settings'] as const,
};

export function useSession() {
  return useQuery({
    queryKey: keys.session,
    queryFn: async () => {
      const session = await api.session();
      setCsrfToken(session.csrfToken);
      return session;
    },
    staleTime: 30_000,
    retry: false,
  });
}

export function useSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.setup,
    onSuccess: (session) => {
      setCsrfToken(session.csrfToken);
      queryClient.setQueryData(keys.session, session);
      void queryClient.invalidateQueries();
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.login,
    onSuccess: (session) => {
      setCsrfToken(session.csrfToken);
      queryClient.setQueryData(keys.session, session);
      void queryClient.invalidateQueries();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      setCsrfToken(null);
      queryClient.clear();
      queryClient.setQueryData(keys.session, {
        needsSetup: false,
        user: null,
        workspace: null,
        csrfToken: null,
        capabilities: [],
      });
    },
  });
}

export function useAssets(query: Partial<AssetQuery>) {
  return useInfiniteQuery<PaginatedAssets, Error, InfiniteData<PaginatedAssets>, readonly unknown[], string | null>({
    queryKey: keys.assets(query),
    initialPageParam: null,
    queryFn: ({ pageParam, signal }) =>
      api.assets({ ...query, cursor: pageParam ?? undefined, limit: query.limit ?? 36 }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
    placeholderData: (previous) => previous,
  });
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: keys.asset(id),
    queryFn: ({ signal }) => api.asset(id, signal),
    enabled: Boolean(id),
  });
}

export function useWaveform(id: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.waveform(id),
    queryFn: ({ signal }) => api.waveform(id, signal),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}

export function useDerivatives(id: string) {
  return useQuery({
    queryKey: keys.derivatives(id),
    queryFn: () => api.derivatives(id),
    enabled: Boolean(id),
  });
}

export function useJobs(query: { status?: string; kind?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: keys.jobs(query),
    queryFn: () => api.jobs(query),
    refetchInterval: 8000,
  });
}

export function useCollections() {
  return useQuery({ queryKey: keys.collections, queryFn: api.collections });
}

export function useTags() {
  return useQuery({ queryKey: keys.tags, queryFn: api.tags });
}

export function useWorkflows() {
  return useQuery({ queryKey: keys.workflows, queryFn: api.workflows });
}

export function useProviders() {
  return useQuery({ queryKey: keys.providers, queryFn: api.providers, staleTime: 60_000 });
}

export function useObservatory() {
  return useQuery({
    queryKey: keys.observatory,
    queryFn: api.observatory,
    refetchInterval: 10_000,
  });
}

export function useAudit() {
  return useQuery({ queryKey: keys.audit, queryFn: api.audit, refetchInterval: 20_000 });
}

export function useCapabilities() {
  return useQuery({ queryKey: keys.capabilities, queryFn: api.capabilities, staleTime: 60_000 });
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: api.settings });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createCollection,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.collections });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteCollection,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.collections });
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: { title?: string; tags?: string[]; collectionIds?: string[] } }) =>
      api.updateAsset(id, body),
    onSuccess: (asset) => {
      queryClient.setQueryData(keys.asset(asset.id), asset);
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      void queryClient.invalidateQueries({ queryKey: keys.tags });
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAsset,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
  });
}

export function useTransform() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TransformRequest }) => api.transform(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useReprobe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.reprobe,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.cancelJob,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useIngestUrl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.ingestUrl,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useExportAssets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.exportAssets,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpload() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const mutation = useMutation({
    mutationFn: async ({
      file,
      fields,
      onProgress,
    }: {
      file: File;
      fields: Record<string, string>;
      onProgress?: (progress: UploadProgress) => void;
    }) =>
      uploadFile(file, fields, {
        onProgress: (value) => {
          setProgress(value);
          onProgress?.(value);
        },
      }),
    onSettled: () => {
      setProgress(null);
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
      void queryClient.invalidateQueries({ queryKey: keys.observatory });
    },
  });
  return { ...mutation, progress };
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateWorkflowInput) => api.createWorkflow(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.workflows });
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteWorkflow,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.workflows });
    },
  });
}

export function useRunWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, assetId }: { id: string; assetId: string }) => api.runWorkflow(id, assetId),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: keys.workflowRuns(variables.id) });
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useWorkflowRuns(id: string | null) {
  return useQuery({
    queryKey: keys.workflowRuns(id ?? 'none'),
    queryFn: () => api.workflowRuns(id!),
    enabled: Boolean(id),
    refetchInterval: 5000,
  });
}

export function useConnectProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.connectProvider,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.providers });
    },
  });
}

export function useRenameWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.renameWorkspace,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.settings });
      void queryClient.invalidateQueries({ queryKey: keys.session });
    },
  });
}

export function usePurgeWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.purgeWorkspace,
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: api.changePassword });
}

export function useUnauthorizedRedirect(handler: () => void) {
  useEffect(() => onUnauthorized(handler), [handler]);
}

/**
 * Live connection to the server's event stream. Reconnection is native to
 * EventSource; on every (re)connect the cached queries are refetched so the UI
 * resynchronises instead of relying on replayed events.
 */
export function useRealtime(enabled: boolean): { connected: boolean; lastEventAt: number | null } {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let source: EventSource | null = null;
    let closed = false;

    const scheduleRefresh = (): void => {
      if (pending.current) return;
      pending.current = setTimeout(() => {
        pending.current = null;
        void queryClient.invalidateQueries({ queryKey: ['jobs'] });
        void queryClient.invalidateQueries({ queryKey: ['assets'] });
      }, 400);
    };

    const connect = (): void => {
      if (closed) return;
      source = new EventSource('/api/events', { withCredentials: true });
      source.onopen = () => setConnected(true);
      source.onerror = () => setConnected(false);
      source.onmessage = (event) => {
        setLastEventAt(Date.now());
        try {
          const payload = JSON.parse(event.data) as { type: string; assetId?: string };
          if (payload.type === 'asset.updated' && payload.assetId) {
            void queryClient.invalidateQueries({ queryKey: keys.asset(payload.assetId) });
            void queryClient.invalidateQueries({ queryKey: keys.derivatives(payload.assetId) });
          }
          if (payload.type === 'job.updated' || payload.type === 'job.event' || payload.type === 'asset.updated') {
            scheduleRefresh();
          }
        } catch {
          /* ignore malformed frame */
        }
      };
    };

    connect();
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible' && source?.readyState === EventSource.CLOSED) {
        connect();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      closed = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
      source?.close();
      setConnected(false);
    };
  }, [enabled, queryClient]);

  return { connected, lastEventAt };
}

export type { AssetSummary };

/** Stored measurements for one asset. Polls only while an analysis job is live. */
export function useAnalysis(assetId: string, options: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: ['analysis', assetId],
    queryFn: ({ signal }) => api.analysis(assetId, signal),
    enabled: assetId.length > 0,
    refetchInterval: options.poll ? 2000 : false,
  });
}

export function useAnalyzeAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, includePeaks }: { id: string; includePeaks: boolean }) =>
      api.analyzeAsset(id, { includePeaks }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
