/**
 * Schema migrations.
 *
 * Applied in order inside a transaction, recorded in `schema_migrations`.
 * Migrations are append-only: never edit a shipped migration, add a new one.
 */
export interface Migration {
  id: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: '0001_core',
    sql: `
    CREATE TABLE users (
      id            TEXT PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      display_name  TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE workspaces (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE memberships (
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      role         TEXT NOT NULL CHECK (role IN ('owner','editor','viewer')),
      created_at   TEXT NOT NULL,
      PRIMARY KEY (user_id, workspace_id)
    );

    CREATE TABLE sessions (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  TEXT NOT NULL UNIQUE,
      csrf_token  TEXT NOT NULL,
      user_agent  TEXT,
      created_at  TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at  TEXT NOT NULL
    );
    CREATE INDEX idx_sessions_expires ON sessions(expires_at);

    CREATE TABLE audit_events (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
      actor_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
      action       TEXT NOT NULL,
      target_type  TEXT,
      target_id    TEXT,
      metadata     TEXT,
      created_at   TEXT NOT NULL
    );
    CREATE INDEX idx_audit_created ON audit_events(created_at DESC);

    CREATE TABLE assets (
      id                TEXT PRIMARY KEY,
      workspace_id      TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      title             TEXT NOT NULL,
      kind              TEXT NOT NULL CHECK (kind IN ('audio','video','image','unknown')),
      status            TEXT NOT NULL CHECK (status IN ('queued','probing','ready','error','missing')),
      mime_type         TEXT,
      size_bytes        INTEGER NOT NULL DEFAULT 0,
      sha256            TEXT NOT NULL,
      storage_path      TEXT NOT NULL,
      source_kind       TEXT NOT NULL CHECK (source_kind IN ('upload','url','derived')),
      source_url        TEXT,
      duration_ms       INTEGER,
      width             INTEGER,
      height            INTEGER,
      video_codec       TEXT,
      audio_codec       TEXT,
      container         TEXT,
      bit_rate          INTEGER,
      probe_json        TEXT,
      metadata_json     TEXT,
      quality_json      TEXT,
      thumbnail_path    TEXT,
      waveform_path     TEXT,
      parent_asset_id   TEXT REFERENCES assets(id) ON DELETE SET NULL,
      version           INTEGER NOT NULL DEFAULT 1,
      error_message     TEXT,
      created_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
      acquired_at       TEXT NOT NULL,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL,
      deleted_at        TEXT
    );
    CREATE INDEX idx_assets_ws_created ON assets(workspace_id, created_at DESC);
    CREATE INDEX idx_assets_sha ON assets(workspace_id, sha256);
    CREATE INDEX idx_assets_parent ON assets(parent_asset_id);
    CREATE UNIQUE INDEX idx_assets_storage_path ON assets(storage_path);

    CREATE TABLE asset_streams (
      asset_id       TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      stream_index   INTEGER NOT NULL,
      type           TEXT NOT NULL,
      codec          TEXT,
      profile        TEXT,
      width          INTEGER,
      height         INTEGER,
      frame_rate     REAL,
      frame_rate_mode TEXT NOT NULL DEFAULT 'unknown',
      bit_rate       INTEGER,
      sample_rate    INTEGER,
      channels       INTEGER,
      channel_layout TEXT,
      bit_depth      INTEGER,
      pixel_format   TEXT,
      color_space    TEXT,
      color_transfer TEXT,
      hdr            INTEGER NOT NULL DEFAULT 0,
      language       TEXT,
      title          TEXT,
      PRIMARY KEY (asset_id, stream_index)
    );

    CREATE TABLE tags (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      UNIQUE (workspace_id, name)
    );

    CREATE TABLE asset_tags (
      asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      tag_id   TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      added_at TEXT NOT NULL,
      PRIMARY KEY (asset_id, tag_id)
    );

    CREATE TABLE collections (
      id          TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      description TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE collection_items (
      collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      asset_id      TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      position      INTEGER NOT NULL DEFAULT 0,
      added_at      TEXT NOT NULL,
      PRIMARY KEY (collection_id, asset_id)
    );

    CREATE TABLE jobs (
      id               TEXT PRIMARY KEY,
      workspace_id     TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      kind             TEXT NOT NULL,
      status           TEXT NOT NULL CHECK (status IN ('queued','running','succeeded','failed','cancelled','waiting_approval')),
      priority         INTEGER NOT NULL DEFAULT 100,
      payload          TEXT NOT NULL,
      result           TEXT,
      progress         REAL NOT NULL DEFAULT 0,
      attempts         INTEGER NOT NULL DEFAULT 0,
      max_attempts     INTEGER NOT NULL DEFAULT 3,
      error_code       TEXT,
      error_message    TEXT,
      cancel_requested INTEGER NOT NULL DEFAULT 0,
      worker_id        TEXT,
      lease_expires_at TEXT,
      run_after        TEXT NOT NULL,
      created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
      parent_job_id    TEXT REFERENCES jobs(id) ON DELETE CASCADE,
      created_at       TEXT NOT NULL,
      started_at       TEXT,
      finished_at      TEXT,
      updated_at       TEXT NOT NULL
    );
    CREATE INDEX idx_jobs_status ON jobs(status, priority, run_after);
    CREATE INDEX idx_jobs_ws_created ON jobs(workspace_id, created_at DESC);

    CREATE TABLE job_events (
      id         TEXT PRIMARY KEY,
      job_id     TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      seq        INTEGER NOT NULL,
      level      TEXT NOT NULL,
      message    TEXT NOT NULL,
      data       TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX idx_job_events_job ON job_events(job_id, seq);

    CREATE TABLE workflows (
      id           TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name         TEXT NOT NULL,
      description  TEXT,
      version      INTEGER NOT NULL DEFAULT 1,
      steps        TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE TABLE workflow_runs (
      id           TEXT PRIMARY KEY,
      workflow_id  TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
      asset_id     TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      job_id       TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      status       TEXT NOT NULL,
      step_results TEXT NOT NULL,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );
    CREATE INDEX idx_workflow_runs_wf ON workflow_runs(workflow_id, created_at DESC);

    CREATE TABLE provider_connections (
      id            TEXT PRIMARY KEY,
      workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      provider_id   TEXT NOT NULL,
      status        TEXT NOT NULL,
      scopes        TEXT,
      account_label TEXT,
      token_cipher  TEXT,
      expires_at    TEXT,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      UNIQUE (workspace_id, provider_id)
    );

    CREATE TABLE app_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    `,
  },
  {
    id: '0002_asset_analysis',
    sql: `
    -- Measurements produced by the media-core service. Kept in their own table
    -- so a re-run is an upsert and a service outage cannot blank earlier facts.
    CREATE TABLE asset_analysis (
      asset_id      TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
      workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      engine        TEXT NOT NULL,
      report_json   TEXT NOT NULL,
      measured_at   TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE INDEX idx_asset_analysis_workspace ON asset_analysis (workspace_id, measured_at);
    `,
  },
];
