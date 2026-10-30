# Data model

Engine: SQLite via Node's built-in `node:sqlite` (`DatabaseSync`), WAL enabled,
foreign keys on. 18 tables, created by forward-only migrations in
`apps/server/src/db/schema.ts`. All identifiers are UUIDv4 strings; **all timestamps
are ISO-8601 UTC text** so they sort lexicographically and survive JSON round-trips
unchanged.

## 1. Entity overview

```
users ──< memberships >── workspaces ──< assets ──< asset_streams
  │                          │             │  └──< asset_tags >── tags
  │                          │             │  └──< collection_items >── collections
  │                          │             └──< assets (parent_asset_id, self-referencing)
  │                          ├──< jobs ──< job_events
  │                          │      └──< jobs (parent_job_id)
  │                          ├──< workflows ──< workflow_runs
  │                          ├──< provider_connections
  │                          └──< audit_events
  └──< sessions
```

## 2. Tables

### Identity and access

| Table | Key columns | Notes |
| --- | --- | --- |
| `users` | `id`, `email` UNIQUE, `display_name`, `password_hash`, `created_at` | Hash format `scrypt$N$r$p$salt$key` (N=16384, r=8, p=1, 64-byte key). Cost parameters are stored with the hash so they can be raised later without invalidating existing accounts. |
| `workspaces` | `id`, `name`, `created_at` | Exactly one workspace per instance in this build. |
| `memberships` | `(user_id, workspace_id)`, `role` | Role ∈ `owner`/`editor`/`viewer`. |
| `sessions` | `id`, `token_hash` UNIQUE, `csrf_token`, `expires_at`, `last_seen_at` | Only the SHA-256 of the session token is stored; a database leak does not yield usable cookies. Each session has its **own** CSRF token. |
| `audit_events` | `id`, `workspace_id`, `actor_id`, `action`, `target_type`, `target_id`, `metadata`, `created_at` | Append-only by convention; the API exposes GET only. |

### Media

| Table | Key columns | Notes |
| --- | --- | --- |
| `assets` | `id`, `workspace_id`, `title`, `kind`, `status`, `sha256`, `storage_path` UNIQUE, `size_bytes`, `mime_type`, `duration_ms`, `width`, `height`, `video_codec`, `audio_codec`, `container`, `bit_rate`, `probe_json`, `metadata_json`, `quality_json`, `thumbnail_path`, `waveform_path`, `parent_asset_id`, `version`, `source_kind`, `source_url`, `error_message`, `deleted_at` | `kind` and `status` are CHECK-constrained. `sha256` is always computed by the server, never trusted from the client. `storage_path` UNIQUE prevents two rows pointing at one file. Indexes: `(workspace_id, created_at DESC)`, `(workspace_id, sha256)` for dedupe, `(parent_asset_id)` for lineage. |
| `asset_streams` | `(asset_id, stream_index)` PK, `type`, `codec`, `profile`, `width`, `height`, `frame_rate`, `frame_rate_mode`, `bit_rate`, `sample_rate`, `channels`, `channel_layout`, `bit_depth`, `pixel_format`, `color_space`, `color_transfer`, `hdr`, `language`, `title` | One row per FFprobe stream. `frame_rate_mode` distinguishes CFR/VFR/unknown, which is why the product does not print a single "fps" number for VFR media. |
| `tags` | `(workspace_id, name)` UNIQUE | Case-normalised on write. |
| `asset_tags` | `(asset_id, tag_id)` PK, `added_at` | |
| `collections` | `id`, `workspace_id`, `name`, `description` | |
| `collection_items` | `(collection_id, asset_id)` PK, `position`, `added_at` | Ordering is explicit so the UI can promise stable order. |

### Jobs and workflows

| Table | Key columns | Notes |
| --- | --- | --- |
| `jobs` | `id`, `workspace_id`, `kind`, `status`, `priority`, `payload`, `result`, `progress`, `attempts`, `max_attempts`, `error_code`, `error_message`, `cancel_requested`, `worker_id`, `lease_expires_at`, `run_after`, `parent_job_id` | `status` CHECK includes `waiting_approval`. Index `(status, priority, run_after)` is the claim index — the queue selects `queued` rows ordered by `priority DESC, run_after ASC`. `lease_expires_at` is the recovery primitive: a `running` row whose lease expired is requeued. |
| `job_events` | `id`, `job_id`, `seq`, `level`, `message`, `data` | Append-only progress log; also published over SSE. |
| `workflows` | `id`, `workspace_id`, `name`, `version`, `steps` (JSON) | Steps validated by `WorkflowStepSchema` on write. |
| `workflow_runs` | `id`, `workflow_id`, `asset_id`, `job_id`, `status`, `step_results` (JSON) | `job_id` FK means a run cannot outlive its job. |

### Integration and configuration

| Table | Key columns | Notes |
| --- | --- | --- |
| `provider_connections` | `(workspace_id, provider_id)` UNIQUE, `status`, `scopes`, `account_label`, `token_cipher`, `expires_at` | `token_cipher` exists so tokens *can* be stored encrypted later; in this build nothing writes it, because no OAuth flow is enabled. `removeConnection` deletes the row. |
| `app_settings` | `key` PK, `value`, `updated_at` | Server-owned keys only (e.g. schema/seed markers). |

## 3. Invariants enforced in code

1. **One hash, one asset.** Uploads compute SHA-256 while streaming; a repeat upload
   returns the existing asset id with `duplicate: true` and HTTP 200 (not 201).
2. **No floating metadata.** `probe_json` is the raw FFprobe document; the typed
   columns are derived from it in one place, so a UI field can always be traced to a
   probe output.
3. **Derivatives are assets.** A transform creates a new row with
   `source_kind = 'derived'`, `parent_asset_id`, and its own verified hash — never a
   mutation of the parent.
4. **Deletion is soft first.** `deleted_at` is set, then the file is removed; a file
   on disk without a row is collected by the storage sweep.
5. **Idempotent lease recovery.** Requeueing a stale job appends an attempt and a
   `job_events` row, so a crash loop is visible rather than silent.

## 4. Why not Postgres / an ORM

- `node:sqlite` ships with the runtime; Postgres would require an external service
  and break the single-machine promise (ADR-0002).
- No ORM: the schema is 250 lines of SQL and the query surface is ~40 statements.
  An ORM would add a mapping layer between the product and the facts it stores,
  which is exactly where "metadata drift" bugs live.
- Migrations are applied in order on boot inside a transaction; a `schema_version`
  marker in `app_settings` records the applied level.

## 5. Sizing

Measured on the live instance with 5 assets (2 masters + 3 derivatives):
database 176 kB, media 1.10 MB, derived 49.6 kB. A 10,000-asset library with
100k job rows is expected to stay in the low hundreds of MB; the only unbounded
growth vector is `job_events`, which retention should cap (roadmap R-04).
