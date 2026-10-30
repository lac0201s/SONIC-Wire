import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Plus, Trash2, Workflow as WorkflowIcon } from 'lucide-react';
import type { Workflow } from '@sonicwire/contracts';
import {
  useCapabilities,
  useCollections,
  useCreateWorkflow,
  useDeleteWorkflow,
  useRunWorkflow,
  useWorkflowRuns,
  useWorkflows,
} from '../lib/queries';
import { AssetPicker } from '../components/AssetPicker';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  Label,
  Modal,
  Panel,
  SectionHeading,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
  cn,
  useToast,
} from '../design-system/ui';
import { formatRelative } from '../lib/format';
import { ApiError } from '../lib/api';

type StepType = 'probe' | 'thumbnail' | 'waveform' | 'transform' | 'tag' | 'collect' | 'export';

const STEP_META: Record<StepType, { label: string; hint: string }> = {
  probe: { label: 'Refresh metadata', hint: 'Re-probe the current asset' },
  thumbnail: { label: 'Rebuild thumbnail', hint: 'Extract a representative frame' },
  waveform: { label: 'Rebuild waveform', hint: 'Compute peaks from the audio stream' },
  transform: { label: 'Transform', hint: 'Run a preset; the derivative becomes the current asset' },
  tag: { label: 'Apply tags', hint: 'Merge metadata tags onto the current asset' },
  collect: { label: 'Add to collection', hint: 'File the current asset into a collection' },
  export: { label: 'Package bundle', hint: 'ZIP the current asset with a hash manifest' },
};

interface DraftStep {
  type: StepType;
  presetId?: string;
  tags?: string;
  collectionId?: string;
}

export default function Workflows() {
  const workflows = useWorkflows();
  const collections = useCollections();
  const capabilities = useCapabilities();
  const createWorkflow = useCreateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const runWorkflow = useRunWorkflow();
  const { notify } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [runTarget, setRunTarget] = useState<Workflow | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '', steps: [] as DraftStep[] });

  const selected = useMemo(
    () => workflows.data?.items.find((workflow) => workflow.id === selectedId) ?? null,
    [selectedId, workflows.data],
  );
  const runs = useWorkflowRuns(selected?.id ?? null);

  const addStep = (): void => {
    setDraft((current) => ({
      ...current,
      steps: [...current.steps, { type: 'probe' }],
    }));
  };

  const submitDraft = (): void => {
    if (!draft.name.trim() || draft.steps.length === 0) return;
    createWorkflow.mutate(
      {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        steps: draft.steps.map((step, index) => ({
          label: STEP_META[step.type].label,
          type: step.type,
          config:
            step.type === 'transform'
              ? { presetId: step.presetId ?? 'audio.mp3.192' }
              : step.type === 'tag'
                ? { tags: (step.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean) }
                : step.type === 'collect'
                  ? { collectionId: step.collectionId ?? '' }
                  : {},
          ...(index === 99 ? {} : {}),
        })),
      },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setDraft({ name: '', description: '', steps: [] });
          notify({ tone: 'ok', title: 'Workflow created' });
        },
        onError: (error) =>
          notify({
            tone: 'danger',
            title: 'Could not create workflow',
            body: error instanceof ApiError ? error.message : 'Unknown error',
          }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Repeatable media processes, typed and inspectable."
        description="Steps are validated before they run, progress is persisted after every transition, and a failed step stops the run with a reason instead of pretending success."
        action={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" aria-hidden /> New workflow
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          {workflows.isPending ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-48 w-full" />
              ))}
            </div>
          ) : (workflows.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon={<WorkflowIcon className="size-5" />}
              title="No workflows yet"
              description="Create a workflow to chain probing, transformation, tagging and packaging into one repeatable run."
              action={
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  Build the first workflow
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {workflows.data?.items.map((workflow) => (
                <Panel
                  key={workflow.id}
                  className={cn(
                    'flex flex-col p-4 transition-colors',
                    selectedId === workflow.id ? 'border-ember/50' : 'hover:border-hairline-strong',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedId(workflow.id)}
                      className="text-left"
                    >
                      <h3 className="text-[14.5px] font-semibold text-ink hover:text-ember">{workflow.name}</h3>
                      <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-mute">
                        {workflow.description ?? 'No description'}
                      </p>
                    </button>
                    <IconButton
                      label={`Delete ${workflow.name}`}
                      onClick={() =>
                        deleteWorkflow.mutate(workflow.id, {
                          onSuccess: () => {
                            if (selectedId === workflow.id) setSelectedId(null);
                            notify({ tone: 'ok', title: 'Workflow deleted' });
                          },
                        })
                      }
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </IconButton>
                  </div>

                  <ol className="mt-3 flex flex-wrap items-center gap-1.5">
                    {workflow.steps.map((step, index) => (
                      <li key={step.id} className="flex items-center gap-1.5">
                        <span className="rounded-[3px] border border-hairline bg-black/30 px-1.5 py-1 text-[11.5px] text-mute">
                          {step.type}
                        </span>
                        {index < workflow.steps.length - 1 ? (
                          <ArrowRight className="size-2.5 text-dim" aria-hidden />
                        ) : null}
                      </li>
                    ))}
                  </ol>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-hairline pt-3">
                    <span className="text-[11.5px] text-dim">
                      {workflow.runCount} run{workflow.runCount === 1 ? '' : 's'} · v{workflow.version}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => setRunTarget(workflow)}>
                      <Play className="size-3" aria-hidden /> Run
                    </Button>
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <Label>Run history</Label>
              {selected ? <Badge tone="neutral">{selected.name}</Badge> : null}
            </div>
            {!selected ? (
              <p className="mt-3 text-[12.5px] leading-relaxed text-mute">
                Select a workflow card to inspect its runs and per-step outcomes.
              </p>
            ) : runs.isPending ? (
              <Skeleton className="mt-3 h-24 w-full" />
            ) : (runs.data?.items.length ?? 0) === 0 ? (
              <p className="mt-3 text-[12.5px] leading-relaxed text-mute">
                No runs yet. Trigger one against a ready asset.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {runs.data?.items.map((run) => (
                  <li key={run.id} className="rounded-[5px] border border-hairline bg-black/25 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge status={run.status} />
                      <span className="text-[11.5px] text-dim">{formatRelative(run.createdAt)}</span>
                    </div>
                    <ol className="mt-2 space-y-1">
                      {run.stepResults.map((step) => (
                        <li key={step.stepId} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="flex items-center gap-1.5 text-mute">
                            <span
                              className={cn(
                                'size-1.5 rounded-full',
                                step.status === 'succeeded'
                                  ? 'bg-ok'
                                  : step.status === 'failed'
                                    ? 'bg-danger'
                                    : step.status === 'skipped'
                                      ? 'bg-dim'
                                      : 'bg-warn',
                              )}
                              aria-hidden
                            />
                            {step.label}
                          </span>
                          <span className="truncate text-[11.5px] text-dim">
                            {step.durationMs ? `${(step.durationMs / 1000).toFixed(1)}s` : step.status}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <Link
                      to={`/app/assets/${run.assetId}`}
                      className="mt-2 inline-flex items-center gap-1 text-[10.5px] text-signal hover:text-plasma"
                    >
                      Inspect output asset <ArrowRight className="size-2.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New workflow"
        description="Steps run in order. Transform steps replace the current asset, so later steps operate on the derivative."
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={submitDraft}
              loading={createWorkflow.isPending}
              disabled={!draft.name.trim() || draft.steps.length === 0}
            >
              Create workflow
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="workflow-name">
            <Input
              id="workflow-name"
              autoFocus
              maxLength={80}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="Publish-ready audio"
            />
          </Field>
          <Field label="Description" htmlFor="workflow-description">
            <Textarea
              id="workflow-description"
              maxLength={400}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="What this workflow guarantees, and for which media."
            />
          </Field>

          <div>
            <div className="flex items-center justify-between">
              <Label>Steps</Label>
              <Button size="sm" variant="outline" onClick={addStep}>
                <Plus className="size-3" aria-hidden /> Add step
              </Button>
            </div>
            {draft.steps.length === 0 ? (
              <p className="mt-2 text-[12px] text-dim">Add at least one step.</p>
            ) : (
              <ol className="mt-2 space-y-2">
                {draft.steps.map((step, index) => (
                  <li key={index} className="rounded-[5px] border border-hairline bg-black/25 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] text-dim">STEP {index + 1}</span>
                      <IconButton
                        label={`Remove step ${index + 1}`}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            steps: current.steps.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                      >
                        <Trash2 className="size-3" aria-hidden />
                      </IconButton>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Select
                        aria-label={`Step ${index + 1} type`}
                        value={step.type}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            steps: current.steps.map((item, itemIndex) =>
                              itemIndex === index ? { type: event.target.value as StepType } : item,
                            ),
                          }))
                        }
                      >
                        {(Object.keys(STEP_META) as StepType[]).map((type) => (
                          <option key={type} value={type}>
                            {STEP_META[type].label}
                          </option>
                        ))}
                      </Select>

                      {step.type === 'transform' ? (
                        <Select
                          aria-label={`Step ${index + 1} preset`}
                          value={step.presetId ?? ''}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              steps: current.steps.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, presetId: event.target.value } : item,
                              ),
                            }))
                          }
                        >
                          <option value="">Choose a preset…</option>
                          {(capabilities.data?.transforms ?? []).map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.label}
                            </option>
                          ))}
                        </Select>
                      ) : step.type === 'tag' ? (
                        <Input
                          aria-label={`Step ${index + 1} tags`}
                          value={step.tags ?? ''}
                          placeholder="review, deliverable"
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              steps: current.steps.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, tags: event.target.value } : item,
                              ),
                            }))
                          }
                        />
                      ) : step.type === 'collect' ? (
                        <Select
                          aria-label={`Step ${index + 1} collection`}
                          value={step.collectionId ?? ''}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              steps: current.steps.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, collectionId: event.target.value } : item,
                              ),
                            }))
                          }
                        >
                          <option value="">Choose a collection…</option>
                          {collections.data?.items.map((collection) => (
                            <option key={collection.id} value={collection.id}>
                              {collection.name}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <p className="self-center text-[11px] text-dim">{STEP_META[step.type].hint}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(runTarget)}
        onClose={() => setRunTarget(null)}
        title={`Run “${runTarget?.name ?? ''}”`}
        description="Select the source asset. The run is queued as a durable job and can be cancelled from the observatory."
      >
        <p className="text-[13px] leading-relaxed text-mute">
          Pick an asset that has finished probing. Workflows never mutate originals in place.
        </p>
        <Button
          variant="primary"
          className="mt-4 w-full"
          onClick={() => setPickerOpen(true)}
        >
          Choose asset
        </Button>
      </Modal>

      <AssetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Choose a workflow input"
        onSelect={(asset) => {
          if (!runTarget) return;
          runWorkflow.mutate(
            { id: runTarget.id, assetId: asset.id },
            {
              onSuccess: () => {
                notify({
                  tone: 'ok',
                  title: 'Workflow queued',
                  body: 'Follow each step in the run history or the observatory.',
                });
                setSelectedId(runTarget.id);
                setRunTarget(null);
                setPickerOpen(false);
              },
              onError: (error) =>
                notify({
                  tone: 'danger',
                  title: 'Run refused',
                  body: error instanceof ApiError ? error.message : 'Unknown error',
                }),
            },
          );
        }}
      />
    </div>
  );
}
